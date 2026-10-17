"use client";

import { useState } from "react";
import { MapPin, CalendarBlank, ArrowRight } from "@phosphor-icons/react";
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

interface GuideSearchProps {
  onSearch: (ctx: SearchContext) => void;
}

export default function GuideSearch({ onSearch }: GuideSearchProps) {
  const locale = useLocale();
  const [destination, setDestination] = useState("");
  // Default date = today (platform-wide default for date fields).
  const [date, setDate] = useState(todayISO());
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);
  const [language, setLanguage] = useState("ru");
  // Content-width: те же размеры, что в поиске туров.
  const datePx = useWidestText(["00.00.0000"]);
  const digitPx = useWidestText(["0"]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ serviceType: "guides", toDestination: destination, startDate: date, adults, children, childAges: childAges.slice(0, children) });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className={PICKER_ROW}>
        <div className={PICKER_W_TO}>
          <LiveSearchInput id="guide-dest" label={t("search.destination", locale)} placeholder={t("search.city", locale)} icon={<MapPin size={14} weight="light" />} onSelect={(r) => setDestination(r.name)} onClear={() => setDestination("")} filterType="destination" />
        </div>
        <div style={{ minWidth: datePx + PICKER_DATE_WIDTH_EXTRA, maxWidth: datePx + PICKER_DATE_WIDTH_EXTRA }}>
          <label htmlFor="guide-date" className={PICKER_LABEL}>{t("search.date", locale)}</label>
          <div className="relative">
            <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input id="guide-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={PICKER_CONTROL_ICON} />
          </div>
        </div>
        <div style={{ maxWidth: digitPx + PICKER_DIGIT_WIDTH_EXTRA }}>
          <label htmlFor="guide-adults" className={PICKER_LABEL}>{t("search.adults", locale)}</label>
          <select id="guide-adults" value={adults} onChange={(e) => setAdults(Number(e.target.value))} className={PICKER_CONTROL}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div style={{ maxWidth: digitPx + PICKER_DIGIT_WIDTH_EXTRA }}>
          <label htmlFor="guide-children" className={PICKER_LABEL}>{t("search.children", locale)}</label>
          <select id="guide-children" value={children} onChange={(e) => { const v = Number(e.target.value); setChildren(v); setChildAges(Array(v).fill(0)); }} className={PICKER_CONTROL}>
            {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="guide-lang" className={PICKER_LABEL}>{t("search.language", locale)}</label>
        <select id="guide-lang" value={language} onChange={(e) => setLanguage(e.target.value)} className={`${PICKER_CONTROL} sm:w-auto`}>
          <option value="ru">Русский</option>
          <option value="en">English</option>
          <option value="az">Azərbaycan</option>
          <option value="tr">Türkçe</option>
        </select>
      </div>
      {children > 0 && <ChildAges count={children} ages={childAges} onChange={setChildAges} />}
      <HelpFindButton context={{ serviceType: "guides", toDestination: destination, startDate: date, adults, children, childAges: childAges.slice(0, children) }} />
      <button type="submit" className={`btn-gold ${PICKER_SUBMIT}`}>
        <span>{t("marketplace.search_submit", locale)}</span>
        <ArrowRight size={16} weight="bold" />
      </button>
    </form>
  );
}