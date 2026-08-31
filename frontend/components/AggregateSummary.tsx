"use client";

/**
 * SR-TABLE-01 — Shared Aggregate Summary (ИТОГО)
 *
 * Renders aggregate totals above data tables, calculated over the full
 * filtered population (not just the current page).
 *
 * Layout:
 *   FILTER BAR
 *   ↓
 *   ИТОГО ПО ТЕКУЩЕЙ ВЫБОРКЕ
 *   ↓
 *   TABLE
 *   ↓
 *   PAGINATION
 */

import { useLocale, t } from "@/lib/i18n";

export interface AggregateField {
  /** i18n key or raw label */
  label: string;
  /** Raw value (number, string, etc.) */
  value: number | string;
  /** Optional currency suffix */
  currency?: string;
  /** Display as money with locale formatting */
  isMoney?: boolean;
  /** Derived metric — shown with muted styling */
  isDerived?: boolean;
  /** Derived formula hint (e.g., "AOV = GMV / Orders") */
  hint?: string;
}

export interface CurrencyTotals {
  currency: string;
  fields: AggregateField[];
}

interface AggregateSummaryProps {
  /** Total records in the filtered population */
  totalRecords: number;
  /** Aggregate fields to display (count metrics, money totals, etc.) */
  fields?: AggregateField[];
  /** Multi-currency breakdown — shown as grouped totals per currency */
  currencyTotals?: CurrencyTotals[];
  /** Optional loading state */
  loading?: boolean;
  /** Optional empty state */
  empty?: boolean;
}

export default function AggregateSummary({
  totalRecords,
  fields = [],
  currencyTotals,
  loading = false,
  empty = false,
}: AggregateSummaryProps) {
  const locale = useLocale();

  const fmt = (v: number | string, isMoney?: boolean, currency?: string) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (isNaN(n)) return String(v);
    const formatted = n.toLocaleString(
      locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US",
      { minimumFractionDigits: isMoney ? 2 : 0, maximumFractionDigits: isMoney ? 2 : 0 },
    );
    return currency ? `${formatted} ${currency}` : formatted;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
      </div>
    );
  }

  if (empty) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {/* Header label */}
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t("aggregate.title", locale) || "Итого по текущей выборке"}
        </span>

        {/* Total records */}
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
          <span className="font-semibold">{totalRecords}</span>
          <span className="text-slate-400">{t("aggregate.records", locale) || "записей"}</span>
        </span>

        {/* Aggregate fields */}
        {fields.map((f, i) => (
          <span
            key={`${f.label}-${i}`}
            className={`inline-flex items-center gap-1.5 text-xs ${f.isDerived ? "text-slate-500" : "text-slate-700"}`}
            title={f.hint}
          >
            <span className="text-slate-400">{f.label}:</span>
            <span className={`font-semibold ${f.isDerived ? "italic" : ""}`}>
              {fmt(f.value, f.isMoney, f.currency)}
            </span>
          </span>
        ))}

        {/* Multi-currency breakdown */}
        {currencyTotals && currencyTotals.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {currencyTotals.map((ct) => (
              <span
                key={ct.currency}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500"
              >
                <span className="font-semibold text-slate-700">{ct.currency}</span>
                {ct.fields.map((f, i) => (
                  <span key={`${ct.currency}-${f.label}-${i}`} className="text-slate-500">
                    {f.label}: {fmt(f.value, f.isMoney)}
                  </span>
                ))}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
