"use client";

import { useState, useEffect, useCallback } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";
import HeroSearch from "./HeroSearch";

interface Slide {
  image: string;
  titleKey1: string;
  titleKey2: string;
  descKey: string;
  tagline: string;
}

const SLIDES: Slide[] = [
  {
    image: "/hero1.png",
    titleKey1: "marketplace.hero_title_1",
    titleKey2: "marketplace.hero_title_2",
    descKey: "marketplace.hero_description",
    tagline: "Больше,\nчем просто\nпутешествия",
  },
  {
    image: "/hero2.png",
    titleKey1: "marketplace.hero_slide_2_title_1",
    titleKey2: "marketplace.hero_slide_2_title_2",
    descKey: "marketplace.hero_slide_2_description",
    tagline: "Надёжный\nпартнёр\nдля бизнеса",
  },
  {
    image: "/hero3.png",
    titleKey1: "marketplace.hero_slide_3_title_1",
    titleKey2: "marketplace.hero_slide_3_title_2",
    descKey: "marketplace.hero_slide_3_description",
    tagline: "Ваша\nвитрина\nв миреtravel",
  },
];

const AUTOPLAY_INTERVAL = 7000;

export default function HeroSection() {
  const locale = useLocale();
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goTo = useCallback((index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent(index);
    setTimeout(() => setIsTransitioning(false), 600);
  }, [isTransitioning]);

  const next = useCallback(() => {
    goTo((current + 1) % SLIDES.length);
  }, [current, goTo]);

  const prev = useCallback(() => {
    goTo((current - 1 + SLIDES.length) % SLIDES.length);
  }, [current, goTo]);

  // Autoplay
  useEffect(() => {
    const timer = setInterval(next, AUTOPLAY_INTERVAL);
    return () => clearInterval(timer);
  }, [next]);

  const slide = SLIDES[current];

  return (
    <section className="relative min-h-[540px] overflow-hidden bg-dark lg:min-h-[620px]">
      {/* Background images - all three layered */}
      {SLIDES.map((s, i) => (
        <div
          key={s.image}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.image}
            alt=""
            className={`h-full w-full object-cover object-center ${
              s.image === "/hero2.png" ? "scale-x-[-1]" : ""
            }`}
            fetchPriority={i === 0 ? "high" : "low"}
          />
        </div>
      ))}
      {/* Overlay */}
      <div className="hero-overlay absolute inset-0 z-[1]" />

      {/* Navigation arrows */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 z-20 flex size-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-dark/40 text-white/70 backdrop-blur-sm transition-all hover:border-gold/50 hover:bg-dark/60 hover:text-white lg:left-8"
        aria-label="Previous slide"
      >
        <CaretLeft size={24} weight="light" />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 z-20 flex size-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-dark/40 text-white/70 backdrop-blur-sm transition-all hover:border-gold/50 hover:bg-dark/60 hover:text-white lg:right-8"
        aria-label="Next slide"
      >
        <CaretRight size={24} weight="light" />
      </button>

      {/* Indicators */}
      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2.5 sm:bottom-8">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current
                ? "w-8 bg-gold"
                : "w-2 bg-white/40 hover:bg-white/60"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Content - flex column with Search pushed to bottom */}
      <div className="relative z-10 mx-auto flex min-h-[540px] flex-col justify-end px-6 pb-10 pt-16 sm:min-h-[620px] sm:pb-12 sm:pt-20 lg:pt-24">
        <div className="mx-auto w-full max-w-[1400px]">
          {/* Headline + Description */}
          <div className="mb-auto max-w-3xl pb-4">
            <h1 className="font-serif text-4xl font-bold leading-[1.1] text-white sm:text-5xl lg:text-6xl">
              {t(slide.titleKey1, locale)}
              <br />
              <span className="text-gold-gradient">{t(slide.titleKey2, locale)}</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-neutral-300 sm:text-base">
              {t(slide.descKey, locale)}
            </p>
          </div>

          {/* Search panel - positioned at bottom */}
          <div className="mx-auto max-w-5xl">
            <HeroSearch />
          </div>
        </div>
      </div>
    </section>
  );
}
