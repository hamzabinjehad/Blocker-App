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
    if (FilterVpnService.isRunning) {
      return false
    }
    if (VpnService.prepare(this) != null) {
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
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      startForegroundService(startIntent)
    } else {
      startService(startIntent)
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
