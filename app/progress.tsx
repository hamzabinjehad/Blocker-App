import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedCard } from '@/components/AnimatedCard';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { CoachingCard } from '@/components/CoachingCard';
import { MoodCheckInCard } from '@/components/MoodCheckInCard';
import { PersonalizedChallengeCard } from '@/components/PersonalizedChallengeCard';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { StatCard } from '@/components/StatCard';
import { AppIcon } from '@/components/AppIcon';
import type { AppIconName } from '@/components/AppIcon';
import { getStoredMood, saveMood } from '@/services/mood';
import type { MoodCheckIn } from '@/services/mood';
import { useGamification } from '@/store/useGamification';
import { useProtectionState } from '@/store/useProtectionState';
import { useTheme } from '@/theme';
import { radius, shadow, spacing, typography } from '@/theme';

type DayStatus = 'clean' | 'violation' | 'empty';

function SectionTitle({ title }: { title: string }) {
  const { colors } = useTheme();
  return <Text selectable style={[s.sectionTitle, { color: colors.text.muted }]}>{title}</Text>;
}

function StreakCalendar({ currentStreak }: { currentStreak: number }) {
  const { colors } = useTheme();
  const days = Array.from({ length: 70 }, (_, index): DayStatus => {
    const cleanStart = Math.max(0, 70 - currentStreak);
    if (index >= cleanStart) return 'clean';
    return index % 17 === 6 ? 'violation' : 'empty';
  });

  return (
    <View style={s.calendarWrap}>
      <View style={s.calendarGrid}>
        {days.map((status, index) => (
          <View
            key={`${status}-${index}`}
            style={[
              s.calendarCell,
              status === 'clean' ? { backgroundColor: colors.green[400] } : null,
              status === 'violation' ? { backgroundColor: colors.red[400] } : null,
              status === 'empty' ? { backgroundColor: colors.bg.tertiary } : null,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export default function ProgressScreen() {
  const { colors } = useTheme();
  const gamification = useGamification();
  const protection = useProtectionState();
  const [mood, setMood] = useState<MoodCheckIn>('steady');
  const progressRatio = Math.min(1, gamification.xpProgress.current / gamification.xpProgress.required);

  useEffect(() => {
    void getStoredMood().then(setMood);
  }, []);

  const handleMoodChange = (nextMood: MoodCheckIn) => {
    setMood(nextMood);
    void saveMood(nextMood);
  };

  const weakSpots = [
    protection.activeBlockEvent?.screen,
    ...protection.tamperReport.filter((signal) => signal.detected).map((signal) => signal.subject),
  ].filter((value): value is string => Boolean(value));

  return (
    <ScreenScaffold
      title="Progress"
      subtitle="Your protection streak, XP, and achievements."
      iconName="progress"
    >
      <AnimatedCard>
        <Card accent="purple" padding={spacing.xl} style={s.levelCard}>
          <View style={s.levelHeader}>
            <View style={[s.levelIcon, { backgroundColor: colors.purple[50], borderColor: colors.border.purple }]}>
              <AppIcon name="xp" size={38} color={colors.purple[500]} />
            </View>
            <View style={s.levelCopy}>
              <Text selectable style={[s.levelTitle, { color: colors.text.primary }]}>Guardian Level</Text>
              <Text selectable style={[s.levelMeta, { color: colors.text.secondary }]}>
                {gamification.xpProgress.current} / {gamification.xpProgress.required} XP
              </Text>
            </View>
            <Text selectable style={[s.levelValue, { color: colors.purple[400] }]}>{gamification.level}</Text>
          </View>
          <View style={s.track}>
            <View style={[s.fill, { backgroundColor: colors.purple[400], width: `${progressRatio * 100}%` }]} />
          </View>
        </Card>
      </AnimatedCard>

      <AnimatedCard delay={70} style={s.statsRow}>
        <StatCard iconName="streak" label="Streak" value={`${gamification.currentStreak}d`} color="amber" />
        <StatCard iconName="clean-hours" label="Clean" value={`${gamification.todayCleanHours}h`} color="teal" />
        <StatCard iconName="block" label="Blocks" value={gamification.totalBlocksLifetime} color="red" />
      </AnimatedCard>

      <AnimatedCard delay={110}>
        <SectionTitle title="Clean days - last 10 weeks" />
        <Card>
          <StreakCalendar currentStreak={gamification.currentStreak} />
        </Card>
      </AnimatedCard>

      <AnimatedCard delay={150}>
        <SectionTitle title="Achievement Badges" />
        <ScrollView
          horizontal
          contentContainerStyle={s.badgeList}
          showsHorizontalScrollIndicator={false}
        >
          {gamification.badges.map((badge) => (
            <View
              key={badge.id}
              style={[
                s.badgeCard,
                {
                  backgroundColor: badge.earned ? colors.amber[50] : colors.bg.secondary,
                  borderColor: badge.earned ? colors.border.amber : colors.border.subtle,
                },
                shadow.sm,
              ]}
            >
              <AppIcon
                name={getBadgeIconName(badge.id)}
                size={32}
                color={badge.earned ? colors.amber[500] : colors.text.muted}
              />
              <Text selectable style={[s.badgeLabel, { color: colors.text.primary }]}>{badge.label}</Text>
              {badge.earned ? <Badge label="Earned" variant="amber" /> : <Badge label="Locked" variant="muted" />}
            </View>
          ))}
        </ScrollView>
      </AnimatedCard>

      <AnimatedCard delay={190}>
        <SectionTitle title="Check-in" />
        <MoodCheckInCard onChange={handleMoodChange} value={mood} />
      </AnimatedCard>

      <AnimatedCard delay={230}>
        <CoachingCard
          stats={{
            streak: gamification.currentStreak,
            level: gamification.level,
            blocksYesterday: 0,
            cleanHoursYesterday: gamification.todayCleanHours,
            mood,
          }}
        />
      </AnimatedCard>

      <AnimatedCard delay={270}>
        <PersonalizedChallengeCard
          input={{
            streak: gamification.currentStreak,
            cleanHours: gamification.todayCleanHours,
            totalBlocks: gamification.totalBlocksLifetime,
            mood,
            focusActive: protection.focusState.active,
            anomalyRiskLevel: protection.anomalyDetectionStatus.riskLevel,
            mediaScanningActive: protection.mediaScanningStatus.imageScanningActive,
            weakSpots,
          }}
          onComplete={(amount) => {
            void gamification.awardXP(amount, 'personalized_challenge');
          }}
        />
      </AnimatedCard>
    </ScreenScaffold>
  );
}

function getBadgeIconName(id: string): AppIconName {
  if (id.includes('block')) return 'block';
  if (id.includes('streak') || id.includes('day') || id.includes('week')) return 'streak';
  if (id.includes('level')) return 'xp';
  return 'shield';
}

const s = StyleSheet.create({
  badgeCard: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    minHeight: 128,
    padding: spacing.md,
    width: 108,
  },
  badgeLabel: {
    ...typography.captionMd,
    minHeight: 30,
    textAlign: 'center',
  },
  badgeList: {
    gap: spacing.md,
    paddingHorizontal: 0,
  },
  calendarCell: {
    borderRadius: 6,
    flex: 1,
    aspectRatio: 1,
    maxWidth: 38,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  calendarWrap: {
    marginBottom: 0,
    marginHorizontal: 0,
  },
  fill: {
    borderRadius: radius.full,
    height: '100%',
  },
  levelCard: {
    gap: spacing.lg,
  },
  levelCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  levelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  levelIcon: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  levelMeta: {
    ...typography.caption,
  },
  levelTitle: {
    ...typography.h3,
  },
  levelValue: {
    ...typography.display,
  },
  sectionTitle: {
    ...typography.label,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  track: {
    backgroundColor: 'rgba(139,114,248,0.12)',
    borderRadius: radius.full,
    height: 8,
    overflow: 'hidden',
    width: '100%',
  },
});
