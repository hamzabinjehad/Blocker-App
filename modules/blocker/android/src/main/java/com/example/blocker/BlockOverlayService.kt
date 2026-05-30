package com.example.blocker

import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.CountDownTimer
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class BlockOverlayService : Service() {
    private var overlayView: View? = null
    private var countdownTimer: CountDownTimer? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        NotificationHelper.ensureChannel(this)
        startForeground(NotificationHelper.NOTIFICATION_ID, NotificationHelper.build(this))

        if (intent?.action == ACTION_HIDE) {
            hideOverlayIfAllowed(intent)
        } else {
            showOverlay(intent)
        }
        return START_STICKY
    }

    override fun onDestroy() {
        hideOverlay()
        super.onDestroy()
    }

    private fun showOverlay(intent: Intent?) {
        if (!canDrawOverlays(this)) {
            PolicyRepository(this).recordAuditEvent(
                "OVERLAY_PERMISSION_MISSING", "critical", "tamper", "system_alert_window", "overlay_not_shown"
            )
            stopSelf()
            return
        }

        if (overlayView != null) return

        val reason = intent?.getStringExtra(EXTRA_REASON) ?: "Unsafe content or bypass attempt"
        val app = intent?.getStringExtra(EXTRA_APP) ?: "Protected screen"
        val repository = PolicyRepository(this)
        val strict = repository.isStrictModeEnabled()

        overlayView = createView(app, reason, strict)
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            overlayType(),
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            PixelFormat.TRANSLUCENT
        )
        params.gravity = Gravity.CENTER

        windowManager().addView(overlayView, params)
        
        val duration = repository.behaviorBlockDurationSeconds().coerceIn(5, 120)
        startCountdown(duration)
    }

    private fun startCountdown(seconds: Int) {
        val countdownText = overlayView?.findViewWithTag<TextView>("countdown_text")
        val exitButton = overlayView?.findViewWithTag<Button>("exit_button")

        countdownTimer?.cancel()
        countdownTimer = object : CountDownTimer(seconds * 1000L, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                val remaining = (millisUntilFinished / 1000) + 1
                countdownText?.text = "Exit in $remaining seconds..."
            }

            override fun onFinish() {
                countdownText?.visibility = View.GONE
                exitButton?.visibility = View.VISIBLE
            }
        }.start()
    }

    private fun createView(app: String, reason: String, strict: Boolean): View {
        val root = LinearLayout(this)
        root.orientation = LinearLayout.VERTICAL
        root.gravity = Gravity.CENTER
        root.setPadding(64, 64, 64, 64)
        root.setBackgroundColor(Color.argb(250, 10, 15, 12))

        root.addView(createTextView("Blocked", 36f, true))
        root.addView(createSpacer(48))
        root.addView(createTextView(app, 20f, true))
        root.addView(createTextView(reason, 16f, false))
        root.addView(createTextView(if (strict) "Strict Mode: guardian approval is required." else "This content is restricted.", 14f, false))
        root.addView(createSpacer(64))

        val countdownText = createTextView("Wait...", 18f, true)
        countdownText.tag = "countdown_text"
        root.addView(countdownText)

        val exitButton = Button(this)
        exitButton.tag = "exit_button"
        exitButton.text = "Close and Exit App"
        exitButton.visibility = View.GONE
        exitButton.setOnClickListener { exitToHome() }
        root.addView(exitButton)

        root.addView(createSpacer(48))
        
        val openAppText = createTextView("Tap here to open Parent Blocker", 12f, false)
        openAppText.setOnClickListener { openApp() }
        root.addView(openAppText)

        return root
    }

    private fun createTextView(value: String, size: Float, bold: Boolean): TextView {
        val tv = TextView(this)
        tv.text = value
        tv.textSize = size
        tv.setTextColor(Color.WHITE)
        tv.gravity = Gravity.CENTER
        if (bold) tv.typeface = Typeface.DEFAULT_BOLD
        tv.setPadding(0, 8, 0, 8)
        return tv
    }

    private fun createSpacer(height: Int): View {
        val view = View(this)
        view.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, height)
        return view
    }

    private fun exitToHome() {
        val intent = Intent(Intent.ACTION_MAIN)
        intent.addCategory(Intent.CATEGORY_HOME)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        startActivity(intent)
        stopSelf()
    }

    private fun openApp() {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName) ?: return
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        startActivity(launchIntent)
    }

    private fun hideOverlay() {
        countdownTimer?.cancel()
        countdownTimer = null
        overlayView?.let { view ->
            runCatching { windowManager().removeView(view) }
        }
        overlayView = null
    }

    private fun hideOverlayIfAllowed(intent: Intent?) {
        val repository = PolicyRepository(this)
        val pin = intent?.getStringExtra(EXTRA_PIN) ?: ""
        val requiresPin = repository.isStrictModeEnabled() || repository.isBehaviorBlockPinRequired()
        if (requiresPin && !repository.verifyPin(pin)) {
            val attempts = repository.recordFailedPinAttempt()
            if (attempts == 5) {
                GuardianNotifier.notify(
                    context = this,
                    eventType = "PIN_ATTEMPTS_FAILED",
                    severity = "critical",
                    subject = "guardian_pin",
                    action = "five_failed_attempts",
                    metadata = mapOf("attempts" to attempts)
                )
            }
            return
        }
        repository.clearFailedPinAttempts()
        hideOverlay()
        stopSelf()
    }

    private fun windowManager(): WindowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager

    private fun overlayType(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

    companion object {
        const val ACTION_SHOW = "com.example.blocker.action.SHOW_BLOCK_OVERLAY"
        const val ACTION_HIDE = "com.example.blocker.action.HIDE_BLOCK_OVERLAY"
        const val EXTRA_REASON = "reason"
        const val EXTRA_APP = "app"
        const val EXTRA_PIN = "pin"

        fun canDrawOverlays(context: Context): Boolean =
            Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)

        fun overlaySettingsIntent(context: Context): Intent {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
            } else {
                Intent(Settings.ACTION_SETTINGS)
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            return intent
        }

        fun show(context: Context, app: String, reason: String) {
            val intent = Intent(context, BlockOverlayService::class.java)
            intent.action = ACTION_SHOW
            intent.putExtra(EXTRA_APP, app)
            intent.putExtra(EXTRA_REASON, reason)
            runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            }
        }

        fun hide(context: Context, pin: String? = null): Map<String, Any?> {
            val intent = Intent(context, BlockOverlayService::class.java)
            intent.action = ACTION_HIDE
            intent.putExtra(EXTRA_PIN, pin ?: "")
            context.startService(intent)
            return mapOf("hidden" to true)
        }
    }
}
