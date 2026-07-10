package com.example.blocker

import android.content.Context
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import android.os.Build
import org.junit.runner.RunWith
import org.mockito.kotlin.*
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [Build.VERSION_CODES.TIRAMISU]) // exercise the Android-9+ managed Private DNS path
class PrivateDnsProtectionManagerTest {

  private lateinit var context: Context
  private lateinit var repository: PolicyRepository

  @Before
  fun setup() {
    context = RuntimeEnvironment.getApplication()
    repository = mock()
    whenever(repository.isStrictModeEnabled()).thenReturn(false)
    whenever(repository.isPrivateDnsProtectionEnabled()).thenReturn(false)
    doNothing().whenever(repository).assertCanChangePolicy(anyOrNull())
  }

  // ── Family-safe host validation ────────────────────────────────────────

  @Test
  fun `accepts known family-safe hosts including subdomains`() {
    listOf(
      "family.cloudflare-dns.com",
      "dns.cleanbrowsing.org",
      "family-filter-dns.cleanbrowsing.org",
      "doh.familyshield.opendns.com",
      "family.adguard-dns.com"
    ).forEach { host ->
      assertTrue(host, PrivateDnsProtectionManager.isFamilySafeHost(host))
    }
  }

  @Test
  fun `rejects unfiltered or unknown resolvers`() {
    listOf(
      "one.one.one.one",      // Cloudflare unfiltered
      "dns.google",
      "1.1.1.1",
      "cloudflare-dns.com",   // non-family Cloudflare
      "evil.example.com",
      ""
    ).forEach { host ->
      assertFalse(host, PrivateDnsProtectionManager.isFamilySafeHost(host))
    }
  }

  @Test
  fun `host matching ignores case and trailing dots`() {
    assertTrue(PrivateDnsProtectionManager.isFamilySafeHost("Family.Cloudflare-DNS.com."))
  }

  // ── Enable / disable without device ownership ──────────────────────────
  // Robolectric is not a device owner, so enable() takes the graceful-degradation path.

  @Test
  fun `enable refuses a non family host before touching device policy`() {
    val result = PrivateDnsProtectionManager.enable(context, repository, "dns.google")
    assertEquals(false, result["applied"])
    assertEquals("host_not_family_safe", result["reason"])
  }

  @Test
  fun `enable reports device owner requirement for a valid host`() {
    val result = PrivateDnsProtectionManager.enable(context, repository, "family.cloudflare-dns.com")
    assertEquals(false, result["applied"])
    assertEquals("device_owner_or_profile_owner_required", result["reason"])
  }

  @Test
  fun `disable clears the preference and succeeds even without ownership`() {
    val result = PrivateDnsProtectionManager.disable(context, repository)
    assertEquals(true, result["applied"])
    // The stored flag is always cleared so a stale "enabled" cannot outlive an un-owned device.
    verify(repository).setPrivateDnsProtectionEnabled(eq(false), anyOrNull())
  }

  @Test
  fun `status reports unsupported and inactive without ownership`() {
    val status = PrivateDnsProtectionManager.status(context, repository)
    assertEquals(false, status["supported"])
    assertEquals(false, status["active"])
    assertEquals(PrivateDnsProtectionManager.DEFAULT_HOST, status["defaultHost"])
  }
}
