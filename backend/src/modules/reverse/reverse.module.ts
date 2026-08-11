import { Module } from "@nestjs/common";
import { CapabilitiesController } from "./capabilities.controller";
import { CapabilitiesService } from "./capabilities.service";
import { RequestsController } from "./requests.controller";
import { RequestsService } from "./requests.service";
import { MatchingController } from "./matching.controller";
import { MatchingService } from "./matching.service";
import { ProposalsController } from "./proposals.controller";
import { ProposalsService } from "./proposals.service";

/**
 * PHASE 2 — Reverse Marketplace bounded context (reverse.*, ADR-0012).
 * Step 2.2A: Seller Commercial Capabilities & Destination Coverage.
 * Step 2.2B: Buyer Request Foundation (demand-led entry, buyer own-scope).
 * Step 2.2C: Matching & Distribution (server-authoritative run + Seller inbox).
 * Step 2.2D: Seller Proposal Foundation (own-scope + buyer own-request reads).
 * Read-only cross-domain reads по ID (ADR-0001) через глобальный PrismaService;
 * SecurityService — аудит. События НЕ эмитятся (нет consumer в 2.2A–2.2D;
 * 2.2E/2.2F читают состояния напрямую; explicit command — наблюдаемый trigger).
 */
@Module({
  controllers: [CapabilitiesController, RequestsController, MatchingController, ProposalsController],
  providers: [CapabilitiesService, RequestsService, MatchingService, ProposalsService],
})
export class ReverseModule {}
