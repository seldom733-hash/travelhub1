import { Body, Controller, Delete, Get, Param, ParseEnumPipe, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request } from "express";
import { IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { StorefrontEntitlementStatus, StorefrontMediaKind } from "../../../generated/prisma/enums";
import { JwtAuthGuard } from "../../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../../security/auth/decorators";
import type { AuthedRequest } from "../../../security/auth/jwt-auth.guard";
import { assertNoForbiddenKeys, STOREFRONT_CREATE_FORBIDDEN_KEYS, STOREFRONT_UPDATE_FORBIDDEN_KEYS } from "../../../shared/field-validation";
import { SOCIAL_PLATFORMS, STOREFRONT_LOCALES, STOREFRONT_THEMES, StorefrontService, type SocialLinkInput, type StorefrontCreateInput, type StorefrontUpdateInput } from "./storefront.service";

class SocialLinkDto implements SocialLinkInput {
  @IsString()
  @IsIn(SOCIAL_PLATFORMS)
  platform!: string;

  @IsString()
  @MaxLength(500)
  url!: string;
}

class CreateStorefrontDto implements StorefrontCreateInput {
  @IsString()
  @MaxLength(60)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(STOREFRONT_LOCALES)
  defaultLocale?: string;
}

class EntitlementDto {
  @IsIn([StorefrontEntitlementStatus.ACTIVE, StorefrontEntitlementStatus.SUSPENDED, StorefrontEntitlementStatus.EXPIRED])
  status!: StorefrontEntitlementStatus;
}

class UpdateStorefrontDto implements StorefrontUpdateInput {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsIn(STOREFRONT_LOCALES)
  defaultLocale?: string;

  /** География: код города канонического справочника (принадлежит стране витрины). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cityCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  publicPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  publicEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsapp?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SocialLinkDto)
  socialLinks?: SocialLinkDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  heroHeading?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  heroSubheading?: string;

  @IsOptional()
  @IsIn(STOREFRONT_THEMES)
  themePreset?: string;
}

/**
 * Partner Storefront API (Phase 1 Step 1.12.1 §8 + 1.12.2) — PARTNER own-scope.
 *
 *   GET    /api/v1/partner/storefront             — своя витрина (404 если нет)
 *   POST   /api/v1/partner/storefront             — explicit provisioning → DRAFT
 *   PATCH  /api/v1/partner/storefront             — content/business identity (slug immutable)
 *   POST   /api/v1/partner/storefront/activate    — DRAFT/INACTIVE → ACTIVE
 *   POST   /api/v1/partner/storefront/deactivate  — ACTIVE → INACTIVE (не удаляет)
 *   POST   /api/v1/partner/storefront/media/:kind — upload/replace logo|hero (multipart)
 *   DELETE /api/v1/partner/storefront/media/:kind — удалить logo|hero
 *   GET    /api/v1/partner/storefront/media/:id/preview — short-lived signed preview (owner)
 *
 * Ownership source — ТОЛЬКО actor.partnerId (JWT). partnerId/ownerId/status/
 * countryCode/entitlement/temporal-поля из body запрещены (assertNoForbiddenKeys
 * → 422) и вырезаются DTO whitelist'ом. Публичных эндпоинтов здесь нет — отдельный
 * anonymous public контур (PublicCatalogController /public/storefronts/...).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("partner")
export class StorefrontController {
  constructor(private readonly storefronts: StorefrontService) {}

  @Get("storefront")
  @RequirePermissions("storefront.read_own")
  getOwn(@CurrentUser() actor: AuthedRequest["user"]) {
    return this.storefronts.getOwn(actor);
  }

  @Post("storefront")
  @RequirePermissions("storefront.create_own")
  create(@Body() dto: CreateStorefrontDto, @Req() req: Request, @CurrentUser() actor: AuthedRequest["user"]) {
    // Raw body (не срезан ValidationPipe) — explicit deny forged ownership/lifecycle
    // (partnerId/ownerId/status/countryCode/temporal/id/code → 422; slug в create — допустим).
    assertNoForbiddenKeys(req.body, STOREFRONT_CREATE_FORBIDDEN_KEYS);
    return this.storefronts.createOwn(actor, dto);
  }

  @Patch("storefront")
  @RequirePermissions("storefront.update_own")
  update(@Body() dto: UpdateStorefrontDto, @Req() req: Request, @CurrentUser() actor: AuthedRequest["user"]) {
    // Raw body (не срезан ValidationPipe) — explicit deny: slug immutable (PATCH),
    // ownership/lifecycle/countryCode/temporal/id/code → 422, а не silent strip/mutation.
    assertNoForbiddenKeys(req.body, STOREFRONT_UPDATE_FORBIDDEN_KEYS);
    return this.storefronts.updateOwn(actor, dto);
  }

  @Post("storefront/activate")
  @RequirePermissions("storefront.activate_own")
  activate(@CurrentUser() actor: AuthedRequest["user"]) {
    return this.storefronts.activateOwn(actor);
  }

  @Post("storefront/deactivate")
  @RequirePermissions("storefront.activate_own")
  deactivate(@CurrentUser() actor: AuthedRequest["user"]) {
    return this.storefronts.deactivateOwn(actor);
  }

  /** Upload/replace logo|hero (multipart, до 15 MB; MIME/size — MediaProcessor). */
  @Post("storefront/media/:kind")
  @RequirePermissions("storefront.update_own")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 15 * 1024 * 1024 } }))
  uploadMedia(
    @Param("kind", new ParseEnumPipe(StorefrontMediaKind)) kind: StorefrontMediaKind,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.storefronts.uploadMedia(actor, kind, file);
  }

  @Delete("storefront/media/:kind")
  @RequirePermissions("storefront.update_own")
  deleteMedia(
    @Param("kind", new ParseEnumPipe(StorefrontMediaKind)) kind: StorefrontMediaKind,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.storefronts.deleteMedia(actor, kind);
  }

  /** Owner-only preview: short-lived signed URL (не публикует витрину; staged media видна владельцу). */
  @Get("storefront/media/:mediaId/preview")
  @RequirePermissions("storefront.read_own")
  previewMedia(@Param("mediaId") mediaId: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.storefronts.signedPreviewMediaUrl(actor, mediaId);
  }
}

/**
 * Операционная команда управления Storefront entitlement (REVIEW FIX 2).
 * ADMIN (storefront.entitlement.manage). Это граница будущего Billing domain:
 * без фиктивных Payment/Invoice — только явный статус, который позже станет
 * authoritative от Billing (события). SUSPENDED/EXPIRED скрывают публичную
 * витрину (public predicate) без удаления Partner/Product/history.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class StorefrontAdminController {
  constructor(private readonly storefronts: StorefrontService) {}

  /** POST /api/v1/storefronts/:partnerId/entitlement { status: ACTIVE|SUSPENDED|EXPIRED } */
  @Post("storefronts/:partnerId/entitlement")
  @RequirePermissions("storefront.entitlement.manage")
  setEntitlement(@Param("partnerId") partnerId: string, @Body() dto: EntitlementDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.storefronts.setEntitlement(partnerId, dto.status, actor);
  }
}
