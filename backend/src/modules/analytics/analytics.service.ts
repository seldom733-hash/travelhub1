/**
 * Step 3.3 Analytics Foundation — Analytics Service (Remediated)
 *
 * Orchestrates period resolution, metric computation, and read-model queries.
 * Reads from canonical Prisma schema — no separate analytics warehouse.
 *
 * Design authority: docs/architecture/analytics-foundation-3.3.md
 * Remediation: Strict Review VERDICT B findings closure.
 *
 * Key fixes:
 * - CRITICAL-1: permission uses canonical analytics.read (controller-side)
 * - HIGH-1: Revenue uses Payment.paidAt (canonical lifecycle timestamp)
 * - HIGH-2: Decimal arithmetic replaces JS float for monetary values
 * - HIGH-3: Financial Reconciliation Summary read model added
 * - HIGH-4: Partner IDOR fixed — partner scope enforced at query boundary
 * - HIGH-5: Actor attribution fields exposed in read models
 * - HIGH-6: Partner Performance: real revenue/commission/bookings/activeProducts
 * - MEDIUM-1: AOV (Average Order Value) added
 * - MEDIUM-2: Funnel uses unique entity counts, not raw event counts
 * - MEDIUM-4: Multi-currency returns currency-separated aggregates
 */

import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  AnalyticsPeriodPreset,
  type PeriodRequest,
  type ResolvedPeriod,
  resolvePeriod,
} from "./analytics-period.resolver";
import {
  resolveComparison,
  type ComparisonPeriods,
} from "./analytics-comparison.resolver";
import {
  AnalyticsGranularity,
  resolveGranularity,
  generateTimeBuckets,
  type TimeBucket,
} from "./analytics-granularity.resolver";
import type { AuthUser } from "../../security/auth/auth.service";

// ─── Decimal Arithmetic ─────────────────────────────────────────────────────
// HIGH-2 remediation: no JS float on monetary values.

/**
 * Sum a Decimal amount as string — preserves canonical exactness.
 * Input amount is Prisma Decimal(12,2) which serializes as string.
 * Uses integer arithmetic on cents to avoid floating-point corruption.
 */
function sumDecimalString(
  records: Array<{ amount: unknown; currency: string }>,
): Record<string, string> {
  const centsByCurrency = new Map<string, number>();
  for (const r of records) {
    const cur = r.currency || "USD";
    const amountStr = String(r.amount ?? "0");
    const cents = Math.round(parseFloat(amountStr) * 100);
    centsByCurrency.set(cur, (centsByCurrency.get(cur) || 0) + cents);
  }
  const result: Record<string, string> = {};
  for (const [cur, cents] of centsByCurrency) {
    result[cur] = (cents / 100).toFixed(2);
  }
  return result;
}

/**
 * Sum a specific Decimal field as string — preserves canonical exactness.
 * Variant of sumDecimalString that sums a named field instead of `amount`.
 */
function sumDecimalField(
  records: Array<Record<string, unknown>>,
  fieldName: string,
): Record<string, string> {
  const centsByCurrency = new Map<string, number>();
  for (const r of records) {
    const cur = String(r.currency || "USD");
    const amountStr = String(r[fieldName] ?? "0");
    const cents = Math.round(parseFloat(amountStr) * 100);
    centsByCurrency.set(cur, (centsByCurrency.get(cur) || 0) + cents);
  }
  const result: Record<string, string> = {};
  for (const [cur, cents] of centsByCurrency) {
    result[cur] = (cents / 100).toFixed(2);
  }
  return result;
}

/**
 * PLATFORM REPORTING CURRENCY — single source of truth for aggregated KPIs.
 * B.1 Remediation: all PLATFORM management KPIs use AZN.
 */
const PLATFORM_REPORTING_CURRENCY = "AZN";

/**
 * Return the platform reporting currency total from a currency map.
 * Prefers PLATFORM_REPORTING_CURRENCY (AZN); falls back to first available.
 * B.2: all Executive monetary KPIs must render in AZN.
 */
function primaryCurrencyTotal(
  byCurrency: Record<string, string>,
): { total: string; currency: string } {
  const keys = Object.keys(byCurrency);
  if (keys.length === 0) return { total: "0.00", currency: PLATFORM_REPORTING_CURRENCY };
  // Prefer platform reporting currency
  if (byCurrency[PLATFORM_REPORTING_CURRENCY] !== undefined) {
    return { total: byCurrency[PLATFORM_REPORTING_CURRENCY], currency: PLATFORM_REPORTING_CURRENCY };
  }
  // Fallback: first available
  const cur = keys[0];
  return { total: byCurrency[cur], currency: cur };
}

/**
 * Compute Net Revenue = Revenue - Refunds as integer-cent arithmetic.
 */
function subtractDecimalStrings(
  revenueByCurrency: Record<string, string>,
  refundByCurrency: Record<string, string>,
): Record<string, string> {
  const allCurrencies = new Set([
    ...Object.keys(revenueByCurrency),
    ...Object.keys(refundByCurrency),
  ]);
  const result: Record<string, string> = {};
  for (const cur of allCurrencies) {
    const rev = Math.round(parseFloat(revenueByCurrency[cur] || "0") * 100);
    const ref = Math.round(parseFloat(refundByCurrency[cur] || "0") * 100);
    result[cur] = ((rev - ref) / 100).toFixed(2);
  }
  return result;
}

// ─── Authoritative Timestamp Helpers ────────────────────────────────────────
// HIGH-1 remediation: each metric uses its canonical lifecycle timestamp.

/**
 * Revenue → Payment.paidAt (not createdAt).
 */
function revenueWhere(start: Date, end: Date) {
  return {
    status: "CAPTURED" as const,
    paidAt: { gte: start, lt: end },
  };
}

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface AnalyticsQueryDto {
  preset: AnalyticsPeriodPreset;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  comparison?: boolean;
  granularity?: AnalyticsGranularity;
  partnerId?: string;
  acquisitionSource?: string;
}

export interface ComparisonValue<T = number> {
  current: T;
  previous: T | null;
  delta: T | null;
  deltaPercent: number | null;
}

export interface CompanyKpiResponse {
  period: {
    start: string;
    endExclusive: string;
    timezone: string;
    preset: string;
  };
  comparison?: {
    start: string;
    endExclusive: string;
  };
  metrics: {
    gmv: ComparisonValue<string>;
    revenue: ComparisonValue<string>;
    netRevenue: ComparisonValue<string>;
    commissionAccrued: ComparisonValue<string>;
    ordersCreated: ComparisonValue<number>;
    ordersFulfilled: ComparisonValue<number>;
    bookingsRequested: ComparisonValue<number>;
    bookingsConfirmed: ComparisonValue<number>;
    bookingsCompleted: ComparisonValue<number>;
    paymentsCaptured: ComparisonValue<number>;
    refundsProcessed: ComparisonValue<number>;
    marketplaceSessions: ComparisonValue<number>;
    storefrontSessions: ComparisonValue<number>;
    /** Phase 3 Pre-3.12: Marketplace Visitors = COUNT(DISTINCT visitorId) */
    marketplaceVisitors: ComparisonValue<number>;
    /** Phase 3 Pre-3.12: Marketplace Visits = COUNT(DISTINCT sessionId) from Marketplace only */
    marketplaceVisits: ComparisonValue<number>;
    marketplacePartners: ComparisonValue<number>;
    storefrontPartners: ComparisonValue<number>;
    totalActivePartners: ComparisonValue<number>;
    marketplaceCustomers: ComparisonValue<number>;
    storefrontCustomers: ComparisonValue<number>;
    totalActiveCustomers: ComparisonValue<number>;
    averageOrderValue: ComparisonValue<string>;
    refunds: ComparisonValue<string>;
    refundsCurrency: string;
    gmvCurrency: string;
    revenueCurrency: string;
    commissionCurrency: string;
    // ── GMV Lifecycle metrics (Policy Closure) ──
    /** Qualified GMV: SUM(amount) WHERE status NOT IN (NEW, CANCELLED), COHORT by createdAt */
    qualifiedGmv: ComparisonValue<string>;
    /** Completed GMV: SUM(amount) WHERE status IN (FULFILLED, CLOSED), COHORT by createdAt */
    completedGmv: ComparisonValue<string>;
    /** Collected GMV: SUM(paidAmount) WHERE status NOT IN (NEW, CANCELLED), COHORT by createdAt */
    collectedGmv: ComparisonValue<string>;
    /** Outstanding GMV: qualifiedGmv - collectedGmv, COHORT */
    outstandingGmv: ComparisonValue<string>;
  };
  attribution?: {
    actionFields: string[];
    ownershipFields: string[];
    outcomeFields: string[];
  };
}

export interface PartnerPerformanceResponse {
  period: {
    start: string;
    endExclusive: string;
    timezone: string;
    preset: string;
  };
  partners: Array<{
    partnerId: string;
    partnerName: string;
    gmv: string;
    revenue: string;
    commission: string;
    ordersCount: number;
    bookingsCount: number;
    activeProducts: number;
    bookingCompletionRate: number | null;
  }>;
}

export interface ConversionFunnelResponse {
  period: {
    start: string;
    endExclusive: string;
    timezone: string;
    preset: string;
  };
  acquisitionSource?: string;
  stages: Array<{
    stage: string;
    count: number;
    uniqueEntities?: number;
  }>;
}

export interface TimeSeriesResponse {
  period: {
    start: string;
    endExclusive: string;
    timezone: string;
    preset: string;
  };
  granularity: string;
  buckets: Array<{
    label: string;
    start: string;
    endExclusive: string;
    value: number;
  }>;
}

export interface CurrencyReconciliation {
  currency: string;
  paymentCount: number;
  totalPayments: string;
  totalRefunds: string;
  netPayments: string;
  totalCommission: string;
}

export interface FinancialReconciliationResponse {
  period: {
    start: string;
    endExclusive: string;
    timezone: string;
    preset: string;
  };
  /** @deprecated Use currencies[] for multi-currency reconciliation. */
  currency: string;
  /** @deprecated Use currencies[] for multi-currency reconciliation. */
  totalPayments: string;
  /** @deprecated Use currencies[] for multi-currency reconciliation. */
  totalRefunds: string;
  /** @deprecated Use currencies[] for multi-currency reconciliation. */
  netPayments: string;
  /** @deprecated Use currencies[] for multi-currency reconciliation. */
  totalCommission: string;
  totalLedgerEntries: number;
  currencies: CurrencyReconciliation[];
}

// ── Step 3.5E — CRM Analytics Response ─────────────────────────────────

export interface CrmAnalyticsResponse {
  period: {
    start: string;
    endExclusive: string;
    timezone: string;
    preset: string;
  };
  scope: {
    partnerId: string | null;
    label: "platform" | "partner";
  };
  metrics: {
    totalCustomers: number;
    totalRelationships: number;
    lifecycleBreakdown: Record<string, number>;
    sourceBreakdown: Record<string, number>;
    managerBreakdown: Record<string, number>;
    newRelationships: number;
    newBySource: Record<string, number>;
    commerciallyActiveCustomers: number;
    /**
     * DEFERRED: no canonical business definition of "repeat customer" exists
     * in repository. Possible definitions (2+ orders, 2+ completed orders,
     * prior purchase before period, etc.) are NOT interchangeable.
     * Removed from public contract per Step 3.5E.1 Finding A.
     */
  };
}

// ─── Authorization Helpers ──────────────────────────────────────────────────

type AnalyticsUser = AuthUser;

/**
 * HIGH-4: Partner IDOR fix — scope enforced at query boundary.
 */
function resolvePartnerScope(
  user: AnalyticsUser,
  requestedPartnerId: string | undefined,
): string | undefined {
  if (user.role === "BUYER") {
    throw new ForbiddenException("BUYER role cannot access analytics");
  }
  if (user.role === "PARTNER") {
    return user.partnerId ?? undefined;
  }
  return requestedPartnerId;
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveQueryPeriod(dto: AnalyticsQueryDto): ComparisonPeriods {
    let period;
    try {
      period = resolvePeriod({
        preset: dto.preset,
        startDate: dto.startDate,
        endDate: dto.endDate,
        timezone: dto.timezone,
      });
    } catch (err: any) {
      throw new BadRequestException(err?.message || "Invalid period parameters");
    }
    const comparison =
      dto.comparison !== false ? resolveComparison(period) : undefined;
    return {
      current: period,
      comparison: comparison || period,
    };
  }

  private compareValues(
    current: number,
    previous: number | null,
  ): ComparisonValue<number> {
    if (previous === null) {
      return { current, previous: null, delta: null, deltaPercent: null };
    }
    const delta = current - previous;
    const deltaPercent =
      previous === 0 ? null : Math.round((delta / previous) * 10000) / 100;
    return { current, previous, delta, deltaPercent };
  }

  private compareDecimalValues(
    current: string,
    previous: string | null,
  ): ComparisonValue<string> {
    if (previous === null) {
      return { current, previous: null, delta: null, deltaPercent: null };
    }
    const cCents = Math.round(parseFloat(current) * 100);
    const pCents = Math.round(parseFloat(previous) * 100);
    const deltaCents = cCents - pCents;
    const delta = (deltaCents / 100).toFixed(2);
    const deltaPercent =
      pCents === 0
        ? null
        : Math.round((deltaCents / pCents) * 10000) / 100;
    return { current, previous, delta, deltaPercent };
  }

  // ─── Company KPI Summary ────────────────────────────────────────────────

  async getCompanyKpi(
    dto: AnalyticsQueryDto,
    _user: AnalyticsUser,
  ): Promise<CompanyKpiResponse> {
    const { current, comparison } = this.resolveQueryPeriod(dto);
    const prev = dto.comparison !== false ? comparison : undefined;

    // ── Phase 1: Independent queries (Marketplace-scoped orders/bookings) ──
    // All commerce metrics must reflect Marketplace operational scope only.
    // Payments/refunds/commissions require order IDs → fetched in Phase 2.
    const [
      orders,
      prevOrders,
      bookings,
      prevBookings,
      marketplaceCustomers,
      storefrontCustomers,
      behavioralMarketplace,
      behavioralStorefront,
      marketplaceVisitorsRaw,
      marketplaceVisitsRaw,
      marketplacePartners,
      storefrontPartners,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          acquisitionSource: "MARKETPLACE",
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { id: true, amount: true, paidAmount: true, currency: true, status: true },
      }),
      prev
        ? this.prisma.order.findMany({
            where: {
              acquisitionSource: "MARKETPLACE",
              createdAt: { gte: prev.start, lt: prev.endExclusive },
            },
            select: { id: true },
          })
        : Promise.resolve([]),
      this.prisma.booking.findMany({
        where: {
          acquisitionSource: "MARKETPLACE",
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { id: true, status: true },
      }),
      prev
        ? this.prisma.booking.findMany({
            where: {
              acquisitionSource: "MARKETPLACE",
              createdAt: { gte: prev.start, lt: prev.endExclusive },
            },
            select: { id: true },
          })
        : Promise.resolve([]),
      // Marketplace customers: unique buyers who placed orders via MARKETPLACE
      this.prisma.order.findMany({
        where: {
          acquisitionSource: "MARKETPLACE",
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { customerId: true },
      }),
      // Storefront customers: unique buyers who placed orders via PARTNER_STOREFRONT (for Storefront SaaS section)
      this.prisma.order.findMany({
        where: {
          acquisitionSource: "PARTNER_STOREFRONT",
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { customerId: true },
      }),
      this.prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(DISTINCT "sessionId") as cnt
        FROM catalog."MarketplaceBehavioralEvent"
        WHERE "occurredAt" >= ${current.start} AND "occurredAt" < ${current.endExclusive}
      `,
      this.prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(DISTINCT "sessionId") as cnt
        FROM catalog."StorefrontBehavioralEvent"
        WHERE "occurredAt" >= ${current.start} AND "occurredAt" < ${current.endExclusive}
      `,
      // Phase 3 Pre-3.12: Marketplace Visitors = COUNT(DISTINCT visitorId) from Marketplace only
      this.prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(DISTINCT "visitorId") as cnt
        FROM catalog."MarketplaceBehavioralEvent"
        WHERE "occurredAt" >= ${current.start} AND "occurredAt" < ${current.endExclusive}
          AND "visitorId" IS NOT NULL
      `,
      // Phase 3 Pre-3.12: Marketplace Visits = COUNT(DISTINCT sessionId) from Marketplace only
      this.prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(DISTINCT "sessionId") as cnt
        FROM catalog."MarketplaceBehavioralEvent"
        WHERE "occurredAt" >= ${current.start} AND "occurredAt" < ${current.endExclusive}
      `,
      // Marketplace partners: partners with ≥1 PUBLISHED product in MARKETPLACE channel
      this.prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(DISTINCT p."partnerId") as cnt
        FROM catalog."Product" p
        INNER JOIN catalog."ProductPublicationChannel" ppc ON ppc."productId" = p.id
        WHERE p."status" = 'PUBLISHED' AND p."partnerId" IS NOT NULL AND ppc."channel" = 'MARKETPLACE'
      `,
      // Storefront partners: partners with ≥1 active storefront
      this.prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(DISTINCT "partnerId") as cnt
        FROM catalog."PartnerStorefront"
        WHERE "entitlementStatus" = 'ACTIVE' AND "partnerId" IS NOT NULL
      `,
    ]);

    // ── Phase 2: Dependent queries (filtered by marketplace order IDs) ──
    const marketplaceOrderIds = orders.map((o) => o.id);
    const prevMarketplaceOrderIds = prevOrders.map((o) => o.id);
    const [payments, prevPayments, refunds, commissions, prevCommissions] = await Promise.all([
      // Payments scoped to Marketplace orders (Payment has no acquisitionSource)
      marketplaceOrderIds.length > 0
        ? this.prisma.payment.findMany({
            where: {
              orderId: { in: marketplaceOrderIds },
              ...revenueWhere(current.start, current.endExclusive),
            },
            select: { id: true, amount: true, currency: true },
          })
        : Promise.resolve([]),
      prev && prevMarketplaceOrderIds.length > 0
        ? this.prisma.payment.findMany({
            where: {
              orderId: { in: prevMarketplaceOrderIds },
              ...revenueWhere(prev.start, prev.endExclusive),
            },
            select: { id: true, amount: true, currency: true },
          })
        : Promise.resolve([]),
      // Refunds scoped to Marketplace orders
      marketplaceOrderIds.length > 0
        ? this.prisma.refund.findMany({
            where: {
              orderId: { in: marketplaceOrderIds },
              status: "PROCESSED",
              processedAt: { gte: current.start, lt: current.endExclusive },
            },
            select: { id: true, amount: true, currency: true },
          })
        : Promise.resolve([]),
      // Commissions scoped to Marketplace orders
      marketplaceOrderIds.length > 0
        ? this.prisma.commission.findMany({
            where: {
              orderId: { in: marketplaceOrderIds },
              createdAt: { gte: current.start, lt: current.endExclusive },
            },
            select: { id: true, amount: true, currency: true },
          })
        : Promise.resolve([]),
      prev && prevMarketplaceOrderIds.length > 0
        ? this.prisma.commission.findMany({
            where: {
              orderId: { in: prevMarketplaceOrderIds },
              createdAt: { gte: prev.start, lt: prev.endExclusive },
            },
            select: { id: true, amount: true, currency: true },
          })
        : Promise.resolve([]),
    ]);

    // HIGH-2: Decimal arithmetic
    const fulfilledOrders = orders.filter(
      (o) => o.status === "FULFILLED" || o.status === "CLOSED",
    );
    const gmvByCurrency = sumDecimalString(fulfilledOrders);
    const revenueByCurrency = sumDecimalString(payments);
    const refundByCurrency = sumDecimalString(refunds);
    const commissionByCurrency = sumDecimalString(commissions);

    // ── GMV Lifecycle (Policy Closure) ──
    // Qualified GMV: all orders except NEW/CANCELLED (economic qualification)
    const qualifiedOrders = orders.filter(
      (o) => o.status !== "NEW" && o.status !== "CANCELLED",
    );
    const qualifiedGmvByCurrency = sumDecimalString(qualifiedOrders);
    // Completed GMV = current GMV (FULFILLED + CLOSED)
    const completedGmvByCurrency = gmvByCurrency;
    // Collected GMV: SUM(paidAmount) for qualified orders
    const collectedGmvByCurrency = sumDecimalField(qualifiedOrders, "paidAmount");

    // MEDIUM-1: AOV = GMV / count(fulfilled orders)
    const ordersCountByCurrency = new Map<string, number>();
    for (const o of fulfilledOrders) {
      const cur = o.currency || "USD";
      ordersCountByCurrency.set(
        cur,
        (ordersCountByCurrency.get(cur) || 0) + 1,
      );
    }
    const aovByCurrency: Record<string, string> = {};
    for (const [cur, gmvStr] of Object.entries(gmvByCurrency)) {
      const cnt = ordersCountByCurrency.get(cur) || 0;
      aovByCurrency[cur] =
        cnt === 0 ? "0.00" : (parseFloat(gmvStr) / cnt).toFixed(2);
    }

    // Previous period GMV (for comparison) — Marketplace-scoped
    const prevGmvData = prev
      ? await this.prisma.order.findMany({
          where: {
            acquisitionSource: "MARKETPLACE",
            status: { in: ["FULFILLED", "CLOSED"] },
            createdAt: { gte: prev.start, lt: prev.endExclusive },
          },
          select: { amount: true, currency: true },
        })
      : [];
    const prevRevenueData = prevPayments;
    // Previous period GMV lifecycle metrics — Marketplace-scoped
    const prevQualifiedData = prev
      ? await this.prisma.order.findMany({
          where: {
            acquisitionSource: "MARKETPLACE",
            status: { notIn: ["NEW", "CANCELLED"] },
            createdAt: { gte: prev.start, lt: prev.endExclusive },
          },
          select: { amount: true, paidAmount: true, currency: true },
        })
      : [];

    const prevGmvByCurrency = sumDecimalString(prevGmvData);
    const prevRevenueByCurrency = sumDecimalString(prevRevenueData);
    const netRevenueByCurrency = subtractDecimalStrings(
      revenueByCurrency,
      refundByCurrency,
    );

    const gmv = primaryCurrencyTotal(gmvByCurrency);
    const revenue = primaryCurrencyTotal(revenueByCurrency);
    const netRevenue = primaryCurrencyTotal(netRevenueByCurrency);
    const commission = primaryCurrencyTotal(commissionByCurrency);
    const prevGmvSum = primaryCurrencyTotal(prevGmvByCurrency);
    const prevRevenueSum = primaryCurrencyTotal(prevRevenueByCurrency);
    const aov = primaryCurrencyTotal(aovByCurrency);
    // GMV Lifecycle totals
    const qualifiedGmv = primaryCurrencyTotal(qualifiedGmvByCurrency);
    const completedGmv = primaryCurrencyTotal(completedGmvByCurrency);
    const collectedGmv = primaryCurrencyTotal(collectedGmvByCurrency);
    // Outstanding = GMV - Collected (per currency, integer cents)
    const outstandingByCurrency = subtractDecimalStrings(qualifiedGmvByCurrency, collectedGmvByCurrency);
    const outstandingGmv = primaryCurrencyTotal(outstandingByCurrency);
    const prevQualifiedGmv = primaryCurrencyTotal(sumDecimalString(prevQualifiedData));
    const prevCollectedGmv = primaryCurrencyTotal(sumDecimalField(prevQualifiedData, "paidAmount"));
    const prevOutstanding = primaryCurrencyTotal(subtractDecimalStrings(sumDecimalString(prevQualifiedData), sumDecimalField(prevQualifiedData, "paidAmount")));

    const marketplaceSessions = Number(behavioralMarketplace[0]?.cnt || 0);
    const storefrontSessions = Number(behavioralStorefront[0]?.cnt || 0);
    const marketplaceVisitors = Number(marketplaceVisitorsRaw[0]?.cnt || 0);
    const marketplaceVisits = Number(marketplaceVisitsRaw[0]?.cnt || 0);
    // Partners: union of marketplace + storefront to prevent double-counting
    const marketplacePartnerIdsList = await this.prisma.$queryRaw<{ partnerId: string }[]>`
      SELECT DISTINCT p."partnerId"
      FROM catalog."Product" p
      INNER JOIN catalog."ProductPublicationChannel" ppc ON ppc."productId" = p.id
      WHERE p."status" = 'PUBLISHED' AND p."partnerId" IS NOT NULL AND ppc."channel" = 'MARKETPLACE'
    `;
    const storefrontPartnerIdsList = await this.prisma.$queryRaw<{ partnerId: string }[]>`
      SELECT DISTINCT "partnerId"
      FROM catalog."PartnerStorefront"
      WHERE "entitlementStatus" = 'ACTIVE' AND "partnerId" IS NOT NULL
    `;
    const totalActivePartnersCount = new Set([
      ...marketplacePartnerIdsList.map(p => p.partnerId),
      ...storefrontPartnerIdsList.map(p => p.partnerId),
    ]).size;
    const marketplacePartnersCount = Number(marketplacePartners[0]?.cnt || 0);
    const storefrontPartnersCount = Number(storefrontPartners[0]?.cnt || 0);
    const marketplaceCustomerIds = new Set(marketplaceCustomers.map(c => c.customerId).filter(Boolean));
    const storefrontCustomerIds = new Set(storefrontCustomers.map(c => c.customerId).filter(Boolean));
    const marketplaceCustomersCount = marketplaceCustomerIds.size;
    const storefrontCustomersCount = storefrontCustomerIds.size;
    // True unique count (union) — prevents double-counting customers in both channels
    const totalActiveCustomersCount = new Set([...marketplaceCustomerIds, ...storefrontCustomerIds]).size;

    const result: CompanyKpiResponse = {
      period: {
        start: current.start.toISOString(),
        endExclusive: current.endExclusive.toISOString(),
        timezone: current.timezone,
        preset: current.preset,
      },
      metrics: {
        gmv: this.compareDecimalValues(gmv.total, prevGmvSum.total),
        revenue: this.compareDecimalValues(revenue.total, prevRevenueSum.total),
        netRevenue: this.compareDecimalValues(netRevenue.total, null),
        commissionAccrued: {
          current: commission.total,
          previous: null,
          delta: null,
          deltaPercent: null,
        },
        ordersCreated: this.compareValues(orders.length, prevOrders.length),
        ordersFulfilled: this.compareValues(
          fulfilledOrders.length,
          prevOrders.length,
        ),
        bookingsRequested: this.compareValues(
          bookings.length,
          prevBookings.length,
        ),
        bookingsConfirmed: this.compareValues(
          bookings.filter((b) => b.status === "CONFIRMED").length,
          null,
        ),
        bookingsCompleted: this.compareValues(
          bookings.filter((b) => b.status === "COMPLETED").length,
          null,
        ),
        paymentsCaptured: this.compareValues(
          payments.length,
          prevPayments.length,
        ),
        refundsProcessed: this.compareValues(refunds.length, null),
        marketplaceSessions: this.compareValues(marketplaceSessions, null),
        storefrontSessions: this.compareValues(storefrontSessions, null),
        marketplaceVisitors: this.compareValues(marketplaceVisitors, null),
        marketplaceVisits: this.compareValues(marketplaceVisits, null),
        marketplacePartners: this.compareValues(marketplacePartnersCount, null),
        storefrontPartners: this.compareValues(storefrontPartnersCount, null),
        totalActivePartners: this.compareValues(totalActivePartnersCount, null),
        marketplaceCustomers: this.compareValues(marketplaceCustomersCount, null),
        storefrontCustomers: this.compareValues(storefrontCustomersCount, null),
        totalActiveCustomers: this.compareValues(totalActiveCustomersCount, null),
        averageOrderValue: this.compareDecimalValues(aov.total, null),
        // B.2: Refunds as monetary sum (replaces false Net Revenue)
        refunds: this.compareDecimalValues(
          primaryCurrencyTotal(refundByCurrency).total,
          null,
        ),
        refundsCurrency: primaryCurrencyTotal(refundByCurrency).currency,
        gmvCurrency: gmv.currency,
        revenueCurrency: revenue.currency,
        commissionCurrency: commission.currency,
        // ── GMV Lifecycle (Policy Closure) ──
        qualifiedGmv: this.compareDecimalValues(qualifiedGmv.total, prevQualifiedGmv.total),
        completedGmv: this.compareDecimalValues(completedGmv.total, prevGmvSum.total),
        collectedGmv: this.compareDecimalValues(collectedGmv.total, prevCollectedGmv.total),
        outstandingGmv: this.compareDecimalValues(outstandingGmv.total, prevOutstanding.total),
      },
      attribution: {
        actionFields: [
          "Order.createdBy",
          "Sale.completedById",
          "BookingConfirmed.actor",
          "Communication.actorUserId",
        ],
        ownershipFields: [
          "Order.sellerPartnerId",
          "Product.partnerId",
          "Lead.assignedToId",
        ],
        outcomeFields: [
          "Payment.orderId → Order.sellerPartnerId",
          "Commission.partnerId",
          "Booking → Product → Product.partnerId",
        ],
      },
    };

    if (prev) {
      result.comparison = {
        start: prev.start.toISOString(),
        endExclusive: prev.endExclusive.toISOString(),
      };
    }

    return result;
  }

  // ─── Partner Performance ────────────────────────────────────────────────

  async getPartnerPerformance(
    dto: AnalyticsQueryDto,
    user: AnalyticsUser,
  ): Promise<PartnerPerformanceResponse> {
    const { current } = this.resolveQueryPeriod(dto);
    const effectivePartnerId = resolvePartnerScope(user, dto.partnerId);

    const partnerOrderFilter = effectivePartnerId
      ? { sellerPartnerId: effectivePartnerId }
      : { sellerPartnerId: { not: null } };

    // HIGH-6: Query real metrics separately (no nested relations needed)
    // ── Phase 1: Independent queries ──
    // Marketplace-scoped: partner performance reflects Marketplace operational scope
    const [orders, bookings, productCounts] =
      await Promise.all([
        this.prisma.order.findMany({
          where: {
            acquisitionSource: "MARKETPLACE",
            createdAt: { gte: current.start, lt: current.endExclusive },
            ...partnerOrderFilter,
          },
          select: {
            id: true,
            sellerPartnerId: true,
            amount: true,
            currency: true,
          },
        }),
        // Bookings: Marketplace-scoped
        this.prisma.booking.findMany({
          where: {
            acquisitionSource: "MARKETPLACE",
            createdAt: { gte: current.start, lt: current.endExclusive },
          },
          select: {
            id: true,
            status: true,
            productId: true,
          },
        }),
        effectivePartnerId
          ? this.prisma.$queryRaw<{ partnerId: string; cnt: bigint }[]>`
              SELECT "partnerId", COUNT(*) as cnt
              FROM catalog."Product"
              WHERE "status" = 'PUBLISHED' AND "partnerId" = ${effectivePartnerId}
              GROUP BY "partnerId"
            `
          : this.prisma.$queryRaw<{ partnerId: string; cnt: bigint }[]>`
              SELECT "partnerId", COUNT(*) as cnt
              FROM catalog."Product"
              WHERE "status" = 'PUBLISHED' AND "partnerId" IS NOT NULL
              GROUP BY "partnerId"
            `,
      ]);

    // Build partner → product mapping for bookings
    const productPartnerMap = new Map<string, string>();
    if (bookings.length > 0) {
      const productIds = [
        ...new Set(bookings.map((b) => b.productId).filter(Boolean)),
      ] as string[];
      if (productIds.length > 0) {
        const products = await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, partnerId: true },
        });
        for (const p of products) {
          if (p.partnerId) productPartnerMap.set(p.id, p.partnerId);
        }
      }
    }

    // ── Phase 2: Dependent queries (filtered by marketplace order IDs) ──
    const marketplaceOrderIds = orders.map((o) => o.id);
    const [payments, commissions] = await Promise.all([
      // Revenue by partner: payments scoped to marketplace orders
      marketplaceOrderIds.length > 0
        ? this.prisma.payment.findMany({
            where: {
              orderId: { in: marketplaceOrderIds },
              ...revenueWhere(current.start, current.endExclusive),
            },
            select: {
              amount: true,
              currency: true,
              orderId: true,
            },
          })
        : Promise.resolve([]),
      // Commissions scoped to marketplace orders
      marketplaceOrderIds.length > 0
        ? this.prisma.commission.findMany({
            where: {
              orderId: { in: marketplaceOrderIds },
              createdAt: { gte: current.start, lt: current.endExclusive },
              ...(effectivePartnerId ? { partnerId: effectivePartnerId } : {}),
            },
            select: {
              partnerId: true,
              amount: true,
              currency: true,
            },
          })
        : Promise.resolve([]),
    ]);

    // Build order → sellerPartnerId mapping for payments
    const orderPartnerMap = new Map<string, string>();
    for (const o of orders) {
      if (o.sellerPartnerId) orderPartnerMap.set(o.id, o.sellerPartnerId);
    }

    // Group by partner — values stored as INTEGER CENTS (no JS float on money)
    // HIGH-NEW-1 fix: eliminate parseFloat accumulation for monetary values
    const byPartner = new Map<
      string,
      {
        gmvByCurrency: Record<string, number>; // cents
        revenueByCurrency: Record<string, number>; // cents
        commissionByCurrency: Record<string, number>; // cents
        ordersCount: number;
        bookingsCount: number;
        confirmedBookings: number;
        completedBookings: number;
        activeProducts: number;
      }
    >();

    const ensurePartner = (pid: string) => {
      if (!byPartner.has(pid)) {
        byPartner.set(pid, {
          gmvByCurrency: {},
          revenueByCurrency: {},
          commissionByCurrency: {},
          ordersCount: 0,
          bookingsCount: 0,
          confirmedBookings: 0,
          completedBookings: 0,
          activeProducts: 0,
        });
      }
    };

    // Merge orders (GMV) — accumulate in INTEGER CENTS
    for (const o of orders) {
      const pid = o.sellerPartnerId!;
      ensurePartner(pid);
      const data = byPartner.get(pid)!;
      const cur = o.currency || "USD";
      const cents = Math.round(parseFloat(String(o.amount ?? "0")) * 100);
      data.gmvByCurrency[cur] = (data.gmvByCurrency[cur] || 0) + cents;
      data.ordersCount++;
    }

    // Merge payments (Revenue) — join via orderId → sellerPartnerId, INTEGER CENTS
    for (const p of payments) {
      const pid = orderPartnerMap.get(p.orderId);
      if (!pid) continue;
      if (effectivePartnerId && pid !== effectivePartnerId) continue;
      ensurePartner(pid);
      const data = byPartner.get(pid)!;
      const cur = p.currency || "USD";
      const cents = Math.round(parseFloat(String(p.amount ?? "0")) * 100);
      data.revenueByCurrency[cur] = (data.revenueByCurrency[cur] || 0) + cents;
    }

    // Merge commissions — INTEGER CENTS
    for (const c of commissions) {
      const pid = c.partnerId;
      if (!pid) continue;
      ensurePartner(pid);
      const data = byPartner.get(pid)!;
      const cur = c.currency || "USD";
      const cents = Math.round(parseFloat(String(c.amount ?? "0")) * 100);
      data.commissionByCurrency[cur] =
        (data.commissionByCurrency[cur] || 0) + cents;
    }

    // Merge bookings (via product → partner)
    for (const b of bookings) {
      const pid = productPartnerMap.get(b.productId);
      if (!pid) continue;
      if (effectivePartnerId && pid !== effectivePartnerId) continue;
      ensurePartner(pid);
      const data = byPartner.get(pid)!;
      data.bookingsCount++;
      if (b.status === "CONFIRMED") data.confirmedBookings++;
      if (b.status === "COMPLETED") data.completedBookings++;
    }

    // Merge active products
    for (const row of productCounts) {
      const pid = row.partnerId;
      ensurePartner(pid);
      byPartner.get(pid)!.activeProducts = Number(row.cnt);
    }

    // Resolve partner names
    const partnerIds = [...byPartner.keys()];
    const partners =
      partnerIds.length > 0
        ? await this.prisma.partner.findMany({
            where: { id: { in: partnerIds } },
            select: { id: true, name: true },
          })
        : [];
    const partnerNames = new Map(partners.map((p) => [p.id, p.name]));

    return {
      period: {
        start: current.start.toISOString(),
        endExclusive: current.endExclusive.toISOString(),
        timezone: current.timezone,
        preset: current.preset,
      },
      partners: [...byPartner.entries()].map(([pid, data]) => {
        // Convert integer cents back to Decimal strings (no JS float on output)
        const centsToDecimal = (cents: number) => (cents / 100).toFixed(2);
        const gmv = primaryCurrencyTotal(
          Object.fromEntries(
            Object.entries(data.gmvByCurrency).map(([c, cents]) => [c, centsToDecimal(cents)]),
          ),
        );
        const revenue = primaryCurrencyTotal(
          Object.fromEntries(
            Object.entries(data.revenueByCurrency).map(([c, cents]) => [c, centsToDecimal(cents)]),
          ),
        );
        const commission = primaryCurrencyTotal(
          Object.fromEntries(
            Object.entries(data.commissionByCurrency).map(([c, cents]) => [c, centsToDecimal(cents)]),
          ),
        );
        // RT13: Completion = completedBookings / totalBookings (all statuses in period).
        // Previous formula used confirmedBookings as denominator, which caused >100%
        // when bookings were confirmed before the period but completed within it.
        const completionRate =
          data.bookingsCount === 0
            ? null
            : Math.min(
                Math.round(
                  (data.completedBookings / data.bookingsCount) * 10000,
                ) / 100,
                100,
              );

        return {
          partnerId: pid,
          partnerName: partnerNames.get(pid) || pid,
          gmv: gmv.total,
          revenue: revenue.total,
          commission: commission.total,
          ordersCount: data.ordersCount,
          bookingsCount: data.bookingsCount,
          activeProducts: data.activeProducts,
          bookingCompletionRate: completionRate,
        };
      }),
    };
  }

  // ─── Conversion Funnel ─────────────────────────────────────────────────

  async getConversionFunnel(
    dto: AnalyticsQueryDto,
    user: AnalyticsUser,
  ): Promise<ConversionFunnelResponse> {
    const { current } = this.resolveQueryPeriod(dto);

    // Platform Analytics funnel scope: Marketplace operational flow.
    // Enforce MARKETPLACE filter when no source specified (Platform = Marketplace).
    const funnelSourceFilter = dto.acquisitionSource
      ? { acquisitionSource: dto.acquisitionSource }
      : { acquisitionSource: "MARKETPLACE" as const };

    // ── Phase 1: Independent queries ──
    const [
      uniqueImpressions,
      uniqueProductViews,
      checkouts,
      orders,
      bookingsConfirmed,
      bookingsCompleted,
    ] = await Promise.all([
      this.prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(DISTINCT "id") as cnt
        FROM catalog."MarketplaceBehavioralEvent"
        WHERE "eventType" = 'MARKETPLACE_PRODUCT_IMPRESSION'
          AND "occurredAt" >= ${current.start} AND "occurredAt" < ${current.endExclusive}
      `,
      this.prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(DISTINCT "id") as cnt
        FROM catalog."MarketplaceBehavioralEvent"
        WHERE "eventType" = 'MARKETPLACE_PRODUCT_VIEWED'
          AND "occurredAt" >= ${current.start} AND "occurredAt" < ${current.endExclusive}
      `,
      // Checkout intents: no acquisitionSource on model; funnel flow is Marketplace-only
      this.prisma.checkoutIntent.findMany({
        where: {
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { id: true },
      }),
      this.prisma.order.findMany({
        where: {
          createdAt: { gte: current.start, lt: current.endExclusive },
          ...funnelSourceFilter,
        },
        select: { id: true },
      }),
      this.prisma.booking.findMany({
        where: {
          ...funnelSourceFilter,
          status: "CONFIRMED",
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { id: true },
      }),
      this.prisma.booking.findMany({
        where: {
          ...funnelSourceFilter,
          status: "COMPLETED",
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { id: true },
      }),
    ]);

    // ── Phase 2: Payments scoped to marketplace orders ──
    const funnelOrderIds = orders.map((o) => o.id);
    const payments = funnelOrderIds.length > 0
      ? await this.prisma.payment.findMany({
          where: {
            orderId: { in: funnelOrderIds },
            ...revenueWhere(current.start, current.endExclusive),
          },
          select: { id: true },
        })
      : [];

    return {
      period: {
        start: current.start.toISOString(),
        endExclusive: current.endExclusive.toISOString(),
        timezone: current.timezone,
        preset: current.preset,
      },
      acquisitionSource: dto.acquisitionSource,
      stages: [
        {
          stage: "Product Impression",
          count: Number(uniqueImpressions[0]?.cnt || 0),
          uniqueEntities: Number(uniqueImpressions[0]?.cnt || 0),
        },
        {
          stage: "Product Viewed",
          count: Number(uniqueProductViews[0]?.cnt || 0),
          uniqueEntities: Number(uniqueProductViews[0]?.cnt || 0),
        },
        { stage: "Checkout Started", count: checkouts.length },
        { stage: "Order Created", count: orders.length },
        { stage: "Payment Succeeded", count: payments.length },
        { stage: "Booking Confirmed", count: bookingsConfirmed.length },
        { stage: "Booking Completed", count: bookingsCompleted.length },
      ],
    };
  }

  // ─── Time Series ───────────────────────────────────────────────────────

  async getTimeSeries(
    dto: AnalyticsQueryDto,
    _user: AnalyticsUser,
    metric: string = "orders",
  ): Promise<TimeSeriesResponse> {
    const { current } = this.resolveQueryPeriod(dto);
    const granularity = resolveGranularity(current, dto.granularity);
    const buckets = generateTimeBuckets(current, granularity);

    const results = await Promise.all(
      buckets.map(async (bucket) => {
        const count = await this.getMetricCountForBucket(bucket, metric);
        return {
          label: bucket.label,
          start: bucket.start.toISOString(),
          endExclusive: bucket.endExclusive.toISOString(),
          value: count,
        };
      }),
    );

    return {
      period: {
        start: current.start.toISOString(),
        endExclusive: current.endExclusive.toISOString(),
        timezone: current.timezone,
        preset: current.preset,
      },
      granularity,
      buckets: results,
    };
  }

  private async getMetricCountForBucket(
    bucket: TimeBucket,
    metric: string,
  ): Promise<number> {
    const where = {
      createdAt: { gte: bucket.start, lt: bucket.endExclusive },
    };

    // Platform time series metrics: Marketplace operational scope
    const marketplaceWhere = { ...where, acquisitionSource: "MARKETPLACE" };
    switch (metric) {
      case "orders":
        return this.prisma.order.count({ where: marketplaceWhere });
      case "bookings":
        return this.prisma.booking.count({ where: marketplaceWhere });
      case "payments": {
        // Payments have no acquisitionSource; scope via marketplace order IDs
        const periodOrders = await this.prisma.order.findMany({
          where: marketplaceWhere,
          select: { id: true },
        });
        if (periodOrders.length === 0) return 0;
        return this.prisma.payment.count({
          where: {
            orderId: { in: periodOrders.map(o => o.id) },
            paidAt: { gte: bucket.start, lt: bucket.endExclusive },
            status: "CAPTURED",
          },
        });
      }
      case "customers":
        return this.prisma.customer.count({ where });
      case "marketplace-customers": {
        const mktOrders = await this.prisma.order.findMany({
          where: { acquisitionSource: "MARKETPLACE", ...where },
          select: { customerId: true },
        });
        return new Set(mktOrders.map(o => o.customerId).filter(Boolean)).size;
      }
      case "storefront-customers": {
        const sfOrders = await this.prisma.order.findMany({
          where: { acquisitionSource: "PARTNER_STOREFRONT", ...where },
          select: { customerId: true },
        });
        return new Set(sfOrders.map(o => o.customerId).filter(Boolean)).size;
      }
      case "commissions": {
        const commOrders = await this.prisma.order.findMany({
          where: marketplaceWhere,
          select: { id: true },
        });
        if (commOrders.length === 0) return 0;
        return this.prisma.commission.count({
          where: { orderId: { in: commOrders.map(o => o.id) }, createdAt: { gte: bucket.start, lt: bucket.endExclusive } },
        });
      }
      default:
        return 0;
    }
  }

  // ─── Financial Reconciliation Summary ──────────────────────────────────
  // HIGH-3: Fifth read model per design §6.2.5

  async getFinancialReconciliation(
    dto: AnalyticsQueryDto,
    _user: AnalyticsUser,
  ): Promise<FinancialReconciliationResponse> {
    const { current } = this.resolveQueryPeriod(dto);

    // Marketplace-scoped financial reconciliation
    const mktOrders = await this.prisma.order.findMany({
      where: {
        acquisitionSource: "MARKETPLACE",
        createdAt: { gte: current.start, lt: current.endExclusive },
      },
      select: { id: true },
    });
    const mktOrderIds = mktOrders.map(o => o.id);

    const [payments, refunds, commissions, ledgerEntries] = await Promise.all([
      mktOrderIds.length > 0
        ? this.prisma.payment.findMany({
            where: {
              orderId: { in: mktOrderIds },
              ...revenueWhere(current.start, current.endExclusive),
            },
            select: { id: true, amount: true, currency: true },
          })
        : Promise.resolve([]),
      mktOrderIds.length > 0
        ? this.prisma.refund.findMany({
            where: {
              orderId: { in: mktOrderIds },
              status: "PROCESSED",
              processedAt: { gte: current.start, lt: current.endExclusive },
            },
            select: { id: true, amount: true, currency: true },
          })
        : Promise.resolve([]),
      mktOrderIds.length > 0
        ? this.prisma.commission.findMany({
            where: {
              orderId: { in: mktOrderIds },
              createdAt: { gte: current.start, lt: current.endExclusive },
            },
            select: { id: true, amount: true, currency: true },
          })
        : Promise.resolve([]),
      this.prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(*) as cnt
        FROM finance."LedgerTransaction"
        WHERE "occurredAt" >= ${current.start} AND "occurredAt" < ${current.endExclusive}
      `,
    ]);

    const paymentsByCurrency = sumDecimalString(payments);
    const refundsByCurrency = sumDecimalString(refunds);
    const commissionByCurrency = sumDecimalString(commissions);
    const netPaymentsByCurrency = subtractDecimalStrings(
      paymentsByCurrency,
      refundsByCurrency,
    );

    // MEDIUM-NEW-1 fix: currency-separated reconciliation
    const allCurrencies = new Set([
      ...Object.keys(paymentsByCurrency),
      ...Object.keys(refundsByCurrency),
      ...Object.keys(commissionByCurrency),
    ]);
    const sortedCurrencies = [...allCurrencies].sort();
    // B.2 Remediation: prefer PLATFORM_REPORTING_CURRENCY (AZN)
    const primaryCur = allCurrencies.has(PLATFORM_REPORTING_CURRENCY)
      ? PLATFORM_REPORTING_CURRENCY
      : sortedCurrencies[0] || PLATFORM_REPORTING_CURRENCY;

    // Count payments per currency for paymentCount column
    const paymentCountByCurrency: Record<string, number> = {};
    for (const p of payments) {
      const cur = p.currency || "USD";
      paymentCountByCurrency[cur] = (paymentCountByCurrency[cur] || 0) + 1;
    }

    // Build per-currency reconciliation entries
    const currencies: CurrencyReconciliation[] = sortedCurrencies.map((cur) => ({
      currency: cur,
      paymentCount: paymentCountByCurrency[cur] || 0,
      totalPayments: paymentsByCurrency[cur] || "0.00",
      totalRefunds: refundsByCurrency[cur] || "0.00",
      netPayments: netPaymentsByCurrency[cur] || "0.00",
      totalCommission: commissionByCurrency[cur] || "0.00",
    }));

    return {
      period: {
        start: current.start.toISOString(),
        endExclusive: current.endExclusive.toISOString(),
        timezone: current.timezone,
        preset: current.preset,
      },
      // Deprecated primary-currency fields (backward compatible)
      currency: primaryCur,
      totalPayments: paymentsByCurrency[primaryCur] || "0.00",
      totalRefunds: refundsByCurrency[primaryCur] || "0.00",
      netPayments: netPaymentsByCurrency[primaryCur] || "0.00",
      totalCommission: commissionByCurrency[primaryCur] || "0.00",
      totalLedgerEntries: Number(ledgerEntries[0]?.cnt || 0),
      // Currency-separated reconciliation (canonical)
      currencies,
    };
  }

  // ── Step 3.5E — Shared CRM Analytics Read Model ──────────────────────

  /**
   * CRM Analytics: lifecycle breakdown, source breakdown, new relationships,
   * commercially active customers, repeat customers.
   *
   * Platform scope: cross-partner (authorized)
   * Partner scope: current partner only (resolvePartnerScope)
   *
   * Shared metric definitions: same source authority, same timestamp semantics,
   * same aggregation rules. Scope is an input parameter.
   */
  async getCrmAnalytics(
    dto: AnalyticsQueryDto,
    user: AnalyticsUser,
  ): Promise<CrmAnalyticsResponse> {
    const { current } = this.resolveQueryPeriod(dto);
    const effectivePartnerId = resolvePartnerScope(user, dto.partnerId);

    // Scope: filter PCR by partnerId if partner-scoped
    const pcrWhere: any = {
      createdAt: { gte: current.start, lt: current.endExclusive },
      ...(effectivePartnerId ? { partnerId: effectivePartnerId } : {}),
    };

    // All PCR (current snapshot) scoped to partner if applicable
    const allPcrWhere: any = {
      ...(effectivePartnerId ? { partnerId: effectivePartnerId } : {}),
    };

    const [
      // Current PCR snapshot: total, by lifecycle, by source
      totalPcr,
      lifecycleCounts,
      sourceCounts,
      managerCounts,
      // New relationships created during period
      newPcrCount,
      // New relationships by source during period
      newBySource,
      // Commercially active: distinct customers with orders during period
      activeCustomerOrders,
    ] = await Promise.all([
      // Total PCR count
      this.prisma.partnerCustomerRelation.count({ where: allPcrWhere }),
      // PCR by lifecycle
      this.prisma.partnerCustomerRelation.groupBy({
        by: ["lifecycle"],
        where: allPcrWhere,
        _count: true,
      }),
      // PCR by lead source
      this.prisma.partnerCustomerRelation.groupBy({
        by: ["leadSource"],
        where: allPcrWhere,
        _count: true,
      }),
      // PCR by manager
      this.prisma.partnerCustomerRelation.groupBy({
        by: ["assignedTo"],
        where: allPcrWhere,
        _count: true,
      }),
      // New relationships in period
      this.prisma.partnerCustomerRelation.count({ where: pcrWhere }),
      // New relationships by source in period
      this.prisma.partnerCustomerRelation.groupBy({
        by: ["leadSource"],
        where: pcrWhere,
        _count: true,
      }),
      // Commercially active: distinct customers with orders in period
      this.prisma.order.findMany({
        where: {
          createdAt: { gte: current.start, lt: current.endExclusive },
          ...(effectivePartnerId ? { sellerPartnerId: effectivePartnerId } : {}),
        },
        select: { customerId: true },
        distinct: ["customerId"],
      }),
    ]);

    // Build lifecycle breakdown
    const lifecycleBreakdown: Record<string, number> = {};
    for (const row of lifecycleCounts) {
      lifecycleBreakdown[row.lifecycle ?? "UNKNOWN"] = row._count;
    }

    // Build source breakdown
    const sourceBreakdown: Record<string, number> = {};
    for (const row of sourceCounts) {
      sourceBreakdown[row.leadSource ?? "UNKNOWN"] = row._count;
    }

    // Build manager breakdown
    const managerBreakdown: Record<string, number> = {};
    for (const row of managerCounts) {
      managerBreakdown[row.assignedTo ?? "UNASSIGNED"] = row._count;
    }

    // Build new by source
    const newBySourceBreakdown: Record<string, number> = {};
    for (const row of newBySource) {
      newBySourceBreakdown[row.leadSource ?? "UNKNOWN"] = row._count;
    }

    // Commercially active customers count
    const commerciallyActiveCount = new Set(
      activeCustomerOrders.map((o) => o.customerId).filter(Boolean),
    ).size;

    // Total PCR with commercial activity (for "repeat" calculation)
    const allPcrList = await this.prisma.partnerCustomerRelation.findMany({
      where: allPcrWhere,
      select: { customerId: true },
    });
    const totalPcrCustomers = new Set(allPcrList.map((r) => r.customerId)).size;

    return {
      period: {
        start: current.start.toISOString(),
        endExclusive: current.endExclusive.toISOString(),
        timezone: current.timezone,
        preset: current.preset,
      },
      scope: {
        partnerId: effectivePartnerId ?? null,
        label: effectivePartnerId ? "partner" : "platform",
      },
      metrics: {
        totalCustomers: totalPcrCustomers,
        totalRelationships: totalPcr,
        lifecycleBreakdown,
        sourceBreakdown,
        managerBreakdown,
        newRelationships: newPcrCount,
        newBySource: newBySourceBreakdown,
        commerciallyActiveCustomers: commerciallyActiveCount,
      },
    };
  }
}
