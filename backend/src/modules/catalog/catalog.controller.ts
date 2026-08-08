import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { ProductStatus, ProductType } from "../../generated/prisma/enums";
import { CatalogService } from "./catalog.service";
import { JwtAuthGuard } from "../../security/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../security/auth/permissions.guard";
import { CurrentUser, RequirePermissions } from "../../security/auth/decorators";
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

/**
 * REST API (Phase 1): /api/v1/products → Catalog Center.
 * RBAC (Phase 2): чтение — catalog.product.read; запись — catalog.product.write;
 * публикация — catalog.product.publish (матрица: MODERATOR/ADMIN).
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post("products")
  @RequirePermissions("catalog.product.write")
  createProduct(@Body() dto: CreateProductDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.catalog.createProduct(dto, actor.username);
  }

  @Get("products")
  @RequirePermissions("catalog.product.read")
  listProducts(@Query() query: ListProductsQuery) {
    return this.catalog.listProducts(query);
  }

  @Get("products/:id")
  @RequirePermissions("catalog.product.read")
  getProduct(@Param("id") id: string) {
    return this.catalog.getProduct(id);
  }

  @Patch("products/:id")
  @RequirePermissions("catalog.product.write")
  updateProduct(@Param("id") id: string, @Body() dto: UpdateProductDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.catalog.updateProduct(id, dto, actor.username);
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
  @RequirePermissions("catalog.product.read")
  listAvailability(@Param("id") id: string) {
    return this.catalog.listAvailability(id);
  }

  @Post("products/:id/availability")
  @RequirePermissions("catalog.availability.write")
  upsertAvailability(@Param("id") id: string, @Body() dto: UpsertAvailabilityDto) {
    return this.catalog.upsertAvailability(id, dto);
  }
}

export { ProductStatus };
