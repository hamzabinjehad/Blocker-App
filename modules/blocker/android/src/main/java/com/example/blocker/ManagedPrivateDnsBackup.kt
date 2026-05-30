package com.example.blocker

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build

object ManagedPrivateDnsBackup {
  const val DEFAULT_HOSTNAME = "family.cloudflare-dns.com"

  fun configureIfPossible(context: Context, repository: PolicyRepository): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return false
    val manager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    val managedOwner = manager.isDeviceOwnerApp(context.packageName) || manager.isProfileOwnerApp(context.packageName)
    if (!managedOwner) return false

    val component = ComponentName(context, BlockerDeviceAdminReceiver::class.java)
    val currentHost = runCatching { manager.getGlobalPrivateDnsHost(component) }.getOrNull()
    if (!currentHost.isNullOrBlank()) return true

    return runCatching {
      manager.setGlobalPrivateDnsModeSpecifiedHost(component, DEFAULT_HOSTNAME)
      repository.recordAuditEvent(
        eventType = "MANAGED_PRIVATE_DNS_BACKUP_CONFIGURED",
        severity = "high",
        category = "dns",
        subject = DEFAULT_HOSTNAME,
        action = "configured"
      )
      true
    }.getOrElse {
      repository.recordAuditEvent(
        eventType = "MANAGED_PRIVATE_DNS_BACKUP_FAILED",
        severity = "high",
        category = "dns",
        subject = DEFAULT_HOSTNAME,
        action = "not_configured",
        metadata = mapOf("reason" to (it.message ?: it.javaClass.simpleName))
      )
      false
    }
  }
}
