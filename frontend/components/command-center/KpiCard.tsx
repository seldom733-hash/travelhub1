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

function formatValue(v: number | null, format: string, currency: string): string {
  if (v === null || v === undefined) return "—";
  if (format === "currency") {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currency || "USD",
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

export function KpiCard({ title, value, format = "number", currency = "USD", positiveIsUp = true }: Props) {
  const formatted = formatValue(value.current, format, currency);
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
