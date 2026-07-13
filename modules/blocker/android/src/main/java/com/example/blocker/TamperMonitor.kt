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

  fun isTampered(vpnActive: Boolean, suppressVpnDownTamper: Boolean = false): Boolean {
    if (repository.isTampered()) return true
    val tampered = repository.isProtectionRequested() && !vpnActive && !suppressVpnDownTamper
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

  fun markVpnStoppedUnexpectedly(failureReason: String = "vpn_stopped_unexpectedly") {
    if (repository.isProtectionRequested()) {
      repository.setTampered(true)
      repository.recordAuditEvent(
        eventType = "VPN_STOPPED_UNEXPECTEDLY",
        severity = "critical",
        category = "tamper",
        subject = "local_vpn",
        action = "vpn_down"
      )
      repository.markVpnStartFailed(failureReason)
    } else {
      repository.setVpnActive(false)
    }
  }

  fun handleVpnRevoked() {
    repository.recordDomainEvent("vpn-revoked.local", "tamper", "vpn_revoked")
    markVpnStoppedUnexpectedly("vpn_revoked")
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
    reportAccessibilityDisabled(context)
  }

  // Records the tamper, alerts the guardian, and shows the block overlay. Callers that observe
  // the accessibility setting directly (e.g. FilterVpnService's ContentObserver) are responsible
  // for their own de-duplication so this doesn't fire repeatedly.
  fun reportAccessibilityDisabled(context: Context) {
    val vpnLifecycle = repository.reconcileVpnLifecycle(FilterVpnService.isRunning)
    TamperDetector(context, repository).evaluateAndRecord(
      vpnActive = vpnLifecycle.verifiedActive,
      suppressVpnDownTamper = vpnLifecycle.startupGraceActive
    )
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

  // A custom (non-family) Private DNS host lets netd do DoT outside the VPN tunnel,
  // bypassing the filter for every app that uses the system resolver — so treat it
  // like any other tamper surface. Caller (FilterVpnService observer) de-duplicates.
  fun reportPrivateDnsChanged(context: Context, host: String) {
    repository.recordAuditEvent(
      eventType = "PRIVATE_DNS_TAMPER",
      severity = "critical",
      category = "tamper",
      subject = host.take(120),
      action = "custom_resolver_set"
    )
    GuardianNotifier.notify(
      context = context,
      eventType = "PRIVATE_DNS_TAMPER",
      severity = "critical",
      subject = host.take(120),
      action = "custom_resolver_set"
    )
  }

  companion object {
    private const val ACCESSIBILITY_POLL_INTERVAL_MS = 30_000L
  }
}
