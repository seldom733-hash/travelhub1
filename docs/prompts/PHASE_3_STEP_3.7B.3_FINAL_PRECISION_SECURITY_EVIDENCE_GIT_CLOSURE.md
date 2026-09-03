# PHASE 3 — STEP 3.7B.3 — FINAL PRECISION / SECURITY EVIDENCE / GIT CLOSURE

## MODE

**NARROW FINAL REMEDIATION + EVIDENCE CLOSURE ONLY**

This step exists because Step 3.7B.2 successfully closed the confirmed P1 contact-disclosure bypass, but three hard gates remain:

```text
1. business-identifier false positive in BASIC sanitizer
2. unauthorized Platform staff runtime denial not proven
3. participant spoofing runtime not proven
4. final Git closure still pending
```

Do not redesign Communication.

Do not change the Step 3.7B business-context model.

Do not start Step 3.7C.

Do not perform Strict Review in this step.

Successful outcome:

```text
STEP 3.7B READY FOR STRICT REVIEW
```

not:

```text
STEP 3.7B APPROVED
STEP 3.7B CLOSED
```

---

# 1. Mandatory repository preflight

Run:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git log --oneline --decorate -20
```

Read:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Confirm Step 3.7B is still the active implementation awaiting Strict Review.

Record:

```text
Starting HEAD:
origin/master:
working tree:
pre-existing unrelated changes:
```

Actual repository state is authoritative.

---

# 2. Accepted remediation baseline

Preserve the Step 3.7B.2 architecture:

```text
stored Communication
        ↓
actor/context authority
        ↓
Partner entitlement resolution
        ↓
policy-aware DTO projection
        ↓
BASIC sanitized
PRO original
Platform original
```

Preserve:

```text
stored Communication body immutable
schema unchanged
migration NONE
backfill NONE
server-side enforcement
```

Do not revert to destructive body mutation.

---

# 3. Already accepted Step 3.7B.2 results

Do not re-litigate these unless your new change touches them:

```text
BASIC own ORDER → 200 + contacts hidden
BASIC own BOOKING → 200 + contacts hidden
PRO own ORDER → full contacts preserved
Platform ADMIN → full original preserved
Buyer own ORDER → 200
Buyer foreign ORDER → 404
Buyer own BOOKING → 200
Buyer foreign BOOKING → 404
Partner own/foreign object-scope → correct
historical CML protected by read-time projection
```

However, rerun focused regression after the precision fix.

---

# 4. Confirmed precision defect

Step 3.7B.2 produced:

```text
TH-2026-000001
↓
TH-[contact hidden]
```

because the canonical anti-disintermediation phone detector treated the numeric sequence as a phone-like token.

This is a false positive.

It is not acceptable to permanently destroy canonical business identifiers in authorized business communication.

---

# 5. Required precision invariant

Marketplace BASIC must satisfy both:

```text
A. direct contacts are hidden
B. legitimate business identifiers remain readable
```

The sanitizer must preserve at minimum canonical patterns actually used by the repository, including where applicable:

```text
Order code
Booking code
Payment code
Refund code
Invoice code
Quote code
Sale code
Opportunity code
Lead code
CML code
other registered business-code prefixes
```

Do not invent unsupported formats.

Audit the actual ID/code registry or existing entity code conventions before implementation.

---

# 6. Do not weaken contact detection globally

Do NOT weaken the canonical shared anti-disintermediation detector such that real phones start passing.

Avoid broad changes such as:

```text
reduce phone minimum length globally
remove separator handling
disable digit matching
skip all hyphenated numbers
```

The correction should be precise.

Preferred architecture:

```text
content
  ↓
protect recognized canonical business identifiers
  ↓
apply canonical contact sanitization
  ↓
restore protected business identifiers
```

or another equally safe repository-consistent mechanism.

Do not duplicate regex libraries unnecessarily.

---

# 7. Business identifier source of truth

Before coding, inspect the actual project registry/conventions for prefixes.

Use real canonical patterns such as project-defined:

```text
TH-...
ORD-...
BKG-...
PAY-...
RFD-...
INV-...
QTE-...
SAL-...
OPP-...
LED-...
CML-...
```

Only include patterns that are truly present in the repository.

Do not maintain an arbitrary handwritten list if there is an existing registry/helper that can be reused.

Document the final source of truth.

---

# 8. Precision behavior

For BASIC output:

```text
"Order TH-2026-000001, contact +994500000001"
```

must become conceptually:

```text
"Order TH-2026-000001, contact [contact hidden]"
```

not:

```text
"Order TH-[contact hidden], contact [contact hidden]"
```

and not:

```text
"Order [contact hidden], contact [contact hidden]"
```

The canonical business code must survive exactly.

---

# 9. Contact classes must remain blocked

After the precision fix, verify the BASIC sanitizer still hides:

```text
email
phone
URL
supported social/contact handle classes
```

Use synthetic values only.

Example:

```text
precision-test@example.invalid
+994500000001
https://example.invalid/contact
```

---

# 10. Mixed-content precision test

Use a single body containing both business identifiers and contacts.

Example structure:

```text
Order TH-2026-000001
Booking BKG-...
Payment PAY-...
Email precision-test@example.invalid
Phone +994500000001
URL https://example.invalid/contact
```

Expected:

```text
all canonical business identifiers preserved
all restricted contact values hidden
ordinary prose preserved
```

---

# 11. False-negative safety

Add negative assertions proving real contact data is still removed.

Do not declare precision fixed merely because `TH-*` survives.

Required:

```text
raw email absent
raw phone absent
raw URL absent
```

---

# 12. Historical CML precision

Use one already-stored or fixture-stored Communication containing:

```text
business code + direct contacts
```

Read as BASIC after persistence.

Prove:

```text
stored original unchanged
business code preserved in projection
contacts hidden
```

No destructive DB rewrite.

---

# 13. ORDER runtime precision

As Marketplace BASIC seller of own Order:

```text
GET /communications/context/ORDER/:orderId
```

Required:

```text
HTTP 200
Order business code readable
raw email absent
raw phone absent
raw URL absent
```

---

# 14. BOOKING runtime precision

As Marketplace BASIC seller of own Booking:

```text
GET /communications/context/BOOKING/:bookingId
```

Required:

```text
HTTP 200
Booking/business identifiers readable
raw email absent
raw phone absent
raw URL absent
```

---

# 15. PRO regression

As Storefront PRO seller:

```text
GET /communications/context/ORDER/:ownOrderId
```

Prove original body remains unchanged.

If Booking context is available for Pro fixture, prove it too.

No accidental sanitization of Pro.

---

# 16. Platform authorized regression

As authorized Platform staff:

```text
GET /communications/context/ORDER/:id
```

Required:

```text
200
original body
contacts visible according to internal policy
business codes unchanged
```

---

# 17. Unauthorized Platform staff — HARD GATE

The prior evidence never proved this.

Use a legitimate authenticated internal actor without:

```text
communication.read
```

or whichever exact permission the endpoint requires.

Call:

```text
GET /communications/context/ORDER/:id
```

Required:

```text
403
```

Do not use anonymous as a substitute.

If all normal staff roles currently receive `communication.read`, create a controlled test-role/user fixture according to project test conventions without changing production RBAC defaults.

Do not modify canonical role defaults simply to produce evidence.

Report:

```text
actor role
permission set relevant to communication
HTTP result
```

---

# 18. Participant spoofing — HARD GATE

Execute an actual spoof attempt.

Example:

```text
Order seller = Partner A
client payload tries to use Partner B
```

or equivalent participant/customer mismatch supported by the existing API.

Required:

```text
rejected with controlled 4xx
```

or:

```text
server safely ignores supplied participant and derives authority from context
```

Record exact request shape and exact response status.

Do not satisfy this with source-code reasoning alone.

---

# 19. Buyer object-scope focused regression

Rerun:

```text
Buyer A own ORDER → 200
Buyer B foreign ORDER → 403/404
Buyer A own BOOKING → 200
Buyer B foreign BOOKING → 403/404
```

This is a focused regression, not a new broad evidence campaign.

---

# 20. Partner object-scope focused regression

Rerun at least:

```text
Basic Partner own ORDER → 200
Basic Partner foreign ORDER → 403/404
Basic Partner own BOOKING → 200
foreign Partner BOOKING → 403/404
```

---

# 21. Anonymous regression

Required:

```text
anonymous → 401
```

on one context endpoint.

---

# 22. Reverse pre-sale chat regression — MUST BE EXECUTED NOW

Do not cite Step 3.7A.2 as substitute.

Run current runtime/test path:

```text
normal harmless message → success
email → 422
phone → 422
URL → 422
```

Confirm rejected messages do not persist.

This ensures the precision change did not weaken shared detection.

---

# 23. Sanitizer unit tests

Add targeted tests for:

```text
Order code preserved
Booking code preserved
multiple canonical codes in same body preserved
email hidden
phone hidden
URL hidden
business code adjacent to punctuation preserved
business code + phone in same string
business code + URL in same string
ordinary numeric business values not unnecessarily destroyed where safe
```

Do not overfit only `TH-2026-000001`.

---

# 24. No generic bypass whitelist

Do not implement unsafe rules like:

```text
if text contains "TH-" skip phone sanitization
```

The contact value must still be removed from the same string.

Likewise do not whitelist entire lines that contain business codes.

Protection must be span-level or equivalently precise.

---

# 25. Endpoint audit regression

Confirm the Step 3.7B.2 policy still applies across:

```text
GET /communications/context/:contextType/:contextId
GET /communications/own
GET /communications/:code
```

Where BASIC can legitimately read the CML.

No alternate raw-body path may remain.

---

# 26. Recursive leakage scan

For BASIC responses inspect all string values.

Return separately:

```text
raw emails:
raw phone numbers:
raw URLs:
business identifiers preserved:
overall restricted direct-contact leaks:
```

PASS requires:

```text
overall restricted direct-contact leaks = 0
business identifiers preserved = YES
```

---

# 27. Database

Expected:

```text
schema changes: 0
migration: NONE
backfill: NONE
stored Communication mutation: 0
```

If schema appears required:

```text
STOP
ARCHITECTURE REVIEW REQUIRED
```

Do not introduce persistence for sanitizer precision.

---

# 28. Frontend

Expected:

```text
Frontend production changes: NONE
```

No frontend fix is required for this backend projection problem.

If frontend changes occur, justify them explicitly and run RU/AZ/EN.

Do not make frontend the security boundary.

---

# 29. Automated suites

Run actual relevant tests after final remediation.

At minimum:

```text
Communication
CRM
Orders
Bookings
```

Include:

```text
Analytics
```

if shared CRM/entitlement code remains touched.

Run:

```text
Backend TSC
```

Run frontend tests/TSC only if frontend changed, unless project CI convention requires them globally.

Report actual numbers, not copied counts.

---

# 30. Fixture cleanup

Clean or rollback all synthetic:

```text
Customer
Partner
Order
Booking
Communication
Buyer users
test staff user/role
temporary entitlement state
```

Report exact cleanup.

Do not leave synthetic PII-like data.

---

# 31. Git closure — HARD GATE

The previous report ended with:

```text
Final HEAD: pending
```

This is not allowed again.

Before commit:

```bash
git status
git diff --stat
git diff
```

Stage only intended Step 3.7B.3 files.

Commit/push.

Then run:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status
git log --oneline --decorate -10
```

Final report must contain real SHA values.

No `pending`.

---

# 32. Separate implementation vs report SHA

If the evidence report is committed separately, report:

```text
Precision remediation SHA:
Evidence/report SHA:
Final HEAD:
```

Do not replace the production-remediation SHA with the report-only SHA.

---

# 33. Working-tree honesty

Do not stage or clean unrelated pre-existing files.

Report them honestly.

Do not say:

```text
working tree clean
```

if unrelated deletions/untracked files remain.

---

# 34. Required final report

## A. Verdict

Only one of:

```text
VERDICT A — STEP 3.7B.3 FINAL PRECISION / SECURITY EVIDENCE / GIT CLOSURE — PASS
STEP 3.7B READY FOR STRICT REVIEW
```

or:

```text
VERDICT B — STEP 3.7B.3 INCOMPLETE
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

## C. False-positive root cause

Explain exactly why the phone/contact sanitizer matched canonical business codes.

Show the affected detector/pattern/flow.

---

## D. Precision remediation

Describe exact mechanism:

```text
business identifier detection/protection
contact sanitization
restoration/safe projection
```

or actual equivalent.

Identify exact files/functions.

---

## E. Business-code preservation matrix

| Input | Expected | Actual | PASS |
|---|---|---|---|

Include all actual canonical code patterns tested.

---

## F. Contact blocking matrix

| Contact class | Input | BASIC output | Leak? |
|---|---|---|---|
| Email | synthetic | hidden | NO |
| Phone | synthetic | hidden | NO |
| URL | synthetic | hidden | NO |

Include supported social/contact class if applicable.

---

## G. Mixed-content runtime

Show one real BASIC payload containing:

```text
business code(s)
email
phone
URL
ordinary prose
```

Prove:

```text
business code preserved
contacts hidden
prose preserved
```

---

## H. ORDER / BOOKING runtime

Return exact statuses for:

```text
Basic own ORDER
Basic foreign ORDER
Basic own BOOKING
foreign Partner BOOKING
Buyer own ORDER
Buyer foreign ORDER
Buyer own BOOKING
Buyer foreign BOOKING
```

---

## I. Platform authorization

Return:

```text
authorized Platform staff → 200
unauthorized authenticated staff → 403
anonymous → 401
```

Show role/permission basis for unauthorized actor.

---

## J. Participant spoofing

Show:

```text
attempted forged fields
actual owner/context
HTTP result
persisted result
```

Required safe outcome.

---

## K. Reverse-chat current regression

Actual executed results:

```text
normal:
email:
phone:
URL:
rejected-message persistence:
```

No historical citation-only proof.

---

## L. Endpoint policy audit

| Endpoint | BASIC safe projection | Raw alternate path remaining? |
|---|---:|---:|

Include:

```text
/context/:type/:id
/own
/:code
```

where applicable.

---

## M. Source-fact integrity

```text
stored original preserved:
Platform sees original:
Pro sees original:
Basic sees sanitized:
historical CML protected:
```

---

## N. Database

```text
schema:
migration:
backfill:
data mutation:
```

---

## O. Tests

Actual:

```text
Communication:
CRM:
Orders:
Bookings:
Analytics:
Frontend:
Backend TSC:
Frontend TSC:
```

Use N/A only with reason.

---

## P. Cleanup

Exact fixture cleanup.

---

## Q. Changed files

For each:

```text
path
purpose
production/test/docs
```

---

## R. Git final

```text
Starting HEAD:
Precision remediation SHA:
Evidence/report SHA:
Final HEAD:
origin/master:
HEAD == origin/master:
production changes:
working tree:
pre-existing unrelated changes:
```

No placeholders.

---

## S. Strict Review readiness

```text
READY FOR STEP 3.7B STRICT REVIEW: YES/NO
```

Do not start review.

---

# 35. Hard PASS gates

`VERDICT A` is forbidden unless:

```text
[ ] canonical business-code false positive reproduced
[ ] root cause identified
[ ] fix is precise, not broad detector weakening
[ ] actual canonical code source/registry inspected
[ ] Order code preserved
[ ] Booking code preserved where applicable
[ ] other tested canonical business IDs preserved
[ ] email still hidden for BASIC
[ ] phone still hidden for BASIC
[ ] URL still hidden for BASIC
[ ] mixed code+contact content behaves correctly
[ ] harmless ordinary prose preserved
[ ] historical stored CML original unchanged
[ ] Basic own ORDER safe
[ ] Basic own BOOKING safe
[ ] Pro original view preserved
[ ] Platform original view preserved
[ ] unauthorized authenticated Platform staff → 403
[ ] participant spoof attempt executed and safely rejected/overridden
[ ] Buyer own/foreign ORDER runtime passes
[ ] Buyer own/foreign BOOKING runtime passes
[ ] Partner own/foreign runtime passes
[ ] anonymous → 401
[ ] current reverse-chat normal path succeeds
[ ] current reverse-chat email → 422
[ ] current reverse-chat phone → 422
[ ] current reverse-chat URL → 422
[ ] rejected reverse-chat contacts do not persist
[ ] all BASIC-readable Communication endpoints audited
[ ] recursive BASIC leakage scan = 0
[ ] no schema/migration/backfill
[ ] fixtures cleaned
[ ] relevant tests pass
[ ] Backend TSC passes
[ ] exact remediation SHA exists
[ ] exact report SHA resolved if committed
[ ] Final HEAD == origin/master
[ ] no `pending`
[ ] dirty-tree state reported honestly
[ ] Step 3.7B not marked APPROVED
```

Any failed mandatory gate:

```text
VERDICT B
STEP 3.7B NOT READY FOR STRICT REVIEW
```

---

# 36. Stop condition

After this final precision/evidence pass:

1. commit and push;
2. return the final report;
3. if any business identifier is still wrongly destroyed or any direct-contact leak remains, return `VERDICT B`;
4. if unauthorized staff or spoofing evidence is missing, return `VERDICT B`;
5. if Git still contains `pending`, return `VERDICT B`;
6. if all gates pass, state only:

```text
STEP 3.7B READY FOR STRICT REVIEW
```

7. do not perform Strict Review;
8. do not mark Step 3.7B APPROVED;
9. do not start Step 3.7C;
10. wait for review.
