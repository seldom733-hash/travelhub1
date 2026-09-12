"use client";

import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import HeroSection from "@/components/marketplace/HeroSection";
import SearchBlock from "@/components/marketplace/SearchBlock";
import PopularDestinations from "@/components/marketplace/PopularDestinations";
import HotTours from "@/components/marketplace/HotTours";
import SpecialOffers from "@/components/marketplace/SpecialOffers";
import Tours from "@/components/marketplace/Tours";
import Hotels from "@/components/marketplace/Hotels";
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
      </main>

      <footer className="border-t border-dark-border bg-dark py-8">
        <div className="mx-auto max-w-[1400px] px-6 text-center text-sm text-neutral-500">
          © {new Date().getFullYear()} TravelHub
        </div>
      </footer>
    </div>
  );
}
