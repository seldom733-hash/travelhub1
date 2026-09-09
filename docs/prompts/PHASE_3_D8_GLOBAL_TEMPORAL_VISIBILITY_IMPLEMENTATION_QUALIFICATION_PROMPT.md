# PHASE 3 — D8 — GLOBAL TEMPORAL VISIBILITY
## IMPLEMENTATION & QUALIFICATION PROMPT

### 0. GOVERNANCE STATUS

Предыдущие governance stages завершены:

```text
Documentation Governance Cleanup = CLOSED
TRUE NEXT = D8 — GLOBAL TEMPORAL VISIBILITY
Canonical Roadmap = docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
Canonical Architecture = docs/architecture/TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md
Git HEAD = 203ea53
HEAD == origin/master = YES
Tracked clean = YES
Untracked = NONE
Production changes before D8 = NONE
```

D8 был:
- audit-first reviewed;
- evidence/scope reconciled;
- final correction pass completed;
- implementation boundary determined.

Теперь разрешена **D8 implementation**, но только в пределах данного контракта.

Не создавать новую roadmap.
Не менять canonical roadmap.
Не изобретать новый temporal model.
Не переоткрывать закрытые C/D stages.

---

# 1. D8 OBJECTIVE

Реализовать и закрепить **Global Temporal Visibility** как project-wide canonical visibility contract поверх уже существующих temporal foundations.

D8 НЕ должен:
- создавать новую систему временных данных;
- создавать новые бизнес-временные поля;
- менять frozen lifecycle milestones;
- менять service-time authority;
- менять RBAC model;
- реализовывать D9/D10/D11/D12/D13/D14;
- начинать Finance Center;
- решать Product/Service Model.

D8 должен прежде всего:

```text
existing temporal semantics
        +
existing temporal authority
        +
existing filtering/presentation
        ↓
canonical project-wide visibility contract
        +
targeted validation hardening
```

---

# 2. CANONICAL TEMPORAL LAYERS

Не смешивать:

```text
Entity time
    createdAt / updatedAt

Lifecycle time
    submittedAt / confirmedAt / cancelledAt / fulfilledAt / closedAt
    requestedAt / rejectedAt / completedAt / approvedAt / processedAt
    etc.

Service occurrence
    serviceDate
    serviceTime
    serviceEndTime
    serviceTimeZone
    serviceStartsAt
    serviceEndsAt

Financial time
    occurredAt
    paidAt
    failedAt
    cancelledAt
    requestedAt
    approvedAt
    processedAt

Event time
    behavioral/event occurredAt

Processing time
    receivedAt / publishedAt / processedAt

Presentation period
    dateFrom / dateTo
    period presets
```

`createdAt` НЕ равен `serviceDate`.
`createdAt` НЕ равен business milestone.
`updatedAt` НЕ равен lifecycle transition.
`occurredAt` НЕ равен `createdAt`.

---

# 3. FROZEN CONTRACTS — DO NOT CHANGE

### Order lifecycle — D2.5A

```text
submittedAt
confirmedAt
cancelledAt
fulfilledAt
closedAt
```

### Booking service time — D2.8A

```text
serviceDate
serviceTime
serviceEndTime
serviceTimeZone
serviceStartsAt
serviceEndsAt
serviceTimeType
```

Authority:

```text
Product.serviceTimeZone
    ↓
CheckoutIntent
    ↓
Order
    ↓
Booking
```

### Booking lifecycle — D2.9A

```text
requestedAt
confirmedAt
rejectedAt
cancelledAt
completedAt
```

### Finance temporal contract — D2.10C / D2.12 / D2.13

Payment/Refund/Dispute lifecycle milestones and `LedgerTransaction.occurredAt`.

### D3/D4

```text
termsAcceptedAt
travelerDataCompletedAt
finalConfirmedAt
```

Не менять semantics этих contracts.

---

# 4. D8 MUST #1
## CANONICAL GLOBAL TEMPORAL VOCABULARY

Canonical temporal documentation должна быть в существующем canonical document.

Preferred target:

```text
docs/architecture/temporal-readiness.md
```

Не создавать конкурирующий "Temporal Architecture" документ, если existing document может быть расширен.

Обязательные sections:

```text
1. Entity time
2. Lifecycle time
3. Service occurrence
4. Financial time
5. Event time
6. Processing time
7. Presentation period
8. Default registry temporal dimension
9. Storage timezone
10. Business timezone
11. Display timezone
12. Period boundary semantics
13. Intentional cross-domain temporal differences
14. Analytics visibility boundary
15. DST behavior
16. Cross-midnight behavior
```

Для canonical temporal facts:

```text
Name
Meaning
Authority
Type:
  instant
  date-only
  local-time
  timezone
Immutable/mutable
Storage representation
Presentation rule
Filter semantics
D8 ownership
```

Не invent-ить отсутствующие fields.

---

# 5. D8 MUST #2
## INVALID DATE VALIDATION

Canonical query-param contract:

```text
malformed dateFrom/dateTo
        ↓
BadRequestException
        ↓
HTTP 400
```

Response:

```text
{
  statusCode: 400,
  message: "<paramName> must be a valid date",
  requestId?
}
```

с обычным `X-Request-Id`/exception-filter behavior.

Validation выполняется до построения Prisma `where`.

Validate independently:

```text
dateFrom
dateTo
```

Absent:
```text
no filter
```

Valid date-only:
```text
YYYY-MM-DD → UTC midnight semantics
```

Никакого silent `Invalid Date`.

---

# 6. B-06 IMPLEMENTATION SURFACES

Обязательные existing query-param surfaces:

### Operations
```text
Requests
Orders
Bookings
Payments
```

### CRM
```text
CRM Activity
CRM customer period filtering
```

### Catalog
```text
publishedAt period filtering
```

Использовать один existing validation helper/pattern, где это возможно.

Не создавать вторую competing validation mechanism.

---

# 7. PAYMENTS 422 → 400

Только для **registry query-param date filters**:

```text
Payments 422 → 400 BadRequestException
```

Не менять Finance DomainError contract для submitted financial payloads.

Например `LedgerTransaction.occurredAt` payload validation остаётся как есть.

Эту границу зафиксировать в tests/documentation.

---

# 8. D8 MUST #3
## OPERATIONS CENTER PERIOD CONTRACT

Сохранить и документировать:

```text
Scope:
GLOBAL within active Operations registry

Parameters:
dateFrom
dateTo

Semantics:
date-only

Boundary:
[from, to)

Storage/query:
UTC midnight boundaries

Authority:
server

Effect:
KPI + table dataset

URL:
?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD

Browser local timezone does not change business boundary
```

Не менять existing behavior ради косметической унификации.

---

# 9. D8 MUST #4
## CROSS-DOMAIN TEMPORAL SEMANTICS

Документировать intentional differences.

Минимум:

```text
Operations registry:
default registry temporal dimension = createdAt

Booking upcoming:
service occurrence = serviceDate

CRM Activity:
activity temporal dimension = occurredAt
```

Примеры:

```text
"When was the record created?" → createdAt
"When will the service occur?" → serviceDate / serviceStartsAt
"When did the activity occur?" → occurredAt
"When was the payment captured?" → paidAt
```

---

# 10. D8 MUST #5
## DEFAULT REGISTRY TEMPORAL DIMENSION

Не использовать "primary temporal dimension" как иерархию.

Использовать:

```text
default registry temporal dimension
```

Meaning:

> temporal field used by the registry's default list sorting and/or default period filtering.

At minimum:

```text
Requests → createdAt
Orders → createdAt
Bookings → createdAt
Payments → createdAt
CRM Activity → occurredAt
```

Если не применимо:

```text
not applicable
```

---

# 11. ANALYTICS BOUNDARY

D8 owns only:

```text
Analytics temporal visibility
```

Document existing capability:

```text
preset periods
CUSTOM startDate/endDate
granularity
comparison parameter presence
timezone
server-side period resolution
```

D11 owns:

```text
KPI definitions
headline vs bucket reconciliation
comparison semantics
project-wide KPI/status semantics
```

Do NOT implement D11.

Do NOT redefine Analytics KPI formulas.

---

# 12. TIMEZONE CONTRACT

Document:

### Storage
```text
UTC
```

### Business/service
```text
Product.serviceTimeZone
IANA
frozen downstream
```

### Display
Current browser/runtime behavior must be documented accurately.

Do not claim display is UTC when runtime timezone is used.

Do not change service timezone authority.

---

# 13. DST CONTRACT

Document existing behavior:

```text
ambiguous fall-back local time
    → early/first instant

nonexistent spring-forward local time
    → instant after gap

cross-midnight end
    → next local calendar day
```

Preserve `service-time.ts`.

Do not refactor its algorithm unless a proven defect is found.

---

# 14. PERIOD BOUNDARY VARIANCE

Не требовать искусственной одинаковости.

Canonical model:

```text
Operations:
[from, to)
```

Другие existing surfaces may have intentional different boundary behavior.

For each variance classify:

```text
intentional
legacy
deferred
defect
```

Не менять D9/D11-owned semantics ради uniformity.

---

# 15. D8 SHOULD #1
## SHARED TEMPORAL DISPLAY

Optional low-risk improvement.

Можно объединить duplicated:

```text
fmtDate()
```

только если это не вызывает broad frontend refactor.

Preserve:
- RU/AZ/EN;
- null behavior;
- existing display semantics;
- timezone behavior.

---

# 16. D8 SHOULD #2
## TESTS

Mandatory B-06 tests:

```text
Requests
Orders
Bookings
Payments
CRM Activity
CRM customer period
Catalog
```

For each:

```text
invalid dateFrom
invalid dateTo
both invalid
```

Expected:

```text
HTTP 400
BadRequestException
canonical message/shape
```

Preserve valid:

```text
YYYY-MM-DD
```

Additional SHOULD:

```text
reversed range
empty range
URL persistence
timezone display
```

---

# 17. EXPORTS — D9 BOUNDARY

Do NOT change export field sets in D8.

Known:

```text
Orders export lacks serviceDate
```

remains:

```text
D9-owned
```

D8 may document that export temporal standardization is deferred to D9.

---

# 18. D11 BOUNDARY

Do NOT implement:

```text
project-wide KPI formulas
KPI read-model redesign
period comparison
status/total reconciliation
headline-vs-bucket semantics
```

---

# 19. FINANCE BOUNDARY

Do NOT implement:

```text
PSP temporal milestones
Finance Center
provider-state redesign
capture/authorization architecture
settlement redesign
payout redesign
```

Existing Payment/Refund/Ledger temporal contracts remain unchanged.

---

# 20. SCHEMA RULE

Expected:

```text
NO schema changes
NO migrations
NO new temporal fields
```

If a missing field appears necessary:

```text
STOP
REPORT
DO NOT ADD
```

---

# 21. RBAC / SECURITY

No permissions changes.

Preserve:

```text
Role
→ effective permissions
→ guard
→ endpoint
→ service/query
→ scope
```

Temporal filters remain additive.

Verify representative:

```text
ADMIN
OPERATOR
ANALYST / MARKETER where applicable
PARTNER
BUYER
```

Verify:

```text
cross-tenant isolation
partner own-scope
workspace scope
```

Temporal parameters must never replace authorization predicates.

---

# 22. URL / STATE

Preserve existing behavior.

Operations remains:

```text
dateFrom/dateTo
```

URL-authoritative.

Do not silently rewrite local-state architectures on other surfaces.

Document local-state cases accurately.

---

# 23. IMPLEMENTATION ORDER

```text
1. Read canonical roadmap/architecture after cleanup
2. Verify current HEAD
3. Implement validation hardening
4. Add/refresh targeted tests
5. Canonicalize temporal documentation
6. Optional low-risk TemporalDisplay cleanup
7. Focused tests
8. Relevant regressions
9. TSC
10. Build
11. Browser/runtime
12. Security/tenant verification
13. Git diff audit
14. Commit
15. Push
16. Qualification report
```

Не смешивать D8 с unrelated cleanup.

---

# 24. REQUIRED TEST MATRIX

| Area | Required |
|---|---|
| Requests invalid dateFrom | PASS |
| Requests invalid dateTo | PASS |
| Orders invalid dateFrom | PASS |
| Orders invalid dateTo | PASS |
| Bookings invalid dateFrom | PASS |
| Bookings invalid dateTo | PASS |
| Payments invalid dateFrom | PASS |
| Payments invalid dateTo | PASS |
| CRM Activity invalid date | PASS |
| CRM customer period invalid date | PASS |
| Catalog publishedAt invalid date | PASS |
| Valid YYYY-MM-DD preserved | PASS |
| Operations [from,to) | PASS |
| KPI/table period parity | PASS |
| DST ambiguous | PASS |
| DST nonexistent | PASS |
| Cross-midnight | PASS |
| Tenant isolation | PASS |
| Partner own-scope | PASS |
| RBAC authorization | PASS |

---

# 25. BROWSER / RUNTIME QUALIFICATION

Representative surfaces:

```text
Requests
Orders
Bookings
Payments
CRM Activity
Command Center
Analytics
```

Check:

```text
date input
date range behavior
invalid input
KPI/table agreement
URL/reload where applicable
RU/AZ/EN
responsive behavior
console
network
```

---

# 26. API / DATABASE QUALIFICATION

For every modified endpoint:

```text
valid date
invalid date
missing date
partial range
```

Confirm:

```text
400 malformed query date
canonical error shape
no Prisma Invalid Date
no silent fallback
no auth bypass
```

Where an existing surface has a deliberate boundary variation, preserve it.

---

# 27. REQUIRED DOCUMENTATION RESULT

After D8, canonical temporal documentation must answer without repository archaeology:

```text
What does this timestamp mean?
Who owns it?
What timezone does it use?
Is it instant or date-only?
Which surface uses it?
Which field does registry period filtering use?
Which field does default sort use?
Which differences are intentional?
What belongs to D8?
What belongs to D9?
What belongs to D11?
What belongs to Finance?
```

If not, documentation is incomplete.

---

# 28. QUALIFICATION REPORT

Create:

```text
docs/reports/PHASE_3_D8_GLOBAL_TEMPORAL_VISIBILITY_IMPLEMENTATION_QUALIFICATION_REPORT.md
```

Sections:

1. Executive Summary
2. Baseline / Final SHA
3. Implemented Scope
4. Validation Hardening
5. Global Temporal Vocabulary
6. Operations Period Contract
7. Cross-Domain Temporal Semantics
8. Default Registry Temporal Dimensions
9. Analytics Visibility Boundary
10. Timezone / DST / Cross-Midnight
11. Shared Temporal Display
12. D9 / D11 / Finance Boundaries
13. Test Matrix
14. API Verification
15. Browser Verification
16. Security / Tenant / RBAC
17. Performance
18. Known Non-Blocking Failures
19. Git Evidence
20. Final Verdict

---

# 29. VERDICT RULE

## VERDICT A — D8 ACCEPTED

Only if:

- all MUST items implemented;
- canonical validation behavior proven;
- temporal vocabulary canonicalized;
- D8/D9/D11/Finance boundaries preserved;
- frozen temporal contracts unchanged;
- no schema migration;
- no RBAC changes;
- required tests pass;
- TSC/build pass;
- critical browser/runtime paths pass;
- no temporal security regression;
- Git committed and pushed;
- HEAD == origin/master;
- tracked clean;
- final report committed.

## VERDICT B — VALID SYSTEM FAIL

Use when:
- implementation incomplete;
- required evidence missing;
- bounded non-security defect remains;
- follow-up needed.

## VERDICT C — BLOCKED

Use when:
- frozen contract conflict;
- schema prerequisite;
- security/tenant leakage;
- missing architecture decision;
- D9/D11/Finance scope cannot remain separate.

Do not call a security/data-integrity defect non-blocking.

---

# 30. GIT HARD CLOSURE

Before commit:

```text
git status
git diff --check
git diff --stat
git diff --name-only
```

Production diff must contain only intended D8 changes.

No unrelated:
- source;
- docs;
- local environment artifacts.

No force push.

Final:

```text
HEAD == origin/master
tracked working tree clean
```

Remaining untracked files must be classified.

---

# 31. REQUIRED FINAL OUTPUT

```text
PHASE 3 — D8 GLOBAL TEMPORAL VISIBILITY

VERDICT: A / B / C

Baseline SHA:
Final SHA:

Canonical Temporal Vocabulary:
PASS / FAIL

Invalid Date Contract:
PASS / FAIL
HTTP:
Exception:
Response shape:

Operations Period Contract:
PASS / FAIL

Cross-Domain Temporal Semantics:
PASS / FAIL

Default Registry Temporal Dimensions:
PASS / FAIL

Analytics Visibility:
PASS / FAIL

D9 Boundary:
PASS / FAIL

D11 Boundary:
PASS / FAIL

Finance Boundary:
PASS / FAIL

Schema changes:
NONE / UNEXPECTED

RBAC changes:
NONE / UNEXPECTED

Validation tests:
PASS / FAIL

Regression tests:
PASS / FAIL

TSC:
PASS / FAIL

Build:
PASS / FAIL

Browser/runtime:
PASS / FAIL

Security/tenant:
PASS / FAIL

Performance:
PASS / FAIL

Production diff:
<summary>

Git:
HEAD == origin/master:
Tracked clean:
Untracked:

Qualification report:
docs/reports/PHASE_3_D8_GLOBAL_TEMPORAL_VISIBILITY_IMPLEMENTATION_QUALIFICATION_REPORT.md
```

---

# 32. STOP CONDITIONS

Immediately STOP if:

- a frozen temporal contract must change;
- a new temporal field is required;
- schema migration is necessary;
- RBAC/permissions need changes;
- tenant isolation fails;
- D8 requires D9/D11/Finance work;
- canonical roadmap must change;
- competing temporal authority is discovered;
- canonical invalid-date contract cannot be implemented consistently without a new governance decision.

Report the issue; do not improvise.

---

# 33. FINAL GOVERNANCE RULE

После D8 implementation **не назначать следующий этап самостоятельно**.

Следующий TRUE NEXT определяется отдельной requalification по canonical roadmap после D8 qualification.

D9 не начинать автоматически.
D11 не начинать автоматически.
Finance не начинать автоматически.

**STOP after D8 qualification and Git closure.**
