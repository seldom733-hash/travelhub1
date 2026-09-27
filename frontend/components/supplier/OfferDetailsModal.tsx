"use client";

import { useState } from "react";
import { t, useLocale } from "@/lib/i18n";
import Price from "@/components/public/Price";
import {
  refreshSupplierPrice,
  refreshSupplierAvailability,
  createTourRequest,
  isCaptchaRequired,
  type SupplierPriceSnapshot,
} from "@/lib/supplier-api";
import type { AggregatedOffer } from "@/lib/supplier-api";

/**
 * OfferDetailsModal — card of the EXACTLY selected offer (§8).
 *
 * Shows all offer parameters + «Забронировать» CTA. Booking follows the
 * EXISTING TravelHub flow: revalidate price (refresh-price) → confirm if
 * changed (§9) → create-request (TourRequest). No new booking entities.
 */
export default function OfferDetailsModal({
  offer,
  searchId,
  onClose,
}: {
  offer: AggregatedOffer;
  searchId: string;
  onClose: () => void;
}) {
  const locale = useLocale();
  const [checking, setChecking] = useState(false);
  const [revalidated, setRevalidated] = useState(false);
  const [priceChange, setPriceChange] = useState<{ from: number; to: number } | null>(null);
  const [gone, setGone] = useState(false);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState<{ referenceNumber: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clean = (s?: string) =>
    (s ?? "").replace(/\s*\r?\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();

  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return d && m && y ? `${d}.${m}.${y}` : iso;
  };

  const checkOut = (() => {
    const dt = new Date(offer.departureDate);
    if (Number.isNaN(dt.getTime())) return offer.departureDate;
    dt.setDate(dt.getDate() + offer.nights);
    return dt.toISOString().slice(0, 10);
  })();

  /** §9: revalidate before booking — never book a stale or gone offer. */
  const handleBook = async () => {
    setError(null);
    setBooking(true);
    try {
      // Step 1: revalidate price + availability if supported by the API.
      if (!revalidated) {
        setChecking(true);
        const searchContext = {
          supplierCode: offer.supplierCode,
          destination: offer.destination ?? offer.country,
          departureDateFrom: offer.departureDate,
          departureDateTo: offer.departureDate,
          nightsFrom: offer.nights,
          nightsTo: offer.nights,
          adults: offer.adults,
          children: offer.children,
          childAges: offer.childAges?.length ? offer.childAges : undefined,
          hotel: clean(offer.hotel),
          hotelExternalId: offer.hotelExternalId,
        };
        const [priceSnap, availability] = await Promise.allSettled([
          refreshSupplierPrice(
            offer.supplierCode,
            offer.externalOfferId,
            offer.externalClaim,
            searchContext,
          ),
          refreshSupplierAvailability(
            offer.supplierCode,
            offer.externalOfferId,
            offer.externalClaim,
            searchContext,
          ),
        ]);
        setChecking(false);
        if (priceSnap.status === "fulfilled" && !isCaptchaRequired(priceSnap.value)) {
          const snap = priceSnap.value as SupplierPriceSnapshot;
          if (snap?.amount != null && offer.price && Math.abs(snap.amount - offer.price.amount) > 0.01) {
            setPriceChange({ from: offer.price.amount, to: snap.amount });
            setRevalidated(true);
            setBooking(false);
            return; // wait for user confirmation (§9)
          }
        }
        if (
          availability.status === "fulfilled" &&
          !isCaptchaRequired(availability.value) &&
          availability.value.availability === "NOT_AVAILABLE"
        ) {
          setGone(true);
          setBooking(false);
          return; // §9: never create an order for an unavailable offer
        }
        setRevalidated(true);
      }
      // Step 2: existing booking flow — TourRequest via create-request.
      const res = await createTourRequest({
        supplierCode: offer.supplierCode,
        externalOfferId: offer.externalOfferId,
        hotel: clean(offer.hotel),
        hotelExternalId: offer.hotelExternalId,
        departureDate: offer.departureDate,
        nights: offer.nights,
        adults: offer.adults,
        children: offer.children,
        childAges: offer.childAges?.length ? offer.childAges : undefined,
        room: clean(offer.room) || undefined,
        meal: clean(offer.meal) || undefined,
        price: priceChange ? priceChange.to : offer.price?.amount ?? 0,
        currency: offer.price?.currency ?? "USD",
        destination: offer.destination ?? offer.country,
      });
      setBooked({ referenceNumber: res.referenceNumber });
    } catch (e) {
      setError((e as Error).message || t("tourSearch.booking_error", locale));
    } finally {
      setBooking(false);
      setChecking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-serif text-xl font-semibold text-white">
              {clean(offer.hotel)}
            </h3>
            <p className="mt-0.5 text-sm text-neutral-400">
              {[clean(offer.destination), clean(offer.country)].filter(Boolean).join(", ")}
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-neutral-300">
            {offer.supplierCode === "SUMMERTOUR" ? "Summer" : "Компас"}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-neutral-500">{t("tourSearch.col_date", locale)}</dt>
          <dd className="text-neutral-200">
            {fmtDate(offer.departureDate)} → {fmtDate(checkOut)}
          </dd>
          <dt className="text-neutral-500">{t("tourSearch.col_nights", locale)}</dt>
          <dd className="text-neutral-200">{offer.nights}</dd>
          <dt className="text-neutral-500">{t("tourSearch.col_meal", locale)}</dt>
          <dd className="text-neutral-200">{clean(offer.meal) || "—"}</dd>
          <dt className="text-neutral-500">{t("tourSearch.col_room", locale)}</dt>
          <dd className="text-neutral-200">{clean(offer.room) || "—"}</dd>
          <dt className="text-neutral-500">{t("tourSearch.offer_adults", locale)}</dt>
          <dd className="text-neutral-200">{offer.adults}</dd>
          <dt className="text-neutral-500">{t("tourSearch.offer_children", locale)}</dt>
          <dd className="text-neutral-200">
            {offer.children > 0
              ? `${offer.children}${offer.childAges?.length ? ` (${offer.childAges.join(", ")})` : ""}`
              : "—"}
          </dd>
          <dt className="text-neutral-500">{t("tourSearch.col_price", locale)}</dt>
          <dd className="text-lg font-semibold text-white">
            {offer.price ? (
              <Price amount={offer.price.amount} currency={offer.price.currency} />
            ) : (
              "—"
            )}
          </dd>
        </dl>

        {/* §9: price changed → ask confirmation */}
        {priceChange && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
            {t("tourSearch.price_changed_intro", locale)}
            <br />
            {t("tourSearch.price_was", locale)}: {priceChange.from} · {t("tourSearch.price_now", locale)}: {priceChange.to}
          </div>
        )}

        {/* §9: offer gone */}
        {gone && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {t("tourSearch.offer_gone", locale)}
          </div>
        )}

        {booked && (
          <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">
            {t("tourSearch.booked_ok", locale)} — {booked.referenceNumber}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/10"
          >
            {t("common.close", locale)}
          </button>
          {!booked && !gone && (
            <button
              onClick={handleBook}
              disabled={booking || checking}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {checking
                ? t("tourSearch.checking", locale)
                : booking
                  ? t("tourSearch.booking", locale)
                  : priceChange
                    ? t("tourSearch.confirm_book", locale)
                    : t("tourSearch.book", locale)}
            </button>
          )}
        </div>

        <p className="mt-3 text-right font-mono text-[10px] text-neutral-700">
          searchId: {searchId} · offer: {offer.supplierCode}/{offer.externalOfferId}
        </p>
      </div>
    </div>
  );
}
