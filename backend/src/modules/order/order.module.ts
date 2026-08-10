import { Module } from "@nestjs/common";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";
import { OrderSubscribers } from "./order.subscribers";
import { OrderRequestedConsumer } from "./order-requested.consumer";
import { BookingModule } from "../booking/booking.module";

@Module({
  imports: [BookingModule],
  controllers: [OrderController],
  providers: [OrderService, OrderSubscribers, OrderRequestedConsumer],
})
export class OrderModule {}
