# Event Catalog (Phase 1)

## Business Event Envelope (Step 1.15A)

Единый канонический envelope для **cross-domain business events** (ADR-0010).
Consumer-ы получают normalized envelope (projection при чтении, §19):

```ts
type BusinessEventEnvelope<TPayload> = {
  eventId: string;            // events.OutboxEvent.id — global unique, immutable,
                              // стабилен через retry; НЕ равен entityId
  eventType: string;          // canonical registry (см. ниже)
  occurredAt: string;         // UTC ISO — фактическое время business fact
                              // (= Outbox createdAt: событие пишется атомарно
                              //  с transition в одной транзакции, §26 опция A)
  correlationId: string | null; // техническая causal chain (Step 1.15, ADR-0009)
  causationId:   string | null; // ID события-родителя (непосредственная причина)
  actor: BusinessEventActor | null; // {type:"USER",id} | {type:"SYSTEM",id?}
                              //   | {type:"UNKNOWN"} | null (legacy/unknown)
  entityId: string;           // canonical aggregate (Outbox aggregateId)
  entityType: string;         // "Product" | "Customer" | "Partner" | "Order" | "Booking"
  payload: TPayload;          // domain-specific typed contract
}
```

Хранение: `events.OutboxEvent` — envelope-поля = columns (`eventId`→`id`,
`entityId`→`aggregateId`, `entityType`→`aggregateType`, `occurredAt`→проекция
`createdAt`, `actor`→JSON column), `payload` = Json. `source`/`version`/`metadata`
в v1 envelope ОТСУТСТВУЮТ (нет authoritative значения — не угадываются, §12-14).

**Actor** (`actor Json?`, additive nullable, NO backfill):
- `{type:"USER", id}` — authenticated command (canonical userId из JwtAuthGuard,
  НЕ username/email/permissions);
- `{type:"SYSTEM"}` — событие, созданное обработкой события consumer-ом
  (context publishPending);
- `null`/`UNKNOWN` — public/anonymous/legacy (без fake backfill).

Legacy-строки (без actor/NULL correlation) остаются читаемыми: projection
возвращает actor=null, correlationId=null — без угадывания.

Envelope иммутабелен: после persist не меняются eventId/occurredAt/actor/
entityId/payload/correlation/causation; retry/PENDING/FAILED/PUBLISHED меняет
только processing-state columns (status/publishedAt/error).

## Correlation / Request ID (Step 1.15)

Единый технический correlation/request context (HTTP request → domain operation →
Outbox event → consumer → child event → diagnostics/audit):

- `requestId` — конкретный HTTP request / processing invocation (UUID v4,
  server-authoritative; response header `X-Request-Id`). Валидный client
  `X-Request-Id` эхо-отражается как requestId (diagnostic contract).
- `correlationId` — вся логическая causal chain. Для корневого HTTP flow
  ВСЕГДА server-authoritative UUID: НЕ равен client-supplied `X-Request-Id`
  (повтор client UUID в независимых requests даёт разные correlationId —
  chains не сливаются); равен requestId только когда client ID отсутствует.
  **НЕ является business entity ID** (НЕ Order.code / Booking.code /
  submissionId) и НЕ behavioral eventId/sessionId.
- `causationId` — непосредственная причина: для child event, порождённого event
  consumer, ссылается на eventId родителя.

Правила (подробно — ADR-0009):
- HTTP: сервер сам назначает requestId/correlation (client `X-Request-Id`
  принимается только как валидный UUID diagnostic echo; произвольный client
  `X-Correlation-Id` НЕ формирует authoritative chain).
- Consumer: при обработке события устанавливается новый invocation context
  (requestId новый, correlation наследуется из события, causation = eventId
  родителя). Inbox dedup НЕ ломается; повторная доставка не создаёт новый
  effect/chain.
- Legacy строки с NULL correlation обрабатываются штатно (NULL = unknown
  correlation, без fake backfill).

## Издатели

| Событие | Издатель | Payload |
|---|---|---|
| `ProductCreated` | Catalog | `{ productId, code, title, type }` |
| `ProductPublished` | Catalog | `{ productId, code, title, type }` |
| `ProductArchived` | Catalog | `{ productId, code, title, type }` |
| `CustomerCreated` | CRM | `{ customerId, code, name }` — data-minimized (нет consumer-ов; email остаётся в CRM master-data, STRICT REVIEW FIX) |
| `CustomerUpdated` | CRM | `{ customerId, code, name, changedFields[] }` |
| `PartnerCreated` | CRM | `{ partnerId, code, name, source }` — `source`: "partner_onboarding"\|"crm_center" (onboarding channel, НЕ acquisition); contactEmail/registrationNumber убраны (STRICT REVIEW FIX) |
| `OrderRequested` | Sales | immutable commercial snapshot + refs (Step 2.4 §5; STRICT REVIEW 2.5: +`reservationIds` (все holds), +item `productType` frozen; Step 2.8A: +frozen local temporal факты): `{ version, saleId, saleCode, checkoutId, checkoutCode, quoteId, customerId\|null, reservationId\|null, reservationIds[], items[{productId, productCode, productTitle, productType, tariffId, tariffCode, quantity, unitPrice, amount}], currency, subtotal, discountType, discountValue\|null, discountAmount\|null, total, paymentScheme\|null, prepaymentType\|null, prepaymentValue\|null, initialAmount\|null, remainingAmount\|null, acquisitionSource, serviceDate\|null, serviceTime\|null (local HH:mm), serviceEndTime\|null (local HH:mm), serviceTimeZone\|null (IANA) }` — **command** в Order domain; retryable=true (durable retry); БЕЗ PII (travelers — READ-only из CheckoutIntent, immutable после completion). Step 2.8A: time/zone — frozen verbatim из CheckoutIntent (zone — authority Catalog через binding); валидация на входе consumer-а (time без zone / не-IANA / не-HH:mm → событие FAILED, никакого Order) |
| `OrderCreated` | Order | `{ orderId, code, number, customerId, amount, currency }` — `customerId` может быть NULL (canonical Order без CRM-клиента, internal assisted flow, Step 2.5) |
| `OrderReadyForBooking` | Order | `{ orderId, code, customerId }` — факт: заказ готов к бронированию (transition `confirm`; бывш. `OrderApproved`, Step 1.14) |
| `OrderFulfilled` | Order | `{ orderId, code, customerId }` — факт: заказ исполнен (`complete` или reconcile по терминальным броням, Step 1.14) |
| `OrderClosed` | Order | `{ orderId, code, customerId }` — факт: заказ закрыт (`close`; CLOSED ≠ CANCELLED ≠ FULFILLED, Step 1.14) |
| `OrderCancelled` | Order | `{ orderId, code, customerId }` |
| `OrderStatusChanged` | Order | `{ from, to, reason?, actor? }` — **только технические переходы** (process/markWaitingData/resumeProcessing/problem/suspend/PARTIALLY_FULFILLED/PROBLEM); canonical факты на него не мапятся |
| `BookingRequested` | Order | `{ orderId, orderCode, customerId }` — command в Booking domain (transition `send`; НЕ заменяет `OrderReadyForBooking`). STRICT REVIEW FIX (PII): items/travelers (паспортные данные) убраны из durable payload — consumer читает order.items/order.travelers из БД по orderId (READ-only). Step 2.8: кардинальность `1 OrderItem → 1 Booking` (DB unique `Booking.orderItemId`). Step 2.8A: temporal payload НЕ расширяется (minimal §11) — frozen local факты (serviceDate/serviceTime/serviceEndTime/serviceTimeZone) читаются consumer-ом из Order (READ-only, verbatim), UTC instants деривируются ОДИН раз при создании |
| `BookingCreated` | Booking | `{ count, bookings[{id,code}], orderId }` — result-event, ровно ОДНО на обработку BookingRequested (без PII; correlation наследуется, causation = `BookingRequested.eventId`; actor SYSTEM; не эмитится на duplicate/no-op; consumer-ов нет) |
| `BookingConfirmed` | Booking | `{ bookingId, code, orderId, productId }` |
| `BookingRejected` | Booking | `{ bookingId, code, orderId, productId, reason }` |
| `BookingCancelled` | Booking | `{ bookingId, code, orderId, productId }` — HTTP-команда `cancel`, а также result-event компенсации от OrderCancelled-консьюмера (добавляется `reason: "Заказ отменён"`; Step 2.9 §15) |
| `BookingStatusChanged` | Booking | `{ from, to, bookingId, orderId, code }` — технический переход (prepare/send/requestClarification/resume/service/requestChange/resolveChange/requestCancellation/problem/complete) |
| `BookingCompleted` | Booking | `{ bookingId, code, orderId, productId }` — **canonical fulfillment факт (Step 2.9 §17)**: ровно одно на реальный `complete` (CAS); эмитится атомарно с техническим `BookingStatusChanged` (существующий Order-reconcile-контракт 2.5A); consumer-ов нет (лента/аналитика) |

## Подписчики

| Домен | Событие | Действие |
|---|---|---|
| **Order** | `OrderRequested` | создаёт canonical Order (ORD-* + TH-YYYY-######), OrderItems, OrderTraveler (snapshot из CheckoutIntent), Fulfillment, публикует OrderCreated (result-event); идемпотентно (InboxEvent + `Order.saleId @unique`, один Sale → один Order; P2002 — констрейнт-специфично) |
| **Booking** | `BookingRequested` | создаёт Booking (BKG-*) на каждый OrderItem (linkage `orderItemId`, DB unique) + Passenger из COMPLETE OrderTraveler; идемпотентно (InboxEvent + проверка существующих броней + DB unique orderItemId); frozen acquisitionSource verbatim; availability не трогает. Step 2.8A: `serviceTimeType` (DATE_ONLY|TIME_SLOT|OPEN_DATE; DATE_RANGE зарезервирован) из presence-фактов; local время/zone verbatim из Order; `serviceStartsAt/EndsAt` — деривированные UTC instants (Intl, детерминированно), date-only → NULL (00:00 НЕ фабрикуется) |
| **Order** | `BookingConfirmed` | реконсиляция агрегата: `SENT_TO_BOOKING → PARTIALLY_FULFILLED → FULFILLED` |
| **Order** | `BookingStatusChanged` (→ CONFIRMED/IN_SERVICE/COMPLETED) | реконсиляция агрегата |
| **Order** | `BookingRejected` | заказ → `PROBLEM` |
| **Booking** | `OrderCancelled` | компенсация (Step 2.9 §15): активные Booking заказа → `CANCELLED` (CAS + BookingHistory `cancelled_order` + result-event `BookingCancelled`); терминальные не трогаются; no hard delete; Order НЕ пишется; availability release/refund — вне owner-контракта (не реализуется) |

**Canonical Order events (Step 1.14):** факт-события публикуются **атомарно**
с переходом (state + OrderHistory + OutboxEvent в одной транзакции), ровно один
раз на логический переход (optimistic concurrency `updateMany where id+status+
version` + from-guard). `OrderReadyForBooking` НЕ запускает Booking — Booking
создаётся только по `BookingRequested` (Variant 2):

```text
confirm → OrderReadyForBooking (факт)      send → BookingRequested (command) → Booking
complete/reconcile → OrderFulfilled (факт) close → OrderClosed (факт)
cancel → OrderCancelled (факт)
прочие → OrderStatusChanged (технический)
```

`occurredAt` = `OutboxEvent.createdAt` (записывается в той же транзакции, что и
переход — честное event time). Проверено per-producer (Order/Booking/CRM/Catalog):
emit всегда в той же `$transaction`, что и business mutation (включая события
reconcile — OrderFulfilled пишется атомарно с переходом агрегата).

`correlationId`/`causationId` наследуются из активного request context
(AsyncLocalStorage, `backend/src/shared/request-context.ts`) и могут быть явно
переопределены вызывающим (legacy/иные источники). NULL = unknown.

**Правило:** Order никогда не пишет в таблицы Booking и наоборот.
Взаимодействие — только события + чтение по ID.

## Механика (transactional outbox)

1. Домен в своей транзакции меняет сущность и вызывает `EventBusService.emit(tx, …)`
   — событие записывается в `events.OutboxEvent` **атомарно** с изменением.
2. После коммита домен вызывает `publishPending()` — диспетчер рассылает
   PENDING-события подписчикам и помечает их PUBLISHED (при ошибке — FAILED,
   событие сохраняется для диагностики; автоматический publisher retry
   FAILED-событий — за пределами Step 1.14, фиксируется как debt).
3. События-результаты (`BookingCreated`, `OrderCreated` из consumer-ов)
   пишутся сразу PUBLISHED (фиксация факта в ленте, без повторной рассылки).
4. Идемпотентность consumer-ов: `events.InboxEvent` (unique consumerId+eventId).

Реализация: `backend/src/eventbus/eventbus.service.ts`,
`backend/src/eventbus/domain-events.ts`.

## Communication (Step 1.16)

`CommunicationCreated` **НЕ эмитится**: у Communication нет реального consumer-а
(Step 1.16 §19 — event taxonomy «на будущее» запрещена). Communication —
durable fact в `communication.Communication` (CML-*, ADR-0011), аудируется в
AuditLog без body. Если появится реальный consumer — событие добавляется в
canonical registry по envelope ADR-0010 с payload из references/minimal
metadata (БЕЗ body/PII, §21/§54).
