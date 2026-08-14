# TRAVELHUB — README RECONCILIATION & UPDATE — REPORT

## 1. Verdict

**`TRAVELHUB README RECONCILIATION COMPLETED — README UPDATED TO CURRENT REPOSITORY TRUTH`**

Documentation-only pass. No production code, schema, migrations, CI, Docker or
test behavior changed. Legacy directory not deleted. Roadmap NEXT unchanged.

## 2. Repository baseline

- Branch: `master`; HEAD: `124cceb` (`chore: bump version to 0.18.0 (Phase 2 Step 2.14E Commission Policy Foundation release)`); `origin/master` = HEAD.
- Working tree: **not clean at start** — in-flight uncommitted Step 2.14F-ish work (`Partner Collect Commission Accrual`: `commission-accrual.consumer.ts`, `commission.service.ts`, migration `20260814190000_add_partner_collect_commission_accrual`, e2e, plus edits in sales/order/finance/eventbus). This pass did **not** touch, stage or clean those files.
- Root has **no** `package.json` / `package-lock.json` (verified).
- Migrations: 56 directories in `backend/prisma/migrations` (migration_lock excluded).
- Roadmap state: Step 2.10/2.10A/2.10B…2.14E milestones APPROVED; per-step `NEXT` markers maintained inside the Roadmap file. README intentionally does **not** hardcode a NEXT value (§18 of the prompt).

## 3. README stale claims found

| Area | Old README said | Repository truth | Action |
|---|---|---|---|
| Product description | «Phase 1 + Phase 2 (Auth/RBAC)», tour catalog MVP framing | Modules: Catalog, CRM, Sales, Reverse, Order, Booking, Communication, Finance, Security; 10 schemas / 92 models | Rewritten (Overview + Business domains) |
| Backend root | implied root package | `backend/` is the only backend package; root is **not** an npm package | Stated explicitly |
| Frontend root | «4 рабочих центра» | Next.js App Router: catalog, search, storefronts, partner/buyer cabinets, internal `/app/*` | Corrected |
| Database | implied single DB; no multiSchema mention | PostgreSQL **multiSchema**, 10 domain schemas, no FKs between schemas | Documented |
| Business domains | 6 domains | 10 schemas incl. `communication`, `sales`, `reverse`, `finance` | Full table added |
| Finance | absent | Finance foundation (master data + immutable facts; PSP deferred) | Added with honest scope |
| EventBus | «transactional outbox» only | outbox + inbox dedup + correlation/causation; **no** durable-retry claim | Honest wording (§11) |
| Migrations | single `prisma migrate deploy` mention | canonical workflow: `migrate dev --create-only` → `migrate deploy`; `db push` forbidden; e2e fresh replay | Documented |
| Tests | `npm run test:e2e` only | backend typecheck/unit/e2e/build + frontend typecheck/vitest/lint/build + e2e prerequisites | Full commands |
| CI | not mentioned | workflow exists but currently broken (root `npm ci` + SQLite) | Honest status, owner = Step 2.17 |
| Legacy | «справочный материал» | full parallel Next.js+SQLite app; NOT current authority | Truthful section |
| Docs links | ADR-0001/0002 + phase1-dod | ADR-0001…0013, architecture hub, api/events/ids contracts, Screen Design, Roadmap | Navigation hub |

## 4. Current package roots

- `backend/package.json` (version 0.18.0) — NestJS; scripts: `build`, `start`, `dev`, `typecheck`, `test`, `test:e2e`, `prisma:generate`, `prisma:migrate`, `prisma:deploy`, `prisma:studio`.
- `frontend/package.json` (version 0.18.0) — Next.js; scripts: `dev`, `build`, `start`, `lint`, `test` (Vitest).
- Root: **not** a package (verified).

## 5. Current application vs legacy

- Current authority: `backend/` + `frontend/` (+ root `docker-compose.yml` for MinIO).
- `legacy/` is a separate Next.js + SQLite application (own `package.json`, `package-lock.json`, `prisma/schema.prisma`, `dev.db`, `users-credentials.txt`, `admin-access.ts` API routes). README now states it is historical, not current runtime, must not be used by CI/build/deploy, and commands/config must not be copied from it. Not deleted. Credentials inside it not exposed.

## 6. Current stack

- Backend: NestJS, Prisma (PostgreSQL multiSchema), JWT/bcrypt, Jest; money = `Prisma.Decimal` (never float); S3-compatible object storage (MinIO) for ProductMedia.
- Frontend: Next.js (App Router), React, TypeScript, Vitest, ESLint.
- Infra: PostgreSQL 15+, Docker Compose (MinIO). Redis: not used — not listed.

## 7. Current database architecture

- PostgreSQL, Prisma `multiSchema` with 10 schemas: `events, catalog, crm, order, booking, security, communication, sales, reverse, finance`.
- No foreign keys between schemas; cross-domain integration via events + ID references (ADR-0001).
- Migrations via Prisma; `db push` forbidden for canonical workflow; e2e global setup applies real migrations on a fresh isolated `*_test` DB.

## 8. Current domains

Generated from `backend/src/app.module.ts` (PrismaModule, EventBusModule, CatalogModule, CrmModule, OrderModule, BookingModule, CommunicationModule, SalesModule, ReverseModule, FinanceModule, SecurityModule) and `schema.prisma` (92 models). Table in README mirrors this exactly.

## 9. Event architecture wording

README describes transactional outbox + inbox deduplication + correlation/causation (ADR-0009/0010), and **explicitly avoids** a «guaranteed durable retry» claim: background retry/publisher worker is listed under Known limitations with owner Step 2.17 (§11 compliance).

## 10. Local dev commands verified

- `cp backend/.env.example backend/.env` — template exists.
- `docker compose up -d minio` — service defined in root `docker-compose.yml`.
- `cd backend && npm install && npx prisma migrate deploy && npx prisma generate && npm run dev` — scripts exist.
- `cd frontend && npm install && npm run dev` — scripts exist.
- Demo login `admin/admin123` via `ADMIN_USERNAME`/`ADMIN_PASSWORD` — matches seed.

## 11. Migration commands verified

- `npx prisma migrate dev` (`prisma:migrate`), `npx prisma migrate deploy` (`prisma:deploy`), `npx prisma migrate status` — all present in backend scripts / Prisma CLI.

## 12. Test commands verified

- Backend: `npm run typecheck`, `npm test` (jest `--runInBand`), `npm run test:e2e` (jest `--config test/jest-e2e.json --runInBand`), `npm run build`.
- Frontend: `npx tsc --noEmit` (no dedicated script — documented as `npx`), `npm test` (vitest run), `npm run lint`, `npm run build`.
- E2E prerequisites documented (PostgreSQL + `psql`, `TEST_DATABASE_URL` with `test` suffix, isolated MinIO auto-download, single-run-per-DB).

## 13. CI status

- `.github/workflows/ci.yml` exists (typecheck/lint/build on push/PR) but is **not** currently runnable: `npm ci` at root (no package.json) and `DATABASE_URL=file:./dev.db` (SQLite) vs PostgreSQL multiSchema backend.
- README states this honestly and assigns repair ownership to `PHASE 2 — STEP 2.17 — PLATFORM HARDENING GATE`.
- Workflow YAML **not** modified in this pass.

## 14. Security wording

README documents: JWT auth + RBAC (10 roles), permissions backend-enforced and re-read from DB per request, audit in `security.AuditLog`. Known auth limitations (stateless JWT, logout without token revocation, guard fail-open) are **not** advertised as solved — README stays high-level and points to ADR/security docs; detailed hardening belongs to Step 2.17.

## 15. Documentation links verified

All links in new README exist: `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`, `docs/architecture/README.md`, `docs/adr/ADR-0001-modular-monolith.md`, `docs/contracts/api.md`, `docs/contracts/events.md`, `docs/contracts/ids.md`, `docs/prompts/TravelHub_Screen_Design_Brief_Baseline_1.6_PAYMENTS_FINAL.md`, `backend/.env.example`, `docker-compose.yml`. No dead links; `docs/phase1-dod.md` (Phase 1 historical DoD) intentionally no longer linked as a navigation hub item.

## 16. Known limitations

README lists (verified current): PSP integration not implemented (Finance = foundation; Payment/Refund/Invoice/Commission runtime, settlement engine, payout rail deferred 2.12–2.14); no background outbox worker (manual `retryFailed`/opportunistic `publishPending`; Step 2.17); minimal Finance UI; broken CI; deferred accounting/commercial flows.

## 17. README changes

Full rewrite of root `README.md` in Russian (matches repo docs language) with the §21 recommended structure: Overview, Architecture at a glance, Repository structure, Tech stack, Business domains, Getting started, Environment, Database & migrations, Running locally, Testing, CI/CD, Documentation, Legacy directory, Current development status, Known limitations. No secrets introduced; no volatile test counts hardcoded.

## 18. Negative checks (§23 cross-checks)

1. Commands exist — verified (backend/frontend scripts). ✓
2. Linked files exist — verified. ✓
3. Package roots exist — `backend/`, `frontend/`. ✓
4. DB provider correct — PostgreSQL multiSchema (10 schemas). ✓
5. Legacy status truthful — separate app, not current authority. ✓
6. Module/domain names match code — from `app.module.ts` + schema. ✓
7. No secrets present — no credentials copied; `users-credentials.txt` not referenced. ✓
8. No stale SQLite claim as current — removed; legacy SQLite explicitly marked historical. ✓
9. No root npm command — removed; root stated as non-package. ✓
10. No false CI claim — honest broken status + owner step. ✓
11. No false «fully implemented UI» claim — Finance UI minimal noted. ✓
12. No false durable-retry claim — limitation stated. ✓

## 19. Files changed

- `README.md` (rewritten, documentation-only).
- `docs/prompts/TRAVELHUB_README_RECONCILIATION_AND_UPDATE_REPORT.md` (this report).

Uncommitted Step 2.14F in-flight files (see §2) were **not** touched.

## 20. Follow-up owners

- **CI repair** → `PHASE 2 — STEP 2.17 — PLATFORM HARDENING GATE` (root-package/SQLite mismatch; target `backend/` + `frontend/` steps, PostgreSQL service container, real migrations, e2e job).
- **Outbox background retry/publisher worker** → Step 2.17 (durable delivery; `retryFailed`/`publishPending` currently manual/opportunistic).
- **Auth hardening** (logout revocation / fail-closed guard) → Step 2.17 candidates; ADR note for stateless-JWT tradeoff.
- **`sales.service.ts` decomposition** → maintainability refactor, no owner step assigned (out of scope for documentation passes).
- **`legacy/`** → optional future removal/archival decision (not in this pass).

## 21. Exact next project step remains unchanged

The README pass does not alter the Roadmap. The canonical implementation sequence and current NEXT item remain authoritative in
`docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` — unchanged by this documentation pass.
