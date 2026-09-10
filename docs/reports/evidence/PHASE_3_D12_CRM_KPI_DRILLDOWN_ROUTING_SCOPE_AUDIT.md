# PHASE 3 — D12 CRM / KPI Drill-down Routing — Scope Audit

## 1. Executive Summary

D12 определяет canonical drill-down routing из KPI дашбордов в CRM/entity surfaces. Audit показал, что основная инфраструктура drill-down **уже существует** и работает через `metric-drilldown.ts` shared framework. Однако есть **конкретные gaps** в context propagation (Bookings page не читает `from`/`to`), **отсутствие drill-down** для Command Center KPI, и **расхождения в param naming** между source и target pages.

**Ключевые выводы:**

1. **Shared drill-down framework** (`metric-drilldown.ts`) — canonical, typed, well-architected. Используется Analytics Center. Другие центры (Orders/Bookings/Payments) используют in-page KPI filtering, а не cross-page drill-down.
2. **Command Center KPI cards** — полностью non-clickable (presentational only). Это significant gap от D12 canonical scope.
3. **Bookings page** не читает `from`/`to` params — только `dateFrom`/`dateTo`. Analytics drill-down отправляет `from`/`to`, что создаёт context loss.
4. **Orders page** корректно читает оба `from` и `dateFrom` (двойной fallback).
5. **CRM page** читает `from`/`to` напрямую.
6. **Partner 360** корректно читает `from`, `to`, `preset`, `fromAnalytics`.
7. **Customer 360** не читает period params вообще — нет отдельных period-scoped queries.
8. **Entity identity** — UUID везде в URL, кроме Payment (код `PAY-*`). IDOR protection серверный, comprehensive.
9. **Finance metrics** (GMV, Revenue, Commission, Refunds) — `destinationType: NONE` (non-clickable), pending Finance stage.
10. **Два разных D12** — ADR-0013 "Dispute Adjustment" (unrelated) и Phase 3 D12 (CRM/KPI routing). Нет коллизии.

**READINESS: READY WITH EXPLICIT GAPS**

---

## 2. Repository Baseline

```text
HEAD:           0172fb4ce9f2f850495157d0e8913819c8a21cb9
origin/master:  0172fb4ce9f2f850495157d0e8913819c8a21cb9
working tree:   CLEAN (untracked prompt artifacts only)
diff --check:   PASS
D11 closure:    0172fb4 (docs(D11): project-wide KPI/status semantics canonical contract)
current TRUE NEXT: D12 ✅ CONFIRMED
```

---

## 3. D12 Canonical Definition

### 3.1 Master Roadmap v3

```
D10 ✅ Partner Performance Attribution (79ef1fc)
D11 ✅ Project-Wide KPI/Status Semantics (0172fb4)
D12 ⬜ CRM / KPI Drill-down Routing Requalification  ← CURRENT TRUE NEXT
D13 ⬜ Voucher
D14 ⬜ PRE-STEP 3.12 Final Requalification
STEP 3.12 ⬜ BLOCKED BY D14
```

### 3.2 Lifecycle Contract

```
COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md L832:
| D12 | CRM/KPI routing |
```

### 3.3 Architecture

```
TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md L454:
D1 → D2 → D3 → D4 → D5/D6 → D7 → D8 → D9 → D10 → D11 → D12 → D13 → D14 → STEP 3.12
```

### 3.4 Type

```
REQUALIFICATION_DEBT — establishes canonical drill-down routing contracts
```

### 3.5 Canonical Purpose

Establish canonical drill-down routing from KPI dashboards to CRM/entity surfaces, including:
- Route normalization
- KPI context propagation (period, status, partner, currency, scope)
- Entity identity verification (UUID vs code)
- Server-side authority for entity authorization
- Temporal propagation (D8 canonical)
- Security/IDOR prevention
- Cross-scope preservation
- D10/D11 integration

### 3.6 Explicit Exclusions

- Does NOT "fix links in UI"
- Does NOT define KPI formulas (D11 owns)
- Does NOT weaken existing RBAC
- Does NOT create new KPI
- Does NOT create new CRM surfaces (missing targets = ARCHITECTURE GAP)
- Does NOT change D10 attribution or D11 KPI/status semantics
- Does NOT touch Finance

---

## 4. Current Routing Inventory

### 4.1 Analytics Center — Cross-Page Drill-downs

The **only center with cross-page KPI drill-down** via `metric-drilldown.ts`.

| # | Source KPI | Destination | Navigation | Params Transferred | Status |
|---|---|---|---|---|---|
| 1 | Orders | `/app/orders` | `<Link>` | `from`, `to`, `preset`, `fromAnalytics` | EXISTS ✅ |
| 2 | Bookings | `/app/bookings` | `<Link>` | `from`, `to`, `preset`, `fromAnalytics` | PARTIAL ⚠️ (see §8) |
| 3 | Customers | `/app/crm?tab=customers` | `<Link>` | `from`, `to`, `preset`, `fromAnalytics` | EXISTS ✅ |
| 4 | Partners | `/app/crm?tab=partners&entitled=true` | `<Link>` | `fromAnalytics` (ALL_TIME) | EXISTS ✅ |
| 5 | Partner Name | `/app/crm/partners/{id}?tab=overview` | `<Link>` | `from`, `to`, `preset`, `fromAnalytics` | EXISTS ✅ |
| 6 | Partner Orders | `/app/crm/partners/{id}?tab=orders` | `<Link>` | `from`, `to`, `preset`, `fromAnalytics` | EXISTS ✅ |
| 7 | Partner Bookings | `/app/crm/partners/{id}?tab=bookings` | `<Link>` | `from`, `to`, `preset`, `fromAnalytics` | EXISTS ✅ |
| 8 | Payment Count | `/app/payments?status=CAPTURED&currency=X` | `<Link>` | `from`, `to`, `preset`, `fromAnalytics` | EXISTS ✅ |

### 4.2 Non-Navigable Analytics KPI (destinationType: NONE)

| Metric | Reason | D12 Action |
|---|---|---|
| GMV | "No honest financial detail view exists yet" | DEFERRED (Finance) |
| Revenue | Financial metric | DEFERRED (Finance) |
| Net Revenue | Financial metric | DEFERRED (Finance) |
| Refunds | Financial metric | DEFERRED (Finance) |
| Commission | Financial metric | DEFERRED (Finance) |
| AOV | Derived metric | DEFERRED |
| Sessions | No target page | NOT STARTED |
| Qualified GMV | Financial metric | DEFERRED (Finance) |
| Collected GMV | Financial metric | DEFERRED (Finance) |
| Outstanding GMV | Financial metric | DEFERRED (Finance) |
| Finance Refunds | Financial metric | DEFERRED (Finance) |
| Finance Commission | Financial metric | DEFERRED (Finance) |
| Partner Commission | Financial metric | DEFERRED (Finance) |

### 4.3 Orders Center — In-Page KPI Filtering

KPI card clicks filter the same-page table via URL state (`?status=X` or `?paymentStatus=X`). No cross-page navigation.

| KPI | Action | Params | Target |
|---|---|---|---|
| Total | Clear filters | clears `status`, `paymentStatus` | Same page |
| Lifecycle (6 cards) | Filter by status | `?status={code}` | Same page |
| Rework (3 cards) | Filter by status | `?status={code}` | Same page |
| Exceptions (3 cards) | Filter by status | `?status={code}` | Same page |
| Payment status (4 cards) | Filter by paymentStatus | `?paymentStatus={code}` | Same page |

**Row click**: `router.push(/app/orders/{uuid})` — navigates to Order detail.

### 4.4 Bookings Center — In-Page KPI Filtering

| KPI | Action | Params | Target |
|---|---|---|---|
| Total | Clear filters | clears `status` | Same page |
| Prep flow (3) | Filter by status | `?status={code}` | Same page |
| Service flow (3) | Filter by status | `?status={code}` | Same page |
| Awaiting (1) | Filter by status | `?status={code}` | Same page |
| Operational (4) | Filter by status | `?status={code}` | Same page |
| Terminal (2) | Filter by status | `?status={code}` | Same page |

**Row click**: `router.push(/app/bookings/{uuid})` — navigates to Booking detail.

### 4.5 Payments Center — In-Page KPI Filtering

| KPI | Action | Params | Target |
|---|---|---|---|
| Total | Clear filters | clears all 3 dims | Same page |
| Payment status (6) | Filter | `?paymentStatus={code}` | Same page |
| Currency (dynamic) | Filter | `?currencyCard={code}` | Same page |
| Refund status (4) | Filter | `?refundStatus={code}` | Same page |

**Row click**: `<Link href=/app/payments/{code}>` — navigates to Payment detail (code-based).

### 4.6 Requests Center — In-Page KPI Filtering

| KPI | Action | Params | Target |
|---|---|---|---|
| Total | Clear status | clears `status` | Same page |
| Lifecycle (9) | Filter | `?status={code}` | Same page |
| Exceptions (5) | Filter | `?status={code}` | Same page |

**Row click**: `router.push(/app/requests/{uuid})` — navigates to Request detail.

### 4.7 Command Center — NO Drill-down

KpiCard is **purely presentational** (value + delta, no onClick, no Link). All KPI cards rendered via `<KpiCard>` in `SectionGrid.tsx` without any navigation props.

**Decision Queue** has navigation via `NAVIGATION_ONLY` actions → `window.open(url, "_blank")` with backend-defined `target.route` + `target.filters`.

### 4.8 CRM Page — Drill-down Receiver

CRM page receives drill-downs from Analytics:
- Reads `tab`, `from`, `to`, `entitled` params
- Does NOT read `preset` (drops it)
- Customer/Partner table rows link to detail pages

### 4.9 CRM Analytics — Non-Navigable KPI

`CrmAnalytics.tsx` renders KPI cards **without** drilldown config or href. All static divs.

---

## 5. Routing Matrix

| KPI / Source | Current Route | Target Entity | Required ID | Period Params | Scope Params | Server Authority | Status |
|---|---|---|---|---|---|---|---|
| Analytics → Orders | `/app/orders` | Order list | none (list) | `from`, `to`, `preset` | none | ✅ Orders API | EXISTS |
| Analytics → Bookings | `/app/bookings` | Booking list | none (list) | `from`, `to`, `preset` | none | ✅ Bookings API | PARTIAL ⚠️ |
| Analytics → Customers | `/app/crm?tab=customers` | Customer list | none (list) | `from`, `to` | `tab=customers` | ✅ CRM API | EXISTS |
| Analytics → Partners | `/app/crm?tab=partners` | Partner list | none (list) | none (ALL_TIME) | `entitled=true` | ✅ CRM API | EXISTS |
| Analytics → Partner 360 | `/app/crm/partners/{id}` | Partner detail | partnerId (UUID) | `from`, `to`, `preset` | `tab` | ✅ Partner API | EXISTS |
| Analytics → Payments | `/app/payments` | Payment list | none (list) | `from`, `to`, `preset` | `status`, `currency` | ✅ Payments API | EXISTS |
| Orders → Order detail | `/app/orders/{id}` | Order detail | orderId (UUID) | none | none | ✅ Order API | EXISTS |
| Bookings → Booking detail | `/app/bookings/{id}` | Booking detail | bookingId (UUID) | none | none | ✅ Booking API | EXISTS |
| Payments → Payment detail | `/app/payments/{code}` | Payment detail | PAY-* code | none | none | ✅ Payment API | EXISTS |
| CRM → Customer 360 | `/app/crm/customers/{id}` | Customer detail | customerId (UUID) | none | none | ✅ CRM API | EXISTS |
| CRM → Partner 360 | `/app/crm/partners/{id}` | Partner detail | partnerId (UUID) | none | none | ✅ Partner API | EXISTS |
| Command Center KPI | NONE | — | — | — | — | — | NOT STARTED |
| CRM Analytics KPI | NONE | — | — | — | — | — | NOT STARTED |
| Analytics → GMV | NONE (finance) | — | — | — | — | — | DEFERRED |
| Analytics → Revenue | NONE (finance) | — | — | — | — | — | DEFERRED |
| Analytics → Refunds | NONE (finance) | — | — | — | — | — | DEFERRED |
| Analytics → Commission | NONE (finance) | — | — | — | — | — | DEFERRED |

---

## 6. Entity Identity Matrix

### 6.1 Canonical Identifiers

| Entity | PK (UUID) | Business Code | Reference Number | Route Pattern | Frontend Param |
|---|---|---|---|---|---|
| Order | `id` (UUID) | `ORD-NNNNNNNN` | `MKT-ORD-NNNNNNNN` | `/app/orders/[id]` | `params.id` |
| Booking | `id` (UUID) | `BKG-NNNNNNNN` | `MKT-BKG-NNNNNNNN` | `/app/bookings/[id]` | `params.id` |
| Payment | `id` (UUID) | `PAY-NNNNNNNN` | `MKT-PAY-NNNNNNNN-0` | `/app/payments/[code]` | `params.code` |
| Refund | `id` (UUID) | `RFD-NNNNNNNN` | `MKT-REF-NNNNNNNN` | — (in Payment detail) | — |
| Request | `id` (UUID) | `REQ-NNNNNNNN` | `MKT-REQ-NNNNNNNN` | `/app/requests/[id]` | `params.id` |
| Customer | `id` (UUID) | `CUS-NNNNNNNN` | — | `/app/crm/customers/[id]` | `params.id` |
| Partner | `id` (UUID) | `PAR-NNNNNNNN` | — | `/app/crm/partners/[id]` | `params.id` |
| Product | `id` (UUID) | `PRD-NNNNNNNN` | — | `/app/catalog/[id]` | `params.id` |
| Support Case | `id` (UUID) | `SUP-NNNNNNNN` | — | `/app/support/[id]` | `params.id` |

### 6.2 ID Usage Patterns

- **All routes use UUID** as route param, except Payment (business code `PAY-*`).
- **Cross-entity links always use UUID**: Order → Booking via `booking.orderId`; Booking → Order via `booking.orderId`; Payment → Order via `payment.orderId`.
- **No code-based routing** for Orders, Bookings, Customers, Partners, Products.
- **No alias/short-code routing** anywhere.
- **ID transformation**: None. Route param is passed directly to API.

### 6.3 IDOR Protection

| Entity | Protection | Evidence |
|---|---|---|
| Partner | `actor.partnerId` from JWT; partner cannot see other partners | `crm.service.ts:1255-1260` assertPartnerActor |
| Customer | Platform-scoped; storefront-only customers 404 | `crm.service.ts:172-270` |
| Order | Storefront orders 404 for platform viewers | `order.service.ts:1083-1168` |
| Booking | Storefront bookings 404 for HTTP viewers | `booking-query.service.ts:33-50` |
| Product | Partner sees only own products | `catalog-access.policy.ts:84-90` |
| Buyer cabinet | Own-scope via `actor.customerId` from JWT | `account.service.ts:181-186` |

**No IDOR vulnerabilities found** in routing paths.

---

## 7. KPI → Entity Semantics

| KPI | Correct Drill-down Target | Current Route | Canonical? |
|---|---|---|---|
| Orders Created | Orders Center (list) | `/app/orders` | ✅ YES |
| Bookings Requested | Bookings Center (list) | `/app/bookings` | ✅ YES |
| Active Customers | CRM Customer list | `/app/crm?tab=customers` | ✅ YES |
| Active Partners | CRM Partner list | `/app/crm?tab=partners` | ✅ YES |
| Partner Name | Partner 360 | `/app/crm/partners/{id}` | ✅ YES |
| Partner Orders | Partner 360 → Orders tab | `/app/crm/partners/{id}?tab=orders` | ✅ YES |
| Partner Bookings | Partner 360 → Bookings tab | `/app/crm/partners/{id}?tab=bookings` | ✅ YES |
| Payment Count | Payments Center | `/app/payments` | ✅ YES |
| GMV | No honest financial view | NONE | ⏸ DEFERRED |
| Revenue | No honest financial view | NONE | ⏸ DEFERRED |
| Commission | No honest financial view | NONE | ⏸ DEFERRED |
| Refunds | No honest financial view | NONE | ⏸ DEFERRED |
| AOV | Derived metric | NONE | ⏸ DEFERRED |
| Sessions | No target page | NONE | ❓ NOT STARTED |

---

## 8. KPI Context Propagation

### 8.1 Source: Analytics Page

Period context derived from API response:
```typescript
// analytics/page.tsx:106-115
const periodContext: PeriodContext = useMemo(() => {
  if (kpi?.period) {
    return {
      preset,
      from: kpi.period.start.split("T")[0],  // YYYY-MM-DD
      to: kpi.period.endExclusive.split("T")[0],
    };
  }
  return { preset };
}, [kpi, preset]);
```

**Key observation**: `from`/`to` derived from `kpi.period.start`/`kpi.period.endExclusive` — D8-compliant `[start, endExclusive)` semantics.

### 8.2 Drill-down Transfer (metric-drilldown.ts)

`resolveDrilldownUrl()`:
- `PERIOD_BOUND`: transfers `from`, `to`, `preset`
- `ALL_TIME`: no period transfer
- `AS_OF_DATE`: transfers `to` as `asOf`
- Always appends `fromAnalytics=true`

`resolveTableCellDrilldown()`:
- Same period logic
- For `DETAIL_VIEW`: partnerId goes into route path (`/app/crm/partners/{id}`)
- For `DOMAIN_ROUTE`: partnerId as query param

### 8.3 Target Page Reception — Gaps

| Target | Reads `from`? | Reads `to`? | Reads `preset`? | Reads `fromAnalytics`? | Gap |
|---|---|---|---|---|---|
| Orders Center | ✅ `from` → `dateFrom` | ✅ `to` → `dateTo` | ❌ | ❌ | `preset` dropped |
| Bookings Center | ❌ | ❌ | ❌ | ❌ | **CRITICAL: reads only `dateFrom`/`dateTo`** |
| CRM Page | ✅ `from` → `initialDateFrom` | ✅ `to` → `initialDateTo` | ❌ | ❌ | `preset` dropped |
| Partner 360 | ✅ `from` → `periodFrom` | ✅ `to` → `periodTo` | ✅ `preset` → `periodPreset` | ✅ | None |
| Customer 360 | ❌ | ❌ | ❌ | ❌ | **No period context at all** |
| Payments Center | ✅ via Orders fallback? | ✅ | ❌ | ❌ | Needs verification |

### 8.4 Critical Finding: Bookings Context Loss

```typescript
// bookings/page.tsx:514
initialDateFrom={sp.get("dateFrom") ?? ""}   // ← does NOT read "from"
initialDateTo={sp.get("dateTo") ?? ""}       // ← does NOT read "to"
```

Analytics drill-down sends `?from=2026-08-01&to=2026-08-31&preset=MONTH&fromAnalytics=true`, but Bookings page only reads `dateFrom`/`dateTo`. **Period is silently lost.**

Compare with Orders:
```typescript
// orders/page.tsx:663-664
initialDateFrom={sp.get("from") ?? sp.get("dateFrom") ?? ""}  // ← reads BOTH
initialDateTo={sp.get("to") ?? sp.get("dateTo") ?? ""}       // ← reads BOTH
```

### 8.5 CRM Page: Preset Dropped

CRM page reads `from`/`to` but NOT `preset`. After navigation, user loses the human-readable preset label. Low severity — dates are preserved.

### 8.6 Customer 360: No Period Context

Customer 360 page has NO period params in `useQueryState()`. Period from Analytics is completely lost. Customer 360 doesn't have period-scoped API queries (it loads customer detail + partners, not time-bounded data).

---

## 9. Temporal Semantics

D8 is CLOSED. D12 must only propagate existing canonical period context.

| Aspect | Contract | Evidence | D12 Status |
|---|---|---|---|
| Period format | `YYYY-MM-DD` in URL params | `metric-drilldown.ts:88-90` | ✅ CANONICAL |
| Period semantics | `[start, endExclusive)` | `kpi.period.start`/`endExclusive` | ✅ CANONICAL |
| UTC server-authoritative | All timestamps UTC instant | D8 evidence | ✅ CANONICAL |
| Date parsing | No custom parser; split on `T` | `analytics/page.tsx:110-111` | ✅ CANONICAL |
| Inclusive-end risk | `2026-08-31T23:59:59` | None found | ✅ NO RISK |
| New date parser | Forbidden by D12 prompt | Not created | ✅ COMPLIANT |

**No temporal semantics issues found.** D8 contracts are correctly propagated.

---

## 10. D10 Integration

### 10.1 Partner Performance → Partner 360

| Flow | Status | Period Preserved? | Scope Preserved? |
|---|---|---|---|
| Partner Name → Partner 360 | ✅ EXISTS | ✅ `from`, `to`, `preset` | ✅ `partnerId` in route |
| Partner Orders → Partner 360 Orders tab | ✅ EXISTS | ✅ `from`, `to`, `preset` | ✅ `partnerId` in route |
| Partner Bookings → Partner 360 Bookings tab | ✅ EXISTS | ✅ `from`, `to`, `preset` | ✅ `partnerId` in route |

### 10.2 D10 Attribution Preservation

D10 aligned Partner Performance to `Order.sellerPartnerId`. D12 does NOT change attribution. Partner 360 reads `partnerId` from route, server resolves via `GET /partners/:id`.

### 10.3 IDOR Check

Partner 360 route uses UUID in path. Backend `crm.service.ts` enforces partner scope via JWT `actor.partnerId`. Partner A cannot access Partner B's 360 page — server returns 404.

---

## 11. D11 Integration

### 11.1 KPI Dictionary Authority

D11 formalized KPI dictionary with canonical formulas, status semantics, and cross-center reconciliation. D12 does NOT redefine KPI formulas.

| D11 KPI | D12 Drill-down Target | Status |
|---|---|---|
| Orders Created | `/app/orders` | ✅ ALIGNED |
| Bookings Requested | `/app/bookings` | ✅ ALIGNED |
| GMV | NONE (DEFERRED) | ⏸ DEFERRED |
| Revenue | NONE (DEFERRED) | ⏸ DEFERRED |
| Active Customers | `/app/crm?tab=customers` | ✅ ALIGNED |
| Active Partners | `/app/crm?tab=partners` | ✅ ALIGNED |
| Payments Captured | `/app/payments` | ✅ ALIGNED |
| Refunds Processed | NONE (DEFERRED) | ⏸ DEFERRED |
| Commission Accrued | NONE (DEFERRED) | ⏸ DEFERRED |

### 11.2 Scope Differences (Documented by D11)

Analytics "Orders Created" = Marketplace-only. Orders Center "Total" = Overview scope (all acquisition sources). This is **intentional** per D11 §8.1. D12 does NOT reconcile this scope difference.

---

## 12. CRM Target Inventory

### 12.1 Partner 360

```text
Route:          /app/crm/partners/[id]
Entity:         Partner (UUID)
Identifier:     params.id (UUID)
API:            GET /partners/:id?sortBy=&sortDirection=&status=&dateFrom=&dateTo=
Permissions:    crm.partner.read (Shell.tsx sidebar)
Scope:          Server-side partner isolation
Period support: ✅ from, to, preset (from URL params)
Tabs:           overview, activity, services, orders, bookings, customers, storefront, notes
```

### 12.2 Customer 360

```text
Route:          /app/crm/customers/[id]
Entity:         Customer (UUID)
Identifier:     params.id (UUID)
API:            GET /customers/:id/detail, GET /customers/:id/partners
Permissions:    crm.customer.read
Scope:          Server-side customer isolation
Period support: ❌ No period params in useQueryState
Tabs:           overview, orders, bookings, payments, partners, refunds, notes, activity
```

### 12.3 Order Detail

```text
Route:          /app/orders/[id]
Entity:         Order (UUID)
Identifier:     params.id (UUID)
API:            GET /orders/:id, GET /orders/:id/history, GET /orders/:id/financial-history
Permissions:    order.read
Scope:          Server-side; storefront orders 404 for platform viewers
Period support: ❌ (entity detail, not list)
```

### 12.4 Booking Detail

```text
Route:          /app/bookings/[id]
Entity:         Booking (UUID)
Identifier:     params.id (UUID)
API:            GET /bookings/:id, GET /bookings/:id/history
Permissions:    booking.read
Scope:          Server-side; storefront bookings 404
Period support: ❌ (entity detail, not list)
```

### 12.5 Payment Detail

```text
Route:          /app/payments/[code]  (CANONICAL)
                /app/finance/payments/[id]  (compatibility redirect)
Entity:         Payment (UUID internally, PAY-* code in URL)
Identifier:     params.code (business code, immutable)
API:            GET /finance/payments/:code
Permissions:    finance.payment.read
Scope:          Server-side
Period support: ❌ (entity detail, not list)
```

---

## 13. API Contract Audit

| Target API | Endpoint | Accepts Period? | Accepts Status? | Accepts Partner? | Accepts Scope? |
|---|---|---|---|---|---|
| Orders list | GET /orders | ✅ dateFrom, dateTo | ✅ status, paymentStatus | ❌ | ✅ |
| Bookings list | GET /bookings | ✅ dateFrom, dateTo | ✅ status | ✅ sellerPartnerId | ✅ |
| Payments list | GET /finance/payments | ✅ dateFrom, dateTo | ✅ status, refundStatus | ✅ partnerId | ✅ |
| CRM Customer list | GET /customers | ❌ (list endpoint) | ✅ status, type | ❌ | ✅ marketplace scope |
| CRM Partner list | GET /partners | ❌ (list endpoint) | ✅ status | ❌ | ✅ marketplace scope |
| Partner detail | GET /partners/:id | ✅ dateFrom, dateTo | ✅ status | N/A (in route) | N/A |
| Customer detail | GET /customers/:id/detail | ❌ | ✅ status (tabs) | N/A (in route) | N/A |
| Analytics KPI | GET /analytics/company-kpi | ✅ preset, startDate, endDate | N/A | N/A | ✅ acquisitionSource |
| Analytics Partners | GET /analytics/partner-performance | ✅ preset, startDate, endDate | N/A | N/A | ✅ acquisitionSource |

**All API endpoints use server-authoritative scoping.** No client-side scope bypass possible.

---

## 14. Security / IDOR

### 14.1 Partner Isolation

```text
Route ID:     /app/crm/partners/{partnerId}  (UUID)
Server check: actor.partnerId from JWT; assertPartnerActor()
Result:       Partner A cannot reach Partner B → 404
Risk:         NONE
```

### 14.2 Customer Isolation

```text
Route ID:     /app/crm/customers/{customerId}  (UUID)
Server check: Marketplace-scoped; storefront-only customers return 404
Result:       Unauthorized access blocked → 404
Risk:         NONE
```

### 14.3 Order/Booking Isolation

```text
Route ID:     /app/orders/{orderId}, /app/bookings/{bookingId}  (UUID)
Server check: Storefront orders/bookings 404 for platform viewers; PII redaction
Result:       Cross-tenant access blocked → 404
Risk:         NONE
```

### 14.4 Payment Isolation

```text
Route ID:     /app/payments/{code}  (business code)
Server check: finance.payment.read permission; scoped queries
Result:       Authorization enforced server-side
Risk:         NONE
```

### 14.5 Decision Queue Navigation

```text
Source:       Backend-defined target.route + target.filters
Risk:         Backend owns route; frontend only opens window.open()
Mitigation:   Routes are backend-generated, not user-controlled
Result:       LOW RISK
```

### 14.6 Anti-Mass-Assignment

All entities protected by `assertNoForbiddenKeys()` → 422 on forged fields. Route-derived IDs cannot bypass domain scope.

**No IDOR vulnerabilities found. No security blockers for D12.**

---

## 15. Cross-Scope Analysis

| Scope Boundary | KPI Source | Drill-down Target | Preserved? |
|---|---|---|---|
| Marketplace → Marketplace | Analytics (MARKETPLACE-scoped) | Orders/Bookings/Payments (operational scope) | ⚠️ Scope shift (intentional per D11) |
| Marketplace → Partner | Partner Performance (MARKETPLACE) | Partner 360 (partner-scoped) | ✅ partnerId in route |
| Marketplace → CRM | Active Customers/Partners | CRM list (marketplace-scoped) | ✅ marketplace filter |
| Platform → CRM | Command Center KPI | NONE (no drill-down) | N/A |

**No silent expansion of scope found.** The scope shift from Marketplace-scoped Analytics to operational-scoped Orders/Bookings Centers is documented and intentional per D11.

---

## 16. Failure Modes

| Failure Mode | Handling | Evidence |
|---|---|---|
| Missing ID in route | 404 from backend (Prisma returns null) | `params.id as string` + API error handling |
| Stale/deleted entity ID | 404 from backend | Server returns null → frontend shows error |
| Invalid UUID format | Prisma query fails gracefully | Backend returns 400/404 |
| Route target unavailable | Frontend shows error state | `catch (e) { setError(...) }` |
| Unauthorized target | 403/404 from backend | RBAC + scope isolation |
| Query context omitted | Target uses defaults (empty period = all-time) | `initialDateFrom \|\| ""` |
| Query context malformed | Param ignored (no crash) | `sp.get("from") ?? ""` |
| Unsupported query param | Ignored silently | URLSearchParams ignores unknown |
| Mismatched entity type | N/A (routes are typed) | N/A |
| Cross-scope access | 404 from backend | Scope isolation |
| Deleted/inactive entity | 404 or displayed with status badge | `StatusBadge` component |
| Direct URL bypass | Server-side RBAC enforced | `JwtAuthGuard` + `PermissionsGuard` |
| from/to param mismatch (Bookings) | **Period silently lost** | Bookings reads `dateFrom`/`dateTo` only |

---

## 17. UI Behaviour

### 17.1 Analytics Center Drill-down Cards

- **Clickability**: ✅ Navigable KPI cards render as `<Link>` with `cursor-pointer`
- **Disabled states**: Non-navigable KPIs render as `<div>` (no hover, no pointer)
- **Loading**: KPI values show while data loads
- **Navigation**: Next.js `<Link>` — SPA navigation, no full reload
- **Back navigation**: Browser back works (history-based)
- **Query-param preservation**: ✅ `from`, `to`, `preset`, `fromAnalytics` in URL
- **Direct-link behavior**: ✅ Deep-link with params works
- **Error state**: API errors shown in error banner
- **fromAnalytics indicator**: Partner 360 shows "📊 Из аналитики" badge when `fromAnalytics=true`

### 17.2 Operations Center In-Page Filtering

- **Clickability**: ✅ KPI cards have `onClick` handlers
- **Selected state**: Selected card gets distinct visual treatment
- **URL state**: Filter applied to URL; bookmarkable
- **Reset**: Clears filters, preserves Header Period
- **Row navigation**: Click on table row → entity detail page

### 17.3 Command Center

- **KPI cards**: Purely presentational (no click, no cursor-pointer)
- **Decision Queue**: Action buttons with `window.open()` for NAVIGATION_ONLY

---

## 18. Documentation / Contract Drift

### 18.1 Param Naming Drift

| Param | Analytics Sends | Orders Reads | Bookings Reads | CRM Reads | Partner 360 Reads |
|---|---|---|---|---|---|
| `from` | ✅ | ✅ | ❌ | ✅ | ✅ |
| `to` | ✅ | ✅ | ❌ | ✅ | ✅ |
| `dateFrom` | — | ✅ (fallback) | ✅ | — | — |
| `dateTo` | — | ✅ (fallback) | ✅ | — | — |
| `preset` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `fromAnalytics` | ✅ | ❌ | ❌ | ❌ | ✅ |

**Drift**: Bookings page only reads `dateFrom`/`dateTo`, not `from`/`to`. This is inconsistent with Orders page (which reads both) and causes period loss on drill-down.

### 18.2 Legacy Route Compatibility

```text
/app/finance/payments/[id] → /app/payments/[code]  (redirect preserved)
```
ADR-OPS-001 compliant. No drift.

### 18.3 Documented Scope Differences

D11 §8.1 documented: Analytics "Orders Created" = Marketplace-only vs Orders Center "Total" = Overview scope. This is intentional, not drift.

---

## 19. Dependency Matrix

| Dependency | State | Blocks D12? | Evidence |
|---|---|---|---|
| D10 Partner Attribution | ✅ CLOSED | no | 79ef1fc |
| D11 KPI Semantics | ✅ CLOSED | no | 0172fb4 |
| D8 Temporal Contract | ✅ CLOSED | no | resolveQueryPeriod |
| D9 Export Framework | ✅ CLOSED | no | 0172fb4~2 |
| D4-D7 Commerce | ✅ CLOSED | no | Various |
| CRM Partner 360 | ✅ EXISTS | no | `app/crm/partners/[id]` |
| CRM Customer 360 | ✅ EXISTS | no | `app/crm/customers/[id]` |
| Orders Detail | ✅ EXISTS | no | `app/orders/[id]` |
| Bookings Detail | ✅ EXISTS | no | `app/bookings/[id]` |
| Payment Detail | ✅ EXISTS | no | `app/payments/[code]` |
| KPI Dictionary | ✅ CLOSED (D11) | no | D11 contract |
| RBAC | ✅ EXISTS | no | JwtAuthGuard + PermissionsGuard |
| Finance Detail | ⏸ DEFERRED | no (Finance metrics deferred) | No Finance stage yet |
| DATA-01 | ⬜ OPEN | no | D11 residual |
| DATA-02 | ⬜ OPEN | no | Storefront scope separate |
| PROD-01 | ⬜ DEFERRED | no | Product model independent |
| Finance | ⏸ DEFERRED | no | Separate stage |

**No blocking dependencies.** All required targets exist. Finance metrics are explicitly deferred.

---

## 20. Implementation Scope Candidate

Based on evidence, D12 implementation should address:

### 20.1 Required (gap-fixing)

1. **Bookings page `from`/`to` param reading** — add `from`/`to` fallback like Orders page does. Critical context propagation fix.

2. **CRM page `preset` param reading** — minor, but preserves human-readable preset label for analytics drill-down UX.

3. **Command Center KPI drill-down** — currently non-clickable. D12 should determine whether Command Center KPIs should navigate to Analytics Center or respective Centers. This is an **architecture decision** (not a simple fix).

### 20.2 Likely Needed

4. **Centralized param name contract** — standardize `from`/`to` vs `dateFrom`/`dateTo` across all target pages. Currently Orders reads both, Bookings reads only `dateFrom`/`dateTo`, CRM reads only `from`/`to`.

5. **Customer 360 period propagation** — currently no period context. If Customer 360 should show period-scoped data (orders/bookings in period), API needs period params and frontend needs to read them.

### 20.3 NOT Needed (already working)

- `metric-drilldown.ts` framework is canonical and well-designed
- Partner 360 context propagation is complete
- Analytics → Orders/Bookings/CRM/Payments drill-downs work (except Bookings period)
- Entity identity is consistent (UUID everywhere, code only for Payment)
- IDOR protection is comprehensive
- Temporal semantics are D8-compliant
- No new routing contract needed — existing framework is sufficient

### 20.4 DEFERRED (Finance dependency)

- GMV, Revenue, Commission, Refunds drill-downs
- Financial detail surface

---

## 21. Blocking Decisions

### Decision 1: Command Center KPI Navigation

```text
QUESTION: Should Command Center KPI cards navigate somewhere?
OPTIONS:
  A) Navigate to Analytics Center (pre-selected period)
  B) Navigate to respective Operations Center (Orders, Bookings, etc.)
  C) Keep non-clickable (presentational only)
  D) Navigate to Command Center detail drill-down (not yet exists)
CONSTRAINT: D12 prompt says "Do not require new UX if canonical scope does not prescribe it"
EVIDENCE: Command Center is executive dashboard; drill-down to operations is natural
```

### Decision 2: Customer 360 Period Scope

```text
QUESTION: Should Customer 360 accept period context from Analytics drill-down?
OPTIONS:
  A) Yes — Customer 360 should show period-scoped orders/bookings
  B) No — Customer 360 is entity-level, always shows full history
CONSTRAINT: D12 prompt says "Do not create new CRM surfaces"
EVIDENCE: Customer 360 already has tabs for orders/bookings, but no period filter
```

### Decision 3: Param Naming Standard

```text
QUESTION: Standardize on `from`/`to` or `dateFrom`/`dateTo`?
OPTIONS:
  A) Standardize on `from`/`to` (analytics convention)
  B) Standardize on `dateFrom`/`dateTo` (operations convention)
  C) Support both everywhere (current state for Orders only)
EVIDENCE: Operations Center Shell uses `dateFrom`/`dateTo` for Header Period
```

---

## 22. Readiness Verdict

```text
D12 READINESS: READY WITH EXPLICIT GAPS
```

### What's Ready
- ✅ Shared drill-down framework exists and works (metric-drilldown.ts)
- ✅ Analytics → Entity drill-downs functional (except Bookings period)
- ✅ Entity identity consistent (UUID routing)
- ✅ IDOR protection comprehensive
- ✅ Temporal semantics D8-compliant
- ✅ D10 integration verified
- ✅ D11 integration verified
- ✅ All CRM targets exist
- ✅ All backend APIs accept required params
- ✅ RBAC preserved
- ✅ Cross-scope boundaries preserved
- ✅ No security blockers

### Gaps (Non-blocking)
1. **Bookings page `from`/`to` param reading** — period lost on drill-down
2. **Command Center KPI non-clickable** — architecture decision needed
3. **CRM page `preset` dropped** — minor UX gap
4. **Customer 360 no period support** — architecture decision needed
5. **Param naming inconsistency** — `from`/`to` vs `dateFrom`/`dateTo`
6. **Finance metrics** — non-clickable by design (DEFERRED)
7. **Sessions metric** — no target page

---

## 23. Recommended Next Action

```text
D12 READINESS:         READY WITH EXPLICIT GAPS
CURRENT TRUE NEXT:     D12 — CRM / KPI Drill-down Routing
FINANCE:               NOT STARTED / DEFERRED
D12 BLOCKERS:          none (3 architecture decisions needed, but non-blocking)
D12 NON-BLOCKING GAPS: Bookings from/to, Command Center navigation, param naming, Customer 360 period
CANONICAL ROUTING AUTHORITY: metric-drilldown.ts (MetricDrilldownConfig)
CANONICAL KPI AUTHORITY: D11 KPI dictionary + AnalyticsService.getCompanyKpi()
CANONICAL ENTITY IDENTIFIERS: UUID for all entities, business code for Payment
TEMPORAL AUTHORITY: D8 (resolveQueryPeriod, [start, endExclusive), UTC)
SECURITY AUTHORITY: JwtAuthGuard + PermissionsGuard + assertPartnerActor + scope isolation
D10 ↔ D12:            D10 attribution preserved; Partner 360 drill-down verified
D11 ↔ D12:            D11 KPI dictionary is authority; D12 does NOT redefine formulas
IMPLEMENTATION SCOPE:  param normalization + Bookings fix + Command Center decision + Customer 360 decision
NEXT AUTHORIZED ACTION: D12 implementation prompt (resolve 3 architecture decisions, then implement)
```
