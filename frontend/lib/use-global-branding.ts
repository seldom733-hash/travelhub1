"use client";

import { useState, useEffect, useRef } from "react";
import { resolveBrandName, type MarketplaceHeaderConfig } from "@/components/marketplace/MarketplaceHeader";
import { constructorApi } from "./constructor-api";

/**
 * Global Branding — single source of truth for platform brand name and logo.
 *
 * Fetches the published constructor config for "marketplace-home" and extracts
 * the canonical brandName and logo from headerConfig. All internal layouts
 * (Shell, partner, buyer account, breadcrumbs) should use this hook instead
 * of hardcoding "TravelHub".
 *
 * Uses a module-level cache so multiple hook instances share one fetch.
 */

interface BrandingData {
  brandName: string;
  logo: MarketplaceHeaderConfig["logo"];
}

let cached: BrandingData | null = null;
let inflight: Promise<BrandingData> | null = null;

async function fetchBranding(): Promise<BrandingData> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const page = await constructorApi.getPublished("marketplace-home");
      const headerCfg = (page?.headerConfig ?? null) as MarketplaceHeaderConfig | null;
      const brandName = resolveBrandName(headerCfg);
      const logo = headerCfg?.logo ?? null;
      cached = { brandName, logo };
    } catch {
      // Fallback — no published config yet
      cached = { brandName: "TravelHub", logo: null };
    }
    inflight = null;
    return cached!;
  })();

  return inflight;
}

/**
 * React hook: returns `{ brandName, logo, loading }`.
 * On first render, fetches the published header config (once per page load).
 * Subsequent instances return the cached result immediately.
 */
export function useGlobalBranding(): BrandingData & { loading: boolean } {
  const [data, setData] = useState<BrandingData>(() => cached ?? { brandName: "TravelHub", logo: null });
  const [loading, setLoading] = useState(!cached);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    fetchBranding().then((result) => {
      if (!cancelled && mountedRef.current) {
        setData(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; mountedRef.current = false; };
  }, []);

  return { ...data, loading };
}

/**
 * Non-hook async getter — for use outside React components (e.g., server-side helpers).
 * Returns cached branding data, fetching if needed.
 */
export async function getGlobalBranding(): Promise<BrandingData> {
  return fetchBranding();
}
