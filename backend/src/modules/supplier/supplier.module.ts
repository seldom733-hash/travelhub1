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
import { KompasSyncService } from "./kompas/kompas-sync.service";
import { KompasCaptchaStore } from "./kompas/kompas-captcha.store";
import { KazunionHttpService } from "./kazunion/kazunion-http.service";
import { KazunionAdapter } from "./kazunion/kazunion.adapter";
import { KazunionSyncService } from "./kazunion/kazunion-sync.service";
import { AnexAdapter } from "./anex/anex.adapter";
import { AnexProvider } from "./anex/anex.provider";
import { AnexHotelAdapter } from "./anex/anex-hotel.adapter";
import { SupplierController } from "./supplier.controller";
import { PublicSupplierController } from "./public-supplier.controller";
import { KompasCaptchaController } from "./kompas/kompas-captcha.controller";
import { TourRequestService } from "./tour-request.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { EventBusModule } from "../../eventbus/eventbus.module";
import { AzalAdapter } from "./azal/azal.adapter";
import { AzalHttpService } from "./azal/azal.http.service";
import { AzalController } from "./azal/azal.controller";
import { AzalLocationsService } from "./azal/azal.locations.service";
import { FlightSupplierRegistry } from "./flight-supplier.registry";

/**
 * Supplier module — registers adapters, cache, resilience, service, sync.
 *
 * Adapters are registered at module init.
 * SummerSyncService handles idempotent Product creation from supplier data.
 */
@Global()
@Module({
  imports: [PrismaModule, EventBusModule],
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
    KompasSyncService,
    KazunionHttpService,
    KazunionAdapter,
    KazunionSyncService,
    AnexAdapter,
    AnexProvider,
    AnexHotelAdapter,
    TourRequestService,
    AzalAdapter,
    AzalHttpService,
    AzalLocationsService,
    FlightSupplierRegistry,
    {
      provide: "SUPPLIER_MODULE_INIT",
		useFactory: (
		  registry: SupplierAdapterRegistry,
		  summertour: SummertourNewAdapter,
		  kompas: KompasSupplierAdapter,
		  kazunion: KazunionAdapter,
          anex: AnexAdapter,
          anexHotel: AnexHotelAdapter,
          flightRegistry: FlightSupplierRegistry,
          azal: AzalAdapter,
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
          // Enforced now: honest-empty answers return in ~40s, but the legacy
          // anti-bot re-submit path can legitimately run up to ~150s.
          timeoutMs: 120_000,
          searchCacheTtlMs: 5 * 60 * 1000,
          priceCacheTtlMs: 5 * 60 * 1000,
          availabilityCacheTtlMs: 5 * 60 * 1000,
          detailCacheTtlMs: 24 * 60 * 60 * 1000,
          circuitBreakerThreshold: 10,
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
          // Enforced now — browser flow, keep headroom above slow searches.
          timeoutMs: 120_000,
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

        flightRegistry.register(azal);
      },
      inject: [
        SupplierAdapterRegistry,
        SummertourNewAdapter,
        KompasSupplierAdapter,
        KazunionAdapter,
        AnexAdapter,
        AnexHotelAdapter,
        FlightSupplierRegistry,
        AzalAdapter,
      ],
    },
  ],
  exports: [SupplierAdapterRegistry, SupplierCacheService, SupplierResilienceService, SupplierOfferService, SupplierAggregatorService, SupplierGeoIngestService, SummerSyncService, SummertourHttpService, SummerBulkSyncService, KompasSyncService, KazunionHttpService, KazunionAdapter, KazunionSyncService, AnexAdapter, AnexProvider, AnexHotelAdapter, AzalAdapter, AzalHttpService, AzalLocationsService, FlightSupplierRegistry],
})
export class SupplierModule {}
