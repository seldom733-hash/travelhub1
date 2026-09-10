# TravelHub — Project-Wide KPI / Status Semantics

## 1. Purpose

Canonical semantic contract for KPI definitions, status meanings, and cross-center reconciliation.

Established by: D11 — Project-Wide KPI/Status Semantics (implementation 2026-09-10).

**Governance rule:** Existing canonical KPI/status semantics MUST NOT be changed by an individual center without updating this project-wide semantic contract and providing evidence for the change. Any future change must specify: authority, affected centers, affected APIs, affected KPIs, migration impact.

---

## 2. KPI Authority Model

```text
Company-wide KPI:
    AnalyticsService.getCompanyKpi()
    → single source of truth for Command Center + Analytics Center

Partner Performance:
    AnalyticsService.getPartnerPerformance()
    → D10-aligned, Order.sellerPartnerId attribution

Orders Center KPI:
    DB groupBy via overviewOrderWhere()
    → operational scope (all acquisition sources)

Bookings Center KPI:
    DB groupBy via overviewWhere
    → operational scope (all acquisition sources)

Financial Reconciliation:
    AnalyticsService.getFinancialReconciliation()
    → per-currency breakdown

CRM Analytics:
    AnalyticsService.getCrmAnalytics()
    → customer/relationship metrics
```

**Rule:** No frontend-owned KPI calculation authority. Frontend is consumer only (display, formatting, sorting, pagination).

---

## 3. Status Authority Model

```text
Status authority:
    Prisma schema enums (backend/Prisma/schema.prisma)

Not authoritative:
    Frontend labels
    UI display names
    i18n keys
    Documentation names
```

Status values are defined in schema and consumed by API/UI. No parallel status enum exists.

---

## 4. Temporal Authority

D8 is CLOSED. D11 preserves D8 temporal contracts:

```text
Period:        [start, endExclusive)
Resolution:    resolveQueryPeriod() — server-authoritative
Timezone:      UTC instants
Default:       MONTH preset
Custom:        startDate + endDate (both required)
```

For each KPI, the canonical business timestamp:

| KPI Category | Timestamp | Semantic |
|---|---|---|
| Order lifecycle | `createdAt` | Persistence time (cohort) |
| Booking lifecycle | `createdAt` | Persistence time (cohort) |
| Payment success | `paidAt` | Lifecycle milestone |
| Payment count | `createdAt` | Persistence time |
| Refund | `createdAt` | Persistence time |
| Commission | `createdAt` | Persistence time |
| Completed Booking | `completedAt` | Lifecycle milestone |
| Behavioral events | `occurredAt` | Client UTC |
| Partner Performance | `createdAt` (per entity) | Persistence time |

---

## 5. Currency Semantics

```text
Multi-currency:
    GMV, Revenue, Commission, Refunds — per-currency aggregation
    primaryCurrencyTotal() — selects dominant currency for display

Single-currency:
    Counts (Orders, Bookings, etc.) — no currency

Currency source:
    Order.currency — frozen at creation
    Payment.currency — server-copied from Order
    Commission.currency — frozen from Order
    Refund.currency — server-copied from Payment
```

---

## 6. KPI Dictionary

### 6.1 Orders Domain

| KPI | Definition | Authority | Source | Formula | Status Inclusion | Timestamp | Currency | Scope | Consumers | Intentional Variation |
|---|---|---|---|---|---|---|---|---|---|---|
| Orders Created | Total Orders in period | AnalyticsService | order.Order | COUNT(*) WHERE acquisitionSource=MARKETPLACE | All statuses (cohort) | createdAt | — | Marketplace | Command Center, Analytics | — |
| Orders Fulfilled | Orders with status FULFILLED | AnalyticsService | order.Order | COUNT(*) WHERE status=FULFILLED | status=FULFILLED | createdAt | — | Marketplace | Command Center, Analytics | — |
| Orders Total (Registry) | Total Orders in overview scope | OrderService | order.Order | COUNT(*) via overviewOrderWhere() | All statuses | createdAt | — | Overview (all sources) | Orders Center | Different scope than Analytics |
| GMV | Gross Merchandise Value | AnalyticsService | order.Order.amount | SUM(amount) WHERE acquisitionSource=MARKETPLACE | All statuses (cohort) | createdAt | Order.currency | Marketplace | Command Center, Analytics | — |
| Qualified GMV | GMV excluding NEW/CANCELLED | AnalyticsService | order.Order.amount | SUM(amount) WHERE status NOT IN (NEW, CANCELLED) | Excludes NEW, CANCELLED | createdAt | Order.currency | Marketplace | Command Center, Analytics | — |
| Completed GMV | GMV from FULFILLED/CLOSED Orders | AnalyticsService | order.Order.amount | SUM(amount) WHERE status IN (FULFILLED, CLOSED) | FULFILLED or CLOSED | createdAt | Order.currency | Marketplace | Command Center, Analytics | — |
| Collected GMV | Paid amount from non-NEW/CANCELLED | AnalyticsService | order.Order.paidAmount | SUM(paidAmount) WHERE status NOT IN (NEW, CANCELLED) | Excludes NEW, CANCELLED | createdAt | Order.currency | Marketplace | Command Center, Analytics | — |
| Outstanding GMV | Qualified - Collected | AnalyticsService | derived | qualifiedGmv - collectedGmv | — | — | — | Marketplace | Command Center, Analytics | — |
| AOV | Average Order Value | AnalyticsService | order.Order.amount | SUM(amount) / COUNT(FULFILLED) | status=FULFILLED | createdAt | — | Marketplace | Command Center, Analytics | — |

### 6.2 Bookings Domain

| KPI | Definition | Authority | Source | Formula | Status Inclusion | Timestamp | Currency | Scope | Consumers | Intentional Variation |
|---|---|---|---|---|---|---|---|---|---|---|
| Bookings Requested | Total Bookings in period | AnalyticsService | booking.Booking | COUNT(*) WHERE acquisitionSource=MARKETPLACE | All statuses (cohort) | createdAt | — | Marketplace | Command Center, Analytics | — |
| Bookings Confirmed | Bookings with status CONFIRMED | AnalyticsService | booking.Booking | COUNT(*) WHERE status=CONFIRMED | status=CONFIRMED | createdAt | — | Marketplace | Command Center, Analytics | — |
| Bookings Completed | Bookings with status COMPLETED | AnalyticsService | booking.Booking | COUNT(*) WHERE status=COMPLETED | status=COMPLETED | createdAt | — | Marketplace | Command Center, Analytics | — |
| Bookings Total (Registry) | Total Bookings in overview scope | BookingService | booking.Booking | COUNT(*) via overviewWhere | All statuses | createdAt | — | Overview (all sources) | Bookings Center | Different scope than Analytics |
| Booking Completion Rate | Completed / Total Bookings | AnalyticsService | derived | completedBookings / totalBookings | All statuses | — | — | Marketplace | Partner Performance | Only in Partner Performance |

### 6.3 Financial Domain

| KPI | Definition | Authority | Source | Formula | Status Inclusion | Timestamp | Currency | Scope | Consumers | Intentional Variation |
|---|---|---|---|---|---|---|---|---|---|---|
| Revenue | Total captured payments | AnalyticsService | finance.Payment.amount | SUM(amount) WHERE status=CAPTURED | status=CAPTURED | paidAt | Payment.currency | Marketplace | Command Center, Analytics | — |
| Net Revenue | Revenue - Refunds | AnalyticsService | derived | revenue - refunds | — | — | — | Marketplace | Command Center, Analytics | — |
| Payments Captured | Count of captured payments | AnalyticsService | finance.Payment | COUNT(*) WHERE status=CAPTURED | status=CAPTURED | createdAt | — | Marketplace | Command Center, Analytics | — |
| Refunds Total | Total refund amount | AnalyticsService | finance.Refund.amount | SUM(amount) | All statuses | createdAt | Refund.currency | Marketplace | Command Center, Analytics | — |
| Refunds Processed | Count of processed refunds | AnalyticsService | finance.Refund | COUNT(*) WHERE status=PROCESSED | status=PROCESSED | createdAt | — | Marketplace | Command Center, Analytics | — |
| Commission Accrued | Total commission accrued | AnalyticsService | finance.Commission.amount | SUM(amount) WHERE status=ACCRUED | status=ACCRUED | createdAt | Commission.currency | Marketplace | Command Center, Analytics | — |
| Financial Reconciliation | Per-currency payment/refund/commission | AnalyticsService | finance.* | Per-currency aggregation | Per-entity status | createdAt | Per-currency | Marketplace | Analytics | — |

### 6.4 Partner Domain

| KPI | Definition | Authority | Source | Formula | Status Inclusion | Timestamp | Currency | Scope | Consumers | Intentional Variation |
|---|---|---|---|---|---|---|---|---|---|---|
| Partner Orders | Orders per Partner | AnalyticsService (D10) | order.Order.sellerPartnerId | COUNT(*) WHERE acquisitionSource=MARKETPLACE | All statuses | createdAt | — | Marketplace | Partner Performance | — |
| Partner GMV | GMV per Partner | AnalyticsService (D10) | order.Order.amount + sellerPartnerId | SUM(amount) | All statuses | createdAt | Order.currency | Marketplace | Partner Performance | — |
| Partner Bookings | Bookings per Partner | AnalyticsService (D10) | booking.Booking → Order.sellerPartnerId | COUNT(*) | All statuses | createdAt | — | Marketplace | Partner Performance | — |
| Partner Revenue | Revenue per Partner | AnalyticsService (D10) | finance.Payment → orderId → sellerPartnerId | SUM(amount) WHERE CAPTURED | status=CAPTURED | paidAt | Payment.currency | Marketplace | Partner Performance | — |
| Partner Commission | Commission per Partner | AnalyticsService (D10) | finance.Commission.partnerId | SUM(amount) | All statuses | createdAt | Commission.currency | Marketplace | Partner Performance | — |
| Active Products | Published products per Partner | AnalyticsService | catalog.Product.partnerId | COUNT(*) WHERE status=PUBLISHED | status=PUBLISHED | — | — | Marketplace | Partner Performance | Current ownership, not historical |
| Partner Completion Rate | Completed / Total Bookings per Partner | AnalyticsService (D10) | derived | completedBookings / totalBookings | — | — | — | Marketplace | Partner Performance | — |

### 6.5 Customers / CRM Domain

| KPI | Definition | Authority | Source | Formula | Status Inclusion | Timestamp | Currency | Scope | Consumers | Intentional Variation |
|---|---|---|---|---|---|---|---|---|---|---|
| Active Customers (Marketplace) | Unique buyers via Marketplace | AnalyticsService | order.Order.customerId | COUNT(DISTINCT customerId) WHERE acquisitionSource=MARKETPLACE | All statuses | createdAt | — | Marketplace | Command Center, Analytics | — |
| Active Customers (Storefront) | Unique buyers via Storefront | AnalyticsService | order.Order.customerId | COUNT(DISTINCT customerId) WHERE acquisitionSource=PARTNER_STOREFRONT | All statuses | createdAt | — | Storefront | Command Center, Analytics | — |
| Total Active Customers | Union of above | AnalyticsService | derived | Union | — | — | — | All | Command Center, Analytics | — |

### 6.6 Behavioral / Sessions Domain

| KPI | Definition | Authority | Source | Formula | Status Inclusion | Timestamp | Currency | Scope | Consumers | Intentional Variation |
|---|---|---|---|---|---|---|---|---|---|---|
| Marketplace Sessions | Unique sessions in Marketplace | AnalyticsService | catalog.MarketplaceBehavioralEvent | COUNT(DISTINCT sessionId) | — | occurredAt | — | Marketplace | Command Center, Analytics | — |
| Storefront Sessions | Unique sessions in Storefront | AnalyticsService | catalog.StorefrontBehavioralEvent | COUNT(DISTINCT sessionId) | — | occurredAt | — | Storefront | Command Center, Analytics | — |
| Marketplace Visitors | Unique visitors in Marketplace | AnalyticsService | catalog.MarketplaceBehavioralEvent | COUNT(DISTINCT visitorId) | — | occurredAt | — | Marketplace | Command Center, Analytics | — |
| Marketplace Visits | Unique visits in Marketplace | AnalyticsService | catalog.MarketplaceBehavioralEvent | COUNT(DISTINCT sessionId) | — | occurredAt | — | Marketplace | Command Center, Analytics | — |
| Active Partners (Marketplace) | Partners with published products | AnalyticsService | catalog.Product.partnerId | COUNT(DISTINCT partnerId) WHERE PUBLISHED | status=PUBLISHED | — | — | Marketplace | Command Center, Analytics | — |
| Active Partners (Storefront) | Partners with active storefronts | AnalyticsService | crm.Partner via Storefront | COUNT(DISTINCT partnerId) | — | — | — | Storefront | Command Center, Analytics | — |
| Total Active Partners | Union of above | AnalyticsService | derived | Union | — | — | — | All | Command Center, Analytics | — |

---

## 7. Status Dictionary

### 7.1 OrderStatus

| Value | Business Meaning | Lifecycle Position | Terminal? | KPI Inclusion |
|---|---|---|---|---|
| NEW | Order created, awaiting processing | Initial | No | Included in Orders Created, GMV (cohort) |
| IN_PROCESSING | Order being processed by operations | Early | No | Included |
| WAITING_FOR_DATA | Waiting for traveler data | Early | No | Included |
| READY_FOR_BOOKING | Ready to create Booking | Mid | No | Included |
| SENT_TO_BOOKING | Booking request sent | Mid | No | Included |
| PARTIALLY_FULFILLED | Some items fulfilled | Late | No | Included |
| FULFILLED | Order fulfilled by supplier | Late-success | No | Included in Orders Fulfilled |
| READY_TO_CLOSE | Ready to close | Pre-terminal | No | Included |
| CLOSED | Order closed (completed) | Terminal-success | Yes | Included in Completed GMV |
| CANCELLED | Order cancelled | Terminal-failure | Yes | Excluded from Qualified GMV |
| PROBLEM | Order has operational problem | Exception | No | Included |
| SUSPENDED | Order suspended | Exception | No | Included |

### 7.2 BookingStatus

| Value | Business Meaning | Lifecycle Position | Terminal? | KPI Inclusion |
|---|---|---|---|---|
| NEW | Booking created | Initial | No | Included in Bookings Requested |
| PREPARING_REQUEST | Preparing supplier request | Early | No | Included |
| SENT_TO_SUPPLIER | Request sent to supplier | Early | No | Included |
| AWAITING_CONFIRMATION | Waiting for supplier response | Mid | No | Included |
| CONFIRMED | Supplier confirmed | Mid-success | No | Included in Bookings Confirmed |
| IN_SERVICE | Service in progress | Active | No | Included |
| COMPLETED | Service completed | Terminal-success | Yes | Included in Bookings Completed |
| NEEDS_CLARIFICATION | Supplier needs more info | Exception | No | Included |
| SUPPLIER_REJECTED | Supplier rejected | Terminal-failure | Yes | Included |
| CHANGE_REQUESTED | Change requested | Exception | No | Included |
| CANCELLATION_REQUESTED | Cancellation requested | Exception | No | Included |
| CANCELLED | Booking cancelled | Terminal-failure | Yes | Included |
| PROBLEM | Operational problem | Exception | No | Included |

### 7.3 PaymentStatus

| Value | Business Meaning | Lifecycle Position | Terminal? | KPI Inclusion |
|---|---|---|---|---|
| PENDING | Payment initiated | Initial | No | Included in Payments (count) |
| AUTHORIZED | Payment authorized by PSP | Mid | No | Included |
| CAPTURED | Payment successfully captured | Terminal-success | Yes | Included in Revenue, Payments Captured |
| FAILED | Payment failed | Terminal-failure | Yes | Included (count only, not Revenue) |
| CANCELLED | Payment cancelled | Terminal-failure | Yes | Included (count only, not Revenue) |
| REFUNDED | Payment refunded | Terminal-refund | Yes | Included (count only, not Revenue) |

### 7.4 RefundStatus

| Value | Business Meaning | Lifecycle Position | Terminal? | KPI Inclusion |
|---|---|---|---|---|
| REQUESTED | Refund requested | Initial | No | Included in Refunds (count) |
| APPROVED | Refund approved | Mid | No | Included |
| PROCESSED | Refund processed | Terminal-success | Yes | Included in Refunds Processed, Refunds Total |
| FAILED | Refund failed | Terminal-failure | Yes | Included (count only, not Refunds Total) |

### 7.5 CommissionStatus

| Value | Business Meaning | Lifecycle Position | Terminal? | KPI Inclusion |
|---|---|---|---|---|
| ACCRUED | Commission accrued | Initial | No | Included in Commission Accrued |
| INVOICED | Commission invoiced | Mid | No | Included |
| PAID | Commission paid | Terminal-success | Yes | Included |

### 7.6 RequestStatus

| Value | Business Meaning | Lifecycle Position | Terminal? | KPI Inclusion |
|---|---|---|---|---|
| NEW | Request created | Initial | No | Included in Requests |
| CHECKING | Request being checked | Early | No | Included |
| SUPPLIER_TIMEOUT | Supplier did not respond | Exception | No | Included |
| PRICE_CHANGED | Supplier changed price | Mid | No | Included |
| CUSTOMER_ACCEPTED | Customer accepted price | Mid | No | Included |
| CONFIRMED | Request confirmed | Mid-success | No | Included |
| CONVERTED | Converted to Order | Terminal-success | Yes | Included |
| REJECTED | Request rejected | Terminal-failure | Yes | Included |
| UNAVAILABLE | Service unavailable | Terminal-failure | Yes | Included |
| EXPIRED | Request expired | Terminal-failure | Yes | Included |
| CUSTOMER_PAYMENT_TIMEOUT | Customer payment timed out | Terminal-failure | Yes | Included |
| CANCELLED_BY_CUSTOMER | Customer cancelled | Terminal-failure | Yes | Included |

---

## 8. Cross-Center Matrix

### 8.1 Command Center ↔ Analytics Center

| KPI | Command Source | Analytics Source | Same Meaning? | Same Source? | Same Formula? | Same Timestamp? | Same Scope? | Status |
|---|---|---|---|---|---|---|---|---|
| GMV | AnalyticsService | AnalyticsService | ✅ | ✅ | ✅ | ✅ | ✅ | CONSISTENT |
| Revenue | AnalyticsService | AnalyticsService | ✅ | ✅ | ✅ | ✅ | ✅ | CONSISTENT |
| Net Revenue | AnalyticsService | AnalyticsService | ✅ | ✅ | ✅ | ✅ | ✅ | CONSISTENT |
| Orders Created | AnalyticsService | AnalyticsService | ✅ | ✅ | ✅ | ✅ | ✅ | CONSISTENT |
| Orders Fulfilled | AnalyticsService | AnalyticsService | ✅ | ✅ | ✅ | ✅ | ✅ | CONSISTENT |
| Bookings Requested | AnalyticsService | AnalyticsService | ✅ | ✅ | ✅ | ✅ | ✅ | CONSISTENT |
| Bookings Confirmed | AnalyticsService | AnalyticsService | ✅ | ✅ | ✅ | ✅ | ✅ | CONSISTENT |
| Bookings Completed | AnalyticsService | AnalyticsService | ✅ | ✅ | ✅ | ✅ | ✅ | CONSISTENT |
| Payments Captured | AnalyticsService | AnalyticsService | ✅ | ✅ | ✅ | ✅ | ✅ | CONSISTENT |
| Refunds Processed | AnalyticsService | AnalyticsService | ✅ | ✅ | ✅ | ✅ | ✅ | CONSISTENT |
| Commission Accrued | AnalyticsService | AnalyticsService | ✅ | ✅ | ✅ | ✅ | ✅ | CONSISTENT |
| AOV | AnalyticsService | AnalyticsService | ✅ | ✅ | ✅ | ✅ | ✅ | CONSISTENT |

### 8.2 Analytics Center ↔ Orders/Bookings Centers

| KPI | Analytics Source | Registry Source | Same Meaning? | Same Scope? | Status |
|---|---|---|---|---|---|
| Orders Created | COUNT WHERE acquisitionSource=MARKETPLACE | COUNT via overviewOrderWhere() | ⚠️ Same metric, different scope | ⚠️ Marketplace vs Overview | INTENTIONAL SCOPE DIFFERENCE |
| Bookings Requested | COUNT WHERE acquisitionSource=MARKETPLACE | COUNT via overviewWhere | ⚠️ Same metric, different scope | ⚠️ Marketplace vs Overview | INTENTIONAL SCOPE DIFFERENCE |

**Explanation:** Analytics Center shows Marketplace-scoped KPIs for platform performance monitoring. Orders/Bookings Centers show operational-scope KPIs for daily work across all channels. This is by design, not a discrepancy.

### 8.3 Analytics Center ↔ Partner Performance

| KPI | Analytics Source | Partner Source | Same Meaning? | Same Attribution? | Status |
|---|---|---|---|---|---|
| GMV | Order.amount (MARKETPLACE) | Order.sellerPartnerId + amount | ✅ | ✅ (D10 aligned) | CONSISTENT |
| Revenue | Payment.amount (CAPTURED) | Payment → orderId → sellerPartnerId | ✅ | ✅ (D10 aligned) | CONSISTENT |
| Commission | Commission.amount | Commission.partnerId | ✅ | ✅ (D10 aligned) | CONSISTENT |

---

## 9. Intentional Scope Differences

### 9.1 Marketplace vs Overview Scope

```text
Analytics Center / Command Center:
    Scope: acquisitionSource = MARKETPLACE
    Purpose: Platform performance monitoring
    Authority: AnalyticsService.getCompanyKpi()

Orders / Bookings Center:
    Scope: Overview (all acquisition sources within filters)
    Purpose: Operational registry
    Authority: DB groupBy via overviewOrderWhere() / overviewWhere

This is NOT a discrepancy.
This is NOT a KPI inconsistency.
This is intentional architecture.
```

### 9.2 Revenue vs Financial Reconciliation

```text
Analytics Center Revenue:
    Scope: Total revenue (single primary currency display)
    Authority: AnalyticsService.getCompanyKpi()

Financial Reconciliation:
    Scope: Per-currency breakdown
    Authority: AnalyticsService.getFinancialReconciliation()

Same source data, different presentation.
```

---

## 10. D10 Boundary

```text
D10 = Partner attribution semantics
    → which Partner gets which metric

D11 = Project-wide KPI/status semantics
    → how same KPI is interpreted across centers

D11 consumes D10's canonical attribution:
    Partner Performance → Order.sellerPartnerId (frozen)

D11 does NOT:
    → rewrite Partner attribution
    → change D10 implementation
    → use Product.partnerId as historical attribution
```

---

## 11. Finance Boundary

```text
D11 documents/reconciles existing financial KPI semantics.
D11 does NOT create financial authority.

Finance remains: NOT STARTED / DEFERRED

D11 allowed:
    → document Revenue, Commission, Refund semantics
    → reconcile Financial Reconciliation presentation

D11 forbidden:
    → Settlement, Payout, Payment engine, Refund engine
    → new financial rules
    → Commission rule redesign
```

---

## 12. DATA-01 Residual

```text
DATA-01 status: CLOSED
Residual: Full read-model verification assigned to D11

D11 verification:
    KPI↔filter consistency: spec-proven at D8 reconciliation
    reconciliationRule/drillDown in registries: implemented
    popover contracts: implemented
    KPI/table scope parity: verified

Residual classification: NON-BLOCKING
    Contract-mechanism KPI↔filter consistency is implemented
    Full read-model verification is documentation-level
    No semantic contradiction found

Follow-up: None required — documentation closes residual
```

---

## 13. Ownership / Change Governance

```text
KPI Authority Owner: AnalyticsService (backend)
Status Authority Owner: Prisma schema enums
Temporal Authority Owner: D8 (resolveQueryPeriod)
Partner Attribution Owner: D10 (Order.sellerPartnerId)

Change process:
    1. Propose change with evidence
    2. Identify affected centers/APIs/KPIs
    3. Update this semantic contract
    4. Provide migration impact assessment
    5. Get approval
    6. Implement with regression evidence
```

---

## 14. Known Gaps

| ID | Severity | Description | Follow-up |
|---|---|---|---|
| D11-G1 | LOW | Booking Completion Rate only in Partner Performance, not company-wide | Future enhancement if needed |
| D11-G2 | INFO | Orders/Bookings Center Overview scope not documented in UI labels | UX consideration |

---

## 15. Evidence Sources

| Source | Location |
|---|---|
| AnalyticsService | `backend/src/modules/analytics/analytics.service.ts` |
| DashboardService | `backend/src/modules/dashboard/dashboard.service.ts` |
| OrderService | `backend/src/modules/order/order.service.ts` |
| BookingService | `backend/src/modules/booking/booking.service.ts` |
| Schema enums | `backend/prisma/schema.prisma` |
| D10 attribution | `docs/architecture/d10-partner-attribution-semantics.md` |
| D8 temporal | D8 qualification reports |
| Scope Audit | `docs/reports/evidence/PHASE_3_D11_PROJECT_WIDE_KPI_STATUS_SEMANTICS_SCOPE_AUDIT.md` |
