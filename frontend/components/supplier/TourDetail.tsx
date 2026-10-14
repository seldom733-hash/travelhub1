"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { t, useLocale } from "@/lib/i18n";
import MonthlyCalendar from "@/components/supplier/MonthlyCalendar";
import DayTariffsPanel from "@/components/supplier/DayTariffsPanel";
import {
  type SupplierPriceCalendarEntry,
} from "@/lib/supplier-api";
import { useSupplierOptions } from "@/lib/supplier-registry";

/** Today as an ISO date string (local calendar day, not UTC). */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * TourDetail — live KOMPAS integration with left-side tour selection panel.
 *
 * Layout:
 * - Left: tour selection (city, adults, children, nights, calendar)
 * - Right: hotel info / description + INLINE day tariffs (no modal)
 *
 * Uses product attributes to pre-fill filters and query KOMPAS.
 *
 * The right column carries `DayTariffsPanel` — the inline replacement for the
 * §4.8 modal (user decision, 2026-10-13). The calendar's first priced day is
 * selected automatically, so the page opens on a usable tariff list.
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
  // Auto-select must only apply ONCE (the first month that yields data) — a
  // later user click or month change must never be overridden.
  const autoSelectedRef = useRef(false);

  // Supplier of THIS product: attribute first, registry fallback (§4.7 — no
  // hardcoded supplier default). The calendar only renders once resolved.
  const tourSuppliers = useSupplierOptions("tours");
  const supplierCode =
    (attributes?.supplierCode as string | undefined) || tourSuppliers[0]?.code || "";

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

  // Product identity — hotel keys pin the calendar to THIS hotel; the program
  // (tourIncValue) is deliberately NOT sent: supplier programs get re-numbered
  // and a stale id silently returns an empty calendar. «Любой» covers all
  // programs of the hotel (user decision, 2026-10-01).
  const hotelExternalId = (attributes?.hotelExternalId as string) ?? (attributes?.hotelKey as string) ?? undefined;
  const hotelName = title;

  // Strip location suffix like "(Султанахмет)" from hotel name for KOMPAS queries
  const cleanHotelName = hotelName?.replace(/\s*\(.*?\)\s*$/, "").replace(/\s*\r?\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();

  // Build calendar query — dates are derived per-month inside MonthlyCalendar; only context here.
  const calendarQuery = {
    supplierCode,
    hotelExternalId,
    hotel: cleanHotelName,
    destination,
    departureCity,
    nights,
    adults,
    children: children || undefined,
    childAges: childAges.length > 0 ? childAges : undefined,
  };

  // Handle calendar date click — inline panel, no modal.
  const handleCalendarSelect = useCallback((entry: SupplierPriceCalendarEntry) => {
    setSelectedEntry(entry);
  }, []);

  // §DEFAULT-NEAREST-DAY: pick the first priced day of the loaded month that
  // is not in the past. Falls back to the first priced day when the whole
  // month is behind us (defensive — calendars start at "tomorrow").
  const handleEntriesLoaded = useCallback((entries: SupplierPriceCalendarEntry[]) => {
    if (autoSelectedRef.current) return;
    const today = todayIso();
    const priced = entries.filter((e) => e.price !== null && e.availability !== "NOT_AVAILABLE");
    if (priced.length === 0) return;
    const nearest = priced.find((e) => e.date >= today) ?? priced[0];
    autoSelectedRef.current = true;
    setSelectedEntry(nearest);
  }, []);

  // Handle request creation (inline panel).
  const handleRequestCreated = useCallback((_offer: unknown) => {
    // Keep the panel open: the row already shows the success state with the
    // reference number (§4.8).
  }, []);

  // §4.8 context shared by every row of the day.
  const summary = useMemo(
    () => ({
      departureCity: departureCity === "1411" ? "Баку (GYD)" : departureCity,
      destination,
      country: (attributes?.country as string) || undefined,
      adults,
      children,
      childAges,
      nights,
    }),
    [departureCity, destination, attributes, adults, children, childAges, nights],
  );

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

          {/* Phase 4: explicit guidance — how to submit a request from this card */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
            <h3 className="text-sm font-semibold text-slate-800">
              {t("tour.howto_title", locale)}
            </h3>
            <ol className="mt-2 list-decimal list-inside space-y-1 text-xs leading-relaxed text-slate-600">
              <li>{t("tour.howto_step1", locale)}</li>
              <li>{t("tour.howto_step2", locale)}</li>
              <li>{t("tour.howto_step3", locale)}</li>
            </ol>
          </div>

          {/* Monthly Calendar — monthly cache, lastUpdated + Обновить цены */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              {t("tour.calendar_title", locale) ?? "Календарь цен"}
            </h3>
            {supplierCode ? (
              <MonthlyCalendar
                query={calendarQuery}
                onSelect={handleCalendarSelect}
                selectedDate={selectedEntry?.date ?? null}
                onEntriesLoaded={handleEntriesLoaded}
              />
            ) : null}
            <p className="mt-3 text-xs text-slate-500">
              {t("tour.calendar_hint", locale)}
            </p>
          </div>
        </div>

        {/* ── Right: Hotel Info + Photo + Description + Day Tariffs ── */}
        <div className="space-y-4">

          {/* Main hotel photo */}
          {media}

          {/* Inline day tariffs — the §4.8 modal replaced by an on-page panel */}
          <DayTariffsPanel
            entry={selectedEntry}
            title={title}
            supplierCode={supplierCode}
            summary={summary}
            onRequestCreated={handleRequestCreated}
          />

          {/* Hotel info */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="font-serif text-xl font-bold text-slate-900">
              {hotelName}
            </h3>
            {destination && (
              <p className="mt-1 text-sm text-slate-500">📍 {destination}</p>
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
    </section>
  );
}
