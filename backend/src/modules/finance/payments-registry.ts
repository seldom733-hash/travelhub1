/**
 * UI-C1.2E — Payments registry read-model scope helpers (payments backend /
 * read-model prerequisites for the future operational /app/payments tab).
 *
 * Requests / Orders / Bookings is the KPI-click behavioral reference: a clicked
 * KPI card becomes SELECTED and filters the TABLE ONLY; the other KPI cards stay
 * static within the OVERVIEW (global registry) scope and are never re-scoped by
 * the active KPI-card dimension.
 *
 * The Payments registry has two KPI-card dimensions:
 *   - paymentStatus (PaymentStatus, 6 canonical values)
 *   - refundStatus  (RefundStatus, 4 canonical values — refunds linked to the
 *                    payments in scope through the canonical Refund.paymentId
 *                    relation; Refund is a separate Finance aggregate, NOT a
 *                    column on Payment).
 *
 * Instead of deriving the overview scope by deleting keys from a composed
 * `where` (fragile under AND/OR composition), the dimensions are constructed
 * EXPLICITLY (Bookings remediation lesson, C1.2E prompt §20):
 *
 *   BASE OVERVIEW SCOPE (global registry scope — table AND overview):
 *     channel (acquisitionSource) · orderId (intersected with channel) ·
 *     currency · search (payment refs + order refs) · period (dateField [from,to))
 *
 *   ACTIVE KPI FILTER (TABLE ONLY):
 *     paymentStatus (or legacy alias `status`) · refundStatus
 *
 * Every actual canonical PaymentStatus / RefundStatus value gets ONE
 * server-authoritative aggregate count (zero-count statuses included — no
 * client-side completion; deterministic enum-order keys).
 *
 * Currency semantics: distinct currencies are derived from canonical data (no
 * invented set); count aggregates may be cross-currency, but monetary sums stay
 * currency-scoped — a cross-currency total is NEVER produced here.
 */
import { Prisma } from "../../generated/prisma/client";
import { PaymentStatus, RefundStatus } from "../../generated/prisma/enums";

/** Canonical PaymentStatus order (schema finance.PaymentStatus). */
export const PAYMENT_STATUS_ORDER: readonly PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.AUTHORIZED,
  PaymentStatus.CAPTURED,
  PaymentStatus.FAILED,
  PaymentStatus.CANCELLED,
  PaymentStatus.REFUNDED,
];

/** Canonical RefundStatus order (schema finance.RefundStatus). */
export const REFUND_STATUS_ORDER: readonly RefundStatus[] = [
  RefundStatus.REQUESTED,
  RefundStatus.APPROVED,
  RefundStatus.PROCESSED,
  RefundStatus.FAILED,
];

export function isPaymentStatusValue(v: string): v is PaymentStatus {
  return (PAYMENT_STATUS_ORDER as readonly string[]).includes(v);
}

export function isRefundStatusValue(v: string): v is RefundStatus {
  return (REFUND_STATUS_ORDER as readonly string[]).includes(v);
}

/** Deterministic zero-filled payment-status aggregate (enum order). */
export function emptyPaymentStatusAgg(): Record<PaymentStatus, number> {
  const agg = {} as Record<PaymentStatus, number>;
  for (const s of PAYMENT_STATUS_ORDER) agg[s] = 0;
  return agg;
}

/** Deterministic zero-filled refund-status aggregate (enum order). */
export function emptyRefundStatusAgg(): Record<RefundStatus, number> {
  const agg = {} as Record<RefundStatus, number>;
  for (const s of REFUND_STATUS_ORDER) agg[s] = 0;
  return agg;
}

/** Registry date-field allowlist (canonical createdAt; paidAt = analytics deep-link). */
export const PAYMENT_DATE_FIELDS = ["createdAt", "paidAt"] as const;
export type PaymentDateField = (typeof PAYMENT_DATE_FIELDS)[number];

export function isPaymentDateField(v: string): v is PaymentDateField {
  return (PAYMENT_DATE_FIELDS as readonly string[]).includes(v);
}

export interface PaymentsScopeInput {
  /** Server-authorized channel order id set (order.acquisitionSource scope). */
  channelOrderIds: string[];
  /** Explicit deep-link orderId — always intersected with the channel scope. */
  orderId?: string;
  /** Global currency scope (payment.currency). */
  currency?: string;
  /** Payment own-field search text (code/referenceNumber/providerRef). */
  searchText?: string;
  /** Order ids whose code/referenceNumber matched search (channel-restricted). */
  searchOrderIds?: string[];
  /** Period boundaries (half-open [from, to)) on the registry date field. */
  dateFrom?: Date;
  dateTo?: Date;
  /** Registry date field: createdAt (canonical) or paidAt (analytics deep-link). */
  dateField?: PaymentDateField;
  /** ACTIVE KPI — TABLE ONLY. */
  paymentStatus?: PaymentStatus;
  /** ACTIVE KPI — TABLE ONLY: payments having a refund with this status. */
  refundStatus?: RefundStatus;
  /** Payment ids having a refund with the active refundStatus (TABLE ONLY). */
  refundPaymentIds?: string[];
}

export interface PaymentsScopes {
  /** Global registry scope — no KPI-card dimension. */
  baseWhere: Prisma.PaymentWhereInput;
  /** Table scope = base scope + active KPI dimension(s). */
  tableWhere: Prisma.PaymentWhereInput;
}

/** True when a where clause is non-empty (has at least one key). */
function isEmptyClause(c: Record<string, unknown>): boolean {
  return Object.keys(c).length === 0;
}

function mergeClauses(clauses: Prisma.PaymentWhereInput[]): Prisma.PaymentWhereInput {
  const nonEmpty = clauses.filter((c) => !isEmptyClause(c as unknown as Record<string, unknown>));
  if (nonEmpty.length === 0) return {};
  if (nonEmpty.length === 1) return nonEmpty[0];
  return { AND: nonEmpty };
}

/**
 * Build BASE (overview) and TABLE scopes from explicit filter dimensions.
 *
 * BASE scope (table AND overview) keeps every legitimate global registry
 * dimension: channel/orderId intersection, currency, search, and the period on
 * the registry date field. The active KPI dimensions (paymentStatus, and the
 * refund-status predicate expressed as a payment id set) are composed into the
 * TABLE scope only — the overview aggregates never see them, so clicking a KPI
 * card can never collapse the other cards.
 */
export function buildPaymentsScopes(input: PaymentsScopeInput): PaymentsScopes {
  const clauses: Prisma.PaymentWhereInput[] = [];

  // Channel (tenant/workspace) authority: payment.orderId must belong to the
  // server-authorized acquisitionSource channel. An explicit deep-link orderId
  // is AND-intersected — never allowed to bypass the channel.
  const channelClause: Prisma.PaymentWhereInput =
    input.channelOrderIds.length === 0
      ? { orderId: "" } // impossible sentinel → deterministic empty result
      : input.orderId
        ? { AND: [{ orderId: input.orderId }, { orderId: { in: input.channelOrderIds } }] }
        : { orderId: { in: input.channelOrderIds } };
  clauses.push(channelClause);

  if (input.currency) clauses.push({ currency: input.currency });

  // Period (half-open [from, to)) on the registry date field.
  if (input.dateFrom || input.dateTo) {
    const range: Record<string, Date> = {};
    if (input.dateFrom) range.gte = input.dateFrom;
    if (input.dateTo) range.lt = input.dateTo;
    clauses.push({ [input.dateField ?? "createdAt"]: range });
  }

  // Search (payment own refs OR matching order refs) — canonical registry
  // search scopes BOTH table and overview (documented decision, C1.2E §17).
  if (input.searchText || (input.searchOrderIds && input.searchOrderIds.length > 0)) {
    const or: Prisma.PaymentWhereInput[] = [];
    if (input.searchText) {
      const text = input.searchText;
      const insensitive = { contains: text, mode: "insensitive" as const };
      or.push(
        { code: insensitive },
        { referenceNumber: insensitive },
        { providerRef: insensitive },
      );
    }
    if (input.searchOrderIds && input.searchOrderIds.length > 0) {
      or.push({ orderId: { in: input.searchOrderIds } });
    }
    clauses.push({ OR: or });
  }

  const baseWhere = mergeClauses(clauses);

  // Active KPI dimension(s) — TABLE ONLY.
  const tableClauses: Prisma.PaymentWhereInput[] = [];
  if (input.paymentStatus) tableClauses.push({ status: input.paymentStatus });
  if (input.refundStatus) {
    // No payment in the base scope carries a refund with this status → the
    // table must be deterministically EMPTY (never the unfiltered base set).
    if (input.refundPaymentIds && input.refundPaymentIds.length > 0) {
      tableClauses.push({ id: { in: input.refundPaymentIds } });
    } else {
      tableClauses.push({ id: "" });
    }
  }

  return {
    baseWhere,
    tableWhere: tableClauses.length === 0 ? baseWhere : mergeClauses([baseWhere, ...tableClauses]),
  };
}
