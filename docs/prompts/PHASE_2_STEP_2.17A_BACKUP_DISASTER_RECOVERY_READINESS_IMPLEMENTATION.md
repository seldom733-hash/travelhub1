# PHASE 2 — STEP 2.17A — BACKUP & DISASTER RECOVERY READINESS — IMPLEMENTATION

## 0. MODE
**REPOSITORY-FIRST · EVIDENCE-FIRST · NO INVENTED RPO/RTO · PRODUCTION-SAFE · TESTABLE RESTORE · COMMIT/PUSH/PROVENANCE REQUIRED · HARD STOP**

Implement only Step 2.17A. Do not start 2.17B, 2.17C, 2.18, RLS or payment-provider work. Step 2.17 is already approved and must not be redesigned.

## 1. OBJECTIVE
Establish a truthful, executable Backup & Disaster Recovery readiness foundation. Determine from repository/runtime evidence:
- authoritative vs reconstructable state;
- PostgreSQL multi-schema backup/restore;
- object-storage recovery;
- EventBus/outbox/inbox recovery;
- financial-state recovery;
- secrets/config recovery;
- restore safety and integrity checks;
- approved RPO/RTO/retention authority;
- measured restore evidence.

Never invent business continuity targets.

## 2. CANONICAL SOURCES FIRST
Read current Roadmap Step 2.17A, Step 2.17 strict-review evidence, README, Prisma schemas/migrations, Docker/runtime config, EventBus/outbox docs, Finance/Payment/Sales docs, object-storage configuration, CI, env/config validation, operations docs and relevant ADRs.

Build:
```text
component | authority | persistence | backup required | reconstructable | backup mechanism | restore mechanism | consistency | sensitive | owner | evidence
```
Repository truth overrides reports.

## 3. BASELINE
Run:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -30
git diff
```
Verify Step 2.17 persisted/approved, migration count, worktree and artifact-checker baseline. Preserve unrelated untracked files.

## 4. RPO/RTO — AUTHORITY HARD GATE
Search repository for approved `RPO`, `RTO`, recovery-point/time, backup retention, DR/business-continuity targets.

Classify:
- **A — approved authority exists:** use exact values/source.
- **B — no authority:** keep `RPO: TBD — BUSINESS/OPERATIONS AUTHORITY REQUIRED`, `RTO: TBD — BUSINESS/OPERATIONS AUTHORITY REQUIRED`.
- **C — conflicting authority:** record conflict; do not choose silently.

Measured restore time is NOT approved RTO. Test backup interval is NOT approved RPO.

If missing, prepare options showing backup-frequency implication, data-loss window, recovery complexity, storage/cost trade-off, but mark none approved.

## 5. STATE INVENTORY — HARD GATE
Repository-first classify every stateful dependency:
- PostgreSQL and every canonical schema;
- OutboxEvent/InboxEvent;
- finance/payment/refund/commission/ledger/provider-fee/settlement/payout state actually present;
- user/security state;
- sales/order/booking state;
- ExternalIdempotencyRecord;
- MinIO/S3/object storage;
- Redis;
- local filesystem/uploads;
- queues/caches;
- secrets/config;
- external systems.

Each must be `AUTHORITATIVE`, `RECONSTRUCTABLE`, `EPHEMERAL`, `EXTERNAL AUTHORITY`, or `NOT CURRENTLY USED`. Unknown stateful dependencies are findings.

## 6. POSTGRESQL BACKUP — CRITICAL HARD GATE
Define/implement a PostgreSQL-native backup contract (`pg_dump` or verified provider-native equivalent), without inventing a cloud provider.

Requirements:
- whole canonical multi-schema DB, not selected tables;
- schema/data, constraints, indexes, sequences and migration history preserved;
- ownership/ACL handling explicit;
- fail on command error;
- credentials only from environment;
- backup artifacts excluded from Git;
- restore only to isolated recovery DB;
- never Prisma `db push`;
- production DB never used as restore-test target.

Document actual snapshot consistency under concurrent writes. Do not claim atomic consistency with object storage unless implemented.

## 7. SAFE RESTORE DRILL — CRITICAL HARD GATE
Create/formalize a repeatable isolated restore drill:
1. validate recovery target;
2. create backup;
3. compute checksum;
4. verify checksum;
5. restore to isolated DB;
6. verify migrations/schemas/models/constraints;
7. verify critical data;
8. run safe application smoke checks;
9. record elapsed times as measurements;
10. clean up.

Restore helper MUST fail closed against obvious production/canonical targets. Require explicit recovery/test DB identity/confirmation. No destructive DROP against an unverified target.

## 8. RESTORE INTEGRITY
Derive checks from actual schema. Verify at least:
- Prisma migration history;
- canonical schemas/tables;
- constraints/unique identities;
- Decimal precision;
- `tokenVersion`;
- ExternalIdempotencyRecord;
- outbox/inbox statuses/dedup state;
- Payment/Refund/Invoice;
- Commission/CommissionAccrual;
- LedgerTransaction;
- ProviderFee/Settlement/Payout if present;
- Order/Booking/Sale relationships.

Do not invent models/tables.

## 9. EVENTBUS RECOVERY
Define recovery behavior for PENDING, retryable FAILED, exhausted/poison, PUBLISHED OutboxEvents and InboxEvent dedup records. Restored DB must preserve consumer idempotency. Never recommend deleting inbox/outbox rows as recovery cleanup.

Delivery remains the Step 2.17-approved semantic: **at-least-once + authoritative consumer/inbox idempotency**, unless repository truth says otherwise.

## 10. FINANCIAL RECOVERY — CRITICAL HARD GATE
Historical financial facts must be restored verbatim, not regenerated from mutable current policies/tariffs. Verify IDs, source links, statuses and Decimal values survive restore. No recalculation of frozen Commission/Payment/Ledger/Settlement facts.

## 11. OBJECT STORAGE — HARD GATE
Inspect actual MinIO/S3 usage. Determine which objects are authoritative/reconstructable, DB key/metadata relationships, versioning/replication/backup reality and dev-vs-production assumptions.

If non-reconstructable user content exists, DB-only backup is insufficient.

Define provider-neutral backup/restore contract unless production storage provider is canonically selected. Do not equate dev MinIO with production durability.

## 12. DB ↔ OBJECT CONSISTENCY
Document actual non-atomicity if applicable. Cover:
- DB reference but missing object;
- orphan object;
- differing backup timestamps;
- post-restore reconciliation/detection.
Prefer reconciliation checks over false atomicity claims.

## 13. REDIS / CACHE
Prove whether Redis state is authoritative. If cache-only: backup NO, rebuild/flush recovery. If sessions/jobs/authority exist, cover them explicitly.

## 14. SECRETS / CONFIG
Do not put secrets in dumps, scripts, Git or reports. Define recovery source for JWT keys/secrets, DB/object credentials, CORS config and future PSP secrets based on actual architecture. If no secret manager is selected, document the gap rather than inventing one.

## 15. SOURCE / BUILD RECOVERY
Git remote is the source-recovery authority only if history is pushed. Verify migrations/config required for rebuild are versioned where safe; secrets are not. Do not treat an unpushed worktree as DR-safe.

## 16. RETENTION / PITR
Search for approved retention and PITR configuration.

If absent:
```text
retention: TBD — OPERATIONS/LEGAL/BUSINESS AUTHORITY REQUIRED
PITR: NOT CURRENTLY VERIFIED / PROVIDER-DEPENDENT
```
Do not invent 30/90-day retention or WAL/PITR just because PostgreSQL supports it. If future RPO implies PITR, record that infrastructure implication.

## 17. BACKUP SECURITY / IMMUTABILITY
Assess encryption, access control, least privilege, credential separation, artifact exposure, restore access, immutable/off-account backup/ransomware resilience. Classify each as implemented/provider-dependent/planned/missing. Do not invent KMS/cloud controls.

## 18. BACKUP FAILURE VISIBILITY
Define evidence contract: exit status, timestamp, artifact ID/path, size, checksum, duration, restore-test status, owner/alert path. If monitoring platform is absent, define contract/ownership only; do not build a new platform.

## 19. PSP / CARD-DATA BOUNDARY
ADR-0015/payment branch remains blocked/deferred:
- select no PSP;
- implement no PSP runtime;
- invent no provider recovery API;
- store/backup no PAN, CVV/CVC or sensitive authentication data.

Boundary:
```text
TravelHub-owned payment state → TravelHub backup
provider-owned transaction/settlement evidence → external authority + future reconciliation/export requirements after contract
```

## 20. RESTORE RUNBOOK
Create canonical runbook (prefer existing operations convention; suggested `docs/operations/backup-disaster-recovery-runbook.md`) covering purpose, scope, inventory, prerequisites, authority placeholders, PostgreSQL backup/checksum/restore, safety, schema/migration verification, smoke tests, outbox/inbox, finance, object storage, DB/object reconciliation, secrets/config, failure handling, abort, evidence capture, measured timings, RPO/RTO authority and incident close criteria.

Commands must match actual repository/runtime.

## 21. AUTOMATION
Add narrow scripts/tests only when they reduce operator error. Requirements: no secrets, fail-fast, safe target validation, deterministic output, non-production default, useful help, and Windows-aware workflow (project development environment is Windows). Node helpers are acceptable if dependency-free/consistent.

Do NOT create scheduled production backup infrastructure without infrastructure authority.

## 22. FAILURE-SCENARIO MATRIX
Cover at least:
- DR-1 PostgreSQL loss;
- DR-2 logical deletion/PITR implications;
- DR-3 corrupted backup;
- DR-4 latest backup unavailable;
- DR-5 object-storage loss;
- DR-6 DB/media backups at different points;
- DR-7 restart with PENDING/FAILED events;
- DR-8 backup during financial writes;
- DR-9 lost signing/secrets;
- DR-10 compromised admin/app credentials;
- DR-11 DB/code migration mismatch;
- DR-12 restore helper points at production (must fail closed).

## 23. MIGRATION/RESTORE ORDER
Define safe ordering for restored DB, migration history, application commit, `prisma migrate deploy`, startup. Cover:
```text
backup schema == deployed code
backup schema older than deployed code
backup schema newer than deployed code
```
Newer DB than code must fail safe.

## 24. POST-RESTORE SMOKE
In isolated recovery environment verify backend DB connection, Prisma init, representative auth/session/read paths, EventBus worker startup safety, no drift/raw-500 schema mismatch. No external PSP/network side effects.

## 25. CI BOUNDARY
Do not destabilize approved Step 2.17 CI. Add only lightweight DR safety/script tests or an isolated restore harness if reasonable. Do not turn every CI run into a production-scale backup exercise.

## 26. ABSOLUTE NON-SCOPE
Do not start:
- Step 2.17B Load/Performance;
- Step 2.17C Sales decomposition;
- Step 2.18;
- RLS implementation;
- PSP integration/selection;
- 2.12B / 2.12C / 2.12I.
Do not refactor `sales.service.ts`.

## 27. REQUIRED ARTIFACTS
At minimum:
1. Step 2.17A Roadmap status;
2. canonical DR runbook/architecture document;
3. RPO/RTO decision record/request if missing/conflicting;
4. narrow safe backup/restore scripts/tests where justified;
5. `docs/prompts/PHASE_2_STEP_2.17A_BACKUP_DISASTER_RECOVERY_READINESS_IMPLEMENTATION_REPORT.md`.

## 28. REPORT CONTENT
Report at least: verdict; baseline; canonical sources; state inventory; authority classification; PostgreSQL contract; multi-schema; consistency; restore safety/drill/measurements; migrations; outbox/inbox; finance; object storage; DB/object consistency; Redis; secrets; source/build; RPO; RTO; retention; PITR; security/immutability; failure visibility; checksum; scenario matrix; card-data/PSP/RLS boundaries; tests/regression; artifact integrity; negative checks; files; Roadmap; unresolved decisions; persistence; Repository Evidence; release; NEXT.

## 29. VERDICT RULE
Derive from canonical Roadmap, not convenience.

A — authority exists and technical implementation complete:
`PHASE 2 STEP 2.17A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

B — technical readiness can complete but authority is an approval gate:
`PHASE 2 STEP 2.17A TECHNICAL IMPLEMENTATION COMPLETED — RPO/RTO DECISION REQUIRED BEFORE APPROVAL`

C — Roadmap makes RPO/RTO authority a prerequisite:
`PHASE 2 STEP 2.17A BLOCKED — RPO/RTO AUTHORITY REQUIRED`

Do not mark APPROVED in implementation.

## 30. REGRESSION
Run proportionate actual checks:
- backend typecheck/build/unit + relevant integration/e2e;
- frontend established regression even if untouched, per project convention;
- DB migrate/status + drift;
- isolated backup/restore verification;
- artifact-checker regression + real Roadmap scan.
Report actual counts only.

## 31. DRILL EVIDENCE
Record without secrets:
```text
source DB classification:
backup format:
backup size:
checksum algorithm:
checksum verified:
restore target:
restore safety check:
backup duration:
restore duration:
verification duration:
schemas restored:
migration state:
integrity checks:
smoke result:
cleanup result:
```

## 32. NEGATIVE CHECKS
Explicitly report:
```text
production DB restore attempted = 0
production data destroyed = 0
raw PAN storage added = 0
CVV/CVC storage added = 0
PSP selected/runtime = 0
RLS implemented = 0
2.17B started = 0
2.17C started = 0
sales.service refactor = 0
2.12B/2.12C/2.12I started = 0
invented RPO = 0
invented RTO = 0
invented retention = 0
invented PITR = 0
secrets committed = 0
backup artifacts committed = 0
db push used = 0
```

## 33. GIT SAFETY
Ensure dumps/recovery artifacts are ignored. Before staging:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git diff --stat
git diff
git diff --check
```
Never `git add .` / `git add -A`. Stage exact Step 2.17A files only; inspect cached diff; preserve unrelated untracked prompts.

## 34. ARTIFACT INTEGRITY
Run checker regression + real Roadmap checker. Required:
```text
WARN = 0
FAIL = 0
```
Report actual PASS count; do not hide pre-existing gaps.

## 35. COMMIT / PUSH
If implementation/readiness is truthfully complete:
```bash
git commit -m "feat(ops): implement phase 2.17A backup and disaster recovery readiness"
```
If blocked and only authority gap is persisted:
```bash
git commit -m "docs(ops): record phase 2.17A recovery authority blocker"
```
Then:
```bash
git push
git rev-parse HEAD
git rev-parse --verify @{u}
```
Claim `PUSHED` only when final HEAD == upstream.

Follow established two-commit provenance/footer convention if applicable.

## 36. REPOSITORY EVIDENCE FOOTER
Use actual values:
```text
REPOSITORY EVIDENCE
repository:
branch:
implementation_base_sha:
implementation_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:
migration_count:
artifact_integrity:
rpo_authority:
rto_authority:
retention_authority:
restore_drill:
reviewed_state:
persistence_status:
release_status:
```
Never fabricate SHAs.

## 37. RELEASE
Default:
`RELEASE: NOT PERFORMED — STRICT REVIEW / AUTHORITY DECISION REQUIRED`

Do not deploy production backup automation, provision cloud resources, alter production DBs or schedule privileged jobs without explicit infrastructure authority.

## 38. ROADMAP / NEXT
Update only evidence-backed Step 2.17A status. Preserve Step 2.17 approved; 2.17B/2.17C/2.18 not started; payment blockers/ADR-0015; RLS deferral.

If implementation is ready:
`NEXT: PHASE 2 — STEP 2.17A — STRICT REVIEW`

If authority blocks review:
`NEXT: STEP 2.17A — RPO/RTO AUTHORITY DECISION`

Do not start 2.17B automatically.

## 39. HARD STOP
After repository discovery, authority classification, state inventory, safe backup contract, isolated restore drill where technically possible, runbook/scripts/tests, regression, Roadmap/report, artifact integrity, exact staging, commit, push and provenance verification: **STOP**.

Do not perform Step 2.17A Strict Review in this pass.
