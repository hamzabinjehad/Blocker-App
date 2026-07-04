import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { Card } from './Card';
import { Button, Field } from './controls';
import { relativeTimeLabel, useI18n } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import { colors, radius } from '@/theme';
import type { RecentBlockedDomain } from '@/types/blocker';

type RecentlyBlockedCardProps = {
  pinConfigured: boolean;
  getRecentBlockedDomains: (limit?: number) => Promise<RecentBlockedDomain[]>;
  onAllowDomain: (domain: string, pin?: string) => Promise<boolean>;
};

const CATEGORY_KEYS: Record<string, TranslationKey> = {
  adult: 'category.adult',
  bypass: 'category.bypass',
  search: 'category.search',
  tamper: 'category.tamper',
  allowlist: 'category.allowlist',
};

const CATEGORY_TINTS: Record<string, { bg: string; fg: string }> = {
  adult: { bg: colors.red[50], fg: colors.red[600] },
  bypass: { bg: colors.amber[50], fg: colors.amber[700] },
  search: { bg: colors.green[50], fg: colors.green[600] },
};

export function RecentlyBlockedCard({
  pinConfigured,
  getRecentBlockedDomains,
  onAllowDomain,
}: RecentlyBlockedCardProps) {
  const { t, language } = useI18n();
  const [items, setItems] = useState<RecentBlockedDomain[]>([]);
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState('');
  const [pendingDomain, setPendingDomain] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getRecentBlockedDomains(20));
    } finally {
      setLoading(false);
    }
  }, [getRecentBlockedDomains]);

  useEffect(() => {
    void load();
  }, [load]);

  const allow = async (domain: string) => {
    setPendingDomain(domain);
    try {
      const applied = await onAllowDomain(domain, pin);
      if (applied) {
        setItems((current) => current.filter((item) => item.domain !== domain));
      }
    } finally {
      setPendingDomain(undefined);
    }
  };

  return (
    <Card title={t('recentlyBlocked.title')} subtitle={t('recentlyBlocked.subtitle')}>
      {pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label={t('recentlyBlocked.pinLabel')}
          onChangeText={setPin}
          placeholder={t('common.enterPin')}
          secureTextEntry
          value={pin}
        />
      ) : null}

      {items.length > 0 ? (
        <View style={styles.list}>
          {items.map((item) => {
            const tint = CATEGORY_TINTS[item.category] ?? {
              bg: colors.bg.tertiary,
              fg: colors.text.secondary,
            };
            const categoryKey = CATEGORY_KEYS[item.category];
            return (
              <View key={item.domain} style={styles.row}>
                <View style={styles.rowCopy}>
                  <Text style={styles.domain} numberOfLines={1}>
                    {item.domain}
                  </Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.categoryChip, { backgroundColor: tint.bg }]}>
                      <Text style={[styles.categoryChipText, { color: tint.fg }]}>
                        {categoryKey ? t(categoryKey) : item.category}
                      </Text>
                    </View>
                    <Text style={styles.meta}>
                      {item.count > 1 ? `${item.count}× · ` : ''}
                      {relativeTimeLabel(language, item.lastBlockedAt)}
                    </Text>
                  </View>
                </View>
                <Button
                  icon="check-circle-outline"
                  loading={pendingDomain === item.domain}
                  onPress={() => void allow(item.domain)}
                >
                  {t('common.allow')}
                </Button>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyText}>
          {loading ? t('recentlyBlocked.loading') : t('recentlyBlocked.empty')}
        </Text>
      )}

      <Button icon="refresh" tone="neutral" loading={loading} onPress={() => void load()}>
        {t('common.refresh')}
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  rowCopy: {
    flex: 1,
    gap: 4,
  },
  domain: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  categoryChip: {
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  meta: {
    color: colors.text.secondary,
    fontSize: 12,
  },
  emptyText: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
});
