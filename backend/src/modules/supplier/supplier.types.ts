/**
 * Supplier abstraction types — canonical domain model for supplier integrations.
 *
 * Mode A: Dynamic Supplier Inventory (no Product import per search).
 * Pricing ≠ Availability ≠ Quote: supplier price is external snapshot, not TravelHub pricing authority.
 */

// ── Supplier Search Query ────────────────────────────────────────────────

export interface SupplierSearchQuery {
  /** Country code or name (supplier-neutral). */
  country?: string;
  /** Departure city/location. */
  departureCity?: string;
  /** Destination/resort. */
  destination?: string;
  /** Departure date range (inclusive). */
  departureDateFrom?: string;
  departureDateTo?: string;
  /** Night range. */
  nightsFrom?: number;
  nightsTo?: number;
  /** Passenger composition. */
  adults: number;
  children?: number;
  childAges?: number[];
  /** Hotel filter. */
  hotel?: string;
  hotelStars?: number[];
  /** Room type. */
  room?: string;
  /** Meal plan. */
  meal?: string;
  /** Price bounds (in supplier currency). */
  priceMin?: number;
  priceMax?: number;
  /** Transport/flight. */
  transport?: string;
  /** Instant confirmation only. */
  instantConfirmOnly?: boolean;
  /** Page number (1-based). */
  page?: number;
  /** Max results per page. */
  pageSize?: number;
}

// ── Supplier Offer ───────────────────────────────────────────────────────

export type SupplierAvailability = "AVAILABLE" | "NOT_AVAILABLE" | "UNKNOWN";

export interface SupplierOffer {
  /** Supplier code (e.g., "SUMMERTOUR"). */
  supplierCode: string;
  /** External offer ID (composite, supplier-specific). */
  externalOfferId: string;
  /** External claim/reference (supplier-specific, for re-check). */
  externalClaim?: string;
  /** Tour/program name. */
  tour?: string;
  /** Hotel name. */
  hotel: string;
  /** Hotel external ID. */
  hotelExternalId?: string;
  /** Country. */
  country?: string;
  /** Destination/resort. */
  destination?: string;
  /** Departure date (ISO-8601). */
  departureDate: string;
  /** Number of nights. */
  nights: number;
  /** Room type. */
  room?: string;
  /** Meal plan. */
  meal?: string;
  /** Passenger composition. */
  adults: number;
  children: number;
  childAges: number[];
  /** Price snapshot. */
  price: SupplierPriceSnapshot;
  /** Availability state. */
  availability: SupplierAvailability;
  /** Transport/airline info. */
  transport?: string;
  /** When this offer was fetched. */
  fetchedAt: Date;
  /** When this offer expires (TTL-based). */
  expiresAt: Date;
  /** Raw supplier metadata (for diagnostics/re-check). */
  rawMetadata?: Record<string, unknown>;
}

// ── Price Snapshot ───────────────────────────────────────────────────────

export interface SupplierPriceSnapshot {
  /** Raw amount from supplier. */
  amount: number;
  /** Currency code (e.g., "USD"). */
  currency: string;
  /** When this price was fetched. */
  fetchedAt: Date;
  /** When this price expires. */
  expiresAt: Date;
  /** Hash of the search context that produced this price. */
  queryHash: string;
  /** Source supplier code. */
  source: string;
}

// ── Availability Snapshot ────────────────────────────────────────────────

export interface SupplierAvailabilitySnapshot {
  /** Availability state. */
  availability: SupplierAvailability;
  /** When this was fetched. */
  fetchedAt: Date;
  /** When this expires. */
  expiresAt: Date;
}

// ── Supplier Offer Detail ────────────────────────────────────────────────

export interface SupplierOfferDetail extends SupplierOffer {
  /** Package composition (from CONTENT endpoint). */
  packageComposition?: string;
  /** Old/discounted price (if available). */
  oldPrice?: number;
  /** Price type (e.g., "Early booking/2026"). */
  priceType?: string;
}

// ── Supplier Adapter Interface ───────────────────────────────────────────

export interface SupplierAdapter {
  /** Unique supplier code. */
  readonly code: string;
  /** Human-readable name. */
  readonly name: string;
  /** Whether this adapter is enabled. */
  readonly enabled: boolean;

  /** Search for offers matching the query. */
  search(query: SupplierSearchQuery): Promise<SupplierOffer[]>;

  /** Get full detail for a specific offer. */
  getOffer(ref: SupplierOfferRef): Promise<SupplierOfferDetail>;

  /** Refresh price for an existing offer. */
  refreshPrice(ref: SupplierOfferRef): Promise<SupplierPriceSnapshot>;

  /** Refresh availability for an existing offer. */
  refreshAvailability(ref: SupplierOfferRef): Promise<SupplierAvailabilitySnapshot>;
}

// ── Supplier Offer Reference ─────────────────────────────────────────────

export interface SupplierOfferRef {
  supplierCode: string;
  externalOfferId: string;
  externalClaim?: string;
  /** Original search context (needed for re-check). */
  searchContext: SupplierSearchQuery;
}

// ── Supplier Configuration ───────────────────────────────────────────────

export interface SupplierConfig {
  code: string;
  name: string;
  enabled: boolean;
  searchEnabled: boolean;
  livePriceEnabled: boolean;
  availabilityEnabled: boolean;
  /** Rate limit: max concurrent requests. */
  maxConcurrency: number;
  /** Rate limit: max requests per minute. */
  requestsPerMinute: number;
  /** Request timeout (ms). */
  timeoutMs: number;
  /** Search cache TTL (ms). */
  searchCacheTtlMs: number;
  /** Price cache TTL (ms). */
  priceCacheTtlMs: number;
  /** Availability cache TTL (ms). */
  availabilityCacheTtlMs: number;
  /** Detail cache TTL (ms). */
  detailCacheTtlMs: number;
  /** Circuit breaker: consecutive failures before open. */
  circuitBreakerThreshold: number;
  /** Circuit breaker: open duration (ms). */
  circuitBreakerOpenMs: number;
}

// ── Cache Key ────────────────────────────────────────────────────────────

export interface SupplierCacheKey {
  supplierCode: string;
  queryHash: string;
  page: number;
}

// ── Metrics ──────────────────────────────────────────────────────────────

export interface SupplierMetrics {
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
}
