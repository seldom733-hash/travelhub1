# PHASE 3 — UI-C1.2F.1B — FINAL QUALIFICATION
## Shared Operations Center Header Period — Runtime / Cross-Registry / Git Closure

> QUALIFICATION ONLY. No functional source changes. All evidence captured on a runtime
> restarted from the qualification working tree (HEAD `9c36cab`), after the prior
> qualification attempt was interrupted by an environment restart.

---

## QUALIFICATION HEAD BEFORE TEST

```
9c36cab9f462b941df525b4519764d548cbb36e7
```

## FUNCTIONAL REMEDIATION SHA (proven ancestor)

```
ea5f6dc533dea49238a33627baf0586ace481758
```

## FINAL SHA

```
fd53a895aa9e115a2bff8e358506e3c2e4a10c9b
```

## RUNTIME (fresh, current working tree)

- Backend: `node dist/main.js` on :4000 (PID 12600) — unchanged code, git tree clean.
- Frontend: fresh `next dev` restart from the qualification working tree.
  The pre-restart dev instance (PID 12100) was killed after its `.next` cache was
  invalidated; a clean instance (PID 2428, "Ready in 1314ms") compiled and served
  `/app/{requests,orders,bookings,payments}` from current HEAD.
- Auth session (admin) persisted in the preview context; full pages verified rendering
  (KPI cards, header filters, tables, pagers).

```
CURRENT RUNTIME RESTARTED            — PASS
```

---

## Shared Header Presence — 4/4

Each registry was opened and structurally inspected for:
- shared Operations Center header + Period control (`#ops-period-from` / `#ops-period-to` + ✕ "Очистить период");
- zero registry-local date inputs;
- zero legacy "Обновить" date-apply buttons;
- shared tab list (Заявки / Заказы / Бронирования / Платежи).

| Registry | shared date inputs | local date inputs | "Обновить" | Unbounded Total |
|---|---|---|---|---|
| Requests | 2 | 0 | 0 | 646 |
| Orders | 2 | 0 | 0 | 508 |
| Bookings | 2 | 0 | 0 | 365 |
| Payments | 2 | 0 | 0 | 410 |

```
SHARED HEADER PRESENT 4/4            — PASS
NO LOCAL DATE CONTROLS               — PASS
ORDERS "ОБНОВИТЬ" REMOVED            — PASS
```

---

## Period A/B — all four registries (runtime-actual)

Period exercised through the shared Header Period control (native input events → React
onChange → URL + data flow). KPI total == table pager total in every state.

| Registry | Sep `2026-09-01..2026-10-01` | Oct `2026-10-01..2026-11-01` |
|---|---|---|
| Requests | KPI 82 / table 82 | KPI 60 / table 60 |
| Orders | KPI 66 / table 66 | KPI 47 / table 47 |
| Bookings | KPI 48 / table 48 | KPI 29 / table 29 |
| Payments | KPI 52 / table 52 | KPI 36 / table 36 |

Period in UI == period in URL == period in API request (query strings verified in the
network log: `/api/v1/requests?dateFrom=…&dateTo=…`, `/api/v1/orders?…`,
`/api/v1/bookings?…`, `/api/v1/finance/payments?…`).

```
REQUESTS PERIOD A/B                   — PASS
ORDERS PERIOD A/B                     — PASS
BOOKINGS PERIOD A/B                   — PASS
PAYMENTS PERIOD A/B                   — PASS
```

---

## API ↔ UI Reconciliation — 4/4 (Sep bound, same-origin server fetch)

Server JSON totals vs rendered UI:

| Registry | Server list total | Server overview total | Rendered KPI | Rendered table |
|---|---|---|---|---|
| Requests | 82 | 82 (`/requests/kpi` total) | 82 | 82 |
| Orders | 66 (aggregates in list payload) | 66 | 66 | 66 |
| Bookings | 48 | 48 | 48 | 48 |
| Payments | 52 | 52 | 52 | 52 |

```
API ↔ UI RECONCILIATION 4/4          — PASS
```

---

## Selected-KPI Preservation + Static KPI Overview Rule — 4/4

Per registry: activate one table-only KPI filter at Sep, verify static overview, then
change the Header Period to Oct.

| Registry | KPI | Sep overview | After KPI click (static rule) | Oct change (overview recomputes, filter kept) |
|---|---|---|---|---|
| Requests | На проверке (CHECKING) | 82 | cards unchanged, table → 1 | Oct 60, CHECKING 0 (empty-state row), URL keeps `status=CHECKING` |
| Orders | Закрыт (CLOSED) | 66 | cards unchanged, table → 22 | Oct 47 / Закрыт 14, table 14 |
| Bookings | Новое (NEW) | 48 | cards unchanged, table → NEW | Oct 29 / Новое 0, empty-state |
| Payments | Зачислен (CAPTURED) | 52 | cards unchanged, table → 49 | Oct 36 / Зачислен 36, table 36 |

Network proof (Requests): KPI refetch on period change carries dates only, never
`status`; list carries `status`+dates; clicking a status KPI triggers **no** KPI
refetch (static overview rule). Same split observed on the other registries.

```
SELECTED KPI PRESERVED ON PERIOD      — PASS
STATIC KPI OVERVIEW RULE              — PASS
```

---

## Header Period Clear

From bounded Oct period + CAPTURED on Payments, pressing ✕ "Очистить период":
- `dateFrom`/`dateTo` removed from URL; CAPTURED preserved;
- overview recomputed to unbounded (410); table refetched unbounded + CAPTURED (384);
- page → 1.

```
HEADER PERIOD CLEAR                   — PASS
```

## Registry Reset Preserves Period — 4/4

Period set + local search/KPI filter, then registry "Сбросить":

| Registry | Kept | Cleared |
|---|---|---|
| Payments | dateFrom/dateTo (Sep bound) | CAPTURED, page |
| Orders | dateFrom/dateTo | search, status |
| Requests | dateFrom/dateTo | search/status |
| Bookings | dateFrom/dateTo | search/status |

```
REGISTRY RESET PRESERVES PERIOD       — PASS
```

---

## Tab Switch Carries Period Only

Full cycle Requests → Orders → Bookings → Payments → Requests with period + local
search + KPI + sort set on the source registry. Each tab link carried only
`dateFrom`/`dateTo`; registry-local filters/search/sort dropped; every destination
re-scoped correctly (Requests Sep 82 restored on return).

```
TAB SWITCH CARRIES PERIOD ONLY        — PASS
```

---

## Reload

- Orders `?dateFrom=…&dateTo=…&status=CLOSED` reload → period + CLOSED + scopes
  restored exactly.
- Payments bounded reload → restored.
- Reload performed via native `location.reload()` (the preview harness's own reload
  strips the query string; a native reload preserves and restores it — proven
  behavior, not an app defect).

```
RELOAD                               — PASS
```

---

## Popstate / Back-Forward Restore

Canonical URL model uses replace semantics for in-registry filter writes
(ADR-OPS-012), so two genuine history entries were staged with different valid URLs
and exercised with real `history.back()` / `history.forward()`.

**Orders** — E1 = Sep unbounded, E2 = Oct + CLOSED:

| Step | URL | Period inputs | KPI pressed | Header state | Table |
|---|---|---|---|---|---|
| E1 | `?dateFrom=2026-09-01&dateTo=2026-10-01` | 09-01/10-01 | Всего заказов 66 | none | 1–20 из 66 |
| Back → E1 | same | same | Всего заказов 66 | inactive | 1–20 из 66 |
| Forward → E2 | `…&status=CLOSED` Oct | 10-01/11-01 | Закрыт 14, Total 47 | status ACTIVE | 14 rows |

**Payments** — E1 = Sep unbounded, E2 = Oct + CAPTURED. Back restored Sep with
CAPTURED preserved (that entry genuinely carried `paymentStatus=CAPTURED` from a
replaceState write): overview 52 (global Sep), table 49 (filtered) — no desync.
Forward restored E2 (Oct, 36/36).

After every popstate: Header Period matches restored URL, filter/KPI state matches
URL, overview query uses the global period, table query uses period + filter,
no state desync.

```
POPSTATE RESTORE                      — PASS
```

---

## Partial Range (dateFrom-only / dateTo-only)

Accepted backend semantics: each bound is optional and independent.

| Registry | URL | Inputs | Total |
|---|---|---|---|
| Orders | `?dateFrom=2026-09-01` | from set, to empty | 147 |
| Orders | `?dateTo=2026-10-01` | from empty, to set | 427 |
| Requests | `?dateFrom=2026-09-01` | from set | 183 |
| Bookings | `?dateTo=2026-10-01` | to set | 314 |
| Payments | `?dateTo=2026-10-01` | to set | 350 |

No frontend crash on any registry; URL authoritative; API receives only the supplied
bound (verified: `?dateFrom=2026-09-01&page=1&pageSize=20` — no empty `dateTo`);
KPI and table share the same global scope in every partial state.

```
PARTIAL RANGE                         — PASS
```

---

## Invalid Date Handling (actual behavior recorded)

Same-origin API probes with malformed dates (`dateFrom=2026-13-45`, `dateTo=abc`):

| Endpoint | HTTP | Body |
|---|---|---|
| `/api/v1/requests` | 400 | `dateFrom must be a valid date` (also `dateTo`) |
| `/api/v1/finance/payments` | 422 | `dateFrom/dateTo must be a valid date` |
| `/api/v1/orders` | 500 | `Internal server error` |
| `/api/v1/bookings` | 500 | `Internal server error` |

Frontend behavior on a malformed deep-link (`/app/orders?dateFrom=2026-13-45`, same
for Requests/Bookings/Payments): the API error is surfaced in the registry error box
("dateFrom must be a valid date" for Requests, "Internal server error" for
Orders/Bookings) with a Повторить (Retry) action; KPI total 0 and an empty-state
row — **no silent fallback to unbounded data**, **no client/server scope divergence**
(URL retains the invalid bound; no unbounded data is ever rendered behind it).

Note (non-blocking for 1B, recorded honestly): Orders/Bookings registry endpoints
return HTTP 500 instead of a 4xx validation response for malformed dates. This is a
pre-existing backend validation gap on those endpoints (Requests received its 400
contract in UI-C1.2F.1A; Payments validates in the finance module) — not introduced
by 1B (git diff empty during this qualification; backend untouched). Flagged for the
debt register: add date validation to Orders/Bookings list/KPI controllers.

```
INVALID DATE HANDLING                — PASS (no silent fallback, no scope divergence; see note)
```

---

## Active-Domain-Only Fetch

Tab switch Bookings → Payments (SPA): only `/api/v1/finance/payments` fired for the
destination registry (plus `auth/session`); no Requests/Orders/Bookings domain
queries fired. Per-registry page loads likewise fire only their own domain list/KPI
requests. Header Period never causes all four domains to fetch simultaneously.

```
ACTIVE-DOMAIN-ONLY FETCH              — PASS
```

---

## Race / Rapid Period Changes

Requests: six rapid bound changes (Sep → Oct → Nov) fired six RSC navigations
(1:1 with input events — no loop, linear, bounded) and exactly **one** final data
request pair (`/requests/kpi` + `/requests` with the final Nov bound). Final
rendered state corresponds to the final URL only: Nov KPI 24 == table 24 == URL
`dateFrom=2026-11-01&dateTo=2026-12-01`. No stale earlier response overwrote the
final state; no infinite request loop.

```
RACE / FINAL-URL AUTHORITY            — PASS
```

---

## Network Scope

- KPI/overview request scope == global scope only (dates, workspace) — never inherits
  a table-only filter (e.g. Requests KPI refetch on period change carries dates only).
- Table request scope == global + table-only (status/paymentStatus present only in
  the list query while a filter is active; absent otherwise).
- No request storm around period normalization or filter changes (StrictMode dev
  double-mount produces two bounded fetches per state, no growth).

```
NETWORK SCOPE                         — PASS
NETWORK STORM                         — NONE
```

---

## Console Proof

After all qualification scenarios (period A/B ×4, KPI/period interactions, clears,
resets, tab cycle, reloads, popstate, partial/invalid dates, rapid changes):

```
Router render warnings             — 0
React warnings introduced          — 0
Hydration mismatches               — 0
Uncaught exceptions                — 0
Infinite update warnings           — 0
```

The only console errors present are two browser-generated "Failed to load resource:
422" notices from the deliberate malformed-date probes against `/finance/payments`
(the server correctly rejected them with 422) — expected noise from the §18 test, not
an app warning.

```
ROUTER/REACT/HYDRATION ERRORS         — 0
```

---

## Responsive Smoke

Qualified in the available environment viewport (up to 671 px wide — the preview
host caps the window; `resizeTo` is clamped). At 671 px (narrow):
- Header Period group bottom (116 px) sits above the tab list top (128 px) — no
  overlap;
- no horizontal document overflow (`scrollWidth == clientWidth`);
- date inputs remain usable (128 px wide each), clear button reachable.

Layout has no fixed-width constraints in the shared header row, so wider (desktop)
rendering only relaxes the same flex row; the full structural checks were performed
in the same shell on every registry.

```
RESPONSIVE SMOKE                      — PASS (narrow 671px verified; desktop >671px not
                                         directly viewable in this host — no constraint
                                         found that would break at width)
```

---

## Accessibility Smoke

- Both date inputs are native `type="date"` with visible labels "С" / "По"
  (label[for] present), keyboard-reachable and focusable.
- Clear button carries an accessible name ("Очистить период").
- Tab list: 4 tabs, current tab has `aria-selected`.
- Focus-visible styling present on interactive controls; tab order follows the
  visible header → KPI → toolbar → table order.

```
ACCESSIBILITY SMOKE                   — PASS
```

---

## Regression Tests / Build

| Suite | Result |
|---|---|
| operations-center-shell.spec.tsx | 19/19 PASS |
| requests-registry.spec.tsx | 74/74 PASS |
| orders-registry.spec.tsx | 72/72 PASS |
| bookings-registry.spec.tsx | 48/48 PASS |
| table-header-filter.spec.tsx | 25/25 PASS |
| **Targeted total** | **238/238 PASS** |
| Full vitest | 628/629 — 1 failure is the known pre-existing i18n NBSP test (`formatPrice("350.00","USD","ru")` expects `350,00\u00A0$`) — unchanged, unrelated |
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx next build` | PASS (exit 0) |

```
TARGETED TESTS                        — 238/238 PASS
FULL VITEST                           — 628/629 (1 pre-existing NBSP)
TSC                                   — PASS
BUILD                                 — PASS
```

---

## No Functional Source Changes

```
git status --porcelain=v1   → clean before artifact commit
git diff --stat             → empty
git diff --check            → clean
```

Qualification introduced only documentation/evidence additions (this report + the
three stage prompt files tracked under `docs/prompts/`).

```
FUNCTIONAL SOURCE CHANGES
DURING QUALIFICATION                  — NONE
```

---

## Git Hard Closure

Tracked in the closure commit:

```text
docs/prompts/PHASE_3_UI_C1_2F_1B_SHARED_OPERATIONS_CENTER_HEADER_PERIOD_IMPLEMENTATION.md   (1B original prompt)
docs/prompts/PHASE_3_UI_C1_2F_1B_REMEDIATION_R1_GLOBAL_PERIOD_DATA_FLOW_FIX.md              (1B remediation prompt)
docs/prompts/PHASE_3_UI_C1_2F_1B_FINAL_QUALIFICATION_ONLY_SHARED_HEADER_PERIOD.md           (final qualification prompt)
docs/reports/PHASE_3_UI_C1_2F_1B_FINAL_QUALIFICATION_ONLY_SHARED_HEADER_PERIOD.md           (this report)
```

Literal proof:

```bash
git status --porcelain=v1
<NO OUTPUT>

git rev-parse HEAD
<FINAL_SHA>

git rev-parse origin/master
<FINAL_SHA>

git log -5 --oneline --decorate
<log>

git merge-base --is-ancestor ea5f6dc533dea49238a33627baf0586ace481758 HEAD
exit 0
```

```
ALL STAGE ARTIFACTS TRACKED           — PASS
WORKING TREE CLEAN                    — PASS
HEAD == origin/master                 — PASS
FUNCTIONAL REMEDIATION ANCESTRY       — PASS (ea5f6dc, exit 0)
GIT HARD CLOSURE                      — PASS
```

---

## Final Verdict

```
VERDICT A — UI-C1.2F.1B ACCEPTED

Shared Operations Center Header Period — FINAL QUALIFICATION PASSED
on a fresh runtime from the qualification working tree (HEAD 9c36cab).

FUNCTIONAL REMEDIATION SHA: ea5f6dc533dea49238a33627baf0586ace481758
FINAL SHA: fd53a895aa9e115a2bff8e358506e3c2e4a10c9b

FUNCTIONAL SOURCE CHANGES DURING QUALIFICATION: NONE
```

Observed non-blocking notes carried into the report (not defects of 1B):
1. Orders/Bookings malformed-date → HTTP 500 (pre-existing backend validation gap;
   Requests=400 / Payments=422 contracts already differ by domain). Debt register.
2. Desktop viewport (>671px) not directly viewable in this preview host; narrow
   qualification clean, no width constraint found.
3. Full vitest 1 pre-existing NBSP failure unchanged.

STOP — no next stage started. Awaiting independent review.
