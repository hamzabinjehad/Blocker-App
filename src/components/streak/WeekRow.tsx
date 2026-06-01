import { StyleSheet, View } from 'react-native';

import type { DayRecord } from '@/store/useGamification';

import { DayCircle } from './DayCircle';
import type { DayCircleStatus } from './DayCircle';
import type { StreakPopupState } from './streakCopy';

type WeekRowProps = {
  days: DayRecord[];
  todayState: StreakPopupState;
};

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function WeekRow({ days, todayState }: WeekRowProps) {
  const today = startOfDay(new Date());
  const weekStart = getWeekStart(today);
  const byDate = new Map(days.map((day) => [day.date, day]));

  return (
    <View style={s.row}>
      {DAY_LETTERS.map((letter, index) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + index);
        const key = toDateKey(date);
        const isToday = key === toDateKey(today);
        const record = byDate.get(key);
        return (
          <DayCircle
            isToday={isToday}
            key={key}
            letter={letter}
            status={statusForDay(record, date, today, isToday, todayState)}
          />
        );
      })}
    </View>
  );
}

function statusForDay(
  record: DayRecord | undefined,
  date: Date,
  today: Date,
  isToday: boolean,
  todayState: StreakPopupState,
): DayCircleStatus {
  if (date.getTime() > today.getTime()) return 'future';
  if (isToday && !record) {
    if (todayState === 'freeze') return 'freeze';
    if (todayState === 'freshStart') return 'freshStart';
    return todayState === 'clean' ? 'clean' : 'empty';
  }
  if (record?.freezeUsed) return 'freeze';
  if (record?.relapseLogged && !record.freezeUsed) return 'freshStart';
  if (record?.clean) return 'clean';
  return 'empty';
}

function getWeekStart(date: Date) {
  const copy = startOfDay(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day + (day === 0 ? -6 : 1));
  return copy;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function toDateKey(date: Date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy.toISOString().split('T')[0] ?? '';
}

const s = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
});
