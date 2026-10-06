/**
 * Supplier Markup (PHASE 4 §4.1/§4.2) — Pricing admin API.
 *
 * GET /pricing/markup-matrix — Supplier × Service матрица (строки/колонки
 * строятся backend-ом из реестров поставщиков, без хардкода на клиенте).
 * MarkupRule lifecycle: create (DRAFT) → update (CAS expectedVersion → 409)
 * → activate / archive + history (audit).
 */
import { api } from "./api";

const BASE = "/pricing";

export interface MarkupMatrixCell {
  supplierCode: string;
  serviceType: string;
  state: "CONFIGURED" | "NOT_CONFIGURED";
  rate: string;
  ruleCode: string | null;
  ruleVersion: number | null;
}

export interface MarkupMatrix {
  at: string;
  services: string[];
  suppliers: Array<{ code: string; name: string; enabled: boolean }>;
  cells: MarkupMatrixCell[];
}

export interface MarkupRule {
  id: string;
  code: string;
  supplierCode: string;
  serviceType: string;
  rate: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarkupRuleList {
  items: MarkupRule[];
  page: number;
  pageSize: number;
  total: number;
}

export interface MarkupRuleHistoryItem {
  id: string;
  action: string;
  version: number;
  fields: Record<string, unknown>;
  actorId: string | null;
  actorName: string | null;
  comment: string | null;
  createdAt: string;
}

export interface MarkupRuleListQuery {
  supplierCode?: string;
  serviceType?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface MarkupRuleWriteBody {
  supplierCode: string;
  serviceType: string;
  rate: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface MarkupRuleUpdateBody {
  rate?: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  expectedVersion?: number;
}

export const pricingApi = {
  matrix: () => api.get<MarkupMatrix>(`${BASE}/markup-matrix`),
  rules: {
    list: (query: MarkupRuleListQuery = {}) => {
      const params = new URLSearchParams();
      if (query.supplierCode) params.set("supplierCode", query.supplierCode);
      if (query.serviceType) params.set("serviceType", query.serviceType);
      if (query.status) params.set("status", query.status);
      if (query.page) params.set("page", String(query.page));
      if (query.pageSize) params.set("pageSize", String(query.pageSize));
      const qs = params.toString();
      return api.get<MarkupRuleList>(`${BASE}/markup-rules${qs ? `?${qs}` : ""}`);
    },
    create: (body: MarkupRuleWriteBody) => api.post<MarkupRule>(`${BASE}/markup-rules`, body),
    update: (code: string, body: MarkupRuleUpdateBody) => api.patch<MarkupRule>(`${BASE}/markup-rules/${code}`, body),
    activate: (code: string) => api.post<MarkupRule>(`${BASE}/markup-rules/${code}/activate`),
    archive: (code: string) => api.post<MarkupRule>(`${BASE}/markup-rules/${code}/archive`),
    history: (code: string) => api.get<{ items: MarkupRuleHistoryItem[] }>(`${BASE}/markup-rules/${code}/history`),
  },
};

/** Rate "0.075" → "7.5%" (decimal-safe: 6 знаков rate → ≤4 знака percent). */
export function formatRatePercent(rate: string): string {
  const n = Number(rate);
  if (!Number.isFinite(n)) return rate;
  return `${Number((n * 100).toFixed(4))}%`;
}
