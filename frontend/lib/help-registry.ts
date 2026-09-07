/**
 * UI-C1.2H — Canonical Help / Metric Registry.
 *
 * ARCHITECTURAL AUTHORITY CHAIN (UI-C1.2H §4):
 *
 *   BACKEND DOMAIN / QUERY SERVICES        ← business calculation authority
 *         ↓
 *   SHARED TYPED HELP / METRIC REGISTRY   ← metric/status metadata authority
 *         ↓
 *   i18n (DICT)                            ← localized presentation text
 *         ↓
 *   HELP UI / KPI POPOVER / STATUS HELP    ← consumers only
 *
 * The registry is NOT a source of KPI values and the Help UI is NOT a source
 * of business truth. `source` points at the backend endpoint that computes
 * the count; `formula` (where present) is a plain-language description of the
 * server-side count, never a frontend calculation.
 *
 * Stable IDs: {domain}.{metric-or-status} — NEVER localized.
 *
 * Canonical universe (must match the registry pages exactly):
 *   Requests  — 12 statuses + total KPI
 *   Orders    — 12 OrderStatus + 4 OrderPaymentStatus + total KPI
 *   Bookings  — 13 statuses + total KPI
 *   Payments  — 6 PaymentStatus + 4 RefundStatus + total KPI
 *
 * Forbidden statuses: PARTIALLY_CONFIRMED (Bookings), CASH (PaymentStatus),
 * any mixing of PaymentStatus with RefundStatus.
 *
 * UI-C1.2H.1 — model extension ONLY (zero content change):
 *   - HelpArea taxonomy (HELP_AREAS / HELP_AREA_BY_DOMAIN / helpAreaOf /
 *     helpEntriesByArea) positions the current commerce domains inside the
 *     global TravelHub Help / Business Dictionary (operations, finance) and
 *     reserves the remaining areas (platform, command-center, analytics,
 *     sales, catalog, crm, marketing, support, admin, marketplace, shared)
 *     for future content — no invented entries are added by this stage.
 *   - HelpEntryType extended: kpi | status | group | concept | formula |
 *     workflow | policy. Only kpi/status/group are in use today.
 *   - L3 dictionary relationships: relatedMetrics / relatedStatuses /
 *     relatedConcepts reference stable IDs only.
 *   - Context metadata: workspace (platform | partner | both, default both)
 *     and entitlement (documentation-only capability label; Entitlement is
 *     never a Permission), plus aliases for a future Help search.
 */

import { helpT } from "./help-i18n";
import type { Locale } from "./i18n";

export type HelpDomain = "requests" | "orders" | "bookings" | "payments";

/**
 * UI-C1.2H.1 — platform-level Help areas (global Business Dictionary taxonomy).
 *
 * Grounded in the actual platform architecture: Shell nav groups + RBAC,
 * /app routes, docs/architecture and ADRs (see the H.1 Architecture Map §4).
 * Areas with zero entries today are FUTURE — they exist so that adding a
 * domain/content later is a localized, typed change. No invented content.
 */
export type HelpArea =
  | "platform"
  | "command-center"
  | "analytics"
  | "operations"
  | "finance"
  | "sales"
  | "catalog"
  | "crm"
  | "marketing"
  | "support"
  | "admin"
  | "marketplace"
  | "shared";

export type HelpEntryType = "kpi" | "status" | "group" | "concept" | "formula" | "workflow" | "policy";

/** All entry types the registry model supports (kpi/status/group are the only ones in use today). */
export const HELP_ENTRY_TYPES: readonly HelpEntryType[] = [
  "kpi",
  "status",
  "group",
  "concept",
  "formula",
  "workflow",
  "policy",
] as const;

/** Explicit i18n mapping for every user-facing string of an entry (UI-C1.2H §14). */
export interface HelpLocalizationKeys {
  /** Localized title — usually the SAME key the registry page uses for its card/badge. */
  title: string;
  /** Short definition shown in the KPI popover. */
  short: string;
  /** Full business definition shown in the Help Center. */
  description: string;
}

export interface HelpEntry {
  /** Stable ID {domain}.{metric-or-status}. Never localized. */
  id: string;
  type: HelpEntryType;
  domain: HelpDomain;
  /** Stable group id the status belongs to (group entries reference themselves). */
  group?: string;
  /** Internal (non-localized) engineering purpose — NOT user-facing text. */
  purpose: string;
  /** Backend authority that computes the value behind this entry. */
  source: string;
  /** Whether the entry describes the global KPI overview scope or the table-only filter scope. */
  scope: "global" | "table";
  /** Internal note on where the business semantics come from (NOT user-facing text). */
  businessDefinition: string;
  /** Plain-language formula of the server-side count — present for KPI entries only. */
  formula?: string;
  /** Period semantics: undefined = not period-bound; "global" = Header Period global scope. */
  period?: "global";
  statusMapping?: string;
  inclusions?: string;
  exclusions?: string;
  overlapRule?: string;
  reconciliationRule?: string;
  drillDown?: string;
  comparisonPeriod?: boolean;
  currencyUnit?: string;
  relatedMetrics?: string[];
  /** L3 dictionary relationship — status entries (stable IDs only). */
  relatedStatuses?: string[];
  /** L3 dictionary relationship — concept entries (stable IDs only). */
  relatedConcepts?: string[];
  /** Platform workspace scope of the topic: platform, partner, or both (default). */
  workspace?: "platform" | "partner" | "both";
  /** Documentation-only capability/plan label (Entitlement ≠ Permission; never a permission). */
  entitlement?: string;
  /** Language-neutral search hints for a future Help search (registry entries only). */
  aliases?: string[];
  localizationKeys: HelpLocalizationKeys;
  contractVersion: string;
  changeNote?: string;
}

/** Canonical domain sources (verified against the four registry pages). */
const SOURCE = {
  requests: "GET /api/v1/requests (+ GET /api/v1/requests/kpi)",
  orders: "GET /api/v1/orders (list + aggregates)",
  bookings: "GET /api/v1/bookings (list + aggregates)",
  payments: "GET /api/v1/finance/payments (list + aggregates)",
} as const;

const CONTRACT_VERSION = "UI-C1.2H";

/* ── Helpers shared with UI/tests ─────────────────────────────────────────── */

export function helpTitle(entry: HelpEntry, locale: Locale): string {
  return helpT(entry.localizationKeys.title, locale);
}

export function helpShort(entry: HelpEntry, locale: Locale): string {
  return helpT(entry.localizationKeys.short, locale);
}

export function helpDescription(entry: HelpEntry, locale: Locale): string {
  return helpT(entry.localizationKeys.description, locale);
}

const REGISTRY: readonly HelpEntry[] = [
  /* ═══════════════════════ REQUESTS ═══════════════════════ */
  {
    id: "requests.kpi.total",
    type: "kpi",
    domain: "requests",
    purpose: "Total request count in the global scope",
    source: SOURCE.requests,
    scope: "global",
    businessDefinition: "Server-side count of requests in the global scope (workspace + Header Period).",
    formula: "kpi.total = server count of all requests in global scope",
    period: "global",
    reconciliationRule: "Rendered KPI == server /requests/kpi total == sum of the 12 status slices.",
    drillDown: "Click clears the status filter and refreshes the table.",
    localizationKeys: {
      title: "requests.kpi.total",
      short: "help.requests.kpi.total.short",
      description: "help.requests.kpi.total.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "requests.status.new",
    type: "status",
    domain: "requests",
    group: "requests.group.lifecycle",
    purpose: "Request created, awaiting initial handling",
    source: SOURCE.requests,
    scope: "table",
    businessDefinition: "Count of requests whose status = NEW from the backend KPI endpoint.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "requests.kpi.new",
      short: "help.requests.status.new.short",
      description: "help.requests.status.new.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "requests.status.checking",
    type: "status",
    domain: "requests",
    group: "requests.group.lifecycle",
    purpose: "Request under manual/operator check",
    source: SOURCE.requests,
    scope: "table",
    businessDefinition: "Count of requests whose status = CHECKING from the backend KPI endpoint.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "requests.kpi.checking",
      short: "help.requests.status.checking.short",
      description: "help.requests.status.checking.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "requests.status.price_changed",
    type: "status",
    domain: "requests",
    group: "requests.group.lifecycle",
    purpose: "Supplier changed the price, decision required",
    source: SOURCE.requests,
    scope: "table",
    businessDefinition: "Count of requests whose status = PRICE_CHANGED from the backend KPI endpoint.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "requests.kpi.price_changed",
      short: "help.requests.status.price_changed.short",
      description: "help.requests.status.price_changed.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "requests.status.customer_accepted",
    type: "status",
    domain: "requests",
    group: "requests.group.lifecycle",
    purpose: "Customer accepted the offered terms",
    source: SOURCE.requests,
    scope: "table",
    businessDefinition: "Count of requests whose status = CUSTOMER_ACCEPTED from the backend KPI endpoint.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "requests.kpi.customer_accepted",
      short: "help.requests.status.customer_accepted.short",
      description: "help.requests.status.customer_accepted.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "requests.status.confirmed",
    type: "status",
    domain: "requests",
    group: "requests.group.lifecycle",
    purpose: "Request confirmed",
    source: SOURCE.requests,
    scope: "table",
    businessDefinition: "Count of requests whose status = CONFIRMED from the backend KPI endpoint.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "requests.kpi.confirmed",
      short: "help.requests.status.confirmed.short",
      description: "help.requests.status.confirmed.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "requests.status.converted",
    type: "status",
    domain: "requests",
    group: "requests.group.lifecycle",
    purpose: "Request converted into an order",
    source: SOURCE.requests,
    scope: "table",
    businessDefinition: "Count of requests whose status = CONVERTED from the backend KPI endpoint.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "requests.kpi.converted",
      short: "help.requests.status.converted.short",
      description: "help.requests.status.converted.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "requests.status.supplier_timeout",
    type: "status",
    domain: "requests",
    group: "requests.group.exceptions",
    purpose: "Supplier did not respond within the deadline",
    source: SOURCE.requests,
    scope: "table",
    businessDefinition: "Count of requests whose status = SUPPLIER_TIMEOUT from the backend KPI endpoint.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "requests.kpi.supplier_timeout",
      short: "help.requests.status.supplier_timeout.short",
      description: "help.requests.status.supplier_timeout.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "requests.status.customer_payment_timeout",
    type: "status",
    domain: "requests",
    group: "requests.group.exceptions",
    purpose: "Customer did not pay within the deadline",
    source: SOURCE.requests,
    scope: "table",
    businessDefinition: "Count of requests whose status = CUSTOMER_PAYMENT_TIMEOUT from the backend KPI endpoint.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "requests.kpi.customer_payment_timeout",
      short: "help.requests.status.customer_payment_timeout.short",
      description: "help.requests.status.customer_payment_timeout.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "requests.status.rejected",
    type: "status",
    domain: "requests",
    group: "requests.group.exceptions",
    purpose: "Request rejected",
    source: SOURCE.requests,
    scope: "table",
    businessDefinition: "Count of requests whose status = REJECTED from the backend KPI endpoint.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "requests.kpi.rejected",
      short: "help.requests.status.rejected.short",
      description: "help.requests.status.rejected.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "requests.status.unavailable",
    type: "status",
    domain: "requests",
    group: "requests.group.exceptions",
    purpose: "Requested service is unavailable",
    source: SOURCE.requests,
    scope: "table",
    businessDefinition: "Count of requests whose status = UNAVAILABLE from the backend KPI endpoint.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "requests.kpi.unavailable",
      short: "help.requests.status.unavailable.short",
      description: "help.requests.status.unavailable.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "requests.status.expired",
    type: "status",
    domain: "requests",
    group: "requests.group.exceptions",
    purpose: "Request expired",
    source: SOURCE.requests,
    scope: "table",
    businessDefinition: "Count of requests whose status = EXPIRED from the backend KPI endpoint.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "requests.kpi.expired",
      short: "help.requests.status.expired.short",
      description: "help.requests.status.expired.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "requests.status.cancelled_by_customer",
    type: "status",
    domain: "requests",
    group: "requests.group.exceptions",
    purpose: "Customer cancelled the request",
    source: SOURCE.requests,
    scope: "table",
    businessDefinition: "Count of requests whose status = CANCELLED_BY_CUSTOMER from the backend KPI endpoint.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "requests.kpi.cancelled_by_customer",
      short: "help.requests.status.cancelled_by_customer.short",
      description: "help.requests.status.cancelled_by_customer.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "requests.group.lifecycle",
    type: "group",
    domain: "requests",
    purpose: "Requests lifecycle group heading",
    source: SOURCE.requests,
    scope: "global",
    businessDefinition: "Semantic KPI group label; NOT a status. Groups the lifecycle status cards.",
    localizationKeys: {
      title: "requests.group.lifecycle",
      short: "help.requests.group.lifecycle.short",
      description: "help.requests.group.lifecycle.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "requests.group.exceptions",
    type: "group",
    domain: "requests",
    purpose: "Requests exceptions group heading",
    source: SOURCE.requests,
    scope: "global",
    businessDefinition: "Semantic KPI group label; NOT a status. Groups exception/completion status cards.",
    localizationKeys: {
      title: "requests.group.exceptions",
      short: "help.requests.group.exceptions.short",
      description: "help.requests.group.exceptions.description",
    },
    contractVersion: CONTRACT_VERSION,
  },

  /* ═══════════════════════ ORDERS ═══════════════════════ */
  {
    id: "orders.kpi.total",
    type: "kpi",
    domain: "orders",
    purpose: "Total order count in the global scope",
    source: SOURCE.orders,
    scope: "global",
    businessDefinition: "Server-side count of orders in the global scope (workspace + Header Period) from list aggregates.",
    formula: "overview total = server aggregates.lifecycle.total in global scope",
    period: "global",
    reconciliationRule: "Rendered KPI == server aggregates total == table total when no table-only filter is active.",
    drillDown: "Click clears lifecycle+payment filters and refreshes the table.",
    localizationKeys: {
      title: "admin.kpi.total_orders",
      short: "help.orders.kpi.total.short",
      description: "help.orders.kpi.total.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.status.new",
    type: "status",
    domain: "orders",
    group: "orders.group.lifecycle",
    purpose: "Order created",
    source: SOURCE.orders,
    scope: "table",
    businessDefinition: "Count of orders with lifecycle = NEW from server aggregates.",
    drillDown: "Click applies the lifecycle filter and refreshes the table.",
    localizationKeys: {
      title: "order.status.NEW",
      short: "help.orders.status.new.short",
      description: "help.orders.status.new.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.status.in_processing",
    type: "status",
    domain: "orders",
    group: "orders.group.lifecycle",
    purpose: "Order being processed",
    source: SOURCE.orders,
    scope: "table",
    businessDefinition: "Count of orders with lifecycle = IN_PROCESSING from server aggregates.",
    drillDown: "Click applies the lifecycle filter and refreshes the table.",
    localizationKeys: {
      title: "order.status.IN_PROCESSING",
      short: "help.orders.status.in_processing.short",
      description: "help.orders.status.in_processing.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.status.ready_for_booking",
    type: "status",
    domain: "orders",
    group: "orders.group.lifecycle",
    purpose: "Order ready to be sent to booking",
    source: SOURCE.orders,
    scope: "table",
    businessDefinition: "Count of orders with lifecycle = READY_FOR_BOOKING from server aggregates.",
    drillDown: "Click applies the lifecycle filter and refreshes the table.",
    localizationKeys: {
      title: "order.status.READY_FOR_BOOKING",
      short: "help.orders.status.ready_for_booking.short",
      description: "help.orders.status.ready_for_booking.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.status.sent_to_booking",
    type: "status",
    domain: "orders",
    group: "orders.group.lifecycle",
    purpose: "Order sent to booking flow",
    source: SOURCE.orders,
    scope: "table",
    businessDefinition: "Count of orders with lifecycle = SENT_TO_BOOKING from server aggregates.",
    drillDown: "Click applies the lifecycle filter and refreshes the table.",
    localizationKeys: {
      title: "order.status.SENT_TO_BOOKING",
      short: "help.orders.status.sent_to_booking.short",
      description: "help.orders.status.sent_to_booking.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.status.fulfilled",
    type: "status",
    domain: "orders",
    group: "orders.group.lifecycle",
    purpose: "Order fulfilled",
    source: SOURCE.orders,
    scope: "table",
    businessDefinition: "Count of orders with lifecycle = FULFILLED from server aggregates.",
    drillDown: "Click applies the lifecycle filter and refreshes the table.",
    localizationKeys: {
      title: "order.status.FULFILLED",
      short: "help.orders.status.fulfilled.short",
      description: "help.orders.status.fulfilled.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.status.closed",
    type: "status",
    domain: "orders",
    group: "orders.group.lifecycle",
    purpose: "Order closed",
    source: SOURCE.orders,
    scope: "table",
    businessDefinition: "Count of orders with lifecycle = CLOSED from server aggregates.",
    drillDown: "Click applies the lifecycle filter and refreshes the table.",
    localizationKeys: {
      title: "order.status.CLOSED",
      short: "help.orders.status.closed.short",
      description: "help.orders.status.closed.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.status.waiting_for_data",
    type: "status",
    domain: "orders",
    group: "orders.group.rework",
    purpose: "Order waiting for missing data",
    source: SOURCE.orders,
    scope: "table",
    businessDefinition: "Count of orders with lifecycle = WAITING_FOR_DATA from server aggregates.",
    drillDown: "Click applies the lifecycle filter and refreshes the table.",
    localizationKeys: {
      title: "order.status.WAITING_FOR_DATA",
      short: "help.orders.status.waiting_for_data.short",
      description: "help.orders.status.waiting_for_data.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.status.partially_fulfilled",
    type: "status",
    domain: "orders",
    group: "orders.group.rework",
    purpose: "Order partially fulfilled",
    source: SOURCE.orders,
    scope: "table",
    businessDefinition: "Count of orders with lifecycle = PARTIALLY_FULFILLED from server aggregates.",
    drillDown: "Click applies the lifecycle filter and refreshes the table.",
    localizationKeys: {
      title: "order.status.PARTIALLY_FULFILLED",
      short: "help.orders.status.partially_fulfilled.short",
      description: "help.orders.status.partially_fulfilled.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.status.ready_to_close",
    type: "status",
    domain: "orders",
    group: "orders.group.rework",
    purpose: "Order ready for closure after rework",
    source: SOURCE.orders,
    scope: "table",
    businessDefinition: "Count of orders with lifecycle = READY_TO_CLOSE from server aggregates.",
    drillDown: "Click applies the lifecycle filter and refreshes the table.",
    localizationKeys: {
      title: "order.status.READY_TO_CLOSE",
      short: "help.orders.status.ready_to_close.short",
      description: "help.orders.status.ready_to_close.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.status.problem",
    type: "status",
    domain: "orders",
    group: "orders.group.exceptions",
    purpose: "Order has a problem",
    source: SOURCE.orders,
    scope: "table",
    businessDefinition: "Count of orders with lifecycle = PROBLEM from server aggregates.",
    drillDown: "Click applies the lifecycle filter and refreshes the table.",
    localizationKeys: {
      title: "order.status.PROBLEM",
      short: "help.orders.status.problem.short",
      description: "help.orders.status.problem.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.status.suspended",
    type: "status",
    domain: "orders",
    group: "orders.group.exceptions",
    purpose: "Order suspended",
    source: SOURCE.orders,
    scope: "table",
    businessDefinition: "Count of orders with lifecycle = SUSPENDED from server aggregates.",
    drillDown: "Click applies the lifecycle filter and refreshes the table.",
    localizationKeys: {
      title: "order.status.SUSPENDED",
      short: "help.orders.status.suspended.short",
      description: "help.orders.status.suspended.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.status.cancelled",
    type: "status",
    domain: "orders",
    group: "orders.group.exceptions",
    purpose: "Order cancelled",
    source: SOURCE.orders,
    scope: "table",
    businessDefinition: "Count of orders with lifecycle = CANCELLED from server aggregates.",
    drillDown: "Click applies the lifecycle filter and refreshes the table.",
    localizationKeys: {
      title: "order.status.CANCELLED",
      short: "help.orders.status.cancelled.short",
      description: "help.orders.status.cancelled.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.payment.unpaid",
    type: "status",
    domain: "orders",
    group: "orders.group.payment",
    purpose: "No payment yet",
    source: SOURCE.orders,
    scope: "table",
    businessDefinition: "Count of orders with payment status = UNPAID from server aggregates.payment.",
    inclusions: "paidAmount == 0 (server field).",
    drillDown: "Click applies the payment filter and refreshes the table.",
    localizationKeys: {
      title: "order.payment.UNPAID",
      short: "help.orders.payment.unpaid.short",
      description: "help.orders.payment.unpaid.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.payment.partially_paid",
    type: "status",
    domain: "orders",
    group: "orders.group.payment",
    purpose: "Part of the amount is paid",
    source: SOURCE.orders,
    scope: "table",
    businessDefinition: "Count of orders with payment status = PARTIALLY_PAID from server aggregates.payment.",
    inclusions: "0 < paidAmount < amount (server fields).",
    drillDown: "Click applies the payment filter and refreshes the table.",
    localizationKeys: {
      title: "order.payment.PARTIALLY_PAID",
      short: "help.orders.payment.partially_paid.short",
      description: "help.orders.payment.partially_paid.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.payment.paid",
    type: "status",
    domain: "orders",
    group: "orders.group.payment",
    purpose: "Fully paid",
    source: SOURCE.orders,
    scope: "table",
    businessDefinition: "Count of orders with payment status = PAID from server aggregates.payment.",
    inclusions: "paidAmount == amount (server fields).",
    drillDown: "Click applies the payment filter and refreshes the table.",
    localizationKeys: {
      title: "order.payment.PAID",
      short: "help.orders.payment.paid.short",
      description: "help.orders.payment.paid.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.payment.refunded",
    type: "status",
    domain: "orders",
    group: "orders.group.payment",
    purpose: "Fully refunded",
    source: SOURCE.orders,
    scope: "table",
    businessDefinition: "Count of orders with payment status = REFUNDED from server aggregates.payment.",
    inclusions: "refundedAmount == paidAmount (server fields).",
    drillDown: "Click applies the payment filter and refreshes the table.",
    localizationKeys: {
      title: "order.payment.REFUNDED",
      short: "help.orders.payment.refunded.short",
      description: "help.orders.payment.refunded.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.group.lifecycle",
    type: "group",
    domain: "orders",
    purpose: "Orders lifecycle group heading",
    source: SOURCE.orders,
    scope: "global",
    businessDefinition: "Semantic KPI group label; NOT a status. Happy-path lifecycle chain.",
    localizationKeys: {
      title: "orders.group.lifecycle",
      short: "help.orders.group.lifecycle.short",
      description: "help.orders.group.lifecycle.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.group.rework",
    type: "group",
    domain: "orders",
    purpose: "Orders rework group heading",
    source: SOURCE.orders,
    scope: "global",
    businessDefinition: "Semantic KPI group label; NOT a status. Alternative/rework states, no linear path.",
    localizationKeys: {
      title: "orders.group.rework",
      short: "help.orders.group.rework.short",
      description: "help.orders.group.rework.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.group.exceptions",
    type: "group",
    domain: "orders",
    purpose: "Orders exceptions group heading",
    source: SOURCE.orders,
    scope: "global",
    businessDefinition: "Semantic KPI group label; NOT a status. Exception/attention states.",
    localizationKeys: {
      title: "orders.group.exceptions",
      short: "help.orders.group.exceptions.short",
      description: "help.orders.group.exceptions.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "orders.group.payment",
    type: "group",
    domain: "orders",
    purpose: "Orders payment dimension group heading",
    source: SOURCE.orders,
    scope: "global",
    businessDefinition: "Semantic KPI group label; NOT a status. Payment dimension is separate from lifecycle.",
    localizationKeys: {
      title: "orders.group.payment",
      short: "help.orders.group.payment.short",
      description: "help.orders.group.payment.description",
    },
    contractVersion: CONTRACT_VERSION,
  },

  /* ═══════════════════════ BOOKINGS ═══════════════════════ */
  {
    id: "bookings.kpi.total",
    type: "kpi",
    domain: "bookings",
    purpose: "Total booking count in the global scope",
    source: SOURCE.bookings,
    scope: "global",
    businessDefinition: "Server-side count of bookings in the global scope (workspace + Header Period) from list aggregates.",
    formula: "overview total = server aggregates.lifecycle.total in global scope",
    period: "global",
    reconciliationRule: "Rendered KPI == server aggregates total == table total when no table-only filter is active.",
    drillDown: "Click clears the status filter and refreshes the table.",
    localizationKeys: {
      title: "admin.kpi.total_bookings",
      short: "help.bookings.kpi.total.short",
      description: "help.bookings.kpi.total.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.status.new",
    type: "status",
    domain: "bookings",
    group: "bookings.group.lifecycle",
    purpose: "Booking created",
    source: SOURCE.bookings,
    scope: "table",
    businessDefinition: "Count of bookings with status = NEW from server aggregates.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "booking.status.NEW",
      short: "help.bookings.status.new.short",
      description: "help.bookings.status.new.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.status.preparing_request",
    type: "status",
    domain: "bookings",
    group: "bookings.group.lifecycle",
    purpose: "Supplier request is being prepared",
    source: SOURCE.bookings,
    scope: "table",
    businessDefinition: "Count of bookings with status = PREPARING_REQUEST from server aggregates.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "booking.status.PREPARING_REQUEST",
      short: "help.bookings.status.preparing_request.short",
      description: "help.bookings.status.preparing_request.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.status.sent_to_supplier",
    type: "status",
    domain: "bookings",
    group: "bookings.group.lifecycle",
    purpose: "Request sent to supplier",
    source: SOURCE.bookings,
    scope: "table",
    businessDefinition: "Count of bookings with status = SENT_TO_SUPPLIER from server aggregates.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "booking.status.SENT_TO_SUPPLIER",
      short: "help.bookings.status.sent_to_supplier.short",
      description: "help.bookings.status.sent_to_supplier.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.status.confirmed",
    type: "status",
    domain: "bookings",
    group: "bookings.group.lifecycle",
    purpose: "Booking confirmed",
    source: SOURCE.bookings,
    scope: "table",
    businessDefinition: "Count of bookings with status = CONFIRMED from server aggregates.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "booking.status.CONFIRMED",
      short: "help.bookings.status.confirmed.short",
      description: "help.bookings.status.confirmed.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.status.in_service",
    type: "status",
    domain: "bookings",
    group: "bookings.group.lifecycle",
    purpose: "Service is in progress",
    source: SOURCE.bookings,
    scope: "table",
    businessDefinition: "Count of bookings with status = IN_SERVICE from server aggregates.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "booking.status.IN_SERVICE",
      short: "help.bookings.status.in_service.short",
      description: "help.bookings.status.in_service.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.status.completed",
    type: "status",
    domain: "bookings",
    group: "bookings.group.lifecycle",
    purpose: "Booking completed",
    source: SOURCE.bookings,
    scope: "table",
    businessDefinition: "Count of bookings with status = COMPLETED from server aggregates.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "booking.status.COMPLETED",
      short: "help.bookings.status.completed.short",
      description: "help.bookings.status.completed.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.status.awaiting_confirmation",
    type: "status",
    domain: "bookings",
    group: "bookings.group.awaiting",
    purpose: "Awaiting supplier confirmation",
    source: SOURCE.bookings,
    scope: "table",
    businessDefinition: "Count of bookings with status = AWAITING_CONFIRMATION from server aggregates.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "booking.status.AWAITING_CONFIRMATION",
      short: "help.bookings.status.awaiting_confirmation.short",
      description: "help.bookings.status.awaiting_confirmation.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.status.needs_clarification",
    type: "status",
    domain: "bookings",
    group: "bookings.group.decisions",
    purpose: "Clarification required",
    source: SOURCE.bookings,
    scope: "table",
    businessDefinition: "Count of bookings with status = NEEDS_CLARIFICATION from server aggregates.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "booking.status.NEEDS_CLARIFICATION",
      short: "help.bookings.status.needs_clarification.short",
      description: "help.bookings.status.needs_clarification.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.status.change_requested",
    type: "status",
    domain: "bookings",
    group: "bookings.group.decisions",
    purpose: "Change requested",
    source: SOURCE.bookings,
    scope: "table",
    businessDefinition: "Count of bookings with status = CHANGE_REQUESTED from server aggregates.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "booking.status.CHANGE_REQUESTED",
      short: "help.bookings.status.change_requested.short",
      description: "help.bookings.status.change_requested.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.status.cancellation_requested",
    type: "status",
    domain: "bookings",
    group: "bookings.group.decisions",
    purpose: "Cancellation requested",
    source: SOURCE.bookings,
    scope: "table",
    businessDefinition: "Count of bookings with status = CANCELLATION_REQUESTED from server aggregates.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "booking.status.CANCELLATION_REQUESTED",
      short: "help.bookings.status.cancellation_requested.short",
      description: "help.bookings.status.cancellation_requested.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.status.problem",
    type: "status",
    domain: "bookings",
    group: "bookings.group.decisions",
    purpose: "Booking has a problem",
    source: SOURCE.bookings,
    scope: "table",
    businessDefinition: "Count of bookings with status = PROBLEM from server aggregates.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "booking.status.PROBLEM",
      short: "help.bookings.status.problem.short",
      description: "help.bookings.status.problem.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.status.supplier_rejected",
    type: "status",
    domain: "bookings",
    group: "bookings.group.terminal",
    purpose: "Supplier rejected the request",
    source: SOURCE.bookings,
    scope: "table",
    businessDefinition: "Count of bookings with status = SUPPLIER_REJECTED from server aggregates.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "booking.status.SUPPLIER_REJECTED",
      short: "help.bookings.status.supplier_rejected.short",
      description: "help.bookings.status.supplier_rejected.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.status.cancelled",
    type: "status",
    domain: "bookings",
    group: "bookings.group.terminal",
    purpose: "Booking cancelled",
    source: SOURCE.bookings,
    scope: "table",
    businessDefinition: "Count of bookings with status = CANCELLED from server aggregates.",
    drillDown: "Click applies the status filter and refreshes the table.",
    localizationKeys: {
      title: "booking.status.CANCELLED",
      short: "help.bookings.status.cancelled.short",
      description: "help.bookings.status.cancelled.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.group.lifecycle",
    type: "group",
    domain: "bookings",
    purpose: "Bookings lifecycle group heading",
    source: SOURCE.bookings,
    scope: "global",
    businessDefinition: "Semantic KPI group label; NOT a status. Request/service phases.",
    localizationKeys: {
      title: "bookings.group.lifecycle",
      short: "help.bookings.group.lifecycle.short",
      description: "help.bookings.group.lifecycle.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.group.awaiting",
    type: "group",
    domain: "bookings",
    purpose: "Bookings awaiting group heading",
    source: SOURCE.bookings,
    scope: "global",
    businessDefinition: "Semantic KPI group label; NOT a status. Waiting states with no current producer.",
    localizationKeys: {
      title: "bookings.group.awaiting",
      short: "help.bookings.group.awaiting.short",
      description: "help.bookings.group.awaiting.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.group.decisions",
    type: "group",
    domain: "bookings",
    purpose: "Bookings decisions group heading",
    source: SOURCE.bookings,
    scope: "global",
    businessDefinition: "Semantic KPI group label; NOT a status. Operational/decision markers.",
    localizationKeys: {
      title: "bookings.group.decisions",
      short: "help.bookings.group.decisions.short",
      description: "help.bookings.group.decisions.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "bookings.group.terminal",
    type: "group",
    domain: "bookings",
    purpose: "Bookings terminal group heading",
    source: SOURCE.bookings,
    scope: "global",
    businessDefinition: "Semantic KPI group label; NOT a status. Terminal outcomes.",
    localizationKeys: {
      title: "bookings.group.terminal",
      short: "help.bookings.group.terminal.short",
      description: "help.bookings.group.terminal.description",
    },
    contractVersion: CONTRACT_VERSION,
  },

  /* ═══════════════════════ PAYMENTS ═══════════════════════ */
  {
    id: "payments.kpi.total",
    type: "kpi",
    domain: "payments",
    purpose: "Total payment count in the global scope",
    source: SOURCE.payments,
    scope: "global",
    businessDefinition: "Server-side count of payments in the global scope (workspace + Header Period) from list aggregates.",
    formula: "overview total = server aggregates.paymentStatus total in global scope",
    period: "global",
    reconciliationRule: "Rendered KPI == server aggregates total == table total when no table-only KPI filter is active.",
    drillDown: "Click clears paymentStatus/refundStatus/currencyCard and refreshes the table.",
    localizationKeys: {
      title: "payments.kpi.total",
      short: "help.payments.kpi.total.short",
      description: "help.payments.kpi.total.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "payments.status.pending",
    type: "status",
    domain: "payments",
    group: "payments.group.payment_statuses",
    purpose: "Payment created, awaiting processing",
    source: SOURCE.payments,
    scope: "table",
    businessDefinition: "Count of payments with PaymentStatus = PENDING from server aggregates.",
    drillDown: "Click applies the paymentStatus filter and refreshes the table.",
    localizationKeys: {
      title: "status.entity.PENDING",
      short: "help.payments.status.pending.short",
      description: "help.payments.status.pending.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "payments.status.authorized",
    type: "status",
    domain: "payments",
    group: "payments.group.payment_statuses",
    purpose: "Payment authorized but not captured",
    source: SOURCE.payments,
    scope: "table",
    businessDefinition: "Count of payments with PaymentStatus = AUTHORIZED from server aggregates.",
    drillDown: "Click applies the paymentStatus filter and refreshes the table.",
    localizationKeys: {
      title: "status.entity.AUTHORIZED",
      short: "help.payments.status.authorized.short",
      description: "help.payments.status.authorized.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "payments.status.captured",
    type: "status",
    domain: "payments",
    group: "payments.group.payment_statuses",
    purpose: "Payment captured (funds received)",
    source: SOURCE.payments,
    scope: "table",
    businessDefinition: "Count of payments with PaymentStatus = CAPTURED from server aggregates.",
    drillDown: "Click applies the paymentStatus filter and refreshes the table.",
    localizationKeys: {
      title: "status.entity.CAPTURED",
      short: "help.payments.status.captured.short",
      description: "help.payments.status.captured.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "payments.status.failed",
    type: "status",
    domain: "payments",
    group: "payments.group.payment_statuses",
    purpose: "Payment attempt failed",
    source: SOURCE.payments,
    scope: "table",
    businessDefinition: "Count of payments with PaymentStatus = FAILED from server aggregates.",
    drillDown: "Click applies the paymentStatus filter and refreshes the table.",
    localizationKeys: {
      title: "status.entity.FAILED",
      short: "help.payments.status.failed.short",
      description: "help.payments.status.failed.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "payments.status.cancelled",
    type: "status",
    domain: "payments",
    group: "payments.group.payment_statuses",
    purpose: "Payment cancelled",
    source: SOURCE.payments,
    scope: "table",
    businessDefinition: "Count of payments with PaymentStatus = CANCELLED from server aggregates.",
    drillDown: "Click applies the paymentStatus filter and refreshes the table.",
    localizationKeys: {
      title: "status.entity.CANCELLED",
      short: "help.payments.status.cancelled.short",
      description: "help.payments.status.cancelled.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "payments.status.refunded",
    type: "status",
    domain: "payments",
    group: "payments.group.payment_statuses",
    purpose: "Payment fully refunded",
    source: SOURCE.payments,
    scope: "table",
    businessDefinition: "Count of payments with PaymentStatus = REFUNDED from server aggregates.",
    drillDown: "Click applies the paymentStatus filter and refreshes the table.",
    localizationKeys: {
      title: "status.entity.REFUNDED",
      short: "help.payments.status.refunded.short",
      description: "help.payments.status.refunded.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "payments.refund.status.requested",
    type: "status",
    domain: "payments",
    group: "payments.group.refund_statuses",
    purpose: "Refund requested",
    source: SOURCE.payments,
    scope: "table",
    businessDefinition: "Count of payments with RefundStatus = REQUESTED from server aggregates.",
    drillDown: "Click applies the refundStatus filter and refreshes the table.",
    localizationKeys: {
      title: "status.entity.REQUESTED",
      short: "help.payments.refund.status.requested.short",
      description: "help.payments.refund.status.requested.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "payments.refund.status.approved",
    type: "status",
    domain: "payments",
    group: "payments.group.refund_statuses",
    purpose: "Refund approved",
    source: SOURCE.payments,
    scope: "table",
    businessDefinition: "Count of payments with RefundStatus = APPROVED from server aggregates.",
    drillDown: "Click applies the refundStatus filter and refreshes the table.",
    localizationKeys: {
      title: "status.entity.APPROVED",
      short: "help.payments.refund.status.approved.short",
      description: "help.payments.refund.status.approved.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "payments.refund.status.processed",
    type: "status",
    domain: "payments",
    group: "payments.group.refund_statuses",
    purpose: "Refund processed",
    source: SOURCE.payments,
    scope: "table",
    businessDefinition: "Count of payments with RefundStatus = PROCESSED from server aggregates.",
    drillDown: "Click applies the refundStatus filter and refreshes the table.",
    localizationKeys: {
      title: "status.entity.PROCESSED",
      short: "help.payments.refund.status.processed.short",
      description: "help.payments.refund.status.processed.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "payments.refund.status.failed",
    type: "status",
    domain: "payments",
    group: "payments.group.refund_statuses",
    purpose: "Refund attempt failed",
    source: SOURCE.payments,
    scope: "table",
    businessDefinition: "Count of payments with RefundStatus = FAILED from server aggregates.",
    drillDown: "Click applies the refundStatus filter and refreshes the table.",
    localizationKeys: {
      title: "status.entity.FAILED",
      short: "help.payments.refund.status.failed.short",
      description: "help.payments.refund.status.failed.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "payments.group.payment_statuses",
    type: "group",
    domain: "payments",
    purpose: "Payments PaymentStatus group heading",
    source: SOURCE.payments,
    scope: "global",
    businessDefinition: "Semantic KPI group label; NOT a status. PaymentStatus dimension (6 values).",
    overlapRule: "One active KPI dimension at a time: paymentStatus > refundStatus > currencyCard.",
    localizationKeys: {
      title: "payments.group.payment_statuses",
      short: "help.payments.group.payment_statuses.short",
      description: "help.payments.group.payment_statuses.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "payments.group.refund_statuses",
    type: "group",
    domain: "payments",
    purpose: "Payments RefundStatus group heading",
    source: SOURCE.payments,
    scope: "global",
    businessDefinition: "Semantic KPI group label; NOT a status. RefundStatus dimension (4 values), separate from PaymentStatus.",
    overlapRule: "One active KPI dimension at a time: paymentStatus > refundStatus > currencyCard.",
    localizationKeys: {
      title: "payments.group.refund_statuses",
      short: "help.payments.group.refund_statuses.short",
      description: "help.payments.group.refund_statuses.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
  {
    id: "payments.group.currencies",
    type: "group",
    domain: "payments",
    purpose: "Payments currency group heading",
    source: SOURCE.payments,
    scope: "global",
    businessDefinition: "Dynamic per-currency aggregates from the server overview. Currencies are data, not statuses.",
    overlapRule: "One active KPI dimension at a time: paymentStatus > refundStatus > currencyCard.",
    localizationKeys: {
      title: "payments.group.currencies",
      short: "help.payments.group.currencies.short",
      description: "help.payments.group.currencies.description",
    },
    contractVersion: CONTRACT_VERSION,
  },
];

/** Canonical domains in Operations Center tab order. */
export const HELP_DOMAINS: readonly HelpDomain[] = ["requests", "orders", "bookings", "payments"] as const;

/** Public, read-only registry access. */
export const HELP_REGISTRY: readonly HelpEntry[] = REGISTRY;

export function getHelpEntry(id: string): HelpEntry | undefined {
  return REGISTRY.find((e) => e.id === id);
}

export function helpEntriesByDomain(domain: HelpDomain): readonly HelpEntry[] {
  return REGISTRY.filter((e) => e.domain === domain);
}

/** All stable help IDs (registry tests + unknown-topic handling). */
export const ALL_HELP_IDS: readonly string[] = REGISTRY.map((e) => e.id);

/** Status entries only (type === "status"), for canonical-universe tests. */
export const HELP_STATUS_ENTRIES: readonly HelpEntry[] = REGISTRY.filter((e) => e.type === "status");

/* ── UI-C1.2H.1 — platform-level Help taxonomy (model extension, zero content) ── */

/** All Help areas in stable dictionary order (future areas included). */
export const HELP_AREAS: readonly HelpArea[] = [
  "platform",
  "command-center",
  "analytics",
  "operations",
  "finance",
  "sales",
  "catalog",
  "crm",
  "marketing",
  "support",
  "admin",
  "marketplace",
  "shared",
] as const;

/**
 * Area of each current production domain (canonical shell ownership:
 * Operations → Requests/Orders/Bookings; Finance → Payments).
 */
export const HELP_AREA_BY_DOMAIN: Record<HelpDomain, HelpArea> = {
  requests: "operations",
  orders: "operations",
  bookings: "operations",
  payments: "finance",
} as const;

/** Area of any registry entry. */
export function helpAreaOf(entry: Pick<HelpEntry, "domain">): HelpArea {
  return HELP_AREA_BY_DOMAIN[entry.domain];
}

/** Entries under an area — empty for every FUTURE area (no invented content). */
export function helpEntriesByArea(area: HelpArea): readonly HelpEntry[] {
  return REGISTRY.filter((e) => HELP_AREA_BY_DOMAIN[e.domain] === area);
}

/** Areas that own registry entries today (content areas). */
export const HELP_CONTENT_AREAS: readonly HelpArea[] = [...new Set(HELP_REGISTRY.map((e) => helpAreaOf(e)))] as const;

/** Resolved workspace scope (default: both platform and partner workspaces). */
export function helpWorkspaceOf(entry: HelpEntry): "platform" | "partner" | "both" {
  return entry.workspace ?? "both";
}