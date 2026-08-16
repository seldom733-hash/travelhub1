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

## 4. RPO/RTO authority

**Classification B — no approved authority exists.**

- `RPO: TBD — BUSINESS/OPERATIONS AUTHORITY REQUIRED`
- `RTO: TBD — BUSINESS/OPERATIONS AUTHORITY REQUIRED`
- `retention: TBD — OPERATIONS/LEGAL/BUSINESS AUTHORITY REQUIRED`
- `PITR: NOT CURRENTLY VERIFIED / PROVIDER-DEPENDENT`

Measured restore time ≠ RTO; test backup interval ≠ RPO. Options prepared (none approved):
- daily full `pg_dump` — ~24h window, simplest;
- hourly + WAL/PITR — minutes window, requires provider/ops authority and infra;
- continuous replication — provider-dependent.

Decision required from business/operations **before Step 2.17A approval**.

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

Technical readiness complete; approval gated on RPO/RTO authority decision.

`PHASE 2 STEP 2.17A TECHNICAL IMPLEMENTATION COMPLETED — RPO/RTO DECISION REQUIRED BEFORE APPROVAL`
