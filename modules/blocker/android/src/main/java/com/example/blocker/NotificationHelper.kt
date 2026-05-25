package com.example.blocker

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

object NotificationHelper {
  const val CHANNEL_ID = "parent_blocker_vpn"
  const val NOTIFICATION_ID = 8401

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val manager = context.getSystemService(NotificationManager::class.java)
    val existing = manager.getNotificationChannel(CHANNEL_ID)
    if (existing != null) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Parent Blocker protection",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Persistent notification shown while local DNS filtering is active"
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  fun build(context: Context): Notification {
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: context.packageManager.getLaunchIntentForPackage(context.applicationContext.packageName)
      ?: Intent(Intent.ACTION_MAIN).apply {
        addCategory(Intent.CATEGORY_LAUNCHER)
        setPackage(context.packageName)
      }
    val pendingIntent = PendingIntent.getActivity(
      context,
      0,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val icon = if (context.applicationInfo.icon != 0) {
      context.applicationInfo.icon
    } else {
      android.R.drawable.ic_dialog_info
    }

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context)
    }

    return builder
      .setSmallIcon(icon)
      .setContentTitle("Parent Blocker is active")
      .setContentText("Local DNS/domain filtering is running.")
      .setContentIntent(pendingIntent)
      .setOngoing(true)
      .setShowWhen(false)
      .build()
  }
}
