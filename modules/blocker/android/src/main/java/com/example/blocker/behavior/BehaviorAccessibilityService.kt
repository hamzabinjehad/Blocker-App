package com.example.blocker.behavior

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.graphics.Bitmap
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import com.example.blocker.BlockerConfig
import com.example.blocker.GuardianNotifier
import com.example.blocker.ImageContentScanner
import com.example.blocker.PolicyRepository
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong

class BehaviorAccessibilityService : AccessibilityService() {

  private val executor = Executors.newSingleThreadExecutor { r ->
    Thread(r, "BehaviorEngine-Worker").also { it.isDaemon = true }
  }

  private val lastWindowEventMs = AtomicLong(0L)
  private val lastTextEventMs = AtomicLong(0L)
  private val lastScreenshotMs = AtomicLong(0L)

  private var lastAnalyzedKey = ""

  override fun onServiceConnected() {
    super.onServiceConnected()
    val info = serviceInfo ?: AccessibilityServiceInfo()
    info.notificationTimeout = 250
    serviceInfo = info

    BlockerConfig.loadFromRepository(applicationContext)
    PolicyRepository(applicationContext).setAccessibilityServiceEnabledSnapshot(true)
  }

  override fun onUnbind(intent: android.content.Intent?): Boolean {
    PolicyRepository(applicationContext).setAccessibilityServiceEnabledSnapshot(false)
    return super.onUnbind(intent)
  }

  override fun onInterrupt() = Unit

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    event ?: return
    val type = event.eventType

    when (type) {
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
      AccessibilityEvent.TYPE_WINDOWS_CHANGED -> handleWindowEvent(event)

      AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED -> handleTextEvent(event)

      AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED,
      AccessibilityEvent.TYPE_VIEW_FOCUSED,
      AccessibilityEvent.TYPE_VIEW_CLICKED -> handleContentEvent(event)
    }
  }

  private fun handleWindowEvent(event: AccessibilityEvent) {
    val now = System.currentTimeMillis()
    if (now - lastWindowEventMs.getAndSet(now) < WINDOW_EVENT_THROTTLE_MS) return

    executor.execute {
      val repo = PolicyRepository(applicationContext)
      val context = ScreenContextDetector.fromAccessibilityEvent(this, event) ?: return@execute
      val key = "${context.packageName}|${context.screenType}"
      if (key == lastAnalyzedKey) return@execute
      lastAnalyzedKey = key

      BehaviorEngine(applicationContext, repo).analyzeScreenContext(context)
      maybeRunScreenshotAudit(repo, context.packageName)
    }
  }

  private fun handleTextEvent(event: AccessibilityEvent) {
    val now = System.currentTimeMillis()
    if (now - lastTextEventMs.getAndSet(now) < TEXT_EVENT_THROTTLE_MS) return

    executor.execute {
      val repo = PolicyRepository(applicationContext)
      if (!repo.isBehaviorProtectionEnabled()) return@execute
      val context = ScreenContextDetector.fromAccessibilityEvent(this, event) ?: return@execute
      if (context.analyzableText.isBlank()) return@execute
      BehaviorEngine(applicationContext, repo).analyzeScreenContext(context)
    }
  }

  private fun handleContentEvent(event: AccessibilityEvent) {
    val now = System.currentTimeMillis()
    if (now - lastWindowEventMs.get() < CONTENT_EVENT_THROTTLE_MS) return
    lastWindowEventMs.set(now)

    executor.execute {
      val repo = PolicyRepository(applicationContext)
      if (!repo.isBehaviorProtectionEnabled()) return@execute
      val context = ScreenContextDetector.fromAccessibilityEvent(this, event) ?: return@execute
      if (context.analyzableText.isBlank()) return@execute
      BehaviorEngine(applicationContext, repo).analyzeScreenContext(context)
    }
  }

  private fun maybeRunScreenshotAudit(repo: PolicyRepository, packageName: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
    if (!repo.isScreenshotAuditEnabled() && !BlockerConfig.imageScanningEnabled) return
    if (!repo.isProtectionRequested()) return

    val now = System.currentTimeMillis()
    val intervalMs = if (repo.isScreenshotAuditEnabled()) {
      repo.screenshotAuditIntervalMs()
    } else {
      IMAGE_SCAN_DEFAULT_INTERVAL_MS
    }
    if (now - lastScreenshotMs.get() < intervalMs) return
    if (!ImageContentScanner.shouldScan(packageName)) return
    lastScreenshotMs.set(now)

    Handler(Looper.getMainLooper()).post {
      takeScreenshot(
        android.view.Display.DEFAULT_DISPLAY,
        applicationContext.mainExecutor,
        object : TakeScreenshotCallback {
          override fun onSuccess(screenshot: ScreenshotResult) {
            val bitmap = android.graphics.Bitmap.wrapHardwareBuffer(
              screenshot.hardwareBuffer, screenshot.colorSpace
            )
            screenshot.hardwareBuffer.close()
            if (bitmap == null) return
            val softBitmap = bitmap.copy(Bitmap.Config.ARGB_8888, false)
            bitmap.recycle()
            if (softBitmap == null) return

            ImageContentScanner.scanBitmap(
              bitmap = softBitmap,
              packageName = packageName,
              onComplete = { softBitmap.recycle() },
              onAmbiguous = { decision ->
                if (repo.isCloudImageFallbackEnabled() && repo.cloudImageFallbackEndpoint().isNotBlank()) {
                  com.example.blocker.CloudImageReviewClient.review(
                    endpoint = repo.cloudImageFallbackEndpoint(),
                    decision = decision
                  ) { }
                }
              },
              onNsfw = { decision ->
                val event = BehaviorBlockEvent(
                  keyword = "explicit image (score=${String.format("%.2f", decision.score)})",
                  keywordSource = "image_scanner",
                  appName = packageName,
                  packageName = packageName,
                  screen = "screenshot_audit",
                  source = "accessibility_service",
                  reason = "image_content"
                )
                TriggerManager.emit(applicationContext, repo, event)
                repo.recordAuditEvent(
                  eventType = "IMAGE_SCAN_BLOCKED",
                  severity = "critical",
                  category = "media",
                  subject = packageName,
                  action = "nsfw_detected",
                  metadata = mapOf("score" to decision.score, "scanner" to decision.scanner)
                )
                GuardianNotifier.notify(
                  context = applicationContext,
                  eventType = "IMAGE_SCAN_BLOCKED",
                  severity = "critical",
                  subject = packageName,
                  action = "nsfw_detected",
                  metadata = mapOf("score" to decision.score)
                )
                softBitmap.recycle()
              }
            )
          }

          override fun onFailure(errorCode: Int) {
            // Screen protected or not available — not an error worth reporting
          }
        }
      )
    }
  }

  override fun onDestroy() {
    executor.shutdown()
    super.onDestroy()
  }

  companion object {
    private const val WINDOW_EVENT_THROTTLE_MS = 300L
    private const val TEXT_EVENT_THROTTLE_MS = 600L
    private const val CONTENT_EVENT_THROTTLE_MS = 1500L
    private const val IMAGE_SCAN_DEFAULT_INTERVAL_MS = 4_000L
  }
}
