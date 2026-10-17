"use client";

import { useState } from "react";
import { PaperPlaneRight } from "@phosphor-icons/react";
import type { SearchContext } from "@/lib/search-engine";
import { t, useLocale } from "@/lib/i18n";

interface HelpFindButtonProps {
  context: SearchContext;
  disabled?: boolean;
}

export default function HelpFindButton({ context, disabled = false }: HelpFindButtonProps) {
  const locale = useLocale();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading || submitted) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/public/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: context.serviceType,
          destinationId: context.toDestination || context.cityId,
          hotelId: context.hotelId,
          startDate: context.startDate || context.departureDate,
          nights: context.nights,
          adults: context.adults,
          children: context.children,
          childAges: context.childAges,
          params: context,
        }),
      });
      if (res.ok) setSubmitted(true);
    } catch {
      // silently fail for now
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-center">
        <p className="text-sm text-gold">{t("search.help_sent", locale)}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2.5 text-[15px] font-medium text-gold transition-all hover:bg-gold/20 disabled:opacity-50"
    >
      <PaperPlaneRight size={16} weight="light" />
      <span>{loading ? t("search.help_sending", locale) : t("search.help_find", locale)}</span>
    </button>
  );
}
