"use client";

import { useEffect } from "react";
import { locales, setLocale, useLocale, useT } from "./locale";

/** EN | ES switch. English is the default. */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useT();
  // Keep <html lang> in step with the stored choice after hydration.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <div
      role="group"
      aria-label={t("Language", "Idioma")}
      className={`language-toggle ${className}`}
    >
      {locales.map((value) => (
        <button
          key={value}
          type="button"
          lang={value}
          aria-pressed={locale === value}
          aria-label={value === "en" ? "English" : "Español"}
          onClick={() => setLocale(value)}
        >
          {value.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
