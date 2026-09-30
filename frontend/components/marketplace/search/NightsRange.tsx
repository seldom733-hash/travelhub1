"use client";

import { useMemo } from "react";
import { t, useLocale } from "@/lib/i18n";
import { widestText } from "@/lib/measure-text";

interface NightsRangeProps {
  /** id prefix — "tour-nights" / "hotel-nights" → -from / -to selects. */
  idPrefix: string;
  from: number;
  to: number;
  /** Selectable night values (supplier capability bounds). */
  options: number[];
  onChange: (from: number, to: number) => void;
  /** HotelSearch renders 11/13px, TourSearch 13/15px. */
  compact?: boolean;
}

/**
 * «Ночей от — до»: two selects that keep the invariant from ≤ to by fixing
 * the side the user just moved past the other bound.
 */
export default function NightsRange({ idPrefix, from, to, options, onChange, compact = false }: NightsRangeProps) {
  const locale = useLocale();
  const labelClass = `mb-0.5 block font-medium text-neutral-400 ${compact ? "text-[11px]" : "text-[13px]"}`;
  const selectClass = `w-full rounded-xl border border-dark-border bg-dark-card py-2 pl-9 pr-3 text-white outline-none transition-colors focus:border-gold/50 ${
    compact ? "text-[13px]" : "text-[15px]"
  }`;

  const handleFrom = (value: number) => onChange(value, value > to ? value : to);
  const handleTo = (value: number) => onChange(value < from ? value : from, value);

  // Content-width: each select fits its longest possible value (2-digit
  // nights) plus the «от/до» prefix rendered inside the control + paddings.
  const maxDigitPx = useMemo(() => {
    const digits = widestText(options.map(String), compact ? 13 : 15);
    const prefixes = widestText(
      [t("search.nights_from", locale), t("search.nights_to", locale)],
      compact ? 13 : 15,
    );
    // + left padding for prefix, + right padding, + native select caret /
    // spinner breathing room (the caret overlaps the value if too tight).
    const w = digits + prefixes + (compact ? 52 : 62);
    return w > 0 ? w : 0;
  }, [options, compact, locale]);

  const renderSelect = (kind: "from" | "to") => {
    const value = kind === "from" ? from : to;
    const prefix = kind === "from" ? t("search.nights_from", locale) : t("search.nights_to", locale);
    return (
      <div className="relative" style={{ maxWidth: maxDigitPx > 0 ? maxDigitPx : undefined, flex: "1 1 0" }}>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
          {prefix}
        </span>
        <select
          id={`${idPrefix}-${kind}`}
          value={value}
          aria-label={`${t("search.nights", locale)} ${prefix}`}
          onChange={(e) => (kind === "from" ? handleFrom(Number(e.target.value)) : handleTo(Number(e.target.value)))}
          className={selectClass}
        >
          {options.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div>
      <label htmlFor={`${idPrefix}-from`} className={labelClass}>
        {t("search.nights", locale)}
      </label>
      <div className="flex items-center gap-1.5">
        {renderSelect("from")}
        <span className="shrink-0 text-neutral-500">—</span>
        {renderSelect("to")}
      </div>
    </div>
  );
}
