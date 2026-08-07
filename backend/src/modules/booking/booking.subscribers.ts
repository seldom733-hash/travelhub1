import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService, type OutboxEnvelope } from "../../eventbus/eventbus.service";
import { DomainEvents, type BookingRequestedPayload } from "../../eventbus/domain-events";
import { IdsService } from "../../shared/ids.service";

const CONSUMER_ID = "booking-requested-consumer";

/**
 * Подписчик Booking Center на событие Order: BookingRequested.
 *
 * Booking создаётся ТОЛЬКО из этого события (Baseline §9, Phase 1 DoD):
 *  - на каждый OrderItem создаётся Booking (BKG-*, статус NEW);
 *  - Passenger создаётся из подтверждённых (COMPLETE) OrderTraveler;
 *  - результат фиксируется событием BookingCreated (лента, causationId → BookingRequested).
 *
 * Идемпотентность: events.InboxEvent + проверка существующих броней заказа.
 * Consumer НЕ пишет в таблицы order.* — только читает их (READ-only).
 */
@Injectable()
export class BookingSubscribers implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
  ) {}

  onModuleInit(): void {
    this.eventBus.on(DomainEvents.BookingRequested, (ev) => this.onBookingRequested(ev));
  }

  private async onBookingRequested(ev: OutboxEnvelope): Promise<void> {
    const p = ev.payload as unknown as BookingRequestedPayload;
    if (!p?.orderId) return;
    if (await this.eventBus.isProcessed(CONSUMER_ID, ev.id)) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (await tx.inboxEvent.findUnique({ where: { consumerId_eventId: { consumerId: CONSUMER_ID, eventId: ev.id } } })) return;

        // Чтение состава заказа (READ-only, таблицы order.*).
        const order = await tx.order.findUnique({
          where: { id: p.orderId },
          include: { items: true, travelers: true },
        });
        if (!order || order.items.length === 0) {
          await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
          return;
        }

        // Защита от дублей (дополнительно к inbox): брони уже созданы — пропуск.
        const existing = await tx.booking.count({ where: { orderId: order.id } });
        if (existing > 0) {
          await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
          return;
        }

        const readyTravelers = order.travelers.filter((t) => t.dataCompleteness === "COMPLETE");
        const created: { id: string; code: string }[] = [];

        for (const item of order.items) {
          const code = await this.ids.nextCode(tx, "BKG");
          const booking = await tx.booking.create({
            data: {
              code,
              orderId: order.id,
              productId: item.productId,
              status: "NEW",
              amount: item.amount,
              serviceDate: item.serviceDate ?? order.serviceDate,
              version: 1,
            },
            select: { id: true, code: true },
          });

          await tx.bookingHistory.create({
            data: {
              bookingId: booking.id,
              action: "created",
              to: "NEW",
              actorId: null,
              actorName: "Система",
              comment: "Бронирование создано consumer-ом BookingRequested (Baseline §9)",
            },
          });

          for (const t of readyTravelers) {
            await tx.passenger.create({
              data: {
                bookingId: booking.id,
                firstName: t.firstName,
                lastName: t.lastName,
                birthDate: t.birthDate,
                citizenship: t.citizenship,
                gender: t.gender,
                passportNumber: t.passportNumber,
              },
            });
          }

          created.push({ id: booking.id, code: booking.code });
        }

        // Событие-результат (связь по correlation/causation).
        await this.eventBus.emitResult(tx, {
          aggregateType: "Booking",
          aggregateId: created[0]?.id ?? "",
          eventType: DomainEvents.BookingCreated,
          payload: { count: created.length, bookings: created, orderId: order.id } as PrismaInput,
          correlationId: ev.correlationId ?? order.code,
          causationId: ev.id,
        });

        await tx.inboxEvent.create({ data: { consumerId: CONSUMER_ID, eventId: ev.id } });
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) return; // параллельная обработка — уже обработано
      throw err;
    }
  }

  private isUniqueViolation(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
  }
}

type PrismaInput = Record<string, unknown>;
