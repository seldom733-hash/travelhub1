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
 *   Booking: BookingCreated, BookingConfirmed, BookingRejected, BookingCancelled,
 *             BookingCompleted (Step 2.9 — canonical fulfillment факт)
 *
 * Подписчики:
 *   Order   ← OrderRequested (Step 2.5 consumer создаёт Order), BookingConfirmed,
 *             BookingRejected, BookingStatusChanged (агрегированное состояние)
 *   Booking ← BookingRequested (создание Booking + Passenger),
 *             OrderCancelled (Step 2.9 compensation: отмена активных броней заказа)
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
  // Step 2.9: canonical fulfillment факт (ровно одно на реальный complete).
  // BookingStatusChanged остаётся техническим (существующий consumer-контракт
  // Order reconcile, approved 2.5A); BookingCompleted — canonical факт без
  // consumer-а (лента/аналитика), не заменяет BookingStatusChanged.
  BookingCompleted: "BookingCompleted",
  // Finance — Payment (Step 2.12, provider-neutral Payment runtime).
  // PaymentCreated — инициация (PENDING); PaymentCaptured — успех (money
  // received, PENDING → CAPTURED; consumer — Order projection paymentStatus/paidAmount);
  // PaymentFailed / PaymentCancelled — терминальные отклонения (лента/аналитика;
  // Order projection НЕ реагирует — обязательство остаётся UNPAID).
  PaymentCreated: "PaymentCreated",
  PaymentCaptured: "PaymentCaptured",
  PaymentFailed: "PaymentFailed",
  PaymentCancelled: "PaymentCancelled",
  // Finance — Refund (Step 2.13, provider-neutral Refund runtime).
  // RefundCreated — запрос (REQUESTED); RefundApproved — согласован (APPROVED);
  // RefundProcessed — деньги возвращены (PROCESSED; consumer — Order-owned
  // projection refundedAmount/paymentStatus); RefundFailed — терминальное
  // отклонение (FAILED; capacity-слот и idempotency-слот освобождены —
  // attempt 2 легален; Order projection НЕ реагирует).
  RefundCreated: "RefundCreated",
  RefundApproved: "RefundApproved",
  RefundProcessed: "RefundProcessed",
  RefundFailed: "RefundFailed",
  // Finance — Dispute (Step 2.13A, provider-neutral Chargeback/Dispute
  // Foundation). DisputeOpened — создание (OPENED, openedAt); DisputeResolved /
  // DisputeCancelled — терминальные переходы (лента/аналитика; consumer-ов нет:
  // 0 cross-domain projections — Roadmap 2.13A их не требует). События НЕ
  // обещают PSP completion / ledger posting / commission reversal (deferred).
  DisputeOpened: "DisputeOpened",
  DisputeResolved: "DisputeResolved",
  DisputeCancelled: "DisputeCancelled",
  // Finance — CommissionAccrual (Step 2.12E, PARTNER_COLLECT, ADR-0013 D19).
  // CommissionAccrued — признание receivable Partner → TravelHub на Order
  // creation из frozen commissionSnapshot (producer — Finance). Future
  // consumer-ы: Ledger (2.12D), Settlement (2.14A), Invoice (2.14) — НЕ
  // создаются в 2.12E (0 consumer-ов). Policy-событий НЕТ (master data +
  // AuditLog/History).
  CommissionAccrued: "CommissionAccrued",
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
//  - source — ОТСУТСТВУЕТ в v1: нет authoritative значения (source/channel
//    не угадывается). version: Step 2.17 — аддитивный envelope schemaVersion=1
//    (см. BusinessEventEnvelope.version); entity/event версии — вне v1.
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
  /** Step 2.17: envelope schemaVersion (additive default v1). Consumers MAY check
   *  this to reject unknown future versions; v1 consumers must tolerate >= 1.
   *  ADR-0010 envelope v1 ранее не имел version — добавление аддитивно. */
  version: number;
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
  /** Step 2.8A: frozen local temporal факты (verbatim из CheckoutIntent через
   *  Sale snapshot). serviceTime/serviceEndTime — local wall-clock "HH:mm";
   *  serviceTimeZone — IANA (Catalog authority, frozen при binding). Date-only
   *  услуга: все null. UTC instant НЕ передаётся — единственная деривация на
   *  Booking (§13). Additive, v1-совместимы (null/undefined = date-only). */
  serviceTime: string | null;
  serviceEndTime: string | null;
  serviceTimeZone: string | null;
  /** Step 2.12E (ADR-0013 D7): frozen commission snapshot Json (verbatim из
   *  CheckoutIntent через Sale). NULL = нет commission-контекста (no-commission
   *  канал / NO_POLICY fail-closed / legacy). Additive, v1-совместим. */
  commissionSnapshot: unknown;
  /** Step 2.12E (ADR-0013 D14): frozen seller attribution (snapshot-at-event,
   *  НЕ live lookup). NULL = multi-seller/нет seller → 0 commission-фактов. */
  sellerPartnerId: string | null;
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

/**
 * Payment event payload (Step 2.12). Минимальный, PII-free: canonical refs +
 * frozen money facts (amount/currency verbatim из Order snapshot).
 * PaymentCaptured несёт amount/currency — Order-owned projection subscriber
 * self-sufficient (без чтения finance.*); НЕ содержит provider payload/
 * card/PAN/CVV/секретов (только opaque refs).
 */
export interface PaymentEventPayload {
  paymentId: string;
  code: string;
  orderId: string;
  /** NULL — internal assisted flow (как Order.customerId). */
  customerId: string | null;
  /** Frozen money fact (Decimal string, DECIMAL(12,2)) — verbatim из Order. */
  amount: string;
  currency: string;
  /** Опциональный descriptive метод (manual/provider-neutral; без PII). */
  method?: string | null;
}

/**
 * Refund event payload (Step 2.13). Минимальный, PII-free: canonical refs +
 * frozen money fact (amount/currency verbatim из CAPTURED Payment).
 * RefundProcessed несёт orderId+amount — Order-owned projection subscriber
 * self-sufficient (refundedAmount/paymentStatus; без чтения finance.*).
 * НЕ содержит provider payload/card/PAN/CVV/секретов (только opaque refs).
 */
export interface RefundEventPayload {
  refundId: string;
  code: string;
  paymentId: string;
  orderId: string;
  /** Frozen money fact (Decimal string, DECIMAL(12,2)) — verbatim из Payment. */
  amount: string;
  currency: string;
  /** Опциональный business reason (descriptive; без PII). */
  reason?: string | null;
}

/**
 * Dispute event payload (Step 2.13A). Минимальный, PII-free: canonical refs +
 * frozen money fact (amount/currency verbatim из CAPTURED Payment).
 * Consumer-ов нет (Roadmap 2.13A не требует cross-domain projections);
 * НЕ содержит provider payload/evidence-body/card/PAN/CVV/секретов.
 */
export interface DisputeEventPayload {
  disputeId: string;
  code: string;
  paymentId: string;
  orderId: string;
  /** Frozen money fact (Decimal string, DECIMAL(12,2)) — verbatim из Payment. */
  amount: string;
  currency: string;
  /** Опциональный business reason (descriptive; без PII). */
  reason?: string | null;
}

/**
 * Step 2.12E — CommissionAccrued (PARTNER_COLLECT, ADR-0013 D19).
 * Producer: Finance (признание на Order creation из frozen commissionSnapshot).
 * Поля — durable refs + frozen money/policy факты (без PII, без raw Prisma).
 * correlation/causation наследуются из OrderCreated (canonical chain).
 * Future consumer-ы (Ledger 2.12D / Settlement 2.14A / Invoice 2.14) читают
 * frozen provenance (policyCode/version, baseAmount) — без live policy lookup.
 */
export interface CommissionAccruedPayload {
  /** Commission (CMS-*, canonical earned-факт). */
  commissionId: string;
  commissionCode: string;
  /** CommissionAccrual (CAA-*, receivable). */
  accrualId: string;
  accrualCode: string;
  orderId: string;
  orderCode: string;
  /** Frozen sellerPartnerId (ref crm.Partner, без FK; бизнес-идентификатор). */
  partnerId: string;
  /** Frozen CommissionChannel (MARKETPLACE V1). */
  channel: string;
  /** Frozen collection model (PARTNER_COLLECT V1). */
  collectionModel: string;
  /** Frozen earned amount (Decimal string, DECIMAL(12,2)). */
  amount: string;
  currency: string;
  /** Frozen policy provenance (из commissionSnapshot — без live lookup). */
  policyCode: string;
  policyVersion: number;
  /** Frozen calculation base (Order.total, Decimal string). */
  baseAmount: string;
  baseCurrency: string;
  /** Frozen business instant селекции policy (Quote ISSUE, ISO 8601). */
  selectedAt: string;
}
