# PHASE 3 — D8 — GLOBAL TEMPORAL VISIBILITY
## AUDIT-FIRST MAPPING & QUALIFICATION PROMPT

### 0. Режим выполнения

Это **AUDIT-FIRST** проход.

В этом проходе запрещено выполнять production implementation.

Разрешено:
- исследовать repository;
- исследовать Prisma schema/migrations;
- исследовать backend services/controllers/DTOs/guards;
- исследовать frontend pages/components/API clients;
- исследовать существующие temporal/date/time contracts;
- исследовать тесты и committed evidence;
- сопоставлять фактическую реализацию с каноническим Master Plan v3 и уже принятыми D-track решениями;
- подготовить audit report.

Запрещено до отдельного approval:
- production code changes;
- schema/migration changes;
- DTO/API contract changes;
- frontend implementation;
- RBAC changes;
- permissions changes;
- lifecycle changes;
- изменение Finance Center;
- изменение D9/D10/D11/D12/D13/D14;
- создание новых roadmap stages;
- изменение Master Plan;
- закрытие D8;
- реализация найденных gaps.

При неожиданном domain/schema/security scope или необходимости изменить ранее frozen contract — **STOP** и зафиксировать блокер.

---

# 1. КАНОНИЧЕСКАЯ ПОЗИЦИЯ D8

Источник истины: **TravelHub — CANONICAL MASTER IMPLEMENTATION PLAN v3**.

На текущий момент:

```text
D0  Reconciliation Final Git/Evidence Closure       ✅
D1  Commerce Lifecycle Contract Finalization         ✅
D1A Platform CRM Scope Isolation                     ✅
D2  Product Traveler Requirements                    ✅
D3  Traveler Collection + Population                 ✅
D4  Traveler Security + Representative Data          ✅
D4-REM Strict Review Remediation                     ✅
D5  Orders Full-Page Detail                          ✅
D6  Bookings Full-Page Detail                        ✅
D7  Payment/Refund Semantics + Financial Presentation ✅
D8  Global Temporal Visibility                       ⬜ NOT STARTED
D9  Export Framework Requalification                 ⬜
D10 Partner Performance Attribution                   ⬜
D11 Project-Wide KPI/Status Semantics                ⬜
D12 CRM/KPI Drill-down Routing                       ⬜
D13 Voucher                                          ⬜
D14 PRE-STEP 3.12 Final Requalification              ⬜
```

**TRUE NEXT = D8 — GLOBAL TEMPORAL VISIBILITY.**

D8 должен быть исследован как самостоятельный canonical D-track stage.

Не выводить следующий этап самостоятельно. Следующий stage определяется Master Plan + результатом D8 qualification.

---

# 2. ЦЕЛЬ AUDIT

Определить, что именно означает **Global Temporal Visibility** в фактической архитектуре TravelHub и насколько repository уже готов к реализации D8.

Нужно установить:

1. какие temporal facts уже существуют;
2. какие даты являются business dates;
3. какие даты являются technical timestamps;
4. какие temporal concepts уже frozen предыдущими этапами;
5. какие domains уже имеют canonical temporal contracts;
6. какие UI surfaces должны отображать temporal information;
7. какие списки/detail pages/exports/KPI используют даты;
8. где дата выбирается frontend-ом, а где server/backend является authority;
9. какие filters/sorting/period controls уже существуют;
10. где есть local timezone / UTC / date-only / time-slot semantics;
11. какие temporal gaps реально существуют;
12. какие из них относятся именно к D8;
13. какие являются deferred/out-of-scope других stages;
14. какие dependencies D8 имеет;
15. существует ли production implementation, частичная implementation или только architecture intent.

---

# 3. ОСНОВНОЙ ПРИНЦИП

Нельзя трактовать D8 как простой UI date filter.

Необходимо исследовать temporal visibility как **project-wide contract**.

Разделить минимум:

```text
Technical time
    createdAt
    updatedAt
    audit timestamps

Business milestones
    requestedAt
    confirmedAt
    rejectedAt
    cancelledAt
    completedAt
    accepted/confirmed milestones
    payment milestones
    fulfillment milestones

Service occurrence
    serviceDate
    serviceTime
    serviceEndTime
    serviceTimeZone
    serviceStartsAt
    serviceEndsAt

Deadlines / SLA
    customerActionDeadline
    supplier/customer response deadlines
    SLA derived from canonical milestones/history

Financial time
    payment/refund/settlement/payout/ledger occurrence times

Presentation period
    selected date/range
    KPI period
    table filter period
```

Для каждого факта определить owner и authority.

---

# 4. ОБЯЗАТЕЛЬНЫЙ INVENTORY

Провести repository-wide audit.

Минимальные области:

## 4.1 Prisma schema

Inventory всех полей:

- DateTime;
- Date;
- time strings;
- timezone fields;
- nullable temporal fields;
- history timestamps;
- deadline fields;
- snapshot temporal fields.

Для каждого:

```text
Entity
Field
Type
Nullable
Default
Writer
Business meaning
Technical meaning
Timezone semantics
Immutable/mutable
Lifecycle owner
Evidence
```

Особенно проверить:

- Request;
- Quote;
- CheckoutIntent;
- Sale;
- Order;
- OrderItem;
- Booking;
- Passenger/Traveler;
- Payment;
- Refund;
- Settlement;
- Payout;
- LedgerTransaction;
- OperationalNote;
- Audit/History;
- CRM;
- Support;
- Marketing;
- Communication.

Не предполагать, что наличие DateTime автоматически означает business date.

---

# 5. ИССЛЕДОВАТЬ УЖЕ FROZEN TEMPORAL CONTRACTS

Обязательно проверить существующие accepted contracts.

Минимум:

### Step 2.5A
Order temporal milestones.

### Step 2.8A
Booking Service Date / Time Model:

```text
serviceDate
serviceTime
serviceEndTime
serviceTimeZone
serviceStartsAt
serviceEndsAt
```

Authority:

```text
Product.serviceTimeZone
        ↓
frozen in CheckoutIntent
        ↓
propagated downstream
```

Не создавать альтернативную timezone authority.

### Step 2.9A
Booking lifecycle milestones.

### Step 2.10C
Finance temporal contract / Ledger `occurredAt`.

### Step 2.12
Payment lifecycle milestones.

### Step 2.13 / Refund
Проверить фактически реализованные temporal facts и frozen semantics.

### D1
Commerce lifecycle canonical contract.

### D2/D3/D4
Traveler acceptance/snapshot timing.

### D5/D6
Order/Booking detail temporal presentation and audit framework.

---

# 6. TEMPORAL AUTHORITY MATRIX

Создать полную матрицу:

| Domain | Fact | Source of truth | Writer | Immutable? | Timezone | UI usage | D8 status |
|---|---|---|---|---|---|---|---|

Классификация D8:

```text
EXISTING_CANONICAL
READY_FOR_D8_PRESENTATION
MISSING_D8_CONTRACT
OUT_OF_SCOPE
DEFERRED_TO_LATER_STAGE
LEGACY/COMPETING
```

Особенно запрещено объявлять gap только потому, что поле отсутствует, если его owner сознательно deferred.

---

# 7. GLOBAL TEMPORAL VOCABULARY

Определить существующий canonical vocabulary.

Проверить различия:

```text
instant
date-only
local time
timezone
date range
deadline
period
createdAt
updatedAt
occurredAt
business milestone
derived SLA
```

Проверить отсутствие опасных смешений:

```text
createdAt ≠ serviceDate
updatedAt ≠ business milestone
browser timezone ≠ business timezone authority
locale ≠ timezone
display period ≠ entity business date
```

Особенно проверить frontend:

- `new Date()` для business semantics;
- browser timezone;
- locale-based date conversion;
- client-side date filtering;
- `CURRENT_DATE`;
- implicit server timezone;
- manual offset arithmetic;
- date-only → midnight assumptions.

Все findings должны иметь evidence.

---

# 8. GLOBAL PERIOD / DATE FILTER AUDIT

Исследовать существующие global period controls.

Особенно:

- Operations Center;
- Requests;
- Orders;
- Bookings;
- Payments;
- Analytics;
- Command Center;
- CRM;
- Marketing;
- Support;
- future Finance surfaces.

Для каждого определить:

```text
Filter name
Scope
Input format
Authority
Backend parameter
Server-side filtering?
KPI impact?
Table impact?
URL state?
Reload/popstate?
Timezone semantics?
Default period?
```

Отдельно проверить уже canonical Operations Center semantics:

```text
Header Period = GLOBAL

Period affects:
- KPI overview
- table dataset

KPI click = table-only dimension
Total = clear KPI/table-only dimension
```

Не ломать эти semantics и не создавать вторую period authority.

---

# 9. ENTITY-SPECIFIC DATE SEMANTICS

Для каждого core entity определить canonical temporal dimension.

Минимум:

### Request
Какая дата означает:
- created;
- requested;
- supplier action;
- customer action;
- conversion;
- expiration;
- cancellation.

### Order
Какая дата означает:
- created;
- requested;
- confirmed;
- fulfillment;
- closed;
- cancellation.

### Booking
Какая дата означает:
- requested;
- supplier processing;
- confirmation;
- fulfillment;
- cancellation;
- service occurrence.

### Payment
Какая дата означает:
- created;
- captured;
- failed;
- cancelled;
- occurred/recorded.

### Refund
Какая дата означает:
- requested;
- approved;
- processed;
- failed.

Не invent-ить поля. Если поле отсутствует — проверить architecture contract и stage ownership.

---

# 10. LIST / DETAIL / TIMELINE / AUDIT

Проверить temporal presentation отдельно:

```text
List/table
Detail header
Detail cards
Timeline
Audit history
KPI
Filters
Exports
Search
```

Ключевой принцип:

```text
Timeline ≠ Audit History
Business milestone ≠ technical timestamp
```

Проверить, что D8 не дублирует уже реализованные timeline/audit contracts D5/D6.

---

# 11. BACKEND AUTHORITY

Для каждого temporal filter найти:

```text
Frontend request
    ↓
Controller
    ↓
DTO / validation
    ↓
Service/query
    ↓
Prisma query
    ↓
Temporal predicate
```

Определить:

- server-side authority;
- validation;
- inclusive/exclusive boundary;
- UTC conversion;
- date-only semantics;
- timezone authority;
- invalid date behavior;
- malformed input status;
- empty range;
- partial range;
- reversed range;
- DST behavior where applicable.

Особенно проверить отсутствие:

```text
frontend filters full dataset
frontend derives KPI date counts
frontend applies local timezone silently
```

---

# 12. CROSS-DOMAIN CONSISTENCY

Проверить одинаковые temporal concepts между:

```text
Request → Order → Booking → Payment
```

и:

```text
Customer / CRM
Support
Marketing
Analytics
Operations
Finance
```

Найти competing names/semantics.

Для каждого расхождения:

```text
REAL DEFECT
DOCUMENTATION DRIFT
LEGACY
INTENTIONAL DOMAIN DIFFERENCE
DEFERRED
```

Не объединять разные business concepts только ради одинакового имени.

---

# 13. TIMEZONE / DST SECURITY & CORRECTNESS

Обязательный adversarial audit.

Проверить:

- UTC storage;
- IANA timezone;
- date-only;
- DST ambiguous time;
- DST nonexistent time;
- leap day;
- month/year boundaries;
- offset formats;
- malformed timezone;
- forged timezone;
- client/server timezone disagreement;
- daylight-saving transition;
- inclusive end boundary;
- cross-midnight service.

Особенно проверить уже frozen Step 2.8A contract и не создавать альтернативную интерпретацию.

---

# 14. TEMPORAL SECURITY

Проверить:

- RBAC;
- tenant/workspace scope;
- cross-tenant temporal queries;
- IDOR через date filters;
- pagination + date filter;
- exports + date filter;
- search + date filter;
- aggregate/KPI leakage;
- unauthorized historical visibility.

Temporal filter не должен становиться способом обойти entity authorization.

---

# 15. PERFORMANCE / QUERY SHAPE

Audit-only.

Проверить:

- indexes supporting temporal predicates;
- range queries;
- sorting by DateTime;
- pagination;
- aggregate queries;
- N+1;
- full-table scans;
- functions applied to indexed columns;
- timezone conversions inside SQL;
- date truncation;
- large historical ranges.

Не добавлять индексы в этом проходе.

Только классифицировать:

```text
SAFE
OPTIMIZATION
BLOCKER
DEFERRED
```

---

# 16. FRONTEND AUDIT

Проверить:

- date pickers;
- period controls;
- table filters;
- URL query params;
- local state;
- serialization;
- parsing;
- locale formatting;
- timezone formatting;
- empty states;
- loading;
- invalid range;
- accessibility;
- RU/AZ/EN;
- responsive behavior.

Отдельно найти любые места, где frontend определяет business date semantics.

---

# 17. EXPORTS

Проверить:

- Orders export;
- Bookings export;
- Payments export;
- CRM exports;
- future exports.

Для каждого:

```text
Temporal field
Meaning
Timezone
Format
Filter source
Server authority
Consistency with UI
```

D9 остаётся отдельным stage. Не реализовывать D9.

---

# 18. ANALYTICS / KPI

Проверить, какие temporal dimensions используют:

- Command Center;
- Analytics;
- CRM Analytics;
- Marketing;
- Operations KPIs.

Особенно проверить:

```text
createdAt-based metric
business-date-based metric
service-date-based metric
payment-date-based metric
period filter
comparison period
```

Не считать их взаимозаменяемыми.

Если metric semantics не определена — это finding, а не повод самостоятельно придумать формулу.

---

# 19. MASTER PLAN DEPENDENCIES

Проверить D8 относительно:

```text
D7 completed
D8 current
D9 future
D10 future
D11 future
D12 future
D13 future
D14 final requalification
```

Отдельно проверить deferred tracks:

- Finance Center;
- Product Freshness;
- 2.17B Load/Performance;
- 2.18 Financial Integrity Exit Gate;
- PROD-01;
- другие Master Debt Register items.

Не перетаскивать их автоматически в D8.

---

# 20. DEBT REGISTER RECONCILIATION

Проверить существующие debts, которые могут intersect D8.

Для каждого:

```text
Debt ID
Current status
D8 relevance
Blocking?
Owner stage
Evidence
```

Не закрывать debt автоматически.

Не менять Debt Register в audit-only проходе.

---

# 21. TEST / EVIDENCE AUDIT

Inventory existing temporal tests:

- unit;
- e2e;
- integration;
- frontend;
- browser/runtime;
- migration/drift;
- security;
- concurrency;
- DST/timezone.

Для каждого:

```text
Test
What it proves
What it does not prove
Current status
D8 relevance
```

Не считать наличие теста доказательством более широкого контракта, чем он реально проверяет.

---

# 22. REQUIRED GAP MATRIX

Финальный gap matrix:

| ID | Finding | Domain | Evidence | Severity | D8? | Dependency | Recommended disposition |
|---|---|---|---|---|---|---|---|

Severity:

```text
P0 — security/data-integrity blocker
P1 — architectural/contract blocker
P2 — correctness/UX issue
P3 — documentation/hygiene/optimization
```

---

# 23. REQUIRED D8 SCOPE PROPOSAL

После audit сформировать **только предложение**, не implementation.

Разделить:

### MUST
Необходимые для D8 hard gates.

### SHOULD
Полезные, но не blocking.

### OUT OF SCOPE
Что не должно попасть в D8.

### DEFERRED
Что принадлежит D9+ или отдельному track.

---

# 24. STOP CONDITIONS

Немедленно STOP и зафиксировать finding, если обнаружено:

1. competing timezone authority;
2. frontend-owned business temporal authority;
3. cross-tenant temporal leakage;
4. temporal filter bypassing authorization;
5. mutation of frozen temporal facts;
6. conflicting canonical lifecycle milestone;
7. undocumented alternate temporal contract;
8. schema change required beyond D8 scope;
9. dependency on unfinished architecture decision;
10. необходимость менять D9/D10/D11/D12/D13/D14 contract.

Не «чинить по пути».

---

# 25. FINAL AUDIT VERDICT

Допустимые результаты:

### VERDICT A — AUDIT READY
D8 contract sufficiently defined, dependencies understood, implementation scope bounded.

### VERDICT B — AUDIT READY WITH BLOCKERS
D8 is the correct next stage, but specific architecture/correctness/security blockers must be resolved before implementation.

### VERDICT C — NOT READY
D8 depends on unresolved architecture or a prerequisite that must become a separate decision/stage.

Не выбирать A только потому, что D8 указан TRUE NEXT в Master Plan.

---

# 26. REQUIRED REPORT

Создать только:

```text
docs/reports/PHASE_3_D8_GLOBAL_TEMPORAL_VISIBILITY_AUDIT_FIRST_MAPPING_REPORT.md
```

Report должен содержать:

1. Executive Summary
2. Canonical D8 Position
3. Repository Baseline
4. Temporal Vocabulary
5. Temporal Authority Matrix
6. Existing Contracts
7. Request Temporal Audit
8. Order Temporal Audit
9. Booking Temporal Audit
10. Payment/Refund Temporal Audit
11. Finance Temporal Audit
12. CRM/Support/Marketing/Analytics Audit
13. Global Period Audit
14. Timezone/DST Audit
15. Backend Authority Audit
16. Frontend Authority Audit
17. Export Audit
18. Security/Tenant Audit
19. Performance/Query Audit
20. Test/Evidence Audit
21. Gap Matrix
22. Debt Reconciliation
23. D8 MUST/SHOULD/OUT-OF-SCOPE
24. Dependencies
25. Stop Conditions
26. Final Verdict
27. Recommended next implementation prompt scope

---

# 27. GIT RULE

Audit-only.

Production source must remain unchanged.

Allowed change:

```text
docs/reports/PHASE_3_D8_GLOBAL_TEMPORAL_VISIBILITY_AUDIT_FIRST_MAPPING_REPORT.md
```

Do not modify:

- Prisma schema;
- migrations;
- backend source;
- frontend source;
- tests;
- permissions;
- RBAC;
- roadmap;
- Master Plan;
- architecture contracts,

unless an unexpected repository inconsistency requires STOP documentation; even then do not fix it.

At completion report:

```text
BASELINE SHA
FINAL SHA
HEAD == origin/master
TRACKED WORKTREE
UNTRACKED ARTIFACTS
PRODUCTION DIFF
REPORT PATH
```

Do not silently delete historical artifacts.

---

# 28. FINAL OUTPUT FORMAT

Return:

```text
D8 AUDIT-FIRST
VERDICT: A / B / C

Baseline SHA:
Final SHA:

Temporal contracts audited:
Domains audited:
Global period surfaces audited:
Timezone/DST checks:
Security checks:
Performance checks:
Tests/evidence reviewed:

P0:
P1:
P2:
P3:

D8 MUST:
D8 SHOULD:
D8 OUT OF SCOPE:
D8 DEFERRED:

Blocking dependencies:
Recommended next step:

GIT:
HEAD == origin/master:
Tracked clean:
Production changes:
```

**IMPORTANT:**

Do not implement D8 in this pass.

Do not create D8 implementation prompt unless the audit itself proves that an implementation prompt is the correct next artifact.

Do not invent temporal semantics.

Do not override the canonical Master Plan v3.

STOP after the audit report is complete.
