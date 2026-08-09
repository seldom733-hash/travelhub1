"use client";

import Link from "next/link";
import { t, useLocale, type Locale } from "@/lib/i18n";
import type { PublicProductCard, PublicListResult } from "@/lib/public-api";
import type { PublicStorefront } from "@/lib/storefront-api";
import { formatLocation } from "@/lib/locations";
import { SOCIAL_PLATFORM_ICONS, themeStyle } from "./storefront-theme";
import Price from "../public/Price";
import { fireContactClick, useStorefrontCardImpression, useStorefrontViewed } from "@/lib/behavioral-events";

/**
 * PHASE 1 STEP 1.12.2 §10 — Storefront homepage: самостоятельный сайт бизнеса.
 * - Header (logo/business name) + Hero + description + location + contacts +
 *   services/products + CTA + Footer + "Powered by TravelHub";
 * - НЕ копирует /search, НЕ содержит internal sidebar;
 * - business identity и structured contacts — ТОЛЬКО Storefront-контекст
 *   (этот компонент рендерится только для ACTIVE+entitled витрины или preview);
 * - media URLs: публичные стабильные (/api/v1/public/storefronts/...) либо
 *   signed override в preview (owner-only).
 */
export default function StorefrontSite({
  sf,
  products,
  preview = false,
  mediaUrlOverrides,
}: {
  sf: PublicStorefront;
  products: PublicListResult | null;
  preview?: boolean;
  mediaUrlOverrides?: Record<string, string>;
}) {
  const locale = useLocale();
  const theme = themeStyle(sf.themePreset);
  const logo = sf.media.find((m) => m.kind === "LOGO");
  const hero = sf.media.find((m) => m.kind === "HERO");
  const logoUrl = logo ? (mediaUrlOverrides?.[logo.id] ?? logo.url) : null;
  const heroUrl = hero ? (mediaUrlOverrides?.[hero.id] ?? hero.url) : null;
  const location = formatLocation(sf.countryCode, sf.cityCode, locale);
  const name = sf.businessName ?? (sf.seller?.visibilityMode !== "ANONYMOUS" ? sf.seller?.displayName : null) ?? sf.slug;
  // Step 1.12.3: посещение публичной витрины. Preview НЕ считается public view.
  useStorefrontViewed(sf.slug, !preview);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Header ── */}
      <header className={`sticky top-0 z-20 ${theme.headerBg}`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={name} className="size-9 rounded-full object-cover" />
            ) : (
              <div className={`flex size-9 items-center justify-center rounded-xl text-base font-bold text-white ${theme.accent.split(" ")[0]}`}>
                {name.slice(0, 1).toUpperCase() || "T"}
              </div>
            )}
            <Link href={`/store/${sf.slug}`} className={`text-base font-bold ${theme.headerText}`}>
              {name}
            </Link>
          </div>
          <nav className="ml-auto flex items-center gap-1 text-sm" aria-label="Storefront">
            <a href="#products" className={`rounded-lg px-3 py-1.5 text-slate-600 ${theme.accentHover}`}>
              {t("storefront.products", locale)}
            </a>
            <a href="#contacts" className={`rounded-lg px-3 py-1.5 text-slate-600 ${theme.accentHover}`}>
              {t("storefront.contacts", locale)}
            </a>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className={`relative bg-gradient-to-br ${theme.heroBg} text-white`}>
        {heroUrl && (
          <div className="absolute inset-0 opacity-25">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">
            {sf.heroHeading ?? (sf.businessName ?? name)}
          </h1>
          {sf.heroSubheading && <p className="mt-4 max-w-xl text-lg text-white/90">{sf.heroSubheading}</p>}
          {sf.tagline && <p className="mt-3 max-w-xl text-sm text-white/80">{sf.tagline}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#products" className={`rounded-lg px-5 py-2.5 text-sm font-semibold ${theme.accent}`}>
              {t("storefront.view_products", locale)}
            </a>
            {sf.websiteUrl && (
              <a
                href={sf.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                {t("storefront.visit_site", locale)} ↗
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── About / description ── */}
      {sf.description && (
        <section className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-xl font-bold text-slate-900">{t("storefront.about", locale)}</h2>
          <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-slate-600">{sf.description}</p>
          {location && <div className="mt-4 text-sm text-slate-500">📍 {location}</div>}
        </section>
      )}

      {/* ── Products ── */}
      <section id="products" className="mx-auto w-full max-w-6xl px-4 pb-12">
        <h2 className="text-xl font-bold text-slate-900">{t("storefront.products", locale)}</h2>
        {!products || products.items.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">{t("storefront.no_products", locale)}</p>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.items.map((p) => (
              <StorefrontProductCard key={p.id} sf={sf} card={p} locale={locale} preview={preview} />
            ))}
          </div>
        )}
      </section>

      {/* ── Contacts (Storefront-контекст, §4) ── */}
      <section id="contacts" className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-xl font-bold text-slate-900">{t("storefront.contacts", locale)}</h2>
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-600">
            {sf.publicPhone && (
              <a href={`tel:${sf.publicPhone.replace(/[^+\d]/g, "")}`} onClick={() => fireContactClick(sf.slug, "PHONE")} className={theme.accentHover}>
                📞 {sf.publicPhone}
              </a>
            )}
            {sf.publicEmail && (
              <a href={`mailto:${sf.publicEmail}`} onClick={() => fireContactClick(sf.slug, "EMAIL")} className={theme.accentHover}>
                ✉️ {sf.publicEmail}
              </a>
            )}
            {sf.whatsapp && (
              <a
                href={`https://wa.me/${sf.whatsapp.replace(/[^+\d]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => fireContactClick(sf.slug, "WHATSAPP")}
                className={theme.accentHover}
              >
                💬 WhatsApp
              </a>
            )}
            {sf.websiteUrl && (
              <a href={sf.websiteUrl} target="_blank" rel="noopener noreferrer" onClick={() => fireContactClick(sf.slug, "WEBSITE")} className={theme.accentHover}>
                🌐 {sf.websiteUrl.replace(/^https?:\/\//, "")}
              </a>
            )}
            {sf.socialLinks?.map((l) => (
              <a key={l.platform} href={l.url} target="_blank" rel="noopener noreferrer" onClick={() => fireContactClick(sf.slug, "SOCIAL", l.platform)} className={theme.accentHover}>
                {SOCIAL_PLATFORM_ICONS[l.platform] ?? "🔗"} {l.platform}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        {name} — {t("storefront.powered_by", locale)}{" "}
        <Link href="/" className="text-slate-500 hover:underline">
          TravelHub
        </Link>
      </footer>

      {preview && (
        <div className="sticky bottom-0 z-30 border-t border-amber-200 bg-amber-50 py-2 text-center text-xs font-medium text-amber-700">
          {t("storefront.preview_banner", locale)}
        </div>
      )}
    </div>
  );
}

/** Карточка продукта в Storefront-контексте (не Marketplace ProductCard). */
function StorefrontProductCard({ sf, card, locale, preview }: { sf: PublicStorefront; card: PublicProductCard; locale: Locale; preview: boolean }) {
  // Step 1.12.3: импрессия = карточка реально отрисована в grid (rendered-card
  // семантика); preview не трекается.
  useStorefrontCardImpression(sf.slug, card.slug, !preview);
  return (
    <Link
      href={`/store/${sf.slug}/products/${card.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
        {card.primaryImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.primaryImage.thumbUrl} alt={card.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-slate-300">🏝</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{card.category?.title ?? card.type}</div>
        <div className="line-clamp-2 font-bold text-slate-900" title={card.title}>
          {card.title}
        </div>
        {card.shortDescription && <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{card.shortDescription}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <Price amount={card.priceFrom} currency={card.currency} size="sm" />
          <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors group-hover:bg-slate-900 group-hover:text-white">
            {t("card.details", locale)}
          </span>
        </div>
      </div>
    </Link>
  );
}
