import { Module, Global } from "@nestjs/common";
import { SupplierAdapterRegistry } from "./adapter/supplier-adapter.registry";
import { SupplierCacheService } from "./cache/supplier-cache.service";
import { SupplierResilienceService } from "./resilience/supplier-resilience.service";
import { SupplierOfferService } from "./supplier-offer.service";
import { SummertourAdapter } from "./summertour/summertour.adapter";
import { SummerSyncService } from "./summertour/summer-sync.service";
import { KompasSupplierAdapter } from "./kompas/kompas.adapter";
import { KompasSyncService } from "./kompas/kompas-sync.service";
import { KompasCaptchaStore } from "./kompas/kompas-captcha.store";
import { SupplierController } from "./supplier.controller";
import { PublicSupplierController } from "./public-supplier.controller";
import { KompasCaptchaController } from "./kompas/kompas-captcha.controller";
import { TourRequestService } from "./tour-request.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { EventBusModule } from "../../eventbus/eventbus.module";

/**
 * Supplier module — registers adapters, cache, resilience, service, sync.
 *
 * Adapters are registered at module init. Summertour and KOMPAS are registered.
 * SummerSyncService handles idempotent Product creation from supplier data.
 */
@Global()
@Module({
  imports: [PrismaModule, EventBusModule],
  controllers: [SupplierController, PublicSupplierController, KompasCaptchaController],
  providers: [
    SupplierAdapterRegistry,
    SupplierCacheService,
    SupplierResilienceService,
    SupplierOfferService,
    SummertourAdapter,
    SummerSyncService,
    KompasCaptchaStore,
    KompasSupplierAdapter,
    KompasSyncService,
    TourRequestService,
    {
      provide: "SUPPLIER_MODULE_INIT",
      useFactory: (
        registry: SupplierAdapterRegistry,
        summertour: SummertourAdapter,
        kompas: KompasSupplierAdapter,
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
          circuitBreakerThreshold: 5,
          circuitBreakerOpenMs: 60_000,
        });
      },
      inject: [SupplierAdapterRegistry, SummertourAdapter, KompasSupplierAdapter],
    },
  ],
  exports: [SupplierAdapterRegistry, SupplierCacheService, SupplierResilienceService, SupplierOfferService, SummerSyncService, KompasSyncService],
})
export class SupplierModule {}
