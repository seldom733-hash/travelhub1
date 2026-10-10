"use client";

import { useState } from "react";
import { COUNTRY_NAMES } from "@/lib/locations";
import { t, useLocale } from "@/lib/i18n";
import { guestCheckout, PublicApiError } from "@/lib/public-api";

/**
 * M4.5 §23 — Guest checkout onboarding (anonymous → Request).
 *
 * Форма собирает только контактные данные (email/телефон/ФИО) — паспортные
 * и traveler-данные для идентичности НЕ требуются (§23); traveler-сбор остаётся
 * отдельным этапом после конверсии в Order. Цену клиент не задаёт: коммерческие
 * условия фиксирует supplier-флоу на сервере.
 */
interface GuestCheckoutFormProps {
  /** Привязка заявки к продукту (productSnapshot); без продукта — общий запрос. */
  productId?: string;
}

const fieldCls =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none";
const labelCls = "block text-xs font-medium uppercase tracking-wide text-slate-500";

export default function GuestCheckoutForm({ productId }: GuestCheckoutFormProps) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("AZ");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [travelers, setTravelers] = useState(1);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  if (reference !== null) {
    return (
      <div
        role="status"
        className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
      >
        {t("checkout.guest_success", locale)} {reference}
        <p className="mt-1 text-xs opacity-80">{t("checkout.guest_success_hint", locale)}</p>
      </div>
    );
  }

  const submit = async () => {
    setErrorKey(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErrorKey("checkout.guest_error_email");
      return;
    }
    if (phone.replace(/\D/g, "").length < 9) {
      setErrorKey("checkout.guest_error_phone");
      return;
    }
    setBusy(true);
    try {
      const result = await guestCheckout({
        productId,
        email: email.trim(),
        phone: phone.trim(),
        country,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        travelerCount: travelers,
      });
      setReference(result.request.referenceNumber);
    } catch (e) {
      const status = e instanceof PublicApiError ? e.status : 0;
      if (status === 409) setErrorKey("checkout.guest_error_conflict");
      else if (status === 429) setErrorKey("checkout.guest_error_throttle");
      else if (status === 422) setErrorKey("checkout.guest_error_phone");
      else if (status === 404) setErrorKey("checkout.guest_error_product");
      else if (status === 400) setErrorKey("checkout.guest_error_email");
      else setErrorKey("checkout.guest_error_generic");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-xl border border-blue-600 px-4 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        {t("checkout.guest_cta", locale)}
      </button>
    );
  }

  return (
    <form
      className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="text-xs leading-relaxed text-slate-500">{t("checkout.guest_subtitle", locale)}</p>

      <div>
        <label htmlFor="guest-checkout-email" className={labelCls}>
          {t("checkout.guest_email", locale)} *
        </label>
        <input
          id="guest-checkout-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="guest-checkout-country" className={labelCls}>
            {t("checkout.guest_country", locale)}
          </label>
          <select
            id="guest-checkout-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            autoComplete="country"
            className={fieldCls}
          >
            {Object.keys(COUNTRY_NAMES).map((code) => (
              <option key={code} value={code}>
                {COUNTRY_NAMES[code][locale]} ({code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="guest-checkout-phone" className={labelCls}>
            {t("checkout.guest_phone", locale)} *
          </label>
          <input
            id="guest-checkout-phone"
            type="tel"
            inputMode="tel"
            required
            autoComplete="tel"
            placeholder="+994 50 000 00 00"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={fieldCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="guest-checkout-first-name" className={labelCls}>
            {t("checkout.guest_first_name", locale)}
          </label>
          <input
            id="guest-checkout-first-name"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={fieldCls}
          />
        </div>
        <div>
          <label htmlFor="guest-checkout-last-name" className={labelCls}>
            {t("checkout.guest_last_name", locale)}
          </label>
          <input
            id="guest-checkout-last-name"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={fieldCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor="guest-checkout-travelers" className={labelCls}>
          {t("checkout.guest_travelers", locale)}
        </label>
        <select
          id="guest-checkout-travelers"
          value={String(travelers)}
          onChange={(e) => setTravelers(Number(e.target.value))}
          className={fieldCls}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {errorKey !== null && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {t(errorKey, locale)}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "…" : t("checkout.guest_submit", locale)}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          {t("checkout.guest_cancel", locale)}
        </button>
      </div>
    </form>
  );
}
