/**
 * Step 3.1 Dashboard / Command Center Backend — Controller
 *
 * API endpoints for Dashboard / Command Center.
 * All endpoints require authentication and analytics.read permission.
 *
 * Design authority: docs/architecture/dashboard-command-center-backend-3.1.md
 */

import { Controller, Get, Query } from "@nestjs/common";
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { DashboardService } from "./dashboard.service";
import { RequirePermissions, CurrentUser } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { AnalyticsPeriodPreset } from "../analytics/analytics-period.resolver";
import { AnalyticsGranularity } from "../analytics/analytics-granularity.resolver";

class DashboardQueryDto {
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
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  comparison?: boolean;
}

class TrendQueryDto extends DashboardQueryDto {
  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsEnum(AnalyticsGranularity)
  granularity?: AnalyticsGranularity;
}

type DashboardUser = AuthedRequest["user"];

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /api/v1/dashboard/command-center
   *
   * Aggregated KPI summary for Dashboard / Command Center.
   * Requires: analytics.read (canonical permission).
   */
  @Get("command-center")
  @RequirePermissions("analytics.read")
  async getCommandCenter(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: DashboardUser,
  ) {
    return this.dashboardService.getCommandCenter(query, user);
  }

  /**
   * GET /api/v1/dashboard/command-center/trends
   *
   * Lazy-loaded time series for Dashboard charts.
   * Requires: analytics.read (canonical permission).
   */
  @Get("command-center/trends")
  @RequirePermissions("analytics.read")
  async getTrends(
    @Query() query: TrendQueryDto,
    @CurrentUser() user: DashboardUser,
  ) {
    return this.dashboardService.getTrends(query, user);
  }
}
