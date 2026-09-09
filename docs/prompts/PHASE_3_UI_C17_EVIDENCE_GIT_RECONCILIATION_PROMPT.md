# PHASE 3 — UI-C17 — EVIDENCE / GIT RECONCILIATION
## FINAL CLOSURE PROMPT BEFORE UI-C18

> Repository: `seldom733-hash/travelhub1`
> Canonical repo: `D:\travelhub_v1`
> Purpose: reconcile the UI-C17 qualification report, evidence artifacts, and actual Git lineage before allowing UI-C18 Git Hard Closure.
>
> **This is a closure/reconciliation task, NOT a new RBAC implementation.**

---

# 1. CONTEXT

UI-C17 security qualification reported:

```text
VERDICT A — UI-C17 ACCEPTED
```

The reported security evidence is:

- canonical permission universe = 156;
- current roles = 10;
- complete matrix = 1560 cells;
- 1560/1560 MATCH;
- 0 MISSING GRANT;
- 0 EXCESS GRANT;
- 0 UNRESOLVED;
- 33/33 live API probes PASS;
- Operator model PASS;
- Partner/Buyer scope PASS;
- full-access-by-default DISPROVEN;
- UI/server authority PASS.

The report is:

```text
docs/reports/PHASE_3_UI_C17_FINAL_RBAC_FULL_MATRIX_REQUALIFICATION_REPORT.md
```

The matrix artifact is:

```text
docs/reports/evidence/PHASE_3_UI_C17_RBAC_FULL_MATRIX.csv
```

The purpose of this task is to reconcile the **reported Git state** against the **actual Git state** and ensure that the accepted evidence is really present in the repository lineage.

---

# 2. KNOWN REPORT INCONSISTENCIES

The submitted UI-C17 report contains the following apparent inconsistency:

§2 reports:

```text
HEAD        = a72ed19f56e4b6844733b0c60edef605d2611484
origin/master = a72ed19f56e4b6844733b0c60edef605d2611484
```

while §32 reports:

```text
UI-C17 COMMIT = 88d9c01ae858c81bfc3cd9ecb6acfe7cc26ee7be
FINAL SHA     = 88d9c01ae858c81bfc3cd9ecb6acfe7cc26ee7be
```

This MUST be independently verified.

Do not assume either SHA is correct.

---

# 3. HARD RULE

Do not change RBAC behavior.

Do not:

- modify roles;
- modify permissions;
- modify RolePermission grants;
- modify guards;
- modify endpoints;
- modify UI authorization;
- alter tenant/workspace scope;
- promote `order.import`;
- remove `order.import`;
- change the 156-permission canonical universe.

This task is only:

```text
Evidence
+
Report
+
Git lineage
+
Closure integrity
```

---

# 4. STEP 1 — VERIFY ACTUAL GIT STATE

Run and record:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --short
git diff --check
git log --oneline --decorate -20
```

Also verify:

```bash
git merge-base HEAD origin/master
```

Determine whether:

```text
HEAD == origin/master
```

is actually true.

---

# 5. STEP 2 — VERIFY THE REPORTED SHAs

Explicitly inspect:

```text
a72ed19f56e4b6844733b0c60edef605d2611484
88d9c01ae858c81bfc3cd9ecb6acfe7cc26ee7be
```

For each SHA determine:

```text
exists?
reachable from HEAD?
reachable from origin/master?
parent?
commit date?
commit message?
changed files?
```

Do not guess.

If one SHA does not exist, state:

```text
SHA NOT PRESENT IN REPOSITORY
```

---

# 6. STEP 3 — VERIFY UI-C17 EVIDENCE FILES

Confirm the actual current repository contains:

```text
docs/reports/PHASE_3_UI_C17_FINAL_RBAC_FULL_MATRIX_REQUALIFICATION_REPORT.md
docs/reports/evidence/PHASE_3_UI_C17_RBAC_FULL_MATRIX.csv
```

Verify both are reachable from the actual HEAD.

For CSV verify:

```text
header + 1560 data rows
unique(Role,Permission) = 1560
```

Verify:

```text
MATCH = 1560
MISSING GRANT = 0
EXCESS GRANT = 0
UNRESOLVED = 0
```

Do not trust only the report's numbers.

Recalculate them from the CSV.

---

# 7. STEP 4 — VERIFY REPORT SELF-CONSISTENCY

Check every Git statement in the UI-C17 report.

In particular reconcile:

```text
§2 Baseline / HEAD / origin
§31 Verdict
§32 Git State
```

The final report MUST contain one unambiguous:

```text
FINAL VERIFIED HEAD
FINAL VERIFIED origin/master
```

If the UI-C17 evidence commit is different from the final annotation commit, distinguish them explicitly:

```text
EVIDENCE COMMIT
FINAL DOCUMENTATION COMMIT
FINAL VERIFIED HEAD
```

Do not call an intermediate commit the final SHA.

---

# 8. STEP 5 — VERIFY REPORT CLAIMS AGAINST ARTIFACTS

Verify at minimum:

### Matrix

```text
1560 rows
1560 unique role/permission pairs
1560 MATCH
```

### Roles

```text
10
```

### Permissions

```text
156 canonical
```

### Residual

```text
order.import
```

must remain:

```text
DB-only
STALE
outside canonical 156
zero executable path
```

unless current repository evidence proves otherwise.

---

# 9. STEP 6 — VERIFY NO PRODUCTION CHANGES

The UI-C17 report says:

```text
Production changes = 0
```

Verify the actual diff between the UI-C17 baseline and final evidence commit.

Expected UI-C17 changes:

```text
docs/reports/PHASE_3_UI_C17_FINAL_RBAC_FULL_MATRIX_REQUALIFICATION_REPORT.md
docs/reports/evidence/PHASE_3_UI_C17_RBAC_FULL_MATRIX.csv
```

Potentially allowed:

```text
other documentation-only closure metadata
```

if explicitly related to UI-C17.

If production source files changed:

STOP and classify the change.

Do not silently accept it as documentation-only.

---

# 10. STEP 7 — UI-C8 PUBLICATION SET

The report states that these tracked modifications were intentionally preserved and isolated:

```text
frontend/components/order/OrderActionBar.tsx
frontend/lib/commerce-detail-system.spec.tsx
frontend/lib/i18n.tsx
```

Verify their state.

They MUST NOT be accidentally included in UI-C17 evidence commits.

If they were included:

STOP and report.

Do not overwrite or discard them.

---

# 11. STEP 8 — UNTRACKED ARTIFACTS

List:

```bash
git status --short
```

Classify untracked files into:

```text
A. required UI-C17 evidence
B. historical process artifacts
C. unrelated artifacts
D. suspicious/unexpected
```

Required evidence should be tracked.

Historical artifacts may remain untracked if known and harmless.

Do not claim:

```text
repository globally clean
```

when untracked files remain.

Use precise wording:

```text
tracked working tree clean
```

if appropriate.

---

# 12. STEP 9 — TEST CLAIM RECONCILIATION

The report describes several known fixture failures:

```text
auth-rbac.e2e
rbac-actions.e2e
buyer-cabinet.e2e
```

caused by:

```text
POST /api/v1/products
Commercial Product creation requires a Partner owner
```

Do not change those fixtures in this task.

Verify that the UI-C17 report does NOT falsely claim that every suite was fully green.

Correct terminology should distinguish:

```text
RBAC qualification evidence = PASS
specific relevant suites = PASS
known unrelated fixture failures = NON-BLOCKING
```

If the report currently says broadly:

```text
required tests/TSC/build pass
```

while listing failed suites, correct the wording without changing test behavior.

---

# 13. STEP 10 — MARKETING.READ TERMINOLOGY

Verify the report's statement about:

```text
marketing.read
```

Canonical wording:

```text
155/156 permissions have executable references.
marketing.read is the documented zero-direct-reference
page-gate/UI-aggregate exception.
```

Do not describe `marketing.read` as having a controller guard if it does not.

This is a terminology/documentation correction only.

---

# 14. STEP 11 — NO RBAC REGRESSION

After any documentation-only correction, verify:

```text
rbac-parity.e2e
```

and the relevant established RBAC/security checks remain unchanged.

No role/permission behavior may change.

If any security behavior changes unexpectedly:

STOP.

---

# 15. STEP 12 — REPORT UPDATE

If reconciliation finds documentation inconsistencies, update:

```text
docs/reports/PHASE_3_UI_C17_FINAL_RBAC_FULL_MATRIX_REQUALIFICATION_REPORT.md
```

The corrected report MUST have:

### One authoritative final state

```text
FINAL VERIFIED HEAD = <actual SHA>
FINAL VERIFIED ORIGIN/MASTER = <actual SHA>
```

### One authoritative UI-C17 commit lineage

For example:

```text
UI-C17 EVIDENCE COMMIT = <SHA>
UI-C17 DOCUMENTATION/CLOSURE COMMIT = <SHA>
FINAL VERIFIED HEAD = <SHA>
```

Only include fields that actually exist.

Do not invent a SHA.

---

# 16. STEP 13 — REQUIRED RECONCILIATION REPORT

Create:

```text
docs/reports/PHASE_3_UI_C17_EVIDENCE_GIT_RECONCILIATION_REPORT.md
```

Required sections:

```text
1. Purpose
2. Input UI-C17 Verdict
3. Actual Git State
4. SHA Reconciliation
5. Evidence File Verification
6. CSV Recalculation
7. UI-C17 Report Self-Consistency
8. Production Diff Verification
9. UI-C8 Publication Set Verification
10. Untracked Artifact Classification
11. Test Claim Reconciliation
12. marketing.read Terminology Check
13. RBAC Regression Check
14. Corrections Made
15. Corrections Not Made
16. Final UI-C17 Closure State
17. UI-C18 Readiness
18. Git State
19. Final Verdict
```

---

# 17. FINAL VERDICT

Use exactly one.

## VERDICT A — UI-C17 EVIDENCE/GIT RECONCILIATION ACCEPTED

Only if:

- actual HEAD is verified;
- origin/master is verified;
- SHA lineage is unambiguous;
- report and CSV exist at final HEAD;
- CSV independently recalculates to 1560/1560 MATCH;
- no production changes are hidden in evidence commits;
- UI-C8 publication set is not contaminated;
- test failure wording is accurate;
- `marketing.read` wording is accurate;
- no RBAC behavior changed;
- UI-C17 security verdict remains justified.

Then:

```text
UI-C17 = CLOSED
UI-C18 = READY
```

## VERDICT B — DOCUMENTATION/GIT BLOCKER

Use if:

- security result remains valid;
- but Git lineage or evidence publication cannot be proven;
- or report inconsistencies remain unresolved.

Then:

```text
UI-C17 = NOT CLOSED
UI-C18 = BLOCKED
```

## VERDICT C — SECURITY / INTEGRITY DEFECT

Use if reconciliation discovers:

- evidence does not support the claimed RBAC result;
- production RBAC changes were hidden in an evidence commit;
- canonical matrix is wrong;
- a real authorization regression exists;
- tenant/workspace isolation changed;
- or evidence artifact was tampered/misrepresented.

---

# 18. UI-C18 GATE

UI-C18 may start only after:

```text
VERDICT A — UI-C17 EVIDENCE/GIT RECONCILIATION ACCEPTED
```

Do not execute UI-C18 inside this task.

---

# 19. FINAL PRINCIPLE

**Do not make the report agree with Git by guessing.**

The final state must be reconstructed from:

```text
actual repository
+
actual commits
+
actual evidence files
+
actual CSV contents
+
actual test results
```

The purpose is to turn the already-qualified UI-C17 security result into an **auditable, internally consistent, Git-verifiable closure state** before UI-C18.
