# PHASE 3 — PRE-STEP 3.12 — FINANCIAL PAYMENTS DRILL-DOWN + REGISTRY REMEDIATION REPORT

## 1. Starting SHA

```
Starting SHA:       7d51f53
Implementation SHA: (this commit)
Final HEAD:         (after commit)
origin/master:      7d51f53
```

## 2. Reproduction (До Remediation)

```
Financial Summary (MONTH):
  AZN: count=118 sum=18594.91
  EUR: count=1   sum=124.32
  USD: count=18  sum=10533.34

Payments page (без фильтра статуса):
  AZN: 736 records (all periods)
  EUR: 7 records
  USD: 73 records

Payments page (period + CAPTURED):
  AZN: 118 ✅
  EUR: 1   ✅
  USD: 18  ✅
```

**Root cause:** Drill-down URL не передавал `status=CAPTURED` и period params. Backend уже поддерживал фильтрацию, но фронтенд не отправлял нужные параметры.

## 3. Canonical Formula (Доказано из Source)

```typescript
// backend/src/modules/analytics/analytics.service.ts:141
function revenueWhere(start: Date, end: Date) {
  return {
    status: "CAPTURED" as const,
    paidAt: { gte: start, lt: end },
  };
}
```

Financial Summary считает:
- **COUNT**: `Payment WHERE status='CAPTURED' AND paidAt ∈ [from, to)`
- **SUM**: `SUM(Payment.amount) WHERE status='CAPTURED' AND paidAt ∈ [from, to)`

Единственный qualifying status = `CAPTURED`.

## 4. Status Population Forensics

| Currency | CAPTURED | Other | All | Source metric |
|---|---:|---:|---:|---:|
| AZN | 118 | 13 (refund/failed) | 131 | 118 ✅ |
| EUR | 1 | 1 (refund) | 2 | 1 ✅ |
| USD | 18 | 2 (1 refund + 1 failed) | 20 | 18 ✅ |

## 5. Label Decision

```
"Платежей" → "Успешные платежи" (Successful payments)
```

Причина: metric считает только CAPTURED payments. Generic "Платежей" создаёт неоднозначность рядом с полным payment journal.

## 6. Drill-down Implementation

| Component | Change |
|---|---|
| `metric-drilldown.ts` | `analytics.finance.payment_count` + `analytics.finance.payments`: added `statusFilter: ["CAPTURED"]` |
| `finance/payments/page.tsx` | Full rewrite: server-side sorting, URL hydration, localization, Aggregate Summary |
| `payment.service.ts` | Added `sortBy`/`sortDirection` params with deterministic tie-breaker |
| `finance.validation.ts` | Added `sortBy`/`sortDirection` to `PaymentListQueryDto` |
| `i18n.tsx` | Added 19 finance.* keys for filters, statuses, columns, aggregates |

## 7. 3-Currency Reconciliation

```
AZN: source=118 → destination=118 → pagination=118 → amount=18594.91 ✅
EUR: source=1   → destination=1   → pagination=1   → amount=124.32   ✅
USD: source=18  → destination=18  → pagination=18  → amount=10533.34 ✅
```

## 8. Sorting

```
Backend: PaymentService.list() accepts sortBy/sortDirection
  → Prisma orderBy: [sortField, id] (deterministic tie-breaker)
  → Server-side only, no client-side sorting

Frontend: SortableHeader components on Code, Date, Amount, Currency, Status
  → URL state: sortBy + sortDirection
  → Refresh/back-forward preserves sort
```

Test: `sortBy=amount&sortDirection=desc` → PAY-AAF659DE092C: 975.84 AZN (highest) ✅

## 9. Localization

All Payments page strings use i18n keys:
- Filters: `finance.filter.all_currencies`, `finance.filter.all_statuses`
- Statuses: `finance.status.captured`, `finance.status.pending`, `finance.status.failed`, `finance.status.cancelled`
- Columns: `finance.col.code`, `finance.col.date`, `finance.col.order`, `finance.col.amount`, `finance.col.currency`, `finance.col.status`, `finance.col.method`
- Aggregate: `finance.aggregate.amount`, `finance.aggregate.payments`
- Empty: `finance.payments.empty`

All 3 locales (ru/az/en) supported.

## 10. Validation

| Gate | Result |
|---|---|
| Backend TSC | PASS |
| Backend Build | PASS |
| Frontend TSC | PASS |
| Frontend Tests | 248/248 PASS |

## 11. Security / Performance

- Server-side filtering/sorting/aggregation (no fetch-all)
- RBAC: `finance.payment.read` permission required
- Query params don't expand scope
- Deterministic tie-breaker prevents pagination duplicates

## 12. Git Evidence

```
Starting SHA:       7d51f53
Implementation SHA: (this commit)
Final HEAD:         (after commit)
origin/master:      7d51f53
```

## 13. Verdict

```
VERDICT A — FINANCIAL PAYMENTS SOURCE TRACEABILITY & REGISTRY REMEDIATION APPROVED

GATES:
A: Canonical formula proven (status=CAPTURED, paidAt ∈ period)   PASS
B: AZN source=118 = destination=118 = pagination=118            PASS
C: EUR source=1 = destination=1, refund excluded                 PASS
D: USD source=18 = destination=18, refund+failed excluded        PASS
E: Currency/status/period server-side, URL-hydrated              PASS
F: Sorting server-side, ASC/DESC, deterministic tie-breaker      PASS
G: Aggregate Summary: full filtered population, counts/amounts   PASS
H: Localization: all 3 locales, no raw enums                     PASS
I: First request scoped, F5 preserves state                      PASS
J: Security/performance/tests PASS                               PASS
```

NEXT: STOP — do not auto-start Final Strict Re-Qualification or Step 3.12.
