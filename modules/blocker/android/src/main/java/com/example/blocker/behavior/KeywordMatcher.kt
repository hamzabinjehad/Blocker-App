package com.example.blocker.behavior

import java.text.Normalizer
import java.net.URLDecoder
import java.util.Locale

data class KeywordMatch(
  val keyword: String,
  val source: String,
  val normalizedInput: String
)

object KeywordMatcher {
  private val builtInAdultKeywords = setOf(
    "porn",
    "porno",
    "pornography",
    "xxx",
    "nsfw",
    "adult video",
    "explicit video",
    "sex video",
    "nude",
    "nudes",
    "naked",
    "nudity",
    "onlyfans",
    "fansly",
    "cam girl",
    "cam site",
    "escort",
    "hentai",
    "xvideos",
    "xnxx",
    "xhamster"
  )

  private val compactSubstringKeywords = setOf(
    "porn",
    "porno",
    "xxx",
    "onlyfans",
    "fansly",
    "hentai",
    "xvideos",
    "xnxx",
    "xhamster"
  )

  fun builtInCount(): Int = builtInAdultKeywords.size

  fun normalize(input: String): String {
    return normalizeForMatch(input).spaced
  }

  private fun normalizeForMatch(input: String): NormalizedText {
    val normalized = Normalizer.normalize(expandUrlEncoding(input), Normalizer.Form.NFKC)
    val spaced = normalized
      .lowercase(Locale.US)
      .replace(Regex("[\\p{Cntrl}]"), " ")
      .map { char -> normalizeObfuscatedChar(char) }
      .joinToString("")
      .replace(Regex("[^\\p{L}\\p{N}\\s._+-]"), " ")
      .replace(Regex("\\s+"), " ")
      .trim()
    val compact = spaced.replace(Regex("[^\\p{L}\\p{N}]"), "")
    return NormalizedText(spaced = spaced, compact = compact)
  }

  fun find(
    input: String,
    customKeywords: Set<String>,
    builtInKeywords: Set<String> = builtInAdultKeywords
  ): KeywordMatch? {
    val normalizedInput = normalizeForMatch(input)
    if (normalizedInput.spaced.isBlank()) return null

    val normalizedCustom = customKeywords
      .map { normalizeForMatch(it) }
      .filter { it.spaced.isNotBlank() }

    normalizedCustom.firstOrNull { containsKeyword(normalizedInput, it) }?.let { keyword ->
      return KeywordMatch(keyword = keyword.spaced, source = "custom", normalizedInput = normalizedInput.spaced)
    }

    val activeBuiltIns = builtInKeywords.ifEmpty { builtInAdultKeywords }

    activeBuiltIns
      .map { normalizeForMatch(it) }
      .firstOrNull { containsKeyword(normalizedInput, it) }
      ?.let { keyword ->
        return KeywordMatch(keyword = keyword.spaced, source = "built_in", normalizedInput = normalizedInput.spaced)
      }

    return null
  }

  private fun containsKeyword(normalizedInput: NormalizedText, normalizedKeyword: NormalizedText): Boolean {
    if (containsSpacedKeyword(normalizedInput.spaced, normalizedKeyword.spaced)) {
      return true
    }

    if (
      normalizedKeyword.compact in compactSubstringKeywords &&
      normalizedInput.compact.contains(normalizedKeyword.compact)
    ) {
      return true
    }

    if (!normalizedKeyword.spaced.contains(" ") && normalizedKeyword.compact.isNotBlank()) {
      return containsCompactKeyword(normalizedInput.spaced, normalizedKeyword.compact)
    }

    return false
  }

  private fun containsSpacedKeyword(normalizedInput: String, normalizedKeyword: String): Boolean {
    val escaped = Regex.escape(normalizedKeyword)
    val boundary = "(^|[^\\p{L}\\p{N}])$escaped([^\\p{L}\\p{N}]|$)"
    return Regex(boundary).containsMatchIn(normalizedInput)
  }

  private fun containsCompactKeyword(normalizedInput: String, compactKeyword: String): Boolean {
    if (normalizedInput.isBlank() || compactKeyword.isBlank()) return false
    val separator = "[\\s._+\\-]*"
    val escaped = compactKeyword
      .map { char -> Regex.escape(char.toString()) }
      .joinToString(separator)
    val boundary = "(^|[^\\p{L}\\p{N}])$escaped([^\\p{L}\\p{N}]|$)"
    return Regex(boundary).containsMatchIn(normalizedInput)
  }

  private fun normalizeObfuscatedChar(char: Char): Char {
    return when (char) {
      '0' -> 'o'
      '1', '!' -> 'i'
      '3' -> 'e'
      '4', '@' -> 'a'
      '5', '$' -> 's'
      '7' -> 't'
      else -> char
    }
  }

  private fun expandUrlEncoding(input: String): String {
    val decodedOnce = decodeUrl(input)
    val decodedTwice = decodeUrl(decodedOnce)
    return listOf(input, decodedOnce, decodedTwice)
      .distinct()
      .joinToString(" ")
  }

  private fun decodeUrl(input: String): String =
    try {
      URLDecoder.decode(input, Charsets.UTF_8.name())
    } catch (_: Exception) {
      input
    }

  private data class NormalizedText(
    val spaced: String,
    val compact: String
  )
}
