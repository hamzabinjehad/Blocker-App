import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Text } from 'react-native-paper';

import { Card } from './Card';
import { Button } from './controls';
import { useTranslation } from '@/i18n';
import { colors, radius } from '@/theme';

type AlwaysOnVpnCardProps = {
  onOpenVpnSettings: () => void | Promise<void>;
};

export function AlwaysOnVpnCard({ onOpenVpnSettings }: AlwaysOnVpnCardProps) {
  const t = useTranslation();
  const steps = [t('alwaysOn.step1'), t('alwaysOn.step2'), t('alwaysOn.step3'), t('alwaysOn.step4')];

  return (
    <Card title={t('alwaysOn.title')} subtitle={t('alwaysOn.subtitle')}>
      <View style={[styles.callout, { borderColor: colors.border.subtle }]}>
        <Feather name="shield" size={16} color={colors.green[600]} />
        <Text style={styles.calloutText}>{t('alwaysOn.callout')}</Text>
      </View>

      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={step} style={styles.step}>
            <View style={[styles.stepNum, { backgroundColor: colors.green[50] }]}>
              <Text style={[styles.stepNumText, { color: colors.green[700] }]}>{index + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      <Button icon="cog" onPress={() => void onOpenVpnSettings()}>
        {t('alwaysOn.openSettings')}
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  callout: {
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  calloutText: {
    color: colors.text.secondary,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  steps: {
    gap: 10,
  },
  step: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  stepNum: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  stepNumText: {
    fontSize: 13,
    fontWeight: '800',
  },
  stepText: {
    color: colors.text.primary,
    flex: 1,
    fontSize: 14,
  },
});
