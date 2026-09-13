"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import { publicApi, type PublicProductCard } from "@/lib/public-api";

function LatestOfferCardSkeleton() {
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

function LatestOfferCard({ card }: { card: PublicProductCard }) {
  const locale = useLocale();
  const img = card.primaryImage;

  const relativeTime = useMemo(() => {
    if (!card.publishedAt) return null;
    const now = Date.now();
    const published = new Date(card.publishedAt).getTime();
    const diffMs = now - published;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t("marketplace.just_now", locale) || null;
    if (diffMin < 60) {
      const key = locale === "ru" ? "{n} мин. назад" : locale === "az" ? "{n} dəq. əvvəl" : "{n} min ago";
      return key.replace("{n}", String(diffMin));
    }
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) {
      const key = locale === "ru" ? "{n} ч. назад" : locale === "az" ? "{n} saat əvvəl" : "{n}h ago";
      return key.replace("{n}", String(diffH));
    }
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) {
      return locale === "ru" ? "вчера" : locale === "az" ? "dünən" : "yesterday";
    }
    if (diffD < 7) {
      const key = locale === "ru" ? "{n} дн. назад" : locale === "az" ? "{n} gün əvvəl" : "{n}d ago";
      return key.replace("{n}", String(diffD));
    }
    return new Date(card.publishedAt).toLocaleDateString(locale === "ru" ? "ru-RU" : locale === "az" ? "az-AZ" : "en-US");
  }, [card.publishedAt, locale]);

  return (
    <Link
      href={`/products/${card.slug}`}
      className="card-premium group relative overflow-hidden rounded-2xl bg-dark-card"
    >
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
        {relativeTime && (
          <span className="absolute left-3 top-3 rounded-full bg-dark/70 px-2.5 py-1 text-[11px] font-medium text-neutral-300 backdrop-blur-sm">
            {relativeTime}
          </span>
        )}
      </div>

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

export default function LatestOffers() {
  const locale = useLocale();
  const [offers, setOffers] = useState<PublicProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    // sort=newest → publishedAt DESC (server-side), which is the canonical "latest" ordering.
    // Fetch all published marketplace products and take the first 6 by publication date.
    void publicApi
      .listProducts({ sort: "newest", pageSize: 50 })
      .then((r) => {
        if (alive) {
          // Deduplicate by id (safety net), take top 6
          const seen = new Set<string>();
          const unique = r.items.filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          }).slice(0, 6);
          setOffers(unique);
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

  if (!loading && (offers.length === 0 || error)) {
    return (
      <section className="bg-dark th-section">
        <div className="th-container text-center">
          <h2 className="font-serif text-2xl font-bold text-white sm:text-3xl">
            {t("marketplace.latest_offers_title", locale)}
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            {t("marketplace.latest_offers_subtitle", locale)}
          </p>
          <div className="mt-10 rounded-2xl border border-dark-border bg-dark-card p-10">
            <p className="text-lg font-medium text-neutral-300">
              {t("marketplace.latest_offers_empty", locale)}
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              {t("marketplace.latest_offers_empty_hint", locale)}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-dark th-section">
      <div className="th-container">
        <div className="mb-8 flex items-end justify-between sm:mb-10">
          <div>
            <h2 className="font-serif text-2xl font-bold text-white sm:text-3xl">
              {t("marketplace.latest_offers_title", locale)}
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              {t("marketplace.latest_offers_subtitle", locale)}
            </p>
          </div>
          <Link
            href="/search?sort=newest"
            className="hidden items-center gap-1.5 text-sm text-gold transition-colors hover:text-gold-light sm:flex"
          >
            {t("marketplace.all_latest", locale)}
            <ArrowRight size={16} weight="light" />
          </Link>
        </div>

        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <LatestOfferCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && offers.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {offers.map((offer) => (
              <LatestOfferCard key={offer.id} card={offer} />
            ))}
          </div>
        )}

        {!loading && offers.length > 0 && (
          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/search?sort=newest"
              className="inline-flex items-center gap-1.5 text-sm text-gold transition-colors hover:text-gold-light"
            >
              {t("marketplace.all_latest", locale)}
              <ArrowRight size={16} weight="light" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
