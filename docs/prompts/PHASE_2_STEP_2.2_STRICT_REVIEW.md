# PHASE 2 — STEP 2.2 — SALES CENTER BACKEND — STRICT REVIEW PROMPT

## 0. Роль и режим

Проведи независимый **STRICT REVIEW PHASE 2 — STEP 2.2 — Sales Center Backend**.

Implementation report считать только заявлением исполнителя, но НЕ доказательством.

Не переходить к Step 2.3 / 2.3A / 2.4.

Если найден локальный подтверждённый дефект Step 2.2 — исправить как REVIEW FIX, добавить targeted regression и повторить full regression.

Если исправление требует изменения bounded-context ownership, commercial semantics, new identity model или фундаментальной access-control architecture — вернуть:

`ARCHITECTURE DECISION REQUIRED`

---

# 1. Canonical Roadmap scope

Сверить Step 2.2 с `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`.

Canonical scope:

> Sales Center Backend — API, queues, filters, KPI/read models, actions, audit, RBAC. Sales не владеет Order/Booking logic.

Подтвердить, что Step 2.2 НЕ начал:
- Step 2.3 Quote & Commercial Offer Flow;
- Step 2.3A Checkout / Commercial Intent;
- Step 2.4 Sale Completion → OrderRequested;
- Order/Booking mutation logic;
- Payment/Finance;
- Subscription/Billing;
- Partner CRM;
- Sales Center UI.

# 2. Repository baseline

Зафиксировать branch, HEAD, git status, actual diff, migrations count, test baseline. Не изменять unrelated user files.

# 3. Step 2.1 baseline verification

Проверить после Strict Review 2.1:
- Lead LED-*;
- Opportunity OPP-*;
- Quote QTE-*;
- Sale SAL-*;
- Sale runtime only OPEN;
- no Sale close/complete action;
- SaleStatus.CLOSED reserved only;
- assignedToId staff-only;
- Lead.name display-only;
- Quote.productId temporary foundation ref;
- no OrderRequested;
- no money;
- no Availability writes;
- no Payment/Subscription.

# 4. Sales Center API inventory

Инвентаризировать фактические routes: list, detail, history, assign/reassign, lifecycle actions, KPI, queues. Построить route→permission matrix.

# 5. API duplication / route consistency

Проверить отсутствие дублирующего API с иной semantics рядом с Step 2.1 routes. Проверить backward compatibility.

# 6. List endpoints

Для Lead/Opportunity/Quote/Sale проверить scoped predicate, filters, sort, pagination, total, hasMore, deterministic ordering, отсутствие unbounded query.

# 7. Pagination strict review

Проверить default page/pageSize, max, >max, page=0, negative, NaN/string, empty, last page, exact boundary, stable ordering, tie-breaker, отсутствие duplicates/missing rows.

# 8. Sort whitelist

Проверить valid/invalid sort keys, direction, secondary sort. Никаких arbitrary Prisma paths/raw SQL fragment.

# 9. Search

Проверить max length, trim/normalization, case-insensitive semantics, parameterization, no regex/raw SQL injection, no PII expansion.

# 10. Date filters

Проверить strict ISO, UTC, from<=to, documented inclusivity/exclusivity, no updatedAt-as-lifecycle.

# 11. Status filters

Проверить enum validation. Sale CLOSED не должен становиться runtime actionable state до Step 2.4.

# 12. Queues inventory

Проверить все заявленные 9 queue keys. Для каждой:
`Queue | Entity | Predicate | Sort | Permission | Pagination`.

# 13. Queue predicate correctness

Проверить inclusion/exclusion, exact statuses, assignment semantics. Queue total и items используют один predicate.

# 14. Queue order

FIFO oldest-first + deterministic tie-breaker + stable pagination.

# 15. Queue authorization

Проверить permission mapping per queue. Роль с доступом к одной entity не должна получить queue другой. Invalid key → 400 before DB.

# 16. KPI inventory

Проверить DTO. Не должно быть Revenue/GMV/Commission/Payment/Paid/Refund/Settlement/Payout/Order conversion/Booking conversion.

# 17. KPI semantics

Для каждого KPI определить source, predicate, timestamp basis, period semantics, denominator, zero-state.

# 18. KPI zero-state

No NaN/Infinity/fabricated ratio.

# 19. KPI/filter consistency

Проверить queue count=list total и status count=filtered list total при одинаковых predicates.

# 20. KPI privacy

Aggregate access не означает raw access. Особо ANALYST/MARKETER. KPI не должен раскрывать customer/product/assignee identities без explicit need.

# 21. Actions inventory

Expected existing lifecycle only:
- Lead qualify/disqualify;
- Opportunity open/won/lost;
- Quote issue;
- Sale — no complete/close.

# 22. Sale Step 2.4 boundary

Доказать:
- no Sale close endpoint;
- no OrderRequested;
- no completion timestamp;
- no hidden consumer;
- CLOSED unreachable by current API.

# 23. Assignment action

Проверить staff-only target, unassign, CAS/version, history, audit, actor, 409 stale, BUYER/PARTNER/MODERATOR rejected.

# 24. Assignment role validation

Проверить server-side canonical User read, unknown/deactivated/invalid user semantics.

# 25. Assignment history

History обязана сохранять previous assignee, new assignee, actor, timestamp. Если этого нет — review finding.

# 26. Assignment ≠ authorization scope

assignedToId не должен становиться implicit authority без Roadmap contract.

# 27. Lifecycle CAS

Проверить expected version, update, milestone/history/audit atomicity. Failed CAS не создаёт side effects.

# 28. Audit

Проверить lifecycle/assignment/business edits. Audit minimal, no body/PII, actor/correlation server-derived.

# 29. History API

Проверить pagination, order, actor safe projection, no raw AuditLog/User/CRM, immutable facts.

# 30. RBAC — critical independent review

Проверить actual permission constants/mappings/reconciliation. Не доверять заявлению:
- sales.kpi.read;
- SALES_MANAGER/DIRECTOR/ADMIN/FINANCE/ANALYST/MARKETER KPI;
- ANALYST/MARKETER raw revoked;
- FINANCE only sale.read;
- BUYER/PARTNER/MODERATOR 403.

# 31. Least-privilege role review

Проверить business need для SALES_MANAGER, DIRECTOR, ADMIN, FINANCE, ANALYST, MARKETER, OPERATOR, MODERATOR, BUYER, PARTNER.

Особенно FINANCE raw Sale read: если money ещё нет, объяснить необходимость.

# 32. DYNAMIC ACCESS / CAPABILITY MODEL READINESS — MANDATORY

TravelHub должен поддерживать малые организации, где один сотрудник одновременно работает с Customers, Sales, Suppliers, Orders, Bookings, Communications и позже Finance/Documents.

Проверить, что Step 2.2 НЕ hardcode'ит authorization через role names.

Backend authority должна быть permission/capability-based. System roles — presets, а не постоянные organizational boundaries.

# 33. Permission vs role hardcoding search

Repo-wide найти:
- `role === SALES_MANAGER`;
- switch(role);
- role-name gating;
- другие direct role checks в Sales Center.

Operational authorization должен использовать permissions.

# 34. Capability-ready principle

Зафиксировать в docs:

> System roles are permission presets, not permanent organizational job boundaries. Один internal user архитектурно может иметь capabilities нескольких work centers.

Full admin UI не реализовывать в 2.2.

# 35. ADMIN future configurability readiness

Ответить:
1. Permissions существуют независимо от role names?
2. User-permission mappings возможны?
3. Guard проверяет permissions?
4. Controllers используют @RequirePermissions?
5. Можно ли дать user capability без переписывания Sales code?

Если нет — architecture gap.

# 36. Sidebar/navigation contract readiness

Frontend не реализуется сейчас, но будущая sidebar visibility должна быть permission-driven, не role-driven. Backend permission checks authoritative; скрытие меню ≠ security.

# 37. Roadmap amendment recommendation

Зафиксировать будущий **Organization Capability & Navigation Access Model**:
- roles = presets;
- per-user capabilities;
- organization-defined access;
- sidebar from capabilities;
- backend permissions authoritative;
- для small organizations один сотрудник может совмещать несколько функций;
- admin UI — future Users & Access step.

Не перенумеровывать Roadmap вслепую; выбрать свободный suffix после сверки 3.12A–D.

# 38. Permission reconciliation

Fresh boot + repeated boot: stale grants revoked, no re-add, no duplicates.

# 39. Aggregate-only side-channel proof

ANALYST/MARKETER aggregate-only не должны получать raw data через list/detail/queue/history/filter/error/total.

# 40. FINANCE projection review

Если FINANCE читает Sale, проверить exact projection и необходимость. No Lead/Opportunity/Quote/Customer CRM/Product internals.

# 41. Object scope / IDOR

Проверить code guessing, filters, assignment, no CRM/Catalog escalation, consistent unknown-code semantics.

# 42. DTO/mass assignment

Проверить id/code/status/version abuse/createdAt/updatedAt/lifecycle/actor/createdById/requestId/correlationId/causationId/arbitrary nested JSON.

# 43. ValidationPipe

Shared whitelist+transform, без implicitConversion regression. Query conversions explicit.

# 44. Privacy projections

No customer email/phone, CRM notes/tags, raw User/auth, Product internals, AuditLog, correlation internals.

# 45. Cross-domain write proof

Sales module не пишет CRM/Catalog/Order/Booking/Availability/Finance/Security business data.

# 46. Order/Booking isolation

После Sales actions Order/Booking counts unchanged; no OrderRequested/OrderCreated.

# 47. Quote Step 2.3 boundary

No QuoteItem commercial model, price, currency, discount, tax, validity, travelers, acceptance, snapshot.

# 48. Money/Finance boundary

No money fields and no financial KPI.

# 49. Behavioral boundary

Sales KPI/queues не синтезируют Leads/Sales из Marketplace/Storefront behavioral events.

# 50. Outbox boundary

No speculative Sales events/critical async chain. Reliability prerequisite remains before 2.4/2.5.

# 51. Index review

Проверить migration `add_sales_center_indexes`: 6 composite indexes соответствуют реальным query patterns, не redundant.

# 52. N+1 / query shape

Проверить list/queue/KPI/history/display labels. No query-per-row; labels batch or omitted.

# 53. KPI query efficiency

DB aggregate/count, period pushed down; no fetch-all in memory.

# 54. Queue query efficiency

DB-side pagination/total, no fetch-all+slice.

# 55. Shared-DB flake fix review

Проверить изменение Step 1.18 outbox failure injection test:
- не скрывает ли product bug;
- не зависит ли от order specs;
- безопасно ли cleanup удаляет чужие PENDING/FAILED;
- standalone/full suite semantics same.

# 56. Test isolation

Sales Center e2e не должен зависеть от previous spec execution order.

# 57. Sales Center e2e quality

Прочитать реальные 12 tests; убедиться, что assertions через HTTP/DB и реально покрывают заявленное.

# 58. Missing test detection

Добавить targeted tests при gap:
- capability readiness;
- aggregate-only side channels;
- FINANCE raw access;
- queue total consistency;
- pagination tie-break;
- invalid filters;
- Sale close absent;
- assignment history.

# 59. Concurrency

Step 2.1 code generation regression + concurrent assignment/lifecycle CAS.

# 60. Error model

400/401/403/404/409/422/500 + X-Request-Id/body requestId + no stack/Prisma/SQL.

# 61. Runtime verification

Independent isolated runtime:
- anonymous KPI 401;
- SALES_MANAGER operational;
- ANALYST/MARKETER KPI only;
- raw denied;
- FINANCE exact access;
- BUYER denied;
- invalid queue;
- Sale complete absent;
- no Order/Booking effects.

# 62. Migration replay/drift

migrate status, clean replay, diff/no drift, exact migration count.

# 63. Full regression

Backend: tsc, unit, Step2.1 e2e, Step2.2 e2e, full serial e2e.
Frontend: tsc, vitest, next build.
No skipped/timeouts silently counted as pass.

# 64. Documentation review

`sales-center-backend.md` должен описывать APIs, queues, filters, KPI, permissions, capability boundary, assignment, pagination, privacy, non-goals.

# 65. Roadmap / access-model amendment artifact

Обновить Roadmap/Deferred Decisions/architecture note так, чтобы было явно зафиксировано:

**Organization Capability & Navigation Access Model**
- small organizations may have one employee spanning multiple functions;
- roles are presets;
- permissions/capabilities are actual authority;
- per-user capability assignment supported architecturally;
- sidebar permission-driven;
- backend permission checks authoritative;
- admin management UI deferred to Users & Access completion.

Не реализовывать admin UI сейчас.

# 66. Remaining Step 2.0 prerequisites

Подтвердить открытыми:
1. Outbox retry — before 2.4/2.5.
2. Booking currency — before 2.8.
3. Monetary contract — before 2.3A/2.4.
4. Availability reservation/locking — before 2.3A/2.4.
5. Commercial snapshot — before 2.5.
6. /orders/bootstrap removal — 2.6.
7. Payment/PSP/ledger — 2.10C/2.12.
8. Supplier lifecycle — 2.8.
9. Checkout/payment idempotency — 2.10.

# 67. Reliability sequencing

Step 2.17 later than 2.4/2.5 dependency. Не исправлять автоматически, но gate не потерять.

# 68. Deferred Decisions

No accidental multilingual/AI translation/Storefront subscription/Partner CRM/custom domains/commission/retention/capability-admin UI implementation.

# 69. Finding classification

CRITICAL: unauthorized access/PII/cross-domain corruption.
HIGH: RBAC/capability hardcoding/lifecycle bypass/Order-Booking ownership violation.
MEDIUM: pagination/filter/KPI side-channel/audit-history/query correctness.
LOW: docs/test robustness.

Для каждого: reproduction, root cause, impact, fix, tests.

# 70. Review fix policy

Local defects исправлять сейчас.
Не реализовывать Step 2.3/2.4/Users&Access admin UI.

# 71. Architecture decision triggers

`ARCHITECTURE DECISION REQUIRED` если нужен новый owner, Prospect identity, commercial lifecycle, Quote redesign now, Sale completion semantics now, organization/team identity model, wholesale RBAC replacement.

# 72. Required explicit answers

Ответить явно:
1. Scope соблюдён?
2. Lists bounded?
3. Filters/sort safe?
4. Queues correct?
5. KPI honest?
6. No financial KPI?
7. Sale complete absent?
8. Assignment CAS/history correct?
9. RBAC least-privilege?
10. ANALYST/MARKETER aggregate-only enforced?
11. FINANCE Sale read justified?
12. BUYER/PARTNER/MODERATOR denied?
13. Backend uses permissions, not hardcoded roles?
14. One future employee can hold multiple work-center capabilities without Sales refactor?
15. Sidebar can be permission-driven?
16. Reconciliation revokes stale grants?
17. No PII leak?
18. No cross-domain writes?
19. No Order/Booking effects?
20. No premature Quote flow?
21. No money/Payment/Subscription creep?
22. Migration clean?
23. Full regression green?
24. Shared-test cleanup safe?
25. Capability-model roadmap amendment recorded?
26. Any blockers?
27. Architecture decision required?
28. Approve Step2.2?
29. Proceed to Step2.3 after approval?

# 73. Final report format

Return:

# PHASE 2 — STEP 2.2 — STRICT REVIEW — ОТЧЁТ

1. Verdict
2. Repository baseline
3. Files/modules inspected
4. Roadmap scope verification
5. Step 2.1 baseline verification
6. API inventory
7. List endpoints
8. Pagination
9. Sorting/search
10. Date/status filters
11. Queues
12. Queue predicate/order
13. KPI inventory
14. KPI semantics/privacy
15. KPI/list/queue consistency
16. Actions
17. Sale Step 2.4 boundary
18. Assignment/reassignment
19. Assignment history
20. Lifecycle/CAS
21. Audit
22. History API
23. RBAC matrix
24. Least-privilege review
25. Dynamic access/capability readiness
26. Role-hardcoding audit
27. ADMIN future configurability readiness
28. Navigation/sidebar contract readiness
29. Permission reconciliation
30. Aggregate-only side-channel tests
31. FINANCE access review
32. Object scope/IDOR
33. DTO/mass-assignment
34. ValidationPipe
35. Privacy/projections
36. Cross-domain write proof
37. Order/Booking isolation
38. Quote Step 2.3 boundary
39. Money/Finance boundary
40. Behavioral boundary
41. Outbox/reliability boundary
42. Index review
43. Performance/N+1
44. Shared-test flake fix review
45. Test isolation
46. Sales Center E2E quality
47. Concurrency
48. Error model
49. Runtime verification
50. Migration replay/drift
51. Full regression
52. Documentation review
53. Capability/Navigation roadmap amendment
54. Remaining Step 2.0 prerequisites
55. Reliability sequencing notice
56. Deferred Decisions compliance
57. Confirmed findings
58. Review fixes
59. Remaining debt
60. Architecture decision status
61. Approval recommendation
62. Out-of-scope confirmation
63. Files changed during review

# 74. Allowed verdicts

`PHASE 2 STEP 2.2 STRICT REVIEW COMPLETED — APPROVED`

или

`PHASE 2 STEP 2.2 REVIEW FIXES COMPLETED — WAITING FOR APPROVAL`

или

`ARCHITECTURE DECISION REQUIRED`

или

`PHASE 2 STEP 2.2 STRICT REVIEW FAILED — BLOCKER FOUND`

# 75. Stop condition

После Strict Review НЕ начинать Step 2.3 / 2.3A. Вернуть report и ждать explicit approval.
