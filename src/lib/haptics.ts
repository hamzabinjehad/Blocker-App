import * as Haptics from 'expo-haptics';

// Single funnel for all tactile feedback so intensity stays consistent across
// the app and can be disabled in one place (future accessibility setting).
let enabled = true;

export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

function run(effect: () => Promise<void>) {
  if (!enabled) return;
  effect().catch(() => {
    // Haptics are best-effort decoration; a missing vibrator must never surface.
  });
}

export const haptics = {
  /** Light tick for choosing among options: mood bubbles, chips, PIN digits. */
  selection: () => run(() => Haptics.selectionAsync()),
  /** Soft tap for routine presses (secondary buttons, list rows). */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Firmer tap for the app's main actions (shield toggle press). */
  press: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Celebration: XP gain, streak popup, milestone reached, urge surfed. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Cautionary: confirming that protection is being disabled. */
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Rejection buzz: wrong PIN, failed unlock. */
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
