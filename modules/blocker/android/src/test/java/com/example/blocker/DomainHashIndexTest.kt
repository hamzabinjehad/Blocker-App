package com.example.blocker

import org.junit.Assert.*
import org.junit.Test
import java.io.BufferedReader
import java.io.File

class DomainHashIndexTest {

  private fun tempFile(prefix: String): File =
    File.createTempFile(prefix, ".tmp").apply { deleteOnExit() }

  private fun reader(vararg lines: String): () -> BufferedReader? =
    { lines.joinToString("\n").reader().buffered() }

  @Test
  fun `matches exact domain and subdomains but not unrelated domains`() {
    val idx = tempFile("idx")
    idx.delete()
    val matcher = DomainHashIndex.loadOrBuild(
      idx,
      tag = 1L,
      reader("pornhub.com", "xvideos.com", "ads.tracker.org"),
    )

    assertTrue(matcher.matches("pornhub.com"))
    assertTrue(matcher.matches("www.pornhub.com"))
    assertTrue(matcher.matches("a.b.xvideos.com"))
    assertTrue(matcher.matches("ads.tracker.org"))

    assertFalse(matcher.matches("tracker.org"))          // parent of an entry, not itself listed
    assertFalse(matcher.matches("xvideos.com.evil.com")) // suffix-walk must not match this
    assertFalse(matcher.matches("example.com"))
    assertEquals(3, matcher.size)
  }

  @Test
  fun `skips blank and comment lines`() {
    val idx = tempFile("idx2")
    idx.delete()
    val matcher = DomainHashIndex.loadOrBuild(
      idx,
      tag = 2L,
      reader("# comment", "", "  ", "example.org", ".trailing.dot.net."),
    )
    assertEquals(2, matcher.size)
    assertTrue(matcher.matches("example.org"))
    assertTrue(matcher.matches("trailing.dot.net"))
  }

  @Test
  fun `reuses cached index when tag matches and rebuilds when it changes`() {
    val idx = tempFile("idx3")
    idx.delete()

    DomainHashIndex.loadOrBuild(idx, tag = 10L, reader("first.com"))
    assertTrue(idx.exists())

    // Same tag: the openReader should not be consulted (return empty), yet the cached entry loads.
    val cached = DomainHashIndex.loadOrBuild(idx, tag = 10L) { null }
    assertTrue(cached.matches("first.com"))

    // Different tag: cache is invalid, so it rebuilds from the new source.
    val rebuilt = DomainHashIndex.loadOrBuild(idx, tag = 11L, reader("second.com"))
    assertTrue(rebuilt.matches("second.com"))
    assertFalse(rebuilt.matches("first.com"))
  }

  @Test
  fun `returns empty matcher when source is unavailable`() {
    val idx = tempFile("idx4")
    idx.delete()
    val matcher = DomainHashIndex.loadOrBuild(idx, tag = 3L) { null }
    assertEquals(0, matcher.size)
    assertFalse(matcher.matches("anything.com"))
  }
}
