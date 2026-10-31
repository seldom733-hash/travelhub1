"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { accountApi } from "@/lib/account-api";
import { auth } from "@/lib/api";
import { COUNTRY_NAMES } from "@/lib/locations";
import { postLoginTarget, safeNextPath } from "@/lib/routes";
import { t, useLocale } from "@/lib/i18n";
import LocaleSelector from "@/components/public/LocaleSelector";

function RegisterPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const locale = useLocale();
  const rawNext = params.get("next");
  const next = safeNextPath(rawNext);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
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
      router.replace(postLoginTarget(res.user.role, rawNext));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-xl border border-dark-border bg-dark-surface px-3.5 py-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-gold";
  const label = "mb-1.5 block text-xs font-semibold text-neutral-300";

  return (
    <div className="min-h-screen bg-dark text-white">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="relative hidden overflow-hidden bg-dark-surface lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero2.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-dark/90 via-dark/55 to-dark/20" />
          <div className="relative flex h-full flex-col justify-between p-12">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-gold text-base font-bold text-dark">N</span>
              <span className="font-display text-lg font-semibold text-white">Navitravel</span>
            </Link>
            <div className="max-w-md">
              <p className="font-display text-4xl font-semibold leading-[1.08] text-white">
                {t("register.subtitle", locale)}
              </p>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-neutral-300">
                {t("footer.brand_description", locale)}
              </p>
            </div>
            <span className="text-xs text-neutral-400">© {new Date().getFullYear()} Navitravel</span>
          </div>
        </aside>

        <main className="flex items-center justify-center px-5 py-12 sm:px-10">
          <div className="w-full max-w-[520px]">
            <div className="mb-7 flex items-center justify-between lg:hidden">
              <Link href="/" className="flex items-center gap-2.5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-gold text-base font-bold text-dark">N</span>
                <span className="font-display text-base font-semibold">Navitravel</span>
              </Link>
              <LocaleSelector />
            </div>

            <div className="mb-7">
              <h1 className="font-display text-3xl font-semibold leading-tight text-white">{t("register.title", locale)}</h1>
              <p className="mt-2 text-sm text-neutral-400">{t("register.subtitle", locale)}</p>
              <div className="mt-4 hidden lg:block"><LocaleSelector /></div>
            </div>

            <form onSubmit={(e) => void submit(e)} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="reg-first" className={label}>{t("register.first_name", locale)}</label>
                  <input id="reg-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className={field} />
                </div>
                <div>
                  <label htmlFor="reg-last" className={label}>{t("register.last_name", locale)}</label>
                  <input id="reg-last" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className={field} />
                </div>
              </div>

              <div>
                <label htmlFor="reg-email" className={label}>{t("auth.email_label", locale)}</label>
                <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className={field} placeholder="you@example.com" />
              </div>

              <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
                <div>
                  <label htmlFor="reg-country" className={label}>{t("register.country", locale)}</label>
                  <select id="reg-country" value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="country" className={field}>
                    {Object.keys(COUNTRY_NAMES).map((code) => (
                      <option key={code} value={code}>{COUNTRY_NAMES[code][locale]} ({code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="reg-phone" className={label}>{t("register.phone", locale)}</label>
                  <input id="reg-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required className={field} placeholder="+994 50 000 00 00" />
                </div>
              </div>
              <p className="-mt-2 text-xs text-neutral-500">{t("register.phone_hint", locale)}</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="reg-pass" className={label}>{t("auth.password_label", locale)}</label>
                  <input id="reg-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} className={field} placeholder="••••••••" />
                </div>
                <div>
                  <label htmlFor="reg-confirm" className={label}>{t("register.password_confirm", locale)}</label>
                  <input id="reg-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required className={field} placeholder="••••••••" />
                </div>
              </div>

              {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200">{error}</div>}

              <button type="submit" disabled={busy || !email || !phone || password.length < 8} className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-bold text-dark transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? t("register.busy", locale) : t("register.submit", locale)}
              </button>
              <p className="text-center text-xs text-neutral-500">{t("register.by_registering", locale)}</p>
            </form>

            <p className="mt-6 text-center text-xs text-neutral-400">
              {t("auth.has_account", locale)}{" "}
              <Link href={`/login${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-gold hover:text-gold-light">
                {t("auth.login_link", locale)}
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-dark" />}>
      <RegisterPageInner />
    </Suspense>
  );
}
