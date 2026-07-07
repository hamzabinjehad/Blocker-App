import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

import { Card } from '../Card';
import { useTranslation } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';
import type { BlocklistImportResult } from '@/types/blocker';

type WebsiteTab = 'blocked' | 'allowed';

type CustomKeywordManagerProps = {
  keywords: string[];
  blockedDomains: string[];
  allowlistedDomains: string[];
  blockedDomainCount: number;
  lastBlocklistUpdate: string;
  pinConfigured: boolean;
  onUpdateKeywordList: (keywords: string[], pin?: string) => Promise<void>;
  onAddBlockedDomain: (domain: string, pin?: string) => Promise<boolean>;
  onRemoveBlockedDomain: (domain: string, pin?: string) => Promise<boolean>;
  onImportBlockedDomains: (domains: string[], pin?: string) => Promise<BlocklistImportResult | undefined>;
  onAddAllowlistedDomain: (domain: string, pin?: string) => Promise<boolean>;
  onRemoveAllowlistedDomain: (domain: string, pin?: string) => Promise<boolean>;
};

export function CustomKeywordManager({
  keywords,
  blockedDomains,
  allowlistedDomains,
  blockedDomainCount,
  lastBlocklistUpdate,
  pinConfigured,
  onUpdateKeywordList,
  onAddBlockedDomain,
  onRemoveBlockedDomain,
  onImportBlockedDomains,
  onAddAllowlistedDomain,
  onRemoveAllowlistedDomain,
}: CustomKeywordManagerProps) {
  const { colors } = useTheme();
  const t = useTranslation();
  const [keyword, setKeyword] = useState('');
  const [domain, setDomain] = useState('');
  const [pin, setPin] = useState('');
  const [websiteTab, setWebsiteTab] = useState<WebsiteTab>('blocked');
  const [websiteSearch, setWebsiteSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | undefined>();

  const activeDomains = websiteTab === 'blocked' ? blockedDomains : allowlistedDomains;
  const filteredDomains = useMemo(() => {
    const query = normalizeDomainSearch(websiteSearch);
    if (!query) return activeDomains;
    return activeDomains.filter((item) => item.includes(query));
  }, [activeDomains, websiteSearch]);

  const suppliedPin = pin || undefined;

  const addKeyword = () => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return;
    void onUpdateKeywordList([...new Set([...keywords, normalized])], suppliedPin).then(() => setKeyword(''));
  };

  const removeKeyword = (item: string) => {
    void onUpdateKeywordList(keywords.filter((k) => k !== item), suppliedPin);
  };

  const addWebsite = async () => {
    const normalized = normalizeDomain(domain);
    if (!normalized) return;
    const added = websiteTab === 'blocked'
      ? await onAddBlockedDomain(normalized, suppliedPin)
      : await onAddAllowlistedDomain(normalized, suppliedPin);
    if (added) {
      setDomain('');
      setImportMessage(undefined);
    }
  };

  const removeWebsite = (item: string) => {
    if (websiteTab === 'blocked') void onRemoveBlockedDomain(item, suppliedPin);
    else void onRemoveAllowlistedDomain(item, suppliedPin);
  };

  const importWebsites = async () => {
    setImporting(true);
    setImportMessage(undefined);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ['text/plain', 'text/csv', 'text/comma-separated-values', 'application/csv'],
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri);
      const parsed = parseDomainImport(content);
      if (parsed.length === 0) {
        setImportMessage(t('keywords.importNoValid'));
        return;
      }
      const imported = await onImportBlockedDomains(parsed, suppliedPin);
      if (imported) {
        setImportMessage(t('keywords.importResult', { imported: imported.imported, ignored: imported.ignored }));
      }
    } catch (cause) {
      setImportMessage(cause instanceof Error ? cause.message : t('keywords.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const inputStyle = [s.input, { color: colors.text.primary, backgroundColor: colors.bg.elevated, borderColor: colors.border.default }];

  return (
    <Card
      title={t('keywords.title')}
      subtitle={t('keywords.subtitle')}
      action={
        <View style={[s.badge, { backgroundColor: colors.green[50] }]}>
          <Text style={[s.badgeText, { color: colors.green[600] }]}>
            {t('keywords.domainsBadge', { count: blockedDomainCount.toLocaleString() })}
          </Text>
        </View>
      }
    >
      {pinConfigured ? (
        <TextInput
          keyboardType="number-pad"
          placeholder={t('policy.pinPlaceholder')}
          placeholderTextColor={colors.text.muted}
          secureTextEntry
          style={inputStyle}
          onChangeText={setPin}
          value={pin}
        />
      ) : null}

      {/* Keywords */}
      <View style={s.section}>
        <Text style={[s.sectionLabel, { color: colors.text.secondary }]}>{t('keywords.sectionKeywords')}</Text>
        <View style={s.inputRow}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('keywords.addPlaceholder')}
            placeholderTextColor={colors.text.muted}
            returnKeyType="done"
            style={inputStyle}
            onChangeText={setKeyword}
            onSubmitEditing={addKeyword}
            value={keyword}
          />
          <Pressable
            accessibilityRole="button"
            onPress={addKeyword}
            style={[s.circleBtn, { backgroundColor: colors.green[500] }]}
          >
            <Feather name="plus" size={18} color="#fff" />
          </Pressable>
        </View>
        <View style={s.tagRow}>
          {keywords.length > 0 ? keywords.map((kw) => (
            <Pressable
              key={kw}
              accessibilityRole="button"
              onPress={() => removeKeyword(kw)}
              style={[s.tag, { backgroundColor: colors.green[50], borderColor: colors.border.green }]}
            >
              <Text style={[s.tagText, { color: colors.green[700] }]}>{kw}</Text>
              <Feather name="x" size={11} color={colors.green[600]} />
            </Pressable>
          )) : (
            <Text style={[s.emptyText, { color: colors.text.muted }]}>{t('keywords.empty')}</Text>
          )}
        </View>
      </View>

      {/* Websites */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={[s.sectionLabel, { color: colors.text.secondary }]}>{t('keywords.sectionWebsites')}</Text>
          <View style={s.sectionMeta}>
            <Text style={[s.metaText, { color: colors.text.muted }]}>{formatLastUpdate(lastBlocklistUpdate, t)}</Text>
            {websiteTab === 'blocked' ? (
              <Pressable
                accessibilityRole="button"
                disabled={importing}
                onPress={() => void importWebsites()}
                style={s.importBtn}
              >
                <Feather name="upload" size={13} color={importing ? colors.text.muted : colors.text.secondary} />
                <Text style={[s.importText, { color: importing ? colors.text.muted : colors.text.secondary }]}>
                  {importing ? t('keywords.importing') : t('keywords.import')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={[s.segControl, { backgroundColor: colors.bg.tertiary }]}>
          {(['blocked', 'allowed'] as WebsiteTab[]).map((tab) => {
            const selected = websiteTab === tab;
            const count = tab === 'blocked' ? blockedDomains.length : allowlistedDomains.length;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={tab}
                onPress={() => setWebsiteTab(tab)}
                style={[s.segBtn, selected && { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
              >
                <Text style={[s.segLabel, { color: selected ? colors.text.primary : colors.text.muted }]}>
                  {tab === 'blocked' ? t('keywords.tabBlocked') : t('keywords.tabAllowed')}{count > 0 ? ` (${count})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[s.searchRow, { backgroundColor: colors.bg.tertiary, borderColor: colors.border.subtle }]}>
          <Feather name="search" size={14} color={colors.text.muted} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={websiteTab === 'blocked' ? t('keywords.searchBlocked') : t('keywords.searchAllowed')}
            placeholderTextColor={colors.text.muted}
            style={[s.searchInput, { color: colors.text.primary }]}
            onChangeText={setWebsiteSearch}
            value={websiteSearch}
          />
          {websiteSearch ? (
            <Pressable accessibilityRole="button" onPress={() => setWebsiteSearch('')}>
              <Feather name="x" size={14} color={colors.text.muted} />
            </Pressable>
          ) : null}
        </View>

        <View style={s.inputRow}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('keywords.domainPlaceholder')}
            placeholderTextColor={colors.text.muted}
            returnKeyType="done"
            style={inputStyle}
            onChangeText={setDomain}
            onSubmitEditing={() => void addWebsite()}
            value={domain}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void addWebsite()}
            style={[
              s.actionBtn,
              websiteTab === 'blocked'
                ? { backgroundColor: colors.red[50], borderColor: colors.red[400] }
                : { backgroundColor: colors.green[50], borderColor: colors.green[500] },
            ]}
          >
            <Text style={[s.actionBtnText, { color: websiteTab === 'blocked' ? colors.red[500] : colors.green[600] }]}>
              {websiteTab === 'blocked' ? t('keywords.actionBlock') : t('keywords.actionAllow')}
            </Text>
          </Pressable>
        </View>

        <View style={s.tagRow}>
          {filteredDomains.length > 0 ? filteredDomains.slice(0, 48).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              onPress={() => removeWebsite(item)}
              style={[
                s.tag,
                websiteTab === 'blocked'
                  ? { backgroundColor: colors.red[50], borderColor: colors.red[100] }
                  : { backgroundColor: colors.green[50], borderColor: colors.border.green },
              ]}
            >
              <Text style={[s.tagText, { color: websiteTab === 'blocked' ? colors.red[500] : colors.green[700] }]}>
                {item}
              </Text>
              <Feather name="x" size={11} color={websiteTab === 'blocked' ? colors.red[400] : colors.green[600]} />
            </Pressable>
          )) : (
            <Text style={[s.emptyText, { color: colors.text.muted }]}>
              {websiteSearch
                ? t('keywords.noMatches', { query: websiteSearch })
                : websiteTab === 'blocked' ? t('keywords.noBlockedYet') : t('keywords.noAllowedYet')}
            </Text>
          )}
        </View>

        {filteredDomains.length > 48 ? (
          <Text style={[s.helpText, { color: colors.text.secondary }]}>
            {t('keywords.showingOf', { shown: 48, total: filteredDomains.length })}
          </Text>
        ) : null}
        {importMessage ? (
          <Text style={[s.helpText, { color: colors.text.secondary }]}>{importMessage}</Text>
        ) : null}
      </View>
    </Card>
  );
}

function formatLastUpdate(value: string, t: ReturnType<typeof useTranslation>): string {
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return '';
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days < 1) return t('keywords.updatedToday');
  if (days === 1) return t('keywords.updatedYesterday');
  return t('keywords.updatedDaysAgo', { days });
}

function parseDomainImport(content: string): string[] {
  const domains = new Set<string>();
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!') || trimmed.startsWith('@@')) return;

    const dnsmasq = trimmed.match(/^address=\/([^/]+)\//i);
    if (dnsmasq?.[1]) {
      const domain = normalizeDomain(dnsmasq[1]);
      if (domain) domains.add(domain);
      return;
    }

    const withoutComment = trimmed.replace(/\s+#.*$/, '');
    withoutComment.split(/[,\s]+/).forEach((part) => {
      const domain = normalizeDomain(part);
      if (domain) domains.add(domain);
    });
  });
  return [...domains].sort();
}

function normalizeDomain(value: string): string {
  let candidate = value
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^\|\|/, '')
    .replace(/^\*\./, '')
    .toLowerCase();

  candidate = candidate
    .replace(/^https?:\/\//, '')
    .split(/[/?#^]/)[0]
    .replace(/:\d+$/, '')
    .replace(/^\.+|\.+$/g, '');

  if (!candidate || /^\d{1,3}(\.\d{1,3}){3}$/.test(candidate) || candidate.includes(':')) return '';
  if (!candidate || !candidate.includes('.') || !/^[a-z0-9._-]+$/.test(candidate)) return '';
  return candidate;
}

function normalizeDomainSearch(value: string): string {
  return value
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^\|\|/, '')
    .replace(/^\*\./, '')
    .replace(/^https?:\/\//, '')
    .split(/[/?#^]/)[0]
    .replace(/:\d+$/, '')
    .replace(/^\.+|\.+$/g, '')
    .toLowerCase();
}

const s = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    ...typography.captionMd,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  metaText: {
    ...typography.caption,
  },
  importBtn: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  importText: {
    ...typography.caption,
    fontWeight: '500',
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    fontSize: 14,
    height: 44,
    paddingHorizontal: spacing.md,
  },
  circleBtn: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  actionBtn: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  actionBtnText: {
    ...typography.captionMd,
  },
  segControl: {
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 3,
    padding: 3,
  },
  segBtn: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
  segLabel: {
    ...typography.captionMd,
  },
  searchRow: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    height: 40,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  tagText: {
    ...typography.caption,
  },
  emptyText: {
    ...typography.body,
  },
  helpText: {
    ...typography.caption,
    lineHeight: 18,
  },
});
