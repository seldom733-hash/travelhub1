# TRAVELHUB — PHASE 2 — STEP 2.18
## BOUNDED FINAL EXIT AUDIT

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.18 — Phase 2 Exit Audit  
**Pass:** BOUNDED FINAL EXIT AUDIT  
**Mode:** REPOSITORY-FIRST / ADVERSARIAL / EXECUTE ALL NON-BLOCKED EXIT GATES  
**Release:** FORBIDDEN  
**Performance qualification:** MUST REMAIN BLOCKED — DO NOT SUBSTITUTE HISTORICAL EVIDENCE FOR FINAL 2.17B QUALIFICATION

---

# 0. ENTRY STATE

The immediately preceding repository-first reconciliation established:

```text
PHASE 2 POST-2.18A EXIT-GATE RECONCILIATION COMPLETED

verdict:
B — STEP 2.18 BOUNDED FINAL AUDIT MAY PROCEED

Step 2.18A:
APPROVED

Step 2.17B:
BLOCKED — EXTERNAL QUALIFICATION ENVIRONMENT

Step 2.18:
BOUNDED AUDIT MAY PROCEED — FINAL APPROVAL BLOCKED BY 2.17B

Phase 2 exit:
BLOCKED

external prerequisite blockers:
1 — Step 2.17B

pending executable Step 2.18 audit gates:
7

1. ADR-0014 / tenant-isolation verification
2. security
3. backend/full regression
4. database migration/drift
5. CI
6. frontend
7. artifact integrity
```

Reconciliation persistence:

```text
branch: master
reconciliation commits: 1ac36c6 → 28832cf
claimed final HEAD/upstream: 28832cf
artifact integrity: PASS=163 WARN=0 FAIL=0
```

These are entry claims to verify against the repository before execution.

---

# 1. MISSION

Execute the **bounded Step 2.18 Final Exit Audit**.

The purpose is to execute every Phase 2 exit gate that is currently independent of the unavailable performance qualification environment, while preserving the unresolved Step 2.17B gate exactly as blocked.

This pass must answer:

```text
Do all seven currently executable Step 2.18 exit gates PASS on the persisted repository state?
```

If yes, the strongest allowed result is:

```text
STEP 2.18 BOUNDED FINAL AUDIT COMPLETED —
ALL EXECUTABLE GATES PASS —
FINAL APPROVAL BLOCKED ONLY BY STEP 2.17B
```

This is **not** equivalent to:

```text
Step 2.18 APPROVED
Phase 2 COMPLETED
Phase 2 exit PASS
release approved
```

Those claims remain forbidden while 2.17B is unresolved.

---

# 2. HARD SEMANTIC RULE

Maintain this distinction throughout:

```text
BOUNDED AUDIT PASS
≠
STEP 2.18 FINAL APPROVAL
≠
PHASE 2 EXIT
≠
RELEASE APPROVAL
```

The performance gate is not to be waived, inferred, replaced, or marked PASS.

The valid state after a successful bounded audit is:

```text
all currently executable gates = PASS
performance gate = BLOCKED
Step 2.18 final approval = WITHHELD
Phase 2 exit = BLOCKED
```

---

# 3. REPOSITORY IS AUTHORITY

Do not trust previous reports as proof.

Reports may identify expected evidence, but:

```text
code
tests
schema
migrations
CI definitions
ADRs
Roadmap
current repository state
fresh command output
```

are authoritative.

For every executable gate, independently reproduce the evidence required by the canonical Step 2.18 contract.

If the current repository contradicts a prior APPROVED report, current repository evidence wins.

---

# 4. HARD STOP ON SCOPE EXPANSION

This is an **audit**, not an implementation/remediation pass.

Do not fix production defects discovered during the audit.

Do not tune performance.

Do not change authority decisions.

Do not add RLS.

Do not select a PSP.

Do not refactor application code.

Do not change schema/migrations merely to make a gate green.

If a genuine defect causes a gate to fail:

```text
record the failure
classify it
stop any dependent approval claim
return a valid bounded-audit FAIL/INCOMPLETE verdict
```

A separate remediation prompt must handle fixes.

Documentation-only status/report/provenance updates are allowed.

---

# 5. VERIFY PROVENANCE BEFORE ANY AUDIT EXECUTION

Run:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -100
git diff
git diff --check
```

Verify that the post-2.18A reconciliation is actually persisted.

Expected historical terminal SHA:

```text
28832cf
```

If HEAD moved forward legitimately, identify why.

Record:

```text
branch
audit_start_sha
upstream_sha
tracked_worktree_state
untracked_files
```

Do not modify unrelated untracked user files.

---

# 6. RE-READ THE CANONICAL STEP 2.18 CONTRACT

Before running tests, read:

```text
canonical Roadmap Step 2.18
Step 2.18 design/readiness artifact
post-2.18A exit-gate reconciliation report
ADR-0014
Step 2.17 strict-review state
Step 2.17A strict-review state
Step 2.17B blocker/reconciliation state
Step 2.17C strict-review state
Step 2.18A strict-review state
```

Reconfirm that exactly seven non-blocked gates are executable.

If the repository now defines a different set, use the repository-defined set and explain the discrepancy.

Do not silently inherit the number seven.

---

# 7. BUILD THE AUDIT MATRIX BEFORE EXECUTION

Create the working matrix:

| Gate | Required | Fresh evidence | Command/evidence source | Result |
|---|---:|---:|---|---|
| ADR-0014 / tenant isolation | YES | YES | TBD from repo | NOT RUN |
| Security | YES | YES | TBD from repo | NOT RUN |
| Backend/full regression | YES | YES | TBD from repo | NOT RUN |
| DB migrations/drift | YES | YES | TBD from repo | NOT RUN |
| CI | YES | YES | TBD from repo | NOT RUN |
| Frontend | YES | YES | TBD from repo | NOT RUN |
| Artifact integrity | YES | YES | canonical checker | NOT RUN |
| Step 2.17B performance | YES | BLOCKED | external environment | BLOCKED |

Use the exact canonical names if they differ.

---

# 8. GATE 1 — ADR-0014 / TENANT-ISOLATION VERIFICATION

This is a fresh Step 2.18 verification.

Expected authority state:

```text
ADR-0014: ACCEPTED
RLS disposition: DEFERRED
tenant isolation: application-level
```

The purpose is **not** to implement PostgreSQL RLS.

The purpose is to verify that the accepted application-level tenant-isolation model remains valid and enforced.

## 8.1 Re-read ADR-0014

Verify:

```text
current ADR state
accepted isolation model
why DB RLS was deferred
what must be verified at Step 2.18
what conditions would invalidate the deferral
```

Do not reinterpret the ADR.

## 8.2 Inventory tenant boundaries

Repository-first identify all tenant/org/company scoped entities and relevant access paths.

At minimum inspect:

```text
controllers
services
guards
authorization helpers
Prisma queries
repository/data access
nested relation access
ID-based fetch/update/delete paths
list/search/export paths
financial paths
Sales paths
Booking/Order paths
admin paths
background/event consumers where tenant context matters
```

Do not rely on route naming alone.

## 8.3 Adversarial cross-tenant challenge

The audit must try to prove application-level isolation is insufficient.

Test or reproduce, using existing canonical test mechanisms, attempts such as:

```text
Tenant A user reads Tenant B object by direct ID
Tenant A lists Tenant B objects
Tenant A updates Tenant B object
Tenant A deletes/cancels Tenant B object
Tenant A accesses nested resource belonging to Tenant B
Tenant A uses guessed UUID/reference
Tenant A accesses finance/ledger/payment belonging to Tenant B
Tenant A accesses Sales/CRM object belonging to Tenant B
Tenant A accesses Booking/Order belonging to Tenant B
role escalation across tenant boundary
ADMIN semantics where applicable
```

Use actual repository entities and role model.

Do not invent a tenant model that the repository does not have.

## 8.4 Query-scope review

Search for dangerous patterns where tenant ownership might be omitted:

```text
findUnique({ where: { id } })
findFirst({ where: { id } })
update({ where: { id } })
delete({ where: { id } })
updateMany
deleteMany
raw SQL
$queryRaw
$executeRaw
```

A raw `id` lookup is not automatically a vulnerability; trace authorization/ownership enforcement through the complete call path.

Classify each suspicious path:

```text
SAFE — ownership checked before/after lookup
SAFE — globally scoped entity by contract
SAFE — admin-only authority
UNSAFE — cross-tenant access possible
NEEDS EVIDENCE
```

## 8.5 Tenant-isolation gate

PASS only if repository evidence establishes:

```text
no demonstrated cross-tenant read
no demonstrated cross-tenant mutation
no ownership bypass
no hidden route bypass
no financial cross-tenant access
no Sales/Booking/Order cross-tenant access
ADR-0014 accepted deferral remains valid
```

If a real isolation defect is found:

```text
GATE FAIL
```

Do not implement RLS as an audit fix.

---

# 9. GATE 2 — SECURITY EXIT RECHECK

This is a fresh bounded exit-audit recheck, not a re-performance of the entire historical Step 2.17 review unless the canonical contract explicitly requires that.

Reconfirm current repository state for the security invariants approved in Step 2.17.

At minimum inspect/reproduce:

```text
token storage
HttpOnly cookie boundary
no application token localStorage
logout revocation
/auth/session boundary
legacy/missing tv rejection
login throttling
PermissionsGuard fail-closed
CORS production fail-closed
authentication/authorization defaults
security-sensitive environment handling
CI/runtime assumptions relevant to security
```

Also verify no later changes from:

```text
2.17A
2.17B
2.17C
2.18A
```

regressed these boundaries.

## 9.1 Search-based negative checks

Use repository-wide searches for at least:

```text
localStorage
sessionStorage
Authorization
accessToken
refreshToken
CORS_ORIGINS
tokenVersion
tv
PermissionsGuard
@Public
skipAuth
bypass
```

Interpret findings in context.

Tests and fixtures are not automatically production violations.

## 9.2 Security tests

Run the canonical targeted tests that cover these security contracts.

If the repository provides dedicated auth/security e2e or unit suites, run them.

Do not weaken or skip failing tests.

## 9.3 Security gate

PASS only if:

```text
approved Step 2.17 boundaries remain intact
no new bypass is found
targeted security regression is green
```

---

# 10. GATE 3 — BACKEND / FULL REGRESSION

This must be fresh.

Historical reference only:

```text
backend unit: 816/816
serial e2e: 1248/1248
```

Do not use these historical numbers as current evidence.

Discover canonical scripts from the current repository.

Run the full required backend validation, expected to include:

```bash
tsc / typecheck
production build
full unit test suite
full serial e2e suite
```

The serial e2e requirement is mandatory if it remains canonical.

No:

```text
--forceExit masking
retry-until-green
test skipping
assertion weakening
subset substitution for full regression
```

Record:

```text
unit suites/tests
e2e suites/tests
duration where useful
failures
skips
```

## 10.1 Failure semantics

A genuine regression failure is a Step 2.18 bounded-audit failure.

Do not repair it in this pass.

---

# 11. GATE 4 — DATABASE MIGRATION / DRIFT

Freshly verify the canonical DB state.

Use an isolated/safe database according to repository procedures.

Required evidence should include:

```text
all canonical migrations apply
expected migration count
schema matches migrations
live/test DB drift check
"No difference detected" or repository-equivalent clean result
```

Historical expected count:

```text
58/58
```

Do not assume it remains 58 if repository state changed.

Verify actual count.

Do not create migrations in this audit.

## 11.1 Drift gate

PASS only if:

```text
migration application PASS
no unapplied migration
no schema drift
no audit-created schema mutation
```

---

# 12. GATE 5 — CI CONTRACT AUDIT

This gate must verify that the repository's CI/CD contract remains suitable for the Phase 2 exit state.

Do not merely check that workflow YAML exists.

Inspect actual workflows and commands.

Historical Step 2.17 hardening included expectations such as:

```text
correct backend/frontend roots
PostgreSQL rather than SQLite
migrate deploy
serial e2e
no erroneous root npm ci
```

Verify current CI still enforces the canonical contract.

At minimum inspect:

```text
workflow triggers
working directories
Node setup
dependency installation
PostgreSQL service/configuration
environment variables
migration execution
backend typecheck/build/tests
serial e2e invocation
frontend typecheck/tests/build
artifact/security checks if canonical
failure propagation
```

## 12.1 CI anti-pattern search

Look for:

```text
continue-on-error: true
|| true
set +e
forced success
ignored test failures
skipped migration
wrong working-directory
SQLite substitution
non-serial e2e where serial is required
root npm ci where roots are separate
```

Context matters.

## 12.2 CI gate

PASS only if the persisted CI contract would fail closed on the required Phase 2 regression.

If actual remote CI status is available through repository tooling and canonical process requires it, inspect it.

Do not claim remote CI PASS from YAML inspection alone.

Distinguish:

```text
CI DEFINITION PASS
REMOTE CI RUN PASS
```

according to available evidence.

---

# 13. GATE 6 — FRONTEND REGRESSION

Freshly execute the canonical frontend checks.

Historical reference only:

```text
tsc 0
vitest 135/135
production build PASS
```

Discover current scripts.

Expected:

```text
typecheck
full vitest
production build
```

Do not skip build because tests pass.

Record actual current counts.

## 13.1 Security-sensitive frontend check

As part of frontend audit, confirm the app code does not reintroduce browser token persistence inconsistent with Step 2.17.

Do not treat test-only fixtures as production violations without context.

---

# 14. GATE 7 — ARTIFACT INTEGRITY

Run the canonical artifact integrity checker and its regression suite.

Historical entry reference:

```text
PASS=163
WARN=0
FAIL=0
```

The fresh result is authoritative.

Required:

```text
WARN=0
FAIL=0
checker regression PASS
```

PASS count may legitimately increase after adding the bounded-audit report.

If provenance/footer mechanics require a second checker pass after commit/footer synchronization, follow the canonical repository procedure.

---

# 15. BLOCKED GATE — STEP 2.17B PERFORMANCE

Do **not** execute the frozen performance qualification in this pass.

Do not run a substitute qualification on Windows/WSL2.

Do not reinterpret Round 3.

Preserve:

```text
Step 2.17B:
BLOCKED — FINAL QUALIFICATION ENVIRONMENT REQUIRED — NOT APPROVED

blocker:
external qualification environment

Round 3:
VERDICT C — environment invalid
no TravelHub system PASS claimed
no TravelHub system FAIL claimed from Round 3
```

Historical valid remediation evidence may be cited only as context.

It may not replace the final frozen-matrix qualification.

The Step 2.18 performance row must remain:

```text
BLOCKED
```

---

# 16. DO NOT REOPEN APPROVED STEPS WITHOUT EVIDENCE

The audit may reuse approved evidence from:

```text
2.17
2.17A
2.17C
2.18A
```

where Step 2.18 explicitly allows reusable evidence.

Do not perform entire strict reviews again.

However, if a fresh exit check demonstrates that current HEAD violates an invariant underlying an approved step:

```text
record the contradiction
mark the relevant exit gate FAIL
do not silently preserve APPROVED semantics for the current state
```

---

# 17. STEP 2.18A FINANCIAL EVIDENCE

Step 2.18A is already APPROVED after strict review.

Historical approved evidence included:

```text
Payment authority
Ledger authority
Commission authority
Decimal exactness
currency integrity
frozen monetary facts
causation/traceability
transaction atomicity
EventBus duplicate safety
external idempotency
business idempotency
concurrency
DB constraints
reconciliation checker
auth/ownership
full serial regression
```

Determine from the canonical Step 2.18 contract whether:

```text
2.18A APPROVAL is reusable as the financial exit evidence
```

or whether a bounded fresh checker invocation is required.

If reusable, record:

```text
REUSED APPROVED EVIDENCE
```

Do not unnecessarily recreate the full 2.18A strict review.

If the canonical financial reconciliation checker is part of the fresh Step 2.18 checks, run it read-only.

---

# 18. BACKUP/DR EVIDENCE

Step 2.17A is APPROVED.

Preserve the approved semantics:

```text
approved target
≠ implemented production capability
≠ verified production capability
```

Do not turn known accepted gaps into fresh failures unless Step 2.18 explicitly defines them as exit failures.

If Step 2.18 requires only evidence reconciliation, verify that:

```text
runbook exists
backup/restore contract exists
isolated restore evidence exists
authority targets are approved
documented production capability gaps remain accurately disclosed
```

No provider infrastructure work in this pass.

---

# 19. SALES STRUCTURAL DEBT EVIDENCE

Step 2.17C is APPROVED.

Verify only the evidence needed by Step 2.18.

Do not refactor Sales again.

Expected approved structural state includes:

```text
stable SalesService facade
66/66 methods reconciled
sole-writer invariant
22 transaction roots preserved
completeSale atomicity
reverse in-tx contract
event/outbox topology
money/status/RBAC/idempotency/projection/history preservation
```

Fresh full regression in Gate 3 provides current behavioral regression evidence.

---

# 20. CROSS-GATE CONSISTENCY

After executing all seven gates, perform a consistency pass.

Check whether any result contradicts another.

Examples:

```text
security PASS but tenant-isolation FAIL
full regression PASS but targeted security test FAIL
migration PASS but drift FAIL
frontend tests PASS but production build FAIL
artifact checker PASS but report claims unsupported approval
CI definition PASS but required serial e2e absent
```

Any contradiction must be resolved by evidence, not by averaging results.

---

# 21. NO CHERRY-PICKED RERUNS

If a test/gate fails:

1. preserve the failure output;
2. determine whether it is:
   - deterministic product defect,
   - harness/test defect,
   - environment defect,
   - orchestration error;
3. do not simply rerun until green;
4. if a rerun is justified, document the original failure and why the rerun is valid.

No hidden failures.

No retry masking.

---

# 22. FAILURE CLASSIFICATION

Use:

```text
A — PRODUCT / SYSTEM DEFECT
B — TEST / HARNESS DEFECT
C — ENVIRONMENT / TOOLING DEFECT
D — DOCUMENTATION / ARTIFACT DEFECT
E — INVALID / INCOMPLETE EVIDENCE
```

Severity:

```text
CRITICAL
HIGH
MEDIUM
LOW
OBSERVATION
```

This pass is not allowed to remediate A-class product defects.

For a small D-class report/footer defect caused by this audit itself, a narrow documentation correction is allowed.

Do not use D-class correction as a loophole for product changes.

---

# 23. BOUNDED AUDIT VERDICT RULES

Choose exactly one terminal verdict.

## VERDICT A — BOUNDED AUDIT PASS

Allowed only if:

```text
all seven executable gates PASS
no unresolved CRITICAL/HIGH finding
no evidence integrity problem
2.17B remains explicitly BLOCKED
```

Result:

```text
STEP 2.18 BOUNDED FINAL AUDIT COMPLETED —
ALL EXECUTABLE GATES PASS —
FINAL APPROVAL BLOCKED ONLY BY STEP 2.17B
```

Still:

```text
Step 2.18 APPROVED: NO
Phase 2 exit: BLOCKED
Release: NOT PERFORMED
```

## VERDICT B — VALID EXECUTABLE-GATE FAIL

Use if at least one executable gate produces a valid system/repository failure.

Result:

```text
Step 2.18 bounded audit: FAIL
Step 2.18 APPROVED: NO
Phase 2 exit: BLOCKED
```

Name the failed gate.

## VERDICT C — AUDIT INVALID / INCOMPLETE

Use if a non-2.17B environment/tooling/harness problem prevents valid execution of one or more of the seven executable gates.

Do not claim system PASS/FAIL for blocked evidence.

## VERDICT D — ADDITIONAL EXIT BLOCKER DISCOVERED

Use if repository authority reveals a mandatory external prerequisite not captured by the reconciliation.

---

# 24. IMPORTANT STATUS RULE

Even under VERDICT A, do not write:

```text
Step 2.18: APPROVED
```

unless the canonical Roadmap explicitly defines bounded audit completion itself as approval despite the unresolved 2.17B gate.

The prior reconciliation explicitly established:

```text
2.17B required to complete 2.18: YES
```

Therefore the expected status under a successful pass is:

```text
Step 2.18:
BOUNDED FINAL AUDIT COMPLETED —
ALL EXECUTABLE GATES PASS —
FINAL APPROVAL BLOCKED BY STEP 2.17B
```

and:

```text
APPROVED: NO
```

---

# 25. PHASE 2 EXIT RULE

Under no outcome in this pass may Phase 2 be marked complete while 2.17B remains blocked.

Required:

```text
Phase 2 exit: BLOCKED
```

Do not reinterpret an external blocker as a waiver.

Do not create a provisional Phase 2 approval.

---

# 26. REQUIRED AUDIT REPORT

Create:

```text
docs/prompts/PHASE_2_STEP_2.18_BOUNDED_FINAL_EXIT_AUDIT_REPORT.md
```

Required sections:

1. Executive Summary  
2. Verdict  
3. Scope / Non-Scope  
4. Entry State  
5. Repository Provenance  
6. Canonical Step 2.18 Contract Recheck  
7. Audit Matrix  
8. Gate 1 — ADR-0014 / Tenant Isolation  
9. Tenant Boundary Inventory  
10. Cross-Tenant Adversarial Tests  
11. Query-Scope Review  
12. ADR-0014 Disposition  
13. Gate 2 — Security Exit Recheck  
14. Security Search Evidence  
15. Security Test Evidence  
16. Gate 3 — Backend Full Regression  
17. Unit Results  
18. Serial E2E Results  
19. Backend Build/Typecheck  
20. Gate 4 — DB Migration / Drift  
21. Migration Evidence  
22. Drift Evidence  
23. Gate 5 — CI Contract Audit  
24. CI Fail-Closed Review  
25. Gate 6 — Frontend Regression  
26. Frontend Security Boundary  
27. Gate 7 — Artifact Integrity  
28. Step 2.17B Blocked Gate  
29. Step 2.18A Financial Evidence Disposition  
30. Step 2.17A Backup/DR Evidence Disposition  
31. Step 2.17C Sales Evidence Disposition  
32. Cross-Gate Consistency  
33. Findings  
34. Failure/Rerun History  
35. Negative Checks  
36. Exact Step 2.18 State  
37. Exact Phase 2 State  
38. Remaining Exit Work  
39. Deferred Return to Step 2.17B  
40. Roadmap Update  
41. Changed Files  
42. Artifact Integrity Final State  
43. Persistence  
44. Release  
45. REPOSITORY EVIDENCE  
46. HARD STOP  

---

# 27. REQUIRED AUDIT MATRIX IN REPORT

Include:

| Gate | State before | Fresh/reused | Result | Blocking final 2.18? |
|---|---|---|---|---|
| ADR-0014 / tenant isolation | Pending executable | Fresh | PASS/FAIL | YES if fail |
| Security | Pending executable | Fresh | PASS/FAIL | YES if fail |
| Backend/full regression | Pending executable | Fresh | PASS/FAIL | YES if fail |
| DB migration/drift | Pending executable | Fresh | PASS/FAIL | YES if fail |
| CI | Pending executable | Fresh | PASS/FAIL | YES if fail |
| Frontend | Pending executable | Fresh | PASS/FAIL | YES if fail |
| Artifact integrity | Pending executable | Fresh | PASS/FAIL | YES if fail |
| Performance / 2.17B | External blocked | None | BLOCKED | YES |

If other reusable gates are part of the canonical Step 2.18 matrix, add them separately.

---

# 28. ROADMAP UPDATE

Update only the canonical Step 2.18 status proven by the audit.

If VERDICT A, expected wording:

```text
STEP 2.18 — BOUNDED FINAL AUDIT COMPLETED —
ALL EXECUTABLE EXIT GATES PASS —
FINAL APPROVAL BLOCKED BY STEP 2.17B
```

Also preserve:

```text
Step 2.17B — BLOCKED — FINAL QUALIFICATION ENVIRONMENT REQUIRED — NOT APPROVED
Phase 2 exit — BLOCKED
```

Do not change 2.17B's frozen targets or qualification history.

---

# 29. NEGATIVE CHECKS

Explicitly verify/report:

```text
production code changes: 0
frontend production changes: 0
schema changes: 0
migration changes: 0
CI changes: 0 unless this audit is explicitly supposed to fix CI — normally 0
performance harness changes: 0
performance target changes: 0
production performance tuning: 0
RLS implementation: 0
PSP implementation: 0
ProviderFee runtime changes: 0
Sales refactor changes: 0
financial logic changes: 0

tests skipped: 0
assertions weakened: 0
retry masking: 0
hidden failures: 0
forced exit masking: 0

2.17B final qualification executed: NO
Step 2.18 APPROVED claimed: NO
Phase 2 exit claimed: NO
release/deploy: 0
```

Audit-generated report/Roadmap/provenance changes are excluded from "production code changes".

---

# 30. ARTIFACT CHECKER ORDER

Follow repository convention.

At minimum:

1. create/update report and Roadmap;
2. run `git diff --check`;
3. run artifact checker;
4. run checker regression;
5. stage exact files;
6. inspect staged diff;
7. commit;
8. synchronize provenance/footer if required;
9. rerun checker if footer changes affect integrity;
10. commit footer/provenance;
11. push;
12. verify HEAD == upstream.

Do not fabricate footer SHA values before commits exist.

---

# 31. GIT DISCIPLINE

Before staging:

```bash
git status --short
git diff --stat
git diff
git diff --check
```

Stage only intended audit documentation files.

Never:

```bash
git add .
git add -A
```

Inspect:

```bash
git diff --cached --stat
git diff --cached
git diff --cached --check
```

Unrelated untracked prompts/diagnostics must remain untouched.

---

# 32. PERSISTENCE

Commit with repository-conventional messages.

Example only:

```bash
git commit -m "docs(phase2): record bounded 2.18 exit audit"
```

If provenance/footer requires a separate commit, use it.

Push:

```bash
git push origin HEAD
```

Then:

```bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

Only claim `PUSHED` if:

```text
HEAD == upstream
```

---

# 33. REPOSITORY EVIDENCE FOOTER

Populate with real values:

```text
repository:
branch:
audit_start_sha:
audit_report_commit_sha:
roadmap_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:

step_2_17_state:
step_2_17a_state:
step_2_17b_state:
step_2_17c_state:
step_2_18a_state:
step_2_18_state:
step_2_18_approved:
phase2_exit_state:

canonical_executable_gate_count:
executable_gates_pass:
executable_gates_fail:
executable_gates_invalid:
external_blocked_gate_count:

adr_0014_state:
rls_disposition:
tenant_isolation_result:
cross_tenant_read_failures:
cross_tenant_mutation_failures:

security_result:
security_targeted_tests:
security_findings:

backend_typecheck:
backend_build:
backend_unit:
backend_e2e:
backend_e2e_suites:
backend_skipped_tests:

migration_count:
migration_result:
drift_result:

ci_definition_result:
remote_ci_result:
ci_fail_open_findings:

frontend_typecheck:
frontend_vitest:
frontend_build:

financial_evidence:
backup_dr_evidence:
sales_structural_evidence:

performance_gate:
performance_qualification_executed:
performance_system_pass_claimed:
performance_system_fail_claimed:

artifact_integrity:
checker_regression:

production_code_changes:
frontend_production_changes:
schema_changes:
migration_changes:
ci_changes:
performance_harness_changes:
performance_target_changes:
performance_tuning:
rls_implementation:
psp_implementation:
release_status:

findings_critical:
findings_high:
findings_medium:
findings_low:
observations:

verdict:
next:
deferred_return:
```

Do not fabricate any field.

---

# 34. SUCCESS TERMINAL OUTPUT — VERDICT A

If all seven executable gates pass:

```text
TRAVELHUB PHASE 2 STEP 2.18 BOUNDED FINAL EXIT AUDIT COMPLETED —
ALL EXECUTABLE EXIT GATES PASS —
FINAL APPROVAL BLOCKED ONLY BY STEP 2.17B

Decision:
- verdict: A — BOUNDED FINAL AUDIT PASS
- Step 2.18: BOUNDED FINAL AUDIT COMPLETED
- Step 2.18 APPROVED: NO
- Step 2.17B: BLOCKED — EXTERNAL QUALIFICATION ENVIRONMENT
- Phase 2 exit: BLOCKED

Executable gates:
- ADR-0014 / tenant isolation: PASS
- Security: PASS
- Backend/full regression: PASS
- DB migration/drift: PASS
- CI contract: PASS
- Frontend: PASS
- Artifact integrity: PASS

Blocked gate:
- Step 2.17B performance qualification: BLOCKED
- final qualification executed: NO
- system PASS claimed: NO
- system FAIL claimed: NO

Remaining Phase 2 exit work:
1. obtain an admitted dedicated qualification environment;
2. execute Step 2.17B frozen-matrix final qualification;
3. if 2.17B APPROVED, perform the final Step 2.18 closure/reconciliation required by the canonical Roadmap;
4. only then evaluate Phase 2 exit.

RELEASE: NOT PERFORMED

NEXT:
DEFERRED RETURN — STEP 2.17B FINAL QUALIFICATION
when a valid dedicated environment becomes available.
```

Do not state Phase 2 is complete.

---

# 35. FAILURE TERMINAL OUTPUT — VERDICT B

If an executable gate validly fails:

```text
TRAVELHUB PHASE 2 STEP 2.18 BOUNDED FINAL EXIT AUDIT COMPLETED —
VALID EXIT-GATE FAILURE

Decision:
- verdict: B — BOUNDED AUDIT FAIL
- failed gate: <gate>
- Step 2.18 APPROVED: NO
- Step 2.17B: BLOCKED / unchanged
- Phase 2 exit: BLOCKED

Finding:
<classification / severity / evidence>

RELEASE: NOT PERFORMED

NEXT:
SEPARATE REMEDIATION PASS FOR <gate>
```

Do not fix it here.

---

# 36. INVALID TERMINAL OUTPUT — VERDICT C

If one of the seven executable gates cannot be validly evaluated:

```text
TRAVELHUB PHASE 2 STEP 2.18 BOUNDED FINAL EXIT AUDIT INCOMPLETE

Decision:
- verdict: C — AUDIT INVALID / INCOMPLETE
- blocked/invalid executable gate: <gate>
- system PASS claimed: NO for that gate
- system FAIL claimed: NO for that gate
- Step 2.18 APPROVED: NO
- Phase 2 exit: BLOCKED

NEXT:
<environment/harness/evidence remediation>
```

---

# 37. ADDITIONAL BLOCKER TERMINAL OUTPUT — VERDICT D

```text
TRAVELHUB PHASE 2 STEP 2.18 BOUNDED FINAL EXIT AUDIT STOPPED

Decision:
- verdict: D — ADDITIONAL EXIT BLOCKER DISCOVERED
- blocker: <canonical blocker>
- Step 2.17B: BLOCKED / unchanged
- Step 2.18 APPROVED: NO
- Phase 2 exit: BLOCKED

NEXT:
<repository-defined action>
```

---

# 38. AFTER A SUCCESSFUL BOUNDED AUDIT

If VERDICT A is achieved, do **not** create another implementation task merely to "finish 2.18".

The expected project state becomes:

```text
2.17   APPROVED
2.17A  APPROVED
2.17B  BLOCKED — external qualification environment
2.17C  APPROVED
2.18A  APPROVED
2.18   BOUNDED FINAL AUDIT COMPLETED — final approval withheld
Phase 2 exit BLOCKED
```

At that point the remaining mandatory return path is 2.17B once a valid environment exists, followed by the minimal final 2.18 closure required by the Roadmap.

Independent later-phase/product work may only proceed if the canonical Roadmap explicitly allows it; do not infer permission from this audit.

---

# 39. HARD STOP

After:

```text
provenance verification
Step 2.18 contract recheck
audit matrix reconstruction
ADR-0014/tenant-isolation audit
security exit recheck
backend full regression
DB migration/drift check
CI contract audit
frontend full regression
artifact integrity
cross-gate consistency
findings classification
report
Roadmap update
artifact checker
exact staging
commit
provenance/footer sync
push
HEAD/upstream verification
terminal verdict
```

**STOP.**

Do not:

```text
run Step 2.17B final qualification
change frozen performance targets
tune production performance
implement RLS
implement PSP
approve Step 2.18
complete Phase 2
release/deploy
start unrelated implementation
```

---

# 40. CORE AUDIT PRINCIPLE

The objective is not to produce a green Phase 2 status.

The objective is to establish, with fresh repository evidence, whether **every currently executable Phase 2 exit gate is green**.

A correct result may therefore be:

```text
7/7 executable gates PASS
+
1 mandatory performance gate BLOCKED
=
bounded audit PASS
but
Step 2.18 NOT APPROVED
and
Phase 2 NOT COMPLETE
```

That distinction must remain explicit in the Roadmap, report, terminal output, and repository evidence footer.
