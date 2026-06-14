package com.example.blocker

import android.app.admin.DeviceAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.app.PendingIntent
import android.app.NotificationManager
import androidx.core.app.NotificationCompat

class BlockerDeviceAdminReceiver : DeviceAdminReceiver() {
  override fun onEnabled(context: Context, intent: Intent) {
    PolicyRepository(context).recordAuditEvent(
      eventType = "DEVICE_ADMIN_ENABLED",
      severity = "high",
      category = "device_admin",
      subject = context.packageName,
      action = "enabled"
    )
  }

  override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
    val repository = PolicyRepository(context)
    val timeLockActive = repository.isUninstallLockWindowActive()
    val protectionActive = (repository.isProtectionRequested() && repository.isVpnActive()) || timeLockActive
    if (protectionActive) repository.setTampered(true)
    repository.recordAuditEvent(
      eventType = "DEVICE_ADMIN_DISABLE_REQUESTED",
      severity = if (protectionActive) "critical" else "high",
      category = "tamper",
      subject = context.packageName,
      action = "disable_requested"
    )
    if (protectionActive) {
      GuardianNotifier.notify(
        context = context,
        eventType = "DEVICE_ADMIN_DISABLE_REQUESTED",
        severity = "critical",
        subject = context.packageName,
        action = "disable_requested"
      )
      val lockClause = if (timeLockActive) {
        val remainingDays = ((repository.uninstallLockExpiresAt() - System.currentTimeMillis()) / 86_400_000L).coerceAtLeast(0L) + 1L
        " The protection lock expires in $remainingDays day${if (remainingDays == 1L) "" else "s"}."
      } else ""
      val message = "Protection is active.$lockClause Removing Device Admin disables uninstall protection — the VPN filter stays on but the app can be deleted."
      BlockOverlayService.show(context, "Device Admin", message)
      return message
    }
    return "Disabling Device Admin removes uninstall protection. The app can be deleted while protection is off."
  }

  override fun onDisabled(context: Context, intent: Intent) {
    val repository = PolicyRepository(context)
    repository.setTampered(true)
    repository.recordAuditEvent(
      eventType = "DEVICE_ADMIN_DISABLED",
      severity = "critical",
      category = "tamper",
      subject = context.packageName,
      action = "disabled"
    )
    GuardianNotifier.notify(
      context = context,
      eventType = "DEVICE_ADMIN_DISABLED",
      severity = "critical",
      subject = context.packageName,
      action = "disabled"
    )
    showReEnableNotification(context)
    // Immediately launch the re-enable dialog so the user sees it right away
    try {
      val reEnableIntent = buildAdminIntent(context).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }
      context.startActivity(reEnableIntent)
    } catch (_: Exception) {}
  }

  private fun buildAdminIntent(context: Context) = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
    putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, ComponentName(context, BlockerDeviceAdminReceiver::class.java))
    putExtra(
      DevicePolicyManager.EXTRA_ADD_EXPLANATION,
      "Device Admin is required to prevent the app from being deleted while protection is active."
    )
  }

  private fun showReEnableNotification(context: Context) {
    NotificationHelper.ensureChannel(context)
    val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
    val actionIntent = PendingIntent.getActivity(
      context, 9901, buildAdminIntent(context).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK }, pendingFlags
    )
    val notification = NotificationCompat.Builder(context, NotificationHelper.CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_dialog_alert)
      .setContentTitle("Device Admin removed — protection weakened")
      .setContentText("Tap to re-enable Device Admin and restore full uninstall protection.")
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setContentIntent(actionIntent)
      .setAutoCancel(true)
      .build()
    try {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.notify(9901, notification)
    } catch (_: Exception) {}
  }
}
