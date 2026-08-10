import { Module } from "@nestjs/common";
import { SalesController, SalesCenterController } from "./sales.controller";
import { CheckoutController } from "./checkout.controller";
import { SalesService } from "./sales.service";
import { CatalogModule } from "../catalog/catalog.module";

/**
 * PHASE 2 STEP 2.1 — Sales Domain Foundation (новый bounded context, sales.*).
 * Владелец Sales-сущностей (Lead/Opportunity/Quote/Sale/CheckoutIntent + history).
 * Cross-domain reads по ID (ADR-0001) через глобальный PrismaService;
 * SecurityService — аудит. НЕ пишет в Catalog/CRM/Order/Booking/Finance/Security.
 *
 * Step 2.4: CatalogModule импортируется ТОЛЬКО для owner-service boundary
 * (CatalogService.reserveAvailability) — Sales НЕ пишет в catalog.* напрямую
 * (ADR-0001), а вызывает канонический owner command в общей транзакции.
 */
@Module({
  imports: [CatalogModule],
  controllers: [SalesController, SalesCenterController, CheckoutController],
  providers: [SalesService],
})
export class SalesModule {}
