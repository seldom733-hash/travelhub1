import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService, type OutboxEnvelope } from "../../eventbus/eventbus.service";
import { DomainEvents, type BookingEventPayload } from "../../eventbus/domain-events";
import { SupplierObligationService } from "./supplier-obligation.service";

const CONSUMER_ID = "supplier-obligation-consumer";

/**
 * UNIFIED FINANCE CENTER Phase 2 — BookingConfirmed → SupplierObligation.
 *
 * Finance-owned consumer (ADR-0001): READ-only cross-context read frozen
 * Booking/Order фактов, НЕ пишет в booking./order.. Идемпотентность — тройная:
 *  1. events.InboxEvent (unique consumerId+eventId) — стандартный dedup;
 *  2. domain unique SupplierObligation.bookingId — одна obligation на booking
 *     (DB backstop; повторная доставка → no-op, возвращает существующую);
 *  3. P2002 обрабатывается ТОЛЬКО для известных idempotency-unique
 *     (inbox consumerId+eventId, obligation bookingId); иначе → проброс.
 *
 * Fail-closed: Booking/Order отсутствует → отметить обработанным (no-op, как
 * commission-accrual). UNKNOWN AZN (нет snapshot / нет курса для не-AZN) не
 * блокирует создание — хранится как NULL («blocked, never zero»), но блокирует
 * payout до резолюции курса.
 */
@Injectable()
export class SupplierObligationConsumer implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
    private readonly obligations: SupplierObligationService,
  ) {}

  onModuleInit(): void {
    this.eventBus.on(DomainEvents.BookingConfirmed, (ev) => this.onBookingConfirmed(ev));
  }

  private async onBookingConfirmed(ev: OutboxEnvelope): Promise<void> {
    const payload = ev.payload as unknown as BookingEventPayload;
    if (!payload?.bookingId) return;
    if (await this.eventBus.isProcessed(CONSUMER_ID, ev.id)) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER_ID, eventId: ev.id } } })) return;

        // READ-only cross-context (ADR-0001): frozen Booking факты + их Order.
        const booking = await tx.booking.findUnique({
          where: { id: payload.bookingId },
          select: {
            id: true,
            code: true,
            orderId: true,
            orderItemId: true,
            amount: true,
            currency: true,
            confirmedAt: true,
          },
        });
        if (!booking) {
          // Booking отсутствует — отметить обработанным (повторная доставка не
          // создаст вечный retry — как commission-accrual).
          await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
          return;
        }

        const order = await tx.order.findUnique({
          where: { id: booking.orderId },
          select: { id: true, code: true, currency: true, sellerPartnerId: true, commercialSnapshot: true },
        });
        if (!order) {
          await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
          return;
        }

        // currency может быть null (исторические брони) — fallback на snapshot
        // или на order.currency (DEFAULT USD); сумма — замороженный Booking.amount.
        const bookingCurrency = booking.currency ?? order.currency ?? "USD";

        await this.obligations.createObligationForBooking(
          tx,
          {
            bookingId: booking.id,
            bookingCode: booking.code,
            orderId: order.id,
            orderCode: order.code,
            orderItemId: booking.orderItemId,
            bookingAmount: booking.amount,
            bookingCurrency,
            commercialSnapshot: order.commercialSnapshot,
            sellerPartnerId: order.sellerPartnerId,
          },
          { sourceEventId: ev.id, confirmedAt: booking.confirmedAt },
        );

        await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
      });
    } catch (err) {
      if (this.isIdempotencyUniqueViolation(err)) return;
      throw err;
    }
  }

  /** P2002 именно по idempotency-constraint-ам (по meta.target, не глобально). */
  private isIdempotencyUniqueViolation(err: unknown): boolean {
    if (typeof err !== "object" || err === null) return false;
    const e = err as { code?: string; meta?: { target?: unknown } };
    if (e.code !== "P2002") return false;
    const target = Array.isArray(e.meta?.target) ? (e.meta.target as string[]) : [];
    if (target.includes("bookingId")) return true; // одна obligation на booking
    return target.includes("consumerId") && target.includes("eventId"); // inbox
  }
}
