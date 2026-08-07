import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { EventBusModule } from "./eventbus/eventbus.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { CrmModule } from "./modules/crm/crm.module";
import { OrderModule } from "./modules/order/order.module";
import { BookingModule } from "./modules/booking/booking.module";

/**
 * Модульный монолит: каждый домен = отдельный NestJS-модуль (bounded context)
 * с собственной схемой БД. Междоменные связи — только события + чтение по ID.
 */
@Module({
  imports: [PrismaModule, EventBusModule, CatalogModule, CrmModule, OrderModule, BookingModule],
})
export class AppModule {}
