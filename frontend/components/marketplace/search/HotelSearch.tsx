"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarBlank, ArrowRight, Buildings } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import { todayISO } from "@/lib/dates";
import type { SearchContext } from "@/lib/search-engine";
import DestinationPicker from "./DestinationPicker";
import {
  fetchGeoDirectory,
  geoDisplayName,
  type GeoDirectoryEntry,
} from "@/lib/geo-api";
import LiveSearchInput from "./LiveSearchInput";
import ChildAges from "./ChildAges";
import HelpFindButton from "./HelpFindButton";
import NightsRange from "./NightsRange";
import {
  clearHotelDraft,
  readHotelDraft,
  writeHotelDraft,
} from "./hotel-search-store";

interface HotelSearchProps {
  onSearch: (ctx: SearchContext) => void;
  /** «Сбросить все» (HeroSearch toolbar): every change resets all pickers. */
  resetSignal?: number;
}

/**
 * Hotels search form. Destination is the Master Geography picker (country →
 * city → resort, same as tours): it feeds the live query's ISO country/city
 * codes, which the capability gate and SupplierGeoLink town resolution need —
 * the legacy free-text city field resolved through geo:hotels availability
 * (catalog-only) and could not reach supplier search at all.
 */
export default function HotelSearch({ onSearch, resetSignal = 0 }: HotelSearchProps) {
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

  // ── Draft: restore the pickers of the previous search ──────────────────
  // Same contract as TourSearch: the form unmounts between the home page
  // and the results page; the draft (module memory + sessionStorage) brings
  // every picker back on return. Applied AFTER mount so SSR renders plain
  // defaults (no hydration mismatch); `hydrated` gates the persist effect
  // so the initial default values cannot clobber the stored draft.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const draft = readHotelDraft();
    if (draft) {
      setToCountry(draft.toCountry);
      setToCity(draft.toCity);
      setToResort(draft.toResort);
      setHotelId(draft.hotelId);
      setHotelName(draft.hotelName);
      setCheckIn(draft.checkIn);
      setNightsFrom(draft.nightsFrom);
      setNightsTo(draft.nightsTo);
      setAdults(draft.adults);
      setChildren(draft.children);
      setChildAges(draft.childAges);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeHotelDraft({
      toCountry,
      toCity,
      toResort,
      hotelId,
      hotelName,
      checkIn,
      nightsFrom,
      nightsTo,
      adults,
      children,
      childAges,
    });
  }, [
    hydrated,
    toCountry,
    toCity,
    toResort,
    hotelId,
    hotelName,
    checkIn,
    nightsFrom,
    nightsTo,
    adults,
    children,
    childAges,
  ]);

  /** «Сбросить все»: back to a fresh form (empty pickers, default date). */
  const resetAll = useCallback(() => {
    setToCountry(null);
    setToCity(null);
    setToResort(null);
    setHotelId("");
    setHotelName("");
    setCheckIn(todayISO());
    setNightsFrom(3);
    setNightsTo(3);
    setAdults(2);
    setChildren(0);
    setChildAges([]);
    clearHotelDraft();
  }, []);

  useEffect(() => {
    if (resetSignal > 0) resetAll();
  }, [resetSignal, resetAll]);

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

  // Destination cascade: country → city → resort (same contract as
  // TourSearch): a different country invalidates the city/resort of the
  // previous one, a different city invalidates its resort. Direct picks
  // resolve their parents upward so the chain is always linked.
  const handleCountryChange = (entry: GeoDirectoryEntry | null) => {
    setToCountry(entry);
    setToCity(null);
    setToResort(null);
    resetHotel();
  };

  const handleCityChange = (entry: GeoDirectoryEntry | null) => {
    setToCity(entry);
    setToResort(null);
    resetHotel();
    if (entry && !toCountry && entry.countryId) {
      fetchGeoDirectory("country")
        .then((countries) => {
          const parent = countries.find((c) => c.id === entry.countryId);
          if (parent) setToCountry(parent);
        })
        .catch(() => {});
    }
  };

  const handleResortChange = (entry: GeoDirectoryEntry | null) => {
    setToResort(entry);
    resetHotel();
    if (entry && !toCity && entry.cityId) {
      fetchGeoDirectory("city")
        .then((cities) => {
          const parentCity = cities.find((c) => c.id === entry.cityId);
          if (!parentCity) return;
          setToCity(parentCity);
          if (!toCountry && parentCity.countryId) {
            fetchGeoDirectory("country")
              .then((countries) => {
                const parentCountry = countries.find(
                  (c) => c.id === parentCity.countryId,
                );
                if (parentCountry) setToCountry(parentCountry);
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }
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
        onCountryChange={handleCountryChange}
        onCityChange={handleCityChange}
        onResortChange={handleResortChange}
        onClearAll={() => {
          handleCountryChange(null);
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
