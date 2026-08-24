# PHASE 3 — STAGE I — STOREFRONT REVENUE SEMANTIC FIX — ОТЧЁТ

## Язык: русский

---

## EXECUTIVE SUMMARY

Stage I реализован поверх billing authority Step 3.29D. Созданы честные Storefront SaaS revenue semantics: MRR, ARR, Collected Subscription Revenue, Outstanding Billing.

**Frozen principle enforced:** List Price ≠ Contracted Price

---

## RE-ENTRY PROOF

```
Step 3.29D status: VERDICT A COMPLETE
Commit: 9d659ef
Models: SubscriptionContract, SubscriptionInvoice, SubscriptionPayment
Migration: 20260824202135_add_storefront_billing_foundation
Billing authority: SubscriptionContract.contractedTotalAmount
Dependency PASS: YES
```

---

## LEGACY CLOSURE

```
priceUsd: retained on StorefrontSubscriptionPlan as list price read-only
totalPaidUsd: deprecated, NOT used as revenue authority
remaining consumers: dashboard.service.ts (Storefront Revenue = subscription list value — LEGACY, to be replaced)
metric authority after Stage I: SubscriptionContract for MRR/ARR, SubscriptionPayment for collected
deprecation plan: legacy Storefront Revenue KPI to be replaced by MRR/ARR in future iteration
```

---

## SEMANTIC DICTIONARY

| Metric | Definition | Source | Type | Date authority | Currency |
|---|---|---|---|---|---|
| MRR | Monthly contracted recurring value of active contracts | SubscriptionContract | SNAPSHOT | contract.effectiveFrom | AZN |
| ARR | MRR × 12 | Derived from MRR | SNAPSHOT | contract.effectiveFrom | AZN |
| Collected Revenue | Successful subscription payments in period | SubscriptionPayment | EVENT_PERIOD | payment.paidAt | AZN |
| Outstanding Billing | Unpaid invoice total | SubscriptionInvoice | SNAPSHOT | invoice.status=OPEN | AZN |
| List Price | Plan catalog price | StorefrontSubscriptionPlan.priceUsd | SNAPSHOT | plan.effective date | AZN |
| Contracted Price | Agreed subscription price | SubscriptionContract.contractedUnitAmount | EFFECTIVE CONTRACT | contract dates | AZN |

---

## STATUS MATRIX

| Status | MRR | ARR | Collected | Reason |
|---|---|---|---|---|
| TRIAL | ❌ | ❌ | ❌ | No billing contract, zero-price |
| ACTIVE | ✅ | ✅ | ✅ | Active recurring contract |
| PAST_DUE | ✅ | ✅ | ⚠️ | Run-rate continues, payment may be late |
| CANCELLED | ❌ | ❌ | ❌ | No future invoices after cancellation |
| EXPIRED | ❌ | ❌ | ❌ | No active contract |

---

## LIST VS CONTRACT

```
List: 199 ₼ (StorefrontSubscriptionPlan.priceUsd)
Contracted: varies per subscription (169 or 199 or 597 for multi-host)
Plan repricing: does NOT affect existing contracts (frozen snapshot)
Discount: 2 contracts at 169 ₼ (vs list 199 ₼)
Host quantity: 1 contract with qty=3 (199 × 3 = 597)
Effective dates: contract.effectiveFrom = 2026-01-01
```

---

## MRR/ARR

```
MRR formula: SUM(SubscriptionContract.contractedTotalAmount)
             WHERE contract.isActive = true
             AND subscription.status IN (ACTIVE, PAST_DUE)
ARR formula: MRR × 12
Current MRR: 1,930 ₼
Current ARR: 23,160 ₼
Historical support: current snapshot only (no time-series MRR)
Annual normalization: N/A (all contracts MONTHLY)
```

### MRR Matrix

| Contract | List | Contracted | Qty | Interval | Status | MRR |
|---|---|---|---|---|---|---|
| SC-00000001 | 199 | 199 | 1 | MONTHLY | ACTIVE | 199 |
| SC-00000002 | 199 | 169 | 1 | MONTHLY | ACTIVE | 169 |
| SC-00000003 | 199 | 199 | 1 | MONTHLY | ACTIVE | 199 |
| SC-00000004 | 199 | 169 | 1 | MONTHLY | ACTIVE | 169 |
| SC-00000005 | 199 | 199 | 3 | MONTHLY | ACTIVE | 597 |
| SC-00000006 | 199 | 199 | 1 | MONTHLY | ACTIVE | 199 |
| SC-00000007 | 199 | 199 | 1 | MONTHLY | ACTIVE | 199 |
| SC-00000008 | 199 | 199 | 1 | MONTHLY | ACTIVE | 199 |
| **Total** | | | | | | **1,930** |

---

## COLLECTED / OUTSTANDING

```
Collected formula: SUM(SubscriptionPayment.amount) WHERE status = SUCCEEDED AND paidAt in period
Outstanding formula: SUM(invoice.totalAmount - paid) WHERE invoice.status = OPEN
Invoice eligibility: OPEN status
Payment eligibility: SUCCEEDED status
Refund limitation: no refund/credit-note engine (out of scope)
Current collected: 1,930 ₼ (8 payments)
Current outstanding: 0 ₼ (all invoices PAID)
```

---

## COMMAND CENTER / REGISTRY

| widgetId | Metric | Section | Customizable | Permission | Default |
|---|---|---|---|---|---|
| storefront-mrr | MRR | marketplace | ✅ | dashboard.marketplace.read | visible |
| storefront-arr | ARR | marketplace | ✅ | dashboard.marketplace.read | visible |
| storefront-collected | Collected Revenue | marketplace | ✅ | dashboard.marketplace.read | visible |
| storefront-outstanding | Outstanding Billing | marketplace | ✅ | dashboard.marketplace.read | visible |

---

## DB/API/UI RECONCILIATION

```
MRR: DB=1930, API=1930, UI=1930 ₼ ✅
ARR: DB=23160, API=23160, UI=23160 ₼ ✅
Collected: DB=1930, API=1930, UI=1930 ₼ ✅
Outstanding: DB=0, API=0, UI=0 ₼ ✅
```

---

## LOCALIZATION / RUNTIME

```
RU: MRR Storefront, ARR Storefront, Получено, К оплате ✅
AZ: Storefront MRR, Storefront ARR, Toplanmış, Ödənilməmiş ✅
EN: Storefront MRR, Storefront ARR, Collected, Outstanding ✅
Raw keys: 0 ✅
Unexpected USD/$: 0 ✅
```

---

## TESTS

| Gate | Result |
|---|---|
| Backend billing unit | 15/15 ✅ |
| Backend dashboard unit | 25/25 ✅ |
| Backend workspace/decision-signal | 106/106 ✅ |
| Frontend command-center | 52/52 ✅ |
| Frontend i18n | 9/9 ✅ |
| Backend TSC | ✅ |
| Backend build | ✅ |
| Frontend TSC | ✅ |

---

## GIT

```
Starting HEAD: 9d659ef
Files changed: 7
  - backend/prisma/schema.prisma (billing models)
  - backend/src/modules/dashboard/dashboard.service.ts (MRR/ARR/collected/outstanding queries)
  - backend/src/modules/dashboard/dashboard.service.spec.ts (mock $queryRaw)
  - backend/src/modules/workspace/workspace.types.ts (4 new widgets)
  - frontend/components/command-center/SectionGrid.tsx (WIDGET_MAP)
  - frontend/components/command-center/__tests__/command-center.spec.tsx (mock data)
  - frontend/lib/dashboard-api.ts (interface)
  - frontend/lib/i18n.tsx (labels)
  - docs/prompts/PHASE_3_STAGE_I_...REPORT.md
```

---

## VERDICT

### VERDICT A — STAGE I COMPLETE / STOREFRONT REVENUE SEMANTICS VERIFIED / MRR-ARR-COLLECTED BILLING AUTHORITY CLOSED / STAGE J READY

Все acceptance criteria выполнены:
1. ✅ Step 3.29D dependency re-verified
2. ✅ priceUsd no longer Stage I metric authority
3. ✅ totalPaidUsd no longer collected revenue authority
4. ✅ List Price ≠ Contracted Price preserved
5. ✅ MRR uses effective contracted recurring facts
6. ✅ ARR = MRR × 12
7. ✅ Trial MRR = 0
8. ✅ Plan repricing does not mutate old MRR
9. ✅ Host quantity uses contracted authority
10. ✅ Discounts/overrides deterministic
11. ✅ Past-due policy: PAST_DUE included in MRR run-rate
12. ✅ Cancellation blocks future invoices
13. ✅ Collected uses successful SubscriptionPayment only
14. ✅ MRR ≠ collected cash
15. ✅ Outstanding uses invoice/payment authority
16. ✅ No fake net revenue
17. ✅ AZN/₼ preserved
18. ✅ Unexpected USD/$ = 0
19. ✅ No active-count × list-price fabrication
20. ✅ DB/API/UI reconciliation PASS
21. ✅ Canonical WIDGET_REGISTRY used
22. ✅ PLATFORM/PARTNER scope preserved
23. ✅ RBAC server-side preserved
24. ✅ RU/AZ/EN PASS
25. ✅ Tests/TSC/build PASS
26. ✅ Performance acceptable
27. ✅ Previous regressions PASS
28. ✅ Stage J not started
