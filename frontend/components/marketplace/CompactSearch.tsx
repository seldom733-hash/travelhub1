"use client";

import { useState } from "react";
import { t, useLocale, type Locale } from "@/lib/i18n";
import type { ServiceType, SearchContext } from "@/lib/search-engine";
import { useRouter } from "next/navigation";
import { CaretDown, X } from "@phosphor-icons/react";

import TourSearch from "./search/TourSearch";
import HotelSearch from "./search/HotelSearch";
import FlightSearch from "./search/FlightSearch";
import SanatoriumSearch from "./search/SanatoriumSearch";
import GuideSearch from "./search/GuideSearch";
import ExcursionSearch from "./search/ExcursionSearch";
import TransferSearch from "./search/TransferSearch";
import CarRentalSearch from "./search/CarRentalSearch";
import RailwaySearch from "./search/RailwaySearch";
import CruiseSearch from "./search/CruiseSearch";

interface CompactSearchProps {
  service: ServiceType;
  params: Record<string, string>;
}

function buildSummary(service: ServiceType, params: Record<string, string>, locale: Locale): string {
  const serviceLabel = t(`search.service_${service}`, locale);
  const from = params.from || params.city || "";
  const to = params.to || params.hotel || "";
  const date = params.start || params.checkIn || params.departure || "";
  const guests = [params.adults, params.children].filter(Boolean).join("+");

  const parts: string[] = [serviceLabel];
  if (from && to) parts.push(`${from} → ${to}`);
  else if (from) parts.push(from);
  else if (to) parts.push(to);
  if (date) parts.push(date);
  if (guests) parts.push(guests);

  return parts.join(" · ");
}

export default function CompactSearch({ service, params }: CompactSearchProps) {
  const locale = useLocale();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = (ctx: SearchContext) => {
    const sp = new URLSearchParams();
    sp.set("service", ctx.serviceType);
    if (ctx.fromDestination) sp.set("from", ctx.fromDestination);
    if (ctx.toDestination) sp.set("to", ctx.toDestination);
    if (ctx.cityName) sp.set("city", ctx.cityName);
    if (ctx.hotelId) sp.set("hotelId", ctx.hotelId);
    if (ctx.startDate) sp.set("start", ctx.startDate);
    if (ctx.returnDate) sp.set("return", ctx.returnDate);
    if (ctx.nights) sp.set("nights", String(ctx.nights));
    if (ctx.duration) sp.set("duration", String(ctx.duration));
    if (ctx.adults) sp.set("adults", String(ctx.adults));
    if (ctx.children) sp.set("children", String(ctx.children));
    if (ctx.childAges?.length) sp.set("childAges", ctx.childAges.join(","));
    if (ctx.infants) sp.set("infants", String(ctx.infants));
    if (ctx.serviceClass) sp.set("class", ctx.serviceClass);
    if (ctx.baggage) sp.set("baggage", "1");
    if (ctx.roundTrip) sp.set("roundTrip", "1");
    if (ctx.language) sp.set("lang", ctx.language);
    setIsOpen(false);
    router.push(`/search?${sp.toString()}`);
  };

  const renderForm = () => {
    switch (service) {
      case "tours": return <TourSearch onSearch={handleSearch} />;
      case "hotels": return <HotelSearch onSearch={handleSearch} />;
      case "flights": return <FlightSearch onSearch={handleSearch} />;
      case "sanatoriums": return <SanatoriumSearch onSearch={handleSearch} />;
      case "guides": return <GuideSearch onSearch={handleSearch} />;
      case "excursions": return <ExcursionSearch onSearch={handleSearch} />;
      case "transfers": return <TransferSearch onSearch={handleSearch} />;
      case "car-rental": return <CarRentalSearch onSearch={handleSearch} />;
      case "railway": return <RailwaySearch onSearch={handleSearch} />;
      case "cruises": return <CruiseSearch onSearch={handleSearch} />;
      default: return <TourSearch onSearch={handleSearch} />;
    }
  };

  const summary = buildSummary(service, params, locale);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5">
      {/* Collapsed summary bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-neutral-300 transition-colors hover:bg-white/5"
        aria-expanded={isOpen}
        aria-controls="compact-search-form"
      >
        <span className="truncate font-medium">{summary}</span>
        {isOpen ? (
          <X size={16} weight="light" className="ml-2 shrink-0 text-neutral-500" />
        ) : (
          <CaretDown size={16} weight="light" className={`ml-2 shrink-0 text-neutral-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        )}
      </button>

      {/* Expanded compact form */}
      {isOpen && (
        <div id="compact-search-form" className="border-t border-white/10 px-4 pb-4 pt-3">
          {renderForm()}
        </div>
      )}
    </div>
  );
}
