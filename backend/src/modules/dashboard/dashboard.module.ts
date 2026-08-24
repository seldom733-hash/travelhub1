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
import { DecisionSignalController } from "./decision-signal.controller";
import { DecisionSignalService } from "./decision-signal.service";
import { WhyAttributionService } from "./why-attribution.service";
import { ImpactAttributionService } from "./impact-attribution.service";
import { ActionDerivationService } from "./action-derivation.service";
import { AnalyticsModule } from "../analytics/analytics.module";
import { PrismaService } from "../../prisma/prisma.service";

@Module({
  imports: [AnalyticsModule],
  controllers: [DashboardController, DecisionSignalController],
  providers: [
    PrismaService,
    DecisionSignalService,
    WhyAttributionService,
    ImpactAttributionService,
    ActionDerivationService,
    DashboardService,
  ],
  exports: [DashboardService, DecisionSignalService, WhyAttributionService, ImpactAttributionService, ActionDerivationService],
})
export class DashboardModule {}
