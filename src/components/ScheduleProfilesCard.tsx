import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, IconButton, Switch, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from './Card';
import { Button, Field } from './controls';
import { colors, radius, spacing, typography } from '@/theme';
import type { ActiveScheduleState, ScheduleProfile, StrictnessLevel } from '@/types/blocker';

type ScheduleProfilesCardProps = {
  profiles: ScheduleProfile[];
  activeState: ActiveScheduleState;
  onToggleProfile: (id: string) => Promise<void>;
  onUpdateProfile: (id: string, patch: Partial<ScheduleProfile>) => Promise<void>;
  onAddProfile: (profile: Omit<ScheduleProfile, 'id'>) => Promise<unknown>;
  onRemoveProfile: (id: string) => Promise<void>;
};

const STRICTNESS_COLORS: Record<StrictnessLevel, string> = {
  off: colors.text.muted,
  low: colors.blue[400],
  moderate: colors.amber[400],
  high: colors.purple[400],
  lockdown: colors.red[400],
};

const STRICTNESS_LABELS: Record<StrictnessLevel, string> = {
  off: 'Off',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  lockdown: 'Lockdown',
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 7];

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function ScheduleProfilesCard({
  profiles,
  activeState,
  onToggleProfile,
  onUpdateProfile,
  onAddProfile,
  onRemoveProfile,
}: ScheduleProfilesCardProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newStrictness, setNewStrictness] = useState<StrictnessLevel>('high');

  return (
    <Card
      title="Schedule Profiles"
      subtitle="Automatically adjust strictness by time of day."
    >
      {/* Active state banner */}
      {activeState.activeProfileId && (
        <View style={styles.activeBanner}>
          <MaterialCommunityIcons name="shield-check" size={20} color={colors.green[400]} />
          <View style={styles.activeBannerText}>
            <Text style={styles.activeLabel}>
              Active: {activeState.activeProfileLabel}
            </Text>
            <Text style={styles.activeStrictness}>
              Strictness: {STRICTNESS_LABELS[activeState.currentStrictness]}
            </Text>
          </View>
          <Chip
            compact
            style={{ backgroundColor: STRICTNESS_COLORS[activeState.currentStrictness] + '22' }}
            textStyle={{ color: STRICTNESS_COLORS[activeState.currentStrictness], fontSize: 11, fontWeight: '700' }}
          >
            {STRICTNESS_LABELS[activeState.currentStrictness]}
          </Chip>
        </View>
      )}

      {activeState.nextTransitionAt && (
        <Text style={styles.nextTransition}>
          Next: {activeState.nextProfileLabel} at{' '}
          {new Date(activeState.nextTransitionAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}

      {/* Profile list */}
      {profiles.map((profile) => (
        <ProfileRow
          key={profile.id}
          profile={profile}
          isActive={activeState.activeProfileId === profile.id}
          isEditing={editingId === profile.id}
          onToggle={() => void onToggleProfile(profile.id)}
          onEdit={() => setEditingId(editingId === profile.id ? null : profile.id)}
          onUpdate={(patch) => void onUpdateProfile(profile.id, patch)}
          onRemove={() => void onRemoveProfile(profile.id)}
        />
      ))}

      {/* Add new profile */}
      {showAdd ? (
        <View style={styles.addForm}>
          <Field label="Profile Name" onChangeText={setNewLabel} placeholder="e.g. Homework Time" value={newLabel} />
          <View style={styles.strictnessRow}>
            <Text style={styles.fieldLabel}>Strictness:</Text>
            <View style={styles.strictnessOptions}>
              {(['low', 'moderate', 'high', 'lockdown'] as StrictnessLevel[]).map((level) => (
                <Chip
                  key={level}
                  compact
                  selected={newStrictness === level}
                  onPress={() => setNewStrictness(level)}
                  style={newStrictness === level ? { backgroundColor: STRICTNESS_COLORS[level] + '22' } : undefined}
                  textStyle={{ fontSize: 11 }}
                >
                  {STRICTNESS_LABELS[level]}
                </Chip>
              ))}
            </View>
          </View>
          <View style={styles.addActions}>
            <Button
              icon="plus"
              disabled={!newLabel.trim()}
              onPress={() => {
                void onAddProfile({
                  label: newLabel.trim(),
                  icon: 'clock-outline',
                  strictness: newStrictness,
                  enabled: false,
                  startMinutes: 8 * 60,
                  endMinutes: 17 * 60,
                  daysOfWeek: [1, 2, 3, 4, 5],
                  overrides: {
                    adultFilteringEnabled: true,
                    behaviorProtectionEnabled: true,
                  },
                }).then(() => {
                  setNewLabel('');
                  setShowAdd(false);
                });
              }}
            >
              Create Profile
            </Button>
            <Button icon="close" tone="neutral" onPress={() => setShowAdd(false)}>
              Cancel
            </Button>
          </View>
        </View>
      ) : (
        <Button icon="plus" tone="neutral" onPress={() => setShowAdd(true)}>
          Add Schedule Profile
        </Button>
      )}
    </Card>
  );
}

function ProfileRow({
  profile,
  isActive,
  isEditing,
  onToggle,
  onEdit,
  onUpdate,
  onRemove,
}: {
  profile: ScheduleProfile;
  isActive: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onUpdate: (patch: Partial<ScheduleProfile>) => void;
  onRemove: () => void;
}) {
  const toggleDay = (day: number) => {
    const days = profile.daysOfWeek.includes(day)
      ? profile.daysOfWeek.filter((d) => d !== day)
      : [...profile.daysOfWeek, day].sort();
    onUpdate({ daysOfWeek: days });
  };

  return (
    <View style={[styles.profileCard, isActive && styles.profileCardActive]}>
      <View style={styles.profileHeader}>
        <MaterialCommunityIcons
          name={profile.icon as any}
          size={22}
          color={STRICTNESS_COLORS[profile.strictness]}
        />
        <View style={styles.profileInfo}>
          <Text style={styles.profileLabel}>{profile.label}</Text>
          <Text style={styles.profileTime}>
            {formatMinutes(profile.startMinutes)} – {formatMinutes(profile.endMinutes)}
          </Text>
        </View>
        <Chip
          compact
          style={{ backgroundColor: STRICTNESS_COLORS[profile.strictness] + '22' }}
          textStyle={{
            color: STRICTNESS_COLORS[profile.strictness],
            fontSize: 10,
            fontWeight: '700',
          }}
        >
          {STRICTNESS_LABELS[profile.strictness]}
        </Chip>
        <Switch
          color={colors.green[400]}
          value={profile.enabled}
          onValueChange={onToggle}
        />
        <IconButton icon="pencil-outline" size={18} onPress={onEdit} />
      </View>

      {isEditing && (
        <View style={styles.editSection}>
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>Start</Text>
              <View style={styles.timeStepper}>
                <IconButton icon="minus" size={16} onPress={() => onUpdate({ startMinutes: Math.max(0, profile.startMinutes - 30) })} />
                <Text style={styles.timeValue}>{formatMinutes(profile.startMinutes)}</Text>
                <IconButton icon="plus" size={16} onPress={() => onUpdate({ startMinutes: Math.min(23 * 60 + 30, profile.startMinutes + 30) })} />
              </View>
            </View>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>End</Text>
              <View style={styles.timeStepper}>
                <IconButton icon="minus" size={16} onPress={() => onUpdate({ endMinutes: Math.max(0, profile.endMinutes - 30) })} />
                <Text style={styles.timeValue}>{formatMinutes(profile.endMinutes)}</Text>
                <IconButton icon="plus" size={16} onPress={() => onUpdate({ endMinutes: Math.min(23 * 60 + 30, profile.endMinutes + 30) })} />
              </View>
            </View>
          </View>

          <View style={styles.daysRow}>
            {DAY_VALUES.map((day, i) => (
              <Chip
                key={day}
                compact
                selected={profile.daysOfWeek.includes(day)}
                onPress={() => toggleDay(day)}
                style={profile.daysOfWeek.includes(day) ? styles.dayActive : styles.dayInactive}
                textStyle={{ fontSize: 11 }}
              >
                {DAY_LABELS[i]}
              </Chip>
            ))}
          </View>

          <View style={styles.strictnessRow}>
            <Text style={styles.fieldLabel}>Strictness:</Text>
            <View style={styles.strictnessOptions}>
              {(['low', 'moderate', 'high', 'lockdown'] as StrictnessLevel[]).map((level) => (
                <Chip
                  key={level}
                  compact
                  selected={profile.strictness === level}
                  onPress={() => onUpdate({ strictness: level })}
                  style={profile.strictness === level ? { backgroundColor: STRICTNESS_COLORS[level] + '22' } : undefined}
                  textStyle={{ fontSize: 11 }}
                >
                  {STRICTNESS_LABELS[level]}
                </Chip>
              ))}
            </View>
          </View>

          <Button icon="delete-outline" tone="danger" onPress={onRemove}>
            Delete Profile
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  activeBanner: {
    alignItems: 'center',
    backgroundColor: colors.green[50],
    borderColor: colors.border.green,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  activeBannerText: {
    flex: 1,
  },
  activeLabel: {
    ...typography.bodyMd,
    color: colors.green[600],
  },
  activeStrictness: {
    ...typography.caption,
    color: colors.green[500],
  },
  nextTransition: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: 'center',
  },
  profileCard: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    overflow: 'hidden',
    padding: spacing.md,
  },
  profileCardActive: {
    borderColor: colors.green[400],
    backgroundColor: colors.green[50],
  },
  profileHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  profileInfo: {
    flex: 1,
  },
  profileLabel: {
    ...typography.bodyMd,
    color: colors.text.primary,
  },
  profileTime: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  editSection: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeField: {
    flex: 1,
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.captionMd,
    color: colors.text.secondary,
  },
  timeStepper: {
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeValue: {
    ...typography.bodyMd,
    color: colors.text.primary,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dayActive: {
    backgroundColor: colors.green[50],
  },
  dayInactive: {
    backgroundColor: colors.bg.secondary,
  },
  strictnessRow: {
    gap: spacing.xs,
  },
  strictnessOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  addForm: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  addActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
