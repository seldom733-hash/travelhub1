# PHASE 3 — STEP 3.6C.1 — FINAL REMEDIATION / EVIDENCE CLOSURE

## MODE

**TARGETED REMEDIATION ONLY.**

Do not reopen or redesign the already-correct parts of Step 3.6C.

Current implementation baseline:

```text
Starting HEAD for this closure: 2c61c83
```

Verify it rather than assuming it.

Step 3.6C currently has a premature `VERDICT A`. The implementation report shows several mandatory gates were not actually satisfied.

This prompt closes only those remaining gaps.

---

# 1. Already accepted — DO NOT REGRESS

Preserve the completed work:

```text
Refund authority separation:
  finance.refund.write   → create
  finance.refund.approve → approve
  finance.refund.execute → process/fail

Refund SoD:
  SAME-ACTOR ALLOWED
  permission separation preserved

Product authority:
  Partner edit           → catalog.product.update_own_draft
  Partner channels       → catalog.product.channels_own
  Platform moderation    → catalog.product.moderate
  Platform publish/archive → catalog.product.publish
  Platform create        → DENIED

Platform Create Customer → ABSENT
Platform Create Product  → ABSENT
Platform ownerless Product creation → DENIED
Platform Create Order    → ABSENT
Platform Create Booking  → ABSENT

Partner Product creation and anti-spoofing → PRESERVED
```

Do not rename or rework these unless a regression test proves a defect.

---

# 2. Confirmed closure gaps

The Step 3.6C implementation report contradicts its summary in three functional areas.

## GAP A — Payment reason

Summary claimed:

```text
PAYMENT REASON ENFORCED
```

but implementation report states:

```text
Reason: Optional
```

This is not closed.

Required:

```text
Platform manual/offline Payment initiation
→ reason REQUIRED server-side
```

---

## GAP B — Payment permission conflation

Implementation report states:

```text
finance.payment.write
→ create + confirm + fail + cancel
```

and explicitly:

```text
conflation preserved
```

This does not satisfy the Step 3.6C authority-separation gate.

Required:

```text
Payment initiation authority
≠
Payment lifecycle authority
```

---

## GAP C — Order / Booking reason enforcement

Implementation report states:

```text
OrderHistory / BookingHistory exist
Reason field: not added
```

Existing history is useful but does not satisfy:

```text
Platform manual support transition
→ mandatory reason
→ server enforced
→ exact reason stored in history
```

Required for both Orders and Bookings.

---

# 3. Payment reason — server enforcement

For **Platform/manual/offline Payment initiation**, reason must be mandatory.

Required behavior:

```text
Platform POST /payments
without reason
→ 4xx validation/domain response

Platform POST /payments
with blank reason
→ 4xx

Platform POST /payments
with whitespace-only reason
→ 4xx

Platform POST /payments
with valid reason
→ success
```

Use the project's existing validation conventions.

Do not invent a new exception style.

Do not return accidental `500`.

---

# 4. Payment reason scope

Do not incorrectly require a Platform manual reason for:

```text
provider webhook
automatic/system payment event
background reconciliation
other non-human system transition
```

The requirement applies to the Platform/manual initiation path.

If `POST /payments` is exclusively a manual Platform endpoint, DTO-level enforcement may be appropriate.

If the DTO is shared by system paths, enforce at the correct actor/context boundary instead.

Document the decision.

---

# 5. Payment reason persistence

A successful Platform manual Payment must preserve the exact meaningful reason in canonical audit/history.

Current implementation uses:

```text
PaymentHistory.comment
```

Reuse it if it is the canonical appropriate field.

Required evidence:

```text
Payment ID
Order ID
actorId
actorName
reason/comment
timestamp
```

Do not create a second audit subsystem if `PaymentHistory` already satisfies the contract.

---

# 6. Payment amount authority regression

Preserve:

```text
Payment amount = server-derived from Order
```

Direct client amount manipulation must not alter the canonical amount.

Add/retain a regression test.

---

# 7. Payment permission separation

Separate:

```text
manual Payment initiation
```

from:

```text
Payment lifecycle mutation
confirm
fail
cancel
```

Use existing permission naming conventions.

Conceptually:

```text
finance.payment.create
finance.payment.manage
```

or equivalent.

**Do not blindly use these exact names.**

First inspect existing permission taxonomy and choose names consistent with:

```text
finance.refund.write
finance.refund.approve
finance.refund.execute
```

and the rest of the project.

---

# 8. Payment permission migration / role grants

If permissions are DB-backed:

1. add the required granular permission(s);
2. migrate/seed role grants safely;
3. remove obsolete broad bypass semantics;
4. preserve intended Platform role access;
5. do not grant Partner financial Platform authority.

Required proof:

```text
create permission alone
→ cannot confirm/fail/cancel

lifecycle permission alone
→ cannot initiate Payment

both permissions
→ can perform both according to workflow
```

If `finance.payment.write` is retained for backward compatibility, it must not continue to silently grant both authorities through the production authorization path.

---

# 9. Order manual Platform transitions — reason required

Do not redesign the Order state machine.

Preserve current legitimate Platform support authority.

For **Platform-originated manual lifecycle transitions**, require a meaningful reason.

Apply to the actual current Platform support transitions, including those discovered in the audit such as:

```text
accept/process
confirm ready
request booking
complete
close
cancel
suspend
```

Use actual routes/actions.

---

# 10. Order reason API behavior

Required direct API proof:

```text
Platform Order transition without reason
→ 4xx

Platform Order transition with blank reason
→ 4xx

Platform Order transition with valid reason
→ success
```

The successful transition must create/update canonical history with:

```text
Order ID
action
actorId
actorName
reason/comment
previous state
new state
timestamp
```

Use `OrderHistory` if it is already the canonical history mechanism.

Do not add a schema migration merely to duplicate existing fields if `OrderHistory.comment` or equivalent can correctly hold the reason.

---

# 11. Order reason scope isolation

Do not impose Platform support reasons on:

```text
automatic/system Order transitions
event-driven transitions
Partner normal business actions
Customer actions
```

unless those flows are explicitly Platform manual overrides.

The enforcement must be actor/context aware.

---

# 12. Booking manual Platform transitions — reason required

Do not redesign the Booking state machine.

Preserve legitimate Platform support authority.

For **Platform-originated manual Booking lifecycle transitions**, require a meaningful reason.

Audit-confirmed actions include:

```text
send to supplier
confirm
reject
service started
complete
cancel
problem handling
```

Use actual current routes/actions.

---

# 13. Booking reason API behavior

Required:

```text
Platform Booking transition without reason
→ 4xx

Platform Booking transition with blank reason
→ 4xx

Platform Booking transition with valid reason
→ success
```

Successful transition must persist:

```text
Booking ID
action
actorId
actorName
reason/comment
previous state
new state
timestamp
```

Use `BookingHistory` if canonical.

---

# 14. Booking reason scope isolation

Do not require Platform override reasons from:

```text
system-generated Booking transitions
event-driven transitions
Partner normal fulfillment
supplier/system callbacks
```

unless the actual actor is performing a Platform support override.

---

# 15. Frontend UX

Where Platform UI exposes affected manual actions, provide the reason input required by the server.

Do not solve this only on the frontend.

Target:

```text
Platform selects sensitive/manual action
→ reason input
→ validation
→ API request includes reason
```

For actions already using a modal/dialog, extend the existing interaction rather than creating unnecessary new patterns.

Keep layout consistent with existing Platform UI.

---

# 16. RU / AZ / EN

Any new visible reason fields, validation messages, labels, helper text, or action confirmations must use existing i18n.

Verify:

```text
RU
AZ
EN
```

No raw translation keys.

Stored audit reason is user-entered text and must not be automatically translated.

Stored action/event codes should remain locale-neutral.

---

# 17. Negative tests are mandatory

This closure must not be accepted based only on successful requests.

For each mandatory reason flow, prove the **failure path**.

Required negative tests:

```text
Payment without reason → denied
Payment blank reason → denied

Order Platform transition without reason → denied
Order Platform transition blank reason → denied

Booking Platform transition without reason → denied
Booking Platform transition blank reason → denied
```

This is a hard closure gate.

---

# 18. Payment permission negative tests

Required:

```text
Actor with Payment-create permission only:
  create → allowed
  confirm → denied
  fail → denied
  cancel → denied

Actor with Payment-lifecycle permission only:
  create → denied
  lifecycle action → allowed where state permits
```

Use actual permissions/roles.

Do not fake tests by mocking away authorization authority.

---

# 19. Runtime/browser proof

Tests alone are insufficient.

## Payment

In Platform runtime:

```text
open manual/offline Payment action
attempt without reason
→ UI/server prevents completion

enter valid reason
→ Payment created
→ history contains exact reason
```

Verify amount remains server-derived.

## Order

Use a safe test Order:

```text
attempt Platform transition without reason
→ blocked

repeat with valid reason
→ succeeds

inspect history
→ actor + exact reason + transition evidence
```

## Booking

Same pattern:

```text
without reason → blocked
with reason → succeeds
history → correct
```

---

# 20. Direct API proof

Browser UI is not sufficient.

Provide direct API evidence that bypassing the UI fails.

Required examples:

```text
POST /payments without required reason → 4xx

Order transition endpoint without reason → 4xx

Booking transition endpoint without reason → 4xx
```

Then corresponding valid requests succeed.

State exact HTTP status codes.

---

# 21. Existing Step 3.6C regressions

Reverify:

```text
Refund create permission
Refund approve permission
Refund execute permission
SAME-ACTOR policy remains as decided

Partner Product own edit works
Platform Product moderation works
Platform Product publish/archive works
Platform Product create denied
```

Do not let this closure reintroduce `catalog.product.write` seller/governance conflation.

---

# 22. Step 3.6A / 3.6B regressions

Reverify:

```text
Platform Create Customer absent
Platform Create Product absent
Platform ownerless Product API create denied
Partner Product create works
Product.partnerId = actor.partnerId
Partner spoofing prevented
Marketplace PCR attribution regression green
```

No legacy owner reassignment.

Preserve:

```text
31 ownerless Products
30 TEST/SEED
1 UNKNOWN
26 ownerless-linked historical Orders
```

unless an independently justified cleanup occurred.

---

# 23. Required test suites

Run the directly affected suites.

At minimum report exact counts for:

```text
Finance / Payment
Refund
Orders
Bookings
Catalog
CRM
Analytics
Frontend
Backend TSC
Frontend TSC
```

The previous report only gave aggregate CRM/Analytics and frontend counts.

This closure must provide the directly affected domain test evidence as well.

Do not write merely:

```text
all tests pass
```

Report `X/X PASS`.

---

# 24. DB/runtime audit evidence

For at least one successful manual action in each domain:

```text
Payment
Order
Booking
```

show the canonical history/audit record.

Evidence must prove:

```text
actor present
reason present
entity linkage present
timestamp present
state/action linkage present
```

Do not expose secrets or sensitive payment credentials.

---

# 25. No unnecessary schema change

The previous implementation found existing:

```text
PaymentHistory
OrderHistory
BookingHistory
```

Prefer them.

Do not add schema merely because the original prompt mentioned an audit trail.

A schema/migration is only justified if existing history cannot satisfy the required evidence contract.

Explain if migration is necessary.

---

# 26. Git/evidence report correction

The previous implementation report incorrectly remained:

```text
Final HEAD: TBD
origin/master: 1ced16b
```

while later evidence reported:

```text
Final HEAD: 2c61c83
origin/master: 2c61c83
```

This closure must produce one final report **after commit/push** with no stale placeholders.

Required:

```text
Starting HEAD
Final HEAD
origin/master
HEAD == origin/master
git status
```

No `TBD`.

---

# 27. Required final report

Create/update the canonical implementation report only after all closure gates pass.

## A. Verdict

Only:

```text
VERDICT A — PHASE 3 — STEP 3.6C.1 — FULLY CLOSED
```

or:

```text
VERDICT B — PHASE 3 — STEP 3.6C.1 — NOT CLOSED
```

No conditional A.

---

## B. Payment reason proof

Report:

```text
without reason HTTP:
blank reason HTTP:
valid reason HTTP:
history reason:
actor:
amount authority:
```

---

## C. Payment permission separation

Exact final permissions and matrix:

| Permission | Create | Confirm | Fail | Cancel |
|---|---:|---:|---:|---:|

Include actual role grants.

---

## D. Order reason proof

Report:

```text
endpoint/action
without reason HTTP
with reason HTTP
before state
after state
history reason
actor
```

---

## E. Booking reason proof

Same structure.

---

## F. Refund regression

Show:

```text
create
approve
execute
SoD policy
```

still correct.

---

## G. Product regression

Show:

```text
Partner own edit
Platform moderate
Platform publish/archive
Platform create denied
```

---

## H. Tests

Exact domain and regression counts.

---

## I. Browser/runtime

Evidence for:

```text
Payment
Order
Booking
RU
AZ
EN
```

---

## J. DB/history evidence

Exact representative audit/history records.

---

## K. Git

No placeholders:

```text
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
git status:
```

---

# 28. Hard closure gates

`VERDICT A` is forbidden unless all are true:

```text
[ ] Platform manual Payment reason REQUIRED server-side
[ ] Payment missing reason negative API test passes
[ ] Payment blank reason negative API test passes
[ ] Payment valid reason persisted in PaymentHistory
[ ] Payment amount remains server-derived
[ ] Payment create authority separated from lifecycle authority
[ ] create-only permission cannot perform lifecycle
[ ] lifecycle-only permission cannot create
[ ] Platform manual Order transition reason REQUIRED server-side
[ ] Order missing reason negative API test passes
[ ] Order valid reason stored in OrderHistory
[ ] Platform manual Booking transition reason REQUIRED server-side
[ ] Booking missing reason negative API test passes
[ ] Booking valid reason stored in BookingHistory
[ ] system/Partner flows are not incorrectly forced through Platform reason rules
[ ] Refund separation remains correct
[ ] Product governance separation remains correct
[ ] Platform Product create remains denied
[ ] Platform Customer create remains absent
[ ] Platform Order create remains absent
[ ] Platform Booking create remains absent
[ ] directly affected domain tests pass
[ ] CRM/Analytics/frontend regressions pass
[ ] runtime/browser proof exists
[ ] direct API bypass proof exists
[ ] RU/AZ/EN verified
[ ] final report contains real post-commit Git evidence
[ ] no TBD Git fields
```

If even one mandatory gate fails:

```text
VERDICT B — NOT CLOSED
```

---

# 29. Expected closure state

After Step 3.6C.1:

```text
Platform Payment
→ legitimate manual/offline authority
→ separate initiation/lifecycle permission
→ mandatory reason
→ server enforced
→ audited

Platform Order support
→ legitimate support authority
→ mandatory manual-intervention reason
→ audited

Platform Booking support
→ legitimate support authority
→ mandatory manual-intervention reason
→ audited

Refund
→ create / approve / execute separated

Product
→ Partner seller edit
→ Platform governance
→ Platform seller create denied
```

This is an evidence-closure stage.

Do not proceed to another architecture stage automatically.

Return the final report and wait for approval.
