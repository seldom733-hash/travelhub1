import { ValidationDomainError } from "../../shared/errors";
import { LeadStatus, OpportunityStatus, QuoteStatus, SaleStatus } from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";

/**
 * PHASE 2 STEP 2.2 — Sales Center Backend: чистые filter/sort/search helpers.
 * Валидация типов выполняется DTO (class-validator); здесь — whitelist-билдеры
 * Prisma-where (никаких произвольных динамических полей из query), безопасный
 * date-range (from <= to, ISO UTC), bounded display-search (trim + cap 80,
 * parameterized contains-insensitive), детерминированный sort с tie-breaker.
 */

export const SALES_SORT_FIELDS = ["createdAt", "code", "status"] as const;
export type SalesSortField = (typeof SALES_SORT_FIELDS)[number];

/** Базовый список query (общий для всех entity-списков). */
export interface SalesListQueryInput {
  code?: string;
  search?: string;
  from?: string; // createdAt >= from (ISO, inclusive)
  to?: string; // createdAt <= to (ISO, inclusive)
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: string;
}

export interface LeadListQueryInput extends SalesListQueryInput {
  status?: LeadStatus;
  assignedToId?: string;
  customerId?: string;
}

export interface OpportunityListQueryInput extends SalesListQueryInput {
  status?: OpportunityStatus;
  assignedToId?: string;
  customerId?: string;
  leadId?: string;
}

export interface QuoteListQueryInput extends SalesListQueryInput {
  status?: QuoteStatus;
  customerId?: string;
  opportunityId?: string;
  productId?: string;
}

export interface SaleListQueryInput extends SalesListQueryInput {
  quoteId?: string;
  opportunityId?: string;
  customerId?: string;
}

/**
 * createdAt-range filter: inclusive gte/lte (UTC instants). from > to → 422.
 * Отсутствие обоих → {} (без фильтра). НЕ использует updatedAt (temporal contract).
 */
export function createdAtRange(from?: string, to?: string): { createdAt: Prisma.DateTimeFilter } | Record<string, never> {
  if (!from && !to) return {};
  const f = from ? new Date(from) : undefined;
  const t = to ? new Date(to) : undefined;
  if (f && t && f.getTime() > t.getTime()) {
    throw new ValidationDomainError("from must not be after to");
  }
  const range: Prisma.DateTimeFilter = {
    ...(f ? { gte: f } : {}),
    ...(t ? { lte: t } : {}),
  };
  return { createdAt: range };
}

/**
 * Bounded display search: trim + cap 80 + contains-insensitive (parameterized).
 * Ищет по display label (name/title); canonical code — отдельный exact-filter `code`.
 */
export function containsSearch(field: "name" | "title", q?: string): { [K in "name" | "title"]: { contains: string; mode: "insensitive" } } | Record<string, never> {
  if (!q) return {};
  const trimmed = q.trim();
  if (trimmed.length === 0) return {};
  return { [field]: { contains: trimmed.slice(0, 80), mode: "insensitive" } } as never;
}

/**
 * Детерминированный orderBy: whitelist-поле (createdAt/code/status) + направление,
 * всегда stable tie-breaker `code asc`. Default: createdAt desc (свежие сверху).
 * Возвращает спред-совместимый массив; сервис приводит к entity-specific типу.
 */
export function salesOrderBy(field?: string, order?: string): Array<Record<string, "asc" | "desc">> {
  const f: SalesSortField = (SALES_SORT_FIELDS as readonly string[]).includes(field ?? "") ? (field as SalesSortField) : "createdAt";
  const o: "asc" | "desc" = order === "asc" ? "asc" : "desc";
  if (f === "code") return [{ code: o }];
  return [{ [f]: o }, { code: "asc" }];
}

/* ── Whitelist-билдеры where (только Sales-owned поля / refs) ─────────────── */

export function buildLeadListWhere(f: LeadListQueryInput): Prisma.LeadWhereInput {
  return {
    ...(f.status ? { status: f.status } : {}),
    ...(f.assignedToId ? { assignedToId: f.assignedToId } : {}),
    ...(f.customerId ? { customerId: f.customerId } : {}),
    ...(f.code ? { code: f.code } : {}),
    ...createdAtRange(f.from, f.to),
    ...containsSearch("name", f.search),
  };
}

export function buildOpportunityListWhere(f: OpportunityListQueryInput): Prisma.OpportunityWhereInput {
  return {
    ...(f.status ? { status: f.status } : {}),
    ...(f.assignedToId ? { assignedToId: f.assignedToId } : {}),
    ...(f.customerId ? { customerId: f.customerId } : {}),
    ...(f.leadId ? { leadId: f.leadId } : {}),
    ...(f.code ? { code: f.code } : {}),
    ...createdAtRange(f.from, f.to),
    ...containsSearch("title", f.search),
  };
}

export function buildQuoteListWhere(f: QuoteListQueryInput): Prisma.QuoteWhereInput {
  return {
    ...(f.status ? { status: f.status } : {}),
    ...(f.customerId ? { customerId: f.customerId } : {}),
    ...(f.opportunityId ? { opportunityId: f.opportunityId } : {}),
    ...(f.productId ? { productId: f.productId } : {}),
    ...(f.code ? { code: f.code } : {}),
    ...createdAtRange(f.from, f.to),
  };
}

export function buildSaleListWhere(f: SaleListQueryInput): Prisma.SaleWhereInput {
  return {
    ...(f.quoteId ? { quoteId: f.quoteId } : {}),
    ...(f.opportunityId ? { opportunityId: f.opportunityId } : {}),
    ...(f.customerId ? { customerId: f.customerId } : {}),
    ...(f.code ? { code: f.code } : {}),
    ...createdAtRange(f.from, f.to),
  };
}

/* ── Operational queues (read models, НЕ новые сущности) ───────────────────── */

/**
 * Queues — вычисляемые read models из canonical Sales lifecycle facts.
 * Никаких awaiting-payment/booking/fulfillment (таких facts ещё нет).
 * Каждая queue: entity + status predicate (+ optional unassigned) + permission.
 */
export const SALES_QUEUES = {
  NEW_LEADS: { entity: "lead", status: LeadStatus.NEW, permission: "sales.lead.read" },
  QUALIFIED_LEADS: { entity: "lead", status: LeadStatus.QUALIFIED, permission: "sales.lead.read" },
  UNASSIGNED_LEADS: { entity: "lead", status: LeadStatus.NEW, unassigned: true, permission: "sales.lead.read" },
  NEW_OPPORTUNITIES: { entity: "opportunity", status: OpportunityStatus.NEW, permission: "sales.opportunity.read" },
  OPEN_OPPORTUNITIES: { entity: "opportunity", status: OpportunityStatus.OPEN, permission: "sales.opportunity.read" },
  UNASSIGNED_OPPORTUNITIES: { entity: "opportunity", status: OpportunityStatus.NEW, unassigned: true, permission: "sales.opportunity.read" },
  DRAFT_QUOTES: { entity: "quote", status: QuoteStatus.DRAFT, permission: "sales.quote.read" },
  ISSUED_QUOTES: { entity: "quote", status: QuoteStatus.ISSUED, permission: "sales.quote.read" },
  OPEN_SALES: { entity: "sale", status: SaleStatus.OPEN, permission: "sales.sale.read" },
} as const;

export type SalesQueueKey = keyof typeof SALES_QUEUES;
export const SALES_QUEUE_KEYS = Object.keys(SALES_QUEUES) as SalesQueueKey[];
