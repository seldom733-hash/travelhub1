import { Injectable } from "@nestjs/common";
import type { BookingStatus, OrderStatus, Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type BookingEventPayload } from "../../eventbus/domain-events";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { BookingQueryService } from "./booking-query.service";
import { buildSortClause } from '../../shared/sort';

export type BookingAction =
  | "prepare"
  | "send"
  | "requestClarification"
  | "resume"
  | "confirm"
  | "reject"
  | "service"
  | "requestChange"
  | "resolveChange"
  | "requestCancellation"
  | "complete"
  | "cancel"
  | "problem";

/**
 * Step 2.9 — canonical Booking lifecycle (Screen Design codes verbatim: NEW,
 * PREPARING_REQUEST, SENT_TO_SUPPLIER, AWAITING_CONFIRMATION, CONFIRMED,
 * IN_SERVICE, COMPLETED, NEEDS_CLARIFICATION, SUPPLIER_REJECTED,
 * CHANGE_REQUESTED, CANCELLATION_REQUESTED, CANCELLED, PROBLEM).
 *
 * Терминальные: SUPPLIER_REJECTED, COMPLETED, CANCELLED (не reopen-аются).
 * AWAITING_CONFIRMATION — резервный код без producer-а (legacy-источник для
 * confirm/reject; как READY_TO_CLOSE в Order). NEEDS_CLARIFICATION /
 * CHANGE_REQUESTED / CANCELLATION_REQUESTED — operational marker-состояния
 * (screen queues), НЕ меняют frozen money/acquisition/service occurrence.
 */
const ACTIVE: BookingStatus[] = [
  "NEW",
  "PREPARING_REQUEST",
  "SENT_TO_SUPPLIER",
  "AWAITING_CONFIRMATION",
  "CONFIRMED",
  "IN_SERVICE",
  "NEEDS_CLARIFICATION",
  "CHANGE_REQUESTED",
  "CANCELLATION_REQUESTED",
  "PROBLEM",
];

const TRANSITIONS: Record<BookingAction, { from: BookingStatus[]; to: BookingStatus }> = {
  prepare: { from: ["NEW"], to: "PREPARING_REQUEST" },
  send: { from: ["NEW", "PREPARING_REQUEST"], to: "SENT_TO_SUPPLIER" },
  requestClarification: { from: ["SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION"], to: "NEEDS_CLARIFICATION" },
  resume: { from: ["NEEDS_CLARIFICATION"], to: "SENT_TO_SUPPLIER" },
  confirm: { from: ["SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION"], to: "CONFIRMED" },
  reject: { from: ["SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION"], to: "SUPPLIER_REJECTED" },
  service: { from: ["CONFIRMED"], to: "IN_SERVICE" },
  requestChange: { from: ["CONFIRMED", "IN_SERVICE"], to: "CHANGE_REQUESTED" },
  resolveChange: { from: ["CHANGE_REQUESTED"], to: "CONFIRMED" },
  requestCancellation: { from: ["CONFIRMED", "IN_SERVICE", "CHANGE_REQUESTED", "NEEDS_CLARIFICATION"], to: "CANCELLATION_REQUESTED" },
  complete: { from: ["IN_SERVICE"], to: "COMPLETED" },
  cancel: { from: ACTIVE, to: "CANCELLED" },
  // STRICT REVIEW FIX (2.9 §28): problem НЕ является самопереходом (как Order
  // `problem` — исключает PROBLEM): повторный problem с PROBLEM → 409, без
  // шумной self-transition history/события.
  problem: { from: ACTIVE.filter((s) => s !== "PROBLEM"), to: "PROBLEM" },
};

/**
 * STRICT REVIEW FIX (2.9 §14/§28): терминальные состояния Order, при которых
 * lifecycle-команда Booking бессмысленна/запрещена. Инвариант Step 2.9 §15:
 * «нет активной Booking под отменённым/закрытым заказом». `cancel` разрешён
 * (сходится к терминальному состоянию — безопасный valve), остальные команды
 * (в т.ч. confirm/reject/service/complete/change/clarification) — 409.
 * Cross-domain READ (ADR-0001) — Order таблицы не пишутся.
 */
const ORDER_TERMINAL_GUARD: OrderStatus[] = ["CANCELLED", "CLOSED"];

const ACTION_LABELS: Record<BookingAction, string> = {
  prepare: "Запрос готовится к отправке поставщику",
  send: "Запрос отправлен поставщику",
  requestClarification: "Запрошено уточнение у поставщика",
  resume: "Обработка возобновлена после уточнения",
  confirm: "Бронирование подтверждено",
  reject: "Отклонено поставщиком",
  service: "Услуга началась",
  requestChange: "Запрошено изменение бронирования",
  resolveChange: "Изменение обработано, бронирование продолжается",
  requestCancellation: "Запрошена отмена бронирования",
  complete: "Бронирование завершено",
  cancel: "Бронирование отменено",
  problem: "Бронирование помечено проблемным",
};

/**
 * Booking Center — единственный владелец Booking/Reservation/SupplierConfirmation/Passenger.
 * Booking создаётся ТОЛЬКО consumer-ом BookingRequested (никакого POST /bookings).
 * Публикует: BookingConfirmed, BookingRejected, BookingCancelled, BookingCompleted,
 * BookingStatusChanged (технические переходы).
 * Step 2.9: единственная state-machine authority (HARD GATE) — контроллеры и
 * consumer-ы НЕ реализуют независимые переходы; compensation-консьюмер
 * OrderCancelled использует те же guards/CAS (см. booking.subscribers.ts).
 */
const BOOKING_SORT_ALLOWLIST: Record<string, string> = {
  code: 'code',
  createdAt: 'createdAt',
  amount: 'amount',
  status: 'status',
  serviceDate: 'serviceDate',
};

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly query: BookingQueryService,
  ) {}

  /**
   * Resolve search term to matching booking IDs.
   * Searches: booking code, passenger name, order number.
   * Cross-schema references use separate queries (ADR-0001).
   */
  private async resolveBookingSearchIds(search: string): Promise<string[]> {
    const s = search.trim();
    if (!s) return [];
    const bookingIds = new Set<string>();
    // 1) Match booking code
    const byCode = await (this.prisma as any).booking.findMany({ where: { code: { contains: s, mode: "insensitive" } }, select: { id: true } });
    for (const r of byCode) bookingIds.add(r.id);
    // 2) Match traveler/passenger names → find orderIds → find bookings
    const travelers = await (this.prisma as any).orderTraveler.findMany({ where: { OR: [{ firstName: { contains: s, mode: "insensitive" } }, { lastName: { contains: s, mode: "insensitive" } }] }, select: { orderId: true } });
    const orderIds = new Set<string>();
    for (const t of travelers) { if (t.orderId) orderIds.add(t.orderId); }
    // 3) Match order number
    const orders = await (this.prisma as any).order.findMany({ where: { number: { contains: s, mode: "insensitive" } }, select: { id: true } });
    for (const o of orders) orderIds.add(o.id);
    // 4) Find bookings by matching order IDs
    if (orderIds.size > 0) {
      const byOrder = await (this.prisma as any).booking.findMany({ where: { orderId: { in: [...orderIds] } }, select: { id: true } });
      for (const b of byOrder) bookingIds.add(b.id);
    }
    return [...bookingIds];
  }

  async listBookings(query: { status?: string; orderId?: string; search?: string; upcoming?: string; overdue?: string; slaMinutes?: string; sortBy?: string; sortDirection?: string; page?: number; pageSize?: number; dateFrom?: string; dateTo?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const now = new Date();
    const where: Prisma.BookingWhereInput = {
      ...(query.status ? { status: query.status as BookingStatus } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.search ? { id: { in: await this.resolveBookingSearchIds(query.search) } } : {}),
      // ROUND 5: upcoming=true → detector: status IN (CONFIRMED, NEW) AND serviceDate >= now
      ...(query.upcoming === "true" ? {
        status: { in: ["CONFIRMED", "NEW"] as BookingStatus[] },
        serviceDate: { gte: now },
      } : {}),
      // ROUND 5: overdue=true → detector: status = AWAITING_CONFIRMATION AND createdAt < (now - SLA)
      ...(query.overdue === "true" ? {
        status: "AWAITING_CONFIRMATION" as BookingStatus,
        createdAt: { lt: new Date(Date.now() - (parseInt(query.slaMinutes ?? "240", 10)) * 60 * 1000) },
      } : {}),
    };
    // R5-04: Date range filtering on createdAt (exclusive end — consistent with Analytics half-open [from, to))
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lt: new Date(query.dateTo) } : {}),
      };
    }
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: buildSortClause(query.sortBy, query.sortDirection, BOOKING_SORT_ALLOWLIST, { createdAt: 'desc' }),
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { passengers: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.booking.count({ where }),
    ]);
    // KPI aggregates
    const [countAwaiting, countConfirmed, countCancelled] = await Promise.all([
      this.prisma.booking.count({ where: { ...where, status: { in: ['SENT_TO_SUPPLIER', 'AWAITING_CONFIRMATION'] as any } } }),
      this.prisma.booking.count({ where: { ...where, status: { in: ['CONFIRMED', 'IN_SERVICE', 'COMPLETED'] as any } } }),
      this.prisma.booking.count({ where: { ...where, status: { in: ['CANCELLED', 'SUPPLIER_REJECTED'] as any } } }),
    ]);
    return { items, total, page, pageSize, aggregates: { awaiting: countAwaiting, confirmed: countConfirmed, cancelled: countCancelled } };
  }

  async getBooking(id: string, viewer?: import("../../shared/pii").TravelerViewer) {
    return this.query.getById(id, viewer);
  }

  /** Команда жизненного цикла бронирования. */
  async bookingAction(bookingId: string, action: BookingAction, actor?: string, reason?: string | null) {
    const transition = TRANSITIONS[action];
    if (!transition) throw new ValidationDomainError(`Unknown action: ${action}`);

    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new NotFoundError(`Booking ${bookingId} not found`);
      if (!transition.from.includes(booking.status)) {
        throw new ConflictError(`Cannot ${action} booking ${booking.code} from status ${booking.status}`);
      }

      // STRICT REVIEW FIX (2.9 §14/§28): lifecycle-команда не может «ожить»
      // бронь отменённого/закрытого заказа (инвариант §15). Читаем статус Order
      // (READ-only, ADR-0001) — если заказ терминален, команды (кроме cancel)
      // отклоняются 409. Это закрывает compensation-vs-command race детерминированно
      // для последовательного сценария (staff подтверждает бронь уже отменённого
      // заказа → 409, а не «confirm после cancel»).
      if (action !== "cancel") {
        const order = await tx.order.findUnique({
          where: { id: booking.orderId },
          select: { code: true, status: true },
        });
        if (order && ORDER_TERMINAL_GUARD.includes(order.status)) {
          throw new ConflictError(
            `Cannot ${action} booking ${booking.code}: order ${order.code} is ${order.status}`,
          );
        }
      }

      // Step 2.9 §23: optimistic concurrency (как Order, Step 1.14 §19) — переход
      // применяется только если status/version не изменились с момента чтения.
      // Concurrent/retry одного перехода → ровно ОДИН победитель; остальные —
      // контролируемый ConflictError (409), без duplicate history/event.
      //
      // Step 2.9A: canonical lifecycle milestone — первый переход только
      // (first-only через `?? now`), атомарно с CAS. Только реальные переходы:
      //  - send/resume → requestedAt (запрос отправлен поставщику);
      //  - confirm → confirmedAt; reject → rejectedAt; cancel → cancelledAt;
      //    complete → completedAt.
      // Один `now` на логический переход (единый серверный источник времени §15).
      const milestoneNow = new Date();
      const milestone: Prisma.BookingUpdateManyMutationInput = {};
      if (action === "send" || action === "resume") milestone.requestedAt = booking.requestedAt ?? milestoneNow;
      else if (action === "confirm") milestone.confirmedAt = booking.confirmedAt ?? milestoneNow;
      else if (action === "reject") milestone.rejectedAt = booking.rejectedAt ?? milestoneNow;
      else if (action === "cancel") milestone.cancelledAt = booking.cancelledAt ?? milestoneNow;
      else if (action === "complete") milestone.completedAt = booking.completedAt ?? milestoneNow;

      const updatedRows = await tx.booking.updateMany({
        where: { id: bookingId, status: booking.status, version: booking.version },
        data: { status: transition.to, version: { increment: 1 }, ...milestone },
      });
      if (updatedRows.count !== 1) {
        throw new ConflictError(`Booking ${booking.code} was concurrently modified; retry transition ${action}`);
      }
      const updated = { ...booking, status: transition.to as BookingStatus, version: booking.version + 1 };

      await tx.bookingHistory.create({
        data: {
          bookingId,
          action,
          from: booking.status,
          to: transition.to,
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: reason ? `${ACTION_LABELS[action]}: ${reason}` : ACTION_LABELS[action],
        },
      });

      // Step 1.15: correlation/causation НЕ указываются явно — они наследуются
      // из request context (correlation = requestId HTTP-команды, causation = null).
      // НЕ используем business-код (Order.code/Booking.code) как correlationId.
      switch (action) {
        case "confirm": {
          await this.eventBus.emit(tx, {
            aggregateType: "Booking",
            aggregateId: bookingId,
            eventType: DomainEvents.BookingConfirmed,
            payload: {
              bookingId,
              code: booking.code,
              orderId: booking.orderId,
              productId: booking.productId,
            } as BookingEventPayload,
          });
          break;
        }
        case "reject": {
          await this.eventBus.emit(tx, {
            aggregateType: "Booking",
            aggregateId: bookingId,
            eventType: DomainEvents.BookingRejected,
            payload: {
              bookingId,
              code: booking.code,
              orderId: booking.orderId,
              productId: booking.productId,
              reason: "Поставщик отклонил запрос",
            } as BookingEventPayload,
          });
          break;
        }
        case "cancel": {
          await this.eventBus.emit(tx, {
            aggregateType: "Booking",
            aggregateId: bookingId,
            eventType: DomainEvents.BookingCancelled,
            payload: {
              bookingId,
              code: booking.code,
              orderId: booking.orderId,
              productId: booking.productId,
            } as BookingEventPayload,
          });
          break;
        }
        case "complete": {
          // Step 2.9 §17: canonical fulfillment факт — ровно одно BookingCompleted
          // на реальный complete (retry/concurrent → CAS не даёт повторного перехода).
          // BookingStatusChanged (технический) остаётся — существующий approved
          // consumer-контракт Order reconcile (2.5A) полагается на него; вместе
          // они пишутся атомарно в одной транзакции (state + history + outbox).
          await this.eventBus.emit(tx, {
            aggregateType: "Booking",
            aggregateId: bookingId,
            eventType: DomainEvents.BookingCompleted,
            payload: {
              bookingId,
              code: booking.code,
              orderId: booking.orderId,
              productId: booking.productId,
            } as BookingEventPayload,
          });
          await this.eventBus.emit(tx, {
            aggregateType: "Booking",
            aggregateId: bookingId,
            eventType: DomainEvents.BookingStatusChanged,
            payload: {
              from: booking.status,
              to: transition.to,
              actor,
              bookingId,
              orderId: booking.orderId,
              code: booking.code,
            } as Prisma.InputJsonValue,
          });
          break;
        }
        default: {
          await this.eventBus.emit(tx, {
            aggregateType: "Booking",
            aggregateId: bookingId,
            eventType: DomainEvents.BookingStatusChanged,
            payload: {
              from: booking.status,
              to: transition.to,
              actor,
              bookingId,
              orderId: booking.orderId,
              code: booking.code,
            } as Prisma.InputJsonValue,
          });
        }
      }

      return updated;
    });

    await this.eventBus.publishPending();
    return result;
  }
}
