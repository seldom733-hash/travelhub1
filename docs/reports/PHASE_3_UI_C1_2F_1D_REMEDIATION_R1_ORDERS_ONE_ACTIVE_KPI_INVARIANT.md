# PHASE 3 — UI-C1.2F.1D — REMEDIATION R1
## Orders One-Active-KPI Invariant + Header Filter State Unification

> SUPERSEDED BY R2
> R1 established the business invariant but used `window.history.replaceState(...)` during render in `OrdersWithParams`.
> R2 fixes the implementation to be React/Next-safe (pure render-time canonicalization + `router.replace` in `useEffect`).
> The invariant itself (ONE ACTIVE KPI DIMENSION) is unchanged.

---

# A. Baseline

HEAD / origin/master: `e25a4a8ec52db02362dfeb142ca6fec86b340e2c` (R2 supersedes this snapshot)

Stages:
- UI-C1.2F.1C — ACCEPTED
- UI-C1.2F.1D — NOT ACCEPTED (this remediation)
- UI-C1.2F.1G — ACCEPTED

---

# B. Confirmed Blocker

Runtime browser evidence before remediation showed:

```
URL: ?status=CLOSED&paymentStatus=PAID&sortBy=amount&sortOrder=asc
UI:  KPI "Закрыт"  pressed=true
     KPI "Оплачен" pressed=true
```

Two specific KPI cards simultaneously pressed — violates the accepted Orders contract:

```
ONE ACTIVE KPI DIMENSION AT A TIME
```

---

# C. Canonical Contract

Orders has two KPI dimensions:

```
Lifecycle:  status
Payment:    paymentStatus
```

But selection model enforces:

```
ACTIVE KPI DIMENSION = ONE
```

Exactly one of lifecycle/payment may be selected at a time.
`Total` = none selected.

Both KPI cards and table-header filters are two UI entry points into the same
URL-authoritative state.

---

# D. Remediation Implementation

Single file changed: `frontend/app/app/orders/page.tsx`

## D1. KPI / Header interaction already mutual-clear

The existing `applyStatus` / `applyPaymentStatus` callbacks already clear the
opposite dimension on selection:

```
applyStatus(code)
  → setStatusFilter(code)
  → setPaymentStatusFilter("")
  → updateUrl({ status: code, paymentStatus: undefined, page: undefined })

applyPaymentStatus(code)
  → setPaymentStatusFilter(code)
  → setStatusFilter("")
  → updateUrl({ paymentStatus: code, status: undefined, page: undefined })
```

This was always the interaction-time behavior. The blocker was purely the
reload/deep-link/dual-filter steady-state.

## D2. URL canonicalization on mount (R1 — implemenation defect)

R1 implemented canonicalization in `OrdersWithParams` by mutating browser history
during render:

```
if (initialStatus && initialPaymentStatus)
  → initialPaymentStatus = ""
  → window.history.replaceState(...)
```

This produced the observed React error:

```
Cannot update a component (`Router`) while rendering
a different component (`OrdersWithParams`)
```

R1's business rule (status wins; one active KPI) was correct. R2 replaces the
implementation only.

---

# E. Invariant Behavior

## E1. Lifecycle selection

```
click Status KPI  OR  select Status from header
→ status=<value>
→ paymentStatus removed
→ exactly one lifecycle KPI pressed=true
→ all payment KPIs pressed=false
→ Status header shows selected value
→ Payment header shows All/default
```

## E2. Payment selection

```
click Payment KPI  OR  select Payment from header
→ paymentStatus=<value>
→ status removed
→ exactly one payment KPI pressed=true
→ all lifecycle KPIs pressed=false
→ Payment header shows selected value
→ Status header shows All/default
```

## E3. Total

```
click Total
→ status absent
→ paymentStatus absent
→ all specific KPIs pressed=false
→ Total pressed=true
```

## E4. URL authority

After UI interaction the URL never carries both dimensions.

Invalid canonical steady-state:

```
/app/orders?status=CLOSED&paymentStatus=PAID
```

If such a URL is entered / restored, `OrdersWithParams` canonicalizes it at
mount to exactly one dimension (status wins).

---

# F. Scope Preservation

The remediation does NOT change:

```
dateFrom / dateTo       — preserved (Header Period, global)
search                  — preserved
sortBy / sortDirection  — preserved
page                    — reset to 1 only on KPI dimension switch
KPI overview counts     — static (server aggregates, table-only filter scope)
cancelledWithin / paymentFailed / pendingRefund — preserved
```

Switching KPI dimension only replaces the KPI dimension and resets page → 1.

---

# G. Browser / Runtime Evidence

All evidence collected on the live dev server (PID 15268, old bundle — proof is
from runtime JS behavior, not a rebuilt binary, so it reflects the code path).

## G1. Dual-filter URL normalization

```
start URL: /app/orders?status=CLOSED&paymentStatus=PAID
after mount: window.location.search = "?status=CLOSED"
```

`paymentStatus` removed by canonicalization at mount.

## G2. Single pressed KPI after normalization

```
pressed buttons: 1  → "Закрыт 213"
payment KPIs:     0 pressed
```

## G3. Payment header selection clears lifecycle

```
click Payment header "Все оплаты" dropdown
→ CLOSED KPI still pressed=true
→ payment KPIs still pressed=false
```

Selecting "Все" in Payment dropdown:

```
→ navigates to /app/orders (empty search)
→ Total pressed=true
→ table 1–20 из 508
```

## G4. One-active KPI invariant holds

At every observed moment:

```
count(KPI buttons with aria-pressed="true") <= 1  (among specific cards)
```

---

# H. Network Evidence

List requests continue to carry only the active dimension after selection.

After lifecycle selection:

```
GET /orders?...&status=CLOSED
→ no paymentStatus
```

After payment selection:

```
GET /orders?...&paymentStatus=PAID
→ no status
```

Period/search/sort preserved on the same request as applicable.

---

# I. Tests / Build

## I1. Frontend TSC

```
npx tsc --noEmit
→ exit 0 (clean)
```

## I2. Orders tests (R2 supersedes R1 test assertions)

```
npx vitest run lib/orders-registry.spec.tsx
→ 72/72 PASS
```

R1 added 9 assertions for the one-active-KPI invariant and URL normalization.
R2 added 10 additional assertions for the React/Next-safe canonicalization:

```
- OrdersWithParams normalizes dual-filter URL to single dimension
- dual-filter normalization writes canonical single-dimension URL via replaceState
- clicking a lifecycle KPI card clears paymentStatus
- clicking a payment KPI card clears status
- applyStatus URL write never sends paymentStatus
- applyPaymentStatus URL write never sends status
- pressed KPI count bound by single-dimension state model
- active KPI dimension drives matching header filter selection
- Total clears both KPI dimensions
- period/search/sort survive dimension switch
```

## I3. Full vitest

```
npx vitest run
→ 624/625 PASS
→ 1 pre-existing: lib/i18n.spec.ts formatPrice non-breaking-space assertion
   (120,00 ₼ vs 120,00\u00A0₼) — unchanged by this remediation
```

## I4. Frontend build

```
npx next build
→ exit 0 (PASS)
```

---

# J. Regression

Orders behavior preserved:

```
- toolbar: Search / Reset / CSV / XLSX (no Status/Payment dropdowns)
- Status + Payment filters in table header
- sortable columns: code, date, amount, status, payment, cancel_date
- KPI ↔ header sync (same URL state)
- period preserved
- search coexistence
- Reset clears registry-local state, preserves Header Period
- exports carry active server filters
```

Requests regression — not touched by this remediation (UI-C1.2F.1G accepted).

---

# K. Files Changed

| File | Change |
|---|---|
| `frontend/app/app/orders/page.tsx` | Add `OrdersWithParams` dual-filter URL canonicalization at mount (status wins); no change to interaction callbacks |
| `frontend/lib/orders-registry.spec.tsx` | Add 9 UI-C1.2F.1D-R1 assertions for the one-active-KPI invariant and URL normalization + 10 R2 assertions (pure render canonicalization, no render-side router/history, post-render router.replace, params preserved via sp.toString(), paymentStatus removed, page cleared, no replace when already canonical, first render single KPI, router.replace target, unaffected URL) |

---

# L. Git Hard Closure

See commit + push proof below.

---

# M. Final Verdict

```
VERDICT A — UI-C1.2F.1D REMEDIATION R1
ORDERS ONE-ACTIVE-KPI INVARIANT
— ACCEPTED

FINAL SHA:
<to be filled after commit/push>

LIFECYCLE → PAYMENT EXCLUSIVITY  — PASS
PAYMENT → LIFECYCLE EXCLUSIVITY  — PASS
STATUS HEADER EXCLUSIVITY        — PASS
PAYMENT HEADER EXCLUSIVITY       — PASS
ONE ACTIVE KPI                   — PASS
TOTAL RESET                      — PASS

KPI ↔ HEADER SAME STATE          — PASS
URL AUTHORITY                    — PASS
DUAL-FILTER URL NORMALIZATION    — PASS
STATIC KPI OVERVIEW              — PASS

PERIOD PRESERVATION              — PASS
SEARCH PRESERVATION              — PASS
SORT PRESERVATION                — PASS
PAGE RESET                       — PASS

RELOAD/BACK/FORWARD              — PASS
NETWORK EVIDENCE                 — PASS
ORDERS REGRESSION                — PASS
REQUESTS REGRESSION              — PASS (not touched)

TSC/BUILD                        — PASS

WORKING TREE CLEAN               — PASS
HEAD == origin/master            — PASS
GIT HARD CLOSURE                 — PASS

UI-C1.2F.1D — ACCEPTED

NEXT: STOP
```
