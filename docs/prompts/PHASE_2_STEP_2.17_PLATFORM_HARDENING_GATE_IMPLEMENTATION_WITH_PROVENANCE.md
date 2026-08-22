# PHASE 2 — STEP 2.17 — PLATFORM HARDENING GATE — IMPLEMENTATION PROMPT

**Project:** TravelHub  
**Mode:** IMPLEMENTATION / CROSS-CUTTING PLATFORM HARDENING  
**Authority:** current `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`  
**Position:** this formalizes the existing canonical **Step 2.17 — Phase 2 Hardening**. It does **not** reorder Step 2.10C or intervening domain steps.  
**Hard stop:** Strict Review is a separate pass.

## 1. Mission

When the Roadmap reaches Step 2.17, perform a repository-backed implementation pass closing verified cross-cutting reliability, security, CI/CD and repository-integrity gaps.

Independently reproduce these reported findings before changing code:

1. CI may run `npm ci/build` from repository root although current packages live in `backend/` and `frontend/`, and may still target legacy SQLite rather than PostgreSQL multiSchema.
2. Frontend JWT/session credentials may be persisted in JS-readable `localStorage` / `document.cookie`.
3. Auth/login may have no rate limiting.
4. `EventBus.retryFailed()` may have no production scheduler/worker.
5. `publishPending()` may depend on HTTP command paths instead of an independent durable publisher.
6. `PermissionsGuard` may fail open when `request.user` is absent.
7. Logout may only write AuditLog while the JWT remains valid.
8. `legacy/` may interfere with CI/tooling and obscure the current source of truth.
9. README may materially lag behind actual architecture.
10. `ADMIN = ALL_PERMISSIONS` may need an explicit separation-of-duties assessment.

For every item use:

`finding → repository evidence → risk → minimal architecture-consistent fix → regression proof`

If disproved: `NOT REPRODUCED — NO CHANGE`.

## 2. Mandatory inspection

Inspect Roadmap; `.github/workflows/**`; root/backend/frontend/legacy package files; Docker/test DB configuration; Prisma schema/migrations; E2E global setup; `backend/src/eventbus/**`; Outbox/Inbox; every `publishPending` and `retryFailed` caller; AppModule/bootstrap; auth controller/service/guards/JWT config; frontend auth storage; CORS; `APP_GUARD`; `@Public`; `@RequirePermissions`; RBAC seeding; AuditLog; README; and all production references to `legacy/`.

Search repository-wide for:

`localStorage`, `document.cookie`, `Authorization`, `JWT_EXPIRES_IN`, `logout`, `refresh`, `revoke`, `session`, `enableCors`, `origin: true`, `throttle`, `rate`, `retryFailed`, `publishPending`, `OutboxEvent`, `FAILED`, `PENDING`, `APP_GUARD`, `PermissionsGuard`, `Public`, `RequirePermissions`, `ALL_PERMISSIONS`, `legacy`, `dev.db`, `sqlite`.

## 3. Baseline

Record branch, HEAD, origin relation, dirty state, active package roots, active DB provider, migration status, CI workflows, Roadmap status and exact NEXT. Do not clean unrelated changes.

## 4. Reconciliation

Before implementation create a Current→Target matrix for CI, event delivery, retry, auth storage, logout/session invalidation, login abuse protection, PermissionsGuard, CORS, legacy isolation, README/source-of-truth and ADMIN/SoD.

# A. CI/CD BASELINE REPAIR

## 5. CI — HARD GATE

Canonical CI must:

- install backend dependencies from the actual backend root;
- install frontend dependencies from the actual frontend root;
- use the supported Node version;
- backend typecheck/build/unit;
- provision PostgreSQL compatible with Prisma multiSchema;
- apply real migrations;
- execute actual E2E against disposable CI PostgreSQL;
- frontend typecheck/tests/production build;
- fail on every required gate.

Current backend CI must not use SQLite or `legacy/`.

## 6. CI path/database proof

Audit every working-directory, cache/lockfile path, Prisma path and script. Prove fresh PostgreSQL migration replay, test-only credentials, no `db push`, no developer DB dependency and actual multiSchema creation.

# B. DURABLE EVENT DELIVERY

## 7. Outbox delivery — CRITICAL HARD GATE

Audit:

`domain transaction → Outbox PENDING → publisher → consumer → Inbox/result`

Committed PENDING events must progress without another unrelated HTTP request.

## 8. `publishPending()` audit

Classify every caller: HTTP opportunistic, background, startup recovery, test-only or dead code.

HTTP publishing may remain as latency optimization, but cannot be the sole eventual-delivery mechanism.

## 9. Durable publisher

If absent, implement the smallest architecture-consistent production background publisher.

Requirements: production registration; automatic execution; bounded batches; safe multi-instance behavior; controlled errors; no tight loop; existing event identity/lineage preserved; no duplicate business effect.

Do not introduce Redis/Bull/Kafka solely for this step unless already required.

## 10. Durable retry — CRITICAL HARD GATE

If `retryFailed()` is unreachable in production, wire a real runtime retry mechanism.

It must respect existing retryability/backoff/retry-count semantics, preserve event ID/correlation/causation, never retry non-retryable poison events forever, and have deterministic exhaustion.

## 11. Recovery/concurrency proof

Test:
- PENDING committed → no follow-up HTTP → background delivery succeeds;
- retryable FAILED → worker retries → success or deterministic exhaustion;
- non-retryable FAILED is not retried;
- concurrent publishers/workers do not create duplicate business effects;
- restart does not lose committed work.

Use Inbox/domain invariants and DB-safe CAS/claiming; no read-then-write race.

## 12. Event observability

Provide sufficient operational visibility for pending backlog, failed backlog, retry attempts, exhausted failures and publisher/retry-cycle failures. Do not build a monitoring platform.

# C. AUTH / SESSION SECURITY

## 13. Auth architecture — HARD GATE

Document actual flow:

`login → credential issuance → browser storage → authenticated request → expiry → refresh (if any) → logout`

Do not redesign before proving current behavior.

## 14. Browser credential storage — CRITICAL

If sensitive credentials are stored in localStorage/sessionStorage/IndexedDB or JS-readable cookies, remediate.

For long-lived browser session credentials prefer server-set `HttpOnly`, production `Secure`, explicit `SameSite`, scoped cookie. Do not merely move JWT from localStorage to `document.cookie`.

If cookie authentication is introduced, perform the CSRF review in §20.

## 15. Session / refresh architecture

Harden existing refresh/session semantics if present. If absent, introduce only the smallest coherent mechanism required for truthful secure logout.

Any persistent refresh/session credential needs server-side authority, expiry, revocation, logout invalidation and tests. If this requires an unresolved new security architecture, STOP with `ARCHITECTURE DECISION REQUIRED`.

## 16. Logout — CRITICAL HARD GATE

If logout currently only audits while the same credential remains usable, fix the mismatch.

Required proof:

`login → protected request succeeds → logout → same session/credential no longer authorizes protected API`

AuditLog is not revocation.

## 17. Token lifetime

Audit configured/default access TTL. Any change must be documented and expiry-tested.

# D. ABUSE PROTECTION / AUTHORIZATION

## 18. Auth rate limiting — CRITICAL

Protect login and other abuse-sensitive auth surfaces that actually exist (registration/password reset/refresh as applicable).

Requirements: deterministic limit, controlled 429, no raw 500, no meaningful account-enumeration leak, appropriate key strategy, regression tests.

Do not indiscriminately throttle all business APIs.

If production topology requires shared limiter state and no approved shared infrastructure exists, trigger architecture decision rather than pretending an in-memory limiter is distributed-safe.

## 19. PermissionsGuard fail-closed — CRITICAL

A route carrying `@RequirePermissions(...)` must never authorize because `request.user` is missing.

Target:
- public route with no permission metadata → public;
- required permission + missing user → deny;
- authenticated user lacking permission → deny;
- guard-order changes cannot silently turn permission metadata into allow.

Add explicit tests for these combinations.

## 20. CORS / CSRF

Audit deployment topology.

If `origin: true` is active, use an explicit environment-controlled production allowlist unless current architecture proves otherwise. Local dev remains supported.

If auth cookies become automatically attached, evaluate SameSite and explicit CSRF protection. CORS is not CSRF protection.

# E. REPOSITORY / GOVERNANCE

## 21. Legacy isolation

Do not delete `legacy/` merely for cleanup.

Prove whether it participates in CI, scripts, Docker, deployment, imports, Prisma generation or onboarding. Current application source-of-truth must be unambiguous and legacy excluded from current CI/build/deploy.

If legacy credential files contain real/reusable secrets, do not expose them in reports; document removal/rotation requirements.

## 22. README

Update README after runtime truth is established: current backend/frontend roots, stack, PostgreSQL multiSchema, run/test/migration commands, current high-level domains, docs/Roadmap locations, legacy status and CI entry point.

## 23. ADMIN / SoD assessment

Do not automatically remove ADMIN rights.

Assess separation of duties across Security, Finance, Order/Booking operations, moderation, catalog, sales/reverse.

Classify `ADMIN = ALL_PERMISSIONS` as either controlled super-admin bootstrap policy or a governance gap for a later dedicated step. Do not invent business authority.

# F. SECURITY INVARIANTS

## 24. PII / secrets

Do not weaken existing field-level PII redaction.

Logs/AuditLog/errors/CI must never expose password, JWT, refresh/session secret, raw cookie, Authorization header or passport data.

## 25. Cross-domain safety

This hardening pass must not change Order/Booking/Sales/Reverse/Finance business semantics, money snapshots, acquisition source, availability ownership, event payloads or approved lifecycle machines merely to simplify infrastructure.

# G. REQUIRED TESTS

## 26. Negative coverage

At minimum prove:
1. current CI does not use legacy SQLite;
2. package roots are correct;
3. PENDING event recovers without HTTP traffic;
4. retryable FAILED event is retried;
5. non-retryable event is not;
6. retry exhaustion deterministic;
7. concurrent publishers do not duplicate business effect;
8. missing user + required permission denies;
9. public route without permission metadata remains public;
10. auth rate limit returns 429;
11. arbitrary production CORS origin rejected;
12. logout invalidates according to final contract;
13. deprecated JS-readable credential persistence is absent if remediation was required;
14. auth/security logs contain no secrets;
15. legacy app is outside current CI/build.

## 27. Positive coverage

Prove:
- backend build in CI-equivalent environment;
- clean PostgreSQL migration replay;
- full backend unit;
- full serial E2E;
- frontend typecheck/tests/build;
- normal login below threshold;
- authorized protected request;
- logout;
- allowed CORS origin;
- normal outbox publish;
- transient retry recovery;
- Inbox/idempotency intact;
- OrderRequested→Order intact;
- BookingRequested→Booking intact;
- approved Finance/ledger regressions intact.

# H. ARCHITECTURE STOP CONDITIONS

## 28. Stop with `ARCHITECTURE DECISION REQUIRED` if

- secure logout requires a fundamentally new unresolved session model;
- refresh rotation requires unresolved persistent ownership;
- cookie/CSRF requirements conflict with deployment topology;
- rate limiting requires unapproved distributed infrastructure;
- durable event delivery requires a new broker/queue platform;
- current Outbox cannot be made multi-instance safe without a schema/architecture choice;
- retry semantics conflict with approved event contracts;
- production CORS origins are undefined/conflicting;
- ADMIN SoD requires changing approved authority without policy;
- legacy is still an active production dependency;
- CI cannot reproduce supported PostgreSQL architecture;
- a critical finding exposes a broader unresolved trust boundary.

Do not guess through these.

# I. OUT OF SCOPE

## 29. Do not implement

- Step 2.10C or any other business-domain step out of sequence;
- Payment/PSP, Refund, Invoice, Commission engines;
- double-entry accounting/chart of accounts/balances;
- Finance frontend;
- supplier portal/notifications;
- broad `sales.service.ts` decomposition;
- arbitrary microservices;
- deletion of legacy solely for cleanliness;
- Kafka/RabbitMQ/Redis solely for fashion;
- unrelated UI redesign.

The oversized Sales service is technical debt, not part of this gate unless a concrete hardening defect cannot be safely corrected otherwise.

# J. DOCUMENTATION

## 30. Required architecture artifact

Create:

`docs/architecture/phase2-platform-hardening.md`

Cover verified/not-reproduced findings, CI, PostgreSQL tests, Outbox publisher, retry, restart recovery, concurrency, auth/session, logout, rate limiting, PermissionsGuard, CORS/CSRF, legacy isolation, ADMIN/SoD, observability and deferred items.

Update `api.md`, `events.md`, auth/security docs, README and Roadmap only where runtime changed.

# K. REGRESSION

## 31. Backend

Run actual typecheck, build, full unit, targeted auth/security/RBAC, EventBus/outbox/inbox, Order/Booking creation+lifecycle, Finance/ledger and all approved relevant suites, then full serial E2E. Report exact counts.

## 32. Frontend

Run actual typecheck, tests and production build. If token storage changed, repository-search prove deprecated storage is gone. Report counts.

## 33. DB

Run migration status, clean migration replay and supported drift/diff. No `db push`.

## 34. CI

Validate corrected workflow structure and commands. Never claim GitHub-hosted Actions passed unless an actual Actions run was observed.

# L. IMPLEMENTATION REPORT

## 35. Required report

Create:

`docs/prompts/PHASE_2_STEP_2.17_PLATFORM_HARDENING_GATE_IMPLEMENTATION_REPORT.md`

Sections:

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target reconciliation
5. External findings verification
6. CI audit
7. CI fixes
8. PostgreSQL/multiSchema CI proof
9. Outbox write-path audit
10. publishPending audit
11. Durable publisher
12. retryFailed audit
13. Retry worker
14. Restart recovery
15. Multi-instance concurrency
16. Event observability
17. Auth architecture before
18. Token-storage audit
19. Auth/session changes
20. Logout semantics
21. Rate limiting
22. PermissionsGuard
23. CORS
24. CSRF assessment
25. PII/secrets
26. AuditLog
27. Legacy isolation
28. README/source-of-truth
29. ADMIN/SoD assessment
30. Negative coverage
31. Positive coverage
32. EventBus regression
33. Auth/RBAC regression
34. Backend regression
35. Frontend regression
36. DB regression
37. CI validation
38. Issues found
39. Fixes applied
40. Findings not reproduced
41. Architecture decision status
42. Deferred technical debt
43. Out-of-scope confirmation
44. Exact files changed
45. Roadmap update
46. Exact NEXT item
47. Git persistence gate
48. Repository evidence
49. Commit SHA
50. Push status
51. Release status

## 36. Verdict

Success before persistence:

`PHASE 2 STEP 2.17 PLATFORM HARDENING GATE IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Blocked:

`PHASE 2 STEP 2.17 PLATFORM HARDENING GATE BLOCKED — ARCHITECTURE DECISION REQUIRED`

Do not approve the step in the implementation pass.

The implementation verdict does **not** by itself prove repository persistence. Persistence must be recorded separately via the mandatory Git Persistence Gate below.

## 37. Roadmap

This prompt strengthens the existing canonical Step 2.17. Do **not** insert it before Step 2.10C.

When Step 2.17 is reached and implementation succeeds:
- Step 2.17 → `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`;
- NEXT → `PHASE 2 — STEP 2.17 — STRICT REVIEW`;
- do not start Step 2.18.

The Roadmap/status entry must distinguish:
- implementation/review outcome;
- repository persistence state.

A textual `COMPLETED` or `APPROVED` must never be treated as proof of Git persistence unless a persistence SHA is recorded.

After a later approved Strict Review:
- Step 2.17 → approved;
- NEXT → canonical Step 2.18 Phase 2 Exit Audit.

## 38. GIT PERSISTENCE GATE — REQUIRED

After all implementation checks, regression, documentation and Roadmap updates succeed, persist only this step's changes.

### 38.1 Pre-commit inspection

Run:

```bash
git status --short
git diff --stat
git diff
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
```

Record:
- current branch;
- current HEAD;
- upstream/origin SHA if available;
- unrelated dirty/untracked files.

Do not clean unrelated work.

### 38.2 Explicit staging only

Forbidden:

```bash
git add .
git add -A
```

Stage only files created or modified by Step 2.17:

```bash
git add <explicit-file-1> <explicit-file-2> ...
```

Then verify:

```bash
git diff --cached --stat
git diff --cached
git status --short
```

If unrelated files are staged, stop and unstage only those unrelated files safely.

### 38.3 Commit

Use a scoped commit message, for example:

```bash
git commit -m "fix(platform): harden ci event delivery auth and repository integrity"
```

Then record:

```bash
git rev-parse HEAD
```

This SHA is the implementation persistence SHA.

### 38.4 Push

If an upstream exists:

```bash
git push
```

If no upstream exists:

```bash
git push -u origin <current-branch>
```

Forbidden:

```bash
git push --force
git push --force-with-lease
```

### 38.5 Post-push verification

Run:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u}
```

Where possible verify:

```bash
git rev-parse HEAD
git rev-parse @{u}
```

Only if HEAD and upstream SHA match may the report say:

`push_status: PUSHED`

If network/upstream verification is unavailable, record the exact limitation. Never fabricate `PUSHED`.

## 39. REPOSITORY EVIDENCE — REQUIRED

The implementation report must end with the canonical repository-evidence footer from:

`docs/prompts/REPOSITORY_EVIDENCE_FOOTER_TEMPLATE.md`

At minimum include actual values:

```text
REPOSITORY EVIDENCE
repository: <canonical repository identity>
branch: <actual branch>
head: <actual SHA>
origin: <actual upstream/origin SHA or unavailable>
worktree_clean: true|false
migration_count: <actual count>
reviewed_state: COMMIT
reviewed_diff_base: <actual base SHA>
reviewed_diff_head: <actual persistence SHA>
persistence_status: PERSISTED
persistence_sha: <actual persistence SHA>
push_status: PUSHED | NOT_PUSHED | PUSH_FAILED | NOT_VERIFIED
```

Rules:

- `APPROVED`/`COMPLETED` ≠ `PERSISTED`;
- `PERSISTED` requires a real commit SHA;
- `PUSHED` requires verified upstream equality;
- if unrelated pre-existing dirty/untracked files remain, `worktree_clean` must be `false`;
- never reuse a stale SHA from a previous step.

## 40. PERSISTENCE STATUS IN FINAL RESPONSE

The final response must explicitly include all of:

- implementation verdict;
- branch;
- commit SHA;
- persistence status;
- push status;
- upstream/origin SHA if verified;
- exact NEXT.

Example:

```text
PHASE 2 STEP 2.17 PLATFORM HARDENING GATE IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW

PERSISTED @ <sha>
PUSHED TO origin/<branch> @ <sha>
NEXT: PHASE 2 — STEP 2.17 — STRICT REVIEW
```

If commit succeeds but push does not:

```text
PERSISTED @ <sha>
NOT PUSHED — <verified reason>
```

Do not downgrade a correct implementation because a transient push fails, but do not claim remote persistence.

## 41. RELEASE STATUS

This implementation pass does **not** automatically perform production release/deployment.

Default:

`RELEASE: NOT PERFORMED — STRICT REVIEW REQUIRED`

Production deployment/release is allowed only through an explicit later release/deployment gate after approved Strict Review.

Do not:
- deploy backend/frontend;
- apply production migrations;
- create a production release/tag;
- claim production rollout.

unless a separate explicit release instruction is provided.

## 42. STOP

After:
- implementation report;
- Roadmap update;
- explicit-file commit;
- push attempt;
- repository-evidence footer;
- persistence verification;

**STOP**.

Do not perform Strict Review in the same pass.  
Do not begin Step 2.18.  
Do not opportunistically refactor unrelated modules.

The only NEXT item after successful implementation remains:

`PHASE 2 — STEP 2.17 — STRICT REVIEW`
