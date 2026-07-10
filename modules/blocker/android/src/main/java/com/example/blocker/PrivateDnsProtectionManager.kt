package com.example.blocker

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.UserManager
import java.util.Locale

/**
 * A second protection mode that filters content **without the local VPN**.
 *
 * A device owner points the *system* DNS resolver at a family-safe DoT host (Cloudflare Family,
 * CleanBrowsing, …) and locks the setting with DISALLOW_CONFIG_PRIVATE_DNS. That resolver blocks
 * adult content and forces safe search at the network level, so filtering keeps working with the
 * internet fully up, no VPN slot held, and nothing the user can switch off.
 *
 * The trade-off versus the VPN engine: no app-level custom allow/block lists, keyword blocking,
 * safe-search injection, CNAME/direct-IP handling, or audit log — the family resolver is the whole
 * defence. Callers surface that to the user.
 */
object PrivateDnsProtectionManager {
  const val DEFAULT_HOST = ManagedPrivateDnsBackup.DEFAULT_HOSTNAME

  // Hosts whose resolvers filter adult content themselves. Protection must never point at an
  // unfiltered resolver (1.1.1.1, dns.google, …) — that would "protect" by doing nothing.
  private val FAMILY_SAFE_HOST_SUFFIXES = setOf(
    "family.cloudflare-dns.com",
    "cleanbrowsing.org",
    "familyshield.opendns.com",
    "family.adguard-dns.com"
  )

  fun isFamilySafeHost(host: String): Boolean {
    val normalized = host.trim().lowercase(Locale.US).trim('.')
    if (normalized.isBlank()) return false
    return FAMILY_SAFE_HOST_SUFFIXES.any { normalized == it || normalized.endsWith(".$it") }
  }

  fun enable(context: Context, repository: PolicyRepository, hostname: String, pin: String? = null): Map<String, Any?> {
    repository.assertCanChangePolicy(pin)

    // Validate the target first — it's pure input validation, so a bad host is always rejected
    // the same way regardless of OS version or ownership. Protection must never point at an
    // unfiltered resolver.
    val host = hostname.trim().ifBlank { DEFAULT_HOST }
    if (!isFamilySafeHost(host)) {
      return result(context, repository, false, "host_not_family_safe")
    }

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      return result(context, repository, false, "private_dns_requires_android_9_or_newer")
    }
    val manager = manager(context)
    if (!isManagedOwner(context, manager)) {
      return result(context, repository, false, "device_owner_or_profile_owner_required")
    }

    val component = component(context)
    return runCatching {
      manager.setGlobalPrivateDnsModeSpecifiedHost(component, host)
      // Lock it so it cannot be pointed elsewhere or switched off from Settings.
      manager.addUserRestriction(component, UserManager.DISALLOW_CONFIG_PRIVATE_DNS)
      repository.setPrivateDnsProtectionEnabled(true, pin)
      GuardianNotifier.notify(
        context = context,
        eventType = "PRIVATE_DNS_PROTECTION_ENABLED",
        severity = "high",
        subject = host,
        action = "enabled"
      )
      result(context, repository, true, null)
    }.getOrElse {
      repository.recordAuditEvent(
        eventType = "PRIVATE_DNS_PROTECTION_FAILED",
        severity = "high",
        category = "dns",
        subject = host,
        action = "enable_failed",
        metadata = mapOf("reason" to (it.message ?: it.javaClass.simpleName))
      )
      result(context, repository, false, "android_rejected_private_dns")
    }
  }

  fun disable(context: Context, repository: PolicyRepository, pin: String? = null): Map<String, Any?> {
    repository.assertCanChangePolicy(pin)
    repository.setPrivateDnsProtectionEnabled(false, pin)

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) {
      return result(context, repository, true, null)
    }
    val manager = manager(context)
    if (!isManagedOwner(context, manager)) {
      return result(context, repository, true, null)
    }

    val component = component(context)
    runCatching {
      // Strict mode also holds DISALLOW_CONFIG_PRIVATE_DNS; leave the lock in place if so.
      if (!repository.isStrictModeEnabled()) {
        manager.clearUserRestriction(component, UserManager.DISALLOW_CONFIG_PRIVATE_DNS)
      }
      // Hand DNS back to the network's own setting rather than forcing it off.
      manager.setGlobalPrivateDnsModeOpportunistic(component)
    }
    return result(context, repository, true, null)
  }

  fun status(context: Context, repository: PolicyRepository): Map<String, Any?> {
    val manager = manager(context)
    val managedOwner = isManagedOwner(context, manager)
    val supported = managedOwner && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
    val component = component(context)

    val host = if (supported) runCatching { manager.getGlobalPrivateDnsHost(component) }.getOrNull() else null
    val mode = if (supported) runCatching { manager.getGlobalPrivateDnsMode(component) }.getOrNull() else null
    val locked = if (supported) {
      runCatching {
        manager.getUserRestrictions(component).getBoolean(UserManager.DISALLOW_CONFIG_PRIVATE_DNS, false)
      }.getOrDefault(false)
    } else {
      false
    }
    // "Active" means the system resolver is actually pinned to a family host right now, not merely
    // that the preference is set — so a manual change (or a non-owner device) reads as inactive.
    val activeHostSafe = host != null && isFamilySafeHost(host)
    val active = supported && activeHostSafe

    return mapOf(
      "supported" to supported,
      "enabled" to repository.isPrivateDnsProtectionEnabled(),
      "active" to active,
      "locked" to locked,
      "host" to host,
      "mode" to mode,
      "defaultHost" to DEFAULT_HOST
    )
  }

  private fun result(context: Context, repository: PolicyRepository, applied: Boolean, reason: String?): Map<String, Any?> =
    mapOf(
      "applied" to applied,
      "reason" to reason,
      "privateDnsProtectionStatus" to status(context, repository)
    )

  private fun manager(context: Context): DevicePolicyManager =
    context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

  private fun component(context: Context): ComponentName =
    ComponentName(context, BlockerDeviceAdminReceiver::class.java)

  private fun isManagedOwner(context: Context, manager: DevicePolicyManager): Boolean =
    runCatching {
      manager.isDeviceOwnerApp(context.packageName) || manager.isProfileOwnerApp(context.packageName)
    }.getOrDefault(false)
}
