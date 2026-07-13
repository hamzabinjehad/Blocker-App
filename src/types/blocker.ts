export type ProtectionStatus =
  | 'active'
  | 'inactive'
  | 'starting'
  | 'failed'
  | 'needs_vpn_permission'
  | 'tampered';

export type VpnRuntimeState = 'inactive' | 'starting' | 'active' | 'failed';

export type BlockAction = 'blocked' | 'warned' | 'unblock_requested';

export type BlockEvent = {
  id: string;
  eventType: 'BLOCK_EVENT';
  keyword: string;
  keywordSource: 'built_in' | 'custom' | 'feature' | 'manual' | string;
  appName: string;
  packageName: string;
  screen: string;
  source: string;
  reason:
    | 'keyword_match'
    | 'blocked_app_feature'
    | 'manual_keyword_trigger'
    | 'focus_mode'
    | 'blocked_app'
    | 'bypass_domain'
    | 'usage_limit'
    | 'sideloaded_apk'
    | string;
  action: BlockAction;
  timestamp: number;
};

export type FeatureBlockSettings = {
  instagramDm: boolean;
  instagramStories: boolean;
  instagramSearch: boolean;
  instagramExplore: boolean;
  instagramReels: boolean;
  tiktokShorts: boolean;
  tiktokSearch: boolean;
  youtubeSearch: boolean;
  youtubeShorts: boolean;
  youtubeComments: boolean;
  pictureInPicture: boolean;
  telegramSearch: boolean;
  telegramSearchHistory: boolean;
  telegramChannels: boolean;
  telegramGroups: boolean;
  telegramBlockedAccounts: boolean;
  snapchatQuickAdd: boolean;
  snapchatSearch: boolean;
  snapchatDiscover: boolean;
  snapchatStories: boolean;
  snapchatSpotlight: boolean;
  snapchatMaps: boolean;
  twitterEraseAll: boolean;
  twitterBlockApp: boolean;
  twitterSearchMediaTrends: boolean;
  twitterForYou: boolean;
  discordBlockApp: boolean;
  facebookBlockApp: boolean;
  facebookReels: boolean;
  facebookStories: boolean;
  facebookSearch: boolean;
  facebookGroups: boolean;
  redditSearch: boolean;
  redditSubreddits: boolean;
  pinterestSearch: boolean;
  liveStreamingApps: boolean;
  browserUnsafeModes: boolean;
  androidTamperSettings: boolean;
  playStoreUninstallControls: boolean;
  playStoreAdultInstallControls: boolean;
  packageInstallerControls: boolean;
};

export type BehaviorPolicy = {
  behaviorProtectionEnabled: boolean;
  behaviorBlockDurationSeconds: number;
  behaviorBlockRequiresPin: boolean;
  behaviorDisableCooldownDays: number;
  customKeywords: string[];
  customKeywordCount: number;
  builtInKeywordCount: number;
  featureBlocks: FeatureBlockSettings;
  textContextEngine: {
    enabled: boolean;
    mode: string;
    safeContextBypass: boolean;
    riskSignals: string[];
    privacyMode: string;
  };
  currentContext: {
    app: string;
    screen: string;
    timestamp: number;
  };
};

export type ManagedDeviceStatus = {
  deviceAdminActive: boolean;
  deviceOwner: boolean;
  profileOwner: boolean;
  canBlockUninstall: boolean;
  basicUninstallProtectionActive: boolean;
  uninstallBlocked: boolean;
  uninstallProtectionLevel: 'none' | 'device_admin' | 'managed_owner';
  uninstallLockActive: boolean;
  uninstallLockStartedAt?: number | null;
  uninstallLockExpiresAt?: number | null;
  uninstallLockRemainingMs: number;
  uninstallLockDurationDays: number;
  canConfigurePrivateDns: boolean;
  privateDnsMode?: number | null;
  privateDnsHost?: string | null;
  privateDnsProtection?: PrivateDnsProtectionStatus;
  requiresManagedEnrollment: boolean;
};

export type PrivateDnsProtectionResult = {
  applied: boolean;
  reason?: string | null;
  privateDnsProtectionStatus: PrivateDnsProtectionStatus;
};

/** No-VPN filtering: Device-Owner-locked family Private DNS. */
export type PrivateDnsProtectionStatus = {
  /** Device owner + Android 9+ — the locked no-VPN mode can be applied. */
  supported: boolean;
  /** The user's stored preference for this mode. */
  enabled: boolean;
  /** The system resolver is currently pinned to a family-safe host. */
  active: boolean;
  /** DISALLOW_CONFIG_PRIVATE_DNS is held, so it can't be changed in Settings. */
  locked: boolean;
  host?: string | null;
  mode?: number | null;
  defaultHost: string;
};

export type PrivateDnsStatus = {
  supported: boolean;
  mode?: string | null;
  configuredHost?: string | null;
  activeHost?: string | null;
  recommendedHost: string;
};

export type VpnPolicyStatus = {
  /** Stored intent. Routing is driven by `routesAllIpv4Traffic`, never by this. */
  fullTunnelVpnEnabled: boolean;
  /** False while the tunnel is a DNS filter with no packet forwarder. */
  fullTunnelSupported?: boolean;
  /** Lockdown strands every unrouted destination, so it needs full-tunnel routing. */
  alwaysOnVpnLockdownSupported?: boolean;
  effectiveTunnelMode: 'dns_only' | 'full_tunnel' | string;
  routesAllIpv4Traffic: boolean;
  routesAllIpv6Traffic: boolean;
  /** Stored intent. The guard is only real when `routesAllIpv6Traffic` is true. */
  ipv6LeakPreventionEnabled: boolean;
  perAppVpnFilteringEnabled: boolean;
  allowedPackages: string[];
  excludedPackages: string[];
  filteredPackageCount: number;
  systemBypassPackages: string[];
  reconnectOnBootEnabled: boolean;
  reconnectOnPackageReplaceEnabled: boolean;
  localProxyPort: number;
};

export type HttpsInspectionStatus = {
  supported: boolean;
  enabled: boolean;
  privacyAcknowledged: boolean;
  localProxyConfigured: boolean;
  localProxyPort: number;
  connectHostFilteringActive: boolean;
  rootCaInstalled: boolean;
  contentInspectionActive: boolean;
  warning: string;
  limitations: string[];
};

export type MediaScanningStatus = {
  supported: boolean;
  enabled: boolean;
  imageScanningActive: boolean;
  videoThumbnailBlockingActive: boolean;
  scanner: string;
  classifierMode: string;
  cloudFallbackEnabled: boolean;
  cloudFallbackConfigured: boolean;
  cloudFallbackMode: string;
  blockThreshold: number;
  ambiguityThreshold: number;
  scanTargetPackageCount: number;
  galleryScanSupported: boolean;
  galleryScanPermissionGranted: boolean;
  galleryScanLastAt: number;
  galleryScanLastScannedCount: number;
  galleryScanFlaggedCount: number;
  galleryScanLastFlaggedAt: number;
  galleryScanMode: string;
  galleryScanRetainsImages: boolean;
  limitations: string[];
};

export type GalleryScanResult = {
  scannedCount: number;
  flaggedCount: number;
  reason: string;
  galleryScanSupported: boolean;
  galleryScanPermissionGranted: boolean;
  galleryScanLastAt: number;
  galleryScanLastScannedCount: number;
  galleryScanFlaggedCount: number;
  galleryScanLastFlaggedAt: number;
  galleryScanMode: string;
  galleryScanRetainsImages: boolean;
};

export type ScreenshotAuditPolicy = {
  enabled: boolean;
  intervalMinutes: number;
  retainsImages: boolean;
  localAiReview: boolean;
  partnerReviewAvailable: boolean;
  limitations: string[];
};

export type IntegrityStatus = {
  lastStatus?: string | null;
  lastMessage?: string | null;
  lastCheckedAt: number;
  signatureBaselineStored: boolean;
  serverVerificationRequired: boolean;
  playIntegrityTokenRequested: boolean;
  localSignatureBaselineStored: boolean;
  localSignatureTamperSignal?: string | null;
};

export type AnomalySignal = {
  id: string;
  severity: string;
  detected: boolean;
  subject: string;
  recommendation: string;
  count: number;
};

export type AnomalyDetectionStatus = {
  enabled: boolean;
  windowHours: number;
  riskLevel: 'normal' | 'high' | 'critical' | string;
  detectedCount: number;
  signals: AnomalySignal[];
};

export type ManagedEnforcementStatus = {
  managedOwner: boolean;
  canSetAlwaysOnVpn: boolean;
  alwaysOnVpnPackage?: string | null;
  alwaysOnVpnLockdownEnabled: boolean;
  alwaysOnVpnLockdownRequested: boolean;
  canSuspendPackages: boolean;
  packageSuspensionEnabled: boolean;
  emergencyLockEnabled: boolean;
  strictModeEnabled: boolean;
  suspendedPackageCount: number;
};

export type DeviceOwnerPolicyStatus = {
  managedOwner: boolean;
  strictModeEnabled: boolean;
  emergencyLockEnabled: boolean;
  requiredRestrictions: string[];
  appliedRestrictions: string[];
  missingRestrictions: string[];
  failedRestrictions: string[];
  canApplyStrictPolicy: boolean;
  canBlockNetworkWithoutVpn: boolean;
  alwaysOnVpnPackage?: string | null;
  alwaysOnVpnLockdownApplied: boolean;
  uninstallBlocked: boolean;
};

export type InstalledApp = {
  packageName: string;
  label: string;
  systemApp: boolean;
  enabled: boolean;
  riskRuleId?: string | null;
  riskCategory?: string | null;
  riskSeverity?: string | null;
  riskAction?: string | null;
};

export type FocusSchedule = {
  id: string;
  label: string;
  enabled: boolean;
  startMinutes: number;
  endMinutes: number;
  daysOfWeek: number[];
};

export type FocusPolicy = {
  strictModeEnabled: boolean;
  focusModeEnabled: boolean;
  packageSuspensionEnabled: boolean;
  schedules: FocusSchedule[];
  allowedPackages: string[];
  blockedPackages: string[];
};

export type FocusState = {
  active: boolean;
  strictModeActive: boolean;
  activeScheduleId?: string | null;
  allowedPackages: string[];
  blockedPackages: string[];
  suspendedPackages: string[];
  suspendedPackageCount: number;
};

export type UsageLimitAppSnapshot = {
  packageName: string;
  appLabel: string;
  category: string;
  limitMinutes: number;
  usedMinutes: number;
  source: 'app' | 'category' | string;
};

export type UsageLimitPolicy = {
  enabled: boolean;
  appLimits: Record<string, number>;
  categoryLimits: Record<string, number>;
  trackedApps: UsageLimitAppSnapshot[];
};

export type VpnPrepareResult = {
  granted: boolean;
  needsPermission: boolean;
};

export type ProtectionStatusResult = {
  status: ProtectionStatus;
  vpnActive: boolean;
  tampered: boolean;
  protectionRequested?: boolean;
  vpnRuntimeState?: VpnRuntimeState;
  vpnStartFailure?: string | null;
  vpnStartupRemainingMs?: number;
  vpnPermissionGranted?: boolean;
  pinConfigured?: boolean;
  blockedDomainCount?: number;
  blockedDomains?: string[];
  allowlistedDomains?: string[];
  bypassDomainCount?: number;
  lastBlocklistUpdate?: string;
  accessibilityServiceEnabled?: boolean;
  overlayPermissionGranted?: boolean;
  usageAccessStatus?: UsageAccessStatus;
  batteryOptimizationStatus?: BatteryOptimizationStatus;
  strictModeEnabled?: boolean;
  tamperReport?: TamperSignal[];
  behaviorPolicy?: BehaviorPolicy;
  focusPolicy?: FocusPolicy;
  focusState?: FocusState;
  usageLimitPolicy?: UsageLimitPolicy;
  vpnPolicyStatus?: VpnPolicyStatus;
  httpsInspectionStatus?: HttpsInspectionStatus;
  mediaScanningStatus?: MediaScanningStatus;
  screenshotAuditPolicy?: ScreenshotAuditPolicy;
  anomalyDetectionStatus?: AnomalyDetectionStatus;
  safeSearchSettings?: SafeSearchSettings;
  safeSearchStatus?: SafeSearchStatus;
  riskySettings?: RiskySettings;
  privateDnsStatus?: PrivateDnsStatus;
  managedDeviceStatus?: ManagedDeviceStatus;
  managedEnforcementStatus?: ManagedEnforcementStatus;
  deviceOwnerPolicyStatus?: DeviceOwnerPolicyStatus;
  guardianAlertCount?: number;
  auditEventCount?: number;
  integrityStatus?: IntegrityStatus;
  safeModeBoot?: boolean;
  notificationFilterStatus?: NotificationFilterStatus;
  workProfileStatus?: WorkProfileStatus;
};

export type UsageAccessStatus = {
  granted: boolean;
  mode?: number | string | null;
};

export type BatteryOptimizationStatus = {
  supported: boolean;
  ignored: boolean;
};

export type GuardianAlert = {
  id: string;
  eventType: string;
  severity: string;
  subject: string;
  action: string;
  timestamp: number;
  cleared: boolean;
  metadata?: string | null;
};

export type OverlayHideResult = {
  hidden: boolean;
  reason?: string | null;
};

export type TamperSignal = {
  id: string;
  severity: string;
  detected: boolean;
  subject: string;
  recommendation: string;
};

export type NativeStartStopResult = {
  status: ProtectionStatus | 'pin_required' | 'pin_locked_out' | 'time_locked' | 'unlock_countdown_active';
  vpnActive?: boolean;
  vpnStartFailure?: string | null;
  unlocksAt?: number | null;
  remainingMs?: number | null;
};

export type BlocklistImportResult = {
  submitted: number;
  accepted: number;
  imported: number;
  ignored: number;
  blockedDomainCount?: number;
};

export type SafeSearchSettings = {
  googleSafeSearch: boolean;
  bingSafeSearch: boolean;
  duckDuckGoSafeSearch: boolean;
  youtubeRestrictedMode: boolean;
  blockUnknownSearchEngines: boolean;
};

export type SafeSearchStatus = {
  google: boolean;
  bing: boolean;
  duckduckgo: boolean;
  youtube: boolean;
};

export type RiskySettings = {
  blockVpnApps: boolean;
  blockPrivateBrowsers: boolean;
  blockBypassTools: boolean;
  blockSideloadedApps: boolean;
};

export type PolicyUpdate = Partial<SafeSearchSettings & RiskySettings & FeatureBlockSettings> & {
  adultFilteringEnabled?: boolean;
  strictModeEnabled?: boolean;
  fullTunnelVpnEnabled?: boolean;
  perAppVpnFilteringEnabled?: boolean;
  ipv6LeakPreventionEnabled?: boolean;
  behaviorProtectionEnabled?: boolean;
  behaviorBlockDurationSeconds?: number;
  behaviorBlockRequiresPin?: boolean;
  behaviorDisableCooldownDays?: number;
  imageScanningEnabled?: boolean;
  cloudImageFallbackEnabled?: boolean;
  cloudImageFallbackEndpoint?: string;
  screenshotAuditEnabled?: boolean;
  screenshotAuditIntervalMinutes?: number;
  notificationFilteringEnabled?: boolean;
  blockedSiteNotificationsEnabled?: boolean;
  adminPin?: string;
  currentPin?: string;
  newPin?: string;
};

export type FocusPolicyUpdate = Partial<FocusPolicy> & {
  adminPin?: string;
  currentPin?: string;
};

export type UsageLimitPolicyUpdate = {
  enabled?: boolean;
  appLimits?: Record<string, number>;
  categoryLimits?: Record<string, number>;
  adminPin?: string;
  currentPin?: string;
};

export type VpnPolicyUpdate = {
  fullTunnelVpnEnabled?: boolean;
  perAppVpnFilteringEnabled?: boolean;
  ipv6LeakPreventionEnabled?: boolean;
  vpnAllowedPackages?: string[];
  vpnExcludedPackages?: string[];
  adminPin?: string;
  currentPin?: string;
};

export type EnforcementUpdateResult = {
  applied: boolean;
  reason?: string;
  failedPackages?: string[];
  focusState?: FocusState;
  managedEnforcementStatus: ManagedEnforcementStatus;
};

export type FocusPolicyUpdateResult = {
  focusPolicy: FocusPolicy;
  focusState: FocusState;
  managedEnforcementStatus?: ManagedEnforcementStatus;
  failedPackages?: string[];
};

export type VpnPolicyUpdateResult = {
  vpnPolicyStatus: VpnPolicyStatus;
  httpsInspectionStatus: HttpsInspectionStatus;
};

export type HttpsInspectionUpdateResult = {
  applied: boolean;
  reason?: string | null;
  httpsInspectionStatus: HttpsInspectionStatus;
};

export type NotificationFilterStatus = {
  enabled: boolean;
  listenerConnected: boolean;
  monitoredPackageCount: number;
  monitoredPackages: string[];
};

export type WorkProfileStatus = {
  workProfileSupported: boolean;
  deviceOwner: boolean;
  profileOwner: boolean;
  managedOwner: boolean;
  provisioningAvailable: boolean;
  enrollmentMethod: string;
  managedProfileActive: boolean;
  restrictions: string[];
};

export type DailyUsageSummary = {
  available: boolean;
  reason?: string;
  date?: string;
  totalScreenTimeMinutes?: number;
  totalScreenTimeMs?: number;
  appCount?: number;
  unlockCount?: number;
  notificationCount?: number;
  topApps?: Array<{
    packageName: string;
    appLabel: string;
    foregroundTimeMinutes: number;
    lastUsed: number;
  }>;
  categoryBreakdown?: Array<{
    category: string;
    totalTimeMinutes: number;
  }>;
};

export type WeeklyUsageSummary = {
  available: boolean;
  reason?: string;
  weekStartDate?: string;
  totalScreenTimeMinutes?: number;
  averageDailyScreenTimeMinutes?: number;
  dailyBreakdown?: Array<{
    date: string;
    totalScreenTimeMinutes: number;
  }>;
};

export type AppUsageDetail = {
  available: boolean;
  reason?: string;
  packageName?: string;
  appLabel?: string;
  foregroundTimeMinutes?: number;
  foregroundTimeMs?: number;
  lastUsed?: number;
  launchCount?: number;
  category?: string;
  limitMinutes?: number;
  limitSource?: string;
  usedMinutes?: number;
  limitExceeded?: boolean;
};

export type BlockerNativeModule = {
  addListener?(eventName: 'onBlockEvent', listener: (event: BlockEvent) => void): { remove: () => void };
  prepareVpn(): Promise<VpnPrepareResult>;
  startProtection(durationDays?: number): Promise<NativeStartStopResult>;
  stopProtection(pin: string): Promise<NativeStartStopResult>;
  getStatus(): Promise<ProtectionStatusResult>;
  getSafeSearchStatus(): Promise<SafeSearchStatus>;
  setImageScanningEnabled(
    enabled: boolean,
    sensitivity: 'conservative' | 'standard' | 'strict' | string,
  ): Promise<{ enabled: boolean; sensitivity: string; threshold: number }>;
  getImageScanStats(): Promise<{ detections: number }>;
  canDrawOverlays(): Promise<{ granted: boolean }>;
  openOverlaySettings(): Promise<void>;
  showBlockOverlayForTest(reason: string): Promise<void>;
  hideBlockOverlay(pin?: string): Promise<OverlayHideResult>;
  getLaunchableApps(): Promise<InstalledApp[]>;
  addBlockedDomain(domain: string, pin?: string): Promise<void>;
  removeBlockedDomain(domain: string, pin?: string): Promise<void>;
  importBlockedDomains(domains: string[], pin?: string): Promise<BlocklistImportResult>;
  addAllowlistedDomain(domain: string, pin?: string): Promise<void>;
  removeAllowlistedDomain(domain: string, pin?: string): Promise<void>;
  updatePolicy(policy: PolicyUpdate): Promise<void>;
  requestGalleryScanPermission(): Promise<{
    requested: boolean;
    alreadyGranted: boolean;
    mediaScanningStatus: Partial<MediaScanningStatus>;
  }>;
  scanGalleryForExplicitContent(limit?: number): Promise<GalleryScanResult>;
  updateFocusPolicy(policy: FocusPolicyUpdate): Promise<FocusPolicyUpdateResult>;
  updateUsageLimitPolicy(policy: UsageLimitPolicyUpdate): Promise<UsageLimitPolicy>;
  getUsageLimitPolicy(): Promise<UsageLimitPolicy>;
  updateVpnPolicy(policy: VpnPolicyUpdate): Promise<VpnPolicyUpdateResult>;
  setHttpsInspectionEnabled(
    enabled: boolean,
    privacyAcknowledged: boolean,
    pin?: string,
  ): Promise<HttpsInspectionUpdateResult>;
  getFocusState(): Promise<FocusState>;
  detectText(input: string): Promise<BlockEvent | null>;
  registerScreenContext(app: string, screen: string): Promise<BlockEvent | null>;
  onKeywordTriggered(event: Partial<BlockEvent>): Promise<BlockEvent>;
  updateKeywordList(keywords: string[], pin: string): Promise<void>;
  verifyParentPin(pin: string): Promise<{ verified: boolean }>;
  openAccessibilitySettings(): Promise<void>;
  openVpnSettings(): Promise<void>;
  requestDeviceAdminPermission(): Promise<{ permissionRequested: boolean; managedDeviceStatus: ManagedDeviceStatus }>;
  setUninstallProtectionEnabled(
    enabled: boolean,
    pin?: string,
    durationDays?: number,
  ): Promise<{ applied: boolean; reason?: string; managedDeviceStatus: ManagedDeviceStatus }>;
  setStrictModeEnabled(enabled: boolean, pin?: string): Promise<{ applied: boolean; strictModeEnabled: boolean; managedEnforcementStatus?: ManagedEnforcementStatus; tamperReport?: TamperSignal[] }>;
  applyStrictDeviceOwnerPolicy(pin?: string): Promise<{ applied: boolean; reason?: string; failedPolicies?: string[]; deviceOwnerPolicyStatus: DeviceOwnerPolicyStatus; managedEnforcementStatus: ManagedEnforcementStatus }>;
  getTamperReport(): Promise<TamperSignal[]>;
  getAuditEvents(): Promise<Record<string, unknown>[]>;
  // Optional: absent on native builds older than the aggregated recently-blocked API.
  getRecentBlockedDomains?(limit: number): Promise<RecentBlockedDomain[]>;
  getGuardianAlerts(): Promise<GuardianAlert[]>;
  clearGuardianAlert(alertId: string): Promise<void>;
  getAppRuleSnapshot(): Promise<Record<string, unknown>[]>;
  setAlwaysOnVpnLockdown(enabled: boolean, pin?: string): Promise<EnforcementUpdateResult>;
  setPackageSuspensionEnabled(enabled: boolean, pin?: string): Promise<EnforcementUpdateResult>;
  setEmergencyLockEnabled(enabled: boolean, pin?: string): Promise<EnforcementUpdateResult>;
  configureManagedPrivateDns(hostname: string): Promise<{ applied: boolean; reason?: string; managedDeviceStatus: ManagedDeviceStatus }>;
  enablePrivateDnsProtection(hostname: string | null, pin?: string): Promise<PrivateDnsProtectionResult>;
  disablePrivateDnsProtection(pin?: string): Promise<PrivateDnsProtectionResult>;
  copyTextToClipboard(label: string, text: string): Promise<{ copied: boolean }>;
  openPrivateDnsSettings(): Promise<{ opened: boolean; target?: string | null }>;
  openBatteryOptimizationSettings(): Promise<void>;
  requestIgnoreBatteryOptimizations(): Promise<BatteryOptimizationStatus>;
  getBatteryOptimizationStatus(): Promise<BatteryOptimizationStatus>;
  getUsageAccessStatus(): Promise<UsageAccessStatus>;
  openUsageAccessSettings(): Promise<void>;
  setNotificationFilteringEnabled(enabled: boolean, pin?: string): Promise<NotificationFilterStatus>;
  getNotificationFilterStatus(): Promise<NotificationFilterStatus>;
  openNotificationListenerSettings(): Promise<void>;
  getWorkProfileStatus(): Promise<WorkProfileStatus>;
  provisionWorkProfile(): Promise<{ started: boolean; reason?: string | null }>;
  onWorkProfileProvisioningComplete(): Promise<{ success: boolean; reason?: string | null; workProfileStatus?: WorkProfileStatus }>;
  removeWorkProfile(pin?: string): Promise<{ removed: boolean; reason?: string | null }>;
  applyCorporatePolicy(pin?: string): Promise<{ applied: boolean; failedPolicies?: string[]; workProfileStatus?: WorkProfileStatus }>;
  getDailyUsageSummary(): Promise<DailyUsageSummary>;
  getWeeklyUsageSummary(): Promise<WeeklyUsageSummary>;
  getAppUsageDetail(packageName: string): Promise<AppUsageDetail>;
  getAppIcon(packageName: string): Promise<{ iconBase64: string | null }>;
  testDnsFiltering(): Promise<DnsFilterTestResult>;
};

export type DnsDomainResult = {
  domain: string;
  blocked: boolean;
  addresses: string[];
  error?: string;
};

export type DnsFilterTestResult = {
  vpnActive: boolean;
  safeDomainsReachable: boolean;
  adultDomainsBlocked: boolean;
  safeResults: DnsDomainResult[];
  adultResults: DnsDomainResult[];
  timestamp: number;
};

// ── Remote Management ──────────────────────────────────────────────────

export type RemoteDeviceRole = 'admin' | 'child';

export type RemoteDevice = {
  id: string;
  name: string;
  role: RemoteDeviceRole;
  pairedAt: number;
  lastSeen: number;
  online: boolean;
};

export type RemoteSession = {
  paired: boolean;
  pairingCode: string | null;
  pairingCodeExpiresAt: number;
  devices: RemoteDevice[];
  pendingRequests: UnlockRequest[];
};

export type UnlockRequest = {
  id: string;
  deviceId: string;
  deviceName: string;
  reason: string;
  requestedAt: number;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  durationMinutes: number;
  respondedAt?: number | null;
};

export type RemoteCommand = {
  id: string;
  type: 'update_rules' | 'approve_unlock' | 'deny_unlock' | 'sync_status' | 'lock_now';
  payload: Record<string, unknown>;
  sentAt: number;
  acknowledgedAt?: number | null;
};

// ── Strictness / Schedule Profiles ─────────────────────────────────────

export type StrictnessLevel = 'off' | 'low' | 'moderate' | 'high' | 'lockdown';

export type ScheduleProfile = {
  id: string;
  label: string;
  icon: string;
  strictness: StrictnessLevel;
  enabled: boolean;
  startMinutes: number;
  endMinutes: number;
  daysOfWeek: number[];
  overrides: StrictnessOverrides;
};

export type StrictnessOverrides = {
  adultFilteringEnabled?: boolean;
  safeSearchEnforced?: boolean;
  socialMediaBlocked?: boolean;
  appSuspensionEnabled?: boolean;
  behaviorProtectionEnabled?: boolean;
  focusModeEnabled?: boolean;
  customBlockedApps?: string[];
  customAllowedApps?: string[];
};

export type ActiveScheduleState = {
  activeProfileId: string | null;
  activeProfileLabel: string | null;
  currentStrictness: StrictnessLevel;
  nextTransitionAt: number | null;
  nextProfileLabel: string | null;
  manualOverrideActive: boolean;
  manualOverrideExpiresAt: number | null;
};

// ── Emergency Unlock ───────────────────────────────────────────────────

export type EmergencyPasscode = {
  id: string;
  code: string;
  createdAt: number;
  expiresAt: number;
  durationMinutes: number;
  used: boolean;
  usedAt?: number | null;
  revokedAt?: number | null;
};

export type EmergencyUnlockState = {
  active: boolean;
  activePasscodeId: string | null;
  expiresAt: number | null;
  remainingSeconds: number;
  history: EmergencyPasscode[];
};

// ── Multi-Profile ──────────────────────────────────────────────────────

export type ProfileType = 'child' | 'teen' | 'adult';

export type UserProfile = {
  id: string;
  name: string;
  type: ProfileType;
  avatarColor: string;
  createdAt: number;
  isActive: boolean;
  strictnessPreset: StrictnessLevel;
  settings: ProfileSettings;
};

export type ProfileSettings = {
  adultFilteringEnabled: boolean;
  safeSearchEnforced: boolean;
  behaviorProtectionEnabled: boolean;
  socialMediaRestricted: boolean;
  appSuspensionEnabled: boolean;
  maxDailyScreenTimeMinutes: number | null;
  bedtimeStart: number | null;
  bedtimeEnd: number | null;
  allowedApps: string[];
  blockedApps: string[];
  customBlockedDomains: string[];
  customAllowedDomains: string[];
};

export const PROFILE_PRESETS: Record<ProfileType, { strictness: StrictnessLevel; settings: ProfileSettings }> = {
  child: {
    strictness: 'lockdown',
    settings: {
      adultFilteringEnabled: true,
      safeSearchEnforced: true,
      behaviorProtectionEnabled: true,
      socialMediaRestricted: true,
      appSuspensionEnabled: true,
      maxDailyScreenTimeMinutes: 120,
      bedtimeStart: 20 * 60,
      bedtimeEnd: 7 * 60,
      allowedApps: [],
      blockedApps: [],
      customBlockedDomains: [],
      customAllowedDomains: [],
    },
  },
  teen: {
    strictness: 'high',
    settings: {
      adultFilteringEnabled: true,
      safeSearchEnforced: true,
      behaviorProtectionEnabled: true,
      socialMediaRestricted: false,
      appSuspensionEnabled: false,
      maxDailyScreenTimeMinutes: 240,
      bedtimeStart: 22 * 60,
      bedtimeEnd: 6 * 60,
      allowedApps: [],
      blockedApps: [],
      customBlockedDomains: [],
      customAllowedDomains: [],
    },
  },
  adult: {
    strictness: 'moderate',
    settings: {
      adultFilteringEnabled: true,
      safeSearchEnforced: false,
      behaviorProtectionEnabled: true,
      socialMediaRestricted: false,
      appSuspensionEnabled: false,
      maxDailyScreenTimeMinutes: null,
      bedtimeStart: null,
      bedtimeEnd: null,
      allowedApps: [],
      blockedApps: [],
      customBlockedDomains: [],
      customAllowedDomains: [],
    },
  },
};

// ── Alert & Notification System ────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type ViolationAlert = {
  id: string;
  severity: AlertSeverity;
  type: 'domain_blocked' | 'keyword_detected' | 'app_blocked' | 'tamper_attempt' | 'vpn_disconnected' | 'bypass_attempt' | 'unlock_request';
  title: string;
  description: string;
  app?: string | null;
  domain?: string | null;
  timestamp: number;
  read: boolean;
  notified: boolean;
};

export type AlertPreferences = {
  enabled: boolean;
  notifyOnBlock: boolean;
  notifyOnTamper: boolean;
  notifyOnBypass: boolean;
  notifyOnUnlockRequest: boolean;
  minSeverity: AlertSeverity;
  quietHoursEnabled: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  dailyDigestEnabled: boolean;
  dailyDigestHour: number;
};

// ── Blocklist Manager ──────────────────────────────────────────────────

export type BlocklistEntry = {
  domain: string;
  source: 'manual' | 'imported' | 'bundled';
  addedAt: number;
  note?: string;
};

export type AllowlistEntry = {
  domain: string;
  source: 'manual' | 'imported';
  addedAt: number;
  reason?: string;
};

export type BlocklistCategory = 'adult' | 'gambling' | 'social_media' | 'gaming' | 'bypass' | 'custom';

// A domain that was recently blocked, aggregated from the audit log for the
// "recently blocked → allow" review flow.
export type RecentBlockedDomain = {
  domain: string;
  category: string;
  lastBlockedAt: number;
  count: number;
};
