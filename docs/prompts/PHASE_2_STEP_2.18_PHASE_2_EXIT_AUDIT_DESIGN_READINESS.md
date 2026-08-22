# TRAVELHUB — PHASE 2 — STEP 2.18
## PHASE 2 EXIT AUDIT — DESIGN / READINESS

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.18 — Phase 2 Exit Audit  
**Pass:** DESIGN / READINESS  
**Mode:** REPOSITORY-FIRST / ADVERSARIAL / DOCS-FIRST  
**Implementation:** FORBIDDEN unless this prompt explicitly permits a documentation-only reconciliation  
**Phase 2 approval/exit:** FORBIDDEN  
**Step 2.18 approval:** FORBIDDEN  
**Step 2.18A implementation:** FORBIDDEN  
**Step 2.17B qualification:** FORBIDDEN  
**Release/deploy:** FORBIDDEN

---

# 0. MISSION

Perform the bounded **Step 2.18 Phase 2 Exit Audit — Design / Readiness** pass.

This is **not** the final Phase 2 exit audit and **not** Phase 2 approval.

The purpose is to reconstruct, from repository truth, the complete Phase 2 exit-audit contract and determine exactly what can be audited now, what evidence already exists, what evidence must be freshly reproduced later, what gaps remain, and what is blocked by Step 2.17B or Step 2.18A.

Starting context from the preceding reconciliation:

```text
Decision:
- verdict: B — STEP 2.18 PARTIALLY READY
- canonical NEXT: STEP 2.18 — PHASE 2 EXIT AUDIT — DESIGN/READINESS
- Step 2.17B: BLOCKED / unchanged
- Phase 2 exit: BLOCKED
- Step 2.18 implementation started: NO

Current state:
- 2.17: APPROVED
- 2.17A: APPROVED
- 2.17B: BLOCKED (qualification environment)
- 2.17C: APPROVED
- 2.18: NOT STARTED

Step 2.18 readiness:
- start prerequisites: 2.17 APPROVED, 2.17A APPROVED, ADR-0014 ACCEPTED
- 2.17B required to start: NO
- 2.17B required to complete: YES
- 2.17B required for Phase 2 exit: YES
- ADR-0014/RLS: ACCEPTED (RLS deferred, verify at 2.18)
- PSP dependency: NONE for audit preparation

Phase 2:
- independent work may continue: YES
- Phase 2 exit allowed: NO
- unresolved exit gates: 2.17B, 2.18, 2.18A

latest reconciliation:
074c288 → f1d4a59
final HEAD/upstream: f1d4a59
```

These are navigation hints only.

**Repository is authority.**

---

# 1. REQUIRED OUTCOME

At the end of this pass, the repository must contain an evidence-backed design/readiness definition for the final Step 2.18 audit.

The pass must answer:

1. What exactly does Step 2.18 audit?
2. What are all Phase 2 exit gates?
3. Which gates are already backed by approved persisted evidence?
4. Which gates require fresh re-verification during the final audit?
5. Which gates are currently blocked?
6. What exactly is Step 2.18A?
7. Is 2.18A executable before 2.17B closes?
8. Does ADR-0014 require actual RLS implementation, RLS verification, or verification of an intentional deferral?
9. What tenant-isolation evidence is required?
10. What security, auth, RBAC, ownership and SoD evidence is required?
11. What EventBus/outbox/idempotency evidence is required?
12. What Booking/Order/Sales/Finance/Commission invariants must be audited?
13. What Backup/DR evidence from 2.17A may be reused, and what remains production-capability gap?
14. What performance evidence from 2.17B is valid and reusable?
15. What PSP/payment-provider evidence is explicitly outside the current exit audit?
16. What migrations/schema/drift checks are mandatory?
17. What full regression must the final exit audit run?
18. What constitutes PASS, BLOCKED, FAIL and NOT APPLICABLE?
19. Can any Step 2.18 implementation/verification preparation proceed now?
20. What exact dedicated prompt must follow this pass?

---

# 2. HARD BOUNDARY

This pass must **not**:

```text
approve Step 2.18
approve Phase 2
close Step 2.17B
claim Booking burst PASS or FAIL from invalid environments
perform final frozen-matrix performance qualification
implement RLS unless the canonical Roadmap explicitly defines this design/readiness pass as implementation — if so STOP and classify separately
create migrations
change schema
change RBAC
change ownership
change status machines
change money formulas
change event contracts
change idempotency semantics
change performance targets
tune production performance
implement PSP/aggregator runtime
implement card handling
implement ProviderFee accounting
implement payout/split runtime
release/deploy
```

If actual repository semantics conflict with these boundaries, do not improvise. Return a reconciliation finding.

---

# 3. PROVENANCE / REPOSITORY BASELINE

Run:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -150
git diff
git diff --check
```

Verify the preceding reconciliation and current Roadmap.

Expected reference only:

```text
reconciliation commit: 074c288
provenance/footer: f1d4a59
terminal HEAD/upstream: f1d4a59
```

Record actual:

```text
branch
base SHA
upstream SHA
worktree state
untracked files
migration count
artifact checker baseline
```

Do not modify unrelated untracked files.

Never use:

```bash
git add .
git add -A
```

---

# 4. CANONICAL SOURCE INVENTORY

Locate and inspect the authoritative current documents for:

```text
Phase 2 definition
Phase 2 exit criteria
Step 2.18
Step 2.18A
Step 2.17
Step 2.17A
Step 2.17B
Step 2.17C
ADR-0014
ADR-0015
payment branch 2.12*
Commission-related steps including 2.14 / 2.14F if present
Booking / Order / Finance / Sales architecture
EventBus/outbox/inbox architecture
security/auth hardening
Backup/DR
load/performance
RLS / tenant isolation
migrations/schema governance
release/deployment gates
```

Reports are evidence references, not unquestionable truth.

Where code is the relevant authority, inspect code.

---

# 5. RECONSTRUCT STEP 2.18 FROM ROADMAP

Extract the exact canonical contract:

```text
title
purpose
scope
prerequisites
required evidence
required reviews
required test suites
required ADR state
required environment
required cross-domain verification
completion criteria
relationship to Step 2.18A
relationship to Step 2.17B
relationship to Phase 2 exit
```

Do not silently expand Step 2.18 merely because an audit “could” check something.

Every mandatory audit domain must have repository evidence that it belongs to Phase 2 exit.

---

# 6. STEP 2.18A — MANDATORY RECONSTRUCTION

The preceding sequencing pass identified Step 2.18A as an unresolved Phase 2 exit gate.

Independently reconstruct it.

Required output:

```text
exact Step 2.18A title:
current status:
purpose:
scope:
start prerequisites:
completion prerequisites:
depends on 2.17B to start:
depends on 2.17B to complete:
depends on 2.18:
depends on ADR-0014:
external blocker:
environment blocker:
executable now:
required for Phase 2 exit:
```

If Step 2.18A can execute independently now, state whether it should be the next pass after 2.18 design/readiness.

If its canonical definition is ambiguous, do not guess.

---

# 7. PHASE 2 EXIT GATE INVENTORY

Build the complete exit matrix.

Required structure:

| Gate | Canonical owner/step | Current state | Evidence source | Fresh verification required? | Blocked? | Required for exit? |
|---|---|---|---|---:|---:|---:|

At minimum investigate, where actually applicable:

```text
architecture/domain boundaries
schema/migrations/drift
auth/session/logout revocation
RBAC/permissions
ownership/tenant isolation
ADMIN SoD
CORS/security boundary
rate limiting
EventBus/outbox/inbox
durable retry
multi-instance delivery
event schemaVersion
idempotency
Booking
Order
Sales
Finance
Payment internal contract
Commission
money/Decimal/freeze/snapshots
Backup/DR
RPO/RTO authority
load/performance
RLS / ADR-0014
legacy isolation
CI/CD
frontend regression
artifact integrity
documentation/runbooks
PSP-deferred boundary
release/deployment boundary
```

Do not mark a gate mandatory unless canonical evidence supports it.

---

# 8. EVIDENCE CLASSIFICATION MODEL

Every audit item must be classified as one of:

```text
A — APPROVED PERSISTED EVIDENCE, REUSABLE
B — APPROVED EVIDENCE BUT FRESH EXIT-AUDIT RECHECK REQUIRED
C — IMPLEMENTED / VERIFIED BUT NOT YET APPROVED
D — BLOCKED BY EXTERNAL ENVIRONMENT/AUTHORITY
E — NOT STARTED / MISSING
F — DEFERRED OUTSIDE CURRENT PHASE-EXIT SCOPE
N/A — NOT APPLICABLE
```

Do not convert historical PASS evidence into current PASS without deciding whether freshness matters.

---

# 9. FINAL AUDIT VERDICT SEMANTICS

Design the final Step 2.18 verdict model now.

At minimum:

### PASS
All mandatory exit gates satisfied and fresh required verification green.

### BLOCKED
No system defect proven, but a mandatory external/environment/authority prerequisite prevents completion.

### FAIL
A valid mandatory gate fails in an attributable environment or repository invariant is violated.

### NOT APPLICABLE / DEFERRED
Only when canonical scope explicitly permits exclusion.

Hard rule:

> BLOCKED must never be rewritten as PASS or FAIL for convenience.

---

# 10. ADR-0014 / RLS AUDIT DESIGN

Inspect ADR-0014 verbatim.

Determine exactly what “RLS deferred, verify at 2.18” means.

Possible interpretations must be resolved from repository evidence:

```text
RLS must now be implemented
RLS implementation remains deferred but deferral conditions must be verified
tenant isolation must be verified at application layer
RLS readiness/design must be audited
RLS must be tested if already present
```

Create an RLS/tenant-isolation matrix:

| Concern | Current authority | Current enforcement | RLS role | 2.18 evidence required | Verdict state |
|---|---|---|---|---|---|

Audit-design concerns should include where relevant:

```text
tenant/user ownership
ADMIN behavior
service/worker DB access
background jobs
transaction-scoped context
connection pooling/session leakage
raw SQL
Prisma access
cross-tenant negative tests
fail-closed behavior
```

Do not make RLS a new business authority unless ADR-0014 says so.

---

# 11. SECURITY EXIT-AUDIT MATRIX

Using Step 2.17 approved evidence, design fresh/reusable checks for:

```text
HttpOnly auth cookie
no app localStorage token
legacy/missing tv fail-safe
logout tokenVersion revocation
/auth/session
login throttling
throttle bounded cleanup
PermissionsGuard fail-closed
CORS production fail-closed
ADMIN SoD disposition
auditability
legacy isolation
```

For each classify:

```text
reuse approved evidence
fresh source inspection
fresh unit
fresh e2e
not required
```

Do not reopen accepted deferrals unless Phase 2 exit criteria require it.

---

# 12. TENANT / OWNERSHIP ISOLATION AUDIT

Repository-wide inventory authoritative ownership boundaries.

Design adversarial exit checks such as:

```text
user A cannot read user B object
user A cannot mutate user B object
cross-tenant IDs do not bypass filters
ADMIN behavior is explicit
worker/internal service paths do not accidentally expose cross-tenant data
404 vs 403 semantics preserved where contractual
```

Map actual modules/routes rather than inventing generic tests.

Identify gaps in existing negative coverage.

---

# 13. EVENTBUS / OUTBOX / INBOX EXIT AUDIT

Design required verification for:

```text
at-least-once semantics
Inbox consumer idempotency
PENDING durable publication
FAILED durable retry
poison isolation
multi-instance safety
publishEvent(eventId) targeted delivery
no exactly-once claim
event schemaVersion
causation/correlation
crash window
nested consumer chains
```

Reconcile Step 2.17 and Step 2.17B evidence.

Performance throughput/backlog gates belong to 2.17B; correctness semantics may belong to 2.18.

Keep those separate.

---

# 14. IDEMPOTENCY / CONCURRENCY EXIT AUDIT

Inventory actual idempotent operations and concurrency-sensitive paths.

Design checks for:

```text
identical replay
divergent replay
concurrent identical
concurrent divergent
business idempotency
external idempotency slot
P2002 mapping
0 duplicate authoritative facts
0 raw 500 from controlled races
```

Include Booking/Order/Payment/Sales where canonical.

---

# 15. MONEY / FINANCE EXIT AUDIT

Identify authoritative money invariants from repository truth.

Audit-design matrix should cover where applicable:

```text
Decimal exactness
currency consistency
immutable/frozen monetary facts
commission snapshots
Finance ledger authority
Payment authority
no mutable-policy regeneration
refund/dispute behavior if Phase 2 scope
ProviderFee boundary
PSP fee boundary
```

Hard boundary:

```text
ProviderFee ≠ TravelHub Commission
```

Do not invent PSP fees or economic bearer decisions.

---

# 16. BOOKING / ORDER / SALES AUDIT

Design cross-domain consistency checks.

For actual contracts verify/audit:

```text
Booking state transitions
Order creation/convergence
Sales completion
OrderRequested event
1:1 convergence where contract requires
no duplicate Order
no duplicate Sale completion
transaction boundaries
freeze/snapshot
ownership
idempotency
error contracts
```

Use Step 2.17C approved evidence for Sales decomposition, but determine which cross-domain invariants need fresh exit-audit reproduction.

---

# 17. COMMISSION AUDIT

Reconstruct current Commission architecture and Phase 2 status.

Determine:

```text
Commission authority
accrual trigger
snapshot/freeze behavior
duplicate prevention
Sales/Order/Finance relationship
UI status if 2.14F exists
whether 2.14F is an exit gate or independent work
```

Do not confuse Commission with PSP ProviderFee.

If 2.14F is unfinished, explicitly decide whether it must precede final 2.18 or can proceed independently.

---

# 18. BACKUP / DR AUDIT

Step 2.17A is approved, but production capabilities remain intentionally distinct from approved targets.

Preserve:

```text
approved target ≠ implemented capability ≠ verified capability
```

Design final audit handling for:

```text
PostgreSQL RPO ≤1h target
PostgreSQL RTO ≤4h target
Media RPO ≤24h
Media RTO ≤8h
daily retention 30d
monthly retention 12mo
PITR/equivalent NOT VERIFIED if still true
media backup capability
immutability/off-account gap
runbook
restore drill
checksum
whole-DB/multi-schema
finance/EventBus/security/idempotency round-trip
```

Determine which gaps block Phase 2 exit under the canonical 2.17A/2.18 contract and which are accepted provider-dependent capability gaps.

Do not silently upgrade test evidence to production RTO proof.

---

# 19. PERFORMANCE / STEP 2.17B AUDIT BOUNDARY

Reconstruct exactly what 2.18 may reuse from 2.17B and what it cannot decide.

Preserve frozen targets and valid evidence.

At minimum distinguish:

```text
valid PASS evidence
valid FAIL evidence later remediated
remediation probes
invalid environment evidence
still-pending final qualification
```

Hard rule:

> Step 2.18 cannot close the 2.17B gate by inference.

The final audit must treat unresolved 2.17B as BLOCKED until a valid qualification environment produces the required final result and subsequent approval path is complete.

---

# 20. PSP / PAYMENT-PROVIDER BOUNDARY

Verify:

```text
2.12B BLOCKED
ADR-0015 PROPOSED/BLOCKED
2.12I DEFERRED
PSP subset deferred
```

Design an audit check ensuring Phase 2 does not accidentally claim:

```text
provider selected
card-data storage
PSP production integration
provider fee reconciliation
payout capability
split-at-payment capability
webhook performance
```

unless later repository truth actually provides those.

Raw PAN/CVV persistence remains forbidden under the established boundary.

---

# 21. DATABASE / MIGRATION EXIT AUDIT

Design mandatory DB checks:

```text
all canonical migrations apply
migration count matches repository truth
live test DB vs schema drift = 0
no unapplied migration
no shadow schema mismatch
multi-schema coverage
constraints/indexes present
migration history intact
```

Determine whether fresh isolated DB provisioning is required for final audit.

---

# 22. CI/CD EXIT AUDIT

Using Step 2.17 evidence, define fresh checks for:

```text
backend/frontend roots
PostgreSQL service
prisma migrate deploy
serial e2e
no root npm ci
no legacy SQLite DATABASE_URL
legacy isolation
build/test commands
```

Determine whether workflow source inspection is enough or whether actual GitHub Actions status is required by canonical exit criteria.

Do not invent a requirement for external CI execution if Roadmap does not require it.

---

# 23. FRONTEND EXIT AUDIT

Define actual Phase 2 frontend gates from repository evidence.

At minimum consider:

```text
tsc
vitest
production build
auth/session boundary
no localStorage auth token
route/API contract compatibility
Commission UI if relevant
```

Do not add visual/UI requirements unless they are canonical Phase 2 gates.

---

# 24. FULL REGRESSION CONTRACT

Design the final Step 2.18 regression command matrix.

Expected categories, subject to repository truth:

Backend:
```text
tsc
build
full unit
targeted security
targeted EventBus
targeted idempotency/concurrency
targeted Booking/Order/Sales/Finance
full serial e2e
```

Frontend:
```text
tsc
vitest
production build
```

DB:
```text
migrate
drift
```

Artifacts:
```text
canonical checker
checker regression
```

Performance:
```text
DO NOT rerun 2.17B inside final 2.18 unless canonical Roadmap explicitly requires orchestration of that approved external gate.
```

---

# 25. AUDIT EVIDENCE FRESHNESS POLICY

Define which evidence may be reused and which must be fresh.

Suggested principle to validate against repository needs:

```text
architecture decision/status: persisted evidence may be reused
code invariants: source must be re-inspected at final HEAD
unit/e2e/build: fresh final-HEAD execution
DB drift: fresh
artifact integrity: fresh
performance qualification: approved 2.17B result, not duplicated by 2.18
DR authority targets: reuse approved decision
DR script correctness: source + targeted fresh tests as needed
```

Record the final evidence freshness policy in the design doc.

---

# 26. GAP CLASSIFICATION

Every discovered gap must be classified:

```text
G1 — documentation/state mismatch
G2 — missing audit evidence
G3 — missing test coverage
G4 — implementation defect
G5 — unresolved authority
G6 — external environment blocker
G7 — deferred external provider capability
G8 — Phase 2 exit dependency
```

For every gap record:

```text
severity
owner step
blocks 2.18 start?
blocks 2.18 completion?
blocks Phase 2 exit?
remediation path
```

Do not fix production defects in this design/readiness pass.

---

# 27. STEP 2.18 DESIGN ARTIFACT

Create/update an architecture/audit design document at an evidence-consistent path, preferably:

```text
docs/architecture/phase-2-exit-audit-2.18.md
```

If a canonical 2.18 design file already exists, update that instead of creating a duplicate.

It must contain:

```text
purpose
scope
non-scope
dependency graph
gate inventory
evidence classification
freshness policy
RLS/ADR-0014 audit
security audit
tenant isolation
EventBus
idempotency/concurrency
money/finance
Booking/Order/Sales
Commission
Backup/DR
performance boundary
PSP boundary
DB/migrations
CI
frontend
regression matrix
gap model
verdict model
execution order
hard stops
Phase 2 exit rule
```

---

# 28. STEP 2.18A DISPOSITION

This pass must end with an explicit disposition:

### 2.18A EXECUTABLE NOW
Then identify whether NEXT after design/readiness should be 2.18A or another required preparation step.

### 2.18A BLOCKED
State exact blocker.

### 2.18A PART OF 2.18 FINALIZATION
State why it must wait.

### 2.18A CANONICALLY AMBIGUOUS
Return a reconciliation requirement rather than guessing.

---

# 29. 2.14F / OTHER INDEPENDENT WORK

The prior sequencing report mentioned 2.14F Commission UI as potentially independent.

Verify from Roadmap:

```text
actual status
scope
prerequisites
whether mandatory for Phase 2 exit
whether executable now
whether it should precede 2.18 final audit
```

Also inspect all other unfinished Phase 2 steps.

Do not automatically choose 2.14F merely because it is executable.

The next step should follow canonical exit dependency order.

---

# 30. DESIGN/READINESS VERDICT

Use one:

## A — DESIGN READY / EXECUTION PLAN COMPLETE

All Step 2.18 audit gates and dependencies are unambiguous; final audit design is executable when blockers resolve. A bounded next independent step is identified.

## B — DESIGN READY WITH BLOCKED EXIT GATES

Audit design is complete, but one or more mandatory gates are externally blocked. Independent preparation/2.18A/other work may continue.

## C — DESIGN INCOMPLETE

Canonical gaps or missing authority prevent a safe audit design.

## D — IMPLEMENTATION DEFECT DISCOVERED

A real repository defect is found that must be remediated before audit preparation can continue.

Do not mark Step 2.18 APPROVED under any verdict in this pass.

---

# 31. ROADMAP UPDATE

Update only current-state/readiness text supported by evidence.

Expected shape if appropriate:

```text
Step 2.18:
🚧 DESIGN/READINESS COMPLETED — FINAL EXIT AUDIT NOT STARTED / BLOCKED ON REQUIRED GATES

Step 2.17B:
⏸ BLOCKED — unchanged

Phase 2 exit:
BLOCKED

Step 2.18A:
<actual evidence-backed state>
```

Do not falsify progress.

---

# 32. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_2_STEP_2.18_PHASE_2_EXIT_AUDIT_DESIGN_READINESS_REPORT.md
```

Required sections:

1. Executive Summary  
2. Verdict  
3. Repository Baseline  
4. Canonical Sources  
5. Step 2.18 Canonical Contract  
6. Step 2.18A Canonical Contract  
7. Current Phase 2 State  
8. Phase 2 Exit Dependency Graph  
9. Complete Exit Gate Inventory  
10. Evidence Classification  
11. Evidence Freshness Policy  
12. ADR-0014 / RLS  
13. Tenant Isolation  
14. Security/Auth/RBAC/Ownership  
15. ADMIN SoD  
16. EventBus/Outbox/Inbox  
17. Event Schema/Causation  
18. Idempotency  
19. Concurrency  
20. Booking  
21. Order  
22. Sales  
23. Finance  
24. Payment Internal Contract  
25. Commission  
26. Money/Decimal/Freeze  
27. Backup/DR  
28. RPO/RTO/Retention  
29. Step 2.17B Performance Boundary  
30. PSP/ADR-0015 Boundary  
31. Database/Migrations/Drift  
32. CI/CD  
33. Legacy Isolation  
34. Frontend  
35. Artifact Integrity  
36. Final Regression Contract  
37. Audit Execution Order  
38. PASS/BLOCKED/FAIL Semantics  
39. Gap Inventory  
40. Step 2.18A Disposition  
41. 2.14F / Other Unfinished Work  
42. Phase 2 Exit Preconditions  
43. Canonical NEXT  
44. Hard Stop for Next Pass  
45. Documentation Changes  
46. Negative Checks  
47. Persistence  
48. Release Status  
49. Final State Matrix  
50. REPOSITORY EVIDENCE  
51. HARD STOP  

---

# 33. ARTIFACT INTEGRITY

Run canonical artifact checker and its regression.

Required:

```text
WARN = 0
FAIL = 0
checker regression = PASS
```

Record actual PASS count.

---

# 34. NEGATIVE CHECKS

Report explicitly:

```text
production backend changes = 0
frontend production changes = 0
schema changes = 0
migrations = 0
RLS implementation = 0
SQL policy implementation = 0
RBAC changes = 0
ownership changes = 0
status changes = 0
money changes = 0
event contract changes = 0
idempotency changes = 0
performance harness changes = 0
performance tuning = 0
frozen target changes = 0
2.17B qualification runs = 0
PSP implementation = 0
ProviderFee implementation = 0
payout/split implementation = 0
2.18 final audit execution = 0
2.18 approval = 0
Phase 2 approval/exit = 0
release/deploy = 0
historical verdict rewrites = 0
invented authority = 0
```

---

# 35. GIT / PERSISTENCE

Before staging:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git diff --stat
git diff
git diff --check
```

Stage exact documentation files only.

Never:

```bash
git add .
git add -A
```

Suggested commit:

```bash
git commit -m "docs: design Step 2.18 Phase 2 exit audit"
```

Use a separate narrow provenance/footer commit if required.

Push:

```bash
git push origin HEAD
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

Claim PUSHED only if final HEAD == upstream.

---

# 36. REPOSITORY EVIDENCE FOOTER

Populate actual values only:

```text
repository:
branch:
design_base_sha:
design_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:

step_2_17:
step_2_17a:
step_2_17b:
step_2_17c:
step_2_18:
step_2_18a:
step_2_14f:

phase2_exit_allowed:
phase2_exit_blockers:

step_2_18_title:
step_2_18_scope:
step_2_18_start_ready:
step_2_18_completion_ready:
step_2_18_final_audit_started:

step_2_18a_title:
step_2_18a_state:
step_2_18a_executable_now:
step_2_18a_required_for_exit:

adr_0014_state:
rls_state:
rls_implementation_required_now:
tenant_isolation_state:

adr_0015_state:
payment_branch_state:
psp_dependency_for_2_18:

exit_gates_total:
exit_gates_reusable:
exit_gates_fresh_recheck:
exit_gates_blocked:
exit_gates_missing:

step_2_17b_required_for_exit:
step_2_17b_state:
performance_final_qualification_available:

backup_dr_state:
security_state:
eventbus_state:
sales_state:
booking_order_state:
finance_state:
commission_state:
db_migration_state:
ci_state:
frontend_state:

production_code_changes:
frontend_changes:
schema_changes:
migration_changes:
rls_changes:
performance_changes:
psp_changes:

artifact_integrity:
checker_regression:
release_status:
canonical_next:
deferred_return:
```

Never fabricate values.

---

# 37. REQUIRED SUCCESS OUTPUT — VERDICT A

```text
TRAVELHUB PHASE 2 STEP 2.18 PHASE 2 EXIT AUDIT DESIGN/READINESS COMPLETED

Decision:
- verdict: A — DESIGN READY / EXECUTION PLAN COMPLETE
- Step 2.18: DESIGN/READINESS COMPLETED — FINAL AUDIT NOT STARTED
- Step 2.18 APPROVED: NO
- Phase 2 exit allowed: NO
- Step 2.17B: BLOCKED / unchanged

Exit audit:
- gates inventoried: <actual>
- reusable evidence: <actual>
- fresh rechecks required: <actual>
- blocked gates: <actual>
- missing evidence: <actual>

ADR-0014/RLS:
- ADR state: <actual>
- RLS disposition: <actual>
- tenant-isolation audit: <actual>

Step 2.18A:
- title: <actual>
- state: <actual>
- executable now: <YES/NO>
- required for exit: <YES/NO>

Performance:
- 2.17B required for exit: YES
- final qualification available: NO
- no system PASS/FAIL inferred from invalid environment

PSP:
- dependency for audit preparation: NONE
- provider branch: unchanged/deferred

Artifact integrity:
- PASS=<actual> WARN=0 FAIL=0
- checker regression: PASS

Persistence:
- branch: <actual>
- design commit: <sha>
- provenance/footer: <sha>
- final HEAD/upstream: <sha>
- push_status: PUSHED

RELEASE: NOT APPLICABLE

NEXT:
<exact dedicated next pass>

DEFERRED RETURN:
Step 2.17B — final qualification on an admitted dedicated environment before Step 2.18 completion / Phase 2 exit.
```

---

# 38. REQUIRED SUCCESS OUTPUT — VERDICT B

```text
TRAVELHUB PHASE 2 STEP 2.18 PHASE 2 EXIT AUDIT DESIGN/READINESS COMPLETED

Decision:
- verdict: B — DESIGN READY WITH BLOCKED EXIT GATES
- Step 2.18: DESIGN/READINESS COMPLETED
- final audit: NOT STARTED
- Step 2.18 APPROVED: NO
- Phase 2 exit: BLOCKED

Ready:
- <actual>

Blocked:
- <gate> → <blocker>

Step 2.18A:
- <actual disposition>

NEXT:
<next independent executable pass>

DEFERRED RETURN:
<blocked mandatory gate(s)>
```

---

# 39. FAILURE OUTPUT — C/D

For C:

```text
Decision:
- verdict: C — DESIGN INCOMPLETE
- blocker: <canonical ambiguity / missing authority>
- Step 2.18 remains NOT STARTED / NOT APPROVED

NEXT:
<required reconciliation>
```

For D:

```text
Decision:
- verdict: D — IMPLEMENTATION DEFECT DISCOVERED
- defect: <actual>
- Step 2.18 final audit cannot safely proceed
- production fix NOT performed in this pass

NEXT:
<dedicated remediation prompt>
```

---

# 40. NEXT-SELECTION RULE

The final NEXT must be selected from actual repository dependencies.

Possible examples only:

```text
STEP 2.18A — <actual title> — DESIGN/IMPLEMENTATION
STEP 2.14F — COMMISSION UI — <actual pass>
STEP 2.18 — EXIT AUDIT PREPARATION / GAP REMEDIATION
WAIT FOR STEP 2.17B QUALIFICATION ENVIRONMENT
```

Do not automatically choose 2.18A or 2.14F.

Choose the highest-priority executable prerequisite for eventual Phase 2 exit.

---

# 41. HARD STOP

After:

```text
repository/provenance verification
canonical 2.18 reconstruction
canonical 2.18A reconstruction
complete Phase 2 exit-gate inventory
evidence classification
freshness policy
ADR-0014/RLS disposition
tenant-isolation audit design
security/EventBus/idempotency/concurrency design
Booking/Order/Sales/Finance/Commission design
Backup/DR handling
2.17B boundary
PSP boundary
DB/CI/frontend regression design
gap inventory
verdict model
execution order
canonical NEXT
design/report/Roadmap docs
artifact checker
exact staging
commit
provenance/footer
push
HEAD/upstream verification
```

**STOP.**

Do not execute the final Step 2.18 audit.
Do not approve Step 2.18.
Do not approve/exit Phase 2.
Do not implement Step 2.18A.
Do not implement 2.14F.
Do not resume Step 2.17B.
Do not implement RLS.
Do not create migrations.
Do not change production code.
Do not implement PSP.
Do not release/deploy.

The next executable work must use a separate dedicated prompt.
