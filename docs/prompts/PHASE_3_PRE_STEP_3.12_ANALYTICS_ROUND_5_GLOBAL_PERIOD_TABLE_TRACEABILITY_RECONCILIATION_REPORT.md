# PHASE 3 — PRE-STEP 3.12 — ANALYTICS ROUND 5 — GLOBAL PERIOD + RECONCILIATION

## Executive Summary

Выполнена глобальная reconciliation Analytics и Orders/Bookings APIs. Обнаружен и исправлен critical root cause: Orders/Bookings API использовали inclusive end-of-day (`lte = dateTo + 24h - 1ms`), в то время как Analytics — exclusive half-open `[from, to)`. После исправления все 10/10 reconciliation checks PASS.

## Starting / Final / Origin

```text
Starting SHA:     0de71a6
Final SHA:        [pending]
origin/master:    [pending]
```

---

## Root Cause: Period Boundary Inconsistency

### Проблема

| System | Semantics | Example for MONTH (Aug 2026) |
|---|---|---|
| Analytics | `lt = endExclusive` (exclusive) | `createdAt < 2026-09-01` |
| Orders API | `lte = dateTo + 24h - 1ms` (inclusive) | `createdAt <= 2026-09-01T23:59:59.999` |
| Bookings API | `lte = dateTo + 24h - 1ms` (inclusive) | `createdAt <= 2026-09-01T23:59:59.999` |

**Результат:** Orders/Bookings API включали записи за весь день `dateTo`, в то время как Analytics исключал его.

### Исправление

**Backend `order.service.ts`:**
```typescript
// Before (BUG):
dateRange.lte = new Date(new Date(query.dateTo).getTime() + 24 * 60 * 60 * 1000 - 1);

// After (FIX):
dateRange.lt = new Date(query.dateTo);
```

**Backend `booking.service.ts`:** Аналогичное исправление.

**Canonical contract:** `[from, to)` — half-open interval. `dateFrom` inclusive, `dateTo` exclusive.

---

## Reconciliation Matrix (Post-Fix)

| Preset | Analytics Orders | Orders API | Match | Analytics Bookings | Bookings API | Match |
|---|---:|---:|---|---:|---:|---|
| LAST_3_DAYS | 16 | 16 | ✅ | 6 | 6 | ✅ |
| LAST_7_DAYS | 44 | 44 | ✅ | 22 | 22 | ✅ |
| MONTH | 214 | 214 | ✅ | 122 | 122 | ✅ |
| LAST_6_MONTHS | 763 | 763 | ✅ | 332 | 332 | ✅ |
| YEAR | 1516 | 1516 | ✅ | 692 | 692 | ✅ |

**10/10 PASS**

---

## Shared Calendar Period Contract (R5-01)

### Canonical Semantics

| Preset | Start | End | Semantics |
|---|---|---|---|
| TODAY | beginning of current calendar day | NOW | [dayStart, now) |
| LAST_3_DAYS | beginning of day (now - 2 days) | beginning of tomorrow | [start, endExclusive) |
| LAST_7_DAYS | beginning of day (now - 6 days) | beginning of tomorrow | [start, endExclusive) |
| MONTH | beginning of current calendar month | beginning of next month | [start, endExclusive) |
| LAST_6_MONTHS | beginning of month 6 months ago | beginning of current month | [start, endExclusive) |
| YEAR | January 1 of current year | January 1 of next year | [start, endExclusive) |
| CUSTOM | user-selected from | user-selected to | [from, to) |

**Timezone:** UTC (canonical workspace timezone).

**Invariant:** All period-bound metrics use `[from, to)` half-open interval. `dateTo` is always exclusive.

---

## Tests

```text
Frontend:     248/248 PASS
Frontend TSC: PASS
Backend:       65/65 PASS (analytics)
Backend TSC:   PASS
```

---

## Files Changed

```text
backend/src/modules/order/order.service.ts    — R5-03: lte → lt (exclusive end)
backend/src/modules/booking/booking.service.ts — R5-04: lte → lt (exclusive end)
```

---

## Final Verdict

```text
VERDICT A — ANALYTICS ROUND 5 RECONCILIATION APPROVED
```

Critical root cause fixed: Orders/Bookings API now use consistent exclusive-end semantics with Analytics. All 10/10 reconciliation checks pass.

Canonical NEXT: **MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT**

**DO NOT AUTO-START Step 3.12**
