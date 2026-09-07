# PHASE 3 — UI-C1.2G — RUNTIME DEFECT REMEDIATION + FINAL RE-QUALIFICATION

## Purpose

This task closes the **actual runtime defect** discovered during UI-C1.2G qualification and then performs the remaining final runtime qualification.

This is **not** a new UI stage.

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

The defect is already proven by live runtime evidence:

```text
Requests currently renders all 12 Request KPI cards in one flat grid
under one section heading "Статусы заявок".

The intended UI-C1.2G result is two semantic groups:
1. lifecycle / primary
2. exceptions / terminal-negative
```

Functional counts/API truth are correct. The remediation must change **presentation only** unless another real defect is discovered.

---

## 1. Authoritative Existing Evidence

Live runtime qualification already proved:

```text
frontend: http://localhost:3000
backend:  http://localhost:4000

authenticated session:
existing seeded admin / admin123

Requests:
Total = 646
12/12 statuses visible
API ↔ UI values match
console clean
responsive labels visible at 1680 / 1024 / 671
```

Actual runtime defect:

```text
single flat 12-card status grid
missing semantic Requests grouping headings
```

The runtime report explicitly observed absence of:

```text
requests.group.lifecycle
requests.group.exceptions
```

and absence of localized headings equivalent to:

```text
Ход заявки
Проблемы и завершения
```

Do not debate whether the defect exists. It is the starting point for this remediation.

---

## 2. Implementation SHA / Baseline Discipline

Known functional UI-C1.2G implementation commit:

```text
5203c9f7b8011feb8de2e66808a248b71b10677d
```

At task start capture literal current state:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git branch --show-current
git log -10 --oneline --decorate
git merge-base --is-ancestor 5203c9f7b8011feb8de2e66808a248b71b10677d HEAD
echo $LASTEXITCODE
```

If unrelated tracked changes exist:

```text
STOP
VERDICT B
```

Do not overwrite unrelated work.

---

## 3. Scope of Allowed Functional Change

Allowed functional source change:

```text
Requests KPI presentation grouping only
```

Expected files may include:

```text
frontend/app/app/requests/page.tsx
frontend/lib/i18n.tsx
frontend/lib/requests-registry.spec.tsx
shared presentation component only if genuinely required
```

Do not modify:

```text
Request status enum
backend API
KPI calculation
request state machine
filter semantics
URL semantics
Header Period behavior
Orders grouping
Bookings grouping
Payments grouping
RBAC
workspace isolation
schema
database
```

If any of those appear necessary, STOP and return a blocker.

---

## 4. Canonical Requests Grouping

All 12 canonical statuses must remain visible exactly once.

### Group A — Lifecycle / Primary

```text
NEW
CHECKING
PRICE_CHANGED
CUSTOMER_ACCEPTED
CONFIRMED
CONVERTED
```

### Group B — Exceptions / Terminal-negative

```text
SUPPLIER_TIMEOUT
CUSTOMER_PAYMENT_TIMEOUT
REJECTED
UNAVAILABLE
EXPIRED
CANCELLED_BY_CUSTOMER
```

Required invariants:

```text
6 + 6 = 12
no duplicate status
no omitted status
no merged status
no invented status
```

---

## 5. Group Heading Presentation

Render two visibly distinct semantic sections.

Use existing i18n conventions.

Required RU labels may be:

```text
Ход заявки
Проблемы и завершения
```

AZ/EN equivalents must exist.

Do not hardcode Russian-only text in component logic.

Preferred conceptual structure:

```text
Всего заявок

Ход заявки
[ NEW ]
[ CHECKING ]
[ PRICE_CHANGED ]
[ CUSTOMER_ACCEPTED ]
[ CONFIRMED ]
[ CONVERTED ]

Проблемы и завершения
[ SUPPLIER_TIMEOUT ]
[ CUSTOMER_PAYMENT_TIMEOUT ]
[ REJECTED ]
[ UNAVAILABLE ]
[ EXPIRED ]
[ CANCELLED_BY_CUSTOMER ]
```

Total stays outside both groups.

---

## 6. Presentation-Only Rule

Do not change KPI business semantics.

Preserve:

```text
KPI counts = server-authoritative overview
click KPI = table-only filter
other KPI counts remain static
selected KPI active
header Status filter synchronized
Total clears active status
Header Period preserved
```

No regrouped sums.

No group-level calculated totals unless they already exist from backend. Prefer labels only.

---

## 7. One-Active Contract

Requests has exactly one table-only KPI filter dimension:

```text
status
```

Required:

```text
click NEW
→ NEW selected

click REJECTED
→ NEW deselected
→ REJECTED selected

click Total
→ status cleared
→ no status KPI selected
```

Do not introduce multi-select behavior.

---

## 8. KPI ↔ Table Header Sync

Existing accepted contract must remain:

```text
KPI click
→ URL status=<value>
→ table filters
→ table Status header reflects same active value

Header filter change
→ same URL status=<value>
→ same table query
→ corresponding KPI selected
```

One state, one URL, one server query, two UI entry points.

Do not add a second grouping-specific filter state.

---

## 9. Header Period Contract

Header Period remains global.

Required:

```text
period change
→ KPI overview recomputes
→ table recomputes
→ compatible selected status remains active
→ page resets appropriately
```

Do not add local Requests date controls.

Registry Reset must not clear Header Period.

---

## 10. Tests to Add / Update

Requests tests must explicitly assert:

```text
12 canonical statuses rendered exactly once
6 statuses in lifecycle group
6 statuses in exceptions group
Total outside both groups
localized lifecycle heading rendered
localized exceptions heading rendered
no flat single-group regression
selected status semantics preserved
KPI ↔ header sync preserved
static KPI overview preserved
Header Period behavior preserved
```

Add/adjust tests only as needed.

Do not rewrite unrelated Orders/Bookings/Payments tests.

---

## 11. Functional Remediation Verification

After code change run relevant targeted tests.

At minimum:

```text
requests-registry
table-header-filter
operations-center-shell
```

Also rerun Orders/Bookings/Payments registry suites if shared component/i18n changed.

Then run:

```text
independent frontend typecheck
production frontend build
```

Known unrelated historical NBSP failure may remain only if exact same signature is reproduced.

---

## 12. Bring Stack Up

Use the already proven live stack configuration:

```text
frontend: http://localhost:3000
backend:  http://localhost:4000
```

Use existing seeded session:

```text
admin / admin123
```

Do not create users or alter RBAC.

If ports differ in actual current repo runtime, use actual configured ports and document them.

---

## 13. Requests Browser Re-Qualification — Mandatory

Open:

```text
/app/requests
```

Prove visually and structurally:

```text
Total visible
lifecycle group heading visible
exceptions group heading visible
6 lifecycle cards visible
6 exception cards visible
all 12 total statuses visible
no duplicate status
no missing status
```

Capture browser evidence.

---

## 14. Requests Runtime Interaction Proof

Run:

```text
1. click one lifecycle KPI
2. verify selected state
3. verify table filters
4. verify header Status sync
5. verify other KPI counts unchanged

6. click one exception KPI
7. verify previous KPI deselected
8. verify new KPI selected
9. verify table/header state updated

10. click Total
11. verify status cleared
12. verify Header Period preserved
```

Record URL and visible table state.

---

## 15. Requests URL / Reload / History

Prove:

```text
KPI click updates ?status=
reload restores selected KPI
reload restores header/table filter
direct deep-link restores state
Total removes status param
Header Period survives where expected
existing replace semantics remain unchanged
```

Back/Forward only needs to restore an actual existing browser history entry; filter toggles themselves need not use push.

---

## 16. Requests API ↔ UI Reconciliation

Use live backend response.

Compare at minimum:

```text
1 lifecycle KPI
1 exception KPI
Total
```

Record:

```text
API value
UI value
match
```

Required: `PASS`.

---

## 17. Complete Remaining Orders Browser Qualification

Verify live browser:

```text
12/12 OrderStatus visible
4/4 OrderPaymentStatus visible
semantic sections visible
one lifecycle status KPI click
Status header sync
one payment KPI click
Payment header sync
status KPI deselected when payment KPI selected
one-active invariant
other KPI counts static
Total clears active KPI
Header Period preserved
```

Also verify no console errors during normal flow.

---

## 18. Complete Remaining Bookings Browser Qualification

Verify:

```text
13/13 Booking statuses visible
PARTIALLY_CONFIRMED absent
AWAITING_CONFIRMATION visible
semantic grouping visible
one lifecycle KPI interaction
one attention/exception KPI interaction
Status header sync
static KPI overview
Total clears status
Header Period preserved
```

No fake lifecycle arrow into AWAITING_CONFIRMATION.

Also inspect browser console.

---

## 19. Complete Remaining Payments Browser Qualification

Verify:

```text
6/6 PaymentStatus
4/4 RefundStatus
dynamic currency cards when seeded
Payment / Refund / Currency semantic groups distinct
one payment KPI click
one refund KPI click
one currency KPI click
exactly one active across all three dimensions
static overview preserved
Total clears active table-only dimension
Header Period preserved
```

Where a table-header filter exists for a dimension, prove sync.

Do not invent a RefundStatus table column in this task.

Browser console must remain clean in normal flow.

---

## 20. Cross-Registry API ↔ UI Reconciliation

Use live backend responses.

Required representative checks:

```text
Requests: 1 lifecycle + 1 exception
Orders: 1 lifecycle + 1 payment
Bookings: 1 lifecycle + 1 attention/exception
Payments: 1 PaymentStatus + 1 RefundStatus + 1 currency
```

For each:

```text
API aggregate == visible UI KPI
```

---

## 21. Cross-Registry Responsive Final Check

Test:

```text
1680 or desktop-wide
1024
671
```

For all four registries verify:

```text
no horizontal page overflow caused by KPI grouping
all required KPI cards remain visible
group headings remain associated
labels not clipped
counts readable
selected state clear
toolbar usable
table usable
```

Requests is the primary remediation target and requires strongest evidence.

Do not hide statuses for narrow widths.

---

## 22. Accessibility Final Check

For all four registries smoke-check, and Requests in detail:

```text
KPI cards keyboard reachable
focus indicator visible
Enter/Space activation works
aria-pressed or equivalent selected state correct
group headings meaningful in DOM
no color-only meaning
zero-value cards understandable
TableHeaderFilter keyboard usable
```

If automated accessibility tooling is available, run it.

Otherwise record browser/DOM inspection evidence.

---

## 23. Browser Console Final Check

Across all four registry runs, no newly introduced:

```text
React errors
hydration errors
duplicate-key warnings
unhandled promise rejections
unexpected normal-flow 4xx/5xx
new accessibility console warnings
```

Known invalid-input backend debt is out of scope and should not be intentionally triggered.

---

## 24. Git Cleanliness — Mandatory

Previous runtime report still had an untracked file:

```text
docs/prompts/PHASE_3_UI_C1_2G_FINAL_QUALIFICATION_GIT_CLOSURE_REMEDIATION.md
```

That means Git was not actually clean.

Resolve this properly.

If that prompt is a legitimate project artifact, commit it according to repository conventions.

Do not leave it untracked merely because it is "intentional".

Final:

```bash
git status --porcelain=v1
```

must produce:

```text
<no output>
```

No exceptions.

---

## 25. No Recursive SHA Commits

Do not create repeated documentation commits to make a report contain its own SHA.

Use:

```text
REMEDIATION IMPLEMENTATION SHA
= commit containing actual Requests grouping fix

FINAL HEAD
= literal git rev-parse HEAD after final push/fetch
```

The authoritative final HEAD is literal Git evidence returned to reviewer.

Do not amend a committed report only to inject the SHA of the commit containing that report.

---

## 26. Required Report

Create:

```text
docs/reports/PHASE_3_UI_C1_2G_RUNTIME_DEFECT_REMEDIATION_FINAL_REQUALIFICATION_REPORT.md
```

Required sections:

```text
start Git state
root cause
files changed
exact Requests grouping implementation
status coverage matrix
tests
typecheck
build
Requests browser evidence
Orders browser evidence
Bookings browser evidence
Payments browser evidence
static KPI proof
one-active proof
KPI↔header proof
Header Period proof
URL/reload/history proof
API↔UI reconciliation
responsive
accessibility
browser console
Git hard closure
final verdict
```

No placeholders.

---

## 27. Required Git Hard Closure

After code/report work:

```bash
git diff --check
git status --porcelain=v1
```

Commit allowed changes.

Then:

```bash
git push origin master
git fetch origin
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git branch --show-current
git log -10 --oneline --decorate
git merge-base --is-ancestor 5203c9f7b8011feb8de2e66808a248b71b10677d HEAD
echo $LASTEXITCODE
```

Required:

```text
working tree clean
HEAD == origin/master
branch = master
UI-C1.2G implementation ancestry = 0
```

Also prove remediation implementation commit is ancestor of final HEAD.

---

## 28. Final Acceptance Matrix

Return literal evidence:

```text
PHASE 3 — UI-C1.2G
RUNTIME DEFECT REMEDIATION + FINAL RE-QUALIFICATION

REQUESTS SEMANTIC GROUPING            — PASS
REQUESTS LIFECYCLE 6/6                — PASS
REQUESTS EXCEPTIONS 6/6               — PASS
REQUESTS TOTAL OUTSIDE GROUPS         — PASS
REQUESTS 12/12 EXACTLY ONCE           — PASS

REQUESTS KPI INTERACTION              — PASS
REQUESTS KPI ↔ HEADER                 — PASS
REQUESTS URL / RELOAD / HISTORY       — PASS
REQUESTS API ↔ UI                     — PASS

ORDERS BROWSER                        — PASS
ORDERS ONE-ACTIVE                     — PASS
ORDERS KPI ↔ HEADER                   — PASS
ORDERS API ↔ UI                       — PASS

BOOKINGS BROWSER                      — PASS
BOOKINGS 13/13                        — PASS
BOOKINGS KPI ↔ HEADER                 — PASS
BOOKINGS API ↔ UI                     — PASS

PAYMENTS BROWSER                      — PASS
PAYMENTS 6/6                          — PASS
REFUNDS 4/4                           — PASS
PAYMENTS ONE-ACTIVE                   — PASS
PAYMENTS API ↔ UI                     — PASS

STATIC KPI OVERVIEW                   — PASS
HEADER PERIOD GLOBAL                  — PASS
TOTAL / RESET CONTRACT                — PASS

RESPONSIVE DESKTOP                    — PASS
RESPONSIVE 1024                       — PASS
RESPONSIVE 671                        — PASS
ACCESSIBILITY                         — PASS
BROWSER CONSOLE                       — PASS

TARGETED TESTS                        — PASS
FULL FRONTEND TESTS                   — PASS / VERIFIED PRE-EXISTING ONLY
INDEPENDENT TYPECHECK                 — PASS
PRODUCTION BUILD                      — PASS

FUNCTIONAL SOURCE CHANGES             — REQUESTS GROUPING ONLY
BACKEND / SCHEMA / DOMAIN CHANGES     — NONE

WORKING TREE CLEAN                    — PASS
HEAD == origin/master                 — PASS
IMPLEMENTATION ANCESTRY               — PASS
REMEDIATION ANCESTRY                  — PASS
GIT HARD CLOSURE                      — PASS

VERDICT A — UI-C1.2G ACCEPTED
```

If any runtime defect remains:

```text
VERDICT B — UI-C1.2G NOT ACCEPTED

BLOCKER:
<exact defect>
```

Do not self-award A without literal evidence.

---

## 29. STOP

After this task:

```text
STOP
```

Do not begin the next stage.

Wait for independent review.
