"use client";

import { useState, useMemo, useCallback } from "react";
import { t, useLocale, formatPrice } from "@/lib/i18n";
import type { PriceCalendarResult, PriceCalendarEntry } from "@/lib/public-api";

interface PriceCalendarProps {
  result: PriceCalendarResult;
  config: {
    hotel: string;
    room: string;
    meal: string;
    adults: number;
    children: number;
    childAges: number[];
    nights: number;
  };
  onDateSelected: (entry: PriceCalendarEntry) => void;
  selectedDate: string | null;
}

const MONTH_NAMES_RU = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MONTH_NAMES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DAY_NAMES_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonthNames(locale: string) {
  return locale === "ru" ? MONTH_NAMES_RU : MONTH_NAMES_EN;
}

function getDayNames(locale: string) {
  return locale === "ru" ? DAY_NAMES_RU : DAY_NAMES_EN;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  // Convert Sunday=0 to Monday-start (0=Mon, 6=Sun)
  return day === 0 ? 6 : day - 1;
}

export default function PriceCalendar({ result, config, onDateSelected, selectedDate }: PriceCalendarProps) {
  const locale = useLocale();
  const monthNames = getMonthNames(locale);
  const dayNames = getDayNames(locale);

  // Build price map for quick lookup
  const priceMap = useMemo(() => {
    const map = new Map<string, PriceCalendarEntry>();
    for (const entry of result.entries) {
      map.set(entry.date, entry);
    }
    return map;
  }, [result.entries]);

  // Current month navigation
  const [currentYear, setCurrentYear] = useState(() => {
    const d = new Date(result.dateFrom);
    return d.getFullYear();
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(result.dateFrom);
    return d.getMonth();
  });

  const goToPrevMonth = useCallback(() => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }, [currentMonth]);

  const goToNextMonth = useCallback(() => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }, [currentMonth]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const days: Array<{ day: number; dateStr: string; entry: PriceCalendarEntry | null; isToday: boolean; isSelected: boolean }> = [];

    const today = new Date().toISOString().split("T")[0];

    for (let i = 0; i < firstDay; i++) {
      days.push({ day: 0, dateStr: "", entry: null, isToday: false, isSelected: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const entry = priceMap.get(dateStr) ?? null;
      days.push({
        day: d,
        dateStr,
        entry,
        isToday: dateStr === today,
        isSelected: dateStr === selectedDate,
      });
    }

    return days;
  }, [currentYear, currentMonth, priceMap, selectedDate]);

  // Summary for selected date
  const selectedEntry = selectedDate ? priceMap.get(selectedDate) ?? null : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-bold text-slate-900">{t("calendar.title", locale)}</h3>

      {/* Month navigation */}
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={goToPrevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-slate-800">
          {monthNames[currentMonth]} {currentYear}
        </span>
        <button
          type="button"
          onClick={goToNextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          ›
        </button>
      </div>

      {/* Day headers */}
      <div className="mt-3 grid grid-cols-7 gap-0.5">
        {dayNames.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((cell, i) => {
          if (cell.day === 0) {
            return <div key={`empty-${i}`} className="h-12" />;
          }

          const hasPrice = cell.entry && cell.entry.price !== null;
          const isAvailable = hasPrice && cell.entry!.availability === "AVAILABLE";
          const isUnavailable = cell.entry && cell.entry.availability !== "AVAILABLE";

          return (
            <button
              key={cell.dateStr}
              type="button"
              disabled={!isAvailable}
              onClick={() => cell.entry && onDateSelected(cell.entry)}
              className={`relative flex h-12 flex-col items-center justify-center rounded-lg text-xs transition-colors ${
                cell.isSelected
                  ? "bg-blue-600 text-white"
                  : cell.isToday
                    ? "bg-blue-50 text-blue-700"
                    : isAvailable
                      ? "hover:bg-blue-50 text-slate-700 cursor-pointer"
                      : isUnavailable
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-slate-300 cursor-not-allowed"
              }`}
            >
              <span className={`font-medium ${cell.isSelected ? "text-white" : ""}`}>{cell.day}</span>
              {hasPrice && cell.entry && (
                <span className={`text-[9px] leading-tight ${cell.isSelected ? "text-blue-100" : "text-slate-500"}`}>
                  {cell.entry.price?.toLocaleString()}
                </span>
              )}
              {!hasPrice && cell.entry === null && (
                <span className={`text-[9px] ${cell.isSelected ? "text-blue-200" : "text-slate-300"}`}>—</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded bg-blue-600" />
          {t("calendar.selected", locale)}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded bg-blue-50" />
          {t("calendar.today", locale)}
        </span>
        <span>— {t("calendar.unavailable", locale)}</span>
      </div>

      {/* Selected date summary */}
      {selectedEntry && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="text-sm font-semibold text-blue-900">
            {new Date(selectedEntry.date).toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
          <div className="mt-1.5 space-y-0.5 text-xs text-blue-700">
            <div>{config.nights} {t("calendar.nights", locale)}</div>
            <div>{config.adults} {t("calendar.adults", locale)}</div>
            {config.children > 0 && (
              <div>
                {config.children} {t("calendar.children", locale)}
                {config.childAges.length > 0 && `, ${t("calendar.ages", locale)}: ${config.childAges.join(", ")}`}
              </div>
            )}
            {config.room && <div>{config.room}</div>}
            {config.meal && <div>{config.meal}</div>}
          </div>
          <div className="mt-2 border-t border-blue-100 pt-2">
            <div className="text-[11px] text-blue-600">{t("calendar.total_price", locale)}:</div>
            <div className="text-lg font-bold text-blue-900">
              {selectedEntry.price?.toLocaleString()} {selectedEntry.currency}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-3 text-[10px] text-slate-400">
        {t("calendar.scanned", locale)}: {result.totalOffersScanned} {t("calendar.offers", locale)}
      </div>
    </div>
  );
}
