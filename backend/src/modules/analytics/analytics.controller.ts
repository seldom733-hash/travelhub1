/**
 * Step 3.3 Analytics Foundation — Analytics Controller
 *
 * API endpoints for analytics queries. All endpoints require authentication
 * and appropriate permissions.
 *
 * Design authority: docs/architecture/analytics-foundation-3.3.md
 */

import { Controller, Get, Query } from "@nestjs/common";
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
import { RequirePermissions } from "../../security/auth/decorators";

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

@Controller("api/v1/analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /api/v1/analytics/company-kpi
   *
   * Company-wide KPI summary for Dashboard/Command Center consumption.
   * Requires: finance.analytics.read or analytics.company.read
   */
  @Get("company-kpi")
  @RequirePermissions("finance.analytics.read")
  async getCompanyKpi(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getCompanyKpi(query);
  }

  /**
   * GET /api/v1/analytics/partner-performance
   *
   * Partner-scoped performance metrics.
   * Requires: finance.analytics.read or analytics.partner.read
   */
  @Get("partner-performance")
  @RequirePermissions("finance.analytics.read")
  async getPartnerPerformance(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getPartnerPerformance(query);
  }

  /**
   * GET /api/v1/analytics/conversion-funnel
   *
   * Marketplace/Storefront conversion funnel.
   * Requires: finance.analytics.read or analytics.funnel.read
   */
  @Get("conversion-funnel")
  @RequirePermissions("finance.analytics.read")
  async getConversionFunnel(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getConversionFunnel(query);
  }

  /**
   * GET /api/v1/analytics/time-series
   *
   * Generic time-series data with auto-selected granularity.
   * Requires: finance.analytics.read or analytics.timeseries.read
   */
  @Get("time-series")
  @RequirePermissions("finance.analytics.read")
  async getTimeSeries(
    @Query() query: AnalyticsQueryDto,
    @Query("metric") metric?: string,
  ) {
    return this.analyticsService.getTimeSeries(query, metric || "orders");
  }
}
