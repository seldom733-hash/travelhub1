"use client";

import Link from "next/link";
import { type KpiValue } from "@/lib/dashboard-api";
import { formatPrice } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

interface Props {
  title: string;
  value: KpiValue;
  format?: "number" | "currency" | "percent";
  currency?: string;
  /** Whether higher values are positive (default true). */
  positiveIsUp?: boolean;
  /** Optional subtitle/tooltip explaining the metric semantics. */
  subtitle?: string;
  /** Locale for currency formatting. */
  locale?: Locale;
  /** Optional navigation target — renders card as a clickable Link. */
  href?: string;
}

function formatValue(v: number | null, format: string, currency: string, locale: Locale): string {
  if (v === null || v === undefined) return "—";
  if (format === "currency") {
    // Use shared formatPrice for consistent currency presentation
    const result = formatPrice(v, currency, locale);
    return result ?? "—";
  }
  if (format === "percent") {
    return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US", {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(v / 100);
  }
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US").format(v);
}

export function KpiCard({ title, value, format = "number", currency = "AZN", positiveIsUp = true, subtitle, locale = "ru", href }: Props) {
  // B.2: prefer currency from KpiValue (backend-reported) over prop default
  const effectiveCurrency = value.currency || currency;
  // Use displayCurrent for reconciled integer presentation when available
  const displayValue = value.displayCurrent ?? value.current;
  const formatted = formatValue(displayValue, format, effectiveCurrency, locale);
  const hasDelta = value.deltaPercent !== null && value.deltaPercent !== undefined;

  // Determine polarity
  let polarityClass = "text-slate-400";
  if (hasDelta && value.deltaPercent! !== 0) {
    const isPositive = value.deltaPercent! > 0;
    if (positiveIsUp) {
      polarityClass = isPositive ? "text-emerald-600" : "text-red-500";
    } else {
      polarityClass = isPositive ? "text-red-500" : "text-emerald-600";
    }
  }

  const inner = (
    <>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{formatted}</div>
      {hasDelta && (
        <div className={`mt-1 text-xs font-medium ${polarityClass}`}>
          {value.deltaPercent! > 0 ? "↑" : value.deltaPercent! < 0 ? "↓" : "→"}{" "}
          {Math.abs(value.deltaPercent!).toFixed(1)}%
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-blue-300 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer block"
        title={subtitle}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" title={subtitle}>
      {inner}
    </div>
  );
}
