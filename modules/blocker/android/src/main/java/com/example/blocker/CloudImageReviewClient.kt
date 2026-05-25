package com.example.blocker

import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.net.URL
import java.util.concurrent.Executors
import javax.net.ssl.HttpsURLConnection

object CloudImageReviewClient {
  private val executor = Executors.newFixedThreadPool(4)
  private const val TIMEOUT_MS = 2500
  private const val CLOUD_BLOCK_THRESHOLD = 0.70

  fun review(
    endpoint: String,
    decision: ImageScanDecision,
    onComplete: (CloudImageReviewResult) -> Unit
  ) {
    val trimmedEndpoint = endpoint.trim()
    if (!trimmedEndpoint.startsWith("https://")) {
      onComplete(CloudImageReviewResult(block = false, action = "endpoint_rejected", score = null))
      return
    }

    executor.execute {
      val result = runCatching {
        val connection = URL(trimmedEndpoint).openConnection() as HttpsURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = TIMEOUT_MS
        connection.readTimeout = TIMEOUT_MS
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")

        val payload = JSONObject()
          .put("type", "adult_image_ambiguous")
          .put("privacyMode", "label_metadata_only")
          .put("localDecision", JSONObject(decision.toMap()))
          .toString()

        connection.outputStream.use { stream ->
          stream.write(payload.toByteArray(Charsets.UTF_8))
        }

        val responseBody = if (connection.responseCode in 200..299) {
          connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        } else {
          connection.errorStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
        }
        connection.disconnect()

        parseResult(responseBody)
      }.getOrElse {
        CloudImageReviewResult(block = false, action = "review_failed", score = null)
      }

      Handler(Looper.getMainLooper()).post {
        onComplete(result)
      }
    }
  }

  private fun parseResult(responseBody: String): CloudImageReviewResult {
    if (responseBody.isBlank()) {
      return CloudImageReviewResult(block = false, action = "empty_response", score = null)
    }
    val json = JSONObject(responseBody)
    val action = json.optString("action", "").ifBlank {
      if (json.optBoolean("unsafe", false)) "block" else "allow"
    }
    val score = if (json.has("score")) json.optDouble("score") else null
    val block = action == "block" || json.optBoolean("unsafe", false) || (score != null && score >= CLOUD_BLOCK_THRESHOLD)
    return CloudImageReviewResult(block = block, action = action, score = score)
  }
}

data class CloudImageReviewResult(
  val block: Boolean,
  val action: String,
  val score: Double?
)
