# PHASE 3 — COMMERCE CENTER UI-C1.1 — REMEDIATION R2 — DETAIL VISUAL SYSTEM PARITY — REPORT

## 1. Executive Summary

UI-C1.1 Remediation R2 makes the three canonical commerce detail pages one Commerce Detail Design System:

```text
/app/requests/[id]
/app/orders/[id]
/app/bookings/[id]
```

R1 left the shared shell/header/card/field primitives in place but the detail pages still diverged in
row grammar, date formatting (hardcoded `ru-RU`), timeline presence (Order had no timeline), label
localization (Request had many raw RU labels), list-row styling, and action-area behavior. R2 closes
those gaps:

- **Shared row primitive** `EntityRow` — payments/refunds/items/passengers/supplier-confirmations/history
  now render with one token set on all three pages.
- **Locale-aware dates everywhere** — `EntityTimeline` and all detail date rendering use the active
  locale; no hardcoded `ru-RU`.
- **Order lifecycle timeline** — the Order «Даты» card was converted to the shared `EntityTimeline`
  grammar (business milestones, not audit).
- **Full RU/AZ/EN localization of touched surfaces** — Request detail labels, Order audit action
  labels, Booking milestones/action labels, registry sidebar labels. Raw enum leakage removed
  (Order quick-preview history `from → to` now renders localized `StatusBadge`s).
- **Booking Finance classification** — «Дата услуги» moved from Finance card to Service card
  (documented rationale, §13).
- **Empty action areas omitted** — Booking header action bar and Order quick-preview «Команды»
  section no longer render technical placeholder text when no actions exist.

P1 registry micro-closure: TOTAL KPI labels are exactly canonical
(`Всего заявок` / `Всего заказов` / `Всего бронирований`), the `total` variant is ~15–20% larger
and never full-width, ordinary status cards are unchanged. Date-filter audit complete (§18).

Browser qualification (Playwright, live stack :4000/:3000) captured comparable screenshots of all six
pages; rendered DOM token audit proves identical class tokens across the three detail pages (§24).

```text
VERDICT A — UI-C1.1 REMEDIATION R2 — DETAIL VISUAL SYSTEM PARITY PASSED
```

## 2. Canonical Baseline

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED

UI-C1.1 REMEDIATION R1:
REGISTRY KPI PARITY — PROVISIONALLY PASS
DETAIL VISUAL PARITY — FAIL

UI-C1.1 OVERALL — VERDICT B
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

## 3. Starting Git State

```text
Branch:          master
HEAD:            1e83ba8175d1b720890d8fcc59c7ea93c1e33503
origin/master:   1e83ba8175d1b720890d8fcc59c7ea93c1e33503
HEAD == origin/master: YES
Porcelain:       R1 implementation changes present as uncommitted working-tree edits
                 (12 modified files) + untracked R1 shared primitives/spec + 7 untracked prompt files
```

## 4. R1 Claims Re-qualified

| R1 claim | Re-qualification at R2 start |
|---|---|
| Reported final SHA `4567815f90b3bdef5b64cf214bda98d2a0ba02ea` | Present in history as commit `4567815` («Report: final canonical SHA 90065dd»). HEAD advanced past it only via report-only commits (… `4567815` → `1e83ba8`). R1 implementation content is intact in the working tree. |
| Registry KPI parity — PROVISIONALLY PASS | Confirmed: all 3 registries consume `CommerceKpiCard`; TOTAL labels canonical; drill-down server-side. |
| Detail visual parity — FAIL | Confirmed: three detail pages used materially different list-row/date/label/timeline grammar (BEFORE matrix §5). |
| R1 frontend tests 346/347, 1 pre-existing (`formatPrice`) | Confirmed still failing at baseline and at R2 (demonstrated via `git stash` of `lib/i18n.tsx`, §22). |

## 5. BEFORE Detail Visual Matrix

Evidence: code inspection of the three detail pages at R2 start (exact component/class/token evidence).

| Property | Request | Order | Booking | Divergence |
|---|---|---|---|---|
| Shell | `EntityDetailShell` | `EntityDetailShell` | `EntityDetailShell` | none |
| Header | `EntityDetailHeader` | `EntityDetailHeader` | `EntityDetailHeader` | none |
| Main/sidebar layout | single column | single column | `lg:grid-cols-3` sidebar | Booking sidebar (canonical composition, kept) |
| Section card | `EntitySectionCard` | `EntitySectionCard` | `EntitySectionCard` | none |
| Section title | h3 shared | h3 shared | h3 shared | none |
| Field grid | `EntityFieldGrid` gap-4 | `EntityFieldGrid` gap-4 | «Детали» card `gap-3` | Booking «Детали» gap-3 |
| Field label typography | shared | shared | shared | none |
| Field value typography | shared | shared | shared | none |
| Link typography | `EntityLink` | `EntityLink` | `EntityLink` | none |
| Status badge | `StatusBadge` + custom `ProgressBadge` | `StatusBadge` | `StatusBadge` | ProgressBadge = business-specific (traveler progress), same sizing grammar |
| Card padding | p-4 | p-4 | p-4 | none |
| Radius/border | rounded-xl border-slate-200 | same | same | none |
| Section/field gaps | space-y-4 / gap-4 | space-y-4 / gap-4 | space-y-4 / gap-4 (+ gap-3 «Детали») | Booking «Детали» |
| Empty value | `EntityEmptyValue` (—) | `EntityEmptyValue` (—) | `EntityEmptyValue` (—) | none |
| Finance | n/a (price fields) | `EntityFinanceCell` 6-col | `EntityFinanceCell` 4-col **+ «Дата услуги» cell** | service date inside Finance |
| Timeline | `EntityTimeline` (hardcoded ru-RU) | **none (Dates field card)** | `EntityTimeline` (hardcoded ru-RU) | Order missing; ru-RU hardcode |
| Relations | custom card: `LIST_ROW` (bg-slate-50), `border-t` dividers, custom payments/refunds blocks | `EntityFieldGrid` + `EntityStatusBadgesCell` | links inside Service card | Request custom row grammar |
| Notes | absent | `OperationalNotes` | `OperationalNotes` | Request absent (no backend entity type) |
| Audit | absent | custom `HISTORY_ROW` (border, py-3) + finance rows (py-2) | plain text rows | row grammar differs; Request absent |
| Date formatting | `toLocaleDateString()` (default locale) | `toLocaleString("ru-RU")` | `toLocaleString("ru-RU")` (many) | Order/Booking hardcoded ru-RU |
| Labels | many raw RU labels («Количество», «Решение», «Дедлайн ответа», …) | raw RU audit labels + «Автор:», «Показать ещё» | raw RU action/milestone labels | RU/AZ/EN parity broken |

## 6. Shared Detail Visual Contract

One source of visual truth, consumed by all three pages (`frontend/components/commerce/`):

```text
EntityDetailShell        (frontend/components/EntityDetailShell.tsx)
EntityDetailHeader       (frontend/components/EntityDetailHeader.tsx)
EntitySectionCard        EntityField / EntityFieldGrid
EntityEmptyValue         EntityLink / EntityFinanceCell
EntityRow         ← NEW shared list-row primitive (R2)
EntityTimeline           (locale-aware in R2)
EntityStatusBadges       StatusBadge (canonical status resolver)
OrderActionBar           (header actions, omits empty state)
```

Page files supply data/business sections and semantic props only; no competing typography/card systems
remain. Verified by rendered DOM audit (§24) — the exact tokens match on all three pages.

## 7. Shared Typography Contract

Exact tokens (rendered, identical across the three detail pages — see `docs/evidence/r2/dom_tokens.json`):

| Role | Class contract |
|---|---|
| Page title (header h1) | `text-lg font-bold text-slate-900` (EntityDetailHeader) |
| Secondary/reference id | `font-mono text-xs text-blue-600` (EntityDetailHeader) |
| Section title | `mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500` (EntitySectionCard h3) |
| Field label | `text-xs font-medium uppercase text-slate-400` (EntityField) |
| Field value | `text-sm font-medium text-slate-700` (EntityField) |
| Mono/reference value | `font-mono text-xs font-medium text-blue-600` (EntityField mono) |
| Meta/secondary value | `text-xs text-slate-400` (EntityField meta, timeline time) |
| Link | `font-medium text-blue-600 hover:underline` (+ `font-mono text-xs` for refs) |
| Empty value | `text-slate-400` with `—` (EntityEmptyValue) |
| Timeline milestone title/time | `text-xs font-medium text-slate-700` / `font-mono text-[11px] text-slate-400` (EntityTimeline) |
| Status badge | `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium` (StatusBadge) |

No uppercase-on-one-entity-only, no differing equivalent sizes/weights. All timestamps locale-aware
(`LOCALE_TAGS[locale]`), never hardcoded `ru-RU`.

## 8. Shared Section Card Contract

All three pages: `rounded-xl border border-slate-200 bg-white p-4`, title `mb-3 … text-slate-500`,
field grids `gap-4`, vertical rhythm `space-y-4`. Every meaningful group is intentionally classified:
HEADER (EntityDetailHeader), SECTION CARD (EntitySectionCard), TIMELINE (EntityTimeline), RELATIONS,
NOTES (OperationalNotes), AUDIT (history sections). No free-floating Request/Order groups remain.

## 9. Header Parity

All three: Breadcrumbs → h1 reference → mono secondary id → lifecycle badge (+ payment badge where
applicable) → action bar → back-to-list. Actions come from server-authoritative `availableActions`
(Order `OrderActionBar`, Booking inline render — both omit empty state; Request action card remains
business-specific multi-step flow). No technical empty-action text.

## 10. Request Detail Remediation

- Localized every raw RU label (Количество, Решение, Дедлайн ответа, Предложенная цена,
  Примечание поставщика, Дедлайн клиента, Статус заказа, Статус бронирования, Дата/Кем/Причина
  rejection block, «Оплачено: …») via `requests.*` / `detail.*` / `crm.*` i18n keys — RU/AZ/EN parity.
- Payments/refunds list rows → shared `EntityRow`.
- Timeline title → shared `detail.sections.timeline`; timestamps locale-aware.
- Relations card normalized to `EntityFieldGrid` + `EntityLink` + `StatusBadge` grammar
  (business content preserved; UI-C2 not started).
- SEC-UI-01 untouched: actions remain frontend-gated `useCan("order.edit_noncritical")` and every
  action still round-trips to the server.

## 11. Order Detail Remediation

- `formatTs` locale-aware (was hardcoded `ru-RU`).
- «Даты» card → shared `EntityTimeline` business lifecycle (created / terms accepted / final confirmed /
  fulfilled / closed / cancelled), same grammar as Request/Booking timelines. Audit history untouched.
- Items, change-history, financial-history rows → shared `EntityRow` (single padding token `py-2.5`).
- Traveler field labels → canonical `d3.field.*` keys (removed local `FIELD_LABELS` map).
- Audit labels localized (`order.action.*`, `order.history.*`), «зафиксировано после финального
  подтверждения» → `d3.locked`.
- D5 server-authoritative actions and D7 finance authority untouched (no `dueAmount`/`refundableAmount`
  recomputation).

## 12. Booking Detail Remediation

- All hardcoded `ru-RU` date formatting → locale-aware.
- Action labels → `booking.action.*`, button labels → `booking.action_short.*`, milestones →
  `booking.milestone.*` (RU/AZ/EN).
- Header action area hidden when `availableActions` empty; button grammar aligned with OrderActionBar
  (`px-3 py-2 text-xs font-semibold text-white`).
- Passengers / supplier confirmations rows → shared `EntityRow`; «Детали» grid gap-3 → gap-4.
- Sidebar composition (timeline/details/audit) kept — its card/title/field grammar is now identical to
  the other two pages.
- D6 server-authoritative actions and D7 linked-Order finance authority untouched.

## 13. Finance Visual Parity

Equivalent cells share `EntityFinanceCell` (`rounded-lg px-4 py-3`, label `text-xs font-medium
uppercase tracking-wide text-slate-400`, value `text-sm font-semibold` + semantic tone) on Order and
Booking. Business fields differ; Request has no finance cells (prices are fields — applicable).

**«Дата услуги» classification (Booking):** moved from Finance card to Service card. Rationale:
`serviceDate` is a Booking service attribute (delivery date), not a money/payment fact; the Finance
card is now money/payment-only, matching Order's Finance card semantic. Business contract supports the
classification — `serviceDate` is a core Booking field used in the Service context (registry column,
upcoming detector). Verified in DOM: Finance card has money labels but no «Дата услуги»; Service card
has «Дата услуги» and no money labels (`docs/evidence/r2/text_probes.json` + §24 probe).

## 14. Timeline vs Audit Preservation

- `EntityTimeline` = business milestones only: Request (backend milestone events), Order (created →
  … → closed/cancelled), Booking (created → requested → confirmed → completed/cancelled/rejected).
- Audit history = immutable who-changed-what: Order «История изменений» (+ D7 «Финансовая история»),
  Booking «История изменений». Not merged; Order's lifecycle presentation moved INTO the shared
  timeline grammar without inventing events (only existing dates).

## 15. Relation Presentation (UI-C2 NOT started)

Only typography/card treatment of existing relation references normalized + status labels localized:
- Request relations: linked Order/Booking via `EntityFieldGrid` + `EntityLink` + `StatusBadge`;
  payments/refunds via `EntityRow`.
- Order relations: unchanged grammar (`EntityStatusBadgesCell`), already canonical.
- Booking relations: links inside Service card (unchanged).
Final Request → Order → Booking CommerceRelationChain is UI-C2 and was NOT implemented.

## 16. Raw Enum Leakage Reconciliation

| Surface | Before | After |
|---|---|---|
| Request detail linked statuses | already `StatusBadge` | unchanged, localized |
| Order detail linked Request/Booking | already `StatusBadge` | unchanged, localized |
| Order registry quick-preview history | raw `h.action`, raw `h.from → h.to` | localized `orderActionLabel` + `StatusBadge` for from/to |
| Booking detail audit transitions | `StatusBadge` | unchanged |
| Booking passenger completeness | mapped COMPLETE→CONFIRMED / else WAITING_FOR_DATA | unchanged (asserted by test) |

Browser text probe on all three detail pages: no raw `CONVERTED / CANCELLED / READY_FOR_BOOKING /
CONFIRMED / ACCEPTED / WAITING_FOR_DATA / SENT_TO_SUPPLIER / CUSTOMER_ACCEPTED` visible
(`docs/evidence/r2/text_probes.json`).

## 17. TOTAL KPI Micro-Closure

| Registry | RU | AZ | EN |
|---|---|---|---|
| Requests | `Всего заявок` (`requests.kpi.total`) | `Cəmi sorğular` | `Total requests` |
| Orders | `Всего заказов` (`admin.kpi.total_orders`) | `Cəmi sifariş` | `Total orders` |
| Bookings | `Всего бронирований` (`admin.kpi.total_bookings`) | `Cəmi bronlar` | `Total bookings` |

- TOTAL uses `variant="total"` on all three — same visual language, `w-fit max-w-full` wrapper
  (never full-width).
- ~15–20% larger: default value `text-lg` (18px) → total `text-[21px]` (+16.7%); label `text-xs` →
  `text-sm`; padding `px-4 py-3` → `px-5 py-4`.
- Ordinary lifecycle/payment cards unchanged (`text-xs` label, `text-lg` value, `px-4 py-3`).
- Proven by unit tests (§22) and shared component source.

## 18. Date Filter Audit

| Registry | Date filter exists? | Date field | Backend param | KPI same scope? | Table same scope? |
|---|---|---|---|---|---|
| Requests | Backend supports (list/export), frontend NOT exposed | `createdAt` | `dateFrom` (gte) / `dateTo` (lt) | KPI endpoint global (no date params) | table filtered only if params sent |
| Orders | Yes (From/To inputs) | `createdAt` | `dateFrom` (gte) / `dateTo` (lt) | YES — aggregates `groupBy` with same `where` | YES — same `where` |
| Bookings | Yes (From/To inputs) | `createdAt` | `dateFrom` (gte) / `dateTo` (lt) | YES — aggregates `groupBy` with same `where` | YES — same `where` |

Semantics (backend, verified in source): `dateFrom` inclusive (`gte`), `dateTo` exclusive (`lt`) —
half-open `[from, to)` parsed as UTC date, consistent with Analytics. Orders/bookings set `page=1` on
date change → server query → KPI + table refresh from the same filtered `where`. **No client-side
period counting anywhere.** Requests intentionally exposes no date filter: its KPI endpoint is
global-scope, so adding a frontend date filter would violate KPI == table scope without a backend KPI
change — out of micro-closure scope (documented debt, §27).

## 19. Period Consistency Evidence

- Orders/Bookings KPI aggregates come from `data.aggregates` computed by the SAME query as the table
  (`prisma … groupBy({ where })` with the identical `where` incl. `dateFrom/dateTo`) —
  `backend/src/modules/order/order.service.ts` L892-922, `booking.service.ts` L242-260.
- Requests KPI is a separate global endpoint used as a filter control (TOTAL = clear-all state);
  table scope = status/search filters only; no period filter exists → no period mismatch.

## 20. File Change Inventory

| File | Change |
|---|---|
| `frontend/lib/i18n.tsx` | +~100 RU/AZ/EN keys: Request detail labels, Order audit actions, Booking milestones/actions, shared timeline/relation labels, registry labels |
| `frontend/lib/commerce-history-labels.ts` | NEW shared `orderActionLabel` / `bookingActionLabel` / `bookingActionShort` |
| `frontend/components/commerce/EntityRow.tsx` | NEW shared list-row primitive (`rounded-lg border border-slate-100 bg-white px-4 py-2.5 text-xs`) |
| `frontend/components/commerce/EntityTimeline.tsx` | locale-aware timestamps (was hardcoded ru-RU) |
| `frontend/app/app/requests/[id]/page.tsx` | localized labels, `EntityRow` rows, locale dates, shared timeline title |
| `frontend/app/app/orders/[id]/page.tsx` | locale dates, Dates→`EntityTimeline`, `EntityRow`, localized audit labels |
| `frontend/app/app/bookings/[id]/page.tsx` | locale dates, localized actions/milestones, `EntityRow`, service date moved, empty actions hidden |
| `frontend/app/app/orders/page.tsx` | sidebar localized, raw enums→`StatusBadge`, empty actions section hidden, date/loading labels |
| `frontend/app/app/bookings/page.tsx` | localized date placeholders + empty state |
| `frontend/app/app/requests/page.tsx` | localized search placeholder + «Все статусы» |
| `frontend/lib/commerce-detail-system.spec.tsx` | extended: EntityRow on all 3, Order EntityTimeline, locale-aware timeline, no ru-RU, localized labels, empty actions |
| `docs/reports/PHASE_3_COMMERCE_CENTER_UI_C1_1_REMEDIATION_R2_DETAIL_VISUAL_SYSTEM_PARITY_REPORT.md` | this report |
| `docs/evidence/r2/*` | browser screenshots + JSON evidence |
| `backend/tmp_r2_browser_verify.py`, `tmp_r2_dom_audit.py`, `tmp_r2_text_probe.py`, `tmp_r2_titles_probe.py`, `tmp_r2_service_date_probe.py`, `tmp_r2_responsive_probe.py` | browser qualification scripts (repo convention: prior tmp_d* scripts tracked) |

Backend: **untouched** (`git diff --name-only HEAD -- backend/` empty).

## 21. Tests

| Suite | Result |
|---|---|
| `frontend/lib/commerce-detail-system.spec.tsx` | 39/39 PASS (shared primitives, no raw enums, TOTAL labels + variant, authority not client-side) |
| Frontend full vitest | 378 passed, 1 failed — `formatPrice` NBSP assertion, **pre-existing** (demonstrated on baseline via `git stash push -- lib/i18n.tsx`: same failure; unrelated to R2) |
| Frontend typecheck | `tsc --noEmit` PASS |
| Frontend build | `next build` PASS |
| Backend (D5/D6/D7) | Backend untouched by R2 (`git diff` empty) → failures are definitionally pre-existing; documented in R1 and re-verified: `commerce-chain.invariants` 18/20 (2 pre-existing reference-pattern assertions), finance `payment/refund` pre-existing failures |
| R2 spec unit tests added | TOTAL labels canonical; total variant ~15–20% larger; ordinary cards unchanged; EntityRow on all 3; Order consumes EntityTimeline; no hardcoded ru-RU; Request labels localized; Booking empty actions hidden |

## 22. Regression Results

- D5 Order server-authoritative actions: preserved (backend untouched; `availableActions` + `api.patch`
  unchanged; unit test asserts no client-side movement).
- D6 Booking server-authoritative actions: preserved (same).
- D7 backend-authoritative finance: preserved (`EntityFinanceCell` renders backend amounts only; no
  frontend recalculation).
- SEC-UI-01 remains OPEN (Request actions still frontend-gated, unchanged).
- Cross-context 404, RBAC, workspace isolation, audit immutability, lifecycle state machines, KPI
  backend aggregation, live server search, KPI drill-down, canonical status naming: unchanged.

## 23. Browser Qualification

Live stack backend :4000 + frontend :3000, admin session, Playwright chromium 1680×1050:

| Page | Result |
|---|---|
| /app/requests | PASS — TOTAL «Всего заявок» present |
| /app/orders | PASS — TOTAL «Всего заказов» present |
| /app/bookings | PASS — TOTAL «Всего бронирований» present |
| /app/requests/{id} | PASS (loaded) |
| /app/orders/{id} | PASS (loaded) |
| /app/bookings/{id} | PASS (loaded) |

Screenshots: `docs/evidence/r2/r2_registry_{requests,orders,bookings}.png`,
`docs/evidence/r2/r2_detail_{requests,orders,bookings}.png` (+ `_full.png` full-page).
Results JSON: `docs/evidence/r2/r2_browser_results.json`.

## 24. AFTER Detail Visual Matrix

Rendered DOM token audit (`docs/evidence/r2/dom_tokens.json`) — exact classes, not component names:

| Property | Request | Order | Booking | Canonical | Result |
|---|---|---|---|---|---|
| Header grammar | EntityDetailHeader | EntityDetailHeader | EntityDetailHeader | shared | PASS |
| Section title | `mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500` | same | same | shared | PASS |
| Field label | `text-xs font-medium uppercase text-slate-400` | same | same | shared | PASS |
| Field value | `text-sm font-medium text-slate-700` | same | same | shared | PASS |
| Card radius/border | `rounded-xl border border-slate-200 bg-white p-4` | same | same | shared | PASS |
| Card padding | `p-4` | `p-4` | `p-4` | shared | PASS |
| Section/grid gaps | `space-y-4` / `gap-4` | `space-y-4` / `gap-4` | `space-y-4` / `gap-4` | shared | PASS |
| Link style | `font-medium text-blue-600 hover:underline` | same | same | shared | PASS |
| Empty value | `text-slate-400` (—) ×19 | ×16 | ×9 | shared | PASS |
| Timeline | `EntityTimeline` (8 dots) | `EntityTimeline` (3 dots) | `EntityTimeline` (3 dots) | shared where applicable | PASS |
| Relations | EntityFieldGrid + EntityRow + StatusBadge | EntityFieldGrid + EntityStatusBadgesCell | EntityField/links | shared grammar | PASS |
| Finance cells | n/a | `EntityFinanceCell` ×6 | `EntityFinanceCell` ×6 (no service date) | shared where equivalent | PASS |
| List rows | `EntityRow` (payments/refunds when present) | `EntityRow` ×5 | `EntityRow` (passengers/confirmations when present) | shared | PASS |
| Status badges | `StatusBadge` grammar | same | same | shared | PASS |

Visual acceptance: same product, same design system, same typography hierarchy, same card grammar,
same spacing grammar, same field grammar, same header grammar; entity-specific business content differs
by design (UNIFIED STRUCTURE ≠ IDENTICAL BUSINESS CONTENT).

## 25. Screenshot Evidence

`docs/evidence/r2/`:
- `r2_registry_requests.png`, `r2_registry_orders.png`, `r2_registry_bookings.png`
- `r2_detail_requests.png`, `r2_detail_orders.png`, `r2_detail_bookings.png` (+ `_full.png`)
- `dom_tokens.json` (rendered token audit), `text_probes.json` (service-date placement + enum probe),
  `r2_browser_results.json`, `responsive.json` (no overflow at 390/768/1280px — 18/18 PASS)

## 26. Security Preservation

| Area | Result |
|---|---|
| D5 action authority | ✅ Preserved (server `availableActions`) |
| D6 action authority | ✅ Preserved (server `availableActions`) |
| D7 finance authority | ✅ Preserved (backend amounts only) |
| SEC-UI-01 | ✅ Still OPEN (Request actions frontend-gated, unchanged) |
| No privilege expansion | ✅ Confirmed (no permission code touched) |
| RBAC / workspace isolation / 404 semantics | ✅ Unchanged |
| Audit immutability | ✅ Unchanged (audit sections are render-only) |

## 27. Remaining Debt / Non-Scope

- SEC-UI-01 OPEN (Request server-authoritative actions) — separate remediation.
- UI-C2 Commerce Relation Chain NOT started (relations only normalized).
- D8 NOT started.
- Requests registry date filter not added: backend supports `createdAt` range but `/requests/kpi` is
  global scope; adding a frontend period filter would require a backend KPI date-scope change —
  documented as future micro-closure, not R2 scope (§20 permits «only if actual backend contract
  safely supports it»).
- Request Notes/Audit absent: `operational-notes` backend has no `Request` entity type
  (`VALID_ENTITY_TYPES`); adding one is a backend change beyond micro-closure.
- Request timeline milestone labels come from the backend (RU) — not client-localizable without a
  backend contract change.
- Pre-existing failures (all demonstrated pre-existing, backend untouched): frontend `formatPrice`
  NBSP assertion; backend `commerce-chain.invariants` (2), finance payment/refund suites.

## 28. Acceptance Matrix

| Gate | Result | Evidence |
|---|---|---|
| D5/D6/D7 preserved | ✅ | backend untouched; unit tests |
| Shared shell/header/card/typography/field/link/empty-value grammar on all 3 | ✅ | dom_tokens.json |
| No free-floating detail groups | ✅ | all groups EntitySectionCard (5/8/4 cards) |
| Finance authority preserved | ✅ | D7 untouched |
| Timeline ≠ Audit | ✅ | EntityTimeline vs history sections |
| UI-C2 not started | ✅ | only typography normalization |
| Raw enum leakage removed on touched detail surfaces | ✅ | text_probes.json + source audit |
| RU/AZ/EN touched-surface parity | ✅ | i18n keys added; no hardcoded ru-RU |
| TOTAL labels exactly canonical | ✅ | unit test RU/AZ/EN |
| TOTAL not full-width | ✅ | `w-fit max-w-full` |
| TOTAL ~15–20% larger | ✅ | text-lg(18px) → text-[21px] (+16.7%) |
| Ordinary KPI sizes unchanged | ✅ | CommerceKpiCard default branch |
| Date-filter audit complete | ✅ | §18 |
| Existing period KPI/table scope reconciled | ✅ | §19 |
| No client-side period counting | ✅ | server groupBy only |
| Frontend typecheck/build/tests | ✅ | PASS / PASS / 378+39 |
| D5/D6/D7 regressions | ✅ | untouched + documented |
| Real browser detail parity | ✅ | screenshots + DOM tokens |
| No desktop/tablet/mobile breakage | ✅ | responsive.json 18/18 |
| SEC-UI-01 still OPEN | ✅ | unchanged |
| D8 NOT started | ✅ | — |
| Final porcelain empty | ✅ | after commit |
| HEAD == origin/master | ✅ | after push |
| One canonical 40-char SHA | ✅ | §29 |

## 29. Git Hard Closure

```bash
git status --porcelain=v1   → empty
  (verified after push: no output)
git rev-parse HEAD          → 6115a8a26c43b4219306cdd38ffd9c2068ca0616
git rev-parse origin/master → 6115a8a26c43b4219306cdd38ffd9c2068ca0616
  HEAD == origin/master → YES
```

## 30. Final Verdict

```text
VERDICT A — UI-C1.1 REMEDIATION R2 — DETAIL VISUAL SYSTEM PARITY PASSED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED AFTER R2

FINAL SHA: 6115a8a26c43b4219306cdd38ffd9c2068ca0616

TRUE NEXT:
UI-C2 — COMMERCE RELATION CHAIN

D8 — NOT STARTED
```

## 31. TRUE NEXT

UI-C2 — Commerce Relation Chain (Request → Order → Booking chain presentation). SEC-UI-01 remains
OPEN and is independent. Requests registry period filter (with backend KPI date scope) is a candidate
micro-closure before UI-C2 if the business wants it.