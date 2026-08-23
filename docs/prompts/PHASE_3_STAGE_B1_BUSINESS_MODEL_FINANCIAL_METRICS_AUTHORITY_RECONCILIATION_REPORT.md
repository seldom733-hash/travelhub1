# PHASE 3 — STAGE B.1 — BUSINESS MODEL & FINANCIAL METRICS AUTHORITY RECONCILIATION — REPORT

**Status:** RECONCILIATION COMPLETED — WAITING FOR REVIEW

**Verdict:** VERDICT B — REMEDIATION REQUIRED (semantic conflicts found, architecture decisions documented)

---

## Executive Summary

Stage B.1 audited the current repository for semantic correctness of financial metrics across Executive, Channel Health, Financial, Analytics, and i18n. Found **4 semantic conflicts** that require remediation in later stages. Created ADR and documented all accepted architecture decisions. Roadmap reconciliation produced.

---

## A. Current-State Economic Audit

### Executive Section

| KPI | Formula | Source | What it means |
|---|---|---|---|
| **GMV** | `SUM(Order.amount)` WHERE status=FULFILLED | `order.Order` | Total value of fulfilled orders (ALL channels) |
| **Revenue** | `SUM(Payment.amount)` WHERE status=CAPTURED | `finance.Payment` (paidAt) | Total customer payments (ALL channels) |
| **Net Revenue** | `Revenue - SUM(Refund.amount)` | `finance.Payment` - `finance.Refund` | Customer payments minus refunds |

### Channel Health Section

| KPI | Formula | Source | What it means |
|---|---|---|---|
| **GMV Marketplace** | `SUM(Order.paidAmount)` WHERE channel=MARKETPLACE | `order.Order` | Marketplace transaction volume |
| **GMV Storefront** | `SUM(Order.paidAmount)` WHERE channel=STOREFRONT | `order.Order` | Storefront partner commerce volume |
| **Revenue Marketplace** | `SUM(Commission.amount)` WHERE channel=MARKETPLACE | `finance.Commission` | TravelHub commission from Marketplace |
| **Revenue Storefront** | `SUM(SubscriptionPlan.priceUsd)` WHERE active | `catalog.StorefrontSubscription` | Subscription value (NOT paid revenue) |

### Analytics Section

| KPI | Formula | Source |
|---|---|---|
| **GMV** | `SUM(Order.amount)` WHERE status=FULFILLED | `order.Order` |
| **Revenue** | `SUM(Payment.amount)` WHERE status=CAPTURED | `finance.Payment` |
| **Net Revenue** | `Revenue - Refunds` | `finance.Payment` - `finance.Refund` |
| **Commission** | `SUM(Commission.amount)` | `finance.Commission` |

### Financial Reconciliation

| KPI | Formula | Source |
|---|---|---|
| **Commission Accrued** | `SUM(Commission.amount)` | `finance.Commission` |
| **Net Receivable** | `Payments - Refunds - Commissions` | `finance.Payment` - `finance.Refund` - `finance.Commission` |

---

## B. Metric Authority Matrix

| Metric | Business Owner | Definition | Source of Truth | Current Implementation | Status |
|---|---|---|---|---|---|
| Marketplace GMV | Marketplace | Total transaction volume on Marketplace | `Order.paidAmount` WHERE channel=MARKETPLACE | ✅ Channel Health + Executive (combined) | CORRECT |
| Storefront Commerce Volume | Storefront SaaS | Partner commerce through Storefront | `Order.paidAmount` WHERE channel=STOREFRONT | ✅ Channel Health | CORRECT |
| Platform Commerce Volume | Platform | Marketplace GMV + Storefront Commerce | Not implemented | ❌ Not calculated | FUTURE |
| Marketplace Revenue | Marketplace | TravelHub commission from Marketplace sales | `Commission.amount` WHERE channel=MARKETPLACE | ✅ Channel Health | CORRECT |
| Storefront SaaS Revenue | Storefront SaaS | TravelHub subscription revenue | `SubscriptionPlan.priceUsd` (list price) | ⚠️ Channel Health | AMBIGUOUS (see Conflict #1) |
| TravelHub Total Revenue | Platform | Marketplace Revenue + Storefront SaaS Revenue | Not implemented | ❌ Executive shows customer payments, not TravelHub revenue | CONFLICT (see Conflict #2) |
| Marketplace Net Revenue | Marketplace | Marketplace Revenue - Marketplace deductions | Not implemented | ❌ Not calculated | FUTURE |
| Storefront SaaS Net Revenue | Storefront SaaS | SaaS Revenue - SaaS deductions | Not implemented | ❌ Not calculated | FUTURE |
| TravelHub Total Net Revenue | Platform | Marketplace Net + SaaS Net | Not implemented | ❌ Executive shows customer payments minus refunds | CONFLICT (see Conflict #2) |
| MRR | Storefront SaaS | Monthly Recurring Revenue | Not implemented | ❌ Not calculated | FUTURE |
| ARR | Storefront SaaS | Annual Recurring Revenue | Not implemented | ❌ Not calculated | FUTURE |
| List-price MRR | Storefront SaaS | Active subscriptions × list price | `SUM(SubscriptionPlan.priceUsd)` WHERE active | ⚠️ Channel Health | PARTIAL (no label distinction) |
| Contracted MRR | Storefront SaaS | Active subscriptions × contracted price | Not implemented | ❌ | FUTURE |
| Billed Revenue | Finance | Invoiced amount | Not implemented | ❌ | FUTURE |
| Collected Revenue | Finance | Paid amount | Not implemented | ❌ | FUTURE |
| Refunds/Credits | Finance | Processed refunds | `SUM(Refund.amount)` WHERE status=PROCESSED | ✅ Analytics/Financial | CORRECT |

---

## C. Financial Revenue Tree

### Current (Actual)

```
Executive Revenue (CUSTOMER PAYMENTS — ALL CHANNELS)
├── Marketplace customer payments
└── Storefront customer payments

Executive Net Revenue = Executive Revenue - Refunds

Channel Health Marketplace Revenue = TravelHub Commission
Channel Health Storefront Revenue = Subscription List Price
```

### Target (Canonical)

```
TravelHub Total Revenue
├── Marketplace Revenue (Commission)
│   ├── Marketplace Commission Accrued
│   └── Future: marketplace fees, premium placement, etc.
├── Storefront SaaS Revenue (Subscriptions)
│   ├── List-price MRR
│   └── Future: contracted MRR, discounts, promotions
└── Future TravelHub-owned revenue streams

TravelHub Total Net Revenue
├── Marketplace Net Revenue = Marketplace Revenue - Direct Deductions
├── Storefront SaaS Net Revenue = SaaS Revenue - SaaS Deductions
└── Future net revenue streams
```

### Key Distinction

```
Marketplace GMV (what customers paid)        ≠ Marketplace Revenue (what TravelHub earned)
Storefront Commerce Volume (partner sales)   ≠ Storefront SaaS Revenue (TravelHub subscription income)
Executive Revenue (customer payments)        ≠ TravelHub Revenue (our earnings)
```

---

## D. UI Responsibility Matrix

| Platform Area | Required Business Separation | Current State | Gap |
|---|---|---|---|
| **Command Center** | Single overview + business blocks | ✅ Executive (combined) + Channel Health (split) | Missing TravelHub Revenue breakdown |
| **Analytics** | TravelHub / Marketplace / Storefront SaaS | ❌ Single view | No business model tabs |
| **Financial** | Consolidated / Marketplace / Storefront SaaS | ❌ Single view | No business model tabs |
| **Orders** | Channel filter | ✅ AcquisitionSource available | Filter not exposed in UI |
| **Bookings** | Channel filter | ✅ AcquisitionSource available | Filter not exposed in UI |
| **Partners** | Relationship dimensions | ❌ Single view | No Marketplace/Storefront dimension |
| **Catalog** | Publication channel | ✅ ProductPublicationChannel | Filter not exposed in UI |
| **Sales** | Business-model-specific pipelines | ❌ Single pipeline | Future |
| **Needs Attention** | Unified TravelHub-owned decision queue | ✅ Unified | Correct |
| **Decision Feed** | Unified feed + business-domain badge | ⚠️ Hardcoded | Future |

---

## E. Semantic Conflicts

### Conflict #1: Storefront Revenue = List Price, NOT Paid Revenue

**Location:** `dashboard.service.ts` Channel Health

**Current behavior:**
```sql
Storefront Revenue = SUM(SubscriptionPlan.priceUsd)
  WHERE ACTIVE subscriptions AND currentPeriod overlaps
```

**Why incorrect/ambiguous:**
- This calculates **list-price subscription value**, not actual paid revenue
- No billing/payment ledger exists — cannot prove actual collection
- No discount/promotion/negotiated pricing support
- Label says "Revenue" but it's "Contracted Value" or "List-price MRR"

**Target behavior:**
- Label as "List-price MRR" or "Subscription Value (list price)"
- Future: actual billed/collected revenue from billing engine
- Preserve dynamic pricing capability

**Implementation stage:** Stage I (Storefront financial/billing scope)

---

### Conflict #2: Executive Revenue = Customer Payments, NOT TravelHub Revenue

**Location:** `analytics.service.ts` → Executive Section

**Current behavior:**
```
Executive Revenue = SUM(Payment.amount) WHERE status=CAPTURED (ALL channels)
Executive Net Revenue = Revenue - Refunds
```

**Why incorrect:**
- This is **customer payment volume** (GMV-like), NOT TravelHub's earned revenue
- TravelHub earns commissions (Marketplace) and subscriptions (Storefront SaaS)
- Showing "Revenue: 14,808" when TravelHub earned ~2,528 creates misleading impression
- Director sees "Revenue" and assumes it's company revenue

**Target behavior:**
- Rename to "Payment Volume" or "Customer Payments" or keep as GMV
- Add separate "TravelHub Revenue" = Commission + Subscriptions
- Add "TravelHub Net Revenue" = TravelHub Revenue - applicable deductions

**Implementation stage:** Stage H (Section decision enrichment) or earlier

---

### Conflict #3: No Revenue Mix Visibility

**Location:** Command Center (missing)

**Current behavior:**
- No breakdown showing Marketplace vs Storefront SaaS contribution
- Director cannot see which business model produces revenue

**Why incorrect:**
- Architecture Addendum §8 mandates Revenue Mix visibility
- Management must understand business model contribution

**Target behavior:**
```
TravelHub Revenue: ₼X
├── Marketplace Commission: ₼Y (Z%)
└── Storefront SaaS: ₼W (V%)
```

**Implementation stage:** Stage H (Section decision enrichment)

---

### Conflict #4: i18n Label Inconsistency

**Location:** `frontend/lib/i18n.tsx`

**Current behavior:**
```
"cc.v3.channels.storefrontRevenue": { ru: "Подписки Storefront", ... }
```

**Why ambiguous:**
- Label says "Подписки" (Subscriptions) but variable is `storefrontRevenue`
- May confuse users: is it subscription revenue or storefront revenue?

**Target behavior:**
- Consistent naming: either "Storefront SaaS Revenue" or "Subscription Revenue"
- Must align with ADR terminology

**Implementation stage:** Stage H (along with other label updates)

---

## F. ADR — PLATFORM BUSINESS PERSPECTIVE SEPARATION

**Status:** ACCEPTED / MANDATORY

**Decision:**

```
MARKETPLACE BUSINESS ≠ STOREFRONT SaaS ≠ STOREFRONT COMMERCE
```

**Accepted Principles:**

1. **GMV Authority:** Marketplace GMV excludes Storefront Commerce Volume
2. **Revenue Authority:** TravelHub Revenue = Commission + SaaS Subscriptions (NOT customer payments)
3. **Net Revenue:** Must expose business-model contribution (Marketplace Net + SaaS Net)
4. **Pricing:** $199/month is current Premium LIST PRICE only; dynamic pricing preserved
5. **Command Center:** Single company overview + business blocks (NOT tabs)
6. **Analytics:** TravelHub / Marketplace / Storefront SaaS perspectives
7. **Financial:** Consolidated / Marketplace / Storefront SaaS perspectives
8. **Partner Analytics:** Storefront partner commerce belongs primarily to PARTNER workspace
9. **Platform Signals:** TravelHub PLATFORM signals require TravelHub relevance/actionability
10. **Terminology:** Use explicit terms (Marketplace Revenue, Storefront SaaS Revenue, etc.)

**Created:** `docs/architecture/ADR-PLATFORM-BUSINESS-PERSPECTIVE-SEPARATION.md`

---

## G. Roadmap Reconciliation

### Existing Canonical Steps (preserved)

| Step | Description | Status |
|---|---|---|
| Phase 3 Architecture Addendum | Platform vs Partner Workspace | ✅ APPROVED |
| Step 3.1 | Dashboard Command Center Backend | ✅ APPROVED |
| Step 3.2 | Platform Command Center UI | ✅ Stage A APPROVED, Stage B pending |
| Global Workspace Constructor | Foundation | ✅ APPROVED |
| Stage A | RBAC Remediation | ✅ VERDICT A |
| Stage B | Decision Signal Foundation | ✅ VERDICT A |

### Missing Steps (additive proposal)

| Proposed Step | Description | Dependencies | Status |
|---|---|---|---|
| **Stage B.1** | Business Model & Financial Metrics Authority Reconciliation | None | ✅ THIS REPORT |
| **Stage C** | Needs Attention → Decision Queue | Stage B | PLANNED |
| **Stage D** | Deterministic WHY Attribution | Stage B, C | PLANNED |
| **Stage E** | Impact & Severity | Stage D | PLANNED |
| **Stage F** | Action Routing | Stage C, E | PLANNED |
| **Stage G** | AI Decision Feed Reconciliation | Stage D, E | PLANNED |
| **Stage H** | Section Decision Enrichment (incl. Revenue Mix, TravelHub Revenue) | Stage B.1, B, C | PLANNED |
| **Stage I** | Storefront Financial/Billing Implementation Scope | Stage B.1 | PLANNED |
| **Stage J** | Full Regression / Security / Evidence Closure | All | PLANNED |

### Roadmap Patch

Insert after Stage B completion:

```
Stage B.1 — Business Model & Financial Metrics Authority Reconciliation [COMPLETED]
    ↓
Stage C — Needs Attention → Decision Queue [PLANNED]
    ↓
Stage D — Deterministic WHY Attribution [PLANNED]
    ↓
Stage E — Impact & Severity [PLANNED]
    ↓
Stage F — Action Routing [PLANNED]
    ↓
Stage G — AI Decision Feed Reconciliation [PLANNED]
    ↓
Stage H — Section Decision Enrichment [PLANNED]
    ↓
Stage I — Storefront Financial/Billing Scope [PLANNED]
    ↓
Stage J — Full Regression / Security / Evidence Closure [PLANNED]
```

---

## H. Implementation Impact

### Stages Requiring Changes

| Stage | Files/Modules Affected | Nature of Change |
|---|---|---|
| **Stage H** | `dashboard.service.ts`, `analytics.service.ts`, `i18n.tsx`, frontend sections | Rename Executive Revenue → Payment Volume; add TravelHub Revenue card; add Revenue Mix breakdown |
| **Stage I** | `schema.prisma`, billing module, `dashboard.service.ts` | Storefront billing engine; actual paid revenue; discounts; MRR/ARR |
| **Stage C** | `decision-signal.service.ts`, `pending-bookings.detector.ts` | Integrate Needs Attention counters into Decision Signals |
| **Stage G** | `ai-decision-feed.service.ts` | Reconcile AI with deterministic evidence |

### Files Requiring Semantic Corrections (Stage H)

| File | Current | Target |
|---|---|---|
| `dashboard.service.ts` L725-727 | Executive: gmv, revenue, netRevenue | Executive: gmv, travelHubRevenue, travelHubNetRevenue |
| `analytics.service.ts` L460-507 | revenue = payments, netRevenue = payments - refunds | Keep as-is but rename labels |
| `i18n.tsx` L571-573 | "Выручка", "Чистая выручка" | "Объём платежей", "Чистый объём платежей" OR keep + add TravelHub Revenue |
| `ChannelHealthResponse` L99-100 | storefrontRevenue (ambiguous) | storefrontSaaSRevenue (explicit) |

---

## Verdict

**VERDICT B — REMEDIATION REQUIRED**

Architecture decisions are documented. ADR is durable. But **4 semantic conflicts** remain that require implementation in later stages:

1. Storefront Revenue = list price, not paid revenue → Stage I
2. Executive Revenue = customer payments, not TravelHub revenue → Stage H
3. No Revenue Mix visibility → Stage H
4. i18n label inconsistency → Stage H

No blocking ambiguity remains for architecture. Implementation can proceed.

---

## Repository Evidence

```
HEAD:              1ce1eb4 (Stage B commit)
Worktree:          clean
Files created:     ADR document, this report
Code changes:      0 (audit-only stage)
```

---

## NEXT

`PHASE 3 — COMMAND CENTER DECISION INTELLIGENCE — STAGE C — NEEDS ATTENTION → DECISION QUEUE`

Stage B.1 does NOT block Stage C. Stage C can proceed independently.

Semantic remediation (Conflicts #1-4) is scheduled for Stage H and Stage I.
