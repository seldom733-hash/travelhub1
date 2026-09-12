"use client";

import { t, useLocale } from "@/lib/i18n";
import GlobalSearch from "./GlobalSearch";
import QuickCategories from "./QuickCategories";

export default function HeroSection() {
  const locale = useLocale();

  return (
    <section className="relative min-h-[540px] overflow-hidden bg-dark lg:min-h-[620px]">
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
      <div className="relative z-10 mx-auto max-w-[1400px] px-6 pb-10 pt-16 sm:pt-20 lg:pt-24">
        <div className="flex items-end justify-between gap-8">
          {/* Left: Headline + Description */}
          <div className="max-w-3xl">
            <h1 className="font-serif text-4xl font-bold leading-[1.1] text-white sm:text-5xl lg:text-6xl">
              {t("marketplace.hero_title_1", locale)}
              <br />
              <span className="text-gold-gradient">{t("marketplace.hero_title_2", locale)}</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-neutral-300 sm:text-base">
              {t("marketplace.hero_description", locale)}
            </p>
          </div>

          {/* Right: Cursive tagline */}
          <div className="hidden shrink-0 pb-2 lg:block">
            <p className="font-serif text-lg italic leading-snug text-gold/60">
              Больше,
              <br />
              чем просто
              <br />
              путешествия
            </p>
          </div>
        </div>

        {/* Search panel */}
        <div className="mx-auto mt-8 max-w-5xl">
          <GlobalSearch />
        </div>

        {/* Quick categories */}
        <div className="mx-auto mt-6 max-w-5xl">
          <QuickCategories />
        </div>
      </div>
    </section>
  );
}
