package com.example.blocker

import android.content.Context
import java.util.concurrent.atomic.AtomicInteger

object BlockerConfig {
  @Volatile
  var imageScanningEnabled: Boolean = true

  @Volatile
  var imageScanThreshold: Float = 0.80f

  private val _imageScanDetectionCount = AtomicInteger(0)
  val imageScanDetectionCount: Int get() = _imageScanDetectionCount.get()

  fun recordImageDetection() {
    _imageScanDetectionCount.incrementAndGet()
  }

  fun loadFromRepository(context: Context) {
    val repo = PolicyRepository(context)
    imageScanningEnabled = repo.isImageScanningEnabled()
    imageScanThreshold = repo.imageScanThreshold()
  }

  fun saveToRepository(context: Context) {
    val repo = PolicyRepository(context)
    repo.setImageScanConfig(imageScanningEnabled, imageScanThreshold)
  }
}
