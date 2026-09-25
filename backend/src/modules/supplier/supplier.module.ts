import { Module, Global } from "@nestjs/common";
import { SupplierAdapterRegistry } from "./adapter/supplier-adapter.registry";
import { SupplierCacheService } from "./cache/supplier-cache.service";
import { SupplierResilienceService } from "./resilience/supplier-resilience.service";
import { SupplierOfferService } from "./supplier-offer.service";
import { SummertourAdapter } from "./summertour/summertour.adapter";
import { SummertourNewAdapter } from "./summertour/summertour-new.adapter";
import { SummerSyncService } from "./summertour/summer-sync.service";
import { SummertourHttpService } from "./summertour/summertour-http.service";
import { SummerBulkSyncService } from "./summertour/summer-bulk-sync.service";
import { KompasSupplierAdapter } from "./kompas/kompas.adapter";
import { KompasSyncService } from "./kompas/kompas-sync.service";
import { KompasCaptchaStore } from "./kompas/kompas-captcha.store";
import { SupplierController } from "./supplier.controller";
import { PublicSupplierController } from "./public-supplier.controller";
import { KompasCaptchaController } from "./kompas/kompas-captcha.controller";
import { TourRequestService } from "./tour-request.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { EventBusModule } from "../../eventbus/eventbus.module";
import { AzalAdapter } from "./azal/azal.adapter";
import { AzalHttpService } from "./azal/azal.http.service";
import { AzalController } from "./azal/azal.controller";
import { FlightSupplierRegistry } from "./flight-supplier.registry";
import { WizzAirAdapter } from "./wizzair/wizzair.adapter";
import { WizzAirHttpService } from "./wizzair/wizzair.http.service";
import { WizzAirController } from "./wizzair/wizzair.controller";

/**
 * Supplier module — registers adapters, cache, resilience, service, sync.
 *
 * Adapters are registered at module init.
 * SummerSyncService handles idempotent Product creation from supplier data.
 */
@Global()
@Module({
  imports: [PrismaModule, EventBusModule],
  controllers: [SupplierController, PublicSupplierController, KompasCaptchaController, AzalController, WizzAirController],
  providers: [
    SupplierAdapterRegistry,
    SupplierCacheService,
    SupplierResilienceService,
    SupplierOfferService,
    SummertourAdapter,
    SummertourNewAdapter,
    SummerSyncService,
    SummertourHttpService,
    SummerBulkSyncService,
    KompasCaptchaStore,
    KompasSupplierAdapter,
    KompasSyncService,
    TourRequestService,
    AzalAdapter,
    AzalHttpService,
    WizzAirAdapter,
    WizzAirHttpService,
    FlightSupplierRegistry,
    {
      provide: "SUPPLIER_MODULE_INIT",
		useFactory: (
		  registry: SupplierAdapterRegistry,
		  summertour: SummertourNewAdapter,
		  kompas: KompasSupplierAdapter,
          flightRegistry: FlightSupplierRegistry,
          azal: AzalAdapter,
          wizzAir: WizzAirAdapter,
		) => {
        registry.register(summertour, {
          code: "SUMMERTOUR",
          name: "Summertour",
          enabled: true,
          searchEnabled: true,
          livePriceEnabled: true,
          availabilityEnabled: true,
          maxConcurrency: 2,
          requestsPerMinute: 10,
          timeoutMs: 30_000,
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
          enabled: true,
          searchEnabled: true,
          livePriceEnabled: true,
          availabilityEnabled: true,
          maxConcurrency: 10,
          requestsPerMinute: 30,
          timeoutMs: 60_000,
          searchCacheTtlMs: 5 * 60 * 1000,
          priceCacheTtlMs: 5 * 60 * 1000,
          availabilityCacheTtlMs: 5 * 60 * 1000,
          detailCacheTtlMs: 24 * 60 * 60 * 1000,
          circuitBreakerThreshold: 10,
          circuitBreakerOpenMs: 120_000,
        });

        flightRegistry.register(azal);
        flightRegistry.register(wizzAir);
      },
      inject: [
        SupplierAdapterRegistry,
        SummertourNewAdapter,
        KompasSupplierAdapter,
        FlightSupplierRegistry,
        AzalAdapter,
        WizzAirAdapter,
      ],
    },
  ],
  exports: [SupplierAdapterRegistry, SupplierCacheService, SupplierResilienceService, SupplierOfferService, SummerSyncService, SummertourHttpService, SummerBulkSyncService, KompasSyncService, AzalAdapter, AzalHttpService, WizzAirAdapter, WizzAirHttpService, FlightSupplierRegistry],
})
export class SupplierModule {}
