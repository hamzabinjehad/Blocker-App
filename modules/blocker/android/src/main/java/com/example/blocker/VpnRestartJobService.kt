package com.example.blocker

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build

class VpnRestartJobService : JobService() {
  override fun onStartJob(params: JobParameters?): Boolean {
    val repository = PolicyRepository(this)
    if (!repository.isProtectionRequested()) {
      return false
    }
    val currentLifecycle = repository.reconcileVpnLifecycle(FilterVpnService.isRunning)
    if (currentLifecycle.verifiedActive || currentLifecycle.startupGraceActive) {
      return false
    }
    if (VpnService.prepare(this) != null) {
      repository.markVpnStartFailed("restart_needs_permission")
      repository.recordAuditEvent(
        eventType = "VPN_RESTART_NEEDS_PERMISSION",
        severity = "critical",
        category = "vpn",
        subject = packageName,
        action = "restart_blocked"
      )
      return false
    }

    val startIntent = Intent(this, FilterVpnService::class.java).apply {
      action = FilterVpnService.ACTION_START
    }
    repository.markVpnStarting()
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        startForegroundService(startIntent)
      } else {
        startService(startIntent)
      }
    } catch (error: Exception) {
      val failure = "restart_service_start_exception:${error.javaClass.simpleName.ifBlank { "Exception" }}".take(200)
      repository.markVpnStartFailed(failure)
      repository.recordAuditEvent(
        eventType = "VPN_RESTART_FAILED",
        severity = "critical",
        category = "vpn",
        subject = packageName,
        action = failure
      )
      return false
    }

    repository.recordAuditEvent(
      eventType = "VPN_RESTART_SCHEDULED",
      severity = "high",
      category = "vpn",
      subject = packageName,
      action = "restart_attempted"
    )

    return false
  }

  override fun onStopJob(params: JobParameters?): Boolean = true

  companion object {
    private const val PERIODIC_JOB_ID = 1001

    fun schedulePeriodic(context: Context) {
      try {
        val scheduler = context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as JobScheduler
        if (scheduler.getPendingJob(PERIODIC_JOB_ID) != null) return
        val job = JobInfo.Builder(
          PERIODIC_JOB_ID,
          ComponentName(context, VpnRestartJobService::class.java)
        )
          .setPeriodic(15 * 60 * 1000L)
          .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
          .setPersisted(true)
          .build()
        scheduler.schedule(job)
      } catch (_: Exception) {
        // JobScheduler not available
      }
    }
  }
}
