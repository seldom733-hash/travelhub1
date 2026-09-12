"use client";

import { useState } from "react";
import { MapPin, CalendarBlank, ArrowRight } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import type { SearchContext } from "@/lib/search-engine";
import LiveSearchInput from "./LiveSearchInput";
import HelpFindButton from "./HelpFindButton";

interface RailwaySearchProps {
  onSearch: (ctx: SearchContext) => void;
}

export default function RailwaySearch({ onSearch }: RailwaySearchProps) {
  const locale = useLocale();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [roundTrip, setRoundTrip] = useState(false);
  const [passengers, setPassengers] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ serviceType: "railway", fromDestination: from, toDestination: to, startDate: date, roundTrip, adults: passengers });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LiveSearchInput id="rail-from" label={t("search.from", locale)} placeholder="Откуда" icon={<MapPin size={14} weight="light" />} onSelect={(r) => setFrom(r.name)} onClear={() => setFrom("")} filterType="destination" />
        <LiveSearchInput id="rail-to" label={t("search.to", locale)} placeholder="Куда" icon={<MapPin size={14} weight="light" />} onSelect={(r) => setTo(r.name)} onClear={() => setTo("")} filterType="destination" />
        <div>
          <label htmlFor="rail-date" className="mb-0.5 block text-[11px] font-medium text-neutral-400">{t("search.date", locale)}</label>
          <div className="relative">
            <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input id="rail-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-dark-border bg-dark-card py-2 pl-9 pr-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50" />
          </div>
        </div>
        <div>
          <label htmlFor="rail-passengers" className="mb-0.5 block text-[11px] font-medium text-neutral-400">{t("search.passengers", locale)}</label>
          <select id="rail-passengers" value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50">
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2 self-start rounded-xl border border-dark-border bg-dark-card px-4 py-2 text-[13px] text-neutral-300 transition-colors hover:border-gold/30 hover:text-white">
        <input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} className="size-3.5 rounded border-dark-border accent-gold" />
        {t("search.round_trip", locale)}
      </label>
      <HelpFindButton context={{ serviceType: "railway", fromDestination: from, toDestination: to, startDate: date, roundTrip, adults: passengers }} />
      <button type="submit" className="btn-gold flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-semibold">
        <span>{t("marketplace.search_submit", locale)}</span>
        <ArrowRight size={16} weight="bold" />
      </button>
    </form>
  );
}
