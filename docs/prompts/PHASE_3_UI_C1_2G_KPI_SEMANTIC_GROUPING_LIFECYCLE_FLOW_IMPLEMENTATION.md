# PHASE 3 — UI-C1.2G — KPI SEMANTIC GROUPING / LIFECYCLE FLOW
## Operations Center — Requests / Orders / Bookings / Payments

---

# 0. Purpose

Implement the next Operations Center UI stage after closure of `UI-C1.2F.1`.

This stage improves the **semantic organization and visual lifecycle flow of KPI cards** across:

```text
Requests
Orders
Bookings
Payments
```

The goal is NOT to redesign filtering mechanics.

The goal is:

```text
make the existing server-authoritative KPI overview
read like a coherent business lifecycle
```

while preserving all accepted filtering, period, URL, security, and registry behavior.

---

# 1. Baseline

Current accepted repository baseline:

```text
a481048966c7ac788f8381069715d1b61032921f
```

Accepted state:

```text
UI-C1.2F.1 — CLOSED

PROD-01 — OPEN
Service Category Reporting — DEFERRED

UI-C1.2G — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

Before changing code:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git branch --show-current
```

Expected baseline ancestry:

```bash
git merge-base --is-ancestor a481048966c7ac788f8381069715d1b61032921f HEAD
echo $LASTEXITCODE
```

must return `0`.

If working tree contains unrelated modifications, STOP and report them.

---

# 2. Canonical Operations Center Composition

Preserve:

```text
HEADER / BREADCRUMBS
TABS
TOTAL
PRIMARY STATUS / LIFECYCLE KPI GROUP
SECONDARY / EXCEPTION KPI GROUP
PAYMENT / REFUND KPI GROUP
ATTENTION
TOOLBAR
TABLE
PAGINATION
```

Do not move global Period back into registry toolbars.

Canonical Header Period remains:

```text
GLOBAL SCOPE
→ KPI overview recomputes
→ table recomputes
```

---

# 3. Core Principle

```text
KPI SEMANTIC GROUPING
≠
NEW BUSINESS LOGIC
```

This stage organizes existing canonical statuses and aggregates.

Do NOT:

```text
invent statuses
merge canonical statuses in backend
change state machines
change KPI counts
change aggregate formulas
change filter semantics
derive business truth on frontend
```

A semantic group may visually contain several KPI cards, but every actual canonical status must remain individually visible.

Canonical rule remains:

```text
EVERY ACTUAL CANONICAL STATUS
→ ONE VISIBLE STATUS KPI CARD
```

---

# 4. Preserve Accepted KPI Interaction Contract

The accepted KPI interaction contract is immutable in this stage:

```text
KPI CARDS = STATIC OVERVIEW COUNTS

CLICK ONE KPI
→ card becomes active
→ filters ONLY TABLE

OTHER KPI CARDS
→ do not recalculate
→ do not zero
→ do not disappear

HEADER PERIOD CHANGE
→ KPI overview recomputes
→ table recomputes

TOTAL
→ clears active KPI/table-only dimension
→ preserves global period

REGISTRY RESET
→ clears registry/table filter state according to accepted registry contract
→ does NOT clear Header Period
```

KPI and table-header filter remain two entry points into the same URL-authoritative table-filter state.

Do not regress this behavior.

---

# 5. One-Active-KPI Invariant

Preserve existing one-active-card behavior.

Requests:

```text
status
```

Orders:

```text
status XOR paymentStatus
```

Bookings:

```text
status
```

Payments:

```text
paymentStatus XOR refundStatus XOR currencyCard
```

Semantic grouping must NOT introduce independent active state per group.

There is still exactly one active KPI/table-only business slice per registry where that invariant already applies.

---

# 6. Design Objective

Current KPI sets should become understandable at a glance.

The user should visually distinguish:

```text
normal lifecycle progression
waiting / in-progress states
successful terminal states
exception/problem states
financial/payment states
refund states
```

without needing to know internal enum order.

Use:

```text
group headings
spacing
layout hierarchy
subtle visual grouping
consistent card geometry
```

Do not create a decorative process diagram disconnected from real status cards.

---

# 7. Requests — Canonical Status Set

Preserve all 12 canonical Request statuses:

```text
NEW
CHECKING
SUPPLIER_TIMEOUT
PRICE_CHANGED
CUSTOMER_ACCEPTED
CONFIRMED
CONVERTED
REJECTED
UNAVAILABLE
EXPIRED
CUSTOMER_PAYMENT_TIMEOUT
CANCELLED_BY_CUSTOMER
```

Before implementation, audit the actual backend/state-machine semantics and existing localization.

Do not infer transitions solely from enum order.

Target semantic grouping should be based on actual lifecycle meaning, approximately:

```text
PRIMARY / LIFECYCLE
NEW
CHECKING
PRICE_CHANGED
CUSTOMER_ACCEPTED
CONFIRMED
CONVERTED

EXCEPTIONS / TERMINAL NEGATIVE
SUPPLIER_TIMEOUT
CUSTOMER_PAYMENT_TIMEOUT
REJECTED
UNAVAILABLE
EXPIRED
CANCELLED_BY_CUSTOMER
```

This is a design hypothesis to validate against actual code/contracts before finalizing.

If repository state-machine evidence contradicts this grouping, use repository truth and document the difference.

All 12 cards remain individually visible.

---

# 8. Orders — Canonical Status Sets

Preserve all 12 `OrderStatus` values:

```text
NEW
IN_PROCESSING
WAITING_FOR_DATA
READY_FOR_BOOKING
SENT_TO_BOOKING
PARTIALLY_FULFILLED
FULFILLED
READY_TO_CLOSE
CLOSED
CANCELLED
PROBLEM
SUSPENDED
```

Preserve all 4 `OrderPaymentStatus` values:

```text
UNPAID
PARTIALLY_PAID
PAID
REFUNDED
```

Target semantic grouping:

```text
ORDER LIFECYCLE
NEW
IN_PROCESSING
WAITING_FOR_DATA
READY_FOR_BOOKING
SENT_TO_BOOKING
PARTIALLY_FULFILLED
FULFILLED
READY_TO_CLOSE
CLOSED

ORDER EXCEPTIONS
CANCELLED
PROBLEM
SUSPENDED

PAYMENT
UNPAID
PARTIALLY_PAID
PAID
REFUNDED
```

Validate actual lifecycle/state-machine semantics first.

Do not change status transitions.

---

# 9. Bookings — Canonical Status Set

Preserve all 13 canonical Booking statuses:

```text
NEW
PREPARING_REQUEST
SENT_TO_SUPPLIER
AWAITING_CONFIRMATION
CONFIRMED
IN_SERVICE
COMPLETED
NEEDS_CLARIFICATION
SUPPLIER_REJECTED
CHANGE_REQUESTED
CANCELLATION_REQUESTED
CANCELLED
PROBLEM
```

Important:

```text
PARTIALLY_CONFIRMED DOES NOT EXIST
```

Do not introduce it.

`AWAITING_CONFIRMATION` remains canonical and visible even if no current producer exists.

Do not fabricate an incoming lifecycle transition.

Target semantic grouping:

```text
BOOKING LIFECYCLE
NEW
PREPARING_REQUEST
SENT_TO_SUPPLIER
AWAITING_CONFIRMATION
CONFIRMED
IN_SERVICE
COMPLETED

ATTENTION / CHANGE
NEEDS_CLARIFICATION
CHANGE_REQUESTED
CANCELLATION_REQUESTED

NEGATIVE / EXCEPTION
SUPPLIER_REJECTED
CANCELLED
PROBLEM
```

Validate against actual state-machine definitions before implementation.

---

# 10. Payments — Canonical Dimensions

Preserve all 6 `PaymentStatus` values:

```text
PENDING
AUTHORIZED
CAPTURED
FAILED
CANCELLED
REFUNDED
```

Preserve all 4 `RefundStatus` values:

```text
REQUESTED
APPROVED
PROCESSED
FAILED
```

Current runtime semantics already established:

```text
Payment:
PENDING → CAPTURED | FAILED | CANCELLED

AUTHORIZED / REFUNDED
→ reserved/historical/unreachable in current transition path
→ still visible truthfully

Refund:
REQUESTED → APPROVED → PROCESSED | FAILED
REQUESTED | APPROVED → FAILED
```

Do not falsely present `AUTHORIZED` or Payment `REFUNDED` as currently produced lifecycle transitions if code does not support them.

Target grouping:

```text
PAYMENT STATUS
PENDING
AUTHORIZED
CAPTURED
FAILED
CANCELLED
REFUNDED

REFUND STATUS
REQUESTED
APPROVED
PROCESSED
FAILED

CURRENCY
<dynamic server-authoritative currency cards>
```

Payment and Refund are separate dimensions.

Do not merge them into one fake state machine.

---

# 11. Total Card

Every registry retains its compact Total card.

Examples:

```text
Всего заявок
Всего заказов
Всего бронирований
Всего платежей
```

Total remains visually distinct from semantic status groups.

It represents the current GLOBAL scope, not a lifecycle state.

Click behavior remains accepted:

```text
Total
→ clears active KPI/table-only card filter
→ preserves Header Period
→ returns table to global-scope result
```

Do not make Total part of a status group.

---

# 12. Visual Grouping Requirements

Create/reuse a consistent grouping pattern across all four registries.

Preferred conceptual component:

```text
<KpiGroup
  title="..."
  description?="..."
>
  <KpiCard ... />
  ...
</KpiGroup>
```

Exact component naming is implementation-dependent.

Requirements:

```text
same group-title typography
same vertical spacing
same card gap
same responsive behavior
same selected-card treatment
same focus behavior
same empty/zero-count behavior
```

Do not duplicate four unrelated implementations if a safe shared presentation primitive is appropriate.

Do not over-generalize domain logic into the shared component.

Shared component owns presentation/layout, not business semantics.

---

# 13. Lifecycle Flow

Where useful, lifecycle groups should visually read left-to-right on wide screens and naturally wrap on narrower screens.

However:

```text
visual ordering
≠
claim that every adjacent status has a direct transition
```

This is especially important for:

```text
Bookings AWAITING_CONFIRMATION
Payments AUTHORIZED
Payments REFUNDED
exception states
```

Do not draw arrows between cards unless actual state-machine evidence proves those transitions and the design explicitly requires arrows.

Default implementation should prefer semantic ordering/grouping over hardcoded arrows.

---

# 14. Responsive Requirements

At minimum verify:

```text
desktop wide
tablet / ~1024px
narrow / ~671px
```

Requirements:

```text
no horizontal page overflow caused by KPI groups
cards wrap predictably
group headings remain associated with their cards
selected state remains obvious
counts remain readable
no clipped labels
table remains independent below KPI area
```

Do not solve narrow layouts by hiding canonical status cards.

---

# 15. Accessibility

Group semantics must remain accessible.

Requirements:

```text
KPI cards keyboard reachable if interactive
selected state exposed via existing aria-pressed or equivalent
group titles programmatically understandable where practical
focus ring preserved
no color-only selected/exception meaning
zero-value cards remain understandable
```

Do not regress the accepted `TableHeaderFilter` accessibility.

---

# 16. Localization

All new visible group headings/descriptions must use i18n.

Required languages:

```text
RU
AZ
EN
```

Do not hardcode Russian-only group titles.

Audit existing localization namespaces before adding keys.

Avoid duplicate keys if suitable canonical labels already exist.

---

# 17. Security / Authority

This stage is presentation-level semantic organization.

Preserve:

```text
server-authoritative KPI aggregates
server-authoritative filtering
server-side RBAC
workspace/tenant isolation
404-like cross-context behavior where already canonical
entitlement behavior
```

No frontend status grouping may become an authorization mechanism.

No hidden card may substitute for backend permission enforcement.

---

# 18. PROD-01 Boundary

`PROD-01` is registered and remains OPEN.

This stage MUST NOT introduce:

```text
service-category KPI grouping
hotel/tour category analytics
Seller Service Cards
Product/Service model
service-category reporting
package/composite-service model
```

Those questions remain deferred.

`UI-C1.2G` concerns **existing lifecycle/status/financial KPI semantics only**.

---

# 19. Attention Boundary

Do not prematurely implement `UI-C1.2H`.

This stage may visually label exception-oriented KPI groups, but must NOT build the future canonical `ATTENTION` section.

Specifically do not add:

```text
new attention counters
new urgency formulas
SLA calculations
stale-object logic
problem queues
new period/filter reconciliation
```

Those belong to:

```text
UI-C1.2H — Attention / Period / Filter Reconciliation
```

---

# 20. Data / Formula Guard

For every card before and after grouping prove:

```text
same server aggregate source
same count/value
same URL filter mapping
same selected-state semantics
```

No arithmetic regrouping is allowed to replace individual cards.

If a group heading displays a total, it must already have a canonical server-authoritative aggregate or be explicitly omitted.

Preferred:

```text
group heading = label only
```

unless an existing authoritative aggregate justifies more.

---

# 21. Implementation Audit First

Before coding, document the actual current implementation for each registry:

```text
component/file
KPI source
status enum source
existing card order
active filter state
URL parameter
header-filter synchronization
period source
localization keys
```

Also inspect actual state-machine/transition definitions where available.

Produce an audit matrix before choosing final group membership.

Example:

```text
Registry | Dimension | Canonical values | Current source | Proposed semantic group | Evidence
```

Do not proceed from memory alone.

---

# 22. Required Runtime Scenarios

After implementation verify all four registries.

## Requests

```text
12/12 canonical status cards visible
grouping correct
click status → table filters
header Status synchronizes
other KPI counts static
Total clears status
Header Period recomputes overview
reload restores URL state
```

## Orders

```text
12/12 OrderStatus visible
4/4 OrderPaymentStatus visible
lifecycle / exception / payment groups visible
status KPI → header status sync
payment KPI → header payment sync
cross-dimension click preserves one-active invariant
other KPI values static
Total clears active KPI filter
period remains global
```

## Bookings

```text
13/13 canonical statuses visible
PARTIALLY_CONFIRMED absent
AWAITING_CONFIRMATION visible
grouping does not imply fake transition
KPI/header status sync
static overview preserved
Total/reset/period semantics preserved
```

## Payments

```text
6/6 PaymentStatus visible
4/4 RefundStatus visible
dynamic currency cards preserved
Payment / Refund / Currency groups distinct
one-active invariant preserved
currencyCard semantics preserved
no mixed-currency total introduced
static overview preserved
period global
```

---

# 23. URL / History Regression

For each registry prove grouping does not alter accepted URL behavior.

At minimum:

```text
click KPI
reload
Back/Forward where existing history entry exists
direct deep-link
Total
Reset
Header Period change
tab switch
```

Do not migrate accepted replace semantics to push semantics in this stage.

---

# 24. API ↔ UI Reconciliation

Use representative seeded data and prove that visual regrouping did not change values.

For each registry:

```text
API aggregate count/value
=
displayed KPI count/value
```

Check at least:

```text
one normal lifecycle status
one exception/negative status
```

For Orders additionally:

```text
one payment status
```

For Payments additionally:

```text
one refund status
one currency card
```

Where a seeded status has zero rows, zero is valid; do not manufacture fixtures merely to make a card non-zero unless existing test conventions require a controlled fixture.

---

# 25. Tests

Add/update tests for semantic grouping.

At minimum cover:

```text
all canonical statuses rendered exactly once
correct group membership
Total outside status groups
selected KPI semantics unchanged
one-active invariant unchanged
static overview unchanged under table-only filters
Header Period still global
RU/AZ/EN group labels
accessibility selected state
responsive-safe markup/layout where testable
```

Preserve existing tests for:

```text
Requests
Orders
Bookings
Payments
TableHeaderFilter
Operations Center shell
```

Run targeted suites.

Then run full frontend test suite.

Known historical baseline:

```text
one pre-existing i18n NBSP failure may still exist
```

Do not automatically classify a new failure as pre-existing.

Compare exact failing test/signature.

Run:

```text
frontend typecheck
frontend production build
```

If backend source is unchanged, backend test rerun is not mandatory unless frontend/API contract changes unexpectedly.

---

# 26. Browser / Console

Run browser verification.

Required:

```text
Requests
Orders
Bookings
Payments
```

Check:

```text
no React errors
no hydration errors
no duplicate-key warnings
no accessibility console warnings introduced by grouping
no unexpected API failures
no horizontal overflow from KPI grouping
```

Deliberate invalid-input tests are not required in this stage; those were covered by prior qualification and known backend validation debt remains separate.

---

# 27. Known Debt — Do Not Fix Here

Do not expand scope to remediate known backend validation gaps, including previously observed examples such as:

```text
Orders malformed date → 500
Bookings malformed date → 500
Bookings invalid status → 500
Requests invalid status → 500
```

These are not `UI-C1.2G` blockers unless this stage introduces a regression in the same path.

Do not reopen accepted D5/D6/D7/UI-C1.2F.1 findings absent a real regression.

---

# 28. Git Scope Guard

Before commit:

```bash
git status --porcelain=v1
git diff --name-only
git diff --stat
git diff --check
```

Review every changed file.

Allowed:

```text
Operations Center registry UI
shared KPI presentation component(s)
relevant i18n
tests
stage prompt/report
```

Unexpected backend/domain/schema changes:

```text
STOP
VERDICT B
```

---

# 29. Required Implementation Report

Create:

```text
docs/reports/PHASE_3_UI_C1_2G_KPI_SEMANTIC_GROUPING_LIFECYCLE_FLOW_IMPLEMENTATION_REPORT.md
```

Report must include:

```text
baseline SHA
final implementation SHA
files changed
audit matrix
final semantic grouping matrix
status coverage counts
runtime evidence
API↔UI reconciliation
test results
typecheck/build
browser/console results
responsive/a11y results
Git evidence
known unchanged debt
```

No placeholders in final evidence.

---

# 30. Git Hard Closure

After implementation/tests/report:

```bash
git diff --check
git status --porcelain=v1
```

Commit with an appropriate message, for example:

```text
feat: group Operations Center KPIs by lifecycle semantics
```

Push:

```bash
git push origin master
git fetch origin
```

Then literal final proof:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git branch --show-current
git log -8 --oneline --decorate
git merge-base --is-ancestor a481048966c7ac788f8381069715d1b61032921f HEAD
echo $LASTEXITCODE
```

Required:

```text
working tree clean
HEAD == origin/master
branch = master
baseline ancestry = 0
```

---

# 31. Required Final Acceptance Matrix

Use actual results only.

```text
PHASE 3 — UI-C1.2G
KPI SEMANTIC GROUPING / LIFECYCLE FLOW

BASELINE SHA:
a481048966c7ac788f8381069715d1b61032921f

FINAL SHA:
<actual full 40-char SHA>

REQUESTS 12/12 STATUS COVERAGE        — PASS
ORDERS 12/12 STATUS COVERAGE          — PASS
ORDERS 4/4 PAYMENT COVERAGE           — PASS
BOOKINGS 13/13 STATUS COVERAGE        — PASS
PAYMENTS 6/6 STATUS COVERAGE          — PASS
REFUNDS 4/4 STATUS COVERAGE           — PASS
DYNAMIC CURRENCY CARDS                — PRESERVED

SEMANTIC GROUPING                     — PASS
LIFECYCLE ORDERING                    — PASS
EXCEPTION GROUPING                    — PASS
TOTAL CARD SEPARATION                 — PASS

STATIC KPI OVERVIEW                   — PRESERVED
ONE-ACTIVE KPI INVARIANT              — PRESERVED
KPI ↔ HEADER FILTER SYNC              — PRESERVED
HEADER PERIOD GLOBAL SCOPE            — PRESERVED
URL / RELOAD / HISTORY                — PASS
TAB PERIOD CARRY                      — PRESERVED

SERVER-AUTHORITATIVE AGGREGATES       — PRESERVED
API ↔ UI RECONCILIATION               — PASS
RBAC / WORKSPACE SECURITY SURFACE     — UNCHANGED

RU / AZ / EN                          — PASS
ACCESSIBILITY                         — PASS
RESPONSIVE                            — PASS
BROWSER CONSOLE                       — PASS

TARGETED TESTS                        — PASS
FULL FRONTEND TESTS                   — PASS / KNOWN PRE-EXISTING ONLY
TYPECHECK                             — PASS
PRODUCTION BUILD                      — PASS

PROD-01                               — OPEN / UNCHANGED
SERVICE CATEGORY REPORTING            — DEFERRED / UNCHANGED
UI-C1.2H                              — NOT STARTED
UI-C2                                 — NOT STARTED
D8                                    — NOT STARTED

WORKING TREE CLEAN                    — PASS
HEAD == origin/master                 — PASS
BASELINE ANCESTRY                     — PASS

VERDICT A — UI-C1.2G ACCEPTED
```

If a mandatory condition fails:

```text
VERDICT B — UI-C1.2G NOT ACCEPTED

BLOCKER:
<exact defect>
```

Do not self-award acceptance without literal evidence.

---

# 32. STOP

After completing `UI-C1.2G`:

```text
STOP
```

Do not automatically start:

```text
UI-C1.2H
UI-C1.2I
UI-C1.2J
UI-C1.2K
UI-C2
D8
PROD-01
```

Wait for independent review.
