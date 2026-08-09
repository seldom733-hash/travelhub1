import { Injectable } from "@nestjs/common";
import type { BookingStatus, Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import { DomainEvents, type BookingEventPayload } from "../../eventbus/domain-events";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { BookingQueryService } from "./booking-query.service";

export type BookingAction = "send" | "confirm" | "reject" | "service" | "complete" | "cancel" | "problem";

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
  send: { from: ["NEW", "PREPARING_REQUEST"], to: "SENT_TO_SUPPLIER" },
  confirm: { from: ["SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION"], to: "CONFIRMED" },
  reject: { from: ["SENT_TO_SUPPLIER", "AWAITING_CONFIRMATION"], to: "SUPPLIER_REJECTED" },
  service: { from: ["CONFIRMED"], to: "IN_SERVICE" },
  complete: { from: ["IN_SERVICE"], to: "COMPLETED" },
  cancel: { from: ACTIVE, to: "CANCELLED" },
  problem: { from: ACTIVE, to: "PROBLEM" },
};

const ACTION_LABELS: Record<BookingAction, string> = {
  send: "Запрос отправлен поставщику",
  confirm: "Бронирование подтверждено",
  reject: "Отклонено поставщиком",
  service: "Услуга началась",
  complete: "Бронирование завершено",
  cancel: "Бронирование отменено",
  problem: "Бронирование помечено проблемным",
};

/**
 * Booking Center — единственный владелец Booking/Reservation/SupplierConfirmation/Passenger.
 * Booking создаётся ТОЛЬКО consumer-ом BookingRequested (никакого POST /bookings).
 * Публикует: BookingConfirmed, BookingRejected, BookingCancelled, BookingStatusChanged.
 */
@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly query: BookingQueryService,
  ) {}

  async listBookings(query: { status?: string; orderId?: string; search?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.BookingWhereInput = {
      ...(query.status ? { status: query.status as BookingStatus } : {}),
      ...(query.orderId ? { orderId: query.orderId } : {}),
      ...(query.search ? { OR: [{ code: { contains: query.search, mode: "insensitive" } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { passengers: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getBooking(id: string, viewer?: import("../../shared/pii").TravelerViewer) {
    return this.query.getById(id, viewer);
  }

  /** Команда жизненного цикла бронирования. */
  async bookingAction(bookingId: string, action: BookingAction, actor?: string) {
    const transition = TRANSITIONS[action];
    if (!transition) throw new ValidationDomainError(`Unknown action: ${action}`);

    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new NotFoundError(`Booking ${bookingId} not found`);
      if (!transition.from.includes(booking.status)) {
        throw new ConflictError(`Cannot ${action} booking ${booking.code} from status ${booking.status}`);
      }

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: transition.to, version: { increment: 1 } },
        select: { id: true, code: true, orderId: true, productId: true, status: true, version: true },
      });

      await tx.bookingHistory.create({
        data: {
          bookingId,
          action,
          from: booking.status,
          to: transition.to,
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: ACTION_LABELS[action],
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
