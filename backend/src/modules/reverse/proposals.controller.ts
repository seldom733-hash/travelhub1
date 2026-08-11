import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Request } from "express";
import { ProposalsService } from "./proposals.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import {
  assertNoForbiddenKeys,
  PROPOSAL_CREATE_FORBIDDEN_KEYS,
  PROPOSAL_UPDATE_FORBIDDEN_KEYS,
  PROPOSAL_LIFECYCLE_FORBIDDEN_KEYS,
  PROPOSAL_SELECT_FORBIDDEN_KEYS,
} from "../../shared/field-validation";

class CreateProposalDto {
  @IsString()
  @IsNotEmpty()
  buyerRequestId!: string;

  @IsOptional()
  money?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  includedServices?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  exclusions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  conditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  validUntil?: string;
}

class UpdateProposalDto {
  @IsOptional()
  money?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  includedServices?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  exclusions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  conditions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  validUntil?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

class LifecycleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

/** Step 2.2F: selection-команда принимает ТОЛЬКО expectedVersion (request CAS). */
class SelectProposalDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

/**
 * PHASE 2 STEP 2.2D — Seller Proposal Foundation (seller-own + buyer-own-request).
 * Ownership: actor.partnerId / actor.customerId (единственные security sources);
 * body/query НЕ являются security source (forged sellerId/buyerRequestId/
 * distributionId/status/version/temporal/sales-conversion → 422; stale version
 * → 409; чужой id → neutral 404).
 *
 * Seller routes: /partner/reverse/proposals (own-scope, PARTNER).
 * Buyer routes:  /buyer/requests/:requestId/proposals (own-request scope).
 */
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  // ── Seller ────────────────────────────────────────────────────────────

  @Get("partner/reverse/proposals")
  @RequirePermissions("reverse.proposal.read_own")
  listOwn(@CurrentUser() actor: AuthedRequest["user"], @Query() query: ListQueryDto) {
    return this.proposals.listOwn(actor, query.limit ?? 50, query.offset ?? 0);
  }

  @Post("partner/reverse/proposals")
  @RequirePermissions("reverse.proposal.write_own")
  createOwn(@Body() dto: CreateProposalDto, @Req() req: Request, @CurrentUser() actor: AuthedRequest["user"]) {
    // Raw body — explicit deny forged ownership/distribution/lifecycle/version/temporal.
    assertNoForbiddenKeys(req.body, PROPOSAL_CREATE_FORBIDDEN_KEYS);
    return this.proposals.createOwn(actor, dto);
  }

  @Get("partner/reverse/proposals/:id")
  @RequirePermissions("reverse.proposal.read_own")
  getOwn(@CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    return this.proposals.getOwn(actor, id);
  }

  @Get("partner/reverse/proposals/:id/history")
  @RequirePermissions("reverse.proposal.read_own")
  historyOwn(@CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    return this.proposals.historyOwn(actor, id);
  }

  @Patch("partner/reverse/proposals/:id")
  @RequirePermissions("reverse.proposal.write_own")
  updateOwn(@Body() dto: UpdateProposalDto, @Req() req: Request, @CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    // Raw body — explicit deny: ownership/distribution/lifecycle/version/temporal → 422.
    assertNoForbiddenKeys(req.body, PROPOSAL_UPDATE_FORBIDDEN_KEYS);
    return this.proposals.updateOwn(actor, id, dto);
  }

  @Post("partner/reverse/proposals/:id/submit")
  @RequirePermissions("reverse.proposal.write_own")
  submitOwn(@Body() dto: LifecycleDto, @Req() req: Request, @CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    // Lifecycle-команды принимают ТОЛЬКО expectedVersion.
    assertNoForbiddenKeys(req.body, PROPOSAL_LIFECYCLE_FORBIDDEN_KEYS);
    return this.proposals.submitOwn(actor, id, dto.expectedVersion);
  }

  @Post("partner/reverse/proposals/:id/withdraw")
  @RequirePermissions("reverse.proposal.write_own")
  withdrawOwn(@Body() dto: LifecycleDto, @Req() req: Request, @CurrentUser() actor: AuthedRequest["user"], @Param("id") id: string) {
    assertNoForbiddenKeys(req.body, PROPOSAL_LIFECYCLE_FORBIDDEN_KEYS);
    return this.proposals.withdrawOwn(actor, id, dto.expectedVersion);
  }

  // ── Buyer (own-request scope) ─────────────────────────────────────────

  @Get("buyer/requests/:requestId/proposals")
  @RequirePermissions("reverse.proposal.read_own")
  listForRequest(@CurrentUser() actor: AuthedRequest["user"], @Param("requestId") requestId: string, @Query() query: ListQueryDto) {
    return this.proposals.listForRequest(actor, requestId, query.limit ?? 50, query.offset ?? 0);
  }

  @Get("buyer/requests/:requestId/proposals/:proposalId")
  @RequirePermissions("reverse.proposal.read_own")
  getForRequest(
    @CurrentUser() actor: AuthedRequest["user"],
    @Param("requestId") requestId: string,
    @Param("proposalId") proposalId: string,
  ) {
    return this.proposals.getForRequest(actor, requestId, proposalId);
  }

  // ── Step 2.2F — Buyer selection / conversion (DD-030) ────────────────

  /**
   * POST /buyer/requests/:requestId/proposals/:proposalId/select
   * Buyer (own request) выбирает Proposal → атомарная конверсия в canonical
   * Opportunity. Server derives всё (buyerId/customerId, sellerId, acquisition-
   * Source=BUYER_REQUEST, provenance, opportunityId); client передаёт ТОЛЬКО
   * expectedVersion (CAS). Forged поля → 422 (loud, §29).
   */
  @Post("buyer/requests/:requestId/proposals/:proposalId/select")
  @RequirePermissions("reverse.proposal.select_own")
  selectProposal(
    @Body() dto: SelectProposalDto,
    @Req() req: Request,
    @CurrentUser() actor: AuthedRequest["user"],
    @Param("requestId") requestId: string,
    @Param("proposalId") proposalId: string,
  ) {
    assertNoForbiddenKeys(req.body, PROPOSAL_SELECT_FORBIDDEN_KEYS);
    return this.proposals.selectProposal(actor, requestId, proposalId, dto.expectedVersion);
  }
}
