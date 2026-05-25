import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Chip, IconButton, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Card } from './Card';
import { Button, Field } from './controls';
import { colors, radius, spacing, typography } from '@/theme';
import type { ProfileType, StrictnessLevel, UserProfile } from '@/types/blocker';

type ProfileManagerCardProps = {
  profiles: UserProfile[];
  activeProfile: UserProfile | null;
  loading: boolean;
  onCreateProfile: (name: string, type: ProfileType) => Promise<unknown>;
  onSwitchProfile: (id: string) => Promise<void>;
  onUpdateName: (id: string, name: string) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
  onResetToPreset: (id: string) => Promise<void>;
};

const TYPE_ICONS: Record<ProfileType, string> = {
  child: 'baby-face-outline',
  teen: 'account-school',
  adult: 'account',
};

const TYPE_LABELS: Record<ProfileType, string> = {
  child: 'Child',
  teen: 'Teen',
  adult: 'Adult',
};

const TYPE_DESCRIPTIONS: Record<ProfileType, string> = {
  child: 'Maximum protection, strict time limits, social media blocked',
  teen: 'Strong filtering, moderate limits, social media allowed',
  adult: 'Content filtering on, no time limits, self-accountability',
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

export function ProfileManagerCard({
  profiles,
  activeProfile,
  loading,
  onCreateProfile,
  onSwitchProfile,
  onUpdateName,
  onDeleteProfile,
  onResetToPreset,
}: ProfileManagerCardProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ProfileType>('teen');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Card title="User Profiles" subtitle="Graduated strictness levels per user age or role.">
      {/* Active profile summary */}
      {activeProfile && (
        <View style={styles.activeBanner}>
          <View style={[styles.avatar, { backgroundColor: activeProfile.avatarColor }]}>
            <MaterialCommunityIcons
              name={TYPE_ICONS[activeProfile.type] as any}
              size={24}
              color={colors.text.inverse}
            />
          </View>
          <View style={styles.activeInfo}>
            <Text style={styles.activeName}>{activeProfile.name}</Text>
            <Text style={styles.activeType}>
              {TYPE_LABELS[activeProfile.type]} · {STRICTNESS_LABELS[activeProfile.strictnessPreset]}
            </Text>
          </View>
          <Chip
            compact
            style={{ backgroundColor: STRICTNESS_COLORS[activeProfile.strictnessPreset] + '22' }}
            textStyle={{
              color: STRICTNESS_COLORS[activeProfile.strictnessPreset],
              fontSize: 10,
              fontWeight: '700',
            }}
          >
            Active
          </Chip>
        </View>
      )}

      {/* Profile list */}
      {profiles.map((profile) => (
        <ProfileRow
          key={profile.id}
          profile={profile}
          isExpanded={expandedId === profile.id}
          onPress={() => setExpandedId(expandedId === profile.id ? null : profile.id)}
          onSwitch={() => void onSwitchProfile(profile.id)}
          onDelete={() => void onDeleteProfile(profile.id)}
          onReset={() => void onResetToPreset(profile.id)}
          onUpdateName={(name) => void onUpdateName(profile.id, name)}
        />
      ))}

      {/* Create profile */}
      {showCreate ? (
        <View style={styles.createForm}>
          <Text style={styles.createTitle}>New Profile</Text>
          <Field label="Name" onChangeText={setNewName} placeholder="e.g. Alex" value={newName} />

          <Text style={styles.fieldLabel}>Profile Type</Text>
          {(['child', 'teen', 'adult'] as ProfileType[]).map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setNewType(type)}
              style={[styles.typeOption, newType === type && styles.typeOptionSelected]}
            >
              <MaterialCommunityIcons
                name={TYPE_ICONS[type] as any}
                size={24}
                color={newType === type ? colors.green[400] : colors.text.muted}
              />
              <View style={styles.typeInfo}>
                <Text style={[styles.typeLabel, newType === type && styles.typeLabelSelected]}>
                  {TYPE_LABELS[type]}
                </Text>
                <Text style={styles.typeDescription}>{TYPE_DESCRIPTIONS[type]}</Text>
              </View>
              {newType === type && (
                <MaterialCommunityIcons name="check-circle" size={20} color={colors.green[400]} />
              )}
            </TouchableOpacity>
          ))}

          <View style={styles.createActions}>
            <Button
              icon="account-plus"
              loading={loading}
              disabled={!newName.trim()}
              onPress={() => {
                void onCreateProfile(newName.trim(), newType).then(() => {
                  setNewName('');
                  setShowCreate(false);
                });
              }}
            >
              Create Profile
            </Button>
            <Button icon="close" tone="neutral" onPress={() => setShowCreate(false)}>
              Cancel
            </Button>
          </View>
        </View>
      ) : (
        <Button icon="account-plus" tone="neutral" onPress={() => setShowCreate(true)}>
          Add Profile
        </Button>
      )}

      {profiles.length === 0 && (
        <Text style={styles.emptyText}>
          No profiles created yet. Add a profile to customize protection levels for different users.
        </Text>
      )}
    </Card>
  );
}

function ProfileRow({
  profile,
  isExpanded,
  onPress,
  onSwitch,
  onDelete,
  onReset,
  onUpdateName,
}: {
  profile: UserProfile;
  isExpanded: boolean;
  onPress: () => void;
  onSwitch: () => void;
  onDelete: () => void;
  onReset: () => void;
  onUpdateName: (name: string) => void;
}) {
  const [editName, setEditName] = useState(profile.name);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.profileCard, profile.isActive && styles.profileCardActive]}
      activeOpacity={0.7}
    >
      <View style={styles.profileHeader}>
        <View style={[styles.avatarSmall, { backgroundColor: profile.avatarColor }]}>
          <MaterialCommunityIcons
            name={TYPE_ICONS[profile.type] as any}
            size={18}
            color={colors.text.inverse}
          />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{profile.name}</Text>
          <Text style={styles.profileMeta}>
            {TYPE_LABELS[profile.type]} · {STRICTNESS_LABELS[profile.strictnessPreset]}
          </Text>
        </View>
        {profile.isActive && (
          <Chip compact style={styles.activeChip} textStyle={styles.activeChipText}>
            Active
          </Chip>
        )}
        <IconButton
          icon={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          onPress={onPress}
        />
      </View>

      {isExpanded && (
        <View style={styles.expandedSection}>
          <View style={styles.settingsSummary}>
            <SettingRow label="Adult filtering" value={profile.settings.adultFilteringEnabled} />
            <SettingRow label="Safe search" value={profile.settings.safeSearchEnforced} />
            <SettingRow label="Behavior protection" value={profile.settings.behaviorProtectionEnabled} />
            <SettingRow label="Social media restricted" value={profile.settings.socialMediaRestricted} />
            <SettingRow label="App suspension" value={profile.settings.appSuspensionEnabled} />
            {profile.settings.maxDailyScreenTimeMinutes && (
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Daily screen time</Text>
                <Text style={styles.settingValue}>{profile.settings.maxDailyScreenTimeMinutes} min</Text>
              </View>
            )}
            {profile.settings.bedtimeStart != null && (
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Bedtime</Text>
                <Text style={styles.settingValue}>
                  {formatMinutes(profile.settings.bedtimeStart)} – {formatMinutes(profile.settings.bedtimeEnd!)}
                </Text>
              </View>
            )}
          </View>

          <Field
            label="Profile Name"
            onChangeText={setEditName}
            value={editName}
          />

          <View style={styles.profileActions}>
            {!profile.isActive && (
              <Button icon="swap-horizontal" onPress={onSwitch}>
                Switch to This Profile
              </Button>
            )}
            <Button
              icon="text-account"
              tone="neutral"
              disabled={editName.trim() === profile.name}
              onPress={() => onUpdateName(editName.trim())}
            >
              Rename
            </Button>
            <Button icon="refresh" tone="neutral" onPress={onReset}>
              Reset to Defaults
            </Button>
            <Button icon="delete-outline" tone="danger" onPress={onDelete}>
              Delete Profile
            </Button>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

function SettingRow({ label, value }: { label: string; value: boolean }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <MaterialCommunityIcons
        name={value ? 'check-circle' : 'close-circle'}
        size={16}
        color={value ? colors.green[400] : colors.text.muted}
      />
    </View>
  );
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

const styles = StyleSheet.create({
  activeBanner: {
    alignItems: 'center',
    backgroundColor: colors.green[50],
    borderColor: colors.border.green,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarSmall: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  activeInfo: {
    flex: 1,
  },
  activeName: {
    ...typography.h3,
    color: colors.text.primary,
  },
  activeType: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  profileCard: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  profileCardActive: {
    borderColor: colors.green[400],
  },
  profileHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...typography.bodyMd,
    color: colors.text.primary,
  },
  profileMeta: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  activeChip: {
    backgroundColor: colors.green[50],
  },
  activeChipText: {
    color: colors.green[500],
    fontSize: 10,
    fontWeight: '700',
  },
  expandedSection: {
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  settingsSummary: {
    gap: spacing.xs,
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  settingLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  settingValue: {
    ...typography.bodyMd,
    color: colors.text.primary,
  },
  profileActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  createForm: {
    backgroundColor: colors.bg.tertiary,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  createTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  fieldLabel: {
    ...typography.captionMd,
    color: colors.text.secondary,
  },
  typeOption: {
    alignItems: 'center',
    backgroundColor: colors.bg.secondary,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  typeOptionSelected: {
    borderColor: colors.green[400],
    backgroundColor: colors.green[50],
  },
  typeInfo: {
    flex: 1,
  },
  typeLabel: {
    ...typography.bodyMd,
    color: colors.text.primary,
  },
  typeLabelSelected: {
    color: colors.green[600],
  },
  typeDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  createActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
