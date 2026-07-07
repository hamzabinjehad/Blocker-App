import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { MoodFace } from '@/components/MoodFace';
import { formatShortDate, moodLabelKey, useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import type { MoodCheckIn } from '@/services/mood';

const MOOD_HIGHLIGHT: Record<string, string> = {
  terrible:  'rgba(200,120,120,0.25)',
  excellent: 'rgba(245,165,90,0.25)',
  bad:       'rgba(158,126,200,0.25)',
  great:     'rgba(232,212,112,0.35)',
  down:      'rgba(112,144,208,0.25)',
  neutral:   'rgba(136,197,232,0.30)',
};

type Props = {
  mood: MoodCheckIn;
  note: string;
  onNoteChange: (text: string) => void;
  onSave: () => void;
  onClose: () => void;
};

export function MoodDetailView({ mood, note, onNoteChange, onSave, onClose }: Props) {
  const { colors } = useTheme();
  const { t, language } = useI18n();
  const insets = useSafeAreaInsets();
  const label = t(moodLabelKey(mood));
  const highlight = MOOD_HIGHLIGHT[mood] ?? 'rgba(136,197,232,0.30)';

  const dateLabel = formatShortDate(Date.now(), language);

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.bg.primary }]}>
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={s.headerClose}
        >
          <Feather name="x" size={20} color={colors.text.secondary} />
        </Pressable>
        <Text style={[s.headerDate, { color: colors.text.primary }]}>{dateLabel}</Text>
        <View style={s.headerSpacer} />
      </View>

      <View style={[s.card, { backgroundColor: colors.bg.elevated }]}>
        <MoodFace mood={mood} size={84} />

        <View style={s.labelWrap}>
          <View style={[s.highlight, { backgroundColor: highlight }]} />
          <Text style={[s.moodLabel, { color: colors.text.primary }]}>{label}</Text>
        </View>

        <TextInput
          multiline
          placeholder={t('mood.notePlaceholder')}
          placeholderTextColor={colors.text.muted}
          style={[s.input, { color: colors.text.primary }]}
          value={note}
          onChangeText={onNoteChange}
          textAlignVertical="top"
        />
      </View>

      <View style={s.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onSave}
          style={[s.saveBtn, { backgroundColor: colors.green[500] }]}
        >
          <Text style={[s.saveBtnText, { color: colors.text.inverse }]}>{t('common.save')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerClose: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerDate: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  card: {
    borderRadius: 20,
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    flex: 1,
    gap: 16,
  },
  labelWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlight: {
    borderRadius: 4,
    bottom: 0,
    height: 14,
    left: -6,
    position: 'absolute',
    right: -6,
    transform: [{ rotate: '-1deg' }],
  },
  moodLabel: {
    fontSize: 26,
    fontWeight: '700',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingTop: 0,
    width: '100%',
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  saveBtn: {
    alignItems: 'center',
    borderRadius: 22,
    paddingVertical: 12,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
