package com.example.blocker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class NightModeWorker(
  appContext: Context,
  workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {
  override suspend fun doWork(): Result {
    val repository = PolicyRepository(applicationContext)
    if (!repository.isProtectionRequested() || !repository.isNightModeActive()) return Result.success()

    ManagedPrivateDnsBackup.configureIfPossible(applicationContext, repository)
    val enforcement = ManagedEnforcer(applicationContext, repository)
    enforcement.applyPackageSuspension()
    enforcement.enforceAlwaysOnVpnLockdown()

    repository.recordAuditEvent(
      eventType = "NIGHT_MODE_ENFORCED",
      severity = "high",
      category = "focus",
      subject = "night_mode",
      action = "automatic_tightening"
    )
    return Result.success()
  }

  companion object {
    private const val UNIQUE_WORK_NAME = "night_mode_enforcement"

    fun schedule(context: Context) {
      val request = PeriodicWorkRequestBuilder<NightModeWorker>(15, TimeUnit.MINUTES).build()
      WorkManager.getInstance(context.applicationContext).enqueueUniquePeriodicWork(
        UNIQUE_WORK_NAME,
        ExistingPeriodicWorkPolicy.UPDATE,
        request
      )
    }
  }
}
