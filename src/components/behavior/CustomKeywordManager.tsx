import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Searchbar, Text } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

import { Card } from '../Card';
import { Button, Field } from '../controls';
import { colors, radius, spacing, typography } from '@/theme';
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
    void onUpdateKeywordList(keywords.filter((keywordItem) => keywordItem !== item), suppliedPin);
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
    if (websiteTab === 'blocked') {
      void onRemoveBlockedDomain(item, suppliedPin);
    } else {
      void onRemoveAllowlistedDomain(item, suppliedPin);
    }
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
        setImportMessage('No valid websites were found in that file.');
        return;
      }

      const imported = await onImportBlockedDomains(parsed, suppliedPin);
      if (imported) {
        setImportMessage(
          `Imported ${imported.imported} new websites from ${parsed.length} parsed entries. ${imported.ignored} duplicates.`,
        );
      }
    } catch (cause) {
      setImportMessage(cause instanceof Error ? cause.message : 'Unable to import that file.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card
      title="Keywords and Websites"
      subtitle="Manage blocked terms and custom website rules from one place."
      action={<Chip compact icon="shield-lock-outline">{blockedDomainCount.toLocaleString()} domains</Chip>}
    >
      <View style={styles.statsRow}>
        <Stat label="Keywords" value={keywords.length} />
        <Stat label="Blocked" value={blockedDomains.length} tone="red" />
        <Stat label="Allowed" value={allowlistedDomains.length} tone="green" />
      </View>

      {pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label="Parent PIN for rule changes"
          onChangeText={setPin}
          placeholder="Enter PIN"
          secureTextEntry
          value={pin}
        />
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Block Keywords</Text>
        <View style={styles.inlineForm}>
          <View style={styles.inlineField}>
            <Field
              label="Blocked keyword"
              onChangeText={setKeyword}
              placeholder="Add a custom blocked term"
              value={keyword}
            />
          </View>
          <Button icon="plus-circle-outline" onPress={addKeyword}>
            Add
          </Button>
        </View>
        <View style={styles.list}>
          {keywords.length > 0 ? (
            keywords.map((item) => (
              <Chip
                key={item}
                compact
                closeIcon="close"
                icon="text-search"
                onClose={() => removeKeyword(item)}
                style={styles.keyword}
              >
                {item}
              </Chip>
            ))
          ) : (
            <Text style={styles.emptyText}>No custom keywords yet.</Text>
          )}
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Block Websites</Text>
          <Text style={styles.updateText}>Updated: {lastBlocklistUpdate}</Text>
        </View>

        <View style={styles.tabRow}>
          <Chip
            compact
            icon="block-helper"
            selected={websiteTab === 'blocked'}
            onPress={() => setWebsiteTab('blocked')}
          >
            Blocked ({blockedDomains.length})
          </Chip>
          <Chip
            compact
            icon="check-circle-outline"
            selected={websiteTab === 'allowed'}
            onPress={() => setWebsiteTab('allowed')}
          >
            Allowed ({allowlistedDomains.length})
          </Chip>
        </View>

        <Searchbar
          placeholder={`Search ${websiteTab} websites`}
          onChangeText={setWebsiteSearch}
          value={websiteSearch}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          elevation={0}
        />

        <View style={styles.inlineForm}>
          <View style={styles.inlineField}>
            <Field
              label={websiteTab === 'blocked' ? 'Website to block' : 'Website to allow'}
              onChangeText={setDomain}
              placeholder="example.com"
              value={domain}
            />
          </View>
          <Button
            icon={websiteTab === 'blocked' ? 'block-helper' : 'check-circle-outline'}
            tone={websiteTab === 'blocked' ? 'danger' : 'primary'}
            onPress={() => void addWebsite()}
          >
            {websiteTab === 'blocked' ? 'Block' : 'Allow'}
          </Button>
        </View>

        {websiteTab === 'blocked' ? (
          <Button icon="file-upload-outline" loading={importing} tone="neutral" onPress={() => void importWebsites()}>
            Import Websites
          </Button>
        ) : null}

        <View style={styles.list}>
          {filteredDomains.length > 0 ? (
            filteredDomains.slice(0, 48).map((item) => (
              <Chip
                key={item}
                compact
                closeIcon="close"
                icon={websiteTab === 'blocked' ? 'web-off' : 'web-check'}
                onClose={() => removeWebsite(item)}
                style={websiteTab === 'blocked' ? styles.blockedWebsite : styles.allowedWebsite}
              >
                {item}
              </Chip>
            ))
          ) : (
            <Text style={styles.emptyText}>
              {websiteSearch ? `No websites matching "${websiteSearch}"` : `No custom ${websiteTab} websites.`}
            </Text>
          )}
        </View>

        {filteredDomains.length > 48 ? (
          <Text style={styles.helpText}>Showing 48 of {filteredDomains.length} matching websites.</Text>
        ) : null}
        {importMessage ? <Text style={styles.helpText}>{importMessage}</Text> : null}
      </View>
    </Card>
  );
}

function Stat({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'green' | 'red' }) {
  const valueColor = tone === 'green' ? colors.green[500] : tone === 'red' ? colors.red[400] : colors.text.primary;

  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: valueColor }]}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
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

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.sm,
    flex: 1,
    gap: 2,
    paddingVertical: spacing.sm,
  },
  statValue: {
    ...typography.h2,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  panel: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...typography.bodyMd,
    color: colors.text.primary,
  },
  updateText: {
    ...typography.caption,
    color: colors.text.muted,
  },
  inlineForm: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inlineField: {
    flex: 1,
    minWidth: 180,
  },
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  keyword: {
    backgroundColor: 'rgba(30,206,164,0.14)',
  },
  blockedWebsite: {
    backgroundColor: colors.red[50],
  },
  allowedWebsite: {
    backgroundColor: colors.green[50],
  },
  searchbar: {
    backgroundColor: colors.bg.primary,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 42,
  },
  searchInput: {
    fontSize: 14,
    minHeight: 42,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
  },
  helpText: {
    ...typography.caption,
    color: colors.text.secondary,
    lineHeight: 18,
  },
});
