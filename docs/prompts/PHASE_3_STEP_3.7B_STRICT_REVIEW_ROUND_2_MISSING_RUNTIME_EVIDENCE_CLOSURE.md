# PHASE 3 — STEP 3.7B — STRICT REVIEW — ROUND 2 — MISSING RUNTIME EVIDENCE CLOSURE

## 0. MODE

**STRICT REVIEW CONTINUATION — EVIDENCE CLOSURE ONLY.**

This is **not**:

- a new implementation stage;
- Step 3.7B.5;
- a production remediation stage;
- a redesign of Communication;
- permission to start the next canonical roadmap step.

The previous Strict Review report claimed:

```text
VERDICT A — STEP 3.7B COMMUNICATION BUSINESS-CONTEXT INTEGRATION — STRICT REVIEW APPROVED
STEP 3.7B CLOSED
```

That verdict is **REJECTED** because several mandatory runtime gates were claimed as PASS without the required runtime evidence.

Current authoritative review status:

```text
VERDICT B — STEP 3.7B COMMUNICATION BUSINESS-CONTEXT INTEGRATION — STRICT REVIEW FAILED
STEP 3.7B NOT CLOSED
```

The purpose of Round 2 is to close only the missing Strict Review evidence.

---

# 1. Production freeze

Start with a hard freeze:

```text
production code changes: FORBIDDEN
test code changes:       FORBIDDEN
schema changes:          FORBIDDEN
migration:               FORBIDDEN
backfill:                FORBIDDEN
```

Allowed:

```text
controlled runtime fixtures
runtime/API verification
DB read verification
safe fixture cleanup
Strict Review report correction/addition
Git commit/push for the report only
```

If a runtime test reveals a real production defect:

```text
STOP
VERDICT B
document the defect
do NOT repair it inside this review
```

A separate remediation step must then be authorized.

---

# 2. Baseline

Before any verification execute and record:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
```

Expected repository history includes:

```text
3.7B implementation:       576b076
3.7B.2 remediation:        716dbd1
3.7B.3 precision:          d1c17d1
3.7B.4 evidence:           062d418
administrative closure:    d909fb3
```

The previous Strict Review reported baseline:

```text
Starting HEAD:  3f9bab5
Final HEAD:     3f9bab5
origin/master:  3f9bab5
```

Do not assume this is still current.

Record actual values.

Do not reset, delete, stage, or modify unrelated dirty files.

---

# 3. Why Round 2 is required

The previous report contains evidence contradictions.

## 3.1 BOOKING positive runtime was not proven

Previous evidence:

```text
Admin reads BOOKING context → 200, 0 items
Create on BOOKING context   → 422
```

But the report then claimed:

```text
BOOKING context independently verified
Positive own ORDER/BOOKING
Runtime matrix complete
```

This is not sufficient.

Required now:

```text
valid own BOOKING Communication create → success
read it back → success
correct participant/context linkage
persisted exactly as expected
```

---

## 3.2 BOOKING participant spoof was not proven

ORDER participant spoofing was demonstrated.

BOOKING participant spoofing was not.

Required now:

```text
authorized creator
+ valid BOOKING
+ wrong PARTNER
→ controlled 4xx
→ 0 persisted

authorized creator
+ valid BOOKING
+ wrong CUSTOMER
→ controlled 4xx
→ 0 persisted
```

If one participant form is structurally impossible for the API contract, prove that from the actual code and execute the closest meaningful authorized spoof vector.

---

## 3.3 Tenant isolation matrix was incomplete

Previous evidence mainly showed:

```text
Admin
Anonymous
nonexistent context
```

That does not prove cross-tenant object isolation.

Required runtime evidence now:

```text
Partner A → own ORDER
Partner A → Partner B ORDER

Partner A → own BOOKING
Partner A → Partner B BOOKING
```

Also test Buyer/customer object isolation where the actual endpoint contract allows the actor to read/create context communications:

```text
Buyer A → own context
Buyer A → Buyer B context
```

If a Buyer path is not exposed for this endpoint, document the actual routing/permission reason and test the nearest applicable own/foreign customer-facing path.

For every denied write:

```text
controlled 4xx
0 persisted
```

---

# 4. Fixture design

Use controlled fixtures with clearly unique Round-2 markers.

Prefer existing safe test/dev identities when possible.

Create only what is necessary.

Suggested logical fixture set:

```text
Platform Admin / authorized staff

Marketplace Basic Partner A
Marketplace Basic Partner B

Storefront Pro Partner

Customer/Buyer A
Customer/Buyer B

Order A owned/served by Partner A
Order B owned/served by Partner B

Booking A belonging to Partner A / Customer A
Booking B belonging to Partner B / Customer B
```

Do not infer ownership from display labels.

Verify authoritative IDs and relationships directly from DB/API before tests.

Record fixture IDs/codes in the report.

---

# 5. BOOKING — positive runtime hard gate

This is mandatory.

Use a real valid Booking fixture.

Determine the authoritative participant identities from repository/domain data.

Do **not** guess `customerId`.

If Booking stores only `orderId`, resolve:

```text
Booking
→ Order
→ canonical Customer
→ canonical seller Partner
```

Execute a valid create through the actual API.

Record:

```text
actor:
actor role/permission:
booking ID:
booking human-readable code:
order ID/code:
canonical customer ID:
canonical partner ID:
request payload:
HTTP status:
response:
Communication code:
Communication DB ID:
```

Expected:

```text
2xx create
Communication persisted exactly once
contextType = BOOKING
contextId = target Booking
participants match canonical Booking/Order relationship
```

Then read the Communication back through the applicable context/detail API.

Expected:

```text
2xx
same CML-* fact returned
correct BOOKING context
correct participant projection
```

A 422 does **not** satisfy this gate.

---

# 6. BOOKING — authorized participant spoof hard gate

Using the same valid Booking context and an actor who is genuinely authorized to create the legitimate Communication, execute adversarial requests.

## 6.1 Wrong Partner

Attempt:

```text
valid Booking
authorized creator
recipient/sender PARTNER = unrelated Partner B
```

Expected:

```text
4xx controlled rejection
0 spoof Communication persisted
```

## 6.2 Wrong Customer

Attempt:

```text
valid Booking
authorized creator
CUSTOMER = unrelated Customer B
```

Expected:

```text
4xx controlled rejection
0 spoof Communication persisted
```

Record exact error messages/statuses.

After each attempt query DB using the unique body marker and prove persistence count:

```text
0
```

---

# 7. ORDER — tenant isolation runtime

Do not reuse Admin as proof of tenant isolation.

Use Partner A.

## 7.1 Own ORDER

```text
Partner A
→ Order A belonging to/served by Partner A
```

Execute the applicable context read/create path.

Expected:

```text
allowed according to canonical permission model
```

Record result.

## 7.2 Foreign ORDER

```text
Partner A
→ Order B belonging to/served by Partner B
```

Expected:

```text
403/404/other canonical controlled denial
no foreign communication disclosure
no write persistence
```

If the endpoint supports read only for this actor, prove no read disclosure.

If it supports write, prove both denial and zero persistence.

---

# 8. BOOKING — tenant isolation runtime

## 8.1 Own BOOKING

```text
Partner A
→ Booking A belonging to Partner A
```

Expected allowed behavior according to the endpoint contract.

## 8.2 Foreign BOOKING

```text
Partner A
→ Booking B belonging to Partner B
```

Expected:

```text
controlled denial
no foreign communication disclosure
no persisted write
```

This evidence must be runtime, not code inspection alone.

---

# 9. Buyer / customer isolation

Where supported by the actual Communication API:

```text
Buyer A → own context
Buyer A → Buyer B context
```

Expected:

```text
own → allowed where contract permits
foreign → controlled denial
```

If the endpoint does not expose this actor path, document:

```text
endpoint
guard
permission
service authority
why Buyer cannot enter this path
```

Then test the actual customer-facing communication path that exercises equivalent ownership enforcement.

Do not mark this PASS merely because an unrelated endpoint returns 403.

---

# 10. Marketplace Basic — real runtime contact projection

Previous unit tests are useful but insufficient for this Strict Review hard gate.

Create a Communication attached to a valid Basic Partner business context with a body containing unique contact-bearing markers plus harmless business codes.

Example evidence body:

```text
Round2 Basic evidence
TH-2026-000001
ORD-R2-001
BKG-R2-001
CML-R2-001
email: strict-r2@example.invalid
phone: +994500000001
url: https://example.invalid/r2
date: 2026-09-01
amount: 150.00
```

Use the canonical API/write authority.

Then read it **as Marketplace Basic Partner**.

Prove recursively:

```text
email absent/redacted
phone absent/redacted
URL absent/redacted
business codes preserved
date preserved
amount preserved
no contact data leaks through nested DTOs
```

Record the actual serialized response relevant to the proof.

Do not use Admin output as Basic evidence.

---

# 11. Storefront Pro — real runtime projection

Read the same legitimate communication, or an equivalent controlled own-context Communication, as an ACTIVE Storefront Pro Partner.

Expected:

```text
legitimate original body visible
email preserved where canonical Storefront policy permits
phone preserved
URL preserved
business codes preserved
```

Prove effective tier at runtime.

Record:

```text
Partner
Storefront
entitlement
effective tier
HTTP status
relevant response
```

Do not infer Pro from role `PARTNER`.

---

# 12. Entitlement transition hard gate

Use a controlled Pro Partner/Storefront entitlement that can safely be restored.

Capture original state first.

Execute:

```text
ACTIVE Storefront + ACTIVE entitlement
→ effective tier PRO
→ original legitimate body visible

temporarily make entitlement inactive/expired
→ effective tier BASIC
→ contact-safe projection

restore exact original entitlement state
→ effective tier PRO
→ original legitimate projection restored
```

Record before/temporary/after DB state.

Hard requirements:

```text
server-side tier resolution
no client tier override
exact restoration
```

If mutating the selected fixture would be unsafe, create a dedicated disposable entitlement fixture and clean it afterward.

---

# 13. Platform runtime projection

Read the controlled contact-bearing Communication as authorized Platform staff.

Expected:

```text
authorized Platform scope
→ original legitimate body visible
```

This may reuse valid evidence from the prior review only if it can be independently reproduced in this Round 2 runtime.

Record current runtime result.

---

# 14. Unauthorized internal staff hard gate

Use a real authenticated internal role that lacks the required communication permission, e.g. MARKETER if that remains true in current RBAC.

First prove effective permissions.

Then call the actual affected endpoint.

Expected:

```text
403 or canonical permission denial
```

Record:

```text
actor
role
effective permission set relevant to Communication
endpoint
HTTP status
response
```

Do not infer denial from decorators alone.

---

# 15. Reverse Marketplace — REAL runtime regression

Unit tests are not sufficient.

Use a real reverse conversation fixture and call:

```text
POST /communications/reverse/conversations/:id/messages
```

## 15.1 Harmless

Body contains no prohibited contact information.

Expected:

```text
201/2xx
persisted exactly once
```

## 15.2 Email

Expected:

```text
422 or canonical controlled rejection
0 persisted
```

## 15.3 Phone

Expected:

```text
422 or canonical controlled rejection
0 persisted
```

## 15.4 URL

Expected:

```text
422 or canonical controlled rejection
0 persisted
```

Then query the conversation/messages or DB.

Prove:

```text
harmless marker count = 1
email marker count    = 0
phone marker count    = 0
URL marker count      = 0
```

Also record the real call path from endpoint to canonical/shared detector.

---

# 16. Context-type confusion — complete runtime

Previous evidence used nonexistent ORDER ID and invalid type.

Also test actual cross-domain ID confusion.

Required:

```text
contextType=ORDER
contextId=<real Booking ID>
```

and:

```text
contextType=BOOKING
contextId=<real Order ID>
```

Expected:

```text
controlled 4xx
0 persistence
no cross-domain fallback
no raw 500
```

Use unique request body markers and verify DB counts = 0.

---

# 17. Generic create bypass — runtime

Do not accept code inspection alone.

If generic:

```text
POST /communications
```

accepts context/participants, attempt at least:

```text
authorized actor
valid foreign context
forged participant
context-type confused real ID
```

Expected:

```text
controlled denial
0 persisted
```

If the same tests above already execute through `POST /communications`, explicitly map each test to this gate in the report.

---

# 18. Persistence verification

For every rejected write in this Round 2, verify persistence explicitly.

Use unique markers.

Required table:

| Case | HTTP | Expected DB count | Actual DB count |
|---|---:|---:|---:|
| Booking wrong Partner | 4xx | 0 | |
| Booking wrong Customer | 4xx | 0 | |
| Foreign Order write, if applicable | 4xx | 0 | |
| Foreign Booking write, if applicable | 4xx | 0 | |
| ORDER + real Booking ID | 4xx | 0 | |
| BOOKING + real Order ID | 4xx | 0 | |
| Reverse email | 422 | 0 | |
| Reverse phone | 422 | 0 | |
| Reverse URL | 422 | 0 | |

Do not claim “not persisted” without a query/equivalent persistence check.

---

# 19. Existing tests / TSC

Because production and tests are frozen, rerun the relevant existing regression commands.

At minimum:

```text
Communication tests
CRM tests affected by Basic/Pro contact projection
relevant Order/Booking tests
backend TypeScript compile/typecheck
```

Use actual repository scripts.

Report:

```text
command
suite
tests passed/failed
exit code
```

Do not modify tests to manufacture PASS.

---

# 20. Cleanup

Remove only Round-2 synthetic fixtures.

Required cleanup audit includes:

```text
Round-2 Communications
reverse conversation/messages
synthetic Buyers/Customers
synthetic Orders/Bookings if created
synthetic Partner/Storefront if created
temporary entitlement fixture
temporary entitlement mutation restored
BuyerRequest / distribution rows
other Round-2 rows
```

Use unique prefixes/markers so cleanup can be proven safely.

Final:

```text
Round-2 synthetic contact-bearing Communications: 0
Round-2 rejected-message persistence:              0
Round-2 disposable identities:                     0
temporary entitlement state:                       RESTORED
```

Do not delete unrelated or pre-existing fixtures.

---

# 21. Correct the Strict Review report

Update:

```text
docs/prompts/PHASE_3_STEP_3.7B_COMMUNICATION_BUSINESS_CONTEXT_INTEGRATION_STRICT_REVIEW_REPORT.md
```

The corrected report must not preserve unsupported PASS statements from Round 1.

At minimum replace/expand:

```text
BOOKING runtime
BOOKING participant spoof
ORDER tenant isolation
BOOKING tenant isolation
Buyer/customer isolation
Basic runtime projection
Pro runtime projection
entitlement transition
unauthorized staff runtime
reverse-chat runtime
real-ID context-type confusion
generic-create runtime bypass
persistence matrix
cleanup
Git evidence
verdict
```

Clearly distinguish:

```text
unit evidence
code inspection evidence
runtime evidence
DB persistence evidence
```

Do not label unit evidence as runtime.

---

# 22. Required Round-2 evidence summary

The final report must include this matrix with real values:

| Hard gate | Evidence type | Result |
|---|---|---|
| Valid BOOKING create/read | Runtime + DB | |
| BOOKING wrong Partner | Runtime + DB | |
| BOOKING wrong Customer | Runtime + DB | |
| Partner own ORDER | Runtime | |
| Partner foreign ORDER | Runtime | |
| Partner own BOOKING | Runtime | |
| Partner foreign BOOKING | Runtime | |
| Buyer/customer isolation | Runtime or proven non-applicable + nearest path | |
| Basic contact-safe projection | Runtime | |
| Pro original projection | Runtime | |
| Platform original projection | Runtime | |
| Pro→Basic→Pro entitlement transition | Runtime + DB | |
| Unauthorized internal staff | Runtime | |
| Reverse harmless | Runtime + DB | |
| Reverse email | Runtime + DB | |
| Reverse phone | Runtime + DB | |
| Reverse URL | Runtime + DB | |
| ORDER + real Booking ID confusion | Runtime + DB | |
| BOOKING + real Order ID confusion | Runtime + DB | |
| Generic create bypass | Runtime + DB | |
| Tests | Command output | |
| Backend TSC | Command output | |
| Cleanup | DB | |
| Git integrity | Git | |

No blank cells are allowed in a VERDICT A report.

---

# 23. Finding rules

If any test reveals a defect, report:

```text
Finding ID:
Severity: P0 | P1 | P2 | P3
Area:
Runtime evidence:
Persistence evidence:
Expected:
Actual:
Impact:
Required remediation:
```

Do not repair it in Round 2.

Any unresolved P0/P1/P2 means:

```text
VERDICT B
STEP 3.7B NOT CLOSED
```

---

# 24. Git closure

After evidence/report completion:

```bash
git status --short
git diff --name-only
git diff --cached --name-only
```

Only the intended Strict Review report may be staged/committed by this task.

Commit the corrected report.

Push.

Then record actual:

```bash
git rev-parse HEAD
git rev-parse origin/master
```

Required for final PASS:

```text
HEAD == origin/master
```

Report unrelated dirty state separately and leave it untouched.

No placeholders:

```text
TBD
TODO
pending
this commit
after push
before push
```

---

# 25. Verdict rules

## VERDICT A

Allowed only if every mandatory Round-2 gate is actually proven and there are no unresolved P0/P1/P2 findings.

Output exactly:

```text
VERDICT A — STEP 3.7B COMMUNICATION BUSINESS-CONTEXT INTEGRATION — STRICT REVIEW APPROVED
STEP 3.7B CLOSED
```

This verdict supersedes the rejected Round-1 claim because the missing evidence has now been independently closed.

Then STOP.

Do not start the next implementation step.

Do not perform roadmap synchronization in this task.

---

## VERDICT B

If any mandatory evidence is absent, contradictory, or fails:

```text
VERDICT B — STEP 3.7B COMMUNICATION BUSINESS-CONTEXT INTEGRATION — STRICT REVIEW FAILED
STEP 3.7B NOT CLOSED
```

List exact blockers.

If the blocker is only missing evidence, say:

```text
EVIDENCE GAP
```

If runtime exposes an actual implementation defect, say:

```text
SYSTEM DEFECT
```

Do not conflate the two.

Do not fix a system defect inside this review.

---

# 26. Stop condition

This task ends with exactly one of:

```text
A) STRICT REVIEW APPROVED → STEP 3.7B CLOSED
```

or:

```text
B) STRICT REVIEW FAILED → STEP 3.7B NOT CLOSED
```

No next roadmap implementation is permitted in the same task.
