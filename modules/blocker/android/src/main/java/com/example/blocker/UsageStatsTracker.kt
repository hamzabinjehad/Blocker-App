package com.example.blocker

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.Process
import java.util.Calendar

class UsageStatsTracker(
  private val context: Context,
  private val repository: PolicyRepository
) {

  fun dailySummary(): Map<String, Any?> {
    if (!hasUsageAccess()) {
      return mapOf(
        "available" to false,
        "reason" to "usage_access_not_granted"
      )
    }

    val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val now = System.currentTimeMillis()
    val startOfDay = startOfDayMs()

    val stats = runCatching {
      usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startOfDay, now)
    }.getOrDefault(emptyList())

    val activeStats = stats.filter { it.totalTimeInForeground > 0 }
    val totalScreenTimeMs = activeStats.sumOf { it.totalTimeInForeground }
    val appCount = activeStats.size

    val topApps = activeStats
      .sortedByDescending { it.totalTimeInForeground }
      .take(10)
      .map { stat ->
        val appLabel = resolveAppLabel(stat.packageName)
        mapOf(
          "packageName" to stat.packageName,
          "appLabel" to appLabel,
          "foregroundTimeMinutes" to (stat.totalTimeInForeground / 60000.0).toInt(),
          "lastUsed" to stat.lastTimeUsed
        )
      }

    val categoryBreakdown = buildCategoryBreakdown(activeStats)
    val unlockCount = countUnlocks(usageStatsManager, startOfDay, now)
    val notificationCount = countNotifications(usageStatsManager, startOfDay, now)

    return mapOf(
      "available" to true,
      "date" to formatDate(startOfDay),
      "totalScreenTimeMinutes" to (totalScreenTimeMs / 60000.0).toInt(),
      "totalScreenTimeMs" to totalScreenTimeMs,
      "appCount" to appCount,
      "unlockCount" to unlockCount,
      "notificationCount" to notificationCount,
      "topApps" to topApps,
      "categoryBreakdown" to categoryBreakdown
    )
  }

  fun weeklySummary(): Map<String, Any?> {
    if (!hasUsageAccess()) {
      return mapOf("available" to false, "reason" to "usage_access_not_granted")
    }

    val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val now = System.currentTimeMillis()
    val startOfWeek = startOfWeekMs()

    val stats = runCatching {
      usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_WEEKLY, startOfWeek, now)
    }.getOrDefault(emptyList())

    val activeStats = stats.filter { it.totalTimeInForeground > 0 }
    val totalScreenTimeMs = activeStats.sumOf { it.totalTimeInForeground }

    val dailyBreakdown = (0..6).map { dayOffset ->
      val dayStart = startOfWeek + dayOffset * DAY_MS
      val dayEnd = dayStart + DAY_MS
      val dayStats = runCatching {
        usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, dayStart, minOf(dayEnd, now))
      }.getOrDefault(emptyList())

      mapOf(
        "date" to formatDate(dayStart),
        "totalScreenTimeMinutes" to (dayStats.sumOf { it.totalTimeInForeground } / 60000.0).toInt()
      )
    }.filter { (it["totalScreenTimeMinutes"] as Int) > 0 }

    return mapOf(
      "available" to true,
      "weekStartDate" to formatDate(startOfWeek),
      "totalScreenTimeMinutes" to (totalScreenTimeMs / 60000.0).toInt(),
      "averageDailyScreenTimeMinutes" to if (dailyBreakdown.isNotEmpty()) {
        (totalScreenTimeMs / 60000.0 / dailyBreakdown.size).toInt()
      } else {
        0
      },
      "dailyBreakdown" to dailyBreakdown
    )
  }

  fun appUsageDetail(packageName: String): Map<String, Any?> {
    if (!hasUsageAccess()) {
      return mapOf("available" to false, "reason" to "usage_access_not_granted")
    }

    val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val now = System.currentTimeMillis()
    val startOfDay = startOfDayMs()

    val todayStats = runCatching {
      usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startOfDay, now)
        .filter { it.packageName.equals(packageName, ignoreCase = true) }
    }.getOrDefault(emptyList())

    val foregroundMs = todayStats.sumOf { it.totalTimeInForeground }
    val lastUsed = todayStats.maxOfOrNull { it.lastTimeUsed } ?: 0L

    val launchCount = countAppLaunches(usageStatsManager, packageName, startOfDay, now)
    val appLabel = resolveAppLabel(packageName)
    val rule = AppRuleEngine.matchPackage(context, packageName.lowercase(), appLabel)
    val limit = AppUsageLimiter(context, repository).evaluate(packageName, appLabel)

    return mapOf(
      "available" to true,
      "packageName" to packageName,
      "appLabel" to appLabel,
      "foregroundTimeMinutes" to (foregroundMs / 60000.0).toInt(),
      "foregroundTimeMs" to foregroundMs,
      "lastUsed" to lastUsed,
      "launchCount" to launchCount,
      "category" to (rule?.category ?: "uncategorized"),
      "limitMinutes" to (limit?.limitMinutes ?: 0),
      "limitSource" to (limit?.source ?: "none"),
      "usedMinutes" to (limit?.usedMinutes ?: (foregroundMs / 60000.0).toInt()),
      "limitExceeded" to (limit != null)
    )
  }

  private fun buildCategoryBreakdown(
    stats: List<android.app.usage.UsageStats>
  ): List<Map<String, Any?>> {
    val categoryMap = mutableMapOf<String, Long>()
    stats.forEach { stat ->
      val appLabel = resolveAppLabel(stat.packageName)
      val rule = AppRuleEngine.matchPackage(context, stat.packageName.lowercase(), appLabel)
      val category = rule?.category ?: "uncategorized"
      categoryMap[category] = (categoryMap[category] ?: 0L) + stat.totalTimeInForeground
    }
    return categoryMap.entries
      .sortedByDescending { it.value }
      .map { (category, timeMs) ->
        mapOf(
          "category" to category,
          "totalTimeMinutes" to (timeMs / 60000.0).toInt()
        )
      }
  }

  private fun countUnlocks(
    manager: UsageStatsManager,
    startTime: Long,
    endTime: Long
  ): Int {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return 0
    var count = 0
    val events = runCatching {
      manager.queryEvents(startTime, endTime)
    }.getOrNull() ?: return 0

    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P &&
        event.eventType == UsageEvents.Event.KEYGUARD_HIDDEN
      ) {
        count++
      }
    }
    return count
  }

  private fun countNotifications(
    manager: UsageStatsManager,
    startTime: Long,
    endTime: Long
  ): Int {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return 0
    var count = 0
    val events = runCatching {
      manager.queryEvents(startTime, endTime)
    }.getOrNull() ?: return 0

    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      if (event.eventType == NOTIFICATION_SEEN_EVENT_TYPE) {
        count++
      }
    }
    return count
  }

  private fun countAppLaunches(
    manager: UsageStatsManager,
    packageName: String,
    startTime: Long,
    endTime: Long
  ): Int {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return 0
    var count = 0
    val events = runCatching {
      manager.queryEvents(startTime, endTime)
    }.getOrNull() ?: return 0

    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      if (event.packageName.equals(packageName, ignoreCase = true) &&
        event.eventType == UsageEvents.Event.ACTIVITY_RESUMED
      ) {
        count++
      }
    }
    return count
  }

  private fun resolveAppLabel(packageName: String): String {
    return try {
      val applicationInfo = context.packageManager.getApplicationInfo(packageName, 0)
      context.packageManager.getApplicationLabel(applicationInfo).toString()
    } catch (_: Exception) {
      packageName
    }
  }

  private fun hasUsageAccess(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun startOfDayMs(): Long {
    return Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }.timeInMillis
  }

  private fun startOfWeekMs(): Long {
    return Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
      set(Calendar.DAY_OF_WEEK, firstDayOfWeek)
    }.timeInMillis
  }

  private fun formatDate(timestampMs: Long): String {
    val calendar = Calendar.getInstance().apply { timeInMillis = timestampMs }
    val year = calendar.get(Calendar.YEAR)
    val month = calendar.get(Calendar.MONTH) + 1
    val day = calendar.get(Calendar.DAY_OF_MONTH)
    return "%04d-%02d-%02d".format(year, month, day)
  }

  companion object {
    private const val DAY_MS = 24L * 60L * 60L * 1000L
    private const val NOTIFICATION_SEEN_EVENT_TYPE = 10
  }
}
