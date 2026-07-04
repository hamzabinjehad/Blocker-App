import { createContext, useContext, type ReactNode } from 'react';

import { useProtectionState } from '@/store/useProtectionState';

type ProtectionStore = ReturnType<typeof useProtectionState>;

// Single owner of the protection state. useProtectionState performs full native
// bridge fetches (getStatus + getGuardianAlerts) on mount, so it must run exactly
// once per app — screens consume this context instead of calling the hook.
const ProtectionContext = createContext<ProtectionStore | null>(null);

export function ProtectionProvider({ children }: { children: ReactNode }) {
  const store = useProtectionState();
  return <ProtectionContext.Provider value={store}>{children}</ProtectionContext.Provider>;
}

export function useProtection(): ProtectionStore {
  const store = useContext(ProtectionContext);
  if (!store) {
    throw new Error('useProtection must be used within a ProtectionProvider');
  }
  return store;
}
