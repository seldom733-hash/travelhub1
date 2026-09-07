# PHASE 3 — UI-C1.2G — RUNTIME QUALIFICATION ONLY
## Browser / API↔UI / Responsive / Accessibility Closure

---

# 0. Purpose

This is a **narrow runtime qualification task only** for:

```text
UI-C1.2G — KPI Semantic Grouping / Lifecycle Flow
```

The functional implementation is already provisionally qualified by CLI evidence.

Do NOT redesign the feature.
Do NOT create another broad remediation cycle.
Do NOT start `UI-C1.2H`.

The only remaining acceptance gap is live runtime evidence.

---

# 1. Accepted Evidence — Do Not Re-Prove Unless Needed

Already established:

```text
UI-C1.2G implementation SHA:
5203c9f7b8011feb8de2e66808a248b71b10677d

TARGETED TESTS        — PASS
FULL FRONTEND TESTS   — PASS / VERIFIED PRE-EXISTING NBSP ONLY
INDEPENDENT TYPECHECK — PASS
PRODUCTION BUILD      — PASS
IMPLEMENTATION ANCESTRY — PASS
```

Known pre-existing unrelated failure:

```text
lib/i18n.spec.ts
Expected: "120,00 ₼"
Received: "120,00 ₼"
```

Do not fix it in this task.

---

# 2. Current Blocker

Previous qualification failed because the live application stack was not reachable.

Observed:

```text
frontend browser target unavailable
ERR_CONNECTION_REFUSED
```

Therefore the following remain unproven:

```text
browser runtime
browser console
API ↔ UI live reconciliation
URL / reload / history
responsive behavior
accessibility runtime
```

This task exists only to close those gates.

---

# 3. First Step — Bring the Existing Stack Up

Before any qualification, inspect the repository and determine the actual canonical startup procedure.

Audit:

```text
README / developer docs
package.json
frontend/package.json
backend/package.json
docker-compose*.yml
.env / .env.example
existing browser/e2e scripts
existing qualification scripts
```

Do not assume:

```text
frontend = :3000
backend = :3001
```

Use the ports and commands actually configured by the repository.

The previous report referenced:

```text
backend/tmp_c12b_browser_verify.py
```

Audit it, but do not blindly rely on hardcoded ports if repository configuration differs.

---

# 4. Stack Startup Diagnosis

If the stack is not already running:

```text
start required infrastructure
start backend
start frontend
verify health/readiness
```

Use the repository-native commands.

Record:

```text
command used
process/service started
actual URL
actual port
health/readiness result
```

At minimum verify the frontend returns a real page and backend API is reachable.

If startup fails:

```text
STOP runtime qualification
diagnose the exact startup failure
```

Report:

```text
failing command
exit code
relevant error
affected service
whether failure is environment/configuration/code
```

Do NOT fabricate browser evidence.

Do NOT create a new architectural implementation merely to make the stack start.

If a trivial local-only launch/config issue is found, fix only what is necessary to run qualification and do not commit machine-specific secrets/config.

---

# 5. Authentication / Test Session

Use the existing canonical test/admin/qualified user flow already present in the repository.

Do not bypass RBAC with frontend hacks.

If login/session setup is needed, use existing fixtures/seeds/scripts.

Record:

```text
workspace/context used
role used
authentication method
```

Do not expose secrets in the report.

---

# 6. Browser Runtime Qualification — All Four Registries

Qualify:

```text
/app/requests
/app/orders
/app/bookings
/app/payments
```

For each registry prove:

```text
page loads successfully
Operations Center shell renders
Header Period visible
no local period controls reappear
Total card visible
semantic KPI groups visible
all canonical KPI cards visible
table renders
toolbar renders
pagination/state remains functional where data requires it
```

---

# 7. Requests Runtime Checks

Verify:

```text
12/12 Request statuses visible

PRIMARY / LIFECYCLE:
NEW
CHECKING
PRICE_CHANGED
CUSTOMER_ACCEPTED
CONFIRMED
CONVERTED

EXCEPTIONS / TERMINAL NEGATIVE:
SUPPLIER_TIMEOUT
CUSTOMER_PAYMENT_TIMEOUT
REJECTED
UNAVAILABLE
EXPIRED
CANCELLED_BY_CUSTOMER
```

Runtime interaction:

```text
click one lifecycle KPI
→ selected
→ table filtered
→ header Status filter synchronized
→ other KPI counts unchanged

click one exception KPI
→ same behavior

click Total
→ active status cleared
→ Header Period preserved
```

---

# 8. Orders Runtime Checks

Verify:

```text
12/12 OrderStatus visible
4/4 OrderPaymentStatus visible
lifecycle grouping visible
exception grouping visible
payment grouping visible
```

Interaction:

```text
click one OrderStatus KPI
→ selected
→ table filtered
→ Status header synchronized

click one OrderPaymentStatus KPI
→ previous status KPI deselected
→ payment KPI selected
→ payment header synchronized
→ exactly one active KPI
→ lifecycle KPI counts remain static
```

Total:

```text
clears active KPI dimension
preserves Header Period
```

---

# 9. Bookings Runtime Checks

Verify:

```text
13/13 canonical Booking statuses visible
PARTIALLY_CONFIRMED absent
AWAITING_CONFIRMATION visible
grouping does not visually assert a fake transition
```

Interaction:

```text
click one lifecycle KPI
→ selected
→ table filtered
→ header Status synchronized
→ overview counts static

click one exception/change KPI
→ same state path

Total
→ clears active status
→ preserves Header Period
```

---

# 10. Payments Runtime Checks

Verify:

```text
6/6 PaymentStatus visible
4/4 RefundStatus visible
dynamic currency cards visible when present in seeded data
Payment / Refund / Currency groups distinct
no mixed-currency total introduced
```

Interaction:

```text
click one PaymentStatus KPI
→ table filtered

click one RefundStatus KPI
→ prior KPI deselected
→ exactly one active KPI

click one currency card
→ prior KPI deselected
→ exactly one active KPI

header filters synchronize for dimensions represented in table headers
```

Preserve:

```text
paymentStatus XOR refundStatus XOR currencyCard
```

---

# 11. Static KPI Overview Proof

For each registry:

```text
capture KPI values before table-only filter
click one KPI
capture remaining KPI values after filter
```

Required:

```text
clicked KPI becomes selected
table changes
other KPI counts do NOT recalculate
other KPI counts do NOT zero
other KPI cards remain visible
```

This is mandatory because it is a core accepted Operations Center contract.

---

# 12. Header Period Runtime Proof

For each registry:

```text
choose period A
record Total / representative KPI
choose period B
record Total / representative KPI
```

Required:

```text
KPI overview recomputes
table recomputes
selected compatible KPI/table-only filter remains where contract requires
page resets appropriately
```

Do not add registry-local date filters.

---

# 13. URL / Reload / History

At minimum qualify:

```text
Requests
Orders or Payments
```

Prove:

```text
KPI click updates canonical URL query
reload restores selected state
reload restores table filtering
direct deep-link restores state
Total removes active KPI query param
Header Period query persists as expected
existing replace-history semantics remain unchanged
```

Back/Forward:

Use an actual existing browser history entry where applicable.

Do not require each filter toggle to create a new history entry because accepted registry behavior uses replace semantics.

---

# 14. Live API ↔ UI Reconciliation

Use actual live API responses.

For each registry compare server aggregate with displayed KPI.

Minimum samples:

```text
Requests:
1 lifecycle status
1 exception status

Orders:
1 lifecycle status
1 payment status

Bookings:
1 lifecycle status
1 attention/exception status

Payments:
1 payment status
1 refund status
1 currency card
```

Record:

```text
API endpoint/query
API value
UI card label
UI value
match = PASS/FAIL
```

Required:

```text
API aggregate == UI KPI value
```

Do not derive server truth from frontend DOM only.

---

# 15. Browser Console

For all four pages inspect console after normal interactions.

Required absence of newly introduced:

```text
React errors
hydration errors
duplicate-key warnings
unhandled promise rejections
unexpected 4xx/5xx during normal flow
new accessibility warnings
```

Known malformed-input backend validation debt is out of scope and should not be intentionally triggered here.

---

# 16. Responsive Qualification

Test:

```text
desktop wide
~1024 px
~671 px
```

At each width, for all four registries smoke-check:

```text
no horizontal page overflow caused by KPI groups
cards wrap correctly
group headings remain visually associated
counts readable
labels not clipped
selected card identifiable
toolbar remains usable
table remains usable
```

Requests must receive the most detailed check because it contains the UI-C1.2G grouping change.

Do not hide canonical cards on narrow screens.

---

# 17. Accessibility Runtime Qualification

At minimum verify:

```text
interactive KPI cards keyboard-focusable
visible focus indicator
Enter/Space activation works where expected
selected card exposes aria-pressed or equivalent
group headings are meaningful in DOM
selected state is not color-only
zero-count KPI remains understandable
TableHeaderFilter remains keyboard accessible
```

If repo already contains automated accessibility tooling, run it.

Otherwise document DOM/browser evidence.

---

# 18. Evidence Format

Prefer durable evidence already supported by the repository:

```text
Playwright result/log
browser verification JSON
screenshots
API response captures
console capture
```

Do not add unnecessary large binaries to Git.

If screenshots/evidence are generated only for review and repository convention does not commit them, leave them outside Git and reference paths/results in the submitted report.

No fabricated PASS entries.

---

# 19. Functional Change Guard

Expected functional source diff for this task:

```text
NONE
```

If runtime qualification discovers a real defect:

```text
STOP
report exact defect
VERDICT B
```

Do not silently patch it under a qualification-only task.

A separate remediation can then be authorized.

---

# 20. Git Discipline

Do not create recursive “final SHA” commits.

Before any documentation commit:

```bash
git status --porcelain=v1
git diff --check
```

Only qualification documentation/evidence may be added if repository conventions require it.

At final closure:

```bash
git push origin master
git fetch origin
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git branch --show-current
git merge-base --is-ancestor 5203c9f7b8011feb8de2e66808a248b71b10677d HEAD
echo $LASTEXITCODE
```

Required:

```text
working tree clean
HEAD == origin/master
branch = master
implementation ancestry = 0
```

For review, the authoritative final SHA is the **literal final `git rev-parse HEAD` output** after push/fetch.

Do not recommit merely to insert that SHA into a report.

---

# 21. Required Runtime Qualification Report

Create:

```text
docs/reports/PHASE_3_UI_C1_2G_RUNTIME_QUALIFICATION_REPORT.md
```

The report must contain actual evidence only:

```text
actual frontend URL
actual backend/API URL
stack startup commands/results
authenticated role/context
Requests runtime matrix
Orders runtime matrix
Bookings runtime matrix
Payments runtime matrix
static KPI proof
Header Period proof
URL/reload/history proof
API↔UI reconciliation table
browser console result
responsive matrix
accessibility result
Git evidence
```

---

# 22. Final Acceptance Matrix

If every runtime gate passes:

```text
PHASE 3 — UI-C1.2G
RUNTIME QUALIFICATION

IMPLEMENTATION SHA:
5203c9f7b8011feb8de2e66808a248b71b10677d

REQUESTS BROWSER                      — PASS
ORDERS BROWSER                        — PASS
BOOKINGS BROWSER                      — PASS
PAYMENTS BROWSER                      — PASS

REQUESTS 12/12                        — PASS
ORDERS 12/12                          — PASS
ORDER PAYMENT 4/4                     — PASS
BOOKINGS 13/13                        — PASS
PAYMENTS 6/6                          — PASS
REFUNDS 4/4                           — PASS
DYNAMIC CURRENCY                      — PASS / N/A IF NO SEEDED CURRENCY ROWS

SEMANTIC GROUPING                     — PASS
STATIC KPI OVERVIEW                   — PASS
ONE-ACTIVE KPI                        — PASS
KPI ↔ HEADER FILTER                   — PASS
TOTAL CONTRACT                        — PASS
HEADER PERIOD GLOBAL                  — PASS

URL / RELOAD / HISTORY                — PASS
LIVE API ↔ UI RECONCILIATION          — PASS
BROWSER CONSOLE                       — PASS

RESPONSIVE DESKTOP                    — PASS
RESPONSIVE ~1024                      — PASS
RESPONSIVE ~671                       — PASS
ACCESSIBILITY                         — PASS

FUNCTIONAL SOURCE CHANGES             — NONE
WORKING TREE CLEAN                    — PASS
HEAD == origin/master                 — PASS
IMPLEMENTATION ANCESTRY               — PASS

VERDICT A — UI-C1.2G RUNTIME QUALIFIED
```

If the live stack still cannot be brought up:

```text
VERDICT B — UI-C1.2G RUNTIME QUALIFICATION BLOCKED

STACK BLOCKER:
<exact service / command / error / exit code>
```

If the stack runs but a product regression is found:

```text
VERDICT B — UI-C1.2G RUNTIME REGRESSION FOUND

DEFECT:
<exact runtime defect>

REPRODUCTION:
<exact steps>
```

---

# 23. STOP

After this runtime qualification:

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
