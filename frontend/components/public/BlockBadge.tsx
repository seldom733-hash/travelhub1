"use client";

import { useLocale } from "@/lib/i18n";

/** Block/charter tour marker. */
export default function BlockBadge({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const label = locale === "az" ? "Blok tur" : locale === "en" ? "Block tour" : "Блочный тур";
  return (
    <span
      className={`inline-flex items-center rounded-full border border-amber-400/60 bg-amber-950/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300 backdrop-blur-sm ${className}`}
      title={label}
    >
      BLOCK
    </span>
  );
}
