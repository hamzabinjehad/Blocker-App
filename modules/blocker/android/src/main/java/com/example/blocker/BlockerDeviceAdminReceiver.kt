package com.example.blocker

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

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
    repository.setTampered(true)
    repository.recordAuditEvent(
      eventType = "DEVICE_ADMIN_DISABLE_REQUESTED",
      severity = "critical",
      category = "tamper",
      subject = context.packageName,
      action = "disable_requested"
    )
    GuardianNotifier.notify(
      context = context,
      eventType = "DEVICE_ADMIN_DISABLE_REQUESTED",
      severity = "critical",
      subject = context.packageName,
      action = "disable_requested"
    )
    BlockOverlayService.show(context, "Device Admin", "Attempt to disable uninstall protection")
    return "Disabling Device Admin weakens parental-control protection and will be reported."
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
  }
}
