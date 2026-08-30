/**
 * Shared Metric Drill-down Framework — Phase 3 Pre-Step 3.12
 *
 * Canonical project-wide mechanism for metric source traceability.
 * Used by MetricCard, MetricTableCell, and future chart/data-point consumers.
 *
 * Architecture:
 *   MetricCard / MetricTableCell / ChartPoint
 *           ↓
 *     MetricDrilldownConfig
 *           ↓
 *     DestinationResolver → URL with filters
 *           ↓
 *     Authoritative Data Source / Detail View
 *           ↓
 *     Reconciliation (source total = destination total)
 */

// ── Destination Types ────────────────────────────────────────────────────

export type DestinationType = "DOMAIN_ROUTE" | "DETAIL_VIEW" | "NONE";

// ── Period Policies ──────────────────────────────────────────────────────

/**
 * PERIOD_BOUND — metric is scoped to selected period (from/to).
 *   Drill-down transfers period filters.
 *
 * ALL_TIME — metric represents all-time stock (e.g., total registered customers).
 *   Drill-down does NOT transfer period.
 *
 * AS_OF_DATE — metric is a snapshot at a point in time.
 *   Drill-down transfers the end date as "as of".
 */
export type PeriodPolicy = "PERIOD_BOUND" | "ALL_TIME" | "AS_OF_DATE";

// ── Drill-down Contract ──────────────────────────────────────────────────

export interface MetricDrilldownConfig {
  /** Unique metric identifier (e.g., "analytics.orders", "analytics.customers") */
  metricId: string;

  /** Where to navigate */
  destinationType: DestinationType;
  destination: string; // URL path or detail view ID

  /** Period transfer policy */
  periodPolicy: PeriodPolicy;

  /** Status population filter (e.g., ["FULFILLED","CLOSED"] for GMV) */
  statusFilter?: readonly string[];

  /** Currency scope (e.g., "AZN", "USD", or undefined for all) */
  currency?: string;

  /** Partner scope (for partner-scoped metrics) */
  partnerId?: string;

  /** Additional metric-specific query params to transfer */
  extraParams?: Record<string, string>;

  /** Human-readable label for the metric (for accessibility) */
  label?: string;
}

// ── Period Context (transferred to destination) ──────────────────────────

export interface PeriodContext {
  preset: string;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

// ── Resolver ─────────────────────────────────────────────────────────────

/**
 * Build the destination URL with preserved filter context.
 * Only transfers semantically relevant params based on PeriodPolicy.
 */
export function resolveDrilldownUrl(
  config: MetricDrilldownConfig,
  period: PeriodContext,
): string {
  const url = new URL(config.destination, window.location.origin);

  // Transfer period only for PERIOD_BOUND metrics
  if (config.periodPolicy === "PERIOD_BOUND") {
    if (period.from) url.searchParams.set("from", period.from);
    if (period.to) url.searchParams.set("to", period.to);
    if (period.preset) url.searchParams.set("preset", period.preset);
  } else if (config.periodPolicy === "AS_OF_DATE" && period.to) {
    url.searchParams.set("asOf", period.to);
  }
  // ALL_TIME: no period transfer

  // Transfer status filter
  if (config.statusFilter && config.statusFilter.length > 0) {
    url.searchParams.set("status", config.statusFilter.join(","));
  }

  // Transfer currency
  if (config.currency) {
    url.searchParams.set("currency", config.currency);
  }

  // Transfer partner scope
  if (config.partnerId) {
    url.searchParams.set("partnerId", config.partnerId);
  }

  // Transfer extra params
  if (config.extraParams) {
    for (const [k, v] of Object.entries(config.extraParams)) {
      url.searchParams.set(k, v);
    }
  }

  // Mark as analytics drill-down for destination awareness
  url.searchParams.set("fromAnalytics", "true");

  return url.pathname + url.search;
}

// ── Common Metric Configurations ─────────────────────────────────────────

export const METRIC_CONFIGS = {
  // Period-bound metrics
  "analytics.orders": {
    metricId: "analytics.orders",
    destinationType: "DOMAIN_ROUTE" as DestinationType,
    destination: "/app/orders",
    periodPolicy: "PERIOD_BOUND" as PeriodPolicy,
  },
  "analytics.bookings": {
    metricId: "analytics.bookings",
    destinationType: "DOMAIN_ROUTE" as DestinationType,
    destination: "/app/bookings",
    periodPolicy: "PERIOD_BOUND" as PeriodPolicy,
  },
  "analytics.gmv": {
    metricId: "analytics.gmv",
    destinationType: "DOMAIN_ROUTE" as DestinationType,
    destination: "/app/orders",
    periodPolicy: "PERIOD_BOUND" as PeriodPolicy,
    statusFilter: ["FULFILLED", "CLOSED"],
  },
  "analytics.revenue": {
    metricId: "analytics.revenue",
    destinationType: "DOMAIN_ROUTE" as DestinationType,
    destination: "/app/orders",
    periodPolicy: "PERIOD_BOUND" as PeriodPolicy,
  },
  "analytics.refunds": {
    metricId: "analytics.refunds",
    destinationType: "NONE" as DestinationType,
    destination: "",
    periodPolicy: "PERIOD_BOUND" as PeriodPolicy,
  },
  "analytics.commission": {
    metricId: "analytics.commission",
    destinationType: "NONE" as DestinationType,
    destination: "",
    periodPolicy: "PERIOD_BOUND" as PeriodPolicy,
  },
  "analytics.aov": {
    metricId: "analytics.aov",
    destinationType: "NONE" as DestinationType,
    destination: "",
    periodPolicy: "PERIOD_BOUND" as PeriodPolicy,
  },
  "analytics.sessions": {
    metricId: "analytics.sessions",
    destinationType: "NONE" as DestinationType,
    destination: "",
    periodPolicy: "PERIOD_BOUND" as PeriodPolicy,
  },

  // All-time stock metrics
  "analytics.customers": {
    metricId: "analytics.customers",
    destinationType: "DOMAIN_ROUTE" as DestinationType,
    destination: "/app/crm",
    periodPolicy: "ALL_TIME" as PeriodPolicy,
  },
  "analytics.partners": {
    metricId: "analytics.partners",
    destinationType: "DOMAIN_ROUTE" as DestinationType,
    destination: "/app/crm",
    periodPolicy: "ALL_TIME" as PeriodPolicy,
    extraParams: { tab: "partners" },
  },

  // GMV lifecycle (all period-bound)
  "analytics.qualified_gmv": {
    metricId: "analytics.qualified_gmv",
    destinationType: "DOMAIN_ROUTE" as DestinationType,
    destination: "/app/orders",
    periodPolicy: "PERIOD_BOUND" as PeriodPolicy,
    statusFilter: ["NEW", "CONFIRMED", "FULFILLED", "CLOSED"],
  },
  "analytics.collected_gmv": {
    metricId: "analytics.collected_gmv",
    destinationType: "DOMAIN_ROUTE" as DestinationType,
    destination: "/app/orders",
    periodPolicy: "PERIOD_BOUND" as PeriodPolicy,
  },
  "analytics.outstanding_gmv": {
    metricId: "analytics.outstanding_gmv",
    destinationType: "DOMAIN_ROUTE" as DestinationType,
    destination: "/app/orders",
    periodPolicy: "PERIOD_BOUND" as PeriodPolicy,
  },
} as const;

export type MetricId = keyof typeof METRIC_CONFIGS;
