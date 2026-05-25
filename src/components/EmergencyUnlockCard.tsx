import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from './Card';
import { Button, Field } from './controls';
import { colors, radius, spacing, typography } from '@/theme';
import type { EmergencyPasscode, EmergencyUnlockState } from '@/types/blocker';

type EmergencyUnlockCardProps = {
  state: EmergencyUnlockState;
  loading: boolean;
  pinConfigured: boolean;
  onCreatePasscode: (durationMinutes?: number) => Promise<EmergencyPasscode>;
  onActivatePasscode: (code: string) => Promise<boolean>;
  onRevokePasscode: (id: string) => Promise<void>;
  onEndEmergencyUnlock: () => Promise<void>;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function EmergencyUnlockCard({
  state,
  loading,
  pinConfigured,
  onCreatePasscode,
  onActivatePasscode,
  onRevokePasscode,
  onEndEmergencyUnlock,
}: EmergencyUnlockCardProps) {
  const [inputCode, setInputCode] = useState('');
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);

  const durations = [15, 30, 60];

  const activePasscodes = state.history.filter(
    (p) => !p.used && !p.revokedAt && p.expiresAt > Date.now(),
  );

  return (
    <Card
      title="Emergency Unlock"
      subtitle="Generate time-limited passcodes for temporary access."
      accent={state.active ? 'amber' : 'none'}
    >
      {/* Active unlock banner */}
      {state.active && (
        <View style={styles.activeBanner}>
          <MaterialCommunityIcons name="lock-open" size={24} color={colors.amber[400]} />
          <View style={styles.activeBannerText}>
            <Text style={styles.activeTitle}>Emergency Unlock Active</Text>
            <Text style={styles.activeTimer}>
              Time remaining: {formatDuration(state.remainingSeconds)}
            </Text>
          </View>
          <Button icon="lock" tone="danger" onPress={() => void onEndEmergencyUnlock()}>
            End Now
          </Button>
        </View>
      )}

      {/* Generate passcode (admin action) */}
      {!state.active && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Generate Passcode (Admin)</Text>
          <Text style={styles.helpText}>
            Create a one-time passcode that grants temporary unrestricted access.
          </Text>
          <View style={styles.durationRow}>
            {durations.map((d) => (
              <Chip
                key={d}
                compact
                selected={selectedDuration === d}
                onPress={() => setSelectedDuration(d)}
                style={selectedDuration === d ? styles.durationActive : styles.durationInactive}
                textStyle={{ fontSize: 12 }}
              >
                {d} min
              </Chip>
            ))}
          </View>
          <Button
            icon="key-plus"
            loading={loading}
            onPress={() => {
              void onCreatePasscode(selectedDuration)
                .then((p) => setGeneratedCode(p.code))
                .catch(console.error);
            }}
          >
            Generate {selectedDuration}-Min Passcode
          </Button>

          {generatedCode && (
            <View style={styles.generatedDisplay}>
              <Text style={styles.generatedLabel}>Share this code with the user:</Text>
              <Text selectable style={styles.generatedCode}>{generatedCode}</Text>
              <Text style={styles.generatedNote}>
                This code can only be used once and expires if not used.
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Enter passcode (user action) */}
      {!state.active && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enter Passcode</Text>
          <Field
            label="Emergency Passcode"
            onChangeText={(v) => {
              setInputCode(v);
              setActivateError(null);
            }}
            placeholder="Enter 6-digit code"
            keyboardType="number-pad"
            value={inputCode}
          />
          {activateError && <Text style={styles.errorText}>{activateError}</Text>}
          <Button
            icon="lock-open"
            disabled={inputCode.length < 6}
            onPress={() => {
              void onActivatePasscode(inputCode).then((success) => {
                if (success) {
                  setInputCode('');
                  setActivateError(null);
                } else {
                  setActivateError('Invalid or expired passcode.');
                }
              }).catch(() => setActivateError('Failed to activate passcode.'));
            }}
          >
            Activate Emergency Unlock
          </Button>
        </View>
      )}

      {/* Active unused passcodes */}
      {activePasscodes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Unused Passcodes</Text>
          {activePasscodes.map((passcode) => (
            <View key={passcode.id} style={styles.passcodeRow}>
              <MaterialCommunityIcons name="key" size={16} color={colors.amber[400]} />
              <Text selectable style={styles.passcodeCode}>{passcode.code}</Text>
              <Text style={styles.passcodeMeta}>
                {passcode.durationMinutes}m · expires {formatTime(passcode.expiresAt)}
              </Text>
              <Button
                icon="close"
                tone="danger"
                onPress={() => void onRevokePasscode(passcode.id)}
              >
                Revoke
              </Button>
            </View>
          ))}
        </View>
      )}

      {/* History */}
      {state.history.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent History</Text>
          {state.history.slice(0, 5).map((passcode) => (
            <View key={passcode.id} style={styles.historyRow}>
              <Chip
                compact
                icon={passcode.used ? 'check' : passcode.revokedAt ? 'close' : 'clock-outline'}
                style={
                  passcode.used
                    ? styles.usedChip
                    : passcode.revokedAt
                    ? styles.revokedChip
                    : styles.activeChip
                }
                textStyle={{ fontSize: 10 }}
              >
                {passcode.used ? 'Used' : passcode.revokedAt ? 'Revoked' : 'Active'}
              </Chip>
              <Text style={styles.historyDuration}>{passcode.durationMinutes}m</Text>
              <Text style={styles.historyTime}>
                {new Date(passcode.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                {formatTime(passcode.createdAt)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  activeBanner: {
    alignItems: 'center',
    backgroundColor: colors.amber[50],
    borderColor: colors.border.amber,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
  },
  activeBannerText: {
    flex: 1,
    minWidth: 140,
  },
  activeTitle: {
    ...typography.bodyMd,
    color: colors.amber[500],
  },
  activeTimer: {
    fontFamily: 'monospace',
    fontSize: 20,
    fontWeight: '800',
    color: colors.amber[400],
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyMd,
    color: colors.text.primary,
  },
  helpText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  durationActive: {
    backgroundColor: colors.green[50],
  },
  durationInactive: {
    backgroundColor: colors.bg.tertiary,
  },
  generatedDisplay: {
    alignItems: 'center',
    backgroundColor: colors.green[50],
    borderColor: colors.border.green,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  generatedLabel: {
    ...typography.captionMd,
    color: colors.text.secondary,
  },
  generatedCode: {
    fontFamily: 'monospace',
    fontSize: 36,
    fontWeight: '800',
    color: colors.green[400],
    letterSpacing: 8,
  },
  generatedNote: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: 'center',
  },
  errorText: {
    ...typography.caption,
    color: colors.red[400],
    fontWeight: '700',
  },
  passcodeRow: {
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  passcodeCode: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  passcodeMeta: {
    ...typography.caption,
    color: colors.text.muted,
    flex: 1,
  },
  historyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  historyDuration: {
    ...typography.bodyMd,
    color: colors.text.secondary,
  },
  historyTime: {
    ...typography.caption,
    color: colors.text.muted,
    flex: 1,
    textAlign: 'right',
  },
  usedChip: {
    backgroundColor: 'rgba(61,163,77,0.14)',
  },
  revokedChip: {
    backgroundColor: 'rgba(242,85,85,0.14)',
  },
  activeChip: {
    backgroundColor: 'rgba(245,166,35,0.14)',
  },
});
