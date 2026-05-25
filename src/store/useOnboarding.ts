import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@onboarding_completed';

export function useOnboarding() {
  const [completed, setCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((v) => setCompleted(v === 'true'));
  }, []);

  const complete = useCallback(() => {
    setCompleted(true);
    void AsyncStorage.setItem(KEY, 'true');
  }, []);

  const reset = useCallback(() => {
    setCompleted(false);
    void AsyncStorage.removeItem(KEY);
  }, []);

  return { completed, complete, reset };
}
