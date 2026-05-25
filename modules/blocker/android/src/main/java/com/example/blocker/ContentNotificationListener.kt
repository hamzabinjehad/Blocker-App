package com.example.blocker

import android.app.Notification
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.example.blocker.behavior.KeywordMatcher

class ContentNotificationListener : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    val repository = PolicyRepository(applicationContext)
    if (!repository.isNotificationFilteringEnabled()) return

    val packageName = sbn.packageName ?: return
    if (packageName == applicationContext.packageName) return
    if (packageName !in MONITORED_PACKAGES) return

    val notification = sbn.notification ?: return
    val extras = notification.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
    val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
    val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString().orEmpty()
    val combinedText = "$title $text $bigText $subText".trim()

    if (combinedText.isBlank()) return

    val match = KeywordMatcher.find(
      combinedText,
      repository.customBlockedKeywords(),
      BlocklistStore.get(applicationContext).activeKeywords
    )

    if (match != null) {
      cancelNotification(sbn)
      repository.recordAuditEvent(
        eventType = "NOTIFICATION_FILTERED",
        severity = "high",
        category = "notification_filter",
        subject = packageName,
        action = "notification_blocked",
        metadata = mapOf(
          "keyword" to match.keyword,
          "keywordSource" to match.source
        )
      )
      GuardianNotifier.notify(
        context = applicationContext,
        eventType = "NOTIFICATION_FILTERED",
        severity = "high",
        subject = packageName,
        action = "adult_notification_blocked"
      )
      return
    }

    if (repository.isStrictModeEnabled() && containsAdultSignals(combinedText)) {
      cancelNotification(sbn)
      repository.recordAuditEvent(
        eventType = "NOTIFICATION_FILTERED",
        severity = "high",
        category = "notification_filter",
        subject = packageName,
        action = "strict_mode_signal_blocked"
      )
      return
    }
  }

  private fun cancelNotification(sbn: StatusBarNotification) {
    try {
      cancelNotification(sbn.key)
    } catch (_: Exception) {
      @Suppress("DEPRECATION")
      try {
        cancelNotification(sbn.packageName, sbn.tag, sbn.id)
      } catch (_: Exception) {
        // Notification cancel failed; audit event already recorded.
      }
    }
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    val repository = PolicyRepository(applicationContext)
    repository.setNotificationListenerConnected(true)
    repository.recordAuditEvent(
      eventType = "NOTIFICATION_LISTENER_CONNECTED",
      severity = "medium",
      category = "notification_filter",
      subject = applicationContext.packageName,
      action = "connected"
    )
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    val repository = PolicyRepository(applicationContext)
    repository.setNotificationListenerConnected(false)
    if (repository.isNotificationFilteringEnabled()) {
      repository.recordAuditEvent(
        eventType = "NOTIFICATION_LISTENER_DISCONNECTED",
        severity = "critical",
        category = "notification_filter",
        subject = applicationContext.packageName,
        action = "disconnected"
      )
      GuardianNotifier.notify(
        context = applicationContext,
        eventType = "NOTIFICATION_LISTENER_DISCONNECTED",
        severity = "critical",
        subject = applicationContext.packageName,
        action = "notification_filter_disabled"
      )
    }
    requestRebind(android.content.ComponentName(applicationContext, ContentNotificationListener::class.java))
  }

  private fun containsAdultSignals(text: String): Boolean {
    val normalized = text.lowercase()
    return STRICT_MODE_SIGNALS.any { normalized.contains(it) }
  }

  companion object {
    val MONITORED_PACKAGES = setOf(
      "com.instagram.android",
      "com.zhiliaoapp.musically",
      "com.ss.android.ugc.trill",
      "org.telegram.messenger",
      "com.snapchat.android",
      "com.twitter.android",
      "com.twitter.android.lite",
      "com.whatsapp",
      "com.facebook.katana",
      "com.facebook.orca",
      "com.reddit.frontpage",
      "com.discord",
      "com.tumblr",
      "com.pinterest",
      "tv.twitch.android.app",
      "com.bigo.live",
      "com.google.android.youtube",
      "com.viber.voip",
      "jp.naver.line.android",
      "com.imo.android.imoim",
      "com.tinder",
      "com.bumble.app",
      "com.badoo.mobile",
      "com.grindr.android",
      "com.kik.messenger"
    )

    private val STRICT_MODE_SIGNALS = listOf(
      "18+",
      "nsfw",
      "adult content",
      "explicit",
      "nude",
      "nudity",
      "xxx",
      "onlyfans",
      "fansly",
      "sexy",
      "hookup",
      "hook up"
    )
  }
}
