import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import { IsISO8601, IsObject, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { Response } from "express";
import { Public } from "../../../security/auth/decorators";
import { NotFoundError } from "../../../shared/errors";
import { PublicCatalogService } from "./public-catalog.service";
import type { PublicMediaDerivative, PublicProductListQuery } from "./public-catalog.types";

/**
 * DTO списка публичных продуктов (server-side pagination/filter/sort).
 * f — category-specific attribute filters: ?f[days]=7&f[language]=en (требует category).
 */
export class PublicProductListDto implements PublicProductListQuery {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsObject()
  f?: Record<string, string>;

  @IsOptional()
  @IsISO8601()
  available_from?: string;
}

/** Pagination-параметры списка продуктов витрины (только page/pageSize). */
class StorefrontProductsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  pageSize?: number;
}

/**
 * Public Catalog read-contract (Phase 1 Step 1.5) — anonymous, ТОЛЬКО approved +
 * PUBLISHED version. Отдельный контур: не расширяет internal RBAC (catalog.product.read)
 * и не открывает internal /products /moderation.
 */
@Controller()
export class PublicCatalogController {
  constructor(private readonly publicCatalog: PublicCatalogService) {}

  /** Список опубликованных продуктов (карточки, server-side pagination/filter/sort). */
  @Get("public/products")
  @Public()
  listProducts(@Query() query: PublicProductListDto) {
    return this.publicCatalog.listProducts(query);
  }

  /** PDP: детали опубликованного продукта по id или стабильному public slug. */
  @Get("public/products/:id")
  @Public()
  getProductDetail(@Param("id") id: string) {
    return this.publicCatalog.getProductDetail(id);
  }

  /**
   * Стабильный public media delivery (FIX 1 review): /api/v1/public/media/:mediaId/thumb|large.
   * Card/PDP ссылаются на эти URL (никогда на signed S3). Доступна только media
   * текущей PUBLISHED версии продукта; draft/staged/unpublished → нейтральный 404.
   * Delivery layer redirect'ит (302) на короткоживущий signed URL приватного bucket
   * (proxy/CDN-стратегия может быть заменена без изменения контракта).
   */
  @Get("public/media/:mediaId/:derivative")
  @Public()
  async getMediaFile(
    @Param("mediaId") mediaId: string,
    @Param("derivative") derivative: string,
    @Res() res: Response,
  ): Promise<void> {
    if (derivative !== "thumb" && derivative !== "large") {
      throw new NotFoundError("Media not found");
    }
    const { url } = await this.publicCatalog.getPublicMediaUrl(mediaId, derivative as PublicMediaDerivative);
    res.redirect(302, url);
  }

  /** Публичные категории (только ACTIVE, без internal schema/admin полей). */
  @Get("public/categories")
  @Public()
  listCategories() {
    return this.publicCatalog.listCategories();
  }

  /** Публичная категория по slug. */
  @Get("public/categories/:slug")
  @Public()
  getCategory(@Param("slug") slug: string) {
    return this.publicCatalog.getCategory(slug);
  }

  /** Filter metadata категории (из ACTIVE Category Schema) для витрины. */
  @Get("public/categories/:slug/filters")
  @Public()
  getCategoryFilters(@Param("slug") slug: string) {
    return this.publicCatalog.getCategoryFilters(slug);
  }

  // ── Partner Storefront public read (Phase 1 Step 1.12.1 §11/§12) ─────────

  /**
   * Публичная витрина по slug (только ACTIVE; DRAFT/INACTIVE → neutral 404).
   * Whitelist DTO: id/code/slug/displayName/tagline/description/defaultLocale/
   * seller (Step 1.11 projection)/activatedAt. Без partnerId/CRM/User/private.
   */
  @Get("public/storefronts/:slug")
  @Public()
  getPublicStorefront(@Param("slug") slug: string) {
    return this.publicCatalog.getPublicStorefront(slug);
  }

  /** Опубликованные продукты витрины (server-side pagination, только свой Partner). */
  @Get("public/storefronts/:slug/products")
  @Public()
  listStorefrontProducts(@Param("slug") slug: string, @Query() query: StorefrontProductsQueryDto) {
    return this.publicCatalog.listStorefrontProductsBySlug(slug, query);
  }

  /** PDP продукта витрины; чужой/DRAFT/ARCHIVED → neutral 404. */
  @Get("public/storefronts/:slug/products/:productSlug")
  @Public()
  getStorefrontProductDetail(@Param("slug") slug: string, @Param("productSlug") productSlug: string) {
    return this.publicCatalog.getStorefrontProductDetailBySlug(slug, productSlug);
  }

  /**
   * Stable public delivery Storefront media (Step 1.12.2 §6): байты только при
   * ACTIVE + entitlement ACTIVE витрине, media принадлежит этой витрине (no IDOR).
   * Redirect (302) на короткоживущий signed URL приватного bucket.
   */
  @Get("public/storefronts/:slug/media/:mediaId")
  @Public()
  async getStorefrontMediaFile(@Param("slug") slug: string, @Param("mediaId") mediaId: string, @Res() res: Response): Promise<void> {
    const { url } = await this.publicCatalog.getPublicStorefrontMediaUrl(slug, mediaId);
    res.redirect(302, url);
  }
}
