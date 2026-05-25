package com.example.blocker

data class AnomalySignal(
  val id: String,
  val severity: String,
  val detected: Boolean,
  val subject: String,
  val recommendation: String,
  val count: Int
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "severity" to severity,
    "detected" to detected,
    "subject" to subject,
    "recommendation" to recommendation,
    "count" to count
  )
}

class AnomalyDetector(
  private val repository: PolicyRepository
) {
  fun status(): Map<String, Any?> {
    val now = System.currentTimeMillis()
    val recent = repository.getAuditEvents().filter { event ->
      val timestamp = (event["timestamp"] as? Number)?.toLong() ?: 0L
      now - timestamp <= WINDOW_MS
    }

    val vpnStops = recent.count { event ->
      event["eventType"] == "VPN_STOPPED_UNEXPECTEDLY" || event["action"] == "vpn_down"
    }
    val dnsChanges = recent.count { event ->
      event["action"] == "private_dns_enabled" ||
        (event["subject"] as? String).orEmpty().contains("private dns", ignoreCase = true)
    }
    val installAnomalies = recent.count { event ->
      event["eventType"] == "ANOMALY_SIGNAL" ||
        event["category"] in setOf("sideloaded_apk", "vpn_proxy_tor", "private_browser", "apk_store")
    }
    val accessibilityDrops = recent.count { event ->
      event["eventType"] == "ACCESSIBILITY_DISABLED" || event["action"] == "accessibility_service_disabled"
    }

    val signals = listOf(
      AnomalySignal(
        id = "vpn_toggle_burst",
        severity = "critical",
        detected = vpnStops >= 2,
        subject = "Repeated VPN interruptions",
        recommendation = "Enable always-on VPN lockdown or review recent protection toggles.",
        count = vpnStops
      ),
      AnomalySignal(
        id = "private_dns_change",
        severity = "high",
        detected = dnsChanges >= 1,
        subject = "Private DNS change",
        recommendation = "Keep Private DNS controlled by policy to avoid DNS bypass.",
        count = dnsChanges
      ),
      AnomalySignal(
        id = "new_bypass_or_browser_install",
        severity = "high",
        detected = installAnomalies >= 1,
        subject = "New browser, VPN, proxy, or sideload attempt",
        recommendation = "Review recent installs and block unsafe packages if needed.",
        count = installAnomalies
      ),
      AnomalySignal(
        id = "accessibility_drop",
        severity = "critical",
        detected = accessibilityDrops >= 1,
        subject = "Accessibility service interruption",
        recommendation = "Re-enable Behavior Protection and require a parent PIN for settings changes.",
        count = accessibilityDrops
      )
    )

    val detected = signals.filter { it.detected }
    val riskLevel = when {
      detected.any { it.severity == "critical" } -> "critical"
      detected.any { it.severity == "high" } -> "high"
      else -> "normal"
    }

    return mapOf(
      "enabled" to true,
      "windowHours" to WINDOW_HOURS,
      "riskLevel" to riskLevel,
      "detectedCount" to detected.size,
      "signals" to signals.map { it.toMap() }
    )
  }

  companion object {
    private const val WINDOW_HOURS = 24
    private const val WINDOW_MS = WINDOW_HOURS * 60L * 60L * 1000L
  }
}
