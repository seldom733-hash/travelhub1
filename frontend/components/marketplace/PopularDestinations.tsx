"use client";

import Link from "next/link";
import { ArrowRight, MapPin } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";

interface Destination {
  id: string;
  name: string;
  country: string;
  image: string;
  priceFrom?: string;
}

const DESTINATIONS: Destination[] = [
  {
    id: "baku",
    name: "Баку",
    country: "Азербайджан",
    image: "https://images.unsplash.com/photo-1569982175971-d92b01cf8694?w=600&h=400&fit=crop",
    priceFrom: "от 210 AZN",
  },
  {
    id: "istanbul",
    name: "Стамбул",
    country: "Турция",
    image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=600&h=400&fit=crop",
    priceFrom: "от 320 AZN",
  },
  {
    id: "dubai",
    name: "Дубай",
    country: "ОАЭ",
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&h=400&fit=crop",
    priceFrom: "от 450 AZN",
  },
  {
    id: "tbilisi",
    name: "Тбилиси",
    country: "Грузия",
    image: "https://images.unsplash.com/photo-1565008576549-57569a49371d?w=600&h=400&fit=crop",
    priceFrom: "от 310 AZN",
  },
  {
    id: "gabala",
    name: "Габала",
    country: "Азербайджан",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop",
    priceFrom: "от 160 AZN",
  },
];

export default function PopularDestinations() {
  const locale = useLocale();

  return (
    <section className="bg-dark py-16 sm:py-20">
      <div className="mx-auto max-w-[1400px] px-6">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between sm:mb-10">
          <div>
            <h2 className="font-serif text-2xl font-bold text-white sm:text-3xl">
              {t("marketplace.popular_destinations_title", locale)}
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              {t("marketplace.popular_destinations_subtitle", locale)}
            </p>
          </div>
          <Link
            href="/search?category=destinations"
            className="hidden items-center gap-1.5 text-sm text-gold transition-colors hover:text-gold-light sm:flex"
          >
            {t("marketplace.all_destinations", locale)}
            <ArrowRight size={16} weight="light" />
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {DESTINATIONS.map((dest) => (
            <Link
              key={dest.id}
              href={`/search?q=${encodeURIComponent(dest.name)}`}
              className="card-premium group relative overflow-hidden rounded-2xl bg-dark-card"
            >
              {/* Image */}
              <div className="relative aspect-[4/3] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={dest.image}
                  alt={`${dest.name}, ${dest.country}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="destination-overlay absolute inset-0" />
              </div>

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="font-serif text-lg font-semibold text-white">
                  {dest.name}
                </h3>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-400">
                  <MapPin size={10} weight="light" />
                  {dest.country}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  {dest.priceFrom && (
                    <p className="text-sm font-medium text-gold">{dest.priceFrom}</p>
                  )}
                  <div className="flex size-7 items-center justify-center rounded-full border border-dark-border bg-dark/60 text-neutral-400 transition-colors group-hover:border-gold/40 group-hover:text-gold">
                    <ArrowRight size={14} weight="light" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Mobile all destinations link */}
        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/search?category=destinations"
            className="inline-flex items-center gap-1.5 text-sm text-gold transition-colors hover:text-gold-light"
          >
            {t("marketplace.all_destinations", locale)}
            <ArrowRight size={16} weight="light" />
          </Link>
        </div>
      </div>
    </section>
  );
}
