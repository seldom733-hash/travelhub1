"use client";

import { type PeriodPreset } from "@/lib/dashboard-api";
import { t, type Locale } from "@/lib/i18n";

const PRESETS: { value: PeriodPreset; labelKey: string }[] = [
  { value: "TODAY", labelKey: "cc.period.TODAY" },
  { value: "LAST_3_DAYS", labelKey: "cc.period.LAST_3_DAYS" },
  { value: "LAST_7_DAYS", labelKey: "cc.period.LAST_7_DAYS" },
  { value: "MONTH", labelKey: "cc.period.MONTH" },
  { value: "LAST_6_MONTHS", labelKey: "cc.period.LAST_6_MONTHS" },
  { value: "YEAR", labelKey: "cc.period.YEAR" },
  { value: "CUSTOM", labelKey: "cc.period.CUSTOM" },
];

interface Props {
  preset: PeriodPreset;
  comparison: boolean;
  customStart: string;
  customEnd: string;
  customError: string | null;
  onPresetChange: (preset: PeriodPreset) => void;
  onComparisonChange: (on: boolean) => void;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
  locale?: Locale;
}

export function PeriodSelector({
  preset,
  comparison,
  customStart,
  customEnd,
  customError,
  onPresetChange,
  onComparisonChange,
  onCustomStartChange,
  onCustomEndChange,
  locale = "ru",
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={preset}
        onChange={(e) => onPresetChange(e.target.value as PeriodPreset)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        aria-label={t("cc.period", locale)}
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {t(p.labelKey, locale)}
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
            aria-label={t("cc.period.start", locale)}
          />
          <span className="text-slate-400">—</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => onCustomEndChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            aria-label={t("cc.period.end", locale)}
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
        {t("cc.comparison", locale)}
      </label>

      {/* Fixed UTC indicator */}
      <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">UTC</span>
    </div>
  );
}
