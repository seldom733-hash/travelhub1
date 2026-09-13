"use client";

import MarketplaceRenderer from "@/components/marketplace/MarketplaceRenderer";
import { useMarketplaceViewed } from "@/lib/behavioral-events";

export default function MarketplacePage() {
  useMarketplaceViewed(true);
  return <MarketplaceRenderer />;
}
