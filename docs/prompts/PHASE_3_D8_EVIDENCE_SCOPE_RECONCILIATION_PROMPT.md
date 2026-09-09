# PHASE 3 — D8 — EVIDENCE & SCOPE RECONCILIATION
## AUDIT-FIRST RECONCILIATION PROMPT

### 0. РЕЖИМ

Это **reconciliation-only** проход после D8 AUDIT-FIRST.

Цель — проверить и скорректировать только findings/scope/evidence D8 audit report.

**Production implementation НЕ выполнять.**

Разрешено:
- читать repository;
- проверять код, schema, tests, docs и Git history;
- перепроверять утверждения исходного D8 audit;
- уточнять классификацию findings;
- уточнять D8 scope;
- создать reconciliation report.

Запрещено:
- production code changes;
- Prisma schema/migration changes;
- DTO/API changes;
- RBAC/permissions changes;
- frontend implementation;
- создание новых roadmap stages;
- изменение Master Plan;
- закрытие D8;
- реализация D8;
- реализация D9/D10/D11/D12/D13/D14;
- самостоятельное исправление найденных дефектов.

При обнаружении реального production/security/schema blocker — **STOP**, только зафиксировать evidence.

---

# 1. ИСХОДНЫЕ ДОКУМЕНТЫ

Обязательные источники:

1. Canonical Master Plan v3.
2. `TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md`.
3. `COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md`.
4. D1–D7 accepted reports/evidence.
5. Исходный D8 audit:
   `docs/reports/PHASE_3_D8_GLOBAL_TEMPORAL_VISIBILITY_AUDIT_FIRST_MAPPING_REPORT.md`
6. Реальный repository HEAD.
7. Existing temporal readiness documentation.
8. Existing tests/e2e/browser evidence.

Не подменять canonical source локальными предположениями.

---

# 2. ОСНОВНАЯ ЗАДАЧА

Перепроверить исходный D8 audit и ответить на четыре вопроса:

```text
A. Что из findings действительно доказано?
B. Что является только documentation/hygiene?
C. Что относится к D8?
D. Что принадлежит D9/D11/Finance/другим tracks?
```

После этого определить **точный D8 implementation boundary**.

---

# 3. КРИТИЧЕСКАЯ RECONCILIATION №1
## "Global Temporal Vocabulary отсутствует"

Исходный audit одновременно утверждает:

```text
"lacks a unified Global Temporal Vocabulary contract"
```

и ссылается на:

```text
docs/architecture/temporal-readiness.md
```

где уже существует taxonomy:

```text
Entity time
Lifecycle time
Service occurrence
Financial time
Event time
Processing time
Presentation period
```

Обязательно проверить фактический документ и классифицировать:

```text
A — vocabulary отсутствует;
B — vocabulary существует, но не является canonical project-wide contract;
C — vocabulary существует и contract уже полностью frozen;
```

Не использовать более сильную формулировку, чем позволяет evidence.

---

# 4. КРИТИЧЕСКАЯ RECONCILIATION №2
## Что означает "Global Temporal Visibility"

Нельзя сводить D8 только к:

```text
date filters
date validation
fmtDate()
documentation
```

Нужно определить semantic decomposition:

```text
Temporal Semantics
    = что означает временной факт

Temporal Authority
    = кто является source of truth

Temporal Filtering
    = по какому temporal dimension фильтруется

Temporal Sorting
    = по какому temporal dimension сортируется

Temporal Presentation
    = как временной факт отображается

Temporal Visibility
    = где и какой temporal dimension доступен пользователю
```

Для каждого определить:
- existing contract;
- implemented;
- documented;
- missing;
- D8 ownership.

---

# 5. ОБЯЗАТЕЛЬНАЯ SURFACE × TEMPORAL MATRIX

Создать полную matrix минимум для:

```text
Requests
Orders
Bookings
Payments
Refunds
CRM Activity
Customer 360
Partner 360
Support
Marketing
Command Center
Analytics
Catalog
Sales
Reverse
Finance capability surfaces
```

Формат:

| Surface | Entity | Primary temporal dimension | Secondary dimensions | Filter | Sort | Display | KPI | URL/state | Server authority | Timezone | D8 ownership |
|---|---|---|---|---|---|---|---|---|---|---|---|

Особое правило:

**Primary temporal dimension ≠ единственный temporal field.**

Например:

```text
Order
primary registry period = createdAt
service occurrence = serviceDate
lifecycle = submittedAt/confirmedAt/...
financial = linked Payment milestone
```

Не объединять эти значения.

---

# 6. ОБЯЗАТЕЛЬНАЯ ENTITY × TEMPORAL MATRIX

Для core commerce:

```text
Request
Order
OrderItem
Booking
Payment
Refund
Dispute
```

Определить:

```text
Temporal fact
Semantic meaning
Authority
Writer
Immutable?
Timezone
Date-only / instant
Presentation
Filtering
Sorting
Aggregation
D8 status
```

---

# 7. RECONCILE B-01

Исходный finding:

```text
Booking upcoming → serviceDate
Operations period → createdAt
```

Проверить, является ли это:

```text
DEFECT
INTENTIONAL DOMAIN DIFFERENCE
DOCUMENTATION GAP
```

Нужно дать evidence.

Не называть defect то, что прямо следует из semantics.

---

# 8. RECONCILE B-02

Command Center:

```text
preset=DAY/WEEK/MONTH/QUARTER/YEAR
```

Operations:

```text
dateFrom/dateTo
```

Проверить:

```text
same semantic contract?
different presentation layer?
different analytical purpose?
competing global authority?
```

Если различие intentional, зафиксировать его как отдельный temporal presentation model, а не как defect.

---

# 9. RECONCILE B-03

CRM:

```text
occurredAt
```

Operations:

```text
createdAt
```

Проверить:

```text
intentional activity-time semantics?
```

Не пытаться унифицировать разные domain concepts.

---

# 10. RECONCILE B-04 / B-05
## DST / Cross-midnight

Обязательно проверить фактическую реализацию:

```text
serviceDate
serviceTime
serviceEndTime
serviceTimeZone
serviceStartsAt
serviceEndsAt
```

Проверить код derivation.

Ответить:

```text
ambiguous local time
nonexistent local time
cross-midnight end
DST transition
```

Но не менять frozen D2.8A contract.

Классификация:

```text
CONTRACT GAP
DOCUMENTATION GAP
REAL CORRECTNESS BUG
NO ISSUE
```

---

# 11. RECONCILE B-06
## Invalid date validation

Это наиболее важный functional finding.

Проверить реально HTTP/API pipeline для:

### Requests
```text
dateFrom invalid
dateTo invalid
both invalid
```

### Orders

### Bookings

### Payments

Дополнительно:

```text
empty string
partial range
reversed range
malformed ISO
timezone-bearing string
date-only string
```

Зафиксировать:

```text
HTTP status
exception
Prisma behavior
response body
test evidence
```

Определить, действительно ли есть inconsistency.

Важно:

Не считать `@IsString()` достаточной date validation.

---

# 12. RECONCILE B-07
## Date-only UTC semantics

Исходная формулировка:

```text
dateFrom = 2026-09-01
→ 2026-09-01T00:00:00Z
```

Проверить canonical contract.

Определить:

```text
date-only UTC calendar semantics
или
user-local calendar semantics
```

Проверить:
- Operations;
- Booking serviceDate;
- Catalog date-only;
- Availability;
- BuyerRequest;
- CommercialPeriod.

Не invent timezone behavior.

---

# 13. RECONCILE B-08 / B-10
## Shared TemporalDisplay

Проверить:

- реально ли `fmtDate()` дублируется;
- где именно;
- есть ли уже shared utility/component, который audit пропустил;
- нужен ли вообще component-level abstraction для D8.

Классифицировать:

```text
MUST
SHOULD
OUT OF SCOPE
NO ISSUE
```

Не превращать style preference в architectural requirement.

---

# 14. RECONCILE B-09
## Orders export

Проверить фактически:

- Orders export;
- Bookings export;
- Payments export;
- filters;
- columns;
- timestamps;
- serviceDate.

Главное:

Определить ownership:

```text
D8 temporal contract
или
D9 Export Framework
```

Не включать D9 implementation в D8 только из-за неполной export-column consistency.

---

# 15. RECONCILE B-11
## Primary temporal dimension

Проверить, имеет ли слово "primary" canonical architectural meaning.

Не вводить новый термин без необходимости.

При необходимости заменить на:

```text
default registry temporal dimension
```

или другой термин, который реально соответствует existing architecture.

---

# 16. TIMEZONE DISPLAY RECONCILIATION

Особенно тщательно проверить исходный тезис:

```text
new Date(isoString).toLocaleDateString(...)
= UTC → locale display
```

Проверить фактический behavior:

```text
Date
toLocaleDateString()
locale
runtime timezone
explicit timeZone option
```

Разделить:

```text
Storage timezone
Business timezone
Display timezone
User/browser timezone
Service occurrence timezone
```

Не смешивать их.

---

# 17. GLOBAL PERIOD RECONCILIATION

Проверить существующие contracts:

### Operations
```text
dateFrom/dateTo
[from,to)
createdAt
server-side
KPI + table
URL
```

### Command Center
```text
preset
dashboard semantics
```

### CRM
```text
occurredAt
```

Построить:

```text
Period Model Matrix
```

и определить:

```text
Canonical
Intentional variation
Undocumented variation
Defect
```

---

# 18. SERVER AUTHORITY RECHECK

Для каждого surface:

```text
UI state
→ HTTP
→ DTO
→ Controller
→ Service/query
→ Prisma
```

Проверить:

- server filtering;
- server aggregation;
- KPI/table scope equivalence;
- URL authority;
- reload/back-forward;
- no client-side dataset filtering.

Особенно проверить не только Operations, но и CRM/analytics surfaces.

---

# 19. TEMPORAL VISIBILITY RECHECK

Определить, что сейчас реально visible пользователю.

Для каждого surface:

```text
Visible temporal facts
Visible in list?
Visible in detail?
Visible in timeline?
Visible in audit?
Filterable?
Sortable?
KPI-enabled?
Exported?
```

Это ключевой gate D8.

---

# 20. SECURITY / TENANT / RBAC RECHECK

Не предполагать, что C17 автоматически закрывает все D8 temporal risks.

Проверить:

```text
date filter
aggregate
KPI
export
search
pagination
cross-tenant
partner own-scope
workspace
```

Проверить, что temporal predicates additive и не заменяют authorization predicate.

---

# 21. PERFORMANCE RECHECK

Проверить только evidence:

- temporal indexes;
- range queries;
- sort;
- aggregate;
- cross-schema detectors;
- SQL functions on indexed columns;
- full scans.

Разделять:

```text
correctness blocker
performance blocker
optimization
out-of-scope
```

Не делать performance implementation.

---

# 22. TEST COVERAGE GAP

Создать matrix:

| Contract | Existing test | Exact behavior proved | Missing evidence | D8 priority |
|---|---|---|---|---|

Особенно:

```text
invalid dates
boundary [from,to)
date-only semantics
timezone
DST
serviceDate vs createdAt
KPI/table equivalence
URL persistence
tenant isolation
export temporal scope
```

---

# 23. FINAL FINDING RECLASSIFICATION

Каждый исходный B- finding должен получить новое состояние:

```text
CONFIRMED DEFECT
CONFIRMED CONTRACT GAP
DOCUMENTATION GAP
INTENTIONAL DIFFERENCE
D9-OWNED
D11-OWNED
FINANCE-OWNED
NO ISSUE / REJECTED
D8 IMPLEMENTATION ITEM
OUT OF SCOPE
```

Нельзя оставлять finding просто потому, что он был в предыдущем отчёте.

---

# 24. D8 IMPLEMENTATION BOUNDARY

После reconciliation определить окончательный scope.

Формат:

## MUST

Только то, что:
- доказано;
- принадлежит D8;
- необходимо для Global Temporal Visibility;
- не дублирует D9/D11/Finance;
- не ломает frozen contracts.

## SHOULD

Полезные улучшения, не blocking.

## OUT OF SCOPE

Не часть D8.

## DEFERRED

Явно принадлежит следующим stages/tracks.

---

# 25. ОСОБЕННОЕ ПРАВИЛО ДЛЯ IMPLEMENTATION PROMPT

В reconciliation report **не создавать implementation prompt автоматически**.

Только указать:

```text
Implementation Prompt = JUSTIFIED / NOT JUSTIFIED
```

и почему.

Implementation prompt создаётся отдельным governance step после принятия reconciliation.

---

# 26. ОБЯЗАТЕЛЬНЫЙ FINAL VERDICT

Допустимы:

### VERDICT A — RECONCILED / IMPLEMENTATION READY

Все существенные findings доказаны, scope bounded, ownership определён.

### VERDICT B — RECONCILED WITH OPEN BLOCKER(S)

Остался конкретный blocker, но D8 остаётся правильным следующим stage.

### VERDICT C — AUDIT INVALID / REWORK REQUIRED

Исходный audit недостаточен или неверно определил D8 scope.

Не использовать VERDICT A только потому, что исходный report был B.

---

# 27. REQUIRED REPORT

Создать только:

```text
docs/reports/PHASE_3_D8_EVIDENCE_SCOPE_RECONCILIATION_REPORT.md
```

Структура:

1. Executive Summary
2. Source Hierarchy
3. Baseline
4. Reconciliation of Original Verdict
5. Global Temporal Vocabulary Reconciliation
6. Temporal Semantics / Authority / Filtering / Sorting / Presentation / Visibility
7. Surface × Temporal Matrix
8. Entity × Temporal Matrix
9. B-01 Reconciliation
10. B-02 Reconciliation
11. B-03 Reconciliation
12. B-04/B-05 Reconciliation
13. B-06 Invalid Date Validation
14. B-07 Date-only Semantics
15. B-08/B-10 Shared Presentation
16. B-09 Export Ownership
17. B-11 Primary Temporal Dimension
18. Timezone / Display Timezone Reconciliation
19. Global Period Model
20. Server Authority
21. Security / Tenant / RBAC
22. Performance
23. Test Coverage
24. Final Reclassified Findings
25. D8 MUST / SHOULD / OUT OF SCOPE / DEFERRED
26. Dependencies
27. Implementation Prompt Decision
28. Final Verdict
29. Git Evidence

---

# 28. GIT RULE

Allowed production changes: **NONE**.

Allowed file:

```text
docs/reports/PHASE_3_D8_EVIDENCE_SCOPE_RECONCILIATION_REPORT.md
```

At final:

```text
BASELINE SHA
FINAL SHA
HEAD == origin/master
tracked clean
untracked artifacts
production diff
```

Do not delete historical artifacts.

---

# 29. FINAL OUTPUT

Return exactly:

```text
D8 EVIDENCE & SCOPE RECONCILIATION

VERDICT: A / B / C

Original Audit Verdict:
Reconciled Verdict:

Global Temporal Vocabulary:
Temporal Visibility contract:
Confirmed defects:
Contract gaps:
Documentation gaps:
Intentional differences:
D9-owned:
D11-owned:
Finance-owned:
Rejected findings:

D8 MUST:
D8 SHOULD:
D8 OUT OF SCOPE:
D8 DEFERRED:

Implementation Prompt:
JUSTIFIED / NOT JUSTIFIED

Blocking issues:

Git:
HEAD == origin/master:
Tracked clean:
Production changes:
Report SHA:
```

**STOP.**

Не выполнять D8 implementation.
Не создавать новый roadmap.
Не изменять Master Plan.
Не менять frozen temporal contracts.
Не менять RBAC/permissions.
Не переходить к D9.
