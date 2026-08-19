/**
 * Step 3.1 Dashboard / Command Center Backend — Orchestration Service
 *
 * Aggregates Step 3.3 Analytics Foundation read models into a single
 * Command Center response. This is a pure orchestration/consumer layer —
 * it does NOT create parallel analytics logic.
 *
 * Design authority: docs/architecture/dashboard-command-center-backend-3.1.md
 * Invariant: COMMAND CENTER = ORCHESTRATION, NOT A SECOND ANALYTICS ENGINE
 */

import { Injectable } from "@nestjs/common";
import {
  AnalyticsService,
  type AnalyticsQueryDto,
  type CompanyKpiResponse,
  type ConversionFunnelResponse,
  type FinancialReconciliationResponse,
  type TimeSeriesResponse,
} from "../analytics/analytics.service";
import { AnalyticsGranularity } from "../analytics/analytics-granularity.resolver";

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

// ─── Response Types ─────────────────────────────────────────────────────────

export interface KpiValue {
  current: string | number;
  currency?: string;
  previous: string | number | null;
  delta: string | number | null;
  deltaPercent: number | null;
  drillDown?: { target: string; query?: Record<string, string> };
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
  sections: {
    executive: {
      gmv: KpiValue;
      revenue: KpiValue;
      netRevenue: KpiValue;
      ordersCreated: KpiValue;
      bookingsRequested: KpiValue;
      averageOrderValue: KpiValue;
      conversionRate: KpiValue;
    };
    operational: {
      ordersFulfilled: KpiValue;
      bookingsConfirmed: KpiValue;
      bookingsCompleted: KpiValue;
      paymentsCaptured: KpiValue;
      refundsProcessed: KpiValue;
      funnelConversion: KpiValue;
    };
    financial: {
      commissionAccrued: KpiValue;
      reconciliationStatus: KpiValue;
      totalPayments: KpiValue;
      netPayments: KpiValue;
    };
    marketplace: {
      marketplaceSessions: KpiValue;
      storefrontSessions: KpiValue;
      activePartners: KpiValue;
      newCustomers: KpiValue;
    };
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
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /api/v1/dashboard/command-center
   *
   * Orchestrates Step 3.3 read models into a single Command Center response.
   * All period/currency/comparison logic delegated to Step 3.3.
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

    // Parallel calls to Step 3.3 read models
    const [kpi, funnel, reconciliation] = await Promise.all([
      this.analyticsService.getCompanyKpi(analyticsDto, user as any),
      this.analyticsService.getConversionFunnel(analyticsDto, user as any),
      this.analyticsService.getFinancialReconciliation(analyticsDto, user as any),
    ]);

    // Build response sections from Step 3.3 data
    const sections = this.buildSections(kpi, funnel, reconciliation);

    return {
      period: kpi.period,
      comparison: kpi.comparison,
      sections,
      attribution: kpi.attribution,
    };
  }

  /**
   * GET /api/v1/dashboard/command-center/trends
   *
   * Lazy-loaded time series. Forwards to Step 3.3 Time Series.
   */
  async getTrends(
    dto: TrendQueryDto,
    user: { id: string; role: string; partnerId?: string | null; permissions: string[] },
  ): Promise<TrendResponse> {
    const analyticsDto: AnalyticsQueryDto = {
      preset: dto.preset as any,
      startDate: dto.startDate,
      endDate: dto.endDate,
      timezone: dto.timezone,
      comparison: false,
    };

    const metric = dto.metric || "orders";
    const granularity = dto.granularity as AnalyticsGranularity | undefined;

    const timeSeries = await this.analyticsService.getTimeSeries(
      analyticsDto,
      user as any,
      metric,
    );

    // If explicit granularity requested, re-query with override
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

  // ─── Section Builders ─────────────────────────────────────────────────────

  private buildSections(
    kpi: CompanyKpiResponse,
    funnel: ConversionFunnelResponse,
    reconciliation: FinancialReconciliationResponse,
  ): CommandCenterResponse["sections"] {
    return {
      executive: this.buildExecutiveSection(kpi),
      operational: this.buildOperationalSection(kpi, funnel),
      financial: this.buildFinancialSection(kpi, reconciliation),
      marketplace: this.buildMarketplaceSection(kpi),
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
      activePartners: this.toKpiValue(m.activePartners, "analytics"),
      newCustomers: this.toKpiValue(m.newCustomers, "crm"),
    };
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

  /**
   * Conversion Rate = paymentsCaptured / ordersCreated (percentage)
   * Division by zero → null (not NaN/Infinity)
   */
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

  /**
   * Funnel Conversion = last stage / first stage (percentage)
   * Uses Conversion Funnel stages from Step 3.3.
   */
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
}
