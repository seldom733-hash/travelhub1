# PHASE 2 — STEP 2.12A — PAYMENT PROVIDER ABSTRACTION — STRICT REVIEW

## ADVERSARIAL · REPOSITORY-FIRST · INDEPENDENT VERIFICATION · PERSISTENCE REQUIRED

## 0. MODE

**STRICT REVIEW ONLY · NO FEATURE EXPANSION · DO NOT TRUST THE IMPLEMENTATION REPORT**

Review `PHASE 2 — STEP 2.12A — PAYMENT PROVIDER ABSTRACTION`.

Reported state to verify independently: real network 0; production PSP adapters 0; webhook routes 0; SPLIT_AT_PAYMENT 0; external HTTP Idempotency-Key runtime 0; PSP-local multi-instance contract defined; 2.12H/2.12B dependencies preserved; PaymentService remains lifecycle authority; AUTHORIZED remains reserved; 0 new domain events/writers/schema changes. Reported commits `b3307cc` and `bb98fba` and all reported test counts are claims, not evidence.

## 1. OBJECTIVE

Prove that 2.12A is a minimal provider-neutral foundation for:

`2.12A → 2.12H → 2.12B → dependent PSP/Finance steps`

Hard gates:
1. no second Payment lifecycle authority;
2. no real PSP/network;
3. no webhook runtime;
4. no external HTTP idempotency runtime;
5. stable provider-operation identity;
6. safe future PSP multi-instance design;
7. fake provider cannot be production-selected;
8. no provider transport leakage into domain;
9. frozen-money authority preserved;
10. no 2.12B/C/D/F/G scope;
11. 2.12E preserved;
12. Refund/Dispute/Ledger/ProviderFee/Settlement/Payout boundaries preserved.

## 2. ALLOWED REVIEW FIXES

Fix only defects required to satisfy existing 2.12A scope. Every production fix requires a regression test. Do not begin 2.12H/2.12B or redesign Payment lifecycle.

Classify findings: `CRITICAL / HIGH / MEDIUM / LOW / OBSERVATION`.

If correction crosses a step boundary: `PHASE 2 STEP 2.12A STRICT REVIEW BLOCKED — ARCHITECTURE/SCOPE DECISION REQUIRED`.

## 3. REPOSITORY BASELINE

Run:
```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -20
```

Verify canonical repo, branch, HEAD/upstream, implementation/provenance commits and ancestry, dirty/untracked state. Do not touch unrelated prompts.

## 4. REVIEW ACTUAL DIFF

Derive the real pre-2.12A SHA. Do not guess it.

```bash
git show --stat b3307cc
git show b3307cc
git show --stat bb98fba
git diff <pre-2.12A-sha>..b3307cc
```

Inventory every changed file and classify it as production/test/docs/Roadmap/provenance.

## 5. CLAIMS MATRIX

Build:
| Claim | Actual repository evidence | Verdict |
|---|---|---|
| no network | repo-wide code/dependency audit | PASS/FAIL |
| no PSP adapter | runtime audit | PASS/FAIL |
| no webhook | route/module audit | PASS/FAIL |
| no schema change | schema+migrations+Git diff | PASS/FAIL |
| no writers | repo-wide write-path audit | PASS/FAIL |
| stable operation identity | code+adversarial tests | PASS/FAIL |
| fake provider test-only | DI/config/build audit | PASS/FAIL |
| PaymentService authority | writer/state audit | PASS/FAIL |

## 6. OWNERSHIP / PAYMENT LIFECYCLE — CRITICAL

Inspect all provider code and repo-wide Payment writes. Provider abstraction may own identity, capabilities, normalized request/result/error contracts, operation identity and future transport boundary only.

Prove it cannot perform PENDING→CAPTURED/FAILED/CANCELLED, AUTHORIZED or REFUNDED transitions, mutate milestones/version, or become payable-money authority.

Any second lifecycle authority = CRITICAL.

## 7. AUTHORIZED

Search `AUTHORIZED`, `authorizedAt`, `authorize`, `authorization`. Distinguish reserved/provider vocabulary from real Payment transition. AUTHORIZED must remain unreachable.

## 8. MONEY AUTHORITY

Provider requests must use approved frozen Payment/Order amount+currency. Prove no client amount/currency, Catalog/Tax/FX/CommissionPolicy relookup, JS-float recalculation, or second rounding authority.

## 9. PAYMENTMETHOD ≠ PROVIDER

Prove `paymentMethod`, provider identity and provider transaction reference are distinct. No arbitrary client-controlled provider selection through paymentMethod or mass assignment.

## 10. REGISTRY — ADVERSARIAL

Verify explicit deterministic registration/resolution, controlled unknown-provider error, duplicate registration behavior, no first-provider fallback, no dynamic arbitrary loading, no implicit real default.

Silent fallback = HIGH minimum.

## 11. FAKE PROVIDER PRODUCTION ISOLATION — CRITICAL

Inspect Nest module wiring, DI tokens, exports, config, NODE_ENV behavior, production imports and registry population.

Prove:
- production cannot resolve fake provider;
- client cannot request it;
- unknown provider never falls back to fake;
- empty production registry is safe.

Naming convention alone is not evidence.

## 12. NO REAL NETWORK / PSP — REPO-WIDE

Audit Step diff and relevant Finance runtime for `fetch`, axios, undici, HTTP modules, sockets, remote URLs, provider SDKs/names, credentials and dynamic imports. Inspect package manifests/lockfile for new PSP/network deps.

Expected: 0 new real network execution and 0 production PSP adapter.

## 13. NO WEBHOOK/CALLBACK

Search route graph/controllers/modules for webhook, callback, provider-event, signature, rawBody. Prove no route, hidden generic callback, signature verifier, raw-body PSP middleware or webhook consumer. A single 404 test is insufficient.

## 14. PROVIDER OPERATION IDENTITY — CRITICAL

Reconstruct exact algorithm. It must be server-derived, deterministic, retry-stable, operation/payment scoped, non-forgeable, suitable for future provider idempotency, and divergence-sensitive.

Audit unstable object ordering, JSON ambiguity, Decimal/string normalization, currency normalization, mutable metadata, random UUIDs, timestamps/process data.

## 15. IDENTICAL / DIVERGENT / CONCURRENT RETRIES

Adversarially prove:
- same Payment+provider operation+canonical parameters → same identity;
- equivalent object construction order → same identity;
- canonical amount representation behaves deterministically;
- divergent amount/currency/provider/operation/payment cannot silently reuse identity;
- separate service instances/process-equivalent calls do not rely on in-memory/random state.

Silent divergent success = HIGH.

## 16. 2.12H BOUNDARY

Search `Idempotency-Key`, `idempotency-key`, `idempotencyKey`, request fingerprint, response replay.

2.12A may have internal provider-operation identity only. It must not implement generic HTTP idempotency middleware/storage/replay.

Canonical handoff:
`2.12A internal provider operation identity → 2.12H external API Idempotency-Key → 2.12B real PSP/webhooks`.

## 17. 2.12B FUTURE COMPATIBILITY

Without implementing it, verify abstraction can support signature-verified webhook, provider-event dedup, callback reorder, provider reference lookup, callback-before-API-response, duplicate delivery to two instances, timeout followed by webhook success.

Any decision forcing destructive 2.12B redesign must be fixed in-scope or block approval.

## 18. PSP-LOCAL MULTI-INSTANCE MATRIX

Architecture docs must define:
| Race | 2.12A invariant | Future owner |
|---|---|---|
| duplicate create-payment | stable operation identity | 2.12H/2.12B |
| API timeout+retry | stable identity | 2.12H/2.12B |
| duplicate webhook/two instances | dedup identity | 2.12B |
| webhook before API response | provider correlation | 2.12B |
| callback reorder | domain/CAS guard | 2.12B |
| two workers same callback | DB dedup/CAS | 2.12B |
| global outbox duplicate publisher | consumer safety/worker hardening | 2.17 |

"Handled later" without required invariant is insufficient.

## 19. SYSTEM-WIDE MULTI-INSTANCE BOUNDARY

Prove 2.12A neither implements nor falsely claims global outbox leasing, SKIP LOCKED, durable retry scheduler, distributed worker coordination or exactly-once delivery. These remain 2.17.

## 20. CAPABILITIES / RESULTS / ERRORS

For every capability ask who consumes it and future owner. It must not activate AUTHORIZED, REFUND, NATIVE_SPLIT or WEBHOOK behavior.

Raw SDK/HTTP objects must not leak into PaymentService, DB, domain events/controllers/public API.

Verify expected error normalization and that unknown internal errors do not become fake business declines. No secret/raw-provider leakage.

## 21. PROVIDER REFERENCES

If none persisted: `N/A`. If present, verify nullable, server-owned, provider-scoped uniqueness, no fake backfill/client mass assignment/cross-provider collision.

## 22. SCHEMA / MIGRATION

Verify reported zero schema change:
```bash
git diff <pre-2.12A-sha>..b3307cc -- backend/prisma
```
Check migration count/status and drift. Expected 56/56 and drift 0 only if reproduced.

## 23. DOMAIN EVENTS / WRITE PATHS — ZERO GATES

Repo-wide audit new events/outbox/subscribers and all Prisma/raw writes introduced by Step 2.12A.

Expected:
- 0 new business domain events;
- 0 new business writers.

Classify every create/update/upsert/delete/raw SQL hit.

## 24. CONTAINMENT MATRIX

Prove:
- SPLIT_AT_PAYMENT runtime = 0;
- Ledger writes = 0;
- ProviderFee = 0;
- Settlement = 0;
- Payout = 0;
- real provider Refund = 0;
- provider Dispute/chargeback = 0;
- Invoice runtime = 0;
- 2.12E CommissionPolicy/snapshot/Commission/Accrual behavior unchanged.

## 25. PLATFORM-RISK BOUNDARIES

Prove:
- RLS implementation = 0; ADR-0014 remains canonical;
- global event `schemaVersion` retrofit = 0; ADR-0010 preserved;
- Backup/DR implementation = 0 (2.17A);
- load/performance framework = 0 (2.17B).

Concurrency correctness tests are not load qualification.

## 26. RBAC / PUBLIC SURFACE / SECRETS

Verify no provider-management/selection endpoint, new permission, buyer/partner override, mass-assignment path, API key, webhook secret, private key or production provider URL.

## 27. TEST QUALITY

Read tests; do not trust counts/labels. Detect mocks bypassing production, grep-only assertions, superficial 404 checks, fake concurrency, test-only wiring falsely proving production isolation, and identity tests using the same object instance.

Add adversarial tests where absent for:
1. different property insertion order;
2. amount canonicalization edge cases;
3. currency canonical contract;
4. divergent amount;
5. divergent currency;
6. divergent provider;
7. different Payment;
8. fake provider unavailable in production wiring;
9. unknown provider no fallback;
10. duplicate registration;
11. provider result cannot mutate Payment;
12. AUTHORIZED unreachable;
13. no external HTTP idempotency runtime;
14. no real network dependency/runtime;
15. no hidden webhook route.

Only add tests relevant to actual implementation.

## 28. REGRESSION — REQUIRED

Run actual current commands:
- backend typecheck/build/full unit;
- targeted 2.12A + Finance/EventBus/RBAC e2e;
- full serial e2e;
- frontend typecheck/Vitest/build;
- DB migration status/fresh replay where canonical harness supports it/drift.

Report actual counts. Never copy historical counts without reproduction.

## 29. DOC CONSISTENCY

Review architecture doc, implementation report, API/events docs if touched, Roadmap and reconciliation dependency metadata.

Fix misleading claims such as globally "multi-instance safe", "idempotent API" before 2.12H, webhook/provider integrated, AUTHORIZED runtime supported, native split active, or RLS protected.

## 30. ROADMAP DEPENDENCY HARD GATE

Canonical sequence after approval must be:

`2.12A APPROVED → 2.12H implementation → 2.12H Strict Review → 2.12B`

NEXT must be 2.12H, never 2.12B.

## 31. ARTIFACT INTEGRITY

Run checker regression and real Roadmap artifact checker.

Hard requirement: `FAIL=0`; prefer `WARN=0`.

Create the Strict Review report **before** Roadmap cites it. Do not repeat historical prompt-as-report provenance gaps.

## 32. STRICT REVIEW REPORT

Create:
`docs/prompts/PHASE_2_STEP_2.12A_PAYMENT_PROVIDER_ABSTRACTION_STRICT_REVIEW_REPORT.md`

Required sections:
1 Verdict; 2 Methodology; 3 Repository baseline; 4 Reviewed diff/provenance; 5 Claims matrix; 6 Provider ownership; 7 Payment lifecycle authority; 8 AUTHORIZED; 9 Money authority; 10 PaymentMethod/provider; 11 Registry; 12 Fake provider isolation; 13 Network; 14 PSP adapters; 15 Webhooks; 16 Operation identity; 17 Identical retry; 18 Divergent retry; 19 Concurrent retry; 20 2.12H handoff; 21 2.12B compatibility; 22 PSP-local race matrix; 23 System-wide multi-instance boundary; 24 Capabilities; 25 Results; 26 Errors; 27 Provider refs; 28 Schema/migration; 29 Events; 30 Write paths; 31 SPLIT; 32 Ledger; 33 ProviderFee/Settlement/Payout; 34 Refund; 35 Dispute; 36 2.12E regression; 37 RLS; 38 schemaVersion; 39 Backup/DR; 40 Load/perf; 41 RBAC/public surface; 42 Secrets/config; 43 Dependencies; 44 Test quality; 45 Adversarial tests; 46 Findings; 47 Review fixes; 48 Observations; 49 Backend regression; 50 Frontend regression; 51 DB regression; 52 Docs consistency; 53 Roadmap dependencies; 54 Artifact integrity; 55 Exact files changed; 56 Negative checks; 57 Persistence; 58 Repository Evidence; 59 Release; 60 Exact NEXT; 61 Final statement.

## 33. FINDING FORMAT

For every finding:
```text
ID:
Severity:
Area:
Evidence:
Risk:
Required behavior:
Fix:
Regression test:
Status:
```

Do not hide fixed findings.

## 34. VERDICTS

Use exactly one:
- `PHASE 2 STEP 2.12A STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`
- `PHASE 2 STEP 2.12A STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 2 STEP 2.12A STRICT REVIEW BLOCKED — ARCHITECTURE/SCOPE DECISION REQUIRED`
- `PHASE 2 STEP 2.12A STRICT REVIEW FAILED — REOPEN IMPLEMENTATION`

No unresolved HIGH/CRITICAL finding may be approved.

## 35. ROADMAP UPDATE

Only after verdict.

If approved, set 2.12A to the exact approved verdict and NEXT to:
`PHASE 2 — STEP 2.12H — EXTERNAL API IDEMPOTENCY CONTRACT`

Preserve 2.12B/C NOT STARTED, Step 2.17/2.17A/2.17B boundaries, ADR-0014 and existing 2.14 status.

## 36. NEGATIVE CHECKS

Final state must prove:
- real PSP network 0;
- production PSP adapter 0;
- webhook route 0;
- external HTTP Idempotency-Key runtime 0;
- SPLIT_AT_PAYMENT 0;
- provider→Ledger/ProviderFee/Settlement/Payout writes 0;
- provider Refund/Dispute execution 0;
- Invoice runtime 0;
- RLS implementation 0;
- global schemaVersion retrofit 0;
- Backup/DR implementation 0;
- load framework 0;
- 2.12H implementation 0;
- 2.12B implementation 0.

## 37. GIT PERSISTENCE — REQUIRED

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

Stage only exact review report, review fixes/tests/docs and Roadmap changes. Verify:
```bash
git diff --cached --stat
git diff --cached
git status --short
```

Suggested commit:
```bash
git commit -m "fix(finance): complete strict review for payment provider abstraction"
```
If no production fixes, use an accurate docs/test review message.

Push normally; never force-push. Then verify:
```bash
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```
Require `HEAD == @{u}` before `push_status: PUSHED`.

## 38. REPOSITORY EVIDENCE

Use `docs/prompts/REPOSITORY_EVIDENCE_FOOTER_TEMPLATE.md`.

Report actual repository, branch, HEAD, upstream, worktree_clean, migration_count, reviewed diff base/head, persistence SHA and push status. Use established second provenance/footer commit if needed. Never invent a future SHA.

## 39. RELEASE

`RELEASE: NOT PERFORMED — NEXT DEPENDENCY STEP REQUIRED`

No deploy/tag/production migration.

## 40. FINAL RESPONSE

On approval:
```text
PHASE 2 STEP 2.12A STRICT REVIEW COMPLETED — APPROVED [WITH REVIEW FIXES]

Hard gates:
- Payment lifecycle authority: PASS
- AUTHORIZED unreachable: PASS
- frozen money authority: PASS
- fake provider production isolation: PASS
- real network: 0
- production PSP adapters: 0
- webhook routes: 0
- provider operation identity: PASS
- identical/divergent/concurrent retry semantics: PASS
- 2.12H boundary: PASS
- 2.12B compatibility: PASS
- SPLIT_AT_PAYMENT: 0
- cross-domain finance writes: 0

Findings:
- <summary>

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
NEXT: PHASE 2 — STEP 2.12H — EXTERNAL API IDEMPOTENCY CONTRACT
```

## 41. HARD STOP

After independent audit, adversarial tests, fixes if required, regression, report, Roadmap update, artifact checker, explicit staging, commit, push, upstream verification and Repository Evidence: **STOP**.

Do not start 2.12H, 2.12B or 2.12C in this pass.
