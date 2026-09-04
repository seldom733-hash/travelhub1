# PHASE 3 — COMMERCE CENTER UI-C1.2C — ORDERS REGISTRY MIGRATION — PRODUCTION IMPLEMENTATION — REPORT

> **SUPERSEDED (interaction contract)** — the same-filtered `where` KPI aggregate
> model described in §14/§18 was rejected by product decision and replaced by
> the Requests-style stable-overview contract. See
> `PHASE_3_UI_C1_2C_REMEDIATION_R1_KPI_INTERACTION_PARITY_WITH_REQUESTS_REPORT.md`
> for the accepted final UI-C1.2C state and final SHA.

---

## 1. Executive Summary

UI-C1.2C migrates `/app/orders` from the transitional shell-wrapped registry into the canonical semantic Operations Center Orders composition:

```text
ЦЕНТР ОПЕРАЦИЙ → [ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]

[ Всего заказов ]                                ← Total KPI (not full-width, ~15-20% larger)

ЖИЗНЕННЫЙ ЦИКЛ                                   ← 6 happy-path lifecycle cards as one truthful
                                                   process row (5 decorative connectors on xl)

АЛЬТЕРНАТИВНЫЕ / REWORK                          ← WAITING_FOR_DATA · PARTIALLY_FULFILLED ·
                                                   READY_TO_CLOSE (visible, no false arrows)

ИСКЛЮЧЕНИЯ                                       ← PROBLEM · SUSPENDED · CANCELLED (separate group)

СТАТУС ОПЛАТЫ                                    ← UNPAID · PARTIALLY_PAID · PAID · REFUNDED

TOOLBAR [Search][Lifecycle][Payment][From][To][Reset][CSV][XLSX]
TABLE / PAGINATION
```

- **12/12 canonical `OrderStatus`** visible as KPI cards — grouped by truthful semantics, nothing filter-only.
- **4/4 canonical `OrderPaymentStatus`** visible as a separate payment-status group.
- KPI counts come **only** from the server `aggregates.lifecycle` / `aggregates.payment` returned by the **same filtered `/orders` request** that produces the table (single source, single scope — no client-side counting, no global-KPI regression).
- URL state `?search=&status=&paymentStatus=&dateFrom=&dateTo=&page=` — direct URL, reload, Back/Forward, card clicks, Reset (ADR-OPS-012).
- Period From/To exposed because Orders aggregates **share** the table's `createdAt` `[from, to)` server scope (parity YES).
- Simple decorative connectors appear **only** on the happy-path lifecycle row (xl), never to rework/exception states; `READY_TO_CLOSE` stays a visible card with **no** incoming arrow (no audited producer).
- **Reference-image card matching is DEFERRED by product decision** (superseding prompt). The supplied asset (`public/1.png`) exists but was not used as a P0 visual source of truth; no pixel/reference geometry was fabricated.

Verification: typecheck ✓ · `next build` ✓ · focused suites 224/224 (54 new Orders tests) · full frontend suite 514 passed (only the pre-existing `formatPrice` NBSP failure) · browser qualification **34/34** · backend tree untouched (empty diff).

---

## 2. Accepted Baseline

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 DESIGN CONTRACT — ACCEPTED
UI-C1.2A — ACCEPTED
UI-C1.2B — ACCEPTED

UI-C1.2B FINAL SHA: ec85deb963d1ba9943ecb1ef890a66b45cda2460
```

UI-C2 and D8 remain NOT STARTED.

---

## 3. Scope Correction — Reference Matching Deferred

The superseding prompt `PHASE_3_UI_C1_2C_ORDERS_REGISTRY_MIGRATION_PRODUCTION_IMPLEMENTATION_NO_REFERENCE_MATCH.md` records a **product decision**: the earlier requirement to reproduce lifecycle cards from the supplied screenshot is **deferred**. Consequently:

```text
DO NOT wait for a reference image.
DO NOT perform pixel/reference matching.
DO NOT require a screenshot-derived silhouette.
DO NOT require chevron/reference-specific corners or dimensions.
DO NOT fail the stage because the reference image is unavailable.
```

Business semantics, status coverage, grouping, filtering, URL state, KPI/table scope and server authority remain mandatory and were implemented. Missing reference matching is **NOT** a failure condition of this stage.

---

## 4. Visual Reference Availability

- The supplier placed the Orders Center reference image at `public/1.png` (1024×1536, git-ignored under `/public/`).
- The asset was inspected locally and confirmed present; however the product decision (§3) defers any screenshot-derived card design for UI-C1.2C.
- **No reference geometry was measured, estimated or used.** No side-by-side pixel comparison was performed and none is claimed. The §43-style visual match matrix of the superseded prompt is therefore not applicable; this report replaces it with the semantic coverage/scope matrices mandated by the current prompt (§§32–34 below).
- The image remains available at `public/1.png` for any future reference-match stage (it is intentionally not committed — `/public/` is repository-ignored).

---

## 5. OrderStatus Source of Truth

Implementation uses exactly the canonical 12-value enum — no invented, removed, collapsed or renamed statuses:

```text
NEW · IN_PROCESSING · WAITING_FOR_DATA · READY_FOR_BOOKING · SENT_TO_BOOKING
PARTIALLY_FULFILLED · FULFILLED · READY_TO_CLOSE · CLOSED · CANCELLED
PROBLEM · SUSPENDED
```

The full canonical list drives the toolbar filter dropdown; the three semantic group constants (`ORDER_HAPPY_PATH`, `ORDER_REWORK_STATES`, `ORDER_EXCEPTION_STATES`) partition the same 12 values with no overlap and no omissions.

---

## 6. State-Machine Truth

The UI never implies a transition the backend does not support (§5 of the prompt):

```text
NEW → IN_PROCESSING
IN_PROCESSING → WAITING_FOR_DATA ; WAITING_FOR_DATA → IN_PROCESSING
IN_PROCESSING | WAITING_FOR_DATA → READY_FOR_BOOKING
READY_FOR_BOOKING → SENT_TO_BOOKING
SENT_TO_BOOKING | PARTIALLY_FULFILLED → FULFILLED
FULFILLED | READY_TO_CLOSE → CLOSED
active → CANCELLED ; active minus PROBLEM → PROBLEM ; active minus SUSPENDED → SUSPENDED
```

**Truthfulness finding honoured:** `READY_TO_CLOSE` is real but has **no audited producer** → it is a visible rework card with **no incoming arrow** (§12).

---

## 7. Total KPI

- Canonical label `admin.kpi.total_orders` → RU **«Всего заказов»** (AZ `Cəmi sifariş`, EN `Total orders`); never «Все заказы».
- `CommerceKpiCard variant="total"` inside `w-fit max-w-full` → **not full-width**, typography/padding ~15-20% larger than ordinary cards (label `text-sm` vs `text-xs`, value `text-[21px]` vs `text-lg`, `px-5 py-4` vs `px-4 py-3`).
- Click → clears `status` **and** `paymentStatus` (the applicable Order status dimensions for «Всего заказов»), `page → 1`, URL update, server refresh. Documented + tested.
- Value comes from `data.total` (server count over the active filtered `where`, same scope as KPI aggregates and table).

---

## 8. KPI Semantic Composition

The registry is **not** one flat endless grid. Vertical composition is fixed in this order:

```text
TOTAL → ЖИЗНЕННЫЙ ЦИКЛ → АЛЬТЕРНАТИВНЫЕ / REWORK → ИСКЛЮЧЕНИЯ → СТАТУС ОПЛАТЫ
→ TOOLBAR → TABLE → PAGINATION
```

Each group has its own localized heading (RU shown; AZ/EN in i18n): «Жизненный цикл» / «Альтернативные / rework» / «Исключения» / «Статус оплаты». No Attention zone is rendered (no distinct server-authoritative detector beyond the deep-link detector scopes that are applied to the table/KPI scope rather than a decorative queue — §16 below).

---

## 9. Primary Lifecycle

`ORDER_HAPPY_PATH` renders six cards in canonical sequential order:

```text
NEW → IN_PROCESSING → READY_FOR_BOOKING → SENT_TO_BOOKING → FULFILLED → CLOSED
```

- Visually one process row at `xl` (1280px+) via a wrapping flex flow; each card keeps the shared `CommerceKpiCard` family/tokens.
- Five small **decorative** chevron connectors sit strictly between adjacent happy-path cards (visible at xl, hidden below xl where the row wraps). Connectors are `aria-hidden`, not focusable, and never imply a rework/exception transition.
- At <xl the six cards wrap 2/3/4-per-row with zero connectors — no false geometry across wrapped rows.

---

## 10. Alternative / Rework

`ORDER_REWORK_STATES` — **WAITING_FOR_DATA · PARTIALLY_FULFILLED · READY_TO_CLOSE** — rendered as visible cards in their own grid with the header «Альтернативные / rework».

- Not forced into a linear path; **no connectors** in this section.
- `READY_TO_CLOSE` (no audited producer) sits here, visible, without any incoming arrow.

---

## 11. Exceptions

`ORDER_EXCEPTION_STATES` — **PROBLEM · SUSPENDED · CANCELLED** — rendered as visible cards in the separate «Исключения» group.

- No arrows, no sequential implication.
- Same click contract as every status card (server `status=` filter).

---

## 12. No-False-Transition Proof

- Connector markup exists in exactly one place: the happy-path lifecycle `ol` (`idx < ORDER_HAPPY_PATH.length - 1` → 5 connectors max).
- `ORDER_HAPPY_PATH` contains **none** of `WAITING_FOR_DATA / PARTIALLY_FULFILLED / READY_TO_CLOSE / PROBLEM / SUSPENDED / CANCELLED`.
- Rework and exception sections contain no `svg`/`aria-hidden` connector elements.
- Verified statically in `frontend/lib/orders-registry.spec.tsx` and in the browser at 1680 (5 visible) / 768·390 (0 visible, wrapped rows).

---

## 13. OrderPaymentStatus

Separate canonical dimension — the four real `OrderPaymentStatus` values:

```text
UNPAID · PARTIALLY_PAID · PAID · REFUNDED
```

Rendered only inside the «Статус оплаты» group — never mixed into lifecycle/rework/exceptions. Filter param `paymentStatus=<value>` is a **different** dimension from `status=`.

---

## 14. Payment KPI Group

`ORDER_PAYMENT_STATUSES` → 4 visible payment cards with canonical localized labels (`order.payment.*`: «Не оплачен» / «Частично оплачен» / «Оплачен» / «Возврат»).

Click contract:

```text
payment KPI → paymentStatus=<canonical value> → page=1 → URL update → server refresh
```

Selected state `aria-pressed`. A selected payment card clears the lifecycle dimension and vice-versa (dimension-exclusive — verified in browser: `?paymentStatus=PAID` with no `status=`).

---

## 15. Refund Deferral / Authority

Order-level refund aggregates (`REQUESTED / APPROVED / PROCESSED / FAILED`) are staged behind later backend/read-model work. UI-C1.2C **does not fabricate** refund KPI counts and does not derive them from page rows. No refund group is rendered. The backend already exposes Order-level `paymentStatus = REFUNDED` counts through the shared aggregates — that is the canonical server source for the «Возврат» payment card only. Refund KPI grouping remains deferred to UI-C1.2E/F/G (documented, not implemented).

---

## 16. Attention

No separate Attention zone is rendered. The real server-authoritative actionable queues (`cancelledWithin` RECENT_CANCELLATIONS, `paymentFailed` FAILED_PAYMENTS, `pendingRefund` PENDING_REFUNDS) exist as **backend detector filters** on `/orders`; they arrive via deep links and scope both the KPI aggregates and the table through the same `where` (extra detector columns appear only while the detector param is active). Duplicating them as a decorative Attention card row would violate `ATTENTION = actionable queue ≠ duplicated status card`, so the zone is omitted per the prompt.

---

## 17. KPI Click Contract

- Lifecycle/status card → `status=<OrderStatus>` → clears `paymentStatus` → `page=1` → URL → server fetch.
- Payment card → `paymentStatus=<OrderPaymentStatus>` → clears `status` → `page=1` → URL → server fetch.
- Total («Всего заказов») → clears **both** status dimensions (semantic meaning of Total over the unfiltered registry scope) → `page=1` → URL → server fetch.
- No client-only filtering anywhere (`applyStatus`/`applyPaymentStatus`/`handleTotalClick` all trigger the single `/orders` fetch).

Browser-verified: lifecycle click `?status=IN_PROCESSING`, payment click `?paymentStatus=PAID`, Total click normalized URL to `/app/orders`, each followed by a server table refresh.

---

## 18. KPI ↔ Table Scope

Orders keeps its **stronger same-scope pattern** (no Requests-style interim global KPI). `listOrders` computes `aggregates.lifecycle` and `aggregates.payment` via `groupBy` on the **identical `where`** used for `findMany` + `count` — search, status, paymentStatus, date range and detector filters all feed one query scope. The registry consumes the single `/orders` response:

```text
ACTIVE FILTER / PERIOD
        ↓
same server-side where (GET /orders)
      ↙              ↘
   aggregates       items/total
   (KPI cards)      (table)
```

No `/orders/kpi` call, no `.filter()`/`.reduce()` over page rows, no `Math.round` fabrication — asserted in spec and confirmed in the code.

---

## 19. Search

Server-side `search` (code/number/referenceNumber, insensitive) via the same `/orders` request. Debounced **~350 ms**; Enter commits immediately; clear → `page=1`; value synchronised to `?search=`; typing is never blocked by the busy indicator; no client-side row filtering.

---

## 20. Filters

Toolbar exposes only server-supported dimensions:

```text
[ Search ][ Lifecycle status (12 options) ][ Payment status (4 options) ]
```

Backend-supported `customerId`, `acquisitionSource` and the detector scopes (`cancelledWithin`, `paymentFailed`, `pendingRefund`) are not invented as UI controls — `customerId`/`acquisitionSource` have no registry toolbar presence by design (list is scoped to MARKETPLACE platform scope by the backend default), and detector scopes remain deep-link driven (§16). No unsupported business dimension is invented.

---

## 21. Period

Verified repository truth: `/orders` supports `dateFrom` (gte, inclusive) and `dateTo` (lt, **exclusive**) on `createdAt` — half-open `[from, to)`, consistent with the Analytics contract (backend comment R5-03). Because the KPI aggregates and the table share that same `where`, the From/To controls **are exposed** (unlike Requests, where KPI parity is absent). Date inputs synchronise to `?dateFrom=` / `?dateTo=` and refresh KPI + table together. No invented Date-Type selector (only `createdAt` exists).

Timezone semantics are those of the backend: raw date values (`YYYY-MM-DD`) parsed by the API as `Date`; the frontend passes the input value through unmodified — parity of KPI and table is guaranteed by the single shared query.

---

## 22. URL State

Implemented subset (all actually supported by the backend):

```text
?search=  &status=  &paymentStatus=  &dateFrom=  &dateTo=  &page=
```

Verified behaviors: direct URL, reload restore, Back/Forward restore, KPI click → URL write, filter/search change → `page=1`, Reset normalizes URL, no update loop (single `replaceState` writer, no popstate listener). Deep-link detector params (`cancelledWithin`/`paymentFailed`/`pendingRefund`) and `sortBy`/`sortDirection` remain URL-preserved.

---

## 23. Toolbar / Reset

Canonical order implemented and asserted (index-ordered in spec + browser):

```text
[ Search ][ Lifecycle status ][ Payment status ][ From ][ To ][ Reset ][ CSV ][ XLSX ]
```

- **Reset** clears search + status + paymentStatus + From/To, `page → 1`, and normalizes the URL; disabled while no toolbar filter is active. Documented + tested.
- Export (`TableExportButton`) sends the same active server filters: `status`, `paymentStatus`, `dateFrom`, `dateTo`, `search`, plus any active detector scope.
- Busy indicator «Загрузка…» does not block typing.

---

## 24. Table Preservation

The Orders business table is preserved:

- Column semantics, sortable headers, row navigation (`/app/orders/[id]`), the 👁 quick-preview side panel, action execution and history rendering are unchanged.
- D5 order actions still run only through `PATCH /orders/{id} { action }` behind `availableActions` — no authority change.
- D7 stays the backend financial authority — amounts render as server strings via locale-aware formatting, never recomputed client-side.
- `TH-…` vs `ORD-…` identifier question is explicitly outside this stage (unchanged).
- Empty-state `colSpan` corrected to the real column count while preserving detector columns.

---

## 25. Formatting / Labels / i18n

- Single canonical localized label source per status: KPI card, filter option, table badge, detail badge and history badges all resolve through `order.status.<CODE>` / `order.payment.<CODE>` (the same keys `StatusBadge` maps by default; the registry passes them explicitly for one-source guarantee).
- New group headings under `orders.group.*` with RU/AZ/EN parity («Жизненный цикл» / «Альтернативные / rework» / «Исключения» / «Статус оплаты»).
- Dates and money are locale-aware via `LOCALE_TAGS[locale]` (BCP-47), no hardcoded `ru-RU` cell formatting anywhere in the page.
- No raw enum text is visible (browser-scanned).

---

## 26. Loading / Empty / Error

- Loading: shared `OperationsLoadingState` skeleton on first load; the toolbar busy chip never fakes KPI zeros (cards render from server aggregates only).
- Empty: shared `OperationsEmptyState` distinguishes no-orders vs no-results-for-filters through the active-filter state (`orders.empty` copy + empty-state row spans the real column count).
- Error: shared localized `OperationsErrorState` with Retry; no backend stack trace reaches the surface.

---

## 27. Accessibility

- All KPI cards are real `<button>`s with `aria-pressed` selected state, keyboard reachable and visibly focusable.
- Lifecycle flow container is an `<ol aria-label>` with a meaningful accessible name.
- Connectors are decorative: `aria-hidden`, `focusable="false"`, never interactive.
- Toolbar controls carry `aria-label`s (search, status, payment, From/To).
- No click-only divs introduced; card hit targets are unchanged (cards stay full-width buttons in their cells/flow widths).

---

## 28. Responsive

Mandatory widths 1680 / 768 / 390 browser-verified on `/app/orders`:

- Total, lifecycle, rework, exceptions, payment group, toolbar, table and pagination render with **no page-level horizontal overflow** at any of the three widths (measured overflow 0px).
- Lifecycle row: 6-across with 5 visible connectors at 1680 (xl); wraps cleanly (0 visible connectors) at 768 and 390 — cards never reorder and no cross-row connector geometry appears.
- All 16 status/payment cards remain present at every width.

---

## 29. Focused Tests

New `frontend/lib/orders-registry.spec.tsx` — **54 tests** mapping the §27 gates:

1–2. 12/12 OrderStatus visible + canonical semantic grouping (lifecycle 6 / rework 3 / exceptions 3 partition the enum) ✓
3–4. rework + exception states visible ✓
5–6. no false transition into `READY_TO_CLOSE`; no false exception sequence (connector markup confined to happy path; rework/exceptions carry none) ✓
7–8. 4/4 OrderPaymentStatus visible; separate dimension ✓
9–10. lifecycle KPI → server `status`; payment KPI → server `paymentStatus` ✓
11–12. selected lifecycle / selected payment card state (`aria-pressed`) ✓
13. Total reset behavior ✓ · 14. page reset after search/filter ✓
15–16. URL write + restore/direct URL ✓ · 17. Back/Forward ✓ (plus browser)
18. server-side search (debounce 350, Enter, no client filter) ✓
19. period behavior exposed + `[from,to)` params shared with aggregates ✓
20. KPI/table same-scope (single `/orders` fetch; no `/orders/kpi`, `.filter`, `.reduce`) ✓
21. no client KPI counting ✓ · 22. no raw enums ✓ · 23. RU/AZ/EN ✓
24–26. loading / empty / error shared primitives ✓
27. responsive composition classes (flow wrap + registry grids) ✓
28. Requests regression + D5/D7 preservation (separate suites + static guards) ✓

Existing pinned suites re-run green: Operations Center shell 19/19, Requests registry 51/51, request-center 56/56, commerce detail-system 44/44 → **224/224**.

---

## 30. Regression Tests

```text
frontend typecheck                       ✓ (tsc --noEmit, clean)
frontend build                           ✓ (next build)
focused Orders registry tests            54/54 ✓
Operations Center shell tests            19/19 ✓
Requests registry tests                  51/51 ✓
request-center tests                     56/56 ✓
commerce detail-system tests             44/44 ✓
frontend full suite                      514 passed / 515
                                          → 1 pre-existing failure: i18n.spec
                                            formatPrice NBSP (U+00A0 vs space) —
                                            identical to the baseline documented in
                                            UI-C1.2B (ec85deb) and R2/R3; the
                                            formatPrice implementation was not touched.
```

**Backend regression (D5/D6/D7):** backend tree has an **empty diff** for this stage (proven below), so no backend behaviour can have changed. A D5-order-module run was executed for the record:

```text
backend jest src/modules/order src/modules/booking
  → 18 passed / 2 failed in order/commerce-chain.invariants.spec.ts
```

The two failures are **pre-existing seed-data/identifier-contract mismatches** against the running demo DB (expects `referenceNumber ~ /^MKT-ORD-\d+$/` and `commerceSequence ~ /^\d{8}$/` on seeded rows; the demo dataset uses the ORD-/TH- identifier family that UI-C1.2C §19 explicitly places outside this stage). Same class of pre-existing drift was reported in UI-C1.2A §24. No D6 (booking) specs were matched by the module filter; D7 finance suites were not re-run because the finance code is untouched and was already demonstrated failing from environmental drift at baseline (UI-C1.2A §24).

```text
git diff --stat -- backend   → (empty)
```

---

## 31. Browser Qualification

`backend/tmp_c12c_browser_verify.py` — **34/34 PASS** on live `/app/orders` (admin role):

- shell «Центр операций» + Заказы active · «Всего заказов» Total · 4 group headings (RU) · card sequence 6+3+3+4 (16 cards in canonical order, no raw enums) · 5 connectors visible at 1680 · From/To inputs (2) · Reset present
- lifecycle click → `?status=IN_PROCESSING` + `aria-pressed` + server table refresh; payment click → `?paymentStatus=PAID` (no `status`); Total click normalizes URL
- direct URL `?status=READY_FOR_BOOKING` restores selection · Back restores `?status=NEW` · debounced search writes `?search=` · Reset clears & normalizes · `?dateFrom=&dateTo=` restores From/To inputs
- RU / AZ / EN render (shell + group headings + Total) with no raw keys in the DOM
- 390 / 768 / 1680: no page-level horizontal overflow (0px), connectors visible only at ≥1280 (0/0/5), 16 status/payment cards present at each width

Screenshots + results JSON → `docs/evidence/c12c/`.

---

## 32. Status Coverage Matrix

| OrderStatus | Visible KPI | Group | Localized label (RU) | Filter param | Count source |
|---|---|---:|---|---|---|
| NEW | YES | lifecycle | Новый | status=NEW | server |
| IN_PROCESSING | YES | lifecycle | В обработке | status=IN_PROCESSING | server |
| WAITING_FOR_DATA | YES | rework | Ожидание данных | status=WAITING_FOR_DATA | server |
| READY_FOR_BOOKING | YES | lifecycle | Готов к бронированию | status=READY_FOR_BOOKING | server |
| SENT_TO_BOOKING | YES | lifecycle | Отправлен в бронирование | status=SENT_TO_BOOKING | server |
| PARTIALLY_FULFILLED | YES | rework | Частично выполнен | status=PARTIALLY_FULFILLED | server |
| FULFILLED | YES | lifecycle | Выполнен | status=FULFILLED | server |
| READY_TO_CLOSE | YES | rework | Готов к закрытию | status=READY_TO_CLOSE | server |
| CLOSED | YES | lifecycle | Закрыт | status=CLOSED | server |
| CANCELLED | YES | exception | Отменён | status=CANCELLED | server |
| PROBLEM | YES | exception | Проблема | status=PROBLEM | server |
| SUSPENDED | YES | exception | Приостановлен | status=SUSPENDED | server |

All 12 = **YES**. AZ/EN labels resolve from the same `order.status.*` keys (spec-verified).

---

## 33. Payment Coverage Matrix

| OrderPaymentStatus | Visible KPI | Localized label (RU) | Filter param | Count source |
|---|---:|---|---|---|
| UNPAID | YES | Не оплачен | paymentStatus=UNPAID | server |
| PARTIALLY_PAID | YES | Частично оплачен | paymentStatus=PARTIALLY_PAID | server |
| PAID | YES | Оплачен | paymentStatus=PAID | server |
| REFUNDED | YES | Возврат | paymentStatus=REFUNDED | server |

All 4 = **YES**.

---

## 34. KPI/Table Scope Matrix

| Filter | Table scope | Lifecycle KPI scope | Payment KPI scope | Same backend semantics? | UI exposed? |
|---|---|---:|---:|---:|---:|
| Search | `/orders where.search` | same `where` | same `where` | YES | YES |
| Lifecycle status | `/orders where.status` | same `where` | same `where` | YES | YES |
| Payment status | `/orders where.paymentStatus` | same `where` | same `where` | YES | YES |
| Date (createdAt `[from,to)`) | `/orders where.createdAt` | same `where` | same `where` | YES | YES |
| Detector (cancelledWithin/paymentFailed/pendingRefund) | `/orders where` (deep link) | same `where` | same `where` | YES | NO (deep-link scopes, §16) |
| customerId / acquisitionSource | backend-supported | — | — | YES | NO (not invented) |

No exposed filter falsely implies unsupported KPI parity; period is exposed only because parity is real (single `/orders` query serves aggregates + table).

---

## 35. Before / After Evidence

Evidence in `docs/evidence/c12c/`:

| File | Content |
|---|---|
| `c12c_before_orders_desktop.png` | **BEFORE** — transitional UI-C1.2A Orders registry (flat 12-status grid under one «Статусы» header + payment grid) |
| `c12c_orders_desktop.png` | **AFTER** — desktop 1680: Total + Жизненный цикл flow (connectors) + rework + exceptions + payment + toolbar/table |
| `c12c_orders_1680.png` | AFTER full-page @1680 |
| `c12c_orders_768.png` | AFTER @768 (flow wrapped, no connectors) |
| `c12c_orders_390.png` | AFTER @390 (2-col wrap) |
| `c12c_browser_results.json` | 34 qualification check records |

The visible production UI change (flat transitional grid → grouped semantic composition with truthful lifecycle flow) is proven by these screenshots and the 34/34 browser checks. No screenshot-reference matching was required or performed (§3/§4).

---

## 36. Security Preservation

- Server-side RBAC unchanged — `GET /orders` and `GET /orders/export` still require `order.read` via `PermissionsGuard`; UI hiding is not a security boundary.
- Workspace/tenant isolation, `MARKETPLACE` default scope and storefront deny semantics are untouched backend behaviour.
- D5 order-action authority: actions still execute via `PATCH /orders/{id}` behind server `availableActions` — unchanged.
- D6/D7 authorities untouched (no backend diff). Audit immutability untouched.

---

## 37. Requests Regression

`/app/requests` is untouched by this stage (no file change). Verified:

- Requests registry spec 51/51 green (Total «Всего заявок», 12/12 RequestStatus cards, `requests.kpi.*` single-source labels, URL state, date hidden while Requests KPI period parity is absent, Reset, server filtering).
- request-center 56/56 green; full suite green except the documented pre-existing `formatPrice` baseline.
- Live browser pass in the C1.2C qualification: Back navigation into `/app/requests` and locale switches rendered correctly.

---

## 38. Non-Scope Verification

Not implemented (verified by diff + code inspection):

```text
reference-image/card-shape reproduction       — deferred by product decision (§3)
pixel-perfect screenshot matching             — none performed
UI-C1.2D Bookings migration                   — not started
UI-C1.2E backend/read-model stage             — not started
UI-C1.2F Payments migration                   — not started
UI-C1.2G–K cross-domain closure               — not started
UI-C2                                       — not started
D8                                         — not started
pricing/commission redesign                   — none
TH-* vs ORD-* identifier redesign             — none
new statuses / new transitions                — none
```

---

## 39. Git Hard Closure

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

```text
porcelain = empty
HEAD == origin/master
one canonical 40-char SHA
```

FINAL SHA (implementation): `0ae7dc9ba866f6c6a9238e04a9ccc4cf53a37dd2`

---

## 40. Final Verdict

```text
VERDICT A — UI-C1.2C
ORDERS REGISTRY MIGRATION
PRODUCTION IMPLEMENTATION ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — ACCEPTED
UI-C1.2A — ACCEPTED
UI-C1.2B — ACCEPTED

UI-C1.2C — ACCEPTED

FINAL SHA: 0ae7dc9ba866f6c6a9238e04a9ccc4cf53a37dd2

ORDER STATUS KPI COVERAGE — 12/12
ORDER PAYMENT KPI COVERAGE — 4/4
LIFECYCLE SEMANTICS — PASS
NO FALSE TRANSITIONS — PASS
KPI/TABLE SERVER SCOPE — PASS
VISIBLE UI CHANGE — CONFIRMED

REFERENCE-MATCH CARD DESIGN — DEFERRED BY PRODUCT DECISION

UI-C1.2D — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2D — BOOKINGS REGISTRY MIGRATION
```

---

## 41. TRUE NEXT

```text
UI-C1.2D — BOOKINGS REGISTRY MIGRATION
```

Bookings keeps its 13-status branching machine and D6 semantics; expected to reuse the same semantic-group composition, single-source labels (`booking.status.*`), URL state and KPI/table scope pattern established here and in UI-C1.2B.
