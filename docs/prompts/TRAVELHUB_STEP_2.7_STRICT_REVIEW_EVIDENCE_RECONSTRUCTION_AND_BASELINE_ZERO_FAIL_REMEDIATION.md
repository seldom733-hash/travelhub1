# TRAVELHUB — STEP 2.7 STRICT REVIEW EVIDENCE RECONSTRUCTION & BASELINE ZERO-FAIL REMEDIATION

## 0. MODE

**DOCUMENTATION / PROVENANCE REMEDIATION ONLY · FORENSIC · NO PRODUCTION FEATURE CHANGES**

Current repository evidence:

- Roadmap Artifact Integrity Checker has been implemented, committed and pushed.
- Baseline scan reported:
  - 59 approved steps;
  - 448 references;
  - 89 PASS;
  - 2 WARN;
  - 1 FAIL.
- The single hard FAIL concerns **Step 2.7**: Roadmap evidence points to a Strict Review **prompt** where a Strict Review **report** is claimed/expected.
- This is the same provenance-error class previously discovered for Step 2.10B, but Step 2.7 must be independently investigated. Do not assume the root cause or verdict is identical.
- Production implementation must not be modified in this pass.
- `PHASE 2 — STEP 2.12A — PAYMENT PROVIDER ABSTRACTION` must not start in this pass.

The purpose is to determine whether Step 2.7's approved status is supported by repository evidence, reconstruct a retrospective report only if justified, repair the Roadmap evidence reference, and return the automated artifact-integrity baseline to **0 FAIL**.

---

# 1. REQUIRED FINAL OUTCOME

Successful outcome:

`TRAVELHUB STEP 2.7 STRICT REVIEW EVIDENCE RECONSTRUCTION COMPLETED — BASELINE ZERO-FAIL RESTORED`

Successful completion requires all of:

1. Step 2.7 forensic evidence audit completed;
2. approved verdict independently supported by repository evidence;
3. retrospective report created with an explicit reconstruction disclaimer;
4. Roadmap evidence reference repaired;
5. artifact-integrity checker rerun;
6. final checker result = **0 FAIL**;
7. WARN items classified honestly;
8. remediation committed;
9. commit pushed;
10. local HEAD/upstream equality verified;
11. `REPOSITORY EVIDENCE` recorded;
12. exact NEXT remains Step 2.12A.

If the approved verdict cannot be supported:

`TRAVELHUB STEP 2.7 EVIDENCE RECONSTRUCTION BLOCKED — APPROVED VERDICT NOT FULLY EVIDENCED`

Do not manufacture a green baseline.

---

# 2. HARD STOP CONDITIONS

Immediately stop reconstruction and report `BLOCKED` if any of these is true:

- Step 2.7 implementation claimed by Roadmap cannot be found;
- claimed migration/model/service/API/test artifacts materially do not exist;
- Git history contradicts the approved status;
- review fixes claimed by Roadmap cannot be substantiated;
- the supposed implementation exists only in another clone/legacy tree and not canonical history;
- evidence is insufficient to distinguish an actual Strict Review from a prewritten/planned status;
- satisfying the checker would require inventing an evidence artifact rather than reconstructing one;
- remediation would require production-code changes.

A failing checker is preferable to false provenance.

---

# 3. REPOSITORY BASELINE — VERIFY, DO NOT TRUST THIS PROMPT

Before changing files, run and record:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -20
```

Expected recent pushed HEAD from prior pass is around `08e9d9d`, but **do not hardcode or trust that SHA**. Verify actual state.

Record:

- canonical repository path/identity;
- branch;
- HEAD;
- upstream;
- worktree state;
- untracked files;
- whether HEAD == upstream.

Do not delete, rename, stage, or modify unrelated untracked prompts.

Known out-of-scope untracked files may include prompts for 2.12A, 2.17, and a duplicate provenance-hardening prompt. Verify actual state instead of assuming this list is complete.

---

# 4. RUN CURRENT ARTIFACT CHECKER FIRST

Locate the committed checker.

Expected:

`scripts/check-roadmap-artifacts.mjs`

Run it using its documented canonical invocation.

Record the complete summary.

Confirm independently:

- Step 2.7 is the current hard FAIL;
- exact Roadmap line/section;
- exact evidence reference;
- exact failure classification;
- both WARN items and their reasons.

If baseline differs from the previously reported `89 PASS / 2 WARN / 1 FAIL`, use the **current actual result** and explain why.

Do not alter checker rules merely to make Step 2.7 pass.

---

# 5. IDENTIFY STEP 2.7 EXACTLY

Read the full canonical Step 2.7 Roadmap entry, including nearby dependency/context sections.

Determine from repository truth:

- exact Step 2.7 title;
- scope;
- implementation status;
- Strict Review status;
- claimed implementation artifacts;
- claimed review artifacts;
- claimed test counts;
- claimed review fixes;
- claimed migration/schema/API/event/RBAC changes;
- Roadmap evidence links;
- NEXT marker at the historical point.

Do not infer Step 2.7 semantics from numbering alone.

---

# 6. FORENSIC GIT PROVENANCE AUDIT

Find the commit(s) that introduced Step 2.7 implementation and the commit(s) that introduced its approved/reviewed Roadmap status.

Use repository evidence such as:

```bash
git log --all --oneline --decorate -- <relevant-path>
git log -S"<distinct Step 2.7 marker>" --all --oneline
git log -G"<relevant regex>" --all --oneline -- <roadmap-path>
git blame <roadmap-path>
git show <sha> --stat
git show <sha>
```

Where useful also inspect:

```bash
git reflog
git fsck --full --no-reflogs --unreachable
```

Do not rewrite history.

Determine:

- implementation persistence SHA(s);
- review-fix persistence SHA(s), if distinct;
- Roadmap approval SHA;
- whether implementation and review evidence coexist in committed history;
- whether any expected report ever existed in reachable Git history;
- whether a deleted report existed historically;
- whether report absence is a persistence gap, deletion, naming mismatch, or unsupported status claim.

---

# 7. SEARCH FOR THE ORIGINAL STRICT REVIEW REPORT

Search current tree and Git history for plausible Step 2.7 report variants.

Inspect at minimum:

- `docs/prompts/`;
- architecture docs;
- historical filenames;
- Git tree listings at relevant commits;
- all reachable refs.

Use conservative filename matching.

A Strict Review **prompt** is not a Strict Review **report**.

Do not copy/rename a prompt and call it a historical report.

If an original report is found under another canonical filename, prefer repairing the Roadmap reference to that existing report rather than reconstructing a duplicate.

---

# 8. FACT MATRIX — REQUIRED BEFORE RECONSTRUCTION

Create a Step 2.7 evidence matrix in the remediation report.

Minimum columns:

| Claim | Roadmap claim | Repository evidence | Persistence SHA | Classification | Verdict |
|---|---|---|---|---|---|

Minimum rows:

- implementation exists;
- relevant schema/model changes exist, if claimed;
- migration exists, if claimed;
- service/controller/consumer changes exist, if claimed;
- unit tests exist;
- e2e tests exist;
- architecture doc exists;
- implementation report exists;
- Strict Review prompt exists;
- Strict Review report exists/missing;
- claimed review fixes exist;
- Roadmap approval status exists;
- historical test counts;
- relevant RBAC/event/API claims;
- any claimed regression baseline.

Classifications:

- `DIRECTLY VERIFIED`
- `COMMIT-MESSAGE EVIDENCE`
- `ROADMAP-ONLY HISTORICAL CLAIM`
- `CURRENT-RUNTIME RECHECK`
- `MISSING`
- `CONTRADICTED`

Do not collapse these categories.

---

# 9. APPROVED VERDICT EVIDENCE GATE

Before creating a retrospective report, answer:

**Is there sufficient repository evidence that a real Strict Review occurred and that its APPROVED verdict is supported?**

Acceptable supporting evidence can include a combination of:

- committed review fixes;
- review-specific tests;
- commit message explicitly recording review completion/results;
- Roadmap approval committed with implementation/review fixes;
- implementation/review documentation;
- Git diff demonstrating changes that correspond to review findings;
- other contemporaneous committed evidence.

A Roadmap `APPROVED` marker by itself is insufficient.

If evidence is insufficient:

**STOP — BLOCKED.**

Do not create a report merely because the checker expects one.

---

# 10. RETROSPECTIVE REPORT — ONLY IF GATE PASSES

If and only if §9 passes, create the missing report at the canonical intended path.

Derive the exact filename from:

- Roadmap intended reference;
- naming conventions of neighboring Step 2.x reports;
- existing Step 2.7 prompt/implementation filenames.

Do not arbitrarily invent a new naming convention.

Near the top include exactly and prominently:

> **RETROSPECTIVE EVIDENCE RECONSTRUCTION**
>
> This file was created after the original Step 2.7 Strict Review because the dedicated report artifact was missing from the canonical repository. It reconstructs only review results directly supported by committed repository evidence. It is not the original contemporaneous Strict Review transcript/report.

Also include:

- date of reconstruction as current documentation date, clearly labeled as reconstruction date;
- original implementation/review persistence SHA(s);
- provenance methodology;
- evidence limitations.

Do not invent the original review date if it cannot be established.

---

# 11. REPORT CONTENT

The reconstructed Step 2.7 report must preserve the actual historical scope and terminology of Step 2.7.

Required sections, adapted to actual evidence:

1. Reconstruction notice
2. Historical verdict
3. Scope
4. Repository provenance
5. Implementation evidence
6. Write-path/ownership evidence, if applicable
7. Schema/migration evidence, if applicable
8. API/RBAC/event evidence, if applicable
9. Review findings supported by evidence
10. Review fixes supported by evidence
11. Test artifact evidence
12. Historical test-count classification
13. Regression evidence classification
14. Documentation evidence
15. Negative/boundary checks supported by evidence
16. Missing original report finding
17. Limitations
18. Persistence evidence
19. Final retrospective verdict

Do not pad the report with generic review language unsupported by Step 2.7 artifacts.

---

# 12. HISTORICAL TEST COUNTS — STRICT RULE

Never rerun current tests and label them as historical Step 2.7 results.

For every historical count:

- identify source;
- classify source;
- state whether independently reproducible today.

Examples:

`COMMIT-MESSAGE EVIDENCE — historical claim, not rerun evidence`

`ROADMAP-ONLY HISTORICAL CLAIM — preserved but not independently evidenced`

If actual committed test files contain a different number of `it()` cases than Roadmap historical counts, document the discrepancy rather than rewriting history.

---

# 13. ROADMAP REPAIR

Only after successful reconstruction:

- replace the incorrect Step 2.7 evidence reference to the Strict Review prompt with the actual reconstructed report;
- add a concise retrospective note if consistent with the convention used for Step 2.10B;
- preserve Step 2.7 implementation/review verdict unless forensic evidence contradicts it;
- preserve downstream statuses;
- do not rewrite unrelated historical Roadmap entries.

Expected concept:

`Retrospective evidence reconstruction; original dedicated Strict Review report artifact was missing. Verdict/review fixes verified from committed repository evidence @ <SHA>.`

Use actual SHA.

---

# 14. TWO WARN ITEMS — CLASSIFY, DO NOT HIDE

Investigate the two current checker WARN items.

For each:

- identify Step;
- identify claim;
- explain why it is WARN rather than FAIL;
- determine whether it is:
  - legitimate historical runtime claim;
  - pre-provenance-convention artifact;
  - intentionally unverifiable remote/runtime state;
  - parser limitation;
  - actual documentation debt that should become FAIL.

Do not weaken checker behavior to remove warnings.

Warnings may remain after this pass if they are semantically correct.

Success requires **0 FAIL**, not necessarily 0 WARN.

---

# 15. RERUN CHECKER — ZERO FAIL HARD GATE

After reconstruction and Roadmap repair, rerun the real checker.

Hard success requirement:

`FAIL = 0`

Record actual totals:

- approved steps scanned;
- references;
- PASS;
- WARN;
- FAIL.

If `FAIL > 0`:

- do not declare success;
- classify new/remaining failures;
- do not weaken rules;
- do not start 2.12A.

If a new genuine historical provenance gap is uncovered, stop and report it for a separate remediation unless it is directly caused by the Step 2.7 change.

---

# 16. CHECKER REGRESSION

Run the checker's own test suite.

Expected prior baseline: 13/13, but use actual current test count.

All tests must pass.

If Step 2.7 remediation exposes a checker bug, a narrowly scoped checker fix is allowed only if:

- the current behavior is objectively incorrect;
- the fix strengthens correctness rather than suppressing a real failure;
- dedicated regression test is added;
- implementation report documents the change.

Do not change checker semantics solely to make the Roadmap green.

---

# 17. PRODUCTION NEGATIVE CHECKS

Prove the remediation changed none of:

- `backend/src/**`;
- `frontend/**` production source;
- Prisma schema;
- migrations;
- business tests unrelated to checker tooling;
- CI workflow;
- runtime configuration;
- Payment/Refund/Commission/Settlement logic;
- EventBus runtime;
- RBAC runtime;
- legacy runtime;
- `sales.service.ts`.

If any production file changed accidentally, revert only your accidental change before proceeding.

---

# 18. OUT-OF-SCOPE UNTRACKED FILES

Do not stage unrelated pre-existing files.

In particular, do not stage merely because they are present:

- Step 2.12A prompt;
- Step 2.17 prompt;
- duplicate `(1)` prompt files;
- unrelated audit prompts;
- editor/temp files.

Never use:

```bash
git add .
git add -A
```

---

# 19. REQUIRED REMEDIATION REPORT

Create:

`docs/prompts/TRAVELHUB_STEP_2.7_STRICT_REVIEW_EVIDENCE_RECONSTRUCTION_AND_BASELINE_ZERO_FAIL_REMEDIATION_REPORT.md`

Required sections:

1. Verdict
2. Repository baseline
3. Initial artifact-checker baseline
4. Step 2.7 identification
5. Roadmap claim
6. Git provenance audit
7. Original report search
8. Fact matrix
9. Approved-verdict evidence gate
10. Reconstruction decision
11. Reconstructed report path
12. Review evidence
13. Review-fix evidence
14. Historical test-count classification
15. Roadmap repair
16. WARN classification
17. Checker regression
18. Final checker baseline
19. Production negative checks
20. Files changed
21. Git staging evidence
22. Commit evidence
23. Push evidence
24. Repository Evidence footer
25. Exact NEXT
26. Final statement

---

# 20. REPOSITORY EVIDENCE FOOTER

Use the committed canonical template:

`docs/prompts/REPOSITORY_EVIDENCE_FOOTER_TEMPLATE.md`

Do not create a competing footer format.

The remediation report must end with actual values.

At minimum:

```text
REPOSITORY EVIDENCE
repository: <actual>
branch: <actual>
head: <actual SHA>
origin: <actual upstream SHA or unavailable>
worktree_clean: true|false
migration_count: <actual>
reviewed_state: COMMIT
reviewed_diff_base: <actual>
reviewed_diff_head: <actual>
persistence_status: PERSISTED
persistence_sha: <actual>
push_status: PUSHED | NOT_PUSHED | PUSH_FAILED | NOT_VERIFIED
```

If unrelated untracked files remain, `worktree_clean` must be `false`.

---

# 21. GIT PERSISTENCE GATE — REQUIRED

Successful remediation must be committed and pushed.

## 21.1 Pre-stage inspection

Run:

```bash
git status --short
git diff --stat
git diff
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
```

Record unrelated files.

## 21.2 Explicit staging

Stage only remediation files, for example:

```bash
git add \
  <actual-Step-2.7-retrospective-report> \
  docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md \
  docs/prompts/TRAVELHUB_STEP_2.7_STRICT_REVIEW_EVIDENCE_RECONSTRUCTION_AND_BASELINE_ZERO_FAIL_REMEDIATION_REPORT.md
```

If a legitimate checker regression fix was required, explicitly add only its exact script/test files.

Then:

```bash
git diff --cached --stat
git diff --cached
git status --short
```

Verify no unrelated prompt is staged.

## 21.3 Commit

Use a scoped message such as:

```bash
git commit -m "docs: reconstruct step 2.7 review evidence and close provenance gap"
```

Record:

```bash
git rev-parse HEAD
```

## 21.4 Push

If upstream exists:

```bash
git push
```

Otherwise:

```bash
git push -u origin <verified-current-branch>
```

Forbidden:

```bash
git push --force
git push --force-with-lease
```

## 21.5 Verify remote persistence

Run:

```bash
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

Require:

`HEAD == @{u}`

before reporting:

`push_status: PUSHED`

If verification fails, report the exact state. Do not fabricate push success.

---

# 22. POST-COMMIT FOOTER PROBLEM — HANDLE TRUTHFULLY

A report committed in the same commit cannot know its own final commit SHA before the commit exists.

Use the repository's already adopted provenance workflow rather than inventing circular evidence.

If the current convention uses a second documentation commit to populate final SHA/origin values:

1. commit remediation;
2. obtain persistence SHA;
3. update only the report footer with real values;
4. commit footer update separately;
5. push both;
6. report both SHAs and final HEAD.

Do not place fake placeholders and call them final.

If the canonical template defines another accepted method, follow it.

---

# 23. RELEASE GATE

No production release.

Final status:

`RELEASE: NOT APPLICABLE — DOCUMENTATION/PROVENANCE REMEDIATION`

Do not:

- deploy backend;
- deploy frontend;
- apply production migrations;
- create release tags;
- publish packages.

---

# 24. ROADMAP NEXT

After successful zero-FAIL remediation, read the current canonical Roadmap and verify NEXT.

Expected:

`PHASE 2 — STEP 2.12A — PAYMENT PROVIDER ABSTRACTION`

Do not assume if Roadmap has changed.

Do not start it in this pass.

---

# 25. FINAL RESPONSE FORMAT

Successful final response must include:

```text
TRAVELHUB STEP 2.7 STRICT REVIEW EVIDENCE RECONSTRUCTION COMPLETED — BASELINE ZERO-FAIL RESTORED

Step 2.7:
- retrospective report: <path>
- original report status: MISSING
- verdict evidence: SUFFICIENT
- Roadmap reference: REPAIRED

Artifact integrity:
- approved steps: <N>
- references: <N>
- PASS: <N>
- WARN: <N>
- FAIL: 0

Persistence:
- branch: <branch>
- remediation commit: <sha>
- footer/provenance commit: <sha or N/A>
- final HEAD: <sha>
- upstream: <sha>
- push_status: PUSHED
- worktree_clean: true|false

RELEASE: NOT APPLICABLE

NEXT: PHASE 2 — STEP 2.12A — PAYMENT PROVIDER ABSTRACTION
```

If evidence is insufficient, final response must instead clearly say `BLOCKED` and preserve the checker failure.

---

# 26. HARD STOP

After:

- forensic audit;
- conditional retrospective reconstruction;
- Roadmap repair;
- WARN classification;
- checker tests;
- real checker rerun with **0 FAIL**;
- remediation report;
- explicit staging;
- commit;
- push;
- upstream verification;
- final provenance footer;

**STOP.**

Do not start Step 2.12A.

Do not start Step 2.17.

Do not repair unrelated technical debt.

Do not refactor `sales.service.ts`.

The next implementation step begins only in a separate pass.
