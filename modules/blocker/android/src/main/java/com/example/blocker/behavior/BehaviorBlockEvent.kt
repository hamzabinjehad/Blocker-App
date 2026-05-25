package com.example.blocker.behavior

import java.util.UUID

data class BehaviorBlockEvent(
  val id: String = UUID.randomUUID().toString(),
  val eventType: String = "BLOCK_EVENT",
  val keyword: String,
  val keywordSource: String,
  val appName: String,
  val packageName: String,
  val screen: String,
  val source: String,
  val reason: String,
  val action: String = "blocked",
  val timestamp: Long = System.currentTimeMillis()
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "eventType" to eventType,
    "keyword" to keyword,
    "keywordSource" to keywordSource,
    "appName" to appName,
    "packageName" to packageName,
    "screen" to screen,
    "source" to source,
    "reason" to reason,
    "action" to action,
    "timestamp" to timestamp
  )
}
