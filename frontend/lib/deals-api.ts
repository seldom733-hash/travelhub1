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
  manager: string | null;
  travelerCount: number | null;
  serviceDate: string | null;
  createdAt: string;
  salesAmount: string;
  costAmount: string;
  clientReceived: string;
  clientDebt: string;
  clientRefunded: string;
  supplierPaid: string;
  supplierDebt: string;
  supplierRefunded: string;
  clientPenalty: string;
  supplierPenalty: string;
  expectedIncome: string;
  currentIncome: string;
  currency: string;
  financialStatus: string;
  paymentStatus: string;
  supplierPaymentStatus: string;
  payments: Array<{ id: string; code: string; amount: string; currency: string; status: string; method: string | null; date: string }>;
  refunds: Array<{ id: string; code: string; amount: string; currency: string; status: string; date: string }>;
  payouts: Array<{ id: string; code: string; amount: string; currency: string; status: string; direction: string; date: string }>;
}

export interface DealKpi {
  salesAmount: string; costAmount: string; clientReceived: string; clientDebt: string;
  clientRefunded: string; supplierPaid: string; supplierDebt: string; supplierRefunded: string;
  clientPenalty: string; supplierPenalty: string; expectedIncome: string; currentIncome: string;
  currency: string; count: number;
}

export interface DealList {
  items: DealRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  kpi: DealKpi;
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
