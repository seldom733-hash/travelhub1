# PHASE 2 — STEP 2.2 — SALES CENTER BACKEND — IMPLEMENTATION PROMPT

## 0. Роль

Ты работаешь как Principal Software Architect / Staff Backend Engineer / Security Reviewer проекта TravelHub.

Твоя задача — реализовать:

**PHASE 2 — STEP 2.2 — Sales Center Backend**

строго по `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`, действующим ADR, Phase 1 contracts и утверждённым результатам:

- Phase 2 Step 2.0 Entry Audit + Strict Review;
- Phase 2 Step 2.1 Sales Domain Foundation + Strict Review.

Step 2.1 APPROVED.

Не доверяй предыдущим отчётам как доказательству — перед изменениями проверяй фактический repository state.

---

# 1. CANONICAL ROADMAP SCOPE

Roadmap определяет Step 2.2:

> **Sales Center Backend — API, queues, filters, KPI/read models, actions, audit, RBAC. Sales не владеет Order/Booking logic.**

Это точная граница шага.

Step 2.2 должен превратить foundation Step 2.1 в безопасный operational backend Sales Center, но НЕ начать commercial-offer/checkout/order flow.

---

# 2. СТРОГИЙ OUT-OF-SCOPE

НЕ реализовывать в Step 2.2:

## Step 2.3 — Quote & Commercial Offer Flow

Не добавлять:
- Product/Tariff snapshot;
- QuoteItem commercial model, если он нужен именно 2.3;
- authoritative price;
- discounts;
- taxes;
- totals;
- quote currency contract;
- validity/expiration;
- travelers context;
- quote acceptance;
- PDF/email/send flow.

## Step 2.3A — Checkout / Commercial Intent

Не добавлять:
- Checkout;
- Cart;
- authoritative checkout context;
- service options resolution;
- price authority;
- availability reservation;
- capacity locking;
- payment terms;
- publication/acquisition transaction context.

## Step 2.4+

Не добавлять:
- Sale completion;
- Sale CLOSED transition;
- `OrderRequested`;
- Order writes;
- Booking writes;
- Payment/PSP;
- Finance;
- Documents commercial flow.

## Другие будущие domains

Не добавлять:
- Partner CRM;
- Support;
- Chat;
- Notifications;
- Subscription/Billing;
- analytics warehouse/dashboard Phase 3.

---

# 3. ОБЯЗАТЕЛЬНАЯ СВЕРКА STEP 2.1

Перед кодом проверить фактическое состояние Step 2.1 после Strict Review.

Особенно подтвердить:

1. `Lead` — `LED-*`.
2. `Opportunity` — `OPP-*`.
3. `Quote` — `QTE-*`.
4. `Sale` — `SAL-*`.
5. Sale создаётся только `OPEN`.
6. Sale close/complete endpoint отсутствует.
7. `SaleStatus.CLOSED` — schema-reserved для Step 2.4, runtime transition отсутствует.
8. `assignedToId` принимает только staff users, не BUYER/PARTNER.
9. `Lead.name` — display label, не canonical prospect identity.
10. Quote single `productId` — временная nullable foundation-reference, full Quote items принадлежат 2.3.
11. Quote→Sale 1:1 сейчас зафиксирован как duplicate-conversion protection.
12. Sales не эмитит `OrderRequested`.
13. Sales не пишет Order/Booking/Availability.
14. Money отсутствует.
15. Payment/Subscription отсутствуют.

Если repository расходится с этим baseline — сначала зафиксировать discrepancy.

---

# 4. ЦЕЛЬ SALES CENTER BACKEND

Создать operational backend, позволяющий internal staff:

- видеть Sales pipeline;
- получать очереди работы;
- фильтровать сущности;
- просматривать детали;
- выполнять разрешённые Sales actions;
- видеть безопасные KPI/read models;
- назначать/reassign staff, если это соответствует существующей модели;
- видеть lifecycle/history там, где это нужно operationally;
- работать под строгим RBAC/object-scope/audit contract.

Sales Center должен работать только с canonical Sales facts.

Он НЕ должен вычислять коммерческие/финансовые факты, которых ещё нет.

---

# 5. BACKEND-ONLY BOUNDARY

Step 2.2 — **Backend**.

Frontend Sales Center UI не реализовывать.

Frontend production code менять только если это необходимо для shared type/build regression и строго обосновано.

Основной deliverable:

- backend API;
- queues;
- filters;
- KPI/read models;
- actions;
- audit;
- RBAC;
- tests;
- docs.

---

# 6. SALES CENTER API SURFACE

Спроектировать минимальный canonical internal API.

Предпочтительная структура — следовать существующим route conventions проекта.

Функционально должны быть доступны:

## Lead
- list;
- detail;
- permitted actions;
- assignment/reassignment, если утверждено;
- history/read model при необходимости.

## Opportunity
- list;
- detail;
- permitted actions;
- assignment/reassignment;
- history.

## Quote
- list;
- detail;
- permitted existing lifecycle action (`ISSUE`), если Step 2.1 уже это поддерживает;
- history.

## Sale
- list;
- detail;
- **никакого close/complete action** в 2.2.

## Center-level
- queue/read models;
- KPI summary.

Не создавать дублирующий второй CRUD API, если foundation routes уже существуют и их можно расширить совместимо.

---

# 7. API COMPATIBILITY

Проверить Step 2.1 endpoints.

Решить минимально:

- расширять существующие endpoints;
- или добавить `/sales/center/*` read-model endpoints.

Не ломать approved contracts без необходимости.

Если API restructuring необходима — migration/compatibility strategy должна быть explicit.

---

# 8. OPERATIONAL QUEUES

Roadmap прямо требует `queues`.

Queues — это read models, НЕ новые operational entities.

Не создавать таблицу `SalesQueue`, если очередь может быть вычислена из canonical Sales entities.

Определи реальные очереди только из существующих lifecycle facts.

Допустимые примеры, если подтверждены current lifecycle:

- NEW Leads;
- QUALIFIED Leads;
- NEW/OPEN Opportunities;
- DRAFT Quotes;
- ISSUED Quotes;
- OPEN Sales.

Не создавать queue:
- awaiting payment;
- awaiting booking;
- checkout abandoned;
- overdue payment;
- fulfillment;
если соответствующих facts ещё нет.

---

# 9. QUEUE SEMANTICS

Для каждой queue документировать:

- canonical source entity;
- exact status predicate;
- sort;
- pagination;
- allowed roles;
- projection fields.

Queue count и queue items должны использовать один и тот же predicate.

Никаких скрытых side effects при чтении queue.

---

# 10. KPI / READ MODEL PRINCIPLE

Roadmap требует KPI/read models, но Step 2.2 не имеет Finance/Checkout.

KPI должны отражать только **реально существующие Sales facts**.

Допустимы count-based operational metrics:

- Leads total/by status;
- Opportunities total/by status;
- Quotes total/by status;
- Sales total/by status;
- unassigned/assigned counts;
- created in period;
- lifecycle transition counts, если history достоверна;
- basic funnel counts based on actual entity relationships/statuses.

Не называть эти метрики revenue/GMV/cash.

---

# 11. ЗАПРЕЩЁННЫЕ KPI

Нельзя возвращать в Step 2.2:

- Revenue;
- GMV;
- Net Revenue;
- Commission;
- Paid;
- Outstanding cash;
- Payment conversion;
- Refund;
- Settlement;
- Payout;
- Partner payable;
- financial average check,
если canonical money/finance facts ещё отсутствуют.

`Sale count` ≠ revenue.

`Quote count` ≠ GMV.

`Sale OPEN` ≠ paid/converted order.

---

# 12. FUNNEL METRICS BOUNDARY

Можно предоставлять только честные Sales-domain counts/conversion ratios, если relation semantics позволяют.

Например, если подтверждено:

Lead → Opportunity → Quote → Sale

можно считать:
- entity counts;
- related entity conversion counts.

Но нельзя утверждать:
- behavioral ProductView→Lead;
- Quote→Order;
- Sale→Payment;
пока эти flows не реализованы.

Если denominator semantics неоднозначна — не вводить metric.

---

# 13. PERIOD FILTERING

KPI/read models должны поддерживать только те временные фильтры, для которых source-of-truth честен.

Например:
- createdAt period;
- lifecycle history timestamp, если metric именно transition-based.

Нельзя использовать `updatedAt` как:
- qualifiedAt;
- wonAt;
- issuedAt;
- sale completed time.

Соблюдать temporal-readiness contract.

---

# 14. FILTERS — GENERAL

Roadmap требует filters.

Фильтры должны быть:

- explicit whitelist;
- typed;
- bounded;
- server-side;
- deterministic;
- SQL/ORM-safe.

Никаких arbitrary dynamic Prisma fields из query.

---

# 15. LEAD FILTERS

Минимально рассмотреть:

- status;
- assignedToId;
- customerId, если это operationally justified;
- createdAt range;
- canonical code;
- safe text search по display label/code, если Roadmap/Center требует.

Не вводить:
- source attribution fields, которых нет;
- phone/email search, если PII не хранится;
- behavioral filters.

---

# 16. OPPORTUNITY FILTERS

Минимально:

- status;
- assignedToId;
- customerId;
- leadId;
- createdAt range;
- code/title safe query.

Не вводить money filters.

---

# 17. QUOTE FILTERS

Минимально:

- status;
- customerId;
- opportunityId;
- productId;
- assignedToId, если поле существует;
- createdAt range;
- code/title.

Не вводить:
- amount;
- currency;
- validity;
- discount;
- accepted;
если этих canonical facts ещё нет.

---

# 18. SALE FILTERS

Минимально:

- status;
- quoteId;
- opportunity/customer references, если реально присутствуют/derivable без giant joins;
- assignedToId;
- createdAt range;
- code/title.

Не вводить:
- paid;
- order status;
- booking status;
- revenue;
- paymentStatus.

Sales не владеет Order/Booking logic.

---

# 19. CROSS-DOMAIN FILTER BOUNDARY

Не строить Sales Center list через broad cross-domain joins, которые превращают Sales в owner:

- Order;
- Booking;
- Payment;
- CRM internals.

Read-by-ID/projection допустима только если это уже approved architecture and needed.

Предпочитать Sales-owned fields/refs.

---

# 20. PAGINATION CONTRACT

Все list/queue endpoints обязаны:

- использовать server-side pagination;
- иметь default page/pageSize;
- иметь hard max pageSize;
- deterministic ordering;
- tie-breaker;
- `total`;
- `hasMore` или project-equivalent;
- считать total по тому же scoped/filtered dataset.

Никаких unbounded `findMany`.

---

# 21. SORTING

Если sorting входит в Step 2.2:

Разрешать только whitelist sort fields, например:
- createdAt;
- code;
- status,
если это реально нужно.

Никаких raw ORM path из клиента.

Обязательный stable tie-breaker.

---

# 22. SEARCH

Если вводится text search:

- bounded query length;
- normalize whitespace;
- safe parameterization;
- no SQL interpolation;
- не искать по PII, которого domain не должен хранить;
- no regex DoS.

Search semantics документировать.

---

# 23. DETAIL READ MODEL

Detail response может быть богаче list projection, но должен оставаться whitelist DTO.

Допустимые данные:
- Sales-owned fields;
- canonical refs;
- lifecycle;
- assignment;
- timestamps;
- approved history projection.

Не сериализовать raw Prisma entity вместе с relations.

---

# 24. HISTORY READ API

Step 2.2 operational backend может требовать history.

Если вводится history endpoint:

- entity-scoped;
- paginated/bounded;
- immutable projection;
- actor safe display;
- from/to status;
- timestamp;
- action.

Не возвращать:
- raw AuditLog details;
- security internals;
- CRM data;
- request body.

---

# 25. ACTIONS

Roadmap требует actions.

Actions должны использовать только уже утверждённые lifecycle Step 2.1:

## Lead
- qualify;
- disqualify;
- другие только если реально существуют.

## Opportunity
- open;
- won;
- lost.

## Quote
- issue.

## Sale
- **никакого close/complete** до Step 2.4.

Не добавлять future actions для удобства UI.

---

# 26. ASSIGN / REASSIGN ACTION

Step 2.1 уже имеет `assignedToId`.

В Step 2.2 можно сделать explicit assign/reassign operational action, если current model это поддерживает.

Но обязательно:

- staff-only target;
- BUYER/PARTNER target → 422;
- actor server-derived;
- history;
- audit;
- CAS/version/concurrency;
- no authorization derived from assignedToId.

Если assignment semantics не одинаковы для всех entities — реализовать только там, где модель реально содержит поле.

---

# 27. ASSIGNMENT HISTORY

Если assignedToId меняется:

обязательно сохранить historical fact:

- previous assignee;
- new assignee;
- actor;
- occurredAt.

Не использовать `updatedAt` для manager-performance history.

Не копировать email/name как authoritative identity, если canonical User ID достаточно.

---

# 28. OWNER VS ASSIGNEE

Не путать:

- entity ownership (Sales bounded context);
- customer/business reference;
- assigned internal staff;
- caller authorization.

`assignedToId` не должен автоматически определять, кто имеет право прочитать entity, если Roadmap не ввёл assignee-scoped authorization.

---

# 29. RBAC — КРИТИЧЕСКИЙ ПЕРЕСМОТР STEP 2.1 DEBT

Strict Review 2.1 оставил debt:

> FINANCE/MARKETER/ANALYST имеют dormant `sales.*` read permissions; exposure необходимо пересмотреть при появлении реальных Sales Center endpoints.

**Step 2.2 — именно момент этого пересмотра.**

Не оставлять старую матрицу автоматически.

Построить exact matrix:

| Role | List | Detail | KPI | Queues | History | Actions | Assignment |

Минимум:
- ADMIN;
- DIRECTOR;
- SALES_MANAGER;
- OPERATOR;
- FINANCE;
- MARKETER;
- ANALYST;
- MODERATOR;
- BUYER;
- PARTNER.

---

# 30. LEAST-PRIVILEGE RBAC

Для каждой роли доказать business need.

Особенно:

### SALES_MANAGER
Expected primary operational role.

### DIRECTOR
Может иметь broad read, если current role contract это подтверждает.

### ANALYST
Если нужен analytics/read model access — отдавать агрегированные/non-PII read models, а не обязательно raw Lead detail.

### MARKETER
Не давать raw Sales/customer detail только потому, что permission dormant.

### FINANCE
Не давать Lead/Opportunity detail, если Finance domain ещё отсутствует и business need не доказан.

### OPERATOR
Не выдавать Sales mutation автоматически.

### MODERATOR
Catalog moderation ≠ Sales.

### BUYER/PARTNER
Internal Sales Center → 403.

Если существующая permission matrix фундаментально противоречит least privilege — сделать локальный RBAC review-fix/reconciliation.

---

# 31. DIFFERENT PROJECTIONS BY CAPABILITY

Необязательно один DTO для всех internal readers.

Если ANALYST/MARKETER нуждаются только в KPI/read-model:
- предоставь отдельные aggregate permissions/projections;
- не выдавай raw Lead details.

Не создавать лишнюю permission explosion, но соблюсти least privilege.

Если требуется новая permission taxonomy, использовать существующий permission convention.

---

# 32. PERMISSION RECONCILIATION

Любое изменение role matrix должно:

- обновить permission registry;
- descriptions;
- role mappings;
- seed/reconciliation;
- revoke stale grants;
- не возвращать их после reboot.

Добавить e2e proof fresh/repeated reconciliation.

---

# 33. IDOR / OBJECT SCOPE

Internal Sales Center может быть global staff scope, но это должно быть explicit.

Проверить:
- unknown code → neutral 404 where applicable;
- customerId/productId filters не дают access к CRM/Catalog internals;
- assignedToId не расширяет permissions;
- roles without detail access cannot derive data via queue/count.

Count/total не должен становиться side channel для forbidden data.

---

# 34. KPI PRIVACY

Aggregates тоже могут leaking sensitive counts.

Если роль не имеет права видеть raw Sales domain, решить, имеет ли она право на aggregate KPI.

Не считать KPI «безопасным автоматически».

Особенно segmentation по:
- customer;
- assignee;
- product;
может раскрывать business-sensitive данные.

---

# 35. DTO / MASS ASSIGNMENT

Все write/action DTO:

- whitelist;
- forbidden server-owned keys.

Запретить:
- id;
- code;
- status через generic PATCH;
- version tampering, кроме explicit expectedVersion если CAS API contract это использует;
- createdBy;
- timestamps;
- actor;
- history;
- audit;
- requestId;
- correlationId;
- causationId.

---

# 36. GENERIC PATCH

Не добавлять unrestricted `PATCH /sales/:id`.

Если update business fields нужен:
- explicit DTO;
- whitelist;
- history/audit для meaningful changes.

Не разрешать generic status mutation.

---

# 37. ENTITY EDITABILITY

Определи, какие Step 2.1 foundation fields реально можно менять в Center.

Например:
- display `name/title`;
- assignment;
- customer link,
если business rules разрешают.

Не добавлять editing:
- product commercial snapshot;
- quote money;
- sale completion.

Любая mutation должна иметь audit semantics.

---

# 38. CONCURRENCY / CAS

Все lifecycle/assignment actions должны сохранять Step 2.1 CAS semantics.

Проверить:
- stale version → 409;
- duplicate action → deterministic;
- history only once;
- audit only once;
- no lost update.

Если non-lifecycle field edit добавляется — определить optimistic concurrency policy.

---

# 39. AUDIT

Roadmap требует audit.

Для каждой action/mutation:

- actor;
- entity;
- action;
- safe before/after metadata;
- correlation from request context.

Не логировать:
- full body;
- PII;
- CRM raw object.

AuditLog не заменяет SalesHistory.

---

# 40. KPI SOURCE-OF-TRUTH

Для каждого KPI в коде/documentation указать:

- source entity/table;
- predicate;
- timestamp basis;
- denominator if ratio;
- inclusion/exclusion.

Никаких KPI с неясной семантикой.

---

# 41. READ MODEL SOURCE-OF-TRUTH

Read model не становится новым owner.

Не создавать duplicate persistent Sales summary tables без необходимости.

Step 2.2 может вычислять read models query-time.

Если materialization действительно нужна, обосновать consistency/refresh — но по умолчанию не вводить premature materialized store.

---

# 42. N+1 / QUERY PERFORMANCE

Sales Center backend — operational.

Проверить:

- list queries bounded;
- queue counts batched/aggregated;
- KPI не делает N+1;
- detail refs не загружаются по одной записи в цикле;
- indexes соответствуют реально добавленным filters.

Добавлять индексы только по фактическим read patterns Step 2.2.

---

# 43. DATABASE INDEX REVIEW

После определения filters проверить существующие Sales indexes.

Добавить только необходимые, например combinations:
- status + createdAt;
- assignedToId + status;
если queries реально используют их.

Не создавать десятки speculative indexes.

Если schema меняется — новая forward migration.

Applied Step 2.1 migration не редактировать.

---

# 44. MONEY / FINANCE BOUNDARY

Step 2.2 KPI НЕ должен вводить money semantics.

Никаких:
- sale amount;
- quote amount;
- revenue;
- GMV.

Monetary contract остаётся prerequisite до 2.3A/2.4.

---

# 45. QUOTE BOUNDARY

Step 2.2 может operationally отображать Quote foundation.

Но не превращать Quote detail в Step 2.3.

Single `productId` остаётся foundation reference/debt.

Не добавлять QuoteItem/price/validity в 2.2.

---

# 46. SALE BOUNDARY

Sale остаётся только OPEN runtime.

Sales Center:
- может list/detail OPEN Sale;
- не должен предлагать Close/Complete action.

`SaleStatus.CLOSED` reserved не должен появляться в action metadata как доступный transition.

---

# 47. BEHAVIORAL BOUNDARY

KPI Sales Center не должен автоматически включать Marketplace/Storefront behavioral data как Sales facts.

Не считать:
- impressions;
- views;
- search;
- contact clicks
Lead/Sale metrics.

Behavioral conversion funnels принадлежат analytics/read-model будущим steps.

---

# 48. CRM BOUNDARY

Не превращать Sales Center в CRM Center.

Разрешены canonical customer refs.

Не отдавать:
- CRM notes;
- tags;
- manager internals;
- private Customer history;
если Sales Center contract этого не требует.

Partner CRM — future Phase 3.

---

# 49. ORDER / BOOKING BOUNDARY — CRITICAL

Roadmap прямо говорит:

> Sales не владеет Order/Booking logic.

Проверить production code:

- no Order write;
- no Booking write;
- no Order transition;
- no Booking transition;
- no Order/Booking KPI pretending to be Sales Center;
- no `OrderRequested`.

Даже для read models не делать Sales-owned Order joins, если Roadmap не требует.

---

# 50. OUTBOX BOUNDARY

Step 2.2 не обязан эмитить новые business events.

Если новые actions не имеют consumers:
- history + audit достаточно согласно Step 2.1 pattern.

Не добавлять speculative:
- LeadAssigned;
- OpportunityWon;
- QuoteIssued
events только ради будущего.

Если реально нужен consumer — это может быть scope conflict.

---

# 51. OUTBOX RELIABILITY PREREQUISITE

Сохранить notice:

- automated retry/recovery обязателен до 2.4/2.5;
- Step 2.17 расположен позднее;
- roadmap-owner должен решить scheduling до reliability-dependent flow.

Step 2.2 не должен создавать критичную async chain.

---

# 52. API ERROR MODEL

Все Center endpoints:

- 400 malformed;
- 401 anonymous;
- 403 wrong role;
- 404 neutral where appropriate;
- 409 CAS;
- 422 business validation;
- 500 generic.

Всегда:
- `X-Request-Id`;
- error body requestId;
- no stack/SQL/internal Prisma.

---

# 53. VALIDATIONPIPE

Использовать общий production-equivalent validation config.

Не возвращать `enableImplicitConversion`.

Filters/query DTO должны иметь explicit transformations там, где нужны numbers/booleans/dates.

Проверить arrays/nested filters, если появляются.

---

# 54. DATE RANGE FILTERS

Если есть `from/to`:

- validate ISO format;
- define inclusive/exclusive semantics;
- validate `from <= to`;
- UTC instant semantics;
- hard limit period только если нужен performance guard.

Не интерпретировать local service date.

---

# 55. STATUS FILTERS

Использовать enum whitelist.

Не принимать arbitrary status string.

Не показывать reserved `Sale.CLOSED` как actionable state; read filtering может технически поддерживать existing DB enum only if contract clearly distinguishes reserved/non-runtime.

---

# 56. SAFE TEXT SEARCH

Если implemented:
- trim;
- length cap;
- parameterized query;
- deterministic behavior;
- no wildcard injection surprises;
- no raw SQL concatenation.

---

# 57. READ MODEL CONSISTENCY

KPI counts, queue counts и list totals должны совпадать при одинаковых predicates.

Добавить cross-check tests.

Например:
`NEW lead KPI == NEW lead queue total`
при одинаковом period/scope.

---

# 58. KPI ZERO-STATE

Fresh Sales domain должен возвращать:

- zero counts;
- empty queues;
- no fabricated percentages.

Ratio при denominator 0 должен иметь explicit semantics:
- null;
- 0;
или отсутствовать,
согласно выбранному contract.

Не отдавать NaN/Infinity.

---

# 59. KPI PERIOD COMPARISON

Не реализовывать trend/delta/previous period, если Roadmap этого прямо не требует и semantics не определены.

Step 2.2 KPI/read model должен быть минимальным.

---

# 60. QUEUE PRIORITY

Не выдумывать AI/risk/priority score.

Если queue sort:
- createdAt;
- status-specific deterministic order;
- assigned/unassigned;
только из canonical facts.

Priority field не создавать без contract.

---

# 61. ASSIGNEE QUEUES

Если queue поддерживает `assignedToMe`:

actor userId должен быть server-derived.

Не принимать `me=<user id>`.

Для supervisors фильтр assignedToId может быть explicit при соответствующем permission.

---

# 62. ROLE-SPECIFIC QUEUES

Не создавать отдельные queue entities на роль.

Queue visibility определяется RBAC + read model.

Если ANALYST имеет aggregate only — он не должен иметь operational queue.

---

# 63. SECURITY TEST MATRIX

Минимум:

## anonymous
- all center endpoints → 401.

## BUYER
- center list/detail/KPI/queues/actions → 403.

## PARTNER
- center → 403.

## MODERATOR
- no Sales Center unless explicit permission.

## SALES_MANAGER
- operational lists/details/queues/actions allowed.

## DIRECTOR
- allowed according to finalized matrix.

## FINANCE/MARKETER/ANALYST
- проверить именно новый least-privilege decision:
  - aggregate-only / denied raw detail / exact contract.

## ADMIN
- expected internal access.

---

# 64. RBAC SIDE-CHANNEL TESTS

Если роль aggregate-only:

проверить, что она не может:
- открыть detail;
- list raw entities;
- получить history;
- использовать filters для customer-level probing;
- получить names через queue.

KPI projection не должен содержать entity labels/IDs, если это aggregate-only.

---

# 65. FILTER SECURITY TESTS

Проверить:

- unknown filter → 400/whitelist behavior;
- invalid status;
- invalid assignedToId;
- BUYER user as assignee filter;
- oversized query;
- invalid page/pageSize;
- negative page;
- huge pageSize;
- invalid date range;
- arbitrary sort key.

---

# 66. PAGINATION TESTS

Обязательно проверить >1 page.

Proof:
- no duplicates;
- no missing rows;
- deterministic ordering;
- correct total;
- hasMore;
- filter + total consistency.

Tie-case с одинаковым createdAt желательно проверить code tie-breaker.

---

# 67. QUEUE TESTS

Минимум:

- правильный status inclusion;
- неправильный status exclusion;
- total;
- pagination;
- assignment filter;
- deterministic ordering;
- no side effect.

---

# 68. KPI TESTS

Минимум:

- zero state;
- mixed statuses;
- period filter;
- counts;
- queue/KPI consistency;
- no financial fields;
- ratio zero-denominator safety, если ratios введены.

---

# 69. ACTION TESTS

Для каждого разрешённого action:

- correct role;
- wrong role;
- invalid transition;
- terminal transition;
- stale version;
- duplicate request;
- history;
- audit;
- timestamp.

Sale completion action отсутствует — отдельный negative proof 404/no route.

---

# 70. ASSIGNMENT TESTS

Если assign/reassign implemented:

- assign valid staff;
- BUYER target → 422;
- PARTNER target → 422;
- unknown user → 422/404 semantic;
- reassign;
- stale version → 409;
- history previous→new;
- audit;
- assignedToId not authorization scope.

---

# 71. CROSS-DOMAIN ISOLATION TESTS

После operational actions подтвердить:

- Order count unchanged;
- Booking count unchanged;
- Availability unchanged;
- Outbox no `OrderRequested`;
- behavioral unaffected;
- Payment absent.

---

# 72. PRIVACY TESTS

Raw Sales responses не должны содержать:

- Customer email/phone;
- CRM notes/tags;
- User auth fields;
- Product internals;
- AuditLog internals;
- request/correlation fields;
- history raw relation internals.

Aggregate endpoints — никаких PII.

---

# 73. AUDIT TESTS

Проверить audit for:
- lifecycle action;
- assignment;
- editable business field mutation, если есть.

Audit details:
- no PII;
- no full request;
- actor correct;
- correlation injected server-side.

---

# 74. HISTORY TESTS

History endpoint/projection:
- creation;
- status changes;
- assignment changes, если implemented;
- immutable order;
- pagination;
- actor safe projection.

Не смешивать AuditLog в history feed без явного contract.

---

# 75. CONCURRENCY

Step 2.1 code concurrency regression должен остаться зелёным.

Новые read/action features не должны сломать:
- code generation;
- CAS;
- history uniqueness.

Добавить concurrency тест assignment/action, если новая mutation использует version.

---

# 76. DATABASE / MIGRATION

Если только service/controller changes и existing indexes достаточны — schema migration не нужна.

Если нужны новые indexes:
- новая additive migration;
- no editing Step 2.1 migration.

Обязательно:
- migrate status;
- clean replay;
- diff/no drift.

---

# 77. PERFORMANCE / N+1 PROOF

Проверить query count или code structure для representative:

- list 50;
- queue 50;
- KPI;
- detail/history.

Не допускается query-per-row для Customer/Product/User refs.

Если labels нужны:
- batch resolution;
- или не включать labels в list.

---

# 78. INTERNAL DISPLAY PROJECTIONS

Если UI в будущем требует customer/assignee display names, backend может отдавать safe projection.

Но:
- разрешено только при role access;
- batch;
- whitelist;
- no raw CRM/User object.

Не добавлять contacts.

---

# 79. CUSTOMER LABEL SEMANTICS

Если Lead.name уже display label, не заменять его текущим Customer name автоматически.

Historical/display semantics должны быть понятны.

Не создавать silent sync between CRM and Sales.

---

# 80. SALES CENTER READ MODEL OWNERSHIP

Read model может быть Sales-owned query layer, но не operational owner других domains.

Не создавать mutable duplicate business facts.

---

# 81. DOCUMENTATION

Создать/обновить canonical Sales Center Backend doc.

Минимум:

- API;
- queue definitions;
- filters;
- KPI dictionary;
- read model predicates;
- RBAC matrix;
- actions;
- audit/history;
- pagination;
- privacy;
- explicit non-goals;
- remaining prerequisites.

KPI definitions должны быть precise.

---

# 82. KPI DICTIONARY STEP 2.2

В документации для каждого KPI:

| KPI | Definition | Source | Time basis | Filters | Exclusions |

Не путать с будущим Phase 3 canonical KPI dictionary; Step 2.2 словарь локальный operational и минимальный.

---

# 83. README / ARCHITECTURE INDEX

Если repository convention требует index — добавить новый doc в index.

Не создавать ADR без нового architecture decision.

---

# 84. EXISTING DEBT N1/N2

Из Strict Review 2.1:

## N1
Single `Quote.productId` — future Step 2.3.

Не исправлять сейчас.

## N2
FINANCE/MARKETER/ANALYST read sales.*.

**N2 должен быть пересмотрен сейчас**, потому что Step 2.2 создаёт реальные read endpoints.

В финальном отчёте явно написать:
- какие права сохранены;
- какие revoked;
- почему;
- какие projections доступны каждой роли.

---

# 85. STEP 2.0 PREREQUISITES

Остаются открытыми:

1. Outbox automated retry/recovery — до 2.4/2.5.
2. Booking currency/amount policy — до 2.8.
3. Monetary contract — до 2.3A/2.4.
4. Tariff/Availability reservation & locking — до 2.3A/2.4.
5. Commercial snapshot policy — до 2.5.
6. `/orders/bootstrap` removal — Step 2.6.
7. Payment/PSP/ledger — 2.10C/2.12.
8. Supplier lifecycle/validation — Step 2.8.
9. Checkout/payment idempotency keys — Step 2.10.

Step 2.2 не должен отметить ни один выполненным без фактической реализации соответствующего owner step.

---

# 86. ROADMAP RELIABILITY NOTICE

Сохранить sequencing issue:

Step 2.17 позже reliability-dependent 2.4/2.5.

До планирования 2.4/2.5 roadmap-owner обязан решить ранний reliability capability.

Step 2.2 не должен менять Roadmap самостоятельно.

---

# 87. DEFERRED DECISIONS

Не трогать:

- multilingual UGC;
- AI translation;
- Storefront trial;
- plans/pricing;
- recurring billing;
- cancellation;
- grace period;
- custom domains;
- commission rates;
- Partner CRM capability;
- retention;
- SaaS capability matrix.

---

# 88. ARCHITECTURE DECISION TRIGGERS

Остановиться с:

`ARCHITECTURE DECISION REQUIRED`

если реализация Sales Center требует:

- нового ownership Sales/CRM/Order;
- нового Prospect identity;
- изменения Quote commercial cardinality для 2.3;
- определения Sale completion semantics до 2.4;
- money model;
- availability reservation;
- cross-domain write;
- new Partner/Buyer Sales access model;
- fundamentally new staff assignment policy.

Не выбирать фундаментальное решение молча.

---

# 89. REQUIRED E2E SPEC

Создать отдельный:

`backend/test/sales-center.e2e-spec.ts`

или repository-conventional equivalent.

Не перегружать foundation spec Step 2.1 всем Step 2.2.

---

# 90. REQUIRED E2E COVERAGE

Минимум:

1. anonymous denied;
2. BUYER/PARTNER denied;
3. SALES_MANAGER operational access;
4. finalized role read matrix;
5. list pagination;
6. filters;
7. sort whitelist;
8. queues;
9. queue/list predicate consistency;
10. KPI zero state;
11. KPI mixed state;
12. KPI period filter;
13. KPI no financial fields;
14. detail projection;
15. history projection;
16. lifecycle actions;
17. Sale close/complete absent;
18. assignment, если implemented;
19. CAS conflict;
20. audit;
21. privacy;
22. no Order/Booking writes;
23. no `OrderRequested`;
24. invalid filters/pagination;
25. aggregate-only role side-channel proof.

---

# 91. UNIT TESTS

Unit tests только для:
- filter/query normalization;
- KPI/read-model pure logic;
- lifecycle/action guard additions;
- RBAC/projection helper;
- date range validation.

Object-scope/RBAC обязательно e2e.

---

# 92. FULL REGRESSION

## Backend

- `npx tsc --noEmit`;
- all unit;
- Step 2.1 foundation e2e;
- new Step 2.2 e2e;
- full serial e2e.

## Frontend

- `npx tsc --noEmit`;
- vitest;
- `next build`.

Frontend не изменяется функционально, но regression обязателен.

## DB

- migrate status;
- clean replay;
- drift.

Skipped/timeouts = explicit.

---

# 93. RUNTIME VERIFICATION

Поднять isolated backend.

Проверить минимум:

- anonymous center endpoint → 401;
- SALES_MANAGER list/queue/KPI;
- action;
- role with aggregate-only access;
- raw detail denial for that role;
- invalid filter;
- Sale complete route absent;
- no Order/Booking side effects;
- requestId/error envelope.

Smoke-data только isolated/test DB.

---

# 94. PERFORMANCE VERIFICATION

На representative generated test data (например 100+ Sales entities):

проверить:
- pagination works;
- no unbounded output;
- KPI reasonable query behavior;
- no obvious N+1.

Не делать benchmark/load platform.

---

# 95. NO FAKE SALES KPI PROOF

Обязательное утверждение в отчёте:

Sales Center KPI не содержит и не выводит:

- Revenue;
- GMV;
- Payment;
- Cash;
- Commission;
- Booking conversion;
- Order conversion,

пока соответствующих canonical facts нет.

---

# 96. NO FAKE ORDER OWNERSHIP PROOF

Обязательное утверждение:

Sales Center не читает/мутирует Order/Booking как собственные operational entities.

Roadmap boundary сохранён.

---

# 97. NO PREMATURE QUOTE FLOW PROOF

Обязательное утверждение:

Step 2.3 не начат:
- no snapshot;
- no money;
- no validity;
- no acceptance;
- no travelers;
- no QuoteItem commercial model, если он owner 2.3.

---

# 98. FINAL IMPLEMENTATION REPORT FORMAT

Вернуть:

# PHASE 2 — STEP 2.2 — SALES CENTER BACKEND — ОТЧЁТ

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target mapping
5. Roadmap scope verification
6. Existing Step 2.1 baseline
7. API architecture
8. List endpoints
9. Detail read models
10. Queues
11. Queue definitions/predicates
12. Filters
13. Search/sort
14. Pagination
15. KPI/read model architecture
16. KPI dictionary
17. KPI source-of-truth
18. Funnel/count semantics
19. Period/temporal semantics
20. Actions
21. Assignment/reassignment
22. History API
23. Audit
24. RBAC final matrix
25. FINANCE/MARKETER/ANALYST review
26. Permission reconciliation
27. Object scope/IDOR
28. DTO/mass-assignment
29. Privacy/projections
30. Cross-domain boundary
31. Order/Booking isolation
32. Quote Step 2.3 boundary
33. Sale Step 2.4 boundary
34. Money/Finance boundary
35. Behavioral boundary
36. Concurrency/CAS
37. Error model
38. ValidationPipe/query validation
39. DB indexes/migration
40. Performance/N+1
41. Unit tests
42. Sales Center E2E
43. Step 2.1 regression
44. Full backend regression
45. Frontend regression
46. Migration replay/drift
47. Runtime verification
48. Docs changes
49. Remaining Step 2.0 prerequisites
50. Roadmap reliability notice
51. Deferred Decisions
52. Issues found/fixed
53. Architecture decision status
54. Out-of-scope confirmation
55. Files changed

---

# 99. ALLOWED FINAL VERDICTS

### Success

`PHASE 2 STEP 2.2 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

### Architecture decision

`ARCHITECTURE DECISION REQUIRED`

### Blocked

`PHASE 2 STEP 2.2 BLOCKED — FOUNDATION GAP`

---

# 100. STOP CONDITION

После Step 2.2:

**НЕ начинать Step 2.3.**
**НЕ начинать Step 2.3A.**
**НЕ выполнять Strict Review самостоятельно.**

Остановиться после implementation report и ждать отдельного review prompt.
