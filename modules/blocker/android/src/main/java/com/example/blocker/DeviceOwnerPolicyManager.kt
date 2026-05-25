package com.example.blocker

import android.Manifest
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.UserManager

class DeviceOwnerPolicyManager(
  private val context: Context,
  private val repository: PolicyRepository
) {
  private val manager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
  private val component = ComponentName(context, BlockerDeviceAdminReceiver::class.java)

  fun applyStrictMode(pin: String? = null): Map<String, Any?> {
    repository.assertCanChangePolicy(pin)

    if (!isManagedOwner()) {
      repository.recordAuditEvent(
        eventType = "STRICT_DEVICE_OWNER_POLICY_FAILED",
        severity = "critical",
        category = "device_owner",
        subject = context.packageName,
        action = "device_owner_required"
      )
      return result(false, "device_owner_or_profile_owner_required", emptyList())
    }

    repository.setStrictModeEnabled(true, pin)

    val failed = mutableListOf<String>()
    apply("set_uninstall_blocked", failed) {
      manager.setUninstallBlocked(component, context.packageName, true)
    }
    apply("set_always_on_vpn_lockdown", failed) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        manager.setAlwaysOnVpnPackage(component, context.packageName, true)
        repository.setAlwaysOnVpnLockdownEnabled(true, pin)
      }
    }
    strictRestrictions().forEach { restriction ->
      apply("restriction:$restriction", failed) {
        manager.addUserRestriction(component, restriction)
      }
    }
    apply("grant_post_notifications", failed) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        manager.setPermissionGrantState(
          component,
          context.packageName,
          Manifest.permission.POST_NOTIFICATIONS,
          DevicePolicyManager.PERMISSION_GRANT_STATE_GRANTED
        )
      }
    }

    val suspension = ManagedEnforcer(context, repository).setPackageSuspensionEnabled(true, pin)
    val suspensionReason = suspension["reason"] as? String
    if (suspension["applied"] != true && suspensionReason != null) {
      failed.add("package_suspension:$suspensionReason")
    }

    repository.recordAuditEvent(
      eventType = "STRICT_DEVICE_OWNER_POLICY_APPLIED",
      severity = if (failed.isEmpty()) "high" else "critical",
      category = "device_owner",
      subject = context.packageName,
      action = if (failed.isEmpty()) "applied" else "partial",
      metadata = mapOf("failed" to failed.joinToString(","))
    )

    return result(failed.isEmpty(), failed.firstOrNull(), failed)
  }

  fun setEmergencyLock(enabled: Boolean, pin: String? = null): Map<String, Any?> {
    repository.setEmergencyLockEnabled(enabled, pin)

    val failed = mutableListOf<String>()
    if (isManagedOwner()) {
      strictRestrictions().forEach { restriction ->
        apply("emergency_restriction:$restriction", failed) {
          if (enabled) {
            manager.addUserRestriction(component, restriction)
          } else if (!repository.isStrictModeEnabled()) {
            manager.clearUserRestriction(component, restriction)
          }
        }
      }
    } else if (enabled) {
      failed.add("device_owner_or_profile_owner_required")
    }

    val suspension = ManagedEnforcer(context, repository).applyPackageSuspension()
    val suspensionReason = suspension["reason"] as? String
    if (enabled && suspension["applied"] != true && suspensionReason != null) {
      failed.add("package_suspension:$suspensionReason")
    }

    GuardianNotifier.notify(
      context = context,
      eventType = "EMERGENCY_LOCK_CHANGED",
      severity = if (enabled) "critical" else "high",
      subject = "emergency_lock",
      action = if (enabled) "enabled" else "disabled",
      metadata = mapOf("failed" to failed.joinToString(","))
    )

    return result(failed.isEmpty(), failed.firstOrNull(), failed)
  }

  fun status(): Map<String, Any?> {
    val managedOwner = isManagedOwner()
    val requiredRestrictions = strictRestrictions()
    val appliedRestrictions = if (managedOwner) {
      runCatching {
        val restrictions = manager.getUserRestrictions(component)
        requiredRestrictions.filter { restrictions.getBoolean(it, false) }
      }.getOrDefault(emptyList())
    } else {
      emptyList()
    }
    val missingRestrictions = if (managedOwner) {
      requiredRestrictions - appliedRestrictions.toSet()
    } else {
      requiredRestrictions
    }
    val uninstallBlocked = if (managedOwner) {
      runCatching { manager.isUninstallBlocked(component, context.packageName) }.getOrDefault(false)
    } else {
      false
    }
    val alwaysOnVpnPackage = if (managedOwner && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      runCatching { manager.getAlwaysOnVpnPackage(component) }.getOrNull()
    } else {
      null
    }
    val lockdownApplied = if (managedOwner && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      runCatching { manager.isAlwaysOnVpnLockdownEnabled(component) }.getOrDefault(false)
    } else {
      false
    }

    return mapOf(
      "managedOwner" to managedOwner,
      "strictModeEnabled" to repository.isStrictModeEnabled(),
      "emergencyLockEnabled" to repository.isEmergencyLockEnabled(),
      "requiredRestrictions" to requiredRestrictions,
      "appliedRestrictions" to appliedRestrictions,
      "missingRestrictions" to missingRestrictions,
      "failedRestrictions" to missingRestrictions,
      "canApplyStrictPolicy" to managedOwner,
      "canBlockNetworkWithoutVpn" to (managedOwner && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N),
      "alwaysOnVpnPackage" to alwaysOnVpnPackage,
      "alwaysOnVpnLockdownApplied" to lockdownApplied,
      "uninstallBlocked" to uninstallBlocked
    )
  }

  private fun strictRestrictions(): List<String> {
    val restrictions = mutableListOf(
      UserManager.DISALLOW_SAFE_BOOT,
      UserManager.DISALLOW_FACTORY_RESET,
      UserManager.DISALLOW_ADD_USER,
      UserManager.DISALLOW_REMOVE_USER,
      UserManager.DISALLOW_ADD_MANAGED_PROFILE,
      UserManager.DISALLOW_INSTALL_APPS,
      UserManager.DISALLOW_UNINSTALL_APPS,
      UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES,
      UserManager.DISALLOW_CONFIG_CREDENTIALS,
      UserManager.DISALLOW_DEBUGGING_FEATURES,
      UserManager.DISALLOW_MODIFY_ACCOUNTS,
      UserManager.DISALLOW_CONFIG_DATE_TIME,
      UserManager.DISALLOW_CONFIG_VPN,
      UserManager.DISALLOW_APPS_CONTROL
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      restrictions.add(UserManager.DISALLOW_CONFIG_PRIVATE_DNS)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      restrictions.add(UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES_GLOBALLY)
    }
    return restrictions.distinct()
  }

  private fun apply(name: String, failed: MutableList<String>, block: () -> Unit) {
    try {
      block()
    } catch (cause: Exception) {
      failed.add("$name:${cause.javaClass.simpleName}")
    }
  }

  private fun isManagedOwner(): Boolean =
    manager.isDeviceOwnerApp(context.packageName) || manager.isProfileOwnerApp(context.packageName)

  private fun result(applied: Boolean, reason: String?, failed: List<String>): Map<String, Any?> = mapOf(
    "applied" to applied,
    "reason" to reason,
    "failedPolicies" to failed,
    "deviceOwnerPolicyStatus" to status(),
    "managedEnforcementStatus" to ManagedEnforcer(context, repository).status()
  )
}
