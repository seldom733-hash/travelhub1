"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { t, useLocale } from "@/lib/i18n";
import MonthlyCalendar from "@/components/supplier/MonthlyCalendar";
import DayTariffsPanel from "@/components/supplier/DayTariffsPanel";
import {
  type SupplierPriceCalendarEntry,
} from "@/lib/supplier-api";

/** Today as an ISO date string (local calendar day, not UTC). */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * HotelDetail — the tour PDP experience applied to a HOTEL product (user
 * decision, 2026-10-13: «давай с комбинируем страницы туров и отелей»).
 *
 * §HOTEL-PARITY (2026-10-15, «страница карточек отелей не одинакова с
 * карточками туров — сделай как в карточке туров»): this component deliberately
 * mirrors `TourDetail` block for block, so a hotel card and a tour card are
 * visually the same page:
 *
 *  - Left:  selection card (filters) → «Как подать заявку» howto → monthly
 *    price calendar.
 *  - Right: media → INLINE day tariffs (§4.8 modal replaced by an on-page
 *    panel) → info card → description → attributes.
 *
 * A hotel card used to show only a STATIC catalog tariff list (`p.tariffs`) —
 * which carries no dates and, in the real KOMPAS ingest, no validFrom/validTo
 * at all, so it could never answer «что стоит 12 ноября». Here the day tariffs
 * come from the live calendar (service="hotels", `country` resolves the
 * STATEINC — a hotel PDP carries the CITY in `destination`, and the hotel
 * dictionary only knows countries), defaulting to the nearest priced day.
 *
 * The only intentional difference from TourDetail: a stay has no departure
 * city and no TOURINC program, so the left panel starts at travelers.
 */
export default function HotelDetail({
  attributes,
  title,
  media,
  description,
  attributeSections,
  onRequestCreated,
}: {
  attributes: Record<string, unknown> | null;
  title: string;
  media?: React.ReactNode;
  description?: string | null;
  attributeSections?: Array<{ section: string; items: Array<{ key: string; label: string; value: string }> }>;
  onRequestCreated?: () => void;
}) {
  const locale = useLocale();
  const [selectedEntry, setSelectedEntry] = useState<SupplierPriceCalendarEntry | null>(null);
  // Auto-select must only apply ONCE (the first month that yields data) — a
  // later user click or month change must never be overridden.
  const autoSelectedRef = useRef(false);

  const supplierCode = (attributes?.supplierCode as string | undefined) ?? "KOMPAS";
  const hotelExternalId =
    (attributes?.hotelKey as string | undefined) ??
    (attributes?.hotelExternalId as string | undefined) ??
    undefined;
  const country = (attributes?.country as string | undefined) ?? "";
  const city = (attributes?.city as string | undefined) ?? "";

  // Filter state — stay-only: travelers + nights (no departure city).
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);
  const [nights, setNights] = useState(
    Number.isFinite(attributes?.nights as number) ? (attributes!.nights as number) : 7,
  );

  const calendarQuery = useMemo(
    () => ({
      supplierCode,
      service: "hotels",
      hotelExternalId,
      // `country` drives STATEINC; `destination` stays for display only.
      country: country || undefined,
      destination: country || undefined,
      nights,
      adults,
      children: children || undefined,
      childAges: childAges.length > 0 ? childAges : undefined,
    }),
    [supplierCode, hotelExternalId, country, nights, adults, children, childAges],
  );

  // Handle calendar date click — inline panel, no modal.
  const handleCalendarSelect = useCallback((entry: SupplierPriceCalendarEntry) => {
    setSelectedEntry(entry);
  }, []);

  // §DEFAULT-NEAREST-DAY: the page opens on the first priced day of the month
  // that is not in the past.
  const handleEntriesLoaded = useCallback((entries: SupplierPriceCalendarEntry[]) => {
    if (autoSelectedRef.current) return;
    const today = todayIso();
    const priced = entries.filter((e) => e.price !== null && e.availability !== "NOT_AVAILABLE");
    if (priced.length === 0) return;
    const nearest = priced.find((e) => e.date >= today) ?? priced[0];
    autoSelectedRef.current = true;
    setSelectedEntry(nearest);
  }, []);

  // §4.8 context shared by every row of the day.
  const summary = useMemo(
    () => ({
      destination: city || undefined,
      country: country || undefined,
      adults,
      children,
      childAges,
      nights,
    }),
    [city, country, adults, children, childAges, nights],
  );

  return (
    <section className="mt-8" aria-labelledby="hotel-detail-section">
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* ── Left: Hotel Selection Panel ── */}
        <div className="space-y-4">
          <h2
            id="hotel-detail-section"
            className="font-serif text-lg font-bold text-slate-900"
          >
            {t("hotel.selection_title", locale) ?? "Подбор номера"}
          </h2>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
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
                {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "ночь" : n < 5 ? "ночи" : "ночей"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Explicit guidance — same block as the tour card */}
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

          {/* Monthly Calendar — same component/caching as the tour PDP */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              {t("tour.calendar_title", locale) ?? "Календарь цен"}
            </h3>
            <MonthlyCalendar
              query={calendarQuery}
              onSelect={handleCalendarSelect}
              selectedDate={selectedEntry?.date ?? null}
              onEntriesLoaded={handleEntriesLoaded}
            />
            <p className="mt-3 text-xs text-slate-500">
              {t("tour.calendar_hint", locale)}
            </p>
          </div>
        </div>

        {/* ── Right: Photo + Day Tariffs + Info + Description ── */}
        <div className="space-y-4">
          {/* Main hotel photo */}
          {media}

          {/* Inline day tariffs — the §4.8 modal replaced by an on-page panel */}
          <DayTariffsPanel
            entry={selectedEntry}
            title={title}
            supplierCode={supplierCode}
            summary={summary}
            service="hotels"
            onRequestCreated={onRequestCreated ? () => onRequestCreated() : undefined}
          />

          {/* Hotel info */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="font-serif text-xl font-bold text-slate-900">{title}</h3>
            {(city || country) && (
              <p className="mt-1 text-sm text-slate-500">
                📍 {[city, country].filter(Boolean).join(", ")}
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
    </section>
  );
}
