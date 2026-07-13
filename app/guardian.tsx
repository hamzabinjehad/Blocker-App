import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Switch } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';

import { AlwaysOnVpnCard } from '@/components/AlwaysOnVpnCard';
import { ManagedModeNotice } from '@/components/ManagedModeNotice';
import { ParentPinCard } from '@/components/ParentPinCard';
import { PrivateDnsProtectionCard } from '@/components/PrivateDnsProtectionCard';
import { RemoteManagementCard } from '@/components/RemoteManagementCard';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { useTranslation } from '@/i18n';
import BlockerModule from '@/native/BlockerModule';
import type { DnsFilterTestResult } from '@/types/blocker';
import { useProtection } from '@/store/ProtectionContext';
import { useRemoteManagement } from '@/store/useRemoteManagement';
import { radius, spacing, typography, useTheme } from '@/theme';

const FAMILY_SAFE_HOSTS = [
  'family.cloudflare-dns.com',
  'dns.cleanbrowsing.org',
  'family-filter-dns.cleanbrowsing.org',
  'doh.familyshield.opendns.com',
];

export default function GuardianScreen() {
  const { colors } = useTheme();
  const t = useTranslation();
  const protection = useProtection();
  const remote = useRemoteManagement();
  const [unlockRequestsEnabled, setUnlockRequestsEnabled] = useState(true);
  const recentRequests = remote.session.pendingRequests.slice(0, 5);

  useEffect(() => {
    void AsyncStorage.getItem('unlock_requests_enabled').then((val) => {
      if (val !== null) setUnlockRequestsEnabled(val === 'true');
    });
  }, []);

  const handleUnlockRequestsToggle = (value: boolean) => {
    setUnlockRequestsEnabled(value);
    void AsyncStorage.setItem('unlock_requests_enabled', String(value));
  };

  return (
    <ScreenScaffold
      backLabel={t('common.back')}
      showBack
      title={t('guardian.title')}
      subtitle={t('guardian.subtitle')}
    >
      <View style={s.section}>
        <ParentPinCard
          pinConfigured={protection.pinConfigured}
          loading={protection.loading}
          onSetPin={protection.setParentPin}
        />
      </View>

      <DnsProtectionCard
        vpnActive={protection.vpnActive}
        privateDnsStatus={protection.privateDnsStatus}
        onOpenPrivateDnsSettings={protection.openPrivateDnsSettings}
        onConfigureManagedPrivateDns={protection.configureManagedPrivateDns}
        canConfigureManagedDns={protection.managedDeviceStatus.canConfigurePrivateDns}
      />

      <View style={s.section}>
        <PrivateDnsProtectionCard
          status={protection.managedDeviceStatus.privateDnsProtection}
          pinConfigured={protection.pinConfigured}
          onEnable={protection.enablePrivateDnsProtection}
          onDisable={protection.disablePrivateDnsProtection}
          onOpenPrivateDnsSettings={protection.openPrivateDnsSettings}
        />
      </View>

      <View style={s.section}>
        <AlwaysOnVpnCard onOpenVpnSettings={protection.openVpnSettings} />
      </View>

      <View style={s.section}>
        <RemoteManagementCard
          session={remote.session}
          loading={remote.loading}
          onGeneratePairingCode={remote.generateNewPairingCode}
          onAddDevice={remote.addDevice}
          onRemoveDevice={remote.removeDevice}
          onSubmitUnlockRequest={remote.submitUnlockRequest}
          onRespondToUnlockRequest={remote.respondToUnlockRequest}
        />
      </View>

      {/* Device admin / uninstall guard — the only entry point for
          requestDeviceAdminPermission since the onboarding checklist was
          trimmed to the two critical permissions. */}
      <View style={s.section}>
        <ManagedModeNotice
          batteryOptimizationIgnored={protection.batteryOptimizationStatus.ignored}
          error={protection.error}
          enforcement={protection.managedEnforcementStatus}
          status={protection.managedDeviceStatus}
          onCopyDeviceOwnerCommand={protection.copyDeviceOwnerEnrollmentCommand}
          onConfigureManagedPrivateDns={protection.configureManagedPrivateDns}
          onOpenPrivateDnsSettings={protection.openPrivateDnsSettings}
          onApplyStrictDeviceOwnerPolicy={protection.applyStrictDeviceOwnerPolicy}
          onRefreshStatus={() => protection.refreshStatus(false)}
          onRequestIgnoreBatteryOptimizations={protection.requestIgnoreBatteryOptimizations}
          onRequestDeviceAdminPermission={protection.requestDeviceAdminPermission}
          onSetAlwaysOnVpnLockdown={protection.setAlwaysOnVpnLockdown}
          onSetEmergencyLockEnabled={protection.setEmergencyLockEnabled}
          onSetPackageSuspensionEnabled={protection.setPackageSuspensionEnabled}
          onSetStrictModeEnabled={protection.setStrictModeEnabled}
          onSetUninstallProtectionEnabled={protection.setUninstallProtectionEnabled}
        />
      </View>

      <View style={[s.panel, { borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated }]}>
        <View style={s.toggleRow}>
          <View style={s.toggleCopy}>
            <Text style={[s.sectionTitle, { color: colors.text.primary }]}>{t('guardian.unlockRequests')}</Text>
            <Text style={[s.sectionMeta, { color: colors.text.secondary }]}>
              {t('guardian.unlockRequestsCopy')}
            </Text>
          </View>
          <Switch value={unlockRequestsEnabled} onValueChange={handleUnlockRequestsToggle} />
        </View>
        <View style={s.requestList}>
          {recentRequests.length > 0 ? recentRequests.map((request) => (
            <View key={request.id} style={[s.requestRow, { backgroundColor: colors.bg.tertiary }]}>
              <Feather name="lock" size={16} color={colors.text.secondary} />
              <View style={s.requestText}>
                <Text style={[s.requestReason, { color: colors.text.primary }]} numberOfLines={1}>
                  {request.reason}
                </Text>
                <Text style={[s.requestMeta, { color: colors.text.muted }]}>
                  {request.status} · {formatTimeAgo(request.requestedAt)}
                </Text>
              </View>
            </View>
          )) : (
            <Text style={[s.emptyText, { color: colors.text.muted }]}>{t('guardian.noRecentRequests')}</Text>
          )}
        </View>
      </View>
    </ScreenScaffold>
  );
}

function DnsProtectionCard({
  vpnActive,
  privateDnsStatus,
  onOpenPrivateDnsSettings,
  onConfigureManagedPrivateDns,
  canConfigureManagedDns,
}: {
  vpnActive: boolean;
  privateDnsStatus: ReturnType<typeof useProtection>['privateDnsStatus'];
  onOpenPrivateDnsSettings: () => Promise<void>;
  onConfigureManagedPrivateDns: (host: string) => Promise<void>;
  canConfigureManagedDns: boolean;
}) {
  const t = useTranslation();
  const { colors } = useTheme();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<DnsFilterTestResult | null>(null);
  const [testLastRanAt, setTestLastRanAt] = useState<number | null>(null);

  const dnsHost = privateDnsStatus?.configuredHost?.toLowerCase() ?? '';
  const dnsMode = privateDnsStatus?.mode ?? '';
  const privateDnsConfigured = dnsMode === 'hostname' && FAMILY_SAFE_HOSTS.some((h) => dnsHost.includes(h.split('.')[0]!));

  const runTest = async () => {
    setTesting(true);
    try {
      const result = await BlockerModule.testDnsFiltering();
      setTestResult(result);
      setTestLastRanAt(Date.now());
    } catch (_) {
      setTestResult(null);
    } finally {
      setTesting(false);
    }
  };

  const configureDns = async () => {
    if (canConfigureManagedDns) {
      await onConfigureManagedPrivateDns('family.cloudflare-dns.com');
    } else {
      await onOpenPrivateDnsSettings();
    }
  };

  return (
    <View style={[s.panel, { borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated }]}>
      <View style={s.panelHeader}>
        <View style={[s.panelIcon, { backgroundColor: colors.green[50] }]}>
          <Feather name="shield" size={16} color={colors.green[600]} />
        </View>
        <View style={s.panelHeaderText}>
          <Text style={[s.sectionTitle, { color: colors.text.primary }]}>{t('guardian.dnsFiltering')}</Text>
          <Text style={[s.sectionMeta, { color: colors.text.secondary }]}>
            {t('guardian.dnsFilteringMeta')}
          </Text>
        </View>
      </View>

      <StatusRow
        label={t('guardian.vpnFilter')}
        active={vpnActive}
        description={vpnActive ? t('guardian.vpnFilterActive') : t('guardian.vpnFilterOff')}
        colors={colors}
      />
      <StatusRow
        label={t('guardian.privateDnsBackup')}
        active={privateDnsConfigured}
        description={
          privateDnsConfigured
            ? t('guardian.privateDnsConfiguredHost', { host: privateDnsStatus?.configuredHost ?? '' })
            : t('guardian.privateDnsNotSet')
        }
        colors={colors}
      />
      <Text style={[s.batteryNote, { color: colors.text.muted }]}>{t('guardian.privateDnsBatteryNote')}</Text>

      {!privateDnsConfigured ? (
        <View style={[s.setupBox, { backgroundColor: colors.amber[50], borderColor: colors.amber[200] }]}>
          <Text style={[s.setupBoxTitle, { color: colors.amber[900] }]}>Add a backup DNS filter</Text>
          <Text style={[s.setupBoxBody, { color: colors.amber[800] }]}>
            {canConfigureManagedDns
              ? 'As Device Owner, this app can configure Private DNS automatically.'
              : 'Go to Settings → Network → Private DNS and enter:'}
          </Text>
          {!canConfigureManagedDns ? (
            <View style={[s.hostnameBox, { backgroundColor: colors.amber[100] }]}>
              <Text style={[s.hostnameText, { color: colors.amber[900] }]} selectable>
                family.cloudflare-dns.com
              </Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={configureDns}
            style={[s.setupButton, { backgroundColor: colors.amber[700] }]}
          >
            <Text style={[s.setupButtonText, { color: '#FFFFFF' }]}>
              {canConfigureManagedDns ? 'Configure automatically' : 'Open Private DNS settings'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={s.testRow}>
        <Pressable
          accessibilityRole="button"
          disabled={testing}
          onPress={runTest}
          style={[s.testButton, { borderColor: colors.border.subtle, backgroundColor: colors.bg.tertiary }]}
        >
          {testing ? (
            <ActivityIndicator size="small" color={colors.green[500]} />
          ) : (
            <Feather name="activity" size={14} color={colors.green[500]} />
          )}
          <Text style={[s.testButtonText, { color: colors.text.secondary }]}>
            {testing ? 'Testing…' : 'Test DNS filtering'}
          </Text>
        </Pressable>
        {testLastRanAt !== null && !testing ? (
          <Text style={[s.testTimestamp, { color: colors.text.muted }]}>
            Last tested {formatTimeAgo(testLastRanAt)}
          </Text>
        ) : null}
      </View>

      {testResult ? <DnsTestResults result={testResult} colors={colors} /> : null}
    </View>
  );
}

function StatusRow({
  label,
  active,
  description,
  colors,
}: {
  label: string;
  active: boolean;
  description: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={s.statusRow}>
      <Feather
        name={active ? 'check-circle' : 'circle'}
        size={15}
        color={active ? colors.green[500] : colors.text.muted}
      />
      <View style={s.statusRowText}>
        <Text style={[s.statusLabel, { color: colors.text.primary }]}>{label}</Text>
        <Text style={[s.statusDesc, { color: colors.text.muted }]} numberOfLines={2}>
          {description}
        </Text>
      </View>
    </View>
  );
}

function DnsTestResults({
  result,
  colors,
}: {
  result: DnsFilterTestResult;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const allGood = result.safeDomainsReachable && result.adultDomainsBlocked;
  const bgColor = allGood ? colors.green[50] : colors.amber[50];
  const borderColor = allGood ? colors.border.green : colors.amber[200];
  const textColor = allGood ? colors.green[700] : colors.amber[800];

  return (
    <View style={[s.resultBox, { backgroundColor: bgColor, borderColor }]}>
      <Text style={[s.resultTitle, { color: textColor }]}>
        {allGood ? 'DNS filter is working correctly' : 'DNS filter needs attention'}
      </Text>
      {!result.vpnActive ? (
        <Text style={[s.resultNote, { color: textColor }]}>
          Protection is off — start blocking to activate DNS filtering.
        </Text>
      ) : null}
      <View style={s.resultGrid}>
        <ResultRow
          label="Safe sites reachable"
          pass={result.safeDomainsReachable}
          detail={(() => {
            const reachable = result.safeResults.filter((r) => !r.blocked).length;
            const total = result.safeResults.length;
            return total > 0 ? `${reachable}/${total} accessible` : 'No results';
          })()}
          colors={colors}
        />
        <ResultRow
          label="Adult content blocked"
          pass={result.adultDomainsBlocked}
          detail={(() => {
            const blocked = result.adultResults.filter((r) => r.blocked).length;
            const total = result.adultResults.length;
            if (total === 0) return 'No results';
            if (blocked === total) return `All ${total} test domains filtered`;
            return `${total - blocked} domain${total - blocked === 1 ? '' : 's'} not filtered`;
          })()}
          colors={colors}
        />
      </View>
    </View>
  );
}

function ResultRow({
  label,
  pass,
  detail,
  colors,
}: {
  label: string;
  pass: boolean;
  detail: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={s.resultRow}>
      <Feather
        name={pass ? 'check' : 'x'}
        size={13}
        color={pass ? colors.green[600] : colors.red[500]}
      />
      <View style={s.resultRowText}>
        <Text style={[s.resultLabel, { color: colors.text.primary }]}>{label}</Text>
        <Text style={[s.resultDetail, { color: colors.text.muted }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

function formatTimeAgo(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const s = StyleSheet.create({
  batteryNote: {
    ...typography.caption,
    lineHeight: 17,
  },
  emptyText: {
    ...typography.body,
  },
  hostnameBox: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  hostnameText: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '500',
  },
  panel: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  panelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  panelHeaderText: {
    flex: 1,
    gap: 2,
  },
  panelIcon: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  requestList: {
    gap: spacing.sm,
  },
  requestMeta: {
    ...typography.caption,
    textTransform: 'capitalize',
  },
  requestReason: {
    ...typography.bodyMd,
  },
  requestRow: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  requestText: {
    flex: 1,
    gap: 2,
  },
  resultBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  resultDetail: {
    ...typography.caption,
  },
  resultGrid: {
    gap: spacing.sm,
  },
  resultLabel: {
    ...typography.captionMd,
  },
  resultNote: {
    ...typography.caption,
  },
  resultRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  resultRowText: {
    flex: 1,
    gap: 1,
  },
  resultTitle: {
    ...typography.bodyMd,
  },
  section: {
    gap: spacing.sm,
  },
  sectionMeta: {
    ...typography.body,
  },
  sectionTitle: {
    ...typography.h3,
  },
  setupBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  setupBoxBody: {
    ...typography.body,
  },
  setupBoxTitle: {
    ...typography.bodyMd,
  },
  setupButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  setupButtonText: {
    ...typography.captionMd,
  },
  statusDesc: {
    ...typography.caption,
    lineHeight: 17,
  },
  statusLabel: {
    ...typography.captionMd,
  },
  statusRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  statusRowText: {
    flex: 1,
    gap: 1,
  },
  testButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  testButtonText: {
    ...typography.captionMd,
  },
  testTimestamp: {
    ...typography.caption,
    marginStart: spacing.sm,
  },
  testRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
});
