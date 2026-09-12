"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import { publicApi, type PublicProductCard } from "@/lib/public-api";

function HotTourCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-dark-card">
      <div className="aspect-[4/3] w-full animate-pulse bg-dark-border" />
      <div className="p-4">
        <div className="mb-2 h-3 w-16 animate-pulse rounded bg-dark-border" />
        <div className="mb-2 h-5 w-3/4 animate-pulse rounded bg-dark-border" />
        <div className="mb-3 h-3 w-1/2 animate-pulse rounded bg-dark-border" />
        <div className="flex items-center justify-between">
          <div className="h-4 w-20 animate-pulse rounded bg-dark-border" />
          <div className="size-7 animate-pulse rounded-full bg-dark-border" />
        </div>
      </div>
    </div>
  );
}

function HotTourCard({ card }: { card: PublicProductCard }) {
  const locale = useLocale();
  const img = card.primaryImage;

  return (
    <Link
      href={`/products/${card.slug}`}
      className="card-premium group relative overflow-hidden rounded-2xl bg-dark-card"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-dark-border">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.thumbUrl}
            alt={card.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-neutral-600">🗺</div>
        )}
        <div className="destination-overlay absolute inset-0" />
      </div>

      {/* Content */}
      <div className="p-4">
        {card.category?.title && (
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            {card.category.title}
          </p>
        )}
        <h3 className="line-clamp-2 font-serif text-base font-semibold text-white transition-colors group-hover:text-gold">
          {card.title}
        </h3>
        {card.seller && (
          <p className="mt-1 text-[11px] text-neutral-500">
            {card.seller.visibilityMode === "ANONYMOUS"
              ? t("seller.anonymous_label", locale)
              : card.seller.displayName ?? t("seller.anonymous_label", locale)}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          {card.priceFrom ? (
            <p className="text-sm font-semibold text-gold">
              {t("price.from", locale)} {card.priceFrom} {card.currency || ""}
            </p>
          ) : (
            <p className="text-xs text-neutral-500">{t("price.on_request", locale)}</p>
          )}
          <div className="flex size-7 items-center justify-center rounded-full border border-dark-border bg-dark/60 text-neutral-400 transition-colors group-hover:border-gold/40 group-hover:text-gold">
            <ArrowRight size={14} weight="light" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function HotTours() {
  const locale = useLocale();
  const [tours, setTours] = useState<PublicProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    // Backend has no type filter; fetch published marketplace products and filter client-side for TOUR type.
    // This uses real data from the existing Public Catalog API without creating fake backend endpoints.
    void publicApi
      .listProducts({ sort: "newest", pageSize: 50 })
      .then((r) => {
        if (alive) {
          const toursOnly = r.items.filter((item) => item.type === "TOUR").slice(0, 6);
          setTours(toursOnly);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setError(true);
          setLoading(false);
        }
      });
    return () => { alive = false; };
  }, []);

  // Don't render section at all if empty or error (no broken production UI)
  if (!loading && (tours.length === 0 || error)) return null;

  return (
    <section className="bg-dark py-16 sm:py-20">
      <div className="mx-auto max-w-[1400px] px-6">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between sm:mb-10">
          <div>
            <h2 className="font-serif text-2xl font-bold text-white sm:text-3xl">
              {t("marketplace.hot_tours_title", locale)}
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              {t("marketplace.hot_tours_subtitle", locale)}
            </p>
          </div>
          <Link
            href="/search?category=tours&sort=newest"
            className="hidden items-center gap-1.5 text-sm text-gold transition-colors hover:text-gold-light sm:flex"
          >
            {t("marketplace.all_hot_tours", locale)}
            <ArrowRight size={16} weight="light" />
          </Link>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <HotTourCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Tour cards */}
        {!loading && tours.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tours.map((tour) => (
              <HotTourCard key={tour.id} card={tour} />
            ))}
          </div>
        )}

        {/* Mobile all tours link */}
        {!loading && tours.length > 0 && (
          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/search?category=tours&sort=newest"
              className="inline-flex items-center gap-1.5 text-sm text-gold transition-colors hover:text-gold-light"
            >
              {t("marketplace.all_hot_tours", locale)}
              <ArrowRight size={16} weight="light" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
