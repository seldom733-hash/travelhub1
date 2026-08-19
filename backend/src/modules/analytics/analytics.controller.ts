/**
 * Step 3.3 Analytics Foundation — Analytics Controller (Remediated)
 *
 * API endpoints for analytics queries. All endpoints require authentication
 * and appropriate permissions.
 *
 * Design authority: docs/architecture/analytics-foundation-3.3.md
 * Remediation: Strict Review VERDICT B findings closure.
 */

import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from "class-validator";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsPeriodPreset } from "./analytics-period.resolver";
import { AnalyticsGranularity } from "./analytics-granularity.resolver";
import { RequirePermissions, CurrentUser } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";

class AnalyticsQueryDto {
  @IsEnum(AnalyticsPeriodPreset)
  preset!: AnalyticsPeriodPreset;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  comparison?: boolean;

  @IsOptional()
  @IsEnum(AnalyticsGranularity)
  granularity?: AnalyticsGranularity;

  @IsOptional()
  @IsString()
  partnerId?: string;

  @IsOptional()
  @IsString()
  acquisitionSource?: string;
}

/**
 * Analytics controller type: user with canonical identity fields.
 * Matches AuthUser from AuthService.
 */
type AnalyticsUser = AuthedRequest["user"];

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /api/v1/analytics/company-kpi
   *
   * Company-wide KPI summary for Dashboard/Command Center consumption.
   * Requires: analytics.read (canonical permission).
   */
  @Get("company-kpi")
  @RequirePermissions("analytics.read")
  async getCompanyKpi(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: AnalyticsUser,
  ) {
    return this.analyticsService.getCompanyKpi(query, user);
  }

  /**
   * GET /api/v1/analytics/partner-performance
   *
   * Partner-scoped performance metrics.
   * Requires: analytics.read (canonical permission).
   * PARTNER role: automatically scoped to own partnerId.
   */
  @Get("partner-performance")
  @RequirePermissions("analytics.read")
  async getPartnerPerformance(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: AnalyticsUser,
  ) {
    return this.analyticsService.getPartnerPerformance(query, user);
  }

  /**
   * GET /api/v1/analytics/conversion-funnel
   *
   * Marketplace/Storefront conversion funnel.
   * Requires: analytics.read (canonical permission).
   */
  @Get("conversion-funnel")
  @RequirePermissions("analytics.read")
  async getConversionFunnel(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: AnalyticsUser,
  ) {
    return this.analyticsService.getConversionFunnel(query, user);
  }

  /**
   * GET /api/v1/analytics/time-series
   *
   * Generic time-series data with auto-selected granularity.
   * Requires: analytics.read (canonical permission).
   */
  @Get("time-series")
  @RequirePermissions("analytics.read")
  async getTimeSeries(
    @Query() query: AnalyticsQueryDto,
    @Query("metric") metric: string | undefined,
    @CurrentUser() user: AnalyticsUser,
  ) {
    return this.analyticsService.getTimeSeries(query, user, metric || "orders");
  }

  /**
   * GET /api/v1/analytics/financial-reconciliation
   *
   * Financial reconciliation summary (read-only).
   * Requires: analytics.read (canonical permission).
   */
  @Get("financial-reconciliation")
  @RequirePermissions("analytics.read")
  async getFinancialReconciliation(
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: AnalyticsUser,
  ) {
    return this.analyticsService.getFinancialReconciliation(query, user);
  }
}
