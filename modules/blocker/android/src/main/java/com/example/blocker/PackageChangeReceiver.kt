package com.example.blocker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.example.blocker.behavior.BehaviorBlockEvent
import com.example.blocker.behavior.TriggerManager

class PackageChangeReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val packageName = intent.data?.schemeSpecificPart?.trim()?.lowercase().orEmpty()
    if (packageName.isBlank() || packageName == context.packageName.lowercase()) return

    val repository = PolicyRepository(context)
    val label = resolveLabel(context, packageName)
    val rule = AppRuleEngine.matchPackage(context, packageName, label)
    val action = intent.action.orEmpty()
    val installerPackage = installerPackageName(context, packageName)
    val sideloaded = action != Intent.ACTION_PACKAGE_REMOVED && isSideloadedInstall(context, installerPackage)

    repository.recordAuditEvent(
      eventType = "PACKAGE_CHANGED",
      severity = if (sideloaded) "critical" else if (rule == null) "low" else rule.severity,
      category = if (sideloaded) "sideloaded_apk" else rule?.category ?: "package",
      subject = packageName,
      action = action.substringAfterLast('.').lowercase(),
      metadata = mapOf(
        "label" to label,
        "rule" to (rule?.id ?: "none"),
        "installerPackage" to (installerPackage ?: "unknown"),
        "sideloaded" to sideloaded.toString()
      )
    )

    if (rule != null && action != Intent.ACTION_PACKAGE_REMOVED) {
      repository.recordAuditEvent(
        eventType = "APP_CATEGORY_CLASSIFIED",
        severity = rule.severity,
        category = rule.category,
        subject = packageName,
        action = "auto_classified",
        metadata = mapOf("label" to label, "rule" to rule.id)
      )
    }

    if (action != Intent.ACTION_PACKAGE_REMOVED) {
      val bypassLike = AppInventory.isBypassApp(packageName, label)
      val privateBrowserLike = AppInventory.isPrivateBrowser(packageName, label)
      if (bypassLike || privateBrowserLike || sideloaded) {
        val anomalyCategory = when {
          sideloaded -> "sideloaded_apk"
          bypassLike -> "vpn_proxy_tor"
          else -> "private_browser"
        }
        val severity = if (sideloaded || bypassLike || privateBrowserLike) "critical" else "high"
        repository.recordAuditEvent(
          eventType = "ANOMALY_SIGNAL",
          severity = severity,
          category = anomalyCategory,
          subject = packageName,
          action = "new_install_or_update",
          metadata = mapOf(
            "label" to label,
            "installerPackage" to (installerPackage ?: "unknown"),
            "sideloaded" to sideloaded.toString()
          )
        )
        GuardianNotifier.notify(
          context = context,
          eventType = "RISKY_APP_INSTALLED",
          severity = severity,
          subject = packageName,
          action = "new_install_or_update",
          metadata = mapOf("label" to label, "category" to anomalyCategory)
        )
        val event = BehaviorBlockEvent(
          keyword = label,
          keywordSource = anomalyCategory,
          appName = label,
          packageName = packageName,
          screen = "Package install/change",
          source = "package_receiver",
          reason = "risky_app_installed",
          action = "blocked"
        )
        TriggerManager.emit(context, repository, event)
        BlockOverlayService.show(
          context,
          label,
          "A bypass-capable app was installed. Protection is still active."
        )
      }
    }

    if (action == Intent.ACTION_PACKAGE_REMOVED) return

    val shouldBlockSideload = sideloaded && repository.isBlockSideloadedAppsEnabled()
    val shouldBlock = repository.shouldBlockPackageAsApp(packageName, label) || shouldBlockSideload
    if (!shouldBlock) return

    ManagedEnforcer(context, repository).applyPackageSuspension()
    val event = BehaviorBlockEvent(
      keyword = label,
      keywordSource = if (shouldBlockSideload) "sideloaded_apk" else "package_rule",
      appName = label,
      packageName = packageName,
      screen = "Package install/change",
      source = "package_receiver",
      reason = if (shouldBlockSideload) "sideloaded_apk" else "package_install_blocked",
      action = "blocked"
    )
    TriggerManager.emit(context, repository, event)
    GuardianNotifier.notify(
      context = context,
      eventType = if (shouldBlockSideload) "SIDELOADED_APK_BLOCKED" else "PACKAGE_INSTALL_BLOCKED",
      severity = if (shouldBlockSideload) "critical" else rule?.severity ?: "high",
      subject = packageName,
      action = "blocked",
      metadata = mapOf(
        "label" to label,
        "rule" to (rule?.id ?: "manual_policy"),
        "installerPackage" to (installerPackage ?: "unknown")
      )
    )
    BlockOverlayService.show(
      context,
      label,
      if (shouldBlockSideload) {
        "Sideloaded APK blocked. Install source: ${installerPackage ?: "unknown"}"
      } else {
        "Blocked app installed or changed: ${rule?.category ?: "policy"}"
      }
    )
  }

  private fun resolveLabel(context: Context, packageName: String): String {
    return try {
      val appInfo = context.packageManager.getApplicationInfo(packageName, 0)
      context.packageManager.getApplicationLabel(appInfo).toString()
    } catch (_: Exception) {
      packageName
    }
  }

  private fun installerPackageName(context: Context, packageName: String): String? {
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        context.packageManager.getInstallSourceInfo(packageName).installingPackageName
      } else {
        @Suppress("DEPRECATION")
        context.packageManager.getInstallerPackageName(packageName)
      }
    } catch (_: Exception) {
      null
    }?.trim()?.lowercase()
  }

  private fun isSideloadedInstall(context: Context, installerPackageName: String?): Boolean {
    val installer = installerPackageName?.lowercase()
    val trustedInstallers = setOf(
      "com.android.vending",
      "com.google.android.apps.work.clouddpc",
      context.packageName.lowercase()
    )
    return installer.isNullOrBlank() || installer !in trustedInstallers
  }
}
