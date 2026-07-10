export const SUPPORTED_LOCALES = ["es", "en", "fr", "pt"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

const LANG_NAMES: Record<Locale, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
  pt: "Português",
};

export function langName(locale: Locale): string {
  return LANG_NAMES[locale];
}

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// Browser language is the standard, privacy-respecting signal for "where a
// user is" for localization purposes (a Spain-based browser reports es-ES,
// a France-based one fr-FR, etc.) — no IP geolocation lookup needed.
export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const candidates =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];
  for (const raw of candidates) {
    const primary = raw.slice(0, 2).toLowerCase();
    if (isSupportedLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}
