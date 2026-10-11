import { Module } from "@nestjs/common";
import { FinanceModule } from "../finance/finance.module";
import { MarkupMatrixService } from "./markup-matrix.service";
import { MarkupRuleService } from "./markup-rule.service";
import { PricingController } from "./pricing.controller";
import { SupplierPricingService } from "./supplier-pricing.service";

/**
 * Supplier Markup (STRICT PROMPT Phase 1) — Pricing domain module.
 *
 * Провайдеры экспортируются для подключения supplier-границ (aggregator /
 * refresh / sync / azal fan-out / Request) в Phase 2+: единственный путь
 * применения наценки — SupplierPricingService (NO DOUBLE MARKUP, §9).
 * Prisma/Ids/Security — глобальные. Реестры поставщиков
 * (SupplierAdapterRegistry / FlightSupplierRegistry) приходят из @Global
 * SupplierModule — циклического import НЕТ (SupplierModule импортирует
 * PricingModule, а не наоборот).
 *
 * UNIFIED FINANCE CENTER Phase 1: импорт FinanceModule даёт SupplierPricingService
 * опциональный FX-resolver (SupplierFxRateService, convert-then-markup). Цикла
 * НЕТ: FinanceModule импортирует только PaymentProviderModule (не Pricing).
 */
@Module({
  imports: [FinanceModule],
  controllers: [PricingController],
  providers: [MarkupRuleService, SupplierPricingService, MarkupMatrixService],
  exports: [MarkupRuleService, SupplierPricingService, MarkupMatrixService],
})
export class PricingModule {}
