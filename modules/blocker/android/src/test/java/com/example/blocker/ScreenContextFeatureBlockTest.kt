package com.example.blocker

import com.example.blocker.behavior.ScreenContextDetector
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class ScreenContextFeatureBlockTest {
  private data class FeatureCase(
    val key: String,
    val packageName: String,
    val screenText: String
  )

  private val featureCases = listOf(
    FeatureCase("instagramDm", "com.instagram.android", "Direct messages Inbox DM"),
    FeatureCase("instagramStories", "com.instagram.android", "Stories Your story Close friends"),
    FeatureCase("instagramSearch", "com.instagram.android", "Search Instagram Accounts Tags Places"),
    FeatureCase("instagramExplore", "com.instagram.android", "Explore Suggested for you"),
    FeatureCase("instagramReels", "com.instagram.android", "Reels tab selected Shorts feed"),
    FeatureCase("tiktokShorts", "com.zhiliaoapp.musically", "For You Following Friends TikTok feed Swipe up"),
    FeatureCase("tiktokSearch", "com.zhiliaoapp.musically", "Search TikTok Users Videos Sounds"),
    FeatureCase("youtubeSearch", "com.google.android.youtube", "YouTube Search Search results Voice search"),
    FeatureCase("youtubeShorts", "com.google.android.youtube", "YouTube Shorts Shorts tab selected Shorts feed"),
    FeatureCase("youtubeComments", "com.google.android.youtube", "YouTube Comments Top comments Add a comment View replies"),
    FeatureCase("pictureInPicture", "com.google.android.youtube", "Picture-in-picture floating player"),
    FeatureCase("telegramSearch", "org.telegram.messenger", "Search Telegram Global search Search chats"),
    FeatureCase("telegramSearchHistory", "org.telegram.messenger", "Recent searches Clear search history"),
    FeatureCase("telegramChannels", "org.telegram.messenger", "Public channel Join channel Channels"),
    FeatureCase("telegramGroups", "org.telegram.messenger", "Public group Join group Groups"),
    FeatureCase("telegramBlockedAccounts", "org.telegram.messenger", "Blocked users Blocked contacts"),
    FeatureCase("snapchatQuickAdd", "com.snapchat.android", "Quick Add Add friends"),
    FeatureCase("snapchatSearch", "com.snapchat.android", "Search Find friends"),
    FeatureCase("snapchatDiscover", "com.snapchat.android", "Discover Publisher stories"),
    FeatureCase("snapchatStories", "com.snapchat.android", "Stories Public story"),
    FeatureCase("snapchatSpotlight", "com.snapchat.android", "Spotlight feed"),
    FeatureCase("snapchatMaps", "com.snapchat.android", "Snap Map Maps nearby"),
    FeatureCase("twitterEraseAll", "com.twitter.android", "Home timeline"),
    FeatureCase("twitterBlockApp", "com.twitter.android", "Home timeline"),
    FeatureCase("twitterSearchMediaTrends", "com.twitter.android", "Explore Trending Search results Photos and videos"),
    FeatureCase("twitterForYou", "com.twitter.android", "Home For You Following"),
    FeatureCase("discordBlockApp", "com.discord", "Discord Home"),
    FeatureCase("facebookBlockApp", "com.facebook.katana", "Facebook Home"),
    FeatureCase("facebookReels", "com.facebook.katana", "Reels and short videos"),
    FeatureCase("facebookStories", "com.facebook.katana", "Stories Your story"),
    FeatureCase("facebookSearch", "com.facebook.katana", "Search Facebook"),
    FeatureCase("facebookGroups", "com.facebook.katana", "Groups Discover groups"),
    FeatureCase("redditSearch", "com.reddit.frontpage", "Search Reddit Search posts"),
    FeatureCase("redditSubreddits", "com.reddit.frontpage", "Popular Communities Browse communities"),
    FeatureCase("pinterestSearch", "com.pinterest", "Search ideas Visual search Explore"),
    FeatureCase("liveStreamingApps", "tv.twitch.android.app", "Live channels"),
    FeatureCase("browserUnsafeModes", "com.android.chrome", "New incognito tab"),
    FeatureCase("androidTamperSettings", "com.android.settings", "Accessibility VPN Private DNS Device Admin"),
    FeatureCase("playStoreUninstallControls", "com.android.vending", "Manage apps Installed Parent Blocker Uninstall"),
    FeatureCase("playStoreAdultInstallControls", "com.android.vending", "Install Rated 17+ Mature 17 Adult content"),
    FeatureCase("packageInstallerControls", "com.google.android.packageinstaller", "Package installer Install unknown app APK private browser")
  )

  @Test
  fun `enabled feature keys return expected blocked feature`() {
    featureCases.forEach { case ->
      val feature = match(case.packageName, case.screenText, mapOf(case.key to true))

      assertNotNull("${case.key} should block", feature)
      assertEquals(case.key, feature!!.key)
    }
  }

  @Test
  fun `disabled feature keys do not block`() {
    featureCases.forEach { case ->
      val feature = match(case.packageName, case.screenText, mapOf(case.key to false))

      assertNull("${case.key} should not block when disabled", feature)
    }
  }

  @Test
  fun `instagram shared reel inside dm does not trigger reels block`() {
    val feature = match(
      packageName = "com.instagram.android",
      screenText = "Direct Messages Sarah sent you Reels from a profile Chat",
      featureBlocks = mapOf("instagramReels" to true)
    )

    assertNull(feature)
  }

  @Test
  fun `youtube closed comments row does not trigger comments block`() {
    val feature = match(
      packageName = "com.google.android.youtube",
      screenText = "YouTube Comments are turned off Share Subscribe",
      featureBlocks = mapOf("youtubeComments" to true)
    )

    assertNull(feature)
  }

  @Test
  fun `twitter profile media tab does not trigger search media trends block`() {
    val feature = match(
      packageName = "com.twitter.android",
      screenText = "Profile Posts Replies Media Photos Followers Following",
      featureBlocks = mapOf("twitterSearchMediaTrends" to true)
    )

    assertNull(feature)
  }

  @Test
  fun `reddit normal post does not trigger communities block`() {
    val feature = match(
      packageName = "com.reddit.frontpage",
      screenText = "r recovery Community post Comments Reply Share Upvote",
      featureBlocks = mapOf("redditSubreddits" to true)
    )

    assertNull(feature)
  }

  private fun match(
    packageName: String,
    screenText: String,
    featureBlocks: Map<String, Boolean>
  ) = ScreenContextDetector.matchBlockedFeature(
    packageName = packageName,
    screenText = screenText,
    featureBlocks = featureBlocks
  )
}
