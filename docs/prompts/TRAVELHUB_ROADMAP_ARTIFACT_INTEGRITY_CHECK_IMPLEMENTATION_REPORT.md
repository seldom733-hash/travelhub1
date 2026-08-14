# TRAVELHUB — ROADMAP ARTIFACT INTEGRITY CHECK — IMPLEMENTATION REPORT

## 1. Verdict

**`TRAVELHUB ROADMAP ARTIFACT INTEGRITY CHECK IMPLEMENTED — AUTOMATED PROVENANCE GUARD AVAILABLE — BASELINE GAPS DETECTED`**

The checker is implemented, tested (13/13), and executed against the real
canonical Roadmap. It correctly detected **1 genuine baseline provenance gap**
(Step 2.7 strict-review report missing; prompt cited as report) and 2
pre-convention historical WARN candidates. Per prompt §22, genuine repository
documentation defects are left visible (not silently repaired in this pass).

## 2. Repository baseline

- Branch `master`; HEAD = origin/master = `3b10e8e` (provenance reconstruction release).
- Node `v24.18.0`; root is **not** an npm package (no root `package.json`).
- `scripts/` directory exists (previously empty) — chosen as tooling location.
- `backend/package.json` scripts: `test: jest --runInBand`, no engines constraint.
- CI: `.github/workflows/ci.yml` remains the known broken/stale workflow — **not touched**; integration deferred to Step 2.17.
- Worktree: 4 untracked prompt files (2.12A, 2.17, audit, this prompt) — unrelated, not staged.

## 3. Canonical Roadmap discovered

`docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` — verified as the
only canonical roadmap (README + docs references + prior audit). No competing
roadmap file. Parser handles three entry shapes: `· **Step …` bullets
(canonical), `NN. **STEP …`/`NNA. **PHASE …` numbered log lines, and
`**Статус: …` phase-status lines.

## 4. Existing provenance convention

`docs/prompts/REPOSITORY_EVIDENCE_FOOTER_TEMPLATE.md` (committed `3b10e8e`) defines
the REPOSITORY EVIDENCE footer, status semantics (`PERSISTED @ SHA`), the future
approval rule, and the artifact-existence check. The checker consumes that
convention (fields, enums, prospective boundary) rather than duplicating it.

## 5. Checker design

- Location: `scripts/check-roadmap-artifacts.mjs` — ESM, **zero new dependencies**
  (node:fs / node:path / node:child_process / node:url only), CLI + importable
  `runCheck({ rootDir, roadmapPath })` for tests.
- CLI: `node scripts/check-roadmap-artifacts.mjs [--roadmap <path>] [--json]`.
- Parsing: entry-block splitting (canonical / log / status), approved-marker
  detection (`✅ APPROVED`, `APPROVED WITH REVIEW FIXES`,
  `STRICT REVIEW COMPLETED — APPROVED`, `APPROVED (`) with BLOCKED exclusion;
  backtick token + bare report-name extraction; whitespace-token guard (no crash).
- Reference resolution: repo-relative path resolution with traversal rejection
  (absolute paths, `..`, escaping root); migration name matching against
  `backend/prisma/migrations` (+`migration.sql`); test name matching against
  `backend/test`; bare `.md` names resolved under `docs/prompts` + `docs/architecture`.
- Content-based strict-review kind detection (`fileKind`): a file named
  `…_STRICT_REVIEW.md` is classified REPORT if it contains a standalone verdict /
  `## 1. Verdict` / REPOSITORY EVIDENCE footer, PROMPT if it contains template
  markers (Hard stop / STOP section / mission) without a verdict. This prevents
  historical prompt/report naming collisions from false-failing.
- Output: human-readable report + `--json`; exit codes `0` (no hard failures),
  `1` (integrity failures), `2` (checker/config error).

## 6. Artifact classifications

`STRICT_REVIEW_REPORT`, `STRICT_REVIEW_PROMPT`, `IMPLEMENTATION_REPORT`,
`REPORT` (generic report name), `ARCHITECTURE_DOC`, `MIGRATION`, `TEST_E2E`,
`TEST_UNIT`, `ADR`, `DOC`, `HISTORICAL_TEST_COUNT` (WARN), `OTHER` (skipped).

## 7. Approved-step detection

59 approved steps scanned on the real Roadmap. Markers are case-sensitive status
patterns (not free `APPROVED` word matches) so prose like «not approved yet» does
not trigger; `⛔ BLOCKED` / `ARCHITECTURE DECISION REQUIRED` steps are excluded.

## 8. Prompt-vs-report rule

Hard rule implemented: a content-classified PROMPT file cannot satisfy a claim
that a Strict Review REPORT exists (`…_STRICT_REVIEW.md` ≠ `…_STRICT_REVIEW_REPORT.md`).
Applied as **FAIL** for canonical bullets and `**Статус:` phase-status entries;
**WARN** for pre-convention numbered-log lines (historical naming exception,
§10/§22). Step 2.10B retrospective report passes (test 12).

## 9. Path validation

Path-looking references resolved against repo root; absolute paths, `..`
traversal, and escape-beyond-root → FAIL. Legacy paths (`legacy/`) → FAIL for
approved canonical claims (cannot satisfy current-runtime evidence), WARN
otherwise. No auto-creation of missing files.

## 10. Migration validation

Explicit migration names (`add_…`, `20{12}_…` or full dir names) verified against
`backend/prisma/migrations`; `migration.sql` presence checked. Historical runtime
counts (`49/49`, `56/56`…) classified as `HISTORICAL_TEST_COUNT` WARN — file
existence, not deployment, is verified (no fabricated runtime claims).

## 11. Test artifact validation

Explicit test paths / names (`.e2e-spec.ts`, `.spec.ts`) verified against
`backend/test`. Numeric counts (`1134/1134`…) are never treated as proof of a
test file; they surface as WARN historical claims.

## 12. Evidence footer validation

Reports classified as REPORT/STRICT_REVIEW_REPORT/IMPLEMENTATION_REPORT that opt
into the new format (contain `persistence_status:`, `reviewed_state:`, or
`RETROSPECTIVE EVIDENCE RECONSTRUCTION`) are checked: footer block present, all
required fields present, enum syntax valid, `PERSISTED` requires non-N/A
resolvable SHA, `NOT_PERSISTED` requires no SHA. Historical reports without
new-format markers are exempt (prospective boundary). Test 8 (footer missing →
FAIL) and test 9 (NOT_PERSISTED valid) cover this.

## 13. Git SHA validation

`git cat-file -e <sha>^{commit}` (plumbing, no network). `PERSISTED` +
non-resolving SHA → FAIL (test 6); valid SHA → PASS (test 5); `NOT_PERSISTED` →
no SHA required (test 9). Remote claims not validated (no network dependency).

## 14. Legacy boundary

`legacy/` references cannot satisfy canonical evidence claims (FAIL for approved
steps; WARN otherwise). `legacy/` not deleted/moved. Test 10 covers this.

## 15. CI boundary

Checker is CLI-callable for future CI, but CI itself is **not** modified:
`.github/workflows/ci.yml` remains the known broken/stale workflow owned by
`PHASE 2 — STEP 2.17 — PLATFORM HARDENING GATE`. Full CI enforcement deferred to
Step 2.17 (documented dependency).

## 16. Checker tests

`scripts/check-roadmap-artifacts.test.mjs` — `node:test`, 13/13 pass:

1. existing file → PASS; 2. missing file → FAIL; 3. prompt as report → FAIL;
4. path traversal → FAIL; 5. valid persisted SHA → PASS; 6. nonexistent SHA → FAIL;
7. historical report without footer → allowed; 8. new report missing footer → FAIL;
9. NOT_PERSISTED no SHA → valid; 10. legacy-only → FAIL; 11. malformed refs → no
crash (exit ≠ 2); 12. Step 2.10B reconstructed report passes against real Roadmap;
smoke: real Roadmap scans ≥10 approved steps / ≥50 references.

Fixtures: `scripts/test/fixtures/{roadmap-good,roadmap-missing,roadmap-prompt-as-report,
roadmap-traversal,roadmap-sha,roadmap-footer-missing,roadmap-notpersisted,roadmap-malformed}.md`
+ `scripts/test/fixtures/root/**` (fake repo tree incl. migration + test + legacy).

## 17. Real Roadmap baseline run

Command: `node scripts/check-roadmap-artifacts.mjs` (canonical Roadmap, exit 1).

## 18. PASS/WARN/FAIL findings

- **PASS: 89** — all explicit report/arch/migration/test references in approved
  steps resolve; 2.10B reconstructed report (footer + `aeece37` SHA) passes;
  2.8/2.8A `…_STRICT_REVIEW.md` files content-classified REPORT (verdict present)
  → correctly PASS despite prompt-like names.
- **WARN: 2** — pre-convention numbered-log citations of prompt files as reports:
  Step 2.7 (`26. STEP 2.7 — STRICT REVIEW`), Step 2.9 (`29B. …`). Genuine gap
  candidates, historical naming exception; left visible per §10/§22.
- **FAIL: 1 (genuine baseline gap)** — `**Статус:` phase-status entry for Step 2.7
  cites `PHASE_2_STEP_2.7_ORDER_LIFECYCLE_COMPLETION_STRICT_REVIEW.md` as «отчёт»,
  but that file is content-classified PROMPT (Hard stop / STOP section, no verdict).
  Same gap class as the 2.10B incident: Step 2.7 strict-review **report artifact
  is missing** while implementation/status/fixes exist.

## 19. Any genuine gaps discovered

1. **Step 2.7 strict-review report missing** (FAIL). Roadmap phase-status line
   (≈ line 539) and log line 26 cite the prompt file as the report. The review was
   evidently performed (status APPROVED WITH REVIEW FIXES, fixes committed in
   `1bc19b7`), but no dedicated report file exists. Recovery candidate: same
   retrospective-reconstruction treatment as 2.10B (separate approved docs pass;
   NOT performed here).
2. **Step 2.9 strict-review report missing** (WARN, log-line citation only).
   Same class; no phase-status citation found. Same recovery candidate.
3. No parser false positives: every FAIL/WARN traced to a real Roadmap line.

## 20. Files changed

- `scripts/check-roadmap-artifacts.mjs` (new — checker)
- `scripts/check-roadmap-artifacts.test.mjs` (new — 13 tests)
- `scripts/test/fixtures/*.md` (new — 8 roadmap fixtures)
- `scripts/test/fixtures/root/**` (new — fake repo tree: 6 report docs, migration,
  e2e spec, legacy pkg)
- `docs/prompts/TRAVELHUB_ROADMAP_ARTIFACT_INTEGRITY_CHECK_IMPLEMENTATION_REPORT.md` (this report)

No production code, schema, migrations, tests, CI, or Roadmap statuses changed.

## 21. Git persistence evidence

See REPOSITORY EVIDENCE footer below (populated post-commit per §27).

## 22. Exact NEXT

`PHASE 2 — STEP 2.12A — PAYMENT PROVIDER ABSTRACTION` — verified in current
Roadmap (2.12E dependency graph: NEXT = STEP 2.12A). Not started in this pass.

## 23. Final verdict

**`TRAVELHUB ROADMAP ARTIFACT INTEGRITY CHECK IMPLEMENTED — AUTOMATED PROVENANCE GUARD AVAILABLE — BASELINE GAPS DETECTED`**

Gaps enumerated in §19. Checker is the repeatable provenance guard; CI
enforcement at Step 2.17; baseline gap remediation (2.7/2.9 report reconstruction)
is a separate approved documentation-only pass.

```text
REPOSITORY EVIDENCE
branch: master
head: <populated after commit per §27>
origin/upstream: <populated after commit>
worktree_clean: false (unrelated untracked prompt files remain)
reviewed_state: COMMIT
persistence_status: PERSISTED
persistence_sha: <populated after commit>
push_status: <populated after commit>
```
