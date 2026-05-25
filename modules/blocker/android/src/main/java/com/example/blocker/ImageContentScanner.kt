package com.example.blocker

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabel
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import java.util.concurrent.ConcurrentHashMap

data class ImageLabelSignal(
  val text: String,
  val confidence: Double
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "text" to text,
    "confidence" to confidence
  )
}

data class ImageScanDecision(
  val score: Double,
  val action: String,
  val labels: List<ImageLabelSignal>,
  val scanner: String = "google_mlkit_image_labeling",
  val mode: String = "on_device_weighted_labels"
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "score" to score,
    "action" to action,
    "labels" to labels.map { it.toMap() },
    "scanner" to scanner,
    "mode" to mode
  )
}

object ImageContentScanner {

  private val labeler by lazy {
    ImageLabeling.getClient(
      ImageLabelerOptions.Builder().setConfidenceThreshold(0.55f).build()
    )
  }

  private val adultLabelWeights = mapOf(
    "skin" to 0.28,
    "human body" to 0.30,
    "undergarment" to 0.72,
    "swimwear" to 0.44,
    "bikini" to 0.58,
    "lingerie" to 0.82,
    "nudity" to 1.0,
    "brassiere" to 0.74
  )

  private val humanContextLabels = setOf("person", "people", "face", "selfie", "portrait")

  private val safeContextLabels = setOf(
    "sports", "athlete", "swimming", "gym", "fitness",
    "beach", "vacation", "art", "museum", "painting",
    "medical", "science", "education", "food", "landscape",
    "animal", "pet", "dog", "cat", "plant", "vehicle"
  )

  private const val BLOCK_THRESHOLD = 0.72
  private const val AMBIGUOUS_THRESHOLD = 0.38

  private val scanThrottle = ConcurrentHashMap<String, Long>()
  private const val THROTTLE_MS = 2500L

  fun shouldScan(packageName: String): Boolean {
    val now = System.currentTimeMillis()
    val last = scanThrottle[packageName] ?: 0L
    return if (now - last > THROTTLE_MS) {
      scanThrottle[packageName] = now
      true
    } else false
  }

  private fun downscaleIfNeeded(bitmap: Bitmap, maxDim: Int = 512): Bitmap {
    if (bitmap.width <= maxDim && bitmap.height <= maxDim) return bitmap
    val scale = maxDim.toFloat() / maxOf(bitmap.width, bitmap.height)
    return Bitmap.createScaledBitmap(
      bitmap,
      (bitmap.width * scale).toInt(),
      (bitmap.height * scale).toInt(),
      true
    )
  }

  fun scanBitmap(
    bitmap: Bitmap,
    packageName: String? = null,
    onComplete: () -> Unit = {},
    onAmbiguous: (ImageScanDecision) -> Unit = {},
    onNsfw: (ImageScanDecision) -> Unit
  ) {
    if (packageName != null && !shouldScan(packageName)) {
      onComplete()
      return
    }
    val scaled = downscaleIfNeeded(bitmap)
    val image = InputImage.fromBitmap(scaled, 0)
    labeler.process(image)
      .addOnSuccessListener { labels ->
        val decision = classify(labels)
        when (decision.action) {
          "block" -> onNsfw(decision)
          "ambiguous" -> onAmbiguous(decision)
        }
      }
      .addOnFailureListener { /* ML Kit unavailable or model not loaded */ }
      .addOnCompleteListener { onComplete() }
  }

  fun status(
    supported: Boolean,
    enabled: Boolean,
    accessibilityServiceEnabled: Boolean,
    cloudFallbackEnabled: Boolean,
    cloudFallbackConfigured: Boolean
  ): Map<String, Any?> = mapOf(
    "supported" to supported,
    "enabled" to enabled,
    "imageScanningActive" to (supported && enabled && accessibilityServiceEnabled),
    "videoThumbnailBlockingActive" to (supported && enabled && accessibilityServiceEnabled),
    "scanner" to "google_mlkit_image_labeling",
    "classifierMode" to "on_device_weighted_labels",
    "cloudFallbackEnabled" to cloudFallbackEnabled,
    "cloudFallbackConfigured" to cloudFallbackConfigured,
    "cloudFallbackMode" to "ambiguous_label_metadata_only",
    "blockThreshold" to BLOCK_THRESHOLD,
    "ambiguityThreshold" to AMBIGUOUS_THRESHOLD,
    "scanTargetPackageCount" to SCAN_TARGET_PACKAGE_COUNT,
    "limitations" to listOf(
      "Uses accessibility screenshots and a visible blocking overlay; it cannot decrypt browser traffic or rewrite pixels inside another app.",
      "Cloud fallback only sends local label metadata for ambiguous cases when an HTTPS review endpoint is configured.",
      "Android may deny screenshots for secure windows or protected media surfaces."
    )
  )

  internal fun classify(labels: List<ImageLabel>): ImageScanDecision {
    val signals = labels.map { ImageLabelSignal(it.text, it.confidence.toDouble()) }
    val weightedScore = signals.sumOf { signal ->
      val weight = adultLabelWeights[signal.text.lowercase()] ?: 0.0
      weight * signal.confidence
    }
    val humanContextBoost = if (
      weightedScore >= 0.15 &&
      signals.any { it.text.lowercase() in humanContextLabels && it.confidence >= 0.55 }
    ) {
      0.08
    } else {
      0.0
    }
    val safeContextPenalty = signals
      .filter { it.text.lowercase() in safeContextLabels && it.confidence >= 0.60 }
      .sumOf { it.confidence * 0.4 }
    val score = (weightedScore + humanContextBoost - safeContextPenalty).coerceIn(0.0, 1.0)
    val action = when {
      score >= BLOCK_THRESHOLD -> "block"
      score >= AMBIGUOUS_THRESHOLD -> "ambiguous"
      else -> "allow"
    }
    return ImageScanDecision(
      score = score,
      action = action,
      labels = signals
        .filter { it.text.lowercase() in adultLabelWeights.keys || it.text.lowercase() in humanContextLabels }
        .sortedByDescending { it.confidence }
    )
  }

  private const val SCAN_TARGET_PACKAGE_COUNT = 16
}
