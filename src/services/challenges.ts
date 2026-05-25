import type { MoodCheckIn } from '@/services/mood';

export type ChallengeInput = {
  streak: number;
  cleanHours: number;
  totalBlocks: number;
  mood: MoodCheckIn;
  focusActive: boolean;
  anomalyRiskLevel: string;
  mediaScanningActive: boolean;
  weakSpots: string[];
};

export type PersonalizedChallenge = {
  id: string;
  title: string;
  target: string;
  reason: string;
  xp: number;
};

export function generatePersonalizedChallenge(input: ChallengeInput): PersonalizedChallenge {
  const weakSpot = input.weakSpots[0];

  if (input.anomalyRiskLevel === 'critical' || input.anomalyRiskLevel === 'high') {
    return {
      id: 'lock-bypass-route',
      title: 'Lock the bypass route',
      target: 'Review alerts and keep protection active for the next hour.',
      reason: 'Recent device changes suggest a bypass pattern.',
      xp: 35,
    };
  }

  if (input.mood === 'tempted') {
    return {
      id: 'ten-minute-reset',
      title: '10-minute reset',
      target: 'Stay in protected mode for 10 minutes and do one offline activity.',
      reason: 'Temptation spikes usually fade when the next step is small.',
      xp: 25,
    };
  }

  if (input.mood === 'bored') {
    return {
      id: 'replace-scroll-loop',
      title: 'Replace the scroll loop',
      target: 'Open Focus Mode and leave short-form apps out for one session.',
      reason: weakSpot ? `${weakSpot} has been a recent weak spot.` : 'Boredom is easier to redirect before it becomes browsing.',
      xp: 25,
    };
  }

  if (input.focusActive) {
    return {
      id: 'finish-focus-window',
      title: 'Finish the focus window',
      target: 'Keep the current Focus Mode window clean until it ends.',
      reason: 'The best challenge right now is already running.',
      xp: 20,
    };
  }

  if (!input.mediaScanningActive) {
    return {
      id: 'enable-image-scan',
      title: 'Restore image scanning',
      target: 'Enable Accessibility so image and thumbnail scanning can run locally.',
      reason: 'Visual content checks depend on the local Accessibility pipeline.',
      xp: 30,
    };
  }

  if (input.streak >= 7) {
    return {
      id: 'protect-the-streak',
      title: 'Protect the streak',
      target: 'Add one new blocker rule for a weak spot before tonight.',
      reason: `${input.streak} clean days is worth defending proactively.`,
      xp: 30,
    };
  }

  return {
    id: 'first-clean-hour',
    title: 'First clean hour',
    target: 'Keep protection on for one focused hour.',
    reason: input.cleanHours > 0 ? 'You already have momentum today.' : 'A clean hour is the smallest reliable win.',
    xp: 20,
  };
}
