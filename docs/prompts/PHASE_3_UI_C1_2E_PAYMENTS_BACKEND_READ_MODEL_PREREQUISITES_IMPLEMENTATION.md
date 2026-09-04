# PHASE 3 — COMMERCE CENTER UI-C1.2E
## PAYMENTS BACKEND / READ-MODEL PREREQUISITES
### PRODUCTION IMPLEMENTATION PROMPT

---

# 0. STAGE STATUS / BASELINE

Current accepted state:

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — ACCEPTED
UI-C1.2A — ACCEPTED
UI-C1.2B — ACCEPTED
UI-C1.2C — ACCEPTED AFTER REMEDIATION R1
UI-C1.2D — ACCEPTED AFTER FINAL GIT CLOSURE R2

UI-C1.2D IMPLEMENTATION COMMIT:
8aa37739499aa2978c89219666e23ff13b2de4c8

UI-C1.2D FINAL SHA:
be683831dda0343190fa4b2ca78ff7f658995f53
```

Canonical repository baseline for this stage:

```text
be683831dda0343190fa4b2ca78ff7f658995f53
```

True next stage:

```text
UI-C1.2E — PAYMENTS BACKEND / READ-MODEL PREREQUISITES
```

Do NOT start:

```text
UI-C1.2F — Payments tab production UI
UI-C1.2G — KPI Semantic Grouping / Lifecycle Flow
UI-C1.2H — Attention / Period / Filter Reconciliation
UI-C1.2I — Help / i18n / Accessibility
UI-C1.2J — Browser / Security / Regression Closure
UI-C1.2K — Git Hard Closure
UI-C2
D8
```

---

# 1. PURPOSE

This stage prepares the backend/read-model contract required for the future operational Payments tab:

```text
/app/payments
```

UI-C1.2E is NOT the Payments frontend implementation.

The objective is to establish a truthful, server-authoritative, queryable Payments operational read model that can support:

```text
TOTAL
PAYMENT STATUS KPI COUNTS
REFUND STATUS KPI COUNTS
CURRENCY DIMENSION
TABLE FILTERING
SEARCH
PERIOD FILTERING
PAGINATION
DEEP-LINK / DETAIL TARGETS
AUDITABLE SOURCE RELATIONS
WORKSPACE / TENANT ISOLATION
RBAC
EXPORT-READY QUERY SEMANTICS
```

without inventing domain semantics that do not exist.

---

# 2. CANONICAL DOMAIN OWNERSHIP

Binding architecture:

```text
Payments DOMAIN OWNERSHIP
= FINANCE

Payments WORKFLOW CONTEXT
= OPERATIONS CENTER
```

Operational Payments UI is a workflow view over Finance-owned data.

Do NOT create a second Payments domain.

Do NOT duplicate Order financial truth into a disconnected store.

Do NOT move canonical financial ownership out of the existing Finance / Payment / Refund backend domain.

---

# 3. D7 PRESERVATION — ABSOLUTE

D7 remains accepted and must not be weakened.

Canonical financial formulas:

```text
due=max(0,total-paid)
refundable=max(0,paid-refunded)
```

Backend computes financial truth.

Frontend formatting only.

Booking finance uses linked Order canonical truth.

UI-C1.2E MUST NOT:

```text
recompute D7 amounts on frontend
introduce alternate due/refundable formulas
duplicate financial aggregates with conflicting semantics
change Order financial authority
change Booking financial authority
silently reinterpret paid/refunded totals
```

If the current Payment domain exposes different lower-level semantics, reconcile the Payments read model to the existing accepted D7 contract rather than replacing D7.

---

# 4. MANDATORY SOURCE-OF-TRUTH AUDIT BEFORE IMPLEMENTATION

Before changing production code, inspect the real repository and document the actual source of truth for:

```text
Payment entity/model
PaymentStatus enum
Refund entity/model
RefundStatus enum
Order ↔ Payment relation
Booking ↔ Order ↔ Payment relation
payment provider reference field(s)
payment amount field(s)
refund amount field(s)
currency field(s)
payment timestamps
refund timestamps
payment method/type fields if they exist
payment failure/error fields if they exist
workspace / tenant ownership fields
partner/customer ownership fields
audit/event/history sources
permissions used by current finance/payment endpoints
legacy /app/finance/payments backend/frontend routes
current /app/payments route dependencies
existing exports
existing payment tests
existing refund tests
```

Do not infer enum values from UI labels.

Do not create enums merely to satisfy a desired card design.

---

# 5. EXPECTED CURRENT ENUMS — VERIFY, DO NOT ASSUME

Architecture contract currently records these Payment statuses:

```text
PaymentStatus:
PENDING
AUTHORIZED
CAPTURED
FAILED
CANCELLED
REFUNDED
```

and these Refund statuses:

```text
RefundStatus:
REQUESTED
APPROVED
PROCESSED
FAILED
```

However:

```text
VERIFY AGAINST ACTUAL PRISMA / DOMAIN CODE
```

If repository truth differs, STOP and report the discrepancy before changing the semantic contract.

Known current runtime reachability from prior reconciliation:

```text
Payment:
PENDING → CAPTURED
PENDING → FAILED
PENDING → CANCELLED

AUTHORIZED
REFUNDED
may exist in enum but can be currently reserved/unreachable
```

Refund lifecycle:

```text
REQUESTED → APPROVED → PROCESSED
REQUESTED / APPROVED → FAILED
```

Do not fabricate false transitions.

---

# 6. NO STRIPE-SPECIFIC ARCHITECTURE

Prior reconciliation established:

```text
provider-neutral providerRef
```

Do NOT introduce a new StripeEvent-based operational model merely for this stage.

If provider-specific data already exists internally, normalize it behind the existing provider-neutral API/read model.

Operational API must not expose provider implementation details unnecessarily.

---

# 7. REQUIRED BACKEND READ MODEL

Implement or qualify a server-authoritative Payments registry read model.

Preferred conceptual shape:

```ts
type PaymentsRegistryResponse = {
  items: PaymentRegistryRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number; // table-scoped row count
    pages: number;
  };
  aggregates: {
    total: number; // overview-scope total
    paymentStatus: Record<PaymentStatus, number>;
    refundStatus?: Record<RefundStatus, number>;
    currency?: Array<{
      currency: string;
      count: number;
      amount?: string;
    }>;
  };
  scope?: {
    from?: string;
    to?: string;
    currency?: string;
    detector?: string;
  };
};
```

Exact DTO names may follow repository conventions.

Do not force this exact TypeScript syntax if project conventions differ.

The semantic separation is mandatory:

```text
TABLE QUERY
≠
OVERVIEW KPI QUERY
```

---

# 8. KPI OVERVIEW VS TABLE FILTER CONTRACT

This is binding and must match Requests / Orders / Bookings behavior.

Canonical interaction model:

```text
KPI CARDS
= STATIC OVERVIEW COUNTS

CLICK ONE KPI
→ filters TABLE ONLY
→ selected KPI becomes active
→ all other KPI counts remain stable
```

Backend prerequisite:

```text
overview aggregate scope
must exclude the active KPI status dimension
while preserving legitimate base scope
```

Example:

```text
table filter:
paymentStatus=CAPTURED

overview:
same workspace/tenant
same search if canonical
same period if canonical
same global currency scope if canonical
same detector/global scope if canonical
BUT
paymentStatus removed from overview aggregation scope
```

Likewise for refund-status KPI filtering.

Do not implement:

```text
clicked payment card → other payment cards zero/recalculate
clicked refund card → all other cards collapse
```

---

# 9. ONE ACTIVE KPI FILTER MODEL — BACKEND COMPATIBILITY

Future UI behavior is:

```text
one active KPI card at a time
```

Across payment/refund dimensions:

```text
click CAPTURED
→ table paymentStatus=CAPTURED

then click PROCESSED refund
→ paymentStatus KPI filter cleared
→ table refundStatus=PROCESSED
```

Total:

```text
click Всего платежей
→ clears active payment/refund KPI filter
→ table returns full set under remaining non-KPI scope
```

UI-C1.2E does not need to implement the visual selection state, but backend/query semantics must support this cleanly.

---

# 10. REQUIRED PAYMENT STATUS COVERAGE

If actual repository enum is confirmed as:

```text
PENDING
AUTHORIZED
CAPTURED
FAILED
CANCELLED
REFUNDED
```

then aggregates must expose all 6 statuses, including zero-count statuses.

Binding rule:

```text
EVERY ACTUAL CANONICAL PAYMENT STATUS
→ ONE SERVER-AUTHORITATIVE AGGREGATE COUNT
```

No status may disappear because count is zero.

No client-side completion of missing keys.

Backend must return deterministic coverage.

---

# 11. REQUIRED REFUND STATUS COVERAGE

If actual repository RefundStatus is confirmed as:

```text
REQUESTED
APPROVED
PROCESSED
FAILED
```

then expose all 4 refund aggregate counts, including zero-count statuses.

Binding:

```text
EVERY ACTUAL CANONICAL REFUND STATUS
→ ONE SERVER-AUTHORITATIVE AGGREGATE COUNT
```

If Payment records do not have a direct one-to-one refund relationship, aggregate through the actual canonical relation.

Do not fake `payment.refundStatus` if the domain stores refunds separately.

---

# 12. PAYMENT VS REFUND SEMANTIC SEPARATION

Do not collapse these dimensions.

Conceptually:

```text
PaymentStatus
≠
RefundStatus
```

A payment can have a payment lifecycle state while linked refund records have their own lifecycle.

If `PaymentStatus.REFUNDED` exists, define exactly what it means relative to RefundStatus.

Audit and document:

```text
When does PaymentStatus become REFUNDED?
After any refund?
Only full refund?
After RefundStatus.PROCESSED?
Is partial refund represented elsewhere?
```

If current code is ambiguous or contradictory, STOP and report instead of inventing semantics.

---

# 13. CURRENCY DIMENSION — AUDIT FIRST

Future Payments registry may show compact currency cards:

```text
ВАЛЮТЫ
[ USD ] [ EUR ] [ AZN ] [...]
```

UI-C1.2E must determine the real supported currency semantics.

Audit:

```text
currency storage type
ISO code normalization
supported currency set
whether currencies are fixed/configured/dynamic
whether historical unsupported currencies exist
whether mixed-currency aggregation exists
whether amount summaries across currencies are prohibited
```

Do not invent supported currencies.

Do not hard-code:

```text
USD / EUR / AZN
```

unless repository/config/domain truth confirms them.

If currencies are dynamic:

- expose truthful distinct currencies from canonical data or a canonical configured set;
- define deterministic ordering;
- do not generate an unbounded UI contract here;
- return backend data suitable for later "top currencies + other" if needed.

---

# 14. NO INVALID CROSS-CURRENCY TOTALS

Never calculate:

```text
SUM(USD + EUR + AZN)
```

as one monetary total unless a canonical conversion/reporting currency mechanism already exists.

Count aggregates may be cross-currency.

Monetary aggregates must remain currency-scoped or explicitly converted by existing canonical finance logic.

If no FX normalization exists:

```text
counts across currencies — allowed
money totals across currencies — forbidden
```

---

# 15. PAYMENT REGISTRY ROW CONTRACT

Audit and establish a stable row representation suitable for future `/app/payments`.

Expected candidate fields, ONLY where backed by real domain data:

```text
payment id
business/reference id
providerRef
order id / order number
booking relation if derivable canonically
customer / payer reference
amount
currency
payment status
refund summary/status where canonically derivable
payment method/type if real
createdAt
updatedAt
capturedAt / failedAt / cancelledAt if real
workspace / tenant context
```

Do not manufacture fields that are not stored or canonically derivable.

Do not expose sensitive provider payloads.

---

# 16. PCI / PII SAFETY

Payments registry MUST NOT expose:

```text
PAN
full card number
CVV/CVC
raw payment credentials
provider secrets
webhook secrets
full sensitive provider payload
unnecessary PII
```

If payment method display exists, only expose already-safe normalized presentation such as:

```text
brand
last4
method type
```

and only if already supported by domain/security policy.

Never log sensitive payment data in new tests or debug output.

---

# 17. SEARCH CONTRACT

Audit current searchable fields.

Preferred operational search may include only real indexed/canonical references such as:

```text
payment id
providerRef
order number
booking reference
customer reference
```

Do not silently add broad PII search.

Search must be:

```text
SERVER-SIDE
PAGINATION-AWARE
DETERMINISTIC
```

No client-side filtering.

If search participates in global overview scope, document that explicitly.

If KPI counts intentionally ignore search, document that instead.

Do not leave ambiguity.

---

# 18. PERIOD CONTRACT

Audit the actual relevant timestamp fields.

Possible candidates:

```text
createdAt
capturedAt
processedAt
refund processedAt
```

Do not expose multiple conflicting date filters in UI-C1.2E.

Define the backend-supported canonical Payments registry period field for the initial operational view.

Preferred default if current semantics support it:

```text
createdAt ∈ [from, to)
```

But verify against repository behavior.

Period semantics must include:

```text
timezone
inclusive/exclusive boundaries
date parsing
invalid range handling
page reset behavior support
```

Use half-open interval `[from,to)` if consistent with current project conventions.

---

# 19. BASE OVERVIEW SCOPE VS ACTIVE KPI SCOPE

This distinction is mandatory.

Example:

```text
BASE OVERVIEW SCOPE
workspace
tenant
period
search (if canonical)
currency (if global toolbar filter)
detector/global operational scope

ACTIVE KPI FILTER
paymentStatus OR refundStatus
```

Overview counts should remain within BASE OVERVIEW SCOPE but exclude ACTIVE KPI FILTER.

Do not accidentally remove legitimate tenant/workspace/date restrictions when stripping status conditions.

---

# 20. DO NOT USE NAIVE `delete status` IF SEMANTICS ARE COMPOSED

The Bookings remediation already proved why this matters.

If filters are represented in complex nested Prisma where clauses:

```text
AND
OR
NOT
relation filters
detector-generated predicates
```

do not naïvely delete one top-level property and assume correctness.

Preferred approach:

```text
construct source filter dimensions explicitly
build table where from dimensions
build overview where from the same dimensions
omit only active KPI dimension
```

If current service architecture already has safe helpers, reuse them.

Add focused tests proving no global scope is lost.

---

# 21. WORKSPACE / TENANT ISOLATION

Mandatory preservation:

```text
server-side workspace authority
server-side tenant authority
no client-trusted partnerId
cross-context existence leakage prohibited
```

Wrong workspace/tenant/business context:

```text
404-like / not found behavior
```

unless the existing canonical security contract intentionally permits existence awareness.

Do not turn isolation failures into generic 403s if that leaks existence.

---

# 22. RBAC

Audit actual permissions.

Payments operational read access must remain server-authoritative.

Do not assume visibility from left-menu tabs is sufficient.

Audit at minimum:

```text
list/read payment registry permission
payment detail permission
refund read permission
refund action permission if any
export permission if any
finance/admin/operator role mappings
```

UI-C1.2E must not broaden permissions merely because Payments is visible in Operations Center shell.

---

# 23. OPERATIONS CENTER SHELL PRESERVATION

UI-C1.2A already accepted:

```text
/app/requests
/app/orders
/app/bookings
/app/payments
```

inside shared Operations Center shell.

Also accepted:

```text
legacy /app/finance/payments
→ redirect to /app/payments
→ query preserved
```

UI-C1.2E must preserve this behavior.

Do not reintroduce a separate finance-only Payments screen contract.

---

# 24. ORDER / BOOKING RELATIONSHIP

Payments operational rows must preserve canonical commerce relationships.

Do not assume direct Booking→Payment if actual model is:

```text
Booking → Order → Payment
```

Use real relation ownership.

The future Payments tab should be able to deep-link to canonical Order and, where canonically available, Booking.

Do not create fake booking references from loose text matches.

---

# 25. AUDIT / HISTORY

Audit existing payment/refund audit mechanisms.

Determine whether future operational Payments detail/history should come from:

```text
payment history table
refund history
domain audit log
generic audit events
provider events
```

UI-C1.2E does NOT need to build a new unified audit UI, but must identify the canonical backend source.

If no canonical audit source exists for certain payment state transitions, report that as prerequisite debt rather than fabricating history.

---

# 26. READ-MODEL API CONTRACT

Prefer a dedicated operational endpoint or a clearly qualified existing endpoint.

Possible pattern:

```text
GET /payments
```

with query parameters such as:

```text
page
pageSize
search
paymentStatus
refundStatus
currency
from
to
orderId
bookingId
```

ONLY include parameters actually implemented and supported.

Do not create duplicate overlapping endpoints if an existing endpoint can be safely extended.

Document exact query contract.

---

# 27. PAGINATION

Server-side only.

Required:

```text
stable ordering
deterministic page boundaries
page >= 1 validation
bounded pageSize
correct table-scoped total
```

Default ordering should be explicit, likely newest-first if consistent with current product conventions.

Do not let KPI aggregate totals replace table pagination total.

They are different semantics.

---

# 28. EXPORT-READY SEMANTICS

UI-C1.2E does not need to build export UI, but query design must permit future CSV/XLSX export of the current table scope.

Audit whether an export backend already exists.

Binding future rule:

```text
export follows current TABLE FILTER scope
not static overview KPI scope
```

Do not implement client-side export from only the current visible page.

---

# 29. ERROR / VALIDATION CONTRACT

Backend should return deterministic errors for:

```text
invalid payment status
invalid refund status
invalid currency format
invalid date
from >= to if prohibited
invalid page
invalid pageSize
unauthorized access
wrong workspace/tenant
```

Use project-standard HTTP semantics.

Do not return 200 with silently ignored invalid filters.

---

# 30. PERFORMANCE

Payments registry may become large.

Audit:

```text
indexes for status
currency
createdAt
order relation
providerRef
workspace/tenant keys
refund relation
```

Do not add speculative indexes without query evidence.

If query plan risk is obvious, add only justified indexes and document them.

Avoid N+1 queries in row projection.

Aggregates should not perform one query per status if a grouped aggregate is feasible and consistent with ORM constraints.

---

# 31. TRANSACTION / CONSISTENCY EXPECTATIONS

Registry read model may consist of:

```text
items
pagination total
status aggregates
refund aggregates
currency aggregates
```

Decide whether these must be read from one DB snapshot/transaction.

If exact snapshot consistency is not guaranteed by current architecture, document expected eventual/near-simultaneous consistency.

Do not falsely claim atomic snapshot semantics.

---

# 32. REQUIRED IMPLEMENTATION TESTS

Add focused tests for backend/read-model behavior.

Minimum required coverage:

### A. Payment status aggregate coverage

```text
all actual PaymentStatus enum values returned
zero-count statuses included
counts server-authoritative
```

### B. Refund status aggregate coverage

```text
all actual RefundStatus enum values returned
zero-count statuses included
```

### C. Static KPI overview semantics

```text
table paymentStatus filter changes table rows
overview payment-status counts stay stable

table refundStatus filter changes table rows
overview refund-status counts stay stable
```

### D. One-active-dimension compatibility

Backend must cleanly support:

```text
paymentStatus only
refundStatus only
neither
```

If both are allowed at raw API level, document semantics; future KPI click behavior will still select one.

### E. Total semantics

```text
aggregates.total
= overview total

pagination.total
= table-scoped total
```

Prove they diverge correctly under KPI status filter.

### F. Base-scope preservation

Prove overview retains:

```text
workspace
tenant
period
currency/global scope
search if canonical
```

while excluding active KPI dimension only.

### G. Security

```text
wrong tenant/workspace cannot read payment rows
cannot infer existence through direct ID/list filters
RBAC enforced server-side
```

### H. Currency

```text
no fabricated currencies
normalized canonical code
no mixed-currency monetary sum unless canonical FX exists
```

### I. Relations

```text
payment → order relation correct
booking relation only through canonical path
no cross-tenant relation leakage
```

---

# 33. REQUIRED ENUM / STATUS MATRIX IN REPORT

The implementation report must include actual repository-derived matrices.

Payment:

| PaymentStatus | Exists in enum | Reachable today | Aggregate exposed | Notes |
|---|---:|---:|---:|---|

Refund:

| RefundStatus | Exists in enum | Reachable today | Aggregate exposed | Notes |
|---|---:|---:|---:|---|

Do not prefill from this prompt without verifying source code.

---

# 34. REQUIRED QUERY-SCOPE MATRIX

Report:

| Filter dimension | Table scope | KPI overview scope | Notes |
|---|---:|---:|---|
| workspace | YES | YES | mandatory |
| tenant | YES | YES | mandatory |
| search | audit | audit | state decision |
| period | audit | audit | state decision |
| currency | audit | audit | global dimension candidate |
| paymentStatus | YES | NO when active KPI | table-only KPI filter |
| refundStatus | YES | NO when active KPI | table-only KPI filter |
| orderId | audit | audit | deep-link scope |
| bookingId | audit | audit | canonical relation only |

Replace `audit` with actual final semantics.

---

# 35. REQUIRED API CONTRACT TABLE

Report every implemented/qualified query parameter:

| Param | Type | Source of truth | Table effect | Overview effect | Validation |
|---|---|---|---|---|---|

Examples may include:

```text
search
paymentStatus
refundStatus
currency
from
to
page
pageSize
orderId
bookingId
```

Only list real supported params.

---

# 36. REQUIRED SECURITY MATRIX

Report:

| Surface | Permission | Wrong role | Wrong tenant/workspace | Existence leakage |
|---|---|---|---|---|

At minimum:

```text
payments list
payment direct read if present
refund read
aggregate read
```

No frontend-only authorization counts as PASS.

---

# 37. REQUIRED BUILD / TEST QUALIFICATION

Run the relevant backend qualification.

At minimum:

```text
backend typecheck
backend build
focused payment tests
focused refund tests
new payments registry/read-model tests
relevant Order/D7 financial regression tests
relevant tenant/RBAC tests
```

If frontend types depend on shared API contracts modified by this stage:

```text
frontend typecheck
```

UI-C1.2E does not require full browser qualification unless production frontend behavior was changed unexpectedly.

Do not hide unrelated pre-existing failures.

Classify each failure as:

```text
new regression
pre-existing
environmental
fixture drift
```

with evidence.

---

# 38. D5 / D6 / D7 REGRESSION PRESERVATION

No regression to accepted stages.

Specifically preserve:

```text
D5 Order full-page authority
D6 Booking full-page authority
D6 action state machine
D7 due/refundable backend authority
Order financial truth
Booking linked-Order finance truth
audit immutability
cross-tenant 404-like behavior
```

If any accepted-stage regression appears:

```text
VERDICT B
```

---

# 39. NO FRONTEND PAYMENTS TAB IMPLEMENTATION

UI-C1.2E is backend/read-model prerequisite work.

Allowed frontend changes only if required for:

```text
shared API types
route compatibility
compile-time contract
```

Do NOT implement the full Payments registry UI.

Do NOT implement:

```text
KPI cards
currency cards
refund cards
attention block
toolbar redesign
table visual layout
Payments detail visual page
```

Those belong to UI-C1.2F/G/H.

---

# 40. GIT DISCIPLINE

Before implementation:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

Baseline must match:

```text
be683831dda0343190fa4b2ca78ff7f658995f53
```

unless repository has legitimately advanced before execution; if so, report actual baseline and verify no unexpected production drift from the accepted SHA.

At closure:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -1 --oneline --decorate
```

Required:

```text
porcelain = empty
HEAD == origin/master
one concrete FINAL SHA
```

Do not leave prompt/report files untracked.

Avoid another self-referential closure loop.

---

# 41. REQUIRED IMPLEMENTATION REPORT

Return a Markdown report with:

```text
1. Executive Summary
2. Baseline / Git State
3. Source-of-Truth Audit
4. Payment Domain Model
5. Refund Domain Model
6. Payment ↔ Refund Semantics
7. Order / Booking Relations
8. Workspace / Tenant Authority
9. RBAC Audit
10. Read-Model Architecture
11. API Contract
12. Table Scope vs Overview Scope
13. Payment Status Aggregate Matrix
14. Refund Status Aggregate Matrix
15. Currency Semantics
16. Search Semantics
17. Period Semantics
18. Pagination
19. PCI / PII Safety
20. Audit / History Source
21. Performance / Index Qualification
22. Tests Added
23. Test Results
24. D5/D6/D7 Regression Qualification
25. Files Changed
26. Git Hard Closure
27. Final Verdict
28. TRUE NEXT
```

---

# 42. VERDICT A CONDITIONS

UI-C1.2E can be accepted only if all are true:

```text
actual Payment domain audited
actual Refund domain audited
no invented enums/statuses
all actual PaymentStatus values exposed in aggregates
all actual RefundStatus values exposed in aggregates where domain supports them
zero-count statuses preserved
table-scoped filters server-side
overview KPI counts server-authoritative
active KPI dimension excluded from overview scope
legitimate base scope preserved
currency semantics qualified
no invalid mixed-currency monetary totals
Order/Booking relations canonical
workspace/tenant isolation preserved
RBAC preserved
PCI/PII safety preserved
D7 financial authority preserved
focused tests pass
no new regression
Git clean
HEAD == origin/master
single final SHA
```

---

# 43. VERDICT B CONDITIONS

Return VERDICT B if any of these occurs:

```text
enum/status invented
Payment and Refund lifecycles collapsed incorrectly
REFUNDED semantics guessed
client-side KPI counting introduced
overview aggregates collapse when status filter is active
workspace/tenant scope lost from overview
payment data leaks across tenants
RBAC is frontend-only
sensitive payment data exposed
mixed-currency monetary totals invented
D7 authority duplicated or contradicted
Order/Booking relation fabricated
runtime-unreachable enum falsely shown as reachable
new regression introduced
Git closure incomplete
```

---

# 44. REQUIRED FINAL VERDICT FORMAT — PASS

```text
VERDICT A — UI-C1.2E
PAYMENTS BACKEND / READ-MODEL PREREQUISITES — ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — ACCEPTED
UI-C1.2A — ACCEPTED
UI-C1.2B — ACCEPTED
UI-C1.2C — ACCEPTED AFTER REMEDIATION R1
UI-C1.2D — ACCEPTED AFTER FINAL GIT CLOSURE R2
UI-C1.2E — ACCEPTED

PAYMENT DOMAIN AUDIT — PASS
REFUND DOMAIN AUDIT — PASS
PAYMENT STATUS COVERAGE — <N>/<N> PASS
REFUND STATUS COVERAGE — <N>/<N> PASS
STATIC OVERVIEW KPI BACKEND SEMANTICS — PASS
TABLE-ONLY KPI STATUS FILTERING — PASS
CURRENCY SEMANTICS — PASS
WORKSPACE / TENANT ISOLATION — PASS
RBAC — PASS
PCI / PII SAFETY — PASS
D7 AUTHORITY PRESERVATION — PASS
REGRESSION — PASS

FINAL SHA:
<ACTUAL 40-CHAR SHA>

WORKING TREE — CLEAN
HEAD == origin/master — PASS

UI-C1.2F — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2F — PAYMENTS TAB PRODUCTION IMPLEMENTATION
```

---

# 45. REQUIRED FINAL VERDICT FORMAT — FAIL

```text
VERDICT B — UI-C1.2E
PAYMENTS BACKEND / READ-MODEL PREREQUISITES — NOT ACCEPTED

FAILED AREA:
<exact defect>

IMPACT:
<why this blocks Payments UI>

EVIDENCE:
<tests / API / code / security / Git>

NO ADVANCE TO UI-C1.2F

UI-C1.2F — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

---

# 46. TRUE NEXT AFTER ACCEPTANCE

Only after UI-C1.2E receives VERDICT A:

```text
UI-C1.2F — PAYMENTS TAB PRODUCTION IMPLEMENTATION
```

UI-C1.2F will consume the backend contract created here for:

```text
Total
Payment statuses
Refund statuses
Currencies
Toolbar
Table
Pagination
Selected KPI behavior
Operations Center visual system
```

---

# 47. FINAL BINDING PRINCIPLE

```text
UI-C1.2E
IS NOT "BUILD THE PAYMENTS PAGE"

UI-C1.2E
IS:

AUDIT REAL FINANCE DOMAIN
→ ESTABLISH TRUTHFUL PAYMENT/REFUND READ MODEL
→ SEPARATE TABLE FILTER SCOPE FROM STATIC KPI OVERVIEW SCOPE
→ PRESERVE D7
→ PRESERVE SECURITY
→ QUALIFY CURRENCY SEMANTICS
→ TEST
→ CLEAN GIT CLOSURE
```
