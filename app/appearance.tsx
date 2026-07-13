import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ScreenScaffold } from '@/components/ScreenScaffold';
import { useI18n } from '@/i18n';
import type { Language, TranslationKey } from '@/i18n';
import { radius, spacing, typography, useTheme } from '@/theme';

const options: Array<{ key: 'light' | 'dark' | 'system'; labelKey: TranslationKey }> = [
  { key: 'light', labelKey: 'theme.light' },
  { key: 'dark', labelKey: 'theme.dark' },
  { key: 'system', labelKey: 'theme.system' },
];

export default function AppearanceScreen() {
  const { colors, mode, setMode } = useTheme();
  const { language, setLanguage, t } = useI18n();

  const languageOptions: Array<{ key: Language; label: string }> = [
    { key: 'en', label: t('appearance.languageEnglish') },
    { key: 'ar', label: t('appearance.languageArabic') },
  ];

  return (
    <ScreenScaffold
      backLabel={t('common.back')}
      showBack
      title={t('appearance.title')}
      subtitle={t('appearance.subtitle')}
    >
      <Text style={[s.sectionHeading, { color: colors.text.secondary }]}>{t('appearance.theme')}</Text>
      <View style={[s.list, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
        {options.map((option) => {
          const selected = mode === option.key;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.key}
              onPress={() => setMode(option.key)}
              style={({ pressed }) => [
                s.row,
                pressed ? { backgroundColor: colors.bg.tertiary } : null,
              ]}
            >
              <Feather name={selected ? 'disc' : 'circle'} size={18} color={selected ? colors.green[500] : colors.text.muted} />
              <Text style={[s.label, { color: colors.text.primary }]}>{t(option.labelKey)}</Text>
              {selected ? <Feather name="check" size={20} color={colors.green[500]} /> : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={[s.sectionHeading, { color: colors.text.secondary }]}>{t('appearance.language')}</Text>
      <View style={[s.list, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
        {languageOptions.map((option) => {
          const selected = language === option.key;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.key}
              onPress={() => setLanguage(option.key)}
              style={({ pressed }) => [
                s.row,
                pressed ? { backgroundColor: colors.bg.tertiary } : null,
              ]}
            >
              <Feather name={selected ? 'disc' : 'circle'} size={18} color={selected ? colors.green[500] : colors.text.muted} />
              <Text style={[s.label, { color: colors.text.primary }]}>{option.label}</Text>
              {selected ? <Feather name="check" size={20} color={colors.green[500]} /> : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={[s.note, { color: colors.text.muted }]}>{t('appearance.languageNote')}</Text>
    </ScreenScaffold>
  );
}

const s = StyleSheet.create({
  label: {
    ...typography.bodyMd,
    flex: 1,
  },
  list: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sectionHeading: {
    ...typography.captionMd,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  note: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
