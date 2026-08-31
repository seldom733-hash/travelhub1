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
import { DecisionSignalService } from "./decision-signal.service";
import { WhyAttributionService } from "./why-attribution.service";
import { ImpactAttributionService } from "./impact-attribution.service";
import { ActionDerivationService } from "./action-derivation.service";
import type { ActionDefinition } from "./action-contract.types";
import type { DecisionImpact } from "./impact-attribution.types";
import type { DecisionSignalDetector, SignalEvidenceItem } from "./decision-signal.types";
import type { WhyAttribution } from "./why-attribution.types";
import { PendingBookingsDetector } from "./detectors/pending-bookings.detector";
import { FailedPaymentsDetector } from "./detectors/failed-payments.detector";
import { RecentCancellationsDetector } from "./detectors/recent-cancellations.detector";
import { PendingRefundsDetector } from "./detectors/pending-refunds.detector";
import { UpcomingBookingsDetector } from "./detectors/upcoming-bookings.detector";
import { ServicesWithoutSalesDetector } from "./detectors/services-without-sales.detector";

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

export type DashboardSection = "executive" | "operational" | "financial" | "marketplace" | "storefrontSaaS" | "catalog" | "channels" | "attention" | "insights";

/** Canonical section → permission mapping. Single source of truth. */
export const SECTION_PERMISSION_MAP: Record<DashboardSection, string> = {
  executive: "dashboard.executive.read",
  operational: "dashboard.operational.read",
  financial: "dashboard.financial.read",
  marketplace: "dashboard.marketplace.read",
  storefrontSaaS: "dashboard.marketplace.read",
  catalog: "dashboard.catalog.read",
  channels: "dashboard.channels.read",
  attention: "dashboard.attention.read",
  insights: "dashboard.insights.read",
};

const ALL_SECTIONS: DashboardSection[] = ["executive", "operational", "financial", "marketplace", "storefrontSaaS", "catalog", "channels", "attention", "insights"];

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
  /** B.2: explicit platform reporting currency (AZN) for monetary KPIs. */
  drillDown?: { target: string; query?: Record<string, string> };
  /** Reconciled display value for integer presentation (OPTION B). Used by KpiCard for display; authoritative `current` remains exact for analytics/comparison. */
  displayCurrent?: string | number;
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

export interface WhyAttributionDto {
  status: string;
  primaryDriver?: {
    textKey: string;
    factualValue: string | number;
    evidenceRefs: string[];
  };
  contributingFactors: Array<{
    textKey: string;
    factualValue: string | number;
    evidenceRefs: string[];
  }>;
  evidenceStrength: string;
  evidenceRefs: string[];
  rule: { ruleId: string; ruleVersion: string };
}

export interface NeedsAttentionResponse {
  summary: {
    open: number;
    acknowledged: number;
    total: number;
    slaBreached: number;
  };
  signals: Array<{
    id: string;
    code: string;
    titleKey: string;
    descriptionKey: string;
    descriptionParams: Record<string, string | number>;
    category: string;
    status: string;
    affectedCount: number;
    evidence: Array<{ key: string; value: string | number; unit?: string }>;
    why: WhyAttributionDto | null;
    impact: DecisionImpact | null;
    actions: ActionDefinition[];
    firstDetectedAt: string;
    lastDetectedAt: string;
    observationCount: number;
    acknowledgedAt?: string;
    resolvedAt?: string;
    dismissedAt?: string;
    availableActions: string[];
  }>;
  // Legacy counters — derived from signals for backward compat
  pendingConfirmations: KpiValue;
  failedPayments: KpiValue;
  cancellations: KpiValue;
  pendingRefunds: KpiValue;
  upcomingBookings: KpiValue;
  servicesWithoutSales: KpiValue;
}

export interface AiDecisionFeedResponse {
  risks: Array<{ titleKey: string; titleParams: Record<string, string | number>; detailKey: string; detailParams: Record<string, string | number>; severity: "high" | "medium" | "low" }>;
  opportunities: Array<{ titleKey: string; titleParams: Record<string, string | number>; detailKey: string; detailParams: Record<string, string | number>; orders: number; period: number }>;
  catalogInsights: Array<{ titleKey: string; titleParams: Record<string, string | number>; detailKey: string; detailParams: Record<string, string | number> }>;
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
      refunds: KpiValue;
      ordersCreated: KpiValue;
      bookingsRequested: KpiValue;
      averageOrderValue: KpiValue;
      conversionRate: KpiValue;
      // GMV Lifecycle (Policy Closure)
      qualifiedGmv: KpiValue;
      completedGmv: KpiValue;
      collectedGmv: KpiValue;
      outstandingGmv: KpiValue;
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
      totalRefunds: KpiValue;
    };
    marketplace?: {
      marketplaceSessions: KpiValue;
      marketplacePartners: KpiValue;
      marketplaceCustomers: KpiValue;
    };
    storefrontSaaS?: {
      storefrontSessions: KpiValue;
      storefrontPartners: KpiValue;
      storefrontMrr: KpiValue;
      storefrontArr: KpiValue;
      storefrontCollected: KpiValue;
      storefrontOutstanding: KpiValue;
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
  private readonly detectors: DecisionSignalDetector[];

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly prisma: PrismaService,
    private readonly decisionSignalService: DecisionSignalService,
    private readonly whyAttributionService: WhyAttributionService,
    private readonly impactAttributionService: ImpactAttributionService,
    private readonly actionDerivationService: ActionDerivationService,
  ) {
    // Instantiate detectors internally (no DI needed for optional params)
    this.detectors = [
      new PendingBookingsDetector(prisma),
      new FailedPaymentsDetector(prisma),
      new RecentCancellationsDetector(prisma),
      new PendingRefundsDetector(prisma),
      new UpcomingBookingsDetector(prisma),
      new ServicesWithoutSalesDetector(prisma),
    ];
  }

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
      sectionSet.has("attention") ? this.buildNeedsAttention(user) : null,
      sectionSet.has("insights") ? this.buildAiDecisionFeed() : null,
    ]);

    // Stage I: Billing metrics from authoritative SubscriptionContract/Invoice/Payment
    let billingMetrics: { mrr: number; arr: number; collected: number; outstanding: number } | null = null;
    if (sectionSet.has("marketplace")) {
      billingMetrics = await this.computeBillingMetrics();
    }

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
      sections.storefrontSaaS = this.buildStorefrontSaaSSection(kpi, billingMetrics);
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

  /** Signal code → human-readable title mapping */
  /** Signal code → i18n key for title (no hardcoded language in backend) */
  private static readonly SIGNAL_TITLE_KEYS: Record<string, string> = {
    BOOKING_CONFIRMATION_DELAY: "cc.signal.title.BOOKING_CONFIRMATION_DELAY",
    FAILED_PAYMENTS: "cc.signal.title.FAILED_PAYMENTS",
    RECENT_CANCELLATIONS: "cc.signal.title.RECENT_CANCELLATIONS",
    PENDING_REFUNDS: "cc.signal.title.PENDING_REFUNDS",
    UPCOMING_BOOKINGS: "cc.signal.title.UPCOMING_BOOKINGS",
    SERVICES_WITHOUT_SALES: "cc.signal.title.SERVICES_WITHOUT_SALES",
  };

  /** Signal code → i18n key for description + params builder */
  private static readonly SIGNAL_DESC_KEYS: Record<string, { key: string; params: (e: any[]) => Record<string, string | number> }> = {
    BOOKING_CONFIRMATION_DELAY: {
      key: "cc.signal.desc.BOOKING_CONFIRMATION_DELAY",
      params: (e) => ({
        count: e.find((x: any) => x.key === "pendingConfirmationCount")?.value ?? 0,
        minutes: e.find((x: any) => x.key === "oldestPendingMinutes")?.value ?? 0,
      }),
    },
    FAILED_PAYMENTS: {
      key: "cc.signal.desc.FAILED_PAYMENTS",
      params: (e) => ({
        count: e.find((x: any) => x.key === "failedCount")?.value ?? 0,
      }),
    },
    RECENT_CANCELLATIONS: {
      key: "cc.signal.desc.RECENT_CANCELLATIONS",
      params: (e) => ({
        count: e.find((x: any) => x.key === "cancellationCount")?.value ?? 0,
      }),
    },
    PENDING_REFUNDS: {
      key: "cc.signal.desc.PENDING_REFUNDS",
      params: (e) => ({
        count: e.find((x: any) => x.key === "pendingRefundCount")?.value ?? 0,
      }),
    },
    UPCOMING_BOOKINGS: {
      key: "cc.signal.desc.UPCOMING_BOOKINGS",
      params: (e) => ({
        count: e.find((x: any) => x.key === "upcomingCount")?.value ?? 0,
        days: e.find((x: any) => x.key === "daysUntilNearest")?.value ?? 0,
      }),
    },
    SERVICES_WITHOUT_SALES: {
      key: "cc.signal.desc.SERVICES_WITHOUT_SALES",
      params: (e) => ({
        count: e.find((x: any) => x.key === "unsoldProductCount")?.value ?? 0,
      }),
    },
  };

  private async buildNeedsAttention(user?: { id: string; role: string; partnerId?: string | null; permissions: string[] }): Promise<NeedsAttentionResponse> {
    // Run all detectors to populate/update DecisionSignals
    await this.decisionSignalService.runDetectors(this.detectors);

    // Query ALL signals (active + historical) for the queue
    const allQueueSignals = await (this.prisma as any).decisionSignal.findMany({
      where: { status: { in: ["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"] } },
      orderBy: [{ status: "asc" }, { lastDetectedAt: "desc" }],
      take: 200,
    });
    const activeSignals = allQueueSignals.filter((s: any) => s.status === "OPEN" || s.status === "ACKNOWLEDGED");

    // Query counts for summary
    const [openCount, ackCount, totalActive] = await Promise.all([
      (this.prisma as any).decisionSignal.count({ where: { status: "OPEN" } }),
      (this.prisma as any).decisionSignal.count({ where: { status: "ACKNOWLEDGED" } }),
      (this.prisma as any).decisionSignal.count({ where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } } }),
    ]);

    // SLA breached = signals where oldest pending > 4 hours (240 min)
    const slaThreshold = new Date(Date.now() - 240 * 60 * 1000);
    const slaBreached = activeSignals.filter(
      (s: any) => s.status === "OPEN" && new Date(s.firstDetectedAt) < slaThreshold,
    ).length;

    // Build queue items from ALL signals (active + historical)
    const queueSignals = allQueueSignals.map((s: any) => {
      const evidence = (s.evidence as any[]) ?? [];
      // i18n: send keys instead of hardcoded locale strings
      const titleKey = DashboardService.SIGNAL_TITLE_KEYS[s.code] ?? `cc.signal.title.${s.code}`;
      const descEntry = DashboardService.SIGNAL_DESC_KEYS[s.code];
      const descriptionKey = descEntry?.key ?? `cc.signal.desc.${s.code}`;
      const descriptionParams = descEntry ? descEntry.params(evidence) : {};

      const affectedEntities = (s.affectedEntities as any[]) ?? [];
      const availableActions: string[] = [];
      if (s.status === "OPEN") {
        availableActions.push("acknowledge", "resolve", "dismiss");
      } else if (s.status === "ACKNOWLEDGED") {
        availableActions.push("resolve");
      }

      return {
        id: s.id,
        code: s.code,
        titleKey,
        descriptionKey,
        descriptionParams,
        category: s.category,
        status: s.status,
        affectedCount: affectedEntities.length,
        evidence: evidence.map((e: any) => ({
          key: e.key,
          value: e.value,
          unit: e.unit,
        })),
        why: null as WhyAttributionDto | null,
        actions: [] as ActionDefinition[],
        firstDetectedAt: s.firstDetectedAt?.toISOString?.() ?? s.firstDetectedAt,
        lastDetectedAt: s.lastDetectedAt?.toISOString?.() ?? s.lastDetectedAt,
        observationCount: s.observationCount,
        acknowledgedAt: s.acknowledgedAt?.toISOString?.() ?? s.acknowledgedAt,
        resolvedAt: s.resolvedAt?.toISOString?.() ?? s.resolvedAt,
        dismissedAt: s.dismissedAt?.toISOString?.() ?? s.dismissedAt,
        availableActions,
      };
    });

    // Derive legacy counters from signals for backward compatibility
    const findCounter = (code: string) => {
      const signal = queueSignals.find((s: any) => s.code === code);
      return signal?.affectedCount ?? 0;
    };

    // Also check resolved/dismissed for complete counters
    const allSignals = await (this.prisma as any).decisionSignal.findMany({
      where: { status: { in: ["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"] } },
      select: { code: true, status: true, affectedEntities: true },
    });

    const totalByCode = (code: string) => {
      const matching = allSignals.filter((s: any) => s.code === code);
      return matching.reduce((sum: number, s: any) => {
        const entities = (s.affectedEntities as any[]) ?? [];
        return sum + entities.length;
      }, 0);
    };

    // Stage D: compute WHY attribution for each signal
    for (const signal of queueSignals) {
      signal.why = this.whyAttributionService.computeAttribution(
        signal.code,
        signal.evidence as SignalEvidenceItem[],
      );
    }

    // Stage E: compute IMPACT for each signal
    for (const signal of queueSignals) {
      signal.impact = this.impactAttributionService.computeImpact(
        signal.code,
        signal.evidence as SignalEvidenceItem[],
      );
    }

    // Stage F: derive available actions for each signal
    const userPermissions = user?.permissions ?? [];
    for (const signal of queueSignals) {
      signal.actions = this.actionDerivationService.deriveActions(
        signal.code,
        signal.evidence as Array<{ key: string; value: string | number }>,
        userPermissions,
      );
    }

    return {
      summary: {
        open: openCount,
        acknowledged: ackCount,
        total: totalActive,
        slaBreached,
      },
      signals: queueSignals,
      pendingConfirmations: this.simpleKpi(findCounter("BOOKING_CONFIRMATION_DELAY"), "orders"),
      failedPayments: this.simpleKpi(findCounter("FAILED_PAYMENTS"), "finance"),
      cancellations: this.simpleKpi(findCounter("RECENT_CANCELLATIONS"), "orders"),
      pendingRefunds: this.simpleKpi(findCounter("PENDING_REFUNDS"), "finance"),
      upcomingBookings: this.simpleKpi(findCounter("UPCOMING_BOOKINGS"), "bookings"),
      servicesWithoutSales: this.simpleKpi(findCounter("SERVICES_WITHOUT_SALES"), "analytics"),
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
        titleKey: "cc.ai.risk.delayed_bookings.title",
        titleParams: { count: delayedBookings.count },
        detailKey: "cc.ai.risk.delayed_bookings.detail",
        detailParams: { value: delayedBookings.value, count: delayedBookings.count },
        severity: "medium",
      });
    }

    const opportunities: AiDecisionFeedResponse["opportunities"] = [];
    for (const hd of highDemand) {
      opportunities.push({
        titleKey: "cc.ai.opp.high_demand.title",
        titleParams: { name: hd.title },
        detailKey: "cc.ai.opp.high_demand.detail",
        detailParams: { orders: Number(hd.orders), days: 30 },
        orders: Number(hd.orders),
        period: 30,
      });
    }

    const catalogInsights: AiDecisionFeedResponse["catalogInsights"] = [];
    for (const lc of lowConversion) {
      const rate = Number(lc.total) > 0 ? Math.round((Number(lc.paid) / Number(lc.total)) * 100) : 0;
      catalogInsights.push({
        titleKey: "cc.ai.cat.low_paid_share.title",
        titleParams: { name: lc.title },
        detailKey: "cc.ai.cat.low_paid_share.detail",
        detailParams: { rate, paid: Number(lc.paid), total: Number(lc.total) },
      });
    }
    for (const arch of archivedStrong) {
      catalogInsights.push({
        titleKey: "cc.ai.cat.historical.title",
        titleParams: { name: arch.title },
        detailKey: "cc.ai.cat.historical.detail",
        detailParams: { orders: Number(arch.orders) },
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
    currency?: string,
  ): KpiValue {
    return {
      current: comparisonValue.current,
      previous: comparisonValue.previous,
      delta: comparisonValue.delta,
      deltaPercent: comparisonValue.deltaPercent,
      currency,
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
    // ── Reconciled integer presentation (OPTION B) ──
    // Displayed Outstanding = round(GMV) - round(Collected) so that
    // integer cards are visually consistent: GMV - Collected = Outstanding.
    const exactGmv = parseFloat(String(m.qualifiedGmv.current || "0"));
    const exactCollected = parseFloat(String(m.collectedGmv.current || "0"));
    const displayedOutstanding = Math.max(0, Math.round(exactGmv) - Math.round(exactCollected));
    // Previous period reconciliation for delta computation
    const prevGmv = m.qualifiedGmv.previous != null ? parseFloat(String(m.qualifiedGmv.previous)) : null;
    const prevCollected = m.collectedGmv.previous != null ? parseFloat(String(m.collectedGmv.previous)) : null;
    const displayedPrevOutstanding = prevGmv != null && prevCollected != null
      ? Math.max(0, Math.round(prevGmv) - Math.round(prevCollected))
      : null;

    const gmvKpi = this.toKpiValue(m.gmv, "analytics", m.gmvCurrency);
    const revenueKpi = this.toKpiValue(m.revenue, "analytics", m.revenueCurrency);
    const refundsKpi = this.toKpiValue(m.refunds, "finance", m.refundsCurrency);
    const qualifiedGmvKpi = this.toKpiValue(m.qualifiedGmv, "analytics", m.gmvCurrency);
    const completedGmvKpi = this.toKpiValue(m.completedGmv, "analytics", m.gmvCurrency);
    const collectedGmvKpi = this.toKpiValue(m.collectedGmv, "analytics", m.gmvCurrency);
    const outstandingGmvKpi = this.toKpiValue(m.outstandingGmv, "analytics", m.gmvCurrency);
    // Override outstanding displayCurrent with reconciled value
    outstandingGmvKpi.displayCurrent = displayedOutstanding;
    // Reconciled delta: difference of displayed integers
    if (displayedPrevOutstanding !== null) {
      outstandingGmvKpi.delta = displayedOutstanding - displayedPrevOutstanding;
      outstandingGmvKpi.deltaPercent = displayedPrevOutstanding !== 0
        ? Math.round(((displayedOutstanding - displayedPrevOutstanding) / displayedPrevOutstanding) * 10000) / 100
        : null;
    }

    return {
      gmv: gmvKpi,
      revenue: revenueKpi,
      refunds: refundsKpi,
      ordersCreated: this.toKpiValue(m.ordersCreated, "orders"),
      bookingsRequested: this.toKpiValue(m.bookingsRequested, "bookings"),
      averageOrderValue: this.toKpiValue(m.averageOrderValue, "analytics", m.gmvCurrency),
      conversionRate: this.computeConversionRate(m.paymentsCaptured, m.ordersCreated),
      // GMV Lifecycle (Policy Closure)
      qualifiedGmv: qualifiedGmvKpi,
      completedGmv: completedGmvKpi,
      collectedGmv: collectedGmvKpi,
      outstandingGmv: outstandingGmvKpi,
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
    // Stage H enrichment: use kpi.metrics for comparison data where available.
    // kpi.metrics.revenue = Payment Volume (SUM Payment.amount WHERE status=CAPTURED AND paidAt in period)
    // kpi.metrics.refunds = SUM Refund.amount WHERE status=PROCESSED AND processedAt in period
    // kpi.metrics.netRevenue = revenue - refunds (currently no comparison)
    // reconciliation.* = same event-period sums from FinancialReconciliationResponse

    const totalPaymentsValue = {
      current: reconciliation.totalPayments,
      currency: reconciliation.currency,
      // Use kpi.metrics.revenue comparison (same underlying data)
      previous: kpi.metrics.revenue.previous,
      delta: kpi.metrics.revenue.delta,
      deltaPercent: kpi.metrics.revenue.deltaPercent,
      drillDown: { target: "finance" } as const,
    };

    const netPaymentsValue = {
      current: reconciliation.netPayments,
      currency: reconciliation.currency,
      // Compute comparison: netPayments = payments - refunds
      previous: kpi.metrics.netRevenue.previous,
      delta: kpi.metrics.netRevenue.delta,
      deltaPercent: kpi.metrics.netRevenue.deltaPercent,
      drillDown: { target: "finance" } as const,
    };

    return {
      commissionAccrued: this.toKpiValue(kpi.metrics.commissionAccrued, "finance", kpi.metrics.revenueCurrency),
      reconciliationStatus: {
        current: reconciliation.totalLedgerEntries,
        previous: null,
        delta: null,
        deltaPercent: null,
        drillDown: { target: "finance" },
      },
      totalPayments: totalPaymentsValue,
      netPayments: netPaymentsValue,
      totalRefunds: this.toKpiValue(kpi.metrics.refunds, "finance", kpi.metrics.refundsCurrency),
    };
  }

  private buildMarketplaceSection(
    kpi: CompanyKpiResponse,
  ) {
    const m = kpi.metrics;
    return {
      marketplaceSessions: this.toKpiValue(m.marketplaceSessions, "analytics"),
      marketplacePartners: this.toKpiValue(m.marketplacePartners, "analytics"),
      marketplaceCustomers: this.toKpiValue(m.marketplaceCustomers, "analytics"),
    };
  }

  private buildStorefrontSaaSSection(
    kpi: CompanyKpiResponse,
    billing: { mrr: number; arr: number; collected: number; outstanding: number } | null,
  ) {
    const m = kpi.metrics;
    return {
      storefrontSessions: this.toKpiValue(m.storefrontSessions, "analytics"),
      storefrontPartners: this.toKpiValue(m.storefrontPartners, "analytics"),
      storefrontMrr: this.moneyKpi(billing?.mrr ?? 0, "AZN", "finance"),
      storefrontArr: this.moneyKpi(billing?.arr ?? 0, "AZN", "finance"),
      storefrontCollected: this.moneyKpi(billing?.collected ?? 0, "AZN", "finance"),
      storefrontOutstanding: this.moneyKpi(billing?.outstanding ?? 0, "AZN", "finance"),
    };
  }

  /**
   * Stage I: Compute MRR/ARR/Collected/Outstanding from billing authority.
   * MRR = SUM(contract.totalAmount) WHERE subscription.status IN (ACTIVE) AND contract.isActive
   * ARR = MRR × 12
   * Collected = SUM(payment.amount) WHERE payment.status = SUCCEEDED AND paidAt in period
   * Outstanding = SUM(invoice.totalAmount - paid) WHERE invoice.status = OPEN
   */
  private async computeBillingMetrics(): Promise<{ mrr: number; arr: number; collected: number; outstanding: number }> {
    const [mrrResult, collectedResult, outstandingResult] = await Promise.all([
      // MRR: sum of active contracted totals for ACTIVE subscriptions
      this.prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(c."contractedTotalAmount"), 0) as total
        FROM catalog."SubscriptionContract" c
        JOIN catalog."StorefrontSubscription" s ON s.id = c."subscriptionId"
        WHERE c."isActive" = true
          AND s.status IN ('ACTIVE', 'PAST_DUE')
      `,
      // Collected: successful payments in period (use current month as default)
      this.prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(p.amount), 0) as total
        FROM catalog."SubscriptionPayment" p
        WHERE p.status = 'SUCCEEDED'
          AND p."paidAt" >= date_trunc('month', NOW())
          AND p."paidAt" < date_trunc('month', NOW()) + interval '1 month'
      `,
      // Outstanding: sum of (invoice.total - paid) for OPEN invoices
      this.prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(i."totalAmount" - COALESCE(paid.total_paid, 0)), 0) as total
        FROM catalog."SubscriptionInvoice" i
        LEFT JOIN (
          SELECT "invoiceId", SUM(amount) as total_paid
          FROM catalog."SubscriptionPayment"
          WHERE status = 'SUCCEEDED'
          GROUP BY "invoiceId"
        ) paid ON paid."invoiceId" = i.id
        WHERE i.status = 'OPEN'
      `,
    ]);

    const mrr = Number(mrrResult[0]?.total ?? 0);
    return {
      mrr,
      arr: mrr * 12,
      collected: Number(collectedResult[0]?.total ?? 0),
      outstanding: Number(outstandingResult[0]?.total ?? 0),
    };
  }
}
