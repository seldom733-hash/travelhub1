"use client";

import { useState, useCallback } from "react";
import { t, useLocale } from "@/lib/i18n";
import Price from "@/components/public/Price";
import type { SupplierOffer } from "@/lib/supplier-api";

/**
 * PriceConfigurator — displays a single SupplierOffer as a configured price card.
 *
 * Shows: hotel, room, meal, nights, adults, children, price, transport.
 * No KOMPAS-specific logic — works with any SupplierOffer.
 */
export default function PriceConfigurator({
  offer,
  loading = false,
  error = null,
}: {
  offer: SupplierOffer | null;
  loading?: boolean;
  error?: string | null;
}) {
  const locale = useLocale();

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-1/3 mb-4" />
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-2" />
        <div className="h-4 bg-slate-200 rounded w-2/3 mb-4" />
        <div className="h-8 bg-slate-200 rounded w-1/4" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <p className="text-sm font-medium text-amber-800">{error}</p>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <p className="text-sm text-slate-500">{t("supplier.no_offer", locale)}</p>
      </div>
    );
  }

  const passengers = [
    `${offer.adults} ${t("supplier.adults", locale)}`,
    offer.children > 0
      ? `${offer.children} ${t("supplier.children", locale)}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
      {/* Hotel */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{offer.hotel}</h3>
        {offer.hotelExternalId && (
          <p className="text-xs text-slate-400">ID: {offer.hotelExternalId}</p>
        )}
      </div>

      {/* Room + Meal */}
      <div className="flex flex-wrap gap-2">
        {offer.room && (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            {offer.room}
          </span>
        )}
        {offer.meal && (
          <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            {offer.meal}
          </span>
        )}
        {offer.transport && (
          <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
            {offer.transport}
          </span>
        )}
      </div>

      {/* Search parameters */}
      <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
        <div>
          <span className="font-medium">{t("supplier.nights", locale)}:</span>{" "}
          {offer.nights}
        </div>
        <div>
          <span className="font-medium">{t("supplier.passengers", locale)}:</span>{" "}
          {passengers}
        </div>
        <div>
          <span className="font-medium">{t("supplier.departure", locale)}:</span>{" "}
          {offer.departureDate}
        </div>
        {offer.supplierCode && (
          <div>
            <span className="font-medium">{t("supplier.source", locale)}:</span>{" "}
            {offer.supplierCode}
          </div>
        )}
      </div>

      {/* Price */}
      <div className="border-t border-slate-100 pt-4">
        <Price
          amount={offer.price.amount}
          currency={offer.price.currency}
          size="lg"
          withPrefix={false}
        />
      </div>
    </div>
  );
}
