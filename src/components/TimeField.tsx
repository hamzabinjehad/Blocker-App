import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Text } from 'react-native-paper';

import { formatTimeOfDay, useI18n } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

type TimeFieldProps = {
  label: string;
  /** Minutes since midnight (0–1439). */
  minutes: number;
  onChange: (minutes: number) => void;
};

// Tappable time value that opens the platform time-picker dialog. Replaces the
// old ±30-minute stepper chips.
export function TimeField({ label, minutes, onChange }: TimeFieldProps) {
  const { colors } = useTheme();
  const { language } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);

  const value = new Date();
  value.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  const timeLabel = formatTimeOfDay(minutes, language);

  const handlePicked = (event: DateTimePickerEvent, selected?: Date) => {
    setPickerOpen(false);
    if (event.type === 'set' && selected) {
      onChange(selected.getHours() * 60 + selected.getMinutes());
    }
  };

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${timeLabel}`}
        onPress={() => setPickerOpen(true)}
        style={[
          styles.valueBox,
          { backgroundColor: colors.bg.secondary, borderColor: colors.border.default },
        ]}
      >
        <Text style={[styles.value, { color: colors.text.primary }]}>{timeLabel}</Text>
      </Pressable>
      {pickerOpen && <DateTimePicker mode="time" value={value} onChange={handlePicked} />}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    ...typography.captionMd,
  },
  value: {
    ...typography.bodyMd,
  },
  valueBox: {
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
});
