import { Injectable, OnModuleInit } from "@nestjs/common";
import type { OrderStatus, Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService, type OutboxEnvelope } from "../../eventbus/eventbus.service";
import { DomainEvents, type BookingEventPayload } from "../../eventbus/domain-events";
import { BookingQueryService } from "../booking/booking-query.service";

const CONSUMER_ID = "order-booking-consumer";
const TERMINAL_BOOKING = ["COMPLETED", "CANCELLED"];
const CONFIRMED_BOOKING = ["CONFIRMED", "IN_SERVICE", "COMPLETED"];

/**
 * Подписчик Order Center на события Booking Center (Baseline, Phase 1 DoD):
 *  - BookingConfirmed / BookingStatusChanged(→CONFIRMED|COMPLETED) — Order
 *    пересчитывает своё агрегированное состояние (SENT_TO_BOOKING →
 *    PARTIALLY_FULFILLED → FULFILLED);
 *  - BookingRejected — Order помечается PROBLEM.
 *
 * Order НЕ пишет в таблицы Booking — только ЧИТАЕТ их состояние и меняет
 * собственные таблицы (order.*). Идемпотентность — через events.InboxEvent.
 */
@Injectable()
export class OrderSubscribers implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
    private readonly bookingQuery: BookingQueryService,
  ) {}

  onModuleInit(): void {
    this.eventBus.on(DomainEvents.BookingConfirmed, (ev) => this.onBookingConfirmed(ev));
    this.eventBus.on(DomainEvents.BookingRejected, (ev) => this.onBookingRejected(ev));
    this.eventBus.on(DomainEvents.BookingStatusChanged, (ev) => this.onBookingStatusChanged(ev));
  }

  private async onBookingConfirmed(ev: OutboxEnvelope): Promise<void> {
    const p = ev.payload as unknown as BookingEventPayload;
    if (!p?.orderId) return;
    if (await this.eventBus.isProcessed(CONSUMER_ID, ev.id)) return;
    try {
      await this.prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER_ID, eventId: ev.id } } })) return;
        await this.reconcileOrder(tx, p.orderId, ev.id, `BookingConfirmed (${p.code})`, ev.correlationId);
        await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) return;
      throw err;
    }
  }

  private async onBookingStatusChanged(ev: OutboxEnvelope): Promise<void> {
    const p = ev.payload as unknown as { bookingId?: string; orderId?: string; to?: string; code?: string };
    if (!p?.orderId) return;
    // Агрегат интересуют только продвигающие состояния брони.
    if (!CONFIRMED_BOOKING.includes(p.to ?? "")) return;
    if (await this.eventBus.isProcessed(CONSUMER_ID, ev.id)) return;
    try {
      await this.prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER_ID, eventId: ev.id } } })) return;
        await this.reconcileOrder(tx, p.orderId!, ev.id, `BookingStatusChanged → ${p.to} (${p.code ?? p.bookingId})`, ev.correlationId);
        await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) return;
      throw err;
    }
  }

  private async onBookingRejected(ev: OutboxEnvelope): Promise<void> {
    const p = ev.payload as unknown as BookingEventPayload;
    if (!p?.orderId) return;
    if (await this.eventBus.isProcessed(CONSUMER_ID, ev.id)) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER_ID, eventId: ev.id } } })) return;

        const order = await tx.order.findUnique({ where: { id: p.orderId } });
        if (!order || ["CLOSED", "CANCELLED", "PROBLEM", "FULFILLED"].includes(order.status)) {
          await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
          return;
        }

        // REVIEW FIX (Step 1.14 §12): CAS — два конкурентных BookingRejected
        // (или reconcile/complete в этот же момент) не создают две записи
        // PROBLEM/истории/события — ровно один победитель.
        // Намеренная семантика: если между чтением и update заказ конкурентно
        // ушёл в FULFILLED/CLOSED (CAS проиграл) — reject НЕ затирает
        // каноническое состояние (факт уже зафиксирован победителем).
        const updatedRows = await tx.order.updateMany({
          where: { id: order.id, status: order.status, version: order.version },
          data: { status: "PROBLEM", version: { increment: 1 } },
        });
        if (updatedRows.count === 1) {
          await tx.orderHistory.create({
            data: {
              orderId: order.id,
              action: "booking_rejected",
              from: order.status,
              to: "PROBLEM",
              actorId: null,
              actorName: "Система",
              comment: `Бронирование отклонено (${p.code}): ${p.reason ?? "нет причины"}`,
            },
          });
          // Step 1.15: correlation наследуется (контекст consumer-а уже несёт
          // correlationId родительского события, causationId = ev.id) — business
          // код заказа НЕ используется как correlationId.
          await this.eventBus.emitResult(tx, {
            aggregateType: "Order",
            aggregateId: order.id,
            eventType: DomainEvents.OrderStatusChanged,
            payload: { from: order.status, to: "PROBLEM", reason: "BookingRejected", bookingCode: p.code },
            correlationId: ev.correlationId,
            causationId: ev.id,
          });
        }

        // Событие обработано (иначе повторная доставка не создаст side effect).
        await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) return;
      throw err;
    }
  }

  /** Реконсиляция агрегированного состояния заказа по статусам его броней. */
  private async reconcileOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    eventId: string,
    reason: string,
    correlationId: string | null,
  ): Promise<void> {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || ["CLOSED", "CANCELLED", "FULFILLED"].includes(order.status)) return;

    // Чтение состояния броней (READ-only, таблицы booking.*).
    const bookings = await this.bookingQuery.getStatusesByOrderId(tx, orderId);

    let target: OrderStatus | null = null;
    if (["SENT_TO_BOOKING", "PARTIALLY_FULFILLED"].includes(order.status) && bookings.length > 0) {
      const allDone = bookings.every((b) => TERMINAL_BOOKING.includes(b));
      const anyConfirmed = bookings.some((b) => CONFIRMED_BOOKING.includes(b));
      if (allDone) target = "FULFILLED";
      else if (anyConfirmed || order.status === "PARTIALLY_FULFILLED") target = "PARTIALLY_FULFILLED";
    }

    if (target && target !== order.status) {
      // REVIEW FIX (Step 1.14 §12): CAS — переход применяется только если
      // status/version не изменились с момента чтения. Гонка reconcile vs
      // explicit `complete` (или двух reconcile) → ровно ОДИН победитель
      // пишет state+history+canonical event; второй не создаёт duplicate
      // OrderFulfilled (как в orderAction.orderAction).
      const updatedRows = await tx.order.updateMany({
        where: { id: orderId, status: order.status, version: order.version },
        data: { status: target, version: { increment: 1 } },
      });
      if (updatedRows.count !== 1) return; // другой transition уже победил — факт существует

      await tx.orderHistory.create({
        data: {
          orderId,
          action: "booking_confirmed",
          from: order.status,
          to: target,
          actorId: null,
          actorName: "Система",
          comment: `Агрегированное состояние по событию: ${reason}`,
        },
      });
      // Step 1.14: →FULFILLED — canonical OrderFulfilled (fact);
      // →PARTIALLY_FULFILLED — технический OrderStatusChanged (canonical нет).
      const eventType =
        target === "FULFILLED" ? DomainEvents.OrderFulfilled : DomainEvents.OrderStatusChanged;
      const payload =
        target === "FULFILLED"
          ? { orderId, code: order.code, customerId: order.customerId }
          : { from: order.status, to: target, reason };
      // Step 1.15: correlation наследуется из родительского события,
      // causation = parent eventId — business код заказа НЕ используется как correlation.
      await this.eventBus.emitResult(tx, {
        aggregateType: "Order",
        aggregateId: orderId,
        eventType,
        payload,
        correlationId,
        causationId: eventId,
      });
    }
  }

  private isUniqueViolation(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
  }
}
