"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PublicLayout from "@/components/PublicLayout";
import MediaGallery from "@/components/public/MediaGallery";
import Price from "@/components/public/Price";
import { PublicErrorState, PublicNotFound } from "@/components/public/PublicStates";
import { PdpSkeleton } from "@/components/public/Skeletons";
import { formatDate, formatPrice as formatPriceRaw, t, useLocale } from "@/lib/i18n";
import { fireMarketplaceCta, useMarketplaceProductViewed } from "@/lib/behavioral-events";
import { availabilityText, sectionLabel, sectionsFor } from "@/lib/marketplace-utils";
import { publicApi, PublicNotFoundError, type PublicProductDetail, type PublicTariff } from "@/lib/public-api";
import { formatLocation } from "@/lib/locations";
import { useCurrentUser } from "@/lib/use-user";

/**
 * PHASE 1 STEP 1.7 §12 — Product Detail Page `/products/:slug`.
 * Только approved + PUBLISHED версия (backend уже гарантирует), только Public
 * API, только стабильные public media URLs, только реальные данные (секции,
 * которых нет в данных, не показываются). Checkout/Booking не создаются.
 */
function PdpInner() {
  const params = useParams<{ slug: string }>();
  const locale = useLocale();
  const slug = params?.slug ?? "";
  const [detail, setDetail] = useState<PublicProductDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setNotFound(false);
    setError("");
    void publicApi
      .getProduct(slug)
      .then((d) => {
        if (alive) setDetail(d);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof PublicNotFoundError) setNotFound(true);
        else setError((e as Error).message);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  if (notFound) {
    return (
      <PublicLayout>
        <PublicNotFound title={t("pdp.not_found_title", locale)} hint={t("pdp.not_found_hint", locale)} />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        {error && <PublicErrorState message={error} />}
        {detail === null && !error && <PdpSkeleton />}
        {detail && <PdpContent detail={detail} />}
      </div>
    </PublicLayout>
  );
}

function PdpContent({ detail }: { detail: PublicProductDetail }) {
  const locale = useLocale();
  const user = useCurrentUser();
  const p = detail.product;
  const availability = availabilityText(p.availability, locale);
  const attributeSections = sectionsFor(p.attributes, locale);

  // Step 1.13B: PDP реально открыт (client render, fire-once; не SSR/prefetch).
  useMarketplaceProductViewed(p.slug, true);

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      {/* ── Left: gallery + description ── */}
      <div>
        {/* Breadcrumbs */}
        <nav className="mb-3 text-xs text-slate-400" aria-label="breadcrumb">
          <Link href="/" className="hover:text-blue-600 hover:underline">
            {t("pdp.breadcrumb_home", locale)}
          </Link>
          {p.category && (
            <>
              <span className="mx-1.5">/</span>
              <Link href={`/categories/${p.category.slug}`} className="hover:text-blue-600 hover:underline">
                {p.category.title}
              </Link>
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
            <Link href={`/categories/${p.category.slug}`} className="rounded-full bg-blue-50 px-2.5 py-0.5 font-medium text-blue-700 hover:bg-blue-100">
              {p.category.title}
            </Link>
          )}
          <span>
            {t("pdp.published_on", locale)}: {formatDate(p.publishedAt, locale)}
          </span>
        </div>

        {/* Media gallery — только PUBLISHED media, stable public URLs */}
        <div className="mt-5">
          <MediaGallery media={detail.media} />
        </div>

        {/* Description */}
        <section className="mt-8" aria-labelledby="pdp-description">
          <h2 id="pdp-description" className="text-lg font-bold text-slate-900">
            {t("pdp.description_title", locale)}
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {p.description ?? t("pdp.description_missing", locale)}
          </p>
        </section>

        {/* Attributes sections — только реальные данные */}
        {attributeSections.length > 0 && (
          <section className="mt-8" aria-labelledby="pdp-attrs">
            <h2 id="pdp-attrs" className="text-lg font-bold text-slate-900">
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

        {/* Tariffs / options */}
        {p.tariffs.length > 0 && (
          <section className="mt-8" aria-labelledby="pdp-tariffs">
            <h2 id="pdp-tariffs" className="text-lg font-bold text-slate-900">
              {t("pdp.tariffs_title", locale)}
            </h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
              {p.tariffs.map((tariff, i) => (
                <TariffRow key={tariff.id} tariff={tariff} last={i === p.tariffs.length - 1} />
              ))}
            </div>
          </section>
        )}

        {/* Availability (discovery-only, без бронирования) */}
        <section className="mt-8" aria-labelledby="pdp-availability">
          <h2 id="pdp-availability" className="text-lg font-bold text-slate-900">
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

      {/* ── Right: price / CTA / seller (seller-safe projection, Step 1.11) ── */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs uppercase tracking-wide text-slate-400">{t("pdp.price_from", locale)}</div>
          <div className="mt-1">
            <Price amount={p.priceFrom} currency={p.currency} size="lg" withPrefix={false} />
          </div>

          {user === null ? (
            // Step 1.9 §6: anonymous → login с safe next (возврат к исходной
            // Product-странице после аутентификации). Step 1.13B: CTA клик —
            // намерение (НЕ Order/Booking), durable behavioral event.
            <Link
              href={`/login?next=${encodeURIComponent(`/products/${p.slug}`)}`}
              onClick={() => fireMarketplaceCta(p.slug)}
              className="mt-4 block w-full rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              {t("pdp.primary_cta", locale)}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => fireMarketplaceCta(p.slug)}
              className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              {t("pdp.primary_cta", locale)}
            </button>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{t("pdp.cta_placeholder", locale)}</p>
        </div>

        {p.tariffs.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
            <div className="text-xs uppercase tracking-wide text-slate-400">{t("pdp.tariffs_title", locale)}</div>
            <ul className="mt-2 space-y-1.5">
              {p.tariffs.map((trf) => (
                <li key={trf.id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-slate-600">{trf.name}</span>
                  <span className="shrink-0 font-medium text-slate-800">
                    {formatPriceLocal(trf, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {p.seller && <SellerBlock seller={p.seller} locale={locale} />}
      </aside>
    </div>
  );
}

/**
 * Step 1.11 §8/§9: seller-safe projection. ANONYMOUS → generic label «Проверенный
 * партнёр TravelHub» (никогда raw CRM name); VERIFIED_ALIAS/PUBLIC_BRAND → approved
 * имя. НИКАКИХ phone/email/site/socials/юр. данных — даже при PUBLIC_BRAND.
 */
function SellerBlock({ seller, locale }: { seller: NonNullable<PublicProductDetail["product"]["seller"]>; locale: ReturnType<typeof useLocale> }) {
  const isAnonymous = seller.visibilityMode === "ANONYMOUS";
  const name = isAnonymous ? t("seller.anonymous_label", locale) : (seller.displayName ?? t("seller.anonymous_label", locale));
  const since = seller.memberSince ? formatDate(seller.memberSince, locale) : "";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
      <div className="text-xs uppercase tracking-wide text-slate-400">{t("seller.title", locale)}</div>
      <div className="mt-1 flex items-center gap-1.5 font-semibold text-slate-800">
        <span className="truncate">{name}</span>
        {seller.verified && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            ✓ {t("seller.verified_badge", locale)}
          </span>
        )}
      </div>
      {/* FIX 2: география — коды (countryCode/cityCode), локализуется по locale:
          RU: «Баку, Азербайджан» / AZ: «Bakı, Azərbaycan» / EN: «Baku, Azerbaijan». */}
      {(() => {
        const loc = formatLocation(seller.countryCode, seller.cityCode, locale);
        return loc ? <div className="mt-0.5 text-xs text-slate-500">📍 {loc}</div> : null;
      })()}
      {since && <div className="mt-1 text-[11px] text-slate-400">{t("seller.member_since", locale)}: {since}</div>}
      <p className="mt-2 text-[11px] text-slate-400">{t("seller.moderated_notice", locale)}</p>
    </div>
  );
}

function TariffRow({ tariff, last }: { tariff: PublicTariff; last: boolean }) {
  const locale = useLocale();
  return (
    <div className={`flex items-center justify-between gap-3 bg-white px-4 py-3 ${last ? "" : "border-b border-slate-100"}`}>
      <div>
        <div className="text-sm font-medium text-slate-800">{tariff.name}</div>
        {tariff.validFrom && (
          <div className="text-[11px] text-slate-400">
            {formatDate(tariff.validFrom, locale)}
            {tariff.validTo ? ` – ${formatDate(tariff.validTo, locale)}` : ""}
          </div>
        )}
      </div>
      <div className="shrink-0 text-sm font-semibold text-slate-900">{formatPriceLocal(tariff, locale)}</div>
    </div>
  );
}

function formatPriceLocal(tariff: PublicTariff, locale: ReturnType<typeof useLocale>): string {
  const formatted = formatPriceRaw(tariff.price, tariff.currency, locale);
  return formatted ?? tariff.price;
}

export default function ProductPage() {
  return (
    <Suspense
      fallback={
        <PublicLayout>
          <div className="p-8">
            <PdpSkeleton />
          </div>
        </PublicLayout>
      }
    >
      <PdpInner />
    </Suspense>
  );
}
