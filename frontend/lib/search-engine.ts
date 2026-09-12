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
  // Flights
  departureDate?: string;
  returnDate?: string;
  roundTrip?: boolean;
  infants?: number;
  serviceClass?: string;
  baggage?: boolean;
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
        const params = new URLSearchParams({ q, limit: "5" });
        if (type && type !== "all") params.set("type", type);
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
