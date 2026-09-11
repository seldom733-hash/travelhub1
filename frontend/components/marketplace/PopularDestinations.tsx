"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
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
    image: "https://images.unsplash.com/photo-1603433489674-f30ef4c26e4f?w=600&h=400&fit=crop",
    priceFrom: "от 45 AZN",
  },
  {
    id: "istanbul",
    name: "Стамбул",
    country: "Турция",
    image: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=600&h=400&fit=crop",
    priceFrom: "от 120 AZN",
  },
  {
    id: "dubai",
    name: "Дубай",
    country: "ОАЭ",
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&h=400&fit=crop",
    priceFrom: "от 250 AZN",
  },
  {
    id: "tbilisi",
    name: "Тбилиси",
    country: "Грузия",
    image: "https://images.unsplash.com/photo-1565008576549-57569a49371d?w=600&h=400&fit=crop",
    priceFrom: "от 80 AZN",
  },
  {
    id: "gabala",
    name: "Габала",
    country: "Азербайджан",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=400&fit=crop",
    priceFrom: "от 60 AZN",
  },
];

export default function PopularDestinations() {
  const locale = useLocale();

  return (
    <section className="bg-dark py-16">
      <div className="mx-auto max-w-7xl px-4">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
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
            className="hidden items-center gap-1 text-sm text-gold transition-colors hover:text-gold-light sm:flex"
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
                <p className="text-xs text-neutral-400">{dest.country}</p>
                {dest.priceFrom && (
                  <p className="mt-1 text-xs text-gold">{dest.priceFrom}</p>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Mobile all destinations link */}
        <div className="mt-6 text-center sm:hidden">
          <Link
            href="/search?category=destinations"
            className="inline-flex items-center gap-1 text-sm text-gold transition-colors hover:text-gold-light"
          >
            {t("marketplace.all_destinations", locale)}
            <ArrowRight size={16} weight="light" />
          </Link>
        </div>
      </div>
    </section>
  );
}
