import { api, type Page } from "./api";

export type DocumentType = "PARTIAL_PAYMENT" | "VOUCHER" | "REFUND";
export type DocumentStatus = "NOT_ISSUED" | "ISSUED" | "SUPERSEDED" | "INVALIDATED";

export interface DocumentListItem {
  id: string;
  code: string;
  type: DocumentType;
  status: DocumentStatus;
  bookingCode: string | null;
  serviceDate: string | null;
  totalAmount: string | null;
  paidAmount: string | null;
  currency: string | null;
  paymentStatus: string | null;
  version: number;
  createdAt: string;
}

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  snapshot: Record<string, unknown> | null;
  createdAt: string;
}

export interface DocumentHistoryEntry {
  id: string;
  action: string;
  comment: string | null;
  createdAt: string;
}

export interface DocumentDetail {
  id: string;
  code: string;
  type: DocumentType;
  status: DocumentStatus;
  serviceDate: string | null;
  totalAmount: string | null;
  paidAmount: string | null;
  currency: string | null;
  paymentStatus: string | null;
  version: number;
  createdAt: string;
  versions: DocumentVersion[];
  history: DocumentHistoryEntry[];
}

export const DOCUMENT_TYPES: readonly DocumentType[] = ["VOUCHER", "PARTIAL_PAYMENT", "REFUND"] as const;
export const DOCUMENT_STATUSES: readonly DocumentStatus[] = ["NOT_ISSUED", "ISSUED", "SUPERSEDED", "INVALIDATED"] as const;

export const documentsApi = {
  list: (opts?: { page?: number; pageSize?: number; type?: DocumentType; status?: DocumentStatus }) => {
    const sp = new URLSearchParams();
    if (opts?.page) sp.set("page", String(opts.page));
    if (opts?.pageSize) sp.set("pageSize", String(opts.pageSize));
    if (opts?.type) sp.set("type", opts.type);
    if (opts?.status) sp.set("status", opts.status);
    const qs = sp.toString();
    return api.get<Page<DocumentListItem>>(`/documents${qs ? `?${qs}` : ""}`);
  },

  get: (id: string) => api.get<DocumentDetail>(`/documents/${id}`),

  downloadUrl: (id: string) => `/api/v1/documents/${id}/download`,

  invalidate: (id: string, reason: string) =>
    api.post<{ success: boolean }>(`/documents/${id}/invalidate`, { reason }),
};
