# Backup & Disaster Recovery Readiness — Step 2.17A (Architecture & Decision Record)

## 1. Purpose

Truthful, executable Backup & Disaster Recovery readiness foundation for TravelHub:
authoritative vs reconstructable state, PostgreSQL multi-schema backup/restore, object-storage
recovery, EventBus/outbox/inbox recovery, financial-state recovery, secrets/config recovery,
restore safety, and approved RPO/RTO/retention authority.

## 2. Repository truth (evidence, not claims)

- PostgreSQL 18.4, 11 canonical schemas (security, crm, catalog, events, order, booking, sales,
  finance, reverse, communication, public), 93 Prisma models, 58 canonical migrations.
- EventBus: `OutboxEvent` / `InboxEvent` (events schema), `ExternalIdempotencyRecord`; delivery =
  at-least-once + authoritative inbox idempotency (Step 2.17 approved).
- Finance: `Payment`, `Refund`, `Invoice`, `Commission`, `CommissionAccrual`, `LedgerTransaction`,
  `ProviderFee`, `Settlement`, `Payout` — frozen historical facts.
- Object storage: S3-compatible (dev = MinIO); binary media non-reconstructable from DB.
- Redis: not used. Secrets: `backend/.env` (gitignored), no secret manager selected.

## 3. State inventory summary

See runbook §2 (`docs/operations/backup-disaster-recovery-runbook.md`). All canonical DB state is
AUTHORITATIVE; media objects AUTHORITATIVE non-reconstructable; secrets EXTERNAL AUTHORITY
(gap documented); Git source RECONSTRUCTABLE when pushed.

## 4. RPO/RTO authority — APPROVED TARGETS

Business/Operations recovery objectives approved by this project pass (2026-08-16; decision
report `docs/prompts/PHASE_2_STEP_2.17A_RPO_RTO_RETENTION_AUTHORITY_DECISION_REPORT.md`):

| State | RPO | RTO |
|---|---:|---:|
| Canonical PostgreSQL transactional state | **≤ 1 hour** | **≤ 4 hours** |
| Authoritative Media / Object Storage | **≤ 24 hours** | **≤ 8 hours** |

Backup retention:
- daily recoverable backups: **30 days**;
- designated monthly recoverable backups: **12 months**.

**Hard semantic rule:** `APPROVED TARGET ≠ IMPLEMENTED CAPABILITY ≠ VERIFIED CAPABILITY`.
- PostgreSQL RPO≤1h is an APPROVED TARGET, not current capability evidence.
- PITR = NOT YET VERIFIED / provider-dependent.
- Local isolated restore ~4–6 s = TEST EVIDENCE, not production RTO proof.

Capability implication:
```text
Production PostgreSQL MUST use a selected and verified recovery mechanism capable of RPO≤1h.
Candidate classes: WAL/PITR, managed PostgreSQL PITR, or technically equivalent verified mechanism.
A full dump interval capable of losing >1h is insufficient by itself for production RPO≤1h.
```

RTO≤4h verification must eventually include realistic DB size, backup location/network, restore
infrastructure, migrations, integrity verification, app startup, EventBus recovery and operational
overhead. Retention is backup retention, not automatically application/legal/accounting/audit/PSP/
immutable retention; exact monthly day/storage tier/provider mechanism may be chosen later while
meeting the target. Secrets are NOT placed into ordinary backups; one compromised application
credential must not be able to destroy both live state and all recoverable backups (implementation
provider/infrastructure-dependent). Capability-gap matrix: runbook §16b.

## 5. PostgreSQL backup contract

`backend/scripts/dr-backup.mjs` (dependency-free Node):
- `pg_dump -Fc` whole multi-schema DB; constraints/indexes/sequences/migration history preserved;
- fail-fast on error; credentials only from env; sha256 sidecar; artifacts gitignored;
- restore only to isolated recovery DB; no `db push`; production never a restore-test target.

## 6. Restore drill & safety

`backend/scripts/dr-restore-drill.mjs`:
1. validate recovery target (fail-closed against canonical/protected names, `--yes` required,
   bare-name check — **guards run before any backup handling**);
2. verify backup checksum sidecar (missing/mismatch → refuse);
3. create isolated DB; 4. restore; 5. verify schemas/migrations/data; 6. smoke; 7. timings; 8. cleanup.

Proven by unit tests `src/ops/dr-scripts.spec.ts` (4 fail-closed guards) and live drill evidence.

## 7. Integrity checks (derived from actual schema)

`_prisma_migrations` (all canonical folders present), 11 schemas, `security.User` incl.
`tokenVersion`, `events.OutboxEvent`/`InboxEvent` statuses, `ExternalIdempotencyRecord`,
`finance.Payment`/`LedgerTransaction`, `sales.Sale`/`order.Order`/`booking.Booking`, smoke:
active users, tokenVersion set, outbox PENDING.

## 8. EventBus recovery

Restored DB preserves PENDING/FAILED/PUBLISHED and Inbox dedup verbatim. Never delete inbox/outbox
rows as cleanup. Worker resumes delivery; at-least-once + inbox idempotency prevents duplicate
committed side effects. Crash after FAILED→PENDING is recoverable.

## 9. Financial recovery

Finance facts restored verbatim (IDs, links, statuses, Decimal). Never regenerated from mutable
policies/tariffs. Frozen commission/payment/ledger/settlement facts never recalculated.

## 10. Object storage

Non-reconstructable user content → DB-only backup insufficient. Provider-neutral backup contract
required; dev MinIO ≠ production durability. DB↔object consistency is **non-atomic**; reconciliation
checks preferred over false atomicity claims.

## 11. Secrets / PSP boundary

No secrets in dumps/scripts/Git/reports. Recovery source = secure env management (gap: no secret
manager selected — documented). No PSP selected (ADR-0015); no PAN/CVV stored/backed up.

## 12. Failure-scenario matrix

See runbook §18 (DR-1…DR-12) incl. DR-12 (restore helper pointing at production must fail closed —
proven).

## 13. Migration/restore order

Equal → no-op; older backup → `prisma migrate deploy`; newer DB than code → **fail safe**.

## 14. Verdict

Technical readiness complete and executable (backup + isolated restore drill proven end-to-end);
RPO/RTO/retention authority now APPROVED as targets (not capability evidence). Strict Review is
**NOT STARTED** — Step 2.17A is not marked APPROVED.

`PHASE 2 STEP 2.17A IMPLEMENTATION COMPLETED — RPO/RTO/RETENTION AUTHORITY APPROVED — WAITING FOR STRICT REVIEW`
