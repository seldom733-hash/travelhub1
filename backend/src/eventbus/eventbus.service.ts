import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { createRequestId, getRequestContext, normalizeCorrelationId, runWithRequestContext } from "../shared/request-context";
import { assertValidBusinessEventWrite, type BusinessEventActor, type BusinessEventEnvelope, type DomainEventType } from "./domain-events";

export interface OutboxWrite {
  aggregateType: string;
  aggregateId: string;
  eventType: DomainEventType | string;
  /** Типизированный payload доменного события; в БД сохраняется как Json. */
  payload: unknown;
  correlationId?: string | null;
  causationId?: string | null;
  /** Step 1.15A: typed actor (USER/SYSTEM/UNKNOWN). Не передан → наследуется из
   *  активного request context (HTTP: USER из JwtAuthGuard; consumer: SYSTEM).
   *  null = explicit UNKNOWN/legacy (не подменяется контекстом). */
  actor?: BusinessEventActor | null;
}

/**
 * Canonical envelope, который получают consumer-ы (Step 1.15A projection).
 * Расширяет BusinessEventEnvelope каноническими полями + legacy aliases
 * (id/aggregateType/aggregateId/createdAt) для обратной совместимости.
 */
export interface OutboxEnvelope extends BusinessEventEnvelope<Prisma.JsonValue> {
  /** legacy alias of eventId (events.OutboxEvent.id). */
  id: string;
  /** legacy alias of entityType. */
  aggregateType: string;
  /** legacy alias of entityId. */
  aggregateId: string;
  createdAt: Date;
}

/**
 * Canonical projection (ADR-0010 §19): row OutboxEvent → consumer envelope.
 *  - occurredAt = createdAt (опция A, §26): событие пишется атомарно с transition;
 *  - entityId/entityType = aggregateId/aggregateType;
 *  - actor: legacy/malformed/отсутствующий JSON → null (UNKNOWN), без угадывания.
 * Чистая функция — переиспользуется publishPending и покрыта contract-тестами (§36).
 */
export function toOutboxEnvelope(row: {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  correlationId: string | null;
  causationId: string | null;
  createdAt: Date;
  actor: Prisma.JsonValue | null;
}): OutboxEnvelope {
  return {
    eventId: row.id,
    eventType: row.eventType,
    occurredAt: row.createdAt.toISOString(),
    correlationId: row.correlationId,
    causationId: row.causationId,
    actor: toActor(row.actor),
    entityId: row.aggregateId,
    entityType: row.aggregateType,
    payload: row.payload,
    // legacy aliases
    id: row.id,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    createdAt: row.createdAt,
  };
}

/** Runtime shape-guard для actor JSON (legacy/corrupt rows → null, не ломаем consumer-ов). */
function toActor(value: Prisma.JsonValue | null): BusinessEventActor | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const a = value as { type?: unknown; id?: unknown };
  if (a.type === "USER" && typeof a.id === "string" && a.id.trim().length > 0) {
    return { type: "USER", id: a.id };
  }
  if (a.type === "SYSTEM") {
    if (a.id === undefined) return { type: "SYSTEM" };
    if (typeof a.id === "string" && a.id.trim().length > 0) return { type: "SYSTEM", id: a.id };
  }
  if (a.type === "UNKNOWN" && a.id === undefined) return { type: "UNKNOWN" };
  return null; // malformed → UNKNOWN (честно, без угадывания)
}

export type EventHandler = (event: OutboxEnvelope) => void | Promise<void>;

/**
 * Event Bus (Гл. 6 «Событийная модель») — transactional outbox + in-process шина.
 *
 * Паттерн: доменное событие записывается в events.OutboxEvent В ТОЙ ЖЕ транзакции,
 * что и изменение сущности (метод emit), а после коммита вызывается publishPending(),
 * который рассылает события подписчикам и помечает их PUBLISHED/FAILED.
 * События-результаты (BookingCreated, OrderCreated из consumer-ов) пишутся сразу
 * PUBLISHED — они фиксируют факт в ленте и не рассылаются повторно.
 *
 * Идемпотентность consumer-ов — через events.InboxEvent (unique consumerId+eventId).
 * Шина in-process; интерфейс (on/emit/publishPending) позволяет заменить её на
 * RabbitMQ/Kafka без изменения бизнес-кода доменов.
 */
@Injectable()
export class EventBusService {
  private readonly handlers = new Map<string, EventHandler[]>();
  private readonly anyHandlers: EventHandler[] = [];

  constructor(private readonly prisma: PrismaService) {}

  /** Подписка на событие конкретного типа. */
  on(type: string, handler: EventHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  /** Подписка на любое событие (лента, трассировка). */
  onAny(handler: EventHandler): void {
    this.anyHandlers.push(handler);
  }

  /**
   * Запись события в outbox в рамках транзакции домена (атомарно с сущностью).
   * Step 1.15 §7: correlation/causation — если вызывающий не передал их явно,
   * наследуются из активного request context (HTTP flow: correlation=requestId,
   * causation=null; event consumer: correlation=ev.correlationId, causation=ev.id).
   * Явный `write.correlationId`/`write.causationId` имеет приоритет (позволяет
   * legacy/иные источники). NULL = unknown correlation (legacy rows, §17).
   */
async emit(tx: Prisma.TransactionClient, write: OutboxWrite): Promise<string> {
    assertValidBusinessEventWrite(write); // §18/§20: невалидное событие не пишется.
    const ctx = getRequestContext();
    // `!== undefined` guard: explicit null/значение у вызывающего ПЕРЕОПРЕДЕЛЯЕТ
    // наследование (не подменяется контекстом), undefined — наследуется из ctx.
    // normalizeCorrelationId (§6): пустая строка не сохраняется как correlation.
    const correlationId = write.correlationId !== undefined ? normalizeCorrelationId(write.correlationId) : (ctx?.correlationId ?? null);
    const causationId = write.causationId !== undefined ? normalizeCorrelationId(write.causationId) : (ctx?.causationId ?? null);
    // Step 1.15A §10: actor наследуется из контекста (USER/SYSTEM); explicit
    // null = intentional UNKNOWN (legacy) — не подменяется контекстом.
    const actor = write.actor !== undefined ? write.actor : (ctx?.actor ?? null);
    const created = await tx.outboxEvent.create({
      data: {
        aggregateType: write.aggregateType,
        aggregateId: write.aggregateId,
        eventType: write.eventType,
        payload: write.payload as Prisma.InputJsonValue,
        correlationId,
        causationId,
        actor: (actor ?? Prisma.DbNull) as Prisma.InputJsonValue,
        status: "PENDING",
      },
      select: { id: true },
    });
    return created.id;
  }

  /** Событие-результат: пишется сразу PUBLISHED (фиксация факта в ленте). */
  async emitResult(tx: Prisma.TransactionClient, write: OutboxWrite): Promise<string> {
    assertValidBusinessEventWrite(write);
    const ctx = getRequestContext();
    const correlationId = write.correlationId !== undefined ? normalizeCorrelationId(write.correlationId) : (ctx?.correlationId ?? null);
    const causationId = write.causationId !== undefined ? normalizeCorrelationId(write.causationId) : (ctx?.causationId ?? null);
    const actor = write.actor !== undefined ? write.actor : (ctx?.actor ?? null);
    const created = await tx.outboxEvent.create({
      data: {
        aggregateType: write.aggregateType,
        aggregateId: write.aggregateId,
        eventType: write.eventType,
        payload: write.payload as Prisma.InputJsonValue,
        correlationId,
        causationId,
        actor: (actor ?? Prisma.DbNull) as Prisma.InputJsonValue,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      select: { id: true },
    });
    return created.id;
  }

  /** Публикация накопившихся PENDING-событий подписчикам. Возвращает число опубликованных. */
  async publishPending(limit = 100): Promise<number> {
    const pending = await this.prisma.outboxEvent.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    let published = 0;
    for (const ev of pending) {
      // Step 1.15A: canonical projection для consumer-ов (§19) — единый
      // toOutboxEnvelope: occurredAt = createdAt (опция A), entityId/entityType
      // из aggregate-полей, actor из колонки. Legacy-строки без actor → null.
      const envelope = toOutboxEnvelope(ev);
      try {
        // Step 1.15 §8: consumer обрабатывает событие в НОВОМ processing context:
        //  - requestId — новый invocation ID;
        //  - correlationId — inherited из события (вся causal chain);
        //  - causationId — parent eventId (для child events, создаваемых consumer-ом);
        //  - actor — SYSTEM (Step 1.15A §10: обработка события — системный актор;
        //    события-результаты consumer-а наследуют его как envelope.actor).
        // Повторная доставка того же события (inbox dedup) не создаёт новую
        // логическую цепочку/эффект.
        await runWithRequestContext(
          {
            requestId: createRequestId(),
            correlationId: ev.correlationId,
            causationId: ev.id,
            actor: { type: "SYSTEM" },
          },
          async () => {
            const list = [...(this.handlers.get(ev.eventType) ?? []), ...this.anyHandlers];
            for (const handler of list) {
              await handler(envelope);
            }
          },
        );
        await this.prisma.outboxEvent.update({
          where: { id: ev.id },
          data: { status: "PUBLISHED", publishedAt: new Date() },
        });
        published++;
      } catch (err) {
        await this.prisma.outboxEvent.update({
          where: { id: ev.id },
          data: { status: "FAILED", error: String((err as Error)?.message ?? err) },
        });
      }
    }
    return published;
  }

  /** Обработано ли событие данным consumer-ом (идемпотентность). */
  async isProcessed(consumerId: string, eventId: string): Promise<boolean> {
    const found = await this.prisma.inboxEvent.findUnique({
      where: { consumerId_eventId: { consumerId, eventId } },
      select: { id: true },
    });
    return found !== null;
  }

  /** Отметить событие обработанным в рамках транзакции consumer-а. */
  async markProcessed(tx: Prisma.TransactionClient, consumerId: string, eventId: string): Promise<void> {
    await tx.inboxEvent.create({
      data: { consumerId, eventId },
    });
  }
}
