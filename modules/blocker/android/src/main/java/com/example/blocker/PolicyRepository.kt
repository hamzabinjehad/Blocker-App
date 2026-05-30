package com.example.blocker

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.util.Base64
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.example.blocker.behavior.KeywordMatcher
import org.json.JSONArray
import org.json.JSONObject
import java.net.IDN
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Calendar
import java.util.UUID
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

class PolicyRepository(context: Context) {
  private val appContext: Context = context.applicationContext
  private val preferences: SharedPreferences = createPreferences(appContext)

  init {
    migratePolicyIfNeeded()
  }

  fun isAdultFilteringEnabled(): Boolean = preferences.getBoolean(KEY_ADULT_FILTERING, true)

  fun isGoogleSafeSearchEnabled(): Boolean = true

  fun isBingSafeSearchEnabled(): Boolean = true

  fun isDuckDuckGoSafeSearchEnabled(): Boolean = true

  fun isYoutubeRestrictedEnabled(): Boolean = true

  fun isProtectionRequested(): Boolean = preferences.getBoolean(KEY_PROTECTION_REQUESTED, false)

  fun setProtectionRequested(enabled: Boolean) {
    preferences.edit().putBoolean(KEY_PROTECTION_REQUESTED, enabled).apply()
  }

  fun isVpnActive(): Boolean = preferences.getBoolean(KEY_VPN_ACTIVE, false)

  fun setVpnActive(active: Boolean) {
    preferences.edit().putBoolean(KEY_VPN_ACTIVE, active).apply()
  }

  fun panicUnlockStartedAt(): Long = preferences.getLong(KEY_PANIC_UNLOCK_STARTED_AT, 0L)

  fun panicUnlockReadyAt(): Long = preferences.getLong(KEY_PANIC_UNLOCK_READY_AT, 0L)

  fun isPanicUnlockCountdownActive(): Boolean {
    val readyAt = panicUnlockReadyAt()
    return readyAt > 0L && System.currentTimeMillis() < readyAt
  }

  fun startPanicUnlockCountdown(): Long {
    val now = System.currentTimeMillis()
    val existingReadyAt = panicUnlockReadyAt()
    if (existingReadyAt > now) return existingReadyAt
    val readyAt = now + PANIC_UNLOCK_DELAY_MS
    preferences.edit()
      .putLong(KEY_PANIC_UNLOCK_STARTED_AT, now)
      .putLong(KEY_PANIC_UNLOCK_READY_AT, readyAt)
      .apply()
    return readyAt
  }

  fun clearPanicUnlockCountdown() {
    preferences.edit()
      .remove(KEY_PANIC_UNLOCK_STARTED_AT)
      .remove(KEY_PANIC_UNLOCK_READY_AT)
      .apply()
  }

  fun setTampered(tampered: Boolean) {
    preferences.edit().putBoolean(KEY_TAMPERED, tampered).apply()
  }

  fun isTampered(): Boolean = preferences.getBoolean(KEY_TAMPERED, false)

  fun addBlockedDomain(domain: String, pin: String? = null) {
    assertCanChangePolicy(pin)
    val normalized = normalizeDomain(domain)
    if (normalized.isBlank()) return
    putSet(KEY_BLOCKED_DOMAINS, getSet(KEY_BLOCKED_DOMAINS) + normalized)
    recordAuditEvent(
      eventType = "BLOCKLIST_CHANGED",
      severity = "high",
      category = "policy",
      subject = normalized,
      action = "domain_added"
    )
  }

  fun importBlockedDomains(domains: List<String>, pin: String? = null): Map<String, Any?> {
    assertCanChangePolicy(pin)
    val current = getSet(KEY_BLOCKED_DOMAINS)
    val normalized = domains
      .map { normalizeDomain(it) }
      .filter { isValidDomainRule(it) }
      .distinct()
      .take(MAX_CUSTOM_DOMAIN_IMPORT)

    val next = current + normalized
    putSet(KEY_BLOCKED_DOMAINS, next)
    val imported = next.size - current.size
    val ignored = (domains.size - imported).coerceAtLeast(0)

    recordAuditEvent(
      eventType = "BLOCKLIST_IMPORTED",
      severity = "high",
      category = "policy",
      subject = "custom_blocklist",
      action = "imported",
      metadata = mapOf(
        "submitted" to domains.size,
        "accepted" to normalized.size,
        "imported" to imported,
        "ignored" to ignored
      )
    )

    return mapOf(
      "submitted" to domains.size,
      "accepted" to normalized.size,
      "imported" to imported,
      "ignored" to ignored,
      "blockedDomainCount" to blockedDomainCount()
    )
  }

  fun removeBlockedDomain(domain: String, pin: String? = null) {
    assertCanChangePolicy(pin)
    val normalized = normalizeDomain(domain)
    if (normalized.isBlank()) return
    putSet(KEY_BLOCKED_DOMAINS, getSet(KEY_BLOCKED_DOMAINS) - normalized)
    recordAuditEvent(
      eventType = "BLOCKLIST_CHANGED",
      severity = "high",
      category = "policy",
      subject = normalized,
      action = "domain_removed"
    )
  }

  fun blockedDomains(): Set<String> = getSet(KEY_BLOCKED_DOMAINS)

  fun addAllowlistedDomain(domain: String, pin: String? = null) {
    assertCanChangePolicy(pin)
    val normalized = normalizeDomain(domain)
    if (normalized.isBlank()) return
    putSet(KEY_ALLOWLISTED_DOMAINS, getSet(KEY_ALLOWLISTED_DOMAINS) + normalized)
    recordAuditEvent(
      eventType = "ALLOWLIST_CHANGED",
      severity = "high",
      category = "policy",
      subject = normalized,
      action = "domain_added"
    )
  }

  fun removeAllowlistedDomain(domain: String, pin: String? = null) {
    assertCanChangePolicy(pin)
    val normalized = normalizeDomain(domain)
    if (normalized.isBlank()) return
    putSet(KEY_ALLOWLISTED_DOMAINS, getSet(KEY_ALLOWLISTED_DOMAINS) - normalized)
    recordAuditEvent(
      eventType = "ALLOWLIST_CHANGED",
      severity = "high",
      category = "policy",
      subject = normalized,
      action = "domain_removed"
    )
  }

  fun allowlistedDomains(): Set<String> = getSet(KEY_ALLOWLISTED_DOMAINS)

  fun blockedDomainCount(): Int = BlocklistStore.get(appContext).adultDomainCount + blockedDomains().size

  fun bypassDomainCount(): Int = BlocklistStore.get(appContext).bypassDomainCount

  fun customBlockedKeywords(): Set<String> = getSet(KEY_CUSTOM_BLOCKED_KEYWORDS)

  fun updateKeywordList(keywords: List<String>, pin: String? = null) {
    assertCanChangePolicy(pin)
    val normalized = keywords
      .map { KeywordMatcher.normalize(it) }
      .filter { it.isNotBlank() }
      .toSet()
    putSet(KEY_CUSTOM_BLOCKED_KEYWORDS, normalized)
  }

  fun isBehaviorProtectionEnabled(): Boolean = preferences.getBoolean(KEY_BEHAVIOR_PROTECTION_ENABLED, true)

  fun isBehaviorBlockPinRequired(): Boolean = preferences.getBoolean(KEY_BEHAVIOR_BLOCK_REQUIRES_PIN, true)

  fun behaviorBlockDurationSeconds(): Int = preferences.getInt(KEY_BEHAVIOR_BLOCK_DURATION_SECONDS, 12)

  fun behaviorDisableCooldownDays(): Int = preferences.getInt(KEY_BEHAVIOR_DISABLE_COOLDOWN_DAYS, 7)

  fun featureBlockSettings(): Map<String, Boolean> = mapOf(
    KEY_FEATURE_INSTAGRAM_DM to preferences.getBoolean(KEY_FEATURE_INSTAGRAM_DM, false),
    KEY_FEATURE_INSTAGRAM_STORIES to preferences.getBoolean(KEY_FEATURE_INSTAGRAM_STORIES, false),
    KEY_FEATURE_INSTAGRAM_SEARCH to preferences.getBoolean(KEY_FEATURE_INSTAGRAM_SEARCH, false),
    KEY_FEATURE_INSTAGRAM_EXPLORE to preferences.getBoolean(KEY_FEATURE_INSTAGRAM_EXPLORE, false),
    KEY_FEATURE_INSTAGRAM_REELS to preferences.getBoolean(KEY_FEATURE_INSTAGRAM_REELS, false),
    KEY_FEATURE_TIKTOK_SHORTS to preferences.getBoolean(KEY_FEATURE_TIKTOK_SHORTS, false),
    KEY_FEATURE_TIKTOK_SEARCH to preferences.getBoolean(KEY_FEATURE_TIKTOK_SEARCH, false),
    KEY_FEATURE_YOUTUBE_SEARCH to preferences.getBoolean(KEY_FEATURE_YOUTUBE_SEARCH, true),
    KEY_FEATURE_YOUTUBE_SHORTS to preferences.getBoolean(KEY_FEATURE_YOUTUBE_SHORTS, true),
    KEY_FEATURE_YOUTUBE_COMMENTS to preferences.getBoolean(KEY_FEATURE_YOUTUBE_COMMENTS, true),
    KEY_FEATURE_PICTURE_IN_PICTURE to preferences.getBoolean(KEY_FEATURE_PICTURE_IN_PICTURE, true),
    KEY_FEATURE_TELEGRAM_SEARCH to preferences.getBoolean(KEY_FEATURE_TELEGRAM_SEARCH, false),
    KEY_FEATURE_TELEGRAM_SEARCH_HISTORY to preferences.getBoolean(KEY_FEATURE_TELEGRAM_SEARCH_HISTORY, false),
    KEY_FEATURE_TELEGRAM_CHANNELS to preferences.getBoolean(KEY_FEATURE_TELEGRAM_CHANNELS, false),
    KEY_FEATURE_TELEGRAM_GROUPS to preferences.getBoolean(KEY_FEATURE_TELEGRAM_GROUPS, false),
    KEY_FEATURE_TELEGRAM_BLOCKED_ACCOUNTS to preferences.getBoolean(KEY_FEATURE_TELEGRAM_BLOCKED_ACCOUNTS, false),
    KEY_FEATURE_SNAPCHAT_QUICK_ADD to preferences.getBoolean(KEY_FEATURE_SNAPCHAT_QUICK_ADD, false),
    KEY_FEATURE_SNAPCHAT_SEARCH to preferences.getBoolean(KEY_FEATURE_SNAPCHAT_SEARCH, false),
    KEY_FEATURE_SNAPCHAT_DISCOVER to preferences.getBoolean(KEY_FEATURE_SNAPCHAT_DISCOVER, false),
    KEY_FEATURE_SNAPCHAT_STORIES to preferences.getBoolean(KEY_FEATURE_SNAPCHAT_STORIES, false),
    KEY_FEATURE_SNAPCHAT_SPOTLIGHT to preferences.getBoolean(KEY_FEATURE_SNAPCHAT_SPOTLIGHT, false),
    KEY_FEATURE_SNAPCHAT_MAPS to preferences.getBoolean(KEY_FEATURE_SNAPCHAT_MAPS, false),
    KEY_FEATURE_TWITTER_ERASE_ALL to preferences.getBoolean(KEY_FEATURE_TWITTER_ERASE_ALL, false),
    KEY_FEATURE_TWITTER_BLOCK_APP to preferences.getBoolean(KEY_FEATURE_TWITTER_BLOCK_APP, false),
    KEY_FEATURE_TWITTER_SEARCH_MEDIA_TRENDS to preferences.getBoolean(KEY_FEATURE_TWITTER_SEARCH_MEDIA_TRENDS, false),
    KEY_FEATURE_TWITTER_FOR_YOU to preferences.getBoolean(KEY_FEATURE_TWITTER_FOR_YOU, false),
    KEY_FEATURE_DISCORD_BLOCK_APP to preferences.getBoolean(KEY_FEATURE_DISCORD_BLOCK_APP, false),
    KEY_FEATURE_FACEBOOK_BLOCK_APP to preferences.getBoolean(KEY_FEATURE_FACEBOOK_BLOCK_APP, false),
    KEY_FEATURE_FACEBOOK_REELS to preferences.getBoolean(KEY_FEATURE_FACEBOOK_REELS, false),
    KEY_FEATURE_FACEBOOK_STORIES to preferences.getBoolean(KEY_FEATURE_FACEBOOK_STORIES, false),
    KEY_FEATURE_FACEBOOK_SEARCH to preferences.getBoolean(KEY_FEATURE_FACEBOOK_SEARCH, false),
    KEY_FEATURE_FACEBOOK_GROUPS to preferences.getBoolean(KEY_FEATURE_FACEBOOK_GROUPS, false),
    KEY_FEATURE_REDDIT_SEARCH to preferences.getBoolean(KEY_FEATURE_REDDIT_SEARCH, false),
    KEY_FEATURE_REDDIT_SUBREDDITS to preferences.getBoolean(KEY_FEATURE_REDDIT_SUBREDDITS, false),
    KEY_FEATURE_PINTEREST_SEARCH to preferences.getBoolean(KEY_FEATURE_PINTEREST_SEARCH, false),
    KEY_FEATURE_LIVE_STREAMING_APPS to preferences.getBoolean(KEY_FEATURE_LIVE_STREAMING_APPS, false),
    KEY_FEATURE_BROWSER_UNSAFE_MODES to preferences.getBoolean(KEY_FEATURE_BROWSER_UNSAFE_MODES, true),
    KEY_FEATURE_ANDROID_TAMPER_SETTINGS to preferences.getBoolean(KEY_FEATURE_ANDROID_TAMPER_SETTINGS, true),
    KEY_FEATURE_PLAY_STORE_UNINSTALL_CONTROLS to preferences.getBoolean(KEY_FEATURE_PLAY_STORE_UNINSTALL_CONTROLS, true),
    KEY_FEATURE_PLAY_STORE_ADULT_INSTALL_CONTROLS to preferences.getBoolean(
      KEY_FEATURE_PLAY_STORE_ADULT_INSTALL_CONTROLS,
      true
    ),
    KEY_FEATURE_PACKAGE_INSTALLER_CONTROLS to preferences.getBoolean(KEY_FEATURE_PACKAGE_INSTALLER_CONTROLS, true)
  )

  fun currentScreenContext(): Map<String, Any?> = mapOf(
    "app" to (preferences.getString(KEY_CURRENT_CONTEXT_APP, null) ?: ""),
    "screen" to (preferences.getString(KEY_CURRENT_CONTEXT_SCREEN, null) ?: ""),
    "timestamp" to preferences.getLong(KEY_CURRENT_CONTEXT_TIMESTAMP, 0)
  )

  fun setCurrentScreenContext(app: String, screen: String) {
    preferences.edit()
      .putString(KEY_CURRENT_CONTEXT_APP, app)
      .putString(KEY_CURRENT_CONTEXT_SCREEN, screen)
      .putLong(KEY_CURRENT_CONTEXT_TIMESTAMP, System.currentTimeMillis())
      .apply()
  }

  fun wasSafeModeBoot(): Boolean = preferences.getBoolean(KEY_LAST_BOOT_SAFE_MODE, false)

  fun setSafeModeBoot(safeMode: Boolean) {
    preferences.edit().putBoolean(KEY_LAST_BOOT_SAFE_MODE, safeMode).apply()
  }

  fun wasAccessibilityServiceEnabled(): Boolean = preferences.getBoolean(KEY_ACCESSIBILITY_SERVICE_WAS_ENABLED, false)

  fun setAccessibilityServiceEnabledSnapshot(enabled: Boolean) {
    preferences.edit().putBoolean(KEY_ACCESSIBILITY_SERVICE_WAS_ENABLED, enabled).apply()
  }

  fun behaviorPolicySnapshot(): Map<String, Any?> = mapOf(
    "behaviorProtectionEnabled" to isBehaviorProtectionEnabled(),
    "behaviorBlockDurationSeconds" to behaviorBlockDurationSeconds(),
    "behaviorBlockRequiresPin" to isBehaviorBlockPinRequired(),
    "behaviorDisableCooldownDays" to behaviorDisableCooldownDays(),
    "customKeywords" to customBlockedKeywords().toList().sorted(),
    "customKeywordCount" to customBlockedKeywords().size,
    "builtInKeywordCount" to BlocklistStore.get(appContext).activeKeywordCount,
    "featureBlocks" to featureBlockSettings(),
    "textContextEngine" to mapOf(
      "enabled" to true,
      "mode" to "weighted_local_context",
      "safeContextBypass" to true,
      "riskSignals" to listOf("intent", "media_request", "adult_platform"),
      "privacyMode" to "on_device_text_only"
    ),
    "currentContext" to currentScreenContext()
  )

  fun lastBlocklistUpdate(): String =
    preferences.getString(KEY_LAST_BLOCKLIST_UPDATE, null) ?: BlocklistStore.get(appContext).generatedAt

  fun setLastBlocklistUpdate(label: String) {
    preferences.edit().putString(KEY_LAST_BLOCKLIST_UPDATE, label).apply()
  }

  fun isBlockVpnAppsEnabled(): Boolean = preferences.getBoolean(KEY_BLOCK_VPN_APPS, true)

  fun isBlockPrivateBrowsersEnabled(): Boolean = preferences.getBoolean(KEY_BLOCK_PRIVATE_BROWSERS, true)

  fun isBlockBypassToolsEnabled(): Boolean = preferences.getBoolean(KEY_BLOCK_BYPASS_TOOLS, true)

  fun isBlockSideloadedAppsEnabled(): Boolean = preferences.getBoolean(KEY_BLOCK_SIDELOADED_APPS, true)

  fun isBlockUnknownSearchEnginesEnabled(): Boolean = true

  fun shouldBlockBypassDomains(): Boolean = isBlockVpnAppsEnabled() || isBlockBypassToolsEnabled()

  fun safeSearchPolicySnapshot(): Map<String, Any?> = mapOf(
    "googleSafeSearch" to isGoogleSafeSearchEnabled(),
    "bingSafeSearch" to isBingSafeSearchEnabled(),
    "duckDuckGoSafeSearch" to isDuckDuckGoSafeSearchEnabled(),
    "youtubeRestrictedMode" to isYoutubeRestrictedEnabled(),
    "blockUnknownSearchEngines" to isBlockUnknownSearchEnginesEnabled()
  )

  fun riskyPolicySnapshot(): Map<String, Any?> = mapOf(
    "blockVpnApps" to isBlockVpnAppsEnabled(),
    "blockPrivateBrowsers" to isBlockPrivateBrowsersEnabled(),
    "blockBypassTools" to isBlockBypassToolsEnabled(),
    "blockSideloadedApps" to isBlockSideloadedAppsEnabled()
  )

  fun isFullTunnelVpnEnabled(): Boolean = preferences.getBoolean(KEY_FULL_TUNNEL_VPN_ENABLED, false)

  fun isPerAppVpnFilteringEnabled(): Boolean = preferences.getBoolean(KEY_PER_APP_VPN_FILTERING_ENABLED, true)

  fun isIpv6LeakPreventionEnabled(): Boolean = preferences.getBoolean(KEY_IPV6_LEAK_PREVENTION_ENABLED, true)

  fun vpnAllowedPackages(): Set<String> = getSet(KEY_VPN_ALLOWED_PACKAGES)

  fun vpnExcludedPackages(): Set<String> = getSet(KEY_VPN_EXCLUDED_PACKAGES)

  fun isHttpsInspectionEnabled(): Boolean = preferences.getBoolean(KEY_HTTPS_INSPECTION_ENABLED, false)

  fun hasAcknowledgedHttpsInspectionPrivacy(): Boolean =
    preferences.getBoolean(KEY_HTTPS_INSPECTION_PRIVACY_ACKNOWLEDGED, false)

  fun isCloudImageFallbackEnabled(): Boolean = preferences.getBoolean(KEY_CLOUD_IMAGE_FALLBACK_ENABLED, false)

  fun cloudImageFallbackEndpoint(): String =
    preferences.getString(KEY_CLOUD_IMAGE_FALLBACK_ENDPOINT, "")?.trim().orEmpty()

  fun isScreenshotAuditEnabled(): Boolean = preferences.getBoolean(KEY_SCREENSHOT_AUDIT_ENABLED, false)

  fun screenshotAuditIntervalMinutes(): Int =
    preferences.getInt(KEY_SCREENSHOT_AUDIT_INTERVAL_MINUTES, DEFAULT_SCREENSHOT_AUDIT_INTERVAL_MINUTES)
      .coerceIn(MIN_SCREENSHOT_AUDIT_INTERVAL_MINUTES, MAX_SCREENSHOT_AUDIT_INTERVAL_MINUTES)

  fun screenshotAuditIntervalMs(): Long =
    screenshotAuditIntervalMinutes().toLong() * 60L * 1000L

  fun screenshotAuditPolicySnapshot(): Map<String, Any?> = mapOf(
    "enabled" to isScreenshotAuditEnabled(),
    "intervalMinutes" to screenshotAuditIntervalMinutes(),
    "retainsImages" to false,
    "localAiReview" to true,
    "partnerReviewAvailable" to getGuardianAlerts().isNotEmpty(),
    "limitations" to listOf(
      "Opt-in accessibility screenshots are analyzed on-device and are not retained by this app.",
      "Android blocks captures for secure windows and protected media surfaces.",
      "Remote partner review requires a sync or webhook backend; this build queues local guardian alerts."
    )
  )

  fun updateVpnPolicy(policy: Map<String, Any?>): Map<String, Any?> {
    val suppliedPin = (policy["adminPin"] ?: policy["currentPin"]) as? String ?: ""
    assertCanChangePolicy(suppliedPin)

    val editor = preferences.edit()
    policy.booleanOrNull(KEY_FULL_TUNNEL_VPN_ENABLED)?.let {
      editor.putBoolean(KEY_FULL_TUNNEL_VPN_ENABLED, it)
    }
    policy.booleanOrNull(KEY_PER_APP_VPN_FILTERING_ENABLED)?.let {
      editor.putBoolean(KEY_PER_APP_VPN_FILTERING_ENABLED, it)
    }
    policy.booleanOrNull(KEY_IPV6_LEAK_PREVENTION_ENABLED)?.let {
      editor.putBoolean(KEY_IPV6_LEAK_PREVENTION_ENABLED, it)
    }
    normalizePackageSet(policy["vpnAllowedPackages"])?.let {
      editor.putStringSet(KEY_VPN_ALLOWED_PACKAGES, it)
    }
    normalizePackageSet(policy["vpnExcludedPackages"])?.let {
      editor.putStringSet(KEY_VPN_EXCLUDED_PACKAGES, it)
    }
    editor.apply()

    recordAuditEvent(
      eventType = "VPN_POLICY_CHANGED",
      severity = "high",
      category = "vpn",
      subject = "vpn_policy",
      action = "updated",
      metadata = mapOf(
        "keys" to policy.keys.filter { it != "adminPin" && it != "currentPin" }.sorted().joinToString(",")
      )
    )

    return VpnPolicyManager.status(appContext, this)
  }

  fun setHttpsInspectionEnabled(
    enabled: Boolean,
    privacyAcknowledged: Boolean,
    pin: String? = null
  ): Map<String, Any?> {
    assertCanChangePolicy(pin)
    if (enabled && !privacyAcknowledged && !hasAcknowledgedHttpsInspectionPrivacy()) {
      return mapOf(
        "applied" to false,
        "reason" to "privacy_acknowledgement_required",
        "httpsInspectionStatus" to httpsInspectionStatus()
      )
    }

    val editor = preferences.edit()
      .putBoolean(KEY_HTTPS_INSPECTION_ENABLED, enabled)
    if (privacyAcknowledged) {
      editor.putBoolean(KEY_HTTPS_INSPECTION_PRIVACY_ACKNOWLEDGED, true)
    }
    editor.apply()

    recordAuditEvent(
      eventType = "HTTPS_INSPECTION_CHANGED",
      severity = if (enabled) "critical" else "high",
      category = "https_proxy",
      subject = "local_proxy",
      action = if (enabled) "enabled" else "disabled",
      metadata = mapOf("privacyAcknowledged" to (privacyAcknowledged || hasAcknowledgedHttpsInspectionPrivacy()))
    )

    return mapOf(
      "applied" to true,
      "reason" to null,
      "httpsInspectionStatus" to httpsInspectionStatus()
    )
  }

  fun httpsInspectionStatus(): Map<String, Any?> {
    val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
    val acknowledged = hasAcknowledgedHttpsInspectionPrivacy()
    val enabled = isHttpsInspectionEnabled()
    return mapOf(
      "supported" to supported,
      "enabled" to enabled,
      "privacyAcknowledged" to acknowledged,
      "localProxyConfigured" to (supported && enabled && acknowledged),
      "localProxyPort" to LocalHttpProxy.DEFAULT_PORT,
      "connectHostFilteringActive" to (supported && enabled && acknowledged),
      "rootCaInstalled" to false,
      "contentInspectionActive" to false,
      "warning" to HTTPS_INSPECTION_WARNING,
      "limitations" to listOf(
        "HTTPS content decryption requires a user-installed root CA and app trust; pinned apps may reject it.",
        "The current local proxy filters HTTP and HTTPS CONNECT hostnames without decrypting page content.",
        "Only apps that honor the VPN proxy configuration will use the local proxy."
      )
    )
  }

  fun isStrictModeEnabled(): Boolean = preferences.getBoolean(KEY_STRICT_MODE_ENABLED, false)

  fun setStrictModeEnabled(enabled: Boolean, pin: String? = null) {
    assertCanChangePolicy(pin)
    preferences.edit().putBoolean(KEY_STRICT_MODE_ENABLED, enabled).apply()
    recordAuditEvent(
      eventType = "STRICT_MODE_CHANGED",
      severity = if (enabled) "high" else "critical",
      category = "policy",
      subject = "strict_mode",
      action = if (enabled) "enabled" else "disabled"
    )
  }

  fun isPinConfigured(): Boolean = preferences.getString(KEY_PIN_HASH, null) != null

  fun verifyPin(pin: String): Boolean {
    if (!isPinConfigured()) return true
    val salt = preferences.getString(KEY_PIN_SALT, null) ?: return false
    val expected = preferences.getString(KEY_PIN_HASH, null) ?: return false
    val algorithm = preferences.getString(KEY_PIN_ALGORITHM, PIN_ALGORITHM_LEGACY_SHA256)
    val verified = if (algorithm == PIN_ALGORITHM_PBKDF2) {
      val iterations = preferences.getInt(KEY_PIN_ITERATIONS, DEFAULT_PIN_ITERATIONS)
      constantTimeEquals(pbkdf2(pin, salt, iterations), expected)
    } else {
      constantTimeEquals(sha256("$salt:$pin"), expected)
    }
    if (verified && algorithm != PIN_ALGORITHM_PBKDF2) {
      setPin(pin)
      recordAuditEvent(
        eventType = "PIN_HASH_MIGRATED",
        severity = "high",
        category = "policy",
        subject = "parent_pin",
        action = "pbkdf2"
      )
    }
    return verified
  }

  fun recordFailedPinAttempt(): Int {
    val attempts = preferences.getInt(KEY_FAILED_PIN_ATTEMPTS, 0) + 1
    preferences.edit().putInt(KEY_FAILED_PIN_ATTEMPTS, attempts).apply()
    recordAuditEvent(
      eventType = "PIN_ATTEMPT_FAILED",
      severity = if (attempts >= 5) "critical" else "high",
      category = "pin",
      subject = "guardian_pin",
      action = "failed",
      metadata = mapOf("attempts" to attempts)
    )
    return attempts
  }

  fun clearFailedPinAttempts() {
    preferences.edit().remove(KEY_FAILED_PIN_ATTEMPTS).apply()
  }

  fun assertCanChangePolicy(pin: String?) {
    if (isPinConfigured() && !verifyPin(pin ?: "")) {
      throw IllegalArgumentException("Parent PIN is required or incorrect")
    }
  }

  fun updatePolicy(policy: Map<String, Any?>) {
    val sensitivePolicyKeys = setOf(
      KEY_ADULT_FILTERING,
      KEY_GOOGLE_SAFESEARCH,
      KEY_BING_SAFESEARCH,
      KEY_DUCKDUCKGO_SAFESEARCH,
      KEY_YOUTUBE_RESTRICTED,
      KEY_BLOCK_UNKNOWN_SEARCH,
      KEY_BLOCK_VPN_APPS,
      KEY_BLOCK_PRIVATE_BROWSERS,
      KEY_BLOCK_BYPASS_TOOLS,
      KEY_BLOCK_SIDELOADED_APPS,
      KEY_FULL_TUNNEL_VPN_ENABLED,
      KEY_PER_APP_VPN_FILTERING_ENABLED,
      KEY_IPV6_LEAK_PREVENTION_ENABLED,
      KEY_HTTPS_INSPECTION_ENABLED,
      KEY_CLOUD_IMAGE_FALLBACK_ENABLED,
      KEY_CLOUD_IMAGE_FALLBACK_ENDPOINT,
      KEY_SCREENSHOT_AUDIT_ENABLED,
      KEY_SCREENSHOT_AUDIT_INTERVAL_MINUTES,
      KEY_STRICT_MODE_ENABLED,
      KEY_BEHAVIOR_PROTECTION_ENABLED,
      KEY_BEHAVIOR_BLOCK_REQUIRES_PIN,
      KEY_BEHAVIOR_BLOCK_DURATION_SECONDS,
      KEY_BEHAVIOR_DISABLE_COOLDOWN_DAYS,
      KEY_FEATURE_INSTAGRAM_DM,
      KEY_FEATURE_INSTAGRAM_STORIES,
      KEY_FEATURE_INSTAGRAM_SEARCH,
      KEY_FEATURE_INSTAGRAM_EXPLORE,
      KEY_FEATURE_INSTAGRAM_REELS,
      KEY_FEATURE_TIKTOK_SHORTS,
      KEY_FEATURE_TIKTOK_SEARCH,
      KEY_FEATURE_YOUTUBE_SEARCH,
      KEY_FEATURE_YOUTUBE_SHORTS,
      KEY_FEATURE_YOUTUBE_COMMENTS,
      KEY_FEATURE_PICTURE_IN_PICTURE,
      KEY_FEATURE_TELEGRAM_SEARCH,
      KEY_FEATURE_TELEGRAM_SEARCH_HISTORY,
      KEY_FEATURE_TELEGRAM_CHANNELS,
      KEY_FEATURE_TELEGRAM_GROUPS,
      KEY_FEATURE_TELEGRAM_BLOCKED_ACCOUNTS,
      KEY_FEATURE_SNAPCHAT_QUICK_ADD,
      KEY_FEATURE_SNAPCHAT_SEARCH,
      KEY_FEATURE_SNAPCHAT_DISCOVER,
      KEY_FEATURE_SNAPCHAT_STORIES,
      KEY_FEATURE_SNAPCHAT_SPOTLIGHT,
      KEY_FEATURE_SNAPCHAT_MAPS,
      KEY_FEATURE_TWITTER_ERASE_ALL,
      KEY_FEATURE_TWITTER_BLOCK_APP,
      KEY_FEATURE_TWITTER_SEARCH_MEDIA_TRENDS,
      KEY_FEATURE_TWITTER_FOR_YOU,
      KEY_FEATURE_DISCORD_BLOCK_APP,
      KEY_FEATURE_FACEBOOK_BLOCK_APP,
      KEY_FEATURE_FACEBOOK_REELS,
      KEY_FEATURE_FACEBOOK_STORIES,
      KEY_FEATURE_FACEBOOK_SEARCH,
      KEY_FEATURE_FACEBOOK_GROUPS,
      KEY_FEATURE_REDDIT_SEARCH,
      KEY_FEATURE_REDDIT_SUBREDDITS,
      KEY_FEATURE_PINTEREST_SEARCH,
      KEY_FEATURE_LIVE_STREAMING_APPS,
      KEY_FEATURE_BROWSER_UNSAFE_MODES,
      KEY_FEATURE_ANDROID_TAMPER_SETTINGS,
      KEY_FEATURE_PLAY_STORE_UNINSTALL_CONTROLS,
      KEY_FEATURE_PLAY_STORE_ADULT_INSTALL_CONTROLS,
      KEY_FEATURE_PACKAGE_INSTALLER_CONTROLS,
      KEY_NOTIFICATION_FILTERING_ENABLED
    )
    val changesSensitivePolicy = policy.keys.any { it in sensitivePolicyKeys }
    val suppliedPin = (policy["adminPin"] ?: policy["currentPin"]) as? String ?: ""

    if (changesSensitivePolicy) assertCanChangePolicy(suppliedPin)

    (policy["newPin"] as? String)?.let { newPin ->
      if (newPin.length < 4) {
        throw IllegalArgumentException("PIN must contain at least 4 digits")
      }
      if (isPinConfigured() && !verifyPin(suppliedPin)) {
        throw IllegalArgumentException("Current parent PIN is required or incorrect")
      }
      setPin(newPin)
    }

    val editor = preferences.edit()
    policy.booleanOrNull(KEY_ADULT_FILTERING)?.let { editor.putBoolean(KEY_ADULT_FILTERING, it) }
    policy.booleanOrNull(KEY_GOOGLE_SAFESEARCH)?.let { editor.putBoolean(KEY_GOOGLE_SAFESEARCH, it) }
    policy.booleanOrNull(KEY_BING_SAFESEARCH)?.let { editor.putBoolean(KEY_BING_SAFESEARCH, it) }
    policy.booleanOrNull(KEY_DUCKDUCKGO_SAFESEARCH)?.let { editor.putBoolean(KEY_DUCKDUCKGO_SAFESEARCH, it) }
    policy.booleanOrNull(KEY_YOUTUBE_RESTRICTED)?.let { editor.putBoolean(KEY_YOUTUBE_RESTRICTED, it) }
    policy.booleanOrNull(KEY_BLOCK_UNKNOWN_SEARCH)?.let { editor.putBoolean(KEY_BLOCK_UNKNOWN_SEARCH, it) }
    policy.booleanOrNull(KEY_BLOCK_VPN_APPS)?.let { editor.putBoolean(KEY_BLOCK_VPN_APPS, it) }
    policy.booleanOrNull(KEY_BLOCK_PRIVATE_BROWSERS)?.let { editor.putBoolean(KEY_BLOCK_PRIVATE_BROWSERS, it) }
    policy.booleanOrNull(KEY_BLOCK_BYPASS_TOOLS)?.let { editor.putBoolean(KEY_BLOCK_BYPASS_TOOLS, it) }
    policy.booleanOrNull(KEY_BLOCK_SIDELOADED_APPS)?.let { editor.putBoolean(KEY_BLOCK_SIDELOADED_APPS, it) }
    policy.booleanOrNull(KEY_FULL_TUNNEL_VPN_ENABLED)?.let { editor.putBoolean(KEY_FULL_TUNNEL_VPN_ENABLED, it) }
    policy.booleanOrNull(KEY_PER_APP_VPN_FILTERING_ENABLED)?.let { editor.putBoolean(KEY_PER_APP_VPN_FILTERING_ENABLED, it) }
    policy.booleanOrNull(KEY_IPV6_LEAK_PREVENTION_ENABLED)?.let { editor.putBoolean(KEY_IPV6_LEAK_PREVENTION_ENABLED, it) }
    policy.booleanOrNull(KEY_STRICT_MODE_ENABLED)?.let { editor.putBoolean(KEY_STRICT_MODE_ENABLED, it) }
    policy.booleanOrNull(KEY_CLOUD_IMAGE_FALLBACK_ENABLED)?.let { editor.putBoolean(KEY_CLOUD_IMAGE_FALLBACK_ENABLED, it) }
    policy.booleanOrNull(KEY_SCREENSHOT_AUDIT_ENABLED)?.let { editor.putBoolean(KEY_SCREENSHOT_AUDIT_ENABLED, it) }
    policy.intOrNull(KEY_SCREENSHOT_AUDIT_INTERVAL_MINUTES)?.let {
      editor.putInt(
        KEY_SCREENSHOT_AUDIT_INTERVAL_MINUTES,
        it.coerceIn(MIN_SCREENSHOT_AUDIT_INTERVAL_MINUTES, MAX_SCREENSHOT_AUDIT_INTERVAL_MINUTES)
      )
    }
    policy.stringOrNull(KEY_CLOUD_IMAGE_FALLBACK_ENDPOINT)?.let { endpoint ->
      val trimmed = endpoint.trim()
      if (trimmed.isNotBlank() && !trimmed.startsWith("https://")) {
        throw IllegalArgumentException("Cloud image fallback endpoint must use HTTPS")
      }
      editor.putString(KEY_CLOUD_IMAGE_FALLBACK_ENDPOINT, trimmed)
    }
    policy.booleanOrNull(KEY_BEHAVIOR_PROTECTION_ENABLED)?.let { editor.putBoolean(KEY_BEHAVIOR_PROTECTION_ENABLED, it) }
    policy.booleanOrNull(KEY_BEHAVIOR_BLOCK_REQUIRES_PIN)?.let { editor.putBoolean(KEY_BEHAVIOR_BLOCK_REQUIRES_PIN, it) }
    policy.intOrNull(KEY_BEHAVIOR_BLOCK_DURATION_SECONDS)?.let {
      editor.putInt(KEY_BEHAVIOR_BLOCK_DURATION_SECONDS, it.coerceIn(5, 120))
    }
    policy.intOrNull(KEY_BEHAVIOR_DISABLE_COOLDOWN_DAYS)?.let {
      editor.putInt(KEY_BEHAVIOR_DISABLE_COOLDOWN_DAYS, it.coerceIn(7, 90))
    }
    policy.booleanOrNull(KEY_FEATURE_INSTAGRAM_DM)?.let { editor.putBoolean(KEY_FEATURE_INSTAGRAM_DM, it) }
    policy.booleanOrNull(KEY_FEATURE_INSTAGRAM_STORIES)?.let { editor.putBoolean(KEY_FEATURE_INSTAGRAM_STORIES, it) }
    policy.booleanOrNull(KEY_FEATURE_INSTAGRAM_SEARCH)?.let { editor.putBoolean(KEY_FEATURE_INSTAGRAM_SEARCH, it) }
    policy.booleanOrNull(KEY_FEATURE_INSTAGRAM_EXPLORE)?.let { editor.putBoolean(KEY_FEATURE_INSTAGRAM_EXPLORE, it) }
    policy.booleanOrNull(KEY_FEATURE_INSTAGRAM_REELS)?.let { editor.putBoolean(KEY_FEATURE_INSTAGRAM_REELS, it) }
    policy.booleanOrNull(KEY_FEATURE_TIKTOK_SHORTS)?.let { editor.putBoolean(KEY_FEATURE_TIKTOK_SHORTS, it) }
    policy.booleanOrNull(KEY_FEATURE_TIKTOK_SEARCH)?.let { editor.putBoolean(KEY_FEATURE_TIKTOK_SEARCH, it) }
    policy.booleanOrNull(KEY_FEATURE_YOUTUBE_SEARCH)?.let { editor.putBoolean(KEY_FEATURE_YOUTUBE_SEARCH, it) }
    policy.booleanOrNull(KEY_FEATURE_YOUTUBE_SHORTS)?.let { editor.putBoolean(KEY_FEATURE_YOUTUBE_SHORTS, it) }
    policy.booleanOrNull(KEY_FEATURE_YOUTUBE_COMMENTS)?.let { editor.putBoolean(KEY_FEATURE_YOUTUBE_COMMENTS, it) }
    policy.booleanOrNull(KEY_FEATURE_PICTURE_IN_PICTURE)?.let { editor.putBoolean(KEY_FEATURE_PICTURE_IN_PICTURE, it) }
    policy.booleanOrNull(KEY_FEATURE_TELEGRAM_SEARCH)?.let { editor.putBoolean(KEY_FEATURE_TELEGRAM_SEARCH, it) }
    policy.booleanOrNull(KEY_FEATURE_TELEGRAM_SEARCH_HISTORY)?.let {
      editor.putBoolean(KEY_FEATURE_TELEGRAM_SEARCH_HISTORY, it)
    }
    policy.booleanOrNull(KEY_FEATURE_TELEGRAM_CHANNELS)?.let { editor.putBoolean(KEY_FEATURE_TELEGRAM_CHANNELS, it) }
    policy.booleanOrNull(KEY_FEATURE_TELEGRAM_GROUPS)?.let { editor.putBoolean(KEY_FEATURE_TELEGRAM_GROUPS, it) }
    policy.booleanOrNull(KEY_FEATURE_TELEGRAM_BLOCKED_ACCOUNTS)?.let {
      editor.putBoolean(KEY_FEATURE_TELEGRAM_BLOCKED_ACCOUNTS, it)
    }
    policy.booleanOrNull(KEY_FEATURE_SNAPCHAT_QUICK_ADD)?.let { editor.putBoolean(KEY_FEATURE_SNAPCHAT_QUICK_ADD, it) }
    policy.booleanOrNull(KEY_FEATURE_SNAPCHAT_SEARCH)?.let { editor.putBoolean(KEY_FEATURE_SNAPCHAT_SEARCH, it) }
    policy.booleanOrNull(KEY_FEATURE_SNAPCHAT_DISCOVER)?.let { editor.putBoolean(KEY_FEATURE_SNAPCHAT_DISCOVER, it) }
    policy.booleanOrNull(KEY_FEATURE_SNAPCHAT_STORIES)?.let { editor.putBoolean(KEY_FEATURE_SNAPCHAT_STORIES, it) }
    policy.booleanOrNull(KEY_FEATURE_SNAPCHAT_SPOTLIGHT)?.let { editor.putBoolean(KEY_FEATURE_SNAPCHAT_SPOTLIGHT, it) }
    policy.booleanOrNull(KEY_FEATURE_SNAPCHAT_MAPS)?.let { editor.putBoolean(KEY_FEATURE_SNAPCHAT_MAPS, it) }
    policy.booleanOrNull(KEY_FEATURE_TWITTER_ERASE_ALL)?.let { editor.putBoolean(KEY_FEATURE_TWITTER_ERASE_ALL, it) }
    policy.booleanOrNull(KEY_FEATURE_TWITTER_BLOCK_APP)?.let { editor.putBoolean(KEY_FEATURE_TWITTER_BLOCK_APP, it) }
    policy.booleanOrNull(KEY_FEATURE_TWITTER_SEARCH_MEDIA_TRENDS)?.let {
      editor.putBoolean(KEY_FEATURE_TWITTER_SEARCH_MEDIA_TRENDS, it)
    }
    policy.booleanOrNull(KEY_FEATURE_TWITTER_FOR_YOU)?.let { editor.putBoolean(KEY_FEATURE_TWITTER_FOR_YOU, it) }
    policy.booleanOrNull(KEY_FEATURE_DISCORD_BLOCK_APP)?.let { editor.putBoolean(KEY_FEATURE_DISCORD_BLOCK_APP, it) }
    policy.booleanOrNull(KEY_FEATURE_FACEBOOK_BLOCK_APP)?.let { editor.putBoolean(KEY_FEATURE_FACEBOOK_BLOCK_APP, it) }
    policy.booleanOrNull(KEY_FEATURE_FACEBOOK_REELS)?.let { editor.putBoolean(KEY_FEATURE_FACEBOOK_REELS, it) }
    policy.booleanOrNull(KEY_FEATURE_FACEBOOK_STORIES)?.let { editor.putBoolean(KEY_FEATURE_FACEBOOK_STORIES, it) }
    policy.booleanOrNull(KEY_FEATURE_FACEBOOK_SEARCH)?.let { editor.putBoolean(KEY_FEATURE_FACEBOOK_SEARCH, it) }
    policy.booleanOrNull(KEY_FEATURE_FACEBOOK_GROUPS)?.let { editor.putBoolean(KEY_FEATURE_FACEBOOK_GROUPS, it) }
    policy.booleanOrNull(KEY_FEATURE_REDDIT_SEARCH)?.let { editor.putBoolean(KEY_FEATURE_REDDIT_SEARCH, it) }
    policy.booleanOrNull(KEY_FEATURE_REDDIT_SUBREDDITS)?.let { editor.putBoolean(KEY_FEATURE_REDDIT_SUBREDDITS, it) }
    policy.booleanOrNull(KEY_FEATURE_PINTEREST_SEARCH)?.let { editor.putBoolean(KEY_FEATURE_PINTEREST_SEARCH, it) }
    policy.booleanOrNull(KEY_FEATURE_LIVE_STREAMING_APPS)?.let { editor.putBoolean(KEY_FEATURE_LIVE_STREAMING_APPS, it) }
    policy.booleanOrNull(KEY_FEATURE_BROWSER_UNSAFE_MODES)?.let { editor.putBoolean(KEY_FEATURE_BROWSER_UNSAFE_MODES, it) }
    policy.booleanOrNull(KEY_FEATURE_ANDROID_TAMPER_SETTINGS)?.let {
      editor.putBoolean(KEY_FEATURE_ANDROID_TAMPER_SETTINGS, it)
    }
    policy.booleanOrNull(KEY_FEATURE_PLAY_STORE_UNINSTALL_CONTROLS)?.let {
      editor.putBoolean(KEY_FEATURE_PLAY_STORE_UNINSTALL_CONTROLS, it)
    }
    policy.booleanOrNull(KEY_FEATURE_PLAY_STORE_ADULT_INSTALL_CONTROLS)?.let {
      editor.putBoolean(KEY_FEATURE_PLAY_STORE_ADULT_INSTALL_CONTROLS, it)
    }
    policy.booleanOrNull(KEY_FEATURE_PACKAGE_INSTALLER_CONTROLS)?.let {
      editor.putBoolean(KEY_FEATURE_PACKAGE_INSTALLER_CONTROLS, it)
    }
    policy.booleanOrNull(KEY_NOTIFICATION_FILTERING_ENABLED)?.let {
      editor.putBoolean(KEY_NOTIFICATION_FILTERING_ENABLED, it)
    }
    editor
      .putBoolean(KEY_GOOGLE_SAFESEARCH, true)
      .putBoolean(KEY_BING_SAFESEARCH, true)
      .putBoolean(KEY_DUCKDUCKGO_SAFESEARCH, true)
      .putBoolean(KEY_YOUTUBE_RESTRICTED, true)
      .putBoolean(KEY_BLOCK_UNKNOWN_SEARCH, true)
    editor.apply()

    if (changesSensitivePolicy) {
      recordAuditEvent(
        eventType = "POLICY_CHANGED",
        severity = "medium",
        category = "policy",
        subject = policy.keys.filter { it != "adminPin" && it != "currentPin" }.sorted().joinToString(","),
        action = "updated"
      )
    }
  }

  fun recordDomainEvent(domain: String, category: String, action: String): Boolean {
    // Keep logs minimal by design: no full URLs, no page titles, no message content.
    val normalized = normalizeDomain(domain)
    val now = System.currentTimeMillis()
    val previousDomain = preferences.getString(KEY_LAST_EVENT_DOMAIN, "")
    val previousCategory = preferences.getString(KEY_LAST_EVENT_CATEGORY, "")
    val previousAction = preferences.getString(KEY_LAST_EVENT_ACTION, "")
    val previousTimestamp = preferences.getLong(KEY_LAST_EVENT_TIMESTAMP, 0)
    if (
      previousDomain == normalized &&
      previousCategory == category &&
      previousAction == action &&
      now - previousTimestamp < DOMAIN_EVENT_RATE_LIMIT_MS
    ) {
      return false
    }

    preferences.edit()
      .putString(KEY_LAST_EVENT_DOMAIN, normalized)
      .putString(KEY_LAST_EVENT_CATEGORY, category)
      .putString(KEY_LAST_EVENT_ACTION, action)
      .putLong(KEY_LAST_EVENT_TIMESTAMP, now)
      .apply()
    recordAuditEvent(
      eventType = "DOMAIN_EVENT",
      severity = if (category == "tamper" || category == "bypass") "high" else "medium",
      category = category,
      subject = normalized,
      action = action
    )
    return true
  }

  fun recordBehaviorTrigger(event: Map<String, Any?>) {
    val eventType = event["eventType"] as? String ?: "BLOCK_EVENT"
    val reason = event["reason"] as? String ?: "behavior"
    val packageName = event["packageName"] as? String ?: ""
    val keyword = event["keyword"] as? String ?: ""
    val action = event["action"] as? String ?: "blocked"

    recordAuditEvent(
      eventType = eventType,
      severity = when (reason) {
        "bypass_domain", "tamper", "package_install_blocked", "sideloaded_apk" -> "critical"
        "blocked_app", "blocked_app_feature", "focus_mode", "usage_limit" -> "high"
        else -> "medium"
      },
      category = reason,
      subject = packageName.ifBlank { keyword },
      action = action
    )
  }

  fun recordAuditEvent(
    eventType: String,
    severity: String,
    category: String,
    subject: String,
    action: String,
    metadata: Map<String, Any?> = emptyMap()
  ) {
    val next = JSONObject()
      .put("id", UUID.randomUUID().toString())
      .put("eventType", eventType)
      .put("severity", severity)
      .put("category", category)
      .put("subject", subject.take(180))
      .put("action", action)
      .put("timestamp", System.currentTimeMillis())

    if (metadata.isNotEmpty()) {
      val meta = JSONObject()
      metadata.forEach { (key, value) ->
        meta.put(key, when (value) {
          null -> JSONObject.NULL
          is Boolean, is Number, is String -> value
          else -> value.toString()
        })
      }
      next.put("metadata", meta)
    }

    val previous = auditEventsJson()
    val compact = JSONArray().put(next)
    for (index in 0 until minOf(previous.length(), MAX_AUDIT_EVENTS - 1)) {
      compact.put(previous.optJSONObject(index))
    }
    preferences.edit().putString(KEY_AUDIT_EVENTS, compact.toString()).apply()
  }

  fun getAuditEvents(): List<Map<String, Any?>> {
    val events = auditEventsJson()
    return (0 until events.length()).mapNotNull { index ->
      val item = events.optJSONObject(index) ?: return@mapNotNull null
      mapOf(
        "id" to item.optString("id"),
        "eventType" to item.optString("eventType"),
        "severity" to item.optString("severity"),
        "category" to item.optString("category"),
        "subject" to item.optString("subject"),
        "action" to item.optString("action"),
        "timestamp" to item.optLong("timestamp"),
        "metadata" to item.optJSONObject("metadata")?.toString()
      )
    }
  }

  fun recordGuardianAlert(
    eventType: String,
    severity: String,
    subject: String,
    action: String,
    metadata: Map<String, Any?> = emptyMap()
  ) {
    val next = JSONObject()
      .put("id", UUID.randomUUID().toString())
      .put("eventType", eventType)
      .put("severity", severity)
      .put("subject", subject.take(180))
      .put("action", action)
      .put("timestamp", System.currentTimeMillis())
      .put("cleared", false)

    if (metadata.isNotEmpty()) {
      val meta = JSONObject()
      metadata.forEach { (key, value) ->
        meta.put(key, when (value) {
          null -> JSONObject.NULL
          is Boolean, is Number, is String -> value
          else -> value.toString()
        })
      }
      next.put("metadata", meta)
    }

    val previous = guardianAlertsJson()
    val compact = JSONArray().put(next)
    for (index in 0 until minOf(previous.length(), MAX_GUARDIAN_ALERTS - 1)) {
      compact.put(previous.optJSONObject(index))
    }
    preferences.edit().putString(KEY_GUARDIAN_ALERTS, compact.toString()).apply()
  }

  fun getGuardianAlerts(): List<Map<String, Any?>> {
    val alerts = guardianAlertsJson()
    return (0 until alerts.length()).mapNotNull { index ->
      val item = alerts.optJSONObject(index) ?: return@mapNotNull null
      mapOf(
        "id" to item.optString("id"),
        "eventType" to item.optString("eventType"),
        "severity" to item.optString("severity"),
        "subject" to item.optString("subject"),
        "action" to item.optString("action"),
        "timestamp" to item.optLong("timestamp"),
        "cleared" to item.optBoolean("cleared", false),
        "metadata" to item.optJSONObject("metadata")?.toString()
      )
    }
  }

  fun clearGuardianAlert(alertId: String) {
    val alerts = guardianAlertsJson()
    val next = JSONArray()
    for (index in 0 until alerts.length()) {
      val item = alerts.optJSONObject(index) ?: continue
      if (item.optString("id") == alertId) {
        item.put("cleared", true)
      }
      next.put(item)
    }
    preferences.edit().putString(KEY_GUARDIAN_ALERTS, next.toString()).apply()
  }

  fun focusPolicySnapshot(): Map<String, Any?> = mapOf(
    "strictModeEnabled" to isStrictModeEnabled(),
    "focusModeEnabled" to isFocusModeEnabled(),
    "nightModeEnabled" to isNightModeEnabled(),
    "packageSuspensionEnabled" to isPackageSuspensionEnabled(),
    "schedules" to focusScheduleMaps(),
    "allowedPackages" to focusAllowedPackages().toList().sorted(),
    "blockedPackages" to blockedAppPackages().toList().sorted()
  )

  fun focusStateSnapshot(context: Context): Map<String, Any?> {
    val active = isFocusActive()
    val allowedPackages = allowedPackagesDuringFocus(context).toList().sorted()
    val suspendedPackages = lastSuspendedPackages().toList().sorted()

    return mapOf(
      "active" to active,
      "strictModeActive" to isStrictModeEnabled(),
      "nightModeActive" to isNightModeActive(),
      "activeScheduleId" to activeFocusScheduleId(),
      "allowedPackages" to allowedPackages,
      "blockedPackages" to blockedAppPackages().toList().sorted(),
      "suspendedPackages" to suspendedPackages,
      "suspendedPackageCount" to suspendedPackages.size
    )
  }

  fun usageLimitPolicySnapshot(context: Context): Map<String, Any?> {
    return mapOf(
      "enabled" to isUsageLimitsEnabled(),
      "appLimits" to appUsageLimitMinutes(),
      "categoryLimits" to categoryUsageLimitMinutes(),
      "trackedApps" to AppUsageLimiter(context, this).trackedAppSnapshots()
    )
  }

  fun updateUsageLimitPolicy(policy: Map<String, Any?>): Map<String, Any?> {
    val suppliedPin = (policy["adminPin"] ?: policy["currentPin"]) as? String ?: ""
    assertCanChangePolicy(suppliedPin)

    val editor = preferences.edit()
    policy.booleanOrNull(KEY_USAGE_LIMITS_ENABLED)?.let { editor.putBoolean(KEY_USAGE_LIMITS_ENABLED, it) }
    normalizeStringIntMap(policy["appLimits"])?.let {
      editor.putString(KEY_USAGE_APP_LIMITS, JSONObject(it).toString())
    }
    normalizeStringIntMap(policy["categoryLimits"])?.let {
      editor.putString(KEY_USAGE_CATEGORY_LIMITS, JSONObject(it).toString())
    }
    editor.apply()

    recordAuditEvent(
      eventType = "USAGE_LIMIT_POLICY_CHANGED",
      severity = "high",
      category = "usage_limits",
      subject = "daily_usage_limits",
      action = "updated"
    )

    return usageLimitPolicySnapshot(appContext)
  }

  fun isUsageLimitsEnabled(): Boolean = preferences.getBoolean(KEY_USAGE_LIMITS_ENABLED, false)

  fun isNotificationFilteringEnabled(): Boolean = preferences.getBoolean(KEY_NOTIFICATION_FILTERING_ENABLED, false)

  fun setNotificationFilteringEnabled(enabled: Boolean, pin: String? = null) {
    assertCanChangePolicy(pin)
    preferences.edit().putBoolean(KEY_NOTIFICATION_FILTERING_ENABLED, enabled).apply()
    recordAuditEvent(
      eventType = "NOTIFICATION_FILTERING_CHANGED",
      severity = if (enabled) "high" else "medium",
      category = "notification_filter",
      subject = "notification_filtering",
      action = if (enabled) "enabled" else "disabled"
    )
  }

  fun isNotificationListenerConnected(): Boolean =
    preferences.getBoolean(KEY_NOTIFICATION_LISTENER_CONNECTED, false)

  fun setNotificationListenerConnected(connected: Boolean) {
    preferences.edit().putBoolean(KEY_NOTIFICATION_LISTENER_CONNECTED, connected).apply()
  }

  fun notificationFilterStatus(): Map<String, Any?> = mapOf(
    "enabled" to isNotificationFilteringEnabled(),
    "listenerConnected" to isNotificationListenerConnected(),
    "monitoredPackageCount" to ContentNotificationListener.MONITORED_PACKAGES.size,
    "monitoredPackages" to ContentNotificationListener.MONITORED_PACKAGES.toList().sorted()
  )

  fun appUsageLimitMinutes(): Map<String, Int> = stringIntMap(KEY_USAGE_APP_LIMITS)

  fun categoryUsageLimitMinutes(): Map<String, Int> = stringIntMap(KEY_USAGE_CATEGORY_LIMITS)

  fun updateFocusPolicy(policy: Map<String, Any?>) {
    val suppliedPin = (policy["adminPin"] ?: policy["currentPin"]) as? String ?: ""
    assertCanChangePolicy(suppliedPin)

    val editor = preferences.edit()
    policy.booleanOrNull(KEY_FOCUS_MODE_ENABLED)?.let { editor.putBoolean(KEY_FOCUS_MODE_ENABLED, it) }
    policy.booleanOrNull(KEY_PACKAGE_SUSPENSION_ENABLED)?.let {
      editor.putBoolean(KEY_PACKAGE_SUSPENSION_ENABLED, it)
    }
    normalizePackageSet(policy["allowedPackages"])?.let {
      editor.putStringSet(KEY_FOCUS_ALLOWED_PACKAGES, it)
    }
    normalizePackageSet(policy["blockedPackages"])?.let {
      editor.putStringSet(KEY_BLOCKED_APP_PACKAGES, it)
    }
    normalizeScheduleArray(policy["schedules"])?.let {
      editor.putString(KEY_FOCUS_SCHEDULES, it.toString())
    }
    editor.apply()
  }

  fun isFocusModeEnabled(): Boolean = preferences.getBoolean(KEY_FOCUS_MODE_ENABLED, false)

  fun isNightModeEnabled(): Boolean = preferences.getBoolean(KEY_NIGHT_MODE_ENABLED, true)

  fun isPackageSuspensionEnabled(): Boolean = preferences.getBoolean(KEY_PACKAGE_SUSPENSION_ENABLED, false)

  fun setPackageSuspensionEnabled(enabled: Boolean, pin: String? = null) {
    assertCanChangePolicy(pin)
    preferences.edit().putBoolean(KEY_PACKAGE_SUSPENSION_ENABLED, enabled).apply()
  }

  fun isEmergencyLockEnabled(): Boolean = preferences.getBoolean(KEY_EMERGENCY_LOCK_ENABLED, false)

  fun setEmergencyLockEnabled(enabled: Boolean, pin: String? = null) {
    assertCanChangePolicy(pin)
    preferences.edit().putBoolean(KEY_EMERGENCY_LOCK_ENABLED, enabled).apply()
    recordAuditEvent(
      eventType = "EMERGENCY_LOCK_CHANGED",
      severity = if (enabled) "critical" else "high",
      category = "policy",
      subject = "emergency_lock",
      action = if (enabled) "enabled" else "disabled"
    )
  }

  fun isAlwaysOnVpnLockdownEnabled(): Boolean = preferences.getBoolean(KEY_ALWAYS_ON_VPN_LOCKDOWN, false)

  fun setAlwaysOnVpnLockdownEnabled(enabled: Boolean, pin: String? = null) {
    assertCanChangePolicy(pin)
    preferences.edit().putBoolean(KEY_ALWAYS_ON_VPN_LOCKDOWN, enabled).apply()
  }

  fun uninstallLockStartedAt(): Long = preferences.getLong(KEY_UNINSTALL_LOCK_STARTED_AT, 0L)

  fun uninstallLockExpiresAt(): Long = preferences.getLong(KEY_UNINSTALL_LOCK_EXPIRES_AT, 0L)

  fun uninstallLockDurationDays(): Int =
    preferences.getInt(KEY_UNINSTALL_LOCK_DURATION_DAYS, DEFAULT_UNINSTALL_LOCK_DAYS)
      .coerceIn(MIN_UNINSTALL_LOCK_DAYS, MAX_UNINSTALL_LOCK_DAYS)

  fun isUninstallLockWindowActive(now: Long = System.currentTimeMillis()): Boolean =
    uninstallLockExpiresAt() > now

  fun uninstallLockRemainingMs(now: Long = System.currentTimeMillis()): Long =
    (uninstallLockExpiresAt() - now).coerceAtLeast(0L)

  fun setUninstallLockWindow(durationDays: Int, now: Long = System.currentTimeMillis()): Long {
    val normalizedDays = durationDays.coerceIn(MIN_UNINSTALL_LOCK_DAYS, MAX_UNINSTALL_LOCK_DAYS)
    val expiresAt = now + normalizedDays.toLong() * UNINSTALL_LOCK_DAY_MS
    preferences.edit()
      .putLong(KEY_UNINSTALL_LOCK_STARTED_AT, now)
      .putLong(KEY_UNINSTALL_LOCK_EXPIRES_AT, expiresAt)
      .putInt(KEY_UNINSTALL_LOCK_DURATION_DAYS, normalizedDays)
      .apply()
    return expiresAt
  }

  fun clearUninstallLockWindow() {
    preferences.edit()
      .remove(KEY_UNINSTALL_LOCK_STARTED_AT)
      .remove(KEY_UNINSTALL_LOCK_EXPIRES_AT)
      .apply()
  }

  fun focusAllowedPackages(): Set<String> = getSet(KEY_FOCUS_ALLOWED_PACKAGES)

  fun blockedAppPackages(): Set<String> = getSet(KEY_BLOCKED_APP_PACKAGES)

  fun shouldBlockPackageAsApp(packageName: String): Boolean {
    return shouldBlockPackageAsApp(packageName, packageName)
  }

  fun shouldBlockPackageAsApp(packageName: String, label: String): Boolean {
    val normalized = packageName.trim().lowercase()
    if (normalized.isBlank()) return false
    if (blockedAppPackages().contains(normalized)) return true

    val rule = AppRuleEngine.matchPackage(appContext, normalized, label)
    if (AppRuleEngine.shouldBlock(rule, isStrictModeEnabled())) return true
    if (rule?.category in setOf("vpn_proxy_tor", "vpn", "proxy", "tor") && (isBlockVpnAppsEnabled() || isBlockBypassToolsEnabled())) return true
    if (isBlockPrivateBrowsersEnabled() && AppInventory.isPrivateBrowser(normalized, label)) return true
    if (rule?.category in setOf("apk_store", "app_cloner_vault", "app_cloner", "hidden_vault") && isBlockBypassToolsEnabled()) return true
    return false
  }

  fun shouldBlockPackageForFocus(context: Context, packageName: String): Boolean {
    if (!isAppAllowlistActive()) return false
    val normalized = packageName.trim().lowercase()
    return normalized.isNotBlank() && !allowedPackagesDuringFocus(context).contains(normalized)
  }

  fun allowedPackagesDuringFocus(context: Context): Set<String> {
    return focusAllowedPackages() + AppInventory.essentialPackageNames(context)
  }

  fun isFocusActive(calendar: Calendar = Calendar.getInstance()): Boolean {
    if (!isFocusModeEnabled() && !isNightModeEnabled()) return false
    if (isNightModeActive(calendar)) return true
    if (!isFocusModeEnabled()) return false
    val schedules = focusSchedulesJson()

    for (index in 0 until schedules.length()) {
      val schedule = schedules.optJSONObject(index) ?: continue
      if (isScheduleActive(schedule, calendar)) return true
    }

    return false
  }

  fun isAppAllowlistActive(calendar: Calendar = Calendar.getInstance()): Boolean =
    isStrictModeEnabled() || isFocusActive(calendar)

  fun isNightModeActive(calendar: Calendar = Calendar.getInstance()): Boolean {
    if (!isNightModeEnabled()) return false
    val currentMinutes = calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)
    return currentMinutes >= DEFAULT_BEDTIME_START_MINUTES || currentMinutes < DEFAULT_WAKE_MINUTES
  }

  fun activeFocusScheduleId(calendar: Calendar = Calendar.getInstance()): String? {
    if (isNightModeActive(calendar)) return "night-mode"
    if (!isFocusModeEnabled()) return null
    val schedules = focusSchedulesJson()

    for (index in 0 until schedules.length()) {
      val schedule = schedules.optJSONObject(index) ?: continue
      if (isScheduleActive(schedule, calendar)) {
        return schedule.optString("id").takeUnless { it.isBlank() }
      }
    }

    return null
  }

  fun lastSuspendedPackages(): Set<String> = getSet(KEY_LAST_SUSPENDED_PACKAGES)

  fun setLastSuspendedPackages(packages: Set<String>) {
    putSet(KEY_LAST_SUSPENDED_PACKAGES, packages.map { it.trim().lowercase() }.filter { it.isNotBlank() }.toSet())
  }

  private fun setPin(pin: String) {
    val salt = randomSalt()
    preferences.edit()
      .putString(KEY_PIN_SALT, salt)
      .putString(KEY_PIN_HASH, pbkdf2(pin, salt, DEFAULT_PIN_ITERATIONS))
      .putString(KEY_PIN_ALGORITHM, PIN_ALGORITHM_PBKDF2)
      .putInt(KEY_PIN_ITERATIONS, DEFAULT_PIN_ITERATIONS)
      .apply()
  }

  private fun getSet(key: String): Set<String> {
    return preferences.getStringSet(key, emptySet())?.toSet() ?: emptySet()
  }

  private fun putSet(key: String, values: Set<String>) {
    preferences.edit().putStringSet(key, values).apply()
  }

  private fun normalizeDomain(domain: String): String {
    val host = domain.trim()
      .lowercase()
      .removePrefix("http://")
      .removePrefix("https://")
      .substringBefore("/")
      .substringBefore("?")
      .substringBefore("#")
      .trim('.')

    val withoutPort = if (host.startsWith("[")) {
      host.substringAfter("[").substringBefore("]")
    } else {
      host.substringBefore(":")
    }

    return runCatching { IDN.toASCII(withoutPort) }
      .getOrDefault(withoutPort)
      .lowercase()
      .trim('.')
  }

  private fun isValidDomainRule(domain: String): Boolean {
    if (domain.isBlank() || domain.length > 253 || !domain.contains('.')) return false
    if (domain.any { it.isWhitespace() || it == '/' || it == ':' }) return false
    return domain.split('.').all { label ->
      label.isNotBlank() &&
        label.length <= 63 &&
        label.first() != '-' &&
        label.last() != '-' &&
        label.all { it.isLetterOrDigit() || it == '-' || it == '_' }
    }
  }

  private fun Map<String, Any?>.booleanOrNull(key: String): Boolean? = this[key] as? Boolean

  private fun Map<String, Any?>.intOrNull(key: String): Int? = when (val value = this[key]) {
    is Int -> value
    is Double -> value.toInt()
    is Float -> value.toInt()
    is Long -> value.toInt()
    else -> null
  }

  private fun Map<String, Any?>.stringOrNull(key: String): String? = this[key] as? String

  private fun normalizePackageSet(value: Any?): Set<String>? {
    val list = value as? List<*> ?: return null
    return list
      .mapNotNull { it as? String }
      .map { it.trim().lowercase() }
      .filter { it.isNotBlank() }
      .toSet()
  }

  private fun normalizeStringIntMap(value: Any?): Map<String, Int>? {
    val map = value as? Map<*, *> ?: return null
    return map.entries
      .mapNotNull { entry ->
        val key = (entry.key as? String)?.trim()?.lowercase().orEmpty()
        val minutes = when (val raw = entry.value) {
          is Int -> raw
          is Double -> raw.toInt()
          is Float -> raw.toInt()
          is Long -> raw.toInt()
          else -> null
        }?.coerceIn(0, MAX_USAGE_LIMIT_MINUTES) ?: return@mapNotNull null
        if (key.isBlank() || minutes <= 0) return@mapNotNull null
        key to minutes
      }
      .toMap()
  }

  private fun stringIntMap(key: String): Map<String, Int> {
    val raw = preferences.getString(key, null) ?: return emptyMap()
    val json = try {
      JSONObject(raw)
    } catch (_: Exception) {
      return emptyMap()
    }
    val result = mutableMapOf<String, Int>()
    val keys = json.keys()
    while (keys.hasNext()) {
      val rawKey = keys.next()
      val nextKey = rawKey.trim().lowercase()
      val minutes = json.optInt(rawKey, 0).coerceIn(0, MAX_USAGE_LIMIT_MINUTES)
      if (nextKey.isNotBlank() && minutes > 0) {
        result[nextKey] = minutes
      }
    }
    return result
  }

  private fun normalizeScheduleArray(value: Any?): JSONArray? {
    val list = value as? List<*> ?: return null
    val schedules = JSONArray()

    list.forEachIndexed { index, item ->
      val map = item as? Map<*, *> ?: return@forEachIndexed
      val id = (map["id"] as? String)?.trim().takeUnless { it.isNullOrBlank() } ?: "schedule-$index"
      val label = (map["label"] as? String)?.trim().takeUnless { it.isNullOrBlank() } ?: "Focus schedule"
      val startMinutes = (map["startMinutes"] as? Number)?.toInt()?.coerceIn(0, MINUTES_PER_DAY - 1) ?: 0
      val endMinutes = (map["endMinutes"] as? Number)?.toInt()?.coerceIn(0, MINUTES_PER_DAY - 1) ?: 0
      val days = (map["daysOfWeek"] as? List<*>)
        ?.mapNotNull { (it as? Number)?.toInt() }
        ?.filter { it in 1..7 }
        ?.distinct()
        ?.takeUnless { it.isEmpty() }
        ?: (1..7).toList()

      schedules.put(
        JSONObject()
          .put("id", id)
          .put("label", label)
          .put("enabled", map["enabled"] as? Boolean ?: true)
          .put("startMinutes", startMinutes)
          .put("endMinutes", endMinutes)
          .put("daysOfWeek", JSONArray(days))
      )
    }

    return schedules
  }

  private fun focusScheduleMaps(): List<Map<String, Any?>> {
    val schedules = focusSchedulesJson()
    return (0 until schedules.length()).mapNotNull { index ->
      val item = schedules.optJSONObject(index) ?: return@mapNotNull null
      mapOf(
        "id" to item.optString("id"),
        "label" to item.optString("label"),
        "enabled" to item.optBoolean("enabled", true),
        "startMinutes" to item.optInt("startMinutes"),
        "endMinutes" to item.optInt("endMinutes"),
        "daysOfWeek" to jsonIntList(item.optJSONArray("daysOfWeek"))
      )
    }
  }

  private fun focusSchedulesJson(): JSONArray {
    val raw = preferences.getString(KEY_FOCUS_SCHEDULES, null)
    val parsed = try {
      if (raw.isNullOrBlank()) JSONArray() else JSONArray(raw)
    } catch (_: Exception) {
      JSONArray()
    }
    return if (parsed.length() > 0) parsed else JSONArray().put(defaultFocusSchedule())
  }

  private fun defaultFocusSchedule(): JSONObject {
    return JSONObject()
      .put("id", "daily-night-focus")
      .put("label", "Daily night focus")
      .put("enabled", true)
      .put("startMinutes", DEFAULT_BEDTIME_START_MINUTES)
      .put("endMinutes", 6 * 60)
      .put("daysOfWeek", JSONArray((1..7).toList()))
  }

  private fun isScheduleActive(schedule: JSONObject, calendar: Calendar): Boolean {
    if (!schedule.optBoolean("enabled", true)) return false

    val startMinutes = schedule.optInt("startMinutes", 0).coerceIn(0, MINUTES_PER_DAY - 1)
    val endMinutes = schedule.optInt("endMinutes", 0).coerceIn(0, MINUTES_PER_DAY - 1)
    if (startMinutes == endMinutes) return false

    val currentMinutes = calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)
    val currentDay = mondayBasedDay(calendar)
    val previousDay = if (currentDay == 1) 7 else currentDay - 1
    val days = jsonIntList(schedule.optJSONArray("daysOfWeek")).takeUnless { it.isEmpty() } ?: (1..7).toList()

    return if (startMinutes < endMinutes) {
      currentDay in days && currentMinutes in startMinutes until endMinutes
    } else {
      (currentMinutes >= startMinutes && currentDay in days) ||
        (currentMinutes < endMinutes && previousDay in days)
    }
  }

  private fun mondayBasedDay(calendar: Calendar): Int {
    return when (calendar.get(Calendar.DAY_OF_WEEK)) {
      Calendar.MONDAY -> 1
      Calendar.TUESDAY -> 2
      Calendar.WEDNESDAY -> 3
      Calendar.THURSDAY -> 4
      Calendar.FRIDAY -> 5
      Calendar.SATURDAY -> 6
      else -> 7
    }
  }

  private fun jsonIntList(array: JSONArray?): List<Int> {
    if (array == null) return emptyList()
    return (0 until array.length()).mapNotNull { index ->
      array.optInt(index).takeIf { it in 1..7 }
    }
  }

  private fun auditEventsJson(): JSONArray {
    return try {
      JSONArray(preferences.getString(KEY_AUDIT_EVENTS, "[]") ?: "[]")
    } catch (_: Exception) {
      JSONArray()
    }
  }

  private fun guardianAlertsJson(): JSONArray {
    return try {
      JSONArray(preferences.getString(KEY_GUARDIAN_ALERTS, "[]") ?: "[]")
    } catch (_: Exception) {
      JSONArray()
    }
  }

  private fun sha256(value: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
    return digest.joinToString(separator = "") { byte -> "%02x".format(byte) }
  }

  fun signatureBaseline(): String? = preferences.getString(KEY_SIGNATURE_BASELINE, null)

  fun setSignatureBaseline(signatureHash: String) {
    if (signatureHash.isBlank() || signatureBaseline() != null) return
    preferences.edit().putString(KEY_SIGNATURE_BASELINE, signatureHash).apply()
  }

  fun setIntegrityCheckState(status: String, message: String? = null) {
    preferences.edit()
      .putString(KEY_LAST_INTEGRITY_STATUS, status)
      .putString(KEY_LAST_INTEGRITY_MESSAGE, message.orEmpty().take(180))
      .putLong(KEY_LAST_INTEGRITY_CHECK_AT, System.currentTimeMillis())
      .apply()
  }

  fun integrityCheckState(): Map<String, Any?> = mapOf(
    "lastStatus" to preferences.getString(KEY_LAST_INTEGRITY_STATUS, "not_run"),
    "lastMessage" to preferences.getString(KEY_LAST_INTEGRITY_MESSAGE, ""),
    "lastCheckedAt" to preferences.getLong(KEY_LAST_INTEGRITY_CHECK_AT, 0L),
    "signatureBaselineStored" to (signatureBaseline() != null),
    "serverVerificationRequired" to true
  )

  private fun migratePolicyIfNeeded() {
    val version = preferences.getInt(KEY_POLICY_SCHEMA_VERSION, 0)
    if (version >= CURRENT_POLICY_SCHEMA_VERSION) return

    val editor = preferences.edit()
    if (version < 1 && isPinConfigured() && preferences.getString(KEY_PIN_ALGORITHM, null) == null) {
      editor.putString(KEY_PIN_ALGORITHM, PIN_ALGORITHM_LEGACY_SHA256)
    }
    if (version < 3) {
      editor.remove(DEPRECATED_KEY_TRIGGER_HISTORY)
      editor.remove(DEPRECATED_KEY_LAST_BEHAVIOR_EVENT_ID)
    }
    editor.putInt(KEY_POLICY_SCHEMA_VERSION, CURRENT_POLICY_SCHEMA_VERSION).apply()
  }

  private fun pbkdf2(pin: String, salt: String, iterations: Int): String {
    val factory = try {
      SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
    } catch (_: Exception) {
      SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1")
    }
    val spec = PBEKeySpec(pin.toCharArray(), salt.toByteArray(Charsets.UTF_8), iterations, PIN_KEY_LENGTH_BITS)
    return Base64.encodeToString(factory.generateSecret(spec).encoded, Base64.NO_WRAP)
  }

  private fun randomSalt(): String {
    val bytes = ByteArray(24)
    SecureRandom().nextBytes(bytes)
    return Base64.encodeToString(bytes, Base64.NO_WRAP)
  }

  private fun constantTimeEquals(left: String, right: String): Boolean =
    MessageDigest.isEqual(left.toByteArray(Charsets.UTF_8), right.toByteArray(Charsets.UTF_8))

  private fun createPreferences(context: Context): SharedPreferences {
    return try {
      val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()
      EncryptedSharedPreferences.create(
        context,
        PREFS_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
      )
    } catch (_: Exception) {
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
  }

  companion object {
    private const val PREFS_NAME = "blocker_policy"
    private const val CURRENT_POLICY_SCHEMA_VERSION = 4
    private const val KEY_POLICY_SCHEMA_VERSION = "policySchemaVersion"
    private const val KEY_ADULT_FILTERING = "adultFilteringEnabled"
    private const val KEY_PROTECTION_REQUESTED = "protectionRequested"
    private const val KEY_VPN_ACTIVE = "vpnActive"
    private const val KEY_PANIC_UNLOCK_STARTED_AT = "panicUnlockStartedAt"
    private const val KEY_PANIC_UNLOCK_READY_AT = "panicUnlockReadyAt"
    private const val KEY_TAMPERED = "tampered"
    private const val KEY_BLOCKED_DOMAINS = "blockedDomains"
    private const val KEY_ALLOWLISTED_DOMAINS = "allowlistedDomains"
    private const val KEY_LAST_BLOCKLIST_UPDATE = "lastBlocklistUpdate"
    private const val KEY_PIN_SALT = "pinSalt"
    private const val KEY_PIN_HASH = "pinHash"
    private const val KEY_PIN_ALGORITHM = "pinAlgorithm"
    private const val KEY_PIN_ITERATIONS = "pinIterations"
    private const val KEY_FAILED_PIN_ATTEMPTS = "failedPinAttempts"
    private const val KEY_GOOGLE_SAFESEARCH = "googleSafeSearch"
    private const val KEY_BING_SAFESEARCH = "bingSafeSearch"
    private const val KEY_DUCKDUCKGO_SAFESEARCH = "duckDuckGoSafeSearch"
    private const val KEY_YOUTUBE_RESTRICTED = "youtubeRestrictedMode"
    private const val KEY_BLOCK_UNKNOWN_SEARCH = "blockUnknownSearchEngines"
    private const val KEY_BLOCK_VPN_APPS = "blockVpnApps"
    private const val KEY_BLOCK_PRIVATE_BROWSERS = "blockPrivateBrowsers"
    private const val KEY_BLOCK_BYPASS_TOOLS = "blockBypassTools"
    private const val KEY_BLOCK_SIDELOADED_APPS = "blockSideloadedApps"
    private const val KEY_FULL_TUNNEL_VPN_ENABLED = "fullTunnelVpnEnabled"
    private const val KEY_PER_APP_VPN_FILTERING_ENABLED = "perAppVpnFilteringEnabled"
    private const val KEY_IPV6_LEAK_PREVENTION_ENABLED = "ipv6LeakPreventionEnabled"
    private const val KEY_VPN_ALLOWED_PACKAGES = "vpnAllowedPackages"
    private const val KEY_VPN_EXCLUDED_PACKAGES = "vpnExcludedPackages"
    private const val KEY_HTTPS_INSPECTION_ENABLED = "httpsInspectionEnabled"
    private const val KEY_HTTPS_INSPECTION_PRIVACY_ACKNOWLEDGED = "httpsInspectionPrivacyAcknowledged"
    private const val KEY_CLOUD_IMAGE_FALLBACK_ENABLED = "cloudImageFallbackEnabled"
    private const val KEY_CLOUD_IMAGE_FALLBACK_ENDPOINT = "cloudImageFallbackEndpoint"
    private const val KEY_SCREENSHOT_AUDIT_ENABLED = "screenshotAuditEnabled"
    private const val KEY_SCREENSHOT_AUDIT_INTERVAL_MINUTES = "screenshotAuditIntervalMinutes"
    private const val KEY_STRICT_MODE_ENABLED = "strictModeEnabled"
    private const val KEY_FOCUS_MODE_ENABLED = "focusModeEnabled"
    private const val KEY_NIGHT_MODE_ENABLED = "nightModeEnabled"
    private const val KEY_PACKAGE_SUSPENSION_ENABLED = "packageSuspensionEnabled"
    private const val KEY_ALWAYS_ON_VPN_LOCKDOWN = "alwaysOnVpnLockdown"
    private const val KEY_EMERGENCY_LOCK_ENABLED = "emergencyLockEnabled"
    private const val KEY_UNINSTALL_LOCK_STARTED_AT = "uninstallLockStartedAt"
    private const val KEY_UNINSTALL_LOCK_EXPIRES_AT = "uninstallLockExpiresAt"
    private const val KEY_UNINSTALL_LOCK_DURATION_DAYS = "uninstallLockDurationDays"
    private const val KEY_FOCUS_SCHEDULES = "focusSchedules"
    private const val KEY_FOCUS_ALLOWED_PACKAGES = "focusAllowedPackages"
    private const val KEY_BLOCKED_APP_PACKAGES = "blockedAppPackages"
    private const val KEY_USAGE_LIMITS_ENABLED = "usageLimitsEnabled"
    private const val KEY_USAGE_APP_LIMITS = "usageAppLimits"
    private const val KEY_USAGE_CATEGORY_LIMITS = "usageCategoryLimits"
    private const val KEY_LAST_SUSPENDED_PACKAGES = "lastSuspendedPackages"
    private const val KEY_LAST_EVENT_DOMAIN = "lastEventDomain"
    private const val KEY_LAST_EVENT_CATEGORY = "lastEventCategory"
    private const val KEY_LAST_EVENT_ACTION = "lastEventAction"
    private const val KEY_LAST_EVENT_TIMESTAMP = "lastEventTimestamp"
    private const val KEY_CUSTOM_BLOCKED_KEYWORDS = "customBlockedKeywords"
    private const val KEY_BEHAVIOR_PROTECTION_ENABLED = "behaviorProtectionEnabled"
    private const val KEY_BEHAVIOR_BLOCK_DURATION_SECONDS = "behaviorBlockDurationSeconds"
    private const val KEY_BEHAVIOR_BLOCK_REQUIRES_PIN = "behaviorBlockRequiresPin"
    private const val KEY_BEHAVIOR_DISABLE_COOLDOWN_DAYS = "behaviorDisableCooldownDays"
    private const val KEY_FEATURE_INSTAGRAM_DM = "instagramDm"
    private const val KEY_FEATURE_INSTAGRAM_STORIES = "instagramStories"
    private const val KEY_FEATURE_INSTAGRAM_SEARCH = "instagramSearch"
    private const val KEY_FEATURE_INSTAGRAM_EXPLORE = "instagramExplore"
    private const val KEY_FEATURE_INSTAGRAM_REELS = "instagramReels"
    private const val KEY_FEATURE_TIKTOK_SHORTS = "tiktokShorts"
    private const val KEY_FEATURE_TIKTOK_SEARCH = "tiktokSearch"
    private const val KEY_FEATURE_YOUTUBE_SEARCH = "youtubeSearch"
    private const val KEY_FEATURE_YOUTUBE_SHORTS = "youtubeShorts"
    private const val KEY_FEATURE_YOUTUBE_COMMENTS = "youtubeComments"
    private const val KEY_FEATURE_PICTURE_IN_PICTURE = "pictureInPicture"
    private const val KEY_FEATURE_TELEGRAM_SEARCH = "telegramSearch"
    private const val KEY_FEATURE_TELEGRAM_SEARCH_HISTORY = "telegramSearchHistory"
    private const val KEY_FEATURE_TELEGRAM_CHANNELS = "telegramChannels"
    private const val KEY_FEATURE_TELEGRAM_GROUPS = "telegramGroups"
    private const val KEY_FEATURE_TELEGRAM_BLOCKED_ACCOUNTS = "telegramBlockedAccounts"
    private const val KEY_FEATURE_SNAPCHAT_QUICK_ADD = "snapchatQuickAdd"
    private const val KEY_FEATURE_SNAPCHAT_SEARCH = "snapchatSearch"
    private const val KEY_FEATURE_SNAPCHAT_DISCOVER = "snapchatDiscover"
    private const val KEY_FEATURE_SNAPCHAT_STORIES = "snapchatStories"
    private const val KEY_FEATURE_SNAPCHAT_SPOTLIGHT = "snapchatSpotlight"
    private const val KEY_FEATURE_SNAPCHAT_MAPS = "snapchatMaps"
    private const val KEY_FEATURE_TWITTER_ERASE_ALL = "twitterEraseAll"
    private const val KEY_FEATURE_TWITTER_BLOCK_APP = "twitterBlockApp"
    private const val KEY_FEATURE_TWITTER_SEARCH_MEDIA_TRENDS = "twitterSearchMediaTrends"
    private const val KEY_FEATURE_TWITTER_FOR_YOU = "twitterForYou"
    private const val KEY_FEATURE_DISCORD_BLOCK_APP = "discordBlockApp"
    private const val KEY_FEATURE_FACEBOOK_BLOCK_APP = "facebookBlockApp"
    private const val KEY_FEATURE_FACEBOOK_REELS = "facebookReels"
    private const val KEY_FEATURE_FACEBOOK_STORIES = "facebookStories"
    private const val KEY_FEATURE_FACEBOOK_SEARCH = "facebookSearch"
    private const val KEY_FEATURE_FACEBOOK_GROUPS = "facebookGroups"
    private const val KEY_FEATURE_REDDIT_SEARCH = "redditSearch"
    private const val KEY_FEATURE_REDDIT_SUBREDDITS = "redditSubreddits"
    private const val KEY_FEATURE_PINTEREST_SEARCH = "pinterestSearch"
    private const val KEY_FEATURE_LIVE_STREAMING_APPS = "liveStreamingApps"
    private const val KEY_FEATURE_BROWSER_UNSAFE_MODES = "browserUnsafeModes"
    private const val KEY_FEATURE_ANDROID_TAMPER_SETTINGS = "androidTamperSettings"
    private const val KEY_FEATURE_PLAY_STORE_UNINSTALL_CONTROLS = "playStoreUninstallControls"
    private const val KEY_FEATURE_PLAY_STORE_ADULT_INSTALL_CONTROLS = "playStoreAdultInstallControls"
    private const val KEY_FEATURE_PACKAGE_INSTALLER_CONTROLS = "packageInstallerControls"
    private const val KEY_CURRENT_CONTEXT_APP = "currentContextApp"
    private const val KEY_CURRENT_CONTEXT_SCREEN = "currentContextScreen"
    private const val KEY_CURRENT_CONTEXT_TIMESTAMP = "currentContextTimestamp"
    private const val KEY_LAST_BOOT_SAFE_MODE = "lastBootWasSafeMode"
    private const val KEY_ACCESSIBILITY_SERVICE_WAS_ENABLED = "accessibilityServiceWasEnabled"
    private const val KEY_AUDIT_EVENTS = "auditEvents"
    private const val KEY_GUARDIAN_ALERTS = "guardianAlerts"
    private const val DEPRECATED_KEY_TRIGGER_HISTORY = "behaviorTriggerHistory"
    private const val DEPRECATED_KEY_LAST_BEHAVIOR_EVENT_ID = "lastBehaviorEventId"
    private const val KEY_SIGNATURE_BASELINE = "signatureBaseline"
    private const val KEY_LAST_INTEGRITY_STATUS = "lastIntegrityStatus"
    private const val KEY_LAST_INTEGRITY_MESSAGE = "lastIntegrityMessage"
    private const val KEY_LAST_INTEGRITY_CHECK_AT = "lastIntegrityCheckAt"
    private const val KEY_NOTIFICATION_FILTERING_ENABLED = "notificationFilteringEnabled"
    private const val KEY_NOTIFICATION_LISTENER_CONNECTED = "notificationListenerConnected"
    private const val MAX_AUDIT_EVENTS = 100
    private const val MAX_GUARDIAN_ALERTS = 100
    private const val MAX_CUSTOM_DOMAIN_IMPORT = 5_000
    private const val MINUTES_PER_DAY = 24 * 60
    private const val DEFAULT_BEDTIME_START_MINUTES = 21 * 60
    private const val DEFAULT_WAKE_MINUTES = 6 * 60
    private const val MAX_USAGE_LIMIT_MINUTES = MINUTES_PER_DAY
    private const val DOMAIN_EVENT_RATE_LIMIT_MS = 30_000L
    private const val PANIC_UNLOCK_DELAY_MS = 30_000L
    private const val UNINSTALL_LOCK_DAY_MS = 24L * 60L * 60L * 1000L
    private const val MIN_UNINSTALL_LOCK_DAYS = 1
    private const val MAX_UNINSTALL_LOCK_DAYS = 365
    private const val DEFAULT_UNINSTALL_LOCK_DAYS = 30
    private const val MIN_SCREENSHOT_AUDIT_INTERVAL_MINUTES = 1
    private const val MAX_SCREENSHOT_AUDIT_INTERVAL_MINUTES = 240
    private const val DEFAULT_SCREENSHOT_AUDIT_INTERVAL_MINUTES = 15
    private const val PIN_ALGORITHM_LEGACY_SHA256 = "sha256_legacy"
    private const val PIN_ALGORITHM_PBKDF2 = "pbkdf2"
    private const val DEFAULT_PIN_ITERATIONS = 120_000
    private const val PIN_KEY_LENGTH_BITS = 256
    private const val HTTPS_INSPECTION_WARNING =
      "HTTPS inspection can expose sensitive browsing data to this app. Enable it only with informed guardian consent."
  }
}
