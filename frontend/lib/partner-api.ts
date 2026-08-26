/**
 * PHASE 1 STEP 1.8 — Partner Cabinet API client.
 *
 * Кабинет партнёра работает ТОЛЬКО через авторизованные Catalog/Media/Moderation
 * contracts (собственный scope PARTNER назначается backend из actor context) +
 * Partner-safe schema contract:
 *
 *   GET /api/v1/partner/categories/:slug/schema   (catalog.category_schema.read_active_for_product_edit)
 *
 * Инварианты (§8.1):
 *  - кабинет НЕ вызывает internal `/category-schemas` и НЕ получает
 *    `catalog.category_schema.read` (у PARTNER его нет);
 *  - schema-контракт — единственный источник Category Schema для dynamic form;
 *  - категории для picker — из public Category API (публичные ACTIVE категории,
 *    без internal schema/admin полей); public pages не трогаем.
 *
 * Все остальные вызовы — через lib/api.ts (Bearer JWT; 401 → login).
 */
import { api, type Page } from "./api";
import { publicApi, type PublicCategory } from "./public-api";

/* ── Partner-safe ACTIVE Category Schema contract (§8.1) ──────────────────── */

export interface PartnerSchemaAttribute {
  key: string;
  label?: string;
  type: "string" | "text" | "number" | "integer" | "boolean" | "date" | "time" | "enum" | "currency";
  required?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  pattern?: string;
}

export interface PartnerMediaRequirements {
  minImages?: number;
  maxImages?: number;
  primaryImageRequired?: boolean;
  allowedMediaTypes?: string[];
  videoAllowed?: boolean;
}

export interface PartnerSchemaContract {
  category: { id: string; code: string; slug: string; title: string };
  schema: {
    id: string;
    version: number;
    status: "ACTIVE";
    attributes: PartnerSchemaAttribute[];
    availability: Record<string, unknown> | null;
    tariffRules: Record<string, unknown> | null;
    mediaRequirements: PartnerMediaRequirements | null;
    pdpSections: string[] | null;
  };
}

/* ── Product list (My Products) ───────────────────────────────────────────── */

export interface PartnerProductListItem {
  id: string;
  code: string;
  type: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; slug: string; title: string } | null;
  thumbnail: { id: string; mimeType: string; width: number | null; height: number | null } | null;
  moderation: {
    status: string;
    isActive: boolean;
    submittedAt: string;
    decidedAt: string | null;
    reasonCode: string | null;
    comment: string | null;
    draftVersion: number | null;
    productVersion: number;
  } | null;
  priceFrom: string | null;
  currency: string | null;
  tariffs: { id: string; code: string; name: string; price: number; currency: string }[];
}

export type PartnerLifecycleFilter = "draft" | "in_moderation" | "changes_requested" | "published" | "archived";
export type PartnerListSort = "updated_desc" | "updated_asc" | "created_desc" | "title_asc";

export interface PartnerListQuery {
  search?: string;
  status?: string;
  categoryId?: string;
  filter?: PartnerLifecycleFilter;
  sort?: PartnerListSort;
  page?: number;
  pageSize?: number;
}

export function buildPartnerListQuery(q: PartnerListQuery): string {
  const sp = new URLSearchParams();
  if (q.search?.trim()) sp.set("search", q.search.trim());
  if (q.status) sp.set("status", q.status);
  if (q.categoryId) sp.set("categoryId", q.categoryId);
  if (q.filter) sp.set("filter", q.filter);
  if (q.sort && q.sort !== "updated_desc") sp.set("sort", q.sort);
  if (q.page && q.page > 1) sp.set("page", String(q.page));
  if (q.pageSize) sp.set("pageSize", String(q.pageSize));
  return sp.toString();
}

/* ── Product detail / edit ────────────────────────────────────────────────── */

export interface PartnerTariff {
  id: string;
  code: string;
  name: string;
  price: number;
  currency: string;
  validFrom: string | null;
  validTo: string | null;
}

export interface PartnerAvailabilityRow {
  id: string;
  tariffId: string | null;
  date: string;
  slotsTotal: number;
  slotsBooked: number;
  slotsReserved: number;
}

export interface PartnerDraftView {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  categorySchemaId: string | null;
  attributes: Record<string, unknown> | null;
  tariffs: Array<{ name: string; price: number | string; currency?: string }> | null;
  version: number;
  updatedAt: string;
}

export type PublicationChannel = "MARKETPLACE" | "PARTNER_STOREFRONT";

export interface PartnerProductDetail {
  id: string;
  code: string;
  type: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  version: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  partnerId: string | null;
  categoryId: string | null;
  category: { id: string; code: string; slug: string; title: string } | null;
  categorySchema: { id: string; version: number; status: string } | null;
  attributes: Record<string, unknown> | null;
  tariffs: PartnerTariff[];
  availability: PartnerAvailabilityRow[];
  media: PartnerMediaItem[];
  history: { id: string; action: string; from: string | null; to: string | null; comment: string | null; createdAt: string }[];
  draft: PartnerDraftView | null;
  /** Step 1.12.2 §8: каналы публикации (отделены от lifecycle). */
  publicationChannels: Array<{ channel: PublicationChannel }>;
}

/* ── Media (Step 1.2 backend) ─────────────────────────────────────────────── */

export interface PartnerMediaItem {
  id: string;
  type: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  sortOrder: number;
  isPrimary: boolean;
  caption: string | null;
  altText: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  originalFileName: string;
  createdAt: string;
}

export interface SignedPreview {
  url: string;
  expiresIn: number;
  mediaId: string;
}

/* ── Moderation (Step 1.4 backend) ────────────────────────────────────────── */

export interface PartnerModerationView {
  id: string;
  productId: string;
  productCode: string;
  productTitle: string;
  productVersion: number;
  draftVersion: number | null;
  submittedBy: { id: string | null; username: string | null };
  submittedAt: string;
  status: "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  assignedModerator: { id: string | null; username: string | null };
  reviewStartedAt: string | null;
  decidedAt: string | null;
  reasonCode: string | null;
  comment: string | null;
  previousSubmissionId: string | null;
  ageMinutes: number;
}

/* ── Client ───────────────────────────────────────────────────────────────── */

/** Запрос с multipart/form-data (upload/replace media). */
async function multipart<T>(path: string, form: FormData, method: "POST" | "PATCH"): Promise<T> {
  const res = await fetch(`/api/v1${path}`, { method, body: form, credentials: "same-origin" });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const partnerApi = {
  // Partner-safe schema (единственный источник Category Schema для dynamic form).
  schemaForCategory: (slug: string): Promise<PartnerSchemaContract> =>
    api.get<PartnerSchemaContract>(`/partner/categories/${encodeURIComponent(slug)}/schema`),

  // Категории — public contract (ACTIVE публичные категории; не internal).
  listCategories: (): Promise<PublicCategory[]> => publicApi.listCategories(),

  /** mediaRequirements продукта (через Partner-safe schema контракт, по категории продукта). */
  schemaRequirementsForProduct: async (id: string): Promise<PartnerMediaRequirements | null> => {
    const p = await api.get<{ category: { slug: string } | null }>(`/products/${encodeURIComponent(id)}`);
    if (!p.category?.slug) return null;
    try {
      const s = await partnerApi.schemaForCategory(p.category.slug);
      return s.schema.mediaRequirements ?? null;
    } catch {
      return null;
    }
  },

  // Products (own-scope назначает backend из actor context).
  listProducts: (q: PartnerListQuery = {}): Promise<Page<PartnerProductListItem>> => {
    const qs = buildPartnerListQuery(q);
    return api.get<Page<PartnerProductListItem>>(`/products${qs ? `?${qs}` : ""}`);
  },
  getProduct: (id: string): Promise<PartnerProductDetail> => api.get<PartnerProductDetail>(`/products/${encodeURIComponent(id)}`),
  createProduct: (body: {
    type: string;
    title: string;
    description?: string;
    categoryId?: string;
    attributes?: Record<string, unknown>;
    tariffs?: { name: string; price: number; currency?: string }[];
    initialNote?: string;
  }): Promise<{ product: { id: string }; eventId?: string }> => api.post(`/products`, body),
  updateProduct: (
    id: string,
    body: {
      title?: string;
      description?: string;
      categoryId?: string;
      attributes?: Record<string, unknown>;
      tariffs?: { name: string; price: number; currency?: string }[];
    },
  ): Promise<unknown> => api.patch(`/products/${encodeURIComponent(id)}`, body),

  /** Step 1.12.1 REVIEW FIX 3/4 + 1.12.2 §8: явные каналы публикации (own-scope). */
  setChannels: (id: string, channels: PublicationChannel[]): Promise<{ id: string; channels: PublicationChannel[] }> =>
    api.put(`/products/${encodeURIComponent(id)}/channels`, { channels }),

  // Moderation (Step 1.4).
  submitModeration: (id: string): Promise<PartnerModerationView> => api.post(`/products/${encodeURIComponent(id)}/submit-moderation`),
  moderationHistory: (id: string): Promise<PartnerModerationView[]> => api.get(`/products/${encodeURIComponent(id)}/moderation`),

  // Media (Step 1.2) — только собственные Product (scope на backend).
  listMedia: (id: string): Promise<PartnerMediaItem[]> => api.get(`/products/${encodeURIComponent(id)}/media`),
  uploadMedia: (id: string, files: FileList | File[]): Promise<{ media: PartnerMediaItem[] }> => {
    const form = new FormData();
    for (const f of Array.from(files)) form.append("files", f);
    return multipart(`/products/${encodeURIComponent(id)}/media`, form, "POST");
  },
  replaceMedia: (id: string, mediaId: string, file: File): Promise<PartnerMediaItem> => {
    const form = new FormData();
    form.append("file", file);
    return multipart(`/products/${encodeURIComponent(id)}/media/${encodeURIComponent(mediaId)}/replace`, form, "POST");
  },
  updateMedia: (id: string, mediaId: string, body: { caption?: string; altText?: string }): Promise<PartnerMediaItem> =>
    api.patch(`/products/${encodeURIComponent(id)}/media/${encodeURIComponent(mediaId)}`, body),
  deleteMedia: (id: string, mediaId: string): Promise<{ deleted: boolean; mediaId: string }> =>
    api.del(`/products/${encodeURIComponent(id)}/media/${encodeURIComponent(mediaId)}`),
  setPrimary: (id: string, mediaId: string): Promise<PartnerMediaItem> =>
    api.post(`/products/${encodeURIComponent(id)}/media/${encodeURIComponent(mediaId)}/set-primary`, {}),
  reorderMedia: (id: string, orderedIds: string[]): Promise<PartnerMediaItem[]> =>
    api.post(`/products/${encodeURIComponent(id)}/media/reorder`, { orderedIds }),
  // Authenticated signed preview (DRAFT media / draft preview) — не public.
  previewUrl: (id: string, mediaId: string, derivative: "thumb" | "large" | "original" = "large"): Promise<SignedPreview> =>
    api.post(`/products/${encodeURIComponent(id)}/media/${encodeURIComponent(mediaId)}/preview?derivative=${derivative}`, {}),
};
