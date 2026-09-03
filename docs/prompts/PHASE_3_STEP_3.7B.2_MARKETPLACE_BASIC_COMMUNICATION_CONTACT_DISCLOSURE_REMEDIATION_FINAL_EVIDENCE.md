# PHASE 3 — STEP 3.7B.2 — MARKETPLACE BASIC COMMUNICATION CONTACT-DISCLOSURE REMEDIATION + FINAL RUNTIME EVIDENCE

## MODE

**NARROW SECURITY / BUSINESS-POLICY REMEDIATION.**

This step exists because Step 3.7B.1 runtime evidence confirmed a real P1 disclosure path:

```text
Marketplace BASIC seller
        ↓
owns Order / Booking
        ↓
GET /communications/context/ORDER|BOOKING/:id
        ↓
Communication.body
        ↓
raw email / phone / URL readable
```

This is an authorized business relationship with an incorrect disclosure policy.

It is **NOT** a cross-tenant defect.

It is:

```text
P1 — Marketplace anti-disintermediation / direct-contact disclosure bypass
```

The objective is to close this exact gap, prove the missing Step 3.7B runtime gates, commit/push, and return Step 3.7B to readiness for separate Strict Review.

Do not redesign the Communication domain.

Do not start Step 3.7C.

Do not perform Strict Review in this step.

---

# 1. Mandatory preflight

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

Confirm Step 3.7B remains the active implementation under remediation and no later canonical NEXT has superseded it.

Record actual:

```text
Starting HEAD
origin/master
working tree
pre-existing unrelated changes
```

Do not assume the previous report's SHA if repository history has advanced.

---

# 2. Accepted Step 3.7B implementation baseline

Latest reported implementation SHA:

```text
576b076
```

Actual repository history is authoritative.

Step 3.7B architecture that should be preserved:

```text
Communication.contextType/contextId reused
ORDER context supported
BOOKING context supported
GET /communications/context/:contextType/:contextId
server-side context existence validation
server-side actor/context authorization
no schema migration
no duplicate messaging domain
```

Do not reimplement these from scratch.

---

# 3. Confirmed defect

Step 3.7B.1 proved:

```text
Staff creates ORDER-context Communication
body contains synthetic email + phone + URL
        ↓
Marketplace BASIC seller owns Order
        ↓
GET /communications/context/ORDER/:orderId
        ↓
HTTP 200
        ↓
raw contacts visible in Communication.body
```

The previous interpretation:

```text
"0 leaks in DTO fields"
```

is insufficient.

Disclosure policy applies to the effective response, including:

```text
body
subject
metadata
sender/recipient projections
context projections
any nested free-text field
```

---

# 4. Canonical business policy

Preserve this distinction:

## Marketplace Basic

Communication is mediated by TravelHub.

Marketplace Basic must not receive unrestricted Customer direct-contact information through TravelHub-managed communication surfaces.

Restricted classes include at minimum:

```text
email
phone/mobile
direct URL intended for contact bypass
social/contact handles where existing anti-disintermediation detector classifies them
```

## Storefront Pro

Direct Customer relationship is permitted according to the existing entitlement/business model.

Do not apply Marketplace Basic redaction blindly to Pro.

## Platform

Authorized Platform staff may retain full operational/support visibility according to existing permissions.

Do not redact Platform internal view merely to fix Basic.

---

# 5. Do not solve this by deleting Communication.body

Communication body is a canonical communication fact.

Do not:

```text
drop body
stop storing body
rewrite historical body globally
delete staff-entered text
mutate Customer
mutate Order/Booking
```

The remediation must be disclosure-aware.

---

# 6. Do not solve this frontend-only

The affected surface is API:

```text
GET /communications/context/:contextType/:contextId
```

Therefore enforcement must occur server-side before response serialization.

Frontend hiding is not a fix.

---

# 7. Reuse canonical anti-disintermediation detection

The project already has shared detection used by reverse pre-sale Communication:

```text
shared/anti-disintermediation.ts
assertNoContactText()
```

Audit its exact API before coding.

Prefer reusing the same canonical detection semantics rather than creating independent email/phone/URL regexes.

Do not fork detection logic.

---

# 8. Detection ≠ disclosure transformation

Existing reverse chat behavior is:

```text
contact-bearing outgoing message
→ reject 422
```

That behavior does not necessarily fit historical/staff-created ORDER/BOOKING Communication.

For Basic read disclosure, determine the smallest safe transformation consistent with existing architecture.

Potential valid patterns include:

```text
redacted body
sanitized body
policy-safe projection
```

Do not assume the exact implementation before auditing repository conventions.

---

# 9. Preserve immutable source fact where appropriate

If canonical Communication is an audit/history fact, prefer:

```text
stored original body
        ↓
policy-aware read projection
        ↓
Basic receives sanitized representation
```

over destructive mutation:

```text
stored original body overwritten
```

Platform and authorized Pro views may need the original.

Document the chosen source-of-truth behavior.

---

# 10. Required canonical policy seam

Do not scatter:

```text
if (tier === BASIC) ...
```

across controllers.

Introduce or reuse a narrow reusable disclosure-policy seam conceptually equivalent to:

```text
CommunicationDisclosurePolicy
CommunicationContentPolicy
CommunicationAudienceProjection
```

Final naming must follow repository conventions.

It should answer, from server-authoritative context:

```text
actor/workspace
Partner tier
Communication surface/context
content
        ↓
safe response projection
```

---

# 11. Entitlement authority

Use the existing canonical Partner tier resolver.

Preserve:

```text
ACTIVE storefront + ACTIVE entitlement → PRO
otherwise → BASIC
```

Do not trust:

```text
query tier
body tier
header tier
PARTNER role alone
storefront existence alone
```

Tier spoofing must remain impossible.

---

# 12. Scope of remediation

At minimum audit every Partner-readable Communication response path:

```text
GET /communications/context/:contextType/:contextId
GET /communications/own
GET /communications/:code
reverse conversation endpoints
```

Determine whether raw `body` contact leakage exists for Basic on any of them.

Do not fix only the new endpoint if another existing endpoint exposes the same CML fact.

Return an endpoint matrix:

| Endpoint | Basic can access? | body returned? | contact policy before | remediation needed? |
|---|---:|---:|---|---:|

---

# 13. ORDER policy

For Marketplace BASIC seller of its own Order:

```text
authorized access → YES
raw direct contacts → NO
```

Do not turn an authorized `200` into `404` merely to hide contacts.

The seller must retain legitimate business communication content, with only policy-restricted content transformed.

---

# 14. BOOKING policy

Apply the same policy to Marketplace BASIC seller of its own Booking.

Do not assume Order proof automatically covers Booking.

Runtime proof is required.

---

# 15. Storefront Pro regression

For a legitimate Pro Partner:

```text
own Order/Booking Communication
```

prove the existing direct-contact behavior remains allowed according to current business policy.

If Pro should see original:

```text
email/phone/URL remain visible
```

prove it.

Do not accidentally sanitize Pro with Basic policy.

---

# 16. Platform regression

Authorized Platform staff must retain the appropriate original Communication content.

Prove:

```text
authorized Platform staff
→ full original synthetic contact-bearing body visible
```

unless an existing stricter Platform policy says otherwise.

---

# 17. Buyer behavior

Do not accidentally sanitize the Customer/Buyer from seeing their own message/history unless current policy requires it.

Audit and preserve current Buyer behavior.

---

# 18. Redaction semantics

If sanitization/redaction is selected, define deterministic behavior.

Examples only:

```text
[contact hidden]
[redacted]
```

Use existing project/i18n/API conventions if present.

Requirements:

```text
deterministic
does not reveal original contact
does not create malformed JSON
does not alter stored source fact
does not produce partial phone/email leakage
```

Do not reveal enough fragments to reconstruct the contact.

---

# 19. Subject / metadata / participant scan

Do not sanitize only `body` if contact-bearing text can appear in:

```text
subject
metadata
sender
recipient
display labels
context metadata
```

Audit actual schema/API.

Apply policy only where exposure is genuinely possible.

Do not invent fields.

---

# 20. Historical Communication

The remediation must protect existing contact-bearing CML records too.

Do not make the fix creation-time-only.

Required:

```text
old stored contact-bearing Communication
        ↓
Basic reads now
        ↓
safe projection
```

No destructive backfill is preferred.

---

# 21. Reverse pre-sale chat

Preserve current behavior:

```text
normal → 201
email → 422
phone → 422
URL → 422
```

Do not replace rejection with sanitization on the reverse pre-sale send path unless canonical policy explicitly requires that change.

---

# 22. Full automated moderation remains out of scope

Do NOT implement:

```text
ALLOW / REDACT / BLOCK / REVIEW engine
moderation queue
semantic circumvention AI
attachment scanning
realtime moderation
full obfuscation normalization
```

This step is a narrow disclosure-policy remediation.

---

# 23. Missing Step 3.7B evidence gates must also be closed

Step 3.7B.1 failed to prove several mandatory cases.

This remediation/evidence round must execute them.

Required:

```text
foreign Buyer ORDER
foreign Buyer BOOKING
unauthorized Platform staff
current reverse-chat regression
```

Do not mark them N/A merely because the previous test fixture lacked an actor.

---

# 24. Buyer ORDER runtime

Use:

```text
Buyer A → owns Order A
Buyer B → does not own Order A
```

Execute:

```text
Buyer A:
GET /communications/context/ORDER/:orderA
→ 200

Buyer B:
GET /communications/context/ORDER/:orderA
→ 403/404 according to project policy
```

No foreign existence leakage.

---

# 25. Buyer BOOKING runtime

Use:

```text
Booking A → Order A → Buyer A
Buyer B foreign
```

Execute:

```text
Buyer A:
GET /communications/context/BOOKING/:bookingA
→ 200

Buyer B:
GET /communications/context/BOOKING/:bookingA
→ 403/404
```

---

# 26. Partner BOOKING runtime

Required:

```text
Partner A seller → 200
Partner B foreign → 403/404
```

If Partner A is BASIC, prove sanitized contact-bearing content.

---

# 27. Unauthorized Platform staff

Create/use a legitimate authenticated internal role without:

```text
communication.read
```

Call the context endpoint.

Required:

```text
403
```

Do not use anonymous as a substitute.

If every current staff role has the permission, prove that from the RBAC matrix and use a controlled test actor/role fixture consistent with project test conventions.

Do not mutate production role defaults merely for evidence.

---

# 28. Anonymous

Retain:

```text
anonymous → 401
```

---

# 29. Nonexistent / invalid context

Retain controlled behavior:

```text
nonexistent ORDER/BOOKING → 4xx, no 500
invalid context type → 400/422
```

Record exact status.

---

# 30. Participant spoofing

Prove at least one real attempt:

```text
Order seller = Partner A
client tries to create/link Communication as Partner B
```

Expected:

```text
rejected
or server-authoritative values override safely
```

Record exact request/status.

---

# 31. Recursive leakage scanner

For BASIC responses recursively inspect all keys and all string values.

At minimum detect:

```text
email patterns
phone patterns
URL patterns
social/contact handles supported by shared detector
```

Report separately:

```text
structured DTO contact leaks
free-text contact leaks
overall restricted direct-contact leaks
```

Required for PASS:

```text
overall restricted direct-contact leaks = 0
```

---

# 32. False-positive safety

A disclosure transformation must not destroy ordinary business text.

Test harmless examples containing:

```text
order number
booking code
date
price
room/tour/service name
ordinary prose
non-contact numeric values
```

Prove legitimate content remains readable.

---

# 33. Runtime matrix — BASIC

Mandatory:

| Surface | Actor | Relation | HTTP | Original contacts stored? | Contacts returned? | Safe content preserved? |
|---|---|---|---:|---:|---:|---:|
| ORDER context | Basic Partner | own | 200 | YES | NO | YES |
| BOOKING context | Basic Partner | own | 200 | YES | NO | YES |
| ORDER context | Basic Partner | foreign | 403/404 | — | NO | — |
| BOOKING context | Basic Partner | foreign | 403/404 | — | NO | — |

---

# 34. Runtime matrix — PRO / Platform / Buyer

Mandatory:

| Actor | Context | Expected |
|---|---|---|
| Pro Partner own | ORDER | authorized; policy-appropriate original content |
| Pro Partner own | BOOKING | authorized; policy-appropriate original content |
| Platform authorized | ORDER/BOOKING | original content according to staff policy |
| Platform unauthorized | context endpoint | 403 |
| Buyer own | ORDER | 200 |
| Buyer foreign | ORDER | 403/404 |
| Buyer own | BOOKING | 200 |
| Buyer foreign | BOOKING | 403/404 |
| Anonymous | context endpoint | 401 |

---

# 35. Automated tests

Add focused tests for the remediation.

At minimum:

```text
Basic own ORDER sanitization
Basic own BOOKING sanitization
historical contact-bearing CML sanitization
Pro preservation
Platform preservation
Buyer own/foreign Order
Buyer own/foreign Booking
Partner own/foreign
unauthorized staff
participant spoof
ordinary non-contact body preserved
```

Also preserve reverse chat:

```text
normal
email
phone
URL
```

---

# 36. Regression suites

Run actual relevant suites:

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

if shared CRM/contact policy code is touched.

Run:

```text
Backend TSC
```

Frontend suite/TSC only if frontend changes.

Do not copy old counts.

Report actual counts.

---

# 37. Database / migration

Expected default:

```text
schema changed: NO
migration: NONE
backfill: NONE
```

because this should be a read/disclosure-policy remediation.

If schema change appears necessary:

```text
STOP
ARCHITECTURE REVIEW REQUIRED
```

Do not silently add persistence solely for redaction.

---

# 38. Frontend

Expected:

```text
Frontend production changes: NONE
```

because enforcement belongs server-side.

If frontend must display a redaction marker already returned by API, reuse existing text if possible.

Any new visible string requires:

```text
RU
AZ
EN
```

Do not make frontend the security boundary.

---

# 39. Fixture safety

Use synthetic contacts only.

Example:

```text
basic-contact-test@example.invalid
+994500000001
https://example.invalid/contact
```

Never use real Customer PII in evidence reports.

Clean up all temporary:

```text
Customer
Partner if synthetic
Order
Booking
Communication
temporary entitlement
test role/user
```

or use transactional rollback according to project conventions.

---

# 40. Git discipline

Before commit:

```bash
git status
git diff --stat
git diff
```

Do not stage unrelated pre-existing deletions/untracked prompts.

Commit only intended remediation/tests/report.

Push.

Then:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status
```

No placeholders.

---

# 41. Roadmap discipline

Do not mark Step 3.7B:

```text
APPROVED
FULLY CLOSED
```

in this remediation.

Successful result is only:

```text
IMPLEMENTATION + REMEDIATION COMPLETE
READY FOR STEP 3.7B STRICT REVIEW
```

Separate Strict Review remains mandatory.

---

# 42. Required final report

## A. Verdict

Only:

```text
VERDICT A — STEP 3.7B.2 CONTACT-DISCLOSURE REMEDIATION + FINAL RUNTIME EVIDENCE — PASS
STEP 3.7B READY FOR STRICT REVIEW
```

or:

```text
VERDICT B — STEP 3.7B.2 REMEDIATION / EVIDENCE INCOMPLETE
STEP 3.7B NOT READY FOR STRICT REVIEW
```

---

## B. Root cause

Explain:

```text
why Basic could read contact-bearing body
which response paths were affected
why 3.7A CRM field filtering did not cover this path
```

---

## C. Remediation architecture

Show exact flow:

```text
stored Communication
→ actor/context authority
→ entitlement/disclosure policy
→ safe response projection
```

Identify exact files/classes/functions.

---

## D. Endpoint audit

| Endpoint | Basic access | Before | After | Policy seam |
|---|---:|---|---|---|

Include all Partner-readable Communication endpoints.

---

## E. BASIC runtime

Return actual ORDER + BOOKING payload evidence.

Show sanitized excerpts.

Do not include real PII.

---

## F. PRO runtime

Show that Pro retains expected direct-contact behavior.

---

## G. Platform runtime

Show:

```text
authorized staff original body
unauthorized staff 403
```

---

## H. Buyer/tenant isolation

Return:

```text
Buyer own Order
Buyer foreign Order
Buyer own Booking
Buyer foreign Booking
Partner own
Partner foreign
anonymous
```

with exact HTTP statuses.

---

## I. Participant spoofing

Show exact attempted spoof and result.

---

## J. Reverse-chat regression

```text
normal:
email:
phone:
URL:
```

with actual statuses.

---

## K. Leakage scan

```text
structured DTO leaks:
free-text leaks:
overall restricted direct-contact leaks:
false-positive harmless body:
```

Required:

```text
overall restricted direct-contact leaks: 0 for Marketplace BASIC
```

---

## L. Source fact integrity

Prove:

```text
stored original body preserved: YES/NO
Platform sees original:
Pro sees original:
Basic sees safe projection:
historical CML protected:
```

---

## M. Database

```text
schema:
migration:
backfill:
data mutation:
```

---

## N. Tests

Exact actual counts:

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

Use N/A only with explicit reason.

---

## O. Cleanup

Exact fixture cleanup.

---

## P. Changed files

For each:

```text
path
purpose
production/test/docs
```

---

## Q. Git

```text
Starting HEAD:
Remediation implementation SHA:
Evidence/report SHA:
Final HEAD:
origin/master:
HEAD == origin/master:
production changes:
working tree:
pre-existing unrelated changes:
```

No `pending`.

---

## R. Strict Review readiness

```text
READY FOR STEP 3.7B STRICT REVIEW: YES/NO
```

Do not start it.

---

# 43. Hard PASS gates

`VERDICT A` is forbidden unless:

```text
[ ] confirmed P1 root cause documented
[ ] all Basic-readable Communication endpoints audited
[ ] canonical shared contact detector reused or justified
[ ] server-side disclosure policy implemented
[ ] no frontend-only enforcement
[ ] stored original Communication fact not destructively rewritten
[ ] Basic own Order remains authorized
[ ] Basic own Order raw contacts no longer disclosed
[ ] Basic own Booking remains authorized
[ ] Basic own Booking raw contacts no longer disclosed
[ ] recursive BASIC scan finds 0 restricted direct-contact leaks
[ ] harmless business text remains readable
[ ] historical contact-bearing CML is protected
[ ] Pro behavior proven
[ ] Platform original visibility proven
[ ] unauthorized Platform staff → 403
[ ] Buyer own Order → 200
[ ] Buyer foreign Order → denied
[ ] Buyer own Booking → 200
[ ] Buyer foreign Booking → denied
[ ] Partner foreign scope denied
[ ] anonymous → 401
[ ] participant spoof test passes
[ ] reverse chat normal → success
[ ] reverse chat email → 422
[ ] reverse chat phone → 422
[ ] reverse chat URL → 422
[ ] no schema/migration unless separately approved
[ ] fixtures cleaned
[ ] actual relevant automated tests pass
[ ] Backend TSC passes
[ ] exact remediation SHA exists
[ ] exact evidence/report SHA resolved if report committed
[ ] HEAD == origin/master proven
[ ] working-tree state reported honestly
[ ] Step 3.7B not prematurely marked APPROVED
```

Any failed gate:

```text
VERDICT B
STEP 3.7B NOT READY FOR STRICT REVIEW
```

---

# 44. Stop condition

After completing this remediation:

1. commit and push;
2. return the final evidence report;
3. if any Basic direct-contact disclosure remains, return `VERDICT B`;
4. if all gates pass, state only that Step 3.7B is **READY FOR STRICT REVIEW**;
5. do not perform Strict Review;
6. do not sync Step 3.7B as APPROVED;
7. do not start Step 3.7C;
8. wait for review.
