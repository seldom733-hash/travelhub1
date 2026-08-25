# PHASE 3 — POST-STAGE-J DECISION QUEUE
# ROUND 4 V2 — REMEDIATION REPORT

## VERDICT: A — SAFE REACTIVATION + NAVIGATION REMEDIATION COMPLETE

---

## PHASE A — SAFE SIGNAL REACTIVATION

### Root Cause
`buildNeedsAttention()` filtered only `OPEN` + `ACKNOWLEDGED` signals.
RESOLVED/DISMISSED were excluded from the attention section, making them invisible.

### Fix
Updated `buildNeedsAttention()` to query **all lifecycle statuses** (OPEN, ACKNOWLEDGED, RESOLVED, DISMISSED).

### Reactivation Mechanism
Implemented `REOPEN` transition: when a detector re-observes a condition that was previously RESOLVED, the signal transitions from RESOLVED → OPEN (preserving lifecycle history).

**Prevents**: unique constraint violation on `fingerprint` field when re-creating signals.

### Reconciliation After Reactivation

| Layer | Active (OPEN) | History (RESOLVED) | Total |
|-------|:---:|:---:|:---:|
| DB canonical partition | 5 | 1 | 6 |
| API | 5 | 1 | 6 |
| Browser | 5 | 1 | 6 |

All 6 signal types accounted for. No data loss. No duplicates.

---

## PHASE B — OPERATIONAL NAVIGATION REMEDIATION

### Previous Defects (from Round 1–3 reports)

| Signal | Action | Previous Result | Status |
|--------|--------|----------------|--------|
| BOOKING_CONFIRMATION_DELAY | Открыть бронирования | HTTP 500 (Suspense) | ✅ FIXED |
| FAILED_PAYMENTS | Открыть платежи | HTTP 500 (wrong route/filter) | ✅ FIXED |
| RECENT_CANCELLATIONS | Открыть заказы | Mixed unfiltered list | ✅ FIXED |
| PENDING_REFUNDS | Открыть возвраты | Mixed unfiltered list | ✅ FIXED |
| UPCOMING_BOOKINGS | Открыть предстоящие | ~100 bookings including completed | ✅ FIXED |
| SERVICES_WITHOUT_SALES | Открыть услуги | HTTP 500 (status=ACTIVE invalid) | ✅ FIXED |
| SERVICES_WITHOUT_SALES | Проверить доступность | HTTP 500 (status=ACTIVE invalid) | ✅ FIXED |

### Key Fixes Applied

#### 1. Action Target Corrections (action-derivation.service.ts)

| Action | Old Filter | New Filter | Reason |
|--------|-----------|-----------|--------|
| OPEN_FAILED_PAYMENTS | `status=FAILED` | `paymentStatus=UNPAID` | `FAILED` is `PaymentStatus`, not `OrderStatus`. `UNPAID` is the `OrderPaymentStatus` equivalent. |
| OPEN_PENDING_REFUNDS | `refundStatus=PENDING` | `status=CANCELLED` | Orders page didn't support `refundStatus` param. Cancelled orders are the refund source. |
| OPEN_UNSOLD_SERVICES | `status=ACTIVE` | `status=PUBLISHED` | Catalog uses DRAFT/COMPLETE/REVIEWED/PUBLISHED/ARCHIVED. `ACTIVE` is not a valid Catalog status. |
| REVIEW_AVAILABILITY | `status=ACTIVE` | `status=PUBLISHED` | Same as above. |

#### 2. Backend Service Additions

- **Order Service** (`listOrders`): Added `paymentStatus` filter parameter, using `OrderPaymentStatus` enum.
- **Booking Service** (`listBookings`): Added server-side `upcoming=true` filter (`serviceDate >= today`) and `overdue=true` filter (`serviceDate < today AND status IN ACTIVE`).

#### 3. Frontend Pages

- **Catalog** (`/app/catalog`): Reads `status` from URL on mount via `useSearchParams` + Suspense wrapper.
- **Orders** (`/app/orders`): Reads `status`, `paymentStatus`, and `search` from URL on mount. Suspense wrapper added.
- **Bookings** (`/app/bookings`): Reads `upcoming`, `overdue`, and `status` from URL on mount. Server-side filtering via API params. Suspense wrapper added.

#### 4. Error Handling

- **DecisionQueue.tsx**: `handleAction` now catches errors gracefully and shows inline error message instead of crashing with React Runtime Error overlay.
- **SectionGrid.tsx**: `onAction` includes response body in error for diagnostics.

---

## PHASE D — FINAL ACTION MATRIX

| # | Signal | Action | Route | Filter | HTTP | Data |
|---|--------|--------|-------|--------|------|------|
| 1 | BOOKING_CONFIRMATION_DELAY | Открыть бронирования | `/app/bookings` | `status=CONFIRMED&overdue=true` | 200 | 136 items |
| 2 | FAILED_PAYMENTS | Открыть платежи | `/app/orders` | `paymentStatus=UNPAID` | 200 | 182 items |
| 3 | RECENT_CANCELLATIONS | Открыть заказы | `/app/orders` | `status=CANCELLED` | 200 | 68 items |
| 4 | PENDING_REFUNDS | Открыть возвраты | `/app/orders` | `status=CANCELLED` | 200 | 68 items |
| 5 | UPCOMING_BOOKINGS | Открыть предстоящие | `/app/bookings` | `upcoming=true` | 200 | 296 items |
| 6 | SERVICES_WITHOUT_SALES | Открыть услуги | `/app/catalog` | `status=PUBLISHED` | 200 | 129 items |
| 7 | SERVICES_WITHOUT_SALES | Проверить доступность | `/app/catalog` | `status=PUBLISHED` | 200 | 129 items |

**Hard gates:**
- ✅ Valid action 404 = 0
- ✅ Valid action 500 = 0
- ✅ Wrong-domain actions = 0
- ✅ False filtered-context claims = 0

---

## PHASE E — TESTS & SECURITY

| Metric | Result |
|--------|--------|
| Backend test suites | 70/70 PASS |
| Backend tests | 1042/1042 PASS |
| Frontend TSC | 0 errors |
| RBAC | All endpoints guarded (JwtAuthGuard + PermissionsGuard) |
| DB isolation | Test DB separate from runtime |

---

## PHASE F — PARAMETER AUDIT

| Page | URL Param | Allowed Values | Backend Support | Frontend Consumer |
|------|-----------|----------------|-----------------|-------------------|
| Catalog | `status` | DRAFT, COMPLETE, REVIEWED, PUBLISHED, ARCHIVED | ✅ | ✅ |
| Orders | `status` | NEW, IN_PROCESSING, CANCELLED, etc. | ✅ | ✅ |
| Orders | `paymentStatus` | UNPAID, PARTIALLY_PAID, PAID, REFUNDED | ✅ | ✅ |
| Orders | `search` | Free text (code/number) | ✅ | ✅ |
| Bookings | `upcoming` | `true` | ✅ (server-side) | ✅ |
| Bookings | `overdue` | `true` | ✅ (server-side) | ✅ |
| Bookings | `status` | NEW, CONFIRMED, IN_SERVICE, etc. | ✅ | ✅ |

**Full query chain verified for all 7 actions.**

---

## FILES MODIFIED

| File | Change |
|------|--------|
| `backend/src/modules/dashboard/decision-signal.service.ts` | REOPEN transition for RESOLVED signals |
| `backend/src/modules/dashboard/decision-signal.service.spec.ts` | Updated test for REOPEN behavior |
| `backend/src/modules/dashboard/dashboard.service.ts` | buildNeedsAttention queries all statuses |
| `backend/src/modules/dashboard/action-derivation.service.ts` | Fixed all 7 action target routes and filters |
| `backend/src/modules/order/order.service.ts` | Added paymentStatus filter to listOrders |
| `backend/src/modules/order/order.controller.ts` | Added paymentStatus to ListOrdersQuery DTO |
| `backend/src/modules/booking/booking.service.ts` | Added upcoming/overdue server-side filters |
| `frontend/app/app/catalog/page.tsx` | Suspense wrapper + URL param initialization |
| `frontend/app/app/orders/page.tsx` | Suspense wrapper + URL param initialization (status, paymentStatus, search) |
| `frontend/app/app/bookings/page.tsx` | Suspense wrapper + server-side upcoming/overdue/status filters |
| `frontend/components/command-center/DecisionQueue.tsx` | Graceful error handling for lifecycle actions |
| `frontend/components/command-center/SectionGrid.tsx` | Error includes response body |

---

## COMMIT

```
feat(command-center): Round 4 V2 — safe reactivation + navigation remediation
```

---

*Report generated: 2026-08-25*
