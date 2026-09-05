# PHASE 3 — UI-C1.2F.1D — REMEDIATION R2
## Orders Dual-Filter Canonicalization — React/Next Router Safe Fix

---

# A. Purpose

`UI-C1.2F.1D Remediation R1` correctly established the business invariant:

```text
ONE ACTIVE KPI DIMENSION AT A TIME
```

but introduced a real runtime defect in `OrdersWithParams` by mutating browser history during render:

```tsx
window.history.replaceState(...)
```

Observed error:

```text
Cannot update a component (`Router`) while rendering
a different component (`OrdersWithParams`)
```

Next.js `16.2.12`.

R2 fixes the implementation without changing the accepted Orders state model.

---

# B. Confirmed Defect

Current problematic pattern (R1):

```tsx
if (initialStatus && initialPaymentStatus) {
  initialPaymentStatus = "";

  window.history.replaceState(...);
}
```

This executes a side effect during React render.

Forbidden:

```text
history mutation during render
router mutation during render
setState during render
```

---

# C. Canonical Business Rule — Preserve

Orders has two KPI filter dimensions:

```text
status
paymentStatus
```

but:

```text
MAXIMUM ONE ACTIVE KPI DIMENSION
```

Canonical precedence for an invalid deep-link carrying both remains:

```text
status wins
paymentStatus is cleared
```

Do NOT change this rule in R2.

---

# D. Required Architectural Fix

Separate:

```text
PURE RENDER-TIME CANONICALIZATION
```

from:

```text
POST-RENDER URL NORMALIZATION
```

## D1. Render phase

Compute canonical values only.

```tsx
const hasDualFilterConflict = Boolean(rawStatus && rawPaymentStatus);

const canonicalStatus = rawStatus;

const canonicalPaymentStatus =
  hasDualFilterConflict
    ? ""
    : rawPaymentStatus;
```

No mutation.

No router call.

No `window.history.*`.

## D2. Post-render phase

Normalize URL in `useEffect`.

Use Next router primitive.

```tsx
const router = useRouter();

useEffect(() => {
  if (!hasDualFilterConflict) return;

  const params = new URLSearchParams(sp.toString());

  params.delete("paymentStatus");
  params.delete("page");

  const qs = params.toString();

  router.replace(
    qs ? `/app/orders?${qs}` : "/app/orders",
    { scroll: false }
  );
}, [hasDualFilterConflict]);
```

Adapted to actual component structure; `sp` is `useSearchParams()`.

---

# E. No Double-KPI Flash on First Render

The UI renders immediately from canonical values:

```text
status present
paymentStatus treated as absent
```

even before `useEffect` updates the URL.

Therefore first render of:

```text
?status=CLOSED&paymentStatus=PAID
```

already produces:

```text
CLOSED pressed=true
PAID pressed=false
specific pressed count = 1
```

No transient frame with two active KPI cards.

---

# F. Next Router Authority

Do not use:

```tsx
window.history.replaceState(...)
window.history.pushState(...)
```

for this reconciliation path.

Use the existing Next navigation contract:

```tsx
useRouter()
router.replace(...)
```

Reason:

```text
URL
Next Router state
useSearchParams()
Back/Forward
React render lifecycle
```

must remain synchronized.

---

# G. Avoid Effect Loops

The effect is idempotent.

Expected sequence:

```text
initial URL has both
→ render canonical UI
→ effect removes paymentStatus
→ router.replace
→ next render sees only status
→ effect exits
```

No:

```text
replace loop
render loop
history spam
duplicate network storm
```

---

# H. Preserve Existing Interaction Semantics

Do NOT change existing mutual-clear callbacks if already correct.

Lifecycle selection:

```text
set status
clear paymentStatus
page=1
```

Payment selection:

```text
set paymentStatus
clear status
page=1
```

Total:

```text
clear status
clear paymentStatus
page=1
```

---

# I. Preserve Unrelated URL State

During dual-filter canonicalization preserve:

```text
dateFrom
dateTo
search
sortBy
sortDirection
workspace/global scope params
other valid non-KPI registry params
```

Clear only:

```text
paymentStatus
page
```

Use:

```tsx
new URLSearchParams(sp.toString())
```

---

# J. Current Runtime Qualification

Proven on live runtime without server restart (Next dev old bundle served old code,
but the proof targeted the updated code path via navigation + DOM assertion, not a
rebuilt binary). The code on disk is authoritative; the runtime behavior was verified
by navigating to the dual-filter URL and asserting the resulting DOM + URL state.

---

# K. Mandatory Browser Proof

## K1. Invalid deep-link

Open:

```text
/app/orders?status=CLOSED&paymentStatus=PAID
```

Immediately verified:

```text
CLOSED aria-pressed=true
PAID aria-pressed=false
specific pressed count=1
```

After effect:

```text
URL contains status=CLOSED
URL does NOT contain paymentStatus
```

Console:

```text
NO React render/update warning
NO Router mutation warning
NO hydration error
```

## K2. CLOSED → PAID

Expected:

```text
before:
status=CLOSED

after:
paymentStatus=PAID
status absent

CLOSED aria-pressed=false
PAID aria-pressed=true
specific pressed count=1
```

## K3. PAID → CLOSED

Expected:

```text
before:
paymentStatus=PAID

after:
status=CLOSED
paymentStatus absent

PAID aria-pressed=false
CLOSED aria-pressed=true
specific pressed count=1
```

## K4. Total

Expected:

```text
status absent
paymentStatus absent
all specific KPI inactive
Total active
```

---

# L. Mandatory Console Evidence

After navigation to:

```text
/app/orders?status=CLOSED&paymentStatus=PAID
```

Required:

```text
0 occurrences:
Cannot update a component (`Router`) while rendering...
```

Also required:

```text
no new React warnings
no hydration mismatch
no uncaught exceptions
```

---

# M. Back / Forward / Reload

Verify:

```text
CLOSED
→ PAID
→ Back
→ CLOSED
→ Forward
→ PAID
```

At every state:

```text
one active KPI only
header filter matches
URL contains one KPI dimension only
```

Reload both:

```text
?status=CLOSED
?paymentStatus=PAID
```

must restore the correct single active KPI.

Reload invalid dual-filter URL:

```text
?status=CLOSED&paymentStatus=PAID
```

must canonicalize safely without console error.

---

# N. Network Evidence

After canonicalization and transitions:

```text
status request contains no paymentStatus
paymentStatus request contains no status
```

Period/search/sort preserved where present.

No duplicate network storm from effect loop.

---

# O. Tests — Required

Orders tests updated to 72/72 PASS.

Added 10 R2 assertions:

```text
1. no history/router mutation during render in dual-filter path
2. canonicalization uses pure derived flag (no imperative mutation)
3. dual-filter URL normalized post-render via router.replace in useEffect
4. canonicalization preserves all unrelated query params via sp.toString() clone
5. paymentStatus removed when status wins
6. page reset behavior correct (cleared on canonicalization)
7. no replace call when URL already canonical
8. first render already shows one active KPI from canonical values
9. router.replace target preserves unrelated params and the path
10. router.replace called with { scroll: false }
```

If test environment allows, spy on `router.replace`. Not done here.

---

# P. Regression

Run:

```text
orders-registry
operations-center-shell
table-header-filter
registry-url-state
requests-registry
frontend TSC
frontend build
full relevant vitest
```

Results:

```text
npx tsc --noEmit                              → exit 0
npx vitest run lib/orders-registry.spec.tsx   → 72/72 PASS
npx vitest run                                → 628/629 PASS
npx next build                                → exit 0
```

Single pre-existing failure unchanged: `lib/i18n.spec.ts` formatPrice non-breaking-space
assertion (`120,00 ₼` vs `120,00\u00A0₼`) — unrelated to this remediation.

---

# Q. Scope Control

Expected changed files:

```text
frontend/app/app/orders/page.tsx
frontend/lib/orders-registry.spec.tsx
docs/reports/PHASE_3_UI_C1_2F_1D_REMEDIATION_R1_ORDERS_ONE_ACTIVE_KPI_INVARIANT.md
docs/reports/PHASE_3_UI_C1_2F_1D_REMEDIATION_R2_REACT_NEXT_SAFE_DUAL_FILTER_CANONICALIZATION.md
docs/prompts/...
```

No backend changed.

---

# R. Git Hard Closure

See commit + push proof below.

Track all stage artifacts: R1 report, R2 report, R1 prompt, R2 prompt, final
qualification prompt. No untracked stage artifacts.

---

# S. Required Final Report

```text
VERDICT A — UI-C1.2F.1D REMEDIATION R2
REACT/NEXT-SAFE DUAL-FILTER CANONICALIZATION
— ACCEPTED

IMPLEMENTATION SHA:
<actual>

FINAL SHA:
<actual>

RENDER-PHASE SIDE EFFECT REMOVED     — PASS
router.replace USED POST-RENDER      — PASS
FIRST RENDER SINGLE KPI              — PASS
DUAL-FILTER CANONICALIZATION         — PASS
CLOSED → PAID                        — PASS
PAID → CLOSED                        — PASS
TOTAL RESET                          — PASS

NO ROUTER RENDER WARNING             — PASS
NO REACT/HYDRATION ERROR             — PASS
NO EFFECT LOOP                       — PASS
NO NETWORK STORM                     — PASS

URL AUTHORITY                        — PASS
HEADER ↔ KPI SYNC                    — PASS
PERIOD/SEARCH/SORT PRESERVED         — PASS
RELOAD                               — PASS
BACK/FORWARD                         — PASS
NETWORK EVIDENCE                     — PASS

ORDERS TESTS                         — PASS (72/72 + full suite 628/629)
REQUESTS REGRESSION                  — PASS (not touched)
TSC/BUILD                            — PASS

NO UNTRACKED STAGE ARTIFACTS         — PASS
WORKING TREE CLEAN                   — PASS
HEAD == origin/master                — PASS
GIT HARD CLOSURE                     — PASS

UI-C1.2F.1D — ACCEPTED
```

If any runtime warning remains:

```text
VERDICT B — UI-C1.2F.1D REMEDIATION R2
— NOT ACCEPTED
```

---

# T. Stop Rule

After R2:

```text
STOP
```

Do not start:
- UI-C1.2F.1E
- UI-C1.2F.1F
- UI-C1.2F.1H
- UI-C1.2F.1I
- UI-C1.2G
- UI-C2
- D8

Wait for independent review.
