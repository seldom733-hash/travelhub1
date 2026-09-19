"use client";

import { useState, useCallback } from "react";
import { t, useLocale } from "@/lib/i18n";
import Price from "@/components/public/Price";
import { refreshSupplierPrice, type SupplierOffer } from "@/lib/supplier-api";

/**
 * OfferModal — shows all KOMPAS offer variants for a selected date.
 *
 * Each row is one complete SupplierOffer (no field mixing).
 * Includes:
 * - outbound flight info
 * - return flight info
 * - room/meal
 * - price
 * - price verification workflow
 * - request creation
 */
export default function OfferModal({
  date,
  offers,
  summary,
  onClose,
  onRequestCreated,
}: {
  date: string;
  offers: SupplierOffer[];
  summary: {
    departureCity?: string;
    destination?: string;
    adults: number;
    children: number;
    childAges: number[];
    nights: number;
  };
  onClose: () => void;
  onRequestCreated?: (offer: SupplierOffer) => void;
}) {
  const locale = useLocale();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {t("offer.modal_title", locale)} {date}
              </h3>
              <div className="mt-1 flex flex-wrap gap-1 text-xs text-slate-500">
                {summary.departureCity && <span>{summary.departureCity}</span>}
                {summary.destination && (
                  <>
                    <span>→</span>
                    <span>{summary.destination}</span>
                  </>
                )}
                <span>·</span>
                <span>
                  {summary.nights}{" "}
                  {summary.nights === 1
                    ? t("card.night", locale)
                    : t("card.nights", locale)}
                </span>
                <span>·</span>
                <span>
                  {summary.adults} {t("supplier.adults", locale)}
                  {summary.children > 0 &&
                    `, ${summary.children} ${t("supplier.children", locale)}`}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Offer rows */}
        <div className="divide-y divide-slate-100 p-6">
          {offers.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {t("tour.no_offers", locale)}
            </p>
          ) : (
            offers.map((offer, idx) => (
              <OfferRow
                key={`${offer.externalOfferId}-${idx}`}
                offer={offer}
                index={idx + 1}
                onRequestCreated={onRequestCreated}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Single offer row — one complete SupplierOffer, no field mixing. */
function OfferRow({
  offer,
  index,
  onRequestCreated,
}: {
  offer: SupplierOffer;
  index: number;
  onRequestCreated?: (offer: SupplierOffer) => void;
}) {
  const locale = useLocale();
  const [verificationState, setVerificationState] = useState<
    "idle" | "checking" | "confirmed" | "changed" | "error"
  >("idle");
  const [verifiedPrice, setVerifiedPrice] = useState<number | null>(null);
  const [originalPrice] = useState(offer.price.amount);
  const [requestState, setRequestState] = useState<"idle" | "creating" | "done" | "error">("idle");

  const handleVerifyPrice = useCallback(async () => {
    setVerificationState("checking");
    try {
      const result = await refreshSupplierPrice(
        offer.supplierCode,
        offer.externalOfferId,
        offer.externalClaim,
        {
          supplierCode: offer.supplierCode,
          hotel: offer.hotel,
          hotelExternalId: offer.hotelExternalId,
          destination: offer.destination,
          adults: offer.adults,
          children: offer.children,
          childAges: offer.childAges.length > 0 ? offer.childAges : undefined,
          nightsFrom: offer.nights,
          nightsTo: offer.nights,
        },
      );

      if (Math.abs(result.amount - originalPrice) < 0.01) {
        setVerificationState("confirmed");
        setVerifiedPrice(result.amount);
      } else {
        setVerificationState("changed");
        setVerifiedPrice(result.amount);
      }
    } catch {
      setVerificationState("error");
    }
  }, [offer, originalPrice]);

  const handleAcceptPrice = useCallback(() => {
    setVerificationState("confirmed");
  }, []);

  const handleRejectPrice = useCallback(() => {
    setVerificationState("idle");
    setVerifiedPrice(null);
  }, []);

  const handleCreateRequest = useCallback(async () => {
    setRequestState("creating");
    try {
      // TODO: wire to real backend request creation endpoint
      // For now, simulate the flow
      await new Promise((r) => setTimeout(r, 1000));
      setRequestState("done");
      onRequestCreated?.(offer);
    } catch {
      setRequestState("error");
    }
  }, [offer, onRequestCreated]);

  const passengers = [
    `${offer.adults} ${t("supplier.adults", locale)}`,
    offer.children > 0
      ? `${offer.children} ${t("supplier.children", locale)}${
          offer.childAges.length > 0
            ? ` (${offer.childAges.map((a) => `${a}`).join(", ")})`
            : ""
        }`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="py-5">
      {/* Row header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
          {index}
        </span>
        <span className="text-sm font-medium text-slate-500">
          {offer.room ?? "Standard"} · {offer.meal ?? "RO"}
        </span>
        {offer.transport && (
          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
            ✈️ {offer.transport}
          </span>
        )}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {/* Outbound flight */}
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {t("offer.outbound", locale) ?? "ПЕРЕЛЕТ ТУДА"}
          </div>
          <div className="text-sm font-medium text-slate-800">
            {offer.departureDate}
          </div>
          {offer.transport && (
            <div className="mt-0.5 text-xs text-slate-500">{offer.transport}</div>
          )}
        </div>

        {/* Return flight (placeholder — KOMPAS doesn't always provide) */}
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {t("offer.return", locale) ?? "ПЕРЕЛЕТ ОБРАТНО"}
          </div>
          <div className="text-xs text-slate-400">
            {offer.nights}{" "}
            {offer.nights === 1
              ? t("card.night", locale)
              : t("card.nights", locale)}{" "}
            позже
          </div>
        </div>

        {/* Hotel / Room / Meal */}
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {t("offer.accommodation", locale) ?? "НОМЕР / ПИТАНИЕ"}
          </div>
          <div className="text-sm font-medium text-slate-800">
            {offer.hotel?.split("\n")[0]?.trim()}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {offer.room ?? "Standard"} · {offer.meal ?? "RO"}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">{passengers}</div>
        </div>

        {/* Price + Action */}
        <div className="flex flex-col justify-between rounded-lg border border-slate-200 p-3">
          <div>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
              {t("tour.price", locale)}
            </div>
            <div className="text-lg font-bold text-slate-900">
              <Price
                amount={verifiedPrice ?? originalPrice}
                currency={offer.price.currency}
                size="lg"
                withPrefix={false}
              />
            </div>
            <div className="text-[10px] text-slate-400">
              {t("offer.for_all", locale) ?? "за всех"}
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-3">
            {verificationState === "idle" && (
              <button
                onClick={handleVerifyPrice}
                className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
              >
                {t("offer.verify_price", locale) ?? "Проверка цены"}
              </button>
            )}

            {verificationState === "checking" && (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                {t("offer.checking", locale) ?? "Проверяем..."}
              </div>
            )}

            {verificationState === "confirmed" && (
              <button
                onClick={handleCreateRequest}
                disabled={requestState === "creating" || requestState === "done"}
                className="w-full rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {requestState === "done"
                  ? t("offer.request_sent", locale) ?? "✓ Запрос отправлен"
                  : requestState === "creating"
                    ? t("offer.creating", locale) ?? "Создание..."
                    : t("offer.create_request", locale) ?? "Оформить запрос"}
              </button>
            )}

            {verificationState === "changed" && (
              <div className="space-y-2">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                  <p className="text-xs font-medium text-amber-800">
                    {t("offer.price_changed", locale) ?? "Цена изменилась"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-amber-700">
                    {t("offer.was", locale) ?? "Было"}:{" "}
                    <Price
                      amount={originalPrice}
                      currency={offer.price.currency}
                      size="sm"
                      withPrefix={false}
                    />
                  </p>
                  <p className="text-[11px] text-amber-700">
                    {t("offer.now", locale) ?? "Сейчас"}:{" "}
                    <Price
                      amount={verifiedPrice ?? 0}
                      currency={offer.price.currency}
                      size="sm"
                      withPrefix={false}
                    />
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRejectPrice}
                    className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {t("offer.reject", locale) ?? "Отказать"}
                  </button>
                  <button
                    onClick={handleAcceptPrice}
                    className="flex-1 rounded-lg bg-green-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                  >
                    {t("offer.accept", locale) ?? "Принять"}
                  </button>
                </div>
              </div>
            )}

            {verificationState === "error" && (
              <button
                onClick={handleVerifyPrice}
                className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                {t("offer.retry_verify", locale) ?? "Повторить проверку"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
