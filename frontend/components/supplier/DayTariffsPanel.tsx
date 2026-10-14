"use client";

import { useEffect, useState } from "react";
import { t, ti, useLocale } from "@/lib/i18n";
import {
  type SupplierPriceCalendarEntry,
  type SupplierPriceCalendarEntryOffer,
} from "@/lib/supplier-api";
import { useCurrentUser } from "@/lib/use-user";
import OfferRow, { type OfferCustomer, type OfferSummary } from "@/components/supplier/OfferRow";
import { TravelerFields } from "@/components/supplier/OfferModal";

/** Lightweight client checks — the backend (§4.8.8/4.8.9) is the authority. */
function isValidPhoneLocal(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15;
}
function isValidEmailLocal(raw: string): boolean {
  return /^\S+@\S+\.\S+$/.test(raw);
}

/**
 * DayTariffsPanel — the INLINE replacement for the §4.8 modal (user decision,
 * 2026-10-13: «не надо модальное окно выводить»).
 *
 * Renders on the page under the price calendar:
 *  - header: selected date + the day's summary (nights/travelers)
 *  - one `OfferRow` per tariff of that day (room/meal/price + «Оформить
 *    заявку» — §4.8.4 per-offer submit, unchanged)
 *  - the shared «Данные путешественника» block (§4.8.13) BELOW the variants:
 *    ONE form feeds every row of the day, so a user fills their phone once and
 *    can submit any variant.
 *
 * State is lifted to the page (TourDetail/HotelDetail): the panel is a pure
 * view of `entry` + the shared traveler form.
 */
export default function DayTariffsPanel({
  entry,
  title,
  supplierCode,
  summary,
  service,
  onRequestCreated,
  emptyText,
}: {
  /** The selected calendar day (null → neutral placeholder, never an error). */
  entry: SupplierPriceCalendarEntry | null;
  /** Tour/hotel title shown in the header. */
  title: string;
  /** Supplier queried for this calendar (authoritative when offers omit it). */
  supplierCode: string;
  summary: OfferSummary;
  /** Service category ("tours" | "hotels"). */
  service?: string;
  onRequestCreated?: (offer: SupplierPriceCalendarEntryOffer) => void;
  emptyText?: string;
}) {
  const locale = useLocale();
  const user = useCurrentUser();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // §4.8.6: autofill from the existing identity (account) when available.
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

  if (!entry) {
    return (
      <div
        data-testid="day-tariffs-empty"
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"
      >
        <p className="text-sm text-slate-500">
          {emptyText ?? t("offer.select_day_hint", locale)}
        </p>
      </div>
    );
  }

  const offers = entry.offers ?? [];

  return (
    <section aria-labelledby="day-tariffs-title" className="rounded-2xl border border-slate-200 bg-white">
      {/* Header — the selected day (§4.8.1, inline) */}
      <div className="border-b border-slate-200 px-5 py-4">
        <h3 id="day-tariffs-title" className="text-base font-bold text-slate-900">
          {t("offer.request_title", locale)}
        </h3>
        <div className="mt-0.5 text-sm font-medium text-slate-700">{title}</div>
        <div className="mt-1 flex flex-wrap gap-1 text-xs text-slate-500">
          <span>{entry.date}</span>
          <span>·</span>
          <span>
            {summary.nights}{" "}
            {summary.nights === 1 ? t("card.night", locale) : t("card.nights", locale)}
          </span>
          <span>·</span>
          <span>
            {summary.adults} {t("supplier.adults", locale)}
            {summary.children > 0 && `, ${summary.children} ${t("supplier.children", locale)}`}
          </span>
          <span>·</span>
          <span>{ti("offer.tariffs_count", locale, { n: String(offers.length) })}</span>
        </div>
      </div>

      <div className="px-5 pb-5">
        <h4 className="mb-2 pt-4 text-sm font-semibold text-slate-800">
          {t("offer.variants_title", locale)}
        </h4>

        {offers.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            {entry.absenceText ?? t("tour.no_offers", locale)}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {offers.map((offer, idx) => (
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
            ))}
          </div>
        )}

        {/* §4.8.13: ONE shared traveler form for every tariff of the day */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
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
    </section>
  );
}
