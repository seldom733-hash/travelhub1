/**
 * PHASE 1 STEP 1.12.2 — Partner Storefront API client (partner-own + public).
 *
 * Partner-own контур (/partner/storefront*) — через lib/api.ts (JWT, own-scope:
 * ownership source ТОЛЬКО actor.partnerId; forged partnerId/countryCode/status
 * отклоняются сервером).
 *
 * Публичный контур (/store/:slug) — через lib/public-api.ts (БЕЗ Authorization,
 * даже при залогиненном пользователе; whitelist DTO).
 */
import { api } from "./api";

export type StorefrontStatus = "DRAFT" | "ACTIVE" | "INACTIVE";
export type StorefrontEntitlement = "NONE" | "ACTIVE" | "SUSPENDED" | "EXPIRED";
export type StorefrontMediaKind = "LOGO" | "HERO";

export interface SocialLinkInput {
  platform: string;
  url: string;
}

export interface StorefrontMediaView {
  id: string;
  kind: StorefrontMediaKind;
  mimeType: string;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface StorefrontView {
  id: string;
  code: string;
  partnerId: string;
  slug: string;
  status: StorefrontStatus;
  entitlementStatus: StorefrontEntitlement;
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
  socialLinks: SocialLinkInput[] | null;
  heroHeading: string | null;
  heroSubheading: string | null;
  themePreset: string;
  media: StorefrontMediaView[];
  publicUrl: string;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  deactivatedAt: string | null;
}

export interface StorefrontUpdateInput {
  businessName?: string;
  tagline?: string;
  description?: string;
  defaultLocale?: string;
  cityCode?: string;
  publicPhone?: string;
  publicEmail?: string;
  websiteUrl?: string;
  whatsapp?: string;
  socialLinks?: SocialLinkInput[];
  heroHeading?: string;
  heroSubheading?: string;
  themePreset?: string;
}

/** Публичная витрина (whitelist DTO из backend public-catalog.types). */
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
  media: Array<{ id: string; kind: StorefrontMediaKind; url: string }>;
  seller: {
    publicId: string;
    displayName: string | null;
    visibilityMode: "ANONYMOUS" | "VERIFIED_ALIAS" | "PUBLIC_BRAND";
    verified: boolean;
    memberSince: string;
    countryCode: string | null;
    cityCode: string | null;
  } | null;
  activatedAt: string;
}

export const STOREFRONT_LOCALES = ["ru", "az", "en"] as const;
export const STOREFRONT_THEMES = ["default", "forest", "ocean", "sunset", "mono"] as const;
export const SOCIAL_PLATFORMS = ["instagram", "facebook", "telegram", "tiktok", "youtube", "linkedin", "x", "vk"] as const;

export const storefrontApi = {
  // ── PARTNER own-scope ─────────────────────────────────────────────────────

  getOwn(): Promise<StorefrontView> {
    return api.get("/partner/storefront");
  },

  create(input: { slug: string; businessName?: string; tagline?: string; description?: string; defaultLocale?: string }): Promise<StorefrontView> {
    return api.post("/partner/storefront", input);
  },

  update(input: StorefrontUpdateInput): Promise<StorefrontView> {
    return api.patch("/partner/storefront", input);
  },

  activate(): Promise<StorefrontView> {
    return api.post("/partner/storefront/activate", {});
  },

  deactivate(): Promise<StorefrontView> {
    return api.post("/partner/storefront/deactivate", {});
  },

  /** Upload/replace logo|hero (multipart, до 15 MB). */
  async uploadMedia(kind: StorefrontMediaKind, file: File): Promise<StorefrontView> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/v1/partner/storefront/media/" + kind, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("travelhub.token") ?? ""}` },
      body: fd,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
    return body as StorefrontView;
  },

  deleteMedia(kind: StorefrontMediaKind): Promise<StorefrontView> {
    return api.del(`/partner/storefront/media/${kind}`);
  },

  /** Owner-only preview: short-lived signed URL (не публикует витрину). */
  previewMedia(mediaId: string): Promise<{ url: string; expiresIn: number; mediaId: string }> {
    return api.get(`/partner/storefront/media/${encodeURIComponent(mediaId)}/preview`);
  },
};

export interface PublicStorefrontListResult {
  items: Array<{
    id: string;
    slug: string;
    title: string;
    shortDescription: string | null;
    type: string;
    category: { id: string; slug: string; title: string } | null;
    primaryImage: { id: string; thumbUrl: string; largeUrl: string } | null;
    priceFrom: string | null;
    currency: string | null;
    availabilitySummary: { availableFrom: string | null; datesCount: number; totalSlots: number; totalBooked: number; totalReserved: number } | null;
    publishedAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}
