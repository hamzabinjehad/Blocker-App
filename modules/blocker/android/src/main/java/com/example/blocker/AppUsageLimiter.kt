package com.example.blocker

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.Process
import java.util.Calendar

data class UsageLimitDecision(
  val packageName: String,
  val appLabel: String,
  val category: String,
  val limitMinutes: Int,
  val usedMinutes: Int,
  val source: String
) {
  fun toMap(): Map<String, Any?> = mapOf(
    "packageName" to packageName,
    "appLabel" to appLabel,
    "category" to category,
    "limitMinutes" to limitMinutes,
    "usedMinutes" to usedMinutes,
    "source" to source
  )
}

class AppUsageLimiter(
  private val context: Context,
  private val repository: PolicyRepository
) {
  fun evaluate(packageName: String, appLabel: String): UsageLimitDecision? {
    if (!repository.isUsageLimitsEnabled() || !hasUsageAccess()) return null
    val rule = limitFor(packageName, appLabel) ?: return null
    val usedMinutes = usageMinutesToday(packageName)
    if (usedMinutes < rule.limitMinutes) return null

    return UsageLimitDecision(
      packageName = packageName.lowercase(),
      appLabel = appLabel,
      category = rule.category,
      limitMinutes = rule.limitMinutes,
      usedMinutes = usedMinutes,
      source = rule.source
    )
  }

  fun trackedAppSnapshots(): List<Map<String, Any?>> {
    val appLimits = repository.appUsageLimitMinutes()
    val categoryLimits = repository.categoryUsageLimitMinutes()
    if (appLimits.isEmpty() && categoryLimits.isEmpty()) return emptyList()

    return AppInventory.launchableApps(context)
      .mapNotNull { app ->
        val rule = limitFor(app.packageName, app.label) ?: return@mapNotNull null
        mapOf(
          "packageName" to app.packageName,
          "appLabel" to app.label,
          "category" to rule.category,
          "limitMinutes" to rule.limitMinutes,
          "usedMinutes" to if (hasUsageAccess()) usageMinutesToday(app.packageName) else 0,
          "source" to rule.source
        )
      }
      .sortedWith(compareBy<Map<String, Any?>> { it["category"] as? String ?: "" }.thenBy { it["appLabel"] as? String ?: "" })
  }

  private fun limitFor(packageName: String, appLabel: String): UsageRule? {
    val normalizedPackage = packageName.trim().lowercase()
    if (normalizedPackage.isBlank()) return null

    val rule = AppRuleEngine.matchPackage(context, normalizedPackage, appLabel)
    val category = rule?.category ?: "uncategorized"
    val appLimit = repository.appUsageLimitMinutes()[normalizedPackage]
    val categoryLimit = repository.categoryUsageLimitMinutes()[category]

    return when {
      appLimit != null && categoryLimit != null ->
        if (appLimit <= categoryLimit) {
          UsageRule(category, appLimit, "app")
        } else {
          UsageRule(category, categoryLimit, "category")
        }
      appLimit != null -> UsageRule(category, appLimit, "app")
      categoryLimit != null -> UsageRule(category, categoryLimit, "category")
      else -> null
    }
  }

  private fun usageMinutesToday(packageName: String): Int {
    val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val now = System.currentTimeMillis()
    val calendar = Calendar.getInstance().apply {
      timeInMillis = now
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }

    val totalMs = runCatching {
      usageStatsManager
        .queryUsageStats(UsageStatsManager.INTERVAL_DAILY, calendar.timeInMillis, now)
        .filter { it.packageName.equals(packageName, ignoreCase = true) }
        .sumOf { it.totalTimeInForeground }
    }.getOrDefault(0L)

    return Math.ceil(totalMs / 60000.0).toInt()
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

  private data class UsageRule(
    val category: String,
    val limitMinutes: Int,
    val source: String
  )
}
