package com.example.blocker

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class RecentBlockedAggregatorTest {

  private fun domainEvent(
    subject: String,
    action: String = "blocked",
    category: String = "adult",
    timestamp: Long = 1_000L,
    eventType: String = "DOMAIN_EVENT"
  ): JSONObject = JSONObject()
    .put("eventType", eventType)
    .put("action", action)
    .put("category", category)
    .put("subject", subject)
    .put("timestamp", timestamp)

  private fun events(vararg items: JSONObject): JSONArray {
    val array = JSONArray()
    items.forEach { array.put(it) }
    return array
  }

  @Test
  fun `aggregates duplicate domains keeping newest timestamp and count`() {
    val result = RecentBlockedAggregator.aggregate(
      events(
        domainEvent("bad.example", timestamp = 3_000L),
        domainEvent("bad.example", timestamp = 1_000L),
        domainEvent("other.example", timestamp = 2_000L)
      ),
      allowlisted = emptySet(),
      limit = 10
    )

    assertEquals(2, result.size)
    assertEquals("bad.example", result[0]["domain"])
    assertEquals(3_000L, result[0]["lastBlockedAt"])
    assertEquals(2, result[0]["count"])
    assertEquals("other.example", result[1]["domain"])
  }

  @Test
  fun `includes heuristic and upstream block actions but not allows`() {
    val result = RecentBlockedAggregator.aggregate(
      events(
        domainEvent("a.example", action = "blocked_heuristic"),
        domainEvent("b.example", action = "blocked_upstream"),
        domainEvent("c.example", action = "allowed"),
        domainEvent("d.example", action = "forwarded")
      ),
      allowlisted = emptySet(),
      limit = 10
    )

    assertEquals(listOf("a.example", "b.example"), result.map { it["domain"] })
  }

  @Test
  fun `skips allowlisted domains non-domains and other event types`() {
    val result = RecentBlockedAggregator.aggregate(
      events(
        domainEvent("allowed.example"),
        domainEvent("no-dot"),
        domainEvent(""),
        domainEvent("app.package", eventType = "APP_EVENT"),
        domainEvent("KEPT.example", timestamp = 5_000L)
      ),
      allowlisted = setOf("allowed.example"),
      limit = 10
    )

    assertEquals(1, result.size)
    assertEquals("kept.example", result[0]["domain"])
  }

  @Test
  fun `caps the result at limit sorted by most recent`() {
    val result = RecentBlockedAggregator.aggregate(
      events(
        domainEvent("oldest.example", timestamp = 1L),
        domainEvent("newest.example", timestamp = 3L),
        domainEvent("middle.example", timestamp = 2L)
      ),
      allowlisted = emptySet(),
      limit = 2
    )

    assertEquals(listOf("newest.example", "middle.example"), result.map { it["domain"] })
  }

  @Test
  fun `blank category defaults to adult`() {
    val result = RecentBlockedAggregator.aggregate(
      events(domainEvent("x.example", category = "")),
      allowlisted = emptySet(),
      limit = 1
    )

    assertEquals("adult", result[0]["category"])
  }
}
