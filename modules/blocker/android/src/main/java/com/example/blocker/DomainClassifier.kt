package com.example.blocker

import android.content.Context
import java.net.IDN

data class DomainClassification(
  val domain: String,
  val category: String,
  val action: Action,
  val rewriteTarget: String? = null,
  // True when the block came from the name heuristic rather than a blocklist entry —
  // logged with a distinct action so heuristic false-positives are measurable.
  val heuristic: Boolean = false
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

    if (matchesAny(domain, repository.blockedDomains()) || blocklists.adultMatcher.matches(domain)) {
      return DomainClassification(domain, CATEGORY_ADULT, DomainClassification.Action.BLOCK)
    }

    if (looksLikeAdultDomain(domain)) {
      return DomainClassification(domain, CATEGORY_ADULT, DomainClassification.Action.BLOCK, heuristic = true)
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
      YOUTUBE_COUNTRY_TLDS.any { tld -> domain == tld || domain.endsWith(".$tld") } ||
      isCountrySearchDomain(domain, "google") ||
      isCountrySearchDomain(domain, "youtube")
  }

  // Google/YouTube country domains (google.fr, google.com.sa, youtube.co.uk, …) serve only
  // search/video, so forcing safe search on every subdomain is safe. Matching the registrable
  // shape {label}.{cc} / {label}.{co|com}.{cc} covers every country without maintaining a list.
  // google.com itself stays restricted to search subdomains (handled above) because its other
  // subdomains carry APIs, mail, and accounts that a rewrite would break.
  private fun isCountrySearchDomain(domain: String, label: String): Boolean {
    val labels = domain.split('.')
    val index = labels.lastIndexOf(label)
    if (index == -1) return false
    val suffix = labels.subList(index + 1, labels.size)
    return when (suffix.size) {
      1 -> suffix[0].length == 2
      2 -> (suffix[0] == "co" || suffix[0] == "com") && suffix[1].length == 2
      else -> false
    }
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

  // Precision-first adult heuristic. It must never fire on benign domains that merely
  // *contain* a short marker as a substring (e.g. "essex" → sex, "analog" → anal,
  // "twinkl" → twink, "camscanner" → cams, "stripe" → strip). The comprehensive blocklist
  // and family upstream resolvers are the primary defence; this only catches unlisted
  // domains whose name is unambiguously adult.
  private fun looksLikeAdultDomain(domain: String): Boolean {
    val labels = domain.split('.').filter { it.isNotBlank() }
    if (labels.size < 2) return false

    val tld = labels.last()
    if (tld in ADULT_ONLY_TLDS) return true

    val hostLabels = labels.dropLast(1).map { normalizeAdultSignalLabel(it) }
    val compactLabels = hostLabels
      .map { it.replace(Regex("[^a-z0-9]"), "") }
      .filter { it.isNotBlank() }
    if (compactLabels.isEmpty()) return false

    // 1) Long / brand markers are unambiguous — safe to match as a substring within a label.
    if (compactLabels.any { label -> SAFE_SUBSTRING_ADULT_MARKERS.any { label.contains(it) } }) {
      return true
    }

    // 2) Whole-label word segmentation: block only if a label decomposes *entirely* into
    //    adult + neutral connector words and uses at least one core adult word. This blocks
    //    "sexcams" / "freeporn" while leaving "essex" / "analytics" / "twinkl" untouched.
    if (compactLabels.any { isAdultCompoundLabel(it) }) return true

    // 3) Two-signal fallback for multi-token names: a contextual marker AND an intent marker,
    //    both matched as whole tokens (never substrings).
    val tokens = hostLabels
      .flatMap { label -> label.split(Regex("[^a-z0-9]+")) }
      .filter { it.isNotBlank() }
      .toHashSet()
    val hasContextual = tokens.any { it in CONTEXTUAL_ADULT_DOMAIN_MARKERS }
    val hasIntent = tokens.any { it in ADULT_INTENT_DOMAIN_MARKERS }
    return hasContextual && hasIntent
  }

  // Full-coverage segmentation over an adult/neutral vocabulary. Returns true only when the
  // entire label is consumed and at least one CORE adult word was used. The full-coverage
  // requirement is what makes short markers safe: "adult" is core, yet "adulteducation" is
  // allowed because "education" is not in the vocabulary so the label cannot be fully covered.
  private fun isAdultCompoundLabel(label: String): Boolean {
    val n = label.length
    if (n < 3) return false
    val reachNoCore = BooleanArray(n + 1)
    val reachCore = BooleanArray(n + 1)
    reachNoCore[0] = true
    for (i in 0 until n) {
      if (!reachNoCore[i] && !reachCore[i]) continue
      val maxLen = minOf(MAX_SEGMENT_LEN, n - i)
      for (len in 1..maxLen) {
        val word = label.substring(i, i + len)
        val isCore = word in CORE_ADULT_WORDS
        val isNeutral = word in NEUTRAL_CONNECTOR_WORDS
        if (!isCore && !isNeutral) continue
        val j = i + len
        if (reachCore[i] || isCore) reachCore[j] = true
        if (reachNoCore[i] && !isCore) reachNoCore[j] = true
      }
    }
    return reachCore[n]
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
      "andi.co",
      "metager.org",
      "metager.de",
      "swisscows.com",
      "gibiru.com",
      "searx.be",
      "searxng.org",
      "whoogle.com"
    )

    private val ADULT_ONLY_TLDS = setOf("adult", "porn", "sex", "xxx")

    private const val MAX_SEGMENT_LEN = 14

    // Long / brand markers that are unambiguous even as a substring inside a label.
    // Deliberately excludes short ambiguous roots (sex, anal, cam, cams, twink, strip,
    // jasmin, wicked, bondage, milf, nude) — those are handled by bounded segmentation.
    private val SAFE_SUBSTRING_ADULT_MARKERS = setOf(
      "porn", "porno", "pornography", "pornstar", "pornhub",
      "xvideo", "xvideos", "xnxx", "xhamster", "redtube", "youporn",
      "hentai", "nhentai", "hanime", "rule34", "e621",
      "onlyfans", "fansly", "brazzers", "spankbang", "motherless",
      "tnaflix", "tube8", "cumshot", "blowjob", "gangbang", "creampie",
      "shemale", "jerkmate", "naughtyamerica", "bangbros", "mofos",
      "digitalplayground", "nudevista", "peekvids", "voyeurhit",
      "chaturbate", "stripchat", "livejasmin", "manyvids", "camsoda",
      "adultfriendfinder", "bongacams", "myfreecams", "flirt4free",
      "streamate", "camgirl", "camwhore", "fuckbook"
    )

    // Core adult words for segmentation. A label is only flagged when it decomposes
    // ENTIRELY into these plus neutral connectors, so benign suffixes (education, hood,
    // ytics, og) keep the label from ever matching.
    private val CORE_ADULT_WORDS = setOf(
      "porn", "porno", "sex", "sexy", "xxx", "xnxx", "anal", "milf", "milfs",
      "nude", "nudes", "nudity", "naked", "escort", "escorts", "erotic", "erotica",
      "fetish", "hentai", "boobs", "tits", "titty", "pussy", "cock", "dick",
      "cum", "orgasm", "bdsm", "hardcore", "blowjob", "handjob", "footjob",
      "threesome", "creampie", "gangbang", "shemale", "tranny", "twink",
      "nsfw", "incest", "hookup", "cam", "cams", "camgirl", "camgirls",
      "camsex", "sexcam", "camwhore", "stripper", "striptease", "adult",
      "camsoda", "jerkoff", "fap", "xhamster", "pornstar", "swingers",
      "amateur", "voyeur"
    )

    // Neutral glue words: allowed in a decomposition but never sufficient on their own.
    private val NEUTRAL_CONNECTOR_WORDS = setOf(
      "free", "my", "the", "best", "top", "hot", "live", "hd", "x", "xx",
      "vid", "vids", "video", "videos", "tube", "clip", "clips", "pic", "pics",
      "hub", "chat", "real", "world", "zone", "online", "tv", "now", "daily",
      "mega", "super", "247", "24", "247hd", "watch", "stream", "download"
    )

    private val CONTEXTUAL_ADULT_DOMAIN_MARKERS = setOf(
      "adult", "sex", "sexy", "nude", "nudity", "nudes",
      "escort", "escorts", "erotic", "erotica", "fetish",
      "camgirl", "camgirls", "nsfw", "hookup", "milf", "onlyfan",
      "stripper", "amateur", "kink", "swingers", "naughty",
      "uncensored", "explicit", "bdsm", "18plus", "18only",
      "hotgirl", "hotgirls", "lust", "naked"
    )

    private val ADULT_INTENT_DOMAIN_MARKERS = setOf(
      "video", "videos", "tube", "clips", "pics",
      "photo", "photos", "cams", "models", "leak", "leaks",
      "stream", "gallery", "content", "premium", "uncensored"
    )
  }
}
