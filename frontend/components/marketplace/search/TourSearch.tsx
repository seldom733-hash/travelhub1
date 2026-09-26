"use client";

import { useEffect, useState } from "react";
import { CalendarBlank, ArrowRight, Buildings } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import type { SearchContext } from "@/lib/search-engine";
import LiveSearchInput from "./LiveSearchInput";
import DirectorySelect from "./DirectorySelect";
import DestinationPicker from "./DestinationPicker";
import {
  fetchGeoDirectory,
  geoDisplayName,
  type GeoDirectoryEntry,
} from "@/lib/geo-api";
import ChildAges from "./ChildAges";
import HelpFindButton from "./HelpFindButton";

interface TourSearchProps {
  onSearch: (ctx: SearchContext) => void;
}

export default function TourSearch({ onSearch }: TourSearchProps) {
  const locale = useLocale();
  const [from, setFrom] = useState<GeoDirectoryEntry | null>(null);
  const [toCountry, setToCountry] = useState<GeoDirectoryEntry | null>(null);
  const [toCity, setToCity] = useState<GeoDirectoryEntry | null>(null);
  const [toResort, setToResort] = useState<GeoDirectoryEntry | null>(null);
  const [startDate, setStartDate] = useState("");
  const [nights, setNights] = useState(7);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);
  const [selectHotel, setSelectHotel] = useState(false);
  const [hotelId, setHotelId] = useState<string>("");
  const [hotelName, setHotelName] = useState<string>("");

  // Azerbaijan cities for From; all directory countries for To.
  // Loaded lazily by the selects themselves; preselect Baku as origin.
  useEffect(() => {
    let alive = true;
    fetchGeoDirectory("country")
      .then((countries) => {
        if (!alive) return;
        const az = countries.find((c) => c.code === "AZ");
        if (!az) return;
        fetchGeoDirectory("city", az.id)
          .then((cities) => {
            if (!alive) return;
            const baku =
              cities.find((c) => c.code === "BAKU") ?? cities[0] ?? null;
            if (baku) setFrom((prev) => prev ?? baku);
          })
          .catch(() => {});
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Destination cascade: country → city → resort. Each level lists only
  // children of the selected parent, but a city/resort can also be picked
  // directly (full lists). Direct picks resolve their parents upward, so
  // the whole chain (resort → city → country) is always linked.
  // The most specific selection wins on submit.
  const handleCountryChange = (entry: GeoDirectoryEntry | null) => {
    setToCountry(entry);
    setToCity(null);
    setToResort(null);
  };

  const handleCityChange = (entry: GeoDirectoryEntry | null) => {
    setToCity(entry);
    setToResort(null);
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

  const destination = toResort ?? toCity ?? toCountry;

  // «Найти» активна, только когда выбрано направление (хотя бы один из
  // трёх списков в «Куда») и указана дата.
  const canSubmit = Boolean(destination && startDate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dest = toResort ?? toCity ?? toCountry;
    if (!dest || !startDate) return;
    onSearch({
      serviceType: "tours",
      fromDestination: from ? geoDisplayName(from.names, from.code) : "",
      toDestination: geoDisplayName(dest.names, dest.code),
      // Most specific geo code wins; catalog filters by it, supplier
      // (KOMPAS) is used only for country-level selection.
      toGeoCountry: toCountry?.code,
      toGeoCity: toCity?.code,
      toGeoResort: toResort?.code,
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
        {/* From — Azerbaijan cities from the directory */}
        <DirectorySelect
          id="tour-from"
          label={t("search.from", locale)}
          placeholder="Откуда"
          value={from}
          onChange={setFrom}
          loadItems={async () => {
            const countries = await fetchGeoDirectory("country");
            const az = countries.find((c) => c.code === "AZ");
            if (!az) return [];
            return fetchGeoDirectory("city", az.id);
          }}
        />

        {/* To: single dropdown with nested Country → City → Resort
            lists, each with its own live search. */}
        <DestinationPicker
          id="tour-to"
          label={t("search.to", locale)}
          placeholder="Куда"
          country={toCountry}
          city={toCity}
          resort={toResort}
          onCountryChange={handleCountryChange}
          onCityChange={handleCityChange}
          onResortChange={handleResortChange}
          onClearAll={() => {
            setToCountry(null);
            setToCity(null);
            setToResort(null);
          }}
          required
        />

        {/* Start date */}

        {/* Start date */}
        <div>
          <label htmlFor="tour-date" className="mb-0.5 block text-[13px] font-medium text-neutral-400">
            {t("search.date", locale)}
          </label>
          <div className="relative">
            <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              id="tour-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-dark-border bg-dark-card py-2 pl-9 pr-3 text-[15px] text-white outline-none transition-colors focus:border-gold/50"
            />
          </div>
        </div>

        {/* Nights */}
        <div>
          <label htmlFor="tour-nights" className="mb-0.5 block text-[13px] font-medium text-neutral-400">
            {t("search.nights", locale)}
          </label>
          <select
            id="tour-nights"
            value={nights}
            onChange={(e) => setNights(Number(e.target.value))}
            className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[15px] text-white outline-none transition-colors focus:border-gold/50"
          >
            {Array.from({ length: 12 }, (_, i) => i + 3).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Adults */}
        <div>
          <label htmlFor="tour-adults" className="mb-0.5 block text-[13px] font-medium text-neutral-400">
            {t("search.adults", locale)}
          </label>
          <select
            id="tour-adults"
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[15px] text-white outline-none transition-colors focus:border-gold/50"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Children */}
        <div>
          <label htmlFor="tour-children" className="mb-0.5 block text-[13px] font-medium text-neutral-400">
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
            className="w-full rounded-xl border border-dark-border bg-dark-card py-2 px-3 text-[15px] text-white outline-none transition-colors focus:border-gold/50"
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Select hotel checkbox */}
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dark-border bg-dark-card px-4 py-2 text-[15px] text-neutral-300 transition-colors hover:border-gold/30 hover:text-white">
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
          fromDestination: from ? geoDisplayName(from.names, from.code) : "",
          toDestination: destination ? geoDisplayName(destination.names, destination.code) : "",
          startDate,
          nights,
          adults,
          children,
          childAges: childAges.slice(0, children),
          hotelId: hotelId || undefined,
        }}
      />

      {/* Submit — destination is required so the results URL always
          carries the direction (no more direction-less transitions) */}
      <button
        type="submit"
        disabled={!canSubmit}
        title={!canSubmit ? (!destination ? t("search.to_required", locale) : t("search.date_required", locale)) : undefined}
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-[15px] font-semibold transition-opacity ${!canSubmit ? "cursor-not-allowed bg-neutral-700 text-neutral-400 opacity-60" : "btn-gold"}`}
      >
        <span>{t("marketplace.search_submit", locale)}</span>
        <ArrowRight size={16} weight="bold" />
      </button>
    </form>
  );
}
