package com.example.blocker

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DnsResponseParserTest {

  private data class Answer(val type: Int, val ttl: Long, val rdata: ByteArray)

  // Builds a response with one question (example.com, A/IN) and the given answers,
  // each using a compression pointer back to the question name.
  private fun dnsResponse(rcode: Int, answers: List<Answer>): ByteArray {
    val question = byteArrayOf(
      7, 'e'.code.toByte(), 'x'.code.toByte(), 'a'.code.toByte(), 'm'.code.toByte(),
      'p'.code.toByte(), 'l'.code.toByte(), 'e'.code.toByte(),
      3, 'c'.code.toByte(), 'o'.code.toByte(), 'm'.code.toByte(),
      0,
      0, 1, // QTYPE A
      0, 1  // QCLASS IN
    )
    val answerBytes = answers.flatMap { answer ->
      val header = byteArrayOf(
        0xc0.toByte(), 0x0c, // name pointer to offset 12
        ((answer.type ushr 8) and 0xff).toByte(), (answer.type and 0xff).toByte(),
        0, 1, // class IN
        ((answer.ttl ushr 24) and 0xffL).toByte(), ((answer.ttl ushr 16) and 0xffL).toByte(),
        ((answer.ttl ushr 8) and 0xffL).toByte(), (answer.ttl and 0xffL).toByte(),
        ((answer.rdata.size ushr 8) and 0xff).toByte(), (answer.rdata.size and 0xff).toByte()
      )
      (header + answer.rdata).toList()
    }.toByteArray()

    val header = byteArrayOf(
      0x12, 0x34,
      0x81.toByte(), (0x80 or rcode).toByte(),
      0, 1, // QDCOUNT
      ((answers.size ushr 8) and 0xff).toByte(), (answers.size and 0xff).toByte(),
      0, 0, // NSCOUNT
      0, 0  // ARCOUNT
    )
    return header + question + answerBytes
  }

  @Test
  fun `reads ttl and real address from a plain A answer`() {
    val response = dnsResponse(0, listOf(Answer(1, 300L, byteArrayOf(93, 184.toByte(), 216.toByte(), 34))))
    val summary = DnsResponseParser.summarize(response)
    assertNotNull(summary)
    assertEquals(0, summary!!.rcode)
    assertEquals(300L, summary.minAnswerTtlSeconds)
    assertEquals(1, summary.addressRecordCount)
    assertEquals(0, summary.nullAddressCount)
    assertFalse(summary.looksUpstreamFiltered)
  }

  @Test
  fun `flags all-zero A answer as upstream filtered`() {
    val response = dnsResponse(0, listOf(Answer(1, 60L, ByteArray(4))))
    val summary = DnsResponseParser.summarize(response)
    assertNotNull(summary)
    assertTrue(summary!!.looksUpstreamFiltered)
  }

  @Test
  fun `flags all-zero AAAA answer as upstream filtered`() {
    val response = dnsResponse(0, listOf(Answer(28, 60L, ByteArray(16))))
    val summary = DnsResponseParser.summarize(response)
    assertNotNull(summary)
    assertTrue(summary!!.looksUpstreamFiltered)
  }

  @Test
  fun `mixed zero and real addresses are not upstream filtered`() {
    val response = dnsResponse(
      0,
      listOf(
        Answer(1, 120L, ByteArray(4)),
        Answer(1, 120L, byteArrayOf(1, 2, 3, 4))
      )
    )
    val summary = DnsResponseParser.summarize(response)
    assertNotNull(summary)
    assertEquals(2, summary!!.addressRecordCount)
    assertEquals(1, summary.nullAddressCount)
    assertFalse(summary.looksUpstreamFiltered)
  }

  @Test
  fun `min ttl spans cname and address records`() {
    val cnameTarget = byteArrayOf(3, 'w'.code.toByte(), 'w'.code.toByte(), 'w'.code.toByte(), 0xc0.toByte(), 0x0c)
    val response = dnsResponse(
      0,
      listOf(
        Answer(5, 30L, cnameTarget),
        Answer(1, 600L, byteArrayOf(1, 2, 3, 4))
      )
    )
    val summary = DnsResponseParser.summarize(response)
    assertNotNull(summary)
    assertEquals(30L, summary!!.minAnswerTtlSeconds)
    assertFalse(summary.looksUpstreamFiltered)
  }

  @Test
  fun `nxdomain without answers has no ttl and is not filtered`() {
    val response = dnsResponse(3, emptyList())
    val summary = DnsResponseParser.summarize(response)
    assertNotNull(summary)
    assertEquals(3, summary!!.rcode)
    assertNull(summary.minAnswerTtlSeconds)
    assertFalse(summary.looksUpstreamFiltered)
  }

  @Test
  fun `truncated response returns null instead of throwing`() {
    val full = dnsResponse(0, listOf(Answer(1, 300L, byteArrayOf(1, 2, 3, 4))))
    val truncated = full.copyOf(full.size - 6)
    assertNull(DnsResponseParser.summarize(truncated))
  }

  @Test
  fun `garbage shorter than a header returns null`() {
    assertNull(DnsResponseParser.summarize(byteArrayOf(1, 2, 3)))
  }
}
