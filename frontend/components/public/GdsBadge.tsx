"use client";

import { useLocale } from "@/lib/i18n";

/** Small GDS marker for tour cards. GDS is a tour-program attribute, not a hotel flag. */
export default function GdsBadge({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const label = locale === "az" ? "GDS turu" : locale === "en" ? "GDS tour" : "GDS тур";
  return (
    <span
      className={`inline-flex items-center rounded-full border border-gold/50 bg-dark/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gold backdrop-blur-sm ${className}`}
      title={label}
    >
      GDS
    </span>
  );
}
