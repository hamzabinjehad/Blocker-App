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
class UrlPolicyEvaluatorTest {

  private lateinit var evaluator: UrlPolicyEvaluator
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
    whenever(repository.recordDomainEvent(any(), any(), any())).thenReturn(true)
    doNothing().whenever(repository).recordAuditEvent(any(), any(), any(), any(), any(), any())
    evaluator = UrlPolicyEvaluator(context, repository)
  }

  // ── URL path blocking ──────────────────────────────────────────────────

  @Test
  fun `blocks URL with adult keyword in path`() {
    val result = evaluator.evaluateHttpRequest("example.com", "/porn/video.mp4", "GET")
    assertTrue(result.blocked)
  }

  @Test
  fun `blocks URL with adult keyword in query string`() {
    val result = evaluator.evaluateHttpRequest("example.com", "/search?q=naked+girls", "GET")
    assertTrue(result.blocked)
  }

  // ── SafeSearch injection ───────────────────────────────────────────────

  @Test
  fun `adds safe=active to google search`() {
    val result = evaluator.evaluateHttpRequest("www.google.com", "/search?q=cats", "GET")
    assertNotNull(result.rewrittenPath)
    assertTrue(result.rewrittenPath!!.contains("safe=active"))
  }

  @Test
  fun `adds adlt=strict to bing search`() {
    val result = evaluator.evaluateHttpRequest("www.bing.com", "/search?q=dogs", "GET")
    assertNotNull(result.rewrittenPath)
    assertTrue(result.rewrittenPath!!.contains("adlt=strict"))
  }

  // ── Safe URLs ──────────────────────────────────────────────────────────

  @Test
  fun `allows clean URL`() {
    val result = evaluator.evaluateHttpRequest("wikipedia.org", "/wiki/Cat", "GET")
    assertFalse(result.blocked)
  }

  @Test
  fun `allows clean search URL`() {
    val result = evaluator.evaluateHttpRequest("www.google.com", "/search?q=weather", "GET")
    assertFalse(result.blocked)
  }
}
