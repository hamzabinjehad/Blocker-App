package com.example.blocker

import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import java.io.File
import java.security.MessageDigest

data class TamperSignal(
  val id: String,
  val severity: String,
  val detected: Boolean,
  val subject: String,
  val recommendation: String
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "severity" to severity,
    "detected" to detected,
    "subject" to subject,
    "recommendation" to recommendation
  )
}

class TamperDetector(
  private val context: Context,
  private val repository: PolicyRepository
) {
  fun report(vpnActive: Boolean): List<TamperSignal> {
    val strict = repository.isStrictModeEnabled()
    return listOf(
      TamperSignal(
        id = "vpn_down",
        severity = "critical",
        detected = repository.isProtectionRequested() && !vpnActive,
        subject = "Local VPN",
        recommendation = "Restart protection and require always-on VPN lockdown in Device Owner mode."
      ),
      TamperSignal(
        id = "overlay_permission_missing",
        severity = "critical",
        detected = strict && !BlockOverlayService.canDrawOverlays(context),
        subject = "Overlay permission",
        recommendation = "Grant display-over-other-apps permission for block screens."
      ),
      TamperSignal(
        id = "usage_access_revoked",
        severity = "high",
        detected = strict && !hasUsageAccess(),
        subject = "Usage Access",
        recommendation = "Grant Usage Access so foreground app checks can be audited."
      ),
      TamperSignal(
        id = "device_admin_inactive",
        severity = "critical",
        detected = strict && !isDeviceAdminActive(),
        subject = "Device Admin",
        recommendation = "Keep Device Admin enabled or enroll as Device Owner for strict enforcement."
      ),
      TamperSignal(
        id = "battery_optimization_active",
        severity = "high",
        detected = strict && !isIgnoringBatteryOptimizations(),
        subject = "Battery optimization",
        recommendation = "Exclude the app from battery optimization and OEM autostart killers."
      ),
      TamperSignal(
        id = "private_dns_enabled",
        severity = "high",
        detected = strict && privateDnsMode().let { it == "hostname" || it == "opportunistic" },
        subject = "Private DNS",
        recommendation = "Disable Private DNS or control it through Device Owner policy."
      ),
      TamperSignal(
        id = "developer_options_enabled",
        severity = "high",
        detected = globalInt(Settings.Global.DEVELOPMENT_SETTINGS_ENABLED) == 1,
        subject = "Developer options",
        recommendation = "Disable developer options through Device Owner policy."
      ),
      TamperSignal(
        id = "usb_debugging_enabled",
        severity = "critical",
        detected = globalInt(Settings.Global.ADB_ENABLED) == 1,
        subject = "USB debugging",
        recommendation = "Disable USB debugging and enforce debugging restriction in Device Owner mode."
      ),
      TamperSignal(
        id = "root_indicators",
        severity = "critical",
        detected = rootIndicatorsDetected(),
        subject = "Root/Magisk indicators",
        recommendation = "Treat rooted or modified devices as untrusted and alert the Guardian."
      ),
      TamperSignal(
        id = "app_signature_mismatch",
        severity = "critical",
        detected = appSignatureMismatch(),
        subject = "App signature",
        recommendation = "Reinstall the trusted build if the application signature changes unexpectedly."
      ),
      TamperSignal(
        id = "verified_boot_or_custom_build",
        severity = "medium",
        detected = emulatorOrCustomBuildDetected(),
        subject = "Device integrity",
        recommendation = "Warn when running on emulators, test-keys, or custom builds."
      ),
      TamperSignal(
        id = "safe_mode_active",
        severity = "critical",
        detected = context.packageManager.isSafeMode,
        subject = "Safe Mode",
        recommendation = "Safe Mode can disable third-party protection services; enforce safe-boot restrictions in Device Owner mode."
      ),
      TamperSignal(
        id = "notification_listener_disconnected",
        severity = "high",
        detected = repository.isNotificationFilteringEnabled() && !repository.isNotificationListenerConnected(),
        subject = "Notification listener",
        recommendation = "Reconnect the notification listener service to resume notification filtering."
      ),
      TamperSignal(
        id = "installed_bypass_app",
        severity = "critical",
        detected = installedBypassAppDetected(),
        subject = "Bypass app",
        recommendation = "Remove VPN, proxy, Tor, APK store, app cloner, or vault apps."
      ),
      TamperSignal(
        id = "hooking_indicators",
        severity = "critical",
        detected = hookingIndicatorsDetected(),
        subject = "Hooking framework",
        recommendation = "Block protection changes and alert on Frida/Xposed/LSPosed indicators."
      )
    )
  }

  fun evaluateAndRecord(vpnActive: Boolean): List<TamperSignal> {
    val signals = report(vpnActive)
    signals.filter { it.detected }.forEach { signal ->
      repository.recordAuditEvent(
        eventType = "TAMPER_SIGNAL",
        severity = signal.severity,
        category = "tamper",
        subject = signal.subject,
        action = signal.id
      )
    }
    if (signals.any { it.detected && it.severity in setOf("critical", "high") }) {
      repository.setTampered(true)
    }
    signals.filter { it.detected && it.severity == "critical" }.forEach { signal ->
      GuardianNotifier.notify(
        context,
        eventType = "TAMPER_SIGNAL",
        severity = signal.severity,
        subject = signal.subject,
        action = signal.id
      )
    }
    return signals
  }

  private fun isIgnoringBatteryOptimizations(): Boolean {
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || powerManager.isIgnoringBatteryOptimizations(context.packageName)
  }

  private fun privateDnsMode(): String =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      Settings.Global.getString(context.contentResolver, "private_dns_mode").orEmpty().lowercase()
    } else {
      ""
    }

  private fun globalInt(name: String): Int =
    runCatching { Settings.Global.getInt(context.contentResolver, name, 0) }.getOrDefault(0)

  private fun hasUsageAccess(): Boolean {
    return runCatching {
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
      } else {
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
      }
      mode == AppOpsManager.MODE_ALLOWED
    }.getOrDefault(false)
  }

  private fun isDeviceAdminActive(): Boolean {
    val manager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    val component = ComponentName(context, BlockerDeviceAdminReceiver::class.java)
    return manager.isAdminActive(component)
  }

  private fun appSignatureMismatch(): Boolean {
    val current = appSignatureHash() ?: return false
    val baseline = repository.signatureBaseline()
    if (baseline == null) {
      repository.setSignatureBaseline(current)
      return false
    }
    return baseline != current
  }

  private fun appSignatureHash(): String? {
    return try {
      val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val info = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
        info.signingInfo?.apkContentsSigners ?: return null
      } else {
        @Suppress("DEPRECATION")
        context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_SIGNATURES).signatures ?: return null
      }
      if (signatures.isEmpty()) return null
      val digest = MessageDigest.getInstance("SHA-256")
      signatures
        .map { signature -> digest.digest(signature.toByteArray()).joinToString("") { "%02x".format(it.toInt() and 0xff) } }
        .sorted()
        .joinToString(":")
    } catch (_: Exception) {
      null
    }
  }

  private fun rootIndicatorsDetected(): Boolean {
    if (Build.TAGS?.contains("test-keys") == true) return true
    return listOf(
      "/system/app/Superuser.apk",
      "/sbin/su",
      "/system/bin/su",
      "/system/xbin/su",
      "/data/local/xbin/su",
      "/data/local/bin/su",
      "/system/bin/.ext/.su",
      "/system/usr/we-need-root/su",
      "/data/adb/magisk"
    ).any { File(it).exists() }
  }

  private fun emulatorOrCustomBuildDetected(): Boolean {
    val fingerprint = Build.FINGERPRINT.lowercase()
    val model = Build.MODEL.lowercase()
    val manufacturer = Build.MANUFACTURER.lowercase()
    val brand = Build.BRAND.lowercase()
    val product = Build.PRODUCT.lowercase()
    return fingerprint.startsWith("generic") ||
      fingerprint.contains("test-keys") ||
      model.contains("emulator") ||
      model.contains("android sdk built for") ||
      manufacturer.contains("genymotion") ||
      brand.startsWith("generic") ||
      product.contains("sdk_gphone")
  }

  private fun hookingIndicatorsDetected(): Boolean {
    val maps = runCatching { File("/proc/self/maps").readText(Charsets.UTF_8).lowercase() }.getOrDefault("")
    return listOf("frida", "xposed", "lsposed", "substrate", "zygisk").any { maps.contains(it) }
  }

  private fun installedBypassAppDetected(): Boolean {
    return runCatching {
      AppInventory.launchableApps(context).any { app ->
        app.packageName != context.packageName && AppInventory.isBypassApp(app.packageName, app.label)
      }
    }.getOrDefault(false)
  }
}
