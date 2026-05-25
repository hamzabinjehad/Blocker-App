package com.example.blocker

import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Uri
import android.net.VpnService
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import com.example.blocker.behavior.BehaviorBlockEvent
import com.example.blocker.behavior.BehaviorEngine
import com.example.blocker.behavior.TriggerManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BlockerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BlockerModule")
    Events("onBlockEvent")

    OnStartObserving("onBlockEvent") {
      TriggerManager.setEventSink { event ->
        sendEvent("onBlockEvent", event.toBundle())
      }
    }

    OnStopObserving("onBlockEvent") {
      TriggerManager.setEventSink(null)
    }

    AsyncFunction("prepareVpn") {
      prepareVpn()
    }

    AsyncFunction("startProtection") {
      startProtection()
    }

    AsyncFunction("stopProtection") { pin: String ->
      stopProtection(pin)
    }

    AsyncFunction("getStatus") {
      getStatus()
    }

    AsyncFunction("addBlockedDomain") { domain: String, pin: String? ->
      repository().addBlockedDomain(domain, pin)
    }

    AsyncFunction("removeBlockedDomain") { domain: String, pin: String? ->
      repository().removeBlockedDomain(domain, pin)
    }

    AsyncFunction("importBlockedDomains") { domains: List<String>, pin: String? ->
      repository().importBlockedDomains(domains, pin)
    }

    AsyncFunction("updatePolicy") { policy: Map<String, Any?> ->
      repository().updatePolicy(policy)
    }

    AsyncFunction("detectText") { input: String ->
      BehaviorEngine(reactContext(), repository()).detectText(input)
    }

    AsyncFunction("registerScreenContext") { app: String, screen: String ->
      BehaviorEngine(reactContext(), repository()).registerScreenContext(app, screen)
    }

    AsyncFunction("onKeywordTriggered") { event: Map<String, Any?> ->
      TriggerManager.emitFromBridge(reactContext(), repository(), event)
    }

    AsyncFunction("updateKeywordList") { keywords: List<String>, pin: String ->
      repository().updateKeywordList(keywords, pin)
    }

    AsyncFunction("verifyParentPin") { pin: String ->
      mapOf("verified" to repository().verifyPin(pin))
    }

    AsyncFunction("openAccessibilitySettings") {
      openAccessibilitySettings()
    }

    AsyncFunction("requestDeviceAdminPermission") {
      requestDeviceAdminPermission()
    }

    AsyncFunction("openOverlaySettings") {
      openOverlaySettings()
    }

    AsyncFunction("canDrawOverlays") {
      mapOf("granted" to BlockOverlayService.canDrawOverlays(reactContext()))
    }

    AsyncFunction("showBlockOverlayForTest") { reason: String ->
      BlockOverlayService.show(reactContext(), "Manual test", reason.ifBlank { "Manual overlay test" })
    }

    AsyncFunction("hideBlockOverlay") { pin: String? ->
      BlockOverlayService.hide(reactContext(), pin)
    }

    AsyncFunction("setUninstallProtectionEnabled") { enabled: Boolean, pin: String?, durationDays: Int? ->
      setUninstallProtectionEnabled(enabled, pin, durationDays)
    }

    AsyncFunction("setStrictModeEnabled") { enabled: Boolean, pin: String? ->
      setStrictModeEnabled(enabled, pin)
    }

    AsyncFunction("applyStrictDeviceOwnerPolicy") { pin: String? ->
      DeviceOwnerPolicyManager(reactContext(), repository()).applyStrictMode(pin)
    }

    AsyncFunction("getTamperReport") {
      getTamperReport()
    }

    AsyncFunction("getAuditEvents") {
      repository().getAuditEvents()
    }

    AsyncFunction("getGuardianAlerts") {
      repository().getGuardianAlerts()
    }

    AsyncFunction("clearGuardianAlert") { alertId: String ->
      repository().clearGuardianAlert(alertId)
    }

    AsyncFunction("getAppRuleSnapshot") {
      AppRuleEngine.ruleSnapshot(reactContext())
    }

    AsyncFunction("configureManagedPrivateDns") { hostname: String ->
      configureManagedPrivateDns(hostname)
    }

    AsyncFunction("copyTextToClipboard") { label: String, text: String ->
      copyTextToClipboard(label, text)
    }

    AsyncFunction("openPrivateDnsSettings") {
      openPrivateDnsSettings()
    }

    AsyncFunction("getLaunchableApps") {
      getLaunchableApps()
    }

    AsyncFunction("addAllowlistedDomain") { domain: String, pin: String? ->
      repository().addAllowlistedDomain(domain, pin)
    }

    AsyncFunction("removeAllowlistedDomain") { domain: String, pin: String? ->
      repository().removeAllowlistedDomain(domain, pin)
    }

    AsyncFunction("updateFocusPolicy") { policy: Map<String, Any?> ->
      updateFocusPolicy(policy)
    }

    AsyncFunction("updateUsageLimitPolicy") { policy: Map<String, Any?> ->
      updateUsageLimitPolicy(policy)
    }

    AsyncFunction("getUsageLimitPolicy") {
      repository().usageLimitPolicySnapshot(reactContext())
    }

    AsyncFunction("updateVpnPolicy") { policy: Map<String, Any?> ->
      updateVpnPolicy(policy)
    }

    AsyncFunction("setHttpsInspectionEnabled") { enabled: Boolean, privacyAcknowledged: Boolean, pin: String? ->
      setHttpsInspectionEnabled(enabled, privacyAcknowledged, pin)
    }

    AsyncFunction("getFocusState") {
      repository().focusStateSnapshot(reactContext())
    }

    AsyncFunction("setAlwaysOnVpnLockdown") { enabled: Boolean, pin: String? ->
      setAlwaysOnVpnLockdown(enabled, pin)
    }

    AsyncFunction("setPackageSuspensionEnabled") { enabled: Boolean, pin: String? ->
      setPackageSuspensionEnabled(enabled, pin)
    }

    AsyncFunction("setEmergencyLockEnabled") { enabled: Boolean, pin: String? ->
      DeviceOwnerPolicyManager(reactContext(), repository()).setEmergencyLock(enabled, pin)
    }

    AsyncFunction("openBatteryOptimizationSettings") {
      openBatteryOptimizationSettings()
    }

    AsyncFunction("requestIgnoreBatteryOptimizations") {
      requestIgnoreBatteryOptimizations()
    }

    AsyncFunction("getBatteryOptimizationStatus") {
      batteryOptimizationStatus()
    }

    AsyncFunction("getUsageAccessStatus") {
      usageAccessStatus()
    }

    AsyncFunction("openUsageAccessSettings") {
      openUsageAccessSettings()
    }

    AsyncFunction("setNotificationFilteringEnabled") { enabled: Boolean, pin: String? ->
      repository().setNotificationFilteringEnabled(enabled, pin)
      repository().notificationFilterStatus()
    }

    AsyncFunction("getNotificationFilterStatus") {
      repository().notificationFilterStatus()
    }

    AsyncFunction("openNotificationListenerSettings") {
      openNotificationListenerSettings()
    }

    AsyncFunction("getWorkProfileStatus") {
      WorkProfileManager(reactContext(), repository()).status()
    }

    AsyncFunction("provisionWorkProfile") {
      provisionWorkProfile()
    }

    AsyncFunction("onWorkProfileProvisioningComplete") {
      WorkProfileManager(reactContext(), repository()).onProvisioningComplete()
    }

    AsyncFunction("removeWorkProfile") { pin: String? ->
      WorkProfileManager(reactContext(), repository()).removeWorkProfile(pin)
    }

    AsyncFunction("applyCorporatePolicy") { pin: String? ->
      WorkProfileManager(reactContext(), repository()).applyCorporatePolicy(pin)
    }

    AsyncFunction("getDailyUsageSummary") {
      UsageStatsTracker(reactContext(), repository()).dailySummary()
    }

    AsyncFunction("getWeeklyUsageSummary") {
      UsageStatsTracker(reactContext(), repository()).weeklySummary()
    }

    AsyncFunction("getAppUsageDetail") { packageName: String ->
      UsageStatsTracker(reactContext(), repository()).appUsageDetail(packageName)
    }
  }

  private fun reactContext(): Context {
    return appContext.reactContext ?: throw IllegalStateException("React context is not available")
  }

  private fun repository() = PolicyRepository(reactContext())

  private fun prepareVpn(): Map<String, Any?> {
    val context = reactContext()
    val intent = VpnService.prepare(context)
    if (intent == null) {
      return mapOf("granted" to true, "needsPermission" to false)
    }

    val activity = appContext.currentActivity ?: throw IllegalStateException("An activity is required to request VPN permission")
    activity.startActivityForResult(intent, VPN_PERMISSION_REQUEST_CODE)
    return mapOf("granted" to false, "needsPermission" to true)
  }

  private fun startProtection(): Map<String, Any?> {
    val context = reactContext()
    if (VpnService.prepare(context) != null) {
      return mapOf("status" to "needs_vpn_permission")
    }

    val repo = repository()
    NotificationHelper.ensureChannel(context)
    repo.setProtectionRequested(true)
    repo.setTampered(false)

    val intent = Intent(context, FilterVpnService::class.java).apply {
      action = FilterVpnService.ACTION_START
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent)
    } else {
      context.startService(intent)
    }

    return mapOf("status" to "active")
  }

  private fun stopProtection(pin: String): Map<String, Any?> {
    val repo = repository()
    if (!repo.verifyPin(pin)) {
      return mapOf("status" to "pin_required")
    }

    val context = reactContext()
    repo.setProtectionRequested(false)
    repo.setTampered(false)
    repo.setVpnActive(false)

    val intent = Intent(context, FilterVpnService::class.java).apply {
      action = FilterVpnService.ACTION_STOP
    }
    context.startService(intent)

    return mapOf("status" to "inactive")
  }

  private fun getStatus(): Map<String, Any?> {
    val context = reactContext()
    IntegrityChecker.checkOncePerLaunch(context)
    val repo = repository()
    val vpnPermissionGranted = VpnService.prepare(context) == null
    val vpnActive = FilterVpnService.isRunning && repo.isVpnActive()
    val accessibilityServiceEnabled = isAccessibilityServiceEnabled(context)
    recordBehaviorTamperIfNeeded(repo, accessibilityServiceEnabled)
    TamperMonitor(repo, context).isTampered(vpnActive)
    val tamperReport = TamperDetector(context, repo).evaluateAndRecord(vpnActive).map { it.toMap() }
    val tampered = repo.isTampered()
    val status = when {
      tampered -> "tampered"
      vpnActive -> "active"
      !vpnPermissionGranted -> "needs_vpn_permission"
      else -> "inactive"
    }

    return mapOf(
      "status" to status,
      "vpnActive" to vpnActive,
      "tampered" to tampered,
      "vpnPermissionGranted" to vpnPermissionGranted,
      "pinConfigured" to repo.isPinConfigured(),
      "blockedDomainCount" to repo.blockedDomainCount(),
      "blockedDomains" to repo.blockedDomains().toList().sorted(),
      "allowlistedDomains" to repo.allowlistedDomains().toList().sorted(),
      "lastBlocklistUpdate" to repo.lastBlocklistUpdate(),
      "bypassDomainCount" to repo.bypassDomainCount(),
      "safeSearchSettings" to repo.safeSearchPolicySnapshot(),
      "riskySettings" to repo.riskyPolicySnapshot(),
      "accessibilityServiceEnabled" to accessibilityServiceEnabled,
      "overlayPermissionGranted" to BlockOverlayService.canDrawOverlays(context),
      "usageAccessStatus" to usageAccessStatus(),
      "batteryOptimizationStatus" to batteryOptimizationStatus(),
      "strictModeEnabled" to repo.isStrictModeEnabled(),
      "tamperReport" to tamperReport,
      "behaviorPolicy" to repo.behaviorPolicySnapshot(),
      "focusPolicy" to repo.focusPolicySnapshot(),
      "focusState" to repo.focusStateSnapshot(context),
      "usageLimitPolicy" to repo.usageLimitPolicySnapshot(context),
      "vpnPolicyStatus" to VpnPolicyManager.status(context, repo),
      "httpsInspectionStatus" to repo.httpsInspectionStatus(),
      "mediaScanningStatus" to ImageContentScanner.status(
        supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R,
        enabled = repo.isScreenshotAuditEnabled(),
        accessibilityServiceEnabled = accessibilityServiceEnabled,
        cloudFallbackEnabled = repo.isCloudImageFallbackEnabled(),
        cloudFallbackConfigured = repo.cloudImageFallbackEndpoint().isNotBlank()
      ),
      "screenshotAuditPolicy" to repo.screenshotAuditPolicySnapshot(),
      "anomalyDetectionStatus" to AnomalyDetector(repo).status(),
      "privateDnsStatus" to privateDnsStatus(context),
      "managedDeviceStatus" to managedDeviceStatus(context),
      "managedEnforcementStatus" to ManagedEnforcer(context, repo).status(),
      "deviceOwnerPolicyStatus" to DeviceOwnerPolicyManager(context, repo).status(),
      "guardianAlertCount" to repo.getGuardianAlerts().count { it["cleared"] != true },
      "auditEventCount" to repo.getAuditEvents().size,
      "integrityStatus" to IntegrityChecker.status(repo),
      "safeModeBoot" to repo.wasSafeModeBoot(),
      "notificationFilterStatus" to repo.notificationFilterStatus(),
      "workProfileStatus" to WorkProfileManager(context, repo).status()
    )
  }

  private fun recordBehaviorTamperIfNeeded(repo: PolicyRepository, accessibilityServiceEnabled: Boolean) {
    val wasEnabled = repo.wasAccessibilityServiceEnabled()
    if (repo.isBehaviorProtectionEnabled() && wasEnabled && !accessibilityServiceEnabled) {
      repo.setTampered(true)
      repo.recordBehaviorTrigger(
        BehaviorBlockEvent(
          keyword = "Accessibility Service disabled",
          keywordSource = "tamper",
          appName = "Android Settings",
          packageName = reactContext().packageName,
          screen = "Behavior Protection",
          source = "status_check",
          reason = "accessibility_service_disabled",
          action = "warned"
        ).toMap()
      )
    }
    repo.setAccessibilityServiceEnabledSnapshot(accessibilityServiceEnabled)
  }

  private fun openAccessibilitySettings() {
    val context = reactContext()
    val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(intent)
  }

  private fun requestDeviceAdminPermission(): Map<String, Any?> {
    val context = reactContext()
    val component = deviceAdminComponent(context)
    val manager = devicePolicyManager(context)

    if (manager.isAdminActive(component)) {
      return mapOf("permissionRequested" to false, "managedDeviceStatus" to managedDeviceStatus(context))
    }

    val activity = appContext.currentActivity ?: throw IllegalStateException("An activity is required to request device admin permission")
    val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
      putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, component)
      putExtra(
        DevicePolicyManager.EXTRA_ADD_EXPLANATION,
        "Parent Blocker uses device administration transparently for parental-control setup. Full uninstall blocking requires managed-device owner enrollment."
      )
    }
    activity.startActivity(intent)

    return mapOf("permissionRequested" to true, "managedDeviceStatus" to managedDeviceStatus(context))
  }

  private fun openOverlaySettings() {
    reactContext().startActivity(BlockOverlayService.overlaySettingsIntent(reactContext()))
  }

  private fun setUninstallProtectionEnabled(enabled: Boolean, pin: String?, durationDays: Int?): Map<String, Any?> {
    val context = reactContext()
    val repo = repository()
    val result = UninstallLockManager(context, repo).setEnabled(enabled, durationDays, pin)
    return result + mapOf("managedDeviceStatus" to managedDeviceStatus(context))
  }

  private fun setStrictModeEnabled(enabled: Boolean, pin: String?): Map<String, Any?> {
    val context = reactContext()
    val repo = repository()
    repo.setStrictModeEnabled(enabled, pin)
    val enforcement = ManagedEnforcer(context, repo).applyPackageSuspension()
    if (enabled && !BlockOverlayService.canDrawOverlays(context)) {
      repo.recordAuditEvent(
        eventType = "STRICT_MODE_OVERLAY_PERMISSION_REQUIRED",
        severity = "critical",
        category = "overlay",
        subject = "system_alert_window",
        action = "permission_missing"
      )
    }
    return mapOf(
      "applied" to true,
      "strictModeEnabled" to repo.isStrictModeEnabled(),
      "managedEnforcementStatus" to enforcement["managedEnforcementStatus"],
      "tamperReport" to TamperDetector(context, repo).evaluateAndRecord(FilterVpnService.isRunning && repo.isVpnActive()).map { it.toMap() }
    )
  }

  private fun getTamperReport(): List<Map<String, Any?>> {
    val context = reactContext()
    val repo = repository()
    val vpnActive = FilterVpnService.isRunning && repo.isVpnActive()
    return TamperDetector(context, repo).evaluateAndRecord(vpnActive).map { it.toMap() }
  }

  private fun configureManagedPrivateDns(hostname: String): Map<String, Any?> {
    val context = reactContext()
    val manager = devicePolicyManager(context)
    val component = deviceAdminComponent(context)
    val trimmedHostname = hostname.trim()

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      return mapOf(
        "applied" to false,
        "reason" to "private_dns_requires_android_9_or_newer",
        "managedDeviceStatus" to managedDeviceStatus(context)
      )
    }

    if (!isManagedOwner(manager, context)) {
      return mapOf(
        "applied" to false,
        "reason" to "device_owner_or_profile_owner_required",
        "managedDeviceStatus" to managedDeviceStatus(context)
      )
    }

    if (trimmedHostname.isBlank()) {
      manager.setGlobalPrivateDnsModeOpportunistic(component)
    } else {
      manager.setGlobalPrivateDnsModeSpecifiedHost(component, trimmedHostname)
    }

    return mapOf("applied" to true, "managedDeviceStatus" to managedDeviceStatus(context))
  }

  private fun copyTextToClipboard(label: String, text: String): Map<String, Any?> {
    val clipboard = reactContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText(label.ifBlank { "Private DNS hostname" }, text))
    return mapOf("copied" to true)
  }

  private fun openPrivateDnsSettings(): Map<String, Any?> {
    val context = reactContext()
    val privateDnsIntent = Intent(ACTION_PRIVATE_DNS_SETTINGS).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    val networkIntent = Intent(Settings.ACTION_WIRELESS_SETTINGS).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    return when {
      startSettingsActivity(context, privateDnsIntent) -> mapOf("opened" to true, "target" to "private_dns")
      startSettingsActivity(context, networkIntent) -> mapOf("opened" to true, "target" to "network")
      else -> mapOf("opened" to false, "target" to null)
    }
  }

  private fun privateDnsStatus(context: Context): Map<String, Any?> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      return mapOf(
        "supported" to false,
        "mode" to null,
        "configuredHost" to null,
        "activeHost" to null,
        "recommendedHost" to DEFAULT_PRIVATE_DNS_HOSTNAME
      )
    }

    val mode = runCatching {
      Settings.Global.getString(context.contentResolver, PRIVATE_DNS_MODE_SETTING)
    }.getOrNull()
    val configuredHost = runCatching {
      Settings.Global.getString(context.contentResolver, PRIVATE_DNS_SPECIFIER_SETTING)
    }.getOrNull()
    val activeHost = runCatching {
      val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      val activeNetwork = connectivityManager.activeNetwork ?: return@runCatching null
      connectivityManager.getLinkProperties(activeNetwork)?.privateDnsServerName
    }.getOrNull()

    return mapOf(
      "supported" to true,
      "mode" to mode,
      "configuredHost" to configuredHost,
      "activeHost" to activeHost,
      "recommendedHost" to DEFAULT_PRIVATE_DNS_HOSTNAME
    )
  }

  private fun startSettingsActivity(context: Context, intent: Intent): Boolean {
    return try {
      if (intent.resolveActivity(context.packageManager) == null) {
        false
      } else {
        context.startActivity(intent)
        true
      }
    } catch (_: ActivityNotFoundException) {
      false
    } catch (_: SecurityException) {
      false
    }
  }

  private fun getLaunchableApps(): List<Map<String, Any?>> {
    return AppInventory.launchableApps(reactContext()).map { it.toMap() }
  }

  private fun updateFocusPolicy(policy: Map<String, Any?>): Map<String, Any?> {
    val context = reactContext()
    val repo = repository()
    repo.updateFocusPolicy(policy)
    val enforcement = ManagedEnforcer(context, repo).applyPackageSuspension()
    return mapOf(
      "focusPolicy" to repo.focusPolicySnapshot(),
      "focusState" to repo.focusStateSnapshot(context),
      "managedEnforcementStatus" to enforcement["managedEnforcementStatus"],
      "failedPackages" to (enforcement["failedPackages"] ?: emptyList<String>())
    )
  }

  private fun updateUsageLimitPolicy(policy: Map<String, Any?>): Map<String, Any?> {
    val repo = repository()
    return repo.updateUsageLimitPolicy(policy)
  }

  private fun updateVpnPolicy(policy: Map<String, Any?>): Map<String, Any?> {
    val context = reactContext()
    val repo = repository()
    val status = repo.updateVpnPolicy(policy)
    restartVpnIfActive(context, repo)
    return mapOf(
      "vpnPolicyStatus" to status,
      "httpsInspectionStatus" to repo.httpsInspectionStatus()
    )
  }

  private fun setHttpsInspectionEnabled(
    enabled: Boolean,
    privacyAcknowledged: Boolean,
    pin: String?
  ): Map<String, Any?> {
    val context = reactContext()
    val repo = repository()
    val result = repo.setHttpsInspectionEnabled(enabled, privacyAcknowledged, pin)
    if (result["applied"] == true) {
      restartVpnIfActive(context, repo)
    }
    return result
  }

  private fun restartVpnIfActive(context: Context, repo: PolicyRepository) {
    if (!FilterVpnService.isRunning || !repo.isProtectionRequested()) return
    val intent = Intent(context, FilterVpnService::class.java).apply {
      action = FilterVpnService.ACTION_RESTART
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent)
    } else {
      context.startService(intent)
    }
  }

  private fun setAlwaysOnVpnLockdown(enabled: Boolean, pin: String?): Map<String, Any?> {
    val context = reactContext()
    return ManagedEnforcer(context, repository()).setAlwaysOnVpnLockdown(enabled, pin)
  }

  private fun setPackageSuspensionEnabled(enabled: Boolean, pin: String?): Map<String, Any?> {
    val context = reactContext()
    return ManagedEnforcer(context, repository()).setPackageSuspensionEnabled(enabled, pin)
  }

  private fun openBatteryOptimizationSettings() {
    val context = reactContext()
    val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    context.startActivity(intent)
  }

  private fun requestIgnoreBatteryOptimizations(): Map<String, Any?> {
    val context = reactContext()
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || isIgnoringBatteryOptimizations(context)) {
      return batteryOptimizationStatus()
    }

    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
      data = Uri.parse("package:${context.packageName}")
    }
    val activity = appContext.currentActivity
    if (activity != null) {
      activity.startActivity(intent)
    } else {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    return batteryOptimizationStatus()
  }

  private fun batteryOptimizationStatus(): Map<String, Any?> {
    val context = reactContext()
    val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
    return mapOf(
      "supported" to supported,
      "ignored" to isIgnoringBatteryOptimizations(context)
    )
  }

  private fun isIgnoringBatteryOptimizations(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    return powerManager.isIgnoringBatteryOptimizations(context.packageName)
  }

  private fun usageAccessStatus(): Map<String, Any?> {
    val context = reactContext()
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    return mapOf(
      "granted" to (mode == AppOpsManager.MODE_ALLOWED),
      "mode" to mode
    )
  }

  private fun openUsageAccessSettings() {
    val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    reactContext().startActivity(intent)
  }

  private fun openNotificationListenerSettings() {
    val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    reactContext().startActivity(intent)
  }

  private fun provisionWorkProfile(): Map<String, Any?> {
    val activity = appContext.currentActivity
      ?: throw IllegalStateException("An activity is required to provision a work profile")
    return WorkProfileManager(reactContext(), repository()).provisionWorkProfile(activity)
  }

  private fun managedDeviceStatus(context: Context): Map<String, Any?> {
    val repo = PolicyRepository(context)
    UninstallLockManager(context, repo).reconcile()

    val manager = devicePolicyManager(context)
    val component = deviceAdminComponent(context)
    val adminActive = manager.isAdminActive(component)
    val deviceOwner = manager.isDeviceOwnerApp(context.packageName)
    val profileOwner = manager.isProfileOwnerApp(context.packageName)
    val managedOwner = deviceOwner || profileOwner

    val uninstallBlocked = if (managedOwner) {
      runCatching { manager.isUninstallBlocked(component, context.packageName) }.getOrDefault(false)
    } else {
      false
    }

    val privateDnsMode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && managedOwner) {
      runCatching { manager.getGlobalPrivateDnsMode(component) }.getOrNull()
    } else {
      null
    }
    val privateDnsHost = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && managedOwner) {
      runCatching { manager.getGlobalPrivateDnsHost(component) }.getOrNull()
    } else {
      null
    }

    val basicUninstallProtectionActive = adminActive
    val uninstallProtectionLevel = when {
      uninstallBlocked -> "managed_owner"
      basicUninstallProtectionActive -> "device_admin"
      else -> "none"
    }

    return mapOf(
      "deviceAdminActive" to adminActive,
      "deviceOwner" to deviceOwner,
      "profileOwner" to profileOwner,
      "canBlockUninstall" to managedOwner,
      "basicUninstallProtectionActive" to basicUninstallProtectionActive,
      "uninstallBlocked" to uninstallBlocked,
      "uninstallProtectionLevel" to uninstallProtectionLevel,
      "uninstallLockActive" to repo.isUninstallLockWindowActive(),
      "uninstallLockStartedAt" to repo.uninstallLockStartedAt().takeIf { it > 0L },
      "uninstallLockExpiresAt" to repo.uninstallLockExpiresAt().takeIf { it > 0L },
      "uninstallLockRemainingMs" to repo.uninstallLockRemainingMs(),
      "uninstallLockDurationDays" to repo.uninstallLockDurationDays(),
      "canConfigurePrivateDns" to (managedOwner && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P),
      "privateDnsMode" to privateDnsMode,
      "privateDnsHost" to privateDnsHost,
      "requiresManagedEnrollment" to !managedOwner
    )
  }

  private fun devicePolicyManager(context: Context): DevicePolicyManager {
    return context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
  }

  private fun deviceAdminComponent(context: Context): ComponentName {
    return ComponentName(context, BlockerDeviceAdminReceiver::class.java)
  }

  private fun isManagedOwner(manager: DevicePolicyManager, context: Context): Boolean {
    return manager.isDeviceOwnerApp(context.packageName) || manager.isProfileOwnerApp(context.packageName)
  }

  private fun isAccessibilityServiceEnabled(context: Context): Boolean {
    val enabledServices = Settings.Secure.getString(
      context.contentResolver,
      Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
    ) ?: return false
    val expectedSuffix = "/com.example.blocker.behavior.BehaviorAccessibilityService"
    return enabledServices.split(':').any { service ->
      service.endsWith(expectedSuffix, ignoreCase = true)
    }
  }

  private fun Map<String, Any?>.toBundle(): Bundle {
    val bundle = Bundle()
    forEach { (key, value) ->
      when (value) {
        is Boolean -> bundle.putBoolean(key, value)
        is Int -> bundle.putInt(key, value)
        is Long -> bundle.putDouble(key, value.toDouble())
        is Double -> bundle.putDouble(key, value)
        is Float -> bundle.putDouble(key, value.toDouble())
        is String -> bundle.putString(key, value)
        null -> bundle.putString(key, null)
        else -> bundle.putString(key, value.toString())
      }
    }
    return bundle
  }

  companion object {
    private const val VPN_PERMISSION_REQUEST_CODE = 41320
    private const val ACTION_PRIVATE_DNS_SETTINGS = "android.settings.PRIVATE_DNS_SETTINGS"
    private const val PRIVATE_DNS_MODE_SETTING = "private_dns_mode"
    private const val PRIVATE_DNS_SPECIFIER_SETTING = "private_dns_specifier"
    private const val DEFAULT_PRIVATE_DNS_HOSTNAME = "family.cloudflare-dns.com"
  }
}
