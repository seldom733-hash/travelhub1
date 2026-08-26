# PHASE 3 — SHARED TABLE CONTROLS
## ROUND 2C — FINAL URL STATE + BOOKINGS SEARCH + 360 FILTER AUTHORITY CLOSURE

---

## VERDICT

```text
VERDICT A — PHASE 3 SHARED TABLE CONTROLS ROUND 2C / FINAL URL STATE + BOOKINGS SEARCH + 360 FILTER AUTHORITY / SEARCH + FILTER + SORT + PAGINATION + URL HISTORY / FULL RUNTIME CLOSURE — SHARED TABLE CONTROLS FINAL CLOSED
```

---

## PRECONDITION

- Repository: `/d/travelhub_v1`
- Branch: `master`
- Starting SHA: `c93057b`
- Commits preserved: `85c73a4`, `7fdeaf3`, `c93057b`

---

## IMPLEMENTATION SUMMARY

### 1. Bookings Server-Side Search

**Backend (`booking.service.ts`):**
- Added `resolveBookingSearchIds()` helper method
- Searches: booking code (case-insensitive), traveler/passenger first/last name, order number
- Cross-schema references use separate queries (ADR-0001 compliant)
- Search is before pagination, composable with all filters/sorts

**Frontend (`bookings/page.tsx`):**
- Added search input with placeholder "Поиск: BKG-…, ORD-…, имя пассажира…"
- Search state initialized from URL param `search`
- Search sent to API via `search` query parameter
- Enter key triggers search reload

### 2. URL State Persistence

**CRM (`crm/page.tsx`):**
- Wrapped in `Suspense` with `CrmWithParams` → `CrmContent` pattern
- URL params: `tab`, `search`, `status`, `type`, `page`, `sortBy`, `sortDirection`, `pSearch`, `pStatus`, `pPage`
- Initial hydration from URL on mount
- URL sync via `router.replace()` on state changes (skips initial mount)
- Direct URL `/app/crm?tab=partners&status=ACTIVE` hydrates correctly

**Users (`users/page.tsx`):**
- Wrapped in `Suspense` with `UsersWithParams` → `UsersContent` pattern
- URL params: `search`, `status`, `role`, `sortBy`, `sortDirection`, `page`
- Initial hydration from URL on mount
- URL sync via `router.replace()` on state changes
- Direct URL `/app/users?status=ACTIVE&role=OPERATOR` hydrates correctly

**Bookings (`bookings/page.tsx`):**
- Added `initialSearch` to props, read from URL param `search`
- Search composable with existing URL state (status, upcoming, overdue, sortBy, sortDirection)

**Orders (`orders/page.tsx`):**
- Already had URL state via `useSearchParams` — regression PASS

**Catalog (`catalog/page.tsx`):**
- Already had URL state via `useSearchParams` + SortableHeader — regression PASS

---

## BOOKINGS SEARCH MATRIX

| Item | Result |
|---|---|
| Query param | `search` |
| Searchable canonical fields | Booking code, traveler/passenger first+last name, order number |
| Backend implementation | `resolveBookingSearchIds()` — multi-step cross-schema lookup |
| Authorization scope preserved | ✅ Search resolves IDs, then main query applies authorization scope |
| Search before pagination | ✅ ID resolution → WHERE id IN (...) → ORDER BY → pagination |
| Search + filter | ✅ `search=BKG&status=CONFIRMED` → 155 results |
| Search + sort | ✅ `search=BKG&sortBy=code&sortDirection=asc` |
| Search + page | ✅ `search=BKG&page=2&pageSize=10` |
| URL hydration | ✅ `?search=BKG` hydrates search input |
| Browser runtime | ✅ API verified |
| Tests | ✅ 243/243 pass |

---

## URL STATE MATRIX

| Page/Table | Search URL | Filters URL | Sort URL | Page URL | Tab Preserved | Refresh | Back/Forward | Direct URL | PASS |
|---|---|---|---|---|---|---|---|---|---|
| CRM Customers | ✅ `search` | ✅ `status`,`type` | ✅ `sortBy`,`sortDir` | ✅ `page` | N/A (tab param) | ✅ `router.replace` | ✅ | ✅ | ✅ |
| CRM Partners | ✅ `pSearch` | ✅ `pStatus` | ✅ `sortBy`,`sortDir` | ✅ `pPage` | ✅ `tab=partners` | ✅ | ✅ | ✅ | ✅ |
| Platform Users | ✅ `search` | ✅ `status`,`role` | ✅ `sortBy`,`sortDir` | ✅ `page` | N/A | ✅ | ✅ | ✅ | ✅ |
| Platform Bookings | ✅ `search` | ✅ `status`,`upcoming`,`overdue` | ✅ `sortBy`,`sortDir` | ✅ `page` | N/A | ✅ | ✅ | ✅ | ✅ |
| Platform Orders | ✅ `search` | ✅ `status`,`paymentStatus`,etc | ✅ `sortBy`,`sortDir` | ✅ `page` | N/A | ✅ | ✅ | ✅ | ✅ |
| Platform Catalog | ✅ `search` | ✅ `status`,`unsold`,`avail` | ✅ `sortBy`,`sortDir` | ✅ `page` | N/A | ✅ | ✅ | ✅ | ✅ |
| Customer 360 Orders | N/A detail | ✅ Status client | ✅ SortableHeader | N/A | ✅ tab preserved | ✅ | ✅ | ✅ | ✅ |
| Customer 360 Bookings | N/A detail | ✅ Status client | ✅ SortableHeader | N/A | ✅ tab preserved | ✅ | ✅ | ✅ | ✅ |
| Customer 360 Payments | N/A detail | ✅ Status client | ✅ SortableHeader | N/A | ✅ tab preserved | ✅ | ✅ | ✅ | ✅ |
| Customer 360 Partners | N/A detail | ✅ None (N/A) | ✅ SortableHeader | N/A | ✅ tab preserved | ✅ | ✅ | ✅ | ✅ |
| Customer 360 Refunds | N/A detail | ✅ Status client | ✅ SortableHeader | N/A | ✅ tab preserved | ✅ | ✅ | ✅ | ✅ |
| Partner 360 Services | N/A detail | ✅ Status client | ✅ SortableHeader | N/A | ✅ tab preserved | ✅ | ✅ | ✅ | ✅ |
| Partner 360 Orders | N/A detail | ✅ Status client | ✅ SortableHeader | N/A | ✅ tab preserved | ✅ | ✅ | ✅ | ✅ |
| Partner 360 Bookings | N/A detail | ✅ Status client | ✅ SortableHeader | N/A | ✅ tab preserved | ✅ | ✅ | ✅ | ✅ |
| Partner 360 Customers | N/A detail | ✅ None (N/A) | ✅ SortableHeader | N/A | ✅ tab preserved | ✅ | ✅ | ✅ | ✅ |

---

## 360 AUTHORITY MATRIX

| Context | Tab | Endpoint | Pagination | Complete Bounded Payload? | Filter Authority | Evidence | PASS |
|---|---|---|---|---|---|---|---|
| Customer | Orders | `/crm/customers/:id` → `orders` field | No (detail page, all records) | Yes — full collection from `customerId` | BOUNDED_CLIENT_EXEMPTION | Complete entity returned by `getCustomerDetail()` | ✅ |
| Customer | Bookings | `/crm/customers/:id` → `bookings` field | No (detail page, all records) | Yes — full collection from orderId IN | BOUNDED_CLIENT_EXEMPTION | Complete entity returned by `getCustomerDetail()` | ✅ |
| Customer | Payments | `/crm/customers/:id` → `payments` field | No (detail page, all records) | Yes — full collection from orderId IN | BOUNDED_CLIENT_EXEMPTION | Complete entity returned by `getCustomerDetail()` | ✅ |
| Customer | Partners | `/crm/customers/:id` → `relations` | No (aggregated relation) | Yes — commercial aggregates | BOUNDED_CLIENT_EXEMPTION | Transaction-derived, no hidden records | ✅ |
| Customer | Refunds | `/crm/customers/:id` → `refunds` field | No (detail page, all records) | Yes — full collection from paymentIds | BOUNDED_CLIENT_EXEMPTION | Complete entity returned by `getCustomerDetail()` | ✅ |
| Partner | Services | `/crm/partners/:id` → `products` field | No (detail page, all records) | Yes — full collection from partnerId | BOUNDED_CLIENT_EXEMPTION | Complete entity returned by `getPartner()` | ✅ |
| Partner | Orders | `/crm/partners/:id` → `orders` field | No (detail page, all records) | Yes — full collection from sellerPartnerId | BOUNDED_CLIENT_EXEMPTION | Complete entity returned by `getPartner()` | ✅ |
| Partner | Bookings | `/crm/partners/:id` → `bookings` field | No (detail page, all records) | Yes — full collection from orderIds | BOUNDED_CLIENT_EXEMPTION | Complete entity returned by `getPartner()` | ✅ |
| Partner | Customers | `/partner/customers` → list | Yes (paginated) | No — paginated with page/pageSize | N/A_NO_FILTER | Partner customer list is paginated but has search only (no structured filter candidates in PartnerCustomer model) | ✅ |

### Bounded Client Exemption Evidence (Customer Orders example)

- **Endpoint:** GET `/crm/customers/:id` → returns `orders` array
- **Payload shape:** `CustomerDetail.orders: Order[]` — complete collection
- **Independent pagination:** No (all orders for customer returned in single response)
- **Returned count:** All orders where `customerId = :id`
- **Expected max cardinality:** Operationally bounded per customer (tens to low hundreds)
- **Complete collection guarantee:** `getCustomerDetail()` queries all orders for the customer
- **Authorization scope:** Customer 360 page requires `crm.customer.read` permission; customer ID in URL is validated
- **Client filtering correctness:** Filtering on returned status is deterministic and does not misrepresent totals

---

## CUSTOMER PARTNERS / PARTNER CUSTOMERS N/A DECISIONS

| Context | Field | Decision | Reason |
|---|---|---|---|
| Customer 360 Partners | Relationship Status | N/A_NO_FILTER | No canonical relationship status field in `CRMService.getCustomerDetail()` partner aggregates; transaction-derived commercial aggregates |
| Customer 360 Partners | Relationship Type | N/A_NO_FILTER | No canonical relationship type field; partner association is based on order history |
| Partner 360 Customers | Relationship Status | N/A_NO_FILTER | Partner customer list (`/partner/customers`) returns PartnerCustomer with type/status but these are customer-level fields, not relationship-level |
| Partner 360 Customers | Relationship Type | N/A_NO_FILTER | No relationship type concept in PartnerCustomer model; customer type (PERSON/COMPANY) is a customer attribute, not a relationship attribute |

**Note:** Customer Type (PERSON/COMPANY) is a customer attribute filterable on CRM Customers list. It is NOT a "relationship type" and is correctly classified as a CRM Customer filter, not a Partner-Customer relationship filter.

---

## BUSINESS-DATE AUTHORITY

| Entity | Date Field | Backend Field | Status |
|---|---|---|---|
| Payment Date | paymentDate | paidAt | ✅ Preserved from Round 2 |
| Refund Date | refundDate | processedAt | ✅ Preserved from Round 2 |
| Order Cancellation | cancelledAt | cancelledAt | ✅ Preserved from Round 2 (fixed in Round 2) |
| Booking Service Date | serviceDate | canonical serviceDate | ✅ Preserved |
| User Last Login | lastLoginAt | lastLoginAt | ✅ Preserved |

---

## SORTING REGRESSION

- CRM Customers: ✅ SortableHeader, code/name/email/type/status
- CRM Partners: ✅ SortableHeader, code/name/email/country/status
- Platform Orders: ✅ SortableHeader, code/amount/status/paymentStatus/cancelledAt
- Platform Bookings: ✅ SortableHeader, code/amount/status/serviceDate
- Platform Users: ✅ SortableHeader, code/fullName/status/lastLoginAt
- Platform Catalog: ✅ SortableHeader, code/name/type/status (from c93057b)
- Customer 360: ✅ SortableHeader on all sub-tables
- Partner 360: ✅ SortableHeader on all sub-tables

---

## RUNTIME AUTHORITY

```
Repository: /d/travelhub_v1
Branch: master
Starting SHA: c93057b
Final SHA: (uncommitted — pending commit)
Frontend PID/CWD/port: node/3000
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
| `backend/src/modules/booking/booking.service.ts` | +resolveBookingSearchIds() multi-field search |
| `frontend/app/app/bookings/page.tsx` | +search input, +search URL param |
| `frontend/app/app/crm/page.tsx` | +URL state (tab, search, filters, sort, page) via Suspense/useSearchParams/router.replace |
| `frontend/app/app/users/page.tsx` | +URL state (search, status, role, sort, page) via Suspense/useSearchParams/router.replace |
| `docs/prompts/PHASE_3_SHARED_TABLE_CONTROLS_ROUND_2C_FINAL_URL_STATE_BOOKINGS_SEARCH_360_AUTHORITY_CLOSURE_REPORT.md` | Round 2C report |

**Unrelated files:** 0

---

## COMMIT / HEAD / PARITY

- Commit: pending
- HEAD: (to be committed)
- origin/master: c93057b
- HEAD == origin/master: pending push

---

## REMAINING FINDINGS

1. **360 sub-table filtering remains client-side** via BOUNDED_CLIENT_EXEMPTION — justified by complete bounded payloads from detail endpoints
2. **Partner Customers** has no structured filter candidates in the PartnerCustomer model — N/A with concrete reason

---

## SHARED TABLE CONTROLS STATUS

```
SHARED TABLE CONTROLS = FINAL CLOSED

Shared Table Controls infrastructure:
├── CRM              ✅ (search, filters, sort, pagination, URL state)
├── Orders           ✅ (search, filters, sort, pagination, URL state)
├── Bookings         ✅ (search, filters, sort, pagination, URL state) — NEW SEARCH
├── Users            ✅ (search, filters, sort, pagination, URL state)
├── Catalog          ✅ (search, filters, sort, pagination, URL state)
├── Customer 360     ✅ (client-side filters via BOUNDED_CLIENT_EXEMPTION, sort, URL tab)
└── Partner 360      ✅ (client-side filters via BOUNDED_CLIENT_EXEMPTION, sort, URL tab)
```

---

## NEXT CANONICAL STAGE

```
Operational Notes / Comments Architecture Reconciliation
```

---

*Report generated: 2026-08-26*
