import { Controller, Get, Post, Body, Param, Query, UseGuards } from "@nestjs/common";
import { SupplierOfferService } from "./supplier-offer.service";
import { SupplierAdapterRegistry } from "./adapter/supplier-adapter.registry";
import { SupplierCacheService } from "./cache/supplier-cache.service";
import { SupplierResilienceService } from "./resilience/supplier-resilience.service";
import { SummerSyncService } from "./summertour/summer-sync.service";
import { SummerBulkSyncService } from "./summertour/summer-bulk-sync.service";
import { KompasSyncService } from "./kompas/kompas-sync.service";
import { KompasHotelSyncService } from "./kompas/kompas-hotel-sync.service";
import { KazunionSyncService } from "./kazunion/kazunion-sync.service";
import { KazunionHotelSyncService } from "./kazunion/kazunion-hotel-sync.service";
import { VoyagerSyncService } from "./voyager/voyager-sync.service";
import { VoyagerHotelSyncService } from "./voyager/voyager-hotel-sync.service";
import { AnexSyncService } from "./anex/anex-sync.service";
import { FstravelSyncService } from "./fstravel/fstravel-sync.service";
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
    private readonly kompasHotelSync: KompasHotelSyncService,
    private readonly kazunionSync: KazunionSyncService,
    private readonly kazunionHotelSync: KazunionHotelSyncService,
    private readonly voyagerSync: VoyagerSyncService,
    private readonly voyagerHotelSync: VoyagerHotelSyncService,
    private readonly anexSync: AnexSyncService,
    private readonly fstravelSync: FstravelSyncService,
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
  async kompasSyncEndpoint(
    @CurrentUser() actor: AuthedRequest["user"],
    @Query("country") country?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("geoCountryCode") geoCountryCode?: string,
  ) {
    const partner = await this.kompasSync["getKompasPartner"]();
    if (!partner) {
      throw new Error("KOMPAS partner not found — run partner seed first");
    }
    return this.kompasSync.runSync(partner.id, {
      countryNameContains: country,
      dateFrom,
      dateTo,
      geoCountryCode,
    });
  }

  // ── KOMPAS Hotel Sync ─────────────────────────────────────────────

  /**
   * Import KOMPAS hotels (stay-only) as Product(type=HOTEL, accommodation).
   * POST /supplier/kompas/hotel-sync?countryIsos=TR,AE&dateFrom=&dateTo=&nights=7&maxPages=40
   * Default scope: curated top countries (TR, AE, EG, TH, MV, GE).
   */
  @Post("kompas/hotel-sync")
  @RequirePermissions("supplier.search.manage")
  async kompasHotelSyncEndpoint(
    @CurrentUser() actor: AuthedRequest["user"],
    @Query("countryIsos") countryIsos?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("nights") nights?: string,
    @Query("maxPages") maxPages?: string,
  ) {
    return this.kompasHotelSync.runSync({
      countryIsos: countryIsos
        ? countryIsos.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
        : undefined,
      dateFrom,
      dateTo,
      nights: nights ? parseInt(nights, 10) : undefined,
      maxPages: maxPages ? parseInt(maxPages, 10) : undefined,
    });
  }

  // ── KazUnion Sync ─────────────────────────────────────────────────────

  @Post("kazunion/sync")
  @RequirePermissions("supplier.search.manage")
  async kazunionSyncEndpoint(
    @CurrentUser() actor: AuthedRequest["user"],
    @Query("country") country?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("geoCountryCode") geoCountryCode?: string,
  ) {
    const partner = await this.kazunionSync.getKazunionPartner();
    if (!partner) {
      throw new Error("KazUnion partner not found — sync cannot run");
    }
    return this.kazunionSync.runSync(partner.id, {
      countryNameContains: country,
      dateFrom,
      dateTo,
      geoCountryCode,
    });
  }

  /**
   * Import KazUnion HOTELS (stay-only) as Product(type=HOTEL, accommodation).
   * POST /supplier/kazunion/hotel-sync?countryIsos=VN,AZ&dateFrom=&dateTo=&nights=7&maxPages=30
   * Default scope: every country of the KazUnion hotel dictionary (22).
   *
   * A captcha-blocked country is reported in `errors` — never as "0 hotels".
   * Countries with a genuine empty answer are counted in
   * `countriesWithoutInventory`.
   */
  @Post("kazunion/hotel-sync")
  @RequirePermissions("supplier.search.manage")
  async kazunionHotelSyncEndpoint(
    @CurrentUser() actor: AuthedRequest["user"],
    @Query("countryIsos") countryIsos?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("nights") nights?: string,
    @Query("maxPages") maxPages?: string,
  ) {
    return this.kazunionHotelSync.runSync({
      countryIsos: countryIsos
        ? countryIsos.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
        : undefined,
      dateFrom,
      dateTo,
      nights: nights ? parseInt(nights, 10) : undefined,
      maxPages: maxPages ? parseInt(maxPages, 10) : undefined,
    });
  }

  // ── Voyager Sync ─────────────────────────────────────────────────────

  /**
   * Import Voyager TOURS as Product(type=TOUR) cards.
   * POST /supplier/voyager/sync?countryIsos=TZ,IN&dateFrom=&dateTo=&maxPages=30
   * Default scope: every country of the tour dictionary (10).
   *
   * The engine fans out ALL programs of a country per sweep (TOURINC=0) —
   * the sync does not loop programs.
   */
  @Post("voyager/sync")
  @RequirePermissions("supplier.search.manage")
  async voyagerSyncEndpoint(
    @CurrentUser() actor: AuthedRequest["user"],
    @Query("countryIsos") countryIsos?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("maxPages") maxPages?: string,
  ) {
    const partner = await this.voyagerSync.getVoyagerPartner();
    if (!partner) {
      throw new Error("Voyager partner not found — sync cannot run");
    }
    return this.voyagerSync.runSync({
      countryIsos: countryIsos
        ? countryIsos.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
        : undefined,
      dateFrom,
      dateTo,
      maxPages: maxPages ? parseInt(maxPages, 10) : undefined,
    });
  }

  /**
   * Import Voyager HOTELS (stay-only /search_hotel) as Product(type=HOTEL,
   * accommodation) cards. POST /supplier/voyager/hotel-sync?countryIsos=AZ,GE&dateFrom=&dateTo=&nights=7&maxPages=30
   * Default scope: every country of the hotel dictionary (16).
   */
  @Post("voyager/hotel-sync")
  @RequirePermissions("supplier.search.manage")
  async voyagerHotelSyncEndpoint(
    @CurrentUser() actor: AuthedRequest["user"],
    @Query("countryIsos") countryIsos?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("nights") nights?: string,
    @Query("maxPages") maxPages?: string,
  ) {
    return this.voyagerHotelSync.runSync({
      countryIsos: countryIsos
        ? countryIsos.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
        : undefined,
      dateFrom,
      dateTo,
      nights: nights ? parseInt(nights, 10) : undefined,
      maxPages: maxPages ? parseInt(maxPages, 10) : undefined,
    });
  }

  // ── Search ──────────────────────────────────────────────────────────

  @Post("anex/sync")
  @RequirePermissions("supplier.search.manage")
  async anexSyncEndpoint(
    @CurrentUser() actor: AuthedRequest["user"],
    @Query("country") country?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("geoCountryCode") geoCountryCode?: string,
  ) {
    const partner = await this.anexSync.getAnexPartner();
    if (!partner) {
      throw new Error("ANEX partner not found — run partner seed first");
    }
    return this.anexSync.runSync(partner.id, {
      countryNameContains: country,
      dateFrom,
      dateTo,
      geoCountryCode,
    });
  }

  @Post("fstravel/sync")
  @RequirePermissions("supplier.search.manage")
  async fstravelSyncEndpoint(
    @CurrentUser() actor: AuthedRequest["user"],
    @Query("country") country?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("geoCountryCode") geoCountryCode?: string,
  ) {
    const partner = await this.fstravelSync.getFstravelPartner();
    if (!partner) {
      throw new Error("FSTRAVEL partner not found — run partner seed first");
    }
    return this.fstravelSync.runSync(partner.id, {
      countryNameContains: country,
      dateFrom,
      dateTo,
      geoCountryCode,
    });
  }

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
      hotelStars: hotelStars ? hotelStars.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
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
    // Entries, not getAll(): one provider code can register several category
    // adapters (ANEX tours + ANEX hotels) — serviceTypes tells them apart.
    return this.registry.getEntries().map(({ adapter: a, config }) => ({
      code: a.code,
      name: a.name,
      enabled: a.enabled,
      serviceTypes: config.serviceTypes,
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
