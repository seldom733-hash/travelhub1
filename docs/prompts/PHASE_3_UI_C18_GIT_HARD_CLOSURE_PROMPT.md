# PHASE 3 — UI-C18 — GIT HARD CLOSURE
## FINAL REPOSITORY / RELEASE CLOSURE PROMPT

> Repository: `seldom733-hash/travelhub1`
> Canonical repo: `D:\travelhub_v1`
> Phase: Phase 3
> Stage: UI-C18
>
> **Purpose:** perform the final Git hard closure after UI-C17 has been independently accepted and reconciled.
>
> This is a **repository closure and release-integrity stage**. It must not redesign the application.

---

# 1. CURRENT ACCEPTED STATE

UI-C17 is closed:

```text
UI-C17 = CLOSED
VERDICT A — UI-C17 EVIDENCE/GIT RECONCILIATION ACCEPTED
```

Final verified UI-C17 reconciliation SHA:

```text
69cdaa6b47f8f6039ec90f6d8fc0ba184ef33efb
```

At that point:

```text
HEAD == origin/master
tracked working tree = clean
33 known historical untracked process artifacts remain
UI-C8 publication set remains intentionally isolated and uncommitted
```

UI-C17 did not change production RBAC behavior.

---

# 2. PRIMARY OBJECTIVE

Perform Git Hard Closure for Phase 3.

The goal is to establish a precise final repository state:

```text
intended production changes
        +
required documentation
        +
required evidence
        ↓
committed
        ↓
pushed
        ↓
HEAD == origin/master
        ↓
no unintended tracked diff
        ↓
final closure report
```

Do NOT equate:

```text
tracked working tree clean
```

with:

```text
no untracked files exist
```

Historical process artifacts must be classified separately.

---

# 3. CRITICAL RULE — UI-C8 PUBLICATION SET

At the start, three tracked files were intentionally left uncommitted from UI-C8:

```text
frontend/components/order/OrderActionBar.tsx
frontend/lib/commerce-detail-system.spec.tsx
frontend/lib/i18n.tsx
```

These changes MUST NOT be discarded.

They MUST NOT be silently included in UI-C18 merely to make Git clean.

First determine their exact provenance and status.

Inspect:

```bash
git status --short
git diff -- frontend/components/order/OrderActionBar.tsx
git diff -- frontend/lib/commerce-detail-system.spec.tsx
git diff -- frontend/lib/i18n.tsx
git diff --stat
git diff --check
```

Also inspect relevant commits and compare the files against:

- UI-C8 baseline;
- UI-C8 implementation commit;
- UI-C8 qualification evidence;
- current `HEAD`.

---

# 4. DECISION TREE FOR UI-C8 SET

Classify the three files.

## CASE A — Verified accepted UI-C8 production changes

If they are the exact accepted UI-C8 implementation and qualification evidence proves them:

Then:

1. do NOT reimplement them;
2. do NOT modify unrelated content;
3. create a dedicated UI-C8 publication commit;
4. run the required C8 regression checks;
5. push;
6. verify HEAD == origin/master.

Record:

```text
UI-C8 publication commit = <actual SHA>
```

Do not call it UI-C18 production logic.

---

## CASE B — Already represented in an existing commit

If the worktree diff is duplicated/reverted relative to a reachable accepted commit:

- do not commit duplicate changes;
- restore only if the exact provenance is proven;
- document why.

Do not use `git checkout --` blindly.

---

## CASE C — Unexpected changes

If any part of the three files is not explained by accepted UI-C8 evidence:

STOP.

Do not commit it.

Report:

```text
UNEXPECTED PRODUCTION CHANGE
```

and identify the exact lines/files.

---

# 5. HISTORICAL UNTRACKED ARTIFACTS

List all untracked files:

```bash
git status --short
```

Classify each:

```text
A — required production/evidence artifact
B — historical process artifact
C — unrelated artifact
D — suspicious/unexpected
```

## Class B

Known historical prompts/reports may remain untracked.

Do not delete them merely for cosmetic cleanliness.

## Class A

If a required Phase 3 artifact is supposed to be version-controlled:

- add it;
- verify contents;
- commit it.

## Class C/D

STOP and report unless explicit cleanup is safe and within scope.

Never use:

```bash
git clean -fd
```

without individually proving every untracked file is disposable.

---

# 6. DO NOT DELETE PROJECT HISTORY

Never delete:

- accepted reports;
- evidence CSVs;
- architecture documents;
- prompts that are intentionally retained;
- migrations;
- test evidence;
- historical qualification artifacts;

merely to achieve a clean `git status`.

Git closure means **controlled repository state**, not deletion of process history.

---

# 7. BASELINE / LINEAGE CHECK

Record:

```bash
git rev-parse HEAD
git rev-parse origin/master
git log --oneline --decorate -30
git status --short
git diff --check
```

Identify:

```text
UI-C17 final reconciliation = 69cdaa6...
```

Verify that it is an ancestor of the final branch.

---

# 8. VERIFY UI-C17 EVIDENCE PRESERVATION

Before any commit, verify these remain tracked and reachable:

```text
docs/reports/PHASE_3_UI_C17_FINAL_RBAC_FULL_MATRIX_REQUALIFICATION_REPORT.md
docs/reports/evidence/PHASE_3_UI_C17_RBAC_FULL_MATRIX.csv
docs/reports/PHASE_3_UI_C17_EVIDENCE_GIT_RECONCILIATION_REPORT.md
```

Do not alter their security conclusions.

If a documentation-only correction is needed because of Git closure metadata, make only that correction and document it.

---

# 9. UI-C8 ACCEPTED STATE TO PRESERVE

Use the previously accepted UI-C8 state as authority.

UI-C8 was functionally accepted with:

- localized OrderActionBar;
- localized confirmation/busy text;
- accessible busy state;
- contrast correction;
- server-authoritative `availableActions` preserved;
- focused tests PASS;
- D5 E2E PASS;
- TSC/build PASS;
- browser verification PASS.

Do not redesign Order UI in C18.

C18 only publishes already accepted C8 work.

---

# 10. REQUIRED C8 PUBLICATION QUALIFICATION

If CASE A applies, run at minimum:

```text
UI-C8 focused tests
D5 / Order relevant regression
frontend TSC
frontend production build
git diff --check
```

Do not require the entire project to be green if known unrelated baseline failures exist, but accurately document all failures.

Do not label failed suites PASS.

---

# 11. COMMIT POLICY

Each commit must have one clear purpose.

Preferred sequence if C8 publication is required:

```text
Commit 1:
UI-C8 accepted production publication

Commit 2:
UI-C18 Git closure report / documentation
```

Do not mix:

- RBAC changes;
- new feature work;
- Finance Center;
- PROD-01;
- unrelated cleanup;
- stale fixture remediation

into these commits.

If no production changes are required, do not manufacture a production commit.

---

# 12. STALE FIXTURES

Known stale fixture issue:

```text
POST /api/v1/products
Commercial Product creation requires a Partner owner
```

This caused setup failures in:

```text
auth-rbac.e2e
rbac-actions.e2e
buyer-cabinet.e2e
```

Do NOT fix those fixtures inside UI-C18 unless explicitly required by the project owner.

Classify them as known maintenance debt.

Do not change business rules merely to make the final Git closure green.

---

# 13. `order.import`

Do not remove or promote:

```text
order.import
```

during UI-C18.

It remains:

```text
DB-only
STALE
zero executable path
outside canonical 156
```

Its cleanup requires a separately governed migration/approval.

---

# 14. FINAL VALIDATION

After all intended commits:

```bash
git status --short
git diff --check
git rev-parse HEAD
git rev-parse origin/master
git merge-base HEAD origin/master
git log --oneline --decorate -20
```

Required:

```text
HEAD == origin/master
git diff --check = PASS
```

Tracked working tree should be clean.

If historical untracked files remain:

```text
tracked working tree = CLEAN
untracked historical artifacts = KNOWN / CLASS B
repository globally clean = DO NOT CLAIM
```

---

# 15. VERIFY FINAL COMMIT CONTENT

For every closure commit inspect:

```bash
git show --stat --oneline <SHA>
git show --name-only <SHA>
```

Confirm no unintended production files were included.

For UI-C8 publication commit verify only accepted C8 files are present, plus any strictly required associated test/i18n changes.

For closure documentation commit verify only documentation/evidence metadata.

---

# 16. FINAL REGRESSION

After publication, run the minimum required regression:

```text
UI-C8 focused tests
D5 / Order regression
RBAC parity
relevant security regression
frontend TSC
backend TSC if backend untouched only if project gate requires it
frontend build
```

If a known unrelated failure remains, classify it explicitly.

The final report must distinguish:

```text
PASS
NON-BLOCKING KNOWN FAILURE
NOT RUN
```

Never convert `NOT RUN` into PASS.

---

# 17. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_UI_C18_GIT_HARD_CLOSURE_REPORT.md
```

Required sections:

```text
1. Purpose
2. Starting State
3. UI-C17 Final State
4. UI-C8 Publication Set Analysis
5. UI-C8 Publication Decision
6. Historical Untracked Artifacts
7. Commit Plan
8. Commit Evidence
9. Regression Evidence
10. Final HEAD / origin/master
11. Tracked Working Tree
12. Untracked Artifacts
13. Production Diff Audit
14. Known Non-Blockers
15. Remaining Governance Items
16. Phase 3 Closure State
17. Final Verdict
```

---

# 18. FINAL GIT STATE

The report MUST provide exact:

```text
UI-C17 FINAL SHA
UI-C8 PUBLICATION SHA (if created)
UI-C18 CLOSURE SHA
FINAL VERIFIED HEAD
FINAL VERIFIED origin/master
```

Never use an approximate SHA.

If multiple documentation commits exist, list them in chronological order.

---

# 19. FINAL VERDICT

Use exactly one.

## VERDICT A — UI-C18 GIT HARD CLOSURE ACCEPTED

Only if:

- all intended accepted changes are committed;
- no accepted work was lost;
- UI-C8 publication set is correctly handled;
- no unexpected production changes are present;
- UI-C17 evidence remains reachable;
- required regression checks pass or known failures are explicitly non-blocking;
- `HEAD == origin/master`;
- tracked working tree is clean;
- untracked files are fully classified;
- no unsafe cleanup was performed.

Then:

```text
UI-C18 = CLOSED
PHASE 3 = GIT CLOSED
```

---

## VERDICT B — VALID PROJECT / GIT CLOSURE BLOCKED

Use if:

- functionality is valid;
- but an accepted change cannot be safely published;
- unexpected tracked changes remain;
- required evidence cannot be committed;
- or Git lineage cannot be proven.

Then:

```text
UI-C18 = BLOCKED
```

---

## VERDICT C — INTEGRITY / RELEASE DEFECT

Use if:

- accepted production changes were lost;
- an unexpected production change is found;
- evidence is inconsistent or missing;
- an unrelated feature was accidentally committed;
- branch history was corrupted;
- or another release-integrity problem exists.

---

# 20. FINAL PHASE 3 STATEMENT

If VERDICT A:

```text
PHASE 3
├── UI-C17 RBAC = CLOSED
├── UI-C17 Evidence/Git = CLOSED
├── UI-C18 Git Hard Closure = CLOSED
└── Phase 3 Git State = CLOSED
```

Do NOT declare the entire TravelHub product complete.

Do NOT declare Finance Center complete.

Do NOT close PROD-01 unless its own accepted stage exists.

Do NOT close unrelated technical debt.

---

# 21. FINAL PRINCIPLE

**Git Hard Closure is not cosmetic cleanup.**

It proves that:

```text
accepted work
+
accepted evidence
+
correct lineage
+
no accidental production changes
+
verified remote synchronization
```

are all simultaneously true.

Never sacrifice accepted work, history, or security evidence merely to obtain an empty `git status`.

The final objective is:

```text
HEAD == origin/master
+
tracked working tree clean
+
all accepted Phase 3 evidence preserved
+
all production changes intentional
+
all remaining untracked artifacts explicitly classified
```

Only then is **UI-C18 — Git Hard Closure** complete.
