"use client";

import { type PeriodPreset } from "@/lib/dashboard-api";

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "TODAY", label: "Сегодня" },
  { value: "LAST_3_DAYS", label: "3 дня" },
  { value: "LAST_7_DAYS", label: "7 дней" },
  { value: "MONTH", label: "Месяц" },
  { value: "LAST_6_MONTHS", label: "6 месяцев" },
  { value: "YEAR", label: "Год" },
  { value: "CUSTOM", label: "Период" },
];

interface Props {
  preset: PeriodPreset;
  comparison: boolean;
  customStart: string;
  customEnd: string;
  onPresetChange: (preset: PeriodPreset) => void;
  onComparisonChange: (on: boolean) => void;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
}

export function PeriodSelector({
  preset,
  comparison,
  customStart,
  customEnd,
  onPresetChange,
  onComparisonChange,
  onCustomStartChange,
  onCustomEndChange,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={preset}
        onChange={(e) => onPresetChange(e.target.value as PeriodPreset)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        aria-label="Период"
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      {preset === "CUSTOM" && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={customStart}
            onChange={(e) => onCustomStartChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            aria-label="Начало периода"
          />
          <span className="text-slate-400">—</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => onCustomEndChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            aria-label="Конец периода"
          />
        </div>
      )}

      <label className="flex items-center gap-1.5 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={comparison}
          onChange={(e) => onComparisonChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-blue-500 focus:ring-blue-400"
        />
        Сравнение
      </label>
    </div>
  );
}
