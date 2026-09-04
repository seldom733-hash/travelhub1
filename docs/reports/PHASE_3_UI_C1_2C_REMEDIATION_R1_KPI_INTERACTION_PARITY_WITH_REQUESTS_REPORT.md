# PHASE 3 — COMMERCE CENTER UI-C1.2C — REMEDIATION R1 — KPI INTERACTION PARITY WITH REQUESTS — REPORT

---

## 1. Executive Summary

UI-C1.2C REMEDIATION R1 fixes the rejected Orders KPI interaction: previously the Orders KPI aggregates were computed over the same filtered `where` as the table, so clicking one KPI card (`status=` / `paymentStatus=`) **re-scoped and collapsed the other KPI cards**. Product decision: **Requests is the behavioral reference** — a clicked KPI card becomes *selected* and filters the **TABLE only**; the other KPI cards stay **static within the current overview (global) scope**.

Implemented with minimal, scoped changes:

- **Backend (`listOrders`)** — KPI aggregates (`aggregates.lifecycle`, `aggregates.payment`) are now computed over an **overview scope** derived from the table `where` by excluding exactly the KPI-card dimensions `status` and `paymentStatus`. Global registry scope dimensions (search, period/`createdAt`, detector scope, `customerId`, `acquisitionSource`/tenant) still scope the overview. Table items + pagination `total` stay table-scoped (active KPI filter included).
- **Frontend (`/app/orders`)** — the Total card now binds to the server **overview total** (`aggregates.lifecycle.total`) instead of the table-scope `total`; nothing else changes visually or interaction-wise (selected state, one-active-card rule, URL contract, layout, connectors, toolbar all unchanged).
- Requests is **untouched**. Bookings is **audit-only** (same collapse pattern confirmed; remediation scheduled for UI-C1.2D).

Verification: backend typecheck ✓ · backend build ✓ · backend order-module 24 passed (6 new scope unit tests) with the 2 pre-existing seed-identity failures unchanged · frontend typecheck ✓ · `next build` ✓ · focused suites 172/172 · full frontend suite 518 passed (only the pre-existing `formatPrice` baseline) · browser qualification **30/30** proving numeric stability of every KPI card across lifecycle switch, payment selection, Total reset, direct URL/reload/Back-Forward and period scope.

---

## 2. Baseline / Rejected Behavior

- Implementation checkpoint under review: `0ae7dc9ba866f6c6a9238e04a9ccc4cf53a37dd2` (UI-C1.2C, **not** accepted final after remediation).
- Rejected behavior (confirmed in that checkpoint): `aggregates.lifecycle` and `aggregates.payment` were computed with `groupBy` over the **same `where`** used for `items/total`, so `?status=PROBLEM` returned `NEW=0, IN_PROCESSING=0, … PROBLEM=12` instead of a stable overview.
- Product ruling: the old same-where model is exactly what this remediation replaces (§32 of the prompt: *“Do not reinterpret this as 'same filtered query for KPI and table'”*).

---

## 3. Requests Reference Audit

`/app/requests` behavior (source of truth, untouched by this stage):

- **KPI overview** comes from the separate global `/requests/kpi` endpoint — status selection never re-fetches or re-scopes it.
- **Table filter** (`status`, `search`, `page`) is a separate server list request; clicking a KPI card only changes the table request.
- **Selected state**: one active card (`aria-pressed`); clicking another card moves the selection.
- **Total**: click clears the active card filter, returns to the default Total state; Total value comes from the overview KPI.
- **URL**: `?search=&status=&page=` via `replaceState`; reload/Back-Forward restore selection + table filter.

This contract was re-verified live in the R1 browser qualification (§23).

---

## 4. Root Cause

`order.service.listOrders` applied one `where` to table **and** aggregates:

```ts
const [statusCounts, paymentCounts] = await Promise.all([
  this.prisma.order.groupBy({ by: ['status'], where, ... }),        // ← table where
  this.prisma.order.groupBy({ by: ['paymentStatus'], where, ... }), // ← table where
]);
```

Active `status`/`paymentStatus` therefore narrowed every aggregate → unrelated cards collapsed to 0 and the Total shrank to the active status count.

---

## 5. Target Interaction Contract

```text
KPI CARDS = STABLE OVERVIEW

CLICKED KPI CARD → SELECTED → filters TABLE ONLY
NON-SELECTED KPI CARDS → retain overview counts (never zero, never re-scoped)
```

Requests parity, one active card at a time across lifecycle **and** payment groups. Total = default/reset state.

---

## 6. Overview Scope vs Table Scope

| Scope | Includes | Excludes |
|---|---|---|
| **Overview (KPI aggregates)** | search · period `createdAt [from,to)` · detector scope (cancelledWithin / paymentFailed / pendingRefund ids) · `customerId` · `acquisitionSource`/tenant default | `status`, `paymentStatus` (the KPI-card dimensions) |
| **Table** | everything above **plus** the active KPI-card filter (`status` / `paymentStatus`) | — |

Backend implementation: new pure helper `overviewOrderWhere(where)` returns a shallow copy of the table `where` with exactly `status` and `paymentStatus` deleted; `listOrders` runs the two `groupBy` queries and the overview `count` over `overviewWhere`. `total` (returned for pagination) remains the table-scope count. Result payload shape is unchanged (`items/total/page/pageSize/aggregates.lifecycle/aggregates.payment`), so no consumer breaks; `aggregates.lifecycle.total` now equals the **overview** total.

---

## 7. Backend/API Changes

`backend/src/modules/order/order-kpi-scope.ts` (new):

```ts
export function overviewOrderWhere(where: Prisma.OrderWhereInput): Prisma.OrderWhereInput {
  const overview = { ...where };
  delete overview.status;
  delete overview.paymentStatus;
  return overview;
}
```

`backend/src/modules/order/order.service.ts` (`listOrders`): aggregates + overview count use `overviewWhere`; `lifecycleAgg.total = overviewTotal`; table `items`/`total` unchanged.

Scope discipline preserved: no RBAC/permission change, no tenant/workspace change, no D5 action change, no D7 finance change, no audit/export/pagination change. Only additive module + two call-site changes. GET `/orders` response remains a single request serving both stable overview aggregates and the filtered table — the server simply computes them on two scopes.

---

## 8. Frontend State Changes

`frontend/app/app/orders/page.tsx` (two small edits):

1. Total card value now reads the **overview total**:
   ```ts
   const overviewTotal = (data?.aggregates?.lifecycle as Record<string, number> | undefined)?.total ?? data?.total ?? 0;
   ...
   value={overviewTotal}
   ```
2. Inline comment documenting the R1 contract. No other state/fetch/layout change — because the overview now arrives already stable in the single `/orders` response, the existing selection → `status=`/`paymentStatus=` → page→1 → refetch flow needs no re-architecture.

Selected state (`aria-pressed` + active styles), one-active-card enforcement (`applyStatus` clears payment, `applyPaymentStatus` clears status), Total reset handler and URL writes were already Requests-consistent and are unchanged.

---

## 9. Lifecycle KPI Behavior

Selecting any of the 12 lifecycle cards → selected visual state, `status=<value>` table filter, all 11 other lifecycle cards **and** all 4 payment cards retain their overview counts. Browser proof: click «Проблема» (10) → other 16 values byte-identical; switch to «Закрыт» (213) → again byte-identical.

---

## 10. Payment KPI Behavior

Selecting one of the 4 payment cards → `paymentStatus=<value>`, lifecycle selection cleared (one active card), lifecycle overview + other payment overview counts unchanged. Browser proof: click «Оплачен» (346) → lifecycle values identical, no `status=` in URL.

---

## 11. Total KPI Behavior

«Всего заказов» = **overview total** (508 in the live dataset). Click → clears `status`/`paymentStatus`, becomes the default selected state, table returns to KPI-unfiltered scope; the overview values are not recomputed/collapsed by the click (they were never re-scoped). Browser proof: values identical, URL normalized to `/app/orders`, table shows mixed statuses again.

---

## 12. Selected Visual State

Unchanged and verified: `aria-pressed=true` on the active card; previous card deselected when another is clicked; keyboard activation via real `<button>`s; focus ring visible; selected state survives reload and Back/Forward when the URL represents the active KPI (§13). Selection never changes KPI numbers.

---

## 13. URL State

Unchanged contract, re-verified live:

```text
status KPI     → ?status=<value>, paymentStatus removed, page=1
payment KPI    → ?paymentStatus=<value>, status removed, page=1
Total          → both removed, page normalized
```

Direct `/app/orders?status=PROBLEM` restores the selected card + table filter; reload keeps it; browser Back from `?paymentStatus=PAID` restores `?status=PROBLEM` with the correct selected card — all while every KPI value stays at its overview number.

---

## 14. Search / Period Semantics

Search and period are **global overview-scope dimensions** for Orders (as previously established): changing them refreshes both the overview aggregates and the table. Inside that global scope, selecting a KPI narrows the table only. Live proof (§22 scenario): `dateFrom=2026-08-01&dateTo=2026-08-31` overview has «Проблема»=2; clicking «Проблема» keeps all other cards at the **full August** overview values and yields an August+PROBLEM table of exactly 2 rows.

---

## 15. Detector / Deep-Link Semantics

Detector scopes (`cancelledWithin`, `paymentFailed`, `pendingRefund`) define a global registry scope (backend `where.id = { in: [...] }` / createdAt override) and therefore **do** scope the overview — verified by construction: `overviewWhere` preserves `id`/createdAt detector predicates. Inside a detector scope a clicked KPI filters the table only (all KPI-card dims stay excluded from the overview). Detector deep links are not broken: their extra table columns and scoped counts still render. Not changed in this stage beyond inheriting the new overview computation.

---

## 16. Export Semantics

CSV/XLSX export (`/orders/export`) is unchanged and still follows the **current table filter scope** (controller passes `status`, `paymentStatus`, `search`, dates and detector params through to `buildOrderWhere`). With «Проблема» active, export contains the PROBLEM rows — exactly as before R1. The KPI-overview change does not touch export.

---

## 17. No Client-Side Counting Proof

- Overview counts are read verbatim from server `aggregates.lifecycle` / `aggregates.payment` (and the Total from `aggregates.lifecycle.total`).
- No `items.filter`, no `.reduce`, no page-row counting, no fabricated zeros anywhere (spec-asserted `not.toContain('.filter((o) =>'` / `.reduce(` / `/orders/kpi`).
- The scope split itself is proven by the backend unit spec (`order-kpi-scope.spec.ts`) and live numeric equality checks.

---

## 18. Requests Regression

Requests is untouched (no file change). `requests-registry.spec.tsx` 51/51 green; request-center 56/56 green; full frontend suite green except the documented pre-existing `formatPrice` baseline. Live comparison in the qualification: clicking «Новые» on `/app/requests` leaves every other KPI value identical — the exact behavior Orders now mirrors.

---

## 19. Bookings Forward Note

Bookings shows the same collapse pattern and is **audit-only** here (no production change): `booking.service.ts` computes its status `groupBy` over the same `where` as `items/count`, and its detector filters (`upcoming`, `overdue`) overwrite `where.status`, which would collapse the overview inside a detector scope as well. For UI-C1.2D the same contract applies:

- overview scope = table scope minus the `status` KPI dimension (keep search, date, orderId/channel, detector predicates in the overview);
- `upcoming`/`overdue` detectors are global-scope predicates, not KPI-card selections;
- reuse the identical Requests-style interaction contract and, if desired, the same `overviewXxxWhere` helper pattern.

---

## 20. Focused Tests

- **Backend** `backend/src/modules/order/order-kpi-scope.spec.ts` — 6 pure unit tests (no DB): drops `status` (single + multi-value `in` form), drops `paymentStatus`, keeps search/customerId/createdAt/detector-id/acquisitionSource in the overview, does not mutate the input, identity when no KPI dimension present. **6/6 pass.**
- **Frontend** `frontend/lib/orders-registry.spec.tsx` — added a REMEDIATION R1 describe (4 tests): cards render only overview aggregates from the single `/orders` response (no `/orders/kpi`, `.filter`, `.reduce`); Total binds `overviewTotal` (never table `total`); pagination still uses table `data.total`; `status`/`paymentStatus` remain table-scope params sent to the server. Orders registry spec total now 58 tests. **58/58 pass.**

Combined focused runs: orders-registry 58 + requests-registry 51 + operations-center-shell 19 + commerce detail-system 44 = **172/172**.

---

## 21. Global-Scope Test

Live (§22 of the prompt, mandatory because the period UI stays exposed):

```text
?dateFrom=2026-08-01&dateTo=2026-08-31
→ overview: Проблема = 2 (server period overview)
→ click Проблема
→ table  = date scope AND status=Проблема (2 rows, all Проблема)
→ other KPI cards = full August overview (NOT date+problem narrowed)
```

Recorded PASS in the browser qualification with real values.

---

## 22. URL / History Tests

All verified live: direct `/app/orders?status=PROBLEM` (selected «Проблема», table PROBLEM, other counts overview); reload keeps state; Back from `?paymentStatus=PAID` restores `?status=PROBLEM` + selection; counts never collapse during history navigation.

---

## 23. Browser Qualification

`backend/tmp_c12c_r1_browser_verify.py` — **30/30 PASS** on live app (admin):

- baseline 17 cards (Total 508, Проблема 10, Закрыт 213, Оплачен 346);
- click «Проблема» → selected + `?status=PROBLEM` + 10 PROBLEM rows + **all other 16 values identical**;
- switch «Закрыт» → selected + `?status=CLOSED` + 20 Закрыт rows (page 1 of 213) + all other values identical;
- click «Оплачен» → `?paymentStatus=PAID`, no `status`, lifecycle + payment values identical;
- click «Всего заказов» → filters cleared, URL normalized, table back to mixed statuses, overview values identical;
- direct URL / reload / Back-Forward — selection + filter restored, counts stable;
- period scope scenario (§21) PASS with real numbers;
- Requests side-by-side: click «Новые» → other Requests KPI values identical (reference behavior confirmed unchanged);
- 390 / 768 / 1680 — no page-level horizontal overflow.

Evidence: `docs/evidence/c12c/c12c_r1_browser_results.json`, `c12c_r1_orders_paid_selected.png`, `c12c_r1_orders_period_problem.png`, `c12c_r1_requests_selected.png`.

---

## 24. KPI Stability Evidence Matrix

Live browser values (real dataset):

| Scenario | Selected KPI | Table filter | Other lifecycle KPI counts | Payment KPI counts | Result |
|---|---|---:|---:|---:|---|
| Initial | Total/default | none | baseline | baseline | PASS |
| click Проблема | Проблема | status=PROBLEM | unchanged (all 11 identical) | unchanged (all 4 identical) | PASS |
| click Закрыт | Закрыт | status=CLOSED | unchanged | unchanged | PASS |
| click Оплачен | Оплачен | paymentStatus=PAID | unchanged | unchanged | PASS |
| click Всего заказов | Total/default | none | unchanged | unchanged | PASS |
| period + click Проблема | Проблема | date=Aug AND status=PROBLEM | unchanged (full-Aug overview) | unchanged | PASS |

Byte-for-byte comparisons across all 17 card values in `c12c_r1_browser_results.json`.

---

## 25. Query-Scope Matrix

| Dimension | Overview KPI scope | Table scope | KPI click re-scopes overview? |
|---|---|---|---:|
| Workspace/Tenant (`acquisitionSource`/channel default) | YES | YES | N/A |
| Search (`code`/`number`/`referenceNumber`) | YES | YES | NO |
| Date/Period (`createdAt` `[from,to)`) | YES | YES | NO |
| Detector (`cancelledWithin`/`paymentFailed`/`pendingRefund`) | YES | YES | NO |
| Lifecycle KPI selection (`status`) | **EXCLUDED** | INCLUDED | NO |
| Payment KPI selection (`paymentStatus`) | **EXCLUDED** | INCLUDED | NO |

P0 satisfied: both KPI-card dimensions are excluded from the KPI overview scope and included only in the table scope.

---

## 26. Security Preservation

No RBAC/permission change (server `PermissionsGuard` and `order.read` untouched). No tenant/workspace weakening — the channel-scope default and deny logic live in the same unchanged `where` construction. D5 Order action authority, D7 finance authority, audit immutability, pagination and export are untouched (backend diff limited to the aggregates scope computation + a pure helper).

---

## 27. Regression

```text
backend tsc --noEmit                  ✓
backend build (dist)                  ✓ (rebuilt + restarted)
backend jest src/modules/order        24 passed / 2 failed (26)
  └ order-kpi-scope.spec.ts            6/6  (new)
  └ commerce-chain.invariants.spec     2 pre-existing seed-identity failures
     (MKT-ORD- referenceNumber pattern + 8-digit commerceSequence against the
     demo DB — identical before this change; unrelated to KPI scope)
frontend tsc --noEmit                 ✓
frontend next build                   ✓
focused suites                        172/172
frontend full suite                   518 passed / 1 failed (519)
  └ pre-existing i18n.spec formatPrice NBSP baseline (unchanged, documented)
```

---

## 28. Git Hard Closure

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

Acceptance: porcelain empty · HEAD == origin/master · one new canonical 40-char SHA.

FINAL SHA (implementation): `3b12d16def817bf4c91124d3ff14adf692d7aa6c`.

The old checkpoint `0ae7dc9ba866f6c6a9238e04a9ccc4cf53a37dd2` is **not** the accepted final UI-C1.2C SHA.

---

## 29. Final Verdict

```text
VERDICT A — UI-C1.2C REMEDIATION R1
KPI INTERACTION PARITY WITH REQUESTS — ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — ACCEPTED
UI-C1.2A — ACCEPTED
UI-C1.2B — ACCEPTED

UI-C1.2C — ACCEPTED AFTER REMEDIATION R1

FINAL SHA: 3b12d16def817bf4c91124d3ff14adf692d7aa6c

REQUESTS KPI BEHAVIOR REFERENCE — PASS
ORDERS KPI SELECTED STATE — PASS
ORDERS TABLE-ONLY KPI FILTERING — PASS
LIFECYCLE KPI COUNT STABILITY — PASS
PAYMENT KPI COUNT STABILITY — PASS
TOTAL RESET — PASS
URL / HISTORY — PASS
SERVER-AUTHORITATIVE OVERVIEW — PASS
NO CLIENT-SIDE KPI FABRICATION — PASS

REFERENCE-MATCH CARD DESIGN — DEFERRED

UI-C1.2D — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED

TRUE NEXT:
UI-C1.2D — BOOKINGS REGISTRY MIGRATION
WITH THE SAME REQUESTS KPI INTERACTION CONTRACT
```

---

## 30. TRUE NEXT

```text
UI-C1.2D — BOOKINGS REGISTRY MIGRATION
WITH THE SAME REQUESTS KPI INTERACTION CONTRACT
```

Bookings remediation/migration is scheduled for UI-C1.2D (audit findings in §19): semantic groups over the 13 canonical BookingStatus values, one-active-card Requests-style KPI interaction, overview/table scope split with detector predicates (`upcoming`, `overdue`) kept in the overview, and the URL-state/toolbar grammar established in UI-C1.2B/C.
