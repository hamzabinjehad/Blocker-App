import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { AppIcon } from '@/components/AppIcon';
import { Card } from '@/components/Card';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { UrgeSurfingSheet } from '@/components/UrgeSurfingSheet';
import { getDailyCoachingNudge } from '@/services/coaching';
import { getTodaysMood } from '@/services/mood';
import type { MoodCheckIn } from '@/services/mood';
import { useGamification } from '@/store/useGamification';
import { emotionalStateLabels, triggerLabels, useRecovery } from '@/store/useRecovery';
import type { EmotionalState, TriggerSituation } from '@/store/useRecovery';
import { radius, spacing, typography, useTheme } from '@/theme';

const emotionalStateOptions = Object.keys(emotionalStateLabels) as EmotionalState[];
const triggerOptions = Object.keys(triggerLabels) as TriggerSituation[];

export default function CoachScreen() {
  const { colors } = useTheme();
  const recovery = useRecovery();
  const gamification = useGamification();
  const [journalText, setJournalText] = useState('');
  const [journalExpanded, setJournalExpanded] = useState(false);
  const [tip, setTip] = useState('Notice the first small choice. It is usually enough to change the next one.');
  const [urgeSheetVisible, setUrgeSheetVisible] = useState(false);
  const [momentSheetVisible, setMomentSheetVisible] = useState(false);
  const [currentMood, setCurrentMood] = useState<MoodCheckIn | null>(null);

  useEffect(() => {
    void getTodaysMood().then(setCurrentMood);
  }, []);

  const getYesterdayBlocks = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split('T')[0]!;
    return gamification.dayHistory.find((r) => r.date === yesterday)?.blocksCount ?? 0;
  };

  const buildCoachingStats = () => ({
    streak: gamification.currentStreak,
    level: gamification.level,
    blocksYesterday: getYesterdayBlocks(),
    cleanHoursYesterday: gamification.todayCleanHours,
    mood: currentMood ?? 'steady',
  });

  useEffect(() => {
    void getDailyCoachingNudge(buildCoachingStats()).then(setTip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMood]);

  const refreshTip = () => {
    void getDailyCoachingNudge(buildCoachingStats(), true).then(setTip);
  };

  const saveJournal = () => {
    recovery.addJournalEntry(journalText);
    if (journalText.trim()) {
      setJournalText('');
      gamification.recordJournalWritten();
      void gamification.awardXP(15, 'journal_entry');
    }
  };

  const completeChallenge = () => {
    recovery.completeChallenge();
    gamification.recordChallengeCompleted();
  };

  return (
    <ScreenScaffold title="Coach" subtitle="A quiet place for the next useful step." iconName="coach" collapsibleTitle>
      <View style={[s.tipCard, { backgroundColor: colors.green[50], borderColor: colors.border.green }]}>
        <View style={s.tipCardHeader}>
          <Text style={[s.tipCardLabel, { color: colors.green[600] }]}>TODAY'S TIP</Text>
          <Pressable accessibilityRole="button" onPress={refreshTip} style={s.textLinkButton}>
            <Text style={[s.swapLink, { color: colors.text.secondary }]}>Refresh</Text>
          </Pressable>
        </View>
        <Text style={[s.tipText, { color: colors.text.primary }]}>
          {tip}
        </Text>
      </View>

      <View style={s.actionGrid}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setUrgeSheetVisible(true)}
          style={[s.primaryAction, { backgroundColor: colors.green[500] }]}
        >
          <AppIcon name="coach" size={20} color={colors.text.inverse} />
          <Text style={[s.actionTitle, { color: colors.text.inverse }]}>I'm struggling</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setMomentSheetVisible(true)}
          style={[s.secondaryAction, { borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated }]}
        >
          <Feather name="edit-3" size={18} color={colors.green[500]} />
          <Text style={[s.actionTitle, { color: colors.text.primary }]}>Log a moment</Text>
        </Pressable>
      </View>

      <Card>
        {journalExpanded ? (
          <>
            <TextInput
              multiline
              onChangeText={setJournalText}
              placeholder="One sentence is enough."
              placeholderTextColor={colors.text.muted}
              style={[s.journalInput, { borderColor: colors.border.subtle, color: colors.text.primary }]}
              value={journalText}
            />
            <Pressable accessibilityRole="button" onPress={saveJournal} style={[s.sheetButton, { backgroundColor: colors.green[500] }]}>
              <Text style={[s.sheetButtonText, { color: colors.text.inverse }]}>Save note</Text>
            </Pressable>
          </>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setJournalExpanded(true)} style={s.journalRow}>
            <Feather name="edit-3" size={16} color={colors.text.secondary} />
            <Text style={[s.entryText, { color: colors.text.secondary }]}>Write a private note...</Text>
            <Feather name="chevron-right" size={18} color={colors.text.muted} />
          </Pressable>
        )}
      </Card>

      <Card>
        <View style={s.challengeHeader}>
          <View style={s.challengeCopy}>
            <Text style={[s.challengeTitle, { color: colors.text.primary }]}>{recovery.activeChallenge.title}</Text>
            <Text style={[s.challengeDetail, { color: colors.text.muted }]}>Weekly challenge · resets Sunday</Text>
            <Text style={[s.challengeDetail, { color: colors.text.secondary }]} numberOfLines={2}>
              {recovery.activeChallenge.detail}
            </Text>
          </View>
          <Text style={[s.challengeProgress, { color: colors.green[600] }]}>+100 XP</Text>
        </View>
        <View style={[s.challengeTrack, { backgroundColor: colors.border.subtle }]}>
          <View style={[s.challengeFill, { backgroundColor: colors.green[500], width: recovery.activeChallenge.completed ? '100%' : '0%' }]} />
        </View>
        <View style={s.challengeActions}>
          <Pressable accessibilityRole="button" disabled={recovery.activeChallenge.completed} onPress={completeChallenge}>
            <Text style={[s.challengeLink, { color: recovery.activeChallenge.completed ? colors.text.muted : colors.green[600] }]}>
              {recovery.activeChallenge.completed ? 'Completed' : 'Mark complete'}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={recovery.swapChallenge}>
            <Text style={[s.swapLink, { color: colors.text.secondary }]}>Swap challenge</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <View style={s.cardHeader}>
          <Text style={[s.cardTitle, { color: colors.text.primary }]}>Recent journal</Text>
        </View>
        {recovery.journalEntries.slice(0, 2).length > 0 ? (
          recovery.journalEntries.slice(0, 2).map((entry) => (
            <View key={entry.id} style={[s.entryRow, { borderTopColor: colors.border.subtle }]}>
              <Text style={[s.entryDate, { color: colors.text.muted }]}>
                {new Date(entry.createdAt).toLocaleDateString()}
              </Text>
              <Text style={[s.entryText, { color: colors.text.secondary }]} numberOfLines={1}>
                {entry.text}
              </Text>
            </View>
          ))
        ) : (
          <View style={s.emptyJournal}>
            <Feather name="book-open" size={24} color={colors.text.muted} />
            <Text style={[s.emptyText, { color: colors.text.secondary }]}>Your private entries will appear here.</Text>
          </View>
        )}
      </Card>

      <UrgeSurfingSheet visible={urgeSheetVisible} onClose={() => setUrgeSheetVisible(false)} />
      <MomentLogSheet visible={momentSheetVisible} onClose={() => setMomentSheetVisible(false)} />
    </ScreenScaffold>
  );
}

function MomentLogSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const recovery = useRecovery();
  const gamification = useGamification();
  const [emotionalState, setEmotionalState] = useState<EmotionalState>('stressed');
  const [trigger, setTrigger] = useState<TriggerSituation>('stress');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [pendingEntry, setPendingEntry] = useState(false);

  const saveMoment = (useFreeze: boolean) => {
    recovery.addRelapseLog({ emotionalState, trigger, notes });
    gamification.logRelapse(useFreeze);
    setNotes('');
    setPendingEntry(false);
    setSaved(true);
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={s.sheetBackdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: colors.bg.elevated }]}>
          <View style={[s.sheetHandle, { backgroundColor: colors.border.default }]} />
          <Text style={[s.sheetTitle, { color: colors.text.primary }]}>Log a moment</Text>
          {saved ? (
            <>
              <Text style={[s.sheetCopy, { color: colors.text.secondary }]}>Thank you for your honesty. +20 XP.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setSaved(false);
                  onClose();
                }}
                style={[s.sheetButton, { backgroundColor: colors.green[500] }]}
              >
                <Text style={[s.sheetButtonText, { color: colors.text.inverse }]}>Close</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[s.sheetCopy, { color: colors.text.secondary }]}>
                This stays private. No shame, just useful signal.
              </Text>
              <Text style={[s.fieldLabel, { color: colors.text.secondary }]}>Emotional state</Text>
              <View style={s.optionGrid}>
                {emotionalStateOptions.map((option) => (
                  <Pressable
                    accessibilityRole="button"
                    key={option}
                    onPress={() => setEmotionalState(option)}
                    style={[
                      s.optionChip,
                      {
                        backgroundColor: emotionalState === option ? colors.green[50] : colors.bg.tertiary,
                        borderColor: emotionalState === option ? colors.border.green : colors.border.subtle,
                      },
                    ]}
                  >
                    <Text style={[s.optionText, { color: colors.text.primary }]}>{emotionalStateLabels[option]}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[s.fieldLabel, { color: colors.text.secondary }]}>Trigger</Text>
              <View style={s.optionGrid}>
                {triggerOptions.map((option) => (
                  <Pressable
                    accessibilityRole="button"
                    key={option}
                    onPress={() => setTrigger(option)}
                    style={[
                      s.optionChip,
                      {
                        backgroundColor: trigger === option ? colors.green[50] : colors.bg.tertiary,
                        borderColor: trigger === option ? colors.border.green : colors.border.subtle,
                      },
                    ]}
                  >
                    <Text style={[s.optionText, { color: colors.text.primary }]}>{triggerLabels[option]}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                multiline
                onChangeText={setNotes}
                placeholder="Optional note"
                placeholderTextColor={colors.text.muted}
                style={[s.journalInput, { borderColor: colors.border.subtle, color: colors.text.primary }]}
                value={notes}
              />
              {pendingEntry ? (
                <>
                  <Text style={[s.sheetCopy, { color: colors.text.secondary }]}>
                    You used urge surfing today. Use your monthly freeze to protect your streak?
                  </Text>
                  <Pressable accessibilityRole="button" onPress={() => saveMoment(true)} style={[s.sheetButton, { backgroundColor: colors.green[500] }]}>
                    <Text style={[s.sheetButtonText, { color: colors.text.inverse }]}>Use streak freeze</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => saveMoment(false)} style={s.textButton}>
                    <Text style={[s.textButtonLabel, { color: colors.text.secondary }]}>Log without freeze</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (gamification.canUseStreakFreezeToday) {
                      setPendingEntry(true);
                    } else {
                      saveMoment(false);
                    }
                  }}
                  style={[s.sheetButton, { backgroundColor: colors.green[500] }]}
                >
                  <Text style={[s.sheetButtonText, { color: colors.text.inverse }]}>Save honestly</Text>
                </Pressable>
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  primaryAction: {
    alignItems: 'center',
    borderRadius: radius.lg,
    flex: 1,
    flexDirection: 'column',
    gap: spacing.xs,
    minHeight: 72,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryAction: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'column',
    gap: spacing.xs,
    minHeight: 72,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionTitle: {
    ...typography.bodyMd,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardMeta: {
    ...typography.caption,
  },
  cardTitle: {
    ...typography.h3,
  },
  challengeActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  challengeCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  challengeDetail: {
    ...typography.body,
  },
  challengeHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  challengeLink: {
    ...typography.bodyMd,
  },
  challengeProgress: {
    ...typography.captionMd,
  },
  challengeTitle: {
    ...typography.h3,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
  emptyJournal: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  entryDate: {
    ...typography.caption,
    width: 82,
  },
  entryRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  entryText: {
    ...typography.body,
    flex: 1,
  },
  textLinkButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
  },
  fieldLabel: {
    ...typography.captionMd,
  },
  journalInput: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 14,
    fontWeight: '400',
    minHeight: 86,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  journalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
  },
  optionChip: {
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionText: {
    ...typography.captionMd,
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.md,
    padding: spacing.xl,
    width: '100%',
  },
  sheetBackdrop: {
    backgroundColor: 'rgba(21,26,23,0.18)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  sheetButtonText: {
    ...typography.bodyMd,
  },
  sheetCopy: {
    ...typography.body,
  },
  sheetHandle: {
    alignSelf: 'center',
    borderRadius: radius.full,
    height: 4,
    width: 32,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '500',
  },
  textButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  textButtonLabel: {
    ...typography.bodyMd,
  },
  swapLink: {
    ...typography.caption,
  },
  timer: {
    ...typography.display,
    textAlign: 'center',
  },
  tipCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    padding: spacing.md,
  },
  tipCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tipCardLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  tipText: {
    ...typography.bodyLg,
    lineHeight: 26,
  },
  challengeTrack: {
    borderRadius: radius.full,
    height: 4,
    overflow: 'hidden',
  },
  challengeFill: {
    borderRadius: radius.full,
    height: '100%',
  },
});
