"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { t, useLocale } from "@/lib/i18n";
import Price from "@/components/public/Price";
import {
  getPriceCalendar,
  type SupplierPriceCalendarQuery,
  type SupplierPriceCalendarEntry,
} from "@/lib/supplier-api";

/**
 * MonthlyCalendar — full monthly calendar grid with real KOMPAS prices.
 *
 * Shows a standard travel booking calendar with month navigation.
 * Each available departure date shows the minimum price.
 * Clicking an available date triggers onSelect with the full entry data.
 */
export default function MonthlyCalendar({
  query,
  onSelect,
}: {
  query: SupplierPriceCalendarQuery;
  onSelect?: (entry: SupplierPriceCalendarEntry) => void;
}) {
  const locale = useLocale();
  const [entries, setEntries] = useState<SupplierPriceCalendarEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Current month being displayed
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPriceCalendar(query);
      setEntries(data.entries);

      // Auto-advance to first month with available prices
      const availableEntry = data.entries.find(
        (e) => e.availability === "AVAILABLE" && e.price !== null,
      );
      if (availableEntry) {
        const [y, m] = availableEntry.date.split("-").map(Number);
        const firstOfMonth = new Date(y, m - 1, 1);
        const now = new Date();
        const currentFirst = new Date(now.getFullYear(), now.getMonth(), 1);
        if (firstOfMonth.getTime() > currentFirst.getTime()) {
          setCurrentMonth(firstOfMonth);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("supports nights") || msg.includes("UNSUPPORTED")) {
        setError(t("supplier.error.unsupported", locale));
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

  // Build a map from date string to entry
  const entryMap = useMemo(() => {
    const map = new Map<string, SupplierPriceCalendarEntry>();
    for (const e of entries) {
      map.set(e.date.slice(0, 10), e);
    }
    return map;
  }, [entries]);

  // Calendar grid for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Monday-based: 0=Mon, 6=Sun
    const startDow = (firstDay.getDay() + 6) % 7;

    // Helper: local date → YYYY-MM-DD (avoids UTC mismatch from toISOString)
    const toLocalDateStr = (d: Date): string => {
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const day = d.getDate();
      return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    };

    const days: Array<{
      date: Date;
      dateStr: string;
      isCurrentMonth: boolean;
      entry: SupplierPriceCalendarEntry | null;
    }> = [];

    // Previous month filler
    for (let i = 0; i < startDow; i++) {
      const d = new Date(year, month, -(startDow - 1 - i));
      days.push({
        date: d,
        dateStr: toLocalDateStr(d),
        isCurrentMonth: false,
        entry: null,
      });
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateStr = toLocalDateStr(d);
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: true,
        entry: entryMap.get(dateStr) ?? null,
      });
    }

    // Next month filler to complete the grid (always show 6 rows = 42 cells)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        dateStr: toLocalDateStr(d),
        isCurrentMonth: false,
        entry: null,
      });
    }

    return days;
  }, [currentMonth, entryMap]);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthLabel = currentMonth.toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US", {
    year: "numeric",
    month: "long",
  });

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          aria-label="Previous month"
        >
          ‹
        </button>
        <h4 className="text-sm font-semibold text-slate-800">{monthLabel}</h4>
        <button
          onClick={nextMonth}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">{error}</p>
          <button
            onClick={fetchCalendar}
            className="mt-2 text-sm text-amber-600 underline hover:text-amber-800"
          >
            {t("supplier.retry", locale)}
          </button>
        </div>
      )}

      {/* Calendar grid */}
      {!loading && !error && (
        <>
          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => (
              <div key={day} className="py-1 text-center text-xs font-medium text-slate-500">
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const isAvailable =
                day.isCurrentMonth &&
                day.entry &&
                day.entry.availability === "AVAILABLE" &&
                day.entry.price !== null;
              const isToday =
                day.dateStr === new Date().toISOString().slice(0, 10);

              return (
                <button
                  key={day.dateStr}
                  onClick={() => isAvailable && onSelect?.(day.entry!)}
                  disabled={!isAvailable}
                  className={`
                    relative h-16 rounded-lg border p-1.5 text-left transition-colors
                    ${!day.isCurrentMonth
                      ? "border-transparent bg-transparent"
                      : isAvailable
                        ? "border-green-200 bg-green-50 hover:bg-green-100 cursor-pointer"
                        : day.entry?.absenceCode
                          ? "border-amber-200 bg-amber-50 cursor-not-allowed"
                          : "border-slate-100 bg-slate-50/50 cursor-not-allowed"
                    }
                    ${isToday ? "ring-2 ring-blue-400" : ""}
                  `}
                >
                  <div
                    className={`text-xs font-medium ${
                      day.isCurrentMonth ? "text-slate-700" : "text-slate-300"
                    }`}
                  >
                    {day.date.getDate()}
                  </div>
                  {isAvailable && day.entry!.price !== null ? (
                    <div className="mt-0.5 text-[11px] font-bold text-green-700">
                      <Price
                        amount={day.entry!.price}
                        currency={day.entry!.currency}
                        size="sm"
                        withPrefix={false}
                      />
                    </div>
                  ) : day.isCurrentMonth && day.entry?.absenceCode ? (
                    <div className="mt-0.5 text-[9px] text-amber-600 truncate">
                      —
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
