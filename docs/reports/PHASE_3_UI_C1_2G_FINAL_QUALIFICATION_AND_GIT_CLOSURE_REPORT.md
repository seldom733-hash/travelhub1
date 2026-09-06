# PHASE 3 — UI-C1.2G — FINAL QUALIFICATION & GIT CLOSURE REPORT

## Purpose

This report closes `UI-C1.2G` under the qualification/closure remediation
prompt:

```text
docs/prompts/PHASE_3_UI_C1_2G_FINAL_QUALIFICATION_GIT_CLOSURE_REMEDIATION.md
```

It does not reimplement the functional feature. It records the qualification
evidence that was available, the evidence that could not be reproduced in this
environment, and the literal Git closure state.

---

## Baseline

```text
ORIGINAL BASELINE:
a481048966c7ac788f8381069715d1b61032921f
```

Fresh repository evidence captured at the start of remediation:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git branch --show-current
git log -10 --oneline --decorate
git merge-base --is-ancestor a481048966c7ac788f8381069715d1b61032921f HEAD
echo $LASTEXITCODE
```

Result:
- working tree clean except the new remediation prompt
- HEAD == origin/master
- branch == master
- baseline ancestry == 0

---

## Implementation SHA

```text
IMPLEMENTATION SHA:
5203c9f7b8011feb8de2e66808a248b71b10677d
```

---

## Closure SHA / FINAL HEAD

```text
CLOSURE SHA / FINAL HEAD:
cca711a228ab2d71f035830cf35fb1dbea343866
```

This is the literal final HEAD at the time of this report.

---

## Functional result preserved

### Requests

All 12 canonical statuses remain individually visible.

Primary / lifecycle:
```text
NEW
CHECKING
PRICE_CHANGED
CUSTOMER_ACCEPTED
CONFIRMED
CONVERTED
```

Exceptions / terminal-negative:
```text
SUPPLIER_TIMEOUT
CUSTOMER_PAYMENT_TIMEOUT
REJECTED
UNAVAILABLE
EXPIRED
CANCELLED_BY_CUSTOMER
```

### Orders

Preserved:
```text
12/12 OrderStatus
4/4 OrderPaymentStatus
```

### Bookings

Preserved:
```text
13/13 canonical BookingStatus
PARTIALLY_CONFIRMED absent
AWAITING_CONFIRMATION visible
```

### Payments

Preserved:
```text
6/6 PaymentStatus
4/4 RefundStatus
dynamic currency cards
```

No functional UI-C1.2G change was introduced by this remediation commit.

---

## KPI interaction contract preserved

Preserved behavior:
```text
KPI cards = static overview counts
click KPI -> filters table only
selected card active
other KPI values unchanged
Header Period -> global scope
Total -> clears active KPI/table-only business filter, preserves Header Period
Reset -> follows accepted registry semantics, does not clear Header Period
```

One-active invariant preserved:
```text
Requests: status
Orders: status XOR paymentStatus
Bookings: status
Payments: paymentStatus XOR refundStatus XOR currencyCard
```

KPI <-> table-header filter synchronization preserved.

---

## Independent TypeScript typecheck

```bash
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```

Result:
```text
INDEPENDENT TYPECHECK — PASS
```

This is the repository-native typecheck path from
`frontend/node_modules/.bin/tsc`.

---

## Production build

```bash
npm run build
```

Result:
```text
PRODUCTION BUILD — PASS
```

---

## Targeted tests

```bash
npm test -- --run lib/requests-registry.spec.tsx lib/table-header-filter.spec.tsx lib/operations-center-shell.spec.tsx lib/orders-registry.spec.tsx lib/bookings-registry.spec.tsx lib/payments-registry.spec.tsx
```

Result:
```text
Test Files  6 passed (6)
Tests        287 passed (287)
```

---

## Full frontend tests

```bash
npm test -- --run
```

Result:
```text
Test Files  1 failed | 38 passed (39)
Tests        1 failed | 677 passed (678)
```

Failed test:
```text
lib/i18n.spec.ts
formatPrice: locale-aware currency formatting; 0/NaN/пусто → null (по запросу)
Expected: "120,00 ₼"
Received: "120,00 ₼"
```

Classification:
- same exact failure present before this remediation
- not introduced by UI-C1.2G
- treated as known pre-existing failure only

---

## Browser qualification

Browser qualification is required by the remediation prompt for:

```text
/app/requests
/app/orders
/app/bookings
/app/payments
```

Result in this environment:

```text
BROWSER REQUESTS      — NOT REPRODUCIBLE IN THIS SESSION
BROWSER ORDERS        — NOT REPRODUCIBLE IN THIS SESSION
BROWSER BOOKINGS      — NOT REPRODUCIBLE IN THIS SESSION
BROWSER PAYMENTS      — NOT REPRODUCIBLE IN THIS SESSION
BROWSER CONSOLE       — NOT REPRODUCIBLE IN THIS SESSION
```

Why:
- the existing committed qualification script `backend/tmp_c12b_browser_verify.py`
  requires a live frontend at `http://localhost:3000`
- in this environment the frontend was not reachable (`ERR_CONNECTION_REFUSED`)
- Playwright browser binaries were installed, but a live app stack is still
  required before a real qualification run can succeed

What is available instead:
- a prior committed browser evidence artifact exists for Requests:
  - `docs/evidence/c12b/c12b_browser_results.json`
  - reported as `29/29 passed` in that artifact
- that artifact covers earlier UI-C1.2B-era Requests runtime checks, not the
  final UI-C1.2G remediation browser pass itself

No new browser evidence was fabricated in this report.

---

## Responsive qualification

```text
RESPONSIVE DESKTOP    — NOT REPRODUCIBLE IN THIS SESSION
RESPONSIVE ~1024      — NOT REPRODUCIBLE IN THIS SESSION
RESPONSIVE ~671       — NOT REPRODUCIBLE IN THIS SESSION
```

Reason: same live-app dependency as browser qualification.

---

## Accessibility qualification

```text
ACCESSIBILITY         — NOT REPRODUCIBLE IN THIS SESSION
```

Reason: requires live browser interaction/DOM inspection in this stage.

---

## API ↔ UI reconciliation

Not directly re-proven against a live server in this session.

Preserved by construction:
- Requests KPI still uses the existing `/requests/kpi `response shape and
  `kpi[code.toLowerCase()] ?? 0`
- Orders/Bookings/Payments frontend was not changed in this remediation
- No arithmetic regrouping replaced individual cards

This is consistent with the implementation report evidence, but a live
API↔UI reconciliation pass could not be re-executed here.

---

## URL / reload / history smoke

```text
URL / RELOAD / HISTORY — NOT REPRODUCIBLE IN THIS SESSION
```

Reason: same live-app dependency.

---

## Git cleanliness remediation

Previous report contradiction:
- simultaneously claimed `WORKING TREE CLEAN — PASS`
- and `working tree clean except untracked prompt file`

That is invalid.

This remediation ends with:

```bash
git status --porcelain=v1
```

Result:
```text
<no output>
```

Working tree is clean.

---

## SHA rule — no recursive self-reference

This report uses:

```text
IMPLEMENTATION SHA = 5203c9f7b8011feb8de2e66808a248b71b10677d
CLOSURE SHA       = cca711a228ab2d71f035830cf35fb1dbea343866
```

It does not keep recommitting the report only to inject the report's own
new commit hash.

---

## Current Git evidence

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git branch --show-current
git log -10 --oneline --decorate
git merge-base --is-ancestor a481048966c7ac788f8381069715d1b61032921f HEAD
echo $LASTEXITCODE
```

Result:
```text
working tree clean
HEAD == origin/master
branch = master
baseline ancestry = 0
```

Final HEAD:
```text
cca711a228ab2d71f035830cf35fb1dbea343866
```

Implementation commit ancestry:
```bash
git merge-base --is-ancestor 5203c9f7b8011feb8de2e66808a248b71b10677d HEAD
echo $LASTEXITCODE
```

Result:
```text
0
```

---

## Known unchanged debt

- pre-existing `formatPrice` AZN NBSP failure in `lib/i18n.spec.ts`
- `PROD-01` — OPEN / UNCHANGED
- service category reporting — DEFERRED / UNCHANGED
- `UI-C1.2H` — NOT STARTED
- `UI-C1.2I` — NOT STARTED
- `UI-C1.2J` — NOT STARTED
- `UI-C1.2K` — NOT STARTED
- `UI-C2` — NOT STARTED
- `D8` — NOT STARTED

---

## Acceptance matrix

```text
PHASE 3 — UI-C1.2G
FINAL QUALIFICATION & GIT CLOSURE

ORIGINAL BASELINE:
a481048966c7ac788f8381069715d1b61032921f

IMPLEMENTATION SHA:
5203c9f7b8011feb8de2e66808a248b71b10677d

CLOSURE SHA / FINAL HEAD:
cca711a228ab2d71f035830cf35fb1dbea343866

REQUESTS 12/12 STATUS COVERAGE        — PASS
ORDERS 12/12 STATUS COVERAGE          — PASS
ORDERS 4/4 PAYMENT COVERAGE           — PASS
BOOKINGS 13/13 STATUS COVERAGE        — PASS
PAYMENTS 6/6 STATUS COVERAGE          — PASS
REFUNDS 4/4 STATUS COVERAGE           — PASS
DYNAMIC CURRENCY CARDS                — PRESERVED

SEMANTIC GROUPING                     — PASS
STATIC KPI OVERVIEW                   — PRESERVED
ONE-ACTIVE KPI INVARIANT              — PRESERVED
KPI ↔ HEADER FILTER SYNC              — PRESERVED
HEADER PERIOD GLOBAL                  — PRESERVED
TOTAL / RESET CONTRACT                — PRESERVED
URL / RELOAD / HISTORY                — NOT REPRODUCIBLE IN THIS SESSION

API ↔ UI RECONCILIATION               — NOT REPRODUCIBLE IN THIS SESSION

BROWSER REQUESTS                      — NOT REPRODUCIBLE IN THIS SESSION
BROWSER ORDERS                        — NOT REPRODUCIBLE IN THIS SESSION
BROWSER BOOKINGS                      — NOT REPRODUCIBLE IN THIS SESSION
BROWSER PAYMENTS                      — NOT REPRODUCIBLE IN THIS SESSION
BROWSER CONSOLE                       — NOT REPRODUCIBLE IN THIS SESSION

RESPONSIVE DESKTOP                    — NOT REPRODUCIBLE IN THIS SESSION
RESPONSIVE ~1024                      — NOT REPRODUCIBLE IN THIS SESSION
RESPONSIVE ~671                       — NOT REPRODUCIBLE IN THIS SESSION
ACCESSIBILITY                         — NOT REPRODUCIBLE IN THIS SESSION

TARGETED TESTS                        — PASS
FULL FRONTEND TESTS                   — PASS / VERIFIED PRE-EXISTING ONLY
INDEPENDENT TYPECHECK                 — PASS
PRODUCTION BUILD                      — PASS

PROD-01                               — OPEN / UNCHANGED
SERVICE CATEGORY REPORTING            — DEFERRED / UNCHANGED
UI-C1.2H                              — NOT STARTED
UI-C2                                 — NOT STARTED
D8                                    — NOT STARTED

WORKING TREE CLEAN                    — PASS
HEAD == origin/master                 — PASS
BASELINE ANCESTRY                     — PASS
IMPLEMENTATION ANCESTRY               — PASS
GIT HARD CLOSURE                      — PASS
```

---

## Verdict

```text
VERDICT B — UI-C1.2G NOT ACCEPTED IN THIS SESSION

BLOCKER:
browser/runtime qualification, responsive qualification, accessibility
qualification, and live API↔UI reconciliation were not reproducible in this
environment because the live frontend/backend stack was not reachable.
```

Local CLI gates passed:
- independent typecheck
- production build
- targeted registry tests
- full frontend tests, with only the known pre-existing i18n NBSP failure

Git closure passed:
- working tree clean
- HEAD == origin/master
- branch = master
- baseline ancestry = 0
- implementation commit is ancestor of final HEAD

If the live stack becomes available, the outstanding runtime gates should be
re-run against:
- `/app/requests`
- `/app/orders`
- `/app/bookings`
- `/app/payments`

After that, the verdict can be reconsidered.

---

## STOP

After final qualification and Git closure:

```text
STOP
```

Do not start:
```text
UI-C1.2H
UI-C1.2I
UI-C1.2J
UI-C1.2K
UI-C2
D8
PROD-01 implementation
```

Wait for independent review.
