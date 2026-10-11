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
  obligationId: string;
  obligationCode: string;
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
      `${BASE}/obligations${qs({ status: query.status, supplierCode: query.supplierCode, page: query.page, pageSize: query.pageSize })}`,
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
