# PHASE 2 --- STEP 2.12H --- EXTERNAL API IDEMPOTENCY CONTRACT --- IMPLEMENTATION

## EXECUTION MODE

**IMPLEMENTATION PASS · REPOSITORY-FIRST · FAIL-CLOSED · MULTI-INSTANCE
SAFE · NO PSP/WEBHOOK EXPANSION**

Implement the canonical Roadmap step **2.12H --- External API
Idempotency Contract**.

Canonical dependency chain:

`2.12A APPROVED → 2.12H IMPLEMENTATION → 2.12H STRICT REVIEW → 2.12B`

Do not start 2.12B in this pass. Do not trust previous reports as
repository truth; verify current HEAD, Roadmap, ADRs, code, schema,
migrations, API pipeline and tests first.

## 1. PREREQUISITE VERIFICATION

Independently verify current repository truth:

-   2.12A is `STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`;
-   PaymentService remains the Payment lifecycle authority;
-   real PSP network = 0;
-   production PSP adapters = 0;
-   webhook routes = 0;
-   external HTTP `Idempotency-Key` runtime = 0;
-   provider-operation identity is server-derived;
-   AUTHORIZED remains unreachable;
-   SPLIT_AT_PAYMENT = 0;
-   2.12H is the canonical prerequisite of 2.12B.

If materially false, stop:

`PHASE 2 STEP 2.12H BLOCKED — PREREQUISITE/REPOSITORY STATE MISMATCH`

## 2. OBJECTIVE

Implement durable external HTTP request idempotency protecting selected
mutating API operations against client/proxy retry, concurrent
duplicates, divergent reuse, different application instances, process
restart, and response loss after commit.

Keep separate:

-   external API idempotency;
-   2.12A provider-operation identity;
-   EventBus inbox dedup;
-   outbox publication;
-   future PSP webhook dedup.

## 3. CORE CONTRACT --- HARD GATE

Client supplies only opaque `Idempotency-Key`.

Server derives:

`principal/tenant scope + canonical operation + canonical validated request fingerprint`

Classify every protected request as:

1.  first execution;
2.  identical retry;
3.  divergent key reuse;
4.  in-progress duplicate;
5.  completed replay.

Never trust client-supplied hashes, amount authority, provider identity
or operation fingerprint.

## 4. REPOSITORY DISCOVERY

Before coding inspect Roadmap 2.12H, 2.12A architecture/report/review,
relevant ADRs, Nest bootstrap, auth/RBAC pipeline, mutating controllers,
DTO validation, Prisma schema, transactions, error taxonomy,
audit/history conventions and e2e harness.

Repo-wide search:

``` text
Idempotency-Key
idempotency
dedup
fingerprint
replay
inbox
outbox
P2002
ConflictError
middleware
interceptor
```

Document reusable infrastructure versus unrelated internal idempotency.

## 5. PROTECTED OPERATION SET

Derive the V1 protected endpoint set from canonical Roadmap/API
architecture.

Do not blindly wrap every POST/PATCH/DELETE.

At minimum evaluate the payment/payment-initiation boundary needed by
future 2.12B. If no exact canonical set exists, choose the minimal
PSP-readiness set and document the decision.

Use explicit operation metadata/registry/decorator or equivalent stable
mechanism.

## 6. HEADER CONTRACT

For protected operations:

-   `Idempotency-Key` required;
-   opaque;
-   bounded length and character set;
-   empty/whitespace-only rejected;
-   duplicate/multiple header values handled deterministically;
-   no PII/secrets;
-   no provider semantics;
-   no client-controlled fingerprint.

Document exact validation behavior.

## 7. PRINCIPAL/TENANT ISOLATION --- CRITICAL

Scope keys using authenticated server context. A guessed literal key
must never replay another user's/partner's result.

Prove:

-   same literal key for different principals is isolated;
-   response lookup occurs only after principal scope is established;
-   auth/RBAC cannot be bypassed by replay.

RLS remains deferred under ADR-0014; do not claim DB RLS.

## 8. OPERATION IDENTITY

Use stable server-derived operation identity. Do not depend on host,
trace/request ID, timestamp, process instance, random UUID, unstable raw
URL or object insertion order.

Same key on another operation must not replay the wrong response.

## 9. REQUEST FINGERPRINT --- CRITICAL

Fingerprint the validated/canonical server-side semantic request.

Requirements:

-   deterministic across instances/restarts;
-   property-order independent;
-   includes relevant path params;
-   query only when semantically relevant;
-   excludes Idempotency-Key/auth/tracing/volatile metadata;
-   no JS-float money normalization;
-   respects endpoint money/currency semantics;
-   stable cryptographic digest.

Do not generic-normalize values that the endpoint intentionally treats
as fail-loud distinct values.

## 10. IDENTICAL/DIVERGENT SEMANTICS

-   New slot → execute once.
-   Same scope+operation+fingerprint → retry/replay.
-   Same slot with divergent fingerprint → controlled conflict.
-   Different principal → isolated.
-   Different operation → deterministic independent slot or controlled
    conflict according to documented composite identity.

Silent divergent success is forbidden.

## 11. DURABLE PERSISTENCE --- HARD GATE

PostgreSQL is correctness authority. No in-memory map/cache as
authority.

Add the minimal persistence model needed for:

-   scoped key or safe deterministic representation;
-   operation;
-   fingerprint;
-   lifecycle;
-   replayable result/status;
-   timestamps;
-   version/CAS only if required.

Do not store Authorization, cookies, secrets, unnecessary PII or raw
sensitive request bodies.

Make an explicit raw-key vs digest storage decision and justify it.

## 12. DB UNIQUENESS / MULTI-INSTANCE --- CRITICAL

Enforce the canonical idempotency slot with a DB unique
constraint/backstop.

Two application instances must not both execute the protected business
side effect.

Use repository-approved transaction/locking/CAS/P2002 patterns. No
process-local mutex as correctness authority.

Expected races must never leak raw Prisma errors/500.

## 13. TRANSACTION / CRASH WINDOWS --- CRITICAL

Explicitly analyze:

1.  before claim;
2.  after claim before business write;
3.  after business write before stored replay result;
4.  after stored result before HTTP response;
5.  process death mid-operation.

Do not claim impossible exactly-once network delivery.

Prefer transactionally coherent idempotency claim + business mutation
where repository architecture permits. If an unavoidable duplicate
committed-side-effect window remains for the future 2.12B path, stop and
report architecture block.

## 14. IN-PROGRESS DUPLICATE

Define bounded, deterministic multi-instance behavior: DB serialization,
wait/re-read, or controlled retry/conflict.

No indefinite local waiting and no fabricated success.

## 15. RESPONSE REPLAY

Replay only safe client-visible semantics required by the endpoint:

-   HTTP status;
-   response body/business result;
-   only safe relevant headers.

Never replay Authorization, Set-Cookie, secrets, internal errors, or the
first request's tracing/request IDs.

Document whether business-result replay or byte-identical transport
replay is canonical.

## 16. FAILURE POLICY

Explicitly define:

-   pre-business auth/RBAC/validation failure;
-   deterministic business rejection;
-   transaction rollback;
-   unexpected 5xx;
-   ambiguous commit state.

Do not permanently poison a key after a rolled-back execution unless
canonical policy explicitly requires it.

Use a minimal explicit lifecycle such as `IN_PROGRESS → COMPLETED` only
if it matches the implementation.

## 17. RETENTION

Search for canonical retention authority. If none exists, do not invent
a business retention number.

Prefer an explicit V1 no-auto-expiry/deferred-cleanup decision or
configurable policy without fabricated default. Cleanup jobs are not
automatically in scope.

## 18. SECURITY PIPELINE --- HARD GATE

Idempotency must not bypass auth or RBAC.

Test:

-   unauthenticated replay;
-   cross-principal replay;
-   role/permission failure;
-   same key after security-context change according to actual canonical
    auth behavior;
-   oversized/malformed/control-character key;
-   duplicate header values;
-   raw key leakage in logs/errors;
-   sensitive response-header replay.

Do not silently fix unrelated logout revocation or global fail-open
guard debt unless required for safe 2.12H; preserve its Roadmap owner.

## 19. PAYMENT / PROVIDER BOUNDARY

2.12H coordinates external request execution/replay only.

It must not own or mutate:

-   Payment status/milestones/amount/currency;
-   provider status;
-   Refund;
-   Dispute;
-   Commission;
-   Ledger;
-   ProviderFee;
-   Settlement;
-   Payout;
-   Invoice.

PaymentService remains lifecycle authority.

External Idempotency-Key must not become provider-operation identity.
Future mapping remains:

`external request → canonical business fact → server-derived provider operation`.

## 20. ABSOLUTE SCOPE CONTAINMENT

This pass implements zero:

-   real PSP SDK/network;
-   production PSP adapter;
-   webhook/callback endpoint;
-   webhook signature verification;
-   webhook dedup/reorder handling;
-   provider credentials;
-   AUTHORIZED Payment transition;
-   SPLIT_AT_PAYMENT/native PSP split;
-   RLS;
-   global event schemaVersion retrofit;
-   Backup/DR;
-   load-test framework;
-   Step 2.17 CI/outbox/legacy hardening;
-   Step 2.12B.

Expected new business domain events: 0 unless canonical Roadmap
explicitly requires otherwise.

## 21. REQUIRED ADVERSARIAL UNIT TESTS

Cover as applicable:

-   independent equivalent objects → same fingerprint;
-   property insertion order;
-   nested ordering;
-   array order preserved when semantic;
-   decimal string semantics (`150.00` vs `150`) according to endpoint
    contract;
-   currency case according to DTO contract;
-   path param divergence;
-   omitted vs null when semantically different;
-   volatile transport metadata excluded;
-   different principal/operation/request → correct divergent identity.

## 22. REQUIRED E2E MATRIX

At minimum:

-   T1 missing key → controlled 4xx;
-   T2 malformed key → controlled 4xx;
-   T3 first request → one business fact + one idempotency fact;
-   T4 identical retry → same business result, no duplicate fact;
-   T5 divergent body → controlled conflict;
-   T6 divergent path/aggregate → no wrong replay;
-   T7 concurrent identical → exactly one business fact;
-   T8 concurrent divergent → one execution + controlled conflict;
-   T9 service/app reconstruction → DB-backed replay;
-   T10 cross-principal same literal key → isolated;
-   T11 auth failure → no replay leakage;
-   T12 RBAC failure → no bypass;
-   T13 rolled-back business operation → no false completed success;
-   T14 response replay status/body semantics;
-   T15 unsafe/volatile headers not replayed;
-   T16 unprotected endpoint unchanged;
-   T17 idempotency layer does not transition Payment itself;
-   T18 no PSP/webhook runtime;
-   T19 DB race backstop → no raw 500.

Use genuine DB concurrency. Same-instance `Promise.all` alone is not
proof unless it exercises independent DB transactions/contexts.

## 23. MIGRATION

If persistence is added:

-   additive migration only;
-   no fabricated backfill;
-   no `db push`;
-   explicit unique/index constraints;
-   schema SQL matches Prisma;
-   fresh replay passes;
-   drift 0.

Do not reuse legacy SQLite structures.

## 24. DOCUMENTATION

Create:

`docs/architecture/external-api-idempotency-contract.md`

Cover purpose/non-goals, terminology, protected operations, header,
scope, operation identity, fingerprint, persistence, uniqueness, state
machine, transaction/crash windows, concurrency, replay, errors, failure
policy, retention, auth/RBAC, logging/PII, multi-instance guarantees and
non-guarantees, 2.12A integration, 2.12B handoff, Step 2.17 boundary,
invariants/tests/deferred items.

Update canonical API docs with the external contract.

## 25. IMPLEMENTATION REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.12H_EXTERNAL_API_IDEMPOTENCY_CONTRACT_IMPLEMENTATION_REPORT.md`

Include at least:

1.  verdict;
2.  repository baseline/prerequisites;
3.  discovered existing mechanisms;
4.  protected endpoint set;
5.  header contract;
6.  principal/tenant scope;
7.  operation identity;
8.  fingerprint;
9.  persistence/raw-key decision;
10. DB uniqueness;
11. state machine;
12. transaction/crash-window design;
13. identical/divergent/in-progress/replay semantics;
14. failure/retention policy;
15. auth/RBAC;
16. Payment/provider/inbox-outbox boundaries;
17. multi-instance proof;
18. logging/PII;
19. schema/migration;
20. write-path audit;
21. PSP/webhook/SPLIT/cross-domain negative audits;
22. RLS/schemaVersion/DR/load/2.17 boundaries;
23. unit/e2e results;
24. backend/frontend/DB regression;
25. artifact integrity;
26. docs/files changed;
27. findings/fixes/observations;
28. Roadmap;
29. persistence + Repository Evidence;
30. release;
31. exact NEXT.

## 26. ROADMAP

Only after implementation and regression succeed:

2.12H →

`🚧 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

NEXT →

`PHASE 2 — STEP 2.12H — STRICT REVIEW`

Preserve:

`2.12A APPROVED → 2.12H impl → 2.12H SR → 2.12B`

Do not start/approve 2.12B.

## 27. REGRESSION --- REQUIRED

Run actual current repository commands, not historical counts.

Backend: - typecheck; - build; - full unit; - targeted idempotency
tests; - targeted Payment/provider/RBAC/EventBus regression; - full
serial e2e.

Frontend even if untouched: - typecheck; - Vitest; - production build.

DB: - migrate/status; - fresh replay via canonical harness; - drift
check.

Report actual counts.

## 28. ARTIFACT INTEGRITY

Run checker regression and real Roadmap artifact checker.

Hard requirement:

`FAIL = 0`

Prefer:

`WARN = 0`

Never let Roadmap cite a report that does not exist.

## 29. NEGATIVE CHECKS

Final report must explicitly prove:

-   real PSP network 0;
-   production PSP adapters added 0;
-   webhook/callback routes added 0;
-   signature verification 0;
-   provider webhook dedup 0;
-   AUTHORIZED transition 0;
-   SPLIT_AT_PAYMENT 0;
-   Commission authority change 0;
-   Ledger/ProviderFee/Settlement/Payout changes 0;
-   provider Refund/Dispute execution 0;
-   RLS 0;
-   global schemaVersion retrofit 0;
-   Backup/DR 0;
-   load framework 0;
-   Step 2.17 implementation 0;
-   Step 2.12B implementation 0.

## 30. STOP CONDITIONS

Stop with:

`PHASE 2 STEP 2.12H BLOCKED — ARCHITECTURE DECISION REQUIRED`

instead of inventing policy if:

-   protected endpoint authority cannot be derived safely;
-   principal/tenant scope is ambiguous enough to risk data leakage;
-   transaction boundaries leave an unavoidable duplicate
    committed-side-effect window;
-   safe replay requires an unresolved canonical API decision;
-   implementation requires PSP/webhook scope;
-   implementation requires global Step 2.17 redesign.

## 31. GIT SAFETY / COMMIT / PUSH --- REQUIRED

Before work and before staging inspect:

``` bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git diff --stat
git diff
```

Never use `git add .` or `git add -A`.

Stage only exact 2.12H files and inspect:

``` bash
git diff --cached --stat
git diff --cached
git status --short
```

Suggested implementation commit:

``` bash
git commit -m "feat(platform): add external API idempotency contract"
```

Push normally, never force:

``` bash
git push
git rev-parse HEAD
git rev-parse --verify @{u}
```

Claim `PUSHED` only when HEAD equals upstream.

Preserve unrelated untracked prompts.

## 32. REPOSITORY EVIDENCE --- REQUIRED

Use:

`docs/prompts/REPOSITORY_EVIDENCE_FOOTER_TEMPLATE.md`

Populate actual repository/branch/HEAD/upstream/worktree/migration
count/reviewed diff/persistence SHA/push status.

If the report needs the final SHA after its first commit, use the
established two-commit pattern:

1.  implementation commit;
2.  provenance/footer commit.

Never invent future SHAs.

## 33. RELEASE

No production release.

Record exactly:

`RELEASE: NOT PERFORMED — STRICT REVIEW REQUIRED`

No tag/deploy/production migration.

## 34. FINAL RESPONSE FORMAT

``` text
PHASE 2 STEP 2.12H IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW

External API idempotency:
- protected operations: <actual>
- Idempotency-Key contract: <actual>
- principal/tenant scope: <actual>
- operation identity: SERVER-DERIVED
- request fingerprint: SERVER-DERIVED / DETERMINISTIC
- persistence: POSTGRESQL
- DB uniqueness backstop: PASS
- identical retry: PASS
- divergent reuse: CONTROLLED CONFLICT
- concurrent identical: PASS
- concurrent divergent: PASS
- restart/reconstruction replay: PASS
- auth/RBAC isolation: PASS
- Payment lifecycle authority: PRESERVED
- provider-operation identity boundary: PRESERVED
- real PSP network: 0
- production PSP adapters added: 0
- webhook routes added: 0
- SPLIT_AT_PAYMENT: 0
- Step 2.12B: NOT STARTED

Findings/fixes:
- <actual>

Regression:
- backend: <actual>
- frontend: <actual>
- DB: <actual>
- artifact integrity: PASS=<N> WARN=<N> FAIL=0

Persistence:
- branch: <actual>
- implementation commit: <sha>
- provenance/footer commit: <sha or N/A>
- final HEAD: <sha>
- upstream: <sha>
- push_status: PUSHED
- worktree_clean: true|false

RELEASE: NOT PERFORMED — STRICT REVIEW REQUIRED
NEXT: PHASE 2 — STEP 2.12H — STRICT REVIEW
```

## 35. HARD STOP

After repository-first discovery, implementation, adversarial tests,
DB-backed concurrency proof, full regression, docs/report/Roadmap,
artifact checker, explicit staging, commit, push, upstream verification
and Repository Evidence: **STOP**.

Do not execute Strict Review in this pass.

Do not start 2.12B.

The only valid NEXT is:

`PHASE 2 — STEP 2.12H — STRICT REVIEW`
