"use client";

import { useCallback, useState } from "react";
import { t, useLocale } from "@/lib/i18n";
import Price from "@/components/public/Price";
import {
  createTourRequest,
  isCaptchaRequired,
  type SupplierPriceCalendarEntryOffer,
  type TourRequestResult,
} from "@/lib/supplier-api";
import { useKompasCaptcha } from "@/lib/useKompasCaptcha";
import { KompasCaptchaModal } from "@/components/supplier/KompasCaptchaModal";

/** Calendar/tour context carried into the create-request payload (§4.8). */
export type OfferSummary = {
  departureCity?: string;
  destination?: string;
  country?: string;
  adults: number;
  children: number;
  childAges: number[];
  nights: number;
};

/** Validated traveler data shared by every row of a day (4.8.7). */
export type OfferCustomer = {
  phone: string;
  email?: string;
  firstName?: string;
  lastName?: string;
} | null;

/**
 * OfferRow — one complete SupplierOffer as a requestable row: variant header
 * (room/meal), content grid, price and a per-offer «Подать заявку».
 *
 * Shared by the §4.8 modal and the inline day-tariffs panel (no modal): the
 * create flow is IDENTICAL (direct create, server-authoritative re-check,
 * captcha challenge → solve → retry), only the surrounding chrome differs.
 *
 * `service` selects the backend re-check adapter — "hotels" for stay-only
 * offers (no departure city), "tours" otherwise.
 */
export default function OfferRow({
  offer,
  index,
  supplierCode,
  summary,
  customer,
  service,
  onRequestCreated,
}: {
  offer: SupplierPriceCalendarEntryOffer;
  index: number;
  /** Supplier of the calendar query — used when the offer omits its own. */
  supplierCode: string;
  /** Calendar/tour context for the create-request payload (§4.8). */
  summary: OfferSummary;
  /** Validated traveler data from the shared form, or null while invalid. */
  customer: OfferCustomer;
  /** Service category of the offer ("tours" | "hotels"). */
  service?: string;
  onRequestCreated?: (offer: SupplierPriceCalendarEntryOffer) => void;
}) {
  const locale = useLocale();
  const resolvedSupplier = offer.supplierCode || supplierCode;
  const [requestState, setRequestState] = useState<
    "idle" | "creating" | "done" | "error"
  >("idle");
  const [serverError, setServerError] = useState<"phone" | "email" | "generic">(
    "generic",
  );
  const [created, setCreated] = useState<TourRequestResult | null>(null);
  const { challenge, checkResponseForCaptcha, submit, refresh, cancel } =
    useKompasCaptcha();

  const handleCreateRequest = useCallback(async () => {
    if (!customer) return;
    setRequestState("creating");
    setServerError("generic");
    try {
      const result = await createTourRequest({
        supplierCode: resolvedSupplier,
        externalOfferId: offer.externalOfferId,
        // §SERVICE-PASSTHROUGH: the category drives the backend re-check
        // adapter. Defaulting to "tours" keeps every existing tour caller
        // (OfferModal) byte-identical.
        service: service || "tours",
        hotel: offer.hotel?.split("\n")[0]?.trim() ?? "",
        hotelExternalId: offer.hotelExternalId,
        departureDate: offer.departureDate,
        nights: offer.nights,
        adults: offer.adults,
        children: offer.children,
        childAges: offer.childAges.length > 0 ? offer.childAges : undefined,
        room: offer.room,
        meal: offer.meal,
        price: offer.price,
        currency: offer.currency,
        // City of stay only: when the product has no distinct city attribute,
        // summary.destination collapses to the country — never pin it as city.
        destination:
          offer.destination ||
          (summary.destination && summary.destination !== summary.country ? summary.destination : undefined),
        departureCity: summary.departureCity,
        country: summary.country || undefined,
        tourIncValue: offer.tourIncValue || undefined,
        tourIncName: offer.tourIncName || undefined,
        customer,
      });

      // Captcha challenge (4.8): surfaced as a 200 payload — show the
      // challenge; the create is retried after the answer is verified.
      if (isCaptchaRequired(result)) {
        checkResponseForCaptcha(result);
        setRequestState("idle");
        return;
      }

      setCreated(result);
      setRequestState("done");
      onRequestCreated?.(offer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Invalid phone number")) setServerError("phone");
      else if (msg.includes("Invalid email address")) setServerError("email");
      else setServerError("generic");
      setRequestState("error");
    }
  }, [offer, summary, resolvedSupplier, customer, service, checkResponseForCaptcha, onRequestCreated]);

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

  const priceChanged =
    created !== null && Math.abs(created.displayedPrice - offer.price) >= 0.01;

  return (
    <div className="py-5">
      {challenge && (
        <KompasCaptchaModal
          challengeId={challenge.challengeId}
          captchaImage={challenge.captchaImage}
          status={challenge.status as any}
          supplier={challenge.supplier}
          onSubmit={async (answer) => {
            await submit(answer, async () => {
              // Captcha verified — the original operation was resumed; the
              // request creation itself never completed, so retry it now.
              await handleCreateRequest();
            });
          }}
          onRefresh={refresh}
          onCancel={() => {
            cancel();
            setRequestState("idle");
          }}
        />
      )}
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

        {/* Return flight — KOMPAS SAMO search does not provide return flight details */}
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {t("offer.return", locale) ?? "ПЕРЕЛЕТ ОБРАТНО"}
          </div>
          <div className="text-xs text-slate-400">
            {t("offer.return_not_available", locale) ?? "Информация не предоставлена поставщиком"}
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
                amount={created?.displayedPrice ?? offer.price}
                currency={offer.currency}
                size="lg"
                withPrefix={false}
              />
            </div>
            <div className="text-[10px] text-slate-400">
              {t("offer.for_all", locale) ?? "за всех"}
            </div>
          </div>

          {/* Action (4.8.4): per-offer request, no verify step (4.8.10) */}
          <div className="mt-3">
            {requestState === "error" && (
              <p
                role="alert"
                className="mb-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700"
              >
                {serverError === "phone"
                  ? t("offer.phone_invalid", locale)
                  : serverError === "email"
                    ? t("offer.email_invalid", locale)
                    : t("offer.request_error", locale)}
              </p>
            )}

            {requestState === "done" && created ? (
              <div className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                <p className="text-xs font-semibold text-emerald-800">
                  ✓ {t("offer.request_success", locale)} — {created.referenceNumber}
                </p>
                <p className="text-[11px] text-emerald-700">
                  {t("offer.request_success_detail", locale)}
                </p>
                {priceChanged && (
                  <div className="mt-1 rounded border border-amber-200 bg-amber-50 p-1.5">
                    <p className="text-[11px] font-medium text-amber-800">
                      {t("offer.price_changed", locale)}
                    </p>
                    <p className="text-[11px] text-amber-700">
                      {t("offer.was", locale)}:{" "}
                      <Price amount={offer.price} currency={offer.currency} size="sm" withPrefix={false} /> →{" "}
                      {t("offer.now", locale)}:{" "}
                      <Price amount={created.displayedPrice} currency={offer.currency} size="sm" withPrefix={false} />
                    </p>
                  </div>
                )}
              </div>
            ) : requestState === "creating" ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                {t("offer.creating", locale) ?? "Создание..."}
              </div>
            ) : (
              <button
                onClick={handleCreateRequest}
                disabled={!customer}
                className="w-full rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("offer.submit_request", locale)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
