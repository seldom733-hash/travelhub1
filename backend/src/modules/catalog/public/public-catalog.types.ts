/**
 * Public Catalog read-contract (Phase 1 Step 1.5) — отдельный anonymous public
 * контур витрины. Internal fields отсутствуют BY CONSTRUCTION (Prisma-строки
 * никогда не сериализуются напрямую).
 *
 * Главный invariant:
 *   PUBLIC → только approved + PUBLISHED version
 *   PUBLIC ✕ DRAFT / ProductDraft N+1 / SUBMITTED / IN_REVIEW / moderation snapshot
 *   PUBLIC ✕ staged (DRAFT) media / storage keys / private S3 info
 *   PUBLIC ✕ internal Partner/CRM данные
 */
import type { ProductType } from "../../../generated/prisma/enums";

/** Derivative в stable public media delivery contract (FIX 1 review). */
export type PublicMediaDerivative = "thumb" | "large";

/**
 * Публичное медиа (только PUBLISHED) — метаданные + СТАБИЛЬНЫЙ public delivery URL
 * (FIX 1 review): /api/v1/public/media/:mediaId/thumb|large. Никогда НЕ содержит
 * storage keys / signed S3 URL. Delivery layer (redirect на short-lived signed URL
 * приватного bucket) решается на сервере при фактическом запросе файла.
 */
export interface PublicMedia {
  id: string;
  type: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
  isPrimary: boolean;
  caption: string | null;
  altText: string | null;
  /** Стабильный provider-independent public delivery URL (thumb/large). */
  url: { thumb: string; large: string };
}

export interface PublicCategory {
  id: string;
  slug: string;
  title: string;
}

/**
 * Публичная availability-сводка (Catalog-owned discovery read §12).
 * Только фактические строки Availability — ничего не выдумывается; нет строк → null.
 * Discovery-чтение НЕ является Booking reservation.
 */
export interface PublicAvailabilitySummary {
  /** Ближайшая дата с availability (ISO) либо null, если строк нет. */
  availableFrom: string | null;
  datesCount: number;
  totalSlots: number;
  totalBooked: number;
  totalReserved: number;
}

/**
 * Публичная идентичность продавца (Phase 1 Step 1.11 §8) — seller-safe projection
 * из PublicSellerProfile, НИКОГДА raw crm.Partner. Internal partnerId не отдаётся.
 *
 * visibilityMode:
 *  - ANONYMOUS      → displayName = null (фронтенд рендерит generic label
 *                     «Проверенный партнёр TravelHub», локализованный);
 *  - VERIFIED_ALIAS → displayName = approved alias продавца;
 *  - PUBLIC_BRAND   → displayName = approved реальный бренд.
 * Даже PUBLIC_BRAND НЕ раскрывает phone/email/site/socials/юр. данные.
 * HIDDEN профиль / отсутствие профиля → seller = null (идентичность не показывается).
 */
export type PublicSellerVisibilityMode = "ANONYMOUS" | "VERIFIED_ALIAS" | "PUBLIC_BRAND";

export interface PublicSeller {
  /** Стабильный публичный id (SELL-*), НЕ partnerId. */
  publicId: string;
  /** Отображаемое имя по visibilityMode; null для ANONYMOUS (generic label). */
  displayName: string | null;
  visibilityMode: PublicSellerVisibilityMode;
  verified: boolean;
  memberSince: string;
  /** Authoritative geography (FIX 2) — коды, не locale-значения. Locale (RU/AZ/EN)
   *  меняет ТОЛЬКО display label на клиенте; identity страны/города от локали
   *  не зависит. countryCode — системная identity из crm.Partner, cityCode — код
   *  из справочника Catalog (принадлежит стране партнёра). */
  countryCode: string | null;
  cityCode: string | null;
}

/**
 * Public Product Card (§4) — краткая карточка для витрины.
 * Поля location/duration/rating/discount/inventory НЕ моделируются в Catalog —
 * не выдумываются и отсутствуют.
 */
export interface PublicProductCard {
  id: string;
  slug: string;
  title: string;
  /** Производное представление description (усечённое, детерминированное). */
  shortDescription: string | null;
  type: ProductType;
  category: PublicCategory | null;
  /** Основное фото (primary PUBLISHED media) либо первая PUBLISHED по sortOrder.
   *  URL — стабильный public delivery path (FIX 1), не signed S3 URL. */
  primaryImage: { id: string; thumbUrl: string; largeUrl: string } | null;
  /** Минимальная цена среди публичных tariffs (Decimal как string). */
  priceFrom: string | null;
  currency: string | null;
  /** Гранулярность цены: per-unit тарифа (per person/service не моделируется отдельно). */
  pricingUnit: "unit";
  /** Discovery-availability (§12); null, если строк Availability нет. */
  availabilitySummary: PublicAvailabilitySummary | null;
  /** Seller-safe проекция (§8, Step 1.11); null — идентичность скрыта/не задана. */
  seller: PublicSeller | null;
  publishedAt: string;
}

export interface PublicTariff {
  id: string;
  name: string;
  /** Цена только у FIXED планов; PRICE_ON_REQUEST — null (inquiry-only, §22). */
  price: string | null;
  /** Валюта вместе с ценой; null для POR (нет bindable цены). */
  currency: string | null;
  validFrom: string | null;
  validTo: string | null;
  /** FIXED — bindable цена; PRICE_ON_REQUEST — inquiry-only (по запросу). */
  pricingMode: "FIXED" | "PRICE_ON_REQUEST";
}

/**
 * Public Product Detail (PDP, §5). Только реально существующие поля authoritative
 * model: без status (lifecycle внутренний), без partnerId/categoryId/schemaId
 * (внутренние id), без draft/moderation/storage keys.
 */
export interface PublicProductDetail {
  product: {
    id: string;
    code: string;
    slug: string;
    title: string;
    description: string | null;
    type: ProductType;
    category: PublicCategory | null;
    /** Category-specific attributes (валидированы по ACTIVE Category Schema). */
    attributes: Record<string, unknown> | null;
    tariffs: PublicTariff[];
    priceFrom: string | null;
    currency: string | null;
    pricingUnit: "unit";
    availability: PublicAvailabilitySummary | null;
    /** Seller-safe проекция (§8, Step 1.11); null — идентичность скрыта/не задана. */
    seller: PublicSeller | null;
    publishedAt: string;
    version: number;
  };
  media: PublicMedia[];
}

/** Category-specific фильтр из ACTIVE Category Schema (только filterable атрибуты). */
export interface PublicFilterOption {
  key: string;
  label: string;
  type: string;
  options?: string[];
  min?: number;
  max?: number;
}

/** Фильтры категории (§7/§9) — строятся из Category Schema, не хардкодятся. */
export interface PublicFilterMetadata {
  category: PublicCategory;
  filters: PublicFilterOption[];
  availability: { enabled: boolean; dateRequired: boolean } | null;
  sort: ["newest", "price_asc", "price_desc"];
}

/** Query списка публичных продуктов (server-side). */
export interface PublicProductListQuery {
  /** Серверный поиск по public-safe полям (title/description/code). */
  q?: string;
  /** Категория по slug. */
  category?: string;
  /** Поддерживаемые режимы: newest | price_asc | price_desc (валидируется в сервисе). */
  sort?: string;
  page?: number;
  pageSize?: number;
  /** Category-specific attribute filters: f[days]=7, f[language]=en (требует category). */
  f?: Record<string, string>;
  /** Фильтр по discovery-availability: только продукты со строкой availability >= даты. */
  available_from?: string;
}

export interface PublicProductListResult {
  items: PublicProductCard[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Public Partner Storefront (Phase 1 Step 1.12.1 §11 + 1.12.2) — anonymous
 * whitelist DTO. ТОЛЬКО ACTIVE + entitlement ACTIVE витрины существуют в public
 * контуре (DRAFT/INACTIVE/SUSPENDED/EXPIRED → neutral 404).
 *
 * Step 1.12.2: это Storefront-контекст (платный SaaS-сайт PARTNER), поэтому DTO
 * ЛЕГИТИМНО содержит Storefront business identity (businessName) и structured
 * contacts — НО только здесь, и только при ACTIVE+entitled (predicate).
 *
 * НЕ содержит: partnerId, CRM Partner ID, User ID, entitlementStatus, tax/legal
 * данные, CRM notes, internal status, audit/moderation id, storage keys.
 * Marketplace-контур (карточки/PDP/search) показывает ТОЛЬКО seller-проекцию
 * PublicSellerProfile (Step 1.11) — businessName/контакты витрины туда не
 * попадают (isolation proof).
 */
export interface PublicStorefront {
  id: string;
  /** Стабильный публичный код витрины (SF-*), генерирует Catalog. */
  code: string;
  slug: string;
  /** Storefront business identity (Step 1.12.2 §3) — имя бизнеса на сайте PARTNER. */
  businessName: string | null;
  tagline: string | null;
  description: string | null;
  /** Локаль контента витрины (ru/az/en) — НЕ country code. */
  defaultLocale: string;
  /** География (коды; локализацию выполняет клиент). */
  countryCode: string | null;
  cityCode: string | null;
  /** Structured business contacts — только Storefront-контекст (§4). */
  publicPhone: string | null;
  publicEmail: string | null;
  websiteUrl: string | null;
  whatsapp: string | null;
  socialLinks: Array<{ platform: string; url: string }> | null;
  /** Branding (Step 1.12.2 §5) — тексты + безопасный theme preset. */
  heroHeading: string | null;
  heroSubheading: string | null;
  themePreset: string;
  /** Storefront-owned media: стабильные public URL (ACTIVE+entitled). */
  media: Array<{ id: string; kind: "LOGO" | "HERO"; url: string }>;
  /** Step 1.11 seller projection (Marketplace identity — verified badge и т.п.). */
  seller: PublicSeller | null;
  activatedAt: string;
}

export const PUBLIC_SORT_MODES = ["newest", "price_asc", "price_desc"] as const;
export const PUBLIC_MAX_PAGE_SIZE = 100;
export const PUBLIC_DEFAULT_PAGE_SIZE = 20;
/** Детерминированная длина shortDescription в карточке (§4). */
export const PUBLIC_CARD_DESCRIPTION_LIMIT = 180;
