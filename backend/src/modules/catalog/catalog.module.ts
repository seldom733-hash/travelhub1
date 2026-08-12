import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
import { CatalogAccessPolicy } from "./catalog-access.policy";
import { ProductMediaService } from "./media/product-media.service";
import { MediaProcessor } from "./media/media-processor.service";
import { S3ObjectStorageService } from "./media/storage/s3-storage.service";
import { ModerationController } from "./moderation/moderation.controller";
import { ModerationService } from "./moderation/moderation.service";
import { PublicCatalogController } from "./public/public-catalog.controller";
import { PublicCatalogService } from "./public/public-catalog.service";
import { PartnerCatalogController } from "./partner/partner-catalog.controller";
import { AntiDisintermediationService } from "./anti-disintermediation/anti-disintermediation.service";
import { SellerProfileController } from "./seller/seller-profile.controller";
import { PublicSellerProfileService } from "./seller/seller-profile.service";
import { SellerProfileRepairService } from "./seller/seller-profile-repair.service";
import { StorefrontAdminController, StorefrontController } from "./storefront/storefront.controller";
import { StorefrontService } from "./storefront/storefront.service";
import { ServiceUnitsController } from "./service-units.controller";
import { ServiceUnitService } from "./service-unit.service";
import { RatePlansController } from "./rate-plans.controller";
import { RatePlanService } from "./rate-plan.service";
import { StorefrontBehavioralController } from "./behavioral/storefront-behavioral.controller";
import { StorefrontBehavioralService } from "./behavioral/storefront-behavioral.service";
import { MarketplaceBehavioralController } from "./behavioral/marketplace-behavioral.controller";
import { MarketplaceBehavioralService } from "./behavioral/marketplace-behavioral.service";

/**
 * CatalogModule — Catalog Center (Product/Category/Tariff/Availability/Media).
 * Storage абстракция (ТЗ §3): доменный сервис зависит от ObjectStorageService
 * (интерфейс), реализация — S3-compatible (S3ObjectStorageService). Для смены
 * провайдера достаточно заменить binding ниже.
 *
 * Step 1.3: CatalogAccessPolicy — единый объектный scope PARTNER для Product/Media
 * (используется CatalogService и ProductMediaService).
 *
 * Step 1.4: ModerationController/ModerationService — moderation workflow. Moderation
 * принимает решение по submission/version, а CatalogService остаётся владельцем
 * Product и выполняет разрешённые transition'ы (submit-lock/release/publish).
 *
 * Step 1.5: PublicCatalogController/PublicCatalogService — отдельный anonymous
 * public read-контур (только approved PUBLISHED version; DTO без internal полей).
 *
 * Step 1.8 (clarification): PartnerCatalogController — Partner-safe read surface
 * (ACTIVE Category Schema editor-contract; НЕ internal category_schema.read).
 *
 * Step 1.12.1: StorefrontController/StorefrontService — Partner Storefront
 * domain foundation (own-scope management + public read через PublicCatalogService).
 *
 * Step 1.8A: ServiceUnitsController/ServiceUnitService — Seller Commercial /
 * Service Unit foundation (DD-025): own-scope управление юнитами внутри Product,
 * Catalog publication authority (catalog.service_unit.publish), import identity.
 *
 * Step 1.8B: RatePlansController/RatePlanService — Tariff → canonical Rate Plan
 * foundation (DD-024/Universal Pricing): own-scope управление Rate Plans внутри
 * Product (с привязкой к ServiceUnit), category-driven basis allowlist,
 * PRICE_ON_REQUEST, soft commercial state (catalog.rate_plan.publish).
 */
@Module({
  controllers: [CatalogController, ModerationController, PublicCatalogController, PartnerCatalogController, SellerProfileController, StorefrontController, StorefrontAdminController, StorefrontBehavioralController, MarketplaceBehavioralController, ServiceUnitsController, RatePlansController],
  providers: [
    CatalogService,
    CatalogAccessPolicy,
    ProductMediaService,
    MediaProcessor,
    ModerationService,
    PublicCatalogService,
    AntiDisintermediationService,
    PublicSellerProfileService,
    SellerProfileRepairService,
    StorefrontService,
    StorefrontBehavioralService,
    MarketplaceBehavioralService,
    ServiceUnitService,
    RatePlanService,
    { provide: "ObjectStorageService", useClass: S3ObjectStorageService },
  ],
  exports: [CatalogService, CatalogAccessPolicy, ProductMediaService, PublicSellerProfileService, ServiceUnitService, RatePlanService, "ObjectStorageService"],
})
export class CatalogModule {}
