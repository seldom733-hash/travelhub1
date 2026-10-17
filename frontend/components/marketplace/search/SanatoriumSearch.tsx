"use client";

import { useState } from "react";
import { MapPin, CalendarBlank, ArrowRight, Sun } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import { todayISO } from "@/lib/dates";
import { useWidestText } from "@/lib/measure-text";
import type { SearchContext } from "@/lib/search-engine";
import LiveSearchInput from "./LiveSearchInput";
import ChildAges from "./ChildAges";
import HelpFindButton from "./HelpFindButton";
import {
  PICKER_CONTROL,
  PICKER_CONTROL_ICON,
  PICKER_DATE_WIDTH_EXTRA,
  PICKER_DIGIT_WIDTH_EXTRA,
  PICKER_LABEL,
  PICKER_ROW,
  PICKER_SUBMIT,
  PICKER_W_TO,
} from "./picker-styles";

interface SanatoriumSearchProps {
  onSearch: (ctx: SearchContext) => void;
}

export default function SanatoriumSearch({ onSearch }: SanatoriumSearchProps) {
  const locale = useLocale();
  const [destination, setDestination] = useState("");
  // Default start date = today (platform-wide default for date fields).
  const [startDate, setStartDate] = useState(todayISO());
  const [duration, setDuration] = useState(7);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);
  const durationOptions = [3, 5, 7, 10, 14, 21];
  // Content-width: те же размеры, что в поиске туров.
  const datePx = useWidestText(["00.00.0000"]);
  const digitPx = useWidestText(["0"]);
  const durationPx = useWidestText(durationOptions.map((n) => `${n} ${t("search.days", locale)}`));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      serviceType: "sanatoriums",
      toDestination: destination,
      startDate,
      duration,
      nights: duration,
      adults,
      children,
      childAges: childAges.slice(0, children),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className={PICKER_ROW}>
        {/* Destination */}
        <div className={PICKER_W_TO}>
          <LiveSearchInput
            id="sanat-destination"
            label={t("search.destination", locale)}
            placeholder={t("search.destination", locale)}
            icon={<MapPin size={14} weight="light" />}
            onSelect={(r) => setDestination(r.name)}
            onClear={() => setDestination("")}
            filterType="destination"
          />
        </div>

        {/* Start date */}
        <div style={{ minWidth: datePx + PICKER_DATE_WIDTH_EXTRA, maxWidth: datePx + PICKER_DATE_WIDTH_EXTRA }}>
          <label htmlFor="sanat-date" className={PICKER_LABEL}>
            {t("search.check_in", locale)}
          </label>
          <div className="relative">
            <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              id="sanat-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={PICKER_CONTROL_ICON}
            />
          </div>
        </div>

        {/* Duration */}
        <div style={{ maxWidth: durationPx + PICKER_DIGIT_WIDTH_EXTRA }}>
          <label htmlFor="sanat-duration" className={PICKER_LABEL}>
            {t("search.duration", locale)}
          </label>
          <select
            id="sanat-duration"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className={PICKER_CONTROL}
          >
            {durationOptions.map((n) => (
              <option key={n} value={n}>{n} {t("search.days", locale)}</option>
            ))}
          </select>
        </div>

        {/* Adults */}
        <div style={{ maxWidth: digitPx + PICKER_DIGIT_WIDTH_EXTRA }}>
          <label htmlFor="sanat-adults" className={PICKER_LABEL}>
            {t("search.adults", locale)}
          </label>
          <select
            id="sanat-adults"
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className={PICKER_CONTROL}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Children */}
        <div style={{ maxWidth: digitPx + PICKER_DIGIT_WIDTH_EXTRA }}>
          <label htmlFor="sanat-children" className={PICKER_LABEL}>
            {t("search.children", locale)}
          </label>
          <select
            id="sanat-children"
            value={children}
            onChange={(e) => {
              const val = Number(e.target.value);
              setChildren(val);
              setChildAges(Array(val).fill(0));
            }}
            className={PICKER_CONTROL}
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Child ages */}
      {children > 0 && (
        <ChildAges count={children} ages={childAges} onChange={setChildAges} />
      )}

      {/* Help Find */}
      <HelpFindButton
        context={{
          serviceType: "sanatoriums",
          toDestination: destination,
          startDate,
          duration,
          nights: duration,
          adults,
          children,
          childAges: childAges.slice(0, children),
        }}
      />

      {/* Submit */}
      <button
        type="submit"
        className={`btn-gold ${PICKER_SUBMIT}`}
      >
        <span>{t("marketplace.search_submit", locale)}</span>
        <ArrowRight size={16} weight="bold" />
      </button>
    </form>
  );
}
