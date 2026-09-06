# PHASE 3 — UI-C1.2G — FINAL QUALIFICATION & GIT CLOSURE REMEDIATION

## 0. Purpose

This is a **qualification / closure remediation only** for:

```text
UI-C1.2G — KPI Semantic Grouping / Lifecycle Flow
```

Do **not** redesign or reimplement the functional feature unless a real regression is discovered during qualification.

The previous implementation report was not acceptable because:

```text
1. browser/runtime qualification was not executed;
2. responsive/accessibility runtime verification remained pending;
3. Git hard closure contradicted itself because an untracked prompt file remained;
4. the report contained inconsistent FINAL SHA values;
5. independent TypeScript typecheck was not proven.
```

The functional implementation itself is provisionally accepted pending this closure.

---

## 1. Baseline

Original accepted pre-stage baseline:

```text
a481048966c7ac788f8381069715d1b61032921f
```

Known implementation commit from the prior report:

```text
5203c9f — feat: group Operations Center KPIs by lifecycle semantics
```

The previous report also showed later documentation commits up to `e5bd1fc`.

Do not assume any SHA from the old report is still current. Capture fresh literal evidence:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git branch --show-current
git log -10 --oneline --decorate
git merge-base --is-ancestor a481048966c7ac788f8381069715d1b61032921f HEAD
echo $LASTEXITCODE
```

Required ancestry result: `0`.

If unrelated modifications are present, STOP and report them.

---

## 2. Strict Scope

Allowed:

```text
qualification
browser/runtime verification
responsive verification
accessibility verification
console verification
repository-native independent typecheck
test reruns
documentation/report correction
Git cleanup
documentation-only closure commit/push
```

Functional source changes are allowed only if qualification proves a real UI-C1.2G regression.

Forbidden absent a proven regression:

```text
new KPI semantics
new status grouping
state-machine changes
backend changes
schema changes
API changes
filter semantics changes
period semantics changes
UI-C1.2H implementation
PROD-01 implementation
service-category reporting
```

---

## 3. Preserve Functional Result

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

Preserve:

```text
12/12 OrderStatus
4/4 OrderPaymentStatus
```

### Bookings

Preserve:

```text
13/13 canonical BookingStatus
PARTIALLY_CONFIRMED absent
AWAITING_CONFIRMATION visible
```

### Payments

Preserve:

```text
6/6 PaymentStatus
4/4 RefundStatus
dynamic currency cards
```

Do not alter these unless qualification proves a real bug.

---

## 4. Preserve KPI Interaction Contract

```text
KPI cards = static overview counts

click KPI
→ filters table only
→ selected card active
→ other KPI values remain unchanged

Header Period
→ global scope
→ recomputes KPI overview
→ recomputes table

Total
→ clears active KPI/table-only business filter
→ preserves Header Period

Registry Reset
→ follows already accepted registry semantics
→ does not clear Header Period
```

One-active invariant:

```text
Requests: status
Orders: status XOR paymentStatus
Bookings: status
Payments: paymentStatus XOR refundStatus XOR currencyCard
```

KPI ↔ table-header filter synchronization must remain intact.

---

## 5. Audit Current Repository First

Inspect actual current files and scripts:

```text
frontend/app/app/requests/page.tsx
frontend/app/app/orders/page.tsx
frontend/app/app/bookings/page.tsx
frontend/app/app/payments/page.tsx
frontend/lib/i18n.tsx
relevant registry specs
package.json
frontend/package.json
frontend/tsconfig.json
```

Determine the repository-native independent typecheck command before running it.

Do not invent a command if a valid package script/toolchain already exists.

---

## 6. Independent TypeScript Typecheck — Mandatory

The previous report did not prove this gate.

Use the actual repository toolchain, for example only if valid:

```bash
npm run typecheck
npm --prefix frontend run typecheck
cd frontend && npm run typecheck
./node_modules/.bin/tsc --noEmit
npx --no-install tsc --noEmit
```

Required:

```text
INDEPENDENT TYPECHECK — PASS
```

Production build is **not** a substitute in this remediation.

If no repository-supported independent typecheck path exists, document exact evidence and return `VERDICT B` unless the reviewer explicitly changes the contract.

---

## 7. Browser Qualification — Mandatory

Run real browser verification against the application for:

```text
/app/requests
/app/orders
/app/bookings
/app/payments
```

Use representative seeded data.

For every registry verify:

```text
page loads
correct KPI groups render
all canonical KPI cards remain visible
selected state is visible
KPI click filters table
table-header filter reflects same state where applicable
Total clears active KPI filter
Header Period remains global
no local date controls reappear
toolbar remains aligned
table remains below KPI area
```

Additional required checks:

### Orders

Prove:

```text
one OrderStatus KPI
one OrderPaymentStatus KPI
cross-dimension one-active behavior
```

### Payments

Prove:

```text
one PaymentStatus KPI
one RefundStatus KPI
one currency KPI
one-active behavior across all three dimensions
```

---

## 8. Browser Console

For all four registries verify no newly introduced:

```text
React errors
hydration errors
duplicate-key warnings
unhandled promise rejections
unexpected API failures
accessibility warnings caused by UI-C1.2G
```

Known deliberate invalid-input backend 500 debt is out of scope unless encountered in a normal flow.

Record literal browser/console evidence.

---

## 9. Responsive Qualification

Verify at minimum:

```text
desktop wide
~1024 px
~671 px
```

Check:

```text
no horizontal page overflow from KPI groups
cards wrap predictably
group headings stay associated with cards
labels are not clipped
counts remain readable
selected state remains clear
table layout remains intact
```

Do not hide canonical KPI cards to pass responsive checks.

Requests is the changed registry, but smoke-check all four.

---

## 10. Accessibility Qualification

Verify actual interactive behavior:

```text
KPI cards keyboard reachable
visible focus indicator
selected state exposed by aria-pressed or equivalent
group headings programmatically meaningful
no color-only selected state
zero-count cards remain understandable
TableHeaderFilter accessibility preserved
```

Use existing automated accessibility tooling if present; otherwise document exact browser/DOM evidence.

---

## 11. URL / Reload / History Smoke

For Requests and at least one multi-dimension registry (Orders or Payments), prove:

```text
KPI click updates canonical URL
reload restores state
direct deep-link restores state
Total clears active KPI parameter
Header Period survives appropriate interactions
accepted replace-history semantics remain unchanged
```

Do not migrate to push semantics.

---

## 12. API ↔ UI Reconciliation

Use real server responses and visible UI values.

Requests:

```text
one primary status
one exception status
```

Orders:

```text
one lifecycle status
one payment status
```

Bookings:

```text
one lifecycle status
one exception/attention status
```

Payments:

```text
one payment status
one refund status
one currency card
```

For each selected example prove:

```text
API aggregate == displayed KPI
```

Do not rely only on unit-test assertions.

---

## 13. Tests

Rerun relevant targeted suites:

```text
requests-registry
orders-registry
bookings-registry
payments-registry
table-header-filter
operations-center-shell
```

Then run the full frontend suite.

Known historical failure from the prior report:

```text
lib/i18n.spec.ts
Expected: "120,00 ₼"
Received: "120,00 ₼"
```

It may be classified as pre-existing only if the exact same failure remains unchanged.

Do not classify any new failure as known debt.

---

## 14. Production Build

Run the actual frontend production build.

Required:

```text
PRODUCTION BUILD — PASS
```

This gate is separate from independent typecheck.

---

## 15. Git Cleanliness Remediation

The previous report simultaneously claimed:

```text
WORKING TREE CLEAN — PASS
```

and:

```text
working tree clean except untracked prompt file
```

That is invalid.

This remediation must end with:

```bash
git status --porcelain=v1
```

producing **no output**.

Commit the stage prompt/report if repository conventions require them under `docs/prompts` / `docs/reports`.

Do not leave qualification artifacts untracked.

---

## 16. SHA Rule — No Recursive Self-Reference

Do not repeat the previous recursive FINAL SHA problem.

Use two concepts:

```text
IMPLEMENTATION SHA
= commit containing the functional UI-C1.2G change

CLOSURE SHA
= final HEAD after qualification/report/Git closure
```

Do not keep recommitting a report solely to inject the SHA of the commit that contains the report itself.

Preferred sequence:

```text
1. finalize qualification report content;
2. commit report and any cleanup;
3. push/fetch;
4. capture literal final HEAD/origin evidence;
5. return that literal evidence to the reviewer;
6. do not amend/recommit only to make a document contain its own commit hash.
```

Acceptance is based on literal Git evidence.

---

## 17. Required Remediation Report

Create:

```text
docs/reports/PHASE_3_UI_C1_2G_FINAL_QUALIFICATION_AND_GIT_CLOSURE_REPORT.md
```

Include:

```text
current start SHA
implementation SHA
browser qualification evidence
responsive evidence
accessibility evidence
console evidence
URL/reload/history evidence
API↔UI reconciliation
targeted tests
full frontend tests
independent typecheck
production build
Git cleanliness
literal final Git evidence
known unchanged debt
```

No placeholders in submitted evidence.

---

## 18. Git Hard Closure

After qualification and report commit:

```bash
git diff --check
git status --porcelain=v1
git push origin master
git fetch origin
```

Then capture literal proof:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git branch --show-current
git log -10 --oneline --decorate
git merge-base --is-ancestor a481048966c7ac788f8381069715d1b61032921f HEAD
echo $LASTEXITCODE
```

Required:

```text
working tree clean
HEAD == origin/master
branch = master
baseline ancestry = 0
```

Also prove the implementation commit is an ancestor of final HEAD:

```bash
git merge-base --is-ancestor <FULL_IMPLEMENTATION_SHA> HEAD
echo $LASTEXITCODE
```

Required result: `0`.

---

## 19. Final Acceptance Matrix

Return actual evidence only:

```text
PHASE 3 — UI-C1.2G
FINAL QUALIFICATION & GIT CLOSURE

ORIGINAL BASELINE:
a481048966c7ac788f8381069715d1b61032921f

IMPLEMENTATION SHA:
<actual full SHA>

CLOSURE SHA / FINAL HEAD:
<actual full SHA from literal Git evidence>

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
URL / RELOAD / HISTORY                — PASS

API ↔ UI RECONCILIATION               — PASS

BROWSER REQUESTS                      — PASS
BROWSER ORDERS                        — PASS
BROWSER BOOKINGS                      — PASS
BROWSER PAYMENTS                      — PASS
BROWSER CONSOLE                       — PASS

RESPONSIVE DESKTOP                    — PASS
RESPONSIVE ~1024                      — PASS
RESPONSIVE ~671                       — PASS
ACCESSIBILITY                         — PASS

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

VERDICT A — UI-C1.2G ACCEPTED
```

If any mandatory condition fails:

```text
VERDICT B — UI-C1.2G NOT ACCEPTED

BLOCKER:
<exact blocker>
```

Do not self-award acceptance without the required evidence.

---

## 20. STOP

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
