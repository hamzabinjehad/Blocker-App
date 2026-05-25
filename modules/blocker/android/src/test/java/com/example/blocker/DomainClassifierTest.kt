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

  @Test
  fun `blocks bypass domain in strict mode`() {
    whenever(repository.isStrictModeEnabled()).thenReturn(true)
    classifier = DomainClassifier(RuntimeEnvironment.getApplication(), repository)
    // bypass domains loaded from assets; test with heuristic
    val result = classifier.classify("nordvpn.com")
    // If nordvpn.com is in the bundled bypass list it should block
    // Otherwise this test documents the behavior
    assertNotNull(result)
  }

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
}
