package com.example.blocker

import org.json.JSONArray

/**
 * Builds the "Recently Blocked" review list from raw audit events.
 *
 * Runs natively so only the final, capped list crosses the React Native bridge —
 * previously the entire audit log was serialized to JS and filtered there on
 * every open of the review card.
 */
object RecentBlockedAggregator {

  /**
   * [events] is the audit log, newest first. Aggregates DOMAIN_EVENT entries whose
   * action starts with "blocked" (blocklist, heuristic, upstream), skips domains the
   * user already allowlisted, and returns at most [limit] entries sorted by most
   * recently blocked.
   */
  fun aggregate(events: JSONArray, allowlisted: Set<String>, limit: Int): List<Map<String, Any?>> {
    if (limit <= 0) return emptyList()
    val byDomain = LinkedHashMap<String, Entry>()
    for (index in 0 until events.length()) {
      val event = events.optJSONObject(index) ?: continue
      if (event.optString("eventType") != "DOMAIN_EVENT") continue
      if (!event.optString("action").startsWith("blocked")) continue
      val domain = event.optString("subject").trim().lowercase()
      if (domain.isEmpty() || !domain.contains('.')) continue
      if (domain in allowlisted) continue
      val timestamp = event.optLong("timestamp")
      val existing = byDomain[domain]
      if (existing == null) {
        byDomain[domain] = Entry(
          domain = domain,
          category = event.optString("category").ifBlank { "adult" },
          lastBlockedAt = timestamp,
          count = 1
        )
      } else {
        existing.count += 1
        if (timestamp > existing.lastBlockedAt) existing.lastBlockedAt = timestamp
      }
    }
    return byDomain.values
      .sortedByDescending { it.lastBlockedAt }
      .take(limit)
      .map {
        mapOf(
          "domain" to it.domain,
          "category" to it.category,
          "lastBlockedAt" to it.lastBlockedAt,
          "count" to it.count
        )
      }
  }

  private class Entry(
    val domain: String,
    val category: String,
    var lastBlockedAt: Long,
    var count: Int
  )
}
