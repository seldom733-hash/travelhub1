import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { OrderService } from "./order.service";

/**
 * Automatically closes completed deals after the last service day.
 * The authoritative gates (debts, settlement, service period) stay in
 * OrderService.orderAction; this worker only triggers the normal close path.
 */
@Injectable()
export class OrderClosureWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderClosureWorker.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly orders: OrderService) {}

  onModuleInit(): void {
    // Run soon after startup and then hourly. Manual/admin closure and the
    // financial guards remain unchanged.
    setTimeout(() => void this.run(), 30_000).unref?.();
    this.timer = setInterval(() => void this.run(), 60 * 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<void> {
    try {
      const candidates = await (this.orders as unknown as { prisma: any }).prisma.order.findMany({
        where: { status: { in: ["FULFILLED", "READY_TO_CLOSE"] } },
        select: { id: true, code: true },
        take: 500,
      });
      for (const order of candidates) {
        try {
          await this.orders.orderAction(order.id, "close", "system");
        } catch {
          // Not eligible yet (future service date or outstanding finances).
        }
      }
    } catch (error) {
      this.logger.warn(`Automatic order closure skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
