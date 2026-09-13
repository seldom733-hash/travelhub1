"use client";

import { useState, useEffect, useCallback } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";

interface Slide {
  image: string;
  titleKey1: string;
  titleKey2: string;
  descKey: string;
  tagline: string;
}

/** Published hero configuration shape (Constructor → heroConfig). */
export interface HeroSlideConfig {
  id: string;
  imageUrl: string;
  title: Record<string, string>;
  subtitle: Record<string, string>;
  ctaLabel: Record<string, string>;
  ctaUrl: string;
  imageMeta?: { width: number; height: number; format: string; size: number };
}

export interface HeroConfigShape {
  slides: HeroSlideConfig[];
  carousel?: {
    autoplay?: boolean;
    interval?: number;
    showArrows?: boolean;
    showIndicators?: boolean;
  };
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

interface ConfiguredSlide {
  image: string;
  title1: string;
  title2: string;
  description: string;
}

function localized(value: Record<string, string> | undefined, locale: string): string {
  return (value?.[locale] || value?.ru || "").trim();
}

function buildConfiguredSlides(config: HeroConfigShape, locale: string): ConfiguredSlide[] | null {
  const slides = config.slides?.filter((s) => s.imageUrl);
  if (!slides?.length) return null;
  return slides.map((s) => ({
    image: s.imageUrl,
    title1: localized(s.title, locale),
    title2: localized(s.subtitle, locale),
    description: localized(s.ctaLabel, locale),
  }));
}

export default function HeroSection({ config }: { config?: HeroConfigShape | null }) {
  const locale = useLocale();
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const configured = config ? buildConfiguredSlides(config, locale) : null;
  const useConfigured = configured !== null;

  const carousel = config?.carousel ?? {};
  const autoplay = carousel.autoplay !== false;
  const interval = Math.max(3000, Math.min(15000, carousel.interval ?? AUTOPLAY_INTERVAL));
  const showArrows = carousel.showArrows !== false;
  const showIndicators = carousel.showIndicators !== false;

  const slideCount = useConfigured ? configured!.length : SLIDES.length;

  const goTo = useCallback((index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrent(index);
    setTimeout(() => setIsTransitioning(false), 600);
  }, [isTransitioning]);

  const next = useCallback(() => {
    goTo((current + 1) % slideCount);
  }, [current, goTo, slideCount]);

  const prev = useCallback(() => {
    goTo((current - 1 + slideCount) % slideCount);
  }, [current, goTo, slideCount]);

  // Autoplay
  useEffect(() => {
    if (!autoplay || slideCount <= 1) return;
    const timer = setInterval(next, interval);
    return () => clearInterval(timer);
  }, [next, autoplay, interval, slideCount]);

  // Keep index in range when the slide count changes (config swap on locale change)
  useEffect(() => {
    if (current >= slideCount) setCurrent(0);
  }, [slideCount, current]);

  // ─── Content resolution ──────────────────────────────────────────────
  const configuredSlide = useConfigured ? configured![Math.min(current, configured!.length - 1)] : null;
  const defaultSlide = SLIDES[Math.min(current, SLIDES.length - 1)];

  const images = useConfigured
    ? configured!.map((s) => s.image)
    : SLIDES.map((s) => s.image);

  return (
    <section className="relative min-h-[540px] overflow-hidden bg-dark lg:min-h-[620px]">
      {/* Background images - all layered */}
      {images.map((image, i) => (
        <div
          key={`${image}-${i}`}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            className={`h-full w-full object-cover object-center ${
              image === "/hero2.png" ? "scale-x-[-1]" : ""
            }`}
            fetchPriority={i === 0 ? "high" : "low"}
          />
        </div>
      ))}
      {/* Overlay */}
      <div className="hero-overlay absolute inset-0 z-[1]" />

      {/* Navigation arrows */}
      {showArrows && slideCount > 1 && (
      <>
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
      </>
      )}

      {/* Indicators */}
      {showIndicators && slideCount > 1 && (
      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2.5 sm:bottom-8">
        {images.map((_, i) => (
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
      )}

      {/* Content — cinematic text only, NO search */}
      <div className="relative z-10 mx-auto flex min-h-[540px] flex-col justify-end px-6 pb-10 pt-16 sm:min-h-[620px] sm:pb-12 sm:pt-20 lg:pt-24">
        <div className="mx-auto w-full max-w-[1400px]">
          <div className="max-w-3xl pb-4">
            {configuredSlide ? (
              <>
                <h1 className="font-serif text-4xl font-bold leading-[1.1] text-white sm:text-5xl lg:text-6xl">
                  {configuredSlide.title1}
                  {configuredSlide.title2 && (
                    <>
                      <br />
                      <span className="text-gold-gradient">{configuredSlide.title2}</span>
                    </>
                  )}
                </h1>
                {configuredSlide.description && (
                  <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-neutral-300 sm:text-base">
                    {configuredSlide.description}
                  </p>
                )}
              </>
            ) : (
              <>
                <h1 className="font-serif text-4xl font-bold leading-[1.1] text-white sm:text-5xl lg:text-6xl">
                  {t(defaultSlide.titleKey1, locale)}
                  <br />
                  <span className="text-gold-gradient">{t(defaultSlide.titleKey2, locale)}</span>
                </h1>
                <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-neutral-300 sm:text-base">
                  {t(defaultSlide.descKey, locale)}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
