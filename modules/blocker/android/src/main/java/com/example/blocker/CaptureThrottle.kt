package com.example.blocker

class CaptureThrottle(private val defaultIntervalMs: Long = 3000L) {
  private val lastCapture = mutableMapOf<String, Long>()

  fun shouldCapture(packageName: String, intervalMs: Long = defaultIntervalMs): Boolean {
    val now = System.currentTimeMillis()
    val last = lastCapture[packageName] ?: 0L
    if (now - last < intervalMs) return false
    lastCapture[packageName] = now
    return true
  }
}
