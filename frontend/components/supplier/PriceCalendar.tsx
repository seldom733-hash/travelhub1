"use client";

import { useState, useEffect, useCallback } from "react";
import { t, useLocale } from "@/lib/i18n";
import Price from "@/components/public/Price";
import {
  getPriceCalendar,
  type SupplierPriceCalendarQuery,
  type SupplierPriceCalendarEntry,
  type SupplierPriceCalendarResult,
} from "@/lib/supplier-api";

/**
 * PriceCalendar — displays a grid of prices per date for a given configuration.
 *
 * Uses the public supplier price-calendar endpoint.
 * Shows availability states: available, unavailable, unknown, error.
 */
export default function PriceCalendar({
  query,
  onSelect,
}: {
  query: SupplierPriceCalendarQuery;
  onSelect?: (entry: SupplierPriceCalendarEntry) => void;
}) {
  const locale = useLocale();
  const [result, setResult] = useState<SupplierPriceCalendarResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPriceCalendar(query);
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Distinguish validation errors from transient errors
      if (msg.includes("supports nights") || msg.includes("UNSUPPORTED")) {
        setError(t("supplier.error.unsupported", locale));
      } else if (msg.includes("timeout") || msg.includes("TIMEOUT")) {
        setError(t("supplier.error.timeout", locale));
      } else if (msg.includes("no price_info") || msg.includes("NO_RESULT")) {
        setError(t("supplier.error.no_results", locale));
      } else {
        setError(t("supplier.error.generic", locale));
      }
    } finally {
      setLoading(false);
    }
  }, [query, locale]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  if (loading) {
    return (
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 28 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-lg bg-slate-100 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-800">{error}</p>
        <button
          onClick={fetchCalendar}
          className="mt-2 text-sm text-amber-600 underline hover:text-amber-800"
        >
          {t("supplier.retry", locale)}
        </button>
      </div>
    );
  }

  if (!result || result.entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <p className="text-sm text-slate-500">
          {t("supplier.calendar.empty", locale)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-500 mb-2">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-300" />
          {t("supplier.available", locale)}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300" />
          {t("supplier.unavailable", locale)}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-50 border border-amber-300" />
          {t("supplier.unknown", locale)}
        </span>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {result.entries.map((entry) => {
          const isAvailable = entry.availability === "AVAILABLE" && entry.price !== null;
          const hasError = entry.absenceCode != null;

          return (
            <button
              key={entry.date}
              onClick={() => isAvailable && onSelect?.(entry)}
              disabled={!isAvailable}
              className={`
                h-16 rounded-lg border p-2 text-left transition-colors
                ${isAvailable
                  ? "border-green-300 bg-green-50 hover:bg-green-100 cursor-pointer"
                  : hasError
                    ? "border-amber-300 bg-amber-50 cursor-not-allowed"
                    : "border-slate-200 bg-slate-50 cursor-not-allowed"
                }
              `}
            >
              <div className="text-xs font-medium text-slate-600">
                {entry.date.slice(5)}
              </div>
              {isAvailable && entry.price !== null ? (
                <div className="text-sm font-bold text-slate-900 mt-1">
                  <Price
                    amount={entry.price}
                    currency={entry.currency}
                    size="sm"
                    withPrefix={false}
                  />
                </div>
              ) : hasError ? (
                <div className="text-xs text-amber-600 mt-1 truncate">
                  {entry.absenceText ?? entry.absenceCode}
                </div>
              ) : (
                <div className="text-xs text-slate-400 mt-1">—</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
