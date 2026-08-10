# PHASE 2 — STEP 2.4 — SALE COMPLETION → ORDERREQUESTED + AVAILABILITY RESERVATION GATE — IMPLEMENTATION PROMPT

## 0. Роль и режим

Выполни **PHASE 2 — STEP 2.4 — Sale Completion → OrderRequested** для TravelHub на фактическом состоянии репозитория после:

`PHASE 2 STEP 2.3B STRICT REVIEW COMPLETED — APPROVED`

Это implementation pass.

**НЕ выполнять Strict Review в этом же проходе.**
**НЕ начинать Step 2.5.**
**НЕ создавать Booking.**
**НЕ создавать Payment/PSP/Ledger/Refund/Settlement/Payout.**

Implementation report предыдущего шага не является доказательством — быстро проверь фактический baseline перед изменениями.

Если mandatory semantics нельзя однозначно вывести из Roadmap/ADR/approved foundations, остановись:

`ARCHITECTURE DECISION REQUIRED`

---

# 1. Главная цель

Реализовать canonical переход:

`Sales commercial intent → completed Sale → OrderRequested`

так, чтобы:

1. Sale completion была единственной canonical командой завершения продажи;
2. до `OrderRequested` был выполнен обязательный **atomic availability revalidate/reserve gate**;
3. Checkout commercial snapshot был детерминирован и неизменяем для downstream Order;
4. payment terms snapshot передавался без reinterpretation;
5. acquisition source сохранялся;
6. critical outbox delivery имела достаточную reliability для нового business-critical события;
7. повторный/concurrent completion не создавал два заказа/две резервации/два события;
8. Sales не создавал Order напрямую.

---

# 2. Mandatory baseline audit

Перед кодом изучить фактические:

- `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- Phase 2 entry audit / prerequisites;
- Step 2.1 Sales foundation;
- Step 2.3 Quote;
- Step 2.3A Checkout;
- Step 2.3B Payment Terms;
- Step 1.14 canonical Order events;
- Step 1.15 request/correlation;
- Step 1.18 outbox failure/reliability findings;
- ADR-0001 и актуальные ADR;
- DD-021;
- DD-022;
- DD-023;
- `schema.prisma`;
- Sales/Checkout/Sale services;
- Catalog Availability/Tariff/Product models;
- EventBus/Outbox/Inbox;
- Order domain and existing `BookingRequested` conventions.

Зафиксировать **Current → Target**.

---

# 3. Mandatory pre-2.4 gates

До публикации первого production `OrderRequested` должны быть закрыты либо атомарно включены в Step 2.4:

### G1 — Availability reservation/locking
Approved 2.3A/2.3B оставили availability как `checked-not-reserved`.

Нельзя публиковать `OrderRequested`, пока capacity не зарезервирована/атомарно подтверждена canonical owner-ом.

### G2 — Outbox reliability
Business-critical `OrderRequested` не может зависеть от механизма, который переводит FAILED event в terminal state без корректной retry policy.

Проверить Step 1.18 debt и закрыть минимально необходимую reliability до включения critical chain.

### G3 — Commercial snapshot
Order consumer должен получить/прочитать immutable commercial facts без повторного чтения mutable Catalog price.

### G4 — Idempotent/atomic Sale completion
Повторный HTTP/concurrent call не должен создавать повторный reservation/event/order.

Если любой gate требует отдельного owner-step по Roadmap и не может честно входить в 2.4 — остановиться до реализации `OrderRequested` и вернуть точный prerequisite.

---

# 4. Ownership

Соблюдать ADR-0001:

- Sales владеет Sale/Checkout;
- Catalog/Inventory владеет availability/capacity;
- Order domain владеет Order;
- EventBus владеет outbox transport.

Sales **НЕ пишет Order table напрямую**.

Canonical cross-context transition:

`Sales → OrderRequested event → Order consumer`

Availability reservation должна выполняться через canonical owner contract, а не прямым произвольным cross-schema write из Sales.

Если текущая архитектура не имеет безопасного owner API/service boundary для reservation — `ARCHITECTURE DECISION REQUIRED`.

---

# 5. Sale completion semantics

Определить точную команду, например:

`completeSale(...)`

или repo-canonical equivalent.

Completion должна означать:

- commercial intent окончательно выбран;
- Checkout существует и пригоден;
- payment terms выбраны, если они mandatory;
- availability успешно зарезервирована;
- immutable commercial snapshot зафиксирован;
- Sale переходит в canonical terminal/completed state;
- `OrderRequested` записан в outbox в согласованной atomic workflow.

Не использовать generic status PATCH.

---

# 6. Sale lifecycle reconciliation

Фактический Step 2.1 заявлял `Sale OPEN → CLOSED`.

Проверить Roadmap: является ли `CLOSED` canonical состоянием успешного Sale completion или нужны отдельные semantics.

Не переименовывать enum без canonical basis.

Критически отличать:

- Sale completed/closed;
- Order fulfilled;
- Order closed;
- Payment paid.

Если `CLOSED` неоднозначен между successful sale и abandoned/lost — остановиться и разрешить lifecycle semantics до использования.

---

# 7. Checkout prerequisites

Перед completion проверить минимум:

- Checkout существует;
- Checkout не CANCELLED;
- source Quote binding snapshot валиден по approved policy;
- serviceDate present if mandatory;
- traveler requirements satisfied;
- paymentTerms selected if required by 2.3B;
- Product/Tariff references canonical;
- commercial totals valid;
- acquisition source known;
- availability reservation succeeds.

Не фабриковать отсутствующие optional options/service-time fields.

---

# 8. Quote expiry policy

2.3B approved: Quote expiry после создания Checkout не блокирует изменение terms; frozen Checkout остаётся price authority.

Step 2.4 должен определить canonical completion gate:

- может ли Sale завершиться после expiry source Quote?
- если да — на каком основании Checkout сохраняет validity?
- если нет — completion → controlled 422/409.

Следовать Roadmap/approved docs.

Не reprice из Catalog.

---

# 9. Payment Terms prerequisite

Определить, обязателен ли `paymentTerms != null` перед Sale completion.

Если Roadmap требует payment scheme для canonical commercial snapshot — отсутствие terms должно блокировать completion.

Не выбирать default scheme автоматически.

Никакого `FULL_PREPAYMENT` fallback.

---

# 10. Commercial snapshot — CRITICAL

До OrderRequested должен существовать immutable snapshot достаточный для Order foundation.

Минимально рассмотреть:

- Sale/Checkout identifiers;
- customerId if present;
- productId;
- tariffId if canonical;
- quoteId/reference;
- serviceDate;
- travelers snapshot/reference semantics;
- subtotal;
- discount;
- total;
- currency;
- payment scheme;
- prepayment type/value if applicable;
- initialAmount;
- remainingAmount;
- acquisitionSource;
- publication/channel context if available;
- reservation reference;
- options only if canonical model exists.

**Не добавлять поля, которых canonical model ещё не имеет.**

---

# 11. Snapshot persistence

Определить canonical owner/persistence:

- immutable snapshot on Sale;
- dedicated Sales snapshot entity;
- event payload + durable source;
- другой Roadmap-defined mechanism.

Предпочесть модель, позволяющую Order consumer получить exact commercial facts даже если Product/Tariff/Quote/Checkout позже меняются.

Не заставлять Order consumer повторно читать mutable Catalog price.

---

# 12. Snapshot immutability

После successful Sale completion:

- snapshot immutable;
- Checkout commercial fields, влияющие на snapshot, больше не должны изменять уже завершённую Sale semantics;
- repeated completion returns conflict/idempotent result according to canonical contract, но не переписывает snapshot.

---

# 13. Availability owner audit — CRITICAL

Изучить реальные:

- `Availability`;
- Tariff;
- Product;
- service date;
- capacity/slots;
- existing booking/order reservation fields;
- unique constraints;
- existing Catalog commands.

Не придумывать capacity semantics.

Ответить:
- что именно резервируется?
- на какую дату?
- в каком количестве?
- traveler count влияет?
- unlimited availability существует?
- как представлена remaining capacity?
- как снимается reservation при failure/cancel?

---

# 14. Reservation model

Нужна canonical durable reservation/hold, если inventory ограничен.

Reservation должна иметь минимум:
- stable ID/code if Roadmap requires;
- owner context;
- product/tariff;
- service date;
- quantity;
- source Sale/Checkout;
- state;
- created/reserved timestamp;
- release/consume semantics только если owner-step определён.

Не использовать только `Availability.available -= n` без traceable reservation, если это ломает восстановимость.

---

# 15. Atomic last-slot protection — BLOCKER GATE

Обязательный concurrency proof:

При remaining capacity = 1 и двух concurrent Sale completions:

- ровно одна reservation succeeds;
- ровно одна Sale completes;
- ровно один `OrderRequested`;
- второй получает controlled conflict/unavailable response;
- capacity не становится отрицательной;
- нет orphan reservation;
- нет completed Sale без event.

Это обязательный acceptance test.

---

# 16. Reservation transaction boundary

Cross-context transaction semantics должны быть честными.

Если Sales и Availability находятся в одной PostgreSQL DB, техническая transaction может быть общей, но ownership boundary всё равно должен проходить через owner service/command.

Если atomicity между reservation и Sales/outbox невозможна одной transaction — нужен explicit saga/compensation design, что может потребовать architecture decision.

Не симулировать atomicity комментариями.

---

# 17. Reservation release

Определить поведение при:

- validation failure до reserve;
- reserve success + Sale update failure;
- reserve success + outbox insert failure;
- duplicate completion;
- event delivery failure.

Если одна DB transaction — rollback должен убрать reservation.

После committed Sale + outbox FAILED reservation НЕ должна автоматически освобождаться, если OrderRequested ещё может быть retried.

Release-on-business-cancel belongs only where Roadmap defines it.

---

# 18. Revalidation

Completion должен revalidate actual availability непосредственно перед reserve.

Step 2.3A `revalidate` endpoint не является guarantee.

Нельзя доверять старому `availabilityCheckedAt`.

---

# 19. Traveler quantity

Если availability capacity зависит от traveler count:

- quantity = canonical traveler count;
- server-derived;
- client не передаёт reserve quantity напрямую.

Если current Availability не quantity-based — не изобретать.

---

# 20. Service date/time

Reservation использует честную текущую serviceDate model.

Если time/slot ещё отсутствует до 2.8A:
- не создавать fake time;
- резервировать только на том уровне, который реально поддерживает current Availability.

Если inventory требует time-slot, а model его не имеет — architecture/blocker, не fake date-only reservation.

---

# 21. Options limitation

2.3A approved options omission как acceptable limitation.

2.4 не должен изобретать arbitrary options JSON.

Если availability/order snapshot невозможно корректно определить без option identity — остановиться.

---

# 22. Acquisition propagation

`CheckoutIntent.acquisitionSource` должен попасть в immutable Sale/commercial snapshot и далее в canonical `OrderRequested` contract, если Roadmap 2.5B ожидает downstream attribution.

Не default/recompute в consumer.

Publication channel ≠ acquisition source.

---

# 23. DIRECT current limitation

Текущий 2.3A internal-assisted flow использует server-derived `DIRECT`.

Не открывать public Marketplace/Storefront checkout сейчас.

Но snapshot/event contract не должен архитектурно фиксировать только DIRECT как единственно возможное значение.

---

# 24. OrderRequested canonical event

Проверить существующий event registry/contracts.

`OrderRequested` должен быть canonical business event/command согласно Roadmap.

Определить:
- eventType;
- aggregateType;
- aggregateId;
- payload version;
- actor metadata via envelope;
- correlation/causation;
- idempotency identity.

Не создавать `SaleCompleted` event без consumer только ради симметрии.

---

# 25. Event payload minimization

Payload не должен содержать:
- email;
- phone;
- passport;
- traveler PII;
- raw Checkout;
- raw Quote;
- CRM notes;
- auth data.

Предпочесть identifiers + immutable commercial snapshot fields только если Order consumerу они действительно нужны.

Если traveler details нужны Order, использовать canonical secure transfer/source rather than leaking into generic outbox payload unless Roadmap explicitly mandates snapshot there.

---

# 26. Correlation / causation

Step 1.15 invariants:

- HTTP correlation server-authoritative;
- `OrderRequested` inherits correlation from Sale completion request;
- no business code as correlationId;
- causation only if there is a real immediate parent event;
- independent HTTP completion has no invented event causation.

---

# 27. Outbox atomicity

`OrderRequested` insert должен быть committed согласованно с successful Sale completion and reservation.

Нельзя:

1. commit Sale;
2. потом отдельно emit event.

Если emit fails, Sale не должна остаться completed без durable event.

---

# 28. Outbox retry reliability — CRITICAL

Перед critical chain inspect current EventBus behavior.

Если FAILED event не retryable, реализовать минимальный durable retry contract, соответствующий Roadmap/Step 1.18 debt.

Проверить:
- attempts;
- last error;
- retryable status;
- max attempts;
- backoff or explicit retry policy;
- no duplicate consumer side effect;
- correlation preserved;
- causation preserved;
- poison event behavior.

Не строить vendor queue.

---

# 29. Retry semantics

Retry должен работать для уже committed `OrderRequested`.

Failure consumer delivery не должна:
- создавать второй event;
- менять event ID;
- менять correlation;
- создавать duplicate Order.

Inbox dedup remains authoritative consumer protection.

---

# 30. Order consumer

Step 2.4 scope по Roadmap проверить внимательно.

Если 2.4 только emits `OrderRequested`, а Order creation belongs 2.5:
- **НЕ создавать Order сейчас**.

Если Roadmap прямо включает consumer в 2.4 — следовать Roadmap.

Не переносить Step 2.5 вперёд.

---

# 31. Sale completion idempotency

Проверить canonical request idempotency requirement.

Минимум:
- CAS/version;
- concurrent double completion one winner;
- repeated completion does not create duplicate reservation/event.

Если Roadmap требует explicit idempotency key already in 2.4 — реализовать canonical key.

Не объявлять CAS полной network retry idempotency, если это не так.

---

# 32. HTTP API

Добавить dedicated command, например:

`POST /api/v1/sales/sales/:code/complete`

или repo-canonical route.

Не generic PATCH.

Request должен содержать только необходимые client-selectable inputs, вероятно:
- expectedVersion;
- ничего из derived snapshot/reservation/event IDs.

---

# 33. RBAC / capabilities

Использовать existing permission/capability model.

Никаких:
`if (role === 'SALES_MANAGER')`.

Small-organization invariant сохраняется:
одному сотруднику можно в будущем дать набор capabilities разных operational centers без искусственной универсальной роли.

Проверить ADMIN, SALES_MANAGER, DIRECTOR, OPERATOR и остальные по актуальной матрице/roadmap.

---

# 34. Admin access architecture compatibility

Step 2.4 не должен ухудшить будущую admin-configurable navigation/access model.

Backend authorization = capability.
Frontend menu visibility later = capability projection, не role names.

UI access management не реализовывать, если не owner-step.

---

# 35. DTO / mass assignment

Запретить forged:

- status;
- snapshot totals;
- currency;
- acquisitionSource;
- reservationId;
- quantity;
- orderId;
- eventId;
- payment status;
- paid amount;
- actor;
- correlation;
- timestamps;
- version except expectedVersion input contract.

---

# 36. History

Successful completion должен создать ровно один SaleHistory milestone.

History должна отражать:
- previous/new status;
- actor;
- completion semantic;
- safe snapshot reference if needed.

No PII/raw body.

Reservation имеет собственную owner history/state if model requires.

---

# 37. AuditLog

Audit:
- sale completion;
- reservation if owner convention requires.

Safe details only.
Correlation via existing infrastructure.
No duplicate audit on retry/conflict.

---

# 38. Temporal semantics

Если Sale completion — canonical milestone, добавить dedicated `completedAt`/`closedAt` только если Roadmap/business question требует direct column.

Не использовать `updatedAt` как milestone.

Reservation timestamps должны быть explicit.

No fake backfill.

---

# 39. Failure atomicity matrix

Обязательно доказать:

| Failure | Sale completed? | Reservation? | Outbox? |
|---|---|---|---|
| validation fail | no | no | no |
| terms missing | no | no | no |
| unavailable | no | no | no |
| stale CAS | no | no | no |
| reservation DB fail | no | no | no |
| Sale update fail | no | no | no |
| outbox insert fail | no | no | no |
| consumer delivery fail after commit | yes | yes | durable retryable event |

Последняя строка принципиально отличается: delivery failure ≠ rollback committed business transaction.

---

# 40. Payment absence

Payment terms — только commercial obligation.

Step 2.4 не создаёт:
- Payment;
- PSP intent;
- authorization;
- capture;
- invoice;
- ledger entry;
- refund.

Sale completion ≠ paid.

---

# 41. Booking absence

Не создавать Booking.
Не резервировать supplier booking как часть availability reservation.

Inventory reservation ≠ Booking.

---

# 42. Supplier boundary

Supplier lifecycle/booking orchestration остаётся future step.

Не добавлять supplier confirmation.

---

# 43. Existing Order foundation isolation

Не использовать legacy `/orders/bootstrap` как shortcut.

Roadmap prerequisite removal remains Step 2.6 unless actual roadmap says otherwise.

`OrderRequested` не должен вызывать bootstrap endpoint.

---

# 44. Migration strategy

Любые schema changes:
- additive;
- nullable where legacy unknown;
- no fake backfill;
- no guessed timestamps;
- deterministic;
- clean replay;
- no drift;
- prior migrations untouched.

Reservation uniqueness/indexes должны поддерживать concurrency invariant.

---

# 45. Existing Sale rows

Если добавляется completion timestamp/snapshot fields:
- existing OPEN/CLOSED legacy Step 2.1 rows не backfill угадыванием;
- NULL semantics documented.

Не считать старый CLOSED автоматически canonical completed, если он возник до Step 2.4 semantics без доказательства.

---

# 46. Required unit tests

Минимально:
- completion prerequisite validator;
- snapshot builder;
- payment terms snapshot;
- acquisition propagation;
- reservation quantity/date classification;
- availability transition rules;
- retry/backoff helpers if introduced;
- no money float;
- legacy/null semantics.

---

# 47. Required E2E — core

Создать отдельный Step 2.4 suite.

Минимум:

1. anonymous 401;
2. unauthorized 403;
3. authorized completion;
4. terms missing → blocked if mandatory;
5. cancelled Checkout → blocked;
6. unavailable → blocked;
7. successful reservation;
8. Sale status/milestone;
9. exactly one OrderRequested;
10. payload whitelist/no PII;
11. frozen total/currency exact;
12. payment terms exact;
13. acquisition source exact;
14. no Order if consumer belongs 2.5;
15. no Booking;
16. no Payment;
17. history;
18. audit;
19. requestId/correlation.

---

# 48. Required E2E — concurrency

Mandatory:

20. two concurrent completions same Sale → one success;
21. same last slot across two different Sales → one success;
22. capacity never negative;
23. exactly one reservation per successful Sale;
24. exactly one event per completed Sale;
25. failed contender has no completion history/event/reservation.

---

# 49. Required E2E — failure injection

Inject:
- reservation failure;
- Sale update failure if practical;
- outbox insert failure;
- consumer delivery failure.

Prove matrix §39.

Do not weaken production error handling merely to test.

---

# 50. Required E2E — retry

If retry implemented:
- first delivery fails;
- event becomes retryable;
- retry succeeds;
- same event ID;
- attempts increments;
- correlation preserved;
- Inbox prevents duplicate Order side effect when consumer exists;
- max-attempt/poison behavior controlled.

---

# 51. TOCTOU test

Explicit test:

- both flows pass pre-check;
- only one atomic reserve wins.

A test that serially calls reserve is insufficient.

Use barrier/concurrency technique if needed.

---

# 52. Commercial immutability test

After completion mutate allowed mutable source data where possible:
- Product/Tariff current price;
- Quote-related mutable metadata;
- Checkout fields if lifecycle allows.

Prove completed Sale snapshot / OrderRequested commercial facts do not change.

---

# 53. Acquisition immutability test

Completed snapshot/event retains acquisition source even if upstream context later changes/is deleted where allowed.

---

# 54. Payment terms immutability test

After completion, payment terms used by snapshot/event cannot be silently reinterpreted.

If Checkout mutation after completion is still technically possible, completion snapshot must remain unchanged.

---

# 55. Runtime verification

На isolated test DB/backend:

1. create Quote;
2. create Checkout;
3. select payment terms;
4. configure finite availability;
5. create/open Sale;
6. complete;
7. inspect reservation;
8. inspect Sale snapshot/status;
9. inspect Outbox OrderRequested;
10. force retry scenario;
11. verify no Order if Step 2.5 owns consumer;
12. verify no Booking/Payment;
13. verify requestId/correlation.

Не загрязнять dev DB.

---

# 56. Full regression

Backend:
- `tsc --noEmit`;
- all unit;
- Step 2.1;
- Step 2.2;
- Step 2.3;
- Step 2.3A;
- Step 2.3B;
- Step 1.14 events;
- Step 1.15 correlation;
- Step 1.18 outbox reliability;
- new 2.4 suite;
- full serial e2e.

Frontend:
- `tsc --noEmit`;
- vitest;
- production build.

Migrations:
- status;
- clean replay;
- diff/no drift.

Skipped/timeouts ≠ pass.

---

# 57. Documentation

Создать/update repo-consistent architecture doc для Step 2.4.

Документировать:

- owner boundaries;
- Sale completion meaning;
- prerequisites;
- commercial snapshot;
- payment terms propagation;
- acquisition propagation;
- availability owner;
- reservation semantics;
- last-slot concurrency;
- failure atomicity;
- OrderRequested contract;
- correlation;
- outbox retry;
- idempotency;
- no Payment/Booking;
- Step 2.5 boundary;
- legacy/null limitations.

Update events contract if OrderRequested payload/version changes.

---

# 58. DD-022 closure

Step 2.4 report обязан явно сказать:

`DD-022 / availability reservation prerequisite: CLOSED`

или

`ARCHITECTURE DECISION REQUIRED`.

Нельзя завершить 2.4 с `checked-not-reserved` и всё равно публиковать OrderRequested.

---

# 59. Outbox debt closure

Отчёт обязан явно классифицировать Step 1.18 FAILED retry debt:

- CLOSED sufficiently for critical OrderRequested chain;
- or BLOCKER.

Нельзя оставить critical event без durable recovery path.

---

# 60. PMT-* boundary

2.3B approved inline Checkout payment terms как precursor; Finance PMT-* belongs later.

2.4 snapshot не создаёт PMT entity.

Не переинтерпретировать scheme как Payment.

---

# 61. Partner allowed-schemes boundary

Если 2.3B Strict Review признал partner-specific allowlist future owner, 2.4 не должен молча считать глобальные 5 schemes partner-approved.

Для current internal-assisted flow использовать только уже утверждённую semantics.

Если Sale completion требует partner authorization of scheme, а source-of-truth отсутствует — это blocker/architecture question.

---

# 62. Roadmap reconciliation

В конце явно сопоставить фактическую реализацию с roadmap 2.4:

- Sale completion;
- commercial snapshot;
- reservation gate;
- OrderRequested;
- reliability;
- idempotency;
- downstream owner.

Никакого scope creep в 2.5.

---

# 63. Architecture decision triggers

Вернуть `ARCHITECTURE DECISION REQUIRED`, если:

- Availability owner/reservation semantics не определимы;
- capacity/time-slot model недостаточна для честной reservation;
- cross-context atomicity невозможно обеспечить без saga decision;
- Sale CLOSED semantics неоднозначны;
- OrderRequested payload authority неоднозначен;
- commercial snapshot owner не определён;
- partner allowed payment scheme обязателен, но source-of-truth отсутствует;
- retry semantics требуют нового platform-wide policy, которого нет;
- Step 2.4 требует создания Order вопреки roadmap owner 2.5.

---

# 64. Required final report

Вернуть:

# PHASE 2 — STEP 2.4 — SALE COMPLETION → ORDERREQUESTED + AVAILABILITY RESERVATION GATE — ОТЧЁТ

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target
5. Roadmap scope
6. Previous-step invariants
7. Mandatory gates
8. Ownership
9. Sale lifecycle
10. Completion semantics
11. Checkout prerequisites
12. Quote expiry policy
13. Payment Terms prerequisite
14. Commercial snapshot model
15. Snapshot immutability
16. Money/currency propagation
17. Acquisition propagation
18. Availability current model
19. Reservation owner
20. Reservation model
21. Capacity semantics
22. Traveler quantity
23. Service date/time
24. Atomic last-slot protection
25. TOCTOU proof
26. Reservation transaction boundary
27. Reservation rollback/release
28. DD-022 status
29. OrderRequested contract
30. Event payload/privacy
31. Correlation/causation
32. Outbox atomicity
33. Retry reliability
34. Retry/idempotency
35. Sale completion concurrency
36. API surface
37. RBAC/capabilities
38. Small-organization compatibility
39. DTO/mass-assignment
40. History
41. Audit
42. Temporal semantics
43. Failure atomicity
44. Payment absence
45. Booking absence
46. Order/Step 2.5 boundary
47. Migration
48. Legacy/null semantics
49. Unit tests
50. E2E core tests
51. E2E concurrency tests
52. Failure-injection tests
53. Retry tests
54. Runtime verification
55. Full regression
56. Documentation
57. Deferred decisions
58. Issues found/fixed
59. Remaining prerequisites
60. Architecture decision status
61. Out-of-scope confirmation
62. Files changed

Final line:

`PHASE 2 STEP 2.4 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

---

# 65. Stop condition

После implementation:

**НЕ выполнять Strict Review.**
**НЕ начинать Step 2.5.**

Вернуть полный implementation report и ждать отдельного Strict Review prompt.
