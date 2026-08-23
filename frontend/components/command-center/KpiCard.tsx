"use client";

import { type KpiValue } from "@/lib/dashboard-api";

interface Props {
  title: string;
  value: KpiValue;
  format?: "number" | "currency" | "percent";
  currency?: string;
  /** Whether higher values are positive (default true). */
  positiveIsUp?: boolean;
}

/** Currency symbol map — Intl.NumberFormat lacks ₼ for AZN in Chromium. */
const CURRENCY_SYMBOL: Record<string, string> = { AZN: "\u20bc", USD: "$", EUR: "\u20ac" };

function formatValue(v: number | null, format: string, currency: string): string {
  if (v === null || v === undefined) return "—";
  if (format === "currency") {
    // B.2 Remediation: PLATFORM REPORTING CURRENCY = AZN
    // Intl.NumberFormat returns "AZN" instead of "₼" — use explicit symbol
    const sym = CURRENCY_SYMBOL[currency];
    if (sym) {
      return new Intl.NumberFormat("ru-RU", {
        style: "decimal",
        maximumFractionDigits: 0,
      }).format(v) + " " + sym;
    }
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currency || "AZN",
      maximumFractionDigits: 0,
    }).format(v);
  }
  if (format === "percent") {
    return new Intl.NumberFormat("ru-RU", {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(v / 100);
  }
  return new Intl.NumberFormat("ru-RU").format(v);
}

export function KpiCard({ title, value, format = "number", currency = "AZN", positiveIsUp = true }: Props) {
  // B.2: prefer currency from KpiValue (backend-reported) over prop default
  // B.2 Remediation: PLATFORM REPORTING CURRENCY = AZN
  const effectiveCurrency = value.currency || currency;
  const formatted = formatValue(value.current, format, effectiveCurrency);
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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{formatted}</div>
      {hasDelta && (
        <div className={`mt-1 text-xs font-medium ${polarityClass}`}>
          {value.deltaPercent! > 0 ? "↑" : value.deltaPercent! < 0 ? "↓" : "→"}{" "}
          {Math.abs(value.deltaPercent!).toFixed(1)}%
        </div>
      )}
    </div>
  );
}
