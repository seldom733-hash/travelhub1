# TravelHub — Backup & Disaster Recovery Runbook (Step 2.17A)

Status: **IMPLEMENTATION COMPLETED — RPO/RTO/RETENTION AUTHORITY APPROVED — WAITING FOR STRICT REVIEW**

## 1. Purpose & scope

This runbook defines the canonical Backup & Disaster Recovery (DR) readiness for TravelHub
(Phase 2, Step 2.17A). It covers PostgreSQL multi-schema backup/restore, object-storage
recovery, EventBus/outbox/inbox recovery, financial-state recovery, secrets/config recovery,
restore safety and integrity checks.

Business continuity targets are defined by the approved Business/Operations authority
(§3, §16) — PostgreSQL RPO≤1h / RTO≤4h, Media RPO≤24h / RTO≤8h, retention daily=30d /
monthly=12mo — as targets, not implemented-capability evidence.

## 2. State inventory

| component | authority | persistence | backup required | mechanism |
|---|---|---|---|---|
| PostgreSQL (11 schemas: security, crm, catalog, events, order, booking, sales, finance, reverse, communication, public) | AUTHORITATIVE | PostgreSQL 18 | YES | `pg_dump -Fc` (scripts/dr-backup.mjs) |
| OutboxEvent / InboxEvent | AUTHORITATIVE | events schema | YES (verbatim) | DB backup |
| ExternalIdempotencyRecord | AUTHORITATIVE | events schema | YES | DB backup |
| finance: Payment, Refund, Invoice, Commission, CommissionAccrual, LedgerTransaction, ProviderFee, Settlement, Payout | AUTHORITATIVE (frozen facts) | finance schema | YES (verbatim, never regenerated) | DB backup |
| security: User (tokenVersion), Role, RolePermission | AUTHORITATIVE | security schema | YES | DB backup |
| sales / order / booking state | AUTHORITATIVE | own schemas | YES | DB backup |
| ProductMedia / StorefrontMedia objects | AUTHORITATIVE (non-reconstructable bytes) | object storage (S3-compatible; dev = MinIO) | YES | provider-neutral object backup contract (§11) |
| Redis | NOT CURRENTLY USED | — | NO | — |
| local filesystem uploads | NOT CURRENTLY USED (backend/uploads gitignored; media goes to object storage) | — | NO | — |
| secrets/config (backend/.env) | EXTERNAL AUTHORITY (no secret manager selected) | local/gitignored | recovery source = secure env management (§14) | — |
| Git source | RECONSTRUCTABLE (pushed history) | remote | only if history pushed | clone |

## 3. RPO/RTO — authority (APPROVED TARGETS)

Approved Business/Operations recovery objectives (2026-08-16; decision report
`docs/prompts/PHASE_2_STEP_2.17A_RPO_RTO_RETENTION_AUTHORITY_DECISION_REPORT.md`):

| State | RPO | RTO |
|---|---:|---:|
| Canonical PostgreSQL transactional state | **≤ 1 hour** | **≤ 4 hours** |
| Authoritative Media / Object Storage | **≤ 24 hours** | **≤ 8 hours** |

Retention: daily recoverable backups **30 days**; designated monthly recoverable backups **12 months**.

**Hard semantic rule:** `APPROVED TARGET ≠ IMPLEMENTED CAPABILITY ≠ VERIFIED CAPABILITY`.
- PostgreSQL RPO≤1h = APPROVED TARGET; PITR = NOT YET VERIFIED / provider-dependent;
  production PostgreSQL MUST use a verified mechanism capable of RPO≤1h (dump-only insufficient).
- RTO≤4h = APPROVED TARGET; measured local restore time is **not** production RTO proof.
- Retention = backup retention, not legal/accounting/audit/PSP/immutable retention.
- Decision record: `docs/architecture/backup-disaster-recovery-2.17A.md` §4.

## 4. PostgreSQL backup contract

```bash
cd backend
node scripts/dr-backup.mjs [--out <dir>] [--label <name>]
```

- Whole multi-schema DB (`-Fc` custom format: schema/data, constraints, indexes, sequences, migration history).
- Credentials only from `DATABASE_URL` (env or `backend/.env`); no secrets printed.
- Fails (non-zero exit) on any pg_dump error.
- Artifacts → `backend/.backups/` (gitignored; never committed).
- sha256 checksum sidecar written alongside the dump.
- Restore only to an isolated recovery DB; production DB is never a restore-test target.

## 5. Isolated restore drill

```bash
cd backend
node scripts/dr-restore-drill.mjs --backup .backups/travelhub_<label>_<ts>.dump --yes
```

Fail-closed guards (all proven by unit tests `src/ops/dr-scripts.spec.ts`):
1. target DB must not match canonical name / protected list → refuse;
2. `--yes` acknowledgement required;
3. target must be a bare valid DB name;
4. backup artifact requires a matching `.sha256` sidecar — mismatch/missing → refuse;
5. no destructive DROP against an unverified target.

Drill steps: validate target → create isolated DB → restore → verify schemas/migrations/data →
read-only smoke → record timings → cleanup (DROP) unless `--keep`.

Failure paths are also cleaned up: if restore/verify/smoke fails after the isolated target DB was
created, the drill best-effort DROPs that target (guards already passed — canonical/production DBs
are never touched) and persists FAILED evidence before exiting non-zero. A failed `pg_dump` removes
any partial artifact (no sidecar is written for partial output).

## 6. Restore integrity checks

Verified by the drill against the actual schema:
- Prisma migration history (all canonical `prisma/migrations/` folders present in `_prisma_migrations`);
- 11 canonical schemas;
- `security.User` (incl. `tokenVersion`);
- `events.OutboxEvent` (incl. FAILED statuses), `events.InboxEvent`;
- `events.ExternalIdempotencyRecord`;
- `finance.Payment`, `finance.LedgerTransaction`;
- `sales.Sale`, `order.Order`, `booking.Booking`;
- smoke: active users, tokenVersion set, outbox PENDING.

## 7. EventBus/outbox recovery

- Restored DB preserves OutboxEvent PENDING/FAILED/PUBLISHED statuses and InboxEvent dedup records verbatim.
- Consumer idempotency is preserved: delivery semantic is **at-least-once + authoritative consumer/inbox idempotency** (Step 2.17-approved).
- **Never delete inbox/outbox rows as recovery cleanup.** The OutboxWorkerService resumes delivery of PENDING/retryable-FAILED after restore; exhausted/poison rows remain documented state.
- Crash after FAILED→PENDING before delivery: recoverable (row persists, next cycle re-publishes; Inbox dedup prevents duplicate side effects).

## 8. Financial recovery

Historical financial facts (Payment, Refund, Invoice, Commission, CommissionAccrual,
LedgerTransaction, ProviderFee, Settlement, Payout) are restored **verbatim** — IDs, source
links, statuses, Decimal values. No recalculation from mutable current policies/tariffs.
Frozen commission/payment/ledger/settlement facts are never regenerated.

## 9. Object storage (S3/MinIO)

- Binary media (ProductMedia/StorefrontMedia) lives in object storage; metadata in PostgreSQL.
- Non-reconstructable user content → **DB-only backup is insufficient**; object storage needs its own backup/replication.
- Dev uses MinIO (local, `.tools/`, `docker-compose.yml`); production provider not canonically selected.
- Do not equate dev MinIO with production durability.
- Provider-neutral backup/restore contract required before production object-storage dependence.

## 10. DB ↔ object consistency

Actual semantics: **non-atomic** (two systems, two backup points). Cover:
- DB reference but missing object;
- orphan object;
- differing backup timestamps;
- post-restore reconciliation checks (prefer reconciliation over false atomicity claims).

## 11. Redis / cache

Redis: **NOT CURRENTLY USED** (login throttle is in-memory per-instance; Step 2.17 documented deferral).
Cache-only rebuild/flush on recovery. No authoritative Redis state exists today.

## 12. Secrets / config recovery

- No secrets in dumps/scripts/Git/reports.
- Recovery source for JWT keys, DB/object credentials, CORS config: `backend/.env` (gitignored) —
  **gap: no secret manager selected**; documented, not invented.
- Future PSP secrets: same boundary (per ADR-0015; PSP not selected).

## 13. Source / build recovery

- Git remote is source-recovery authority **only if history is pushed**.
- Migrations/config versioned in Git where safe; secrets are not.
- An unpushed worktree is NOT DR-safe.

## 14. Backup security / immutability

| control | status |
|---|---|
| encryption at rest | provider-dependent / not selected |
| access control | local filesystem (dev) |
| least privilege | credentials via env only |
| credential separation | yes (env, no hardcoding) |
| artifact exposure | local `.backups/` (gitignored) |
| immutable/off-account backup | MISSING — documented gap (no provider authority) |

## 15. Backup failure visibility

Evidence contract (per backup/drill):
`exit status · timestamp · artifact id/path · size · checksum (sha256) · duration · restore-test status · owner/alert path`.

The restore drill persists evidence on **both success and failure** (`result: PASSED|FAILED` +
note) into `backend/.backups/drill-evidence-*.json`. A failed drill cleans up its isolated target
and exits non-zero, so failure is observable via exit code + evidence + absence of orphan target.

No monitoring platform selected — contract/ownership defined only; no new platform built.

## 16. RPO/RTO authority decision record

- **APPROVED (2026-08-16):** PostgreSQL RPO≤1h / RTO≤4h; Media/Object Storage RPO≤24h / RTO≤8h;
  retention daily=30d / monthly=12mo. All are approved **targets**, not capability evidence.
- PITR: NOT VERIFIED / provider-dependent. Production PostgreSQL requires a verified mechanism
  capable of RPO≤1h (candidate classes: WAL/PITR, managed PostgreSQL PITR, or equivalent).
- Daily full `pg_dump` alone is insufficient for production RPO≤1h.
- RTO verification remains future work: realistic DB size, backup location/network, restore
  infrastructure, migrations, integrity verification, app startup, EventBus recovery, operational overhead.

## 16b. Capability gap matrix

| objective | approved target | current evidence | production capability verified? | remaining owner | verification step |
|---|---|---|---|---|---|
| PostgreSQL RPO | ≤ 1h | local backup ~1s; drill restore works | NO (dump-only insufficient alone) | Ops + provider authority | select & verify PITR-equivalent mechanism capable of RPO≤1h |
| PostgreSQL RTO | ≤ 4h | isolated restore ~4–6 s (TEST EVIDENCE) | NO (not RTO proof) | Ops | full-scale restore drill (size/network/infra/migrations/app/EventBus) |
| Media/Object storage RPO | ≤ 24h | contract defined (provider-neutral) | NO | Ops + provider authority | provider backup/replication contract verified |
| Media/Object storage RTO | ≤ 8h | contract defined | NO | Ops + provider authority | provider restore procedure verified |
| daily retention | 30d | target approved | NO | Ops | scheduled-job + recovery verification |
| monthly retention | 12mo | target approved | NO | Ops | designated monthly backups + recovery verification |
| PITR / equivalent | verified mechanism capable of RPO≤1h | NOT VERIFIED | NO | Ops + provider authority | mechanism selection + verification |
| backup immutability | one compromised credential must not destroy live + all backups | MISSING (gap documented) | NO | Ops + provider authority | immutable/off-account storage implementation |
| secret/key recovery | secure env management | `backend/.env` only (no secret manager) | NO | Ops | secret manager selection + rotation drill |
| monitoring/alerting | backup failure visibility | evidence contract only | NO | Ops | monitoring platform + alert path |

## 17. PSP / card-data boundary

- No PSP selected (ADR-0015); no PSP runtime; no provider recovery API; no PAN/CVV/CVC stored or backed up.
- TravelHub-owned payment state → TravelHub backup.
- Provider-owned transaction/settlement evidence → external authority + future reconciliation/export after contract.

## 18. Failure-scenario matrix

| # | scenario | consequence / action |
|---|---|---|
| DR-1 | PostgreSQL loss | restore from latest verified dump (drill §5); RPO/RTO per authority |
| DR-2 | logical deletion | PITR implication — NOT VERIFIED; needs WAL/PITR decision |
| DR-3 | corrupted backup | checksum mismatch → refuse restore; use older verified dump |
| DR-4 | latest backup unavailable | fall back to previous verified artifact; evidence of gap |
| DR-5 | object-storage loss | non-reconstructable media lost unless object backup exists (§9) |
| DR-6 | DB/media backups at different points | reconciliation required; accept non-atomic window |
| DR-7 | restart with PENDING/FAILED events | worker resumes; at-least-once + inbox idempotency |
| DR-8 | backup during financial writes | pg_dump consistent snapshot at statement level; finance facts verbatim |
| DR-9 | lost signing/secrets | recover from secure env source (§12); gap documented |
| DR-10 | compromised admin/app credentials | rotate secrets; tokenVersion revocation already in place |
| DR-11 | DB/code migration mismatch | see §19 ordering; newer DB than code fails safe |
| DR-12 | restore helper points at production | **fail-closed guard refuses** (proven by tests) |

## 19. Migration/restore order

```
backup schema == deployed code   → restore, prisma migrate deploy = no-op
backup schema older than code    → restore, then prisma migrate deploy applies new migrations
backup schema newer than code    → FAIL SAFE: do not start app; align code (or roll forward)
```

Newer DB than code must fail safe (never start app on an unknown schema).

## 20. Post-restore smoke

Isolated recovery env: backend DB connection, Prisma init, representative auth/session/read paths,
EventBus worker startup safety, no drift/raw-500 schema mismatch. No external PSP/network side effects.

## 21. Automation & tooling

- `backend/scripts/dr-backup.mjs` — backup (dependency-free, fail-fast).
- `backend/scripts/dr-restore-drill.mjs` — isolated restore drill (fail-closed).
- Unit tests: `backend/src/ops/dr-scripts.spec.ts` (4 guards).
- No scheduled production backup infrastructure without infrastructure authority.

## 22. Failure handling / incident close

1. Confirm scope of loss (DB only / DB+media / secrets).
2. Restore to isolated target first; verify integrity (§6) before considering production recovery.
3. Never DROP unverified targets; fail closed.
4. Record evidence (backup artifact, checksum, timings, restore-test status).
5. Close incident only after smoke checks pass and RPO/RTO authority is consulted.

---

**Authoritative artifacts:** `docs/architecture/backup-disaster-recovery-2.17A.md` (architecture/decision record);
`docs/prompts/PHASE_2_STEP_2.17A_BACKUP_DISASTER_RECOVERY_READINESS_IMPLEMENTATION_REPORT.md` (step report).
