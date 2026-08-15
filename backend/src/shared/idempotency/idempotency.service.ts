/**
 * PHASE 2 STEP 2.12H — External API Idempotency Service.
 *
 * Durable claim → execute → complete, PostgreSQL = correctness authority.
 * Multi-instance безопасность: DB unique slotKey backstop (P2002 → повторное
 * чтение слота), никаких process-local mutex.
 *
 * Классификация каждого защищённого запроса (prompt §3):
 *  1. first execution        — claim insert успешен → execute → complete;
 *  2. identical retry        — COMPLETED + fingerprint совпадает → replay;
 *  3. divergent key reuse    — fingerprint НЕ совпадает → controlled 409;
 *  4. in-progress duplicate  — IN_PROGRESS: bounded wait → replay (если
 *                              COMPLETED) либо controlled 409;
 *  5. completed replay       — DB-backed повторная выдача результата.
 *
 * Crash-окна (prompt §13) анализируются явно:
 *  1) до claim               — ничего не записано;
 *  2) claim, до business     — claim IN_PROGRESS; crash → stale takeover
 *     (CAS по claimedAt, bound IDEMPOTENCY_STALE_AFTER_MS) → re-execute;
 *  3) business, до result    — business-факт закоммичен, claim IN_PROGRESS;
 *     crash → stale takeover → re-execute: БЕЗОПАСНО, потому что защищённые
 *     операции business-idempotent (payment.create возвращает существующий
 *     активный Payment — тот же факт, без дубликата);
 *  4) result, до HTTP ответа — claim COMPLETED; retry → replay;
 *  5) process death mid-op   — покрыт (2)+(3).
 * Дубликат committed-side-effect для V1 protected set: 0 (business
 * idempotency устраняет его в окне (3)); это НЕ «exactly-once delivery» —
 * повторное ВЫПОЛНЕНИЕ возможно после stale-crash, но повторного ФАКТА нет.
 *
 * Failure policy (prompt §16): бизнес-ошибка/rollback → claim удаляется
 * (ключ переиспользуем, НЕ poisoning). COMPLETED — только после успешного
 * выполнения бизнес-операции. Недоступный результат (responseStatus null) на
 * COMPLETED — невозможно в V1 (complete пишет оба поля атомарно-последовательно
 * в одном update).
 */
import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { ExternalIdempotencyStatus } from "../../generated/prisma/enums";
import { PrismaService } from "../../prisma/prisma.service";
import { ConflictError } from "../errors";
import {
  IDEMPOTENCY_MAX_WAIT_MS,
  IDEMPOTENCY_POLL_INTERVAL_MS,
  IDEMPOTENCY_STALE_AFTER_MS,
} from "./idempotency.constants";
import { deriveSlotKey, type IdempotencyScope } from "./idempotency.slot-key";

export interface IdempotencyExecutionResult {
  /** true — результат взят из слота (replay), false — свежее выполнение. */
  readonly replay: boolean;
  readonly status: number;
  readonly body: unknown;
}

export interface IdempotencyExecuteOptions {
  readonly scope: IdempotencyScope;
  readonly operation: string;
  readonly clientKey: string;
  /** Server-derived semantic fingerprint (validated DTO), см. fingerprint.ts. */
  readonly fingerprint: string;
  /** Выполнение бизнес-операции (возвращает status + safe body). */
  readonly execute: () => Promise<{ status: number; body: unknown }>;
}

const P2002 = "P2002";

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(options: IdempotencyExecuteOptions): Promise<IdempotencyExecutionResult> {
    const slotKey = deriveSlotKey(options.scope, options.operation, options.clientKey);

    // 1. Claim (DB unique backstop).
    let claimed = false;
    try {
      await this.prisma.externalIdempotencyRecord.create({
        data: {
          slotKey,
          scopeType: options.scope.type,
          scopeId: options.scope.id,
          operation: options.operation,
          fingerprint: options.fingerprint,
          status: ExternalIdempotencyStatus.IN_PROGRESS,
          claimedAt: new Date(),
        },
      });
      claimed = true;
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== P2002) throw err;
      // Слот уже существует → классифицируем.
      const existing = await this.prisma.externalIdempotencyRecord.findUnique({ where: { slotKey } });
      if (!existing) {
        // Строка исчезла между P2002 и чтением (rollback path) — пробуем ещё раз.
        return this.execute(options);
      }
      if (existing.fingerprint !== options.fingerprint) {
        throw new ConflictError(
          `Idempotency-Key reuse with a divergent request (operation ${options.operation})`,
        );
      }
      if (existing.status === ExternalIdempotencyStatus.COMPLETED) {
        return this.replay(existing.responseStatus, existing.responseBody);
      }
      // IN_PROGRESS (in-progress duplicate либо crash residue).
      if (this.isStale(existing.claimedAt)) {
        const taken = await this.takeOver(slotKey);
        if (taken) {
          // CAS победил — мы владеем слотом, выполняем (business-idempotent).
          return this.executeFresh(slotKey, options);
        }
        // Проиграли takeover другому процессу — повторное чтение.
        const after = await this.prisma.externalIdempotencyRecord.findUnique({ where: { slotKey } });
        if (after?.status === ExternalIdempotencyStatus.COMPLETED) {
          return this.replay(after.responseStatus, after.responseBody);
        }
        throw new ConflictError("Idempotency-Key request is already being retried by another instance");
      }
      // Fresh in-progress duplicate: bounded deterministic wait → replay/409.
      const completed = await this.waitForCompletion(slotKey, options.fingerprint);
      if (completed) return completed;
      throw new ConflictError("Idempotency-Key request is already in progress");
    }

    if (!claimed) {
      // Недостижимо (claim выше либо вернул, либо бросил) — fail-closed.
      throw new ConflictError("Idempotency-Key claim failed");
    }

    // 2+3. Execute + complete (свой бизнес-транзакции внутри execute()).
    return this.executeFresh(slotKey, options);
  }

  private async executeFresh(
    slotKey: string,
    options: IdempotencyExecuteOptions,
  ): Promise<IdempotencyExecutionResult> {
    try {
      const result = await options.execute();
      await this.prisma.externalIdempotencyRecord.update({
        where: { slotKey },
        data: {
          status: ExternalIdempotencyStatus.COMPLETED,
          responseStatus: result.status,
          responseBody: result.body === undefined ? Prisma.DbNull : (result.body as Prisma.InputJsonValue),
          completedAt: new Date(),
        },
      });
      return { replay: false, status: result.status, body: result.body };
    } catch (err) {
      // Rollback/бизнес-ошибка → claim удаляем: ключ переиспользуем (не poison).
      await this.prisma.externalIdempotencyRecord
        .deleteMany({ where: { slotKey, status: ExternalIdempotencyStatus.IN_PROGRESS } })
        .catch((e) => {
          // Удаление — best-effort; если не удалось (гонка с takeover),
          // следующая попытка того же ключа разберётся по состоянию слота.
          this.logger.warn(`[idempotency] claim cleanup failed for ${slotKey}: ${String(e)}`);
        });
      throw err;
    }
  }

  private replay(status: number | null, body: unknown): IdempotencyExecutionResult {
    if (status === null) {
      throw new ConflictError("Idempotency-Key slot is completed but has no replayable result");
    }
    return { replay: true, status, body: body ?? null };
  }

  private isStale(claimedAt: Date): boolean {
    return Date.now() - claimedAt.getTime() >= IDEMPOTENCY_STALE_AFTER_MS;
  }

  /** CAS takeover stale IN_PROGRESS слота; true — этот процесс владеет. */
  private async takeOver(slotKey: string): Promise<boolean> {
    const cutoff = new Date(Date.now() - IDEMPOTENCY_STALE_AFTER_MS);
    const res = await this.prisma.externalIdempotencyRecord.updateMany({
      where: {
        slotKey,
        status: ExternalIdempotencyStatus.IN_PROGRESS,
        claimedAt: { lt: cutoff },
      },
      data: { claimedAt: new Date() },
    });
    return res.count === 1;
  }

  /** Bounded wait за fresh in-progress duplicate (детерминированный 409). */
  private async waitForCompletion(
    slotKey: string,
    fingerprint: string,
  ): Promise<IdempotencyExecutionResult | null> {
    const deadline = Date.now() + IDEMPOTENCY_MAX_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, IDEMPOTENCY_POLL_INTERVAL_MS));
      const rec = await this.prisma.externalIdempotencyRecord.findUnique({ where: { slotKey } });
      if (!rec) return null; // слот удалён (rollback) — re-execute на след. попытке клиента
      if (rec.fingerprint !== fingerprint) {
        throw new ConflictError("Idempotency-Key reuse with a divergent request");
      }
      if (rec.status === ExternalIdempotencyStatus.COMPLETED) {
        return this.replay(rec.responseStatus, rec.responseBody);
      }
    }
    return null;
  }
}
