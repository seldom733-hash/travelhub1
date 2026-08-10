/**
 * PHASE 2 STEP 2.1 — Sales Domain Foundation: read-contract DTO (whitelist).
 * Внутренний staff-контур (SALES_MANAGER и др. с sales.* permissions).
 * BUYER/PARTNER не имеют sales-прав (403); PII не копируется в Sales.
 */

import type { LeadStatus, OpportunityStatus, QuoteStatus, SaleStatus } from "../../generated/prisma/enums";

export interface SalesEntityDto {
  id: string;
  code: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeadDto extends SalesEntityDto {
  name: string;
  customerId: string | null;
  assignedToId: string | null;
  createdById: string | null;
  status: LeadStatus;
}

export interface OpportunityDto extends SalesEntityDto {
  title: string;
  leadId: string | null;
  customerId: string | null;
  assignedToId: string | null;
  createdById: string | null;
  status: OpportunityStatus;
}

export interface QuoteDto extends SalesEntityDto {
  customerId: string | null;
  opportunityId: string | null;
  productId: string | null;
  createdById: string | null;
  status: QuoteStatus;
  // Step 2.3 commercial fields (persisted; totals — только для ISSUED, DRAFT → null).
  currency: string;
  validUntil: string | null;
  issuedAt: string | null;
  discountType: string;
  discountValue: string | null;
  discountAmount: string | null;
  subtotal: string | null;
  total: string | null;
}

/** Step 2.3: строка КП (Sales-owned snapshot Catalog Product/Tariff). */
export interface QuoteItemDto {
  id: string;
  productId: string;
  productCode: string;
  productTitle: string;
  tariffId: string;
  tariffCode: string;
  tariffName: string;
  quantity: number;
  unitPrice: string;
  currency: string;
  amount: string;
}

/** Step 2.3: traveler context (без passport/document/PII-расширения). */
export interface QuoteTravelerDto {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
}

/** Step 2.3: детальная коммерческая проекция КП (whitelist). */
export interface QuoteDetailDto extends QuoteDto {
  items: QuoteItemDto[];
  travelers: QuoteTravelerDto[];
}

export interface SaleDto extends SalesEntityDto {
  customerId: string | null;
  opportunityId: string | null;
  quoteId: string | null;
  createdById: string | null;
  status: SaleStatus;
}

export interface SalesListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** History projection (immutable, entity-scoped, paginated). */
export interface SalesHistoryItemDto {
  id: string;
  action: string;
  from: string | null;
  to: string | null;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
}

/**
 * KPI/read model (Step 2.2) — ТОЛЬКО count-based operational metrics из
 * реальных Sales facts. Никаких revenue/GMV/payment/commission/order/booking
 * метрик (§11/§95): соответствующих canonical facts ещё нет.
 * period = createdAt basis (inclusive ISO UTC); без period — всё время.
 */
export interface SalesKpiDto {
  period: { from: string | null; to: string | null };
  leads: { total: number; byStatus: Record<string, number>; unassigned: number };
  opportunities: { total: number; byStatus: Record<string, number>; unassigned: number };
  quotes: { total: number; byStatus: Record<string, number> };
  sales: { total: number; byStatus: Record<string, number> };
  funnel: {
    opportunitiesFromLeads: number;
    quotesFromOpportunities: number;
    salesFromQuotes: number;
    salesFromOpportunities: number;
  };
}
