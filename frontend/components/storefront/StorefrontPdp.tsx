"use client";

import Link from "next/link";
import MediaGallery from "@/components/public/MediaGallery";
import Price from "@/components/public/Price";
import { formatDate, t, useLocale } from "@/lib/i18n";
import { availabilityText, sectionLabel, sectionsFor } from "@/lib/marketplace-utils";
import { formatLocation } from "@/lib/locations";
import type { PublicProductDetail } from "@/lib/public-api";
import type { PublicStorefront } from "@/lib/storefront-api";
import { SOCIAL_PLATFORM_ICONS, themeStyle } from "./storefront-theme";
import { fireContactClick, useStorefrontProductViewed } from "@/lib/behavioral-events";

/**
 * PHASE 1 STEP 1.12.2 §11 — Storefront PDP (client-рендер из server-fetched props).
 * Canonical Product (media/tariffs/availability) в Storefront-контексте: вместо
 * seller-проекции Marketplace показывается business identity + structured
 * contacts витрины. Данные приходят с сервера (page.tsx → publicStorefrontApi,
 * БЕЗ Authorization); DRAFT/INACTIVE/SUSPENDED/EXPIRED и чужие/DRAFT/ARCHIVED
 * продукты → server неFound() (neutral 404) ещё до рендера.
 */
export default function StorefrontPdp({ sf, detail }: { sf: PublicStorefront; detail: PublicProductDetail }) {
  const locale = useLocale();
  const theme = themeStyle(sf.themePreset);
  const p = detail.product;
  const availability = availabilityText(p.availability, locale);
  const attributeSections = sectionsFor(p.attributes, locale);
  const name = sf.businessName ?? sf.slug;
  const logo = sf.media.find((m) => m.kind === "LOGO");
  const location = formatLocation(sf.countryCode, sf.cityCode, locale);
  // Step 1.12.3: открытие публичного Storefront PDP (только ACTIVE+entitled).
  useStorefrontProductViewed(sf.slug, p.slug, true);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Storefront mini-header ── */}
      <header className={`sticky top-0 z-20 ${theme.headerBg}`}>
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.url} alt={name} className="size-8 rounded-full object-cover" />
          ) : (
            <div className={`flex size-8 items-center justify-center rounded-xl text-sm font-bold text-white ${theme.accent.split(" ")[0]}`}>
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <Link href={`/store/${sf.slug}`} className={`text-sm font-bold ${theme.headerText}`}>
            {name}
          </Link>
          <Link href={`/store/${sf.slug}`} className={`ml-auto text-xs text-slate-500 ${theme.accentHover}`}>
            ← {t("storefront.back_home", locale)}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          {/* ── Left: gallery + content ── */}
          <div>
            <nav className="mb-3 text-xs text-slate-400" aria-label="breadcrumb">
              <Link href={`/store/${sf.slug}`} className={theme.accentHover}>
                {name}
              </Link>
              {p.category && (
                <>
                  <span className="mx-1.5">/</span>
                  <span className="text-slate-500">{p.category.title}</span>
                </>
              )}
              <span className="mx-1.5">/</span>
              <span className="text-slate-600" aria-current="page">
                {p.title}
              </span>
            </nav>

            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{p.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              {p.category && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">{p.category.title}</span>
              )}
              <span>
                {t("pdp.published_on", locale)}: {formatDate(p.publishedAt, locale)}
              </span>
            </div>

            <div className="mt-5">
              <MediaGallery media={detail.media} />
            </div>

            <section className="mt-8" aria-labelledby="sf-pdp-description">
              <h2 id="sf-pdp-description" className="text-lg font-bold text-slate-900">
                {t("pdp.description_title", locale)}
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {p.description ?? t("pdp.description_missing", locale)}
              </p>
            </section>

            {attributeSections.length > 0 && (
              <section className="mt-8" aria-labelledby="sf-pdp-attrs">
                <h2 id="sf-pdp-attrs" className="text-lg font-bold text-slate-900">
                  {t("pdp.attributes_title", locale)}
                </h2>
                <div className="mt-3 space-y-4">
                  {attributeSections.map((s) => (
                    <div key={s.section} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h3 className="text-sm font-semibold text-slate-800">{sectionLabel(s.section, locale)}</h3>
                      <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                        {s.items.map((i) => (
                          <div key={i.key} className="flex flex-col">
                            <dt className="text-[11px] uppercase tracking-wide text-slate-400">{i.label}</dt>
                            <dd className="whitespace-pre-line text-slate-700">{i.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {p.tariffs.length > 0 && (
              <section className="mt-8" aria-labelledby="sf-pdp-tariffs">
                <h2 id="sf-pdp-tariffs" className="text-lg font-bold text-slate-900">
                  {t("pdp.tariffs_title", locale)}
                </h2>
                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                  {p.tariffs.map((tariff, i) => (
                    <div key={tariff.id} className={`flex items-center justify-between gap-3 bg-white px-4 py-3 ${i === p.tariffs.length - 1 ? "" : "border-b border-slate-100"}`}>
                      <div>
                        <div className="text-sm font-medium text-slate-800">{tariff.name}</div>
                        {tariff.validFrom && (
                          <div className="text-[11px] text-slate-400">
                            {formatDate(tariff.validFrom, locale)}
                            {tariff.validTo ? ` – ${formatDate(tariff.validTo, locale)}` : ""}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-slate-900">
                        <Price amount={tariff.price} currency={tariff.currency} size="sm" withPrefix={false} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8" aria-labelledby="sf-pdp-availability">
              <h2 id="sf-pdp-availability" className="text-lg font-bold text-slate-900">
                {t("pdp.availability_title", locale)}
              </h2>
              <div
                className={`mt-3 rounded-2xl border p-4 text-sm ${
                  availability.tone === "available"
                    ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                    : availability.tone === "limited"
                      ? "border-amber-100 bg-amber-50 text-amber-800"
                      : "border-slate-100 bg-slate-50 text-slate-500"
                }`}
              >
                <div className="font-medium">{availability.title}</div>
                {availability.detail && <div className="mt-0.5 text-xs opacity-80">{availability.detail}</div>}
                <p className="mt-2 text-[11px] opacity-70">{t("pdp.availability_notice", locale)}</p>
              </div>
            </section>
          </div>

          {/* ── Right: price / CTA / Storefront business identity + contacts ── */}
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-xs uppercase tracking-wide text-slate-400">{t("pdp.price_from", locale)}</div>
              <div className="mt-1">
                <Price amount={p.priceFrom} currency={p.currency} size="lg" withPrefix={false} />
              </div>
              <button type="button" className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold ${theme.accent}`}>
                {t("pdp.primary_cta", locale)}
              </button>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{t("pdp.cta_placeholder", locale)}</p>
            </div>

            {/* Storefront business identity + contacts (только Storefront-контекст) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
              <div className="text-xs uppercase tracking-wide text-slate-400">{t("storefront.about", locale)}</div>
              <div className="mt-1 font-semibold text-slate-800">{sf.businessName ?? sf.slug}</div>
              {location && <div className="mt-0.5 text-xs text-slate-500">📍 {location}</div>}
              <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                {sf.publicPhone && (
                  <a href={`tel:${sf.publicPhone.replace(/[^+\d]/g, "")}`} onClick={() => fireContactClick(sf.slug, "PHONE")} className={`block ${theme.accentHover}`}>
                    📞 {sf.publicPhone}
                  </a>
                )}
                {sf.publicEmail && (
                  <a href={`mailto:${sf.publicEmail}`} onClick={() => fireContactClick(sf.slug, "EMAIL")} className={`block ${theme.accentHover}`}>
                    ✉️ {sf.publicEmail}
                  </a>
                )}
                {sf.whatsapp && (
                  <a href={`https://wa.me/${sf.whatsapp.replace(/[^+\d]/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={() => fireContactClick(sf.slug, "WHATSAPP")} className={`block ${theme.accentHover}`}>
                    💬 WhatsApp
                  </a>
                )}
                {sf.websiteUrl && (
                  <a href={sf.websiteUrl} target="_blank" rel="noopener noreferrer" onClick={() => fireContactClick(sf.slug, "WEBSITE")} className={`block truncate ${theme.accentHover}`}>
                    🌐 {sf.websiteUrl.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {sf.socialLinks?.map((l) => (
                  <a key={l.platform} href={l.url} target="_blank" rel="noopener noreferrer" onClick={() => fireContactClick(sf.slug, "SOCIAL", l.platform)} className={`block ${theme.accentHover}`}>
                    {SOCIAL_PLATFORM_ICONS[l.platform] ?? "🔗"} {l.platform}
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        {name} — {t("storefront.powered_by", locale)}{" "}
        <Link href="/" className="text-slate-500 hover:underline">
          TravelHub
        </Link>
      </footer>
    </div>
  );
}
