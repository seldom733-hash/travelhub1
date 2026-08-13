import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { ProductStatus, ProductType, PublicationChannel, RoleCode } from "../../generated/prisma/enums";
import { CatalogService } from "./catalog.service";
import { ProductMediaService } from "./media/product-media.service";
import { ValidationDomainError } from "../../shared/errors";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, Public, RequirePermissions } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";

class TariffDto {
  @IsString()
  name!: string;

  @IsNumber()
  price!: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

class CreateProductDto {
  @IsEnum(ProductType)
  type!: ProductType;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TariffDto)
  tariffs?: TariffDto[];

  // Step 1.1: категория + category-specific attributes (валидируются в сервисе по ACTIVE schema).
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  // Step 2.8A: commercial service timezone (IANA ID, server-валидируется в сервисе).
  @IsOptional()
  @IsString()
  @MaxLength(64)
  serviceTimeZone?: string;

  // Step 1.3: explicit ownership override — ТОЛЬКО для staff/ADMIN (catalog.product.write),
  // аудируется. PARTNER: значение ИГНОРИРУЕТСЯ (scope берётся из actor context).
  @IsOptional()
  @IsString()
  partnerId?: string;

  @IsOptional()
  @IsString()
  ownershipReason?: string;
}

class SetChannelsDto {
  // Step 1.12.1 REVIEW FIX 3/4: явные каналы публикации canonical Product.
  @IsArray()
  @IsEnum(PublicationChannel, { each: true })
  channels!: PublicationChannel[];
}

class UpdateProductDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TariffDto)
  tariffs?: TariffDto[];

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  serviceTimeZone?: string;
}

class ListProductsQuery {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

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

  // Step 1.8 (Partner Cabinet): server-side фильтры/сортировка My Products.
  @IsOptional()
  @IsString()
  categoryId?: string;

  /** Lifecycle-фильтр: draft | in_moderation | changes_requested | published | archived. */
  @IsOptional()
  @IsString()
  filter?: string;

  /** Сортировка: updated_desc (default) | updated_asc | created_desc | title_asc. */
  @IsOptional()
  @IsString()
  sort?: string;
}

class CreateCategoryDto {
  @IsString()
  title!: string;

  // Стабильный технический identifier: обязателен, не выводится из title.
  @IsString()
  slug!: string;
}

class UpdateCategoryDto {
  @IsString()
  title!: string;
}

class CreateCategorySchemaDto {
  @IsString()
  categoryId!: string;

  @IsArray()
  attributes!: unknown[];

  @IsOptional()
  @IsObject()
  availability?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  tariffRules?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  mediaRequirements?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pdpSections?: string[];
}

class UpdateCategorySchemaDto {
  @IsArray()
  attributes!: unknown[];

  @IsOptional()
  @IsObject()
  availability?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  tariffRules?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  mediaRequirements?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pdpSections?: string[];
}

class UpsertAvailabilityDto {
  @IsOptional()
  @IsString()
  tariffId?: string;

  @IsString()
  date!: string;

  @IsNumber()
  slotsTotal!: number;
}

class UpdateMediaDto {
  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  altText?: string;
}

class ReorderMediaDto {
  @IsArray()
  @IsString({ each: true })
  orderedIds!: string[];
}

/**
 * REST API (Phase 1): /api/v1/products → Catalog Center.
 * RBAC (Phase 2 + Step 1.3): объектный scope PARTNER проверяется на backend:
 *  - PARTNER читает/пишет ТОЛЬКО свои Product (read_own/update_own_draft/create_own);
 *  - MODERATOR — moderation-read (read_for_moderation), без write за PARTNER;
 *  - staff/ADMIN — catalog.product.read / catalog.product.write (explicit permissions);
 *  - публикация/архивация — catalog.product.publish (PARTNER не имеет → 403).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly media: ProductMediaService,
  ) {}

  /**
   * Создание Product: PARTNER — catalog.product.create_own (draft, partnerId из актора);
   * staff/ADMIN — catalog.product.write (+ explicit partnerId ownership override, аудируется).
   */
  @Post("products")
  @RequirePermissions((req: AuthedRequest) =>
    req.user.role === RoleCode.PARTNER ? ["catalog.product.create_own"] : ["catalog.product.write"],
  )
  createProduct(@Body() dto: CreateProductDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.catalog.createProduct(dto, actor);
  }

  @Get("products")
  @RequirePermissions(productReadScope)
  listProducts(@Query() query: ListProductsQuery, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.catalog.listProducts(query, actor);
  }

  @Get("products/:id")
  @RequirePermissions(productReadScope)
  getProduct(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.catalog.getProduct(id, actor);
  }

  @Patch("products/:id")
  @RequirePermissions((req: AuthedRequest) =>
    req.user.role === RoleCode.PARTNER ? ["catalog.product.update_own_draft"] : ["catalog.product.write"],
  )
  updateProduct(@Param("id") id: string, @Body() dto: UpdateProductDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.catalog.updateProduct(id, dto, actor);
  }

  /**
   * Step 1.12.1 REVIEW FIX 3/4: явные каналы публикации canonical Product
   * (MARKETPLACE / PARTNER_STOREFRONT). PARTNER — только свои Product (own-scope);
   * каналы отделены от lifecycle; изменение аудируется (ProductHistory).
   */
  @Put("products/:id/channels")
  @RequirePermissions("catalog.product.channels_own")
  setChannels(@Param("id") id: string, @Body() dto: SetChannelsDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.catalog.setProductChannels(id, dto.channels as unknown as string[], actor);
  }

  @Post("products/:id/publish")
  @RequirePermissions("catalog.product.publish")
  publishProduct(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.catalog.publishProduct(id, actor.username);
  }

  @Post("products/:id/archive")
  @RequirePermissions("catalog.product.publish")
  archiveProduct(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.catalog.archiveProduct(id, actor.username);
  }

  @Get("categories")
  @RequirePermissions("catalog.product.read")
  listCategories() {
    return this.catalog.listCategories();
  }

  @Post("categories")
  @RequirePermissions("catalog.category.write")
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto.title, dto.slug);
  }

  @Patch("categories/:id")
  @RequirePermissions("catalog.category.write")
  updateCategory(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.catalog.updateCategoryTitle(id, dto.title);
  }

  // ── Category Schema (Step 1.1) ─────────────────────────────────────────────

  @Get("category-schemas")
  @RequirePermissions("catalog.category_schema.read")
  listCategorySchemas(@Query("categoryId") categoryId?: string) {
    return this.catalog.listCategorySchemas(categoryId);
  }

  @Get("category-schemas/:id")
  @RequirePermissions("catalog.category_schema.read")
  getCategorySchema(@Param("id") id: string) {
    return this.catalog.getCategorySchema(id);
  }

  @Post("category-schemas")
  @RequirePermissions("catalog.category_schema.write")
  createCategorySchema(@Body() dto: CreateCategorySchemaDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.catalog.createCategorySchema({
      categoryId: dto.categoryId,
      config: {
        attributes: dto.attributes,
        availability: dto.availability,
        tariffRules: dto.tariffRules,
        mediaRequirements: dto.mediaRequirements,
        pdpSections: dto.pdpSections,
      },
      actorId: actor.username,
    });
  }

  @Patch("category-schemas/:id")
  @RequirePermissions("catalog.category_schema.write")
  updateCategorySchema(@Param("id") id: string, @Body() dto: UpdateCategorySchemaDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.catalog.updateCategorySchema(id, {
      config: {
        attributes: dto.attributes,
        availability: dto.availability,
        tariffRules: dto.tariffRules,
        mediaRequirements: dto.mediaRequirements,
        pdpSections: dto.pdpSections,
      },
      actorId: actor.username,
    });
  }

  @Post("category-schemas/:id/activate")
  @RequirePermissions("catalog.category_schema.write")
  activateCategorySchema(@Param("id") id: string) {
    return this.catalog.activateCategorySchema(id);
  }

  @Post("category-schemas/:id/deprecate")
  @RequirePermissions("catalog.category_schema.write")
  deprecateCategorySchema(@Param("id") id: string) {
    return this.catalog.deprecateCategorySchema(id);
  }

  @Get("products/:id/availability")
  @RequirePermissions(productReadScope)
  listAvailability(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.catalog.listAvailability(id, actor);
  }

  @Post("products/:id/availability")
  @RequirePermissions("catalog.availability.write")
  upsertAvailability(@Param("id") id: string, @Body() dto: UpsertAvailabilityDto) {
    return this.catalog.upsertAvailability(id, dto);
  }

  // ── ProductMedia (Step 1.2) ────────────────────────────────────────────────
  // RBAC Matrix §3.1: PARTNER — только собственные Product (object scope в сервисе);
  // ADMIN — любые; MODERATOR — read_for_moderation (без write за PARTNER).

  @Post("products/:id/media")
  @RequirePermissions("catalog.media.upload_own")
  @UseInterceptors(FilesInterceptor("files", 20, { limits: { fileSize: 15 * 1024 * 1024 } }))
  uploadMedia(
    @Param("id") id: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.media.uploadMedia(id, files ?? [], actor);
  }

  @Get("products/:id/media")
  @RequirePermissions(productReadScope)
  listMedia(@Param("id") id: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.media.listMedia(id, actor);
  }

  @Patch("products/:id/media/:mediaId")
  @RequirePermissions("catalog.media.update_own")
  updateMedia(
    @Param("id") id: string,
    @Param("mediaId") mediaId: string,
    @Body() dto: UpdateMediaDto,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.media.updateMedia(id, mediaId, dto, actor);
  }

  @Delete("products/:id/media/:mediaId")
  @RequirePermissions("catalog.media.delete_own")
  deleteMedia(@Param("id") id: string, @Param("mediaId") mediaId: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.media.deleteMedia(id, mediaId, actor);
  }

  @Post("products/:id/media/:mediaId/set-primary")
  @RequirePermissions("catalog.media.set_primary_own")
  setPrimary(@Param("id") id: string, @Param("mediaId") mediaId: string, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.media.setPrimary(id, mediaId, actor);
  }

  @Post("products/:id/media/reorder")
  @RequirePermissions("catalog.media.reorder_own")
  reorderMedia(@Param("id") id: string, @Body() dto: ReorderMediaDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.media.reorder(id, dto.orderedIds, actor);
  }

  @Post("products/:id/media/:mediaId/replace")
  @RequirePermissions("catalog.media.update_own")
  @UseInterceptors(FilesInterceptor("file", 1, { limits: { fileSize: 15 * 1024 * 1024 } }))
  replaceMedia(
    @Param("id") id: string,
    @Param("mediaId") mediaId: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    const file = files && files.length > 0 ? files[0] : undefined;
    if (!file) throw new ValidationDomainError("Missing file");
    return this.media.replaceMedia(id, mediaId, file, actor);
  }

  @Post("products/:id/media/:mediaId/preview")
  // Владелец (update_own) или модератор (read_for_moderation).
  @RequirePermissions((req: AuthedRequest) =>
    req.user.permissions.includes("catalog.media.read_for_moderation") ? ["catalog.media.read_for_moderation"] : ["catalog.media.update_own"],
  )
  signedPreview(
    @Param("id") id: string,
    @Param("mediaId") mediaId: string,
    @Query("derivative") derivative: "original" | "large" | "thumb" | undefined,
    @CurrentUser() actor: AuthedRequest["user"],
  ) {
    return this.media.signedPreviewUrl(id, mediaId, actor, derivative ?? "large");
  }

}

/**
 * Права чтения Product/Media по контуру роли (Step 1.3 §11 — раздельные контуры,
 * без единого unrestricted read): PARTNER → read_own; MODERATOR → read_for_moderation;
 * staff/ADMIN/BUYER → catalog.product.read.
 */
function productReadScope(req: AuthedRequest): string[] {
  if (req.user.role === RoleCode.PARTNER) return ["catalog.product.read_own"];
  if (req.user.role === RoleCode.MODERATOR) return ["catalog.product.read_for_moderation"];
  return ["catalog.product.read"];
}

export { ProductStatus };
