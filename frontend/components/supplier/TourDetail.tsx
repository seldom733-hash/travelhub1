"use client";

import { useState, useCallback } from "react";
import { t, useLocale } from "@/lib/i18n";
import MonthlyCalendar from "@/components/supplier/MonthlyCalendar";
import OfferModal from "@/components/supplier/OfferModal";
import {
  type SupplierPriceCalendarEntryOffer,
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
  media,
  description,
  attributeSections,
}: {
  attributes: Record<string, unknown> | null;
  title: string;
  media?: React.ReactNode;
  description?: string | null;
  attributeSections?: Array<{ section: string; items: Array<{ key: string; label: string; value: string }> }>;
}) {
  const locale = useLocale();
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

  // Product identity — KOMPAS live ingestion stores tourKey (e.g. 3332) as tourKey/stateInc; use it as tourIncValue
  const hotelExternalId = (attributes?.hotelExternalId as string) ?? (attributes?.hotelKey as string) ?? undefined;
  const tourIncValue =
    (attributes?.tourIncValue as string) ??
    (attributes?.programIncValue as string) ??
    (attributes?.tourKey as string) ??
    undefined;
  const tourIncName = (attributes?.tourIncName as string) ?? (attributes?.programIncName as string) ?? undefined;
  const hotelName = title;

  // Strip location suffix like "(Султанахмет)" from hotel name for KOMPAS queries
  const cleanHotelName = hotelName?.replace(/\s*\(.*?\)\s*$/, "").replace(/\s*\r?\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();

  // Build calendar query — dates are derived per-month inside MonthlyCalendar; only context here.
  const calendarQuery = {
    supplierCode: ((attributes?.supplierCode as string) ?? "KOMPAS") as "KOMPAS" | "SUMMERTOUR",
    hotelExternalId,
    hotel: cleanHotelName,
    destination,
    departureCity,
    tourIncValue,
    tourIncName,
    nights,
    adults,
    children: children || undefined,
    childAges: childAges.length > 0 ? childAges : undefined,
  };

  // Handle calendar date click
  const handleCalendarSelect = useCallback((entry: SupplierPriceCalendarEntry) => {
    setSelectedEntry(entry);
    setModalOpen(true);
  }, []);



  // Handle request creation
  const handleRequestCreated = useCallback((offer: SupplierPriceCalendarEntryOffer) => {
    console.log("[TourDetail] Request created for offer:", offer.externalOfferId);
    setModalOpen(false);
  }, []);

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
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
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
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
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
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {[0, 1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n === 0
                      ? "Нет детей"
                      : n === 1
                        ? "1 ребёнок"
                        : n === 2
                          ? "2 детей"
                          : "3 детей"}
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
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
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
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {Array.from({ length: 12 }, (_, i) => i + 3).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "ночь" : n < 5 ? "ночи" : "ночей"}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Monthly Calendar — monthly cache, lastUpdated + Обновить цены */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              {t("tour.calendar_title", locale) ?? "Календарь цен"}
            </h3>
            <MonthlyCalendar query={calendarQuery} onSelect={handleCalendarSelect} />
          </div>
        </div>

        {/* ── Right: Hotel Info + Photo + Description ── */}
        <div className="space-y-4">

          {/* Main hotel photo */}
          {media}

          {/* Hotel info */}
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

          {/* Description */}
          {description && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h4 className="text-sm font-semibold text-slate-800">
                {t("pdp.description_title", locale)}
              </h4>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {description}
              </p>
            </div>
          )}

          {/* Attributes */}
          {attributeSections && attributeSections.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h4 className="text-sm font-semibold text-slate-800">
                {t("pdp.attributes_title", locale)}
              </h4>
              <div className="mt-3 space-y-3">
                {attributeSections.map((s) => (
                  <div key={s.section}>
                    <h5 className="text-xs font-medium text-slate-500">{s.section}</h5>
                    <dl className="mt-1 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                      {s.items.map((i) => (
                        <div key={i.key} className="flex flex-col">
                          <dt className="text-[10px] uppercase tracking-wide text-slate-400">{i.label}</dt>
                          <dd className="whitespace-pre-line text-slate-700">{i.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
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
