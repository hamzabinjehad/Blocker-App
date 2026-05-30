package com.example.blocker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.UserManager

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val trigger = when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED -> "boot_completed"
      Intent.ACTION_LOCKED_BOOT_COMPLETED -> "locked_boot_completed"
      Intent.ACTION_MY_PACKAGE_REPLACED -> "app_update"
      ACTION_QUICKBOOT_POWERON -> "quickboot_poweron"
      else -> return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      val userManager = context.getSystemService(UserManager::class.java)
      if (userManager?.isUserUnlocked == false) return
    }

    val repository = PolicyRepository(context)
    val previousSafeModeBoot = repository.wasSafeModeBoot()
    val isSafeMode = detectSafeMode(context)
    repository.setSafeModeBoot(isSafeMode)

    if (isSafeMode) {
      repository.recordAuditEvent(
        eventType = "SAFE_MODE_BOOT",
        severity = "critical",
        category = "tamper",
        subject = trigger,
        action = "safe_mode_detected"
      )
      GuardianNotifier.notify(
        context = context,
        eventType = "SAFE_MODE_BOOT",
        severity = "critical",
        subject = trigger,
        action = "safe_mode_detected"
      )
      BlockOverlayService.show(
        context,
        "Safe Mode detected",
        "Device booted in safe mode - all protection is currently disabled. Parent action required."
      )
    }

    if (!isSafeMode && previousSafeModeBoot) {
      repository.recordAuditEvent(
        eventType = "SAFE_MODE_PREVIOUS_BOOT",
        severity = "critical",
        category = "tamper",
        subject = trigger,
        action = "warning_on_normal_boot"
      )
      GuardianNotifier.notify(
        context = context,
        eventType = "SAFE_MODE_PREVIOUS_BOOT",
        severity = "critical",
        subject = trigger,
        action = "warning_on_normal_boot"
      )
      BlockOverlayService.show(
        context,
        "Safe Mode was used",
        "Protection may have been disabled during the previous boot. Guardian review is recommended."
      )
    }

    if (repository.isProtectionRequested()) {
      ManagedPrivateDnsBackup.configureIfPossible(context, repository)
      if (VpnService.prepare(context) == null) {
        repository.setVpnActive(false)
        repository.setTampered(false)
        val startIntent = Intent(context, FilterVpnService::class.java).apply {
          action = FilterVpnService.ACTION_START
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(startIntent)
        } else {
          context.startService(startIntent)
        }
        repository.recordDomainEvent("device-boot.local", "tamper", "vpn_restart_requested")
        GuardianNotifier.notify(
          context = context,
          eventType = "BOOT_PROTECTION_RESTARTED",
          severity = "high",
          subject = trigger,
          action = "vpn_restart_requested"
        )
      } else {
        repository.setVpnActive(false)
        repository.setTampered(true)
        repository.recordDomainEvent("device-boot.local", "tamper", "restart_required")
        GuardianNotifier.notify(
          context = context,
          eventType = "BOOT_PROTECTION_RESTART_REQUIRED",
          severity = "critical",
          subject = trigger,
          action = "vpn_permission_required"
        )
        BlockOverlayService.show(context, "Protection restart required", "VPN permission must be restored after boot")
      }
    }

    VpnRestartJobService.schedulePeriodic(context)
    BlocklistUpdateWorker.scheduleWeekly(context)
    NightModeWorker.schedule(context)
    ManagedEnforcer(context, repository).applyPackageSuspension()
    UninstallLockManager(context, repository).reconcile()
    TamperDetector(context, repository).evaluateAndRecord(FilterVpnService.isRunning && repository.isVpnActive())
  }

  private fun detectSafeMode(context: Context): Boolean {
    return try {
      context.packageManager.isSafeMode
    } catch (_: Exception) {
      false
    }
  }

  companion object {
    private const val ACTION_QUICKBOOT_POWERON = "android.intent.action.QUICKBOOT_POWERON"
  }
}
