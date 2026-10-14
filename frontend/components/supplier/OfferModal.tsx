"use client";

import { useEffect, useState } from "react";
import { t, useLocale } from "@/lib/i18n";
import {
  type SupplierPriceCalendarEntryOffer,
} from "@/lib/supplier-api";
import { useCurrentUser } from "@/lib/use-user";
import OfferRow, { type OfferCustomer, type OfferSummary } from "@/components/supplier/OfferRow";

/** Lightweight client checks — the backend (§4.8.8/4.8.9) is the authority. */
function isValidPhoneLocal(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}
function isValidEmailLocal(raw: string): boolean {
  return /^\S+@\S+\.\S+$/.test(raw);
}

/**
 * OfferModal — rich request modal (§4.8): tour/date/travelers header,
 * per-offer variant rows with a per-offer «Подать заявку», and the shared
 * «Данные путешественника» block (4.8.13, below variants).
 *
 * The variant rows and the create flow live in the shared `OfferRow` (the
 * inline day-tariffs panel uses the same component); this file owns only the
 * modal chrome + the shared traveler form.
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
  service,
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
  /** Service category ("tours" | "hotels") — forwarded to the create payload. */
  service?: string;
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

  const customer: OfferCustomer = canSubmit
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
                  service={service}
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
            <TravelerFields
              firstName={firstName}
              lastName={lastName}
              phone={phone}
              email={email}
              phoneError={phoneError}
              emailError={emailError}
              onFirstName={setFirstName}
              onLastName={setLastName}
              onPhone={setPhone}
              onEmail={setEmail}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The four §4.8.13 traveler inputs — shared between the modal and the inline
 * day-tariffs panel (same ids/labels so a11y and tests stay identical).
 */
export function TravelerFields({
  firstName,
  lastName,
  phone,
  email,
  phoneError,
  emailError,
  onFirstName,
  onLastName,
  onPhone,
  onEmail,
}: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  phoneError: string | null;
  emailError: string | null;
  onFirstName: (v: string) => void;
  onLastName: (v: string) => void;
  onPhone: (v: string) => void;
  onEmail: (v: string) => void;
}) {
  const locale = useLocale();
  return (
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
          onChange={(e) => onFirstName(e.target.value)}
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
          onChange={(e) => onLastName(e.target.value)}
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
          onChange={(e) => onPhone(e.target.value)}
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
          onChange={(e) => onEmail(e.target.value)}
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
  );
}
