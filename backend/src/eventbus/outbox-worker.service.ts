import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventBusService, OUTBOX_MAX_ATTEMPTS } from "./eventbus.service";

/**
 * Step 2.17 (durable event delivery) — фоновый durable publisher + retry worker.
 *
 * Проблема, которую закрывает: publishPending() вызывался только инлайном из
 * HTTP-command-путей после коммита; если процесс падал между коммитом и
 * publishPending, событие зависало в PENDING до следующего случайного запроса.
 * retryFailed() существовал, но не имел production-вызывающего — FAILED
 * retryable-события (OrderRequested) никогда не ретраились автоматически.
 *
 * Worker (production-registered, auto-start on bootstrap):
 *  - bounded цикл: retryFailed(limit) → publishPending(limit) каждые
 *    OUTBOX_WORKER_INTERVAL_MS (default 2000мс);
 *  - multi-instance safety: каждый цикл берёт pg advisory xact lock
 *    (hashtext('travelhub:outbox-worker')) внутри транзакции — только один
 *    инстанс исполняет цикл за раз; конкуренты скипают цикл (try lock);
 *  - controlled errors: исключения цикла логируются, worker не падает;
 *  - no tight loop: интервал, а не бесконечный занятой цикл;
 *  - event identity/lineage сохранены: retryFailed/publishPending НЕ меняют
 *    eventId/correlation/causation; InboxEvent dedup — authoritative защита от
 *    duplicate side effect (не полагаемся на exactly-once доставку).
 *
 * Наблюдаемость (не мониторинг-платформа): каждый цикл логирует published/
 * retried/exhausted counts; метод status() даёт текущие бэклоги.
 */
@Injectable()
export class OutboxWorkerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs = Number(process.env.OUTBOX_WORKER_INTERVAL_MS ?? 2000);
  private readonly batchSize = Number(process.env.OUTBOX_WORKER_BATCH ?? 100);
  /** Advisory-lock key: тот же на всех инстансах → сериализация цикла. */
  private static readonly WORKER_LOCK_KEY = "travelhub:outbox-worker";

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  onApplicationBootstrap(): void {
    // Производственный worker: запускается автоматически. Отключается в e2e
    // (test/e2e.env.ts ставит OUTBOX_WORKER_ENABLED=false — детерминизм тестов).
    if (String(process.env.OUTBOX_WORKER_ENABLED ?? "true").toLowerCase() === "false") {
      this.logger.log("Outbox worker disabled (OUTBOX_WORKER_ENABLED=false)");
      return;
    }
    this.logger.log(`Outbox worker started (interval=${this.intervalMs}ms, batch=${this.batchSize})`);
    this.timer = setInterval(() => {
      void this.runCycle().catch((err) => {
        this.logger.error(`outbox worker cycle failed: ${String((err as Error)?.message ?? err)}`);
      });
    }, this.intervalMs);
    // Не держать процесс живым из-за таймера.
    this.timer.unref?.();
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Один bounded-цикл: retry FAILED → publish PENDING.
   * Возвращает { retried, published, lockAcquired } для тестов/наблюдаемости.
   *
   * FIX (Step 2.17 e2e stabilization, root-cause B): доставка НЕ выполняется
   * внутри advisory-lock-транзакции. publishPending() синхронно исполняет
   * consumer-ов (OrderRequested → Order создание → вложенный publishPending →
   * CommissionAccrual и т.д.) — это превышает 5s interactive-transaction
   * timeout („expired transaction“), событие остаётся FAILED/PENDING и
   * последующие суиты видят лишний retryable-FAILED. Поэтому:
   *  - ТОЛЬКО flip retryable-FAILED→PENDING атомарен под lock (короткая tx,
   *    retryFailed — findMany+update, без consumer-исполнения);
   *  - publishPending() вызывается ВНЕ lock-транзакции (тот же путь, что в
   *    HTTP-командах; InboxEvent dedup — authoritative защита от duplicate
   *    side effect; повторная доставка идемпотентна).
   *  - lockAcquired=true в цикле с flip; при конкуренции за lock — false.
   */
  async runCycle(): Promise<{ retried: number; published: number; lockAcquired: boolean }> {
    // Шаг 1: сериализация цикла — короткая tx: try-lock + flip retryable FAILED.
    const flip = await this.prisma.$transaction(async (tx) => {
      const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(hashtext(${OutboxWorkerService.WORKER_LOCK_KEY})) AS locked
      `;
      if (!locked) return { locked: false as const, retried: 0 };
      const retried = await this.eventBus.retryFailed(this.batchSize, new Date(), tx);
      return { locked: true as const, retried };
    });
    if (!flip.locked) return { retried: 0, published: 0, lockAcquired: false };

    // Шаг 2: доставка вне lock-транзакции (безопасно по длительности; dedup — Inbox).
    const published = await this.eventBus.publishPending(this.batchSize);
    this.logger.log(`outbox cycle: retried=${flip.retried} published=${published}`);
    return { retried: flip.retried, published, lockAcquired: true };
  }

  /** Текущая наблюдаемость бэклогов (PENDING/FAILED/retryable-exhausted). */
  async status(): Promise<{
    pending: number;
    failed: number;
    retryableFailed: number;
    exhausted: number;
    workerEnabled: boolean;
  }> {
    const [pending, failed, retryableFailed, exhausted] = await Promise.all([
      this.prisma.outboxEvent.count({ where: { status: "PENDING" } }),
      this.prisma.outboxEvent.count({ where: { status: "FAILED" } }),
      this.prisma.outboxEvent.count({
        where: { status: "FAILED", retryable: true, attempts: { lt: OUTBOX_MAX_ATTEMPTS } },
      }),
      this.prisma.outboxEvent.count({
        where: { status: "FAILED", retryable: true, attempts: { gte: OUTBOX_MAX_ATTEMPTS } },
      }),
    ]);
    return {
      pending,
      failed,
      retryableFailed,
      exhausted,
      workerEnabled: String(process.env.OUTBOX_WORKER_ENABLED ?? "true").toLowerCase() !== "false",
    };
  }
}
