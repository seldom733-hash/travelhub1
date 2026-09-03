# PHASE 3 — STEP 3.7B — STRICT REVIEW ROUND 3 — FINAL BUYER + GIT CLOSURE

## 0. MODE

**STRICT REVIEW CONTINUATION — FINAL EVIDENCE + ADMINISTRATIVE CLOSURE ONLY.**

This is **not**:

- a new implementation stage;
- Step 3.7B.5;
- a production remediation;
- a new full Strict Review round;
- permission to repeat already accepted Round-3 runtime evidence;
- permission to start the next canonical roadmap stage.

Current authoritative status:

```text
VERDICT B — STEP 3.7B COMMUNICATION BUSINESS-CONTEXT INTEGRATION — STRICT REVIEW FAILED
STEP 3.7B NOT CLOSED

Classification: EVIDENCE GAP
SYSTEM DEFECT: NOT ESTABLISHED
```

Only two blockers remain:

```text
1. Buyer/customer own-vs-foreign runtime isolation — NOT PROVEN
2. Round-3 Strict Review report commit/push + final Git SHA — NOT PROVEN
```

All other Round-3 runtime gates are accepted and **must not be repeated** unless the Buyer test reveals a new contradiction.

---

# 1. ACCEPTED EVIDENCE — DO NOT REOPEN

The following evidence is accepted from prior rounds:

```text
[PASS] canonical Communication ownership
[PASS] no duplicate messaging authority
[PASS] ORDER participant spoof rejection
[PASS] BOOKING positive create/read
[PASS] BOOKING wrong Partner rejection + 0 persistence
[PASS] BOOKING wrong Customer rejection + 0 persistence
[PASS] Partner own ORDER runtime
[PASS] Partner foreign ORDER runtime
[PASS] Partner own BOOKING runtime
[PASS] Partner foreign BOOKING runtime
[PASS] Marketplace Basic contact-safe runtime projection
[PASS] Storefront Pro original runtime projection
[PASS] Pro → Basic → Pro entitlement runtime transition
[PASS] entitlement restored to ACTIVE
[PASS] Platform original projection
[PASS] authenticated FINANCE permission denial
[PASS] reverse harmless runtime + persistence
[PASS] reverse email runtime rejection + 0 persistence
[PASS] reverse phone runtime rejection + 0 persistence
[PASS] reverse URL runtime rejection + 0 persistence
[PASS] real-ID context-type confusion
[PASS] generic create participant bypass rejection
[PASS] sanitizer precision
[PASS] business-code preservation
[PASS] Communication tests
[PASS] Backend TSC
[PASS] Round-3 runtime fixture cleanup
```

Do not spend this task reproducing those checks.

---

# 2. HARD FREEZE

Forbidden:

```text
production code changes
test code changes
schema changes
migration
backfill
permission changes
Communication behavior changes
entitlement changes except a temporary fixture mutation strictly required by Buyer evidence
```

Allowed:

```text
runtime/API calls for Buyer/customer isolation
minimal controlled runtime fixtures
DB reads
safe fixture cleanup
correction/update of the existing Strict Review report
commit/push of that report
```

If Buyer runtime exposes an actual implementation defect:

```text
STOP
VERDICT B
Classification: SYSTEM DEFECT
```

Do not repair it in this task.

---

# 3. GIT PREFLIGHT

Before doing anything:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```

Record:

```text
Starting HEAD:
Starting origin/master:
HEAD == origin/master:
pre-existing dirty state:
```

Do not reset or clean unrelated files.

Do not stage unrelated files.

---

# 4. BUYER / CUSTOMER ISOLATION — ONLY REMAINING SECURITY EVIDENCE GATE

This must be **real authenticated runtime evidence**.

Code inspection alone is insufficient.

Unit tests alone are insufficient.

---

# 5. DETERMINE THE REAL BUYER-FACING PATH

First inspect current routing/guards only to determine which real Communication path Buyer/Customer is allowed to use.

Possible outcomes:

```text
A. Buyer can use generic business-context Communication endpoint
B. Buyer cannot use generic business-context endpoint but has another customer-facing Communication endpoint
C. Buyer has no applicable Order/Booking Communication path in current canonical implementation
```

Do not invent a route.

Record:

```text
route:
controller:
guard:
permission/actor requirement:
service method:
ownership authority:
```

Then execute the appropriate runtime case below.

---

# 6. CASE A — BUYER CAN USE BUSINESS-CONTEXT ENDPOINT

Use two controlled authenticated buyers/customers:

```text
Buyer A
Buyer B
```

Use authoritative business objects:

```text
Order/Booking A owned by Buyer A
Order/Booking B owned by Buyer B
```

Verify ownership from DB/domain data before the API requests.

## 6.1 Buyer A → own context

Execute authenticated request.

Record:

```text
Buyer A user ID:
Buyer A customer ID:
target context type:
target context ID:
target human-readable code:
authoritative owner customer ID:
endpoint:
HTTP:
response:
```

Expected:

```text
allowed according to canonical endpoint contract
```

## 6.2 Buyer A → Buyer B foreign context

Using the **same Buyer A authentication**, request Buyer B's context.

Record:

```text
foreign context type:
foreign context ID:
foreign human-readable code:
authoritative owner customer ID:
endpoint:
HTTP:
response:
```

Expected:

```text
controlled denial
no foreign Communication data disclosed
```

If a write is attempted:

```text
0 persisted
```

---

# 7. CASE B — BUYER USES ANOTHER CUSTOMER-FACING COMMUNICATION PATH

If generic business-context endpoint is unavailable to Buyer but another real customer-facing Communication route exists:

1. prove generic route is unavailable with actual authenticated runtime;
2. identify the canonical Buyer route;
3. execute:

```text
Buyer A → own conversation/context
Buyer A → Buyer B conversation/context
```

Expected:

```text
own → allowed
foreign → controlled denial
```

For foreign write attempts:

```text
0 persisted
```

Record exact HTTP evidence.

---

# 8. CASE C — NO APPLICABLE BUYER ORDER/BOOKING COMMUNICATION PATH

This case may be accepted only if repository reality genuinely has no Buyer-facing Order/Booking Communication route in Step 3.7B.

Required proof:

### 8.1 Route/guard evidence

Show the actual affected routes and why Buyer cannot enter them.

### 8.2 Authenticated runtime evidence

Use a real Buyer token/session against the candidate endpoint.

Expected:

```text
controlled denial
```

### 8.3 Nearest real Buyer Communication path

If Reverse Marketplace conversation is the only Buyer communication surface, identify it and prove ownership isolation with runtime:

```text
Buyer A → own reverse conversation → allowed
Buyer A → Buyer B reverse conversation → denied
```

This is mandatory if such a route exists.

Do not mark Buyer isolation PASS solely from code.

---

# 9. BUYER FOREIGN-ACCESS PERSISTENCE

If any tested Buyer path supports writes, use a unique marker:

```text
R3-FINAL-BUYER-FOREIGN
```

After the denied foreign request, query persistence.

Required:

```text
foreign marker persisted = 0
```

If the tested path is read-only:

```text
persistence check = NOT APPLICABLE — READ-ONLY REQUEST
```

This is an acceptable explicit N/A because no write occurred.

---

# 10. REQUIRED BUYER EVIDENCE TABLE

The report must contain:

| Gate | Actor | Target | Endpoint | HTTP | Data/Persistence | Result |
|---|---|---|---|---:|---|---|
| Buyer A own | | | | | | |
| Buyer A foreign | | | | | | |

If the generic path is unavailable, add:

| Gate | Actor | Target | Endpoint | HTTP | Result |
|---|---|---|---|---:|---|
| Buyer generic-path access | | | | | |
| Buyer own canonical communication path | | | | | |
| Buyer foreign canonical communication path | | | | | |

No blank cells in a PASS report.

---

# 11. BUYER FIXTURE CLEANUP

Remove only fixtures created for this final closure.

Verify:

```text
final-closure synthetic Communications: 0
final-closure rejected foreign writes:  0
final-closure synthetic conversations:  0
final-closure disposable Buyer users:   0
final-closure disposable Customers:     0
```

If pre-existing fixtures were used, do not delete them.

Report exactly which fixtures were pre-existing vs synthetic.

---

# 12. UPDATE THE EXISTING STRICT REVIEW REPORT

Update only:

```text
docs/prompts/PHASE_3_STEP_3.7B_COMMUNICATION_BUSINESS_CONTEXT_INTEGRATION_STRICT_REVIEW_REPORT.md
```

Do not create another competing canonical Strict Review report.

The final report must:

1. preserve accepted Round-1/Round-2/Round-3 evidence;
2. add the Buyer/customer runtime evidence;
3. correct the final evidence matrix;
4. remove any unsupported claim;
5. add final Git closure evidence;
6. state the final verdict only after all gates are complete.

The final report must distinguish:

```text
Round 1
Round 2
Round 3
Final Buyer + Git Closure
```

---

# 13. REPORT CONSISTENCY CHECK

Before committing, search the final report for contradictions.

Specifically ensure it does **not** contain:

```text
Buyer isolation: runtime PASS
```

without actual HTTP evidence.

Ensure no remaining statement says:

```text
Starting HEAD == Final HEAD
```

if this task changes and commits the Strict Review report.

Ensure the final report does not claim:

```text
all mandatory gates PASS
```

until Buyer evidence and Git closure are both complete.

---

# 14. PRODUCTION FREEZE VERIFICATION

Before commit:

```bash
git diff --name-only
git diff --cached --name-only
```

Required task-owned changes:

```text
docs/prompts/PHASE_3_STEP_3.7B_COMMUNICATION_BUSINESS_CONTEXT_INTEGRATION_STRICT_REVIEW_REPORT.md
```

No task-owned production/test/schema changes.

If unrelated dirty files exist:

```text
leave untouched
report separately
```

---

# 15. COMMIT THE FINAL STRICT REVIEW REPORT

Stage only the intended report.

Example intent:

```bash
git add docs/prompts/PHASE_3_STEP_3.7B_COMMUNICATION_BUSINESS_CONTEXT_INTEGRATION_STRICT_REVIEW_REPORT.md
```

Verify staged files:

```bash
git diff --cached --name-only
```

Required:

```text
only the Strict Review report
```

Commit with an appropriate repository-style message.

Then record the real commit SHA:

```bash
git rev-parse HEAD
```

This SHA is the:

```text
STEP 3.7B FINAL STRICT REVIEW CLOSURE SHA
```

No placeholder is allowed.

---

# 16. PUSH + REMOTE EQUALITY

Push the commit.

Then:

```bash
git rev-parse HEAD
git rev-parse origin/master
```

Required:

```text
HEAD == origin/master
```

Record:

```text
Starting HEAD:
Final Strict Review closure SHA:
Final HEAD:
origin/master:
HEAD == origin/master:
```

A PASS report cannot contain:

```text
pending
after push
this commit
TBD
TODO
```

---

# 17. FINAL GIT/WORKTREE EVIDENCE

Record:

```bash
git status --short
```

Separate:

```text
task-owned changes:
unrelated pre-existing dirty state:
```

Required:

```text
task-owned uncommitted changes: NONE
```

Unrelated pre-existing dirty state does not fail the gate if it remained untouched and is honestly reported.

---

# 18. VERDICT RULES

## VERDICT A

Allowed only if:

```text
[PASS] Buyer/customer own runtime proven
[PASS] Buyer/customer foreign runtime denial proven
[PASS] foreign write persistence = 0 where applicable
[PASS] Buyer fixtures cleaned
[PASS] no production changes
[PASS] no test changes
[PASS] no schema/migration changes
[PASS] final Strict Review report updated
[PASS] final report committed
[PASS] real final closure SHA recorded
[PASS] pushed to origin/master
[PASS] HEAD == origin/master
[PASS] no unresolved P0/P1/P2 findings
```

Then output exactly:

```text
VERDICT A — STEP 3.7B COMMUNICATION BUSINESS-CONTEXT INTEGRATION — STRICT REVIEW APPROVED
STEP 3.7B CLOSED
```

Then STOP.

Do not perform roadmap synchronization in this task.

Do not start the next implementation step.

---

## VERDICT B — EVIDENCE GAP

If Buyer runtime or Git closure is still incomplete:

```text
VERDICT B — STEP 3.7B COMMUNICATION BUSINESS-CONTEXT INTEGRATION — STRICT REVIEW FAILED
STEP 3.7B NOT CLOSED
Classification: EVIDENCE GAP
```

List only remaining missing evidence.

---

## VERDICT B — SYSTEM DEFECT

If Buyer runtime demonstrates unauthorized foreign access, disclosure, write, persistence, raw failure, or another real security/correctness defect:

```text
VERDICT B — STEP 3.7B COMMUNICATION BUSINESS-CONTEXT INTEGRATION — STRICT REVIEW FAILED
STEP 3.7B NOT CLOSED
Classification: SYSTEM DEFECT
```

Provide:

```text
Finding ID:
Severity:
Actor:
Endpoint:
Own/foreign context:
Request:
HTTP:
Response:
Persistence:
Expected:
Actual:
Impact:
Required remediation:
```

Do not fix it in this task.

---

# 19. STOP CONDITION

This task has exactly one purpose:

```text
close Buyer/customer isolation evidence
+
close final Strict Review Git evidence
```

It ends with either:

```text
STEP 3.7B CLOSED
```

or:

```text
STEP 3.7B NOT CLOSED
```

Nothing else may be implemented in the same task.
