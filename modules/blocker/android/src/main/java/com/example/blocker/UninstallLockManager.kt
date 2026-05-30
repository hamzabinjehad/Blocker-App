package com.example.blocker

import android.app.AlarmManager
import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build

class UninstallLockManager(
  private val context: Context,
  private val repository: PolicyRepository
) {
  private val appContext = context.applicationContext
  private val manager = appContext.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
  private val component = ComponentName(appContext, BlockerDeviceAdminReceiver::class.java)

  fun setEnabled(enabled: Boolean, durationDays: Int? = null, pin: String? = null): Map<String, Any?> {
    repository.assertCanChangePolicy(pin)

    if (!isManagedOwner()) {
      repository.recordAuditEvent(
        eventType = "UNINSTALL_PROTECTION_NOT_APPLIED",
        severity = "critical",
        category = "device_owner",
        subject = appContext.packageName,
        action = "managed_owner_required",
        metadata = mapOf("deviceAdminActive" to manager.isAdminActive(component).toString())
      )
      return mapOf("applied" to false, "reason" to "device_owner_or_profile_owner_required")
    }

    return if (enabled) {
      enable(durationDays)
    } else {
      disable()
    }
  }

  fun enableForActiveProtection(durationDays: Int? = null): Map<String, Any?> {
    if (!isManagedOwner()) {
      val expiresAt = repository.setUninstallLockWindow(durationDays ?: repository.uninstallLockDurationDays())
      scheduleExpiry(appContext, expiresAt)
      repository.recordAuditEvent(
        eventType = "PROTECTION_TIME_LOCK_STARTED",
        severity = "high",
        category = "protection",
        subject = appContext.packageName,
        action = "timer_only",
        metadata = mapOf(
          "durationDays" to repository.uninstallLockDurationDays(),
          "managedOwner" to "false"
        )
      )
      return mapOf(
        "applied" to false,
        "reason" to "device_owner_or_profile_owner_required",
        "uninstallLockExpiresAt" to expiresAt,
        "uninstallLockRemainingMs" to repository.uninstallLockRemainingMs()
      )
    }

    return enable(durationDays)
  }

  fun reconcile() {
    if (!isManagedOwner()) {
      if (repository.isUninstallLockWindowActive()) {
        scheduleExpiry(appContext, repository.uninstallLockExpiresAt())
      } else if (repository.uninstallLockExpiresAt() > 0L) {
        repository.clearUninstallLockWindow()
        cancelExpiryAlarm(appContext)
      } else {
        cancelExpiryAlarm(appContext)
      }
      return
    }

    val now = System.currentTimeMillis()
    val expiresAt = repository.uninstallLockExpiresAt()
    when {
      repository.isUninstallLockWindowActive(now) -> {
        val wasBlocked = isManagedUninstallBlocked()
        val reapplied = setManagedUninstallBlocked(true)
        if (reapplied && !wasBlocked) {
          repository.recordAuditEvent(
            eventType = "UNINSTALL_PROTECTION_REAPPLIED",
            severity = "critical",
            category = "device_owner",
            subject = appContext.packageName,
            action = "reapplied_after_drift",
            metadata = mapOf("expiresAt" to expiresAt)
          )
          GuardianNotifier.notify(
            context = appContext,
            eventType = "UNINSTALL_PROTECTION_REAPPLIED",
            severity = "critical",
            subject = appContext.packageName,
            action = "reapplied_after_drift",
            metadata = mapOf("expiresAt" to expiresAt)
          )
        } else if (!reapplied) {
          repository.setTampered(true)
          if (repository.recordDomainEvent("uninstall-lock.local", "tamper", "uninstall_lock_reapply_failed")) {
            GuardianNotifier.notify(
              context = appContext,
              eventType = "UNINSTALL_PROTECTION_REAPPLY_FAILED",
              severity = "critical",
              subject = appContext.packageName,
              action = "android_rejected"
            )
          }
        }
        scheduleExpiry(appContext, expiresAt)
      }
      expiresAt > 0L -> {
        releaseExpiredLock()
      }
      else -> cancelExpiryAlarm(appContext)
    }
  }

  fun releaseExpiredLock(): Boolean {
    if (repository.isUninstallLockWindowActive()) {
      scheduleExpiry(appContext, repository.uninstallLockExpiresAt())
      return false
    }

    if (!isManagedOwner()) {
      repository.clearUninstallLockWindow()
      cancelExpiryAlarm(appContext)
      return false
    }

    return runCatching {
      manager.setUninstallBlocked(component, appContext.packageName, false)
      repository.clearUninstallLockWindow()
      cancelExpiryAlarm(appContext)
      repository.recordAuditEvent(
        eventType = "UNINSTALL_TIME_LOCK_EXPIRED",
        severity = "high",
        category = "device_owner",
        subject = appContext.packageName,
        action = "released"
      )
      true
    }.getOrDefault(false)
  }

  private fun enable(durationDays: Int?): Map<String, Any?> {
    val days = durationDays ?: repository.uninstallLockDurationDays()
    return try {
      manager.setUninstallBlocked(component, appContext.packageName, true)
      val expiresAt = repository.setUninstallLockWindow(days)
      scheduleExpiry(appContext, expiresAt)
      repository.recordAuditEvent(
        eventType = "UNINSTALL_PROTECTION_CHANGED",
        severity = "critical",
        category = "device_owner",
        subject = appContext.packageName,
        action = "enabled",
        metadata = mapOf(
          "durationDays" to repository.uninstallLockDurationDays(),
          "expiresAt" to expiresAt
        )
      )
      GuardianNotifier.notify(
        context = appContext,
        eventType = "UNINSTALL_PROTECTION_CHANGED",
        severity = "critical",
        subject = appContext.packageName,
        action = "enabled",
        metadata = mapOf(
          "durationDays" to repository.uninstallLockDurationDays(),
          "expiresAt" to expiresAt
        )
      )
      mapOf("applied" to true)
    } catch (_: Exception) {
      repository.recordAuditEvent(
        eventType = "UNINSTALL_PROTECTION_NOT_APPLIED",
        severity = "critical",
        category = "device_owner",
        subject = appContext.packageName,
        action = "android_rejected"
      )
      mapOf("applied" to false, "reason" to "android_rejected_uninstall_block")
    }
  }

  private fun disable(): Map<String, Any?> {
    if (repository.isUninstallLockWindowActive()) {
      setManagedUninstallBlocked(true)
      scheduleExpiry(appContext, repository.uninstallLockExpiresAt())
      repository.recordAuditEvent(
        eventType = "UNINSTALL_PROTECTION_DISABLE_BLOCKED",
        severity = "critical",
        category = "device_owner",
        subject = appContext.packageName,
        action = "time_lock_active",
        metadata = mapOf(
          "expiresAt" to repository.uninstallLockExpiresAt(),
          "remainingMs" to repository.uninstallLockRemainingMs()
        )
      )
      return mapOf(
        "applied" to false,
        "reason" to "uninstall_lock_active",
        "uninstallLockExpiresAt" to repository.uninstallLockExpiresAt(),
        "uninstallLockRemainingMs" to repository.uninstallLockRemainingMs()
      )
    }

    return try {
      manager.setUninstallBlocked(component, appContext.packageName, false)
      repository.clearUninstallLockWindow()
      cancelExpiryAlarm(appContext)
      repository.recordAuditEvent(
        eventType = "UNINSTALL_PROTECTION_CHANGED",
        severity = "high",
        category = "device_owner",
        subject = appContext.packageName,
        action = "disabled"
      )
      GuardianNotifier.notify(
        context = appContext,
        eventType = "UNINSTALL_PROTECTION_CHANGED",
        severity = "high",
        subject = appContext.packageName,
        action = "disabled"
      )
      mapOf("applied" to true)
    } catch (_: Exception) {
      repository.recordAuditEvent(
        eventType = "UNINSTALL_PROTECTION_NOT_APPLIED",
        severity = "critical",
        category = "device_owner",
        subject = appContext.packageName,
        action = "android_rejected"
      )
      mapOf("applied" to false, "reason" to "android_rejected_uninstall_block")
    }
  }

  private fun isManagedOwner(): Boolean =
    manager.isDeviceOwnerApp(appContext.packageName) || manager.isProfileOwnerApp(appContext.packageName)

  private fun isManagedUninstallBlocked(): Boolean =
    runCatching { manager.isUninstallBlocked(component, appContext.packageName) }.getOrDefault(false)

  private fun setManagedUninstallBlocked(blocked: Boolean): Boolean =
    runCatching {
      manager.setUninstallBlocked(component, appContext.packageName, blocked)
      true
    }.getOrDefault(false)

  companion object {
    const val ACTION_UNINSTALL_LOCK_EXPIRED = "com.example.blocker.action.UNINSTALL_LOCK_EXPIRED"

    fun scheduleExpiry(context: Context, expiresAt: Long) {
      if (expiresAt <= System.currentTimeMillis()) return
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val pendingIntent = expiryPendingIntent(context)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, expiresAt, pendingIntent)
      } else {
        alarmManager.set(AlarmManager.RTC_WAKEUP, expiresAt, pendingIntent)
      }
    }

    fun cancelExpiryAlarm(context: Context) {
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      alarmManager.cancel(expiryPendingIntent(context))
    }

    private fun expiryPendingIntent(context: Context): PendingIntent {
      val intent = Intent(context, UninstallLockReceiver::class.java).apply {
        action = ACTION_UNINSTALL_LOCK_EXPIRED
      }
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or
        (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
      return PendingIntent.getBroadcast(context, 41230, intent, flags)
    }
  }
}
