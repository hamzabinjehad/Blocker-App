import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Chip, Switch, Text } from 'react-native-paper';

import { Card } from '../Card';
import { Field } from '../controls';
import { useTranslation } from '@/i18n';
import type { TranslationKey } from '@/i18n';
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
  labelKey: TranslationKey;
};

type FeatureGroup = {
  // Stable identifier; brand-name groups render it as-is, translatable groups
  // carry a titleKey instead.
  title: string;
  titleKey?: TranslationKey;
  descriptionKey?: TranslationKey;
  items: FeatureToggle[];
  packages?: string[];
};

const featureGroups: FeatureGroup[] = [
  {
    title: 'Instagram',
    packages: ['com.instagram.android'],
    items: [
      { key: 'instagramDm', labelKey: 'appRules.fDm' },
      { key: 'instagramStories', labelKey: 'appRules.fStories' },
      { key: 'instagramSearch', labelKey: 'appRules.fSearch' },
      { key: 'instagramExplore', labelKey: 'appRules.fExplore' },
      { key: 'instagramReels', labelKey: 'appRules.fReels' },
    ],
  },
  {
    title: 'YouTube',
    packages: ['com.google.android.youtube'],
    items: [
      { key: 'youtubeSearch', labelKey: 'appRules.fSearch' },
      { key: 'youtubeShorts', labelKey: 'appRules.fShorts' },
      { key: 'youtubeComments', labelKey: 'appRules.fComments' },
      { key: 'pictureInPicture', labelKey: 'appRules.fPip' },
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
      { key: 'telegramSearch', labelKey: 'appRules.fSearch' },
      { key: 'telegramSearchHistory', labelKey: 'appRules.fSearchHistory' },
      { key: 'telegramChannels', labelKey: 'appRules.fChannels' },
      { key: 'telegramGroups', labelKey: 'appRules.fGroups' },
      { key: 'telegramBlockedAccounts', labelKey: 'appRules.fBlockedAccounts' },
    ],
  },
  {
    title: 'Snapchat',
    packages: ['com.snapchat.android'],
    items: [
      { key: 'snapchatQuickAdd', labelKey: 'appRules.fQuickAdd' },
      { key: 'snapchatSearch', labelKey: 'appRules.fSearch' },
      { key: 'snapchatDiscover', labelKey: 'appRules.fDiscover' },
      { key: 'snapchatStories', labelKey: 'appRules.fStories' },
      { key: 'snapchatSpotlight', labelKey: 'appRules.fSpotlight' },
      { key: 'snapchatMaps', labelKey: 'appRules.fMaps' },
    ],
  },
  {
    title: 'X / Twitter',
    packages: ['com.twitter.android', 'com.twitter.android.lite'],
    items: [
      { key: 'twitterEraseAll', labelKey: 'appRules.fTwitterAll' },
      { key: 'twitterBlockApp', labelKey: 'appRules.fTwitterApp' },
      { key: 'twitterSearchMediaTrends', labelKey: 'appRules.fTwitterSearchMedia' },
      { key: 'twitterForYou', labelKey: 'appRules.fForYou' },
    ],
  },
  {
    title: 'Discord',
    packages: ['com.discord'],
    items: [{ key: 'discordBlockApp', labelKey: 'appRules.fDiscordApp' }],
  },
  {
    title: 'Facebook',
    packages: ['com.facebook.katana', 'com.facebook.lite'],
    items: [
      { key: 'facebookBlockApp', labelKey: 'appRules.fFacebookApp' },
      { key: 'facebookReels', labelKey: 'appRules.fReels' },
      { key: 'facebookStories', labelKey: 'appRules.fStories' },
      { key: 'facebookSearch', labelKey: 'appRules.fSearch' },
      { key: 'facebookGroups', labelKey: 'appRules.fGroups' },
    ],
  },
  {
    title: 'Reddit and Pinterest',
    titleKey: 'appRules.groupRedditPinterest',
    packages: ['com.reddit.frontpage', 'com.pinterest'],
    items: [
      { key: 'redditSearch', labelKey: 'appRules.fRedditSearch' },
      { key: 'redditSubreddits', labelKey: 'appRules.fRedditSubs' },
      { key: 'pinterestSearch', labelKey: 'appRules.fPinterestSearch' },
    ],
  },
  {
    title: 'TikTok',
    packages: ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill'],
    items: [
      { key: 'tiktokShorts', labelKey: 'appRules.fTiktokFeed' },
      { key: 'tiktokSearch', labelKey: 'appRules.fTiktokSearch' },
    ],
  },
  {
    title: 'Streaming and browsers',
    titleKey: 'appRules.groupStreaming',
    items: [
      { key: 'liveStreamingApps', labelKey: 'appRules.fLiveStreaming' },
      { key: 'browserUnsafeModes', labelKey: 'appRules.fBrowserUnsafe' },
    ],
  },
  {
    title: 'System safeguards',
    titleKey: 'appRules.groupSafeguards',
    descriptionKey: 'appRules.groupSafeguardsDesc',
    items: [
      { key: 'androidTamperSettings', labelKey: 'appRules.fTamperSettings' },
      { key: 'playStoreUninstallControls', labelKey: 'appRules.fPlayUninstall' },
      { key: 'playStoreAdultInstallControls', labelKey: 'appRules.fPlayAdultInstalls' },
      { key: 'packageInstallerControls', labelKey: 'appRules.fApkPrompts' },
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
  const t = useTranslation();
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
      title={t('appRules.title')}
      subtitle={t('appRules.subtitle')}
      action={
        <Chip compact icon="shield-check-outline">
          {t('appRules.onCount', { enabled: featureCount.enabled, total: featureCount.total })}
        </Chip>
      }
    >
      {pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label={t('policy.pinLabel')}
          onChangeText={setPin}
          placeholder={t('policy.pinPlaceholder')}
          secureTextEntry
          value={pin}
        />
      ) : null}

      <View style={styles.quickRow}>
        <Pressable accessibilityRole="button" onPress={() => updateKeys(searchFeatureKeys, true)} style={styles.quickChip}>
          <Text style={styles.quickChipText}>{t('appRules.blockAllSearch')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => updateKeys(highRiskFeatureKeys, true)} style={styles.quickChip}>
          <Text style={styles.quickChipText}>{t('appRules.blockHighRisk')}</Text>
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
  const t = useTranslation();
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
          <Text style={styles.groupTitle}>{group.titleKey ? t(group.titleKey) : group.title}</Text>
          {group.descriptionKey ? <Text style={styles.groupDescription}>{t(group.descriptionKey)}</Text> : null}
        </View>
        <Text style={styles.groupCount}>{enabledCount}/{group.items.length}</Text>
        <Switch value={allEnabled} onValueChange={(value) => onApplyGroup(group, value)} />
      </View>
      {group.items.map((item) => (
        <ToggleRow
          key={item.key}
          label={t(item.labelKey)}
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
