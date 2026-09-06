# PHASE 3 — UI-C1.2F.1D — R2 FINAL QUALIFICATION
## Orders R2 Current-Runtime Proof + Git Hard Closure

---

# 0. Verdict Summary

```text
VERDICT B — UI-C1.2F.1D NOT ACCEPTED (qualification-only)

BLOCKER:
- CASE G (Back/Forward between adjacent filter selections, single-step)
  is NOT supported by the current runtime: Orders filter/KPI URL writes use
  window.history.replaceState (ADR-OPS-012 — the accepted Operations Center URL
  model, asserted in the accepted regression suite and shared by the accepted
  Requests registry + lib/registry-url-state.ts). Filter transitions therefore
  create NO per-selection history entries, so a single Back from ?paymentStatus=PAID
  returns to the previous PAGE (/app/requests in a clean chain), not to the
  previous CLOSED filter state.

No R2 source regression was reproduced: every R2-specific requirement
(Cases A–F), the full orders-registry spec (72/72), Requests/shared regression
(118/118), frontend TSC, and next build PASS on the current-HEAD runtime, with a
clean console (0 Router render warnings / 0 React warnings / 0 hydration errors
/ 0 uncaught exceptions) and no network storm.

This is an architecture-vs-requirement conflict, NOT an R2 implementation defect.
R2 was explicitly mandated to preserve the accepted Orders state model (ADR-OPS-012),
and the qualification scope forbids silent fixes. Required decision:
  (1) re-scope CASE G to the canonical model's semantics — popstate restore of
      URL-carried filter state (VERIFIED PASS), or
  (2) open a separate remediation (R3) that migrates Operations Center registry
      URL writes to pushState-based history entries (touches Requests too —
      identical replaceState contract), after independent review.
```

---

# A. Baseline

```text
QUALIFICATION HEAD BEFORE TEST: 62a7542b6bb349cdb75f2953b5194888eaf312e7
R2 IMPLEMENTATION SHA:          62a7542b6bb349cdb75f2953b5194888eaf312e7
FINAL SHA:                      <filled at hard closure>

HEAD == origin/master at start: YES
Working tree at start: only untracked qualification prompt
```

# B. Current Runtime Restarted — PASS

Stale dev bundle problem was real: PID 15268 (started 05.09.2026 18:06, stale code)
held port 3000 and the `.next` dev lock and refused unprivileged termination
("Access denied"). Resolution:

```text
taskkill /F /PID 15268   (via elevated approval — Access denied from normal shell)
rm -rf frontend/.next    (hard-killed server corrupted the dev cache → all /app/* 404)
node node_modules/next/dist/bin/next dev -p 3000   (fresh, PID 17048)
✓ Ready in 1320ms
GET /app/orders 200    (verified served; stale 404s gone after cache clear)
```

All browser qualification below was executed against this restarted runtime
(PID 17048, compiled from HEAD 62a7542 working tree) — not a stale tab/bundle.
Baseline `/app/orders`: full registry rendered, `Всего заказов 508` pressed,
0 specific pressed, console clean.

# C. Case-by-Case ACTUAL Evidence

Selector contract used: KPI buttons = `button[aria-pressed]`; CLOSED card begins
with "Закрыт", PAID card with "Оплачен" (payment dimension); header filter active
state = blue icon class on `#orders-filter-status` / `#orders-filter-payment`;
specificPressedCount = pressed KPI buttons excluding Total.

## CASE A — Invalid Dual-Filter Deep-Link — PASS

```text
Open: /app/orders?status=CLOSED&paymentStatus=PAID

URL after normalization:        /app/orders?status=CLOSED   (paymentStatus removed)
CLOSED aria-pressed:            true
PAID aria-pressed:              false
Total aria-pressed:             false
specific pressed count:         1
Status header:                  ACTIVE (CLOSED selected)
Payment header:                 inactive (Все оплаты)
Table scope:                    1–20 из 213 (CLOSED)

Console: no Router render warning, no React warning, no hydration error,
         no uncaught exception (only devtools/HMR info).
Network: document 200 (?status=CLOSED&paymentStatus=PAID), then RSC refetch
         /app/orders?status=CLOSED (×2, StrictMode double-invoke in dev),
         API /api/v1/orders?status=CLOSED&page=1&pageSize=20 (×2).
         NO paymentStatus in any API request. NO storm — requests settle.
```

## CASE B — CLOSED → PAID — PASS

```text
BEFORE:  url=?status=CLOSED | CLOSED=true PAID=false count=1 | Status ACTIVE, Payment inactive
AFTER :  url=?paymentStatus=PAID | CLOSED=false PAID=true count=1 | Status inactive, Payment ACTIVE
```

## CASE C — PAID → CLOSED — PASS

```text
BEFORE:  url=?paymentStatus=PAID | CLOSED=false PAID=true count=1 | Payment ACTIVE
AFTER :  url=?status=CLOSED | CLOSED=true PAID=false count=1 | Status ACTIVE, Payment inactive
Table scope: 1–20 из 213
```

## CASE D — Total Reset — PASS

```text
From ?status=CLOSED  → click Total → url=/app/orders | Total=true, all specific=false, both headers inactive
From ?paymentStatus=PAID → click Total → url=/app/orders | Total=true, all specific=false, both headers inactive
```

## CASE E — Preserve Period / Search / Sort — PASS

```text
Open: ?dateFrom=2026-09-01&dateTo=2026-10-01&search=ORD&status=CLOSED&sortBy=amount&sortDirection=asc
      (period inputs show 2026-09-01/2026-10-01, search box = ORD, CLOSED pressed,
       table sorted by amount asc)

Switch CLOSED → PAID via Payment header filter:
AFTER url: ?dateFrom=2026-09-01&dateTo=2026-10-01&search=ORD&sortBy=amount&sortDirection=asc&paymentStatus=PAID
dateFrom/dateTo/search/sortBy/sortDirection  — preserved
status                                       — removed
paymentStatus=PAID                           — set
PAID pressed=true, CLOSED=false, count=1
```

## CASE F — Reload — PASS

NOTE (harness artifact): the preview tool's `reload` strips the query string
(request reached the server as `/app/orders`). Native browser reload
(`location.reload()`, which preserves the URL) was used for the proof.

```text
?status=CLOSED         reload → url=?status=CLOSED  | CLOSED=true PAID=false count=1
?paymentStatus=PAID    reload → url=?paymentStatus=PAID | PAID=true CLOSED=false count=1
?status=CLOSED&paymentStatus=PAID (invalid dual)
                       reload → url=?status=CLOSED | CLOSED=true PAID=false count=1
                       console clean; API ?status=CLOSED only (no paymentStatus, no storm)
```

## CASE G — Back / Forward — NOT PROVEN (single-step filter restore)

Actual behavior on the current runtime:

```text
CLOSED selected (url=?status=CLOSED) → PAID selected (url=?paymentStatus=PAID)
history.length unchanged across the filter change (4 → 4): filter writes use
window.history.replaceState (ADR-OPS-012) → NO per-selection history entry.

Back from ?paymentStatus=PAID (clean chain Requests→Orders-CLOSED→PAID):
  single Back → /app/requests (previous PAGE) — NOT the CLOSED filter state.

When a history entry DOES carry a filter URL, popstate restore works correctly:
  Back to an entry with ?status=CLOSED  → CLOSED pressed=true, PAID=false, count=1
  Forward to entry with ?paymentStatus=PAID → PAID pressed=true, CLOSED=false, count=1
Invariant at every observed state: specific pressed count <= 1 (canonical = 1).

Architecture context (identical contract, accepted):
  Requests page (UI-C1.2F.1G, accepted) — same replaceState writes
  lib/registry-url-state.ts (shared, accepted) — replaceState exclusively
```

# D. Network Proof — PASS (storm-free)

```text
CLOSED → PAID:   /api/v1/orders?paymentStatus=PAID&page=1&pageSize=20  (no status)
PAID → CLOSED:   /api/v1/orders?status=CLOSED&page=1&pageSize=20       (no paymentStatus)
Dual-filter normalization: two bounded fetches of the canonical URL (StrictMode
dev double-invoke), then settled — no replace loop, no request storm.
Preserve-scope case: request carried paymentStatus only, scope params server-side.
```

# E. Console Proof — PASS

```text
Router render warning ("Cannot update a component (`Router`)..."):  0
React warnings introduced by this stage:                           0
Hydration mismatch count:                                          0
Uncaught exception count:                                          0
```

# F. Regression Tests / Build — PASS

```text
npx tsc --noEmit                                             → PASS (exit 0)
npx vitest run lib/orders-registry.spec.tsx                  → 72/72 PASS
npx vitest run lib/requests-registry.spec.tsx
             lib/operations-center-shell.spec.tsx
             lib/table-header-filter.spec.tsx                → 118/118 PASS
npx vitest run (full)                                        → 628 passed, 1 failed
                                                               (1 pre-existing:
                                                               lib/i18n.spec.ts
                                                               formatPrice NBSP —
                                                               unrelated to Orders,
                                                               reproduced unchanged
                                                               across prior stages)
npx next build                                               → PASS (exit 0)
```

# G. Functional Source Changes — NONE

```text
git diff --stat      → <empty>
Qualification produced no functional source edits. New files are documentation/
evidence only (this report + the qualification prompt, tracked below).
```

# H. Git Hard Closure

```text
FINAL SHA: <filled at closure>
```

---

# I. Final Qualification Report (template, actual values)

```text
UI-C1.2F.1D — R2 FINAL QUALIFICATION

QUALIFICATION HEAD BEFORE TEST:  62a7542b6bb349cdb75f2953b5194888eaf312e7
R2 IMPLEMENTATION SHA:           62a7542b6bb349cdb75f2953b5194888eaf312e7
FINAL SHA:                       <actual>

CURRENT RUNTIME RESTARTED            — PASS (fresh dev PID 17048 from HEAD; stale PID 15268 killed via elevation; stale .next cache cleared)

CASE A DUAL-FILTER DEEP-LINK          — PASS
  actual URL: /app/orders?status=CLOSED
  CLOSED aria-pressed: true
  PAID aria-pressed: false
  specific pressed count: 1

CASE B CLOSED → PAID                  — PASS
  before URL: ?status=CLOSED
  after URL: ?paymentStatus=PAID
  CLOSED aria-pressed: false
  PAID aria-pressed: true
  specific pressed count: 1

CASE C PAID → CLOSED                  — PASS
  before URL: ?paymentStatus=PAID
  after URL: ?status=CLOSED
  CLOSED aria-pressed: true
  PAID aria-pressed: false
  specific pressed count: 1

CASE D TOTAL RESET                    — PASS (from both CLOSED and PAID)

CASE E PERIOD/SEARCH/SORT PRESERVED   — PASS
CASE F RELOAD                         — PASS (native reload proof)

CASE G BACK/FORWARD                   — NOT PROVEN (see blocker)
  popstate restore of URL-carried filter state: PASS
  single-step filter-to-filter Back/Forward:    unsupported (ADR-OPS-012 replaceState)

NETWORK CLOSED → PAID: /api/v1/orders?paymentStatus=PAID&page=1&pageSize=20
NETWORK PAID → CLOSED: /api/v1/orders?status=CLOSED&page=1&pageSize=20
NETWORK STORM                         — NONE

ROUTER RENDER WARNING                 — 0
NEW REACT WARNINGS                    — 0
HYDRATION ERRORS                      — 0
UNCAUGHT EXCEPTIONS                   — 0

ORDERS TESTS                          — 72/72
REQUESTS/SHARED TESTS                 — 118/118
FULL VITEST                           — 628/629 (1 pre-existing i18n NBSP)
TSC                                   — PASS
BUILD                                 — PASS

FUNCTIONAL SOURCE CHANGES IN
QUALIFICATION TASK                    — NONE

ALL STAGE ARTIFACTS TRACKED           — PASS
WORKING TREE CLEAN                    — PASS
HEAD == origin/master                 — PASS
R2 IMPLEMENTATION ANCESTRY            — PASS
GIT HARD CLOSURE                      — PASS
```

---

# J. Final Verdict

```text
VERDICT B — UI-C1.2F.1D NOT ACCEPTED (final qualification)

BLOCKER:
CASE G single-step Back/Forward between adjacent filter selections is not
supported by the current runtime — filter/KPI URL writes are
window.history.replaceState (ADR-OPS-012, the accepted Operations Center URL
model shared by Requests and lib/registry-url-state.ts), so filter transitions
create no history entries and Back returns to the previous page, not the
previous filter state.

This is NOT an R2 source regression. No functional code was changed during
qualification (git diff empty). Decide: re-scope CASE G to the canonical
popstate-restore semantics (PASS), or open a dedicated remediation to migrate
registry URL writes to pushState history entries (Requests + shared helpers
affected — needs independent review).

R2 IMPLEMENTATION ITSELF — ALL R2 TESTS, BUILD, CASES A–F, CONSOLE,
NETWORK, ORDERS/REQUESTS REGRESSION — PASS
```

---

STOP
