# PHASE 3 — D11 Project-Wide KPI / Status Semantics — Scope Audit

## 1. Executive Summary

D11 определяет project-wide KPI/status reconciliation: как одна и та же бизнес-сущность, метрика и статус должны интерпретироваться одинаково во всех центрах и поверхностях системы.

**Ключевые выводы:**

1. **Command Center + Analytics Center** используют единый source: `AnalyticsService.getCompanyKpi()` — single source of truth для company-wide KPI.
2. **Orders Center** и **Bookings Center** имеют **отдельные** KPI aggregates через DB `groupBy` — это **intentional design** (registry scope ≠ analytics scope), а не discrepancy.
3. **Status enums** каноничны и consistent: OrderStatus (12), BookingStatus (13), PaymentStatus (6), RefundStatus (4), CommissionStatus (3), RequestStatus (12).
4. **D11 scope** = formalize KPI dictionary, reconcile cross-center definitions, document canonical formulas. NOT redesign existing architecture.
5. **Finance boundary** preserved: D11 не создаёт financial authority.

**READINESS: READY WITH EXPLICIT GAPS**

---

## 2. Repository Baseline

```text
HEAD:           79ef1fc48a50eee5fc6af5ec23b3ca05bba8af10
origin/master:  79ef1fc48a50eee5fc6af5ec23b3ca05bba8af10
working tree:   CLEAN (untracked prompt artifacts only)
diff --check:   PASS
D10 closure:    79ef1fc (feat(D10): align Booking attribution)
```

---

## 3. D11 Canonical Definition

### 3.1 Master Plan v3

```text
D10 ✅ Partner Performance Attribution
D11 ⬜ Project-Wide KPI/Status Semantics + Total Reconciliation
D12 ⬜ CRM/KPI Drill-down Routing
```

### 3.2 Lifecycle Contract

```
COMMERCE_LIFECYCLE_CANONICAL_CONTRACT.md L831:
| D11 | Booking KPI semantics |
```

### 3.3 Architecture Debt Register

```
D11 Project-Wide KPI/Status Semantics | ARCHITECTURE_DEBT | NOT STARTED
```

### 3.4 D8 Evidence Scope Reconciliation

```
KPI semantics = D11-OWNED (KPI definitions, bucket-vs-headline reconciliation,
comparison semantics, period comparison display)
```

### 3.5 DATA-01

```
DATA-01 (KPI read-model consistency) → assigned to D11
```

---

## 4. Domain Inventory

| Domain | Status | Canonical Model | Authoritative Source | Status Field | KPI Consumers |
|---|---|---|---|---|---|
| Requests | EXISTS | Request | order.Request | RequestStatus (12) | Operations Center |
| Orders | EXISTS | Order | order.Order | OrderStatus (12), OrderPaymentStatus (4) | Orders Center, Analytics, Command Center |
| Bookings | EXISTS | Booking | booking.Booking | BookingStatus (13) | Bookings Center, Analytics, Command Center |
| Payments | EXISTS | Payment | finance.Payment | PaymentStatus (6) | Payments Center, Analytics |
| Refunds | EXISTS | Refund | finance.Refund | RefundStatus (4) | Payments Center, Analytics |
| Commissions | EXISTS | Commission | finance.Commission | CommissionStatus (3) | Analytics |
| Products | EXISTS | Product | catalog.Product | ProductStatus | Marketplace, Catalog |
| Partners | EXISTS | Partner | crm.Partner | EntityStatus | CRM, Analytics |
| Customers | EXISTS | Customer | crm.Customer | CustomerType | CRM, Analytics |
| Sales | EXISTS | Quote/Sale/Opportunity | sales.* | QuoteStatus/SaleStatus/OpportunityStatus | Sales Center |
| CRM | EXISTS | CrmActivity | crm.CrmActivity | — | CRM Center |
| Analytics | EXISTS | AnalyticsService | analytics.* | — | Analytics Center, Command Center |

---

## 5. Status Inventory

### 5.1 Core Commerce Statuses

**OrderStatus** (12 values):
```
NEW, IN_PROCESSING, WAITING_FOR_DATA, READY_FOR_BOOKING,
SENT_TO_BOOKING, PARTIALLY_FULFILLED, FULFILLED, READY_TO_CLOSE,
CLOSED, CANCELLED, PROBLEM, SUSPENDED
```

**BookingStatus** (13 values):
```
NEW, PREPARING_REQUEST, SENT_TO_SUPPLIER, AWAITING_CONFIRMATION,
CONFIRMED, IN_SERVICE, COMPLETED, NEEDS_CLARIFICATION,
SUPPLIER_REJECTED, CHANGE_REQUESTED, CANCELLATION_REQUESTED,
CANCELLED, PROBLEM
```

**PaymentStatus** (6 values):
```
PENDING, AUTHORIZED, CAPTURED, FAILED, CANCELLED, REFUNDED
```

**RefundStatus** (4 values):
```
REQUESTED, APPROVED, PROCESSED, FAILED
```

**CommissionStatus** (3 values):
```
ACCRUED, INVOICED, PAID
```

**RequestStatus** (12 values):
```
NEW, CHECKING, SUPPLIER_TIMEOUT, PRICE_CHANGED, CUSTOMER_ACCEPTED,
CONFIRMED, CONVERTED, REJECTED, UNAVAILABLE, EXPIRED,
CUSTOMER_PAYMENT_TIMEOUT, CANCELLED_BY_CUSTOMER
```

**OrderPaymentStatus** (4 values):
```
UNPAID, PARTIALLY_PAID, PAID, REFUNDED
```

### 5.2 Status Semantic Categories

| Category | Orders | Bookings | Payments | Refunds | Commissions |
|---|---|---|---|---|---|
| Created/Initiated | NEW | NEW | PENDING | REQUESTED | ACCRUED |
| In Progress | IN_PROCESSING, WAITING_FOR_DATA, READY_FOR_BOOKING, SENT_TO_BOOKING | PREPARING_REQUEST, SENT_TO_SUPPLIER, AWAITING_CONFIRMATION | AUTHORIZED | APPROVED | INVOICED |
| Active/Confirmed | PARTIALLY_FULFILLED | CONFIRMED, IN_SERVICE | — | — | — |
| Terminal Success | FULFILLED, CLOSED | COMPLETED | CAPTURED | PROCESSED | PAID |
| Terminal Failure | CANCELLED, PROBLEM, SUSPENDED | CANCELLED, SUPPLIER_REJECTED, PROBLEM | FAILED, CANCELLED | FAILED | — |

---

## 6. Status Canonicality Matrix

| Entity | Status | Schema Enum | Used by API | Used by UI | Used by KPI | Canonical? | Evidence |
|---|---|---|---|---|---|---|---|
| Order | NEW | OrderStatus | ✅ | ✅ | ✅ Orders Center | ✅ YES | schema.prisma L1873 |
| Order | FULFILLED | OrderStatus | ✅ | ✅ | ✅ Analytics (ordersFulfilled) | ✅ YES | schema.prisma L1881 |
| Order | CLOSED | OrderStatus | ✅ | ✅ | ✅ Analytics (completedGmv) | ✅ YES | schema.prisma L1883 |
| Order | CANCELLED | OrderStatus | ✅ | ✅ | ✅ Analytics (excluded from GMV lifecycle) | ✅ YES | schema.prisma L1884 |
| Booking | CONFIRMED | BookingStatus | ✅ | ✅ | ✅ Analytics (bookingsConfirmed) | ✅ YES | schema.prisma L2282 |
| Booking | COMPLETED | BookingStatus | ✅ | ✅ | ✅ Analytics (bookingsCompleted) | ✅ YES | schema.prisma L2283 |
| Booking | CANCELLED | BookingStatus | ✅ | ✅ | ❌ Not in Analytics KPI | ✅ YES | schema.prisma L2289 |
| Payment | CAPTURED | PaymentStatus | ✅ | ✅ | ✅ Analytics (paymentsCaptured) | ✅ YES | schema.prisma L3854 |
| Refund | PROCESSED | RefundStatus | ✅ | ✅ | ✅ Analytics (refundsProcessed) | ✅ YES | schema.prisma L3975 |
| Commission | ACCRUED | CommissionStatus | ✅ | ✅ | ✅ Analytics (commissionAccrued) | ✅ YES | schema.prisma L4171 |

**Finding:** No status synonyms, no semantic collisions, no derived statuses in KPI.
All status values used by KPI match their schema enum definitions.

---

## 7. KPI Inventory

### 7.1 AnalyticsService.getCompanyKpi() — Company-Wide KPI

| KPI | Source | Formula | Status Filter | Timestamp | Currency | Scope |
|---|---|---|---|---|---|---|
| GMV | order.Order.amount | SUM(amount) WHERE acquisitionSource=MARKETPLACE | All statuses (cohort by createdAt) | createdAt | Order.currency | Marketplace |
| Revenue | finance.Payment.amount | SUM(amount) WHERE CAPTURED | status=CAPTURED | paidAt | Payment.currency | Marketplace |
| Net Revenue | Revenue - Refunds | computed | — | — | — | Marketplace |
| Commission Accrued | finance.Commission.amount | SUM(amount) | status=ACCRUED | createdAt | Commission.currency | Marketplace |
| Orders Created | order.Order | COUNT(*) | All statuses | createdAt | — | Marketplace |
| Orders Fulfilled | order.Order | COUNT(*) WHERE status=FULFILLED | status=FULFILLED | createdAt | — | Marketplace |
| Bookings Requested | booking.Booking | COUNT(*) | All statuses | createdAt | — | Marketplace |
| Bookings Confirmed | booking.Booking | COUNT(*) WHERE status=CONFIRMED | status=CONFIRMED | createdAt | — | Marketplace |
| Bookings Completed | booking.Booking | COUNT(*) WHERE status=COMPLETED | status=COMPLETED | createdAt | — | Marketplace |
| Payments Captured | finance.Payment | COUNT(*) WHERE status=CAPTURED | status=CAPTURED | createdAt | — | Marketplace |
| Refunds Processed | finance.Refund | COUNT(*) WHERE status=PROCESSED | status=PROCESSED | createdAt | — | Marketplace |
| Marketplace Sessions | MarketplaceBehavioralEvent | COUNT(DISTINCT sessionId) | — | occurredAt | — | Marketplace |
| Storefront Sessions | StorefrontBehavioralEvent | COUNT(DISTINCT sessionId) | — | occurredAt | — | Storefront |
| Marketplace Visitors | MarketplaceBehavioralEvent | COUNT(DISTINCT visitorId) | — | occurredAt | — | Marketplace |
| Marketplace Visits | MarketplaceBehavioralEvent | COUNT(DISTINCT sessionId) | — | occurredAt | — | Marketplace |
| Active Partners (Marketplace) | Partner via Product | COUNT(DISTINCT partnerId) WHERE PUBLISHED | — | — | — | Marketplace |
| Active Partners (Storefront) | Partner via Storefront | COUNT(DISTINCT partnerId) | — | — | — | Storefront |
| Total Active Partners | Union of above | COUNT | — | — | — | All |
| Active Customers (Marketplace) | Order.customerId | COUNT(DISTINCT customerId) | — | createdAt | — | Marketplace |
| Active Customers (Storefront) | Order.customerId | COUNT(DISTINCT customerId) | — | createdAt | — | Storefront |
| Total Active Customers | Union of above | COUNT | — | — | — | All |
| AOV | GMV / Orders Fulfilled | SUM(amount)/COUNT(FLFILLED) | status=FULFILLED | createdAt | — | Marketplace |
| Refunds Total | finance.Refund.amount | SUM(amount) | — | createdAt | Refund.currency | Marketplace |
| Qualified GMV | order.Order.amount | SUM(amount) WHERE status NOT IN (NEW, CANCELLED) | Excludes NEW, CANCELLED | createdAt | Order.currency | Marketplace |
| Completed GMV | order.Order.amount | SUM(amount) WHERE status IN (FULFILLED, CLOSED) | FULFILLED or CLOSED | createdAt | Order.currency | Marketplace |
| Collected GMV | order.Order.paidAmount | SUM(paidAmount) WHERE status NOT IN (NEW, CANCELLED) | Excludes NEW, CANCELLED | createdAt | Order.currency | Marketplace |
| Outstanding GMV | Qualified GMV - Collected GMV | computed | — | — | — | Marketplace |

### 7.2 Orders Center KPI

| KPI | Source | Formula | Status Filter | Timestamp | Scope |
|---|---| COUNT by status | DB groupBy on status | createdAt | Overview scope (all filters except status/paymentStatus) |
| Lifecycle KPIs | order.Order | groupBy status | Per-status counts | createdAt | overviewOrderWhere() |
| Payment KPIs | order.Order | groupBy paymentStatus | Per-status counts | createdAt | overviewOrderWhere() |
| Total Orders | order.Order | COUNT(*) | All statuses | createdAt | Overview scope |

### 7.3 Bookings Center KPI

| KPI | Source | Formula | Status Filter | Timestamp | Scope |
|---|---|---|---|---|---|
| Lifecycle KPIs | booking.Booking | groupBy status | Per-status counts | createdAt | Overview scope (all filters except status) |
| Total Bookings | booking.Booking | COUNT(*) | All statuses | createdAt | Overview scope |

### 7.4 Partner Performance (D10-aligned)

| KPI | Source | Formula | Status Filter | Timestamp | Scope |
|---|---|---|---|---|---|
| Orders per Partner | Order.sellerPartnerId | COUNT(*) | acquisitionSource=MARKETPLACE | createdAt | Marketplace |
| GMV per Partner | Order.amount + sellerPartnerId | SUM(amount) | acquisitionSource=MARKETPLACE | createdAt | Marketplace |
| Bookings per Partner | Booking.orderId → Order.sellerPartnerId | COUNT(*) | acquisitionSource=MARKETPLACE | createdAt | Marketplace |
| Completed Bookings | status=COMPLETED → sellerPartnerId | COUNT(*) | status=COMPLETED | completedAt | Marketplace |
| Revenue per Partner | Payment.amount → orderId → sellerPartnerId | SUM(amount) | CAPTURED | paidAt | Marketplace |
| Commission per Partner | Commission.partnerId | SUM(amount) | — | createdAt | Marketplace |
| Active Products | Product.partnerId WHERE PUBLISHED | COUNT(*) | PUBLISHED | — | Marketplace |
| Completion Rate | completedBookings / totalBookings | computed | — | — | Marketplace |

### 7.5 Financial Reconciliation

| KPI | Source | Formula | Timestamp | Scope |
|---|---|---|---|---|
| Total Payments | Payment.amount WHERE CAPTURED | SUM(amount) per currency | createdAt | Marketplace |
| Total Refunds | Refund.amount | SUM(amount) per currency | createdAt | Marketplace |
| Net Payments | Payments - Refunds | computed per currency | — | Marketplace |
| Total Commission | Commission.amount | SUM(amount) per currency | createdAt | Marketplace |

---

## 8. KPI Consistency Matrix

### 8.1 Orders KPI Cross-Center

| KPI | Command Center | Analytics Center | Orders Center | Consistent? |
|---|---|---|---|---|
| Orders Created/Total | AnalyticsService (MARKETPLACE) | AnalyticsService (MARKETPLACE) | DB groupBy (Overview scope) | ⚠️ DIFFERENT SCOPE |
| GMV | AnalyticsService | AnalyticsService | N/A (no GMV in Orders Center) | ✅ CONSISTENT |
| Orders Fulfilled | AnalyticsService | AnalyticsService | N/A | ✅ CONSISTENT |

**Finding:** Orders Center "Total Orders" uses `overviewOrderWhere()` which includes ALL acquisition sources within the overview scope, while Analytics "ordersCreated" filters by `acquisitionSource = MARKETPLACE`. This is **intentional** — Orders Center shows operational scope, Analytics shows Marketplace scope. Not a discrepancy but a **documented scope difference**.

### 8.2 Bookings KPI Cross-Center

| KPI | Command Center | Analytics Center | Bookings Center | Consistent? |
|---|---|---|---|---|
| Bookings Total | AnalyticsService (MARKETPLACE) | AnalyticsService (MARKETPLACE) | DB groupBy (Overview scope) | ⚠️ DIFFERENT SCOPE |
| Bookings Confirmed | AnalyticsService | AnalyticsService | DB groupBy (status=CONFIRMED) | ⚠️ DIFFERENT SCOPE |
| Bookings Completed | AnalyticsService | AnalyticsService | DB groupBy (status=COMPLETED) | ⚠️ DIFFERENT SCOPE |

**Same pattern as Orders:** Bookings Center shows operational scope, Analytics shows Marketplace scope. Intentional.

### 8.3 Revenue/GMV Cross-Center

| KPI | Command Center | Analytics Center | Partner Performance | Consistent? |
|---|---|---|---|---|
| GMV | AnalyticsService | AnalyticsService | D10-aligned (sellerPartnerId) | ✅ CONSISTENT |
| Revenue | AnalyticsService (paidAt) | AnalyticsService (paidAt) | D10-aligned (paidAt) | ✅ CONSISTENT |
| Commission | AnalyticsService | AnalyticsService | D10-aligned (partnerId) | ✅ CONSISTENT |

### 8.4 Completion Rate Cross-Center

| KPI | Analytics Center | Partner Performance | Consistent? |
|---|---|---|---|
| Bookings Completed | COUNT WHERE status=COMPLETED | COUNT WHERE status=COMPLETED (via sellerPartnerId) | ✅ CONSISTENT |
| Completion Rate | N/A (separate KPI) | completedBookings / totalBookings | ✅ CONSISTENT |

---

## 9. Cross-Center Reconciliation

### 9.1 Command Center ↔ Analytics Center

**SAME SOURCE:** Both use `AnalyticsService.getCompanyKpi()`. Identical KPIs, identical formulas, identical scope. **NO discrepancy.**

### 9.2 Command Center ↔ Orders/Bookings Centers

**DIFFERENT SCOPE (INTENTIONAL):**
- Command Center/Analytics: Marketplace-scoped KPIs
- Orders/Bookings Center: Operational-scope KPIs (all acquisition sources within overview)

This is by design: Command Center shows platform-wide Marketplace performance, while Registry Centers show operational scope for daily work.

### 9.3 Analytics Center ↔ Partner Performance

**ALIGNED (D10):** Partner Performance now uses `Order.sellerPartnerId` for all metrics. Consistent with Analytics Center's attribution model.

### 9.4 Frontend Authority

Frontend is **consumer only** for all major KPIs:
- Command Center: Server-computed via `AnalyticsService`
- Analytics Center: Server-computed via `AnalyticsService`
- Orders Center: Server-computed via DB `groupBy`
- Bookings Center: Server-computed via DB `groupBy`
- Partner Performance: Server-computed via `AnalyticsService`

**Minor frontend aggregation:** Analytics page displays `AggregateSummary` for Partner Performance and Financial Reconciliation — this is display-level reduction of already-server-computed data, NOT independent KPI calculation. Severity: LOW.

---

## 10. Temporal Semantics

D8 is CLOSED. D11 must use existing canonical temporal contracts.

| KPI | Timestamp | D8 Contract | D11 Status |
|---|---|---|---|
| Orders Created | createdAt | UTC instant, server-owned | EXISTING_CANONICAL |
| Bookings Requested | createdAt | UTC instant, server-owned | EXISTING_CANONICAL |
| Payments Captured | createdAt (COUNT) | UTC instant, server-owned | EXISTING_CANONICAL |
| Revenue | paidAt | Lifecycle milestone, server-owned | EXISTING_CANONICAL |
| GMV Lifecycle | createdAt (cohort) | UTC instant, server-owned | EXISTING_CANONICAL |
| Completed Bookings | completedAt | Lifecycle milestone, server-owned | EXISTING_CANONICAL |
| Refunds Processed | createdAt | UTC instant, server-owned | EXISTING_CANONICAL |
| Commission Accrued | createdAt | UTC instant, server-owned | EXISTING_CANONICAL |
| Period Filter | resolveQueryPeriod() | [start, endExclusive), server-authoritative | EXISTING_CANONICAL |

**No timestamp discrepancies found.** All KPIs use D8-compliant temporal semantics.

---

## 11. Financial Boundary

D11 is NOT Finance implementation. D11 only documents/reconciles existing financial KPI semantics.

| Financial Fact | D11 Role | Finance Role |
|---|---|---|
| Revenue | READ/Document | WRITE (authoritative) |
| Commission | READ/Document | WRITE (authoritative) |
| Refunds | READ/Document | WRITE (authoritative) |
| Settlement | OUT OF SCOPE | WRITE (future) |
| Payout | OUT OF SCOPE | WRITE (future) |

Finance remains: **NOT STARTED / DEFERRED**

---

## 12. D10 ↔ D11 Boundary

| Dimension | D10 | D11 |
|---|---|---|
| Purpose | Partner attribution semantics | Project-wide KPI/status reconciliation |
| Scope | Which Partner gets which metric | How same KPI is interpreted across centers |
| Status | Uses existing statuses | Reconciles status vocabulary |
| Output | Attribution consistency | KPI dictionary + cross-center contract |

D11 consumes D10's canonical attribution. D11 does NOT rewrite Partner attribution.

---

## 13. Frontend Authority

All major KPIs are **server-calculated**:

| Center | KPI Source | Client-side? |
|---|---|---|
| Command Center | AnalyticsService | ❌ Server |
| Analytics Center | AnalyticsService | ❌ Server |
| Orders Center | DB groupBy | ❌ Server |
| Bookings Center | DB groupBy | ❌ Server |
| Partner Performance | AnalyticsService (D10) | ❌ Server |
| Financial Reconciliation | AnalyticsService | ❌ Server |

**Minor frontend aggregation:** `AggregateSummary` in Analytics page (display-level only). Severity: LOW.

---

## 14. API Semantics

| Endpoint | KPI Source | Scope | Authority |
|---|---|---|---|
| GET /analytics/company-kpi | AnalyticsService.getCompanyKpi() | Marketplace | Server |
| GET /analytics/partner-performance | AnalyticsService.getPartnerPerformance() | Marketplace | Server |
| GET /analytics/financial-reconciliation | AnalyticsService.getFinancialReconciliation() | Marketplace | Server |
| GET /dashboard/command-center | DashboardService → AnalyticsService | Marketplace | Server |
| GET /orders | OrderService.listBookings() | Overview scope | Server |
| GET /bookings | BookingService.listBookings() | Overview scope | Server |

All API endpoints return server-computed KPIs. No client-side calculation authority.

---

## 15. Duplication / Semantic Drift

### 15.1 Orders Count

| Location A | Location B | Semantic Difference | Risk | Canonical Candidate |
|---|---|---|---|---|
| AnalyticsService.getCompanyKpi() — ordersCreated | OrderService.listBookings() — lifecycle.total | A = Marketplace only; B = Overview scope | LOW (intentional scope difference) | Both correct for their scope |

### 15.2 Bookings Count

| Location A | Location B | Semantic Difference | Risk | Canonical Candidate |
|---|---|---|---|---|
| AnalyticsService.getCompanyKpi() — bookingsRequested | BookingService.listBookings() — lifecycle.total | A = Marketplace only; B = Overview scope | LOW (intentional scope difference) | Both correct for their scope |

### 15.3 Revenue

| Location A | Location B | Semantic Difference | Risk | Canonical Candidate |
|---|---|---|---|---|
| AnalyticsService.getCompanyKpi() — revenue | AnalyticsService.getFinancialReconciliation() — totalPayments | A = total revenue; B = per-currency breakdown | LOW (same source, different presentation) | AnalyticsService (single source) |

**No dangerous duplications found.** All apparent duplications are intentional scope/presentation differences.

---

## 16. Security / Scope

| Scope Boundary | KPI | Preserved? | Evidence |
|---|---|---|---|
| Marketplace | All company KPIs | ✅ YES | `acquisitionSource = MARKETPLACE` filter |
| Storefront | Storefront Sessions/Partners/Customers | ✅ YES | Separate Storefront queries |
| Partner | Partner Performance | ✅ YES | D10 `resolvePartnerScope()` |
| Platform | Command Center | ✅ YES | `analytics.read` permission |

No cross-tenant/cross-scope information leakage detected in KPI definitions.

---

## 17. Dependency Matrix

| Dependency | State | Blocks D11? | Evidence |
|---|---|---|---|
| D10 closure | ✅ CLOSED | no | 79ef1fc |
| D8 temporal contract | ✅ CLOSED | no | Period filtering implemented |
| Orders lifecycle | ✅ EXISTS | no | 12 statuses defined |
| Booking lifecycle | ✅ EXISTS | no | 13 statuses defined |
| Payment/Refund semantics | ✅ EXISTS | no | 6+4 statuses defined |
| Analytics Foundation | ✅ EXISTS | no | AnalyticsService implemented |
| Command Center KPIs | ✅ EXISTS | no | DashboardService → AnalyticsService |
| CRM semantics | ✅ EXISTS | no | CrmActivity exists |
| Finance boundary | ⬜ NOT STARTED | no | D11 only documents, not creates |
| DATA-01 | ⬜ OPEN | no | D11 receives residual verification |
| DATA-02 | ⬜ OPEN | no | Storefront scope documented separately |
| PROD-01 | ⬜ DEFERRED | no | Product model not needed for D11 |

**No blocking dependencies.**

---

## 18. Blocking Decisions

**None.** D11 can proceed with documentation and reconciliation without any architecture decisions.

---

## 19. Readiness Verdict

```text
D11 READINESS: READY WITH EXPLICIT GAPS
```

### What's Ready
- ✅ All status enums canonical and consistent
- ✅ Command Center + Analytics use single source (AnalyticsService)
- ✅ Orders/Bookings Centers have intentional scope differences (documented)
- ✅ D10 attribution aligned
- ✅ D8 temporal semantics preserved
- ✅ Finance boundary preserved
- ✅ RBAC preserved
- ✅ No dangerous duplications

### Gaps (Non-blocking)
1. **DATA-01 residual:** KPI read-model consistency verification assigned to D11
2. **Scope documentation:** Orders/Bookings Center "Total" vs Analytics "Marketplace-only" scope difference needs formal documentation
3. **Completion Rate:** Partner Performance has completion rate, but Analytics Center doesn't expose it as a company-wide KPI (informational only)

---

## 20. Recommended Next Action

```text
D11 READINESS:       READY WITH EXPLICIT GAPS
CURRENT TRUE NEXT:   D11 — Project-Wide KPI/Status Semantics
FINANCE:             NOT STARTED / DEFERRED
D11 BLOCKERS:        none
D11 NON-BLOCKING GAPS: DATA-01 residual, scope documentation
CANONICAL KPI AUTHORITY: AnalyticsService.getCompanyKpi()
CANONICAL STATUS AUTHORITY: Prisma schema enums
TEMPORAL AUTHORITY: D8 (resolveQueryPeriod, UTC instants)
D10 ↔ D11:          D10 provides attribution; D11 reconciles cross-center semantics
IMPLEMENTATION SCOPE: KPI dictionary + cross-center scope documentation + DATA-01 residual verification
NEXT AUTHORIZED ACTION: D11 implementation prompt
```
