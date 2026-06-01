package com.example.blocker

import org.junit.Assert.assertEquals
import org.junit.Test

class GalleryContentScannerTest {
  @Test
  fun `scan limit is bounded for responsiveness`() {
    assertEquals(24, GalleryContentScanner.coerceScanLimit(null))
    assertEquals(1, GalleryContentScanner.coerceScanLimit(0))
    assertEquals(12, GalleryContentScanner.coerceScanLimit(12))
    assertEquals(60, GalleryContentScanner.coerceScanLimit(500))
  }
}
