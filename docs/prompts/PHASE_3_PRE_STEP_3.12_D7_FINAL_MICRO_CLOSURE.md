# PHASE 3 — PRE-STEP 3.12 — D7 — FINAL MICRO-CLOSURE

## ROLE — MANDATORY

Ты работаешь как **Staff/Principal Full-Stack Engineer + Payments/FinTech Architect + Security Engineer + QA/Release Engineer**.

Это **последний узкий micro-closure D7**.

Canonical status:

```text
D5 — ACCEPTED
D6 — ACCEPTED

D7 — NOT YET ACCEPTED
D8 — NOT STARTED

ROUND 2 REPORTED FINAL SHA:
a788feb814a77d06e3c47043d104d7d1212593c6

ONLY REMAINING BLOCKER:
backend-authoritative dueAmount / refundableAmount

TRUE NEXT:
D7 FINAL MICRO-CLOSURE
```

Не переоткрывать уже закрытые D7 области без реального regression.

---

# 1. PRESERVE ALL CLOSED D7 GATES

Round 2 уже доказал и должен сохранить:

```text
Financial History UI
Browser B PAID detail
Browser D financial history
Browser F real Storefront cross-context isolation
Payment/Refund RBAC
Payment/Refund direct-ID qualification
related financial-history isolation
refund invariants
audit atomic rollback
financial concurrency
PCI safety
backend build
frontend build
D5/D6 regressions
Git hard closure at Round 2 SHA
```

Не выполнять новый широкий D7 redesign.

---

# 2. EXACT DEFECT TO CLOSE

Round 2 зафиксировал:

```text
dueAmount:
Math.max(0, amount - paidAmount).toFixed(2)

refundableAmount:
Math.max(0, paidAmount - refundedAmount).toFixed(2)
```

во frontend.

Это нарушает canonical D7 contract:

```text
BACKEND = authoritative financial truth
FRONTEND = formatting / presentation only
```

После micro-closure frontend не должен вычислять authoritative:

```text
dueAmount
refundableAmount
```

из `amount`, `paidAmount`, `refundedAmount`.

---

# 3. CANONICAL FINANCIAL FORMULAS

Исправить также ошибочную формулу из Round 2 report.

Canonical formulas:

```text
totalAmount      = canonical Order total amount
paidAmount       = canonical successful/captured payment projection
refundedAmount   = canonical processed refund projection

dueAmount        = max(0, totalAmount - paidAmount)

refundableAmount = max(0, paidAmount - refundedAmount)

netCollected     = paidAmount - refundedAmount
```

Do NOT use:

```text
dueAmount = paidAmount - refundedAmount
```

No implicit FX.

Currency remains canonical Order/Payment currency according to already accepted D7 contract.

---

# 4. BACKEND AUTHORITY — MANDATORY

Expose authoritative derived values from backend Order detail / canonical financial representation.

Use the existing API structure where possible; do not create unnecessary duplicate contracts.

Required canonical data available to frontend:

```text
totalAmount
paidAmount
refundedAmount
dueAmount
refundableAmount
currency
paymentStatus
```

If `netCollected` is already part of the canonical contract, preserve it consistently.

Calculations must use the project's canonical money representation:

```text
Prisma.Decimal / Decimal equivalent
```

not JS floating-point `Number` for authoritative financial arithmetic.

Apply lower-bound invariant safely:

```text
dueAmount >= 0
refundableAmount >= 0
```

Do not silently introduce new payment/refund semantics.

---

# 5. BOOKING MUST USE SAME FINANCIAL TRUTH

Booking financial presentation already derives from the linked Order.

After the fix, verify that Booking receives/uses the same backend-authoritative values:

```text
Order dueAmount == Booking dueAmount
Order refundableAmount == Booking refundableAmount
```

for the same commerce chain.

Do not implement separate Booking formulas.

Canonical relationship:

```text
Order financial authority
        ↓
Booking financialSummary
        ↓
Booking UI formatting only
```

---

# 6. FRONTEND — FORMATTING ONLY

Remove authoritative derivations such as:

```text
Math.max(0, amount - paidAmount)
Math.max(0, paidAmount - refundedAmount)
```

from Order/Booking financial presentation.

Frontend may:

```text
localize labels
format decimal strings
format currency
format dates
render badges
handle display fallback for missing optional presentation fields
```

Frontend must NOT:

```text
derive dueAmount
derive refundableAmount
change financial state
infer PAID/REFUNDED from amounts
perform authoritative rounding
```

If any fallback remains, prove it is display-only and cannot substitute for missing authoritative API financial values.

Preferred behavior for missing mandatory financial summary:

```text
explicit unavailable/loading/error state
```

rather than silently recomputing financial truth.

---

# 7. MONEY SERIALIZATION

Explicitly inspect serialization boundary:

```text
Decimal DB
→ backend DTO/API
→ frontend
```

Document whether money is serialized as:

```text
decimal string
or
another existing precision-safe canonical representation
```

Do not introduce a new incompatible representation solely for this micro-closure.

Verify:

```text
0.10
0.20
0.30
large valid Decimal(12,2) representative
zero
fully paid
fully refunded
```

No precision drift in authoritative backend calculations.

---

# 8. TARGETED AUTOMATED TESTS

Add/update focused tests proving at least:

```text
total 100.00, paid 30.00
→ due 70.00

paid 100.00, refunded 25.00
→ refundable 75.00

fully paid
→ due 0.00

fully refunded
→ refundable 0.00

lower-bound protection
→ never negative

decimal representative
→ exact 2-decimal financial result
```

Also prove API returns authoritative:

```text
dueAmount
refundableAmount
```

and frontend consumes them rather than recomputing.

If practical, add a frontend unit test or static assertion for the financial component.

---

# 9. REPRESENTATIVE DB → API → ORDER UI → BOOKING UI

Use one real linked paid/refunded representative.

Required table:

| Field | DB/source | API Order | Order UI | API Booking | Booking UI |
|---|---|---|---|---|---|
| totalAmount | | | | | |
| paidAmount | | | | | |
| refundedAmount | | | | | |
| dueAmount | derived backend | | | | |
| refundableAmount | derived backend | | | | |
| currency | | | | | |
| paymentStatus | | | | | |

Required conclusion:

```text
backend computes
API transports
Order UI formats
Booking UI formats
frontend does not derive financial truth
```

---

# 10. SOURCE INSPECTION EVIDENCE

Show exact production-code evidence after remediation.

Required searches or equivalent:

```bash
rg "Math\.max\(0.*paidAmount" frontend
rg "amount.*paidAmount" frontend
rg "paidAmount.*refundedAmount" frontend
rg "dueAmount" frontend backend
rg "refundableAmount" frontend backend
```

Classify every remaining match.

Do not claim frontend formatting-only while an authoritative fallback formula remains.

---

# 11. TARGETED REGRESSION

Run at minimum:

```text
new/updated D7 financial-authority tests
d7-financial-qualification
d5-order-fullpage-audit
d6-booking-fullpage
d6-booking-remediation

backend TSC
backend build

frontend TSC
frontend build
frontend vitest
```

If counts change, report exact counts.

No need to repeat all Browser A–F unless this change causes a regression.

---

# 12. MICRO-CLOSURE ACCEPTANCE MATRIX

Do not shorten:

| Gate | Result | Exact Evidence |
|---|---|---|
| Round 2 SHA reconciled | | |
| Canonical due formula corrected | | |
| Canonical refundable formula correct | | |
| Backend computes dueAmount | | |
| Backend computes refundableAmount | | |
| Backend uses precision-safe money arithmetic | | |
| API exposes dueAmount | | |
| API exposes refundableAmount | | |
| Order UI consumes backend dueAmount | | |
| Order UI consumes backend refundableAmount | | |
| Booking uses same Order financial authority | | |
| Booking UI does not independently derive dueAmount | | |
| Booking UI does not independently derive refundableAmount | | |
| Frontend authoritative FP derivation removed | | |
| Money serialization qualified | | |
| Decimal precision tests PASS | | |
| Lower-bound tests PASS | | |
| DB/API/Order UI/Booking UI reconciliation PASS | | |
| D7 qualification regression PASS | | |
| D5 regression PASS | | |
| D6 regression PASS | | |
| Backend TSC PASS | | |
| Backend build PASS | | |
| Frontend TSC PASS | | |
| Frontend build PASS | | |
| Frontend vitest honestly classified | | |
| Browser D preserved | | |
| Browser F isolation preserved | | |
| No unresolved P0/P1 | | |
| No unresolved acceptance-blocking P2 | | |
| D8 NOT STARTED | | |
| Final report formula is `due = total - paid` | | |
| Final porcelain literally EMPTY | | |
| Final HEAD == origin/master | | |
| One canonical 40-char Final SHA | | |

Any:

```text
FAIL
NOT RUN
NOT PROVEN
acceptance-blocking PARTIAL
```

→ D7 remains NOT ACCEPTED.

---

# 13. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_D7_FINAL_MICRO_CLOSURE_REPORT.md
```

Predominantly Russian.

Required sections:

1. Executive Summary
2. Starting Git State
3. Exact Defect
4. Canonical Financial Formula Correction
5. Backend Financial Authority
6. Money Arithmetic / Serialization
7. Order API Contract
8. Booking Financial Authority
9. Frontend Formatting-Only Proof
10. Source Inspection
11. Targeted Automated Tests
12. DB→API→Order UI→Booking UI Reconciliation
13. Regression Matrix
14. Micro-Closure Acceptance Matrix
15. Git Hard Closure
16. Findings
17. Final Verdict
18. TRUE NEXT

---

# 14. FINAL GIT HARD CLOSURE

At the end:

```bash
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```

Commit and push every code/test/report artifact.

Then repeat:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

Required literal evidence:

```text
$ git status --porcelain=v1
<NO OUTPUT>

$ git rev-parse HEAD
<ONE CANONICAL 40-CHAR SHA>

$ git rev-parse origin/master
<SAME CANONICAL 40-CHAR SHA>
```

Same SHA in:

```text
Executive Summary
Acceptance Matrix
Git Hard Closure
Final Verdict
```

---

# 15. VERDICT A

Only if every applicable micro-closure gate passes:

```text
VERDICT A — PHASE 3 PRE-STEP 3.12 D7 FINAL MICRO-CLOSURE PASSED

D7 — ACCEPTED

FINAL SHA:
<one canonical 40-char SHA>

TRUE NEXT:
D8 — GLOBAL TEMPORAL VISIBILITY

D8 IMPLEMENTATION — NOT STARTED
```

Then STOP.

---

# 16. VERDICT B

If any blocker remains:

```text
VERDICT B — PHASE 3 PRE-STEP 3.12 D7 FINAL MICRO-CLOSURE FAILED

D7 — NOT ACCEPTED
D8 — NOT STARTED

TRUE NEXT:
D7 MICRO-CLOSURE CONTINUATION
```

List exact blockers and STOP.

---

# 17. HARD STOP / OUT OF SCOPE

Do NOT implement:

```text
D8
Booking KPI restoration
Orders KPI redesign
Request/Order/Booking unified detail layout
unified chronology/timeline redesign
Commerce Center UI consistency remediation
```

Those are separate work after D7 acceptance.

This prompt authorizes only:

```text
backend-authoritative dueAmount
backend-authoritative refundableAmount
frontend formatting-only consumption
precision/reconciliation evidence
targeted regression
Git closure
```
