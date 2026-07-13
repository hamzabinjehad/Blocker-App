package com.example.blocker.behavior

import android.view.accessibility.AccessibilityEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ScreenshotAuditGateTest {

  @Test
  fun `first audit event acquires the gate`() {
    val gate = ScreenshotAuditGate()

    assertTrue(gate.tryAcquire(nowElapsedMs = 1_000L, intervalMs = 4_000L))
  }

  @Test
  fun `events before the interval are rejected`() {
    val gate = ScreenshotAuditGate()
    assertTrue(gate.tryAcquire(nowElapsedMs = 1_000L, intervalMs = 4_000L))

    assertFalse(gate.tryAcquire(nowElapsedMs = 1_001L, intervalMs = 4_000L))
    assertFalse(gate.tryAcquire(nowElapsedMs = 4_999L, intervalMs = 4_000L))
  }

  @Test
  fun `same screen can be audited again when the interval elapses`() {
    val gate = ScreenshotAuditGate()
    assertTrue(gate.tryAcquire(nowElapsedMs = 1_000L, intervalMs = 4_000L))

    assertTrue(gate.tryAcquire(nowElapsedMs = 5_000L, intervalMs = 4_000L))
  }

  @Test
  fun `a backwards timestamp cannot open the gate`() {
    val gate = ScreenshotAuditGate()
    assertTrue(gate.tryAcquire(nowElapsedMs = 10_000L, intervalMs = 4_000L))

    assertFalse(gate.tryAcquire(nowElapsedMs = 9_000L, intervalMs = 4_000L))
  }

  @Test
  fun `window content and scroll events request screenshot audits`() {
    val visualEvents = listOf(
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
      AccessibilityEvent.TYPE_WINDOWS_CHANGED,
      AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
      AccessibilityEvent.TYPE_VIEW_FOCUSED,
      AccessibilityEvent.TYPE_VIEW_CLICKED,
      AccessibilityEvent.TYPE_VIEW_SCROLLED
    )

    visualEvents.forEach { eventType ->
      assertTrue(ScreenshotAuditEventPolicy.shouldRequestAudit(eventType))
    }
  }

  @Test
  fun `text changes do not request extra screenshot audits`() {
    assertFalse(
      ScreenshotAuditEventPolicy.shouldRequestAudit(AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED)
    )
  }

  @Test
  fun `real-time image scanning keeps its short interval`() {
    assertEquals(
      ScreenshotScanPolicy.REALTIME_INTERVAL_MS,
      ScreenshotScanPolicy.effectiveIntervalMs(
        imageScanningEnabled = true,
        screenshotAuditEnabled = false,
        screenshotAuditIntervalMs = 15 * 60_000L
      )
    )
  }

  @Test
  fun `accountability audit uses its configured interval when running alone`() {
    val configuredInterval = 15 * 60_000L

    assertEquals(
      configuredInterval,
      ScreenshotScanPolicy.effectiveIntervalMs(
        imageScanningEnabled = false,
        screenshotAuditEnabled = true,
        screenshotAuditIntervalMs = configuredInterval
      )
    )
  }

  @Test
  fun `enabling accountability audit does not slow real-time blocking`() {
    assertEquals(
      ScreenshotScanPolicy.REALTIME_INTERVAL_MS,
      ScreenshotScanPolicy.effectiveIntervalMs(
        imageScanningEnabled = true,
        screenshotAuditEnabled = true,
        screenshotAuditIntervalMs = 15 * 60_000L
      )
    )
  }

  @Test
  fun `disabled scan policies do not schedule captures`() {
    assertNull(
      ScreenshotScanPolicy.effectiveIntervalMs(
        imageScanningEnabled = false,
        screenshotAuditEnabled = false,
        screenshotAuditIntervalMs = 15 * 60_000L
      )
    )
  }
}
