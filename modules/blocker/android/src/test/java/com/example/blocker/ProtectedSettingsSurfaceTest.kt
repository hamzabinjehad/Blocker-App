package com.example.blocker

import com.example.blocker.behavior.ScreenContextDetector
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class ProtectedSettingsSurfaceTest {
  private val ownPackageName = "com.example.parentblocker"
  private val appLabels = listOf("Control Yourself", "Parent Blocker")

  @Test
  fun `blocks launcher uninstall menu for own app`() {
    val feature = match(
      packageName = "com.google.android.apps.nexuslauncher",
      screenText = "Control Yourself App info Remove Uninstall"
    )

    assertNotNull(feature)
    assertEquals("protectedLauncherUninstall", feature!!.key)
    assertEquals("Launcher uninstall", feature.screen)
  }

  @Test
  fun `blocks private dns settings`() {
    val feature = match(
      packageName = "com.android.settings",
      screenText = "Network & internet Private DNS Private DNS provider hostname"
    )

    assertNotNull(feature)
    assertEquals("protectedDnsSettings", feature!!.key)
    assertEquals("DNS settings", feature.screen)
  }

  @Test
  fun `blocks dns server settings`() {
    val feature = match(
      packageName = "com.android.settings",
      screenText = "Wi-Fi Advanced IP settings Static DNS server DNS 1 DNS 2"
    )

    assertNotNull(feature)
    assertEquals("protectedDnsSettings", feature!!.key)
  }

  @Test
  fun `blocks accessibility settings for protection app`() {
    val feature = match(
      packageName = "com.android.settings",
      screenText = "Accessibility Installed apps Control Yourself Off"
    )

    assertNotNull(feature)
    assertEquals("protectedSystemSettings", feature!!.key)
  }

  @Test
  fun `blocks vpn and device admin settings`() {
    val vpnFeature = match(
      packageName = "com.android.settings",
      screenText = "VPN Control Yourself connected"
    )
    val adminFeature = match(
      packageName = "com.android.settings",
      screenText = "Device admin apps Control Yourself active"
    )

    assertNotNull(vpnFeature)
    assertNotNull(adminFeature)
    assertEquals("protectedSystemSettings", vpnFeature!!.key)
    assertEquals("protectedSystemSettings", adminFeature!!.key)
  }

  @Test
  fun `blocks overlay usage access battery and unknown app settings`() {
    val overlayFeature = match("com.android.settings", "Display over other apps Control Yourself")
    val usageFeature = match("com.android.settings", "Usage access Control Yourself")
    val batteryFeature = match("com.android.settings", "Battery optimization Unrestricted battery Control Yourself")
    val unknownAppsFeature = match("com.android.settings", "Install unknown apps Allow from this source")

    assertEquals("protectedSystemSettings", overlayFeature!!.key)
    assertEquals("protectedSystemSettings", usageFeature!!.key)
    assertEquals("protectedSystemSettings", batteryFeature!!.key)
    assertEquals("protectedSystemSettings", unknownAppsFeature!!.key)
  }

  @Test
  fun `blocks app info force stop and clear data for own app`() {
    val feature = match(
      packageName = "com.android.settings",
      screenText = "App info Control Yourself Force stop Storage Clear data Uninstall"
    )

    assertNotNull(feature)
    assertEquals("protectedSystemSettings", feature!!.key)
  }

  @Test
  fun `blocks developer options and multi user reset settings`() {
    val developerFeature = match("com.android.settings", "Developer options USB debugging")
    val usersFeature = match("com.android.settings", "Multiple users Guest")
    val resetFeature = match("com.android.settings", "Factory reset Erase all data")

    assertEquals("protectedSystemSettings", developerFeature!!.key)
    assertEquals("protectedSystemSettings", usersFeature!!.key)
    assertEquals("protectedSystemSettings", resetFeature!!.key)
  }

  @Test
  fun `allows safe settings surfaces`() {
    val feature = match(
      packageName = "com.android.settings",
      screenText = "Sound and vibration Wallpaper Display brightness"
    )

    assertNull(feature)
  }

  @Test
  fun `does not block other app uninstall from launcher`() {
    val feature = match(
      packageName = "com.google.android.apps.nexuslauncher",
      screenText = "Calendar App info Remove Uninstall"
    )

    assertNull(feature)
  }

  private fun match(
    packageName: String,
    screenText: String
  ) = ScreenContextDetector.matchProtectedSettingsSurface(
    packageName = packageName,
    screenText = screenText,
    ownPackageName = ownPackageName,
    appLabels = appLabels
  )
}
