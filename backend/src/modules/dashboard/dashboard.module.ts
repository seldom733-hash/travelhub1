/**
 * Step 3.1 Dashboard / Command Center Backend — Module
 *
 * Registers dashboard controllers and services.
 * Orchestrates Step 3.3 Analytics Foundation read models.
 *
 * Design authority: docs/architecture/dashboard-command-center-backend-3.1.md
 */

import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { AnalyticsModule } from "../analytics/analytics.module";

@Module({
  imports: [AnalyticsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
