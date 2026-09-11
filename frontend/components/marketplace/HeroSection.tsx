"use client";

import { t, useLocale } from "@/lib/i18n";
import GlobalSearch from "./GlobalSearch";
import QuickCategories from "./QuickCategories";

export default function HeroSection() {
  const locale = useLocale();

  return (
    <section className="relative min-h-[600px] overflow-hidden bg-dark lg:min-h-[700px]">
      {/* Background image */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero.png"
          alt=""
          className="h-full w-full object-cover object-center"
          fetchPriority="high"
        />
        <div className="hero-overlay absolute inset-0" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-12 pt-20 sm:pt-24 lg:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          {/* Headline */}
          <h1 className="font-serif text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            {t("marketplace.hero_title_1", locale)}
            <br />
            <span className="text-gold-gradient">{t("marketplace.hero_title_2", locale)}</span>
          </h1>

          {/* Description */}
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-neutral-300 sm:text-lg">
            {t("marketplace.hero_description", locale)}
          </p>
        </div>

        {/* Search panel */}
        <div className="mx-auto mt-10 max-w-4xl">
          <GlobalSearch />
        </div>

        {/* Quick categories */}
        <div className="mx-auto mt-8 max-w-4xl">
          <QuickCategories />
        </div>
      </div>
    </section>
  );
}
