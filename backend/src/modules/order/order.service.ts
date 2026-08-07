import { Injectable } from "@nestjs/common";
import type { Prisma, OrderStatus, OrderTraveler } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import {
  DomainEvents,
  type BookingRequestedPayload,
  type OrderApprovedPayload,
  type OrderEventPayload,
} from "../../eventbus/domain-events";
import { IdsService } from "../../shared/ids.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";

export interface BootstrapOrderInput {
  customerId: string;
  currency?: string;
  serviceDate?: string;
  items: { productId: string; title: string; type: string; quantity?: number; price: number; serviceDate?: string }[];
  travelers?: { firstName: string; lastName: string; birthDate?: string; citizenship?: string; gender?: string; passportNumber?: string }[];
}

export interface TravelerUpdateInput {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  citizenship?: string;
  gender?: string;
  passportNumber?: string;
}

export type OrderAction =
  | "process"
  | "markWaitingData"
  | "resumeProcessing"
  | "confirm"
  | "send"
  | "complete"
  | "close"
  | "cancel"
  | "problem"
  | "suspend";

const ACTIVE_STATUSES: OrderStatus[] = [
  "NEW",
  "IN_PROCESSING",
  "WAITING_FOR_DATA",
  "READY_FOR_BOOKING",
  "SENT_TO_BOOKING",
  "PARTIALLY_FULFILLED",
  "PROBLEM",
  "SUSPENDED",
];

const TRANSITIONS: Record<string, { from: OrderStatus[]; to: OrderStatus }> = {
  process: { from: ["NEW"], to: "IN_PROCESSING" },
  markWaitingData: { from: ["IN_PROCESSING"], to: "WAITING_FOR_DATA" },
  resumeProcessing: { from: ["WAITING_FOR_DATA"], to: "IN_PROCESSING" },
  confirm: { from: ["IN_PROCESSING", "WAITING_FOR_DATA"], to: "READY_FOR_BOOKING" },
  send: { from: ["READY_FOR_BOOKING"], to: "SENT_TO_BOOKING" },
  complete: { from: ["SENT_TO_BOOKING", "PARTIALLY_FULFILLED"], to: "FULFILLED" },
  close: { from: ["FULFILLED", "READY_TO_CLOSE"], to: "CLOSED" },
  cancel: { from: ACTIVE_STATUSES, to: "CANCELLED" },
  problem: { from: ACTIVE_STATUSES.filter((s) => s !== "PROBLEM"), to: "PROBLEM" },
  suspend: { from: ACTIVE_STATUSES.filter((s) => s !== "SUSPENDED"), to: "SUSPENDED" },
};

const ACTION_LABELS: Record<OrderAction, string> = {
  process: "Заказ принят в работу",
  markWaitingData: "Ожидает данных",
  resumeProcessing: "Возобновлена обработка",
  confirm: "Заказ готов к бронированию",
  send: "Передан в Booking Center",
  complete: "Заказ исполнен",
  close: "Заказ закрыт",
  cancel: "Заказ отменён",
  problem: "Заказ помечен проблемным",
  suspend: "Заказ приостановлен",
};

/**
 * Order Center — единственный владелец Order/OrderItem/OrderTraveler/Fulfillment.
 * Не владеет Customer/Product/Booking (только ID-ссылки).
 * Публикует: OrderCreated, OrderApproved, OrderCancelled, BookingRequested.
 * Подписан на: BookingConfirmed, BookingRejected (агрегированное состояние).
 */
@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly eventBus: EventBusService,
  ) {}

  /** Bootstrap creation (Phase 1, временный служебный сценарий до Phase 2 OrderRequested). */
  async bootstrapOrder(input: BootstrapOrderInput, actor?: string) {
    if (!input.items.length) throw new ValidationDomainError("Order must contain at least one item");
    const currency = input.currency ?? "USD";
    const amount = input.items.reduce((sum, i) => sum + i.price * (i.quantity ?? 1), 0);

    const result = await this.prisma.$transaction(async (tx) => {
      const code = await this.ids.nextCode(tx, "ORD");
      const number = await this.ids.nextOrderNumber(tx);

      const order = await tx.order.create({
        data: {
          code,
          number,
          customerId: input.customerId,
          status: "NEW",
          paymentStatus: "UNPAID",
          currency,
          amount,
          paidAmount: 0,
          serviceDate: input.serviceDate ? new Date(input.serviceDate) : null,
          version: 1,
          createdBy: actor ?? null,
          updatedBy: actor ?? null,
        },
        select: { id: true, code: true, number: true, customerId: true, status: true, amount: true, currency: true },
      });

      // Чтение канонических кодов продуктов из Catalog (READ-only, без записи).
      const productCodes = await tx.product.findMany({
        where: { id: { in: input.items.map((i) => i.productId) } },
        select: { id: true, code: true },
      });
      const codeById = new Map(productCodes.map((p) => [p.id, p.code]));

      for (const item of input.items) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            productCode: codeById.get(item.productId) ?? "",
            title: item.title,
            type: item.type,
            quantity: item.quantity ?? 1,
            price: item.price,
            currency,
            amount: item.price * (item.quantity ?? 1),
            serviceDate: item.serviceDate ? new Date(item.serviceDate) : input.serviceDate ? new Date(input.serviceDate) : null,
          },
        });
      }

      for (const t of input.travelers ?? []) {
        await tx.orderTraveler.create({
          data: {
            orderId: order.id,
            customerId: input.customerId,
            firstName: t.firstName,
            lastName: t.lastName,
            birthDate: t.birthDate ? new Date(t.birthDate) : null,
            citizenship: t.citizenship ?? null,
            gender: t.gender ?? null,
            passportNumber: t.passportNumber ?? null,
            dataCompleteness: t.passportNumber ? "COMPLETE" : "INCOMPLETE",
            version: 1,
          },
        });
      }

      // Fulfillment создаётся владельцем Order (статус исполнения заказа).
      await tx.fulfillment.create({ data: { orderId: order.id, status: "NOT_STARTED", notes: null } });

      await tx.orderHistory.create({
        data: {
          orderId: order.id,
          action: "created",
          to: "NEW",
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: "Заказ создан (bootstrap, Phase 1)",
        },
      });

      const eventId = await this.eventBus.emit(tx, {
        aggregateType: "Order",
        aggregateId: order.id,
        eventType: DomainEvents.OrderCreated,
        payload: {
          orderId: order.id,
          code: order.code,
          number: order.number,
          customerId: order.customerId,
          amount: order.amount.toString(),
          currency,
        } as OrderEventPayload,
        correlationId: order.code,
      });

      return { order, eventId };
    });

    await this.eventBus.publishPending();
    return result;
  }

  async listOrders(query: { status?: string; customerId?: string; search?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status as OrderStatus } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.search
        ? { OR: [{ code: { contains: query.search, mode: "insensitive" } }, { number: { contains: query.search, mode: "insensitive" } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { items: true, travelers: true },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        travelers: true,
        fulfillments: true,
        history: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    });
    if (!order) throw new NotFoundError(`Order ${id} not found`);
    return order;
  }

  async updateTravelers(orderId: string, travelers: TravelerUpdateInput[], actor?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true, code: true } });
    if (!order) throw new NotFoundError(`Order ${orderId} not found`);

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.orderTraveler.findMany({ where: { orderId } });
      if (existing.length !== travelers.length) {
        throw new ValidationDomainError(`Expected ${existing.length} travelers, got ${travelers.length}`);
      }

      for (let i = 0; i < existing.length; i++) {
        const t = travelers[i];
        await tx.orderTraveler.update({
          where: { id: existing[i].id },
          data: {
            firstName: t.firstName ?? existing[i].firstName,
            lastName: t.lastName ?? existing[i].lastName,
            birthDate: t.birthDate ? new Date(t.birthDate) : existing[i].birthDate,
            citizenship: t.citizenship ?? existing[i].citizenship,
            gender: t.gender ?? existing[i].gender,
            passportNumber: t.passportNumber ?? existing[i].passportNumber,
            dataCompleteness: t.passportNumber || existing[i].passportNumber ? "COMPLETE" : "INCOMPLETE",
            version: { increment: 1 },
          },
        });
      }

      await tx.orderHistory.create({
        data: {
          orderId,
          action: "update_travelers",
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: "Обновлены данные туристов заказа",
        },
      });
      return tx.orderTraveler.findMany({ where: { orderId } });
    });

    await this.eventBus.publishPending();
    return result;
  }

  /** Команда жизненного цикла (переход статуса). */
  async orderAction(orderId: string, action: OrderAction, actor?: string) {
    const transition = TRANSITIONS[action];
    if (!transition) throw new ValidationDomainError(`Unknown action: ${action}`);

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, travelers: true },
      });
      if (!order) throw new NotFoundError(`Order ${orderId} not found`);
      if (!transition.from.includes(order.status)) {
        throw new ConflictError(`Cannot ${action} order ${order.code} from status ${order.status}`);
      }

      // «Готов к бронированию» требует полные данные туристов (DoD Phase 1).
      if (action === "confirm") {
        const incomplete = order.travelers.filter((t) => t.dataCompleteness !== "COMPLETE");
        if (incomplete.length > 0) {
          throw new ValidationDomainError(
            `Order ${order.code} has ${incomplete.length} traveler(s) without passport data (WAITING_FOR_DATA)`,
          );
        }
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: transition.to, version: { increment: 1 }, updatedBy: actor ?? null },
        select: { id: true, code: true, number: true, customerId: true, status: true, version: true },
      });

      await tx.orderHistory.create({
        data: {
          orderId,
          action,
          from: order.status,
          to: transition.to,
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: ACTION_LABELS[action],
        },
      });

      const meta = { correlationId: order.code, causationId: null as string | null };

      switch (action) {
        case "confirm": {
          await this.eventBus.emit(tx, {
            aggregateType: "Order",
            aggregateId: orderId,
            eventType: DomainEvents.OrderApproved,
            payload: { orderId, code: order.code, customerId: order.customerId } as OrderApprovedPayload,
            ...meta,
          });
          break;
        }
        case "send": {
          const payload: BookingRequestedPayload = {
            orderId,
            orderCode: order.code,
            customerId: order.customerId,
            items: order.items.map((i) => ({
              productId: i.productId,
              productCode: i.productCode,
              title: i.title,
              quantity: i.quantity,
              serviceDate: i.serviceDate?.toISOString() ?? null,
            })),
            travelers: order.travelers.map((t: OrderTraveler) => ({
              firstName: t.firstName,
              lastName: t.lastName,
              birthDate: t.birthDate?.toISOString() ?? null,
              citizenship: t.citizenship ?? null,
              gender: t.gender ?? null,
              passportNumber: t.passportNumber ?? null,
            })),
          };
          await this.eventBus.emit(tx, {
            aggregateType: "Order",
            aggregateId: orderId,
            eventType: DomainEvents.BookingRequested,
            payload,
            ...meta,
          });
          break;
        }
        case "cancel": {
          await this.eventBus.emit(tx, {
            aggregateType: "Order",
            aggregateId: orderId,
            eventType: DomainEvents.OrderCancelled,
            payload: { orderId, code: order.code, customerId: order.customerId } as OrderApprovedPayload,
            ...meta,
          });
          break;
        }
        default: {
          await this.eventBus.emit(tx, {
            aggregateType: "Order",
            aggregateId: orderId,
            eventType: DomainEvents.OrderStatusChanged,
            payload: { from: order.status, to: transition.to, actor } as Prisma.InputJsonValue,
            ...meta,
          });
        }
      }

      return updated;
    });

    await this.eventBus.publishPending();
    return result;
  }
}
