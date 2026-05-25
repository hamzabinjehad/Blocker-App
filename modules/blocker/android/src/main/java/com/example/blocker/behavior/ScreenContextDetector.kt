package com.example.blocker.behavior

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.example.blocker.PolicyRepository

data class ScreenContext(
  val packageName: String,
  val appLabel: String,
  val screenType: String,
  val visibleText: String,
  val analyzableText: String,
  val source: String
)

data class BlockedFeature(
  val key: String,
  val appName: String,
  val label: String,
  val screen: String
)

object ScreenContextDetector {
  private const val MAX_VISIBLE_CHARS = 1200
  private const val MAX_ANALYZABLE_CHARS = 240
  private const val MAX_NODES = 60

  fun fromAccessibilityEvent(
    service: AccessibilityService,
    event: AccessibilityEvent?
  ): ScreenContext? {
    if (event == null || event.isPassword) return null

    val packageName = event.packageName?.toString() ?: return null
    if (packageName == service.packageName) return null

    val sourceNode = event.source
    if (sourceNode?.isPassword == true) return null

    val eventText = event.text.joinToString(" ") { it.toString() }
    val sourceText = nodeOwnText(sourceNode)
    val visibleText = collectVisibleText(service, service.rootInActiveWindow)
    val combinedVisibleText = compact("$eventText $sourceText $visibleText", MAX_VISIBLE_CHARS)
    val appLabel = resolveAppLabel(service, packageName)
    val screenType = classifyScreen(packageName, combinedVisibleText)
    val sourceDescriptor = compact(
      "${sourceNode?.viewIdResourceName.orEmpty()} ${sourceNode?.className?.toString().orEmpty()} ${sourceNode?.contentDescription?.toString().orEmpty()}",
      240
    )
    val analyzableText = if (isAllowedTextInput(packageName, sourceDescriptor, combinedVisibleText)) {
      compact("$eventText $sourceText", MAX_ANALYZABLE_CHARS)
    } else {
      ""
    }

    if (combinedVisibleText.isBlank() && analyzableText.isBlank()) return null

    return ScreenContext(
      packageName = packageName,
      appLabel = appLabel,
      screenType = screenType,
      visibleText = combinedVisibleText,
      analyzableText = analyzableText,
      source = "accessibility_service"
    )
  }

  fun matchBlockedFeature(
    packageName: String,
    screenText: String,
    featureBlocks: Map<String, Boolean>
  ): BlockedFeature? {
    val text = KeywordMatcher.normalize("$packageName $screenText")
    val app = packageName.lowercase()

    if (isGoogleSearch(app) && text.contains("search")) {
      return BlockedFeature("googleSearch", "Google", "Google Search", "Google Search")
    }

    if (isInstagram(app)) {
      if (featureBlocks["instagramDm"] == true && containsAny(text, "direct", "direct message", "messages", "inbox", "dm")) {
        return BlockedFeature("instagramDm", "Instagram", "Instagram DM", "Instagram DM")
      }
      if (featureBlocks["instagramStories"] == true && containsAny(text, "story", "stories")) {
        return BlockedFeature("instagramStories", "Instagram", "Instagram Stories", "Instagram Stories")
      }
      if (featureBlocks["instagramSearch"] == true && text.contains("search")) {
        return BlockedFeature("instagramSearch", "Instagram", "Instagram Search", "Instagram Search")
      }
      if (featureBlocks["instagramExplore"] == true && text.contains("explore")) {
        return BlockedFeature("instagramExplore", "Instagram", "Instagram Explore", "Instagram Explore")
      }
      if (featureBlocks["instagramReels"] == true && text.contains("reels")) {
        return BlockedFeature("instagramReels", "Instagram", "Instagram Reels", "Instagram Reels")
      }
    }

    if (isTikTok(app)) {
      if (featureBlocks["tiktokSearch"] == true && text.contains("search")) {
        return BlockedFeature("tiktokSearch", "TikTok", "TikTok Search", "TikTok Search")
      }
      if (featureBlocks["tiktokShorts"] == true && (text.contains("shorts") || text.contains("for you"))) {
        return BlockedFeature("tiktokShorts", "TikTok", "TikTok short-form feed", "TikTok feed")
      }
    }

    if (isTelegram(app)) {
      if (featureBlocks["telegramSearch"] == true && text.contains("search")) {
        return BlockedFeature("telegramSearch", "Telegram", "Telegram Search", "Telegram Search")
      }
      if (featureBlocks["telegramSearchHistory"] == true && containsAny(
          text,
          "recent searches",
          "search history",
          "clear search",
          "clear history",
          "recently searched"
        )
      ) {
        return BlockedFeature("telegramSearchHistory", "Telegram", "Telegram Search history", "Telegram Search history")
      }
      if (featureBlocks["telegramChannels"] == true && text.contains("channel")) {
        return BlockedFeature("telegramChannels", "Telegram", "Telegram Channels", "Telegram Channels")
      }
      if (featureBlocks["telegramGroups"] == true && containsAny(text, "group", "groups", "public group")) {
        return BlockedFeature("telegramGroups", "Telegram", "Telegram Groups", "Telegram Groups")
      }
      if (featureBlocks["telegramBlockedAccounts"] == true && containsAny(
          text,
          "blocked users",
          "blocked accounts",
          "block users",
          "blocked contacts"
        )
      ) {
        return BlockedFeature("telegramBlockedAccounts", "Telegram", "Telegram Blocked accounts", "Telegram Blocked accounts")
      }
    }

    if (featureBlocks["pictureInPicture"] == true && isPictureInPictureSurface(app, text)) {
      return BlockedFeature("pictureInPicture", "Picture-in-picture", "Picture-in-picture mode", "Picture-in-picture")
    }

    if (isYoutube(app)) {
      if (featureBlocks["youtubeSearch"] == true && isYoutubeSearchSurface(text)) {
        return BlockedFeature("youtubeSearch", "YouTube", "YouTube Search", "YouTube Search")
      }
      if (featureBlocks["youtubeShorts"] == true && isYoutubeShortsSurface(text)) {
        return BlockedFeature("youtubeShorts", "YouTube", "YouTube Shorts", "YouTube Shorts")
      }
      if (featureBlocks["youtubeComments"] == true && isYoutubeCommentsSurface(text)) {
        return BlockedFeature("youtubeComments", "YouTube", "YouTube Comments", "YouTube Comments")
      }
    }

    if (isSnapchat(app)) {
      if (featureBlocks["snapchatQuickAdd"] == true && text.contains("quick add")) {
        return BlockedFeature("snapchatQuickAdd", "Snapchat", "Snapchat Quick Add", "Snapchat Quick Add")
      }
      if (featureBlocks["snapchatSearch"] == true && text.contains("search")) {
        return BlockedFeature("snapchatSearch", "Snapchat", "Snapchat Search", "Snapchat Search")
      }
      if (featureBlocks["snapchatDiscover"] == true && text.contains("discover")) {
        return BlockedFeature("snapchatDiscover", "Snapchat", "Snapchat Discover", "Snapchat Discover")
      }
      if (featureBlocks["snapchatStories"] == true && containsAny(text, "story", "stories")) {
        return BlockedFeature("snapchatStories", "Snapchat", "Snapchat Stories", "Snapchat Stories")
      }
      if (featureBlocks["snapchatSpotlight"] == true && text.contains("spotlight")) {
        return BlockedFeature("snapchatSpotlight", "Snapchat", "Snapchat Spotlight", "Snapchat Spotlight")
      }
      if (featureBlocks["snapchatMaps"] == true && containsAny(text, "snap map", "maps", "map")) {
        return BlockedFeature("snapchatMaps", "Snapchat", "Snapchat Maps", "Snapchat Maps")
      }
    }

    if (featureBlocks["twitterEraseAll"] == true && (isTwitter(app) || isTwitterSurface(text))) {
      return BlockedFeature("twitterEraseAll", "X/Twitter", "X/Twitter full block", "X/Twitter")
    }

    if (isTwitter(app)) {
      if (featureBlocks["twitterBlockApp"] == true) {
        return BlockedFeature("twitterBlockApp", "X/Twitter", "X/Twitter app", "X/Twitter")
      }
      if (featureBlocks["twitterSearchMediaTrends"] == true && containsAny(
          text,
          "search",
          "explore",
          "trend",
          "trending",
          "video",
          "videos",
          "clip",
          "clips",
          "media",
          "photo",
          "photos",
          "image",
          "images"
        )
      ) {
        return BlockedFeature("twitterSearchMediaTrends", "X/Twitter", "X Search, media, and trends", "X Search and media")
      }
      if (featureBlocks["twitterForYou"] == true && text.contains("for you")) {
        return BlockedFeature("twitterForYou", "X/Twitter", "X For You", "X For You")
      }
    }

    if (featureBlocks["discordBlockApp"] == true && isDiscord(app)) {
      return BlockedFeature("discordBlockApp", "Discord", "Discord app", "Discord")
    }

    if (isFacebook(app)) {
      if (featureBlocks["facebookBlockApp"] == true) {
        return BlockedFeature("facebookBlockApp", "Facebook", "Facebook app", "Facebook")
      }
      if (featureBlocks["facebookReels"] == true && text.contains("reels")) {
        return BlockedFeature("facebookReels", "Facebook", "Facebook Reels", "Facebook Reels")
      }
      if (featureBlocks["facebookStories"] == true && containsAny(text, "story", "stories")) {
        return BlockedFeature("facebookStories", "Facebook", "Facebook Stories", "Facebook Stories")
      }
      if (featureBlocks["facebookSearch"] == true && text.contains("search")) {
        return BlockedFeature("facebookSearch", "Facebook", "Facebook Search", "Facebook Search")
      }
      if (featureBlocks["facebookGroups"] == true && containsAny(text, "group", "groups")) {
        return BlockedFeature("facebookGroups", "Facebook", "Facebook Groups", "Facebook Groups")
      }
    }

    if (featureBlocks["liveStreamingApps"] == true && isLiveStreamingApp(app, text)) {
      return BlockedFeature("liveStreamingApps", "Live streaming", "Live-streaming app", "Live-streaming app")
    }

    if (isReddit(app)) {
      if (featureBlocks["redditSearch"] == true && text.contains("search")) {
        return BlockedFeature("redditSearch", "Reddit", "Reddit Search", "Reddit Search")
      }
      if (featureBlocks["redditSubreddits"] == true && containsAny(text, "subreddit", "community", "communities", "popular")) {
        return BlockedFeature("redditSubreddits", "Reddit", "Reddit communities", "Reddit communities")
      }
    }

    if (isPinterest(app) && featureBlocks["pinterestSearch"] == true && containsAny(text, "search", "explore", "pins")) {
      return BlockedFeature("pinterestSearch", "Pinterest", "Pinterest Search", "Pinterest Search")
    }

    if (featureBlocks["browserUnsafeModes"] == true && isBrowser(app)) {
      if (containsAny(
          text,
          "incognito",
          "private browsing",
          "private tab",
          "private window",
          "new private tab",
          "inprivate",
          "secret mode",
          "secret tab",
          "guest mode",
          "fire button"
        )
      ) {
        return BlockedFeature("browserUnsafeModes", "Browser", "Private or unsafe browsing mode", "Browser unsafe mode")
      }
    }

    if (featureBlocks["androidTamperSettings"] == true && isAndroidSettings(app) && containsAny(
        text,
        "accessibility",
        "vpn",
        "private dns",
        "device admin",
        "device administrator",
        "usage access",
        "draw over other apps",
        "display over other apps",
        "install unknown apps",
        "unknown sources",
        "developer options",
        "usb debugging",
        "battery optimization",
        "app info",
        "uninstall",
        "force stop",
        "storage",
        "clear data"
      )
    ) {
      return BlockedFeature("androidTamperSettings", "Android Settings", "Protection settings", "Android protection settings")
    }

    if (featureBlocks["playStoreUninstallControls"] == true && isPlayStore(app) && containsAny(
        text,
        "uninstall",
        "remove",
        "manage apps",
        "installed",
        "parent blocker",
        "com.example.parentblocker"
      )
    ) {
      return BlockedFeature("playStoreUninstallControls", "Google Play", "Play Store uninstall controls", "Play Store uninstall")
    }

    if (featureBlocks["playStoreAdultInstallControls"] == true && isPlayStore(app) && isAdultPlayStoreInstallSurface(text)) {
      return BlockedFeature(
        "playStoreAdultInstallControls",
        "Google Play",
        "Adult-rated app install",
        "Play Store app rating"
      )
    }

    if (featureBlocks["packageInstallerControls"] == true && isPackageInstaller(app) && containsAny(
        text,
        "install",
        "package installer",
        "apk",
        "unknown app",
        "unknown source",
        "install unknown apps",
        "browser",
        "private browser",
        "vpn",
        "proxy",
        "tor",
        "enable"
      )
    ) {
      return BlockedFeature("packageInstallerControls", "Package installer", "APK install prompt", "Package install")
    }

    return null
  }

  fun matchStrictTamperSurface(packageName: String, screenText: String): BlockedFeature? {
    val app = packageName.lowercase()
    val text = KeywordMatcher.normalize("$packageName $screenText")

    if (isAndroidSettings(app) && containsAny(
        text,
        "accessibility",
        "vpn",
        "private dns",
        "dns",
        "device admin",
        "device administrator",
        "install unknown apps",
        "unknown sources",
        "developer options",
        "usb debugging",
        "battery optimization",
        "unrestricted battery",
        "app info",
        "uninstall",
        "force stop",
        "storage",
        "clear data",
        "users",
        "guest",
        "multiple users",
        "factory reset"
      )
    ) {
      return BlockedFeature("strictTamperSettings", "Android Settings", "Protection settings", "Android tamper settings")
    }

    if ((isPackageInstaller(app) || isPlayStore(app)) && containsAny(
        text,
      "install",
      "update",
      "unknown app",
      "unknown source",
      "install unknown apps",
      "apk",
      "browser",
      "private browser",
      "vpn",
      "proxy",
      "tor",
      "open",
      "enable"
    )
    ) {
      return BlockedFeature("strictInstallSurface", "App install", "App install or update", "Package install")
    }

    if (isReddit(app) && containsAny(text, "search", "popular", "communities", "nsfw", "reddit")) {
      return BlockedFeature("strictReddit", "Reddit", "Reddit search/community surface", "Reddit")
    }

    if (isPinterest(app) && containsAny(text, "search", "explore", "pins", "images")) {
      return BlockedFeature("strictPinterest", "Pinterest", "Pinterest search/image surface", "Pinterest")
    }

    return null
  }

  private fun classifyScreen(packageName: String, text: String): String {
    val app = packageName.lowercase()
    val normalized = KeywordMatcher.normalize(text)
    return when {
      isInstagram(app) && normalized.contains("reels") -> "Instagram Reels"
      isInstagram(app) && normalized.contains("explore") -> "Instagram Explore"
      isInstagram(app) && normalized.contains("search") -> "Instagram Search"
      isInstagram(app) && containsAny(normalized, "direct", "messages", "inbox", "dm") -> "Instagram DM"
      isInstagram(app) && containsAny(normalized, "story", "stories") -> "Instagram Stories"
      isTikTok(app) && normalized.contains("search") -> "TikTok Search"
      isTikTok(app) && normalized.contains("for you") -> "TikTok feed"
      isYoutube(app) && isPictureInPictureSurface(app, normalized) -> "Picture-in-picture"
      isYoutube(app) && isYoutubeShortsSurface(normalized) -> "YouTube Shorts"
      isYoutube(app) && isYoutubeCommentsSurface(normalized) -> "YouTube Comments"
      isTwitter(app) && normalized.contains("for you") -> "X For You"
      isTwitter(app) && containsAny(normalized, "search", "explore", "trend", "trending") -> "X Search and trends"
      isTwitter(app) && containsAny(normalized, "video", "videos", "clip", "clips", "media", "photo", "photos") -> "X media"
      isTelegram(app) && normalized.contains("search") -> "Telegram Search"
      isTelegram(app) && containsAny(normalized, "blocked users", "blocked accounts", "blocked contacts") -> "Telegram Blocked accounts"
      isTelegram(app) && normalized.contains("channel") -> "Telegram Channels"
      isSnapchat(app) && normalized.contains("quick add") -> "Snapchat Quick Add"
      isSnapchat(app) && normalized.contains("search") -> "Snapchat Search"
      isSnapchat(app) && normalized.contains("discover") -> "Snapchat Discover"
      isSnapchat(app) && containsAny(normalized, "snap map", "maps", "map") -> "Snapchat Maps"
      isSnapchat(app) && normalized.contains("spotlight") -> "Snapchat Spotlight"
      isSnapchat(app) && containsAny(normalized, "story", "stories") -> "Snapchat Stories"
      isFacebook(app) && normalized.contains("reels") -> "Facebook Reels"
      isFacebook(app) && containsAny(normalized, "story", "stories") -> "Facebook Stories"
      isFacebook(app) && normalized.contains("search") -> "Facebook Search"
      isFacebook(app) && containsAny(normalized, "group", "groups") -> "Facebook Groups"
      isYoutube(app) && isYoutubeSearchSurface(normalized) -> "YouTube Search"
      isGoogleSearch(app) && normalized.contains("search") -> "Google Search"
      isReddit(app) && normalized.contains("search") -> "Reddit Search"
      isReddit(app) -> "Reddit"
      isPinterest(app) && normalized.contains("search") -> "Pinterest Search"
      isPinterest(app) -> "Pinterest"
      isAndroidSettings(app) -> "Android Settings"
      isPackageInstaller(app) || isPlayStore(app) -> "Package install"
      isDiscord(app) -> "Discord"
      isLiveStreamingApp(app, normalized) -> "Live-streaming app"
      isBrowser(app) && containsAny(normalized, "incognito", "private", "inprivate", "secret mode", "guest mode") -> "Browser unsafe mode"
      isBrowser(app) -> "Browser"
      else -> "Foreground app"
    }
  }

  private fun isAllowedTextInput(packageName: String, descriptor: String, visibleText: String): Boolean {
    val app = packageName.lowercase()
    val normalized = KeywordMatcher.normalize("$descriptor $visibleText")
    val searchContext = normalized.contains("search") ||
      normalized.contains("query") ||
      normalized.contains("url") ||
      normalized.contains("address")

    return searchContext && (
      isGoogleSearch(app) ||
        isYoutube(app) ||
        isTikTok(app) ||
        isInstagram(app) ||
        isTelegram(app) ||
        isSnapchat(app) ||
        isTwitter(app) ||
        isFacebook(app) ||
        isReddit(app) ||
        isPinterest(app) ||
        isBrowser(app)
      )
  }

  private fun nodeOwnText(node: AccessibilityNodeInfo?): String {
    if (node == null || node.isPassword) return ""
    val stateText = when {
      node.isSelected -> "selected"
      else -> ""
    }
    return compact(
      "${node.text?.toString().orEmpty()} ${node.contentDescription?.toString().orEmpty()} $stateText",
      MAX_ANALYZABLE_CHARS
    )
  }

  private fun collectVisibleText(service: AccessibilityService, activeRoot: AccessibilityNodeInfo?): String {
    val activeText = collectVisibleText(activeRoot)
    val windowText = try {
      service.windows.joinToString(" ") { window ->
        collectVisibleText(window.root)
      }
    } catch (_: Exception) {
      ""
    }
    return compact("$activeText $windowText", MAX_VISIBLE_CHARS)
  }

  private fun collectVisibleText(root: AccessibilityNodeInfo?): String {
    if (root == null) return ""
    val values = mutableListOf<String>()
    val remaining = intArrayOf(MAX_NODES)
    collectVisibleText(root, values, remaining)
    return compact(values.joinToString(" "), MAX_VISIBLE_CHARS)
  }

  private fun collectVisibleText(
    node: AccessibilityNodeInfo?,
    values: MutableList<String>,
    remaining: IntArray
  ) {
    if (node == null || remaining[0] <= 0 || node.isPassword) return
    remaining[0] = remaining[0] - 1

    val nodeText = nodeOwnText(node)
    if (nodeText.isNotBlank()) {
      values.add(nodeText)
    }

    for (index in 0 until node.childCount) {
      if (remaining[0] <= 0) break
      collectVisibleText(node.getChild(index), values, remaining)
    }
  }

  private fun resolveAppLabel(context: Context, packageName: String): String {
    return try {
      val applicationInfo = context.packageManager.getApplicationInfo(packageName, 0)
      context.packageManager.getApplicationLabel(applicationInfo).toString()
    } catch (_: Exception) {
      packageName
    }
  }

  private fun compact(value: String, maxLength: Int): String {
    val compacted = value.replace(Regex("\\s+"), " ").trim()
    return if (compacted.length <= maxLength) compacted else compacted.take(maxLength)
  }

  private fun containsAny(text: String, vararg values: String): Boolean =
    values.any { text.contains(it) }

  private fun isYoutubeSearchSurface(text: String): Boolean =
    containsAny(
      text,
      "youtube search",
      "search youtube",
      "search results",
      "search history",
      "clear search",
      "voice search",
      "no results found",
      "try different keywords"
    )

  private fun isYoutubeShortsSurface(text: String): Boolean =
    containsAny(
      text,
      "youtube shorts",
      "shorts selected",
      "selected shorts",
      "#shorts",
      "shorts feed",
      "shorts player",
      "shorts remix",
      "create a short"
    )

  private fun isYoutubeCommentsSurface(text: String): Boolean =
    containsAny(
      text,
      "youtube comments",
      "comment as",
      "add a comment",
      "top comments",
      "newest first",
      "view replies",
      "hide replies",
      "reply to comment"
    ) ||
      (text.contains("comments") && containsAny(text, "reply", "replies", "sort by", "add a comment"))

  private fun isPictureInPictureSurface(packageName: String, text: String): Boolean {
    val surfaceText = "$packageName $text"
    return containsAny(
      surfaceText,
      "picture-in-picture",
      "picture in picture",
      "pip mode",
      "pip window",
      "floating player",
      "floating window",
      "mini player",
      "miniplayer"
    )
  }

  private fun isAdultPlayStoreInstallSurface(text: String): Boolean {
    val installSurface = containsAny(
      text,
      "install",
      "update",
      "pre-register",
      "about this app",
      "data safety",
      "app info",
      "ratings and reviews"
    )
    val adultRating = containsAny(
      text,
      "rated 18+",
      "rated 17+",
      "mature 17",
      "adults only",
      "adult content",
      "explicit content",
      "sexual content",
      "strong sexual content",
      "nudity",
      "erotica",
      "pornography",
      "simulated gambling"
    )
    return installSurface && adultRating
  }

  private fun isInstagram(packageName: String): Boolean =
    packageName.contains("instagram")

  private fun isTikTok(packageName: String): Boolean =
    packageName.contains("zhiliaoapp.musically") || packageName.contains("ss.android.ugc")

  private fun isTelegram(packageName: String): Boolean =
    packageName.contains("telegram") || packageName.contains("thunderdog.challegram")

  private fun isSnapchat(packageName: String): Boolean =
    packageName.contains("snapchat")

  private fun isTwitter(packageName: String): Boolean =
    packageName.contains("twitter") || packageName.contains("x.android") || packageName.contains("xcorp")

  private fun isTwitterSurface(text: String): Boolean =
    text.contains("twitter.com") || text.contains("x.com") || text.contains("mobile.twitter.com")

  private fun isDiscord(packageName: String): Boolean =
    packageName.contains("discord")

  private fun isFacebook(packageName: String): Boolean =
    packageName.contains("facebook") || packageName.contains("katana")

  private fun isReddit(packageName: String): Boolean =
    packageName.contains("reddit")

  private fun isPinterest(packageName: String): Boolean =
    packageName.contains("pinterest")

  private fun isAndroidSettings(packageName: String): Boolean =
    packageName == "com.android.settings" || packageName.contains("settings")

  private fun isPackageInstaller(packageName: String): Boolean =
    packageName.contains("packageinstaller") || packageName.contains("documentsui")

  private fun isPlayStore(packageName: String): Boolean =
    packageName.contains("vending")

  private fun isLiveStreamingApp(packageName: String, normalizedText: String): Boolean {
    val text = "$packageName $normalizedText"
    return containsAny(
      text,
      "twitch",
      "bigo.live",
      "liveme",
      "younow",
      "tango",
      "nimo",
      "trovo",
      "nonolive",
      "afreecatv",
      "streamlabs"
    ) ||
      packageName.contains("kick.mobile") ||
      packageName.contains("com.kick") ||
      containsAny(text, "kick live", "kick streaming")
  }

  private fun isYoutube(packageName: String): Boolean =
    packageName.contains("youtube")

  private fun isGoogleSearch(packageName: String): Boolean =
    packageName.contains("googlequicksearchbox") || packageName.contains("google.android.googlequicksearchbox")

  fun isBrowserPackageName(packageName: String): Boolean =
    isBrowser(packageName.lowercase())

  private fun isBrowser(packageName: String): Boolean {
    return packageName.contains("chrome") ||
      packageName.contains("firefox") ||
      packageName.contains("fenix") ||
      packageName.contains("focus") ||
      packageName.contains("browser") ||
      packageName.contains("brave") ||
      packageName.contains("duckduckgo") ||
      packageName.contains("torproject") ||
      packageName.contains("edge") ||
      packageName.contains("emmx") ||
      packageName.contains("vivaldi") ||
      packageName.contains("kiwi") ||
      packageName.contains("yandex") ||
      packageName.contains("ucmobile") ||
      packageName.contains("mi.globalbrowser") ||
      packageName.contains("opera") ||
      packageName.contains("samsung.android.app.sbrowser")
  }
}

class BehaviorAccessibilityService : AccessibilityService() {
  private val captureThrottle = com.example.blocker.CaptureThrottle()

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val repository = PolicyRepository(applicationContext)
    if (!repository.isBehaviorProtectionEnabled()) return

    if (event != null) {
      checkForIncognito(event, repository)
      maybeCapture(event)
    }

    val screenContext = ScreenContextDetector.fromAccessibilityEvent(this, event) ?: return
    BehaviorEngine(applicationContext, repository).analyzeScreenContext(screenContext)
  }

  override fun onInterrupt() = Unit

  override fun onServiceConnected() {
    super.onServiceConnected()
    val repository = PolicyRepository(applicationContext)
    repository.setAccessibilityServiceEnabledSnapshot(true)
    com.example.blocker.TamperMonitor(repository, applicationContext).startAccessibilityPolling()
  }

  override fun onDestroy() {
    super.onDestroy()
    val repository = PolicyRepository(applicationContext)
    com.example.blocker.TamperMonitor(repository, applicationContext).stopAccessibilityPolling()
  }

  private fun maybeCapture(event: AccessibilityEvent) {
    if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.R) return

    val repository = PolicyRepository(applicationContext)
    if (!repository.isScreenshotAuditEnabled()) return

    val pkg = event.packageName?.toString() ?: return
    if (pkg !in SCAN_TARGET_PACKAGES) return
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) return
    if (!captureThrottle.shouldCapture(pkg, repository.screenshotAuditIntervalMs())) return

    takeScreenshot(
      android.view.Display.DEFAULT_DISPLAY,
      mainExecutor,
      object : TakeScreenshotCallback {
        override fun onSuccess(screenshot: ScreenshotResult) {
          val bitmap = android.graphics.Bitmap.wrapHardwareBuffer(
            screenshot.hardwareBuffer, screenshot.colorSpace
          )
          screenshot.hardwareBuffer.close()
          if (bitmap == null) return

          val softBitmap = bitmap.copy(android.graphics.Bitmap.Config.ARGB_8888, false)
          bitmap.recycle()
          if (softBitmap == null) return

          PolicyRepository(applicationContext).recordAuditEvent(
            eventType = "SCREENSHOT_AUDIT_CAPTURED",
            severity = "medium",
            category = "media_audit",
            subject = pkg,
            action = "captured_for_local_ai_review"
          )
          com.example.blocker.ImageContentScanner.scanBitmap(
            softBitmap,
            onComplete = { softBitmap.recycle() },
            onAmbiguous = { decision ->
              val repo = PolicyRepository(applicationContext)
              repo.recordAuditEvent(
                eventType = "NSFW_IMAGE_AMBIGUOUS",
                severity = "medium",
                category = "media_scan",
                subject = pkg,
                action = "cloud_review_candidate",
                metadata = mapOf(
                  "score" to decision.score,
                  "fallbackEnabled" to repo.isCloudImageFallbackEnabled(),
                  "fallbackConfigured" to repo.cloudImageFallbackEndpoint().isNotBlank()
                )
              )
              if (repo.isCloudImageFallbackEnabled() && repo.cloudImageFallbackEndpoint().isNotBlank()) {
                com.example.blocker.CloudImageReviewClient.review(
                  endpoint = repo.cloudImageFallbackEndpoint(),
                  decision = decision
                ) { result ->
                  repo.recordAuditEvent(
                    eventType = "CLOUD_IMAGE_REVIEW",
                    severity = if (result.block) "critical" else "low",
                    category = "media_scan",
                    subject = pkg,
                    action = result.action,
                    metadata = mapOf("score" to (result.score ?: decision.score))
                  )
                  if (result.block) {
                    blockAdultImage(pkg, "Cloud review confirmed unsafe image or thumbnail.")
                  }
                }
              }
            }
          ) { decision ->
            PolicyRepository(applicationContext).recordAuditEvent(
              eventType = "NSFW_IMAGE_DETECTED",
              severity = "critical",
              category = "media_scan",
              subject = pkg,
              action = "image_or_thumbnail_blocked",
              metadata = mapOf("score" to decision.score)
            )
            blockAdultImage(pkg, "Adult image or video thumbnail detected.")
          }
        }

        override fun onFailure(errorCode: Int) { /* takeScreenshot not available */ }
      }
    )
  }

  private fun checkForIncognito(event: AccessibilityEvent, repository: PolicyRepository) {
    val pkg = event.packageName?.toString() ?: return
    val title = "${event.text?.joinToString(" ") { it.toString() }.orEmpty()} ${event.contentDescription?.toString().orEmpty()}"
    val signatures = incognitoSignaturesFor(pkg)

    if (signatures.any { title.contains(it, ignoreCase = true) }) {
      repository.recordAuditEvent(
        eventType = "INCOGNITO_ATTEMPT",
        severity = "critical",
        category = "tamper",
        subject = pkg,
        action = "incognito_detected"
      )
      com.example.blocker.GuardianNotifier.notify(
        context = applicationContext,
        eventType = "INCOGNITO_ATTEMPT",
        severity = "critical",
        subject = pkg,
        action = "incognito_detected"
      )
      com.example.blocker.BlockOverlayService.show(
        applicationContext,
        "Private browsing blocked",
        "Private/incognito browsing mode was detected and blocked."
      )
      com.example.blocker.TamperDetector(applicationContext, repository)
        .evaluateAndRecord(com.example.blocker.FilterVpnService.isRunning)
    }
  }

  private fun blockAdultImage(packageName: String, reason: String) {
    com.example.blocker.BlockOverlayService.show(
      applicationContext,
      packageName,
      reason
    )
    com.example.blocker.GuardianNotifier.notify(
      context = applicationContext,
      eventType = "NSFW_IMAGE_DETECTED",
      severity = "critical",
      subject = packageName,
      action = "image_or_thumbnail_blocked"
    )
  }

  companion object {
    private val SCAN_TARGET_PACKAGES = setOf(
      "com.android.chrome", "org.mozilla.firefox", "com.brave.browser",
      "com.whatsapp", "org.telegram.messenger", "com.instagram.android",
      "com.google.android.youtube", "com.snapchat.android",
      "com.sec.android.app.sbrowser", "com.opera.browser", "com.microsoft.emmx",
      "com.duckduckgo.mobile.android", "org.torproject.torbrowser",
      "org.mozilla.focus", "com.vivaldi.browser", "com.kiwibrowser.browser"
    )

    private val COMMON_INCOGNITO_SIGNATURES = listOf(
      "incognito",
      "new incognito tab",
      "private browsing",
      "private tab",
      "new private tab",
      "private mode",
      "inprivate",
      "secret mode",
      "secret tab",
      "guest mode",
      "fire button"
    )

    private val BROWSER_INCOGNITO_SIGNATURES = mapOf(
      "com.android.chrome"           to listOf("incognito", "New incognito tab", "You've gone incognito"),
      "org.mozilla.firefox"          to listOf("Private Browsing", "Private Tab", "Firefox Private"),
      "org.mozilla.focus"            to listOf("Private", "Firefox Focus"),
      "com.brave.browser"            to listOf("Private", "New private tab", "Private window"),
      "com.opera.browser"            to listOf("Private mode", "Private tab"),
      "com.sec.android.app.sbrowser" to listOf("Secret mode", "Secret tab"),
      "com.microsoft.emmx"           to listOf("InPrivate", "New InPrivate tab"),
    )

    private fun incognitoSignaturesFor(packageName: String): List<String> {
      val pkg = packageName.lowercase()
      if (!ScreenContextDetector.isBrowserPackageName(pkg)) return emptyList()
      val browserSpecific = BROWSER_INCOGNITO_SIGNATURES[pkg] ?: emptyList()
      return (browserSpecific + COMMON_INCOGNITO_SIGNATURES).distinct()
    }
  }
}
