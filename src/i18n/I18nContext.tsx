import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { translations } from './translations';
import type { Language, TranslationKey } from './translations';

const LANGUAGE_KEY = '@app_language_preference';

export type TranslationVars = Record<string, string | number>;

// Replace {name} placeholders with provided values. The flat string table has
// no built-in interpolation, so dynamic copy ("{count} blocks") relies on this.
function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

type I18nContextValue = {
  language: Language;
  isRTL: boolean;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, vars?: TranslationVars) => string;
};

const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  isRTL: false,
  setLanguage: () => {},
  t: (key) => translations.en[key],
});

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>('en');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(LANGUAGE_KEY).then((stored) => {
      if (stored === 'en' || stored === 'ar') {
        setLanguageState(stored);
      }
      setLoaded(true);
    });
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    // Persist the choice BEFORE touching layout direction: forceRTL() can trigger a
    // native reload, and a fire-and-forget write can lose the race (the preference
    // then reverts on the next launch). Await the write, then align direction.
    void (async () => {
      await AsyncStorage.setItem(LANGUAGE_KEY, next);
      const wantRTL = next === 'ar';
      I18nManager.allowRTL(wantRTL);
      if (I18nManager.isRTL !== wantRTL) {
        I18nManager.forceRTL(wantRTL);
      }
    })();
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: TranslationVars) =>
      interpolate(translations[language][key] ?? translations.en[key], vars),
    [language],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ language, isRTL: language === 'ar', setLanguage, t }),
    [language, setLanguage, t],
  );

  if (!loaded) return null;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useTranslation() {
  return useI18n().t;
}
