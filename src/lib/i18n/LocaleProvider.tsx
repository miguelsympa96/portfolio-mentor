"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, detectBrowserLocale, isSupportedLocale, type Locale } from "./locale";
import type { Dictionary } from "./dictionary";
import { es } from "./dictionaries/es";
import { en } from "./dictionaries/en";
import { fr } from "./dictionaries/fr";
import { pt } from "./dictionaries/pt";

const DICTIONARIES: Record<Locale, Dictionary> = { es, en, fr, pt };
const STORAGE_KEY = "portfolio-mentor-locale";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time client-only
       locale resolution (manual override in localStorage, else browser
       language); `navigator`/`localStorage` aren't available during SSR. */
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isSupportedLocale(stored)) {
        setLocaleState(stored);
        return;
      }
    } catch {
      // localStorage unavailable (private browsing) — fall through to
      // browser-language detection instead.
    }
    setLocaleState(detectBrowserLocale());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisted this session, but the in-memory switch still works.
    }
  }

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t: DICTIONARIES[locale] }),
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}
