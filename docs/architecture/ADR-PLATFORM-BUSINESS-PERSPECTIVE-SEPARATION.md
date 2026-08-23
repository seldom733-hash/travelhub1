# ADR — PLATFORM BUSINESS PERSPECTIVE SEPARATION

**Status:** ACCEPTED / MANDATORY

**Date:** 2026-08-23

**Stage:** B.1 — Business Model & Financial Metrics Authority Reconciliation

---

## Context

TravelHub operates three distinct business perspectives that must not be conflated:

1. **Marketplace Business** — TravelHub as a travel marketplace
2. **Storefront SaaS** — TravelHub as a SaaS platform for partners
3. **Storefront Commerce** — Partners' own commerce through their Storefronts

Previous implementation conflated these perspectives in financial metrics, leading to semantic conflicts (e.g., Executive "Revenue" showing customer payments instead of TravelHub earnings).

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

### 3. Revenue Authority

**TravelHub Revenue** represents TravelHub-owned revenue streams:

```text
TravelHub Total Revenue = Marketplace Revenue + Storefront SaaS Revenue + future streams
```

Current components:
- **Marketplace Revenue** = marketplace commission / other marketplace-owned fees
- **Storefront SaaS Revenue** = subscription/billing revenue earned by TravelHub

Storefront partner commerce does NOT become TravelHub Revenue.

### 4. Net Revenue Tree

```text
Marketplace Revenue − applicable deductions = Marketplace Net Revenue
Storefront SaaS Revenue − applicable deductions = Storefront SaaS Net Revenue
TravelHub Total Net Revenue = Marketplace Net Revenue + Storefront SaaS Net Revenue + future
```

### 5. Revenue Recognition Semantics

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

For Marketplace: determine when commission becomes expected/earned/collected/reversed.

For Storefront SaaS: current data model cannot prove actual payment.

**Critical invariant:**
```text
ACTIVE subscriptions × $199 ≠ actual Storefront Revenue
```

At most this represents list-price subscription value / list-price MRR.

### 6. Pricing Authority

**Current canonical list price:** Premium Storefront = $199/month

**Architecture must support future:**
- percentage discount
- fixed discount
- custom / negotiated price
- promotion
- free period
- introductory price
- time-limited campaign

### 7. Revenue Mix — Management View

TravelHub management must see business model contribution:

```text
TravelHub Total Revenue
├── Marketplace Revenue (Z%)
└── Storefront SaaS Revenue (V%)
```

And analogously for Net Revenue.

### 8. Command Center Information Architecture

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

### 9. Analytics Information Architecture

```text
[ TravelHub ] [ Marketplace ] [ Storefront SaaS ]
```

- **TravelHub**: Corporate/consolidated analytics, Revenue Mix, business contribution
- **Marketplace**: Deep marketplace analytics (GMV, Orders, Commission, etc.)
- **Storefront SaaS**: SaaS analytics (MRR, ARR, Subscriptions, Churn, etc.)

### 10. Financial Information Architecture

```text
[ Consolidated ] [ Marketplace ] [ Storefront SaaS ]
```

### 11. Partner Classification

A partner may have both relationships:
- Marketplace Seller = YES
- Storefront Subscriber = YES

Do not classify as exclusively one or the other.

### 12. Platform Signal Ownership

Is this condition materially within TravelHub's responsibility?

```text
Partner's own sales dropped 20% → primarily PARTNER workspace
Storefront checkout failures across 47 partners → PLATFORM Command Center
```

---

## Consequences

### Positive
- Clear revenue ownership and attribution
- Management can understand business model contribution
- Future billing engine fits naturally
- Decision Intelligence can reason about correct revenue streams

### Negative
- Requires renaming existing metrics (Executive Revenue → Payment Volume or TravelHub Revenue)
- Adds complexity to Command Center (Revenue Mix breakdown)
- Requires future billing engine for accurate SaaS revenue

---

## Implementation Stages

| Stage | Scope |
|---|---|
| Stage H | Rename Executive metrics, add TravelHub Revenue + Revenue Mix |
| Stage I | Storefront billing engine, actual paid revenue, MRR/ARR |
| Stage J | Full regression, security, evidence closure |

---

## Review

- Architecture Reconciliation: APPROVED (Phase 3 Architecture Addendum)
- Stage B.1: COMPLETED (this ADR)
- Pending: Stage H implementation, Stage I implementation
