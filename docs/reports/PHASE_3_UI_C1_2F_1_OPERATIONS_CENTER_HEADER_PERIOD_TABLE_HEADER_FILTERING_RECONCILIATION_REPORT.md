# UI-C1.2F.1 — OPERATIONS CENTER HEADER PERIOD & TABLE HEADER FILTERING — RECONCILIATION REPORT

## A. Executive Summary

Unified architecture **IS FEASIBLE**. All 4 registries have backend `dateFrom`/`dateTo` support on `createdAt`. Three registries (Orders, Bookings, Payments) already expose date filters in the toolbar with KPI scope parity. Requests has backend support but frontend does NOT expose it, and the Requests KPI endpoint is a separate global endpoint that does NOT accept date params — this is the **only architectural gap requiring a backend change before Header Period can be implemented**.

**Critical architectural rule (R2 correction):** The shared Operations Center Header Period is a **GLOBAL SCOPE**. It MUST synchronously re-scope both KPI overview values and the table. It is NOT merely a table filter. Static KPI overview means static against **table-only filters**, not against Header Period.

Requests will NOT gain toolbar date controls. Instead, Requests will consume the shared Header Period directly (once its KPI endpoint gains date scope). Table-header filtering for status/payment/currency dimensions is feasible as a UI migration of existing toolbar controls to table-header dropdowns, preserving the existing server-side contract.

## B. Current-State Evidence

### OperationsCenterShell

- **Header**: breadcrumbs + "Центр операций" title + `headerActions` slot + tabs
- **NO period slot** in the current header
- **Tabs**: `<Link href="/app/requests">` etc. — full page navigation (not SPA), no shared state
- **`headerActions`** slot: currently used by Orders (refresh button), Payments (empty)

### Requests (/app/requests)

| Aspect | Current state |
|---|---|
| Toolbar | [Search] [Status select] [Reset] [CSV] |
| URL params | `?search=&status=&page=` |
| Date filter | **NOT exposed** in frontend |
| Backend date support | YES — `dateFrom`/`dateTo` in controller + service, filters on `createdAt` |
| KPI source | **Separate endpoint** `/requests/kpi` — no date param, global counts only |
| KPI ↔ table scope | KPI is **global** (no date scope), table supports dateFrom/dateTo |
| Sortable headers | NO (plain `<th>`) |
| Table columns | ref, customer, product, supplier, displayed price, confirmed price, service date, status, created, SLA deadline |

### Orders (/app/orders)

| Aspect | Current state |
|---|---|
| Toolbar | [Search] [Status select] [PaymentStatus select] [DateFrom] [DateTo] [Reset] [CSV] [XLSX] |
| URL params | `?search=&status=&paymentStatus=&dateFrom=&dateTo=&page=&sortBy=&sortDirection=` |
| Date filter | **EXPOSED** — dateFrom/dateTo in toolbar |
| Backend date support | YES — `dateFrom`/`dateTo` in ListOrdersQuery DTO + service, filters on `createdAt` |
| KPI source | Same list endpoint `aggregates.lifecycle` + `aggregates.payment` |
| KPI ↔ table scope | KPI uses `overviewWhere` (strips status/paymentStatus, keeps dateFrom/dateTo) |
| Sortable headers | YES — code, createdAt, amount, status, paymentStatus |
| Table columns | code, date, amount, items, status, paymentStatus |

### Bookings (/app/bookings)

| Aspect | Current state |
|---|---|
| Toolbar | [Search] [Status select] [DateFrom] [DateTo] [Reset] [CSV] [XLSX] |
| URL params | `?search=&status=&dateFrom=&dateTo=&page=&sortBy=&sortDirection=` |
| Date filter | **EXPOSED** — dateFrom/dateTo in toolbar |
| Backend date support | YES — `dateFrom`/`dateTo` in ListBookingsQuery DTO + service, filters on `createdAt` |
| KPI source | Same list endpoint `aggregates.lifecycle` |
| KPI ↔ table scope | KPI aggregates use the date-scoped where |
| Sortable headers | YES |
| Table columns | ref, date, order, status, customer |

### Payments (/app/payments)

| Aspect | Current state |
|---|---|
| Toolbar | [Search] [DateFrom] [DateTo] [Reset] [CSV] [XLSX] |
| URL params | `?search=&paymentStatus=&refundStatus=&currencyCard=&dateFrom=&dateTo=&page=&sortBy=&sortDirection=` |
| Date filter | **EXPOSED** — dateFrom/dateTo in toolbar |
| Backend date support | YES — `dateFrom`/`dateTo` + `dateField` (createdAt default, paidAt deep-link) |
| KPI source | Same list endpoint `aggregates.{total, paymentStatus, refundStatus, currency}` |
| KPI ↔ table scope | KPI uses `baseWhere` (includes date scope, strips paymentStatus/refundStatus/currencyCard) |
| Sortable headers | YES — code, createdAt, amount, status, paidAt |
| Table columns | code, created, amount, currency, status, method, order, paid_at, provider |

## C. Period Semantics Matrix

| Registry | Backend date support | Frontend exposed | Canonical date field | KPI affected by date | Header-period ready |
|---|---|---|---|---|---|
| Requests | YES (`dateFrom`/`dateTo` in controller+service) | **NO** | `createdAt` | **NO** (separate KPI endpoint, no date param) | **GAP** — KPI must gain date scope first |
| Orders | YES (`dateFrom`/`dateTo` in DTO+service) | YES (toolbar) | `createdAt` | YES (overviewWhere includes date range) | YES |
| Bookings | YES (`dateFrom`/`dateTo` in DTO+service) | YES (toolbar) | `createdAt` | YES (aggregates scoped by date) | YES |
| Payments | YES (`dateFrom`/`dateTo` + `dateField` in DTO+service) | YES (toolbar) | `createdAt` (default), `paidAt` (analytics) | YES (baseWhere includes date range) | YES |

**Requests gap detail**: The backend controller accepts `dateFrom`/`dateTo` and the service filters `createdAt`. But the frontend never sends these params. Furthermore, the KPI endpoint (`/requests/kpi`) uses `prisma.request.groupBy` with NO where clause — it always returns global counts regardless of date. Moving period to the Header while Requests KPI remains global would create a visible inconsistency: the table filters by date but the KPI cards show global counts.

**R2 correction**: Requests will NOT gain toolbar date controls. Instead, Requests will consume the shared Header Period directly — the Header's `dateFrom`/`dateTo` will be passed to both the Requests list query and the Requests KPI query (once the KPI backend gains date scope). No local date inputs.

## D. Filter Ownership Matrix

| Filter | Header | Toolbar | KPI | Table Header | Global vs Table-only | Persist Across Tabs |
|---|---|---|---|---|---|---:|
| Period (dateFrom/dateTo) | **TARGET** | CURRENT (Orders/Bookings/Payments) — to be removed | affected (all 4 after G1) | NO | **GLOBAL** (affects KPI + table) | **YES** (target) |
| Search | NO | YES (all 4) | NO | NO | GLOBAL registry scope | NO |
| Status | NO | YES (all 4) | YES (all 4) | **TARGET** | TABLE-ONLY | NO |
| Payment Status | NO | YES (Orders) | YES (Orders) | **TARGET** | TABLE-ONLY | NO |
| Refund Status | NO | NO (Payments KPI only) | YES (Payments) | **TARGET** | TABLE-ONLY | NO |
| Currency card scope | NO | NO | YES (Payments) | **TARGET** | TABLE-ONLY | NO |
| Export | NO | YES (all 4) | NO | NO | action | N/A |
| Reset | NO | YES (all 4) | NO | NO | action | N/A |

## E. URL / History Contract

### Current parameter names per registry

| Param | Requests | Orders | Bookings | Payments |
|---|---|---|---|---|
| `search` | ✅ | ✅ | ✅ | ✅ |
| `status` | ✅ | ✅ | ✅ | — |
| `paymentStatus` | — | ✅ | — | ✅ |
| `refundStatus` | — | — | — | ✅ |
| `currencyCard` | — | — | — | ✅ |
| `dateFrom` | — (backend supports) | ✅ | ✅ | ✅ |
| `dateTo` | — (backend supports) | ✅ | ✅ | ✅ |
| `dateField` | — | — | — | ✅ (analytics) |
| `page` | ✅ | ✅ | ✅ | ✅ |
| `sortBy` | — | ✅ | ✅ | ✅ |
| `sortDirection` | — | ✅ | ✅ | ✅ |

**Compatibility note**: Orders accepts both `from`/`to` AND `dateFrom`/`dateTo` (line `sp.get("from") ?? sp.get("dateFrom")`). This preserves analytics deep-link compatibility. A Header period implementation should use `dateFrom`/`dateTo` as canonical and maintain `from`/`to` as aliases.

### Tab Navigation Current State

All tabs are `<Link href="/app/requests">` etc. — plain anchor navigation. There is **no shared state mechanism** between tabs. Switching tabs performs a full route change. Each registry reads its initial state from `useSearchParams()`.

**Tab-switch target**: To preserve period across tabs, the period params (`dateFrom`/`dateTo`) must be included in each tab's `<Link href>`. This requires the shell or a shared context to hold the current period state and construct tab links with period params.

## F. Period Change vs Tab Switch — MANDATORY DISTINCTION (R2)

These are fundamentally different operations and MUST NOT be conflated.

### Period change within same registry

```text
KEEP:
  compatible selected KPI / table-only filter

CHANGE:
  KPI overview values → recompute under new period (server-authoritative)
  table → refetch under new period + existing table-only filter
  page → 1
```

Example:
```text
September, selected KPI = IN_PROCESSING, KPI count = 35, table = September + IN_PROCESSING

→ change Header Period to October

selected KPI remains IN_PROCESSING
KPI count recomputes, e.g. 42 (server-authoritative)
table = October + IN_PROCESSING
page = 1
```

### Switch to another registry

```text
KEEP:
  Header Period (dateFrom/dateTo)

RESET:
  selected KPI → Total / default
  table-only filters (status, paymentStatus, refundStatus, currencyCard)
  search
  page → 1
  registry-specific state (sort unless explicitly justified later)
```

### Static KPI contract — clarified (R2)

"Static KPI overview" means:

```text
static relative to TABLE-ONLY filters
```

It does **NOT** mean:

```text
static relative to GLOBAL period
```

Canonical behavior:

```text`
STATUS / PAYMENT / REFUND / CURRENCY-CARD CHANGE (table-only)
→ table changes
→ KPI overview values stay unchanged

HEADER PERIOD CHANGE (global scope)
→ table changes
→ KPI overview values RECOMPUTE (server-authoritative)
```

This distinction is mandatory and must appear explicitly in all architecture documentation.

### Tab-Switch Target Behavior

```text
Period → persists across tabs (via URL params in tab links)
Status/PaymentStatus/RefundStatus/CurrencyCard → reset on tab switch
Search → reset on tab switch
Page → reset to 1 on tab switch
KPI selection → reset to Total on tab switch
```

### Implementation Mechanism

The `OperationsCenterShell` currently receives `activeDomain` and renders tab links as plain `<Link href>`. To preserve period:

**Option A** (recommended): Shell reads `useSearchParams()`, extracts only period params (`dateFrom`/`dateTo`), and appends them to each tab `href`. E.g., `/app/orders?dateFrom=2026-09-01&dateTo=2026-10-01`.

**Option B**: A shared URL-state context/provider wraps the Operations Center and manages period state.

Option A is simpler and consistent with the URL-authoritative model.

## G. KPI / Table-Header Synchronization Contract

**One filter state, one URL, one server query, two UI entry points.**

When a KPI card and a table-header filter both control the same dimension (e.g., `status`):

1. Click KPI "Зачислен" → `paymentStatus=CAPTURED` in URL → table filtered → KPI selected → table-header dropdown shows "Зачислен"
2. Select table-header dropdown "Ожидает" → `paymentStatus=PENDING` in URL → table filtered → KPI "Ожидает" selected → previous KPI deselected

Both entry points write to the same URL param and trigger the same server query. No duplicated state machines.

**One active KPI-corresponding dimension at a time**: For Orders, `status` and `paymentStatus` are independent dimensions but KPI click currently clears the other. Table-header filters should follow the same rule: selecting a status via table header clears paymentStatus and vice versa.

For Payments, `paymentStatus`, `refundStatus`, and `currencyCard` are three independent dimensions. The current "one active card" rule applies: selecting one clears the other two. Table-header filters should follow the same rule.

**Global scope interaction**: Header Period change is a GLOBAL scope change. It recomputes ALL KPI overview values and refetches the table. The selected table-only filter (e.g., `status=IN_PROCESSING`) is preserved across period changes — the KPI count for that status recomputes under the new period, and the table filters by the new period + the preserved status.

## H. Reset Semantics

### Registry Reset

```text
clears:
  search
  status
  paymentStatus
  refundStatus
  currencyCard
  page → 1
  other registry-specific table filters

preserves:
  dateFrom
  dateTo
```

### Header Period clear

```text
clears:
  dateFrom
  dateTo

preserves:
  compatible selected KPI / table-only filter

page → 1
KPI overview → recompute for default/unbounded period
table → refetch for default/unbounded period + selected table-only filter
```

If the product has a defined default period instead of unbounded scope, document the actual behavior from code/contract.

**Implementation**: The Reset button handler should explicitly exclude `dateFrom`/`dateTo` from its `updateUrl` clear list. A separate period-clear handler in the header should clear those params.

## I. Accessibility / Responsive Contract

### Accessibility
- Table-header filter dropdowns: `aria-haspopup="listbox"`, `aria-expanded`, keyboard arrow navigation
- Filter state: `aria-pressed` on KPI cards (existing), `aria-selected` or visual indicator on table-header dropdowns
- Screen reader: distinguish sort controls from filter controls (different ARIA roles)
- Focus management: Tab → sort button → filter button (distinct focus targets)

### Responsive
- **1680px**: Header period inline with title; table-header filters visible
- **768px**: Header period wraps under title; table-header filters may use compact dropdown triggers
- **390px**: Header period uses popover/calendar trigger; table scrolls horizontally, filter dropdowns remain accessible via scroll
- Table-header filter icons must not cause horizontal overflow

## J. Security / Server-Authority Check

- All filters remain server-side — no client-side filtering of loaded pages
- KPI counts remain server-authoritative (groupBy on server)
- Tab-switch does not bypass authorization (each tab has its own permission check)
- Period params in URL do not bypass workspace/tenant scope
- No regression to D5/D6/D7 security invariants

## K. Gap Register

| # | Gap | Classification | Required action |
|---|---|---|---|
| G1 | Requests KPI endpoint has no date scope | BACKEND REQUIRED | Extend Requests KPI query/controller/service/validation so KPI counts use the same `createdAt` date scope as Requests list |
| G2 | Requests frontend is not wired to shared Header Period | FRONTEND REQUIRED | Consume Header/URL `dateFrom`/`dateTo` in Requests table and KPI calls. Do NOT add registry-toolbar date inputs |
| G3 | OperationsCenterShell has no period slot | DESIGN + FRONTEND REQUIRED | Add period display/control to header; pass period to tab links |
| G4 | Tab links are plain `<Link href>` — no shared state | FRONTEND REQUIRED | Shell reads URL params, appends `dateFrom`/`dateTo` to tab hrefs |
| G5 | Status/PaymentStatus/RefundStatus in toolbar should move to table header | DESIGN + FRONTEND REQUIRED | Migrate toolbar dropdowns to table-header filter dropdowns |
| G6 | Requests has no sortable headers | FRONTEND REQUIRED | Add SortableHeader to Requests table |
| G7 | Orders accepts `from`/`to` as aliases for `dateFrom`/`dateTo` | COMPATIBILITY REQUIRED | Preserve aliases during any param normalization |
| G8 | Payments has `dateField` param (createdAt/paidAt) | COMPATIBILITY REQUIRED | Header period should default to createdAt; paidAt remains analytics-only |
| G9 | No table-header filter component exists yet | DESIGN + FRONTEND REQUIRED | Create shared TableHeaderFilter component |
| G10 | Reset must not clear shared period | FRONTEND REQUIRED | Exclude `dateFrom`/`dateTo` from registry Reset handler |

## L. Implementation Plan

### Recommended Sequence

```
UI-C1.2F.1A — Requests KPI Date Scope
  → make /requests/kpi period-aware
  → same createdAt semantics as list
  Affected: Requests KPI controller/service/query validation as required

UI-C1.2F.1B — Shared Operations Center Header Period
  → Header owns date UI
  → URL owns period state
  → tab links preserve only period
  → Orders/Bookings/Payments local date controls removed
  → Requests consumes Header period directly
  → NO Requests toolbar date controls
  → global period recomputes KPI + table
  → registry Reset preserves period
  Affected: OperationsCenterShell, Requests/Orders/Bookings/Payments registries,
            shared URL/query helpers where applicable, i18n, tests

UI-C1.2F.1C — Shared TableHeaderFilter Component
  Affected: shared component, i18n, tests

UI-C1.2F.1D — Orders Table-Header Filtering
  → Move status + paymentStatus from toolbar to table-header dropdowns
  → KPI ↔ table-header sync via shared URL state
  Affected: Orders registry

UI-C1.2F.1E — Bookings Table-Header Filtering
  → Move status from toolbar to table-header dropdown
  Affected: Bookings registry

UI-C1.2F.1F — Payments Table-Header Filtering
  → Move paymentStatus/refundStatus/currencyCard from KPI-only to table-header dropdowns
  → Preserve currency global scope vs currencyCard table-only distinction
  Affected: Payments registry

UI-C1.2F.1G — Requests Table-Header Filtering
  → Move status from toolbar to table-header dropdown
  Affected: Requests registry

UI-C1.2F.1H — Cross-Registry Regression
  → Browser/accessibility/responsive/security regression at 1680/768/390
  → Regression: all 4 registries + D5/D6/D7

UI-C1.2F.1I — Git Hard Closure
```

### Dependencies
- G1 (Requests KPI date scope) must complete before G3 (Header Period)
- G3 (Header Period) must complete before G5 (toolbar → table-header migration)
- G9 (shared TableHeaderFilter component) must complete before G5
- G10 (Reset exclusion) is part of G3

## M. Final Verdict

```
VERDICT A — UI-C1.2F.1
OPERATIONS CENTER HEADER PERIOD & TABLE HEADER FILTERING
ARCHITECTURE RECONCILIATION — ACCEPTED AFTER CORRECTION R2

BASELINE RECONCILIATION SHA:
3c2fdc394c6a24aada885e80c624800dd0af50ae

FINAL SHA:
<to be filled after commit>

HEADER PERIOD = GLOBAL SCOPE — CONFIRMED
HEADER PERIOD → KPI + TABLE — CONFIRMED
STATIC KPI VS TABLE-ONLY FILTERS — CONFIRMED
PERIOD CHANGE PRESERVES SELECTED KPI — CONFIRMED
TAB SWITCH PRESERVES PERIOD ONLY — CONFIRMED

REQUESTS PERIOD SEMANTICS — CONFIRMED
(createdAt; list support exists; KPI date scope requires UI-C1.2F.1A)

REQUESTS TOOLBAR DATE CONTROLS — NOT ALLOWED
REQUESTS HEADER PERIOD CONSUMPTION — REQUIRED

ORDERS PERIOD SEMANTICS — CONFIRMED
BOOKINGS PERIOD SEMANTICS — CONFIRMED
PAYMENTS PERIOD SEMANTICS — CONFIRMED

FILTER OWNERSHIP MATRIX — PASS
KPI / TABLE-HEADER SYNC — PASS
RESET SEMANTICS — PASS
SERVER AUTHORITY — PASS
URL / HISTORY — PASS
ACCESSIBILITY CONTRACT — PASS
RESPONSIVE CONTRACT — PASS
SECURITY — PASS
GIT HARD CLOSURE — PASS

UI-C1.2G — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2F.1A — Requests KPI Date Scope
```
