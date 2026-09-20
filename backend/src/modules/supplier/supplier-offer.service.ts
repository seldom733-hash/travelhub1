import { Injectable, Logger } from "@nestjs/common";
import { SupplierAdapterRegistry } from "./adapter/supplier-adapter.registry";
import { SupplierCacheService } from "./cache/supplier-cache.service";
import { SupplierResilienceService } from "./resilience/supplier-resilience.service";
import type {
  SupplierSearchQuery,
  SupplierOffer,
  SupplierOfferDetail,
  SupplierOfferRef,
  SupplierPriceSnapshot,
  SupplierAvailabilitySnapshot,
  SupplierMetrics,
  PriceCalendarQuery,
  PriceCalendarResult,
} from "./supplier.types";

/**
 * Central service for supplier offer operations.
 *
 * Orchestrates: adapter → resilience → cache → response.
 * Context-aware cache: query hash + page = cache key.
 * Request coalescing: duplicate queries share in-flight request.
 * Schema drift detection: validate response before caching.
 */
@Injectable()
export class SupplierOfferService {
  private readonly logger = new Logger(SupplierOfferService.name);

  constructor(
    private readonly registry: SupplierAdapterRegistry,
    private readonly cache: SupplierCacheService,
    private readonly resilience: SupplierResilienceService,
  ) {}

  // ── Search ──────────────────────────────────────────────────────────

  async search(supplierCode: string, query: SupplierSearchQuery): Promise<SupplierOffer[]> {
    const adapter = this.registry.get(supplierCode);
    const config = this.registry.getConfig(supplierCode);

    if (!adapter.enabled || !config.searchEnabled) {
      throw new Error(`Supplier ${supplierCode} search is disabled`);
    }

    // Circuit breaker
    if (this.resilience.isCircuitOpen(supplierCode)) {
      this.metrics.circuitOpen++;
      throw new Error(`Supplier ${supplierCode} circuit is OPEN — supplier unavailable`);
    }

    // Cache key
    const page = query.page ?? 1;
    const cacheKey = SupplierCacheService.deriveSearchKey(supplierCode, query as unknown as Record<string, unknown>, page);

    // Request coalescing
    return this.resilience.coalesce(cacheKey, async () => {
      // Check cache
      const cached = this.cache.getSearch(cacheKey);
      if (cached) {
        this.metrics.cacheHit++;
        return cached;
      }
      this.metrics.cacheMiss++;

      // Rate limit + concurrency
      this.resilience.acquireBucket(supplierCode, config.maxConcurrency, config.requestsPerMinute);
      this.resilience.incrementInflight(supplierCode, config.maxConcurrency);

      try {
        this.metrics.searchTotal++;
        const start = Date.now();

        const offers = await this.resilience.withRetry(
          supplierCode,
          () => adapter.search(query),
          2,
          1000,
        );

        const latency = Date.now() - start;
        this.metrics.searchLatencyMs.push(latency);
        if (this.metrics.searchLatencyMs.length > 1000) {
          this.metrics.searchLatencyMs = this.metrics.searchLatencyMs.slice(-500);
        }

        // Schema drift detection
        const validated = this.validateOffers(offers, supplierCode);

        // Cache
        this.cache.setSearch(cacheKey, validated);
        this.metrics.searchSuccess++;
        this.resilience.recordSuccess(supplierCode);

        this.logger.debug(`Supplier ${supplierCode} search: ${validated.length} offers in ${latency}ms`);
        return validated;
      } catch (err) {
        this.metrics.searchError++;
        this.resilience.recordFailure(supplierCode);
        throw err;
      } finally {
        this.resilience.decrementInflight(supplierCode);
      }
    }) as Promise<SupplierOffer[]>;
  }

  // ── Get Detail ──────────────────────────────────────────────────────

  async getOffer(ref: SupplierOfferRef): Promise<SupplierOfferDetail> {
    const adapter = this.registry.get(ref.supplierCode);
    const config = this.registry.getConfig(ref.supplierCode);

    if (!adapter.enabled) {
      throw new Error(`Supplier ${ref.supplierCode} is disabled`);
    }

    if (this.resilience.isCircuitOpen(ref.supplierCode)) {
      this.metrics.circuitOpen++;
      throw new Error(`Supplier ${ref.supplierCode} circuit is OPEN`);
    }

    const cacheKey = SupplierCacheService.deriveDetailKey(
      ref.supplierCode,
      ref.externalOfferId,
      ref.externalClaim ?? "",
    );

    const cached = this.cache.getDetail(cacheKey);
    if (cached) {
      this.metrics.cacheHit++;
      return cached;
    }
    this.metrics.cacheMiss++;

    this.resilience.acquireBucket(ref.supplierCode, config.maxConcurrency, config.requestsPerMinute);
    this.resilience.incrementInflight(ref.supplierCode, config.maxConcurrency);

    try {
      const detail = await this.resilience.withRetry(
        ref.supplierCode,
        () => adapter.getOffer(ref),
        2,
        1000,
      );

      this.cache.setDetail(cacheKey, detail);
      this.resilience.recordSuccess(ref.supplierCode);
      return detail;
    } catch (err) {
      this.resilience.recordFailure(ref.supplierCode);
      throw err;
    } finally {
      this.resilience.decrementInflight(ref.supplierCode);
    }
  }

  // ── Refresh Price ───────────────────────────────────────────────────

  async refreshPrice(ref: SupplierOfferRef): Promise<SupplierPriceSnapshot> {
    const adapter = this.registry.get(ref.supplierCode);
    const config = this.registry.getConfig(ref.supplierCode);

    if (!adapter.enabled || !config.livePriceEnabled) {
      throw new Error(`Supplier ${ref.supplierCode} live price is disabled`);
    }

    const cacheKey = SupplierCacheService.derivePriceKey(
      ref.supplierCode,
      ref.externalOfferId,
      ref.searchContext.adults,
      ref.searchContext.children ?? 0,
      ref.searchContext.childAges ?? [],
    );

    const cached = this.cache.getPrice(cacheKey);
    if (cached) {
      this.metrics.cacheHit++;
      return cached;
    }
    this.metrics.cacheMiss++;

    const snapshot = await adapter.refreshPrice(ref);
    this.cache.setPrice(cacheKey, snapshot);
    this.metrics.priceRefresh++;

    return snapshot;
  }

  // ── Refresh Availability ────────────────────────────────────────────

  async refreshAvailability(ref: SupplierOfferRef): Promise<SupplierAvailabilitySnapshot> {
    const adapter = this.registry.get(ref.supplierCode);
    const config = this.registry.getConfig(ref.supplierCode);

    if (!adapter.enabled || !config.availabilityEnabled) {
      throw new Error(`Supplier ${ref.supplierCode} availability is disabled`);
    }

    const cacheKey = SupplierCacheService.deriveAvailabilityKey(ref.supplierCode, ref.externalOfferId);

    const cached = this.cache.getAvailability(cacheKey);
    if (cached) {
      this.metrics.cacheHit++;
      return cached;
    }
    this.metrics.cacheMiss++;

    const snapshot = await adapter.refreshAvailability(ref);
    this.cache.setAvailability(cacheKey, snapshot);

    return snapshot;
  }

  // ── Price Calendar ────────────────────────────────────────────────

  async getPriceCalendar(query: PriceCalendarQuery): Promise<PriceCalendarResult> {
    const adapter = this.registry.get(query.supplierCode);
    const config = this.registry.getConfig(query.supplierCode);

    if (!adapter.enabled || !config.searchEnabled) {
      throw new Error(`Supplier ${query.supplierCode} search is disabled`);
    }

    if (this.resilience.isCircuitOpen(query.supplierCode)) {
      this.metrics.circuitOpen++;
      throw new Error(`Supplier ${query.supplierCode} circuit is OPEN — supplier unavailable`);
    }

    this.logger.log(
      `getPriceCalendar IN query=${JSON.stringify(query)}`,
    );
    // Cache key for calendar — includes tourInc program(s) so that different
    // program contexts (e.g. round-trip 229 vs one-way 254) never share cache.
    const calendarKey = `calendar:${query.supplierCode}:${JSON.stringify({
      hotel: query.hotel,
      hotelExternalId: query.hotelExternalId,
      room: query.room,
      meal: query.meal,
      adults: query.adults,
      children: query.children,
      childAges: query.childAges,
      nights: query.nights,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      tourIncValues: query.tourIncValues ?? (query.tourIncValue ? [query.tourIncValue] : []),
    })}`;

    return this.resilience.coalesce(calendarKey, async () => {
      // Check cache (reuse search cache with calendar prefix)
      const cached = this.cache.getSearch(calendarKey);
      if (cached) {
        this.metrics.cacheHit++;
        return cached as unknown as PriceCalendarResult;
      }
      this.metrics.cacheMiss++;

      this.resilience.acquireBucket(query.supplierCode, config.maxConcurrency, config.requestsPerMinute);
      this.resilience.incrementInflight(query.supplierCode, config.maxConcurrency);

      try {
        this.metrics.searchTotal++;
        const start = Date.now();

        const result = await this.resilience.withRetry(
          query.supplierCode,
          () => adapter.getPriceCalendar(query),
          2,
          1000,
        );

        const latency = Date.now() - start;
        this.metrics.searchLatencyMs.push(latency);
        if (this.metrics.searchLatencyMs.length > 1000) {
          this.metrics.searchLatencyMs = this.metrics.searchLatencyMs.slice(-500);
        }

        // Cache the calendar result (using search cache store with calendar TTL)
        this.cache.setSearch(calendarKey, result as unknown as SupplierOffer[]);
        this.metrics.searchSuccess++;
        this.resilience.recordSuccess(query.supplierCode);

        this.logger.debug(`Supplier ${query.supplierCode} price calendar: ${result.entries.length} dates in ${latency}ms`);
        return result;
      } catch (err) {
        this.metrics.searchError++;
        this.resilience.recordFailure(query.supplierCode);
        throw err;
      } finally {
        this.resilience.decrementInflight(query.supplierCode);
      }
    }) as Promise<PriceCalendarResult>;
  }

  // ── Schema Validation ───────────────────────────────────────────────

  private validateOffers(offers: SupplierOffer[], supplierCode: string): SupplierOffer[] {
    return offers.filter((o) => {
      if (!o.externalOfferId || !o.hotel || !o.departureDate || !o.nights || !o.price) {
        this.metrics.schemaError++;
        this.logger.warn(`Schema drift: invalid offer from ${supplierCode} — missing required fields`);
        return false;
      }
      if (typeof o.price.amount !== "number" || o.price.amount <= 0) {
        this.metrics.schemaError++;
        this.logger.warn(`Schema drift: invalid price in offer ${o.externalOfferId} from ${supplierCode}`);
        return false;
      }
      return true;
    });
  }

  // ── Metrics ─────────────────────────────────────────────────────────

  private readonly metrics: SupplierMetrics = {
    searchTotal: 0,
    searchSuccess: 0,
    searchError: 0,
    searchLatencyMs: [],
    cacheHit: 0,
    cacheMiss: 0,
    priceRefresh: 0,
    priceChanged: 0,
    availabilityChanged: 0,
    schemaError: 0,
    circuitOpen: 0,
  };

  getMetrics(): SupplierMetrics {
    return { ...this.metrics };
  }

  getResilienceStats(): Record<string, { state: string; failures: number; inflight: number }> {
    return this.resilience.stats();
  }

  getCacheStats(): { searchSize: number; priceSize: number; availabilitySize: number; detailSize: number; hits: number; misses: number } {
    return this.cache.stats();
  }
}
