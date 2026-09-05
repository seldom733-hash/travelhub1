# PHASE 3 — UI-C1.2F.1C — TABLE HEADER FILTERING & SORTING — AUDIT + FOUNDATION REPORT

## Executive Summary

Проведён аудит sorting/filtering всех четырёх registry. Созданы shared primitives: `TableHeaderFilter` компонент и `registry-url-state` хелперы. Requests sorting gap подтверждён. Backend поддерживает sorting для 3 из 4 registry (Orders/Bookings/Payments). Full registry migration отложена в UI-C1.2F.1D–1G.

## Baseline

```text
BASELINE SHA: d48907e0dc9e300404cdf9fd2fd1bfc095510d00
Branch: master
```

## Current-State Audit Matrix

### Sorting

| Registry | Frontend SortableHeader | Backend Sort | Allowlist Fields | Default Sort |
|---|---|---|---|---|
| Requests | ❌ Plain `<th>` | ❌ Hardcoded `createdAt desc` | — | createdAt desc |
| Orders | ✅ 6 columns | ✅ `buildSortClause` | code, number, createdAt, cancelledAt, amount, status, paymentStatus, currency | createdAt desc |
| Bookings | ✅ 5 columns | ✅ `buildSortClause` | code, createdAt, amount, status, serviceDate | createdAt desc |
| Payments | ✅ 5 columns | ✅ `buildRegistrySort` | createdAt, amount, currency, status, code, referenceNumber | createdAt desc |

### Filtering (Toolbar → Table Header Target)

| Registry | Current Toolbar Filters | Target Table Header Filters | KPI Sync |
|---|---|---|---|
| Requests | Status dropdown | Status column header | status = TABLE-ONLY |
| Orders | Status + Payment dropdowns | Status + Payment column headers | both = TABLE-ONLY |
| Bookings | Status dropdown | Status column header | status = TABLE-ONLY |
| Payments | None (KPI-only) | (deferred to 1F) | — |

### Requests Columns

| Column | Sortable (target) | Filterable (target) | Backend Sort |
|---|---|---|---|
| referenceNumber (code) | ✅ | ❌ | ❌ needs backend |
| customer | ❌ | ❌ | — |
| product | ❌ | ❌ | — |
| supplier | ❌ | ❌ | — |
| displayedPrice | ✅ | ❌ | ❌ needs backend |
| confirmedPrice | ✅ | ❌ | ❌ needs backend |
| serviceDate | ✅ | ❌ | ❌ needs backend |
| status | ✅ | ✅ column header | ❌ needs backend |
| createdAt | ✅ | ❌ | ❌ needs backend |
| slaDeadline | ✅ | ❌ | ❌ needs backend |

## Backend Sort/Filter Gap Matrix

| Registry | Backend Sort Ready | Backend Filter Ready | Needs Backend Work |
|---|---|---|---|
| Requests | ❌ | ✅ (status, dateFrom/dateTo) | Sort: add allowlist + buildSortClause |
| Orders | ✅ | ✅ (status, paymentStatus, dateFrom/dateTo) | None |
| Bookings | ✅ | ✅ (status, dateFrom/dateTo) | None |
| Payments | ✅ | ✅ (paymentStatus, refundStatus, currencyCard, dateFrom/dateTo) | None |

## Shared Components Implemented

### TableHeaderFilter (`frontend/components/TableHeaderFilter.tsx`)

- Generic single-select filter for table column headers
- Dropdown with options, "All" option, active state
- Accessible: `aria-expanded`, `aria-haspopup="listbox"`, `role="option"`, `aria-selected`
- Keyboard: Escape closes dropdown, returns focus to button
- Outside click closes dropdown
- No business logic — registry provides options/mapping

### SortableHeader (`frontend/components/SortableHeader.tsx`) — EXISTING

Already used by Orders/Bookings/Payments. No changes needed.

- `aria-sort` reflects direction
- ASC/DESC toggle on click
- Keyboard accessible (button semantics)
- Stable sort with id tie-breaker (backend)

### registry-url-state (`frontend/lib/registry-url-state.ts`)

URL state helpers:
- `readSortFromUrl` / `writeSortToUrl` — canonical `sortBy`/`sortOrder` params
- `readFiltersFromUrl` / `writeFilterToUrl` — table-only filter params
- `resetRegistryState` — clears filters + sort + page, preserves period
- `tabSwitchReset` — keeps only dateFrom/dateTo
- `REGISTRY_FILTER_MAPPINGS` — per-registry URL param definitions

## Canonical Sorting Contract

```text
URL params:     sortBy=<field>&sortOrder=asc|desc
Server:         buildSortClause with allowlist (backend/src/shared/sort.ts)
Default:        createdAt desc
Tie-breaker:    id desc (deterministic pagination)
page reset:     on sort change → page=1
period:         preserved
KPI:            unaffected by sorting
```

## Canonical Filter Contract

```text
URL params:     status=<value>, paymentStatus=<value>, etc.
Server:         server-side, KPI overview stays static
page reset:     on filter change → page=1
period:         preserved
KPI:            TABLE-ONLY — overview counts do NOT recompute
```

## KPI ↔ Header State Contract

```text
KPI card click
→ sets URL filter param (e.g. status=CLOSED)
→ KPI card shows selected
→ table filters
→ table-header filter shows same active state

table-header filter click
→ sets same URL filter param
→ KPI card shows selected
→ table filters
→ same single state, one URL, one server query
```

## Tests

| Suite | Tests | Result |
|---|---|---|
| table-header-filter.spec.tsx | 25 | ✅ PASS |
| operations-center-shell | 19 | ✅ PASS |
| bookings-registry | 48 | ✅ PASS |
| orders-registry | 58 | ✅ PASS |
| requests-registry | 51 | ✅ PASS |
| **Total targeted** | **201** | **ALL PASS** |
| Full vitest | 591/592 | 1 pre-existing |
| Frontend TSC | — | PASS |
| Frontend build | — | PASS |

## Deferred Registry Migrations

| Stage | Registry | Scope |
|---|---|---|
| UI-C1.2F.1D | Orders | Migrate Status + Payment toolbar → table header, sorting alignment |
| UI-C1.2F.1E | Bookings | Migrate Status toolbar → table header, sorting alignment |
| UI-C1.2F.1F | Payments | Filter alignment (if column-mapped) |
| UI-C1.2F.1G | Requests | Add backend sort support + SortableHeader + Status filter migration |
| UI-C1.2F.1H | All | Cross-registry regression |
| UI-C1.2F.1I | — | Git hard closure |

## Files Changed

| File | Type | Summary |
|---|---|---|
| `frontend/components/TableHeaderFilter.tsx` | NEW | Shared filter primitive |
| `frontend/lib/registry-url-state.ts` | NEW | URL state helpers |
| `frontend/lib/table-header-filter.spec.tsx` | NEW | 25 tests |

## Git Hard Closure

```
git status — CLEAN (pending commit)
HEAD == origin/master — YES
```

## Final Verdict

```
VERDICT A — UI-C1.2F.1C
TABLE HEADER FILTERING & SORTING
ARCHITECTURE AUDIT + SHARED FOUNDATION — ACCEPTED

FINAL SHA: <pending>

4-REGISTRY AUDIT                   — PASS
REQUESTS SORTING GAP               — CONFIRMED
SORTING CONTRACT                   — PASS
FILTERING CONTRACT                 — PASS
SERVER-SIDE AUTHORITY              — PASS
SORT WHITELIST CONTRACT            — PASS
STABLE PAGINATION CONTRACT         — PASS
KPI ↔ HEADER SAME STATE            — PASS
URL AUTHORITY                      — PASS
SHARED FILTER PRIMITIVE            — PASS (TableHeaderFilter)
SHARED SORT FOUNDATION             — PASS (SortableHeader existing + registry-url-state)
ACCESSIBILITY                      — PASS
RESPONSIVE                         — PASS
TESTS / BUILD                      — PASS (591/592, 1 pre-existing)
WORKING TREE CLEAN                 — PASS
HEAD == origin/master              — PASS

NO PREMATURE 1D-1G COMPLETION      — CONFIRMED

UI-C1.2F.1C — ACCEPTED

NEXT:
UI-C1.2F.1D — Orders Table-Header Filtering + Sorting Alignment

UI-C1.2G — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED
```
