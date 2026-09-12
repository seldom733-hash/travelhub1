"use client";

import { useState } from "react";
import { MapPin, CalendarBlank, ArrowRight, Buildings } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import type { SearchContext } from "@/lib/search-engine";
import LiveSearchInput from "./LiveSearchInput";
import ChildAges from "./ChildAges";
import HelpFindButton from "./HelpFindButton";

interface TourSearchProps {
  onSearch: (ctx: SearchContext) => void;
}

export default function TourSearch({ onSearch }: TourSearchProps) {
  const locale = useLocale();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [startDate, setStartDate] = useState("");
  const [nights, setNights] = useState(7);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);
  const [selectHotel, setSelectHotel] = useState(false);
  const [hotelId, setHotelId] = useState<string>("");
  const [hotelName, setHotelName] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      serviceType: "tours",
      fromDestination: from,
      toDestination: to,
      startDate,
      nights,
      adults,
      children,
      childAges: childAges.slice(0, children),
      hotelId: hotelId || undefined,
      hotelName: hotelName || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* From */}
        <LiveSearchInput
          id="tour-from"
          label={t("search.from", locale)}
          placeholder="Откуда"
          icon={<MapPin size={14} weight="light" />}
          onSelect={(r) => setFrom(r.name)}
          onClear={() => setFrom("")}
          filterType="destination"
        />

        {/* To */}
        <LiveSearchInput
          id="tour-to"
          label={t("search.to", locale)}
          placeholder="Куда"
          icon={<MapPin size={14} weight="light" />}
          onSelect={(r) => setTo(r.name)}
          onClear={() => setTo("")}
          filterType="destination"
        />

        {/* Start date */}
        <div>
          <label htmlFor="tour-date" className="mb-0.5 block text-[11px] font-medium text-neutral-400">
            {t("search.date", locale)}
          </label>
          <div className="relative">
            <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              id="tour-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-dark-border bg-dark-card py-2 pl-9 pr-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50"
            />
          </div>
        </div>

        {/* Nights */}
        <div>
          <label htmlFor="tour-nights" className="mb-0.5 block text-[11px] font-medium text-neutral-400">
            {t("search.nights", locale)}
          </label>
          <select
            id="tour-nights"
            value={nights}
            onChange={(e) => setNights(Number(e.target.value))}
            className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50"
          >
            {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Adults */}
        <div>
          <label htmlFor="tour-adults" className="mb-0.5 block text-[11px] font-medium text-neutral-400">
            {t("search.adults", locale)}
          </label>
          <select
            id="tour-adults"
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Children */}
        <div>
          <label htmlFor="tour-children" className="mb-0.5 block text-[11px] font-medium text-neutral-400">
            {t("search.children", locale)}
          </label>
          <select
            id="tour-children"
            value={children}
            onChange={(e) => {
              const val = Number(e.target.value);
              setChildren(val);
              setChildAges(Array(val).fill(0));
            }}
            className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50"
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Select hotel checkbox */}
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dark-border bg-dark-card px-4 py-2 text-[13px] text-neutral-300 transition-colors hover:border-gold/30 hover:text-white">
            <input
              type="checkbox"
              checked={selectHotel}
              onChange={(e) => {
                setSelectHotel(e.target.checked);
                if (!e.target.checked) {
                  setHotelId("");
                  setHotelName("");
                }
              }}
              className="size-3.5 rounded border-dark-border accent-gold"
            />
            <Buildings size={14} weight="light" className="text-gold" />
            {t("search.select_hotel", locale)}
          </label>
        </div>
      </div>

      {/* Child ages */}
      {children > 0 && (
        <ChildAges count={children} ages={childAges} onChange={setChildAges} />
      )}

      {/* Hotel live-search (conditional) */}
      {selectHotel && (
        <LiveSearchInput
          id="tour-hotel"
          label={t("search.hotel", locale)}
          placeholder={t("search.hotel_placeholder", locale)}
          icon={<Buildings size={14} weight="light" />}
          onSelect={(r) => { setHotelId(r.id); setHotelName(r.name); }}
          onClear={() => { setHotelId(""); setHotelName(""); }}
          value={hotelName}
          filterType="hotel"
        />
      )}

      {/* Help Find */}
      <HelpFindButton
        context={{
          serviceType: "tours",
          fromDestination: from,
          toDestination: to,
          startDate,
          nights,
          adults,
          children,
          childAges: childAges.slice(0, children),
          hotelId: hotelId || undefined,
        }}
      />

      {/* Submit */}
      <button
        type="submit"
        className="btn-gold flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-[13px] font-semibold"
      >
        <span>{t("marketplace.search_submit", locale)}</span>
        <ArrowRight size={16} weight="bold" />
      </button>
    </form>
  );
}
