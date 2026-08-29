/**
 * PHASE 3 — STEP 3.11 — Support Center shared types, constants, and helpers.
 *
 * Centralizes support domain logic to avoid duplication across list/create/detail routes.
 */

import { api, type Page } from "./api";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface SupportCase {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  caseType: string;
  priority: string;
  status: string;
  source?: string | null;
  customerId?: string | null;
  orderId?: string | null;
  bookingId?: string | null;
  assignedToId?: string | null;
  slaDeadline?: string | null;
  slaBreached?: boolean;
  escalatedAt?: string | null;
  escalatedById?: string | null;
  escalationReason?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  comments?: CaseComment[];
  history?: CaseHistory[];
  caseLinks?: CaseLink[];
}

export interface CaseComment {
  id: string;
  caseId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface CaseHistory {
  id: string;
  caseId: string;
  action: string;
  actorId?: string | null;
  actorName?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  details?: string | null;
  createdAt: string;
}

export interface CaseLink {
  id: string;
  caseId: string;
  communicationId: string;
  createdAt: string;
}

export interface SupportStats {
  total: number;
  open: number;
  inProgress: number;
  waiting: number;
  escalated: number;
  resolved: number;
  closed: number;
}

/* ── Constants ─────────────────────────────────────────────────────────────── */

export const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "WAITING_CUSTOMER", "WAITING_PARTNER", "WAITING_INTERNAL", "ESCALATED", "CLOSED"],
  IN_PROGRESS: ["WAITING_CUSTOMER", "WAITING_PARTNER", "WAITING_INTERNAL", "ESCALATED", "RESOLVED", "CLOSED"],
  WAITING_CUSTOMER: ["IN_PROGRESS", "ESCALATED", "CLOSED"],
  WAITING_PARTNER: ["IN_PROGRESS", "ESCALATED", "CLOSED"],
  WAITING_INTERNAL: ["IN_PROGRESS", "ESCALATED", "CLOSED"],
  ESCALATED: ["IN_PROGRESS", "WAITING_CUSTOMER", "WAITING_PARTNER", "WAITING_INTERNAL", "RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED", "OPEN"],
  CLOSED: [],
};

export const CASE_TYPES = [
  "GENERAL", "ORDER_ISSUE", "BOOKING_ISSUE", "PAYMENT_ISSUE",
  "REFUND_REQUEST", "TECHNICAL", "BILLING", "PARTNER_ISSUE", "PRODUCT_QUALITY",
] as const;

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

/** History event action → i18n key + localized event title */
export const HISTORY_EVENT_MAP: Record<string, { titleKey: string; showValues: boolean }> = {
  created: { titleKey: "support.history.event.created", showValues: false },
  assigned: { titleKey: "support.history.event.assigned", showValues: true },
  escalated: { titleKey: "support.history.event.escalated", showValues: true },
  comment: { titleKey: "support.history.event.comment", showValues: false },
  priority: { titleKey: "support.history.event.priority", showValues: true },
  caseType: { titleKey: "support.history.event.caseType", showValues: true },
  title: { titleKey: "support.history.event.title", showValues: true },
  description: { titleKey: "support.history.event.description", showValues: false },
  case_deleted: { titleKey: "support.history.event.case_deleted", showValues: false },
};

/** Detect status transition actions (status:STATUS format) */
export function isStatusTransition(action: string): boolean {
  return action.startsWith("status:");
}

export function parseStatusTransition(action: string): { from: string | null; to: string | null } {
  if (!isStatusTransition(action)) return { from: null, to: null };
  // action = "status:ESCALATED", previousValue = "OPEN", newValue = "ESCALATED"
  // or action = "status:IN_PROGRESS", previousValue = "OPEN", newValue = "IN_PROGRESS"
  return { from: null, to: action.replace("status:", "") };
}

/* ── API helpers ───────────────────────────────────────────────────────────── */

export const supportApi = {
  list: (page: number, pageSize: number, filters?: { status?: string; priority?: string; caseType?: string }) => {
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filters?.status) qs.set("status", filters.status);
    if (filters?.priority) qs.set("priority", filters.priority);
    if (filters?.caseType) qs.set("caseType", filters.caseType);
    return api.get<Page<SupportCase>>(`/support/cases?${qs}`);
  },

  get: (id: string) => api.get<SupportCase>(`/support/cases/${id}`),

  create: (data: { title: string; description?: string; caseType?: string; priority?: string; source?: string }) =>
    api.post<SupportCase>("/support/cases", data),

  update: (id: string, data: { title?: string; description?: string; caseType?: string; priority?: string }) =>
    api.patch<SupportCase>(`/support/cases/${id}`, data),

  transition: (id: string, status: string) =>
    api.post<SupportCase>(`/support/cases/${id}/transition`, { status }),

  delete: (id: string, reason: string) =>
    api.post<SupportCase>(`/support/cases/${id}/delete`, { reason }),

  stats: () => api.get<SupportStats>("/support/stats"),
};
