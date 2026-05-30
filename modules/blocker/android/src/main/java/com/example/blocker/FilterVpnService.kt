package com.example.blocker

import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.content.ComponentName
import android.content.Intent
import android.net.ProxyInfo
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import java.net.InetAddress
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException

class FilterVpnService : VpnService() {
  private var vpnInterface: ParcelFileDescriptor? = null
  private var worker: Thread? = null
  private var localProxy: LocalHttpProxy? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    NotificationHelper.ensureChannel(this)
    startForeground(NotificationHelper.NOTIFICATION_ID, NotificationHelper.build(this))

    when (intent?.action) {
      ACTION_STOP -> {
        shutdown(markTamperIfRequested = false)
        stopSelf()
        return START_NOT_STICKY
      }
      ACTION_RESTART -> {
        shutdown(markTamperIfRequested = false)
        startVpn()
      }
      else -> startVpn()
    }

    return START_STICKY
  }

  private fun startVpn() {
    if (isRunning) return

    val repository = PolicyRepository(this)
    val builder = Builder()
      .setSession("Parent Blocker local DNS filter")
      .setMtu(1500)
      .addAddress(VPN_CLIENT_ADDRESS, 32)
      .addDnsServer(VPN_DNS_ADDRESS)

    val appliedPolicy = VpnPolicyManager.configure(this, repository, builder)
    if (appliedPolicy.routesAllIpv4Traffic) {
      builder.addRoute("0.0.0.0", 0)
    } else {
      builder.addRoute(VPN_DNS_ADDRESS, 32)
    }

    try {
      builder.addAddress("fd00::2", 128)
      builder.addDnsServer("fd00::1")
      if (appliedPolicy.routesAllIpv6Traffic) {
        builder.addRoute("::", 0)
      } else {
        builder.addRoute("fd00::1", 128)
      }
    } catch (_: Exception) {
      // IPv6 not supported on this device
    }
    addEncryptedDnsResolverRoutes(builder)
    val proxyStarted = configureLocalProxy(repository, builder)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      builder.setMetered(false)
    }

    vpnInterface = builder.establish()
    if (vpnInterface == null) {
      localProxy?.stop()
      localProxy = null
      repository.setVpnActive(false)
      repository.setProtectionRequested(false)
      repository.recordAuditEvent(
        eventType = "VPN_ESTABLISH_FAILED",
        severity = "critical",
        category = "vpn",
        subject = packageName,
        action = "establish_failed"
      )
      GuardianNotifier.notify(
        context = this,
        eventType = "VPN_ESTABLISH_FAILED",
        severity = "critical",
        subject = packageName,
        action = "establish_failed"
      )
      stopSelf()
      return
    }

    isRunning = true
    repository.setVpnActive(true)
    repository.setTampered(false)
    VpnRestartJobService.schedulePeriodic(this)
    repository.recordAuditEvent(
      eventType = "VPN_POLICY_APPLIED",
      severity = if (appliedPolicy.failedPackages.isEmpty()) "high" else "critical",
      category = "vpn",
      subject = packageName,
      action = appliedPolicy.effectiveTunnelMode,
      metadata = mapOf(
        "routesAllIpv4Traffic" to appliedPolicy.routesAllIpv4Traffic,
        "routesAllIpv6Traffic" to appliedPolicy.routesAllIpv6Traffic,
        "perAppVpnFilteringEnabled" to appliedPolicy.perAppVpnFilteringEnabled,
        "filteredPackageCount" to appliedPolicy.allowedPackages.size,
        "excludedPackageCount" to appliedPolicy.excludedPackages.size,
        "failedPackages" to appliedPolicy.failedPackages.joinToString(","),
        "localProxyStarted" to proxyStarted
      )
    )

    worker = Thread({ runPacketLoop(repository) }, "ParentBlockerDnsFilter").also {
      it.start()
    }
  }

  private fun configureLocalProxy(repository: PolicyRepository, builder: Builder): Boolean {
    if (!repository.isHttpsInspectionEnabled()) return false
    if (!repository.hasAcknowledgedHttpsInspectionPrivacy()) {
      repository.recordAuditEvent(
        eventType = "HTTPS_PROXY_NOT_STARTED",
        severity = "critical",
        category = "https_proxy",
        subject = packageName,
        action = "privacy_ack_required"
      )
      return false
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      repository.recordAuditEvent(
        eventType = "HTTPS_PROXY_NOT_STARTED",
        severity = "high",
        category = "https_proxy",
        subject = packageName,
        action = "requires_android_10"
      )
      return false
    }

    val proxy = LocalHttpProxy(this, repository)
    if (!proxy.start()) return false
    localProxy = proxy
    builder.setHttpProxy(ProxyInfo.buildDirectProxy("127.0.0.1", LocalHttpProxy.DEFAULT_PORT))
    return true
  }

  private fun addEncryptedDnsResolverRoutes(builder: Builder) {
    ENCRYPTED_DNS_RESOLVER_IPV4.forEach { resolverIp ->
      try {
        builder.addRoute(resolverIp, 32)
      } catch (_: Exception) {
        // Ignore resolver routes unsupported by a specific device build.
      }
    }
    ENCRYPTED_DNS_RESOLVER_IPV6.forEach { resolverIp ->
      try {
        builder.addRoute(resolverIp, 128)
      } catch (_: Exception) {
        // Ignore resolver routes unsupported by a specific device build.
      }
    }
  }

  private fun plainDnsBypassResolverIp(packet: ByteArray, length: Int): String? {
    if (length < 28) return null
    val version = (packet[0].toInt() ushr 4) and 0x0f
    if (version != 4) return null
    val protocol = packet[9].toInt() and 0xff
    if (protocol != UDP_PROTOCOL) return null
    val ipHeaderLength = (packet[0].toInt() and 0x0f) * 4
    if (length < ipHeaderLength + 4) return null
    val destPort = readU16(packet, ipHeaderLength + 2)
    if (destPort != 53) return null
    val destIp = ipv4AddressString(packet, 16)
    return destIp.takeIf { it != VPN_DNS_ADDRESS }
  }

  private fun redirectToLocalDns(packet: ByteArray, length: Int): ByteArray {
    val modified = packet.copyOf(length)
    val dnsAddr = InetAddress.getByName(VPN_DNS_ADDRESS).address
    dnsAddr.copyInto(modified, 16)
    val ipHeaderLength = (modified[0].toInt() and 0x0f) * 4
    modified[ipHeaderLength + 2] = 0
    modified[ipHeaderLength + 3] = 53
    modified[ipHeaderLength + 6] = 0
    modified[ipHeaderLength + 7] = 0
    modified[10] = 0
    modified[11] = 0
    val checksum = ipv4Checksum(modified, 0, ipHeaderLength)
    modified[10] = ((checksum ushr 8) and 0xff).toByte()
    modified[11] = (checksum and 0xff).toByte()
    return modified
  }

  private fun isDoHPacket(packet: ByteArray, length: Int): Boolean {
    if (length < 24) return false
    val version = (packet[0].toInt() ushr 4) and 0x0f
    if (version != 4) return false
    val protocol = packet[9].toInt() and 0xff
    if (protocol != TCP_PROTOCOL) return false
    val ipHeaderLength = (packet[0].toInt() and 0x0f) * 4
    if (length < ipHeaderLength + 4) return false
    val destPort = readU16(packet, ipHeaderLength + 2)
    if (destPort != 443) return false
    val destIp = ipv4AddressString(packet, 16)
    return destIp in ENCRYPTED_DNS_RESOLVER_IPV4
  }

  private fun ipv4AddressString(packet: ByteArray, offset: Int): String {
    return "${packet[offset].toInt() and 0xff}.${packet[offset + 1].toInt() and 0xff}" +
      ".${packet[offset + 2].toInt() and 0xff}.${packet[offset + 3].toInt() and 0xff}"
  }

  private fun ipv4Checksum(data: ByteArray, offset: Int, length: Int): Int {
    var sum = 0
    var index = offset
    while (index < offset + length) {
      sum += readU16(data, index)
      while (sum > 0xffff) sum = (sum and 0xffff) + (sum ushr 16)
      index += 2
    }
    return sum.inv() and 0xffff
  }

  private fun runPacketLoop(repository: PolicyRepository) {
    val descriptor = vpnInterface ?: return
    val input = FileInputStream(descriptor.fileDescriptor)
    val output = FileOutputStream(descriptor.fileDescriptor)
    val engine = DnsFilterEngine(this, repository)
    val buffer = ByteArray(32767)

    try {
      while (isRunning && !Thread.currentThread().isInterrupted) {
        val length = input.read(buffer)
        if (length <= 0) continue

        if (isDoHPacket(buffer, length)) {
          val destIp = ipv4AddressString(buffer, 16)
          repository.recordDomainEvent(destIp, DomainClassifier.CATEGORY_BYPASS, ACTION_DOH_BLOCKED)
          continue
        }

        val plainDnsResolverIp = plainDnsBypassResolverIp(buffer, length)
        val packet = if (plainDnsResolverIp != null) {
          redirectToLocalDns(buffer, length)
        } else {
          buffer.copyOf(length)
        }

        val encryptedDnsTarget = encryptedDnsTarget(packet, packet.size)
        if (encryptedDnsTarget != null) {
          repository.recordDomainEvent(encryptedDnsTarget, DomainClassifier.CATEGORY_BYPASS, ACTION_ENCRYPTED_DNS_BLOCKED)
          continue
        }
        val response = engine.processPacket(packet, packet.size, plainDnsResolverIp)
        if (response != null) {
          output.write(response)
        }
      }
    } catch (_: IOException) {
      if (isRunning) {
        TamperMonitor(repository).markVpnStoppedUnexpectedly()
      }
    } finally {
      try {
        input.close()
      } catch (_: IOException) {
      }
      try {
        output.close()
      } catch (_: IOException) {
      }
    }
  }

  private fun encryptedDnsTarget(buffer: ByteArray, length: Int): String? {
    if (length < 20) return null
    val version = (buffer[0].toInt() ushr 4) and 0x0f
    return when (version) {
      4 -> encryptedDnsIpv4Target(buffer, length)
      6 -> encryptedDnsIpv6Target(buffer, length)
      else -> null
    }
  }

  private fun encryptedDnsIpv4Target(buffer: ByteArray, length: Int): String? {
    val protocol = buffer[9].toInt() and 0xff
    val ipHeaderLength = (buffer[0].toInt() and 0x0f) * 4
    if (protocol !in ENCRYPTED_DNS_PROTOCOLS || length < ipHeaderLength + 4) return null

    val destPort = readU16(buffer, ipHeaderLength + 2)
    if (destPort !in ENCRYPTED_DNS_PORTS) return null

    val destIp = "${buffer[16].toInt() and 0xff}.${buffer[17].toInt() and 0xff}" +
      ".${buffer[18].toInt() and 0xff}.${buffer[19].toInt() and 0xff}"

    return destIp.takeIf { it in ENCRYPTED_DNS_RESOLVER_IPV4 }
  }

  private fun encryptedDnsIpv6Target(buffer: ByteArray, length: Int): String? {
    if (length < IPV6_HEADER_LENGTH + 4) return null
    val nextHeader = buffer[6].toInt() and 0xff
    if (nextHeader !in ENCRYPTED_DNS_PROTOCOLS) return null

    val transportOffset = IPV6_HEADER_LENGTH
    val destPort = readU16(buffer, transportOffset + 2)
    if (destPort !in ENCRYPTED_DNS_PORTS) return null

    val destIp = ipv6Address(buffer, IPV6_DESTINATION_OFFSET)
    return destIp.takeIf { it in ENCRYPTED_DNS_RESOLVER_IPV6 }
  }

  private fun readU16(buffer: ByteArray, offset: Int): Int {
    return ((buffer[offset].toInt() and 0xff) shl 8) or (buffer[offset + 1].toInt() and 0xff)
  }

  private fun ipv6Address(buffer: ByteArray, offset: Int): String {
    return (InetAddress.getByAddress(buffer.copyOfRange(offset, offset + IPV6_ADDRESS_LENGTH)).hostAddress ?: "")
      .lowercase()
  }

  override fun onRevoke() {
    val repository = PolicyRepository(this)
    TamperMonitor(repository).handleVpnRevoked()
    GuardianNotifier.notify(
      context = this,
      eventType = "VPN_REVOKED",
      severity = "critical",
      subject = packageName,
      action = "revoked"
    )
    BlockOverlayService.show(this, "Protection VPN", "Android revoked or stopped the local protection VPN")
    scheduleVpnRestart()
    shutdown(markTamperIfRequested = true)
    super.onRevoke()
  }

  override fun onDestroy() {
    shutdown(markTamperIfRequested = true)
    super.onDestroy()
  }

  private fun shutdown(markTamperIfRequested: Boolean) {
    val repository = PolicyRepository(this)
    if (markTamperIfRequested) {
      TamperMonitor(repository).markVpnStoppedUnexpectedly()
    }

    isRunning = false
    repository.setVpnActive(false)
    worker?.interrupt()
    worker = null
    localProxy?.stop()
    localProxy = null

    try {
      vpnInterface?.close()
    } catch (_: IOException) {
    } finally {
      vpnInterface = null
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
  }

  private fun scheduleVpnRestart() {
    val repository = PolicyRepository(this)
    if (!repository.isProtectionRequested()) return
    try {
      val scheduler = getSystemService(JOB_SCHEDULER_SERVICE) as JobScheduler
      val job = JobInfo.Builder(VPN_RESTART_JOB_ID, ComponentName(this, VpnRestartJobService::class.java))
        .setMinimumLatency(10_000L)
        .setOverrideDeadline(30_000L)
        .setPersisted(false)
        .build()
      scheduler.schedule(job)
    } catch (_: Exception) {
      // JobScheduler not available
    }
  }

  companion object {
    const val ACTION_START = "com.example.blocker.action.START"
    const val ACTION_STOP = "com.example.blocker.action.STOP"
    const val ACTION_RESTART = "com.example.blocker.action.RESTART"
    private const val VPN_RESTART_JOB_ID = 8501
    private const val ACTION_ENCRYPTED_DNS_BLOCKED = "encrypted_dns_blocked"
    private const val ACTION_DOH_BLOCKED = "doh_blocked"

    private const val VPN_CLIENT_ADDRESS = "10.88.0.2"
    private const val VPN_DNS_ADDRESS = "10.88.0.1"
    private const val IPV6_HEADER_LENGTH = 40
    private const val IPV6_ADDRESS_LENGTH = 16
    private const val IPV6_DESTINATION_OFFSET = 24
    private const val TCP_PROTOCOL = 6
    private const val UDP_PROTOCOL = 17

    private val ENCRYPTED_DNS_PORTS = setOf(443, 853)
    private val ENCRYPTED_DNS_PROTOCOLS = setOf(TCP_PROTOCOL, UDP_PROTOCOL)

    private val ENCRYPTED_DNS_RESOLVER_IPV4 = setOf(
      "1.1.1.1", "1.0.0.1", "1.1.1.2", "1.0.0.2", "1.1.1.3", "1.0.0.3", // Cloudflare
      "8.8.8.8", "8.8.4.4", // Google
      "9.9.9.9", "149.112.112.112", // Quad9
      "208.67.222.222", "208.67.220.220", "208.67.222.123", "208.67.220.123", // OpenDNS
      "94.140.14.14", "94.140.15.15", "94.140.14.15", "94.140.15.16", // AdGuard
      "185.228.168.9", "185.228.169.9", "185.228.168.10", "185.228.169.11",
      "185.228.168.168", "185.228.169.168", // CleanBrowsing
      "45.90.28.0", "45.90.30.0", // NextDNS
      "76.76.2.0", "76.76.10.0" // Control D
    )

    private val ENCRYPTED_DNS_RESOLVER_IPV6 = setOf(
      "2606:4700:4700::1111", "2606:4700:4700::1001",
      "2606:4700:4700::1112", "2606:4700:4700::1002",
      "2606:4700:4700::1113", "2606:4700:4700::1003",
      "2001:4860:4860::8888", "2001:4860:4860::8844",
      "2620:fe::fe", "2620:fe::9",
      "2620:119:35::35", "2620:119:53::53", "2620:119:35::123", "2620:119:53::123",
      "2a10:50c0::ad1:ff", "2a10:50c0::ad2:ff",
      "2a0d:2a00:1::", "2a0d:2a00:2::", "2a0d:2a00:1::2", "2a0d:2a00:2::2",
      "2a07:a8c0::", "2a07:a8c1::",
      "2606:1a40::", "2606:1a40:1::"
    ).map { (InetAddress.getByName(it).hostAddress ?: "").lowercase() }.toSet()

    @Volatile
    var isRunning: Boolean = false
      private set
  }
}
