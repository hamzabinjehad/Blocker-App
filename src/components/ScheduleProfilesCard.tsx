import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, IconButton, Switch, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from './Card';
import { TimeField } from './TimeField';
import { Button, Field } from './controls';
import { formatTimeOfDay, useI18n, weekdayShort } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';
import type { ActiveScheduleState, ScheduleProfile, StrictnessLevel } from '@/types/blocker';

type ScheduleProfilesCardProps = {
  profiles: ScheduleProfile[];
  activeState: ActiveScheduleState;
  onToggleProfile: (id: string) => Promise<void>;
  onUpdateProfile: (id: string, patch: Partial<ScheduleProfile>) => Promise<void>;
  onAddProfile: (profile: Omit<ScheduleProfile, 'id'>) => Promise<unknown>;
  onRemoveProfile: (id: string) => Promise<void>;
};

const STRICTNESS_LABEL_KEYS: Record<StrictnessLevel, TranslationKey> = {
  off: 'schedules.levelOff',
  low: 'schedules.levelLow',
  moderate: 'schedules.levelModerate',
  high: 'schedules.levelHigh',
  lockdown: 'schedules.levelLockdown',
};

// The three built-in profiles ship with English labels persisted in
// AsyncStorage; render them from keys, but keep user-created labels literal.
const DEFAULT_PROFILE_LABEL_KEYS: Record<string, TranslationKey> = {
  bedtime: 'schedules.profileBedtime',
  school: 'schedules.profileSchool',
  freetime: 'schedules.profileFreetime',
};

const DAY_VALUES = [1, 2, 3, 4, 5, 6, 7]; // 1 = Monday … 7 = Sunday

type Translate = ReturnType<typeof useI18n>['t'];

function profileLabel(profile: Pick<ScheduleProfile, 'id' | 'label'>, t: Translate): string {
  const key = DEFAULT_PROFILE_LABEL_KEYS[profile.id];
  return key ? t(key) : profile.label;
}

export function ScheduleProfilesCard({
  profiles,
  activeState,
  onToggleProfile,
  onUpdateProfile,
  onAddProfile,
  onRemoveProfile,
}: ScheduleProfilesCardProps) {
  const { colors } = useTheme();
  const { t, language } = useI18n();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newStrictness, setNewStrictness] = useState<StrictnessLevel>('high');

  const strictnessColors: Record<StrictnessLevel, string> = {
    off: colors.text.muted,
    low: colors.blue[400],
    moderate: colors.amber[400],
    high: colors.purple[400],
    lockdown: colors.red[400],
  };

  const activeProfile = activeState.activeProfileId
    ? profiles.find((p) => p.id === activeState.activeProfileId)
    : undefined;
  const nextProfile = activeState.nextProfileLabel
    ? profiles.find((p) => p.label === activeState.nextProfileLabel)
    : undefined;

  return (
    <Card title={t('schedules.title')} subtitle={t('schedules.subtitle')}>
      {/* Active state banner */}
      {activeProfile && (
        <View
          style={[
            styles.activeBanner,
            { backgroundColor: colors.green[50], borderColor: colors.border.green },
          ]}
        >
          <MaterialCommunityIcons name="shield-check" size={20} color={colors.green[400]} />
          <View style={styles.activeBannerText}>
            <Text style={[styles.activeLabel, { color: colors.green[600] }]}>
              {t('schedules.activeNow', { label: profileLabel(activeProfile, t) })}
            </Text>
            <Text style={[styles.activeStrictness, { color: colors.green[500] }]}>
              {t('schedules.strictnessValue', { level: t(STRICTNESS_LABEL_KEYS[activeState.currentStrictness]) })}
            </Text>
          </View>
          <Chip
            compact
            style={{ backgroundColor: strictnessColors[activeState.currentStrictness] + '22' }}
            textStyle={{ color: strictnessColors[activeState.currentStrictness], fontSize: 11, fontWeight: '700' }}
          >
            {t(STRICTNESS_LABEL_KEYS[activeState.currentStrictness])}
          </Chip>
        </View>
      )}

      {activeState.nextTransitionAt && activeState.nextProfileLabel && (
        <Text style={[styles.nextTransition, { color: colors.text.muted }]}>
          {t('schedules.next', {
            label: nextProfile ? profileLabel(nextProfile, t) : activeState.nextProfileLabel,
            time: formatTimeOfDay(
              new Date(activeState.nextTransitionAt).getHours() * 60 +
                new Date(activeState.nextTransitionAt).getMinutes(),
              language,
            ),
          })}
        </Text>
      )}

      {/* Profile list */}
      {profiles.map((profile) => (
        <ProfileRow
          key={profile.id}
          profile={profile}
          strictnessColors={strictnessColors}
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
        <View
          style={[styles.addForm, { backgroundColor: colors.bg.tertiary, borderColor: colors.border.subtle }]}
        >
          <Field
            label={t('schedules.nameLabel')}
            onChangeText={setNewLabel}
            placeholder={t('schedules.namePlaceholder')}
            value={newLabel}
          />
          <View style={styles.strictnessRow}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('schedules.strictness')}</Text>
            <View style={styles.strictnessOptions}>
              {(['low', 'moderate', 'high', 'lockdown'] as StrictnessLevel[]).map((level) => (
                <Chip
                  key={level}
                  compact
                  selected={newStrictness === level}
                  onPress={() => setNewStrictness(level)}
                  style={newStrictness === level ? { backgroundColor: strictnessColors[level] + '22' } : undefined}
                  textStyle={{ fontSize: 11 }}
                >
                  {t(STRICTNESS_LABEL_KEYS[level])}
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
              {t('schedules.create')}
            </Button>
            <Button icon="close" tone="neutral" onPress={() => setShowAdd(false)}>
              {t('common.cancel')}
            </Button>
          </View>
        </View>
      ) : (
        <Button icon="plus" tone="neutral" onPress={() => setShowAdd(true)}>
          {t('schedules.add')}
        </Button>
      )}
    </Card>
  );
}

function ProfileRow({
  profile,
  strictnessColors,
  isActive,
  isEditing,
  onToggle,
  onEdit,
  onUpdate,
  onRemove,
}: {
  profile: ScheduleProfile;
  strictnessColors: Record<StrictnessLevel, string>;
  isActive: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onUpdate: (patch: Partial<ScheduleProfile>) => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const { t, language } = useI18n();
  const label = profileLabel(profile, t);

  const toggleDay = (day: number) => {
    const days = profile.daysOfWeek.includes(day)
      ? profile.daysOfWeek.filter((d) => d !== day)
      : [...profile.daysOfWeek, day].sort();
    onUpdate({ daysOfWeek: days });
  };

  return (
    <View
      style={[
        styles.profileCard,
        { backgroundColor: colors.bg.tertiary, borderColor: colors.border.subtle },
        isActive && { backgroundColor: colors.green[50], borderColor: colors.green[400] },
      ]}
    >
      <View style={styles.profileHeader}>
        <MaterialCommunityIcons
          name={profile.icon as any}
          size={22}
          color={strictnessColors[profile.strictness]}
        />
        <View style={styles.profileInfo}>
          <Text style={[styles.profileLabel, { color: colors.text.primary }]}>{label}</Text>
          <Text style={[styles.profileTime, { color: colors.text.secondary }]}>
            {formatTimeOfDay(profile.startMinutes, language)} – {formatTimeOfDay(profile.endMinutes, language)}
          </Text>
        </View>
        <Chip
          compact
          style={{ backgroundColor: strictnessColors[profile.strictness] + '22' }}
          textStyle={{ color: strictnessColors[profile.strictness], fontSize: 10, fontWeight: '700' }}
        >
          {t(STRICTNESS_LABEL_KEYS[profile.strictness])}
        </Chip>
        <Switch color={colors.green[400]} value={profile.enabled} onValueChange={onToggle} />
        <IconButton
          accessibilityLabel={t('schedules.editA11y', { label })}
          icon="pencil-outline"
          size={18}
          onPress={onEdit}
        />
      </View>

      {isEditing && (
        <View style={[styles.editSection, { borderTopColor: colors.border.subtle }]}>
          <View style={styles.timeRow}>
            <TimeField
              label={t('schedules.start')}
              minutes={profile.startMinutes}
              onChange={(minutes) => onUpdate({ startMinutes: minutes })}
            />
            <TimeField
              label={t('schedules.end')}
              minutes={profile.endMinutes}
              onChange={(minutes) => onUpdate({ endMinutes: minutes })}
            />
          </View>

          <View style={styles.daysRow}>
            {DAY_VALUES.map((day) => (
              <Chip
                key={day}
                compact
                selected={profile.daysOfWeek.includes(day)}
                onPress={() => toggleDay(day)}
                style={{
                  backgroundColor: profile.daysOfWeek.includes(day) ? colors.green[50] : colors.bg.secondary,
                }}
                textStyle={{ fontSize: 11 }}
              >
                {weekdayShort(language, day % 7)}
              </Chip>
            ))}
          </View>

          <View style={styles.strictnessRow}>
            <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{t('schedules.strictness')}</Text>
            <View style={styles.strictnessOptions}>
              {(['low', 'moderate', 'high', 'lockdown'] as StrictnessLevel[]).map((level) => (
                <Chip
                  key={level}
                  compact
                  selected={profile.strictness === level}
                  onPress={() => onUpdate({ strictness: level })}
                  style={profile.strictness === level ? { backgroundColor: strictnessColors[level] + '22' } : undefined}
                  textStyle={{ fontSize: 11 }}
                >
                  {t(STRICTNESS_LABEL_KEYS[level])}
                </Chip>
              ))}
            </View>
          </View>

          <Button icon="delete-outline" tone="danger" onPress={onRemove}>
            {t('schedules.delete')}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  activeBanner: {
    alignItems: 'center',
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
  },
  activeStrictness: {
    ...typography.caption,
  },
  nextTransition: {
    ...typography.caption,
    textAlign: 'center',
  },
  profileCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    overflow: 'hidden',
    padding: spacing.md,
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
  },
  profileTime: {
    ...typography.caption,
  },
  editSection: {
    borderTopWidth: 1,
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fieldLabel: {
    ...typography.captionMd,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
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
