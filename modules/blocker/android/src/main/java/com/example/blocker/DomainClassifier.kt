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
    // Google: only the search entry points, not all *.google.com subdomains.
    // Broad *.google.com matching broke APIs, accounts, mail, etc. by CNAME-redirecting
    // them to forcesafesearch.google.com which doesn't serve those services.
    if (domain == "google.com") return true
    if (domain.endsWith(".google.com")) {
      val sub = domain.removeSuffix(".google.com")
      if (sub in GOOGLE_SEARCH_SUBDOMAINS) return true
    }
    if (domain == "bing.com" || domain.endsWith(".bing.com")) return true
    if (domain == "youtube.com" || domain.endsWith(".youtube.com") ||
      domain == "googlevideo.com" || domain.endsWith(".googlevideo.com")) return true
    if (domain == "duckduckgo.com" || domain.endsWith(".duckduckgo.com")) return true
    if (domain == "yandex.com" || domain.endsWith(".yandex.com") ||
      domain == "yandex.ru" || domain.endsWith(".yandex.ru")) return true
    return GOOGLE_COUNTRY_TLDS.any { tld -> domain == tld || domain.endsWith(".$tld") } ||
      YOUTUBE_COUNTRY_TLDS.any { tld -> domain == tld || domain.endsWith(".$tld") }
  }

  private fun isSafeSearchTargetDomain(domain: String): Boolean {
    return domain == "forcesafesearch.google.com" ||
      domain == "strict.bing.com" ||
      domain == "restrict.youtube.com" ||
      domain == "restrictmoderate.youtube.com" ||
      domain == "safe.duckduckgo.com" ||
      domain == "familysearch.yandex.com" ||
      domain == "familysearch.yandex.ru"
  }

  private fun isUnmanagedSearchDomain(domain: String): Boolean {
    return SEARCH_ENGINE_DOMAINS.any { searchDomain ->
      domain == searchDomain || domain.endsWith(".$searchDomain")
    }
  }

  private fun shouldEnforceSafeSearch(domain: String): Boolean {
    return isSafeSearchDomain(domain)
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
      domain.contains("yandex") && domain.endsWith(".ru") -> "familysearch.yandex.ru"
      domain.contains("yandex") -> "familysearch.yandex.com"
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

    private val GOOGLE_SEARCH_SUBDOMAINS = setOf(
      "www", "images", "news", "video", "web", "scholar", "maps"
    )

    private val GOOGLE_COUNTRY_TLDS = setOf(
      "google.co.uk", "google.fr", "google.de", "google.es", "google.it",
      "google.com.au", "google.ca", "google.co.in", "google.co.jp",
      "google.com.br", "google.com.mx", "google.com.ar", "google.com.co",
      "google.com.sa", "google.ae", "google.com.eg", "google.com.ng",
      "google.co.id", "google.com.tr", "google.pl", "google.ru",
      "google.nl", "google.be", "google.ch", "google.at",
      "google.se", "google.no", "google.dk", "google.fi",
      "google.pt", "google.gr", "google.hu", "google.ro",
      "google.co.za", "google.com.pk", "google.com.bd",
      "google.com.ph", "google.co.th", "google.com.vn",
      "google.com.tw", "google.co.kr", "google.co.nz",
      "google.com.hk", "google.com.sg", "google.com.my",
      "google.iq", "google.dz", "google.tn", "google.ma"
    )

    private val YOUTUBE_COUNTRY_TLDS = setOf(
      "youtube.co.uk", "youtube.fr", "youtube.de", "youtube.es", "youtube.it",
      "youtube.com.au", "youtube.ca", "youtube.co.in", "youtube.co.jp",
      "youtube.com.br", "youtube.com.mx", "youtube.com.sa", "youtube.ae",
      "youtube.co.id", "youtube.com.tr", "youtube.pl", "youtube.nl",
      "youtube.be", "youtube.se", "youtube.no", "youtube.pt",
      "youtube.co.nz", "youtube.com.hk", "youtube.com.sg"
    )

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
      "aol.com",
      "kagi.com",
      "perplexity.ai",
      "phind.com",
      "andi.co",
      "metager.org",
      "metager.de",
      "swisscows.com",
      "gibiru.com",
      "searx.be",
      "searxng.org",
      "whoogle.com",
      "wolframalpha.com"
    )

    private val ADULT_ONLY_TLDS = setOf("adult", "porn", "sex", "xxx")

    private val STRONG_ADULT_DOMAIN_MARKERS = setOf(
      "porn", "porno", "pornography",
      "xxx", "xvideo", "xvideos", "xnxx", "xhamster",
      "redtube", "youporn", "hentai",
      "onlyfans", "fansly", "brazzers", "spankbang",
      "motherless", "rule34", "e621", "nhentai", "hanime", "r34",
      "tnaflix", "tube8", "p0rn", "pr0n", "h3ntai",
      // additional explicit markers
      "pornstar", "pornstars", "cumshot", "blowjob",
      "gangbang", "creampie", "anal", "bdsm", "bondage",
      "shemale", "tranny", "twink", "jerkmate",
      "naughtyamerica", "bangbros", "mofos", "digitalplayground",
      "penthouse", "nudevista", "peekvids", "voyeurhit"
    )

    private val ADULT_PLATFORM_MARKERS = setOf(
      "pornhub", "chaturbate", "stripchat", "livejasmin",
      "manyvids", "camsoda", "cam4", "adultfriendfinder",
      "bongacams", "myfreecams", "flirt4free", "streamate", "imlive",
      // additional cam/live platforms
      "cams", "camster", "camplace", "camdolls", "cambb",
      "jasmin", "jerkmate", "lovense", "sexier", "sexplanet",
      "xempire", "wicked"
    )

    private val CONTEXTUAL_ADULT_DOMAIN_MARKERS = setOf(
      "adult", "sex", "sexy", "nude", "nudity",
      "escort", "erotic", "erotica", "fetish",
      "camgirl", "camgirls", "webcam", "nsfw",
      "hookup", "milf", "onlyfan", "stripper", "camg", "3rotic",
      // additional contextual markers
      "amateur", "homemade", "kink", "swingers", "naughty",
      "uncensored", "explicit", "bdsm", "bondage",
      "18plus", "18only", "adultchat", "hotgirl", "hotgirls",
      "lust", "lusty", "hump", "naked", "nakedness"
    )

    private val ADULT_INTENT_DOMAIN_MARKERS = setOf(
      "video", "videos", "tube", "clips", "pics",
      "photo", "photos", "free", "live", "chat",
      "cam", "cams", "models", "leak", "leaks",
      "hd", "xxx", "stream", "download", "watch",
      "hub", "gallery",
      // additional intent markers
      "show", "shows", "content", "only", "site",
      "network", "pass", "vip", "premium", "uncensored"
    )

    private val ADULT_REGEX = Regex(
      "(p[o0]rn|s[e3]x|x+vid|nud[e3]|h[e3]ntai|camg[ir]+l|str[i1]p|esc[o0]rt" +
        "|f[u4][c]?k|an[a4]l|bl[o0]wj|b[d]sm|j[e3]rkm|p[o0]rnst[a4]r|c[u]msh[o0]t)",
      RegexOption.IGNORE_CASE
    )
  }
}
