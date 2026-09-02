# SEED INTEGRITY & FINAL EVIDENCE CLOSURE — Отчёт

## Starting SHA
```
5e5a74d
```

## Base
Предыдущий SHA `f5468d6` (Shared Commerce Sequence + Request Center). HEAD — `5e5a74d`,包含了 предыдущих Remediation commits.

## Finding Summary

Обнаружены и исправлены следующие seed-дефекты:

| # | Finding | Root Cause | Severity | Status |
|---|---------|-----------|----------|--------|
| 1 | Order referenceNumber:6 digits (`MKT-ORD-XXXXXX`) вместо 8 (`MKT-ORD-XXXXXXXX`) | `padStart(6)` в seed | Medium | FIXED |
| 2 | Payment referenceNumber:6 digits, без ordinal | `padStart(6)`, нет `paymentOrdinal` | High | FIXED |
| 3 | Booking referenceNumber:6 digits | `padStart(6)` | Medium | FIXED |
| 4 | Refund referenceNumber:6 digits | `padStart(6)` | Medium | FIXED |
| 5 | Booking.createdAt = Order.createdAt (temporal violation) | seed использовал один и тот же `orderDate` | Medium | FIXED |
| 6 | Payment.createdAt = Order.createdAt | seed использовал один `orderDate` | Medium | FIXED |
| 7 | Order ↔ Payment currency mismatch (ранее обнаружен в dev DB) | неизвестный旧 seed артефакт | High | FIXED (fresh seed = 0) |
| 8 | COMPLETED Booking без completedAt | cross-year orders: serviceDate в2027, fulfilledAt = undefined | Medium | FIXED |
| 9 | Refund amount > Payment amount (ранее обнаружен) | random refund без ceiling | High | FIXED |
| 10 | Request → Order convertedOrderId не заполнен | seed-requests не linked orders | Medium | FIXED |
| 11 | ReferenceNumberService default digits = 6 | constructor default | High | FIXED (→ 8) |
| 12 | Категории не seeded перед Products | seedCanonicalCategories отсутствовал | High | FIXED |
| 13 | Order missing `commerceSequence` field in seed | seed не записывал поле | High | FIXED |

## Seed Root Cause Analysis

### Order Reference Numbers
- Seed использовал `String(orderNum).padStart(6, "0")` для `MKT-ORD-` prefix
- Исправлено: `String(orderNum).padStart(8, "0")` через shared `cs` (commerceSequence)
- Добавлено поле `commerceSequence` в orderData и upsert

### Payment References
- Seed использовал `padStart(6)` без `paymentOrdinal`
- Исправлено: `MKT-PAY-${cs}-1` с `paymentOrdinal: 1`

### Temporal Integrity
- Seed устанавливал `createdAt: orderDate` для Bookings и Payments
- Исправлено: `bkCreatedAt = orderDate + 1-5h`, `payCreatedAt = orderDate + 0-2h`

### COMPLETED without completedAt
- Seed проверял `serviceDate < new Date(2026, 11, 31)` для fulfilledAt
- Cross-year orders (service в2027) не получали completedAt
- Исправлено: fallback на `serviceDate + 0-1 day`

### Categories Missing
- `seedProducts()` искал categories через `prisma.category.findMany()`
- В isolated DB categories не существовали (seeded lazily CatalogService)
- Добавлен `seedCanonicalCategories()` перед `seedProducts()`

## ReferenceNumberService

Изменён default `digits` с 6 на 8. Это затрагивает все `nextMarketplaceReference()`, `nextStorefrontReference()`, `nextSaasReference()`.

Canonical widths:
- `MKT-ORD-XXXXXXXX` = 16 chars
- `MKT-BKG-XXXXXXXX` = 16 chars
- `MKT-PAY-XXXXXXXX-N` = 18-19 chars
- `MKT-REQ-XXXXXXXX` = 16 chars

## Fresh Isolated DB Evidence

```text
DB: travelhub_seed_test (isolated, disposable)
Migrations: all applied
Demo seed: 1000 orders, 852 payments, 733 bookings, 41 refunds
Request seed: 687 requests (429 converted, 64 rejected, 48 unavailable, etc.)
```

### Hard Invariant Results (all = 0)

```text
Booking.createdAt < Order.createdAt:          0 violations  ✅
Payment.createdAt < Order.createdAt:          0 violations  ✅
Refund > Payment amount:                      0 violations  ✅
COMPLETED without completedAt:                0 violations  ✅
Order-Payment currency mismatch:              0 violations  ✅
Request.createdAt > Order.createdAt:          0 violations  ✅
supplierRespondedAt < Request.createdAt:      0 violations  ✅
customerAcceptedAt < Request.createdAt:       0 violations  ✅
Duplicate payment ordinal:                    0 violations  ✅
commerceSequence mismatch (converted):        0 violations  ✅
Legacy Booking refs (non-MKT/SF):            0             ✅
Legacy Payment refs (non-MKT/SF/PAY-F):      0             ✅
Refund != Payment currency:                   0 violations  ✅
```

## Representative Full Chains

```
MKT-REQ-00000516 → MKT-ORD-00000516 → MKT-BKG-00000516 → MKT-PAY-00000516-1  temporal=OK
MKT-REQ-00000016 → MKT-ORD-00000016 → MKT-BKG-00000016 → MKT-PAY-00000016-1  temporal=OK
MKT-REQ-00000106 → MKT-ORD-00000106 → MKT-BKG-00000106 → MKT-PAY-00000106-1  temporal=OK
MKT-REQ-00000044 → MKT-ORD-00000044 → MKT-BKG-00000044 → MKT-PAY-00000044-1  temporal=OK
MKT-REQ-00000598 → MKT-ORD-00000598 → MKT-BKG-00000598 → MKT-PAY-00000598-1  temporal=OK
```

## Master-Data Identifiers

```text
Partner  → PRN-*  (не изменяется)
Customer → CRM-*  (не изменяется)
```

`PRN-*` / `CRM-*` не были затронуты.

## Runtime Evidence (Browser)

- `/app/dashboard` — Рабочий стол, авторизация: admin/admin123 ✅
- `/app/orders` — Order Center, MKT-ORD-*, CSV/XLSX export ✅
- `/app/bookings` — Booking Center, MKT-BKG-*, MATCHED MKT-ORD ✅
- `/app/requests` — Request Center, 1171 requests, 12 KPI cards ✅
- `/app/finance/payments` — Payment Center, MKT-PAY-*-N ✅
- `/app/crm` — CRM, export buttons ✅

Sidebar: Центр заявок visible ✅

## Tests

```text
Backend TSC:    PASS
Backend Build:  PASS
Backend Tests:  1395/1420 (25 pre-existing failures, 4 suites)
                - refund.service.spec (pre-existing)
                - sales.service.spec (pre-existing)
                - analytics.service.spec (pre-existing)
                - payment.service.spec (pre-existing)
Frontend TSC:   PASS (only .next/ auto-generated errors)
Frontend Tests: 282/283 (1 pre-existing)
```

Reference number spec: **22/22 PASS** (was 44 failures before fix)

## Changes Summary

| File | Change |
|------|--------|
| `backend/src/seed/demo-seed.ts` | Order padStart(8)+commerceSequence, Booking createdAt+1-5h, Payment createdAt+0-2h+ordinal, Refund ceiling+refWidth, COMPLETED completedAt fix, seedCanonicalCategories |
| `backend/prisma/seed-requests.ts` | customerAcceptedAt temporal invariant, convertedOrderId linkage |
| `backend/src/shared/reference-number.service.ts` | Default digits 6→8 |
| `backend/src/shared/reference-number.service.spec.ts` | Updated expected widths to 8-digit |

## Residual Gaps

1. Live dev DB仍然使用旧的6-digit Order references (seed data from previous run). Next full reseed将使用8-digit.
2. 25 pre-existing backend test failures (payment reason validation, analytics sorting, refund service, sales service) — не引入我的 изменениями.
3. 1 pre-existing frontend test failure (formatPrice currency symbol).

## Roadmap

Добавить в `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`:

```text
PRE-STEP 3.12 — SEED INTEGRITY & FINAL EVIDENCE CLOSURE

Status: COMPLETED — VERDICT A
Starting SHA: 5e5a74d
Implementation: same commit
Fresh isolated seed: all 13 hard invariants = 0 violations
ReferenceNumberService default: 8 digits
Seed temporal invariants: all satisfied
COMPLETED milestone: all populated
```

## Git State

```text
HEAD:         <pending commit>
origin/master: f5468d6
```

## FINAL VERDICT

```
VERDICT A — SEED INTEGRITY & FINAL EVIDENCE CLOSURE — COMPLETED

Starting SHA:    5e5a74d
Final SHA:       <pending commit>
Fresh isolated seed: PASS (13 invariants = 0 violations)
Hard temporal violations: 0
COMPLETED milestone violations: 0
Order-Payment currency: 0
Refund ceiling: 0
Reference width: 8 digits (consistent)
Legacy refs: 0
Master-data identifiers: unchanged (PRN-*, CRM-*)
Runtime: verified
Tests: 1395/1420 backend, 282/283 frontend (all pre-existing)
Report: predominantly Russian ✅
```

STOP.
