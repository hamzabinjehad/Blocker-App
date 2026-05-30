package com.example.blocker

import android.content.Context
import android.preference.PreferenceManager
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.security.MessageDigest

data class BlocklistSnapshot(
  val adultDomains: Set<String>,
  val bypassDomains: Set<String>,
  val allowDomains: Set<String>,
  val dnsRewriteRules: List<DnsRewriteRule>,
  val activeKeywords: Set<String>,
  val activeKeywordRules: List<KeywordPolicyRule>,
  val generatedAt: String,
  val adultDomainCount: Int,
  val bypassDomainCount: Int,
  val allowDomainCount: Int,
  val activeKeywordCount: Int
)

data class DnsRewriteRule(
  val id: String,
  val domainPattern: String,
  val target: String,
  val category: String,
  val enabled: Boolean
)

data class KeywordPolicyRule(
  val id: String,
  val normalized: String,
  val category: String,
  val severity: String,
  val source: String
)

sealed class FetchResult {
  object NotModified : FetchResult()
  data class Updated(val body: String) : FetchResult()
  data class Error(val message: String) : FetchResult()
}

object BlocklistStore {
  @Volatile private var snapshot: BlocklistSnapshot? = null

  private const val PREFS_KEY_ETAG = "blocklist_etag_"
  private const val PREFS_KEY_HASH = "blocklist_hash_"
  private const val BLOCKLISTS_DIR = "blocklists"
  private const val FETCH_TIMEOUT_MS = 10_000
  private val ADULT_DOMAIN_SOURCES = listOf(
    "https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/nsfw.txt",
    "https://raw.githubusercontent.com/blocklistproject/Lists/master/porn.txt",
    "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/porn/hosts"
  )

  fun get(context: Context): BlocklistSnapshot {
    snapshot?.let { return it }
    return synchronized(this) {
      snapshot ?: load(context.applicationContext).also { snapshot = it }
    }
  }

  fun invalidate() {
    snapshot = null
  }

  fun fetchWithDelta(context: Context, sourceUrl: String, sourceId: String): FetchResult {
    val prefs = PreferenceManager.getDefaultSharedPreferences(context)
    val cachedEtag = prefs.getString(PREFS_KEY_ETAG + sourceId, null)
    val cachedHash = prefs.getString(PREFS_KEY_HASH + sourceId, null)

    return try {
      val connection = (URL(sourceUrl).openConnection() as HttpURLConnection).apply {
        requestMethod = "GET"
        connectTimeout = FETCH_TIMEOUT_MS
        readTimeout = FETCH_TIMEOUT_MS
        cachedEtag?.let { setRequestProperty("If-None-Match", it) }
      }
      try {
        when (connection.responseCode) {
          304 -> FetchResult.NotModified
          200 -> {
            val body = connection.inputStream.bufferedReader().use { it.readText() }
            val newHash = body.md5()
            if (newHash == cachedHash) return FetchResult.NotModified

            val dir = File(context.filesDir, BLOCKLISTS_DIR)
            if (!dir.exists()) dir.mkdirs()
            File(dir, "$sourceId.txt").writeText(body)

            prefs.edit()
              .putString(PREFS_KEY_ETAG + sourceId, connection.getHeaderField("ETag"))
              .putString(PREFS_KEY_HASH + sourceId, newHash)
              .apply()

            FetchResult.Updated(body)
          }
          else -> FetchResult.Error("HTTP ${connection.responseCode}")
        }
      } finally {
        connection.disconnect()
      }
    } catch (e: Exception) {
      FetchResult.Error(e.message ?: "Unknown error")
    }
  }

  fun updateAdultDomains(context: Context): Map<String, Any?> {
    val current = get(context).adultDomains
    val fetched = mutableSetOf<String>()
    val errors = mutableListOf<String>()
    var updatedSources = 0

    ADULT_DOMAIN_SOURCES.forEachIndexed { index, sourceUrl ->
      when (val result = fetchWithDelta(context, sourceUrl, "adult_source_$index")) {
        is FetchResult.Updated -> {
          updatedSources += 1
          fetched += parseDomainList(result.body)
        }
        FetchResult.NotModified -> {
          fetched += readCachedSource(context, "adult_source_$index").flatMapTo(mutableSetOf()) { line ->
            parseDomainList(line)
          }
        }
        is FetchResult.Error -> errors.add(result.message)
      }
    }

    val next = (current + fetched).filter { it.isNotBlank() }.toSortedSet()
    if (next.size < 1_000) {
      return mapOf(
        "updated" to false,
        "accepted" to 0,
        "total" to current.size,
        "reason" to "too_few_domains",
        "errors" to errors.joinToString(";").take(300)
      )
    }

    val dir = File(context.filesDir, BLOCKLISTS_DIR)
    if (!dir.exists()) dir.mkdirs()
    File(dir, "adult_domains.txt").writeText(next.joinToString(separator = "\n"))
    invalidate()

    return mapOf(
      "updated" to (updatedSources > 0),
      "accepted" to fetched.size,
      "total" to next.size,
      "updatedAt" to SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(Date()),
      "errors" to errors.joinToString(";").take(300)
    )
  }

  private fun load(context: Context): BlocklistSnapshot {
    val adultDomains = readLineSet(context, "adult_domains.txt")
    val bypassDomains = readLineSet(context, "bypass_domains.txt")
    val allowDomains = readLineSet(context, "allow_domains.txt")
    val dnsRewriteRules = readDnsRewriteRules(context)
    val keywordRules = readActiveKeywordRules(context)
    val keywords = keywordRules.map { it.normalized }.filter { it.isNotBlank() }.toSet()
    val generatedAt = readGeneratedAt(context)

    return BlocklistSnapshot(
      adultDomains = adultDomains,
      bypassDomains = bypassDomains,
      allowDomains = allowDomains,
      dnsRewriteRules = dnsRewriteRules,
      activeKeywords = keywords,
      activeKeywordRules = keywordRules,
      generatedAt = generatedAt,
      adultDomainCount = adultDomains.size,
      bypassDomainCount = bypassDomains.size,
      allowDomainCount = allowDomains.size,
      activeKeywordCount = keywords.size
    )
  }

  private fun readLineSet(context: Context, assetName: String): Set<String> {
    val localFile = File(File(context.filesDir, BLOCKLISTS_DIR), assetName)
    if (localFile.exists()) {
      return try {
        localFile.bufferedReader().useLines { lines ->
          lines
            .map { it.trim().lowercase().trim('.') }
            .filter { it.isNotBlank() && !it.startsWith("#") }
            .toSet()
        }
      } catch (_: Exception) {
        readLineSetFromAssets(context, assetName)
      }
    }
    return readLineSetFromAssets(context, assetName)
  }

  private fun readLineSetFromAssets(context: Context, assetName: String): Set<String> {
    return try {
      context.assets.open(assetName).bufferedReader().useLines { lines ->
        lines
          .map { it.trim().lowercase().trim('.') }
          .filter { it.isNotBlank() && !it.startsWith("#") }
          .toSet()
      }
    } catch (_: Exception) {
      emptySet()
    }
  }

  private fun readCachedSource(context: Context, sourceId: String): List<String> {
    val file = File(File(context.filesDir, BLOCKLISTS_DIR), "$sourceId.txt")
    if (!file.exists()) return emptyList()
    return runCatching { file.readLines() }.getOrDefault(emptyList())
  }

  private fun parseDomainList(body: String): Set<String> =
    body.lineSequence()
      .mapNotNull { parseDomainLine(it) }
      .toSet()

  private fun parseDomainLine(rawLine: String): String? {
    var line = rawLine.substringBefore("#").substringBefore("!").trim().lowercase()
    if (line.isBlank() || line.startsWith("[") || line.startsWith("title:")) return null
    if (line.startsWith("||")) line = line.removePrefix("||").substringBefore("^")
    if (line.startsWith("0.0.0.0 ") || line.startsWith("127.0.0.1 ")) line = line.split(Regex("\\s+")).getOrNull(1).orEmpty()
    line = line
      .removePrefix("address=/")
      .substringBefore("/")
      .removePrefix(".")
      .trim('.')
    if (!line.contains('.') || line.any { it.isWhitespace() || it == '/' || it == '*' }) return null
    return line.takeIf { domain ->
      domain.length <= 253 && domain.split('.').all { label ->
        label.isNotBlank() && label.length <= 63 && label.first() != '-' && label.last() != '-'
      }
    }
  }

  private fun readActiveKeywordRules(context: Context): List<KeywordPolicyRule> {
    return try {
      val json = context.assets.open("blocked_keywords.json").bufferedReader().use { it.readText() }
      val activeRules = JSONObject(json).optJSONArray("activeRules") ?: return emptyList()
      val keywords = mutableListOf<KeywordPolicyRule>()

      for (index in 0 until activeRules.length()) {
        val rule = activeRules.optJSONObject(index) ?: continue
        if (!rule.optBoolean("enabled", false)) continue
        if (rule.optString("classification") == "ALLOW_CONTEXT") continue
        val normalized = rule.optString("normalized", rule.optString("term", "")).trim()
        if (normalized.isNotBlank()) {
          keywords.add(
            KeywordPolicyRule(
              id = rule.optString("id", normalized),
              normalized = normalized,
              category = rule.optString("category", "UNKNOWN"),
              severity = rule.optString("severity", "MEDIUM"),
              source = rule.optString("source", "bundled")
            )
          )
        }
      }

      keywords
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun readDnsRewriteRules(context: Context): List<DnsRewriteRule> {
    return try {
      val json = context.assets.open("dns_rewrite_rules.json").bufferedReader().use { it.readText() }
      val rules = org.json.JSONArray(json)
      val parsed = mutableListOf<DnsRewriteRule>()
      for (index in 0 until rules.length()) {
        val rule = rules.optJSONObject(index) ?: continue
        parsed.add(
          DnsRewriteRule(
            id = rule.optString("id"),
            domainPattern = rule.optString("domainPattern").trim().lowercase(),
            target = rule.optString("target").trim().lowercase(),
            category = rule.optString("category", "safesearch"),
            enabled = rule.optBoolean("enabled", true)
          )
        )
      }
      parsed.filter { it.enabled && it.domainPattern.isNotBlank() && it.target.isNotBlank() }
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun readGeneratedAt(context: Context): String {
    return try {
      val json = context.assets.open("blocklist_manifest.json").bufferedReader().use { it.readText() }
      JSONObject(json).optString("generatedAt", "Bundled processed blocklists")
    } catch (_: Exception) {
      "Bundled processed blocklists"
    }
  }

  private fun String.md5(): String {
    val md = MessageDigest.getInstance("MD5")
    return md.digest(toByteArray()).joinToString("") { "%02x".format(it) }
  }
}
