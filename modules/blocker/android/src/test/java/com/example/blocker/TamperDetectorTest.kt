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
class TamperDetectorTest {

  private lateinit var detector: TamperDetector
  private lateinit var repository: PolicyRepository
  private lateinit var context: Context

  @Before
  fun setup() {
    context = RuntimeEnvironment.getApplication()
    repository = mock()
    whenever(repository.isStrictModeEnabled()).thenReturn(true)
    whenever(repository.isProtectionRequested()).thenReturn(true)
    whenever(repository.isNotificationFilteringEnabled()).thenReturn(false)
    whenever(repository.isNotificationListenerConnected()).thenReturn(false)
    whenever(repository.recordAuditEvent(any(), any(), any(), any(), any(), any())).thenReturn(Unit)
    detector = TamperDetector(context, repository)
  }

  @Test
  fun `report returns list of tamper signals`() {
    val signals = detector.report(vpnActive = true)
    assertTrue("Should return multiple signals", signals.isNotEmpty())
  }

  @Test
  fun `vpn_down signal detected when vpn not active and protection requested`() {
    val signals = detector.report(vpnActive = false)
    val vpnSignal = signals.find { it.id == "vpn_down" }
    assertNotNull("vpn_down signal should exist", vpnSignal)
    assertTrue("vpn_down should be detected when VPN is off", vpnSignal!!.detected)
    assertEquals("critical", vpnSignal.severity)
  }

  @Test
  fun `vpn_down signal not detected when vpn active`() {
    val signals = detector.report(vpnActive = true)
    val vpnSignal = signals.find { it.id == "vpn_down" }
    assertNotNull(vpnSignal)
    assertFalse("vpn_down should not be detected when VPN is running", vpnSignal!!.detected)
  }

  @Test
  fun `safe_mode signal exists in report`() {
    val signals = detector.report(vpnActive = true)
    val safeModeSignal = signals.find { it.id == "safe_mode_active" }
    assertNotNull("safe_mode_active signal should exist", safeModeSignal)
    assertEquals("critical", safeModeSignal!!.severity)
  }

  @Test
  fun `evaluateAndRecord records audit events for detected signals`() {
    detector.evaluateAndRecord(vpnActive = false)
    verify(repository, atLeastOnce()).recordAuditEvent(
      eventType = eq("TAMPER_SIGNAL"),
      severity = any(),
      category = eq("tamper"),
      subject = any(),
      action = any()
    )
  }

  @Test
  fun `evaluateAndRecord sets tampered flag for critical signals`() {
    detector.evaluateAndRecord(vpnActive = false)
    verify(repository).setTampered(true)
  }

  @Test
  fun `TamperMonitor detects accessibility disabled`() {
    val monitor = TamperMonitor(repository, context)
    val enabled = monitor.isAccessibilityServiceEnabled(context)
    assertFalse("Accessibility should not be enabled in test", enabled)
  }

  @Test
  fun `TamperMonitor isTampered when VPN down`() {
    val monitor = TamperMonitor(repository)
    whenever(repository.isTampered()).thenReturn(false)
    whenever(repository.isProtectionRequested()).thenReturn(true)
    val tampered = monitor.isTampered(vpnActive = false)
    assertTrue("Should be tampered when VPN is down but protection requested", tampered)
  }

  @Test
  fun `TamperMonitor not tampered when VPN running`() {
    val monitor = TamperMonitor(repository)
    whenever(repository.isTampered()).thenReturn(false)
    whenever(repository.isProtectionRequested()).thenReturn(true)
    val tampered = monitor.isTampered(vpnActive = true)
    assertFalse("Should not be tampered when VPN is running", tampered)
  }
}
