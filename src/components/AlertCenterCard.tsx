import { useState } from 'react';
import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Badge, Chip, Divider, Switch, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from './Card';
import { Button } from './controls';
import { colors, radius, spacing, typography } from '@/theme';
import type { AlertPreferences, AlertSeverity, ViolationAlert } from '@/types/blocker';

type AlertCenterCardProps = {
  alerts: ViolationAlert[];
  preferences: AlertPreferences;
  unreadCount: number;
  onMarkAsRead: (alertId: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
  onDeleteAlert: (alertId: string) => Promise<void>;
  onClearAll: () => Promise<void>;
  onUpdatePreferences: (patch: Partial<AlertPreferences>) => Promise<void>;
};

const SEVERITY_ICONS: Record<AlertSeverity, string> = {
  info: 'information',
  warning: 'alert',
  critical: 'alert-octagon',
};

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  info: colors.blue[400],
  warning: colors.amber[400],
  critical: colors.red[400],
};

const TYPE_ICONS: Record<ViolationAlert['type'], string> = {
  domain_blocked: 'web-remove',
  keyword_detected: 'text-search',
  app_blocked: 'cellphone-lock',
  tamper_attempt: 'shield-alert',
  vpn_disconnected: 'vpn',
  bypass_attempt: 'incognito',
  unlock_request: 'lock-open-variant',
};

const SEVERITY_WEIGHT: Record<AlertSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AlertCenterCard({
  alerts,
  preferences,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteAlert,
  onClearAll,
  onUpdatePreferences,
}: AlertCenterCardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | AlertSeverity>('all');

  const sortedAlerts = [...alerts].sort((left, right) => {
    if (!left.read && right.read) return -1;
    if (left.read && !right.read) return 1;
    const severityDelta = SEVERITY_WEIGHT[right.severity] - SEVERITY_WEIGHT[left.severity];
    if (severityDelta !== 0) return severityDelta;
    return right.timestamp - left.timestamp;
  });
  const filteredAlerts = filter === 'all' ? sortedAlerts : sortedAlerts.filter((a) => a.severity === filter);
  const displayedAlerts = filteredAlerts.slice(0, 20);

  const criticalCount = alerts.filter((a) => a.severity === 'critical' && !a.read).length;
  const warningCount = alerts.filter((a) => a.severity === 'warning' && !a.read).length;
  const infoCount = alerts.filter((a) => a.severity === 'info' && !a.read).length;

  return (
    <Card
      title="Alert Center"
      subtitle={unreadCount > 0 ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'} need attention.` : 'Everything is quiet right now.'}
      accent={criticalCount > 0 ? 'red' : warningCount > 0 ? 'amber' : 'none'}
      action={
        unreadCount > 0 ? (
          <View style={styles.badgeContainer}>
            <Badge size={22} style={styles.badge}>{unreadCount}</Badge>
          </View>
        ) : null
      }
    >
      <View style={styles.summaryPanel}>
        <View style={styles.summaryCopy}>
          <MaterialCommunityIcons
            name={unreadCount > 0 ? 'bell-alert-outline' : 'bell-check-outline'}
            size={24}
            color={unreadCount > 0 ? colors.amber[400] : colors.green[400]}
          />
          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle}>{unreadCount > 0 ? 'Needs review' : 'All clear'}</Text>
            <Text style={styles.summarySubtitle}>
              {unreadCount > 0 ? 'Review recent protection events.' : 'No bypass, tamper, or block alerts are unread.'}
            </Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <StatPill label="Critical" count={criticalCount} color={colors.red[400]} selected={filter === 'critical'} onPress={() => setFilter('critical')} />
          <StatPill label="Warning" count={warningCount} color={colors.amber[400]} selected={filter === 'warning'} onPress={() => setFilter('warning')} />
          <StatPill label="Info" count={infoCount} color={colors.blue[400]} selected={filter === 'info'} onPress={() => setFilter('info')} />
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'critical', 'warning', 'info'] as const).map((f) => (
          <FilterPill
            key={f}
            selected={filter === f}
            onPress={() => setFilter(f)}
            label={f}
          />
        ))}
      </View>

      <View style={styles.actionsRow}>
        {unreadCount > 0 && (
          <Button icon="check-all" tone="neutral" onPress={() => void onMarkAllAsRead()}>
            Mark All Read
          </Button>
        )}
        {alerts.length > 0 && (
          <Button icon="delete-sweep" tone="neutral" onPress={() => void onClearAll()}>
            Clear All
          </Button>
        )}
        <Button
          icon={showSettings ? 'chevron-up' : 'cog'}
          tone="neutral"
          onPress={() => setShowSettings(!showSettings)}
        >
          {showSettings ? 'Hide preferences' : 'Preferences'}
        </Button>
      </View>

      {displayedAlerts.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <MaterialCommunityIcons name="bell-check-outline" size={34} color={colors.green[400]} />
          </View>
          <Text style={styles.emptyTitle}>{filter === 'all' ? 'All clear' : `No ${filter} alerts`}</Text>
          <Text style={styles.emptyText}>
            {filter === 'all' ? 'No alerts have been triggered yet. Protection is working quietly.' : 'Nothing in this filter right now.'}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => setShowSettings(true)} style={styles.emptyLink}>
            <MaterialCommunityIcons name="cog-outline" size={16} color={colors.text.secondary} />
            <Text style={styles.emptyLinkText}>Adjust notification preferences</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.alertList}>
          {displayedAlerts.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              isExpanded={expandedAlertId === alert.id}
              onPress={() => {
                setExpandedAlertId(expandedAlertId === alert.id ? null : alert.id);
                if (!alert.read) void onMarkAsRead(alert.id);
              }}
              onDelete={() => void onDeleteAlert(alert.id)}
            />
          ))}
        </View>
      )}

      {filteredAlerts.length > 20 && (
        <Text style={styles.moreText}>
          Showing 20 of {filteredAlerts.length} alerts
        </Text>
      )}

      {showSettings && (
        <View style={styles.settingsPanel}>
          <Divider />
          <View style={styles.settingsHeader}>
            <View>
              <Text style={styles.settingsTitle}>Notification Preferences</Text>
              <Text style={styles.settingsSubtitle}>Choose a preset, then fine-tune any alert type.</Text>
            </View>
          </View>
          <View style={styles.presetRow}>
            <PresetPill label="Minimal" active={preferences.minSeverity === 'critical'} onPress={() => void onUpdatePreferences({
              notifyOnBlock: false,
              notifyOnTamper: true,
              notifyOnBypass: true,
              notifyOnUnlockRequest: true,
              minSeverity: 'critical',
              dailyDigestEnabled: false,
            })} />
            <PresetPill label="Balanced" active={preferences.minSeverity === 'warning'} onPress={() => void onUpdatePreferences({
              notifyOnBlock: true,
              notifyOnTamper: true,
              notifyOnBypass: true,
              notifyOnUnlockRequest: true,
              minSeverity: 'warning',
              dailyDigestEnabled: true,
            })} />
            <PresetPill label="All alerts" active={preferences.minSeverity === 'info'} onPress={() => void onUpdatePreferences({
              notifyOnBlock: true,
              notifyOnTamper: true,
              notifyOnBypass: true,
              notifyOnUnlockRequest: true,
              minSeverity: 'info',
              dailyDigestEnabled: false,
            })} />
          </View>

          <ToggleRow
            label="Alerts enabled"
            value={preferences.enabled}
            onToggle={(v) => void onUpdatePreferences({ enabled: v })}
          />
          <ToggleRow
            label="Notify on blocked content"
            value={preferences.notifyOnBlock}
            onToggle={(v) => void onUpdatePreferences({ notifyOnBlock: v })}
          />
          <ToggleRow
            label="Notify on tamper attempts"
            value={preferences.notifyOnTamper}
            onToggle={(v) => void onUpdatePreferences({ notifyOnTamper: v })}
          />
          <ToggleRow
            label="Notify on bypass attempts"
            value={preferences.notifyOnBypass}
            onToggle={(v) => void onUpdatePreferences({ notifyOnBypass: v })}
          />
          <ToggleRow
            label="Notify on unlock requests"
            value={preferences.notifyOnUnlockRequest}
            onToggle={(v) => void onUpdatePreferences({ notifyOnUnlockRequest: v })}
          />

          <View style={styles.severityPicker}>
            <Text style={styles.fieldLabel}>Minimum severity</Text>
            <View style={styles.severityOptions}>
              {(['info', 'warning', 'critical'] as AlertSeverity[]).map((sev) => (
                <Chip
                  key={sev}
                  compact
                  selected={preferences.minSeverity === sev}
                  onPress={() => void onUpdatePreferences({ minSeverity: sev })}
                  style={
                    preferences.minSeverity === sev
                      ? { backgroundColor: SEVERITY_COLORS[sev] + '22' }
                      : undefined
                  }
                  textStyle={{ fontSize: 11, textTransform: 'capitalize' }}
                >
                  {sev}
                </Chip>
              ))}
            </View>
          </View>

          <ToggleRow
            label="Quiet hours"
            value={preferences.quietHoursEnabled}
            onToggle={(v) => void onUpdatePreferences({ quietHoursEnabled: v })}
          />
          <ToggleRow
            label="Daily digest"
            value={preferences.dailyDigestEnabled}
            onToggle={(v) => void onUpdatePreferences({ dailyDigestEnabled: v })}
          />
        </View>
      )}
    </Card>
  );
}

function AlertRow({
  alert,
  isExpanded,
  onPress,
  onDelete,
}: {
  alert: ViolationAlert;
  isExpanded: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.alertRow, !alert.read && styles.alertUnread]}>
        <View style={styles.alertHeader}>
          <View style={[styles.severityDot, { backgroundColor: SEVERITY_COLORS[alert.severity] }]} />
          <View style={styles.alertInfo}>
            <Text style={[styles.alertTitle, !alert.read && styles.alertTitleUnread]} numberOfLines={isExpanded ? undefined : 1}>
              {alert.title}
            </Text>
            <Text style={styles.alertTime}>
              {[alert.app, formatTimeAgo(alert.timestamp)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {!alert.read && <View style={styles.unreadDot} />}
        </View>

        {isExpanded && (
          <View style={styles.alertExpanded}>
            <Text style={styles.alertDescription}>{alert.description}</Text>
            {alert.app && (
              <Text style={styles.alertMeta}>App: {alert.app}</Text>
            )}
            {alert.domain && (
              <Text style={styles.alertMeta}>Domain: {alert.domain}</Text>
            )}
            <Text style={styles.alertMeta}>Action taken: {alert.type.replace(/_/g, ' ')}</Text>
            <Text style={styles.alertMeta}>Device state: captured at alert time</Text>
            <View style={styles.alertActions}>
              <Chip compact icon={SEVERITY_ICONS[alert.severity]} style={{ backgroundColor: SEVERITY_COLORS[alert.severity] + '22' }}>
                {alert.severity}
              </Chip>
              <Chip compact icon={TYPE_ICONS[alert.type] as any}>
                {alert.type.replace(/_/g, ' ')}
              </Chip>
              <Button icon="delete" tone="danger" onPress={onDelete}>
                Delete
              </Button>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function StatPill({
  label,
  count,
  color,
  selected,
  onPress,
}: {
  label: string;
  count: number;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  const activeColor = count > 0 ? color : colors.border.subtle;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.statPill,
        { borderColor: selected ? color : activeColor },
        selected ? { backgroundColor: color + '18' } : null,
      ]}
    >
      <Text style={[styles.statCount, { color: count > 0 ? color : colors.text.primary }]}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function FilterPill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.filterPill, selected ? styles.filterPillSelected : null]}
    >
      <Text style={[styles.filterText, selected ? styles.filterTextSelected : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function PresetPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.presetPill, active ? styles.presetPillActive : null]}>
      <Text style={[styles.presetText, active ? styles.presetTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch color={colors.green[400]} value={value} onValueChange={onToggle} />
    </View>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    paddingTop: 2,
  },
  badge: {
    backgroundColor: colors.red[400],
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryPanel: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  summaryCopy: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  summarySubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  summaryTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  statPill: {
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingVertical: spacing.sm,
  },
  statCount: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  filterPill: {
    borderRadius: radius.full,
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.default,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterPillSelected: {
    backgroundColor: colors.green[50],
    borderColor: colors.border.green,
  },
  filterText: {
    ...typography.captionMd,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  filterTextSelected: {
    color: colors.green[600],
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  alertList: {
    gap: spacing.xs,
  },
  alertRow: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  alertUnread: {
    backgroundColor: colors.blue[50],
    borderColor: colors.blue[100],
  },
  alertHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  alertInfo: {
    flex: 1,
  },
  alertTitle: {
    ...typography.body,
    color: colors.text.primary,
  },
  alertTitleUnread: {
    fontWeight: '700',
  },
  alertTime: {
    ...typography.caption,
    color: colors.text.muted,
  },
  unreadDot: {
    backgroundColor: colors.blue[400],
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  alertExpanded: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  alertDescription: {
    ...typography.body,
    color: colors.text.secondary,
  },
  alertMeta: {
    ...typography.caption,
    color: colors.text.muted,
  },
  alertActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
    maxWidth: 260,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 300,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing['2xl'],
  },
  emptyIconWrap: {
    alignItems: 'center',
    backgroundColor: colors.green[50],
    borderRadius: radius.full,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  emptyLink: {
    alignItems: 'center',
    borderColor: colors.border.subtle,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  emptyLinkText: {
    ...typography.captionMd,
    color: colors.text.secondary,
  },
  moreText: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: 'center',
  },
  settingsPanel: {
    gap: spacing.md,
  },
  settingsTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  settingsSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  presetPill: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.default,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  presetPillActive: {
    backgroundColor: colors.green[50],
    borderColor: colors.border.green,
  },
  presetText: {
    ...typography.captionMd,
    color: colors.text.secondary,
  },
  presetTextActive: {
    color: colors.green[600],
  },
  severityDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  toggleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  toggleLabel: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  fieldLabel: {
    ...typography.captionMd,
    color: colors.text.secondary,
  },
  severityPicker: {
    gap: spacing.xs,
  },
  severityOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
