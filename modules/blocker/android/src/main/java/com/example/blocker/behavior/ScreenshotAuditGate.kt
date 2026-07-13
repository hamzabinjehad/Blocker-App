package com.example.blocker.behavior

import android.view.accessibility.AccessibilityEvent
import java.util.concurrent.atomic.AtomicLong

/** Visual events that may reveal new on-screen media without changing screens or apps. */
internal object ScreenshotAuditEventPolicy {
  fun shouldRequestAudit(eventType: Int): Boolean = when (eventType) {
    AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
    AccessibilityEvent.TYPE_WINDOWS_CHANGED,
    AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
    AccessibilityEvent.TYPE_VIEW_FOCUSED,
    AccessibilityEvent.TYPE_VIEW_CLICKED,
    AccessibilityEvent.TYPE_VIEW_SCROLLED -> true
    else -> false
  }
}

/** Combines the real-time blocker and the slower accountability audit without downgrading either. */
internal object ScreenshotScanPolicy {
  const val REALTIME_INTERVAL_MS = 4_000L

  fun effectiveIntervalMs(
    imageScanningEnabled: Boolean,
    screenshotAuditEnabled: Boolean,
    screenshotAuditIntervalMs: Long
  ): Long? {
    val realtimeInterval = REALTIME_INTERVAL_MS.takeIf { imageScanningEnabled }
    val auditInterval = screenshotAuditIntervalMs.coerceAtLeast(0L).takeIf { screenshotAuditEnabled }
    return listOfNotNull(realtimeInterval, auditInterval).minOrNull()
  }
}

/**
 * Owns screenshot-audit rate limiting. Callers pass a monotonic timestamp so wall-clock
 * changes cannot suppress scanning or trigger a burst of captures.
 */
internal class ScreenshotAuditGate {
  private val lastAcceptedAtMs = AtomicLong(NO_ACCEPTED_SCAN)

  fun tryAcquire(nowElapsedMs: Long, intervalMs: Long): Boolean {
    val normalizedNow = nowElapsedMs.coerceAtLeast(0L)
    val normalizedInterval = intervalMs.coerceAtLeast(0L)

    while (true) {
      val previous = lastAcceptedAtMs.get()
      if (previous != NO_ACCEPTED_SCAN) {
        if (normalizedNow < previous || normalizedNow - previous < normalizedInterval) {
          return false
        }
      }
      if (lastAcceptedAtMs.compareAndSet(previous, normalizedNow)) return true
    }
  }

  private companion object {
    const val NO_ACCEPTED_SCAN = -1L
  }
}
