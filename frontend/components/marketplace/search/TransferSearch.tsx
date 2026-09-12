"use client";

import { useState } from "react";
import { MapPin, CalendarBlank, ArrowRight } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import type { SearchContext } from "@/lib/search-engine";
import LiveSearchInput from "./LiveSearchInput";
import HelpFindButton from "./HelpFindButton";

interface TransferSearchProps {
  onSearch: (ctx: SearchContext) => void;
}

export default function TransferSearch({ onSearch }: TransferSearchProps) {
  const locale = useLocale();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00");
  const [passengers, setPassengers] = useState(2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ serviceType: "transfers", fromDestination: from, toDestination: to, startDate: date, adults: passengers });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LiveSearchInput id="trans-from" label={t("search.from", locale)} placeholder="Откуда" icon={<MapPin size={14} weight="light" />} onSelect={(r) => setFrom(r.name)} onClear={() => setFrom("")} filterType="destination" />
        <LiveSearchInput id="trans-to" label={t("search.to", locale)} placeholder="Куда" icon={<MapPin size={14} weight="light" />} onSelect={(r) => setTo(r.name)} onClear={() => setTo("")} filterType="destination" />
        <div>
          <label htmlFor="trans-date" className="mb-0.5 block text-[11px] font-medium text-neutral-400">{t("search.date", locale)}</label>
          <div className="relative">
            <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input id="trans-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-dark-border bg-dark-card py-2 pl-9 pr-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50" />
          </div>
        </div>
        <div>
          <label htmlFor="trans-passengers" className="mb-0.5 block text-[11px] font-medium text-neutral-400">{t("search.passengers", locale)}</label>
          <select id="trans-passengers" value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <HelpFindButton context={{ serviceType: "transfers", fromDestination: from, toDestination: to, startDate: date, adults: passengers }} />
      <button type="submit" className="btn-gold flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-semibold">
        <span>{t("marketplace.search_submit", locale)}</span>
        <ArrowRight size={16} weight="bold" />
      </button>
    </form>
  );
}