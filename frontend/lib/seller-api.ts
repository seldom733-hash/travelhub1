/**
 * PHASE 1 STEP 1.11 — Public Seller Identity API client.
 *
 * PARTNER (own-scope): читает свой профиль, предлагает публичное имя/описание.
 *   НЕ может self-approve и НЕ может сам переключить visibilityMode.
 * MODERATOR: review queue — approve alias/brand, reject, request changes, hide.
 * Публичный контур (витрина) читается через lib/public-api.ts (PublicSeller).
 */
import { api, type Page } from "./api";

export type SellerVisibilityMode = "ANONYMOUS" | "VERIFIED_ALIAS" | "PUBLIC_BRAND";
export type SellerProposalStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

export interface SellerProfileView {
  id: string;
  publicId: string;
  partnerId: string;
  status: "APPROVED" | "HIDDEN";
  visibilityMode: SellerVisibilityMode;
  publicDisplayName: string | null;
  publicDescription: string | null;
  /** Authoritative geography (FIX 2) — коды; локализацию делает клиент по locale. */
  countryCode: string | null;
  cityCode: string | null;
  /** Системная country identity из crm.Partner (locale-независима). */
  systemCountryCode: string | null;
  verified: boolean;
  memberSince: string;
  approvedAt: string | null;
  approvedByUsername: string | null;
  version: number;
}

export interface SellerProposalView {
  id: string;
  code: string;
  profileId: string;
  /** Internal staff contract (hide/unhide); public контур не отдаёт partnerId. */
  partnerId: string;
  status: SellerProposalStatus;
  version: number;
  requestedDisplayName: string | null;
  requestedDescription: string | null;
  /** Город-код из справочника; страна в предложении отсутствует (системная). */
  requestedCityCode: string | null;
  /** Системная country identity партнёра (для review UI). */
  profileCountryCode: string | null;
  requestedVisibilityMode: string;
  approvedVisibilityMode: string | null;
  submittedById: string | null;
  submittedByUsername: string | null;
  submittedAt: string | null;
  reviewedById: string | null;
  reviewedByUsername: string | null;
  reviewedAt: string | null;
  decisionReason: string | null;
  decisionComment: string | null;
  createdAt: string;
}

export interface SellerProposalInput {
  publicDisplayName?: string;
  publicDescription?: string;
  /** Код города из канонического справочника (должен принадлежать стране партнёра). */
  cityCode?: string;
}

export const sellerApi = {
  // ── PARTNER: own profile / proposals ──────────────────────────────────────

  getOwnProfile(): Promise<{ profile: SellerProfileView | null; latestProposal: SellerProposalView | null }> {
    return api.get("/partner/seller-profile");
  },

  ownProposals(): Promise<SellerProposalView[]> {
    return api.get("/partner/seller-profile/proposals");
  },

  createProposal(input: SellerProposalInput): Promise<SellerProposalView> {
    return api.post("/partner/seller-profile/proposals", input);
  },

  updateProposal(id: string, input: SellerProposalInput): Promise<SellerProposalView> {
    return api.patch(`/partner/seller-profile/proposals/${encodeURIComponent(id)}`, input);
  },

  submitProposal(id: string): Promise<SellerProposalView> {
    return api.post(`/partner/seller-profile/proposals/${encodeURIComponent(id)}/submit`, {});
  },

  // ── MODERATOR: review queue (seller_public_profile.*) ─────────────────────

  listProposals(q: { status?: string; page?: number; pageSize?: number } = {}): Promise<Page<SellerProposalView>> {
    const sp = new URLSearchParams();
    if (q.status) sp.set("status", q.status);
    if (q.page && q.page > 1) sp.set("page", String(q.page));
    if (q.pageSize) sp.set("pageSize", String(q.pageSize));
    const qs = sp.toString();
    return api.get(`/seller-profiles/proposals${qs ? `?${qs}` : ""}`);
  },

  getProposal(id: string): Promise<SellerProposalView> {
    return api.get(`/seller-profiles/proposals/${encodeURIComponent(id)}`);
  },

  startReview(id: string): Promise<SellerProposalView> {
    return api.post(`/seller-profiles/proposals/${encodeURIComponent(id)}/start-review`, {});
  },

  approve(id: string, approvedVisibilityMode: "VERIFIED_ALIAS" | "PUBLIC_BRAND"): Promise<SellerProposalView> {
    return api.post(`/seller-profiles/proposals/${encodeURIComponent(id)}/approve`, { approvedVisibilityMode });
  },

  reject(id: string, reasonCode: string, comment?: string): Promise<SellerProposalView> {
    return api.post(`/seller-profiles/proposals/${encodeURIComponent(id)}/reject`, { reasonCode, comment });
  },

  requestChanges(id: string, reasonCode: string, comment?: string): Promise<SellerProposalView> {
    return api.post(`/seller-profiles/proposals/${encodeURIComponent(id)}/request-changes`, { reasonCode, comment });
  },

  hide(partnerId: string): Promise<SellerProfileView> {
    return api.post(`/seller-profiles/${encodeURIComponent(partnerId)}/hide`, {});
  },

  unhide(partnerId: string): Promise<SellerProfileView> {
    return api.post(`/seller-profiles/${encodeURIComponent(partnerId)}/unhide`, {});
  },
};
