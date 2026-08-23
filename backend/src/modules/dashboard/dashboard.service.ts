/**
 * Step 3.1 Dashboard / Command Center Backend — Orchestration Service
 *
 * Aggregates Step 3.3 Analytics Foundation read models into a single
 * Command Center response. This is a pure orchestration/consumer layer —
 * it does NOT create parallel analytics logic.
 *
 * V3 Extension: Catalog Health, Channel Health, Needs Attention, AI Decision Feed
 * These sections query the database directly (not through Step 3.3) because they
 * represent Command Center-specific business intelligence views.
 *
 * Design authority: docs/architecture/dashboard-command-center-backend-3.1.md
 * Invariant: COMMAND CENTER = ORCHESTRATION, NOT A SECOND ANALYTICS ENGINE
 */

import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import {
  AnalyticsService,
  type AnalyticsQueryDto,
  type CompanyKpiResponse,
  type ConversionFunnelResponse,
  type FinancialReconciliationResponse,
  type TimeSeriesResponse,
} from "../analytics/analytics.service";
import { AnalyticsGranularity } from "../analytics/analytics-granularity.resolver";
import { resolvePeriod } from "../analytics/analytics-period.resolver";
import { PrismaService } from "../../prisma/prisma.service";

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface DashboardQueryDto {
  preset: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  comparison?: boolean;
}

export interface TrendQueryDto extends DashboardQueryDto {
  metric?: string;
  granularity?: string;
}

// ─── Section Authority (Step 3.2) ──────────────────────────────────────────

export type DashboardSection = "executive" | "operational" | "financial" | "marketplace" | "catalog" | "channels" | "attention" | "insights";

/** Canonical section → permission mapping. Single source of truth. */
export const SECTION_PERMISSION_MAP: Record<DashboardSection, string> = {
  executive: "dashboard.executive.read",
  operational: "dashboard.operational.read",
  financial: "dashboard.financial.read",
  marketplace: "dashboard.marketplace.read",
  catalog: "dashboard.catalog.read",
  channels: "dashboard.channels.read",
  attention: "dashboard.attention.read",
  insights: "dashboard.insights.read",
};

const ALL_SECTIONS: DashboardSection[] = ["executive", "operational", "financial", "marketplace", "catalog", "channels", "attention", "insights"];

/** Metric → section mapping for trends authorization. Only supported metrics. */
export const METRIC_SECTION_MAP: Record<string, DashboardSection> = {
  orders: "executive",
  bookings: "executive",
  payments: "financial",
  customers: "marketplace",
  "marketplace-customers": "marketplace",
  "storefront-customers": "marketplace",
  commissions: "financial",
};

export type TrendMetric = keyof typeof METRIC_SECTION_MAP;
const SUPPORTED_METRICS = Object.keys(METRIC_SECTION_MAP) as TrendMetric[];

// ─── Response Types ─────────────────────────────────────────────────────────

export interface KpiValue {
  current: string | number;
  currency?: string;
  previous: string | number | null;
  delta: string | number | null;
  deltaPercent: number | null;
  drillDown?: { target: string; query?: Record<string, string> };
}

export interface CatalogHealthResponse {
  publishedServices: KpiValue;
  archivedServices: KpiValue;
  servicesWithoutSales: KpiValue;
  highDemandServices: KpiValue;
  lowConversionServices: KpiValue;
  totalCategories: KpiValue;
}

export interface ChannelHealthResponse {
  marketplaceGmv: KpiValue;
  storefrontGmv: KpiValue;
  marketplaceRevenue: KpiValue;
  storefrontRevenue: KpiValue;
  marketplaceOrders: KpiValue;
  storefrontOrders: KpiValue;
  marketplaceConversion: KpiValue;
  storefrontConversion: KpiValue;
}

export interface NeedsAttentionResponse {
  pendingConfirmations: KpiValue;
  failedPayments: KpiValue;
  cancellations: KpiValue;
  pendingRefunds: KpiValue;
  upcomingBookings: KpiValue;
  servicesWithoutSales: KpiValue;
}

export interface AiDecisionFeedResponse {
  risks: Array<{ title: string; detail: string; severity: "high" | "medium" | "low" }>;
  opportunities: Array<{ title: string; detail: string; potential: string }>;
  catalogInsights: Array<{ title: string; detail: string }>;
}

export interface CommandCenterResponse {
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
  availableSections: DashboardSection[];
  availableMetrics: string[];
  sections: {
    executive?: {
      gmv: KpiValue;
      revenue: KpiValue;
      netRevenue: KpiValue;
      ordersCreated: KpiValue;
      bookingsRequested: KpiValue;
      averageOrderValue: KpiValue;
      conversionRate: KpiValue;
    };
    operational?: {
      ordersFulfilled: KpiValue;
      bookingsConfirmed: KpiValue;
      bookingsCompleted: KpiValue;
      paymentsCaptured: KpiValue;
      refundsProcessed: KpiValue;
      funnelConversion: KpiValue;
    };
    financial?: {
      commissionAccrued: KpiValue;
      reconciliationStatus: KpiValue;
      totalPayments: KpiValue;
      netPayments: KpiValue;
    };
    marketplace?: {
      marketplaceSessions: KpiValue;
      storefrontSessions: KpiValue;
      marketplacePartners: KpiValue;
      storefrontPartners: KpiValue;
      marketplaceCustomers: KpiValue;
      storefrontCustomers: KpiValue;
    };
    catalog?: CatalogHealthResponse;
    channels?: ChannelHealthResponse;
    attention?: NeedsAttentionResponse;
    insights?: AiDecisionFeedResponse;
  };
  attribution?: {
    actionFields: string[];
    ownershipFields: string[];
    outcomeFields: string[];
  };
}

export interface TrendResponse {
  period: {
    start: string;
    endExclusive: string;
    timezone: string;
    preset: string;
  };
  granularity: string;
  metric: string;
  buckets: Array<{
    label: string;
    start: string;
    endExclusive: string;
    value: number;
  }>;
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class DashboardService {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * GET /api/v1/dashboard/command-center
   *
   * Orchestrates Step 3.3 read models into a single Command Center response.
   * All period/currency/comparison logic delegated to Step 3.3.
   * Step 3.2: Server-side section filtering by user permissions.
   * V3: Adds catalog health, channel health, needs attention, AI feed.
   */
  async getCommandCenter(
    dto: DashboardQueryDto,
    user: { id: string; role: string; partnerId?: string | null; permissions: string[] },
  ): Promise<CommandCenterResponse> {
    const analyticsDto: AnalyticsQueryDto = {
      preset: dto.preset as any,
      startDate: dto.startDate,
      endDate: dto.endDate,
      timezone: dto.timezone,
      comparison: dto.comparison !== false,
    };

    // Step 3.2: Compute authorized sections and metrics
    const availableSections = this.computeAvailableSections(user.permissions);
    const availableMetrics = this.computeAvailableMetrics(user.permissions);
    const sectionSet = new Set(availableSections);

    // Parallel calls to Step 3.3 read models — only call authorized sources
    const needsFinancial = sectionSet.has("financial");
    const needsOperational = sectionSet.has("operational");

    const [kpi, funnel, reconciliation] = await Promise.all([
      this.analyticsService.getCompanyKpi(analyticsDto, user as any),
      needsOperational
        ? this.analyticsService.getConversionFunnel(analyticsDto, user as any)
        : null,
      needsFinancial
        ? this.analyticsService.getFinancialReconciliation(analyticsDto, user as any)
        : null,
    ]);

    // V3: Parallel calls for new sections
    const [catalogHealth, channelHealth, needsAttention, aiFeed] = await Promise.all([
      sectionSet.has("catalog") ? this.buildCatalogHealth() : null,
      sectionSet.has("channels") ? this.buildChannelHealth(analyticsDto, user as any) : null,
      sectionSet.has("attention") ? this.buildNeedsAttention() : null,
      sectionSet.has("insights") ? this.buildAiDecisionFeed() : null,
    ]);

    // Build only authorized sections
    const sections: CommandCenterResponse["sections"] = {};
    if (sectionSet.has("executive")) {
      sections.executive = this.buildExecutiveSection(kpi);
    }
    if (sectionSet.has("operational") && funnel) {
      sections.operational = this.buildOperationalSection(kpi, funnel);
    }
    if (sectionSet.has("financial") && reconciliation) {
      sections.financial = this.buildFinancialSection(kpi, reconciliation);
    }
    if (sectionSet.has("marketplace")) {
      sections.marketplace = this.buildMarketplaceSection(kpi);
    }
    if (catalogHealth) sections.catalog = catalogHealth;
    if (channelHealth) sections.channels = channelHealth;
    if (needsAttention) sections.attention = needsAttention;
    if (aiFeed) sections.insights = aiFeed;

    return {
      period: kpi.period,
      comparison: kpi.comparison,
      availableSections,
      availableMetrics,
      sections,
      attribution: kpi.attribution,
    };
  }

  /** GET /api/v1/dashboard/command-center/trends — unchanged from Step 3.1 */
  async getTrends(
    dto: TrendQueryDto,
    user: { id: string; role: string; partnerId?: string | null; permissions: string[] },
  ): Promise<TrendResponse> {
    const metric = (dto.metric || "orders") as string;

    if (!(metric in METRIC_SECTION_MAP)) {
      throw new NotFoundException(`Metric "${metric}" is not supported`);
    }

    const requiredSection = METRIC_SECTION_MAP[metric as TrendMetric];
    const requiredPermission = SECTION_PERMISSION_MAP[requiredSection];
    if (!user.permissions.includes(requiredPermission)) {
      throw new ForbiddenException(`Metric "${metric}" requires ${requiredPermission}`);
    }

    const analyticsDto: AnalyticsQueryDto = {
      preset: dto.preset as any,
      startDate: dto.startDate,
      endDate: dto.endDate,
      timezone: dto.timezone,
      comparison: false,
    };

    const granularity = dto.granularity as AnalyticsGranularity | undefined;

    const timeSeries = await this.analyticsService.getTimeSeries(
      analyticsDto,
      user as any,
      metric,
    );

    if (granularity && timeSeries.granularity !== granularity) {
      const overridden = await this.analyticsService.getTimeSeries(
        { ...analyticsDto, granularity },
        user as any,
        metric,
      );
      return {
        period: overridden.period,
        granularity: overridden.granularity,
        metric,
        buckets: overridden.buckets,
      };
    }

    return {
      period: timeSeries.period,
      granularity: timeSeries.granularity,
      metric,
      buckets: timeSeries.buckets,
    };
  }

  // ─── V3: Catalog Health ──────────────────────────────────────────────────

  private async buildCatalogHealth(): Promise<CatalogHealthResponse> {
    const [
      publishedCount,
      archivedCount,
      withoutSalesCount,
      totalCategories,
      highDemandCount,
      lowConversionCount,
    ] = await Promise.all([
      this.prisma.product.count({ where: { status: "PUBLISHED" as any } }),
      this.prisma.product.count({ where: { status: "ARCHIVED" as any } }),
      // Products published but with zero orders
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT count(*) as count FROM "catalog"."Product" p
        WHERE p.status = 'PUBLISHED'::"catalog"."ProductStatus"
          AND NOT EXISTS (SELECT 1 FROM "order"."OrderItem" oi WHERE oi."productId" = p.id)
      `).then(r => Number(r[0]?.count ?? 0)),
      this.prisma.category.count(),
      // High demand: products with >10 orders in last 30 days
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT count(*) as count FROM (
          SELECT oi."productId", count(*) as cnt
          FROM "order"."OrderItem" oi
          JOIN "order"."Order" o ON o.id = oi."orderId"
          WHERE o."createdAt" > NOW() - INTERVAL '30 days'
          GROUP BY oi."productId"
          HAVING count(*) > 10
        ) high_demand
      `).then(r => Number(r[0]?.count ?? 0)),
      // Low conversion: products with >5 orders but <2% conversion (using paid/total ratio)
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT count(*) as count FROM (
          SELECT oi."productId", count(*) as total_orders,
            count(*) FILTER (WHERE o."paymentStatus" = 'PAID'::"order"."OrderPaymentStatus") as paid_orders
          FROM "order"."OrderItem" oi
          JOIN "order"."Order" o ON o.id = oi."orderId"
          GROUP BY oi."productId"
          HAVING count(*) > 5
            AND (count(*) FILTER (WHERE o."paymentStatus" = 'PAID'::"order"."OrderPaymentStatus"))::float / count(*) < 0.5
        ) low_conv
      `).then(r => Number(r[0]?.count ?? 0)),
    ]);

    return {
      publishedServices: this.simpleKpi(publishedCount, "analytics"),
      archivedServices: this.simpleKpi(archivedCount, "analytics"),
      servicesWithoutSales: this.simpleKpi(withoutSalesCount, "analytics"),
      highDemandServices: this.simpleKpi(highDemandCount, "analytics"),
      lowConversionServices: this.simpleKpi(lowConversionCount, "analytics"),
      totalCategories: this.simpleKpi(totalCategories, "analytics"),
    };
  }

  // ─── V3: Channel Health ─────────────────────────────────────────────────

  private async buildChannelHealth(
    analyticsDto: AnalyticsQueryDto,
    user: { id: string; role: string; partnerId?: string | null; permissions: string[] },
  ): Promise<ChannelHealthResponse> {
    const period = this.getPeriodBounds(analyticsDto);

    const [mpOrders, sfOrders, mpPaidOrders, sfPaidOrders, mpGmv, sfGmv, mpCommission, sfCommission] = await Promise.all([
      // Marketplace orders count
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT count(*) as count FROM "order"."Order" o
        WHERE o."acquisitionSource" = 'MARKETPLACE'
          AND o."createdAt" >= $1 AND o."createdAt" < $2
      `, period.start, period.end).then(r => Number(r[0]?.count ?? 0)),
      // Storefront orders count
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT count(*) as count FROM "order"."Order" o
        WHERE o."acquisitionSource" = 'PARTNER_STOREFRONT'
          AND o."createdAt" >= $1 AND o."createdAt" < $2
      `, period.start, period.end).then(r => Number(r[0]?.count ?? 0)),
      // Marketplace paid orders (for conversion)
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT count(*) as count FROM "order"."Order" o
        WHERE o."acquisitionSource" = 'MARKETPLACE'
          AND o."paymentStatus" IN ('PAID'::"order"."OrderPaymentStatus", 'REFUNDED'::"order"."OrderPaymentStatus")
          AND o."createdAt" >= $1 AND o."createdAt" < $2
      `, period.start, period.end).then(r => Number(r[0]?.count ?? 0)),
      // Storefront paid orders (for conversion)
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT count(*) as count FROM "order"."Order" o
        WHERE o."acquisitionSource" = 'PARTNER_STOREFRONT'
          AND o."paymentStatus" IN ('PAID'::"order"."OrderPaymentStatus", 'REFUNDED'::"order"."OrderPaymentStatus")
          AND o."createdAt" >= $1 AND o."createdAt" < $2
      `, period.start, period.end).then(r => Number(r[0]?.count ?? 0)),
      // GMV Marketplace = total paidAmount of Marketplace orders
      this.prisma.$queryRawUnsafe<{ total: bigint }[]>(`
        SELECT COALESCE(sum(o."paidAmount"), 0) as total FROM "order"."Order" o
        WHERE o."acquisitionSource" = 'MARKETPLACE'
          AND o."paymentStatus" IN ('PAID'::"order"."OrderPaymentStatus", 'REFUNDED'::"order"."OrderPaymentStatus")
          AND o."createdAt" >= $1 AND o."createdAt" < $2
      `, period.start, period.end).then(r => Number(r[0]?.total ?? 0)),
      // GMV Storefront = total paidAmount of Storefront orders
      this.prisma.$queryRawUnsafe<{ total: bigint }[]>(`
        SELECT COALESCE(sum(o."paidAmount"), 0) as total FROM "order"."Order" o
        WHERE o."acquisitionSource" = 'PARTNER_STOREFRONT'
          AND o."paymentStatus" IN ('PAID'::"order"."OrderPaymentStatus", 'REFUNDED'::"order"."OrderPaymentStatus")
          AND o."createdAt" >= $1 AND o."createdAt" < $2
      `, period.start, period.end).then(r => Number(r[0]?.total ?? 0)),
      // Marketplace Revenue = TravelHub commission from Marketplace sales
      this.prisma.$queryRawUnsafe<{ total: bigint }[]>(`
        SELECT COALESCE(sum(c.amount), 0) as total FROM finance."Commission" c
        JOIN "order"."Order" o ON o.id = c."orderId"
        WHERE o."acquisitionSource" = 'MARKETPLACE'
          AND c."createdAt" >= $1 AND c."createdAt" < $2
      `, period.start, period.end).then(r => Number(r[0]?.total ?? 0)),
      // Storefront Revenue = subscription revenue (Premium plans $199/month)
      this.prisma.$queryRawUnsafe<{ total: number }[]>(`
        SELECT COALESCE(SUM(sp."priceUsd"), 0) as total
        FROM catalog."StorefrontSubscription" s
        JOIN catalog."StorefrontSubscriptionPlan" sp ON sp.id = s."planId"
        WHERE s.status = 'ACTIVE'
          AND sp."priceUsd" > 0
          AND s."currentPeriodStart" < $2
          AND s."currentPeriodEnd" > $1
      `, period.start, period.end).then(r => Number(r[0]?.total ?? 0)),
    ]);

    // Conversion = paid orders / total orders (same formula as executive section)
    const mpConversion = mpOrders === 0 ? 0 : Math.round((mpPaidOrders / mpOrders) * 10000) / 100;
    const sfConversion = sfOrders === 0 ? 0 : Math.round((sfPaidOrders / sfOrders) * 10000) / 100;

    return {
      marketplaceGmv: this.moneyKpi(mpGmv, "AZN", "analytics"),
      storefrontGmv: this.moneyKpi(sfGmv, "AZN", "analytics"),
      marketplaceRevenue: this.moneyKpi(mpCommission, "AZN", "finance"),
      storefrontRevenue: this.moneyKpi(sfCommission, "AZN", "finance"),
      marketplaceOrders: this.simpleKpi(mpOrders, "orders"),
      storefrontOrders: this.simpleKpi(sfOrders, "orders"),
      marketplaceConversion: this.percentKpi(mpConversion, "analytics"),
      storefrontConversion: this.percentKpi(sfConversion, "analytics"),
    };
  }

  // ─── V3: Needs Attention ────────────────────────────────────────────────

  private async buildNeedsAttention(): Promise<NeedsAttentionResponse> {
    const [
      pendingConfirmations,
      failedPayments,
      recentCancellations,
      pendingRefunds,
      upcomingBookings,
      servicesWithoutSales,
    ] = await Promise.all([
      // Orders waiting for confirmation (SENT_TO_BOOKING)
      this.prisma.order.count({ where: { status: "SENT_TO_BOOKING" as any } }),
      // Failed payments
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT count(*) as count FROM "finance"."Payment" p
        WHERE p.status = 'FAILED'::"finance"."PaymentStatus"
      `).then(r => Number(r[0]?.count ?? 0)),
      // Recent cancellations (last 7 days)
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT count(*) as count FROM "order"."Order" o
        WHERE o.status = 'CANCELLED'::"order"."OrderStatus"
          AND o."createdAt" > NOW() - INTERVAL '7 days'
      `).then(r => Number(r[0]?.count ?? 0)),
      // Pending refunds
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT count(*) as count FROM "finance"."Refund" r
        WHERE r.status = 'REQUESTED'::"finance"."RefundStatus"
      `).then(r => Number(r[0]?.count ?? 0)),
      // Upcoming bookings (service date in future)
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT count(*) as count FROM "booking"."Booking" b
        WHERE b.status IN ('CONFIRMED'::"booking"."BookingStatus", 'NEW'::"booking"."BookingStatus")
          AND b."serviceDate" > NOW()
      `).then(r => Number(r[0]?.count ?? 0)),
      // Published services without any orders
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT count(*) as count FROM "catalog"."Product" p
        WHERE p.status = 'PUBLISHED'::"catalog"."ProductStatus"
          AND NOT EXISTS (SELECT 1 FROM "order"."OrderItem" oi WHERE oi."productId" = p.id)
      `).then(r => Number(r[0]?.count ?? 0)),
    ]);

    return {
      pendingConfirmations: this.simpleKpi(pendingConfirmations, "orders"),
      failedPayments: this.simpleKpi(failedPayments, "finance"),
      cancellations: this.simpleKpi(recentCancellations, "orders"),
      pendingRefunds: this.simpleKpi(pendingRefunds, "finance"),
      upcomingBookings: this.simpleKpi(upcomingBookings, "bookings"),
      servicesWithoutSales: this.simpleKpi(servicesWithoutSales, "analytics"),
    };
  }

  // ─── V3: AI Decision Feed ───────────────────────────────────────────────

  private async buildAiDecisionFeed(): Promise<AiDecisionFeedResponse> {
    const [delayedBookings, highDemand, lowConversion, archivedStrong] = await Promise.all([
      // Delayed bookings (confirmed but service date passed)
      this.prisma.$queryRawUnsafe<{ count: bigint; value: bigint }[]>(`
        SELECT count(*) as count, COALESCE(sum(b.amount), 0) as value
        FROM "booking"."Booking" b
        WHERE b.status IN ('CONFIRMED'::"booking"."BookingStatus", 'IN_SERVICE'::"booking"."BookingStatus")
          AND b."serviceDate" < NOW()
      `).then(r => ({ count: Number(r[0]?.count ?? 0), value: Number(r[0]?.value ?? 0) })),
      // High demand products (growth opportunity)
      this.prisma.$queryRawUnsafe<{ title: string; orders: bigint }[]>(`
        SELECT p.title, count(*) as orders
        FROM "order"."OrderItem" oi
        JOIN "catalog"."Product" p ON p.id = oi."productId"
        JOIN "order"."Order" o ON o.id = oi."orderId"
        WHERE o."createdAt" > NOW() - INTERVAL '30 days'
        GROUP BY p.id, p.title
        HAVING count(*) > 8
        ORDER BY count(*) DESC
        LIMIT 5
      `),
      // Low conversion products (needs optimization)
      this.prisma.$queryRawUnsafe<{ title: string; total: bigint; paid: bigint }[]>(`
        SELECT p.title, count(*) as total,
          count(*) FILTER (WHERE o."paymentStatus" = 'PAID'::"order"."OrderPaymentStatus") as paid
        FROM "order"."OrderItem" oi
        JOIN "catalog"."Product" p ON p.id = oi."productId"
        JOIN "order"."Order" o ON o.id = oi."orderId"
        GROUP BY p.id, p.title
        HAVING count(*) > 3
          AND (count(*) FILTER (WHERE o."paymentStatus" = 'PAID'::"order"."OrderPaymentStatus"))::float / count(*) < 0.4
        ORDER BY count(*) DESC
        LIMIT 3
      `),
      // Archived products with strong historical performance
      this.prisma.$queryRawUnsafe<{ title: string; orders: bigint }[]>(`
        SELECT p.title, count(*) as orders
        FROM "order"."OrderItem" oi
        JOIN "catalog"."Product" p ON p.id = oi."productId"
        WHERE p.status = 'ARCHIVED'::"catalog"."ProductStatus"
        GROUP BY p.id, p.title
        HAVING count(*) > 5
        ORDER BY count(*) DESC
        LIMIT 3
      `),
    ]);

    const risks: AiDecisionFeedResponse["risks"] = [];
    if (delayedBookings.count > 0) {
      risks.push({
        title: `${delayedBookings.count} bookings delayed`,
        detail: `Potential value: ${delayedBookings.value} AZN`,
        severity: delayedBookings.count > 5 ? "high" : "medium",
      });
    }

    const opportunities: AiDecisionFeedResponse["opportunities"] = [];
    for (const hd of highDemand) {
      opportunities.push({
        title: `${hd.title} — high demand`,
        detail: `${hd.orders} orders in last 30 days. Consider increasing exposure.`,
        potential: `+${Number(hd.orders) * 15} AZN/week`,
      });
    }

    const catalogInsights: AiDecisionFeedResponse["catalogInsights"] = [];
    for (const lc of lowConversion) {
      const rate = Number(lc.total) > 0 ? Math.round((Number(lc.paid) / Number(lc.total)) * 100) : 0;
      catalogInsights.push({
        title: `${lc.title} — low conversion`,
        detail: `Only ${rate}% paid (${lc.paid}/${lc.total} orders). Review pricing/content.`,
      });
    }
    for (const arch of archivedStrong) {
      catalogInsights.push({
        title: `${arch.title} — strong historical performance`,
        detail: `${arch.orders} orders before archiving. Consider reactivation or replacement.`,
      });
    }

    return { risks, opportunities, catalogInsights };
  }

  // ─── Section Authority Helpers ───────────────────────────────────────────

  computeAvailableSections(permissions: string[]): DashboardSection[] {
    return ALL_SECTIONS.filter((s) => permissions.includes(SECTION_PERMISSION_MAP[s]));
  }

  computeAvailableMetrics(permissions: string[]): string[] {
    return SUPPORTED_METRICS.filter((m) => {
      const section = METRIC_SECTION_MAP[m];
      return permissions.includes(SECTION_PERMISSION_MAP[section]);
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private toKpiValue<T extends string | number>(
    comparisonValue: { current: T; previous: T | null; delta: T | null; deltaPercent: number | null },
    drillDownTarget: string,
  ): KpiValue {
    return {
      current: comparisonValue.current,
      previous: comparisonValue.previous,
      delta: comparisonValue.delta,
      deltaPercent: comparisonValue.deltaPercent,
      drillDown: { target: drillDownTarget },
    };
  }

  /** Simple numeric KPI without comparison. */
  private simpleKpi(value: number, drillDown: string): KpiValue {
    return { current: value, previous: null, delta: null, deltaPercent: null, drillDown: { target: drillDown } };
  }

  /** Money KPI with currency. */
  private moneyKpi(value: number, currency: string, drillDown: string): KpiValue {
    return { current: value, currency, previous: null, delta: null, deltaPercent: null, drillDown: { target: drillDown } };
  }

  /** Percentage KPI. */
  private percentKpi(value: number, drillDown: string): KpiValue {
    return { current: value.toFixed(2), previous: null, delta: null, deltaPercent: null, drillDown: { target: drillDown } };
  }

  /** Get period bounds from analytics DTO — reuses Step 3.3 period resolution. */
  private getPeriodBounds(dto: AnalyticsQueryDto): { start: Date; end: Date } {
    const tz = dto.timezone || "UTC";

    // Delegate to the canonical analytics period resolver (Step 3.3 authority)
    const resolved = resolvePeriod({
      preset: dto.preset as any,
      startDate: dto.startDate,
      endDate: dto.endDate,
      timezone: tz,
    });

    return {
      start: new Date(resolved.start),
      end: new Date(resolved.endExclusive),
    };
  }

  private computeConversionRate(
    payments: { current: number; previous: number | null },
    orders: { current: number; previous: number | null },
  ): KpiValue {
    const current = orders.current === 0
      ? null
      : Math.round((payments.current / orders.current) * 10000) / 100;

    let previous: number | null = null;
    if (orders.previous !== null && orders.previous !== 0 && payments.previous !== null) {
      previous = Math.round((payments.previous / orders.previous) * 10000) / 100;
    }

    const delta = current !== null && previous !== null
      ? Math.round((current - previous) * 100) / 100
      : null;
    const deltaPercent = previous !== null && previous !== 0 && current !== null
      ? Math.round(((current - previous) / previous) * 10000) / 100
      : null;

    return {
      current: current ?? "0.00",
      previous,
      delta,
      deltaPercent,
      drillDown: { target: "analytics" },
    };
  }

  private computeFunnelConversion(funnel: ConversionFunnelResponse): KpiValue {
    const stages = funnel.stages;
    if (stages.length < 2) {
      return { current: "0.00", previous: null, delta: null, deltaPercent: null, drillDown: { target: "analytics" } };
    }

    const first = stages[0].count;
    const last = stages[stages.length - 1].count;
    const rate = first === 0 ? "0.00" : (Math.round((last / first) * 10000) / 100).toFixed(2);

    return {
      current: rate,
      previous: null,
      delta: null,
      deltaPercent: null,
      drillDown: { target: "analytics" },
    };
  }

  private buildExecutiveSection(kpi: CompanyKpiResponse) {
    const m = kpi.metrics;
    return {
      gmv: this.toKpiValue(m.gmv, "analytics"),
      revenue: this.toKpiValue(m.revenue, "analytics"),
      netRevenue: this.toKpiValue(m.netRevenue, "analytics"),
      ordersCreated: this.toKpiValue(m.ordersCreated, "orders"),
      bookingsRequested: this.toKpiValue(m.bookingsRequested, "bookings"),
      averageOrderValue: this.toKpiValue(m.averageOrderValue, "analytics"),
      conversionRate: this.computeConversionRate(m.paymentsCaptured, m.ordersCreated),
    };
  }

  private buildOperationalSection(
    kpi: CompanyKpiResponse,
    funnel: ConversionFunnelResponse,
  ) {
    const m = kpi.metrics;
    return {
      ordersFulfilled: this.toKpiValue(m.ordersFulfilled, "orders"),
      bookingsConfirmed: this.toKpiValue(m.bookingsConfirmed, "bookings"),
      bookingsCompleted: this.toKpiValue(m.bookingsCompleted, "bookings"),
      paymentsCaptured: this.toKpiValue(m.paymentsCaptured, "finance"),
      refundsProcessed: this.toKpiValue(m.refundsProcessed, "finance"),
      funnelConversion: this.computeFunnelConversion(funnel),
    };
  }

  private buildFinancialSection(
    kpi: CompanyKpiResponse,
    reconciliation: FinancialReconciliationResponse,
  ) {
    return {
      commissionAccrued: this.toKpiValue(kpi.metrics.commissionAccrued, "finance"),
      reconciliationStatus: {
        current: reconciliation.totalLedgerEntries,
        previous: null,
        delta: null,
        deltaPercent: null,
        drillDown: { target: "finance" },
      },
      totalPayments: {
        current: reconciliation.totalPayments,
        currency: reconciliation.currency,
        previous: null,
        delta: null,
        deltaPercent: null,
        drillDown: { target: "finance" },
      },
      netPayments: {
        current: reconciliation.netPayments,
        currency: reconciliation.currency,
        previous: null,
        delta: null,
        deltaPercent: null,
        drillDown: { target: "finance" },
      },
    };
  }

  private buildMarketplaceSection(kpi: CompanyKpiResponse) {
    const m = kpi.metrics;
    return {
      marketplaceSessions: this.toKpiValue(m.marketplaceSessions, "analytics"),
      storefrontSessions: this.toKpiValue(m.storefrontSessions, "analytics"),
      marketplacePartners: this.toKpiValue(m.marketplacePartners, "analytics"),
      storefrontPartners: this.toKpiValue(m.storefrontPartners, "analytics"),
      marketplaceCustomers: this.toKpiValue(m.marketplaceCustomers, "analytics"),
      storefrontCustomers: this.toKpiValue(m.storefrontCustomers, "analytics"),
    };
  }
}
