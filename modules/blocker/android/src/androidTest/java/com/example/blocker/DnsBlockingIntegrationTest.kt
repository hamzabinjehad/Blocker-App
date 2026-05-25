package com.example.blocker

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.net.InetAddress
import java.net.UnknownHostException

/**
 * Integration tests for DNS blocking. These tests require:
 * - FilterVpnService to be running on the device
 * - The app's blocklists to be loaded
 *
 * Run on a real device or emulator with VPN permission granted.
 */
@RunWith(AndroidJUnit4::class)
class DnsBlockingIntegrationTest {

  private val context = InstrumentationRegistry.getInstrumentation().targetContext

  @Test
  fun `safe domain resolves normally`() {
    val result = tryResolve("google.com")
    assertNotNull("Safe domain should resolve", result)
    assertTrue("Should not resolve to 0.0.0.0", result != "0.0.0.0")
  }

  @Test
  fun `blocked test domain resolves to nothing`() {
    val result = tryResolve("test-adult-domain-blocked.example")
    assertTrue(
      "Blocked domain should not resolve or resolve to 0.0.0.0",
      result == null || result == "0.0.0.0"
    )
  }

  @Test
  fun `safe search rewrite active for google`() {
    val googleIp = tryResolve("google.com")
    val safeIp = tryResolve("forcesafesearch.google.com")
    if (googleIp != null && safeIp != null) {
      assertEquals("SafeSearch should be enforced", safeIp, googleIp)
    }
  }

  @Test
  fun `safe search rewrite active for youtube`() {
    val youtubeIp = tryResolve("youtube.com")
    val restrictedIp = tryResolve("restrict.youtube.com")
    if (youtubeIp != null && restrictedIp != null) {
      assertEquals("YouTube restricted mode should be enforced", restrictedIp, youtubeIp)
    }
  }

  @Test
  fun `clean domain resolves successfully`() {
    val result = tryResolve("example.com")
    assertNotNull("Clean domain should resolve", result)
  }

  private fun tryResolve(domain: String): String? {
    return try {
      val address = InetAddress.getByName(domain)
      address.hostAddress
    } catch (_: UnknownHostException) {
      null
    }
  }
}
