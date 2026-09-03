# PHASE 3 — STEP 3.7B.1 — COMMUNICATION BUSINESS-CONTEXT INTEGRATION — RUNTIME / SECURITY / CONTACT-POLICY / GIT EVIDENCE CLOSURE

## MODE

**EVIDENCE CLOSURE ONLY.**

This is not a new implementation step.

Do not redesign Step 3.7B.

Do not silently remediate newly discovered defects.

The purpose is to prove or disprove the remaining runtime/security gates for the existing Step 3.7B implementation.

If a real defect is found:

```text
STOP
VERDICT B
```

and report the defect precisely.

Do not fix it inside 3.7B.1 unless a separate remediation step is explicitly approved.

---

# 1. Accepted implementation under review

Current Step 3.7B implementation report claims:

```text
VERDICT A — STEP 3.7B IMPLEMENTATION COMPLETE — READY FOR STRICT REVIEW
```

but evidence closure is not yet sufficient.

Current known implementation concerns:

```text
Communication business-context integration
ORDER context
BOOKING context
new GET /communications/context/:contextType/:contextId
server-side actor authorization
existing POST /communications context validation
```

Do not expand scope beyond proving these.

---

# 2. Mandatory repository preflight

Before runtime work:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git log --oneline --decorate -20
```

Record:

```text
Starting HEAD
origin/master
working tree
pre-existing unrelated changes
```

Actual repository state is authoritative.

Do not reset valid later commits.

---

# 3. Evidence gaps to close

This step exists only to resolve:

```text
A. BOOKING own-scope runtime proof
B. BOOKING foreign-scope runtime denial
C. foreign BUYER Order runtime denial
D. Marketplace BASIC seller own-Order contact-policy proof
E. recursive payload leakage inspection
F. final commit/push/Git synchronization
```

Do not repeat broad architecture documentation unnecessarily.

---

# 4. Critical contact-policy question

The current Step 3.7B report says:

```text
ORDER/BOOKING context communications created by staff may contain contact information
```

and also says:

```text
Marketplace Basic does not receive unrestricted Customer contacts
```

This must be proven at runtime.

The critical scenario is:

```text
Marketplace BASIC Partner
        +
its OWN marketplace Order
        +
staff-created Communication linked to that Order
        +
synthetic email/phone in Communication.body
        ↓
GET /communications/context/ORDER/:orderId
```

The result determines whether Step 3.7B preserves or bypasses Step 3.7A.

---

# 5. Build isolated BASIC seller fixture

Create or use an isolated Marketplace Basic Partner that is the actual:

```text
Order.sellerPartnerId
```

for a synthetic Order.

The Order must belong to a synthetic Customer.

The Customer should contain test-only contact values.

Use obviously synthetic values.

Example:

```text
basic-order-contact-test@example.invalid
+994500000001
```

Do not use real PII.

Prefer canonical services/API/test fixtures.

Do not insert invalid rows merely to satisfy the endpoint.

---

# 6. Confirm BASIC tier

For the seller:

```text
GET /partner/crm-tier
```

Required:

```text
HTTP 200
tier = BASIC
```

If this actor is not BASIC:

```text
STOP
fixture invalid
```

---

# 7. Create staff ORDER-context Communication with synthetic contacts

Using an authorized Platform staff actor, create a Communication attached to the BASIC seller's own Order.

Use a body containing synthetic contact information, for example:

```text
Test contact:
basic-order-contact-test@example.invalid
+994500000001
```

Record:

```text
POST /communications
HTTP
CML code
contextType
contextId
body persistence
```

Do not assume staff creation should reject the body.

Record actual behavior.

---

# 8. BASIC seller reads own ORDER context — HARD GATE

As the actual BASIC seller of that Order call:

```text
GET /communications/context/ORDER/:orderId
```

Required evidence:

```text
HTTP status
response keys
communication items
body values
participant projections
context projections
nested metadata
```

This is the most important gate in 3.7B.1.

---

# 9. Interpret contact-policy result honestly

There are two possible outcomes.

## Outcome A — safe

If the BASIC seller receives the Communication but restricted contact values are:

```text
redacted
omitted
not returned
otherwise policy-safe
```

then document the exact enforcement mechanism.

## Outcome B — leak

If the BASIC seller receives raw:

```text
email
phone
URL
social/direct-contact values
```

through `Communication.body` or any nested field, then:

```text
STOP
VERDICT B — STEP 3.7B CONTACT-POLICY REGRESSION CONFIRMED
```

Do not modify production code in 3.7B.1.

Report:

```text
endpoint
actor
Order
CML
actual payload
leaked field/value class
business impact
recommended remediation boundary
```

---

# 10. Important policy distinction

Do not claim that hiding:

```text
Customer.email
Customer.phone
```

is sufficient if the same direct contact data is readable from:

```text
Communication.body
metadata
participant
context
snapshot
```

The policy concerns disclosure, not only DTO field names.

---

# 11. Recursive leakage scan — HARD GATE

For the BASIC own-Order response, recursively inspect:

```text
email
phone
mobile
telephone
whatsapp
telegram
website
url
social
contact
```

Also inspect string values that match obvious contact patterns even if the key is generic:

```text
body
text
message
content
metadata
value
```

Classify every match.

Required final statement:

```text
restricted direct-contact leaks: 0
```

or exact discovered leaks.

---

# 12. URL vector

If staff Communication body accepts URLs, include a synthetic URL in a second test if needed:

```text
https://example.invalid/contact
```

Determine whether BASIC can read it.

Do not assume email/phone behavior automatically proves URL behavior.

---

# 13. BOOKING own-scope fixture

Create/use a Booking that belongs to:

```text
Buyer A / Customer A
Partner A
```

through the canonical Booking → Order relationship.

Do not manually spoof seller/customer authority.

---

# 14. Staff creates BOOKING-context Communication

Create:

```text
contextType = BOOKING
contextId = bookingId
```

using authorized staff.

Required:

```text
HTTP 201 or actual contract success
CML persisted
correct booking context
```

---

# 15. Buyer own BOOKING context — HARD GATE

As the Buyer/Customer who owns the Booking:

```text
GET /communications/context/BOOKING/:bookingId
```

Required:

```text
HTTP 200
correct Communication returned
```

---

# 16. Partner own BOOKING context — HARD GATE

As the actual seller Partner of the Booking:

```text
GET /communications/context/BOOKING/:bookingId
```

Required:

```text
HTTP 200
correct Communication returned
```

If the actor is Marketplace Basic, run the same recursive contact-policy inspection.

---

# 17. Foreign Buyer BOOKING denial — HARD GATE

As Buyer B:

```text
GET /communications/context/BOOKING/:bookingIdOwnedByBuyerA
```

Required:

```text
403 or neutral 404 according to project policy
```

No payload revealing:

```text
booking code
customer
seller
communication count
CML code
```

---

# 18. Foreign Partner BOOKING denial — HARD GATE

As Partner B:

```text
GET /communications/context/BOOKING/:bookingIdOwnedByPartnerA
```

Required:

```text
403/404
```

No existence leak beyond accepted project semantics.

---

# 19. Foreign Buyer ORDER denial — HARD GATE

As Buyer B:

```text
GET /communications/context/ORDER/:orderIdOwnedByBuyerA
```

Required:

```text
403/404
```

This runtime case was missing from the Step 3.7B report.

Record exact result.

---

# 20. Own Buyer ORDER positive check

As Buyer A:

```text
GET /communications/context/ORDER/:ownOrderId
```

Required:

```text
HTTP 200
```

This verifies the foreign-Buyer denial is not a false negative caused by a broken endpoint.

---

# 21. Platform permission regression

Use at least:

```text
authorized Platform staff
staff actor without communication.read
```

Expected:

```text
authorized staff → 200
unauthorized staff → 403
```

Do not over-test every role.

---

# 22. Anonymous regression

Call one ORDER or BOOKING context endpoint without auth.

Expected:

```text
401
```

---

# 23. Context existence behavior

Test one nonexistent:

```text
ORDER
BOOKING
```

context id.

Expected controlled:

```text
404
```

or current project contract.

No raw 500.

---

# 24. Unsupported context behavior

If route takes enum/path input, test unsupported value.

Expected:

```text
400/422
```

according to validation convention.

No raw 500.

---

# 25. Participant spoofing regression

If POST `/communications` body accepts participant identifiers, try forged values where applicable.

Prove the server still derives/validates participant-context consistency.

At minimum verify one:

```text
Order belongs Partner A
request claims Partner B
→ rejected / ignored safely
```

Do not expand into a broad fuzzing campaign.

---

# 26. Reverse-conversation anti-disintermediation regression

Do not repeat full prior investigation.

Run a compact regression:

```text
normal message → success
email → 422
phone → 422
URL → 422
```

This confirms 3.7B did not weaken the pre-sale path.

---

# 27. Do not conflate two surfaces

Keep separate:

```text
Reverse pre-sale chat
→ anti-disintermediation validation

Generic ORDER/BOOKING Communication
→ business-context integration
```

If generic Order/Booking Communication exposes direct contacts to BASIC, that is a new bypass even though reverse chat remains protected.

---

# 28. Contact-policy severity if defect exists

If BASIC can read raw staff-entered direct contacts from Order/Booking Communication, classify based on business rules.

Likely category:

```text
P1 — Marketplace anti-disintermediation/contact-policy bypass
```

Do not call it cross-tenant if the BASIC Partner legitimately owns the Order.

The defect would be:

```text
authorized relationship
+
wrong disclosure policy
```

not:

```text
foreign tenant access
```

---

# 29. No silent remediation

If any of the following fails:

```text
BASIC own-Order contact policy
BOOKING own/foreign scope
foreign Buyer Order isolation
participant-context authority
```

then return:

```text
VERDICT B
```

and stop.

Do not:

```text
add redaction
change DTOs
change service authorization
add moderation
change permissions
```

inside this evidence step.

---

# 30. Fixture cleanup

All synthetic:

```text
Customer
Order
Booking
Communication
thread/message
temporary entitlement state
```

must be cleaned or rolled back according to project test conventions.

Report cleanup counts/state.

Do not leave fake business data in normal runtime DB.

---

# 31. Automated tests

Run the relevant suites after evidence.

At minimum:

```text
Communication
CRM
Orders
Bookings
```

If implementation touches Sales context indirectly, include Sales.

Run:

```text
Backend TSC
```

Frontend tests/TSC only if frontend changed.

Do not copy previous counts.

Report actual counts.

---

# 32. No frontend changes expected

Current Step 3.7B report says:

```text
Frontend changes: NONE
```

If that remains true:

```text
Browser evidence: N/A
```

is acceptable.

Do not invent browser screenshots for backend-only work.

If production frontend changes are introduced unexpectedly:

```text
STOP
out-of-scope change
```

unless separately justified.

---

# 33. Git closure — HARD GATE

The prior implementation report had:

```text
Final HEAD: pending
commit: pending
```

This must be resolved.

After evidence and, if valid, implementation commit:

```bash
git status
git diff --stat
git log --oneline --decorate -10
git rev-parse HEAD
git rev-parse origin/master
```

If the implementation itself was not yet committed, commit only intended Step 3.7B files.

If it was committed after the prior report, identify exact SHA.

Do not create an empty commit solely to satisfy evidence.

---

# 34. Evidence/report commit

If project convention commits the evidence report:

```text
production changes: NONE
evidence/report commit only
```

and record its SHA separately.

Do not overwrite the implementation SHA with the report SHA.

---

# 35. Working-tree honesty

Previous reports had unrelated:

```text
D backend/src/reconcile-2c2.ts
D docs/prompts/PHASE_3_STEP_3.5E_PARTNER_CRM_ANALYTICS_READ_MODEL_IMPLEMENTATION_REPORT.md
multiple untracked prompt files
```

Check actual state.

Do not stage/restore/delete unrelated changes.

Do not say:

```text
working tree clean
```

if those remain.

---

# 36. Required final report

## A. Verdict

Only one of:

```text
VERDICT A — STEP 3.7B.1 RUNTIME / SECURITY / CONTACT-POLICY / GIT EVIDENCE CLOSURE — PASS
STEP 3.7B READY FOR STRICT REVIEW
```

or:

```text
VERDICT B — STEP 3.7B.1 EVIDENCE CLOSURE FAILED
STEP 3.7B NOT READY FOR STRICT REVIEW
```

---

## B. Git baseline

```text
Starting HEAD:
origin/master:
working tree:
```

---

## C. BASIC own-Order contact-policy matrix

| Test | HTTP | CML visible? | Email visible? | Phone visible? | URL visible? | Result |
|---|---:|---:|---:|---:|---:|---|

Mandatory:

```text
staff create Order-context CML
BASIC seller list own Order context
recursive payload scan
```

---

## D. BOOKING runtime matrix

| Actor | Booking relation | HTTP | Communication visible? | Result |
|---|---|---:|---:|---|

Mandatory:

```text
Buyer own
Buyer foreign
Partner own
Partner foreign
```

---

## E. ORDER buyer-isolation matrix

| Actor | Relation | HTTP | Result |
|---|---|---:|---|

Mandatory:

```text
Buyer own
Buyer foreign
```

---

## F. Platform/auth matrix

```text
authorized staff
unauthorized staff
anonymous
```

---

## G. Contact leakage scan

Return:

```text
keys inspected:
values inspected:
restricted direct-contact leaks:
```

If leaks exist, show sanitized evidence.

---

## H. Reverse chat regression

```text
normal:
email:
phone:
URL:
```

---

## I. Automated tests

Exact actual numbers:

```text
Communication:
CRM:
Orders:
Bookings:
Sales: N/A or X/X
Backend TSC:
Frontend: N/A unless changed
```

---

## J. Cleanup

```text
Customer fixture:
Order fixture:
Booking fixture:
Communication fixture:
other fixture:
normal runtime data:
```

---

## K. Git final

```text
Implementation SHA:
Evidence/report SHA:
Final HEAD:
origin/master:
HEAD == origin/master:
production changes in 3.7B.1:
working tree:
pre-existing unrelated changes:
```

No placeholders.

---

# 37. Hard closure gates

`VERDICT A` is forbidden unless:

```text
[ ] actual starting Git state recorded
[ ] actual BASIC seller owns tested Order
[ ] BASIC tier proven
[ ] staff-created Order Communication contains synthetic contact test
[ ] BASIC own-Order response executed
[ ] BASIC own-Order payload recursively inspected
[ ] direct-contact leakage result explicit
[ ] URL vector checked where applicable
[ ] Buyer own Booking → 200
[ ] Buyer foreign Booking → denied
[ ] Partner own Booking → 200
[ ] Partner foreign Booking → denied
[ ] Buyer own Order → 200
[ ] Buyer foreign Order → denied
[ ] authorized Platform staff → 200
[ ] unauthorized staff → 403
[ ] anonymous → 401
[ ] nonexistent context controlled
[ ] unsupported context controlled
[ ] participant spoof regression checked
[ ] reverse chat normal/email/phone/URL regression passes
[ ] fixtures cleaned
[ ] actual automated test counts supplied
[ ] Backend TSC passes
[ ] implementation commit SHA resolved
[ ] origin synchronization proven
[ ] dirty-tree state reported honestly
[ ] no defect silently remediated
```

Any failed hard gate:

```text
VERDICT B
STEP 3.7B NOT READY FOR STRICT REVIEW
```

---

# 38. Stop condition

After this evidence run:

1. return the narrow final report;
2. if any contact leak or scope defect exists, stop with `VERDICT B`;
3. do not remediate it;
4. if all gates pass, state `STEP 3.7B READY FOR STRICT REVIEW`;
5. do not perform Strict Review in the same step;
6. do not start Step 3.7C or any later stage;
7. wait for review.
