package com.example.blocker

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

enum class AppRuleAction {
  ALLOW,
  BLOCK_ALWAYS,
  BLOCK_IN_STRICT,
  REVIEW
}

data class AppRule(
  val id: String,
  val category: String,
  val severity: String,
  val action: AppRuleAction,
  val packages: Set<String> = emptySet(),
  val packageMarkers: Set<String> = emptySet(),
  val labelMarkers: Set<String> = emptySet(),
  val appName: String = "",
  val packageName: String = "",
  val defaultAction: String = action.name.lowercase(),
  val strictModeAction: String = action.name.lowercase(),
  val reason: String = "",
  val source: String = "fallback",
  val enabled: Boolean = true
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "packageName" to packageName,
    "appName" to appName,
    "category" to category,
    "riskLevel" to severity,
    "severity" to severity,
    "action" to action.name.lowercase(),
    "defaultAction" to defaultAction,
    "strictModeAction" to strictModeAction,
    "reason" to reason,
    "source" to source,
    "enabled" to enabled,
    "packages" to packages.toList().sorted(),
    "packageMarkers" to packageMarkers.toList().sorted(),
    "labelMarkers" to labelMarkers.toList().sorted()
  )
}

object AppRuleEngine {
  private val fallbackRules: List<AppRule> = listOf(
    AppRule(
      id = "short_video.tiktok",
      category = "short_video",
      severity = "critical",
      action = AppRuleAction.BLOCK_IN_STRICT,
      appName = "TikTok",
      packageName = "com.zhiliaoapp.musically",
      packages = setOf("com.zhiliaoapp.musically", "com.ss.android.ugc.trill", "com.ss.android.ugc.aweme"),
      packageMarkers = setOf("tiktok", "musically", "ss.android.ugc")
    ),
    AppRule(
      id = "social.instagram",
      category = "social_media",
      severity = "high",
      action = AppRuleAction.BLOCK_IN_STRICT,
      appName = "Instagram",
      packageName = "com.instagram.android",
      packages = setOf("com.instagram.android"),
      packageMarkers = setOf("instagram")
    ),
    AppRule(
      id = "social.snapchat",
      category = "social_media",
      severity = "high",
      action = AppRuleAction.BLOCK_IN_STRICT,
      appName = "Snapchat",
      packageName = "com.snapchat.android",
      packages = setOf("com.snapchat.android"),
      packageMarkers = setOf("snapchat")
    ),
    AppRule(
      id = "social.telegram",
      category = "social_media",
      severity = "high",
      action = AppRuleAction.BLOCK_IN_STRICT,
      appName = "Telegram",
      packageName = "org.telegram.messenger",
      packages = setOf("org.telegram.messenger", "org.thunderdog.challegram"),
      packageMarkers = setOf("telegram", "challegram")
    ),
    AppRule(
      id = "social.x_twitter",
      category = "social_media",
      severity = "high",
      action = AppRuleAction.BLOCK_IN_STRICT,
      appName = "X/Twitter",
      packageName = "com.twitter.android",
      packages = setOf("com.twitter.android", "com.x.android"),
      packageMarkers = setOf("twitter.android", "x.android", "xcorp")
    ),
    AppRule(
      id = "social.reddit",
      category = "social_media",
      severity = "high",
      action = AppRuleAction.BLOCK_IN_STRICT,
      appName = "Reddit",
      packageName = "com.reddit.frontpage",
      packages = setOf("com.reddit.frontpage"),
      packageMarkers = setOf("reddit")
    ),
    AppRule(
      id = "social.discord",
      category = "social_media",
      severity = "high",
      action = AppRuleAction.BLOCK_IN_STRICT,
      appName = "Discord",
      packageName = "com.discord",
      packages = setOf("com.discord"),
      packageMarkers = setOf("discord")
    ),
    AppRule(
      id = "social.facebook",
      category = "social_media",
      severity = "medium",
      action = AppRuleAction.BLOCK_IN_STRICT,
      appName = "Facebook",
      packageName = "com.facebook.katana",
      packages = setOf("com.facebook.katana", "com.facebook.lite"),
      packageMarkers = setOf("facebook", "katana")
    ),
    AppRule(
      id = "social.pinterest_tumblr",
      category = "social_media",
      severity = "medium",
      action = AppRuleAction.BLOCK_IN_STRICT,
      appName = "Pinterest/Tumblr",
      packageName = "com.pinterest",
      packages = setOf("com.pinterest", "com.tumblr"),
      packageMarkers = setOf("pinterest", "tumblr")
    ),
    AppRule(
      id = "streaming.live",
      category = "livestream",
      severity = "high",
      action = AppRuleAction.BLOCK_IN_STRICT,
      appName = "Live streaming apps",
      packageName = "tv.twitch.android.app",
      packages = setOf(
        "tv.twitch.android.app",
        "com.kick.mobile",
        "sg.bigo.live",
        "com.younow.live",
        "com.sgiggle.production",
        "com.nimo.tv"
      ),
      packageMarkers = setOf("twitch", "kick", "bigo", "liveme", "younow", "tango", "nimo", "trovo", "nonolive", "afreecatv")
    ),
    AppRule(
      id = "video.youtube",
      category = "short_video",
      severity = "medium",
      action = AppRuleAction.BLOCK_IN_STRICT,
      appName = "YouTube",
      packageName = "com.google.android.youtube",
      packages = setOf("com.google.android.youtube", "com.google.android.apps.youtube.kids"),
      packageMarkers = setOf("youtube")
    ),
    AppRule(
      id = "browser.private",
      category = "private_browser",
      severity = "critical",
      action = AppRuleAction.BLOCK_IN_STRICT,
      appName = "Private browsers",
      packageName = "com.brave.browser",
      packages = setOf(
        "com.brave.browser",
        "com.duckduckgo.mobile.android",
        "org.mozilla.focus",
        "org.mozilla.klar",
        "org.torproject.torbrowser"
      ),
      packageMarkers = setOf(
        "brave.browser",
        "duckduckgo",
        "firefox.focus",
        "mozilla.focus",
        "torbrowser",
        "privatebrowser",
        "incognito"
      ),
      labelMarkers = setOf("private browser", "incognito")
    ),
    AppRule(
      id = "browser.general",
      category = "browser",
      severity = "high",
      action = AppRuleAction.BLOCK_IN_STRICT,
      appName = "General browsers",
      packageName = "com.android.chrome",
      packages = setOf(
        "com.android.chrome",
        "com.microsoft.emmx",
        "org.mozilla.firefox",
        "org.mozilla.fenix",
        "com.opera.browser",
        "com.opera.mini.native",
        "com.opera.gx",
        "com.sec.android.app.sbrowser",
        "com.vivaldi.browser",
        "com.kiwibrowser.browser",
        "com.yandex.browser",
        "com.mi.globalbrowser",
        "com.ucmobile.intl"
      ),
      packageMarkers = setOf(
        "chrome",
        "firefox",
        "fenix",
        "brave",
        "opera",
        "sbrowser",
        "duckduckgo",
        "vivaldi",
        "kiwibrowser",
        "yandex.browser",
        "globalbrowser",
        "ucmobile",
        "browser"
      )
    ),
    AppRule(
      id = "bypass.vpn",
      category = "vpn",
      severity = "critical",
      action = AppRuleAction.BLOCK_ALWAYS,
      appName = "VPN apps",
      packageName = "com.wireguard.android",
      packages = setOf(
        "org.torproject.torbrowser",
        "org.torproject.android",
        "com.cloudflare.onedotonedotonedotone",
        "com.wireguard.android",
        "net.openvpn.openvpn",
        "de.blinkt.openvpn",
        "com.expressvpn.vpn",
        "com.nordvpn.android",
        "com.surfshark.vpnclient.android",
        "com.windscribe.vpn"
      ),
      packageMarkers = setOf("vpn", "proxy", "tor", "doh", "dns", "wireguard", "openvpn", "cloudflare", "warp", "psiphon")
    ),
    AppRule(
      id = "install.apk_stores",
      category = "apk_store",
      severity = "critical",
      action = AppRuleAction.BLOCK_ALWAYS,
      appName = "APK stores and installers",
      packageName = "cm.aptoide.pt",
      packages = setOf(
        "cm.aptoide.pt",
        "com.apkpure.aegon",
        "com.uptodown",
        "com.android.vending.billing.inappbillingservice"
      ),
      packageMarkers = setOf("aptoide", "apkpure", "uptodown", "apk", "fdroid", "f-droid")
    ),
    AppRule(
      id = "bypass.app_cloner",
      category = "app_cloner",
      severity = "critical",
      action = AppRuleAction.BLOCK_ALWAYS,
      appName = "App cloners",
      packageName = "marker:app_cloner",
      packageMarkers = setOf("parallel", "dualspace", "island", "shelter", "clone"),
      labelMarkers = setOf("parallel space", "dual space", "app cloner")
    ),
    AppRule(
      id = "bypass.hidden_vault",
      category = "hidden_vault",
      severity = "critical",
      action = AppRuleAction.BLOCK_ALWAYS,
      appName = "Hidden vault apps",
      packageName = "marker:hidden_vault",
      packageMarkers = setOf("vault", "hide", "calculatorvault", "securefolder"),
      labelMarkers = setOf("vault", "hide app", "secure folder")
    ),
    AppRule(
      id = "social.random_chat",
      category = "random_chat",
      severity = "high",
      action = AppRuleAction.BLOCK_IN_STRICT,
      appName = "Random chat apps",
      packageName = "marker:random_chat",
      packageMarkers = setOf("omegle", "ometv", "azarlive", "holla", "chatroulette"),
      labelMarkers = setOf("random chat", "video chat")
    ),
    AppRule(
      id = "social.dating",
      category = "dating",
      severity = "high",
      action = AppRuleAction.BLOCK_IN_STRICT,
      appName = "Dating apps",
      packageName = "marker:dating",
      packageMarkers = setOf("tinder", "bumble", "hinge", "grindr", "badoo", "meetme", "skout"),
      labelMarkers = setOf("dating")
    ),
    AppRule(
      id = "ai.unsafe_image_chat",
      category = "unsafe_ai",
      severity = "medium",
      action = AppRuleAction.REVIEW,
      appName = "Unsafe AI apps",
      packageName = "marker:unsafe_ai",
      packageMarkers = setOf("characterai", "chatai", "ai.chat", "image.generator", "dream", "waifu", "nsfw"),
      labelMarkers = setOf("ai chat", "image generator", "nsfw", "waifu")
    )
  )

  @Volatile private var cachedAssetRules: List<AppRule>? = null

  val rules: List<AppRule>
    get() = fallbackRules

  fun rules(context: Context): List<AppRule> {
    cachedAssetRules?.let { return it }
    return synchronized(this) {
      cachedAssetRules ?: loadAssetRules(context.applicationContext).also { cachedAssetRules = it }
    }
  }

  fun matchPackage(packageName: String, label: String = packageName): AppRule? =
    matchPackageIn(fallbackRules, packageName, label)

  fun matchPackage(context: Context, packageName: String, label: String = packageName): AppRule? =
    matchPackageIn(rules(context), packageName, label)

  fun shouldBlock(rule: AppRule?, strictModeEnabled: Boolean): Boolean {
    return when (rule?.action) {
      AppRuleAction.BLOCK_ALWAYS -> true
      AppRuleAction.BLOCK_IN_STRICT -> strictModeEnabled
      else -> false
    }
  }

  fun ruleSnapshot(): List<Map<String, Any?>> = fallbackRules.map { it.toMap() }

  fun ruleSnapshot(context: Context): List<Map<String, Any?>> = rules(context).map { it.toMap() }

  private fun matchPackageIn(rules: List<AppRule>, packageName: String, label: String): AppRule? {
    val normalizedPackage = packageName.trim().lowercase()
    val normalizedLabel = label.trim().lowercase()
    if (normalizedPackage.isBlank()) return null

    return rules.firstOrNull { rule ->
      rule.enabled && (
        normalizedPackage in rule.packages ||
          rule.packageMarkers.any { normalizedPackage.contains(it) } ||
          rule.labelMarkers.any { normalizedLabel.contains(it) }
        )
    }
  }

  private fun loadAssetRules(context: Context): List<AppRule> {
    return try {
      val json = context.assets.open("dangerous_app_rules.json").bufferedReader().use { it.readText() }
      val root = JSONObject(json)
      val parsed = parseRules(root.optJSONArray("rules") ?: JSONArray())
      parsed.takeIf { it.isNotEmpty() } ?: fallbackRules
    } catch (_: Exception) {
      fallbackRules
    }
  }

  private fun parseRules(array: JSONArray): List<AppRule> {
    val parsed = mutableListOf<AppRule>()
    for (index in 0 until array.length()) {
      val item = array.optJSONObject(index) ?: continue
      parseRule(item)?.let { parsed.add(it) }
    }
    return parsed
  }

  private fun parseRule(item: JSONObject): AppRule? {
    if (!item.optBoolean("enabled", true)) return null

    val id = item.optString("id").trim()
    if (id.isBlank()) return null

    val packageName = item.optString("packageName").trim().lowercase()
    val packages = jsonStringSet(item.optJSONArray("packages")).toMutableSet()
    if (packageName.isNotBlank() && !packageName.startsWith("marker:")) {
      packages.add(packageName)
    }

    val defaultAction = item.optString("defaultAction", "ASK_GUARDIAN")
    val strictModeAction = item.optString("strictModeAction", "BLOCK")

    return AppRule(
      id = id,
      category = item.optString("category", "unknown_risk").trim().lowercase(),
      severity = item.optString("riskLevel", item.optString("severity", "medium")).trim().lowercase(),
      action = actionFromPolicy(defaultAction, strictModeAction),
      packages = packages,
      packageMarkers = jsonStringSet(item.optJSONArray("packageMarkers")),
      labelMarkers = jsonStringSet(item.optJSONArray("labelMarkers")),
      appName = item.optString("appName"),
      packageName = packageName,
      defaultAction = defaultAction.lowercase(),
      strictModeAction = strictModeAction.lowercase(),
      reason = item.optString("reason"),
      source = item.optString("source", "bundled_policy"),
      enabled = true
    )
  }

  private fun actionFromPolicy(defaultAction: String, strictModeAction: String): AppRuleAction {
    val default = defaultAction.trim().uppercase()
    val strict = strictModeAction.trim().uppercase()
    return when {
      default == "BLOCK" -> AppRuleAction.BLOCK_ALWAYS
      strict == "BLOCK" -> AppRuleAction.BLOCK_IN_STRICT
      default == "ASK_GUARDIAN" -> AppRuleAction.REVIEW
      else -> AppRuleAction.ALLOW
    }
  }

  private fun jsonStringSet(array: JSONArray?): Set<String> {
    if (array == null) return emptySet()
    val values = mutableSetOf<String>()
    for (index in 0 until array.length()) {
      val value = array.optString(index).trim().lowercase()
      if (value.isNotBlank()) values.add(value)
    }
    return values
  }
}
