"use client";

import { useMemo, useState } from "react";
import { t, useLocale } from "@/lib/i18n";
import Price from "@/components/public/Price";
import OfferDetailsModal from "@/components/supplier/OfferDetailsModal";
import type { AggregatedOffer, AggregatedSearchResult } from "@/lib/supplier-api";

/**
 * TourResultsTable — universal live tour search results (Summer + KOMPAS).
 *
 * Table layout per prompt §6: check-in date / nights / hotel / meal /
 * room-accommodation / price, plus the supplier source badge. Every row is
 * clickable and opens the OfferDetailsModal for THAT offer. Sorting (price
 * asc/desc, date, nights, hotel) and filters (supplier, meal, price) are
 * client-side over the live result set.
 */

type SortKey = "price_asc" | "price_desc" | "date" | "nights" | "hotel";

const SUPPLIER_LABELS: Record<string, string> = {
  KOMPAS: "Компас",
  SUMMERTOUR: "Summer",
};

export default function TourResultsTable({
  result,
  searchId,
  loading,
}: {
  result: AggregatedSearchResult | null;
  searchId: string;
  loading: boolean;
}) {
  const locale = useLocale();
  const [sortKey, setSortKey] = useState<SortKey>("price_asc");
  const [supplierFilter, setSupplierFilter] = useState<string>("");
  const [mealFilter, setMealFilter] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [selected, setSelected] = useState<AggregatedOffer | null>(null);

  const meals = useMemo(() => {
    const set = new Set<string>();
    for (const o of result?.offers ?? []) {
      const m = (o.meal ?? "").replace(/\s+/g, " ").trim();
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

  const rows = useMemo(() => {
    let list = [...(result?.offers ?? [])];
    if (supplierFilter) list = list.filter((o) => o.supplierCode === supplierFilter);
    if (mealFilter) {
      const norm = (s?: string) => (s ?? "").replace(/\s+/g, " ").trim().toUpperCase();
      list = list.filter((o) => norm(o.meal) === norm(mealFilter));
    }
    if (maxPrice && !Number.isNaN(Number(maxPrice))) {
      list = list.filter((o) => (o.price?.amount ?? Infinity) <= Number(maxPrice));
    }
    list.sort((a, b) => {
      switch (sortKey) {
        case "price_asc":
          return (a.price?.amount ?? Infinity) - (b.price?.amount ?? Infinity);
        case "price_desc":
          return (b.price?.amount ?? Infinity) - (a.price?.amount ?? Infinity);
        case "date":
          return a.departureDate.localeCompare(b.departureDate);
        case "nights":
          return a.nights - b.nights;
        case "hotel":
          return a.hotel.localeCompare(b.hotel, "ru");
        default:
          return 0;
      }
    });
    return list;
  }, [result, sortKey, supplierFilter, mealFilter, maxPrice]);

  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return d && m && y ? `${d}.${m}.${y}` : iso;
  };

  const clean = (s?: string) =>
    (s ?? "").replace(/\s*\r?\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-sm text-neutral-300">{t("tourSearch.searching", locale)}</p>
        <div className="mt-3 flex justify-center gap-4 text-xs">
          <span className="text-neutral-500">Summer …</span>
          <span className="text-neutral-500">Компас …</span>
        </div>
      </div>
    );
  }

  if (!result || result.offers.length === 0) {
    const allFailed =
      !!result &&
      Object.keys(result.perSupplier).length > 0 &&
      Object.values(result.perSupplier).every((r) => r.error);
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-neutral-300">
          {allFailed ? t("tourSearch.all_failed", locale) : t("tourSearch.no_results", locale)}
        </p>
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

      {/* Sorting + filters (§7) */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200"
          aria-label={t("tourSearch.sort", locale)}
        >
          <option value="price_asc">{t("tourSearch.sort_price_asc", locale)}</option>
          <option value="price_desc">{t("tourSearch.sort_price_desc", locale)}</option>
          <option value="date">{t("tourSearch.sort_date", locale)}</option>
          <option value="nights">{t("tourSearch.sort_nights", locale)}</option>
          <option value="hotel">{t("tourSearch.sort_hotel", locale)}</option>
        </select>
        {suppliers.length > 1 && (
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200"
            aria-label={t("tourSearch.filter_supplier", locale)}
          >
            <option value="">{t("tourSearch.filter_all_suppliers", locale)}</option>
            {suppliers.map((c) => (
              <option key={c} value={c}>
                {SUPPLIER_LABELS[c] ?? c}
              </option>
            ))}
          </select>
        )}
        {meals.length > 1 && (
          <select
            value={mealFilter}
            onChange={(e) => setMealFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200"
            aria-label={t("tourSearch.filter_meal", locale)}
          >
            <option value="">{t("tourSearch.filter_all_meals", locale)}</option>
            {meals.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
        <input
          type="number"
          min={0}
          placeholder={t("tourSearch.filter_price_max", locale)}
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          className="w-36 rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-600"
        />
      </div>

      {/* Results table (§6) */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5 text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="px-4 py-3">{t("tourSearch.col_date", locale)}</th>
              <th className="px-4 py-3 text-right">{t("tourSearch.col_nights", locale)}</th>
              <th className="px-4 py-3">{t("tourSearch.col_hotel", locale)}</th>
              <th className="px-4 py-3">{t("tourSearch.col_meal", locale)}</th>
              <th className="px-4 py-3">{t("tourSearch.col_room", locale)}</th>
              <th className="px-4 py-3 text-right">{t("tourSearch.col_price", locale)}</th>
              <th className="px-4 py-3">{t("tourSearch.col_source", locale)}</th>
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
                <td className="px-4 py-3 text-neutral-300">{clean(o.meal) || "—"}</td>
                <td className="max-w-[200px] truncate px-4 py-3 text-neutral-300">
                  {[clean(o.room), `${o.adults}+${o.children}`].filter(Boolean).join(" / ") || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-neutral-100">
                  {o.price ? (
                    <Price amount={o.price.amount} currency={o.price.currency} />
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
