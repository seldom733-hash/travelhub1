"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarBlank, ArrowRight, CaretDown, X } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import { todayISO } from "@/lib/dates";
import type { SearchContext } from "@/lib/search-engine";
import DestinationPicker from "./DestinationPicker";
import HotelFilterSelect from "./HotelFilterSelect";
import {
  fetchGeoDirectory,
  geoDisplayName,
  type GeoDirectoryEntry,
} from "@/lib/geo-api";
import ChildAges from "./ChildAges";
import HelpFindButton from "./HelpFindButton";
import NightsSelect from "./NightsSelect";
import { useClickOutside } from "./useClickOutside";
import { useWidestText } from "@/lib/measure-text";
import {
  PICKER_CONTROL,
  PICKER_CONTROL_ICON,
  PICKER_DATE_WIDTH_EXTRA,
  PICKER_DIGIT_WIDTH_EXTRA,
  PICKER_LABEL,
  PICKER_ROW,
  PICKER_SUBMIT,
  PICKER_TRIGGER,
  PICKER_TRIGGER_TEXT,
  PICKER_W_NIGHTS,
  PICKER_W_NIGHTS_WIDE,
  PICKER_W_TO,
} from "./picker-styles";
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
  // ONE night value (same contract as the tours search): the supplier request
  // carries it as both range bounds. Hotels default to a 1-night stay.
  const [nightsFrom, setNightsFrom] = useState(1);
  const [nightsTo, setNightsTo] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);
  // «Поставщики» picker: enabled hotel suppliers from the backend (имена и
  // признак активности — из CRM-партнёров); пустой выбор = все поставщики.
  const [supplierOptions, setSupplierOptions] = useState<Array<{ code: string; name: string; countries?: string[] }>>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [suppliersOpen, setSuppliersOpen] = useState(false);
  const suppliersRef = useRef<HTMLDivElement>(null);
  useClickOutside(suppliersRef, suppliersOpen, () => setSuppliersOpen(false));

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
      // Old drafts may carry a night RANGE. Collapse it to one value: the
      // form now searches exactly one duration.
      const restoredNights =
        draft.nightsFrom === draft.nightsTo
          ? draft.nightsFrom
          : draft.nightsTo || draft.nightsFrom || 1;
      setNightsFrom(restoredNights);
      setNightsTo(restoredNights);
      setAdults(draft.adults);
      setChildren(draft.children);
      setChildAges(draft.childAges);
      setSelectedSuppliers(draft.selectedSuppliers ?? []);
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
      selectedSuppliers,
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
    selectedSuppliers,
  ]);

  /** «Сбросить все»: back to a fresh form (empty pickers, default date). */
  const resetAll = useCallback(() => {
    setToCountry(null);
    setToCity(null);
    setToResort(null);
    setHotelId("");
    setHotelName("");
    setCheckIn(todayISO());
    setNightsFrom(1);
    setNightsTo(1);
    setAdults(2);
    setChildren(0);
    setChildAges([]);
    setSelectedSuppliers([]);
    clearHotelDraft();
  }, []);

  useEffect(() => {
    if (resetSignal > 0) resetAll();
  }, [resetSignal, resetAll]);

  // «Поставщики» — enabled hotel suppliers (GET /public/supplier/suppliers).
  // Имена и признак активности поставщика приходят из CRM-партнёров.
  useEffect(() => {
    let alive = true;
    fetch("/api/v1/public/supplier/suppliers?service=hotels", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((list: Array<{ code: string; name: string }>) => {
        if (alive) setSupplierOptions(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (alive) setSupplierOptions([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const allowedCountryCodes = useMemo(() => {
    if (selectedSuppliers.length === 0) return undefined;
    const codes = new Set<string>();
    for (const code of selectedSuppliers) {
      const supplier = supplierOptions.find((s) => s.code === code);
      if (!supplier?.countries || supplier.countries.length === 0) return undefined;
      supplier.countries.forEach((c) => codes.add(c.toUpperCase()));
    }
    return [...codes];
  }, [selectedSuppliers, supplierOptions]);

  useEffect(() => {
    if (!allowedCountryCodes || !toCountry) return;
    if (!allowedCountryCodes.includes(toCountry.code.toUpperCase())) {
      setToCountry(null);
      setToCity(null);
      setToResort(null);
    }
  }, [allowedCountryCodes, toCountry]);

  const destination = toResort ?? toCity ?? toCountry;
  // Content-width: те же единицы измерения, что в поиске туров — одиночная
  // дата под «00.00.0000» и однозначные селекты (взрослые/дети).
  const datePx = useWidestText(["00.00.0000"]);
  const digitPx = useWidestText(["0"]);
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
      toDestination: geoDisplayName(destination.names, destination.code, locale),
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
      suppliers: selectedSuppliers.length ? selectedSuppliers : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* Направление + отель — те же размеры, что у «Куда» в поиске туров */}
      <div className={PICKER_ROW}>
        {/* Destination — Master Geography picker (country → city → resort) */}
        <div className={PICKER_W_TO}>
          <DestinationPicker
            id="hotel-to"
            label={t("search.to", locale)}
            placeholder={t("search.to", locale)}
            country={toCountry}
            city={toCity}
            resort={toResort}
            onCountryChange={handleCountryChange}
            onCityChange={handleCityChange}
            onResortChange={handleResortChange}
            onClearAll={() => {
              handleCountryChange(null);
            }}
            allowedCountryCodes={allowedCountryCodes}
            required
          />
        </div>

        {/* Hotel — supplier dictionary directory, scoped to the region;
            тот же компонент, что в поиске туров: клик раскрывает список
            отелей с полем поиска. */}
        <div className={PICKER_W_TO}>
          <HotelFilterSelect
            region={hotelRegion}
            value={hotelName}
            onSelect={(h) => {
              setHotelId(h.id);
              setHotelName(h.name);
            }}
            onClear={() => {
              setHotelId("");
              setHotelName("");
            }}
          />
        </div>

        {/* Check-in — ровно ширина одиночного поля-даты (как в поиске туров) */}
        <div style={{ minWidth: datePx + PICKER_DATE_WIDTH_EXTRA, maxWidth: datePx + PICKER_DATE_WIDTH_EXTRA }}>
          <label htmlFor="hotel-checkin" className={PICKER_LABEL}>
            {t("search.check_in", locale)}
          </label>
          <div className="relative">
            <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              id="hotel-checkin"
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className={PICKER_CONTROL_ICON}
            />
          </div>
        </div>

        {/* ONE night value (the supplier request gets it as both bounds). */}
        <div className={PICKER_W_NIGHTS_WIDE}>
          <NightsSelect
            id="hotel-nights"
            value={nightsFrom}
            options={Array.from({ length: 30 }, (_, i) => i + 1)}
            onChange={(n) => {
              setNightsFrom(n);
              setNightsTo(n);
            }}
          />
        </div>

        {/* Adults */}
        <div style={{ maxWidth: digitPx + PICKER_DIGIT_WIDTH_EXTRA }}>
          <label htmlFor="hotel-adults" className={PICKER_LABEL}>
            {t("search.adults", locale)}
          </label>
          <select
            id="hotel-adults"
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className={PICKER_CONTROL}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Children */}
        <div style={{ maxWidth: digitPx + PICKER_DIGIT_WIDTH_EXTRA }}>
          <label htmlFor="hotel-children" className={PICKER_LABEL}>
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
            className={PICKER_CONTROL}
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Suppliers («Поставщики») — hotel suppliers from CRM partners,
            multi-select; empty = every supplier. */}
        <div className="min-w-[150px] flex-[1_1_150px]">
          <label htmlFor="hotel-suppliers" className={PICKER_LABEL}>
            {t("search.suppliers", locale)}
          </label>
          <div className="relative" ref={suppliersRef}>
            <button
              id="hotel-suppliers"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={suppliersOpen}
              onClick={() => setSuppliersOpen((v) => !v)}
              className={PICKER_TRIGGER}
            >
              <span
                className={`${PICKER_TRIGGER_TEXT} ${selectedSuppliers.length ? "text-white" : "text-neutral-500"}`}
              >
                {selectedSuppliers.length
                  ? selectedSuppliers
                      .map((c) => supplierOptions.find((s) => s.code === c)?.name ?? c)
                      .slice(0, 2)
                      .join(", ") + (selectedSuppliers.length > 2 ? ` +${selectedSuppliers.length - 2}` : "")
                  : t("search.all_suppliers", locale)}
              </span>
              {selectedSuppliers.length > 0 ? (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={t("search.reset_all", locale)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSuppliers([]);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedSuppliers([]);
                    }
                  }}
                  className="shrink-0 text-neutral-500 transition-colors hover:text-white"
                >
                  <X size={14} />
                </span>
              ) : (
                <CaretDown size={14} weight="light" className={`shrink-0 text-neutral-500 transition-transform ${suppliersOpen ? "rotate-180" : ""}`} />
              )}
            </button>
            {suppliersOpen && (
              <div className="absolute left-0 right-0 top-full z-[60] mt-1 overflow-hidden rounded-xl border border-dark-border bg-dark-surface shadow-xl">
                <ul role="listbox" aria-multiselectable="true" className="max-h-56 overflow-y-auto py-1">
                  {supplierOptions.map((s) => {
                    const active = selectedSuppliers.includes(s.code);
                    return (
                      <li key={s.code}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            setSelectedSuppliers((prev) =>
                              prev.includes(s.code)
                                ? prev.filter((c) => c !== s.code)
                                : [...prev, s.code],
                            );
                            // Collapse after picking an option (same contract
                            // as «Откуда»); reopen to add/remove more.
                            setSuppliersOpen(false);
                          }}
                          className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5 ${active ? "bg-gold/10" : ""}`}
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 px-1 text-[12px] font-semibold text-gold">
                            {s.code.slice(0, 4)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-white">
                            {s.name}
                          </span>
                          {active && <span className="text-[13px] text-gold">✓</span>}
                        </button>
                      </li>
                    );
                  })}
                  {supplierOptions.length === 0 && (
                    <li className="px-3 py-3 text-center text-[14px] text-neutral-500">{t("common.loading", locale)}</li>
                  )}
                </ul>
                {selectedSuppliers.length > 0 && (
                  <div className="border-t border-dark-border p-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSuppliers([])}
                      className="w-full rounded-lg px-2 py-1.5 text-[13px] text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      {t("search.reset_all", locale)}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
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
          toDestination: destination ? geoDisplayName(destination.names, destination.code, locale) : "",
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
          suppliers: selectedSuppliers.length ? selectedSuppliers : undefined,
        }}
      />

      {/* Submit */}
      <button type="submit" className={`btn-gold ${PICKER_SUBMIT}`}>
        <span>{t("marketplace.search_submit", locale)}</span>
        <ArrowRight size={16} weight="bold" />
      </button>
    </form>
  );
}
