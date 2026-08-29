import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { RequestContextMiddleware } from "./shared/request-context.middleware";
import { PrismaModule } from "./prisma/prisma.module";
import { EventBusModule } from "./eventbus/eventbus.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { CrmModule } from "./modules/crm/crm.module";
import { OrderModule } from "./modules/order/order.module";
import { BookingModule } from "./modules/booking/booking.module";
import { CommunicationModule } from "./modules/communication/communication.module";
import { SalesModule } from "./modules/sales/sales.module";
import { ReverseModule } from "./modules/reverse/reverse.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { WorkspaceModule } from "./modules/workspace/workspace.module";
import { IdempotencyModule } from "./shared/idempotency/idempotency.module";
import { OperationalNotesModule } from "./modules/operational-notes/operational-notes.module";
import { CrmActivityModule } from "./modules/crm-activity/crm-activity.module";
import { MarketingModule } from "./modules/marketing/marketing.module";
import { IdempotencyInterceptor } from "./shared/idempotency/idempotency.interceptor";
import { SecurityModule } from "./security/security.module";
import { JwtAuthGuard } from "./security/auth/jwt-auth.guard";
import { PermissionsGuard } from "./security/auth/permissions.guard";

/**
 * Модульный монолит: каждый домен = отдельный NestJS-модуль (bounded context)
 * с собственной схемой БД. Междоменные связи — только события + чтение по ID.
 *
 * Security (Phase 2): JwtAuthGuard глобально (защита по умолчанию, @Public()
 * открывает эндпоинты), PermissionsGuard глобально (проверка @RequirePermissions).
 */
@Module({
  imports: [PrismaModule, EventBusModule, SecurityModule, CatalogModule, CrmModule, CrmActivityModule, OrderModule, BookingModule, CommunicationModule, SalesModule, ReverseModule, FinanceModule, AnalyticsModule, DashboardModule, WorkspaceModule, IdempotencyModule, OperationalNotesModule, MarketingModule],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Step 2.12H: external API idempotency — passthrough для незащищённых
    // эндпоинтов; контракт активен только на @Idempotent("...") операциях.
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule implements NestModule {
  // Step 1.15 §5: единый server-authoritative request context для КАЖДОГО HTTP
  // запроса (включая public anonymous endpoints). Регистрация здесь (а не в
  // main.ts) гарантирует одинаковое поведение в prod и e2e (Nest TestingModule
  // применяет middleware из AppModule.configure при app.init()).
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
