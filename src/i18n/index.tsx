import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from './en';
import { nb, type MessageKey, type Messages } from './nb';
import { readSetting, writeSetting } from '../lib/settings';

export const LANGUAGES = {
  nb: { label: 'Norsk (bokmål)', locale: 'nb-NO', messages: nb as Messages },
  en: { label: 'English', locale: 'en-GB', messages: en },
} as const;

export type Language = keyof typeof LANGUAGES;
export const DEFAULT_LANGUAGE: Language = 'nb';

type Params = Record<string, string | number>;

export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

export function translate(lang: Language, key: MessageKey, params?: Params): string {
  const msg = LANGUAGES[lang].messages[key] ?? nb[key] ?? key;
  return interpolate(msg, params);
}

/** Plural helper: uses `${base}.one` / `${base}.other`. */
export function translatePlural(lang: Language, base: string, n: number, params?: Params): string {
  const rule = new Intl.PluralRules(LANGUAGES[lang].locale).select(n) === 'one' ? 'one' : 'other';
  return translate(lang, `${base}.${rule}` as MessageKey, { n, ...params });
}

interface I18nValue {
  lang: Language;
  locale: string;
  setLang: (l: Language) => void;
  t: (key: MessageKey, params?: Params) => string;
  tp: (base: string, n: number, params?: Params) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function initialLanguage(): Language {
  const saved = readSetting('lang');
  return saved && saved in LANGUAGES ? (saved as Language) : DEFAULT_LANGUAGE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(initialLanguage);
  useEffect(() => {
    document.documentElement.lang = lang === 'nb' ? 'nb' : 'en';
  }, [lang]);
  const setLang = useCallback((l: Language) => {
    setLangState(l);
    writeSetting('lang', l);
  }, []);
  const value = useMemo<I18nValue>(
    () => ({
      lang,
      locale: LANGUAGES[lang].locale,
      setLang,
      t: (key, params) => translate(lang, key, params),
      tp: (base, n, params) => translatePlural(lang, base, n, params),
    }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}

export type { MessageKey };
