package com.example.blocker

import android.net.VpnService
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URL
import java.util.Locale

class LocalHttpProxy(
  private val service: VpnService,
  private val repository: PolicyRepository,
  private val port: Int = DEFAULT_PORT
) {
  private var serverSocket: ServerSocket? = null
  private var worker: Thread? = null
  private val urlPolicy = UrlPolicyEvaluator(service.applicationContext, repository)

  fun start(): Boolean {
    if (worker?.isAlive == true) return true

    return try {
      val socket = ServerSocket()
      socket.reuseAddress = true
      socket.bind(InetSocketAddress(InetAddress.getByName(LOOPBACK_HOST), port))
      serverSocket = socket
      worker = Thread({ acceptLoop(socket) }, "ParentBlockerLocalProxy").also { it.start() }
      true
    } catch (cause: Exception) {
      repository.recordAuditEvent(
        eventType = "HTTPS_PROXY_START_FAILED",
        severity = "critical",
        category = "https_proxy",
        subject = LOOPBACK_HOST,
        action = "start_failed",
        metadata = mapOf("reason" to cause.javaClass.simpleName)
      )
      false
    }
  }

  fun stop() {
    try {
      serverSocket?.close()
    } catch (_: Exception) {
    } finally {
      serverSocket = null
    }
    worker?.interrupt()
    worker = null
  }

  private fun acceptLoop(socket: ServerSocket) {
    while (!Thread.currentThread().isInterrupted && !socket.isClosed) {
      val client = try {
        socket.accept()
      } catch (_: Exception) {
        break
      }
      Thread({ handleClient(client) }, "ParentBlockerProxyClient").start()
    }
  }

  private fun handleClient(client: Socket) {
    client.use { socket ->
      socket.soTimeout = CLIENT_READ_TIMEOUT_MS
      val input = socket.getInputStream()
      val output = socket.getOutputStream()
      val requestLine = readLine(input) ?: return
      val headers = readHeaders(input)

      if (requestLine.uppercase(Locale.US).startsWith("CONNECT ")) {
        handleConnect(requestLine, socket, output)
      } else {
        handleHttpRequest(requestLine, headers, socket, output)
      }
    }
  }

  private fun handleConnect(requestLine: String, client: Socket, output: OutputStream) {
    val target = requestLine.substringAfter("CONNECT", "").trim().substringBefore(" ")
    val host = target.substringBefore(":").trim().lowercase()
    val port = target.substringAfter(":", "443").toIntOrNull() ?: 443
    if (host.isBlank() || urlPolicy.evaluateHost(host, "https_connect").blocked) {
      writeProxyBlock(output)
      return
    }

    val upstream = Socket()
    try {
      service.protect(upstream)
      upstream.connect(InetSocketAddress(host, port), UPSTREAM_CONNECT_TIMEOUT_MS)
      output.write("HTTP/1.1 200 Connection Established\r\n\r\n".toByteArray(Charsets.ISO_8859_1))
      output.flush()
      tunnel(client, upstream)
    } catch (_: Exception) {
      writeProxyError(output)
    } finally {
      try {
        upstream.close()
      } catch (_: Exception) {
      }
    }
  }

  private fun handleHttpRequest(
    requestLine: String,
    headers: List<String>,
    client: Socket,
    output: OutputStream
  ) {
    val parts = requestLine.split(" ")
    if (parts.size < 3) {
      writeProxyError(output)
      return
    }
    val method = parts[0]
    val rawTarget = parts[1]
    val version = parts[2]
    val hostHeader = headers.firstOrNull { it.startsWith("Host:", ignoreCase = true) }
      ?.substringAfter(":")
      ?.trim()
      .orEmpty()

    val parsed = parseHttpTarget(rawTarget, hostHeader) ?: run {
      writeProxyError(output)
      return
    }
    val decision = urlPolicy.evaluateHttpRequest(parsed.host, parsed.path, "http_proxy")
    if (decision.blocked) {
      writeProxyBlock(output)
      return
    }
    val upstreamPath = decision.rewrittenPath ?: parsed.path

    val upstream = Socket()
    try {
      service.protect(upstream)
      upstream.connect(InetSocketAddress(parsed.host, parsed.port), UPSTREAM_CONNECT_TIMEOUT_MS)
      val upstreamOutput = upstream.getOutputStream()
      upstreamOutput.write("$method $upstreamPath $version\r\n".toByteArray(Charsets.ISO_8859_1))
      headers
        .filterNot { it.startsWith("Proxy-Connection:", ignoreCase = true) }
        .forEach { header ->
          upstreamOutput.write("$header\r\n".toByteArray(Charsets.ISO_8859_1))
        }
      upstreamOutput.write("\r\n".toByteArray(Charsets.ISO_8859_1))
      upstreamOutput.flush()
      tunnel(client, upstream)
    } catch (_: Exception) {
      writeProxyError(output)
    } finally {
      try {
        upstream.close()
      } catch (_: Exception) {
      }
    }
  }

  private fun parseHttpTarget(rawTarget: String, hostHeader: String): HttpTarget? {
    return try {
      if (rawTarget.startsWith("http://", ignoreCase = true) || rawTarget.startsWith("https://", ignoreCase = true)) {
        val url = URL(rawTarget)
        val path = url.file.takeIf { it.isNotBlank() } ?: "/"
        HttpTarget(
          host = url.host.lowercase(),
          port = if (url.port > 0) url.port else url.defaultPort.takeIf { it > 0 } ?: 80,
          path = path
        )
      } else {
        val host = hostHeader.substringBefore(":").trim().lowercase()
        val port = hostHeader.substringAfter(":", "80").toIntOrNull() ?: 80
        if (host.isBlank()) null else HttpTarget(host, port, rawTarget.ifBlank { "/" })
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun tunnel(left: Socket, right: Socket) {
    val leftToRight = Thread({ pipe(left.getInputStream(), right.getOutputStream()) }, "ProxyPipeOut")
    val rightToLeft = Thread({ pipe(right.getInputStream(), left.getOutputStream()) }, "ProxyPipeIn")
    leftToRight.start()
    rightToLeft.start()
    leftToRight.join(TUNNEL_JOIN_TIMEOUT_MS)
    rightToLeft.join(TUNNEL_JOIN_TIMEOUT_MS)
  }

  private fun pipe(input: InputStream, output: OutputStream) {
    val buffer = ByteArray(16 * 1024)
    try {
      while (true) {
        val read = input.read(buffer)
        if (read <= 0) break
        output.write(buffer, 0, read)
        output.flush()
      }
    } catch (_: Exception) {
    }
  }

  private fun readHeaders(input: InputStream): List<String> {
    val headers = mutableListOf<String>()
    while (headers.size < MAX_HEADERS) {
      val line = readLine(input) ?: break
      if (line.isBlank()) break
      headers.add(line)
    }
    return headers
  }

  private fun readLine(input: InputStream): String? {
    val buffer = ByteArrayOutputStream()
    while (buffer.size() < MAX_LINE_LENGTH) {
      val next = input.read()
      if (next == -1) return buffer.takeIf { it.size() > 0 }?.toString(Charsets.ISO_8859_1.name())
      if (next == '\n'.code) break
      if (next != '\r'.code) buffer.write(next)
    }
    return buffer.toString(Charsets.ISO_8859_1.name())
  }

  private fun writeProxyBlock(output: OutputStream) {
    output.write(
      "HTTP/1.1 451 Unavailable For Legal Reasons\r\nConnection: close\r\nContent-Length: 0\r\n\r\n"
        .toByteArray(Charsets.ISO_8859_1)
    )
    output.flush()
  }

  private fun writeProxyError(output: OutputStream) {
    output.write("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n".toByteArray(Charsets.ISO_8859_1))
    output.flush()
  }

  private data class HttpTarget(val host: String, val port: Int, val path: String)

  companion object {
    const val DEFAULT_PORT = 8891
    private const val LOOPBACK_HOST = "127.0.0.1"
    private const val CLIENT_READ_TIMEOUT_MS = 15_000
    private const val UPSTREAM_CONNECT_TIMEOUT_MS = 10_000
    private const val TUNNEL_JOIN_TIMEOUT_MS = 60_000L
    private const val MAX_HEADERS = 80
    private const val MAX_LINE_LENGTH = 8192
  }
}
