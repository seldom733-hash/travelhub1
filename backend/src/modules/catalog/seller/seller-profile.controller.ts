import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { SellerProposalStatus, SellerVisibilityMode } from "../../../generated/prisma/enums";
import { JwtAuthGuard } from "../../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../../security/auth/decorators";
import type { AuthedRequest } from "../../../security/auth/jwt-auth.guard";
import { PublicSellerProfileService, SELLER_PROPOSAL_REASON_CODES, type SellerProposalInput, type SellerProposalListQuery } from "./seller-profile.service";
import { SellerProfileRepairService } from "./seller-profile-repair.service";

class ProposalDto implements SellerProposalInput {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  publicDisplayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  publicDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cityCode?: string;
}

class ApproveDto {
  @IsOptional()
  @IsEnum(SellerVisibilityMode)
  approvedVisibilityMode?: SellerVisibilityMode;
}

class RejectDto {
  @IsString()
  reasonCode!: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

class RepairDto {
  @IsOptional()
  dryRun?: boolean;
}

class ListProposalsQuery implements SellerProposalListQuery {
  @IsOptional()
  @IsEnum(SellerProposalStatus)
  status?: SellerProposalStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number;
}

/**
 * Seller identity API (Phase 1 Step 1.11).
 *
 * PARTNER (own-scope):
 *   GET    /partner/seller-profile                     — свой профиль + последнее предложение
 *   GET    /partner/seller-profile/proposals           — свои предложения
 *   POST   /partner/seller-profile/proposals           — создать DRAFT предложение
 *   PATCH  /partner/seller-profile/proposals/:id       — править СВОЁ DRAFT/CHANGES_REQUESTED
 *   POST   /partner/seller-profile/proposals/:id/submit — отправить на review
 *   PARTNER НЕ может self-approve и НЕ может сам переключить visibilityMode
 *   (requested всегда VERIFIED_ALIAS; PUBLIC_BRAND выдаёт MODERATOR).
 *
 * MODERATOR (seller_public_profile.*):
 *   GET    /seller-profiles/proposals                  — review queue
 *   GET    /seller-profiles/proposals/:id              — детали
 *   POST   /seller-profiles/proposals/:id/start-review
 *   POST   /seller-profiles/proposals/:id/approve      — approve_alias | approve_brand (по телу)
 *   POST   /seller-profiles/proposals/:id/reject
 *   POST   /seller-profiles/proposals/:id/request-changes
 *   POST   /seller-profiles/:partnerId/hide | /unhide — hide_identity
 *   MODERATOR НЕ получает CRM edit rights (в матрице нет crm.partner.write).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class SellerProfileController {
  constructor(
    private readonly seller: PublicSellerProfileService,
    private readonly repair: SellerProfileRepairService,
  ) {}

  /**
   * Step 1.11 REVIEW FIX 1 — явная one-time repair/migration command для legacy
   * Partners без PublicSellerProfile. НЕ startup backfill (из onModuleInit убран):
   * вызывается оператором явно, с dry-run/report и аудитом результата.
   */
  @Post("seller-profiles/repair")
  @RequirePermissions("settings.write")
  async repairLegacy(@Body() dto: RepairDto, @CurrentUser() actor: AuthedRequest["user"]) {
    const dryRun = dto.dryRun ?? false;
    const result = await this.repair.run(dryRun);
    await this.repair.auditResult(actor, result);
    return result;
  }

  // ── PARTNER: own profile / proposals ──────────────────────────────────────

  @Get("partner/seller-profile")
  @RequirePermissions("seller_public_profile.read_own")
  getOwn(@CurrentUser() actor: AuthedRequest["user"]) {
    return this.seller.getOwnProfile(actor);
  }

  @Get("partner/seller-profile/proposals")
  @RequirePermissions("seller_public_profile.read_own")
  ownProposals(@CurrentUser() actor: AuthedRequest["user"]) {
    return this.seller.ownProposals(actor);
  }

  @Post("partner/seller-profile/proposals")
  @RequirePermissions("seller_public_profile.propose")
  createProposal(@CurrentUser() actor: AuthedRequest["user"], @Body() dto: ProposalDto) {
    return this.seller.createProposal(actor, dto);
  }

  @Patch("partner/seller-profile/proposals/:id")
  @RequirePermissions("seller_public_profile.propose")
  updateProposal(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"], @Body() dto: ProposalDto) {
    return this.seller.updateProposal(actor, id, dto);
  }

  @Post("partner/seller-profile/proposals/:id/submit")
  @RequirePermissions("seller_public_profile.propose")
  submitProposal(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.seller.submitProposal(actor, id);
  }

  // ── MODERATOR: review queue ───────────────────────────────────────────────

  @Get("seller-profiles/proposals")
  @RequirePermissions("seller_public_profile.review")
  list(@Query() query: ListProposalsQuery) {
    return this.seller.listProposals(query);
  }

  @Get("seller-profiles/proposals/:id")
  @RequirePermissions("seller_public_profile.review")
  detail(@Param("id") id: string) {
    return this.seller.getProposal(id);
  }

  @Post("seller-profiles/proposals/:id/start-review")
  @RequirePermissions("seller_public_profile.review")
  startReview(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.seller.startReview(id, actor);
  }

  @Post("seller-profiles/proposals/:id/approve")
  @RequirePermissions((req: AuthedRequest) =>
    (req.body as ApproveDto | undefined)?.approvedVisibilityMode === SellerVisibilityMode.PUBLIC_BRAND
      ? ["seller_public_profile.approve_brand"]
      : ["seller_public_profile.approve_alias"],
  )
  approve(@Param("id") id: string, @Body() dto: ApproveDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.seller.approve(id, actor, dto.approvedVisibilityMode);
  }

  @Post("seller-profiles/proposals/:id/reject")
  @RequirePermissions("seller_public_profile.review")
  reject(@Param("id") id: string, @Body() dto: RejectDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.seller.reject(id, actor, dto.reasonCode, dto.comment);
  }

  @Post("seller-profiles/proposals/:id/request-changes")
  @RequirePermissions("seller_public_profile.request_changes")
  requestChanges(@Param("id") id: string, @Body() dto: RejectDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.seller.requestChanges(id, actor, dto.reasonCode, dto.comment);
  }

  @Post("seller-profiles/:partnerId/hide")
  @RequirePermissions("seller_public_profile.hide_identity")
  hide(@Param("partnerId") partnerId: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.seller.hide(partnerId, actor);
  }

  @Post("seller-profiles/:partnerId/unhide")
  @RequirePermissions("seller_public_profile.hide_identity")
  unhide(@Param("partnerId") partnerId: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.seller.unhide(partnerId, actor);
  }
}

// Reason codes экспортируются для e2e/документации контракта.
export { SELLER_PROPOSAL_REASON_CODES };
