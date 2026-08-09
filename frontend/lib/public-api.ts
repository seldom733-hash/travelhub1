/**
 * PHASE 1 STEP 1.6 — Public-only API client (Public Catalog read-contract, Step 1.5).
 *
 * Инвариант (§15): public pages используют ТОЛЬКО /api/v1/public/* — БЕЗ
 * Authorization, даже если пользователь залогинен. Этот модуль НИКОГДА не читает
 * localStorage/token и не отправляет JWT. Внутренние authenticated API — только
 * через lib/api.ts (не для public pages).
 *
 * Контракты — зеркало backend-контрактов Step 1.5 (без internal полей).
 */

export interface PublicCategory {
  id: string;
  slug: string;
  title: string;
}

/**
 * Публичная идентичность продавца (Step 1.11 §8) — seller-safe projection.
 * ANONYMOUS → displayName=null (UI рендерит generic label, локализованный).
 * VERIFIED_ALIAS / PUBLIC_BRAND → displayName = approved имя. Никогда не содержит
 * phone/email/site/socials/юр. данные. HIDDEN/нет профиля → seller=null.
 */
export interface PublicSeller {
  publicId: string;
  displayName: string | null;
  visibilityMode: "ANONYMOUS" | "VERIFIED_ALIAS" | "PUBLIC_BRAND";
  verified: boolean;
  memberSince: string;
  /** Authoritative geography (FIX 2) — коды; локализацию делает клиент по locale. */
  countryCode: string | null;
  cityCode: string | null;
}

export interface PublicAvailabilitySummary {
  availableFrom: string | null;
  datesCount: number;
  totalSlots: number;
  totalBooked: number;
  totalReserved: number;
}

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
  /** Стабильный public delivery URL (FIX 1): /api/v1/public/media/:id/thumb|large. */
  url: { thumb: string; large: string };
}

export interface PublicProductCard {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  type: string;
  category: PublicCategory | null;
  primaryImage: { id: string; thumbUrl: string; largeUrl: string } | null;
  priceFrom: string | null;
  currency: string | null;
  pricingUnit: "unit";
  availabilitySummary: PublicAvailabilitySummary | null;
  seller: PublicSeller | null;
  publishedAt: string;
}

export interface PublicTariff {
  id: string;
  name: string;
  price: string;
  currency: string;
  validFrom: string | null;
  validTo: string | null;
}

export interface PublicProductDetail {
  product: {
    id: string;
    code: string;
    slug: string;
    title: string;
    description: string | null;
    type: string;
    category: PublicCategory | null;
    attributes: Record<string, unknown> | null;
    tariffs: PublicTariff[];
    priceFrom: string | null;
    currency: string | null;
    pricingUnit: "unit";
    availability: PublicAvailabilitySummary | null;
    seller: PublicSeller | null;
    publishedAt: string;
    version: number;
  };
  media: PublicMedia[];
}

export interface PublicFilterOption {
  key: string;
  label: string;
  type: string;
  options?: string[];
  min?: number;
  max?: number;
}

export interface PublicFilterMetadata {
  category: PublicCategory;
  filters: PublicFilterOption[];
  availability: { enabled: boolean; dateRequired: boolean } | null;
  sort: string[];
}

export interface PublicListResult {
  items: PublicProductCard[];
  total: number;
  page: number;
  pageSize: number;
}

/** Query списка публичных продуктов (server-side, см. backend Step 1.5). */
export interface PublicListQuery {
  q?: string;
  category?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
  available_from?: string;
  /** Category-specific фильтры: f[days]=7 (требует category). */
  f?: Record<string, string>;
}

export class PublicApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PublicApiError";
    this.status = status;
  }
}

/** 404 — продукт/категория не публичны (не найдено / не опубликовано) → нейтральный not-found. */
export class PublicNotFoundError extends PublicApiError {
  constructor(message = "Not found") {
    super(message, 404);
    this.name = "PublicNotFoundError";
  }
}

/**
 * Server-side (RSC) запросы к public API идут на абсолютный backend base
 * (rewrites Next действуют только для браузера). В браузере — относительный путь.
 * В dev BACKEND_URL не задан → fallback localhost:4000 (как в next.config.ts).
 */
const SERVER_BASE = process.env.BACKEND_URL ?? "http://localhost:4000";
const BASE = typeof window === "undefined" ? `${SERVER_BASE}/api/v1/public` : "/api/v1/public";

/** Построение query string, включая category-specific f[key]=value (shareable URL). */
export function buildPublicQuery(q: PublicListQuery = {}): string {
  const sp = new URLSearchParams();
  if (q.q?.trim()) sp.set("q", q.q.trim());
  if (q.category) sp.set("category", q.category);
  if (q.sort) sp.set("sort", q.sort);
  if (q.page && q.page > 1) sp.set("page", String(q.page));
  if (q.pageSize) sp.set("pageSize", String(q.pageSize));
  if (q.available_from) sp.set("available_from", q.available_from);
  for (const [k, v] of Object.entries(q.f ?? {})) {
    if (v !== undefined && v !== "") sp.set(`f[${k}]`, v);
  }
  return sp.toString();
}

async function http<T>(path: string): Promise<T> {
  // БЕЗ headers/Authorization by construction — публичный read-contract.
  const res = await fetch(`${BASE}${path}`);
  if (res.status === 404) {
    throw new PublicNotFoundError();
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new PublicApiError(message, res.status);
  }
  return (await res.json()) as T;
}

/** Public Catalog API (Step 1.5) — единственный источник данных public pages. */
export const publicApi = {
  listProducts: (q: PublicListQuery = {}): Promise<PublicListResult> => {
    const qs = buildPublicQuery(q);
    return http<PublicListResult>(`/products${qs ? `?${qs}` : ""}`);
  },
  getProduct: (slugOrId: string): Promise<PublicProductDetail> => http<PublicProductDetail>(`/products/${encodeURIComponent(slugOrId)}`),
  listCategories: (): Promise<PublicCategory[]> => http<PublicCategory[]>("/categories"),
  getCategory: (slug: string): Promise<PublicCategory> => http<PublicCategory>(`/categories/${encodeURIComponent(slug)}`),
  getCategoryFilters: (slug: string): Promise<PublicFilterMetadata> =>
    http<PublicFilterMetadata>(`/categories/${encodeURIComponent(slug)}/filters`),
};

/**
 * PHASE 1 STEP 1.12.2 — Public Partner Storefront API (Step 1.12.1 §11/§12).
 * БЕЗ Authorization by construction (тот же publicApi.http — anonymous).
 * /store/:slug — это Storefront-контекст: DTO легитимно содержит business
 * identity + structured contacts, НО только при ACTIVE + entitlement ACTIVE
 * (предикат сервера); DRAFT/INACTIVE/SUSPENDED/EXPIRED → нейтральный 404.
 */
export interface PublicStorefront {
  id: string;
  code: string;
  slug: string;
  businessName: string | null;
  tagline: string | null;
  description: string | null;
  defaultLocale: string;
  countryCode: string | null;
  cityCode: string | null;
  publicPhone: string | null;
  publicEmail: string | null;
  websiteUrl: string | null;
  whatsapp: string | null;
  socialLinks: Array<{ platform: string; url: string }> | null;
  heroHeading: string | null;
  heroSubheading: string | null;
  themePreset: string;
  media: Array<{ id: string; kind: "LOGO" | "HERO"; url: string }>;
  seller: PublicSeller | null;
  activatedAt: string;
}

export const publicStorefrontApi = {
  /** Витрина по slug (только ACTIVE + entitled; иначе PublicNotFoundError). */
  get(slug: string): Promise<PublicStorefront> {
    return http<PublicStorefront>(`/storefronts/${encodeURIComponent(slug)}`);
  },
  /** Продукты витрины (server-side pagination, только продукты этого Partner). */
  listProducts(slug: string, q: { page?: number; pageSize?: number } = {}): Promise<PublicListResult> {
    const sp = new URLSearchParams();
    if (q.page && q.page > 1) sp.set("page", String(q.page));
    if (q.pageSize) sp.set("pageSize", String(q.pageSize));
    const qs = sp.toString();
    return http<PublicListResult>(`/storefronts/${encodeURIComponent(slug)}/products${qs ? `?${qs}` : ""}`);
  },
  /** PDP в Storefront-контексте; чужой/DRAFT/ARCHIVED → neutral 404. */
  getProduct(slug: string, productSlug: string): Promise<PublicProductDetail> {
    return http<PublicProductDetail>(`/storefronts/${encodeURIComponent(slug)}/products/${encodeURIComponent(productSlug)}`);
  },
};
