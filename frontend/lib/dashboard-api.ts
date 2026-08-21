/**
 * Dashboard / Command Center API Client
 *
 * Fetches summary and trends from the Step 3.1 backend.
 * All period/comparison/timezone logic delegated to backend.
 *
 * R2-09: Typed HTTP errors for proper component state classification.
 */

import { api } from "./api";

// ─── TYPES ───────────────────────────────────────────────────────────

export type DashboardSection = "executive" | "operational" | "financial" | "marketplace";

export type PeriodPreset = "TODAY" | "LAST_3_DAYS" | "LAST_7_DAYS" | "MONTH" | "LAST_6_MONTHS" | "YEAR" | "CUSTOM";

export interface KpiValue {
  current: number | null;
  previous: number | null;
  delta: number | null;
  deltaPercent: number | null;
}

export interface CommandCenterSummary {
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
      activePartners: KpiValue;
      newCustomers: KpiValue;
    };
  };
}

export interface TrendBucket {
  label: string;
  start: string;
  endExclusive: string;
  value: number;
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
  buckets: TrendBucket[];
}

// ─── SUPPORTED TREND METRICS ─────────────────────────────────────────

/** Backend-supported trend metrics. revenue is NOT supported. */
export const SUPPORTED_TREND_METRICS = ["orders", "bookings", "payments", "customers", "commissions"] as const;

export type SupportedTrendMetric = (typeof SUPPORTED_TREND_METRICS)[number];

/** Map widget dataSource → trend metric (null = unsupported). */
export function dataSourceToTrendMetric(dataSource: string): SupportedTrendMetric | null {
  const metric = dataSource.replace("dashboard.trends.", "");
  if ((SUPPORTED_TREND_METRICS as readonly string[]).includes(metric)) {
    return metric as SupportedTrendMetric;
  }
  return null;
}

// ─── TYPED HTTP ERRORS ───────────────────────────────────────────────

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Authentication required") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Access denied") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

export class TrendNotAvailableError extends HttpError {
  constructor(message = "Trend metric not supported") {
    super(message, 404);
    this.name = "TrendNotAvailableError";
  }
}

// ─── API CLIENT ──────────────────────────────────────────────────────

export interface DashboardQueryParams {
  preset: PeriodPreset;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  comparison?: boolean;
}

export interface TrendQueryParams extends DashboardQueryParams {
  metric: string;
  granularity?: string;
}

export const dashboardApi = {
  /** Fetch Command Center summary. */
  async getSummary(params: DashboardQueryParams, signal?: AbortSignal): Promise<CommandCenterSummary> {
    const searchParams = new URLSearchParams();
    searchParams.set("preset", params.preset);
    if (params.startDate) searchParams.set("startDate", params.startDate);
    if (params.endDate) searchParams.set("endDate", params.endDate);
    if (params.timezone) searchParams.set("timezone", params.timezone);
    if (params.comparison !== undefined) searchParams.set("comparison", String(params.comparison));

    const url = `/api/v1/dashboard/command-center?${searchParams.toString()}`;
    const res = await fetch(url, { credentials: "include", signal });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body.message || `HTTP ${res.status}`;
      if (res.status === 401) throw new UnauthorizedError(msg);
      if (res.status === 403) throw new ForbiddenError(msg);
      throw new HttpError(msg, res.status);
    }
    return res.json() as Promise<CommandCenterSummary>;
  },

  /** Fetch trend data for a specific metric. */
  async getTrend(params: TrendQueryParams, signal?: AbortSignal): Promise<TrendResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set("preset", params.preset);
    searchParams.set("metric", params.metric);
    if (params.startDate) searchParams.set("startDate", params.startDate);
    if (params.endDate) searchParams.set("endDate", params.endDate);
    if (params.timezone) searchParams.set("timezone", params.timezone);
    if (params.granularity) searchParams.set("granularity", params.granularity);

    const url = `/api/v1/dashboard/command-center/trends?${searchParams.toString()}`;
    const res = await fetch(url, { credentials: "include", signal });
    if (res.ok) return res.json() as Promise<TrendResponse>;
    const body = await res.json().catch(() => ({}));
    const msg = body.message || `HTTP ${res.status}`;
    if (res.status === 403) throw new ForbiddenError(msg);
    if (res.status === 404) throw new TrendNotAvailableError(msg);
    throw new HttpError(msg, res.status);
  },
};

// ─── PERIOD HELPERS ──────────────────────────────────────────────────

/** Get default query params for a period preset. */
export function presetToQuery(preset: PeriodPreset, comparison = true): DashboardQueryParams {
  return { preset, timezone: "UTC", comparison };
}

/** Validate custom date range. Returns error string or null. */
export function validateCustomRange(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) return "Start and end dates are required for CUSTOM period";
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "Invalid date format";
  if (s > e) return "Start date must be before or equal to end date";
  return null;
}
