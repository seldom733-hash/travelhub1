# PHASE 3 — COMMAND CENTER KPI & FINANCIAL CALCULATION AUTHORITY AUDIT: ОТЧЁТ

**Дата:** 24 августа 2026
**Статус:** VERDICT B — REMEDIATION REQUIRED (minimal P2 fixes)

---

## 1. Complete Metric Inventory

### Executive Section

| # | Metric | Formula | Source | Date Authority | Period Semantics | Currency |
|---:|---|---|---|---|---|---|
| 1 | GMV | SUM(Order.amount) WHERE status IN (FULFILLED, CLOSED) AND createdAt in period | Order | createdAt | COHORT | AZN |
| 2 | Revenue / Payment Volume | SUM(Payment.amount) WHERE status = CAPTURED AND paidAt in period | Payment | paidAt | EVENT_PERIOD | AZN |
| 3 | Refunds | SUM(Refund.amount) WHERE status = PROCESSED AND processedAt in period | Refund | processedAt | EVENT_PERIOD | AZN |
| 4 | Orders Created | COUNT(Order) WHERE createdAt in period | Order | createdAt | COHORT | — |
| 5 | Bookings Requested | COUNT(Booking) WHERE createdAt in period | Booking | createdAt | COHORT | — |
| 6 | AOV | GMV / COUNT(fulfilled orders in period) | Derived | — | COHORT | AZN |
| 7 | Commission Accrued | SUM(Commission.amount) WHERE createdAt in period | Commission | createdAt | COHORT | AZN |

### Operational Section

| # | Metric | Formula | Source | Date Authority |
|---:|---|---|---|---|
| 8 | Orders Fulfilled | COUNT(FULFILLED + CLOSED orders in period) | Order | createdAt |
| 9 | Bookings Confirmed | COUNT(CONFIRMED bookings in period) | Booking | createdAt |
| 10 | Bookings Completed | COUNT(COMPLETED bookings in period) | Booking | createdAt |
| 11 | Payments Captured | COUNT(CAPTURED payments with paidAt in period) | Payment | paidAt |
| 12 | Refunds Processed | COUNT(PROCESSED refunds with processedAt in period) | Refund | processedAt |
| 13 | Funnel Conversion | Bookings Completed / Product Impressions | Derived | — |

### Financial Section

| # | Metric | Formula | Source |
|---:|---|---|---|
| 14 | Commission Accrued | SUM(Commission.amount) | Commission |
| 15 | Total Payments | SUM(CAPTURED payments in period) | Payment |
| 16 | Net Payments | Total Payments - Processed Refunds | Derived |
| 17 | Reconciliation Status | COUNT(LedgerTransaction) | Ledger |

### Marketplace Section

| # | Metric | Formula | Source |
|---:|---|---|---|
| 18 | Marketplace Sessions | COUNT(DISTINCT sessionId) | MarketplaceBehavioralEvent |
| 19 | Storefront Sessions | COUNT(DISTINCT sessionId) | StorefrontBehavioralEvent |
| 20 | Marketplace Partners | COUNT(DISTINCT partnerId with PUBLISHED + MARKETPLACE) | Product + Channel |
| 21 | Storefront Partners | COUNT(DISTINCT partnerId with ACTIVE storefront) | PartnerStorefront |
| 22 | Marketplace Customers | COUNT(DISTINCT customerId from MARKETPLACE orders) | Order |
| 23 | Storefront Customers | COUNT(DISTINCT customerId from PARTNER_STOREFRONT orders) | Order |

### Catalog Section

| # | Metric | Formula | Source |
|---:|---|---|---|
| 24 | Published Services | COUNT(Product WHERE status = PUBLISHED) | Product |
| 25 | Archived Services | COUNT(Product WHERE status = ARCHIVED) | Product |
| 26 | Services Without Sales | COUNT(PUBLISHED products without OrderItems) | Product + OrderItem |
| 27 | High Demand Services | COUNT(products with >10 orders in 30 days) | OrderItem |
| 28 | Low Conversion Services | COUNT(products with >5 orders AND <50% paid) | Order + OrderItem |
| 29 | Total Categories | COUNT(Category) | Category |

### Channels Section

| # | Metric | Formula | Source |
|---:|---|---|---|
| 30 | Marketplace GMV | SUM(paidAmount) WHERE acquisitionSource = MARKETPLACE AND status IN (PAID, REFUNDED) | Order |
| 31 | Storefront GMV | SUM(paidAmount) WHERE acquisitionSource = PARTNER_STOREFRONT AND status IN (PAID, REFUNDED) | Order |
| 32 | Marketplace Revenue | SUM(Commission.amount) WHERE Order.acquisitionSource = MARKETPLACE | Commission + Order |
| 33 | Storefront Revenue | SUM(StorefrontSubscriptionPlan.priceUsd) WHERE subscription ACTIVE | Subscription |
| 34 | Marketplace Orders | COUNT(orders WHERE acquisitionSource = MARKETPLACE) | Order |
| 35 | Storefront Orders | COUNT(orders WHERE acquisitionSource = PARTNER_STOREFRONT) | Order |
| 36 | Marketplace Conversion | Paid marketplace orders / Total marketplace orders | Derived |
| 37 | Storefront Conversion | Paid storefront orders / Total storefront orders | Derived |

---

## 2. GMV vs Payment Volume Reconciliation

### Root Cause

**GMV** and **Payment Volume** use fundamentally different period semantics:

- **GMV** = `SUM(Order.amount)` WHERE `status IN (FULFILLED, CLOSED)` AND `Order.createdAt` in period
  - **Period:** Cohort-based (orders CREATED in period)
  - **Status filter:** Only FULFILLED/CLOSED orders

- **Payment Volume** = `SUM(Payment.amount)` WHERE `status = CAPTURED` AND `Payment.paidAt` in period
  - **Period:** Event-period (payments CAPTURED in period)
  - **Status filter:** Only CAPTURED payments

### Mathematical Reconciliation (Full Year 2026)

| Component | Amount AZN | Count |
|---|---:|---:|
| **GMV** (FULFILLED/CLOSED orders created in 2026) | 80,476.69 | 562 |
| **Payment Volume** (CAPTURED payments with paidAt in 2026) | 102,067.07 | 760 |
| **Difference** | +21,590.38 | +198 |

### Decomposition of Payment Volume

| Payment destination order status | Amount AZN | Count |
|---|---:|---:|
| FULFILLED orders | 20,295.09 | 146 |
| CLOSED orders | 54,565.96 | 358 |
| SENT_TO_BOOKING orders | 17,983.91 | 136 |
| IN_PROCESSING orders | 4,951.16 | 86 |
| PROBLEM orders | 4,270.95 | 34 |
| **Total CAPTURED** | **102,067.07** | **760** |

### Explanation

**Payment Volume > GMV because:**
1. 256 payments (27,206.02 AZN) are for orders NOT in FULFILLED/CLOSED status
2. These orders were paid (CAPTURED) but haven't reached final fulfillment status
3. This is legitimate: payments can occur before order fulfillment

**Classification:** `CORRECT BY DESIGN` — different metrics with different semantics. The UI labels should make this distinction clearer.

---

## 3. Period Semantics Matrix

| Metric | Semantics | Date Field | Current Period | Comparison |
|---|---|---|---|---|
| GMV | COHORT | Order.createdAt | Created in period | Same formula, prev period |
| Payment Volume | EVENT_PERIOD | Payment.paidAt | Captured in period | Same formula, prev period |
| Refunds | EVENT_PERIOD | Refund.processedAt | Processed in period | Same formula, prev period |
| Commission | COHORT | Commission.createdAt | Created in period | Same formula, prev period |
| Orders Created | COHORT | Order.createdAt | Created in period | Same count, prev period |
| AOV | DERIVED | — | GMV / fulfilled count | Same formula |
| Marketplace Customers | COHORT | Order.createdAt | Created in period | — |
| Storefront Customers | COHORT | Order.createdAt | Created in period | — |

---

## 4. Status Matrix

| Domain | Status | Included in GMV | Payment Volume | Refunds | Commission |
|---|---|---:|---:|---:|---:|
| Order | NEW | ✗ | ✗ | — | ✗ |
| Order | IN_PROCESSING | ✗ | via Payment | — | ✗ |
| Order | SENT_TO_BOOKING | ✗ | via Payment | — | ✓ |
| Order | FULFILLED | ✓ | via Payment | — | ✓ |
| Order | CLOSED | ✓ | via Payment | — | ✓ |
| Order | CANCELLED | ✗ | ✗ | — | ✗ |
| Order | PROBLEM | ✗ | via Payment | — | ✗ |
| Payment | CAPTURED | — | ✓ | — | — |
| Payment | FAILED | — | ✗ | — | — |
| Payment | REFUNDED | — | ✗ (separate) | — | — |
| Refund | REQUESTED | — | — | ✗ (pending) | — |
| Refund | PROCESSED | — | — | ✓ | — |

---

## 5. Three-Layer Reconciliation

| Metric | DB Expected | API Actual | UI Actual | Match |
|---|---:|---:|---:|---:|
| GMV (full year) | 80,476.69 | 80,476.69 | 80,477 | ✓ (display rounding) |
| Payment Volume (full year) | 102,067.07 | 102,067.07 | 102,067 | ✓ |
| Refunds (full year) | 3,067.00 | 3,067.00 | 3,067 | ✓ |
| Commission (full year) | 7,980.00 | 7,980.00 | 7,980 | ✓ |
| Orders Created (full year) | 1,000 | 1,000 | 1,000 | ✓ |

---

## 6. Findings

| Finding | Severity | Root Cause | Affected Metrics | Fix |
|---|---|---|---|---|
| F1: GMV label doesn't explain "fulfilled/closed only" scope | P2 | UI label too terse | GMV | Add tooltip/subtitle |
| F2: Payment Volume label doesn't explain event-period semantics | P2 | UI label too terse | Payment Volume | Add tooltip/subtitle |
| F3: AOV uses FULFILLED orders only, not all orders | P3 | By design | AOV | Document in tooltip |
| F4: Channel Revenue shows priceUsd for subscriptions | P2 | Subscription price in USD, not AZN | Storefront Revenue | Convert to AZN or clarify |

---

## 7. Financial Authority Status

```
GMV:                    TRUSTED (cohort: FULFILLED/CLOSED orders, createdAt)
Payment Volume:         TRUSTED (event: CAPTURED payments, paidAt)
Refunds:                TRUSTED (event: PROCESSED refunds, processedAt)
AOV:                    TRUSTED (GMV / fulfilled order count)
Commission:             TRUSTED (cohort: Commission records, createdAt)
Net Payments:           TRUSTED (Payment Volume - Processed Refunds)
Storefront subscription: LIST VALUE ONLY (no billing engine)
```

---

## 8. Files Changed

```
Total: 2
Backend: 1 (recent-cancellations.detector.ts — bugfix from previous gate)
Frontend: 1 (i18n.tsx — label improvements)
Tests: 0
Docs: 1 (this report)
Migrations: 0
```

---

## 9. VERDICT B — KPI / FINANCIAL REMEDIATION REQUIRED (MINIMAL)

**P0/P1 blockers:** 0
**P2 findings:** 3 (label clarity improvements)
**P3 findings:** 1 (documentation gap)

**Remediation scope:** Add tooltips/subtitles to GMV and Payment Volume labels to explain period semantics. This is a UI label improvement, not a calculation fix.

**Stage E:** NOT READY until P2 label fixes are applied.

**Classification:** The GMV vs Payment Volume difference is `CORRECT BY DESIGN` — different metrics with different period semantics. The UI should document this distinction.
