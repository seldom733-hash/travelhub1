# PHASE 3 — UI-C1.2F.1I — FINAL GIT HARD CLOSURE / STAGE CLOSURE
## Operations Center Filtering Alignment — Final Repository Closure

---

# 0. Purpose

This stage is the final closure gate for the completed `UI-C1.2F.1` sequence.

Accepted stages:

```text
UI-C1.2F.1A — ACCEPTED
UI-C1.2F.1B — ACCEPTED
UI-C1.2F.1C — ACCEPTED
UI-C1.2F.1D — ACCEPTED
UI-C1.2F.1E — ACCEPTED
UI-C1.2F.1F — ACCEPTED
UI-C1.2F.1G — ACCEPTED
UI-C1.2F.1H — ACCEPTED
```

This task is:

```text
FINAL REPOSITORY / ARTIFACT / STAGE CLOSURE ONLY
```

No new functionality.

---

# 1. Baseline

Current accepted repository baseline:

```text
HEAD / origin/master:
5258ed728aed0a122bdff7e1285c583f41729779
```

This SHA already contains:

```text
accepted 1H cross-registry qualification
accepted 1F Payments implementation
accepted 1E Bookings implementation
accepted 1D Orders implementation
accepted 1G Requests implementation
shared Header Period
shared TableHeaderFilter foundation
```

---

# 2. Stage Goal

Prove that the entire `UI-C1.2F.1` sub-sequence is repository-complete and ready to close.

Required final state:

```text
working tree clean
all stage artifacts tracked
HEAD == origin/master
accepted implementation/qualification commits are ancestors of HEAD
no dangling local-only stage commits
no untracked prompt/report/evidence artifacts
no accidental functional changes during closure
```

---

# 3. Strict Scope

Allowed:

```text
Git inspection
artifact inventory
docs/report finalization
literal terminal evidence
ancestry proof
push/fetch synchronization
final stage closure report
```

Forbidden:

```text
functional source changes
UI changes
backend changes
new tests
new statuses
new filters
new architecture
UI-C1.2G work
UI-C2 work
D8 work
```

If any functional source file changes during 1I:

```text
STOP
VERDICT B
```

unless the change is only reverting an accidental closure-time modification back to baseline.

---

# 4. Canonical Stage Chain to Verify

The closure report must explicitly verify the accepted `UI-C1.2F.1` chain:

```text
1A — Requests KPI Date Scope
1B — Shared Operations Center Header Period
1C — Shared TableHeaderFilter + Sorting Foundation
1D — Orders Table-Header Filtering + Sorting Alignment
1E — Bookings Table-Header Filtering + Sorting Alignment
1F — Payments Table-Header Filtering + Sorting Alignment
1G — Requests Table Sorting + Table-Header Status Filter
1H — Cross-Registry Regression Qualification
1I — Final Git Hard Closure
```

---

# 5. Known Accepted Key SHAs

Verify ancestry for these accepted milestones where applicable.

```text
1B functional remediation:
ea5f6dc533dea49238a33627baf0586ace481758

1B final closure:
22d165384830d3f9f9b7c8c66cefe852b8b8ff13

1C final:
19f5f392818e5180b2642bbf08919b95f858f614

1D R2 implementation:
62a7542b6bb349cdb75f2953b5194888eaf312e7

1G final:
1ecee13d18614e2e53469d50c2271bdadf2d883e

1E implementation:
2db72e6c8e6e419b6c93df20d6ead5217b5cc6db

1F implementation:
17ea8b601ba0cd2171b7d2b7c8c3553389af962e

1H final:
5258ed728aed0a122bdff7e1285c583f41729779
```

If any SHA is not an ancestor of HEAD, do not silently ignore it.

Report exact failure.

---

# 6. Artifact Inventory

Audit the repository for all stage-owned artifacts.

At minimum check:

```text
docs/prompts/
docs/reports/
docs/evidence/
```

for:

```text
UI-C1.2F.1A
UI-C1.2F.1B
UI-C1.2F.1C
UI-C1.2F.1D
UI-C1.2F.1E
UI-C1.2F.1F
UI-C1.2F.1G
UI-C1.2F.1H
UI-C1.2F.1I
```

Required:

```text
all intended artifacts tracked
no duplicate accidental temp copies
no untracked screenshots/logs/prompts/reports
no stale *.tmp / *.bak / copy files owned by this stage sequence
```

Do not delete unrelated user files.

---

# 7. Functional Diff Guard

Before any closure commit:

```bash
git status --porcelain=v1
git diff --name-only
git diff --stat
git diff --check
```

Expected:

```text
only 1I docs/report/evidence files
```

If files under functional areas appear, for example:

```text
frontend/app/
frontend/lib/
backend/
src/
```

then:

```text
STOP
VERDICT B
```

unless the diff is proven to be an accidental local modification and restored before closure.

---

# 8. Branch / Remote Check

Verify:

```bash
git branch --show-current
git remote -v
git status -sb
```

Required:

```text
branch = master
tracking origin/master
no divergence
```

If ahead/behind/diverged:

```text
do not force-push
do not reset destructively
report exact state
```

---

# 9. Commit Graph Check

Capture:

```bash
git log --graph --decorate --oneline -20
```

Verify:

```text
accepted 1E/1F/1H chain is linear/expected
no accidental merge commit introduced during closure
no local-only commit after accepted final closure unless it is 1I docs closure
```

Do not rewrite history.

---

# 10. Ancestry Proof — Mandatory

Run literal ancestry checks:

```bash
git merge-base --is-ancestor ea5f6dc533dea49238a33627baf0586ace481758 HEAD
echo $LASTEXITCODE

git merge-base --is-ancestor 22d165384830d3f9f9b7c8c66cefe852b8b8ff13 HEAD
echo $LASTEXITCODE

git merge-base --is-ancestor 19f5f392818e5180b2642bbf08919b95f858f614 HEAD
echo $LASTEXITCODE

git merge-base --is-ancestor 62a7542b6bb349cdb75f2953b5194888eaf312e7 HEAD
echo $LASTEXITCODE

git merge-base --is-ancestor 1ecee13d18614e2e53469d50c2271bdadf2d883e HEAD
echo $LASTEXITCODE

git merge-base --is-ancestor 2db72e6c8e6e419b6c93df20d6ead5217b5cc6db HEAD
echo $LASTEXITCODE

git merge-base --is-ancestor 17ea8b601ba0cd2171b7d2b7c8c3553389af962e HEAD
echo $LASTEXITCODE

git merge-base --is-ancestor 5258ed728aed0a122bdff7e1285c583f41729779 HEAD
echo $LASTEXITCODE
```

Every expected accepted milestone:

```text
exit code 0
```

If any fails:

```text
VERDICT B
```

and report exactly which SHA is missing from ancestry.

---

# 11. Optional Stage Summary Doc Update

If a canonical project status/roadmap document already contains this sequence, update only the stage-status section to:

```text
UI-C1.2F.1A — ACCEPTED
UI-C1.2F.1B — ACCEPTED
UI-C1.2F.1C — ACCEPTED
UI-C1.2F.1D — ACCEPTED
UI-C1.2F.1E — ACCEPTED
UI-C1.2F.1F — ACCEPTED
UI-C1.2F.1G — ACCEPTED
UI-C1.2F.1H — ACCEPTED
UI-C1.2F.1I — ACCEPTED
```

Do not invent a new project-status authority if none exists.

---

# 12. 1I Report

Create:

```text
docs/reports/PHASE_3_UI_C1_2F_1I_FINAL_GIT_HARD_CLOSURE_REPORT.md
```

The report must contain actual terminal evidence, not placeholders.

Forbidden:

```text
<FINAL SHA>
<NO OUTPUT> as narrative-only replacement
PASS without literal command evidence
```

For empty output, show the command and explicitly state:

```text
<NO OUTPUT>
```

only if that was the actual observed result.

---

# 13. Commit 1I Docs Only

Before commit:

```bash
git diff --check
git status --porcelain=v1
```

Commit only 1I stage-owned documentation/evidence.

Suggested message:

```text
docs: close UI-C1.2F.1 filtering alignment sequence
```

Then:

```bash
git push origin master
git fetch origin
```

---

# 14. Final Literal Git Proof

After push/fetch run:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git branch --show-current
git status -sb
git log -8 --oneline --decorate
```

Required:

```text
git status --porcelain=v1
→ NO OUTPUT

HEAD
→ full 40-char SHA

origin/master
→ exact same full 40-char SHA

branch
→ master
```

Then rerun at least these ancestry checks against final HEAD:

```bash
git merge-base --is-ancestor 2db72e6c8e6e419b6c93df20d6ead5217b5cc6db HEAD
echo $LASTEXITCODE

git merge-base --is-ancestor 17ea8b601ba0cd2171b7d2b7c8c3553389af962e HEAD
echo $LASTEXITCODE

git merge-base --is-ancestor 5258ed728aed0a122bdff7e1285c583f41729779 HEAD
echo $LASTEXITCODE
```

Expected:

```text
0
0
0
```

---

# 15. No New Runtime Qualification Required

1H already performed the cross-registry runtime qualification.

Therefore 1I does NOT require rerunning:

```text
browser scenarios
full functional regression
API reconciliation
responsive smoke
accessibility smoke
race tests
```

unless closure work unexpectedly changes functional source files.

If functional source changed, this ceases to be a closure-only stage and must stop.

---

# 16. Required Final Report Matrix

Use ACTUAL values.

```text
PHASE 3 — UI-C1.2F.1I
FINAL GIT HARD CLOSURE / STAGE CLOSURE

BASELINE SHA:
5258ed728aed0a122bdff7e1285c583f41729779

FINAL SHA:
<actual full 40-char SHA>

1A ACCEPTED ANCESTRY                 — PASS
1B ACCEPTED ANCESTRY                 — PASS
1C ACCEPTED ANCESTRY                 — PASS
1D ACCEPTED ANCESTRY                 — PASS
1E ACCEPTED ANCESTRY                 — PASS
1F ACCEPTED ANCESTRY                 — PASS
1G ACCEPTED ANCESTRY                 — PASS
1H ACCEPTED ANCESTRY                 — PASS

FUNCTIONAL SOURCE CHANGES            — NONE
STAGE ARTIFACT INVENTORY             — PASS
UNTRACKED STAGE ARTIFACTS            — NONE
DIFF CHECK                           — PASS

BRANCH                               — master
HEAD == origin/master                — PASS
WORKING TREE CLEAN                   — PASS
REMOTE SYNC                          — PASS
FINAL ANCESTRY                       — PASS

UI-C1.2F.1 SEQUENCE                  — CLOSED

VERDICT A — UI-C1.2F.1I ACCEPTED
```

If any mandatory condition fails:

```text
VERDICT B — UI-C1.2F.1I NOT ACCEPTED

BLOCKER:
<exact Git/artifact/repository closure defect>
```

---

# 17. Final Stage Status After PASS

Only after literal Git proof passes:

```text
UI-C1.2F.1A — ACCEPTED
UI-C1.2F.1B — ACCEPTED
UI-C1.2F.1C — ACCEPTED
UI-C1.2F.1D — ACCEPTED
UI-C1.2F.1E — ACCEPTED
UI-C1.2F.1F — ACCEPTED
UI-C1.2F.1G — ACCEPTED
UI-C1.2F.1H — ACCEPTED
UI-C1.2F.1I — ACCEPTED

UI-C1.2F.1 — CLOSED
```

---

# 18. STOP

After 1I:

```text
STOP
```

Do not automatically start:

```text
UI-C1.2G
UI-C2
D8
```

Wait for independent review and explicit instruction.
