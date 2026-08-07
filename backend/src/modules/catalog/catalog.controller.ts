import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
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
  createCategory(@Body() dto: CreateCategoryDto, @CurrentUser() actor: AuthedRequest["user"]) {
    return this.catalog.createCategory(dto.title);
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
