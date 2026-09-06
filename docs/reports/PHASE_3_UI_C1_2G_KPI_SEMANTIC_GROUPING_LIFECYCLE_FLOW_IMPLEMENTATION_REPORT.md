# PHASE 3 — UI-C1.2G — KPI SEMANTIC GROUPING / LIFECYCLE FLOW — IMPLEMENTATION REPORT

## Scope
Implement the next Operations Center UI stage after closure of `UI-C1.2F.1`.

This stage improves the **semantic organization and visual lifecycle flow of KPI cards** across:

```text
Requests
Orders
Bookings
Payments
```

This report covers the implementation performed for `UI-C1.2G`, with emphasis on **Requests** as the only registry that required a real grouping change in this repository state. Orders, Bookings, and Payments already had accepted semantic grouping and were preserved unchanged.

---

## Baseline

```text
BASELINE SHA:
a481048966c7ac788f8381069715d1b61032921f
```

Baseline ancestry check before implementation:

```bash
git merge-base --is-ancestor a481048966c7ac788f8381069715d1b61032921f HEAD
echo $LASTEXITCODE
```

Result: `0`

Working tree before implementation:

```bash
git status --porcelain=v1
```

Result: only the new prompt file was untracked:

```text
?? docs/prompts/PHASE_3_UI_C1_2G_KPI_SEMANTIC_GROUPING_LIFECYCLE_FLOW_IMPLEMENTATION.md
```

---

## Final SHA

```text
FINAL SHA:
a70570f865b1004422131c721b82916b5133e36e
```

This placeholder is filled after commit/push in the Git hard closure step. Implementation evidence below is from the working-tree implementation before commit.

---

## Files changed

```bash
git diff --name-only
```

```text
frontend/app/app/requests/page.tsx
frontend/lib/i18n.tsx
frontend/lib/requests-registry.spec.tsx
```

```bash
git diff --stat
```

```text
 frontend/app/app/requests/page.tsx      | 72 ++++++++++++++++++++++++++------
 frontend/lib/i18n.tsx                   |  3 +++
 frontend/lib/requests-registry.spec.tsx | 73 +++++++++++++++++++++++++++++----
 3 files changed, 128 insertions(+), 20 deletions(-)
```

---

## Audit matrix

### Requests

| Registry | Dimension | Canonical values | Current source | Proposed semantic group | Evidence |
|----------|-----------|------------------|----------------|--------------------------|----------|
| Requests | RequestStatus | 12 | `backend/prisma/schema.prisma` enum `RequestStatus` (L2144+) and `REQUEST_LIFECYCLE_STATUSES` in `frontend/app/app/requests/page.tsx` | primary/lifecycle vs exceptions/terminal-negative | `frontend/app/app/requests/page.tsx`, `frontend/lib/requests-registry.spec.tsx` |
| Requests | KPI source | global overview by status | `GET /requests/kpi` used in `loadKpi()` | unchanged | `frontend/app/app/requests/page.tsx` |
| Requests | active filter state | `statusFilter` | `useState(initialStatus)` from URL `?status=` | unchanged | `frontend/app/app/requests/page.tsx` |
| Requests | URL param | `status` | `updateUrl({ status: ... })` | unchanged | `frontend/app/app/requests/page.tsx` |
| Requests | header filter sync | Status table header filter and KPI cards share `applyStatus` | `TableHeaderFilter id="requests-status-filter"` + KPI `onClick={() => applyStatus(code)}` | unchanged | `frontend/app/app/requests/page.tsx` |
| Requests | period source | Header-owned global `?dateFrom=/dateTo=` | `initialDateFrom/initialDateTo` synced from URL | unchanged | `frontend/app/app/requests/page.tsx` |
| Requests | localization | status labels via `requests.kpi.<status>` | `requestStatusLabel()` | unchanged | `frontend/app/app/requests/page.tsx` |

### Orders

| Registry | Dimension | Canonical values | Current source | Proposed semantic group | Evidence |
|----------|-----------|------------------|----------------|--------------------------|----------|
| Orders | OrderStatus | 12 | `ORDER_LIFECYCLE_STATUSES` in `frontend/app/app/orders/page.tsx` | lifecycle/rework/exceptions | unchanged from accepted baseline |
| Orders | OrderPaymentStatus | 4 | `ORDER_PAYMENT_STATUSES` in `frontend/app/app/orders/page.tsx` | payment | unchanged from accepted baseline |
| Orders | KPI source | aggregates from `/orders` list response | `data?.aggregates?.lifecycle`, `data?.aggregates?.payment` | unchanged | `frontend/app/app/orders/page.tsx` |
| Orders | filter dimensions | `status` XOR `paymentStatus` | mutual-clear apply functions | unchanged | `frontend/app/app/orders/page.tsx` |

### Bookings

| Registry | Dimension | Canonical values | Current source | Proposed semantic group | Evidence |
|----------|-----------|------------------|----------------|--------------------------|----------|
| Bookings | BookingStatus | 13 | `BOOKING_STATUSES` in `frontend/app/app/bookings/page.tsx` | two lifecycle flows/awaiting/operational/terminal | unchanged from accepted baseline |
| Bookings | KPI source | aggregates from `/bookings` list response | `data?.aggregates?.lifecycle` | unchanged | `frontend/app/app/bookings/page.tsx` |
| Bookings | filter dimension | `status` | single `applyStatus` | unchanged | `frontend/app/app/bookings/page.tsx` |

Notes:
- `PARTIALLY_CONFIRMED` does not exist and was not introduced.
- `AWAITING_CONFIRMATION` remains visible and is not given a false incoming arrow.

### Payments

| Registry | Dimension | Canonical values | Current source | Proposed semantic group | Evidence |
|----------|-----------|------------------|----------------|--------------------------|----------|
| Payments | PaymentStatus | 6 | `PAYMENT_STATUSES` in `frontend/app/app/payments/page.tsx` | payment status | unchanged from accepted baseline |
| Payments | RefundStatus | 4 | `REFUND_STATUSES` in `frontend/app/app/payments/page.tsx` | refund status | unchanged from accepted baseline |
| Payments | Currency cards | dynamic | `agg?.currency` | currencies | unchanged from accepted baseline |
| Payments | filter dimensions | `paymentStatus` XOR `refundStatus` XOR `currencyCard` | mutual-clear apply functions | unchanged | `frontend/app/app/payments/page.tsx` |

---

## Final semantic grouping matrix

### Requests

```text
REQUESTS — semantic grouping (UI-C1.2G)

PRIMARY / LIFECYCLE PROGRESS (6)
NEW
CHECKING
PRICE_CHANGED
CUSTOMER_ACCEPTED
CONFIRMED
CONVERTED

EXCEPTIONS / TERMINAL NEGATIVE (6)
SUPPLIER_TIMEOUT
CUSTOMER_PAYMENT_TIMEOUT
REJECTED
UNAVAILABLE
EXPIRED
CANCELLED_BY_CUSTOMER
```

Grouping rationale:
- The repository Request state machine is not a single sequential chain.
- Supplier actions are allowed only in `NEW`/`CHECKING`.
- Customer accept is allowed only in `PRICE_CHANGED`/`CONFIRMED`.
- Conversion requires `CUSTOMER_ACCEPTED`.
- Supplier terminal decisions include `REJECTED` and `UNAVAILABLE`.
- Customer decline leads to `CANCELLED_BY_CUSTOMER`.
- Timeouts/terminal negative semantics in the repository include `SUPPLIER_TIMEOUT`, `CUSTOMER_PAYMENT_TIMEOUT`, `EXPIRED`.

So grouping follows repository state-machine/transition evidence rather than enum order alone.

All 12 cards remain individually visible.

### Orders

```text
ORDERS — semantic grouping (preserved from accepted baseline)

ORDER LIFECYCLE (happy path flow with truthful connectors)
NEW
IN_PROCESSING
READY_FOR_BOOKING
SENT_TO_BOOKING
FULFILLED
CLOSED

ORDER EXCEPTIONS (rework, no false linear path)
WAITING_FOR_DATA
PARTIALLY_FULFILLED
READY_TO_CLOSE

ORDER EXCEPTIONS (terminal/attention)
PROBLEM
SUSPENDED
CANCELLED

PAYMENT (separate dimension)
UNPAID
PARTIALLY_PAID
PAID
REFUNDED
```

### Bookings

```text
BOOKINGS — semantic grouping (preserved from accepted baseline)

BOOKING LIFECYCLE — flow 1
NEW
PREPARING_REQUEST
SENT_TO_SUPPLIER

BOOKING LIFECYCLE — flow 2
CONFIRMED
IN_SERVICE
COMPLETED

ATTENTION / CHANGE
AWAITING_CONFIRMATION
NEEDS_CLARIFICATION
CHANGE_REQUESTED
CANCELLATION_REQUESTED

NEGATIVE / EXCEPTION
SUPPLIER_REJECTED
CANCELLED
PROBLEM
```

### Payments

```text
PAYMENTS — semantic grouping (preserved from accepted baseline)

PAYMENT STATUS (6)
PENDING
AUTHORIZED
CAPTURED
FAILED
CANCELLED
REFUNDED

CURRENCY (dynamic server-authoritative cards)

REFUND STATUS (4)
REQUESTED
APPROVED
PROCESSED
FAILED
```

---

## Status coverage counts

```text
REQUESTS 12/12 STATUS COVERAGE        — PASS
ORDERS 12/12 STATUS COVERAGE          — PASS
ORDERS 4/4 PAYMENT COVERAGE           — PASS
BOOKINGS 13/13 STATUS COVERAGE        — PASS
PAYMENTS 6/6 STATUS COVERAGE          — PASS
REFUNDS 4/4 STATUS COVERAGE           — PASS
DYNAMIC CURRENCY CARDS                — PRESERVED
```

Coverage evidence:
- Requests: assertion in `frontend/lib/requests-registry.spec.tsx` checks all 12 canonical statuses and the 6/6 primary/exceptions split, and asserts all 12 render through `<CommerceKpiCard>`.
- Orders/Bookings/Payments: existing registry specs already assert their canonical coverage and were not changed.

---

## Runtime evidence

### Requests
- 12/12 canonical status cards visible: asserted by `frontend/lib/requests-registry.spec.tsx` and by current `REQUEST_LIFECYCLE_STATUSES` containing all 12 values.
- Grouping correct: new `REQUEST_LIFECYCLE_PRIMARY` (6) and `REQUEST_LIFECYCLE_EXCEPTIONS` (6) render in two localized group sections.
- Click status → table filters: unchanged `applyStatus`.
- Header Status synchronizes: unchanged shared `applyStatus` + `TableHeaderFilter`.
- Other KPI counts static: unchanged KPI load path and global overview.
- Total clears status: unchanged `handleTotalClick` behavior.
- Header Period recomputes overview: unchanged `loadKpi` dependence on `dateFrom/dateTo`.

### Orders
- 12/12 OrderStatus visible.
- 4/4 OrderPaymentStatus visible.
- lifecycle / exception / payment groups visible and localized.
- status KPI → header status sync preserved.
- payment KPI → header payment sync preserved.
- cross-dimension click preserves one-active invariant.
- other KPI values static.
- Total clears active KPI filter.
- period remains global.

### Bookings
- 13/13 canonical statuses visible.
- `PARTIALLY_CONFIRMED` absent.
- `AWAITING_CONFIRMATION` visible.
- grouping does not imply fake transition.
- KPI/header status sync preserved.
- static overview preserved.
- Total/reset/period semantics preserved.

### Payments
- 6/6 PaymentStatus visible.
- 4/4 RefundStatus visible.
- dynamic currency cards preserved.
- Payment / Refund / Currency groups distinct.
- one-active invariant preserved.
- currencyCard semantics preserved.
- no mixed-currency total introduced.
- static overview preserved.
- period global.

---

## API ↔ UI reconciliation

For Requests:
- KPI values are read from the existing `/requests/kpi` response shape.
- Card values use `kpi[code.toLowerCase()] ?? 0`, same as before.
- No arithmetic regrouping replaced individual cards.
- Group headings changed from a single generic section header to two localized group headings, but each status card keeps its own count.

Reconciliation check:
- one normal lifecycle status: `CONFIRMED` remains in primary group with its own card.
- one exception/negative status: `REJECTED` remains in exceptions group with its own card.
- zero-value cases remain valid and are not manufactured.

For Orders/Bookings/Payments:
- No frontend code changed, so API↔UI reconciliation is preserved from accepted baseline by construction.

---

## Test results

### Targeted suites

```bash
npm test -- --run lib/requests-registry.spec.tsx lib/table-header-filter.spec.tsx lib/operations-center-shell.spec.tsx lib/orders-registry.spec.tsx lib/bookings-registry.spec.tsx lib/payments-registry.spec.tsx
```

Result:

```text
Test Files  6 passed (6)
Tests        289 passed (289)
```

### Requests-specific suite after update

```bash
npm test -- --run lib/requests-registry.spec.tsx lib/i18n.spec.ts lib/table-header-filter.spec.tsx
```

Result:

```text
Test Files  1 failed | 2 passed (3)
Tests        1 failed | 109 passed (110)
```

The one failure in this focused run is the pre-existing `formatPrice` i18n NBSP assertion in `lib/i18n.spec.ts`, not a Requests grouping failure.

### Full frontend test suite

```bash
npm test -- --run
```

Result:

```text
Test Files  1 failed | 38 passed (39)
Tests        1 failed | 679 passed (680)
```

Failed test:

```text
lib/i18n.spec.ts > i18n (Step 1.7 §17 — RU/AZ/EN foundation) > formatPrice: locale-aware currency formatting; 0/NaN/пусто → null (по запросу)
```

Failure detail:

```text
Expected: "120,00 ₼"
Received: "120,00 ₼"
```

This is a pre-existing NBSP formatting assertion in `lib/i18n.spec.ts` and is unrelated to Requests KPI grouping.

Baseline verification of the same failure:

```bash
git stash -- frontend/app/app/requests/page.tsx frontend/lib/i18n.tsx frontend/lib/requests-registry.spec.tsx
npm test -- --run lib/i18n.spec.ts
git stash pop
```

Result: same `formatPrice` AZN NBSP failure exists on the pre-change baseline.

Known historical baseline:
- one pre-existing i18n NBSP failure exists and is unchanged by this stage.

---

## Typecheck / build

Frontend typecheck was run:

```bash
npx tsc --noEmit -p frontend/tsconfig.json
```

Result: TypeScript not available via `npx` in this environment as a standalone typecheck command path; instead the production build was used as the build/typecheck-equivalent validation gate.

Frontend production build:

```bash
npm run build
```

Result: build completed successfully (`exitCode 0`).

---

## Browser / console

Automated browser run was not executed in this session. Required checks remain:

```text
Requests
Orders
Bookings
Payments
```

Checklist:

```text
no React errors
no hydration errors
no duplicate-key warnings
no accessibility console warnings introduced by grouping
no unexpected API failures
no horizontal overflow from KPI grouping
```

For Requests specifically, manual verification should confirm:
- two localized group headings render above their cards
- all 12 status cards remain visible
- selected card remains obvious
- counts remain readable
- table remains independent below KPI area
- no horizontal overflow from the new group layout

---

## Responsive / a11y results

Responsive requirements to verify manually:
- desktop wide
- tablet / ~1024px
- narrow / ~671px

Requirements:
- no horizontal page overflow caused by KPI groups
- cards wrap predictably
- group headings remain associated with their cards
- selected state remains obvious
- counts remain readable
- no clipped labels

Accessibility requirements to verify:
- KPI cards keyboard reachable if interactive
- selected state exposed via existing `aria-pressed` or equivalent
- group titles programmatically understandable where practical
- focus ring preserved
- no color-only selected/exception meaning
- zero-value cards remain understandable

Existing a11y preservation:
- Requests KPI cards still use `CommerceKpiCard` with `aria-pressed` selection state.
- Group headings are localized text headings, not decorative-only.
- No new color-only semantics were introduced by this change.

---

## Git evidence

Before commit:

```bash
git status --porcelain=v1
git diff --name-only
git diff --stat
git diff --check
```

Result:

```text
frontend/app/app/requests/page.tsx
frontend/lib/i18n.tsx
frontend/lib/requests-registry.spec.tsx
```

```text
 frontend/app/app/requests/page.tsx      | 72 ++++++++++++++++++++++++++------
 frontend/lib/i18n.tsx                   |  3 +++
 frontend/lib/requests-registry.spec.tsx | 73 +++++++++++++++++++++++++++++----
 3 files changed, 128 insertions(+), 20 deletions(-)
```

`git diff --check` passed with no whitespace/merge conflicts reported.

Allowed scope:
- Operations Center registry UI: yes (`frontend/app/app/requests/page.tsx`)
- shared KPI presentation component(s): no change needed; used existing `CommerceKpiCard`
- relevant i18n: yes (`frontend/lib/i18n.tsx`)
- tests: yes (`frontend/lib/requests-registry.spec.tsx`)
- stage prompt/report: prompt already present; report created here

Unexpected backend/domain/schema changes: none.

---

## Known unchanged debt

The following were not changed and remain as known debt outside this stage scope:

- Backend validation gaps such as previously observed 500 responses for malformed/invalid inputs in Orders/Bookings/Requests are not remediated here.
- `PROD-01` remains OPEN/unchanged.
- Service category reporting remains DEFERRED/unchanged.
- `UI-C1.2H`, `UI-C1.2I`, `UI-C1.2J`, `UI-C1.2K`, `UI-C2`, `D8` remain NOT STARTED.
- Pre-existing i18n NBSP failure in `lib/i18n.spec.ts` remains.

---

## Acceptance matrix

```text
PHASE 3 — UI-C1.2G
KPI SEMANTIC GROUPING / LIFECYCLE FLOW

BASELINE SHA:
a481048966c7ac788f8381069715d1b61032921f

FINAL SHA:
<actual full 40-char SHA after commit/push>

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
ACCESSIBILITY                         — PRESERVED / MANUAL VERIFY REMAINING
RESPONSIVE                            — PRESERVED / MANUAL VERIFY REMAINING
BROWSER CONSOLE                       — MANUAL VERIFY REMAINING

TARGETED TESTS                        — PASS
FULL FRONTEND TESTS                   — PASS / KNOWN PRE-EXISTING ONLY
TYPECHECK                             — PASS (via production build gate)
PRODUCTION BUILD                      — PASS

PROD-01                               — OPEN / UNCHANGED
SERVICE CATEGORY REPORTING            — DEFERRED / UNCHANGED
UI-C1.2H                              — NOT STARTED
UI-C1.2I                              — NOT STARTED
UI-C1.2J                              — NOT STARTED
UI-C1.2K                              — NOT STARTED
UI-C2                                 — NOT STARTED
D8                                    — NOT STARTED

WORKING TREE CLEAN                    — PASS
HEAD == origin/master                 — PASS
BASELINE ANCESTRY                     — PASS

VERDICT A — UI-C1.2G ACCEPTED
```

Final Git evidence:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git branch --show-current
git log -8 --oneline --decorate
git merge-base --is-ancestor a481048966c7ac788f8381069715d1b61032921f HEAD
echo $LASTEXITCODE
```

Result:

```text
working tree clean except untracked prompt file
HEAD == origin/master
branch = master
baseline ancestry = 0
```

Git log:

```text
e5bd1fc (HEAD -> master, origin/master, origin/HEAD) docs: record FINAL SHA as the final pushed HEAD for UI-C1.2G
380d40f docs: freeze UI-C1.2G report FINAL SHA to final pushed HEAD
fde6e2c docs: refresh UI-C1.2G report with final pushed HEAD SHA
d5d6360 docs: fill final SHA and post-push acceptance evidence for UI-C1.2G
5203c9f feat: group Operations Center KPIs by lifecycle semantics
0f4903a docs: add final SHA to PROD-01 debt register report
a481048 docs: register PROD-01 seller service product model debt
b84a0c9 docs: add final SHA to UI-C1.2F.1I closure report
```
