import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedCard } from '@/components/AnimatedCard';
import { AppIcon } from '@/components/AppIcon';
import { Card } from '@/components/Card';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { formatShortDate, levelNameKey, useI18n, useTranslation, weekdayShort } from '@/i18n';
import type { Language } from '@/i18n';
import { useGamification } from '@/store/useGamification';
import type { DayRecord } from '@/store/useGamification';
import { radius, spacing, typography, useTheme } from '@/theme';

const JOURNEY_DAYS = 90;

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0]!;
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime();
  return Math.round(ms / 86400000);
}

// Journey dates are 'YYYY-MM-DD' strings; parse at local midnight before formatting
// so the day never shifts under the device's timezone.
function formatJourneyDate(dateStr: string, language: Language): string {
  return formatShortDate(new Date(dateStr + 'T00:00:00'), language);
}

// ─── Journey Banner ───────────────────────────────────────────────────────────

function JourneyBanner({
  progress,
  daysElapsed,
  daysRemaining,
  goalDateStr,
}: {
  progress: number;
  daysElapsed: number;
  daysRemaining: number;
  goalDateStr: string;
}) {
  const { colors } = useTheme();
  const t = useTranslation();
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: Math.min(1, Math.max(0, progress)),
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <View style={[sjb.card, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
      <View style={sjb.topRow}>
        <View style={sjb.textCol}>
          <Text style={[sjb.label, { color: colors.text.muted }]}>{t('progress.journeyLabel')}</Text>
          <Text style={[sjb.pct, { color: colors.text.primary }]}>{pct}%</Text>
        </View>
        <View style={sjb.statsCol}>
          <Text style={[sjb.statVal, { color: colors.green[500] }]}>{t('progress.dayOf', { day: daysElapsed })}</Text>
          <Text style={[sjb.statLabel, { color: colors.text.muted }]}>{t('progress.of90')}</Text>
          <Text style={[sjb.statVal, { color: colors.text.secondary, marginTop: 6 }]}>{t('progress.daysRemainingValue', { days: daysRemaining })}</Text>
          <Text style={[sjb.statLabel, { color: colors.text.muted }]}>{t('progress.remainingLabel')}</Text>
        </View>
      </View>
      <View style={[sjb.track, { backgroundColor: colors.border.subtle }]}>
        <Animated.View
          style={[
            sjb.fill,
            {
              backgroundColor: colors.green[500],
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      <Text style={[sjb.goal, { color: colors.text.muted }]}>{t('progress.goal', { date: goalDateStr })}</Text>
    </View>
  );
}

const sjb = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  textCol: {
    gap: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  pct: {
    fontSize: 40,
    fontWeight: '600',
    lineHeight: 46,
  },
  statsCol: {
    alignItems: 'flex-end',
  },
  statVal: {
    fontSize: 15,
    fontWeight: '500',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '400',
  },
  track: {
    borderRadius: radius.full,
    height: 5,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: radius.full,
    height: '100%',
  },
  goal: {
    fontSize: 11,
    fontWeight: '400',
  },
});


// ─── Week Calendar ────────────────────────────────────────────────────────────

function WeekCalendarSection({
  days,
}: {
  days: DayRecord[];
}) {
  const { colors } = useTheme();
  const { t, language } = useI18n();
  const today = new Date().toISOString().split('T')[0]!;

  const now = new Date();
  const sundayDow = now.getDay(); // 0=Sun
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - sundayDow + i);
    return d.toISOString().split('T')[0]!;
  });

  return (
    <AnimatedCard delay={80}>
      <Card>
        <View style={sw.header}>
          <View style={sw.headerText}>
            <Text style={[sw.title, { color: colors.text.primary }]}>{t('progress.thisWeek')}</Text>
            <Text style={[sw.sub, { color: colors.text.secondary }]}>{t('progress.thisWeekSub')}</Text>
          </View>
        </View>

        <View style={sw.week}>
          {weekDays.map((dateStr, i) => {
            const record = days.find((d) => d.date === dateStr);
            const isToday = dateStr === today;
            const isFuture = dateStr > today;
            const dayNum = new Date(dateStr + 'T00:00:00').getDate();
            const hasRelapse = !!(record?.relapseLogged && !record.freezeUsed);
            const isClean = !!(record?.clean);

            return (
              <View key={dateStr} style={sw.dayCell}>
                <Text style={[sw.dayLabel, { color: colors.text.muted }]}>
                  {weekdayShort(language, i)}
                </Text>
                <View
                  style={[
                    sw.dayCircle,
                    { borderColor: colors.border.subtle },
                    isToday && { backgroundColor: colors.green[500], borderColor: colors.green[500] },
                    !isToday && isClean && { backgroundColor: colors.green[100], borderColor: colors.green[200] },
                    !isToday && hasRelapse && { backgroundColor: '#D9A441', borderColor: '#D9A441' },
                  ]}
                >
                  {hasRelapse && !isToday ? (
                    <View style={[sw.innerDot, { backgroundColor: '#7A5520' }]} />
                  ) : (
                    <Text
                      style={[
                        sw.dayNum,
                        { color: isToday ? colors.text.inverse : isFuture ? colors.text.muted : colors.text.primary },
                        isToday && { fontWeight: '700' },
                      ]}
                    >
                      {dayNum}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        <View style={sw.legend}>
          <View style={sw.legendItem}>
            <View style={[sw.legendDot, { backgroundColor: colors.green[400] }]} />
            <Text style={[sw.legendText, { color: colors.text.muted }]}>{t('progress.legendClean')}</Text>
          </View>
          <View style={sw.legendItem}>
            <View style={[sw.legendDot, { backgroundColor: '#D9A441' }]} />
            <Text style={[sw.legendText, { color: colors.text.muted }]}>{t('progress.legendMoment')}</Text>
          </View>
          <View style={sw.legendItem}>
            <View style={[sw.legendDot, { borderWidth: 1.5, borderColor: colors.border.default, backgroundColor: 'transparent' }]} />
            <Text style={[sw.legendText, { color: colors.text.muted }]}>{t('progress.legendNoData')}</Text>
          </View>
        </View>
      </Card>
    </AnimatedCard>
  );
}

const sw = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  title: {
    ...typography.h3,
  },
  sub: {
    ...typography.caption,
    lineHeight: 17,
  },
  moreBtn: {
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  moreText: {
    ...typography.captionMd,
    letterSpacing: 0.3,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCell: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  dayLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  dayCircle: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1.5,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '400',
  },
  innerDot: {
    borderRadius: radius.full,
    height: 8,
    width: 8,
  },
  legend: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: spacing.sm,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  legendDot: {
    borderRadius: radius.full,
    height: 8,
    width: 8,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '400',
  },
});



// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const { colors } = useTheme();
  const { t, language } = useI18n();
  const gamification = useGamification();
  const [milestoneVisible, setMilestoneVisible] = useState(Boolean(gamification.latestMilestoneBadge));

  useEffect(() => {
    if (gamification.latestMilestoneBadge) setMilestoneVisible(true);
  }, [gamification.latestMilestoneBadge?.id]);

  const progressRatio = Math.min(1, gamification.xpProgress.current / gamification.xpProgress.required);
  const earnedBadges = gamification.badges.filter((badge) => badge.earned);
  const calendarDays = gamification.calendarDays.length > 0 ? gamification.calendarDays : buildFallbackCalendarDays();

  // Journey progress computation
  const today = new Date().toISOString().split('T')[0]!;
  const startDate = gamification.journeyStartDate ?? today;
  const goalDate = addDays(startDate, JOURNEY_DAYS);
  const daysElapsed = Math.max(0, daysBetween(startDate, today));
  const daysRemaining = Math.max(0, daysBetween(today, goalDate));
  const journeyProgress = Math.min(1, daysElapsed / JOURNEY_DAYS);

  const xpBarAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(xpBarAnim, {
      toValue: progressRatio,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [progressRatio, xpBarAnim]);

  return (
    <ScreenScaffold title={t('progress.title')} subtitle={t('progress.subtitle')} iconName="progress" collapsibleTitle>
      {/* Journey banner */}
      <AnimatedCard delay={0}>
        <JourneyBanner
          progress={journeyProgress}
          daysElapsed={daysElapsed}
          daysRemaining={daysRemaining}
          goalDateStr={formatJourneyDate(goalDate, language)}
        />
      </AnimatedCard>

      {/* Current week calendar */}
      <WeekCalendarSection days={calendarDays} />

      {/* Level card */}
      <AnimatedCard delay={160}>
        <Card>
          <View style={s.levelHeader}>
            <View>
              <Text style={[s.cardTitle, { color: colors.text.primary }]}>{t('progress.level', { level: gamification.level })}</Text>
              <Text style={[s.cardMeta, { color: colors.text.secondary }]}>{t(levelNameKey(gamification.level))}</Text>
              <Text style={[s.cardMeta, { color: colors.text.secondary }]}>
                {t('progress.xpProgress', { current: gamification.xpProgress.current, required: gamification.xpProgress.required })}
              </Text>
            </View>
            <AppIcon name="xp" size={24} color={colors.green[500]} />
          </View>
          <View style={[s.track, { backgroundColor: colors.bg.tertiary }]}>
            <Animated.View
              style={[
                s.fill,
                {
                  backgroundColor: colors.green[500],
                  width: xpBarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                },
              ]}
            />
          </View>
          <Text style={[s.supportCopy, { color: colors.text.secondary }]}>
            {t('progress.percentToNext', { percent: Math.round(progressRatio * 100), level: gamification.level + 1 })}
          </Text>
        </Card>
      </AnimatedCard>

      {/* Milestone card */}
      {gamification.latestMilestoneBadge ? (
        <AnimatedCard delay={200}>
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
        </AnimatedCard>
      ) : null}

      <Modal
        animationType="fade"
        transparent
        visible={Boolean(gamification.latestMilestoneBadge) && milestoneVisible}
      >
        <View style={s.milestoneBackdrop}>
          <View style={[s.milestoneScreen, { backgroundColor: colors.bg.elevated }]}>
            <Text style={[s.milestoneTitle, { color: colors.green[600] }]}>{t('progress.milestoneUnlocked')}</Text>
            <Text style={[s.cardTitle, { color: colors.text.primary }]}>
              {gamification.latestMilestoneBadge?.label}
            </Text>
            <Text style={[s.supportCopy, { color: colors.text.secondary, textAlign: 'center' }]}>
              {milestoneMessage(gamification.latestMilestoneBadge?.id ?? '')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setMilestoneVisible(false)}
              style={[s.milestoneButton, { backgroundColor: colors.green[500] }]}
            >
              <Text style={[s.milestoneButtonText, { color: colors.text.inverse }]}>{t('progress.continue')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Badges */}
      <AnimatedCard delay={240}>
        <Card>
          <View style={s.cardHeader}>
            <Text style={[s.cardTitle, { color: colors.text.primary }]}>{t('progress.badges')}</Text>
            <Text style={[s.cardMeta, { color: colors.text.secondary }]}>{t('progress.badgesEarned', { count: earnedBadges.length })}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.badgeGrid}>
            {(earnedBadges.length > 0
              ? earnedBadges
              : [
                  { id: 'locked-7', label: '7-day streak', earned: false },
                  { id: 'locked-surf', label: 'First surf', earned: false },
                  { id: 'locked-journal', label: 'Journaler', earned: false },
                ]
            ).map((badge) => (
              <View
                key={badge.id}
                style={[s.badge, { borderColor: colors.border.subtle, backgroundColor: colors.bg.tertiary }]}
              >
                <AppIcon
                  name={badge.earned ? 'check' : 'shield'}
                  size={16}
                  color={badge.earned ? colors.green[500] : colors.text.muted}
                />
                <Text style={[s.badgeLabel, { color: colors.text.secondary }]} numberOfLines={1}>
                  {badge.label}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Card>
      </AnimatedCard>

    </ScreenScaffold>
  );
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

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
  fill: {
    borderRadius: radius.full,
    height: '100%',
  },
  levelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFallbackCalendarDays(): DayRecord[] {
  return Array.from({ length: 84 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (83 - index));
    return {
      date: date.toISOString().split('T')[0]!,
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
