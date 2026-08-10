# Order Creation Consumer (Phase 2 — Step 2.5)

## 1. Mission

Canonical Order creation из события `OrderRequested` (Step 2.4 boundary):

```text
Sale completion
→ canonical OrderRequested
→ Outbox (retryable)
→ OrderRequestedConsumer (Step 2.5)
→ canonical Order (ORD-*, TH-YYYY-######) + OrderItems + OrderTraveler
→ OrderCreated (result-event)
```

Ключевое правило: **Sales публикует `OrderRequested`; Sales НЕ пишет в order.*.
Order владеет созданием Order** (ADR-0001). За пределами шага: Order lifecycle
completion (Step 2.7), Booking (2.8), temporal-контракт (2.5A), acquisition
propagation (2.5B), удаление bootstrap (2.6), Reverse Marketplace (2.2A–2.2F).

## 2. Owner boundaries

| Домен | Владеет | Роль в 2.5 |
|---|---|---|
| Sales | Sale/CheckoutIntent/snapshot | публикует OrderRequested (2.4) |
| Order | Order/OrderItem/OrderTraveler/Fulfillment/history | consumer + `OrderService.createOrderFromRequested` (owner logic) |
| Catalog | Product/availability | READ-only: `product.type` (классификация для OrderItem.type) |
| Sales (READ-only) | CheckoutIntentTraveler | canonical traveler-контекст (payload без PII) |
| EventBus | Outbox/Inbox | emit/emitResult, publishPending, isProcessed/markProcessed, retryFailed |

Order НЕ пишет в sales.*/catalog.* — только READ-only cross-context reads по ID
(та же конвенция, что OrderSubscribers ↔ booking.*).

## 3. OrderRequested — authoritative input

Consumer строит Order из immutable payload события (Step 2.4 §5/G3), НЕ из
mutable Quote/Product/Checkout state:

- refs: `saleId/saleCode`, `checkoutId/checkoutCode`, `quoteId`, `customerId` (nullable),
  `reservationId` (primary availability hold ref), `reservationIds` (ВСЕ holds,
  один на item — multi-item Sale без потери кардинальности, STRICT REVIEW 2.5);
- frozen items: `productId/productCode/productTitle/productType/tariffId/tariffCode/quantity/unitPrice/amount`
  (`productType` — frozen стабильная классификация Product для OrderItem.type);
- frozen commercial snapshot: `currency/subtotal/discountType/discountValue/discountAmount/total`,
  payment terms (`paymentScheme/prepaymentType/prepaymentValue/initialAmount/remainingAmount`),
  `acquisitionSource`, `serviceDate`.

**Self-sufficiency (STRICT REVIEW 2.5):** consumer создаёт Order ТОЛЬКО из
frozen payload — никакого чтения mutable Catalog state (productType заморожен
в событии; price/amount — из payload). **Travelers НЕ в payload** (PII
minimization, Step 2.4 §5): consumer читает `CheckoutIntentTraveler` (sales.*)
по `checkoutId` — READ-only, минимальный snapshot (firstName/lastName/
birthDate); контекст **immutable после Sale completion** (`assertCheckoutNotCompleted`
блокирует мутации) → детерминированный replay.

Если payload невалиден (версия, пропущенные поля, невалидный money/дата,
unknown acquisitionSource/paymentScheme/discountType) —
`assertValidOrderRequestedPayload` (PURE) бросает до транзакции/reads:
событие → FAILED (retryable → poison после max попыток), никакого partial
Order graph.

## 4. Транзакция создания (атомарность)

`OrderRequestedConsumer` (order-requested.consumer.ts) в ОДНОЙ PostgreSQL
транзакции:

1. повторная проверка inbox (unique `consumerId+eventId`);
2. READ-only read: checkoutIntentTraveler (sales.*);
3. `OrderService.createOrderFromRequested(tx, …)` — domain-owned:
   - `ORD-*` (`IdsService.nextCode`) + `TH-YYYY-######` (`nextOrderNumber`,
     год по UTC — каноническая time-конвенция, Step 2.5 §7);
   - Order (status NEW, paymentStatus UNPAID, amount = frozen total, frozen
     snapshot/refs, `orderRequestedEventId` = OrderRequested eventId);
   - OrderItems (frozen snapshot, `type = payload.productType`; price/amount
     Decimal, без JS float);
   - OrderTraveler (firstName/lastName/birthDate, `dataCompleteness=INCOMPLETE`
     — passport-данные дополняются позже через PATCH /travelers);
   - Fulfillment (NOT_STARTED);
   - OrderHistory `created` (без PII, comment + fields refs);
   - `OrderCreated` — result-event через `emitResult` (PUBLISHED сразу, атомарно
     с Order в той же транзакции; НЕ виден без committed Order);
4. `inboxEvent.create` (markProcessed).

Откат транзакции откатывает ВЕСЬ граф + OrderCreated (failure atomicity: нет
Order без items, нет OrderCreated без Order, нет inbox-строки без side effect).

## 5. Идемпотентность / concurrency

Тройная защита «один Sale → один Order»:

1. `events.InboxEvent` (unique `consumerId+eventId`) — стандартный dedup;
2. **DB-level инвариант** `Order.saleId @unique` — корректность не зависит
   только от in-process пути; NULL допускается (legacy/bootstrap Order);
3. P2002 обрабатывается **констрейнт-специфично** (STRICT REVIEW 2.5): no-op
   ТОЛЬКО для idempotency-unique (inbox `consumerId+eventId`, `Order.saleId` —
   по `meta.target`); любой ДРУГОЙ unique-коллизии (code/number — настоящий
   дефект) пробрасывается → событие FAILED, а не ложный «уже обработано».

Concurrent доставка одного события → ровно один Order, один OrderCreated, одна
inbox-строка. Два разных события → два Order, разные ORD-*/TH-*, корреляции не
смешиваются. ID allocation — атомарный `BusinessSequence` upsert (без collision
retry loop, без client authority).

## 6. Correlation / causation (Step 1.15/1.15A)

`publishPending` исполняет consumer-а в новом processing context:
requestId новый, `correlationId` наследуется из OrderRequested,
`causationId = ev.id`, actor = SYSTEM. `OrderCreated` пишется через
`emitResult` с явным `correlationId = ev.correlationId`, `causationId = ev.id`.
Business-коды (SAL-/ORD-/QTE-/CKT-) НЕ используются как correlation.

## 7. Availability isolation

Step 2.4 уже выполнил capacity hold (catalog.AvailabilityReservation, RSR-*,
один hold на item). Step 2.5 **НЕ резервирует повторно** — Order хранит
`reservationId` (primary) + `reservationIds` (ВСЕ holds, Json). Инвариант:
`Sale completion = capacity hold`; `Order creation ≠ второй capacity decrement`.
Duplicate/retry доставки не дублируют резервации; multi-item Sale не теряет
кардинальность holds (STRICT REVIEW 2.5 fix).

## 8. PII / traveler snapshot

OrderTraveler — намеренный downstream snapshot только минимально необходимых
полей для будущего fulfillment (firstName/lastName/birthDate). НЕ копируются:
passport/документы (дополняются позже через updateTravelers), контакты,
CRM-объекты, внутренние заметки. PII отсутствует в: payload OrderRequested
(контракт 2.4), payload OrderCreated, OrderHistory, outbox/inbox-метаданных,
error-сообщениях.

## 9. Order ↔ Booking isolation

Step 2.5 создаёт **только Order**. Не создаются: Booking, `BookingRequested`,
ready-for-booking метки, завершение lifecycle. Booking создаётся по
`BookingRequested` (transition `send`, Step 2.7/2.8).

## 10. Bootstrap coexistence

`POST /orders/bootstrap` (Phase 1, ADMIN-only `order.import`) остаётся
временным (удаление — Step 2.6). Canonical commercial flow создаёт Order
ТОЛЬКО через OrderRequested consumer (доменная логика, НЕ симуляция HTTP
bootstrap). Bootstrap Order не имеет `saleId` — изолирован от canonical flow.

## 11. Migration

`20260810172000_add_order_creation_consumer` (additive, без db push/reset):

- `Order.customerId` → nullable (OrderRequested.customerId честно nullable —
  internal assisted flow без CRM-клиента; существующие строки не меняются);
- `Order` + upstream refs без FK: `saleId` (@unique), `saleCode`, `quoteId`,
  `checkoutId`, `reservationId`, `reservationIds` (Json, все holds),
  `orderRequestedEventId`;
- `Order` + frozen commercial snapshot: `subtotal`, `discountType`/`discountValue`/
  `discountAmount`, `paymentScheme`/`prepaymentType`/`prepaymentValue`/
  `initialAmount`/`remainingAmount`, `acquisitionSource` (discount/payment/
  acquisition — String-снапшоты: cross-schema enum ref запрещён).

Clean replay и drift — ноль (проверено `migrate deploy` + полный e2e).

## 12. Deferred / remaining

- **2.5A** — temporal-контракт (submittedAt/confirmedAt/…): НЕ реализован;
  Order.createdAt — честное время создания, никаких сфабрикованных milestone.
- **2.5B** — acquisition propagation (BUYER_REQUEST и др.): НЕ реализован;
  `acquisitionSource` сохранён на Order как snapshot (контекст не разрушен).
- **2.6** — удаление `/orders/bootstrap`.
- **2.7** — Order lifecycle completion; **2.8** — Booking creation.
- Reverse Marketplace (2.2A–2.2F, `reverse.*` ADR) — отдельно, не prerequisite.
