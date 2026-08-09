# PHASE 1 — STEP 1.14 — STRICT IMPLEMENTATION REVIEW

## 0. Роль

Проведи строгий code / architecture / event-contract / concurrency review уже реализованного:

**PHASE 1 — STEP 1.14 — CANONICAL ORDER EVENTS**

Implementation report не считать доказательством. Проверять фактический repository, Prisma models, Order service/subscribers, outbox/inbox, consumers, Booking integration, tests, docs и live behavior.

Это review существующей реализации, а НЕ следующий implementation step.

Не переходить к:
- Step 1.15;
- Step 1.15A;
- Phase 2.

Если найдена локальная подтверждённая проблема — исправить её как review-fix, повторить regression.

Если требуется изменение canonical lifecycle / ownership / Booking semantics — вернуть:

`ARCHITECTURE DECISION REQUIRED`

---

# 1. Главные review-риски

Обязательно проверить:

1. `OrderApproved → OrderReadyForBooking` действительно корректное переименование, а не изменение business semantics.
2. `OrderReadyForBooking` и `BookingRequested` не дублируют друг друга семантически.
3. `OrderFulfilled` создаётся ровно при authoritative fulfillment transition.
4. `OrderClosed` создаётся ровно при authoritative close transition.
5. Generic `OrderStatusChanged` не продолжает подменять эти canonical events.
6. Reconcile path не создаёт duplicate `OrderFulfilled`.
7. Order transition + OrderHistory + Outbox atomic.
8. Retry/concurrency не создают duplicate business facts.
9. Consumer dedup действительно использует Inbox/idempotency, а не только producer-side protection.
10. Payload `{orderId, code, customerId}` не создаёт лишнюю PII/privacy coupling.
11. Step 1.15/1.15A не реализованы преждевременно.
12. Никакие Phase 2 Order temporal/acquisition changes не протащены скрыто.

---

# 2. Фактический Order lifecycle

Из кода построить точную таблицу:

| Current Status | Command/Trigger | Next Status | History | Canonical Event | Generic Event | Consumer |
|---|---|---|---|---|---|---|

Не полагаться на docs.

Отдельно доказать transitions:
- process;
- confirm;
- send;
- partial fulfillment;
- fulfillment;
- close;
- cancel;
- любые problem/suspend branches.

---

# 3. OrderReadyForBooking semantics

Проверить фактический `confirm`.

Нужно доказать:

- именно `confirm` означает готовность Order к передаче в Booking;
- событие не публикуется раньше;
- event не публикуется на `process`;
- повторный confirm не создаёт новый event;
- invalid state confirm не создаёт event;
- concurrent confirm → ровно один logical fact.

Если старый `OrderApproved` имел другую семантику — это review issue.

---

# 4. BookingRequested boundary

Критически проверить цепочку:

`OrderReadyForBooking(confirm)`  
→ отдельная команда `send`  
→ `BookingRequested`  
→ Booking consumer.

Нужно подтвердить:

- `OrderReadyForBooking` = business fact;
- `BookingRequested` = command/request;
- `confirm` сам не создаёт Booking;
- `send` не создаёт второй `OrderReadyForBooking`;
- Booking создаётся только по `BookingRequested`;
- duplicate `BookingRequested` не создаёт duplicate Booking.

Если consumer слушает оба события — проверить отсутствие двойного side effect.

---

# 5. OrderFulfilled semantics

Проверить оба producer path:

1. explicit `complete`;
2. `reconcileOrder` → FULFILLED.

Нужно доказать:

- оба отражают один и тот же authoritative business fact;
- один Order не может получить два logical `OrderFulfilled` при последовательности reconcile + complete;
- reconcile FULFILLED event atomic с state/history;
- partial fulfillment не создаёт `OrderFulfilled`;
- Payment status не создаёт `OrderFulfilled`;
- serviceDate не создаёт `OrderFulfilled`.

Если два producer path могут независимо emit для одного transition — REVIEW FIX REQUIRED.

---

# 6. OrderClosed semantics

Проверить реальный `close`.

Доказать:

- close разрешён только из валидного from-state;
- fulfilled ≠ closed;
- cancelled ≠ closed;
- close event публикуется только один раз;
- retry/duplicate close не создаёт второй event;
- close не инициируется косвенно из unrelated reconcile/payment operation.

---

# 7. Generic OrderStatusChanged audit

Repo-wide найти каждый producer и consumer.

Для каждого определить:

- технический transition;
- legacy compatibility;
- canonical substitution;
- dead code.

Особенно проверить, что canonical transitions:
- confirm;
- fulfilled;
- close

не создают `OrderStatusChanged` параллельно, если generic event там уже не нужен.

Допустимый generic технический пример:
`process`, `PARTIALLY_FULFILLED`, если consumer действительно нужен generic state transition.

Не оставлять consumer, который слушает generic event и по `toStatus` снова угадывает ReadyForBooking/Fulfilled/Closed.

---

# 8. Stale OrderApproved removal

Repo-wide проверить:

- enum/event type;
- imports;
- producers;
- consumers;
- tests;
- docs;
- comments;
- fixtures.

Комментарии с historical mention допустимы только если явно маркируют migration/history, но production event contract не должен содержать `OrderApproved`.

Если stale event registry/value остался — REVIEW FIX.

---

# 9. Event payload contract

Сравнить три events:

- OrderReadyForBooking;
- OrderFulfilled;
- OrderClosed.

Проверить одинаковую `OrderRefPayload`.

Поля:
- `orderId`;
- `code`;
- `customerId`.

Оценить `customerId`:

- действительно нужен downstream?
- является canonical entity reference, а не PII;
- не позволяет consumer обходить read-by-ID contract;
- не тащит email/name/phone.

Если customerId никому не нужен и увеличивает coupling — зафиксировать, но не менять без доказанной пользы/риска.

Raw Order entity в payload запрещён.

---

# 10. Atomicity

Для `confirm`, `complete`, `close`, reconcile FULFILLED проверить transaction boundary:

`Order status mutation + OrderHistory + Outbox canonical event`

должны быть одной transaction.

Смоделировать failure между logical operations.

Недопустимы:
- state without event;
- event without state;
- history without state;
- state without history.

---

# 11. Idempotency

Проверить:

- повторный HTTP command;
- повторный service call;
- duplicate outbox publish attempt;
- retry after network failure.

Canonical fact должен существовать логически один раз.

Контролируемый 409 допустим, если это текущая command semantics.

---

# 12. Concurrency

Обязательные гонки:

1. confirm vs confirm;
2. complete vs complete;
3. close vs close;
4. reconcile FULFILLED vs explicit complete;
5. close vs reconcile;
6. send/BookingRequested retry.

Проверить CAS/version/updateMany/transaction behavior.

Если race способен создать два canonical event rows — REVIEW FIX REQUIRED.

---

# 13. Consumer Inbox dedup

Отчёт заявляет consumer dedup.

Проверить фактический InboxEvent/idempotency contract:

- dedup key;
- transaction;
- duplicate delivery;
- crash/retry scenario;
- side effect exactly-once logically.

Producer dedup сам по себе не считается proof consumer idempotency.

---

# 14. Outbox publishing semantics

Проверить:

- event persisted;
- publisher retry;
- publishedAt/processedAt semantics;
- failure handling;
- event is not deleted before successful publish;
- no PII in logs.

Не внедрять correlation infrastructure Step 1.15.

---

# 15. Temporal semantics

Проверить event occurrence time.

Step 1.14 не должен:
- использовать `updatedAt` как event time;
- использовать `serviceDate`;
- добавлять guessed milestones.

Если outbox пока имеет только `createdAt` и общего `occurredAt` contract ещё нет, это должно быть явно forward-compatible с Step 1.15A.

Не делать глобальный envelope refactor сейчас.

---

# 16. Phase 2 temporal boundary

Repo diff проверить на отсутствие преждевременных:

- submittedAt;
- confirmedAt;
- cancelledAt;
- fulfilledAt;
- closedAt;
- serviceStartsAt/serviceEndsAt/serviceTimezone;
- acquisitionChannel fields.

Если они добавлены только ради 1.14 без roadmap основания — review issue.

---

# 17. Acquisition boundary

Canonical Order event payload не должен угадывать:

- MARKETPLACE;
- PARTNER_STOREFRONT;
- DIRECT;

по Product channel/URL/storefront.

Acquisition propagation остаётся Step 2.5B.

---

# 18. RBAC / object scope

Проверить transition endpoints:

- anonymous denied;
- BUYER не получает internal Order mutation;
- PARTNER не получает internal mutation;
- правильные internal roles;
- object scope;
- forged order/customer/actor;
- invalid state.

Canonical event emission не должно иметь отдельного user permission.

---

# 19. Buyer Cabinet regression

Проверить:

- Buyer own Orders;
- чужие Orders недоступны;
- event/internal fields не добавлены в projection;
- statuses/dates не изменили UI semantics.

---

# 20. Booking regression

Проверить:

- BookingRequested consumer;
- duplicate Booking protection;
- BookingConfirmed/Rejected flows;
- reconcile back into Order;
- no cross-schema direct ownership violation.

---

# 21. Marketplace / Storefront regression

Подтвердить, что Step 1.14 не изменил:
- Product;
- publication channels;
- Seller identity;
- Storefront;
- behavioral instrumentation;
- public DTO.

---

# 22. Migration / schema

Отчёт говорит schema не менялась.

Проверить:
- Prisma schema diff;
- hidden migration отсутствует;
- `migrate status`;
- `migrate diff`;
- no `db push`;
- applied migration untouched.

---

# 23. Required targeted E2E

Минимум:

1. confirm → 1 OrderReadyForBooking.
2. process → 0 OrderReadyForBooking.
3. retry confirm → no duplicate.
4. concurrent confirm → exactly 1.
5. send → BookingRequested exactly 1.
6. confirm alone → no Booking.
7. complete → 1 OrderFulfilled.
8. reconcile FULFILLED → 1 OrderFulfilled.
9. reconcile + complete race → no duplicate logical fulfillment fact.
10. partial fulfill → no OrderFulfilled.
11. payment status change → no OrderFulfilled.
12. close → 1 OrderClosed.
13. fulfilled → no OrderClosed.
14. cancelled → no OrderClosed.
15. retry/concurrent close → no duplicate.
16. canonical transitions → no generic OrderStatusChanged.
17. technical transition → generic event only where intended.
18. payload contains only whitelist.
19. rollback → no orphan state/history/event.
20. duplicate consumer delivery → one side effect.
21. old OrderApproved absent.
22. Buyer own-scope regression.

---

# 24. Runtime verification

Повторить live/dev flow independently:

`create/bootstrap current allowed path`
→ process
→ confirm
→ send
→ booking consumer
→ fulfill/reconcile
→ close.

Для каждого шага проверить:

- Order state;
- OrderHistory;
- Outbox rows;
- canonical event count;
- generic event count;
- Booking side effect;
- duplicate retry.

Не считать предыдущий runtime report доказательством.

Smoke data удалить.

---

# 25. Docs review

Проверить:
- `events.md`;
- `api.md`;
- `phase1-dod.md`;
- `temporal-readiness.md`.

Docs должны описывать **фактический** current lifecycle.

Не утверждать Phase 2 future Order temporal contract как реализованный.

Явно зафиксировать:

`Correlation/causation enrichment deferred to Step 1.15/1.15A.`

---

# 26. Full regression

Backend:
- `tsc --noEmit`;
- unit;
- canonical Order e2e;
- phase1/order;
- booking;
- buyer-cabinet;
- outbox/inbox;
- auth/RBAC;
- temporal readiness;
- full serial e2e.

Frontend:
- `tsc --noEmit`;
- vitest;
- production build.

DB:
- migration status;
- drift check.

---

# 27. Approval criteria

Step 1.14 может быть рекомендован к APPROVED только если:

- canonical semantics доказаны;
- ReadyForBooking и BookingRequested разделены корректно;
- Fulfilled имеет один logical fact несмотря на multiple producer paths;
- Closed не смешан с fulfilled/cancelled;
- generic event не подменяет canonical;
- old OrderApproved удалён из production contract;
- atomicity доказана;
- concurrency/idempotency доказаны;
- Inbox consumer dedup доказан;
- payload minimal;
- Phase 2 и Step 1.15 boundaries соблюдены;
- regression green.

---

# 28. Review fixes

Если найден локальный дефект — исправить.

Каждый:

`FIX N — <название>`

с:
- problem;
- risk;
- root cause;
- files;
- fix;
- tests;
- regression.

Не расширять scope.

---

# 29. Architecture decision triggers

Вернуть:

`ARCHITECTURE DECISION REQUIRED`

если обнаружено, что:

- confirm на самом деле не означает ReadyForBooking;
- BookingRequested/ReadyForBooking невозможно честно разделить;
- fulfillment имеет конфликтующие authoritative producers;
- CLOSED semantics отсутствует;
- требуется новый lifecycle/status;
- требуется cross-domain synchronous write;
- требуется Phase 2 redesign.

Не решать молча.

---

# 30. Формат итогового отчёта

Вернуть:

# PHASE 1 — STEP 1.14 — STRICT REVIEW — ОТЧЁТ

1. Verdict
2. Files/modules inspected
3. Actual Order lifecycle matrix
4. Existing event inventory
5. OrderReadyForBooking review
6. BookingRequested boundary
7. OrderFulfilled review
8. OrderClosed review
9. Generic OrderStatusChanged audit
10. OrderApproved removal
11. Payload contract
12. Atomicity
13. Idempotency
14. Concurrency
15. Inbox consumer dedup
16. Outbox semantics
17. Temporal semantics
18. Step 1.15/1.15A boundary
19. Phase 2 boundary
20. Acquisition boundary
21. RBAC/object scope
22. Buyer Cabinet regression
23. Booking regression
24. Marketplace/Storefront regression
25. Migration/drift
26. Unit tests
27. E2E tests
28. Runtime verification
29. Docs review
30. Full regression
31. Issues/fixes
32. Remaining debt
33. Architecture decision status
34. Out-of-scope confirmation

Если fixes были:

`PHASE 1 STEP 1.14 REVIEW FIXES COMPLETED — WAITING FOR APPROVAL`

Если fixes не нужны:

`PHASE 1 STEP 1.14 REVIEW PASSED — WAITING FOR APPROVAL`

Не переходить к Step 1.15.
