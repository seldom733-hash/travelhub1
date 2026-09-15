"use client";

import { useCallback, useState } from "react";
import { t, useLocale } from "@/lib/i18n";
import { publicSupplierApi, type PriceCalendarEntryOffer, type PriceCalendarEntry } from "@/lib/public-api";

interface SupplierOfferTableProps {
  entry: PriceCalendarEntry;
  supplierCode: string;
  searchContext: Record<string, unknown>;
  config?: {
    hotel: string;
    room: string;
    meal: string;
    adults: number;
    children: number;
    childAges: number[];
    nights: number;
  };
  onOrderCreated?: (offer: PriceCalendarEntryOffer) => void;
}

interface OrderState {
  loading: boolean;
  error: string | null;
  offerExternalId: string | null;
}

export default function SupplierOfferTable({ entry, supplierCode, searchContext, config, onOrderCreated }: SupplierOfferTableProps) {
  const locale = useLocale();
  const [orderState, setOrderState] = useState<OrderState>({
    loading: false,
    error: null,
    offerExternalId: null,
  });

  const handleOrder = useCallback(async (offer: PriceCalendarEntryOffer) => {
    setOrderState({ loading: true, error: null, offerExternalId: offer.externalOfferId });

    try {
      // Fresh price recheck
      const [priceResult, availResult] = await Promise.all([
        publicSupplierApi.refreshPrice({
          supplierCode,
          offerId: offer.externalOfferId,
          claim: offer.externalClaim,
          searchContext,
        }),
        publicSupplierApi.refreshAvailability({
          supplierCode,
          offerId: offer.externalOfferId,
          claim: offer.externalClaim,
          searchContext,
        }),
      ]);

      // Check availability
      if (availResult.availability !== "AVAILABLE") {
        setOrderState({
          loading: false,
          error: t("calendar.offer_unavailable", locale),
          offerExternalId: null,
        });
        return;
      }

      // Price changed — show confirmation
      if (priceResult.amount > 0 && priceResult.amount !== offer.price) {
        const confirmed = window.confirm(
          t("calendar.price_changed", locale)
            .replace("{old}", offer.price.toLocaleString())
            .replace("{new}", priceResult.amount.toLocaleString())
        );
        if (!confirmed) {
          setOrderState({ loading: false, error: null, offerExternalId: null });
          return;
        }
      }

      // Create order request
      const params = new URLSearchParams({
        supplier: supplierCode,
        offer: offer.externalOfferId,
        claim: offer.externalClaim || "",
        date: offer.departureDate,
        price: String(priceResult.amount),
        currency: priceResult.currency,
        hotel: offer.hotel,
        room: offer.room || "",
        meal: offer.meal || "",
        nights: String(offer.nights),
        adults: String(offer.adults),
        children: String(offer.children),
        tourInc: offer.tourIncValue,
      });

      // Redirect to order flow
      window.location.href = `/requests/new?${params.toString()}`;

      if (onOrderCreated) {
        onOrderCreated(offer);
      }
    } catch (err) {
      setOrderState({
        loading: false,
        error: t("calendar.recheck_error", locale),
        offerExternalId: null,
      });
    }
  }, [supplierCode, searchContext, locale, onOrderCreated]);

  if (!entry.offers || entry.offers.length === 0) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-bold text-slate-900">
        {t("calendar.available_offers", locale)} {formatDate(entry.date)}
      </h4>

      {/* Desktop table */}
      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-2">{t("table.hotel", locale)}</th>
              <th className="pb-2 pr-2">{t("table.room", locale)}</th>
              <th className="pb-2 pr-2">{t("table.meal", locale)}</th>
              <th className="pb-2 pr-2">{t("table.program", locale)}</th>
              <th className="pb-2 pr-2 text-right">{t("table.price", locale)}</th>
              <th className="pb-2 text-right">{t("table.action", locale)}</th>
            </tr>
          </thead>
          <tbody>
            {entry.offers.map((offer, idx) => (
              <tr key={`${offer.externalOfferId}-${offer.tourIncValue}-${idx}`} className="border-b border-slate-50 last:border-0">
                <td className="py-2 pr-2 text-slate-700">{offer.hotel || config?.hotel || "—"}</td>
                <td className="py-2 pr-2 text-slate-600">{offer.room || config?.room || "—"}</td>
                <td className="py-2 pr-2 text-slate-600">{offer.meal || config?.meal || "—"}</td>
                <td className="py-2 pr-2 text-slate-600">
                  {offer.tourIncName || offer.tourIncValue}
                  {offer.oneWay && (
                    <span className="ml-1 text-[10px] text-slate-400">
                      ({t("calendar.one_way", locale)})
                    </span>
                  )}
                </td>
                <td className="py-2 pr-2 text-right font-semibold text-slate-900">
                  {offer.price.toLocaleString()} {offer.currency}
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleOrder(offer)}
                    disabled={orderState.loading && orderState.offerExternalId === offer.externalOfferId}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {orderState.loading && orderState.offerExternalId === offer.externalOfferId
                      ? t("calendar.rechecking", locale)
                      : t("calendar.place_order", locale)}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="mt-3 space-y-3 md:hidden">
        {entry.offers.map((offer, idx) => (
          <div key={`${offer.externalOfferId}-${offer.tourIncValue}-${idx}`} className="rounded-xl border border-slate-100 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{offer.hotel || config?.hotel || "—"}</div>
                <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                  {(offer.room || config?.room) && <div>{offer.room || config?.room}</div>}
                  {(offer.meal || config?.meal) && <div>{offer.meal || config?.meal}</div>}
                  <div>
                    {offer.tourIncName || offer.tourIncValue}
                    {offer.oneWay && (
                      <span className="ml-1 text-[10px] text-slate-400">
                        ({t("calendar.one_way", locale)})
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-900">
                  {offer.price.toLocaleString()} {offer.currency}
                </div>
                <button
                  type="button"
                  onClick={() => handleOrder(offer)}
                  disabled={orderState.loading && orderState.offerExternalId === offer.externalOfferId}
                  className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {orderState.loading && orderState.offerExternalId === offer.externalOfferId
                    ? t("calendar.rechecking", locale)
                    : t("calendar.place_order", locale)}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Error message */}
      {orderState.error && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
          {orderState.error}
        </div>
      )}
    </div>
  );
}
