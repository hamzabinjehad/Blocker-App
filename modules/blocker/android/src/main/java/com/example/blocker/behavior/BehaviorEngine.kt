package com.example.blocker.behavior

import android.content.Context
import com.example.blocker.PolicyRepository

class BehaviorEngine(
  private val context: Context,
  private val repository: PolicyRepository
) {
  fun detectText(
    input: String,
    appName: String = "Manual test",
    packageName: String = context.packageName,
    screen: String = "Manual text check",
    source: String = "manual"
  ): Map<String, Any?>? {
    if (!repository.isBehaviorProtectionEnabled()) return null

    val match = KeywordMatcher.find(
      input,
      repository.customBlockedKeywords(),
      com.example.blocker.BlocklistStore.get(context).activeKeywords
    ) ?: return null

    val contextResult = ContextualKeywordMatcher.analyze(input, match.keyword)
    if (contextResult == MatchResult.EDUCATIONAL_CONTEXT) return null

    val event = BehaviorBlockEvent(
      keyword = match.keyword,
      keywordSource = match.source,
      appName = appName,
      packageName = packageName,
      screen = screen,
      source = source,
      reason = "keyword_match"
    )

    return TriggerManager.emit(context, repository, event)
  }

  fun registerScreenContext(app: String, screen: String): Map<String, Any?>? {
    repository.setCurrentScreenContext(app, screen)
    if (!repository.isBehaviorProtectionEnabled()) return null

    val feature = ScreenContextDetector.matchBlockedFeature(
      packageName = app,
      screenText = screen,
      featureBlocks = repository.featureBlockSettings()
    ) ?: return null

    return TriggerManager.emit(
      context,
      repository,
      BehaviorBlockEvent(
        keyword = feature.label,
        keywordSource = "feature",
        appName = feature.appName,
        packageName = app,
        screen = feature.screen,
        source = "screen_context",
        reason = "blocked_app_feature"
      )
    )
  }

  fun analyzeScreenContext(screenContext: ScreenContext): Map<String, Any?>? {
    repository.setCurrentScreenContext(screenContext.packageName, screenContext.screenType)
    val protectionSurfaceMonitoringActive =
      repository.isProtectionRequested() || repository.isUninstallLockWindowActive()

    if (protectionSurfaceMonitoringActive) {
      val protectedSurface = ScreenContextDetector.matchProtectedSettingsSurface(
        packageName = screenContext.packageName,
        screenText = "${screenContext.screenType} ${screenContext.visibleText}",
        ownPackageName = context.packageName,
        appLabels = ownAppLabels()
      )
      if (protectedSurface != null) {
        return TriggerManager.emit(
          context,
          repository,
          BehaviorBlockEvent(
            keyword = protectedSurface.label,
            keywordSource = "tamper",
            appName = protectedSurface.appName,
            packageName = screenContext.packageName,
            screen = protectedSurface.screen,
            source = screenContext.source,
            reason = "tamper"
          )
        )
      }
    }

    if (!repository.isBehaviorProtectionEnabled()) return null

    val usageLimitDecision = com.example.blocker.AppUsageLimiter(context, repository)
      .evaluate(screenContext.packageName, screenContext.appLabel)
    if (usageLimitDecision != null) {
      return TriggerManager.emit(
        context,
        repository,
        BehaviorBlockEvent(
          keyword = "${usageLimitDecision.usedMinutes}/${usageLimitDecision.limitMinutes} minutes",
          keywordSource = "usage_limit_${usageLimitDecision.source}",
          appName = screenContext.appLabel,
          packageName = screenContext.packageName,
          screen = screenContext.screenType,
          source = screenContext.source,
          reason = "usage_limit"
        )
      )
    }

    if (repository.shouldBlockPackageForFocus(context, screenContext.packageName)) {
      return TriggerManager.emit(
        context,
        repository,
        BehaviorBlockEvent(
          keyword = "Focus Mode",
          keywordSource = "focus",
          appName = screenContext.appLabel,
          packageName = screenContext.packageName,
          screen = screenContext.screenType,
          source = screenContext.source,
          reason = "focus_mode"
        )
      )
    }

    if (repository.shouldBlockPackageAsApp(screenContext.packageName, screenContext.appLabel)) {
      return TriggerManager.emit(
        context,
        repository,
        BehaviorBlockEvent(
          keyword = "Blocked app",
          keywordSource = "app",
          appName = screenContext.appLabel,
          packageName = screenContext.packageName,
          screen = screenContext.screenType,
          source = screenContext.source,
          reason = "blocked_app"
        )
      )
    }

    if (repository.isBlockPrivateBrowsersEnabled() && com.example.blocker.AppInventory.isPrivateBrowser(
        screenContext.packageName,
        screenContext.appLabel
      )
    ) {
      return TriggerManager.emit(
        context,
        repository,
        BehaviorBlockEvent(
          keyword = "Private browser",
          keywordSource = "app",
          appName = screenContext.appLabel,
          packageName = screenContext.packageName,
          screen = screenContext.screenType,
          source = screenContext.source,
          reason = "blocked_app"
        )
      )
    }

    if ((repository.isBlockVpnAppsEnabled() || repository.isBlockBypassToolsEnabled()) &&
      com.example.blocker.AppInventory.isBypassApp(screenContext.packageName, screenContext.appLabel)
    ) {
      return TriggerManager.emit(
        context,
        repository,
        BehaviorBlockEvent(
          keyword = "Bypass tool",
          keywordSource = "app",
          appName = screenContext.appLabel,
          packageName = screenContext.packageName,
          screen = screenContext.screenType,
          source = screenContext.source,
          reason = "blocked_app"
        )
      )
    }

    if (repository.isStrictModeEnabled()) {
      val tamperSurface = ScreenContextDetector.matchStrictTamperSurface(
        packageName = screenContext.packageName,
        screenText = "${screenContext.screenType} ${screenContext.visibleText}"
      )
      if (tamperSurface != null) {
        return TriggerManager.emit(
          context,
          repository,
          BehaviorBlockEvent(
            keyword = tamperSurface.label,
            keywordSource = "tamper",
            appName = tamperSurface.appName,
            packageName = screenContext.packageName,
            screen = tamperSurface.screen,
            source = screenContext.source,
            reason = "tamper"
          )
        )
      }
    }

    val feature = ScreenContextDetector.matchBlockedFeature(
      packageName = screenContext.packageName,
      screenText = "${screenContext.screenType} ${screenContext.visibleText}",
      featureBlocks = repository.featureBlockSettings()
    )
    if (feature != null) {
      return TriggerManager.emit(
        context,
        repository,
        BehaviorBlockEvent(
          keyword = feature.label,
          keywordSource = "feature",
          appName = screenContext.appLabel.ifBlank { feature.appName },
          packageName = screenContext.packageName,
          screen = feature.screen,
          source = screenContext.source,
          reason = "blocked_app_feature"
        )
      )
    }

    return detectText(
      input = screenContext.analyzableText,
      appName = screenContext.appLabel,
      packageName = screenContext.packageName,
      screen = screenContext.screenType,
      source = screenContext.source
    )
  }

  private fun ownAppLabels(): List<String> {
    val packageManager = context.packageManager
    val label = runCatching {
      val appInfo = packageManager.getApplicationInfo(context.packageName, 0)
      packageManager.getApplicationLabel(appInfo).toString()
    }.getOrNull()

    return listOfNotNull(label, "Control Yourself", "Parent Blocker", "Guardian")
  }
}
