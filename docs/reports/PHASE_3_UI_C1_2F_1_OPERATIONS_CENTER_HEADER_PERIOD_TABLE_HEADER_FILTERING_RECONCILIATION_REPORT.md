# UI-C1.2F.1 — OPERATIONS CENTER HEADER PERIOD & TABLE HEADER FILTERING — RECONCILIATION REPORT

## A. Executive Summary

Unified architecture **IS FEASIBLE**. All 4 registries have backend dateFrom/dateTo support on `createdAt`. Three registries (Orders, Bookings, Payments) already expose date filters in the toolbar with KPI scope parity. Requests has backend support but frontend does NOT expose it, and the Requests KPI endpoint is a separate global endpoint that does NOT accept date params — this is the **only architectural gap requiring a business decision**.

Moving period to the shared Operations Center Header is feasible for Orders/Bookings/Payments immediately. Requests period requires a KPI backend change to scope counts by date. Table-header filtering for status/payment/currency dimensions is feasible as a UI migration of existing toolbar controls to table-header dropdowns, preserving the existing server-side contract.

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

## D. Filter Ownership Matrix

| Filter | Header | Toolbar | KPI | Table Header | Global vs Table-only | Persist Across Tabs |
|---|---|---|---|---|---|---:|
| Period (dateFrom/dateTo) | **TARGET** | CURRENT (Orders/Bookings/Payments) | affected (Orders/Bookings/Payments) | NO | GLOBAL (affects KPI + table) | **YES** (target) |
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

## F. Tab-Switch Contract

### Current behavior
- Tab switch → full route change → each registry reads initial state from URL
- No state is preserved (each registry starts fresh from its URL params)

### Target behavior
```
Period → persists across tabs (via URL params in tab links)
Status/PaymentStatus/RefundStatus/CurrencyCard → reset on tab switch
Search → reset on tab switch
Page → reset to 1 on tab switch
KPI selection → reset to Total on tab switch
```

### Implementation mechanism
The `OperationsCenterShell` currently receives `activeDomain` and renders tab links as plain `<Link href>`. To preserve period:

**Option A**: Shell receives `currentSearchParams` (or the period subset) and appends them to each tab's `href`. The shell would need to read `useSearchParams()` and construct tab links like `/app/orders?dateFrom=2026-09-01&dateTo=2026-10-01`.

**Option B**: A shared URL-state context/provider wraps the Operations Center and manages period state.

Option A is simpler and consistent with the URL-authoritative model. Option B is more flexible but adds state management overhead. **Recommendation: Option A** — the shell reads current search params, extracts only period params (`dateFrom`/`dateTo`), and appends them to tab `href`s.

## G. KPI / Table-Header Synchronization Contract

**One filter state, one URL, one server query, two UI entry points.**

When a KPI card and a table-header filter both control the same dimension (e.g., `status`):

1. Click KPI "Зачислен" → `paymentStatus=CAPTURED` in URL → table filtered → KPI selected → table-header dropdown shows "Зачислен"
2. Select table-header dropdown "Ожидает" → `paymentStatus=PENDING` in URL → table filtered → KPI "Ожидает" selected → previous KPI deselected

Both entry points write to the same URL param and trigger the same server query. No duplicated state machines.

**One active KPI-corresponding dimension at a time**: For Orders, `status` and `paymentStatus` are independent dimensions but KPI click currently clears the other. Table-header filters should follow the same rule: selecting a status via table header clears paymentStatus and vice versa.

For Payments, `paymentStatus`, `refundStatus`, and `currencyCard` are three independent dimensions. The current "one active card" rule applies: selecting one clears the other two. Table-header filters should follow the same rule.

## H. Reset Semantics

### Current behavior
- Reset clears ALL registry-specific filters (search, status, paymentStatus, dateFrom, dateTo, page)
- Each registry's Reset is a local operation

### Target behavior
- **Registry Reset**: clears search, status/paymentStatus/refundStatus/currencyCard, page → 1. Does NOT clear Header Period.
- **Header Period clear**: separate control (e.g., "×" button on the period display in the header). Clears dateFrom/dateTo across all tabs.

This separation prevents a registry Reset from unexpectedly changing the shared Operations Center context.

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

| # | Gap | Classification | Severity | Required action |
|---|---|---|---|---|
| G1 | Requests KPI endpoint has no date scope | BACKEND REQUIRED | HIGH | Add dateFrom/dateTo to `getRequestKpi()` + KPI controller |
| G2 | Requests frontend does not expose dateFrom/dateTo | FRONTEND REQUIRED | MEDIUM | Add date inputs to Requests toolbar (after G1) |
| G3 | OperationsCenterShell has no period slot | DESIGN + FRONTEND REQUIRED | HIGH | Add period display/control to header; pass period to tab links |
| G4 | Tab links are plain `<Link href>` — no shared state | FRONTEND REQUIRED | HIGH | Shell reads URL params, appends dateFrom/dateTo to tab hrefs |
| G5 | Status/PaymentStatus/RefundStatus in toolbar should move to table header | DESIGN + FRONTEND REQUIRED | MEDIUM | Migrate toolbar dropdowns to table-header filter dropdowns |
| G6 | Requests has no sortable headers | FRONTEND REQUIRED | LOW | Add SortableHeader to Requests table |
| G7 | Orders accepts `from`/`to` as aliases for `dateFrom`/`dateTo` | COMPATIBILITY REQUIRED | LOW | Preserve aliases during any param normalization |
| G8 | Payments has `dateField` param (createdAt/paidAt) | COMPATIBILITY REQUIRED | LOW | Header period should default to createdAt; paidAt remains analytics-only |
| G9 | No table-header filter component exists yet | DESIGN + FRONTEND REQUIRED | HIGH | Create shared TableHeaderFilter component |
| G10 | Reset must not clear shared period | FRONTEND REQUIRED | MEDIUM | Exclude dateFrom/dateTo from registry Reset handler |

## L. Implementation Plan

### Recommended Sequence

```
UI-C1.2F.1A — Requests KPI date scope (backend)
  Add dateFrom/dateTo to getRequestKpi() endpoint
  Verify KPI counts scope by date
  ~1 backend file change

UI-C1.2F.1B — Shared Operations Center Header Period (shell + all registries)
  Add period display/control to OperationsCenterShell header
  Shell reads URL dateFrom/dateTo, appends to tab links
  Remove dateFrom/dateTo from Orders/Bookings/Payments toolbar
  Add dateFrom/dateTo to Requests toolbar (now KPI-scoped)
  Period clear = separate from Reset
  ~5 files: shell + 4 registry pages

UI-C1.2F.1C — Table-Header Filter Component (shared)
  Create shared TableHeaderFilter dropdown component
  ARIA: aria-haspopup, aria-expanded, keyboard navigation
  Responsive: compact on mobile

UI-C1.2F.1D — Orders table-header filtering
  Move status + paymentStatus from toolbar to table-header dropdowns
  KPI ↔ table-header sync via shared URL state
  ~1 file: orders/page.tsx

UI-C1.2F.1E — Bookings table-header filtering
  Move status from toolbar to table-header dropdown
  ~1 file: bookings/page.tsx

UI-C1.2F.1F — Payments table-header filtering
  Move paymentStatus/refundStatus/currencyCard from KPI-only to table-header dropdowns
  Preserve currency global scope vs currencyCard table-only distinction
  ~1 file: payments/page.tsx

UI-C1.2F.1G — Requests table-header filtering
  Move status from toolbar to table-header dropdown
  ~1 file: requests/page.tsx

UI-C1.2F.1H — Cross-registry regression + accessibility + responsive
  Browser qualification at 1680/768/390
  Keyboard/screen-reader testing
  Regression: all 4 registries + D5/D6/D7

UI-C1.2F.1I — Git hard closure
```

### Dependencies
- G1 (Requests KPI date scope) must complete before G3 (Header Period)
- G3 (Header Period) must complete before G5 (toolbar → table-header migration)
- G9 (shared TableHeaderFilter component) must complete before G5
- G10 (Reset exclusion) is part of G3

### Estimated scope
- Backend: 2-3 files (request controller, request service, possibly validation)
- Frontend: 6-8 files (shell, 4 registry pages, 1 shared component, i18n)
- No Prisma migration needed
- No D5/D6/D7 production changes

## M. Final Verdict

```
VERDICT A — UI-C1.2F.1
OPERATIONS CENTER HEADER PERIOD & TABLE HEADER FILTERING
ARCHITECTURE RECONCILIATION — ACCEPTED

BASELINE SHA:
cbbdedba5589f4d036ac97a4fe8f00c5dc2da8a9

REQUESTS PERIOD SEMANTICS — CONFIRMED (backend supports, KPI gap identified)
ORDERS PERIOD SEMANTICS — CONFIRMED
BOOKINGS PERIOD SEMANTICS — CONFIRMED
PAYMENTS PERIOD SEMANTICS — CONFIRMED

HEADER PERIOD CONTRACT — PASS (design defined, implementation-ready)
TAB-SWITCH PERSISTENCE CONTRACT — PASS (Option A: shell appends period to tab hrefs)
FILTER OWNERSHIP MATRIX — PASS
KPI / TABLE-HEADER SYNC — PASS (one state, two entry points)
SERVER AUTHORITY — PASS
URL / HISTORY — PASS
RESET SEMANTICS — PASS (registry Reset ≠ Header Period clear)
ACCESSIBILITY — PASS (design defined)
RESPONSIVE — PASS (design defined)
SECURITY — PASS
GIT HARD CLOSURE — PASS

GAPS IDENTIFIED:
  G1: Requests KPI date scope (backend) — REQUIRED before Header Period
  G2: Requests frontend date exposure — REQUIRED after G1
  G9: Shared TableHeaderFilter component — REQUIRED before table-header migration

UI-C1.2G — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2F.1A — Requests KPI date scope (backend)
```
