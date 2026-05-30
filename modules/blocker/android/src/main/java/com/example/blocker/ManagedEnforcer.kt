package com.example.blocker

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build

class ManagedEnforcer(
  private val context: Context,
  private val repository: PolicyRepository
) {
  private val manager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
  private val component = ComponentName(context, BlockerDeviceAdminReceiver::class.java)

  fun status(): Map<String, Any?> {
    val managedOwner = isManagedOwner()
    val alwaysOnPackage = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && managedOwner) {
      runCatching { manager.getAlwaysOnVpnPackage(component) }.getOrNull()
    } else {
      null
    }
    val lockdownEnabled = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && managedOwner) {
      runCatching { manager.isAlwaysOnVpnLockdownEnabled(component) }.getOrDefault(false)
    } else {
      false
    }

    return mapOf(
      "managedOwner" to managedOwner,
      "canSetAlwaysOnVpn" to (managedOwner && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N),
      "alwaysOnVpnPackage" to alwaysOnPackage,
      "alwaysOnVpnLockdownEnabled" to lockdownEnabled,
      "alwaysOnVpnLockdownRequested" to repository.isAlwaysOnVpnLockdownEnabled(),
      "canSuspendPackages" to (managedOwner && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N),
      "packageSuspensionEnabled" to repository.isPackageSuspensionEnabled(),
      "emergencyLockEnabled" to repository.isEmergencyLockEnabled(),
      "strictModeEnabled" to repository.isStrictModeEnabled(),
      "suspendedPackageCount" to repository.lastSuspendedPackages().size
    )
  }

  fun setAlwaysOnVpnLockdown(enabled: Boolean, pin: String? = null): Map<String, Any?> {
    repository.setAlwaysOnVpnLockdownEnabled(enabled, pin)

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
      return result(false, "always_on_vpn_requires_android_7_or_newer")
    }

    if (!isManagedOwner()) {
      return result(false, "device_owner_or_profile_owner_required")
    }

    return try {
      if (enabled) {
        manager.setAlwaysOnVpnPackage(component, context.packageName, true)
      } else {
        manager.setAlwaysOnVpnPackage(component, null, false)
      }
      result(true)
    } catch (_: Exception) {
      result(false, "android_rejected_always_on_vpn")
    }
  }

  fun enforceAlwaysOnVpnLockdown(): Map<String, Any?> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
      return result(false, "always_on_vpn_requires_android_7_or_newer")
    }
    if (!isManagedOwner()) {
      return result(false, "device_owner_or_profile_owner_required")
    }
    return try {
      manager.setAlwaysOnVpnPackage(component, context.packageName, true)
      result(true)
    } catch (_: Exception) {
      result(false, "android_rejected_always_on_vpn")
    }
  }


  fun setPackageSuspensionEnabled(enabled: Boolean, pin: String? = null): Map<String, Any?> {
    repository.setPackageSuspensionEnabled(enabled, pin)
    return applyPackageSuspension()
  }

  fun applyPackageSuspension(): Map<String, Any?> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
      repository.setLastSuspendedPackages(emptySet())
      return result(false, "package_suspension_requires_android_7_or_newer")
    }

    if (!isManagedOwner()) {
      repository.setLastSuspendedPackages(emptySet())
      return result(false, "device_owner_or_profile_owner_required")
    }

    val previous = repository.lastSuspendedPackages()
    val target = targetSuspendedPackages()
    val toUnsuspend = previous - target
    val toSuspend = target

    val failed = mutableSetOf<String>()
    if (toUnsuspend.isNotEmpty()) {
      failed += manager.setPackagesSuspended(component, toUnsuspend.toTypedArray(), false).toSet()
    }
    if (toSuspend.isNotEmpty()) {
      failed += manager.setPackagesSuspended(component, toSuspend.toTypedArray(), true).toSet()
    }

    val applied = target - failed
    repository.setLastSuspendedPackages(applied)
    if (applied.isNotEmpty() && repository.isFocusActive()) {
      GuardianNotifier.notify(
        context = context,
        eventType = "FOCUS_MODE_PACKAGE_BLOCK",
        severity = "high",
        subject = "${applied.size}_packages",
        action = "suspended",
        metadata = mapOf("failedPackages" to failed.joinToString(","))
      )
    }

    return mapOf(
      "applied" to true,
      "failedPackages" to failed.toList().sorted(),
      "managedEnforcementStatus" to status(),
      "focusState" to repository.focusStateSnapshot(context)
    )
  }

  private fun targetSuspendedPackages(): Set<String> {
    val launchableApps = AppInventory.launchableApps(context)
    val apps = launchableApps.map { it.packageName.lowercase() }.toSet()
    val essential = AppInventory.essentialPackageNames(context)
    val blocked = repository.blockedAppPackages()
    val managedSuspensionActive = repository.isPackageSuspensionEnabled() || repository.isEmergencyLockEnabled()
    val focusBlocked = if (managedSuspensionActive && repository.isAppAllowlistActive()) {
      apps - repository.allowedPackagesDuringFocus(context)
    } else {
      emptySet()
    }
    val ruleBlocked = launchableApps
      .filter { repository.shouldBlockPackageAsApp(it.packageName, it.label) }
      .map { it.packageName.lowercase() }
      .toSet()
    val nightModeBlocked = if (repository.isNightModeActive()) {
      launchableApps
        .filter { app ->
          val rule = app.riskRule
          rule?.category in setOf("social_media", "private_browser", "browser", "short_video", "random_chat", "dating")
        }
        .map { it.packageName.lowercase() }
        .toSet()
    } else {
      emptySet()
    }

    return (blocked + focusBlocked + ruleBlocked + nightModeBlocked)
      .map { it.lowercase() }
      .filter { it.isNotBlank() && it !in essential }
      .toSet()
  }

  private fun isManagedOwner(): Boolean {
    return manager.isDeviceOwnerApp(context.packageName) || manager.isProfileOwnerApp(context.packageName)
  }

  private fun result(applied: Boolean, reason: String? = null): Map<String, Any?> = mapOf(
    "applied" to applied,
    "reason" to reason,
    "managedEnforcementStatus" to status(),
    "focusState" to repository.focusStateSnapshot(context)
  )
}
