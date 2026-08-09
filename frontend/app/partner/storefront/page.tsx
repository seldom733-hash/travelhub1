"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { pt } from "@/lib/partner-i18n";
import { citiesOf, countryName } from "@/lib/locations";
import {
  SOCIAL_PLATFORMS,
  STOREFRONT_LOCALES,
  STOREFRONT_THEMES,
  storefrontApi,
  type SocialLinkInput,
  type StorefrontMediaKind,
  type StorefrontView,
} from "@/lib/storefront-api";

/**
 * PHASE 1 STEP 1.12.2 §7 — /partner/storefront management.
 * Состояния:
 *  - Нет витрины → Create CTA (explicit provisioning);
 *  - DRAFT + NONE → настройка разрешена, публикация запрещена (платная capability,
 *    fake checkout НЕ делаем — только объяснение);
 *  - DRAFT + ACTIVE entitlement → можно activate;
 *  - ACTIVE + ACTIVE → public URL / preview / deactivate;
 *  - SUSPENDED/EXPIRED → public site unavailable, конфигурация сохраняется;
 *  - INACTIVE → редактирование; reactivation только при entitlement ACTIVE.
 * PARTNER не меняет entitlement (ADMIN операционная команда).
 */
export default function PartnerStorefrontPage() {
  const locale = useLocale();
  const [sf, setSf] = useState<StorefrontView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  // Create form
  const [createMode, setCreateMode] = useState(false);
  const [slug, setSlug] = useState("");
  const [createName, setCreateName] = useState("");

  // Edit form
  const [businessName, setBusinessName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [defaultLocale, setDefaultLocale] = useState("ru");
  const [cityCode, setCityCode] = useState("");
  const [publicPhone, setPublicPhone] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [socialLinks, setSocialLinks] = useState<SocialLinkInput[]>([]);
  const [heroHeading, setHeroHeading] = useState("");
  const [heroSubheading, setHeroSubheading] = useState("");
  const [themePreset, setThemePreset] = useState("default");

  const [uploading, setUploading] = useState<StorefrontMediaKind | null>(null);
  const [mediaPreview, setMediaPreview] = useState<{ logo?: string; hero?: string }>({});
  const logoRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const view = await storefrontApi.getOwn();
      setSf(view);
      setBusinessName(view.businessName ?? "");
      setTagline(view.tagline ?? "");
      setDescription(view.description ?? "");
      setDefaultLocale(view.defaultLocale);
      setCityCode(view.cityCode ?? "");
      setPublicPhone(view.publicPhone ?? "");
      setPublicEmail(view.publicEmail ?? "");
      setWebsiteUrl(view.websiteUrl ?? "");
      setWhatsapp(view.whatsapp ?? "");
      setSocialLinks(view.socialLinks ?? []);
      setHeroHeading(view.heroHeading ?? "");
      setHeroSubheading(view.heroSubheading ?? "");
      setThemePreset(view.themePreset);
      void refreshMediaPreviews(view);
    } catch (e) {
      if ((e as Error).message.includes("404") || (e as Error).message.includes("not found")) {
        setSf(null); // no storefront yet → Create CTA
      } else {
        setError((e as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshMediaPreviews = async (view: StorefrontView) => {
    const next: { logo?: string; hero?: string } = {};
    for (const m of view.media) {
      try {
        const { url } = await storefrontApi.previewMedia(m.id);
        if (m.kind === "LOGO") next.logo = url;
        else next.hero = url;
      } catch {
        /* best-effort */
      }
    }
    setMediaPreview(next);
  };

  const applyView = (view: StorefrontView) => {
    setSf(view);
    setBusinessName(view.businessName ?? "");
    setTagline(view.tagline ?? "");
    setDescription(view.description ?? "");
    setDefaultLocale(view.defaultLocale);
    setCityCode(view.cityCode ?? "");
    setPublicPhone(view.publicPhone ?? "");
    setPublicEmail(view.publicEmail ?? "");
    setWebsiteUrl(view.websiteUrl ?? "");
    setWhatsapp(view.whatsapp ?? "");
    setSocialLinks(view.socialLinks ?? []);
    setHeroHeading(view.heroHeading ?? "");
    setHeroSubheading(view.heroSubheading ?? "");
    setThemePreset(view.themePreset);
    void refreshMediaPreviews(view);
  };

  const create = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const view = await storefrontApi.create({ slug: slug.trim(), businessName: createName.trim() || undefined, defaultLocale });
      applyView(view);
      setCreateMode(false);
      setNotice(pt("storefront.created_ok", locale));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const view = await storefrontApi.update({
        businessName,
        tagline,
        description,
        defaultLocale,
        cityCode: cityCode || undefined,
        publicPhone: publicPhone || undefined,
        publicEmail: publicEmail || undefined,
        websiteUrl: websiteUrl || undefined,
        whatsapp: whatsapp || undefined,
        socialLinks: socialLinks.length > 0 ? socialLinks : undefined,
        heroHeading: heroHeading || undefined,
        heroSubheading: heroSubheading || undefined,
        themePreset,
      });
      applyView(view);
      setNotice(pt("storefront.saved_ok", locale));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const activate = async () => {
    setError("");
    setNotice("");
    try {
      applyView(await storefrontApi.activate());
      setNotice(pt("storefront.activated_ok", locale));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const deactivate = async () => {
    setError("");
    setNotice("");
    try {
      applyView(await storefrontApi.deactivate());
      setNotice(pt("storefront.deactivated_ok", locale));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const upload = async (kind: StorefrontMediaKind, file: File | undefined) => {
    if (!file) return;
    setUploading(kind);
    setError("");
    try {
      const view = await storefrontApi.uploadMedia(kind, file);
      applyView(view);
      setNotice(pt("storefront.media_uploaded_ok", locale));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(null);
      if (kind === "LOGO" && logoRef.current) logoRef.current.value = "";
      if (kind === "HERO" && heroRef.current) heroRef.current.value = "";
    }
  };

  const removeMedia = async (kind: StorefrontMediaKind) => {
    setError("");
    try {
      applyView(await storefrontApi.deleteMedia(kind));
      setNotice(pt("storefront.media_deleted_ok", locale));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const cities = useMemo(() => citiesOf(sf?.countryCode ?? null), [sf?.countryCode]);
  const countryLabel = countryName(sf?.countryCode ?? null, locale);

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-400">{pt("partner.state.loading", locale)}</div>;
  }

  // ── No storefront yet → Create CTA ──
  if (!sf) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900">{pt("storefront.title", locale)}</h1>
        <p className="mt-2 text-sm text-slate-500">{pt("storefront.no_storefront_hint", locale)}</p>
        {createMode ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <label htmlFor="sf-slug" className="mb-1 block text-sm font-medium text-slate-700">
                  {pt("storefront.slug", locale)} <span className="text-rose-500">*</span>
                </label>
                <input id="sf-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="my-business" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
              </div>
              <div>
                <label htmlFor="sf-name" className="mb-1 block text-sm font-medium text-slate-700">
                  {pt("storefront.business_name", locale)}
                </label>
                <input id="sf-name" value={createName} onChange={(e) => setCreateName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
              </div>
              <div>
                <label htmlFor="sf-locale" className="mb-1 block text-sm font-medium text-slate-700">
                  {pt("storefront.default_locale", locale)}
                </label>
                <select id="sf-locale" value={defaultLocale} onChange={(e) => setDefaultLocale(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  {STOREFRONT_LOCALES.map((l) => (
                    <option key={l} value={l}>
                      {l.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={create} disabled={saving || !slug.trim()} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? pt("partner.form.saving", locale) : pt("storefront.create", locale)}
                </button>
                <button onClick={() => setCreateMode(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                  {pt("storefront.cancel", locale)}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setCreateMode(true)} className="mt-6 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            {pt("storefront.create_cta", locale)}
          </button>
        )}
        {error && <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </div>
    );
  }

  const entitled = sf.entitlementStatus === "ACTIVE";
  const publicLive = sf.status === "ACTIVE" && entitled;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">{pt("storefront.title", locale)}</h1>
        <StatusPill label={pt(`storefront.status.${sf.status}`, locale)} tone={sf.status === "ACTIVE" ? "green" : sf.status === "INACTIVE" ? "amber" : "slate"} />
        <StatusPill label={pt(`storefront.entitlement.${sf.entitlementStatus}`, locale)} tone={entitled ? "green" : sf.entitlementStatus === "NONE" ? "slate" : "red"} />
      </div>
      <div className="font-mono text-xs text-slate-400">{sf.code} · /store/{sf.slug}</div>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      {/* ── State banner ── */}
      <StateBanner sf={sf} locale={locale} />

      {/* ── Public URL / actions ── */}
      <div className="flex flex-wrap items-center gap-2">
        {publicLive && (
          <a href={`/store/${sf.slug}`} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
            {pt("storefront.open_public", locale)} ↗
          </a>
        )}
        <Link href="/partner/storefront/preview" className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
          {pt("storefront.preview", locale)}
        </Link>
        {sf.status !== "ACTIVE" ? (
          entitled ? (
            <button onClick={activate} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              {pt("storefront.activate", locale)}
            </button>
          ) : (
            <span className="rounded-lg bg-slate-100 px-4 py-2 text-xs text-slate-500">{pt("storefront.activate_blocked_no_entitlement", locale)}</span>
          )
        ) : (
          <button onClick={deactivate} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-red-300 hover:text-red-700">
            {pt("storefront.deactivate", locale)}
          </button>
        )}
      </div>

      {/* ── Business identity (Step 1.12.2 §3/§4) ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{pt("storefront.business_identity", locale)}</h2>
        <p className="mb-4 mt-0.5 text-xs text-slate-400">{pt("storefront.identity_hint", locale)}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="sf-business" className="mb-1 block text-sm font-medium text-slate-700">{pt("storefront.business_name", locale)}</label>
            <input id="sf-business" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
          </div>
          <div>
            <label htmlFor="sf-tagline" className="mb-1 block text-sm font-medium text-slate-700">{pt("storefront.tagline", locale)}</label>
            <input id="sf-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="sf-desc" className="mb-1 block text-sm font-medium text-slate-700">{pt("storefront.description", locale)}</label>
            <textarea id="sf-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
          </div>
          <div>
            <label htmlFor="sf-locale2" className="mb-1 block text-sm font-medium text-slate-700">{pt("storefront.default_locale", locale)}</label>
            <select id="sf-locale2" value={defaultLocale} onChange={(e) => setDefaultLocale(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {STOREFRONT_LOCALES.map((l) => (
                <option key={l} value={l}>{l.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sf-city" className="mb-1 block text-sm font-medium text-slate-700">
              {pt("storefront.city", locale)} {countryLabel ? `(${countryLabel})` : ""}
            </label>
            <select id="sf-city" value={cityCode} onChange={(e) => setCityCode(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">—</option>
              {cities.map((c) => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
            {sf.countryCode && <p className="mt-1 text-[11px] text-slate-400">{pt("storefront.country_system", locale)}: {sf.countryCode}</p>}
          </div>
        </div>

        {/* Contacts */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800">{pt("storefront.contacts", locale)}</h3>
          <p className="mb-3 mt-0.5 text-[11px] text-slate-400">{pt("storefront.contacts_hint", locale)}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sf-phone" className="mb-1 block text-sm font-medium text-slate-700">{pt("storefront.phone", locale)}</label>
              <input id="sf-phone" value={publicPhone} onChange={(e) => setPublicPhone(e.target.value)} placeholder="+994 50 123 45 67" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label htmlFor="sf-email" className="mb-1 block text-sm font-medium text-slate-700">{pt("storefront.email", locale)}</label>
              <input id="sf-email" value={publicEmail} onChange={(e) => setPublicEmail(e.target.value)} placeholder="hello@example.com" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label htmlFor="sf-site" className="mb-1 block text-sm font-medium text-slate-700">{pt("storefront.website", locale)}</label>
              <input id="sf-site" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label htmlFor="sf-wa" className="mb-1 block text-sm font-medium text-slate-700">{pt("storefront.whatsapp", locale)}</label>
              <input id="sf-wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+994501234567" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {socialLinks.map((link, i) => (
              <div key={i} className="flex gap-2">
                <select
                  value={link.platform}
                  onChange={(e) => setSocialLinks(socialLinks.map((l, j) => (j === i ? { ...l, platform: e.target.value } : l)))}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                >
                  {SOCIAL_PLATFORMS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <input
                  value={link.url}
                  onChange={(e) => setSocialLinks(socialLinks.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)))}
                  placeholder="https://…"
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-emerald-400"
                />
                <button onClick={() => setSocialLinks(socialLinks.filter((_, j) => j !== i))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600">
                  ✕
                </button>
              </div>
            ))}
            {socialLinks.length < 10 && (
              <button onClick={() => setSocialLinks([...socialLinks, { platform: "instagram", url: "" }])} className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:border-emerald-300 hover:text-emerald-700">
                + {pt("storefront.add_social", locale)}
              </button>
            )}
          </div>
        </div>

        {/* Branding */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800">{pt("storefront.branding", locale)}</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sf-hero-h" className="mb-1 block text-sm font-medium text-slate-700">{pt("storefront.hero_heading", locale)}</label>
              <input id="sf-hero-h" value={heroHeading} onChange={(e) => setHeroHeading(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label htmlFor="sf-hero-s" className="mb-1 block text-sm font-medium text-slate-700">{pt("storefront.hero_subheading", locale)}</label>
              <input id="sf-hero-s" value={heroSubheading} onChange={(e) => setHeroSubheading(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label htmlFor="sf-theme" className="mb-1 block text-sm font-medium text-slate-700">{pt("storefront.theme", locale)}</label>
              <select id="sf-theme" value={themePreset} onChange={(e) => setThemePreset(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {STOREFRONT_THEMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={save} disabled={saving} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? pt("partner.form.saving", locale) : pt("partner.form.save", locale)}
          </button>
        </div>
      </section>

      {/* ── Media (logo/hero) ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{pt("storefront.media", locale)}</h2>
        <p className="mb-4 mt-0.5 text-xs text-slate-400">{pt("storefront.media_hint", locale)}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <MediaUploader
            title={pt("storefront.logo", locale)}
            previewUrl={mediaPreview.logo}
            uploading={uploading === "LOGO"}
            onPick={() => logoRef.current?.click()}
            onRemove={() => removeMedia("LOGO")}
            hasMedia={Boolean(sf.media.find((m) => m.kind === "LOGO"))}
          />
          <MediaUploader
            title={pt("storefront.hero_image", locale)}
            previewUrl={mediaPreview.hero}
            uploading={uploading === "HERO"}
            onPick={() => heroRef.current?.click()}
            onRemove={() => removeMedia("HERO")}
            hasMedia={Boolean(sf.media.find((m) => m.kind === "HERO"))}
          />
        </div>
        <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload("LOGO", e.target.files?.[0])} />
        <input ref={heroRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload("HERO", e.target.files?.[0])} />
      </section>

      {/* ── Distribution ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{pt("storefront.distribution", locale)}</h2>
        <p className="mb-3 mt-0.5 text-xs text-slate-400">{pt("storefront.distribution_hint", locale)}</p>
        <Link href="/partner/products" className="inline-block rounded-lg border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
          {pt("storefront.manage_distribution", locale)} →
        </Link>
      </section>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "green" | "amber" | "slate" | "red" }) {
  const cls = tone === "green" ? "bg-emerald-100 text-emerald-700" : tone === "amber" ? "bg-amber-100 text-amber-700" : tone === "red" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

function StateBanner({ sf, locale }: { sf: StorefrontView; locale: ReturnType<typeof useLocale> }) {
  if (sf.entitlementStatus === "SUSPENDED" || sf.entitlementStatus === "EXPIRED") {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pt("storefront.banner_suspended", locale)}</div>;
  }
  if (sf.status === "ACTIVE" && sf.entitlementStatus === "ACTIVE") {
    return <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{pt("storefront.banner_active", locale)}</div>;
  }
  if (sf.status === "INACTIVE") {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{pt("storefront.banner_inactive", locale)}</div>;
  }
  if (sf.entitlementStatus === "NONE") {
    return <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{pt("storefront.banner_draft_none", locale)}</div>;
  }
  return <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{pt("storefront.banner_draft_ready", locale)}</div>;
}

function MediaUploader({ title, previewUrl, uploading, onPick, onRemove, hasMedia }: { title: string; previewUrl?: string; uploading: boolean; onPick: () => void; onRemove: () => void; hasMedia: boolean }) {
  const locale = useLocale();
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="text-sm font-medium text-slate-700">{title}</div>
      <div className="mt-2 flex items-center gap-3">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={title} className="size-16 rounded-lg object-cover" />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-lg bg-slate-100 text-2xl text-slate-300">🖼</div>
        )}
        <div className="flex flex-col gap-1.5">
          <button onClick={onPick} disabled={uploading} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-50">
            {uploading ? pt("partner.media.uploading", locale) : hasMedia ? pt("storefront.replace", locale) : pt("storefront.upload", locale)}
          </button>
          {hasMedia && (
            <button onClick={onRemove} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:border-red-300 hover:text-red-600">
              {pt("storefront.remove", locale)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
