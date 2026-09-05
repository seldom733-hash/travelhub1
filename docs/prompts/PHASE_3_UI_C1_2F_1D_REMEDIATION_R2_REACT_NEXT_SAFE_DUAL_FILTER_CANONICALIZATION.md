# PHASE 3 — UI-C1.2F.1D — REMEDIATION R2
## Orders Dual-Filter Canonicalization — React/Next Router Safe Fix

---

# 0. Purpose

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

Next.js:

```text
16.2.12
```

Therefore the previous final-qualification prompt is superseded.

This R2 must fix the implementation safely without changing the accepted Orders state model.

---

# 1. Confirmed Defect

Current problematic pattern:

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

# 2. Canonical Business Rule — Preserve

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

# 3. Required Architectural Fix

Separate:

```text
PURE RENDER-TIME CANONICALIZATION
```

from:

```text
POST-RENDER URL NORMALIZATION
```

## Render phase

Compute canonical values only.

Conceptually:

```tsx
const hasDualFilterConflict =
  Boolean(initialStatus && initialPaymentStatus);

const canonicalStatus = initialStatus;

const canonicalPaymentStatus =
  hasDualFilterConflict
    ? ""
    : initialPaymentStatus;
```

No mutation.

No router call.

No `window.history.*`.

## Post-render phase

Normalize URL in `useEffect`.

Use existing Next router/navigation primitives.

Preferred:

```tsx
const router = useRouter();

useEffect(() => {
  if (!hasDualFilterConflict) return;

  const params = new URLSearchParams(searchParams.toString());

  params.delete("paymentStatus");
  params.delete("page");

  const qs = params.toString();

  router.replace(
    qs ? `/app/orders?${qs}` : "/app/orders",
    { scroll: false }
  );
}, [hasDualFilterConflict, searchParams, router]);
```

Adapt to actual component structure; do not blindly copy if route construction differs.

---

# 4. No Double-KPI Flash on First Render

Important:

The UI must render immediately from canonical values:

```text
status present
paymentStatus treated as absent
```

even before `useEffect` updates the URL.

Therefore first render of:

```text
?status=CLOSED&paymentStatus=PAID
```

must already produce:

```text
CLOSED pressed=true
PAID pressed=false
specific pressed count = 1
```

No transient frame with two active KPI cards.

---

# 5. Next Router Authority

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

# 6. Avoid Effect Loops

The effect must be idempotent.

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

Add test coverage for this.

---

# 7. Preserve Existing Interaction Semantics

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

# 8. Preserve Unrelated URL State

During dual-filter canonicalization preserve:

```text
dateFrom
dateTo
search
sortBy
sortDirection / actual deployed sort param
workspace/global scope params
other valid non-KPI registry params
```

Clear only:

```text
paymentStatus
page (if canonical reset contract requires it)
```

Do not reconstruct query manually from a hardcoded subset if that drops unrelated params.

Use:

```tsx
new URLSearchParams(searchParams.toString())
```

or equivalent safe preservation.

---

# 9. Current Runtime Qualification

After fix, restart the current frontend runtime from current HEAD or otherwise prove the updated code is served.

Do not reuse stale browser evidence.

---

# 10. Mandatory Browser Proof

## A. Invalid deep-link

Open:

```text
/app/orders?status=CLOSED&paymentStatus=PAID
```

Immediately verify:

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

## B. CLOSED → PAID

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

## C. PAID → CLOSED

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

## D. Total

Expected:

```text
status absent
paymentStatus absent
all specific KPI inactive
Total active
```

---

# 11. Mandatory Console Evidence

Explicitly capture browser console after:

```text
deep-link normalization
CLOSED → PAID
PAID → CLOSED
Reload
Back
Forward
```

Required:

```text
0 occurrences:
Cannot update a component (`Router`) while rendering...
```

Also require:

```text
no new React warnings
no hydration mismatch
no uncaught exceptions
```

---

# 12. Back / Forward / Reload

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

# 13. Network Evidence

Verify after canonicalization and transitions:

```text
status request contains no paymentStatus
paymentStatus request contains no status
```

Preserve:

```text
period
search
sort
```

where present.

Ensure no duplicate network storm from effect loop.

---

# 14. Tests — Required

Add or update tests for:

```text
1. no history/router mutation during render
2. dual-filter first render exposes one active KPI only
3. canonicalization runs post-render
4. router.replace called once for dual conflict
5. canonicalization preserves unrelated query params
6. paymentStatus removed when status wins
7. page reset behavior correct
8. no replace call when URL already canonical
9. CLOSED → PAID exclusivity
10. PAID → CLOSED exclusivity
11. Total reset
12. Reload derivation
13. Back/Forward-compatible URL state
```

If test environment allows, spy on:

```text
router.replace
```

Do NOT test by asserting direct `window.history.replaceState` anymore.

---

# 15. Regression

Run at minimum:

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

Requests regression is mandatory because shared state/navigation helpers may be involved.

---

# 16. Scope Control

Expected changed files should be small, likely:

```text
frontend/app/app/orders/page.tsx
frontend/lib/orders-registry.spec.tsx
docs/reports/...
docs/evidence/...
```

If shared navigation code must change, explain why.

Do not touch backend unless a real blocker is found.

---

# 17. Git Hard Closure

Before commit:

```bash
git status --porcelain=v1
git diff --check
git diff --stat
```

Track all stage artifacts, including:

```text
R1 prompt
R2 prompt
report
evidence
```

No untracked prompt files are allowed at final closure.

Commit and push.

Then:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline --decorate
```

Required:

```text
status → NO OUTPUT
HEAD == origin/master
```

---

# 18. Required Final Report

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

ORDERS TESTS                         — PASS
REQUESTS REGRESSION                  — PASS
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

# 19. Stop Rule

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
