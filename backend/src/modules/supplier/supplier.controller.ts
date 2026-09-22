import { Controller, Get, Post, Body, Param, Query, UseGuards } from "@nestjs/common";
import { SupplierOfferService } from "./supplier-offer.service";
import { SupplierAdapterRegistry } from "./adapter/supplier-adapter.registry";
import { SupplierCacheService } from "./cache/supplier-cache.service";
import { SupplierResilienceService } from "./resilience/supplier-resilience.service";
import { SummerSyncService } from "./summertour/summer-sync.service";
import { SummerBulkSyncService } from "./summertour/summer-bulk-sync.service";
import { KompasSyncService } from "./kompas/kompas-sync.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { RequirePermissions, CurrentUser } from "../../security/auth/decorators";
import type { SupplierSearchQuery, PriceCalendarQuery } from "./supplier.types";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";

/**
 * Supplier API controller — exposes search, detail, refresh, metrics, sync.
 *
 * All endpoints require auth + permissions.
 */
@Controller("supplier")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SupplierController {
  constructor(
    private readonly offerService: SupplierOfferService,
    private readonly registry: SupplierAdapterRegistry,
    private readonly cache: SupplierCacheService,
    private readonly resilience: SupplierResilienceService,
    private readonly summerSync: SummerSyncService,
    private readonly summerBulkSync: SummerBulkSyncService,
    private readonly kompasSync: KompasSyncService,
  ) {}

  // ── Summer Sync ───────────────────────────────────────────────────

  @Post("summertour/sync")
  @RequirePermissions("supplier.search.manage")
  async summerSyncEndpoint(@CurrentUser() actor: AuthedRequest["user"]) {
    // Use admin's partnerId or find Summer partner
    const partner = await this.summerSync["getSummerPartner"]();
    if (!partner) {
      throw new Error("Summer partner not found — run summer-partner-seed first");
    }
    return this.summerSync.runSync(partner.id);
  }

  @Post("summertour/bulk-sync")
  @RequirePermissions("supplier.search.manage")
  async summerBulkSyncEndpoint(@CurrentUser() actor: AuthedRequest["user"]) {
    return this.summerBulkSync.runBulkSync();
  }

  // ── KOMPAS Sync ──────────────────────────────────────────────────

  @Post("kompas/sync")
  @RequirePermissions("supplier.search.manage")
  async kompasSyncEndpoint(@CurrentUser() actor: AuthedRequest["user"]) {
    const partner = await this.kompasSync["getKompasPartner"]();
    if (!partner) {
      throw new Error("KOMPAS partner not found — run partner seed first");
    }
    return this.kompasSync.runSync(partner.id);
  }

  // ── Search ──────────────────────────────────────────────────────────

  @Get("search")
  @RequirePermissions("supplier.search.read")
  async search(
    @Query("supplier") supplierCode: string,
    @Query("country") country?: string,
    @Query("departureCity") departureCity?: string,
    @Query("destination") destination?: string,
    @Query("departureDateFrom") departureDateFrom?: string,
    @Query("departureDateTo") departureDateTo?: string,
    @Query("nightsFrom") nightsFrom?: string,
    @Query("nightsTo") nightsTo?: string,
    @Query("adults") adults?: string,
    @Query("children") children?: string,
    @Query("childAges") childAges?: string,
    @Query("hotelStars") hotelStars?: string,
    @Query("meal") meal?: string,
    @Query("page") page?: string,
  ) {
    const query: SupplierSearchQuery = {
      country,
      departureCity,
      destination,
      departureDateFrom,
      departureDateTo,
      nightsFrom: nightsFrom ? parseInt(nightsFrom, 10) : undefined,
      nightsTo: nightsTo ? parseInt(nightsTo, 10) : undefined,
      adults: adults ? parseInt(adults, 10) : 2,
      children: children ? parseInt(children, 10) : 0,
      childAges: childAges ? childAges.split(",").map(Number) : undefined,
      hotelStars: hotelStars ? hotelStars.split(",").map(Number) : undefined,
      meal,
      page: page ? parseInt(page, 10) : 1,
    };

    return this.offerService.search(supplierCode, query);
  }

  // ── Detail ──────────────────────────────────────────────────────────

  @Get("offer/:supplierCode/:offerId")
  @RequirePermissions("supplier.search.read")
  async getOffer(
    @Param("supplierCode") supplierCode: string,
    @Param("offerId") offerId: string,
    @Query("claim") claim?: string,
  ) {
    return this.offerService.getOffer({
      supplierCode,
      externalOfferId: offerId,
      externalClaim: claim,
      searchContext: { adults: 2 },
    });
  }

  // ── Refresh Price ───────────────────────────────────────────────────

  @Post("refresh-price")
  @RequirePermissions("supplier.search.read")
  async refreshPrice(
    @Body() body: { supplierCode: string; offerId: string; claim?: string; searchContext: SupplierSearchQuery },
  ) {
    return this.offerService.refreshPrice({
      supplierCode: body.supplierCode,
      externalOfferId: body.offerId,
      externalClaim: body.claim,
      searchContext: body.searchContext,
    });
  }

  // ── Refresh Availability ────────────────────────────────────────────

  @Post("refresh-availability")
  @RequirePermissions("supplier.search.read")
  async refreshAvailability(
    @Body() body: { supplierCode: string; offerId: string; claim?: string; searchContext: SupplierSearchQuery },
  ) {
    return this.offerService.refreshAvailability({
      supplierCode: body.supplierCode,
      externalOfferId: body.offerId,
      externalClaim: body.claim,
      searchContext: body.searchContext,
    });
  }

  // ── Price Calendar ────────────────────────────────────────────────

  @Post("price-calendar")
  @RequirePermissions("supplier.search.read")
  async getPriceCalendar(
    @Body() body: PriceCalendarQuery,
  ) {
    return this.offerService.getPriceCalendar(body);
  }

  // ── Registered Adapters ─────────────────────────────────────────────

  @Get("adapters")
  @RequirePermissions("supplier.search.read")
  listAdapters() {
    return this.registry.getAll().map((a) => ({
      code: a.code,
      name: a.name,
      enabled: a.enabled,
    }));
  }

  // ── Metrics ─────────────────────────────────────────────────────────

  @Get("metrics")
  @RequirePermissions("supplier.search.read")
  getMetrics() {
    return {
      offer: this.offerService.getMetrics(),
      cache: this.offerService.getCacheStats(),
      resilience: this.offerService.getResilienceStats(),
    };
  }

  // ── Cache Management ────────────────────────────────────────────────

  @Post("cache/invalidate/:supplierCode")
  @RequirePermissions("supplier.search.manage")
  invalidateCache(@Param("supplierCode") supplierCode: string) {
    this.cache.invalidateSupplier(supplierCode);
    return { ok: true };
  }
}
