"use client";

import { LOCALES, LOCALE_NAMES, t, useLocale, useSetLocale } from "@/lib/i18n";

/**
 * PHASE 1 STEP 1.7 §17 — селектор языка RU/AZ/EN.
 * Сохранение: localStorage (LocaleProvider) + синхронизация <html lang>.
 */
export default function LocaleSelector({ variant = "header" }: { variant?: "header" | "compact" }) {
  const locale = useLocale();
  const setLocale = useSetLocale();

  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span className="sr-only">{t("nav.locale", locale)}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as (typeof LOCALES)[number])}
        aria-label={t("nav.locale", locale)}
        className={`rounded-lg border border-dark-border bg-dark-surface text-xs font-medium text-neutral-200 outline-none transition-colors focus:border-gold ${
          variant === "compact" ? "px-1.5 py-1" : "px-2 py-1.5"
        }`}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {l.toUpperCase()} · {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
