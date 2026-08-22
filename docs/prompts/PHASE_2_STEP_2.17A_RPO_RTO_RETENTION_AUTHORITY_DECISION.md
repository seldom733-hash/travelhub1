# PHASE 2 — STEP 2.17A — RPO/RTO/RETENTION AUTHORITY DECISION

## MODE
**DOCUMENTATION / ARCHITECTURE AUTHORITY DECISION ONLY · REPOSITORY-FIRST · NO INFRASTRUCTURE IMPLEMENTATION · NO FALSE CAPABILITY CLAIMS · COMMIT/PUSH/PROVENANCE REQUIRED · HARD STOP**

Close the authority gap found by Step 2.17A. Do not perform Strict Review or implement PITR/cloud backup/replication/object-storage jobs/monitoring.

## 1. APPROVED TRAVELHUB V1 AUTHORITY

Record these approved Business/Operations recovery objectives:

| State | RPO | RTO |
|---|---:|---:|
| Canonical PostgreSQL transactional state | **≤ 1 hour** | **≤ 4 hours** |
| Authoritative Media / Object Storage | **≤ 24 hours** | **≤ 8 hours** |

Backup retention:
- daily recoverable backups: **30 days**;
- designated monthly recoverable backups: **12 months**.

These are approved **targets**, not evidence that production infrastructure currently satisfies them.

## 2. HARD SEMANTIC RULE
Every affected artifact must preserve:
```text
APPROVED TARGET ≠ IMPLEMENTED CAPABILITY ≠ VERIFIED CAPABILITY
```
Examples:
```text
PostgreSQL RPO≤1h = APPROVED TARGET
PITR = NOT YET VERIFIED / provider-dependent
local restore ~4–6s = TEST EVIDENCE, NOT production RTO proof
```

## 3. BASELINE
Before edits:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -30
git diff
```
Verify Step 2.17 APPROVED, Step 2.17A technical implementation state, current HEAD/upstream, migrations, worktree and artifact baseline. Repository truth overrides summaries.

## 4. CANONICAL SOURCES
Read current Roadmap Step 2.17A, `docs/architecture/backup-disaster-recovery-2.17A.md`, `docs/operations/backup-disaster-recovery-runbook.md`, Step 2.17A implementation report, README/other DR references. Do not create duplicate contradictory authority.

## 5. POSTGRESQL SCOPE
RPO≤1h / RTO≤4h applies to all TravelHub-owned canonical PostgreSQL transactional state, including actual implemented security/users, Sales/Order/Booking, Outbox/Inbox, Payment/Finance, Ledger, Commission/Accrual, ProviderFee/Settlement/Payout where present, ExternalIdempotencyRecord and migration history. Use repository truth for exact models.

## 6. RPO CAPABILITY IMPLICATION
A full dump interval capable of losing >1h is insufficient by itself for production RPO≤1h.

Record:
```text
Production PostgreSQL MUST use a selected and verified recovery mechanism capable of RPO≤1h.
Candidate classes: WAL/PITR, managed PostgreSQL PITR, or technically equivalent verified mechanism.
```
Do not select a provider. Do not claim PITR implemented. RPO is the requirement; PITR is one possible mechanism.

## 7. RTO CAPABILITY IMPLICATION
RTO≤4h is approved. Existing local isolated restore proves procedure viability only. It does NOT prove production RTO. Future verification must include realistic DB size, backup location/network, restore infrastructure, migrations, integrity verification, app startup, EventBus recovery and operational overhead.

## 8. MEDIA / OBJECT STORAGE
Record authoritative media targets RPO≤24h / RTO≤8h. Preserve that non-reconstructable media makes DB-only DR insufficient. Current MinIO/S3/provider capability must not be overstated.

## 9. DB ↔ OBJECT NON-ATOMICITY
Preserve:
```text
PostgreSQL and object-storage backups are not assumed to be one atomic cross-system snapshot.
```
Keep reconciliation for DB→missing object, orphan object and differing backup timestamps.

## 10. RETENTION
Approve:
```text
daily backups = 30 days
monthly designated backups = 12 months
```
Clarify this is backup retention, not automatically application/legal/accounting/audit/PSP/immutable retention. Exact monthly day/storage tier/provider mechanism may be chosen later while meeting the target.

## 11. PITR STATUS
Use:
```text
PITR implementation: NOT VERIFIED
provider: NOT SELECTED / provider-dependent
production requirement: verified mechanism capable of PostgreSQL RPO≤1h
```
Never rewrite this as `PITR implemented`.

## 12. FINANCE / EVENTBUS
PostgreSQL targets cover committed TravelHub-owned finance and outbox/inbox state. Historical financial facts are restored verbatim, never regenerated from current mutable policy/tariff.

Preserve EventBus semantic:
`at-least-once delivery + authoritative Inbox/consumer idempotency`.
Never claim exactly-once; never delete restored inbox/outbox rows as cleanup.

## 13. PSP / CARD BOUNDARY
Do not assign these targets to external PSP-owned systems. TravelHub-owned payment/accounting state is covered by PostgreSQL objectives; external provider availability/reconciliation remains contract-dependent. Raw PAN/CVV is not TravelHub backup scope. ADR-0015/payment blockers remain unchanged.

## 14. SECRETS / IMMUTABILITY
RPO/RTO approval does not place secrets into ordinary backups. Preserve actual secret-recovery gap if no production secret manager exists.

Do not invent immutable storage. Record production requirement that one compromised application credential should not be able to destroy both live state and all recoverable backups; implementation remains provider/infrastructure-dependent.

## 15. REQUIRED DOC CHANGES
At minimum update as relevant:
1. canonical Roadmap Step 2.17A;
2. `docs/architecture/backup-disaster-recovery-2.17A.md`;
3. `docs/operations/backup-disaster-recovery-runbook.md`;
4. Step 2.17A implementation report only where needed to replace the prior TBD-authority state while preserving historical measurements;
5. create `docs/prompts/PHASE_2_STEP_2.17A_RPO_RTO_RETENTION_AUTHORITY_DECISION_REPORT.md`.

## 16. ROADMAP STATUS
Authority blocker is resolved, but Strict Review is not done.

Represent truthfully:
```text
technical implementation: COMPLETED
RPO/RTO/retention authority: APPROVED
strict review: NOT STARTED
```
Suitable status:
`🚧 IMPLEMENTATION COMPLETED — RPO/RTO/RETENTION AUTHORITY APPROVED — WAITING FOR STRICT REVIEW`

Do NOT mark Step 2.17A APPROVED.

## 17. AUTHORITY RECORD
Report explicitly:
```text
Decision scope: TravelHub V1 Backup & Disaster Recovery

PostgreSQL:
RPO ≤ 1 hour
RTO ≤ 4 hours

Authoritative Media/Object Storage:
RPO ≤ 24 hours
RTO ≤ 8 hours

Backup retention:
daily = 30 days
monthly = 12 months

PITR:
not currently verified;
production PostgreSQL requires a verified mechanism capable of RPO≤1h.

Authority:
Business/Operations decision recorded by this approved project pass.
```
Do not attribute these values to a regulator/provider unless repository evidence supports it.

## 18. CAPABILITY GAP MATRIX
Create/update:
```text
objective | approved target | current evidence | production capability verified? | remaining owner | verification step
```
Include PostgreSQL RPO/RTO, media RPO/RTO, daily/monthly retention, PITR/equivalent, backup immutability, secret/key recovery and monitoring/alerting.

## 19. STRICT REVIEW HANDOFF
The next Strict Review must independently verify:
- targets are consistent;
- no false production-compliance claim;
- local restore time is not RTO proof;
- dump-only is not claimed sufficient for RPO≤1h;
- media capability remains evidence-based;
- retention target is not presented as scheduled-job evidence;
- restore guards remain fail-closed;
- no card/secrets scope expansion;
- provenance is complete.

Do not perform review now.

## 20. NO INFRASTRUCTURE IMPLEMENTATION
Do NOT configure WAL archiving/PITR, provision buckets, cron/jobs, replication/versioning, immutable storage, KMS, monitoring, production DB/object storage or secrets. Those require later infrastructure/provider evidence.

## 21. REGRESSION / ARTIFACT INTEGRITY
This is docs/authority reconciliation. Run artifact-checker regression, real Roadmap checker, reference/path validation and `git diff --check`.

Required:
```text
WARN=0
FAIL=0
```
If production/config/script behavior changes unexpectedly, stop and run appropriate full regression.

## 22. NEGATIVE CHECKS
Report:
```text
production code/schema/migrations/CI changes = 0
production backup jobs added = 0
PITR implemented = 0
provider/cloud selected = 0
production DB/object storage touched = 0
PSP selected/runtime = 0
raw PAN/CVV storage = 0
RLS = 0
2.17B = 0
2.17C = 0
2.18 = 0
sales.service refactor = 0
false RPO/RTO/PITR compliance claims = 0
```

## 23. DECISION REPORT
Create `docs/prompts/PHASE_2_STEP_2.17A_RPO_RTO_RETENTION_AUTHORITY_DECISION_REPORT.md` with: verdict; baseline; prior authority gap; authority scope; PostgreSQL RPO/RTO; media RPO/RTO; retention; PITR semantics; target-vs-capability distinction; PostgreSQL/object implications; non-atomicity; EventBus/finance/PSP/secrets boundaries; immutability; capability-gap matrix; Roadmap/files; artifact integrity; negative checks; persistence; Repository Evidence; release; NEXT.

## 24. GIT DISCIPLINE
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
Never `git add .` or `git add -A`. Stage exact decision/docs files only. Inspect cached diff. Preserve unrelated untracked prompts.

## 25. COMMIT / PUSH
Suggested:
```bash
git commit -m "docs(ops): approve phase 2.17A recovery objectives"
git push
git rev-parse HEAD
git rev-parse --verify @{u}
```
Claim PUSHED only if final HEAD == upstream. Follow established two-commit provenance convention where applicable.

## 26. REPOSITORY EVIDENCE FOOTER
Use actual values:
```text
REPOSITORY EVIDENCE
repository:
branch:
decision_base_sha:
authority_decision_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:
migration_count:
artifact_integrity:
postgres_rpo_target: <=1h
postgres_rto_target: <=4h
media_rpo_target: <=24h
media_rto_target: <=8h
daily_retention_target: 30d
monthly_retention_target: 12mo
pitr_capability:
reviewed_state:
persistence_status:
release_status:
```
Never fabricate SHAs.

## 27. RELEASE
`RELEASE: NOT APPLICABLE — DOCUMENTATION / AUTHORITY DECISION`

## 28. SUCCESS OUTPUT
```text
TRAVELHUB STEP 2.17A RPO/RTO/RETENTION AUTHORITY DECISION COMPLETED

Authority:
- PostgreSQL RPO: ≤1h — APPROVED TARGET
- PostgreSQL RTO: ≤4h — APPROVED TARGET
- Media RPO: ≤24h — APPROVED TARGET
- Media RTO: ≤8h — APPROVED TARGET
- daily retention: 30d — APPROVED TARGET
- monthly retention: 12mo — APPROVED TARGET

Capability:
- local backup/restore drill: <actual>
- production RPO≤1h: NOT YET VERIFIED
- production RTO≤4h: NOT YET VERIFIED
- PITR/equivalent: NOT YET VERIFIED / provider-dependent
- media backup: <actual>
- immutable/off-account backup: <actual>

Critical distinction:
approved target ≠ implemented capability ≠ verified capability

Roadmap:
- 2.17A technical implementation: COMPLETED
- authority blocker: RESOLVED
- Strict Review: NOT STARTED

Artifact integrity:
- PASS=<actual> WARN=0 FAIL=0

Persistence:
- branch: <actual>
- authority decision commit: <sha>
- provenance/footer commit: <sha>
- final HEAD/upstream: <sha>
- push_status: PUSHED
- worktree_clean: <actual>

RELEASE: NOT APPLICABLE
NEXT: PHASE 2 — STEP 2.17A — STRICT REVIEW
```

## 29. HARD STOP
After repository verification, authority persistence, Roadmap/architecture/runbook reconciliation, capability-gap matrix, artifact checks, exact staging, commit, push and provenance verification: **STOP**.

Do not perform Step 2.17A Strict Review. Do not start 2.17B, 2.17C, 2.18, RLS, PSP integration or production backup infrastructure.
