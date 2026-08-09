import { Module } from "@nestjs/common";
import { CrmController } from "./crm.controller";
import { CrmService } from "./crm.service";

@Module({
  controllers: [CrmController],
  providers: [CrmService],
  // Step 1.9: CrmService — CRM-owned application service для BUYER↔Customer link
  // (SecurityModule оркестрирует, но crm.* пишет только CRM).
  exports: [CrmService],
})
export class CrmModule {}
