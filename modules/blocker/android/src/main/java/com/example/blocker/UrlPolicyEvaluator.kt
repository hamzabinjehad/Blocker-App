package com.example.blocker

import android.content.Context
import com.example.blocker.behavior.KeywordMatcher
import java.net.IDN
import java.net.URLDecoder
import java.util.Locale

data class UrlPolicyDecision(
  val blocked: Boolean,
  val rewrittenPath: String? = null,
  val reason: String? = null,
  val keyword: String? = null,
  val keywordSource: String? = null
)

class UrlPolicyEvaluator(
  private val context: Context,
  private val repository: PolicyRepository
) {
  private val classifier = DomainClassifier(context, repository)
  private val blocklists = BlocklistStore.get(context)

  fun evaluateHost(host: String, action: String): UrlPolicyDecision {
    val normalizedHost = normalizeHost(host)
    if (normalizedHost.isBlank()) {
      return UrlPolicyDecision(blocked = true, reason = "invalid_host")
    }

    val classification = classifier.classify(normalizedHost)
    if (classification.action == DomainClassification.Action.BLOCK) {
      recordDomainBlock(classification, action)
      return UrlPolicyDecision(blocked = true, reason = classification.category)
    }

    return UrlPolicyDecision(blocked = false)
  }

  fun evaluateHttpRequest(host: String, pathAndQuery: String, action: String): UrlPolicyDecision {
    val hostDecision = evaluateHost(host, action)
    if (hostDecision.blocked) return hostDecision

    val normalizedHost = normalizeHost(host)
    if (repository.isAdultFilteringEnabled()) {
      val match = KeywordMatcher.find(
        urlTextForKeywordScan(pathAndQuery),
        repository.customBlockedKeywords(),
        blocklists.activeKeywords
      )
      if (match != null) {
        recordUrlKeywordBlock(normalizedHost, match.keyword, match.source, action)
        return UrlPolicyDecision(
          blocked = true,
          reason = "url_keyword",
          keyword = match.keyword,
          keywordSource = match.source
        )
      }
    }

    val rewritten = safeSearchPath(normalizedHost, pathAndQuery)
    if (rewritten != pathAndQuery) {
      recordSafeSearchRewrite(normalizedHost, action)
      return UrlPolicyDecision(blocked = false, rewrittenPath = rewritten, reason = "safesearch_rewrite")
    }

    return UrlPolicyDecision(blocked = false)
  }

  private fun safeSearchPath(host: String, pathAndQuery: String): String {
    val path = pathAndQuery.ifBlank { "/" }
    return when {
      isGoogleSearchHost(host) && repository.isGoogleSafeSearchEnabled() && isSearchPath(path) ->
        withQueryParam(path, "safe", "active")
      isBingSearchHost(host) && repository.isBingSafeSearchEnabled() && isSearchPath(path) ->
        withQueryParam(path, "adlt", "strict")
      isDuckDuckGoHost(host) && repository.isDuckDuckGoSafeSearchEnabled() && isDuckDuckGoSearchPath(path) ->
        withQueryParam(path, "kp", "1")
      else -> path
    }
  }

  private fun isSearchPath(pathAndQuery: String): Boolean {
    val path = pathAndQuery.substringBefore("?").lowercase(Locale.US)
    return path == "/" ||
      path == "/search" ||
      path == "/webhp" ||
      path == "/images/search" ||
      path == "/videos/search" ||
      path == "/news/search"
  }

  private fun isDuckDuckGoSearchPath(pathAndQuery: String): Boolean {
    val path = pathAndQuery.substringBefore("?").lowercase(Locale.US)
    return path == "/" ||
      path == "/html" ||
      path == "/lite" ||
      path == "/duckduckgo-help-pages/features/safe-search"
  }

  private fun withQueryParam(pathAndQuery: String, key: String, value: String): String {
    val hashIndex = pathAndQuery.indexOf('#')
    val fragment = if (hashIndex >= 0) pathAndQuery.substring(hashIndex) else ""
    val withoutFragment = if (hashIndex >= 0) pathAndQuery.substring(0, hashIndex) else pathAndQuery
    val queryIndex = withoutFragment.indexOf('?')
    val path = if (queryIndex >= 0) withoutFragment.substring(0, queryIndex).ifBlank { "/" } else withoutFragment.ifBlank { "/" }
    val query = if (queryIndex >= 0) withoutFragment.substring(queryIndex + 1) else ""
    val filtered = query
      .split('&')
      .filter { it.isNotBlank() }
      .filterNot { it.substringBefore("=").equals(key, ignoreCase = true) }

    return "$path?${(filtered + "$key=$value").joinToString("&")}$fragment"
  }

  private fun urlTextForKeywordScan(pathAndQuery: String): String {
    val decodedOnce = decodeUrl(pathAndQuery)
    val decodedTwice = decodeUrl(decodedOnce)
    return listOf(pathAndQuery, decodedOnce, decodedTwice)
      .distinct()
      .joinToString(" ")
  }

  private fun decodeUrl(value: String): String =
    try {
      URLDecoder.decode(value, Charsets.UTF_8.name())
    } catch (_: Exception) {
      value
    }

  private fun recordDomainBlock(classification: DomainClassification, action: String) {
    val recorded = repository.recordDomainEvent(classification.domain, classification.category, action)
    if (!recorded) return

    GuardianNotifier.notify(
      context = context,
      eventType = "URL_HOST_BLOCKED",
      severity = if (classification.category == DomainClassifier.CATEGORY_BYPASS) "critical" else "high",
      subject = classification.domain,
      action = action,
      metadata = mapOf("category" to classification.category)
    )
  }

  private fun recordUrlKeywordBlock(host: String, keyword: String, keywordSource: String, action: String) {
    val recorded = repository.recordDomainEvent(host, DomainClassifier.CATEGORY_ADULT, ACTION_URL_KEYWORD_BLOCKED)
    if (!recorded) return

    repository.recordAuditEvent(
      eventType = "URL_KEYWORD_BLOCKED",
      severity = "high",
      category = DomainClassifier.CATEGORY_ADULT,
      subject = host,
      action = ACTION_URL_KEYWORD_BLOCKED,
      metadata = mapOf("keyword" to keyword, "keywordSource" to keywordSource, "surface" to action)
    )
    GuardianNotifier.notify(
      context = context,
      eventType = "URL_KEYWORD_BLOCKED",
      severity = "high",
      subject = host,
      action = ACTION_URL_KEYWORD_BLOCKED,
      metadata = mapOf("keywordSource" to keywordSource, "surface" to "path_query")
    )
  }

  private fun recordSafeSearchRewrite(host: String, action: String) {
    val recorded = repository.recordDomainEvent(host, DomainClassifier.CATEGORY_SEARCH, ACTION_SAFESEARCH_PARAM_INJECTED)
    if (!recorded) return

    repository.recordAuditEvent(
      eventType = "SAFESEARCH_PARAM_INJECTED",
      severity = "medium",
      category = DomainClassifier.CATEGORY_SEARCH,
      subject = host,
      action = ACTION_SAFESEARCH_PARAM_INJECTED,
      metadata = mapOf("surface" to action)
    )
  }

  private fun normalizeHost(host: String): String {
    val rawHost = host.trim()
      .lowercase(Locale.US)
      .removePrefix("http://")
      .removePrefix("https://")
      .substringBefore("/")
      .substringBefore("?")
      .substringBefore("#")
      .trim('.')

    val withoutPort = if (rawHost.startsWith("[")) {
      rawHost.substringAfter("[").substringBefore("]")
    } else {
      rawHost.substringBefore(":")
    }

    return runCatching { IDN.toASCII(withoutPort) }
      .getOrDefault(withoutPort)
      .lowercase(Locale.US)
      .trim('.')
  }

  private fun isGoogleSearchHost(host: String): Boolean =
    host == "google.com" ||
      host == "www.google.com" ||
      host.matches(Regex("^(www\\.)?google\\.[a-z.]{2,}$")) ||
      host == "google.co" ||
      host.endsWith(".google.com")

  private fun isBingSearchHost(host: String): Boolean =
    host == "bing.com" || host == "www.bing.com" || host == "edgeservices.bing.com"

  private fun isDuckDuckGoHost(host: String): Boolean =
    host == "duckduckgo.com" || host == "www.duckduckgo.com" || host == "safe.duckduckgo.com"

  companion object {
    private const val ACTION_URL_KEYWORD_BLOCKED = "url_keyword_blocked"
    private const val ACTION_SAFESEARCH_PARAM_INJECTED = "safesearch_param_injected"
  }
}
