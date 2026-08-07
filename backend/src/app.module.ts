import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { EventBusModule } from "./eventbus/eventbus.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { CrmModule } from "./modules/crm/crm.module";
import { OrderModule } from "./modules/order/order.module";
import { BookingModule } from "./modules/booking/booking.module";
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
  imports: [PrismaModule, EventBusModule, SecurityModule, CatalogModule, CrmModule, OrderModule, BookingModule],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
