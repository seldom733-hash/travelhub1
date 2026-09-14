"use client";

import { useState, useCallback, useMemo } from "react";
import { t, useLocale, formatPrice } from "@/lib/i18n";
import { publicSupplierApi, type PriceCalendarResult } from "@/lib/public-api";

interface PriceConfiguratorProps {
  productCode: string;
  productAttributes: Record<string, unknown> | null;
  onCalendarLoaded: (result: PriceCalendarResult) => void;
}

interface ConfigState {
  room: string;
  meal: string;
  adults: number;
  children: number;
  childAges: number[];
  nights: number;
}

const NIGHT_OPTIONS = [7, 8, 9, 10, 11, 12, 13, 14];

export default function PriceConfigurator({ productCode, productAttributes, onCalendarLoaded }: PriceConfiguratorProps) {
  const locale = useLocale();
  const [config, setConfig] = useState<ConfigState>(() => {
    // Initialize from product attributes if available
    const attrs = productAttributes ?? {};
    return {
      room: (attrs.room as string) ?? "",
      meal: (attrs.meal as string) ?? "",
      adults: 2,
      children: 0,
      childAges: [],
      nights: (attrs.days as number) ?? 7,
    };
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastContextHash, setLastContextHash] = useState<string | null>(null);

  // Extract available rooms/meals from attributes
  const availableRooms = useMemo(() => {
    const rooms = productAttributes?.rooms;
    if (Array.isArray(rooms)) return rooms as string[];
    if (typeof rooms === "string") return rooms.split(",").map((s) => s.trim());
    return [];
  }, [productAttributes]);

  const availableMeals = useMemo(() => {
    const meals = productAttributes?.meals;
    if (Array.isArray(meals)) return meals as string[];
    if (typeof meals === "string") return meals.split(",").map((s) => s.trim());
    return [];
  }, [productAttributes]);

  const hotel = useMemo(() => {
    return (productAttributes?.hotel as string) ?? "";
  }, [productAttributes]);

  const hotelExternalId = useMemo(() => {
    return (productAttributes?.hotelKey as string) ?? (productAttributes?.rawHotelKey as string) ?? "";
  }, [productAttributes]);

  const tourKey = useMemo(() => {
    return (productAttributes?.tourKey as string) ?? (productAttributes?.rawTourKey as string) ?? "";
  }, [productAttributes]);

  // Child ages management
  const updateChildAge = useCallback((index: number, age: number) => {
    setConfig((prev) => {
      const newAges = [...prev.childAges];
      newAges[index] = age;
      return { ...prev, childAges: newAges };
    });
  }, []);

  const addChild = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      children: prev.children + 1,
      childAges: [...prev.childAges, 5],
    }));
  }, []);

  const removeChild = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      children: Math.max(0, prev.children - 1),
      childAges: prev.childAges.slice(0, -1),
    }));
  }, []);

  // Context hash for invalidation detection
  const contextHash = useMemo(() => {
    return JSON.stringify({
      hotel: config.room,
      meal: config.meal,
      adults: config.adults,
      children: config.children,
      childAges: config.childAges,
      nights: config.nights,
    });
  }, [config]);

  const isConfigChanged = lastContextHash !== null && contextHash !== lastContextHash;

  // "Уточнить цену" handler
  const handlePriceQuery = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Date range: next 6 months from today
      const now = new Date();
      const dateFrom = now.toISOString().split("T")[0];
      const futureDate = new Date(now);
      futureDate.setMonth(futureDate.getMonth() + 6);
      const dateTo = futureDate.toISOString().split("T")[0];

      const result = await publicSupplierApi.getPriceCalendar({
        supplierCode: "SUMMERTOUR",
        productId: productCode,
        hotel,
        hotelExternalId,
        room: config.room || undefined,
        meal: config.meal || undefined,
        adults: config.adults,
        children: config.children,
        childAges: config.childAges,
        nights: config.nights,
        dateFrom,
        dateTo,
      });

      setLastContextHash(contextHash);
      onCalendarLoaded(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("circuit is OPEN") || msg.includes("unavailable")) {
        setError(t("configurator.supplier_unavailable", locale));
      } else {
        setError(t("configurator.price_error", locale));
      }
    } finally {
      setLoading(false);
    }
  }, [config, productCode, hotel, hotelExternalId, contextHash, locale, onCalendarLoaded]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-bold text-slate-900">{t("configurator.title", locale)}</h3>

      {/* Room */}
      {availableRooms.length > 0 && (
        <div className="mt-3">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("configurator.room", locale)}</label>
          <select
            value={config.room}
            onChange={(e) => setConfig((p) => ({ ...p, room: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">{t("configurator.any", locale)}</option>
            {availableRooms.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      )}

      {/* Meal */}
      {availableMeals.length > 0 && (
        <div className="mt-3">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("configurator.meal", locale)}</label>
          <select
            value={config.meal}
            onChange={(e) => setConfig((p) => ({ ...p, meal: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">{t("configurator.any", locale)}</option>
            {availableMeals.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}

      {/* Adults */}
      <div className="mt-3">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("configurator.adults", locale)}</label>
        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setConfig((p) => ({ ...p, adults: Math.max(1, p.adults - 1) }))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            −
          </button>
          <span className="min-w-[2ch] text-center text-sm font-semibold text-slate-800">{config.adults}</span>
          <button
            type="button"
            onClick={() => setConfig((p) => ({ ...p, adults: Math.min(9, p.adults + 1) }))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            +
          </button>
        </div>
      </div>

      {/* Children */}
      <div className="mt-3">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("configurator.children", locale)}</label>
        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={removeChild}
            disabled={config.children === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-[2ch] text-center text-sm font-semibold text-slate-800">{config.children}</span>
          <button
            type="button"
            onClick={addChild}
            disabled={config.children >= 4}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {/* Child Ages */}
      {config.children > 0 && (
        <div className="mt-2 rounded-lg bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-500">{t("configurator.child_ages", locale)}</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {config.childAges.map((age, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-[11px] text-slate-400">Ребёнок {i + 1}:</span>
                <select
                  value={age}
                  onChange={(e) => updateChildAge(i, parseInt(e.target.value, 10))}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                >
                  {Array.from({ length: 18 }, (_, i) => i).map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nights */}
      <div className="mt-3">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-400">{t("configurator.nights", locale)}</label>
        <select
          value={config.nights}
          onChange={(e) => setConfig((p) => ({ ...p, nights: parseInt(e.target.value, 10) }))}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          {NIGHT_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</div>
      )}

      {/* Config changed warning */}
      {isConfigChanged && !loading && (
        <div className="mt-2 text-[11px] text-amber-600">{t("configurator.config_changed", locale)}</div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handlePriceQuery}
        disabled={loading}
        className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {t("configurator.loading", locale)}
          </span>
        ) : (
          t("configurator.check_price", locale)
        )}
      </button>

      <p className="mt-2 text-[11px] text-slate-400">{t("configurator.supplier_attribution", locale)}</p>
    </div>
  );
}
