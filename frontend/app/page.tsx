"use client";

import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import HeroSection from "@/components/marketplace/HeroSection";
import SearchBlock from "@/components/marketplace/SearchBlock";
import PopularDestinations from "@/components/marketplace/PopularDestinations";
import HotTours from "@/components/marketplace/HotTours";
import SpecialOffers from "@/components/marketplace/SpecialOffers";
import Tours from "@/components/marketplace/Tours";
import Hotels from "@/components/marketplace/Hotels";
import Flights from "@/components/marketplace/Flights";
import Advertisement from "@/components/marketplace/Advertisement";
import MarketplaceFooter from "@/components/marketplace/MarketplaceFooter";
import { useMarketplaceViewed } from "@/lib/behavioral-events";

export default function MarketplacePage() {
  useMarketplaceViewed(true);

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
