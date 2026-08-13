# TravelHub — Phase 2 Step 2.8 — BookingRequested → Booking Creation (архитектурный артефакт)

**Статус:** Step 2.8 ✅ STRICT REVIEW COMPLETED — APPROVED (2026-08-12; независимый adversarial-аудит — PHASE_2_STEP_2.8_BOOKINGREQUESTED_TO_BOOKING_CREATION_STRICT_REVIEW.md; регрессия 909/909 e2e + 459 unit + 135 frontend + build + migrate 43/43 drift 0)
**Owner:** Booking Center (`booking.*`, ADR-0001). **Boundary:** Order публикует
`BookingRequested` (command); Booking создаётся ТОЛЬКО Booking-owned consumer-ом.
**Источники:** Roadmap v3 (2.7/2.8/2.8A/2.9); Step 2.7 Strict Review (отчёт +
fixes); Screen Design Brief (Booking codes); Step 1.14 canonical Order events;
Steps 2.4/2.5/2.5B/2.6/2.7 артефакты; `docs/contracts/events.md` + `api.md`;
ADR-0001 (ownership), ADR-0009/0010 (correlation/envelope); Prisma schema.

---

## 1. Назначение

Step 2.8 **канонизирует и укрепляет pre-existing Phase 1 consumer**
`booking.subscribers.ts` (зарегистрирован в production с Phase 1, «Baseline §9,
Phase 1 DoD»; Step 2.7 Strict Review подтвердил его как одобренный scaffolding и
определил scope 2.8 = реконсиляция, а НЕ создание второго механизма).

Единственный канонический инвариант:

`Order → BookingRequested → Booking-owned consumer → canonical Booking`

— без прямых записей Order → booking.*, без HTTP/bootstrap/manual create-пути
(POST /bookings не существует).

## 2. Current → Target reconciliation (факт до 2.8 → после)

| Аспект | До 2.8 (Phase 1 scaffolding) | После 2.8 (canonical) |
|---|---|---|
| Payload BookingRequested | `{orderId, orderCode, customerId}` (PII-minimized) | без изменений (canonical) |
| Consumer | `booking-requested-consumer`, production (BookingModule) | без изменений |
| Кардинальность | 1 OrderItem → 1 Booking (кодовая, count-check) | **+ DB-level `orderItemId @unique`** (1 OrderItem → ≤1 Booking) |
| Linkage Booking→Order/Item | orderId + productId | **+ orderItemId** (новые Booking; legacy NULL без backfill) |
| Passenger | из COMPLETE OrderTraveler (per Booking) | без изменений (canonical; no placeholder) |
| Acquisition | verbatim из Order (вкл. null) | без изменений |
| Money | amount = item.amount (frozen Decimal) | без изменений (без reprice/POR) |
| Availability | не трогает | не трогает (hold = Step 2.4, единственный) |
| Idempotency | InboxEvent + count-check + P2002-specific | **+ DB unique (orderItemId)** |
| BookingCreated | одно result-событие {count, bookings[], orderId} | без изменений (canonical, events.md) |
| Booking lifecycle PATCH | только DTO-whitelist (silent strip) | **+ forbidden-key 422** (`booking.validation.ts`, §28) |

Production-дельта минимальна и архитектурно-нейтральна: **ни один существующий
поток не переписан** — добавлены DB-инвариант, linkage-поле, mass-assignment
защита и полное покрытие.

## 3. Domain ownership — HARD GATE (аудит §5/§37)

Все production-писатели `booking.*` (repo-wide, без generated/spec):

| Writer | Действие | Классификация |
|---|---|---|
| `booking.subscribers.ts` | `booking.create` + `passenger.create` + `bookingHistory.create` | **canonical Step 2.8 creation** (единственный) |
| `booking.service.ts` | `booking.update` (lifecycle) + `bookingHistory.create` + события | canonical later lifecycle (2.9) |
| `catalog.service.ts` | `availabilityReservation.create` (Step 2.4 hold) | Availability domain (не Booking flow) |

Второго механизма создания/импорта/provisioning НЕТ. Категория 5 (obsolete/
unsafe) = 0. Order-модуль НЕ пишет в booking.* (только READ в consumer-ах).

## 4. Canonical trigger — HARD GATE

`BookingRequested` — единственный триггер создания нормальной Booking:
- POST /bookings → 404 (контроллер: только GET list/get + PATCH action);
- bootstrap/manual create, OrderReadyForBooking→Booking, OrderStatusChanged→Booking,
  Sale/Checkout→Booking, duplicate consumer — НЕ существуют (проверено).

## 5. Event contract

`BookingRequested` (v1, Order aggregate): payload `{orderId, orderCode, customerId}`
— без PII (items/travelers удалены STRICT REVIEW 2.7 FIX). Consumer получает
детали заказа authoritative server-side READ по orderId (`order.findUnique` +
items + travelers; READ-only, ADR-0001) — не зависит от mutable client-снапшотов.
correlation наследуется, causation = producer (для HTTP send: correlation = server
UUID, causation = null; для consumer-результата BookingCreated: causation =
BookingRequested.eventId).

## 6. Frozen Order snapshot consumption

Booking создаётся из **frozen Order/OrderItem фактов**: productId, amount
(item.amount — Decimal, без пересчёта), serviceDate (item ?? order), 
acquisitionSource (verbatim, вкл. null). НЕ резолвятся: Tariff,
CommercialPeriod, CommercialRestriction, priceFrom/POR, FX; Product/ServiceUnit
не реинтерпретируются.

## 7. Cardinality + stable linkage — HARD GATE

- Каноническая кардинальность: **1 OrderItem → ровно 1 Booking** (multi-item
  Order → N Booking, по одному на item; e2e #2).
- DB-level enforcement: `Booking.orderItemId String? @unique` (миграция
  `20260812140000_add_booking_order_item_link`, аддитивная; legacy NULL — multiple
  NULL в unique index допустимы).
- Linkage: `Booking → orderId + orderItemId + productId` → `Order → saleId/quoteId/
  checkoutId` (там, где refs существуют; legacy Order без sale provenance —
  читаем/управляем).
- No cross-domain FK (ADR-0001): trusted ID-ссылки без FK-констрейнтов.

## 8. Booking ID allocation

`BKG-*` через `IdsService.nextCode(tx, "BKG")` — server-owned, атомарный
BusinessSequence, без client-forge/random fallback. Дубликат доставки не сжигает
объекты (inbox no-op; допустимые sequence-gaps). Контракт ID синхронизирован
(ids.service.ts комментарий BKG-* Booking).

## 9. Initial Booking state

`NEW` — из BookingStatus enum (Screen Design) и существующей Phase 1 реализации;
Step 2.8 создаёт ТОЛЬКО Booking (initial technical transition в PREPARING_REQUEST/
SENT_TO_SUPPLIER — вне 2.8, Step 2.9). Подтверждено e2e #1.

## 10. Passenger projection — HARD REVIEW

- Пассажиры создаются из **COMPLETE OrderTraveler** (dataCompleteness === COMPLETE;
  Step 2.7 confirm-guard гарантирует полноту к моменту send) — per Booking (каждый
  Booking получает проекцию готовых туристов — current canonical).
- Non-traveler категории: Order без туристов → Booking БЕЗ Passenger, без
  placeholder (e2e #8) — cross-category валидно.
- Incomplete travelers: не блокируют и не «выдумываются» — проектируются только
  COMPLETE (Step 2.7 guard делает not-COMPLETE невозможным на READY_FOR_BOOKING
  для заказов с туристами).
- Passenger хранение паспортных данных — одобренная схема (Passenger.
  passportNumber, без шифрования на этом слое; PII-redaction на read — Step 1.17);
  в события/аудит/логи PII не попадает (проверено).

## 11. Acquisition propagation

Verbatim-копия frozen Order.acquisitionSource: DIRECT, BUYER_REQUEST, legacy null
(без fallback null→DIRECT, без recomputation). E2E #7 (+2.7 #37/#38).

## 12. Money semantics

Booking владеет `amount` (копия item.amount, frozen Decimal, currency не
дублируется — нет поля). Никакого пересчёта/priceFrom/POR/Payment/paid-state.
E2E #1/#2 (amount сверен с item.amount).

## 13. Availability isolation — HARD GATE

Booking creation НЕ создаёт второй AvailabilityReservation, НЕ декрементит
capacity, НЕ освобождает hold (release — владелец Availability, будущий scope).
Hold = единственный (Step 2.4, Sale completion). E2E #1 (count = 1 до/после send)
+ 2.7 #29.

## 14. Idempotency — HARD GATE

Тройная защита:
1. `events.InboxEvent` (consumerId+eventId) — dedup повторной доставки;
2. domain count-check (`booking.count({orderId}) > 0` → no-op) — logically
   duplicate (другой eventId, тот же Order);
3. **DB unique `orderItemId`** — последний рубеж при concurrent/обходе count.

P2002 обрабатывается констрейнт-специфично (STRICT REVIEW 2.8 fix, конвенция
OrderRequested consumer-а 2.5): no-op ТОЛЬКО для `Booking_orderItemId_key`
(canonical cardinality) и `InboxEvent_consumerId_eventId_key` (dedup); другие
unique-дефекты (BKG-код и пр.) пробрасываются → событие FAILED (честно, не
ложный «уже обработано»). Имена constraint'ов — канонический shared-хелпер
`uniqueConstraintNames` (shared/prisma-errors.ts, оба Prisma shape).
E2E #3/#4/#5/#12.

## 15. Concurrency

In-process bus — доставка серийная; DB unique + inbox делают результат
детерминированным при любой будущей конкурентной доставке (Kafka/RabbitMQ).
E2E #3 (P2002) / #12 (parallel emit logical duplicates). Без process-local locks.

## 16. Failure atomicity — HARD GATE

Единица атомарности = **весь OrderRequest (все Booking/Passenger/History/Inbox/
BookingCreated) в ОДНОЙ транзакции consumer-а** (`prisma.$transaction`):
- неуспех → rollback → событие FAILED (retryable-логика ленты) — нет partial
  набора Booking, нет «inbox done без бизнес-записей»;
- BookingCreated пишется через emitResult в той же tx (не существует для
  rolled-back Booking);
- no-op-пути (unknown order / items=0 / existing>0) также отмечают inbox атомарно.

## 17. BookingCreated event

Ровно ОДНО result-событие на обработку BookingRequested (canonical единица =
весь OrderRequest): payload `{count, bookings: [{id, code}], orderId}` — без PII;
aggregateId = first booking id (Booking aggregate); correlation наследуется из
BookingRequested, causation = BookingRequested.eventId; actor = SYSTEM. Событие
НЕ эмитится на duplicate/no-op (e2e #4/#5). Consumer-ов у BookingCreated нет
(лента/трассировка).

## 18. History / audit

BookingHistory: ровно одна запись `created` на каждую Booking (action/from/to/
actor/comment — без PII). Security audit — отдельная модель, PII не дампит.
Второй audit-модели не вводится.

## 19. Order reconciliation boundary

Order не получает PARTIALLY_FULFILLED/FULFILLED от создания Booking:
`order.subscribers.ts` реагирует ТОЛЬКО на BookingConfirmed/BookingStatusChanged
(→CONFIRMED|COMPLETED)/BookingRejected. BookingCreated не имеет consumer-ов.
E2E #1 (Order остаётся SENT_TO_BOOKING после создания Booking).

## 20. Cancellation boundary / event authority

- **Event authority (§25):** BookingRequested — durable факт после commit send;
  consumer НЕ гейтит live Order status (gate инвалидировал бы authoritative
  событие). Задокументировано; race-импликации ниже.
- Order отменён ПОСЛЕ send → Booking остаётся (компенсация — Step 2.9, не
  выдумывается). E2E #10.
- cancel ДО send → BookingRequested/Booking не создаются. E2E #11.
- Race send-vs-cancel → ровно один победитель (CAS, 2.7 #35); если send победил —
  consumer создаёт Booking консистентно (нет corrupt partial state).

## 21. Legacy compatibility

- Booking: orderItemId NULL (до 2.8) — читаемы/управляемы (GET/PATCH, e2e #11);
  acquisitionSource null — verbatim (e2e #7); старые коды/статусы — без
  destructive reinterpretation.
- Order: saleId null / acquisition null — полный lifecycle (2.7 #28/#38).
- Без backfill.

## 22. RBAC / API creation authority

- Создания через HTTP нет (POST /bookings → 404, e2e #9); BUYER/PARTNER/
  SALES_MANAGER/MODERATOR не имеют booking create-команд (только read /
  OPERATOR lifecycle PATCH).
- `PATCH /bookings/:id` — командно-ориентированный (action whitelist);
  forged server-owned поля → **422** (`BOOKING_ACTION_FORBIDDEN_KEYS`,
  assertNoForbiddenKeys — конвенция Sales/Reverse/Catalog/Order).
- Read/manage API обратно совместимы.

## 23. Mass assignment (§28)

`booking.validation.ts`: id/code/orderId/orderItemId/productId/customerId/status/
amount/currency/acquisitionSource/serviceDate/milestones/version/actor/correlation/
history/passengers/… → 422 (loud), не silent-strip. E2E #9.

## 24. PII / security audit

BookingRequested, BookingCreated, outbox/inbox, BookingHistory, logs — БЕЗ
passport/contact PII (e2e #1 asserts payload raw). Passenger passport — только в
booking.Passenger (approved storage), redaction на read (Step 1.17). Parallel
механизмов шифрования не вводится.

## 25. Cross-Seller / tenant isolation

Booking не содержит seller/partner контекста (schema: orderId/productId/
orderItemId — trusted refs). Все факты derived из frozen Order — forge через
event-like HTTP невозможен (нет create-эндпоинта; payload не несёт seller-полей).

## 26. Reverse Marketplace / Universal Pricing regression

Полная цепочка Reverse→Sales→Order→BookingRequested→Booking сохранена:
acquisition BUYER_REQUEST пропагируется verbatim (e2e #7 + acquisition suite #7
+ 2.7 #37); Reverse-специфичного Booking-пути нет. 1.8A–D: Booking потребляет
frozen commercial facts (amount), не входит в ServiceUnit/RatePlan/Period/
Restriction resolution — регрессия в полном прогоне.

## 27. Step 2.8A boundary — HARD STOP

Time-slot/timezone/slot-reservation/date-time reinterpretation НЕ вводятся.
Booking.serviceDate — существующий date-only (DateTime? из item/order snapshot).
Поля serviceStartsAt/serviceEndsAt/serviceTimezone — зарезервированы в
BOOKING_ACTION_FORBIDDEN_KEYS как server-owned (появятся в 2.8A).

## 28. Migration / DB invariants

Одна аддитивная миграция `add_booking_order_item_link` (nullable unique
orderItemId). Fresh-deploy-safe, legacy-совместима (NULL), drift-free (43/43).
`db push` не использовался.

## 29. Deferred decisions / extension points

- **Per-item traveler association:** в multi-item Order каждый Booking проектирует
  ВСЕХ COMPLETE туристов (сейчас нет OrderItem↔OrderTraveler связи). Дублирование
  данных допустимо как current canonical, но при появлении per-item passenger
  модели (2.8A/2.9 или Sales-контракт travelers per item) проекция уточняется
  осознанно, без silent-изменения контракта.
- **Availability release/compensation** (Order cancel после durable send, booking
  cancel) — Step 2.9.
- **Persisted SLA-политика Booking** — Roadmap 2.9A (temporal contract).

## 30. Границы (НЕ входит в Step 2.8)

2.8A (time model), 2.9 (supplier/confirmation/cancellation/reconcile), Finance/
Payment, Documents, notifications, frontend Booking Center, calendar UI, dynamic
pricing, supplier integrations, новые Reverse-фичи, Universal Pricing amendment,
новый generic Booking creation API.
