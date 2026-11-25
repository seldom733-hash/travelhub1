import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { OrderService } from "./order.service";
import { DomainError } from "../../shared/errors";

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
    let candidates: Array<{ id: string; code: string }> = [];
    let closed = 0;
    const skipped = new Map<string, number>();

    try {
      candidates = await (this.orders as unknown as { prisma: any }).prisma.order.findMany({
        where: { status: { in: ["FULFILLED", "READY_TO_CLOSE"] } },
        select: { id: true, code: true },
        // Deterministic: with more than `take` candidates the same subset must
        // not be retried forever while older ones are never reached.
        orderBy: { createdAt: "asc" },
        take: 500,
      });
      for (const order of candidates) {
        try {
          await this.orders.orderAction(order.id, "close", "system");
          closed++;
        } catch (error) {
          if (error instanceof DomainError) {
            // Expected: future service date, outstanding finances, active
            // booking, returned-to-request. Aggregate by reason (order code
            // stripped) instead of warning per order every hour.
            const reason = error.message.replace(/^Order\s+\S+\s+/, "");
            skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
            this.logger.debug(`Automatic order close skipped for order ${order.code}: ${reason}`);
          } else {
            // Unexpected (DB/infra) — keep full visibility, do not mask as skip.
            this.logger.error(
              `Automatic order close failed for order ${order.code}: ${
                error instanceof Error ? error.message : String(error)
              }`,
              error instanceof Error ? error.stack : undefined,
            );
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Automatic order closure skipped: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    if (candidates.length === 0) return;
    const topReasons = [...skipped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const reasons = topReasons
      .map(([reason, count]) => `${count}× ${reason.length > 180 ? `${reason.slice(0, 177)}…` : reason}`)
      .join("; ");
    const extra = skipped.size > topReasons.length ? `; +${skipped.size - topReasons.length} more reason(s)` : "";
    this.logger.log(
      `Automatic order closure: ${closed}/${candidates.length} closed${reasons ? `; skipped: ${reasons}${extra}` : ""}`,
    );
  }
}
