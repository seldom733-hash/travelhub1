"use client";

import { type PeriodPreset } from "@/lib/dashboard-api";
import { t, type Locale } from "@/lib/i18n";
import DateTextInput from "@/components/forms/DateTextInput";

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
        className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
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
          <DateTextInput
            value={customStart}
            onChange={(v) => onCustomStartChange(v)}
            className="rounded-lg border border-line bg-white px-2 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            ariaLabel={t("cc.period.start", locale)}
          />
          <span className="text-ink/60">—</span>
          <DateTextInput
            value={customEnd}
            onChange={(v) => onCustomEndChange(v)}
            className="rounded-lg border border-line bg-white px-2 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            ariaLabel={t("cc.period.end", locale)}
          />
        </div>
      )}

      <label className="flex items-center gap-1.5 text-sm text-ink/60">
        <input
          type="checkbox"
          checked={comparison}
          onChange={(e) => onComparisonChange(e.target.checked)}
          className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
        />
        {t("cc.comparison", locale)}
      </label>

      {/* Fixed UTC indicator */}
      <span className="rounded bg-panel px-2 py-1 text-xs text-ink/60">UTC</span>
    </div>
  );
}