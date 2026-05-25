package com.example.blocker

import android.content.Context
import android.util.Base64
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import java.security.SecureRandom

object IntegrityChecker {
  @Volatile
  private var checked = false

  fun checkOncePerLaunch(context: Context) {
    if (checked) return
    checked = true

    val appContext = context.applicationContext
    val repository = PolicyRepository(appContext)

    try {
      val nonce = Base64.encodeToString(
        SecureRandom().generateSeed(16), Base64.URL_SAFE or Base64.NO_WRAP
      )
      val integrityManager = IntegrityManagerFactory.create(appContext)
      integrityManager.requestIntegrityToken(
        IntegrityTokenRequest.builder().setNonce(nonce).build()
      ).addOnSuccessListener {
        repository.setIntegrityCheckState("token_received_pending_server_verification")
        repository.recordAuditEvent(
          eventType = "INTEGRITY_TOKEN_RECEIVED",
          severity = "medium",
          category = "integrity",
          subject = "play_integrity",
          action = "server_verification_required"
        )
      }.addOnFailureListener { e ->
        repository.setIntegrityCheckState("token_request_failed", e.message ?: "unknown")
        repository.recordAuditEvent(
          eventType = "INTEGRITY_TOKEN_REQUEST_FAILED",
          severity = "critical",
          category = "integrity",
          subject = "play_integrity",
          action = "failed",
          metadata = mapOf("error" to (e.message ?: "unknown"))
        )
        GuardianNotifier.notify(
          context = appContext,
          eventType = "INTEGRITY_TOKEN_REQUEST_FAILED",
          severity = "critical",
          subject = "play_integrity",
          action = "failed"
        )
      }
    } catch (_: Exception) {
      repository.setIntegrityCheckState("play_integrity_unavailable")
      // Play Integrity API not available on this device
    }
  }

  fun status(repository: PolicyRepository): Map<String, Any?> =
    repository.integrityCheckState() + mapOf(
      "playIntegrityTokenRequested" to true,
      "localSignatureBaselineStored" to (repository.signatureBaseline() != null),
      "localSignatureTamperSignal" to "app_signature_mismatch"
    )
}
