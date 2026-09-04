# PHASE 3 — PRE-STEP 3.12 — D7 — REMEDIATION & EVIDENCE CLOSURE — ROUND 2

## ROLE — MANDATORY
Ты работаешь как **Staff/Principal Full-Stack Engineer + Payments/FinTech Architect + Security Engineer + QA/Release Engineer**.

Canonical status:
```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — NOT ACCEPTED
D8 — NOT STARTED
ROUND 1 REPORTED FINAL SHA:
7dad3eb4e22369fa1a0ffca19a2a5c99edb72ff9
TRUE NEXT:
D7 REMEDIATION & EVIDENCE CLOSURE — ROUND 2
```

Это узкий финальный D7 evidence/UI closure. D8 не начинать.

## 1. PRESERVE CLOSED ROUND 1 GATES
Не переделывать без реального regression:
```text
23/23 D7 qualification tests
refund amount/cumulative/currency invariants
invalid refund rejection
duplicate refund protection
provider webhook architectural N/A
forced RefundHistory failure → rollback
financial concurrency/advisory-lock protection
financial RBAC
Payment/Refund backend ID checks
PCI-safe projection
D5/D6 regressions
Order/Booking financial presentation
i18n cleanup
```

## 2. ONLY FIVE OPEN BLOCKERS
```text
C1 Financial History exposed in canonical UI + real Browser D
C2 Complete real Browser B for PAID detail
C3 Real cross-workspace/tenant/business-context Browser F
C4 backend build + frontend build
C5 COMPLETE original D7 acceptance matrix + Git hard closure
```

## 3. STARTING GIT STATE
Run first:
```bash
git branch --show-current
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```
Reconcile with `7dad3eb4e22369fa1a0ffca19a2a5c99edb72ff9`. If HEAD differs, explain commits.

## 4. C1 — FINANCIAL HISTORY UI + BROWSER D
Round 1 incorrectly marked Browser D as N/A although `GET /orders/:id/financial-history` exists.

Integrate financial history into canonical Order Detail. Preferred:
```text
Order Detail
└─ История изменений / Финансовая история
   ├─ lifecycle events
   ├─ payment events
   └─ refund events
```
A unified typed feed or dedicated section/tab is acceptable. Frontend must consume canonical backend data, not duplicate business logic.

Safely show where applicable:
```text
event label/type
payment/refund transition
amount + currency
actor/system/provider source
timestamp
safe reference
```
Never show PAN, CVV/CVC, tokens, secrets, webhook secrets, sensitive raw payload.

### Browser D — mandatory
Using a real Order:
1. Open `/app/orders/{orderId}`.
2. Open/scroll to financial history.
3. Verify real payment/refund event.
4. Verify amount/currency/source/timestamp/status semantics.
5. Verify no sensitive payment data.
6. Hard refresh and verify persistence.

Report URL, Order id/reference, actor/workspace, event, amount, currency, source, timestamp, refresh result, PCI check.

API/E2E alone does not count.

## 5. C2 — COMPLETE BROWSER B — PAID DETAIL
Round 1 registry badges are insufficient.

Open one real PAID canonical Order detail and verify:
```text
lifecycle status
payment status independently
total
paid
refunded
due
refundable/net if applicable
currency
hard refresh
```

Required reconciliation:
| Field | UI value | API value | DB value |
|---|---|---|---|
| Lifecycle | | | |
| Payment status | | | |
| Total | | | |
| Paid | | | |
| Refunded | | | |
| Due | | | |
| Refundable/Net | | | |
| Currency | | | |

## 6. C3 — REAL CROSS-CONTEXT BROWSER F
Cross-role ≠ cross-context.

Use a real existing financial object from a different implemented context:
```text
PLATFORM vs PARTNER
Marketplace vs Storefront
tenant A vs tenant B
partner A vs partner B
```
Use actual repo architecture.

First prove DB existence:
```text
Order/Booking/Payment/Refund ID
reference
workspace/tenant/partner/context
financial values/status
```
No random nonexistent UUID.

With wrong-context actor, actual browser direct access to canonical financial surface (e.g. `/app/orders/{crossContextOrderId}`) must yield canonical not-found/denial and leak no amount, payment/refund status, provider reference, or existence.

For SAME object test applicable:
```text
detail
financial-history
payment detail
refund detail
payment/refund action
related financial subresource
```
If independent Payment/Refund browser routes do not exist, prove it in code and use owning Order/Booking route plus direct API audit.

Required table:
| Layer | Object exists? | Authorized actor | Wrong-context actor | Result |
|---|---|---|---|---|
| DB | YES | — | — | row exists |
| List/API | | | | |
| Detail API | | | | |
| Financial history | | | | |
| Action | | | | |
| Browser direct URL | | | | |

## 7. C4 — MANDATORY BUILDS
Run exact project equivalents:
```text
backend tsc
backend build
frontend tsc
frontend build
frontend vitest
D7 qualification suite
D5 regression
D6 regression
```
Report exact commands, exit codes, warnings/errors. Backend build and Frontend build must PASS.

## 8. FRONTEND FLOATING-POINT RE-QUALIFICATION
Round 1 claimed no authoritative frontend FP while citing `Math.max(...).toFixed(2)`.

Determine whether this is presentation-only fallback or authoritative calculation.

Preferred contract:
```text
backend authoritative:
dueAmount
refundableAmount
paidAmount
refundedAmount
frontend formats only
```
If frontend derives authoritative money with floating point, remediate it.

Required:
| Field | Backend authoritative value | Frontend behavior | Formatting-only? |
|---|---|---|---|

## 9. RELATED FINANCIAL SUBRESOURCE ISOLATION
Explicitly test `GET /orders/:id/financial-history` using a real cross-context Order:
```text
authorized context → 200
wrong context → canonical 404/denial
```
Audit any other Order/Booking financial subresource. No existence leakage.

## 10. REFUND STATUS VISUAL SEMANTICS
For refunded representative prove in real browser that lifecycle, Payment status, and Refund state are not semantically conflated.

If architecture intentionally projects final refund as `Payment status = REFUNDED` without separate Refund badge, document that exact contract. Do not invent a badge/status.

## 11. COMPLETE ORIGINAL D7 ACCEPTANCE MATRIX — DO NOT SHORTEN
Reproduce every row literally:

| Gate | Result | Exact Evidence |
|---|---|---|
| Starting Git baseline reconciled | | |
| D5 baseline preserved | | |
| D6 baseline preserved | | |
| Current Payment architecture documented | | |
| Current Refund architecture documented | | |
| Financial source-of-truth matrix documented | | |
| Payment status semantics documented | | |
| Refund semantics documented | | |
| Order/Booking/Payment state separation proven | | |
| Canonical calculation formulas documented | | |
| Money precision safe | | |
| Currency rules safe | | |
| No authoritative frontend floating-point calculation | | |
| API financial representation authoritative | | |
| Order financial presentation canonical | | |
| Booking financial presentation canonical | | |
| Order↔Booking financial consistency | | |
| Registry financial semantics consistent | | |
| Payment status visually distinct from lifecycle status | | |
| Refund status visually distinct where applicable | | |
| Financial mass assignment denied | | |
| Payment action authorization server-side | | |
| Refund action authorization server-side | | |
| Provider event idempotency proven or architectural N/A | | |
| Duplicate financial effect prevented | | |
| Refund amount invariant | | |
| Cumulative refund invariant | | |
| Refund currency invariant | | |
| Financial success → immutable audit/event | | |
| Business failure → no false audit | | |
| Forced audit/event failure → financial rollback | | |
| Applicable concurrency invariant proven | | |
| Financial audit actor/source safe | | |
| Financial audit contains no sensitive payment secrets | | |
| PCI-sensitive fields not exposed | | |
| Workspace/tenant list isolation | | |
| Existing cross-context financial object proven | | |
| Payment direct-ID isolation or N/A proven | | |
| Refund direct-ID isolation or N/A proven | | |
| Related financial subresource isolation | | |
| RBAC server-side | | |
| i18n no raw keys | | |
| Browser A pending/unpaid | | |
| Browser B paid | | |
| Browser C refund | | |
| Browser D financial history | | |
| Browser E Order↔Booking consistency | | |
| Browser F cross-context isolation | | |
| DB/API/Order UI/Booking UI/Audit reconciliation | | |
| D7 automated suites PASS | | |
| D5 regression PASS | | |
| D6 regression PASS | | |
| Backend TSC PASS | | |
| Backend build PASS | | |
| Frontend TSC PASS | | |
| Frontend build PASS | | |
| Frontend vitest honestly classified | | |
| No unresolved P0/P1 | | |
| No unresolved acceptance-blocking P2 | | |
| D8 NOT STARTED | | |
| Report predominantly Russian | | |
| Final porcelain literally EMPTY | | |
| Final HEAD == origin/master | | |
| One canonical 40-char Final SHA | | |

Any FAIL / NOT RUN / NOT PROVEN / acceptance-blocking PARTIAL → VERDICT B. N/A requires explicit architectural evidence.

## 12. SECURITY RE-QUALIFICATION — ROUND 2
| Area | Result | Exact Evidence |
|---|---|---|
| RBAC distinct from context isolation | | |
| Existing cross-context financial object | | |
| Wrong-context Order detail | | |
| Wrong-context financial-history | | |
| Wrong-context Payment detail if route exists | | |
| Wrong-context Refund detail if route exists | | |
| Wrong-context financial action | | |
| Browser direct-URL isolation | | |
| No amount/status/provider leakage | | |
| No existence leakage | | |
| Financial History UI PCI-safe | | |
| Frontend financial calculations non-authoritative | | |

Any acceptance-blocking P0/P1/P2 → D7 remains NOT ACCEPTED.

## 13. TARGETED REGRESSION
At minimum:
```text
D7 qualification 23/23 or updated count
D5 order full-page regression
D6 booking full-page regression
D6 booking remediation
backend TSC
backend build
frontend TSC
frontend build
frontend vitest
```
Include new frontend tests if Financial History UI changes components.

## 14. REQUIRED REPORT
Create:
```text
docs/reports/PHASE_3_PRE_STEP_3.12_D7_REMEDIATION_EVIDENCE_CLOSURE_ROUND_2_REPORT.md
```
Predominantly Russian.

Required sections:
1 Executive Summary
2 Starting Git State
3 Preserved Round 1 Gates
4 C1 Financial History UI Architecture
5 Browser D — Financial History
6 C2 Browser B — Paid Detail
7 C3 Cross-Context Representative
8 Browser F — Cross-Context Direct URL
9 Cross-Context API/Subresource Reconciliation
10 Backend Build
11 Frontend Build
12 Frontend Financial Calculation Re-qualification
13 Refund Status Visual Semantics
14 Targeted Regression Matrix
15 Security Re-qualification
16 COMPLETE D7 Acceptance Matrix
17 Git Hard Closure — Literal Output
18 Findings
19 Final Verdict
20 TRUE NEXT

## 15. FINAL GIT HARD CLOSURE
After all work:
```bash
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```
Commit/push every meaningful artifact, then repeat status/HEAD/origin.

Required literal:
```text
$ git status --porcelain=v1
<NO OUTPUT>

$ git rev-parse HEAD
<ONE CANONICAL 40-CHAR SHA>

$ git rev-parse origin/master
<SAME CANONICAL 40-CHAR SHA>
```
Same final SHA in Executive Summary, matrix, Git closure, verdict. No stale SHA, `clean except`, or untracked prompt/report.

## 16. PROHIBITIONS / HARD STOP
Do NOT implement:
```text
D8
Booking KPI restoration
Orders KPI redesign
Request/Order/Booking unified detail layout
unified timeline redesign
commerce UI consistency remediation
```
These are separate future work.

## 17. VERDICT A
Only if every applicable hard gate passes:
```text
VERDICT A — PHASE 3 PRE-STEP 3.12 D7 REMEDIATION & EVIDENCE CLOSURE ROUND 2 PASSED

D7 — ACCEPTED

FINAL SHA:
<one canonical 40-char SHA>

TRUE NEXT:
D8 — GLOBAL TEMPORAL VISIBILITY

D8 IMPLEMENTATION — NOT STARTED
```
Then STOP.

## 18. VERDICT B
If any hard gate remains:
```text
VERDICT B — PHASE 3 PRE-STEP 3.12 D7 REMEDIATION & EVIDENCE CLOSURE ROUND 2 FAILED

D7 — NOT ACCEPTED
D8 — NOT STARTED

TRUE NEXT:
D7 REMEDIATION CONTINUATION
```
List exact blockers and STOP.
