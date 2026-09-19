"use client";

import { useState, useCallback } from "react";
import { t, useLocale } from "@/lib/i18n";
import type { SupplierSearchQuery } from "@/lib/supplier-api";

/**
 * KOMPAS-verified parameter ranges.
 * These are the ONLY values the adapter accepts.
 * Values outside these ranges cause explicit rejection.
 */
const KOMPAS_NIGHTS = { min: 3, max: 14 } as const;
const KOMPAS_ADULTS = { min: 1, max: 4 } as const;
const KOMPAS_CHILDREN = { min: 0, max: 1 } as const;

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

  const [departureCity, setDepartureCity] = useState(initial?.departureCity ?? "1411");
  const [destination, setDestination] = useState(initial?.destination ?? "");
  const [nightsFrom, setNightsFrom] = useState(initial?.nightsFrom ?? 7);
  const [nightsTo, setNightsTo] = useState(initial?.nightsTo ?? 7);
  const [adults, setAdults] = useState(initial?.adults ?? 2);
  const [children, setChildren] = useState(initial?.children ?? 0);
  const [hotel, setHotel] = useState(initial?.hotel ?? "");
  const [meal, setMeal] = useState(initial?.meal ?? "");
  const [nightsError, setNightsError] = useState<string | null>(null);

  const validateNights = useCallback((from: number, to: number): boolean => {
    if (from < KOMPAS_NIGHTS.min || from > KOMPAS_NIGHTS.max) {
      setNightsError(
        t("supplier.validation.nights_range", locale)
          .replace("{min}", String(KOMPAS_NIGHTS.min))
          .replace("{max}", String(KOMPAS_NIGHTS.max))
      );
      return false;
    }
    if (to < KOMPAS_NIGHTS.min || to > KOMPAS_NIGHTS.max) {
      setNightsError(
        t("supplier.validation.nights_range", locale)
          .replace("{min}", String(KOMPAS_NIGHTS.min))
          .replace("{max}", String(KOMPAS_NIGHTS.max))
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
        nightsFrom,
        nightsTo,
        adults,
        children: children || undefined,
        hotel: hotel || undefined,
        meal: meal || undefined,
      });
    },
    [departureCity, destination, nightsFrom, nightsTo, adults, children, hotel, meal, supplierCode, onSearch, validateNights],
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
            {Array.from({ length: KOMPAS_NIGHTS.max - KOMPAS_NIGHTS.min + 1 }, (_, i) => KOMPAS_NIGHTS.min + i).map((n) => (
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
            {Array.from({ length: KOMPAS_NIGHTS.max - KOMPAS_NIGHTS.min + 1 }, (_, i) => KOMPAS_NIGHTS.min + i).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        {nightsError && (
          <p className="text-xs text-red-600">{nightsError}</p>
        )}
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
