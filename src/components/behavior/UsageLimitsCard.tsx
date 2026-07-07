import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Switch, Text } from 'react-native-paper';

import { Card } from '../Card';
import { Button, Field } from '../controls';
import { useTranslation } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import type { InstalledApp, UsageLimitPolicy, UsageLimitPolicyUpdate } from '@/types/blocker';

type Translate = ReturnType<typeof useTranslation>;

type UsageLimitsCardProps = {
  policy: UsageLimitPolicy;
  installedApps: InstalledApp[];
  usageAccessGranted: boolean;
  pinConfigured: boolean;
  onChange: (policy: UsageLimitPolicyUpdate) => Promise<void>;
  onRefreshApps: () => Promise<void>;
};

const commonCategories = [
  'social_media',
  'short_video',
  'browser',
  'private_browser',
  'livestream',
  'dating',
  'random_chat',
  'unsafe_ai',
  'apk_store',
  'vpn',
];

export function UsageLimitsCard({
  policy,
  installedApps,
  usageAccessGranted,
  pinConfigured,
  onChange,
  onRefreshApps,
}: UsageLimitsCardProps) {
  const t = useTranslation();
  const [pin, setPin] = useState('');
  const [category, setCategory] = useState('social_media');
  const [categoryMinutes, setCategoryMinutes] = useState('30');
  const [packageName, setPackageName] = useState('');
  const [appMinutes, setAppMinutes] = useState('30');
  const [appSearch, setAppSearch] = useState('');

  const categoryOptions = useMemo(() => {
    const appCategories = installedApps
      .map((app) => app.riskCategory)
      .filter((value): value is string => Boolean(value));
    return [...new Set([...commonCategories, ...Object.keys(policy.categoryLimits), ...appCategories])].sort();
  }, [installedApps, policy.categoryLimits]);

  const appRows = useMemo(() => {
    const query = appSearch.trim().toLowerCase();
    return installedApps
      .filter((app) => app.enabled)
      .filter((app) => !query || app.label.toLowerCase().includes(query) || app.packageName.includes(query))
      .slice(0, 12);
  }, [appSearch, installedApps]);

  const update = (patch: UsageLimitPolicyUpdate) => {
    void onChange(pinConfigured ? { ...patch, adminPin: pin } : patch);
  };

  const saveCategoryLimit = () => {
    const key = category.trim().toLowerCase();
    const minutes = clampLimit(categoryMinutes);
    if (!key) return;
    update({
      categoryLimits: minutes > 0
        ? { ...policy.categoryLimits, [key]: minutes }
        : omitKey(policy.categoryLimits, key),
    });
  };

  const saveAppLimit = (nextPackage = packageName) => {
    const key = nextPackage.trim().toLowerCase();
    const minutes = clampLimit(appMinutes);
    if (!key) return;
    update({
      appLimits: minutes > 0
        ? { ...policy.appLimits, [key]: minutes }
        : omitKey(policy.appLimits, key),
    });
    setPackageName('');
  };

  return (
    <Card
      title={t('limits.title')}
      subtitle={t('limits.subtitle')}
      action={
        <Chip compact icon={usageAccessGranted ? 'timeline-check-outline' : 'timeline-alert-outline'}>
          {usageAccessGranted ? t('limits.chipReady') : t('limits.chipNeeded')}
        </Chip>
      }
    >
      {pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label={t('limits.pinLabel')}
          onChangeText={setPin}
          placeholder={t('common.enterPin')}
          secureTextEntry
          value={pin}
        />
      ) : null}

      <View style={styles.row}>
        <Text style={styles.label}>{t('limits.enableToggle')}</Text>
        <Switch onValueChange={(enabled) => update({ enabled })} value={policy.enabled} />
      </View>

      <View style={styles.limitPanel}>
        <Text style={styles.sectionTitle}>{t('limits.categoryTitle')}</Text>
        <View style={styles.chipList}>
          {categoryOptions.map((item) => (
            <Chip
              key={item}
              compact
              selected={category === item}
              onPress={() => setCategory(item)}
            >
              {categoryLabel(item, t)}
            </Chip>
          ))}
        </View>
        <Field label={t('limits.categoryKey')} onChangeText={setCategory} placeholder={t('limits.categoryPlaceholder')} value={category} />
        <Field
          keyboardType="number-pad"
          label={t('limits.dailyMinutes')}
          onChangeText={setCategoryMinutes}
          placeholder="30"
          value={categoryMinutes}
        />
        <Button icon="content-save-outline" tone="neutral" onPress={saveCategoryLimit}>
          {t('limits.saveCategory')}
        </Button>
        <LimitChips limits={policy.categoryLimits} formatLabel={(value) => categoryLabel(value, t)} onRemove={(key) => update({ categoryLimits: omitKey(policy.categoryLimits, key) })} />
      </View>

      <View style={styles.limitPanel}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>{t('limits.perAppTitle')}</Text>
          <Button icon="refresh" tone="neutral" onPress={() => void onRefreshApps()}>
            {t('common.refresh')}
          </Button>
        </View>
        <Field label={t('limits.packageName')} onChangeText={setPackageName} placeholder={t('limits.packagePlaceholder')} value={packageName} />
        <Field
          keyboardType="number-pad"
          label={t('limits.dailyMinutes')}
          onChangeText={setAppMinutes}
          placeholder="30"
          value={appMinutes}
        />
        <Button icon="content-save-outline" tone="neutral" onPress={() => saveAppLimit()}>
          {t('limits.saveApp')}
        </Button>
        <LimitChips limits={policy.appLimits} onRemove={(key) => update({ appLimits: omitKey(policy.appLimits, key) })} />
        <Field label={t('limits.findApp')} onChangeText={setAppSearch} placeholder={t('limits.findAppPlaceholder')} value={appSearch} />
        <View style={styles.appList}>
          {appRows.map((app) => (
            <View key={app.packageName} style={styles.appRow}>
              <View style={styles.appText}>
                <Text style={styles.appLabel}>{app.label}</Text>
                <Text style={styles.packageName} numberOfLines={1}>{app.packageName}</Text>
              </View>
              <Button icon="timer-plus-outline" tone="neutral" onPress={() => saveAppLimit(app.packageName)}>
                {t('limits.limitBtn')}
              </Button>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.limitPanel}>
        <Text style={styles.sectionTitle}>{t('limits.today')}</Text>
        {policy.trackedApps.length > 0 ? policy.trackedApps.slice(0, 8).map((app) => (
          <View key={`${app.packageName}-${app.source}`} style={styles.usageDashboardRow}>
            <View style={styles.usageRow}>
              <Text style={styles.appLabel}>{app.appLabel}</Text>
              <Text style={styles.usageText}>{t('limits.usedOfLimit', { used: app.usedMinutes, limit: app.limitMinutes })}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: app.usedMinutes >= app.limitMinutes ? colors.red[400] : colors.green[500],
                    width: `${Math.min(100, Math.round((app.usedMinutes / Math.max(1, app.limitMinutes)) * 100))}%`,
                  },
                ]}
              />
            </View>
          </View>
        )) : (
          <Text style={styles.note}>{t('limits.noTracked')}</Text>
        )}
      </View>
    </Card>
  );
}

function LimitChips({
  limits,
  formatLabel = (value: string) => value,
  onRemove,
}: {
  limits: Record<string, number>;
  formatLabel?: (value: string) => string;
  onRemove: (key: string) => void;
}) {
  const t = useTranslation();
  const entries = Object.entries(limits).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) {
    return <Text style={styles.note}>{t('limits.noneConfigured')}</Text>;
  }

  return (
    <View style={styles.chipList}>
      {entries.map(([key, minutes]) => (
        <Chip key={key} compact closeIcon="close" onClose={() => onRemove(key)}>
          {formatLabel(key)}: {minutes}m
        </Chip>
      ))}
    </View>
  );
}

function clampLimit(value: string) {
  const minutes = Number.parseInt(value, 10);
  if (!Number.isFinite(minutes)) return 0;
  return Math.min(1440, Math.max(0, minutes));
}

function omitKey(values: Record<string, number>, key: string) {
  const next = { ...values };
  delete next[key];
  return next;
}

const categoryLabelKeys: Record<string, TranslationKey> = {
  social_media: 'limits.catSocialMedia',
  short_video: 'limits.catShortVideo',
  browser: 'limits.catBrowser',
  private_browser: 'limits.catPrivateBrowser',
  livestream: 'limits.catLivestream',
  dating: 'limits.catDating',
  random_chat: 'limits.catRandomChat',
  unsafe_ai: 'limits.catUnsafeAi',
  apk_store: 'limits.catApkStore',
  vpn: 'limits.catVpn',
};

// Known categories translate; ad-hoc ones (from installed-app metadata) fall
// back to prettified snake_case.
function categoryLabel(value: string, t: Translate) {
  const key = categoryLabelKeys[value];
  if (key) return t(key);
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  label: {
    ...typography.bodyMd,
    color: colors.text.primary,
    flex: 1,
  },
  sectionTitle: {
    ...typography.bodyMd,
    color: colors.text.primary,
  },
  limitPanel: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  appList: {
    gap: spacing.sm,
  },
  appRow: {
    alignItems: 'center',
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  appText: {
    flex: 1,
    gap: 2,
  },
  appLabel: {
    ...typography.bodyMd,
    color: colors.text.primary,
    flex: 1,
  },
  packageName: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  usageRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  note: {
    ...typography.body,
    color: colors.text.secondary,
  },
  progressFill: {
    borderRadius: radius.full,
    height: '100%',
  },
  progressTrack: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.full,
    height: 8,
    overflow: 'hidden',
  },
  usageDashboardRow: {
    gap: spacing.xs,
  },
  usageText: {
    ...typography.captionMd,
    color: colors.text.secondary,
  },
});
