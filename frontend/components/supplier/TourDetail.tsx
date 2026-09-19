"use client";

import { useState, useCallback, useEffect } from "react";
import { t, useLocale } from "@/lib/i18n";
import MonthlyCalendar from "@/components/supplier/MonthlyCalendar";
import OfferModal from "@/components/supplier/OfferModal";
import {
  searchSupplierOffers,
  type SupplierOffer,
  type SupplierSearchQuery,
  type SupplierPriceCalendarEntry,
} from "@/lib/supplier-api";

/**
 * TourDetail — live KOMPAS integration with left-side tour selection panel.
 *
 * Layout:
 * - Left: tour selection (city, adults, children, nights, calendar)
 * - Right: hotel info / description
 *
 * Uses product attributes to pre-fill filters and query KOMPAS.
 */
export default function TourDetail({
  attributes,
  title,
}: {
  attributes: Record<string, unknown> | null;
  title: string;
}) {
  const locale = useLocale();
  const [offers, setOffers] = useState<SupplierOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<SupplierPriceCalendarEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Filter state
  const [departureCity, setDepartureCity] = useState(
    (attributes?.departureCity as string) ?? "1411",
  );
  const [destination, setDestination] = useState(
    (attributes?.destination as string) ?? (attributes?.country as string) ?? "",
  );
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);
  const [nights, setNights] = useState(7);

  // Product identity
  const hotelExternalId = (attributes?.hotelExternalId as string) ?? undefined;
  const hotelName = title;
  const tourIncValue = (attributes?.tourKey as string) ?? undefined;

  // Build calendar query
  const buildCalendarQuery = useCallback(
    (overrides?: Partial<SupplierSearchQuery>) => {
      const nowLocal = new Date();
      const today = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
      const dateTo = new Date(nowLocal.getTime() + 60 * 86400000)
        .toISOString()
        .slice(0, 10);

      return {
        supplierCode: "KOMPAS",
        hotel: hotelName?.replace(/\s*\r?\n\s*/g, " ").replace(/\s{2,}/g, " ").trim(),
        hotelExternalId,
        destination,
        dateFrom: today,
        dateTo,
        nights,
        adults,
        children: children || undefined,
        childAges: childAges.length > 0 ? childAges : undefined,
        tourIncValue,
        ...overrides,
      };
    },
    [hotelName, hotelExternalId, destination, nights, adults, children, childAges, tourIncValue],
  );

  // Auto-search on mount
  useEffect(() => {
    if (!hotelExternalId && !hotelName) return;
    let alive = true;
    setLoading(true);
    setError(null);

    searchSupplierOffers({
      supplierCode: "KOMPAS",
      hotel: hotelName,
      hotelExternalId,
      destination,
      departureCity,
      tourIncValue,
      adults,
      children,
      childAges: childAges.length > 0 ? childAges : undefined,
      nightsFrom: nights,
      nightsTo: nights,
    })
      .then((result) => {
        if (alive) {
          setOffers(result);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (alive) {
          const msg = (e as Error).message;
          if (msg.includes("supports nights") || msg.includes("UNSUPPORTED")) {
            setError(t("supplier.error.unsupported", locale));
          } else {
            setError(t("supplier.error.generic", locale));
          }
          setLoading(false);
        }
      });

    return () => { alive = false; };
  }, [hotelExternalId, hotelName, destination, departureCity, tourIncValue, adults, children, childAges, nights, locale]);

  // Handle calendar date click
  const handleCalendarSelect = useCallback((entry: SupplierPriceCalendarEntry) => {
    setSelectedEntry(entry);
    setModalOpen(true);
  }, []);

  // Handle filter change
  const handleFilterChange = useCallback(() => {
    // Re-trigger search with updated filters
    setLoading(true);
    setError(null);
    setOffers([]);

    searchSupplierOffers({
      supplierCode: "KOMPAS",
      hotel: hotelName,
      hotelExternalId,
      destination,
      departureCity,
      tourIncValue,
      adults,
      children,
      childAges: childAges.length > 0 ? childAges : undefined,
      nightsFrom: nights,
      nightsTo: nights,
    })
      .then((result) => {
        setOffers(result);
        setLoading(false);
      })
      .catch((e) => {
        const msg = (e as Error).message;
        if (msg.includes("supports nights") || msg.includes("UNSUPPORTED")) {
          setError(t("supplier.error.unsupported", locale));
        } else {
          setError(t("supplier.error.generic", locale));
        }
        setLoading(false);
      });
  }, [hotelName, hotelExternalId, destination, departureCity, tourIncValue, adults, children, childAges, nights, locale]);

  // Handle request creation
  const handleRequestCreated = useCallback((offer: SupplierOffer) => {
    console.log("[TourDetail] Request created for offer:", offer.externalOfferId);
    setModalOpen(false);
  }, []);

  const calendarQuery = buildCalendarQuery();

  return (
    <section className="mt-8" aria-labelledby="tour-detail-section">
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* ── Left: Tour Selection Panel ── */}
        <div className="space-y-4">
          <h2
            id="tour-detail-section"
            className="font-serif text-lg font-bold text-slate-900"
          >
            {t("tour.selection_title", locale) ?? "Подбор тура"}
          </h2>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            {/* Departure city */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-500">
                {t("tour.departure_city", locale) ?? "Город вылета"}
              </label>
              <select
                value={departureCity}
                onChange={(e) => setDepartureCity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="1411">Баку (GYD)</option>
              </select>
            </div>

            {/* Adults */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-500">
                {t("tour.adults", locale) ?? "Взрослые"}
              </label>
              <select
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "взрослый" : "взрослых"}
                  </option>
                ))}
              </select>
            </div>

            {/* Children */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-500">
                {t("tour.children", locale) ?? "Дети"}
              </label>
              <select
                value={children}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setChildren(v);
                  if (v === 0) setChildAges([]);
                  else if (childAges.length < v) {
                    setChildAges([...childAges, ...Array(v - childAges.length).fill(5)]);
                  } else {
                    setChildAges(childAges.slice(0, v));
                  }
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {[0, 1].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "Нет детей" : `${n} ребенок`}
                  </option>
                ))}
              </select>
            </div>

            {/* Child ages */}
            {children > 0 && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-500">
                  {t("tour.child_ages", locale) ?? "Возраст ребенка"}
                </label>
                {childAges.map((age, idx) => (
                  <select
                    key={idx}
                    value={age}
                    onChange={(e) => {
                      const newAges = [...childAges];
                      newAges[idx] = Number(e.target.value);
                      setChildAges(newAges);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {Array.from({ length: 15 }, (_, i) => i).map((a) => (
                      <option key={a} value={a}>
                        {a} {a === 1 ? "год" : a < 5 ? "года" : "лет"}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            )}

            {/* Nights */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-500">
                {t("tour.nights_count", locale) ?? "Количество ночей"}
              </label>
              <select
                value={nights}
                onChange={(e) => setNights(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 3).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "ночь" : n < 5 ? "ночи" : "ночей"}
                  </option>
                ))}
              </select>
            </div>

            {/* Search button */}
            <button
              onClick={handleFilterChange}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {t("supplier.search", locale) ?? "Найти варианты"}
            </button>
          </div>

          {/* Monthly Calendar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              {t("tour.calendar_title", locale) ?? "Календарь цен"}
            </h3>
            <MonthlyCalendar query={calendarQuery} onSelect={handleCalendarSelect} />
          </div>

          {/* Offer count */}
          {!loading && offers.length > 0 && (
            <div className="text-sm text-slate-500">
              {t("search.found", locale)}: {offers.length}{" "}
              {t("tour.offers_title", locale).toLowerCase()}
            </div>
          )}
        </div>

        {/* ── Right: Hotel Info ── */}
        <div className="space-y-4">
          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              {t("tour.loading", locale)}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">{error}</p>
            </div>
          )}

          {/* Hotel info placeholder */}
          {!loading && !error && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="font-serif text-xl font-bold text-slate-900">
                {hotelName}
              </h3>
              {destination && (
                <p className="mt-1 text-sm text-slate-500">📍 {destination}</p>
              )}
              {hotelExternalId && (
                <p className="mt-1 text-xs text-slate-400">
                  KOMPAS ID: {hotelExternalId}
                </p>
              )}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && offers.length === 0 && hotelExternalId && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">{t("tour.no_offers", locale)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Offer Modal */}
      {modalOpen && selectedEntry && (
        <OfferModal
          date={selectedEntry.date}
          offers={selectedEntry.offers}
          summary={{
            departureCity: departureCity === "1411" ? "Баку (GYD)" : departureCity,
            destination,
            adults,
            children,
            childAges,
            nights,
          }}
          onClose={() => setModalOpen(false)}
          onRequestCreated={handleRequestCreated}
        />
      )}
    </section>
  );
}
