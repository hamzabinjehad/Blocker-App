package com.example.blocker

import com.google.mlkit.vision.label.ImageLabel
import org.junit.Assert.*
import org.junit.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.whenever

class ImageContentScannerTest {

  private fun fakeLabel(text: String, confidence: Float): ImageLabel {
    return mock<ImageLabel>().also {
      whenever(it.text).thenReturn(text)
      whenever(it.confidence).thenReturn(confidence)
    }
  }

  @Test
  fun `score is 0 for empty label list`() {
    val decision = ImageContentScanner.classify(emptyList())
    assertEquals(0.0, decision.score, 0.01)
    assertEquals("allow", decision.action)
  }

  @Test
  fun `nudity label alone exceeds threshold`() {
    val labels = listOf(fakeLabel("Nudity", 0.92f))
    val decision = ImageContentScanner.classify(labels)
    assertTrue("Score ${decision.score} should exceed 0.72", decision.score > 0.72)
    assertEquals("block", decision.action)
  }

  @Test
  fun `swimwear with safe context does not exceed threshold`() {
    val labels = listOf(
      fakeLabel("Swimwear", 0.85f),
      fakeLabel("Beach", 0.90f),
      fakeLabel("Sports", 0.85f)
    )
    val decision = ImageContentScanner.classify(labels)
    assertTrue("Score ${decision.score} should not exceed 0.72", decision.score < 0.72)
  }

  @Test
  fun `multiple moderate labels can combine to exceed threshold`() {
    val labels = listOf(
      fakeLabel("Undergarment", 0.90f),
      fakeLabel("Lingerie", 0.85f),
      fakeLabel("Brassiere", 0.80f)
    )
    val decision = ImageContentScanner.classify(labels)
    assertTrue("Combined score ${decision.score} should exceed 0.72", decision.score > 0.72)
    assertEquals("block", decision.action)
  }

  @Test
  fun `safe context labels reduce score`() {
    val withContext = listOf(
      fakeLabel("Skin", 0.88f),
      fakeLabel("Sports", 0.92f),
      fakeLabel("Athlete", 0.85f)
    )
    val withoutContext = listOf(
      fakeLabel("Skin", 0.88f)
    )
    val scoreWithContext = ImageContentScanner.classify(withContext).score
    val scoreWithoutContext = ImageContentScanner.classify(withoutContext).score
    assertTrue(
      "Context should reduce score: $scoreWithContext vs $scoreWithoutContext",
      scoreWithContext <= scoreWithoutContext
    )
  }

  @Test
  fun `human context boost applied when person detected`() {
    val withPerson = listOf(
      fakeLabel("Skin", 0.70f),
      fakeLabel("Person", 0.90f)
    )
    val withoutPerson = listOf(
      fakeLabel("Skin", 0.70f)
    )
    val scoreWithPerson = ImageContentScanner.classify(withPerson).score
    val scoreWithoutPerson = ImageContentScanner.classify(withoutPerson).score
    assertTrue(
      "Person context should boost score",
      scoreWithPerson > scoreWithoutPerson
    )
  }

  @Test
  fun `score is clamped to valid range`() {
    val labels = listOf(
      fakeLabel("Nudity", 0.99f),
      fakeLabel("Lingerie", 0.99f),
      fakeLabel("Undergarment", 0.99f),
      fakeLabel("Brassiere", 0.99f),
      fakeLabel("Bikini", 0.99f),
      fakeLabel("Person", 0.99f)
    )
    val decision = ImageContentScanner.classify(labels)
    assertTrue("Score should be <= 1.0", decision.score <= 1.0)
    assertTrue("Score should be >= 0.0", decision.score >= 0.0)
  }

  @Test
  fun `scan throttle prevents rapid rescanning`() {
    val pkg = "com.test.throttle"
    assertTrue("First scan should be allowed", ImageContentScanner.shouldScan(pkg))
    assertFalse("Immediate rescan should be throttled", ImageContentScanner.shouldScan(pkg))
  }
}
