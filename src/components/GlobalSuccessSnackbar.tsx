import { StyleSheet } from 'react-native';
import { Snackbar } from 'react-native-paper';

import { useProtection } from '@/store/ProtectionContext';
import { radius, spacing, useTheme } from '@/theme';

const AUTO_DISMISS_MS = 3200;

// Positive-confirmation counterpart to GlobalErrorBanner. Screens call protection.notifySuccess()
// after a successful action; this surfaces it as a Material snackbar on every screen. Uses Paper's
// Snackbar so slide/fade timing and dismissal come from the library.
export function GlobalSuccessSnackbar() {
  const { colors } = useTheme();
  const { successMessage, dismissSuccess } = useProtection();

  return (
    <Snackbar
      visible={Boolean(successMessage)}
      onDismiss={dismissSuccess}
      duration={AUTO_DISMISS_MS}
      wrapperStyle={styles.wrapper}
      style={[styles.snackbar, { backgroundColor: colors.green[600] }]}
      theme={{ colors: { inverseOnSurface: '#FFFFFF' } }}
    >
      {successMessage ?? ''}
    </Snackbar>
  );
}

const styles = StyleSheet.create({
  // Float above the tab navigator; Paper's Snackbar has no elevated zIndex of its own.
  wrapper: {
    bottom: 72,
    zIndex: 1000,
  },
  snackbar: {
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
  },
});
