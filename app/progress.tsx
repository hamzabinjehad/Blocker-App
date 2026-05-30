import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { Card } from '@/components/Card';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { useGamification } from '@/store/useGamification';
import type { DayRecord } from '@/store/useGamification';
import { useRecovery } from '@/store/useRecovery';
import { radius, spacing, typography, useTheme } from '@/theme';

function StreakCalendar({
  days,
  selectedDate,
  onSelect,
}: {
  days: DayRecord[];
  selectedDate?: string;
  onSelect: (day: DayRecord) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={s.calendarGrid}>
      {days.map((day) => (
        <Pressable
          accessibilityRole="button"
          key={day.date}
          onPress={() => onSelect(day)}
          style={[
            s.calendarCell,
            calendarStyle(day, colors),
            selectedDate === day.date ? { borderColor: colors.text.primary, borderWidth: 1 } : null,
          ]}
        />
      ))}
    </View>
  );
}

export default function ProgressScreen() {
  const { colors } = useTheme();
  const gamification = useGamification();
  const recovery = useRecovery();
  const [selectedDay, setSelectedDay] = useState<DayRecord | undefined>();
  const [milestoneVisible, setMilestoneVisible] = useState(Boolean(gamification.latestMilestoneBadge));

  useEffect(() => {
    if (gamification.latestMilestoneBadge) setMilestoneVisible(true);
  }, [gamification.latestMilestoneBadge?.id]);
  const progressRatio = Math.min(1, gamification.xpProgress.current / gamification.xpProgress.required);
  const earnedBadges = gamification.badges.filter((badge) => badge.earned).slice(0, 6);
  const visibleBadges = earnedBadges.length > 0 ? earnedBadges : gamification.badges.slice(0, 3);
  const maxWeeklyBlocks = Math.max(1, ...gamification.weeklyBlockCounts.map((day) => day.blocks));
  const calendarDays = gamification.calendarDays.length > 0 ? gamification.calendarDays : buildFallbackCalendarDays();

  return (
    <ScreenScaffold title="Progress" subtitle="Small signals, shown quietly." iconName="progress">
      <Card>
        <View style={s.cardHeader}>
          <View>
            <Text style={[s.cardTitle, { color: colors.text.primary }]}>Streak calendar</Text>
            <Text style={[s.cardMeta, { color: colors.text.secondary }]}>Last 12 weeks</Text>
          </View>
          <Text style={[s.streakValue, { color: colors.green[600] }]}>{gamification.currentStreak} days</Text>
        </View>
        <StreakCalendar
          days={calendarDays}
          selectedDate={selectedDay?.date}
          onSelect={setSelectedDay}
        />
        {selectedDay ? (
          <View style={[s.dayDetail, { backgroundColor: colors.bg.tertiary }]}>
            <Text style={[s.insightText, { color: colors.text.primary }]}>{selectedDay.date}</Text>
            <Text style={[s.supportCopy, { color: colors.text.secondary }]}>
              {daySummary(selectedDay)}
            </Text>
          </View>
        ) : null}
      </Card>

      <Card>
        <View style={s.levelHeader}>
          <View>
            <Text style={[s.cardTitle, { color: colors.text.primary }]}>Level {gamification.level}</Text>
            <Text style={[s.cardMeta, { color: colors.text.secondary }]}>{levelName(gamification.level)}</Text>
            <Text style={[s.cardMeta, { color: colors.text.secondary }]}>
              {gamification.xpProgress.current} / {gamification.xpProgress.required} XP
            </Text>
          </View>
          <AppIcon name="xp" size={24} color={colors.green[500]} />
        </View>
        <View style={[s.track, { backgroundColor: colors.bg.tertiary }]}>
          <View style={[s.fill, { backgroundColor: colors.green[500], width: `${progressRatio * 100}%` }]} />
        </View>
        <Text style={[s.supportCopy, { color: colors.text.secondary }]}>{Math.round(progressRatio * 100)}% to Level {gamification.level + 1}</Text>
      </Card>

      {gamification.latestMilestoneBadge ? (
        <Pressable accessibilityRole="button" onPress={() => setMilestoneVisible(true)}>
          <Card accent="green">
            <Text style={[s.cardTitle, { color: colors.text.primary }]}>
              {gamification.latestMilestoneBadge.label}
            </Text>
            <Text style={[s.supportCopy, { color: colors.text.secondary }]}>
              {milestoneMessage(gamification.latestMilestoneBadge.id)}
            </Text>
          </Card>
        </Pressable>
      ) : null}

      <Modal animationType="fade" transparent visible={Boolean(gamification.latestMilestoneBadge) && milestoneVisible}>
        <View style={s.milestoneBackdrop}>
          <View style={[s.milestoneScreen, { backgroundColor: colors.bg.elevated }]}>
            <Text style={[s.cardTitle, { color: colors.text.primary }]}>
              {gamification.latestMilestoneBadge?.label}
            </Text>
            <Text style={[s.milestoneTitle, { color: colors.green[600] }]}>
              Milestone unlocked
            </Text>
            <Text style={[s.supportCopy, { color: colors.text.secondary, textAlign: 'center' }]}>
              {milestoneMessage(gamification.latestMilestoneBadge?.id ?? '')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setMilestoneVisible(false)}
              style={[s.milestoneButton, { backgroundColor: colors.green[500] }]}
            >
              <Text style={[s.milestoneButtonText, { color: colors.text.inverse }]}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Card>
        <View style={s.cardHeader}>
          <View>
            <Text style={[s.cardTitle, { color: colors.text.primary }]}>Private support</Text>
            <Text style={[s.cardMeta, { color: colors.text.secondary }]}>Only visible to you</Text>
          </View>
          <Text style={[s.supportCopy, { color: colors.text.secondary }]}>
            {recovery.urgesSurfed > 0 ? `${recovery.urgesSurfed} urges surfed` : 'No urges logged yet'}
          </Text>
        </View>
        {recovery.relapseLogs.length >= 4 ? (
          <View style={[s.insightBox, { backgroundColor: colors.bg.tertiary }]}>
            <Text style={[s.insightText, { color: colors.text.primary }]}>{recovery.topTriggerInsight}</Text>
          </View>
        ) : (
          <Text style={[s.supportCopy, { color: colors.text.secondary }]}>
            Pattern insights appear after 4 private moment logs.
          </Text>
        )}
      </Card>

      <Card>
        <View style={s.cardHeader}>
          <Text style={[s.cardTitle, { color: colors.text.primary }]}>Badges</Text>
          <Text style={[s.cardMeta, { color: colors.text.secondary }]}>
            {earnedBadges.length} earned
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.badgeGrid}>
          {(earnedBadges.length > 0 ? visibleBadges : [
            { id: 'locked-7', label: '7-day streak', earned: false },
            { id: 'locked-surf', label: 'First surf', earned: false },
            { id: 'locked-journal', label: 'Journaler', earned: false },
          ]).map((badge) => (
            <View key={badge.id} style={[s.badge, { borderColor: colors.border.subtle, backgroundColor: colors.bg.tertiary }]}>
              <AppIcon name={badge.earned ? 'check' : 'shield'} size={16} color={badge.earned ? colors.green[500] : colors.text.muted} />
              <Text style={[s.badgeLabel, { color: colors.text.secondary }]} numberOfLines={1}>
                {badge.label}
              </Text>
            </View>
          ))}
        </ScrollView>
      </Card>

      <Card>
        <View style={s.cardHeader}>
          <Text style={[s.cardTitle, { color: colors.text.primary }]}>Weekly usage</Text>
          <Text style={[s.cardMeta, { color: colors.text.secondary }]}>Blocked moments</Text>
        </View>
        <View style={s.chart}>
          {gamification.weeklyBlockCounts.map((day) => (
            <View key={day.date} style={s.chartColumn}>
              <View style={s.chartBarSlot}>
                <View
                  style={[
                    s.chartBar,
                    {
                      backgroundColor: day.blocks > 0 ? colors.green[500] : colors.border.subtle,
                      height: `${Math.max(8, (day.blocks / maxWeeklyBlocks) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[s.chartValue, { color: colors.text.secondary }]}>{day.blocks}</Text>
              <Text style={[s.chartLabel, { color: colors.text.muted }]}>{day.label}</Text>
            </View>
          ))}
        </View>
      </Card>
    </ScreenScaffold>
  );
}

const s = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    minWidth: 118,
  },
  badgeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
  },
  calendarCell: {
    borderRadius: 5,
    height: 11,
    width: 11,
    borderWidth: StyleSheet.hairlineWidth,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: 148,
    minHeight: 88,
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
  chart: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.sm,
    height: 144,
  },
  dayDetail: {
    borderRadius: radius.lg,
    gap: spacing.xs,
    padding: spacing.md,
  },
  chartBar: {
    borderRadius: radius.full,
    width: '100%',
  },
  chartColumn: {
    alignItems: 'flex-end',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  chartBarSlot: {
    alignItems: 'flex-end',
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%',
  },
  chartLabel: {
    ...typography.label,
    marginTop: spacing.xs,
    textAlign: 'center',
    width: '100%',
  },
  chartValue: {
    ...typography.captionMd,
    marginTop: spacing.xs,
    textAlign: 'center',
    width: '100%',
  },
  fill: {
    borderRadius: radius.full,
    height: '100%',
  },
  levelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  insightBox: {
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  insightText: {
    ...typography.bodyMd,
  },
  milestoneBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(21,26,23,0.18)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  milestoneButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    height: 48,
    justifyContent: 'center',
    width: '100%',
  },
  milestoneButtonText: {
    ...typography.bodyMd,
  },
  milestoneScreen: {
    alignItems: 'center',
    borderRadius: radius.lg,
    gap: spacing.md,
    maxWidth: 360,
    padding: spacing.xl,
    width: '100%',
  },
  milestoneTitle: {
    fontSize: 28,
    fontWeight: '500',
    textAlign: 'center',
  },
  streakValue: {
    fontSize: 20,
    fontWeight: '500',
  },
  supportCopy: {
    ...typography.body,
  },
  track: {
    borderRadius: radius.full,
    height: 8,
    overflow: 'hidden',
    width: '100%',
  },
});

function calendarColor(day: DayRecord, emptyColor: string, cleanColor: string) {
  if (day.freezeUsed) return '#D9A441';
  if (day.relapseLogged) return '#DDE2E0';
  if (day.clean) return cleanColor;
  return emptyColor;
}

function calendarStyle(day: DayRecord, colors: ReturnType<typeof useTheme>['colors']) {
  const today = new Date().toISOString().split('T')[0];
  if (day.relapseLogged && !day.freezeUsed) return { backgroundColor: '#D9A441', borderColor: '#D9A441' };
  if (day.clean) return { backgroundColor: colors.green[500], borderColor: colors.green[500] };
  if (day.date === today) return { backgroundColor: 'transparent', borderColor: colors.green[500], borderWidth: 1 };
  return { backgroundColor: 'transparent', borderColor: colors.border.subtle };
}

function buildFallbackCalendarDays(): DayRecord[] {
  return Array.from({ length: 84 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (83 - index));
    return {
      date: date.toISOString().split('T')[0],
      clean: false,
      xpEarned: 0,
      blocksCount: 0,
      moodCheckedIn: false,
      journalWritten: false,
      urgesSurfed: 0,
      freezeUsed: false,
      relapseLogged: false,
    };
  });
}

function levelName(level: number) {
  const names = ['Starting', 'Aware', 'Steady', 'Resilient', 'Grounded', 'Strong'];
  return names[Math.min(level, names.length - 1)] ?? 'Resilient';
}

function daySummary(day: DayRecord) {
  const parts = [
    `${day.blocksCount} blocks`,
    day.moodCheckedIn ? 'mood checked' : null,
    day.journalWritten ? 'journal written' : null,
    day.urgesSurfed ? `${day.urgesSurfed} urges surfed` : null,
    day.freezeUsed ? 'freeze used' : null,
    day.relapseLogged && !day.freezeUsed ? 'moment logged' : null,
  ].filter(Boolean);
  return parts.join(' · ') || 'No data yet';
}

function milestoneMessage(id: string) {
  const messages: Record<string, string> = {
    milestone_7: '7 days. A full week of repeated choices is meaningful progress.',
    milestone_14: '14 days. Your routines are starting to become easier to repeat.',
    milestone_30: "30 days. You've strengthened new reward pathways through consistent practice.",
    sixty_days: '60 days. Two months of pattern change is real behavioral evidence.',
    milestone_90: '90 days. You have built a stable recovery rhythm.',
    milestone_180: '180 days. Half a year of choices has changed your default path.',
    year_legend: '365 days. A year of recovery practice is a major life signal.',
  };
  return messages[id] ?? 'A real milestone, earned one day at a time.';
}



