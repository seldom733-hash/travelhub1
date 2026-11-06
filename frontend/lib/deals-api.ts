import { api } from "@/lib/api";

export interface DealRow {
  sequence: string;
  requestId: string;
  requestCode: string;
  orderId: string | null;
  orderCode: string | null;
  bookingId: string | null;
  bookingCode: string | null;
  stage: "REQUEST" | "ORDER" | "BOOKING";
  stageLabel: string;
  status: string;
  orderStatus: string | null;
  statusLabel: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  productId: string | null;
  productType: string | null;
  productTitle: string;
  supplierId: string | null;
  supplierCode: string | null;
  supplierName: string | null;
  cancellationReason: string | null;
  isCancelledDeal: boolean;
  cancellationResult: string;
  settlementStatus: string | null;
  manager: string | null;
  managerId: string | null;
  travelerCount: number | null;
  serviceDate: string | null;
  createdAt: string;
  salesAmount: string;
  costAmount: string;
  grossMargin: string;
  supplierBasePrice: string;
  supplierBaseCurrency: string;
  supplierBasePriceAzn: string;
  channel: string;
  trip: { country: string | null; dateFrom: string | null; dateTo: string | null; nights: number | null; adults: number | null; children: number | null };
  services: Array<{ id: string; title: string; type: string; serviceDate: string | null; clientPrice: string; cost: string; income: string; mediaId: string | null }>;
  markupAmount: string;
  commissionAmount: string;
  clientReceived: string;
  clientDebt: string;
  clientRefunded: string;
  clientRefundPending: string;
  clientRefundTotal: string;
  supplierPaid: string;
  supplierDebt: string;
  supplierRefunded: string;
  supplierRefundDue: string;
  clientPenalty: string;
  supplierPenalty: string;
  expectedIncome: string;
  currentIncome: string;
  cancelledSalesAmount: string;
  lostIncome: string;
  currency: string;
  financialStatus: string;
  paymentStatus: string;
  supplierPaymentStatus: string;
  payments: Array<{ id: string; code: string; amount: string; currency: string; status: string; method: string | null; date: string }>;
  refunds: Array<{ id: string; code: string; amount: string; currency: string; status: string; date: string; method: string | null }>;
  payouts: Array<{ id: string; code: string; amount: string; currency: string; status: string; direction: string; method: string | null; date: string; supplierCode: string | null; supplierName: string | null }>;
}

export interface DealKpi {
  salesAmount: string; costAmount: string; grossMargin: string; clientReceived: string; clientDebt: string;
  clientRefunded: string; supplierPaid: string; supplierDebt: string; supplierRefunded: string;
  clientPenalty: string; supplierPenalty: string; expectedIncome: string; currentIncome: string;
  cancelledSalesAmount: string; lostIncome: string;
  cancellationIncome: string; cancellationLoss: string; writeOffExpense: string; cancelledCount: number;
  currency: string; count: number;
}

export interface DealList {
  items: DealRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  kpi: DealKpi;
  facets: { countries: string[]; managers: string[]; suppliers: Array<{ value: string; label: string }> };
}

export interface DealScheduleItem {
  id: string;
  stage: string;
  dueDate: string;
  amount: string;
  percent: number | null;
  condition: string | null;
  status: string;
  note: string | null;
  sortOrder: number;
}

export type DealQuery = Record<string, string | number | undefined>;

export const dealsApi = {
  list(query: DealQuery = {}): Promise<DealList> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    return api.get(`/finance/deals${qs ? `?${qs}` : ""}`);
  },
  bySequence(sequence: string): Promise<DealRow | null> {
    return api.get(`/finance/deals/${encodeURIComponent(sequence)}`);
  },
  schedule(sequence: string): Promise<DealScheduleItem[]> {
    return api.get(`/finance/deals/${encodeURIComponent(sequence)}/schedule`);
  },
  createSchedule(sequence: string, body: { stage: string; dueDate: string; amount: number; percent?: number; condition?: string; note?: string }): Promise<DealScheduleItem> {
    return api.post(`/finance/deals/${encodeURIComponent(sequence)}/schedule`, body);
  },
  updateSchedule(sequence: string, id: string, body: { status?: string; amount?: number; condition?: string }): Promise<DealScheduleItem> {
    return api.patch(`/finance/deals/${encodeURIComponent(sequence)}/schedule/${encodeURIComponent(id)}`, body);
  },
  async exportXlsx(query: DealQuery = {}): Promise<Blob> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const res = await fetch(`/api/v1/finance/deals/export?${params.toString()}`, { credentials: "include" });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    return res.blob();
  },
};
