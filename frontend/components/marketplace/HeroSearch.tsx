"use client";

import { useEffect, useRef, useState } from "react";
import { t, useLocale } from "@/lib/i18n";
import type { ServiceType, SearchContext } from "@/lib/search-engine";
import { SEARCH_SERVICES } from "@/lib/search-services";
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

/**
 * Вкладки услуг берутся из единого списка (lib/search-services.ts) — того же,
 * по которому строится конфиг включения услуг в workspace, чтобы списки не
 * расходились.
 */
const TABS: Tab[] = SEARCH_SERVICES.map(({ id, labelKey, priority }) => ({
  key: id,
  labelKey,
  priority,
}));

interface HeroSearchProps {
  /** Enabled service ids in display order (from published searchConfig). Undefined → all tabs, default order. */
  enabledServices?: string[];
  /** Initially selected service tab (from published searchConfig). */
  defaultService?: string;
  /**
   * Пользователь переключил вкладку услуги (не вызывается при монтировании).
   * Нужен странице результатов: URL при переключении вкладки не меняется, и
   * результаты предыдущей услуги не должны выглядеть как результаты текущей
   * вкладки, пока не нажата кнопка поиска.
   */
  onTabChange?: (service: string) => void;
}

export default function HeroSearch({ enabledServices, defaultService, onTabChange }: HeroSearchProps = {}) {
  const locale = useLocale();
  const router = useRouter();

  const visibleTabs = enabledServices?.length
    ? TABS.filter((tab) => enabledServices.includes(tab.key))
    : TABS;
  const orderedTabs = enabledServices?.length
    ? enabledServices
        .map((id) => visibleTabs.find((tab) => tab.key === id))
        .filter((tab): tab is Tab => Boolean(tab))
    : TABS;
  const initialTab =
    defaultService && orderedTabs.some((tab) => tab.key === defaultService)
      ? (defaultService as ServiceType)
      : orderedTabs[0]?.key ?? "tours";

  const [activeTab, setActiveTab] = useState<ServiceType>(initialTab);
  // Вкладки и услуга по умолчанию приходят из конфига асинхронно (страница
  // результатов грузит searchConfig после монтирования). Пока пользователь сам
  // не переключил вкладку, следуем за конфигом; после ручного выбора — нет.
  const tabPickedByUser = useRef(false);
  useEffect(() => {
    if (!tabPickedByUser.current) setActiveTab(initialTab);
  }, [initialTab]);
  // «Сбросить все» → the form resets every picker (tours and hotels are the
  // services whose forms keep a restorable draft).
  const [resetSignal, setResetSignal] = useState(0);

  const handleSearch = (ctx: SearchContext) => {
    // Build search params from context and navigate to results
    const sp = new URLSearchParams();
    sp.set("service", ctx.serviceType);
    if (ctx.fromDestination) sp.set("from", ctx.fromDestination);
    if (ctx.toDestination) sp.set("to", ctx.toDestination);
    if (ctx.toGeoCountry) sp.set("geoCountry", ctx.toGeoCountry);
    if (ctx.toGeoCity) sp.set("geoCity", ctx.toGeoCity);
    if (ctx.toGeoResort) sp.set("geoResort", ctx.toGeoResort);
    if (ctx.cityName) sp.set("city", ctx.cityName);
    if (ctx.hotelId) sp.set("hotelId", ctx.hotelId);
    // Hotel NAME is what the supplier search filters on (per-supplier ids
    // are resolved by the aggregator from this name).
    if (ctx.hotelName) sp.set("hotel", ctx.hotelName);
    if (ctx.startDate) sp.set("start", ctx.startDate);
    if (ctx.departureDate) sp.set("departureDate", ctx.departureDate);
    if (ctx.returnDate) sp.set("return", ctx.returnDate);
    if (ctx.nights) sp.set("nights", String(ctx.nights));
    // Night range «от–до» (nights alone is the legacy single-value param).
    if (ctx.nightsFrom) sp.set("nightsFrom", String(ctx.nightsFrom));
    if (ctx.nightsTo) sp.set("nightsTo", String(ctx.nightsTo));
    // Departure range upper bound + hotel star categories (universal search).
    if (ctx.endDate) sp.set("end", ctx.endDate);
    if (ctx.hotelStars?.length) sp.set("hotelStars", ctx.hotelStars.join(","));
    if (ctx.suppliers?.length) sp.set("suppliers", ctx.suppliers.join(","));
    if (ctx.duration) sp.set("duration", String(ctx.duration));
    if (ctx.adults) sp.set("adults", String(ctx.adults));
    if (ctx.children) sp.set("children", String(ctx.children));
    if (ctx.childAges?.length) sp.set("childAges", ctx.childAges.join(","));
    if (ctx.infants) sp.set("infants", String(ctx.infants));
    if (ctx.serviceClass) sp.set("class", ctx.serviceClass);
    if ((ctx as any).tariff && (ctx as any).tariff !== "ALL") sp.set("tariff", (ctx as any).tariff);
    if (ctx.supplier && ctx.supplier !== "ALL") sp.set("supplier", ctx.supplier);
    if (ctx.roundTrip) sp.set("roundTrip", "1");
    if (ctx.direct) sp.set("direct", "1");
    if (ctx.language) sp.set("lang", ctx.language);
    // Tours → universal live search across Summer + KOMPAS (§1) and hotels →
    // supplier live search (ANEX hotels): results come from supplier live
    // availability, not the static catalog.
    if (ctx.serviceType === "tours" || ctx.serviceType === "hotels") {
      sp.set("live", "1");
    }
    const nextUrl = `/search?${sp.toString()}`;
    if (typeof window !== "undefined" && nextUrl === `${window.location.pathname}${window.location.search}`) {
      sp.set("_t", String(Date.now()));
    }
    router.push(`/search?${sp.toString()}`);
  };

  const renderForm = () => {
    switch (activeTab) {
      case "tours": return <TourSearch onSearch={handleSearch} resetSignal={resetSignal} />;
      case "hotels": return <HotelSearch onSearch={handleSearch} resetSignal={resetSignal} />;
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
      {/* Service tabs + «Сбросить все» (right, same row as the services) */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Тип услуги">
          {orderedTabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => {
                tabPickedByUser.current = true;
                setActiveTab(tab.key);
                onTabChange?.(tab.key);
              }}
              className={`rounded-lg px-3 py-1.5 text-[14px] font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-gold text-dark"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {t(tab.labelKey, locale)}
            </button>
          ))}
        </div>
        {(activeTab === "tours" || activeTab === "hotels") && (
          <button
            type="button"
            onClick={() => setResetSignal((n) => n + 1)}
            className="rounded-lg px-3 py-1.5 text-[14px] font-medium text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            {t("search.reset_all", locale)}
          </button>
        )}
      </div>

      {/* Service-specific form */}
      <div role="tabpanel" aria-label={t(`search.tab_${activeTab}`, locale)}>
        {renderForm()}
      </div>
    </div>
  );
}
