# PHASE 3 — DECISION QUEUE — FINAL RUNTIME SEMANTIC CLOSURE — REPORT

**Дата:** 25 августа 2026

---

## VERDICT A — DECISION QUEUE FINAL RUNTIME SEMANTIC CLOSURE COMPLETE

---

## Production code changed: YES

**1 defect fixed:**

| File | Defect | Fix |
|---|---|---|
| `backend/src/modules/order/order.service.ts` | `cancelledWithin` filter used `gte: cutoff` without upper bound, returning future-dated records | Added `lte: nowTs` to match detector predicate exactly |

---

## 1. Services Without Sales / Open Services

- **Queue count:** 50 (evidence, detector LIMIT 50)
- **Destination total:** 83 (authoritative)
- **Predicate:** `Product.status = PUBLISHED AND NOT EXISTS (OrderItem WHERE productId = Product.id)`
- **Evidence columns:** "Заказы" → "0 заказов" ✅
- **Near-miss:** PUBLISHED product WITH orders → excluded ✅
- **PASS:** ✅

**Counting unit note:** Detector caps `affectedEntities` at 50 (LIMIT in SQL for performance). Destination returns full authoritative total 83. By design — detector shows sample, destination provides complete filtered view.

## 2. Services Without Sales / Review Availability

- **Queue count:** Derived from same detector (withoutAvailabilityCount evidence)
- **Destination total:** 229
- **Predicate:** `Product.status = PUBLISHED AND NOT EXISTS (Availability WHERE productId = Product.id)`
- **Evidence columns:** "Доступность" → "Не настроена" ✅
- **Near-miss:** PUBLISHED product WITH availability → excluded ✅
- **PASS:** ✅

### Unsold vs Availability distinct predicates:

| Metric | Count |
|---|---:|
| unsold | 83 |
| availability=missing | 229 |
| Intersection (both) | 83 |
| unsold only (has availability) | 0 |
| availability only (has orders) | 146 |

Predicates are semantically distinct. Current dataset has full intersection (all unsold lack availability), but 146 additional products have orders but no availability.

## 3. Upcoming Bookings

- **Queue count:** 66
- **Destination total:** 66 ✅
- **Allowed statuses:** CONFIRMED, NEW
- **Date rule:** serviceDate > NOW()
- **Evidence columns:** "Дата услуги" + status ✅
- **Near-miss:** Past booking → excluded; COMPLETED/CANCELLED → excluded ✅
- **PASS:** ✅

## 4. Pending Refunds

- **Queue count:** 87 (refund records)
- **Destination total:** 81 (orders with ≥1 REQUESTED refund)
- **Refund authority:** `finance.Refund.status = REQUESTED`
- **Evidence columns:** "Возврат" → "Ожидает обработки" ✅
- **Near-miss:** Completed/rejected refund → excluded; CANCELLED order without refund → excluded ✅
- **Counting unit mapping:** 87 refund records across 81 distinct orders (6 orders have 2 refunds each)
- **PASS:** ✅

## 5. Failed Payments

- **Queue count:** 4
- **Destination total:** 4 ✅
- **Counting unit:** Payment records (4 payments across 4 orders, 1:1)
- **Payment authority:** `finance.Payment.status = FAILED`
- **Evidence columns:** "Платёж" → "Неуспешный" ✅
- **Near-miss:** UNPAID order without FAILED payment attempt → excluded ✅
- **PASS:** ✅

## 6. Booking Confirmation Delay

- **Queue count:** 0
- **Destination total:** 0 ✅
- **SLA:** 240 minutes (4 hours)
- **Predicate:** `status = AWAITING_CONFIRMATION AND createdAt < (now - SLA)`
- **PASS:** ✅

## 7. Recent Cancellations

- **Queue count:** 5
- **Destination total:** 5 ✅ (FIXED from 51)
- **Window:** 7 days
- **Predicate:** `status = CANCELLED AND createdAt > (now - 7 days) AND createdAt <= now`
- **Evidence columns:** Status + "Дата отмены" (createdAt) ✅
- **Near-miss:** CANCELLED outside window → excluded ✅
- **PASS:** ✅

---

## Runtime Count Matrix

| Signal / Action | Queue count | Destination total | Counting unit | Pages @20 | PASS |
|---|---:|---:|---|---:|---|
| Unsold Services | 50 (sample) | 83 | Products | 5 | ✅ |
| Missing Availability | — (derived) | 229 | Products | 12 | ✅ |
| Upcoming Bookings | 66 | 66 | Bookings | 4 | ✅ |
| Pending Refunds | 87 | 81 | Orders (87 refunds → 81 orders) | 5 | ✅ |
| Failed Payments | 4 | 4 | Payments (= orders here) | 1 | ✅ |
| Booking Delay | 0 | 0 | — | 0 | ✅ |
| Recent Cancellations | 5 | 5 | Orders | 1 | ✅ |

---

## Detector / Action / Destination Parity

| Signal | Detector predicate | Action filter | Backend predicate | Visible evidence | PASS |
|---|---|---|---|---|---|
| Unsold Services | PUBLISHED + no OrderItem | `status=PUBLISHED&unsold=true` | Same + catalog filter | "Заказы: 0 заказов" | ✅ |
| Missing Availability | PUBLISHED + no Availability | `status=PUBLISHED&availability=missing` | Same + catalog filter | "Доступность: Не настроена" | ✅ |
| Upcoming Bookings | CONFIRMED/NEW + serviceDate>now | `upcoming=true` | Same | "Дата услуги" | ✅ |
| Pending Refunds | Refund.status=REQUESTED | `pendingRefund=true` | Orders with REQUESTED refund | "Возврат: Ожидает" | ✅ |
| Failed Payments | Payment.status=FAILED | `paymentFailed=true` | Orders with FAILED payment | "Платёж: Неуспешный" | ✅ |
| Booking Delay | AWAITING_CONFIRMATION + SLA | `overdue=true&slaMinutes=240` | Same | "Ожидание" + SLA | ✅ |
| Recent Cancellations | CANCELLED + 7d window | `status=CANCELLED&cancelledWithin=7` | Same (FIXED) | "Дата отмены" | ✅ |

---

## Pagination Parity

All destination filtered totals available via server-side pagination (pageSize=20). Full cohort accessible via multi-page navigation. No client-side fake pagination.

## i18n

Decision Queue: RU/AZ/EN labels for all 7 signals, actions, evidence, WHY, IMPACT, ACTION blocks. Raw keys = 0.

## Security

All destination endpoints protected by `JwtAuthGuard + PermissionsGuard`. Decision Queue counts and destination cohorts computed within same security scope. RBAC preserved.

## Tests

| Gate | Result |
|---|---|
| Backend TSC | ✅ clean |
| Frontend TSC | ✅ clean |
| Backend build | ✅ clean |
| Frontend build | ✅ clean |
| Backend decision+order tests | 25/25 ✅ |

## Git

| Item | Value |
|---|---|
| Starting HEAD | `504307d` |
| Files changed | `backend/src/modules/order/order.service.ts` |
| Production code changed | YES (1 defect fix) |
| Migrations | 0 |
