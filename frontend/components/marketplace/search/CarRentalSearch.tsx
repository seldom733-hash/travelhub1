"use client";

import { useState } from "react";
import { MapPin, CalendarBlank, ArrowRight } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import type { SearchContext } from "@/lib/search-engine";
import LiveSearchInput from "./LiveSearchInput";
import HelpFindButton from "./HelpFindButton";

interface CarRentalSearchProps {
  onSearch: (ctx: SearchContext) => void;
}

export default function CarRentalSearch({ onSearch }: CarRentalSearchProps) {
  const locale = useLocale();
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [driverAge, setDriverAge] = useState(25);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ serviceType: "car-rental", fromDestination: pickup, toDestination: dropoff, startDate: pickupDate, returnDate, adults: 1 });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LiveSearchInput id="car-pickup" label={t("search.pickup", locale)} placeholder="Место получения" icon={<MapPin size={14} weight="light" />} onSelect={(r) => setPickup(r.name)} onClear={() => setPickup("")} filterType="destination" />
        <LiveSearchInput id="car-dropoff" label={t("search.dropoff", locale)} placeholder="Место возврата" icon={<MapPin size={14} weight="light" />} onSelect={(r) => setDropoff(r.name)} onClear={() => setDropoff("")} filterType="destination" />
        <div>
          <label htmlFor="car-pickup-date" className="mb-0.5 block text-[11px] font-medium text-neutral-400">{t("search.check_in", locale)}</label>
          <div className="relative">
            <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input id="car-pickup-date" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="w-full rounded-xl border border-dark-border bg-dark-card py-2 pl-9 pr-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50" />
          </div>
        </div>
        <div>
          <label htmlFor="car-return-date" className="mb-0.5 block text-[11px] font-medium text-neutral-400">{t("search.check_out", locale)}</label>
          <div className="relative">
            <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input id="car-return-date" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} min={pickupDate || undefined} className="w-full rounded-xl border border-dark-border bg-dark-card py-2 pl-9 pr-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50" />
          </div>
        </div>
      </div>
      <div className="sm:w-48">
        <label htmlFor="car-driver-age" className="mb-0.5 block text-[11px] font-medium text-neutral-400">{t("search.driver_age", locale)}</label>
        <select id="car-driver-age" value={driverAge} onChange={(e) => setDriverAge(Number(e.target.value))} className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50">
          {Array.from({ length: 15 }, (_, i) => i + 18).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <HelpFindButton context={{ serviceType: "car-rental", fromDestination: pickup, toDestination: dropoff, startDate: pickupDate, returnDate }} />
      <button type="submit" className="btn-gold flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-semibold">
        <span>{t("marketplace.search_submit", locale)}</span>
        <ArrowRight size={16} weight="bold" />
      </button>
    </form>
  );
}