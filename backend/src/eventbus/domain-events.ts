/**
 * Event Catalog (Phase 1) — канонические типы событий и контракты payload.
 *
 * Издатели:
 *   Catalog: ProductCreated, ProductPublished, ProductArchived
 *   CRM:     CustomerCreated, CustomerUpdated, PartnerCreated
 *   Sales:   OrderRequested (Step 2.4 — Sale completion → OrderRequested; command в Order domain)
 *   Order:   OrderCreated, OrderReadyForBooking, OrderFulfilled, OrderClosed,
 *            OrderCancelled, OrderStatusChanged (технические переходы),
 *            BookingRequested (command в Booking domain)
 *   Booking: BookingCreated, BookingConfirmed, BookingRejected, BookingCancelled
 *
 * Подписчики:
 *   Order   ← OrderRequested (Step 2.5 consumer создаёт Order), BookingConfirmed,
 *             BookingRejected (агрегированное состояние)
 *   Booking ← BookingRequested (создание Booking + Passenger)
 *
 * Order НИКОГДА не пишет в таблицы Booking и наоборот — только события + чтение.
 *
 * Canonical Order events (Step 1.14):
 *  - OrderReadyForBooking — факт: Order достиг READY_FOR_BOOKING (transition
 *    `confirm`). ПЕРЕИМЕНОВАН из OrderApproved (та же семантика/переход, без
 *    потребителей). Это НЕ command в Booking: Booking запускается отдельным
 *    событием BookingRequested (transition `send`).
 *  - OrderFulfilled — факт: Order перешёл в FULFILLED (`complete` action ИЛИ
 *    reconcileOrder по всем терминальным броням).
 *  - OrderClosed — факт: Order перешёл в CLOSED (`close` action; CLOSED ≠
 *    CANCELLED ≠ FULFILLED).
 *  - OrderStatusChanged — остаётся ТОЛЬКО для технических/исторических
 *    переходов (process/markWaitingData/resumeProcessing/problem/suspend/
 *    PARTIALLY_FULFILLED/PROBLEM); canonical facts на него не мапятся.
 */
export const DomainEvents = {
  // Catalog
  ProductCreated: "ProductCreated",
  ProductPublished: "ProductPublished",
  ProductArchived: "ProductArchived",
  // CRM
  CustomerCreated: "CustomerCreated",
  CustomerUpdated: "CustomerUpdated",
  PartnerCreated: "PartnerCreated",
  // Sales → Order (Step 2.4: Sale completion → OrderRequested)
  OrderRequested: "OrderRequested",
  // Order
  OrderCreated: "OrderCreated",
  OrderReadyForBooking: "OrderReadyForBooking",
  OrderFulfilled: "OrderFulfilled",
  OrderClosed: "OrderClosed",
  OrderCancelled: "OrderCancelled",
  OrderStatusChanged: "OrderStatusChanged",
  BookingRequested: "BookingRequested",
  // Booking
  BookingCreated: "BookingCreated",
  BookingConfirmed: "BookingConfirmed",
  BookingRejected: "BookingRejected",
  BookingCancelled: "BookingCancelled",
  BookingStatusChanged: "BookingStatusChanged",
} as const;

export type DomainEventType = (typeof DomainEvents)[keyof typeof DomainEvents];

// ── Business Event Envelope (Step 1.15A) ─────────────────────────────────────
//
// Канонический envelope для cross-domain business events. Семантика полей —
// ADR-0010. Кратко:
//  - eventId/eventType/correlationId/causationId — как в Step 1.15;
//  - occurredAt — фактическое время business fact; для Phase 1 = Outbox
//    createdAt (событие пишется атомарно с transition в одной транзакции),
//    проектция выполняется при чтении (OutboxEnvelope.occurredAt);
//  - actor — typed actor (USER/SYSTEM/UNKNOWN), НЕ raw User/username;
//  - entityId/entityType — canonical aggregate (из Outbox aggregateId/aggregateType);
//  - source/version/metadata — ОТСУТСТВУЮТ в v1: нет authoritative значения
//    (source/channel не угадывается), нет реальной entity/event version,
//    metadata не нужна. Добавляются только при реальной необходимости (§12-14).

export type BusinessEventActor =
  | { type: "USER"; id: string }
  | { type: "SYSTEM"; id?: string }
  | { type: "UNKNOWN" };

export interface BusinessEventEnvelope<TPayload = unknown> {
  eventId: string;
  eventType: string;
  /** UTC ISO instant — фактическое время business fact (= outbox createdAt). */
  occurredAt: string;
  correlationId: string | null;
  causationId: string | null;
  actor: BusinessEventActor | null;
  entityId: string;
  entityType: string;
  payload: TPayload;
}

/**
 * Валидация canonical writer input (§18/§20): НЕ допускаем empty IDs,
 * пустые eventType, undefined payload, некорректный actor. Вызывается в
 * EventBusService.emit/emitResult ДО persist — невалидное событие не пишется.
 * eventId не валидируется (генерация UUID — ответственность Outbox).
 */
export function assertValidBusinessEventWrite(write: {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  actor?: BusinessEventActor | null;
}): void {
  if (typeof write.aggregateType !== "string" || write.aggregateType.trim().length === 0) {
    throw new Error(`[eventbus] aggregateType must be a non-empty string, got: ${String(write.aggregateType)}`);
  }
  if (typeof write.aggregateId !== "string" || write.aggregateId.trim().length === 0) {
    throw new Error(`[eventbus] aggregateId (entityId) must be a non-empty string, got: ${String(write.aggregateId)}`);
  }
  // STRICT REVIEW FIX: eventType должен быть canonical registry (никаких
  // случайных/опечатанных типов в durable ленте; §6/§24).
  if (typeof write.eventType !== "string" || !(Object.values(DomainEvents) as string[]).includes(write.eventType)) {
    throw new Error(`[eventbus] eventType must be a canonical DomainEvents value, got: ${String(write.eventType)}`);
  }
  if (write.payload === undefined || write.payload === null) {
    throw new Error(`[eventbus] payload must be defined for ${write.eventType}`);
  }
  if (write.actor !== undefined && write.actor !== null && !isValidActor(write.actor)) {
    throw new Error(`[eventbus] invalid actor for ${write.eventType}: ${JSON.stringify(write.actor)}`);
  }
}

/**
 * Строгая shape-валидация actor (§9): ТОЛЬКО разрешённые ключи, без лишних
 * полей (нельзя подсунуть email/name/roles в envelope actor); USER требует
 * non-empty id; UNKNOWN — без id.
 */
function isValidActor(actor: BusinessEventActor): boolean {
  const keys = Object.keys(actor).sort().join(",");
  if (actor.type === "USER") {
    return keys === "id,type" && typeof actor.id === "string" && actor.id.trim().length > 0;
  }
  if (actor.type === "SYSTEM") {
    if (keys === "type") return true;
    return keys === "id,type" && typeof actor.id === "string" && actor.id.trim().length > 0;
  }
  // UNKNOWN — только {type:"UNKNOWN"}, без id и без extra keys.
  return actor.type === "UNKNOWN" && keys === "type";
}

// ── Payload-контракты ────────────────────────────────────────────────────────

export interface ProductEventPayload {
  productId: string;
  code: string;
  title: string;
  type: string;
}

export interface CustomerEventPayload {
  customerId: string;
  code: string;
  name: string;
  changedFields?: string[];
}

export interface PartnerEventPayload {
  partnerId: string;
  code: string;
  name: string;
  source: string; // "partner_onboarding" | "crm_center"
}

/**
 * OrderRequested (Step 2.4) — canonical command Sales → Order domain.
 *
 * Содержит immutable commercial snapshot + refs (G3): Order consumer (Step 2.5)
 * создаёт Order/OrderItems из ЭТИХ фактов, НЕ читая mutable Catalog price.
 * БЕЗ PII: traveler details (имена/даты рождения) НЕ копируются в durable
 * outbox payload — Order consumer получит их canonical-чтением Sales-owned
 * CheckoutIntent при необходимости (Step 2.5). Только canonical refs.
 *
 * STRICT REVIEW 2.5 (fix):
 *  - `reservationIds` — ВСЕ catalog.AvailabilityReservation holds (один на item,
 *    детерминированный порядок); `reservationId` — первичный (первый) ref;
 *  - item `productType` — frozen стабильная классификация Product (consumer
 *    НЕ читает catalog.* для OrderItem.type — полная self-sufficiency).
 */
export interface OrderRequestedPayload {
  /** Payload schema version (независим от event version). */
  version: 1;
  saleId: string;
  saleCode: string;
  checkoutId: string;
  checkoutCode: string;
  quoteId: string;
  customerId: string | null;
  /** Primary (первая) capacity hold (catalog.AvailabilityReservation ref, без FK). */
  reservationId: string | null;
  /** ВСЕ capacity holds этого Sale (один на item, порядок = порядок items). */
  reservationIds: string[];
  /** Детерминированный состав (frozen QuoteItem snapshot). */
  items: Array<{
    productId: string;
    productCode: string;
    productTitle: string;
    /** Frozen стабильная классификация Product (для OrderItem.type). */
    productType: string;
    tariffId: string;
    tariffCode: string;
    quantity: number;
    unitPrice: string;
    amount: string;
  }>;
  /** Frozen commercial snapshot (без Catalog reprice). */
  currency: string;
  subtotal: string;
  discountType: string;
  discountValue: string | null;
  discountAmount: string | null;
  total: string;
  /** Payment terms snapshot (Step 2.3B, без reinterpretation). */
  paymentScheme: string | null;
  prepaymentType: string | null;
  prepaymentValue: string | null;
  initialAmount: string | null;
  remainingAmount: string | null;
  /** Acquisition source (Step 2.5B) — не ре-вычисляется consumer-ом. */
  acquisitionSource: string;
  serviceDate: string | null;
}

export interface OrderEventPayload {
  orderId: string;
  code: string;
  number: string;
  /** NULL — internal assisted flow без CRM-клиента (Step 2.5 canonical Order). */
  customerId: string | null;
  amount: string;
  currency: string;
}

/** Канонический Order ref (Step 1.14): минимальный payload для факт-событий
 *  (ReadyForBooking / Fulfilled / Closed / Cancelled). Без PII, без raw Prisma.
 *  customerId может быть NULL (canonical Order без CRM-клиента, Step 2.5). */
export interface OrderRefPayload {
  orderId: string;
  code: string;
  customerId: string | null;
}

/**
 * Минимальный command-payload (STRICT REVIEW FIX, PII minimization): consumer
 * (BookingSubscribers) читает order.items/order.travelers из БД по orderId
 * (READ-only, ADR-0001) — items/travelers в payload были РЕДУНДАНТНЫ и несли
 * паспортные данные туристов в durable Outbox. Остаются только canonical refs.
 * customerId может быть NULL (canonical Order без CRM-клиента, Step 2.5).
 */
export interface BookingRequestedPayload {
  orderId: string;
  orderCode: string;
  customerId: string | null;
}

export interface BookingEventPayload {
  bookingId: string;
  code: string;
  orderId: string;
  productId: string;
  reason?: string;
}

export interface StatusChangedPayload {
  from: string;
  to: string;
  reason?: string;
  actor?: string;
}
