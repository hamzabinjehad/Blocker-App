import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { radius, typography, useTheme } from '@/theme';

export type DayCircleStatus = 'clean' | 'freeze' | 'freshStart' | 'future' | 'empty';

type DayCircleProps = {
  letter: string;
  status: DayCircleStatus;
  isToday?: boolean;
};

export function DayCircle({ letter, status, isToday = false }: DayCircleProps) {
  const { colors } = useTheme();
  const clean = status === 'clean';
  const freeze = status === 'freeze';
  const freshStart = status === 'freshStart';
  const filled = clean || freeze || freshStart;
  const fillColor = clean ? colors.green[500] : freeze ? colors.blue[400] : freshStart ? '#D9A441' : 'transparent';
  const textColor = filled ? colors.text.inverse : status === 'future' ? colors.text.muted : colors.text.secondary;

  return (
    <View style={s.shell}>
      {isToday && filled ? (
        <View
          pointerEvents="none"
          style={[
            s.ring,
            { borderColor: freeze ? colors.blue[400] : freshStart ? '#D9A441' : colors.green[400] },
          ]}
        />
      ) : null}
      <View
        style={[
          s.circle,
          {
            backgroundColor: fillColor,
            borderColor: filled ? fillColor : colors.border.subtle,
          },
        ]}
      >
        {clean ? (
          <AppIcon name="check" size={15} color={colors.text.inverse} />
        ) : (
          <Text selectable={false} style={[s.letter, { color: textColor }]}>
            {letter}
          </Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  shell: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  ring: {
    borderRadius: radius.full,
    borderWidth: 2,
    height: 42,
    position: 'absolute',
    width: 42,
  },
  circle: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  letter: {
    ...typography.label,
  },
});
