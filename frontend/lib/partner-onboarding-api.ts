/**
 * PHASE 1 STEP 1.10 — Partner Registration & Onboarding API client.
 *
 * Публичная регистрация (не activation) создаёт User (PARTNER) + DRAFT
 * PartnerApplication; selling-доступ выдаётся ТОЛЬКО approve (review queue).
 * Frontend НИКОГДА не отправляет role/partnerId/status — backend отклоняет
 * forged поля (422).
 */
import { api, type AuthUser, type Page } from "./api";

/* ── Public registration ─────────────────────────────────────────────────── */

export type ApplicantType = "INDIVIDUAL" | "COMPANY";

export interface PartnerRegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  applicantType: ApplicantType;
  brandName: string;
  country: string;
  legalName?: string;
  registrationNumber?: string;
  taxId?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  businessDescription?: string;
  serviceCategories?: string[];
  termsAccepted: boolean;
}

export interface PartnerRegisterResult {
  accessToken: string;
  user: AuthUser;
}

/* ── Own application ─────────────────────────────────────────────────────── */

export type PartnerApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED"
  | "CANCELLED";

export interface PartnerApplicationView {
  id: string;
  code: string;
  userId: string;
  partnerId: string | null;
  status: PartnerApplicationStatus;
  applicantType: ApplicantType;
  legalName: string | null;
  brandName: string;
  country: string;
  registrationNumber: string | null;
  taxId: string | null;
  website: string | null;
  contactEmail: string;
  contactPhone: string | null;
  address: string | null;
  businessDescription: string | null;
  serviceCategories: string[] | null;
  termsAccepted: boolean;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedById: string | null;
  reviewedByUsername: string | null;
  decisionReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  editable: boolean;
  history: {
    id: string;
    action: string;
    from: string | null;
    to: string | null;
    fields: Record<string, unknown> | null;
    actorId: string | null;
    actorName: string | null;
    comment: string | null;
    createdAt: string;
  }[];
}

export interface UpdateOwnApplicationInput {
  legalName?: string;
  brandName?: string;
  country?: string;
  registrationNumber?: string;
  taxId?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  businessDescription?: string;
  serviceCategories?: string[];
  version: number;
}

/* ── Review queue ────────────────────────────────────────────────────────── */

export interface ReviewQueueItem {
  id: string;
  code: string;
  userId: string;
  status: PartnerApplicationStatus;
  applicantType: ApplicantType;
  brandName: string;
  country: string;
  legalName: string | null;
  registrationNumber: string | null;
  submittedAt: string | null;
  reviewedByUsername: string | null;
  decisionReason: string | null;
  user: { id: string; username: string; email: string | null };
}

export interface ReviewDecisionResult {
  applicationId: string;
  status: PartnerApplicationStatus;
  partnerId?: string | null;
  partnerCreated?: boolean;
  alreadyApproved?: boolean;
  alreadyRejected?: boolean;
}

export const partnerOnboardingApi = {
  /** Публичная регистрация PARTNER (создаёт DRAFT, без selling access). */
  register(input: PartnerRegisterInput): Promise<PartnerRegisterResult> {
    return api.post("/auth/partner-register", input);
  },

  /** Собственная заявка (own-scope). null/{} — legacy PARTNER без заявки. */
  getOwnApplication(): Promise<PartnerApplicationView | null> {
    return api.get("/partner/application");
  },

  /** Правка собственной заявки (DRAFT/CHANGES_REQUESTED; version = optimistic lock). */
  updateOwnApplication(input: UpdateOwnApplicationInput): Promise<PartnerApplicationView> {
    return api.patch("/partner/application", input);
  },

  /** Submit на review (DRAFT/CHANGES_REQUESTED → SUBMITTED). */
  submitOwnApplication(): Promise<PartnerApplicationView> {
    return api.post("/partner/application/submit", {});
  },

  // ── Internal review queue (partner.onboarding.review) ────────────────────

  listReviewQueue(q: { status?: string; search?: string; page?: number; pageSize?: number } = {}): Promise<Page<ReviewQueueItem>> {
    const sp = new URLSearchParams();
    if (q.status) sp.set("status", q.status);
    if (q.search?.trim()) sp.set("search", q.search.trim());
    if (q.page && q.page > 1) sp.set("page", String(q.page));
    if (q.pageSize) sp.set("pageSize", String(q.pageSize));
    const qs = sp.toString();
    return api.get(`/partner/onboarding/review${qs ? `?${qs}` : ""}`);
  },

  getReviewApplication(id: string): Promise<PartnerApplicationView & { user: { id: string; username: string; email: string | null } }> {
    return api.get(`/partner/onboarding/review/${encodeURIComponent(id)}`);
  },

  startReview(id: string): Promise<unknown> {
    return api.post(`/partner/onboarding/review/${encodeURIComponent(id)}/start`, {});
  },

  approve(id: string, reason?: string): Promise<ReviewDecisionResult> {
    return api.post(`/partner/onboarding/review/${encodeURIComponent(id)}/approve`, { reason });
  },

  reject(id: string, reason: string): Promise<ReviewDecisionResult> {
    return api.post(`/partner/onboarding/review/${encodeURIComponent(id)}/reject`, { reason });
  },

  requestChanges(id: string, reason: string): Promise<ReviewDecisionResult> {
    return api.post(`/partner/onboarding/review/${encodeURIComponent(id)}/request-changes`, { reason });
  },
};
