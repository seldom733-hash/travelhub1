/**
 * TEST-ONLY FIXTURE — создание Order-графа для downstream e2e (Step 2.6 §29).
 *
 * Step 2.6 удалил production-путь POST /orders/bootstrap. Тестам, которым нужен
 * Order как SETUP (lifecycle / booking / envelope / audit / security-регрессии),
 * канонический путь Quote → Checkout → Sale → OrderRequested избыточен и не
 * является целью таких suite — поэтому используется ЯВНЫЙ test-only helper.
 *
 * Инварианты сохранены (НЕ ослаблены для production):
 *  - helper НЕ регистрируется в production (только backend/test/fixtures);
 *  - НЕ является HTTP-эндпоинтом — никакого клиентского пути создания;
 *  - коды ORD-* / TH-* — server-owned (IdsService, атомарный счётчик);
 *  - submittedAt — server-owned milestone (момент создания);
 *  - acquisitionSource = DIRECT (server-assisted entry, как у канонического
 *    bootstrap/Checkout foundation);
 *  - OrderCreated result-event пишется атомарно в той же транзакции;
 *  - frozen money — Decimal, без float.
 *
 * Форма результата повторяет прежний bootstrap-ответ, чтобы suite могли
 * мигрировать без изменения проверок.
 */

import type { Prisma } from "../../src/generated/prisma/client";
import type { PrismaService } from "../../src/prisma/prisma.service";
import type { IdsService } from "../../src/shared/ids.service";
import type { EventBusService } from "../../src/eventbus/eventbus.service";
import { DomainEvents, type BusinessEventActor, type OrderEventPayload } from "../../src/eventbus/domain-events";
import { SalesAcquisitionSource } from "../../src/generated/prisma/enums";
import { ValidationDomainError } from "../../src/shared/errors";

export interface FixtureOrderItemInput {
  productId: string;
  title: string;
  type: string;
  quantity?: number;
  price: number;
  serviceDate?: string;
}

export interface FixtureOrderTravelerInput {
  firstName: string;
  lastName: string;
  birthDate?: string;
  citizenship?: string;
  gender?: string;
  passportNumber?: string;
}

export interface FixtureOrderInput {
  customerId: string | null;
  currency?: string;
  serviceDate?: string;
  /** Step 2.8A: frozen local temporal факты (order-level; verbatim как в
   *  canonical flow). serviceTime/serviceEndTime — local HH:mm; serviceTimeZone —
   *  IANA. Позволяет тестам сидеть direct-Order для downstream Booking-тестов. */
  serviceTime?: string | null;
  serviceEndTime?: string | null;
  serviceTimeZone?: string | null;
  items: FixtureOrderItemInput[];
  travelers?: FixtureOrderTravelerInput[];
  /** Server-owned actor для history (как прежний createdBy). */
  actor?: string | null;
  /** Явный correlationId для OrderCreated (по умолчанию null — вне HTTP context). */
  correlationId?: string | null;
  /** Явный actor для OrderCreated-события (по умолчанию null — вне HTTP context). */
  eventActor?: BusinessEventActor | null;
  /** Server-owned acquisitionSource (Step 2.5B). DEFAULT: DIRECT (server-assisted
   *  entry). Тесты STRICT REVIEW 2.7 используют BUYER_REQUEST (non-DIRECT
   *  immutability) и null (legacy Order, nullable acquisition исторически). */
  acquisitionSource?: SalesAcquisitionSource | null;
}

export interface FixtureOrderResult {
  order: {
    id: string;
    code: string;
    number: string;
    customerId: string | null;
    status: string;
    amount: string;
    currency: string;
  };
  eventId: string;
}

export async function createFixtureOrder(
  prisma: PrismaService,
  ids: IdsService,
  eventBus: EventBusService,
  input: FixtureOrderInput,
): Promise<FixtureOrderResult> {
  if (!input.items.length) throw new ValidationDomainError("Order must contain at least one item");
  const currency = input.currency ?? "USD";
  const amount = input.items.reduce((sum, i) => sum + i.price * (i.quantity ?? 1), 0);
  const actor = input.actor ?? null;

  const result = await prisma.$transaction(async (tx) => {
    const code = await ids.nextCode(tx, "ORD");
    const number = await ids.nextOrderNumber(tx);
    const submittedAt = new Date();
    // Step 3.12 — test fixture reference number
    const referenceNumber = `MKT-ORD-${String(Math.floor(Math.random() * 999999) + 1).padStart(6, "0")}`;

    const order = await tx.order.create({
      data: {
        code,
        number,
        referenceNumber,
        customerId: input.customerId,
        status: "NEW",
        paymentStatus: "UNPAID",
        currency,
        amount,
        paidAmount: 0,
        serviceDate: input.serviceDate ? new Date(input.serviceDate) : null,
        serviceTime: input.serviceTime ?? null,
        serviceEndTime: input.serviceEndTime ?? null,
        serviceTimeZone: input.serviceTimeZone ?? null,
        version: 1,
        submittedAt,
        acquisitionSource: input.acquisitionSource !== undefined ? input.acquisitionSource : SalesAcquisitionSource.DIRECT,
        createdBy: actor,
        updatedBy: actor,
      },
      select: { id: true, code: true, number: true, customerId: true, status: true, amount: true, currency: true },
    });

    // Канонические коды продуктов (READ-only, как прежний bootstrap).
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

    await tx.fulfillment.create({ data: { orderId: order.id, status: "NOT_STARTED", notes: null } });

    await tx.orderHistory.create({
      data: {
        orderId: order.id,
        action: "created",
        to: "NEW",
        actorId: actor,
        actorName: actor,
        comment: "Заказ создан (test fixture, Step 2.6)",
      },
    });

    // OrderCreated result-event атомарно с Order (correlation — явный или null).
    const eventId = await eventBus.emit(tx, {
      aggregateType: "Order",
      aggregateId: order.id,
      eventType: DomainEvents.OrderCreated,
      correlationId: input.correlationId !== undefined ? input.correlationId : null,
      actor: input.eventActor !== undefined ? input.eventActor : null,
      payload: {
        orderId: order.id,
        code: order.code,
        number: order.number,
        customerId: order.customerId,
        amount: order.amount.toString(),
        currency,
      } as OrderEventPayload,
    });

    return { order, eventId };
  });

  await eventBus.publishPending();
  return {
    order: { ...result.order, amount: String(result.order.amount) },
    eventId: result.eventId,
  };
}
