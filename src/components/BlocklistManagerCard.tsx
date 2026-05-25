import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Chip, Searchbar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

import { Card } from './Card';
import { Button, Field } from './controls';
import { colors, radius, spacing, typography } from '@/theme';
import type { BlocklistImportResult } from '@/types/blocker';

type BlocklistManagerCardProps = {
  blockedDomains: string[];
  allowlistedDomains: string[];
  blockedDomainCount: number;
  lastBlocklistUpdate: string;
  pinConfigured: boolean;
  onAddBlockedDomain: (domain: string, pin?: string) => Promise<boolean>;
  onRemoveBlockedDomain: (domain: string, pin?: string) => Promise<boolean>;
  onImportBlockedDomains: (domains: string[], pin?: string) => Promise<BlocklistImportResult | undefined>;
  onAddAllowlistedDomain: (domain: string, pin?: string) => Promise<boolean>;
  onRemoveAllowlistedDomain: (domain: string, pin?: string) => Promise<boolean>;
};

type Tab = 'blocklist' | 'allowlist';

export function BlocklistManagerCard({
  blockedDomains,
  allowlistedDomains,
  blockedDomainCount,
  lastBlocklistUpdate,
  pinConfigured,
  onAddBlockedDomain,
  onRemoveBlockedDomain,
  onImportBlockedDomains,
  onAddAllowlistedDomain,
  onRemoveAllowlistedDomain,
}: BlocklistManagerCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('blocklist');
  const [domain, setDomain] = useState('');
  const [pin, setPin] = useState('');
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | undefined>();
  const [note, setNote] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const domains = activeTab === 'blocklist' ? blockedDomains : allowlistedDomains;
  const filteredDomains = search
    ? domains.filter((d) => d.includes(search.toLowerCase()))
    : domains;

  const addDomain = async () => {
    if (!domain.trim()) return;
    const added = activeTab === 'blocklist'
      ? await onAddBlockedDomain(domain.trim(), pin || undefined)
      : await onAddAllowlistedDomain(domain.trim(), pin || undefined);
    if (added) {
      setDomain('');
      setNote('');
      setShowAdd(false);
    }
  };

  const removeDomain = (d: string) => {
    if (activeTab === 'blocklist') {
      void onRemoveBlockedDomain(d, pin || undefined);
    } else {
      void onRemoveAllowlistedDomain(d, pin || undefined);
    }
  };

  const importFile = async () => {
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
        setImportMessage('No valid domains were found in that file.');
        return;
      }

      const imported = await onImportBlockedDomains(parsed, pin || undefined);
      if (imported) {
        setImportMessage(
          `Imported ${imported.imported} new domains from ${parsed.length} parsed entries. ${imported.ignored} duplicates.`,
        );
      }
    } catch (cause) {
      setImportMessage(cause instanceof Error ? cause.message : 'Unable to import that file.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card title="Blocklist Manager" subtitle="Manage domains that are always blocked or always allowed.">
      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{blockedDomainCount.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Blocked</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.green[400] }]}>{allowlistedDomains.length}</Text>
          <Text style={styles.statLabel}>Allowed</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.text.muted }]}>{blockedDomains.length}</Text>
          <Text style={styles.statLabel}>Custom</Text>
        </View>
      </View>

      <Text style={styles.updateText}>Last update: {lastBlocklistUpdate}</Text>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          onPress={() => setActiveTab('blocklist')}
          style={[styles.tab, activeTab === 'blocklist' && styles.tabActive]}
        >
          <MaterialCommunityIcons
            name="block-helper"
            size={16}
            color={activeTab === 'blocklist' ? colors.red[400] : colors.text.muted}
          />
          <Text style={[styles.tabLabel, activeTab === 'blocklist' && styles.tabLabelActive]}>
            Blocklist ({blockedDomains.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('allowlist')}
          style={[styles.tab, activeTab === 'allowlist' && styles.tabActive]}
        >
          <MaterialCommunityIcons
            name="check-circle-outline"
            size={16}
            color={activeTab === 'allowlist' ? colors.green[400] : colors.text.muted}
          />
          <Text style={[styles.tabLabel, activeTab === 'allowlist' && styles.tabLabelActive]}>
            Allowlist ({allowlistedDomains.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* PIN */}
      {pinConfigured && (
        <Field
          keyboardType="number-pad"
          label="Parent PIN"
          onChangeText={setPin}
          placeholder="Required for changes"
          secureTextEntry
          value={pin}
        />
      )}

      {/* Search */}
      <Searchbar
        placeholder={`Search ${activeTab}...`}
        onChangeText={setSearch}
        value={search}
        style={styles.searchbar}
        inputStyle={styles.searchInput}
        elevation={0}
      />

      {/* Domain list */}
      <View style={styles.domainList}>
        {filteredDomains.length === 0 ? (
          <Text style={styles.emptyText}>
            {search ? `No domains matching "${search}"` : `No custom ${activeTab === 'blocklist' ? 'blocked' : 'allowed'} domains.`}
          </Text>
        ) : (
          filteredDomains.map((d) => (
            <View key={d} style={styles.domainRow}>
              <MaterialCommunityIcons
                name={activeTab === 'blocklist' ? 'block-helper' : 'check-circle'}
                size={14}
                color={activeTab === 'blocklist' ? colors.red[400] : colors.green[400]}
              />
              <Text style={styles.domainText} numberOfLines={1}>{d}</Text>
              <TouchableOpacity onPress={() => removeDomain(d)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close-circle" size={18} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {filteredDomains.length > 0 && filteredDomains.length < domains.length && (
        <Text style={styles.filterNote}>
          Showing {filteredDomains.length} of {domains.length} domains
        </Text>
      )}

      {/* Add domain */}
      {showAdd ? (
        <View style={styles.addForm}>
          <Field
            label="Domain"
            onChangeText={setDomain}
            placeholder="example.com"
            value={domain}
          />
          <View style={styles.addActions}>
            <Button
              icon={activeTab === 'blocklist' ? 'block-helper' : 'check-circle-outline'}
              tone={activeTab === 'blocklist' ? 'danger' : 'primary'}
              disabled={!domain.trim()}
              onPress={() => void addDomain()}
            >
              {activeTab === 'blocklist' ? 'Block Domain' : 'Allow Domain'}
            </Button>
            <Button icon="close" tone="neutral" onPress={() => setShowAdd(false)}>
              Cancel
            </Button>
          </View>
        </View>
      ) : (
        <View style={styles.addActions}>
          <Button icon="plus" onPress={() => setShowAdd(true)}>
            Add Domain
          </Button>
          {activeTab === 'blocklist' && (
            <Button icon="file-upload-outline" loading={importing} tone="neutral" onPress={() => void importFile()}>
              Import File
            </Button>
          )}
        </View>
      )}

      {importMessage && <Text style={styles.importMessage}>{importMessage}</Text>}

      <Text style={styles.helpNote}>
        {activeTab === 'blocklist'
          ? 'Custom blocked domains are checked in addition to bundled blocklists.'
          : 'Allowed domains override all block rules for exact and subdomain matches.'}
      </Text>
    </Card>
  );
}

function parseDomainImport(content: string): string[] {
  const domains = new Set<string>();
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!') || trimmed.startsWith('@@')) return;

    const dnsmasq = trimmed.match(/^address=\/([^/]+)\//i);
    if (dnsmasq?.[1]) {
      const d = normalizeDomain(dnsmasq[1]);
      if (d) domains.add(d);
      return;
    }

    const withoutComment = trimmed.replace(/\s+#.*$/, '');
    withoutComment.split(/[,\s]+/).forEach((part) => {
      const d = normalizeDomain(part);
      if (d) domains.add(d);
    });
  });
  return [...domains].sort();
}

function normalizeDomain(value: string): string | undefined {
  let candidate = value
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^\|\|/, '')
    .replace(/^\*\./, '')
    .toLowerCase();

  if (!candidate || /^\d{1,3}(\.\d{1,3}){3}$/.test(candidate) || candidate.includes(':')) return undefined;
  candidate = candidate
    .replace(/^https?:\/\//, '')
    .split(/[/?#^]/)[0]
    .replace(/:\d+$/, '')
    .replace(/^\.+|\.+$/g, '');

  if (!candidate || !candidate.includes('.') || !/^[a-z0-9._-]+$/.test(candidate)) return undefined;
  return candidate;
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
    fontSize: 22,
    fontWeight: '800',
    color: colors.red[400],
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  updateText: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: 'center',
  },
  tabRow: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    flexDirection: 'row',
    overflow: 'hidden',
    padding: 3,
  },
  tab: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  tabActive: {
    backgroundColor: colors.bg.secondary,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  tabLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  tabLabelActive: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  searchbar: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 42,
  },
  searchInput: {
    fontSize: 14,
    minHeight: 42,
  },
  domainList: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    maxHeight: 280,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  domainRow: {
    alignItems: 'center',
    borderBottomColor: colors.border.subtle,
    borderBottomWidth: 0.5,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  domainText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 13,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
  filterNote: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: 'center',
  },
  addForm: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  addActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  importMessage: {
    ...typography.body,
    color: colors.text.secondary,
  },
  helpNote: {
    ...typography.caption,
    color: colors.text.secondary,
    lineHeight: 18,
  },
});
