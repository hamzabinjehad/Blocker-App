package com.example.blocker

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.provider.Settings

class TamperMonitor(
  private val repository: PolicyRepository,
  private val context: Context? = null
) {
  private val handler = Handler(Looper.getMainLooper())
  @Volatile private var accessibilityPollingActive = false

  fun isTampered(vpnActive: Boolean): Boolean {
    if (repository.isTampered()) return true
    val tampered = repository.isProtectionRequested() && !vpnActive
    if (tampered) {
      repository.setTampered(true)
      repository.recordAuditEvent(
        eventType = "VPN_STOPPED_UNEXPECTEDLY",
        severity = "critical",
        category = "tamper",
        subject = "local_vpn",
        action = "vpn_down"
      )
    }
    return tampered
  }

  fun markVpnStoppedUnexpectedly() {
    if (repository.isProtectionRequested()) {
      repository.setTampered(true)
      repository.recordAuditEvent(
        eventType = "VPN_STOPPED_UNEXPECTEDLY",
        severity = "critical",
        category = "tamper",
        subject = "local_vpn",
        action = "vpn_down"
      )
    }
    repository.setVpnActive(false)
  }

  fun handleVpnRevoked() {
    repository.recordDomainEvent("vpn-revoked.local", "tamper", "vpn_revoked")
    markVpnStoppedUnexpectedly()
  }

  fun startAccessibilityPolling() {
    val ctx = context ?: return
    if (accessibilityPollingActive) return
    accessibilityPollingActive = true
    handler.postDelayed(object : Runnable {
      override fun run() {
        if (!accessibilityPollingActive) return
        if (!isAccessibilityEnabled(ctx)) {
          onAccessibilityDisabled(ctx)
          accessibilityPollingActive = false
          return
        }
        handler.postDelayed(this, ACCESSIBILITY_POLL_INTERVAL_MS)
      }
    }, ACCESSIBILITY_POLL_INTERVAL_MS)
  }

  fun stopAccessibilityPolling() {
    accessibilityPollingActive = false
  }

  fun isAccessibilityServiceEnabled(context: Context): Boolean =
    isAccessibilityEnabled(context)

  private fun isAccessibilityEnabled(context: Context): Boolean {
    val expectedService = "${context.packageName}/com.example.blocker.behavior.BehaviorAccessibilityService"
    val enabledServices = Settings.Secure.getString(
      context.contentResolver,
      Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
    ) ?: return false
    return enabledServices.contains(expectedService)
  }

  private fun onAccessibilityDisabled(context: Context) {
    if (!repository.wasAccessibilityServiceEnabled()) return

    TamperDetector(context, repository).evaluateAndRecord(FilterVpnService.isRunning)
    repository.setTampered(true)
    repository.recordAuditEvent(
      eventType = "ACCESSIBILITY_DISABLED",
      severity = "critical",
      category = "tamper",
      subject = "accessibility_service",
      action = "disabled"
    )
    GuardianNotifier.notify(
      context = context,
      eventType = "ACCESSIBILITY_DISABLED",
      severity = "critical",
      subject = "accessibility_service",
      action = "disabled"
    )
    BlockOverlayService.show(
      context,
      "Protection disabled",
      "Behavior protection was disabled. Parent PIN required to continue."
    )
  }

  companion object {
    private const val ACCESSIBILITY_POLL_INTERVAL_MS = 30_000L
  }
}
