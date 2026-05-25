import { StyleSheet, View, Pressable } from 'react-native';
import { Text } from 'react-native-paper';

import { Card } from './Card';
import { AppIcon } from './AppIcon';
import { useTheme } from '@/theme';
import { radius, spacing, typography } from '@/theme';

type PermissionChecklistCardProps = {
  vpnPermissionGranted: boolean;
  accessibilityServiceEnabled: boolean;
  overlayPermissionGranted: boolean;
  usageAccessGranted: boolean;
  batteryOptimizationIgnored: boolean;
  deviceAdminActive: boolean;
  notificationListenerConnected?: boolean;
  onGrantVpnPermission: () => Promise<void>;
  onOpenAccessibilitySettings: () => Promise<void>;
  onOpenOverlaySettings: () => Promise<void>;
  onOpenUsageAccessSettings: () => Promise<void>;
  onRequestIgnoreBatteryOptimizations: () => Promise<void>;
  onRequestDeviceAdminPermission: () => Promise<void>;
  onOpenNotificationListenerSettings?: () => Promise<void>;
};

type PermissionItem = {
  key: string;
  title: string;
  ready: boolean;
  onPress: () => Promise<void>;
};

export function PermissionChecklistCard({
  vpnPermissionGranted,
  accessibilityServiceEnabled,
  overlayPermissionGranted,
  usageAccessGranted,
  batteryOptimizationIgnored,
  deviceAdminActive,
  onGrantVpnPermission,
  notificationListenerConnected,
  onOpenAccessibilitySettings,
  onOpenOverlaySettings,
  onOpenUsageAccessSettings,
  onRequestIgnoreBatteryOptimizations,
  onRequestDeviceAdminPermission,
  onOpenNotificationListenerSettings,
}: PermissionChecklistCardProps) {
  const { colors } = useTheme();

  const items: PermissionItem[] = [
    { key: 'vpn', title: 'VPN connection', ready: vpnPermissionGranted, onPress: onGrantVpnPermission },
    { key: 'accessibility', title: 'Accessibility service', ready: accessibilityServiceEnabled, onPress: onOpenAccessibilitySettings },
    { key: 'overlay', title: 'Overlay permissions', ready: overlayPermissionGranted, onPress: onOpenOverlaySettings },
    { key: 'usage', title: 'Usage monitoring', ready: usageAccessGranted, onPress: onOpenUsageAccessSettings },
    { key: 'battery', title: 'Background activity', ready: batteryOptimizationIgnored, onPress: onRequestIgnoreBatteryOptimizations },
    { key: 'device-admin', title: 'Device admin', ready: deviceAdminActive, onPress: onRequestDeviceAdminPermission },
    ...(onOpenNotificationListenerSettings
      ? [{ key: 'notification-listener', title: 'Notification access', ready: notificationListenerConnected ?? false, onPress: onOpenNotificationListenerSettings }]
      : []),
  ];
  const readyCount = items.filter((item) => item.ready).length;
  const progress = `${(readyCount / items.length) * 100}%` as `${number}%`;

  return (
    <Card
      title="Setup Checklist"
      subtitle={`${readyCount} of ${items.length} permissions ready`}
    >
      <View style={[s.progressTrack, { backgroundColor: colors.bg.tertiary }]}>
        <View style={[s.progressFill, { backgroundColor: colors.green[500], width: progress }]} />
      </View>
      <View style={s.list}>
        {items.map((item) => (
          <PermissionRow key={item.key} item={item} />
        ))}
      </View>
    </Card>
  );
}

function PermissionRow({ item }: { item: PermissionItem }) {
  const { colors } = useTheme();

  return (
    <Pressable
      disabled={item.ready}
      onPress={() => void item.onPress()}
      style={({ pressed }) => [
        s.row,
        {
          backgroundColor: colors.bg.primary,
          borderColor: colors.border.subtle,
        },
        pressed && { backgroundColor: colors.bg.tertiary },
      ]}
    >
      <View style={[s.rowIcon, item.ready ? { backgroundColor: colors.green[50] } : { backgroundColor: colors.bg.tertiary }]}>
        <AppIcon name={item.ready ? 'check' : 'shield'} size={15} color={item.ready ? colors.green[600] : colors.text.muted} />
      </View>
      <Text style={[s.title, { color: item.ready ? colors.text.secondary : colors.text.primary }]}>{item.title}</Text>
      <View style={[s.statusIndicator, item.ready ? { backgroundColor: colors.green[50] } : { backgroundColor: colors.text.primary }]}>
        {item.ready ? (
          <Text style={[s.readyText, { color: colors.green[700] }]}>Ready</Text>
        ) : (
          <Text style={[s.neededText, { color: colors.text.inverse }]}>Enable</Text>
        )}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  list: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  progressFill: {
    borderRadius: radius.full,
    height: '100%',
  },
  progressTrack: {
    borderRadius: radius.full,
    height: 6,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: {
    ...typography.body,
    flex: 1,
    fontWeight: '500',
  },
  rowIcon: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  statusIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neededText: {
    fontSize: 11,
    fontWeight: '700',
  },
  readyText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
