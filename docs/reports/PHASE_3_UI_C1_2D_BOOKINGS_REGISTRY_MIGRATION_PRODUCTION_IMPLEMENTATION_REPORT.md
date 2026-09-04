# PHASE 3 — UI-C1.2D — BOOKINGS REGISTRY MIGRATION
## PRODUCTION IMPLEMENTATION REPORT

---

## 1. Executive Summary

`/app/bookings` has been migrated to the canonical Operations Center registry grammar with the **Requests KPI-interaction contract** as the binding reference (P0, §2). The flat single-grid Booking status board is replaced by **truthful semantic groups** (two happy-path lifecycle flows with connectors, AWAITING_CONFIRMATION on its own with **no false incoming arrow**, operational statuses, terminal outcomes), a Total «Всего бронирований» card bound to the **server overview total**, canonical toolbar grammar (Search → Status → From/To → Reset → CSV → XLSX), full URL-state sync (search/status/dates/page), locale-aware dates and single-source `booking.status.*` labels.

The **KPI-collapse root cause is fixed server-side** (§3/§10): `booking.service.ts` no longer computes the 13 KPI counts over the same filtered `where` as the table. A booking-specific `overviewBookingWhere(...)` helper (analogous to accepted Orders R1) keeps every global registry scope dimension (search, channel, date range, detector temporal predicates) while excluding exactly the BookingStatus KPI dimension. Clicking «Подтверждено» → table = CONFIRMED, and all 13 cards + Total remain **byte-identical** (browser-verified with real values: Total 365 · Подтверждено 82 · В обслуживании 67 · Завершено 213 …).

`upcoming`/`overdue` detectors are treated as **global detector scopes**, not KPI selections: their temporal predicates (`serviceDate >= now` / `createdAt < now−SLA`) scope both overview and table; their status predicates compose with any KPI-card selection in the table layer only. Detector deep links (`?upcomingOnly=true`, `?overdueOnly=true`) render the detector-scoped table with 13 stable cards and never collapse. D6 (server state-machine authority) and D7 (finance derived from linked Order) are untouched; Requests and Orders are byte-unchanged.

**VERDICT A — accepted** (§36).

---

## 2. Accepted Baseline

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — ACCEPTED
UI-C1.2A — ACCEPTED
UI-C1.2B — ACCEPTED
UI-C1.2C — ACCEPTED AFTER REMEDIATION R1

BASELINE SHA: 3b12d16def817bf4c91124d3ff14adf692d7aa6c
```

Implementation branch starts from `435cdc5…` (`HEAD == origin/master` at start, porcelain empty apart from the untracked prompt file).

---

## 3. Current Bookings Audit

### Backend (audited before changes)

| Item | Finding |
|---|---|
| `BookingStatus` Prisma enum | Exactly 13 canonical values (schema `booking` multi-schema): NEW, PREPARING_REQUEST, SENT_TO_SUPPLIER, AWAITING_CONFIRMATION, CONFIRMED, IN_SERVICE, COMPLETED, NEEDS_CLARIFICATION, SUPPLIER_REJECTED, CHANGE_REQUESTED, CANCELLATION_REQUESTED, CANCELLED, PROBLEM. `PARTIALLY_CONFIRMED` does not exist. |
| `booking.service.ts listBookings` | Single `where` reused for `findMany` + `count` + `groupBy(by:['status'])` → **KPI-collapse root cause** (click CONFIRMED → `where.status` → other aggregates zero). Detector `upcoming`/`overdue` **overwrote** `where.status` (silent KPI-status loss) and the From/To date window **overwrote** the overdue detector `createdAt` cutoff. |
| `upcoming=true` detector | `status IN (CONFIRMED,NEW)` + `serviceDate >= now` |
| `overdue=true` detector | `status = AWAITING_CONFIRMATION` + `createdAt < now − slaMinutes` (default 240) |
| Channel scope | Order `acquisitionSource` default MARKETPLACE → `orderId IN channelOrderIds`; explicit `orderId` intersected via `where.AND`. |
| Date filter | `createdAt` `[from, to)` on the same field as the detector cutoff. |
| Export | `GET /bookings/export` CSV/XLSX, server-side filters incl. status/date/search, channel-authoritative, `sellerPartnerId` scope; unchanged. |
| Controller/DTO | `status/orderId/search/acquisitionSource/upcoming/overdue/slaMinutes/sortBy/sortDirection/dateFrom/dateTo/page/pageSize`; unchanged. |

### Frontend (audited before changes)

`/app/bookings` already consumed the shared OperationsCenterShell (active domain, toolbar/registry slots) with a flat 13-card grid, a Total card bound to `data.total` (**table-filtered pagination total — prohibited**), locale dates hardcoded `ru-RU`, hardcoded «Статусы бронирований» section header, dates **not** URL-synced, no Reset, no canonical group headings, and no semantic grouping. The label helper already resolved `booking.status.*` (canonical source shared with `StatusBadge`).

### Scope notes (before → after)

| Aspect | Before | After |
|---|---|---|
| KPI aggregate scope | table `where` (collapse on card click) | overview scope = table `where` minus BookingStatus dimension |
| Total card value | `data.total` (table/pagination scope) | `aggregates.lifecycle.total` (overview scope) |
| Table pagination total | `data.total` | unchanged (`data.total`, table scope) |
| Semantic grouping | one flat grid | 2 lifecycle flows + awaiting + operational + terminal groups |
| AWAITING_CONFIRMATION | flat card | visible card, own group, no connector |
| Detector status vs KPI status | overwrote each other | composed via AND in table scope; overview keeps detector temporal scope only |
| Date window vs overdue cutoff | overwrote | merged into one `createdAt` filter (AND semantics) |
| URL state | status/search/sort only | + dateFrom/dateTo/page (+ Reset) |
| Detector columns | conditional on `upcomingOnly`/`overdueOnly` | preserved |

---

## 4. Booking State Machine Verification

Verified against the D6 authority in `booking.service.ts` (`TRANSITIONS` + `ACTIVE`):

```text
prepare:                NEW → PREPARING_REQUEST
send:                   NEW / PREPARING_REQUEST → SENT_TO_SUPPLIER
requestClarification:   SENT_TO_SUPPLIER / AWAITING_CONFIRMATION → NEEDS_CLARIFICATION
resume:                 NEEDS_CLARIFICATION → SENT_TO_SUPPLIER
confirm:                SENT_TO_SUPPLIER / AWAITING_CONFIRMATION → CONFIRMED
reject:                 SENT_TO_SUPPLIER / AWAITING_CONFIRMATION → SUPPLIER_REJECTED
service:                CONFIRMED → IN_SERVICE
requestChange:          CONFIRMED / IN_SERVICE → CHANGE_REQUESTED
resolveChange:          CHANGE_REQUESTED → CONFIRMED
requestCancellation:    CONFIRMED / IN_SERVICE / CHANGE_REQUESTED / NEEDS_CLARIFICATION → CANCELLATION_REQUESTED
complete:               IN_SERVICE → COMPLETED
cancel:                 ACTIVE → CANCELLED
problem:                ACTIVE except PROBLEM → PROBLEM
```

UI-C1.2D renders no connector that is not a real audited transition:

- Flow 1 `NEW → PREPARING_REQUEST → SENT_TO_SUPPLIER` — `prepare`, `send` real. ✓
- Flow 2 `CONFIRMED → IN_SERVICE → COMPLETED` — `service`, `complete` real. ✓
- No connector ever targets AWAITING_CONFIRMATION, NEEDS_CLARIFICATION, SUPPLIER_REJECTED, CHANGE_REQUESTED, CANCELLATION_REQUESTED, CANCELLED or PROBLEM. ✓
- The table + export keep server authority: no PATCH path, no `availableActions` duplicated on the registry. ✓

---

## 5. 13/13 Status Coverage

Every canonical `BookingStatus` renders one visible `CommerceKpiCard`; nothing is filter-only, nothing is invented (`PARTIALLY_CONFIRMED` absent — asserted in tests). Full matrix in §30.

---

## 6. AWAITING_CONFIRMATION Special Case

`AWAITING_CONFIRMATION` is a real canonical enum value and is rendered as a visible, clickable, localized card in its own «Ожидание подтверждения» group. The state-machine audit shows **no current producer** into it (same class of status as Order `READY_TO_CLOSE`). Per §8 it is **not** removed and **no producer is fabricated**; it receives **no incoming connector/arrow** (asserted in frontend spec and in the browser: the AWAITING group section contains zero `aria-hidden` connectors).

---

## 7. Target Registry Composition

```text
ЦЕНТР ОПЕРАЦИЙ
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]          ← shell, Bookings active

[ Всего бронирований ]                                      ← Total, overview total, ~15–20% larger

ОСНОВНОЙ ПРОЦЕСС                                            ← Flow 1: NEW → PREPARING_REQUEST → SENT_TO_SUPPLIER
ОСНОВНОЙ ПРОЦЕСС                                            ← Flow 2: CONFIRMED → IN_SERVICE → COMPLETED
ОЖИДАНИЕ ПОДТВЕРЖДЕНИЯ                                      ← AWAITING_CONFIRMATION (visible, no arrow)
ОПЕРАЦИОННЫЕ СТАТУСЫ                                        ← NEEDS_CLARIFICATION · CHANGE_REQUESTED · CANCELLATION_REQUESTED · PROBLEM
КОНЕЧНЫЕ ИСХОДЫ                                             ← SUPPLIER_REJECTED · CANCELLED

[ Search ] [ Status ] [ From ] [ To ] [ Reset ] [ CSV ] [ XLSX ]

TABLE (Booking business columns) + PAGINATION
```

Semantic KPI rows wrap 2-up (mobile) → full width at xl for the flow rows; grids for the group sections follow the shared registry grid grammar. Total is `w-fit max-w-full` (never full-width hero).

---

## 8. KPI Semantic Grouping

| Group | Statuses | Connectors | Rationale (state machine) |
|---|---|---|---|
| Основной процесс (Flow 1) | NEW, PREPARING_REQUEST, SENT_TO_SUPPLIER | 2 (`prepare`, `send`) | request/preparation phase chain |
| Основной процесс (Flow 2) | CONFIRMED, IN_SERVICE, COMPLETED | 2 (`service`, `complete`) | service/fulfillment phase chain |
| Ожидание подтверждения | AWAITING_CONFIRMATION | 0 | no producer → visible, no false arrow (§8) |
| Операционные статусы | NEEDS_CLARIFICATION, CHANGE_REQUESTED, CANCELLATION_REQUESTED, PROBLEM | 0 | recoverable operational markers, no linear path |
| Конечные исходы | SUPPLIER_REJECTED, CANCELLED | 0 | terminal exception outcomes |

Partition is total: 3 + 3 + 1 + 4 + 2 = 13.

---

## 9. Requests Behavioral Reference

Requests interaction contract implemented verbatim:

```text
KPI CARDS = STABLE OVERVIEW

CLICK ONE BOOKING KPI CARD
        ↓
that card becomes SELECTED (aria-pressed)
        ↓
filters TABLE ONLY (?status=…)

ALL OTHER 12 KPI CARDS
→ retain overview counts (server aggregates, overview scope)
→ do not zero / disappear / re-scope / get recomputed from filtered rows
```

Total click → clears `status`, returns to default, table back to KPI-unfiltered scope, overview counts stable.

---

## 10. Root Cause of KPI Collapse

Before: `booking.service.ts` `groupBy({ by: ['status'], where })` used the **same `where` as `findMany`/`count`**, so a KPI-card `status` filter collapsed every other aggregate to 0. Two secondary defects compounded it: detector `status` predicates overwrote the KPI status (and vice-versa), and the From/To date window overwrote the overdue detector's `createdAt` cutoff. All three are removed by the scope split (§11) and the compositional detector rewrite (§12).

---

## 11. Overview Scope vs Table Scope

New helper `booking-kpi-scope.ts` — `overviewBookingWhere(tableWhere)` drops exactly the BookingStatus dimension (top-level `status` **and** status predicates nested in `AND`) and retains all global dimensions. In `listBookings`:

- **Global scope** (search IDs, `serviceDate`/`createdAt` detector temporal predicates, date window, channel/orderId) is built once.
- **Table scope** = global scope + status layer (explicit KPI status AND-composed with detector status predicates).
- **Overview scope** = `overviewBookingWhere(tableWhere)` → 13 status counts + `count` → `aggregates.lifecycle` (incl. `total = overview total`).
- Table `items` + pagination `total` stay table-scoped; response shape unchanged (single `/bookings` request).

Empty-channel / denied-storefront early returns now carry `aggregates: { lifecycle: { total: 0 } }` (response-shape consistent).

---

## 12. Detector Semantics — upcoming/overdue

Treat `upcoming`/`overdue` as **global registry scope / detector predicates**, not KPI selections:

- **Upcoming**: temporal predicate `serviceDate >= now` → **overview AND table**; status predicate `status IN (CONFIRMED, NEW)` → **table only** (composed with any clicked KPI status via AND).
- **Overdue**: temporal predicate `createdAt < now − SLA` → **overview AND table**; status predicate `status = AWAITING_CONFIRMATION` → **table only**.
- The From/To window and the overdue cutoff now **merge into one `createdAt` filter** (Prisma field-level AND) — the detector cutoff is no longer silently deleted by a date range.
- KPI-card selection never removes the detector scope (`?upcomingOnly=true&status=CONFIRMED` browser-verified: detector URL flag retained, table CONFIRMED-scoped, overview stable).
- The detector overview therefore reflects the detector's **temporal scope** across all statuses (13 cards stable), while the initial table shows the detector's status target — a KPI click narrows the table further. This is the §15/§26 contract: detector semantics preserved, only the explicit status dimension is excluded from the overview.

---

## 13. Backend/API Changes

| File | Change |
|---|---|
| `backend/src/modules/booking/booking-kpi-scope.ts` | **new** — pure `overviewBookingWhere(...)` helper (status-dimension strip, AND-aware) |
| `backend/src/modules/booking/booking-kpi-scope.spec.ts` | **new** — 8 unit tests (§26/§27) |
| `backend/src/modules/booking/booking.service.ts` | `listBookings` rewrite: status layer separated from global scope; aggregates computed over `overviewBookingWhere`; `total` = overview total; detector temporal predicates preserved in the overview; date window + overdue cutoff merged; empty/denied early returns shape-consistent |

**API contract unchanged**: one `GET /bookings` list endpoint; `aggregates.lifecycle` per-status counts + `total` (now overview semantics); `items`/`total` table semantics. No new endpoint, no removed param. Requests/Orders services untouched.

---

## 14. Frontend Changes

| File | Change |
|---|---|
| `frontend/app/app/bookings/page.tsx` | Rewritten: Total → overview total; FlowRow connector primitive; 5 semantic sections (2 lifecycle flows + awaiting + operational + terminal); canonical toolbar (Search → Status → From/To → Reset → CSV/XLSX); URL state `search/status/dateFrom/dateTo/page` (+ sortBy/sortDirection, detector params preserved); locale-aware dates/money via `LOCALE_TAGS`; StatusBadge `label` override on the shared `booking.status.*` source; detector-scoped columns preserved |
| `frontend/lib/i18n.tsx` | **new keys** `bookings.group.lifecycle/awaiting/decisions/terminal` (RU/AZ/EN); all 13 status labels already canonical under `booking.status.*` |
| `frontend/lib/bookings-registry.spec.tsx` | **new** — 48 focused tests (§30/§31/§32/§26/§27/§28/§29/§41 + shell/URL/toolbar/locale gates) |

No shared component was modified (CommerceKpiCard, StatusBadge `label` passthrough, TableExportButton, OperationsCenterShell unchanged — preserving C1.2A/C1.2B/C1.2C pins).

---

## 15. Total KPI

- Label: `admin.kpi.total_bookings` = «Всего бронирований» / «Cəmi bronlar» / «Total bookings» (never «Все бронирования»).
- Value: `aggregates.lifecycle.total` — the **overview** total, stable across KPI-card clicks (browser: 365 before/after CONFIRMED, PROBLEM, AWAITING_CONFIRMATION, and after Total reset).
- Visual: `variant="total"` (label `text-sm` / value `text-[21px]`, `px-5 py-4`) in a `w-fit max-w-full` wrapper — ~15–20% larger than ordinary cards, never full-width.

---

## 16. Selected State

- Selected KPI communicates via the shared `aria-pressed` pattern (CommerceKpiCard button) — Total default-pressed; exactly **one** status card selected at a time (clicking CONFIRMED then PROBLEM deselects CONFIRMED — browser-verified).
- Mouse click and keyboard activation work (real `<button>`), focus-visible preserved by the card component.

---

## 17. URL / History

- Canonical params on `/app/bookings`: `status`, `search`, `dateFrom`, `dateTo`, `page`, `sortBy`, `sortDirection`; preserved detector params `upcomingOnly`/`upcoming`, `overdueOnly`/`overdue`, `slaMinutes`.
- Single writer (`updateUrl`, `replaceState`, ADR-OPS-012): card click → `?status=CONFIRMED` + page→1; Total → status removed; search (350 ms debounce) / dates / pagination write the URL.
- Browser-verified: reload restores selection; browser Back from `/app/orders` restores `/app/bookings?status=CONFIRMED` **with the CONFIRMED card selected**; Reset normalizes the URL (detectors retained).

---

## 18. Search / Filter / Period Semantics

- Search first in the toolbar (server-side, debounced 350 ms, resolves booking code/reference, passenger name, order number → ID set — global scope).
- Status select = the 13 canonical statuses (KPI/filter single source) — table scope.
- From/To exposed because `/bookings` filters `createdAt` `[from, to)` server-side and the overview aggregates share that same global temporal scope (period change → overview refresh + table refresh; then a KPI click scopes the table within the period, overview = full-period overview). Backend composes the window with the overdue detector cutoff instead of overwriting it.
- No invented filters; `orderId` remains supported server-side for the Order detail drill-down and is not UI-exposed on the registry toolbar.

---

## 19. Localization RU/AZ/EN

- All 13 status labels: canonical `booking.status.*` keys — one source for KPI cards, filter dropdown, and table badges (StatusBadge `label` override). Spec asserts exact RU strings and RU/AZ/EN resolution for every status.
- Group headings: new `bookings.group.*` keys RU/AZ/EN (spec asserts resolution + no raw key leakage in DOM).
- Total: `admin.kpi.total_bookings` RU/AZ/EN.
- Dates/money formatted via `LOCALE_TAGS[locale]` (no `ru-RU` hardcodes); browser renders RU/AZ/EN with no raw i18n keys.

---

## 20. Table / Pagination / Export

- Shared Operations Center table grammar preserved (fixed-layout table, sortable headers, status badges, reference links, hover, empty/error/loading primitives, pagination) with Booking-specific business columns (reference, created, order reference, amount, passengers, status + detector columns serviceDate / waiting under upcoming/overdue).
- Pagination `total` = table scope (rows under the active KPI filter).
- Export (`/api/v1/bookings/export` CSV/XLSX) unchanged, server-side table-filter semantics; the active KPI status/date/search follow the current table contract via `extraParams`; export data is never derived from client-visible rows.

---

## 21. D6 Preservation

Booking PATCH authority untouched (`booking.service.ts` guards/CAS/events unchanged; only `listBookings` read-model changed). The registry contains no action buttons, no client-side transition logic, no `availableActions` duplication. Detail-page `api.patch('/bookings/{id}', {action})` flow untouched (commerce-detail spec pins green).

## 22. D7 Preservation

No Booking financial calculation introduced. `amount`/`currency` render as server strings formatted for locale (display-only). No due/refund recomputation. Finance detail authority unchanged.

## 23. Security Preservation

- `listBookings` channel scope (Order `acquisitionSource` default MARKETPLACE, explicit `PARTNER_STOREFRONT` deny → empty) preserved; the refactor keeps the `orderId ⊆ channel` intersection for the Order drill-down.
- RBAC/`booking.read` unchanged; server-side workspace isolation unchanged; no client-trusted partner/tenant IDs introduced; client-hidden elements remain non-authoritative by design.

## 24. Requests Regression

Requests page/spec/service byte-unchanged (`git diff` empty for requests files). Requests stays the behavioral reference; full requests registry tests (51) + request-center (56) green.

## 25. Orders Regression

Orders page/spec/service byte-unchanged (Orders R1 scope behavior intact). Orders registry tests (54) green.

---

## 26. Focused Tests

Frontend `lib/bookings-registry.spec.tsx` — **48/48** mapping the prompt gates:

- 13/13 status enumeration, partition 3+3+1+4+2, no invented status (`PARTIALLY_CONFIRMED` absent), cards rendered via CommerceKpiCard, filter dropdown covers 13, no raw enums.
- No false transitions: non-flow statuses outside flows; connectors only in the two flows; AWAITING group section has no connector/aria-hidden; AWAITING not in flow arrays.
- Total canonical label/variant/not-full-width/overview-total; pagination uses table total; Total click clears.
- Single label source: `booking.status.*` RU/AZ/EN assertions + exact RU binding for all 13; group keys RU/AZ/EN.
- KPI interaction: `applyStatus` writes URL/page→1, one-card `aria-pressed`, cards are buttons, connectors aria-hidden.
- Server authority: one `/bookings` list call; no `/bookings/kpi`; no `.filter/.reduce`; counts from `aggregates.lifecycle`; status/date params on the same query; detector params sent verbatim.
- Toolbar order; detector deep links read from URL; serviceDate/waiting columns conditional.
- URL state writes/reads; Reset; locale cells; export filters; D6/D7 non-duplication; shell markers preserved.

Backend `booking-kpi-scope.spec.ts` — **8/8** (§26 helper contract: top-level status dropped, multi-value dropped, AND-nested status dropped while channel AND clauses survive, detector temporal predicates retained in overview, no mutation, no-KPI → identical).

## 27. Detector Scope Tests

Browser (real server, real aggregates): `?upcomingOnly=true` renders 13 cards; clicking «Подтверждено» keeps the upcoming **overview byte-identical** and retains `upcomingOnly=true&status=CONFIRMED` in the URL (detector scope never removed by KPI selection). `?overdueOnly=true` renders 13 stable cards. Backend unit tests prove the helper keeps `serviceDate`/`createdAt` detector predicates in the overview while dropping only the status predicate.

## 28. AWAITING_CONFIRMATION Test

Spec: card visible + localized (exact «Ожидает подтверждения») + clickable + no connector in its section + excluded from flow arrays. Browser: AWAITING card present and labeled; click → `?status=AWAITING_CONFIRMATION` with the card selected and all 13 counts unchanged.

---

## 29. 13/13 Coverage Matrix

| BookingStatus | Visible KPI | Semantic group | Localized RU label | Filter param | Server count source |
|---|---:|---|---|---|---|
| NEW | YES | Основной процесс (Flow 1) | Новое | `status=NEW` | server (overview) |
| PREPARING_REQUEST | YES | Основной процесс (Flow 1) | Подготовка заявки | `status=PREPARING_REQUEST` | server (overview) |
| SENT_TO_SUPPLIER | YES | Основной процесс (Flow 1) | Отправлен поставщику | `status=SENT_TO_SUPPLIER` | server (overview) |
| AWAITING_CONFIRMATION | YES | Ожидание подтверждения | Ожидает подтверждения | `status=AWAITING_CONFIRMATION` | server (overview) |
| CONFIRMED | YES | Основной процесс (Flow 2) | Подтверждено | `status=CONFIRMED` | server (overview) |
| IN_SERVICE | YES | Основной процесс (Flow 2) | В обслуживании | `status=IN_SERVICE` | server (overview) |
| COMPLETED | YES | Основной процесс (Flow 2) | Завершено | `status=COMPLETED` | server (overview) |
| NEEDS_CLARIFICATION | YES | Операционные статусы | Требует уточнения | `status=NEEDS_CLARIFICATION` | server (overview) |
| SUPPLIER_REJECTED | YES | Конечные исходы | Отклонено поставщиком | `status=SUPPLIER_REJECTED` | server (overview) |
| CHANGE_REQUESTED | YES | Операционные статусы | Запрос на изменение | `status=CHANGE_REQUESTED` | server (overview) |
| CANCELLATION_REQUESTED | YES | Операционные статусы | Запрос на отмену | `status=CANCELLATION_REQUESTED` | server (overview) |
| CANCELLED | YES | Конечные исходы | Отменено | `status=CANCELLED` | server (overview) |
| PROBLEM | YES | Операционные статусы | Проблема | `status=PROBLEM` | server (overview) |

13/13 visible · 0 filter-only · 0 invented · `PARTIALLY_CONFIRMED` not introduced.

---

## 30. KPI Stability Evidence Matrix

Real server aggregates captured in the browser (docs/evidence/c12d/c12d_browser_results.json + screenshots):

Baseline: **Total 365** · Новое 1 · Подготовка заявки 0 · Отправлен поставщику 0 · Подтверждено 82 · В обслуживании 67 · Завершено 213 · Ожидает подтверждения 0 · Требует уточнения 0 · Запрос на изменение 0 · Запрос на отмену 0 · Проблема 0 · Отклонено поставщиком 0 · Отменено 2.

| Scenario | Selected KPI | Table filter | Other 12 KPI counts | Total | Result |
|---|---|---|---|---|---|
| Initial | Total (default) | none | baseline | 365 (overview) | PASS |
| click CONFIRMED | Подтверждено | `?status=CONFIRMED` (82 rows, 20/page) | **byte-identical** | 365 | PASS |
| switch to PROBLEM | Проблема | `?status=PROBLEM` (0 rows → empty state) | **byte-identical** | 365 | PASS |
| click AWAITING_CONFIRMATION | Ожидает подтверждения | `?status=AWAITING_CONFIRMATION` | **byte-identical** | 365 | PASS |
| click Total | Total (default) | none (status removed) | **byte-identical** | 365 | PASS |
| upcomingOnly + CONFIRMED | Подтверждено | `upcomingOnly=true&status=CONFIRMED` | **byte-identical** (upcoming overview) | unchanged | PASS |

No collapse, no zeroing, no re-scope — 45/45 browser checks.

---

## 31. Query-Scope Matrix

| Dimension | Overview KPI scope | Table scope | KPI click re-scopes overview? |
|---|---:|---:|---:|
| Workspace/Tenant (channel `acquisitionSource`) | YES | YES | N/A |
| Search | YES | YES | NO |
| Date/Period (`createdAt` From/To) | YES | YES | NO |
| orderId (drill-down) | YES | YES | NO |
| upcoming detector (temporal `serviceDate >= now`) | YES | YES | NO |
| overdue detector (temporal `createdAt < now−SLA`) | YES | YES | NO |
| Booking KPI selection (`status`) | **EXCLUDED** | **INCLUDED** | NO |

P0 acceptance met: `status` is excluded from the overview KPI scope and included in the table scope; detectors keep their temporal scope in the overview while their status predicate stays table-only (proven by backend unit tests + browser).

---

## 32. Browser Qualification

Live browser (chromium, Playwright), admin session, at 1680/768/390:

- Shell/tabs: title «Центр операций», Bookings tab active. PASS
- Total size/label: «Всего бронирований», default `aria-pressed`. PASS
- 13/13 KPI cards visible; 13 exact canonical RU labels, none invented; no raw enums. PASS
- Semantic grouping: 5 group headings («Основной процесс» ×2, «Ожидание подтверждения», «Операционные статусы», «Конечные исходы»). PASS
- No false AWAITING arrow: AWAITING section contains zero connectors. PASS
- Connectors: exactly 4 (2 per truthful flow). PASS
- Selected state / one active card; table changes under server scope; all other KPI values stable; Total reset; URL/reload/Back-Forward; search; upcoming/overdue deep links; RU/AZ/EN; responsive zero overflow. PASS (full list in evidence JSON)

Evidence: `docs/evidence/c12d/` — desktop/1680/768/390 screenshots, CONFIRMED-selected, overdue detector, side-by-side BEFORE (C1.2A) vs AFTER, results JSON.

## 33. Responsive Qualification

At 390/768/1680: horizontal overflow = 0 px in all three; all 13 status cards remain visible and clickable; flow rows wrap (2-up mobile → single xl row with connectors at ≥1280); grids follow the shared 2→N registry grammar.

## 34. Regression

| Suite | Result |
|---|---|
| frontend typecheck (`tsc --noEmit`) | PASS |
| frontend `next build` | PASS |
| bookings-registry focused (new) | 48/48 |
| operations-center shell | 19/19 |
| commerce detail-system | 44/44 |
| requests-registry | 51/51 |
| orders-registry (+R1 contract) | 54/54 |
| request-center | 56/56 |
| frontend full suite | **566 passed**, 1 failed — `formatPrice` NBSP (documented pre-existing baseline, unchanged) |
| backend typecheck | PASS |
| backend build (`tsc -p tsconfig.build.json`) | PASS (dist rebuilt + backend restarted) |
| booking-kpi-scope (new) | 8/8 |
| commerce-chain.invariants | 26 passed / 2 failed — pre-existing seed-identifier drift (`MKT-ORD-D5FIX-0001`, 7-digit `SF0000001` commerceSequence), untouched by this diff |

Requests and Orders modules: `git diff` empty. Pre-existing failures documented and proven unchanged.

## 35. Git Hard Closure

```bash
git status --porcelain=v1   # → empty (final)
git rev-parse HEAD          # → 8aa37739499aa2978c89219666e23ff13b2de4c8
git rev-parse origin/master # → 8aa37739499aa2978c89219666e23ff13b2de4c8
```

Baseline `3b12d16…` remains traceable as the accepted UI-C1.2C (R1) baseline, distinct from the new UI-C1.2D final SHA.

## 36. Final Verdict

```text
VERDICT A — UI-C1.2D
BOOKINGS REGISTRY MIGRATION — ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — ACCEPTED
UI-C1.2A — ACCEPTED
UI-C1.2B — ACCEPTED
UI-C1.2C — ACCEPTED AFTER REMEDIATION R1
UI-C1.2D — ACCEPTED

FINAL SHA: 8aa37739499aa2978c89219666e23ff13b2de4c8

BOOKING STATUS KPI COVERAGE — 13/13 PASS
REQUESTS KPI BEHAVIOR PARITY — PASS
BOOKINGS KPI SELECTED STATE — PASS
BOOKINGS TABLE-ONLY KPI FILTERING — PASS
BOOKINGS KPI COUNT STABILITY — PASS
TOTAL RESET — PASS
UPCOMING DETECTOR SCOPE — PASS
OVERDUE DETECTOR SCOPE — PASS
AWAITING_CONFIRMATION VISIBILITY — PASS
NO FALSE AWAITING_CONFIRMATION TRANSITION — PASS
URL / HISTORY — PASS
SERVER-AUTHORITATIVE OVERVIEW — PASS
NO CLIENT-SIDE KPI FABRICATION — PASS
D6 PRESERVATION — PASS
D7 PRESERVATION — PASS
SECURITY PRESERVATION — PASS

REFERENCE-MATCH CARD DESIGN — DEFERRED

UI-C1.2E — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

## 37. TRUE NEXT

```text
UI-C1.2E — PAYMENTS BACKEND / READ-MODEL PREREQUISITES
```

Out of scope per §36 of the prompt and not started: payments backend/read-model, payments registry, currency/refund KPI groups, Help full implementation, Commerce Relation Chain, D8 Global Temporal Visibility, reference-image card geometry matching, pricing redesign, Booking detail redesign.
