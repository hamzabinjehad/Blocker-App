package com.example.blocker

import android.content.Context
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.kotlin.*
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment

@RunWith(RobolectricTestRunner::class)
class DomainClassifierTest {

  private lateinit var classifier: DomainClassifier
  private lateinit var repository: PolicyRepository

  @Before
  fun setup() {
    val context = RuntimeEnvironment.getApplication()
    repository = mock()
    whenever(repository.isAdultFilteringEnabled()).thenReturn(true)
    whenever(repository.isStrictModeEnabled()).thenReturn(false)
    whenever(repository.shouldBlockBypassDomains()).thenReturn(false)
    whenever(repository.isBlockUnknownSearchEnginesEnabled()).thenReturn(false)
    whenever(repository.isGoogleSafeSearchEnabled()).thenReturn(true)
    whenever(repository.isBingSafeSearchEnabled()).thenReturn(true)
    whenever(repository.isYoutubeRestrictedEnabled()).thenReturn(true)
    whenever(repository.isDuckDuckGoSafeSearchEnabled()).thenReturn(true)
    whenever(repository.allowlistedDomains()).thenReturn(emptySet())
    whenever(repository.blockedDomains()).thenReturn(emptySet())
    classifier = DomainClassifier(context, repository)
  }

  // ── Allowlist must not become a master key ─────────────────────────────

  /**
   * Robolectric cannot read this module's merged assets, so the real bypass/adult lists are
   * empty in unit tests — which is why the older `blocks bypass domain in strict mode` case
   * could only assert non-null. Inject a snapshot instead so these paths are actually covered.
   */
  private fun classifierWithBypassList(vararg bypassDomains: String): DomainClassifier =
    DomainClassifier(
      RuntimeEnvironment.getApplication(),
      repository,
      BlocklistSnapshot(
        adultMatcher = EmptyDomainMatcher,
        bypassDomains = bypassDomains.toSet(),
        allowDomains = emptySet(),
        dnsRewriteRules = emptyList(),
        activeKeywords = emptySet(),
        activeKeywordRules = emptyList(),
        generatedAt = "test",
        adultDomainCount = 0,
        bypassDomainCount = bypassDomains.size,
        allowDomainCount = 0,
        activeKeywordCount = 0
      )
    )

  @Test
  fun `bypass domain is blocked in strict mode`() {
    whenever(repository.isStrictModeEnabled()).thenReturn(true)
    val result = classifierWithBypassList("nordvpn.com").classify("nordvpn.com")
    assertEquals(DomainClassification.Action.BLOCK, result.action)
    assertEquals(DomainClassifier.CATEGORY_BYPASS, result.category)
  }

  @Test
  fun `allowlisting a bypass domain has no effect while strict mode is on`() {
    whenever(repository.isStrictModeEnabled()).thenReturn(true)
    whenever(repository.allowlistedDomains()).thenReturn(setOf("nordvpn.com"))

    val result = classifierWithBypassList("nordvpn.com").classify("nordvpn.com")
    assertEquals(DomainClassification.Action.BLOCK, result.action)
    assertEquals(DomainClassifier.CATEGORY_BYPASS, result.category)
  }

  @Test
  fun `allowlisting a bypass domain has no effect on its subdomains either`() {
    whenever(repository.shouldBlockBypassDomains()).thenReturn(true)
    whenever(repository.allowlistedDomains()).thenReturn(setOf("nordvpn.com"))

    // matchesAny walks parents, so the entry would otherwise unlock every subdomain too.
    val result = classifierWithBypassList("nordvpn.com").classify("downloads.nordvpn.com")
    assertEquals(DomainClassification.Action.BLOCK, result.action)
    assertEquals(DomainClassifier.CATEGORY_BYPASS, result.category)
  }

  @Test
  fun `allowlisting a bypass domain still works when bypass blocking is off`() {
    whenever(repository.isStrictModeEnabled()).thenReturn(false)
    whenever(repository.shouldBlockBypassDomains()).thenReturn(false)
    whenever(repository.allowlistedDomains()).thenReturn(setOf("nordvpn.com"))

    val result = classifierWithBypassList("nordvpn.com").classify("nordvpn.com")
    assertEquals(DomainClassification.Action.ALLOW, result.action)
    assertEquals(DomainClassifier.CATEGORY_ALLOWLIST, result.category)
  }

  @Test
  fun `allowlisting an ordinary domain still works under strict mode`() {
    whenever(repository.isStrictModeEnabled()).thenReturn(true)
    whenever(repository.allowlistedDomains()).thenReturn(setOf("example.com"))

    val result = classifierWithBypassList("nordvpn.com").classify("example.com")
    assertEquals(DomainClassification.Action.ALLOW, result.action)
    assertEquals(DomainClassifier.CATEGORY_ALLOWLIST, result.category)
  }

  // ── Adult domain blocking ──────────────────────────────────────────────

  @Test
  fun `blocks known adult domain from blocklist`() {
    whenever(repository.blockedDomains()).thenReturn(setOf("pornhub.com"))
    classifier = DomainClassifier(RuntimeEnvironment.getApplication(), repository)
    val result = classifier.classify("pornhub.com")
    assertEquals(DomainClassification.Action.BLOCK, result.action)
  }

  @Test
  fun `blocks adult subdomain`() {
    whenever(repository.blockedDomains()).thenReturn(setOf("xvideos.com"))
    classifier = DomainClassifier(RuntimeEnvironment.getApplication(), repository)
    val result = classifier.classify("www.xvideos.com")
    assertEquals(DomainClassification.Action.BLOCK, result.action)
  }

  @Test
  fun `blocks heuristic adult domain - leet speak`() {
    val result = classifier.classify("p0rnhub.net")
    assertEquals(DomainClassification.Action.BLOCK, result.action)
    assertTrue("heuristic blocks must be marked for audit", result.heuristic)
  }

  @Test
  fun `blocklist hits are not marked heuristic`() {
    whenever(repository.blockedDomains()).thenReturn(setOf("pornhub.com"))
    classifier = DomainClassifier(RuntimeEnvironment.getApplication(), repository)
    val result = classifier.classify("pornhub.com")
    assertEquals(DomainClassification.Action.BLOCK, result.action)
    assertFalse(result.heuristic)
  }

  @Test
  fun `blocks heuristic adult domain - obfuscated`() {
    val result = classifier.classify("s3xvideos.com")
    assertEquals(DomainClassification.Action.BLOCK, result.action)
  }

  @Test
  fun `blocks adult TLD xxx`() {
    val result = classifier.classify("anything.xxx")
    assertEquals(DomainClassification.Action.BLOCK, result.action)
  }

  @Test
  fun `blocks adult TLD porn`() {
    val result = classifier.classify("something.porn")
    assertEquals(DomainClassification.Action.BLOCK, result.action)
  }

  @Test
  fun `blocks domain with strong marker`() {
    val result = classifier.classify("free-hentai-videos.com")
    assertEquals(DomainClassification.Action.BLOCK, result.action)
  }

  @Test
  fun `blocks domain with platform marker`() {
    val result = classifier.classify("chaturbate-mirror.com")
    assertEquals(DomainClassification.Action.BLOCK, result.action)
  }

  @Test
  fun `blocks domain matching adult regex`() {
    val result = classifier.classify("xvideo-stream.io")
    assertEquals(DomainClassification.Action.BLOCK, result.action)
  }

  // ── Safe domains ───────────────────────────────────────────────────────

  @Test
  fun `allows allowlisted domain`() {
    whenever(repository.allowlistedDomains()).thenReturn(setOf("example.com"))
    classifier = DomainClassifier(RuntimeEnvironment.getApplication(), repository)
    val result = classifier.classify("example.com")
    assertEquals(DomainClassification.Action.ALLOW, result.action)
  }

  @Test
  fun `does not block amazon`() {
    val result = classifier.classify("amazon.com")
    assertNotEquals(DomainClassification.Action.BLOCK, result.action)
  }

  @Test
  fun `does not block wikipedia`() {
    val result = classifier.classify("wikipedia.org")
    assertNotEquals(DomainClassification.Action.BLOCK, result.action)
  }

  // ── Bypass tool blocking ───────────────────────────────────────────────
  // `bypass domain is blocked in strict mode` lives with the allowlist-guardrail cases above,
  // where a snapshot is injected so the bypass list is actually populated.

  @Test
  fun `allows bypass domain when strict mode off`() {
    whenever(repository.isStrictModeEnabled()).thenReturn(false)
    whenever(repository.shouldBlockBypassDomains()).thenReturn(false)
    classifier = DomainClassifier(RuntimeEnvironment.getApplication(), repository)
    val result = classifier.classify("nordvpn.com")
    assertNotEquals(DomainClassification.Action.BLOCK, result.action)
  }

  // ── SafeSearch rewrites ────────────────────────────────────────────────

  @Test
  fun `rewrites google to forcesafesearch`() {
    val result = classifier.classify("www.google.com")
    assertEquals(DomainClassification.Action.FORCE_SAFE_SEARCH, result.action)
    assertEquals("forcesafesearch.google.com", result.rewriteTarget)
  }

  @Test
  fun `rewrites youtube to restricted mode`() {
    val result = classifier.classify("youtube.com")
    assertEquals(DomainClassification.Action.FORCE_SAFE_SEARCH, result.action)
    assertEquals("restrict.youtube.com", result.rewriteTarget)
  }

  @Test
  fun `rewrites google country domains outside the static list`() {
    // Not present in GOOGLE_COUNTRY_TLDS — must be caught by the generic ccTLD matcher.
    for (domain in listOf("google.com.om", "www.google.com.om", "google.kz", "google.co.ke")) {
      val result = classifier.classify(domain)
      assertEquals("$domain should be forced", DomainClassification.Action.FORCE_SAFE_SEARCH, result.action)
      assertEquals("forcesafesearch.google.com", result.rewriteTarget)
    }
  }

  @Test
  fun `rewrites youtube country domains via generic matcher`() {
    val result = classifier.classify("youtube.com.kw")
    assertEquals(DomainClassification.Action.FORCE_SAFE_SEARCH, result.action)
    assertEquals("restrict.youtube.com", result.rewriteTarget)
  }

  @Test
  fun `does not treat lookalike domains as google country domains`() {
    for (domain in listOf("google.com.evil.example", "notgoogle.fr", "google.org")) {
      val result = classifier.classify(domain)
      assertNotEquals("$domain must not be rewritten", DomainClassification.Action.FORCE_SAFE_SEARCH, result.action)
    }
  }

  // ── Edge cases ─────────────────────────────────────────────────────────

  @Test
  fun `handles empty domain`() {
    val result = classifier.classify("")
    assertNotNull(result)
    assertEquals(DomainClassification.Action.ALLOW, result.action)
  }

  @Test
  fun `handles domain with trailing dot`() {
    val result = classifier.classify("free-hentai.com.")
    assertEquals(DomainClassification.Action.BLOCK, result.action)
  }

  @Test
  fun `does not block when adult filtering disabled`() {
    whenever(repository.isAdultFilteringEnabled()).thenReturn(false)
    classifier = DomainClassifier(RuntimeEnvironment.getApplication(), repository)
    val result = classifier.classify("some-adult-sounding-tube.com")
    assertEquals(DomainClassification.Action.ALLOW, result.action)
  }

  // ── False-positive regression: benign domains that merely contain a short marker ────

  @Test
  fun `does not block benign domains containing adult substrings`() {
    // Each of these previously matched a raw substring / regex and was wrongly blocked.
    val benign = listOf(
      "stripe.com",        // "strip"
      "essex.com",         // "sex"
      "sussex.ac.uk",      // "sex"
      "middlesex.edu",     // "sex"
      "wessex.gov.uk",     // "sex"
      "analog.com",        // "anal"
      "analogdevices.com", // "anal"
      "canal.com",         // "anal"
      "banal.org",         // "anal"
      "twinkl.co.uk",      // "twink" (children's education site!)
      "camscanner.com",    // "cams"
      "campus.edu",        // "cam"
      "camera-store.com",  // "cam"
      "fukuoka.jp",        // matched old f*** regex
      "jasmine.com",       // "jasmin"
      "wickedlocal.com",   // "wicked"
      "scunthorpe.gov.uk", // classic profanity-substring trap
      "adulteducation.org",// "adult" + benign suffix
      "sexualhealth.org",  // "sex" + benign suffix
      "expressvpn-blog.com"
    )
    for (domain in benign) {
      val result = classifier.classify(domain)
      assertNotEquals("Expected $domain to be allowed", DomainClassification.Action.BLOCK, result.action)
    }
  }

  // ── True-positive: unambiguous adult compounds still blocked ────────────────────────

  @Test
  fun `blocks unambiguous adult compound domains`() {
    val adult = listOf(
      "sex.com",
      "freeporn.net",
      "sexcams.com",
      "adultvideos.com",
      "milfporn.com",
      "hotmilf.net",
      "xnxx.com",
      "camsex.tv"
    )
    for (domain in adult) {
      val result = classifier.classify(domain)
      assertEquals("Expected $domain to be blocked", DomainClassification.Action.BLOCK, result.action)
    }
  }
}
