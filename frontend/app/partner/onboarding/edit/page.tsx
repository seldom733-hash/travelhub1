"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { partnerOnboardingApi, type PartnerApplicationView } from "@/lib/partner-onboarding-api";
import { publicApi, type PublicCategory } from "@/lib/public-api";
import { t, useLocale } from "@/lib/i18n";

const COUNTRIES = ["AZ", "GE", "KZ", "UZ", "RU", "TR", "AE", "DE", "US", "GB", "FR", "IT", "ES"];

/**
 * PHASE 1 STEP 1.10 §12 — /partner/onboarding/edit.
 * Правка СВОЕЙ заявки только в DRAFT/CHANGES_REQUESTED (backend 409 иначе);
 * version — optimistic lock (stale edit → 409). identity/lifecycle-поля
 * (role/partnerId/status/…) фронтенд не отправляет.
 */
export default function PartnerOnboardingEditPage() {
  const router = useRouter();
  const locale = useLocale();
  const [app, setApp] = useState<PartnerApplicationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const [legalName, setLegalName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [country, setCountry] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [taxId, setTaxId] = useState("");
  const [website, setWebsite] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
  const [categories, setCategories] = useState<PublicCategory[]>([]);

  useEffect(() => {
    let alive = true;
    void publicApi
      .listCategories()
      .then((c) => {
        if (alive) setCategories(c);
      })
      .catch(() => undefined);
    partnerOnboardingApi
      .getOwnApplication()
      .then((a) => {
        if (!alive) return;
        if (!a || !a.editable) {
          router.replace("/partner/onboarding");
          return;
        }
        setApp(a);
        setLegalName(a.legalName ?? "");
        setBrandName(a.brandName);
        setCountry(a.country);
        setRegistrationNumber(a.registrationNumber ?? "");
        setTaxId(a.taxId ?? "");
        setWebsite(a.website ?? "");
        setContactEmail(a.contactEmail);
        setContactPhone(a.contactPhone ?? "");
        setAddress(a.address ?? "");
        setBusinessDescription(a.businessDescription ?? "");
        setServiceCategories(a.serviceCategories ?? []);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [router]);

  const toggleCategory = (slug: string) =>
    setServiceCategories((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const updated = await partnerOnboardingApi.updateOwnApplication({
        legalName: legalName || undefined,
        brandName,
        country,
        registrationNumber: registrationNumber || undefined,
        taxId: taxId || undefined,
        website: website || undefined,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        address: address || undefined,
        businessDescription: businessDescription || undefined,
        serviceCategories: serviceCategories.length > 0 ? serviceCategories : undefined,
        version: app.version,
      });
      setApp(updated);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="py-10 text-center text-sm text-slate-400">{t("state.loading", locale)}</div>;
  if (!app) return null;

  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100";
  const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("partner.edit_title", locale)}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("partner.edit_hint", locale)}</p>
        </div>
        <Link href="/partner/onboarding" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
          ← {t("partner.back_status", locale)}
        </Link>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div>}
      {saved && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">{t("account.saved", locale)}</div>}

      <form onSubmit={(e) => void save(e)} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="e-brand" className={labelCls}>{t("partner.brand_name", locale)}</label>
            <input id="e-brand" required minLength={2} value={brandName} onChange={(e) => setBrandName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="e-country" className={labelCls}>{t("partner.country", locale)}</label>
            <select id="e-country" required value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {app.applicantType === "COMPANY" && (
            <>
              <div>
                <label htmlFor="e-legal" className={labelCls}>{t("partner.legal_name", locale)}</label>
                <input id="e-legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="e-regno" className={labelCls}>{t("partner.registration_number", locale)}</label>
                <input id="e-regno" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="e-tax" className={labelCls}>{t("partner.tax_id", locale)}</label>
                <input id="e-tax" value={taxId} onChange={(e) => setTaxId(e.target.value)} className={inputCls} />
              </div>
            </>
          )}
          <div>
            <label htmlFor="e-contact" className={labelCls}>{t("partner.contact_email", locale)}</label>
            <input id="e-contact" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="e-phone" className={labelCls}>{t("partner.contact_phone", locale)}</label>
            <input id="e-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="e-site" className={labelCls}>{t("partner.website", locale)}</label>
            <input id="e-site" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} placeholder="https://" />
          </div>
          <div>
            <label htmlFor="e-address" className={labelCls}>{t("partner.address", locale)}</label>
            <input id="e-address" value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="e-desc" className={labelCls}>{t("partner.business_description", locale)}</label>
            <textarea id="e-desc" value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)} rows={3} className={inputCls} />
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-700">{t("partner.service_categories", locale)}</legend>
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

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={busy || !brandName || !country}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t("account.saving", locale) : t("account.save", locale)}
          </button>
          <Link href="/partner/onboarding" className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
            {t("partner.cancel", locale)}
          </Link>
        </div>
      </form>
    </div>
  );
}
