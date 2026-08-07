import { Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { DomainEventType } from "./domain-events";

export interface OutboxWrite {
  aggregateType: string;
  aggregateId: string;
  eventType: DomainEventType | string;
  /** Типизированный payload доменного события; в БД сохраняется как Json. */
  payload: unknown;
  correlationId?: string | null;
  causationId?: string | null;
}

export interface OutboxEnvelope {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  correlationId: string | null;
  causationId: string | null;
  createdAt: Date;
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

  /** Запись события в outbox в рамках транзакции домена (атомарно с сущностью). */
  async emit(tx: Prisma.TransactionClient, write: OutboxWrite): Promise<string> {
    const created = await tx.outboxEvent.create({
      data: {
        aggregateType: write.aggregateType,
        aggregateId: write.aggregateId,
        eventType: write.eventType,
        payload: write.payload as Prisma.InputJsonValue,
        correlationId: write.correlationId ?? null,
        causationId: write.causationId ?? null,
        status: "PENDING",
      },
      select: { id: true },
    });
    return created.id;
  }

  /** Событие-результат: пишется сразу PUBLISHED (фиксация факта в ленте). */
  async emitResult(tx: Prisma.TransactionClient, write: OutboxWrite): Promise<string> {
    const created = await tx.outboxEvent.create({
      data: {
        aggregateType: write.aggregateType,
        aggregateId: write.aggregateId,
        eventType: write.eventType,
        payload: write.payload as Prisma.InputJsonValue,
        correlationId: write.correlationId ?? null,
        causationId: write.causationId ?? null,
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
      const envelope: OutboxEnvelope = {
        id: ev.id,
        aggregateType: ev.aggregateType,
        aggregateId: ev.aggregateId,
        eventType: ev.eventType,
        payload: ev.payload,
        correlationId: ev.correlationId,
        causationId: ev.causationId,
        createdAt: ev.createdAt,
      };
      try {
        const list = [...(this.handlers.get(ev.eventType) ?? []), ...this.anyHandlers];
        for (const handler of list) {
          await handler(envelope);
        }
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
