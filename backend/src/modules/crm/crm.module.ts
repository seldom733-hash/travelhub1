import { Module } from "@nestjs/common";
import { CrmController } from "./crm.controller";
import { CrmService } from "./crm.service";
import { MarketplacePcrAttributionConsumer } from "./marketplace-pcr-attribution.consumer";

@Module({
  // NB: FinanceModule сюда НЕ импортируем — иначе цикл модулей
  // SecurityModule → CrmModule → FinanceModule → SecurityService.
  // Авто-курсы поставщика (USD/EUR → AZN) пишет сам CrmService в своей
  // транзакции (см. seedDefaultFxRates), без внедрения SupplierFxRateService.
  controllers: [CrmController],
  providers: [CrmService, MarketplacePcrAttributionConsumer],
  // Step 1.9: CrmService — CRM-owned application service для BUYER↔Customer link
  // (SecurityModule оркестрирует, но crm.* пишет только CRM).
  // Step 3.6A: MarketplacePcrAttributionConsumer — auto-creates PCR on OrderCreated.
  exports: [CrmService],
})
export class CrmModule {}
