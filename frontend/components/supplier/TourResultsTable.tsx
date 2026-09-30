"use client";

import { useMemo, useState, type ReactNode } from "react";
import { t, useLocale } from "@/lib/i18n";
import Price from "@/components/public/Price";
import OfferDetailsModal from "@/components/supplier/OfferDetailsModal";
import type { AggregatedOffer, AggregatedSearchResult } from "@/lib/supplier-api";

/**
 * TourResultsTable — universal live tour search results (Summer + KOMPAS).
 *
 * One table (§6): date / nights / hotel / meal / room-accommodation / price /
 * source. Every column header is sortable (click toggles direction, the active
 * column shows a gold ▲/▼ marker) and carries its own filter control directly
 * in the header row — no separate filter toolbar. Prices render gold.
 */

type SortKey = "date" | "nights" | "hotel" | "stars" | "meal" | "room" | "price" | "source";
type SortDir = "asc" | "desc";

const SUPPLIER_LABELS: Record<string, string> = {
  KOMPAS: "Компас",
  SUMMERTOUR: "Summer",
  KAZUNION: "KazUnion",
  ANEX: "ANEX",
};

/** Hotel-category token ("3*", "4*+") parsed from the hotel name; "" = unknown. */
const starOf = (hotel?: string): string => {
  const m = (hotel ?? "").match(/([1-5])\s*(\*\+?)/);
  return m ? `${m[1]}${m[2]}` : "";
};

/**
 * Hotel-category token from supplier row metadata — fallback when the hotel
 * NAME carries no star (ANEX: 499/502 names are bare like «Consul Hotel»).
 * ANEX groupStarName is already canonical ("3*"); starName ("3 ***") is the
 * raw dictionary label. Non-star labels ("SPECIAL CLASS", "???") → "".
 */
const starOfMeta = (raw?: Record<string, unknown>): string => {
  const pick = (v: unknown): string => {
    if (typeof v !== "string") return "";
    const m = v.match(/([1-5])\s*\*+/);
    return m ? `${m[1]}*` : "";
  };
  return pick(raw?.groupStarName) || pick(raw?.starName);
};

/** Best hotel-category token: name parse first, supplier metadata fallback. */
const offerStar = (o: Pick<AggregatedOffer, "hotel" | "rawMetadata">): string =>
  starOf(o.hotel) || starOfMeta(o.rawMetadata);

/**
 * Meal plan normalization: supplier variants («RO», «Room Only», «Only Room»,
 * «BB», «Bed & Breakfast», …) collapse to the canonical short code (RO, BB,
 * HB, FB, AI, UAI…). Unknown plans pass through unchanged (whitespace-cleaned).
 */
const MEAL_ALIASES: Array<[RegExp, string]> = [
  [/^(room\s*only|only\s*room|без\s*питания|without\s*meals?)$/i, "RO"],
  [/^(bed(\s*&|\s*and)?\s*breakfast|завтрак)$/i, "BB"],
  [/^(half\s*board|полупансион)$/i, "HB"],
  [/^(full\s*board|пансион|полный\s*пансион)$/i, "FB"],
  [/^(all\s*inclusive|всё\s*включено|все\s*включено)$/i, "AI"],
  [/^(ultra\s*(all\s*inclusive)?|ультра\s*(всё|все)\s*включено)$/i, "UAI"],
  [/^(breakfast\s*\+?\s*(and|&)?\s*dinner)$/i, "HB"],
];
export function normalizeMeal(meal?: string): string {
  const s = (meal ?? "").replace(/\s*\r?\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  if (!s) return "";
  // Exact short-code already (RO/BB/HB/FB/AI/UAI with optional suffixes like "AI + All Inclusive").
  const short = s.match(/^(RO|BB|HB|FB|AI|UAI)\b/i);
  if (short) return short[1].toUpperCase();
  for (const [re, code] of MEAL_ALIASES) {
    if (re.test(s)) return code;
  }
  return s;
}

/**
 * Room type normalization. Bare room-class words get the « ROOM» suffix and
 * variant spellings collapse (STANDART→STANDARD): «Standart», «STANDART ROOM»
 * and «Standard Room» become one value; «ECONOMY»/«ECO» → «ECONOMY ROOM»;
 * «DELUXE» → «DELUXE ROOM»; «FAMILY» → «FAMILY ROOM». Detailed values
 * ("DELUXE SEA VIEW / DBL") are only uppercased with collapsed whitespace —
 * no invented text.
 */
const ROOM_CANONICAL: Record<string, string> = {
  STANDARD: "STANDARD ROOM",
  STANDART: "STANDARD ROOM",
  DELUXE: "DELUXE ROOM",
  FAMILY: "FAMILY ROOM",
  ECONOMY: "ECONOMY ROOM",
  ECO: "ECONOMY ROOM",
  ECONOM: "ECONOMY ROOM",
  SUITE: "SUITE ROOM",
  STUDIO: "STUDIO ROOM",
  SUPERIOR: "SUPERIOR ROOM",
  JUNIOR: "JUNIOR SUITE",
  COMFORT: "COMFORT ROOM",
  CLASSIC: "CLASSIC ROOM",
  BUSINESS: "BUSINESS ROOM",
  PREMIER: "PREMIER ROOM",
  PREMIUM: "PREMIUM ROOM",
};
export function normalizeRoom(room?: string): string {
  const s = (room ?? "")
    .replace(/\s*\r?\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!s) return "";
  const upper = s.toUpperCase();
  // Bare class word or its alias ("Standart", "ECO", «Deluxe») → canonical form.
  if (ROOM_CANONICAL[upper]) return ROOM_CANONICAL[upper];
  // Class word + occupancy-only suffix ("STANDARD / DBL", "DELUXE / 2 PAX",
  // "FAMILY / DBL") → canonical form too: the suffix is the same
  // room/accommodation info the table renders separately («/ 2+0»),
  // so it carries no extra room identity.
  const bareWithSuffix = upper.match(/^([A-Z]+)\s*(?:\/.*)?$/);
  if (bareWithSuffix && ROOM_CANONICAL[bareWithSuffix[1]]) {
    return ROOM_CANONICAL[bareWithSuffix[1]];
  }
  // Detailed value ("STANDARD ROOM / 2AD", "DELUXE SEA VIEW / DBL") —
  // keep as-is (uppercased, whitespace-collapsed; no invented text).
  return upper;
}

export default function TourResultsTable({
  result,
  searchId,
  loading,
  error,
  resolvedSuppliers,
}: {
  result: AggregatedSearchResult | null;
  searchId: string;
  loading: boolean;
  error?: string;
  /** null = supplier set still resolving, [] = none, string[] = will be queried. */
  resolvedSuppliers?: string[] | null;
}) {
  const locale = useLocale();
  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [mealFilter, setMealFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [nightsFilter, setNightsFilter] = useState("");
  const [hotelFilter, setHotelFilter] = useState("");
  const [starsFilter, setStarsFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  // Room type filter («Тип номера»): distinct normalized room values.
  const [roomTypeFilter, setRoomTypeFilter] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selected, setSelected] = useState<AggregatedOffer | null>(null);

  const clean = (s?: string) =>
    (s ?? "").replace(/\s*\r?\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const dates = useMemo(
    () => [...new Set((result?.offers ?? []).map((o) => o.departureDate))].sort(),
    [result],
  );
  const nights = useMemo(
    () => [...new Set((result?.offers ?? []).map((o) => o.nights))].sort((a, b) => a - b),
    [result],
  );
  const meals = useMemo(() => {
    const set = new Set<string>();
    for (const o of result?.offers ?? []) {
      const m = normalizeMeal(o.meal);
      if (m) set.add(m);
    }
    return [...set].sort();
  }, [result]);
  const suppliers = useMemo(
    () =>
      Object.keys(result?.perSupplier ?? {}).filter(
        (c) => (result?.perSupplier[c]?.count ?? 0) > 0,
      ),
    [result],
  );
  // Distinct room types from the offers (normalized: uppercased, collapsed
  // whitespace, bare class words get « ROOM») — powers the «Тип номера» filter.
  const roomTypes = useMemo(() => {
    const set = new Set<string>();
    for (const o of result?.offers ?? []) {
      const r = normalizeRoom(o.room);
      if (r) set.add(r);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ru"));
  }, [result]);

  // Distinct hotel categories ("3*", "4*+" …) from hotel names / supplier
  // metadata — powers the «Категория отеля» column filter (sorted 1* → 5*).
  const starCats = useMemo(() => {
    const set = new Set<string>();
    for (const o of result?.offers ?? []) {
      const s = offerStar(o);
      if (s) set.add(s);
    }
    return [...set].sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b),
    );
  }, [result]);

  const rows = useMemo(() => {
    const norm = (s?: string) => clean(s).toUpperCase();
    let list = [...(result?.offers ?? [])];
    if (supplierFilter) list = list.filter((o) => o.supplierCode === supplierFilter);
    if (mealFilter) list = list.filter((o) => normalizeMeal(o.meal) === mealFilter);
    if (dateFilter) list = list.filter((o) => o.departureDate === dateFilter);
    if (nightsFilter) list = list.filter((o) => String(o.nights) === nightsFilter);
    if (hotelFilter) {
      const q = hotelFilter.trim().toUpperCase();
      if (q) list = list.filter((o) => norm(o.hotel).includes(q));
    }
    if (starsFilter) list = list.filter((o) => offerStar(o) === starsFilter);
    if (roomTypeFilter) {
      list = list.filter((o) => normalizeRoom(o.room) === roomTypeFilter);
    }
    if (roomFilter) {
      const q = roomFilter.trim().toUpperCase();
      if (q)
        list = list.filter((o) =>
          norm([o.room, `${o.adults}+${o.children}`].join(" / ")).includes(q),
        );
    }
    if (maxPrice && !Number.isNaN(Number(maxPrice))) {
      list = list.filter((o) => (o.price?.amount ?? Infinity) <= Number(maxPrice));
    }
    const cmp = (a: AggregatedOffer, b: AggregatedOffer): number => {
      switch (sortKey) {
        case "date":
          return a.departureDate.localeCompare(b.departureDate);
        case "nights":
          return a.nights - b.nights;
        case "hotel":
          return clean(a.hotel).localeCompare(clean(b.hotel), "ru");
        case "stars": {
          const sa = offerStar(a);
          const sb = offerStar(b);
          if (!sa && !sb) return 0;
          if (!sa) return 1; // unknown category sorts last (asc)
          if (!sb) return -1;
          return parseInt(sa, 10) - parseInt(sb, 10) || sa.localeCompare(sb);
        }
        case "meal":
          return normalizeMeal(a.meal).localeCompare(normalizeMeal(b.meal), "ru");
        case "room":
          return normalizeRoom(a.room).localeCompare(normalizeRoom(b.room), "ru");
        case "price":
          return (a.price?.amount ?? Infinity) - (b.price?.amount ?? Infinity);
        case "source":
          return a.supplierCode.localeCompare(b.supplierCode);
        default:
          return 0;
      }
    };
    list.sort((a, b) => (sortDir === "asc" ? cmp(a, b) : -cmp(a, b)));
    return list;
  }, [
    result,
    sortKey,
    sortDir,
    supplierFilter,
    mealFilter,
    dateFilter,
    nightsFilter,
    hotelFilter,
    starsFilter,
    roomFilter,
    roomTypeFilter,
    maxPrice,
  ]);

  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return d && m && y ? `${d}.${m}.${y}` : iso;
  };

  /** Sortable header cell: label + active gold ▲/▼ marker (faint ⇅ on hover). */
  const thSort = (key: SortKey, label: string, right = false): ReactNode => {
    const active = sortKey === key;
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        aria-label={`${t("sort.label", locale)}: ${label}`}
        className={`group flex w-full items-center gap-1 text-xs uppercase tracking-wide transition-colors ${
          right ? "justify-end" : "justify-start"
        } ${active ? "text-white" : "text-neutral-400 hover:text-white"}`}
      >
        {label}
        <span
          className={`text-[10px] ${active ? "text-gold" : "opacity-0 transition-opacity group-hover:opacity-70"}`}
          aria-hidden="true"
        >
          {active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </button>
    );
  };

  const filterInput =
    "w-full rounded-lg border border-white/10 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 outline-none transition-colors focus:border-gold/50 placeholder:text-neutral-600";

  if (loading) {
    // Progressive status: resolve who will answer the direction first, then
    // show that set while the (much slower) live search is running.
    const pending = resolvedSuppliers == null;
    const found = (resolvedSuppliers ?? []).map((c) => SUPPLIER_LABELS[c] ?? c);
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-sm text-neutral-300">{t("tourSearch.searching", locale)}</p>
        <p className="mt-3 text-xs text-neutral-400">
          {pending
            ? t("tourSearch.finding_suppliers", locale)
            : found.length > 0
              ? `${t("tourSearch.suppliers_found", locale)} ${found.join(", ")}`
              : t("tourSearch.searching_suppliers", locale)}
        </p>
        {!pending && found.length > 0 && (
          <p className="mt-1 text-xs text-neutral-500">{t("tourSearch.searching_suppliers", locale)}</p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-8 text-center">
        <p className="text-sm text-red-400">{t("tourSearch.error", locale)}</p>
        <p className="mt-2 break-all font-mono text-xs text-red-400/70">{error}</p>
      </div>
    );
  }

  if (!result || result.offers.length === 0) {
    const allFailed =
      !!result &&
      Object.keys(result.perSupplier).length > 0 &&
      Object.values(result.perSupplier).every((r) => r.error);
    // No supplier was even queried — the geo code had no supplier mapping,
    // so the aggregator skipped everyone instead of returning a country-wide set.
    const noGeoData = !!result && Object.keys(result.perSupplier).length === 0;
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-neutral-300">
          {allFailed
            ? t("tourSearch.all_failed", locale)
            : noGeoData
              ? t("tourSearch.no_geo_data", locale)
              : t("tourSearch.no_results", locale)}
        </p>
        {noGeoData && (
          <p className="mt-2 text-xs text-neutral-500">{t("tourSearch.no_geo_data_hint", locale)}</p>
        )}
        {result && Object.keys(result.perSupplier).length > 0 && (
          <p className="mt-2 text-xs text-neutral-500">
            {Object.entries(result.perSupplier)
              .map(([code, r]) =>
                r.error
                  ? `${SUPPLIER_LABELS[code] ?? code} — ${t("tourSearch.unavailable", locale)}`
                  : `${SUPPLIER_LABELS[code] ?? code} — ${r.count}`,
              )
              .join(" · ")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Supplier summary + searchId traceability (§13/§20) */}
      <p className="mb-3 text-sm text-neutral-500">
        {Object.entries(result.perSupplier)
          .map(([code, r]) =>
            r.error
              ? `${SUPPLIER_LABELS[code] ?? code} — ${t("tourSearch.unavailable", locale)}`
              : `${SUPPLIER_LABELS[code] ?? code} — ${r.count}`,
          )
          .join(" · ")}
        {" · "}
        {t("search.found", locale)}: {result.offers.length}
        <span className="ml-2 font-mono text-neutral-700">searchId: {searchId}</span>
      </p>

      {/* Results table (§6) — sortable header with embedded per-column filters */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="px-4 pt-3">{thSort("date", t("tourSearch.col_date", locale))}</th>
              <th className="px-4 pt-3 text-right">
                {thSort("nights", t("tourSearch.col_nights", locale), true)}
              </th>
              <th className="px-4 pt-3">{thSort("hotel", t("tourSearch.col_hotel", locale))}</th>
              <th className="px-4 pt-3">{thSort("stars", t("tourSearch.col_stars", locale))}</th>
              <th className="px-4 pt-3">{thSort("meal", t("tourSearch.col_meal", locale))}</th>
              <th className="px-4 pt-3">{thSort("room", t("tourSearch.col_room", locale))}</th>
              <th className="px-4 pt-3 text-right">
                {thSort("price", t("tourSearch.col_price", locale), true)}
              </th>
              <th className="px-4 pt-3">{thSort("source", t("tourSearch.col_source", locale))}</th>
            </tr>
            {/* Filters live in the header row — one control per column */}
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-4 pb-3 pt-1 font-normal">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className={filterInput}
                  aria-label={t("tourSearch.col_date", locale)}
                >
                  <option value="">{t("tourSearch.filter_all_dates", locale)}</option>
                  {dates.map((d) => (
                    <option key={d} value={d}>
                      {fmtDate(d)}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-4 pb-3 pt-1 font-normal">
                <select
                  value={nightsFilter}
                  onChange={(e) => setNightsFilter(e.target.value)}
                  className={filterInput}
                  aria-label={t("tourSearch.col_nights", locale)}
                >
                  <option value="">{t("tourSearch.filter_all_nights", locale)}</option>
                  {nights.map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-4 pb-3 pt-1 font-normal">
                <input
                  type="search"
                  value={hotelFilter}
                  onChange={(e) => setHotelFilter(e.target.value)}
                  placeholder={t("tourSearch.filter_hotel", locale)}
                  className={filterInput}
                  aria-label={t("tourSearch.filter_hotel", locale)}
                />
              </th>
              <th className="px-4 pb-3 pt-1 font-normal">
                <select
                  value={starsFilter}
                  onChange={(e) => setStarsFilter(e.target.value)}
                  className={filterInput}
                  aria-label={t("tourSearch.col_stars", locale)}
                >
                  <option value="">{t("tourSearch.filter_all_stars", locale)}</option>
                  {starCats.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-4 pb-3 pt-1 font-normal">
                <select
                  value={mealFilter}
                  onChange={(e) => setMealFilter(e.target.value)}
                  className={filterInput}
                  aria-label={t("tourSearch.filter_meal", locale)}
                >
                  <option value="">{t("tourSearch.filter_all_meals", locale)}</option>
                  {meals.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-4 pb-3 pt-1 font-normal">
                <select
                  value={roomTypeFilter}
                  onChange={(e) => setRoomTypeFilter(e.target.value)}
                  className={filterInput}
                  aria-label={t("tourSearch.col_room", locale)}
                >
                  <option value="">{t("tourSearch.filter_all_room_types", locale)}</option>
                  {roomTypes.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <input
                  type="search"
                  value={roomFilter}
                  onChange={(e) => setRoomFilter(e.target.value)}
                  placeholder={t("tourSearch.filter_room", locale)}
                  className={`${filterInput} mt-1`}
                  aria-label={t("tourSearch.filter_room", locale)}
                />
              </th>
              <th className="px-4 pb-3 pt-1 font-normal">
                <input
                  type="number"
                  min={0}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder={t("tourSearch.filter_price_max", locale)}
                  className={`${filterInput} text-right`}
                  aria-label={t("tourSearch.filter_price_max", locale)}
                />
              </th>
              <th className="px-4 pb-3 pt-1 font-normal">
                <select
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  className={filterInput}
                  aria-label={t("tourSearch.filter_supplier", locale)}
                >
                  <option value="">{t("tourSearch.filter_all_suppliers", locale)}</option>
                  {suppliers.map((c) => (
                    <option key={c} value={c}>
                      {SUPPLIER_LABELS[c] ?? c}
                    </option>
                  ))}
                </select>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 100).map((o, i) => (
              <tr
                key={`${o.supplierCode}-${o.externalOfferId}-${i}`}
                onClick={() => setSelected(o)}
                className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5"
              >
                <td className="whitespace-nowrap px-4 py-3 text-neutral-200">
                  {fmtDate(o.departureDate)}
                </td>
                <td className="px-4 py-3 text-right text-neutral-200">{o.nights}</td>
                <td className="max-w-[240px] truncate px-4 py-3 text-neutral-100">
                  {clean(o.hotel)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-neutral-300">
                  {offerStar(o) || "—"}
                </td>
                <td className="px-4 py-3 text-neutral-300">{normalizeMeal(o.meal) || "—"}</td>
                <td className="max-w-[200px] truncate px-4 py-3 text-neutral-300">
                  {[normalizeRoom(o.room), `${o.adults}+${o.children}`].filter(Boolean).join(" / ") || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gold">
                  {o.price ? (
                    <Price amount={o.price.amount} currency={o.price.currency} tone="gold" withPrefix={false} />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-neutral-300">
                    {SUPPLIER_LABELS[o.supplierCode] ?? o.supplierCode}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 100 && (
        <p className="mt-2 text-xs text-neutral-500">
          {t("tourSearch.shown_first", locale)}: 100 / {rows.length}
        </p>
      )}

      {/* Offer card of the EXACTLY clicked row (§8) */}
      {selected && (
        <OfferDetailsModal offer={selected} searchId={searchId} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
