package com.example.blocker

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

/**
 * Android's always-on VPN lockdown ("Block connections without VPN") only lets traffic out
 * through the VPN interface. The filter tunnel routes DNS and the known encrypted-DNS
 * resolvers — nothing else — so enabling lockdown would leave every other destination without
 * a route, while DISALLOW_CONFIG_VPN / DISALLOW_FACTORY_RESET remove the way back.
 *
 * These tests pin the invariant: lockdown is never requested unless the tunnel really carries
 * all traffic. If someone implements full-tunnel forwarding and flips FULL_TUNNEL_SUPPORTED,
 * `lockdownFollowsFullTunnelPreference` starts guarding the new behaviour instead.
 */
class VpnLockdownGatingTest {

  private fun repository(fullTunnelRequested: Boolean): PolicyRepository = mock<PolicyRepository>().also {
    whenever(it.isFullTunnelVpnEnabled()).thenReturn(fullTunnelRequested)
  }

  @Test
  fun `lockdown is never safe while full tunnel is unimplemented`() {
    if (VpnPolicyManager.FULL_TUNNEL_SUPPORTED) return

    // Even when the user has explicitly asked for the full tunnel, the routing does not exist,
    // so lockdown must stay off.
    assertFalse(VpnPolicyManager.isLockdownSafe(repository(fullTunnelRequested = true)))
    assertFalse(VpnPolicyManager.isLockdownSafe(repository(fullTunnelRequested = false)))
  }

  @Test
  fun `tunnel does not route all traffic while full tunnel is unimplemented`() {
    if (VpnPolicyManager.FULL_TUNNEL_SUPPORTED) return

    assertFalse(VpnPolicyManager.routesAllTraffic(repository(fullTunnelRequested = true)))
    assertFalse(VpnPolicyManager.routesAllTraffic(repository(fullTunnelRequested = false)))
  }

  @Test
  fun `lockdown follows the full tunnel preference once routing exists`() {
    if (!VpnPolicyManager.FULL_TUNNEL_SUPPORTED) return

    assertTrue(VpnPolicyManager.isLockdownSafe(repository(fullTunnelRequested = true)))
    assertFalse(VpnPolicyManager.isLockdownSafe(repository(fullTunnelRequested = false)))
  }

  @Test
  fun `lockdown safety always implies the tunnel routes all traffic`() {
    listOf(true, false).forEach { requested ->
      val repo = repository(requested)
      if (VpnPolicyManager.isLockdownSafe(repo)) {
        assertTrue(
          "lockdown must never be safe unless every destination is routed",
          VpnPolicyManager.routesAllTraffic(repo)
        )
      }
    }
  }
}
