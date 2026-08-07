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
        await this.reconcileOrder(tx, p.orderId, ev.id, `BookingConfirmed (${p.code})`);
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
        await this.reconcileOrder(tx, p.orderId!, ev.id, `BookingStatusChanged → ${p.to} (${p.code ?? p.bookingId})`);
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

        await tx.order.update({
          where: { id: order.id },
          data: { status: "PROBLEM", version: { increment: 1 } },
        });
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
        await this.eventBus.emitResult(tx, {
          aggregateType: "Order",
          aggregateId: order.id,
          eventType: DomainEvents.OrderStatusChanged,
          payload: { from: order.status, to: "PROBLEM", reason: "BookingRejected", bookingCode: p.code },
          correlationId: order.code,
          causationId: ev.id,
        });

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
      await tx.order.update({
        where: { id: orderId },
        data: { status: target, version: { increment: 1 } },
      });
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
      await this.eventBus.emitResult(tx, {
        aggregateType: "Order",
        aggregateId: orderId,
        eventType: DomainEvents.OrderStatusChanged,
        payload: { from: order.status, to: target, reason },
        correlationId: order.code,
        causationId: eventId,
      });
    }
  }

  private isUniqueViolation(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
  }
}
