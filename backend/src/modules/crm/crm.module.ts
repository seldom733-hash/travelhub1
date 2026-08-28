import { Module } from "@nestjs/common";
import { CrmController } from "./crm.controller";
import { CrmService } from "./crm.service";
import { MarketplacePcrAttributionConsumer } from "./marketplace-pcr-attribution.consumer";

@Module({
  controllers: [CrmController],
  providers: [CrmService, MarketplacePcrAttributionConsumer],
  // Step 1.9: CrmService — CRM-owned application service для BUYER↔Customer link
  // (SecurityModule оркестрирует, но crm.* пишет только CRM).
  // Step 3.6A: MarketplacePcrAttributionConsumer — auto-creates PCR on OrderCreated.
  exports: [CrmService],
})
export class CrmModule {}
