'use client';

import type { ReactNode } from 'react';

import { createContext, useContext, useEffect, useMemo } from 'react';

import { useAppLanguageStorage } from '@/hooks/useLocalStorage';
import { AppLanguage } from '@/lib/i18n/model';
import { hasTranslation, translate } from '@/lib/i18n/translator';

type TranslationParams = Record<string, string | number>;

type LanguageSetter = (
  language:
    | AppLanguage
    | ((prev: AppLanguage) => AppLanguage)
) => void;

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: LanguageSetter;
  t: (key: string, params?: TranslationParams) => string;
  has: (key: string) => boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useAppLanguageStorage();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, params) => translate(language, key, params),
      has: (key) => hasTranslation(language, key),
    }),
    [language, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguageContext(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguageContext must be used inside LanguageProvider');
  }
  return context;
}

export function useI18n(): LanguageContextValue {
  return useLanguageContext();
}
