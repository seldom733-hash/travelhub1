"use client";

import { useState } from "react";
import { CalendarBlank, ArrowRight, Buildings } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import { todayISO } from "@/lib/dates";
import type { SearchContext } from "@/lib/search-engine";
import DestinationPicker from "./DestinationPicker";
import { geoDisplayName, type GeoDirectoryEntry } from "@/lib/geo-api";
import LiveSearchInput from "./LiveSearchInput";
import ChildAges from "./ChildAges";
import HelpFindButton from "./HelpFindButton";
import NightsRange from "./NightsRange";

interface HotelSearchProps {
  onSearch: (ctx: SearchContext) => void;
}

/**
 * Hotels search form. Destination is the Master Geography picker (country →
 * city → resort, same as tours): it feeds the live query's ISO country/city
 * codes, which the capability gate and SupplierGeoLink town resolution need —
 * the legacy free-text city field resolved through geo:hotels availability
 * (catalog-only) and could not reach supplier search at all.
 */
export default function HotelSearch({ onSearch }: HotelSearchProps) {
  const locale = useLocale();
  // Destination as Master Geography entries (most specific wins).
  const [toCountry, setToCountry] = useState<GeoDirectoryEntry | null>(null);
  const [toCity, setToCity] = useState<GeoDirectoryEntry | null>(null);
  const [toResort, setToResort] = useState<GeoDirectoryEntry | null>(null);
  const [hotelId, setHotelId] = useState("");
  const [hotelName, setHotelName] = useState("");
  // Default check-in = today (platform-wide default for date fields).
  const [checkIn, setCheckIn] = useState(todayISO());
  // Night range «от–до» (same contract as the tours search).
  const [nightsFrom, setNightsFrom] = useState(3);
  const [nightsTo, setNightsTo] = useState(3);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);

  const destination = toResort ?? toCity ?? toCountry;
  // Supplier hotel directory scoped to the chosen region.
  const hotelRegion = {
    geoCountry: toCountry?.code,
    geoCity: toCity?.code,
    geoResort: toResort?.code,
  };

  const resetHotel = () => {
    setHotelId("");
    setHotelName("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination) return;
    onSearch({
      serviceType: "hotels",
      // Display name + geo codes (the live query's country/geoCity/geoResort).
      toDestination: geoDisplayName(destination.names, destination.code),
      toGeoCountry: toCountry?.code,
      toGeoCity: toCity?.code,
      toGeoResort: toResort?.code,
      hotelId: hotelId || undefined,
      // Hotel NAME is what the supplier search filters on (per-supplier ids
      // are resolved by the aggregator from this name).
      hotelName: hotelName || undefined,
      startDate: checkIn,
      nights: nightsFrom,
      nightsFrom,
      nightsTo,
      adults,
      children,
      childAges: childAges.slice(0, children),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* Destination — Master Geography picker (country → city → resort) */}
      <DestinationPicker
        id="hotel-to"
        label={t("search.to", locale)}
        placeholder="Куда"
        country={toCountry}
        city={toCity}
        resort={toResort}
        onCountryChange={(entry) => {
          setToCountry(entry);
          resetHotel();
        }}
        onCityChange={(entry) => {
          setToCity(entry);
          resetHotel();
        }}
        onResortChange={(entry) => {
          setToResort(entry);
          resetHotel();
        }}
        onClearAll={() => {
          setToCountry(null);
          setToCity(null);
          setToResort(null);
          resetHotel();
        }}
        required
      />

      {/* Hotel — supplier dictionary directory, scoped to the region */}
      <LiveSearchInput
        id="hotel-name"
        label={t("search.hotel", locale)}
        placeholder={t("search.hotel_placeholder", locale)}
        icon={<Buildings size={14} weight="light" />}
        onSelect={(r) => { setHotelId(r.id); setHotelName(r.name); }}
        onClear={resetHotel}
        value={hotelName}
        filterType="supplierHotels"
        hotelRegion={hotelRegion}
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

        {/* Nights — range «от–до» */}
        <NightsRange
          idPrefix="hotel-nights"
          from={nightsFrom}
          to={nightsTo}
          options={Array.from({ length: 30 }, (_, i) => i + 1)}
          compact
          onChange={(f, t2) => {
            setNightsFrom(f);
            setNightsTo(t2);
          }}
        />

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
          toDestination: destination ? geoDisplayName(destination.names, destination.code) : "",
          toGeoCountry: toCountry?.code,
          toGeoCity: toCity?.code,
          toGeoResort: toResort?.code,
          hotelId: hotelId || undefined,
          hotelName: hotelName || undefined,
          startDate: checkIn,
          nights: nightsFrom,
          nightsFrom,
          nightsTo,
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
