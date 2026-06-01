package com.example.blocker

import android.content.Context

object BlockerConfig {
  @Volatile
  var imageScanningEnabled: Boolean = true

  @Volatile
  var imageScanThreshold: Float = 0.80f

  @Volatile
  var imageScanDetectionCount: Int = 0
    private set

  fun recordImageDetection() {
    imageScanDetectionCount += 1
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
