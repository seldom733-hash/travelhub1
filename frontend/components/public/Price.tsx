"use client";

import { formatPrice, t, useLocale } from "@/lib/i18n";

/**
 * PHASE 1 STEP 1.7 §8 — цена на витрине.
 * «от 120 AZN» (locale-aware Intl) или «Цена по запросу". null/undefined/пустое → по запросу.
 * 0 — валидная монетарная величина (0 ₼), НЕ "по запросу".
 */
export default function Price({
  amount,
  currency,
  size = "md",
  withPrefix = true,
  tone = "dark",
}: {
  amount: string | number | null | undefined;
  currency?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  withPrefix?: boolean;
  /** "dark" = тёмный текст (светлый фон), "light" = белый текст (тёмный фон). */
  tone?: "dark" | "light";
}) {
  const locale = useLocale();
  const formatted = formatPrice(amount, currency, locale);
  const prefix = withPrefix ? `${t("price.from", locale)} ` : "";

  // formatPrice returns null only for null/undefined/empty/NaN/negative.
  // 0 returns as visible zero ("0 ₼"), which is correct.
  if (formatted === null) {
    return <span className="text-sm text-slate-400">{t("price.on_request", locale)}</span>;
  }

  const color = tone === "light" ? "text-white" : "text-slate-900";
  const cls =
    size === "lg"
      ? `text-3xl font-bold ${color}`
      : size === "sm"
        ? `text-sm font-bold ${color}`
        : size === "xs"
          ? `text-[10px] font-bold leading-none ${color}`
          : `text-lg font-bold ${color}`;

  return (
    <span className={cls}>
      {prefix}
      {formatted}
    </span>
  );
}
