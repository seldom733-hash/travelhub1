import { Module } from "@nestjs/common";
import { SalesController, SalesCenterController } from "./sales.controller";
import { CheckoutController } from "./checkout.controller";
import { SalesService } from "./sales.service";

/**
 * PHASE 2 STEP 2.1 — Sales Domain Foundation (новый bounded context, sales.*).
 * Владелец Sales-сущностей (Lead/Opportunity/Quote/Sale/CheckoutIntent + history).
 * Cross-domain reads по ID (ADR-0001) через глобальный PrismaService;
 * SecurityService — аудит. НЕ пишет в Catalog/CRM/Order/Booking/Finance/Security.
 */
@Module({
  controllers: [SalesController, SalesCenterController, CheckoutController],
  providers: [SalesService],
})
export class SalesModule {}
