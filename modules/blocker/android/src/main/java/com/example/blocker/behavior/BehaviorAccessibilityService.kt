package com.example.blocker.behavior

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.graphics.Bitmap
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.example.blocker.BlockerConfig
import com.example.blocker.GuardianNotifier
import com.example.blocker.ImageContentScanner
import com.example.blocker.PolicyRepository
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference

class BehaviorAccessibilityService : AccessibilityService() {

  private val executor = Executors.newSingleThreadExecutor { r ->
    Thread(r, "BehaviorEngine-Worker").also { it.isDaemon = true }
  }
  private val mainHandler = Handler(Looper.getMainLooper())

  private val lastWindowEventMs = AtomicLong(0L)
  private val lastTextEventMs = AtomicLong(0L)
  private val visualDispatchPending = AtomicBoolean(false)
  private val visualAuditSuppressed = AtomicBoolean(false)
  private val latestVisualPackage = AtomicReference<String?>(null)
  private val screenshotAuditGate = ScreenshotAuditGate()
  private val visualAuditDispatch = Runnable {
    if (!visualDispatchPending.compareAndSet(true, false) || executor.isShutdown) {
      return@Runnable
    }
    executor.execute {
      prepareScreenshotAudit(PolicyRepository(applicationContext))
    }
  }

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
    if (event.isPassword || event.source?.isPassword == true) {
      cancelPendingVisualAudit()
      return
    }
    val eventPackageName = event.packageName?.toString()?.takeIf { it.isNotBlank() } ?: return
    if (eventPackageName == packageName) {
      cancelPendingVisualAudit()
      return
    }
    val type = event.eventType
    if (ScreenshotAuditEventPolicy.shouldRequestAudit(type)) {
      handleVisualChange(eventPackageName)
    }

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

  private fun handleVisualChange(eventPackageName: String) {
    // Fixed-window, latest-wins coalescing avoids an executor queue storm without starving a
    // continuously scrolling feed. ScreenshotAuditGate remains the sole owner of capture timing.
    visualAuditSuppressed.set(false)
    latestVisualPackage.set(eventPackageName)
    if (!visualDispatchPending.compareAndSet(false, true)) return
    mainHandler.postDelayed(visualAuditDispatch, VISUAL_EVENT_COALESCE_MS)
  }

  private fun cancelPendingVisualAudit() {
    visualAuditSuppressed.set(true)
    latestVisualPackage.set(null)
    visualDispatchPending.set(false)
    mainHandler.removeCallbacks(visualAuditDispatch)
  }

  private fun prepareScreenshotAudit(repo: PolicyRepository) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
    if (!repo.isProtectionRequested()) return

    val intervalMs = ScreenshotScanPolicy.effectiveIntervalMs(
      imageScanningEnabled = BlockerConfig.imageScanningEnabled,
      screenshotAuditEnabled = repo.isScreenshotAuditEnabled(),
      screenshotAuditIntervalMs = repo.screenshotAuditIntervalMs()
    ) ?: return
    mainHandler.post {
      if (visualAuditSuppressed.get()) return@post
      val targetPackageName = activePackageName() ?: latestVisualPackage.get() ?: return@post
      if (targetPackageName == packageName) return@post
      if (activeWindowIsPassword()) return@post
      if (!screenshotAuditGate.tryAcquire(SystemClock.elapsedRealtime(), intervalMs)) return@post
      takeScreenshot(
        android.view.Display.DEFAULT_DISPLAY,
        applicationContext.mainExecutor,
        object : TakeScreenshotCallback {
          override fun onSuccess(screenshot: ScreenshotResult) {
            val activePackage = activePackageName()
            if (
              visualAuditSuppressed.get() ||
              activeWindowIsPassword() ||
              activePackage == packageName ||
              (activePackage != null && activePackage != targetPackageName)
            ) {
              screenshot.hardwareBuffer.close()
              return
            }
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
                  appName = targetPackageName,
                  packageName = targetPackageName,
                  screen = "screenshot_audit",
                  source = "accessibility_service",
                  reason = "image_content"
                )
                TriggerManager.emit(applicationContext, repo, event)
                repo.recordAuditEvent(
                  eventType = "IMAGE_SCAN_BLOCKED",
                  severity = "critical",
                  category = "media",
                  subject = targetPackageName,
                  action = "nsfw_detected",
                  metadata = mapOf("score" to decision.score, "scanner" to decision.scanner)
                )
                GuardianNotifier.notify(
                  context = applicationContext,
                  eventType = "IMAGE_SCAN_BLOCKED",
                  severity = "critical",
                  subject = targetPackageName,
                  action = "nsfw_detected",
                  metadata = mapOf("score" to decision.score)
                )
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

  private fun activePackageName(): String? = runCatching {
    rootInActiveWindow?.packageName?.toString()?.takeIf { it.isNotBlank() }
  }.getOrNull()

  private fun activeWindowIsPassword(): Boolean = runCatching {
    rootInActiveWindow?.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?.isPassword == true
  }.getOrDefault(false)

  override fun onDestroy() {
    cancelPendingVisualAudit()
    mainHandler.removeCallbacksAndMessages(null)
    executor.shutdown()
    super.onDestroy()
  }

  companion object {
    private const val WINDOW_EVENT_THROTTLE_MS = 300L
    private const val TEXT_EVENT_THROTTLE_MS = 600L
    private const val CONTENT_EVENT_THROTTLE_MS = 1500L
    private const val VISUAL_EVENT_COALESCE_MS = 500L
  }
}
