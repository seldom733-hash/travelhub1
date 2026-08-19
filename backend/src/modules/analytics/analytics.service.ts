/**
 * Step 3.3 Analytics Foundation — Analytics Service
 *
 * Orchestrates period resolution, metric computation, and read-model queries.
 * Reads from canonical Prisma schema — no separate analytics warehouse.
 *
 * Design authority: docs/architecture/analytics-foundation-3.3.md
 */

import { Injectable } from "@nestjs/common";
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
    activePartners: ComparisonValue<number>;
    newCustomers: ComparisonValue<number>;
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

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve period + optional comparison from query DTO.
   */
  private resolveQueryPeriod(dto: AnalyticsQueryDto): ComparisonPeriods {
    const period = resolvePeriod({
      preset: dto.preset,
      startDate: dto.startDate,
      endDate: dto.endDate,
      timezone: dto.timezone,
    });
    const comparison =
      dto.comparison !== false ? resolveComparison(period) : undefined;
    return {
      current: period,
      comparison: comparison || period, // fallback = same period (no comparison)
    };
  }

  /**
   * Compute comparison value from current and previous numbers.
   */
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

  /**
   * Sum a Decimal field across a set of records.
   */
  private sumDecimal(
    records: Array<{ amount: unknown; currency: string }>,
  ): { total: string; currency: string } {
    if (records.length === 0) return { total: "0.00", currency: "USD" };
    // Group by currency
    const byCurrency = new Map<string, number>();
    for (const r of records) {
      const cur = r.currency || "USD";
      const amt = typeof r.amount === "object" ? Number(r.amount) : (r.amount as number);
      byCurrency.set(cur, (byCurrency.get(cur) || 0) + amt);
    }
    // Return first currency (or combined if single currency)
    if (byCurrency.size === 1) {
      const [cur, total] = [...byCurrency.entries()][0];
      return { total: total.toFixed(2), currency: cur };
    }
    // Multi-currency: return first with note
    const [cur, total] = [...byCurrency.entries()][0];
    return { total: total.toFixed(2), currency: cur };
  }

  // ─── Company KPI Summary ────────────────────────────────────────────────

  async getCompanyKpi(dto: AnalyticsQueryDto): Promise<CompanyKpiResponse> {
    const { current, comparison } = this.resolveQueryPeriod(dto);
    const prev = dto.comparison !== false ? comparison : undefined;

    // Parallel queries for current period
    const [
      orders,
      prevOrders,
      bookings,
      prevBookings,
      payments,
      prevPayments,
      refunds,
      commissions,
      prevCommissions,
      customers,
      behavioralMarketplace,
      behavioralStorefront,
      partners,
    ] = await Promise.all([
      // Orders created in period
      this.prisma.order.findMany({
        where: {
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { id: true, amount: true, currency: true, status: true },
      }),
      // Previous orders
      prev
        ? this.prisma.order.findMany({
            where: {
              createdAt: { gte: prev.start, lt: prev.endExclusive },
            },
            select: { id: true },
          })
        : Promise.resolve([]),
      // Bookings in period
      this.prisma.booking.findMany({
        where: {
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { id: true, status: true },
      }),
      // Previous bookings
      prev
        ? this.prisma.booking.findMany({
            where: {
              createdAt: { gte: prev.start, lt: prev.endExclusive },
            },
            select: { id: true },
          })
        : Promise.resolve([]),
      // Payments captured in period
      this.prisma.payment.findMany({
        where: {
          status: "CAPTURED",
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { id: true, amount: true, currency: true },
      }),
      // Previous payments
      prev
        ? this.prisma.payment.findMany({
            where: {
              status: "CAPTURED",
              createdAt: { gte: prev.start, lt: prev.endExclusive },
            },
            select: { id: true },
          })
        : Promise.resolve([]),
      // Refunds processed in period
      this.prisma.refund.findMany({
        where: {
          status: "PROCESSED",
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { id: true, amount: true, currency: true },
      }),
      // Commission accrued in period
      this.prisma.commission.findMany({
        where: {
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { id: true, amount: true, currency: true },
      }),
      // Previous commissions
      prev
        ? this.prisma.commission.findMany({
            where: {
              createdAt: { gte: prev.start, lt: prev.endExclusive },
            },
            select: { id: true },
          })
        : Promise.resolve([]),
      // New customers
      this.prisma.customer.findMany({
        where: {
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { id: true },
      }),
      // Marketplace sessions (distinct sessionId)
      this.prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(DISTINCT "sessionId") as cnt
        FROM catalog."MarketplaceBehavioralEvent"
        WHERE "occurredAt" >= ${current.start} AND "occurredAt" < ${current.endExclusive}
      `,
      // Storefront sessions
      this.prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(DISTINCT "sessionId") as cnt
        FROM catalog."StorefrontBehavioralEvent"
        WHERE "occurredAt" >= ${current.start} AND "occurredAt" < ${current.endExclusive}
      `,
      // Active partners (distinct partnerId from published products)
      this.prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(DISTINCT "partnerId") as cnt
        FROM catalog."Product"
        WHERE "status" = 'PUBLISHED' AND "partnerId" IS NOT NULL
      `,
    ]);

    // Compute metrics
    const fulfilledOrders = orders.filter(
      (o) => o.status === "FULFILLED" || o.status === "CLOSED",
    );
    const gmv = this.sumDecimal(fulfilledOrders);
    const revenue = this.sumDecimal(payments);
    const refundTotal = this.sumDecimal(refunds);
    const netRevenue = (
      parseFloat(revenue.total) - parseFloat(refundTotal.total)
    ).toFixed(2);
    const commission = this.sumDecimal(commissions);

    const prevGmv = prev
      ? this.prisma.order.findMany({
          where: {
            status: { in: ["FULFILLED", "CLOSED"] },
            createdAt: { gte: prev.start, lt: prev.endExclusive },
          },
          select: { amount: true, currency: true },
        })
      : Promise.resolve([]);

    const prevRevenue = prev
      ? this.prisma.payment.findMany({
          where: {
            status: "CAPTURED",
            createdAt: { gte: prev.start, lt: prev.endExclusive },
          },
          select: { amount: true, currency: true },
        })
      : Promise.resolve([]);

    const [prevGmvData, prevRevenueData] = await Promise.all([
      prevGmv,
      prevRevenue,
    ]);

    const prevGmvSum = this.sumDecimal(prevGmvData);
    const prevRevenueSum = this.sumDecimal(prevRevenueData);

    const marketplaceSessions =
      Number(behavioralMarketplace[0]?.cnt || 0);
    const storefrontSessions =
      Number(behavioralStorefront[0]?.cnt || 0);
    const activePartnersCount = Number(partners[0]?.cnt || 0);

    const result: CompanyKpiResponse = {
      period: {
        start: current.start.toISOString(),
        endExclusive: current.endExclusive.toISOString(),
        timezone: current.timezone,
        preset: current.preset,
      },
      metrics: {
        gmv: this.compareStringValues(gmv.total, prevGmvSum.total),
        revenue: this.compareStringValues(revenue.total, prevRevenueSum.total),
        netRevenue: this.compareStringValues(netRevenue, null),
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
        paymentsCaptured: this.compareValues(payments.length, prevPayments.length),
        refundsProcessed: this.compareValues(refunds.length, null),
        marketplaceSessions: this.compareValues(marketplaceSessions, null),
        storefrontSessions: this.compareValues(storefrontSessions, null),
        activePartners: this.compareValues(activePartnersCount, null),
        newCustomers: this.compareValues(customers.length, null),
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

  private compareStringValues(
    current: string,
    previous: string | null,
  ): ComparisonValue<string> {
    if (previous === null) {
      return { current, previous: null, delta: null, deltaPercent: null };
    }
    const c = parseFloat(current);
    const p = parseFloat(previous);
    const delta = (c - p).toFixed(2);
    const deltaPercent =
      p === 0 ? null : Math.round(((c - p) / p) * 10000) / 100;
    return { current, previous, delta, deltaPercent };
  }

  // ─── Partner Performance ────────────────────────────────────────────────

  async getPartnerPerformance(
    dto: AnalyticsQueryDto,
  ): Promise<PartnerPerformanceResponse> {
    const { current } = this.resolveQueryPeriod(dto);

    const partnerFilter = dto.partnerId
      ? { sellerPartnerId: dto.partnerId }
      : {};

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: current.start, lt: current.endExclusive },
        sellerPartnerId: { not: null },
        ...partnerFilter,
      },
      select: {
        sellerPartnerId: true,
        amount: true,
        currency: true,
      },
    });

    // Group by partner
    const byPartner = new Map<
      string,
      { gmv: number; ordersCount: number; currency: string }
    >();
    for (const o of orders) {
      const pid = o.sellerPartnerId!;
      const existing = byPartner.get(pid) || {
        gmv: 0,
        ordersCount: 0,
        currency: o.currency,
      };
      existing.gmv += typeof o.amount === "object" ? Number(o.amount) : (o.amount as number);
      existing.ordersCount++;
      byPartner.set(pid, existing);
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
      partners: [...byPartner.entries()].map(([pid, data]) => ({
        partnerId: pid,
        partnerName: partnerNames.get(pid) || pid,
        gmv: data.gmv.toFixed(2),
        revenue: "0.00",
        commission: "0.00",
        ordersCount: data.ordersCount,
        bookingsCount: 0,
        activeProducts: 0,
      })),
    };
  }

  // ─── Conversion Funnel ─────────────────────────────────────────────────

  async getConversionFunnel(
    dto: AnalyticsQueryDto,
  ): Promise<ConversionFunnelResponse> {
    const { current } = this.resolveQueryPeriod(dto);

    const sourceFilter = dto.acquisitionSource
      ? { acquisitionSource: dto.acquisitionSource }
      : {};

    // Count entities at each funnel stage
    const [
      impressions,
      productViews,
      checkouts,
      orders,
      payments,
      bookingsConfirmed,
      bookingsCompleted,
    ] = await Promise.all([
      // Marketplace product impressions
      this.prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(*) as cnt
        FROM catalog."MarketplaceBehavioralEvent"
        WHERE "eventType" = 'MARKETPLACE_PRODUCT_IMPRESSION'
          AND "occurredAt" >= ${current.start} AND "occurredAt" < ${current.endExclusive}
      `,
      // Marketplace product views
      this.prisma.$queryRaw<{ cnt: bigint }[]>`
        SELECT COUNT(*) as cnt
        FROM catalog."MarketplaceBehavioralEvent"
        WHERE "eventType" = 'MARKETPLACE_PRODUCT_VIEWED'
          AND "occurredAt" >= ${current.start} AND "occurredAt" < ${current.endExclusive}
      `,
      // Checkout intents
      this.prisma.checkoutIntent.findMany({
        where: {
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { id: true },
      }),
      // Orders
      this.prisma.order.findMany({
        where: {
          createdAt: { gte: current.start, lt: current.endExclusive },
          ...sourceFilter,
        },
        select: { id: true },
      }),
      // Payments captured
      this.prisma.payment.findMany({
        where: {
          status: "CAPTURED",
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { id: true },
      }),
      // Bookings confirmed
      this.prisma.booking.findMany({
        where: {
          status: "CONFIRMED",
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { id: true },
      }),
      // Bookings completed
      this.prisma.booking.findMany({
        where: {
          status: "COMPLETED",
          createdAt: { gte: current.start, lt: current.endExclusive },
        },
        select: { id: true },
      }),
    ]);

    return {
      period: {
        start: current.start.toISOString(),
        endExclusive: current.endExclusive.toISOString(),
        timezone: current.timezone,
        preset: current.preset,
      },
      acquisitionSource: dto.acquisitionSource,
      stages: [
        { stage: "Product Impression", count: Number(impressions[0]?.cnt || 0) },
        { stage: "Product Viewed", count: Number(productViews[0]?.cnt || 0) },
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
    metric: string = "orders",
  ): Promise<TimeSeriesResponse> {
    const { current } = this.resolveQueryPeriod(dto);
    const granularity = resolveGranularity(current, dto.granularity);
    const buckets = generateTimeBuckets(current, granularity);

    // For each bucket, count the metric
    const results = await Promise.all(
      buckets.map(async (bucket) => {
        const count = await this.getMetricCountForBucket(
          bucket,
          metric,
          dto,
        );
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
    dto: AnalyticsQueryDto,
  ): Promise<number> {
    const where = {
      createdAt: { gte: bucket.start, lt: bucket.endExclusive },
    };

    switch (metric) {
      case "orders":
        return this.prisma.order.count({ where });
      case "bookings":
        return this.prisma.booking.count({ where });
      case "payments":
        return this.prisma.payment.count({
          where: { ...where, status: "CAPTURED" },
        });
      case "customers":
        return this.prisma.customer.count({ where });
      case "commissions":
        return this.prisma.commission.count({ where });
      default:
        return 0;
    }
  }
}
