import { Controller, Get, Post, Put, Param, Body, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsArray, ValidateNested, IsString, IsBoolean, IsNumber, IsOptional } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser, RequirePermissions, Public } from "../../security/auth/decorators";
import { ConstructorService, type PageSectionInput, type PageConfigView } from "./constructor.service";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";

// ─── DTOs ────────────────────────────────────────────────────────────────────

class PageSectionInputDto implements PageSectionInput {
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

class SaveDraftDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageSectionInputDto)
  sections!: PageSectionInputDto[];
}

class SaveConfigDto {
  @IsOptional() config?: Record<string, unknown>;
}

// ─── Controller ──────────────────────────────────────────────────────────────

@Controller("constructor")
export class ConstructorController {
  constructor(private readonly service: ConstructorService) {}

  @Get("pages/:slug")
  @RequirePermissions("catalog.product.read")
  async getPage(
    @Param("slug") slug: string,
    @CurrentUser() actor: AuthedRequest["user"],
  ): Promise<PageConfigView> {
    return this.service.getPage(slug, actor.id);
  }

  @Put("pages/:slug/sections")
  @RequirePermissions("catalog.product.read")
  async saveDraft(
    @Param("slug") slug: string,
    @Body() body: SaveDraftDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ): Promise<PageConfigView> {
    return this.service.saveDraft(slug, body.sections, actor.id);
  }

  @Post("pages/:slug/publish")
  @RequirePermissions("catalog.product.read")
  async publish(
    @Param("slug") slug: string,
    @CurrentUser() actor: AuthedRequest["user"],
  ): Promise<PageConfigView> {
    return this.service.publish(slug, actor.id);
  }

  @Get("pages/:slug/preview")
  @RequirePermissions("catalog.product.read")
  async getPreview(
    @Param("slug") slug: string,
    @CurrentUser() actor: AuthedRequest["user"],
  ): Promise<PageConfigView> {
    return this.service.getPreview(slug, actor.id);
  }

  @Put("pages/:slug/header")
  @RequirePermissions("catalog.product.read")
  async saveHeaderConfig(
    @Param("slug") slug: string,
    @Body() body: SaveConfigDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ): Promise<PageConfigView> {
    return this.service.saveHeaderConfig(slug, body.config ?? {}, actor.id);
  }

  @Put("pages/:slug/hero")
  @RequirePermissions("catalog.product.read")
  async saveHeroConfig(
    @Param("slug") slug: string,
    @Body() body: SaveConfigDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ): Promise<PageConfigView> {
    return this.service.saveHeroConfig(slug, body.config ?? {}, actor.id);
  }

  @Put("pages/:slug/search-config")
  @RequirePermissions("catalog.product.read")
  async saveSearchConfig(
    @Param("slug") slug: string,
    @Body() body: SaveConfigDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ): Promise<PageConfigView> {
    return this.service.saveSearchConfig(slug, body.config ?? {}, actor.id);
  }

  @Put("pages/:slug/footer")
  @RequirePermissions("catalog.product.read")
  async saveFooterConfig(
    @Param("slug") slug: string,
    @Body() body: SaveConfigDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ): Promise<PageConfigView> {
    return this.service.saveFooterConfig(slug, body.config ?? {}, actor.id);
  }

  @Put("pages/:slug/design")
  @RequirePermissions("catalog.product.read")
  async saveDesignConfig(
    @Param("slug") slug: string,
    @Body() body: SaveConfigDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ): Promise<PageConfigView> {
    return this.service.saveDesignConfig(slug, body.config ?? {}, actor.id);
  }

  @Post("pages/:slug/media")
  @RequirePermissions("catalog.product.read")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadMedia(
    @Param("slug") slug: string,
    @UploadedFile() file: Express.Multer.File,
    @Body("kind") kind: "logo" | "hero-slide",
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.service.uploadMedia(slug, file, kind, actor.id);
  }

  /** Public endpoint: get published config (no auth required). */
  @Get("pages/:slug/published")
  @Public()
  async getPublished(
    @Param("slug") slug: string,
  ): Promise<PageConfigView | null> {
    return this.service.getPublished(slug);
  }

  @Get("blocks/:context")
  @RequirePermissions("catalog.product.read")
  getRegistry(@Param("context") context: string) {
    return this.service.getRegistry(context);
  }
}
