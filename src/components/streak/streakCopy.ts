export type StreakPopupState = 'clean' | 'freeze' | 'freshStart';

export function getStreakStatusLabel(state: StreakPopupState) {
  switch (state) {
    case 'freeze':
      return 'Streak protected';
    case 'freshStart':
      return 'Fresh start';
    case 'clean':
    default:
      return 'Protection active';
  }
}

export function getStreakButtonLabel(state: StreakPopupState) {
  return state === 'freshStart' ? 'Start fresh today' : 'Continue';
}

export function getStreakMotivation(streak: number, state: StreakPopupState) {
  if (state === 'freshStart') return 'Honesty keeps you moving.';
  if (state === 'freeze') return 'Your streak is protected. Keep the next choice simple.';
  if (streak <= 0) return 'Every reset can still become a useful signal.';
  if (streak === 1) return 'One clean day matters. Keep it simple.';
  if (streak < 7) return 'You are building proof, one day at a time.';
  if (streak === 7) return 'One week. That is repeated strength.';
  if (streak < 30) return 'Two weeks in. The pattern is getting quieter.';
  if (streak < 60) return 'One month. This is real behavioral evidence.';
  if (streak < 90) return 'Two months. Your defaults are changing.';
  return 'You have built a steady recovery rhythm.';
}
