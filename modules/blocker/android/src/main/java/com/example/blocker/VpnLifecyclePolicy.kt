package com.example.blocker

internal enum class VpnRuntimeState(val persistedValue: String) {
  INACTIVE("inactive"),
  STARTING("starting"),
  ACTIVE("active"),
  FAILED("failed");

  companion object {
    fun fromPersisted(value: String?): VpnRuntimeState? =
      entries.firstOrNull { it.persistedValue == value }
  }
}

internal data class VpnRuntimeSnapshot(
  val protectionRequested: Boolean,
  val runtimeState: VpnRuntimeState,
  val persistedActive: Boolean,
  val startRequestedElapsedMs: Long,
  val startFailure: String?
)

internal data class VpnLifecycleDecision(
  val runtimeState: VpnRuntimeState,
  val verifiedActive: Boolean,
  val startupGraceActive: Boolean,
  val startupRemainingMs: Long,
  val vpnDownIsTamper: Boolean
)

/**
 * Resolves persisted VPN state against the process-local service signal.
 *
 * Callers provide a monotonic timestamp so wall-clock changes cannot extend startup grace.
 * A timestamp from an earlier boot is greater than the new elapsed-realtime value and is
 * therefore treated as an expired start, never as a fresh grace period.
 */
internal object VpnLifecyclePolicy {
  const val STARTUP_GRACE_MS = 30_000L
  const val NO_START_REQUESTED = -1L

  fun evaluate(
    snapshot: VpnRuntimeSnapshot,
    serviceRunning: Boolean,
    nowElapsedMs: Long,
    startupGraceMs: Long = STARTUP_GRACE_MS
  ): VpnLifecycleDecision {
    if (!snapshot.protectionRequested) {
      return VpnLifecycleDecision(
        runtimeState = VpnRuntimeState.INACTIVE,
        verifiedActive = false,
        startupGraceActive = false,
        startupRemainingMs = 0L,
        vpnDownIsTamper = false
      )
    }

    val verifiedActive = snapshot.runtimeState == VpnRuntimeState.ACTIVE &&
      snapshot.persistedActive &&
      serviceRunning
    if (verifiedActive) {
      return VpnLifecycleDecision(
        runtimeState = VpnRuntimeState.ACTIVE,
        verifiedActive = true,
        startupGraceActive = false,
        startupRemainingMs = 0L,
        vpnDownIsTamper = false
      )
    }

    val normalizedGraceMs = startupGraceMs.coerceAtLeast(0L)
    val startElapsedMs = snapshot.startRequestedElapsedMs
    val validMonotonicReference = startElapsedMs != NO_START_REQUESTED &&
      startElapsedMs >= 0L &&
      nowElapsedMs >= startElapsedMs
    val elapsedSinceStart = if (validMonotonicReference) {
      nowElapsedMs - startElapsedMs
    } else {
      Long.MAX_VALUE
    }
    val startupGraceActive = snapshot.runtimeState == VpnRuntimeState.STARTING &&
      validMonotonicReference &&
      elapsedSinceStart < normalizedGraceMs
    val resolvedState = if (startupGraceActive) {
      VpnRuntimeState.STARTING
    } else {
      VpnRuntimeState.FAILED
    }

    return VpnLifecycleDecision(
      runtimeState = resolvedState,
      verifiedActive = false,
      startupGraceActive = startupGraceActive,
      startupRemainingMs = if (startupGraceActive) normalizedGraceMs - elapsedSinceStart else 0L,
      vpnDownIsTamper = !startupGraceActive
    )
  }
}
