package com.example.blocker

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class BlocklistUpdateWorker(
  appContext: Context,
  workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {
  override suspend fun doWork(): Result {
    val repository = PolicyRepository(applicationContext)
    val result = BlocklistStore.updateAdultDomains(applicationContext)
    val updated = result["updated"] == true
    val total = (result["total"] as? Number)?.toInt() ?: 0
    val updatedAt = result["updatedAt"] as? String ?: "not changed"

    if (total > 0) {
      repository.setLastBlocklistUpdate(updatedAt)
    }

    repository.recordAuditEvent(
      eventType = "BLOCKLIST_AUTO_UPDATE",
      severity = if (updated) "low" else "medium",
      category = "blocklist",
      subject = "adult_domains",
      action = if (updated) "updated" else "checked",
      metadata = result
    )
    repository.recordGuardianAlert(
      eventType = "BLOCKLIST_AUTO_UPDATE",
      severity = "low",
      subject = "adult_domains",
      action = if (updated) "lists_updated" else "lists_checked",
      metadata = mapOf("total" to total, "updatedAt" to updatedAt)
    )

    return if (total > 0 || !updated) Result.success() else Result.retry()
  }

  companion object {
    private const val UNIQUE_WORK_NAME = "weekly_blocklist_auto_update"

    fun scheduleWeekly(context: Context) {
      val constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()
      val request = PeriodicWorkRequestBuilder<BlocklistUpdateWorker>(7, TimeUnit.DAYS)
        .setConstraints(constraints)
        .build()
      WorkManager.getInstance(context.applicationContext).enqueueUniquePeriodicWork(
        UNIQUE_WORK_NAME,
        ExistingPeriodicWorkPolicy.UPDATE,
        request
      )
    }
  }
}
