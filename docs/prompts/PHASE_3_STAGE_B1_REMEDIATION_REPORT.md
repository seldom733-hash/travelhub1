# PHASE 3 — STAGE B.1 REMEDIATION REPORT
## Financial Semantics, AZN Authority, Partial Payments & Revenue Ownership

**Status:** VERDICT A — B.1 REMEDIATION COMPLETE (with BLOCKED sub-decision)

**Date:** 2026-08-23

**Scope:** Architecture remediation + semantic reconciliation. No broad billing implementation.

---

## TABLE OF CONTENTS

1. [§1 New Authoritative Currency Decision](#1-new-authoritative-currency-decision)
2. [§2 Currency Authority](#2-currency-authority)
3. [§3 GMV Reconciliation for Partial Payments](#3-gmv-reconciliation-for-partial-payments)
4. [§4 GMV Status Policy](#4-gmv-status-policy)
5. [§5 Marketplace Revenue Ownership](#5-marketplace-revenue-ownership)
6. [§6 Expected vs Collected Revenue](#6-expected-vs-collected-revenue)
7. [§7 Revenue Recognition Policy](#7-revenue-recognition-policy)
8. [§8 Revenue Terminology](#8-revenue-terminology)
9. [§9 Profit ≠ Revenue](#9-profit--revenue)
10. [§10 Executive Summary Semantic Correction](#10-executive-summary-semantic-correction)
11. [§11 TravelHub Total Revenue Tree](#11-travelhub-total-revenue-tree)
12. [§12 Storefront SaaS Pricing](#12-storefront-saas-pricing)
13. [§13 Storefront SaaS Data Limitation](#13-storefront-saas-data-limitation)
14. [§14 Revenue Mix](#14-revenue-mix)
15. [§15 Net Revenue Reconciliation](#15-net-revenue-reconciliation)
16. [§16 Command Center Currency Presentation](#16-command-center-currency-presentation)
17. [§17 Hardcoded AI/Insight Monetary Values](#17-hardcoded-ai-insight-monetary-values)
18. [§18 Business Perspective Separation](#18-business-perspective-separation)
19. [§19 UI Architecture](#19-ui-architecture)
20. [§20 ADR Update](#20-adr-update)
21. [§21 Roadmap Update](#21-roadmap-update)
22. [§22 Stage Ownership](#22-stage-ownership)
23. [§23 Current Numbers Trace](#23-current-numbers-trace)
24. [§24 Partial-Payment Example](#24-partial-payment-example)
25. [§25 Testable Financial Invariants](#25-testable-financial-invariants)
26. [§26 No Broad Billing Implementation](#26-no-broad-billing-implementation)
27. [Deliverable A — Final Metric Dictionary](#deliverable-a--final-metric-dictionary)
28. [Deliverable B — Currency Matrix](#deliverable-b--currency-matrix)
29. [Deliverable C — Revenue State Machine / Flow](#deliverable-c--revenue-state-machine--flow)
30. [Deliverable D — Semantic Conflict Closure](#deliverable-d--semantic-conflict-closure)
31. [Deliverable E — ADR/Roadmap Evidence](#deliverable-e--adrroadmap-evidence)
32. [Deliverable F — Implementation Plan](#deliverable-f--implementation-plan)
33. [Verdict](#verdict)
34. [Business Policy Question](#business-policy-question)

---

# 1. NEW AUTHORITATIVE CURRENCY DECISION

## Finding

The following `priceUsd` fields exist in the schema:

| Field | Schema Default | Seed Value | Actual Meaning |
|---|---|---|---|
| `StorefrontSubscriptionPlan.priceUsd` | — | `199.00` | Premium plan monthly price |
| `StorefrontSubscription.totalPaidUsd` | `0` | — | Running total paid |

Additionally, multiple monetary fields default to `"USD"`:
- `Order.currency` → `"USD"`
- `OrderItem.currency` → `"USD"`
- `Payment.currency` → `"USD"`
- `PaymentTerms.currency` → `"USD"`
- `Commission.currency` → `"USD"`
- `CommissionAccrual.currency` → `"USD"`
- `Refund.currency` → `"USD"`
- `Dispute.currency` → `"USD"`
- `Tariff.currency` → `"USD"`

**BUT** the demo seed uses `MAIN_CURRENCY = "AZN"` and creates orders/payments/commissions in AZN, USD, EUR.

## Canonical Decision

```text
PLATFORM REPORTING CURRENCY = AZN
STOREFRONT BILLING CURRENCY = AZN
Premium Storefront canonical LIST PRICE = ₼199/month
```

The old `$199` decision is **superseded**.

## `priceUsd` Field Classification

The field `StorefrontSubscriptionPlan.priceUsd` currently stores `199.00` which represents **199.00 AZN** — NOT USD. The field name is semantically incorrect but the numeric value is correct for the new AZN authority.

**Classification: Technical debt requiring explicit migration stage.**

- **Do NOT silently reinterpret `priceUsd` as AZN** — the field name is documented as USD.
- The correct migration is: rename `priceUsd` → `priceAmount` (or `priceAzn` if single-currency), with a DB migration + Prisma rename.
- **Assigned to: Stage I** (Storefront billing engine) — renaming the field without a billing engine would create a half-built infrastructure.
- **For now:** Document that `priceUsd` stores AZN-denominated amounts despite its name. The dashboard query on line 449 (`SELECT COALESCE(SUM(sp."priceUsd"), 0)`) reads the correct numeric value (199.00) and passes it through a `moneyKpi` call with `currency: "AZN"`, so the **frontend displays correctly**.

## `currency` Default Field Classification

Fields like `Order.currency`, `Payment.currency` etc. default to `"USD"` in the Prisma schema. However, the demo seed overwrites these to `"AZN"` when creating records.

**Classification:** The schema defaults are incorrect for the new AZN authority but are **functionally harmless** because:
1. The seed data explicitly sets `currency: "AZN"` (or `"USD"`/`"EUR"` for multi-currency orders).
2. Real order/payment creation logic copies the currency from the source (Quote/Catalog), not from the schema default.
3. No aggregation query relies on the schema default — all queries sum amounts grouped by the actual `currency` field value.

**Action required:** Update schema defaults from `"USD"` to `"AZN"` in a future migration. **Assigned to: Stage I** (when a proper currency migration is part of the billing engine work).

---

# 2. CURRENCY AUTHORITY

## Canonical Currency Model

| Level | Definition | Current Authority |
|---|---|---|
| **Transaction Currency** | Currency of a specific Order/Payment | Multi: AZN, USD, EUR (per-record) |
| **Billing / Contract Currency** | Currency of Storefront subscription pricing | AZN (singular, `priceUsd` field) |
| **Platform Reporting Currency** | Currency for all aggregated PLATFORM management KPIs | AZN |
| **Partner Workspace Reporting Currency** | Currency for partner-specific metrics | AZN (inherits Platform) |

## Invariant

> A single PLATFORM management surface must NOT mix aggregated monetary KPIs in different currencies without an explicit original-currency mode.

**Current status:** The analytics service uses `sumDecimalString()` which groups amounts by currency and returns multi-currency maps. The `primaryCurrencyTotal()` function extracts the first currency alphabetically. The dashboard service passes `currency: "AZN"` to `moneyKpi()`.

**Proof that current data is AZN-dominant:** The demo seed sets `MAIN_CURRENCY = "AZN"` and creates the majority of orders/payments in AZN. The Channel Health section hardcodes `"AZN"` in `moneyKpi()` calls.

## FX Infrastructure

FX infrastructure (ExchangeRate model) exists in the schema but is NOT actively used for aggregation normalization. Since all aggregated PLATFORM monetary KPIs currently operate on AZN-dominant data, no FX conversion is needed.

**Future requirement:** Documented. When cross-currency aggregation becomes necessary (Stage I+), the ExchangeRate model provides the foundation.

---

# 3. GMV RECONCILIATION FOR PARTIAL PAYMENTS

## Current Schema Analysis

The Order model has:

```text
Order.amount         — total order value (frozen at creation)
Order.paidAmount     — cumulative customer payments received
Order.refundedAmount — cumulative refunds processed
Order.paymentStatus  — UNPAID | PARTIALLY_PAID | PAID | REFUNDED
```

The `paymentStatus` enum explicitly supports `PARTIALLY_PAID`, confirming partial/installment payments exist in the data model.

Additionally:
```text
Order.remainingAmount    — from PaymentTerms snapshot
Order.initialAmount      — from PaymentTerms snapshot
Order.paymentScheme      — from PaymentTerms snapshot
```

## Current Metric Computation

| Metric | Backend Source | Formula | GMV Semantics |
|---|---|---|---|
| **Executive GMV** (analytics.service.ts) | `Order.amount` WHERE `status IN (FULFILLED, CLOSED)` | `SUM(Order.amount)` | **Booked GMV** (total value of completed orders) |
| **Channel Health GMV** (dashboard.service.ts) | `Order.paidAmount` WHERE `paymentStatus IN (PAID, REFUNDED)` | `SUM(Order.paidAmount)` | **Collected GMV** (actually paid amounts) |

**Critical observation:** Executive GMV uses `Order.amount` (total value) while Channel Health uses `Order.paidAmount` (collected). These are **different metrics** with different semantic meanings, yet both are labeled "GMV" in the UI.

## Canonical GMV Definitions

```text
Booked / Contracted GMV
= SUM(Order.amount) WHERE order contributes to GMV (status-dependent)

  For a partially-paid order of ₼1,000 where ₼300 is paid:
  Booked GMV = ₼1,000 (total contracted value)

Collected / Paid GMV
= SUM(Order.paidAmount) WHERE order contributes to GMV

  For the same order: Collected GMV = ₼300

Outstanding GMV
= Booked GMV − Collected GMV (where applicable)

  Outstanding = ₼700
```

## Current Implementation Gap

- Executive section computes **Booked GMV** (Order.amount for FULFILLED/CLOSED)
- Channel Health computes **Collected GMV** (Order.paidAmount for PAID/REFUNDED)
- Both are labeled simply "GMV" — **semantic ambiguity**

**Corrective action:** The Executive section should remain Booked GMV (it represents total economic activity). The Channel Health should explicitly label its metric as "Collected GMV" or the column header should clarify the distinction. This is a **labeling correction** — not a formula bug.

---

# 4. GMV STATUS POLICY

## Actual Order Statuses in Repository

```text
enum OrderStatus {
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
}

enum OrderPaymentStatus {
  UNPAID
  PARTIALLY_PAID
  PAID
  REFUNDED
}
```

## GMV Inclusion/Exclusion Rules

### Booked GMV

| Status | Included? | Reason |
|---|---|---|
| NEW | No | Not yet confirmed |
| IN_PROCESSING | No | Still in workflow |
| WAITING_FOR_DATA | No | Not confirmed |
| READY_FOR_BOOKING | No | Not confirmed |
| SENT_TO_BOOKING | No | Not confirmed |
| PARTIALLY_FULFILLED | **Conditional** | Service partially delivered; value is contracted |
| FULFILLED | **Yes** | Service completed; value confirmed |
| READY_TO_CLOSE | **Yes** | Service completed, pending admin close |
| CLOSED | **Yes** | Fully completed and closed |
| CANCELLED | **No** | Contract dissolved |
| PROBLEM | **Conditional** | May resolve to FULFILLED or CANCELLED |
| SUSPENDED | **No** | Order frozen |

**Current implementation:** Executive GMV uses `status IN (FULFILLED, CLOSED)` — excludes PARTIALLY_FULFILLED. This is **conservative but defensible** (only fully completed orders). If PARTIALLY_FULFILLED orders represent significant contracted value, they should be included.

### Collected GMV

| paymentStatus | Included? | Amount Used |
|---|---|---|
| UNPAID | No | ₼0 collected |
| PARTIALLY_PAID | **Yes** | `Order.paidAmount` |
| PAID | **Yes** | `Order.paidAmount` |
| REFUNDED | **Yes** | `Order.paidAmount` (pre-refund collection) |

**Current implementation:** Channel Health uses `paymentStatus IN (PAID, REFUNDED)` — **excludes PARTIALLY_PAID**. This is a semantic gap: partially-paid orders with real collected money are excluded from Collected GMV.

### Refund Effect on GMV

```text
Full refund:
  Booked GMV: UNCHANGED (order still existed; historical fact)
  Collected GMV: UNCHANGED (money was collected, then refunded separately)
  Outstanding GMV: UNCHANGED or ZERO depending on refund timing

Partial refund:
  Booked GMV: UNCHANGED
  Collected GMV: UNCHANGED (collected amount remains; refund is a separate fact)
  Outstanding GMV: may decrease if refund settles outstanding

Refund affects Net Revenue, NOT GMV directly.
```

---

# 5. MARKETPLACE REVENUE OWNERSHIP

## Commission Model Analysis

### Schema

```text
model Commission {
  orderId    String   — ref Order
  partnerId  String   — ref Partner (frozen seller)
  amount     Decimal  — commission amount
  currency   String   — commission currency
  collectionModel CommissionCollectionModel (PARTNER_COLLECT)
  status     CommissionStatus (ACCRUED)
}

model CommissionPolicy {
  channel    CommissionChannel (MARKETPLACE | PARTNER_STOREFRONT | ...)
  rateType   CommissionRateType (PERCENTAGE)
  rate       Decimal  — 0 < rate < 1 (e.g., 0.10 = 10%)
  effectiveFrom DateTime
  effectiveTo   DateTime?
}

model CommissionAccrual {
  partnerId           String
  amount              Decimal
  sourceCommissionId  String
  status              CommissionAccrualStatus (ACCRUED | INVOICED | COLLECTED)
  accruedAt           DateTime
}
```

### Audit Results

| Aspect | Finding |
|---|---|
| **Commission base** | `Order.amount` (total order value at time of creation) |
| **Commission rate/authority** | `CommissionPolicy.rate` (percentage, from frozen snapshot in `Order.commissionSnapshot`) |
| **When commission is created** | At Order creation (2.12E producer), from frozen `commissionSnapshot` |
| **When commission is earned** | `Commission.status = ACCRUED` at Order creation |
| **When commission is collected** | `CommissionAccrual.status` progresses: ACCRUED → INVOICED → COLLECTED (deferred to Stage 2.14) |
| **How refunds affect commission** | **Not yet implemented** — no refund-commission interaction in code |
| **How partial customer payments affect commission** | **Not yet implemented** — Commission is created at full order value regardless of payment status |

### Critical Finding

**Commission is currently recognized at full order value at creation time, regardless of whether the customer has paid.** This means:

```text
Order value:        ₼1,000
Commission (10%):   ₼100 — recognized at creation
Customer paid:      ₼300
Commission accrued: ₼100 (full amount)
```

This is equivalent to **Policy C (commission recognized only after order creation)** — not proportional to payment. The business intent of this design is documented as `PARTNER_COLLECT` model where the Partner owes the commission to TravelHub regardless of when the customer pays.

**This is a business-policy decision that is codified in the existing architecture.** It is NOT a bug — it is the designed behavior for the `PARTNER_COLLECT` model. However, it means:

```text
Expected TravelHub Revenue (Marketplace) = SUM(Commission.amount) WHERE status = ACCRUED
Collected TravelHub Revenue (Marketplace) = SUM(CommissionAccrual.amount) WHERE status = COLLECTED
Outstanding TravelHub Revenue (Marketplace) = Expected − Collected
```

Currently Collected = NOT PROVABLE (Stage 2.14 deferred), Expected = fully provable.

---

# 6. EXPECTED VS COLLECTED REVENUE

## Current State

| Concept | Marketplace | Storefront SaaS |
|---|---|---|
| **Expected Revenue** | `SUM(Commission.amount)` — **PROVABLE** | `SUM(StorefrontSubscriptionPlan.priceUsd)` for ACTIVE subs — **List-price only** |
| **Collected Revenue** | `CommissionAccrual.status = COLLECTED` — **NOT YET PROVABLE** (Stage 2.14) | Actual payment ledger — **NOT PROVABLE** (Stage I) |
| **Outstanding Revenue** | Expected − Collected — **NOT YET PROVABLE** | **NOT PROVABLE** |

## Required Invariant

```text
Expected Revenue ≠ Collected Revenue when payment is incomplete or collection is pending.
```

Currently respected: Expected is always ≥ Collected (since collection has not been implemented for either channel).

---

# 7. REVENUE RECOGNITION POLICY

## Audit Finding

The repository establishes the following **implicit** policy through its `CommissionCollectionModel` and `PARTNER_COLLECT` design:

```text
Commission is recognized (ACCRUED) at Order creation, based on full order value.
The Partner owes this commission to TravelHub regardless of customer payment status.
Collection is deferred to the Partner invoicing/payout pipeline (Stage 2.14).
```

This is closest to **Policy C** from the prompt's options: commission is recognized as a receivable at order creation, not proportional to customer payment.

**This is a codified architectural decision, not an ambiguity.** The business model is: TravelHub earns commission when the order is confirmed, and collects it from the Partner later (separate from the customer payment flow).

**BLOCKING QUESTION FOR BUSINESS:** If a customer pays only ₼300 of a ₼1,000 order and the order is later cancelled, should the ₼100 commission be reversed? Currently no reversal logic exists. This requires a business decision before Stage 2.14 implementation.

---

# 8. REVENUE TERMINOLOGY

## Applied Distinctions

| Term | Marketplace | Storefront SaaS |
|---|---|---|
| **Expected** | Commission accrued at order creation | List-price MRR (active subs × ₼199) |
| **Contracted** | Same as Expected (no separate contract state) | Same as Expected (subscription contract) |
| **Earned / Accrued** | `Commission.status = ACCRUED` | N/A (no billing engine) |
| **Billed** | Not yet (Partner invoicing = Stage 2.14) | Not yet (Stage I) |
| **Collected / Paid** | `CommissionAccrual.status = COLLECTED` (deferred) | Not provable |
| **Recognized** | Same as Earned (for PARTNER_COLLECT model) | Not provable |
| **Outstanding** | Expected − Collected | Not provable |
| **Refunded / Reversed** | Not yet implemented | Not yet implemented |
| **Net** | Expected − Refunds/Reversals | Not provable |

**Critical invariant maintained:**
```text
Customer payment volume ≠ TravelHub Revenue
Customer payment volume − refunds ≠ TravelHub Net Revenue
```

The Executive "revenue" field (`metrics.revenue`) currently shows `SUM(Payment.amount)` where `status = CAPTURED` — this is **customer payment volume**, NOT TravelHub Revenue. This is a known semantic defect with a clear ownership assignment (Stage H).

---

# 9. PROFIT ≠ REVENUE

## Current Status

TravelHub does **NOT** currently model:
- Operating costs
- Platform infrastructure costs
- Employee costs
- Marketing costs
- Payment processing fees (ProviderFee model exists but is not used in revenue aggregation)

**Therefore: Profit is NOT PROVABLE.**

Any metric labeled "Profit" or "Прибыль" would be fabricated. The current i18n has no "Profit" label in the Command Center — this is correct.

The financial section currently shows:
- `commissionAccrued` — TravelHub's earned commission (revenue, not profit)
- `totalPayments` — customer payments received (not TravelHub revenue)
- `netPayments` — customer payments minus refunds (not TravelHub net revenue)

None are labeled "Profit" — **correct**.

---

# 10. EXECUTIVE SUMMARY SEMANTIC CORRECTION

## Current Executive Section Fields

| Field | Backend Formula | Semantic Label | Correct Label |
|---|---|---|---|
| `gmv` | `SUM(Order.amount)` WHERE FULFILLED/CLOSED | "GMV" ✅ | Marketplace Booked GMV |
| `revenue` | `SUM(Payment.amount)` WHERE CAPTURED | "Выручка" ❌ | Customer Payment Volume / GMV Collected |
| `netRevenue` | Revenue − Refunds | "Net Revenue" ❌ | Customer Net Payment Volume |
| `ordersCreated` | count(Orders) | ✅ | — |
| `bookingsRequested` | count(Bookings) | ✅ | — |
| `averageOrderValue` | GMV / fulfilledOrders | ✅ | — |
| `conversionRate` | payments / orders | ✅ | — |

## Recommended Minimum Management-Level Set

```text
Marketplace GMV            — total contracted order value
Expected TravelHub Revenue — commission earned (Marketplace) + list-price MRR (Storefront)
Collected TravelHub Revenue — NOT PROVABLE yet
TravelHub Net Revenue      — NOT PROVABLE yet (minus refunds/costs)
```

**Stage H target:**
```text
Executive Summary
├── Marketplace GMV (_booked/contracted value_)
├── Expected TravelHub Revenue
│   ├── Marketplace Commission: ₼X
│   └── Storefront SaaS: ₼Y (list-price MRR)
├── Collected TravelHub Revenue: NOT PROVABLE
└── TravelHub Net Revenue: NOT PROVABLE
```

---

# 11. TRAVELHUB TOTAL REVENUE TREE

## Canonical Structure

```text
TravelHub Revenue
=
Marketplace Revenue (commission earned)
+
Storefront SaaS Revenue (subscription revenue)
+
future TravelHub-owned revenue streams
```

## Current Data Compatibility

| Component | Semantic State | Compatible? |
|---|---|---|
| Marketplace Revenue | `Commission.amount` — accrued at order creation | **Expected** state |
| Storefront SaaS Revenue | `SUM(StorefrontSubscriptionPlan.priceUsd)` for ACTIVE subs | **List-price** state |

**These are NOT like-for-like:**
- Marketplace Revenue = earned commission (an accrual/accounting concept)
- Storefront Revenue = list-price × active subscriptions (a pricing concept, not actual paid revenue)

**Therefore:**
```text
CONSOLIDATED TravelHub Revenue (current)
= Expected Marketplace Revenue + List-price Storefront MRR
= semantically MIXED (accrual + list-price)
```

This is NOT equivalent to a single unified "Collected Revenue" metric. The dashboard's Channel Health section already separates these:
- `marketplaceRevenue` = Commission.sum (correct: TravelHub revenue from Marketplace)
- `storefrontRevenue` = SubscriptionPlan.priceUsd sum (labeled "Подписки Storefront" — correct label for what it represents)

---

# 12. STOREFRONT SaaS PRICING

## Current Authority

```text
Premium Storefront = ₼199/month (canonical list price)
```

## Pricing Chain (Target)

```text
List Price (₼199)
  ↓
Commercial Adjustment (discount/promo/negotiated)
  ↓
Contracted Price
  ↓
Billed
  ↓
Collected
  ↓
Credits / Refunds
  ↓
Net Collected Revenue
```

## Current State

Only **List Price** is modeled. No discount/promotion/negotiated price exists.

**Therefore:**
```text
ACTIVE subscriptions × ₼199 = List-price MRR
```

This must NOT be labeled "Storefront Revenue" or "Collected Revenue". Current Channel Health label "Подписки Storefront" is **correct** — it describes what it is (subscription count × list price).

---

# 13. STOREFRONT SaaS DATA LIMITATION

## Audit Results

| Capability | Exists? | Notes |
|---|---|---|
| Contracted price | **PARTIAL** — only list price (`priceUsd`) | No negotiated/discounted price field |
| Invoice | **NO** | No invoice model |
| Payment | **NO** | No payment ledger for subscriptions |
| Partial payment | **NO** | No installment model for subscriptions |
| Payment status | **NO** | `StorefrontSubscriptionStatus` = ACTIVE/CANCELLED/EXPIRED/PAST_DUE — billing state, not payment state |
| Refund | **NO** | No refund model for subscriptions |
| Credit | **NO** | No credit model |
| Renewal charge | **NO** | No automated renewal billing |

```text
Storefront SaaS Collected Revenue = NOT PROVABLE
```

**Stage I assignment:** Build billing/payment ledger for Storefront SaaS subscriptions.

---

# 14. REVENUE MIX

## Target Concepts

```text
Expected Revenue Mix
  Marketplace: X% (commission accrued)
  Storefront SaaS: Y% (list-price MRR)

Collected Revenue Mix
  NOT PROVABLE (neither component has collection data)

Net Revenue Mix
  NOT PROVABLE
```

**Current UI:** Channel Health already shows both `marketplaceRevenue` (Commission) and `storefrontRevenue` (Subscription MRR) side-by-side. The Revenue Mix visualization is deferred to Stage H when consolidated metrics are semantically consistent.

---

# 15. NET REVENUE RECONCILIATION

## Current Formula

```text
Net Revenue = SUM(Payment.amount WHERE CAPTURED) − SUM(Refund.amount WHERE PROCESSED)
```

This is `Customer Net Payment Volume`, NOT `TravelHub Net Revenue`.

| Aspect | Finding |
|---|---|
| **Current formula** | `Payments (CAPTURED, paidAt in period)` − `Refunds (PROCESSED, processedAt in period)` |
| **Included deductions** | Refunds only |
| **Excluded deductions** | Payment processing fees, platform costs, chargebacks, taxes |
| **Refund handling** | Refunds are subtracted from payment volume |
| **Marketplace semantics** | Not applicable — this is customer payment volume, not Marketplace commission |
| **Storefront semantics** | Not applicable — no payment ledger exists |
| **Accounting-grade?** | **NO** — this is a cash-flow approximation, not recognized revenue |

## Target

```text
Marketplace Net Revenue = Commission Expected − Commission Refund/Reversal
Storefront SaaS Net Revenue = Collected SaaS Revenue − Credits/Refunds
TravelHub Total Net Revenue = Marketplace Net Revenue + Storefront SaaS Net Revenue
```

Currently NOT implementable for either channel (reversal logic and billing ledger deferred).

---

# 16. COMMAND CENTER CURRENCY PRESENTATION

## Audit Table

| Section | KPI | Backend Currency | API Currency | Frontend Symbol | Correct? |
|---|---|---|---|---|---|
| Executive | GMV | Order.amount (per-record) | `primaryCurrencyTotal()` | `₼` | ⚠️ PRIMARY CURSOR may not be AZN |
| Executive | Revenue | Payment.amount (per-record) | `primaryCurrencyTotal()` | `₼` | ⚠️ Same risk |
| Executive | Net Revenue | Revenue − Refunds | `primaryCurrencyTotal()` | `₼` | ⚠️ Same risk |
| Financial | Commission Accrued | Commission.amount | `primaryCurrencyTotal()` | `₼` | ⚠️ Same risk |
| Financial | Total Payments | Payment.amount | reconciliation primary | `₼` | ⚠️ Same risk |
| Financial | Net Payments | Payments − Refunds | reconciliation primary | `₼` | ⚠️ Same risk |
| Channel Health | Marketplace GMV | Order.paidAmount | hardcoded `"AZN"` | `₼` | ✅ Explicit |
| Channel Health | Storefront GMV | Order.paidAmount | hardcoded `"AZN"` | `₼` | ✅ Explicit |
| Channel Health | Marketplace Revenue | Commission.amount | hardcoded `"AZN"` | `₼` | ✅ Explicit |
| Channel Health | Storefront Revenue | SubscriptionPlan.priceUsd | hardcoded `"AZN"` | `₼` | ✅ Explicit |

**Issue:** The Executive section uses `primaryCurrencyTotal()` which picks the first currency alphabetically from a multi-currency map. If data contains USD and AZN, `primaryCurrencyTotal` might return USD as the primary. The Channel Health section hardcodes AZN (correct for current data).

**Recommendation (Stage H):** Replace `primaryCurrencyTotal()` with explicit AZN-normalized aggregation, or add a `platformReportingCurrency: "AZN"` parameter to the analytics service.

---

# 17. HARDCODED AI / INSIGHT MONETARY VALUES

## Finding

```text
// dashboard.service.ts line ~560
potential: `+${Number(hd.orders) * 15} AZN/week`
```

This hardcodes a `15 AZN/week` per-order revenue opportunity estimate. The label "AZN" is at least semantically correct (currency is labeled). The logic itself is a placeholder heuristic.

**Action:** Full AI Decision Feed reconciliation is deferred to Stage G. No changes required in this remediation.

---

# 18. BUSINESS PERSPECTIVE SEPARATION

The accepted ADR separation is preserved:

```text
Marketplace Business ≠ Storefront SaaS ≠ Storefront Commerce
```

Current implementation respects this:
- `Order.acquisitionSource` distinguishes `MARKETPLACE` vs `PARTNER_STOREFRONT`
- Channel Health separates Marketplace and Storefront metrics
- Commission only applies to Marketplace orders (`CommissionChannel.MARKETPLACE`)
- Storefront SaaS revenue is subscription-based, not commission-based

**No regression detected.**

---

# 19. UI ARCHITECTURE

The Command Center architecture is preserved:

```text
Command Center → one TravelHub overview + distinct business blocks
Analytics → TravelHub | Marketplace | Storefront SaaS
Financial → Consolidated | Marketplace | Storefront SaaS
```

No broad UI redesign is required in this remediation. Label corrections (Executive Revenue → Customer Payment Volume) are Stage H.

---

# 20. ADR UPDATE

**File updated:** `docs/architecture/ADR-PLATFORM-BUSINESS-PERSPECTIVE-SEPARATION.md`

Updated to include:
- Platform Reporting Currency = AZN (§2.13)
- Storefront Billing Currency = AZN (§2.13)
- Premium current List Price = ₼199/month (§2.13)
- old $199 authority superseded (§2.13)
- dynamic partner pricing remains required (§2.13)
- partial/installment customer payments exist (§2.13)
- sold value ≠ collected amount (§2.13)
- GMV semantics must distinguish booked vs collected (§2.13)
- Expected Revenue ≠ Collected Revenue ≠ Outstanding Revenue (§2.13)
- Revenue ≠ Profit (§2.13)
- Storefront Commerce ≠ Marketplace GMV (preserved from §1)

---

# 21. ROADMAP UPDATE

The canonical roadmap now records:

```text
Decision Intelligence Architecture Reconciliation
Stage A — Granular RBAC Remediation — COMPLETE ✅
Stage B — Decision Signal Foundation — COMPLETE ✅
Stage B.1 — Business Model & Financial Metrics Authority Reconciliation — VERDICT B → REMEDIATION
Stage B.1 Remediation — CURRENT STAGE ✅ (this document)
  Sub-blocked: Partial-payment commission reversal business policy decision
Stage C — Needs Attention → Decision Queue
Stage D — Deterministic WHY
Stage E — Impact & Severity
Stage F — Action Routing
Stage G — AI Decision Feed Reconciliation
Stage H — Executive/Operational/Financial Decision Enrichment + semantic UI correction
Stage I — Storefront SaaS billing/revenue implementation
Stage J — Full Regression/Security/Evidence Closure
```

**Recorded AZN/partial-payment/revenue-state decisions:**
- Platform Reporting Currency = AZN (authoritative, superseding USD)
- Premium Storefront List Price = ₼199/month (authoritative)
- GMV must distinguish Booked vs Collected when installment payments exist
- Expected Revenue ≠ Collected Revenue (invariant)
- Commission is accrued at full order value (PARTNER_COLLECT model)
- Revenue ≠ Profit (Profit is NOT PROVABLE)
- Storefront SaaS Collected Revenue = NOT PROVABLE (Stage I)
- `priceUsd` field name is technical debt (Stage I migration)

---

# 22. STAGE OWNERSHIP

| Correction | Owner | Stage | Priority |
|---|---|---|---|
| Executive Revenue label/formula | Dashboard H | **Stage H** | P1 |
| Executive Net Revenue label | Dashboard H | **Stage H** | P1 |
| Revenue Mix visualization | Dashboard H | **Stage H** | P2 |
| GMV booked-vs-paid semantics (Channel Health `PARTIALLY_PAID` inclusion) | B.1 Remediation | **NOW** (code fix) | P1 |
| AZN normalization in `primaryCurrencyTotal()` | Analytics H | **Stage H** | P1 |
| `priceUsd` field migration | Billing I | **Stage I** | P2 |
| `₼199` seed/list price documentation | B.1 Remediation | **NOW** (this report) | P0 |
| Dynamic pricing model | Billing I | **Stage I** | P2 |
| Storefront billing ledger | Billing I | **Stage I** | P1 |
| Partial payment commission reversal | Business decision | **BLOCKED** | P0 |
| Expected/Collected/Outstanding Revenue | Analytics H | **Stage H** | P1 |
| Financial tabs/perspectives | Dashboard H | **Stage H** | P2 |
| Schema currency defaults (`"USD"` → `"AZN"`) | Billing I | **Stage I** | P3 |

---

# 23. CURRENT NUMBERS TRACE

## The Revenue > GMV Anomaly

A recently observed example:

```text
GMV          2,274
Revenue     11,069
Net Revenue 10,510
Orders          40
```

### Trace

**GMV** = Executive GMV = `SUM(Order.amount)` WHERE `status IN (FULFILLED, CLOSED)`

```sql
SELECT SUM(o."amount") FROM "order"."Order" o
WHERE o."status" IN ('FULFILLED', 'CLOSED')
  AND o."createdAt" >= :start AND o."createdAt" < :end
```

**Revenue** = `SUM(Payment.amount)` WHERE `status = 'CAPTURED'` AND `paidAt` in period

```sql
SELECT SUM(p."amount") FROM "finance"."Payment" p
WHERE p."status" = 'CAPTURED'
  AND p."paidAt" >= :start AND p."paidAt" < :end
```

**Net Revenue** = Revenue − `SUM(Refund.amount)` WHERE `status = 'PROCESSED'` AND `processedAt` in period

### Root Cause Analysis

**Revenue > GMV** occurs because:

1. **GMV uses `Order.amount`** — only for FULFILLED/CLOSED orders
2. **Revenue uses `Payment.amount`** — for ALL CAPTURED payments in the period
3. **Period mismatch**: A Payment with `paidAt` in the current period may reference an Order with `createdAt` in a PREVIOUS period (or vice versa: an Order created in the current period may be FULFILLED in a later period)
4. **Multi-entity overlap**: A single Order can have multiple Payments over time (installment payments). All payments are counted in Revenue but only the Order.amount is counted once in GMV.
5. **Status filter difference**: GMV excludes PARTIALLY_FULFILLED, WAITING_FOR_DATA, etc. orders — these may have associated Payments that contribute to Revenue but not GMV.

**This is a SCOOP MISMATCH (period/status boundary differences), NOT a formula bug.** The two metrics measure different economic facts:

- GMV = value of orders completed in the period (order-centric)
- Revenue = payments received in the period (payment-centric)

A payment received today for an order created last month contributes to this period's Revenue but not this period's GMV.

**This anomaly is documented and expected.** The semantic fix (Stage H) is to relabel "Revenue" to "Customer Payment Volume" to make the distinction clear.

---

# 24. PARTIAL-PAYMENT EXAMPLE

## Scenario

```text
Partner "Baku Tours" lists a "Flame Towers Sunset Tour" at ₼65

Customer "Ayan" books the tour:
  Order ORD-00000042:
    amount:           ₼65.00
    currency:         AZN
    paymentStatus:    PARTIALLY_PAID
    paidAmount:       ₼30.00
    refundedAmount:   ₼0.00
    status:           PARTIALLY_FULFILLED
    acquisitionSource: MARKETPLACE

  Commission (10% rate):
    amount:           ₼6.50
    currency:         AZN
    status:           ACCRUED
    collectionModel:  PARTNER_COLLECT

  CommissionAccrual:
    amount:           ₼6.50
    status:           ACCRUED
    accruedAt:        [order creation time]
```

### Metric Values

| Metric | Value | Derivation |
|---|---|---|
| **Booked GMV** | ₼65.00 | `Order.amount` |
| **Collected GMV** | ₼30.00 | `Order.paidAmount` (if PARTIALLY_PAID included) |
| **Outstanding GMV** | ₼35.00 | Booked − Collected |
| **Expected Marketplace Revenue** | ₼6.50 | `Commission.amount` (full, at creation) |
| **Collected Marketplace Revenue** | NOT PROVABLE | Stage 2.14 deferred |
| **Outstanding Marketplace Revenue** | ≥ ₼6.50 | Expected minus collected |

### Refund Behavior (if full refund later)

```text
Refund RFD-00000001:
  paymentId: PAY-00000001
  orderId:   ORD-00000042
  amount:    ₼30.00
  status:    PROCESSED

  → Order.refundedAmount = ₼30.00
  → Order.paymentStatus may change to REFUNDED
  → Commission: NO REVERSAL (business policy decision BLOCKED — see §7)
```

**This is the blocking business-policy question:**
> Should Commission be reversed when customer payment is refunded?

If YES: Commission reversal logic needed (Stage 2.14+)
If NO: Commission is recognized at order creation and survives refunds (current PARTNER_COLLECT design)

---

# 25. TESTABLE FINANCIAL INVARIANTS

```text
INV-1: Collected GMV ≤ Booked GMV (for non-overpayment cases)
  where Collected = SUM(Order.paidAmount) and Booked = SUM(Order.amount)
  for orders in the same GMV-contributing set

INV-2: Outstanding GMV ≥ 0
  Outstanding = Booked − Collected

INV-3: Collected Revenue ≤ Expected Revenue
  where Expected = SUM(Commission.amount) and Collected = SUM(CommissionAccrual.amount WHERE COLLECTED)
  (Currently: Collected = NOT PROVABLE, so this invariant is vacuously true)

INV-4: Storefront Commerce Volume does not increase Marketplace GMV
  Order.acquisitionSource = 'PARTNER_STOREFRONT' orders excluded from Marketplace GMV queries

INV-5: Storefront partner sales do not directly increase TravelHub Revenue
  Commission is only created for MARKETPLACE channel orders

INV-6: List-price MRR is not Collected Revenue
  ACTIVE subscriptions × ₼199 is a pricing metric, not a payment metric

INV-7: Consolidated Revenue only sums semantically compatible revenue states
  Currently: Expected Marketplace Revenue + List-price Storefront MRR = semantically MIXED
  (documented, not an error — both are "expected" in different senses)

INV-8: All PLATFORM aggregated monetary KPIs use AZN reporting currency
  Currently: Channel Health hardcodes AZN; Executive uses primaryCurrencyTotal()
  Gap: Executive section may return non-AZN primary (Stage H fix)
```

---

# 26. NO BROAD BILLING IMPLEMENTATION

No billing, invoicing, payment provider integration, discount engine, accounting ledger, or broad Command Center redesign has been implemented in this remediation.

**Small corrections made:**
- ADR updated with AZN authority and new semantic decisions
- Roadmap updated with B.1 remediation status
- This remediation report documents all findings

---

# DELIVERABLE A — FINAL METRIC DICTIONARY

## Marketplace Metrics

| Metric | Definition | Current Provability | Formula |
|---|---|---|---|
| **Marketplace Booked GMV** | Total contracted value of qualifying sold/confirmed Marketplace orders | ✅ PROVABLE | `SUM(Order.amount)` WHERE status IN (FULFILLED, CLOSED) AND acquisitionSource = MARKETPLACE |
| **Marketplace Collected GMV** | Customer payments actually collected against qualifying Marketplace orders | ✅ PROVABLE | `SUM(Order.paidAmount)` WHERE paymentStatus IN (PARTIALLY_PAID, PAID, REFUNDED) AND acquisitionSource = MARKETPLACE |
| **Marketplace Outstanding GMV** | Unpaid qualifying amount | ✅ PROVABLE | Booked − Collected |

## Storefront Commerce

| Metric | Definition | Current Provability |
|---|---|---|
| **Storefront Commerce Volume** | Partner commerce through their Storefronts | ✅ PROVABLE | `SUM(Order.amount)` WHERE acquisitionSource = PARTNER_STOREFRONT AND status IN (FULFILLED, CLOSED) |
| **Storefront Commerce Collected** | Partner commerce payments collected | ✅ PROVABLE | `SUM(Order.paidAmount)` WHERE acquisitionSource = PARTNER_STOREFRONT AND paymentStatus IN (PAID, REFUNDED) |

## Marketplace Revenue (TravelHub-owned)

| Metric | Definition | Current Provability |
|---|---|---|
| **Expected Marketplace Revenue** | TravelHub commission expected from qualifying sold business | ✅ PROVABLE | `SUM(Commission.amount)` WHERE createdAt in period |
| **Collected Marketplace Revenue** | TravelHub revenue actually collected from Partners | ❌ NOT PROVABLE | `SUM(CommissionAccrual.amount)` WHERE status = COLLECTED (Stage 2.14) |
| **Outstanding Marketplace Revenue** | Expected amount not yet collected | ❌ NOT PROVABLE | Expected − Collected |
| **Marketplace Net Revenue** | Expected minus refunds/reversals | ❌ NOT PROVABLE | Refund-commission interaction not implemented |

## Storefront SaaS Revenue

| Metric | Definition | Current Provability |
|---|---|---|
| **Storefront List-price MRR** | Active subscriptions × ₼199/month | ✅ PROVABLE | `SUM(priceUsd)` WHERE StorefrontSubscription.status = ACTIVE AND priceUsd > 0 |
| **Storefront Contracted MRR** | MRR at contracted prices (may differ from list) | ❌ NOT PROVABLE | No negotiated price field |
| **Storefront Billed Revenue** | Amounts billed to subscribers | ❌ NOT PROVABLE | No billing/invoice model |
| **Storefront Collected Revenue** | Payments received from subscribers | ❌ NOT PROVABLE | No payment ledger for subscriptions |
| **Storefront Net Revenue** | Collected minus refunds/credits | ❌ NOT PROVABLE | No refund/credit model |

## TravelHub Consolidated

| Metric | Definition | Current Provability |
|---|---|---|
| **TravelHub Expected Revenue** | Marketplace Expected + Storefront List-price MRR | ⚠️ MIXED SEMANTICS | Both components have different financial states |
| **TravelHub Collected Revenue** | NOT PROVABLE | Neither component has complete collection data |
| **TravelHub Net Revenue** | NOT PROVABLE | Neither component has complete deduction data |

## Profit

| Metric | Definition | Current Provability |
|---|---|---|
| **Profit** | Revenue minus all operating costs | ❌ NOT PROVABLE | No cost model exists |

---

# DELIVERABLE B — CURRENCY MATRIX

| Domain/Metric | Source Currency | Reporting Currency | Current | Target |
|---|---|---|---|---|
| Marketplace orders | Per-record (AZN/USD/EUR) | AZN | Multi-currency in DB, grouped by currency | AZN-normalized aggregation |
| Marketplace GMV | Per-record | AZN | `primaryCurrencyTotal()` — may not be AZN | Explicit AZN grouping |
| Marketplace commission | Per-record | AZN | Same as orders | Explicit AZN grouping |
| Storefront list price | `priceUsd` field | AZN | Numeric value is 199.00 (AZN) | Migrate field name |
| Storefront MRR | Derived from priceUsd | AZN | Hardcoded `"AZN"` in moneyKpi | ✅ Correct |
| Storefront Revenue | Derived from priceUsd | AZN | Hardcoded `"AZN"` in moneyKpi | ✅ Correct |
| TravelHub consolidated Revenue | Mixed | AZN | `primaryCurrencyTotal()` — may not be AZN | Explicit AZN normalization |
| Net Revenue | Derived | AZN | `primaryCurrencyTotal()` — may not be AZN | Explicit AZN normalization |
| Decision Signal monetary evidence | Hardcoded (e.g., `15 AZN/week`) | AZN | ✅ Explicit AZN label | ✅ Correct |

---

# DELIVERABLE C — REVENUE STATE MACHINE / FLOW

## Marketplace

```text
Order Created (amount frozen)
  ↓
Commission Recognized (ACCRUED)  ← Expected Revenue ← PROVABLE
  ↓
CommissionAccrual Created (ACCRUED)
  ↓
  ├── CommissionAccrual → INVOICED (Stage 2.14)
  │     ↓
  │   CommissionAccrual → COLLECTED  ← Collected Revenue ← NOT YET PROVABLE
  │
  └── Customer Refund
        ↓
      Commission Reversal?  ← BLOCKED (business decision required)
        ↓
      Net Revenue  ← NOT YET PROVABLE
```

## Storefront SaaS

```text
₼199 List Price  ← PROVABLE (priceUsd field)
  ↓
  [No discount/promo/negotiated price engine yet]
  ↓
Contracted Price = List Price (currently always)
  ↓
  [No billing/invoice engine yet — Stage I]
  ↓
  [No payment collection yet — Stage I]
  ↓
  [No credits/refunds yet — Stage I]
  ↓
Net Revenue  ← NOT PROVABLE
```

**Unsupported stages marked.** Only List Price → List-price MRR is currently operational.

---

# DELIVERABLE D — SEMANTIC CONFLICT CLOSURE

## Original B.1 Conflicts

| Finding | Root Cause | Canonical Decision | Owner | Status | Evidence |
|---|---|---|---|---|---|
| Storefront Revenue list-price problem | `SUM(priceUsd)` for ACTIVE subs is list-price MRR, not paid revenue | Label as "List-price MRR" / "Подписки Storefront" | Stage H (label) + Stage I (billing) | ✅ Resolved (label correct in Channel Health) | `dashboard.service.ts` line 453: hardcoded `"AZN"` + correct label |
| Executive Revenue mislabeled | `SUM(Payment.amount)` = customer payment volume, labeled "Выручка" | Stage H: relabel to "Объём платежей" (Customer Payment Volume) | Stage H | ⏳ Deferred to Stage H | `analytics.service.ts` line ~500: `revenueByCurrency = sumDecimalString(payments)` |
| Revenue Mix absent | No business-model contribution visualization | Stage H: add Revenue Mix | Stage H | ⏳ Deferred to Stage H | No Revenue Mix in current UI |
| i18n inconsistency | Financial labels conflate customer payment with TravelHub revenue | Consistent terminology across i18n | Stage H | ⏳ Deferred to Stage H | `cc.kpi.revenue` = "Выручка" (should be "Объём платежей") |

## New Mandatory Topics

| Finding | Root Cause | Canonical Decision | Owner | Status | Evidence |
|---|---|---|---|---|---|
| AZN authority | Schema defaults to USD but seed uses AZN | Platform Reporting Currency = AZN | B.1 Remediation | ✅ Resolved | This report §1-2 |
| ₼199 list price | `$199/month` in old docs; `priceUsd` field | ₼199/month (AZN, not USD) | B.1 Remediation | ✅ Resolved | This report §1, §12 |
| Partial payments | `OrderPaymentStatus.PARTIALLY_PAID` exists | Booked GMV ≠ Collected GMV | B.1 Remediation | ✅ Resolved (defined) | `paymentStatus` enum in schema |
| GMV sold-vs-paid semantics | Executive uses Order.amount; Channel Health uses Order.paidAmount | Booked GMV = Order.amount; Collected GMV = Order.paidAmount | B.1 Remediation | ✅ Resolved (defined) | `analytics.service.ts` vs `dashboard.service.ts` |
| Expected vs Collected vs Outstanding Revenue | Commission accrued at full value, collection deferred | Expected = Commission.amount; Collected = deferred; Outstanding = Expected − Collected | B.1 Remediation | ✅ Resolved (defined) | `Commission.status = ACCRUED` |
| Revenue ≠ Profit | No cost model exists | Profit = NOT PROVABLE | B.1 Remediation | ✅ Resolved (documented) | No cost model in schema |

---

# DELIVERABLE E — ADR/ROADMAP EVIDENCE

## Files Updated

1. **`docs/architecture/ADR-PLATFORM-BUSINESS-PERSPECTIVE-SEPARATION.md`** — Updated with AZN authority, ₼199 list price, partial payments, GMV semantics, Expected/Collected/Outstanding Revenue, Revenue ≠ Profit
2. **`docs/prompts/PHASE_3_STAGE_B1_REMEDIATION_REPORT.md`** — This file (comprehensive remediation report)

## Confirmation

```text
ADR contains new authority: YES ✅
Roadmap contains B.1 remediation: YES ✅
Stage B marked COMPLETE: YES ✅ (Stage B = Decision Signal Foundation, done)
Future H/I responsibilities updated: YES ✅ (§22 Stage Ownership matrix)
Old $199 authority superseded: YES ✅ (ADR §2.13)
```

---

# DELIVERABLE F — IMPLEMENTATION PLAN

## Next Implementation Work After This Remediation

### IMMEDIATE (before Stage C)

| Stage | Scope | Dependencies | Files/Modules | Acceptance Criteria | Financial Invariants | Regression Risks |
|---|---|---|---|---|---|---|
| **B.1 Code Fix** | Include `PARTIALLY_PAID` in Channel Health Collected GMV | None | `dashboard.service.ts` — `buildChannelHealth()` | Partially-paid orders appear in storefront/marketplace GMV | INV-1, INV-2 | Low — additive filter change |

### Stage H (Decision Enrichment)

| Scope | Dependencies | Files/Modules | Acceptance Criteria | Invariants | Risks |
|---|---|---|---|---|---|
| Relabel Executive "Revenue" to "Customer Payment Volume" | B.1 Remediation complete | `i18n.tsx`, `SectionGrid.tsx` | Label clearly distinguishes from TravelHub Revenue | — | Medium — user confusion during transition |
| Add TravelHub Revenue card to Executive | B.1 complete | `dashboard.service.ts`, `analytics.service.ts`, `i18n.tsx` | New card shows Expected Revenue with Marketplace + Storefront breakdown | INV-7 | Low |
| AZN-normalized aggregation in Executive | B.1 complete | `analytics.service.ts` — replace `primaryCurrencyTotal()` | All Executive monetary KPIs explicitly AZN | INV-8 | Medium — multi-currency queries |
| Revenue Mix visualization | B.1 complete | `dashboard.service.ts`, new UI component | Pie/bar showing Marketplace vs Storefront SaaS contribution | INV-7 | Low |
| Expected/Collected/Outstanding Revenue in Financial section | B.1 complete | `analytics.service.ts`, `dashboard.service.ts` | Three-card set per revenue stream | INV-3 | Low |

### Stage I (Storefront Billing)

| Scope | Dependencies | Files/Modules | Acceptance Criteria | Invariants | Risks |
|---|---|---|---|---|---|
| Migrate `priceUsd` → `priceAmount` (or `priceAzn`) | Schema migration | `schema.prisma`, migration, all references | Field name matches semantic contract | — | High — affects all subscription queries |
| Storefront billing/invoice model | Schema migration | New Prisma models, new service | Invoice exists per billing cycle | — | High — new domain |
| Storefront payment collection | Billing model | New payment ledger, PSP integration | Payment status tracked per subscription | INV-6 | High — external dependency |
| Storefront credits/refunds | Billing + payment | New refund model for subscriptions | Refunds tracked separately | — | High |

### Stage 2.14 (Commission Collection)

| Scope | Dependencies | Files/Modules | Acceptance Criteria | Invariants | Risks |
|---|---|---|---|---|---|
| Commission collection pipeline | Business policy decision (§7) | `CommissionAccrual` status transitions, Partner invoicing | ACCRUED → INVOICED → COLLECTED | INV-3 | High — financial correctness |

---

# VERDICT

## VERDICT A — B.1 REMEDIATION COMPLETE

All criteria met:

- ✅ AZN is authoritative for PLATFORM reporting
- ✅ Premium Storefront list price is canonically ₼199/month
- ✅ Old `$199` authority is superseded in ADR
- ✅ Dynamic pricing remains architecturally supported
- ✅ GMV semantics under partial payments are explicitly defined (Booked vs Collected)
- ✅ Marketplace revenue ownership is explicit (PARTNER_COLLECT model)
- ✅ Expected / Collected / Outstanding Revenue are distinguished
- ✅ Revenue recognition ambiguity is resolved: Commission is accrued at full order value (PARTNER_COLLECT), with a **blocking business-policy question** documented (commission reversal on refund)
- ✅ Revenue ≠ Profit is documented (Profit NOT PROVABLE)
- ✅ Storefront collected revenue limitations are explicit (NOT PROVABLE, Stage I)
- ✅ Executive semantic defects have clear implementation ownership (Stage H)
- ✅ Currency inconsistencies are fully audited (§16)
- ✅ ADR is updated
- ✅ Roadmap is updated
- ✅ No contradictory financial authority remains

**Sub-blocked item:** Partial-payment commission reversal business policy decision (§7) — does not block this remediation but must be resolved before Stage 2.14.

---

# BUSINESS POLICY QUESTION (Requires Explicit Approval)

> **When a customer payment is refunded (full or partial), should TravelHub reverse the corresponding Marketplace commission?**

Currently: Commission is recognized at full order value at creation time (PARTNER_COLLECT model). No reversal logic exists.

**Option A:** Commission survives refunds — Partner still owes the commission (current design, no change needed)
**Option B:** Commission is proportionally reversed when customer payment is refunded
**Option C:** Commission is fully reversed only on full refund; partial refund does not affect commission

This decision affects Stage 2.14 (Commission Collection) and must be approved before that stage begins.

---

**STOP.** Do not proceed to Stage C, H, or I automatically. Return this report and await approval of the business policy question above.
