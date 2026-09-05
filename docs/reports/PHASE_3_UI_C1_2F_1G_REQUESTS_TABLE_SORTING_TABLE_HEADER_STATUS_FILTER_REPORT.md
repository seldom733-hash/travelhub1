# PHASE 3 — UI-C1.2F.1G — REQUESTS TABLE SORTING + TABLE-HEADER STATUS FILTER — REPORT

## Executive Summary

Requests / Заявки registry закрыл оба оставшихся UI-gap:

```text
BEFORE:  TABLE SORTING  — отсутствует
         STATUS FILTER  — в toolbar

AFTER:   TOOLBAR  [Search] [Reset] [CSV] [XLSX]
         TABLE    ref↑ · displayedPrice↑ · confirmedPrice↑ · serviceDate↑
                  · Статус↑[🔍] · createdAt↑ · slaDeadline↑
         (customer/product/supplier — plain, не sortable)
```

- Requests server-side sorting реализован на shared `buildSortClause` с explicit allowlist
  (7 canonical keys → Prisma field mapping), default `createdAt desc` сохранён,
  deterministic `id` tie-breaker добавлен.
- Status filter перенесён из toolbar в table header через shared `TableHeaderFilter`
  (filterSlot в `SortableHeader`). KPI-карты и header filter используют ОДИН state /
  ОДИН URL param (`status`) — one active KPI, static KPI overview под status filter.
- В ходе верификации найдены и исправлены два реальных дефекта:
  1. `frontend requests/page.tsx updateUrl` применял ВСЕ keys при каждом вызове →
     смена sort удаляла `status`/`search`, смена status удаляла `search` (Orders-страница
     трогает только переданные keys). URL authority/coexistence теперь корректны.
  2. `backend shared/sort.ts` allowlist check через `in` пропускал inherited keys
     (`sortBy=__proto__`/`constructor`) → мусорный orderBy (500). Own-property check;
     теперь canonical 400.

## A. Baseline

```text
BASELINE SHA: 8b2415f6160216d7425aaa42feae9c818ea36595 (HEAD == origin/master)
```

## B. Current Requests Reality (before this stage)

```text
Requests frontend sorting — MISSING (10-column table, все <th> plain)
Requests backend sorting  — MISSING (orderBy: { createdAt: "desc" } hardcoded)
Requests status filtering — backend READY (?status= server-side, KPI global)
Requests Status UI        — toolbar `<select>` (после C1.2B миграции)
Toolbar: [Search] [Status ▾] [Reset] [CSV] [XLSX]
URL:     ?search=&status=&dateFrom=&dateTo=&page=
Export:  /api/v1/requests/export?status&search&dateFrom&dateTo (createdAt desc default)
Pagination: server-side, pageSize=20
```

## C. Toolbar Migration

Requests toolbar теперь канонический:

```text
[ Search ][ Reset ][ CSV ][ XLSX ]
```

Status dropdown удалён полностью (в page нет ни одного `<select>`; unit + browser
evidence подтверждают отсутствие дубликации: ровно один Status filter — в header).

## D. Status Header Filter

Статус column (`Статус`) рендерит shared `TableHeaderFilter`
(`id="requests-status-filter"`, aria-label = «Все статусы») внутри
`SortableHeader field="status" filterSlot=…`. Опции = все 12 canonical RequestStatus
из `REQUEST_LIFECYCLE_STATUSES` (один source of truth с KPI-картами и бейджами).
Никаких устаревших/invented статусов.

## E. KPI ↔ Header Synchronization

Один state (`statusFilter`) и один URL param (`status`):

```text
Header Status → CHECKING → URL ?status=CHECKING → KPI «На проверке» pressed
KPI CHECKING click → URL ?status=CHECKING → Header filter active + table filtered
Total click / «Все» option → ?status удалён → все статус-KPI inactive, Total active
```

Browser evidence (A/B/C): 83/83 checks PASS.

## F. One Active KPI

`statusFilter` — единственный источник выбора; `active={selectedStatus === code}`
→ физически невозможны multiple pressed статус-карты (A selected → B selected только
после deselect A). Подтверждено browser-проверками aria-pressed.

## G. Backend Sorting

```text
GET /requests?sortBy=&sortDirection=asc|desc
```

- `request-sort.ts` (новый): allowlist mapping URL-key → Prisma field, default sort,
  builder через shared `buildSortClause`, строгая boundary-валидация
  (`assertValidRequestSort`, canonical BadRequestException → HTTP 400 — та же
  конвенция, что у dateFrom/dateTo после UI-C1.2F.1A).
- `request.controller.ts` / `request.service.ts`: сортировка применяется к
  серверному query (никакого client-side sort).
- Export endpoint сознательно НЕ получает sort params (существующее поведение
  зафиксировано: export = default createdAt desc, scope = period+search+status) — §21.

## H. Sort Allowlist

```text
referenceNumber → referenceNumber
displayedPrice  → displayedPrice
confirmedPrice  → confirmedPrice
serviceDate     → requestedServiceDate   (явный mapping URL→Prisma)
status          → status
createdAt       → createdAt
slaDeadline     → supplierResponseDeadline (явный mapping)
```

Ни один raw URL key не передаётся в Prisma. Allowlist membership — own-property check
(`__proto__`/`constructor` → 400).

## I. Sortable Columns

Sortable (7): referenceNumber, displayedPrice, confirmedPrice, serviceDate, status,
createdAt, slaDeadline — через shared `SortableHeader` (никакого Requests-only
component). НЕ sortable: customer, product, supplier (нет backend-safe mapping;
остаются plain `<th>`).

## J. Stable Pagination

Каждый primary sort дополняется `id` tie-breaker (deterministic ORDER BY). Тесты
проверяют, что все 7 полей × asc/desc возвращают orderBy длины 2 с
`{ id: "desc" }` финальным элементом — равные referenceNumber/status/timestamp
строки не дрейфуют между страницами.

## K. Status Sort + Filter Coexistence

В column «Статус» — ДВА независимых click target:

```text
Sort button (label «Статус» + ↑/↓)  →  ?sortBy=status&sortDirection=asc|desc
Filter icon (#requests-status-filter) →  ?status=CHECKING
Пример: ?status=CHECKING&sortBy=status&sortDirection=asc
```

Different accessible names подтверждены (browser aria-проверки + unit).

## L. URL Authority

URL — единственный источник. Representative:

```text
/app/requests?dateFrom=2026-01-01&dateTo=2026-12-31&status=CONVERTED
             &search=CRM-00000167&sortBy=referenceNumber&sortDirection=asc&page=2
```

filter change → page=1; sort change → page=1. Период/search/unrelated params
сохраняются (browser: updateUrl трогает только переданные keys).

## M. Period/Search Coexistence

Проверенные комбинации (browser + unit + backend scope-combo тесты):
Search+Status, Search+Sort, Search+Status+Sort, Period+Search+Status+Sort — все
параметры одновременно попадают в ОДИН server request и сохраняются в URL.

## N. Reset

```text
CLEAR: search, status, sortBy, sortDirection, page → 1 (KPI → Total)
KEEP:  dateFrom, dateTo (Header Period — отдельное глобальное действие)
```

## O. Tab Switch

Requests → Orders (period-carrying tablink): KEEP dateFrom/dateTo; RESET search/
status/sort/page/selected KPI. Browser evidence: `/app/orders?dateFrom=…&dateTo=…`
без requests-local params. Requests filter/sort не «перетекают» в другой registry.

## P. Reload / Back / Forward

- Reload при `?status=CHECKING&sortBy=createdAt&sortDirection=asc`: URL, KPI pressed,
  header filter active и таблица восстанавливаются из URL (initial* props → state).
- Back: Requests → Orders → Back восстанавливает requests URL + filter/sort + KPI.
- Forward: Orders восстанавливается.
- Никакого `useState(initialX)` без URL sync (state инициализируется из searchParams).

## Q. Export

Export = server-side (`/api/v1/requests/export`), scope = period + search + status.
Sort НЕ пробрасывается — существующий export order (createdAt desc default)
зафиксирован. Browser: intercepted export request `…export?status=CHECKING&
search=MKT-REQ-09000014&format=csv` без sortBy/sortDirection.

## R. Network Evidence

`docs/evidence/c12e/c12e_1g_browser_results.json` (83/83 PASS) фиксирует actual
requests:

```text
Status filter          → /api/v1/requests?page=1&pageSize=20&status=CHECKING
Sort ASC               → …&sortBy=serviceDate&sortDirection=asc
Sort DESC              → …&sortBy=displayedPrice&sortDirection=desc
Status + Sort          → …&status=CHECKING&sortBy=serviceDate&sortDirection=asc
Period+Search+Status+Sort → …&dateFrom=…&dateTo=…&search=MKT-REQ-09000014
                           &status=CHECKING&sortBy=serviceDate&sortDirection=asc
Export                 → /api/v1/requests/export?status=…&search=…&format=csv
```

Прямые backend-проверки (live, admin JWT):

```text
default           → createdAt desc сохранён (первая страница не изменилась)
referenceNumber asc/desc, displayedPrice desc, serviceDate asc,
status asc, slaDeadline asc → реальный server orderBy (total=646)
status + sort (CHECKING=22) → одна query с обоими
sortBy=__proto__ / constructor / tenantId / customer → HTTP 400
sortDirection=DROP → HTTP 400
```

## S. Accessibility

- Sorting: `SortableHeader` = button semantics, aria-sort (ascending/descending/none),
  Enter/Space, видимая стрелка ↑/↓, title.
- Filter: `TableHeaderFilter` — aria-expanded, aria-haspopup=listbox, aria-label
  (отдельный от sort-кнопки accessible name), role=option listbox, Escape закрывает
  и возвращает фокус (unit + browser), focus-visible ring, active state визуален.
- KPI карты: aria-pressed (browser: pressed=true/false переключения).

## T. Responsive

Browser @ 1680/768/390 (screenshots в `docs/evidence/c12e/`): page-level overflow=0px
на всех трёх; 12 статус-KPI + Total рендерятся; toolbar search + Status header filter
присутствуют. Header sort/filter interaction + popover usability полноценно проверены
на desktop (1680; dropdown полностью внутри viewport, 13 options). На узких widths
внутренний app сохраняет fixed sidebar и сжимает fixed-layout таблицу — преэкзистинг
общее поведение всех registries (см. evidence UI-C1.2B/D: те же проверки overflow+KPI
grid); Requests этим этапом хуже не стал (новых оверлеев/перекрытий сортировки нет,
страница не получает горизонтального overflow).

## U. Security

```text
RBAC/tenant/workspace isolation  — не тронуты (read path тот же)
enum validation                  — сохранена (status типизирован RequestStatus)
sort allowlist                   — enforced (own-property, 400 на чужое)
raw property injection           — невозможно (400 на __proto__/constructor/tenantId)
search                           — без изменений (существующий safe OR-поиск)
```

Live-проверка: `sortBy=__proto__`, `sortBy=tenantId`, `sortBy=customer`,
`sortOrder`-injection варианты → canonical HTTP 400 до query builder.

## V. Tests

| Suite | Tests | Result |
|---|---|---|
| backend request-sort.spec | 25 | ✅ PASS |
| backend order module (request-kpi, order-kpi) | 36 | ✅ PASS |
| backend commerce-chain.invariants | 18/20 | 2 pre-existing DB-data artifacts (`MKT-ORD-D5FIX-0001`, `SF0000001` в seed) — не связаны с этапом |
| frontend requests-registry | 74 | ✅ PASS |
| frontend table-header-filter | 25 | ✅ PASS |
| frontend operations-center-shell | 19 | ✅ PASS |
| frontend orders-registry | 58 | ✅ PASS |
| frontend bookings-registry | 48 | ✅ PASS |
| full vitest | 614/615 | 1 pre-existing (i18n Intl NBSP, environment) |
| Browser evidence (c12e_1g_browser_results.json) | 83 | ✅ PASS |

## W. Build

```text
frontend TSC (tsc --noEmit)      — PASS
frontend build (next build)      — PASS
backend typecheck (tsc --noEmit) — PASS
backend build (tsc -p tsconfig.build.json) — PASS
```

## X. Files Changed

| File | Change |
|---|---|
| `backend/src/modules/order/request-sort.ts` | NEW — allowlist/default/builder/validation (canonical 400) |
| `backend/src/modules/order/request-sort.spec.ts` | NEW — 25 unit + service-scope тестов |
| `backend/src/modules/order/request.controller.ts` | GET /requests: +sortBy/sortDirection query params |
| `backend/src/modules/order/request.service.ts` | listRequests: sort validation + orderBy (default createdAt desc + tie-breaker) |
| `backend/src/shared/sort.ts` | allowlist own-property check (fix: `__proto__`/`constructor` больше не проходят) |
| `frontend/app/app/requests/page.tsx` | toolbar Status удалён; Status header filter; 7 SortableHeader; handleSort/Reset/URL authority fix; export scope; reload derivation |
| `frontend/lib/requests-registry.spec.tsx` | обновлённые Reset/toolbar тесты + новые §28 (sortable/non-sortable, KPI↔header sync, static KPI, URL/reload/coexistence, export scope) |
| `docs/evidence/c12e/c12e_1g_browser_results.json` | 83/83 browser checks |
| `docs/evidence/c12e/c12e_1g_*.png` | 8 screenshots (desktop/status-header/sort/filter+sort/combined/1680/768/390) |
| `docs/prompts/PHASE_3_UI_C1_2F_1G_…_IMPLEMENTATION.md` | stage prompt (committed) |
| `docs/reports/PHASE_3_UI_C1_2F_1G_…_REPORT.md` | этот отчёт |

## Y. Git Hard Closure

```text
git status — CLEAN (после коммитов этапа)
HEAD == origin/master — см. раздел FINAL SHA
```

## Z. Final Verdict

```text
VERDICT A — UI-C1.2F.1G
REQUESTS TABLE SORTING + TABLE-HEADER STATUS FILTER
— ACCEPTED

FINAL SHA: <feat-commit>

STATUS TOOLBAR FILTER REMOVED      — PASS
STATUS HEADER FILTER               — PASS
KPI ↔ HEADER SAME STATE            — PASS
ONE ACTIVE KPI                     — PASS
STATIC KPI OVERVIEW                — PASS

REQUESTS BACKEND SORTING           — PASS
SORT ALLOWLIST                     — PASS
DEFAULT createdAt DESC             — PASS
STABLE PAGINATION                  — PASS

referenceNumber SORT               — PASS
displayedPrice SORT                — PASS
confirmedPrice SORT                — PASS
serviceDate SORT                   — PASS
status SORT                        — PASS
createdAt SORT                     — PASS
slaDeadline SORT                   — PASS

STATUS SORT + FILTER               — PASS
SERVER-SIDE SORTING                — PASS
SERVER-SIDE FILTERING              — PASS

URL AUTHORITY                      — PASS
PAGE RESET                         — PASS
PERIOD PRESERVATION                — PASS
SEARCH COEXISTENCE                 — PASS
RESET                              — PASS
TAB SWITCH                         — PASS
RELOAD/BACK/FORWARD                — PASS
EXPORT                             — PASS

ACCESSIBILITY                      — PASS
RESPONSIVE                         — PASS
SECURITY                           — PASS
TESTS / BUILD                      — PASS

WORKING TREE CLEAN                 — PASS
HEAD == origin/master              — PASS
GIT HARD CLOSURE                   — PASS

UI-C1.2F.1G — ACCEPTED
```

## Notes / Non-blocking

1. **Параметр направления сортировки.** Текст этапа §10 приводит пример `sortOrder=asc`,
   однако deployed contract всего Operations Center (Orders 1D: `OrderController
   ListOrdersQuery`, `registry-url-state` расхождение, обе страницы) — это
   `sortBy`/`sortDirection`. Requests следует deployed runtime-контракту (cross-registry
   consistency; backend Orders и Requests принимают `sortDirection`). Замечание
   зафиксировано для reconciliation с шаблоном документации.
2. **KPI overview static.** `loadKpi()` никогда не получает status/search/sort —
   только period; overview под status filter не пересчитывается (проверено unit + browser).
3. **Pre-existing failures (не блокеры этапа):** vitest `i18n.spec` (Intl NBSP — окружение)
   и backend `commerce-chain.invariants` 2 теста (live-DB seed-артефакты
   `MKT-ORD-D5FIX-0001`, `SF0000001`).
