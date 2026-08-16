# PHASE 2 — STEP 2.17A — RPO/RTO/RETENTION AUTHORITY DECISION REPORT

## 1. Verdict

**`TRAVELHUB STEP 2.17A RPO/RTO/RETENTION AUTHORITY DECISION COMPLETED`**

Business/Operations recovery objectives for TravelHub V1 are now recorded as approved targets.
The authority blocker found by Step 2.17A technical implementation is resolved. Strict Review is
**NOT STARTED** — Step 2.17A is not marked APPROVED. This pass is documentation/authority only:
no infrastructure, no PITR implementation, no provider selection, no production changes.

## 2. Baseline

```text
branch:   master
head:     dacdd85 (Step 2.17A technical implementation + footer, PUSHED)
upstream: dacdd85 (clean at start)
worktree: clean of modified files at start; untracked prompt files from prior steps preserved
migrations: 58/58 applied, drift 0 (verified in Step 2.17A implementation pass)
```

## 3. Prior authority gap

Step 2.17A technical implementation (2026-08-16) classified RPO/RTO/retention/PITR as
**classification B — no approved authority exists**:

```text
RPO: TBD — BUSINESS/OPERATIONS AUTHORITY REQUIRED
RTO: TBD — BUSINESS/OPERATIONS AUTHORITY REQUIRED
retention: TBD — OPERATIONS/LEGAL/BUSINESS AUTHORITY REQUIRED
PITR: NOT CURRENTLY VERIFIED / PROVIDER-DEPENDENT
```

Repository-wide search (docs/, README, ADRs) confirmed no approved business-continuity targets —
only references to retention as future debt (ADR-0010, analytics docs).

## 4. Authority scope

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

These values are not attributed to a regulator/provider — no repository evidence supports that.

## 5. PostgreSQL scope

RPO≤1h / RTO≤4h covers all TravelHub-owned canonical PostgreSQL transactional state, including
actual implemented state across: security (users/roles/permissions), Sales/Order/Booking, Outbox/
Inbox (events), Payment/Finance (Payment, Refund, Invoice, Commission, CommissionAccrual,
LedgerTransaction, ProviderFee, Settlement, Payout where present), ExternalIdempotencyRecord and
migration history. Repository truth (Prisma schema): 93 models, 11 schemas, 58 canonical migrations.

## 6. PostgreSQL RPO capability implication

```text
Production PostgreSQL MUST use a selected and verified recovery mechanism capable of RPO≤1h.
Candidate classes: WAL/PITR, managed PostgreSQL PITR, or technically equivalent verified mechanism.
A full dump interval capable of losing >1h is insufficient by itself for production RPO≤1h.
```

No provider is selected. PITR is not claimed implemented. RPO is the requirement; PITR is one
possible mechanism.

## 7. PostgreSQL RTO capability implication

RTO≤4h is approved as a target. Existing local isolated restore proves procedure viability only.
Future verification must include realistic DB size, backup location/network, restore
infrastructure, migrations, integrity verification, app startup, EventBus recovery and operational
overhead. Local restore ~4–6s = TEST EVIDENCE, NOT production RTO proof.

## 8. Media / Object storage

Authoritative media targets: RPO≤24h / RTO≤8h. Non-reconstructable media makes DB-only DR
insufficient (preserved). Current MinIO/S3/provider capability must not be overstated — dev MinIO
≠ production durability.

## 9. DB ↔ object non-atomicity

Preserved: PostgreSQL and object-storage backups are not assumed to be one atomic cross-system
snapshot. Reconciliation required for DB→missing object, orphan object and differing backup
timestamps.

## 10. Retention

Approved: daily backups = 30 days; designated monthly backups = 12 months. This is backup
retention, not automatically application/legal/accounting/audit/PSP/immutable retention. Exact
monthly day/storage tier/provider mechanism may be chosen later while meeting the target.

## 11. PITR status

```text
PITR implementation: NOT VERIFIED
provider: NOT SELECTED / provider-dependent
production requirement: verified mechanism capable of PostgreSQL RPO≤1h
```

Never rewritten as "PITR implemented".

## 12. Finance / EventBus

PostgreSQL targets cover committed TravelHub-owned finance and outbox/inbox state. Historical
financial facts are restored verbatim, never regenerated from current mutable policy/tariff.
EventBus semantic preserved: `at-least-once delivery + authoritative Inbox/consumer idempotency`.
Exactly-once is never claimed; restored inbox/outbox rows are never deleted as cleanup.

## 13. PSP / card boundary

These targets are not assigned to external PSP-owned systems. TravelHub-owned payment/accounting
state is covered by the PostgreSQL objectives; external provider availability/reconciliation
remains contract-dependent. Raw PAN/CVV is not TravelHub backup scope. ADR-0015 / payment blockers
remain unchanged.

## 14. Secrets / immutability

RPO/RTO approval does not place secrets into ordinary backups. Actual secret-recovery gap
preserved (no production secret manager; `backend/.env` gitignored). Immutable storage is not
invented; production requirement recorded: one compromised application credential should not be
able to destroy both live state and all recoverable backups — implementation remains
provider/infrastructure-dependent.

## 15. Target vs capability distinction

```text
APPROVED TARGET ≠ IMPLEMENTED CAPABILITY ≠ VERIFIED CAPABILITY

PostgreSQL RPO≤1h      = APPROVED TARGET
PITR                  = NOT YET VERIFIED / provider-dependent
local restore ~4–6s   = TEST EVIDENCE, NOT production RTO proof
dump-only             = NOT sufficient for production RPO≤1h
media backup contract = defined; provider capability NOT verified
retention 30d/12mo    = APPROVED TARGET, NOT scheduled-job evidence
```

## 16. Capability gap matrix

| objective | approved target | current evidence | production capability verified? | remaining owner | verification step |
|---|---|---|---|---|---|
| PostgreSQL RPO | ≤ 1h | local backup ~0.9s; drill restore works | NO (dump-only insufficient alone) | Ops + provider authority | select & verify PITR-equivalent mechanism capable of RPO≤1h |
| PostgreSQL RTO | ≤ 4h | isolated restore ~4–6 s (TEST EVIDENCE) | NO (not RTO proof) | Ops | full-scale restore drill (size/network/infra/migrations/app/EventBus) |
| Media/Object storage RPO | ≤ 24h | contract defined (provider-neutral) | NO | Ops + provider authority | provider backup/replication contract verified |
| Media/Object storage RTO | ≤ 8h | contract defined | NO | Ops + provider authority | provider restore procedure verified |
| daily retention | 30d | target approved | NO | Ops | scheduled-job + recovery verification |
| monthly retention | 12mo | target approved | NO | Ops | designated monthly backups + recovery verification |
| PITR / equivalent | verified mechanism capable of RPO≤1h | NOT VERIFIED | NO | Ops + provider authority | mechanism selection + verification |
| backup immutability | one compromised credential must not destroy live + all backups | MISSING (gap documented) | NO | Ops + provider authority | immutable/off-account storage implementation |
| secret/key recovery | secure env management | `backend/.env` only (no secret manager) | NO | Ops | secret manager selection + rotation drill |
| monitoring/alerting | backup failure visibility | evidence contract only | NO | Ops | monitoring platform + alert path |

## 17. Roadmap / files

- Roadmap Step 2.17A updated to:
  `🚧 IMPLEMENTATION COMPLETED — RPO/RTO/RETENTION AUTHORITY APPROVED — WAITING FOR STRICT REVIEW`
  with truthful tri-state representation: technical implementation COMPLETED, RPO/RTO/retention
  authority APPROVED, strict review NOT STARTED. Step 2.17A is NOT marked APPROVED.
- `docs/architecture/backup-disaster-recovery-2.17A.md` — §4 replaced TBD-authority state with
  approved targets + hard semantic rule + capability implications; §14 verdict updated.
- `docs/operations/backup-disaster-recovery-runbook.md` — §3, §16 updated; §16b capability-gap
  matrix added; status header updated.
- `docs/prompts/PHASE_2_STEP_2.17A_BACKUP_DISASTER_RECOVERY_READINESS_IMPLEMENTATION_REPORT.md` —
  §17–§20/§33 replaced TBD-authority state while preserving historical measurements (§8).
- This decision report: `docs/prompts/PHASE_2_STEP_2.17A_RPO_RTO_RETENTION_AUTHORITY_DECISION_REPORT.md`.

## 18. Artifact integrity

```text
PASS=<actual> WARN=0 FAIL=0
checker regression: 13/13 (unchanged)
git diff --check: clean
```

## 19. Negative checks

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

## 20. Strict review handoff

The next Strict Review must independently verify: targets are consistent; no false
production-compliance claim; local restore time is not RTO proof; dump-only is not claimed
sufficient for RPO≤1h; media capability remains evidence-based; retention target is not presented
as scheduled-job evidence; restore guards remain fail-closed; no card/secrets scope expansion;
provenance is complete. Review is NOT performed in this pass.

## 21. Persistence

см. evidence footer ниже.

## 22. Release

`RELEASE: NOT APPLICABLE — DOCUMENTATION / AUTHORITY DECISION`

## 23. NEXT

`PHASE 2 — STEP 2.17A — STRICT REVIEW`

---

## REPOSITORY EVIDENCE

repository: TravelHub (D:\travelhub_v1)
branch: master
head: 8fc0f36
origin: dacdd85
worktree_clean: false (untracked prompt-файлы предыдущих шагов остаются — не мои)
migration_count: 58 (canonical folders; dev DB has 3 legacy rows — documented)
reviewed_state: COMMIT
reviewed_diff_base: dacdd85
reviewed_diff_head: 8fc0f36
persistence_status: PERSISTED
persistence_sha: 8fc0f36
push_status: <pending>
decision_base_sha: dacdd85
authority_decision_commit_sha: 8fc0f36
provenance_footer_commit_sha: <pending>
final_head_sha: <pending>
upstream_sha: <pending>
postgres_rpo_target: <=1h
postgres_rto_target: <=4h
media_rpo_target: <=24h
media_rto_target: <=8h
daily_retention_target: 30d
monthly_retention_target: 12mo
pitr_capability: NOT VERIFIED / provider-dependent
release_status: NOT APPLICABLE
