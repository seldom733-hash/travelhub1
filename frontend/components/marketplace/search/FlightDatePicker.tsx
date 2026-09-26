"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarBlank, CaretLeft, CaretRight, X } from "@phosphor-icons/react";
import type { FlightCalendarDayPrice } from "@/lib/flight-api";

interface FlightDatePickerProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
  availability?: Record<string, FlightCalendarDayPrice> | null;
  loadingAvailability?: boolean;
  disabled?: boolean;
}

const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function toISODate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function parseISODate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

function formatDisplay(value: string): string {
  const parsed = parseISODate(value);
  if (!parsed) {
    return value;
  }
  const d = String(parsed.day).padStart(2, "0");
  const m = String(parsed.month + 1).padStart(2, "0");
  return `${d}.${m}.${parsed.year}`;
}

function todayISO(): string {
  const now = new Date();
  return toISODate(now.getFullYear(), now.getMonth(), now.getDate());
}

export default function FlightDatePicker({
  id,
  label,
  placeholder,
  value,
  onChange,
  minDate,
  availability,
  loadingAvailability,
  disabled,
}: FlightDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState<number>(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => new Date().getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveMin = minDate && minDate > todayISO() ? minDate : todayISO();

  // When the popup opens, jump to the selected date (or min date) month.
  useEffect(() => {
    if (!open) {
      return;
    }
    const anchor = parseISODate(value) ?? parseISODate(effectiveMin);
    if (anchor) {
      setViewYear(anchor.year);
      setViewMonth(anchor.month);
    }
  }, [open, value, effectiveMin]);

  const days = useMemo(() => {
    // Monday-first offset.
    const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: ({ iso: string; day: number } | null)[] = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ iso: toISODate(viewYear, viewMonth, day), day });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    const date = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
  };

  const selectDay = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  const clear = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={id}
        className="mb-0.5 block text-[11px] font-medium text-neutral-400"
      >
        {label}
      </label>

      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-dark-border bg-dark-card px-3 py-2 text-left outline-none transition-colors hover:border-gold/40 focus:border-gold/50 disabled:opacity-50"
      >
        <CalendarBlank size={14} weight="light" className="pointer-events-none shrink-0 text-neutral-500" />

        <span className={`min-w-0 flex-1 truncate text-[13px] ${value ? "text-white" : "text-neutral-500"}`}>
          {value ? formatDisplay(value) : placeholder}
        </span>

        {value ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                clear();
              }
            }}
            className="text-neutral-500 hover:text-white"
            aria-label="Очистить"
          >
            <X size={14} />
          </span>
        ) : null}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Закрыть календарь"
            className="fixed inset-0 z-[55] cursor-default bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-[60] mt-1 w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-dark-border bg-dark-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-dark-border px-3 py-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white"
                aria-label="Предыдущий месяц"
              >
                <CaretLeft size={14} />
              </button>
              <span className="text-[13px] font-medium text-white">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white"
                aria-label="Следующий месяц"
              >
                <CaretRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 px-3 pt-2">
              {WEEK_DAYS.map((d) => (
                <span key={d} className="pb-1 text-center text-[10px] font-medium text-neutral-500">
                  {d}
                </span>
              ))}
              {days.map((cell, index) => {
                if (!cell) {
                  return <span key={`empty-${index}`} />;
                }
                const isPast = cell.iso < effectiveMin;
                const isSelected = cell.iso === value;
                const info = availability?.[cell.iso];
                const hasFlight = Boolean(info);

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    disabled={isPast}
                    onClick={() => selectDay(cell.iso)}
                    title={
                      hasFlight && typeof info?.amount === "number"
                        ? `Есть рейсы от ${info.amount} ${info.currency ?? ""}`.trim()
                        : hasFlight
                          ? "Есть рейсы"
                          : "Нет рейсов"
                    }
                    className={`flex min-h-10 flex-col items-center justify-center rounded-lg px-0.5 py-1 text-[12px] transition-colors ${
                      isSelected
                        ? "bg-gold font-semibold text-black"
                        : isPast
                          ? "cursor-not-allowed text-neutral-700"
                          : hasFlight
                            ? "bg-gold/10 font-medium text-white hover:bg-gold/25"
                            : "text-neutral-500 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span>{cell.day}</span>
                    {hasFlight && (
                      <span className={`text-[9px] leading-none ${isSelected ? "text-black" : "text-gold"}`}>
                        {typeof info?.amount === "number" ? info.amount : "•"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between px-3 py-2 text-[10px] text-neutral-500">
              <span className="flex items-center gap-1">
                <span className="inline-block size-1.5 rounded-full bg-gold" />
                Есть рейсы
              </span>
              <span>{loadingAvailability ? "Загрузка дат…" : ""}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
