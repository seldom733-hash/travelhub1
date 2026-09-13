"use client";

import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import MarketplaceFooter from "@/components/marketplace/MarketplaceFooter";
import HeroSection from "@/components/marketplace/HeroSection";
import SearchBlock from "@/components/marketplace/SearchBlock";
import PopularDestinations from "@/components/marketplace/PopularDestinations";
import LatestOffers from "@/components/marketplace/LatestOffers";
import HotTours from "@/components/marketplace/HotTours";
import SpecialOffers from "@/components/marketplace/SpecialOffers";
import Tours from "@/components/marketplace/Tours";
import Hotels from "@/components/marketplace/Hotels";
import Flights from "@/components/marketplace/Flights";
import Advertisement from "@/components/marketplace/Advertisement";
import { resolveBrandName } from "@/components/marketplace/MarketplaceHeader";
import { useConstructorPublished } from "@/lib/use-constructor-published";

const BLOCK_COMPONENTS: Record<string, React.FC> = {
  "hero": HeroSection,
  "search": SearchBlock,
  "popular-destinations": PopularDestinations,
  "latest-offers": LatestOffers,
  "hot-tours": HotTours,
  "special-offers": SpecialOffers,
  "tours": Tours,
  "hotels": Hotels,
  "flights": Flights,
  "advertisement": Advertisement,
};

/**
 * Configuration-driven Marketplace Renderer.
 *
 * While the published config is loading, render a config-neutral shell —
 * NOT the default layout with hardcoded hero copy. The default layout is
 * reserved for the "no published config at all" state only. Rendering real
 * hero texts before the published config arrives was the server-side source
 * of the legacy-text flash.
 */
export default function MarketplaceRenderer() {
  const { page, loading } = useConstructorPublished("marketplace-home");

  // Loading: neutral shell (dark hero-sized block, no text content).
  if (loading) {
    return (
      <div className="min-h-screen bg-dark">
        <div className="min-h-[540px] bg-dark lg:min-h-[620px]" aria-busy="true" />
      </div>
    );
  }

  // No published config at all → the same hardcoded default layout as before.
  if (!page) {
    return <DefaultMarketplaceLayout />;
  }

  const cfg = {
    headerConfig: page.headerConfig as Record<string, unknown> | null,
    heroConfig: page.heroConfig as Record<string, unknown> | null,
    searchConfig: page.searchConfig as Record<string, unknown> | null,
    footerConfig: page.footerConfig as Record<string, unknown> | null,
  };

  // Single source of truth: brand name from headerConfig (canonical).
  const canonicalBrandName = resolveBrandName(cfg.headerConfig as never);

  // Build ordered block list from published sections
  const enabledSections = page.sections
    .filter((s) => s.enabled && s.blockType !== "footer")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Check if we have a meaningful config
  const hasConfig = enabledSections.length > 0;

  if (!hasConfig) {
    return <DefaultMarketplaceLayout />;
  }

  return (
    <div className="min-h-screen bg-dark">
      <MarketplaceHeader config={cfg.headerConfig as never} />
      <main>
        {enabledSections.map((section) => {
          const Component = BLOCK_COMPONENTS[section.blockType];
          if (!Component) return null;
          if (section.blockType === "hero") {
            return <HeroSection key={section.blockInstanceId} config={cfg.heroConfig as never} />;
          }
          if (section.blockType === "search") {
            return <SearchBlock key={section.blockInstanceId} config={cfg.searchConfig as never} />;
          }
          return <Component key={section.blockInstanceId} />;
        })}
      </main>
      <MarketplaceFooter config={cfg.footerConfig as never} brandName={canonicalBrandName} />
    </div>
  );
}

function DefaultMarketplaceLayout() {
  return (
    <div className="min-h-screen bg-dark">
      <MarketplaceHeader />
      <main>
        <HeroSection />
        <SearchBlock />
        <PopularDestinations />
        <LatestOffers />
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
