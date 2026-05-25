package com.example.blocker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import kotlin.math.absoluteValue

object GuardianNotifier {
  private const val CHANNEL_ID = "parent_blocker_guardian_alerts"
  private const val CHANNEL_NAME = "Parent Blocker guardian alerts"
  private const val ALERT_RATE_LIMIT_MS = 5 * 60 * 1000L

  fun notify(
    context: Context,
    eventType: String,
    severity: String,
    subject: String,
    action: String,
    metadata: Map<String, Any?> = emptyMap()
  ) {
    val appContext = context.applicationContext
    val repository = PolicyRepository(appContext)
    val now = System.currentTimeMillis()
    val recentlyQueued = repository.getGuardianAlerts().any { alert ->
      alert["eventType"] == eventType &&
        alert["subject"] == subject &&
        alert["action"] == action &&
        now - ((alert["timestamp"] as? Number)?.toLong() ?: 0L) < ALERT_RATE_LIMIT_MS
    }
    if (recentlyQueued) return

    repository.recordGuardianAlert(
      eventType = eventType,
      severity = severity,
      subject = subject,
      action = action,
      metadata = metadata
    )
    repository.recordAuditEvent(
      eventType = "GUARDIAN_ALERT_QUEUED",
      severity = severity,
      category = "guardian_alert",
      subject = subject,
      action = action,
      metadata = metadata
    )
    showLocalNotification(appContext, eventType, severity, subject, action)
  }

  private fun showLocalNotification(
    context: Context,
    eventType: String,
    severity: String,
    subject: String,
    action: String
  ) {
    ensureChannel(context)
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val notification = buildNotification(context, eventType, severity, subject, action)
    val notificationId = "${eventType}:${subject}:${action}".hashCode().absoluteValue.takeIf { it != 0 } ?: 9001
    try {
      manager.notify(notificationId, notification)
    } catch (_: SecurityException) {
      // Android 13+ may deny notification display; the encrypted local alert queue remains authoritative.
    }
  }

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      CHANNEL_NAME,
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      description = "Local alerts for blocked content and protection tamper events"
      setShowBadge(true)
    }
    manager.createNotificationChannel(channel)
  }

  private fun buildNotification(
    context: Context,
    eventType: String,
    severity: String,
    subject: String,
    action: String
  ): Notification {
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent(Intent.ACTION_MAIN).apply {
        addCategory(Intent.CATEGORY_LAUNCHER)
        setPackage(context.packageName)
      }
    val pendingIntent = PendingIntent.getActivity(
      context,
      8402,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val icon = if (context.applicationInfo.icon != 0) {
      context.applicationInfo.icon
    } else {
      android.R.drawable.ic_dialog_alert
    }
    val title = if (severity == "critical") "Critical protection alert" else "Protection alert"
    val body = "$eventType: $subject ($action)"

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context)
    }

    return builder
      .setSmallIcon(icon)
      .setContentTitle(title)
      .setContentText(body.take(120))
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .setShowWhen(true)
      .build()
  }
}
