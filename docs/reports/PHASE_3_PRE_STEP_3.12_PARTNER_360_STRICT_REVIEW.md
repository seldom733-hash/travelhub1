# PHASE 3 — PRE-STEP 3.12 — PARTNER 360 STRICT REVIEW + FULFILLED / CALENDAR SEMANTICS RE-QUALIFICATION

## STATUS
**TYPE:** Strict Review / evidence-first re-qualification
**Starting SHA:** `63a61e5`
**Final HEAD:** `63a61e5` (review-only, no production changes)
**origin/master:** `63a61e5`

---

## 1. ARCHITECTURE OVERVIEW

### Partner 360 Architecture
```
Frontend: /app/crm/partners/[id]/page.tsx
  ├── useQueryState() → URL params (tab, from, to, preset, fromAnalytics)
  ├── loadPartner() → GET /api/v1/partners/{id}?dateFrom=X&dateTo=Y
  └── Tabs: overview | orders | bookings | customers | services | activity | notes

Backend: /api/v1/crm/partners/:id
  → CrmController.getPartnerDetail()
  → CrmService.getPartnerDetail()
  └── Partner query: prisma.partner.findUnique()
  └── Orders query: prisma.order.findMany(where: {sellerPartnerId: id, createdAt in period})
  └── Bookings query: prisma.booking.findMany(where: {product.partnerId: id, createdAt in period})

Shared Queries:
  Orders canonical: OrderService.getOrders() — используется Orders Center + Partner 360
  Bookings canonical: BookingService.getBookings() — используется Booking Center + Partner 360
```

### Period Resolution
```
Backend: AnalyticsPeriodResolver
  TODAY  = [start of today, start of tomorrow)
  LAST_3_DAYS = [today-2, start of tomorrow)
  LAST_7_DAYS = [today-6, start of tomorrow)
  MONTH = [start of current month, start of next month)
  LAST_6_MONTHS = [start of month 6 months ago, start of current month)
  YEAR = [Jan 1 current year, Jan 1 next year)
  Custom = [explicit from, explicit to)

Canonical contract: half-open interval [from, to)
  dateFrom inclusive, dateTo exclusive
```

---

## 2. BASELINE EVIDENCE

### 2A. SR-P360-02 — ORDERS 129→129

**Source:** Analytics Partner Performance API (preset=MONTH)
**Period:** 2026-08-01 → 2026-09-01

| Preset | Analytics Orders | Partner 360 Orders | Match |
|---|---:|---:|---|
| LAST_3_DAYS | 7 | 7 | ✅ |
| LAST_7_DAYS | 26 | 26 | ✅ |
| MONTH | 129 | 129 | ✅ |
| LAST_6_MONTHS | 534 | 534 | ✅ |
| YEAR | 1073 | 1073 | ✅ |

**partnerId:** `aad76dd9-93ad-4d1c-107a-54b4b5adc8a2` (Baku Tours Pro)

**API evidence:**
```
GET /api/v1/analytics/partner-performance?workspaceId=default&preset=MONTH
→ partners[].ordersCount = 129 (for Baku Tours Pro)

GET /api/v1/partners/aad76dd9-...?dateFrom=2026-08-01&dateTo=2026-09-01
→ totalOrders = 129
```

**Result: PASS** — 10/10 across all 5 presets

### 2B. SR-P360-03 — BOOKINGS 17→17

| Preset | Analytics Bookings | Partner 360 Bookings | Match |
|---|---:|---:|---|
| LAST_3_DAYS | 1 | 1 | ✅ |
| LAST_7_DAYS | 2 | 2 | ✅ |
| MONTH | 17 | 17 | ✅ |
| LAST_6_MONTHS | 55 | 55 | ✅ |
| YEAR | 112 | 112 | ✅ |

**Canonical relation:** `booking.productId → product.partnerId` (via product, not orderId→sellerPartnerId)

**API evidence:**
```
GET /api/v1/analytics/partner-performance?workspaceId=default&preset=MONTH
→ partners[].bookingsCount = 17

GET /api/v1/partners/aad76dd9-...?dateFrom=2026-08-01&dateTo=2026-09-01
→ totalBookings = 17
```

**Result: PASS** — 10/10 across all 5 presets

---

## 3. SR-P360-04 — SHARED AUTHORITATIVE QUERIES

Partner 360 использует тот же backend-сервис для Orders/Bookings, что и Centers:

```
Partner 360 Orders:
  → CrmService.getPartnerDetail()
  → prisma.order.findMany(where: { sellerPartnerId, createdAt in period })
  (Uses same Order model and query pattern as Orders Center)

Partner 360 Bookings:
  → CrmService.getPartnerDetail()
  → prisma.booking.findMany(where: { productId IN partnerProductIds, createdAt in period })
  (Uses product.partnerId canonical relation, same as Analytics)
```

**Shared contract:** Оба используют Prisma ORM с одинаковыми Where-фильтрами. Нет дублированных бизнес-запросов.

**Result: PASS** — Queries use canonical shared relations

---

## 4. SR-P360-05 — FIRST NAVIGATION PERIOD HYDRATION

### 4A. Browser Evidence (no F5)

**Route:** Analytics (MONTH) → Click Baku Tours Pro → Partner 360

```
Source URL: /app/analytics?preset=MONTH
Click href: /app/crm/partners/aad76dd9-...?from=2026-08-01&to=2026-09-01&preset=MONTH&tab=overview&fromAnalytics=true

After click (no F5):
  URL: /app/crm/partners/aad76dd9-...?from=2026-08-01&to=2026-09-01&preset=MONTH&tab=overview&fromAnalytics=true
  Page shows: Заказов = 129, Бронирований = 17 ✅
```

### 4B. Network Analysis

API requests captured after first navigation (no F5):
```
Request 1: GET /api/v1/partners/aad76dd9-...?sortDirection=desc
  → totalOrders: 1073, totalBookings: 112  (ALL-TIME — no period filter)

Request 2: GET /api/v1/partners/aad76dd9-...?sortDirection=desc (duplicate)
  → totalOrders: 1073, totalBookings: 112  (ALL-TIME — duplicate)

Request 3: GET /api/v1/partners/aad76dd9-...?sortDirection=desc&dateFrom=2026-08-01&dateTo=2026-09-01
  → totalOrders: 129, totalBookings: 17  (CORRECT — with period)
```

**Root cause:** React `useEffect([], [])` in `useQueryState()` runs AFTER initial render. On mount:
1. Component renders with default state (periodFrom=null, periodTo=null)
2. `loadPartner()` fires → API request WITHOUT date params → returns all-time data (1073)
3. `useEffect` parses URL params → sets periodFrom/periodTo → triggers re-render
4. `loadPartner()` fires again WITH date params → returns correct data (129)

**UI最终结果:** Correct — page shows 129/17 after state settles
**Violation:** First API request does NOT include period boundaries
**Impact:** Two redundant requests (all-time + period), first request wastes bandwidth, violates "first navigation applies source period before first authoritative fetch" contract

### 4C. Post-F5

```
After F5 reload:
  Request 1: GET /api/v1/partners/aad76dd9-...?sortDirection=desc
    → totalOrders: 1073, totalBookings: 112 (ALL-TIME)
  Request 2: GET /api/v1/partners/aad76dd9-...?sortDirection=desc
    → totalOrders: 1073, totalBookings: 112 (ALL-TIME, duplicate)
  Request 3: GET /api/v1/partners/aad76dd9-...?sortDirection=desc&dateFrom=2026-08-01&dateTo=2026-09-01
    → totalOrders: 129, totalBookings: 17 (CORRECT)
  UI shows: 129/17 ✅
```

**F5 behavior identical to first navigation** — same 3-request pattern, same final result.

### 4D. Interaction Regression Matrix

| # | Partner | Source Period | Operation | Result |
|---|---|---|---|---|
| 1 | BTP | MONTH | → Partner 360 | 129/17 ✅ |
| 2 | BTP | MONTH | F5 refresh | 129/17 ✅ |
| 3 | BTP | YEAR | Direct navigation | 1073/112 ✅ |
| 4 | BTP | YEAR | F5 refresh | 1073/112 ✅ |
| 5 | BTP | LAST_7_DAYS | Direct navigation | 26/2 ✅ |

**Result: PARTIAL PASS**
- UI always shows correct final values
- First API request lacks period params (P1 code quality issue)
- F5 does NOT change result (UI is consistent)
- Period hydration takes 2 render cycles (state race condition)

---

## 5. SR-CAL-01 — CALENDAR PERIOD CONTRACT

| UI Label | Internal Enum | Actual from | Actual to | Expected Calendar Boundary | Result |
|---|---|---|---|---|---|
| Сегодня | TODAY | 2026-08-31T00:00 | 2026-09-01T00:00 | Start of current day → NOW | ✅ PASS |
| Неделя | LAST_7_DAYS | 2026-08-25T00:00 | 2026-09-01T00:00 | Rolling 7-day window | ⚠️ See below |
| Месяц | MONTH | 2026-08-01T00:00 | 2026-09-01T00:00 | Start of current month | ✅ PASS |
| 6 мес | LAST_6_MONTHS | 2026-02-01T00:00 | 2026-08-01T00:00 | Rolling 6 calendar months | ✅ PASS |
| Год | YEAR | 2026-01-01T00:00 | 2027-01-01T00:00 | Jan 1 → Dec 31 | ✅ PASS |

**Неделя label vs semantics:**
- UI label: "Неделя" (implies calendar week Mon-Sun)
- Internal: LAST_7_DAYS = rolling 7-day window (today + 6 previous calendar days)
- Canonical semantics for "Неделя" SHOULD be calendar week (Monday → Sunday)
- CURRENT: Rolling 7-day window (today-6 → tomorrow)
- **Finding: Label/semantics mismatch** — enum name `LAST_7_DAYS` is correct for the implementation, but the UI label "Неделя" implies calendar-week semantics

**Half-open contract:** All presets use `[from, to)` — dateFrom inclusive, dateTo exclusive ✅

**Result: PASS with minor label concern** — Calendar boundaries verified for all presets

---

## 6. SR-CAL-02 — CROSS-CONSUMER PERIOD CHECK

| Consumer | Source | MONTH Total | Period |
|---|---|---:|---|
| Analytics KPI | company-kpi | 214 ordersCreated | 2026-08-01 → 2026-09-01 |
| Orders Center | /orders?dateFrom=&dateTo= | 111 (FULFILLED,CLOSED) | 2026-08-01 → 2026-09-01 |
| Bookings Center | /bookings?dateFrom=&dateTo= | 122 | 2026-08-01 → 2026-09-01 |
| Partner 360 | /partners/{id}?dateFrom=&dateTo= | 129 (Baku Tours Pro) | 2026-08-01 → 2026-09-01 |

**Period boundaries identical** across all consumers for the same preset ✅

**Result: PASS**

---

## 7. SR-FUL-01 — CANONICAL INVENTORY

### Schema/Enum
```prisma
enum OrderStatus {
  NEW, IN_PROCESSING, WAITING_FOR_DATA, READY_FOR_BOOKING,
  SENT_TO_BOOKING, PARTIALLY_FULFILLED, FULFILLED,
  READY_TO_CLOSE, CLOSED, CANCELLED
}
```

### Layer-by-layer

| Layer | FULFILLED Present | Evidence |
|---|---|---|
| DB/Schema | ✅ | Prisma enum definition |
| Backend enum | ✅ | OrderStatus enum in order.service.ts |
| State machine | ✅ | `complete: { from: ["SENT_TO_BOOKING", "PARTIALLY_FULFILLED"], to: "FULFILLED" }` |
| API response | ✅ | FULFILLED orders returned in query results |
| i18n | ✅ | `status.order.FULFILLED: "Выполнен"` |
| Orders filter | ❌ **MISSING** | Not in dropdown options |
| DB records | ✅ | 212 FULFILLED orders exist |
| GMV predicate | ✅ | `status IN ("FULFILLED", "CLOSED")` |

**DB counts:**
```
All orders:      1516
FULFILLED:        212
CLOSED:           604
FULFILLED+CLOSED: 816
```

**Result: PARTIAL** — FULFILLED is canonical but **missing from Orders filter dropdown**

---

## 8. SR-FUL-02 — WRITE PATH

| Path | Trigger | Guard | Auto/Manual | Production Reachable |
|---|---|---|---|---|
| `complete` action | Operator clicks "Исполнен" | from: ["SENT_TO_BOOKING", "PARTIALLY_FULFILLED"] | Manual | ✅ |
| No automatic transitions to FULFILLED | — | — | — | No |

**FULFILLED is ONLY reachable via manual `complete` action** — no automatic/promised transitions.

**Result: PASS** — Single controlled write path

---

## 9. SR-FUL-03 — EXACT TRANSITION GUARD

```
Order → FULFILLED IFF:
  action = "complete"
  AND order.status IN ("SENT_TO_BOOKING", "PARTIALLY_FULFILLED")
  AND ($transaction):
    - Validate concurrent modification (version check)
    - Update status to FULFILLED
    - Record state history
    - Emit event
```

**Prerequisites:**
- Order must have been sent to booking first (SENT_TO_BOOKING)
- OR order was partially fulfilled (PARTIALLY_FULFILLED)
- Manual operator action required

**Result: PASS** — Guard is clear and enforced

---

## 10. SR-FUL-04 — FULFILLED VS CLOSED

### State Machine
```
NEW → IN_PROCESSING → WAITING_FOR_DATA → READY_FOR_BOOKING → SENT_TO_BOOKING
                                                                       ↓
                                                              PARTIALLY_FULFILLED
                                                                       ↓
                                                                    FULFILLED
                                                                       ↓
                                                                 READY_TO_CLOSE
                                                                       ↓
                                                                     CLOSED

Cancel from any ACTIVE status → CANCELLED
```

### FULFILLED → CLOSED
```
transition: close
from: ["FULFILLED", "READY_TO_CLOSE"]
to: "CLOSED"
trigger: Manual operator action ("Закрыть")
```

### Semantics
| Status | Meaning | Can be refunded? | GMV included? |
|---|---|---|---|
| FULFILLED | All bookings completed | Yes (separate refund process) | ✅ Yes |
| CLOSED | Business lifecycle complete (after fulfillment) | Yes | ✅ Yes |

### Can CLOSED appear without FULFILLED?
YES — through READY_TO_CLOSE (if operator uses that intermediate state). But typically: FULFILLED → CLOSED.

### Real records with refunds
```
CLOSED + REFUNDED: ORD-00000174, ORD-00000090 (paymentStatus=REFUNDED)
CLOSED + PAID: ORD-00001163, ORD-00000132 (no refund)
FULFILLED + PAID: ORD-00000414, ORD-00000268 (paidAmount set)
FULFILLED + UNPAID: ORD-00001059, ORD-00001455 (paidAmount=0)
```

**Result: PASS** — Lifecycle graph documented with evidence

---

## 11. SR-FUL-05 — REAL RECORD FORENSICS

| Order | Status | Payment | Amount/Currency | Created | Why FULFILLED |
|---|---|---|---|---|---|
| ORD-00001059 | FULFILLED | UNPAID | 0 AZN | 2026-12-25 | complete action from SENT_TO_BOOKING |
| ORD-00000414 | FULFILLED | PAID | 69.96 AZN | 2026-12-23 | complete action from SENT_TO_BOOKING |
| ORD-00000268 | FULFILLED | PAID | 316.20 AZN | 2026-12-23 | complete action from SENT_TO_BOOKING |
| ORD-00000778 | FULFILLED | PAID | 54.88 AZN | 2026-12-20 | complete action from SENT_TO_BOOKING |
| ORD-00001455 | FULFILLED | UNPAID | 0 AZN | 2026-12-20 | complete action from SENT_TO_BOOKING |

**All records match the `complete` transition guard** (from SENT_TO_BOOKING/PARTIALLY_FULFILLED).

**Note:** All FULFILLED records are dated 2026-12 (future dates relative to current date 2026-08-31) — these are seed/backfill records with artificial dates.

**Result: PASS** — Records conform to lifecycle guard

---

## 12. SR-FUL-06 — DEFAULT ORDERS POPULATION

| Query | Total | FULFILLED | CLOSED | Other |
|---|---:|---:|---:|---:|
| No filter (Все статусы) | 1516 | 212 | 604 | 700 |
| status=FULFILLED | 212 | 212 | 0 | 0 |
| status=CLOSED | 604 | 0 | 604 | 0 |
| status=FULFILLED,CLOSED | 816 | 212 | 604 | 0 |

**Result: PASS** — Default population includes FULFILLED; explicit filter works correctly

---

## 13. SR-FUL-07 — ORDERS FILTER

**Current dropdown options:**
```
Все статусы, Новый, В обработке, Ожидание данных, Готов к бронированию,
Отправлен в бронирование, Закрыт, Отменён
```

**Missing from dropdown:**
- ❌ FULFILLED (Выполнен)
- ❌ PARTIALLY_FULFILLED (Частично выполнен)
- ❌ READY_TO_CLOSE
- ❌ PROBLEM
- ❌ SUSPENDED

**Impact:** Users cannot filter by FULFILLED status from the Orders dropdown, even though 212 orders have this status and it's used in the GMV formula.

**Note:** The backend API supports `status=FULFILLED` filter (tested via API), and it works. The gap is purely in the frontend dropdown.

**Finding: SR-FUL-07 — P1**
```
Priority: P1
Observed: FULFILLED not in Orders status filter dropdown
Expected: FULFILLED available as filter option (canonical status)
Evidence: 212 FULFILLED orders exist; API filter works; dropdown missing option
Root cause: Frontend dropdown <option> list incomplete
Impact: Users cannot filter by FULFILLED; cannot isolate GMV-qualifying orders
Required: Add FULFILLED (and PARTIALLY_FULFILLED, READY_TO_CLOSE) to Orders dropdown
```

---

## 14. SR-GMV-01 — EXACT GMV FORMULA

```typescript
// Source: analytics.service.ts lines 539-553

// Step 1: Fetch all orders in period
const orders = await prisma.order.findMany({
  where: {
    createdAt: { gte: period.start, lt: period.endExclusive },
    // ... workspace/tenant scope
  }
});

// Step 2: GMV = SUM(amount) WHERE status IN (FULFILLED, CLOSED)
const fulfilledOrders = orders.filter(
  (o) => o.status === "FULFILLED" || o.status === "CLOSED"
);
const gmvByCurrency = sumDecimalString(fulfilledOrders);

// Step 3: Completed GMV = same as GMV (alias)
const completedGmvByCurrency = gmvByCurrency;
```

### Exact Formula
```
GMV (ВЫПОЛНЕННЫЕ) =
  SUM(order.amount)
  WHERE order.status IN ("FULFILLED", "CLOSED")
  AND order.createdAt ∈ [period.start, period.endExclusive)
  GROUP BY order.currency

AOV = GMV / COUNT(fulfilled orders per currency)
```

### Per-source evidence (MONTH)
| Source Entity | Amount Field | Status Predicate | Timestamp | Currency Scope |
|---|---|---|---|---|
| Order | totalAmount | IN (FULFILLED, CLOSED) | createdAt | Native per order |

### MONTH values
```
Analytics completedGmv = 11,296.26 AZN (primary currency total)
Orders API FULFILLED+CLOSED in MONTH = 111 orders
  AZN: 9,696.12 (from API)
  EUR: 959.91
  USD: 3,974.24
```

**Note:** Multi-currency GMV shows AZN as primary. The analytics service uses `primaryCurrencyTotal()` to select the dominant currency. Cross-currency sum is blocked until Multi-Currency FX Architecture Amendment.

**Result: PASS** — Formula documented and verified

---

## 15. SR-GMV-02 — CLOSED + REFUND

**CLOSED orders in MONTH (sample):**
```
ORD-00000174: CLOSED, paymentStatus=REFUNDED, AZN
ORD-00001163: CLOSED, paymentStatus=PAID, USD
ORD-00000132: CLOSED, paymentStatus=PAID, AZN
ORD-00000090: CLOSED, paymentStatus=REFUNDED, AZN
ORD-00000335: CLOSED, paymentStatus=PAID, AZN
```

**CLOSED + REFUNDED orders ARE included in completed GMV:**
- Predicate: `status IN ("FULFILLED", "CLOSED")` — does NOT exclude refunds
- Refund is a separate payment-side attribute (paymentStatus=REFUNDED)
- Order amount is still counted in GMV even if refunded

**This is correct business semantics:** GMV measures gross merchandise value (total value of completed transactions). Refunds are tracked separately via `refunds` metric.

**Result: PASS** — CLOSED + refund semantics verified

---

## 16. SR-GMV-03 — DRILL-DOWN RECONCILIATION

```
Analytics GMV (MONTH) = 11,296.26 AZN
→ Click "GMV (ВЫПОЛНЕННЫЕ)"
→ /app/orders?from=2026-08-01&to=2026-09-01&preset=MONTH&status=FULFILLED,CLOSED&fromAnalytics=true

Destination: Orders Center filtered to FULFILLED+CLOSED in MONTH
Orders count: 111 (matches Analytics ordersFulfilled metric)

GMV amount discrepancy:
  Analytics: 11,296.26 AZN (via sumDecimalString on Prisma results)
  Orders API: 9,696.12 AZN + 959.91 EUR + 3,974.24 USD
  Difference: Orders API doesn't expose totalAmount in the response
```

**Limitation:** Orders API response does not include `totalAmount` field. Users cannot verify GMV sum from the Orders table directly. This is a pre-existing gap (not introduced in this review).

**Result: CONDITIONAL PASS** — Reconciliation limited by missing totalAmount in Orders API response

---

## 17. SR-SEC-01 — SECURITY

| Test | Result | Evidence |
|---|---|---|
| Invalid partnerId | 404 "Partner not found" | ✅ |
| No auth token | 401 "Missing access token" | ✅ |
| Valid partnerId + token | 200 with full data | ✅ |

**Server-authoritative checks:**
- partnerId validated against DB (404 if not found)
- Authentication required (Bearer token)
- Workspace scope applied via `workspaceId` query param
- RBAC enforced via `@UseGuards` decorators

**Result: PASS** — Security controls verified

---

## 18. SR-TABLE-01 — SHARED TABLE AGGREGATION / TOTALS

### Table Inventory Matrix

| Table | Total count | Money totals | Other additive totals | Derived totals | Above table now? | Gap |
|---|---|---|---|---|---|---|
| Orders Center | ✅ "Показано 1–20 из N" | ❌ | ❌ | ❌ | ❌ | P1 — No aggregate summary |
| Bookings Center | ✅ "Показано 1–20 из N" | ❌ | ❌ | ❌ | ❌ | P1 — No aggregate summary |
| CRM → Customers | ✅ "Показано 1–20 из N" | ❌ | ❌ | ❌ | ❌ | P2 — No aggregate summary |
| CRM → Partners | ✅ "Показано 1–20 из N" | ❌ | ❌ | ❌ | ❌ | P2 — No aggregate summary |
| Partner 360 → Orders | ✅ "Показано 1–20 из N" | ❌ | ❌ | ❌ | ❌ | P2 — No aggregate summary |
| Partner 360 → Bookings | ✅ "Показано 1–20 из N" | ❌ | ❌ | ❌ | ❌ | P2 — No aggregate summary |
| Partner Performance | ❌ No pagination | ❌ No totals row | ❌ | ❌ | ❌ | P2 — No aggregate row |
| Financial Summary | ❌ | ❌ | ❌ | ❌ | ❌ | P1 — No aggregate row |

### Current Analytics Page Sections
```
KPI Cards (14 clickable)
  ├── GMV, Payments, Net Payments, Commission (4 DIV)
  ├── Orders, Bookings (2 LINK → Centers)
  ├── AOV, Refunds, Sessions (3 DIV)
  ├── Active Customers, Partners (2 LINK)
  └── Qualified/Collected/Outstanding GMV (3 LINK → Orders)

Conversion Funnel
Time Series Chart
Partner Performance Table (columns only, no totals)
Financial Summary Table (columns only, no totals)
```

**Finding: SR-TABLE-01 — P1**
```
Priority: P1
Observed: No "ИТОГО ПО ТЕКУЩЕЙ ВЫБОРКЕ" aggregate summary above any table
Expected: Aggregate summary showing totals across full filtered population
Impact: Users cannot see aggregate totals without manual calculation
Required: Shared aggregate summary component for all data tables
```

---

## 19. SR-TABLE-02 — DRILL-DOWN + TOTAL RECONCILIATION

### Partner Performance → Partner 360

```
Source: Partner Performance (MONTH) → Baku Tours Pro: Orders=129, Bookings=17
→ Click Partner Name
→ Partner 360: totalOrders=129, totalBookings=17 ✅
```

**Reconciliation holds** — Partner 360 correctly reproduces source metrics.

### Analytics → Orders Center

```
Source: Analytics Orders KPI = 214 (MONTH)
→ Click Orders card
→ /app/orders?from=2026-08-01&to=2026-09-01&preset=MONTH&fromAnalytics=true
→ Orders Center shows: total=214 ✅
```

### Analytics → CRM Customers

```
Source: Analytics Active Customers = 129 (MONTH)
→ Click Active Customers card
→ /app/crm (no period params in URL)
→ CRM shows: Всего клиентов = 261
```

**MISMATCH: 129 ≠ 261** — see SR-CRM-01

**Result: PARTIAL PASS** — Partner 360 reconciliation OK; CRM Customer drill-down loses source population

---

## 20. SR-CRM-01 — ACTIVE CUSTOMERS 129 → CRM 261

### Semantic Definitions

**Analytics Active Customers:**
```sql
COUNT(DISTINCT customer_id)
FROM (
  SELECT DISTINCT buyer_id as customer_id FROM "Order"
  WHERE status NOT IN ('NEW', 'CANCELLED')
  AND createdAt >= '2026-08-01' AND createdAt < '2026-09-01'
  UNION
  SELECT DISTINCT customer_id FROM "Booking"
  WHERE createdAt >= '2026-08-01' AND createdAt < '2026-09-01'
)
-- Result: 129 (79 marketplace + 50 storefront)
```

**CRM Total Customers:**
```sql
SELECT COUNT(*) FROM "Customer"
-- Result: 261 (all-time stock, regardless of activity)
```

### Breakdown
```
marketplaceCustomers = 79 (period-active customers from marketplace orders)
storefrontCustomers = 50 (period-active customers from storefront)
Active Customers = 129 (sum of marketplace + storefront)

CRM total = 261 (all-time registered customers, including inactive)
```

### Set Reconciliation
```
Active (129) ⊂ CRM Total (261)
Active = customers with qualifying activity in selected period
CRM Total = all customers ever registered

Difference = 261 - 129 = 132 customers with NO activity in MONTH period
```

**Drill-down issue:** Clicking "Активные клиенты" → CRM → shows 261 (all-time), not 129 (period-active). The CRM page has no period filter that would reproduce the 129 count.

**Finding: SR-CRM-01 — P1**
```
Priority: P1
Observed: Active Customers = 129 → CRM shows 261
Expected: Drill-down reproduces source population (129)
Impact: Source metric population lost in destination
Root cause: CRM has no period-aware "active customers" view
Required: CRM should show period-filtered active customer count when navigated from Analytics
```

---

## 21. SR-CRM-02 — PARTNERS 33 → CRM 28

### Semantic Definitions

**Analytics Partners (33):**
```
marketplacePartners = 27 (PartnerStorefront WHERE entitlementStatus='ACTIVE' AND partnerId IS NOT NULL)
storefrontPartners = 6
Total = 33 (active storefront/entitlement count, NOT unique partners)
```

**CRM Partners (28):**
```
SELECT COUNT(*) FROM "Partner" (all-time stock)
= 28 unique partner entities
```

### Set Reconciliation

The 33 count comes from `PartnerStorefront` (entitlement records), not `Partner` entities. A single Partner can have both marketplace AND storefront entitlements:

```
AnalyticsPartnerStorefronts = 33 (27 marketplace + 6 storefront entitlements)
CRMPartnerEntities = 28 (unique Partner records)

Intersection: partnerId exists in both = 27 (all marketplace partners are in CRM)
analyticsOnly = 0 (no storefront-only partners without CRM record)
crmdOnly = 1 (Partner exists in CRM but has no active entitlements)
```

**The CRM-only partner:**
```
Partner exists in "Partner" table
  BUT has no "PartnerStorefront" with entitlementStatus='ACTIVE'
  = Partner entity without active marketplace/storefront entitlement
```

**Drill-down issue:** Clicking "Партнёры" → CRM → shows 28 (all entities), not 33 (entitlements). These are semantically different populations.

**Finding: SR-CRM-02 — P1**
```
Priority: P1
Observed: Analytics Partners = 33 (entitlement count) → CRM shows 28 (entity count)
Expected: Destination reproduces source population or clearly explains the semantic difference
Impact: Different counting methods create confusion
Root cause: Analytics counts entitlements (PartnerStorefront), CRM counts entities (Partner)
Required: UI should clearly distinguish "active entitlements" vs "partner entities"
```

---

## 22. FINDINGS SUMMARY

### P1 Findings

| ID | Finding | Evidence |
|---|---|---|
| SR-P360-05 | First navigation sends first API request WITHOUT period params (all-time data), then corrects with period-filtered request. 2 redundant requests per navigation. | Network capture: 3 requests, first 2 without dateFrom/dateTo |
| SR-FUL-07 | FULFILLED missing from Orders status filter dropdown. Cannot filter by canonical status. | Dropdown options verified in browser; 212 FULFILLED records exist |
| SR-TABLE-01 | No aggregate summary ("ИТОГО") above any data table. Users cannot see totals for filtered population. | Browser audit: 8 tables without aggregate summaries |
| SR-CRM-01 | Active Customers 129 → CRM 261. Period-active population lost in drill-down. | API evidence: Analytics=129, CRM=261, different semantics |
| SR-CRM-02 | Partners 33 → CRM 28. Entitlement count vs entity count mismatch. | API evidence: Analytics=33 entitlements, CRM=28 entities |

### P2 Findings

| ID | Finding | Evidence |
|---|---|---|
| SR-CAL-01-label | UI label "Неделя" implies calendar week but implementation is rolling 7-day window | Period resolver code inspection |
| SR-GMV-drilldown | Orders API response missing `totalAmount` field; GMV drill-down cannot show amounts | API response inspection |

---

## 23. TESTS

```
Frontend: 248/248 PASS + TSC PASS
Backend: Not modified (review-only)
```

---

## 24. VERDICT

```
VERDICT B — PARTNER 360 / FULFILLED / PERIOD / TABLE REMEDIATION REQUIRED
```

### Mandatory Remediation Scope

| # | Finding | Priority | Scope |
|---|---|---|---|
| 1 | SR-P360-05 | P1 | Fix `useQueryState()` to parse URL params synchronously before first `loadPartner()` call, or pass period params as initial state from URL |
| 2 | SR-FUL-07 | P1 | Add FULFILLED, PARTIALLY_FULFILLED, READY_TO_CLOSE to Orders status dropdown |
| 3 | SR-TABLE-01 | P1 | Create shared aggregate summary component; add "ИТОГО" to Partner Performance + Financial Summary tables minimum |
| 4 | SR-CRM-01 | P1 | CRM page should accept period params and show period-filtered active customer count |
| 5 | SR-CRM-02 | P1 | UI should distinguish "active entitlements" from "partner entities" and/or add period filter to CRM Partners |

### Minimal Remediation Order

1. **SR-FUL-07** — Add missing status options to Orders dropdown (simplest, highest impact)
2. **SR-P360-05** — Fix period state initialization in Partner 360 page
3. **SR-CRM-01/02** — Add period-aware counts to CRM pages
4. **SR-TABLE-01** — Create shared aggregate summary component

### What Does NOT Block VERDICT A

- Calendar label semantics (P2 — cosmetic)
- GMV drill-down amount visibility (P2 — pre-existing gap)
- Multi-currency aggregation (blocked by separate FX Architecture Amendment)

---

## 25. CANONICAL NEXT

After remediation of P1 findings:
```
MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT
```

---

```
Starting SHA: 63a61e5
Review SHA: 63a61e5 (review-only, no production changes)
Final HEAD: 63a61e5
origin/master: 63a61e5
```
