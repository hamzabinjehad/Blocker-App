import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';

import { Card } from './Card';
import { Button, Field } from './controls';
import { colors, radius } from '@/theme';
import type { BlocklistImportResult } from '@/types/blocker';

type DomainListCardProps = {
  blockedDomains: string[];
  allowlistedDomains: string[];
  pinConfigured: boolean;
  onAddBlockedDomain: (domain: string, pin?: string) => Promise<boolean>;
  onRemoveBlockedDomain: (domain: string, pin?: string) => Promise<boolean>;
  onImportBlockedDomains: (domains: string[], pin?: string) => Promise<BlocklistImportResult | undefined>;
  onAddAllowlistedDomain: (domain: string, pin?: string) => Promise<boolean>;
  onRemoveAllowlistedDomain: (domain: string, pin?: string) => Promise<boolean>;
};

export function DomainListCard({
  blockedDomains,
  allowlistedDomains,
  pinConfigured,
  onAddBlockedDomain,
  onRemoveBlockedDomain,
  onImportBlockedDomains,
  onAddAllowlistedDomain,
  onRemoveAllowlistedDomain,
}: DomainListCardProps) {
  const [domain, setDomain] = useState('');
  const [pin, setPin] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | undefined>();

  const addRule = async (kind: 'block' | 'allow') => {
    const applied = kind === 'block'
      ? await onAddBlockedDomain(domain, pin)
      : await onAddAllowlistedDomain(domain, pin);

    if (applied) {
      setDomain('');
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
      const domains = parseDomainImport(content);
      if (domains.length === 0) {
        setImportMessage('No valid domains were found in that file.');
        return;
      }

      const imported = await onImportBlockedDomains(domains, pin);
      if (imported) {
        setImportMessage(
          `Imported ${imported.imported} new domains from ${domains.length} parsed entries. ${imported.ignored} were duplicates or invalid.`,
        );
      }
    } catch (cause) {
      setImportMessage(cause instanceof Error ? cause.message : 'Unable to import that blocklist file.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card title="Domain Rules" subtitle="Add local block and allow rules that persist on this device.">
      {pinConfigured ? (
        <Field
          keyboardType="number-pad"
          label="Parent PIN for list changes"
          onChangeText={setPin}
          placeholder="Enter PIN"
          secureTextEntry
          value={pin}
        />
      ) : null}

      <Field label="Domain" onChangeText={setDomain} placeholder="domain.example" value={domain} />
      <View style={styles.actions}>
        <Button icon="block-helper" tone="danger" onPress={() => void addRule('block')}>
          Block Domain
        </Button>
        <Button icon="check-circle-outline" onPress={() => void addRule('allow')}>
          Allow Domain
        </Button>
        <Button icon="file-upload-outline" loading={importing} tone="neutral" onPress={() => void importFile()}>
          Import .txt / .csv
        </Button>
      </View>
      {importMessage ? <Text style={styles.importMessage}>{importMessage}</Text> : null}

      <RulePreview
        title="Blocked domains"
        domains={blockedDomains}
        emptyText="No custom blocked domains yet."
        icon="block-helper"
        tone="block"
        onRemove={(item) => void onRemoveBlockedDomain(item, pin)}
      />
      <RulePreview
        title="Allowed domains"
        domains={allowlistedDomains}
        emptyText="No custom allowed domains yet."
        icon="check"
        tone="allow"
        onRemove={(item) => void onRemoveAllowlistedDomain(item, pin)}
      />
      <Text style={styles.note}>Allowed domains override bundled and custom block rules for exact and subdomain matches.</Text>
    </Card>
  );
}

function parseDomainImport(content: string) {
  const domains = new Set<string>();
  content.split(/\r?\n/).forEach((line) => {
    domainsFromLine(line).forEach((domain) => domains.add(domain));
  });
  return [...domains].sort();
}

function domainsFromLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) return [];
  if (trimmed.startsWith('@@')) return [];

  const dnsmasq = trimmed.match(/^address=\/([^/]+)\//i);
  if (dnsmasq?.[1]) return [dnsmasq[1]].map(normalizeImportedDomain).filter(Boolean) as string[];

  const withoutComment = trimmed.replace(/\s+#.*$/, '');
  return withoutComment
    .split(/[,\s]+/)
    .map(normalizeImportedDomain)
    .filter(Boolean) as string[];
}

function normalizeImportedDomain(value: string) {
  let candidate = value
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^\|\|/, '')
    .replace(/^\*\./, '')
    .toLowerCase();

  if (!candidate || isIpAddress(candidate)) return undefined;
  candidate = candidate
    .replace(/^https?:\/\//, '')
    .split(/[/?#^]/)[0]
    .replace(/:\d+$/, '')
    .replace(/^\.+|\.+$/g, '');

  if (!candidate || isIpAddress(candidate) || !candidate.includes('.')) return undefined;
  if (!/^[a-z0-9._-]+$/.test(candidate)) return undefined;
  return candidate;
}

function isIpAddress(value: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value) || value.includes(':');
}

function RulePreview({
  title,
  domains,
  emptyText,
  icon,
  tone,
  onRemove,
}: {
  title: string;
  domains: string[];
  emptyText: string;
  icon: string;
  tone: 'allow' | 'block';
  onRemove: (domain: string) => void;
}) {
  return (
    <View style={styles.preview}>
      <Text style={styles.previewTitle}>{title}</Text>
      {domains.length > 0 ? (
        <View style={styles.ruleList}>
          {domains.map((domain) => (
            <Chip
              key={domain}
              compact
              closeIcon="close"
              icon={icon}
              onClose={() => onRemove(domain)}
              style={tone === 'allow' ? styles.allowChip : styles.blockChip}
            >
              {domain}
            </Chip>
          ))}
        </View>
      ) : (
        <Text style={styles.previewText}>{emptyText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  importMessage: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
  preview: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
    padding: 10,
  },
  previewTitle: {
    color: colors.text.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  previewText: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  ruleList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allowChip: {
    backgroundColor: 'rgba(30,206,164,0.14)',
  },
  blockChip: {
    backgroundColor: 'rgba(255,87,87,0.14)',
  },
  note: {
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 19,
  },
});
