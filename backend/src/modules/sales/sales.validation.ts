import { ValidationDomainError } from "../../shared/errors";
import { CheckoutStatus, LeadStatus, OpportunityStatus, QuoteStatus, SaleStatus } from "../../generated/prisma/enums";

/**
 * PHASE 2 STEP 2.1 — Sales Domain Foundation: чистые domain-инварианты.
 *
 * Lifecycle-модель минимальна (foundation, НЕ Step 2.2/2.3):
 *  - Lead:          NEW → QUALIFIED | DISQUALIFIED   (DISQUALIFIED — терминал);
 *  - Opportunity:   NEW → OPEN → WON | LOST          (WON/LOST — терминалы);
 *  - Quote:         DRAFT → ISSUED                   (foundation integrity-минимум;
 *                    полный commercial offer flow — Step 2.3);
 *  - Sale:          статус OPEN при создании; РАБОЧИХ переходов в Step 2.1 НЕТ —
 *                    семантика «Sale completion → OrderRequested» принадлежит
 *                    Step 2.4 (единственная граница; enum-значение CLOSED —
 *                    зарезервировано для решения Step 2.4, runtime-команды нет).
 *
 * Терминальные статусы не принимают переходов (terminal-state protection).
 * Переходы детерминированные; конкуренция закрывается CAS по version в сервисе.
 */

/** Поля, которые клиент НИКОГДА не может передать при create/transition. */
export const SALES_CREATE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "status",
  "version",
  "createdAt",
  "updatedAt",
  "createdById",
  "actorId",
  "actor",
  "userId",
  "username",
  "history",
  "requestId",
  "correlationId",
  "causationId",
  // STRICT REVIEW 2.2F (§22/§33): server-owned acquisition/provenance/selection
  // поля — loud 422 в generic Sales create (Lead/Opportunity/Quote/Sale), а НЕ
  // silent DTO-strip. Данные защищены сервисами (source всегда server-derived),
  // но конвенция проекта — явный отказ на forged ключи (§22 «generic payload
  // spreading»; соответствует CHECKOUT_*/SALE_COMPLETE спискам).
  "acquisitionSource",
  "buyerRequestId",
  "proposalId",
  "sellerId",
  "partnerId",
  "selected",
  "converted",
  "convertedOpportunityId",
  "selectedProposalId",
] as const;

/**
 * Step 2.4: полный whitelist-инверсия для completeSale — клиент передаёт
 * ТОЛЬКО expectedVersion. Все derived snapshot/reservation/event fields
 * (статус, деньги, валюта, acquisition, reservationId, quantity, orderId,
 * eventId, payment status, actor, correlation, timestamps) запрещены (§35).
 */
export const SALE_COMPLETE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "status",
  "version",
  "createdAt",
  "updatedAt",
  "createdById",
  "completedAt",
  "completedById",
  "currency",
  "subtotal",
  "discountType",
  "discountValue",
  "discountAmount",
  "total",
  "paymentScheme",
  "prepaymentType",
  "prepaymentValue",
  "initialAmount",
  "remainingAmount",
  "acquisitionSource",
  "serviceDate",
  "reservationId",
  "quantity",
  "orderId",
  "orderCode",
  "eventId",
  "orderRequestedEventId",
  "paymentStatus",
  "paidAmount",
  "customerId",
  "quoteId",
  "checkoutIntentId",
  "actor",
  "actorId",
  "userId",
  "username",
  "correlationId",
  "causationId",
  "requestId",
] as const;

/** Step 2.3: поля, запрещённые в командах состава КП (client-owned override). */
export const SALES_QUOTE_ITEM_FORBIDDEN_KEYS = [
  "id",
  "quoteId",
  "code",
  "status",
  "productCode",
  "productTitle",
  "tariffCode",
  "tariffName",
  "unitPrice",
  "currency",
  "amount",
  "restrictionSnapshot",
  "restrictions",
  "subtotal",
  "discountAmount",
  "total",
  "version",
  "createdAt",
  "updatedAt",
  "issuedAt",
  "createdById",
  "actorId",
  "actor",
  "userId",
  "username",
  "history",
  "requestId",
  "correlationId",
  "causationId",
] as const;

/** Step 2.3: обновление строки — только quantity. */
export const SALES_QUOTE_ITEM_UPDATE_FORBIDDEN_KEYS = [
  "id",
  "quoteId",
  "productId",
  "tariffId",
  "code",
  "status",
  "productCode",
  "productTitle",
  "tariffCode",
  "tariffName",
  "unitPrice",
  "currency",
  "amount",
  "restrictionSnapshot",
  "restrictions",
  "subtotal",
  "discountAmount",
  "total",
  "version",
  "createdAt",
  "updatedAt",
  "issuedAt",
  "createdById",
  "actorId",
  "actor",
  "userId",
  "username",
  "history",
  "requestId",
  "correlationId",
  "causationId",
] as const;

/** Step 2.3: commercial-команда — только discountType/discountValue/validUntil. */
export const SALES_QUOTE_COMMERCIAL_FORBIDDEN_KEYS = [
  "id",
  "quoteId",
  "code",
  "status",
  "customerId",
  "opportunityId",
  "productId",
  "currency",
  "subtotal",
  "discountAmount",
  "total",
  "issuedAt",
  "items",
  "travelers",
  "version",
  "createdAt",
  "updatedAt",
  "createdById",
  "actorId",
  "actor",
  "userId",
  "username",
  "history",
  "requestId",
  "correlationId",
  "causationId",
] as const;

/** Step 2.3: customer-команда — ТОЛЬКО customerId (список БЕЗ customerId: он и есть
 * разрешённый ключ; НЕ наследовать из commercial-списка, где customerId запрещён). */
export const SALES_QUOTE_CUSTOMER_FORBIDDEN_KEYS = [
  "id",
  "quoteId",
  "code",
  "status",
  "opportunityId",
  "productId",
  "currency",
  "subtotal",
  "discountAmount",
  "total",
  "issuedAt",
  "discountType",
  "discountValue",
  "validUntil",
  "items",
  "travelers",
  "version",
  "createdAt",
  "updatedAt",
  "createdById",
  "actorId",
  "actor",
  "userId",
  "username",
  "history",
  "requestId",
  "correlationId",
  "causationId",
] as const;

/** Step 2.3: server-owned поля внутри traveler-item (raw-body проверка до DTO-strip). */
export const SALES_QUOTE_TRAVELER_ITEM_FORBIDDEN_KEYS = [
  "id",
  "quoteId",
  "version",
  "createdAt",
  "updatedAt",
  "actorId",
  "actor",
  "userId",
  "requestId",
  "correlationId",
  "causationId",
] as const;

/** Step 2.3: traveler-команда — только массив travelers (без server-owned полей). */
export const SALES_QUOTE_TRAVELER_FORBIDDEN_KEYS = [
  "id",
  "quoteId",
  "code",
  "status",
  "customerId",
  "opportunityId",
  "productId",
  "currency",
  "subtotal",
  "discountAmount",
  "total",
  "issuedAt",
  "discountType",
  "discountValue",
  "validUntil",
  "items",
  "version",
  "createdAt",
  "updatedAt",
  "createdById",
  "actorId",
  "actor",
  "userId",
  "username",
  "history",
  "requestId",
  "correlationId",
  "causationId",
] as const;

/** Step 2.3A: create checkout intent — только quoteId/customerId/serviceDate/travelers.
 *  Frontend НЕ источник цены: money/currency/source/status/options — server-owned. */
export const CHECKOUT_CREATE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "quoteCode",
  "status",
  "version",
  "currency",
  "subtotal",
  "discountType",
  "discountValue",
  "discountAmount",
  "total",
  "price",
  "unitPrice",
  "amount",
  "fee",
  "tax",
  "paidAmount",
  "availability",
  "capacity",
  "available",
  "reservedAt",
  "expiresAt",
  "acquisitionSource",
  "options",
  "cancelledAt",
  "createdAt",
  "updatedAt",
  "createdById",
  "actorId",
  "actor",
  "userId",
  "username",
  "history",
  "requestId",
  "correlationId",
  "causationId",
] as const;

/** Step 2.3A: travelers-команда — только travelers + expectedVersion. */
export const CHECKOUT_TRAVELERS_FORBIDDEN_KEYS = [
  "id",
  "code",
  "quoteCode",
  "quoteId",
  "customerId",
  "status",
  "version",
  "currency",
  "subtotal",
  "discountType",
  "discountValue",
  "discountAmount",
  "total",
  "serviceDate",
  "acquisitionSource",
  "options",
  "cancelledAt",
  "createdAt",
  "updatedAt",
  "createdById",
  "actorId",
  "actor",
  "userId",
  "username",
  "history",
  "requestId",
  "correlationId",
  "causationId",
] as const;

/** Step 2.3A: service-date команда — только serviceDate + expectedVersion. */
export const CHECKOUT_SERVICE_DATE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "quoteCode",
  "quoteId",
  "customerId",
  "status",
  "version",
  "currency",
  "subtotal",
  "discountType",
  "discountValue",
  "discountAmount",
  "total",
  "travelers",
  "acquisitionSource",
  "options",
  "cancelledAt",
  "createdAt",
  "updatedAt",
  "createdById",
  "actorId",
  "actor",
  "userId",
  "username",
  "history",
  "requestId",
  "correlationId",
  "causationId",
] as const;

/** Step 2.3A: revalidate — только expectedVersion. */
export const CHECKOUT_REVALIDATE_FORBIDDEN_KEYS = [
  "id",
  "code",
  "quoteCode",
  "quoteId",
  "customerId",
  "status",
  "version",
  "currency",
  "subtotal",
  "discountType",
  "discountValue",
  "discountAmount",
  "total",
  "serviceDate",
  "travelers",
  "acquisitionSource",
  "options",
  "cancelledAt",
  "createdAt",
  "updatedAt",
  "createdById",
  "actorId",
  "actor",
  "userId",
  "username",
  "history",
  "requestId",
  "correlationId",
  "causationId",
] as const;

/** Step 2.3A: cancel — только expectedVersion. */
export const CHECKOUT_CANCEL_FORBIDDEN_KEYS = [
  "id",
  "code",
  "quoteCode",
  "quoteId",
  "customerId",
  "status",
  "version",
  "currency",
  "subtotal",
  "discountType",
  "discountValue",
  "discountAmount",
  "total",
  "serviceDate",
  "travelers",
  "acquisitionSource",
  "options",
  "cancelledAt",
  "createdAt",
  "updatedAt",
  "createdById",
  "actorId",
  "actor",
  "userId",
  "username",
  "history",
  "requestId",
  "correlationId",
  "causationId",
] as const;

/** Step 2.3A: server-owned поля внутри traveler-item (raw-body проверка до DTO-strip). */
export const CHECKOUT_TRAVELER_ITEM_FORBIDDEN_KEYS = [
  "id",
  "checkoutIntentId",
  "version",
  "createdAt",
  "updatedAt",
  "actorId",
  "actor",
  "userId",
  "requestId",
  "correlationId",
  "causationId",
] as const;

/** Step 2.3B: payment-terms команда — только scheme/prepaymentType/prepaymentValue/
 *  expectedVersion. Derived amounts (initialAmount/remainingAmount), money,
 *  currency, payment/PSP/order/payment fields — server-owned (mass-assignment). */
export const PAYMENT_TERMS_FORBIDDEN_KEYS = [
  "id",
  "code",
  "quoteCode",
  "quoteId",
  "customerId",
  "status",
  "currency",
  "subtotal",
  "discountType",
  "discountValue",
  "discountAmount",
  "total",
  "price",
  "unitPrice",
  "amount",
  "fee",
  "tax",
  "paidAmount",
  "paymentStatus",
  "initialAmount",
  "remainingAmount",
  "dueAt",
  "dueDate",
  "dueTrigger",
  "orderId",
  "paymentId",
  "pspReference",
  "provider",
  "availability",
  "capacity",
  "serviceDate",
  "travelers",
  "acquisitionSource",
  "options",
  "cancelledAt",
  "createdAt",
  "updatedAt",
  "createdById",
  "actorId",
  "actor",
  "userId",
  "username",
  "history",
  "requestId",
  "correlationId",
  "causationId",
] as const;

/** Поля, запрещённые в assign-команде (только assignedToId разрешён). */
export const SALES_ASSIGN_FORBIDDEN_KEYS = [
  "id",
  "code",
  "name",
  "title",
  "status",
  "customerId",
  "leadId",
  "opportunityId",
  "quoteId",
  "productId",
  "version",
  "createdAt",
  "updatedAt",
  "createdById",
  "actorId",
  "actor",
  "userId",
  "username",
  "history",
  "requestId",
  "correlationId",
  "causationId",
] as const;

/** Поля, запрещённые в transition-команде (только status разрешён). */
export const SALES_TRANSITION_FORBIDDEN_KEYS = [
  "id",
  "code",
  "name",
  "title",
  "customerId",
  "assignedToId",
  "leadId",
  "opportunityId",
  "quoteId",
  "productId",
  "version",
  "createdAt",
  "updatedAt",
  "createdById",
  "actorId",
  "actor",
  "userId",
  "username",
  "history",
  "requestId",
  "correlationId",
  "causationId",
] as const;

const LEAD_ALLOWED: Record<LeadStatus, LeadStatus[]> = {
  [LeadStatus.NEW]: [LeadStatus.QUALIFIED, LeadStatus.DISQUALIFIED],
  [LeadStatus.QUALIFIED]: [], // foundation: дальнейшая семантика — Sales Center (2.2)
  [LeadStatus.DISQUALIFIED]: [], // терминал
};

const OPPORTUNITY_ALLOWED: Record<OpportunityStatus, OpportunityStatus[]> = {
  [OpportunityStatus.NEW]: [OpportunityStatus.OPEN],
  [OpportunityStatus.OPEN]: [OpportunityStatus.WON, OpportunityStatus.LOST],
  [OpportunityStatus.WON]: [], // терминал
  [OpportunityStatus.LOST]: [], // терминал
};

const QUOTE_ALLOWED: Record<QuoteStatus, QuoteStatus[]> = {
  [QuoteStatus.DRAFT]: [QuoteStatus.ISSUED],
  [QuoteStatus.ISSUED]: [], // foundation: acceptance/conversion — Step 2.3
};

/** Lead: детерминированный переход (NEW → QUALIFIED | DISQUALIFIED). */
export function assertLeadTransition(from: LeadStatus, to: LeadStatus): void {
  if (!LEAD_ALLOWED[from]?.includes(to)) {
    throw new ValidationDomainError(`Invalid Lead status transition: ${from} → ${to}`);
  }
}

/** Opportunity: детерминированный переход (NEW → OPEN → WON | LOST). */
export function assertOpportunityTransition(from: OpportunityStatus, to: OpportunityStatus): void {
  if (!OPPORTUNITY_ALLOWED[from]?.includes(to)) {
    throw new ValidationDomainError(`Invalid Opportunity status transition: ${from} → ${to}`);
  }
}

/** Quote: foundation integrity (DRAFT → ISSUED). */
export function assertQuoteTransition(from: QuoteStatus, to: QuoteStatus): void {
  if (!QUOTE_ALLOWED[from]?.includes(to)) {
    throw new ValidationDomainError(`Invalid Quote status transition: ${from} → ${to}`);
  }
}

/**
 * Step 2.3: состав КП редактируем только в DRAFT. После ISSUE commercial snapshot
 * immutable: любые mutation-команды (items/travelers/customer/discount) → 422.
 */
export function assertQuoteComposable(status: QuoteStatus): void {
  if (status !== QuoteStatus.DRAFT) {
    throw new ValidationDomainError(`Quote is ${status}; composition is immutable after ISSUE`);
  }
}

/** Терминальность (для тестов/отчётов). */
export function isTerminalLead(s: LeadStatus): boolean {
  return s === LeadStatus.DISQUALIFIED;
}
export function isTerminalOpportunity(s: OpportunityStatus): boolean {
  return s === OpportunityStatus.WON || s === OpportunityStatus.LOST;
}
export function isTerminalQuote(s: QuoteStatus): boolean {
  return s === QuoteStatus.ISSUED;
}
