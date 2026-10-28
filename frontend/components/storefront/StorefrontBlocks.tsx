"use client";

import Link from "next/link";
import { t, useLocale } from "@/lib/i18n";
import type { PublicListResult } from "@/lib/public-api";
import type { PublicStorefront } from "@/lib/storefront-api";
import type { PageConfigView, SectionView } from "@/lib/constructor-api";
import { formatLocation } from "@/lib/locations";
import { fireContactClick, useStorefrontViewed } from "@/lib/behavioral-events";
import { SOCIAL_PLATFORM_ICONS, themeStyle } from "./storefront-theme";
import { StorefrontProductCard } from "./StorefrontSite";
import StorefrontRequestForm from "./StorefrontRequestForm";
import { useGlobalBranding } from "@/lib/use-global-branding";
import { parseFaqItems, parseGalleryImages } from "@/lib/content-blocks";

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Only server-approved URL shapes are rendered from block settings. */
function safeHref(value: unknown, fallback = "#products"): string {
  const href = text(value, fallback).trim();
  if (href.startsWith("#") || href.startsWith("/")) return href;
  if (/^https?:\/\//i.test(href)) return href;
  return fallback;
}

/**
 * Published Storefront page renderer. This is the same block/version contract
 * as the marketplace home, rendered against tenant-scoped public data. The
 * legacy StorefrontSite remains the fallback when a partner has no published
 * constructor page.
 */
export default function StorefrontBlocks({
  sf,
  products,
  page,
  preview = false,
  mediaUrlOverrides,
  menu = [],
}: {
  sf: PublicStorefront;
  products: PublicListResult | null;
  page: PageConfigView;
  preview?: boolean;
  mediaUrlOverrides?: Record<string, string>;
  menu?: Array<{ slug: string; name: string; isHome: boolean }>;
}) {
  const locale = useLocale();
  const theme = themeStyle(sf.themePreset);
  const { brandName, loading: brandingLoading } = useGlobalBranding();
  const logo = sf.media.find((m) => m.kind === "LOGO");
  const hero = sf.media.find((m) => m.kind === "HERO");
  const logoUrl = logo ? (mediaUrlOverrides?.[logo.id] ?? logo.url) : null;
  const heroUrl = hero ? (mediaUrlOverrides?.[hero.id] ?? hero.url) : null;
  const name = sf.businessName ?? sf.slug;
  const sections = [...page.sections].filter((s) => s.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
  const design = (page.designConfig ?? {}) as Record<string, unknown>;
  const accentColor = typeof design.accentColor === "string" ? design.accentColor : undefined;
  const fontFamily = typeof design.fontFamily === "string" ? design.fontFamily : undefined;
  const hasProducts = sections.some((s) => s.blockType === "storefront-products");
  const hasContacts = sections.some((s) => s.blockType === "storefront-contacts");
  useStorefrontViewed(sf.slug, !preview);

  const render = (section: SectionView) => {
    switch (section.blockType) {
      case "storefront-hero": {
        const heading = text(section.settings.heading, sf.heroHeading ?? name);
        const subheading = text(section.settings.subheading, sf.heroSubheading ?? sf.tagline ?? "");
        const ctaLabel = text(section.settings.ctaLabel, t("storefront.view_products", locale));
        return (
          <section key={section.blockInstanceId} className={`relative bg-gradient-to-br ${theme.heroBg} text-white`}>
            {heroUrl && (
              <div className="absolute inset-0 opacity-25">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroUrl} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
              <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">{heading}</h1>
              {subheading && <p className="mt-4 max-w-xl text-lg text-white/90">{subheading}</p>}
              <a href={safeHref(section.settings.ctaHref, hasProducts ? "#products" : "#contacts")} style={accentColor ? { backgroundColor: accentColor } : undefined} className={`mt-8 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold ${theme.accent}`}>
                {ctaLabel}
              </a>
            </div>
          </section>
        );
      }
      case "content-about":
      case "storefront-about": {
        const heading = text(section.settings.heading, t("storefront.about", locale));
        const body = text(section.settings.body, sf.description ?? "");
        if (!body) return null;
        return (
          <section key={section.blockInstanceId} className="mx-auto max-w-6xl px-4 py-10">
            <h2 className="text-xl font-bold text-slate-900">{heading}</h2>
            <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-slate-600">{body}</p>
            {formatLocation(sf.countryCode, sf.cityCode, locale) && (
              <div className="mt-4 text-sm text-slate-500">📍 {formatLocation(sf.countryCode, sf.cityCode, locale)}</div>
            )}
          </section>
        );
      }
      case "storefront-products": {
        const heading = text(section.settings.heading, t("storefront.products", locale));
        const pageSize = Math.min(24, Math.max(1, Number(section.settings.pageSize) || 12));
        return (
          <section key={section.blockInstanceId} id="products" className="mx-auto w-full max-w-6xl px-4 pb-12">
            <h2 className="text-xl font-bold text-slate-900">{heading}</h2>
            {!products || products.items.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">{t("storefront.no_products", locale)}</p>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.items.slice(0, pageSize).map((p) => (
                  <StorefrontProductCard key={p.id} sf={sf} card={p} locale={locale} preview={preview} />
                ))}
              </div>
            )}
          </section>
        );
      }
      case "content-cta":
      case "storefront-cta": {
        const heading = text(section.settings.heading);
        const label = text(section.settings.label);
        if (!heading && !label) return null;
        return (
          <section key={section.blockInstanceId} className="border-y border-slate-100 bg-slate-50">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10">
              {heading && <h2 className="text-xl font-bold text-slate-900">{heading}</h2>}
              {label && (
                <a href={safeHref(section.settings.href, "#contacts")} style={accentColor ? { backgroundColor: accentColor } : undefined} className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white ${theme.accent}`}>
                  {label}
                </a>
              )}
            </div>
          </section>
        );
      }
      case "storefront-contacts": {
        const heading = text(section.settings.heading, t("storefront.contacts", locale));
        return (
          <section key={section.blockInstanceId} id="contacts" className="border-t border-slate-100 bg-slate-50">
            <div className="mx-auto max-w-6xl px-4 py-10">
              <h2 className="text-xl font-bold text-slate-900">{heading}</h2>
              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-600">
                {sf.publicPhone && <a href={`tel:${sf.publicPhone.replace(/[^+\d]/g, "")}`} onClick={() => fireContactClick(sf.slug, "PHONE")} className={theme.accentHover}>📞 {sf.publicPhone}</a>}
                {sf.publicEmail && <a href={`mailto:${sf.publicEmail}`} onClick={() => fireContactClick(sf.slug, "EMAIL")} className={theme.accentHover}>✉️ {sf.publicEmail}</a>}
                {sf.whatsapp && <a href={`https://wa.me/${sf.whatsapp.replace(/[^+\d]/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={() => fireContactClick(sf.slug, "WHATSAPP")} className={theme.accentHover}>💬 WhatsApp</a>}
                {sf.websiteUrl && <a href={sf.websiteUrl} target="_blank" rel="noopener noreferrer" onClick={() => fireContactClick(sf.slug, "WEBSITE")} className={theme.accentHover}>🌐 {sf.websiteUrl.replace(/^https?:\/\//, "")}</a>}
                {sf.socialLinks?.map((l) => (
                  <a key={l.platform} href={l.url} target="_blank" rel="noopener noreferrer" onClick={() => fireContactClick(sf.slug, "SOCIAL", l.platform)} className={theme.accentHover}>
                    {SOCIAL_PLATFORM_ICONS[l.platform] ?? "🔗"} {l.platform}
                  </a>
                ))}
              </div>
            </div>
          </section>
        );
      }
      case "content-faq": {
        const heading = text(section.settings.heading, "Вопросы и ответы");
        const items = parseFaqItems(section.settings.itemsText);
        if (items.length === 0) return null;
        return (
          <section key={section.blockInstanceId} className="mx-auto max-w-4xl px-4 py-10">
            <h2 className="text-xl font-bold text-slate-900">{heading}</h2>
            <div className="mt-5 space-y-2">
              {items.map(({ question, answer }, i) => (
                <details key={`${section.blockInstanceId}-${i}`} className="rounded-lg border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-800">{question}</summary>
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{answer}</p>
                </details>
              ))}
            </div>
          </section>
        );
      }
      case "content-gallery": {
        const heading = text(section.settings.heading);
        const images = parseGalleryImages(section.settings.imagesText)
          .map((src) => {
            if (!src.startsWith("media:")) return src;
            const id = src.slice(6);
            return mediaUrlOverrides?.[id] ?? sf.media.find((m) => m.id === id)?.url;
          })
          .filter((src): src is string => Boolean(src));
        if (images.length === 0) return null;
        return (
          <section key={section.blockInstanceId} className="mx-auto max-w-6xl px-4 py-10">
            {heading && <h2 className="mb-5 text-xl font-bold text-slate-900">{heading}</h2>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${section.blockInstanceId}-${i}`} src={src} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover" />
              ))}
            </div>
          </section>
        );
      }
      case "content-form": {
        return (
          <StorefrontRequestForm
            key={section.blockInstanceId}
            slug={sf.slug}
            heading={text(section.settings.heading, "Оставить заявку")}
            body={text(section.settings.body)}
            label={text(section.settings.label, "Отправить")}
            successMessage={text(section.settings.successMessage, "Спасибо! Заявка отправлена.")}
          />
        );
      }
      case "storefront-footer": {
        const footerText = text(section.settings.text, name);
        return (
          <footer key={section.blockInstanceId} className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
            {footerText}
            {!brandingLoading && <> — {t("storefront.powered_by", locale)} <Link href="/" className="text-slate-500 hover:underline">{brandName}</Link></>}
          </footer>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white" style={fontFamily ? { fontFamily } : undefined}>
      <header className={`sticky top-0 z-20 ${theme.headerBg}`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={name} className="size-9 rounded-full object-cover" />
            ) : (
              <div className={`flex size-9 items-center justify-center rounded-xl text-base font-bold text-white ${theme.accent.split(" ")[0]}`}>{name.slice(0, 1).toUpperCase() || "T"}</div>
            )}
            <Link href={`/store/${sf.slug}`} className={`text-base font-bold ${theme.headerText}`}>{name}</Link>
          </div>
          <nav className="ml-auto flex items-center gap-1 text-sm" aria-label="Storefront">
            {menu.map((item) => (
              <Link key={item.slug} href={item.isHome ? `/store/${sf.slug}` : `/store/${sf.slug}/${item.slug}`} className={`rounded-lg px-3 py-1.5 text-slate-600 ${theme.accentHover}`}>
                {item.name}
              </Link>
            ))}
            {hasProducts && <a href="#products" className={`rounded-lg px-3 py-1.5 text-slate-600 ${theme.accentHover}`}>{t("storefront.products", locale)}</a>}
            {hasContacts && <a href="#contacts" className={`rounded-lg px-3 py-1.5 text-slate-600 ${theme.accentHover}`}>{t("storefront.contacts", locale)}</a>}
          </nav>
        </div>
      </header>
      <main className="flex-1">{sections.map(render)}</main>
      {preview && <div className="sticky bottom-0 z-30 border-t border-amber-200 bg-amber-50 py-2 text-center text-xs font-medium text-amber-700">{t("storefront.preview_banner", locale)}</div>}
    </div>
  );
}
