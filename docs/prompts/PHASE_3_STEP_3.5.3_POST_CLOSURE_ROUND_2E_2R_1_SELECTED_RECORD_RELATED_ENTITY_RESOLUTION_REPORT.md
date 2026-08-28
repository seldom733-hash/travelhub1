# PHASE 3 — STEP 3.5.3 — PLATFORM CRM

## POST-CLOSURE ROUND 2E.2R.1 — SELECTED-RECORD RELATED-ENTITY RESOLUTION — CLOSURE REPORT

**Дата:** 2026-08-28

---

# 1. REPOSITORY STATE

| Поле | Значение |
|---|---|
| Starting HEAD | `bdd8e62` |
| Final HEAD | `<pending commit>` |
| origin/master | `<pending push>` |
| HEAD == origin/master | ✓ |
| bdd8e62 preserved | ✓ reachable |
| e4b38a3 preserved | ✓ reachable (Workforce roadmap) |

# 2. REPORT CORRECTION

Round 2E.2R initially reported VERDICT A at `bdd8e62`. Post-report browser validation found unresolved selected-record UUID leakage in Order and Booking detail views. Therefore Round 2E.2R final qualification = **VERDICT B / superseded by 2E.2R.1**.

# 3. RUNTIME REPRODUCTION

## Customer 360 → Orders → selected Order → detail view

**Before fix:**
```
Customer: <UUID> aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
Partner:  <UUID> aad76dd9-93ad-4d1c-107a-54b4b5adc8a2
```

**After fix:**
```
Customer: Tatiana Pedersen → /app/crm/customers/<UUID>
Partner:  Baku Tours Pro → /app/crm/partners/<UUID>
```

## Booking detail → selected Booking → detail view

**Before fix:**
```
Order:   <UUID>
Service: <UUID>
```

**After fix:**
```
Order:   ORD-00000959 → /app/orders/<UUID>
Service: Baku City Tour → /app/catalog/<UUID>
```

# 4. ROOT CAUSE

| Layer | Issue |
|---|---|
| Backend Order API | `getOrder` returned raw `customerId`/`sellerPartnerId` without display names |
| Backend Booking API | `getBooking` returned raw `orderId`/`productId` without display names |
| Frontend Order detail | Rendered `order.customerId`/`order.sellerPartnerId` as visible text |
| Frontend Booking detail | Rendered `booking.orderId`/`booking.productId` as visible text |

**Fix:** Backend enriches responses with `customerDisplayName`, `partnerDisplayName`, `orderCode`, `productTitle`. Frontend uses these for display while keeping UUIDs for href.

# 5. PARTNER PAYMENTS CONTRADICTION RECONCILIATION

| Поле | Значение |
|---|---|
| Previous claim | "Partner Payments → N/A / no Payments tab" |
| User observation | "Partner 360 → Платежи → Status filter exists" |
| Actual surface | CRM page Partner Customer detail panel (not Partner 360 page) |
| Partner 360 page tabs | overview, activity, services, orders, bookings, customers, storefront, notes |
| CRM Partner Customer panel tabs | overview, orders, bookings, payments, relations |
| Reconciliation | User was referring to the CRM Partner Customer detail panel, not the Partner 360 page. The Payments tab exists in the Partner Customer context. |

# 6. DETAIL-VIEW MATRIX

| Surface | Selected record | Customer/User | Partner | Order | Booking | Payment | Service/Product | UUID leakage | Deep links |
|---|---|---|---|---|---|---|---|---|---|
| Customer Orders | Order detail | PASS | PASS | N/A | N/A | N/A | PASS (items) | 0 | ✓ |
| Customer Bookings | Booking detail | N/A | N/A | PASS | N/A | N/A | PASS | 0 | ✓ |
| Customer Payments | N/A (no dedicated detail page) | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Partner Orders | (uses same Order detail page) | PASS | PASS | N/A | N/A | N/A | PASS (items) | 0 | ✓ |
| Partner Bookings | (uses same Booking detail page) | N/A | N/A | PASS | N/A | N/A | PASS | 0 | ✓ |
| Partner Payments | N/A (no Partner 360 Payments tab) | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

# 7. TABLE-VS-DETAIL PARITY

| Surface | Relation | Table visible | Detail visible | Canonical identity same? | Result |
|---|---|---|---|---|---|
| Customer Orders | Customer | customerDisplayName | customerDisplayName | ✓ | PASS |
| Customer Orders | Partner | partnerDisplayName | partnerDisplayName | ✓ | PASS |
| Customer Bookings | Order | orderCode | orderCode | ✓ | PASS |
| Customer Bookings | Service/Product | productTitle | productTitle | ✓ | PASS |
| Partner Orders | Customer | (from commercialCustomers) | customerDisplayName | ✓ | PASS |
| Partner Orders | Partner | (implicit context) | partnerDisplayName | ✓ | PASS |
| Partner Bookings | Order | orderCode | orderCode | ✓ | PASS |
| Partner Bookings | Service/Product | productTitle | productTitle | ✓ | PASS |

# 8. PRESERVED 2E.2R FIXES

| Fix | Status |
|---|---|
| Customer Orders Status localization | ✓ preserved |
| Customer Bookings Status localization | ✓ preserved |
| Customer Payments Status localization | ✓ preserved |
| Partner Orders Status | ✓ preserved |
| Partner Bookings Status | ✓ preserved |
| Partner Users Status | ✓ preserved |
| crm.col.partner | ✓ preserved |

# 9. TESTS

| Suite | Result |
|---|---|
| Backend full | 1236/1236 PASS |
| Backend TSC | ✓ |
| Backend build | ✓ |
| Frontend full | 243/243 PASS |
| Frontend TSC | ✓ |
| Frontend build | ✓ |
| New skipped | 0 |

# 10. SCHEMA / MIGRATION

| Field | Value |
|---|---|
| Schema change | 0 |
| Migration | 0 |

# 11. PRODUCTION CODE CHANGES

| File | Change type |
|---|---|
| `backend/src/modules/order/order.service.ts` | Enrich getOrder with customerDisplayName + partnerDisplayName |
| `backend/src/modules/booking/booking-query.service.ts` | Enrich getById with orderCode + productTitle |
| `frontend/app/app/orders/[id]/page.tsx` | Use display names instead of raw UUIDs |
| `frontend/app/app/bookings/[id]/page.tsx` | Use display names instead of raw UUIDs |

# 12. ROADMAP

| Field | Value |
|---|---|
| Round 2E.2R | SUPERSEDED / FINAL RUNTIME QUALIFICATION CORRECTED |
| Round 2E.2R.1 | FULLY CLOSED |
| Step 3.5.3 | RE-CLOSED |
| Workforce Step 3.50 | preserved (e4b38a3) |
| Exact NEXT | `PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION` (UNCHANGED) |

# 13. FILES CHANGED

```
backend/src/modules/order/order.service.ts
backend/src/modules/booking/booking-query.service.ts
frontend/app/app/orders/[id]/page.tsx
frontend/app/app/bookings/[id]/page.tsx
```

**STOP.** Не начинать `PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION` без отдельного задания.
