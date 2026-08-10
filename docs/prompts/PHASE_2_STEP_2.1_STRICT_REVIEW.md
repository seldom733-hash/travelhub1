# PHASE 2 — STEP 2.1 — SALES DOMAIN FOUNDATION — STRICT REVIEW PROMPT

## Роль

Ты работаешь как независимый Principal Software Architect / Staff Backend Engineer / Security Reviewer проекта TravelHub.

Твоя задача — выполнить **STRICT REVIEW фактической реализации PHASE 2 — STEP 2.1 — Sales Domain Foundation**.

Implementation report НЕ является доказательством. Не подтверждай его утверждения без проверки репозитория.

Нужно независимо проверить:

- фактический код;
- Prisma schema;
- migration SQL;
- Sales module;
- DTO/validation;
- RBAC;
- object scope;
- lifecycle;
- history/audit;
- canonical ID generation;
- concurrency;
- temporal semantics;
- cross-context boundaries;
- отсутствие преждевременной реализации следующих шагов;
- tests;
- runtime;
- docs;
- migration replay/drift.

---

# 1. REVIEW BASELINE

Заявленный implementation:

- отдельный `sales` bounded context;
- `Lead` — `LED-*`;
- `Opportunity` — `OPP-*`;
- `Quote` — `QTE-*`;
- `Sale` — `SAL-*`;
- 4 lifecycle models;
- 4 history models;
- `BusinessSequence` для codes;
- minimal `/api/v1/sales/*`;
- RBAC;
- без новых domain events;
- без money;
- без Order/Booking side effects;
- без frontend implementation.

Проверить всё независимо.

---

# 2. ROADMAP SCOPE

Сначала сверить Step 2.1 с `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`.

Подтвердить, что реализация действительно относится только к:

`PHASE 2 — STEP 2.1 — Sales Domain Foundation`

и НЕ начала:

- 2.2 Sales Center Backend;
- 2.3 Quote & Commercial Offer Flow;
- 2.3A Checkout Context;
- 2.4 Sale Completion → OrderRequested;
- 2.5 Order Creation Consumer;
- 2.6 legacy Order cleanup;
- Booking;
- Finance/Payment;
- Subscription;
- Partner CRM;
- analytics dashboards.

Любое premature implementation классифицировать как finding.

---

# 3. REPOSITORY BASELINE

Проверить:

- branch/commit;
- `git status`;
- pre-existing dirty/untracked files;
- actual Step 2.1 diff;
- нет ли скрытых изменений вне заявленного списка.

Не изменять unrelated user files.

---

# 4. SALES OWNERSHIP

Проверить, что Sales действительно отдельный bounded context.

Доказать:

- Sales владеет Lead;
- Sales владеет Opportunity;
- Sales владеет Quote;
- Sales владеет Sale;
- CRM не стал owner Sale;
- Catalog не стал owner Quote/Sale;
- Order не стал owner Sale;
- Booking/Finance не получили cross-write ownership.

Сверить с ADR-0001 и amendments.

---

# 5. PRISMA SCHEMA REVIEW

Проверить все новые Sales enums/models непосредственно в `schema.prisma`.

Для каждой entity проверить:

- `id`;
- `code`;
- status;
- `version`, если используется CAS;
- `createdAt`;
- `updatedAt`;
- lifecycle timestamps;
- actor fields;
- references;
- indexes;
- uniqueness;
- history relation.

Особенно проверить заявленные **4 enum + 8 models**.

Не считать количество из отчёта доказательством.

---

# 6. MIGRATION SQL

Прочитать фактический migration SQL.

Проверить:

- создание schema `sales`, если требуется;
- enums;
- tables;
- unique constraints;
- indexes;
- nullable/non-null semantics;
- defaults;
- timestamp types;
- отсутствие guessed backfill;
- отсутствие destructive операций;
- отсутствие cross-context FK, если ADR их запрещает;
- migration соответствует Prisma schema.

Applied migration нельзя исправлять задним числом.

Если migration уже применена и содержит дефект — зафиксировать правильный migration-forward fix.

---

# 7. CANONICAL ID STRATEGY

Проверить реальную реализацию:

- `LED-*`;
- `OPP-*`;
- `QTE-*`;
- `SAL-*`.

Подтвердить использование canonical `IdsService.nextCode` / `BusinessSequence`.

Проверить, что нигде нет:

- `count()+1`;
- max(code)+1;
- random collision-prone workaround;
- process-local counter.

Проверить формат на соответствие `docs/contracts/ids.md`.

---

# 8. CODE CONCURRENCY

Не ограничиваться чтением теста.

Проверить механизм атомарности `BusinessSequence`.

Запустить/проверить concurrency:

- ≥20 Lead creates;
- ≥20 Opportunity creates;
- ≥20 Quote creates;
- ≥20 Sale creates.

Подтвердить:

- unique codes;
- correct prefixes;
- correct row count;
- no P2002 leaked;
- no duplicate identity;
- no cross-prefix sequence corruption.

---

# 9. LEAD SEMANTICS

Проверить фактическую модель Lead.

Заявлено:

`NEW → QUALIFIED | DISQUALIFIED`

Проверить:

- зачем именно эти states;
- соответствуют ли Roadmap foundation;
- allowed transitions;
- terminal semantics;
- retry semantics;
- actor;
- timestamps/history.

Критически проверить, не превращён ли Lead в скрытую CRM Contact/Prospect entity.

Если Lead хранит `name`, определить:

- что именно означает `name`;
- является ли это PII;
- действительно ли это минимально необходимо;
- не появился ли новый prospect identity contract без ADR.

Это отдельная review-точка.

---

# 10. BEHAVIORAL ≠ LEAD

Repo-wide проверить отсутствие автоматической цепочки:

- MarketplaceBehavioralEvent → Lead;
- StorefrontBehavioralEvent → Lead;
- contact click → Lead;
- search → Lead;
- product view → Lead.

Проверить не только Sales module, но и behavioral producers/consumers/eventbus.

Behavioral signal не должен стать canonical Lead в Step 2.1.

---

# 11. OPPORTUNITY SEMANTICS

Заявлено:

`NEW → OPEN → WON | LOST`

Проверить фактический transition graph.

Особенно:

- разрешён ли NEW→WON напрямую;
- OPEN→NEW;
- terminal→anything;
- duplicate transition;
- concurrency;
- timestamps;
- history.

Opportunity не должен быть Order pre-state.

---

# 12. QUOTE SEMANTICS

Заявлено:

`DRAFT → ISSUED`

Проверить, не реализован ли скрыто Step 2.3.

Не должно быть полноценного:

- pricing;
- discount;
- taxes;
- quote acceptance;
- expiration scheduler;
- PDF;
- sending;
- traveler data;
- checkout conversion;
- commercial snapshot.

Проверить, достаточно ли foundation model без money.

---

# 13. SALE SEMANTICS — КРИТИЧЕСКАЯ ПРОВЕРКА

Заявлено:

`OPEN → CLOSED`

Это нужно проверить особенно строго.

Ответить:

1. Что означает `CLOSED`?
2. Не конфликтует ли `CLOSED` с будущим Step 2.4 `Sale completion → OrderRequested`?
3. Можно ли уже сейчас закрыть Sale без `OrderRequested`?
4. Если да — не создаёт ли это lifecycle state, который позже будет невозможно однозначно интерпретировать?
5. Является ли `CLOSED` terminal?
6. Чем `CLOSED` отличается от future completed/won/cancelled semantics?
7. Не дублирует ли Sale lifecycle Opportunity WON/LOST?

Если смысл `CLOSED` нельзя доказать из Roadmap/ADR, это потенциальный **architecture finding**, а не автоматически PASS.

Не разрешать отчёту реализации самостоятельно определить future Sale semantics.

---

# 14. SALE ≠ ORDER

Проверить кодом и БД:

- Sale create не создаёт Order;
- Sale transition не создаёт Order;
- Sale transition не публикует `OrderRequested`;
- Sale не пишет в Order table;
- Sale не пишет в Booking;
- Sale не резервирует Availability.

Repo-wide search обязателен.

---

# 15. RELATIONSHIP MODEL

Заявлено:

`Lead → Opportunity → Quote → Sale` optional.

Проверить реальные cardinalities.

Особенно проверить:

- Lead→Opportunity;
- Opportunity→Quote;
- Quote→Sale;
- unique constraints;
- nullable refs;
- back-relations.

Отдельно проверить заявленный `unique Sale.quoteId`.

Задать вопрос: действительно ли business contract требует **не более одной Sale на Quote** уже в Step 2.1?

Если это future commercial decision, unique constraint может преждевременно зафиксировать semantics.

Не считать его правильным только потому, что Prisma требовал relation fix.

---

# 16. CROSS-CONTEXT REFERENCES

Проверить:

- Customer reference;
- Product reference;
- отсутствие Partner/Supplier refs.

Для Customer/Product:

- нет cross-schema FK, если запрещено ADR;
- есть server-side existence validation;
- validation не создаёт authority;
- нет cross-context write.

Проверить race semantics: referenced Customer/Product может измениться/исчезнуть после validation — определить, приемлемо ли это в текущей архитектуре.

---

# 17. CUSTOMER / PROSPECT BOUNDARY

Критически проверить утверждение:

> Lead — только name; контакты не дублируются.

Если Lead может существовать без `customerId`, то `name` фактически может представлять неизвестного CRM Customer prospect.

Проверить, не возникла ли новая identity:

`Lead.name` → prospect identity

без определённого contract.

Если это просто display label — должно быть явно документировано и безопасно.

Если это фактически canonical prospect — может потребоваться:

`ARCHITECTURE DECISION REQUIRED`

Не создавать ложный blocker, если Roadmap прямо разрешает lightweight Lead name — сначала сверить Roadmap.

---

# 18. PRODUCT REFERENCE

Заявлено `Quote.productId`.

Проверить:

- почему Product ref находится именно в Quote;
- может ли Quote иметь только один Product;
- не фиксирует ли это преждевременно Step 2.3 commercial model;
- что будет с multi-item quote.

Если Roadmap предполагает future Quote items/commercial offer, single `Quote.productId` может быть premature cardinality decision.

Это обязательная strict-review точка.

---

# 19. QUOTE → SALE CARDINALITY

Проверить `Sale.quoteId @unique` или SQL unique.

Ответить:

- разрешена ли одна Sale на Quote;
- возможны ли revised quotes;
- partial acceptance;
- multi-sale scenarios;
- duplicate conversion protection.

Не проектировать Step 2.3/2.4 сейчас, но убедиться, что Step 2.1 не закрыл future options без Roadmap основания.

---

# 20. LIFECYCLE CAS

Проверить фактический CAS implementation.

Если используется `version`:

- transition должен update по `id + expected version`;
- stale transition → deterministic conflict;
- history создаётся только после успешного CAS;
- audit создаётся только после успешного CAS;
- no timestamp/history side effect на failed CAS.

Проверить transaction boundaries.

---

# 21. LIFECYCLE HTTP CONTRACT

Проверить endpoint semantics.

Implementation report говорит transition → HTTP 201.

Проверить repository convention.

Для command/action endpoint 201 может быть допустим существующим contract, но review должен определить:

- действительно ли создаётся новый resource;
- или правильнее 200/204.

Не менять только ради REST-пуризма, если проект имеет утверждённую convention.

Но зафиксировать несогласованность, если она реальна.

---

# 22. TEMPORAL SEMANTICS

Проверить Step 1.13A compliance.

Для каждой Sales entity:

- entity time;
- lifecycle time;
- no `updatedAt` as milestone;
- transition timestamps;
- terminal timestamps;
- UTC;
- retry preservation.

Проверить названия timestamp columns и соответствие status semantics.

---

# 23. HISTORY MODELS

Проверить 4 history models.

Для каждого:

- immutable intent;
- action;
- fromStatus;
- toStatus;
- actorId;
- timestamp;
- entity ref;
- no PII snapshot;
- no arbitrary JSON dumping.

Проверить, не создаётся history после failed transition.

---

# 24. AUDITLOG SEPARATION

Проверить фактические AuditLog writes.

Заявлено:

- `sales.*.created`;
- `sales.*.status_changed`;
- details только code/status.

Проверить:

- actor;
- correlation injection из request context;
- details не принимаются из body;
- no PII;
- AuditLog не заменяет domain history.

---

# 25. EVENT ABSENCE

Repo-wide подтвердить отсутствие новых speculative Sales events.

Особенно:

- `LeadCreated`;
- `OpportunityCreated`;
- `QuoteIssued`;
- `SaleClosed`;
- `SaleCompleted`;
- `OrderRequested`.

Если events отсутствуют — проверить, что это не ломает Step 2.1 requirements.

Не требовать events только ради event-driven purity.

---

# 26. OUTBOX REGRESSION

Проверить, что Sales mutations случайно не создают Outbox rows.

Проверить существующий EventBus не изменён неправильно.

Outbox reliability debt остаётся deferred prerequisite.

Step 2.1 не должен скрыто «решить» retry.

---

# 27. MONEY ABSENCE

Repo-wide проверить новые Sales models/contracts на:

- amount;
- price;
- subtotal;
- total;
- discount;
- tax;
- currency;
- Decimal/float.

Если money отсутствует — подтвердить, что это соответствует Step 2.1 boundary.

Если обнаружен money — проверить against monetary prerequisite.

---

# 28. AVAILABILITY ABSENCE

Проверить отсутствие writes в:

- Availability;
- Tariff;
- slotsReserved;
- capacity;
- holds.

Sales foundation не должен резервировать capacity.

---

# 29. PAYMENT / SUBSCRIPTION ABSENCE

Проверить отсутствие новых:

- Payment;
- PaymentIntent;
- Charge;
- Refund;
- Ledger;
- Commission;
- Settlement;
- Payout;
- Subscription;
- Plan;
- Trial.

Не считать старые `Order.paymentStatus/paidAmount` Payment domain.

---

# 30. RBAC — НЕ ДОВЕРЯТЬ ОТЧЁТУ

Проверить реальные permissions constants и role matrix.

Заявлено:

Write:
- SALES_MANAGER;
- ADMIN.

Read:
- DIRECTOR;
- FINANCE;
- MARKETER;
- ANALYST.

Проверить это особенно внимательно.

Вопросы:

1. Почему FINANCE/MARKETER/ANALYST получают read всех Sales entities?
2. Это уже было dormant permission matrix или новая выдача?
3. Соответствует ли Roadmap?
4. Не получил ли FINANCE доступ к Lead/Opportunity PII/display data без необходимости?
5. DIRECTOR semantics consistent?
6. OPERATOR?
7. MODERATOR?

Если dormant permissions были ранее, проверить semantic compatibility, а не просто переиспользование имени.

---

# 31. SALES PERMISSION GRANULARITY

Проверить, не слишком ли broad existing permissions.

Например:

- `sales.read`;
- `sales.write`

vs entity-specific permissions.

Если implementation использует broad permission, определить, соответствует ли Phase 2 Roadmap.

Не требовать premature fine-grained matrix, если existing security architecture намеренно использует domain permissions.

Но проверить least privilege.

---

# 32. OBJECT SCOPE / IDOR

Sales internal domain может быть global internal scope.

Проверить:

- detail by guessed ID/code;
- permissions;
- customer/product refs;
- actor refs;
- assignedToId.

Implementation report упоминает `assignedToId`.

Проверить:

- существует ли поле;
- что оно означает;
- можно ли назначить произвольного User;
- валидируется ли роль assignee;
- можно ли назначить BUYER/PARTNER;
- является ли assignedToId просто reference или authorization scope.

Если assignee semantics не определены Roadmap — потенциальный premature contract.

---

# 33. FORGED FIELDS / MASS ASSIGNMENT

Фактически отправить/проверить:

- id;
- code;
- status;
- version;
- createdAt;
- updatedAt;
- lifecycle timestamps;
- createdById;
- actorId;
- history;
- requestId;
- correlationId;
- causationId;
- unknown nested JSON.

Проверить expected 400/422 согласно текущему validation/error contract.

Не ослаблять global ValidationPipe.

---

# 34. DTO TYPE SAFETY

После проблемы Step 1.12.2 отдельно проверить новые DTO.

Особенно:

- arrays;
- unknown;
- nested objects;
- booleans/numbers;
- implicit conversion.

Новые DTO не должны требовать возврата `enableImplicitConversion`.

---

# 35. API SURFACE

Проверить все новые routes.

Убедиться, что нет:

- dashboard;
- KPI;
- queue;
- advanced search;
- bulk update;
- export;
- Sales Center UI backend;
- quote commercial flow.

Если есть list endpoint:

- pagination bounded;
- no unbounded `findMany`;
- stable ordering;
- total semantics.

---

# 36. LIST ENDPOINT PAGINATION

Implementation report не описал pagination подробно.

Это отдельная обязательная проверка.

Для каждого Sales list endpoint определить:

- query params;
- default page/take;
- max page size;
- total;
- deterministic ordering;
- no `take: unlimited`.

Если foundation list endpoints unbounded — finding.

---

# 37. PRIVACY

Проверить все Sales DTO responses.

Не должны утекать:

- raw CRM;
- CRM notes/tags;
- Customer internal fields;
- Product internals;
- actor internals;
- history internals в list response без необходимости;
- AuditLog;
- request context.

Lead `name` проверить отдельно как потенциальный PII field.

---

# 38. ERROR MODEL

Проверить representative:

- 401;
- 403;
- 404;
- 409;
- 422;
- 500.

Убедиться:

- `X-Request-Id`;
- body requestId;
- no stack;
- no Prisma internals;
- no SQL.

---

# 39. CROSS-CONTEXT WRITE PROOF

Repo-wide search + runtime/DB proof:

SalesService не вызывает writes в:

- CRM;
- Catalog;
- Order;
- Booking;
- Finance;
- Security.

Existence reads допустимы.

AuditLog write через Security/Audit infrastructure оценить согласно ADR — это infrastructure audit, не business cross-write.

---

# 40. BEHAVIORAL ISOLATION TEST

Фактически проверить behavioral event:

- accepted;
- Sales entity counts unchanged.

Проверить Storefront и Marketplace paths, если возможно.

Один Marketplace test не должен считаться доказательством Storefront автоматически, если код paths различается.

---

# 41. ORDER / BOOKING ISOLATION TEST

Фактически:

- create Sale;
- transition Sale;
- compare Order count;
- compare Booking count;
- inspect Outbox.

Никакого `OrderRequested`.

---

# 42. HISTORY / AUDIT ATOMICITY

Критически проверить transaction:

Entity transition + History должны быть атомарны.

Если AuditLog находится вне той же DB transaction/контекста, определить existing architecture semantics.

Не требовать cross-schema transaction redesign без ADR, но зафиксировать реальный atomicity boundary.

---

# 43. CREATE ATOMICITY

Проверить create entity + created history.

Если code sequence increment успешен, а entity create падает:

- допустим ли gap в code sequence?
- соответствует ли existing ID contract?

Не требовать contiguous codes, если contract этого не обещает.

Но history не должен остаться без entity.

---

# 44. ASSIGNMENT SEMANTICS

Если есть `assignedToId`, проверить:

- FK отсутствует/есть;
- existence validation;
- role validation;
- update/transition rights;
- history assignment changes;
- audit.

Если assignment functionality не нужна Step 2.1, определить, не является ли это Step 2.2 Sales Center concern.

---

# 45. NAME / TITLE FIELDS

Проверить минимальные business fields каждой entity.

Убедиться, что foundation не состоит только из status/code без usable identity, но и не создаёт speculative commercial model.

Для каждого field объяснить business necessity.

---

# 46. QUOTE PRODUCT CARDINALITY — REQUIRED DECISION CHECK

Это одна из главных review-точек.

Если Quote имеет единственный `productId`, сверить Roadmap будущего Quote/Checkout.

Если future Quote явно должен поддерживать несколько items/services, single `productId` на Quote root может быть неверным foundation.

В таком случае определить severity:

- локально исправимо сейчас;
- либо architecture decision required.

Не ждать Step 2.3, если Step 2.1 schema уже фиксирует неправильную cardinality.

---

# 47. SALE CLOSED — REQUIRED DECISION CHECK

Вторая главная review-точка.

Если Sale `CLOSED` является terminal до Step 2.4, проверить, как future `OrderRequested` будет запускаться.

Если Step 2.4 должен реагировать на «Sale completion», а текущий Step 2.1 уже определил `CLOSED` как completion без event, это может быть semantic conflict.

Не утверждать Step 2.1 до ясного ответа.

---

# 48. UNIQUE SALE.QUOTEID — REQUIRED DECISION CHECK

Третья главная review-точка.

Проверить, что unique relation Quote→Sale не блокирует:

- retry/conversion semantics;
- revised quote;
- multiple sales;
- partial conversion.

Если Roadmap требует 1:1 — PASS.

Если Roadmap молчит — оценить, является ли это premature irreversible assumption.

---

# 49. MIGRATION REPLAY

Запустить:

- migrate status;
- clean replay на fresh DB;
- migrate diff/drift.

Подтвердить точное число migrations после Step 2.1.

Удалить temp DB после проверки.

---

# 50. TEST QUALITY

Не принимать counts как достаточное доказательство.

Прочитать `sales-domain-foundation.e2e-spec.ts`.

Проверить:

- нет tautological tests;
- tests действительно идут через HTTP/real module;
- isolated DB;
- concurrency реальная;
- negative cases;
- cleanup;
- assertions проверяют БД, а не только response.

---

# 51. UNIT TEST QUALITY

Проверить Sales unit tests.

Если только validation helpers — это допустимо, если service invariants лучше доказаны e2e.

Не требовать artificial unit coverage.

Но lifecycle transition logic должна иметь достаточное доказательство.

---

# 52. FULL REGRESSION

Повторить фактически:

## Backend

- `npx tsc --noEmit`;
- unit;
- Sales e2e;
- full serial e2e.

## Frontend

- `npx tsc --noEmit`;
- `vitest run`;
- `next build`.

Зафиксировать:

- passed;
- failed;
- skipped;
- timeout.

---

# 53. RUNTIME VERIFICATION

Поднять isolated backend.

Проверить минимум:

1. anonymous Sales → 401;
2. BUYER → 403;
3. authorized Sales Manager create Lead;
4. canonical LED;
5. Opportunity;
6. Quote;
7. Sale;
8. transition;
9. forged field → 422;
10. requestId header/body;
11. no Order/Booking side effect.

Не оставлять smoke-data в dev DB.

---

# 54. DOCUMENTATION REVIEW

Проверить:

- `docs/contracts/ids.md`;
- `docs/architecture/sales-domain-foundation.md`;
- architecture README/index, если project convention требует index.

Документация должна совпадать с кодом.

Особенно проверить, задокументированы ли:

- Sale CLOSED semantics;
- Quote product cardinality;
- Quote→Sale cardinality;
- Lead name semantics;
- assignment semantics;
- remaining prerequisites.

---

# 55. REMAINING STEP 2.0 PREREQUISITES

Подтвердить, что после 2.1 всё ещё открыты:

1. Outbox automated retry/recovery — до 2.4/2.5.
2. Booking currency/amount policy — до 2.8.
3. Monetary contract — до 2.3A/2.4.
4. Tariff/Availability reservation & locking — до 2.3A/2.4.
5. Commercial snapshot policy — до 2.5.
6. `/orders/bootstrap` removal — 2.6.
7. Payment/PSP/ledger — 2.10C/2.12.
8. Supplier lifecycle/validation — 2.8.
9. Checkout/payment idempotency keys — 2.10.

Если implementation случайно частично реализовал что-либо из этого — описать.

---

# 56. ROADMAP RELIABILITY SEQUENCING

Сохранить gate:

Step 2.17 расположен позже reliability-dependent Step 2.4/2.5.

Step 2.1 не обязан исправлять это.

Но Strict Review должен подтвердить, что новый Sales foundation не создал reliability-dependent chain раньше времени.

---

# 57. DEFERRED DECISIONS

Проверить отсутствие реализации deferred решений:

- multilingual content;
- AI translation;
- trial;
- plans/pricing;
- recurring billing;
- grace period;
- cancellation;
- custom domains;
- commission;
- Partner CRM entitlement;
- retention;
- capability matrix.

---

# 58. FINDING CLASSIFICATION

Каждую найденную проблему классифицировать:

### BLOCKER
Нельзя approve Step 2.1.

### REVIEW FIX REQUIRED
Локальный дефект Step 2.1, исправить сейчас.

### ARCHITECTURE DECISION REQUIRED
Нельзя безопасно выбрать semantics без owner decision.

### FUTURE STEP / ACCEPTED DEBT
Реальная проблема/ограничение, но owner — следующий Roadmap step.

### NON-ISSUE
Кандидат проверен и доказан как корректный.

Для каждого confirmed finding:

- problem;
- evidence;
- risk;
- root cause;
- files;
- exact fix;
- tests required.

---

# 59. FIX POLICY

Если найден локальный однозначный defect:

**исправить его в рамках Strict Review**, затем повторить targeted + full regression.

Не исправлять:

- future architecture;
- Step 2.2 functionality;
- Step 2.3 commercial model;
- Step 2.4 event flow;
- Finance/Payment;
- Subscription.

Если исправление требует выбора фундаментальной semantics — остановиться с:

`ARCHITECTURE DECISION REQUIRED`

---

# 60. REQUIRED STRICT REVIEW QUESTIONS

В финальном отчёте дать явные ответы:

1. Sales bounded context корректен?
2. Все 4 canonical entities действительно foundation-ready?
3. Canonical code generation concurrency-safe?
4. Lead не стал скрытым CRM Prospect?
5. Behavioral events не создают Leads?
6. Opportunity lifecycle не смешан с Order?
7. Quote не начал Step 2.3?
8. Single `Quote.productId` безопасен для Roadmap?
9. `Sale.status=CLOSED` безопасен перед Step 2.4?
10. `Sale.quoteId unique` обоснован?
11. Sale не создаёт Order?
12. Cross-context writes отсутствуют?
13. Customer/Product refs безопасны?
14. `assignedToId` не является premature Sales Center feature?
15. RBAC least-privilege?
16. List endpoints bounded/paginated?
17. History/temporal semantics корректны?
18. AuditLog separation корректна?
19. Money/currency отсутствуют корректно?
20. Availability/Payment/Subscription boundaries сохранены?
21. Migration replay/drift clean?
22. Full regression green?
23. Есть ли blockers?
24. Нужен ли architecture decision?
25. Можно ли после approval переходить к Step 2.2?

---

# 61. ОБЯЗАТЕЛЬНЫЙ ФОРМАТ STRICT REVIEW REPORT

Вернуть:

1. Verdict
2. Repository baseline
3. Files/modules inspected
4. Roadmap scope verification
5. Sales ownership
6. Prisma/schema review
7. Migration SQL review
8. Canonical ID review
9. Concurrency review
10. Lead semantics
11. Behavioral isolation
12. Opportunity semantics
13. Quote semantics
14. Sale semantics
15. Relationship/cardinality review
16. Customer/prospect boundary
17. Product boundary
18. Assignment semantics
19. Lifecycle/CAS
20. Temporal semantics
21. History
22. AuditLog
23. Events/Outbox
24. Correlation boundary
25. Money/currency
26. Availability
27. Payment/Subscription
28. RBAC
29. Object scope/IDOR
30. DTO/mass-assignment
31. API/pagination
32. Privacy
33. Cross-context write proof
34. Order/Booking isolation
35. Migration replay/drift
36. Unit tests
37. E2E tests
38. Full regression
39. Runtime verification
40. Documentation review
41. Remaining Step 2.0 prerequisites
42. Roadmap sequencing notice
43. Deferred Decisions compliance
44. Confirmed findings
45. Review fixes implemented
46. Remaining debt
47. Architecture decision status
48. Approval recommendation
49. Out-of-scope confirmation
50. Files changed during review

---

# 62. FINAL VERDICT STRINGS

Если полностью подтверждено, включая review fixes:

`PHASE 2 STEP 2.1 STRICT REVIEW COMPLETED — APPROVED`

Если локальные fixes выполнены, но требуется пользовательское approval:

`PHASE 2 STEP 2.1 REVIEW FIXES COMPLETED — WAITING FOR APPROVAL`

Если нужен architecture decision:

`ARCHITECTURE DECISION REQUIRED`

Если есть blocker:

`PHASE 2 STEP 2.1 STRICT REVIEW FAILED — BLOCKER FOUND`

---

# 63. STOP CONDITION

После Strict Review:

**НЕ начинать Step 2.2.**

Даже при APPROVED остановиться и вернуть review report.

Следующий implementation step должен запускаться отдельным prompt.
