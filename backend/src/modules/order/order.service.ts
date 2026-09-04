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
import { buildSortClause, type SortDirection } from '../../shared/sort';
import { IdsService } from "../../shared/ids.service";
import { ReferenceNumberService } from "../../shared/reference-number.service";
import { ConflictError, NotFoundError, ValidationDomainError } from "../../shared/errors";
import { redactTravelersPii, type TravelerViewer } from "../../shared/pii";
import { isDateOnly } from "../../shared/date-only";
import { isIanaTimeZone, isLocalTime } from "../../shared/service-time";
import { isDeniedStorefrontScope, PARTNER_STOREFRONT_SOURCE } from "../../shared/sales-scope";
import { diffAuditFields, type AuditFieldChange, type AuditSource } from "../../shared/audit";
import { PaymentPrepaymentType, PaymentScheme, QuoteDiscountType, SalesAcquisitionSource } from "../../generated/prisma/enums";
import {
  getEffectiveTravelerRequirements,
  isTravelerField,
  type TravelerField,
  type TravelerFullRequirements,
} from "../catalog/traveler-requirements";

/**
 * D4 §10/§21 — Platform Marketplace read/command scope.
 * Platform staff-роли работают с Marketplace commerce (Order Center default
 * scope — MARKETPLACE; Storefront = tenant партнёра, Partner Workspace).
 * Объекты PARTNER_STOREFRONT не читаются/не изменяются через platform
 * marketplace-контракты: прямой GET по UUID / business reference → 404
 * (enumeration protection), lifecycle/traveler-команды → 404. Внутренние
 * cross-domain вызовы (viewer отсутствует, trusted, ADR-0001) не затрагиваются.
 */
// D4 REMEDIATION F2: canonical Platform-scope константа вынесена в shared
// (Order + Booking list/export используют единый источник истины).
export const PLATFORM_SCOPE_DENIED_SOURCE = PARTNER_STOREFRONT_SOURCE;

/** Allowlist traveler-полей для field-level audit diff (D5 Entity Change Audit). */
const TRAVELER_AUDIT_FIELDS = [
  "firstName",
  "lastName",
  "birthDate",
  "citizenship",
  "gender",
  "passportNumber",
  "passportExpiry",
] as const;

export interface TravelerUpdateInput {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  citizenship?: string;
  gender?: string;
  passportNumber?: string;
  passportExpiry?: string;
}

/** D3: individual traveler update (collector-driven, validated against pinned snapshot). */
export interface TravelerCollectInput {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  citizenship?: string;
  gender?: string;
  passportNumber?: string;
  passportExpiry?: string;
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

const ORDER_SORT_ALLOWLIST: Record<string, string> = {
  code: 'code',
  number: 'number',
  createdAt: 'createdAt',
  cancelledAt: 'cancelledAt',
  amount: 'amount',
  status: 'status',
  paymentStatus: 'paymentStatus',
  currency: 'currency',
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

/** Права, необходимые для каждой команды жизненного цикла Order (RBAC Matrix §4). */
export const ACTION_PERMISSIONS: Record<OrderAction, string> = {
  process: "order.accept",
  markWaitingData: "order.edit_noncritical",
  resumeProcessing: "order.edit_noncritical",
  confirm: "order.edit_noncritical",
  send: "order.request_booking",
  complete: "order.edit_noncritical",
  close: "order.close",
  cancel: "order.cancel",
  problem: "order.edit_noncritical",
  suspend: "order.suspend",
};

/**
 * D5 §6/§8 — server-authoritative projection доступных actions.
 *
 * Action availability = Current Status + Lifecycle Gates + Permissions +
 * Workspace Scope + Business Invariants. Та же логика, что у orderAction
 * (TRANSITIONS + D3 traveler gate + completeness для confirm); permission —
 * granular RBAC keys (ACTION_PERMISSIONS). Workspace scope (Storefront → 404)
 * применяется уровнем выше (getOrder/history endpoint).
 * Frontend не изобретает state-machine mapping: только этот список рендерится.
 */
export function computeAvailableOrderActions(
  order: {
    status: OrderStatus;
    travelerCount: number | null;
    termsAcceptedAt: Date | null;
    finalConfirmedAt: Date | null;
    travelers?: Array<{ dataCompleteness: string }>;
  },
  granted: readonly string[],
): OrderAction[] {
  const d3Scope = (order.travelerCount ?? 0) > 0 && order.termsAcceptedAt !== null;
  const actions: OrderAction[] = [];
  for (const action of Object.keys(TRANSITIONS) as OrderAction[]) {
    const t = TRANSITIONS[action];
    if (!t.from.includes(order.status)) continue;
    if (!granted.includes(ACTION_PERMISSIONS[action])) continue;
    // D3 traveler gate (как в orderAction): confirm/send требуют finalConfirmedAt.
    if (d3Scope && !order.finalConfirmedAt && (action === "confirm" || action === "send")) continue;
    // confirm требует полные данные всех туристов (как в orderAction).
    if (action === "confirm" && (order.travelers ?? []).some((x) => x.dataCompleteness !== "COMPLETE")) continue;
    actions.push(action);
  }
  return actions;
}

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
    private readonly refNum: ReferenceNumberService,
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
      /** D3 §3: pinned traveler requirements snapshot (immutable after Order creation). */
      pinnedRequirements?: Record<string, string> | null;
      /** D3 SR R1: реальный acceptance instant (Sale.completedAt). NULL = legacy
       *  (processing time fallback). Business event timestamp ≠ processing time. */
      acceptedAt?: Date | null;
      orderRequestedEventId: string;
      correlationId: string | null;
      causationId: string | null;
    },
  ): Promise<{ order: { id: string; code: string; number: string; customerId: string | null }; eventId: string }> {
    const { payload, travelers } = input;
    assertValidOrderRequestedPayload(payload);

    const code = await this.ids.nextCode(tx, "ORD");
    const number = await this.ids.nextOrderNumber(tx);

    // Shared Commerce Sequence: allocate 8-digit root for all entities in this chain.
    const commerceSequence = await this.refNum.nextCommerceSequence(tx);
    const referenceNumber = this.refNum.commerceOrderRef(commerceSequence);
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
        referenceNumber,
        commerceSequence,
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
        // D3 §3 — PIN traveler requirements at termsAcceptedAt.
        // SR R1: termsAcceptedAt = РЕАЛЬНЫЙ acceptance instant (Sale.completedAt,
        // frozen в OrderRequested payload как acceptedAt) — НЕ processing time
        // consumer-а (business event timestamp ≠ processing timestamp). Legacy
        // события (до SR, без acceptedAt) → fallback now(). Immutable:
        // последующие Product-изменения НЕ влияют на принятый checkout (hard
        // gate §3). Server-owned — клиент не может заменить.
        termsAcceptedAt: input.acceptedAt ?? new Date(),
        pinnedRequirements: input.pinnedRequirements
          ? (input.pinnedRequirements as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        // D3 §6 — canonical traveler count: actual selected party contract
        // (CheckoutIntentTraveler rows, READ-only), NOT derived retroactively
        // из Passenger/форм.
        travelerCount: travelers.length,
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
      select: { id: true, code: true, number: true, referenceNumber: true, customerId: true, commerceSequence: true },
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

    // D3 §13: position = 1-based индекс в checkout party list — детерминированный
    // порядок туристов (OrderTraveler не имеет createdAt; UI-порядок обязан быть
    // стабильным для save/resume в multi-traveler collection).
    for (const [tIdx, t] of travelers.entries()) {
      await tx.orderTraveler.create({
        data: {
          orderId: order.id,
          customerId,
          position: tIdx + 1,
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
        source: "SYSTEM",
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

  /**
   * D3 Request Flow Integration (F6 closure) — canonical Order root creation
   * from an ACCEPTED Request (Request → Order conversion, application adapter).
   *
   * Reuses canonical Order primitives (code/number/referenceNumber/sequence,
   * OrderItem, OrderTraveler, Fulfillment, history, OrderCreated emit) instead
   * of building a second incompatible commerce engine. НЕ создаёт fake
   * CheckoutIntent/Sale/Quote и НЕ проходит через OrderRequested consumer
   * (payload контракт OrderRequested жёстко требует sale/checkout/quote —
   * fabrication запрещена §19; конверсия — синхронная команда в одной tx).
   *
   * Frozen facts (все из Request, mutable Catalog НЕ читается):
   *   - termsAcceptedAt = Request.customerAcceptedAt (реальный acceptance instant §6);
   *   - pinnedRequirements = snapshot, замороженный при customerAccept (§7);
   *   - travelerCount = frozen party size (заявка) — OrderTraveler placeholders
   *     position 1..N (имена собираются в D3 collection после создания Order);
   *   - product identity = Request.productSnapshot (продукт как подан);
   *   - money = accepted commercial price (confirmed ?? displayed).
   *
   * Order.referenceNumber = MKT-ORD-{Request.commerceSequence} — та же shared
   * commerce root, что REQ (MKT-REQ-{SEQ} → MKT-ORD-{SEQ} → MKT-BKG-{SEQ}).
   *
   * Caller (RequestService.convertRequestToOrder) выполняет CAS-claim
   * CUSTOMER_ACCEPTED → CONVERTED в той же транзакции (idempotency §11).
   */
  async createOrderFromRequest(
    tx: Prisma.TransactionClient,
    input: {
      request: {
        id: string;
        commerceSequence: string;
        customerId: string | null;
        productId: string | null;
        productSnapshot: {
          productId: string;
          productCode: string;
          productTitle: string;
          productType: string;
        } | null;
        requestedServiceDate: Date | null;
        quantity: number;
        confirmedPrice: string | null;
        confirmedCurrency: string | null;
        displayedPrice: string | null;
        displayedCurrency: string | null;
        customerAcceptedAt: Date | null;
        pinnedRequirements: Record<string, string> | null;
        travelerCount: number | null;
      };
      actor: { id: string; username: string } | null;
      orderRequestedEventId?: string | null;
      correlationId?: string | null;
      causationId?: string | null;
    },
  ): Promise<{
    order: {
      id: string;
      code: string;
      number: string;
      referenceNumber: string;
      commerceSequence: string | null;
      customerId: string | null;
      createdAt: Date;
    };
    eventId: string;
  }> {
    const r = input.request;
    // Валидация доменных инвариантов ДО создания (неполный Request не может
    // стать Order): принятый коммерческий факт (customerAcceptedAt), pinned
    // snapshot, party size, продукт и деньги обязательны.
    if (!r.customerAcceptedAt) {
      throw new ValidationDomainError(`Request ${r.id} has no customerAcceptedAt; conversion requires customer acceptance`);
    }
    if (!r.pinnedRequirements) {
      throw new ValidationDomainError(`Request ${r.id} has no pinned traveler requirements; conversion requires D3 acceptance snapshot`);
    }
    if (!r.travelerCount || r.travelerCount < 1) {
      throw new ValidationDomainError(`Request ${r.id} has no frozen travelerCount; conversion requires explicit party composition`);
    }
    if (!r.productSnapshot) {
      throw new ValidationDomainError(`Request ${r.id} has no product snapshot; conversion requires a product`);
    }
    const money = r.confirmedPrice ?? r.displayedPrice;
    const currency = r.confirmedCurrency ?? r.displayedCurrency;
    if (!money || !currency) {
      throw new ValidationDomainError(`Request ${r.id} has no accepted price/currency; conversion requires commercial terms`);
    }
    assertOrderMoney(money, "confirmed/displayed price");

    const code = await this.ids.nextCode(tx, "ORD");
    const number = await this.ids.nextOrderNumber(tx);

    // Request → Order: переиспользуем shared commerce root заявки (НЕ новая
    // последовательность): MKT-REQ-{SEQ} → MKT-ORD-{SEQ} (один chain root §26).
    const commerceSequence = r.commerceSequence;
    const referenceNumber = this.refNum.commerceOrderRef(commerceSequence);
    const serviceDate = r.requestedServiceDate
      ? new Date(`${r.requestedServiceDate.toISOString().slice(0, 10)}T00:00:00.000Z`)
      : null;
    const currencyCode = currency;
    const amount = new Prisma.Decimal(money);
    const submittedAt = new Date();

    const order = await tx.order.create({
      data: {
        code,
        number,
        referenceNumber,
        commerceSequence,
        customerId: r.customerId,
        status: "NEW",
        paymentStatus: "UNPAID",
        currency: currencyCode,
        amount,
        paidAmount: new Prisma.Decimal(0),
        serviceDate,
        version: 1,
        submittedAt,
        // D3 §6: Order.termsAcceptedAt = реальный Request acceptance instant
        // (customerAcceptedAt), НЕ Order.createdAt / processing time.
        termsAcceptedAt: r.customerAcceptedAt,
        // D3 §7: pinned snapshot, замороженный при customerAccept (immutable).
        pinnedRequirements: r.pinnedRequirements as Prisma.InputJsonValue,
        // D3 §8: frozen traveler count (party size) → OrderTraveler placeholders.
        travelerCount: r.travelerCount,
        acquisitionSource: "MARKETPLACE",
        subtotal: amount,
        discountType: null,
        // Upstream refs: Request-derived Order НЕ имеет Sale/Checkout/Quote.
        saleId: null,
        saleCode: null,
        quoteId: null,
        checkoutId: null,
        reservationId: null,
        reservationIds: Prisma.JsonNull,
        orderRequestedEventId: input.orderRequestedEventId ?? null,
        sellerPartnerId: null,
        commissionSnapshot: Prisma.JsonNull,
      },
      select: {
        id: true, code: true, number: true, referenceNumber: true,
        commerceSequence: true, customerId: true, createdAt: true,
      },
    });

    // OrderItem — одна продуктовая линия whole-request frozen money snapshot
    // (displayed/confirmed цена заявки = цена всей заявки, без деривации unit
    // price из party size — деньги не фабрикуются).
    await tx.orderItem.create({
      data: {
        orderId: order.id,
        productId: r.productSnapshot.productId,
        productCode: r.productSnapshot.productCode,
        title: r.productSnapshot.productTitle,
        type: r.productSnapshot.productType,
        quantity: 1,
        price: amount,
        currency: currencyCode,
        amount,
        serviceDate,
      },
    });

    // D3 OrderTraveler placeholders: frozen count строк (position 1..N),
    // имена пустые — D3 collection (Order Traveler UI/API) заполняет их после
    // создания Order (Request party names не собираются pre-Order; count frozen).
    for (let pos = 1; pos <= r.travelerCount; pos++) {
      await tx.orderTraveler.create({
        data: {
          orderId: order.id,
          customerId: r.customerId,
          position: pos,
          firstName: "",
          lastName: "",
          birthDate: null,
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
        source: "SYSTEM",
        actorId: input.actor?.id ?? null,
        actorName: input.actor?.username ?? "Система",
        comment: "Заказ создан из принятой заявки (Request conversion, D3 Request Flow)",
        fields: {
          requestId: r.id,
          termsAcceptedAt: r.customerAcceptedAt?.toISOString() ?? null,
          travelerCount: r.travelerCount,
          referenceNumber,
        },
      },
    });

    // OrderCreated — canonical факт, атомарен с Order (emit PENDING в той же
    // транзакции); доставка подписчикам — после коммита (caller publishEvent).
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
        currency: currencyCode,
      } as OrderEventPayload,
      correlationId: input.correlationId ?? null,
      causationId: input.causationId ?? null,
    });

    return { order, eventId };
  }

  /**
   * Step 3.12 — generate tenant-scoped reference number for Order.
   * Marketplace → MKT-ORD-{SEQ}; Storefront → {SF_CODE}-ORD-{SEQ}
   */
  private async generateOrderReferenceNumber(
    tx: Prisma.TransactionClient,
    payload: OrderRequestedPayload,
  ): Promise<string> {
    const source = payload.acquisitionSource;
    if (source === "PARTNER_STOREFRONT" && payload.sellerPartnerId) {
      const sf = await tx.partnerStorefront.findUnique({
        where: { partnerId: payload.sellerPartnerId },
        select: { storefrontCode: true },
      });
      if (sf) return this.refNum.nextStorefrontReference(tx, sf.storefrontCode, "ORD");
    }
    return this.refNum.nextMarketplaceReference(tx, "ORD");
  }

  async listOrders(
    query: { status?: string; customerId?: string; search?: string; paymentStatus?: string; cancelledWithin?: string; paymentFailed?: string; pendingRefund?: string; sortBy?: string; sortDirection?: string; page?: number; pageSize?: number; dateFrom?: string; dateTo?: string; acquisitionSource?: string },
    viewer?: TravelerViewer,
  ) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    // D4 REMEDIATION F2: client acquisitionSource filter ⊆ server-authorized
    // scope — явный PARTNER_STOREFRONT на platform Marketplace-контракте →
    // deny (empty result; Storefront-коммерция не существует для этого scope,
    // invisibility-семантика как у прямых 404-ридов).
    if (isDeniedStorefrontScope(query.acquisitionSource)) {
      return { items: [], total: 0, page, pageSize, aggregates: { active: 0, ready: 0, closed: 0 } };
    }
    // R5-C1: Support comma-separated multi-status (e.g., "FULFILLED,CLOSED")
    const statusFilter = query.status
      ? query.status.includes(',')
        ? { status: { in: query.status.split(',').map(s => s.trim()) as OrderStatus[] } }
        : { status: query.status as OrderStatus }
      : {};
    const where: Prisma.OrderWhereInput = {
      ...statusFilter,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus as any as import("../../generated/prisma/client").OrderPaymentStatus } : {}),
      ...(query.search
        ? { OR: [{ code: { contains: query.search, mode: "insensitive" } }, { number: { contains: query.search, mode: "insensitive" } }, { referenceNumber: { contains: query.search, mode: "insensitive" } }] }
        : {}),
      // Platform operational scope: default to MARKETPLACE when no acquisitionSource specified
      acquisitionSource: query.acquisitionSource || "MARKETPLACE",
    };

    // R5-03: Date range filtering on createdAt (exclusive end — consistent with Analytics half-open [from, to))
    if (query.dateFrom || query.dateTo) {
      const dateRange: Prisma.DateTimeFilter = {};
      if (query.dateFrom) dateRange.gte = new Date(query.dateFrom);
      if (query.dateTo) dateRange.lt = new Date(query.dateTo);
      if (where.createdAt && typeof where.createdAt === 'object' && !Array.isArray(where.createdAt)) {
        Object.assign(where.createdAt, dateRange);
      } else {
        where.createdAt = dateRange;
      }
    }

    // ROUND 5: cancelledWithin=N → orders cancelled in the last N days (detector: RECENT_CANCELLATIONS)
    // Detector predicate: createdAt > (now - N days) AND createdAt <= now
    if (query.cancelledWithin) {
      const days = parseInt(query.cancelledWithin, 10);
      if (days > 0 && days <= 365) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const nowTs = new Date(Date.now());
        where.createdAt = { gt: cutoff, lte: nowTs };
      }
    }

    // ROUND 5: paymentFailed=true → orders that have at least one FAILED payment (detector: FAILED_PAYMENTS)
    if (query.paymentFailed === "true") {
      const failedPayments = await this.prisma.$queryRawUnsafe(
        `SELECT DISTINCT "orderId" FROM "finance"."Payment" WHERE status = 'FAILED'`,
      );
      const ids = (failedPayments as any[]).map((r) => r.orderId as string);
      if (ids.length === 0) {
        return { items: [], total: 0, page, pageSize, aggregates: { active: 0, ready: 0, closed: 0 } };
      }
      where.id = { in: ids };
    }

    // ROUND 5: pendingRefund=true → orders that have at least one REQUESTED refund (detector: PENDING_REFUNDS)
    if (query.pendingRefund === "true") {
      const pendingRefunds = await this.prisma.$queryRawUnsafe(
        `SELECT DISTINCT "orderId" FROM "finance"."Refund" WHERE status = 'REQUESTED'`,
      );
      const ids = (pendingRefunds as any[]).map((r) => r.orderId as string);
      if (ids.length === 0) {
        return { items: [], total: 0, page, pageSize, aggregates: { active: 0, ready: 0, closed: 0 } };
      }
      where.id = { in: ids };
    }
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: buildSortClause(query.sortBy, query.sortDirection, ORDER_SORT_ALLOWLIST, { createdAt: 'desc' }),
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { items: true, travelers: true },
      }),
      this.prisma.order.count({ where }),
    ]);
    // KPI aggregates: count by status across full matching dataset
    const [countActive, countReady, countClosed] = await Promise.all([
      this.prisma.order.count({ where: { ...where, status: { in: ['NEW', 'IN_PROCESSING', 'WAITING_FOR_DATA', 'READY_FOR_BOOKING', 'SENT_TO_BOOKING'] as any } } }),
      this.prisma.order.count({ where: { ...where, status: 'READY_FOR_BOOKING' as any } }),
      this.prisma.order.count({ where: { ...where, status: { in: ['CLOSED', 'CANCELLED'] as any } } }),
    ]);

    // Step 1.17: field-level redaction — traveler PII виден только OPERATOR/ADMIN.
    return {
      items: items.map((o) => ({ ...o, travelers: redactTravelersPii(o.travelers ?? [], viewer) })),
      total,
      page,
      pageSize,
      aggregates: { active: countActive, ready: countReady, closed: countClosed },
    };
  }

  /**
   * Shared filter builder — same predicate as listOrders, reusable by export.
   */
  buildOrderWhere(query: { status?: string; customerId?: string; search?: string; paymentStatus?: string; cancelledWithin?: string; paymentFailed?: string; pendingRefund?: string; dateFrom?: string; dateTo?: string; acquisitionSource?: string; sellerPartnerId?: string }): Prisma.OrderWhereInput {
    const statusFilter = query.status
      ? query.status.includes(',')
        ? { status: { in: query.status.split(',').map(s => s.trim()) as OrderStatus[] } }
        : { status: query.status as OrderStatus }
      : {};
    const where: Prisma.OrderWhereInput = {
      ...statusFilter,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus as any } : {}),
      ...(query.search
        ? { OR: [{ code: { contains: query.search, mode: "insensitive" } }, { number: { contains: query.search, mode: "insensitive" } }, { referenceNumber: { contains: query.search, mode: "insensitive" } }] }
        : {}),
      acquisitionSource: query.acquisitionSource || "MARKETPLACE",
      ...(query.sellerPartnerId ? { sellerPartnerId: query.sellerPartnerId } : {}),
    };
    if (query.dateFrom || query.dateTo) {
      const dateRange: Prisma.DateTimeFilter = {};
      if (query.dateFrom) dateRange.gte = new Date(query.dateFrom);
      if (query.dateTo) dateRange.lt = new Date(query.dateTo);
      where.createdAt = dateRange;
    }
    return where;
  }

  /**
   * Export all matching orders (no pagination) for diagnostic reconciliation.
   */
  async exportOrders(query: { status?: string; customerId?: string; search?: string; paymentStatus?: string; cancelledWithin?: string; paymentFailed?: string; pendingRefund?: string; dateFrom?: string; dateTo?: string; acquisitionSource?: string; sellerPartnerId?: string }) {
    // D4 REMEDIATION F2 (list/export согласованы): явный Storefront-фильтр на
    // platform export → deny (empty rows).
    if (isDeniedStorefrontScope(query.acquisitionSource)) {
      return { rows: [], total: 0 };
    }
    const where = this.buildOrderWhere(query);

    const items = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        code: true,
        referenceNumber: true,
        number: true,
        status: true,
        paymentStatus: true,
        amount: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        acquisitionSource: true,
        sellerPartnerId: true,
        customerId: true,
      },
    });

    const total = items.length;

    // Batch-resolve partner + customer display names
    const partnerIds = [...new Set(items.map(o => o.sellerPartnerId).filter(Boolean))] as string[];
    const customerIds = [...new Set(items.map(o => o.customerId).filter(Boolean))] as string[];

    const [partners, customers, bookings, payments] = await Promise.all([
      partnerIds.length > 0
        ? this.prisma.partner.findMany({ where: { id: { in: partnerIds } }, select: { id: true, code: true, name: true } })
        : [],
      customerIds.length > 0
        ? this.prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, code: true, firstName: true, lastName: true, companyName: true } })
        : [],
      // Related bookings
      this.prisma.booking.findMany({
        where: { orderId: { in: items.map(o => o.id) } },
        select: { id: true, code: true, referenceNumber: true, orderId: true, status: true, createdAt: true },
      }),
      // Related payments
      this.prisma.payment.findMany({
        where: { orderId: { in: items.map(o => o.id) } },
        select: { id: true, referenceNumber: true, orderId: true, status: true, amount: true, currency: true, paidAt: true },
      }),
    ]);

    const partnerMap = new Map(partners.map(p => [p.id, p]));
    const customerMap = new Map(customers.map(c => [c.id, c]));
    const bookingByOrder = new Map<string, typeof bookings>();
    for (const b of bookings) {
      if (!b.orderId) continue;
      const arr = bookingByOrder.get(b.orderId) ?? [];
      arr.push(b);
      bookingByOrder.set(b.orderId, arr);
    }
    const paymentByOrder = new Map<string, typeof payments>();
    for (const p of payments) {
      if (!p.orderId) continue;
      const arr = paymentByOrder.get(p.orderId) ?? [];
      arr.push(p);
      paymentByOrder.set(p.orderId, arr);
    }

    const rows = items.map(o => {
      const partner = o.sellerPartnerId ? partnerMap.get(o.sellerPartnerId) : null;
      const customer = o.customerId ? customerMap.get(o.customerId) : null;
      const ob = bookingByOrder.get(o.id) ?? [];
      const op = paymentByOrder.get(o.id) ?? [];
      return {
        id: o.id,
        referenceNumber: o.referenceNumber ?? o.code,
        code: o.code,
        number: o.number,
        status: o.status,
        paymentStatus: o.paymentStatus,
        amount: String(o.amount),
        currency: o.currency,
        createdAt: o.createdAt?.toISOString() ?? '',
        updatedAt: o.updatedAt?.toISOString() ?? '',
        acquisitionSource: o.acquisitionSource,
        partnerId: o.sellerPartnerId ?? '',
        partnerCode: partner?.code ?? '',
        partnerName: partner?.name ?? '',
        customerId: o.customerId ?? '',
        customerCode: customer?.code ?? '',
        customerName: customer ? (customer.companyName ?? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()) : '',
        bookingIds: ob.map(b => b.id).join('; '),
        bookingCodes: ob.map(b => b.referenceNumber ?? '').filter(Boolean).join('; '),
        bookingReferences: ob.map(b => b.referenceNumber ?? '').filter(Boolean).join('; '),
        bookingStatuses: ob.map(b => b.status).join('; '),
        paymentIds: op.map(p => p.id).join('; '),
        paymentReferences: op.map(p => p.referenceNumber ?? '').filter(Boolean).join('; '),
        paymentStatuses: op.map(p => p.status).join('; '),
        paymentAmounts: op.map(p => `${p.amount} ${p.currency}`).join('; '),
        paidAt: op.map(p => p.paidAt?.toISOString() ?? '').filter(Boolean).join('; '),
      };
    });

    return { rows, total };
  }

  async getOrder(id: string, viewer?: TravelerViewer, grantedPermissions: string[] = []) {
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

    // D4 §10/§21: Storefront-tenant объект не читается через platform
    // marketplace read-контракт (HTTP viewer присутствует; прямой GET по UUID /
    // business reference → 404, enumeration protection). Внутренние вызовы без
    // viewer (trusted) остаются доступными.
    if (viewer && order.acquisitionSource === PLATFORM_SCOPE_DENIED_SOURCE) {
      throw new NotFoundError(`Order ${id} not found`);
    }

    // ── Related-entity display name enrichment (Round 2E.2R.1) ──
    // Batch-resolve customer + partner display names (no N+1)
    const relatedIds: string[] = [];
    if (order.customerId) relatedIds.push(order.customerId);
    if (order.sellerPartnerId) relatedIds.push(order.sellerPartnerId);

    let customerDisplay: { id: string; displayName: string } | null = null;
    let partnerDisplay: { id: string; displayName: string } | null = null;

    if (order.customerId) {
      const c = await this.prisma.customer.findUnique({
        where: { id: order.customerId },
        select: { id: true, firstName: true, lastName: true, companyName: true },
      });
      if (c) {
        const name = c.companyName ?? ((`${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()) || null);
        customerDisplay = { id: c.id, displayName: name ?? c.id };
      }
    }
    if (order.sellerPartnerId) {
      const p = await this.prisma.partner.findUnique({
        where: { id: order.sellerPartnerId },
        select: { id: true, name: true },
      });
      if (p) {
        partnerDisplay = { id: p.id, displayName: p.name || p.id };
      }
    }

    // D5 §6/§8: server-authoritative available actions (state machine + gates +
    // granular permissions). Frontend рендерит ТОЛЬКО этот список.
    const availableActions = computeAvailableOrderActions(order, grantedPermissions);

    // D5 §11: Request→Order canonical relation (Request.convertedOrderId).
    const linkedRequest = await this.prisma.request.findFirst({
      where: { convertedOrderId: order.id },
      select: { id: true, referenceNumber: true, status: true, code: true },
      orderBy: { createdAt: "desc" },
    });

    // D5 §12: связанная бронь — exactly linked Booking для этого Order (V1: 1:1).
    const linkedBooking = await this.prisma.booking.findFirst({
      where: { orderId: order.id },
      select: { id: true, referenceNumber: true, status: true, code: true },
      orderBy: { createdAt: "asc" },
    });

    // Step 1.17: field-level redaction — traveler PII виден только OPERATOR/ADMIN.
    // D7 micro-closure: backend-authoritative derived financial values (Decimal precision)
    const totalAmt = new Prisma.Decimal(order.amount ?? 0);
    const paidAmt = new Prisma.Decimal(order.paidAmount ?? 0);
    const refundedAmt = new Prisma.Decimal(order.refundedAmount ?? 0);
    const dueAmount = Prisma.Decimal.max(new Prisma.Decimal(0), totalAmt.minus(paidAmt));
    const refundableAmount = Prisma.Decimal.max(new Prisma.Decimal(0), paidAmt.minus(refundedAmt));
    return {
      ...order,
      travelers: redactTravelersPii(order.travelers ?? [], viewer),
      customerDisplayName: customerDisplay?.displayName ?? null,
      partnerDisplayName: partnerDisplay?.displayName ?? null,
      availableActions,
      dueAmount: dueAmount.toString(),
      refundableAmount: refundableAmount.toString(),
      linkedRequest: linkedRequest ?? null,
      linkedBooking: linkedBooking ?? null,
    };
  }

  /**
   * D5 §35 — Order History API (paginated, stable ordering, server-authorized,
   * tenant/workspace-aware). Storefront Order history через platform контракт —
   * 404 (не обход D4 isolation).
   */
  async listOrderHistory(
    id: string,
    viewer: TravelerViewer,
    page = 1,
    pageSize = 20,
  ): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true, acquisitionSource: true },
    });
    if (!order) throw new NotFoundError(`Order ${id} not found`);
    if (viewer && order.acquisitionSource === PLATFORM_SCOPE_DENIED_SOURCE) {
      throw new NotFoundError(`Order ${id} not found`);
    }
    const p = Math.max(1, page);
    const ps = Math.min(100, Math.max(1, pageSize));
    const [items, total] = await Promise.all([
      this.prisma.orderHistory.findMany({
        where: { orderId: id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (p - 1) * ps,
        take: ps,
      }),
      this.prisma.orderHistory.count({ where: { orderId: id } }),
    ]);
    return { items, total, page: p, pageSize: ps };
  }

  /** D7: Payment history for a specific Order — used by Order/Booking financial sections. */
  async getPaymentHistoryForOrder(orderId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { orderId },
      select: {
        id: true, code: true, referenceNumber: true, status: true,
        amount: true, currency: true, paymentMethod: true, providerRef: true,
        paidAt: true, failedAt: true, cancelledAt: true, createdAt: true,
        isActivePayment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const history = await this.prisma.paymentHistory.findMany({
      where: { payment: { orderId } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { payments, history };
  }

  /** D7: Refund history for a specific Order — used by Order/Booking financial sections. */
  async getRefundHistoryForOrder(orderId: string) {
    const refunds = await this.prisma.refund.findMany({
      where: { orderId },
      select: {
        id: true, code: true, referenceNumber: true, status: true,
        amount: true, currency: true, reason: true,
        requestedAt: true, approvedAt: true, processedAt: true, failedAt: true,
        createdAt: true, isActiveRefund: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const history = await this.prisma.refundHistory.findMany({
      where: { refund: { orderId } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { refunds, history };
  }

  /**
   * D4 REMEDIATION F1 — DB-level serialization boundary для traveler mutation
   * ↔ final-confirm (TOCTOU, D4SR-F1).
   *
   * Обе стороны (traveler PATCH single/bulk и finalConfirm) захватывают
   * row-lock (SELECT ... FOR UPDATE) на строке Order ДО проверки/записи:
   *  - finalConfirm закоммитился первым → traveler mutation после получения
   *    lock видит finalConfirmedAt != NULL → ConflictError (R1);
   *  - traveler mutation удерживает lock первой → finalConfirm ждёт и затем
   *    наблюдает закоммиченное состояние туристов (R2).
   * Никакая traveler mutation не может закоммититься ПОСЛЕ успешного
   * finalConfirm (PostgreSQL: row lock живёт до конца транзакции).
   */
  private async lockOrderRowForMutation(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<{ finalConfirmedAt: Date | null }> {
    const rows = await tx
      .$queryRaw<Array<{ finalConfirmedAt: Date | null }>>`SELECT "finalConfirmedAt" FROM "order"."Order" WHERE "id" = ${orderId} FOR UPDATE`;
    if (!rows || rows.length === 0) throw new NotFoundError(`Order ${orderId} not found`);
    return rows[0];
  }

  /**
   * D4 REMEDIATION F6 — canonical dataCompleteness (общая для single и bulk
   * traveler mutation). Pinned snapshot — единственный источник REQUIRED:
   *  - pinned есть (D3/D4): COMPLETE ⇔ все REQUIRED-поля непусты;
   *    OPTIONAL/NOT_REQUESTED не становятся REQUIRED искусственно;
   *  - pinned нет (legacy pre-D3, bulk-контракт): полнота по passportNumber
   *    (историческое правило bulk PATCH — заказы вне D3-потока).
   */
  private computeTravelerCompleteness(
    pinned: TravelerFullRequirements | null,
    values: Partial<Record<TravelerField, string | Date | null | undefined>>,
  ): "COMPLETE" | "INCOMPLETE" {
    if (!pinned) {
      const pn = values.passportNumber;
      return pn !== null && pn !== undefined && String(pn).trim().length > 0 ? "COMPLETE" : "INCOMPLETE";
    }
    const required = (Object.keys(pinned) as TravelerField[]).filter((f) => pinned[f] === "REQUIRED");
    const missing = required.some((f) => {
      const v = values[f];
      return v === null || v === undefined || String(v).trim().length === 0;
    });
    return missing ? "INCOMPLETE" : "COMPLETE";
  }

  async updateTravelers(orderId: string, travelers: TravelerUpdateInput[], actor?: string, source?: AuditSource) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, code: true, termsAcceptedAt: true, finalConfirmedAt: true,
        acquisitionSource: true, pinnedRequirements: true,
      },
    });
    if (!order) throw new NotFoundError(`Order ${orderId} not found`);

    // D4 §10/§21: Storefront-tenant объекты не изменяются через platform
    // marketplace-контракты (UUID-directed команда → 404, enumeration protection).
    if (order.acquisitionSource === PLATFORM_SCOPE_DENIED_SOURCE) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    // D4 §13 (mutability): подтверждённые данные туристов immutable — PATCH
    // после final confirmation → server-side denial (D3-поток). Legacy-заказы
    // без finalConfirmedAt сохраняют прежний bulk-edit. Fast-path проверка;
    // authoritative граница — row-lock внутри tx (D4 REMEDIATION F1).
    if (order.finalConfirmedAt) {
      throw new ConflictError(`Order ${order.code} is already final-confirmed; traveler data is immutable`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // D4 REMEDIATION F1: DB row-lock (SELECT ... FOR UPDATE) до любой записи —
      // commit traveler mutation ПОСЛЕ успешного finalConfirm невозможен
      // (гонка D4SR-F1 закрыта на DB transaction/concurrency boundary).
      const locked = await this.lockOrderRowForMutation(tx, orderId);
      if (locked.finalConfirmedAt) {
        throw new ConflictError(`Order ${order.code} is already final-confirmed; traveler data is immutable`);
      }

      const existing = await tx.orderTraveler.findMany({ where: { orderId }, orderBy: { position: "asc" } });
      if (existing.length !== travelers.length) {
        throw new ValidationDomainError(`Expected ${existing.length} travelers, got ${travelers.length}`);
      }

      // D4 REMEDIATION F6: pinned snapshot — canonical источник полноты данных.
      // Legacy-Order без pinned (pre-D3) сохраняет исторический bulk-контракт
      // (полнота по passportNumber); D3/D4-заказы считают полноту по REQUIRED-
      // полям pinned — та же canonical логика, что у single PATCH travelers/:id.
      const pinned = order.pinnedRequirements as TravelerFullRequirements | null;

      const fieldChanges: AuditFieldChange[] = [];
      for (let i = 0; i < existing.length; i++) {
        const t = travelers[i];
        const values: Partial<Record<TravelerField, string | Date | null>> = {
          firstName: t.firstName ?? existing[i].firstName,
          lastName: t.lastName ?? existing[i].lastName,
          birthDate: t.birthDate ? new Date(t.birthDate) : existing[i].birthDate,
          citizenship: t.citizenship ?? existing[i].citizenship,
          gender: t.gender ?? existing[i].gender,
          passportNumber: t.passportNumber ?? existing[i].passportNumber,
          passportExpiry: t.passportExpiry ? new Date(t.passportExpiry) : existing[i].passportExpiry,
        };
        const prev: Record<string, unknown> = { ...existing[i] };
        const next: Record<string, unknown> = { ...existing[i], ...values };
        // D5 Entity Change Audit: field-level diff в структурированной (PII-safe)
        // форме; sensitive-поля маскируются shared-ядром аудита.
        const changes = diffAuditFields(TRAVELER_AUDIT_FIELDS, prev, next);
        for (const c of changes) {
          fieldChanges.push({ ...c, field: `traveler[${existing[i].position}].${c.field}` });
        }
        await tx.orderTraveler.update({
          where: { id: existing[i].id },
          data: {
            firstName: values.firstName as string,
            lastName: values.lastName as string,
            birthDate: values.birthDate as Date | null,
            citizenship: values.citizenship as string | null,
            gender: values.gender as string | null,
            passportNumber: values.passportNumber as string | null,
            passportExpiry: values.passportExpiry as Date | null,
            dataCompleteness: this.computeTravelerCompleteness(pinned, values),
            version: { increment: 1 },
          },
        });
      }

      await tx.orderHistory.create({
        data: {
          orderId,
          action: "update_travelers",
          source: source ?? "API",
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: "Обновлены данные туристов заказа",
          fields: fieldChanges.length > 0 ? (fieldChanges as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });
      return tx.orderTraveler.findMany({ where: { orderId }, orderBy: { position: "asc" } });
    });

    await this.eventBus.publishPending();
    return result;
  }

  /** Команда жизненного цикла (переход статуса). */
  async orderAction(orderId: string, action: OrderAction, actor?: string, reason?: string | null, source?: AuditSource) {
    const transition = TRANSITIONS[action];
    if (!transition) throw new ValidationDomainError(`Unknown action: ${action}`);

    const result = await this.prisma.$transaction(async (tx) => {
      // travelers нужны для confirm (проверка полноты данных); items больше НЕ
      // читаются здесь (payload BookingRequested минимизирован — STRICT REVIEW FIX).
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true, code: true, customerId: true, status: true, version: true,
          termsAcceptedAt: true, finalConfirmedAt: true, travelerCount: true,
          acquisitionSource: true,
          travelers: { select: { id: true, dataCompleteness: true } },
        },
      });
      if (!order) throw new NotFoundError(`Order ${orderId} not found`);
      // D4 §10/§21: lifecycle-команды по Storefront-tenant объекту через platform
      // marketplace-контракт → 404 (UUID-directed action, enumeration protection).
      if (order.acquisitionSource === PLATFORM_SCOPE_DENIED_SOURCE) {
        throw new NotFoundError(`Order ${orderId} not found`);
      }
      if (!transition.from.includes(order.status)) {
        throw new ConflictError(`Cannot ${action} order ${order.code} from status ${order.status}`);
      }

      // D3 SR R3 (Booking eligibility, hard §16): traveler-bearing D3 Order
      // (принятый checkout c traveler party list) НЕ может перейти в
      // READY_FOR_BOOKING / Booking до финального подтверждения собранных
      // данных туристов (finalConfirmedAt). D1: final confirmation → Booking.
      // Legacy Orders (до D3: termsAcceptedAt = null) и orders без travelers
      // (travelerCount 0) сохраняют прежний lifecycle.
      const d3TravelerScope = (order.travelerCount ?? 0) > 0 && order.termsAcceptedAt !== null;
      if (d3TravelerScope && !order.finalConfirmedAt && (action === "confirm" || action === "send")) {
        throw new ValidationDomainError(
          `Order ${order.code} requires final traveler confirmation (final-confirm) before ${action}; ` +
            `traveler data must be finalized first`,
        );
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
        select: { id: true, code: true, number: true, referenceNumber: true, customerId: true, status: true, version: true },
      });

      await tx.orderHistory.create({
        data: {
          orderId,
          action,
          from: order.status,
          to: transition.to,
          source: source ?? "API",
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: reason ? `${ACTION_LABELS[action]}: ${reason}` : ACTION_LABELS[action],
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

  // ══════════════════════════════════════════════════════════════════════════
  // D3 — Traveler Collection + Order/Booking Population
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * D3 §3 — Read pinned traveler requirements for an Order.
   * Immutable after termsAcceptedAt. Client cannot replace.
   */
  async getPinnedRequirements(orderId: string, viewer?: TravelerViewer): Promise<{
    pinnedRequirements: TravelerFullRequirements | null;
    termsAcceptedAt: Date | null;
    travelerDataCompletedAt: Date | null;
    finalConfirmedAt: Date | null;
    travelerCount: number | null;
    travelers: Array<{
      id: string;
      firstName: string;
      lastName: string;
      birthDate: Date | null;
      citizenship: string | null;
      gender: string | null;
      passportNumber: string | null;
      passportExpiry: Date | null;
      dataCompleteness: string;
    }>;
  }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        acquisitionSource: true,
        pinnedRequirements: true,
        termsAcceptedAt: true,
        travelerDataCompletedAt: true,
        finalConfirmedAt: true,
        travelerCount: true,
        travelers: {
          orderBy: [{ position: "asc" }, { id: "asc" }],
          select: {
            id: true, firstName: true, lastName: true, birthDate: true,
            citizenship: true, gender: true, passportNumber: true, passportExpiry: true,
            dataCompleteness: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundError(`Order ${orderId} not found`);
    // D4 §10/§21: Storefront-tenant traveler projection не читается через
    // platform marketplace-контракт (HTTP viewer → 404, enumeration protection).
    if (viewer && order.acquisitionSource === PLATFORM_SCOPE_DENIED_SOURCE) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }
    return {
      // D3 §3: pinned snapshot — immutable, server-owned (read-only for client).
      pinnedRequirements: order.pinnedRequirements as TravelerFullRequirements | null,
      termsAcceptedAt: order.termsAcceptedAt,
      travelerDataCompletedAt: order.travelerDataCompletedAt,
      finalConfirmedAt: order.finalConfirmedAt,
      travelerCount: order.travelerCount,
      // Step 1.17: field-level PII redaction — passport/birthDate виден только
      // OPERATOR/ADMIN (тот же контракт, что listOrders/getOrder; D3 §16).
      travelers: redactTravelersPii(order.travelers ?? [], viewer),
    };
  }

  /**
   * D3 §9 — Update individual traveler data (collector-driven, incremental save).
   * Validates against the PINNED requirements snapshot (immutable since
   * termsAcceptedAt — НЕ mutable Product policy, hard gate §3):
   *  - NOT_REQUESTED: поле отбрасывается — никогда не запрашивается/не хранится
   *    (минимизация §9);
   *  - REQUIRED: обязательность проверяется сервером при ЗАВЕРШЕНИИ
   *    (validateTravelerCompletion / finalConfirm). Здесь разрешён частичный
   *    save (save → refresh → resume, D3 §13). Пустое значение для REQUIRED
   *    поля → отклоняется (нельзя «стереть» обязательное поле);
   *  - OPTIONAL: валидируется формат при передаче; пустая строка = сброс (null);
   *  - birthDate/passportExpiry — строго YYYY-MM-DD (isDateOnly), иначе 422;
   *  - dataCompleteness вычисляется сервером из МЕРЖА (existing + new) значений.
   */
  async updateTravelerD3(
    orderId: string,
    travelerId: string,
    input: TravelerCollectInput,
    actor?: string,
    source?: AuditSource,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, code: true, termsAcceptedAt: true, pinnedRequirements: true,
        travelerCount: true, travelerDataCompletedAt: true, finalConfirmedAt: true,
        acquisitionSource: true,
      },
    });
    if (!order) throw new NotFoundError(`Order ${orderId} not found`);

    // D4 §10/§21: traveler-команда по Storefront-tenant объекту через platform
    // marketplace-контракт → 404 (UUID-directed mutation, enumeration protection).
    if (order.acquisitionSource === PLATFORM_SCOPE_DENIED_SOURCE) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    // D3 §19: traveler submission before acceptance — запрещено.
    if (!order.termsAcceptedAt) {
      throw new ValidationDomainError(`Order ${order.code} has no termsAcceptedAt; traveler submission before acceptance is not allowed`);
    }

    // D3 §19: mutation after final confirmation — запрещено (immutable).
    if (order.finalConfirmedAt) {
      throw new ConflictError(`Order ${order.code} is already final-confirmed; traveler data is immutable`);
    }

    // D3 §3: pinned snapshot — единственный источник требований.
    // Legacy Order без snapshot (до D3) — вне D3-потока сбора данных.
    const pinned = order.pinnedRequirements as TravelerFullRequirements | null;
    if (!pinned) {
      throw new ValidationDomainError(`Order ${order.code} has no pinned traveler requirements; traveler collection requires pinned snapshot (D3)`);
    }

    // D3 §9: strip NOT_REQUESTED + форматная валидация переданных значений.
    // undefined = поле не передано (сохранить existing); null = явный сброс.
    const filteredInput: Partial<Record<TravelerField, string | null>> = {};
    for (const [field, value] of Object.entries(input)) {
      if (!isTravelerField(field)) continue; // DTO ограничен; defensive skip
      const state = pinned[field as TravelerField];
      if (state === "NOT_REQUESTED") continue; // не храним чувствительные «на всякий случай»
      if (value === undefined || value === null) continue;
      const s = String(value);
      if (s.trim().length === 0) {
        if (state === "REQUIRED") {
          throw new ValidationDomainError(`Traveler field "${field}" is REQUIRED per pinned requirements and cannot be cleared`);
        }
        filteredInput[field as TravelerField] = null; // сброс optional
        continue;
      }
      if (field === "birthDate" || field === "passportExpiry") {
        if (!isDateOnly(s)) {
          throw new ValidationDomainError(`Traveler field "${field}" must be a valid date (YYYY-MM-DD)`);
        }
      }
      filteredInput[field as TravelerField] = s;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // D4 REMEDIATION F1: DB row-lock (SELECT ... FOR UPDATE) — authoritative
      // serialization с finalConfirm. D3 §19 повторная проверка внутри tx
      // заменена на блокировку строки Order: commit traveler save ПОСЛЕ
      // успешного final-confirm невозможен.
      const locked = await this.lockOrderRowForMutation(tx, orderId);
      if (locked.finalConfirmedAt) {
        throw new ConflictError(`Order ${order.code} is already final-confirmed; traveler data is immutable`);
      }

      const existing = await tx.orderTraveler.findFirst({
        where: { id: travelerId, orderId },
      });
      if (!existing) throw new NotFoundError(`Traveler ${travelerId} not found in Order ${order.code}`);

      // Мерж (existing + new): dataCompleteness по REQUIRED-полям pinned.
      const merged = (field: TravelerField): string | Date | null => {
        const v = filteredInput[field];
        if (v === undefined) return (existing as unknown as Record<string, unknown>)[field] as string | Date | null;
        if (v === null) return null;
        if (field === "birthDate" || field === "passportExpiry") return new Date(v);
        return v;
      };
      // D4 REMEDIATION F6: canonical полнота — ОБЩАЯ логика с bulk update
      // (computeTravelerCompleteness по REQUIRED-полям pinned snapshot).
      const finalValues: Partial<Record<TravelerField, string | Date | null | undefined>> = {
        firstName: merged("firstName"),
        lastName: merged("lastName"),
        birthDate: merged("birthDate"),
        citizenship: merged("citizenship"),
        gender: merged("gender"),
        passportNumber: merged("passportNumber"),
        passportExpiry: merged("passportExpiry"),
      };

      const updated = await tx.orderTraveler.update({
        where: { id: travelerId },
        data: {
          firstName: (merged("firstName") as string | null) ?? existing.firstName,
          lastName: (merged("lastName") as string | null) ?? existing.lastName,
          birthDate: merged("birthDate") as Date | null,
          citizenship: merged("citizenship") as string | null,
          gender: merged("gender") as string | null,
          passportNumber: merged("passportNumber") as string | null,
          passportExpiry: merged("passportExpiry") as Date | null,
          dataCompleteness: this.computeTravelerCompleteness(pinned, finalValues),
          version: { increment: 1 },
        },
      });

      // D5 Entity Change Audit: field-level diff (PII-safe) — same shared core,
      // что и bulk-путь. Sensitive значения (passport/birthDate) — masked.
      const fieldChanges = diffAuditFields(
        TRAVELER_AUDIT_FIELDS,
        existing as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
      );

      await tx.orderHistory.create({
        data: {
          orderId,
          action: "update_traveler_d3",
          source: source ?? "API",
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: `Traveler ${travelerId} data updated (D3 collection)`,
          fields: fieldChanges.length > 0 ? (fieldChanges as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });

      return updated;
    });

    return result;
  }

  /**
   * D3 §10 — Validate traveler completion (server-side gate).
   * complete = true ТОЛЬКО когда:
   *  - termsAcceptedAt установлен;
   *  - pinned requirements существуют (legacy Order без snapshot — вне D3);
   *  - traveler count удовлетворён (canonical count, §6);
   *  - все Travelers присутствуют и все их REQUIRED поля (по pinned) валидны.
   * При complete=true устанавливается travelerDataCompletedAt (server-owned;
   * однажды установлен — не перезаписывается; updatedAt НЕ используется).
   */
  async validateTravelerCompletion(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { travelers: true },
    });
    if (!order) throw new NotFoundError(`Order ${orderId} not found`);

    // D4 §10/§21: Storefront-tenant объект вне platform marketplace-контракта.
    if (order.acquisitionSource === PLATFORM_SCOPE_DENIED_SOURCE) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    if (!order.termsAcceptedAt) {
      throw new ValidationDomainError(`Order ${order.code} has no termsAcceptedAt`);
    }

    const pinned = order.pinnedRequirements as TravelerFullRequirements | null;
    if (!pinned) {
      return {
        complete: false,
        reason: "pinned traveler requirements missing (legacy order outside D3 flow)",
        travelerDataCompletedAt: null,
      };
    }

    // D3 §6: traveler count satisfied (canonical count source — server-owned).
    if (order.travelerCount && order.travelers.length < order.travelerCount) {
      return {
        complete: false,
        reason: `Expected ${order.travelerCount} travelers, have ${order.travelers.length}`,
        travelerDataCompletedAt: null,
      };
    }

    // D3 §10: все REQUIRED поля (по pinned snapshot) для каждого Traveler.
    const requiredFields = (Object.keys(pinned) as TravelerField[]).filter((f) => pinned[f] === "REQUIRED");
    const missing: string[] = [];
    for (const t of order.travelers) {
      for (const f of requiredFields) {
        const val = (t as unknown as Record<string, unknown>)[f];
        if (val === null || val === undefined || String(val).trim().length === 0) {
          missing.push(`${f} (${t.firstName} ${t.lastName})`);
        }
      }
    }
    if (missing.length > 0) {
      return {
        complete: false,
        reason: `${missing.length} required field(s) missing: ${missing.slice(0, 5).join("; ")}`,
        travelerDataCompletedAt: null,
      };
    }

    // dataCompleteness invariant (defense in depth — флаг хранится сервером).
    const flagIncomplete = order.travelers.filter((t) => t.dataCompleteness !== "COMPLETE");
    if (flagIncomplete.length > 0) {
      return {
        complete: false,
        reason: `${flagIncomplete.length} traveler(s) have incomplete data`,
        travelerDataCompletedAt: null,
      };
    }

    // D3 §10: travelerDataCompletedAt — один server-owned instant.
    if (!order.travelerDataCompletedAt) {
      const now = new Date();
      await this.prisma.order.update({
        where: { id: orderId },
        data: { travelerDataCompletedAt: now },
      });
      return { complete: true, reason: null, travelerDataCompletedAt: now };
    }

    return { complete: true, reason: null, travelerDataCompletedAt: order.travelerDataCompletedAt };
  }

  /**
   * D3 §10/§13 — Final confirmation gate.
   * Требует: termsAcceptedAt + pinned requirements + traveler count satisfied +
   * все REQUIRED fields valid + travelerDataCompletedAt + явное подтверждение.
   * Устанавливает finalConfirmedAt — ОТДЕЛЬНЫЙ от termsAcceptedAt момент
   * (принятие условий ≠ подтверждение после сбора данных).
   * Идемпотентность (§17): CAS updateMany (finalConfirmedAt IS NULL) —
   * double-click / concurrent retry → ровно ОДИН победитель; повторный вызов
   * после успеха → ConflictError (duplicate final confirm → нет дубля Order).
   */
  async finalConfirm(orderId: string, actor?: string, source?: AuditSource) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { travelers: true },
    });
    if (!order) throw new NotFoundError(`Order ${orderId} not found`);

    // D4 §10/§21: финальное подтверждение Storefront-tenant объекта через
    // platform marketplace-контракт → 404 (Storefront = tenant партнёра).
    if (order.acquisitionSource === PLATFORM_SCOPE_DENIED_SOURCE) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    // D3 §10: termsAcceptedAt required (terms acceptance ≠ final confirmation).
    if (!order.termsAcceptedAt) {
      throw new ValidationDomainError(`Order ${order.code}: final confirmation requires termsAcceptedAt`);
    }

    // D3 §10: pinned requirements must exist.
    if (!order.pinnedRequirements) {
      throw new ValidationDomainError(`Order ${order.code}: final confirmation requires pinned requirements`);
    }

    // D3 §10: traveler count satisfied.
    if (order.travelerCount && order.travelers.length < order.travelerCount) {
      throw new ValidationDomainError(
        `Order ${order.code}: traveler count not satisfied (expected ${order.travelerCount}, have ${order.travelers.length})`,
      );
    }

    // D3 §10: all REQUIRED fields valid (travelerDataCompletedAt).
    if (!order.travelerDataCompletedAt) {
      const completion = await this.validateTravelerCompletion(orderId);
      if (!completion.complete) {
        throw new ValidationDomainError(`Order ${order.code}: traveler data not complete — ${completion.reason}`);
      }
    }

    // D3 §19: duplicate final confirm → reject (не создаёт дубль Order).
    if (order.finalConfirmedAt) {
      throw new ConflictError(`Order ${order.code} is already final-confirmed`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // D4 REMEDIATION F1: DB row-lock до CAS — сериализация с traveler
      // mutation (single/bulk). Если traveler PATCH уже удерживает lock —
      // finalConfirm ждёт и наблюдает его закоммиченное состояние (R2); если
      // confirm коммитится первым — последующая traveler mutation под тем же
      // lock видит finalConfirmedAt != NULL и отклоняется (R1).
      const locked = await this.lockOrderRowForMutation(tx, orderId);
      if (locked.finalConfirmedAt) {
        throw new ConflictError(`Order ${order.code} is already final-confirmed`);
      }

      const now = new Date();
      // CAS (defense in depth; row-lock уже исключает конкурентного писателя).
      const updatedRows = await tx.order.updateMany({
        where: { id: orderId, finalConfirmedAt: null },
        data: { finalConfirmedAt: now },
      });
      if (updatedRows.count !== 1) {
        throw new ConflictError(`Order ${order.code} was concurrently final-confirmed`);
      }

      await tx.orderHistory.create({
        data: {
          orderId,
          action: "final_confirm",
          from: null,
          to: "final_confirmed",
          source: source ?? "API",
          actorId: actor ?? null,
          actorName: actor ?? null,
          comment: "Финальное подтверждение заказа (D3)",
        },
      });

      return { orderId, finalConfirmedAt: now };
    });

    return result;
  }
}
