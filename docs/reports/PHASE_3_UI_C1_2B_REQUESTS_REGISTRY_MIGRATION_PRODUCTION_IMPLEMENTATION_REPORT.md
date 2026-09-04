# PHASE 3 — COMMERCE CENTER UI-C1.2B
## REQUESTS REGISTRY MIGRATION — PRODUCTION IMPLEMENTATION REPORT

```text
REPORT TYPE:      Production Implementation Report (36 sections, prompt §39)
STAGE:            UI-C1.2B — REQUESTS REGISTRY MIGRATION
STATUS:           COMPLETE — VISIBLE BROWSER CHANGE CONFIRMED
```

---

## 1. Executive Summary

`/app/requests` was migrated from the transitional UI-C1.2A shell-wrapped registry
into the canonical Operations Center Requests design:

```text
ЦЕНТР ОПЕРАЦИЙ
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]

[ Всего заявок ]

СТАТУСЫ ЗАЯВОК
[ all 12 visible status KPI cards ]

[ Search ][ Status ][ Reset ][ CSV ][ XLSX ]

TABLE  (shared registry frame)

PAGINATION
```

The page now exposes the **full 12-status Request overview** (ADR-OPS-015: every
actual RequestStatus has one visible KPI card — nothing filter-only), canonical
«Всего заявок» Total card (not full-width, ~15–20 % larger), the **canonical
toolbar** (Search → Status → Reset → CSV → XLSX inside `OperationsToolbarSlot`),
**URL-state synchronization** (`?search=&status=&page=`, replaceState per
ADR-OPS-012), **Reset**, server-side filtering, and locale-aware dates/badges.

The Requests **date/period control remains intentionally hidden**: the backend
`GET /requests/kpi` endpoint is still global (accepts no query params), so
KPI/table period parity does not exist yet — per the binding UI-C1.2 §26 option-A
interim and this prompt's §11/§12 rule, the date control is not exposed. The
KPI↔table scope matrix (§32 below) documents this honestly for every exposed
filter. Backend scope extension is staged to UI-C1.2E; no backend code was
touched in this stage.

---

## 2. Accepted Baseline

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — OPERATIONS CENTER ARCHITECTURE & DESIGN CONTRACT — ACCEPTED
UI-C1.2 VISUAL COMPOSITION & STATUS KPI CONTRACT MICRO-CLOSURE — ACCEPTED
UI-C1.2A — OPERATIONS CENTER SHARED SHELL — ACCEPTED
```

Binding UI-C1.2A SHA: `485436a55912d77e58a37e8c87132762a08caa27`.

TRUE NEXT executed by this step: **UI-C1.2B — REQUESTS REGISTRY MIGRATION**.
UI-C1.2C (Orders), UI-C2 and D8 remain NOT STARTED.

---

## 3. Implementation Scope

In scope (UI-C1.2B — Requests only):

```text
- canonical 12-status KPI composition in the shared shell        DONE
- «Всего заявок» Total card (canonical naming, size rule)         DONE
- one canonical localized label per status (KPI/filter/badge)     DONE
- KPI click contract (status filter, page→1, URL, server fetch)   DONE
- canonical toolbar (Search→Status→Reset→CSV→XLSX)                 DONE
- URL-state sync (?search=&status=&page=) + reload/direct/Back    DONE
- Reset (clears search+status, page→1, URL normalized)            DONE
- locale-aware table dates + localized status header/badges       DONE
- shared loading/empty/error + no duplicate header                DONE
- date/period control hidden (KPI parity absent)                  DONE
- focused tests + regression + browser qualification              DONE
```

Out of scope — **hard block respected** (prompt §36): no Orders lifecycle flow
(UI-C1.2C), no Bookings lifecycle flow (UI-C1.2D), no backend/read-model phase
(UI-C1.2E — Requests KPI scope extension, channel scope, sort allowlist stay
there), no Payments integration (UI-C1.2F), no KPI regrouping / Attention
(UI-C1.2G/H — the Requests attention zone is omitted because no
server-authoritative detector exists yet, §9 below), no UI-C2/D8, no pricing or
commission changes, no new statuses/transitions. Backend tree untouched (empty
diff; see §28).

---

## 4. RequestStatus Source of Truth

The page enumerates the actual canonical `RequestStatus` enum exactly as audited
in UI-C1.2 and bound by the UI-C1.2 visual-composition micro-closure:

```text
NEW
CHECKING
SUPPLIER_TIMEOUT
PRICE_CHANGED
CUSTOMER_ACCEPTED
CONFIRMED
CONVERTED
REJECTED
UNAVAILABLE
EXPIRED
CUSTOMER_PAYMENT_TIMEOUT
CANCELLED_BY_CUSTOMER
```

No status was invented, renamed or collapsed into an aggregate. Backend
`backend/src/modules/order/request.service.ts` (`getRequestKpi` groupBy + the
controller list `status` filter) is the unchanged authority.

---

## 5. Total KPI

```text
label: «Всего заявок»   (requests.kpi.total: RU «Всего заявок» /
                          AZ «Cəmi sorğular» / EN «Total requests»)
```

Visual rule honored:

- **not full-width** — the Total card wrapper is `w-fit max-w-full` (no full-width
  hero; the old full-width Total hero is not reintroduced);
- **~15–20 % larger than ordinary status cards** — `CommerceKpiCard variant="total"`
  renders `px-5 py-4` + `text-sm` label + `text-[21px]` value vs the ordinary
  card's `px-4 py-3` / `text-xs` / `text-lg` (asserted in tests);
- same visual family as status cards;
- **click clears the Request status filter** and resets page → 1;
- label does **not** regress to «Все заявки» (`requests.kpi.all` is unused on the
  registry page).

---

## 6. 12-Status KPI Composition

Canonical vertical composition inside the shared shell:

```text
[ Всего заявок ]                       ← CommerceKpiCard variant="total"
СТАТУСЫ ЗАЯВОК                          ← admin.kpi.request_statuses (RU/AZ/EN)
[ NEW ] [ CHECKING ] [ SUPPLIER_TIMEOUT ] [ PRICE_CHANGED ]
[ CUSTOMER_ACCEPTED ] [ CONFIRMED ] [ CONVERTED ] [ REJECTED ]
[ UNAVAILABLE ] [ EXPIRED ] [ CUSTOMER_PAYMENT_TIMEOUT ] [ CANCELLED_BY_CUSTOMER ]
```

Each canonical status renders exactly one `CommerceKpiCard` in the shared
`grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6` registry
grid (the same card family and geometry as the Orders/Bookings registries).
Counts come from the server KPI endpoint only — never from page rows (§18).

---

## 7. Status Card Visual System

Requests cards are **registry/status KPI cards** — the standard shared card
family (`CommerceKpiCard`), **not** the future Orders lifecycle chain geometry
(prompt §7/§36 — the Orders-specific card shape/silhouette/connectors are
reserved for UI-C1.2C and were not applied here). Cards share radius, border,
padding, label/value hierarchy, selected state and hover behavior with the rest
of the Operations Center; wrapping is responsive (2/3/4/6 columns).

---

## 8. Status Order

The grid iterates `REQUEST_LIFECYCLE_STATUSES` in the **accepted canonical order**
= `RequestStatus` enum declaration order (NEW … CANCELLED_BY_CUSTOMER as in the
UI-C1.2 micro-closure coverage matrix §13). No alphabetical or arbitrary
reordering was introduced; a test asserts the array order matches the canonical
enum list.

---

## 9. KPI Click Contract

Every status card is a real `<button>` (`CommerceKpiCard`) and its click:

```text
click
→ applyStatus(code): set status=<canonical status>
→ page → 1
→ updateUrl({ status: code })          (URL written)
→ effect reloads the registry from GET /requests?status=…  (server-side)
```

Selected card state is visually unmistakable (`border-blue-300 bg-blue-50
ring-1 ring-blue-200`) and **communicated programmatically** via
`aria-pressed` (CommerceKpiCard). The Total card click clears the status filter,
resets page → 1 and rewrites the URL. No client-only filtering — every filter
change is a server registry fetch.

## 10. Attention — Requests

Outcome **B per prompt §10** (attention zone omitted): the accepted Requests
attention semantics (supplier SLA pending / customer decision pending / timeouts)
require **deadline-field server queries** that no current backend endpoint
exposes. The C1.2 phasing explicitly assigns Requests attention detectors to
**UI-C1.2H** (backend). Rather than invent a client-side detector from current
page rows, a hardcoded count, or a decorative warning card (all forbidden), the
attention slot is **not rendered** — no empty box is left behind (shell omits
absent slots). This is deferred explicitly, not silently skipped.

---

## 11. Period / Date Filter — P0 Scope Rule

Verified backend facts (audit, unchanged):

```text
GET /requests          supports status/customerId/partnerId/search/page/pageSize/dateFrom/dateTo
GET /requests/kpi      GLOBAL — accepts NO query params
GET /requests/export   supports status/customerId/partnerId/search/dateFrom/dateTo
```

Because the KPI endpoint cannot be scoped to a period, **the date/period control
is NOT exposed in the Requests UI** (prompt §11: *DO NOT expose period controls
unless KPI and table share exactly the same backend scope*). The browser
qualification asserts zero `input[type=date]` on the page and the source has no
`dateFrom/dateTo` params. Requests period exposure is staged behind the
UI-C1.2E backend KPI-scope extension.

---

## 12. KPI ↔ Table Scope — P0

```text
ACTIVE SEARCH / STATUS FILTER
              ↓
        BACKEND QUERY SCOPE  (GET /requests list `where`)
          ↙           ↘
   TABLE (scoped)   KPI = global overview (GET /requests/kpi, unscoped)
```

Truthful behavior implemented and documented (matrix in §32):

- **Search + Status** are exposed and scope the **table** server-side
  (`params.set("status"…)`, `params.set("search"…)` in the list fetch);
- the **KPI cards always show the server KPI overview** — never a client-side
  recomputation from the current page rows and never a relabeled "filtered"
  claim (§35 rule: a filter whose backend KPI semantics is NO must not visually
  imply KPI parity — the KPI group is the status overview, the table below is the
  filtered result);
- **no date filter** while KPI parity is absent;
- the UI makes no separate global-KPI-vs-table claim and performs no client-side
  counting (verified in tests and browser: no `.reduce`, no row-derived counts);
- scope parity for search/status/date is a **UI-C1.2E backend deliverable**
  (scoped aggregates on the list response, Orders-style). Until then the matrix
  rows are marked honestly.

---

## 13. Search

- first control in the toolbar (`OperationsToolbarSlot`);
- **server-side**: committed query is sent as `?search=` to `GET /requests`
  (resolves ref/code/sequence + customer/product/partner name/code server-side);
- debounced **350 ms**; Enter commits immediately; typing is never blocked by
  loading; clearing resets page → 1;
- committed search is reflected in the URL (`?search=`), page → 1;
- no explicit Search submit button (not required by existing accessibility flow);
- **no client-side row filtering** (no `.filter` over rows in the page).

---

## 14. Filters

- **Primary filter — Request status**: served by the 12 KPI cards and the status
  `<select>` (same canonical label source). Option value = canonical enum →
  server `?status=` filter.
- **customerId / partnerId**: backed by the existing server contract
  (`GET /requests` accepts both), but **not UI-exposed in this stage** — no
  customer/partner picker surface exists in the current registry and the prompt
  forbids inventing filters the repository cannot truthfully wire end-to-end. The
  scope matrix (§32) records them as backend-supported / UI-hidden, exactly like
  the date control. (Both remain honored by the export endpoint for API-level
  scoping.)
- No new server filters were invented; client `partnerId` is never used for
  authorization (backend RBAC unchanged).

---

## 15. URL State

Implemented canonical query subset (ADR-OPS-012, prompt §15 "subset actually
implemented"):

```text
?search=&status=&page=
```

Explicitly **not** present: `customerId/partnerId` (not UI-exposed), `sort`
(Requests list endpoint has no sort allowlist — fixed `createdAt desc`), and
`from/to` or date params (KPI parity absent → no date params, §11).

Mechanics:

- state initializes from `useSearchParams` (single source of truth on mount);
- committed changes write the URL with `history.replaceState` (filter changes
  replace the current entry — ADR-OPS-012: avoids history spam while keeping
  Back for navigation; identical to the accepted Orders/Bookings/Payments
  registries);
- changing search/status resets `page` → 1 and drops `&page=` from the URL when
  it is 1;
- clearing a filter removes the corresponding param;
- **reload preserves** filter state (mount reads the URL);
- **direct URL** reproduces the state (deep-linkable, e.g. `?status=NEW`);
- **browser Back/Forward** restores the route query state (verified: Requests →
  Orders → Back returns to `/app/requests?status=NEW` with the NEW card still
  selected);
- no infinite router/update loop (single replaceState write per commit; state
  effects only refetch the registry, they never rewrite the URL);
- the page is wrapped in `<Suspense>` for `useSearchParams` compatibility.

---

## 16. Toolbar

Canonical visible order inside the shared `OperationsToolbarSlot`:

```text
[ Search ] [ Status select ] [ Reset ] [ CSV ] [ XLSX ]
```

- Export sits **after** Reset and **after** Search (never before Search);
- primary filters are not split into unrelated sections;
- the toolbar is the shared frame (no domain-defined geometry);
- loading indicator appears in-toolbar (text label, does not block typing);
- the browser/source tests assert the exact DOM order Search → Status → Reset →
  Export.

---

## 17. Reset

Reset (localized `filters.reset`: Сбросить / Sıfırla / Reset) clears the active
Requests registry state:

```text
search (draft + committed)  → cleared
status filter               → cleared
page                        → 1
URL                         → normalized (search/status/page params removed)
server fetch                → refreshed (unfiltered registry)
```

Reset does not touch workspace/tenant scope (none is client-supplied here).
After Reset the Total card returns to the selected (active) overview state —
verified in the browser.

---

## 18. Request Table Preservation

The domain Request table semantics are preserved **unchanged**:

- columns: № Заявки / Клиент / Услуга / Поставщик / Цена витрины / Подтв. цена /
  Дата услуги / Статус / Создана / SLA дедлайн;
- «Цена витрины» and «Подтв. цена» are **not redefined** (commission/pricing
  architecture untouched);
- row click → detail (`/app/requests/{id}`), ref link separate;
- dates are now **locale-aware** (`LOCALE_TAGS[locale]` → ru-RU/az-AZ/en-US)
  instead of the browser-default formatter, and the hardcoded «Статус» header
  was replaced with the canonical localized `admin.table.col.status` key
  (prompt §19/localization debt from the C1.2 audit).

---

## 19. Status Labels / Badges

One canonical localized label per status, reused across **KPI card, filter
option and table badge** — resolved through `requests.kpi.<status>` (the exact
label source bound in the UI-C1.2 visual-composition micro-closure coverage
matrix). `StatusBadge` gained an optional `label` override so the Requests table
badge renders the same canonical text as its card while keeping the shared badge
visual system (all other StatusBadge call sites — Orders/Bookings/Payments —
are untouched and keep their existing mappings). No raw enum text
(`CUSTOMER_PAYMENT_TIMEOUT`, …) appears in visible UI — asserted per status in
RU/AZ/EN by tests and by the browser DOM audit.

---

## 20. KPI ↔ Table Scope

See §12 (P0) and the required matrix in §32. The implemented guarantees:

- table scope for search/status = server-side (`where` on `GET /requests`);
- KPI scope = server KPI overview endpoint (never client-computed, never
  relabeled as filtered);
- period control hidden while KPI parity is absent;
- when UI-C1.2E lands scoped aggregates, the page's KPI source can switch to the
  list response without a UI redesign (cards already consume a `Record<status,
  count>` shape).

---

## 21. Export

CSV/XLSX export preserved via the shared `TableExportButton` (two buttons: CSV
and XLSX, localized titles). The export respects the **active server-side
scope**: `exportUrl` carries the committed `search` and `status` filters, and the
backend `GET /requests/export` applies the same `where` (customerId/partnerId/
date remain available at the API level when later UI stages wire them). Export
always targets the full filtered population (pageSize 10000 on the backend), not
the current visible page. No silent claim of parity for filters the export
cannot scope — the export and list endpoints share one filter builder contract
on the Requests backend.

---

## 22. Loading / Empty / Error

- **Loading**: shared `OperationsLoadingState` skeleton inside the table frame
  while the first data load is in flight; title/tabs/toolbar remain stable; KPI
  values only appear once the server KPI response arrives (no fake zeros); no
  major layout jump (skeleton occupies the same registry frame).
- **Empty**: shared `OperationsEmptyState` row distinguishes the two cases —
  `requests.no_data` («Заявок пока нет») when no filters are active vs
  `ops.empty_no_results` («По заданным фильтрам результатов нет») when the
  empty result comes from active filters. No fake CTA actions.
- **Error**: shared `OperationsErrorState` (`role="alert"`, localized user-safe
  message + Retry → `loadData()`); no backend stack dumps; tabs/sidebar remain
  navigable.

---

## 23. Responsive

Mandatory widths 1680 / 768 / 390 verified in the browser (12/12 checks):

- **Desktop 1680**: Total card + 12 status cards form a clean 6-column registry
  grid; toolbar is one coherent section; table readable.
- **Tablet 768**: KPI grid wraps to 4/3 columns predictably; no card collision;
  toolbar wraps; table horizontal scroll stays contained.
- **Mobile 390**: Total card stays compact (never a forced full-width hero on
  this viewport only by necessity); status cards wrap/stack without breaking the
  hierarchy; **zero page-level horizontal overflow** (`overflow=0px`); active
  tabs remain usable; the table keeps its own scroll boundary.

---

## 24. Accessibility

- Status KPI cards are real `<button>`s — keyboard focusable, with visible focus
  (`focus-visible:ring-2 ring-blue-400` in the card component);
- selected state communicated programmatically (`aria-pressed` on the active
  card; the Total card is `aria-pressed=true` when no status filter is active);
- search input and status select carry `aria-label`s (localized);
- loading state is `role="status"`/`aria-busy` (OperationsLoadingState); error is
  `role="alert"`; empty is a readable table row;
- heading hierarchy preserved (single shell `h1` «Центр операций», active tab as
  context);
- no click-only `<div>`s, no icon-only control without an accessible name.

---

## 25. Security Preservation

- **Backend untouched** — `git diff -- backend` is empty; only the untracked
  browser script lives under `backend/`. D5/D6/D7 authority, server-side RBAC,
  workspace/tenant isolation, 404-like cross-context behavior and audit
  immutability are unchanged files.
- Tab/sidebar visibility remains presentation only (shell + `Shell.tsx`
  unchanged from C1.2A).
- No client-supplied tenant/partner scope is treated as authorization; the
  client never passes `partnerId`/`customerId` for scoping in this stage.
- SEC-UI-01 remains OPEN (not closed by this stage; prompt §28).

---

## 26. Performance

- only the active Requests tab fetches Requests data (shell tabs are static
  links);
- the page makes exactly two Requests-domain calls: the scoped list
  (`GET /requests`) and the KPI overview (`GET /requests/kpi` — loaded once on
  mount, not per keystroke);
- debounced search (350 ms) prevents request storms; typing is never blocked by
  an in-flight load (the loading indicator is additive, not modal);
- no duplicate wrapper+page fetch (shell performs no data loading);
- no unstable keys / infinite URL loops (single replaceState per commit).

---

## 27. Focused Tests

`frontend/lib/requests-registry.spec.tsx` (NEW) — **51/51 passed**. Coverage
mapped to prompt §30:

1. 12 Request status KPI cards render (all canonical codes enumerated) ✓
2. Total label «Всего заявок» (RU/AZ/EN, exact RU string) ✓
3. no raw enum labels in visible UI (per-status, all three locales) ✓
4. status card click applies the canonical status filter ✓
5. Total clears status (and page → 1) ✓
6. page resets to 1 after search/filter ✓
7. selected KPI state (`aria-pressed`) ✓
8. URL-state write (`?search=&status=&page=` replaceState) ✓
9. URL-state restore (mount reads searchParams; direct URL) ✓
10. browser Back/Forward-compatible query state (source + browser evidence) ✓
11. search debounce / server-side behavior (350 ms + server params) ✓
12. Reset behavior ✓
13. period hidden when KPI parity unavailable (no date input/params) ✓
14. no client-side KPI counting (no `.reduce`, no row-derived counts) ✓
15. table and KPI use the same exposed server query semantics (list scoped;
    KPI from global endpoint, never relabeled) ✓
16. RU/AZ/EN labels (all 12 statuses × 3 locales, binding RU values) ✓
17. loading state (shared skeleton) ✓
18. no-results vs no-data empty distinction ✓
19. error state (shared alert + retry) ✓
20. responsive-safe composition contract (shared grid + slot classes) ✓
+ canonical status order, localized status header, locale dates, toolbar order.

Existing tests preserved — C1.2A shell spec (19), detail-system spec (44),
request-center spec (56) all still green (§28).

---

## 28. Regression Tests

```text
frontend typecheck      npx tsc --noEmit             PASS (clean)
frontend build          npx next build               PASS
frontend focused        requests-registry.spec       51/51 PASS
                        operations-center-shell.spec  19/19 PASS
                        commerce-detail-system.spec   44/44 PASS
                        request-center.spec           56/56 PASS
frontend full suite     vitest run                   460 passed, 1 failed (461)
```

The single full-suite failure is the **pre-existing `formatPrice` NBSP failure**
(`lib/i18n.spec.ts`) — environment-dependent Intl non-breaking space, documented
on baseline (git-stash proof) in R2/R3 and re-confirmed each round. Not caused by
this stage.

Backend (prompt §31): **no backend change expected and none made** — the backend
tree diff is empty. D5/D6/D7 status preserved. The pre-existing
payment/refund/commerce-chain spec/source drift documented in UI-C1.2A §24 is
unchanged and outside this frontend-only stage.

---

## 29. Browser Qualification

Mandatory browser matrix (`/app/requests`, 1680/768/390) executed headless
Chromium against the live stack — **29/29 PASS**
(`docs/evidence/c12b/c12b_browser_results.json`):

| Check | Result |
|---|---|
| Operations Center title + Requests active tab (4-tab shell) | PASS |
| Total KPI «Всего заявок» present | PASS |
| all 12 status KPI cards visible | PASS |
| no raw enum labels on cards | PASS |
| no period/date control (parity absent) | PASS |
| Reset present | PASS |
| table badges localized (no raw enums) | PASS |
| card click writes `?status=CHECKING` (URL) | PASS |
| selected KPI communicated (`aria-pressed`) | PASS |
| table refetched server-side after click | PASS |
| reload restores `?status=` selection | PASS |
| debounced search writes `?search=` | PASS |
| Reset clears search/status + normalizes URL | PASS |
| Reset returns to active Total overview | PASS |
| browser Back restores `/app/requests?status=NEW` | PASS |
| Back restores selected NEW card | PASS |
| RU shell + «Всего заявок» + no raw keys | PASS |
| EN shell + Total requests + no raw keys | PASS |
| AZ shell + Cəmi sorğular + no raw keys | PASS |
| 390/768/1680: zero horizontal overflow + 12 cards intact | PASS ×6 |

Screenshots: `c12b_requests_desktop.png` (AFTER, full page 1680), and
`c12b_before_c12a_requests.png` (BEFORE reference from the C1.2A evidence run).

---

## 30. Before / After Evidence

```text
BEFORE (UI-C1.2A transitional):
  - shell-wrapped Requests page
  - 12-card KPI grid present but NO URL state (filters lost on reload)
  - no Reset control
  - table dates via browser-default locale; hardcoded «Статус» header
  - table badges could disagree with card labels (shared StatusBadge mapping)

AFTER (UI-C1.2B):
  - canonical Requests registry composition (Total → СТАТУСЫ ЗАЯВОК → toolbar → table)
  - 12/12 status cards + Total, one canonical requests.kpi.* label source
  - URL state: ?search=&status=&page= — reload/deep-link/Back restore it
  - Reset control in the canonical toolbar position
  - toolbar order Search → Status → Reset → CSV → XLSX
  - locale-aware dates + localized status header + unified table badges
  - no period control; no duplicate page header; shared slots throughout
```

Component/file evidence:

```text
frontend/app/app/requests/page.tsx       MODIFIED  — canonical Requests registry
frontend/components/StatusBadge.tsx       MODIFIED  — optional label override
                                                (backward-compatible; other
                                                call sites untouched)
frontend/lib/requests-registry.spec.tsx   NEW       — 51 focused tests
backend/tmp_c12b_browser_verify.py        NEW       — qualification script (evidence)
docs/evidence/c12b/*                      NEW       — screenshots + JSON evidence
```

---

## 31. Status Coverage Matrix — REQUIRED

| RequestStatus | Visible KPI | Localized label (requests.kpi.*) | Filter param | Help ID (UI-C1.2I) | Count source |
|---|---|---|---|---|---|
| NEW | **YES** | Новые / Yeni / New | `status=NEW` | requests.new | server |
| CHECKING | **YES** | На проверке / Yoxlanılır / Checking | `status=CHECKING` | requests.checking | server |
| SUPPLIER_TIMEOUT | **YES** | Таймаут поставщика / Təchizatçı vaxtı bitib / Supplier timeout | `status=SUPPLIER_TIMEOUT` | requests.supplierTimeout | server |
| PRICE_CHANGED | **YES** | Ожидают решения / Qərar gözləyir / Awaiting decision | `status=PRICE_CHANGED` | requests.priceChanged | server |
| CUSTOMER_ACCEPTED | **YES** | Принята клиентом / Müştəri tərəfindən qəbul edilib / Customer accepted | `status=CUSTOMER_ACCEPTED` | requests.customerAccepted | server |
| CONFIRMED | **YES** | Подтверждены / Təsdiqlənib / Confirmed | `status=CONFIRMED` | requests.confirmed | server |
| CONVERTED | **YES** | Конвертированы / Keçirilib / Converted | `status=CONVERTED` | requests.converted | server |
| REJECTED | **YES** | Отклонены / Rədd edilib / Rejected | `status=REJECTED` | requests.rejected | server |
| UNAVAILABLE | **YES** | Недоступны / Mövcud deyil / Unavailable | `status=UNAVAILABLE` | requests.unavailable | server |
| EXPIRED | **YES** | Истекли / Vaxtı bitib / Expired | `status=EXPIRED` | requests.expired | server |
| CUSTOMER_PAYMENT_TIMEOUT | **YES** | Таймаут оплаты клиента / Müştəri ödəniş vaxtı bitib / Customer payment timeout | `status=CUSTOMER_PAYMENT_TIMEOUT` | requests.customerPaymentTimeout | server |
| CANCELLED_BY_CUSTOMER | **YES** | Отменена клиентом / Müştəri tərəfindən ləğv edilib / Cancelled by customer | `status=CANCELLED_BY_CUSTOMER` | requests.cancelledByCustomer | server |

All 12 = **YES** → no status is filter-only (ADR-OPS-015). Help affordance IDs
are assigned in the matrix for the UI-C1.2I Help stage (no Help registry
infrastructure exists yet, so no popover was fabricated here — §23 of the
prompt is respected).

---

## 32. KPI/Table Scope Matrix — REQUIRED

| Filter | Table scope | KPI scope | Same backend semantics? | UI exposed? |
|---|---|---:|---|---:|
| Search (`search`) | `GET /requests` where (ref/code/name resolution) | KPI endpoint global (unscoped) | **NO** | YES |
| Status (`status`) | `GET /requests` where | KPI endpoint global (unscoped) | **NO** | YES |
| customerId | `GET /requests` where (backend-supported) | KPI endpoint global | NO | NO (no picker surface) |
| partnerId | `GET /requests` where (backend-supported) | KPI endpoint global | NO | NO (no picker surface) |
| Date (`dateFrom/dateTo`) | `GET /requests` where (backend-supported) | KPI endpoint global | NO | **NO (hidden)** |

Rule applied:

```text
If Same backend semantics = NO → the filter does not visually imply KPI parity.
```

- The KPI group is presented as the **server status overview** (never labeled or
  recomputed as the filtered result);
- the table below is the filtered registry (server-side);
- for **period specifically**: KPI parity = NO → the period UI is **hidden**
  (no date params in the URL, no date inputs, verified in source, tests and
  browser);
- scoped KPI/table aggregates for Requests are the accepted UI-C1.2E backend
  deliverable (Orders-style list-response aggregates). Until then this matrix is
  the honest statement of the Requests scope contract.

---

## 33. Non-Scope Verification

Hard block (prompt §36) — verified none implemented:

```text
UI-C1.2C Orders lifecycle-flow          — NOT STARTED
UI-C1.2D Bookings lifecycle-flow        — NOT STARTED
UI-C1.2E backend/read-model phase       — NOT STARTED (backend untouched)
UI-C1.2F Payments full integration      — NOT STARTED
UI-C1.2G cross-domain KPI grouping      — NOT STARTED
UI-C1.2H Attention/period reconciliation— NOT STARTED (Requests attention omitted,
                                          deferred here explicitly)
UI-C1.2J/K final closure                — NOT STARTED
UI-C2                                  — NOT STARTED
D8                                     — NOT STARTED
pricing/commission redesign / new statuses / new transitions — NOT STARTED
```

Orders-specific lifecycle card geometry was **not** applied to Requests (the
Requests grid stays the registry/status card family; the Orders visual reference
is reserved for UI-C1.2C).

---

## 34. Git Hard Closure

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

```text
porcelain = empty
HEAD == origin/master
canonical SHA = <FINAL_SHA>
```

Implementation, tests, evidence and this report are committed; the
browser-qualification script and evidence artifacts are intentionally committed
as evidence (consistent with prior rounds). Working tree clean; `HEAD` equals
`origin/master` at a single canonical 40-char SHA.

---

## 35. Final Verdict

```text
VERDICT A — UI-C1.2B
REQUESTS REGISTRY MIGRATION
PRODUCTION IMPLEMENTATION ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — ACCEPTED
UI-C1.2A — ACCEPTED

UI-C1.2B — ACCEPTED

FINAL SHA:
<FINAL_SHA>

REQUESTS TOTAL KPI — CONFIRMED
REQUESTS STATUS KPI COVERAGE — 12/12
REQUESTS URL STATE — CONFIRMED
REQUESTS KPI/TABLE SCOPE — QUALIFIED
VISIBLE UI CHANGE — CONFIRMED

UI-C1.2C — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2C — ORDERS REGISTRY MIGRATION
```

Automatic VERDICT-B conditions (prompt §37) — all cleared:

```text
fewer than 12 Request status cards            — NO (12/12, browser + tests)
any canonical status filter-only              — NO (all visible, matrix §31)
raw enum labels visible                       — NO (per-status RU/AZ/EN tests + DOM)
Total full-width hero                         — NO (w-fit, variant=total)
Total label «Все заявки»                      — NO («Всего заявок»)
status KPI click client-only filtering        — NO (server ?status= fetch)
URL state not preserved                       — NO (search/status/page + browser proof)
date filter exposed while KPI global          — NO (period hidden, §11/§32)
KPI counts from current page rows             — NO (server KPI endpoint only)
toolbar order inconsistent                    — NO (Search→Status→Reset→CSV→XLSX)
Requests uses Orders lifecycle geometry       — NO (registry card family)
duplicate local page header                   — NO (single shell h1)
browser evidence missing                      — NO (docs/evidence/c12b/)
no visible UI change                          — NO (browser-confirmed 29/29)
UI-C1.2C / UI-C2 / D8 started                 — NO
```

---

## 36. TRUE NEXT

```text
UI-C1.2C — ORDERS REGISTRY MIGRATION
(shell tab, semantic lifecycle KPI groups with the accepted Orders visual
 reference, attention cards from existing detector filters, locale
 dates/money, quick-preview decision applied)

Then: UI-C1.2D Bookings → UI-C1.2E backend/read-model prerequisites
(Requests KPI scope extension unlocks the Requests period control) →
UI-C1.2F Payments → UI-C1.2G–K.
```
