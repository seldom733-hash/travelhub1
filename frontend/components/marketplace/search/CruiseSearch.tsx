"use client";

import { useState } from "react";
import { MapPin, CalendarBlank, ArrowRight } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import type { SearchContext } from "@/lib/search-engine";
import LiveSearchInput from "./LiveSearchInput";
import ChildAges from "./ChildAges";
import HelpFindButton from "./HelpFindButton";

interface CruiseSearchProps {
  onSearch: (ctx: SearchContext) => void;
}

export default function CruiseSearch({ onSearch }: CruiseSearchProps) {
  const locale = useLocale();
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState(7);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ serviceType: "cruises", toDestination: destination, startDate: date, duration, nights: duration, adults, children, childAges: childAges.slice(0, children) });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LiveSearchInput id="cruise-dest" label={t("search.destination", locale)} placeholder="Направление" icon={<MapPin size={14} weight="light" />} onSelect={(r) => setDestination(r.name)} onClear={() => setDestination("")} filterType="destination" />
        <div>
          <label htmlFor="cruise-date" className="mb-0.5 block text-[11px] font-medium text-neutral-400">{t("search.date", locale)}</label>
          <div className="relative">
            <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input id="cruise-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-dark-border bg-dark-card py-2 pl-9 pr-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50" />
          </div>
        </div>
        <div>
          <label htmlFor="cruise-duration" className="mb-0.5 block text-[11px] font-medium text-neutral-400">{t("search.duration", locale)}</label>
          <select id="cruise-duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50">
            {[3, 5, 7, 10, 14, 21].map((n) => <option key={n} value={n}>{n} {t("search.days", locale)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cruise-adults" className="mb-0.5 block text-[11px] font-medium text-neutral-400">{t("search.adults", locale)}</label>
          <select id="cruise-adults" value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50">
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div className="sm:w-48">
        <label htmlFor="cruise-children" className="mb-0.5 block text-[11px] font-medium text-neutral-400">{t("search.children", locale)}</label>
        <select id="cruise-children" value={children} onChange={(e) => { const v = Number(e.target.value); setChildren(v); setChildAges(Array(v).fill(0)); }} className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50">
          {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      {children > 0 && <ChildAges count={children} ages={childAges} onChange={setChildAges} />}
      <HelpFindButton context={{ serviceType: "cruises", toDestination: destination, startDate: date, duration, nights: duration, adults, children, childAges: childAges.slice(0, children) }} />
      <button type="submit" className="btn-gold flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-semibold">
        <span>{t("marketplace.search_submit", locale)}</span>
        <ArrowRight size={16} weight="bold" />
      </button>
    </form>
  );
}
