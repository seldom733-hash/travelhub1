"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MapPin, MagnifyingGlass, CalendarBlank, ArrowRight } from "@phosphor-icons/react";
import { t, useLocale } from "@/lib/i18n";

export default function GlobalSearch() {
  const router = useRouter();
  const locale = useLocale();
  const [destination, setDestination] = useState("");
  const [what, setWhat] = useState("");
  const [dates, setDates] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (destination.trim()) sp.set("q", destination.trim());
    if (what.trim()) sp.set("what", what.trim());
    if (dates) sp.set("dates", dates);
    const qs = sp.toString();
    router.push(`/search${qs ? `?${qs}` : ""}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="search-glass rounded-2xl p-2.5 sm:p-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        {/* Destination */}
        <div className="relative flex-1">
          <label htmlFor="hero-destination" className="mb-1 block text-xs font-medium text-neutral-400">
            {t("marketplace.search_destination_label", locale)}
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
              <MapPin size={18} weight="light" />
            </div>
            <input
              id="hero-destination"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder={t("marketplace.search_destination_placeholder", locale)}
              className="w-full rounded-xl border border-dark-border bg-dark-card py-3 pl-10 pr-4 text-sm text-white placeholder-neutral-500 outline-none transition-colors focus:border-gold/50"
            />
          </div>
        </div>

        {/* What */}
        <div className="relative flex-1">
          <label htmlFor="hero-what" className="mb-1 block text-xs font-medium text-neutral-400">
            {t("marketplace.search_what_label", locale)}
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
              <MagnifyingGlass size={18} weight="light" />
            </div>
            <input
              id="hero-what"
              type="text"
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder={t("marketplace.search_what_placeholder", locale)}
              className="w-full rounded-xl border border-dark-border bg-dark-card py-3 pl-10 pr-4 text-sm text-white placeholder-neutral-500 outline-none transition-colors focus:border-gold/50"
            />
          </div>
        </div>

        {/* Dates */}
        <div className="relative flex-1">
          <label htmlFor="hero-dates" className="mb-1 block text-xs font-medium text-neutral-400">
            {t("marketplace.search_dates_label", locale)}
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
              <CalendarBlank size={18} weight="light" />
            </div>
            <input
              id="hero-dates"
              type="text"
              value={dates}
              onChange={(e) => setDates(e.target.value)}
              placeholder={t("marketplace.search_dates_placeholder", locale)}
              className="w-full rounded-xl border border-dark-border bg-dark-card py-3 pl-10 pr-4 text-sm text-white placeholder-neutral-500 outline-none transition-colors focus:border-gold/50"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-end">
          <button
            type="submit"
            className="btn-gold flex w-full items-center justify-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold sm:w-auto"
          >
            <span>{t("marketplace.search_submit", locale)}</span>
            <ArrowRight size={18} weight="bold" />
          </button>
        </div>
      </div>
    </form>
  );
}
