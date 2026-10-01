import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { ModerationSubmissionStatus, RoleCode } from "../../../generated/prisma/enums";
import { ModerationService, MODERATION_REASON_CODES, type ModerationListQuery } from "./moderation.service";
import { DictionaryModerationService } from "./dictionary-moderation.service";
import { JwtAuthGuard } from "../../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../../security/auth/decorators";
import type { AuthedRequest } from "../../../security/auth/jwt-auth.guard";

class AssignDto {
  @IsString()
  moderatorId!: string;
}

class RejectDto {
  @IsString()
  reasonCode!: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

class ListSubmissionsQuery implements ModerationListQuery {
  @IsOptional()
  @IsEnum(ModerationSubmissionStatus)
  status?: ModerationSubmissionStatus;

  @IsOptional()
  @IsString()
  partnerId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  assignedModeratorId?: string;

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

class EditorialUnitDto {
  @IsString()
  id!: string;

  @IsString() @MaxLength(200)
  name!: string;
}

class EditorialMediaDto {
  @IsString()
  id!: string;

  @IsOptional() @IsString() @MaxLength(500)
  caption?: string;

  @IsOptional() @IsString() @MaxLength(500)
  altText?: string;
}

/** Editorial-правка модератора: только контент-поля, БЕЗ цен (решение №3). */
class EditorialPatchDto {
  @IsOptional() @IsString() @MaxLength(300)
  title?: string;

  @IsOptional() @IsString() @MaxLength(10_000)
  description?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => EditorialUnitDto)
  units?: EditorialUnitDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => EditorialMediaDto)
  media?: EditorialMediaDto[];

  @IsOptional() @IsString() @MaxLength(1000)
  comment?: string;
}

class DictionaryMergeDto {
  @IsString()
  targetId!: string;
}

class DictionaryRejectDto {
  @IsOptional() @IsString() @MaxLength(1000)
  comment?: string;
}

/**
 * Moderation API (Phase 1 Step 1.4): /api/v1/moderation/submissions + submit/history.
 *
 * RBAC:
 *  - submit: PARTNER (catalog.product.submit_moderation) — только свой Product;
 *  - queue/detail/assign/start-review: MODERATOR (moderation.review);
 *  - approve: MODERATOR (moderation.approve); reject: (moderation.reject);
 *    request-changes: (moderation.request_changes);
 *  - history: PARTNER (свой) / MODERATOR / staff (read);
 *  - PARTNER не видит queue; MODERATOR не имеет direct publish (нет права).
 *  - ADMIN — через explicit permissions (имеет все moderation-права + publish).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ModerationController {
  constructor(
    private readonly moderation: ModerationService,
    private readonly dictionary: DictionaryModerationService,
  ) {}

  // ── Submit (PARTNER: свой Product) ─────────────────────────────────────────

  @Post("products/:id/submit-moderation")
  @RequirePermissions("catalog.product.submit_moderation")
  submit(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.moderation.submit(id, actor);
  }

  @Get("products/:id/moderation")
  @RequirePermissions((req: AuthedRequest) => {
    // PARTNER (read_own) — только свой history; MODERATOR — read_for_moderation;
    // staff/ADMIN — catalog.product.read.
    if (req.user.role === RoleCode.PARTNER) return ["catalog.product.read_own"];
    if (req.user.role === RoleCode.MODERATOR) return ["catalog.product.read_for_moderation"];
    return ["catalog.product.read"];
  })
  history(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.moderation.historyForProduct(id, actor);
  }

  // ── Queue (MODERATOR only) ─────────────────────────────────────────────────

  @Get("moderation/submissions")
  @RequirePermissions("moderation.review")
  list(@Query() query: ListSubmissionsQuery) {
    return this.moderation.list(query);
  }

  @Get("moderation/submissions/:id")
  @RequirePermissions("moderation.review")
  detail(@Param("id") id: string) {
    return this.moderation.getById(id);
  }

  // ── Assignment / start review ──────────────────────────────────────────────

  @Post("moderation/submissions/:id/assign")
  @RequirePermissions("moderation.review")
  assign(@Param("id") id: string, @Body() dto: AssignDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.moderation.assign(id, dto.moderatorId, actor);
  }

  @Post("moderation/submissions/:id/start-review")
  @RequirePermissions("moderation.review")
  startReview(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.moderation.startReview(id, actor);
  }

  // ── Decisions ──────────────────────────────────────────────────────────────

  @Post("moderation/submissions/:id/approve")
  @RequirePermissions("moderation.approve")
  approve(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.moderation.approve(id, actor);
  }

  @Post("moderation/submissions/:id/reject")
  @RequirePermissions("moderation.reject")
  reject(@Param("id") id: string, @Body() dto: RejectDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.moderation.reject(id, actor, dto.reasonCode, dto.comment);
  }

  @Post("moderation/submissions/:id/request-changes")
  @RequirePermissions("moderation.request_changes")
  requestChanges(@Param("id") id: string, @Body() dto: RejectDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.moderation.requestChanges(id, actor, dto.reasonCode, dto.comment);
  }

  /**
   * Editorial-правка карточки продукта во время review (без цен): whitelist
   * title/description/имена компонентов/подписи media (решение №3 плана).
   */
  @Patch("moderation/submissions/:id/editorial")
  @RequirePermissions("moderation.review")
  editorialPatch(@Param("id") id: string, @Body() dto: EditorialPatchDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.moderation.editorialPatch(id, actor, dto);
  }

  // ── Dictionary entries queue (типы номеров/видов конструктора) ─────────────

  @Get("moderation/dictionary-entries")
  @RequirePermissions("moderation.review")
  listDictionaryEntries(@Query("type") type: string | undefined, @Query("status") status: string | undefined) {
    return this.dictionary.list(type ?? "", status);
  }

  @Post("moderation/dictionary-entries/:type/:id/approve")
  @RequirePermissions("moderation.approve")
  approveDictionaryEntry(@Param("type") type: string, @Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.dictionary.approve(type, id, actor);
  }

  @Post("moderation/dictionary-entries/:type/:id/merge")
  @RequirePermissions("moderation.approve")
  mergeDictionaryEntry(
    @Param("type") type: string,
    @Param("id") id: string,
    @Body() dto: DictionaryMergeDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.dictionary.merge(type, id, dto.targetId, actor);
  }

  @Post("moderation/dictionary-entries/:type/:id/reject")
  @RequirePermissions("moderation.reject")
  rejectDictionaryEntry(
    @Param("type") type: string,
    @Param("id") id: string,
    @Body() dto: DictionaryRejectDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.dictionary.reject(type, id, actor, dto.comment);
  }
}

// Reason codes экспортируются для e2e/документации контракта.
export { MODERATION_REASON_CODES };
