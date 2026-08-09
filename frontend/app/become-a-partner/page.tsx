"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PublicLayout from "@/components/PublicLayout";
import { partnerOnboardingApi, type ApplicantType } from "@/lib/partner-onboarding-api";
import { publicApi, type PublicCategory } from "@/lib/public-api";
import { auth } from "@/lib/api";
import { t, useLocale } from "@/lib/i18n";

const COUNTRIES = ["AZ", "GE", "KZ", "UZ", "RU", "TR", "AE", "DE", "US", "GB", "FR", "IT", "ES"];

/**
 * PHASE 1 STEP 1.10 §6/§27 — /become-a-partner (public Partner registration).
 * Регистрация ≠ approval: создаёт User (PARTNER) + DRAFT PartnerApplication.
 * Selling-доступ появится ТОЛЬКО после approve в review queue. Role/partnerId/
 * status фронтенд не отправляет (backend отклоняет forged поля → 422).
 */
function BecomeAPartnerInner() {
  const router = useRouter();
  const locale = useLocale();

  const [applicantType, setApplicantType] = useState<ApplicantType>("INDIVIDUAL");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [brandName, setBrandName] = useState("");
  const [country, setCountry] = useState("");
  const [legalName, setLegalName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxId, setTaxId] = useState("");
  const [website, setWebsite] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [terms, setTerms] = useState(false);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void publicApi
      .listCategories()
      .then((c) => {
        if (alive) setCategories(c);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const toggleCategory = (slug: string) =>
    setServiceCategories((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("register.password_mismatch", locale));
      return;
    }
    if (!terms) {
      setError(t("partner.terms_required", locale));
      return;
    }
    setBusy(true);
    try {
      const res = await partnerOnboardingApi.register({
        email,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        applicantType,
        brandName,
        country,
        legalName: legalName || undefined,
        registrationNumber: registrationNumber || undefined,
        taxId: taxId || undefined,
        website: website || undefined,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        address: address || undefined,
        businessDescription: businessDescription || undefined,
        serviceCategories: serviceCategories.length > 0 ? serviceCategories : undefined,
        termsAccepted: true,
      });
      auth.setToken(res.accessToken);
      // Подавший заявку → /partner/onboarding (статус); НЕ /partner cabinet.
      router.replace("/partner/onboarding");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100";
  const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500";

  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-600 text-xl font-bold text-white">T</div>
          <h1 className="text-2xl font-bold text-slate-900">{t("partner.reg_title", locale)}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{t("partner.reg_subtitle", locale)}</p>
          <div className="mx-auto mt-4 inline-flex max-w-xl items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-xs text-amber-700">
            <span aria-hidden>⏳</span> {t("partner.reg_notice", locale)}
          </div>
        </div>

        <form onSubmit={(e) => void submit(e)} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-slate-700">{t("partner.identity_section", locale)}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="p-first" className={labelCls}>{t("register.first_name", locale)}</label>
                <input id="p-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-last" className={labelCls}>{t("register.last_name", locale)}</label>
                <input id="p-last" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-email" className={labelCls}>{t("auth.email_label", locale)}</label>
                <input id="p-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-pass" className={labelCls}>{t("auth.password_label", locale)}</label>
                <input id="p-pass" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-confirm" className={labelCls}>{t("register.password_confirm", locale)}</label>
                <input id="p-confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={inputCls} />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-slate-700">{t("partner.business_section", locale)}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="p-type" className={labelCls}>{t("partner.applicant_type", locale)}</label>
                <select id="p-type" value={applicantType} onChange={(e) => setApplicantType(e.target.value as ApplicantType)} className={inputCls}>
                  <option value="INDIVIDUAL">{t("partner.type_individual", locale)}</option>
                  <option value="COMPANY">{t("partner.type_company", locale)}</option>
                </select>
              </div>
              <div>
                <label htmlFor="p-country" className={labelCls}>{t("partner.country", locale)}</label>
                <select id="p-country" required value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="p-brand" className={labelCls}>{t("partner.brand_name", locale)}</label>
                <input id="p-brand" required minLength={2} value={brandName} onChange={(e) => setBrandName(e.target.value)} className={inputCls} />
              </div>
              {applicantType === "COMPANY" && (
                <>
                  <div>
                    <label htmlFor="p-legal" className={labelCls}>{t("partner.legal_name", locale)}</label>
                    <input id="p-legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="p-regno" className={labelCls}>{t("partner.registration_number", locale)}</label>
                    <input id="p-regno" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="p-tax" className={labelCls}>{t("partner.tax_id", locale)}</label>
                    <input id="p-tax" value={taxId} onChange={(e) => setTaxId(e.target.value)} className={inputCls} />
                  </div>
                </>
              )}
              <div>
                <label htmlFor="p-contact" className={labelCls}>{t("partner.contact_email", locale)}</label>
                <input id="p-contact" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputCls} placeholder={email || "you@example.com"} />
              </div>
              <div>
                <label htmlFor="p-phone" className={labelCls}>{t("partner.contact_phone", locale)}</label>
                <input id="p-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-site" className={labelCls}>{t("partner.website", locale)}</label>
                <input id="p-site" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} placeholder="https://" />
              </div>
              <div>
                <label htmlFor="p-address" className={labelCls}>{t("partner.address", locale)}</label>
                <input id="p-address" value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="p-desc" className={labelCls}>{t("partner.business_description", locale)}</label>
                <textarea id="p-desc" value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)} rows={3} className={inputCls} />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-slate-700">{t("partner.service_categories", locale)}</legend>
            <p className="mb-2 text-xs text-slate-400">{t("partner.categories_hint", locale)}</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const on = serviceCategories.includes(c.slug);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c.slug)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      on ? "border-emerald-500 bg-emerald-50 font-medium text-emerald-700" : "border-slate-200 text-slate-600 hover:border-emerald-300"
                    }`}
                  >
                    {c.title}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 size-4 rounded border-slate-300" />
            <span>{t("partner.terms_label", locale)}</span>
          </label>

          {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}

          <button
            type="submit"
            disabled={busy || !email || !brandName || !country || password.length < 8 || !terms}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t("partner.reg_busy", locale) : t("partner.reg_submit", locale)}
          </button>

          <p className="text-center text-xs text-slate-400">
            {t("auth.has_account", locale)}{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700">
              {t("auth.login_link", locale)}
            </Link>
          </p>
        </form>
      </div>
    </PublicLayout>
  );
}

export default function BecomeAPartnerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <BecomeAPartnerInner />
    </Suspense>
  );
}
