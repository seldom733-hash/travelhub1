"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CaretDown, CaretRight, MapPin, X } from "@phosphor-icons/react";
import {
  fetchGeoDirectory,
  geoDisplayName,
  type GeoDirectoryEntry,
} from "@/lib/geo-api";
import { useWidestText } from "@/lib/measure-text";
import { useLocale, t } from "@/lib/i18n";
import { PICKER_LABEL, PICKER_TRIGGER, PICKER_TRIGGER_TEXT } from "./picker-styles";
import { useClickOutside } from "./useClickOutside";

interface DestinationPickerProps {
  id: string;
  label: string;
  placeholder: string;
  country: GeoDirectoryEntry | null;
  city: GeoDirectoryEntry | null;
  resort: GeoDirectoryEntry | null;
  onCountryChange: (entry: GeoDirectoryEntry | null) => void;
  onCityChange: (entry: GeoDirectoryEntry | null) => void;
  onResortChange: (entry: GeoDirectoryEntry | null) => void;
  onClearAll: () => void;
  required?: boolean;
  /** ISO-2 country codes allowed by the selected suppliers. Omitted = all. */
  allowedCountryCodes?: string[];
}

type Section = "country" | "city" | "resort";

function filterItems(
  items: GeoDirectoryEntry[] | null,
  query: string,
): GeoDirectoryEntry[] {
  if (!items) return [];
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const names = item.names ?? { ru: "", en: "", az: "" };
    return (
      `${item.code} ${names.ru ?? ""} ${names.en ?? ""} ${names.az ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  });
}

/**
 * Single "To" dropdown with three nested expandable lists:
 * Country → City → Resort, each with its own live search.
 * Child lists follow the selected parent; any level can also be
 * picked directly (parent chain resolves upward via callbacks).
 */
export default function DestinationPicker({
  id,
  label,
  placeholder,
  country,
  city,
  resort,
  onCountryChange,
  onCityChange,
  onResortChange,
  onClearAll,
  required = false,
  allowedCountryCodes,
}: DestinationPickerProps) {
  const [open, setOpen] = useState(false);
  // null = все секции свернуты (можно раскрыть любую кликом и свернуть обратно,
  // не вводя текст поиска).
  const [expanded, setExpanded] = useState<Section | null>("country");
  const [countries, setCountries] = useState<GeoDirectoryEntry[] | null>(null);
  const [cities, setCities] = useState<GeoDirectoryEntry[] | null>(null);
  const [resorts, setResorts] = useState<GeoDirectoryEntry[] | null>(null);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingResorts, setLoadingResorts] = useState(false);
  const [qCountry, setQCountry] = useState("");
  const [qCity, setQCity] = useState("");
  const [qResort, setQResort] = useState("");
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);

  // «Куда» is the only picker that STAYS open on selection (country → city →
  // resort is a cascade) — it closes on the parent (trigger) click or when
  // another search element is clicked.
  useClickOutside(containerRef, open, () => setOpen(false));

  // Load countries once (cached in fetchGeoDirectory).
  useEffect(() => {
    fetchGeoDirectory("country")
      .then((list) => setCountries(list))
      .catch(() => setCountries([]));
  }, []);

  // Cities follow the selected country (or all cities for direct entry).
  useEffect(() => {
    let alive = true;
    setLoadingCities(true);
    fetchGeoDirectory("city", country?.id)
      .then((list) => {
        if (alive) setCities(list);
      })
      .catch(() => {
        if (alive) setCities([]);
      })
      .finally(() => {
        if (alive) setLoadingCities(false);
      });
    return () => {
      alive = false;
    };
  }, [country?.id]);

  // Resorts follow the selected city (or the selected country, or all
  // resorts for direct entry).
  useEffect(() => {
    let alive = true;
    setLoadingResorts(true);
    fetchGeoDirectory("resort", country?.id, city?.id)
      .then((list) => {
        if (alive) setResorts(list);
      })
      .catch(() => {
        if (alive) setResorts([]);
      })
      .finally(() => {
        if (alive) setLoadingResorts(false);
      });
    return () => {
      alive = false;
    };
  }, [city?.id, country?.id]);

  const selected = resort ?? city ?? country;

  // When supplier(s) are selected, restrict the country list to their
  // supported countries (union for several suppliers).
  const allowedCountries = useMemo(() => {
    if (!countries) return null;
    if (!allowedCountryCodes || allowedCountryCodes.length === 0) return countries;
    const allowed = new Set(allowedCountryCodes.map((c) => c.toUpperCase()));
    return countries.filter((c) => allowed.has(c.code.toUpperCase()));
  }, [countries, allowedCountryCodes]);

  // Content-width: sized to the longest «Name · CODE» text across all three
  // sections (country/city/resort lists), placeholder as fallback.
  // useWidestText is SSR-safe (0 on server + hydration, measured after mount).
  const widthLabels = useMemo(() => {
    const labels = [
      ...(countries ?? []).map((i) => `${geoDisplayName(i.names, i.code, locale)} · ${i.code}`),
      ...(cities ?? []).map((i) => `${geoDisplayName(i.names, i.code, locale)} · ${i.code}`),
      ...(resorts ?? []).map((i) => `${geoDisplayName(i.names, i.code, locale)} · ${i.code}`),
    ];
    if (labels.length === 0) return [];
    labels.push(placeholder);
    return labels;
  }, [countries, cities, resorts, placeholder, locale]);
  const measuredPx = useWidestText(widthLabels);
  const maxTextPx = measuredPx;

  // Picking an entry collapses only its own section — the dropdown stays
  // open so a deeper level (city/resort) can be picked right away.
  const pickCountry = (entry: GeoDirectoryEntry) => {
    onCountryChange(entry);
    setExpanded(null);
  };

  const pickCity = (entry: GeoDirectoryEntry) => {
    onCityChange(entry);
    setExpanded(null);
  };

  const pickResort = (entry: GeoDirectoryEntry) => {
    // Terminal level — still no collapse: the dropdown closes only via the
    // trigger or a click outside (same contract as country/city picks).
    onResortChange(entry);
    setExpanded(null);
  };

  const toggle = (section: Section) =>
    setExpanded((prev) => (prev === section ? null : section));

  const sectionHeader = (
    section: Section,
    title: string,
    current: GeoDirectoryEntry | null,
    onClear: () => void,
  ) => (
    <button
      type="button"
      onClick={() => toggle(section)}
      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/5"
    >
      <CaretRight
        size={12}
        className={`shrink-0 text-neutral-500 transition-transform ${expanded === section ? "rotate-90" : ""}`}
      />
      <span className="flex-1 text-[14px] font-semibold uppercase tracking-wide text-neutral-400">
        {title}
      </span>
      {current && (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="max-w-[55%] truncate text-[14px] font-medium text-gold">
            {geoDisplayName(current.names, current.code, locale)}
          </span>
          {/* Per-level reset («Страна»/«Город»/«Курорт»): clears THIS level —
              and everything below it, the cascade contract (a country change
              invalidates its cities, a city change its resorts). Same X icon
              as the trigger's general clear, but scoped to the level. */}
          <span
            role="button"
            tabIndex={0}
            aria-label={`Очистить: ${title}`}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onClear();
              }
            }}
            className="shrink-0 text-neutral-500 transition-colors hover:text-white"
          >
            <X size={13} />
          </span>
        </span>
      )}
    </button>
  );

  const searchInput = (
    value: string,
    onChange: (value: string) => void,
    placeholderText: string,
  ) => (
    <div className="px-3 pb-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholderText}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-lg border border-dark-border bg-dark-card px-3 py-1.5 text-[14px] text-white placeholder-neutral-500 outline-none focus:border-gold/50"
      />
    </div>
  );

  const itemRow = (
    item: GeoDirectoryEntry,
    selectedId: string | undefined,
    onPick: (item: GeoDirectoryEntry) => void,
  ) => (
    <li key={item.id}>
      <button
        type="button"
        role="option"
        aria-selected={selectedId === item.id}
        onClick={() => onPick(item)}
        className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5 ${
          selectedId === item.id ? "bg-gold/10" : ""
        }`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 px-1 text-center text-[14px] font-semibold leading-tight text-gold">
          {item.code.length > 6 ? item.code.slice(0, 6) : item.code}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-white">
            {geoDisplayName(item.names, item.code, locale)}
          </span>
        </span>
        {selectedId === item.id && <span className="text-[13px] text-gold">✓</span>}
      </button>
    </li>
  );

  return (
    <div ref={containerRef} className="relative" style={{ maxWidth: maxTextPx > 0 ? maxTextPx + 56 : undefined }}>
      <label
        htmlFor={id}
        className={PICKER_LABEL}
      >
        {label}
        {required && <span className="ml-0.5 text-gold">*</span>}
      </label>

      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={PICKER_TRIGGER}
      >
        <MapPin size={14} weight="light" className="shrink-0 text-neutral-500" />

        <span className={`${PICKER_TRIGGER_TEXT} ${selected ? "text-white" : "text-neutral-500"}`}>
          {selected
            ? `${geoDisplayName(selected.names, selected.code, locale)} · ${selected.code}`
            : placeholder}
        </span>

        {selected ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onClearAll();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onClearAll();
              }
            }}
            className="text-neutral-500 hover:text-white"
            aria-label={t("search.clear", locale)}
          >
            <X size={14} />
          </span>
        ) : (
          <CaretDown
            size={14}
            className={`shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[60] mt-1 overflow-hidden rounded-xl border border-dark-border bg-dark-surface shadow-xl">
          {/* Country section */}
          {sectionHeader("country", t("search.country", locale), country, () => onCountryChange(null))}
          {expanded === "country" && (
            <div className="border-b border-dark-border pb-1">
              {searchInput(qCountry, setQCountry, `${t("search.country", locale)}…`)}
              <ul role="listbox" className="max-h-48 overflow-y-auto py-1">
                {filterItems(allowedCountries, qCountry).map((item) =>
                  itemRow(item, country?.id, pickCountry),
                )}
                {allowedCountries !== null &&
                  filterItems(allowedCountries, qCountry).length === 0 && (
                    <li className="px-3 py-3 text-center text-[14px] text-neutral-500">
                      {t("search.no_results", locale)}
                    </li>
                  )}
              </ul>
            </div>
          )}

          {/* City section */}
          {sectionHeader("city", t("search.city", locale), city, () => onCityChange(null))}
          {expanded === "city" && (
            <div className="border-b border-dark-border pb-1">
              {searchInput(qCity, setQCity, `${t("search.city", locale)}…`)}
              <ul role="listbox" className="max-h-48 overflow-y-auto py-1">
                {loadingCities && (
                  <li className="px-3 py-3 text-center text-[14px] text-neutral-500">
                    {t("search.searching", locale)}
                  </li>
                )}
                {!loadingCities &&
                  filterItems(cities, qCity).map((item) =>
                    itemRow(item, city?.id, pickCity),
                  )}
                {!loadingCities &&
                  cities !== null &&
                  filterItems(cities, qCity).length === 0 && (
                    <li className="px-3 py-3 text-center text-[14px] text-neutral-500">
                      {t("search.no_results", locale)}
                    </li>
                  )}
              </ul>
            </div>
          )}

          {/* Resort section */}
          {sectionHeader("resort", t("search.resort", locale), resort, () => onResortChange(null))}
          {expanded === "resort" && (
            <div className="pb-1">
              {searchInput(qResort, setQResort, `${t("search.resort", locale)}…`)}
              <ul role="listbox" className="max-h-48 overflow-y-auto py-1">
                {loadingResorts && (
                  <li className="px-3 py-3 text-center text-[14px] text-neutral-500">
                    {t("search.searching", locale)}
                  </li>
                )}
                {!loadingResorts &&
                  filterItems(resorts, qResort).map((item) =>
                    itemRow(item, resort?.id, pickResort),
                  )}
                {!loadingResorts &&
                  resorts !== null &&
                  filterItems(resorts, qResort).length === 0 && (
                    <li className="px-3 py-3 text-center text-[14px] text-neutral-500">
                      {t("search.no_results", locale)}
                    </li>
                  )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
