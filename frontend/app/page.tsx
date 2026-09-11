"use client";

import MarketplaceHeader from "@/components/marketplace/MarketplaceHeader";
import HeroSection from "@/components/marketplace/HeroSection";
import PopularDestinations from "@/components/marketplace/PopularDestinations";
import { useMarketplaceViewed } from "@/lib/behavioral-events";

export default function MarketplacePage() {
  useMarketplaceViewed(true);

  return (
    <div className="min-h-screen bg-dark">
      <MarketplaceHeader />
      <main>
        <HeroSection />
        <PopularDestinations />
      </main>

      <footer className="border-t border-dark-border bg-dark py-8">
        <div className="mx-auto max-w-[1400px] px-6 text-center text-sm text-neutral-500">
          © {new Date().getFullYear()} TravelHub
        </div>
      </footer>
    </div>
  );
}
