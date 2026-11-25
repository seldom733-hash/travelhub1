"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { t, useLocale } from "@/lib/i18n";
import MonthlyCalendar from "@/components/supplier/MonthlyCalendar";
import DayTariffsPanel from "@/components/supplier/DayTariffsPanel";
import ServiceFacts from "@/components/supplier/ServiceFacts";
import {
  type SupplierPriceCalendarEntry,
} from "@/lib/supplier-api";
import { useSupplierOptions } from "@/lib/supplier-registry";
import { sx } from "@/lib/supplier-labels";
import { displayTourName } from "@/lib/supplier-labels";

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
}: {
  attributes: Record<string, unknown> | null;
  title: string;
  media?: React.ReactNode;
  description?: string | null;
  attributeSections?: Array<{ section: string; items: Array<{ key: string; label: string; value: string }> }>;
}) {
  const locale = useLocale();
  const displayTitle = displayTourName(title);
  const availableDates = Array.isArray(attributes?.availableDates)
    ? (attributes.availableDates as unknown[])
        .filter((value): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value))
        .sort()
    : [];
  const initialPriceDate =
    (attributes?.priceDate as string | undefined) || availableDates[0] || null;
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
  const [destination, setDestination] = useState(() => {
    const direct = (attributes?.destination as string | undefined) || (attributes?.city as string | undefined);
    if (direct) return direct;
    // Product cards often carry only tourIncName ("Istanbul 2026-2027 GDS")
    // or the destination in the title after an em dash; the country is not a
    // valid supplier destination (it makes Summertour return zero calendar days).
    const source = String(attributes?.tourIncName ?? "") || title;
    const city = source
      .split("—")
      .pop()
      ?.replace(/\s*\b20\d{2}.*$/, "")
      .replace(/\s*\(.*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    return city || (attributes?.country as string) || "";
  });
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [childAges, setChildAges] = useState<number[]>([]);
  const [infants, setInfants] = useState(0);
  const [infantAges, setInfantAges] = useState<number[]>([]);
  const [nights, setNights] = useState(() => {
    // Prefer the nearest-price night count saved by the catalog sync, then the
    // supplier card value. ANEX starts at 2 nights; the select mirrors the
    // supplier range 2..28.
    const raw = Number(attributes?.priceNights ?? attributes?.nights);
    const n = Number.isFinite(raw) && raw >= 1 ? Math.round(raw) : 7;
    return Math.min(28, Math.max(2, n));
  });

  // Product identity — hotel keys pin the calendar to THIS hotel; the program
  // (tourIncValue) is deliberately NOT sent: supplier programs get re-numbered
  // and a stale id silently returns an empty calendar. «Любой» covers all
  // programs of the hotel (user decision, 2026-10-01).
  const hotelExternalId = (attributes?.hotelExternalId as string) ?? (attributes?.hotelKey as string) ?? undefined;
  const hotelName = (attributes?.hotelName as string | undefined) || title;

  // Strip location/program suffix from the hotel name for supplier queries.
  const cleanHotelName = hotelName
    ?.split(" / — ")[0]
    .split(" — ")[0]
    .replace(/\s*\(\s*[^)]*\)\s*$/, "")
    .replace(/\s*\/\s*\d+\s*\*?\s*$/, "")
    .replace(/\s*\r?\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // GDS programs need the exact program for the AZAL add-on; regular Summer
  // products must NOT pin a program — otherwise a stale/second program hides
  // the hotel's earlier season dates (e.g. May while the program starts June).
  const storedTourInc = String(
    (attributes?.tourIncValue as string | undefined) ??
      (attributes?.tourInc as string | undefined) ??
      "",
  ).trim();
  const isGdsProgram = storedTourInc === "256" || storedTourInc === "238";

  // Build calendar query — dates are derived per-month inside MonthlyCalendar;
  // keep the object stable across parent re-renders, otherwise every render
  // changes fetchMonth()/baseQuery and re-downloads the same month.
  const calendarQuery = useMemo(
    () => ({
      supplierCode,
      hotelExternalId,
      hotel: cleanHotelName,
      destination,
      // Ключевое поле для VOYAGER/KOMPAS: адаптер сопоставляет страну со своим
      // STATEINC. В `destination` карточки лежит supplier-native id программы
      // ("2676"), который НЕ является страной — без country календарь пуст.
      country: (attributes?.countryCode as string) || (attributes?.country as string) || undefined,
      departureCity,
      nights,
      adults,
      children: children || undefined,
      childAges: childAges.length > 0 ? childAges : undefined,
      infants: infants || undefined,
      infantAges: infantAges.length > 0 ? infantAges : undefined,
      tourIncValue: isGdsProgram ? storedTourInc : undefined,
      tourIncName: isGdsProgram ? (attributes?.tourIncName as string | undefined) : undefined,
    }),
    [
      supplierCode,
      hotelExternalId,
      cleanHotelName,
      destination,
      departureCity,
      nights,
      adults,
      children,
      childAges,
      infants,
      infantAges,
      isGdsProgram,
      storedTourInc,
      attributes?.tourIncName,
    ],
  );

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
      departureCity: departureCity === "1411" ? `${sx(locale, "Баку", "Bakı", "Baku")} (GYD)` : departureCity,
      destination,
      country: (attributes?.country as string) || undefined,
      adults,
      children,
      childAges,
      infants,
      infantAges,
      nights,
    }),
    [departureCity, destination, attributes, adults, children, childAges, infants, infantAges, nights, locale],
  );

  return (
    <section className="mt-8" aria-labelledby="tour-detail-section">
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* ── Left: Tour Selection Panel ── */}
        <div className="space-y-4">
          <h2
            id="tour-detail-section"
            className="font-serif text-lg font-bold text-ink"
          >
            {t("tour.selection_title", locale) ?? "Подбор тура"}
          </h2>

          <div className="rounded-2xl border border-line bg-white p-5 space-y-4">
            {/* Departure city */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-ink/60">
                {t("tour.departure_city", locale) ?? "Город вылета"}
              </label>
              <select
                value={departureCity}
                onChange={(e) => setDepartureCity(e.target.value)}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
              >
                <option value="1411">{sx(locale, "Баку", "Bakı", "Baku")} (GYD)</option>
              </select>
            </div>

            {/* Adults */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-ink/60">
                {t("tour.adults", locale) ?? "Взрослые"}
              </label>
              <select
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} {sx(locale, "взрослых", "yetkin", "adults")}
                  </option>
                ))}
              </select>
            </div>

            {/* Children */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-ink/60">
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
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
              >
                {[0, 1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n === 0
                      ? sx(locale, "Нет детей", "Uşaq yoxdur", "No children")
                      : `${n} ${sx(locale, "детей", "uşaq", "children")}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Child ages */}
            {children > 0 && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-ink/60">
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
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
                  >
                    {Array.from({ length: 11 }, (_, i) => i + 2).map((a) => (
                      <option key={a} value={a}>
                        {a} {sx(locale, "лет", "yaş", "years")}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            )}

            {/* Infants */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-ink/60">
                {t("tour.infants", locale) ?? "Младенцы"}
              </label>
              <select
                value={infants}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setInfants(v);
                  if (v === 0) setInfantAges([]);
                  else if (infantAges.length < v) setInfantAges([...infantAges, ...Array(v - infantAges.length).fill(0)]);
                  else setInfantAges(infantAges.slice(0, v));
                }}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
              >
                {[0, 1, 2].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? sx(locale, "Нет младенцев", "Körpə yoxdur", "No infants") : `${n} ${sx(locale, "младенцев", "körpə", "infants")}`}
                  </option>
                ))}
              </select>
            </div>

            {infants > 0 && (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-ink/60">
                  {t("tour.infant_ages", locale) ?? "Возраст младенца"}
                </label>
                {infantAges.map((age, idx) => (
                  <select
                    key={idx}
                    value={age}
                    onChange={(e) => {
                      const next = [...infantAges];
                      next[idx] = Number(e.target.value);
                      setInfantAges(next);
                    }}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
                  >
                    {[0, 1, 2].map((a) => <option key={a} value={a}>{a} {sx(locale, "лет", "yaş", "years")}</option>)}
                  </select>
                ))}
              </div>
            )}

            {/* Nights */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-ink/60">
                {t("tour.nights_count", locale) ?? "Количество ночей"}
              </label>
              <select
                value={nights}
                onChange={(e) => setNights(Number(e.target.value))}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
              >
                {Array.from({ length: 27 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    {n} {sx(locale, "ночей", "gecə", "nights")}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Phase 4: explicit guidance — how to submit a request from this card */}
          <div className="rounded-2xl border border-brand/15 bg-brand/70 p-5">
            <h3 className="text-sm font-semibold text-ink">
              {t("tour.howto_title", locale)}
            </h3>
            <ol className="mt-2 list-decimal list-inside space-y-1 text-xs leading-relaxed text-ink/60">
              <li>{t("tour.howto_step1", locale)}</li>
              <li>{t("tour.howto_step2", locale)}</li>
              <li>{t("tour.howto_step3", locale)}</li>
            </ol>
          </div>

          {/* Monthly Calendar — monthly cache, lastUpdated + Обновить цены */}
          <div className="rounded-2xl border border-line bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink">
              {t("tour.calendar_title", locale) ?? "Календарь цен"}
            </h3>
            {supplierCode ? (
              <MonthlyCalendar
                query={calendarQuery}
                onSelect={handleCalendarSelect}
                selectedDate={selectedEntry?.date ?? null}
                onEntriesLoaded={handleEntriesLoaded}
                initialMonth={initialPriceDate}
              />
            ) : null}
            <p className="mt-3 text-xs text-ink/60">
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
            title={displayTitle}
            supplierCode={supplierCode}
            summary={summary}
            onRequestCreated={handleRequestCreated}
          />

          {/* Hotel info */}
          <div className="rounded-2xl border border-line bg-white p-6">
            <h3 className="font-serif text-xl font-bold text-ink">
              {displayTourName(hotelName)}
            </h3>
            {destination && (
              <p className="mt-1 text-sm text-ink/60">📍 {destination}</p>
            )}
          </div>

          {/* Description */}
          {description && (
            <div className="rounded-2xl border border-line bg-white p-6">
              <h4 className="text-sm font-semibold text-ink">
                {t("pdp.description_title", locale)}
              </h4>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/60">
                {description}
              </p>
            </div>
          )}

          {/* Service facts — human-readable, no technical attribute codes */}
          {selectedEntry && (
            <ServiceFacts
              country={(attributes?.country as string) || null}
              city={summary.destination}
              date={selectedEntry.date}
              nights={nights}
              adults={adults}
              children={children}
              offers={selectedEntry.offers}
              price={selectedEntry.price}
              currency={selectedEntry.currency}
            />
          )}


        </div>
      </div>
    </section>
  );
}
