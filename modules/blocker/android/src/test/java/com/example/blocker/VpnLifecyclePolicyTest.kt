package com.example.blocker

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VpnLifecyclePolicyTest {
  @Test
  fun `inactive intent always resolves inactive`() {
    val decision = evaluate(
      requested = false,
      state = VpnRuntimeState.ACTIVE,
      persistedActive = true,
      serviceRunning = true
    )

    assertEquals(VpnRuntimeState.INACTIVE, decision.runtimeState)
    assertFalse(decision.verifiedActive)
    assertFalse(decision.vpnDownIsTamper)
  }

  @Test
  fun `fresh start is starting without tamper`() {
    val decision = evaluate(
      state = VpnRuntimeState.STARTING,
      startElapsedMs = 1_000L,
      nowElapsedMs = 1_000L
    )

    assertEquals(VpnRuntimeState.STARTING, decision.runtimeState)
    assertTrue(decision.startupGraceActive)
    assertEquals(VpnLifecyclePolicy.STARTUP_GRACE_MS, decision.startupRemainingMs)
    assertFalse(decision.verifiedActive)
    assertFalse(decision.vpnDownIsTamper)
  }

  @Test
  fun `start remains in grace immediately before deadline`() {
    val decision = evaluate(
      state = VpnRuntimeState.STARTING,
      startElapsedMs = 0L,
      nowElapsedMs = VpnLifecyclePolicy.STARTUP_GRACE_MS - 1L
    )

    assertEquals(VpnRuntimeState.STARTING, decision.runtimeState)
    assertEquals(1L, decision.startupRemainingMs)
    assertFalse(decision.vpnDownIsTamper)
  }

  @Test
  fun `start fails exactly at grace deadline`() {
    val decision = evaluate(
      state = VpnRuntimeState.STARTING,
      startElapsedMs = 0L,
      nowElapsedMs = VpnLifecyclePolicy.STARTUP_GRACE_MS
    )

    assertEquals(VpnRuntimeState.FAILED, decision.runtimeState)
    assertFalse(decision.startupGraceActive)
    assertTrue(decision.vpnDownIsTamper)
  }

  @Test
  fun `elapsed realtime rollback cannot renew startup grace`() {
    val decision = evaluate(
      state = VpnRuntimeState.STARTING,
      startElapsedMs = 50_000L,
      nowElapsedMs = 1_000L
    )

    assertEquals(VpnRuntimeState.FAILED, decision.runtimeState)
    assertTrue(decision.vpnDownIsTamper)
  }

  @Test
  fun `active requires persisted and process runtime signals`() {
    val persistedOnly = evaluate(
      state = VpnRuntimeState.ACTIVE,
      persistedActive = true,
      serviceRunning = false
    )
    val processOnly = evaluate(
      state = VpnRuntimeState.ACTIVE,
      persistedActive = false,
      serviceRunning = true
    )
    val verified = evaluate(
      state = VpnRuntimeState.ACTIVE,
      persistedActive = true,
      serviceRunning = true
    )

    assertEquals(VpnRuntimeState.FAILED, persistedOnly.runtimeState)
    assertEquals(VpnRuntimeState.FAILED, processOnly.runtimeState)
    assertTrue(verified.verifiedActive)
    assertEquals(VpnRuntimeState.ACTIVE, verified.runtimeState)
  }

  @Test
  fun `stale persisted active is a failed tamper state`() {
    val decision = evaluate(
      state = VpnRuntimeState.ACTIVE,
      persistedActive = true,
      serviceRunning = false
    )

    assertEquals(VpnRuntimeState.FAILED, decision.runtimeState)
    assertTrue(decision.vpnDownIsTamper)
  }

  @Test
  fun `explicit failure remains failed and tamper eligible`() {
    val decision = evaluate(state = VpnRuntimeState.FAILED)

    assertEquals(VpnRuntimeState.FAILED, decision.runtimeState)
    assertFalse(decision.startupGraceActive)
    assertTrue(decision.vpnDownIsTamper)
  }

  private fun evaluate(
    requested: Boolean = true,
    state: VpnRuntimeState,
    persistedActive: Boolean = false,
    serviceRunning: Boolean = false,
    startElapsedMs: Long = VpnLifecyclePolicy.NO_START_REQUESTED,
    nowElapsedMs: Long = 0L
  ): VpnLifecycleDecision = VpnLifecyclePolicy.evaluate(
    snapshot = VpnRuntimeSnapshot(
      protectionRequested = requested,
      runtimeState = state,
      persistedActive = persistedActive,
      startRequestedElapsedMs = startElapsedMs,
      startFailure = null
    ),
    serviceRunning = serviceRunning,
    nowElapsedMs = nowElapsedMs
  )
}
