"use client";

import { useState } from "react";
import { MapPin, CalendarBlank, ArrowRight, Buildings } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import type { SearchContext } from "@/lib/search-engine";
import LiveSearchInput from "./LiveSearchInput";
import ChildAges from "./ChildAges";
import HelpFindButton from "./HelpFindButton";

interface HotelSearchProps {
  onSearch: (ctx: SearchContext) => void;
}

export default function HotelSearch({ onSearch }: HotelSearchProps) {
  const locale = useLocale();
  const [cityId, setCityId] = useState("");
  const [cityName, setCityName] = useState("");
  const [hotelId, setHotelId] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [nights, setNights] = useState(3);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      serviceType: "hotels",
      cityId,
      cityName,
      hotelId: hotelId || undefined,
      hotelName: hotelName || undefined,
      startDate: checkIn,
      nights,
      adults,
      children,
      childAges: childAges.slice(0, children),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* City — SEPARATE field */}
      <LiveSearchInput
        id="hotel-city"
        label={t("search.city", locale)}
        placeholder="Город или направление"
        icon={<MapPin size={14} weight="light" />}
        onSelect={(r) => {
          setCityId(r.id);
          setCityName(r.name);
          // Reset hotel when city changes
          setHotelId("");
          setHotelName("");
        }}
        onClear={() => {
          setCityId("");
          setCityName("");
          setHotelId("");
          setHotelName("");
        }}
        filterType="destination"
      />

      {/* Hotel — SEPARATE field, filtered by city */}
      <LiveSearchInput
        id="hotel-name"
        label={t("search.hotel", locale)}
        placeholder={t("search.hotel_placeholder", locale)}
        icon={<Buildings size={14} weight="light" />}
        onSelect={(r) => { setHotelId(r.id); setHotelName(r.name); }}
        onClear={() => { setHotelId(""); setHotelName(""); }}
        value={hotelName}
        filterType="hotel"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Check-in */}
        <div>
          <label htmlFor="hotel-checkin" className="mb-0.5 block text-[11px] font-medium text-neutral-400">
            {t("search.check_in", locale)}
          </label>
          <div className="relative">
            <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              id="hotel-checkin"
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full rounded-xl border border-dark-border bg-dark-card py-2 pl-9 pr-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50"
            />
          </div>
        </div>

        {/* Nights */}
        <div>
          <label htmlFor="hotel-nights" className="mb-0.5 block text-[11px] font-medium text-neutral-400">
            {t("search.nights", locale)}
          </label>
          <select
            id="hotel-nights"
            value={nights}
            onChange={(e) => setNights(Number(e.target.value))}
            className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[13px] text-white outline-none transition-colors focus:border-gold/50"
          >
            {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Adults */}
        <div>
          <label htmlFor="hotel-adults" className="mb-0.5 block text-[11px] font-medium text-neutral-400">
            {t("search.adults", locale)}
          </label>
          <select
            id="hotel-adults"
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
          <label htmlFor="hotel-children" className="mb-0.5 block text-[11px] font-medium text-neutral-400">
            {t("search.children", locale)}
          </label>
          <select
            id="hotel-children"
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
      </div>

      {/* Child ages */}
      {children > 0 && (
        <ChildAges count={children} ages={childAges} onChange={setChildAges} />
      )}

      {/* Help Find */}
      <HelpFindButton
        context={{
          serviceType: "hotels",
          cityId,
          cityName,
          hotelId: hotelId || undefined,
          hotelName: hotelName || undefined,
          startDate: checkIn,
          nights,
          adults,
          children,
          childAges: childAges.slice(0, children),
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
