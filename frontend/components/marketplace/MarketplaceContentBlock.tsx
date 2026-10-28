"use client";

import type { SectionView } from "@/lib/constructor-api";
import { parseFaqItems, parseGalleryImages } from "@/lib/content-blocks";

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function safeHref(value: unknown, fallback = "#contacts"): string {
  const href = text(value, fallback).trim();
  if (href.startsWith("#") || href.startsWith("/")) return href;
  if (/^https?:\/\//i.test(href)) return href;
  return fallback;
}

/** Shared content blocks rendered in the dark marketplace theme. */
export default function MarketplaceContentBlock({ section }: { section: SectionView }) {
  switch (section.blockType) {
    case "content-about": {
      const heading = text(section.settings.heading, "О компании");
      const body = text(section.settings.body);
      if (!body) return null;
      return (
        <section className="mx-auto max-w-6xl px-4 py-14 text-white">
          <h2 className="text-2xl font-bold">{heading}</h2>
          <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-white/70">{body}</p>
        </section>
      );
    }
    case "content-cta": {
      const heading = text(section.settings.heading);
      const label = text(section.settings.label);
      if (!heading && !label) return null;
      return (
        <section className="border-y border-white/10 bg-white/5">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10 text-white">
            {heading && <h2 className="text-xl font-bold">{heading}</h2>}
            {label && <a href={safeHref(section.settings.href)} className="rounded-lg bg-[#d4a853] px-5 py-2.5 text-sm font-semibold text-black">{label}</a>}
          </div>
        </section>
      );
    }
    case "content-faq": {
      const heading = text(section.settings.heading, "Вопросы и ответы");
      const items = parseFaqItems(section.settings.itemsText);
      if (items.length === 0) return null;
      return (
        <section className="mx-auto max-w-4xl px-4 py-14 text-white">
          <h2 className="text-2xl font-bold">{heading}</h2>
          <div className="mt-5 space-y-2">
            {items.map(({ question, answer }, i) => (
              <details key={i} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <summary className="cursor-pointer text-sm font-semibold">{question}</summary>
                <p className="mt-2 whitespace-pre-line text-sm text-white/70">{answer}</p>
              </details>
            ))}
          </div>
        </section>
      );
    }
    case "content-gallery": {
      const heading = text(section.settings.heading);
      const images = parseGalleryImages(section.settings.imagesText).filter((src) => !src.startsWith("media:"));
      if (images.length === 0) return null;
      return (
        <section className="mx-auto max-w-6xl px-4 py-14 text-white">
          {heading && <h2 className="mb-5 text-2xl font-bold">{heading}</h2>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {images.map((src, i) => <img key={i} src={src} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover" />)}
          </div>
        </section>
      );
    }
    default:
      return null;
  }
}
