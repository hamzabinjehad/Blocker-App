package com.example.blocker

import android.net.VpnService
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.min

class DnsFilterEngine(
  private val vpnService: VpnService,
  private val repository: PolicyRepository,
  private val upstreamResolvers: List<InetSocketAddress> = DEFAULT_UPSTREAM_RESOLVERS,
  private val safeSearchOverrides: Map<String, String> = emptyMap()
) {
  private val classifier = DomainClassifier(vpnService.applicationContext, repository)
  private val dotPool = DotConnectionPool(vpnService)
  private val dnsCache = ConcurrentHashMap<String, DnsCacheEntry>(256)
  // Short-lived record of query keys where every upstream just failed, so a page that
  // fires many lookups during a transient outage doesn't wait the full timeout chain each time.
  private val negativeCache = ConcurrentHashMap<String, Long>(64)

  fun shutdown() {
    dotPool.closeAll()
  }

  private fun recordPlainDnsBypassIfNeeded(query: DnsQuery, originalResolverIp: String? = null) {
    val resolverIp = (originalResolverIp ?: query.destinationIpText).lowercase()
    if (resolverIp == VPN_DNS_ADDRESS || resolverIp !in PUBLIC_DNS_RESOLVERS) return

    val recorded = repository.recordDomainEvent(
      query.domain,
      DomainClassifier.CATEGORY_BYPASS,
      ACTION_PLAIN_DNS_BYPASS_INTERCEPTED
    )
    if (!recorded) return

    GuardianNotifier.notify(
      vpnService.applicationContext,
      eventType = "DNS_BYPASS_INTERCEPTED",
      severity = "high",
      subject = query.domain,
      action = ACTION_PLAIN_DNS_BYPASS_INTERCEPTED,
      metadata = mapOf("resolver" to resolverIp, "transport" to "udp_53")
    )
  }

  fun processPacket(packet: ByteArray, length: Int, originalResolverIp: String? = null): ByteArray? {
    val version = (packet[0].toInt() ushr 4) and 0x0f
    val query = when (version) {
      4 -> parseDnsQuery(packet, length)
      6 -> parseDnsQueryIpv6(packet, length)
      else -> null
    } ?: return null
    val safeSearchTarget = safeSearchOverrides[query.domain.lowercase()]
    if (safeSearchTarget != null) {
      repository.recordDomainEvent(query.domain, DomainClassifier.CATEGORY_SEARCH, "safe_search")
      return wrapDnsResponse(query, buildSafeSearchResponse(packet, query, safeSearchTarget))
    }

    val classification = classifier.classify(query.domain)
    recordPlainDnsBypassIfNeeded(query, originalResolverIp)

    if (classification.action == DomainClassification.Action.ALLOW && shouldStripEncryptedClientHelloHint(query)) {
      repository.recordDomainEvent(classification.domain, DomainClassifier.CATEGORY_BYPASS, ACTION_ECH_HINT_STRIPPED)
      return wrapDnsResponse(query, buildNoDataDnsResponse(packet, query.dnsOffset, query.dnsLength))
    }

    val dnsResponse = when (classification.action) {
      DomainClassification.Action.BLOCK -> {
        val blockAction = if (classification.heuristic) ACTION_BLOCKED_HEURISTIC else "blocked"
        val recorded = repository.recordDomainEvent(classification.domain, classification.category, blockAction)
        if (classification.category == DomainClassifier.CATEGORY_BYPASS && recorded) {
          GuardianNotifier.notify(
            vpnService.applicationContext,
            eventType = "DNS_BYPASS_BLOCKED",
            severity = "critical",
            subject = classification.domain,
            action = "blocked",
            metadata = mapOf("category" to classification.category)
          )
        }
        buildBlockedDnsResponse(packet, query.dnsOffset, query.dnsLength)
      }
      DomainClassification.Action.FORCE_SAFE_SEARCH -> {
        repository.recordDomainEvent(classification.domain, classification.category, "safe_search")
        buildSafeSearchResponse(packet, query, classification.rewriteTarget)
      }
      DomainClassification.Action.ALLOW -> {
        // Domains the user explicitly allowlisted must resolve even if the family
        // upstream would filter them, so route those through an unfiltered resolver.
        val unfiltered = classification.category == DomainClassifier.CATEGORY_ALLOWLIST
        forwardDnsWithCache(
          packet.copyOfRange(query.dnsOffset, query.dnsOffset + query.dnsLength),
          query.domain,
          query.queryType,
          unfiltered
        ) ?: buildServfailDnsResponse(packet, query.dnsOffset, query.dnsLength)
      }
    }

    return wrapDnsResponse(query, dnsResponse)
  }

  private fun wrapDnsResponse(query: DnsQuery, dnsPayload: ByteArray): ByteArray {
    if (query.isIpv6 && query.rawPacket != null) {
      return buildIpv6UdpPacket(query, dnsPayload)
    }
    return buildIpv4UdpPacket(
      sourceIp = query.destinationIp,
      destinationIp = query.sourceIp,
      sourcePort = query.destinationPort,
      destinationPort = query.sourcePort,
      payload = dnsPayload
    )
  }

  private fun buildIpv6UdpPacket(query: DnsQuery, payload: ByteArray): ByteArray {
    val udpLength = UDP_HEADER_LENGTH + payload.size
    val totalLength = IPV6_HEADER_LENGTH + udpLength
    val response = ByteArray(totalLength)

    // IPv6 header
    response[0] = 0x60.toByte() // version 6
    // traffic class + flow label = 0
    writeU16(response, 4, udpLength) // payload length
    response[6] = UDP_PROTOCOL.toByte() // next header = UDP
    response[7] = 64 // hop limit

    // Swap source/dest from original packet
    val raw = query.rawPacket!!
    raw.copyInto(response, 8, 24, 40) // original dest → response source
    raw.copyInto(response, 24, 8, 24) // original source → response dest

    // UDP header
    val udpOffset = IPV6_HEADER_LENGTH
    writeU16(response, udpOffset, query.destinationPort) // source port
    writeU16(response, udpOffset + 2, query.sourcePort)  // dest port
    writeU16(response, udpOffset + 4, udpLength)
    writeU16(response, udpOffset + 6, 0) // checksum disabled
    payload.copyInto(response, udpOffset + UDP_HEADER_LENGTH)

    return response
  }

  private fun shouldStripEncryptedClientHelloHint(query: DnsQuery): Boolean {
    if (query.queryType !in ECH_ADVERTISING_DNS_TYPES) return false
    return repository.isStrictModeEnabled() || repository.shouldBlockBypassDomains()
  }

  private fun buildSafeSearchResponse(packet: ByteArray, query: DnsQuery, rewriteTarget: String?): ByteArray {
    // HTTPS/SVCB answers carry address hints and ECH keys that let a browser connect straight
    // to the engine's real servers, sidestepping the forced safe-search address entirely.
    // Answer NODATA so clients fall back to the rewritten A/AAAA path.
    if (query.queryType in ECH_ADVERTISING_DNS_TYPES) {
      return buildNoDataDnsResponse(packet, query.dnsOffset, query.dnsLength)
    }
    if (query.queryType != DNS_TYPE_A && query.queryType != DNS_TYPE_AAAA) {
      return forwardDns(packet.copyOfRange(query.dnsOffset, query.dnsOffset + query.dnsLength))
        ?: buildBlockedDnsResponse(packet, query.dnsOffset, query.dnsLength)
    }
    if (!rewriteTarget.isNullOrBlank()) {
      return buildCnameResponse(packet, query.dnsOffset, query.dnsLength, rewriteTarget)
    }
    val safeIp = when {
      query.domain.contains("google") -> GOOGLE_SAFE_SEARCH_IP
      query.domain.contains("bing") -> BING_SAFE_SEARCH_IP
      query.domain.contains("youtube") || query.domain.contains("googlevideo") -> YOUTUBE_RESTRICTED_IP
      else -> null
    }
    // Only inject a known safe-search IP for recognised engines. For any other domain,
    // forward normally instead of pointing it at Google's safe-search IP (which would break it).
    return if (safeIp != null) {
      if (query.queryType == DNS_TYPE_AAAA) {
        // The pinned safe-search addresses are IPv4; NODATA pushes the client onto the A query
        // instead of handing it an untouched IPv6 route to the unfiltered engine.
        buildNoDataDnsResponse(packet, query.dnsOffset, query.dnsLength)
      } else {
        buildAAnswerResponse(packet, query.dnsOffset, query.dnsLength, safeIp)
      }
    } else {
      forwardDns(packet.copyOfRange(query.dnsOffset, query.dnsOffset + query.dnsLength))
        ?: buildBlockedDnsResponse(packet, query.dnsOffset, query.dnsLength)
    }
  }

  private fun buildCnameResponse(packet: ByteArray, dnsOffset: Int, dnsLength: Int, target: String): ByteArray {
    val query = packet.copyOfRange(dnsOffset, dnsOffset + dnsLength)
    val questionEnd = findQuestionEnd(query)
    val encodedTarget = encodeDomainName(target)
    val answerLength = 12 + encodedTarget.size
    val response = ByteArray(questionEnd + answerLength)
    query.copyInto(response, 0, 0, questionEnd)

    response[2] = 0x81.toByte()
    response[3] = 0x80.toByte()
    response[4] = 0x00
    response[5] = 0x01
    response[6] = 0x00
    response[7] = 0x01

    var offset = questionEnd
    response[offset++] = 0xc0.toByte()
    response[offset++] = 0x0c.toByte()
    response[offset++] = 0x00
    response[offset++] = DNS_TYPE_CNAME.toByte()
    response[offset++] = 0x00
    response[offset++] = 0x01
    response[offset++] = 0x00
    response[offset++] = 0x00
    response[offset++] = 0x01
    response[offset++] = 0x2c.toByte()
    writeU16(response, offset, encodedTarget.size)
    offset += 2
    encodedTarget.copyInto(response, offset)

    return response
  }

  private fun buildAAnswerResponse(packet: ByteArray, dnsOffset: Int, dnsLength: Int, ip: String): ByteArray {
    val query = packet.copyOfRange(dnsOffset, dnsOffset + dnsLength)
    val questionEnd = findQuestionEnd(query)

    // Header (12 bytes) + Question + Answer (16 bytes for A record)
    val response = ByteArray(questionEnd + 16)
    query.copyInto(response, 0, 0, questionEnd)

    // Set Header flags: QR=1, AA=1, RCODE=0
    response[2] = 0x81.toByte()
    response[3] = 0x80.toByte()
    // Questions: 1
    response[4] = 0x00
    response[5] = 0x01
    // Answer RRs: 1
    response[6] = 0x00
    response[7] = 0x01

    // Answer section starts at questionEnd
    var offset = questionEnd
    // Name (Pointer to offset 12: 0xc00c)
    response[offset++] = 0xc0.toByte()
    response[offset++] = 0x0c.toByte()
    // Type A (1)
    response[offset++] = 0x00
    response[offset++] = 0x01
    // Class IN (1)
    response[offset++] = 0x00
    response[offset++] = 0x01
    // TTL (300s)
    response[offset++] = 0x00
    response[offset++] = 0x00
    response[offset++] = 0x01
    response[offset++] = 0x2c.toByte()
    // Data Length (4)
    response[offset++] = 0x00
    response[offset++] = 0x04

    // IP Address
    val ipBytes = InetAddress.getByName(ip).address
    ipBytes.copyInto(response, offset)

    return response
  }

  private fun parseDnsQueryIpv6(packet: ByteArray, length: Int): DnsQuery? {
    if (length < IPV6_HEADER_LENGTH + UDP_HEADER_LENGTH + DNS_HEADER_LENGTH) return null
    val nextHeader = packet[6].toInt() and 0xff
    if (nextHeader != UDP_PROTOCOL) return null

    val udpOffset = IPV6_HEADER_LENGTH
    val sourcePort = readU16(packet, udpOffset)
    val destinationPort = readU16(packet, udpOffset + 2)
    if (destinationPort != DNS_PORT) return null

    val udpLength = readU16(packet, udpOffset + 4)
    val dnsLength = udpLength - UDP_HEADER_LENGTH
    if (dnsLength < DNS_HEADER_LENGTH || udpOffset + UDP_HEADER_LENGTH + dnsLength > length) return null

    val dnsOffset = udpOffset + UDP_HEADER_LENGTH
    val questionStart = dnsOffset + DNS_HEADER_LENGTH
    val domain = readQuestionName(packet, questionStart, dnsOffset + dnsLength) ?: return null
    val questionEnd = findQuestionEnd(packet.copyOfRange(dnsOffset, dnsOffset + dnsLength))
    if (questionEnd > dnsLength) return null
    val queryType = readU16(packet, dnsOffset + questionEnd - 4)

    return DnsQuery(
      sourceIp = 0,
      destinationIp = 0,
      destinationIpText = ipv6AddressFromPacket(packet, 24),
      sourcePort = sourcePort,
      destinationPort = destinationPort,
      dnsOffset = dnsOffset,
      dnsLength = dnsLength,
      domain = domain,
      queryType = queryType,
      isIpv6 = true,
      rawPacket = packet.copyOf(length)
    )
  }

  private fun ipv6AddressFromPacket(packet: ByteArray, offset: Int): String {
    return try {
      (InetAddress.getByAddress(packet.copyOfRange(offset, offset + 16)).hostAddress ?: "").lowercase()
    } catch (_: Exception) { "" }
  }

  private fun parseDnsQuery(packet: ByteArray, length: Int): DnsQuery? {
    if (length < MIN_IPV4_UDP_DNS_SIZE) return null
    val version = (packet[0].toInt() ushr 4) and 0x0f
    if (version != 4) return null

    val ipHeaderLength = (packet[0].toInt() and 0x0f) * 4
    if (length < ipHeaderLength + UDP_HEADER_LENGTH + DNS_HEADER_LENGTH) return null
    val protocol = packet[9].toInt() and 0xff
    if (protocol != UDP_PROTOCOL) return null

    val udpOffset = ipHeaderLength
    val sourcePort = readU16(packet, udpOffset)
    val destinationPort = readU16(packet, udpOffset + 2)
    if (destinationPort != DNS_PORT) return null

    val udpLength = readU16(packet, udpOffset + 4)
    val dnsLength = udpLength - UDP_HEADER_LENGTH
    if (dnsLength < DNS_HEADER_LENGTH || udpOffset + UDP_HEADER_LENGTH + dnsLength > length) return null

    val dnsOffset = udpOffset + UDP_HEADER_LENGTH
    val questionStart = dnsOffset + DNS_HEADER_LENGTH
    val domain = readQuestionName(packet, questionStart, dnsOffset + dnsLength) ?: return null
    val questionEnd = findQuestionEnd(packet.copyOfRange(dnsOffset, dnsOffset + dnsLength))
    if (questionEnd > dnsLength) return null
    val queryType = readU16(packet, dnsOffset + questionEnd - 4)

    return DnsQuery(
      sourceIp = readInt(packet, 12),
      destinationIp = readInt(packet, 16),
      destinationIpText = ipv4Address(packet, 16),
      sourcePort = sourcePort,
      destinationPort = destinationPort,
      dnsOffset = dnsOffset,
      dnsLength = dnsLength,
      domain = domain,
      queryType = queryType
    )
  }

  private fun readQuestionName(packet: ByteArray, start: Int, limit: Int): String? {
    val labels = mutableListOf<String>()
    var offset = start

    while (offset < limit) {
      val labelLength = packet[offset].toInt() and 0xff
      offset += 1
      if (labelLength == 0) break
      if (labelLength > 63 || offset + labelLength > limit) return null
      labels += String(packet, offset, labelLength, Charsets.UTF_8)
      offset += labelLength
    }

    return labels.joinToString(".")
  }

  private fun buildBlockedDnsResponse(packet: ByteArray, dnsOffset: Int, dnsLength: Int): ByteArray {
    val query = packet.copyOfRange(dnsOffset, dnsOffset + dnsLength)
    val questionEnd = findQuestionEnd(query)
    val responseLength = min(questionEnd, query.size)
    val response = ByteArray(responseLength)
    query.copyInto(response, 0, 0, responseLength)

    if (response.size >= DNS_HEADER_LENGTH) {
      response[2] = 0x81.toByte()
      response[3] = 0x83.toByte()
      response[4] = 0x00
      response[5] = 0x01
      response[6] = 0x00
      response[7] = 0x00
      response[8] = 0x00
      response[9] = 0x00
      response[10] = 0x00
      response[11] = 0x00
    }

    return response
  }

  private fun buildNoDataDnsResponse(packet: ByteArray, dnsOffset: Int, dnsLength: Int): ByteArray {
    val query = packet.copyOfRange(dnsOffset, dnsOffset + dnsLength)
    val questionEnd = findQuestionEnd(query)
    val responseLength = min(questionEnd, query.size)
    val response = ByteArray(responseLength)
    query.copyInto(response, 0, 0, responseLength)

    if (response.size >= DNS_HEADER_LENGTH) {
      response[2] = 0x81.toByte()
      response[3] = 0x80.toByte()
      response[4] = 0x00
      response[5] = 0x01
      response[6] = 0x00
      response[7] = 0x00
      response[8] = 0x00
      response[9] = 0x00
      response[10] = 0x00
      response[11] = 0x00
    }

    return response
  }

  private fun encodeDomainName(domain: String): ByteArray {
    val labels = domain.trim().trim('.').split('.').filter { it.isNotBlank() }
    val output = mutableListOf<Byte>()
    labels.forEach { label ->
      val bytes = label.toByteArray(Charsets.UTF_8)
      output.add(bytes.size.coerceAtMost(63).toByte())
      bytes.take(63).forEach { output.add(it) }
    }
    output.add(0)
    return output.toByteArray()
  }

  private fun findQuestionEnd(query: ByteArray): Int {
    var offset = DNS_HEADER_LENGTH
    while (offset < query.size) {
      val labelLength = query[offset].toInt() and 0xff
      offset += 1
      if (labelLength == 0) break
      offset += labelLength
    }
    return min(offset + 4, query.size)
  }

  private fun forwardDnsWithCache(
    query: ByteArray,
    domain: String,
    queryType: Int,
    unfiltered: Boolean = false
  ): ByteArray? {
    val cacheKey = "${if (unfiltered) "u" else "f"}:$domain:$queryType"
    val now = System.currentTimeMillis()

    val cached = dnsCache[cacheKey]
    if (cached != null && now < cached.expiresAt) {
      // Return cached response, patching the transaction ID to match the current query
      val response = cached.response.copyOf()
      if (response.size >= 2 && query.size >= 2) {
        response[0] = query[0]
        response[1] = query[1]
      }
      return response
    }

    val negativeUntil = negativeCache[cacheKey]
    if (negativeUntil != null) {
      if (now < negativeUntil) return null
      negativeCache.remove(cacheKey)
    }

    val resolvers = if (unfiltered) UNFILTERED_UPSTREAM_RESOLVERS else upstreamResolvers
    val response = forwardDns(query, resolvers)
    if (response == null) {
      if (negativeCache.size >= DNS_CACHE_MAX_SIZE) {
        negativeCache.keys.firstOrNull()?.let { negativeCache.remove(it) }
      }
      negativeCache[cacheKey] = now + NEGATIVE_CACHE_TTL_MS
      return null
    }

    val summary = DnsResponseParser.summarize(response)

    // The family upstream filtered this domain itself (all-zero addresses). Record it so it
    // shows up in Recently Blocked with a one-tap allow, instead of failing invisibly.
    if (!unfiltered && summary?.looksUpstreamFiltered == true) {
      repository.recordDomainEvent(domain, DomainClassifier.CATEGORY_ADULT, ACTION_BLOCKED_UPSTREAM)
    }

    // Cache NOERROR and NXDOMAIN — not SERVFAIL or other transient errors. Honouring the
    // upstream TTL (clamped) keeps hot domains out of the network path far longer than the
    // old fixed 60 s, which cuts both latency and radio wake-ups.
    if (summary != null && (summary.rcode == 0 || summary.rcode == 3)) {
      val ttlSeconds = (summary.minAnswerTtlSeconds ?: DEFAULT_CACHE_TTL_SECONDS)
        .coerceIn(MIN_CACHE_TTL_SECONDS, MAX_CACHE_TTL_SECONDS)
      if (dnsCache.size >= DNS_CACHE_MAX_SIZE) {
        dnsCache.keys.firstOrNull()?.let { dnsCache.remove(it) }
      }
      dnsCache[cacheKey] = DnsCacheEntry(response.copyOf(), now + ttlSeconds * 1000L)
    }

    return response
  }

  private fun buildServfailDnsResponse(packet: ByteArray, dnsOffset: Int, dnsLength: Int): ByteArray {
    val query = packet.copyOfRange(dnsOffset, dnsOffset + dnsLength)
    val questionEnd = findQuestionEnd(query)
    val responseLength = min(questionEnd, query.size)
    val response = ByteArray(responseLength)
    query.copyInto(response, 0, 0, responseLength)

    if (response.size >= DNS_HEADER_LENGTH) {
      response[2] = 0x80.toByte() // QR=1
      response[3] = 0x82.toByte() // RA=1, RCODE=2 (SERVFAIL)
      response[4] = 0x00; response[5] = 0x01 // QDCOUNT=1
      response[6] = 0x00; response[7] = 0x00 // ANCOUNT=0
      response[8] = 0x00; response[9] = 0x00 // NSCOUNT=0
      response[10] = 0x00; response[11] = 0x00 // ARCOUNT=0
    }
    return response
  }

  private fun forwardDns(query: ByteArray, resolvers: List<InetSocketAddress> = upstreamResolvers): ByteArray? {
    for (resolver in resolvers) {
      val response = if (resolver.port == DOT_PORT) forwardDot(query, resolver) else forwardDnsUdp(query, resolver)
      if (response != null) return response
    }
    return null
  }

  private fun forwardDnsUdp(query: ByteArray, resolver: InetSocketAddress): ByteArray? {
    return try {
      DatagramSocket().use { socket ->
        if (!vpnService.protect(socket)) return@use null
        socket.soTimeout = DNS_READ_TIMEOUT_MS
        socket.connect(resolver)
        socket.send(DatagramPacket(query, query.size))
        val buffer = ByteArray(MAX_DNS_RESPONSE_SIZE)
        val packet = DatagramPacket(buffer, buffer.size)
        socket.receive(packet)
        buffer.copyOf(packet.length).takeIf { it.isNotEmpty() }
      }
    } catch (_: Exception) {
      null
    }
  }

  // DNS-over-TLS (RFC 7858): bypasses ISP port-53 blocking by using an encrypted TCP connection
  // on port 853. Sockets are protected via vpnService.protect() (inside the pool) so they escape
  // the VPN tunnel, and kept warm between queries to avoid a TLS handshake per lookup.
  private fun forwardDot(query: ByteArray, resolver: InetSocketAddress): ByteArray? {
    return dotPool.query(resolver, query, DOT_TIMEOUT_MS)
  }

  private fun buildIpv4UdpPacket(
    sourceIp: Int,
    destinationIp: Int,
    sourcePort: Int,
    destinationPort: Int,
    payload: ByteArray
  ): ByteArray {
    val totalLength = IPV4_HEADER_LENGTH + UDP_HEADER_LENGTH + payload.size
    val response = ByteArray(totalLength)

    response[0] = 0x45
    response[1] = 0x00
    writeU16(response, 2, totalLength)
    writeU16(response, 4, 0)
    writeU16(response, 6, 0x4000)
    response[8] = 64
    response[9] = UDP_PROTOCOL.toByte()
    writeInt(response, 12, sourceIp)
    writeInt(response, 16, destinationIp)
    writeU16(response, 10, ipv4Checksum(response, 0, IPV4_HEADER_LENGTH))

    val udpOffset = IPV4_HEADER_LENGTH
    writeU16(response, udpOffset, sourcePort)
    writeU16(response, udpOffset + 2, destinationPort)
    writeU16(response, udpOffset + 4, UDP_HEADER_LENGTH + payload.size)
    writeU16(response, udpOffset + 6, 0)
    payload.copyInto(response, udpOffset + UDP_HEADER_LENGTH)

    return response
  }

  private fun ipv4Checksum(data: ByteArray, offset: Int, length: Int): Int {
    var sum = 0
    var index = offset
    while (index < offset + length) {
      sum += readU16(data, index)
      while (sum > 0xffff) {
        sum = (sum and 0xffff) + (sum ushr 16)
      }
      index += 2
    }
    return sum.inv() and 0xffff
  }

  private fun readU16(data: ByteArray, offset: Int): Int {
    return ((data[offset].toInt() and 0xff) shl 8) or (data[offset + 1].toInt() and 0xff)
  }

  private fun writeU16(data: ByteArray, offset: Int, value: Int) {
    data[offset] = ((value ushr 8) and 0xff).toByte()
    data[offset + 1] = (value and 0xff).toByte()
  }

  private fun readInt(data: ByteArray, offset: Int): Int {
    return ((data[offset].toInt() and 0xff) shl 24) or
      ((data[offset + 1].toInt() and 0xff) shl 16) or
      ((data[offset + 2].toInt() and 0xff) shl 8) or
      (data[offset + 3].toInt() and 0xff)
  }

  private fun writeInt(data: ByteArray, offset: Int, value: Int) {
    data[offset] = ((value ushr 24) and 0xff).toByte()
    data[offset + 1] = ((value ushr 16) and 0xff).toByte()
    data[offset + 2] = ((value ushr 8) and 0xff).toByte()
    data[offset + 3] = (value and 0xff).toByte()
  }

  private fun ipv4Address(data: ByteArray, offset: Int): String {
    return "${data[offset].toInt() and 0xff}.${data[offset + 1].toInt() and 0xff}" +
      ".${data[offset + 2].toInt() and 0xff}.${data[offset + 3].toInt() and 0xff}"
  }

  private data class DnsQuery(
    val sourceIp: Int,
    val destinationIp: Int,
    val destinationIpText: String,
    val sourcePort: Int,
    val destinationPort: Int,
    val dnsOffset: Int,
    val dnsLength: Int,
    val domain: String,
    val queryType: Int,
    val isIpv6: Boolean = false,
    val rawPacket: ByteArray? = null
  )

  private data class DnsCacheEntry(val response: ByteArray, val expiresAt: Long)

  companion object {
    private const val IPV4_HEADER_LENGTH = 20
    private const val IPV6_HEADER_LENGTH = 40
    private const val UDP_HEADER_LENGTH = 8
    private const val DNS_HEADER_LENGTH = 12
    private const val MIN_IPV4_UDP_DNS_SIZE = IPV4_HEADER_LENGTH + UDP_HEADER_LENGTH + DNS_HEADER_LENGTH
    private const val UDP_PROTOCOL = 17
    private const val DNS_PORT = 53
    private const val DNS_TYPE_A = 1
    private const val DNS_TYPE_CNAME = 5
    private const val DNS_TYPE_SVCB = 64
    private const val DNS_TYPE_HTTPS = 65
    private const val DNS_TYPE_AAAA = 28
    private const val VPN_DNS_ADDRESS = "10.88.0.1"
    private const val DNS_READ_TIMEOUT_MS = 1500
    private const val DOT_PORT = 853
    private const val DOT_TIMEOUT_MS = 2500
    private const val MAX_DNS_RESPONSE_SIZE = 4096
    private const val DEFAULT_CACHE_TTL_SECONDS = 60L
    private const val MIN_CACHE_TTL_SECONDS = 30L
    private const val MAX_CACHE_TTL_SECONDS = 3600L
    private const val DNS_CACHE_MAX_SIZE = 512
    private const val NEGATIVE_CACHE_TTL_MS = 3_000L
    private const val ACTION_PLAIN_DNS_BYPASS_INTERCEPTED = "plain_dns_bypass_intercepted"
    private const val ACTION_ECH_HINT_STRIPPED = "ech_hint_stripped"
    private const val ACTION_BLOCKED_UPSTREAM = "blocked_upstream"
    private const val ACTION_BLOCKED_HEURISTIC = "blocked_heuristic"

    private const val GOOGLE_SAFE_SEARCH_IP = "216.239.38.120"
    private const val BING_SAFE_SEARCH_IP = "204.79.197.220"
    private const val YOUTUBE_RESTRICTED_IP = "216.239.38.120"

    private val ECH_ADVERTISING_DNS_TYPES = setOf(DNS_TYPE_SVCB, DNS_TYPE_HTTPS)

    // Primary resolvers use DoT (port 853) to avoid ISP port-53 blocking and DNS tampering.
    // All three are family-safe: they block adult content and malware at the resolver level,
    // adding a second layer on top of the app's own domain classifier.
    // Worst-case latency: 2 × 2 500 ms (DoT) + 1 × 1 500 ms (UDP fallback) = 6.5 s, after which
    // the key is negatively cached for NEGATIVE_CACHE_TTL_MS so repeats return fast.
    private val DEFAULT_UPSTREAM_RESOLVERS = listOf(
      InetSocketAddress("1.1.1.3", DOT_PORT),          // Cloudflare Family — fastest, adult+malware filter
      InetSocketAddress("185.228.168.168", DOT_PORT),  // CleanBrowsing Family — strict family filter
      InetSocketAddress("1.1.1.3", DNS_PORT)           // Cloudflare Family UDP — fallback if DoT blocked
    )

    // Non-content-filtering resolvers used only for user-allowlisted domains, so an
    // explicit "allow this site" actually resolves instead of being blocked upstream.
    // (9.9.9.9 still blocks malware but never adult content.)
    private val UNFILTERED_UPSTREAM_RESOLVERS = listOf(
      InetSocketAddress("1.1.1.1", DOT_PORT),          // Cloudflare — unfiltered
      InetSocketAddress("9.9.9.9", DOT_PORT),          // Quad9 — malware-only, no content filter
      InetSocketAddress("1.1.1.1", DNS_PORT)           // Cloudflare UDP — fallback if DoT blocked
    )

    private val PUBLIC_DNS_RESOLVER_IPV4 = setOf(
      "1.1.1.1", "1.0.0.1", "1.1.1.2", "1.0.0.2", "1.1.1.3", "1.0.0.3",
      "8.8.8.8", "8.8.4.4",
      "9.9.9.9", "149.112.112.112",
      "208.67.222.222", "208.67.220.220", "208.67.222.123", "208.67.220.123",
      "94.140.14.14", "94.140.15.15", "94.140.14.15", "94.140.15.16",
      "185.228.168.9", "185.228.169.9", "185.228.168.10", "185.228.169.11",
      "185.228.168.168", "185.228.169.168",
      "45.90.28.0", "45.90.30.0",
      "76.76.2.0", "76.76.10.0"
    )

    private val PUBLIC_DNS_RESOLVER_IPV6 = setOf(
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

    private val PUBLIC_DNS_RESOLVERS = PUBLIC_DNS_RESOLVER_IPV4 + PUBLIC_DNS_RESOLVER_IPV6
  }
}
