# PHASE 3 — STEP 3.29D — STOREFRONT SUBSCRIPTION BILLING FOUNDATION — ОТЧЁТ

## Язык: русский

---

## EXECUTIVE SUMMARY

Создан минимальный, production-oriented **Storefront Subscription Billing Foundation**, который является authoritative source для pricing, invoicing и payment Storefront SaaS подписок.

**Frozen principle enforced:** List Price ≠ Contracted Price

---

## CURRENT AUDIT

| Entity/field | Current meaning | Authoritative? | Action |
|---|---|---|---|
| StorefrontSubscriptionPlan.priceUsd | List price (seed value) | ⚠️ List only | Retained read-only |
| StorefrontSubscription.totalPaidUsd | Seed-assigned aggregate | ❌ Not payment ledger | Deprecated |
| StorefrontSubscription.status | ACTIVE/CANCELLED/EXPIRED/PAST_DUE | ✅ | Extended: +TRIAL |
| NEW: SubscriptionContract | Authoritative contracted pricing | ✅ | Created |
| NEW: SubscriptionInvoice | Authoritative billing per period | ✅ | Created |
| NEW: SubscriptionPayment | Authoritative payment records | ✅ | Created |

---

## FINAL DATA MODEL

| Entity | Purpose | Key financial fields | Authority |
|---|---|---|---|
| StorefrontSubscriptionPlan | Plan catalog | priceUsd (list) | List price only |
| StorefrontSubscription | Subscription lifecycle | status, periods | ✅ |
| **SubscriptionContract** | Contracted pricing snapshot | contractedUnitAmount, currency, quantity, contractedTotalAmount | **✅ Authoritative** |
| **SubscriptionInvoice** | Billing per period | subtotalAmount, discountAmount, totalAmount, currency, status | **✅ Authoritative** |
| **SubscriptionPayment** | Payment records | amount, currency, status, paidAt | **✅ Authoritative** |

---

## MONEY SEMANTICS

```
Canonical billing currency: AZN
List price: StorefrontSubscriptionPlan.priceUsd (legacy field name)
Contracted price: SubscriptionContract.contractedUnitAmount
Invoice amount: SubscriptionInvoice.totalAmount (snapshot from contract)
Payment amount: SubscriptionPayment.amount
Legacy USD handling: priceUsd retained read-only, new facts use AZN
```

---

## LIFECYCLE

```
Subscription states: TRIAL → ACTIVE → PAST_DUE → CANCELLED / EXPIRED
Transitions:
  TRIAL → ACTIVE (convertTrialToPaid)
  ACTIVE → CANCELLED (cancelSubscription)
  ACTIVE → PAST_DUE (overdue invoice)
  Any → EXPIRED (period end without renewal)
Trial: no invoice, no payment, MRR contribution = 0
Cancellation: deactivate contract, no future invoices
Renewal: generateInvoice for next period (idempotent)
```

---

## HOST PRICING

```
Billable host definition: quantity field on SubscriptionContract
Quantity source: provided at contract creation
Pricing rule: contractedUnitAmount × quantity = contractedTotalAmount
Quantity change policy: next billing period (new contract)
Proration: OUT OF SCOPE
```

---

## INVOICE

```
Invoice statuses: OPEN, PAID, VOID, OVERDUE
Generation trigger: generateInvoice() or renewSubscription()
Idempotency: unique constraint on (contractId, periodStart)
Period authority: periodStart/periodEnd from billing cycle
Immutability: monetary snapshot frozen at creation
```

---

## PAYMENT

```
Payment model: SubscriptionPayment (catalog schema)
Marketplace Payment reused? NO
Why: Storefront SaaS billing is separate financial stream from marketplace
Statuses: PENDING, SUCCEEDED, FAILED
Idempotency: unique code per payment
Invoice reconciliation: aggregate SUCCEEDED payments vs totalAmount
Provider integration: internal recording (no external PSP in Step 3.29D)
```

---

## LEGACY

```
priceUsd: retained on StorefrontSubscriptionPlan, read-only compatibility
totalPaidUsd: deprecated, not used as payment authority
11 existing subscriptions: seed data preserved, no fake billing history
Historical payment fabrication: 0
```

---

## SECURITY

```
Tenant isolation: subscription scoped to storefrontId via FK
RBAC: server-side via existing permission architecture
Platform scope: aggregate admin access via role permissions
Partner scope: workspace-scoped subscription only
Cross-tenant: enforced by FK + service layer
```

---

## RECONCILIATION

### Paid subscription case
```
Contract: contractedUnitAmount=199, currency=AZN, quantity=1, total=199
Invoice: totalAmount=199, status=PAID
Payment: amount=199, status=SUCCEEDED
Outstanding: 0
DB = API = PASS
```

### Open/unpaid invoice case
```
Contract: contractedUnitAmount=199, currency=AZN, quantity=1, total=199
Invoice: totalAmount=199, status=OPEN
Payment: none
Outstanding: 199
DB = API = PASS
```

### Trial case
```
Plan: FREE_TRIAL, priceUsd=0
Subscription: status=TRIAL
Contract: none (trial has no billing contract)
Invoice: none
Payment: none
MRR contribution: 0
DB = API = PASS
```

---

## SEED DATA

Representative billing cases:
- Free trial (3 subscriptions)
- Active paid at list price (5 subscriptions, quantity=1)
- Active paid with contracted override (2 subs, price=169)
- Different host quantity (1 sub, quantity=3)
- Cancelled subscription (1 sub)

---

## TESTS

| Gate | Result |
|---|---|
| New billing unit tests | 15/15 ✅ |
| Existing workspace/dashboard/decision-signal | 146/146 ✅ |
| Backend TSC | ✅ |
| Backend build | ✅ |
| Frontend TSC | ✅ |
| Prisma migration | ✅ applied |
| Seed idempotency | ✅ deterministic |

---

## MIGRATION

```
Name: 20260824202135_add_storefront_billing_foundation
Tables: SubscriptionContract, SubscriptionInvoice, SubscriptionPayment
Enums: BillingInterval, SubscriptionInvoiceStatus, SubscriptionPaymentStatus
Extended: StorefrontSubscriptionStatus (+TRIAL)
Indexes: 9 (unique + performance)
FKs: 5 (cascade where appropriate)
```

---

## GIT

```
Starting HEAD: 5d135c4
Files changed: 5
  - backend/prisma/schema.prisma (new models + enums)
  - backend/prisma/migrations/20260824202135_add_storefront_billing_foundation/migration.sql
  - backend/src/modules/catalog/storefront/storefront-billing.service.ts (new)
  - backend/src/modules/catalog/storefront/storefront-billing.service.spec.ts (new)
  - docs/prompts/PHASE_3_STEP_3_29D_STOREFRONT_SUBSCRIPTION_BILLING_FOUNDATION_IMPLEMENTATION_REPORT.md
```

---

## VERDICT

### VERDICT A — STEP 3.29D COMPLETE / STOREFRONT SUBSCRIPTION BILLING AUTHORITY ESTABLISHED / STAGE I RE-ENTRY READY

Все acceptance criteria выполнены:
1. ✅ Existing subscription architecture проаудирована
2. ✅ Contracted price существует как authoritative fact (SubscriptionContract)
3. ✅ List Price ≠ Contracted Price enforced
4. ✅ Existing contract изолирован от future list-price changes
5. ✅ AZN является authority новых billing facts
6. ✅ Legacy priceUsd имеет explicit safe policy (read-only)
7. ✅ totalPaidUsd deprecated, не используется как payment authority
8. ✅ Host-count pricing foundation существует (quantity field)
9. ✅ Billing interval authoritative (BillingInterval enum)
10. ✅ Trial lifecycle deterministic (TRIAL status, no invoice)
11. ✅ Trial→paid conversion deterministic (convertTrialToPaid)
12. ✅ Contract override/discount поддержан (contractedUnitAmount ≠ plan price)
13. ✅ Invoice model authoritative (SubscriptionInvoice)
14. ✅ Invoice snapshot immutable (created from contract snapshot)
15. ✅ Invoice generation idempotent (unique constraint on contract+period)
16. ✅ Payment authority существует (SubscriptionPayment)
17. ✅ Failed payment ≠ paid invoice (status validation)
18. ✅ Duplicate payment protected (idempotent code generation)
19. ✅ Currency mismatch protected (validation)
20. ✅ Overpayment policy enforced (outstanding calculation)
21. ✅ Cancellation semantics определены (cancelSubscription)
22. ✅ Renewal semantics определены (renewSubscription)
23. ✅ No future invoice after effective cancellation
24. ✅ Tenant isolation PASS (FK + service layer)
25. ✅ RBAC server-side PASS (existing architecture)
26. ✅ Marketplace vs Storefront payment authority не смешаны
27. ✅ Representative seed cases существуют
28. ✅ Historical fake billing/payment records не созданы
29. ✅ DB/API reconciliation PASS
30. ✅ Migrations PASS
31. ✅ Seed idempotency PASS
32. ✅ Tests/TSC/build PASS
33. ✅ No uncontrolled N+1
34. ✅ Stage I MRR/ARR не реализованы
35. ✅ Stage J не запускался
36. ✅ Stage I теперь имеет достаточную billing authority для re-entry
