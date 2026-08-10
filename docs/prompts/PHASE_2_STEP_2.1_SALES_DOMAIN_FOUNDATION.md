# PHASE 2 — STEP 2.1 — SALES DOMAIN FOUNDATION — IMPLEMENTATION PROMPT

## Роль

Ты работаешь как Principal Software Architect / Staff Backend Engineer проекта TravelHub.

Твоя задача — реализовать **PHASE 2 — STEP 2.1 — Sales Domain Foundation** строго в границах утверждённого `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`, действующих ADR, Phase 1 contracts и результатов:

- Phase 1 Exit Audit;
- Phase 1 Analytics Readiness Gate;
- Phase 2 Step 2.0 Entry Audit;
- Phase 2 Step 2.0 Strict Review.

Phase 2 entry уже APPROVED.

Но это **не разрешение реализовывать последующие шаги Phase 2 заранее**.

---

# 1. ROADMAP CONTRACT

Step 2.1 — **Sales Domain Foundation**.

Roadmap определяет фундамент Sales domain через canonical entities:

- `Lead` — canonical code `LED-*`;
- `Opportunity` — canonical code `OPP-*`;
- `Quote` — canonical code `QTE-*`;
- `Sale` — canonical code `SAL-*`.

На этом шаге необходимо определить и реализовать:

- ownership;
- canonical identity;
- минимальные lifecycle/state models;
- relations внутри Sales bounded context;
- temporal foundation;
- audit/history foundation;
- RBAC foundation;
- migration/schema foundation;
- service/domain invariants;
- test foundation.

Это **foundation**, а не Sales Center, не Quote flow, не Checkout и не Order creation.

---

# 2. ОБЯЗАТЕЛЬНАЯ ГРАНИЦА STEP 2.1

Step 2.1 НЕ должен реализовывать:

- Step 2.2 Sales Center Backend;
- queues;
- KPI;
- dashboard;
- advanced filtering/search;
- operational Sales Center UI;
- Step 2.3 Quote & Commercial Offer Flow;
- полноценное quote pricing;
- discounts;
- commercial price calculation;
- quote validity workflow;
- Step 2.3A authoritative Checkout Context;
- cart;
- checkout;
- authoritative price resolution;
- capacity reservation;
- availability locking;
- Step 2.4 Sale Completion → `OrderRequested`;
- Step 2.5 Order Creation Consumer;
- direct Sales → Order writes;
- Booking creation;
- Payment/PSP;
- Refund;
- Commission;
- Settlement;
- Payout;
- Finance;
- Documents;
- Subscription/Billing;
- Partner CRM;
- Support/Chat/Notifications;
- analytics dashboards.

Не создавать future functionality «для удобства».

---

# 3. КРИТИЧЕСКИЕ ВЫВОДЫ STEP 2.0

Считать обязательными constraints:

1. `BLOCKERS = 0`.
2. Step 2.1 разрешён.
3. Monetary contract НЕ обязан быть полностью решён в Step 2.1.
4. Capacity reservation/locking НЕ реализуется в Step 2.1.
5. Commercial snapshot policy становится обязательной позднее, к Step 2.5.
6. Automated Outbox retry/recovery должен быть решён до reliability-dependent flow Step 2.4/2.5, но НЕ реализуется автоматически сейчас.
7. Booking currency policy — future prerequisite Step 2.8.
8. Payment domain сейчас ABSENT.
9. `Order.paymentStatus/paidAmount` не являются Payment domain.
10. Storefront entitlement не является Subscription.
11. Existing Order/Booking — TRANSITIONAL foundations.
12. Supplier — FOUNDATION, Partner ≠ Supplier.

Не «закрывать» эти prerequisites раньше roadmap owner.

---

# 4. ПЕРЕД КОДОМ — ОБЯЗАТЕЛЬНЫЙ REPOSITORY AUDIT

Не доверять только отчётам.

Перед реализацией фактически проверить:

- `prisma/schema.prisma`;
- существующие schemas/modules;
- security/RBAC;
- eventbus;
- AuditLog;
- history patterns;
- canonical ID/code generation;
- request/correlation context;
- temporal conventions;
- CRM Customer;
- CRM Partner;
- Supplier;
- Product;
- existing Order/Booking foundations;
- migrations;
- ADR;
- contracts;
- Roadmap Steps 2.1–2.5.

Вернуть в отчёте `Current → Target mapping`.

---

# 5. BOUNDED CONTEXT OWNERSHIP

Определи Sales как отдельный bounded context согласно Roadmap.

Не превращать:

- CRM в owner Sale;
- Catalog в owner Sale;
- Order в owner Sale;
- Booking в owner Sale;
- Finance в owner Sale.

Sales должен владеть своими canonical entities.

Проверь существующую schema convention проекта и выбери schema/module placement, совместимый с текущей архитектурой.

Если Roadmap/ADR не позволяют однозначно определить owner/schema:

`ARCHITECTURE DECISION REQUIRED`

Не выбирать новую фундаментальную архитектуру молча.

---

# 6. SALES DOMAIN ENTITY MAP

Реализовать foundation для:

## Lead

Canonical code:

`LED-*`

Lead — ранняя sales сущность/интерес, но НЕ behavioral event.

Не считать автоматически Lead:

- Marketplace view;
- Product view;
- search;
- Storefront view;
- contact click.

Behavioral interaction ≠ Lead.

## Opportunity

Canonical code:

`OPP-*`

Opportunity представляет sales opportunity внутри Sales domain.

Не считать Opportunity:

- Order;
- Booking;
- Quote;
- Product.

## Quote

Canonical code:

`QTE-*`

На Step 2.1 — только domain foundation.

Полноценный commercial offer flow принадлежит Step 2.3.

## Sale

Canonical code:

`SAL-*`

Sale — Sales-domain entity.

Sale ≠ Order.

Sale completion и `OrderRequested` принадлежат Step 2.4.

На Step 2.1 НЕ публиковать `OrderRequested`.

---

# 7. CANONICAL IDENTITY

Для каждой entity нужны:

- internal canonical `id`;
- human-readable canonical `code`;
- deterministic/atomic code generation pattern, совместимый с существующей архитектурой.

Проверить существующие patterns:

- Product codes;
- Customer codes;
- Supplier codes;
- Communication codes;
- Order codes;
- Booking codes.

Не использовать `count()+1`.

Code generation должен выдерживать concurrency.

Обязательные prefixes:

- `LED-`;
- `OPP-`;
- `QTE-`;
- `SAL-`.

Точный numeric/string format должен следовать существующей canonical code convention проекта.

---

# 8. SALES RELATIONSHIP MODEL

Определи минимальные связи между:

`Lead → Opportunity → Quote → Sale`

Но не выдумывай обязательную линейность, если Roadmap её не требует.

Проверь, должны ли связи быть:

- nullable;
- optional;
- one-to-many;
- historical references.

Не создавать giant aggregate.

Каждая entity должна сохранять собственную identity.

Не использовать lifecycle одного объекта как surrogate lifecycle другого.

---

# 9. CUSTOMER IDENTITY

Sales должен использовать canonical Customer identity:

`security.User.customerId → crm.Customer.id`

Но Sales НЕ должен писать в CRM Customer таблицы напрямую.

Разрешены canonical references/read-by-ID в рамках действующих ADR.

Проверить:

- customer reference;
- nullable semantics для раннего Lead, если Roadmap это допускает;
- object scope;
- no forged authority.

Не создавать параллельную SalesCustomer entity без необходимости.

Если Lead без Customer требует отдельной prospect identity и Roadmap не определяет её:

`ARCHITECTURE DECISION REQUIRED`

---

# 10. PARTNER / SUPPLIER BOUNDARY

Не смешивать:

`Partner != Supplier`

Определи, нужны ли эти references уже в foundation.

Не добавлять relation «на будущее» без реального Step 2.1 invariant.

Если Sales ownership требует commercial Partner identity, использовать canonical `crm.Partner.id`.

Supplier lifecycle остаётся prerequisite будущего Booking flow.

---

# 11. PRODUCT BOUNDARY

Product принадлежит Catalog.

Sales не должен менять Catalog Product.

Если foundation требует product reference:

- только canonical ID/reference;
- никаких cross-context writes;
- никаких копий mutable Product без необходимости.

Полный Product/Tariff commercial snapshot принадлежит последующим шагам.

---

# 12. LIFECYCLE DESIGN

Для каждой entity определить минимальный lifecycle, необходимый именно для foundation.

Не переносить автоматически статусы из UI/legacy.

Для каждого status:

- semantic meaning;
- allowed transitions;
- terminal/non-terminal;
- actor permissions;
- timestamps;
- history requirements.

Lifecycle должен быть минимальным.

Не создавать future states для:

- checkout;
- payment;
- booking;
- fulfillment;
- settlement.

Если Roadmap не определяет достаточно семантики конкретного lifecycle и выбор повлияет на будущий commercial process:

`ARCHITECTURE DECISION REQUIRED`

---

# 13. SALE SEMANTICS

Особенно строго:

`Sale != Order`

На Step 2.1 Sale не должен:

- создавать Order;
- создавать Booking;
- менять inventory;
- резервировать Availability;
- создавать Payment;
- означать paid;
- означать fulfilled.

Если Sale имеет foundation status, он не должен скрыто означать `OrderRequested`.

Step 2.4 остаётся единственной границей Sale completion → canonical `OrderRequested`.

---

# 14. QUOTE SEMANTICS

Quote foundation не должен превращаться в Step 2.3.

Не реализовывать сейчас:

- authoritative Product/Tariff snapshot;
- discount engine;
- tax engine;
- promo engine;
- quote acceptance commercial workflow;
- expiration scheduler;
- PDF;
- email sending;
- traveler composition;
- checkout conversion.

Если минимальный status нужен для entity integrity — реализовать только доказуемый минимум.

---

# 15. LEAD SEMANTICS

Lead не должен автоматически создаваться из behavioral telemetry.

Запрещено связывать:

`MarketplaceBehavioralEvent → Lead`

или

`StorefrontBehavioralEvent → Lead`

как автоматический consumer на Step 2.1.

Contact click — intent signal, не canonical Lead.

---

# 16. OPPORTUNITY SEMANTICS

Opportunity не является Order pre-state.

Не создавать Order-related statuses.

Opportunity lifecycle должен оставаться внутри Sales domain.

---

# 17. TEMPORAL FOUNDATION

Следовать Step 1.13A:

`entity time != lifecycle time != event time != processing time`

Минимум для каждой entity:

- `createdAt`;
- `updatedAt`.

Для реальных lifecycle milestones использовать dedicated nullable timestamps только если соответствующий transition действительно вводится Step 2.1.

Не использовать `updatedAt` как:

- convertedAt;
- wonAt;
- lostAt;
- acceptedAt;
- completedAt.

Не backfill'ить guessed historical values.

Новых legacy rows быть не должно, если таблицы новые.

---

# 18. ACTOR / AUDIT FOUNDATION

Определи actor semantics для Sales mutations.

Следовать существующим conventions:

- authenticated actor;
- SYSTEM только для реальных system actions;
- actor не принимается authoritative из body.

Critical mutations должны иметь reconstructable history/audit.

Не превращать AuditLog в canonical business history, если entity lifecycle требует domain history.

---

# 19. HISTORY MODEL

Проверь существующие patterns:

- ProductHistory;
- OrderHistory;
- BookingHistory;
- CustomerHistory;
- PartnerApplicationHistory.

Определи минимальный Sales history contract.

Предпочтительно обеспечить возможность восстановить:

- entity creation;
- status transition;
- key lifecycle mutation.

Не хранить sensitive snapshot целиком без необходимости.

Если одна общая SalesHistory создаёт неясную ownership/aggregate semantics — используй pattern, соответствующий repository conventions.

---

# 20. EVENT FOUNDATION

Step 2.1 НЕ должен создавать future events без consumers/business need.

Не публиковать:

- `OrderRequested`;
- Booking events;
- Payment events.

Если entity creation/status events действительно необходимы по Roadmap/существующей event convention, они должны:

- иметь canonical name;
- minimal payload;
- canonical aggregateId;
- actor metadata;
- correlationId;
- causationId;
- Outbox atomicity.

Но не вводить speculative event catalog.

`ARCHITECTURE DECISION REQUIRED`, если event semantics не определены и влияют на следующие steps.

---

# 21. CORRELATION / CAUSATION

Все новые Outbox events, если они появляются, обязаны использовать существующий request context.

Не принимать из body:

- requestId;
- correlationId;
- causationId.

Root HTTP operation:

- server-authoritative correlation.

Child event:

- inherited correlation;
- causation = immediate parent event.

Не использовать:

- Sale code;
- Quote code;
- Customer code

как correlationId.

---

# 22. OUTBOX RELIABILITY BOUNDARY

Не реализовывать автоматический retry/recovery просто потому, что Step 2.0 нашёл debt.

Но новый Sales foundation не должен ухудшать Outbox.

Зафиксировать в отчёте:

> reliability prerequisite остаётся обязательным до Step 2.4/2.5.

Если Step 2.1 implementation неожиданно создаёт reliability-dependent consumer chain, STOP:

`ARCHITECTURE DECISION REQUIRED`

или пересмотреть scope — такой chain, вероятно, преждевременен.

---

# 23. MONEY BOUNDARY

Step 2.1 не должен финализировать monetary contract Step 2.3A/2.4.

Если Quote/Sale schema foundation требует money fields, сначала доказать их необходимость именно сейчас.

Все canonical money:

- Decimal;
- explicit currency;
- no JS binary-float arithmetic;
- no guessed rounding.

Не копировать legacy `bootstrapOrder` JS-float pattern.

Если foundation может существовать без monetary fields до Step 2.3 — не добавлять их speculative.

---

# 24. CURRENCY

Любое monetary value обязано иметь однозначную currency semantics.

Не использовать implicit global currency.

Не наследовать currency молча из Product/Order.

Если Quote/Sale money пока не нужен — отложить до owner Step 2.3.

---

# 25. AVAILABILITY / CAPACITY

НЕ реализовывать:

- hold;
- reservation;
- capacity decrement;
- slotsReserved update;
- expiration;
- overbooking protection.

Это prerequisite checkout boundary Step 2.3A/2.4.

Sales foundation не должен мутировать Availability.

---

# 26. COMMERCIAL SNAPSHOT

Не реализовывать полный transaction snapshot.

Step 2.0 установил deadline: Step 2.5.

Quote snapshot semantics принадлежат Step 2.3.

На Step 2.1 допустимы только references, необходимые для domain foundation.

---

# 27. PAYMENT ABSENCE

После Step 2.1 должно оставаться правдой:

- Payment entity отсутствует;
- PaymentIntent отсутствует;
- Charge отсутствует;
- Refund отсутствует;
- Ledger отсутствует;
- Commission отсутствует;
- Settlement/Payout отсутствуют.

Не использовать Sale status как payment state.

---

# 28. SUBSCRIPTION ABSENCE

Не трогать:

- Storefront entitlement;
- trial;
- plans;
- recurring billing;
- grace period;
- cancellation.

`entitlement != Subscription`.

---

# 29. RBAC FOUNDATION

Определи минимальные permissions Sales domain.

Не выдавать broad `sales.*` автоматически всем ролям.

Проверить существующие dormant permissions из Step 2.0.

Если они уже существуют:

- переиспользовать только если semantic contract совпадает;
- не дублировать;
- не считать наличие permission доказательством существующего endpoint/domain.

Минимально определить, какие роли имеют право:

- create/read/update Lead;
- create/read/update Opportunity;
- create/read/update Quote foundation;
- create/read/update Sale foundation;
- transition lifecycle.

Не выдавать BUYER/PARTNER internal Sales permissions без Roadmap основания.

ADMIN/DIRECTOR semantics должны следовать текущей RBAC architecture.

---

# 30. OBJECT SCOPE

Sales internal API не должен позволять forged ownership через:

- `customerId`;
- `partnerId`;
- `supplierId`;
- `ownerId`;
- `assignedTo`;
- actor fields.

Разделить:

- legitimate business reference selection;
- authorization authority.

Например, internal Sales Manager может выбрать Customer как subject сделки, но body customerId не должен давать caller новые permissions на CRM object.

Все referenced IDs валидировать server-side.

---

# 31. MASS ASSIGNMENT

DTO whitelist обязателен.

Server-owned поля должны быть запрещены/игнорироваться согласно существующему contract:

- id;
- code;
- status, если status меняется отдельной command;
- createdAt;
- updatedAt;
- lifecycle timestamps;
- actor;
- history;
- requestId;
- correlationId;
- causationId;
- version;
- internal audit fields.

Использовать общий production-equivalent ValidationPipe.

---

# 32. API SURFACE

Step 2.1 — foundation.

Не строить полный Step 2.2 Sales Center Backend.

Разрешён только минимальный API, необходимый для проверки и использования foundation, если Roadmap/архитектура этого требует.

Не реализовывать:

- KPI;
- dashboard aggregates;
- queues;
- advanced filters;
- bulk actions;
- reporting;
- export.

Если можно доказать foundation через service/e2e без premature operational API — предпочесть минимальный surface.

---

# 33. PAGINATION

Если Step 2.1 вводит list endpoints, использовать canonical pagination convention проекта.

Не добавлять unbounded list.

Но не строить Step 2.2 filtering engine.

---

# 34. ERROR MODEL

Все endpoints должны использовать canonical API error contract:

- statusCode;
- message;
- requestId;
- `X-Request-Id`.

Не раскрывать:

- stack;
- SQL;
- internal IDs сверх contract;
- existence чужого object, если применяется neutral semantics.

---

# 35. PRIVACY

Sales domain потенциально PII-sensitive.

Не копировать в Lead/Opportunity/Quote/Sale без необходимости:

- email;
- phone;
- traveler/passenger data;
- CRM notes;
- legal/tax fields.

Предпочитать canonical Customer reference.

Если ранний Lead требует контактных данных, а canonical prospect model отсутствует — это архитектурный вопрос, а не повод бесконтрольно добавить PII:

`ARCHITECTURE DECISION REQUIRED`

---

# 36. CROSS-CONTEXT WRITE RULE

Следовать ADR-0001 и действующим amendments.

Sales не пишет напрямую в:

- Catalog;
- CRM;
- Order;
- Booking;
- Finance;
- Security.

Допустимы только разрешённые references/read-by-ID/event boundaries.

Особенно:

**никакого direct Sales → Order table write.**

---

# 37. MIGRATION

Все schema changes:

- только Prisma migration;
- additive where possible;
- deterministic;
- clean replay;
- no `db push`;
- applied migrations не редактировать.

Новая Sales schema/model migration должна корректно применяться:

1. на текущую dev schema;
2. на clean DB replay.

---

# 38. DATABASE INTEGRITY

Добавить необходимые:

- unique canonical code constraints;
- indexes;
- relation indexes;
- status indexes только если реально нужны;
- timestamps.

Не добавлять speculative indexes без query contract.

Проверить concurrency canonical code generation.

---

# 39. NO CROSS-SCHEMA FK IF ADR FORBIDS IT

Если действующая архитектура использует cross-context IDs без DB FK — соблюдать её.

Не добавлять cross-schema FK только потому, что Prisma позволяет.

Read-by-ID validation должна следовать existing pattern.

---

# 40. CONCURRENCY

Обязательные race tests для canonical codes.

Минимум:

- параллельное создание 20+ Lead → уникальные `LED-*`;
- параллельное создание 20+ Opportunity → уникальные `OPP-*`;
- Quote → `QTE-*`;
- Sale → `SAL-*`.

Если код генерируется общей sequence infrastructure, проверить все prefixes.

Не использовать retry loop, скрывающий broken uniqueness design, без необходимости.

---

# 41. LIFECYCLE CONCURRENCY

Если вводятся status transition commands:

- concurrent duplicate transition;
- retry;
- terminal state protection;
- history duplication.

Должно быть deterministic.

Не допускать double lifecycle milestone.

---

# 42. IDEMPOTENCY

Не путать:

- DB uniqueness;
- HTTP idempotency;
- Inbox dedup;
- Outbox dedup.

Explicit checkout/payment Idempotency-Key — future prerequisite.

Не внедрять global idempotency framework в 2.1 без Roadmap основания.

---

# 43. FRONTEND

Step 2.1 не должен реализовывать Sales Center UI.

Если frontend не требуется — не менять frontend production code.

Но полный frontend regression всё равно обязателен.

---

# 44. LOCALIZATION

Если Step 2.1 не создаёт UI — новые RU/AZ/EN строки не нужны.

Не реализовывать multilingual user-generated content.

AI translation остаётся deferred.

---

# 45. BEHAVIORAL ISOLATION

Обязательный regression proof:

создание/просмотр Marketplace/Storefront behavioral events не создаёт:

- Lead;
- Opportunity;
- Quote;
- Sale.

Behavioral storage остаётся telemetry foundation.

---

# 46. ORDER/BOOKING ISOLATION

Обязательный regression proof:

создание Sales foundation entity не должно автоматически создавать:

- Order;
- Booking.

Sale на Step 2.1 ≠ Order.

---

# 47. AUDITLOG SEPARATION

Если domain history вводится, AuditLog не заменяет её.

AuditLog остаётся security/administrative reference.

Behavioral events не должны попадать в Sales history.

---

# 48. REQUIRED SECURITY TEST MATRIX

Минимум:

### anonymous

- Sales internal endpoints → 401.

### BUYER

- internal Sales endpoints → 403.

### PARTNER

- internal Sales endpoints → 403, если Roadmap не дал partner sales access.

### MODERATOR

- не получает Sales mutation автоматически.

### unauthorized internal roles

- permissions проверяются.

### forged fields

- id;
- code;
- status;
- timestamps;
- actor;
- correlation;
- causation;
- history;
- server-owned ownership fields

→ rejected согласно canonical validation contract.

---

# 49. REQUIRED DOMAIN TESTS

Покрыть минимум:

1. Lead create;
2. Opportunity create;
3. Quote foundation create;
4. Sale foundation create;
5. canonical prefixes;
6. unique codes;
7. valid relations;
8. invalid referenced entity;
9. forbidden cross-context mutation;
10. lifecycle transition rules, если введены;
11. history/audit;
12. temporal fields;
13. no Order creation;
14. no Booking creation;
15. no Payment creation;
16. behavioral isolation.

---

# 50. REQUIRED CONCURRENCY TESTS

Проверить минимум 20 parallel creates для canonical code generation.

Итог:

- no duplicate codes;
- no P2002 surfaced to caller;
- correct number of rows;
- no skipped/corrupted identity semantics, если project convention требует contiguous sequence — не предполагать contiguous без contract.

---

# 51. REQUIRED EVENT TESTS

Если Step 2.1 вводит события:

- event emitted atomically;
- payload whitelist;
- no PII;
- actor correct;
- correlation correct;
- causation correct;
- retry не дублирует logical effect.

Если события НЕ нужны — явно написать почему и не создавать их ради теста.

---

# 52. TEMPORAL TESTS

Для каждой новой entity:

- createdAt реальный;
- updatedAt меняется только при mutation;
- lifecycle timestamps null до milestone;
- transition timestamp ставится при transition;
- retry не переписывает milestone;
- no fake backfill.

---

# 53. MIGRATION TESTS

Обязательно:

- `prisma migrate status`;
- clean replay;
- drift check;
- test DB fresh migration.

Никаких manual schema changes.

---

# 54. UNIT TESTS

Добавить unit tests для новых pure/domain invariants, если они существуют:

- code/prefix helpers;
- lifecycle transition guards;
- DTO/domain validators;
- relation rules.

Не создавать unit tests ради количества.

---

# 55. E2E TEST FILE

Создать отдельный:

`backend/test/sales-domain-foundation.e2e-spec.ts`

или эквивалентное canonical имя проекта.

Тест должен быть foundation-focused, а не Step 2.2/2.3 simulation.

---

# 56. FULL REGRESSION

Обязательно выполнить:

## Backend

- `npx tsc --noEmit`;
- unit tests;
- новый Sales e2e отдельно;
- полный serial e2e.

## Frontend

- `npx tsc --noEmit`;
- `vitest run`;
- production `next build`.

## DB

- migrate status;
- clean replay;
- drift.

Skipped/timeouts перечислить явно.

---

# 57. RUNTIME VERIFICATION

На isolated instance проверить representative flow:

- anonymous Sales endpoint → 401;
- authorized internal create Lead;
- canonical `LED-*`;
- create Opportunity;
- create Quote foundation;
- create Sale foundation;
- no Order/Booking side effect;
- requestId/error contract.

Не оставлять smoke-data в dev DB.

Предпочитать isolated/test DB.

---

# 58. DOCUMENTATION

Обновить/создать документацию только по фактически реализованному Step 2.1.

Минимум документировать:

- Sales bounded-context ownership;
- entity map;
- canonical IDs;
- lifecycle;
- references;
- history;
- RBAC;
- cross-context boundaries;
- explicit non-goals;
- prerequisites оставшиеся к 2.3A/2.4/2.5.

Не документировать future implementation как current.

---

# 59. ROADMAP PREREQUISITES — НЕ ПОТЕРЯТЬ

В финальном отчёте отдельным разделом повторить оставшиеся Step 2.0 prerequisites:

1. Outbox automated retry/recovery — до Step 2.4/2.5.
2. Booking currency/amount policy — до Step 2.8.
3. Monetary contract — до Step 2.3A/2.4.
4. Tariff/Availability reservation & locking — до Step 2.3A/2.4.
5. Commercial snapshot policy — до Step 2.5.
6. `/orders/bootstrap` removal — Step 2.6.
7. Payment/PSP/ledger — Step 2.10C/2.12.
8. Supplier lifecycle/validation — Step 2.8.
9. Payment/checkout idempotency keys — Step 2.10.

Не помечать их выполненными, если Step 2.1 их не реализует.

---

# 60. ROADMAP SEQUENCING NOTICE

Сохранить зафиксированную проблему:

Step 2.17 расположен позже reliability-dependent Step 2.4/2.5.

Step 2.1 НЕ переносит Step 2.17 самостоятельно.

Но перед Step 2.4 roadmap-owner должен определить, как reliability capability будет реализована раньше.

Не забыть этот gate в последующих отчётах.

---

# 61. DEFERRED DECISIONS

Не реализовывать:

- multilingual partner content;
- AI translation;
- Storefront trial;
- plans/pricing;
- recurring billing;
- grace period;
- cancellation;
- subscription;
- custom domains;
- commission rates;
- Partner CRM entitlements;
- retention;
- capability matrix;
- transaction economics, если они ещё deferred.

---

# 62. ARCHITECTURE DECISION REQUIRED CONDITIONS

Остановиться, если обнаружено:

1. Lead требует новой Prospect/Contact identity, не определённой Roadmap.
2. Sales owner/schema конфликтует с ADR.
3. Partner/Supplier semantics неоднозначны для Step 2.1.
4. Sale lifecycle невозможно определить без Step 2.4 semantics.
5. Quote foundation требует преждевременного monetary contract.
6. Нужно прямое cross-context write.
7. Нужно создать Order из Sale уже сейчас.
8. Нужно считать behavioral event Lead.
9. Нужна Payment/Subscription semantics.
10. Roadmap и фактическая архитектура фундаментально расходятся.

В этом случае не импровизировать.

---

# 63. НЕ СЧИТАТЬ REPORT ДОКАЗАТЕЛЬСТВОМ

Финальный implementation report должен опираться на:

- фактический code diff;
- schema;
- migration SQL;
- tests;
- runtime;
- repository search;
- docs reconciliation.

Не писать PASS только потому, что prompt ожидал PASS.

---

# 64. ОБЯЗАТЕЛЬНЫЙ ФОРМАТ ОТЧЁТА

Вернуть:

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target mapping
5. Sales bounded-context ownership
6. Entity model
7. Lead foundation
8. Opportunity foundation
9. Quote foundation
10. Sale foundation
11. Canonical ID/code strategy
12. Relationship model
13. Customer boundary
14. Partner/Supplier boundary
15. Product boundary
16. Lifecycle model
17. Temporal semantics
18. Actor semantics
19. History/audit
20. Events
21. Correlation/causation
22. Outbox boundary
23. Money/currency boundary
24. Availability/capacity boundary
25. Commercial snapshot boundary
26. Payment/Subscription absence
27. RBAC
28. Object scope/IDOR
29. DTO/mass-assignment
30. API surface
31. Privacy
32. Cross-context write proof
33. Behavioral isolation
34. Order/Booking isolation
35. Concurrency results
36. Idempotency
37. Migration
38. Unit tests
39. E2E tests
40. Full regression
41. Frontend regression
42. Runtime verification
43. Documentation changes
44. Remaining Step 2.0 prerequisites
45. Roadmap sequencing notice
46. Deferred Decisions compliance
47. Issues found/fixed
48. Architecture decision status
49. Out-of-scope confirmation
50. Files changed

---

# 65. FINAL VERDICT

Использовать одну строку.

Если implementation выполнен и готов к review:

`PHASE 2 STEP 2.1 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Если найден фундаментальный архитектурный вопрос:

`ARCHITECTURE DECISION REQUIRED`

Если Step 2.1 заблокирован подтверждённым foundation gap:

`PHASE 2 STEP 2.1 BLOCKED — FOUNDATION GAP`

---

# 66. STOP CONDITION

После Step 2.1:

**НЕ начинать Step 2.2.**

Не выполнять Strict Review самостоятельно в том же проходе.

Остановиться после implementation report и ждать отдельного review prompt.
