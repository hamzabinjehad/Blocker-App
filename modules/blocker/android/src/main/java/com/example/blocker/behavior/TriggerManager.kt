package com.example.blocker.behavior

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import com.example.blocker.BlockOverlayService
import com.example.blocker.GuardianNotifier
import com.example.blocker.PolicyRepository
import java.util.UUID

object TriggerManager {
  private val mainHandler = Handler(Looper.getMainLooper())
  @Volatile private var eventSink: ((Map<String, Any?>) -> Unit)? = null

  fun setEventSink(sink: ((Map<String, Any?>) -> Unit)?) {
    eventSink = sink
  }

  fun emit(context: Context, repository: PolicyRepository, event: BehaviorBlockEvent): Map<String, Any?> {
    val payload = event.toMap()
    repository.recordBehaviorTrigger(payload)

    mainHandler.post {
      eventSink?.invoke(payload)
      launchBlockScreen(context, event)
      GuardianNotifier.notify(
        context,
        eventType = event.eventType,
        severity = severityFor(event.reason),
        subject = event.packageName.ifBlank { event.keyword },
        action = event.action,
        metadata = mapOf(
          "reason" to event.reason,
          "keywordSource" to event.keywordSource,
          "screen" to event.screen
        )
      )
    }

    return payload
  }

  fun emitFromBridge(
    context: Context,
    repository: PolicyRepository,
    event: Map<String, Any?>
  ): Map<String, Any?> {
    val blockEvent = BehaviorBlockEvent(
      id = event["id"] as? String ?: UUID.randomUUID().toString(),
      keyword = event["keyword"] as? String ?: "manual trigger",
      keywordSource = event["keywordSource"] as? String ?: "manual",
      appName = event["appName"] as? String ?: "Manual test",
      packageName = event["packageName"] as? String ?: context.packageName,
      screen = event["screen"] as? String ?: "Manual trigger",
      source = event["source"] as? String ?: "react_native",
      reason = event["reason"] as? String ?: "manual_keyword_trigger",
      action = event["action"] as? String ?: "blocked",
      timestamp = (event["timestamp"] as? Number)?.toLong() ?: System.currentTimeMillis()
    )
    return emit(context, repository, blockEvent)
  }

  private fun launchBlockScreen(context: Context, event: BehaviorBlockEvent) {
    BlockOverlayService.show(context, event.appName, event.reason)
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
    launchIntent
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
      .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
      .putExtra("blocker_event_id", event.id)
      .putExtra("blocker_event_reason", event.reason)
    context.startActivity(launchIntent)
  }

  private fun severityFor(reason: String): String =
    when (reason) {
      "tamper", "package_install_blocked", "bypass_domain" -> "critical"
      "blocked_app", "blocked_app_feature", "focus_mode", "usage_limit" -> "high"
      else -> "medium"
    }
}
