package com.example.blocker

import android.net.VpnService
import android.os.SystemClock
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import javax.net.ssl.SSLSocket
import javax.net.ssl.SSLSocketFactory

/**
 * Keeps DNS-over-TLS connections warm between queries. A fresh TCP + TLS handshake for every
 * lookup is the dominant CPU/radio cost of the DNS filter, so sockets are pooled per resolver
 * and reused until the server closes them or they sit idle past [IDLE_TTL_MS].
 */
class DotConnectionPool(private val vpnService: VpnService) {
  private class PooledSocket(val socket: SSLSocket) {
    var lastUsedAtMs: Long = SystemClock.elapsedRealtime()
  }

  private val pools = ConcurrentHashMap<String, ConcurrentLinkedQueue<PooledSocket>>()
  @Volatile private var closed = false

  fun query(resolver: InetSocketAddress, query: ByteArray, timeoutMs: Int): ByteArray? {
    if (closed) return null
    val key = "${resolver.address?.hostAddress}:${resolver.port}"
    val pool = pools.getOrPut(key) { ConcurrentLinkedQueue() }

    // Prefer a warm socket. A failed exchange on a reused socket usually means the server
    // closed it while idle, so fall through and retry once on a fresh connection.
    while (true) {
      val pooled = pool.poll() ?: break
      if (SystemClock.elapsedRealtime() - pooled.lastUsedAtMs > IDLE_TTL_MS) {
        closeQuietly(pooled.socket)
        continue
      }
      val response = exchangeOrNull(pooled.socket, query, timeoutMs)
      if (response != null) {
        recycle(pool, pooled)
        return response
      }
      closeQuietly(pooled.socket)
      break
    }

    val socket = openSocket(resolver, timeoutMs) ?: return null
    val response = exchangeOrNull(socket, query, timeoutMs)
    return if (response != null) {
      recycle(pool, PooledSocket(socket))
      response
    } else {
      closeQuietly(socket)
      null
    }
  }

  fun closeAll() {
    closed = true
    pools.values.forEach { pool ->
      while (true) {
        val pooled = pool.poll() ?: break
        closeQuietly(pooled.socket)
      }
    }
    pools.clear()
  }

  private fun recycle(pool: ConcurrentLinkedQueue<PooledSocket>, pooled: PooledSocket) {
    pooled.lastUsedAtMs = SystemClock.elapsedRealtime()
    if (closed || pool.size >= MAX_SOCKETS_PER_RESOLVER) {
      closeQuietly(pooled.socket)
    } else {
      pool.offer(pooled)
    }
  }

  private fun openSocket(resolver: InetSocketAddress, timeoutMs: Int): SSLSocket? {
    val rawSocket = Socket()
    return try {
      if (!vpnService.protect(rawSocket)) {
        rawSocket.close()
        return null
      }
      rawSocket.connect(resolver, timeoutMs)
      rawSocket.tcpNoDelay = true
      val hostAddress = resolver.address?.hostAddress ?: run { rawSocket.close(); return null }
      val factory = SSLSocketFactory.getDefault() as SSLSocketFactory
      val ssl = factory.createSocket(rawSocket, hostAddress, resolver.port, true) as SSLSocket
      // Verify the certificate actually belongs to the resolver IP (via its IP SANs); a plain
      // SSLSocket performs no hostname verification at all, which would let any CA-signed
      // certificate impersonate the resolver. Failures fall back to the next resolver/UDP.
      ssl.sslParameters = ssl.sslParameters.apply { endpointIdentificationAlgorithm = "HTTPS" }
      ssl.soTimeout = timeoutMs
      ssl.startHandshake()
      ssl
    } catch (_: Exception) {
      try { rawSocket.close() } catch (_: IOException) { }
      null
    }
  }

  // RFC 7858 framing: 2-byte length prefix on both the query and the response.
  private fun exchangeOrNull(socket: SSLSocket, query: ByteArray, timeoutMs: Int): ByteArray? {
    return try {
      socket.soTimeout = timeoutMs
      val output = socket.outputStream
      output.write((query.size ushr 8) and 0xff)
      output.write(query.size and 0xff)
      output.write(query)
      output.flush()
      val input = socket.inputStream
      val lengthHigh = input.read()
      val lengthLow = input.read()
      if (lengthHigh < 0 || lengthLow < 0) return null
      val responseLength = (lengthHigh shl 8) or lengthLow
      if (responseLength <= 0 || responseLength > MAX_DNS_RESPONSE_SIZE) return null
      val buffer = ByteArray(responseLength)
      var totalRead = 0
      while (totalRead < responseLength) {
        val read = input.read(buffer, totalRead, responseLength - totalRead)
        if (read < 0) break
        totalRead += read
      }
      if (totalRead == responseLength) buffer else null
    } catch (_: Exception) {
      null
    }
  }

  private fun closeQuietly(socket: SSLSocket) {
    try { socket.close() } catch (_: Exception) { }
  }

  companion object {
    // Slightly under common server idle timeouts (Cloudflare closes DoT connections at ~60s)
    // so we proactively drop sockets the server is about to abandon.
    private const val IDLE_TTL_MS = 55_000L
    private const val MAX_SOCKETS_PER_RESOLVER = 3
    private const val MAX_DNS_RESPONSE_SIZE = 4096
  }
}
