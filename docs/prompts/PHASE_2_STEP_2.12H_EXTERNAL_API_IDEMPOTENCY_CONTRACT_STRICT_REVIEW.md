# PHASE 2 — STEP 2.12H — EXTERNAL API IDEMPOTENCY CONTRACT — STRICT REVIEW

## MODE

**STRICT REVIEW ONLY · REPOSITORY-FIRST · ADVERSARIAL · MULTI-INSTANCE · CRASH-WINDOW FOCUSED · PERSISTENCE REQUIRED**

Review the actual implementation of:

`PHASE 2 — STEP 2.12H — EXTERNAL API IDEMPOTENCY CONTRACT`

Do not trust the implementation report, reported test counts, or reported SHAs without verifying them from the repository.

The review must not start Step 2.12B.

## 1. PRIMARY OBJECTIVE

Prove that 2.12H establishes a safe external HTTP idempotency boundary that is:

- durable in PostgreSQL;
- multi-instance safe;
- principal-isolated;
- deterministic;
- safe for identical replay;
- fail-closed for divergent reuse;
- restart-safe;
- honest about crash windows;
- compatible with future 2.12B;
- separate from provider-operation identity;
- separate from inbox/outbox idempotency;
- non-invasive to Payment lifecycle authority;
- free from PSP/webhook/SPLIT scope creep.

The critical question is:

> Can a retried `payment.create` request ever create a second committed Payment/business fact after concurrency, crash, restart, or stale-slot recovery?

Do not approve unless the answer is independently proven to be no.

## 2. VERDICTS

Use exactly one:

- `PHASE 2 STEP 2.12H STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`
- `PHASE 2 STEP 2.12H STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 2 STEP 2.12H STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`
- `PHASE 2 STEP 2.12H STRICT REVIEW FAILED — REOPEN IMPLEMENTATION`

No unresolved HIGH/CRITICAL finding may be approved.

## 3. REPOSITORY BASELINE

Run:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -20
```

Verify current branch, HEAD/upstream, implementation/provenance commits, and worktree state. Do not touch unrelated untracked prompts.

## 4. REVIEW ACTUAL DIFF

Derive the true pre-2.12H SHA from Git history.

Inspect actual 2.12H implementation and provenance commits and create an exact changed-file inventory:

- production infrastructure;
- controller/interceptor/middleware;
- Prisma schema/migration;
- tests;
- docs;
- Roadmap;
- implementation report;
- provenance-only.

Unexpected files require explanation.

## 5. CLAIMS MATRIX

Build:

| Claim | Repository Evidence | Verdict |
|---|---|---|
| protected operation set minimal | route/metadata audit | PASS/FAIL |
| header validation correct | runtime/tests | PASS/FAIL |
| principal scope safe | auth pipeline + e2e | PASS/FAIL |
| fingerprint deterministic | code + adversarial tests | PASS/FAIL |
| PostgreSQL durable | schema/migration/runtime | PASS/FAIL |
| raw key not stored | schema/write/log audit | PASS/FAIL |
| DB uniqueness backstop | schema + concurrency | PASS/FAIL |
| identical replay safe | e2e/runtime | PASS/FAIL |
| divergent replay safe | e2e/runtime | PASS/FAIL |
| restart replay safe | fresh app/service context | PASS/FAIL |
| crash-window safe | transaction/recovery proof | PASS/FAIL |
| Payment authority preserved | write-path audit | PASS/FAIL |
| no PSP/webhook scope | route/dependency/runtime audit | PASS/FAIL |

## 6. PROTECTED ENDPOINT SET — HARD GATE

Verify the V1 protected set. Expected reported scope:

`POST /api/v1/finance/payments`

Prove:

- no unrelated endpoints were silently wrapped;
- operation identity is explicit/stable;
- unprotected routes behave exactly as before;
- future protected operations can be added without breaking existing slot semantics.

## 7. HEADER CONTRACT

Test:

- missing;
- empty;
- whitespace-only;
- length boundary;
- >128;
- valid characters;
- invalid printable characters;
- duplicate header values;
- case handling.

No raw framework errors or ambiguous array/comma behavior.

## 8. PRINCIPAL / TENANT ISOLATION — CRITICAL

Prove scope is derived from authenticated server context only.

Test:

- same literal key under different users;
- unauthorized request cannot discover/replay another slot;
- forbidden role cannot replay an authorized result;
- lookup occurs only after principal authority exists.

Do not claim RLS; ADR-0014 remains the DB isolation boundary.

## 9. AUTH/RBAC ORDERING — CRITICAL

Inspect actual Nest execution order:

- middleware;
- guards;
- pipes;
- interceptors;
- controller;
- filters.

Prove idempotency never bypasses auth/RBAC and that fingerprinting occurs at the correct validated boundary.

## 10. FINGERPRINT AUTHORITY — CRITICAL

Inspect exact canonicalization/digest logic.

Test:

- property insertion order;
- nested object ordering;
- arrays;
- omitted vs null;
- path params;
- relevant query params;
- stripped/forbidden fields;
- decimal-string semantics;
- currency semantics;
- volatile metadata exclusion.

Critical invariant:

> semantically identical requests produce the same fingerprint; semantically different requests cannot silently collide.

## 11. SLOT KEY / RAW KEY

Inspect slot-key construction.

Prove slot identity includes the correct canonical dimensions:

- principal scope;
- operation;
- opaque external key digest/reference.

Audit delimiter/encoding/collision ambiguity.

Verify raw `Idempotency-Key` is not persisted or unnecessarily logged if the implementation claims digest-only storage.

Search schema, SQL, logs, AuditLog, exceptions and tests.

## 12. DB MODEL / MIGRATION

Inspect Prisma schema and migration SQL directly.

Verify:

- additive only;
- correct unique constraint;
- required indexes;
- bounded fields;
- no fabricated backfill;
- schema and migration agree;
- fresh replay works;
- drift = 0.

## 13. DB UNIQUENESS — MULTI-INSTANCE HARD GATE

Prove correctness is enforced by PostgreSQL, not process-local state.

Inspect:

- unique constraint;
- claim insert;
- P2002 handling;
- row lock/advisory lock/CAS if used;
- transaction isolation assumptions.

Expected uniqueness races must never leak raw Prisma errors/500.

## 14. CONCURRENT IDENTICAL REQUESTS

Use independent application/service contexts and independent DB transactions where practical.

Same principal + operation + key + fingerprint.

Prove:

- one idempotency record;
- one Payment/business fact;
- no duplicate Payment event/history;
- second caller gets documented replay/in-progress behavior;
- no raw 500.

## 15. CONCURRENT DIVERGENT REQUESTS

Same principal + operation + key, different semantic payload.

Prove:

- one canonical execution;
- divergent request gets controlled conflict;
- no wrong response replay;
- no second Payment;
- stored fingerprint is not replaced.

## 16. RESTART / SECOND INSTANCE REPLAY

Use a fresh Nest app/service context against the same DB.

Prove completed retry replays from PostgreSQL without re-executing Payment creation or relying on process memory.

## 17. CRASH WINDOWS — CRITICAL HARD GATE

Independently inspect transaction boundaries and prove behavior for:

A. slot claimed → process dies before Payment write  
B. Payment transaction rolls back  
C. Payment COMMITTED → process dies before idempotency record becomes COMPLETED  
D. idempotency record COMPLETED → HTTP response lost

Do not accept documentation claims without executable or code-level proof.

## 18. CRASH WINDOW C — REQUIRED FAULT INJECTION

This is the highest-risk case.

Simulate/fault-inject:

`Payment commit succeeds, then completion of ExternalIdempotencyRecord fails/is skipped`

Then retry after stale recovery.

Required proof:

- second Payment is not created;
- no duplicate PaymentCreated/history side effect;
- retry resolves to original business result;
- divergent retry cannot hijack recovery;
- raw 500 = 0.

If safety depends on PaymentService business idempotency, identify and prove its exact DB invariant.

Any duplicate committed Payment path = CRITICAL.

## 19. STALE-CAS RECOVERY

Inspect stale recovery:

- stale definition;
- timeout/threshold source;
- CAS/version/status guard;
- concurrent reclaimers;
- completed record unreclaimable;
- active non-stale request not stolen;
- poisoned IN_PROGRESS recovery;
- no process-local authority.

If an arbitrary timeout was invented, classify and document whether architecture/policy is needed.

## 20. CLOCK / TIME SEMANTICS

If staleness is time-based, audit:

- DB time vs app time;
- UTC;
- instance clock skew;
- precision;
- future timestamps.

Prefer DB-authoritative time when correctness depends on timestamp comparisons.

## 21. BUSINESS IDEMPOTENCY DEPENDENCY

If crash safety relies on PaymentService's internal idempotency:

- identify exact business identity;
- identify exact unique constraint;
- inspect identical/divergent behavior;
- prove it exists in production code and DB;
- prove it remains safe under concurrent retry.

Document layered guarantees separately:

`HTTP idempotency slot + Payment business invariant`

Do not conflate them.

## 22. RESPONSE REPLAY

Inspect stored response semantics.

Verify:

- correct HTTP status;
- correct response body/business result;
- no Authorization/Set-Cookie;
- no first-request tracing/request IDs;
- no secrets;
- no unnecessary PII;
- no duplicate business event/audit side effect on replay.

## 23. FAILURE SEMANTICS

Verify and test:

- auth 401;
- RBAC 403;
- validation 4xx;
- domain 409/422;
- transaction rollback;
- unexpected 500;
- known DB race.

For each determine whether slot is never claimed, recoverable, completed, or remains IN_PROGRESS.

No false completed success and no permanently poisoned slot without explicit contract.

## 24. IN-PROGRESS DUPLICATE

Verify bounded deterministic behavior.

No indefinite wait, busy loop, local polling authority or fabricated success.

## 25. PAYMENT LIFECYCLE AUTHORITY

Repo-wide audit all Payment writers after 2.12H.

Idempotency layer may invoke canonical PaymentService but must not directly mutate:

- status;
- version;
- milestones;
- amount;
- currency.

Any direct Payment write from idempotency infrastructure is HIGH/CRITICAL.

## 26. PROVIDER-OPERATION IDENTITY BOUNDARY

Verify external `Idempotency-Key` never becomes client authority for `deriveProviderOperationKey` or equivalent.

2.12A provider-operation identity remains server-derived and separate.

## 27. INBOX / OUTBOX SEPARATION

Verify ExternalIdempotencyRecord is distinct from InboxEvent/Outbox.

No fake event-based HTTP request dedup.

EventBus semantics must remain unchanged.

## 28. DOMAIN EVENTS — ZERO NEW CONTRACT

Expected: 0 new business domain events.

Any new event needs explicit contract evidence.

## 29. PSP / WEBHOOK NEGATIVE AUDIT

Repo-wide prove zero new:

- PSP SDK/network;
- provider credentials;
- webhook/callback route;
- signature verifier;
- raw-body PSP middleware;
- provider event dedup;
- callback reorder runtime.

Any such code is 2.12B scope creep.

## 30. SPLIT / COMMISSION NEGATIVE AUDIT

Prove zero native split/platform fee/connected-account/commission injection and no CommissionPolicy/Commission/CommissionAccrual runtime change.

2.12E regression must remain green.

## 31. CROSS-DOMAIN FINANCE NEGATIVE AUDIT

Prove 2.12H introduces no new:

- LedgerTransaction;
- ProviderFee;
- Settlement;
- Payout;
- Refund;
- Dispute;
- Invoice.

## 32. PLATFORM-RISK BOUNDARIES

Verify:

- RLS = 0;
- global event schemaVersion retrofit = 0;
- Backup/DR = 0;
- load framework = 0;
- Step 2.17 CI/outbox/legacy work = 0.

Concurrency tests are not load qualification.

## 33. RETENTION / DATA GROWTH

Inspect retention/expiry/cleanup policy.

Do not invent retention duration if none is canonical.

Review obvious operational hazards:

- unbounded key/body/response storage;
- missing lookup indexes;
- table scan per request;
- indefinite stale records.

## 34. SECURITY / PII / LOGGING

Inspect logs, errors, audit and stored response.

Prove no raw key leak, Authorization token, cookies, secrets, payment credentials or unnecessary PII.

## 35. TEST QUALITY AUDIT

Read actual T1–T19 tests.

Look for:

- mocks bypassing production interceptor;
- fake concurrency;
- restart test reusing singleton state;
- cross-principal test accidentally using same user;
- source grep presented as runtime proof;
- race tests serialized by awaits;
- failure tests not reaching real business service.

Strengthen where needed.

## 36. REQUIRED ADVERSARIAL REVIEW TESTS

Add if absent:

1. duplicate header values;
2. property-order-independent fingerprint;
3. nested canonicalization;
4. omitted vs null according to contract;
5. forbidden/stripped-field behavior;
6. cross-principal same key;
7. concurrent identical via independent contexts;
8. concurrent divergent;
9. crash after Payment commit before idempotency completion;
10. concurrent stale reclaim;
11. completed record cannot be reclaimed;
12. active non-stale record cannot be stolen;
13. replay does not duplicate Payment event/history;
14. raw key not persisted/logged;
15. unknown P2002 not treated as replay;
16. unknown internal error not converted into false completed result.

## 37. P2002 / ERROR HANDLING

Audit every P2002 catch.

Known idempotency unique conflict may represent concurrent claim.

Unknown P2002 must not become success/no-op.

Non-P2002 must not be swallowed.

Add unit tests if absent.

## 38. API / ARCHITECTURE DOCS

Verify docs accurately state:

- protected endpoint;
- header rules;
- principal/operation scope;
- fingerprint;
- identical retry;
- divergent reuse;
- in-progress behavior;
- failure/replay semantics;
- crash-window C;
- stale recovery;
- dependence on Payment business idempotency;
- guarantees and non-guarantees;
- no network exactly-once claim.

Fix overclaims.

## 39. MIGRATION / FRESH REPLAY / DRIFT

Run actual:

- migrate status;
- fresh replay through canonical harness;
- live→schema drift check.

Reported 57/57 is not evidence until reproduced.

No `db push`.

## 40. FULL REGRESSION

Run actual current commands.

Backend:
- typecheck;
- build;
- full unit;
- targeted idempotency unit/e2e;
- Payment/provider/RBAC regression;
- EventBus regression where relevant;
- full serial e2e.

Frontend:
- typecheck;
- Vitest;
- production build.

DB:
- migration status;
- fresh replay;
- drift.

Report actual counts only.

## 41. ARTIFACT INTEGRITY

Run checker regression + real Roadmap checker.

Hard requirement:

`FAIL = 0`

Prefer:

`WARN = 0`

Create the Strict Review report before Roadmap cites it.

## 42. STRICT REVIEW REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.12H_EXTERNAL_API_IDEMPOTENCY_CONTRACT_STRICT_REVIEW_REPORT.md`

Required sections:

1 Verdict
2 Methodology
3 Repository baseline
4 Reviewed diff/provenance
5 Claims matrix
6 Protected operations
7 Header contract
8 Principal scope
9 Auth/RBAC ordering
10 Fingerprint authority
11 Validation/mass-assignment ordering
12 Slot-key construction
13 Raw-key storage
14 DB model/migration
15 DB uniqueness
16 Concurrent identical
17 Concurrent divergent
18 Restart replay
19 Crash-window analysis
20 Crash-window C proof
21 Stale-CAS recovery
22 Time semantics
23 Business-idempotency dependency
24 Replay contract
25 Failure semantics
26 In-progress behavior
27 Payment lifecycle authority
28 Provider-operation boundary
29 Inbox/outbox separation
30 Domain events
31 PSP/webhook boundary
32 Split/Commission boundary
33 Cross-domain Finance boundary
34 Platform-risk boundaries
35 Retention/data growth
36 Security/PII/logging
37 Test quality
38 Adversarial tests
39 P2002/error handling
40 API docs
41 Architecture docs
42 Migration/fresh replay
43 Findings
44 Review fixes
45 Observations
46 Backend regression
47 Frontend regression
48 DB regression
49 Artifact integrity
50 Negative checks
51 Files changed
52 Roadmap/dependency update
53 Persistence
54 Repository Evidence
55 Release
56 Exact NEXT
57 Final statement

## 43. ROADMAP UPDATE

Only after verdict.

If approved, set 2.12H to the exact approved status and NEXT to the exact canonical Step 2.12B title from the current Roadmap.

Do not start 2.12B in this pass.

## 44. NEGATIVE CHECKS — FINAL

Prove final state still has:

- real PSP network 0;
- production PSP adapters 0;
- webhook/callback routes 0;
- signature verification 0;
- provider webhook dedup 0;
- AUTHORIZED transition 0 unless later owned by 2.12B;
- SPLIT_AT_PAYMENT 0;
- Commission authority changes 0;
- Ledger/ProviderFee/Settlement/Payout runtime changes 0;
- provider Refund/Dispute execution 0;
- RLS 0;
- global schemaVersion retrofit 0;
- Backup/DR 0;
- load framework 0;
- Step 2.17 implementation 0;
- Step 2.12B implementation 0.

## 45. GIT PERSISTENCE — REQUIRED

Before staging:

```bash
git status --short
git diff --stat
git diff
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
```

Never use `git add .` or `git add -A`.

Stage only exact review report/fixes/tests/docs/Roadmap files.

Inspect staged diff before commit.

Suggested commit:

```bash
git commit -m "fix(platform): complete strict review for external API idempotency"
```

If no production fixes, use an accurate docs/test message.

Push normally, never force.

Verify HEAD equals upstream before claiming PUSHED.

## 46. REPOSITORY EVIDENCE

Use:

`docs/prompts/REPOSITORY_EVIDENCE_FOOTER_TEMPLATE.md`

Record actual repository, branch, HEAD, upstream, worktree state, migration count, reviewed diff base/head, persistence SHA and push status.

Use established second footer/provenance commit if required.

Never invent future SHA.

## 47. RELEASE

`RELEASE: NOT PERFORMED — NEXT DEPENDENCY STEP REQUIRED`

No deploy/tag/production migration.

## 48. FINAL RESPONSE FORMAT

On approval:

```text
PHASE 2 STEP 2.12H STRICT REVIEW COMPLETED — APPROVED [WITH REVIEW FIXES]

Hard gates:
- principal isolation: PASS
- auth/RBAC ordering: PASS
- deterministic fingerprint: PASS
- raw key persistence: 0
- DB uniqueness backstop: PASS
- concurrent identical: PASS
- concurrent divergent: PASS
- restart replay: PASS
- crash-window C duplicate prevention: PASS
- stale-CAS recovery: PASS
- Payment lifecycle authority: PASS
- provider-operation boundary: PASS
- real PSP network: 0
- webhook routes: 0
- SPLIT_AT_PAYMENT: 0

Findings:
- <actual>

Regression:
- backend: <actual>
- frontend: <actual>
- DB: <actual>
- artifact integrity: PASS=<N> WARN=<N> FAIL=0

Persistence:
- branch: <branch>
- review commit: <sha>
- provenance/footer commit: <sha or N/A>
- final HEAD: <sha>
- upstream: <sha>
- push_status: PUSHED
- worktree_clean: true|false

RELEASE: NOT PERFORMED — NEXT DEPENDENCY STEP REQUIRED
NEXT: PHASE 2 — STEP 2.12B — <exact canonical title>
```

## 49. HARD STOP

After independent audit, crash-window proof, adversarial concurrency/replay tests, fixes if needed, full regression, report, Roadmap update, artifact checker, explicit staging, commit, push, upstream verification and Repository Evidence:

**STOP.**

Do not implement Step 2.12B in this pass.
