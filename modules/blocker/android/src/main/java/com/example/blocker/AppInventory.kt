package com.example.blocker

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.os.Build
import android.provider.Telephony
import android.telecom.TelecomManager

data class LaunchableApp(
  val packageName: String,
  val label: String,
  val systemApp: Boolean,
  val enabled: Boolean,
  val riskRule: AppRule? = null
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "packageName" to packageName,
    "label" to label,
    "systemApp" to systemApp,
    "enabled" to enabled,
    "riskRuleId" to riskRule?.id,
    "riskCategory" to riskRule?.category,
    "riskSeverity" to riskRule?.severity,
    "riskAction" to riskRule?.action?.name?.lowercase()
  )
}

object AppInventory {
  fun launchableApps(context: Context): List<LaunchableApp> {
    val packageManager = context.packageManager
    val intent = Intent(Intent.ACTION_MAIN).apply {
      addCategory(Intent.CATEGORY_LAUNCHER)
    }

    return packageManager.queryIntentActivities(intent, 0)
      .mapNotNull { resolveInfo ->
        val activityInfo = resolveInfo.activityInfo ?: return@mapNotNull null
        val packageName = activityInfo.packageName ?: return@mapNotNull null
        val appInfo = runCatching { packageManager.getApplicationInfo(packageName, 0) }.getOrNull()
        val label = resolveInfo.loadLabel(packageManager)?.toString()
          ?: appInfo?.loadLabel(packageManager)?.toString()
          ?: packageName
        LaunchableApp(
          packageName = packageName.lowercase(),
          label = label,
          systemApp = appInfo?.let { (it.flags and ApplicationInfo.FLAG_SYSTEM) != 0 } ?: false,
          enabled = appInfo?.enabled ?: true,
          riskRule = AppRuleEngine.matchPackage(context, packageName, label)
        )
      }
      .distinctBy { it.packageName }
      .sortedWith(compareBy<LaunchableApp> { it.label.lowercase() }.thenBy { it.packageName })
  }

  fun essentialPackageNames(context: Context): Set<String> {
    val packages = mutableSetOf(
      context.packageName,
      context.applicationContext.packageName,
      "android",
      "com.android.systemui",
      "com.google.android.permissioncontroller",
      "com.android.permissioncontroller",
      "com.google.android.packageinstaller",
      "com.android.packageinstaller",
      "com.google.android.apps.nexuslauncher",
      "com.android.launcher",
      "com.android.launcher3"
    )

    defaultHomePackage(context)?.let { packages.add(it) }
    defaultDialerPackage(context)?.let { packages.add(it) }
    defaultSmsPackage(context)?.let { packages.add(it) }

    return packages.map { it.lowercase() }.toSet()
  }

  fun isBypassApp(packageName: String, label: String = packageName): Boolean {
    val rule = AppRuleEngine.matchPackage(packageName, label)
    if (rule?.category in setOf("vpn_proxy_tor", "vpn", "proxy", "tor", "apk_store", "app_cloner_vault", "app_cloner", "hidden_vault")) return true
    val text = "$packageName $label".lowercase()
    return listOf("vpn", "proxy", "tor", "dns", "doh", "cloudflare", "warp", "wireguard", "openvpn").any { text.contains(it) }
  }

  fun isPrivateBrowser(packageName: String, label: String = packageName): Boolean {
    val text = "$packageName $label".lowercase()
    if (listOf(
      "duckduckgo",
      "brave",
      "firefox focus",
      "mozilla.focus",
      "mozilla focus",
      "tor browser",
      "torproject",
      "vivaldi",
      "kiwi browser",
      "incognito",
      "private browser"
    ).any { text.contains(it) }) return true

    val rule = AppRuleEngine.matchPackage(packageName, label)
    return rule?.category == "private_browser" || rule?.id in setOf("browser.private", "bypass.vpn_proxy_tor", "bypass.tor")
  }

  private fun defaultHomePackage(context: Context): String? {
    val intent = Intent(Intent.ACTION_MAIN).apply {
      addCategory(Intent.CATEGORY_HOME)
    }
    return context.packageManager.resolveActivity(intent, 0)?.activityInfo?.packageName
  }

  private fun defaultDialerPackage(context: Context): String? {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      context.getSystemService(TelecomManager::class.java)?.defaultDialerPackage
    } else {
      null
    }
  }

  private fun defaultSmsPackage(context: Context): String? {
    return runCatching { Telephony.Sms.getDefaultSmsPackage(context) }.getOrNull()
  }
}
