import type { PropsWithChildren } from 'react';
import type { KeyboardTypeOptions } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { Button as PaperButton, TextInput } from 'react-native-paper';

import { useTheme } from '@/theme';
import { radius, shadow, typography } from '@/theme';

type ButtonProps = PropsWithChildren<{
  disabled?: boolean;
  icon?: string;
  loading?: boolean;
  tone?: 'primary' | 'danger' | 'neutral';
  onPress: () => void;
}>;

export function Button({ children, disabled, icon, loading, tone = 'primary', onPress }: ButtonProps) {
  const { colors } = useTheme();

  const buttonColors = {
    primary: colors.green[600],
    danger: colors.red[500],
    neutral: 'transparent',
  };

  const isNeutral = tone === 'neutral';
  return (
    <PaperButton
      buttonColor={buttonColors[tone]}
      contentStyle={s.buttonContent}
      disabled={disabled || loading}
      icon={icon}
      labelStyle={s.buttonLabel}
      loading={loading}
      mode={isNeutral ? 'outlined' : 'contained'}
      onPress={onPress}
      style={[
        s.button,
        !isNeutral && s.buttonRaised,
        isNeutral && { borderColor: colors.border.default, borderWidth: 1 },
      ]}
      textColor={isNeutral ? colors.text.primary : colors.text.inverse}
    >
      {children}
    </PaperButton>
  );
}

type FieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  onChangeText: (value: string) => void;
};

export function Field({ label, value, placeholder, secureTextEntry, keyboardType, onChangeText }: FieldProps) {
  const { colors } = useTheme();

  return (
    <View style={s.field}>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        activeOutlineColor={colors.green[500]}
        dense
        keyboardType={keyboardType}
        label={label}
        mode="outlined"
        onChangeText={onChangeText}
        outlineColor={colors.border.subtle}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        textColor={colors.text.primary}
        theme={{
          colors: {
            background: colors.bg.primary,
            onSurfaceVariant: colors.text.muted,
          },
          roundness: radius.md,
        }}
        secureTextEntry={secureTextEntry}
        style={[s.input, { backgroundColor: colors.bg.primary }]}
        value={value}
      />
    </View>
  );
}

const s = StyleSheet.create({
  button: {
    borderRadius: radius.lg,
  },
  buttonContent: {
    minHeight: 50,
  },
  buttonLabel: {
    ...typography.bodyMd,
    fontSize: 15,
    letterSpacing: 0,
  },
  buttonRaised: {
    ...shadow.sm,
  },
  field: {
    marginVertical: 4,
  },
  input: {
    fontSize: 14,
  },
});
