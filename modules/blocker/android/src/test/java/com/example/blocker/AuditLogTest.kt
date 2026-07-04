package com.example.blocker

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment

@RunWith(RobolectricTestRunner::class)
class AuditLogTest {

  private lateinit var prefs: SharedPreferences
  private var nowMs = 1_000_000L

  @Before
  fun setup() {
    prefs = RuntimeEnvironment.getApplication()
      .getSharedPreferences("audit_log_test", Context.MODE_PRIVATE)
    prefs.edit().clear().commit()
    AuditLog.reset()
    AuditLog.clock = { nowMs }
    // Prime the flush timer so the interval trigger is measured from "now",
    // not from process start.
    AuditLog.flush(prefs)
  }

  @After
  fun tearDown() {
    AuditLog.reset()
  }

  private fun event(id: String): JSONObject = JSONObject().put("id", id)

  private fun stored(): JSONArray = JSONArray(prefs.getString("auditEvents", "[]"))

  @Test
  fun `urgent events flush immediately`() {
    AuditLog.record(prefs, event("a"), urgent = true)
    assertEquals(1, stored().length())
    assertEquals("a", stored().getJSONObject(0).getString("id"))
  }

  @Test
  fun `non-urgent events buffer in memory`() {
    repeat(5) { AuditLog.record(prefs, event("e$it"), urgent = false) }
    assertEquals(0, stored().length())
  }

  @Test
  fun `snapshot flushes and returns newest first`() {
    repeat(5) { AuditLog.record(prefs, event("e$it"), urgent = false) }
    val snapshot = AuditLog.snapshot(prefs)
    assertEquals(5, snapshot.length())
    assertEquals("e4", snapshot.getJSONObject(0).getString("id"))
    assertEquals("e0", snapshot.getJSONObject(4).getString("id"))
  }

  @Test
  fun `buffer flushes once threshold is reached`() {
    repeat(20) { AuditLog.record(prefs, event("e$it"), urgent = false) }
    assertEquals(20, stored().length())
  }

  @Test
  fun `buffer flushes once interval has passed`() {
    AuditLog.record(prefs, event("early"), urgent = false)
    assertEquals(0, stored().length())
    nowMs += 6_000L
    AuditLog.record(prefs, event("late"), urgent = false)
    assertEquals(2, stored().length())
    assertEquals("late", stored().getJSONObject(0).getString("id"))
  }

  @Test
  fun `urgent flush carries buffered events with it`() {
    AuditLog.record(prefs, event("buffered"), urgent = false)
    AuditLog.record(prefs, event("critical"), urgent = true)
    assertEquals(2, stored().length())
    assertEquals("critical", stored().getJSONObject(0).getString("id"))
    assertEquals("buffered", stored().getJSONObject(1).getString("id"))
  }

  @Test
  fun `stored log is capped at 100 events`() {
    repeat(120) { AuditLog.record(prefs, event("e$it"), urgent = true) }
    assertEquals(100, stored().length())
    // Newest survives, oldest are dropped.
    assertEquals("e119", stored().getJSONObject(0).getString("id"))
    assertEquals("e20", stored().getJSONObject(99).getString("id"))
  }

  @Test
  fun `corrupt stored payload is replaced not fatal`() {
    prefs.edit().putString("auditEvents", "{not json").commit()
    AuditLog.record(prefs, event("a"), urgent = true)
    assertEquals(1, stored().length())
  }
}
