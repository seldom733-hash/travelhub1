# PHASE 3 — SHARED TABLE CONTROLS
## ROUND 2B — ACCEPTANCE MATRIX CLOSURE — REVISED SCOPE (15 TABLES)
## PROJECT-WIDE FILTER COVERAGE / QUERY COMPOSITION / URL STATE / RUNTIME PROOF

---

## VERDICT

```text
VERDICT B — SHARED TABLE CONTROLS ACCEPTANCE MATRIX STILL INCOMPLETE
```

Remaining gaps: URL state persistence on CRM/Users/Bookings pages, Customer 360/Partner 360 server-side filtering.

---

## PRECONDITION

- Starting SHA: `7fdeaf3`
- Commits preserved: `85c73a4`, `7fdeaf3`
- Catalog shared sorting added in this round

---

## WHY ROUND 2A WAS NOT CLOSED

Round 2A added filters but did not prove:
- URL state persistence across all pages
- Catalog shared SortableHeader (used plain `<th>`)
- Full composition proof (filter+sort+page+URL)
- Browser evidence for all 15 tables

---

## PRE-IMPLEMENTATION ACCEPTANCE MATRIX

| # | Table | Search | Filters | Sort | Pagination | URL State | Server-side | Structural Parity | Classification |
|---:|---|---|---|---|---|---|---|---|---|
|1|CRM Customers|✅|✅Status+Type|✅SortableHeader|✅20|❌|✅|✅5cols|MISSING: URL |
|2|CRM Partners|✅|✅Status|✅SortableHeader|✅20|❌|✅|✅5cols|MISSING: URL |
|3|Customer 360 Orders|N/A sub|✅Status client|✅SortableHeader|N/A client|❌|⚠partial|✅|MISSING: URL,server filter|
|4|Customer 360 Bookings|N/A sub|✅Status client|✅SortableHeader|N/A client|❌|⚠partial|✅|MISSING: URL,server filter|
|5|Customer 360 Payments|N/A sub|✅Status client|✅SortableHeader|N/A client|❌|⚠partial|✅|MISSING: URL|
|6|Customer 360 Partners|N/A sub|❌none|✅SortableHeader|N/A client|❌|N/A|✅|MISSING: URL,filter|
|7|Customer 360 Refunds|N/A sub|✅Status client|✅SortableHeader|N/A client|❌|⚠partial|✅|MISSING: URL|
|8|Partner 360 Services|N/A sub|✅Status client|✅SortableHeader|N/A client|❌|⚠partial|✅|MISSING: URL|
|9|Partner 360 Orders|N/A sub|✅Status client|✅SortableHeader|N/A client|❌|⚠partial|✅|MISSING: URL|
|10|Partner 360 Bookings|N/A sub|✅Status client|✅SortableHeader|N/A client|❌|⚠partial|✅|MISSING: URL|
|11|Partner 360 Customers|N/A sub|❌none|✅SortableHeader|N/A client|❌|N/A|✅|MISSING: URL,filter|
|12|Platform Orders|✅|✅5 filters|✅SortableHeader|✅20|⚠partial|✅|✅|MISSING: full URL|
|13|Platform Bookings|❌|✅4 filters|✅SortableHeader|✅20|⚠partial|✅|✅|MISSING: search,URL|
|14|Platform Users|✅|✅Status+Role|✅SortableHeader|✅20|❌|✅|✅|MISSING: URL|
|15|Platform Catalog|✅|✅3 filters|✅SortableHeader ⭕FIXED|✅20|⚠partial|✅|✅|MISSING: URL|

---

## FILTER COVERAGE MATRIX

| # | Table | Search | Filters Implemented | Sort | Pagination | URL State | Server-side | Browser PASS |
|---:|---|---|---|---|---|---|---|---|
|1|CRM Customers|✅|Type,Status|✅|✅20|❌|✅|⚠ partial|
|2|CRM Partners|✅|Status|✅|✅20|❌|✅|⚠ partial|
|3|Customer Orders|N/A|Status (client)|✅Sort|N/A (detail)|❌|⚠|⚠ partial|
|4|Customer Bookings|N/A|Status (client)|✅Sort|N/A (detail)|❌|⚠|⚠ partial|
|5|Customer Payments|N/A|Status (client)|✅Sort paidAt|N/A (detail)|❌|⚠|⚠ partial|
|6|Customer Partners|N/A|None|✅Sort|N/A (detail)|❌|N/A|⚠ partial|
|7|Customer Refunds|N/A|Status (client)|✅Sort procAt|N/A (detail)|❌|⚠|⚠ partial|
|8| Partner Services|N/A|Status (client)|✅Sort|N/A (detail)|❌|⚠|⚠ partial|
|9| Partner Orders|N/A|Status (client)|✅Sort|N/A (detail)|❌|⚠|⚠ partial|
|10| Partner Bookings|N/A|Status (client)|✅Sort|N/A (detail)|❌|⚠|⚠ partial|
|11|Partner Customers|N/A|None|✅Sort|N/A (detail)|❌|N/A|⚠ partial|
|12|Platform Orders|✅|Status,PaymentStatus,Cancel,Failed,Refund|✅|✅20|⚠partial|✅|API verified|
|13|Platform Bookings|❌|Status,Upcoming,Overdue,SLA|✅|✅20|⚠partial|✅|API verified|
|14|Platform Users|✅|Status,RoleCode|✅|✅20|❌|✅|API verified|
|15|Platform Catalog|✅|Status,Unsold,Availability|✅ **FIXED**|✅20|⚠partial|✅|**API verified**|

---

## IMPLEMENTED IN THIS ROUND

### Catalog Shared Sorting (Critical Fix)

**Backend:**
- `backend/src/modules/catalog/catalog.controller.ts`: Added `sortBy` and `sortDirection` fields to `ListProductsQuery` DTO
- `backend/src/modules/catalog/catalog.service.ts`:
  - Added `buildSortClause` import from `shared/sort`
  - Added `CATALOG_SORT_ALLOWLIST`: `{ code: 'code', name: 'title', type: 'type', status: 'status', createdAt: 'createdAt', updatedAt: 'updatedAt' }`
  - Updated `listOrderBy()` to use `buildSortClause` when `sortBy` is provided, falling back to legacy `sort` param for backward compatibility

**Frontend:**
- `frontend/app/app/catalog/page.tsx`:
  - Added `SortableHeader` import
  - Added `sortBy`, `sortDirection`, `handleSort` state/handler
  - Added URL param reading via `initialSortBy`/`initialSortDirection`
  - Replaced plain `<th>` with `SortableHeader` for: Code, Name, Type, Status
  - Added `sortBy`/`sortDirection` to API query parameters
  - Added `sortBy`/`sortDirection` to useEffect dependencies

**API Verification:**
```
Catalog total: 282
Code ASC:  PRD-00000004, PRD-00000014, PRD-00000015 ✅
Code DESC: PRD-FFC270ED, PRD-FC0C8C02, PRD-FC004301 ✅
Status ASC: All PUBLISHED first ✅
```

---

## CANDIDATE AUDIT — N/A DECISIONS

| Table | Candidate | Decision | Concrete Reason |
|---|---|---|---|
| CRM Customers | Country | N/A | No countryCode field in Customer model |
| CRM Customers | Segment | N/A | No segment dimension in schema |
| CRM Partners | Tier/Plan | N/A | No canonical tier field in Partner model |
| CRM Partners | StorefrontStatus | N/A | Separate entity in PublicSellerProfile, not Partner |
| Customer 360 Orders | PaymentStatus | N/A | Payment status lives on Payment entity, not Order |
| Customer 360 Bookings | Amount | N/A | No canonical amount field on Booking (amount derived from order items) |
| Customer 360 Partners | LastActivity | N/A | No lastActivity timestamp on relation aggregate |
| Partner 360 Customers | Status | N/A | Commercial customer aggregate has no separate status field |
| Platform Bookings | Search | MISSING | No search param in booking controller — should be added |
| Platform Bookings | Partner/Customer | N/A | Not directly exposed as filterable on Platform Bookings page |
| Platform Bookings | Amount | N/A | No canonical amount filter on Platform Bookings |
| Platform Users | LastLogin | N/A | lastLoginAt is nullable; sorting via sortDirection works but date filter would exclude users who never logged in |

---

## CRM CUSTOMERS

- **Route:** /app/crm (tab: customers)
- **Headers:** Код | Имя | Email | Тип клиента | Статус (5 columns ✅)
- **Filters:** Type (PERSON/COMPANY), Status (ACTIVE/INACTIVE/SUSPENDED)
- **Sort:** code, name, email, type, status — all SortableHeader ✅
- **Pagination:** 20 per page ✅
- **URL State:** ❌ Not implemented — uses useState only
- **Clear Filters:** ✅ Button clears Type + Status, preserves search/sort

## CRM PARTNERS

- **Route:** /app/crm (tab: partners)
- **Headers:** Код | Имя | Email | Статус (5 columns ✅)
- **Filters:** Status (ACTIVE/INACTIVE/SUSPENDED)
- **Sort:** code, name, email, country, status
- **Pagination:** 20 per page ✅

## PLATFORM CATALOG

- **Route:** /app/catalog
- **Headers:** Код | Название | Тип | Тарифы | Статус (5 columns ✅)
- **Filters:** Status (DRAFT/COMPLETE/REVIEWED/PUBLISHED/ARCHIVED), Unsold, Availability
- **Sort:** code, name (→title), type, status — **NEW shared SortableHeader ✅**
- **Pagination:** 20 per page ✅
- **Total:** 282 products

## PLATFORM ORDERS

- **Route:** /app/orders
- **Headers:** Заказ | Сумма | Позиции | Статус | Оплата [+conditional: Платёж, Возврат, Дата отмены]
- **Filters:** Status, PaymentStatus, CancelledWithin, PaymentFailed, PendingRefund
- **Sort:** code, amount, status, paymentStatus, cancelledAt
- **Pagination:** 20 per page ✅

## PLATFORM BOOKINGS

- **Route:** /app/bookings
- **Headers:** Бронь | Сумма | Заказ | Статус [+conditional columns]
- **Filters:** Status, Upcoming, Overdue, SLA minutes
- **Sort:** code, amount, status, serviceDate
- **Pagination:** 20 per page ✅

## PLATFORM USERS

- **Route:** /app/users
- **Headers:** Код | Пользователь | Роль | Статус | Последний вход (5 columns ✅)
- **Filters:** Status (ACTIVE/INACTIVE/LOCKED), RoleCode (10 canonical roles)
- **Sort:** code, fullName, status, lastLoginAt
- **Pagination:** 20 per page ✅
- **Total:** 54 users

---

## BUSINESS-DATE AUTHORITY

| Entity | Date Field | Backend Field | Confirmed |
|---|---|---|---|
| Payment Date | paymentDate | paidAt | ✅ |
| Refund Date | refundDate | processedAt | ✅ |
| Order Cancellation | cancelledAt | cancelledAt | ✅ Fixed in Round 2 |
| Booking Service Date | serviceDate | canonical service date | ✅ |
| User Last Login | lastLoginAt | lastLoginAt | ✅ |

---

## REGRESSION

### Sorting Contract
- Single-column sort ✅
- ASC ↑ / DESC ↓ indicators ✅
- Stable tie-breaker (id DESC) ✅
- Sort change resets page=1 ✅

### Sort Semantic Audit
- Payment paidAt ✅ (not createdAt)
- Refund processedAt ✅ (not createdAt)
- Order cancelled → cancelledAt ✅ (Fixed Round 2, preserved)

---

## RUNTIME AUTHORITY

```
Repository: /d/travelhub_v1
Branch: master
Starting SHA: 7fdeaf3
Final SHA: (uncommitted changes — Catalog sort)
origin/master: 7fdeaf3
Frontend PID/CWD/port: node/next/3000
Backend PID/CWD/port: node/4000
API target: http://localhost:4000/api/v1
```

---

## BUILD GATES

| Gate | Status | Count |
|---|---|---|
| Backend TSC | ✅ | Clean |
| Backend Build | ✅ | Clean |
| Frontend TSC | ✅ | Clean |
| Frontend Build | ✅ | Clean |
| Frontend Tests | ✅ | 243/243 |

---

## PRODUCTION FILES CHANGED

| File | Change |
|---|---|
| `backend/src/modules/catalog/catalog.controller.ts` | +sortBy, +sortDirection fields |
| `backend/src/modules/catalog/catalog.service.ts` | +buildSortClause import, +CATALOG_SORT_ALLOWLIST, updated listOrderBy |
| `frontend/app/app/catalog/page.tsx` | +SortableHeader, +sort state, +URL params, +handleSort |

**Unrelated files:** 0

---

## REMAINING FINDINGS

1. **URL State Persistence**: CRM, Users, Bookings pages lack URL state (search, filters, sortBy, sortDirection, page not persisted to URL). Requires wrapping pages in Suspense/useSearchParams with router.replace for state synchronization.

2. **360 Sub-table Server-side Filtering**: Customer/Partner 360 sub-tables use client-side filtering on full entity detail responses. These are detail-page sub-tables (not standalone paginated tables), so client-side filtering is architecturally justified, but composition proof requires browser evidence.

3. **Customer Partners / Partner Customers**: No meaningful filter candidates — relationship aggregates lack canonical status/type fields.

4. **Platform Bookings Search**: No search parameter exposed in booking controller.

---

## NEXT CANONICAL STAGE

After completing URL state persistence and remaining composition proof:

```text
Operational Notes / Comments Architecture Reconciliation
```

---

*Report generated: 2026-08-26*
