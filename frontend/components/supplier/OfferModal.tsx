"use client";

import { useCallback, useEffect, useState } from "react";
import { t, useLocale } from "@/lib/i18n";
import Price from "@/components/public/Price";
import {
  createTourRequest,
  isCaptchaRequired,
  type SupplierPriceCalendarEntryOffer,
  type TourRequestResult,
} from "@/lib/supplier-api";
import { useCurrentUser } from "@/lib/use-user";
import { useKompasCaptcha } from "@/lib/useKompasCaptcha";
import { KompasCaptchaModal } from "@/components/supplier/KompasCaptchaModal";

/** Lightweight client checks — the backend (§4.8.8/4.8.9) is the authority. */
function isValidPhoneLocal(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}
function isValidEmailLocal(raw: string): boolean {
  return /^\S+@\S+\.\S+$/.test(raw);
}

/** Calendar/tour context carried into the create-request payload (§4.8). */
type OfferSummary = {
  departureCity?: string;
  destination?: string;
  country?: string;
  adults: number;
  children: number;
  childAges: number[];
  nights: number;
};

/**
 * OfferModal — rich request modal (§4.8): tour/date/travelers header,
 * per-offer variant rows with a per-offer «Подать заявку», and the shared
 * «Данные путешественника» block (4.8.13, below variants).
 *
 * - Registered users are autofilled from their account (4.8.6); guests start
 *   empty with buttons disabled until the data is valid (4.8.7).
 * - Phone required (E.164 on the server), email optional but must be valid
 *   when present (4.8.8/4.8.9).
 * - No pre-submission «verify price» UI (4.8.10): the request is created
 *   directly, the server re-checks the price authoritatively; captcha
 *   challenges are still handled (challenge → solve → retry create).
 */
export default function OfferModal({
  date,
  tour,
  offers,
  supplierCode,
  summary,
  onClose,
  onRequestCreated,
}: {
  date: string;
  /** Tour/hotel title shown in the header (4.8.1). */
  tour: string;
  offers: SupplierPriceCalendarEntryOffer[];
  /** Supplier queried for this calendar (authoritative when offers omit it). */
  supplierCode: string;
  summary: OfferSummary;
  onClose: () => void;
  onRequestCreated?: (offer: SupplierPriceCalendarEntryOffer) => void;
}) {
  const locale = useLocale();
  const user = useCurrentUser();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // 4.8.6: autofill from the existing identity (account) when available.
  useEffect(() => {
    if (!user) return;
    setFirstName((prev) => prev || (user.fullName?.trim().split(/\s+/)[0] ?? ""));
    setLastName(
      (prev) =>
        prev ||
        (user.fullName?.trim().split(/\s+/).slice(1).join(" ") || ""),
    );
    setPhone((prev) => prev || (user.phone ?? ""));
    setEmail((prev) => prev || (user.email ?? ""));
  }, [user]);

  const trimmedPhone = phone.trim();
  const trimmedEmail = email.trim();
  const phoneError =
    trimmedPhone !== "" && !isValidPhoneLocal(trimmedPhone)
      ? t("offer.phone_invalid", locale)
      : null;
  const emailError =
    trimmedEmail !== "" && !isValidEmailLocal(trimmedEmail)
      ? t("offer.email_invalid", locale)
      : null;
  const canSubmit = trimmedPhone !== "" && phoneError === null && emailError === null;

  const customer = canSubmit
    ? {
        phone: trimmedPhone,
        email: trimmedEmail !== "" ? trimmedEmail : undefined,
        firstName: firstName.trim() !== "" ? firstName.trim() : undefined,
        lastName: lastName.trim() !== "" ? lastName.trim() : undefined,
      }
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (4.8.1): title · tour · date/nights/travelers */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {t("offer.request_title", locale)}
              </h3>
              <div className="mt-0.5 text-sm font-medium text-slate-700">
                {tour}
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-xs text-slate-500">
                <span>{date}</span>
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

        {/* Offer rows (4.8.4): variants list with per-offer submit */}
        <div className="p-6">
          <h4 className="mb-2 text-sm font-semibold text-slate-800">
            {t("offer.variants_title", locale)}
          </h4>
          <div className="divide-y divide-slate-100">
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
                  supplierCode={supplierCode}
                  summary={summary}
                  customer={customer}
                  onRequestCreated={onRequestCreated}
                />
              ))
            )}
          </div>

          {/* 4.8.13: traveler data below the variants */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-800">
              {t("offer.customer_title", locale)}
            </h4>
            {user && (
              <p className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                {t("offer.registered_hint", locale)}
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="offer-first-name"
                  className="mb-1 block text-xs font-medium text-slate-600"
                >
                  {t("checkout.guest_first_name", locale)}
                </label>
                <input
                  id="offer-first-name"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label
                  htmlFor="offer-last-name"
                  className="mb-1 block text-xs font-medium text-slate-600"
                >
                  {t("checkout.guest_last_name", locale)}
                </label>
                <input
                  id="offer-last-name"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label
                  htmlFor="offer-phone"
                  className="mb-1 block text-xs font-medium text-slate-600"
                >
                  {t("checkout.guest_phone", locale)} *
                </label>
                <input
                  id="offer-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+994 50 000 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 ${
                    phoneError ? "border-red-300" : "border-slate-300"
                  }`}
                />
                {phoneError && (
                  <p role="alert" className="mt-1 text-xs text-red-600">
                    {phoneError}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="offer-email"
                  className="mb-1 block text-xs font-medium text-slate-600"
                >
                  {t("checkout.guest_email", locale)}
                </label>
                <input
                  id="offer-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 ${
                    emailError ? "border-red-300" : "border-slate-300"
                  }`}
                />
                {emailError && (
                  <p role="alert" className="mt-1 text-xs text-red-600">
                    {emailError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Single offer row — one complete SupplierOffer, no field mixing. */
function OfferRow({
  offer,
  index,
  supplierCode,
  summary,
  customer,
  onRequestCreated,
}: {
  offer: SupplierPriceCalendarEntryOffer;
  index: number;
  /** Supplier of the calendar query — used when the offer omits its own. */
  supplierCode: string;
  /** Calendar/tour context for the create-request payload (§4.8). */
  summary: OfferSummary;
  /** Validated traveler data from the modal, or null while invalid (4.8.7). */
  customer: {
    phone: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  } | null;
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
  }, [offer, summary, resolvedSupplier, customer, checkResponseForCaptcha, onRequestCreated]);

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
