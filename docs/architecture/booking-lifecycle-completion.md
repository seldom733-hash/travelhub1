# TravelHub — Phase 2 Step 2.9 — Booking Lifecycle Completion (архитектурный артефакт)

**Статус:** Step 2.9 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW (2026-08-13)
**Owner:** Booking Center (`booking.*`, ADR-0001). **Boundary:** Booking владеет Booking;
Booking создаётся ТОЛЬКО consumer `BookingRequested` (Step 2.8); Order владеет Order;
Booking → Order feedback — ТОЛЬКО событиями (никаких прямых Order-записей).
**Источники:** Roadmap v3 Step 2.9 («Supplier processing, confirmation, clarification,
rejection, change/cancellation, fulfillment, обратные события Order»); Screen Design
Brief Baseline 1.6 (§Backend Booking codes); Step 2.7/2.8/2.8A approved contracts;
`docs/contracts/events.md`; `docs/contracts/api.md`.

---

## 1. Назначение

Step 2.9 завершает канонический backend Booking lifecycle:

`BookingRequested → Booking (NEW) → PREPARING_REQUEST → SENT_TO_SUPPLIER ⇄
NEEDS_CLARIFICATION → CONFIRMED → IN_SERVICE → COMPLETED; SUPPLIER_REJECTED;
CHANGE_REQUESTED ⇄ CONFIRMED; CANCELLATION_REQUESTED → CANCELLED; PROBLEM`

и фиксирует: единственную авторитетную машину состояний, guards, stable codes,
canonical события (`BookingConfirmed`/`BookingRejected`/`BookingCancelled`/
`BookingCompleted`), Booking → Order feedback (Order-owned reconcile),
компенсацию Order-cancel vs Booking (Step 2.8 deferred race), RBAC/IDOR/
mass-assignment защиту, CAS/идемпотентность, атомарность state+history+outbox,
неизменяемость frozen фактов (money/acquisition/service occurrence 2.8A).

Step 2.9A (persisted temporal contract: requestedAt/confirmedAt/cancelledAt/…)
и Step 2.10 (Finance) — отдельные roadmap-пункты, НЕ начинаются.

## 2. Current → Target reconciliation

| Concern | Current (2.8/2.8A) | Canonical target | Delta (2.9) |
|---|---|---|---|
| Booking statuses | 13-кодовый enum (Screen Design verbatim) | тот же enum | Producer-ы для PREPARING_REQUEST/NEEDS_CLARIFICATION/CHANGE_REQUESTED/CANCELLATION_REQUESTED; AWAITING_CONFIRMATION — резервный без producer-а |
| Booking actions | send/confirm/reject/service/complete/cancel/problem | полный operational lifecycle | +prepare, +requestClarification, +resume, +requestChange, +resolveChange, +requestCancellation |
| State-machine authority | `BookingService.TRANSITIONS` (частично) | один authority + CAS | bookingAction переведён на CAS (`updateMany id+status+version`), как Order (1.14 §19) |
| History | real transitions only | real transitions only | +compensation-история (`cancelled_order`), +`created_cancelled` (race) |
| Events | Confirmed/Rejected/Cancelled/StatusChanged | +canonical completion | +`BookingCompleted` (canonical факт; StatusChanged остаётся техническим для reconcile-контракта 2.5A) |
| Order feedback | Order-subscriber на Confirmed/Rejected/StatusChanged | тот же (approved) | БЕЗ изменений контракта; компенсация — Booking-сторона от OrderCancelled |
| Cancellation | cancel из активных | +двухфазный request → cancel | +`requestCancellation` (marker), +компенсация от Order-cancel |
| Fulfillment | complete → StatusChanged(→COMPLETED) | complete → canonical BookingCompleted + StatusChanged | +BookingCompleted |
| Change handling | нет | marker-состояние | +`requestChange`/`resolveChange` (CHANGE_REQUESTED; reschedule/reprice — вне 2.9) |
| Temporal fields | нет milestone-колонок | Step 2.9A boundary | НЕ вводятся (frozen 2.8A факты immutable) |

Классификация путей: 1) canonical & keep — send/confirm/reject/service/complete/
cancel/problem; 2) canonical, incomplete → harden — CAS на все переходы; 3) legacy —
AWAITING_CONFIRMATION, orderItemId NULL, acquisitionSource NULL (preserve/read);
4) technical — StatusChanged-события; 5) obsolete — нет; 6) ambiguous — нет
(все решения выведены из enum + Screen Design + approved 2.7/2.8 контрактов).

## 3. Stable backend status codes (Screen Design Baseline)

`NEW`, `PREPARING_REQUEST`, `SENT_TO_SUPPLIER`, `AWAITING_CONFIRMATION`,
`CONFIRMED`, `IN_SERVICE`, `COMPLETED`, `NEEDS_CLARIFICATION`,
`SUPPLIER_REJECTED`, `CHANGE_REQUESTED`, `CANCELLATION_REQUESTED`, `CANCELLED`,
`PROBLEM` — кодовая база полностью совпадает с Backend Booking codes (Screen
Design). Коды — технические идентификаторы, НЕ локализованные лейблы.

| Статус | Бизнес-смысл | Терминальный | Predecessors | Successors | Кто вызывает | Тип | Каноническое событие |
|---|---|---|---|---|---|---|---|
| NEW | создана consumer-ом | нет | — | PREPARING_REQUEST, SENT_TO_SUPPLIER, CANCELLED, PROBLEM | SYSTEM (consumer) | operational | — |
| PREPARING_REQUEST | запрос готовится (supplier processing) | нет | NEW | SENT_TO_SUPPLIER | OPERATOR/ADMIN (prepare) | operational | — |
| SENT_TO_SUPPLIER | запрос отправлен поставщику | нет | NEW, PREPARING_REQUEST, NEEDS_CLARIFICATION | NEEDS_CLARIFICATION, CONFIRMED, SUPPLIER_REJECTED, CANCELLED, PROBLEM | OPERATOR/ADMIN (send/resume) | supplier-facing | — |
| AWAITING_CONFIRMATION | резервный код (legacy-источник) | нет | — | CONFIRMED, SUPPLIER_REJECTED, NEEDS_CLARIFICATION | (legacy) | supplier-facing | — |
| CONFIRMED | подтверждено | нет | SENT_TO_SUPPLIER, AWAITING_CONFIRMATION, CHANGE_REQUESTED | IN_SERVICE, CHANGE_REQUESTED, CANCELLATION_REQUESTED, CANCELLED, PROBLEM | OPERATOR/ADMIN (confirm/resolveChange) | supplier-facing | **BookingConfirmed** |
| IN_SERVICE | услуга началась | нет | CONFIRMED | COMPLETED, CHANGE_REQUESTED, CANCELLATION_REQUESTED, CANCELLED, PROBLEM | OPERATOR/ADMIN (service) | operational | — |
| COMPLETED | исполнено | **да** | IN_SERVICE | — | OPERATOR/ADMIN (complete) | operational | **BookingCompleted** |
| NEEDS_CLARIFICATION | ждём уточнения | нет | SENT_TO_SUPPLIER, AWAITING_CONFIRMATION | SENT_TO_SUPPLIER, CANCELLATION_REQUESTED, CANCELLED, PROBLEM | OPERATOR/ADMIN (requestClarification) | operational | — |
| SUPPLIER_REJECTED | отклонено поставщиком | **да** | SENT_TO_SUPPLIER, AWAITING_CONFIRMATION | — | OPERATOR/ADMIN (reject) | supplier-facing | **BookingRejected** |
| CHANGE_REQUESTED | запрошено изменение (marker) | нет | CONFIRMED, IN_SERVICE | CONFIRMED, CANCELLATION_REQUESTED, CANCELLED, PROBLEM | OPERATOR/ADMIN (requestChange) | operational | — |
| CANCELLATION_REQUESTED | запрошена отмена (marker) | нет | CONFIRMED, IN_SERVICE, CHANGE_REQUESTED, NEEDS_CLARIFICATION | CANCELLED, PROBLEM | OPERATOR/ADMIN (requestCancellation) | operational | — |
| CANCELLED | отменено | **да** | любой активный | — | OPERATOR/ADMIN (cancel) + SYSTEM (компенсация) | supplier-facing | **BookingCancelled** |
| PROBLEM | проблемный marker | нет | любой активный | CANCELLED | OPERATOR/ADMIN (problem) | internal | — |

## 4. Transition matrix

| Action | From | To | Guard | Event | Permission |
|---|---|---|---|---|---|
| prepare | NEW | PREPARING_REQUEST | from-guard + CAS | BookingStatusChanged (техн.) | booking.send_supplier |
| send | NEW, PREPARING_REQUEST | SENT_TO_SUPPLIER | from-guard + CAS | BookingStatusChanged (техн.) | booking.send_supplier |
| requestClarification | SENT_TO_SUPPLIER, AWAITING_CONFIRMATION | NEEDS_CLARIFICATION | from-guard + CAS | BookingStatusChanged (техн.) | booking.confirm |
| resume | NEEDS_CLARIFICATION | SENT_TO_SUPPLIER | from-guard + CAS | BookingStatusChanged (техн.) | booking.confirm |
| confirm | SENT_TO_SUPPLIER, AWAITING_CONFIRMATION | CONFIRMED | from-guard + CAS | **BookingConfirmed** | booking.confirm |
| reject | SENT_TO_SUPPLIER, AWAITING_CONFIRMATION | SUPPLIER_REJECTED | from-guard + CAS | **BookingRejected** | booking.confirm |
| service | CONFIRMED | IN_SERVICE | from-guard + CAS | BookingStatusChanged (техн.) | booking.confirm |
| requestChange | CONFIRMED, IN_SERVICE | CHANGE_REQUESTED | from-guard + CAS | BookingStatusChanged (техн.) | booking.request_change |
| resolveChange | CHANGE_REQUESTED | CONFIRMED | from-guard + CAS | BookingStatusChanged (техн.) | booking.request_change |
| requestCancellation | CONFIRMED, IN_SERVICE, CHANGE_REQUESTED, NEEDS_CLARIFICATION | CANCELLATION_REQUESTED | from-guard + CAS | BookingStatusChanged (техн.) | booking.cancel |
| complete | IN_SERVICE | COMPLETED | from-guard + CAS | **BookingCompleted** + BookingStatusChanged (техн.) | booking.confirm |
| cancel | любой активный | CANCELLED | from-guard + CAS | **BookingCancelled** | booking.cancel |
| problem | любой активный (кроме PROBLEM) | PROBLEM | from-guard + CAS (STRICT REVIEW FIX: нет self-transition PROBLEM→PROBLEM, как Order `problem`) | BookingStatusChanged (техн.) | booking.confirm |

**STRICT REVIEW FIX (order-status guard, §14/§28):** все lifecycle-команды,
кроме `cancel`, дополнительно проверяют статус Order (READ-only, ADR-0001):
если заказ `CANCELLED`/`CLOSED` → 409. Это делает инвариант §15
(«нет активной Booking под отменённым/закрытым заказом») детерминированным
для последовательного сценария (staff подтверждает бронь уже отменённого
заказа → 409, а не confirm-после-cancel). `cancel` остаётся разрешён
(безопасный valve, сходится к терминалу). Остаточный суб-транзакционный
window (confirm прочитал Order до cancel, его update успел между findMany
и updateMany компенсации) — документированный CAS-equivalent (та же
конвенция, что Order send-vs-cancel [200,200] в 2.7); компенсация + guard
+ born-CANCELLED закрывают все реалистичные пути.

Требования §8 выполнены: нет произвольного status-PATCH (только `action`); сервер
владеет статусом; invalid transition → 409 (from-guard, controlled); malformed/forged
→ 400/422; retry/concurrent не дублируют business effect (CAS + ровно одно событие);
terminal не reopen-аются.

## 5. Command ownership

Единственный authority — `BookingService.bookingAction` (HARD GATE §6 prompt).
Контроллер только валидирует `action` и прокидывает актора; consumer-ы не пишут
статусы напрямую, кроме двух Booking-owned reconciliation handlers:
(1) `BookingRequested` consumer — создание (initial status);
(2) `OrderCancelled` compensation consumer — отменяет активные брони заказа,
используя те же guards/CAS (никакого второго state machine).

**Write-path audit (каждый production writer `Booking.status`):**
- `booking.subscribers.ts` (`create` при обработке BookingRequested) — категория 1 (canonical create);
- `booking.service.ts` (`updateMany id+status+version` в bookingAction) — категория 1 (canonical lifecycle);
- `booking.subscribers.ts` (`updateMany id+status+version` в compensation) — категория 1 (canonical Booking-owned reconciliation);
- `updateMany`/`update`/raw SQL в других модулях — **отсутствуют** (grep: только перечисленные).

## 6. Booking → Order feedback (events)

| Событие | Producer | Payload (whitelist, без PII) | Consumer | Order reconciliation |
|---|---|---|---|---|
| BookingConfirmed | BookingService.confirm | bookingId, code, orderId, productId | order-booking-consumer | SENT_TO_BOOKING/PARTIALLY_FULFILLED → PARTIALLY_FULFILLED/FULFILLED (CAS) |
| BookingRejected | BookingService.reject | + reason | order-booking-consumer | Order → PROBLEM (CAS) |
| BookingStatusChanged (→CONFIRMED/IN_SERVICE/COMPLETED) | BookingService (техн.) | from, to, bookingId, orderId, code | order-booking-consumer | reconcile (approved 2.5A контракт) |
| BookingCancelled | BookingService.cancel / compensation | bookingId, code, orderId, productId (+reason) | — (Order не подписан) | нет (Order уже CANCELLED для компенсации) |
| BookingCompleted | BookingService.complete | bookingId, code, orderId, productId | — (лента/аналитика) | через BookingStatusChanged (существующий) |

Order владеет Order status; Booking публикует только факты. Booking никогда не
пишет order.* (проверено e2e: order history `booking_confirmed` пишет Order-owned
subscriber).

## 7. Multi-item Order semantics

- Order с 1 Booking: confirm → PARTIALLY_FULFILLED; complete → FULFILLED (все terminal).
- Order с 2+ Bookings: одна CONFIRMED, другие активные → PARTIALLY_FULFILLED;
  одна COMPLETED, другие активные → PARTIALLY_FULFILLED (НЕ FULFILLED);
  все terminal → FULFILLED. Reconcile строится на реальных Booking-статусах
  (никакого `bookingCount > 0` shortcut).
- BookingCancelled НЕ триггерит Order reconcile (подписчик отсутствует) — заказ
  остаётся в своём состоянии; компенсация идёт от OrderCancelled.

## 8. Cancellation compensation (Step 2.8 deferred race) — assessment

Гонка: `Order READY_FOR_BOOKING → send → BookingRequested durable → Order cancel →
consumer создал/создаёт Booking`. Решение (выведено из approved 2.7 «Order cancel
разрешён из SENT_TO_BOOKING/PARTIALLY_FULFILLED» + 2.8 «durable BookingRequested
authoritative, компенсация — 2.9»):

- **Order-cancel после Booking exists** → `booking-order-cancelled-consumer`
  (Booking-owned) отменяет активные брони: CAS + BookingHistory `cancelled_order` +
  result-event `BookingCancelled` (reason «Заказ отменён», correlation/causation из
  OrderCancelled). Терминальные (COMPLETED/SUPPLIER_REJECTED/CANCELLED) не трогаются.
- **Гонка (OrderCancelled раньше BookingRequested)** → consumer BookingRequested
  видит order.status = CANCELLED → создаёт Booking СРАЗУ в терминальном
  компенсированном состоянии CANCELLED (history `created_cancelled`; БЕЗ
  BookingCancelled — перехода не было). BookingCreated result-факт всё равно
  эмитится (Booking существует).
- **Forbidden:** delete Booking; игнорировать инконсистентность; cross-domain writes.
- No hard delete; no refund/Finance (ownership — Step 2.10+); availability release
  НЕ выполняется (owner-contract Availability domain не определяет Booking как
  release-автора; документировано как known deferred work).

## 9. Concurrency / idempotency / atomicity

- CAS: `updateMany where id+status+version` (как Order 1.14 §19) — concurrent
  confirm vs reject / confirm vs cancel / complete vs cancel → ровно один
  победитель (200), остальные 409; без duplicate history/event; без raw 500.
- Идемпотентность: InboxEvent (unique consumerId+eventId); DB unique
  (`Booking_orderItemId_key`, inbox) — P2002 no-op ТОЛЬКО для известных
  invariant-констрейнтов (`uniqueConstraintNames`); прочие unique-дефекты → FAILED.
- Атомарность: state + BookingHistory + outbox event(s) — одна `$transaction`.
  Failed transition → полный rollback (ноль state/history/event).
- Correlation/causation: HTTP-команды — correlation = server requestId, causation =
  null; consumer-события — correlation наследуется, causation = parent eventId
  (ADR-0009/0010); business-коды НЕ используются как lineage.

## 10. Money / acquisition / service occurrence invariants

- Frozen money: `Booking.amount` = item.amount (Decimal, без reprice) — lifecycle
  никогда не перечитывает Tariff/CommercialPeriod/restrictions.
- Frozen acquisitionSource: DIRECT / BUYER_REQUEST / legacy null — verbatim,
  никакого пере-вывода.
- Frozen service occurrence (2.8A): serviceDate/serviceTime/serviceEndTime/
  serviceTimeZone/serviceTimeType/serviceStartsAt/serviceEndsAt — immutable на
  lifecycle (reschedule = отдельный workflow, вне 2.9); forged temporal PATCH → 422.

## 11. Availability ownership

Booking lifecycle не создаёт второй hold и не освобождает holds:
`AvailabilityReservation` — Catalog-owned; release/compensation ownership не
определён для Booking → Step 2.9 НЕ реализует release (документировано; если
позже понадобится — отдельное архитектурное решение).

## 12. PII boundary

Lifecycle-события содержат только canonical refs (bookingId/code/orderId/
productId/reason) — без passport/travelers/email/phone/notes (проверено e2e §19).
Passenger PII остаётся в booking.* (field-level redaction Step 1.17).

## 13. Legacy compatibility

Legacy Booking (orderItemId NULL, acquisitionSource NULL, AWAITING_CONFIRMATION)
читаемы и управляемы lifecycle-ом (confirm/reject/cancel из AWAITING_CONFIRMATION);
никакого destructive backfill; temporal 2.8A факты не фабрикуются.

## 14. Step 2.9A boundary (HARD GATE)

Step 2.9 реализует lifecycle-семантику БЕЗ нового persisted temporal/SLA-модели:
`confirmedAt/cancelledAt/completedAt/requestedAt/…` и SLA-таймстампы — отдельный
Roadmap-пункт 2.9A (существующие колонки Booking — только createdAt/updatedAt +
frozen service occurrence). Никаких новых milestone-колонок в 2.9.

## 15. Known deferred work

- AWAITING_CONFIRMATION — producer отсутствует (резервный код, legacy-источник).
- CHANGE_REQUESTED — operational marker: фактический reschedule/repricing/
  availability-reallocation — отдельный change-order workflow (не 2.9).
- CANCELLATION_REQUESTED — marker: фактический refund/Finance — Step 2.10+.
- Availability release при cancel/reject — ownership не определён (см. §11).
- Supplier portal UI / notification engine / documents-vouchers — вне 2.9.
- Automated retry/recovery FAILED-событий — Phase 2 entry debt (2.17).

## 16. STRICT REVIEW FIXES (2.9 review pass)

1. **Order-status guard в bookingAction** — 409 для lifecycle-команд (кроме
   `cancel`) на брони заказа `CANCELLED`/`CLOSED` (READ-only Order check).
2. **`problem` self-transition исключён** — PROBLEM→PROBLEM больше не
   продуцирует шумную history/событие (alignment с Order machine).
3. **§46 Order reconciliation matrix** — 8 комбинаций покрыты e2e (M1–M8);
   ожидаемые статусы документированы ниже (§17).
4. **Race-тесты** compensation-vs-confirm / compensation-vs-complete —
   детерминированный победитель, инвариант §15 не нарушается.

## 16A. Order reconciliation matrix (STRICT REVIEW §46 — M1..M8)

| Комбинация Booking-статусов | Order-статус | Обоснование |
|---|---|---|
| confirmed + NEW | PARTIALLY_FULFILLED | inherited-approved 2.5A: anyConfirmed → partial (подтверждение — прогресс агрегата; НЕ fulfillment) |
| completed + confirmed | PARTIALLY_FULFILLED | одна исполнена, вторая нет → не все terminal |
| completed + rejected | PROBLEM | BookingRejected → Order PROBLEM (inherited 1.14; одна rejection ставит заказ в PROBLEM) |
| completed + cancelled | FULFILLED (complete последним) | TERMINAL_BOOKING {COMPLETED, CANCELLED} → all booking-work resolved (inherited 2.5A); cancel сам не триггерит reconcile |
| all completed | FULFILLED | все услуги исполнены; ровно одно OrderFulfilled |
| all rejected | PROBLEM | rejection доминирует; НЕ FULFILLED |
| all cancelled | SENT_TO_BOOKING | BookingCancelled не подписан Order-ом (inherited 2.5A) → cancelled-only заказ НЕ становится FULFILLED |
| completed + rejected + cancelled | PROBLEM | PROBLEM не перезаписывается reconcile (CAS-вход только из SENT_TO_BOOKING/PARTIALLY_FULFILLED) |

Замечания: (a) FULFILLED трактуется как «всё booking-work resolved» (COMPLETED
∪ CANCELLED), а не строго «все услуги delivered» — inherited-approved 2.5A;
(b) CANCELLED-only / REJECTED-only заказы в FULFILLED НЕ попадают (закрыто
M6/M7); (c) комбинация completed+cancelled зависит от порядка событий
(complete последним → FULFILLED; cancel последним → PARTIALLY_FULFILLED) —
документированное следствие event-driven reconcile, кандидат на 2.9A/поздний
шаг; (d) PARTIALLY_FULFILLED при confirmed-only — inherited-approved, кандидат
на семантический refinement вне Step 2.9 (не меняется — контракт 2.5A).

## 17. Migration

`Migration: N/A` — schema НЕ изменялась в Step 2.9 (все 13 статусов уже
существовали в enum; компенсация и события — application/event-level).
