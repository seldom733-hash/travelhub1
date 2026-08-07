import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { ProductStatus, ProductType } from "../../generated/prisma/enums";
import { CatalogService } from "./catalog.service";

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
 * Каждый эндпоинт принадлежит только одному домену.
 */
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post("products")
  createProduct(@Body() dto: CreateProductDto) {
    return this.catalog.createProduct(dto, "api");
  }

  @Get("products")
  listProducts(@Query() query: ListProductsQuery) {
    return this.catalog.listProducts(query);
  }

  @Get("products/:id")
  getProduct(@Param("id") id: string) {
    return this.catalog.getProduct(id);
  }

  @Patch("products/:id")
  updateProduct(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.catalog.updateProduct(id, dto, "api");
  }

  @Post("products/:id/publish")
  publishProduct(@Param("id") id: string) {
    return this.catalog.publishProduct(id, "api");
  }

  @Post("products/:id/archive")
  archiveProduct(@Param("id") id: string) {
    return this.catalog.archiveProduct(id, "api");
  }

  @Get("categories")
  listCategories() {
    return this.catalog.listCategories();
  }

  @Post("categories")
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto.title);
  }

  @Get("products/:id/availability")
  listAvailability(@Param("id") id: string) {
    return this.catalog.listAvailability(id);
  }

  @Post("products/:id/availability")
  upsertAvailability(@Param("id") id: string, @Body() dto: UpsertAvailabilityDto) {
    return this.catalog.upsertAvailability(id, dto);
  }
}

export { ProductStatus };
