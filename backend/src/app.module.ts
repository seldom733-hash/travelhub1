import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
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
  imports: [PrismaModule, EventBusModule, SecurityModule, CatalogModule, CrmModule, OrderModule, BookingModule, CommunicationModule, SalesModule, ReverseModule, FinanceModule],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
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
