import { Module, Global } from "@nestjs/common";
import { SupplierAdapterRegistry } from "./adapter/supplier-adapter.registry";
import { SupplierCacheService } from "./cache/supplier-cache.service";
import { SupplierResilienceService } from "./resilience/supplier-resilience.service";
import { SupplierOfferService } from "./supplier-offer.service";
import { SupplierAggregatorService } from "./supplier-aggregator.service";
import { SupplierGeoIngestService } from "./supplier-geo-ingest.service";
import { SummertourAdapter } from "./summertour/summertour.adapter";
import { SummertourNewAdapter } from "./summertour/summertour-new.adapter";
import { SummerSyncService } from "./summertour/summer-sync.service";
import { SummertourHttpService } from "./summertour/summertour-http.service";
import { SummerBulkSyncService } from "./summertour/summer-bulk-sync.service";
import { KompasSupplierAdapter } from "./kompas/kompas.adapter";
import { KompasHotelAdapter } from "./kompas/kompas-hotel.adapter";
import { KompasHotelSyncService } from "./kompas/kompas-hotel-sync.service";
import { KompasSyncService } from "./kompas/kompas-sync.service";
import { KompasCaptchaStore } from "./kompas/kompas-captcha.store";
import { KazunionHttpService } from "./kazunion/kazunion-http.service";
import { KazunionAdapter } from "./kazunion/kazunion.adapter";
import { KazunionHotelAdapter } from "./kazunion/kazunion-hotel.adapter";
import { KazunionHotelSyncService } from "./kazunion/kazunion-hotel-sync.service";
import { KazunionSyncService } from "./kazunion/kazunion-sync.service";
import { AnexAdapter } from "./anex/anex.adapter";
import { AnexProvider } from "./anex/anex.provider";
import { AnexHotelAdapter } from "./anex/anex-hotel.adapter";
import { AnexSyncService } from "./anex/anex-sync.service";
import { FstravelAdapter } from "./fstravel/fstravel.adapter";
import { FstravelSyncService } from "./fstravel/fstravel-sync.service";
import { SupplierController } from "./supplier.controller";
import { PublicSupplierController } from "./public-supplier.controller";
import { KompasCaptchaController } from "./kompas/kompas-captcha.controller";
import { TourRequestService } from "./tour-request.service";
import { CrmModule } from "../crm/crm.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { EventBusModule } from "../../eventbus/eventbus.module";
import { PricingModule } from "../pricing/pricing.module";
import { AzalAdapter } from "./azal/azal.adapter";
import { AzalHttpService } from "./azal/azal.http.service";
import { AzalController } from "./azal/azal.controller";
import { AzalLocationsService } from "./azal/azal.locations.service";
import { AviasalesAdapter } from "./aviasales/aviasales.adapter";
import { AviasalesHttpService } from "./aviasales/aviasales.http.service";
import { FlightSupplierRegistry } from "./flight-supplier.registry";

/**
 * Supplier module — registers adapters, cache, resilience, service, sync.
 *
 * Adapters are registered at module init.
 * SummerSyncService handles idempotent Product creation from supplier data.
 */
@Global()
@Module({
  imports: [PrismaModule, EventBusModule, PricingModule, CrmModule],
  controllers: [SupplierController, PublicSupplierController, KompasCaptchaController, AzalController],
  providers: [
    SupplierAdapterRegistry,
    SupplierCacheService,
    SupplierResilienceService,
    SupplierOfferService,
    SupplierAggregatorService,
    SupplierGeoIngestService,
    SummertourAdapter,
    SummertourNewAdapter,
    SummerSyncService,
    SummertourHttpService,
    SummerBulkSyncService,
    KompasCaptchaStore,
    KompasSupplierAdapter,
    KompasHotelAdapter,
    KompasSyncService,
    KompasHotelSyncService,
    KazunionHttpService,
    KazunionAdapter,
    KazunionHotelAdapter,
    KazunionSyncService,
    KazunionHotelSyncService,
    AnexAdapter,
    AnexProvider,
    AnexHotelAdapter,
    AnexSyncService,
    FstravelAdapter,
    FstravelSyncService,
    TourRequestService,
    AzalAdapter,
    AzalHttpService,
    AzalLocationsService,
    AviasalesAdapter,
    AviasalesHttpService,
    FlightSupplierRegistry,
    {
      provide: "SUPPLIER_MODULE_INIT",
		useFactory: (
		  registry: SupplierAdapterRegistry,
		  summertour: SummertourNewAdapter,
		  kompas: KompasSupplierAdapter,
		  kompasHotel: KompasHotelAdapter,
		  kazunion: KazunionAdapter,
		  kazunionHotel: KazunionHotelAdapter,
          anex: AnexAdapter,
          anexHotel: AnexHotelAdapter,
          fstravel: FstravelAdapter,
          flightRegistry: FlightSupplierRegistry,
          azal: AzalAdapter,
          aviasales: AviasalesAdapter,
		) => {
        registry.register(summertour, {
          code: "SUMMERTOUR",
          name: "Summertour",
          serviceTypes: ["tours"],
          enabled: true,
          searchEnabled: true,
          livePriceEnabled: true,
          availabilityEnabled: true,
          // Raised 2/10 → 4/20: Summer's live search takes 30–70s (browser
          // form scraping), so the old limits were exhausted by any 3rd
          // overlapping user query → "Rate limit exceeded" → UI "временно
          // недоступен". 4/20 matches KazUnion and tolerates multi-tab usage.
          maxConcurrency: 4,
          requestsPerMinute: 20,
          // Enforced now (see offer service): keep well above the documented
          // 30–70s of browser form scraping — a timeout would drop the whole
          // supplier from an otherwise healthy search.
          timeoutMs: 180_000,
          searchCacheTtlMs: 5 * 60 * 1000,
          priceCacheTtlMs: 5 * 60 * 1000,
          availabilityCacheTtlMs: 5 * 60 * 1000,
          detailCacheTtlMs: 24 * 60 * 60 * 1000,
          circuitBreakerThreshold: 5,
          circuitBreakerOpenMs: 60_000,
        });
        registry.register(kompas, {
          code: "KOMPAS",
          name: "Kompas Tour",
          serviceTypes: ["tours"],
          enabled: true,
          searchEnabled: true,
          livePriceEnabled: true,
          availabilityEnabled: true,
          maxConcurrency: 10,
          requestsPerMinute: 30,
          // Enforced now (see offer service). Budget from live timing: 30
          // pager pages ≈ 115s of active work + form fill ≈ 25s → ~140s
          // healthy; the anti-bot re-submit path adds more. 120s dropped
          // whole (often full) results — give it 5 minutes.
          timeoutMs: 300_000,
          searchCacheTtlMs: 5 * 60 * 1000,
          priceCacheTtlMs: 5 * 60 * 1000,
          availabilityCacheTtlMs: 5 * 60 * 1000,
          detailCacheTtlMs: 24 * 60 * 60 * 1000,
          circuitBreakerThreshold: 10,
          circuitBreakerOpenMs: 120_000,
        });

        // HOTELS category adapter of the SAME KOMPAS code (§2: Provider →
        // Category-Adapter). Registered after tours so legacy service-less
        // lookups keep resolving the tour adapter. Drives the SAMO
        // `search_hotel` (stay-only, no departure city) via the shared
        // Playwright machinery in KompasSupplierAdapter.searchHotelRows().
        registry.register(kompasHotel, {
          code: "KOMPAS",
          name: "Kompas",
          serviceTypes: ["hotels"],
          enabled: true,
          searchEnabled: true,
          livePriceEnabled: true,
          availabilityEnabled: true,
          // Playwright browser (same class as the tour registration) but a
          // single PRICES navigation per page — no 30-page pager fan-out, so
          // the timeout stays well below the tour's 300s.
          maxConcurrency: 2,
          requestsPerMinute: 12,
          timeoutMs: 180_000,
          searchCacheTtlMs: 5 * 60 * 1000,
          priceCacheTtlMs: 5 * 60 * 1000,
          availabilityCacheTtlMs: 5 * 60 * 1000,
          detailCacheTtlMs: 24 * 60 * 60 * 1000,
          circuitBreakerThreshold: 5,
          circuitBreakerOpenMs: 120_000,
        });

        registry.register(kazunion, {
          code: "KAZUNION",
          name: "KazUnion",
          serviceTypes: ["tours"],
          enabled: true,
          searchEnabled: true,
          livePriceEnabled: true,
          availabilityEnabled: true,
          maxConcurrency: 4,
          requestsPerMinute: 20,
          // Enforced now. A generic «Любой» search fans out over ALL
          // programs of the country (live TR: 5 programs × up to 30 pages,
          // 2s pacing inside kazunion-http) ≈ 400s of pure request time —
          // 120s guaranteed a zeroed supplier. 8 minutes covers the worst
          // case; repeat searches are served from the 5-min search cache.
          timeoutMs: 480_000,
          searchCacheTtlMs: 5 * 60 * 1000,
          priceCacheTtlMs: 5 * 60 * 1000,
          availabilityCacheTtlMs: 5 * 60 * 1000,
          detailCacheTtlMs: 24 * 60 * 60 * 1000,
          circuitBreakerThreshold: 10,
          circuitBreakerOpenMs: 120_000,
        });

        // HOTELS category adapter of the SAME KazUnion code (§2: Provider →
        // Category-Adapter). Registered after tours so legacy service-less
        // lookups keep resolving the tour adapter. Drives the SAMO
        // `search_hotel` (stay-only, no departure city) over plain HTTP — the
        // hotel form is a SEPARATE dictionary with 22 countries.
        registry.register(kazunionHotel, {
          code: "KAZUNION",
          name: "KazUnion",
          serviceTypes: ["hotels"],
          enabled: true,
          searchEnabled: true,
          livePriceEnabled: true,
          availabilityEnabled: true,
          // Plain HTTP (no browser); the adapter shares the paced request
          // queue with the tour adapter, so concurrency is bounded upstream.
          maxConcurrency: 4,
          requestsPerMinute: 20,
          // A wide hotel search paginates PRICEPAGE; same budget class as the
          // tour registration.
          timeoutMs: 480_000,
          searchCacheTtlMs: 5 * 60 * 1000,
          priceCacheTtlMs: 5 * 60 * 1000,
          availabilityCacheTtlMs: 5 * 60 * 1000,
          detailCacheTtlMs: 24 * 60 * 60 * 1000,
          circuitBreakerThreshold: 10,
          circuitBreakerOpenMs: 120_000,
        });

        registry.register(anex, {
          code: "ANEX",
          name: "ANEX",
          serviceTypes: ["tours"],
          enabled: true,
          searchEnabled: true,
          livePriceEnabled: true,
          availabilityEnabled: true,
          // Plain REST GET, no browser/captcha — same class as KazUnion.
          maxConcurrency: 4,
          // 30 rpm throttled the calendar's town probe (21 cached Towns
          // lookups) into a 503 rate-limit; ANEX served the geo ingest at
          // ~70 rpm without flinching.
          requestsPerMinute: 120,
          // A wide nights range expands into one exact-night request per
          // value (up to 27 for 2..28) — give the job room to finish.
          timeoutMs: 120_000,
          searchCacheTtlMs: 5 * 60 * 1000,
          priceCacheTtlMs: 5 * 60 * 1000,
          availabilityCacheTtlMs: 5 * 60 * 1000,
          detailCacheTtlMs: 24 * 60 * 60 * 1000,
          circuitBreakerThreshold: 10,
          circuitBreakerOpenMs: 120_000,
        });

        // HOTELS category adapter of the SAME provider code (prompt §2:
        // Provider → Category-Adapter; serviceTypes do not overlap with the
        // tours registration above). Registered after tours so legacy
        // service-less lookups keep resolving the tours adapter.
        registry.register(anexHotel, {
          code: "ANEX",
          name: "ANEX",
          serviceTypes: ["hotels"],
          enabled: true,
          searchEnabled: true,
          livePriceEnabled: true,
          availabilityEnabled: true,
          // Same class as the tours registration: plain REST GET, one exact
          // request per night of the range (≤30) with bounded parallelism.
          maxConcurrency: 4,
          requestsPerMinute: 120,
          timeoutMs: 120_000,
          searchCacheTtlMs: 5 * 60 * 1000,
          priceCacheTtlMs: 5 * 60 * 1000,
          availabilityCacheTtlMs: 5 * 60 * 1000,
          detailCacheTtlMs: 24 * 60 * 60 * 1000,
          circuitBreakerThreshold: 10,
          circuitBreakerOpenMs: 120_000,
        });

        // FSTravel (b2b.fstravel.asia — plain HTTP + OCR captcha): tour
        // supplier, registered so the universal search's «Поставщики» picker
        // lists it and country-level live searches query it. The same adapter
        // drives the sync endpoint (POST /supplier/fstravel/sync).
        registry.register(fstravel, {
          code: "FSTRAVEL",
          name: "FSTravel",
          serviceTypes: ["tours"],
          enabled: true,
          searchEnabled: true,
          livePriceEnabled: true,
          availabilityEnabled: true,
          // The adapter paces itself (~3s/request) and auto-solves the SAMO
          // antibot captcha by OCR; one country search fans out over 8-day
          // windows × every night (≤48 paginated queries) — the budget
          // matches KazUnion's worst case. Concurrency is NOT the upstream
          // guard (the adapter's own paced queue is, and the sync path
          // bypasses the registry entirely): an inflight slot is held for the
          // whole call, which can run minutes while the pacing queue is
          // congested — a small limit 503s legitimate parallel user calls
          // (price-calendar + search + re-check), so let them queue instead.
          maxConcurrency: 8,
          requestsPerMinute: 15,
          timeoutMs: 480_000,
          searchCacheTtlMs: 5 * 60 * 1000,
          priceCacheTtlMs: 5 * 60 * 1000,
          availabilityCacheTtlMs: 5 * 60 * 1000,
          detailCacheTtlMs: 24 * 60 * 60 * 1000,
          circuitBreakerThreshold: 5,
          circuitBreakerOpenMs: 120_000,
        });

        flightRegistry.register(azal);
        // Second live flight price source. Registering it makes every
        // /supplier/azal/search call fan out over both suppliers; failures
        // stay isolated through the controller's Promise.allSettled.
        flightRegistry.register(aviasales);
      },
      inject: [
        SupplierAdapterRegistry,
        SummertourNewAdapter,
        KompasSupplierAdapter,
        KompasHotelAdapter,
        KazunionAdapter,
        KazunionHotelAdapter,
        AnexAdapter,
        AnexHotelAdapter,
        FstravelAdapter,
        FlightSupplierRegistry,
        AzalAdapter,
        AviasalesAdapter,
      ],
    },
  ],
  exports: [SupplierAdapterRegistry, SupplierCacheService, SupplierResilienceService, SupplierOfferService, SupplierAggregatorService, SupplierGeoIngestService, SummerSyncService, SummertourHttpService, SummerBulkSyncService, KompasSyncService, KompasHotelSyncService, KazunionHttpService, KazunionAdapter, KazunionHotelAdapter, KazunionSyncService, KazunionHotelSyncService, AnexAdapter, AnexProvider, AnexHotelAdapter, AnexSyncService, FstravelAdapter, FstravelSyncService, KompasHotelAdapter, AzalAdapter, AzalHttpService, AzalLocationsService, AviasalesAdapter, AviasalesHttpService, FlightSupplierRegistry],
})
export class SupplierModule {}
