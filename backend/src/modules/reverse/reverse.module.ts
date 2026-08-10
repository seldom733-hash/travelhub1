import { Module } from "@nestjs/common";
import { CapabilitiesController } from "./capabilities.controller";
import { CapabilitiesService } from "./capabilities.service";
import { RequestsController } from "./requests.controller";
import { RequestsService } from "./requests.service";

/**
 * PHASE 2 — Reverse Marketplace bounded context (reverse.*, ADR-0012).
 * Step 2.2A: Seller Commercial Capabilities & Destination Coverage.
 * Step 2.2B: Buyer Request Foundation (demand-led entry, buyer own-scope).
 * Read-only cross-domain reads по ID (ADR-0001) через глобальный PrismaService;
 * SecurityService — аудит. События НЕ эмитятся (нет consumer в 2.2A/2.2B).
 */
@Module({
  controllers: [CapabilitiesController, RequestsController],
  providers: [CapabilitiesService, RequestsService],
})
export class ReverseModule {}
