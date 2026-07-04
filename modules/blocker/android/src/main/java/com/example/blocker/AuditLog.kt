package com.example.blocker

import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Process-wide write buffer for the encrypted audit log.
 *
 * Writing an event used to re-read, re-build, re-encrypt and re-write the entire stored
 * array — on every blocked DNS query. Events are now buffered in memory and flushed in
 * batches: immediately for critical events, otherwise once [FLUSH_THRESHOLD] events or
 * [FLUSH_INTERVAL_MS] accumulate. Reads always flush first, so callers see a consistent
 * log. The trade-off: a process kill can drop up to a few seconds of non-critical events.
 */
object AuditLog {
  // Newest event at the front, matching the stored array's ordering.
  private val pending = ArrayDeque<JSONObject>()
  private var lastFlushAtMs = 0L

  // Injectable for unit tests.
  internal var clock: () -> Long = { System.currentTimeMillis() }

  @Synchronized
  fun record(preferences: SharedPreferences, event: JSONObject, urgent: Boolean) {
    pending.addFirst(event)
    val now = clock()
    if (urgent || pending.size >= FLUSH_THRESHOLD || now - lastFlushAtMs >= FLUSH_INTERVAL_MS) {
      flush(preferences)
    }
  }

  @Synchronized
  fun flush(preferences: SharedPreferences) {
    lastFlushAtMs = clock()
    if (pending.isEmpty()) return

    val stored = storedJson(preferences)
    val compact = JSONArray()
    pending.forEach { compact.put(it) }
    for (index in 0 until minOf(stored.length(), MAX_AUDIT_EVENTS - pending.size)) {
      compact.put(stored.optJSONObject(index))
    }
    pending.clear()
    preferences.edit().putString(KEY_AUDIT_EVENTS, compact.toString()).apply()
  }

  /** Flushes any buffered events and returns the full stored log, newest first. */
  @Synchronized
  fun snapshot(preferences: SharedPreferences): JSONArray {
    flush(preferences)
    return storedJson(preferences)
  }

  @Synchronized
  internal fun reset() {
    pending.clear()
    lastFlushAtMs = 0L
    clock = { System.currentTimeMillis() }
  }

  private fun storedJson(preferences: SharedPreferences): JSONArray {
    return try {
      JSONArray(preferences.getString(KEY_AUDIT_EVENTS, "[]") ?: "[]")
    } catch (_: Exception) {
      JSONArray()
    }
  }

  private const val KEY_AUDIT_EVENTS = "auditEvents"
  private const val MAX_AUDIT_EVENTS = 100
  private const val FLUSH_THRESHOLD = 20
  private const val FLUSH_INTERVAL_MS = 5_000L
}
