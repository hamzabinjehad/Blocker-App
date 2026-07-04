package com.example.blocker

/**
 * Minimal reader for upstream DNS responses. Lets the filter honour upstream TTLs in its
 * local cache and spot answers the family resolver has already filtered (every address
 * record 0.0.0.0 / ::), which would otherwise be invisible to the audit log and the
 * "recently blocked" review flow.
 */
object DnsResponseParser {
  data class Summary(
    val rcode: Int,
    val minAnswerTtlSeconds: Long?,
    val addressRecordCount: Int,
    val nullAddressCount: Int
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
      offset = skipName(response, offset) ?: return null
      offset += 4 // QTYPE + QCLASS
      if (offset > response.size) return null
    }

    var minTtl: Long? = null
    var addressRecords = 0
    var nullAddresses = 0
    repeat(answerCount) {
      offset = skipName(response, offset) ?: return null
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
      offset += rdLength
    }

    return Summary(rcode, minTtl, addressRecords, nullAddresses)
  }

  private fun allZero(data: ByteArray, offset: Int, length: Int): Boolean {
    for (index in offset until offset + length) {
      if (data[index].toInt() != 0) return false
    }
    return true
  }

  private fun skipName(data: ByteArray, start: Int): Int? {
    var offset = start
    while (offset < data.size) {
      val length = data[offset].toInt() and 0xff
      when {
        length == 0 -> return offset + 1
        length and 0xc0 == 0xc0 -> return (offset + 2).takeIf { it <= data.size }
        else -> offset += 1 + length
      }
    }
    return null
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
  private const val TYPE_A = 1
  private const val TYPE_AAAA = 28
}
