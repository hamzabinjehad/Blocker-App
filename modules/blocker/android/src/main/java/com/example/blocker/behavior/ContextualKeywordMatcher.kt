package com.example.blocker.behavior

data class ContextMatchDecision(
  val result: MatchResult,
  val confidence: Double,
  val reason: String,
  val safetySignals: List<String>,
  val riskSignals: List<String>
)

object ContextualKeywordMatcher {

  private val EDUCATIONAL_CONTEXT = mapOf(
    "sex" to listOf("education", "health", "biology", "anatomy", "chromosome", "harassment", "abuse prevention", "gender", "consent"),
    "nude" to listOf("art", "museum", "sculpture", "history", "painting", "renaissance"),
    "breast" to listOf("cancer", "feeding", "health", "medical", "surgery", "mammogram"),
    "porn" to listOf("anti-porn", "antiporn", "addiction", "recovery", "awareness", "blocker", "filter"),
    "porno" to listOf("anti-porn", "antiporn", "addiction", "recovery", "awareness", "blocker", "filter"),
    "pornography" to listOf("anti-porn", "antiporn", "addiction", "recovery", "awareness", "blocker", "filter"),
    "escort" to listOf("police escort", "security escort", "military escort")
  )

  private val GENERAL_SAFETY_CONTEXT = listOf(
    "medical",
    "doctor",
    "therapy",
    "recovery",
    "support group",
    "research",
    "policy",
    "law",
    "safety",
    "prevention",
    "block",
    "blocked",
    "filter",
    "report",
    "awareness"
  )

  private val ADULT_INTENT_SIGNALS = listOf(
    "watch",
    "video",
    "videos",
    "pics",
    "pictures",
    "image",
    "images",
    "download",
    "stream",
    "free",
    "live",
    "chat",
    "cam",
    "uncensored",
    "onlyfans",
    "xxx"
  )

  fun analyze(screenText: String, keyword: String): MatchResult = explain(screenText, keyword).result

  fun explain(screenText: String, keyword: String): ContextMatchDecision {
    val normalizedText = KeywordMatcher.normalize(screenText)
    val normalizedKeyword = KeywordMatcher.normalize(keyword)
    if (normalizedText.isBlank() || normalizedKeyword.isBlank() || !normalizedText.contains(normalizedKeyword, ignoreCase = true)) {
      return ContextMatchDecision(
        result = MatchResult.NO_MATCH,
        confidence = 0.0,
        reason = "keyword_absent",
        safetySignals = emptyList(),
        riskSignals = emptyList()
      )
    }

    val context = extractContext(normalizedText, normalizedKeyword, windowSize = 60)
    val normalizedContext = KeywordMatcher.normalize(context)
    val keywordSpecificSafetySignals = EDUCATIONAL_CONTEXT[keyword.lowercase()] ?: emptyList()
    val safetySignals = (keywordSpecificSafetySignals + GENERAL_SAFETY_CONTEXT)
      .filter { signal -> normalizedContext.contains(KeywordMatcher.normalize(signal)) }
      .distinct()
    val riskSignals = ADULT_INTENT_SIGNALS
      .filter { signal -> normalizedContext.contains(KeywordMatcher.normalize(signal)) }
      .distinct()

    val safetyScore = safetySignals.sumOf { signal -> if (signal in keywordSpecificSafetySignals) 1.2 else 0.8 }
    val riskScore = 1.0 + riskSignals.sumOf { if (it == "xxx" || it == "onlyfans") 1.0 else 0.55 }
    val hasRecoveryIntent = safetySignals.any { it in setOf("recovery", "support group", "block", "blocked", "filter") }
    val isEducational = safetyScore >= 1.2 && (riskScore < 1.8 || hasRecoveryIntent)

    return if (isEducational) {
      ContextMatchDecision(
        result = MatchResult.EDUCATIONAL_CONTEXT,
        confidence = (0.55 + safetyScore * 0.12).coerceAtMost(0.95),
        reason = "protective_or_educational_context",
        safetySignals = safetySignals,
        riskSignals = riskSignals
      )
    } else {
      ContextMatchDecision(
        result = MatchResult.NSFW_MATCH,
        confidence = (0.55 + riskScore * 0.12).coerceAtMost(0.98),
        reason = if (riskSignals.isEmpty()) "keyword_without_safe_context" else "adult_intent_context",
        safetySignals = safetySignals,
        riskSignals = riskSignals
      )
    }
  }

  private fun extractContext(text: String, keyword: String, windowSize: Int): String {
    val idx = text.indexOf(keyword, ignoreCase = true)
    if (idx == -1) return ""
    val start = maxOf(0, idx - windowSize)
    val end = minOf(text.length, idx + keyword.length + windowSize)
    return text.substring(start, end)
  }
}

enum class MatchResult { NO_MATCH, EDUCATIONAL_CONTEXT, NSFW_MATCH }
