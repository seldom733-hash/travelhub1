/**
 * UNIFIED FINANCE CENTER Phase 3/4 — Finance Center API client.
 *
 * Клиент для сводных KPI (GET /finance/overview), обязательств и выплат
 * поставщикам. Следует конвенции lib/finance-fx-api.ts (api.get/post +
 * BASE "/finance/..."). Все денежные значения — строки (backend Decimal →
 * JSON string), НИКОГДА не числа с плавающей точкой.
 */
import { api } from "./api";

const BASE = "/finance";

// ── Overview (Phase 3) ──────────────────────────────────────────────────────

export type Availability = "OK" | "PARTIAL" | "UNKNOWN" | "UNAVAILABLE";

export interface AznMetric {
  amount: string | null;
  availability: Availability;
  unknownCount?: number;
  knownCount?: number;
  note?: string;
}

export interface CurrencyAmount {
  currency: string;
  amount: string;
}

export interface FinanceOverview {
  range: { from: string | null; to: string | null };
  obligations: {
    totalAzn: string;
    paidAzn: string;
    remainingAzn: string;
    count: number;
    unknownCount: number;
  };
  supplierPayouts: { paidAzn: string; count: number };
  /** Finance completion: overdue / due soon / pending / unallocated KPI. */
  supplierPayables: {
    overdueAzn: string;
    overdueCount: number;
    dueSoonAzn: string;
    dueSoonCount: number;
    pendingPaymentsAzn: string;
    pendingPaymentsCount: number;
    unallocatedAzn: string;
    unallocatedCount: number;
    byStatus: Array<{ status: string; count: number; remainingAzn: string }>;
  };
  expectedMargin: AznMetric;
  customerReceipts: { byCurrency: CurrencyAmount[]; azn: AznMetric };
  customerDebt: { byCurrency: CurrencyAmount[]; azn: AznMetric };
  actualProfit: AznMetric;
  netCashFlow: AznMetric;
  generatedAt: string;
}

// ── Obligations / payouts (Phase 2) ────────────────────────────────────────

export interface SupplierPayout {
  id: string;
  code: string;
  obligationId: string | null;
  obligationCode: string;
  status: string;
  supplierCode: string | null;
  partnerId: string | null;
  purpose: string | null;
  comment: string | null;
  confirmedAt: string | null;
  amount: string;
  currency: string;
  aznAmount: string;
  fxRate: string | null;
  fxVariance: string | null;
  method: string | null;
  providerRef: string | null;
  occurredAt: string;
  reason: string | null;
  evidenceUrl: string | null;
  actorId: string | null;
  createdAt: string;
}

export interface SupplierObligation {
  id: string;
  code: string;
  bookingId: string;
  bookingCode: string | null;
  orderId: string;
  orderCode: string | null;
  orderItemId: string | null;
  invoiceNumber: string | null;
  dueDate: string | null;
  overdue: boolean;
  displayStatus: string;
  supplierCode: string | null;
  partnerId: string | null;
  partnerCode: string | null;
  serviceType: string | null;
  sourceAmount: string;
  sourceCurrency: string;
  aznAmount: string | null;
  fxRate: string | null;
  fxRateCode: string | null;
  status: string;
  paidAmount: string;
  remainingAmount: string | null;
  amountUnknown: boolean;
  source: string;
  sourceEventId: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  payouts?: SupplierPayout[];
}

export interface ObligationListQuery {
  status?: string;
  supplierCode?: string;
  orderId?: string;
  overdue?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreatePayoutInput {
  amount: string;
  currency: string;
  aznAmount?: string;
  fxRate?: string;
  method?: string;
  providerRef?: string;
  occurredAt?: string;
  reason?: string;
  evidenceUrl?: string;
}

export interface AdjustObligationInput {
  newAznAmount: string;
  newSourceAmount?: string;
  reason?: string;
}

/** Распределение платежа поставщику по обязательству. */
export interface SupplierPaymentAllocation {
  id: string;
  obligationId: string;
  obligationCode: string;
  amount: string;
  aznAmount: string;
  reversedAt: string | null;
  createdAt: string;
}

/** Платёж поставщику (PENDING → CONFIRMED → CANCELLED). */
export interface SupplierPayment {
  id: string;
  code: string;
  status: string;
  supplierCode: string | null;
  partnerId: string | null;
  partnerCode: string | null;
  amount: string;
  currency: string;
  aznAmount: string;
  allocatedAzn: string;
  unallocatedAzn: string;
  unallocatedReason: "NONE" | "NOT_ALLOCATED" | "FX_VARIANCE" | "PARTIAL";
  method: string | null;
  providerRef: string | null;
  purpose: string | null;
  comment: string | null;
  occurredAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  actorId: string | null;
  version: number;
  createdAt: string;
  allocations: SupplierPaymentAllocation[];
}

export interface SupplierPaymentDocument {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedById?: string | null;
  createdAt: string;
}

export interface SupplierPaymentTerms {
  supplierCode: string;
  rule: "IMMEDIATE" | "NET_DAYS";
  days: number;
  active: boolean;
  updatedById?: string | null;
  updatedAt: string;
}

export interface CreateSupplierPaymentInput {
  partnerId?: string;
  supplierCode?: string;
  amount: string;
  currency: string;
  aznAmount?: string;
  method?: string;
  providerRef?: string;
  purpose?: string;
  comment?: string;
  occurredAt?: string;
  allocations?: Array<{ obligationCode: string; amount: string; aznAmount?: string }>;
}

export interface SupplierPaymentListQuery {
  status?: string;
  supplierCode?: string;
  partnerId?: string;
  currency?: string;
  from?: string;
  to?: string;
  search?: string;
  unallocated?: boolean;
  page?: number;
  pageSize?: number;
}

/** Отчёт «задолженность на дату» — историческая реконструкция. */
export interface DebtAsOfRow {
  obligationCode: string;
  invoiceNumber: string | null;
  supplierCode: string | null;
  partnerCode: string | null;
  orderCode: string | null;
  bookingCode: string | null;
  sourceAmount: string;
  sourceCurrency: string;
  aznAmount: string | null;
  paidAzn: string;
  remainingAzn: string | null;
  dueDate: string | null;
  status: string;
  overdue: boolean;
  precision: "EVENT" | "LEGACY_CURRENT";
}

export interface DebtAsOfReport {
  asOf: string;
  generatedAt: string;
  totalsByCurrency: Array<{
    currency: string;
    count: number;
    sourceAmount: string;
    aznAmount: string;
    paidAzn: string;
    remainingAzn: string;
    unknownCount: number;
  }>;
  items: DebtAsOfRow[];
  total: number;
  page: number;
  pageSize: number;
  warnings: string[];
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const financeCenterApi = {
  overview(from?: string, to?: string): Promise<FinanceOverview> {
    return api.get<FinanceOverview>(`${BASE}/overview${qs({ from, to })}`);
  },

  listObligations(query: ObligationListQuery = {}): Promise<{ items: SupplierObligation[]; total: number; page: number; pageSize: number }> {
    return api.get(
      `${BASE}/obligations${qs({
        status: query.status,
        supplierCode: query.supplierCode,
        overdue: query.overdue ? "true" : undefined,
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
      })}`,
    );
  },

  getObligation(code: string): Promise<SupplierObligation> {
    return api.get(`${BASE}/obligations/${encodeURIComponent(code)}`);
  },

  listPayouts(query: { obligationCode?: string; page?: number; pageSize?: number } = {}): Promise<{ items: SupplierPayout[]; total: number; page: number; pageSize: number }> {
    return api.get(`${BASE}/payouts${qs(query)}`);
  },

  createPayout(obligationCode: string, input: CreatePayoutInput): Promise<SupplierPayout> {
    return api.post(`${BASE}/obligations/${encodeURIComponent(obligationCode)}/payouts`, input);
  },

  cancelObligation(code: string, reason?: string): Promise<SupplierObligation> {
    return api.post(`${BASE}/obligations/${encodeURIComponent(code)}/cancel`, { reason });
  },

  adjustObligation(code: string, input: AdjustObligationInput): Promise<SupplierObligation> {
    return api.post(`${BASE}/obligations/${encodeURIComponent(code)}/adjust`, input);
  },

  /** Счёт поставщика / срок оплаты (только метаданные, audit). */
  updateObligationTerms(
    code: string,
    input: { dueDate?: string | null; invoiceNumber?: string | null; reason?: string },
  ): Promise<SupplierObligation> {
    return api.patch(`${BASE}/obligations/${encodeURIComponent(code)}`, input);
  },

  // ── Supplier payments registry ────────────────────────────────────────────

  listSupplierPayments(
    query: SupplierPaymentListQuery = {},
  ): Promise<{ items: SupplierPayment[]; total: number; page: number; pageSize: number }> {
    return api.get(`${BASE}/supplier-payments${qs({
      status: query.status,
      supplierCode: query.supplierCode,
      partnerId: query.partnerId,
      currency: query.currency,
      from: query.from,
      to: query.to,
      search: query.search,
      unallocated: query.unallocated ? "true" : undefined,
      page: query.page,
      pageSize: query.pageSize,
    })}`);
  },

  getSupplierPayment(code: string): Promise<SupplierPayment> {
    return api.get(`${BASE}/supplier-payments/${encodeURIComponent(code)}`);
  },

  createSupplierPayment(input: CreateSupplierPaymentInput, idempotencyKey?: string): Promise<SupplierPayment> {
    // Client must reuse the same key when retrying the SAME payload after a
    // lost/timed-out response; the page preserves it until success or edit.
    const key =
      idempotencyKey ??
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    return api.post(`${BASE}/supplier-payments`, input, { "Idempotency-Key": key });
  },

  confirmSupplierPayment(code: string): Promise<SupplierPayment> {
    return api.post(`${BASE}/supplier-payments/${encodeURIComponent(code)}/confirm`, {});
  },

  allocateSupplierPayment(
    code: string,
    input: { obligationCode: string; amount: string; aznAmount?: string },
  ): Promise<SupplierPayment> {
    return api.post(`${BASE}/supplier-payments/${encodeURIComponent(code)}/allocations`, input);
  },

  cancelSupplierPayment(code: string, reason?: string): Promise<SupplierPayment> {
    return api.post(`${BASE}/supplier-payments/${encodeURIComponent(code)}/cancel`, { reason });
  },

  // ── Evidence documents (private S3 + signed URL) ──────────────────────────

  listSupplierPaymentDocuments(code: string): Promise<{ paymentCode: string; items: SupplierPaymentDocument[] }> {
    return api.get(`${BASE}/supplier-payments/${encodeURIComponent(code)}/documents`);
  },

  uploadSupplierPaymentDocuments(code: string, files: File[]): Promise<{ paymentCode: string; items: SupplierPaymentDocument[] }> {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    return api.postForm(`${BASE}/supplier-payments/${encodeURIComponent(code)}/documents`, form);
  },

  downloadSupplierPaymentDocument(
    code: string,
    documentId: string,
  ): Promise<{ url: string; fileName: string; mimeType: string }> {
    return api.get(
      `${BASE}/supplier-payments/${encodeURIComponent(code)}/documents/${encodeURIComponent(documentId)}/download`,
    );
  },

  deleteSupplierPaymentDocument(code: string, documentId: string): Promise<{ ok: true }> {
    return api.del(`${BASE}/supplier-payments/${encodeURIComponent(code)}/documents/${encodeURIComponent(documentId)}`);
  },

  // ── Supplier payment terms (minimal: IMMEDIATE / NET_DAYS) ───────────────

  listSupplierPaymentTerms(): Promise<SupplierPaymentTerms[]> {
    return api.get(`${BASE}/supplier-payment-terms`);
  },

  upsertSupplierPaymentTerms(input: {
    supplierCode: string;
    rule: "IMMEDIATE" | "NET_DAYS";
    days?: number;
    active?: boolean;
  }): Promise<SupplierPaymentTerms> {
    return api.put(`${BASE}/supplier-payment-terms`, input);
  },

  // ── Historical reports ────────────────────────────────────────────────────

  supplierDebtAsOf(query: {
    asOf?: string;
    supplierCode?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<DebtAsOfReport> {
    return api.get(`${BASE}/reports/supplier-debt${qs(query as Record<string, string | number | undefined>)}`);
  },
};

/** Цветовой акцент статуса obligation для бейджа. */
export function obligationStatusTone(status: string): string {
  switch (status) {
    case "OPEN":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "PARTIALLY_PAID":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "CLOSED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "CANCELLED":
      return "border-slate-200 bg-slate-100 text-slate-500";
    case "ADJUSTED":
      return "border-violet-200 bg-violet-50 text-violet-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}
