import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Chip, Switch, Text } from 'react-native-paper';

import { Card } from '../Card';
import { Button, Field } from '../controls';
import BlockerModule from '@/native/BlockerModule';
import { colors, radius, spacing, typography } from '@/theme';
import type { FeatureBlockSettings, InstalledApp, PolicyUpdate } from '@/types/blocker';

type FeatureBlockKey = keyof FeatureBlockSettings;

type AppFeatureBlockingSettingsProps = {
  settings: FeatureBlockSettings;
  keywords: string[];
  blockedDomains: string[];
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
  keywords,
  blockedDomains,
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
      title="App Feature Blocking Settings"
      subtitle="Block high-risk app surfaces and keep keyword and website rule coverage visible."
      action={<Chip compact icon="shield-check-outline">{featureCount.enabled}/{featureCount.total} on</Chip>}
    >
      {pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label="Parent PIN for feature changes"
          onChangeText={setPin}
          placeholder="Enter PIN"
          secureTextEntry
          value={pin}
        />
      ) : null}

      <View style={styles.coverageRow}>
        <Chip compact icon="text-search">{keywords.length} keywords</Chip>
        <Chip compact icon="web-off">{blockedDomains.length} websites</Chip>
      </View>

      <View style={styles.quickActions}>
        <Button icon="magnify" tone="neutral" onPress={() => updateKeys(searchFeatureKeys, true)}>
          Block Search Features
        </Button>
        <Button icon="shield-alert-outline" tone="neutral" onPress={() => updateKeys(highRiskFeatureKeys, true)}>
          Block High-Risk Features
        </Button>
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
        <Text style={styles.groupDescription}>{enabledCount}/{group.items.length}</Text>
      </View>
      <View style={styles.groupActions}>
        <Button
          tone="neutral"
          onPress={() => onApplyGroup(group, true)}
          disabled={allEnabled}
        >
          Enable All
        </Button>
        <Button
          tone="neutral"
          onPress={() => onApplyGroup(group, false)}
          disabled={enabledCount === 0}
        >
          Disable All
        </Button>
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
  coverageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  quickActions: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
  },
  group: {
    paddingVertical: spacing.md,
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
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
  groupActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.xs,
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
