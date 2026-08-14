# PHASE 2 — STEP 2.13A — CHARGEBACK / DISPUTE FOUNDATION — IMPLEMENTATION

## 0. ROLE

Ты выполняешь **PHASE 2 — STEP 2.13A — CHARGEBACK / DISPUTE FOUNDATION** проекта TravelHub.

Это **implementation pass**, не Strict Review.

Работай по фактическому репозиторию и актуальному `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`.

Не доверяй старым implementation reports как источнику истины, если они расходятся с кодом, schema, migrations или актуальным Roadmap.

---

# 1. CURRENT CERTIFIED BASELINE

Перед изменениями самостоятельно подтвердить:

- Step 2.10 — Finance Domain Foundation — APPROVED;
- Step 2.10A — Ledger Transaction Foundation — APPROVED;
- Step 2.10B — Provider Fee / Settlement / Payout Foundation — APPROVED;
- Step 2.10C — Finance Temporal Contract — APPROVED;
- Step 2.11 — Pricing & Financial Snapshot — APPROVED;
- Step 2.12 — Payment Flow — APPROVED;
- Step 2.13 — Refund Flow — APPROVED;
- Roadmap reconciliation `2.12A–2.12G vs 2.13/2.13A` завершён с verdict:

`ROADMAP RECONCILIATION COMPLETED — MIXED DEPENDENCY ORDER ESTABLISHED`

Ключевой результат reconciliation:

- Steps 2.12A–2.12G — **NOT STARTED later extensions**, а не пропущенные prerequisites для 2.13;
- Step 2.13 остаётся APPROVED;
- Step 2.13A разрешён сейчас **только как provider-neutral Chargeback / Dispute Foundation**;
- real-PSP chargeback требует 2.12A/2.12B;
- ledger adjustments требуют 2.12D;
- commission adjustments/reversals требуют соответствующих 2.12C/2.12E;
- settlement-related adjustments требуют соответствующего later settlement lifecycle step (в reconciliation указан 2.14A — проверить точное название по Roadmap).

Если repository state этому не соответствует — STOP и report mismatch.

---

# 2. PRIMARY GOAL

Реализовать **provider-neutral foundation для chargeback/dispute domain**, который:

1. фиксирует каноническую сущность спора/chargeback;
2. имеет ясного Finance owner;
3. привязывается к существующему captured Payment как к финансовому source authority;
4. поддерживает безопасный минимальный lifecycle только в объёме, который прямо определён Roadmap;
5. хранит immutable/frozen financial facts, необходимые для исторической истины;
6. обеспечивает server-owned identifiers, provenance, temporal facts, RBAC, audit/history;
7. не притворяется реальным PSP chargeback engine;
8. не пишет LedgerTransaction;
9. не создаёт Commission/CommissionAccrual;
10. не изменяет Settlement/Payout;
11. не реализует provider webhooks/adapters;
12. не делает cross-domain writes;
13. оставляет later PSP/accounting extensions аддитивными.

---

# 3. REQUIRED SOURCES — READ BEFORE CODING

Обязательно изучить фактические:

1. `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
   - body Step 2.13A;
   - Finance execution sequence;
   - Dependency Analysis;
   - prerequisites, добавленные reconciliation audit.

2. `docs/prompts/PHASE_2_ROADMAP_RECONCILIATION_2.12A_TO_2.13A_REPORT.md`

3. Step 2.12:
   - implementation report;
   - strict review report;
   - `docs/architecture/payment-flow.md`.

4. Step 2.13:
   - implementation report;
   - strict review report;
   - `docs/architecture/refund-flow.md`.

5. Finance:
   - `finance-domain-foundation`;
   - `ledger-transaction-foundation`;
   - `provider-fee-settlement-payout-foundation`;
   - `finance-temporal-contract`;
   - pricing/financial snapshot architecture.

6. Contracts:
   - `docs/contracts/api.md`;
   - `docs/contracts/events.md`;
   - `docs/contracts/ids.md`;
   - ADRs, особенно cross-domain ownership и correlation/causation/actor contracts.

7. Code:
   - `backend/prisma/schema.prisma`;
   - PaymentService/controller/DTO/validation;
   - RefundService/controller/DTO/validation;
   - LedgerService;
   - SettlementService;
   - Order-owned Payment/Refund projections;
   - EventBus/outbox/inbox;
   - AuditLog/history patterns;
   - `permissions.constants.ts`;
   - Security role seeding;
   - IdsService;
   - money validation helpers;
   - validation pipe / forbidden-key helpers.

8. Migrations and e2e harness.

Не придумывать scope Step 2.13A по названию. **Точный canonical scope берётся из актуального Roadmap.**

---

# 4. REPOSITORY-WIDE PRE-IMPLEMENTATION AUDIT — HARD GATE

До изменения кода выполнить repo-wide поиск:

`Chargeback`
`Dispute`
`CHARGEBACK`
`DISPUTE`
`chargeback`
`dispute`
`providerDispute`
`providerRef`
`PaymentCaptured`
`RefundProcessed`
`LedgerTransaction`
`CommissionAccrual`
`Settlement`
`Payout`
`webhook`
`PSP`
`authorizedAt`
`capturedAt`

Определить:

- нет ли уже частичной модели;
- нет ли legacy runtime;
- нет ли скрытого writer-а;
- нет ли существующего ID prefix;
- нет ли уже event vocabulary;
- нет ли conflicting semantics.

Если обнаружены две несовместимые модели Chargeback/Dispute:
`ARCHITECTURE DECISION REQUIRED` — STOP.

---

# 5. CANONICAL TERMINOLOGY — HARD GATE

Из Roadmap определить:

- является ли aggregate канонически `Dispute`, `Chargeback` или обе сущности различны;
- что означает chargeback относительно dispute;
- есть ли отдельный lifecycle;
- какой объект является source authority;
- какая cardinality допустима.

**Не создавать одновременно `Chargeback` и `Dispute`, если Roadmap не требует две отдельные сущности.**

**Не объединять их в одну сущность, если Roadmap явно различает их.**

Документировать принятое решение ссылкой на фактический Roadmap scope.

---

# 6. OWNERSHIP

Chargeback/Dispute aggregate принадлежит **Finance domain**.

Hard rules:

- Finance может писать только собственные `finance.*` сущности;
- Finance НЕ пишет `order.*`;
- Finance НЕ пишет `booking.*`;
- Finance НЕ пишет `sales.*`;
- Finance НЕ пишет `catalog.*`;
- Finance НЕ пишет `availability.*`;
- Finance НЕ пишет Payment aggregate вне его существующего PaymentService authority;
- никакого cross-schema FK, если это запрещено действующими ADR.

Связи на внешние домены — durable IDs/snapshots, не cross-domain writes.

---

# 7. SOURCE AUTHORITY

Определи source authority по Roadmap.

По reconciliation foundation ожидается provider-neutral source на базе существующего Payment/Refund state, но это надо подтвердить.

Минимальный безопасный принцип:

- dispute/chargeback нельзя создавать против несуществующего Payment;
- нельзя создавать против Payment, который никогда не был CAPTURED, если Roadmap не определяет другой источник;
- source financial facts должны происходить из frozen Payment, а не из mutable Catalog/Tax/FX;
- client не передаёт authoritative `currency`, `orderId`, commercial price или captured amount.

Если Roadmap требует provider transaction identity, которого ещё нет из-за 2.12A/B:
**не выдумывать его**. Ограничить foundation provider-neutral scope.

---

# 8. PROVIDER-NEUTRAL BOUNDARY — ABSOLUTE HARD GATE

В 2.13A запрещено реализовывать:

- Stripe/Adyen/PayPal/иные PSP adapters;
- webhook endpoints;
- webhook signature validation;
- PSP API calls;
- provider polling;
- provider credentials/secrets;
- provider-specific state machine;
- provider dispute IDs как обязательный source authority, если их ещё нет в canonical Payment;
- automatic PSP refund/chargeback execution.

Допустимы только нейтральные optional provenance/reference fields, **если Roadmap это разрешает** и они не становятся ложной authority.

Если для корректной реализации foundation реально требуется PSP semantics:
`ARCHITECTURE DECISION REQUIRED` — STOP.

---

# 9. LEDGER BOUNDARY — ABSOLUTE HARD GATE

Step 2.12D не выполнен.

Поэтому 2.13A:

- НЕ создаёт LedgerTransaction;
- НЕ меняет LedgerService;
- НЕ рассчитывает balances;
- НЕ вводит double-entry;
- НЕ делает accounting reversal;
- НЕ считает ledger impact;
- НЕ пытается компенсировать Payment/Refund в ledger.

E2E должен доказать, что chargeback/dispute actions оставляют ledger count неизменным.

---

# 10. COMMISSION BOUNDARY — ABSOLUTE HARD GATE

2.12C/2.12E не выполнены.

Поэтому:

- 0 Commission runtime;
- 0 CommissionAccrual;
- 0 commission reversal;
- 0 partner commission adjustment;
- 0 platform fee recomputation.

Chargeback/dispute foundation только фиксирует собственную финансовую/операционную истину.

---

# 11. SETTLEMENT / PAYOUT BOUNDARY

Не менять:

- Settlement;
- Payout;
- ProviderFee;
- payout status/lifecycle;
- settlement status/lifecycle.

Не создавать автоматические settlement/payout adjustments.

Если Roadmap future step требует это — зафиксировать DEFERRED.

---

# 12. PAYMENT OWNERSHIP BOUNDARY

Не расширять Payment state machine без явного требования canonical Step 2.13A.

В частности:

- не делать `Payment.status = CHARGEBACK`;
- не делать `Payment.status = DISPUTED`;
- не менять `paidAt`;
- не менять `captured amount`;
- не менять Payment immutable money facts;
- не активировать AUTHORIZED;
- не добавлять provider capture semantics.

Если нужен projection на Payment — сначала доказать, что Roadmap явно делает Payment owner этого projection. Иначе STOP.

Предпочтительно: Dispute/Chargeback — отдельный Finance-owned aggregate, Payment остаётся историческим captured fact.

---

# 13. REFUND INTERACTION — HARD GATE

Проанализировать существующий Refund Flow.

Нужно явно определить:

- можно ли открыть dispute при существующем partial refund;
- можно ли открыть dispute после full processed refund;
- какой amount считается disputable;
- может ли dispute amount превышать captured amount;
- учитываются ли REQUESTED/APPROVED/PROCESSED/FAILED Refund;
- допускается ли несколько disputes на Payment;
- как избежать двойного financial claim.

Не угадывать.

Если Roadmap не определяет amount interaction достаточно для безопасной мутации:
реализовать только тот foundation scope, который не требует выдумывать monetary netting.

Если даже создание foundation невозможно без такого решения:
`ARCHITECTURE DECISION REQUIRED`.

---

# 14. MONEY CONTRACT

Все monetary facts:

- `Prisma.Decimal`;
- canonical helper из существующего single money authority;
- никакого JS float;
- API decimal strings;
- DECIMAL precision/scale — в соответствии с существующим Finance/Payment/Refund contract;
- overflow guard;
- currency frozen verbatim из source Payment;
- никаких mutable Tax/FX/Catalog lookups.

Если aggregate хранит disputed amount:

`amount > 0`

и amount не может превышать доказанный допустимый source amount согласно canonical semantics.

---

# 15. IDENTIFIER

Если новый aggregate требует canonical ID:

- использовать `IdsService`;
- prefix взять из Roadmap/ids convention;
- если prefix не определён — выбрать только после проверки существующего naming convention и зафиксировать в `ids.md`;
- sequence generation в той же DB transaction, что create.

Не использовать random UUID как публичный canonical code, если Finance convention — `XXX-########`.

---

# 16. SCHEMA DESIGN

Schema должна быть минимальной.

Обязательные категории — только если соответствуют Roadmap:

- id;
- canonical code;
- source Payment ID;
- source Order ID snapshot, если нужен;
- amount/currency snapshot, если спор имеет amount;
- reason/category — только если canonical vocabulary определён;
- status — только если lifecycle определён;
- provenance;
- correlation/causation/actor;
- temporal facts;
- createdAt.

Не добавлять speculative:
- PSP payload JSON;
- bank account;
- card data;
- evidence blobs;
- arbitrary provider secrets;
- ledger account IDs;
- commission fields;
- settlement adjustment fields.

---

# 17. CARDINALITY / IDEMPOTENCY — HARD GATE

Определить фактическую cardinality из Roadmap.

Вопросы:

- один dispute на Payment?
- несколько dispute attempts?
- один active dispute?
- dispute amount slices?
- повторное открытие после terminal state?
- provider-neutral idempotency key?

Не копировать механически `(paymentId, amount)` из Refund.

Idempotency key должен отражать **business identity**, а не случайно запрещать будущие legit cases.

Если Roadmap не определяет identity:
выбрать минимальный foundation invariant, который можно аддитивно расширить later, и явно документировать future evolution.

Concurrent duplicate должен:
- создать максимум один канонический факт;
- вернуть controlled conflict/no-op согласно выбранному контракту;
- raw 500 = 0.

Divergent replay не должен молча возвращать существующий факт.

---

# 18. STATE MACHINE

Реализовать только lifecycle, прямо поддержанный Roadmap.

Для каждого transition определить:

- allowed from;
- resulting status;
- milestone;
- actor/permission;
- event;
- history/audit;
- idempotency behavior;
- terminal behavior.

Transitions должны быть CAS-based:
- id;
- current status;
- version/from guard.

No read-then-write race.

Если Roadmap не определяет lifecycle достаточно:
не изобретать большой state machine.

---

# 19. TEMPORAL CONTRACT

Milestones server-owned, UTC, first-only.

Нельзя позволять клиенту forge:
- openedAt/requestedAt;
- acceptedAt;
- wonAt/lostAt;
- resolvedAt;
- cancelledAt;
- любые другие temporal fields.

Использовать только exact canonical vocabulary Roadmap.

Milestone + status transition должны быть atomic в одной transaction/CAS operation.

Не использовать `updatedAt` как business date.

---

# 20. MASS ASSIGNMENT

Все server-owned поля должны быть forbidden.

Проверять **raw request body**, если ValidationPipe whitelist иначе silently strips forged keys.

Forged:
- code;
- paymentId override outside command contract;
- amount/currency if server-derived;
- status;
- milestones;
- actor;
- correlation/causation;
- createdAt/updatedAt/version;
- provider refs not allowed by command

→ controlled 422.

---

# 21. RBAC

Не придумывать broad access.

Сначала проверить existing `finance.*` permissions и canonical Roadmap.

Если Step 2.13A требует новые permissions, использовать granular naming, например только если соответствует conventions:

- `finance.dispute.read`
- `finance.dispute.write`
- `finance.dispute.resolve`

или canonical chargeback naming.

Не создавать оба набора.

Права:
- ADMIN — согласно существующей policy;
- FINANCE — operational authority;
- DIRECTOR/ANALYST/SALES_MANAGER — read только если согласуется с текущей Finance read matrix;
- BUYER/PARTNER/OPERATOR/etc. — не давать автоматически.

Проверить actual ROLE_PERMISSIONS, а не docs claims.

---

# 22. READ API

Если Roadmap foundation включает read API:

- list;
- detail;
- pagination;
- whitelist filters;
- controlled validation;
- 401 anonymous;
- 403 unauthorized;
- 404 non-visible/not-found согласно security convention.

Не добавлять search/filter fields без необходимости.

---

# 23. WRITE API

Если foundation предусматривает internal-only creation — публичный POST не добавлять.

Если Roadmap требует Finance command API — сделать минимальный command surface.

Не выставлять provider webhook endpoint.

PATCH/DELETE не добавлять для immutable facts.

Если lifecycle aggregate mutable только через commands/actions — использовать action endpoint pattern, а не arbitrary PATCH.

---

# 24. AUDIT / HISTORY

Каждая реальная command mutation должна иметь:

- domain history, если это pattern Payment/Refund;
- AuditLog;
- minimal metadata;
- no PII;
- no provider secret;
- no evidence body;
- correlation/causation/actor согласно ADR.

No audit/event on true no-op unless existing convention explicitly requires it.

---

# 25. EVENTS — HARD GATE

Не придумывать события ради архитектурной красоты.

Сначала проверить Roadmap.

Если foundation требует canonical events, они должны:

- отражать реально совершённый domain fact;
- быть PII-free;
- использовать transactional outbox;
- иметь canonical envelope;
- не обещать PSP completion;
- не обещать ledger posting;
- не обещать commission reversal.

Например, `DisputeOpened` может быть допустим только если canonical aggregate — Dispute и Roadmap требует event.

Не создавать `ChargebackReceivedFromProvider`, если provider integration отсутствует.

---

# 26. CROSS-DOMAIN PROJECTIONS

Не добавлять Order projection автоматически.

Если Step 2.13A требует отображение dispute state в Order:
- проверить, есть ли canonical Order field;
- projection должен быть Order-owned subscriber;
- Finance event → Order-owned write;
- inbox dedup;
- CAS;
- no direct Finance→Order mutation.

Если Roadmap этого не требует — 0 Order changes.

---

# 27. IMMUTABILITY

Определи, что является immutable financial fact, а что lifecycle aggregate.

Если aggregate lifecycle mutable:
- frozen source fields immutable;
- status/version/milestones меняются только state machine;
- source Payment/order/amount/currency никогда не переписываются.

Никаких arbitrary update/delete endpoints.

---

# 28. MIGRATION

Migration:

- Prisma migration only;
- additive;
- no `db push`;
- no destructive ALTER существующих approved Finance/Payment/Refund tables без доказанной необходимости;
- no fabricated backfill;
- legacy rows untouched.

После:
- `prisma migrate status`;
- live DB → schema diff;
- fresh replay через реальный e2e harness.

---

# 29. REQUIRED NEGATIVE E2E

Минимально доказать:

1. anonymous → 401;
2. unauthorized roles → 403;
3. forged server-owned fields → 422;
4. invalid/non-CAPTURED source Payment → controlled rejection;
5. invalid amount/currency manipulation → rejection;
6. invalid transition → 409/422 согласно convention;
7. terminal transition cannot be overwritten;
8. duplicate/replay behavior;
9. divergent replay → controlled conflict;
10. concurrent duplicate → one fact, no raw 500;
11. unauthorized detail → 404/403 according to convention;
12. no PSP/webhook side effects;
13. Ledger count unchanged;
14. ProviderFee/Settlement/Payout unchanged;
15. Commission/CommissionAccrual unchanged;
16. Payment immutable facts/status unchanged unless Roadmap explicitly requires otherwise;
17. Refund facts unchanged;
18. Order/Booking/Availability unchanged unless explicit projection is canonical;
19. no fabricated provider identity;
20. no premature 2.12A–G semantics.

---

# 30. REQUIRED POSITIVE E2E

Доказать canonical happy path:

- valid source;
- canonical ID;
- frozen source money facts;
- correct initial status;
- correct lifecycle if scope includes lifecycle;
- first-only milestones;
- history/audit;
- events if canonical;
- list/detail RBAC;
- idempotent identical retry if contract allows;
- concurrency correctness;
- legacy compatibility.

---

# 31. REFUND INTERACTION TESTS

Если canonical semantics определены, обязательно:

- no-refund Payment;
- partial processed refund;
- full processed refund;
- failed refund;
- active requested/approved refund;
- concurrent Refund/Dispute creation where relevant.

Если Roadmap намеренно defer-ит interaction:
тест должен доказать выбранную explicit restriction, а docs — объяснить deferred semantics.

---

# 32. PAYMENT CONCURRENCY TESTS

Проверить races, релевантные foundation:

- duplicate dispute creation;
- dispute creation vs Payment terminal mutation, если possible;
- dispute creation vs Refund creation/processing, если monetary invariant зависит от refund state.

No raw 500.

---

# 33. WRITE-PATH AUDIT — HARD GATE

После реализации repo-wide audit нового aggregate.

Нужно перечислить **каждый production writer**:

- create;
- update/CAS;
- subscriber;
- job;
- seed;
- raw SQL.

Не должно быть скрытых writers.

Cross-domain writers = 0.

---

# 34. 2.12A–2.12G BOUNDARY AUDIT — HARD GATE

После реализации доказать:

### 2.12A
0 PSP adapter/provider runtime.

### 2.12B
0 webhook/provider capture/authorization activation.

### 2.12C
0 Commission runtime.

### 2.12D
0 Payment/Refund/Dispute → Ledger posting.

### 2.12E
0 commission accrual/reversal mechanics.

### 2.12F
0 partial Payment implementation.

### 2.12G
0 ProviderFee feeType/granularity evolution unless Roadmap explicitly moved it into 2.13A (unlikely; if so STOP and explain conflict).

---

# 35. 2.14+ BOUNDARY AUDIT

Не начинать:

- settlement lifecycle;
- payout lifecycle;
- invoice;
- reconciliation engine;
- accounting engine;
- partner payable adjustments;
- bank rails.

---

# 36. DOCUMENTATION

Создать:

`docs/architecture/chargeback-dispute-foundation.md`

или exact canonical filename по выбранному aggregate vocabulary.

Документ должен описывать:

1. purpose;
2. canonical terminology;
3. ownership;
4. source authority;
5. provider-neutral boundary;
6. schema;
7. money snapshot;
8. cardinality;
9. idempotency;
10. state machine;
11. temporal contract;
12. concurrency;
13. RBAC;
14. API;
15. events;
16. audit/history;
17. Payment interaction;
18. Refund interaction;
19. Ledger boundary;
20. Commission boundary;
21. Settlement/Payout boundary;
22. cross-domain boundary;
23. migration;
24. legacy compatibility;
25. deferred PSP semantics;
26. future evolution;
27. invariants.

Update as applicable:
- `docs/contracts/api.md`;
- `docs/contracts/events.md`;
- `docs/contracts/ids.md`;
- Roadmap v3.

---

# 37. ROADMAP UPDATE

После успешной implementation:

Step 2.13A:

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

NEXT:

`PHASE 2 — STEP 2.13A — STRICT REVIEW`

Не ставить следующий implementation step до Strict Review.

Сохранить reconciliation prerequisites в Roadmap.

---

# 38. IMPLEMENTATION REPORT

Создать:

`docs/prompts/PHASE_2_STEP_2.13A_CHARGEBACK_DISPUTE_FOUNDATION_IMPLEMENTATION_REPORT.md`

Отчёт должен включать:

1. Verdict
2. Repository baseline
3. Sources inspected
4. Reconciliation constraints
5. Canonical terminology decision
6. Current → target reconciliation
7. Ownership
8. Source authority
9. Provider-neutral boundary
10. Schema/model
11. Migration
12. Money contract
13. Identifier
14. Cardinality
15. Idempotency
16. State machine
17. Temporal contract
18. Payment interaction
19. Refund interaction
20. Concurrency
21. RBAC
22. API
23. Events
24. Audit/history
25. Cross-domain projections
26. Ledger boundary
27. Commission boundary
28. ProviderFee/Settlement/Payout boundary
29. 2.12A boundary
30. 2.12B boundary
31. 2.12C boundary
32. 2.12D boundary
33. 2.12E boundary
34. 2.12F boundary
35. 2.12G boundary
36. 2.14+ boundary
37. Write-path audit
38. Negative tests
39. Positive tests
40. Race tests
41. Issues found during implementation
42. Backend regression
43. Frontend regression
44. DB regression
45. Fresh migration replay
46. Drift check
47. Files changed
48. Deferred items
49. Architecture decision status
50. Exact NEXT
51. Final conclusion

---

# 39. REQUIRED REGRESSION

At minimum run actual repository commands for:

### Backend
- TypeScript compile;
- production build;
- unit tests;
- targeted e2e:
  - chargeback/dispute;
  - payment;
  - refund;
  - finance foundation;
  - ledger;
  - settlement/provider-fee/payout;
  - order projections;
  - temporal readiness;
  - RBAC/event envelope as relevant;
- full serial e2e.

### Frontend
Even if untouched:
- tsc;
- Vitest;
- production build.

### DB
- migrate status;
- schema drift;
- fresh replay through harness.

Do not report tests not actually run.

---

# 40. ARCHITECTURE STOP CONDITIONS

Immediately STOP with:

`PHASE 2 STEP 2.13A BLOCKED — ARCHITECTURE DECISION REQUIRED`

if any of the following is true:

1. Roadmap does not clearly distinguish Dispute vs Chargeback semantics.
2. Foundation requires real PSP identity but 2.12A/B are not implemented.
3. Correct amount semantics require unresolved Refund/Chargeback netting policy.
4. Multiple disputes/partial disputes require undefined cardinality.
5. Correct lifecycle requires provider webhook semantics.
6. Implementation would require Payment state mutation not defined by Roadmap.
7. Implementation would require Ledger posting before 2.12D.
8. Implementation would require Commission reversal before 2.12C/E.
9. Implementation would require Settlement/Payout adjustment before their lifecycle step.
10. Existing schema has conflicting Chargeback/Dispute model.
11. Future PSP integration would require destructive rewrite of foundation identity.
12. Source authority cannot be defined without mutable/repriced data.
13. Cross-domain ownership would be violated.
14. Required idempotency identity cannot be defined safely.
15. Migration would require fabricated historical backfill.

Do not guess around a stop condition.

---

# 41. QUALITY RULE

Не стремись реализовать «полный chargeback».

Цель Step 2.13A — **минимальный, честный, provider-neutral foundation**, который не создаёт ложного ощущения, что PSP dispute processing, accounting reversals или settlement recovery уже работают.

Лучше оставить явно documented DEFERRED boundary, чем создать speculative semantics.

---

# 42. FINAL VERDICT

Если всё выполнено:

`PHASE 2 STEP 2.13A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Если нужен architecture decision:

`PHASE 2 STEP 2.13A BLOCKED — ARCHITECTURE DECISION REQUIRED`

Если обнаружен repository/baseline mismatch:

`PHASE 2 STEP 2.13A BLOCKED — REPOSITORY BASELINE MISMATCH`

---

# 43. HARD STOP

После:

- implementation;
- documentation;
- report;
- Roadmap status update;
- full regression;

**STOP.**

Не выполнять Strict Review в этом проходе.

Не начинать 2.12A–2.12G.

Не начинать следующий Finance step.
