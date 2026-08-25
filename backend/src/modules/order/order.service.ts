import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import type { OrderStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { EventBusService } from "../../eventbus/eventbus.service";
import {
  DomainEvents,
  type BookingRequestedPayload,
  type OrderEventPayload,
  type OrderRefPayload,
  type OrderRequestedPayload,
} from "../../eventbus/domain-events";
import { IdsService } from "../../shared/ids.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { redactTravelersPii, type TravelerViewer } from "../../shared/pii";
import { isDateOnly } from "../../shared/date-only";
import { isIanaTimeZone, isLocalTime } from "../../shared/service-time";
import { PaymentPrepaymentType, PaymentScheme, QuoteDiscountType, SalesAcquisitionSource } from "../../generated/prisma/enums";

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
 * Step 2.5 — строгая валидация OrderRequested payload (PURE).
 *
 * Consumer НЕ создаёт Order из malformed/unsupported события: невалидный
 * payload → ValidationDomainError → транзакция откатывается (никакого
 * partial Order graph), событие FAILED (retryable → poison после max попыток —
 * честно: это дефект ленты).
 */
export function assertValidOrderRequestedPayload(p: unknown): asserts p is OrderRequestedPayload {
  if (p === null || typeof p !== "object") {
    throw new ValidationDomainError("OrderRequested payload is not an object");
  }
  const x = p as Partial<OrderRequestedPayload>;
  if (x.version !== 1) {
    throw new ValidationDomainError(`OrderRequested payload version ${String(x.version)} is not supported`);
  }
  for (const f of ["saleId", "saleCode", "checkoutId", "checkoutCode", "quoteId"] as const) {
    if (typeof x[f] !== "string" || (x[f] as string).trim().length === 0) {
      throw new ValidationDomainError(`OrderRequested payload is missing ${f}`);
    }
  }
  if (x.customerId !== null && x.customerId !== undefined && (typeof x.customerId !== "string" || x.customerId.trim().length === 0)) {
    throw new ValidationDomainError("OrderRequested payload customerId is invalid");
  }
  if (!Array.isArray(x.reservationIds)) {
    throw new ValidationDomainError("OrderRequested payload reservationIds must be an array");
  }
  for (const rid of x.reservationIds) {
    if (typeof rid !== "string" || rid.trim().length === 0) {
      throw new ValidationDomainError("OrderRequested payload reservationIds contains an invalid ref");
    }
  }
  if (!Array.isArray(x.items) || x.items.length === 0) {
    throw new ValidationDomainError("OrderRequested payload items must be a non-empty array");
  }
  // Инвариант версии 1: ОДИН hold на item (Step 2.4 резервирует все items
  // атомарно). Несоответствие = противоречивые durable-данные → отклоняются
  // (не копятся в Order как потерянный ref).
  if (x.reservationIds.length !== x.items.length) {
    throw new ValidationDomainError("OrderRequested payload reservationIds count must match items count (one hold per item)");
  }
  for (const [i, it] of x.items.entries()) {
    if (it === null || typeof it !== "object") {
      throw new ValidationDomainError(`OrderRequested item[${i}] is invalid`);
    }
    const item = it as Record<string, unknown>;
    for (const f of ["productId", "productCode", "productTitle", "productType", "tariffId", "tariffCode"] as const) {
      if (typeof item[f] !== "string" || (item[f] as string).trim().length === 0) {
        throw new ValidationDomainError(`OrderRequested item[${i}] is missing ${f}`);
      }
    }
    if (typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new ValidationDomainError(`OrderRequested item[${i}] quantity must be a positive integer`);
    }
    assertOrderMoney(item.unitPrice as string | null | undefined, `item[${i}].unitPrice`);
    assertOrderMoney(item.amount as string | null | undefined, `item[${i}].amount`);
  }
  if (typeof x.currency !== "string" || x.currency.trim().length === 0) {
    throw new ValidationDomainError("OrderRequested payload currency is missing");
  }
  // subtotal/total — обязательные поля контракта (OrderRequestedPayload):
  // строго строки (assertOrderMoney допускает null для опциональных полей).
  if (typeof x.subtotal !== "string" || x.subtotal.trim().length === 0) {
    throw new ValidationDomainError("OrderRequested payload subtotal is missing");
  }
  assertOrderMoney(x.subtotal, "subtotal");
  if (typeof x.total !== "string" || x.total.trim().length === 0) {
    throw new ValidationDomainError("OrderRequested payload total is missing");
  }
  assertOrderMoney(x.total, "total");
  // Known-value whitelists (STRICT REVIEW 2.5): snapshot-поля, на которые
  // downstream полагается как на классификацию — unknown значения отклоняются
  // (не копятся в Order как мусор). Значения берутся из канонических enum-ов
  // (без drift-риска строковых дубликатов).
  if (!(Object.values(QuoteDiscountType) as string[]).includes(x.discountType as string)) {
    throw new ValidationDomainError(`OrderRequested payload discountType ${String(x.discountType)} is not supported`);
  }
  if (
    x.paymentScheme !== null &&
    x.paymentScheme !== undefined &&
    !(Object.values(PaymentScheme) as string[]).includes(x.paymentScheme as string)
  ) {
    throw new ValidationDomainError(`OrderRequested payload paymentScheme ${String(x.paymentScheme)} is not supported`);
  }
  if (
    x.prepaymentType !== null &&
    x.prepaymentType !== undefined &&
    !(Object.values(PaymentPrepaymentType) as string[]).includes(x.prepaymentType as string)
  ) {
    throw new ValidationDomainError(`OrderRequested payload prepaymentType ${String(x.prepaymentType)} is not supported`);
  }
  for (const f of ["discountValue", "discountAmount", "prepaymentValue", "initialAmount", "remainingAmount"] as const) {
    assertOrderMoney(x[f] as string | null | undefined, f);
  }
  if (!(Object.values(SalesAcquisitionSource) as string[]).includes(x.acquisitionSource as string)) {
    throw new ValidationDomainError(`OrderRequested payload acquisitionSource ${String(x.acquisitionSource)} is not supported`);
  }
  if (x.serviceDate !== null && x.serviceDate !== undefined) {
    // Реальная календарная дата (YYYY-MM-DD) — канонический isDateOnly из
    // src/shared (round-trip): 2026-02-29/2026-13-01/2026-04-31 НЕ проходят.
    if (typeof x.serviceDate !== "string" || !isDateOnly(x.serviceDate as string)) {
      throw new ValidationDomainError("OrderRequested payload serviceDate is invalid");
    }
  }
  // Step 2.8A: local temporal факты (additive; null/undefined = date-only).
  // Инварианты: time требует valid IANA zone (authority §8); endTime требует
  // time; zone без time — легально (продукт с zone, покупатель не выбрал время).
  const st = x.serviceTime as string | null | undefined;
  const et = x.serviceEndTime as string | null | undefined;
  const tz = x.serviceTimeZone as string | null | undefined;
  if (st !== null && st !== undefined) {
    if (typeof st !== "string" || !isLocalTime(st)) {
      throw new ValidationDomainError("OrderRequested payload serviceTime is invalid (HH:mm)");
    }
    if (tz === null || tz === undefined || typeof tz !== "string" || !isIanaTimeZone(tz)) {
      throw new ValidationDomainError("OrderRequested payload serviceTime requires a valid IANA serviceTimeZone");
    }
    // STRICT REVIEW 2.8A fix: локальное время без календарной даты — противоречивый
    // occurrence-факт (Booking НЕ может вывести instant; OPEN_DATE+time бессмыслен).
    if (x.serviceDate === null || x.serviceDate === undefined) {
      throw new ValidationDomainError("OrderRequested payload serviceTime requires serviceDate");
    }
  }
  if (et !== null && et !== undefined) {
    if (typeof et !== "string" || !isLocalTime(et)) {
      throw new ValidationDomainError("OrderRequested payload serviceEndTime is invalid (HH:mm)");
    }
    if (st === null || st === undefined) {
      throw new ValidationDomainError("OrderRequested payload serviceEndTime requires serviceTime");
    }
  }
  if (tz !== null && tz !== undefined && (typeof tz !== "string" || !isIanaTimeZone(tz))) {
    throw new ValidationDomainError("OrderRequested payload serviceTimeZone is not a valid IANA timezone");
  }
  // Step 2.12E (ADR-0013 D7/D14): frozen commission контекст — additive,
  // v1-совместим. Снапшот переносится verbatim (глубокая валидация формы —
  // Finance producer при признании accrual, единый authority). Здесь — только
  // базовый shape-guard против мусора в durable payload.
  if (x.commissionSnapshot !== null && x.commissionSnapshot !== undefined && typeof x.commissionSnapshot !== "object") {
    throw new ValidationDomainError("OrderRequested payload commissionSnapshot must be an object or null");
  }
  if (
    x.sellerPartnerId !== null &&
    x.sellerPartnerId !== undefined &&
    (typeof x.sellerPartnerId !== "string" || x.sellerPartnerId.trim().length === 0)
  ) {
    throw new ValidationDomainError("OrderRequested payload sellerPartnerId is invalid");
  }
}

/** Money-проверка frozen snapshot: string, parseable Decimal, >= 0. NULL/undefined — ок. */
function assertOrderMoney(v: string | null | undefined, label: string): void {
  if (v === null || v === undefined) return;
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new ValidationDomainError(`OrderRequested payload ${label} is invalid`);
  }
  let d: Prisma.Decimal;
  try {
    d = new Prisma.Decimal(v);
  } catch {
    throw new ValidationDomainError(`OrderRequested payload ${label} is not a valid amount`);
  }
  if (d.isNegative()) {
    throw new ValidationDomainError(`OrderRequested payload ${label} must be >= 0`);
  }
}

/**
 * Order Center — единственный владелец Order/OrderItem/OrderTraveler/Fulfillment.
 * Не владеет Customer/Product/Booking (только ID-ссылки).
 * Публикует (Step 1.14 canonical): OrderCreated, OrderReadyForBooking (confirm),
 * OrderFulfilled (complete/reconcile), OrderClosed (close), OrderCancelled (cancel),
 * BookingRequested (send, command), OrderStatusChanged (только технические переходы).
 * Подписан на: BookingConfirmed, BookingRejected (агрегированное состояние).
 */
@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ids: IdsService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Step 2.5 — canonical Order creation из OrderRequested (domain-owned logic).
   *
   * Вызывается OrderRequestedConsumer ВНУТРИ транзакции consumer-а: весь граф
   * Order (Order + OrderItems + OrderTraveler + Fulfillment + OrderHistory +
   * OrderCreated result-event) атомарен. Владелец — Order (ADR-0001); Sales
   * НЕ пишет в order.*; Order НЕ пишет в sales.* и catalog.* (только READ-only
   * cross-context reads в consumer-е).
   *
   * Инварианты:
   *  - frozen commercial snapshot переносится БЕЗ пересчёта (никакого reprice,
   *    никакого чтения mutable Catalog/Sales price);
   *  - money — Decimal (без JS float); amount = frozen total;
   *  - канонические ID: ORD-* + TH-YYYY-###### (IdsService, атомарно);
   *  - OrderTraveler — минимальный snapshot (firstName/lastName/birthDate,
   *    dataCompleteness=INCOMPLETE — passport данные не входят в checkout
   *    контекст, дополняются позже через PATCH /travelers);
   *  - OrderCreated — атомарно с Order, эмитится PENDING (emit) и доставляется
   *    подписчикам после коммита (order-requested consumer вызывает
   *    publishPending): Step 2.12E CommissionAccrualConsumer — единственный
   *    потребитель (canonical Order-created факт, ADR-0013 D10).
   */
  async createOrderFromRequested(
    tx: Prisma.TransactionClient,
    input: {
      payload: OrderRequestedPayload;
      /** Canonical traveler контекст из Sales CheckoutIntent (READ-only,
       *  immutable после Sale completion — Step 2.4 assertCheckoutNotCompleted). */
      travelers: Array<{ firstName: string; lastName: string; birthDate: Date | null }>;
      orderRequestedEventId: string;
      correlationId: string | null;
      causationId: string | null;
    },
  ): Promise<{ order: { id: string; code: string; number: string; customerId: string | null }; eventId: string }> {
    const { payload, travelers } = input;
    assertValidOrderRequestedPayload(payload);

    const code = await this.ids.nextCode(tx, "ORD");
    const number = await this.ids.nextOrderNumber(tx);
    const customerId = payload.customerId ?? null;
    const serviceDate = payload.serviceDate ? new Date(`${payload.serviceDate}T00:00:00.000Z`) : null;
    // Step 2.8A: frozen local temporal факты (verbatim; UTC instant НЕ
    // дублируется — единственная деривация на Booking, §13).
    const serviceTime = payload.serviceTime ?? null;
    const serviceEndTime = payload.serviceEndTime ?? null;
    const serviceTimeZone = payload.serviceTimeZone ?? null;
    const currency = payload.currency;
    const amount = new Prisma.Decimal(payload.total);
    // Step 2.5A: submission milestone — момент создания Order из OrderRequested
    // (server-owned, один timestamp на создание).
    const submittedAt = new Date();

    const order = await tx.order.create({
      data: {
        code,
        number,
        customerId,
        status: "NEW",
        paymentStatus: "UNPAID",
        currency,
        amount,
        paidAmount: new Prisma.Decimal(0),
        serviceDate,
        serviceTime,
        serviceEndTime,
        serviceTimeZone,
        version: 1,
        submittedAt,
        // Step 2.5: upstream refs + frozen snapshot (из OrderRequested).
        saleId: payload.saleId,
        saleCode: payload.saleCode,
        quoteId: payload.quoteId,
        checkoutId: payload.checkoutId,
        reservationId: payload.reservationId ?? null,
        // Все holds (multi-item Sale без потери кардинальности, STRICT REVIEW 2.5).
        reservationIds: payload.reservationIds.length > 0 ? payload.reservationIds : Prisma.JsonNull,
        orderRequestedEventId: input.orderRequestedEventId,
        subtotal: new Prisma.Decimal(payload.subtotal),
        discountType: payload.discountType,
        discountValue: payload.discountValue ? new Prisma.Decimal(payload.discountValue) : null,
        discountAmount: payload.discountAmount ? new Prisma.Decimal(payload.discountAmount) : null,
        paymentScheme: payload.paymentScheme ?? null,
        prepaymentType: payload.prepaymentType ?? null,
        prepaymentValue: payload.prepaymentValue ? new Prisma.Decimal(payload.prepaymentValue) : null,
        initialAmount: payload.initialAmount ? new Prisma.Decimal(payload.initialAmount) : null,
        remainingAmount: payload.remainingAmount ? new Prisma.Decimal(payload.remainingAmount) : null,
        acquisitionSource: payload.acquisitionSource,
        // Step 2.12E (ADR-0013 D7/D14): frozen commission контекст verbatim
        // (NULL = нет commission-контекста — legacy/без-commission канал;
        // без backfill). Immutable после создания.
        sellerPartnerId: payload.sellerPartnerId ?? null,
        commissionSnapshot: payload.commissionSnapshot ? (payload.commissionSnapshot as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      select: { id: true, code: true, number: true, customerId: true },
    });

    for (const it of payload.items) {
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: it.productId,
          productCode: it.productCode,
          title: it.productTitle,
          type: it.productType, // frozen в payload (не mutable Catalog read)
          quantity: it.quantity,
          price: new Prisma.Decimal(it.unitPrice),
          currency,
          amount: new Prisma.Decimal(it.amount),
          serviceDate,
        },
      });
    }

    for (const t of travelers) {
      await tx.orderTraveler.create({
        data: {
          orderId: order.id,
          customerId,
          firstName: t.firstName,
          lastName: t.lastName,
          birthDate: t.birthDate,
          dataCompleteness: "INCOMPLETE",
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
        actorId: null,
        actorName: "Система",
        comment: "Заказ создан из OrderRequested (Step 2.5)",
        fields: { saleCode: payload.saleCode, orderRequestedEventId: input.orderRequestedEventId },
      },
    });

    // OrderCreated — пишется PENDING (emit) в той же транзакции (факт атомарен
    // с Order; НЕ виден без committed Order); доставку подписчикам выполняет
    // order-requested consumer через publishPending() ПОСЛЕ коммита (паттерн
    // booking.service/BookingConfirmed). Потребитель — CommissionAccrualConsumer
    // (Step 2.12E, canonical Order-created факт, ADR-0013 D10).
    // correlation/causation — из родительского OrderRequested (Step 1.15).
    const eventId = await this.eventBus.emit(tx, {
      aggregateType: "Order",
      aggregateId: order.id,
      eventType: DomainEvents.OrderCreated,
      payload: {
        orderId: order.id,
        code: order.code,
        number: order.number,
        customerId: order.customerId,
        amount: String(amount),
        currency,
      } as OrderEventPayload,
      correlationId: input.correlationId,
      causationId: input.causationId,
    });

    return { order, eventId };
  }

  async listOrders(
    query: { status?: string; customerId?: string; search?: string; paymentStatus?: string; page?: number; pageSize?: number },
    viewer?: TravelerViewer,
  ) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status as OrderStatus } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus as any as import("../../generated/prisma/client").OrderPaymentStatus } : {}),
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
    // Step 1.17: field-level redaction — traveler PII виден только OPERATOR/ADMIN.
    return {
      items: items.map((o) => ({ ...o, travelers: redactTravelersPii(o.travelers ?? [], viewer) })),
      total,
      page,
      pageSize,
    };
  }

  async getOrder(id: string, viewer?: TravelerViewer) {
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
    // Step 1.17: field-level redaction — traveler PII виден только OPERATOR/ADMIN.
    return { ...order, travelers: redactTravelersPii(order.travelers ?? [], viewer) };
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
      // travelers нужны для confirm (проверка полноты данных); items больше НЕ
      // читаются здесь (payload BookingRequested минимизирован — STRICT REVIEW FIX).
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { travelers: true },
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

      // Optimistic concurrency (Step 1.14 §19): переход применяется только если
      // статус/версия не изменились с момента чтения. Два concurrent/retry вызова
      // одного перехода → ровно ОДИН выигрывает, остальные получают ConflictError,
      // и canonical event не создаётся дважды как два business facts.
      // Step 2.5A: business milestone timestamp фиксируется в ТОМ ЖЕ CAS-апдейте,
      // что и статус (атомарно; один timestamp на переход; повторный переход
      // невозможен lifecycle-ом → immutable milestone).
      const data: Prisma.OrderUpdateManyMutationInput = {
        status: transition.to,
        version: { increment: 1 },
        updatedBy: actor ?? null,
      };
      const milestoneNow = new Date();
      if (action === "confirm") data.confirmedAt = milestoneNow;
      else if (action === "complete") data.fulfilledAt = milestoneNow;
      else if (action === "close") data.closedAt = milestoneNow;
      else if (action === "cancel") data.cancelledAt = milestoneNow;
      const updatedRows = await tx.order.updateMany({
        where: { id: orderId, status: order.status, version: order.version },
        data,
      });
      if (updatedRows.count !== 1) {
        throw new ConflictError(`Order ${order.code} was concurrently modified; retry transition ${action}`);
      }
      const updated = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
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

      // Step 1.15: correlation/causation НЕ указываются явно — они наследуются
      // из request context (correlation = requestId HTTP-команды, causation = null).
      switch (action) {
        case "confirm": {
          // Step 1.14: факт «готов к бронированию» (canonical, бывш. OrderApproved).
          // Booking НЕ запускается этим событием — только BookingRequested (send).
          await this.eventBus.emit(tx, {
            aggregateType: "Order",
            aggregateId: orderId,
            eventType: DomainEvents.OrderReadyForBooking,
            payload: { orderId, code: order.code, customerId: order.customerId } as OrderRefPayload,
          });
          break;
        }
        case "complete": {
          await this.eventBus.emit(tx, {
            aggregateType: "Order",
            aggregateId: orderId,
            eventType: DomainEvents.OrderFulfilled,
            payload: { orderId, code: order.code, customerId: order.customerId } as OrderRefPayload,
          });
          break;
        }
        case "close": {
          await this.eventBus.emit(tx, {
            aggregateType: "Order",
            aggregateId: orderId,
            eventType: DomainEvents.OrderClosed,
            payload: { orderId, code: order.code, customerId: order.customerId } as OrderRefPayload,
          });
          break;
        }
        case "send": {
          // STRICT REVIEW FIX (PII minimization): command-payload содержит ТОЛЬКО
          // canonical refs. Consumer (BookingSubscribers) читает order.items и
          // order.travelers из БД по orderId (READ-only, ADR-0001) — items/travelers
          // в payload были редундантны и несли паспортные данные в durable Outbox.
          const payload: BookingRequestedPayload = {
            orderId,
            orderCode: order.code,
            customerId: order.customerId,
          };
          await this.eventBus.emit(tx, {
            aggregateType: "Order",
            aggregateId: orderId,
            eventType: DomainEvents.BookingRequested,
            payload,
          });
          break;
        }
        case "cancel": {
          await this.eventBus.emit(tx, {
            aggregateType: "Order",
            aggregateId: orderId,
            eventType: DomainEvents.OrderCancelled,
            payload: { orderId, code: order.code, customerId: order.customerId } as OrderRefPayload,
          });
          break;
        }
        default: {
          await this.eventBus.emit(tx, {
            aggregateType: "Order",
            aggregateId: orderId,
            eventType: DomainEvents.OrderStatusChanged,
            payload: { from: order.status, to: transition.to, actor } as Prisma.InputJsonValue,
          });
        }
      }

      return updated;
    });

    await this.eventBus.publishPending();
    return result;
  }
}
