/**
 * Supplier API client — public (anonymous) access to KOMPAS/Summertour search.
 *
 * Uses /api/v1/public/supplier/* endpoints (no auth required).
 * Mirrors backend SupplierSearchQuery and SupplierOffer contracts.
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface SupplierSearchQuery {
  supplierCode: string;
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
  hotelExternalId?: string;
  hotel?: string;
  hotelStars?: number[];
  room?: string;
  meal?: string;
  priceMin?: number;
  priceMax?: number;
  transport?: string;
  tourIncValue?: string;
  tourIncName?: string;
  tourIncValues?: string[];
  page?: number;
}

export interface SupplierPriceSnapshot {
  amount: number;
  currency: string;
  fetchedAt: string;
  expiresAt: string;
  source: string;
}

export type SupplierAvailability = "AVAILABLE" | "NOT_AVAILABLE" | "UNKNOWN";

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
  price: SupplierPriceSnapshot;
  availability: SupplierAvailability;
  transport?: string;
  fetchedAt: string;
  expiresAt: string;
  rawMetadata?: Record<string, unknown>;
}

export interface SupplierPriceCalendarQuery {
  supplierCode: string;
  hotelExternalId?: string;
  hotel?: string;
  destination?: string;
  dateFrom: string;
  dateTo: string;
  nights?: number;
  nightsFrom?: number;
  nightsTo?: number;
  adults?: number;
  children?: number;
  childAges?: number[];
  tourIncValues?: string[];
}

export interface SupplierPriceCalendarEntry {
  date: string;
  price: number | null;
  currency: string | null;
  availability: SupplierAvailability;
  offers: SupplierOffer[];
  absenceCode?: string;
  absenceText?: string;
}

export interface SupplierPriceCalendarResult {
  entries: SupplierPriceCalendarEntry[];
  dateFrom: string;
  dateTo: string;
  fetchedAt: string;
  expiresAt: string;
}

// ── API Client ───────────────────────────────────────────────────────────

const BASE = "/api/v1/public/supplier";

async function get<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const url = `${BASE}${path}?${searchParams.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supplier API ${res.status}: ${text}`);
  }
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supplier API ${res.status}: ${text}`);
  }
  return res.json();
}

/** Search supplier offers (anonymous). */
export async function searchSupplierOffers(
  query: SupplierSearchQuery,
): Promise<SupplierOffer[]> {
  return get<SupplierOffer[]>("/search", {
    supplier: query.supplierCode,
    country: query.country,
    departureCity: query.departureCity,
    destination: query.destination,
    departureDateFrom: query.departureDateFrom,
    departureDateTo: query.departureDateTo,
    nightsFrom: query.nightsFrom,
    nightsTo: query.nightsTo,
    adults: query.adults,
    children: query.children,
    childAges: query.childAges?.join(","),
    hotelStars: query.hotelStars?.join(","),
    meal: query.meal,
    page: query.page,
  });
}

/** Get price calendar (anonymous). */
export async function getPriceCalendar(
  query: SupplierPriceCalendarQuery,
): Promise<SupplierPriceCalendarResult> {
  return post<SupplierPriceCalendarResult>("/price-calendar", query);
}

/** Refresh price for re-check (anonymous). */
export async function refreshSupplierPrice(
  supplierCode: string,
  offerId: string,
  claim: string | undefined,
  searchContext: SupplierSearchQuery,
): Promise<SupplierPriceSnapshot> {
  return post<SupplierPriceSnapshot>("/refresh-price", {
    supplierCode,
    offerId,
    claim,
    searchContext,
  });
}

/** Refresh availability for re-check (anonymous). */
export async function refreshSupplierAvailability(
  supplierCode: string,
  offerId: string,
  claim: string | undefined,
  searchContext: SupplierSearchQuery,
): Promise<{ availability: SupplierAvailability; fetchedAt: string; expiresAt: string }> {
  return post("/refresh-availability", {
    supplierCode,
    offerId,
    claim,
    searchContext,
  });
}
