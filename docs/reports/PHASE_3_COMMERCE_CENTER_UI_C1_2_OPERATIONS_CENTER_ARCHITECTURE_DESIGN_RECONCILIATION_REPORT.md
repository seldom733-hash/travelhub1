# UI-C1.2 — OPERATIONS CENTER — ARCHITECTURE & DESIGN RECONCILIATION — REPORT

**Stage:** Design / architecture reconciliation only. **No production implementation in this step.**

---

## 1. Executive Summary

UI-C1.2 defines and locks the canonical architecture for the future single **ЦЕНТР ОПЕРАЦИЙ (Operations Center)** — a shared visual shell with four domain tabs (Заявки / Заказы / Бронирования / Платежи), one active tab at a time, domain-owned business semantics, and a server-authoritative KPI/filter/table contract.

This stage produced:

- **Full source-of-truth audit** of Requests, Orders, Bookings, Payments, Refunds, Disputes (backend entities, enums, state machines, list/KPI/export endpoints, RBAC).
- **13 ADR decisions (ADR-OPS-001 … ADR-OPS-013)**, all traceable to actual backend evidence.
- **KPI semantic grouping model** per domain: Total → semantic groups → Attention, with Orders lifecycle-flow design and Booking branching-machine design grounded in the real state machines (not invented statuses).
- **Payments domain audit** with the key finding that a Finance-owned Payments registry **already exists** (`/app/finance/payments` + detail) but is reachable only via Analytics drill-down, has no sidebar entry, no server KPI (client-side page-sum instead), and its detail page lacks refunds/history/actions.
- **Gap matrices** (Requests, Orders, Bookings, Payments) with concrete sources and proposed closure stages.
- **Implementation phasing** UI-C1.2A … UI-C1.2K, re-sequenced to reflect discovered backend prerequisites (Requests KPI scope extension, Payments KPI endpoint, Refunds list date/export).

**Core design principles locked:**

```
ONE OPERATIONS CENTER ≠ ONE GIANT PAGE
SHARED SHELL ≠ IDENTICAL BUSINESS SEMANTICS
DOMAIN OWNERSHIP ≠ WORKFLOW CONTEXT
PAYMENTS = FINANCE-OWNED OPERATIONAL CAPABILITY + OPERATIONS CENTER TAB
KPI GROUPING SHOULD EXPLAIN THE BUSINESS PROCESS, NOT JUST DISPLAY ENUM COUNTS
SERVER-SIDE AUTHORITY ALWAYS PREVAILS OVER CLIENT PRESENTATION
```

---

## 2. Canonical Baseline

Accepted per the prompt:

```text
D5  — ACCEPTED
D6  — ACCEPTED
D7  — ACCEPTED
UI-C1  — ACCEPTED
UI-C1.1 — ACCEPTED AFTER R3
```

UI-C1.1 R3 acceptance SHA: `7a722bd2c5e6c54033b6e1bccd3b57d5c76cbe35`

```text
UI-C2 — NOT STARTED
D8   — NOT STARTED
```

Help / Business Dictionary micro-closure (prior round) is also accepted as a binding input:
`COMMERCE UI DESIGN CONTRACT — ACCEPTED`, `HELP / BUSINESS DICTIONARY CONTRACT — ACCEPTED` (FINAL SHA `0cec25a2…`), including ADR-HELP-001 (source-of-truth) and the canonical 6-KPI Booking contract.

---

## 3. Current Registry Audit

Audit of the four registries as they exist today (backend endpoints + frontend pages).

### 3.1 Requests — `/app/requests`

| Aspect | Current state | Source |
|---|---|---|
| Entity | `Request` (order.* schema), 12-status `RequestStatus` enum | `schema.prisma` L2144–2159 |
| List | `GET /requests` — search, `status`, `customerId`, `partnerId`, `dateFrom/dateTo` on `createdAt` (half-open `[from, to)`), fixed `createdAt desc` sort, pagination | `request.service.ts listRequests` |
| Search | `referenceNumber`/`code`/`commerceSequence` + resolved customer (name/code/email), product (title/code), partner (name/code) | `request.service.ts` L161–213 |
| KPI | `GET /requests/kpi` — **global** count by status (lowercased keys + `total`), **no** filters/period/channel scope | `request.service.ts getRequestKpi` (L767–779) |
| Export | `GET /requests/export` CSV/XLSX, respects status/search/date | `request.controller.ts` L56+ |
| Scope | **No** `acquisitionSource` channel scoping on list (unlike Orders/Bookings/Payments) | `request.service.ts` |
| UI KPI | TOTAL (Всего заявок) + flat 12-status grid, values from global KPI endpoint | `frontend/app/app/requests/page.tsx` |
| UI toolbar | Search (debounced 350 ms, no URL state) → status select → export. **No date filter in UI**, no Reset | same |
| UI table | 10 fixed columns: ref / customer / product / supplier / Цена витрины / Подтв. цена / service date / Статус / created / SLA deadline | same |
| URL state | **None** (no `useSearchParams`; filters not synced to URL) | same |

### 3.2 Orders — `/app/orders`

| Aspect | Current state | Source |
|---|---|---|
| Entity | `Order` (order.*), 12-status `OrderStatus`, 4-status `OrderPaymentStatus`, `amount/paidAmount/refundedAmount` | `schema.prisma` L1873–1897, L1927+ |
| List | `GET /orders` — search, `status` (multi, comma), `paymentStatus`, `customerId`, `sellerPartnerId`, `dateFrom/dateTo` on `createdAt`, detectors `cancelledWithin` / `paymentFailed` / `pendingRefund`, channel scope default `MARKETPLACE`, sort allowlist, **aggregates `{ lifecycle, payment }` on the same `where`** | `order.service.ts listOrders` L817–924 |
| Search | `code` / `number` / `referenceNumber` contains-insensitive | L830 |
| KPI | Server-side `aggregates.lifecycle` (by status) + `aggregates.payment` (by paymentStatus) — same scope as table ✅ | L892–914 |
| Export | `GET /orders/export` CSV/XLSX via shared `buildOrderWhere` | L929+, `order.controller.ts` |
| UI KPI | TOTAL (Всего заказов) + flat 12-lifecycle grid + flat 4-payment grid (click → server filter + URL) | `orders/page.tsx` |
| UI toolbar | Search (350 ms) → status → paymentStatus → dateFrom/dateTo → export. Detector params only via deep link (not controls) | same |
| UI table | 8 fixed cols: ref / date / amount / items / status / payment status (+conditional detector cols) | same |
| Quick-preview | 👁 sidebar (items/travelers/bookings/actions/history) | same |
| URL state | `status`, `paymentStatus`, `sortBy`, `sortDirection`, `dateFrom/dateTo` via `replaceState` | same |
| Dates in table | **Hardcoded `ru-RU`** (`toLocaleDateString("ru-RU")`) — localization debt | same |

### 3.3 Bookings — `/app/bookings`

| Aspect | Current state | Source |
|---|---|---|
| Entity | `Booking` (booking.*), 13-status `BookingStatus`, frozen `amount/currency` from OrderItem, service occurrence fields | `schema.prisma` L2278–2294, L2306+ |
| List | `GET /bookings` — search, `status` (multi), `orderId`, `upcoming`/`overdue` detectors, `dateFrom/dateTo` on `createdAt`, channel scope default `MARKETPLACE`, sort allowlist, **`aggregates.lifecycle` on same `where`** | `booking.service.ts listBookings` |
| Search | booking `code`/`referenceNumber` + traveler names (OrderTraveler) + order `number` | `resolveBookingSearchIds` |
| KPI | Server-side `aggregates.lifecycle` (13 statuses + total) — same scope ✅ | L242–260 |
| Export | `GET /bookings/export` CSV/XLSX, respects filters | `booking.controller.ts` L146 |
| UI KPI | TOTAL (Всего бронирований) + flat 13-status grid | `bookings/page.tsx` |
| UI toolbar | Search → status → dateFrom/dateTo → export | same |
| UI table | 8 fixed cols: ref / date / order / amount / passengers / status (+serviceDate / waiting when detector active) | same |
| URL state | `status`, `sort`, `search`, `dateFrom/dateTo`, deep links `upcomingOnly`/`overdueOnly`/`slaMinutes` | same |
| Dates in table | Hardcoded `ru-RU`; waiting-cell text hardcoded RU («дн.»/«ч.»/«мин») | same |

### 3.4 Payments — `/app/finance/payments` (existing Finance drill-down)

| Aspect | Current state | Source |
|---|---|---|
| Entity | `Payment` (finance.*) PAY-*, `PaymentStatus`, `paymentMethod` (free-text String), `providerRef` (opaque), milestones | `schema.prisma` L3851–3925 |
| List | `GET /finance/payments` — `orderId`, `status`, `currency`, `dateFrom/dateTo` on `dateField` (default `createdAt`; `paidAt` via analytics drill-down), channel scope default `MARKETPLACE`, sort allowlist, pagination. **No search. No aggregates.** | `payment.service.ts list` |
| Detail | `GET /finance/payments/:code` — whitelist DTO (no PII/secrets) | `payment.service.ts getByCode` |
| Export | `GET /finance/payments/export` CSV/XLSX with order/partner/customer names | `finance.controller.ts` |
| Refunds | `GET /finance/refunds` — `paymentId`/`orderId`/`status` + pagination only. No date filters, no export, no aggregates | `refund.service.ts list` |
| UI registry | Filters (currency/status/date), sort, export, **AggregateSummary = client-side sum of current page** ⚠️ | `finance/payments/page.tsx` |
| UI detail | Read-only: hero amount + detail rows (status/amount/currency/dates/order/method/providerRef). **No refunds, no history, no actions, no notes** | `finance/payments/[id]/page.tsx` |
| URL state | `from`/`to`/`status`/`currency`/`sortBy`/`sortDirection`/`fromAnalytics` | same |
| Reachability | Only via Command Center/Analytics drill-down; **no sidebar entry** | `Shell.tsx` NAV_GROUPS |
| Aggregate authority | ⚠️ Total-amount sum is computed client-side over the current page only — violates the no-client-counting rule (§20/§23) | `finance/payments/page.tsx` |

### 3.5 Shared frontend primitives (accepted UI-C1/UI-C1.1)

- `CommerceKpiCard` (`variant="total"` ≈ 15–20% larger, not full-width; ordinary cards; clickable, `active` state).
- `StatusBadge`, `EntityDetailLayout` (two-zone detail skeleton), detail shared primitives (`EntityField/Grid/Timeline/Row/StatusBadges/FinanceCell/Link/EmptyValue`, `EntityDetailHeader`, `StatusBadge`).
- `TableExportButton` — CSV + XLSX buttons passing active filters.
- i18n (RU/AZ/EN): canonical status labels (`order.status.*`, `order.payment.*`, `booking.status.*`, `requests.kpi.*`, `status.entity.*`), TOTAL labels (`Всего заявок/заказов/бронирований`).
- Shell sidebar: groups «ОПЕРАЦИИ» (Заявки/Заказы/Бронирования), no «ФИНАНСЫ» group, no Платежи item; permission-aware items; route guard redirects to `/app/dashboard` on missing permission.

---

## 4. Operations Center Architecture

**Canonical structure:**

```text
ЦЕНТР ОПЕРАЦИЙ  (one shell)
└── ONE ACTIVE DOMAIN TAB:  [ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]
```

- **NOT** one long page with four registries stacked vertically.
- One shell (`OperationsCenterShell`), one active tab; only the active tab fetches its domain data (§44).
- The shell owns the page skeleton and interaction grammar; each domain supplies its own data/config (§5, §6).

**Rejected alternatives (explicit):**
- Single `/app/operations?tab=…` as the **only** route contract — rejected (breaks deep links, browser history, permission-aware routing, existing bookmarks; §4).
- Four independent pages with no shared shell — rejected (loses the unification goal of UI-C1.1's visual-system parity).

---

## 5. Sidebar Ownership

Canonical sidebar (target):

```text
ОПЕРАЦИИ
├── Заявки      → /app/requests
├── Заказы      → /app/orders
└── Бронирования → /app/bookings

ФИНАНСЫ
└── Платежи     → /app/payments
```

Rules:
- Sidebar items keep **domain ownership**. Платежи lives under ФИНАНСЫ (finance domain), while its *workflow context* is the Operations Center tab set.
- **No** invented sidebar item «Центр операций».
- Active sidebar highlight reflects the **domain route** (`/app/payments` highlights ФИНАНСЫ → Платежи), not the shell.
- Sidebar visibility is permission-derived (item `permission: "finance.payment.read"` for Платежи — matches the existing Shell pattern).
- `DOMAIN OWNERSHIP ≠ WORKFLOW CONTEXT`: Payments = FINANCE-owned operational capability + Operations Center tab.

**Current state → gap:** ОПЕРАЦИИ group exists; ФИНАНСЫ group + Платежи item must be added (UI-C1.2A), with `/app/payments` as the canonical Payments route (migrating the existing `/app/finance/payments` drill-down, see §6/ADR-OPS-001).

---

## 6. Canonical Route / Deep-Link Model

**ADR-OPS-001** — Preferred canonical routes (preserving existing URLs; adding Payments):

```text
/app/requests   → Operations Center, active tab = Заявки
/app/orders     → Operations Center, active tab = Заказы
/app/bookings   → Operations Center, active tab = Бронирования
/app/payments   → Operations Center, active tab = Платежи   (NEW canonical route)
```

- Existing canonical URLs `/app/requests`, `/app/orders`, `/app/bookings` are **not broken**.
- `/app/payments` becomes the canonical Payments route. The existing `/app/finance/payments` + `/app/finance/payments/[id]` are **migrated** (redirect kept during UI-C1.2F; canonical detail becomes `/app/payments/[id]`).
- A query-param tab (`?tab=…`) is allowed only as a **secondary** UX mechanism (e.g., cross-linking) — never the sole route contract. No ADR is required to reject the single-URL model: it is rejected because it breaks deep links, history, direct navigation, permission-aware routing, tests, bookmarks, and canonical entity navigation (prompt §4).
- Detail pages: canonical entity routes remain `/app/requests/[id]`, `/app/orders/[id]`, `/app/bookings/[id]` (accepted UI-C1.1), plus `/app/payments/[id]`.

---

## 7. Shared Shell Contract

`OperationsCenterShell` owns (single source of truth, mirroring the `EntityDetailLayout` pattern of UI-C1.1 R3):

```text
┌──────────────────────────────────────────────────────────────┐
│ Breadcrumbs                                                  │
│ ЦЕНТР ОПЕРАЦИЙ                            Period / Actions    │
│                                                              │
│ [ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]          │
├──────────────────────────────────────────────────────────────┤
│ ACTIVE DOMAIN KPI AREA  (Total → semantic groups → Attention)│
│ Search | Filters | Date scope | Reset | Export               │
│ Result summary / selection tools (if applicable)             │
│ Registry table                                               │
│ Pagination                                                   │
└──────────────────────────────────────────────────────────────┘
```

Owned by the shell: page max-width, page-header geometry, tabs, KPI zone geometry, group spacing, toolbar geometry, search placement, filters layout, period/date control placement, export placement, table container, loading/empty/error states, pagination area, responsive behavior.

**Not owned by the shell:** business semantics — KPI sets, filters, columns, actions (per-domain configs, §41/§47).

---

## 8. Tab Navigation Contract

**ADR-OPS-011 (tabs)** — per prompt §7:

1. Active tab matches the current canonical route. ✅
2. Tab switching = router navigation to the canonical route (real `push`; not client-only state).
3. Browser Back/Forward works (route-based). ✅
4. Direct URL opening selects the correct tab (route → tab derivation). ✅
5. Tabs are permission-aware (visible iff the user has the domain read permission, §33/§34).
6. Hidden tab is **not** a security boundary — server access remains authoritative (route guards + backend `@RequirePermissions`).
7. Server access remains authoritative. ✅
8. Tab labels RU/AZ/EN (i18n keys `nav.requests/orders/bookings/payments`).
9. Keyboard accessible: `role="tablist"/"tab"/"tabpanel"`, arrow-key navigation, roving tabindex (per `OperationsCenterTabs` contract).
10. Clear active state (tab + sidebar domain item both highlighted).
11. No fake unavailable domain — a tab without permission is **not rendered** (not rendered-as-disabled).
12. If the user lacks access to a tab → do not render it (permission-derived).
13. Direct URL to a tab without permission → server-protected: existing Shell redirect (`/app/dashboard`) client-side; backend 403/404 remains authoritative.

**Tab permission mapping (source: `ROLE_PERMISSIONS`, `permissions.constants.ts`):**

| Tab | Permission | Roles with access |
|---|---|---|
| Заявки | `order.read` | ADMIN, OPERATOR, FINANCE, DIRECTOR, ANALYST, SALES_MANAGER |
| Заказы | `order.read` | same |
| Бронирования | `booking.read` | same |
| Платежи | `finance.payment.read` | ADMIN, FINANCE, DIRECTOR, ANALYST, SALES_MANAGER (**not** OPERATOR) |

**Sidebar ↔ tab synchronization (§8):**

```text
Sidebar → Заявки        = /app/requests  = shell / active Requests tab
Sidebar → Заказы        = /app/orders    = shell / active Orders tab
Sidebar → Бронирования  = /app/bookings  = shell / active Bookings tab
Sidebar → Финансы → Платежи = /app/payments = shell / active Payments tab
```

Active sidebar item reflects **domain ownership** (Платежи highlights the ФИНАНСЫ group item), not a shell name.

---

## 9. KPI Design System

**ADR-OPS-004** — KPI is **not** one flat endless grid. Canonical system:

```text
OperationsKpiOverview
├── OperationsTotalKpi          (Всего …; variant="total" per accepted UI rule)
├── OperationsKpiGroup          (semantic group title + ordinary KPI cards)
└── OperationsAttentionGroup    (actionable queue cards, server-authoritative)
```

Visual rules (preserving the accepted UI-C1.1 contract):
- Total card: same visual language as ordinary cards, **not** full-width, ~15–20% larger typography (`CommerceKpiCard variant="total"` already implements this), prominent but compact.
- Group titles render semantic labels (e.g., «ЖИЗНЕННЫЙ ЦИКЛ ЗАКАЗА», «СТАТУСЫ ОПЛАТЫ», «ПРОБЛЕМНЫЕ / EXCEPTION»).
- Lifecycle-flow cards (Orders) may use connected arrow geometry while preserving the shared token family (typography, border/radius, spacing, interaction, selected state, help affordance) — same design language, not identical card shape for every semantic group (§33).
- Every interactive KPI: click → `page=1` → server-side filter → table refresh → KPI refresh (same scope) → URL state (§20).
- No client-side counting anywhere (§20/§23).
- Every KPI has a stable metric ID (ADR-HELP-001 convention `{domain}.{metric}`) + Help topic ID (§31).

**Total labels (accepted + derived):**

| Tab | Total label (RU) | Source of wording |
|---|---|---|
| Заявки | Всего заявок | accepted (R1, `requests.kpi.total`) |
| Заказы | Всего заказов | accepted (R1, `admin.kpi.total_orders`) |
| Бронирования | Всего бронирований | accepted (R1, `admin.kpi.total_bookings`) |
| Платежи | **Всего платежей** (proposal) | derived from the actual domain aggregate (`Payment`, tab «Платежи») — consistent with the pattern; to be locked at UI-C1.2F |

---

## 10. Requests KPI Model

Requests state model is **not** a single sequential machine — it branches (supplier decision, customer decision, timeouts, cancel). Therefore **no lifecycle arrows** for Requests (prompt §11).

Canonical Requests KPI architecture:

```text
TOTAL
[ Всего заявок ]

СТАТУСЫ ЗАЯВОК (semantic overview — one card per actual status, no raw enums)
NEW | CHECKING | SUPPLIER_TIMEOUT | PRICE_CHANGED | CUSTOMER_ACCEPTED |
CONFIRMED | CONVERTED | REJECTED | UNAVAILABLE | EXPIRED |
CUSTOMER_PAYMENT_TIMEOUT | CANCELLED_BY_CUSTOMER

ВНИМАНИЕ / ОЧЕРЕДЬ ДЕЙСТВИЙ (attention — actionable subsets; may repeat a
status only because the purpose changes from overview to action queue)
[ Требуют решения поставщика: CHECKING (SLA pending) ]
[ Ожидают решения клиента: PRICE_CHANGED (TTL pending), CUSTOMER_ACCEPTED ]
[ Таймауты: SUPPLIER_TIMEOUT, CUSTOMER_PAYMENT_TIMEOUT, EXPIRED ]
```

- All 12 actual statuses stay represented; labels come from canonical i18n status mapping; no raw enum leakage (§32).
- KPI click → server-side `status` filter (drill-down contract §20).
- **Backend gap (known debt, §23):** `GET /requests/kpi` is global. The KPI must become filter/period-scoped before the period control is exposed (see ADR-OPS-007/008 and §26).
- Attention conditions are **proposed** (to be validated against the state machine's deadline fields `supplierResponseDeadline`/`customerActionDeadline` server-side); final attention queries are a UI-C1.2H backend item.

---

## 11. Orders State-Machine Audit

Actual `OrderStatus` enum (12): `NEW, IN_PROCESSING, WAITING_FOR_DATA, READY_FOR_BOOKING, SENT_TO_BOOKING, PARTIALLY_FULFILLED, FULFILLED, READY_TO_CLOSE, CLOSED, CANCELLED, PROBLEM, SUSPENDED` (schema L1873–1888).

Actual transitions (D5 authority, `order.service.ts TRANSITIONS`):

```text
process:           NEW → IN_PROCESSING
markWaitingData:   IN_PROCESSING → WAITING_FOR_DATA
resumeProcessing:  WAITING_FOR_DATA → IN_PROCESSING
confirm:           IN_PROCESSING | WAITING_FOR_DATA → READY_FOR_BOOKING
send:              READY_FOR_BOOKING → SENT_TO_BOOKING
complete:          SENT_TO_BOOKING | PARTIALLY_FULFILLED → FULFILLED
close:             FULFILLED | READY_TO_CLOSE → CLOSED
cancel:            ACTIVE → CANCELLED            (ACTIVE = NEW, IN_PROCESSING,
                     WAITING_FOR_DATA, READY_FOR_BOOKING, SENT_TO_BOOKING,
                     PARTIALLY_FULFILLED, PROBLEM, SUSPENDED)
problem:           ACTIVE minus PROBLEM → PROBLEM
suspend:           ACTIVE minus SUSPENDED → SUSPENDED
```

Classification:

| Status | Class | Notes |
|---|---|---|
| NEW | Linear happy path (start) | |
| IN_PROCESSING | Linear happy path | also rework target of `resumeProcessing` |
| WAITING_FOR_DATA | **Rework loop** (reversible) | `IN_PROCESSING ⇄ WAITING_FOR_DATA` |
| READY_FOR_BOOKING | Linear happy path | |
| SENT_TO_BOOKING | Linear happy path | |
| PARTIALLY_FULFILLED | Alternate fulfillment | multi-item partial completion |
| FULFILLED | Linear happy path | |
| READY_TO_CLOSE | Terminal-adjacent | enum member with **no entry transition in the current machine** (legacy/future) — flagged, not invented |
| CLOSED | **Terminal** | |
| CANCELLED | **Terminal exception** | |
| PROBLEM | Exception | from any ACTIVE |
| SUSPENDED | Exception | from any ACTIVE |

- The machine is **near-linear with two small branches** (rework loop `WAITING_FOR_DATA`, alternate `PARTIALLY_FULFILLED`) and three exception lanes (`PROBLEM`, `SUSPENDED`, `CANCELLED`).
- A strictly left-to-right arrow flow is **truthful for the happy path only**; the flow visualization must render the rework loop and exception lanes explicitly or hide them behind the exception group (ADR-OPS-005).

---

## 12. Orders Lifecycle KPI Flow

**ADR-OPS-005** — Orders lifecycle visualization:

```text
TOTAL
[ Всего заказов ]

ЖИЗНЕННЫЙ ЦИКЛ ЗАКАЗА (connected flow, happy path only — truthful)
[ NEW ] → [ IN_PROCESSING ] → [ READY_FOR_BOOKING ] → [ SENT_TO_BOOKING ] → [ FULFILLED ] → [ CLOSED ]

РЕВОРК (small loop, visually attached to IN_PROCESSING, non-arrowed badge)
[ WAITING_FOR_DATA ⇄ IN_PROCESSING ]

ПРОБЛЕМНЫЕ / EXCEPTION
[ PROBLEM ] [ SUSPENDED ] [ CANCELLED ]

СТАТУСЫ ОПЛАТЫ (separate dimension — §13)
[ UNPAID ] [ PARTIALLY_PAID ] [ PAID ] [ REFUNDED ]
```

Design answers (prompt §34):

1. **Linear forward lifecycle:** NEW, IN_PROCESSING, READY_FOR_BOOKING, SENT_TO_BOOKING, FULFILLED, CLOSED.
2. **Terminal:** CLOSED, CANCELLED. (`READY_TO_CLOSE` terminal-adjacent; no entry transition today — excluded from the flow, listed in filter only.)
3. **Exception/problem:** PROBLEM, SUSPENDED (reversible), CANCELLED (terminal exception), WAITING_FOR_DATA (rework loop, not "problem").
4. **Can transition back:** WAITING_FOR_DATA → IN_PROCESSING (`resumeProcessing`); PROBLEM/SUSPENDED → any ACTIVE via the relevant forward action (guards return to normal flow); PARTIALLY_FULFILLED → FULFILLED (`complete`).
5. **Strict left-to-right arrows:** truthful only for the happy path; the flow renders the happy path with arrows and the rework loop as a reversible loop glyph; exceptions are a separate group, never chained into the arrows.
6. **Happy-path-only arrows:** yes — primary happy path only; branches do not get arrowed chains (avoids implying impossible transitions).
7. **Counts:** each flow card shows a count from `aggregates.lifecycle` (server-side, same scope as table). PARTIALLY_FULFILLED count is shown inside the FULFILLED stage card as a sub-count or as a small adjacent badge (both are fulfillment outcomes; sum = SENT_TO_BOOKING outflow).
8. **Narrow screens:** flow cards wrap to a compact horizontal-scroll row; arrows become vertical chevrons between stacked cards (no page overflow, §38).
9. **Selected filter state:** clicking a flow card applies `status=<state>` (server filter + URL + `active` card styling, §20); clicking «Всего заказов» clears lifecycle and payment filters.
10. **Help:** each flow state has a Help topic via the typed metric/help registry (`orders.kpi.{state}`), explaining the state, its transitions, and its meaning (ADR-HELP-001).

---

## 13. Orders Exception / Payment KPI Groups

**Three separate dimensions (prompt §13) — never collapsed:**

```text
ORDER LIFECYCLE STATUS  ≠  PAYMENT STATUS  ≠  REFUND STATUS
```

Actual enums (source of truth):

| Dimension | Enum | Values | Where |
|---|---|---|---|
| Order lifecycle | `OrderStatus` | 12 values (§11) | order.* |
| Order payment | `OrderPaymentStatus` | `UNPAID, PARTIALLY_PAID, PAID, REFUNDED` | order.* (Order.paymentStatus) |
| Refund | `RefundStatus` | `REQUESTED, APPROVED, PROCESSED, FAILED` | finance.* (Refund entity) |

Backend facts governing the payment group:
- `Order.paidAmount` — historical fact "money received" (server-owned, never rewritten).
- `Order.refundedAmount` — Order-owned projection on RefundProcessed; **full refund (`refundedAmount >= paidAmount`) → paymentStatus `REFUNDED`; partial → stays `PAID`** (schema L1943–1947). This is backend-derived, not UI-invented.
- Refund is a **separate dimension/aggregate** (finance.Refund), never a Payment status (`PaymentStatus.REFUNDED` is reserved vocabulary, unreachable — Payment stays `CAPTURED`; schema L3904+).
- Payment method is a **descriptive free-text string** on Payment (≤64 chars) — a type/metadata field, **not** a status dimension (schema L3885; `payment.service`).
- So the Orders payment KPI group uses `OrderPaymentStatus` counts (`aggregates.payment`, already server-side same-scope). Refund statuses belong to the **Payments tab** (Refund states group, §20) and to an attention condition («refund required» / pending refunds — detector `pendingRefund=true` already exists server-side).

Exception group (existing server detectors, ROUND 5):
- `paymentFailed=true` → orders with ≥1 `finance.Payment` FAILED (detector FAILED_PAYMENTS).
- `pendingRefund=true` → orders with ≥1 `finance.Refund` REQUESTED (detector PENDING_REFUNDS).
- `cancelledWithin=N` → orders cancelled in last N days (detector RECENT_CANCELLATIONS).

These become the Orders **Attention** queue cards (clickable → server filter, §22).

---

## 14. Bookings State-Machine Audit

Actual `BookingStatus` enum — all 13 from the prompt, confirmed in schema L2278–2294:

```text
NEW, PREPARING_REQUEST, SENT_TO_SUPPLIER, AWAITING_CONFIRMATION, CONFIRMED,
IN_SERVICE, COMPLETED, NEEDS_CLARIFICATION, SUPPLIER_REJECTED,
CHANGE_REQUESTED, CANCELLATION_REQUESTED, CANCELLED, PROBLEM
```

Actual transitions (D6 authority, `booking.service.ts TRANSITIONS` + `ACTION_PERMISSIONS`):

```text
prepare:              NEW → PREPARING_REQUEST
send:                 NEW | PREPARING_REQUEST → SENT_TO_SUPPLIER
requestClarification: SENT_TO_SUPPLIER | AWAITING_CONFIRMATION → NEEDS_CLARIFICATION
resume:               NEEDS_CLARIFICATION → SENT_TO_SUPPLIER
confirm:              SENT_TO_SUPPLIER | AWAITING_CONFIRMATION → CONFIRMED
reject:               SENT_TO_SUPPLIER | AWAITING_CONFIRMATION → SUPPLIER_REJECTED
service:              CONFIRMED → IN_SERVICE
requestChange:        CONFIRMED | IN_SERVICE → CHANGE_REQUESTED
resolveChange:        CHANGE_REQUESTED → CONFIRMED
requestCancellation:  CONFIRMED | IN_SERVICE | CHANGE_REQUESTED | NEEDS_CLARIFICATION → CANCELLATION_REQUESTED
complete:             IN_SERVICE → COMPLETED
cancel:               ACTIVE → CANCELLED
problem:              ACTIVE (except PROBLEM) → PROBLEM
```

This is a **branching** machine: multiple entry/exit paths around CONFIRMED/IN_SERVICE; clarification/change/cancellation loops; terminal SUPPLIER_REJECTED/CANCELLED/COMPLETED. It is **not** a single linear chain — the report explicitly rejects any visualization implying e.g. `SENT_TO_SUPPLIER → CONFIRMED → IN_SERVICE` as the only path.

Every status is classified below (justified per prompt §14; consistent with the accepted Help/Business Dictionary C1 contract that classified all 13 and locked the 6-KPI set):

| Status | Class | Terminal? | Action needed? | KPI group |
|---|---|---|---|---|
| NEW | Lifecycle (start) | NO | prep | Lifecycle flow |
| PREPARING_REQUEST | Lifecycle | NO | — | Lifecycle flow |
| SENT_TO_SUPPLIER | Lifecycle (awaiting supplier) | NO | monitor SLA | Lifecycle flow |
| AWAITING_CONFIRMATION | Lifecycle (awaiting supplier) | NO | monitor SLA | Lifecycle flow |
| CONFIRMED | Lifecycle | NO | — | Lifecycle flow |
| IN_SERVICE | Lifecycle (in service) | NO | — | Lifecycle flow |
| COMPLETED | Lifecycle (terminal success) | **YES** | — | Lifecycle flow (terminal) |
| NEEDS_CLARIFICATION | Attention (exception) | NO | operator/supplier action | Attention |
| CHANGE_REQUESTED | Attention (exception) | NO | resolve | Attention |
| CANCELLATION_REQUESTED | Attention (exception) | NO | approve/decline | Attention |
| PROBLEM | Attention (exception) | NO | operator action | Attention |
| SUPPLIER_REJECTED | Terminal exception | **YES** | possible rebook | Terminal exceptions |
| CANCELLED | Terminal exception | **YES** | no (terminal, may not require action) | Terminal exceptions |

---

## 15. Bookings KPI Grouping

**ADR-OPS-006** — Booking lifecycle visualization (branching machine → hybrid):

```text
TOTAL
[ Всего бронирований ]

ЖИЗНЕННЫЙ ЦИКЛ (happy-path flow, arrows only along the real path)
[ NEW ] → [ PREPARING_REQUEST ] → [ SENT_TO_SUPPLIER → AWAITING_CONFIRMATION ]
        → [ CONFIRMED ] → [ IN_SERVICE ] → [ COMPLETED ]

ВНИМАНИЕ / EXCEPTIONS (grouped cards, no arrows)
[ NEEDS_CLARIFICATION ] [ CHANGE_REQUESTED ] [ CANCELLATION_REQUESTED ] [ PROBLEM ]

ТЕРМИНАЛЬНЫЕ ИСКЛЮЧЕНИЯ
[ SUPPLIER_REJECTED ] [ CANCELLED ]
```

Design answers (prompt §35): option **C — hybrid**: main happy-path flow + exception groups + terminal-exception group.

- Arrows appear only along the happy path; `SENT_TO_SUPPLIER`/`AWAITING_CONFIRMATION` render as one stage pair (both are "awaiting supplier"; combined count = both statuses, matching the accepted C1 `bookings.awaitingConfirmation` metric) — no arrow implies a transition between them.
- **No arrow** anywhere into/out of NEEDS_CLARIFICATION / CHANGE_REQUESTED / CANCELLATION_REQUESTED / PROBLEM / SUPPLIER_REJECTED / CANCELLED — these are grouped cards only, preventing implied impossible transitions.
- **CANCELLED is terminal and does not imply action** — it is placed in «Терминальные исключения», **not** in «Внимание» (prompt §14).
- Reconciliation with the accepted C1 contract: the 6 exclusive KPI metrics (`bookings.total / awaitingConfirmation / confirmed / inService / completed / cancelled`) remain valid as filter/drill-down semantics; the Operations Center additionally renders them inside semantic groups (flow/attention/terminal) without changing the metric definitions or their status mappings. `bookings.awaitingConfirmation` covers `{SENT_TO_SUPPLIER, AWAITING_CONFIRMATION}`; `bookings.confirmed` covers `{CONFIRMED}`; `bookings.inService` covers `{IN_SERVICE}`; `bookings.completed` covers `{COMPLETED}`; `bookings.cancelled` covers `{CANCELLED, SUPPLIER_REJECTED}`; the remaining statuses (NEW, PREPARING_REQUEST, NEEDS_CLARIFICATION, CHANGE_REQUESTED, CANCELLATION_REQUESTED, PROBLEM) remain filter-only statuses in C1 terms, but in the Operations Center they get **visual group placement** (flow/attention) while their metric semantics stay filter-only. No metric definition is changed.
- All counts come from `aggregates.lifecycle` (server-side, same scope as table ✅).

---

## 16. Payments Domain Audit

Source-of-truth findings (prompt §15 checklist):

| Item | Finding | Source |
|---|---|---|
| Payment entity | `Payment` (finance.*), PAY-*, `referenceNumber`, `commerceSequence`/`paymentOrdinal`, `orderId`/`customerId`/`partnerId` refs (no FK, ADR-0001), `amount/currency` frozen verbatim from Order snapshot, `paymentMethod` free-text, `providerRef` opaque, `isActivePayment`, `version`, milestones `paidAt/failedAt/cancelledAt` | `schema.prisma` L3866–3925; `payment.service.ts` |
| PaymentStatus enum | `PENDING, AUTHORIZED, CAPTURED, FAILED, CANCELLED, REFUNDED`. **Runtime-reachable:** `PENDING → CAPTURED | FAILED | CANCELLED`. `AUTHORIZED`/`REFUNDED` are **reserved vocabulary** (2.12B PSP authorize / 2.13 refund notes) — not produced by current runtime | schema L3851–3860; `payment.service.ts` header |
| Payment method/type | Free-text `String?` (≤64), descriptive, no enum, no PII | schema L3885; `payment.service.createPayment` |
| Refund model/entity | `Refund` (finance.*), RFD-*, `paymentId` (source: CAPTURED only), `orderId` server-derived, `amount/currency`, `reason`, `isActiveRefund`, milestones `requestedAt/approvedAt/processedAt/failedAt` | schema L3986–4030; `refund.service.ts` |
| Refund status | `RefundStatus: REQUESTED → APPROVED → PROCESSED | FAILED` (REQUESTED\|APPROVED → FAILED) | schema L3972–3979; `refund.service.ts` |
| StripeEvent | **Does not exist.** No StripeEvent model, no stripe routes (tests assert `/finance/stripe-webhook` → 404 and ban stripe imports). Provider-neutral runtime with opaque `providerRef` only | `schema.prisma`; `d7-financial-qualification.e2e-spec.ts`; `payment-provider-abstraction.e2e-spec.ts` |
| Payment ↔ Order | 1 active Payment per Order (partial unique `Payment_one_active_per_order`); FAILED/CANCELLED allow attempt 2; CAPTURED blocks overpayment | schema L3925; `payment.service` |
| Booking ↔ Order ↔ Payment | `Request → Order → Booking` (commerceSequence chain); Booking.orderId; Payment.orderId → Order; Booking = linked Order financial truth (D7) | schema; `request.service` DTO chain |
| Payment audit/history | `PaymentHistory` (action/from/to/actor/comment) + security AuditLog (`finance.payment.*`) + outbox events (`PaymentCreated/Captured/Failed/Cancelled`) | schema L3919; `payment.service` |
| Payment permissions | `finance.payment.read` (list/get/export), `.create` (initiate), `.manage` (confirm/fail/cancel); `finance.refund.read/.write/.approve/.execute`; `finance.dispute.*` | `permissions.constants.ts`; `finance.controller.ts` |
| Workspace/tenant scoping | Platform operational scope = `Order.acquisitionSource` default `MARKETPLACE` (payments of marketplace orders); `PARTNER_STOREFRONT` denied on platform contracts; per-user tenant context (SEC-TENANT-01) still deferred | `payment.service.list`; `sales-scope.ts` |
| Existing finance read models | LedgerTransaction, ProviderFee, Settlement, Payout, Commission, CommissionAccrual, Dispute (all finance.* read APIs) | `finance.controller.ts` |
| D7 amount authority | Order = canonical financial truth for commerce totals; Booking = linked Order truth; Payment money fact = frozen Order snapshot verbatim; Refund never rewrites Payment.amount | D7 accepted; `payment.service`/`refund.service` headers |

---

## 17. Payment / Refund Source-of-Truth

```text
PAYMENT (finance.Payment)
  status: PENDING → CAPTURED (paidAt) | FAILED (failedAt) | CANCELLED (cancelledAt)
          AUTHORIZED / REFUNDED — reserved, unreachable in current runtime
  money:  amount/currency — frozen Order snapshot verbatim (server-owned; client
          cannot forge — 422 forbidden keys)
  method: free-text descriptive String (NOT a status, NOT an enum)

REFUND (finance.Refund)
  source: ONLY CAPTURED Payment (else 422)
  status: REQUESTED → APPROVED → PROCESSED | FAILED
  money:  amount ≤ refundable = payment.amount − Σ(non-FAILED refunds)
          (serialized pg_advisory_xact_lock — over-refund protection)
  Payment is NOT mutated (stays CAPTURED; PaymentStatus.REFUNDED semantically wrong for partial refunds)

ORDER-LEVEL PROJECTION (D7, order.Order)
  paymentStatus: UNPAID | PARTIALLY_PAID | PAID | REFUNDED   ← derived server-side
  paidAmount / refundedAmount: server-owned historical facts
  REFUNDED  ⟺ refundedAmount >= paidAmount (full refund); partial → PAID
```

**No UI-invented statuses.** Proposed-but-rejected vocabulary (`UNPAID/PARTIALLY_PAID/PAID/REFUNDED` as Payment-statuses): these exist **only** as `OrderPaymentStatus` (order level). The Payments tab must present **`PaymentStatus` + `RefundStatus`** (finance level); the Orders tab presents `OrderPaymentStatus`. Both are real; neither is invented (§13/§18).

---

## 18. Payments Operational Aggregate Decision

**ADR-OPS-009** — The Payments tab operates on **actual Payment/Refund records** (the finance aggregates), **not** duplicated Order rows.

```text
Order
├── Payment(s)          ← the operational aggregate: PAY-* record + its lifecycle
│     ├── Refund(s)     ← RFD-* records (partial refunds allowed)
│     └── Dispute(s)    ← DSP-* (chargeback foundation)
└── Booking(s)          ← commerce chain context
```

- D7 authority remains intact: **Order = canonical financial truth for commerce totals; Booking = linked Order financial truth** (no D7 redesign in UI-C1.2).
- A Payment row's context comes from its `orderId` (Order reference, customer, partner) — read-only resolution, no duplicate Order rows.
- The Order's `paymentStatus` projection is displayed on the **Orders** side; the **Payments** tab shows the underlying Payment/Refund records that produce it.

---

## 19. Payments vs Finance Boundary

**ADR-OPS-010** — Payments tab (Operations) vs Finance/Analytics remain distinct:

| | OPERATIONS CENTER / PAYMENTS | FINANCE / ANALYTICS (Command Center financial section) |
|---|---|---|
| Question | "What is happening with this concrete payment/refund?" | "What is happening with the business finances overall?" |
| Content | payment record, order reference, client, amount, payment state, refund state, payment method, transaction timestamps, operational exceptions, allowed actions, audit/history | GMV, Revenue, Commission, Take Rate, Provider Payables, Payouts, Provider Fees, reconciliation, trends |
| Not included | no GMV/commission/analytics widgets | no per-payment journal |

The Payments tab must **not** become a duplicate Finance Analytics page. Payment-level operational data (journal, states, refunds, exceptions, actions) lives in the Payments tab; aggregate financial metrics stay in the Command Center financial section / Analytics.

---

## 20. Payments KPI Model

Payments KPI cards are derived **only** from actual backend semantics (prompt §18):

```text
TOTAL
[ Всего платежей ]

СТАТУСЫ ПЛАТЕЖЕЙ  (PaymentStatus — runtime-reachable only)
[ PENDING ] [ CAPTURED ] [ FAILED ] [ CANCELLED ]
(AUTHORIZED/REFUNDED — reserved vocabulary: shown in the status *filter* for
journal completeness, but NOT as KPI cards, because the runtime cannot produce
them today; this is an explicit, documented choice, not an omission)

СТАТУСЫ ВОЗВРАТОВ  (RefundStatus)
[ REQUESTED ] [ APPROVED ] [ PROCESSED ] [ FAILED ]

ВНИМАНИЕ / СБОИ  (attention queue, server-authoritative)
[ Неуспешные платежи: FAILED ] [ Возвраты, требующие согласования: REQUESTED ]
[ Возвраты, требующие исполнения: APPROVED ]
```

- `UNPAID/PARTIALLY_PAID/PAID/REFUNDED` are **not** proposed as Payments KPI cards — they are `OrderPaymentStatus` (Orders tab) and derived aggregates at the Order level, explicitly reported (§13/§17).
- **Backend gap:** no Payments KPI endpoint exists (`finance/payments` returns page + no aggregates). A `GET /finance/payments/kpi` (or aggregates block on the list response) is required — staged in UI-C1.2E.
- **Existing violation to fix:** the current payments page computes its total-amount sum **client-side over the current page** — replaced by server-side aggregates in UI-C1.2E (no client-side counting, §23).

---

## 21. Payments Table / Detail Model

Proposed Payments registry columns, each marked by source (prompt §29):

| Column | Source | Notes |
|---|---|---|
| Payment reference | EXISTING SOURCE | `referenceNumber` (MKT-PAY-*) |
| Date | EXISTING SOURCE | `createdAt` (sortable); date type selectable → `paidAt`/`failedAt`/`cancelledAt` via `dateField` (backend already supports) |
| Order | EXISTING SOURCE (derived display) | resolve `Order.referenceNumber` from `orderId` (export already resolves; list must too) |
| Client | EXISTING SOURCE (derived display) | customer name from `customerId` (export resolves; list currently doesn't return it) |
| Amount | EXISTING SOURCE | Decimal string, currency |
| Paid / Refunded | DERIVED SERVER-SIDE | paid = `paidAt` presence (status CAPTURED); refunded = Σ linked non-FAILED Refunds — requires backend aggregation (new) |
| Due / refundable | DERIVED SERVER-SIDE | `refundable = payment.amount − Σ(non-FAILED refunds)` — server authority (D7 formula exists in `refund.service`); requires backend field |
| Payment method | EXISTING SOURCE | free-text display, safe (no PAN/CVV — field is descriptive, ≤64, no card data) |
| Payment status | EXISTING SOURCE | `PaymentStatus` badge |
| Refund status | DERIVED SERVER-SIDE | latest/aggregated refund state — requires backend field |
| Operational action | REQUIRES BACKEND WORK + UI | per-role action set (initiate/confirm/fail/cancel/refund) — RBAC-gated |
| Provider reference | EXISTING SOURCE | `providerRef` opaque — display as-is, no gateway payloads (§41) |

Proposed Payments detail page (`/app/payments/[id]`), reusing the accepted detail visual system (UI-C1.1 R3):
- Header: reference, Payment status badge, amount/currency hero.
- Detail card: code/status/amount/currency/method/order link/customer/partner/created/paid/failed/cancelled/providerRef (masked where applicable).
- **Refunds card:** linked RFD-* records with status, amount, reason, milestones; actions per RBAC.
- **History card:** `PaymentHistory` (+ Refund history) — audit timeline.
- **Order context card:** link to `/app/orders/{orderId}` (D7 authority for totals).

**ADR-OPS-012 (drill-down architecture, prompt §30):** option **D — Hybrid**:
- **A (dedicated `/app/payments/[id]`)** — canonical record URL: deep-linkable, auditable, RBAC-able, stable for finance reconciliation → **primary**.
- **B (Order detail finance/payment sub-section)** — the Order detail page gains a payments/refunds sub-section *linking* to the dedicated pages (context navigation; the commerce chain stays Order-centric).
- **C (drawer/preview from registry)** — rejected as a primary pattern (no deep links, weak auditability); the Orders quick-preview sidebar pattern may be reused later for the Payments registry if operational value is proven (secondary).
- Recommended target: **D — dedicated detail + Order-detail links; drawer optional later.**

---

## 22. Attention Model

**ADR (Attention)** — `ATTENTION = actionable operational queue ≠ decorative KPI group` (prompt §19):

- Server-authoritative queries only; every attention card = a real backend detector/filter.
- Clickable → applies server-side filter to the registry (+ URL state) (§20).
- Each card: clear reason + clear count; no client-derived stale counts.
- Entitlement/RBAC-aware (permission-gated like any KPI).

Validated against actual state models (supported vs future vs rejected):

**Requests** (supported by fields `supplierResponseDeadline`, `customerActionDeadline`, statuses):
- `CHECKING` beyond `supplierResponseDeadline` → supplier timeout risk (proposed detector; fields exist) — ACTUAL SUPPORTED (needs backend query, UI-C1.2H)
- `PRICE_CHANGED`/`CUSTOMER_ACCEPTED` with `customerActionDeadline` passed → waiting customer decision — ACTUAL SUPPORTED (fields exist)
- `SUPPLIER_TIMEOUT`, `CUSTOMER_PAYMENT_TIMEOUT`, `EXPIRED` — statuses exist — ACTUAL SUPPORTED
- `review` — REJECTED (no moderation concept on Requests)

**Orders** (detectors already implemented — ACTUAL SUPPORTED):
- `paymentFailed=true` (FAILED_PAYMENTS), `pendingRefund=true` (PENDING_REFUNDS), `cancelledWithin=N` (RECENT_CANCELLATIONS)
- `SUSPENDED` / `PROBLEM` counts — ACTUAL SUPPORTED (statuses)
- `unpaid` — ACTUAL SUPPORTED via `paymentStatus=UNPAID` (aggregates.payment)

**Bookings** (detectors already implemented — ACTUAL SUPPORTED):
- `upcoming=true` (CONFIRMED/NEW + serviceDate ≥ now), `overdue=true` (AWAITING_CONFIRMATION + createdAt < now−SLA) — both exist
- `NEEDS_CLARIFICATION`, `CHANGE_REQUESTED`, `CANCELLATION_REQUESTED`, `PROBLEM` — status counts (aggregates.lifecycle)
- **Not** "CANCELLED requires attention" — REJECTED (terminal, no action; §14)

**Payments**:
- `FAILED` payments — ACTUAL SUPPORTED (status)
- `REQUESTED` refunds (needs approval), `APPROVED` refunds (needs execution) — ACTUAL SUPPORTED (RefundStatus; queries needed in UI-C1.2E/H)
- `unresolved discrepancy` / `manual review` — FUTURE (requires reconciliation model — Finance analytics scope)

Report separation: supported conditions listed above; future ideas (payment discrepancy, manual review); rejected assumptions (Requests "review" queue, Bookings CANCELLED-as-attention).

---

## 23. Search Contract

Canonical toolbar order (per tab, exact controls depend on domain):

```text
[ Search ] [ Primary status filter ] [ Additional filters ] [ Date type ] [ From ] [ To ] [ Reset ] [ Export ]
```

- Search **first** in toolbar; server-side; debounce **350 ms** (Orders/Bookings already; Requests already; standardize at 350); Enter triggers immediate query; typing never blocked by loading; clearing/changing resets `page=1`; no explicit Search button.
- Audit of actual server search capabilities:

| Tab | Backend search fields | Source |
|---|---|---|
| Requests | `referenceNumber`, `code`, `commerceSequence` + customer (name/code/email), product (title/code), partner (name/code) | `request.service.listRequests` |
| Orders | `code`, `number`, `referenceNumber` (contains, insensitive) | `order.service.listOrders` |
| Bookings | booking `code`/`referenceNumber` + traveler names + order `number` | `resolveBookingSearchIds` |
| Payments | **none** — `finance/payments` has no `search` param | `payment.service.list` — GAP (UI-C1.2E: add search over code/referenceNumber + resolved order number) |

---

## 24. Filter Contract

Per tab (domain-specific semantics preserved; §6):

| Tab | Primary status filter | Additional filters | Detectors/quick filters |
|---|---|---|---|
| Requests | `status` (single today; multi-status parity optional, Orders-style) | `customerId`, `partnerId` (backend supports; UI optional) | (attention cards, §22) |
| Orders | `status` (multi) | `paymentStatus`, `sellerPartnerId`, `customerId` (backend supports) | `paymentFailed`, `pendingRefund`, `cancelledWithin` (attention) |
| Bookings | `status` (multi) | `orderId` (backend supports) | `upcoming`, `overdue`, `slaMinutes` (attention) |
| Payments | `status` (PaymentStatus) | `currency`, `orderId` (backend supports) | refund-state quick filters (UI-C1.2E) |

**Filter state / tab switching (prompt §24):** tab-specific filters remain tab-specific. When switching tabs (route navigation), each tab's filter state is restored from its own URL query params (ADR-OPS-012) — no incompatible status filters carried across domains. Date range is **not** carried across tabs (semantics are per-domain; §25). Search is reset on tab switch unless a business reason exists (none today).

**Reset:** a Reset control clears all tab filters + date + search → `page=1` → URL params cleared (Requests/Bookings currently lack Reset; added in shell).

---

## 25. Date / Period Contract

**ADR-OPS-007** — Never three permanent date ranges on a page. Canonical:

```text
[ Date type ▼ ] [ From ] [ To ]
```

Date type is shown **only** where the backend genuinely supports multiple date dimensions.

Actual backend date semantics:

| Tab | Backend-supported dimensions | Source | Date type selector? |
|---|---|---|---|
| Requests | `createdAt` (`dateFrom/dateTo`, half-open) | `request.service.listRequests` | **No** (only createdAt) |
| Orders | `createdAt` (half-open) + `cancelledWithin` detector (createdAt-based) | `order.service.listOrders` | **No** (only createdAt) |
| Bookings | `createdAt` (half-open); `serviceDate` via `upcoming` detector only | `booking.service.listBookings` | **No** (only createdAt) |
| Payments | `dateField` ∈ {`createdAt` (default), `paidAt`, `failedAt`, `cancelledAt`} + half-open range | `payment.service.list` | **Yes** — `createdAt` / `paidAt` (the two operationally meaningful dimensions); `failedAt`/`cancelledAt` available in backend, exposed later if needed |

Period semantics are half-open `[from, to)` everywhere (consistent with Analytics).

**Requests special rule (prompt §23):** the Requests KPI endpoint is global. The report decides (see §26) — **option B**: backend KPI scope extension becomes a prerequisite implementation item (UI-C1.2E); **interim behavior (A)** stays in effect until then: the Requests UI does **not** expose the date/period control next to a global KPI. Requests `dateFrom/dateTo` remain available via API/export but hidden in the UI until KPI parity lands.

---

## 26. KPI ↔ Table Scope Contract — P0

**ADR-OPS-008** — canonical rule:

```text
FILTER / PERIOD → SAME BACKEND QUERY SCOPE → KPI = TABLE
```

- **Orders ✅** — `aggregates.lifecycle`/`aggregates.payment` computed on the same filtered `where` (incl. date range, detectors, channel scope). No change needed.
- **Bookings ✅** — `aggregates.lifecycle` on same filtered `where`. No change needed.
- **Requests ⚠️** — list supports filters/date; KPI endpoint is **global**. Decision: **B** — extend `GET /requests/kpi` to accept the same query contract as the list (`status`, `search`, `dateFrom/dateTo`, channel scope) as a **prerequisite implementation item** (UI-C1.2E, backend). Until then, **A** applies: the period control stays hidden on Requests (already true today), so KPI/table divergence is not user-visible.
- **Payments ⚠️** — no KPI endpoint; the current UI's aggregate is client-side over the current page (a §23 violation). Decision: add server-side payment aggregates (status/refund-state/amount sums by currency) with the same `where` as the list (UI-C1.2E); the client-side AggregateSummary is removed.

No stale KPI, no client-side counting, no date filter on a table with a global KPI.

---

## 27. URL Filter-State Contract

**ADR-OPS-012** — adopt canonical query-param filter state per tab:

```text
search, status, paymentStatus, dateType, dateFrom, dateTo, page, sortBy, sortDirection
```

- Benefits: deep links, browser Back, reproducibility, Help links (prompt §43).
- Mechanics: route navigation for tabs (pushState via router); filter changes via `replaceState` (current pattern in Orders/Bookings/Payments) — avoids history spam while keeping Back for navigation.
- Current state per tab: Orders ✅ (status/paymentStatus/sort/date), Bookings ✅ (status/sort/search/date + detectors), Payments ✅ (status/currency/date/sort), Requests ❌ (none) → Requests adopts the contract in UI-C1.2B.
- Explicit decision: **do adopt**; the router architecture (Next.js App Router + `useSearchParams`) supports it safely; no forced migration beyond the four registries.

---

## 28. Table Design System

Shared registry-table grammar (shell-owned tokens, domain-specific columns):

- table header (uppercase slate-400, `SortableHeader` pattern)
- row density (py-2.5), row hover (`hover:bg-blue-50/50`)
- ref/id style (`font-mono text-xs text-blue-600` links)
- primary/secondary text (slate-900 / slate-400 sub-lines)
- status badge placement (`StatusBadge`, never raw enums)
- money formatting (`formatPrice`, locale-aware — fixes the hardcoded `ru-RU` debts in Orders/Bookings tables)
- date formatting (locale-aware via i18n `Locale`, fixing hardcoded `ru-RU`/`toLocaleDateString()` calls)
- empty cells (`—`, `EntityEmptyValue` convention)
- action cells (RBAC-gated)
- sticky behavior: header/table container, optional sticky first column on mobile (§38/ADR-OPS-013)
- pagination (`Pagination`, pageSize 20)
- loading skeleton (table rows shimmer; toolbar stays interactive)
- empty state (no-data vs zero-filters distinction + Reset, §37)
- error state (retry, no backend detail leakage)

**Requests pricing note (prompt §26):** «Цена витрины» (`displayedPrice`) and «Подтв. цена» (`confirmedPrice`) columns are **preserved as-is** in UI-C1.2; pricing/commission semantics are out of scope (§56). The shared shell only re-skins the column container, not the money semantics.

---

## 29. Requests Gap Matrix

| Capability | Current | Needed for Operations Center | Gap | Closure |
|---|---|---|---|---|
| KPI by active filters | `GET /requests/kpi` **global** (no params) | KPI scoped to list filters (status/search/date) | **endpoint takes no query params** | UI-C1.2E (backend) |
| Period KPI parity | none | KPI respects `dateFrom/dateTo` | same | UI-C1.2E |
| Search | ✅ ref/code/seq + customer/product/partner names | same | — | — |
| Status filters | ✅ single status | multi-status parity (Orders-style comma) recommended | minor | UI-C1.2B |
| Attention counts | none | supplier-timeout / waiting-decision / timeout queues | new aggregate queries | UI-C1.2H |
| Export | ✅ CSV/XLSX, respects filters | same | — | — |
| Help | none | metric IDs + KPI popovers + dictionary topics | new | UI-C1.2I |
| URL state | ❌ none | search/status/date/page/sort in URL | new | UI-C1.2B |
| Channel scope | ❌ no `acquisitionSource` scoping on list | parity with Orders/Bookings/Payments (platform MARKETPLACE scope) | new | UI-C1.2E (backend) |
| Sort | ❌ fixed `createdAt desc` | sort allowlist (createdAt/status/amount) | new | UI-C1.2E/B |

---

## 30. Orders Gap Matrix

| Capability | Current | Needed | Gap | Closure |
|---|---|---|---|---|
| Lifecycle KPI grouping | ✅ flat `aggregates.lifecycle` (12) | semantic flow + rework + exception groups | visualization only | UI-C1.2G |
| Payment KPI grouping | ✅ `aggregates.payment` (4) | same, in semantic group | — | — |
| Exception grouping | ✅ detectors (`paymentFailed`, `pendingRefund`, `cancelledWithin`) | attention UI cards + Reset | UI only | UI-C1.2H |
| Current aggregates | ✅ same-scope, server-side | — | — | — |
| Search | ✅ code/number/reference | same | — | — |
| Period | ✅ createdAt half-open | Date-type selector **not** needed (single dimension) | — | — |
| Table | ✅ 8 cols + detector cols | locale dates/money; sticky mobile | UI polish | UI-C1.2C |
| Export | ✅ CSV/XLSX, filter parity | same | — | — |
| Help | none | metric IDs + flow-state topics | new | UI-C1.2I |
| Attention | ✅ server detectors | integrated cards | UI | UI-C1.2H |
| URL state | ✅ status/paymentStatus/sort/date | + search | minor | UI-C1.2C |
| Quick-preview | ✅ sidebar | decide fit with shell (keep as registry-level secondary surface; not part of the shell KPI area) | decision made (keep, §27) | UI-C1.2C |

---

## 31. Bookings Gap Matrix

| Capability | Current | Needed | Gap | Closure |
|---|---|---|---|---|
| 13 canonical statuses | ✅ all in enum + UI grid | — | — | — |
| Classification into visual groups | flat grid | lifecycle flow + attention + terminal-exception groups (ADR-OPS-006) | UI | UI-C1.2G |
| KPI aggregation | ✅ `aggregates.lifecycle` same-scope | — | — | — |
| Period | ✅ createdAt half-open | — | — | — |
| Search | ✅ code/ref + travelers + order number | — | — | — |
| Table | ✅ 8 cols | locale dates/money | UI polish | UI-C1.2D |
| Export | ✅ CSV/XLSX, filter parity | — | — | — |
| Help | none | metric IDs + state topics (C1 metric IDs) | new | UI-C1.2I |
| Attention | ✅ upcoming/overdue detectors | integrated cards | UI | UI-C1.2H |
| URL state | ✅ status/sort/search/date + detectors | — | — | — |

**Booking financial display (prompt §28):** Booking.amount/currency are frozen snapshots of the linked OrderItem (D7); the registry displays them as presentation of the linked Order truth — **no** independent financial authority is created. Order's `paymentStatus`/amount remains the canonical financial presentation for commerce totals; the Booking table keeps amount display only (as today).

---

## 32. Payments Gap Matrix (mandatory, with sources)

| Requirement | Existing backend support | Source | Gap | Proposed stage |
|---|---|---|---|---|
| Payment registry | ✅ `GET /finance/payments` (status/currency/date/dateField/orderId/sort/page; channel scope) | `payment.service.list` | no search, no aggregates, list doesn't resolve order/customer names | UI-C1.2E (search+names) / UI-C1.2F (UI) |
| Payment detail | ✅ `GET /finance/payments/:code` (whitelist DTO) | `payment.service.getByCode` | DTO lacks linked refunds/history/notes; no actions | UI-C1.2E/F |
| Payment statuses | ✅ `PaymentStatus` (PENDING/CAPTURED/FAILED/CANCELLED reachable) | schema L3851; `payment.service` | — | — |
| Refund statuses | ✅ `RefundStatus` (REQUESTED/APPROVED/PROCESSED/FAILED) | schema L3972; `refund.service` | — | — |
| Payment method | ✅ free-text `String?` (≤64, descriptive, no PII) | schema L3885 | not typed; display-only | UI-C1.2F (display) / typed — future |
| Search | ❌ none | `payment.service.list` (no `search`) | add search (code/ref + order number) | UI-C1.2E |
| Date filters | ✅ `dateField` + half-open range | `payment.service.list` | — | — |
| KPI aggregation | ❌ none | no aggregate endpoint | add payment/refund aggregates same-scope; remove client-side sum | UI-C1.2E |
| Audit/history | ✅ `PaymentHistory`/`RefundHistory` + security AuditLog + outbox | schema; services | no public history endpoint | UI-C1.2E/F |
| Actions/refund | ✅ `finance.payment.create/manage`, `finance.refund.write/approve/execute` | `finance.controller.ts` | no UI surface (detail page read-only) | UI-C1.2F |
| RBAC | ✅ `finance.payment.*`, `finance.refund.*`, `finance.dispute.*` | `permissions.constants.ts` | — | — |
| Tenant isolation | ⚠️ channel scope via `Order.acquisitionSource` (default MARKETPLACE); storefront denied | `payment.service.list`; `sales-scope.ts` | per-user tenant/workspace context (SEC-TENANT-01) deferred | LATER |
| Export | ✅ CSV/XLSX with order/partner/customer names | `finance.controller.exportPayments` | — | — |
| Dispute | ✅ DSP-* foundation (read + open/resolve/cancel) | `finance.controller` | operational UI out of C1.2 scope (Finance Center surface) | future / FIN-01 |

---

## 33. Workspace / Entitlement Matrix

**ADR-OPS-011 (derivation)** — tab visibility is derived from actual capabilities (`ROLE_PERMISSIONS`). PLATFORM vs PARTNER (prompt §40):

| Capability | PLATFORM | Marketplace Basic | Storefront Pro |
|---|---|---|---|
| Requests | **VISIBLE** (`order.read`) | HIDDEN (no internal read perms; own-scope only) | HIDDEN |
| Orders | **VISIBLE** (`order.read`) | HIDDEN | HIDDEN |
| Bookings | **VISIBLE** (`booking.read`) | HIDDEN | HIDDEN |
| Payments | **VISIBLE** (`finance.payment.read`) | HIDDEN | HIDDEN |

- PARTNER/BUYER roles hold only own-scope read models (`account.*.read_own`, `reverse.*`, storefront), never the internal unscoped read contracts → the four tabs are not rendered for them; server access remains authoritative (404/403 semantics, §34).
- Marketplace Basic / Storefront Pro partner tiers do not grant internal Operations Center permissions today — no entitlement work is required to hide the tabs; **REQUIRES BACKEND/ENTITLEMENT WORK** only if partner-side operational surfaces are ever intended (not in scope).
- Canonical hierarchy respected: IDENTITY → WORKSPACE CONTEXT → TENANT/PARTNER SCOPE → PLAN/ENTITLEMENTS → BUSINESS CAPABILITIES → ROLE/PERMISSIONS. Platform staff operate in the platform workspace (MARKETPLACE scope) by default.

Role → tab matrix (actual permissions):

| Role | Заявки | Заказы | Бронирования | Платежи |
|---|---|---|---|---|
| ADMIN | ✅ | ✅ | ✅ | ✅ (full incl. refund execute) |
| OPERATOR | ✅ | ✅ | ✅ | ❌ (no `finance.payment.read`) |
| FINANCE | ✅ (`order.read`) | ✅ | ✅ | ✅ (full operational) |
| DIRECTOR | ✅ | ✅ | ✅ | ✅ read-only |
| ANALYST | ✅ | ✅ | ✅ | ✅ read-only |
| SALES_MANAGER | ✅ | ✅ | ✅ | ✅ read-only |
| MARKETER / MODERATOR | ❌ | ❌ | ❌ | ❌ |
| PARTNER / BUYER | ❌ | ❌ | ❌ | ❌ |

---

## 34. RBAC / Security

Preserved unchanged (no implementation in this stage, but the design binds them):

- **Server-side RBAC** — every endpoint keeps `@RequirePermissions`; hidden tabs/buttons are never a security boundary (prompt §38).
- **Workspace isolation** — platform operational scope default `MARKETPLACE` (Orders/Bookings/Payments via `acquisitionSource`; Requests to gain the same in UI-C1.2E).
- **Tenant isolation** — `PARTNER_STOREFRONT` scope is explicitly denied on platform contracts (orders/bookings/payments → empty/deny; direct UUID/business-ref reads → 404 enumeration protection) — preserved.
- **Wrong-context behavior** — NOT FOUND / no existence leakage; 403 only where existence is intentionally knowable under canonical policy.
- **D5 Order action authority** — preserved (order transitions server-side CAS; UI only renders `availableActions`).
- **D6 Booking action authority** — preserved (booking transitions + `ACTION_PERMISSIONS`; UI renders `availableActions`).
- **D7 finance authority** — preserved: Order = canonical financial truth; Booking = linked Order truth; Payment money fact frozen from Order snapshot; Refund never rewrites Payment; no UI-side money computation (only formatting).
- **Audit immutability** — `*_history` tables + security AuditLog remain append-only; the Payments detail History card is read-only display.
- **Payments PII/PCI (§41):** no raw PAN/CVV anywhere (Payment carries only descriptive `paymentMethod` ≤64 chars and opaque `providerRef`); payment method displayed as-is without card data; provider transaction IDs shown, gateway payloads never exposed; refund actions permission-gated (`finance.refund.write/approve/execute` — FINANCE/ADMIN only); finance-role restrictions per `ROLE_PERMISSIONS`.

---

## 35. Help / Business Dictionary Integration

Preserves the accepted architecture (ADR-HELP-001):

```text
BACKEND DOMAIN/QUERY SERVICES        = business calculation authority
SHARED TYPED METRIC/HELP REGISTRY    = metric/status metadata authority
i18n (lib/i18n.tsx)                  = localized presentation text authority
HELP UI / KPI POPOVER                = consumers only
```

- Every Operations Center KPI/status group gets **stable topic/metric IDs** per the `{domain}.{metric}` convention:
  - `requests.total`, `requests.{status_lower}`, attention: `requests.attention.supplierSla`, `requests.attention.customerDecision`, `requests.attention.timeouts`
  - `orders.total`, `orders.lifecycle.{state}` (12), `orders.payment.{state}` (4), attention: `orders.attention.paymentFailed`, `orders.attention.pendingRefund`, `orders.attention.recentCancellations`
  - `bookings.*` — reuse the accepted C1 metric IDs (`bookings.total`, `bookings.awaitingConfirmation`, `bookings.confirmed`, `bookings.inService`, `bookings.completed`, `bookings.cancelled`) + flow/attention topic IDs
  - `payments.total`, `payments.payment.{status}`, `payments.refund.{status}`, attention: `payments.attention.failed`, `payments.attention.refundRequested`, `payments.attention.refundApproved`
- No independent frontend formulas — KPI tooltips/Help consume registry metadata; counts come from backend; money from D7 API (formatting only).
- KPI cards/statuses carry contextual Help affordance (`ⓘ`), per the accepted HELP-03 contract, delivered with UI-C1.2I.

---

## 36. Localization

- Full RU/AZ/EN for all new surfaces (shell title, tab labels, group titles, toolbar labels, attention cards, payments labels).
- **One status → one canonical localized label** (prompt §32): KPI card, filter option, table badge, detail badge, Help, export all use the same key. Existing canonical keys already exist for Order/Booking/Request/Payment statuses; the shell must not introduce synonyms.
- No raw enum leakage in any surface (the Payments status filter currently renders `PENDING/CAPTURED/…` option values via `t("status.entity.*")` — keep, and apply the same pattern to group titles).
- Fix known localization debts surfaced by the audit: hardcoded `ru-RU` date/`toLocaleDateString()` in Orders/Bookings tables, hardcoded RU waiting-cell text in Bookings, the literal «Статус» header in Requests, and the literal «Быстрый просмотр» title in Orders (all folded into UI-C1.2B–F).
- Export headers: backend export column headers are English today — acceptable as machine-facing format; status *values* in export remain canonical enum codes (not localized) for reconciliation; documented decision (no change).

---

## 37. Accessibility

- Tabs: `role="tablist"/"tab"/"tabpanel"`, arrow-key left/right navigation, roving tabindex, visible focus, correct ARIA labels (tab labels localized).
- KPI cards: rendered as buttons/links when interactive (`CommerceKpiCard` already `onClick`); non-interactive cards are plain divs (no fake interactivity).
- Status meaning never color-only: `StatusBadge` carries text labels; attention cards show reason text + count.
- Accessible tables: proper `<th scope>`, `SortableHeader` with `aria-sort`, table container focusable when scrollable (mobile), caption where feasible.
- Filter inputs: visible labels/placeholders + `aria-label`; date inputs labeled (From/To).
- Responsive focus order matches visual stacking (Primary → Secondary → … on mobile).
- Screen-reader-friendly counts: attention cards announce "N требующих внимания" via `aria-label`/`sr-only` where applicable.

---

## 38. Responsive Design

Canonical responsive contract (prompt §36):

- **Desktop (≥1280):** tabs row, KPI groups (flow + grids), attention, toolbar, table, pagination — one column page; shell max-width and geometry mirror the accepted detail-page shell (1440 px max, consistent gaps).
- **Tablet (768–1279):** tabs wrap or scroll horizontally in a controlled manner; KPI groups adapt (existing `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6/7` pattern preserved); toolbar wraps predictably (flex-wrap); table remains usable.
- **Mobile (<768):** tabs horizontally scrollable/compact; KPI groups stack (grid-cols-2); filters use the existing inline wrap (a filter sheet/panel is optional future polish, not required); **no horizontal page overflow**; table strategy per ADR-OPS-013.

**ADR-OPS-013** — mobile registry pattern: **responsive table with horizontal scroll + sticky first column** (ref column `position: sticky; left: 0` on a `min-width` table inside the card container). Rationale: preserves sorting, column semantics, and comparability; card layouts lose tabular scanning and complicate server-side sort; hybrid (cards for KPI/attention, table for registry) rejected for the registry itself. Lifecycle flow on mobile: cards wrap with vertical chevrons (no overflow, §12.8).

---

## 39. Loading / Empty / Error States

Shell-owned canonical states:

- **Loading:** skeleton/progressive table loading; toolbar stays interactive; search typing never blocked; KPI area shows skeleton cards. No full-page spinner (preserves §21 debounce UX).
- **Empty:** distinguish "no data exists" vs "current filters returned zero results" — a filter-context banner with a **Reset** action; message text localized. (Requests currently renders a single «Нет заявок» line — upgraded.)
- **Error:** retry action; no sensitive backend detail leakage (sanitized message; existing pattern `error.message` → replace with user-safe copy + retry).
- **Permission denied:** follow canonical 403/404 semantics — route-level redirect exists in Shell; for in-page data (e.g., Payments tab data with expired permission) render the not-found/denied surface without existence leakage (§34).

---

## 40. Performance

Canonical rule (prompt §44): **ONLY ACTIVE TAB FETCHES ACTIVE DOMAIN DATA.**

- The shell renders one active tab; no cross-tab prefetch of KPI/table payloads (Next.js route navigation naturally unmounts the previous tab; no `prefetch` on tab links).
- Request cancellation on tab switch: route navigation abandons stale component state; optional `AbortController` wiring in registry fetchers to avoid setState-after-unmount.
- Pagination, 350 ms search debounce, KPI/table query consolidation (already consolidated: KPI aggregates ride the list response for Orders/Bookings; Payments gains the same in UI-C1.2E).
- Cache behavior: browser-level (no custom cache); no server cache changes in this stage.
- All four registries fetch independently (unchanged); the shell adds no extra data fetching beyond `useCurrentUser`/session.

---

## 41. Component Architecture

Proposed reusable component architecture (illustrative; **no production code in this stage**):

```text
OperationsCenterShell            — page skeleton, breadcrumbs, header geometry
OperationsCenterHeader           — «ЦЕНТР ОПЕРАЦИЙ» title + period/actions slot
OperationsCenterTabs             — role="tablist", route-driven, permission-aware
OperationsKpiOverview            — Total + groups + attention containers
OperationsTotalKpi               — wraps CommerceKpiCard variant="total"
OperationsKpiGroup               — semantic group title + card grid
OperationsLifecycleFlow          — connected flow geometry (Orders/Bookings happy path)
OperationsAttentionGroup         — actionable queue cards (server filters)
OperationsToolbar                — search + filters + date + reset + export placement
OperationsSearch                 — debounced server search input
OperationsFilterGroup            — status/currency/etc. selects
OperationsPeriodFilter           — [Date type ▼] [From] [To] (per-tab config)
OperationsRegistryTable          — shared table grammar (columns domain-provided)
OperationsPagination             — wraps Pagination
OperationsLoadingState           — skeleton
OperationsEmptyState             — no-data vs zero-filters + Reset
OperationsErrorState             — retry, sanitized

Domain adapters/config (business semantics only):
RequestsOperationsConfig         — KPI set, filters, columns, attention, search
OrdersOperationsConfig           — lifecycle flow, payment group, detectors, columns
BookingsOperationsConfig         — flow + attention + terminal groups, columns
PaymentsOperationsConfig         — payment/refund groups, columns, dateField
```

All primitives reuse the accepted UI-C1.1 token system (card grammar, badges, detail primitives); the shell is a composition of existing + new thin primitives. Config objects are typed (mirroring the typed metric/help registry idea) so the shell renders without domain knowledge.

---

## 42. ADR Decisions

| ID | Decision | Rationale (evidence) |
|---|---|---|
| ADR-OPS-001 | Routes: `/app/requests`, `/app/orders`, `/app/bookings` preserved; `/app/payments` canonical (migrate `/app/finance/payments`); `?tab=` only secondary | prompt §4; existing URLs/bookmarks/tests; Payments UI already exists under finance |
| ADR-OPS-002 | Sidebar: ОПЕРАЦИИ (3 items) + new ФИНАНСЫ → Платежи; no «Центр операций» item; active highlight = domain route | prompt §3/§8; Shell permission model |
| ADR-OPS-003 | Shared `OperationsCenterShell` rendered by all four routes; domain configs supply business content | prompt §5/§6; UI-C1.1 parity precedent |
| ADR-OPS-004 | KPI = Total + semantic groups + Attention; group grammar shared, business content per domain; no flat endless grid | prompt §9/§33 |
| ADR-OPS-005 | Orders flow: happy path arrows (NEW→…→CLOSED), rework loop badge, exception group, separate payment group; PARTIALLY_FULFILLED folds into FULFILLED stage | actual D5 transitions (near-linear + 2 branches) |
| ADR-OPS-006 | Bookings: hybrid (happy-path flow + attention group + terminal-exception group); no arrows off the happy path; CANCELLED not "attention"; C1 6-KPI metrics preserved | actual D6 branching machine; accepted C1 contract |
| ADR-OPS-007 | Period contract: `[Date type][From][To]`; Date type only where backend supports (Payments only today); half-open `[from, to)` | backend date semantics audit |
| ADR-OPS-008 | KPI/table scope consistency mandatory; Requests KPI scope extension = prerequisite (B) with interim hide-period (A); Payments server aggregates replace client-side sum | verified same-scope aggregates (Orders/Bookings); global Requests KPI; client-side payments sum |
| ADR-OPS-009 | Payments aggregate = Payment/Refund/Dispute records (not Order rows); D7 untouched | finance entities + D7 authority |
| ADR-OPS-010 | Payments tab = operational journal; Finance analytics stays separate | prompt §17; Command Center financial section exists |
| ADR-OPS-011 | Permission-aware tabs derived from `order.read`/`booking.read`/`finance.payment.read`; hidden ≠ security | ROLE_PERMISSIONS matrix |
| ADR-OPS-012 | URL filter state adopted (search/status/dateType/from/to/page/sort); replaceState for filters, route for tabs; Requests gains it | current Orders/Bookings/Payments pattern |
| ADR-OPS-013 | Mobile registry = horizontal-scroll table + sticky ref column; no card layout for registries | table semantics vs cards; §38 |

Plus the attention/drill-down decisions captured in §22 and §21 (hybrid detail architecture).

---

## 43. Implementation Phasing

Proposed target sequence (adjusted for discovered gaps; **not implemented in this stage**):

```text
UI-C1.2A — Operations Center Shared Shell (layout, header, tabs, sidebar ФИНАНСЫ→Платежи,
           loading/empty/error states, responsive contract)
UI-C1.2B — Requests Registry Migration (shell tab, URL state, Reset, search/status,
           locale dates, no period until KPI parity)
UI-C1.2C — Orders Registry Migration (shell tab, semantic KPI groups, attention cards,
           locale dates/money, quick-preview decision applied)
UI-C1.2D — Bookings Registry Migration (shell tab, flow + attention + terminal groups,
           locale dates/money)
UI-C1.2E — Payments Backend/Read-Model Prerequisites (Requests KPI scope extension,
           Requests channel scope, Payments KPI aggregates + search + names,
           Refunds list date/export/aggregates, Payment detail DTO with refunds/history)
UI-C1.2F — Payments Registry Integration (canonical /app/payments + detail, sidebar,
           actions, refunds/history cards; migrate /app/finance/payments)
UI-C1.2G — KPI Semantic Grouping / Lifecycle Flow (Orders flow, Bookings hybrid flow,
           group geometry, selected-state, narrow-screen behavior)
UI-C1.2H — Attention / Period / Filter Reconciliation (Requests attention queries,
           Orders/Bookings/Payments attention cards, period contracts, Reset)
UI-C1.2I — Help / i18n / Accessibility (metric/help registry entries, popovers,
           ARIA tabs/KPI, RU/AZ/EN qualification)
UI-C1.2J — Browser / Security / Regression Closure (RBAC re-verification, tenant
           scope, D5/D6/D7 preservation, responsive 1680/768/390, browser evidence)
UI-C1.2K — Git Hard Closure (porcelain empty, HEAD == origin/master, canonical SHA)
```

Precedence notes: UI-C1.2E (backend) precedes UI-C1.2B's period exposure and UI-C1.2F; UI-C1.2A precedes all UI work; UI-C2 and D8 remain NOT STARTED (§54/§55).

---

## 44. Non-Scope / Deferred Items

- **UI-C2 — Commerce Relation Chain** (Request → Order → Booking): NOT started; Operations Center links to detail pages only (§54).
- **D8 — temporal visibility**: NOT started (§55).
- **Pricing / commission reconciliation**: «Цена витрины»/«Подтв. цена» preserved; `supplierPrice + commission = sellingPrice` model NOT canonized (§56).
- **Finance Center (FIN-01), PSP/provider integration (FIN-02), Payout (FIN-03)**: deferred.
- **SEC-TENANT-01** (per-user tenant/workspace context UI): deferred.
- **Payments dispute operational UI** (DSP-*): Finance Center surface, future.
- **Typed payment method catalog**: future (currently descriptive free text).
- **Advanced Help features** (fuzzy search, related topics, tutorials, analytics, editorial tooling): LATER.
- **Payment discrepancy / manual-review attention**: future (needs reconciliation model).

---

## 45. Acceptance Matrix (Definition of Done — design stage)

| # | Deliverable | Status | Evidence |
|---|---|---|---|
| 1 | Canonical Operations Center architecture | ✅ | §4 |
| 2 | 4-tab navigation contract | ✅ | §8 |
| 3 | Sidebar ownership contract | ✅ | §5 |
| 4 | Canonical URL strategy | ✅ | §6, ADR-OPS-001 |
| 5 | Shared registry shell design | ✅ | §7 |
| 6 | Semantic KPI grouping model | ✅ | §9, ADR-OPS-004 |
| 7 | Order lifecycle KPI design on real statuses | ✅ | §11–§13 (actual `OrderStatus`/transitions) |
| 8 | Booking lifecycle KPI design on real statuses | ✅ | §14–§15 (actual 13-status machine) |
| 9 | Payments domain audit | ✅ | §16 |
| 10 | Payments vs Finance boundary | ✅ | §19, ADR-OPS-010 |
| 11 | Payment KPI/table proposal from source truth | ✅ | §17, §20–§21 |
| 12 | Period/filter contract | ✅ | §24–§25, ADR-OPS-007 |
| 13 | KPI/table scope consistency contract | ✅ | §26, ADR-OPS-008 |
| 14 | Permission/entitlement matrix | ✅ | §33 (ROLE_PERMISSIONS) |
| 15 | Responsive model | ✅ | §38, ADR-OPS-013 |
| 16 | Help/i18n/accessibility contract | ✅ | §35–§37 |
| 17 | Gap matrices | ✅ | §29–§32 |
| 18 | ADR decisions | ✅ | §42 (13 ADRs) |
| 19 | Implementation phasing | ✅ | §43 |
| 20 | Security preservation | ✅ | §34 (D5/D6/D7/RBAC/tenant/PII) |
| 21 | UI-C2 not started | ✅ | no code changes |
| 22 | D8 not started | ✅ | no code changes |
| 23 | Git hard closure (docs committed) | ✅ | §46 |

**VERDICT B guard-rail self-check** — none triggered: no giant stacked page proposed (§4); Payments stays in sidebar under ФИНАНСЫ (§5); canonical URLs preserved + new route justified by existing surface (§6); payment statuses sourced from actual enums, `UNPAID/…` correctly attributed to OrderPaymentStatus (§13/§17/§20); order statuses from D5 machine (§11); Booking grouping from actual machine (§14–§15); lifecycle arrows only on truthful happy paths (§12/§15); KPI/table scope consistency mandated + Requests divergence resolved by prerequisite (B) + interim (A) (§26); client-side counting removed from Payments design (§20/§26); Payments ≠ Finance analytics (§19); D7 untouched (§18/§34); only active tab fetches (§40); hidden tabs not security (§8/§34); PLATFORM/PARTNER matrix included (§33); UI-C2/D8 not started (§54/§55); **no production implementation performed** (docs only).

---

## 46. Git Hard Closure

```text
$ git status --porcelain=v1
<NO OUTPUT>

$ git rev-parse HEAD
07f85578b645a77c743d9898597fcf16bfb2a736

$ git rev-parse origin/master
07f85578b645a77c743d9898597fcf16bfb2a736

HEAD == origin/master: YES
```

Scope of committed changes: the prompt file (`docs/prompts/PHASE_3_COMMERCE_CENTER_UI_C1_2_OPERATIONS_CENTER_ARCHITECTURE_DESIGN_RECONCILIATION.md`) + this report. **No production code changed** — backend and frontend trees untouched (D5/D6/D7, UI-C1/UI-C1.1 preserved; UI-C2/D8 not started).

---

## 47. Final Verdict

```text
VERDICT A — UI-C1.2 —
OPERATIONS CENTER
ARCHITECTURE & DESIGN RECONCILIATION ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED

UI-C1.2 DESIGN CONTRACT — ACCEPTED

PRODUCTION IMPLEMENTATION — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

FINAL SHA:
07f85578b645a77c743d9898597fcf16bfb2a736

TRUE NEXT:
UI-C1.2A — OPERATIONS CENTER SHARED SHELL IMPLEMENTATION
```

---

## 48. TRUE NEXT

**UI-C1.2A — OPERATIONS CENTER SHARED SHELL IMPLEMENTATION** — build `OperationsCenterShell` (layout/header/tabs/sidebar ФИНАНСЫ→Платежи, loading/empty/error, responsive contract), then migrate Requests (UI-C1.2B) as the first tab. Backend prerequisites (Requests KPI scope extension, Payments aggregates/search, Refunds list/export) are staged in UI-C1.2E ahead of the surfaces that depend on them.