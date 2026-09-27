"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Service types for Hero Search tabs
export type ServiceType =
  | "tours"
  | "hotels"
  | "flights"
  | "sanatoriums"
  | "guides"
  | "excursions"
  | "transfers"
  | "car-rental"
  | "railway"
  | "cruises";

// Suggest result from backend
export interface SuggestResult {
  type: "destination" | "hotel" | "tour" | "service";
  id: string;
  name: string;
  subtitle?: string;
  imageUrl?: string;
  href: string;
}

export interface SuggestResponse {
  query: string;
  results: SuggestResult[];
  total: number;
}

// Search context for Hero Search forms
export interface SearchContext {
  serviceType: ServiceType;
  // Tours
  fromDestination?: string;
  toDestination?: string;
  startDate?: string;
  nights?: number;
  adults?: number;
  children?: number;
  childAges?: number[];
  hotelId?: string;
  hotelName?: string;
  // Hotels
  cityId?: string;
  cityName?: string;
  // Tours direction as Master Geography codes (most specific wins)
  toGeoCountry?: string;
  toGeoCity?: string;
  toGeoResort?: string;
  // Flights
  departureDate?: string;
  returnDate?: string;
  roundTrip?: boolean;
  infants?: number;
  serviceClass?: string;
  tariff?: string;
  // Sanatoriums
  duration?: number;
  // Guides
  language?: string;
  // Generic
  query?: string;
}

// API functions
export async function fetchSuggestions(
  q: string,
  type?: string,
  limit = 5,
): Promise<SuggestResponse> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  if (type && type !== "all") params.set("type", type);
  const res = await fetch(`/api/v1/public/suggest?${params}`);
  if (!res.ok) throw new Error("Suggest failed");
  return res.json();
}

// ── Geography-backed suggestions (Master Geography + availability) ─────
// filterType "geo:<service>" (e.g. "geo:tours", "geo:hotels") resolves the
// destination input against GET /api/v1/geo/availability?service= — only
// geography WITH actual inventory is suggested (prompt §10, §24).
// Transitional fallback: while no products are geo-linked the availability
// is empty, so we fall back to the legacy product suggest to keep search
// usable. As soon as the first product is linked, the strict geo filter
// takes over automatically.

interface GeoAvailabilityEntry {
  id: string;
  code: string;
  names: { ru?: string; en?: string; az?: string } | null;
  parentId: string | null;
  productCount: number;
}

interface GeoAvailability {
  service: string;
  countries: GeoAvailabilityEntry[];
  cities: GeoAvailabilityEntry[];
  resorts: GeoAvailabilityEntry[];
  airports: GeoAvailabilityEntry[];
}

const geoAvailabilityCache = new Map<string, Promise<GeoAvailability | null>>();

function fetchGeoAvailability(service: string): Promise<GeoAvailability | null> {
  const cached = geoAvailabilityCache.get(service);
  if (cached) return cached;
  const pending = (async (): Promise<GeoAvailability | null> => {
    const res = await fetch(
      `/api/v1/geo/availability?service=${encodeURIComponent(service)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as GeoAvailability;
    if (
      !json ||
      (json.countries.length === 0 &&
        json.cities.length === 0 &&
        json.resorts.length === 0)
    ) {
      return null;
    }
    return json;
  })();
  geoAvailabilityCache.set(service, pending);
  pending.catch(() => {
    geoAvailabilityCache.delete(service);
  });
  return pending;
}

function geoNames(entry: GeoAvailabilityEntry): {
  ru: string;
  en: string;
  az: string;
} {
  return {
    ru: entry.names?.ru || entry.names?.en || entry.code,
    en: entry.names?.en || entry.names?.ru || entry.code,
    az: entry.names?.az || entry.names?.en || entry.code,
  };
}

export function searchGeoAvailability(
  data: GeoAvailability,
  q: string,
  limit = 8,
): SuggestResult[] {
  const query = q.trim().toLowerCase();
  if (query.length < 2) return [];
  const countryCodeById = new Map(
    data.countries.map((c) => [c.id, c.code] as const),
  );
  const cityCodeById = new Map(
    data.cities.map((c) => [c.id, c.code] as const),
  );
  const pool: { entry: GeoAvailabilityEntry; kind: string }[] = [
    ...data.countries.map((entry) => ({ entry, kind: "country" as const })),
    ...data.cities.map((entry) => ({ entry, kind: "city" as const })),
    ...data.resorts.map((entry) => ({ entry, kind: "resort" as const })),
  ];
  const out: SuggestResult[] = [];
  for (const { entry, kind } of pool) {
    const names = geoNames(entry);
    const haystack =
      `${entry.code} ${names.ru} ${names.en} ${names.az}`.toLowerCase();
    if (!haystack.includes(query)) continue;
    const parentCode =
      kind === "city"
        ? countryCodeById.get(entry.parentId ?? "")
        : kind === "resort"
          ? cityCodeById.get(entry.parentId ?? "")
          : undefined;
    out.push({
      type: "destination",
      id: entry.code,
      name: names.ru,
      subtitle: parentCode ? `${entry.code} · ${parentCode}` : entry.code,
      href: "",
    });
    if (out.length >= limit) break;
  }
  return out;
}

// Debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Live search hook
export function useLiveSearch(
  query: string,
  type?: string,
  delay = 300,
) {
  const [results, setResults] = useState<SuggestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const debouncedQuery = useDebounce(query, delay);

  const search = useCallback(
    async (q: string) => {
      if (!q || q.trim().length < 2) {
        setResults([]);
        setLoading(false);
        setError(null);
        return;
      }

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        // Geography mode: availability-filtered master directory first,
        // legacy product suggest as transitional fallback.
        if (type && type.startsWith("geo:")) {
          const service = type.slice("geo:".length);
          const geo = await fetchGeoAvailability(service).catch(() => null);
          if (geo) {
            if (controller.signal.aborted) return;
            setResults(searchGeoAvailability(geo, q));
            return;
          }
        }
        const params = new URLSearchParams({ q, limit: "5" });
        // Geo-mode fallback preserves the legacy destination bucket.
        const legacyType = type && type.startsWith("geo:") ? "destination" : type;
        if (legacyType && legacyType !== "all") params.set("type", legacyType);
        const res = await fetch(`/api/v1/public/suggest?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Suggest failed");
        const data: SuggestResponse = await res.json();
        setResults(data.results);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
      }
    },
    [type],
  );

  useEffect(() => {
    search(debouncedQuery);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedQuery, search]);

  return { results, loading, error };
}
