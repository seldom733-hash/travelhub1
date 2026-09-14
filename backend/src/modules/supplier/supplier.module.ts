import { Module, Global } from "@nestjs/common";
import { SupplierAdapterRegistry } from "./adapter/supplier-adapter.registry";
import { SupplierCacheService } from "./cache/supplier-cache.service";
import { SupplierResilienceService } from "./resilience/supplier-resilience.service";
import { SupplierOfferService } from "./supplier-offer.service";
import { SummertourAdapter } from "./summertour/summertour.adapter";
import { SupplierController } from "./supplier.controller";

/**
 * Supplier module — registers adapters, cache, resilience, service.
 *
 * Adapters are registered at module init. No production providers yet.
 * Summertour is the first adapter (Mode A: Dynamic Supplier Inventory).
 */
@Global()
@Module({
  controllers: [SupplierController],
  providers: [
    SupplierAdapterRegistry,
    SupplierCacheService,
    SupplierResilienceService,
    SupplierOfferService,
    SummertourAdapter,
    {
      provide: "SUPPLIER_MODULE_INIT",
      useFactory: (registry: SupplierAdapterRegistry, summertour: SummertourAdapter) => {
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
      },
      inject: [SupplierAdapterRegistry, SummertourAdapter],
    },
  ],
  exports: [SupplierAdapterRegistry, SupplierCacheService, SupplierResilienceService, SupplierOfferService],
})
export class SupplierModule {}
