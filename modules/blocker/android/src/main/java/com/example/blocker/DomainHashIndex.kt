package com.example.blocker

import android.content.Context
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.BufferedReader
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Membership test over a domain list, matching a domain and any of its parent domains
 * (e.g. "a.b.pornhub.com" matches an entry "pornhub.com"). Same semantics as walking
 * suffixes against a Set<String>.
 */
interface DomainMatcher {
  fun matches(domain: String): Boolean
  val size: Int
}

object EmptyDomainMatcher : DomainMatcher {
  override fun matches(domain: String): Boolean = false
  override val size: Int = 0
}

/**
 * Off-heap-friendly replacement for a huge Set<String> of blocked domains. Stores a sorted
 * array of 64-bit hashes (~8 MB for ~1M domains, versus ~100 MB for the string set) and looks
 * up a domain by hashing each of its parent suffixes and binary-searching. The sorted array is
 * cached to a small binary file so it is only rebuilt when the source list changes.
 */
class DomainHashIndex(private val sorted: LongArray) : DomainMatcher {
  override val size: Int get() = sorted.size

  override fun matches(domain: String): Boolean {
    if (sorted.isEmpty()) return false
    var candidate = domain
    while (candidate.isNotBlank()) {
      if (contains(hash64(candidate))) return true
      val dot = candidate.indexOf('.')
      if (dot == -1) break
      candidate = candidate.substring(dot + 1)
    }
    return false
  }

  private fun contains(key: Long): Boolean {
    var lo = 0
    var hi = sorted.size - 1
    while (lo <= hi) {
      val mid = (lo + hi) ushr 1
      val value = sorted[mid]
      when {
        value < key -> lo = mid + 1
        value > key -> hi = mid - 1
        else -> return true
      }
    }
    return false
  }

  private fun writeTo(file: File, tag: Long) {
    DataOutputStream(BufferedOutputStream(file.outputStream())).use { out ->
      out.writeInt(MAGIC)
      out.writeInt(VERSION)
      out.writeLong(tag)
      out.writeInt(sorted.size)
      val bytes = ByteArray(sorted.size * 8)
      val longs = ByteBuffer.wrap(bytes).order(ByteOrder.BIG_ENDIAN).asLongBuffer()
      longs.put(sorted)
      out.write(bytes)
    }
  }

  companion object {
    private const val MAGIC = 0x424C4B31 // "BLK1"
    private const val VERSION = 1
    private const val MAX_INDEX_ENTRIES = 20_000_000

    // FNV-1a over UTF-16 code units. Only needs to be self-consistent between build and lookup.
    fun hash64(input: String): Long {
      var hash = -0x340d631b7bdddcdbL // 14695981039346656037 (FNV offset basis)
      val prime = 0x100000001b3L
      for (i in input.indices) {
        hash = hash xor input[i].code.toLong()
        hash *= prime
      }
      return hash
    }

    /**
     * Loads a cached index if it matches [tag], otherwise builds one from [openReader] (called
     * twice: once to count, once to fill) and caches it. Never throws; returns an empty matcher
     * on any failure.
     */
    fun loadOrBuild(idxFile: File, tag: Long, openReader: () -> BufferedReader?): DomainMatcher {
      readFrom(idxFile, tag)?.let { return it }
      val built = runCatching { build(openReader) }.getOrNull() ?: return EmptyDomainMatcher
      runCatching {
        idxFile.parentFile?.let { if (!it.exists()) it.mkdirs() }
        built.writeTo(idxFile, tag)
      }
      return built
    }

    private fun build(openReader: () -> BufferedReader?): DomainHashIndex {
      var count = 0
      openReader()?.use { reader ->
        reader.forEachLine { if (normalizeLine(it) != null) count++ }
      } ?: return DomainHashIndex(LongArray(0))
      if (count == 0) return DomainHashIndex(LongArray(0))

      val hashes = LongArray(count)
      var index = 0
      openReader()?.use { reader ->
        reader.forEachLine {
          val domain = normalizeLine(it)
          if (domain != null && index < count) hashes[index++] = hash64(domain)
        }
      }
      val finalHashes = if (index == count) hashes else hashes.copyOf(index)
      finalHashes.sort()
      return DomainHashIndex(finalHashes)
    }

    // Mirrors BlocklistStore.readLineSet line handling so build and runtime agree.
    private fun normalizeLine(raw: String): String? {
      val line = raw.trim().lowercase().trim('.')
      if (line.isBlank() || line.startsWith("#")) return null
      return line
    }

    private fun readFrom(file: File, expectedTag: Long): DomainHashIndex? {
      if (!file.exists()) return null
      return runCatching {
        DataInputStream(BufferedInputStream(file.inputStream())).use { input ->
          if (input.readInt() != MAGIC) return null
          if (input.readInt() != VERSION) return null
          if (input.readLong() != expectedTag) return null
          val count = input.readInt()
          if (count < 0 || count > MAX_INDEX_ENTRIES) return null
          val bytes = ByteArray(count * 8)
          input.readFully(bytes)
          val hashes = LongArray(count)
          ByteBuffer.wrap(bytes).order(ByteOrder.BIG_ENDIAN).asLongBuffer().get(hashes)
          DomainHashIndex(hashes)
        }
      }.getOrNull()
    }

    /** Opens a blocklist line source, preferring the on-disk file and falling back to bundled assets. */
    fun sourceTagAndReader(context: Context, dir: File, assetName: String): Pair<Long, () -> BufferedReader?> {
      val localFile = File(dir, assetName)
      return if (localFile.exists()) {
        val tag = localFile.length() xor localFile.lastModified() xor VERSION.toLong()
        tag to { runCatching { localFile.bufferedReader() }.getOrNull() }
      } else {
        // Bundled asset is immutable within an APK build; key the cache on the manifest date.
        val tag = assetVersionTag(context)
        tag to { runCatching { context.assets.open(assetName).bufferedReader() }.getOrNull() }
      }
    }

    private fun assetVersionTag(context: Context): Long {
      return runCatching {
        context.assets.open("blocklist_manifest.json").bufferedReader().use { it.readText() }.hashCode().toLong()
      }.getOrDefault(0L) xor VERSION.toLong()
    }
  }
}
