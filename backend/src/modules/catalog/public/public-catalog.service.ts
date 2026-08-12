/**
 * PublicCatalogService (Phase 1 Step 1.5) — безопасный anonymous public read-контур
 * Catalog для будущей витрины TravelHub. ОТДЕЛЬНЫЙ read-contract: НЕ расширяет
 * internal RBAC (catalog.product.read и т.п.), НЕ сериализует Prisma-строки.
 *
 * Главный invariant:
 *   PUBLIC → только approved + PUBLISHED version
 *   PUBLIC ✕ DRAFT / ProductDraft N+1 / SUBMITTED / IN_REVIEW / moderation snapshot
 *   PUBLIC ✕ staged (DRAFT) media / storage keys / private S3 info
 *   PUBLIC ✕ internal Partner/CRM данные
 *
 * PUBLISHED N + ProductDraft N+1 → public всегда N до approve N+1 (draft НЕ
 * участвует в запросах/мапперах — публикация N+1 только через controlled publish).
 *
 * Media delivery (§6, FIX 1 review): Card/PDP отдают СТАБИЛЬНЫЕ public URL
 * (/api/v1/public/media/:mediaId/thumb|large) — никогда signed S3 URL. Delivery
 * layer сам решает proxy/redirect/CDN strategy (здесь — short-lived signed redirect
 * на приватный bucket при фактическом запросе файла). Moderation preview остаётся
 * на ОТДЕЛЬНОМ short-lived signed контракте (ProductMediaService.signedPreviewUrl).
 * Price (§11): Catalog-owned tariffs (min tariff = priceFrom); no price → null,
 * никогда не подставляется 0. Availability (§12): только существующие строки
 * Availability (discovery-read, не Booking).
 */
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotFoundError, ValidationDomainError } from "../../../shared/errors";
import { SIGNED_URL_TTL_SECONDS } from "../media/product-media.service";
import type { ObjectStorageService } from "../media/storage/storage.interface";
import type { AttributeDef } from "../category-schema.validation";
import {
  PUBLIC_CARD_DESCRIPTION_LIMIT,
  PUBLIC_DEFAULT_PAGE_SIZE,
  PUBLIC_MAX_PAGE_SIZE,
  PUBLIC_SORT_MODES,
  type PublicAvailabilitySummary,
  type PublicCategory,
  type PublicFilterMetadata,
  type PublicFilterOption,
  type PublicMedia,
  type PublicMediaDerivative,
  type PublicProductCard,
  type PublicProductDetail,
  type PublicProductListQuery,
  type PublicProductListResult,
  type PublicSeller,
  type PublicStorefront,
} from "./public-catalog.types";

type PublicSortMode = (typeof PUBLIC_SORT_MODES)[number];

interface PublicMediaRow {
  id: string;
  type: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
  isPrimary: boolean;
  caption: string | null;
  altText: string | null;
  thumbnailStorageKey: string;
  largeStorageKey: string;
}

interface PublicTariffRow {
  id: string;
  name: string;
  price: Prisma.Decimal;
  currency: string;
  validFrom: Date | null;
  validTo: Date | null;
  /** Step 1.8B: FIXED — bindable цена; PRICE_ON_REQUEST — inquiry-only (цена не выводится). */
  pricingMode: string;
}

interface PublicProductRow {
  id: string;
  code: string;
  slug: string;
  title: string;
  description: string | null;
  type: string;
  publishedAt: Date | null;
  partnerId: string | null;
  attributes: Prisma.JsonValue | null;
  version: number;
  category: { id: string; slug: string; title: string } | null;
  tariffs: PublicTariffRow[];
  media: PublicMediaRow[];
  /** Только при detail-include (PDP); card-запросы его не содержат. */
  availability?: Array<{ date: Date; slotsTotal: number; slotsBooked: number; slotsReserved: number }>;
}

@Injectable()
export class PublicCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject("ObjectStorageService") private readonly storage: ObjectStorageService,
  ) {}

  // ── Visibility predicate (§3/§16/§17) ────────────────────────────────────
  // Только approved PUBLISHED version с опубликованной датой. DRAFT/COMPLETE/
  // REVIEWED/CHANGED/ARCHIVED и ProductDraft N+1 невидимы by construction.
  // Step 1.12.1 REVIEW FIX 4: публичная видимость дополнительно зависит от
  // publication channel — Marketplace показывает только MARKETPLACE-enabled Product.

  /** Публичная видимость Product: status=PUBLISHED && publishedAt установлен. */
  static isPubliclyVisible(status: string | null | undefined, publishedAt: Date | null | undefined): boolean {
    return status === "PUBLISHED" && publishedAt !== null && publishedAt !== undefined;
  }

  /** Базовый where публичного контура Marketplace: lifecycle + MARKETPLACE channel. */
  private marketplaceWhere(): Prisma.ProductWhereInput {
    return {
      status: "PUBLISHED",
      publishedAt: { not: null },
      publicationChannels: { some: { channel: "MARKETPLACE" } },
    };
  }

  /** Базовый where публичного контура Storefront: lifecycle + STOREFRONT channel. */
  private storefrontWhere(): Prisma.ProductWhereInput {
    return {
      status: "PUBLISHED",
      publishedAt: { not: null },
      publicationChannels: { some: { channel: "PARTNER_STOREFRONT" } },
    };
  }

  /**
   * Базовый where публичного контура (legacy alias): lifecycle + хотя бы один
   * канал (product с нулём каналов публично нигде не существует).
   */
  private publicWhere(): Prisma.ProductWhereInput {
    return {
      status: "PUBLISHED",
      publishedAt: { not: null },
      publicationChannels: { some: {} },
    };
  }

  /** Общий include карточки (Card): category + tariffs + только PUBLISHED media. */
  private productInclude() {
    return {
      category: { select: { id: true, slug: true, title: true } },
      // Step 1.8B: публично ACTIVE Rate Plans (ARCHIVED скрыт — soft commercial
      // discontinuation §25) под eligible родительской цепочкой (§30/§42):
      //  - legacy product-only план (без unit) — публичен;
      //  - план на ServiceUnit — публичен только если unit PUBLISHED
      //    (DRAFT/ARCHIVED unit → план не публикуется; единый publication engine
      //    1.8A §15 — без второго lifecycle);
      //  - PRICE_ON_REQUEST виден как inquiry-only offer (price:null в маппере),
      //    но НЕ вносит цену в priceFrom/sort (Universal §9/§13 — §22 fix).
      tariffs: {
        where: {
          status: "ACTIVE",
          OR: [{ serviceUnitId: null }, { serviceUnit: { status: "PUBLISHED" } }],
        },
        select: { id: true, name: true, price: true, currency: true, validFrom: true, validTo: true, pricingMode: true },
      },
      media: {
        where: { status: "PUBLISHED" },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          type: true,
          mimeType: true,
          width: true,
          height: true,
          sortOrder: true,
          isPrimary: true,
          caption: true,
          altText: true,
          thumbnailStorageKey: true,
          largeStorageKey: true,
        },
      },
    } satisfies Prisma.ProductInclude;
  }

  /** Общий include детали (PDP): Card + availability (только PUBLISHED media). */
  private productDetailInclude() {
    return {
      ...this.productInclude(),
      // Step 1.8B: публично ACTIVE Rate Plans под eligible unit (см. productInclude);
      // POR остаётся видим как inquiry-only (price:null), FIXED — с ценой.
      tariffs: {
        orderBy: { createdAt: "asc" },
        where: {
          status: "ACTIVE",
          OR: [{ serviceUnitId: null }, { serviceUnit: { status: "PUBLISHED" } }],
        },
        select: { id: true, name: true, price: true, currency: true, validFrom: true, validTo: true, pricingMode: true },
      },
      availability: { orderBy: { date: "asc" }, take: 60, select: { date: true, slotsTotal: true, slotsBooked: true, slotsReserved: true } },
    } satisfies Prisma.ProductInclude;
  }

  // ── Public Product list (§8/§9/§10) ───────────────────────────────────────

  async listProducts(query: PublicProductListQuery): Promise<PublicProductListResult> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(PUBLIC_MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? PUBLIC_DEFAULT_PAGE_SIZE));
    const sort = this.assertSort(query.sort ?? "newest");

    // Category-specific attribute filters (§9): валидируются по ACTIVE Category
    // Schema категории — не один жёсткий набор фильтров для всех типов услуг.
    // Применяются СЕРВЕРНО в PostgreSQL (parameterized raw SQL, FIX 2 review).
    let attrFilters: Array<{ key: string; value: unknown; type: string }> = [];
    if (query.f && Object.keys(query.f).length > 0) {
      if (!query.category) {
        throw new ValidationDomainError("Category-specific attribute filters (f[...]) require ?category=<slug>");
      }
      attrFilters = await this.resolveAttributeFilters(query.category, query.f);
    }

    // Discovery-availability фильтр (§12): хотя бы одна строка Availability >= даты.
    let availableFrom: Date | undefined;
    if (query.available_from) {
      availableFrom = new Date(query.available_from);
      if (Number.isNaN(availableFrom.getTime())) {
        throw new ValidationDomainError(`available_from must be a valid ISO date, got "${query.available_from}"`);
      }
    }

    const include = this.productInclude();

    // Server-side matching ВСЕГО published-набора (FIX 2 review): один parameterized
    // raw SQL-запрос выполняет все фильтры (category/search/available_from/attribute
    // f[key]=value), price sort по min-тарифу (NULLS LAST) и возвращает id страницы
    // + total полного совпадения. Никакого in-memory сканирования / scan ceiling /
    // silent truncation — результат всегда корректен для dataset любого размера.
    const { ids, total } = await this.matchPublishedProductIds({
      categorySlug: query.category,
      q: query.q?.trim() || undefined,
      availableFrom,
      attrFilters,
      sort,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Дозагрузка полных строк страницы строго в порядке серверного matching.
    let rows: PublicProductRow[];
    if (ids.length === 0) {
      rows = [];
    } else {
      const found = await this.prisma.product.findMany({ where: { id: { in: ids } }, include });
      const byId = new Map(found.map((r) => [r.id, r] as const));
      rows = ids.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r)) as unknown as PublicProductRow[];
    }

    const availability = await this.availabilitySummaries(rows.map((r) => r.id));
    const sellers = await this.sellersOf(rows.map((r) => r.partnerId));

    const items = await Promise.all(
      rows.map((r) =>
        this.toCard(r, availability.get(r.id) ?? null, r.partnerId ? (sellers.get(r.partnerId) ?? null) : null),
      ),
    );

    return { items, total, page, pageSize };
  }

  // ── Public Product detail (PDP, §5) ───────────────────────────────────────

  async getProductDetail(slugOrId: string): Promise<PublicProductDetail> {
    const row = await this.prisma.product.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }], ...this.marketplaceWhere() },
      include: this.productDetailInclude(),
    });
    // Единый 404: anonymous не узнаёт, что Product существует как DRAFT/IN_REVIEW
    // или имеет draft N+1 (§17/§19) — lifecycle внутренний. Guard видимости — defense
    // in depth (where + явная проверка): DRAFT/ARCHIVED/без publishedAt → тот же 404.
    if (!row || !PublicCatalogService.isPubliclyVisible(row.status, row.publishedAt)) {
      throw new NotFoundError("Product not found");
    }
    const seller = row.partnerId ? ((await this.sellersOf([row.partnerId])).get(row.partnerId) ?? null) : null;
    return this.toDetail(row, seller);
  }

  // ── Public Partner Storefront (Phase 1 Step 1.12.1 §11/§12/§13) ──────────

  /** Seller-safe projection одного Partner (Step 1.11 authoritative). */
  async sellerProjectionFor(partnerId: string): Promise<PublicSeller | null> {
    return (await this.sellersOf([partnerId])).get(partnerId) ?? null;
  }

  /**
   * Public storefront по slug: ТОЛЬКО ACTIVE + entitlement ACTIVE (+ activatedAt).
   * DRAFT/INACTIVE/SUSPENDED/EXPIRED → neutral 404 (публично не существует).
   * Whitelist DTO — никаких internal полей (partnerId/CRM/User/entitlementStatus/
   * audit/storage keys). Step 1.12.2: business identity + structured contacts +
   * branding публикуются ТОЛЬКО в этом Storefront-контексте.
   */
  async getPublicStorefront(slug: string): Promise<PublicStorefront> {
    const sf = await this.prisma.partnerStorefront.findUnique({
      where: { slug },
      include: { media: { orderBy: { createdAt: "asc" } } },
    });
    // REVIEW FIX 2/4: публична только ACTIVE витрина с ACTIVE entitlement.
    // SUSPENDED/EXPIRED → нейтральный 404 (витрина скрыта, данные сохранены).
    if (!sf || sf.status !== "ACTIVE" || !sf.activatedAt || sf.entitlementStatus !== "ACTIVE") {
      throw new NotFoundError("Storefront not found");
    }
    const seller = await this.sellerProjectionFor(sf.partnerId);
    return {
      id: sf.id,
      code: sf.code,
      slug: sf.slug,
      businessName: sf.businessName,
      tagline: sf.tagline,
      description: sf.description,
      defaultLocale: sf.defaultLocale,
      countryCode: sf.countryCode,
      cityCode: sf.cityCode,
      publicPhone: sf.publicPhone,
      publicEmail: sf.publicEmail,
      websiteUrl: sf.websiteUrl,
      whatsapp: sf.whatsapp,
      socialLinks: Array.isArray(sf.socialLinks)
        ? (sf.socialLinks as unknown as Array<{ platform: string; url: string }>)
        : null,
      heroHeading: sf.heroHeading,
      heroSubheading: sf.heroSubheading,
      themePreset: sf.themePreset,
      // Стабильные public URL (delivery layer решит proxy/redirect; здесь — signed redirect).
      media: sf.media.map((m) => ({ id: m.id, kind: m.kind as "LOGO" | "HERO", url: `/api/v1/public/storefronts/${slug}/media/${m.id}` })),
      seller,
      activatedAt: sf.activatedAt.toISOString(),
    };
  }

  /**
   * Stable public delivery для Storefront media (Step 1.12.2 §6): байты только
   * при ACTIVE + entitlement ACTIVE витрине, media обязана принадлежать этой
   * витрине (no IDOR), storage keys/credentials в JSON отсутствуют. Delivery
   * strategy — short-lived signed redirect на приватный bucket.
   */
  async getPublicStorefrontMediaUrl(slug: string, mediaId: string): Promise<{ url: string; mimeType: string }> {
    const sf = await this.prisma.partnerStorefront.findUnique({ where: { slug } });
    if (!sf || sf.status !== "ACTIVE" || !sf.activatedAt || sf.entitlementStatus !== "ACTIVE") {
      throw new NotFoundError("Storefront not found");
    }
    const media = await this.prisma.storefrontMedia.findFirst({ where: { id: mediaId, storefrontId: sf.id } });
    if (!media) {
      throw new NotFoundError("Media not found");
    }
    const url = await this.storage.getSignedReadUrl(media.storageKey, SIGNED_URL_TTL_SECONDS);
    return { url, mimeType: media.mimeType };
  }

  /**
   * Только опубликованные Product КОНКРЕТНОГО Partner (storefront.partnerId).
   * Переиспользует public safe projection; server-side pagination + total по
   * полному dataset; детерминированная сортировка. Без N+1 (batch sellers/
   * availability). DRAFT/COMPLETE/REVIEWED/ARCHIVED и ProductDraft N+1/staged
   * media невидимы by construction (publicWhere + media where status PUBLISHED).
   */
  async listStorefrontProducts(
    partnerId: string,
    query: { page?: number; pageSize?: number },
  ): Promise<PublicProductListResult> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(PUBLIC_MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? PUBLIC_DEFAULT_PAGE_SIZE));
    // REVIEW FIX 4: витрина показывает только PARTNER_STOREFRONT-enabled Product.
    const where: Prisma.ProductWhereInput = { partnerId, ...this.storefrontWhere() };
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: this.productInclude(),
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    const typed = rows as unknown as PublicProductRow[];
    const availability = await this.availabilitySummaries(typed.map((r) => r.id));
    const sellers = await this.sellersOf(typed.map((r) => r.partnerId));
    const items = await Promise.all(
      typed.map((r) =>
        this.toCard(r, availability.get(r.id) ?? null, r.partnerId ? (sellers.get(r.partnerId) ?? null) : null),
      ),
    );
    return { items, total, page, pageSize };
  }

  /**
   * PDP в контексте storefront: Product.partnerId == storefront.partnerId И
   * публично видим (Step 1.5). Чужой / DRAFT / COMPLETE / REVIEWED / ARCHIVED →
   * neutral 404 (anonymous не узнаёт о существовании).
   */
  async getStorefrontProductDetail(partnerId: string, slugOrId: string): Promise<PublicProductDetail> {
    const row = await this.prisma.product.findFirst({
      where: { OR: [{ id: slugOrId }, { slug: slugOrId }], partnerId, ...this.storefrontWhere() },
      include: this.productDetailInclude(),
    });
    if (!row || !PublicCatalogService.isPubliclyVisible(row.status, row.publishedAt)) {
      throw new NotFoundError("Product not found");
    }
    const seller = await this.sellerProjectionFor(partnerId);
    return this.toDetail(row, seller);
  }

  /**
   * ACTIVE storefront по slug → partnerId. DRAFT/INACTIVE/отсутствует → neutral
   * 404 (публично не существует). Используется только public-контуром; partnerId
   * наружу НЕ отдаётся.
   */
  private async resolveActiveStorefrontPartnerId(slug: string): Promise<string> {
    const sf = await this.prisma.partnerStorefront.findUnique({ where: { slug } });
    // REVIEW FIX 2: публичный контур витрины требует ACTIVE entitlement.
    if (!sf || sf.status !== "ACTIVE" || !sf.activatedAt || sf.entitlementStatus !== "ACTIVE") {
      throw new NotFoundError("Storefront not found");
    }
    return sf.partnerId;
  }

  /** Список опубликованных Product витрины по её public slug. */
  async listStorefrontProductsBySlug(
    slug: string,
    query: { page?: number; pageSize?: number },
  ): Promise<PublicProductListResult> {
    const partnerId = await this.resolveActiveStorefrontPartnerId(slug);
    return this.listStorefrontProducts(partnerId, query);
  }

  // ── Shared authoritative resolvers (Step 1.12.3 behavioral instrumentation) ──
  // Поведенческие события используют ТЕ ЖЕ public predicates, что и read-контур:
  // ACTIVE + activatedAt + entitlement ACTIVE для витрины; PUBLISHED +
  // PARTNER_STOREFRONT + partnerId для Product. Без расходящейся копии логики.

  /**
   * Лёгкий resolver публичной витрины (Step 1.12.3): canonical id + partnerId
   * только при ACTIVE + activatedAt + entitlement ACTIVE; иначе null
   * (neutral — behavioral event не создаётся).
   */
  async resolvePublicStorefrontForEvents(slug: string): Promise<{ id: string; partnerId: string } | null> {
    const sf = await this.prisma.partnerStorefront.findUnique({
      where: { slug },
      select: { id: true, partnerId: true, status: true, activatedAt: true, entitlementStatus: true },
    });
    if (!sf || sf.status !== "ACTIVE" || !sf.activatedAt || sf.entitlementStatus !== "ACTIVE") {
      return null;
    }
    return { id: sf.id, partnerId: sf.partnerId };
  }

  /**
   * Лёгкий resolver публичного Product витрины (Step 1.12.3): canonical productId
   * только при partnerId == storefront.partnerId И PUBLISHED И
   * PARTNER_STOREFRONT enabled; иначе null (neutral).
   */
  async resolvePublicStorefrontProductForEvents(slug: string, partnerId: string, productSlug: string): Promise<string | null> {
    const row = await this.prisma.product.findFirst({
      where: { OR: [{ id: productSlug }, { slug: productSlug }], partnerId, ...this.storefrontWhere() },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  /** PDP продукта витрины по slug витрины + slug/id продукта. */
  async getStorefrontProductDetailBySlug(slug: string, productSlug: string): Promise<PublicProductDetail> {
    const partnerId = await this.resolveActiveStorefrontPartnerId(slug);
    return this.getStorefrontProductDetail(partnerId, productSlug);
  }

  // ── Shared authoritative resolvers (Step 1.13B Marketplace behavioral) ──────
  // Marketplace events используют ТЕ ЖЕ public predicates, что и read-контур
  // (marketplaceWhere: PUBLISHED + publishedAt + MARKETPLACE channel) и
  // категории (ACTIVE). Без расходящейся копии public visibility логики.

  /**
   * Лёгкий resolver публичного Marketplace Product (Step 1.13B): canonical
   * productId только при PUBLISHED + publishedAt + MARKETPLACE channel;
   * иначе null (neutral — событие не создаётся).
   */
  async resolvePublicMarketplaceProductForEvents(productSlug: string): Promise<string | null> {
    const row = await this.prisma.product.findFirst({
      where: { OR: [{ id: productSlug }, { slug: productSlug }], ...this.marketplaceWhere() },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  /**
   * Лёгкий resolver публичной Marketplace категории (Step 1.13B): canonical
   * categoryId только при ACTIVE; иначе null (neutral).
   */
  async resolvePublicMarketplaceCategoryForEvents(categorySlug: string): Promise<string | null> {
    const row = await this.prisma.category.findFirst({
      where: { slug: categorySlug, status: "ACTIVE" },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  // ── Public categories (§7) ────────────────────────────────────────────────

  async listCategories(): Promise<PublicCategory[]> {
    const rows = await this.prisma.category.findMany({
      where: { status: "ACTIVE" },
      orderBy: { title: "asc" },
      select: { id: true, slug: true, title: true },
    });
    return rows.map((r) => this.toCategory(r));
  }

  async getCategory(slug: string): Promise<PublicCategory> {
    const row = await this.prisma.category.findFirst({
      where: { slug, status: "ACTIVE" },
      select: { id: true, slug: true, title: true },
    });
    if (!row) throw new NotFoundError("Category not found");
    return this.toCategory(row);
  }

  /**
   * Filter metadata категории (§7/§9): фильтры строятся из ACTIVE Category Schema
   * (только filterable атрибуты + availability конфигурация) — никаких internal
   * schema/admin полей и жёстко заданного набора для всех типов услуг.
   */
  async getCategoryFilters(slug: string): Promise<PublicFilterMetadata> {
    const category = await this.prisma.category.findFirst({
      where: { slug, status: "ACTIVE" },
      select: { id: true, slug: true, title: true },
    });
    if (!category) throw new NotFoundError("Category not found");

    const schema = await this.prisma.categorySchema.findFirst({
      where: { categoryId: category.id, status: "ACTIVE" },
      orderBy: { version: "desc" },
    });
    const defs = ((schema?.attributes ?? []) as unknown) as AttributeDef[];
    const filters: PublicFilterOption[] = defs
      .filter((d) => d.filterable)
      .map((d) => ({
        key: d.key,
        label: d.label ?? d.key,
        type: d.type,
        ...(d.options ? { options: d.options } : {}),
        ...(d.min !== undefined ? { min: d.min } : {}),
        ...(d.max !== undefined ? { max: d.max } : {}),
      }));

    const availabilityRaw = (schema?.availability ?? null) as { enabled?: boolean; dateRequired?: boolean } | null;

    return {
      category: this.toCategory(category),
      filters,
      availability: availabilityRaw ? { enabled: availabilityRaw.enabled === true, dateRequired: availabilityRaw.dateRequired === true } : null,
      sort: [...PUBLIC_SORT_MODES],
    };
  }

  // ── helpers: sort / filters / SQL matching (FIX 2) ────────────────────────

  private assertSort(sort: string): PublicSortMode {
    if (!(PUBLIC_SORT_MODES as readonly string[]).includes(sort)) {
      throw new ValidationDomainError(`Unsupported sort "${sort}"; supported: ${PUBLIC_SORT_MODES.join(", ")}`);
    }
    return sort as PublicSortMode;
  }

  /**
   * Category-specific attribute filters (§9): валидация значений по типу атрибута
   * ACTIVE Category Schema. Возвращает key/value + type для SQL-сравнения (FIX 2).
   */
  private async resolveAttributeFilters(
    categorySlug: string,
    f: Record<string, string>,
  ): Promise<Array<{ key: string; value: unknown; type: string }>> {
    const schema = await this.prisma.categorySchema.findFirst({
      where: { category: { slug: categorySlug }, status: "ACTIVE" },
      orderBy: { version: "desc" },
    });
    const defs = ((schema?.attributes ?? []) as unknown) as AttributeDef[];
    const byKey = new Map(defs.map((d) => [d.key, d]));

    return Object.entries(f).map(([key, raw]) => {
      const def = byKey.get(key);
      if (!def) throw new ValidationDomainError(`Unknown filter attribute "${key}" for category "${categorySlug}"`);
      if (!def.filterable) throw new ValidationDomainError(`Attribute "${key}" is not filterable for category "${categorySlug}"`);
      return { key, value: this.coerceFilterValue(def, raw), type: def.type };
    });
  }

  /**
   * FIX 2 review: server-side matching ВСЕГО published-набора в PostgreSQL.
   * Parameterized raw SQL (Prisma.sql) выполняет все фильтры (category / q /
   * available_from / attribute f[key]=value по типу Schema), price sort по
   * минимальному тарифу (NULLS LAST) и возвращает id страницы + total всего
   * совпадения. Без SQL injection (только bind params), без переноса business
   * ownership из Catalog, без scan ceiling — dataset любого размера корректен.
   * total вычисляется отдельным count-запросом БЕЗ LIMIT/OFFSET (страница за
   * концом не обнуляет total).
   */
  private async matchPublishedProductIds(input: {
    categorySlug?: string;
    q?: string;
    availableFrom?: Date;
    attrFilters: Array<{ key: string; value: unknown; type: string }>;
    sort: PublicSortMode;
    skip: number;
    take: number;
  }): Promise<{ ids: string[]; total: number }> {
    // REVIEW FIX 4: Marketplace показывает только Product, включённые в MARKETPLACE
    // канал (publication channel отделён от lifecycle).
    const conds: Prisma.Sql[] = [
      Prisma.sql`p."status" = 'PUBLISHED' AND p."publishedAt" IS NOT NULL`,
      Prisma.sql`EXISTS (SELECT 1 FROM catalog."ProductPublicationChannel" pc WHERE pc."productId" = p."id" AND pc."channel" = 'MARKETPLACE')`,
    ];
    if (input.categorySlug) {
      conds.push(Prisma.sql`c."slug" = ${input.categorySlug}`);
    }
    if (input.q) {
      const like = `%${input.q}%`;
      conds.push(Prisma.sql`(p."title" ILIKE ${like} OR p."description" ILIKE ${like} OR p."code" ILIKE ${like})`);
    }
    if (input.availableFrom) {
      conds.push(
        Prisma.sql`EXISTS (SELECT 1 FROM catalog."Availability" a WHERE a."productId" = p."id" AND a."date" >= ${input.availableFrom})`,
      );
    }
    // Category-specific attribute сравнение. Для одиночного ключа PG использует
    // оператор ->> (jsonb, text) — у #>>/#> только text[] перегрузки (одиночный
    // ключ параметром → "invalid array literal"; с ::text → "operator not exists").
    for (const f of input.attrFilters) {
      if (f.type === "number" || f.type === "integer") {
        // Numeric-фильтр: regex-стража перед ::numeric — corrupt/legacy нечисловое
        // значение исключает строку, а не роняет public endpoint (500 на касте).
        conds.push(
          Prisma.sql`(p."attributes" ->> ${f.key}) ~ '^[+-]?[0-9]+(\.[0-9]+)?$' AND (p."attributes" ->> ${f.key})::numeric = ${f.value as number}`,
        );
      } else if (f.type === "boolean") {
        conds.push(Prisma.sql`(p."attributes" ->> ${f.key}) = ${f.value === true ? "true" : "false"}`);
      } else {
        conds.push(Prisma.sql`(p."attributes" ->> ${f.key}) = ${String(f.value)}`);
      }
    }
    const where = Prisma.join(conds, " AND ");

    // Базовый подзапрос: published + фильтры + min-тариф для price sort.
    // Step 1.8B §42/§43: min учитывает только ACTIVE + FIXED Rate Plans под
    // eligible unit (unit-less legacy — ок; DRAFT/ARCHIVED unit — план не публичен)
    // и исключает POR (inquiry-only, не bindable).
    const base = Prisma.sql`
      SELECT p."id", p."publishedAt", p."createdAt",
        (SELECT min(t."price") FROM catalog."Tariff" t
          WHERE t."productId" = p."id" AND t."status" = 'ACTIVE' AND t."pricingMode" = 'FIXED'
            AND (t."serviceUnitId" IS NULL OR EXISTS (
              SELECT 1 FROM catalog."ServiceUnit" su
              WHERE su."id" = t."serviceUnitId" AND su."status" = 'PUBLISHED'))) AS "minPrice"
      FROM catalog."Product" p
      LEFT JOIN catalog."Category" c ON c."id" = p."categoryId"
      WHERE ${where}
    `;

    const orderBy =
      input.sort === "newest"
        ? Prisma.sql`s."publishedAt" DESC, s."createdAt" DESC, s."id" ASC`
        : input.sort === "price_asc"
          ? Prisma.sql`s."minPrice" ASC NULLS LAST, s."publishedAt" DESC, s."id" ASC`
          : Prisma.sql`s."minPrice" DESC NULLS LAST, s."publishedAt" DESC, s."id" ASC`;

    const [pageRows, countRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT s."id" FROM (${base}) s ORDER BY ${orderBy} LIMIT ${input.take} OFFSET ${input.skip}
      `),
      this.prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        SELECT count(*)::int AS total FROM (${base}) s
      `),
    ]);
    return { ids: pageRows.map((r) => r.id), total: countRows[0]?.total ?? 0 };
  }

  /** Приведение значения фильтра к типу атрибута (контролируемая валидация, §10/§19). */
  private coerceFilterValue(def: AttributeDef, raw: string): Prisma.InputJsonValue {
    switch (def.type) {
      case "number":
      case "integer": {
        if (raw.trim() === "") throw new ValidationDomainError(`Invalid numeric filter value for "${def.key}": "${raw}"`);
        const n = Number(raw);
        if (!Number.isFinite(n)) throw new ValidationDomainError(`Invalid numeric filter value for "${def.key}": "${raw}"`);
        if (def.min !== undefined && n < def.min) {
          throw new ValidationDomainError(`Filter "${def.key}" must be >= ${def.min}`);
        }
        if (def.max !== undefined && n > def.max) {
          throw new ValidationDomainError(`Filter "${def.key}" must be <= ${def.max}`);
        }
        return n;
      }
      case "boolean":
        if (raw !== "true" && raw !== "false") {
          throw new ValidationDomainError(`Invalid boolean filter value for "${def.key}": "${raw}"`);
        }
        return raw === "true";
      case "enum":
        if (def.options && !def.options.includes(raw)) {
          throw new ValidationDomainError(`Attribute "${def.key}" must be one of: ${def.options.join(", ")}`);
        }
        return raw;
      case "date":
        if (Number.isNaN(Date.parse(raw))) {
          throw new ValidationDomainError(`Invalid date filter value for "${def.key}": "${raw}"`);
        }
        return raw;
      default:
        // string / text / time / currency — строковое сравнение.
        return raw;
    }
  }

  // ── helpers: mappers / aggregates ─────────────────────────────────────────

  private toCategory(c: { id: string; slug: string; title: string }): PublicCategory {
    return { id: c.id, slug: c.slug, title: c.title };
  }

  /**
   * Стабильный public media delivery URL (FIX 1): provider-independent контракт,
   * никогда не содержит storage keys / signed S3 параметров. Delivery layer
   * решает proxy/redirect/CDN при фактическом запросе файла.
   */
  private publicMediaUrl(mediaId: string, derivative: PublicMediaDerivative): string {
    return `/api/v1/public/media/${mediaId}/${derivative}`;
  }

  private toPublicMedia(m: PublicMediaRow): PublicMedia {
    return {
      id: m.id,
      type: m.type,
      mimeType: m.mimeType,
      width: m.width,
      height: m.height,
      sortOrder: m.sortOrder,
      isPrimary: m.isPrimary,
      caption: m.caption,
      altText: m.altText,
      url: { thumb: this.publicMediaUrl(m.id, "thumb"), large: this.publicMediaUrl(m.id, "large") },
    };
  }

  /** Маппинг детали (PDP) — общий для Marketplace и Storefront-контура. */
  private toDetail(row: PublicProductRow, seller: PublicSeller | null): PublicProductDetail {
    const media = row.media.map((m) => this.toPublicMedia(m));
    const availability = this.toAvailabilitySummary(row.availability ?? []);
    const price = this.minTariff(row.tariffs);
    return {
      product: {
        id: row.id,
        code: row.code,
        slug: row.slug,
        title: row.title,
        description: row.description,
        type: row.type as PublicProductDetail["product"]["type"],
        category: row.category ? this.toCategory(row.category) : null,
        attributes: (row.attributes ?? null) as Record<string, unknown> | null,
        tariffs: row.tariffs.map((t) => ({
          id: t.id,
          name: t.name,
          // §22: POR — inquiry-only offer; bindable цена не выводится (null),
          // но план видим (visibility отделён от цены/bindability).
          price: t.pricingMode === "PRICE_ON_REQUEST" ? null : this.money(t.price),
          currency: t.pricingMode === "PRICE_ON_REQUEST" ? null : t.currency,
          validFrom: t.validFrom ? t.validFrom.toISOString() : null,
          validTo: t.validTo ? t.validTo.toISOString() : null,
          pricingMode: t.pricingMode as "FIXED" | "PRICE_ON_REQUEST",
        })),
        priceFrom: price?.amount ?? null,
        currency: price?.currency ?? null,
        pricingUnit: "unit",
        availability,
        seller,
        publishedAt: row.publishedAt!.toISOString(),
        version: row.version,
      },
      media,
    };
  }

  private toCard(
    row: PublicProductRow,
    availability: PublicAvailabilitySummary | null,
    seller: PublicSeller | null,
  ): PublicProductCard {
    const primary = row.media.find((m) => m.isPrimary) ?? row.media[0] ?? null;
    const primaryImage = primary
      ? { id: primary.id, thumbUrl: this.publicMediaUrl(primary.id, "thumb"), largeUrl: this.publicMediaUrl(primary.id, "large") }
      : null;
    const price = this.minTariff(row.tariffs);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      shortDescription: this.shorten(row.description),
      type: row.type as PublicProductCard["type"],
      category: row.category ? this.toCategory(row.category) : null,
      primaryImage,
      priceFrom: price?.amount ?? null,
      currency: price?.currency ?? null,
      pricingUnit: "unit",
      availabilitySummary: availability,
      seller,
      publishedAt: row.publishedAt!.toISOString(),
    };
  }

  /**
   * Минимальный публичный тариф (priceFrom §11/§43). Нет FIXED тарифов → null
   * (не 0, не fallback на POR-цену — POR inquiry-only, цена не bindable).
   */
  private minTariff(tariffs: PublicTariffRow[]): { amount: string; currency: string } | null {
    const bindable = tariffs.filter((t) => t.pricingMode === "FIXED");
    if (bindable.length === 0) return null;
    let best = bindable[0];
    for (const t of bindable) {
      if (t.price.lessThan(best.price)) best = t;
    }
    return { amount: this.money(best.price), currency: best.currency };
  }

  /** Детерминированное денежное представление (Decimal(12,2) → "100.00"). */
  private money(price: Prisma.Decimal): string {
    return price.toFixed(2);
  }

  /** Детерминированное усечение description для карточки (§4). */
  private shorten(description: string | null): string | null {
    if (!description) return null;
    if (description.length <= PUBLIC_CARD_DESCRIPTION_LIMIT) return description;
    return description.slice(0, PUBLIC_CARD_DESCRIPTION_LIMIT - 1).trimEnd() + "…";
  }

  private toAvailabilitySummary(rows: Array<{ date: Date; slotsTotal: number; slotsBooked: number; slotsReserved: number }>): PublicAvailabilitySummary | null {
    if (rows.length === 0) return null;
    return {
      availableFrom: rows[0].date.toISOString(),
      datesCount: rows.length,
      totalSlots: rows.reduce((s, r) => s + r.slotsTotal, 0),
      totalBooked: rows.reduce((s, r) => s + r.slotsBooked, 0),
      totalReserved: rows.reduce((s, r) => s + r.slotsReserved, 0),
    };
  }

  /** Batch availability сводок для страницы списка (без N+1 на продукт). */
  private async availabilitySummaries(productIds: string[]): Promise<Map<string, PublicAvailabilitySummary>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.prisma.availability.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds } },
      _min: { date: true },
      _count: { _all: true },
      _sum: { slotsTotal: true, slotsBooked: true, slotsReserved: true },
    });
    return new Map(
      rows.map((r) => [
        r.productId,
        {
          availableFrom: r._min.date ? r._min.date.toISOString() : null,
          datesCount: r._count._all,
          totalSlots: r._sum.slotsTotal ?? 0,
          totalBooked: r._sum.slotsBooked ?? 0,
          totalReserved: r._sum.slotsReserved ?? 0,
        },
      ]),
    );
  }

  /**
   * Batch public seller projection (Phase 1 Step 1.11 §8) — из PublicSellerProfile
   * (Catalog-owned), НЕ из crm.Partner. Профиль HIDDEN/отсутствует → null (идентичность
   * не показывается). ANONYMOUS → generic label (displayName=null, фронтенд локализует).
   */
  private async sellersOf(partnerIds: Array<string | null>): Promise<Map<string, PublicSeller>> {
    const unique = [...new Set(partnerIds.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map();
    const profiles = await this.prisma.publicSellerProfile.findMany({
      where: { partnerId: { in: unique } },
    });
    const out = new Map<string, PublicSeller>();
    for (const p of profiles) {
      // HIDDEN (status) — идентичность не показывается; APPROVED — показываем по visibilityMode.
      if (p.status !== "APPROVED") continue;
      out.set(p.partnerId, this.toPublicSeller(p));
    }
    return out;
  }

  /** Seller-safe маппинг профиля по visibilityMode. Никаких raw CRM полей. */
  private toPublicSeller(p: {
    publicId: string;
    partnerId: string;
    status: string;
    visibilityMode: string;
    publicDisplayName: string | null;
    countryCode: string | null;
    cityCode: string | null;
    verified: boolean;
    memberSince: Date;
  }): PublicSeller {
    const mode = (["ANONYMOUS", "VERIFIED_ALIAS", "PUBLIC_BRAND"] as const).includes(p.visibilityMode as PublicSeller["visibilityMode"])
      ? (p.visibilityMode as PublicSeller["visibilityMode"])
      : "ANONYMOUS";
    const displayName = mode === "ANONYMOUS" ? null : (p.publicDisplayName ?? null);
    return {
      publicId: p.publicId,
      displayName,
      visibilityMode: mode,
      verified: p.verified,
      memberSince: p.memberSince.toISOString(),
      // FIX 2: коды, не labels. Локализацию выполняет клиент (RU/AZ/EN label).
      countryCode: p.countryCode,
      cityCode: p.cityCode,
    };
  }

  /**
   * FIX 1 review: стабильный public media delivery — разрешение фактического
   * файла. Доступна ТОЛЬКО media текущей PUBLISHED версии продукта:
   *  - media.status != PUBLISHED (draft/staged, media ProductDraft N+1) → 404;
   *  - владелец-Product не публично видим (DRAFT/ARCHIVED/без publishedAt) → 404.
   * Delivery strategy здесь — короткоживущий signed redirect на приватный bucket
   * (proxy/CDN можно подставить позже, контракт не меняется). Moderation preview
   * остаётся на ОТДЕЛЬНОМ short-lived signed контракте (signedPreviewUrl).
   */
  async getPublicMediaUrl(mediaId: string, derivative: PublicMediaDerivative): Promise<{ url: string; mimeType: string }> {
    const media = await this.prisma.productMedia.findUnique({
      where: { id: mediaId, product: { publicationChannels: { some: {} } } },
      select: {
        id: true,
        status: true,
        mimeType: true,
        thumbnailStorageKey: true,
        largeStorageKey: true,
        product: { select: { status: true, publishedAt: true } },
      },
    });
    if (!media || media.status !== "PUBLISHED" || !PublicCatalogService.isPubliclyVisible(media.product.status, media.product.publishedAt)) {
      throw new NotFoundError("Media not found");
    }
    const key = derivative === "thumb" ? media.thumbnailStorageKey : media.largeStorageKey;
    const url = await this.storage.getSignedReadUrl(key, SIGNED_URL_TTL_SECONDS);
    return { url, mimeType: media.mimeType };
  }
}
