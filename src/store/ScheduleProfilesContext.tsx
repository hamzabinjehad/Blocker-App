import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

import { useProtection } from '@/store/ProtectionContext';
import { useScheduleProfiles } from '@/store/useScheduleProfiles';

type ScheduleStore = ReturnType<typeof useScheduleProfiles>;

const ScheduleProfilesContext = createContext<ScheduleStore | null>(null);

// Single owner of schedule-profile state (AsyncStorage-backed, resolved every
// minute) plus the JS-side enforcement bridge: when a schedule window becomes
// active, protection is switched ON if it is currently off.
//
// Enforcement is deliberately one-directional — a schedule can raise
// protection but never lower or disable it, otherwise a permissive window
// would be a bypass around PIN-locked protection. It also only fires while the
// app process is alive (JS timer); transitions while the app is killed apply
// on next launch. A native scheduler is the known follow-up.
export function ScheduleProfilesProvider({ children }: { children: ReactNode }) {
  const store = useScheduleProfiles();
  const protection = useProtection();
  const lastAppliedProfileIdRef = useRef<string | null>(null);

  const { activeProfileId, currentStrictness } = store.activeState;
  const protectionActive = protection.statusVerified && protection.vpnActive;

  useEffect(() => {
    if (!protection.hydrated) return;
    if (!activeProfileId || currentStrictness === 'off') {
      lastAppliedProfileIdRef.current = null;
      return;
    }
    if (lastAppliedProfileIdRef.current === activeProfileId) return;
    lastAppliedProfileIdRef.current = activeProfileId;
    if (!protectionActive) {
      void protection.startProtection();
    }
  }, [activeProfileId, currentStrictness, protection, protectionActive]);

  return <ScheduleProfilesContext.Provider value={store}>{children}</ScheduleProfilesContext.Provider>;
}

export function useSchedules(): ScheduleStore {
  const store = useContext(ScheduleProfilesContext);
  if (!store) {
    throw new Error('useSchedules must be used within a ScheduleProfilesProvider');
  }
  return store;
}
