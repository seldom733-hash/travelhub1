# TravelHub — Phase 2 Step 2.7 — Order Lifecycle Completion (архитектурный артефакт)

**Статус:** Step 2.7 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW (2026-08-12)
**Owner:** Order Center (`order.*`, ADR-0001). **Boundary:** Order владеет Order;
Booking создаёт ТОЛЬКО consumer `BookingRequested` (Step 2.8 boundary сохраняется).
**Источники:** Roadmap v3 Step 2.7; Screen Design Brief Baseline 1.4 (§Backend Order codes);
Step 1.14 Canonical Order Events; Step 2.5/2.5A/2.5B/2.6 approved contracts;
`docs/contracts/events.md`; `docs/contracts/api.md`.

---

## 1. Назначение

Step 2.7 завершает канонический backend Order lifecycle:

`Sale → OrderRequested → Order (NEW) → processing ⇄ waiting-data →
READY_FOR_BOOKING → (явная команда «Send to Booking Center») → SENT_TO_BOOKING →
(reconcile по броням / explicit complete) → FULFILLED → CLOSED`

и фиксирует: единственную авторитетную машину состояний, guards, stable codes,
history, SLA-детерминизм, milestone-времена (2.5A), canonical события
(`OrderReadyForBooking`, `BookingRequested`, `OrderFulfilled`, `OrderClosed`),
RBAC/IDOR/mass-assignment защиту, CAS/идемпотентность, атомарность
state+history+outbox.

Booking creation — **вне** Step 2.7 (Step 2.8: `BookingRequested → Booking`).

## 2. Stable backend status codes (Screen Design Baseline)

`NEW`, `IN_PROCESSING`, `WAITING_FOR_DATA`, `READY_FOR_BOOKING`, `SENT_TO_BOOKING`,
`PARTIALLY_FULFILLED`, `FULFILLED`, `READY_TO_CLOSE`, `CLOSED`, `CANCELLED`,
`PROBLEM`, `SUSPENDED` — кодовая база полностью совпадает с Backend Order codes
(Screen Design Brief). Коды — технические идентификаторы, НЕ локализованные лейблы.

## 3. Единая машина состояний (единственный authority — `OrderService.TRANSITIONS`)

| Action (команда) | from → to | Guard | Milestone | Событие | Permission |
|---|---|---|---|---|---|
| `process` | NEW → IN_PROCESSING | from-guard | — | OrderStatusChanged (technical) | order.accept |
| `markWaitingData` | IN_PROCESSING → WAITING_FOR_DATA | from-guard | — | OrderStatusChanged | order.edit_noncritical |
| `resumeProcessing` | WAITING_FOR_DATA → IN_PROCESSING | from-guard | — | OrderStatusChanged | order.edit_noncritical |
| `confirm` | IN_PROCESSING, WAITING_FOR_DATA → READY_FOR_BOOKING | from-guard + travelers COMPLETE | `confirmedAt` | **OrderReadyForBooking** | order.edit_noncritical |
| `send` («Send to Booking Center») | READY_FOR_BOOKING → SENT_TO_BOOKING | from-guard | — | **BookingRequested** (command) | order.request_booking |
| `complete` | SENT_TO_BOOKING, PARTIALLY_FULFILLED → FULFILLED | from-guard | `fulfilledAt` | **OrderFulfilled** | order.edit_noncritical |
| `close` | FULFILLED, READY_TO_CLOSE → CLOSED | from-guard | `closedAt` | **OrderClosed** | order.close |
| `cancel` | любой не-терминальный → CANCELLED | from-guard (terminal forbidden) | `cancelledAt` | **OrderCancelled** | order.cancel |
| `problem` | активные (кроме PROBLEM) → PROBLEM | from-guard | — | OrderStatusChanged | order.edit_noncritical |
| `suspend` | активные (кроме SUSPENDED) → SUSPENDED | from-guard | — | OrderStatusChanged | order.suspend |

Проверено запрещёнными (контролируемые 409, никогда raw 500):
`NEW → CLOSED`, `CANCELLED → READY_FOR_BOOKING`, `CLOSED → IN_PROCESSING`,
`FULFILLED → NEW`, `NEW → complete/send/confirm`, повторный `confirm/send/close`
на том же статусе.

**PROBLEM / SUSPENDED** — marker-состояния (флаг), без выдуманного recovery/workflow
(промпт §21: «only already-supported lifecycle semantics»; recovery-действия не
определены ни в одном каноническом источнике — не изобретаются).

**READY_TO_CLOSE** — зарезервированный Screen Design код БЕЗ producer-а: ни одно
действие не переводит заказ в READY_TO_CLOSE; канонический close выполняется из
FULFILLED (событие `OrderClosed`). Enum сохранён для совместимости persisted-строк
(§42-10: без destructive reinterpretation).

## 4. Guards — authoritative source

- **from-guard** — машина `TRANSITIONS` (единственный authority, §6 промпта).
  Любой переход вне from-списка → `ConflictError` → 409.
- **confirm: полнота данных туристов** — все `OrderTraveler.dataCompleteness ===
  COMPLETE` (passportNumber задан). Источник: DoD Phase 1 / Step 1.14 confirm-guard.
  Неполные → `ValidationDomainError` → 422, переход не применяется (state/history/
  событие не пишутся).
- НЕ вводится (промпт §10): payment-before-booking, documents-before-booking,
  supplier-confirmation, новые availability-проверки, repricing, reservation-ref
  guard (legacy Order без refs остаётся управляемым — §34).

## 5. READY_FOR_BOOKING — ядро

Семантика: «Order прошёл Order-owned проверки готовности и может быть явно
передан в Booking Center». Переход `confirm` атомарно пишет state + `confirmedAt` +
history + ровно одно `OrderReadyForBooking` (outbox, одна транзакция).

`OrderReadyForBooking` — факт Step 1.14 (переименован из `OrderApproved`, та же
семантика, ноль producer/consumer-ов старого имени). Payload whitelist:
`{orderId, code, customerId}` (без PII). **НЕ** command в Booking: Booking
запускается только `BookingRequested` (`send`). Retry/конкурентность → ровно один
event (CAS `updateMany WHERE status+version`).

## 6. «Send to Booking Center» (explicit command) → BookingRequested

- только из READY_FOR_BOOKING → SENT_TO_BOOKING; отправитель: operational роль
  (`order.request_booking` — OPERATOR/ADMIN);
- payload минимален (PII-minimization, STRICT REVIEW FIX): `{orderId, orderCode,
  customerId}` — без items/travelers (consumer читает order.* READ-only);
- state + history + BookingRequested атомарны; duplicate send → 409 (business
  effect once); concurrent send → один победитель;
- возврат SENT_TO_BOOKING → READY_FOR_BOOKING не определён (recovery отсутствует —
  не вводится).

## 7. OrderFulfilled / FULFILLED

`FULFILLED` достигается: explicit `complete` (из SENT_TO_BOOKING/PARTIALLY_FULFILLED)
ИЛИ reconcile по терминальным броням (BookingConfirmed/BookingStatusChanged →
CONFIRMED|COMPLETED) — `order.subscribers.ts`. `fulfilledAt` ставится ТОЛЬКО на
реальном переходе (включая reconcile), ровно одно `OrderFulfilled`, CAS защищает
гонку explicit-complete vs reconcile (один факт). `PARTIALLY_FULFILLED` — только
через reconcile (часть броней подтверждена, не все терминальны) → технический
`OrderStatusChanged` (canonical события на partial нет).

## 8. CLOSED / OrderClosed

`close` из FULFILLED (или зарезервированного READY_TO_CLOSE) → CLOSED, `closedAt`
immutable, ровно одно `OrderClosed`. CLOSED — терминал: не открывается заново
(process/confirm/send/complete/cancel → 409). CANCELLED/FULFILLED ≠ CLOSED
(разные события и milestone-времена).

## 9. Cancellation

`cancel` из любого не-терминального статуса → CANCELLED + `cancelledAt` +
`OrderCancelled`. Терминальные (CLOSED) — 409. CANCELLED не возвращается в активные.
Без автоматической Finance/Refund-логики и без Booking-отмены-оркестрации (2.9).

## 10. Temporal contract (2.5A)

`submittedAt` (вход в систему), `confirmedAt`, `fulfilledAt`, `closedAt`,
`cancelledAt` — server-owned, immutable (однажды установлены), ставятся атомарно с
переходом (CAS), retries не двигают. `updatedAt` — никогда не business milestone.
History/events используют `occurredAt` (outbox createdAt).

## 11. SLA foundation

В Roadmap Step 2.7 SLA означает: **детерминированную вычислимость SLA из
immutable milestone-времен и OrderHistory** (submittedAt/confirmedAt/fulfilledAt/
closedAt/cancelledAt + from/to/occurredAt по каждому переходу). Никакой
persisted-SLA-политики/дедлайнов не существует ни в одном каноническом источнике —
длительности/правила не выдумываются (§24: persisted deadlines без политики →
не вводится; минимальный scope = детерминизм). При появлении Finance/Documents
SLA-политики (Step 2.11+) расчёт будет однозначным по уже сохранённым фактам.

## 12. History / audit

Каждый реальный переход — ровно одна `OrderHistory` (action, from, to, actorId/
actorName, comment, createdAt; fields — только server refs). Без PII: traveler
паспортные данные, полные DTO, Quote/payment payloads в history/события не
попадают. Security AuditLog и domain history остаются раздельными.

## 13. Event contract matrix (producer → consumer)

| Event | Producer | Trigger | Consumer | Payload |
|---|---|---|---|---|
| OrderCreated | Order consumer (2.5) | OrderRequested | — (result-event) | {orderId, code, number, customerId, amount, currency} |
| OrderReadyForBooking | OrderService | confirm | — | {orderId, code, customerId} |
| BookingRequested | OrderService | send | booking.subscribers (Phase 1; Step 2.8 canonical) | {orderId, orderCode, customerId} |
| OrderFulfilled | OrderService / reconcile | complete / терминальные брони | — | {orderId, code, customerId} |
| OrderClosed | OrderService | close | — | {orderId, code, customerId} |
| OrderCancelled | OrderService | cancel | — | {orderId, code, customerId} |
| OrderStatusChanged | OrderService / reconcile | технические переходы (process/markWaitingData/resumeProcessing/problem/suspend/partial) | — (generic, ноль consumer-ов) | {from, to, reason?, actor?} |

`OrderApproved` — полностью переименован в `OrderReadyForBooking` (Step 1.14);
producer/consumer-ов нет. `OrderStatusChanged` — только технические переходы,
canonical facts на него не мапятся (Step 1.14).

## 14. Correlation / causation (ADR-0009/0010)

- HTTP-команды (confirm/send/complete/close/cancel/…): correlation = server
  UUID из request context, causation = null.
- Consumer-цепочка: OrderCreated ← OrderRequested (correlation наследуется,
  causation = OrderRequested.eventId); BookingCreated ← BookingRequested
  (causation = eventId).
- requestId ≠ causation; business code заказа не используется как correlation.

## 15. RBAC / IDOR / mass-assignment

- OPERATOR — полный набор order.* (accept/edit_noncritical/request_booking/suspend/
  cancel/close) — primary operational role; ADMIN — все; SALES_MANAGER — только
  order.read (без order:write); BUYER/PARTNER/MODERATOR — без order.* (BUYER —
  account.order.read_own own-scope).
- IDOR/unknown Order → нейтральный 404.
- Lifecycle API — командно-ориентированный `PATCH /orders/:id {action}`; STRICT
  REVIEW §28 fix: forged server-owned поля (status/amount/currency/version/
  milestones/customerId/saleId/quoteId/checkoutId/reservationIds/subtotal/
  discount*/payment*/acquisitionSource/serviceDate/actor/correlation/…) → ЯВНЫЙ
  422 (`assertNoForbiddenKeys`, конвенция Sales/Reverse/Catalog), а не
  silent-strip через whitelist. `PATCH /orders/:id/travelers` — то же для
  OrderTraveler server-owned ключей (id/orderId/customerId/version/
  dataCompleteness/…), включая элементы массива `travelers`. PATCH без валидного
  action → 400 (DTO).

## 16. Concurrency / CAS / idempotency

Каждый переход: `updateMany WHERE id + status + version` (optimistic concurrency) —
один победитель; проигравший → ConflictError 409 (контролируемый no-op).
Повторная та же команда → 409 (business effect once). Гонки process-vs-cancel,
confirm-vs-confirm, send-vs-send покрыты e2e.

## 17. Transaction / outbox atomicity

Для всех canonical-переходов: `Order state + milestone + history + Outbox event` —
одна транзакция (`eventBus.emit`/`emitResult` внутри tx). Событие не публикуется
до commit. Неуспешный переход → ноль partial state/history/event.

## 18. Границы (НЕ входит в Step 2.7)

- **Booking:** Order НЕ пишет в booking.* (booking.subscribers создаёт Booking по
  BookingRequested — pre-existing Phase 1 consumer; канонический пересмотр — Step 2.8).
- **Availability:** lifecycle не создаёт/не освобождает holds (Step 2.4 hold
  остаётся единственным).
- **Money/acquisition:** lifecycle не меняет amount/currency/paymentStatus/
  acquisitionSource (frozen, 2.5/2.5B).
- **Finance/Documents/2.9 supplier workflow/2.8A time model** — вне scope.
