package com.example.blocker

/**
 * Minimal reader for upstream DNS responses. Lets the filter honour upstream TTLs in its
 * local cache, spot answers the family resolver has already filtered (every address
 * record 0.0.0.0 / ::), and follow the CNAME chain so a benign-looking name cannot cloak a
 * blocked one (`cdn.example.com CNAME media.blocked.example`).
 */
object DnsResponseParser {
  data class Summary(
    val rcode: Int,
    val minAnswerTtlSeconds: Long?,
    val addressRecordCount: Int,
    val nullAddressCount: Int,
    /** Targets of every CNAME record in the answer section, in wire order. */
    val cnameTargets: List<String> = emptyList()
  ) {
    // A NOERROR answer whose every address is the unspecified address is the convention
    // family resolvers (e.g. Cloudflare 1.1.1.3) use for domains they filter.
    val looksUpstreamFiltered: Boolean
      get() = rcode == 0 && addressRecordCount > 0 && nullAddressCount == addressRecordCount
  }

  fun summarize(response: ByteArray): Summary? {
    if (response.size < DNS_HEADER_LENGTH) return null
    val rcode = response[3].toInt() and 0x0f
    val questionCount = readU16(response, 4)
    val answerCount = readU16(response, 6)

    var offset = DNS_HEADER_LENGTH
    repeat(questionCount) {
      offset = readName(response, offset)?.nextOffset ?: return null
      offset += 4 // QTYPE + QCLASS
      if (offset > response.size) return null
    }

    var minTtl: Long? = null
    var addressRecords = 0
    var nullAddresses = 0
    val cnameTargets = mutableListOf<String>()
    repeat(answerCount) {
      offset = readName(response, offset)?.nextOffset ?: return null
      if (offset + RR_FIXED_HEADER_LENGTH > response.size) return null
      val type = readU16(response, offset)
      val ttl = readU32(response, offset + 4)
      val rdLength = readU16(response, offset + 8)
      offset += RR_FIXED_HEADER_LENGTH
      if (offset + rdLength > response.size) return null
      minTtl = minOf(minTtl ?: Long.MAX_VALUE, ttl)
      val isA = type == TYPE_A && rdLength == 4
      val isAaaa = type == TYPE_AAAA && rdLength == 16
      if (isA || isAaaa) {
        addressRecords += 1
        if (allZero(response, offset, rdLength)) nullAddresses += 1
      }
      if (type == TYPE_CNAME && rdLength > 0) {
        // RDATA of a CNAME is a domain name and may itself use a compression pointer.
        readName(response, offset)?.name
          ?.takeIf { it.isNotBlank() }
          ?.let { cnameTargets += it }
      }
      offset += rdLength
    }

    return Summary(rcode, minTtl, addressRecords, nullAddresses, cnameTargets.toList())
  }

  private fun allZero(data: ByteArray, offset: Int, length: Int): Boolean {
    for (index in offset until offset + length) {
      if (data[index].toInt() != 0) return false
    }
    return true
  }

  private data class NameRead(val name: String, val nextOffset: Int)

  /**
   * Reads a (possibly compressed) domain name. `nextOffset` is the position right after the
   * name *as encoded at `start`* — following a pointer never advances the caller past it.
   * Returns null on malformed input, including pointer loops.
   */
  private fun readName(data: ByteArray, start: Int): NameRead? {
    val labels = mutableListOf<String>()
    var offset = start
    var jumps = 0
    var nextOffset = -1

    while (true) {
      if (offset < 0 || offset >= data.size) return null
      val length = data[offset].toInt() and 0xff
      when {
        length == 0 -> {
          if (nextOffset == -1) nextOffset = offset + 1
          return NameRead(labels.joinToString("."), nextOffset)
        }
        length and 0xc0 == 0xc0 -> {
          if (offset + 1 >= data.size) return null
          if (jumps >= MAX_NAME_JUMPS) return null
          jumps += 1
          if (nextOffset == -1) nextOffset = offset + 2
          offset = ((length and 0x3f) shl 8) or (data[offset + 1].toInt() and 0xff)
        }
        length > MAX_LABEL_LENGTH -> return null
        else -> {
          if (offset + 1 + length > data.size) return null
          labels += String(data, offset + 1, length, Charsets.UTF_8)
          offset += 1 + length
        }
      }
    }
  }

  private fun readU16(data: ByteArray, offset: Int): Int =
    ((data[offset].toInt() and 0xff) shl 8) or (data[offset + 1].toInt() and 0xff)

  private fun readU32(data: ByteArray, offset: Int): Long =
    ((data[offset].toInt() and 0xff).toLong() shl 24) or
      ((data[offset + 1].toInt() and 0xff).toLong() shl 16) or
      ((data[offset + 2].toInt() and 0xff).toLong() shl 8) or
      (data[offset + 3].toInt() and 0xff).toLong()

  private const val DNS_HEADER_LENGTH = 12
  private const val RR_FIXED_HEADER_LENGTH = 10
  private const val MAX_LABEL_LENGTH = 63
  private const val MAX_NAME_JUMPS = 16
  private const val TYPE_A = 1
  private const val TYPE_CNAME = 5
  private const val TYPE_AAAA = 28
}
