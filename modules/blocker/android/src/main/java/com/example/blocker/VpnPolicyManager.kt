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

  // The VPN service is a DNS filter, not a packet-forwarding VPN: it answers DNS and drops
  // everything else. Routing all app traffic into the tunnel without a userspace TCP/UDP
  // forwarder would silently break internet access, so full-tunnel routing stays unimplemented
  // and the `fullTunnelVpnEnabled` preference records intent only.
  const val FULL_TUNNEL_SUPPORTED = false

  /** True only when the tunnel actually carries every destination, not just DNS. */
  fun routesAllTraffic(repository: PolicyRepository): Boolean =
    FULL_TUNNEL_SUPPORTED && repository.isFullTunnelVpnEnabled()

  /**
   * Android's always-on lockdown ("Block connections without VPN") only permits egress through
   * the VPN interface. Our tunnel routes DNS and the known encrypted-DNS resolvers — nothing
   * else — so turning lockdown on would leave every other destination without a route and take
   * the device offline, while DISALLOW_CONFIG_VPN / DISALLOW_FACTORY_RESET remove the way back.
   *
   * Lockdown is therefore only ever safe once the tunnel routes all traffic. Always-on *without*
   * lockdown is still applied: the VPN restarts on boot and the user cannot switch it off.
   */
  fun isLockdownSafe(repository: PolicyRepository): Boolean = routesAllTraffic(repository)

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

    val fullTunnel = routesAllTraffic(repository)
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
    val fullTunnelEffective = routesAllTraffic(repository)

    return mapOf(
      // `fullTunnelVpnEnabled` / `ipv6LeakPreventionEnabled` are the stored *intent*.
      // `effectiveTunnelMode`, `routesAll*Traffic` and `fullTunnelSupported` are the *reality*;
      // the UI must render protection state from the latter.
      "fullTunnelVpnEnabled" to repository.isFullTunnelVpnEnabled(),
      "fullTunnelSupported" to FULL_TUNNEL_SUPPORTED,
      "alwaysOnVpnLockdownSupported" to FULL_TUNNEL_SUPPORTED,
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
