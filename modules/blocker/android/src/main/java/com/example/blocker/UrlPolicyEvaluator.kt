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

    // Connecting straight to a public IP literal skips DNS, so the domain filter never sees it.
    // The DNS-only tunnel can't close that path (it would need full-tunnel packet forwarding),
    // but it can at least make it *visible*: record the access so the review flow and the
    // full-tunnel decision rest on data, not a guess. Private/loopback IPs (router pages, local
    // dev) are ignored — they are never the content bypass this is watching for.
    if (isPublicIpLiteral(normalizedHost)) {
      recordDirectIpAccess(normalizedHost, action)
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

  private fun recordDirectIpAccess(ip: String, action: String) {
    val recorded = repository.recordDomainEvent(ip, CATEGORY_DIRECT_IP, ACTION_DIRECT_IP_ACCESS)
    if (!recorded) return

    repository.recordAuditEvent(
      eventType = "DIRECT_IP_ACCESS",
      severity = "medium",
      category = CATEGORY_DIRECT_IP,
      subject = ip,
      action = ACTION_DIRECT_IP_ACCESS,
      metadata = mapOf("surface" to action)
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

  // True for a routable IPv4/IPv6 literal — i.e. one a person could type to reach a public
  // server directly. Hostnames and private/loopback/link-local addresses return false.
  private fun isPublicIpLiteral(host: String): Boolean {
    val ipv4 = parseIpv4(host)
    if (ipv4 != null) return isPublicIpv4(ipv4)
    if (host.contains(':')) return isPublicIpv6(host)
    return false
  }

  private fun parseIpv4(host: String): IntArray? {
    val parts = host.split('.')
    if (parts.size != 4) return null
    val octets = IntArray(4)
    for (i in parts.indices) {
      val value = parts[i].toIntOrNull() ?: return null
      if (value !in 0..255 || (parts[i].length > 1 && parts[i][0] == '0')) return null
      octets[i] = value
    }
    return octets
  }

  private fun isPublicIpv4(octets: IntArray): Boolean {
    val a = octets[0]; val b = octets[1]
    return when {
      a == 10 -> false                       // 10.0.0.0/8 private
      a == 127 -> false                      // loopback
      a == 0 -> false                        // "this" network
      a == 172 && b in 16..31 -> false       // 172.16.0.0/12 private
      a == 192 && b == 168 -> false          // 192.168.0.0/16 private
      a == 169 && b == 254 -> false          // link-local
      a == 100 && b in 64..127 -> false      // CGNAT 100.64.0.0/10
      a >= 224 -> false                      // multicast + reserved
      else -> true
    }
  }

  private fun isPublicIpv6(host: String): Boolean {
    val addr = host.trim().removePrefix("[").removeSuffix("]").lowercase()
    if (addr.count { it == ':' } < 2) return false // not an IPv6 literal
    return when {
      addr == "::1" || addr == "::" -> false       // loopback / unspecified
      addr.startsWith("fe80") -> false             // link-local
      addr.startsWith("fc") || addr.startsWith("fd") -> false // unique local
      else -> true
    }
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
    private const val ACTION_DIRECT_IP_ACCESS = "direct_ip_access"
    private const val CATEGORY_DIRECT_IP = "direct_ip"
  }
}
