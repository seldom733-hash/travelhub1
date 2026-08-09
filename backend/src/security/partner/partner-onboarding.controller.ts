import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsArray, IsEmail, IsInt, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { PartnerOnboardingService, type UpdateOwnApplicationInput } from "./partner-onboarding.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import { assertNoForbiddenKeys, PARTNER_APPLICATION_FORBIDDEN_KEYS } from "../../shared/field-validation";
import type { AuthedRequest } from "../auth/jwt-auth.guard";
import type { Request } from "express";

/** Own-scope PATCH: только разрешённые поля заявителя + optimistic lock version. */
class UpdateApplicationDto implements UpdateOwnApplicationInput {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  brandName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  website?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  businessDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceCategories?: string[];

  /** Optimistic lock (CAS) — обязателен, иначе 409. */
  @Type(() => Number)
  @IsInt()
  version!: number;
}

class ReviewQueueQuery {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number;
}

class ApproveDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

class DecisionWithReasonDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}

/**
 * PHASE 1 STEP 1.10 — Partner onboarding.
 *
 * Own-scope (заявитель):
 *   GET   /api/v1/partner/application          — своя заявка + история
 *   PATCH /api/v1/partner/application          — правка DRAFT/CHANGES_REQUESTED
 *   POST  /api/v1/partner/application/submit   — submit на review
 *
 * Internal review (partner.onboarding.review):
 *   GET   /api/v1/partner/onboarding/review            — очередь
 *   GET   /api/v1/partner/onboarding/review/:id        — деталь заявки
 *   POST  /api/v1/partner/onboarding/review/:id/start  — взять в работу
 *   POST  /api/v1/partner/onboarding/review/:id/approve
 *   POST  /api/v1/partner/onboarding/review/:id/reject
 *   POST  /api/v1/partner/onboarding/review/:id/request-changes
 *
 * Заявитель НЕ может: читать чужие заявки, видеть очередь, решать свою заявку,
 * задавать partnerId/status/role (forbidden-keys + DTO whitelist).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("partner")
export class PartnerOnboardingController {
  constructor(private readonly onboarding: PartnerOnboardingService) {}

  // ── Own-scope (заявитель) ────────────────────────────────────────────────

  @Get("application")
  @RequirePermissions("partner.onboarding.read_own")
  getOwnApplication(@CurrentUser() user: AuthedRequest["user"]) {
    return this.onboarding.getOwnApplication(user.id);
  }

  @Patch("application")
  @RequirePermissions("partner.onboarding.update_own")
  updateOwnApplication(
    @Body() dto: UpdateApplicationDto,
    @CurrentUser() user: AuthedRequest["user"],
    @Req() req: Request,
  ) {
    // Raw body (не срезан ValidationPipe) — явное отклонение mass-assignment
    // (partnerId/status/userId/role/decision-поля → 422).
    assertNoForbiddenKeys(req.body, PARTNER_APPLICATION_FORBIDDEN_KEYS);
    return this.onboarding.updateOwnApplication(user.id, dto, dto.version);
  }

  @Post("application/submit")
  @RequirePermissions("partner.onboarding.submit_own")
  submitOwnApplication(@CurrentUser() user: AuthedRequest["user"]) {
    return this.onboarding.submitOwnApplication(user.id);
  }

  // ── Internal review queue ────────────────────────────────────────────────

  @Get("onboarding/review")
  @RequirePermissions("partner.onboarding.review")
  listReviewQueue(@Query() query: ReviewQueueQuery) {
    return this.onboarding.listReviewQueue(query);
  }

  @Get("onboarding/review/:id")
  @RequirePermissions("partner.onboarding.review")
  getReviewApplication(@Param("id") id: string) {
    return this.onboarding.getReviewApplication(id);
  }

  @Post("onboarding/review/:id/start")
  @RequirePermissions("partner.onboarding.review")
  startReview(@Param("id") id: string, @CurrentUser() user: AuthedRequest["user"]) {
    return this.onboarding.startReview(id, user);
  }

  @Post("onboarding/review/:id/approve")
  @RequirePermissions("partner.onboarding.review")
  approve(@Param("id") id: string, @Body() dto: ApproveDto, @CurrentUser() user: AuthedRequest["user"]) {
    return this.onboarding.approveApplication(id, user, dto.reason);
  }

  @Post("onboarding/review/:id/reject")
  @RequirePermissions("partner.onboarding.review")
  reject(@Param("id") id: string, @Body() dto: DecisionWithReasonDto, @CurrentUser() user: AuthedRequest["user"]) {
    return this.onboarding.rejectApplication(id, user, dto.reason);
  }

  @Post("onboarding/review/:id/request-changes")
  @RequirePermissions("partner.onboarding.review")
  requestChanges(@Param("id") id: string, @Body() dto: DecisionWithReasonDto, @CurrentUser() user: AuthedRequest["user"]) {
    return this.onboarding.requestChanges(id, user, dto.reason);
  }
}
