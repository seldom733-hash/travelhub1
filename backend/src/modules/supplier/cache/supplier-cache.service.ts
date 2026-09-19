import { Injectable, Logger } from "@nestjs/common";
import type { SupplierOffer, SupplierPriceSnapshot, SupplierAvailabilitySnapshot, SupplierOfferDetail } from "../supplier.types";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory TTL cache for supplier data. Context-aware keys.
 *
 * TTLs:
 * - Search results: configurable (default 5 min)
 * - Price snapshots: configurable (default 5 min)
 * - Availability: configurable (default 5 min)
 * - Detail/CONTENT: configurable (default 24h)
 *
 * Cache key = SHA-256(supplierCode + serialized query + page).
 * No external dependencies (no Redis) — single-instance only.
 */
@Injectable()
export class SupplierCacheService {
  private readonly logger = new Logger(SupplierCacheService.name);
  private readonly searchCache = new Map<string, CacheEntry<SupplierOffer[]>>();
  private readonly priceCache = new Map<string, CacheEntry<SupplierPriceSnapshot>>();
  private readonly availabilityCache = new Map<string, CacheEntry<SupplierAvailabilitySnapshot>>();
  private readonly detailCache = new Map<string, CacheEntry<SupplierOfferDetail>>();

  // Configurable TTLs (ms)
  private searchTtlMs = 5 * 60 * 1000;
  private priceTtlMs = 5 * 60 * 1000;
  private availabilityTtlMs = 5 * 60 * 1000;
  private detailTtlMs = 24 * 60 * 60 * 1000;

  // Metrics
  hits = 0;
  misses = 0;

  setSearchTtl(ms: number): void { this.searchTtlMs = ms; }
  setPriceTtl(ms: number): void { this.priceTtlMs = ms; }
  setAvailabilityTtl(ms: number): void { this.availabilityTtlMs = ms; }
  setDetailTtl(ms: number): void { this.detailTtlMs = ms; }

  // ── Search Cache ─────────────────────────────────────────────────────

  getSearch(key: string): SupplierOffer[] | undefined {
    const entry = this.searchCache.get(key);
    if (!entry) { this.misses++; return undefined; }
    if (Date.now() > entry.expiresAt) {
      this.searchCache.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry.value;
  }

  setSearch(key: string, offers: SupplierOffer[]): void {
    this.searchCache.set(key, { value: offers, expiresAt: Date.now() + this.searchTtlMs });
  }

  // ── Price Cache ──────────────────────────────────────────────────────

  getPrice(key: string): SupplierPriceSnapshot | undefined {
    const entry = this.priceCache.get(key);
    if (!entry) { this.misses++; return undefined; }
    if (Date.now() > entry.expiresAt) {
      this.priceCache.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry.value;
  }

  setPrice(key: string, snapshot: SupplierPriceSnapshot): void {
    this.priceCache.set(key, { value: snapshot, expiresAt: Date.now() + this.priceTtlMs });
  }

  // ── Availability Cache ───────────────────────────────────────────────

  getAvailability(key: string): SupplierAvailabilitySnapshot | undefined {
    const entry = this.availabilityCache.get(key);
    if (!entry) { this.misses++; return undefined; }
    if (Date.now() > entry.expiresAt) {
      this.availabilityCache.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry.value;
  }

  setAvailability(key: string, snapshot: SupplierAvailabilitySnapshot): void {
    this.availabilityCache.set(key, { value: snapshot, expiresAt: Date.now() + this.availabilityTtlMs });
  }

  // ── Detail Cache ─────────────────────────────────────────────────────

  getDetail(key: string): SupplierOfferDetail | undefined {
    const entry = this.detailCache.get(key);
    if (!entry) { this.misses++; return undefined; }
    if (Date.now() > entry.expiresAt) {
      this.detailCache.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry.value;
  }

  setDetail(key: string, detail: SupplierOfferDetail): void {
    this.detailCache.set(key, { value: detail, expiresAt: Date.now() + this.detailTtlMs });
  }

  // ── Utilities ────────────────────────────────────────────────────────

  invalidateSupplier(supplierCode: string): void {
    let count = 0;
    for (const key of this.searchCache.keys()) {
      if (key.includes(supplierCode)) { this.searchCache.delete(key); count++; }
    }
    for (const key of this.priceCache.keys()) {
      if (key.startsWith(supplierCode + ":")) { this.priceCache.delete(key); count++; }
    }
    for (const key of this.availabilityCache.keys()) {
      if (key.startsWith(supplierCode + ":")) { this.availabilityCache.delete(key); count++; }
    }
    for (const key of this.detailCache.keys()) {
      if (key.startsWith(supplierCode + ":")) { this.detailCache.delete(key); count++; }
    }
    this.logger.log(`Invalidated ${count} cache entries for supplier ${supplierCode}`);
  }

  clear(): void {
    this.searchCache.clear();
    this.priceCache.clear();
    this.availabilityCache.clear();
    this.detailCache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats(): { searchSize: number; priceSize: number; availabilitySize: number; detailSize: number; hits: number; misses: number } {
    return {
      searchSize: this.searchCache.size,
      priceSize: this.priceCache.size,
      availabilitySize: this.availabilityCache.size,
      detailSize: this.detailCache.size,
      hits: this.hits,
      misses: this.misses,
    };
  }

  // ── Key Derivation ──────────────────────────────────────────────────

  static deriveSearchKey(supplierCode: string, query: Record<string, unknown>, page: number): string {
    const sorted = Object.keys(query)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => { acc[k] = query[k]; return acc; }, {});
    return `${supplierCode}:${JSON.stringify(sorted)}:${page}`;
  }

  static derivePriceKey(supplierCode: string, externalOfferId: string, adults: number, children: number, childAges: number[]): string {
    return `${supplierCode}:price:${externalOfferId}:${adults}:${children}:${childAges.join(",")}`;
  }

  static deriveAvailabilityKey(supplierCode: string, externalOfferId: string): string {
    return `${supplierCode}:avail:${externalOfferId}`;
  }

  static deriveDetailKey(supplierCode: string, externalOfferId: string, externalClaim: string): string {
    return `${supplierCode}:detail:${externalOfferId}:${externalClaim}`;
  }
}
