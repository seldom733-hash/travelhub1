/**
 * STEP 2.17C — Wave 1: DTO projection functions.
 *
 * Extracted from SalesService private methods. All functions are pure
 * (no Prisma, no service dependency) — they transform Prisma row shapes
 * into whitelist DTO types. Behavior-preserving: exact same output.
 *
 * After this extraction, SalesService delegates to these module functions.
 * Wave 0 characterization tests (sales.service.spec.ts) verify the behavior
 * is identical through the public API.
 */
import { Prisma } from "../../generated/prisma/client";
import { isoUtc } from "../../shared/temporal";
import { quoteTotals as computeQuoteTotals } from "./sales.money";
import { quoteExpiry } from "./sales.checkout";
import {
  CheckoutStatus,
  PaymentScheme,
  QuoteDiscountType,
  QuoteStatus,
  SaleStatus,
  SalesAcquisitionSource,
} from "../../generated/prisma/enums";
import type {
  CheckoutIntentDto,
  CheckoutIntentDetailDto,
  CheckoutIntentAvailabilityDto,
  LeadDto,
  OpportunityDto,
  PaymentTermsDto,
  QuoteDetailDto,
  QuoteDto,
  QuoteItemDto,
  SaleCommercialSnapshot,
  SaleDetailCompletionDto,
  SaleDto,
} from "./sales.contracts";

/* ── Lead ────────────────────────────────────────────────────────────────── */

export function toLeadDto(row: {
  id: string;
  code: string;
  name: string;
  customerId: string | null;
  assignedToId: string | null;
  status: any;
  version: number;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}): LeadDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    customerId: row.customerId,
    assignedToId: row.assignedToId,
    status: row.status,
    version: row.version,
    createdById: row.createdById,
    createdAt: isoUtc(row.createdAt),
    updatedAt: isoUtc(row.updatedAt),
  };
}

/* ── Opportunity ─────────────────────────────────────────────────────────── */

export function toOpportunityDto(row: {
  id: string;
  code: string;
  title: string;
  leadId: string | null;
  customerId: string | null;
  assignedToId: string | null;
  status: any;
  version: number;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  buyerRequestId: string | null;
  proposalId: string | null;
  sellerId: string | null;
  acquisitionSource: SalesAcquisitionSource | null;
}): OpportunityDto {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    leadId: row.leadId,
    customerId: row.customerId,
    assignedToId: row.assignedToId,
    status: row.status,
    version: row.version,
    createdById: row.createdById,
    createdAt: isoUtc(row.createdAt),
    updatedAt: isoUtc(row.updatedAt),
    buyerRequestId: row.buyerRequestId,
    proposalId: row.proposalId,
    sellerId: row.sellerId,
    acquisitionSource: row.acquisitionSource,
  };
}

/* ── Quote ───────────────────────────────────────────────────────────────── */

export function toQuoteDto(row: {
  id: string;
  code: string;
  customerId: string | null;
  opportunityId: string | null;
  productId: string | null;
  status: any;
  version: number;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  currency: string;
  validUntil: Date | null;
  issuedAt: Date | null;
  discountType: any;
  discountValue: Prisma.Decimal | null;
  discountAmount: Prisma.Decimal | null;
  subtotal: Prisma.Decimal | null;
  total: Prisma.Decimal | null;
  acquisitionSource: SalesAcquisitionSource | null;
}): QuoteDto {
  return {
    id: row.id,
    code: row.code,
    customerId: row.customerId,
    opportunityId: row.opportunityId,
    productId: row.productId,
    status: row.status,
    version: row.version,
    createdById: row.createdById,
    createdAt: isoUtc(row.createdAt),
    updatedAt: isoUtc(row.updatedAt),
    currency: row.currency,
    validUntil: row.validUntil ? isoUtc(row.validUntil) : null,
    issuedAt: row.issuedAt ? isoUtc(row.issuedAt) : null,
    discountType: row.discountType,
    discountValue: row.discountValue ? String(row.discountValue) : null,
    discountAmount: row.discountAmount ? String(row.discountAmount) : null,
    subtotal: row.subtotal ? String(row.subtotal) : null,
    total: row.total ? String(row.total) : null,
    acquisitionSource: row.acquisitionSource,
  };
}

export function toQuoteDetailDto(row: {
  id: string;
  code: string;
  customerId: string | null;
  opportunityId: string | null;
  productId: string | null;
  status: any;
  version: number;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  currency: string;
  validUntil: Date | null;
  issuedAt: Date | null;
  discountType: any;
  discountValue: Prisma.Decimal | null;
  discountAmount: Prisma.Decimal | null;
  subtotal: Prisma.Decimal | null;
  total: Prisma.Decimal | null;
  acquisitionSource: SalesAcquisitionSource | null;
  items: Array<{
    id: string;
    productId: string;
    productCode: string;
    productTitle: string;
    tariffId: string;
    tariffCode: string;
    tariffName: string;
    quantity: number;
    serviceDate: Date | null;
    unitPrice: Prisma.Decimal;
    currency: string;
    amount: Prisma.Decimal;
    restrictionSnapshot: Prisma.JsonValue | null;
  }>;
  travelers: Array<{ id: string; firstName: string; lastName: string; birthDate: Date | null }>;
}): QuoteDetailDto {
  const base = toQuoteDto(row);
  let subtotal = row.subtotal;
  let discountAmount = row.discountAmount;
  let total = row.total;
  if (row.status === QuoteStatus.DRAFT) {
    const t = computeQuoteTotals(row.items, row.discountType, row.discountValue);
    subtotal = t.subtotal;
    discountAmount = t.discountAmount;
    total = t.total;
  }
  return {
    ...base,
    subtotal: subtotal ? String(subtotal) : null,
    discountAmount: discountAmount ? String(discountAmount) : null,
    total: total ? String(total) : null,
    items: row.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productCode: i.productCode,
      productTitle: i.productTitle,
      tariffId: i.tariffId,
      tariffCode: i.tariffCode,
      tariffName: i.tariffName,
      quantity: i.quantity,
      serviceDate: i.serviceDate ? i.serviceDate.toISOString().slice(0, 10) : null,
      unitPrice: String(i.unitPrice),
      currency: i.currency,
      amount: String(i.amount),
      restrictionSnapshot: (i.restrictionSnapshot ?? null) as unknown as QuoteItemDto["restrictionSnapshot"],
    })),
    travelers: row.travelers.map((t) => ({
      id: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      birthDate: t.birthDate ? isoUtc(t.birthDate) : null,
    })),
  };
}

/* ── Payment Terms ───────────────────────────────────────────────────────── */

export function toPaymentTermsDto(row: {
  paymentScheme: PaymentScheme | null;
  prepaymentType: "PERCENTAGE" | "FIXED" | null;
  prepaymentValue: Prisma.Decimal | null;
  initialAmount: Prisma.Decimal | null;
  remainingAmount: Prisma.Decimal | null;
}): PaymentTermsDto | null {
  if (!row.paymentScheme || row.initialAmount === null || row.remainingAmount === null) return null;
  return {
    scheme: row.paymentScheme,
    prepaymentType: row.prepaymentType,
    prepaymentValue: row.prepaymentValue ? String(row.prepaymentValue) : null,
    initialAmount: String(row.initialAmount),
    remainingAmount: String(row.remainingAmount),
  };
}

/* ── CheckoutIntent ──────────────────────────────────────────────────────── */

export function toCheckoutIntentDto(
  row: {
    id: string;
    code: string;
    customerId: string | null;
    status: any;
    version: number;
    currency: string;
    subtotal: Prisma.Decimal;
    discountType: any;
    discountValue: Prisma.Decimal | null;
    discountAmount: Prisma.Decimal | null;
    total: Prisma.Decimal;
    serviceDate: Date | null;
    serviceTime: string | null;
    serviceEndTime: string | null;
    serviceTimeZone: string | null;
    acquisitionSource: SalesAcquisitionSource;
    paymentScheme: PaymentScheme | null;
    prepaymentType: "PERCENTAGE" | "FIXED" | null;
    prepaymentValue: Prisma.Decimal | null;
    initialAmount: Prisma.Decimal | null;
    remainingAmount: Prisma.Decimal | null;
    cancelledAt: Date | null;
    createdById: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  meta: { quoteCode: string; quoteValidUntil: Date | null; quoteExpired: boolean; priceAuthoritative: boolean },
): CheckoutIntentDto {
  return {
    id: row.id,
    code: row.code,
    quoteCode: meta.quoteCode,
    customerId: row.customerId,
    status: row.status,
    version: row.version,
    currency: row.currency,
    subtotal: String(row.subtotal),
    discountType: row.discountType,
    discountValue: row.discountValue ? String(row.discountValue) : null,
    discountAmount: row.discountAmount ? String(row.discountAmount) : null,
    total: String(row.total),
    serviceDate: row.serviceDate ? row.serviceDate.toISOString().slice(0, 10) : null,
    serviceTime: row.serviceTime ?? null,
    serviceEndTime: row.serviceEndTime ?? null,
    serviceTimeZone: row.serviceTimeZone ?? null,
    acquisitionSource: row.acquisitionSource,
    cancelledAt: row.cancelledAt ? isoUtc(row.cancelledAt) : null,
    createdById: row.createdById,
    createdAt: isoUtc(row.createdAt),
    updatedAt: isoUtc(row.updatedAt),
    paymentTerms: toPaymentTermsDto(row),
    quoteValidUntil: meta.quoteValidUntil ? isoUtc(meta.quoteValidUntil) : null,
    quoteExpired: meta.quoteExpired,
    priceAuthoritative: meta.priceAuthoritative,
  };
}

export function toCheckoutIntentDetailDto(
  row: {
    id: string;
    code: string;
    customerId: string | null;
    status: any;
    version: number;
    currency: string;
    subtotal: Prisma.Decimal;
    discountType: any;
    discountValue: Prisma.Decimal | null;
    discountAmount: Prisma.Decimal | null;
    total: Prisma.Decimal;
    serviceDate: Date | null;
    serviceTime: string | null;
    serviceEndTime: string | null;
    serviceTimeZone: string | null;
    acquisitionSource: SalesAcquisitionSource;
    paymentScheme: PaymentScheme | null;
    prepaymentType: "PERCENTAGE" | "FIXED" | null;
    prepaymentValue: Prisma.Decimal | null;
    initialAmount: Prisma.Decimal | null;
    remainingAmount: Prisma.Decimal | null;
    cancelledAt: Date | null;
    createdById: string | null;
    createdAt: Date;
    updatedAt: Date;
    travelers: Array<{ id: string; firstName: string; lastName: string; birthDate: Date | null }>;
  },
  meta: { quoteCode: string; quoteValidUntil: Date | null; quoteExpired: boolean; priceAuthoritative: boolean },
  availability: CheckoutIntentAvailabilityDto,
): CheckoutIntentDetailDto {
  return {
    ...toCheckoutIntentDto(row, meta),
    travelers: row.travelers.map((t) => ({
      id: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      birthDate: t.birthDate ? isoUtc(t.birthDate) : null,
    })),
    availability,
  };
}

/* ── Sale ────────────────────────────────────────────────────────────────── */

export function toSaleDto(row: {
  id: string;
  code: string;
  customerId: string | null;
  opportunityId: string | null;
  quoteId: string | null;
  checkoutIntentId: string | null;
  status: any;
  version: number;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  currency: string | null;
  subtotal: Prisma.Decimal | null;
  discountType: any;
  discountValue: Prisma.Decimal | null;
  discountAmount: Prisma.Decimal | null;
  total: Prisma.Decimal | null;
  paymentScheme: PaymentScheme | null;
  prepaymentType: "PERCENTAGE" | "FIXED" | null;
  prepaymentValue: Prisma.Decimal | null;
  initialAmount: Prisma.Decimal | null;
  remainingAmount: Prisma.Decimal | null;
  acquisitionSource: SalesAcquisitionSource | null;
  serviceTime: string | null;
  serviceEndTime: string | null;
  serviceTimeZone: string | null;
  commissionSnapshot: Prisma.JsonValue | null;
  completedAt: Date | null;
  completedById: string | null;
  reservationId: string | null;
  orderRequestedEventId: string | null;
}): SaleDto {
  const snapshot: SaleCommercialSnapshot | null =
    row.currency && row.subtotal !== null && row.total !== null && row.acquisitionSource
      ? {
          currency: row.currency,
          subtotal: String(row.subtotal),
          discountType: row.discountType ?? QuoteDiscountType.NONE,
          discountValue: row.discountValue ? String(row.discountValue) : null,
          discountAmount: row.discountAmount ? String(row.discountAmount) : null,
          total: String(row.total),
          paymentScheme: row.paymentScheme,
          prepaymentType: row.prepaymentType,
          prepaymentValue: row.prepaymentValue ? String(row.prepaymentValue) : null,
          initialAmount: row.initialAmount ? String(row.initialAmount) : null,
          remainingAmount: row.remainingAmount ? String(row.remainingAmount) : null,
          acquisitionSource: row.acquisitionSource,
          serviceTime: row.serviceTime ?? null,
          serviceEndTime: row.serviceEndTime ?? null,
          serviceTimeZone: row.serviceTimeZone ?? null,
          commissionSnapshot: row.commissionSnapshot ?? null,
        }
      : null;
  return {
    id: row.id,
    code: row.code,
    customerId: row.customerId,
    opportunityId: row.opportunityId,
    quoteId: row.quoteId,
    checkoutIntentId: row.checkoutIntentId,
    status: row.status,
    version: row.version,
    createdById: row.createdById,
    createdAt: isoUtc(row.createdAt),
    updatedAt: isoUtc(row.updatedAt),
    commercialSnapshot: snapshot,
    completedAt: row.completedAt ? isoUtc(row.completedAt) : null,
    completedById: row.completedById,
    reservationId: row.reservationId,
    orderRequestedEventId: row.orderRequestedEventId,
  };
}

/* ── Checkout helpers ────────────────────────────────────────────────────── */

export function checkoutQuoteMeta(quote: { code: string; validUntil: Date | null } | null): {
  quoteCode: string;
  quoteValidUntil: Date | null;
  quoteExpired: boolean;
  priceAuthoritative: boolean;
} {
  if (!quote) return { quoteCode: "", quoteValidUntil: null, quoteExpired: true, priceAuthoritative: false };
  return { quoteCode: quote.code, quoteValidUntil: quote.validUntil, ...quoteExpiry(quote.validUntil) };
}
