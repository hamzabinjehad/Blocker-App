package com.example.blocker

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PersistableBundle

class WorkProfileManager(
  private val context: Context,
  private val repository: PolicyRepository
) {
  private val manager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
  private val component = ComponentName(context, BlockerDeviceAdminReceiver::class.java)

  fun status(): Map<String, Any?> {
    val isDeviceOwner = manager.isDeviceOwnerApp(context.packageName)
    val isProfileOwner = manager.isProfileOwnerApp(context.packageName)
    val managedOwner = isDeviceOwner || isProfileOwner

    return mapOf(
      "workProfileSupported" to (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP),
      "deviceOwner" to isDeviceOwner,
      "profileOwner" to isProfileOwner,
      "managedOwner" to managedOwner,
      "provisioningAvailable" to isProvisioningAvailable(),
      "enrollmentMethod" to recommendedEnrollmentMethod(),
      "managedProfileActive" to isProfileOwner,
      "restrictions" to if (managedOwner) appliedRestrictions() else emptyList<String>()
    )
  }

  fun provisionWorkProfile(activity: Activity): Map<String, Any?> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
      return mapOf(
        "started" to false,
        "reason" to "work_profile_requires_android_5_or_newer"
      )
    }

    if (manager.isProfileOwnerApp(context.packageName) || manager.isDeviceOwnerApp(context.packageName)) {
      return mapOf(
        "started" to false,
        "reason" to "already_enrolled_as_managed_owner"
      )
    }

    val intent = Intent(DevicePolicyManager.ACTION_PROVISION_MANAGED_PROFILE).apply {
      putExtra(
        DevicePolicyManager.EXTRA_PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME,
        component
      )
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        putExtra(
          DevicePolicyManager.EXTRA_PROVISIONING_SKIP_ENCRYPTION,
          true
        )
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        val adminExtras = PersistableBundle()
        adminExtras.putString("source", "parent_blocker_app")
        putExtra(
          DevicePolicyManager.EXTRA_PROVISIONING_ADMIN_EXTRAS_BUNDLE,
          adminExtras
        )
      }
    }

    return try {
      if (intent.resolveActivity(context.packageManager) == null) {
        return mapOf(
          "started" to false,
          "reason" to "provisioning_not_available_on_this_device"
        )
      }
      activity.startActivityForResult(intent, PROVISION_WORK_PROFILE_REQUEST_CODE)
      repository.recordAuditEvent(
        eventType = "WORK_PROFILE_PROVISION_STARTED",
        severity = "high",
        category = "managed_device",
        subject = context.packageName,
        action = "provision_started"
      )
      mapOf("started" to true, "reason" to null)
    } catch (e: Exception) {
      repository.recordAuditEvent(
        eventType = "WORK_PROFILE_PROVISION_FAILED",
        severity = "critical",
        category = "managed_device",
        subject = context.packageName,
        action = e.javaClass.simpleName
      )
      mapOf("started" to false, "reason" to "provision_failed:${e.javaClass.simpleName}")
    }
  }

  fun onProvisioningComplete(): Map<String, Any?> {
    val isProfileOwner = manager.isProfileOwnerApp(context.packageName)
    if (!isProfileOwner) {
      return mapOf(
        "success" to false,
        "reason" to "not_profile_owner_after_provisioning"
      )
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      manager.setProfileEnabled(component)
    }

    repository.recordAuditEvent(
      eventType = "WORK_PROFILE_PROVISIONED",
      severity = "high",
      category = "managed_device",
      subject = context.packageName,
      action = "profile_enabled"
    )
    GuardianNotifier.notify(
      context = context,
      eventType = "WORK_PROFILE_PROVISIONED",
      severity = "high",
      subject = context.packageName,
      action = "managed_profile_active"
    )

    return mapOf(
      "success" to true,
      "profileOwner" to true,
      "workProfileStatus" to status()
    )
  }

  fun removeWorkProfile(pin: String?): Map<String, Any?> {
    repository.assertCanChangePolicy(pin)

    if (!manager.isProfileOwnerApp(context.packageName)) {
      return mapOf("removed" to false, "reason" to "not_profile_owner")
    }

    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        manager.wipeData(0)
      }
      repository.recordAuditEvent(
        eventType = "WORK_PROFILE_REMOVED",
        severity = "critical",
        category = "managed_device",
        subject = context.packageName,
        action = "profile_removed"
      )
      mapOf("removed" to true, "reason" to null)
    } catch (e: Exception) {
      mapOf("removed" to false, "reason" to e.javaClass.simpleName)
    }
  }

  fun applyCorporatePolicy(pin: String?): Map<String, Any?> {
    repository.assertCanChangePolicy(pin)
    if (!manager.isProfileOwnerApp(context.packageName) && !manager.isDeviceOwnerApp(context.packageName)) {
      return mapOf("applied" to false, "reason" to "device_owner_or_profile_owner_required")
    }

    val failed = mutableListOf<String>()

    apply("set_uninstall_blocked", failed) {
      manager.setUninstallBlocked(component, context.packageName, true)
    }
    apply("set_always_on_vpn", failed) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        manager.setAlwaysOnVpnPackage(component, context.packageName, true)
        repository.setAlwaysOnVpnLockdownEnabled(true, pin)
      }
    }
    apply("set_camera_disabled", failed) {
      manager.setCameraDisabled(component, false)
    }

    repository.recordAuditEvent(
      eventType = "CORPORATE_POLICY_APPLIED",
      severity = if (failed.isEmpty()) "high" else "critical",
      category = "managed_device",
      subject = context.packageName,
      action = if (failed.isEmpty()) "applied" else "partial",
      metadata = mapOf("failed" to failed.joinToString(","))
    )

    return mapOf(
      "applied" to failed.isEmpty(),
      "failedPolicies" to failed,
      "workProfileStatus" to status()
    )
  }

  private fun isProvisioningAvailable(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return false
    if (manager.isProfileOwnerApp(context.packageName)) return false
    if (manager.isDeviceOwnerApp(context.packageName)) return false

    val intent = Intent(DevicePolicyManager.ACTION_PROVISION_MANAGED_PROFILE)
    return intent.resolveActivity(context.packageManager) != null
  }

  private fun recommendedEnrollmentMethod(): String = when {
    manager.isDeviceOwnerApp(context.packageName) -> "device_owner_active"
    manager.isProfileOwnerApp(context.packageName) -> "profile_owner_active"
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP -> "work_profile_provisioning"
    else -> "device_admin_only"
  }

  private fun appliedRestrictions(): List<String> {
    return try {
      val bundle = manager.getUserRestrictions(component)
      bundle.keySet().filter { bundle.getBoolean(it, false) }
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun apply(name: String, failed: MutableList<String>, block: () -> Unit) {
    try {
      block()
    } catch (cause: Exception) {
      failed.add("$name:${cause.javaClass.simpleName}")
    }
  }

  companion object {
    const val PROVISION_WORK_PROFILE_REQUEST_CODE = 41321
  }
}
