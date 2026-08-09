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
        className={`rounded-lg border bg-white text-xs font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${
          variant === "compact" ? "border-slate-200 px-1.5 py-1" : "border-slate-200 px-2 py-1.5"
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
