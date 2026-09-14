/**
 * Supplier API client — frontend fetch wrapper for supplier search endpoints.
 */

export interface SupplierSearchParams {
  supplier: string;
  country?: string;
  departureCity?: string;
  destination?: string;
  departureDateFrom?: string;
  departureDateTo?: string;
  nightsFrom?: number;
  nightsTo?: number;
  adults?: number;
  children?: number;
  childAges?: number[];
  hotelStars?: number[];
  meal?: string;
  page?: number;
}

export interface SupplierOffer {
  supplierCode: string;
  externalOfferId: string;
  externalClaim?: string;
  tour?: string;
  hotel: string;
  hotelExternalId?: string;
  country?: string;
  destination?: string;
  departureDate: string;
  nights: number;
  room?: string;
  meal?: string;
  adults: number;
  children: number;
  childAges: number[];
  price: {
    amount: number;
    currency: string;
    fetchedAt: string;
    expiresAt: string;
  };
  availability: "AVAILABLE" | "NOT_AVAILABLE" | "UNKNOWN";
  transport?: string;
  fetchedAt: string;
  expiresAt: string;
}

export interface SupplierAdapterInfo {
  code: string;
  name: string;
  enabled: boolean;
}

export interface SupplierMetrics {
  offer: {
    searchTotal: number;
    searchSuccess: number;
    searchError: number;
    searchLatencyMs: number[];
    cacheHit: number;
    cacheMiss: number;
    priceRefresh: number;
    priceChanged: number;
    availabilityChanged: number;
    schemaError: number;
    circuitOpen: number;
  };
  cache: {
    searchSize: number;
    priceSize: number;
    availabilitySize: number;
    detailSize: number;
    hits: number;
    misses: number;
  };
  resilience: Record<string, { state: string; failures: number; inflight: number }>;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message ?? `API error ${res.status}`);
  }
  return res.json();
}

export async function searchSupplierOffers(params: SupplierSearchParams): Promise<SupplierOffer[]> {
  const qs = new URLSearchParams();
  qs.set("supplier", params.supplier);
  if (params.country) qs.set("country", params.country);
  if (params.departureCity) qs.set("departureCity", params.departureCity);
  if (params.destination) qs.set("destination", params.destination);
  if (params.departureDateFrom) qs.set("departureDateFrom", params.departureDateFrom);
  if (params.departureDateTo) qs.set("departureDateTo", params.departureDateTo);
  if (params.nightsFrom) qs.set("nightsFrom", String(params.nightsFrom));
  if (params.nightsTo) qs.set("nightsTo", String(params.nightsTo));
  if (params.adults) qs.set("adults", String(params.adults));
  if (params.children) qs.set("children", String(params.children));
  if (params.childAges?.length) qs.set("childAges", params.childAges.join(","));
  if (params.hotelStars?.length) qs.set("hotelStars", params.hotelStars.join(","));
  if (params.meal) qs.set("meal", params.meal);
  if (params.page) qs.set("page", String(params.page));

  return apiFetch<SupplierOffer[]>(`/supplier/search?${qs.toString()}`);
}

export async function getSupplierOffer(supplierCode: string, offerId: string, claim?: string): Promise<SupplierOffer> {
  const qs = claim ? `?claim=${encodeURIComponent(claim)}` : "";
  return apiFetch<SupplierOffer>(`/supplier/offer/${supplierCode}/${offerId}${qs}`);
}

export async function listSupplierAdapters(): Promise<SupplierAdapterInfo[]> {
  return apiFetch<SupplierAdapterInfo[]>("/supplier/adapters");
}

export async function getSupplierMetrics(): Promise<SupplierMetrics> {
  return apiFetch<SupplierMetrics>("/supplier/metrics");
}

export async function invalidateSupplierCache(supplierCode: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/supplier/cache/invalidate/${supplierCode}`, { method: "POST" });
}
