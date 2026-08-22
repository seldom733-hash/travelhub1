# PHASE 2 — STEP 2.17 — PLATFORM HARDENING — STRICT REVIEW

## 0. MODE
**INDEPENDENT ADVERSARIAL STRICT REVIEW · REPOSITORY-FIRST · CODE IS AUTHORITY · REPORTS ARE CLAIMS, NOT EVIDENCE · REVIEW FIXES ALLOWED · NO NEXT-STEP IMPLEMENTATION**

Review the complete persisted Step 2.17 state, including the post-implementation flaky-E2E stabilization. The stabilization commit is part of the reviewed implementation surface. Do not review only the original implementation commit.

## 1. OBJECTIVE
Determine whether Step 2.17 can truthfully receive `STRICT REVIEW COMPLETED — APPROVED` or `APPROVED WITH REVIEW FIXES`.

Independently verify: CI/CD; PostgreSQL multi-schema CI; legacy isolation; token storage; logout/JWT revocation; `/auth/session`; login throttling; PermissionsGuard fail-closed; CORS allowlist; durable retry; durable PENDING publisher; multi-instance outbox safety; stabilization fix; event schema-version contract; ADMIN/SoD obligations; visibility/auditability; provenance; regression stability.

## 2. CANONICAL CONTRACT FIRST
Read the current Roadmap Step 2.17 and all directly referenced architecture/prompt/report artifacts before judging code. Build an acceptance matrix:
```text
requirement | source | hard gate/soft/deferred | implementation evidence | test evidence | verdict
```
Implementation reports may not redefine Roadmap obligations after the fact. A Roadmap hard gate cannot silently become "deferred".

## 3. REPOSITORY BASELINE
Run before edits:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -30
git diff
```
Verify actual Step 2.17 implementation commits, stabilization commit (`c20c5cb` if repository truth confirms it), stabilization provenance commit (`d0e8a09` if confirmed), migration count, worktree, Roadmap status and artifact-checker baseline. Repository truth overrides supplied SHAs.

## 4. REVIEWED DIFF
Find the exact pre-Step-2.17 base SHA. Review the complete diff from that base through current persisted Step 2.17 + stabilization state. Inspect every relevant production, test, migration, workflow, config and documentation change. Review fixes become part of final reviewed state.

## 5. CI/CD — HARD GATE
Verify `.github/workflows/ci.yml`:
- no root `npm ci` where root is not a package;
- backend/frontend correct working directories;
- PostgreSQL service, no legacy SQLite DB;
- canonical `prisma migrate deploy`;
- multi-schema assumptions;
- e2e prerequisites and isolated MinIO/required services;
- full serial e2e actually runs;
- workflow syntax valid;
- legacy excluded from canonical build/dependency resolution;
- failures are not silently ignored.
Do not claim hosted GitHub Actions success unless actually observed.

## 6. LEGACY ISOLATION — HARD GATE
Repository-wide inspect imports, workspace/package resolution, CI, build, Docker/runtime, scripts and docs.
Required:
```text
legacy deletion: NOT REQUIRED
legacy execution in canonical CI/runtime: 0
legacy authority over current DB/config/domain behavior: 0
```
No hidden SQLite path may affect canonical runtime/CI.

## 7. TOKEN STORAGE — HARD GATE
Verify:
- auth token absent from `localStorage`;
- absent from JS-readable cookie;
- canonical cookie HttpOnly;
- Secure behavior correct in production;
- SameSite/path/scope match approved contract;
- cookie + Authorization dual path is intentional/tested;
- no token leakage via logs, URLs, query strings, analytics/errors.
Search repository for old persistence paths.

## 8. LOGOUT REVOCATION — HARD GATE
Inspect `security.User.tokenVersion`, migration, JWT issue/validation. Prove:
1. version claim is issued;
2. validation compares it with current server value;
3. logout increments correctly;
4. all old tokens become unauthorized;
5. re-login token works;
6. multiple old tokens are invalidated;
7. missing/legacy claim fails safely;
8. deleted/invalid user fails safely;
9. concurrent logout cannot reduce/revert version;
10. internals are not leaked.
Add narrow adversarial tests if missing.

## 9. `/auth/session`
Verify public status does not mean auth bypass. Check missing/invalid/expired/revoked cookie, Authorization interaction, sensitive data, raw JWT exposure, read-only behavior and caching implications.

## 10. LOGIN THROTTLING
Verify key derivation, username normalization, IP/trusted-proxy assumptions, sliding window, bounded cleanup, controlled 429, no credential logging, enumeration behavior and per-instance limitation.

### 10A. MULTI-INSTANCE RATE LIMITER DEFERRAL
Read canonical Step 2.17 contract and classify:
```text
A. explicitly allowed to defer
B. Step 2.17 hard gate
C. ambiguous
```
If B, approval is forbidden while limiter remains per-instance. If C, resolve contract truth narrowly or BLOCK. Do not silently accept.

## 11. PERMISSIONSGUARD — HARD GATE
Adversarially verify required permission + missing/malformed user, missing/unknown permission all deny; valid permission allows; public-route semantics remain intentional; no permission-protected route silently no-ops.

## 12. CORS — HARD GATE
Verify `origin: true` is gone; explicit controlled allowlist; arbitrary origin rejected; allowed accepted; missing Origin intentional; credentials correct; wildcard+credentials impossible; malformed config fails safely; dev defaults do not leak to prod.

## 13. DURABLE RETRY — CRITICAL HARD GATE
Prove `retryFailed()` has a production caller and verify bounded loop, retryable/exhausted/poison semantics, attempts, no hot loop, crash/restart recovery, identity/causation preservation and no duplicate business side effects.

## 14. DURABLE PENDING PUBLISHER — CRITICAL HARD GATE
Prove PENDING events publish without HTTP traffic. Verify production startup, bounded polling/lifecycle, restart recovery, canonical event path, failure status semantics and no request-trigger dependency.

## 15. MULTI-INSTANCE OUTBOX — CRITICAL HARD GATE
Use at least two worker instances sharing one DB. Verify simultaneous wake/race, safe FAILED transition, no expected-race raw 500, no duplicate committed domain side effect, correct attempts/status, poison not resurrected, crash/restart recovery.

State actual semantics explicitly. If code implements it, use:
`at-least-once delivery + authoritative inbox/consumer idempotency`.
Never claim exactly-once unless actually proven.

## 16. STABILIZATION FIX — MANDATORY
Directly verify stabilization moved consumer delivery outside the advisory-lock interactive transaction and the lock transaction only performs the atomic retryable `FAILED → PENDING` transition.

Answer adversarially:
- can two workers publish the same PENDING event?
- what prevents duplicate business side effects?
- is Inbox dedup authoritative for every relevant consumer?
- are any consumers non-idempotent?
- can nested `publishPending()` become unsafe?
- crash after FAILED→PENDING before delivery: recoverable?
- delivery succeeds but status persistence fails: what happens?
- duplicate after consumer success: what happens?
- are old 5s transaction timeouts eliminated rather than merely less likely?

Add tests if evidence is incomplete.

## 17. WORKER SHUTDOWN/LIFECYCLE
Verify shutdown fences new iterations, clears timer, handles/awaits in-flight work safely, leaves no DB activity from closed Nest apps, and no open handles/forced exit.

## 18. ORPHAN INBOX HYGIENE
Review stabilization test cleanup for orphan InboxEvent rows. Prove cleanup is test-only and does not conceal a production invariant defect. Verify synthetic test state is legitimate or explicitly intentional and cleanup cannot race with a live worker.

## 19. EVENT SCHEMA VERSIONING
Inspect canonical envelope/payloads and Step 2.17 requirement. Determine whether final contract is envelope `schemaVersion`, payload-specific version, documented versionless V1, or another explicit compatibility policy. A docs-only decision is acceptable only if Step 2.17 required a decision rather than runtime implementation. Runtime requirement unmet => BLOCK.

## 20. ADMIN / SEGREGATION OF DUTIES
Classify the reported ADMIN SoD deferral:
```text
A. explicitly deferred
B. Step 2.17 hard gate
C. ambiguous
```
If B, approval is forbidden until satisfied. If C, resolve truth explicitly or block. Review ADMIN=ALL_PERMISSIONS, finance/security-sensitive actions and any prohibited initiate+approve combination against the actual canonical contract.

## 21. SECURITY VISIBILITY / AUDITABILITY
Verify all Step 2.17 obligations: no secrets/raw JWT/password/raw Idempotency-Key leakage, controlled errors, worker/retry/exhausted visibility and required audit events. Do not expand into a new observability platform unless required.

## 22. DATABASE/MIGRATION
Review tokenVersion migration: additive/safe, correct default/backfill, no destructive loss, schema/migration agreement, constraints/indexes as required, fresh replay, drift 0, actual migration count.

## 23. AUTH ADVERSARIAL MATRIX
Where missing, test:
- concurrent logouts;
- logout vs authenticated request;
- logout vs re-login/refresh if applicable;
- old token after increment;
- cookie + Authorization disagreement;
- revoked cookie + valid Authorization;
- invalid cookie + valid Authorization;
- valid cookie + invalid Authorization.
Credential precedence must be deterministic and documented/tested.

## 24. OUTBOX ADVERSARIAL MATRIX
At minimum inspect/test:
- T-A: two worker instances, same retryable FAILED;
- T-B: crash after FAILED→PENDING before delivery;
- T-C: consumer success + duplicate delivery;
- T-D: repeated failure to poison/exhausted;
- T-E: unknown/non-retryable DB/runtime error;
- T-F: shutdown during active iteration;
- T-G: nested event chain such as OrderRequested→OrderCreated→CommissionAccrual;
- T-H: long consumer chain exceeding old 5s transaction window.
Expected: no raw 500 for expected races, no duplicate committed business fact, durable recoverable state.

## 25. CI NEGATIVE CHECKS
Confirm absence of canonical regressions:
```text
root npm ci
legacy SQLite DATABASE_URL
db push
SQLite canonical test DB
legacy package execution
missing frontend/backend working-directory
missing migrate deploy
wrong e2e execution mode
```

## 26. REPOSITORY-WIDE SECURITY SEARCH
Search/classify:
- auth `localStorage`;
- JS-readable auth cookie;
- `origin: true`;
- hardcoded secrets;
- raw JWT/password logs;
- logout without revocation;
- permission fail-open;
- `retryFailed()` with no production caller;
- legacy imports;
- SQLite canonical CI config.
Classify legitimate docs/non-auth hits rather than blindly counting grep results.

## 27. REGRESSION STABILITY
Independently rerun:
Backend: typecheck, build, full unit, auth-hardening targeted e2e, durable-worker e2e, sale-completion/event chain, security/RBAC tests, full serial e2e, repeated formerly flaky suite/chunk.
Frontend: typecheck, Vitest, production build.
DB: canonical migrate/status, drift 0, fresh replay where supported.
Report actual counts only.

## 28. TEST QUALITY
Reject false confidence: tautological mocks, source-string-only proof where runtime proof is feasible, excessive sleeps, hidden retries, global-state assumptions, fake concurrency. Multi-instance tests must use genuinely distinct instances sharing the DB where required.

## 29. FINDING SEVERITY
- CRITICAL: security/data-loss/financial correctness/fundamental hard gate;
- HIGH: material production correctness/security/reliability;
- MEDIUM: real bounded defect;
- LOW: narrow correctness/test/docs;
- OBSERVATION: non-blocking fact.

Rules:
```text
unresolved CRITICAL/HIGH => BLOCK
unresolved hard gate at any severity => BLOCK
MEDIUM => fix/block unless canonical contract explicitly accepts
LOW => may fix in review
OBSERVATION => document
```

## 30. REVIEW FIXES
Narrow review fixes are allowed. For each: finding, severity, root cause, files, production change, test, regression, why still Step 2.17 scope. After production fix rerun affected regression + final full suite. No unrelated roadmap work.

## 31. ABSOLUTE NON-SCOPE
Do not start 2.17A Backup/DR, 2.17B load/performance, 2.17C Sales decomposition, 2.18, RLS implementation, PSP work, 2.12B, 2.12C or 2.12I. Do not refactor `sales.service.ts`.

## 32. ROADMAP VERDICT
Only after every hard gate passes may Step 2.17 become:
`✅ STRICT REVIEW COMPLETED — APPROVED`
or
`✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`.

If blocked, preserve truthful non-approved state and exact blocker. Approval does not automatically unblock unrelated downstream external dependencies.

## 33. REQUIRED REPORT
Create:
`docs/prompts/PHASE_2_STEP_2.17_PLATFORM_HARDENING_STRICT_REVIEW_REPORT.md`

Include at least 39 sections/items: executive verdict; baseline; SHA range; acceptance matrix; CI; multi-schema; legacy; token storage; revocation; session; throttle; multi-instance throttle decision; PermissionsGuard; CORS; durable retry; durable publisher; multi-instance outbox; stabilization; lifecycle; orphan Inbox; schemaVersion; ADMIN SoD; visibility; migration; auth matrix; outbox matrix; negative searches; test quality; findings; fixes; regression; artifact integrity; negative checks; files; Roadmap; persistence; Repository Evidence; release; NEXT.

## 34. ARTIFACT INTEGRITY
Run checker regression and real Roadmap checker.
Required:
```text
WARN = 0
FAIL = 0
```
Report actual PASS count. Do not hide genuine provenance warnings.

## 35. NEGATIVE CHECKS
Explicitly report:
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

## 36. GIT DISCIPLINE
Before staging:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git diff --stat
git diff
```
Never `git add .` or `git add -A`. Stage exact review files only. Inspect cached diff and preserve unrelated untracked prompts.

## 37. COMMIT / PUSH
If approved, commit the final reviewed state with an accurate message, e.g.:
```bash
git commit -m "review: approve phase 2.17 platform hardening"
```
or, for fixes:
```bash
git commit -m "fix(platform): apply phase 2.17 strict review fixes"
```
Follow established two-commit provenance convention if applicable. Push and verify final HEAD == upstream before claiming `PUSHED`.

If BLOCKED, persist truthful review evidence/blocker according to repository convention; never manufacture approval.

## 38. REPOSITORY EVIDENCE FOOTER
Use actual values:
```text
REPOSITORY EVIDENCE
repository:
branch:
reviewed_base_sha:
reviewed_head_before_review_fixes:
review_fix_commit_sha:
strict_review_commit_sha:
provenance_footer_commit_sha:
final_head_sha:
upstream_sha:
push_status:
worktree_clean:
migration_count:
artifact_integrity:
reviewed_state:
persistence_status:
release_status:
```
Use `N/A` where genuinely not applicable. Never fabricate SHAs.

## 39. RELEASE
Default:
`RELEASE: NOT PERFORMED`
Do not deploy/tag merely because review passes unless canonical process explicitly requires it.

## 40. SUCCESS FORMAT
```text
PHASE 2 STEP 2.17 STRICT REVIEW COMPLETED — APPROVED [WITH REVIEW FIXES]

Hard gates:
- CI/CD: PASS
- PostgreSQL multi-schema CI: PASS
- legacy isolation: PASS
- token storage: PASS
- logout revocation: PASS
- auth/session boundary: PASS
- login throttling: PASS
- PermissionsGuard fail-closed: PASS
- CORS allowlist: PASS
- durable retry: PASS
- durable PENDING publisher: PASS
- multi-instance outbox safety: PASS
- stabilization fix: PASS
- event schemaVersion contract: PASS
- ADMIN/SoD contract: PASS
- visibility/auditability: PASS

Delivery semantics:
- <actual; never fake exactly-once>

Deferred-gate decisions:
- multi-instance rate limiter: <ALLOWED / NOT ALLOWED / FIXED>
- ADMIN SoD decomposition: <ALLOWED / NOT ALLOWED / FIXED>

Findings:
- CRITICAL: <n>
- HIGH: <n>
- MEDIUM: <n>
- LOW: <n>
- review fixes: <actual>

Adversarial evidence:
- multi-worker race: <actual>
- crash after FAILED→PENDING: <actual>
- duplicate delivery after consumer success: <actual>
- poison/exhausted: <actual>
- shutdown during active iteration: <actual>
- long nested consumer chain: <actual>
- auth revocation/concurrency: <actual>

Regression:
- backend: <actual>
- frontend: <actual>
- DB: <actual>
- artifact integrity: PASS=<n> WARN=0 FAIL=0

Persistence:
- branch: <actual>
- reviewed base: <sha>
- review fix commit: <sha/N/A>
- strict review commit: <sha>
- provenance/footer commit: <sha/N/A>
- final HEAD: <sha>
- upstream: <sha>
- push_status: PUSHED
- worktree_clean: true|false

RELEASE: <actual>
NEXT: <derive from canonical Roadmap after approval; do not invent>
```

## 41. BLOCKED FORMAT
```text
PHASE 2 STEP 2.17 STRICT REVIEW COMPLETED — BLOCKED

Blocking findings:
- <requirement>
- <severity>
- <repository evidence>
- <why approval is forbidden>
- <required remediation>

Roadmap:
- Step 2.17 remains NOT APPROVED

Persistence:
- <actual>

RELEASE: NOT PERFORMED
NEXT: STEP 2.17 REMEDIATION
```

## 42. HARD STOP
After independent review, adversarial tests, narrow review fixes if required, complete regression, strict-review report, truthful Roadmap verdict, artifact checks, explicit staging, commit, push and final provenance verification: **STOP**.

Do not implement the next Roadmap step in this pass.
