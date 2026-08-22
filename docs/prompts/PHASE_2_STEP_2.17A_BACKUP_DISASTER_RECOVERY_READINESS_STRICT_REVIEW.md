# PHASE 2 — STEP 2.17A — BACKUP & DISASTER RECOVERY READINESS — STRICT REVIEW

## 0. MODE

**INDEPENDENT ADVERSARIAL STRICT REVIEW · REPOSITORY-FIRST · TARGET ≠ CAPABILITY ≠ VERIFIED CAPABILITY · NO NEXT-STEP IMPLEMENTATION · REVIEW FIXES ALLOWED · PERSISTENCE REQUIRED**

Review the full persisted state of:

`PHASE 2 — STEP 2.17A — BACKUP & DISASTER RECOVERY READINESS`

including:

- technical implementation;
- backup/restore scripts;
- restore drill evidence;
- architecture/runbook;
- RPO/RTO/retention authority decision;
- Roadmap status;
- provenance/persistence.

Do not trust implementation or decision reports at face value. Verify actual repository state, scripts, commands, migrations, docs and runtime behavior.

---

# 1. PRIMARY REVIEW QUESTION

Can Step 2.17A be approved **without falsely claiming that TravelHub production infrastructure already satisfies the approved recovery objectives**?

Approved authority currently expected:

```text
PostgreSQL RPO ≤ 1 hour
PostgreSQL RTO ≤ 4 hours
Media/Object Storage RPO ≤ 24 hours
Media/Object Storage RTO ≤ 8 hours
Daily backup retention = 30 days
Monthly backup retention = 12 months
```

These are targets.

Strict Review must independently verify the distinction:

```text
APPROVED TARGET
≠
IMPLEMENTED CAPABILITY
≠
VERIFIED CAPABILITY
```

If current implementation only proves local technical recoverability, the review must not upgrade that to verified production compliance.

---

# 2. ALLOWED VERDICTS

Use exactly one:

`PHASE 2 STEP 2.17A STRICT REVIEW COMPLETED — APPROVED`

`PHASE 2 STEP 2.17A STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

`PHASE 2 STEP 2.17A STRICT REVIEW BLOCKED — PRODUCTION CAPABILITY GAP`

`PHASE 2 STEP 2.17A STRICT REVIEW FAILED — REOPEN IMPLEMENTATION`

No unresolved CRITICAL/HIGH finding may be approved.

Any unresolved hard-gate capability required by the canonical Roadmap must block approval.

---

# 3. REPOSITORY BASELINE

Before review:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -30
```

Verify:

- Step 2.17 approved;
- Step 2.17A technical implementation persisted;
- authority decision persisted;
- current HEAD/upstream;
- migration count;
- Roadmap status;
- current artifact-integrity baseline;
- unrelated untracked prompts.

Do not trust supplied SHAs without repository proof.

---

# 4. REVIEWED SHA RANGE

Determine the true pre-2.17A base SHA.

Review the complete diff:

```text
pre-2.17A base
→ current persisted 2.17A technical + authority decision state
```

Inspect all changed:

- scripts;
- tests;
- docs;
- Roadmap;
- `.gitignore`;
- package scripts if any;
- operational helpers;
- reports;
- provenance/footer changes.

Review fixes made now become part of the final reviewed state.

---

# 5. CANONICAL ACCEPTANCE MATRIX

Build:

| Requirement | Canonical source | Hard/soft/deferred | Implementation evidence | Runtime evidence | Verdict |
|---|---|---|---|---|---|

At minimum cover:

- PostgreSQL whole-DB backup;
- multi-schema coverage;
- checksum;
- isolated restore;
- restore target safety;
- migration preservation;
- outbox/inbox preservation;
- finance preservation;
- object-storage recovery contract;
- DB/object non-atomicity;
- secrets/config recovery boundary;
- RPO/RTO authority;
- retention authority;
- PITR/equivalent capability;
- immutability/off-account protection;
- monitoring/failure visibility;
- restore drill evidence;
- production compliance semantics.

Implementation reports may not redefine the Roadmap.

---

# 6. POSTGRESQL BACKUP CONTRACT — CRITICAL

Inspect `backend/scripts/dr-backup.mjs` or actual path.

Verify:

- uses PostgreSQL-native backup;
- whole canonical DB, not selected tables;
- all canonical schemas included;
- schema + data retained as intended;
- migration history included;
- sequences/indexes/constraints preserved by chosen format;
- credentials only from env;
- output path safe;
- checksum generated correctly;
- process exits non-zero on failure;
- URL/secrets redacted;
- backup artifacts gitignored;
- no `db push`.

Add unit/integration tests where evidence is weak.

---

# 7. MULTI-SCHEMA COVERAGE

Independently enumerate actual canonical PostgreSQL schemas from repository/runtime.

Prove the backup includes all of them.

Do not accept hardcoded "11 schemas" unless current repository truth confirms it.

If schema count changed and scripts/docs are stale, fix during review.

---

# 8. SNAPSHOT CONSISTENCY

Verify what `pg_dump` format/options actually guarantee under concurrent writes.

Review must answer:

- one consistent PostgreSQL snapshot?
- cross-schema consistency?
- concurrent writes behavior?
- whether application downtime is required?
- whether long-running transaction caveats exist?

Do not claim cross-system atomicity with object storage.

---

# 9. CHECKSUM / ARTIFACT INTEGRITY

Verify:

- SHA-256 or actual algorithm;
- checksum produced after successful backup;
- checksum sidecar naming;
- restore refuses mismatch;
- truncated/corrupt backup is detected;
- sidecar missing → fail closed;
- checksum output contains no secret.

Add adversarial tests for tampered backup/sidecar if not already present.

---

# 10. RESTORE TARGET SAFETY — CRITICAL HARD GATE

Inspect `dr-restore-drill.mjs`.

Adversarially test obvious dangerous targets:

- canonical dev DB name;
- production-like suffix/prefix;
- `postgres`;
- `template0`;
- `template1`;
- malformed name;
- missing explicit confirmation;
- production-ish URL;
- DB with dangerous encoded/name variants if relevant.

The safety check must execute **before destructive operations**.

Any credible path to restoring/dropping a production DB is CRITICAL.

Do not weaken guards to make tests easier.

---

# 11. ISOLATED RESTORE DRILL — CRITICAL

Independently run the restore drill against an isolated recovery DB.

Record actual:

```text
source DB classification
backup format
backup size
checksum
restore target
safety guard result
backup duration
restore duration
verification duration
schemas restored
migration history
integrity checks
smoke checks
cleanup
```

Do not reuse the implementation report's numbers as proof.

---

# 12. MIGRATION HISTORY / SCHEMA COMPATIBILITY

Verify all current canonical migrations exist after restore.

Review safe behavior for:

```text
backup schema == deployed code
backup schema older than deployed code
backup schema newer than deployed code
```

The "DB newer than code" case must fail safe.

Do not blindly run migrations without determining restored DB state.

---

# 13. FINANCE STATE — CRITICAL HARD GATE

Verify current implemented Finance/accounting facts survive round-trip restore exactly.

At minimum inspect actual models present for:

- Payment;
- Refund;
- Invoice;
- Commission;
- CommissionAccrual;
- LedgerTransaction;
- ProviderFee;
- Settlement;
- Payout;
- ExternalIdempotencyRecord;
- Dispute or other current Finance models if present.

Prove:

- IDs preserved;
- Decimal values preserved exactly;
- statuses preserved;
- source links preserved;
- uniqueness constraints preserved;
- historical facts are not regenerated from current mutable policy.

If practical, seed targeted known values before test backup and assert exact values after restore.

---

# 14. EVENTBUS STATE — CRITICAL HARD GATE

Verify restore preserves:

- PENDING OutboxEvent;
- retryable FAILED;
- exhausted/poison;
- PUBLISHED;
- InboxEvent dedup records;
- attempts/error metadata;
- causation/correlation.

Then prove restored application does not duplicate committed business effects.

Preserve actual delivery semantic:

`at-least-once delivery + authoritative Inbox/consumer idempotency`

Never claim exactly-once.

---

# 15. SECURITY STATE

Verify `tokenVersion` and other current auth/security state survive restore.

A restored DB must not accidentally:

- revive revoked JWTs;
- reset security counters/version;
- drop permissions/roles;
- remove revocation state.

Add targeted verification if absent.

---

# 16. EXTERNAL IDEMPOTENCY STATE

Verify `ExternalIdempotencyRecord` and relevant uniqueness/state survive restore.

A restored system must not allow a previously committed request to create a duplicate business Payment merely because the idempotency record was lost/corrupted.

---

# 17. OBJECT STORAGE — HARD GATE

Inspect actual object-storage use.

Classify current state:

- authoritative non-reconstructable objects;
- reconstructable objects;
- dev-only objects;
- provider-neutral future production storage.

Strict Review must answer:

> Does current Step 2.17A approval mean media production RPO/RTO capability is verified?

Expected likely answer may be **NO** if no production provider capability exists.

That is acceptable only if canonical Roadmap defines Step 2.17A as readiness/contract rather than proof of deployed production capability.

If Roadmap requires verified production capability, approval must block.

---

# 18. MEDIA RPO/RTO TARGET SEMANTICS

Approved:

```text
Media RPO ≤24h
Media RTO ≤8h
```

Verify docs do NOT state that current MinIO/dev configuration proves these targets.

If production provider is not selected/verified:

```text
target: APPROVED
production capability: NOT VERIFIED
```

must remain explicit.

---

# 19. DB ↔ OBJECT NON-ATOMICITY

Verify architecture/runbook clearly retains non-atomic cross-system snapshot semantics.

Review reconciliation procedures for:

- DB row → missing object;
- object → missing DB row;
- timestamp mismatch.

No false atomicity claim.

---

# 20. RPO AUTHORITY — POSTGRESQL

Verify target is consistently represented as:

`RPO ≤1h — APPROVED TARGET`

Then independently judge whether current technical capability is sufficient.

A local `pg_dump` alone does not prove RPO≤1h.

Review must identify actual production capability status:

- verified PITR;
- verified WAL/archive mechanism;
- equivalent verified provider mechanism;
- NOT VERIFIED.

Do not convert target into compliance.

---

# 21. RTO AUTHORITY — POSTGRESQL

Verify:

`RTO ≤4h — APPROVED TARGET`

The local ~seconds restore drill is not production RTO evidence.

Review must explicitly state what remains unverified:

- production DB size;
- backup location/network;
- recovery infrastructure;
- operator coordination;
- application recovery;
- validation;
- EventBus restart;
- dependent storage recovery.

---

# 22. PITR / EQUIVALENT

Verify exact status.

If not implemented/verified:

`PITR/equivalent: NOT VERIFIED`

That is acceptable only if Step 2.17A approval semantics permit target approval before infrastructure/provider verification.

If Step 2.17A requires proven production RPO capability, BLOCK.

Do not implement PITR in Strict Review unless a narrow review fix is both authorized and feasible without provider/infrastructure invention.

---

# 23. RETENTION AUTHORITY

Verify:

```text
daily = 30 days
monthly = 12 months
```

and distinguish:

- approved retention target;
- actual scheduled backup jobs;
- actual storage lifecycle;
- immutable retention;
- legal retention.

If no production scheduler/storage exists, docs must not claim retention is implemented.

---

# 24. IMMUTABILITY / OFF-ACCOUNT BACKUP

Review current status.

If missing:

- do docs say MISSING/provider-dependent?
- is this permitted before approval?
- does canonical Roadmap require it as a hard gate?

Classify.

If hard gate: BLOCK.

If future infrastructure requirement: approval may be allowed only with truthful capability-gap recording.

Do not invent immutable storage.

---

# 25. SECRETS / KEY RECOVERY

Verify secrets are excluded from ordinary backup artifacts.

Review whether DR has a credible source of recovery for:

- JWT signing secrets/keys;
- DB credentials;
- object-storage credentials;
- encryption keys if any;
- future PSP secrets.

If production secret-manager/key-recovery is absent, determine whether this is:

- hard gate;
- documented external infrastructure gap;
- later deployment prerequisite.

No false readiness claim.

---

# 26. BACKUP FAILURE VISIBILITY

Review whether backup scripts expose:

- failure exit code;
- artifact path;
- size;
- checksum;
- duration.

If monitoring/alerting is not implemented, determine whether Step 2.17A contract requires operational alerting now or only defines the contract.

Do not silently treat missing monitoring as complete if it was a hard gate.

---

# 27. BACKUP ARTIFACT SECURITY

Verify dumps are:

- gitignored;
- not accidentally staged;
- not logged in full;
- not world-readable by script design if controllable;
- not containing secrets beyond the DB content itself;
- treated as sensitive artifacts.

Search repository for accidentally committed `.dump`, `.backup`, `.sql`, checksum artifacts.

---

# 28. RANSOMWARE / CREDENTIAL-COMPROMISE SCENARIO

Review DR-10 or equivalent.

Verify current docs do not claim protection that does not exist.

If no immutable/off-account backup:

`capability gap: documented`

Determine whether canonical Step 2.17A can still be approved as readiness foundation.

---

# 29. RESTORE RUNBOOK QUALITY

Review runbook as if another engineer must execute it.

Check:

- prerequisites;
- commands;
- target validation;
- abort path;
- migration order;
- finance verification;
- EventBus recovery;
- object reconciliation;
- secrets/config;
- evidence capture;
- incident close criteria.

No hidden tribal knowledge required for the basic isolated restore drill.

---

# 30. WINDOWS / OPERATOR COMPATIBILITY

Project development environment includes Windows.

If scripts rely on Node + external PostgreSQL CLI, verify runbook clearly states prerequisites and Windows-compatible invocation.

Do not require Bash-only wrappers without alternative.

---

# 31. PRODUCTION-SAFE SCRIPT REVIEW

Audit child-process invocation and arguments.

Check:

- shell injection risk;
- URL handling;
- database name validation;
- environment inheritance;
- command quoting;
- Windows behavior;
- cleanup on failure;
- partial artifact handling;
- subprocess exit-code handling.

Add unit tests for dangerous edge cases if needed.

---

# 32. DR-1 … DR-12 MATRIX

Independently verify each documented failure scenario has truthful handling.

At minimum:

1. PostgreSQL loss
2. logical deletion
3. corrupt backup
4. newest backup unavailable
5. object storage loss
6. DB/media temporal mismatch
7. restart with PENDING/FAILED events
8. backup during active financial writes
9. lost secrets/keys
10. credential compromise/ransomware
11. migration mismatch
12. restore target accidentally production

No unsupported PITR/immutability claim.

---

# 33. CARD DATA / PCI NEGATIVE AUDIT

Repo-wide verify Step 2.17A introduced no storage/backup of:

- PAN;
- CVV/CVC;
- sensitive authentication data.

Backup design must not expand PCI scope.

---

# 34. PSP BOUNDARY

Verify Step 2.17A does not pretend to back up or control provider-owned payment/settlement systems.

ADR-0015 and provider selection remain untouched.

Provider-specific DR remains deferred until actual contract.

---

# 35. RLS / TENANT DATA RECOVERY

RLS remains deferred under ADR-0014.

Do not implement RLS.

Review whether isolated recovery DB guidance treats restored production-sensitive tenant data safely.

---

# 36. TEST QUALITY

Review DR script tests.

Reject false confidence from:

- pure source-string assertions where executable guard tests are feasible;
- tests that never reach actual guard logic;
- test-only bypasses;
- fake checksum validation;
- restore drill that does not really restore.

Add narrow adversarial tests if needed.

---

# 37. REQUIRED ADVERSARIAL TESTS

Add if missing:

1. restore target canonical DB rejected;
2. production-like target rejected;
3. template/postgres target rejected;
4. malformed DB name rejected;
5. missing `--yes` rejected;
6. missing checksum rejected;
7. corrupt checksum rejected;
8. backup command failure propagates;
9. restore command failure propagates;
10. cleanup executes safely after failed restore;
11. exact Decimal round-trip;
12. tokenVersion round-trip;
13. ExternalIdempotencyRecord round-trip;
14. PENDING/FAILED/PUBLISHED + Inbox round-trip;
15. no backup artifact becomes tracked by Git.

Only add tests relevant to actual implementation.

---

# 38. REGRESSION

Run actual repository commands.

## Backend
- typecheck;
- build;
- full unit;
- DR script tests;
- relevant integration/e2e;
- isolated restore drill.

## Frontend
- established typecheck/Vitest/build baseline if required by repository convention.

## DB
- migrations current;
- drift 0;
- restored DB verification.

## Artifact integrity
- checker regression;
- real Roadmap checker.

Report actual counts only.

---

# 39. FINDINGS

Classify every finding:

- CRITICAL
- HIGH
- MEDIUM
- LOW
- OBSERVATION

Approval rules:

```text
CRITICAL unresolved → BLOCK
HIGH unresolved → BLOCK
hard gate unresolved → BLOCK
MEDIUM → fix or explicitly prove non-blocking by canonical contract
LOW → may fix during review
OBSERVATION → document
```

---

# 40. REVIEW FIXES

Narrow review fixes allowed.

For each:

```text
finding
severity
root cause
files
behavior/documentation change
test
regression
why scope remains 2.17A
```

Do not implement production cloud/PITR infrastructure as a review fix unless explicitly authorized and already selected.

---

# 41. APPROVAL SEMANTICS — CRITICAL DECISION

Strict Review MUST explicitly decide:

### Option A — Readiness step can be approved before provider-specific production capability is verified

Then verdict may be APPROVED if:

- targets are approved;
- technical local restore contract is proven;
- production capability gaps are explicitly recorded;
- no false compliance claim exists;
- those gaps are owned by later infrastructure/deployment verification.

### Option B — Step 2.17A requires production capability verification now

Then absence of PITR/equivalent, media backup, immutability, etc. must BLOCK approval.

Do not choose based on convenience.

Derive from canonical Roadmap wording.

---

# 42. ROADMAP UPDATE

Only after review verdict.

If approved:

`✅ STRICT REVIEW COMPLETED — APPROVED`

or:

`✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

If blocked:

preserve truthful non-approved state with exact capability blocker.

Do not start Step 2.17B in this pass.

---

# 43. REQUIRED STRICT REVIEW REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.17A_BACKUP_DISASTER_RECOVERY_READINESS_STRICT_REVIEW_REPORT.md`

Required sections:

1. Verdict
2. Methodology
3. Repository baseline
4. Reviewed SHA range
5. Acceptance matrix
6. PostgreSQL backup
7. Multi-schema coverage
8. Snapshot consistency
9. Checksum
10. Restore safety
11. Restore drill
12. Migration compatibility
13. Finance round-trip
14. EventBus round-trip
15. Security state
16. External idempotency
17. Object storage
18. Media RPO/RTO
19. DB/object non-atomicity
20. PostgreSQL RPO
21. PostgreSQL RTO
22. PITR/equivalent
23. Retention
24. Immutability
25. Secrets/key recovery
26. Failure visibility
27. Artifact security
28. Ransomware scenario
29. Runbook quality
30. Windows/operator compatibility
31. Script security
32. DR scenario matrix
33. Card-data negative audit
34. PSP boundary
35. RLS boundary
36. Test quality
37. Adversarial tests
38. Findings
39. Review fixes
40. Regression
41. Artifact integrity
42. Capability-gap decision
43. Roadmap update
44. Negative checks
45. Files changed
46. Persistence
47. Repository Evidence
48. Release
49. NEXT
50. Final statement

---

# 44. NEGATIVE CHECKS

Explicitly report:

```text
production DB touched = 0
production object storage touched = 0
PITR implemented during review = 0 unless explicitly authorized
cloud/provider selected = 0
PSP selected/runtime = 0
raw PAN/CVV storage = 0
RLS implementation = 0
2.17B started = 0
2.17C started = 0
2.18 started = 0
sales.service refactor = 0
false RPO compliance claim = 0
false RTO compliance claim = 0
false PITR claim = 0
tests skipped for green = 0
assertions weakened = 0
backup artifacts committed = 0
secrets committed = 0
```

---

# 45. ARTIFACT INTEGRITY

Run:

- checker regression;
- real Roadmap artifact checker.

Required:

`WARN = 0`
`FAIL = 0`

Report actual PASS count.

Do not suppress genuine provenance gaps.

---

# 46. GIT DISCIPLINE

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

Never:

```bash
git add .
git add -A
```

Stage only exact review files/fixes.

Inspect cached diff.

Preserve unrelated untracked prompts.

---

# 47. COMMIT / PUSH

If approved with or without fixes, commit the final reviewed state.

Suggested:

```bash
git commit -m "review: approve phase 2.17A backup and disaster recovery readiness"
```

or, if fixes exist:

```bash
git commit -m "fix(ops): apply phase 2.17A strict review fixes"
```

Follow established provenance/footer convention.

Push and verify:

```bash
git push
git rev-parse HEAD
git rev-parse --verify @{u}
```

Only report PUSHED if final HEAD == upstream.

If BLOCKED, persist truthful blocker/report according to repository convention.

---

# 48. REPOSITORY EVIDENCE FOOTER

Use actual values:

```text
REPOSITORY EVIDENCE

repository:
branch:
reviewed_base_sha:
reviewed_head_before_review_fixes:
review_fix_commit_sha:
strict_review_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:
migration_count:
artifact_integrity:
postgres_rpo_target:
postgres_rto_target:
media_rpo_target:
media_rto_target:
daily_retention_target:
monthly_retention_target:
pitr_capability:
media_backup_capability:
immutability_capability:
reviewed_state:
persistence_status:
release_status:
```

Never fabricate SHAs.

---

# 49. RELEASE

Default:

`RELEASE: NOT PERFORMED`

Do not deploy production backup infrastructure during Strict Review.

---

# 50. SUCCESS OUTPUT

```text
PHASE 2 STEP 2.17A STRICT REVIEW COMPLETED — APPROVED [WITH REVIEW FIXES]

Hard gates:
- PostgreSQL whole-DB backup: PASS
- multi-schema coverage: PASS
- checksum/integrity: PASS
- restore target safety: PASS
- isolated restore drill: PASS
- migration recovery: PASS
- finance round-trip: PASS
- EventBus round-trip: PASS
- security state round-trip: PASS
- external idempotency round-trip: PASS
- object-storage contract: PASS
- DB/object non-atomicity: PASS
- runbook: PASS
- RPO/RTO authority: PASS
- retention authority: PASS

Capability semantics:
- PostgreSQL RPO≤1h: APPROVED TARGET / <verified capability status>
- PostgreSQL RTO≤4h: APPROVED TARGET / <verified capability status>
- Media RPO≤24h: APPROVED TARGET / <verified capability status>
- Media RTO≤8h: APPROVED TARGET / <verified capability status>
- PITR/equivalent: <actual>
- immutability/off-account: <actual>
- approved target ≠ implemented capability ≠ verified capability: PRESERVED

Findings:
- CRITICAL: <n>
- HIGH: <n>
- MEDIUM: <n>
- LOW: <n>
- review fixes: <actual>

Regression:
- backend: <actual>
- frontend: <actual>
- DB/restore drill: <actual>
- artifact integrity: PASS=<n> WARN=0 FAIL=0

Persistence:
- branch: <actual>
- review fix commit: <sha/N/A>
- strict review commit: <sha>
- provenance/footer commit: <sha/N/A>
- final HEAD: <sha>
- upstream: <sha>
- push_status: PUSHED
- worktree_clean: <true|false>

RELEASE: NOT PERFORMED
NEXT: <derive from canonical Roadmap after approval>
```

---

# 51. BLOCKED OUTPUT

```text
PHASE 2 STEP 2.17A STRICT REVIEW BLOCKED — PRODUCTION CAPABILITY GAP

Blocking findings:
- <exact hard gate>
- <severity>
- <repository evidence>
- <missing capability>
- <required remediation/authority>

Roadmap:
- Step 2.17A remains NOT APPROVED

RELEASE: NOT PERFORMED
NEXT: STEP 2.17A REMEDIATION
```

---

# 52. HARD STOP

After:

- independent audit;
- restore/adversarial tests;
- narrow review fixes if needed;
- regression;
- strict-review report;
- truthful Roadmap verdict;
- artifact integrity;
- exact staging;
- commit;
- push;
- provenance verification;

**STOP.**

Do not start Step 2.17B, Step 2.17C, Step 2.18, RLS, PSP/payment-provider work, or production backup infrastructure in this pass.
