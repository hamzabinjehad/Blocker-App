package com.example.blocker

import android.content.Context
import java.net.IDN

data class DomainClassification(
  val domain: String,
  val category: String,
  val action: Action,
  val rewriteTarget: String? = null
) {
  enum class Action {
    ALLOW,
    BLOCK,
    FORCE_SAFE_SEARCH
  }
}

class DomainClassifier(
  context: Context,
  private val repository: PolicyRepository
) {
  private val blocklists = BlocklistStore.get(context)

  fun classify(rawDomain: String): DomainClassification {
    val domain = normalizeDomain(rawDomain)
    if (domain.isBlank()) {
      return DomainClassification(domain, CATEGORY_UNKNOWN, DomainClassification.Action.ALLOW)
    }

    if (matchesAny(domain, repository.allowlistedDomains()) || matchesAny(domain, blocklists.allowDomains)) {
      return DomainClassification(domain, CATEGORY_ALLOWLIST, DomainClassification.Action.ALLOW)
    }

    if (isSafeSearchTargetDomain(domain)) {
      return DomainClassification(domain, CATEGORY_SEARCH, DomainClassification.Action.ALLOW)
    }

    // SafeSearch Redirection
    val rewriteTarget = matchingRewriteTarget(domain)
    if (isSafeSearchDomain(domain) || rewriteTarget != null) {
      val action = if (shouldEnforceSafeSearch(domain)) {
        DomainClassification.Action.FORCE_SAFE_SEARCH
      } else {
        DomainClassification.Action.ALLOW
      }
      return DomainClassification(domain, CATEGORY_SEARCH, action, rewriteTarget ?: defaultRewriteTarget(domain))
    }

    if (repository.isBlockUnknownSearchEnginesEnabled() && isUnmanagedSearchDomain(domain)) {
      return DomainClassification(domain, CATEGORY_SEARCH, DomainClassification.Action.BLOCK)
    }

    if ((repository.isStrictModeEnabled() || repository.shouldBlockBypassDomains()) && matchesAny(domain, blocklists.bypassDomains)) {
      return DomainClassification(domain, CATEGORY_BYPASS, DomainClassification.Action.BLOCK)
    }

    if (!repository.isAdultFilteringEnabled()) {
      return DomainClassification(domain, CATEGORY_UNKNOWN, DomainClassification.Action.ALLOW)
    }

    if (matchesAny(domain, repository.blockedDomains()) || matchesAny(domain, blocklists.adultDomains)) {
      return DomainClassification(domain, CATEGORY_ADULT, DomainClassification.Action.BLOCK)
    }

    if (looksLikeAdultDomain(domain)) {
      return DomainClassification(domain, CATEGORY_ADULT, DomainClassification.Action.BLOCK)
    }

    return DomainClassification(domain, CATEGORY_UNKNOWN, DomainClassification.Action.ALLOW)
  }

  private fun isSafeSearchDomain(domain: String): Boolean {
    return domain == "google.com" || domain.endsWith(".google.com") ||
      domain == "bing.com" || domain.endsWith(".bing.com") ||
      domain == "youtube.com" || domain.endsWith(".youtube.com") ||
      domain == "googlevideo.com" || domain.endsWith(".googlevideo.com") ||
      domain == "duckduckgo.com" || domain.endsWith(".duckduckgo.com")
  }

  private fun isSafeSearchTargetDomain(domain: String): Boolean {
    return domain == "forcesafesearch.google.com" ||
      domain == "strict.bing.com" ||
      domain == "restrict.youtube.com" ||
      domain == "restrictmoderate.youtube.com" ||
      domain == "safe.duckduckgo.com"
  }

  private fun isUnmanagedSearchDomain(domain: String): Boolean {
    return SEARCH_ENGINE_DOMAINS.any { searchDomain ->
      domain == searchDomain || domain.endsWith(".$searchDomain")
    }
  }

  private fun shouldEnforceSafeSearch(domain: String): Boolean {
    return when {
      domain.contains("google") -> repository.isGoogleSafeSearchEnabled()
      domain.contains("bing") -> repository.isBingSafeSearchEnabled()
      domain.contains("youtube") || domain.contains("googlevideo") -> repository.isYoutubeRestrictedEnabled()
      domain.contains("duckduckgo") -> repository.isDuckDuckGoSafeSearchEnabled()
      else -> false
    }
  }

  private fun matchingRewriteTarget(domain: String): String? {
    return blocklists.dnsRewriteRules.firstOrNull { rule ->
      domainMatchesPattern(domain, rule.domainPattern)
    }?.target
  }

  private fun defaultRewriteTarget(domain: String): String? {
    return when {
      domain.contains("google") -> "forcesafesearch.google.com"
      domain.contains("bing") -> "strict.bing.com"
      domain.contains("youtube") || domain.contains("googlevideo") -> "restrict.youtube.com"
      domain.contains("duckduckgo") -> "safe.duckduckgo.com"
      else -> null
    }
  }

  private fun domainMatchesPattern(domain: String, pattern: String): Boolean {
    val normalizedPattern = pattern.trim().lowercase().trim('.')
    if (normalizedPattern.isBlank()) return false
    if (!normalizedPattern.contains("*")) {
      return domain == normalizedPattern || domain.endsWith(".$normalizedPattern")
    }
    val regex = Regex("^" + Regex.escape(normalizedPattern).replace("\\*", "[^.]+") + "$")
    return regex.matches(domain)
  }

  private fun matchesAny(domain: String, rules: Set<String>): Boolean {
    if (rules.isEmpty()) return false
    var candidate = domain

    while (candidate.isNotBlank()) {
      if (rules.contains(candidate)) return true
      val nextDot = candidate.indexOf('.')
      if (nextDot == -1) break
      candidate = candidate.substring(nextDot + 1)
    }

    return false
  }

  private fun looksLikeAdultDomain(domain: String): Boolean {
    val labels = domain.split('.').filter { it.isNotBlank() }
    if (labels.size < 2) return false

    val tld = labels.last()
    if (tld in ADULT_ONLY_TLDS) return true

    val searchableLabels = labels.dropLast(1)
    val normalizedLabels = searchableLabels.map { normalizeAdultSignalLabel(it) }
    val compactDomain = normalizedLabels.joinToString("").replace(Regex("[^a-z0-9]"), "")
    if (compactDomain.isBlank()) return false

    if (ADULT_PLATFORM_MARKERS.any { marker -> compactDomain.contains(marker) }) return true
    if (STRONG_ADULT_DOMAIN_MARKERS.any { marker -> compactDomain.contains(marker) }) return true
    if (ADULT_REGEX.containsMatchIn(compactDomain)) return true

    val tokens = normalizedLabels
      .flatMap { label -> label.split(Regex("[^a-z0-9]+")) }
      .filter { it.isNotBlank() }
      .toSet()
    val hasContextualAdultMarker = CONTEXTUAL_ADULT_DOMAIN_MARKERS.any { marker ->
      marker in tokens || compactDomain.contains(marker)
    }
    val hasIntentMarker = ADULT_INTENT_DOMAIN_MARKERS.any { marker ->
      marker in tokens || compactDomain.contains(marker)
    }

    return hasContextualAdultMarker && hasIntentMarker
  }

  private fun normalizeAdultSignalLabel(label: String): String {
    return label
      .lowercase()
      .map { char ->
        when (char) {
          '0' -> 'o'
          '1', '!' -> 'i'
          '3' -> 'e'
          '4', '@' -> 'a'
          '5', '$' -> 's'
          '7' -> 't'
          '8' -> 'b'
          else -> char
        }
      }
      .joinToString("")
  }

  private fun normalizeDomain(domain: String): String {
    val host = domain.trim()
      .lowercase()
      .removePrefix("http://")
      .removePrefix("https://")
      .substringBefore("/")
      .substringBefore("?")
      .substringBefore("#")
      .trim('.')

    val withoutPort = if (host.startsWith("[")) {
      host.substringAfter("[").substringBefore("]")
    } else {
      host.substringBefore(":")
    }

    return runCatching { IDN.toASCII(withoutPort) }
      .getOrDefault(withoutPort)
      .lowercase()
      .trim('.')
  }

  companion object {
    const val CATEGORY_ADULT = "adult"
    const val CATEGORY_ALLOWLIST = "allowlist"
    const val CATEGORY_BYPASS = "bypass"
    const val CATEGORY_SEARCH = "search"
    const val CATEGORY_UNKNOWN = "unknown"

    private val SEARCH_ENGINE_DOMAINS = setOf(
      "search.yahoo.com",
      "yahoo.com",
      "yandex.com",
      "yandex.ru",
      "baidu.com",
      "sogou.com",
      "naver.com",
      "seznam.cz",
      "qwant.com",
      "startpage.com",
      "search.brave.com",
      "ecosia.org",
      "mojeek.com",
      "you.com",
      "ask.com",
      "aol.com"
    )

    private val ADULT_ONLY_TLDS = setOf("adult", "porn", "sex", "xxx")

    private val STRONG_ADULT_DOMAIN_MARKERS = setOf(
      "porn",
      "porno",
      "pornography",
      "xxx",
      "xvideo",
      "xvideos",
      "xnxx",
      "xhamster",
      "redtube",
      "youporn",
      "hentai",
      "onlyfans",
      "fansly",
      "brazzers",
      "spankbang",
      "motherless",
      "rule34",
      "e621",
      "nhentai",
      "hanime",
      "r34",
      "tnaflix",
      "tube8",
      "p0rn",
      "pr0n",
      "h3ntai"
    )

    private val ADULT_PLATFORM_MARKERS = setOf(
      "pornhub",
      "chaturbate",
      "stripchat",
      "livejasmin",
      "manyvids",
      "camsoda",
      "cam4",
      "adultfriendfinder",
      "bongacams",
      "myfreecams",
      "flirt4free",
      "streamate",
      "imlive"
    )

    private val CONTEXTUAL_ADULT_DOMAIN_MARKERS = setOf(
      "adult",
      "sex",
      "sexy",
      "nude",
      "nudity",
      "escort",
      "erotic",
      "erotica",
      "fetish",
      "camgirl",
      "camgirls",
      "webcam",
      "nsfw",
      "hookup",
      "milf",
      "onlyfan",
      "stripper",
      "camg",
      "3rotic"
    )

    private val ADULT_INTENT_DOMAIN_MARKERS = setOf(
      "video",
      "videos",
      "tube",
      "clips",
      "pics",
      "photo",
      "photos",
      "free",
      "live",
      "chat",
      "cam",
      "cams",
      "models",
      "leak",
      "leaks",
      "hd",
      "xxx",
      "stream",
      "download",
      "watch",
      "hub",
      "gallery"
    )

    private val ADULT_REGEX = Regex(
      "(p[o0]rn|s[e3]x|x+vid|nud[e3]|h[e3]ntai|camg[ir]+l|str[i1]p|esc[o0]rt)",
      RegexOption.IGNORE_CASE
    )
  }
}
