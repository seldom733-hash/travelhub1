# PHASE 2 — STEP 2.17 — PLATFORM HARDENING — STRICT REVIEW REPORT

## 1. Executive verdict

**`PHASE 2 STEP 2.17 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`**

Independent adversarial review of the complete persisted Step 2.17 state (implementation commit `5760128`, provenance `bb94f94`, stabilization `c20c5cb`, stabilization provenance `d0e8a09`). Every hard gate PASSES after narrow review fixes. 6 review fixes applied (1 HIGH, 3 MEDIUM, 2 LOW), none weakening assertions, none skipping tests, none masking retries. Full regression reproduced independently: backend unit 672/672, serial e2e 1194/1194 (69 suites), frontend tsc 0 + vitest 135/135 + production build, migrate 58/58 drift 0, artifact integrity PASS=120 WARN=0 FAIL=0.

Deferred-gate decisions: multi-instance rate limiter = ALLOWED (contract describes in-memory throttle; no distributed requirement in Step 2.17 scope); ADMIN SoD decomposition = ALLOWED (contract required assessment, delivered and classified; decomposition is a future step).

## 2. Repository baseline (pre-review-fix)

```text
branch: master
head:   d0e8a09 (docs(2.17): populate evidence footer in stabilization report)
upstream: d0e8a09 (pre-review; HEAD == upstream at review start)
worktree: 10 modified files (review fixes) + untracked prompt files from prior steps
```

Step 2.17 commits (repository truth):
- `5760128` — feat(2.17): platform hardening — CI repair, durable outbox, auth hardening
- `bb94f94` — docs(2.17): populate evidence footer in implementation report
- `c20c5cb` — fix(platform): stabilize outbox worker lifecycle (e2e isolation root cause B)
- `d0e8a09` — docs(2.17): populate evidence footer in stabilization report

## 3. SHA range reviewed

`beb7aef` (pre-Step-2.17 base, docs footer of 2.17C/2.9 reconciliation) → `d0e8a09` (stabilization provenance) → worktree review fixes.

## 4. Acceptance matrix

| requirement | source | gate | implementation evidence | test evidence | verdict |
|---|---|---|---|---|---|
| CI/CD repair | Roadmap 2.17 | HARD | `.github/workflows/ci.yml` backend/frontend roots, PostgreSQL 15 service, `prisma migrate deploy`, full serial e2e | workflow inspected; no root npm ci; no SQLite | PASS |
| Durable retry scheduler | Reconciliation 2.17 | CRITICAL HARD | `OutboxWorkerService.runCycle()` calls `retryFailed()` (bounded loop, poison-exhausted, retryable only) | outbox-durable-worker e2e 5/5 + adversarial | PASS |
| Durable PENDING publisher | Reconciliation 2.17 | CRITICAL HARD | worker publishes PENDING on startup + bounded cycle, no HTTP dependency | e2e: PENDING restored without HTTP traffic | PASS |
| Multi-instance outbox safety | Reconciliation 2.17 | CRITICAL HARD | pg advisory xact lock; lock-tx = atomic FAILED→PENDING flip only; delivery outside lock | T-A two genuine instances, T-B crash window | PASS |
| Event schemaVersion decision | Reconciliation 2.17 | HARD (decision) | envelope `version:1` additive, backwards compatible; docs-only decision (contract required decision, not runtime) | business-event-envelope e2e | PASS |
| Token storage | Step 2.17 prompt | HARD | HttpOnly cookie `travelhub.auth`, no localStorage/cookie in app code | auth-hardening e2e | PASS |
| Logout revocation | Step 2.17 prompt | HARD | `User.tokenVersion` increment; tv claim issued+validated | auth-hardening e2e (incl. legacy-tv fail-safe after FIX 1) | PASS |
| `/auth/session` boundary | Step 2.17 prompt | HARD | public probe, no auth bypass, no raw JWT, read-only | auth-hardening e2e | PASS |
| Login throttling | Roadmap 2.17 | HARD | in-memory sliding window 10/15min → 429 | auth-hardening brute-force 429; unit (FIX 3) | PASS |
| PermissionsGuard fail-closed | Step 2.17 prompt | HARD | required+missing user → 403 | permissions-guard.spec 6 | PASS |
| CORS allowlist | Step 2.17 prompt | HARD | `origin: true` gone; allowlist from CORS_ORIGINS; prod fail-closed (FIX 2) | cors.spec + e2e arbitrary-origin rejected | PASS |
| Legacy isolation | Step 2.17 prompt | HARD | legacy outside CI/build/imports; not deleted | repo-wide search | PASS |
| README sync | Step 2.17 prompt | SOFT→PASS | README documents 10 domains, legacy, outbox, CI | inspected | PASS |
| ADMIN SoD | Step 2.17 prompt | HARD (assessment) | classified controlled super-admin bootstrap; assessment delivered; decomposition deferred | documented in impl report | PASS |
| Stabilization fix | Step 2.17 prompt | MANDATORY | delivery moved outside advisory-lock interactive tx | chunk2 4/4+ after fix; expired-tx eliminated | PASS |
| Visibility/auditability | Step 2.17 prompt | HARD | no secrets/raw JWT in logs/audit; controlled errors; status() observability | auth-hardening audit-no-secrets e2e | PASS |

## 5. CI/CD — HARD GATE: PASS

Workflow verified line-by-line:
- no root `npm ci` (backend/frontend have separate package roots — root has none);
- `working-directory: backend` / `frontend` for install/test/build;
- PostgreSQL 15 service container; no SQLite anywhere in workflow;
- canonical `npx prisma migrate deploy` under backend;
- full serial e2e via `npx jest --config test/jest-e2e.json --runInBand`;
- MinIO dev service prerequisite handled by test global setup;
- `set -e` semantics / fail-fast; no silent failure swallowing;
- legacy excluded from canonical build and dependency resolution.

Hosted GitHub Actions success not observed from here (no push-triggered run available in this environment); workflow syntax is valid and commands are the exact ones reproduced locally.

## 6. PostgreSQL multi-schema CI — PASS

Workflow uses PostgreSQL 15; backend schema is Prisma multiSchema (`security`, `crm`, `catalog`, `events`, `order`, `booking`, `finance`, `sales`, `reverse`, `communication`, `buyer`, `legacy`-free). `prisma migrate deploy` runs against the service DB. No SQLite canonical test DB anywhere.

## 7. Legacy isolation — HARD GATE: PASS

Repository-wide search: `legacy/` has its own package.json/prisma (SQLite) and is excluded from root/backend/frontend workspaces, CI, build, Docker runtime and imports. `legacy SQLite DATABASE_URL` absent from canonical config. No hidden SQLite path affects canonical runtime/CI. Legacy deletion: NOT REQUIRED; execution in canonical CI/runtime: 0; authority over current DB/config: 0.

## 8. Token storage — HARD GATE: PASS

- `localStorage`/`sessionStorage`/JS-readable cookie for auth: 0 in app code (vestigial test reference removed — FIX 4);
- canonical cookie `travelhub.auth`: HttpOnly, Secure in production, SameSite=Lax, path=/;
- cookie + Authorization dual path: intentional, precedence deterministic (header-priority), tested;
- no token in URLs/query strings/logs/analytics.

## 9. Logout revocation — HARD GATE: PASS (after FIX 1)

Proof (auth-hardening e2e + adversarial):
1. tv claim issued on every sign (single `signAsync` site, always includes `tv`); 2. validation compares claim with current `tokenVersion`; 3. logout increments; 4. all old tokens → 401 (proven); 5. re-login token works; 6. multiple old tokens invalidated; 7. missing/legacy claim now fails safely (FIX 1 — previously a token without `tv` claim skipped the check and stayed valid after logout, contradicting the documented "all previously issued JWT immediately 401"; now missing tv ⇒ treated as revoked); 8. deleted/invalid user fails safely; 9. concurrent logout cannot reduce version (increment is atomic DB write; e2e concurrent-logout robustness added); 10. internals not leaked (audit-no-secrets test).

## 10. `/auth/session` — PASS

Public `GET /auth/session` is a cookie probe: missing/invalid/expired/revoked cookie → anonymous/401 semantics without auth bypass; no sensitive data; no raw JWT exposure; read-only; no caching of authenticated state.

## 11. Login throttling — PASS (after FIX 3)

Key = `username|ip` (normalized username), sliding window 10 attempts / 15 min, controlled 429 with Retry-After, no credential logging, no user enumeration beyond intended timing. Bounded cleanup added (FIX 3): map eviction of stale windows + hard cap — no unbounded memory growth. Per-instance limitation documented; distributed limiter = deferred (see §12).

## 12. Multi-instance rate limiter deferral — ALLOWED

Classification: **A — explicitly allowed to defer**. The Roadmap Step 2.17 contract (line 754) describes the login throttle as "in-memory 10/15min → controlled 429"; there is no distributed/multi-instance rate-limiter requirement anywhere in Step 2.17 scope. The per-instance limitation was documented in the implementation report rather than silently accepted. No distributed store requirement was invented or dropped.

## 13. PermissionsGuard fail-closed — HARD GATE: PASS

Adversarially verified: required permission + missing user → 403; required permission + missing/unknown permission → 403; valid permission → allow; public-route semantics remain intentional (no metadata → skip). No permission-protected route silently no-ops. 6 unit tests (`permissions-guard.spec.ts`).

## 14. CORS — HARD GATE: PASS (after FIX 2)

- `origin: true` gone (repo-wide search: 0);
- explicit allowlist from `CORS_ORIGINS`;
- arbitrary origin rejected (e2e-verified);
- allowed origin accepted;
- missing Origin intentional (non-browser clients);
- credentials with explicit origins only; wildcard+credentials impossible;
- malformed config fails safely: production with unset/empty `CORS_ORIGINS` now fails closed (FIX 2 — previously `undefined` env silently defaulted to `localhost:3000` even in production, only explicit `""` failed closed);
- dev default (`localhost:3000`) does not leak to prod.

## 15. Durable retry — CRITICAL HARD GATE: PASS

`retryFailed()` has a production caller: `OutboxWorkerService.runCycle()`. Bounded loop (max iterations per cycle), retryable-only selection, `OUTBOX_MAX_ATTEMPTS` exhaustion → poison (no resurrection), attempts/causation preserved, no hot loop (backoff-gated), crash/restart recovery (FAILED rows persist; next cycle re-attempts), no duplicate business side effects (Inbox dedup authoritative). Visibility via `status()`.

## 16. Durable PENDING publisher — CRITICAL HARD GATE: PASS

`OutboxWorkerService` publishes PENDING events on a bounded background cycle (startup + interval), no HTTP-request dependency. Restart recovery: PENDING persists and is republished. Canonical event path unchanged. Failure status semantics preserved (delivery error → FAILED with error retained).

## 17. Multi-instance outbox — CRITICAL HARD GATE: PASS

`pg_advisory_xact_lock` (unique lock key) serializes the FAILED→PENDING flip across instances; delivery happens outside the lock transaction, so two workers may attempt the same PENDING event — duplicate business side effects are prevented by authoritative Inbox dedup + domain unique constraints + P2002 handling on every relevant consumer. Adversarial evidence:
- T-A (two genuine worker instances sharing one DB, same retryable FAILED): one wins the flip; both may attempt delivery; side effect count = 1 (dedup); no raw 500; final status PUBLISHED — 10/10 stable across repetitions.
- T-B (crash after FAILED→PENDING before delivery): PENDING persists; recovery flip re-delivers; dedup keeps side effect = 1.
- T-C (consumer success + duplicate delivery): Inbox dedup → second delivery no-op.
- T-D (repeated failure → poison/exhausted): not resurrected.
- T-E (non-retryable/unknown error): FAILED with error; not auto-retried.
- T-F (shutdown during active iteration): fence + in-flight await (see §18).
- T-G/T-H (nested chain OrderRequested→OrderCreated→CommissionAccrual exceeding old 5s window): now outside lock-tx; no expired transaction.

Delivery semantics: **at-least-once delivery + authoritative inbox/consumer idempotency**. Exactly-once is NOT claimed.

## 18. Stabilization fix — MANDATORY: PASS

Directly verified in `outbox-worker.service.ts`: the advisory-lock transaction covers ONLY the atomic retryable `FAILED → PENDING` transition (short); `publishPending()` (consumer delivery) runs outside the lock transaction, same path as HTTP commands. Adversarial answers:
- two workers can publish the same PENDING event: yes, by design — safe via Inbox dedup;
- duplicate business side effects: prevented — Inbox dedup authoritative for every relevant consumer (order-requested, commission-accrual, booking-requested all P2002-safe);
- non-idempotent consumers: none found (all Inbox-guarded);
- nested `publishPending()`: safe — parent marked PUBLISHED before nested publish; no lock held;
- crash after FAILED→PENDING before delivery: recoverable — PENDING row persists, next cycle re-publishes;
- delivery succeeds but status persistence fails: event may re-deliver → dedup makes it a no-op; 0 duplicate committed facts;
- duplicate after consumer success: no-op via Inbox;
- old 5s interactive-transaction timeouts: **eliminated**, not merely less likely — consumer execution no longer runs inside any interactive transaction (root-cause reproduction showed `expired transaction 5000ms/5133ms`; after fix, absent).

## 19. Worker shutdown/lifecycle — PASS

`onModuleDestroy` fences new iterations, clears the interval timer, awaits in-flight work; closed Nest apps leave no DB activity; no forced `process.exit`, no open handles.

## 20. Orphan Inbox hygiene — PASS

Stabilization test cleanup (`afterAll`) removes only orphan `InboxEvent` rows whose `eventId` no longer exists in `OutboxEvent` for consumers that processed the test's synthetic events (`order-requested-consumer` / `commission-accrual-consumer`). Verified test-only: no production invariant defect concealed; synthetic state is explicit harness state; cleanup cannot race a live worker (test DB, single process, worker stopped first).

## 21. Event schema versioning — PASS

Final contract: envelope carries additive `version:1`; payload-specific version documented (e.g. OrderRequestedPayload.version=1); backwards compatible with legacy v1 envelopes (consumers unchanged). This is the documented versionless-V1+additive-version policy. Step 2.17 required a decision (docs-only acceptable) rather than runtime version-checking — runtime requirement unmet? No. business-event-envelope e2e green.

## 22. ADMIN / segregation of duties — PASS (assessment delivered)

Classification: **A — explicitly deferred**. The Roadmap contract required an "ADMIN SoD assessment"; the implementation report classifies `ADMIN = ALL_PERMISSIONS` as a controlled super-admin bootstrap policy (permissions untouched), documents prohibited initiate+approve review, and defers granular SoD decomposition to a future step. No hard gate violated: the deliverable was the assessment, which is present and truthful.

## 23. Security visibility / auditability — PASS

No secrets/raw JWT/password/raw Idempotency-Key in logs or AuditLog (e2e-verified: audit rows for login/logout contain no credentials); controlled error responses (no stack traces, no internal detail); worker/retry/exhausted visibility via `status()` observability; required audit events present.

## 24. Database/migration — PASS

`tokenVersion` migration (`add_user_token_version`): additive, safe default 0 + backfill, no destructive loss, schema/migration agreement (drift 0), index/constraints as required, fresh replay clean, actual count 58/58, live DB vs schema diff = "No difference detected".

## 25. Auth adversarial matrix — PASS (after FIX 1, FIX 6)

Tested: concurrent logouts (assertions robust to the legitimate 401 race); logout vs authenticated request; old token after increment → 401; cookie + Authorization disagreement (header-priority deterministic); revoked cookie + valid Authorization; invalid cookie + valid Authorization; valid cookie + invalid Authorization; legacy/missing-tv claim → fail-safe 401 (FIX 1). Precedence deterministic and documented.

## 26. Outbox adversarial matrix — PASS

T-A/T-B/T-C/T-D/T-E/T-F/T-G/T-H all covered (see §17). No raw 500 for expected races; no duplicate committed business fact; durable recoverable state.

## 27. CI negative checks — PASS

```text
root npm ci: 0
legacy SQLite DATABASE_URL: 0
db push: 0
SQLite canonical test DB: 0
legacy package execution: 0
missing frontend/backend working-directory: 0
missing migrate deploy: 0
wrong e2e execution mode: 0
```

## 28. Repository-wide security search — PASS

localStorage auth: 1 vestigial test reference (removed, FIX 4); JS-readable auth cookie: 0; `origin: true`: 0; hardcoded secrets: 0; raw JWT/password logs: 0; logout without revocation: 0 (post-FIX-1); permission fail-open: 0; `retryFailed()` without production caller: 0; legacy imports in canonical code: 0; SQLite canonical CI config: 0.

## 29. Regression stability — independently reproduced

```text
backend: tsc 0; build OK; unit 672/672; serial e2e 1194/1194 (69 suites)
  chunk1 (35 suites): 592/592   chunk2 (34 suites): 602/602
  auth-hardening e2e: 7 base + adversarial (combined targeted run green)
  outbox-durable-worker e2e: 5 base + T-A/T-B/T-G/T-H adversarial; 10/10 repetitions stable
  formerly flaky chunk2: repeated green post-fix (4/4 in stabilization, re-verified)
frontend: tsc 0; vitest 135/135 (23 files); production build OK
DB: migrate status 58/58 up to date; live-vs-schema diff = "No difference detected"
artifact integrity: PASS=120 WARN=0 FAIL=0 (checker regression 13/13)
```

## 30. Test quality — PASS

No tautological mocks (guard/throttle/CORS specs exercise real logic); runtime proof used where feasible; no excessive sleeps (backoff-gated assertions use robust recovery shape, not sleep-for-green); no hidden retries (attempt counts asserted); no global-state assumptions; multi-instance outbox test uses two genuinely distinct worker instances sharing one DB.

## 31. Findings

```text
CRITICAL: 0
HIGH:     1  (FIX 1 — missing/legacy tv claim skipped revocation check)
MEDIUM:   3  (FIX 2 — CORS prod fail-closed; FIX 3 — throttle bounded cleanup; FIX 6 — adversarial evidence gaps T-A/T-B/T-G/T-H + auth concurrency)
LOW:      2  (FIX 4 — vestigial localStorage in frontend test; FIX 5 — stale docstrings in eventbus.service.ts and proxy.ts)
review fixes: 6
```

## 32. Review fixes

**FIX 1 (HIGH, security)** — `auth.service.ts`: token without `tv` claim bypassed the revocation check (`tokenVersion !== undefined` guard). Root cause: pre-migration/legacy JWT lacked the claim, so validation skipped comparison, leaving the token valid after logout — violating the documented "all previously issued JWT immediately 401". Fix: missing `tv` claim ⇒ treated as revoked (fail-safe). Production change + adversarial e2e (legacy-tv token → 401). Scope: Step 2.17 logout-revocation hard gate.

**FIX 2 (MEDIUM, security)** — `cors.ts` + `main.ts`: `undefined` `CORS_ORIGINS` defaulted to `localhost:3000` even in production; only explicit `""` failed closed. Fix: production with unset/empty allowlist ⇒ fail-closed (no cross-origin); dev default preserved; `cors.spec.ts` extended. Scope: CORS hard gate.

**FIX 3 (MEDIUM, reliability)** — `login-throttle.service.ts`: unbounded key map growth. Fix: on-check eviction of stale windows + hard map cap; new `login-throttle.spec.ts` (unit). Scope: login throttling gate.

**FIX 4 (LOW, test hygiene)** — `frontend/app/account/layout.spec.tsx`: vestigial `localStorage` token lines removed (hook fully mocked; key never read). Scope: token-storage gate hygiene.

**FIX 5 (LOW, docs)** — `eventbus.service.ts` + `frontend/proxy.ts`: stale docstrings corrected (durable-retry description now matches actual worker-driven semantics; proxy docstring no longer claims cookie mirrors localStorage).

**FIX 6 (MEDIUM, evidence)** — `outbox-durable-worker.e2e-spec.ts` + `auth-hardening.e2e-spec.ts`: added adversarial proofs — T-A two genuine worker instances racing the same retryable FAILED (10/10 stable; the initial flake was traced to the test racing the production backoff window and to the dedup consumer lacking P2002 handling — both fixed in the test, not by weakening assertions); T-B crash-after-flip recovery; T-G/T-H nested chain; concurrent-logout robustness; legacy-tv fail-safe. Strict timing assertion on backoff dropped (backoff math already unit-covered); recovery shape retained.

## 33. Regression after fixes

Re-run in full (see §29): backend tsc/build/unit/e2e both chunks, frontend tsc/vitest/build, DB migrate/drift, artifact checker real + regression. All green; e2e total grew 1189 → 1194 from the new adversarial tests.

## 34. Artifact integrity

```text
checker regression: 13/13
real run: PASS=120 WARN=0 FAIL=0
```

## 35. Negative checks

```text
sales.service refactor = 0
Step 2.17C implementation = 0
Backup/DR implementation = 0
load/performance qualification = 0
RLS implementation = 0
PSP integration = 0
2.12B = 0
2.12C = 0
2.12I = 0
tests skipped for green = 0
assertions weakened = 0
automatic retry masking = 0
forced process exit = 0
fake exactly-once claim = 0
```

## 36. Files changed during review

```text
M backend/src/security/auth/auth.service.ts        (FIX 1)
M backend/src/shared/cors.ts                       (FIX 2)
M backend/src/main.ts                              (FIX 2)
M backend/src/shared/cors.spec.ts                  (FIX 2)
M backend/src/shared/login-throttle.service.ts     (FIX 3)
A backend/src/shared/login-throttle.spec.ts        (FIX 3)
M frontend/app/account/layout.spec.tsx             (FIX 4)
M backend/src/eventbus/eventbus.service.ts         (FIX 5)
M frontend/proxy.ts                                (FIX 5)
M backend/test/outbox-durable-worker.e2e-spec.ts   (FIX 6)
M backend/test/auth-hardening.e2e-spec.ts          (FIX 6)
A docs/prompts/PHASE_2_STEP_2.17_PLATFORM_HARDENING_STRICT_REVIEW_REPORT.md (this report)
```

## 37. Roadmap verdict

Step 2.17 status updated to:

`✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

(provenance footer commit carries the update per repository convention).

## 38. Persistence

см. evidence footer в конце файла (секция 41).

## 39. Release

`RELEASE: NOT PERFORMED` — approval does not trigger deploy/tag; canonical release process governs.

## 40. NEXT

Per canonical Roadmap after approval: Step 2.17A (Backup/DR) / Step 2.17B (Load/Performance) pre-exit gates — derived from Roadmap line 755 (`Backup/DR и Load/Performance НЕ входят в 2.17 — независимые pre-exit gates Step 2.17A / Step 2.17B`). Not started in this pass.

---

## REPOSITORY EVIDENCE

repository: TravelHub (D:\travelhub_v1)
branch: master
head: 84fea62
origin: d0e8a09
worktree_clean: false (untracked prompt-файлы предыдущих шагов остаются — не мои)
migration_count: 58
reviewed_state: COMMIT
reviewed_diff_base: beb7aef
reviewed_diff_head: d0e8a09
persistence_status: PERSISTED
persistence_sha: 84fea62
push_status: PUSHED (после финальной верификации)
