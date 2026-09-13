"use client";

import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import MarketplaceFooter from "@/components/marketplace/MarketplaceFooter";
import HeroSection from "@/components/marketplace/HeroSection";
import SearchBlock from "@/components/marketplace/SearchBlock";
import PopularDestinations from "@/components/marketplace/PopularDestinations";
import HotTours from "@/components/marketplace/HotTours";
import SpecialOffers from "@/components/marketplace/SpecialOffers";
import Tours from "@/components/marketplace/Tours";
import Hotels from "@/components/marketplace/Hotels";
import Flights from "@/components/marketplace/Flights";
import Advertisement from "@/components/marketplace/Advertisement";
import { useConstructorPublished } from "@/lib/use-constructor-published";

const BLOCK_COMPONENTS: Record<string, React.FC> = {
  "hero": HeroSection,
  "search": SearchBlock,
  "popular-destinations": PopularDestinations,
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
 * Page-level configs (header/hero/search/footer) come from the published
 * Constructor configuration; sections define the block order/visibility.
 * Missing config → the same hardcoded default layout as before.
 */
export default function MarketplaceRenderer() {
  const { page, loading } = useConstructorPublished("marketplace-home");

  // Show default layout while loading or if no published config
  if (loading || !page) {
    return <DefaultMarketplaceLayout />;
  }

  const cfg = {
    headerConfig: page.headerConfig as Record<string, unknown> | null,
    heroConfig: page.heroConfig as Record<string, unknown> | null,
    searchConfig: page.searchConfig as Record<string, unknown> | null,
    footerConfig: page.footerConfig as Record<string, unknown> | null,
  };

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
      <MarketplaceFooter config={cfg.footerConfig as never} />
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
