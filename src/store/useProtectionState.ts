import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import BlockerModule from '@/native/BlockerModule';
import type {
  AnomalyDetectionStatus,
  BehaviorPolicy,
  BatteryOptimizationStatus,
  BlocklistImportResult,
  BlockEvent,
  FeatureBlockSettings,
  FocusPolicy,
  FocusPolicyUpdate,
  FocusState,
  GuardianAlert,
  HttpsInspectionStatus,
  InstalledApp,
  IntegrityStatus,
  MediaScanningStatus,
  ManagedEnforcementStatus,
  ManagedDeviceStatus,
  PolicyUpdate,
  PrivateDnsStatus,
  ProtectionStatus,
  RiskySettings,
  SafeSearchSettings,
  ScreenshotAuditPolicy,
  TamperSignal,
  UsageLimitAppSnapshot,
  UsageLimitPolicy,
  UsageLimitPolicyUpdate,
  UsageAccessStatus,
  VpnPolicyStatus,
  VpnPolicyUpdate,
} from '@/types/blocker';

const initialSafeSearchSettings: SafeSearchSettings = {
  googleSafeSearch: true,
  bingSafeSearch: true,
  duckDuckGoSafeSearch: true,
  youtubeRestrictedMode: true,
  blockUnknownSearchEngines: true,
};

const initialRiskySettings: RiskySettings = {
  blockVpnApps: true,
  blockPrivateBrowsers: true,
  blockBypassTools: true,
  blockSideloadedApps: true,
};

const initialFeatureBlocks: FeatureBlockSettings = {
  instagramDm: false,
  instagramStories: false,
  instagramSearch: false,
  instagramExplore: false,
  instagramReels: false,
  tiktokShorts: false,
  tiktokSearch: false,
  youtubeSearch: true,
  youtubeShorts: true,
  youtubeComments: true,
  pictureInPicture: true,
  telegramSearch: false,
  telegramSearchHistory: false,
  telegramChannels: false,
  telegramGroups: false,
  telegramBlockedAccounts: false,
  snapchatQuickAdd: false,
  snapchatSearch: false,
  snapchatDiscover: false,
  snapchatStories: false,
  snapchatSpotlight: false,
  snapchatMaps: false,
  twitterEraseAll: false,
  twitterBlockApp: false,
  twitterSearchMediaTrends: false,
  twitterForYou: false,
  discordBlockApp: false,
  facebookBlockApp: false,
  facebookReels: false,
  facebookStories: false,
  facebookSearch: false,
  facebookGroups: false,
  redditSearch: false,
  redditSubreddits: false,
  pinterestSearch: false,
  liveStreamingApps: false,
  browserUnsafeModes: true,
  androidTamperSettings: false,
  playStoreUninstallControls: false,
  playStoreAdultInstallControls: true,
  packageInstallerControls: false,
};

const initialBehaviorPolicy: BehaviorPolicy = {
  behaviorProtectionEnabled: true,
  behaviorBlockDurationSeconds: 12,
  behaviorBlockRequiresPin: true,
  behaviorDisableCooldownDays: 7,
  customKeywords: [],
  customKeywordCount: 0,
  builtInKeywordCount: 0,
  featureBlocks: initialFeatureBlocks,
  textContextEngine: {
    enabled: true,
    mode: 'weighted_local_context',
    safeContextBypass: true,
    riskSignals: ['intent', 'media_request', 'adult_platform'],
    privacyMode: 'on_device_text_only',
  },
  currentContext: {
    app: '',
    screen: '',
    timestamp: 0,
  },
};

const initialManagedDeviceStatus: ManagedDeviceStatus = {
  deviceAdminActive: false,
  deviceOwner: false,
  profileOwner: false,
  canBlockUninstall: false,
  basicUninstallProtectionActive: false,
  uninstallBlocked: false,
  uninstallProtectionLevel: 'none',
  uninstallLockActive: false,
  uninstallLockStartedAt: null,
  uninstallLockExpiresAt: null,
  uninstallLockRemainingMs: 0,
  uninstallLockDurationDays: 30,
  canConfigurePrivateDns: false,
  privateDnsMode: null,
  privateDnsHost: null,
  requiresManagedEnrollment: true,
};

const initialPrivateDnsStatus: PrivateDnsStatus = {
  supported: false,
  mode: null,
  configuredHost: null,
  activeHost: null,
  recommendedHost: 'family.cloudflare-dns.com',
};

const initialVpnPolicyStatus: VpnPolicyStatus = {
  fullTunnelVpnEnabled: true,
  effectiveTunnelMode: 'dns_only',
  routesAllIpv4Traffic: false,
  routesAllIpv6Traffic: false,
  ipv6LeakPreventionEnabled: true,
  perAppVpnFilteringEnabled: true,
  allowedPackages: [],
  excludedPackages: [],
  filteredPackageCount: 0,
  systemBypassPackages: [],
  reconnectOnBootEnabled: true,
  reconnectOnPackageReplaceEnabled: true,
  localProxyPort: 8891,
};

const initialHttpsInspectionStatus: HttpsInspectionStatus = {
  supported: false,
  enabled: false,
  privacyAcknowledged: false,
  localProxyConfigured: false,
  localProxyPort: 8891,
  connectHostFilteringActive: false,
  rootCaInstalled: false,
  contentInspectionActive: false,
  warning:
    'HTTPS inspection can expose sensitive browsing data to this app. Enable it only with informed guardian consent.',
  limitations: [],
};

const initialMediaScanningStatus: MediaScanningStatus = {
  supported: false,
  enabled: true,
  imageScanningActive: false,
  videoThumbnailBlockingActive: false,
  scanner: 'google_mlkit_image_labeling',
  classifierMode: 'on_device_weighted_labels',
  cloudFallbackEnabled: false,
  cloudFallbackConfigured: false,
  cloudFallbackMode: 'ambiguous_label_metadata_only',
  blockThreshold: 0.72,
  ambiguityThreshold: 0.38,
  scanTargetPackageCount: 0,
  limitations: [],
};

const initialScreenshotAuditPolicy: ScreenshotAuditPolicy = {
  enabled: false,
  intervalMinutes: 15,
  retainsImages: false,
  localAiReview: true,
  partnerReviewAvailable: false,
  limitations: [],
};

const initialIntegrityStatus: IntegrityStatus = {
  lastStatus: 'not_run',
  lastMessage: '',
  lastCheckedAt: 0,
  signatureBaselineStored: false,
  serverVerificationRequired: true,
  playIntegrityTokenRequested: false,
  localSignatureBaselineStored: false,
  localSignatureTamperSignal: 'app_signature_mismatch',
};

const initialAnomalyDetectionStatus: AnomalyDetectionStatus = {
  enabled: true,
  windowHours: 24,
  riskLevel: 'normal',
  detectedCount: 0,
  signals: [],
};

const initialManagedEnforcementStatus: ManagedEnforcementStatus = {
  managedOwner: false,
  canSetAlwaysOnVpn: false,
  alwaysOnVpnPackage: null,
  alwaysOnVpnLockdownEnabled: false,
  alwaysOnVpnLockdownRequested: false,
  canSuspendPackages: false,
  packageSuspensionEnabled: false,
  emergencyLockEnabled: false,
  strictModeEnabled: false,
  suspendedPackageCount: 0,
};

const initialUsageAccessStatus: UsageAccessStatus = {
  granted: false,
  mode: null,
};

const initialBatteryOptimizationStatus: BatteryOptimizationStatus = {
  supported: true,
  ignored: false,
};

const initialFocusPolicy: FocusPolicy = {
  strictModeEnabled: false,
  focusModeEnabled: false,
  packageSuspensionEnabled: false,
  schedules: [
    {
      id: 'daily-night-focus',
      label: 'Daily night focus',
      enabled: true,
      startMinutes: 22 * 60,
      endMinutes: 6 * 60,
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    },
  ],
  allowedPackages: [],
  blockedPackages: [],
};

const initialFocusState: FocusState = {
  active: false,
  strictModeActive: false,
  activeScheduleId: null,
  allowedPackages: [],
  blockedPackages: [],
  suspendedPackages: [],
  suspendedPackageCount: 0,
};

const initialUsageLimitPolicy: UsageLimitPolicy = {
  enabled: false,
  appLimits: {},
  categoryLimits: {},
  trackedApps: [],
};

const bundledSampleCount = 5;
const deviceOwnerEnrollmentCommand =
  'adb shell dpm set-device-owner com.example.parentblocker/com.example.blocker.BlockerDeviceAdminReceiver';

export function useProtectionState() {
  const [status, setStatus] = useState<ProtectionStatus>('inactive');
  const [vpnActive, setVpnActive] = useState(false);
  const [vpnPermissionGranted, setVpnPermissionGranted] = useState(false);
  const [tampered, setTampered] = useState(false);
  const [overlayPermissionGranted, setOverlayPermissionGranted] = useState(false);
  const [strictModeEnabled, setStrictModeEnabledState] = useState(false);
  const [tamperReport, setTamperReport] = useState<TamperSignal[]>([]);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [adultFilteringEnabled, setAdultFilteringEnabled] = useState(true);
  const [blockedDomainCount, setBlockedDomainCount] = useState(bundledSampleCount);
  const [lastBlocklistUpdate, setLastBlocklistUpdate] = useState('Bundled development sample');
  const [safeSearchSettings, setSafeSearchSettings] = useState(initialSafeSearchSettings);
  const [riskySettings, setRiskySettings] = useState(initialRiskySettings);
  const [behaviorPolicy, setBehaviorPolicy] = useState<BehaviorPolicy>(initialBehaviorPolicy);
  const [accessibilityServiceEnabled, setAccessibilityServiceEnabled] = useState(false);
  const [usageAccessStatus, setUsageAccessStatus] = useState<UsageAccessStatus>(initialUsageAccessStatus);
  const [batteryOptimizationStatus, setBatteryOptimizationStatus] = useState<BatteryOptimizationStatus>(
    initialBatteryOptimizationStatus,
  );
  const [activeBlockEvent, setActiveBlockEvent] = useState<BlockEvent | undefined>();
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [allowlistedDomains, setAllowlistedDomains] = useState<string[]>([]);
  const [privateDnsStatus, setPrivateDnsStatus] = useState<PrivateDnsStatus>(initialPrivateDnsStatus);
  const [vpnPolicyStatus, setVpnPolicyStatus] = useState<VpnPolicyStatus>(initialVpnPolicyStatus);
  const [httpsInspectionStatus, setHttpsInspectionStatus] = useState<HttpsInspectionStatus>(
    initialHttpsInspectionStatus,
  );
  const [mediaScanningStatus, setMediaScanningStatus] = useState<MediaScanningStatus>(initialMediaScanningStatus);
  const [screenshotAuditPolicy, setScreenshotAuditPolicy] = useState<ScreenshotAuditPolicy>(
    initialScreenshotAuditPolicy,
  );
  const [integrityStatus, setIntegrityStatus] = useState<IntegrityStatus>(initialIntegrityStatus);
  const [safeModeBoot, setSafeModeBoot] = useState(false);
  const [auditEventCount, setAuditEventCount] = useState(0);
  const [guardianAlertCount, setGuardianAlertCount] = useState(0);
  const [guardianAlerts, setGuardianAlerts] = useState<GuardianAlert[]>([]);
  const [anomalyDetectionStatus, setAnomalyDetectionStatus] = useState<AnomalyDetectionStatus>(
    initialAnomalyDetectionStatus,
  );
  const [managedDeviceStatus, setManagedDeviceStatus] = useState<ManagedDeviceStatus>(initialManagedDeviceStatus);
  const [managedEnforcementStatus, setManagedEnforcementStatus] = useState<ManagedEnforcementStatus>(
    initialManagedEnforcementStatus,
  );
  const [focusPolicy, setFocusPolicy] = useState<FocusPolicy>(initialFocusPolicy);
  const [focusState, setFocusState] = useState<FocusState>(initialFocusState);
  const [usageLimitPolicy, setUsageLimitPolicy] = useState<UsageLimitPolicy>(initialUsageLimitPolicy);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const refreshStatus = useCallback(async (showRefreshing = true) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const result = await BlockerModule.getStatus();
      setStatus(result.status);
      setVpnActive(result.vpnActive);
      setTampered(result.tampered);
      setVpnPermissionGranted(Boolean(result.vpnPermissionGranted));
      setPinConfigured(Boolean(result.pinConfigured));
      const customBlockedDomains = normalizeDomainList(result.blockedDomains);
      const customAllowlistedDomains = normalizeDomainList(result.allowlistedDomains);
      setBlockedDomains(customBlockedDomains);
      setAllowlistedDomains(customAllowlistedDomains);
      setBlockedDomainCount(result.blockedDomainCount ?? bundledSampleCount + customBlockedDomains.length);
      setLastBlocklistUpdate(result.lastBlocklistUpdate ?? 'Bundled development sample');
      if (result.safeSearchSettings) {
        setSafeSearchSettings(normalizeSafeSearchSettings(result.safeSearchSettings));
      }
      if (result.riskySettings) {
        setRiskySettings(normalizeRiskySettings(result.riskySettings));
      }
      setAccessibilityServiceEnabled(Boolean(result.accessibilityServiceEnabled));
      setUsageAccessStatus(normalizeUsageAccessStatus(result.usageAccessStatus));
      setBatteryOptimizationStatus(normalizeBatteryOptimizationStatus(result.batteryOptimizationStatus));
      setOverlayPermissionGranted(Boolean(result.overlayPermissionGranted));
      setStrictModeEnabledState(Boolean(result.strictModeEnabled));
      setTamperReport(Array.isArray(result.tamperReport) ? result.tamperReport.map(normalizeTamperSignal) : []);
      if (result.behaviorPolicy) {
        setBehaviorPolicy(normalizeBehaviorPolicy(result.behaviorPolicy));
      }
      if (result.managedDeviceStatus) {
        setManagedDeviceStatus(normalizeManagedDeviceStatus(result.managedDeviceStatus));
      }
      if (result.managedEnforcementStatus) {
        setManagedEnforcementStatus(normalizeManagedEnforcementStatus(result.managedEnforcementStatus));
      }
      if (result.focusPolicy) {
        setFocusPolicy(normalizeFocusPolicy(result.focusPolicy));
      }
      if (result.focusState) {
        setFocusState(normalizeFocusState(result.focusState));
      }
      if (result.usageLimitPolicy) {
        setUsageLimitPolicy(normalizeUsageLimitPolicy(result.usageLimitPolicy));
      }
      if (result.privateDnsStatus) {
        setPrivateDnsStatus(normalizePrivateDnsStatus(result.privateDnsStatus));
      }
      if (result.vpnPolicyStatus) {
        setVpnPolicyStatus(normalizeVpnPolicyStatus(result.vpnPolicyStatus));
      }
      if (result.httpsInspectionStatus) {
        setHttpsInspectionStatus(normalizeHttpsInspectionStatus(result.httpsInspectionStatus));
      }
      if (result.mediaScanningStatus) {
        setMediaScanningStatus(normalizeMediaScanningStatus(result.mediaScanningStatus));
      }
      if (result.screenshotAuditPolicy) {
        setScreenshotAuditPolicy(normalizeScreenshotAuditPolicy(result.screenshotAuditPolicy));
      }
      if (result.integrityStatus) {
        setIntegrityStatus(normalizeIntegrityStatus(result.integrityStatus));
      }
      setSafeModeBoot(Boolean(result.safeModeBoot));
      setAuditEventCount(Number(result.auditEventCount ?? 0));
      setGuardianAlertCount(Number(result.guardianAlertCount ?? 0));
      const alerts = await BlockerModule.getGuardianAlerts();
      const normalizedAlerts = alerts.map(normalizeGuardianAlert);
      setGuardianAlerts(normalizedAlerts);
      setGuardianAlertCount(normalizedAlerts.filter((alert) => !alert.cleared).length);
      if (result.anomalyDetectionStatus) {
        setAnomalyDetectionStatus(normalizeAnomalyDetectionStatus(result.anomalyDetectionStatus));
      }
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to read protection status.');
    } finally {
      if (showRefreshing) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus(false);
  }, [refreshStatus]);

  const refreshInstalledApps = useCallback(async () => {
    try {
      const apps = await BlockerModule.getLaunchableApps();
      setInstalledApps(apps.map(normalizeInstalledApp));
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load installed apps.');
    }
  }, []);

  useEffect(() => {
    void refreshInstalledApps();
  }, [refreshInstalledApps]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshStatus(false);
      }
    });

    return () => subscription.remove();
  }, [refreshStatus]);

  useEffect(() => {
    const subscription = BlockerModule.addListener?.('onBlockEvent', (event) => {
      const blockEvent = normalizeBlockEvent(event);
      setActiveBlockEvent(blockEvent);
    });

    return () => subscription?.remove();
  }, []);

  const prepareVpn = useCallback(async () => {
    setLoading(true);
    try {
      const result = await BlockerModule.prepareVpn();
      setVpnPermissionGranted(result.granted);
      setStatus(result.needsPermission ? 'needs_vpn_permission' : 'inactive');
      setError(result.needsPermission ? 'Approve the Android VPN dialog, then start protection again.' : undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to request VPN permission.');
    } finally {
      setLoading(false);
    }
  }, []);

  const startProtection = useCallback(async () => {
    setLoading(true);
    try {
      const permission = await BlockerModule.prepareVpn();
      if (permission.needsPermission) {
        setVpnPermissionGranted(false);
        setStatus('needs_vpn_permission');
        setError('Approve the Android VPN dialog, then tap Start Protection again.');
        return;
      }

      const result = await BlockerModule.startProtection();
      setStatus(result.status === 'pin_required' ? 'inactive' : result.status);
      setVpnActive(result.status === 'active');
      setTampered(result.status === 'tampered');
      setError(undefined);
      await refreshStatus(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start protection.');
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  const stopProtection = useCallback(
    async (pin: string) => {
      setLoading(true);
      try {
        const result = await BlockerModule.stopProtection(pin);
        if (result.status === 'pin_required') {
          setError('Parent PIN is required or incorrect.');
          return;
        }
        setStatus(result.status);
        setVpnActive(false);
        setTampered(false);
        setError(undefined);
        await refreshStatus(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to stop protection.');
      } finally {
        setLoading(false);
      }
    },
    [refreshStatus],
  );

  const requirePinForClientSideChange = (pin?: string) => {
    if (pinConfigured && !pin?.trim()) {
      setError('Parent PIN is required for this setting.');
      return false;
    }
    return true;
  };

  const addBlockedDomain = useCallback(
    async (domain: string, pin?: string) => {
      if (!requirePinForClientSideChange(pin)) return false;
      const normalized = normalizeDomain(domain);
      if (!normalized) {
        setError('Enter a valid domain before adding a rule.');
        return false;
      }
      try {
        await BlockerModule.addBlockedDomain(normalized, pin ?? '');
        setBlockedDomains((current) => [...new Set([...current, normalized])]);
        setBlockedDomainCount((current) => (blockedDomains.includes(normalized) ? current : current + 1));
        setError(undefined);
        await refreshStatus(false);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to add blocked domain.');
        return false;
      }
    },
    [blockedDomains, pinConfigured, refreshStatus],
  );

  const removeBlockedDomain = useCallback(
    async (domain: string, pin?: string) => {
      if (!requirePinForClientSideChange(pin)) return false;
      const normalized = normalizeDomain(domain);
      if (!normalized) return false;
      try {
        await BlockerModule.removeBlockedDomain(normalized, pin ?? '');
        setBlockedDomains((current) => current.filter((item) => item !== normalized));
        setBlockedDomainCount((current) => Math.max(bundledSampleCount, current - 1));
        setError(undefined);
        await refreshStatus(false);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to remove blocked domain.');
        return false;
      }
    },
    [pinConfigured, refreshStatus],
  );

  const importBlockedDomains = useCallback(
    async (domains: string[], pin?: string): Promise<BlocklistImportResult | undefined> => {
      if (!requirePinForClientSideChange(pin)) return undefined;
      const normalized = normalizeDomainList(domains);
      if (normalized.length === 0) {
        setError('No valid domains were found in that import file.');
        return undefined;
      }

      try {
        const result = await BlockerModule.importBlockedDomains(normalized, pin ?? '');
        setBlockedDomains((current) => [...new Set([...current, ...normalized])].sort());
        if (typeof result.blockedDomainCount === 'number') {
          setBlockedDomainCount(result.blockedDomainCount);
        }
        setError(undefined);
        await refreshStatus(false);
        return result;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to import blocked domains.');
        return undefined;
      }
    },
    [pinConfigured, refreshStatus],
  );

  const addAllowlistedDomain = useCallback(
    async (domain: string, pin?: string) => {
      if (!requirePinForClientSideChange(pin)) return false;
      const normalized = normalizeDomain(domain);
      if (!normalized) {
        setError('Enter a valid domain before adding a rule.');
        return false;
      }
      try {
        await BlockerModule.addAllowlistedDomain(normalized, pin ?? '');
        setAllowlistedDomains((current) => [...new Set([...current, normalized])]);
        setError(undefined);
        await refreshStatus(false);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to add allowlisted domain.');
        return false;
      }
    },
    [pinConfigured, refreshStatus],
  );

  const removeAllowlistedDomain = useCallback(
    async (domain: string, pin?: string) => {
      if (!requirePinForClientSideChange(pin)) return false;
      const normalized = normalizeDomain(domain);
      if (!normalized) return false;
      try {
        await BlockerModule.removeAllowlistedDomain(normalized, pin ?? '');
        setAllowlistedDomains((current) => current.filter((item) => item !== normalized));
        setError(undefined);
        await refreshStatus(false);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to remove allowlisted domain.');
        return false;
      }
    },
    [pinConfigured, refreshStatus],
  );

  const updatePolicy = useCallback(async (policy: PolicyUpdate) => {
    try {
      await BlockerModule.updatePolicy(policy);
      if (typeof policy.adultFilteringEnabled === 'boolean') {
        setAdultFilteringEnabled(policy.adultFilteringEnabled);
      }
      setSafeSearchSettings((current) => ({ ...current, ...pickSafeSearch(policy) }));
      setRiskySettings((current) => ({ ...current, ...pickRisky(policy) }));
      const behaviorPatch = pickBehavior(policy);
      setBehaviorPolicy((current) =>
        normalizeBehaviorPolicy({
          ...current,
          ...behaviorPatch,
          featureBlocks: {
            ...current.featureBlocks,
            ...behaviorPatch.featureBlocks,
          },
        }),
      );
      const screenshotPatch = pickScreenshotAudit(policy);
      if (Object.keys(screenshotPatch).length > 0) {
        setScreenshotAuditPolicy((current) => normalizeScreenshotAuditPolicy({ ...current, ...screenshotPatch }));
      }
      setError(undefined);
      await refreshStatus(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update policy.');
    }
  }, [refreshStatus]);

  const updateScreenshotAuditPolicy = useCallback(
    async (enabled: boolean, intervalMinutes: number, pin?: string) => {
      const normalizedInterval = Math.min(240, Math.max(1, Math.round(Number(intervalMinutes) || 15)));
      await updatePolicy({
        screenshotAuditEnabled: enabled,
        screenshotAuditIntervalMinutes: normalizedInterval,
        adminPin: pin ?? '',
      });
    },
    [updatePolicy],
  );

  const refreshGuardianAlerts = useCallback(async () => {
    try {
      const alerts = await BlockerModule.getGuardianAlerts();
      const normalizedAlerts = alerts.map(normalizeGuardianAlert);
      setGuardianAlerts(normalizedAlerts);
      setGuardianAlertCount(normalizedAlerts.filter((alert) => !alert.cleared).length);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load guardian alerts.');
    }
  }, []);

  const clearGuardianAlert = useCallback(
    async (alertId: string) => {
      try {
        await BlockerModule.clearGuardianAlert(alertId);
        await refreshGuardianAlerts();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to clear guardian alert.');
      }
    },
    [refreshGuardianAlerts],
  );

  const exportAuditEventsToClipboard = useCallback(async () => {
    try {
      const events = await BlockerModule.getAuditEvents();
      setAuditEventCount(events.length);
      const payload = {
        exportedAt: new Date().toISOString(),
        eventCount: events.length,
        events,
      };
      const result = await BlockerModule.copyTextToClipboard('Parent Blocker audit log', JSON.stringify(payload, null, 2));
      setError(result.copied ? undefined : 'Unable to copy audit log.');
      return Boolean(result.copied);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to export audit log.');
      return false;
    }
  }, []);

  const setParentPin = useCallback(
    async (newPin: string, currentPin?: string) => {
      setLoading(true);
      try {
        await BlockerModule.updatePolicy({ newPin, currentPin });
        setPinConfigured(true);
        setError(undefined);
        await refreshStatus(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to update parent PIN.');
      } finally {
        setLoading(false);
      }
    },
    [refreshStatus],
  );

  const updateKeywordList = useCallback(
    async (keywords: string[], pin?: string) => {
      if (pinConfigured && !pin?.trim()) {
        setError('Parent PIN is required for keyword changes.');
        return;
      }

      try {
        const normalized = [...new Set(keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean))];
        await BlockerModule.updateKeywordList(normalized, pin ?? '');
        setBehaviorPolicy((current) => ({
          ...current,
          customKeywords: normalized,
          customKeywordCount: normalized.length,
        }));
        setError(undefined);
        await refreshStatus(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to update custom keywords.');
      }
    },
    [pinConfigured],
  );

  const detectText = useCallback(async (input: string) => {
    try {
      const event = await BlockerModule.detectText(input);
      if (event) {
        const blockEvent = normalizeBlockEvent(event);
        setActiveBlockEvent(blockEvent);
      }
      setError(event ? undefined : 'No blocked keyword was detected in the test input.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to test keyword detection.');
    }
  }, []);

  const registerScreenContext = useCallback(async (app: string, screen: string) => {
    try {
      const event = await BlockerModule.registerScreenContext(app, screen);
      if (event) {
        const blockEvent = normalizeBlockEvent(event);
        setActiveBlockEvent(blockEvent);
      }
      await refreshStatus(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to register screen context.');
    }
  }, [refreshStatus]);

  const dismissBlockEvent = useCallback(
    async (pin?: string) => {
      if (!activeBlockEvent) return;
      if (pinConfigured && behaviorPolicy.behaviorBlockRequiresPin) {
        const result = await BlockerModule.verifyParentPin(pin ?? '');
        if (!result.verified) {
          setError('Parent PIN is required to dismiss this block.');
          return;
        }
      }
      setActiveBlockEvent(undefined);
      setError(undefined);
    },
    [activeBlockEvent, behaviorPolicy.behaviorBlockRequiresPin, pinConfigured],
  );

  const openAccessibilitySettings = useCallback(async () => {
    try {
      await BlockerModule.openAccessibilitySettings();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open Android Accessibility settings.');
    }
  }, []);

  const requestDeviceAdminPermission = useCallback(async () => {
    try {
      const result = await BlockerModule.requestDeviceAdminPermission();
      setManagedDeviceStatus(normalizeManagedDeviceStatus(result.managedDeviceStatus));
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to request device admin permission.');
    }
  }, []);

  const setUninstallProtectionEnabled = useCallback(async (enabled: boolean, pin?: string, durationDays?: number) => {
    try {
      const result = await BlockerModule.setUninstallProtectionEnabled(enabled, pin ?? '', durationDays);
      setManagedDeviceStatus(normalizeManagedDeviceStatus(result.managedDeviceStatus));
      setError(result.applied ? undefined : managedPolicyReason(result.reason));
      await refreshStatus(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update uninstall protection.');
    }
  }, [refreshStatus]);

  const configureManagedPrivateDns = useCallback(async (hostname: string) => {
    try {
      const result = await BlockerModule.configureManagedPrivateDns(hostname);
      setManagedDeviceStatus(normalizeManagedDeviceStatus(result.managedDeviceStatus));
      setError(result.applied ? undefined : managedPolicyReason(result.reason));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update managed Private DNS.');
    }
  }, []);

  const openPrivateDnsSettings = useCallback(async () => {
    try {
      await BlockerModule.openPrivateDnsSettings();
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open Android network settings.');
    }
  }, []);

  const copyPrivateDnsHostname = useCallback(async () => {
    try {
      const result = await BlockerModule.copyTextToClipboard('Private DNS hostname', privateDnsStatus.recommendedHost);
      setError(undefined);
      return Boolean(result.copied);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to copy Private DNS hostname.');
      return false;
    }
  }, [privateDnsStatus.recommendedHost]);

  const copyDeviceOwnerEnrollmentCommand = useCallback(async () => {
    try {
      const result = await BlockerModule.copyTextToClipboard('Device Owner enrollment command', deviceOwnerEnrollmentCommand);
      setError(result.copied ? undefined : 'Unable to copy Device Owner enrollment command.');
      return Boolean(result.copied);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to copy Device Owner enrollment command.');
      return false;
    }
  }, []);

  const updateFocusPolicy = useCallback(
    async (policy: FocusPolicyUpdate) => {
      try {
        const result = await BlockerModule.updateFocusPolicy(policy);
        setFocusPolicy(normalizeFocusPolicy(result.focusPolicy));
        setFocusState(normalizeFocusState(result.focusState));
        if (result.managedEnforcementStatus) {
          setManagedEnforcementStatus(normalizeManagedEnforcementStatus(result.managedEnforcementStatus));
        }
        setError(undefined);
        await refreshStatus(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to update Focus Mode policy.');
      }
    },
    [refreshStatus],
  );

  const updateUsageLimitPolicy = useCallback(
    async (policy: UsageLimitPolicyUpdate) => {
      try {
        const result = await BlockerModule.updateUsageLimitPolicy(policy);
        setUsageLimitPolicy(normalizeUsageLimitPolicy(result));
        setError(undefined);
        await refreshStatus(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to update app usage limits.');
      }
    },
    [refreshStatus],
  );

  const updateVpnPolicy = useCallback(
    async (policy: VpnPolicyUpdate) => {
      try {
        const result = await BlockerModule.updateVpnPolicy(policy);
        setVpnPolicyStatus(normalizeVpnPolicyStatus(result.vpnPolicyStatus));
        setHttpsInspectionStatus(normalizeHttpsInspectionStatus(result.httpsInspectionStatus));
        setError(undefined);
        await refreshStatus(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to update VPN routing policy.');
      }
    },
    [refreshStatus],
  );

  const setHttpsInspectionEnabled = useCallback(
    async (enabled: boolean, privacyAcknowledged = false, pin?: string) => {
      try {
        const result = await BlockerModule.setHttpsInspectionEnabled(enabled, privacyAcknowledged, pin ?? '');
        setHttpsInspectionStatus(normalizeHttpsInspectionStatus(result.httpsInspectionStatus));
        setError(result.applied ? undefined : managedPolicyReason(result.reason ?? undefined));
        await refreshStatus(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to update HTTPS inspection.');
      }
    },
    [refreshStatus],
  );

  const setAlwaysOnVpnLockdown = useCallback(async (enabled: boolean, pin?: string) => {
    try {
      const result = await BlockerModule.setAlwaysOnVpnLockdown(enabled, pin ?? '');
      setManagedEnforcementStatus(normalizeManagedEnforcementStatus(result.managedEnforcementStatus));
      setError(result.applied ? undefined : managedPolicyReason(result.reason));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update always-on VPN lockdown.');
    }
  }, []);

  const setPackageSuspensionEnabled = useCallback(async (enabled: boolean, pin?: string) => {
    try {
      const result = await BlockerModule.setPackageSuspensionEnabled(enabled, pin ?? '');
      setManagedEnforcementStatus(normalizeManagedEnforcementStatus(result.managedEnforcementStatus));
      if (result.focusState) {
        setFocusState(normalizeFocusState(result.focusState));
      }
      setError(result.applied ? undefined : managedPolicyReason(result.reason));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update package suspension.');
    }
  }, []);

  const setEmergencyLockEnabled = useCallback(
    async (enabled: boolean, pin?: string) => {
      try {
        const result = await BlockerModule.setEmergencyLockEnabled(enabled, pin ?? '');
        setManagedEnforcementStatus(normalizeManagedEnforcementStatus(result.managedEnforcementStatus));
        if (result.focusState) {
          setFocusState(normalizeFocusState(result.focusState));
        }
        setError(result.applied ? undefined : managedPolicyReason(result.reason));
        await refreshStatus(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to update emergency lock.');
      }
    },
    [refreshStatus],
  );

  const openBatteryOptimizationSettings = useCallback(async () => {
    try {
      await BlockerModule.openBatteryOptimizationSettings();
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open battery optimization settings.');
    }
  }, []);

  const requestIgnoreBatteryOptimizations = useCallback(async () => {
    try {
      const result = await BlockerModule.requestIgnoreBatteryOptimizations();
      setBatteryOptimizationStatus(normalizeBatteryOptimizationStatus(result));
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to request battery optimization exception.');
    }
  }, []);

  const openUsageAccessSettings = useCallback(async () => {
    try {
      await BlockerModule.openUsageAccessSettings();
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open usage access settings.');
    }
  }, []);

  const openOverlaySettings = useCallback(async () => {
    try {
      await BlockerModule.openOverlaySettings();
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open overlay permission settings.');
    }
  }, []);

  const applyStrictDeviceOwnerPolicy = useCallback(async (pin?: string) => {
    try {
      const result = await BlockerModule.applyStrictDeviceOwnerPolicy(pin ?? '');
      if (result.managedEnforcementStatus) {
        setManagedEnforcementStatus(normalizeManagedEnforcementStatus(result.managedEnforcementStatus));
      }
      setStrictModeEnabledState(Boolean(result.deviceOwnerPolicyStatus?.strictModeEnabled));
      setError(result.applied ? undefined : managedPolicyReason(result.reason));
      await refreshStatus(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to apply Strict Mode device-owner policy.');
    }
  }, [refreshStatus]);

  const setStrictModeEnabled = useCallback(async (enabled: boolean, pin?: string) => {
    try {
      const result = await BlockerModule.setStrictModeEnabled(enabled, pin ?? '');
      setStrictModeEnabledState(result.strictModeEnabled);
      if (result.managedEnforcementStatus) {
        setManagedEnforcementStatus(normalizeManagedEnforcementStatus(result.managedEnforcementStatus));
      }
      if (result.tamperReport) {
        setTamperReport(result.tamperReport.map(normalizeTamperSignal));
      }
      setError(undefined);
      await refreshStatus(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update Strict Mode.');
    }
  }, [refreshStatus]);

  return {
    status,
    vpnActive,
    vpnPermissionGranted,
    tampered,
    overlayPermissionGranted,
    strictModeEnabled,
    tamperReport,
    pinConfigured,
    adultFilteringEnabled,
    blockedDomainCount,
    lastBlocklistUpdate,
    safeSearchSettings,
    riskySettings,
    behaviorPolicy,
    accessibilityServiceEnabled,
    usageAccessStatus,
    batteryOptimizationStatus,
    activeBlockEvent,
    blockedDomains,
    allowlistedDomains,
    privateDnsStatus,
    vpnPolicyStatus,
    httpsInspectionStatus,
    mediaScanningStatus,
    screenshotAuditPolicy,
    integrityStatus,
    safeModeBoot,
    auditEventCount,
    guardianAlertCount,
    guardianAlerts,
    anomalyDetectionStatus,
    managedDeviceStatus,
    managedEnforcementStatus,
    focusPolicy,
    focusState,
    usageLimitPolicy,
    installedApps,
    loading,
    refreshing,
    error,
    refreshStatus,
    prepareVpn,
    startProtection,
    stopProtection,
    addBlockedDomain,
    removeBlockedDomain,
    importBlockedDomains,
    addAllowlistedDomain,
    removeAllowlistedDomain,
    updatePolicy,
    updateScreenshotAuditPolicy,
    refreshGuardianAlerts,
    clearGuardianAlert,
    exportAuditEventsToClipboard,
    setParentPin,
    updateKeywordList,
    detectText,
    registerScreenContext,
    dismissBlockEvent,
    openAccessibilitySettings,
    requestDeviceAdminPermission,
    setUninstallProtectionEnabled,
    configureManagedPrivateDns,
    openPrivateDnsSettings,
    copyPrivateDnsHostname,
    copyDeviceOwnerEnrollmentCommand,
    updateFocusPolicy,
    updateUsageLimitPolicy,
    updateVpnPolicy,
    setHttpsInspectionEnabled,
    refreshInstalledApps,
    setAlwaysOnVpnLockdown,
    setPackageSuspensionEnabled,
    setEmergencyLockEnabled,
    openBatteryOptimizationSettings,
    requestIgnoreBatteryOptimizations,
    openUsageAccessSettings,
    openOverlaySettings,
    applyStrictDeviceOwnerPolicy,
    setStrictModeEnabled,
  };
}

function pickSafeSearch(policy: PolicyUpdate): Partial<SafeSearchSettings> {
  const patch = {
    ...(typeof policy.googleSafeSearch === 'boolean' ? { googleSafeSearch: policy.googleSafeSearch } : {}),
    ...(typeof policy.bingSafeSearch === 'boolean' ? { bingSafeSearch: policy.bingSafeSearch } : {}),
    ...(typeof policy.duckDuckGoSafeSearch === 'boolean'
      ? { duckDuckGoSafeSearch: policy.duckDuckGoSafeSearch }
      : {}),
    ...(typeof policy.youtubeRestrictedMode === 'boolean'
      ? { youtubeRestrictedMode: policy.youtubeRestrictedMode }
      : {}),
    ...(typeof policy.blockUnknownSearchEngines === 'boolean'
      ? { blockUnknownSearchEngines: policy.blockUnknownSearchEngines }
      : {}),
  };
  return Object.keys(patch).length > 0 ? normalizeSafeSearchSettings(patch) : {};
}

function normalizeSafeSearchSettings(settings: Partial<SafeSearchSettings>): SafeSearchSettings {
  return {
    ...initialSafeSearchSettings,
    ...settings,
    googleSafeSearch: true,
    bingSafeSearch: true,
    duckDuckGoSafeSearch: true,
    youtubeRestrictedMode: true,
    blockUnknownSearchEngines: true,
  };
}

function normalizeRiskySettings(settings: Partial<RiskySettings>): RiskySettings {
  return {
    ...initialRiskySettings,
    ...settings,
  };
}

function pickRisky(policy: PolicyUpdate): Partial<RiskySettings> {
  return {
    ...(typeof policy.blockVpnApps === 'boolean' ? { blockVpnApps: policy.blockVpnApps } : {}),
    ...(typeof policy.blockPrivateBrowsers === 'boolean' ? { blockPrivateBrowsers: policy.blockPrivateBrowsers } : {}),
    ...(typeof policy.blockBypassTools === 'boolean' ? { blockBypassTools: policy.blockBypassTools } : {}),
    ...(typeof policy.blockSideloadedApps === 'boolean' ? { blockSideloadedApps: policy.blockSideloadedApps } : {}),
  };
}

type BehaviorPolicyPatch = Omit<Partial<BehaviorPolicy>, 'featureBlocks'> & {
  featureBlocks?: Partial<FeatureBlockSettings>;
};

function pickBehavior(policy: PolicyUpdate): BehaviorPolicyPatch {
  const featureBlocks = pickFeatureBlocks(policy);
  return {
    ...(typeof policy.behaviorProtectionEnabled === 'boolean'
      ? { behaviorProtectionEnabled: policy.behaviorProtectionEnabled }
      : {}),
    ...(typeof policy.behaviorBlockDurationSeconds === 'number'
      ? { behaviorBlockDurationSeconds: policy.behaviorBlockDurationSeconds }
      : {}),
    ...(typeof policy.behaviorBlockRequiresPin === 'boolean'
      ? { behaviorBlockRequiresPin: policy.behaviorBlockRequiresPin }
      : {}),
    ...(typeof policy.behaviorDisableCooldownDays === 'number'
      ? { behaviorDisableCooldownDays: policy.behaviorDisableCooldownDays }
      : {}),
    ...(Object.keys(featureBlocks).length > 0 ? { featureBlocks } : {}),
  };
}

function pickScreenshotAudit(policy: PolicyUpdate): Partial<ScreenshotAuditPolicy> {
  return {
    ...(typeof policy.screenshotAuditEnabled === 'boolean' ? { enabled: policy.screenshotAuditEnabled } : {}),
    ...(typeof policy.screenshotAuditIntervalMinutes === 'number'
      ? { intervalMinutes: policy.screenshotAuditIntervalMinutes }
      : {}),
  };
}

function pickFeatureBlocks(policy: PolicyUpdate): Partial<FeatureBlockSettings> {
  return {
    ...(typeof policy.instagramDm === 'boolean' ? { instagramDm: policy.instagramDm } : {}),
    ...(typeof policy.instagramStories === 'boolean' ? { instagramStories: policy.instagramStories } : {}),
    ...(typeof policy.instagramSearch === 'boolean' ? { instagramSearch: policy.instagramSearch } : {}),
    ...(typeof policy.instagramExplore === 'boolean' ? { instagramExplore: policy.instagramExplore } : {}),
    ...(typeof policy.instagramReels === 'boolean' ? { instagramReels: policy.instagramReels } : {}),
    ...(typeof policy.tiktokShorts === 'boolean' ? { tiktokShorts: policy.tiktokShorts } : {}),
    ...(typeof policy.tiktokSearch === 'boolean' ? { tiktokSearch: policy.tiktokSearch } : {}),
    ...(typeof policy.youtubeSearch === 'boolean' ? { youtubeSearch: policy.youtubeSearch } : {}),
    ...(typeof policy.youtubeShorts === 'boolean' ? { youtubeShorts: policy.youtubeShorts } : {}),
    ...(typeof policy.youtubeComments === 'boolean' ? { youtubeComments: policy.youtubeComments } : {}),
    ...(typeof policy.pictureInPicture === 'boolean' ? { pictureInPicture: policy.pictureInPicture } : {}),
    ...(typeof policy.telegramSearch === 'boolean' ? { telegramSearch: policy.telegramSearch } : {}),
    ...(typeof policy.telegramSearchHistory === 'boolean' ? { telegramSearchHistory: policy.telegramSearchHistory } : {}),
    ...(typeof policy.telegramChannels === 'boolean' ? { telegramChannels: policy.telegramChannels } : {}),
    ...(typeof policy.telegramGroups === 'boolean' ? { telegramGroups: policy.telegramGroups } : {}),
    ...(typeof policy.telegramBlockedAccounts === 'boolean'
      ? { telegramBlockedAccounts: policy.telegramBlockedAccounts }
      : {}),
    ...(typeof policy.snapchatQuickAdd === 'boolean' ? { snapchatQuickAdd: policy.snapchatQuickAdd } : {}),
    ...(typeof policy.snapchatSearch === 'boolean' ? { snapchatSearch: policy.snapchatSearch } : {}),
    ...(typeof policy.snapchatDiscover === 'boolean' ? { snapchatDiscover: policy.snapchatDiscover } : {}),
    ...(typeof policy.snapchatStories === 'boolean' ? { snapchatStories: policy.snapchatStories } : {}),
    ...(typeof policy.snapchatSpotlight === 'boolean' ? { snapchatSpotlight: policy.snapchatSpotlight } : {}),
    ...(typeof policy.snapchatMaps === 'boolean' ? { snapchatMaps: policy.snapchatMaps } : {}),
    ...(typeof policy.twitterEraseAll === 'boolean' ? { twitterEraseAll: policy.twitterEraseAll } : {}),
    ...(typeof policy.twitterBlockApp === 'boolean' ? { twitterBlockApp: policy.twitterBlockApp } : {}),
    ...(typeof policy.twitterSearchMediaTrends === 'boolean'
      ? { twitterSearchMediaTrends: policy.twitterSearchMediaTrends }
      : {}),
    ...(typeof policy.twitterForYou === 'boolean' ? { twitterForYou: policy.twitterForYou } : {}),
    ...(typeof policy.discordBlockApp === 'boolean' ? { discordBlockApp: policy.discordBlockApp } : {}),
    ...(typeof policy.facebookBlockApp === 'boolean' ? { facebookBlockApp: policy.facebookBlockApp } : {}),
    ...(typeof policy.facebookReels === 'boolean' ? { facebookReels: policy.facebookReels } : {}),
    ...(typeof policy.facebookStories === 'boolean' ? { facebookStories: policy.facebookStories } : {}),
    ...(typeof policy.facebookSearch === 'boolean' ? { facebookSearch: policy.facebookSearch } : {}),
    ...(typeof policy.facebookGroups === 'boolean' ? { facebookGroups: policy.facebookGroups } : {}),
    ...(typeof policy.redditSearch === 'boolean' ? { redditSearch: policy.redditSearch } : {}),
    ...(typeof policy.redditSubreddits === 'boolean' ? { redditSubreddits: policy.redditSubreddits } : {}),
    ...(typeof policy.pinterestSearch === 'boolean' ? { pinterestSearch: policy.pinterestSearch } : {}),
    ...(typeof policy.liveStreamingApps === 'boolean' ? { liveStreamingApps: policy.liveStreamingApps } : {}),
    ...(typeof policy.browserUnsafeModes === 'boolean' ? { browserUnsafeModes: policy.browserUnsafeModes } : {}),
    ...(typeof policy.androidTamperSettings === 'boolean' ? { androidTamperSettings: policy.androidTamperSettings } : {}),
    ...(typeof policy.playStoreUninstallControls === 'boolean'
      ? { playStoreUninstallControls: policy.playStoreUninstallControls }
      : {}),
    ...(typeof policy.playStoreAdultInstallControls === 'boolean'
      ? { playStoreAdultInstallControls: policy.playStoreAdultInstallControls }
      : {}),
    ...(typeof policy.packageInstallerControls === 'boolean'
      ? { packageInstallerControls: policy.packageInstallerControls }
      : {}),
  };
}

function normalizeBehaviorPolicy(policy: Partial<BehaviorPolicy>): BehaviorPolicy {
  return {
    ...initialBehaviorPolicy,
    ...policy,
    featureBlocks: {
      ...initialFeatureBlocks,
      ...policy.featureBlocks,
    },
    textContextEngine: {
      ...initialBehaviorPolicy.textContextEngine,
      ...policy.textContextEngine,
      riskSignals: Array.isArray(policy.textContextEngine?.riskSignals)
        ? policy.textContextEngine.riskSignals.map(String)
        : initialBehaviorPolicy.textContextEngine.riskSignals,
    },
    customKeywords: Array.isArray(policy.customKeywords) ? policy.customKeywords : [],
    currentContext: {
      ...initialBehaviorPolicy.currentContext,
      ...policy.currentContext,
    },
  };
}

function normalizeBlockEvent(event: BlockEvent): BlockEvent {
  return {
    id: event.id,
    eventType: 'BLOCK_EVENT',
    keyword: event.keyword,
    keywordSource: event.keywordSource,
    appName: event.appName,
    packageName: event.packageName,
    screen: event.screen,
    source: event.source,
    reason: event.reason,
    action: event.action,
    timestamp: Number(event.timestamp),
  };
}

function normalizeManagedDeviceStatus(status: Partial<ManagedDeviceStatus>): ManagedDeviceStatus {
  return {
    ...initialManagedDeviceStatus,
    ...status,
    uninstallProtectionLevel: status.uninstallProtectionLevel ?? initialManagedDeviceStatus.uninstallProtectionLevel,
    uninstallLockActive: Boolean(status.uninstallLockActive),
    uninstallLockStartedAt: status.uninstallLockStartedAt ?? null,
    uninstallLockExpiresAt: status.uninstallLockExpiresAt ?? null,
    uninstallLockRemainingMs: Number(status.uninstallLockRemainingMs ?? 0),
    uninstallLockDurationDays: Number(
      status.uninstallLockDurationDays ?? initialManagedDeviceStatus.uninstallLockDurationDays,
    ),
    privateDnsMode: status.privateDnsMode ?? null,
    privateDnsHost: status.privateDnsHost ?? null,
  };
}

function normalizePrivateDnsStatus(status: Partial<PrivateDnsStatus>): PrivateDnsStatus {
  return {
    ...initialPrivateDnsStatus,
    ...status,
    mode: status.mode ?? null,
    configuredHost: status.configuredHost ?? null,
    activeHost: status.activeHost ?? null,
    recommendedHost: String(status.recommendedHost || initialPrivateDnsStatus.recommendedHost),
  };
}

function normalizeVpnPolicyStatus(status: Partial<VpnPolicyStatus>): VpnPolicyStatus {
  return {
    ...initialVpnPolicyStatus,
    ...status,
    effectiveTunnelMode: status.effectiveTunnelMode ?? initialVpnPolicyStatus.effectiveTunnelMode,
    allowedPackages: normalizePackageList(status.allowedPackages),
    excludedPackages: normalizePackageList(status.excludedPackages),
    filteredPackageCount: Number(status.filteredPackageCount ?? 0),
    systemBypassPackages: normalizePackageList(status.systemBypassPackages),
    localProxyPort: Number(status.localProxyPort ?? initialVpnPolicyStatus.localProxyPort),
  };
}

function normalizeHttpsInspectionStatus(status: Partial<HttpsInspectionStatus>): HttpsInspectionStatus {
  return {
    ...initialHttpsInspectionStatus,
    ...status,
    localProxyPort: Number(status.localProxyPort ?? initialHttpsInspectionStatus.localProxyPort),
    limitations: Array.isArray(status.limitations) ? status.limitations.map(String) : [],
    warning: String(status.warning || initialHttpsInspectionStatus.warning),
  };
}

function normalizeMediaScanningStatus(status: Partial<MediaScanningStatus>): MediaScanningStatus {
  return {
    ...initialMediaScanningStatus,
    ...status,
    scanner: String(status.scanner || initialMediaScanningStatus.scanner),
    classifierMode: String(status.classifierMode || initialMediaScanningStatus.classifierMode),
    cloudFallbackEnabled: Boolean(status.cloudFallbackEnabled),
    cloudFallbackConfigured: Boolean(status.cloudFallbackConfigured),
    cloudFallbackMode: String(status.cloudFallbackMode || initialMediaScanningStatus.cloudFallbackMode),
    blockThreshold: Number(status.blockThreshold ?? initialMediaScanningStatus.blockThreshold),
    ambiguityThreshold: Number(status.ambiguityThreshold ?? initialMediaScanningStatus.ambiguityThreshold),
    scanTargetPackageCount: Number(status.scanTargetPackageCount ?? 0),
    limitations: Array.isArray(status.limitations) ? status.limitations.map(String) : [],
  };
}

function normalizeScreenshotAuditPolicy(policy: Partial<ScreenshotAuditPolicy>): ScreenshotAuditPolicy {
  return {
    ...initialScreenshotAuditPolicy,
    ...policy,
    enabled: Boolean(policy.enabled),
    intervalMinutes: Math.min(240, Math.max(1, Number(policy.intervalMinutes ?? 15))),
    retainsImages: Boolean(policy.retainsImages),
    localAiReview: Boolean(policy.localAiReview ?? true),
    partnerReviewAvailable: Boolean(policy.partnerReviewAvailable),
    limitations: Array.isArray(policy.limitations) ? policy.limitations.map(String) : [],
  };
}

function normalizeIntegrityStatus(status: Partial<IntegrityStatus>): IntegrityStatus {
  return {
    ...initialIntegrityStatus,
    ...status,
    lastStatus: status.lastStatus ?? initialIntegrityStatus.lastStatus,
    lastMessage: status.lastMessage ?? '',
    lastCheckedAt: Number(status.lastCheckedAt ?? 0),
    signatureBaselineStored: Boolean(status.signatureBaselineStored),
    serverVerificationRequired: Boolean(status.serverVerificationRequired ?? true),
    playIntegrityTokenRequested: Boolean(status.playIntegrityTokenRequested),
    localSignatureBaselineStored: Boolean(status.localSignatureBaselineStored),
    localSignatureTamperSignal: status.localSignatureTamperSignal ?? 'app_signature_mismatch',
  };
}

function normalizeGuardianAlert(alert: GuardianAlert): GuardianAlert {
  return {
    id: String(alert.id || ''),
    eventType: String(alert.eventType || 'GUARDIAN_ALERT'),
    severity: String(alert.severity || 'medium'),
    subject: String(alert.subject || 'Unknown'),
    action: String(alert.action || 'noted'),
    timestamp: Number(alert.timestamp || 0),
    cleared: Boolean(alert.cleared),
    metadata: alert.metadata ?? null,
  };
}

function normalizeAnomalyDetectionStatus(status: Partial<AnomalyDetectionStatus>): AnomalyDetectionStatus {
  return {
    ...initialAnomalyDetectionStatus,
    ...status,
    enabled: Boolean(status.enabled ?? true),
    windowHours: Number(status.windowHours ?? initialAnomalyDetectionStatus.windowHours),
    riskLevel: String(status.riskLevel || initialAnomalyDetectionStatus.riskLevel),
    detectedCount: Number(status.detectedCount ?? 0),
    signals: Array.isArray(status.signals)
      ? status.signals.map((signal) => ({
          id: String(signal.id || 'unknown'),
          severity: String(signal.severity || 'medium'),
          detected: Boolean(signal.detected),
          subject: String(signal.subject || 'Unknown'),
          recommendation: String(signal.recommendation || ''),
          count: Number(signal.count ?? 0),
        }))
      : [],
  };
}

function normalizeUsageAccessStatus(status?: Partial<UsageAccessStatus>): UsageAccessStatus {
  return {
    ...initialUsageAccessStatus,
    ...status,
    granted: Boolean(status?.granted),
    mode: status?.mode ?? null,
  };
}

function normalizeBatteryOptimizationStatus(status?: Partial<BatteryOptimizationStatus>): BatteryOptimizationStatus {
  return {
    ...initialBatteryOptimizationStatus,
    ...status,
    supported: Boolean(status?.supported ?? initialBatteryOptimizationStatus.supported),
    ignored: Boolean(status?.ignored),
  };
}

function normalizeManagedEnforcementStatus(status: Partial<ManagedEnforcementStatus>): ManagedEnforcementStatus {
  return {
    ...initialManagedEnforcementStatus,
    ...status,
    alwaysOnVpnPackage: status.alwaysOnVpnPackage ?? null,
    strictModeEnabled: Boolean(status.strictModeEnabled),
    suspendedPackageCount: Number(status.suspendedPackageCount ?? 0),
  };
}

function normalizeFocusPolicy(policy: Partial<FocusPolicy>): FocusPolicy {
  return {
    ...initialFocusPolicy,
    ...policy,
    schedules: Array.isArray(policy.schedules) && policy.schedules.length > 0
      ? policy.schedules.map(normalizeFocusSchedule)
      : initialFocusPolicy.schedules,
    allowedPackages: normalizePackageList(policy.allowedPackages),
    blockedPackages: normalizePackageList(policy.blockedPackages),
  };
}

function normalizeFocusSchedule(schedule: Partial<FocusPolicy['schedules'][number]>): FocusPolicy['schedules'][number] {
  return {
    id: String(schedule.id || 'daily-night-focus'),
    label: String(schedule.label || 'Daily night focus'),
    enabled: Boolean(schedule.enabled ?? true),
    startMinutes: clampMinutes(schedule.startMinutes),
    endMinutes: clampMinutes(schedule.endMinutes),
    daysOfWeek: Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0
      ? schedule.daysOfWeek.map(Number).filter((day) => day >= 1 && day <= 7)
      : [1, 2, 3, 4, 5, 6, 7],
  };
}

function normalizeFocusState(state: Partial<FocusState>): FocusState {
  return {
    ...initialFocusState,
    ...state,
    activeScheduleId: state.activeScheduleId ?? null,
    strictModeActive: Boolean(state.strictModeActive),
    allowedPackages: normalizePackageList(state.allowedPackages),
    blockedPackages: normalizePackageList(state.blockedPackages),
    suspendedPackages: normalizePackageList(state.suspendedPackages),
    suspendedPackageCount: Number(state.suspendedPackageCount ?? 0),
  };
}

function normalizeUsageLimitPolicy(policy: Partial<UsageLimitPolicy>): UsageLimitPolicy {
  return {
    ...initialUsageLimitPolicy,
    ...policy,
    enabled: Boolean(policy.enabled),
    appLimits: normalizeLimitMap(policy.appLimits),
    categoryLimits: normalizeLimitMap(policy.categoryLimits),
    trackedApps: Array.isArray(policy.trackedApps)
      ? policy.trackedApps.map(normalizeUsageLimitSnapshot)
      : [],
  };
}

function normalizeUsageLimitSnapshot(snapshot: Partial<UsageLimitAppSnapshot>): UsageLimitAppSnapshot {
  return {
    packageName: String(snapshot.packageName || '').toLowerCase(),
    appLabel: String(snapshot.appLabel || snapshot.packageName || 'Unknown app'),
    category: String(snapshot.category || 'uncategorized').toLowerCase(),
    limitMinutes: clampUsageLimit(snapshot.limitMinutes),
    usedMinutes: Math.max(0, Number(snapshot.usedMinutes ?? 0)),
    source: String(snapshot.source || 'app'),
  };
}

function normalizeLimitMap(values?: Record<string, number>): Record<string, number> {
  if (!values || typeof values !== 'object') return {};
  return Object.entries(values).reduce<Record<string, number>>((next, [key, value]) => {
    const normalizedKey = key.trim().toLowerCase();
    const minutes = clampUsageLimit(value);
    if (normalizedKey && minutes > 0) {
      next[normalizedKey] = minutes;
    }
    return next;
  }, {});
}

function normalizeInstalledApp(app: InstalledApp): InstalledApp {
  return {
    packageName: String(app.packageName || '').toLowerCase(),
    label: String(app.label || app.packageName || 'Unknown app'),
    systemApp: Boolean(app.systemApp),
    enabled: Boolean(app.enabled),
    riskRuleId: app.riskRuleId ?? null,
    riskCategory: app.riskCategory ?? null,
    riskSeverity: app.riskSeverity ?? null,
    riskAction: app.riskAction ?? null,
  };
}

function normalizeTamperSignal(signal: Partial<TamperSignal>): TamperSignal {
  return {
    id: String(signal.id || 'unknown'),
    severity: String(signal.severity || 'medium'),
    detected: Boolean(signal.detected),
    subject: String(signal.subject || 'Unknown'),
    recommendation: String(signal.recommendation || ''),
  };
}

function normalizePackageList(values?: string[]) {
  return Array.isArray(values)
    ? [...new Set(values.map((value) => String(value).trim().toLowerCase()).filter(Boolean))]
    : [];
}

function normalizeDomain(domain: string) {
  return String(domain)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, '')
    .trim()
    .replace(/^\.+|\.+$/g, '');
}

function normalizeDomainList(values?: string[]) {
  return Array.isArray(values)
    ? [...new Set(values.map((value) => normalizeDomain(value)).filter(Boolean))].sort()
    : [];
}

function clampMinutes(value?: number) {
  const minutes = Number(value ?? 0);
  if (!Number.isFinite(minutes)) return 0;
  return Math.min(1439, Math.max(0, Math.round(minutes)));
}

function clampUsageLimit(value?: number) {
  const minutes = Number(value ?? 0);
  if (!Number.isFinite(minutes)) return 0;
  return Math.min(1440, Math.max(0, Math.round(minutes)));
}

function managedPolicyReason(reason?: string) {
  switch (reason) {
    case 'device_owner_or_profile_owner_required':
      return 'This action requires Android device-owner or profile-owner enrollment.';
    case 'device_admin_required':
      return 'Enable Device Admin first for basic uninstall protection.';
    case 'private_dns_requires_android_9_or_newer':
      return 'Managed Private DNS requires Android 9 or newer.';
    case 'always_on_vpn_requires_android_7_or_newer':
      return 'Always-on VPN lockdown requires Android 7 or newer.';
    case 'package_suspension_requires_android_7_or_newer':
      return 'Managed package suspension requires Android 7 or newer.';
    case 'android_rejected_always_on_vpn':
      return 'Android rejected the always-on VPN policy.';
    case 'android_rejected_uninstall_block':
      return 'Android rejected the managed uninstall block.';
    case 'uninstall_lock_active':
      return 'The uninstall lock timer is still active. You can disable it after the configured date.';
    case 'privacy_acknowledgement_required':
      return 'HTTPS inspection requires explicit privacy acknowledgement before it can be enabled.';
    default:
      return 'Android did not apply the managed-device policy.';
  }
}
