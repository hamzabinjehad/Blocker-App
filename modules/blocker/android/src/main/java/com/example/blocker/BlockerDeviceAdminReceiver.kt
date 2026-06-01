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
    val protectionActive = repository.isProtectionRequested() || repository.isUninstallLockWindowActive()
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
      BlockOverlayService.show(
        context,
        "Device Admin",
        "Protection is on. Device Admin cannot be changed until protection ends."
      )
      return "Protection is on. Device Admin cannot be changed until protection ends."
    }
    return "Disabling Device Admin weakens uninstall protection."
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
