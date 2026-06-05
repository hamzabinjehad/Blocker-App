import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AnimatedCard } from '@/components/AnimatedCard';
import { AppIcon } from '@/components/AppIcon';
import { Card } from '@/components/Card';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { getDailyCoachingNudge } from '@/services/coaching';
import { getTodaysMood } from '@/services/mood';
import type { MoodCheckIn } from '@/services/mood';
import { useGamification } from '@/store/useGamification';
import type { DayRecord } from '@/store/useGamification';
import { radius, spacing, typography, useTheme } from '@/theme';

const JOURNEY_DAYS = 90;
const WEEK_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GRID_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function mondayBasedDow(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  return dow === 0 ? 6 : dow - 1;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0]!;
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime();
  return Math.round(ms / 86400000);
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Journey Gauge ────────────────────────────────────────────────────────────

function JourneyGauge({
  progress,
  goalDateStr,
}: {
  progress: number;
  goalDateStr: string;
}) {
  const { colors } = useTheme();

  const CANVAS_W = 280;
  const SIDE_PAD = 20;
  const ARC_W = CANVAS_W - 2 * SIDE_PAD; // 240
  const BORDER = 14;
  const CLIP_H = ARC_W / 2 + BORDER; // 134
  const ARC_R = ARC_W / 2 - BORDER / 2; // 113
  const DOT_D = 18;

  // Animate progress value
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: Math.min(1, Math.max(0, progress)),
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const clampedProg = Math.min(1, Math.max(0, progress));
  const angle = Math.PI * (1 - clampedProg);
  const arcCenterX = SIDE_PAD + ARC_W / 2; // 140

  const dotLeft = arcCenterX + Math.cos(angle) * ARC_R - DOT_D / 2;
  const dotTop = ARC_W / 2 - Math.sin(angle) * ARC_R - DOT_D / 2;
  const pct = Math.round(clampedProg * 100);

  // Arc fill: rotate a green circle so only the left segment is visible.
  // progress 0 → rotate 0deg (nothing shows left of center)
  // progress 0.5 → rotate 90deg (left half filled)
  // progress 1 → rotate 180deg (whole top filled)
  // We render it in two halves so we can fill past 50%.
  const leftRotateDeg = progressAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '90deg', '90deg'],
  });
  const rightRotateDeg = progressAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '0deg', '90deg'],
  });

  return (
    <View style={sg.outer}>
      <View style={{ width: CANVAS_W, position: 'relative' }}>
        {/* Sparkles */}
        <Text style={[sg.sparkle, { left: 8, top: 30, fontSize: 18, color: colors.amber[600] }]}>✦</Text>
        <Text style={[sg.sparkle, { left: 46, top: 10, fontSize: 11, color: colors.amber[600] }]}>✦</Text>
        <Text style={[sg.sparkle, { right: 8, top: 22, fontSize: 20, color: colors.amber[600] }]}>✦</Text>
        <Text style={[sg.sparkle, { right: 52, top: 6, fontSize: 10, color: colors.amber[600] }]}>✦</Text>

        {/* Arc clip zone – shows only the top half of the circle */}
        <View style={{ width: CANVAS_W, height: CLIP_H, overflow: 'hidden' }}>
          {/* Background arc (gray track) */}
          <View
            style={{
              position: 'absolute',
              left: SIDE_PAD,
              top: 0,
              width: ARC_W,
              height: ARC_W,
              borderRadius: ARC_W / 2,
              borderWidth: BORDER,
              borderColor: colors.border.subtle,
            }}
          />

          {/* Progress fill — left half (progress 0–50%) */}
          <View
            style={{
              position: 'absolute',
              left: SIDE_PAD,
              top: 0,
              width: ARC_W / 2,
              height: ARC_W,
              overflow: 'hidden',
            }}
          >
            <Animated.View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: ARC_W,
                height: ARC_W,
                borderRadius: ARC_W / 2,
                borderWidth: BORDER,
                borderLeftColor: colors.green[500],
                borderBottomColor: colors.green[500],
                borderRightColor: 'transparent',
                borderTopColor: 'transparent',
                transform: [{ rotate: leftRotateDeg }],
              }}
            />
          </View>

          {/* Progress fill — right half (progress 50–100%) */}
          <View
            style={{
              position: 'absolute',
              left: SIDE_PAD + ARC_W / 2,
              top: 0,
              width: ARC_W / 2,
              height: ARC_W,
              overflow: 'hidden',
            }}
          >
            <Animated.View
              style={{
                position: 'absolute',
                left: -ARC_W / 2,
                top: 0,
                width: ARC_W,
                height: ARC_W,
                borderRadius: ARC_W / 2,
                borderWidth: BORDER,
                borderRightColor: colors.green[500],
                borderTopColor: colors.green[500],
                borderLeftColor: 'transparent',
                borderBottomColor: 'transparent',
                transform: [{ rotate: rightRotateDeg }],
              }}
            />
          </View>

          {/* Dot at current progress position */}
          <View
            style={{
              position: 'absolute',
              left: dotLeft,
              top: dotTop,
              width: DOT_D,
              height: DOT_D,
              borderRadius: DOT_D / 2,
              backgroundColor: colors.green[500],
              borderWidth: 2.5,
              borderColor: colors.bg.elevated,
            }}
          />
        </View>

        {/* Text content – pulled up into the visual arch space */}
        <View style={[sg.centerContent, { marginTop: -(CLIP_H * 0.78) }]}>
          <Text style={[sg.gaugeLabel, { color: colors.text.muted }]}>JOURNEY COMPLETION</Text>
          <Text style={[sg.gaugePct, { color: colors.text.primary }]}>{pct}%</Text>
          <View style={[sg.goalBadge, { backgroundColor: colors.bg.elevated }]}>
            <Text style={sg.goalIcon}>🎯</Text>
            <Text style={[sg.goalText, { color: colors.text.primary }]}>Goal: {goalDateStr}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const sg = StyleSheet.create({
  outer: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  sparkle: {
    position: 'absolute',
    zIndex: 10,
  },
  centerContent: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  gaugeLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  gaugePct: {
    fontSize: 52,
    fontWeight: '700',
    lineHeight: 58,
  },
  goalBadge: {
    alignItems: 'center',
    borderRadius: radius.full,
    elevation: 2,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  goalIcon: {
    fontSize: 14,
  },
  goalText: {
    fontSize: 13,
    fontWeight: '400',
  },
});

// ─── Coach Card ───────────────────────────────────────────────────────────────

function CoachCard() {
  const { colors } = useTheme();
  const gamification = useGamification();
  const [tip, setTip] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodCheckIn | null>(null);

  useEffect(() => {
    void getTodaysMood().then(setMood);
  }, []);

  useEffect(() => {
    void getDailyCoachingNudge({
      streak: gamification.currentStreak,
      level: gamification.level,
      blocksYesterday: 0,
      cleanHoursYesterday: gamification.todayCleanHours,
      mood: mood ?? 'steady',
    }).then(setTip);
  }, [gamification.currentStreak, gamification.level, gamification.todayCleanHours, mood]);

  return (
    <AnimatedCard delay={40}>
      <Card>
        <View style={sc.header}>
          <View style={[sc.iconCircle, { backgroundColor: colors.text.primary }]}>
            <AppIcon name="coach" size={14} color={colors.text.inverse} />
          </View>
          <Text style={[sc.title, { color: colors.text.primary }]}>Coach says</Text>
        </View>
        {tip ? (
          <Text style={[sc.tipText, { color: colors.text.secondary }]}>{tip}</Text>
        ) : (
          <View style={sc.skeleton}>
            {[100, 85, 60].map((w, i) => (
              <View
                key={i}
                style={[sc.skeletonLine, { backgroundColor: colors.border.subtle, width: `${w}%` }]}
              />
            ))}
          </View>
        )}
      </Card>
    </AnimatedCard>
  );
}

const sc = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconCircle: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  title: {
    ...typography.bodyMd,
  },
  tipText: {
    ...typography.body,
    lineHeight: 22,
  },
  skeleton: {
    gap: spacing.xs,
  },
  skeletonLine: {
    borderRadius: radius.full,
    height: 10,
  },
});

// ─── Week Calendar ────────────────────────────────────────────────────────────

function WeekCalendarSection({
  days,
  onPressMore,
}: {
  days: DayRecord[];
  onPressMore: () => void;
}) {
  const { colors } = useTheme();
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
            <Text style={[sw.title, { color: colors.text.primary }]}>Your calendar</Text>
            <Text style={[sw.sub, { color: colors.text.secondary }]}>
              Track daily activity and completed sessions.
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onPressMore} style={[sw.moreBtn, { borderColor: colors.border.subtle }]}>
            <Text style={[sw.moreText, { color: colors.text.secondary }]}>MORE →</Text>
          </Pressable>
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
                  {WEEK_DAY_LABELS[i]!.toUpperCase().slice(0, 3)}
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
            <Text style={[sw.legendText, { color: colors.text.muted }]}>Clean day</Text>
          </View>
          <View style={sw.legendItem}>
            <View style={[sw.legendDot, { backgroundColor: '#D9A441' }]} />
            <Text style={[sw.legendText, { color: colors.text.muted }]}>Moment logged</Text>
          </View>
          <View style={sw.legendItem}>
            <View style={[sw.legendDot, { borderWidth: 1.5, borderColor: colors.border.default, backgroundColor: 'transparent' }]} />
            <Text style={[sw.legendText, { color: colors.text.muted }]}>No data</Text>
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

// ─── Journey Stats Row ────────────────────────────────────────────────────────

function JourneyStats({
  todayStr,
  goalStr,
  daysRemaining,
}: {
  todayStr: string;
  goalStr: string;
  daysRemaining: number;
}) {
  const { colors } = useTheme();
  return (
    <AnimatedCard delay={100}>
      <View style={ss.row}>
        <StatPill icon="📅" label="TODAY" value={todayStr} colors={colors} />
        <StatPill icon="🎯" label="GOAL DATE" value={goalStr} colors={colors} />
        <StatPill icon="⌛" label="REMAINING" value={`${daysRemaining}d`} colors={colors} />
      </View>
    </AnimatedCard>
  );
}

function StatPill({
  icon,
  label,
  value,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[ss.pill, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
      <Text style={ss.pillIcon}>{icon}</Text>
      <Text style={[ss.pillLabel, { color: colors.text.muted }]}>{label}</Text>
      <Text style={[ss.pillValue, { color: colors.text.primary }]}>{value}</Text>
    </View>
  );
}

const ss = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: 3,
    paddingVertical: spacing.md,
  },
  pillIcon: {
    fontSize: 18,
  },
  pillLabel: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pillValue: {
    ...typography.captionMd,
    textAlign: 'center',
  },
});

// ─── Full Streak Grid ─────────────────────────────────────────────────────────

function StreakGrid({
  days,
  selectedDate,
  onSelect,
}: {
  days: DayRecord[];
  selectedDate?: string;
  onSelect: (day: DayRecord) => void;
}) {
  const { colors } = useTheme();

  const leadingPad = days.length > 0 ? mondayBasedDow(days[0]!.date) : 0;
  const padded: Array<DayRecord | null> = [...Array<null>(leadingPad).fill(null), ...days];
  const weeks: Array<Array<DayRecord | null>> = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  return (
    <View style={sgrid.wrap}>
      <View style={sgrid.labelRow}>
        {GRID_DAY_LABELS.map((label, i) => (
          <View key={i} style={sgrid.labelCell}>
            <Text style={[sgrid.label, { color: colors.text.muted }]}>{label}</Text>
          </View>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={sgrid.weekRow}>
          {week.map((day, di) =>
            day ? (
              <Pressable
                accessibilityRole="button"
                key={day.date}
                onPress={() => onSelect(day)}
                style={[sgrid.cell, gridCellStyle(day, colors), selectedDate === day.date ? { borderColor: colors.text.primary, borderWidth: 2 } : null]}
              />
            ) : (
              <View key={`pad-${wi}-${di}`} style={sgrid.cell} />
            )
          )}
        </View>
      ))}
    </View>
  );
}

const sgrid = StyleSheet.create({
  wrap: { gap: 4 },
  labelRow: { flexDirection: 'row', gap: 4 },
  labelCell: { flex: 1, alignItems: 'center' },
  label: { fontSize: 9, fontWeight: '500' },
  weekRow: { flexDirection: 'row', gap: 4 },
  cell: {
    borderRadius: 5,
    height: 26,
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
});

function gridCellStyle(day: DayRecord, colors: ReturnType<typeof useTheme>['colors']) {
  const today = new Date().toISOString().split('T')[0];
  if (day.relapseLogged && !day.freezeUsed) return { backgroundColor: '#D9A441', borderColor: '#D9A441' };
  if (day.clean) return { backgroundColor: colors.green[500], borderColor: colors.green[500] };
  if (day.date === today) return { backgroundColor: 'transparent', borderColor: colors.green[500], borderWidth: 1 };
  return { backgroundColor: 'transparent', borderColor: colors.border.subtle };
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

function AnimatedBarColumn({
  day,
  ratio,
  delay,
  colors,
}: {
  day: { date: string; blocks: number; label: string };
  ratio: number;
  delay: number;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const heightAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(heightAnim, {
      toValue: Math.max(8, ratio * 100),
      damping: 18,
      mass: 0.8,
      stiffness: 100,
      delay,
      useNativeDriver: false,
    }).start();
  }, [delay, heightAnim, ratio]);

  return (
    <View style={sbar.col}>
      <View style={sbar.slot}>
        <Animated.View
          style={[
            sbar.bar,
            {
              backgroundColor: day.blocks > 0 ? colors.green[500] : colors.border.subtle,
              height: heightAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      <Text style={[sbar.value, { color: colors.text.secondary }]}>{day.blocks}</Text>
      <Text style={[sbar.label, { color: colors.text.muted }]}>{day.label}</Text>
    </View>
  );
}

const sbar = StyleSheet.create({
  col: { alignItems: 'flex-end', flex: 1, height: '100%', justifyContent: 'flex-end' },
  slot: { alignItems: 'flex-end', flex: 1, justifyContent: 'flex-end', width: '100%' },
  bar: { borderRadius: radius.full, width: '100%' },
  value: { ...typography.captionMd, marginTop: spacing.xs, textAlign: 'center', width: '100%' },
  label: { ...typography.label, marginTop: spacing.xs, textAlign: 'center', width: '100%' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const { colors } = useTheme();
  const gamification = useGamification();
  const [selectedDay, setSelectedDay] = useState<DayRecord | undefined>();
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [milestoneVisible, setMilestoneVisible] = useState(Boolean(gamification.latestMilestoneBadge));

  useEffect(() => {
    if (gamification.latestMilestoneBadge) setMilestoneVisible(true);
  }, [gamification.latestMilestoneBadge?.id]);

  const progressRatio = Math.min(1, gamification.xpProgress.current / gamification.xpProgress.required);
  const earnedBadges = gamification.badges.filter((badge) => badge.earned).slice(0, 6);
  const maxWeeklyBlocks = Math.max(1, ...gamification.weeklyBlockCounts.map((day) => day.blocks));
  const calendarDays = gamification.calendarDays.length > 0 ? gamification.calendarDays : buildFallbackCalendarDays();

  // Journey progress computation
  const today = new Date().toISOString().split('T')[0]!;
  const startDate = gamification.dayHistory[0]?.date ?? today;
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
    <ScreenScaffold title="Your Progress" subtitle="One day at a time." iconName="progress">
      {/* Journey gauge */}
      <AnimatedCard delay={0}>
        <Card padding={0}>
          <JourneyGauge progress={journeyProgress} goalDateStr={formatShortDate(goalDate)} />
        </Card>
      </AnimatedCard>

      {/* Coach says */}
      <CoachCard />

      {/* Current week calendar */}
      <WeekCalendarSection days={calendarDays} onPressMore={() => setShowFullCalendar((v) => !v)} />

      {/* Journey stats */}
      <JourneyStats
        todayStr={formatShortDate(today)}
        goalStr={formatShortDate(goalDate)}
        daysRemaining={daysRemaining}
      />

      {/* 12-week grid (toggleable via MORE) */}
      {showFullCalendar ? (
        <AnimatedCard delay={0}>
          <Card>
            <View style={s.cardHeader}>
              <View>
                <Text style={[s.cardTitle, { color: colors.text.primary }]}>12-week history</Text>
                <Text style={[s.cardMeta, { color: colors.text.secondary }]}>
                  {gamification.currentStreak} day streak
                </Text>
              </View>
              <Text style={[s.streakValue, { color: colors.green[600] }]}>
                {gamification.currentStreak} days
              </Text>
            </View>
            <StreakGrid days={calendarDays} selectedDate={selectedDay?.date} onSelect={setSelectedDay} />
            {selectedDay ? (
              <View style={[s.dayDetail, { backgroundColor: colors.bg.tertiary }]}>
                <Text style={[s.insightText, { color: colors.text.primary }]}>{selectedDay.date}</Text>
                <Text style={[s.supportCopy, { color: colors.text.secondary }]}>{daySummary(selectedDay)}</Text>
              </View>
            ) : null}
          </Card>
        </AnimatedCard>
      ) : null}

      {/* Level card */}
      <AnimatedCard delay={160}>
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
            {Math.round(progressRatio * 100)}% to Level {gamification.level + 1}
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
            <Text style={[s.milestoneTitle, { color: colors.green[600] }]}>Milestone unlocked</Text>
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
              <Text style={[s.milestoneButtonText, { color: colors.text.inverse }]}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Badges */}
      <AnimatedCard delay={240}>
        <Card>
          <View style={s.cardHeader}>
            <Text style={[s.cardTitle, { color: colors.text.primary }]}>Badges</Text>
            <Text style={[s.cardMeta, { color: colors.text.secondary }]}>{earnedBadges.length} earned</Text>
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

      {/* Weekly blocks chart */}
      <AnimatedCard delay={320}>
        <Card>
          <View style={s.cardHeader}>
            <Text style={[s.cardTitle, { color: colors.text.primary }]}>Weekly blocks</Text>
            <Text style={[s.cardMeta, { color: colors.text.secondary }]}>Blocked moments</Text>
          </View>
          <View style={s.chart}>
            {gamification.weeklyBlockCounts.map((day, i) => (
              <AnimatedBarColumn
                key={day.date}
                day={day}
                ratio={day.blocks / maxWeeklyBlocks}
                delay={i * 60}
                colors={colors}
              />
            ))}
          </View>
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
