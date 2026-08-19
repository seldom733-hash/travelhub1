/**
 * Step 3.3 Analytics Foundation — Analytics Module
 *
 * Registers analytics controllers and services.
 * Reads from canonical Prisma schema — no separate analytics warehouse.
 *
 * Design authority: docs/architecture/analytics-foundation-3.3.md
 */

import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
