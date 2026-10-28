import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser, Public, RequirePermissions } from "../../security/auth/decorators";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { ConstructorService, type PageSectionInput } from "./constructor.service";

class StorefrontSectionDto implements PageSectionInput {
  @IsString() blockType!: string;
  @IsString() blockInstanceId!: string;
  @IsNumber() sortOrder!: number;
  @IsBoolean() enabled!: boolean;
  @IsOptional() settings?: Record<string, unknown>;
  @IsOptional() style?: Record<string, unknown>;
  @IsOptional() responsive?: Record<string, unknown>;
  @IsOptional() dataSource?: Record<string, unknown>;
  @IsOptional() visibility?: Record<string, unknown> | null;
  @IsOptional() localeContent?: Record<string, unknown>;
}

class SaveStorefrontDraftDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StorefrontSectionDto)
  sections!: StorefrontSectionDto[];
}

class SaveSeoDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class SaveDesignDto {
  @IsOptional()
  @IsString()
  accentColor?: string;

  @IsOptional()
  @IsString()
  fontFamily?: string;
}

class CreatePageDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;
}

/**
 * Partner Storefront site builder.
 *
 * Reuses the same versioned constructor page/audit pipeline as the marketplace
 * home, but the tenant is ALWAYS actor.partnerId (never request body). Access
 * is gated by storefront.read_own / storefront.update_own.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("partner/storefront/builder")
export class StorefrontBuilderController {
  constructor(private readonly svc: ConstructorService) {}

  @Get()
  @RequirePermissions("storefront.read_own")
  getPage(@Query("pageId") pageId: string | undefined, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.svc.getStorefrontBuilderPage(actor, pageId);
  }

  @Get("pages")
  @RequirePermissions("storefront.read_own")
  listPages(@CurrentUser() actor: AuthedRequest["user"]) {
    return this.svc.listStorefrontPages(actor);
  }

  @Post("pages")
  @RequirePermissions("storefront.update_own")
  createPage(@Body() body: CreatePageDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.svc.createStorefrontPage(actor, body);
  }

  @Get("registry")
  @RequirePermissions("storefront.read_own")
  getRegistry() {
    return this.svc.getRegistry("storefront");
  }

  @Get("preview")
  @RequirePermissions("storefront.read_own")
  getPreview(@Query("pageId") pageId: string | undefined, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.svc.getStorefrontPreview(actor, pageId);
  }

  @Put("sections")
  @RequirePermissions("storefront.update_own")
  saveDraft(@Body() body: SaveStorefrontDraftDto, @Query("pageId") pageId: string | undefined, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.svc.saveStorefrontDraft(actor, body.sections, pageId);
  }

  @Put("seo")
  @RequirePermissions("storefront.update_own")
  saveSeo(@Body() body: SaveSeoDto, @Query("pageId") pageId: string | undefined, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.svc.saveStorefrontSeo(actor, body, pageId);
  }

  @Put("design")
  @RequirePermissions("storefront.update_own")
  saveDesign(@Body() body: SaveDesignDto, @Query("pageId") pageId: string | undefined, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.svc.saveStorefrontDesign(actor, body, pageId);
  }

  @Post("publish")
  @RequirePermissions("storefront.update_own")
  publish(@Query("pageId") pageId: string | undefined, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.svc.publishStorefront(actor, pageId);
  }
}

/** Anonymous published page contract. Drafts are never returned here. */
@Controller()
export class StorefrontPagePublicController {
  constructor(private readonly pageService: ConstructorService) {}

  @Get("public/storefronts/:slug/page")
  @Public()
  async getPublishedPage(@Param("slug") slug: string, @Query("pageSlug") pageSlug?: string) {
    const page = await this.pageService.getPublishedStorefrontPage(slug, pageSlug || "home");
    if (!page) return { page: null };
    // Public whitelist: never expose tenantId, internal page id or version
    // bookkeeping. The public slug is the Storefront slug, not constructor key.
    const { id: _id, tenantId: _tenantId, currentVersion: _currentVersion, draftVersion: _draftVersion, ...safe } = page;
    return { page: { ...safe, slug, context: "storefront" } };
  }

  @Get("public/storefronts/:slug/pages")
  @Public()
  listPages(@Param("slug") slug: string) {
    return this.pageService.listPublicStorefrontPages(slug);
  }
}
