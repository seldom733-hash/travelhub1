"use client";

import { useState, useCallback, useEffect } from "react";
import { t, useLocale } from "@/lib/i18n";
import Price from "@/components/public/Price";
import PriceCalendar from "@/components/supplier/PriceCalendar";
import VitrinaFilters from "@/components/supplier/VitrinaFilters";
import {
  searchSupplierOffers,
  getPriceCalendar,
  type SupplierOffer,
  type SupplierSearchQuery,
  type SupplierPriceCalendarEntry,
} from "@/lib/supplier-api";

/**
 * TourDetail — live KOMPAS integration for the product detail page.
 *
 * Uses product attributes (hotelExternalId, destination, departureCity)
 * to query KOMPAS for real offers. Shows:
 * - VitrinaFilters (pre-filled from product attributes)
 * - PriceCalendar (real prices by departure date)
 * - Offer Details Modal (all variants for selected date)
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
  const [filtersVisible, setFiltersVisible] = useState(true);

  // Extract KOMPAS identity from product attributes
  const hotelExternalId = (attributes?.hotelExternalId as string) ?? undefined;
  const hotelName = title;
  const destination = (attributes?.destination as string) ?? (attributes?.country as string) ?? undefined;
  const departureCity = (attributes?.departureCity as string) ?? undefined;
  const tourIncValue = (attributes?.tourKey as string) ?? undefined;

  // Initial search query based on product attributes
  const buildInitialQuery = useCallback(
    (overrides?: Partial<SupplierSearchQuery>): SupplierSearchQuery => ({
      supplierCode: "KOMPAS",
      hotel: hotelName,
      hotelExternalId,
      destination,
      departureCity,
      tourIncValue,
      adults: 2,
      children: 0,
      nightsFrom: 7,
      nightsTo: 7,
      ...overrides,
    }),
    [hotelName, hotelExternalId, destination, departureCity, tourIncValue],
  );

  // Auto-search on mount
  useEffect(() => {
    if (!hotelExternalId && !hotelName) return;
    let alive = true;
    setLoading(true);
    setError(null);

    searchSupplierOffers(buildInitialQuery())
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
  }, [hotelExternalId, hotelName, buildInitialQuery, locale]);

  // Handle filter change
  const handleFilterSearch = useCallback(
    (query: SupplierSearchQuery) => {
      setLoading(true);
      setError(null);
      setOffers([]);
      setSelectedEntry(null);

      searchSupplierOffers({ ...query, hotel: hotelName, hotelExternalId, destination, departureCity, tourIncValue })
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
    },
    [hotelName, hotelExternalId, destination, departureCity, tourIncValue, locale],
  );

  // Build price calendar query from current offers
  const buildCalendarQuery = useCallback(() => {
    if (offers.length === 0) return null;
    const first = offers[0];
    const nowLocal = new Date();
    const today = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
    const dateTo = new Date(nowLocal.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    return {
      supplierCode: first.supplierCode,
      hotel: first.hotel?.replace(/\s*\r?\n\s*/g, " ").replace(/\s{2,}/g, " ").trim(),
      hotelExternalId: first.hotelExternalId,
      destination,
      dateFrom: today,
      dateTo,
      nights: first.nights,
      adults: first.adults,
      children: first.children || undefined,
      childAges: first.childAges.length > 0 ? first.childAges : undefined,
    };
  }, [offers, destination]);

  // Handle calendar date click
  const handleCalendarSelect = useCallback((entry: SupplierPriceCalendarEntry) => {
    setSelectedEntry(entry);
    setModalOpen(true);
  }, []);

  // Group offers by room+meal for the modal
  const groupedOffers = selectedEntry?.offers
    ? selectedEntry.offers.reduce<Record<string, SupplierOffer[]>>((acc, offer) => {
        const key = `${offer.room ?? "STD"}|${offer.meal ?? "RO"}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(offer);
        return acc;
      }, {})
    : {};

  const calQuery = buildCalendarQuery();

  return (
    <section className="mt-8 space-y-6" aria-labelledby="tour-detail-section">
      <h2 id="tour-detail-section" className="text-lg font-bold text-slate-900">
        {t("tour.filters_title", locale)}
      </h2>

      {/* Filters */}
      {filtersVisible && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <VitrinaFilters
            initial={{
              departureCity,
              destination,
              hotel: hotelName,
              nightsFrom: 7,
              nightsTo: 7,
              adults: 2,
              children: 0,
            }}
            onSearch={handleFilterSearch}
          />
        </div>
      )}

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

      {/* Price Calendar */}
      {!loading && !error && calQuery && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">
            {t("tour.calendar_title", locale)}
          </h3>
          <PriceCalendar query={calQuery} onSelect={handleCalendarSelect} />
        </div>
      )}

      {/* Offer summary */}
      {!loading && !error && offers.length > 0 && (
        <div className="text-sm text-slate-500">
          {t("search.found", locale)}: {offers.length} {t("tour.offers_title", locale).toLowerCase()}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && offers.length === 0 && hotelExternalId && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-sm text-slate-500">{t("tour.no_offers", locale)}</p>
        </div>
      )}

      {/* Offer Details Modal */}
      {modalOpen && selectedEntry && (
        <OfferModal
          entry={selectedEntry}
          groupedOffers={groupedOffers}
          onClose={() => setModalOpen(false)}
        />
      )}
    </section>
  );
}

/** Modal showing all offer variants for a selected calendar date. */
function OfferModal({
  entry,
  groupedOffers,
  onClose,
}: {
  entry: SupplierPriceCalendarEntry;
  groupedOffers: Record<string, SupplierOffer[]>;
  onClose: () => void;
}) {
  const locale = useLocale();
  const variantKeys = Object.keys(groupedOffers);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {t("tour.offers_title", locale)}
            </h3>
            <p className="text-sm text-slate-500">
              {entry.date} · {entry.price !== null ? <Price amount={entry.price} currency={entry.currency} size="sm" withPrefix /> : "—"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Offer variants */}
        {variantKeys.length === 0 ? (
          <p className="text-sm text-slate-500">{t("tour.no_offers", locale)}</p>
        ) : (
          <div className="space-y-4">
            {variantKeys.map((key) => {
              const variantOffers = groupedOffers[key];
              const first = variantOffers[0];
              return (
                <div
                  key={key}
                  className="rounded-xl border border-slate-200 p-4 space-y-3"
                >
                  {/* Room + Meal header */}
                  <div className="flex flex-wrap items-center gap-2">
                    {first.room && (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                        🛏 {first.room}
                      </span>
                    )}
                    {first.meal && (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                        🍽 {first.meal}
                      </span>
                    )}
                    {first.transport && (
                      <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                        ✈️ {first.transport}
                      </span>
                    )}
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                    <div>
                      <span className="font-medium">{t("tour.departure", locale)}:</span>{" "}
                      {first.departureDate}
                    </div>
                    <div>
                      <span className="font-medium">{t("tour.nights_count", locale)}:</span>{" "}
                      {first.nights}
                    </div>
                    <div>
                      <span className="font-medium">{t("tour.passengers", locale)}:</span>{" "}
                      {first.adults} {t("supplier.adults", locale)}
                      {first.children > 0 && `, ${first.children} ${t("supplier.children", locale)}`}
                    </div>
                    <div>
                      <span className="font-medium">{t("tour.hotel", locale) ?? "Hotel"}:</span>{" "}
                      {first.hotel?.split("\n")[0]?.trim()}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="border-t border-slate-100 pt-3">
                    <Price
                      amount={first.price.amount}
                      currency={first.price.currency}
                      size="lg"
                      withPrefix={false}
                    />
                    {variantOffers.length > 1 && (
                      <p className="mt-1 text-xs text-slate-400">
                        {variantOffers.length} variants available
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
