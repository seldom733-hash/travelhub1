"use client";

import { useState } from "react";
import { MapPin, CalendarBlank, ArrowRight } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import { todayISO } from "@/lib/dates";
import { useWidestText } from "@/lib/measure-text";
import type { SearchContext } from "@/lib/search-engine";
import LiveSearchInput from "./LiveSearchInput";
import HelpFindButton from "./HelpFindButton";
import {
  PICKER_CHECKBOX,
  PICKER_CONTROL,
  PICKER_CONTROL_ICON,
  PICKER_DATE_WIDTH_EXTRA,
  PICKER_DIGIT_WIDTH_EXTRA,
  PICKER_LABEL,
  PICKER_ROW,
  PICKER_SUBMIT,
  PICKER_W_FROM,
  PICKER_W_TO,
} from "./picker-styles";

interface RailwaySearchProps {
  onSearch: (ctx: SearchContext) => void;
}

export default function RailwaySearch({ onSearch }: RailwaySearchProps) {
  const locale = useLocale();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // Default date = today (platform-wide default for date fields).
  const [date, setDate] = useState(todayISO());
  const [roundTrip, setRoundTrip] = useState(false);
  const [passengers, setPassengers] = useState(1);
  // Content-width: те же размеры, что в поиске туров.
  const datePx = useWidestText(["00.00.0000"]);
  const digitPx = useWidestText(["0"]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ serviceType: "railway", fromDestination: from, toDestination: to, startDate: date, roundTrip, adults: passengers });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className={PICKER_ROW}>
        <div className={PICKER_W_FROM}>
          <LiveSearchInput id="rail-from" label={t("search.from", locale)} placeholder={t("search.from", locale)} icon={<MapPin size={14} weight="light" />} onSelect={(r) => setFrom(r.name)} onClear={() => setFrom("")} filterType="destination" />
        </div>
        <div className={PICKER_W_TO}>
          <LiveSearchInput id="rail-to" label={t("search.to", locale)} placeholder={t("search.to", locale)} icon={<MapPin size={14} weight="light" />} onSelect={(r) => setTo(r.name)} onClear={() => setTo("")} filterType="destination" />
        </div>
        <div style={{ minWidth: datePx + PICKER_DATE_WIDTH_EXTRA, maxWidth: datePx + PICKER_DATE_WIDTH_EXTRA }}>
          <label htmlFor="rail-date" className={PICKER_LABEL}>{t("search.date", locale)}</label>
          <div className="relative">
            <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input id="rail-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={PICKER_CONTROL_ICON} />
          </div>
        </div>
        <div style={{ maxWidth: digitPx + PICKER_DIGIT_WIDTH_EXTRA }}>
          <label htmlFor="rail-passengers" className={PICKER_LABEL}>{t("search.passengers", locale)}</label>
          <select id="rail-passengers" value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className={PICKER_CONTROL}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <label className={`self-start ${PICKER_CHECKBOX}`}>
        <input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} className="size-3.5 rounded border-dark-border accent-gold" />
        {t("search.round_trip", locale)}
      </label>
      <HelpFindButton context={{ serviceType: "railway", fromDestination: from, toDestination: to, startDate: date, roundTrip, adults: passengers }} />
      <button type="submit" className={`btn-gold ${PICKER_SUBMIT}`}>
        <span>{t("marketplace.search_submit", locale)}</span>
        <ArrowRight size={16} weight="bold" />
      </button>
    </form>
  );
}
