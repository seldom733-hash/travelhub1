import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { SalesAnalyticsController } from "./sales-analytics.controller";
import { SalesAnalyticsService } from "./sales-analytics.service";

@Module({
  imports: [PrismaModule],
  controllers: [SalesAnalyticsController],
  providers: [SalesAnalyticsService],
  exports: [SalesAnalyticsService],
})
export class SalesAnalyticsModule {}
