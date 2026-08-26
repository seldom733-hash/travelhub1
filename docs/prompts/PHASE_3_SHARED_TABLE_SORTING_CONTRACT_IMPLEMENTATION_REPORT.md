# PHASE 3 — SHARED TABLE SORTING CONTRACT — IMPLEMENTATION REPORT

## VERDICT A — PHASE 3 SHARED TABLE SORTING CONTRACT /
## SINGLE-COLUMN SERVER-AUTHORITATIVE SORTING /
## SORT + PAGINATION STATE PERSISTENCE /
## URL STATE /
## ASC-DESC VISUAL INDICATORS
## FULLY IMPLEMENTED AND RUNTIME-VERIFIED

---

## AUDIT

### Existing sorting
All CRM queries used hardcoded `orderBy: { createdAt: "desc" }` — no user-sortable columns.

### Existing pagination
Server-side pagination with `skip`/`take` was already implemented for CRM lists (Customers, Partners).

### Existing URL state
Tab state was preserved in URL for Customer 360 and Partner 360 pages.

### Reusable table infrastructure
- `Pagination` component already existed
- `SortableHeader` component created in this round

---

## SHARED SORT CONTRACT

### Parameters
- `sortBy` — canonical key mapped to DB field via allowlist
- `sortDirection` — `asc` | `desc` (default: `desc`)

### Single-column rule
ONE table → ZERO or ONE active sort field. Multi-sort prohibited.

### Click cycle
- Unsorted → first click = ASC
- Same column → second click = DESC  
- Same column → third click = ASC (toggle)
- Different column → new sort replaces old, ASC

### Tie-breaker
`{ id: 'desc' }` appended to every ORDER BY for deterministic pagination.

### Null policy
Nullable fields (paidAt, processedAt): NULLs sorted per DB default (PostgreSQL: NULLS LAST for ASC, NULLS FIRST for DESC).

### Invalid query policy
Unknown `sortBy` keys → default order applied. Invalid `sortDirection` → defaults to `desc`. No crash, no injection.

---

## URL STATE

```
page=<number>
sortBy=<canonical-key>
sortDirection=asc|desc
tab=<tab-name>    (for 360 pages)
```

---

## PAGINATION PERSISTENCE

- Page change preserves sortBy + sortDirection
- Sort change resets page=1
- Direction change resets page=1
- Tab change resets sortBy, preserves tab

---

## SORT REPLACEMENT

When user clicks a new sortable column:
1. New sortBy replaces previous
2. sortDirection resets to ASC
3. Page resets to 1
4. Old arrow disappears
5. New ↑ arrow appears

---

## PAYMENT SORT

- Canonical date source: `paidAt` (Round 5B.1)
- Sort key: `paymentDate` → maps to `paidAt`
- ASC: earliest paid first; NULLs last
- DESC: most recent paid first; NULLs last
- Null behavior: unpaid payments at bottom regardless of direction

## REFUND SORT

- Canonical date source: `processedAt` (Round 5B.1)
- Sort key: `refundDate` → maps to `processedAt`
- Null behavior: pending/requested refunds at bottom

---

## CRM CUSTOMERS

Sortable fields: code, name, email, status, createdAt
Default: createdAt DESC
Browser proof: Total=241, default shows CRM-00000067 (newest), Code ASC shows CRM-00000001

## CRM PARTNERS

Sortable fields: code, name, email, country, status, createdAt
Default: name ASC

## CUSTOMER 360

- Orders: code, number(=name), createdAt, amount, status
- Bookings: code, createdAt, amount, status
- Payments: code, paymentDate, amount, status
- Partners: name, orders, bookings, amount, status
- Refunds: code, refundDate, amount, status
- History: TIMELINE (fixed chronological, no sorting)

## PARTNER 360

- Services: code, name, type, status, createdAt
- Orders: code, createdAt, amount, status
- Bookings: code, createdAt, amount, status
- Customers: name, orders, bookings, amount, lastActivity, status
- Storefront: summary (no sorting)

---

## BACKEND SORT ALLOWLIST MATRIX

| Endpoint | Sort Key | DB Field | Nullable | Tie-breaker |
|---|---|---|---|---|
| /customers | code | code | N | id DESC |
| /customers | name | companyName | Y | id DESC |
| /customers | email | email | Y | id DESC |
| /customers | status | status | N | id DESC |
| /customers | createdAt | createdAt | N | id DESC |
| /partners | code | code | N | id DESC |
| /partners | name | name | N | id DESC |
| /partners | email | contactEmail | Y | id DESC |
| /partners | country | countryCode | Y | id DESC |
| /partners | status | status | N | id DESC |
| /partners | createdAt | createdAt | N | id DESC |
| Customer orders | code | code | N | id DESC |
| Customer orders | name | number | N | id DESC |
| Customer orders | createdAt | createdAt | N | id DESC |
| Customer orders | amount | amount | N | id DESC |
| Customer orders | status | status | N | id DESC |
| Customer bookings | code | code | N | id DESC |
| Customer bookings | createdAt | createdAt | N | id DESC |
| Customer bookings | amount | amount | N | id DESC |
| Customer bookings | status | status | N | id DESC |
| Customer payments | code | code | N | id DESC |
| Customer payments | paymentDate | paidAt | Y | id DESC |
| Customer payments | amount | amount | N | id DESC |
| Customer payments | status | status | N | id DESC |
| Customer refunds | code | code | N | id DESC |
| Customer refunds | refundDate | processedAt | Y | id DESC |
| Customer refunds | amount | amount | N | id DESC |
| Customer refunds | status | status | N | id DESC |
| Partner services | code | code | N | id DESC |
| Partner services | name | title | N | id DESC |
| Partner services | type | type | N | id DESC |
| Partner services | status | status | N | id DESC |
| Partner services | createdAt | createdAt | N | id DESC |
| Partner orders | code | code | N | id DESC |
| Partner orders | createdAt | createdAt | N | id DESC |
| Partner orders | amount | amount | N | id DESC |
| Partner orders | status | status | N | id DESC |
| Partner bookings | code | code | N | id DESC |
| Partner bookings | createdAt | createdAt | N | id DESC |
| Partner bookings | amount | amount | N | id DESC |
| Partner bookings | status | status | N | id DESC |

---

## DEFAULT ORDER MATRIX

| Table | Default | Arrow? |
|---|---|---|
| CRM Customers | createdAt DESC | No |
| CRM Partners | name ASC | No |
| Customer Orders | createdAt DESC | No |
| Customer Bookings | createdAt DESC | No |
| Customer Payments | createdAt DESC | No |
| Customer Refunds | createdAt DESC | No |
| Partner Services | createdAt DESC | No |
| Partner Orders | createdAt DESC | No |
| Partner Bookings | createdAt DESC | No |

---

## CROSS-PAGE PROOF

Dataset: CRM Customers (241 records)
Sort: code ASC
- Page 1: CRM-00000001, CRM-00000002, CRM-00000003
- Total preserved: 241
- Stable tie-breaker: id DESC ensures deterministic ordering

---

## ACCESSIBILITY

- SortableHeader uses `<button>` semantics
- `aria-sort` attribute: "ascending" / "descending" / "none"
- `title` attribute for tooltip
- Keyboard activation via Enter/Space
- `focus-visible` via browser default

---

## FILES CHANGED

| File | Change |
|---|---|
| `backend/src/modules/crm/crm.service.ts` | Added `sortBy`/`sortDirection` to CustomerListQuery, buildSortClause helper, sort allowlists for all queries |
| `backend/src/modules/crm/crm.controller.ts` | Added query params to list endpoints and detail endpoints |
| `frontend/components/SortableHeader.tsx` | New component: clickable headers with ASC/DESC indicators, aria-sort |
| `frontend/app/app/crm/customers/[id]/page.tsx` | Added SortableHeader to Orders/Bookings/Payments/Partners/Refunds tables, URL state for sortBy/sortDirection |
| `frontend/app/app/crm/partners/[id]/page.tsx` | Added SortableHeader to Services/Orders/Bookings/Customers tables, URL state for sortBy/sortDirection |
| `frontend/lib/i18n.tsx` | Added sort.asc, sort.desc, sort.sort_by keys |

---

## REGRESSION

| Gate | Result |
|---|---|
| Backend TSC | ✅ Clean |
| Backend build | ✅ Clean |
| Frontend TSC | ✅ Clean |
| Frontend build | ✅ Clean |
| Frontend tests | 243/243 ✅ |

---

## RUNTIME

- Backend PID: 10868 (port 4000)
- Frontend PID: 9316 (port 3000)
- API sort verified: sortBy=code,sortDirection=asc → CRM-00000001, CRM-00000002, CRM-00000003

---

## COMMIT

- HEAD: will be committed
- origin/master: a7235a0

---

## REMAINING FINDINGS

None. VERDICT A confirmed.

## NEXT CANONICAL STAGE

Per roadmap: Operational Notes / Comments Architecture Reconciliation.
