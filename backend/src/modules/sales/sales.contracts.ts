/**
 * PHASE 2 STEP 2.1 — Sales Domain Foundation: read-contract DTO (whitelist).
 * Внутренний staff-контур (SALES_MANAGER и др. с sales.* permissions).
 * BUYER/PARTNER не имеют sales-прав (403); PII не копируется в Sales.
 */

import type {
  CheckoutStatus,
  LeadStatus,
  OpportunityStatus,
  PaymentPrepaymentType,
  PaymentScheme,
  QuoteDiscountType,
  QuoteStatus,
  SalesAcquisitionSource,
  SaleStatus,
} from "../../generated/prisma/enums";

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
  // Step 2.2F (DD-030): Reverse Marketplace provenance + server-derived source.
  buyerRequestId: string | null;
  proposalId: string | null;
  sellerId: string | null;
  acquisitionSource: SalesAcquisitionSource | null;
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
  // Step 2.2F: acquisition source (server-derived из Opportunity; NULL для
  // direct/staff Quote — Checkout резолвит DIRECT fallback).
  acquisitionSource: SalesAcquisitionSource | null;
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
  checkoutIntentId: string | null;
  createdById: string | null;
  status: SaleStatus;
  /** Step 2.4: immutable commercial snapshot. NULL = OPEN/legacy (без backfill). */
  commercialSnapshot: SaleCommercialSnapshot | null;
  completedAt: string | null;
  completedById: string | null;
  reservationId: string | null;
  orderRequestedEventId: string | null;
}

/** Step 2.4: immutable commercial snapshot (замораживается при completion). */
export interface SaleCommercialSnapshot {
  currency: string;
  subtotal: string;
  discountType: QuoteDiscountType;
  discountValue: string | null;
  discountAmount: string | null;
  total: string;
  paymentScheme: PaymentScheme | null;
  prepaymentType: "PERCENTAGE" | "FIXED" | null;
  prepaymentValue: string | null;
  initialAmount: string | null;
  remainingAmount: string | null;
  acquisitionSource: SalesAcquisitionSource;
}

/** Step 2.4: результат команды completeSale. */
export interface SaleDetailCompletionDto {
  saleId: string;
  saleCode: string;
  status: SaleStatus;
  version: number;
  completedAt: string;
  orderRequestedEventId: string;
  reservations: string[];
}

export interface SalesListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Step 2.3A: traveler контекст checkout intent (минимум, без PII-расширения). */
export interface CheckoutIntentTravelerDto {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
}

/** Step 2.3A: availability per quote item (read-only "checked, not reserved"). */
export interface CheckoutAvailabilityItemDto {
  itemId: string;
  productId: string;
  productCode: string;
  productTitle: string;
  tariffId: string;
  tariffCode: string;
  quantity: number;
  required: number;
  slotsTotal: number | null;
  slotsBooked: number | null;
  slotsReserved: number | null;
  availableSlots: number | null;
  level: "AVAILABLE" | "UNAVAILABLE" | "NOT_CONFIGURED";
}

/** Step 2.3A: честный availability read-model (НЕ reservation). */
export interface CheckoutIntentAvailabilityDto {
  state: "CHECKED_NOT_RESERVED" | "NOT_SPECIFIED";
  checkedAt: string | null;
  semantics: string;
  items: CheckoutAvailabilityItemDto[];
}

/** Step 2.3B: payment terms projection (whitelist; NULL = not selected). */
export interface PaymentTermsDto {
  scheme: PaymentScheme;
  prepaymentType: PaymentPrepaymentType | null;
  prepaymentValue: string | null;
  initialAmount: string;
  remainingAmount: string;
}

/** Step 2.3A: CheckoutIntent projection (whitelist, frozen commercial snapshot). */
export interface CheckoutIntentDto extends SalesEntityDto {
  quoteCode: string;
  customerId: string | null;
  status: CheckoutStatus;
  acquisitionSource: SalesAcquisitionSource;
  currency: string;
  subtotal: string;
  discountType: string;
  discountValue: string | null;
  discountAmount: string | null;
  total: string;
  serviceDate: string | null;
  cancelledAt: string | null;
  createdById: string | null;
  // Step 2.3B: коммерческие условия оплаты (server-derived). NULL = not selected
  // (никакой подразумеваемой схемы; existing rows без backfill).
  paymentTerms: PaymentTermsDto | null;
  // Quote validity (server-side, честная staleness — §46/§68).
  quoteValidUntil: string | null;
  quoteExpired: boolean;
  priceAuthoritative: boolean;
}

/** Step 2.3A: детальная проекция (включая travelers + свежий availability). */
export interface CheckoutIntentDetailDto extends CheckoutIntentDto {
  travelers: CheckoutIntentTravelerDto[];
  availability: CheckoutIntentAvailabilityDto;
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
