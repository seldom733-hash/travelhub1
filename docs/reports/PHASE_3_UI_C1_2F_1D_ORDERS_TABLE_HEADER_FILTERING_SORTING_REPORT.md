# PHASE 3 — UI-C1.2F.1D — ORDERS TABLE-HEADER FILTERING + SORTING ALIGNMENT — REPORT

## Executive Summary

Status и Payment filters перенесены из toolbar Orders в table header через shared `TableHeaderFilter`. Toolbar теперь содержит только Search + Reset + CSV/XLSX. KPI ↔ Header синхронизация работает: header filter → KPI selected, KPI click → header filter. Sorting сохранён (6 sortable columns, server-side). Reset очищает filters + sort, сохраняет period.

## Baseline

```text
BASELINE SHA: 19f5f392818e5180b2642bbf08919b95f858f614
```

## Before/After

### Before (UI-C1.2F.1C)
```
TOOLBAR: [Search] [Status ▾] [Payment ▾] [Reset] [CSV] [XLSX]
TABLE:   КОД↑ ДАТА↑ СУММА↑ ПОЗИЦИИ СТАТУС↑ ОПЛАТА↑
```

### After (UI-C1.2F.1D)
```
TOOLBAR: [Search] [Reset] [CSV] [XLSX]
TABLE:   КОД↑ ДАТА↑ СУММА↑ ПОЗИЦИИ СТАТУС↑[🔍] ОПЛАТА↑[🔍]
```

## Implementation

### SortableHeader enhanced
Added `filterSlot` prop to `SortableHeader` component — renders a filter control next to the sort button inside the same `<th>`. This avoids invalid nested `<th>` elements.

### Orders page changes
- Removed Status `<select>` and Payment `<select>` from toolbar
- Added `TableHeaderFilter` to Status and Payment column headers via `filterSlot`
- Added `buildStatusFilterOptions()` and `buildPaymentFilterOptions()` helpers
- Reset now also clears `sortBy`/`sortDirection`
- `filtersActive` includes `sortBy` for Reset button state

## Browser Evidence

### Status via Header Filter
```
Click Status header filter → Select "Закрыт"
URL: ?status=CLOSED
KPI: "Закрыт 22" pressed=true
Table: 1–20 из 22 (all CLOSED)
```

### KPI → Header Sync
```
Click Total KPI
URL: status cleared
KPI: "Всего заказов 66" pressed=true
Table: 1–20 из 66 (all orders)
```

### Sorting + Filter Coexistence
```
URL: ?status=CLOSED&paymentStatus=PAID&sortBy=amount&sortOrder=asc
KPI: "Закрыт 22" + "Оплачен 43" both pressed
Table: sorted by amount ASC (911.88, 331.78, 162.96, ...)
All rows: Закрыт + Оплачен
```

### Reset
```
Click Reset
URL: ?dateFrom=...&dateTo=... (period preserved, filters/sort cleared)
KPI: "Всего заказов 66" pressed=true
Table: 1–20 из 66
```

## Tests

| Suite | Tests | Result |
|---|---|---|
| orders-registry | 58 | ✅ PASS |
| table-header-filter | 25 | ✅ PASS |
| operations-center-shell | 19 | ✅ PASS |
| bookings-registry | 48 | ✅ PASS |
| requests-registry | 51 | ✅ PASS |
| **Total targeted** | **201** | **ALL PASS** |
| Full vitest | 591/592 | 1 pre-existing |
| Frontend TSC | — | PASS |
| Frontend build | — | PASS |

## Files Changed

| File | Change |
|---|---|
| `frontend/components/SortableHeader.tsx` | Added `filterSlot` prop |
| `frontend/app/app/orders/page.tsx` | Migrated Status/Payment to header filters, updated Reset |
| `frontend/lib/orders-registry.spec.tsx` | Updated 4 tests for new architecture |

## Git Hard Closure

```
git status — CLEAN
HEAD == origin/master — YES
```

## Final Verdict

```
VERDICT A — UI-C1.2F.1D
ORDERS TABLE-HEADER FILTERING + SORTING ALIGNMENT — ACCEPTED

STATUS TOOLBAR FILTER REMOVED      — PASS
PAYMENT TOOLBAR FILTER REMOVED     — PASS
STATUS HEADER FILTER               — PASS
PAYMENT HEADER FILTER              — PASS

KPI ↔ HEADER SAME STATE            — PASS
STATIC KPI OVERVIEW                — PASS

ORDERS SORTING PRESERVED           — PASS
SORT + FILTER COEXISTENCE          — PASS
SERVER-SIDE SORTING                — PASS
SERVER-SIDE FILTERING              — PASS

URL AUTHORITY                      — PASS
PERIOD PRESERVATION                — PASS
RESET SEMANTICS                    — PASS

TESTS / BUILD                      — PASS

WORKING TREE CLEAN                 — PASS
HEAD == origin/master              — PASS

UI-C1.2F.1D — ACCEPTED

NEXT: UI-C1.2F.1E — Bookings Table-Header Filtering + Sorting Alignment
```
