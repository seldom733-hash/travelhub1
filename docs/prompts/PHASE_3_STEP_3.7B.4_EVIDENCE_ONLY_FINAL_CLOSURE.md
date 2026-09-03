# PHASE 3 — STEP 3.7B.4 — EVIDENCE-ONLY FINAL CLOSURE

## MODE

**EVIDENCE ONLY. NO PRODUCTION REMEDIATION.**

This step exists solely to close the last three unresolved hard gates after Step 3.7B.3:

```text
1. actual participant-spoof runtime proof
2. actual reverse pre-sale chat runtime regression
3. final Git commit/push closure with real SHAs
```

The current Communication sanitizer / disclosure-policy implementation is treated as accepted unless this evidence proves a regression.

Do not modify production code unless a new defect is discovered and a separate remediation step is explicitly approved.

Do not perform Strict Review in this step.

Do not start Step 3.7C.

Successful outcome:

```text
VERDICT A — STEP 3.7B.4 EVIDENCE-ONLY FINAL CLOSURE — PASS
STEP 3.7B READY FOR STRICT REVIEW
```

Anything else:

```text
VERDICT B — STEP 3.7B.4 EVIDENCE CLOSURE FAILED
STEP 3.7B NOT READY FOR STRICT REVIEW
```

---

# 1. Mandatory Git preflight

Run:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git log --oneline --decorate -20
```

Record exactly:

```text
Starting HEAD:
origin/master:
working tree:
pre-existing unrelated changes:
```

Actual repository state is authoritative.

Do not assume previous report placeholders.

---

# 2. Production-code freeze

Before evidence work, confirm whether Step 3.7B.3 production code is already present in the current HEAD.

Expected production areas already implemented:

```text
backend/src/modules/communication/communication.service.ts
backend/src/modules/communication/communication.controller.ts
backend/src/shared/anti-disintermediation.ts (reused, not necessarily changed)
```

If the 3.7B.3 production fix is not committed, commit it first as the implementation/remediation commit.

After that:

```text
NO production code changes are allowed in 3.7B.4
```

unless a new defect is discovered.

If a new defect is discovered:

```text
STOP
VERDICT B
```

and report it without silently fixing it.

---

# 3. Accepted prior evidence

Do not re-run broad matrices unnecessarily.

The following are already accepted from Step 3.7B.3 unless new evidence contradicts them:

```text
BASIC own ORDER → 200, contacts sanitized
BASIC own BOOKING → 200, contacts sanitized
business identifiers preserved
PRO original body preserved
Platform ADMIN original body preserved
unauthorized MARKETER → 403
Buyer own ORDER → 200
Buyer foreign ORDER → 404
Buyer own BOOKING → 200
Buyer foreign BOOKING → 404
Partner foreign scope denied
anonymous → 401
all BASIC-readable Communication endpoints use policy-aware projection
schema unchanged
migration NONE
backfill NONE
stored Communication unchanged
```

Do not waste time rebuilding these fixtures unless required for the two remaining runtime checks.

---

# 4. Hard Gate A — participant spoofing runtime

The previous report proved that Buyer/Partner cannot call `POST /communications` because they lack `communication.create`.

That is useful RBAC evidence, but it does **not** prove participant/context consistency for an authorized creator.

This step must execute a real spoof attempt using an actor that is allowed to create Communications.

---

# 5. Build/locate valid spoof fixture

Use canonical isolated data:

```text
Customer A
Partner A
Order A
```

with authoritative relationship:

```text
Order A.customerId = Customer A
Order A.sellerPartnerId = Partner A
```

Create/use a second unrelated:

```text
Partner B
```

and, if necessary:

```text
Customer B
```

Use synthetic fixture data only.

---

# 6. Authorized creator

Use a real actor that has:

```text
communication.create
```

for example, according to current RBAC:

```text
ADMIN
OPERATOR
SALES_MANAGER
```

Record:

```text
actor:
role:
relevant permissions:
```

---

# 7. Spoof attempt A — wrong seller/recipient

Call the real:

```text
POST /communications
```

for:

```text
contextType = ORDER
contextId   = Order A
```

but attempt to supply a participant/recipient representing:

```text
Partner B
```

instead of authoritative:

```text
Partner A
```

Use the exact DTO fields actually accepted by the current API.

Do not invent unsupported fields.

Record the exact request shape.

---

# 8. Expected safe spoof outcome

Acceptable outcomes:

```text
A. request rejected with controlled 4xx because participant/context mismatch
```

or:

```text
B. client-supplied participant is ignored/overridden and persisted participant is derived from authoritative Order context
```

Unacceptable:

```text
C. Communication persists with Partner B attached to Order A
```

If C occurs:

```text
STOP
VERDICT B — PARTICIPANT SPOOFING DEFECT CONFIRMED
```

Do not remediate in 3.7B.4.

---

# 9. Spoof persistence check

After the attempt, inspect the persisted Communication state.

Required proof:

```text
forged Partner B not persisted as legitimate participant for Order A
```

If request was rejected:

```text
no forged Communication persisted
```

If request was normalized:

```text
persisted participant = authoritative Partner A
```

---

# 10. Optional second spoof vector

If the API permits a Customer/Buyer participant field independently from recipient/seller, run one additional mismatch:

```text
Order A.customerId = Customer A
payload claims Customer B
```

Do not perform this if the DTO has no such independently spoofable field.

Report:

```text
N/A — field not accepted
```

instead of inventing a test.

---

# 11. Hard Gate B — reverse pre-sale chat runtime regression

This must be executed against the real runtime path.

Do not substitute:

```text
unit tests only
source inspection only
Step 3.7A.2 historical evidence
```

The exact current endpoint must be used.

Expected path from prior architecture:

```text
POST /communications/reverse/conversations/:id/messages
```

Confirm actual route/controller before running.

---

# 12. Build isolated valid reverse-conversation fixture

If no current BuyerRequest fixture exists, create a minimal **canonical valid** fixture chain according to the repository model.

Use normal repository services/seed/test fixture conventions.

Do not insert arbitrary broken rows.

The fixture must result in a valid conversation where:

```text
Buyer A
Partner A
```

are legitimate participants.

Use synthetic data only.

---

# 13. Reverse chat case 1 — harmless message

Send:

```text
Hello, I have a question about this offer.
```

Required:

```text
success according to current API contract
message persisted
```

Record exact:

```text
HTTP
response body summary
message/CML identifier
persistence check
```

---

# 14. Reverse chat case 2 — email

Send synthetic:

```text
contact-check@example.invalid
```

Required:

```text
HTTP 422
not persisted
```

Record exact error body/reason code where available.

---

# 15. Reverse chat case 3 — phone

Send synthetic:

```text
+994500000001
```

Required:

```text
HTTP 422
not persisted
```

---

# 16. Reverse chat case 4 — URL

Send synthetic:

```text
https://example.invalid/contact
```

Required:

```text
HTTP 422
not persisted
```

---

# 17. Persistence semantics — HARD GATE

After all four attempts, prove:

```text
harmless message persisted exactly once
email attempt persisted: 0
phone attempt persisted: 0
URL attempt persisted: 0
```

Do not rely only on HTTP status.

Inspect canonical persistence/read endpoint or DB through project-approved test method.

---

# 18. Current-path confirmation

Document the exact runtime path:

```text
controller
service
validation helper
anti-disintermediation helper
persistence
```

This is not a broad architecture review.

The purpose is only to prove the 3.7B precision changes did not bypass or weaken the existing reverse-chat enforcement.

---

# 19. No sanitizer conflation

Keep these behaviors distinct:

```text
Reverse pre-sale send path
→ reject contact-bearing user messages

ORDER/BOOKING Communication read path for BASIC
→ safe read projection/redaction
```

Do not change one policy to imitate the other.

---

# 20. Focused automated tests

After runtime evidence, run the current relevant Communication tests.

At minimum:

```text
communication unit/integration tests
sanitizer precision tests
reverse chat anti-disintermediation tests
```

If project suite grouping makes it easier, run the full Communication suite.

Report actual counts.

Do not copy prior `44/44` unless that is the actual current count.

---

# 21. TypeScript

Run:

```text
Backend TSC
```

Frontend TSC/test is not required if no frontend code changed, unless project CI convention runs it globally.

If run, report actual result.

---

# 22. Fixture cleanup

Delete/rollback all synthetic:

```text
Customer A/B
Partner A/B if synthetic
Order A
BuyerRequest
ReverseConversation/Thread
harmless message
Communication/CML fixtures
test users
temporary role/permission fixtures
```

Report exact cleanup.

No synthetic contact data should remain.

---

# 23. Git closure — HARD GATE

The previous report contained placeholders:

```text
Precision SHA: (commit below)
Evidence/report SHA: (same commit)
Final HEAD: (after commit)
origin/master: ... (before push)
```

This is forbidden here.

First identify whether the actual precision remediation is already committed.

If not, create a real commit containing only intended Step 3.7B.3 production/test/report files.

Then, if project convention commits this 3.7B.4 evidence report, commit it separately or together according to repository convention.

Push all intended commits.

Finally run:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status
git log --oneline --decorate -10
```

Required:

```text
Final HEAD == origin/master
```

---

# 24. Separate SHA identities

Report distinctly:

```text
3.7B implementation SHA
3.7B.2 contact-disclosure remediation SHA
3.7B.3 precision remediation SHA
3.7B.4 evidence/report SHA
Final HEAD
origin/master
```

If some of these were committed together historically, state that clearly.

Do not fabricate separate SHAs.

---

# 25. Working-tree honesty

Do not stage, restore, or delete unrelated pre-existing changes.

If unrelated deletions/untracked prompt files remain, report them.

Do not call the tree clean if it is not clean.

---

# 26. No roadmap sync yet

Even after a successful 3.7B.4:

```text
Step 3.7B is READY FOR STRICT REVIEW
```

It is still not:

```text
APPROVED
FULLY CLOSED
DONE
```

Do not update the roadmap as completed before separate Strict Review.

---

# 27. Required final report

## A. Verdict

Only one of:

```text
VERDICT A — STEP 3.7B.4 EVIDENCE-ONLY FINAL CLOSURE — PASS
STEP 3.7B READY FOR STRICT REVIEW
```

or:

```text
VERDICT B — STEP 3.7B.4 EVIDENCE CLOSURE FAILED
STEP 3.7B NOT READY FOR STRICT REVIEW
```

---

## B. Git baseline

```text
Starting HEAD:
origin/master:
working tree:
pre-existing unrelated changes:
```

---

## C. Participant spoof fixture

```text
Order:
Customer A:
Partner A:
Partner B:
authorized creator:
```

Use sanitized IDs/codes in the report.

---

## D. Participant spoof request

Show sanitized request body.

Show:

```text
contextType
contextId
forged participant field(s)
```

---

## E. Participant spoof result

```text
HTTP:
error/normalization result:
persisted:
authoritative participant:
forged participant persisted:
```

Required PASS condition:

```text
forged participant persisted: NO
```

---

## F. Reverse-chat runtime matrix

| Case | Input class | HTTP | Persisted? | Result |
|---|---|---:|---:|---|
| harmless | normal text | success | YES | PASS |
| email | synthetic email | 422 | NO | PASS |
| phone | synthetic phone | 422 | NO | PASS |
| URL | synthetic URL | 422 | NO | PASS |

---

## G. Reverse-chat runtime path

```text
route:
controller:
service:
validator:
anti-disintermediation helper:
persistence:
```

---

## H. Persistence check

```text
harmless persisted:
email persisted:
phone persisted:
URL persisted:
```

---

## I. Tests

Actual counts:

```text
Communication:
precision/sanitizer:
reverse-chat:
Backend TSC:
Frontend: N/A or actual
```

---

## J. Cleanup

Exact fixture cleanup.

---

## K. Changed files in 3.7B.4

Expected:

```text
production files: NONE
test files: NONE unless evidence fixture/test helper legitimately required
docs/report: ...
```

If production files changed:

```text
VERDICT B
```

unless a separately approved remediation occurred.

---

## L. Git final

No placeholders:

```text
3.7B implementation SHA:
3.7B.2 remediation SHA:
3.7B.3 precision SHA:
3.7B.4 evidence/report SHA:
Final HEAD:
origin/master:
HEAD == origin/master:
working tree:
pre-existing unrelated changes:
```

---

## M. Strict Review readiness

```text
READY FOR STEP 3.7B STRICT REVIEW: YES/NO
```

Do not start review.

---

# 28. Hard PASS gates

`VERDICT A` is forbidden unless:

```text
[ ] actual Git baseline recorded
[ ] no hidden production remediation in 3.7B.4
[ ] authorized communication creator used for spoof test
[ ] real participant/context mismatch attempted
[ ] exact spoof request recorded
[ ] forged participant not persisted
[ ] persistence checked
[ ] actual reverse-conversation fixture exists
[ ] harmless reverse-chat message sent through real endpoint
[ ] harmless message persisted
[ ] email sent through real endpoint
[ ] email → 422
[ ] email not persisted
[ ] phone sent through real endpoint
[ ] phone → 422
[ ] phone not persisted
[ ] URL sent through real endpoint
[ ] URL → 422
[ ] URL not persisted
[ ] current runtime path documented
[ ] Communication tests pass
[ ] Backend TSC passes
[ ] all fixtures cleaned
[ ] exact 3.7B.3 precision/remediation SHA resolved
[ ] exact 3.7B.4 evidence/report SHA resolved if committed
[ ] Final HEAD is real
[ ] origin/master is real
[ ] HEAD == origin/master
[ ] no pending/placeholders
[ ] working-tree state reported honestly
[ ] Step 3.7B not marked APPROVED/CLOSED
```

Any failed gate:

```text
VERDICT B
STEP 3.7B NOT READY FOR STRICT REVIEW
```

---

# 29. Stop condition

After this evidence-only pass:

1. return the final report;
2. if participant spoofing succeeds, return `VERDICT B`;
3. if any contact-bearing reverse-chat message persists, return `VERDICT B`;
4. if harmless reverse-chat runtime cannot be executed, return `VERDICT B`;
5. if Git still contains placeholders or is not synchronized, return `VERDICT B`;
6. if all gates pass, state only:

```text
STEP 3.7B READY FOR STRICT REVIEW
```

7. do not perform Strict Review;
8. do not update Step 3.7B as APPROVED;
9. do not start Step 3.7C;
10. wait for the separate Strict Review prompt.
