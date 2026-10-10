"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PublicLayout from "@/components/PublicLayout";
import { accountApi } from "@/lib/account-api";
import { auth } from "@/lib/api";
import { COUNTRY_NAMES } from "@/lib/locations";
import { postLoginTarget, safeNextPath } from "@/lib/routes";
import { t, useLocale } from "@/lib/i18n";

/**
 * PHASE 1 STEP 1.9 §4/§7 + M4.3 §15-16 — публичная self-registration BUYER.
 * - создаёт ТОЛЬКО BUYER (backend игнорирует/отклоняет любые forged role);
 * - M4.3: country + phone — phone-first identity; сервер нормализует phone в
 *   canonical E.164 (loginPhone) по registration country (default AZ), дубликаты
 *   телефона/email → 409; клиентская проверка только грубая (сервер авторитетен);
 * - после регистрации пользователь автоматически залогинен (accessToken) и
 *   возвращается к исходному public контексту через safe ?next= (postLoginTarget);
 * - locale сохраняется (LocaleProvider/localStorage) через auth roundtrip;
 * - frontend НЕ отправляет customerId/partnerId/role — backend их отклоняет.
 */
function RegisterPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const locale = useLocale();
  // rawNext — исходный ?next= (null при отсутствии); next — санитизированный для
  // ссылок. postLoginTarget получает rawNext (Step 1.13: BUYER без next → /account).
  const rawNext = params.get("next");
  const next = safeNextPath(rawNext);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  // M4.3: регистрационная страна (ISO alpha-2, справочник COUNTRY_NAMES) +
  // телефон (нормализация/валидация — на сервере).
  const [country, setCountry] = useState("AZ");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("register.password_mismatch", locale));
      return;
    }
    // Грубая клиентская проверка (сервер повторяет авторитетно): ≥9 цифр.
    const digits = phone.replace(/\D/g, "");
    if (!digits) {
      setError(t("register.phone_required", locale));
      return;
    }
    if (digits.length < 9) {
      setError(t("register.phone_invalid", locale));
      return;
    }
    setBusy(true);
    try {
      const res = await accountApi.register({
        email,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        country,
        phone,
      });
      auth.setToken(res.accessToken);
      // BUYER → public return context (products/search/category) / /account deep-link,
      // иначе /account (Buyer Cabinet home, Step 1.13).
      router.replace(postLoginTarget(res.user.role, rawNext));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicLayout>
      <div className="mx-auto flex max-w-6xl justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900">{t("register.title", locale)}</h1>
            <p className="mt-1 text-sm text-slate-500">{t("register.subtitle", locale)}</p>
          </div>

          <form onSubmit={(e) => void submit(e)} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-first" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t("register.first_name", locale)}
                </label>
                <input
                  id="reg-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label htmlFor="reg-last" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t("register.last_name", locale)}
                </label>
                <input
                  id="reg-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <label htmlFor="reg-email" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("auth.email_label", locale)}
            </label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="mb-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              placeholder="you@example.com"
            />

            <div className="mb-4 grid grid-cols-[1fr_1.4fr] gap-3">
              <div>
                <label htmlFor="reg-country" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t("register.country", locale)}
                </label>
                <select
                  id="reg-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  autoComplete="country"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                >
                  {Object.keys(COUNTRY_NAMES).map((code) => (
                    <option key={code} value={code}>
                      {COUNTRY_NAMES[code][locale]} ({code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reg-phone" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t("register.phone", locale)}
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  placeholder="+994 50 000 00 00"
                />
              </div>
            </div>
            <p className="-mt-2 mb-4 text-xs text-slate-400">{t("register.phone_hint", locale)}</p>

            <label htmlFor="reg-pass" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("auth.password_label", locale)}
            </label>
            <input
              id="reg-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              className="mb-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              placeholder="••••••••"
            />

            <label htmlFor="reg-confirm" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              {t("register.password_confirm", locale)}
            </label>
            <input
              id="reg-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              className="mb-5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              placeholder="••••••••"
            />

            {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}

            <button
              type="submit"
              disabled={busy || !email || !phone || password.length < 8}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? t("register.busy", locale) : t("register.submit", locale)}
            </button>

            <p className="mt-4 text-center text-xs text-slate-400">{t("register.by_registering", locale)}</p>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            {t("auth.has_account", locale)}{" "}
            <Link href={`/login${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-blue-600 hover:text-blue-700">
              {t("auth.login_link", locale)}
            </Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <RegisterPageInner />
    </Suspense>
  );
}
