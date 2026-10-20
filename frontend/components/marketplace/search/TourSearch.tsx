"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarBlank, ArrowRight, Buildings, CaretDown, X } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import { tomorrowISO } from "@/lib/dates";
import { useWidestText } from "@/lib/measure-text";
import type { SearchContext } from "@/lib/search-engine";
import DirectorySelect from "./DirectorySelect";
import DestinationPicker from "./DestinationPicker";
import {
  fetchGeoDirectory,
  geoDisplayName,
  type GeoDirectoryEntry,
} from "@/lib/geo-api";
import ChildAges from "./ChildAges";
import HelpFindButton from "./HelpFindButton";
import NightsSelect from "./NightsSelect";
import HotelStarsSelect from "./HotelStarsSelect";
import HotelFilterSelect from "./HotelFilterSelect";
import { useClickOutside } from "./useClickOutside";
import {
  PICKER_CHECKBOX,
  PICKER_CONTROL,
  PICKER_CONTROL_ICON,
  PICKER_DATE_WIDTH_EXTRA,
  PICKER_LABEL,
  PICKER_ROW,
  PICKER_SUBMIT,
  PICKER_TRIGGER,
  PICKER_TRIGGER_TEXT,
  PICKER_W_FROM,
  PICKER_W_NIGHTS,
  PICKER_W_NIGHTS_WIDE,
  PICKER_W_TO,
} from "./picker-styles";
import {
  clearTourDraft,
  readTourDraft,
  writeTourDraft,
} from "./tour-search-store";

interface TourSearchProps {
  onSearch: (ctx: SearchContext) => void;
  /** «Сбросить все» (HeroSearch toolbar): every change resets all pickers. */
  resetSignal?: number;
}

export default function TourSearch({ onSearch, resetSignal = 0 }: TourSearchProps) {
  const locale = useLocale();
  const [from, setFrom] = useState<GeoDirectoryEntry | null>(null);
  const [toCountry, setToCountry] = useState<GeoDirectoryEntry | null>(null);
  const [toCity, setToCity] = useState<GeoDirectoryEntry | null>(null);
  const [toResort, setToResort] = useState<GeoDirectoryEntry | null>(null);
  // Default departure = tomorrow (+1 day from today) — the search forms'
  // platform default. The search uses ONE check-in date: the supplier request
  // carries the same date as both range bounds.
  const [startDate, setStartDate] = useState(tomorrowISO());
  // ONE night value (not a range). 7 nights is valid for every tour supplier
  // (KOMPAS minimum is 3, ANEX minimum is 2).
  const [nightsFrom, setNightsFrom] = useState(7);
  const [nightsTo, setNightsTo] = useState(7);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);
  const [selectHotel, setSelectHotel] = useState(false);
  const [hotelId, setHotelId] = useState<string>("");
  const [hotelName, setHotelName] = useState<string>("");
  // Hotel star categories (supplier dictionary labels; empty = any).
  const [hotelStars, setHotelStars] = useState<string[]>([]);
  // «Поставщики» picker: enabled tour suppliers from the backend;
  // empty selection = all suppliers.
  const [supplierOptions, setSupplierOptions] = useState<Array<{ code: string; name: string; countries?: string[] }>>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [suppliersOpen, setSuppliersOpen] = useState(false);
  const suppliersRef = useRef<HTMLDivElement>(null);
  // Multi-select: stays open while picking (like «Куда»), closes on the
  // trigger or when another search element is clicked.
  useClickOutside(suppliersRef, suppliersOpen, () => setSuppliersOpen(false));

  // ── Draft: restore the pickers of the previous search ──────────────────
  // The form unmounts between the home page and the results page; the draft
  // (module memory + sessionStorage) brings every picker back on return.
  // Applied in an effect AFTER mount so SSR renders plain defaults (no
  // hydration mismatch); `hydrated` gates the persist effect so the initial
  // default values cannot clobber the stored draft.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const draft = readTourDraft();
    if (draft) {
      setFrom(draft.from);
      setToCountry(draft.toCountry);
      setToCity(draft.toCity);
      setToResort(draft.toResort);
      // Old drafts may carry a date/night RANGE. Collapse it to one value:
      // the form now searches exactly one check-in and one duration.
      setStartDate(draft.startDate || draft.endDate || tomorrowISO());
      const restoredNights =
        draft.nightsFrom === draft.nightsTo
          ? draft.nightsFrom
          : draft.nightsTo || draft.nightsFrom || 7;
      setNightsFrom(restoredNights);
      setNightsTo(restoredNights);
      setAdults(draft.adults);
      setChildren(draft.children);
      setChildAges(draft.childAges);
      setSelectHotel(draft.selectHotel);
      setHotelId(draft.hotelId);
      setHotelName(draft.hotelName);
      setHotelStars(draft.hotelStars);
      setSelectedSuppliers(draft.selectedSuppliers);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeTourDraft({
      from,
      toCountry,
      toCity,
      toResort,
      startDate,
      // Persisted for backwards compatibility with older drafts; the form
      // itself no longer exposes a departure range.
      endDate: startDate,
      nightsFrom,
      nightsTo,
      adults,
      children,
      childAges,
      selectHotel,
      hotelId,
      hotelName,
      hotelStars,
      selectedSuppliers,
    });
  }, [
    hydrated,
    from,
    toCountry,
    toCity,
    toResort,
    startDate,
    nightsFrom,
    nightsTo,
    adults,
    children,
    childAges,
    selectHotel,
    hotelId,
    hotelName,
    hotelStars,
    selectedSuppliers,
  ]);

  /** «Сбросить все»: back to a fresh form (empty pickers, default dates). */
  const resetAll = useCallback(() => {
    setFrom(null);
    setToCountry(null);
    setToCity(null);
    setToResort(null);
    setStartDate(tomorrowISO());
    setNightsFrom(7);
    setNightsTo(7);
    setAdults(2);
    setChildren(0);
    setChildAges([]);
    setSelectHotel(false);
    setHotelId("");
    setHotelName("");
    setHotelStars([]);
    setSelectedSuppliers([]);
    clearTourDraft();
  }, []);

  useEffect(() => {
    if (resetSignal > 0) resetAll();
  }, [resetSignal, resetAll]);

  // «Поставщики» — enabled tour suppliers (GET /public/supplier/suppliers).
  useEffect(() => {
    let alive = true;
    fetch("/api/v1/public/supplier/suppliers?service=tours", { cache: "no-store" })
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
    setSubmitError("");
    // A different country invalidates the selected hotel (its dictionary
    // belongs to the previous direction).
    setHotelId("");
    setHotelName("");
  };

  const handleCityChange = (entry: GeoDirectoryEntry | null) => {
    setToCity(entry);
    setToResort(null);
    setSubmitError("");
    setHotelId("");
    setHotelName("");
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
    setSubmitError("");
    setHotelId("");
    setHotelName("");
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

  // Countries allowed by the selected suppliers (union). No selection = all.
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

  // Drop a destination that is no longer allowed when the supplier set changes.
  useEffect(() => {
    if (!allowedCountryCodes || !toCountry) return;
    if (!allowedCountryCodes.includes(toCountry.code.toUpperCase())) {
      setToCountry(null);
      setToCity(null);
      setToResort(null);
    }
  }, [allowedCountryCodes, toCountry]);

  const destination = toResort ?? toCity ?? toCountry;

  // «Найти» активна, только когда выбрано направление (хотя бы один из
  // трёх списков в «Куда») и указана дата.
  const canSubmit = Boolean(destination && startDate);
  // Visible validation feedback instead of a silent no-op when the submit
  // button is clicked while a required picker is still empty.
  const [submitError, setSubmitError] = useState("");

  // Content-width: each date input fits «00.00.0000» (xx.xx.xxxx).
  // useWidestText is SSR-safe (0 on server + hydration, measured after mount).
  const datePx = useWidestText(["00.00.0000"]);
  // Single-digit selects (adults 1–6, children 0–5).
  const digitPx = useWidestText(["0"]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dest = toResort ?? toCity ?? toCountry;
    if (!dest) {
      setSubmitError(t("search.to_required", locale));
      document.getElementById("tour-to")?.focus();
      return;
    }
    if (!startDate) {
      setSubmitError(t("search.date_required", locale));
      document.getElementById("tour-date")?.focus();
      return;
    }
    setSubmitError("");
    onSearch({
      serviceType: "tours",
      fromDestination: from ? geoDisplayName(from.names, from.code, locale) : "",
      toDestination: geoDisplayName(dest.names, dest.code, locale),
      // Most specific geo code wins; catalog filters by it, supplier
      // (KOMPAS) is used only for country-level selection.
      toGeoCountry: toCountry?.code,
      toGeoCity: toCity?.code,
      toGeoResort: toResort?.code,
      startDate,
      // One check-in date: the backend receives the same date as both bounds.
      endDate: startDate,
      nights: nightsFrom,
      nightsFrom,
      nightsTo,
      hotelStars: hotelStars.length ? hotelStars : undefined,
      suppliers: selectedSuppliers.length ? selectedSuppliers : undefined,
      adults,
      children,
      childAges: childAges.slice(0, children),
      hotelId: hotelId || undefined,
      hotelName: hotelName || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* Flex-wrap layout: every control takes its content width (sized to the
          longest text it can hold) and wraps naturally instead of being
          stretched over equal grid columns. */}
      <div className={PICKER_ROW}>
        {/* From — Azerbaijan cities from the directory */}
        <div className={PICKER_W_FROM}>
        <DirectorySelect
          id="tour-from"
          label={t("search.from", locale)}
          placeholder={t("search.from", locale)}
          value={from}
          onChange={setFrom}
          loadItems={async () => {
            const countries = await fetchGeoDirectory("country");
            const az = countries.find((c) => c.code === "AZ");
            if (!az) return [];
            return fetchGeoDirectory("city", az.id);
          }}
        />
        </div>

        {/* To: single dropdown with nested Country → City → Resort
            lists, each with its own live search. */}
        <div className={PICKER_W_TO}>
        <DestinationPicker
          id="tour-to"
          label={t("search.to", locale)}
          placeholder={t("search.to", locale)}
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
          allowedCountryCodes={allowedCountryCodes}
          required
        />
        </div>

        {/* ONE check-in date (the supplier request gets it as both bounds). */}
        <div style={{ minWidth: datePx + PICKER_DATE_WIDTH_EXTRA, maxWidth: datePx + PICKER_DATE_WIDTH_EXTRA }}>
          <label htmlFor="tour-date" className={PICKER_LABEL}>
            {t("search.check_in", locale)}
          </label>
          <div className="relative">
            <CalendarBlank size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              id="tour-date"
              type="date"
              aria-label={t("search.check_in", locale)}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setSubmitError("");
              }}
              className={PICKER_CONTROL_ICON}
            />
          </div>
        </div>

        {/* ONE night value - the supplier request gets it as both bounds. */}
        <div className={PICKER_W_NIGHTS_WIDE}>
        <NightsSelect
          id="tour-nights"
          value={nightsFrom}
          options={Array.from({ length: 12 }, (_, i) => i + 3)}
          onChange={(n) => {
            setNightsFrom(n);
            setNightsTo(n);
          }}
        />
        </div>
      </div>

      <div className={PICKER_ROW}>
        {/* Adults */}
        <div style={{ maxWidth: digitPx + 56 }}>
          <label htmlFor="tour-adults" className={PICKER_LABEL}>
            {t("search.adults", locale)}
          </label>
          <select
            id="tour-adults"
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
        <div style={{ maxWidth: digitPx + 56 }}>
          <label htmlFor="tour-children" className={PICKER_LABEL}>
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
            className={PICKER_CONTROL}
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Suppliers («Поставщики») — all tour suppliers, multi-select;
            empty = every supplier. */}
        <div className="min-w-[150px] flex-[1_1_150px]">
          <label htmlFor="tour-suppliers" className={PICKER_LABEL}>
            {locale === "ru" ? "Поставщики" : locale === "az" ? "Təchizatçılar" : "Suppliers"}
          </label>
          <div className="relative" ref={suppliersRef}>
            <button
              id="tour-suppliers"
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
                  : locale === "ru"
                    ? "Все"
                    : locale === "az"
                      ? "Hamısı"
                      : "All"}
              </span>
              {selectedSuppliers.length > 0 ? (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={locale === "az" ? "Sıfırla" : "Сбросить"}
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
                      {locale === "ru" ? "Сбросить" : locale === "az" ? "Sıfırla" : "Reset"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Hotel star categories — per-country supplier dictionaries */}
        <div className={PICKER_W_NIGHTS}>
          <HotelStarsSelect
            selected={hotelStars}
            onChange={setHotelStars}
            countryCode={toCountry?.code}
          />
        </div>

        {/* Select hotel checkbox */}
        <div className="flex items-end">
          <label className={PICKER_CHECKBOX}>
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

      {/* Hotel filter (conditional): the FULL supplier hotel directory of the
          selected direction (hotels from ALL suppliers) as a dropdown filter
          with live search over the list. */}
      {selectHotel && (
        <HotelFilterSelect
          region={{
            geoCountry: toCountry?.code,
            geoCity: toCity?.code,
            geoResort: toResort?.code,
          }}
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
      )}

      {/* Help Find */}
      <HelpFindButton
        context={{
          serviceType: "tours",
          fromDestination: from ? geoDisplayName(from.names, from.code, locale) : "",
          toDestination: destination ? geoDisplayName(destination.names, destination.code, locale) : "",
          startDate,
          endDate: startDate,
          nights: nightsFrom,
          nightsFrom,
          nightsTo,
          hotelStars: hotelStars.length ? hotelStars : undefined,
          adults,
          children,
          childAges: childAges.slice(0, children),
          hotelId: hotelId || undefined,
        }}
      />

      {/* Submit — destination is required so the results URL always
          carries the direction (no more direction-less transitions) */}
      {submitError && (
        <p className="text-sm text-red-400">{submitError}</p>
      )}
      <button
        type="submit"
        onClick={(e) => handleSubmit(e as React.FormEvent)}
        className={`btn-gold ${PICKER_SUBMIT}`}
      >
        <span>{t("marketplace.search_submit", locale)}</span>
        <ArrowRight size={16} weight="bold" />
      </button>
    </form>
  );
}
