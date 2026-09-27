"use client";

import { useState, useCallback } from "react";
import { t, useLocale } from "@/lib/i18n";
import type { SupplierSearchQuery } from "@/lib/supplier-api";

/**
 * Per-supplier verified parameter ranges (capability matrix, mirrors the
 * backend aggregator). Values outside a supplier's range cause explicit
 * rejection by that supplier — the aggregate endpoint skips such suppliers.
 */
const KOMPAS_NIGHTS = { min: 3, max: 14 } as const;
const KOMPAS_ADULTS = { min: 1, max: 4 } as const;
const KOMPAS_CHILDREN = { min: 0, max: 1 } as const;
const SUMMERTOUR_NIGHTS = { min: 1, max: 30 } as const;

type Range = { readonly min: number; readonly max: number };

const SUPPLIER_RANGES: Record<string, { nights: Range; adults: Range; children: Range }> = {
  KOMPAS: { nights: KOMPAS_NIGHTS, adults: KOMPAS_ADULTS, children: KOMPAS_CHILDREN },
  SUMMERTOUR: { nights: SUMMERTOUR_NIGHTS, adults: { min: 1, max: 4 }, children: { min: 0, max: 1 } },
  KAZUNION: { nights: { min: 3, max: 15 }, adults: { min: 1, max: 5 }, children: { min: 0, max: 4 } },
};

/**
 * VitrinaFilters — supplier-agnostic search filter bar.
 *
 * Renders filter controls for the KOMPAS capability matrix.
 * Unsupported capabilities (stars, resort, seat availability) are NOT rendered.
 *
 * Filters: departure, destination, nights, adults, children, hotel, meal, price.
 */
export default function VitrinaFilters({
  initial,
  onSearch,
  supplierCode = "KOMPAS",
}: {
  initial?: Partial<SupplierSearchQuery>;
  onSearch: (query: SupplierSearchQuery) => void;
  supplierCode?: string;
}) {
  const locale = useLocale();
  const range = SUPPLIER_RANGES[supplierCode] ?? SUPPLIER_RANGES.KOMPAS;

  const [departureCity, setDepartureCity] = useState(initial?.departureCity ?? "1411");
  const [destination, setDestination] = useState(initial?.destination ?? "");
  const [nightsFrom, setNightsFrom] = useState(initial?.nightsFrom ?? 7);
  const [nightsTo, setNightsTo] = useState(initial?.nightsTo ?? 7);
  const [adults, setAdults] = useState(initial?.adults ?? 2);
  const [children, setChildren] = useState(initial?.children ?? 0);
  const [hotel, setHotel] = useState(initial?.hotel ?? "");
  const [meal, setMeal] = useState(initial?.meal ?? "");
  const [departureDate, setDepartureDate] = useState(initial?.departureDateFrom ?? "");
  const [nightsError, setNightsError] = useState<string | null>(null);

  const validateNights = useCallback((from: number, to: number): boolean => {
    const range = SUPPLIER_RANGES[supplierCode]?.nights ?? KOMPAS_NIGHTS;
    if (from < range.min || from > range.max) {
      setNightsError(
        t("supplier.validation.nights_range", locale)
          .replace("{min}", String(KOMPAS_NIGHTS.min))
          .replace("{max}", String(KOMPAS_NIGHTS.max))
      );
      return false;
    }
    if (to < range.min || to > range.max) {
      setNightsError(
        t("supplier.validation.nights_range", locale)
          .replace("{min}", String(range.min))
          .replace("{max}", String(range.max))
      );
      return false;
    }
    setNightsError(null);
    return true;
  }, [locale]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateNights(nightsFrom, nightsTo)) return;

      onSearch({
        supplierCode,
        departureCity,
        destination: destination || undefined,
        departureDateFrom: departureDate || undefined,
        departureDateTo: departureDate || undefined,
        nightsFrom,
        nightsTo,
        adults,
        children: children || undefined,
        hotel: hotel || undefined,
        meal: meal || undefined,
      });
    },
    [departureCity, destination, departureDate, nightsFrom, nightsTo, adults, children, hotel, meal, supplierCode, onSearch, validateNights],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nights */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          {t("supplier.filter.nights", locale)}
        </label>
        <div className="flex items-center gap-2">
          <select
            value={nightsFrom}
            onChange={(e) => {
              const v = Number(e.target.value);
              setNightsFrom(v);
              validateNights(v, nightsTo);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {Array.from({ length: range.nights.max - range.nights.min + 1 }, (_, i) => range.nights.min + i).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span className="text-slate-400">—</span>
          <select
            value={nightsTo}
            onChange={(e) => {
              const v = Number(e.target.value);
              setNightsTo(v);
              validateNights(nightsFrom, v);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {Array.from({ length: range.nights.max - range.nights.min + 1 }, (_, i) => range.nights.min + i).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        {nightsError && (
          <p className="text-xs text-red-600">{nightsError}</p>
        )}
      </div>

      {/* Departure date */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          {t("search.date", locale)}
        </label>
        <input
          type="date"
          value={departureDate}
          onChange={(e) => setDepartureDate(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      {/* Adults */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          {t("supplier.filter.adults", locale)}
        </label>
        <select
          value={adults}
          onChange={(e) => setAdults(Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {Array.from({ length: KOMPAS_ADULTS.max - KOMPAS_ADULTS.min + 1 }, (_, i) => KOMPAS_ADULTS.min + i).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Children */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          {t("supplier.filter.children", locale)}
        </label>
        <select
          value={children}
          onChange={(e) => setChildren(Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {Array.from({ length: KOMPAS_CHILDREN.max - KOMPAS_CHILDREN.min + 1 }, (_, i) => KOMPAS_CHILDREN.min + i).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Destination */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          {t("supplier.filter.destination", locale)}
        </label>
        <select
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">—</option>
          <option value="turkey">Turkey</option>
          {/* Additional destinations would be discovered from KOMPAS live */}
        </select>
      </div>

      {/* Meal */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">
          {t("supplier.filter.meal", locale)}
        </label>
        <select
          value={meal}
          onChange={(e) => setMeal(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">—</option>
          <option value="RO">Room Only</option>
          <option value="BB">Breakfast</option>
          <option value="HB">Half Board</option>
          <option value="FB">Full Board</option>
          <option value="AI">All Inclusive</option>
        </select>
      </div>

      {/* Search button */}
      <button
        type="submit"
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        {t("supplier.search", locale)}
      </button>
    </form>
  );
}
