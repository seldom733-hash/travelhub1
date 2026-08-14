# TRAVELHUB — ROADMAP ARTIFACT INTEGRITY CHECK & PROVENANCE AUTOMATION

## 0. MODE

**REPOSITORY TOOLING / DOCUMENTATION HARDENING · NO BUSINESS FEATURE IMPLEMENTATION**

This pass exists to prevent Roadmap statuses and evidence references from drifting away from the actual repository.

The immediate trigger is the Step 2.10B provenance incident:

- implementation and review fixes were genuinely committed;
- the dedicated Strict Review report artifact was missing;
- Roadmap nevertheless referenced review evidence;
- a later forensic audit was required to distinguish missing implementation from missing report provenance.

A prospective `REPOSITORY EVIDENCE` convention now exists. This pass must add a practical, repeatable artifact-integrity check so future Roadmap evidence claims can be verified automatically.

This is **not Step 2.12A**.

---

# 1. PRIMARY OBJECTIVE

Create a repository-level artifact integrity checker that validates, as far as repository evidence allows, that Roadmap claims point to real artifacts.

At minimum it must detect:

1. Roadmap references to missing files;
2. APPROVED steps whose referenced implementation report is missing;
3. APPROVED steps whose referenced Strict Review report is missing;
4. references to a Strict Review **prompt** where a Strict Review **report** is claimed as evidence;
5. referenced architecture docs that do not exist;
6. referenced migrations that do not exist;
7. referenced e2e/unit test files that do not exist when explicit paths/names are claimed;
8. malformed or missing `REPOSITORY EVIDENCE` footer for **new/prospective** reports where the convention applies;
9. obvious mismatch between `PERSISTED @ SHA` / `persistence_sha` claims and Git object existence;
10. evidence references that escape the repository or use ambiguous/non-canonical paths.

The checker must fail loudly and return non-zero when hard integrity violations are found.

---

# 2. REPOSITORY-FIRST DISCOVERY — HARD GATE

Before implementing anything, inspect the actual repository.

Locate and read:

- canonical Roadmap v3;
- `README.md`;
- `docs/prompts/REPOSITORY_EVIDENCE_FOOTER_TEMPLATE.md`;
- Step 2.10B retrospective reconstruction report;
- Step 2.10B remediation report;
- several known-good implementation reports;
- several known-good Strict Review reports;
- `.github/workflows/**`;
- root/backend/frontend `package.json` files;
- repository scripts/tooling directories;
- current branch/HEAD/origin state.

Determine the repository's existing scripting conventions before choosing Node/TypeScript/JavaScript/shell/Python.

Prefer existing project tooling.

Do not introduce a new runtime dependency merely for this checker unless strictly necessary.

---

# 3. CANONICAL ROADMAP

Determine the canonical Roadmap path from the repository.

Expected historical path:

`docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`

Do not hardcode this expectation without verifying it.

If multiple Roadmaps exist, fail closed until the canonical one is deterministically identified from repository evidence.

---

# 4. SCOPE OF PARSING

The checker does **not** need to understand arbitrary natural language perfectly.

Use conservative extraction.

Recognize explicit repository-like references such as:

- `docs/...`
- `backend/...`
- `frontend/...`
- `.github/...`
- migration directory names;
- `*.md`;
- `*.ts`;
- `*.e2e-spec.ts`;
- `*.spec.ts`;
- explicit report names;
- explicit architecture-document names.

Normalize:

- Markdown backticks;
- escaped underscores;
- Windows vs POSIX separators where appropriate;
- harmless punctuation around paths.

Never silently guess a missing file from a vaguely similar filename.

---

# 5. APPROVED STEP CHECK

For every Roadmap step carrying an approval marker equivalent to:

- `APPROVED`;
- `APPROVED WITH REVIEW FIXES`;
- `STRICT REVIEW COMPLETED — APPROVED`;
- `STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`;

collect the explicit evidence references contained in that step.

Classify each evidence item:

- `IMPLEMENTATION_REPORT`
- `STRICT_REVIEW_REPORT`
- `STRICT_REVIEW_PROMPT`
- `ARCHITECTURE_DOC`
- `MIGRATION`
- `TEST`
- `ADR`
- `OTHER`

Do not assume every historical step necessarily contains every category.

The checker validates **claims actually made**, and applies stronger prospective requirements only where the provenance convention says they apply.

---

# 6. PROMPT ≠ REPORT RULE

Hard rule:

A file whose purpose/name is a Strict Review prompt must not satisfy a claim that a Strict Review **report** exists.

Example distinction:

`...STRICT_REVIEW.md`
≠
`...STRICT_REVIEW_REPORT.md`

If Roadmap wording says "report", "отчёт", "review report", or equivalent and only a prompt exists:

**HARD FAIL**.

The Step 2.10B retrospective report now legitimately closes this historical gap and must pass.

---

# 7. FILE EXISTENCE VALIDATION

For every explicit repository artifact reference:

- resolve relative to repository root;
- require that it exists;
- require expected type where practical;
- reject directory traversal outside repository;
- report exact Roadmap line/step;
- report referenced path;
- report classification;
- report failure reason.

Do not auto-create missing evidence files.

---

# 8. MIGRATION VALIDATION

When Roadmap/report explicitly names a migration:

- verify the migration directory exists;
- verify `migration.sql` exists where Prisma convention requires it;
- do not infer successful deployment merely from file existence.

If a step claims a migration count such as `56/56`, classify it as a historical/runtime claim unless independently machine-verifiable in the current environment.

Do not fabricate historical verification.

---

# 9. TEST ARTIFACT VALIDATION

If Roadmap/report explicitly names:

- an e2e suite;
- a unit spec;
- a test filename;

verify the corresponding file exists.

Do not treat numeric counts such as `1134/1134` as proof that a test file exists.

Do not require rerunning all tests merely to perform static artifact integrity validation.

---

# 10. REPOSITORY EVIDENCE FOOTER

Read the canonical footer template rather than duplicating a competing format.

Expected fields may include:

- repository;
- branch;
- head;
- origin;
- worktree_clean;
- migration_count;
- reviewed_state;
- reviewed_diff_base;
- reviewed_diff_head;
- persistence_status;
- persistence_sha.

Determine from the template which are mandatory.

For reports created after adoption of the convention:

- verify the footer exists;
- verify required fields exist;
- validate obvious enum/state syntax;
- if `persistence_status: PERSISTED`, require a non-N/A SHA;
- verify the SHA resolves with Git.

Do **not** mass-fail historical reports that predate the convention unless the convention explicitly requires retroactive compliance.

---

# 11. GIT SHA VALIDATION

For claimed persistence SHA:

```bash
git cat-file -e <sha>^{commit}
```

or equivalent safe Git plumbing.

If the SHA does not resolve to a commit:

**HARD FAIL**.

If `persistence_status: NOT_PERSISTED`, do not require a commit SHA.

Do not contact external services just to validate local commit existence.

---

# 12. ORIGIN / REMOTE CLAIMS

If a report claims:

`PUSHED TO origin/<branch> @ <SHA>`

and the relevant remote ref is locally available, verify it.

If remote verification would require network access and is unavailable, classify:

`NOT VERIFIED — REMOTE ACCESS UNAVAILABLE`

Do not turn inability to contact a remote into a fabricated PASS.

---

# 13. OUTPUT FORMAT

The checker must produce a human-readable report similar to:

```text
TravelHub Roadmap Artifact Integrity Check

Roadmap: docs/prompts/...
Approved steps scanned: N
Explicit artifact references: N

PASS: N
WARN: N
FAIL: N

[PASS] Step 2.10B STRICT_REVIEW_REPORT
       docs/prompts/PHASE_2_STEP_2.10B_..._STRICT_REVIEW_REPORT.md

[FAIL] Step X ARCHITECTURE_DOC
       docs/architecture/missing-file.md
       reason: referenced file does not exist

[WARN] Step Y HISTORICAL_TEST_COUNT
       1055/1055
       reason: historical runtime claim; not independently verified by static checker
```

Also support a machine-readable format if practical, preferably JSON.

---

# 14. EXIT CODES

Minimum contract:

- `0` — no hard failures;
- non-zero — at least one hard integrity failure or checker execution error.

If distinguishing execution errors from integrity failures is easy:

- `1` — integrity failures;
- `2` — checker/configuration error.

Document exact behavior.

---

# 15. COMMAND / SCRIPT LOCATION

Choose a repository-appropriate location after discovery.

Acceptable examples:

- `scripts/check-roadmap-artifacts.*`
- `tools/check-roadmap-artifacts.*`
- existing tooling directory.

Do not put business logic into backend application services.

---

# 16. PACKAGE SCRIPT

Where appropriate, add an explicit command from the correct package/tooling root, e.g.:

```bash
npm run check:roadmap-artifacts
```

But remember:

**the repository root is not currently an npm package unless repository evidence now proves otherwise.**

Do not "fix" that by inventing a root `package.json` in this pass.

If no appropriate package root exists, document the direct invocation.

---

# 17. CI INTEGRATION — IMPORTANT BOUNDARY

The repository has a known broken/stale CI configuration owned by the later Platform Hardening work.

Therefore:

- create the checker so it can later be called from CI;
- do **not** redesign/fix the entire CI pipeline here;
- do not claim CI enforcement if CI itself remains broken;
- optionally add a narrowly isolated check only if it can be proven not to entangle the known CI debt.

Default: **tooling now, full CI enforcement at Step 2.17**.

Document this dependency explicitly.

---

# 18. LEGACY BOUNDARY

The checker must operate on the canonical current TravelHub repository.

Do not let `legacy/` satisfy missing current-runtime artifacts.

If an evidence path resolves only under `legacy/` while Roadmap claims current TravelHub evidence:

**FAIL** or explicit mismatch.

Do not delete/move `legacy/` in this pass.

Legacy isolation remains owned by Step 2.17.

---

# 19. SALES SERVICE BOUNDARY

Do not refactor `sales.service.ts`.

This pass is unrelated to Sales structural debt.

If current Roadmap still lacks an explicit owner for broad SalesService decomposition, mention that as an observation only.

Do not silently assign it to this checker step.

---

# 20. STEP 2.12A BOUNDARY

Do not start:

`PHASE 2 — STEP 2.12A — PAYMENT PROVIDER ABSTRACTION`

No PSP abstractions, adapters, webhooks, payment provider code, schema, migrations or API changes belong here.

After successful completion, Roadmap NEXT must remain 2.12A unless current canonical Roadmap proves otherwise.

---

# 21. TESTS FOR THE CHECKER

Add focused tests/fixtures for at least:

1. existing file → PASS;
2. missing file → FAIL;
3. prompt used as report → FAIL;
4. path traversal → FAIL;
5. valid persisted SHA → PASS;
6. nonexistent persisted SHA → FAIL;
7. historical report without prospective footer → allowed according to adoption boundary;
8. new report requiring footer but missing it → FAIL;
9. `NOT_PERSISTED` with no SHA → valid;
10. legacy-only artifact cannot satisfy canonical reference;
11. malformed Roadmap reference does not crash checker;
12. Step 2.10B reconstructed report passes.

Avoid modifying real Roadmap fixtures destructively.

---

# 22. BASELINE RUN

Run the checker against the real canonical Roadmap.

If failures are found:

- do not silently repair dozens of historical files;
- classify each;
- determine whether it is a real provenance gap, stale reference, parser false positive, or pre-convention historical exception;
- fix only obvious checker defects in this pass;
- leave genuine repository documentation defects visible in the report unless explicitly within the narrow remediation scope.

The goal is trustworthy detection, not forcing a green result by weakening rules.

---

# 23. DOCUMENTATION

Document:

- purpose;
- invocation;
- what counts as PASS/WARN/FAIL;
- prospective provenance boundary;
- prompt-vs-report rule;
- migration/test limitations;
- Git SHA validation;
- CI integration deferred to Step 2.17;
- legacy boundary.

Prefer one concise tooling doc over redundant documentation.

---

# 24. REQUIRED IMPLEMENTATION REPORT

Create:

`docs/prompts/TRAVELHUB_ROADMAP_ARTIFACT_INTEGRITY_CHECK_IMPLEMENTATION_REPORT.md`

Include:

1. Verdict
2. Repository baseline
3. Canonical Roadmap discovered
4. Existing provenance convention
5. Checker design
6. Artifact classifications
7. Approved-step detection
8. Prompt-vs-report rule
9. Path validation
10. Migration validation
11. Test artifact validation
12. Evidence footer validation
13. Git SHA validation
14. Legacy boundary
15. CI boundary
16. Checker tests
17. Real Roadmap baseline run
18. PASS/WARN/FAIL findings
19. Any genuine gaps discovered
20. Files changed
21. Git persistence evidence
22. Exact NEXT
23. Final verdict

---

# 25. NEGATIVE CHECKS

Before completion prove:

- business production code changes = 0;
- Prisma schema changes = 0;
- migrations added/changed = 0;
- Payment/Refund/Commission runtime changes = 0;
- CI redesign = 0;
- legacy deletion/move = 0;
- SalesService refactor = 0;
- Step 2.12A changes = 0;
- no missing artifacts auto-created except documentation belonging to this checker itself;
- no historical claims fabricated;
- no Roadmap statuses upgraded merely to make checker green.

---

# 26. SUCCESS VERDICT

If checker is implemented, tested and baseline executed:

`TRAVELHUB ROADMAP ARTIFACT INTEGRITY CHECK IMPLEMENTED — AUTOMATED PROVENANCE GUARD AVAILABLE`

If genuine integrity failures remain, this verdict is still allowed only with explicit suffix:

`— BASELINE GAPS DETECTED`

and all gaps must be enumerated.

If checker cannot reliably identify canonical evidence:

`TRAVELHUB ROADMAP ARTIFACT INTEGRITY CHECK BLOCKED — EVIDENCE MODEL AMBIGUOUS`

---

# 27. GIT PERSISTENCE GATE — REQUIRED

After all checks pass or all remaining baseline gaps are explicitly documented, persist **only this step's files**.

## 27.1 Pre-commit inspection

Run:

```bash
git status --short
git diff --stat
git diff
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
```

Identify unrelated dirty/untracked files.

Do not stage them.

## 27.2 Explicit staging only

**FORBIDDEN:**

```bash
git add .
git add -A
```

Stage only files created/modified by this artifact-integrity step:

```bash
git add <explicit-file-1> <explicit-file-2> ...
```

Then verify:

```bash
git diff --cached --stat
git diff --cached
git status --short
```

If staged diff contains unrelated files:

**STOP and unstage only the unrelated files safely.**

## 27.3 Commit

Use a scoped message, for example:

```bash
git commit -m "chore(docs): add roadmap artifact integrity guard"
```

Record:

```bash
git rev-parse HEAD
```

## 27.4 Push

Determine current branch and configured upstream.

If upstream exists:

```bash
git push
```

If no upstream exists, use the verified current branch:

```bash
git push -u origin <current-branch>
```

Do not force push.

Forbidden:

```bash
git push --force
git push --force-with-lease
```

## 27.5 Post-push verification

Run:

```bash
git status --short
git rev-parse HEAD
git branch --show-current
git rev-parse --verify @{u}
```

Where possible also verify:

```bash
git rev-parse HEAD
git rev-parse @{u}
```

HEAD and upstream must match for `PUSHED` status.

Unrelated pre-existing untracked files may remain; do not falsely report `worktree_clean: true` if they do.

---

# 28. REPOSITORY EVIDENCE — REQUIRED IN FINAL REPORT

Populate the canonical footer from:

`docs/prompts/REPOSITORY_EVIDENCE_FOOTER_TEMPLATE.md`

At minimum report actual values for:

```text
REPOSITORY EVIDENCE
branch: <actual>
head: <actual SHA>
origin/upstream: <actual SHA or unavailable>
worktree_clean: true|false
reviewed_state: COMMIT
persistence_status: PERSISTED
persistence_sha: <actual SHA>
push_status: PUSHED | NOT_PUSHED | PUSH_FAILED
```

Never claim `PUSHED` unless verified.

---

# 29. RELEASE GATE

There is **no production release/deploy** in this step.

This is repository tooling/documentation hardening.

Final release status:

`RELEASE: NOT APPLICABLE`

Do not deploy backend/frontend/database.

---

# 30. HARD STOP

After:

- checker implementation;
- checker tests;
- real Roadmap baseline run;
- implementation report;
- explicit-file commit;
- push and persistence verification;

**STOP.**

Do not start Step 2.12A in the same pass.

Final response must include:

- verdict;
- baseline PASS/WARN/FAIL totals;
- any unresolved integrity gaps;
- commit SHA;
- push status;
- exact NEXT.

Expected NEXT, subject to verification against canonical Roadmap:

`PHASE 2 — STEP 2.12A — PAYMENT PROVIDER ABSTRACTION`
