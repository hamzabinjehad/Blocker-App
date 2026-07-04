package com.example.blocker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.app.PendingIntent
import android.os.Build

/**
 * Low-importance heads-down notification when a site is blocked, so the user sees
 * "example.com was blocked" instead of an opaque connection error in the browser.
 * Debounced: at most one notification per [MIN_INTERVAL_MS]; blocks inside the quiet
 * window are folded into the next notification as a count. Tapping opens the app,
 * where the (PIN-gated) Recently Blocked list offers the actual "allow" flow.
 */
object BlockedSiteNotifier {
  private const val CHANNEL_ID = "blocked_sites"
  private const val CHANNEL_NAME = "Blocked sites"
  private const val NOTIFICATION_ID = 8601
  private const val MIN_INTERVAL_MS = 2 * 60 * 1000L

  @Volatile private var lastNotifiedAtMs = 0L
  @Volatile private var suppressedCount = 0

  fun maybeNotify(context: Context, domain: String, category: String) {
    val now = System.currentTimeMillis()
    if (now - lastNotifiedAtMs < MIN_INTERVAL_MS) {
      suppressedCount += 1
      return
    }
    val extraCount = suppressedCount
    suppressedCount = 0
    lastNotifiedAtMs = now

    try {
      ensureChannel(context)
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.notify(NOTIFICATION_ID, buildNotification(context, domain, category, extraCount))
    } catch (_: Exception) {
      // Notifications denied (Android 13+ permission) or unavailable — blocking itself is unaffected.
    }
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      CHANNEL_NAME,
      NotificationManager.IMPORTANCE_LOW // silent, no heads-up — informational only
    ).apply {
      description = "Shows which site was just blocked, with a path to allow mistakes"
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  private fun buildNotification(
    context: Context,
    domain: String,
    category: String,
    extraCount: Int
  ): Notification {
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent(Intent.ACTION_MAIN).apply {
        addCategory(Intent.CATEGORY_LAUNCHER)
        setPackage(context.packageName)
      }
    val pendingIntent = PendingIntent.getActivity(
      context,
      8601,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val icon = if (context.applicationInfo.icon != 0) {
      context.applicationInfo.icon
    } else {
      android.R.drawable.ic_lock_lock
    }
    val categoryLabel = when (category) {
      DomainClassifier.CATEGORY_ADULT -> "adult content"
      DomainClassifier.CATEGORY_BYPASS -> "bypass tool"
      DomainClassifier.CATEGORY_SEARCH -> "unmanaged search"
      else -> category
    }
    val body = buildString {
      append(domain.take(80))
      append(" (")
      append(categoryLabel)
      append(")")
      if (extraCount > 0) append(" · and $extraCount more")
    }

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context)
    }

    return builder
      .setSmallIcon(icon)
      .setContentTitle("Site blocked")
      .setContentText(body.take(120))
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .setShowWhen(true)
      .build()
  }
}
