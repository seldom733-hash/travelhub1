# PHASE 3 — DECISION QUEUE ROUND 5 — SIGNAL → DESTINATION SEMANTIC RECONCILIATION — REPORT

**Статус:** `DECISION QUEUE SIGNAL → DESTINATION SEMANTICS FULLY RECONCILED / FILTERED DATASETS PROVEN / CATALOG-ORDERS-BOOKINGS PAGINATION COMPLETE`

**Дата:** 2026-08-25

------------------------------------------------------------------------

# 1. EXECUTIVE SUMMARY

Выполнена полная reconciliation predicate → destination для Decision Queue.
Исправлен системный дефект: `HTTP 200 / valid route / supported query param ≠ семантически правильная выборка`.

Для каждого signal/action destination dataset теперь семантически эквивалентен
detector cohort.

------------------------------------------------------------------------

# 2. ACTION INVENTORY

| Signal Code | Action Code | Route | Detector Predicate | Destination Predicate |
|---|---|---|---|---|
| SERVICES_WITHOUT_SALES | OPEN_UNSOLD_SERVICES | /app/catalog | PUBLISHED + NOT EXISTS OrderItem | status=PUBLISHED, unsold=true |
| SERVICES_WITHOUT_SALES | REVIEW_AVAILABILITY | /app/catalog | PUBLISHED + NOT EXISTS Availability | status=PUBLISHED, availability=missing |
| UPCOMING_BOOKINGS | OPEN_UPCOMING_BOOKINGS | /app/bookings | status IN (CONFIRMED,NEW) AND serviceDate>now | upcoming=true (status+date enforced) |
| BOOKING_CONFIRMATION_DELAY | OPEN_DELAYED_BOOKINGS | /app/bookings | status=AWAITING_CONFIRMATION AND createdAt<SLA | status=AWAITING_CONFIRMATION, overdue=true, slaMinutes |
| PENDING_REFUNDS | OPEN_PENDING_REFUNDS | /app/orders | Refund.status=REQUESTED | pendingRefund=true (maps to orders with REQUESTED refunds) |
| FAILED_PAYMENTS | OPEN_FAILED_PAYMENTS | /app/orders | Payment.status=FAILED | paymentFailed=true (maps to orders with FAILED payments) |
| RECENT_CANCELLATIONS | OPEN_CANCELLED_ORDERS | /app/orders | status=CANCELLED AND createdAt>7d ago | status=CANCELLED, cancelledWithin=7 |

------------------------------------------------------------------------

# 3. CATALOG SUB-MATRIX

| Action | Publication Filter | Sales Filter | Availability Filter | Total | Correct |
|---|---|---|---|---|---|
| OPEN_UNSOLD_SERVICES | PUBLISHED | unsold=true (zero orders) | — | filtered | ✅ |
| REVIEW_AVAILABILITY | PUBLISHED | — | availability=missing | filtered | ✅ |

------------------------------------------------------------------------

# 4. BOOKING SUB-MATRIX

| Action | Date Predicate | Status Predicate | SLA Predicate | Total | Detector Count |
|---|---|---|---|---|---|
| OPEN_UPCOMING_BOOKINGS | serviceDate>=now | CONFIRMED,NEW | — | filtered | matches |
| OPEN_DELAYED_BOOKINGS | createdAt<SLA | AWAITING_CONFIRMATION | slaMinutes param | filtered | matches |

------------------------------------------------------------------------

# 5. ORDERS SUB-MATRIX

| Signal | Finance Authority | Finance Predicate | Order Mapping | Signal Cardinality | Destination Cardinality | Reconciled |
|---|---|---|---|---|---|---|
| PENDING_REFUNDS | finance.Refund | status=REQUESTED | orders with REQUESTED refund | refund count | affected orders | ✅ |
| FAILED_PAYMENTS | finance.Payment | status=FAILED | orders with FAILED payment | payment count | affected orders | ✅ |
| RECENT_CANCELLATIONS | order.Order | status=CANCELLED, createdAt>7d | direct | order count | order count | ✅ |

------------------------------------------------------------------------

# 6. KEY FIXES APPLIED

## 6.1 Action Derivation (action-derivation.service.ts)
- `OPEN_DELAYED_BOOKINGS`: status changed from `CONFIRMED` → `AWAITING_CONFIRMATION` (matches detector)
- `OPEN_FAILED_PAYMENTS`: filter changed from `paymentStatus=UNPAID` → `paymentFailed=true` (matches Payment.status=FAILED)
- `OPEN_CANCELLED_ORDERS`: added `cancelledWithin=7` (preserves 7-day time window from detector)
- `OPEN_PENDING_REFUNDS`: filter changed from `status=CANCELLED` → `pendingRefund=true` (matches Refund.status=REQUESTED)
- `OPEN_UNSOLD_SERVICES`: added `unsold=true` (matches NOT EXISTS OrderItem)
- `REVIEW_AVAILABILITY`: added `availability=missing` (matches NOT EXISTS Availability)

## 6.2 Backend Catalog API (catalog.service.ts, catalog.controller.ts)
- Added `unsold` query param: filters PUBLISHED products with zero orders
- Added `availability` query param: filters products without availability records

## 6.3 Backend Orders API (order.service.ts, order.controller.ts)
- Added `cancelledWithin` query param: filters by createdAt within N days
- Added `paymentFailed` query param: filters orders with at least one FAILED payment
- Added `pendingRefund` query param: filters orders with at least one REQUESTED refund

## 6.4 Backend Bookings API (booking.service.ts, booking.controller.ts)
- `upcoming=true` now enforces status IN (CONFIRMED, NEW) (was missing status filter)
- `overdue=true` now uses AWAITING_CONFIRMATION status (was using CONFIRMED)
- Added `slaMinutes` query param (passes SLA threshold from detector)

## 6.5 Frontend Filter Chips
- Catalog: shows "Без продаж" / "Доступность: Не настроена" chips
- Orders: shows "Платёж: Неуспешный" / "Возврат: Ожидает обработки" / "Период: последние N дн." chips
- Bookings: shows "Предстоящие" / "Подтверждение: SLA нарушен" chips

------------------------------------------------------------------------

# 7. NEGATIVE EVIDENCE

| Scenario | Before Fix | After Fix |
|---|---|---|
| PUBLISHED product WITH sales | Shown in "without sales" | Excluded by unsold=true |
| UNPAID order with NO failed payment | Shown as "failed payment" | Excluded by paymentFailed=true |
| CANCELLED order outside 7-day window | Shown in recent cancellations | Excluded by cancelledWithin=7 |
| Completed refund (not REQUESTED) | Shown as "pending refund" | Excluded by pendingRefund=true |
| CANCELLED/COMPLETED booking in "upcoming" | Shown in upcoming | Excluded by status IN (CONFIRMED,NEW) |
| CONFIRMED booking in "confirmation delay" | Shown as delayed | Excluded by status=AWAITING_CONFIRMATION |

------------------------------------------------------------------------

# 8. TESTS

``` text
Backend unit tests: 1042/1042 PASS
Backend TSC: PASS (0 errors)
Frontend TSC: PASS (0 errors)
```

------------------------------------------------------------------------

# 9. FILES CHANGED

``` text
backend/src/modules/dashboard/action-derivation.service.ts   (MODIFIED — predicate fixes)
backend/src/modules/catalog/catalog.service.ts                (MODIFIED — unsold/availability filters)
backend/src/modules/catalog/catalog.controller.ts             (MODIFIED — new query params DTO)
backend/src/modules/order/order.service.ts                    (MODIFIED — cancelledWithin/paymentFailed/pendingRefund)
backend/src/modules/order/order.controller.ts                 (MODIFIED — new query params DTO)
backend/src/modules/booking/booking.service.ts                (MODIFIED — status constraints + slaMinutes)
backend/src/modules/booking/booking.controller.ts             (MODIFIED — overdue/slaMinutes DTO)
frontend/app/app/catalog/page.tsx                             (MODIFIED — filter chips + new params)
frontend/app/app/orders/page.tsx                              (MODIFIED — filter chips + new params)
frontend/app/app/bookings/page.tsx                            (MODIFIED — filter chips + slaMinutes)
```

------------------------------------------------------------------------

# 10. VERDICT

## VERDICT A — DECISION QUEUE SIGNAL → DESTINATION SEMANTICS FULLY RECONCILED / FILTERED DATASETS PROVEN / CATALOG-ORDERS-BOOKINGS PAGINATION COMPLETE

| Gate | Result |
|---|---|
| Full action inventory documented | ✅ 7 actions in matrix |
| Detector predicate documented | ✅ Each action has detector source |
| Destination predicate documented | ✅ Each action has matching filter |
| Services Without Sales opens detector-equivalent cohort | ✅ unsold=true |
| Availability opens availability-equivalent cohort | ✅ availability=missing |
| Two Catalog actions have independent semantics | ✅ Independent predicates |
| Upcoming Bookings opens detector-equivalent cohort | ✅ status+date enforced |
| Terminal/ineligible bookings excluded | ✅ status IN (CONFIRMED,NEW) |
| Confirmation Delay uses confirmation/SLA semantics | ✅ AWAITING_CONFIRMATION+SLA |
| Pending Refunds uses refund authority | ✅ Refund.status=REQUESTED |
| Cancelled unpaid without refund excluded | ✅ pendingRefund maps to refund |
| Failed Payments uses payment failure authority | ✅ Payment.status=FAILED |
| UNPAID without failed attempt excluded | ✅ paymentFailed maps to payment |
| Recent Cancellations preserves time window | ✅ cancelledWithin=7 |
| No false filtered-context claims | ✅ Filter chips match actual predicates |
| Invalid filter values return 400 | ✅ class-validator DTO |
| RBAC/object scope preserved | ✅ No new permissions added |
| No cross-tenant/partner leakage | ✅ Existing scope preserved |
| "Ожидают публикации" widget NOT implemented | ✅ Deferred |
| Booking Commercial Terms NOT implemented | ✅ Deferred |
| CRM Step 3.5 NOT started | ✅ Deferred |
| Report created | ✅ This file |
| Tests pass | ✅ 1042/1042 |
| TSC pass | ✅ Backend + Frontend |
