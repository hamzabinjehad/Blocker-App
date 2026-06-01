package com.example.blocker

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Size
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

data class GalleryScanCandidate(
  val uri: Uri,
  val mediaType: String,
  val addedAtMs: Long
)

object GalleryContentScanner {
  private const val DEFAULT_SCAN_LIMIT = 24
  private const val MAX_SCAN_LIMIT = 60
  private const val THUMBNAIL_SIZE = 224
  private const val SCAN_TIMEOUT_MS = 2500L

  fun permissionNames(): Array<String> =
    when {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> arrayOf(
        Manifest.permission.READ_MEDIA_IMAGES,
        Manifest.permission.READ_MEDIA_VIDEO
      )
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.M -> arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
      else -> emptyArray()
    }

  fun hasPermission(context: Context): Boolean =
    permissionNames().all { permission ->
      context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
    }

  fun status(context: Context, repository: PolicyRepository): Map<String, Any?> = mapOf(
    "galleryScanSupported" to (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q),
    "galleryScanPermissionGranted" to hasPermission(context),
    "galleryScanLastAt" to repository.galleryScanLastAt(),
    "galleryScanLastScannedCount" to repository.galleryScanLastScannedCount(),
    "galleryScanFlaggedCount" to repository.galleryScanFlaggedCount(),
    "galleryScanLastFlaggedAt" to repository.galleryScanLastFlaggedAt(),
    "galleryScanMode" to "mediastore_thumbnail_on_device",
    "galleryScanRetainsImages" to false
  )

  fun scanRecent(context: Context, repository: PolicyRepository, requestedLimit: Int?): Map<String, Any?> {
    val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
    val permissionGranted = hasPermission(context)
    if (!supported || !permissionGranted) {
      return status(context, repository) + mapOf(
        "scannedCount" to 0,
        "flaggedCount" to 0,
        "reason" to if (!supported) "unsupported_android_version" else "gallery_permission_required"
      )
    }

    val limit = coerceScanLimit(requestedLimit)
    val lastScanAt = repository.galleryScanLastAt()
    val candidates = queryCandidates(context, lastScanAt)
      .sortedByDescending { it.addedAtMs }
      .take(limit)

    var scannedCount = 0
    var flaggedCount = 0
    var lastFlaggedAt = repository.galleryScanLastFlaggedAt()

    candidates.forEach { candidate ->
      val thumbnail = loadThumbnail(context, candidate.uri) ?: return@forEach
      scannedCount += 1
      val decision = scanThumbnail(thumbnail)
      if (decision?.action == "block") {
        flaggedCount += 1
        lastFlaggedAt = System.currentTimeMillis()
        repository.recordAuditEvent(
          eventType = "GALLERY_EXPLICIT_MEDIA_DETECTED",
          severity = "critical",
          category = "media_scan",
          subject = candidate.mediaType,
          action = "gallery_item_flagged_privately",
          metadata = mapOf(
            "score" to decision.score,
            "mediaType" to candidate.mediaType,
            "scanner" to decision.scanner
          )
        )
      }
    }

    repository.setGalleryScanSnapshot(
      scannedCount = scannedCount,
      flaggedCount = flaggedCount,
      lastFlaggedAt = lastFlaggedAt
    )

    return status(context, repository) + mapOf(
      "scannedCount" to scannedCount,
      "flaggedCount" to flaggedCount,
      "reason" to "ok"
    )
  }

  internal fun coerceScanLimit(limit: Int?): Int =
    (limit ?: DEFAULT_SCAN_LIMIT).coerceIn(1, MAX_SCAN_LIMIT)

  private fun queryCandidates(context: Context, lastScanAt: Long): List<GalleryScanCandidate> {
    return queryMedia(
      context = context,
      collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
      idColumn = MediaStore.Images.Media._ID,
      addedColumn = MediaStore.Images.Media.DATE_ADDED,
      mediaType = "image",
      lastScanAt = lastScanAt
    ) + queryMedia(
      context = context,
      collection = MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
      idColumn = MediaStore.Video.Media._ID,
      addedColumn = MediaStore.Video.Media.DATE_ADDED,
      mediaType = "video",
      lastScanAt = lastScanAt
    )
  }

  private fun queryMedia(
    context: Context,
    collection: Uri,
    idColumn: String,
    addedColumn: String,
    mediaType: String,
    lastScanAt: Long
  ): List<GalleryScanCandidate> {
    val candidates = mutableListOf<GalleryScanCandidate>()
    val selection = if (lastScanAt > 0) "$addedColumn > ?" else null
    val selectionArgs = if (lastScanAt > 0) arrayOf((lastScanAt / 1000L).toString()) else null

    runCatching {
      context.contentResolver.query(
        collection,
        arrayOf(idColumn, addedColumn),
        selection,
        selectionArgs,
        "$addedColumn DESC"
      )?.use { cursor ->
        val idIndex = cursor.getColumnIndexOrThrow(idColumn)
        val addedIndex = cursor.getColumnIndexOrThrow(addedColumn)
        while (cursor.moveToNext()) {
          val id = cursor.getLong(idIndex)
          val addedAtMs = cursor.getLong(addedIndex) * 1000L
          candidates += GalleryScanCandidate(
            uri = ContentUris.withAppendedId(collection, id),
            mediaType = mediaType,
            addedAtMs = addedAtMs
          )
        }
      }
    }

    return candidates
  }

  private fun loadThumbnail(context: Context, uri: Uri): Bitmap? =
    runCatching {
      context.contentResolver.loadThumbnail(uri, Size(THUMBNAIL_SIZE, THUMBNAIL_SIZE), null)
    }.getOrNull()

  private fun scanThumbnail(bitmap: Bitmap): ImageScanDecision? {
    val latch = CountDownLatch(1)
    var decision: ImageScanDecision? = null
    ImageContentScanner.scanBitmap(
      bitmap = bitmap,
      onComplete = {
        bitmap.recycle()
        latch.countDown()
      },
      onNsfw = { result -> decision = result }
    )
    latch.await(SCAN_TIMEOUT_MS, TimeUnit.MILLISECONDS)
    return decision
  }
}
