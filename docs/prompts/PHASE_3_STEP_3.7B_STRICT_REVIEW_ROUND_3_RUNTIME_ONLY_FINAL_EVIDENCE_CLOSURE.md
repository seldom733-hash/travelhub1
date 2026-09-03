# PHASE 3 — STEP 3.7B — STRICT REVIEW — ROUND 3 — RUNTIME-ONLY FINAL EVIDENCE CLOSURE

## 0. MODE

**STRICT REVIEW CONTINUATION — RUNTIME-ONLY FINAL EVIDENCE CLOSURE.**

This is **not**:

- a new implementation stage;
- Step 3.7B.5;
- a production remediation stage;
- permission to change production code;
- permission to change tests;
- permission to start the next roadmap step.

Current authoritative state:

```text
VERDICT B — STEP 3.7B COMMUNICATION BUSINESS-CONTEXT INTEGRATION — STRICT REVIEW FAILED
STEP 3.7B NOT CLOSED

Classification: EVIDENCE GAP
SYSTEM DEFECT: NOT ESTABLISHED
```

Round 1 and Round 2 established substantial evidence, including:

```text
BOOKING positive create/read
BOOKING participant spoof rejection
ORDER participant spoof rejection
context-type confusion
generic-create participant bypass rejection
sanitizer unit precision
Platform original-body projection
Communication tests
Backend TSC
```

These are **not to be re-litigated** unless a new contradiction appears.

Round 3 exists only to close the remaining runtime-only hard gates.

---

# 1. HARD PRODUCTION FREEZE

Forbidden:

```text
production code changes
test code changes
schema changes
migration
backfill
permission rewrites
entitlement logic rewrites
sanitizer changes
Communication behavior changes
```

Allowed:

```text
runtime fixtures
API calls
DB reads
temporary controlled entitlement mutation
safe fixture cleanup
Strict Review report updates
Git commit/push for report only
```

If any runtime check exposes a real product defect:

```text
STOP
VERDICT B
Classification: SYSTEM DEFECT
```

Do not fix the defect inside this review.

---

# 2. DO NOT USE CODE-ONLY EVIDENCE FOR THESE GATES

The following gates must be proven through **actual authenticated runtime/API execution**.

Code inspection may supplement the evidence but cannot replace it.

Mandatory remaining gates:

```text
1. Partner own/foreign ORDER isolation
2. Partner own/foreign BOOKING isolation
3. Buyer/customer own/foreign isolation
4. Marketplace Basic contact-safe projection
5. Storefront Pro original projection
6. Pro → Basic → Pro entitlement transition
7. Authenticated unauthorized internal staff denial
8. Reverse Marketplace harmless runtime
9. Reverse Marketplace email rejection runtime
10. Reverse Marketplace phone rejection runtime
11. Reverse Marketplace URL rejection runtime
```

No PASS is allowed for any item above without real runtime evidence.

---

# 3. BASELINE

Record before runtime work:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
```

Report actual values.

Do not assume previous HEAD values remain current.

Do not touch unrelated dirty files.

---

# 4. FIXTURE AUTHORITY

Before issuing API requests, identify authoritative existing or synthetic fixtures.

Required actors/objects:

```text
Marketplace Basic Partner A
Marketplace Basic Partner B
Storefront Pro Partner
Buyer/Customer A
Buyer/Customer B
Internal unauthorized staff user
Order A for Partner A
Order B for Partner B
Booking A for Partner A
Booking B for Partner B
Reverse conversation with valid participants
```

For each fixture record:

```text
ID
human-readable code/name
effective role
effective partner/customer identity
effective entitlement/tier where relevant
ownership relationship
```

Do not infer ownership from names alone.

Verify from DB/domain relations first.

---

# 5. PARTNER ORDER ISOLATION — RUNTIME ONLY

Use an authenticated **Partner A** token/session.

## 5.1 Own ORDER

Call the actual Communication business-context endpoint for:

```text
Partner A → Order A
```

Use the endpoint that is actually intended for Partner access.

Record:

```text
actor
role
partnerId
orderId
order code
HTTP request
HTTP status
response summary
```

Expected:

```text
allowed according to canonical contract
```

If read:

```text
2xx
no cross-tenant leakage
```

If create is the applicable path:

```text
2xx
correct context
```

## 5.2 Foreign ORDER

Using the same authenticated Partner A:

```text
Partner A → Order B belonging to Partner B
```

Expected:

```text
controlled 4xx
no foreign Communication data disclosed
```

If a write attempt is applicable, prove:

```text
DB persistence count = 0
```

Required evidence:

```text
actual HTTP status
actual response
actual foreign owner relation
persistence result if write attempted
```

Code statement such as:

```text
partnerId !== sellerPartnerId → NotFoundError
```

is insufficient by itself.

---

# 6. PARTNER BOOKING ISOLATION — RUNTIME ONLY

Use authenticated Partner A.

## 6.1 Own BOOKING

```text
Partner A → Booking A
```

Expected allowed according to canonical contract.

Record:

```text
booking ID/code
related order ID/code
sellerPartnerId
HTTP status
response
```

## 6.2 Foreign BOOKING

```text
Partner A → Booking B belonging to Partner B
```

Expected:

```text
controlled 4xx
no foreign Communication disclosure
```

If write path exists:

```text
0 persisted
```

Again, code inspection is not sufficient.

---

# 7. BUYER / CUSTOMER ISOLATION — RUNTIME ONLY

Use real authenticated buyer/customer-capable identities.

Required:

```text
Buyer A → own Order or Booking communication context
Buyer A → Buyer B's Order or Booking communication context
```

Expected:

```text
own → allowed where canonical endpoint contract permits
foreign → controlled denial
```

If the generic business-context endpoint is not exposed to Buyer/Customer actors, then:

1. prove that with the actual route/guard;
2. use the nearest real customer-facing Communication endpoint that exercises the same ownership authority;
3. test own and foreign object access with authenticated users.

The report must clearly state which runtime path was used.

A code-only explanation is not acceptable.

---

# 8. MARKETPLACE BASIC CONTACT-SAFE PROJECTION — RUNTIME ONLY

Create or reuse a controlled Communication attached to a valid business context owned by **Marketplace Basic Partner A**.

The stored body must contain unique Round-3 evidence markers:

```text
R3-BASIC
TH-2026-000001
ORD-R3-001
BKG-R3-001
email: r3-basic@example.invalid
phone: +994500000031
url: https://example.invalid/r3-basic
date: 2026-09-01
amount: 150.00
```

Read the Communication through the actual API as authenticated **Marketplace Basic Partner A**.

Record the real serialized response.

Required runtime result:

```text
email absent/redacted
phone absent/redacted
URL absent/redacted

TH-2026-000001 preserved
ORD-R3-001 preserved
BKG-R3-001 preserved
date preserved
amount preserved
```

Also inspect the response recursively for contact leakage in:

```text
sender
recipient
customer
partner
order
booking
context
metadata
nested relations
```

Required:

```text
restricted direct-contact leaks = 0
```

Do not cite unit tests as the primary proof.

---

# 9. STOREFRONT PRO ORIGINAL PROJECTION — RUNTIME ONLY

Use an authenticated Partner whose effective state is genuinely:

```text
Storefront status = ACTIVE
entitlement status = ACTIVE
effective tier = PRO
```

Read a controlled contact-bearing Communication in that Partner's legitimate own business context.

Required runtime result:

```text
original email visible where canonical Storefront policy permits
original phone visible
original URL visible
business codes preserved
```

Record:

```text
partnerId
storefrontId
storefront status
entitlement status
effective tier
HTTP status
response excerpt
```

Do not equate role `PARTNER` with PRO.

---

# 10. PRO → BASIC → PRO ENTITLEMENT TRANSITION — REAL RUNTIME + DB

This gate was not executed in Round 2 and is mandatory now.

Use a safe controlled Storefront Pro fixture.

## 10.1 Capture original state

Record:

```text
storefront.status
storefront.entitlementStatus
effective tier
```

Confirm:

```text
ACTIVE + ACTIVE → PRO
```

Read the controlled contact-bearing Communication as Partner.

Record original body visibility.

## 10.2 Transition to BASIC

Temporarily change only the relevant entitlement state:

```text
ACTIVE → EXPIRED
```

or the canonical equivalent that produces BASIC according to current implementation.

Do not modify unrelated subscription data.

Then issue a fresh authenticated API request.

Required:

```text
effective tier = BASIC
email redacted/absent
phone redacted/absent
URL redacted/absent
business codes preserved
```

## 10.3 Restore PRO

Restore the exact original entitlement state.

Issue a fresh request.

Required:

```text
effective tier = PRO
original legitimate body visible again
```

## 10.4 DB proof

Record before/temporary/after values.

Required:

```text
original state restored exactly
```

No `N/A` is allowed for this gate in a VERDICT A report.

---

# 11. UNAUTHORIZED INTERNAL STAFF — AUTHENTICATED RUNTIME ONLY

Use a real authenticated internal user that lacks:

```text
communication.read_own
```

FINANCE may be used if the current RBAC still lacks the permission.

Before request:

```text
prove actor role
prove relevant effective permission absence
```

Then call the actual Communication endpoint.

Record:

```text
actor
role
endpoint
HTTP status
response
```

Required:

```text
403 or canonical permission denial
```

Decorator/code inspection alone does not satisfy this gate.

---

# 12. REVERSE MARKETPLACE — REAL HTTP/PERSISTENCE ONLY

This entire section must execute the real endpoint:

```text
POST /communications/reverse/conversations/:id/messages
```

Use a controlled reverse conversation.

Record:

```text
conversation ID/code
buyer identity
partner identity
actor token/session
```

Use unique markers.

## 12.1 Harmless

Body:

```text
R3-RV-HARMLESS Please send updated availability for tomorrow.
```

Required:

```text
HTTP 201/2xx
persisted count = 1
```

## 12.2 Email

Body includes:

```text
r3-rv@example.invalid
```

Required:

```text
HTTP 422 or canonical rejection
persisted count = 0
```

## 12.3 Phone

Body includes:

```text
+994500000032
```

Required:

```text
HTTP 422 or canonical rejection
persisted count = 0
```

## 12.4 URL

Body includes:

```text
https://example.invalid/r3-rv
```

Required:

```text
HTTP 422 or canonical rejection
persisted count = 0
```

## 12.5 Persistence query

After all four:

```text
R3-RV-HARMLESS count = 1
email marker count    = 0
phone marker count    = 0
URL marker count      = 0
```

A unit test is not runtime evidence.

A call-chain description is not runtime evidence.

---

# 13. REQUIRED RUNTIME EVIDENCE TABLE

The final report must contain exactly these remaining hard gates with actual observed values:

| Gate | Actor | Endpoint | HTTP | Persistence/Data result | PASS |
|---|---|---|---:|---|---|
| Partner A own ORDER | | | | | |
| Partner A foreign ORDER | | | | | |
| Partner A own BOOKING | | | | | |
| Partner A foreign BOOKING | | | | | |
| Buyer A own context | | | | | |
| Buyer A foreign context | | | | | |
| Basic safe projection | | | | | |
| Pro original projection | | | | | |
| Pro state before transition | | | | | |
| BASIC after entitlement change | | | | | |
| Pro after restoration | | | | | |
| Unauthorized staff | | | | | |
| Reverse harmless | | | | | |
| Reverse email | | | | | |
| Reverse phone | | | | | |
| Reverse URL | | | | | |

For VERDICT A:

```text
no blank cells
no "code-verified"
no "unit-verified" replacing runtime
no N/A for entitlement transition
```

---

# 14. TEST / TSC REGRESSION

Production/test code must remain unchanged.

Rerun the relevant existing commands:

```text
Communication tests
CRM contact-projection tests if present
relevant Order/Booking tests
Backend TypeScript compile/typecheck
```

Record:

```text
exact command
exit code
tests passed/failed
```

No test modification is allowed.

---

# 15. CLEANUP

Remove only Round-3 synthetic evidence.

Required cleanup:

```text
Round-3 Communications
Round-3 reverse conversation/messages
Round-3 synthetic Buyers/Customers
Round-3 synthetic Orders/Bookings if created
Round-3 Partner/Storefront if created
temporary entitlement mutation restored
other R3 fixtures
```

Final cleanup proof:

```text
R3 synthetic contact-bearing Communications: 0
R3 rejected reverse messages persisted:      0
R3 disposable users/customers:               0
temporary entitlement state:                 RESTORED
```

Do not delete unrelated/pre-existing fixtures.

---

# 16. CORRECT THE STRICT REVIEW REPORT

Update:

```text
docs/prompts/PHASE_3_STEP_3.7B_COMMUNICATION_BUSINESS_CONTEXT_INTEGRATION_STRICT_REVIEW_REPORT.md
```

The report must explicitly distinguish:

```text
Round 1 evidence
Round 2 evidence
Round 3 runtime evidence
```

For every remaining gate above, cite the actual Round-3 HTTP/runtime result.

Do not leave contradictory labels such as:

```text
Evidence type: Runtime
Result: Code: ...
```

or:

```text
Runtime + Unit
```

when only unit evidence exists.

---

# 17. FINDINGS

If a runtime check fails in a way that proves a product defect, report:

```text
Finding ID:
Severity: P0 | P1 | P2 | P3
Classification: SYSTEM DEFECT
Area:
Actor:
Endpoint:
Request:
HTTP:
Persistence:
Expected:
Actual:
Impact:
Required remediation:
```

Then:

```text
VERDICT B
STEP 3.7B NOT CLOSED
```

Do not repair it inside this review.

If only evidence remains incomplete:

```text
Classification: EVIDENCE GAP
```

---

# 18. GIT CLOSURE

At end:

```bash
git status --short
git diff --name-only
git diff --cached --name-only
```

Only the intended Strict Review report may be committed by this task.

Commit and push the corrected report.

Then record:

```bash
git rev-parse HEAD
git rev-parse origin/master
```

Required:

```text
HEAD == origin/master
```

Report separately:

```text
review production changes: NONE
review test changes: NONE
schema/migration changes: NONE
unrelated dirty state: ...
```

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

# 19. VERDICT RULES

## VERDICT A

Allowed only if **all remaining Round-3 runtime gates** are proven with real authenticated HTTP/runtime evidence and there are no unresolved P0/P1/P2 findings.

Output exactly:

```text
VERDICT A — STEP 3.7B COMMUNICATION BUSINESS-CONTEXT INTEGRATION — STRICT REVIEW APPROVED
STEP 3.7B CLOSED
```

Then STOP.

Do not start the next roadmap step.

Do not perform roadmap synchronization in this same task.

---

## VERDICT B — EVIDENCE GAP

If any required runtime gate is still replaced by code/unit evidence or is absent:

```text
VERDICT B — STEP 3.7B COMMUNICATION BUSINESS-CONTEXT INTEGRATION — STRICT REVIEW FAILED
STEP 3.7B NOT CLOSED
Classification: EVIDENCE GAP
```

List only the remaining missing runtime gates.

---

## VERDICT B — SYSTEM DEFECT

If runtime proves an actual implementation/security defect:

```text
VERDICT B — STEP 3.7B COMMUNICATION BUSINESS-CONTEXT INTEGRATION — STRICT REVIEW FAILED
STEP 3.7B NOT CLOSED
Classification: SYSTEM DEFECT
```

List the exact findings.

Do not fix them in this task.

---

# 20. STOP CONDITION

This task ends with one of:

```text
A) STRICT REVIEW APPROVED
   STEP 3.7B CLOSED
```

or:

```text
B) STRICT REVIEW FAILED
   STEP 3.7B NOT CLOSED
```

No further implementation or roadmap stage is allowed in the same task.
