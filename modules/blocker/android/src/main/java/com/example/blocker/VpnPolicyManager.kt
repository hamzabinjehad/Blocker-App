package com.example.blocker

import android.content.Context
import android.net.VpnService

data class VpnAppliedPolicy(
  val effectiveTunnelMode: String,
  val routesAllIpv4Traffic: Boolean,
  val routesAllIpv6Traffic: Boolean,
  val perAppVpnFilteringEnabled: Boolean,
  val allowedPackages: Set<String>,
  val excludedPackages: Set<String>,
  val failedPackages: Set<String>
)

object VpnPolicyManager {
  private const val MODE_DNS_ONLY = "dns_only"
  private const val MODE_FULL_TUNNEL = "full_tunnel"

  private val systemUpdatePackages = setOf(
    "com.android.providers.downloads",
    "com.android.providers.downloads.ui",
    "com.android.vending",
    "com.google.android.gms",
    "com.google.android.gsf",
    "com.google.android.gms.policy_sidecar_aps",
    "com.google.android.apps.restore",
    "com.google.android.apps.work.oobconfig",
    "com.google.android.modulemetadata",
    "com.google.mainline.telemetry"
  )

  fun configure(
    context: Context,
    repository: PolicyRepository,
    builder: VpnService.Builder
  ): VpnAppliedPolicy {
    val explicitAllowed = repository.vpnAllowedPackages()
    val targetAllowed = if (repository.isPerAppVpnFilteringEnabled()) {
      explicitAllowed.ifEmpty { defaultFilteredPackages(context, repository) }
    } else {
      emptySet()
    }
    val excluded = excludedPackages(context, repository)
    val shouldUseAllowedMode = repository.isPerAppVpnFilteringEnabled() && targetAllowed.isNotEmpty()
    val failed = mutableSetOf<String>()

    if (shouldUseAllowedMode) {
      targetAllowed
        .filter { it !in excluded }
        .forEach { packageName ->
          applyPackage(packageName, failed) { builder.addAllowedApplication(packageName) }
        }
    } else {
      excluded.forEach { packageName ->
        applyPackage(packageName, failed) { builder.addDisallowedApplication(packageName) }
      }
    }

    // The current VPN service is a DNS filter, not a packet-forwarding VPN.
    // Routing full app traffic here drops normal TCP/UDP packets and breaks internet access.
    val fullTunnel = false
    return VpnAppliedPolicy(
      effectiveTunnelMode = if (fullTunnel) MODE_FULL_TUNNEL else MODE_DNS_ONLY,
      routesAllIpv4Traffic = fullTunnel,
      routesAllIpv6Traffic = fullTunnel && repository.isIpv6LeakPreventionEnabled(),
      perAppVpnFilteringEnabled = shouldUseAllowedMode,
      allowedPackages = if (shouldUseAllowedMode) targetAllowed.filter { it !in excluded }.toSet() else emptySet(),
      excludedPackages = if (shouldUseAllowedMode) excluded else excluded - failed,
      failedPackages = failed
    )
  }

  fun status(context: Context, repository: PolicyRepository): Map<String, Any?> {
    val explicitAllowed = repository.vpnAllowedPackages()
    val defaultAllowed = defaultFilteredPackages(context, repository)
    val allowed = if (repository.isPerAppVpnFilteringEnabled()) {
      explicitAllowed.ifEmpty { defaultAllowed }
    } else {
      emptySet()
    }
    val excluded = excludedPackages(context, repository)
    // Keep the reported effective mode aligned with the DNS-only implementation.
    val fullTunnelEffective = false

    return mapOf(
      "fullTunnelVpnEnabled" to repository.isFullTunnelVpnEnabled(),
      "effectiveTunnelMode" to if (fullTunnelEffective) MODE_FULL_TUNNEL else MODE_DNS_ONLY,
      "routesAllIpv4Traffic" to fullTunnelEffective,
      "routesAllIpv6Traffic" to (fullTunnelEffective && repository.isIpv6LeakPreventionEnabled()),
      "ipv6LeakPreventionEnabled" to repository.isIpv6LeakPreventionEnabled(),
      "perAppVpnFilteringEnabled" to repository.isPerAppVpnFilteringEnabled(),
      "allowedPackages" to allowed.toList().sorted(),
      "excludedPackages" to excluded.toList().sorted(),
      "filteredPackageCount" to allowed.size,
      "systemBypassPackages" to systemUpdatePackages.toList().sorted(),
      "reconnectOnBootEnabled" to true,
      "reconnectOnPackageReplaceEnabled" to true,
      "localProxyPort" to LocalHttpProxy.DEFAULT_PORT
    )
  }

  private fun defaultFilteredPackages(context: Context, repository: PolicyRepository): Set<String> {
    val apps = AppInventory.launchableApps(context)
    val explicitBlocked = repository.blockedAppPackages()
    val riskyPackages = apps
      .filter { app ->
        val category = app.riskRule?.category
        val browser = category in setOf("browser", "private_browser") || AppInventory.isPrivateBrowser(app.packageName, app.label)
        val bypass = category in setOf("vpn_proxy_tor", "vpn", "proxy", "tor") || AppInventory.isBypassApp(app.packageName, app.label)
        app.packageName in explicitBlocked || browser || bypass
      }
      .map { it.packageName.lowercase() }
      .toSet()

    return (explicitBlocked + riskyPackages)
      .filter { it.isNotBlank() }
      .toSet()
  }

  private fun excludedPackages(context: Context, repository: PolicyRepository): Set<String> {
    return AppInventory.essentialPackageNames(context) +
      systemUpdatePackages +
      repository.vpnExcludedPackages()
  }

  private fun applyPackage(packageName: String, failed: MutableSet<String>, block: () -> Unit) {
    try {
      block()
    } catch (_: Exception) {
      failed.add(packageName)
    }
  }
}
