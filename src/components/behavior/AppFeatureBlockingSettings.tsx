import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Chip, Switch, Text } from 'react-native-paper';

import { Card } from '../Card';
import { Field } from '../controls';
import BlockerModule from '@/native/BlockerModule';
import { colors, radius, spacing, typography } from '@/theme';
import type { FeatureBlockSettings, InstalledApp, PolicyUpdate } from '@/types/blocker';

type FeatureBlockKey = keyof FeatureBlockSettings;

type AppFeatureBlockingSettingsProps = {
  settings: FeatureBlockSettings;
  pinConfigured: boolean;
  installedApps: InstalledApp[];
  onChange: (policy: PolicyUpdate) => Promise<void>;
};

type FeatureToggle = {
  key: FeatureBlockKey;
  label: string;
};

type FeatureGroup = {
  title: string;
  description?: string;
  items: FeatureToggle[];
  packages?: string[];
};

const featureGroups: FeatureGroup[] = [
  {
    title: 'Instagram',
    packages: ['com.instagram.android'],
    items: [
      { key: 'instagramDm', label: 'DM' },
      { key: 'instagramStories', label: 'Stories' },
      { key: 'instagramSearch', label: 'Search' },
      { key: 'instagramExplore', label: 'Explore' },
      { key: 'instagramReels', label: 'Reels' },
    ],
  },
  {
    title: 'YouTube',
    packages: ['com.google.android.youtube'],
    items: [
      { key: 'youtubeSearch', label: 'Search' },
      { key: 'youtubeShorts', label: 'Shorts' },
      { key: 'youtubeComments', label: 'Comments' },
      { key: 'pictureInPicture', label: 'Picture-in-picture' },
    ],
  },
  {
    title: 'Telegram',
    packages: [
      'org.telegram.messenger',
      'org.telegram.plus',
      'org.telegram.betas',
      'org.thunderdog.challegram',
    ],
    items: [
      { key: 'telegramSearch', label: 'Search' },
      { key: 'telegramSearchHistory', label: 'Search history' },
      { key: 'telegramChannels', label: 'Channels' },
      { key: 'telegramGroups', label: 'Groups' },
      { key: 'telegramBlockedAccounts', label: 'Blocked accounts' },
    ],
  },
  {
    title: 'Snapchat',
    packages: ['com.snapchat.android'],
    items: [
      { key: 'snapchatQuickAdd', label: 'Quick Add' },
      { key: 'snapchatSearch', label: 'Search' },
      { key: 'snapchatDiscover', label: 'Discover' },
      { key: 'snapchatStories', label: 'Stories' },
      { key: 'snapchatSpotlight', label: 'Spotlight' },
      { key: 'snapchatMaps', label: 'Maps' },
    ],
  },
  {
    title: 'X / Twitter',
    packages: ['com.twitter.android', 'com.twitter.android.lite'],
    items: [
      { key: 'twitterEraseAll', label: 'Block all X/Twitter surfaces' },
      { key: 'twitterBlockApp', label: 'Block X/Twitter app' },
      { key: 'twitterSearchMediaTrends', label: 'Search, videos, images, and trends' },
      { key: 'twitterForYou', label: 'For You page' },
    ],
  },
  {
    title: 'Discord',
    packages: ['com.discord'],
    items: [{ key: 'discordBlockApp', label: 'Block Discord app' }],
  },
  {
    title: 'Facebook',
    packages: ['com.facebook.katana', 'com.facebook.lite'],
    items: [
      { key: 'facebookBlockApp', label: 'Block Facebook app' },
      { key: 'facebookReels', label: 'Reels' },
      { key: 'facebookStories', label: 'Stories' },
      { key: 'facebookSearch', label: 'Search' },
      { key: 'facebookGroups', label: 'Groups' },
    ],
  },
  {
    title: 'Reddit and Pinterest',
    packages: ['com.reddit.frontpage', 'com.pinterest'],
    items: [
      { key: 'redditSearch', label: 'Reddit Search' },
      { key: 'redditSubreddits', label: 'Reddit subreddits' },
      { key: 'pinterestSearch', label: 'Pinterest Search' },
    ],
  },
  {
    title: 'TikTok',
    packages: ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill'],
    items: [
      { key: 'tiktokShorts', label: 'TikTok short-form feed' },
      { key: 'tiktokSearch', label: 'TikTok Search' },
    ],
  },
  {
    title: 'Streaming and browsers',
    items: [
      { key: 'liveStreamingApps', label: 'Live-streaming apps' },
      { key: 'browserUnsafeModes', label: 'Browser private or unsafe modes' },
    ],
  },
  {
    title: 'System safeguards',
    description: 'Blocks common protection bypass, uninstall, and APK install surfaces when Accessibility is enabled.',
    items: [
      { key: 'androidTamperSettings', label: 'Android protection settings' },
      { key: 'playStoreUninstallControls', label: 'Play Store uninstall controls' },
      { key: 'playStoreAdultInstallControls', label: 'Play Store adult-rated installs' },
      { key: 'packageInstallerControls', label: 'APK installer prompts' },
    ],
  },
];

const searchFeatureKeys: FeatureBlockKey[] = [
  'instagramSearch',
  'tiktokSearch',
  'youtubeSearch',
  'telegramSearch',
  'telegramSearchHistory',
  'snapchatSearch',
  'twitterSearchMediaTrends',
  'facebookSearch',
  'redditSearch',
  'pinterestSearch',
];

const highRiskFeatureKeys: FeatureBlockKey[] = [
  'instagramExplore',
  'instagramReels',
  'tiktokShorts',
  'youtubeShorts',
  'youtubeComments',
  'pictureInPicture',
  'snapchatDiscover',
  'snapchatSpotlight',
  'twitterForYou',
  'facebookReels',
  'facebookStories',
  'redditSubreddits',
  'liveStreamingApps',
  'browserUnsafeModes',
  'playStoreAdultInstallControls',
];

export function AppFeatureBlockingSettings({
  settings,
  pinConfigured,
  installedApps,
  onChange,
}: AppFeatureBlockingSettingsProps) {
  const [pin, setPin] = useState('');
  const [appIcons, setAppIcons] = useState<Record<string, string>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  const installedSet = useMemo(
    () => new Set(installedApps.map((a) => a.packageName.toLowerCase())),
    [installedApps],
  );

  const visibleGroups = useMemo(
    () =>
      featureGroups.filter(
        (group) => !group.packages || group.packages.some((pkg) => installedSet.has(pkg.toLowerCase())),
      ),
    [installedSet],
  );

  // For each visible group, resolve the installed package name (used for icon lookup)
  const groupInstalledPkg = useMemo(() => {
    const map: Record<string, string> = {};
    for (const group of visibleGroups) {
      if (!group.packages) continue;
      const found = group.packages.find((pkg) => installedSet.has(pkg.toLowerCase()));
      if (found) map[group.title] = found;
    }
    return map;
  }, [visibleGroups, installedSet]);

  useEffect(() => {
    let cancelled = false;

    const fetchIcons = async () => {
      const entries: Array<[string, string]> = [];
      for (const [, pkg] of Object.entries(groupInstalledPkg)) {
        if (fetchedRef.current.has(pkg)) continue;
        fetchedRef.current.add(pkg);
        try {
          const result = await BlockerModule.getAppIcon(pkg);
          if (result.iconBase64) {
            entries.push([pkg, result.iconBase64]);
          }
        } catch {
          // Icon unavailable
        }
      }
      if (!cancelled && entries.length > 0) {
        setAppIcons((prev) => {
          const next = { ...prev };
          for (const [pkg, b64] of entries) next[pkg] = b64;
          return next;
        });
      }
    };

    void fetchIcons();
    return () => { cancelled = true; };
  }, [groupInstalledPkg]);

  const featureCount = useMemo(() => {
    const allItems = visibleGroups.flatMap((group) => group.items);
    return {
      enabled: allItems.filter((item) => settings[item.key]).length,
      total: allItems.length,
    };
  }, [settings, visibleGroups]);

  const update = (policy: PolicyUpdate) => {
    void onChange(pinConfigured ? { ...policy, adminPin: pin } : policy);
  };

  const updateFeature = (key: FeatureBlockKey, value: boolean) => {
    update({ [key]: value } as PolicyUpdate);
  };

  const updateGroup = (group: FeatureGroup, value: boolean) => {
    const patch = group.items.reduce<Partial<FeatureBlockSettings>>((next, item) => {
      next[item.key] = value;
      return next;
    }, {});
    update(patch as PolicyUpdate);
  };

  const updateKeys = (keys: FeatureBlockKey[], value: boolean) => {
    const patch = keys.reduce<Partial<FeatureBlockSettings>>((next, key) => {
      next[key] = value;
      return next;
    }, {});
    update(patch as PolicyUpdate);
  };

  return (
    <Card
      title="App Rules"
      subtitle="Limit risky features in social, video, and browser apps."
      action={<Chip compact icon="shield-check-outline">{featureCount.enabled}/{featureCount.total} on</Chip>}
    >
      {pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label="PIN"
          onChangeText={setPin}
          placeholder="Enter PIN to make changes"
          secureTextEntry
          value={pin}
        />
      ) : null}

      <View style={styles.quickRow}>
        <Pressable accessibilityRole="button" onPress={() => updateKeys(searchFeatureKeys, true)} style={styles.quickChip}>
          <Text style={styles.quickChipText}>Block all search</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => updateKeys(highRiskFeatureKeys, true)} style={styles.quickChip}>
          <Text style={styles.quickChipText}>Block high-risk</Text>
        </Pressable>
      </View>

      {visibleGroups.map((group) => {
        const pkg = groupInstalledPkg[group.title];
        const iconBase64 = pkg ? appIcons[pkg] : undefined;
        return (
          <FeatureGroupSection
            key={group.title}
            group={group}
            settings={settings}
            onApplyGroup={updateGroup}
            onToggle={updateFeature}
            iconBase64={iconBase64}
          />
        );
      })}
    </Card>
  );
}

function FeatureGroupSection({
  group,
  settings,
  onApplyGroup,
  onToggle,
  iconBase64,
}: {
  group: FeatureGroup;
  settings: FeatureBlockSettings;
  onApplyGroup: (group: FeatureGroup, value: boolean) => void;
  onToggle: (key: FeatureBlockKey, value: boolean) => void;
  iconBase64?: string;
}) {
  const enabledCount = group.items.filter((item) => settings[item.key]).length;
  const allEnabled = enabledCount === group.items.length;

  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        {iconBase64 ? (
          <Image
            source={{ uri: `data:image/png;base64,${iconBase64}` }}
            style={styles.appIcon}
          />
        ) : null}
        <View style={styles.groupText}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          {group.description ? <Text style={styles.groupDescription}>{group.description}</Text> : null}
        </View>
        <Text style={styles.groupCount}>{enabledCount}/{group.items.length}</Text>
        <Switch value={allEnabled} onValueChange={(value) => onApplyGroup(group, value)} />
      </View>
      {group.items.map((item) => (
        <ToggleRow
          key={item.key}
          label={item.label}
          value={settings[item.key]}
          onValueChange={(value) => onToggle(item.key, value)}
        />
      ))}
    </View>
  );
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch onValueChange={onValueChange} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  quickChip: {
    borderColor: colors.border.default,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quickChipText: {
    ...typography.captionMd,
    color: colors.text.secondary,
  },
  group: {
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  groupText: {
    flex: 1,
    gap: 2,
  },
  groupTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  groupDescription: {
    ...typography.caption,
    color: colors.text.muted,
  },
  groupCount: {
    ...typography.caption,
    color: colors.text.muted,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  label: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  appIcon: {
    borderRadius: 8,
    height: 32,
    width: 32,
  },
});
