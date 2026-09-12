"use client";

import { useLocale } from "@/lib/i18n";
import MarketplaceHeader from "./MarketplaceHeader";
import MarketplaceFooter from "./MarketplaceFooter";
import HeroSection from "./HeroSection";
import SearchBlock from "./SearchBlock";
import PopularDestinations from "./PopularDestinations";
import HotTours from "./HotTours";
import SpecialOffers from "./SpecialOffers";
import Tours from "./Tours";
import Hotels from "./Hotels";
import Flights from "./Flights";
import Advertisement from "./Advertisement";
import { useConstructorPublished } from "@/lib/use-constructor-published";

/**
 * Configuration-driven Marketplace Renderer.
 *
 * When published config exists → renders from configuration.
 * When no published config → falls back to hardcoded default layout.
 *
 * This preserves backward compatibility while enabling constructor-driven rendering.
 */
export default function MarketplaceRenderer() {
  const locale = useLocale();
  const { page, loading } = useConstructorPublished("marketplace-home");

  // Show default layout while loading or if no published config
  if (loading || !page) {
    return <DefaultMarketplaceLayout />;
  }

  // Build ordered block list from published sections
  const enabledSections = page.sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Check if we have a meaningful config (at least one section or page-level config)
  const hasConfig = enabledSections.length > 0 || page.headerConfig || page.heroConfig || page.searchConfig || page.footerConfig;

  if (!hasConfig) {
    return <DefaultMarketplaceLayout />;
  }

  return (
    <div className="min-h-screen bg-dark">
      <MarketplaceHeader />
      <main>
        {enabledSections.map((section) => (
          <MarketplaceBlock key={section.blockInstanceId} section={section} />
        ))}
      </main>
      <MarketplaceFooter />
    </div>
  );
}

function MarketplaceBlock({ section }: { section: { blockType: string; settings: Record<string, unknown> } }) {
  switch (section.blockType) {
    case "hero":
      return <HeroSection />;
    case "search":
      return <SearchBlock />;
    case "popular-destinations":
      return <PopularDestinations />;
    case "hot-tours":
      return <HotTours />;
    case "special-offers":
      return <SpecialOffers />;
    case "tours":
      return <Tours />;
    case "hotels":
      return <Hotels />;
    case "flights":
      return <Flights />;
    case "advertisement":
      return <Advertisement />;
    default:
      return null;
  }
}

function DefaultMarketplaceLayout() {
  return (
    <div className="min-h-screen bg-dark">
      <MarketplaceHeader />
      <main>
        <HeroSection />
        <SearchBlock />
        <PopularDestinations />
        <HotTours />
        <SpecialOffers />
        <Tours />
        <Hotels />
        <Flights />
        <Advertisement />
      </main>
      <MarketplaceFooter />
    </div>
  );
}
