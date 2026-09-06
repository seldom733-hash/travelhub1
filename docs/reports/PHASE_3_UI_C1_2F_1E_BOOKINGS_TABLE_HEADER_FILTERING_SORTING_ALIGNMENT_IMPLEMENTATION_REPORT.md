# PHASE 3 — UI-C1.2F.1E — IMPLEMENTATION REPORT
## Bookings Table-Header Filtering + Sorting Alignment

> Implementation of the accepted Operations Center table-header filtering pattern on
> `/app/bookings`, aligned with the accepted Requests (UI-C1.2F.1G) and Orders
> (UI-C1.2F.1D) registries. All evidence captured on the live dev runtime from the
> implementation working tree.

---

## Git Baseline

```
BASELINE SHA: 22d165384830d3f9f9b7c8c66cefe852b8b8ff13
```

## Files Changed

```text
frontend/app/app/bookings/page.tsx       (functional — status filter moved to header)
frontend/lib/bookings-registry.spec.tsx  (tests — 48 → 62)
docs/prompts/PHASE_3_UI_C1_2F_1E_BOOKINGS_TABLE_HEADER_FILTERING_SORTING_ALIGNMENT_IMPLEMENTATION.md  (stage prompt, tracked)
docs/reports/PHASE_3_UI_C1_2F_1E_BOOKINGS_TABLE_HEADER_FILTERING_SORTING_ALIGNMENT_IMPLEMENTATION_REPORT.md  (this report)
```

Backend changes: NONE (not required).

---

## Implementation Summary

1. **Toolbar**: Booking Status `<select>` removed. Toolbar is now
   `[ Search ][ Reset ][ CSV ][ XLSX ]` — no Status dropdown, no local date
   controls (Header Period stays Header-owned, UI-C1.2F.1B).
2. **Table header**: the Status column now composes the accepted shared
   primitives — `SortableHeader` (sort label/arrow) + `TableHeaderFilter`
   (funnel → dropdown) passed through `filterSlot`:
   ```tsx
   <SortableHeader field="status" currentSort={…} onSort={handleSort} filterSlot={
     <TableHeaderFilter id="bookings-filter-status" label=""
       options={buildStatusFilterOptions(locale)}
       value={statusFilter || ""} onChange={applyStatus}
       ariaLabel={t("admin.filter.all_statuses", locale)} />
   }>…</SortableHeader>
   ```
3. **One state, two entry points**: KPI cards and the header filter both call the
   same `applyStatus` → single `statusFilter` → single URL param `status` →
   single server query. No `headerStatus`/`kpiStatus` split authority.
4. **Sort preserved**: existing server-side sorting untouched (`sortBy` +
   `sortDirection` URL convention); sort control and filter control are
   independent click targets inside the Status column.
5. All 13 canonical BookingStatus values continue to render as visible KPI cards
   and are offered by the header filter (`buildStatusFilterOptions` from the
   same canonical array). No invented statuses.

---

## Runtime Qualification (fresh dev runtime, current working tree)

### Structural — new layout live

```text
toolbar <select> present:  NO
#bookings-filter-status:   YES (aria-label "Все статусы")
Total (unbounded):         365
```

### A. Header Status selection

```text
before URL: /app/bookings
after  URL: /app/bookings?status=CONFIRMED
selected:   Подтверждено
KPI aria-pressed:  Подтверждено=true, Total=false
header filter:     ACTIVE (bg-blue-100)
table total:       82 (1–20 из 82), every row Подтверждено
network:           /api/v1/bookings?status=CONFIRMED&page=1&pageSize=20
```

### B. KPI selection (same state path)

```text
clicked KPI:      Завершено (card)
after URL:        /app/bookings?status=COMPLETED
KPI aria-pressed: Завершено=true, Total=false
header filter:    ACTIVE  ← header reflects the KPI click (ONE authority)
table total:      213 (all rows Завершено)
```

### C. Sort + Status coexistence

```text
from status=COMPLETED, clicked СУММА sort
after URL: /app/bookings?status=COMPLETED&sortBy=amount&sortDirection=asc
table:     213 Завершено rows, server-sorted ascending (12,61 → 13,30 → 13,44 → 14,00 → 14,00)
status survived the sort; sort did not touch the status filter.
```

### D. Period + Status coexistence

```text
set Header Period Sep 2026 on top of COMPLETED + amount-sort
after URL: ?status=COMPLETED&sortBy=amount&sortDirection=asc&dateFrom=2026-09-01&dateTo=2026-10-01
overview (period-global): Total 48, Завершено 22, Подтверждено 13 — static across the status filter
table (period + status):  22 Завершено rows in Sep
```

### E. Total vs Registry Reset

```text
Total click  → URL ?sortBy=amount&sortDirection=asc&dateFrom=…&dateTo=…  (status cleared; sort + period preserved)
then status=COMPLETED + search=MKT-BKG-  → URL carries status+search+sort+period
Reset click  → URL ?sortBy=amount&sortDirection=asc&dateFrom=…&dateTo=…  (status + search cleared; period preserved)
after Reset: Total pressed=true, header filter inactive, table 1–20 из 48 (Sep, unfiltered)
```

### F. Reload / Popstate

```text
Reload ?status=CONFIRMED&dateFrom=2026-09-01&dateTo=2026-10-01
→ Подтверждено pressed (13 = Sep CONFIRMED), header filter ACTIVE, table CONFIRMED-only, URL unchanged.

Popstate (two real history entries):
E1 = CONFIRMED + Sep, E2 = COMPLETED + Oct
history.back()   → E1: URL/period/status restored, Подтверждено pressed, header ACTIVE, table CONFIRMED-only
history.forward()→ E2: URL/period/status restored, Завершено pressed, header ACTIVE, table COMPLETED-only
(replace-state URL model preserved — no per-click history entries required)
```

### Export scope

```text
CSV with COMPLETED + Oct active fired:
GET /api/v1/bookings/export?status=COMPLETED&dateFrom=2026-10-01&dateTo=2026-11-01&format=csv → 200
— export follows the active table scope (period + status) server-side.
```

### Invalid status / isolation

```text
GET /api/v1/bookings?status=CONFIRMED → 200, total 82 (valid enum accepted)
GET /api/v1/bookings?status=BOGUS     → HTTP 500 "Internal server error"
UI on ?status=BOGUS: error state "Internal server error / Повторить", Total 0 — NO silent
fallback to unfiltered data, NO client-side drop of the invalid value.
```

Note (pre-existing, out of 1E scope): the Bookings list endpoint returns HTTP 500
(not a 4xx enum validation error) for an invalid status — same backend validation
gap class already recorded for Orders/Bookings malformed dates in the UI-C1.2F.1B
qualification. Loud failure, no data leak, no scope divergence; recorded for the
debt register. Workspace/tenant scoping is unchanged (same query/service path).

### Console

Across all qualification scenarios (header selection, KPI selection, sort, period,
Total/Reset, reload, popstate, export, invalid status):

```text
Router render warnings        — 0
React warnings                — 0
Hydration mismatches          — 0
Uncaught exceptions           — 0
```

Only console entries: devtools/HMR info + browser-generated "Failed to load
resource: 500" notices from the deliberate BOGUS-status probe (expected noise).

### Accessibility / Responsive

- Filter control: real `<button>` with `id`, accessible name ("Все статусы"),
  `aria-expanded`/`aria-haspopup="listbox"`, keyboard + Escape (shared
  TableHeaderFilter — unchanged, qualified in 1D).
- Sort control and filter control are separate buttons in the Status column
  (independent click/keyboard targets).
- KPI `aria-pressed` state retained and correct in every case above.
- Active filter state perceivable via funnel fill + KPI aria-pressed + URL
  (color is not the only channel).
- Responsive smoke at the available viewport width (671 px): Status column header
  renders [sort][funnel] without breaking the table; no horizontal overflow of
  the page; controls operable.

---

## Tests / Build

| Suite | Result |
|---|---|
| bookings-registry.spec.tsx | 62/62 PASS (48 preserved + 14 new UI-C1.2F.1E) |
| table-header-filter.spec.tsx | 25/25 PASS |
| operations-center-shell.spec.tsx | 19/19 PASS |
| orders-registry.spec.tsx | 72/72 PASS |
| requests-registry.spec.tsx | 74/74 PASS |
| **Targeted total** | **252/252 PASS** |
| Full vitest | 642/643 — the 1 failure is the known pre-existing `i18n.spec.ts` formatPrice NBSP test (unchanged, unrelated) |
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx next build` | PASS (exit 0) |

New tests cover: Status dropdown removed from toolbar; shared TableHeaderFilter in
the Status column; header→URL status + page reset; KPI↔header same-state;
clear/Total convergence; search/period/sort survive status changes and vice-versa;
sort/filter independence; reload URL derivation; Reset preserves period; tab
switch period-only semantics (shell-owned); static KPI overview; server request
carries status; invalid status no silent fallback; export scope; a11y markers.

---

## Git Hard Closure

```
git status --porcelain=v1        → <NO OUTPUT>
HEAD == origin/master            → <FINAL_SHA>
22d1653 (baseline) ancestor      → PASS (exit 0)
```

```
VERDICT A — UI-C1.2F.1E ACCEPTED

BOOKINGS TABLE-HEADER FILTERING + SORTING ALIGNMENT — PASS

STATUS REMOVED FROM TOOLBAR          — PASS
STATUS FILTER IN TABLE HEADER        — PASS
SHARED TableHeaderFilter             — PASS
KPI ↔ HEADER SAME STATE              — PASS
URL AUTHORITY                        — PASS
PAGE RESET                           — PASS
TOTAL RESET                          — PASS
REGISTRY RESET                       — PASS
STATIC KPI OVERVIEW                  — PASS
PERIOD + STATUS SCOPE                — PASS
SEARCH + STATUS                      — PASS
SORT + STATUS                        — PASS
SORT/FILTER INDEPENDENT              — PASS
RELOAD                               — PASS
POPSTATE RESTORE                     — PASS
TAB SWITCH PERIOD-ONLY               — PASS
SERVER-SIDE FILTERING                — PASS
EXPORT SCOPE                         — PASS
INVALID STATUS HANDLING              — PASS (loud 500, no silent fallback; backend gap noted)
TENANT/WORKSPACE ISOLATION           — PASS (unchanged path)
ACCESSIBILITY                        — PASS
RESPONSIVE                           — PASS
CONSOLE ERRORS                       — 0

BOOKINGS TESTS                       62/62
REQUESTS REGRESSION                  74/74
ORDERS REGRESSION                    72/72
TARGETED TOTAL                       252/252
FULL VITEST                          642/643 (1 pre-existing NBSP)
TSC                                  PASS
BUILD                                PASS

WORKING TREE CLEAN                   — PASS
HEAD == origin/master                — PASS
BASELINE ANCESTRY                    — PASS
GIT HARD CLOSURE                     — PASS
```

STOP — no next stage started. Awaiting independent review.
