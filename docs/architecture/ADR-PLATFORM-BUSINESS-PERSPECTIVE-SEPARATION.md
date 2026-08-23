# ADR — PLATFORM BUSINESS PERSPECTIVE SEPARATION

**Status:** ACCEPTED / MANDATORY

**Date:** 2026-08-23

**Stage:** B.1 Remediation — Financial Semantics, AZN Authority, Partial Payments & Revenue Ownership

---

## Context

TravelHub operates three distinct business perspectives that must not be conflated:

1. **Marketplace Business** — TravelHub as a travel marketplace
2. **Storefront SaaS** — TravelHub as a SaaS platform for partners
3. **Storefront Commerce** — Partners' own commerce through their Storefronts

Previous implementation conflated these perspectives in financial metrics, leading to semantic conflicts (e.g., Executive "Revenue" showing customer payments instead of TravelHub earnings).

The B.1 Remediation identified additional mandatory decisions around currency authority, partial payments, and revenue state semantics.

---

## Decision

### 1. Business Model Separation

```
MARKETPLACE BUSINESS ≠ STOREFRONT SaaS ≠ STOREFRONT COMMERCE
```

These are three different economic perspectives and must not be conflated in:
- Metrics
- UI
- Analytics
- Revenue calculations
- Decision Intelligence
- Documentation
- APIs
- DTO naming
- Future implementation

### 2. GMV Authority

**Marketplace GMV** must represent only transactions belonging to the TravelHub Marketplace business.

```text
Marketplace GMV = qualifying Marketplace transaction volume
```

It must NOT automatically include Storefront partner sales.

If an aggregate measure is needed:

```text
Platform Commerce Volume = Marketplace GMV + Storefront Commerce Volume
```

Only if both components have compatible transaction semantics and currency/period normalization.

### 3. GMV Semantics Under Partial Payments

TravelHub supports partial/installment customer payments (`Order.paymentStatus = PARTIALLY_PAID`).

```text
Booked / Contracted GMV
= SUM(Order.amount) WHERE order contributes to GMV
  (total contracted value regardless of payment status)

Collected / Paid GMV
= SUM(Order.paidAmount) WHERE order contributes to GMV
  (customer payments actually collected)

Outstanding GMV
= Booked GMV − Collected GMV
  (unpaid qualifying amount, ≥ 0)
```

**Invariant:** `Collected GMV ≤ Booked GMV` (for non-overpayment cases).

A single order of ₼1,000 with ₼300 paid contributes:
- Booked GMV: ₼1,000
- Collected GMV: ₼300
- Outstanding GMV: ₼700

### 4. Revenue Authority

**TravelHub Revenue** represents TravelHub-owned revenue streams:

```text
TravelHub Total Revenue = Marketplace Revenue + Storefront SaaS Revenue + future streams
```

Current components:
- **Marketplace Revenue** = marketplace commission / other marketplace-owned fees
- **Storefront SaaS Revenue** = subscription/billing revenue earned by TravelHub

Storefront partner commerce does NOT become TravelHub Revenue.

### 5. Expected / Collected / Outstanding Revenue

TravelHub must distinguish expected economic entitlement from cash actually collected:

```text
Expected Revenue
= TravelHub revenue expected from qualifying sold business

Collected Revenue
= TravelHub revenue actually collected/realized

Outstanding Revenue
= expected amount not yet collected/realized
```

**Invariant:** `Expected Revenue ≠ Collected Revenue` when payment is incomplete or collection is pending.

For Marketplace:
- Expected = `SUM(Commission.amount)` WHERE status = ACCRUED
- Collected = `SUM(CommissionAccrual.amount)` WHERE status = COLLECTED (deferred to Stage 2.14)
- Outstanding = Expected − Collected

For Storefront SaaS:
- Expected = List-price MRR (active subscriptions × ₼199)
- Collected = NOT PROVABLE (no billing/payment ledger — Stage I)
- Outstanding = NOT PROVABLE

### 6. Net Revenue Tree

```text
Marketplace Revenue − applicable deductions = Marketplace Net Revenue
Storefront SaaS Revenue − applicable deductions = Storefront SaaS Net Revenue
TravelHub Total Net Revenue = Marketplace Net Revenue + Storefront SaaS Net Revenue + future
```

### 7. Revenue Recognition Semantics

Distinguish as applicable:

```text
Expected / Contracted
Accrued / Earned
Invoiced / Billed
Paid / Collected
Refunded / Credited
Recognized Revenue
Net Revenue
MRR / ARR
```

For Marketplace: Commission is recognized (ACCRUED) at Order creation via `PARTNER_COLLECT` model. The Partner owes the commission regardless of customer payment status.

For Storefront SaaS: current data model cannot prove actual payment.

**Critical invariant:**
```text
ACTIVE subscriptions × ₼199 ≠ actual Storefront Revenue
```

At most this represents list-price subscription value / list-price MRR.

### 8. Revenue ≠ Profit

```text
Revenue ≠ Profit
```

If TravelHub does not yet model all relevant costs, actual Profit is **NOT PROVABLE**.

```text
GMV / Sales Volume
↓
TravelHub Revenue
↓
Revenue deductions
↓
Net Revenue
↓
Operating / business costs
↓
Profit
```

Do not label Revenue or Net Revenue as "Profit / Прибыль".

### 9. Pricing Authority

**Current canonical list price:** Premium Storefront = ₼199/month

**Supersedes:** Old `$199/month` assumption (no longer authoritative).

**Architecture must support future:**
- percentage discount
- fixed discount
- custom / negotiated price
- promotion
- free period
- introductory price
- time-limited campaign

### 10. Currency Authority

```text
Platform Reporting Currency = AZN
Storefront Billing Currency = AZN
```

All aggregated PLATFORM monetary management KPIs must use AZN.

No cosmetic-only symbol replacement. Schema field names like `priceUsd` are technical debt requiring explicit migration (Stage I).

### 11. Revenue Mix — Management View

TravelHub management must see business model contribution:

```text
TravelHub Total Revenue
├── Marketplace Revenue (Z%)
└── Storefront SaaS Revenue (V%)
```

And analogously for Net Revenue.

### 12. Command Center Information Architecture

Command Center = **single TravelHub management overview**.

```text
TRAVELHUB OVERVIEW
├── Marketplace GMV
├── TravelHub Revenue
├── TravelHub Net Revenue
└── other company-level decision metrics

MARKETPLACE BUSINESS
├── GMV
├── Orders / Bookings
├── Customers
├── Conversion
└── Commission Revenue

STOREFRONT SaaS
├── Active Storefronts
├── Paid Subscriptions
├── MRR / ARR
├── Churn
├── Subscription Revenue
└── Adoption

PLATFORM / CHANNEL HEALTH
├── Marketplace health
└── Storefront platform health

NEEDS ATTENTION
└── unified TravelHub-owned decision queue

DECISION FEED
└── WHAT → WHY → IMPACT → ACTION
```

NOT:
```text
[ General ] [ Marketplace ] [ Storefront ]
```

### 13. Analytics Information Architecture

```text
[ TravelHub ] [ Marketplace ] [ Storefront SaaS ]
```

- **TravelHub**: Corporate/consolidated analytics, Revenue Mix, business contribution
- **Marketplace**: Deep marketplace analytics (GMV, Orders, Commission, etc.)
- **Storefront SaaS**: SaaS analytics (MRR, ARR, Subscriptions, Churn, etc.)

### 14. Financial Information Architecture

```text
[ Consolidated ] [ Marketplace ] [ Storefront SaaS ]
```

### 15. Partner Classification

A partner may have both relationships:
- Marketplace Seller = YES
- Storefront Subscriber = YES

Do not classify as exclusively one or the other.

### 16. Platform Signal Ownership

Is this condition materially within TravelHub's responsibility?

```text
Partner's own sales dropped 20% → primarily PARTNER workspace
Storefront checkout failures across 47 partners → PLATFORM Command Center
```

### 17. Marketplace Refund Commission Policy

**Status:** ACCEPTED / MANDATORY

For ordinary Marketplace Commission:

```text
CUSTOMER REFUND
→ PROPORTIONAL MARKETPLACE COMMISSION REVERSAL
```

Rules:

```text
Full qualifying refund
→ full applicable Marketplace Commission reversal

Partial qualifying refund
→ proportional applicable Marketplace Commission reversal

No qualifying refund
→ no refund-driven commission reversal
```

TravelHub must not retain ordinary Marketplace Commission on the portion of the underlying qualifying transaction that has been refunded to the customer.

Formula (uniform-rate orders):

```text
Commission Reversal = Qualifying Refunded Base × Commission Rate
Net Expected Commission = Gross Expected Commission − Commission Reversal
```

For multi-rate/multi-service orders: reversal must be computed against the applicable refunded commission basis, not simply `(Order.amount − totalRefunds) × rate`.

**Non-refundable TravelHub fees** (future: cancellation fee, service fee, etc.) are **separate revenue streams** and are NOT ordinary Marketplace Commission. They are governed by their own contract and refund policy.

**Storefront SaaS** is NOT governed by this policy. Subscription credits/refunds/cancellations are governed by Storefront billing policy (Stage I).

**Idempotency:** Same refund event → one applicable commission reversal. Repeated execution must not create duplicate reversals.

**Audit:** Reversal must preserve historical financial facts. Commission reversal events must be auditable.

---

## Consequences

### Positive
- Clear revenue ownership and attribution
- Management can understand business model contribution
- Future billing engine fits naturally
- Decision Intelligence can reason about correct revenue streams
- Partial payment semantics are explicitly defined
- Currency authority is unambiguous (AZN)
- Revenue ≠ Profit is documented

### Negative
- Requires renaming existing metrics (Executive Revenue → Customer Payment Volume)
- Adds complexity to Command Center (Revenue Mix breakdown)
- Requires future billing engine for accurate SaaS revenue
- `priceUsd` field name is technical debt (Stage I migration)

---

## Implementation Stages

| Stage | Scope |
|---|---|
| Stage B.1 Remediation | Currency authority, GMV semantics, Expected/Collected/Outstanding Revenue definitions, ADR update |
| Stage H | Rename Executive metrics, add TravelHub Revenue + Revenue Mix, AZN normalization |
| Stage I | Storefront billing engine, actual paid revenue, MRR/ARR, `priceUsd` migration |
| Stage 2.14 | Commission collection pipeline (ACCRUED → INVOICED → COLLECTED) + refund-driven commission reversal |
| Stage J | Full regression, security, evidence closure |

---

## Review

- Architecture Reconciliation: APPROVED (Phase 3 Architecture Addendum)
- Stage B.1: COMPLETED (original reconciliation)
- Stage B.1 Remediation: VERDICT A — COMPLETE
- Stage B.1 Policy Closure: VERDICT A — COMPLETE (proportional commission reversal on refund)
- Pending: Stage H implementation, Stage I implementation, Stage 2.14 commission reversal implementation
