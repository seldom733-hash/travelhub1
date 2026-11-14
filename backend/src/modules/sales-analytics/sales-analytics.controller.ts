import { Controller, Get, Param, Query } from "@nestjs/common";
import { RequirePermissions, CurrentUser } from "../../security/auth/decorators";
import type { AuthedRequest } from "../../security/auth/jwt-auth.guard";
import { SalesAnalyticsService, type SalesAnalyticsQuery } from "./sales-analytics.service";

@Controller("sales-analytics")
export class SalesAnalyticsController {
  constructor(private readonly sales: SalesAnalyticsService) {}

  @Get("dashboard")
  @RequirePermissions("sales.kpi.read")
  dashboard(@Query() query: SalesAnalyticsQuery, @CurrentUser() user: AuthedRequest["user"]) {
    return this.sales.dashboard(query, user);
  }

  @Get("drilldown")
  @RequirePermissions("sales.kpi.read")
  drilldown(@Query("metric") metric: string, @Query() query: SalesAnalyticsQuery, @CurrentUser() user: AuthedRequest["user"]) {
    return this.sales.drilldown(metric || "requestsTotal", query, user);
  }

  @Get("managers/:id")
  @RequirePermissions("sales.kpi.read")
  manager(@Param("id") id: string, @Query() query: SalesAnalyticsQuery, @CurrentUser() user: AuthedRequest["user"]) {
    return this.sales.managerDetail(id, query, user);
  }
}
