"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Buildings, CaretDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useLocale } from "@/lib/i18n";

export interface SupplierHotelOption {
  /** Supplier-neutral id (= hotel name — the only cross-supplier identity). */
  id: string;
  name: string;
  suppliers: string[];
}

interface HotelFilterSelectProps {
  /** Region scope for /geo/supplier-hotels (Master Geography codes). */
  region: { geoCountry?: string; geoCity?: string; geoResort?: string };
  /** Currently selected hotel name ("" = none). */
  value: string;
  onSelect: (hotel: SupplierHotelOption) => void;
  onClear: () => void;
}

/**
 * HotelFilterSelect — «Выбрать отель» filter dropdown: the FULL list of
 * hotels of the selected country/city/resort (all suppliers, GET
 * /geo/supplier-hotels) with a built-in live search over that list.
 *
 * Unlike a plain text input, every entry is a known supplier hotel — the
 * selection maps 1:1 to the backend's per-supplier HOTELS ids.
 */
export default function HotelFilterSelect({
  region,
  value,
  onSelect,
  onClear,
}: HotelFilterSelectProps) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hotels, setHotels] = useState<SupplierHotelOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const regionKey = `${region.geoCountry ?? ""}|${region.geoCity ?? ""}|${region.geoResort ?? ""}`;

  // Load the region's full hotel list on open (per region — one request).
  useEffect(() => {
    if (!open) return;
    if (hotels !== null) return;
    let alive = true;
    setLoading(true);
    const sp = new URLSearchParams();
    if (region.geoCountry) sp.set("geoCountry", region.geoCountry);
    if (region.geoCity) sp.set("geoCity", region.geoCity);
    if (region.geoResort) sp.set("geoResort", region.geoResort);
    sp.set("limit", "1000");
    fetch(`/api/v1/geo/supplier-hotels?${sp.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((list: SupplierHotelOption[]) => {
        if (alive) setHotels(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (alive) setHotels([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, regionKey]);

  // Direction change → previous list is stale; selection is cleared by parent.
  useEffect(() => {
    setHotels(null);
    setQuery("");
  }, [regionKey]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!hotels) return [];
    const q = query.trim().toLowerCase();
    if (!q) return hotels;
    return hotels.filter((h) => h.name.toLowerCase().includes(q));
  }, [hotels, query]);

  // Content-width trigger: fits the selected name up to a cap.
  const label =
    value ||
    (locale === "ru"
      ? "Все отели"
      : locale === "az"
        ? "Bütün otellər"
        : "All hotels");

  return (
    <div className="relative w-full" ref={containerRef}>
      <label
        htmlFor="tour-hotel-filter"
        className="mb-0.5 block text-[13px] font-medium text-neutral-400"
      >
        {locale === "ru" ? "Отель" : locale === "az" ? "Otel" : "Hotel"}
      </label>
      <button
        id="tour-hotel-filter"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-dark-border bg-dark-card px-3 py-2 text-left outline-none transition-colors hover:border-gold/40 focus:border-gold/50"
      >
        <Buildings size={14} weight="light" className="shrink-0 text-neutral-500" />
        <span
          className={`min-w-0 flex-1 truncate text-[15px] ${value ? "text-white" : "text-neutral-500"}`}
        >
          {label}
        </span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            aria-label={locale === "az" ? "Sıfırla" : "Сбросить"}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onClear();
              }
            }}
            className="shrink-0 text-neutral-500 transition-colors hover:text-white"
          >
            <X size={14} />
          </span>
        )}
        <CaretDown
          size={14}
          className={`shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[60] mt-1 overflow-hidden rounded-xl border border-dark-border bg-dark-surface shadow-xl">
          <div className="relative border-b border-dark-border">
            <MagnifyingGlass
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                locale === "ru"
                  ? "Поиск отеля…"
                  : locale === "az"
                    ? "Otel axtarışı…"
                    : "Hotel search…"
              }
              autoComplete="off"
              className="w-full bg-transparent py-2.5 pl-9 pr-3 text-[15px] text-white placeholder-neutral-500 outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {loading && (
              <li className="px-3 py-3 text-center text-[14px] text-neutral-500">
                {locale === "ru" ? "Загрузка…" : locale === "az" ? "Yüklənir…" : "Loading…"}
              </li>
            )}
            {!loading && hotels !== null && filtered.length === 0 && (
              <li className="px-3 py-3 text-center text-[14px] text-neutral-500">
                {locale === "ru"
                  ? "Ничего не найдено"
                  : locale === "az"
                    ? "Heç nə tapılmadı"
                    : "Nothing found"}
              </li>
            )}
            {!loading &&
              filtered.map((h) => {
                const active = h.name === value;
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onSelect(h);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/5 ${active ? "bg-gold/10" : ""}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-white">
                          {h.name}
                        </span>
                        {h.suppliers.length > 0 && (
                          <span className="block truncate text-[12px] text-neutral-500">
                            {h.suppliers.join(", ")}
                          </span>
                        )}
                      </span>
                      {active && <span className="shrink-0 text-[13px] text-gold">✓</span>}
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
}
