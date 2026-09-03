# PHASE 3 — PRE-STEP 3.12 — MARKETPLACE / STOREFRONT REFERENCE NUMBER CONTRACT — ROUND 2 NARROW RUNTIME & SECURITY EVIDENCE CLOSURE

## STATUS

**Task type:** Narrow evidence/security closure after Final Strict Review  
**Starting SHA:** `8c70650`  
**Previous stable infrastructure SHA:** `8e0d42f`

The previous Strict Review successfully remediated the unsafe `storefrontCode` allocator:

```text
count()+1
→
Hi/Lo allocation through BusinessSequence
```

However, **VERDICT A is not yet allowed** because several hard gates were marked PASS without the required runtime evidence.

This task is intentionally narrow.

Do not redesign the Reference Number architecture.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и текстовая документация должны быть преимущественно **на русском языке**.

Это относится к:

- Evidence Closure Report;
- Runtime Report;
- Security Report;
- findings explanations;
- root cause analysis;
- architecture/security decisions;
- concurrency evidence;
- tenant-isolation evidence;
- conclusions;
- acceptance matrix;
- verdict explanations.

English допускается только для technical identifiers: paths, models, methods, API endpoints, HTTP methods/status codes, SQL/code snippets, commands, enums, permission identifiers, commit messages, reference-number examples и standardized `VERDICT`.

**Hard acceptance criterion:** преимущественно англоязычный отчёт считается незавершённым.

---

# 1. PURPOSE

Close only these unresolved gates:

```text
A. storefrontCode production-path concurrency proof
B. Partner/Storefront tenant API runtime qualification
C. fresh-DB storefront creation after allocator fix
```

The previous report already established:

```text
canonical reference formats
referenceNumber Hi/Lo allocator
DB uniqueness constraints
SF000 quarantine semantics
referenceNumber immutability
UUID/legacy preservation
representative-data preservation
```

Do not repeat large remediation unless new evidence reveals a real defect.

---

# 2. STOREFRONT CODE CONCURRENCY — HARD GATE

The previous defect was:

```ts
const sfCount = await tx.partnerStorefront.count();
const storefrontCode = `SF${String(sfCount + 1).padStart(3, "0")}`;
```

It was changed to:

```ts
const storefrontCode = await this.ids.nextStorefrontCode(tx);
```

The architecture now claims:

```text
IdsService.nextStorefrontCode()
→ BusinessSequence
→ Hi/Lo block allocation
→ unique storefrontCode
```

This must now be proven through the **actual production Storefront creation path**.

---

# 3. PRODUCTION-PATH PARALLEL STOREFRONT CREATION

Create at least:

```text
20 concurrent Storefront creation attempts
```

using the same application service/API path used in production.

Do not call `IdsService.allocate("SF")` directly as the only evidence.

Required path should resemble:

```text
real create Storefront request/service
→ StorefrontService
→ nextStorefrontCode()
→ BusinessSequence
→ PartnerStorefront INSERT
```

Use an isolated test DB.

Prove:

```text
successful creations:
unique storefrontCode count:
duplicate storefrontCode:
unexpected failures:
unique constraint failures exposed to caller:
```

Required:

```text
duplicate storefrontCode = 0
unexpected allocation failures = 0
```

If business constraints prevent 20 Storefronts for one Partner, create valid independent Partners/owners in the isolated test setup.

Do not weaken production validation merely to run the test.

---

# 4. MULTI-PROCESS / MULTI-INSTANCE SAFETY

The previous report described a:

```text
Per-process claim gate
```

in addition to atomic `BusinessSequence.upsert`.

Explicitly determine whether correctness depends on the process-local gate.

The system must remain safe if two backend instances allocate codes concurrently.

Prove or explain:

```text
Process A → block claim
Process B → block claim
→ DB atomicity guarantees distinct ranges
```

The process-local gate may optimize local behavior, but **must not be the global correctness boundary**.

If practical, run the concurrency test with independent allocator/service instances.

---

# 5. STOREFRONT CODE NON-REUSE

Verify:

```text
create Storefront → SFxxx
delete/archive it where allowed
create another Storefront
→ old SFxxx is NOT reused
```

If Storefront deletion is prohibited, prove monotonic sequence behavior using the authoritative allocator and report deletion test as N/A with reason.

---

# 6. FRESH ISOLATED DB — HARD GATE

The previous report itself stated:

```text
Fresh-DB storefrontCode regression:
Allocator fix needs fresh-DB validation
```

Therefore this must now be executed.

Create a genuinely empty isolated PostgreSQL database.

Run:

```text
empty DB
→ prisma migrate deploy
→ required seed/bootstrap
→ backend/service initialization
→ create Partner as required
→ create Storefront through production path
→ verify storefrontCode
```

Expected:

```text
SFxxx
```

according to the canonical stored format.

Do not manually patch the schema.

---

# 7. FRESH-DB STOREFRONT ASSERTIONS

On the fresh DB prove:

```text
PartnerStorefront.storefrontCode IS NOT NULL
storefrontCode matches canonical format
storefrontCode is unique
BusinessSequence contains/advances authoritative SF sequence
second Storefront receives a different code
```

Prefer:

```text
SF001
SF002
```

on genuinely empty sequence state, but do not hardcode those exact values if bootstrap legitimately consumes sequence entries.

The requirement is canonical, unique, monotonic allocation.

---

# 8. FRESH-DB CLEANUP

After evidence:

```text
drop isolated DB
```

unless repository test tooling intentionally manages lifecycle automatically.

Record cleanup result.

Do not mutate/reset `travelhub1`.

---

# 9. TENANT API RUNTIME QUALIFICATION — DO NOT SUBSTITUTE RBAC TABLES

The previous report used permission configuration as evidence for runtime tenant isolation.

That is insufficient.

Canonical rule:

```text
permission matrix
≠
runtime negative API evidence
```

This task must determine what Partner commerce APIs actually exist today.

---

# 10. FIRST CLASSIFY CURRENT PARTNER COMMERCE CAPABILITY

Audit current implementation/roadmap for Partner access to:

```text
Orders
Bookings
Payments
Refunds
```

For each resource classify exactly one:

```text
IMPLEMENTED — own-tenant API exists
NOT IMPLEMENTED — Partner own-commerce API not yet available
NOT APPLICABLE — only if architecture explicitly says so
```

Do not infer implementation merely because tables/data exist.

Do not implement an entire future Partner Commerce Center merely to satisfy this evidence task.

---

# 11. IF OWN-TENANT API EXISTS — REQUIRED RUNTIME MATRIX

For every resource whose Partner own-commerce API is implemented, create two real Storefront contexts:

```text
Storefront A / Partner A
Storefront B / Partner B
```

and representative records belonging to each in an isolated/controlled environment.

Execute real authenticated HTTP/API requests.

Required matrix:

| Resource | SF-A → A | SF-A → B | SF-B → B | SF-B → A |
|---|---|---|---|---|
| Order | ALLOW | DENY | ALLOW | DENY |
| Booking | ALLOW | DENY | ALLOW | DENY |
| Payment | ALLOW | DENY | ALLOW | DENY |
| Refund | ALLOW | DENY | ALLOW | DENY |

Only rows corresponding to actually implemented APIs are required to execute.

Evidence must include:

```text
actor/context
HTTP method
endpoint
target record id/referenceNumber
expected status
actual HTTP status
result
```

Do not expose auth tokens or passwords.

---

# 12. DENIAL SEMANTICS

Cross-tenant access may return:

```text
403
```

or intentionally:

```text
404
```

to avoid resource enumeration.

Either can be acceptable if consistent with project security policy.

What is not acceptable:

```text
200 with foreign tenant data
```

---

# 13. IF PARTNER OWN-COMMERCE API IS NOT IMPLEMENTED

Then report truthfully:

```text
Order Partner own API: NOT IMPLEMENTED
Booking Partner own API: NOT IMPLEMENTED
...
```

and mark corresponding runtime matrix cells:

```text
NOT QUALIFIABLE — capability not implemented
```

Do **not** write:

```text
PASS — PARTNER has no order.read permission
```

That proves global denial, not tenant-scoped isolation.

This distinction is mandatory:

```text
Secure because feature does not exist
≠
Tenant isolation of an implemented feature proven
```

---

# 14. DO NOT ACCIDENTALLY CHANGE PARTNER PRODUCT SCOPE

Canonical Partner architecture remains:

```text
Marketplace Basic:
Orders
Bookings
necessary Messages
basic Finance
basic Analytics
minimal operational CRM/customer context

Storefront Pro:
expanded business-management capabilities
```

Therefore a permanent architecture in which:

```text
PARTNER cannot read any own Orders/Bookings/Payments
```

is not the intended final Partner Workspace model.

If own-commerce access is simply scheduled for a later roadmap stage, document that as:

```text
PLANNED / NOT IMPLEMENTED
```

Do not create a new implementation stage here unless a tiny missing authorization defect blocks an already-existing endpoint.

---

# 15. PLATFORM → STOREFRONT NEGATIVE RUNTIME

Where an existing Platform endpoint accepts a record identifier/reference and Storefront commerce records physically exist, test whether Platform operational access can retrieve Storefront commerce.

Canonical rule:

```text
Platform operational commerce
= Marketplace commerce

Storefront customer commerce
= Partner/Storefront workspace
≠ Platform Marketplace commerce
```

For applicable endpoints execute real runtime negative tests.

At minimum audit:

```text
Order
Booking
```

and Payment/Refund if Platform read endpoints actually exist.

If no read endpoint/permission exists for a resource, report:

```text
NOT QUALIFIABLE / NOT IMPLEMENTED
```

rather than fabricating PASS.

---

# 16. PREFIX IS NOT AUTHORIZATION

During runtime tests prove that changing/guessing:

```text
MKT-...
SF001-...
SF002-...
SF000-...
```

does not bypass authoritative ownership/security checks.

Authorization must be based on actual workspace/tenant relations and permissions.

No code should use reference prefix as the security boundary.

---

# 17. SF000

Do not modify quarantine records.

Canonical:

```text
SF000 = unresolved provenance quarantine
SF000 ≠ valid tenant
```

No Partner must be able to authenticate as `SF000`.

No fake PartnerStorefront should be created for `SF000`.

This task does not resolve historical ownership.

---

# 18. REPRESENTATIVE RUNTIME DB — NON-DESTRUCTIVE

Verify `travelhub1` remains unchanged by the isolated tests.

Capture at least:

```text
Orders
Bookings
Payments
Refunds
Users
Partners
PartnerStorefronts
```

before/after where relevant.

Do not reseed or reset representative data.

---

# 19. REFERENCE FORMAT REGRESSION

After storefrontCode fix, verify newly created Storefront references still follow:

```text
{storefrontCode}-ORD-{SEQ}
{storefrontCode}-BKG-{SEQ}
{storefrontCode}-PAY-{SEQ}
{storefrontCode}-REF-{SEQ}
```

where those creation flows exist.

Marketplace references must remain:

```text
MKT-ORD-{SEQ}
MKT-BKG-{SEQ}
MKT-PAY-{SEQ}
MKT-REF-{SEQ}
```

Do not redesign format in this task.

---

# 20. TESTS

Minimum new/updated regression coverage should include:

```text
parallel production-path Storefront creation
storefrontCode uniqueness
storefrontCode monotonic/non-reuse behavior
fresh-DB Storefront creation
multi-instance/block-claim safety where feasible
```

For tenant isolation:

- automated API integration/E2E tests where capability exists;
- otherwise explicit `NOT IMPLEMENTED / NOT QUALIFIABLE`.

---

# 21. BUILD / TYPECHECK

Run and report actual:

```text
backend typecheck
backend build
reference-number unit tests
reference-number concurrency tests
new Storefront production-path concurrency tests
applicable tenant API integration/E2E tests
prisma validate
frontend typecheck
```

Known unrelated frontend issue may remain:

```text
storefrontSessions type mismatch
```

If command fails, report:

```text
Frontend typecheck: FAIL
```

Do not turn it into PASS(scope).

---

# 22. FRESH-DB MIGRATION REGRESSION

Because a genuinely fresh DB is required by this task, record:

```text
prisma migrate deploy
```

result and migration count.

This simultaneously closes the previous residual:

```text
Fresh-DB storefrontCode regression
```

Do not manually mark it PASS without actual execution.

---

# 23. GIT / WORKTREE

Previous report had:

```text
HEAD == origin/master: YES
Working tree clean: NO (unrelated files)
```

Before final verdict identify the unrelated dirty files.

Do not delete user work.

Report:

```text
git status --short
```

in sanitized form.

Reference closure may still be accepted with unrelated user files present only if:

- they are identified;
- they are demonstrably unrelated;
- intended closure changes are committed/pushed;
- no required evidence/code is left uncommitted.

Preferred final state:

```text
HEAD == origin/master
closure changes committed
```

---

# 24. ROADMAP

Update the canonical roadmap **only after actual evidence is obtained**.

Add a narrow Round 2 closure entry recording:

```text
storefrontCode production-path concurrency
fresh-DB Storefront creation
Partner commerce API capability classification
actual tenant runtime evidence OR truthful NOT QUALIFIABLE
final SHA
final verdict
```

Do not rewrite previous history.

---

# 25. REQUIRED STOREFRONT CONCURRENCY MATRIX

Final report must contain:

| Test | Production path? | Concurrency | Success | Duplicates | Unexpected failures | Result |
|---|---|---:|---:|---:|---:|---|
| Storefront creation | YES | ≥20 | | | | |
| storefrontCode allocation | via Storefront creation | ≥20 | | | | |
| Multi-instance/block claim | YES/representative | | | | | |

---

# 26. REQUIRED FRESH-DB MATRIX

| Gate | Evidence | Result |
|---|---|---|
| Empty DB created | | PASS/FAIL |
| Migrations applied | | PASS/FAIL |
| Seed/bootstrap | | PASS/FAIL |
| Partner created | | PASS/FAIL |
| Storefront created through production path | | PASS/FAIL |
| storefrontCode canonical | | PASS/FAIL |
| second Storefront unique | | PASS/FAIL |
| BusinessSequence advanced | | PASS/FAIL |
| DB dropped/cleaned | | PASS/FAIL |

---

# 27. REQUIRED PARTNER CAPABILITY MATRIX

| Resource | Own-tenant API status | Runtime qualifiable? | Notes |
|---|---|---|---|
| Order | IMPLEMENTED / NOT IMPLEMENTED | YES/NO | |
| Booking | IMPLEMENTED / NOT IMPLEMENTED | YES/NO | |
| Payment | IMPLEMENTED / NOT IMPLEMENTED | YES/NO | |
| Refund | IMPLEMENTED / NOT IMPLEMENTED | YES/NO | |

This matrix must come **before** any tenant-isolation verdict.

---

# 28. REQUIRED TENANT RUNTIME MATRIX

If capability exists:

| Resource | SF-A→A | SF-A→B | SF-B→B | SF-B→A | Evidence type | Result |
|---|---|---|---|---|---|---|
| Order | | | | | HTTP runtime | |
| Booking | | | | | HTTP runtime | |
| Payment | | | | | HTTP runtime | |
| Refund | | | | | HTTP runtime | |

If capability does not exist, use:

```text
NOT QUALIFIABLE — Partner own-commerce API not implemented
```

Do not use PASS.

---

# 29. REQUIRED PLATFORM NEGATIVE MATRIX

| Resource | Platform→Marketplace | Platform→Storefront | Evidence | Result |
|---|---|---|---|---|
| Order | | | HTTP runtime | |
| Booking | | | HTTP runtime | |
| Payment | | | HTTP runtime / NOT QUALIFIABLE | |
| Refund | | | HTTP runtime / NOT QUALIFIABLE | |

---

# 30. REQUIRED ACCEPTANCE MATRIX

| Gate | Result |
|---|---|
| count()+1 remains removed | PASS/FAIL |
| storefrontCode uses production Hi/Lo allocator | PASS/FAIL |
| ≥20 parallel production Storefront creations executed | PASS/FAIL |
| storefrontCode duplicates = 0 | PASS/FAIL |
| Multi-instance correctness established | PASS/FAIL |
| storefrontCode non-reuse established | PASS/FAIL/N/A |
| Fresh empty DB actually created | PASS/FAIL |
| All migrations apply on fresh DB | PASS/FAIL |
| Storefront created on fresh DB through production path | PASS/FAIL |
| Fresh DB storefrontCode valid/unique | PASS/FAIL |
| Fresh DB cleaned up | PASS/FAIL |
| Partner Order capability classified | PASS/FAIL |
| Partner Booking capability classified | PASS/FAIL |
| Partner Payment capability classified | PASS/FAIL |
| Partner Refund capability classified | PASS/FAIL |
| Existing Partner tenant APIs runtime-tested where implemented | PASS/FAIL/NOT QUALIFIABLE |
| No permission-table substitution for runtime evidence | PASS/FAIL |
| Platform→Storefront runtime tested where applicable | PASS/FAIL/NOT QUALIFIABLE |
| Prefix not used as authorization | PASS/FAIL |
| SF000 remains quarantine | PASS/FAIL |
| Representative runtime DB preserved | PASS/FAIL |
| Reference formats preserved | PASS/FAIL |
| Backend typecheck/build/tests | PASS/FAIL |
| Frontend typecheck actual status reported | PASS/FAIL |
| Roadmap truthful | PASS/FAIL |
| Git synchronized | PASS/FAIL |

---

# 31. REQUIRED FINAL REPORT STRUCTURE

Отчёт преимущественно на русском:

```text
1. Executive Summary
2. Starting SHA / Repository State
3. Previous Strict Review Gaps
4. storefrontCode Production Allocator Verification
5. Production-Path Storefront Concurrency Evidence
6. Multi-Instance Safety
7. storefrontCode Non-Reuse
8. Fresh Isolated DB Creation
9. Fresh DB Migration / Bootstrap Evidence
10. Fresh DB Storefront Creation
11. Partner Commerce Capability Classification
12. Partner Tenant Runtime API Evidence
13. Platform → Storefront Runtime Evidence
14. Prefix / Authorization Security Check
15. SF000 Preservation
16. Reference Format Regression
17. Representative Runtime DB Preservation
18. Tests / Build / Typecheck
19. Roadmap Update
20. Git / SHA Evidence
21. Residual Gaps
22. Acceptance Matrix
23. Final Verdict
```

---

# 32. VERDICT RULES

## VERDICT A — REFERENCE NUMBER CONTRACT QUALIFIED

Allowed when:

```text
storefrontCode production path concurrency proven
+
fresh-DB Storefront creation proven
+
tenant capabilities truthfully classified
+
all currently implemented tenant APIs runtime-qualified
+
non-implemented APIs marked NOT QUALIFIABLE, not fake PASS
+
Platform negative scope tested where applicable
+
representative DB preserved
+
Git synchronized
```

A future Partner commerce feature being `NOT IMPLEMENTED` does **not** automatically block Reference Number closure, provided:

1. it is truthfully classified;
2. no implemented tenant API remains untested;
3. no false tenant-isolation PASS is claimed.

## VERDICT B — CLOSURE INCOMPLETE

Required if:

- production Storefront concurrency is not executed;
- fresh-DB Storefront creation is not executed;
- an implemented tenant API lacks required cross-tenant runtime evidence;
- actual cross-tenant leakage is found;
- evidence is replaced by permission-table inspection.

---

# 33. STOP CONDITION

After this Round 2 closure:

**STOP.**

Do not automatically start:

- GMV / Financial KPI Drill-down;
- Cross-Entity Business Reference & Traceability;
- Booking KPI Semantics Audit;
- Finance Center;
- Final PRE-STEP 3.12 Re-Qualification;
- Step 3.12.

Return the report for independent review.
