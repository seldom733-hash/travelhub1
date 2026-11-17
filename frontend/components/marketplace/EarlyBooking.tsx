"use client";

import { displayTourName } from "@/lib/supplier-labels";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Compass } from "@phosphor-icons/react";
import { t, useLocale, formatDateShort, formatPrice } from "@/lib/i18n";
import { publicApi, type PublicProductCard } from "@/lib/public-api";
import { useHotelPhoto } from "@/lib/hotel-photo";
import SupplierCodeBadge from "@/components/public/SupplierCodeBadge";
import GdsBadge from "@/components/public/GdsBadge";
import BlockBadge from "@/components/public/BlockBadge";
import { categoryLabel } from "@/lib/category-label";

function EarlyBookingCardSkeleton() {
  return (
    <div className="card-skeleton overflow-hidden rounded-2xl bg-dark-card">
      <div className="h-36 w-full animate-pulse bg-dark-border" />
      <div className="p-4">
        <div className="mb-2 h-3 w-16 animate-pulse rounded bg-dark-border" />
        <div className="mb-2 h-5 w-3/4 animate-pulse rounded bg-dark-border" />
        <div className="mb-2 h-3 w-1/2 animate-pulse rounded bg-dark-border" />
        <div className="mb-3 h-3 w-2/3 animate-pulse rounded bg-dark-border" />
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 animate-pulse rounded bg-dark-border" />
          <div className="h-3 w-16 animate-pulse rounded bg-dark-border" />
        </div>
      </div>
    </div>
  );
}

function EarlyBookingCard({ card }: { card: PublicProductCard }) {
  const locale = useLocale();
  const hotelPhoto = useHotelPhoto(card.hotelImage);
  const img = card.primaryImage ? { thumbUrl: card.primaryImage.thumbUrl } : hotelPhoto ? { thumbUrl: hotelPhoto } : null;

  return (
    <Link
      href={`/products/${card.code}`}
      className="card-premium group relative overflow-hidden rounded-2xl bg-dark-card"
    >
      {/* Image — уменьшенная высота фото */}
      <div className="relative h-36 overflow-hidden bg-dark-border">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.thumbUrl}
            alt={displayTourName(card.title)}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-neutral-600">
            <Compass size={40} weight="light" />
          </div>
        )}
        {card.isGds && <GdsBadge className="absolute left-3 top-3 z-10" />}
        {card.isGdsHotel && <GdsBadge className="absolute left-3 top-3 z-10" />}
        {card.isBlock && <BlockBadge className="absolute left-3 top-9 z-10" />}
        <div className="destination-overlay absolute inset-0" />
      </div>

      {/* Content */}
      <div className="p-4">
        {categoryLabel(card.category, locale) && (
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            {categoryLabel(card.category, locale)}
          </p>
        )}
        <h3 className="line-clamp-2 font-serif text-sm font-semibold tracking-[0.012em] text-white transition-colors group-hover:text-gold">
          {displayTourName(card.title)}
        </h3>
        {card.shortDescription && (
          <p className="mt-1 line-clamp-1 text-[10px] text-neutral-500">
            {card.shortDescription}
          </p>
        )}
        <SupplierCodeBadge code={card.partnerCode} className="mt-1 text-[10px] text-neutral-500" />
        <div className="mt-3 flex items-center justify-between">
          <div>
            {card.priceFrom ? (
              <p className="text-xs font-semibold text-gold">
                {formatPrice(card.priceFrom, card.currency, locale)}
                {card.headlineDepartureDate && <span className="ml-1 font-normal text-neutral-400">· {formatDateShort(card.headlineDepartureDate, locale)}</span>}
                {card.headlineNights != null && <span className="ml-1 font-normal text-neutral-400">· {card.headlineNights} {card.headlineNights === 1 ? t("card.night", locale) : t("card.nights", locale)}</span>}
              </p>
            ) : (
              <p className="text-xs text-neutral-500">{t("price.on_request", locale)}</p>
            )}
          </div>
          <span className="text-[11px] text-neutral-500 transition-colors group-hover:text-gold">
            {t("card.details", locale)}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Early-booking programs of the Summer supplier (SUMMERTOUR). */
const EARLY_BOOKING_PROGRAMS = ["Antalya 2027", "Antalya 2027 +1"];
const EARLY_BOOKING_SUPPLIER = "SUMMERTOUR";
const EARLY_BOOKING_MAX = 6;

export default function EarlyBooking() {
  const locale = useLocale();
  const [cards, setCards] = useState<PublicProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    void (async () => {
      const results = await Promise.all(
        EARLY_BOOKING_PROGRAMS.map(async (program) => {
          try {
            const res = await publicApi.listProducts({
              category: "tours",
              supplierCode: EARLY_BOOKING_SUPPLIER,
              program,
              sort: "price_asc",
              pageSize: 20,
            });
            return res.items.filter((item) => item.type === "TOUR");
          } catch {
            return [] as PublicProductCard[];
          }
        }),
      );
      if (!alive) return;
      const merged = Array.from(new Map(results.flat().map((card) => [card.id, card])).values());
      merged.sort((a, b) => Number(a.priceFrom ?? 0) - Number(b.priceFrom ?? 0));
      setCards(merged.slice(0, EARLY_BOOKING_MAX));
      setLoading(false);
    })().catch(() => {
      if (alive) {
        setError(true);
        setLoading(false);
      }
    });
    return () => { alive = false; };
  }, []);

  // Не рендерим блок, если нет карточек/ошибок (поведение соседних секций).
  if (!loading && (cards.length === 0 || error)) return null;

  const headingId = "early-booking-title";

  return (
    <section className="bg-dark th-section" aria-labelledby={headingId}>
      <div className="th-container">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between sm:mb-10">
          <div>
            <h2 id={headingId} className="font-serif text-2xl font-bold text-white sm:text-3xl">
              {t("marketplace.early_booking_title", locale)}
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              {t("marketplace.early_booking_subtitle", locale)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/search?category=tours&sort=price_asc`}
              className="hidden items-center gap-1.5 text-sm text-gold transition-colors hover:text-gold-light sm:flex"
            >
              {t("marketplace.all_tours", locale)}
              <ArrowRight size={16} weight="light" />
            </Link>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <EarlyBookingCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Early-booking tour cards */}
        {!loading && cards.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((card) => (
              <EarlyBookingCard key={card.id} card={card} />
            ))}
          </div>
        )}

        {/* Mobile all tours link */}
        {!loading && cards.length > 0 && (
          <div className="mt-8 flex items-center justify-center gap-3 sm:hidden">
            <Link
              href={`/search?category=tours&sort=price_asc`}
              className="inline-flex items-center gap-1.5 text-sm text-gold transition-colors hover:text-gold-light"
            >
              {t("marketplace.all_tours", locale)}
              <ArrowRight size={16} weight="light" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
