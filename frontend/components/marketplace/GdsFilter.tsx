"use client";

import { useLocale } from "@/lib/i18n";

const LABELS = {
  ru: "Без GDS",
  az: "GDS olmadan",
  en: "Without GDS",
} as const;

/** Toggle that excludes GDS-marked tours/hotels from a listing. */
export default function GdsFilter({
  checked,
  onChange,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  const locale = useLocale();
  const label = LABELS[locale as keyof typeof LABELS] ?? LABELS.ru;
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        checked
          ? "border-gold/60 bg-gold/15 text-gold"
          : "border-white/15 bg-white/5 text-neutral-300 hover:border-white/25 hover:text-white"
      } ${className}`}
    >
      <span
        className={`inline-block size-2 rounded-full ${checked ? "bg-gold" : "bg-neutral-500"}`}
        aria-hidden
      />
      {label}
    </button>
  );
}
