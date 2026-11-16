import { useCallback, useSyncExternalStore } from "react";

// Interface language. English is the primary language; Spanish is the alternative.
export type Locale = "en" | "es";
export const locales: readonly Locale[] = ["en", "es"];
export const DEFAULT_LOCALE: Locale = "en";

/** A string in both languages, for text defined outside React components. */
export interface Text {
  en: string;
  es: string;
}

const KEY = "atlas:locale";
const listeners = new Set<() => void>();
let current: Locale | null = null;

/** The active language; usable outside React (gateways, formatters). */
export function getLocale(): Locale {
  if (current) return current;
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(KEY);
    const found = locales.find((locale) => locale === stored);
    if (found) current = found;
  } catch {
    // Storage can be blocked (private mode, site data cleared): keep the default.
  }
  return current ?? DEFAULT_LOCALE;
}

export function setLocale(locale: Locale) {
  current = locale;
  try {
    window.localStorage.setItem(KEY, locale);
  } catch {
    // Not persisted; the choice still holds for this visit.
  }
  document.documentElement.lang = locale;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useLocale(): Locale {
  return useSyncExternalStore<Locale>(
    subscribe,
    getLocale,
    () => DEFAULT_LOCALE,
  );
}

/** Picks the string for a locale. */
export function pick(text: Text, locale: Locale) {
  return text[locale];
}

/** `t("English", "Español")` returns the text in the active language. */
export function useT() {
  const locale = useLocale();
  return useCallback(
    (en: string, es: string) => (locale === "en" ? en : es),
    [locale],
  );
}
