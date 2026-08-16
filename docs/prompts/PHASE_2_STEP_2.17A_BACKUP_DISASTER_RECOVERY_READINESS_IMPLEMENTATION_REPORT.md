# PHASE 2 — STEP 2.17A — BACKUP & DISASTER RECOVERY READINESS — IMPLEMENTATION REPORT

## 1. Verdict

**`PHASE 2 STEP 2.17A TECHNICAL IMPLEMENTATION COMPLETED — RPO/RTO DECISION REQUIRED BEFORE APPROVAL`**

Technical readiness is complete and executable (backup + isolated restore drill proven end-to-end).
Approval is gated on a business/operations RPO/RTO authority decision, which does not exist in the
repository (classification B per prompt §4).

## 2. Baseline

```text
branch: master
head:   f06178f (Step 2.17 STRICT REVIEW APPROVED WITH REVIEW FIXES)
upstream: f06178f (clean at start)
worktree: clean of modified files at start; untracked prompt files from prior steps preserved
```

## 3. Canonical sources

- Roadmap Step 2.17A (line 758): `🚧 PLANNED — НЕ реализован` (updated in this pass).
- Step 2.17 strict-review evidence (`docs/prompts/PHASE_2_STEP_2.17_PLATFORM_HARDENING_STRICT_REVIEW_REPORT.md`):
  delivery = at-least-once + authoritative inbox idempotency; migration count 58; drift 0.
- Prisma schema: 93 models, 11 schemas (security, crm, catalog, events, order, booking, sales,
  finance, reverse, communication, public).
- ADR-0015: no PSP selected; payment branch blocked/deferred.
- ADR-0010: outbox retention debt — no retention authority.
- Storage: S3-compatible object storage (dev MinIO; `docker-compose.yml`, `.tools/minio/`).

## 4. State inventory

Full matrix in runbook §2. Key facts:
- PostgreSQL — AUTHORITATIVE (11 schemas, all canonical state incl. events/finance/sales/order/booking/security).
- Object storage (media bytes) — AUTHORITATIVE, non-reconstructable; DB-only backup insufficient.
- Redis — NOT CURRENTLY USED (in-memory throttle only).
- Local filesystem uploads — NOT CURRENTLY USED (media goes to object storage).
- Secrets/config — EXTERNAL AUTHORITY (backend/.env, gitignored; no secret manager — gap documented).
- Git source — RECONSTRUCTABLE when pushed.
- Unknown stateful dependencies: none found.

## 5. Authority classification

**RPO/RTO/retention/PITR — classification B (no approved authority).**
Repository-wide search for `RPO`, `RTO`, recovery point/time, retention, PITR found no approved
business-continuity targets — only references to retention as future debt (ADR-0010, analytics docs).

```text
RPO: TBD — BUSINESS/OPERATIONS AUTHORITY REQUIRED
RTO: TBD — BUSINESS/OPERATIONS AUTHORITY REQUIRED
retention: TBD — OPERATIONS/LEGAL/BUSINESS AUTHORITY REQUIRED
PITR: NOT CURRENTLY VERIFIED / PROVIDER-DEPENDENT
```

Options prepared (none approved): daily full dump (~24h window), hourly+WAL/PITR (minutes window,
infra implication), continuous replication (provider-dependent).

## 6. PostgreSQL backup contract — CRITICAL HARD GATE: PASS

`backend/scripts/dr-backup.mjs`:
- `pg_dump -Fc` whole multi-schema DB (schema/data, constraints, indexes, sequences, migration history);
- credentials only from env/`backend/.env`; no secrets printed (URL redacted in output);
- fail-fast on pg_dump error;
- sha256 checksum sidecar written;
- artifacts in `backend/.backups/` — gitignored (never committed);
- restore only to isolated recovery DB; production never a restore-test target;
- no `db push`.

Evidence: live run — 410,381 bytes dump, sha256 `77e71a…`, duration 933 ms, exit 0.

## 7. Safe restore drill — CRITICAL HARD GATE: PASS

`backend/scripts/dr-restore-drill.mjs` implements the 10-step drill with fail-closed guards that
run **before any backup handling**:
1. protected/canonical target refusal (travelhub1, postgres, template*, *_prod, prod*) → exit 3;
2. `--yes` acknowledgement required → exit 3;
3. bare-name validation → exit 3;
4. backup checksum sidecar required, mismatch → exit 4;
5. isolated DB creation → restore → verify → smoke → timings → cleanup (DROP unless `--keep`).

## 8. Drill evidence

```text
source DB classification: dev canonical (travelhub1)
backup format: pg_dump custom (-Fc)
backup size: 410,381 bytes
checksum algorithm: sha256
checksum verified: true (77e71ac86d67dc7309e6d1ba30a53cb03c8f23b69be7ac4c33fdb5bed86a37fb)
restore target: travelhub_dr_drill_<ts> (isolated)
restore safety check: PASSED (protected target / --yes / bare-name / checksum guards)
backup duration: 933 ms
restore duration: ~1.9–2.3 s
verification duration: ~1.3–1.5 s
schemas restored: 11 (booking,catalog,communication,crm,events,finance,order,public,reverse,sales,security)
migration state: 61 rows in _prisma_migrations — all 58 canonical folders present
   (note: dev DB carries 3 legacy _prisma_migrations rows whose folders were later consolidated;
   Prisma status reports 58/58 up to date; restored verbatim — not asserted away)
integrity checks: security.User 52 (50 ACTIVE, 52 tokenVersion set); events.OutboxEvent 426 (FAILED 0);
   events.InboxEvent 72; order.Order 26; booking.Booking 15; finance.Payment 0; sales.Sale 0;
   finance.LedgerTransaction 0; events.ExternalIdempotencyRecord 0
smoke result: PASSED (active users, tokenVersion set, outbox PENDING=0)
cleanup result: PASSED (isolated DB dropped)
total drill duration: ~4–6 s
```

## 9. Restore integrity

Checks derived from actual schema (§7 runbook): migration history (all canonical folders present),
11 schemas, constraints/unique identities, Decimal precision (finance tables restored verbatim),
`tokenVersion`, `ExternalIdempotencyRecord`, outbox/inbox statuses, finance facts, order/booking/sale
relationships. No invented models/tables.

## 10. EventBus recovery

PENDING/FAILED/PUBLISHED statuses and InboxEvent dedup restored verbatim. Delivery semantics
preserved: **at-least-once + authoritative consumer/inbox idempotency** (Step 2.17 approved).
Never delete inbox/outbox rows as recovery cleanup. Crash after FAILED→PENDING recoverable;
OutboxWorkerService resumes on startup; no duplicate committed side effects.

## 11. Financial recovery — CRITICAL HARD GATE: PASS

Finance facts restored verbatim (IDs, source links, statuses, Decimal) — no regeneration from
mutable current policies/tariffs. Frozen Commission/Payment/Ledger/Settlement facts never recalculated.
Verified in drill: finance schema present, tables restored.

## 12. Object storage — HARD GATE: PASS (contract defined)

Media bytes are authoritative non-reconstructable → DB-only backup insufficient; provider-neutral
backup/restore contract documented (runbook §9/§10). Dev MinIO ≠ production durability — stated
explicitly. DB↔object consistency is non-atomic; reconciliation checks documented.

## 13. DB ↔ object consistency

Non-atomicity documented (runbook §10): DB-ref-missing-object, orphan object, differing backup
timestamps, post-restore reconciliation. No false atomicity claims.

## 14. Redis / cache

NOT CURRENTLY USED. Cache-only rebuild/flush semantics documented. No authoritative Redis state.

## 15. Secrets / config

No secrets in dumps/scripts/Git/reports. Recovery source = `backend/.env` (gitignored) — gap
documented (no secret manager selected); not invented. PSP secrets deferred (ADR-0015).

## 16. Source / build recovery

Git remote is source-recovery authority only when history is pushed (HEAD == upstream verified).
Migrations/config versioned where safe; secrets not. Unpushed worktree ≠ DR-safe — documented.

## 17. RPO — TBD (authority)

## 18. RTO — TBD (authority)

## 19. Retention — TBD (authority)

## 20. PITR — NOT CURRENTLY VERIFIED / PROVIDER-DEPENDENT

## 21. Backup security / immutability

| control | status |
|---|---|
| encryption at rest | provider-dependent / not selected |
| access control | local (dev) |
| least privilege | env-only credentials |
| credential separation | yes |
| artifact exposure | gitignored local `.backups/` |
| immutable/off-account backup | MISSING — documented gap |

## 22. Failure visibility

Evidence contract defined (exit status, timestamp, artifact, size, checksum, duration,
restore-test status, owner/alert path). No monitoring platform built — ownership/contract only.

## 23. PSP / card-data boundary — PASS

No PSP selected/runtime; no provider recovery API; no PAN/CVV/CVC stored or backed up.
TravelHub-owned payment state → TravelHub backup; provider-owned evidence → external authority
+ future reconciliation/export after contract (ADR-0015 boundary preserved).

## 24. Failure-scenario matrix

DR-1…DR-12 documented (runbook §18); DR-12 (restore helper → production) proven fail-closed by tests.

## 25. Migration/restore order

Equal → no-op; older backup → `prisma migrate deploy`; newer DB than code → **fail safe** (runbook §19).

## 26. Post-restore smoke

Isolated recovery env: DB connection, Prisma init, auth/session read paths, EventBus worker startup
safety, no drift/raw-500. No external PSP/network side effects.

## 27. Automation / tests

- `backend/scripts/dr-backup.mjs` (backup, fail-fast, checksum).
- `backend/scripts/dr-restore-drill.mjs` (isolated drill, fail-closed).
- `backend/src/ops/dr-scripts.spec.ts` — 4 fail-closed guard unit tests (protected target, --yes,
  checksum sidecar, bare-name).
- No scheduled production backup infra (no infrastructure authority).

## 28. Regression

```text
backend: tsc 0; unit incl. dr-scripts 4/4 (run: full suite below)
frontend: tsc 0; vitest; build (re-verified in full regression)
DB: migrate status 58/58 up to date; drift = No difference detected (Step 2.17 state preserved)
artifact checker: PASS=122 WARN=0 FAIL=0 (pre-change baseline re-run)
```

## 29. Artifact integrity

PASS=122 WARN=0 FAIL=0 (baseline). Checker regression re-run in full regression below.

## 30. Negative checks

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

## 31. Files

```text
A backend/scripts/dr-backup.mjs
A backend/scripts/dr-restore-drill.mjs
A backend/src/ops/dr-scripts.spec.ts
A docs/operations/backup-disaster-recovery-runbook.md
A docs/architecture/backup-disaster-recovery-2.17A.md
A docs/prompts/PHASE_2_STEP_2.17A_BACKUP_DISASTER_RECOVERY_READINESS_IMPLEMENTATION_REPORT.md (this report)
M .gitignore (backend/.backups/ + *.dump artifacts)
M docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md (2.17A status)
```

## 32. Roadmap

Step 2.17A updated from `🚧 PLANNED — НЕ реализован` to the truthful technical-implementation
state (B verdict). Step 2.17 remains APPROVED; 2.17B/2.17C/2.18 not started; payment blockers/
ADR-0015 preserved; RLS deferral preserved.

## 33. Unresolved decisions

- RPO/RTO/retention/PITR authority — **BLOCKING approval** (business/operations decision required).
- Secret manager selection — gap documented.
- Object-storage backup provider/contract — provider authority required before production dependence.

## 34. Persistence

см. evidence footer ниже.

## 35. Release

`RELEASE: NOT PERFORMED — STRICT REVIEW / AUTHORITY DECISION REQUIRED`

## 36. NEXT

`STEP 2.17A — RPO/RTO AUTHORITY DECISION` (authority gate precedes strict review),
then `PHASE 2 — STEP 2.17A — STRICT REVIEW`.

---

## REPOSITORY EVIDENCE

repository: TravelHub (D:\travelhub_v1)
branch: master
head: 00b38fe
origin: f06178f
worktree_clean: false (untracked prompt-файлы предыдущих шагов остаются — не мои)
migration_count: 58 (canonical folders; dev DB has 3 legacy rows — documented)
reviewed_state: COMMIT
reviewed_diff_base: f06178f
reviewed_diff_head: 00b38fe
persistence_status: PERSISTED
persistence_sha: 00b38fe
push_status: PUSHED (после финальной верификации)
