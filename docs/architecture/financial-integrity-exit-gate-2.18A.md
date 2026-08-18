# FINANCIAL INTEGRITY EXIT GATE — STEP 2.18A

**Date:** 2026-08-18
**Branch:** master
**Step:** 2.18A — Financial Integrity Exit Gate

---

## 1. PURPOSE

Prove that TravelHub's internal financial facts remain correct, atomic, traceable, idempotent, non-duplicated, and consistent across canonical Phase 2 domains.

---

## 2. SCOPE

- Payment lifecycle authority
- Commission/CommissionAccrual authority
- Ledger/Finance authority
- Money/Decimal exactness
- Currency integrity
- Frozen monetary facts
- Causation/traceability
- Transaction atomicity
- EventBus financial correctness
- Idempotency layers
- Concurrency safety
- DB constraints

## 3. NON-SCOPE

- PSP/provider integration (2.12B BLOCKED)
- ProviderFee accounting (deferred)
- Payout/split runtime (deferred)
- Card data handling (forbidden)
- Performance qualification (2.17B)
- RLS implementation (ADR-0014 deferred)

---

## 4. FINANCIAL AUTHORITY MAP

| Financial fact | Canonical authority | Writers | Frozen? | Duplicate guard |
|---|---|---|---|---|
| Payment lifecycle | PaymentService | PaymentService only | amount frozen at creation | @@unique(orderId, isActivePayment=true) |
| Payment amount | PaymentService (from Order.total) | PaymentService | YES | CAS version |
| Commission | CommissionService | CommissionService only | amount frozen at creation | @@unique(orderId) |
| CommissionAccrual | CommissionService | CommissionService only | YES | @@unique(sourceCommissionId) |
| LedgerTransaction | LedgerService | LedgerService only | YES (immutable) | @@unique(sourceType, sourceId, type) |
| Order total | OrderService | OrderService | verbatim propagation | CAS version |
| Sale snapshot | SalesCompletionService | SalesCompletionService | YES | CAS version |

---

## 5. MONEY/DECIMAL RULES

- All financial amounts: Prisma.Decimal(12,2)
- Rounding: ROUND_HALF_UP (sales.money.ts, finance.money.ts)
- No binary floating-point as accounting truth
- No silent Decimal → number → Decimal conversion
- String serialization for JSON transport

---

## 6. CURRENCY RULES

- Currency copied verbatim from source (no FX conversion)
- Payment.currency = Order.currency (frozen)
- Commission.currency = Order.currency (frozen)
- LedgerTransaction.currency = ISO 4217 snapshot (validated)
- Cross-currency addition forbidden without explicit FX authority

---

## 7. FREEZE/SNAPSHOT RULES

| Frozen fact | When frozen | Source before freeze | Mutable after? |
|---|---|---|---|
| Payment.amount | Payment creation | Order.total | NO |
| Commission.amount | Order creation | frozen snapshot × rate | NO |
| Sale commercial snapshot | completeSale | CheckoutIntent frozen | NO |
| Quote ISSUE totals | issueQuote | QuoteItem computed | NO |
| OrderRequested payload | completeSale (in-tx) | frozen facts | NO |

---

## 8. TRANSACTION ATOMICITY

| Operation | Transaction facts | Events in tx? | Post-commit |
|---|---|---|---|
| Payment.create | Payment + history + audit | NO (external idempotency boundary) | none |
| Payment.transition | Payment CAS + history + audit | NO | none |
| completeSale | Sale CAS + catalog reserve + outbox + history + audit | YES (emit in tx) | publishEvent |
| Order creation | Order + OrderItem + history + audit + outbox | YES | publishPending |
| Commission accrual | Commission + CommissionAccrual + inbox | YES | none |
| Ledger write | LedgerTransaction (immutable) | NO | none |

---

## 9. RECONCILIATION CHECKER

`FinancialIntegrityChecker` class inspects DB state for:
1. Duplicate active Payments per Order
2. Duplicate Commissions per Order
3. Duplicate CommissionAccruals per Commission
4. Orphan LedgerTransactions
5. Payment amount consistency with Order
6. Commission snapshot consistency
7. Currency consistency
8. Ledger idempotency

---

## 10. VERDICT MODEL

### PASS
All canonical financial-integrity hard gates pass.

### FAIL
Valid financial invariant violated.

### BLOCKED
Mandatory financial decision/evidence externally unavailable.

### DEFERRED / N/A
Provider-dependent or future functionality explicitly excluded.
