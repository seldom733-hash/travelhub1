# PHASE 3 — STAGE I — ENTRY GATE — STEP 3.29D DEPENDENCY AUDIT

## Язык: русский

---

## EXECUTIVE SUMMARY

**VERDICT C — STAGE I BLOCKED / STEP 3.29D BILLING ENGINE AUTHORITY REQUIRED**

Stage I (Storefront Revenue Semantic Fix) не может быть реализована, потому что billing engine (Step 3.29D) не существует. Текущая модель содержит только list price (`priceUsd`), без invoice generation, payment processing, contracted pricing, billing periods, discount/override системы.

**Production code changed: NO**

---

## STEP 3.29D DEPENDENCY AUDIT

```
Step 3.29D canonical name: Billing Engine / Subscription Billing Foundation
Canonical status: NOT IMPLEMENTED
Implementation evidence: NONE
Commit/report: NONE
Runtime evidence: NONE
Dependency satisfied: NO
```

### Доказательства отсутствия

1. **Код billing engine:** Не найден. Нет модуля `billing`, `subscription-billing`, `invoice-generation`, `charge`, `payment-schedule`.

2. **ADR documentation:** `ADR-PLATFORM-BUSINESS-PERSPECTIVE-SEPARATION.md` прямо указывает:
   ```
   Stage I | Storefront billing engine, actual paid revenue, MRR/ARR, priceUsd migration
   ```
   и
   ```
   Requires future billing engine for accurate SaaS revenue
   ```

3. **Roadmap:** `PHASE_3_CANONICAL_ROADMAP_FULL_RECONCILIATION_SEQUENCE_VALIDATION_REPORT.md`:
   ```
   Storefront billing foundation | HIGH | Stage I / 3.29D | Billing engine | Not started
   ```

4. **Invoice model:** Существует в Prisma schema (`finance.Invoice`), но генерация отложена:
   ```
   // генерация/жизненный цикл Invoice — 2.14
   ```

---

## BILLING AUTHORITY CHECKLIST

| Requirement | Status | Evidence |
|---|---|---|
| Subscription/customer contract identity | ✅ StorefrontSubscription exists | schema.prisma:1330 |
| Plan identity | ✅ StorefrontSubscriptionPlan exists | schema.prisma:1302 |
| Contracted price | ❌ NOT EXISTS | Only `priceUsd` (list price) |
| Billing currency | ⚠️ `priceUsd` field name implies USD | Schema comment: "Monthly price in USD" |
| Billing interval | ⚠️ `periodDays` exists | But no billing cycle management |
| effectiveFrom/effectiveTo | ⚠️ `currentPeriodStart/End` exists | But not managed by billing engine |
| Subscription status | ✅ StorefrontSubscriptionStatus enum | ACTIVE, CANCELLED, etc. |
| Trial semantics | ⚠️ FREE_TRIAL planType exists | But no trial→paid conversion logic |
| Discount/override semantics | ❌ NOT EXISTS | No contracted price, no discounts |
| Price change semantics | ❌ NOT EXISTS | Changing plan price affects all subscribers |
| Cancellation semantics | ⚠️ `cancelledAt` field exists | But no billing engine to process |
| Renewal semantics | ❌ NOT EXISTS | No auto-renewal, no invoice generation |

**Result: 4/12 requirements satisfied. 8 critical gaps.**

---

## CURRENT DATA STATE

### Plans
| Code | Name | Type | priceUsd | periodDays |
|---|---|---|---|---|
| SUB-PLAN-001 | First Month Free | FREE_TRIAL | 0.00 | 30 |
| SUB-PLAN-002 | Premium | PREMIUM | 199.00 | 30 |

### Subscriptions
| Plan | Count | totalPaidUsd |
|---|---|---|
| FREE_TRIAL | 3 | 0 |
| PREMIUM | 8 | 7,164 |

### Critical Observation

`priceUsd` stores **list price** ($199), not contracted price. There is no mechanism to:
- Create partner-specific pricing
- Apply discounts
- Generate invoices
- Process payments
- Track actual collected subscription revenue

The `totalPaidUsd` field exists but is **manually set by seed data**, not by a billing engine.

---

## WHY STAGE I CANNOT SAFELY PROCEED

1. **MRR cannot be computed accurately:** Without contracted prices, MRR = `count(ACTIVE) × list price` = fabrication. The ADR explicitly states this is incorrect.

2. **ARR cannot be computed accurately:** Same as MRR.

3. **Collected Revenue cannot be proven:** No invoice/payment processing exists. `totalPaidUsd` is seed-assigned.

4. **priceUsd migration is unsafe:** The field stores USD-denominated values. Renaming to AZN without a billing engine to actually charge in AZN would create semantic confusion.

5. **Dynamic pricing cannot be implemented:** No pricing/discount/override model exists.

6. **Host-count billing cannot be implemented:** No seat/quantity model exists.

---

## WHAT MUST BE IMPLEMENTED FIRST

Step 3.29D requires, at minimum:

```
1. Subscription billing engine
   - Invoice generation per billing period
   - Charge processing (at minimum mock/deferred)
   - Payment status tracking
   - Renewal cycle management

2. Contracted pricing model
   - Partner-specific price overrides
   - Discount/promotion support
   - Effective date management
   - Price change isolation (existing contracts unaffected)

3. Currency authority
   - Canonical billing currency (AZN)
   - Historical priceUsd values preserved or migrated with policy

4. Billing period management
   - Current period tracking
   - Period boundary enforcement
   - Past-due handling

5. Trial→Paid conversion
   - FREE_TRIAL → PREMIUM transition logic
   - Trial expiry handling
```

---

## PRODUCTION CODE CHANGED

**NO.** No production code was modified during this Stage I entry gate audit.

---

## VERDICT

### VERDICT C — STAGE I BLOCKED / STEP 3.29D BILLING ENGINE AUTHORITY REQUIRED

Stage I cannot safely proceed without a billing engine. The current `priceUsd` / `totalPaidUsd` model is a seed-time approximation, not an authoritative billing system. Computing MRR/ARR from list price would violate the frozen principle:

```
Plan/List Price ≠ Contracted Subscription Price
```

### Next Steps

1. Implement Step 3.29D — Subscription Billing Foundation
2. After Step 3.29D completes → re-evaluate Stage I entry gate
3. Stage J remains blocked until Stage I completes
