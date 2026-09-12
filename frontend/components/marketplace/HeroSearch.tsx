"use client";

import { useState } from "react";
import { t, useLocale } from "@/lib/i18n";
import type { ServiceType, SearchContext } from "@/lib/search-engine";
import { useRouter } from "next/navigation";

// Service-specific search forms
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

interface Tab {
  key: ServiceType;
  labelKey: string;
  priority: "P0" | "P1" | "P2";
}

const TABS: Tab[] = [
  { key: "tours", labelKey: "search.tab_tours", priority: "P0" },
  { key: "hotels", labelKey: "search.tab_hotels", priority: "P0" },
  { key: "flights", labelKey: "search.tab_flights", priority: "P0" },
  { key: "sanatoriums", labelKey: "search.tab_sanatoriums", priority: "P0" },
  { key: "guides", labelKey: "search.tab_guides", priority: "P1" },
  { key: "excursions", labelKey: "search.tab_excursions", priority: "P1" },
  { key: "transfers", labelKey: "search.tab_transfers", priority: "P1" },
  { key: "car-rental", labelKey: "search.tab_car_rental", priority: "P1" },
  { key: "railway", labelKey: "search.tab_railway", priority: "P2" },
  { key: "cruises", labelKey: "search.tab_cruises", priority: "P2" },
];

export default function HeroSearch() {
  const locale = useLocale();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ServiceType>("tours");

  const handleSearch = (ctx: SearchContext) => {
    // Build search params from context and navigate to results
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
    router.push(`/search?${sp.toString()}`);
  };

  const renderForm = () => {
    switch (activeTab) {
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

  return (
    <div className="search-glass rounded-2xl p-3 sm:p-4">
      {/* Service tabs */}
      <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Тип услуги">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
              activeTab === tab.key
                ? "bg-gold text-dark"
                : "text-neutral-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {t(tab.labelKey, locale)}
          </button>
        ))}
      </div>

      {/* Service-specific form */}
      <div role="tabpanel" aria-label={t(`search.tab_${activeTab}`, locale)}>
        {renderForm()}
      </div>
    </div>
  );
}
