# PHASE 2 — STEP 2.12A — PAYMENT PROVIDER ABSTRACTION — IMPLEMENTATION PROMPT
## HARDENED AFTER CRITICAL PLATFORM RISKS & PAYMENT/PSP READINESS RECONCILIATION

## 0. MODE

**IMPLEMENTATION · REPOSITORY-FIRST · PROVIDER-NEUTRAL · NO REAL NETWORK · STRICT SCOPE · PERSISTENCE REQUIRED**

Implement only:

`PHASE 2 — STEP 2.12A — PAYMENT PROVIDER ABSTRACTION`

This prompt supersedes earlier drafts of Step 2.12A where they conflict with the latest canonical Roadmap and reconciliation.

The latest reconciliation established:

- Step 2.12A **MAY PROCEED WITH EMBEDDED GATES**;
- Step 2.12H — External API Idempotency Contract — is a hard prerequisite before 2.12B;
- Step 2.12B owns real PSP/webhook lifecycle;
- Step 2.12C owns SPLIT_AT_PAYMENT;
- PSP-local multi-instance safety must be designed here and implemented/proven across 2.12A/2.12B as applicable;
- system-wide outbox publisher/retry multi-instance hardening remains Step 2.17;
- RLS is deferred under ADR-0014 with later verification;
- Backup/DR = Step 2.17A;
- Load/performance = Step 2.17B, with PSP/webhook-burst subset required in 2.12B;
- production release is not part of this step.

Do not infer execution order from numbering alone.

---

# 1. CURRENT CANONICAL DEPENDENCY STATE — VERIFY FIRST

Expected state:

- Step 2.12 — Payment Flow — APPROVED;
- Step 2.12E — PARTNER_COLLECT / Commission Accrual — APPROVED;
- Step 2.14E — Commission Policy Foundation — APPROVED;
- Step 2.12A — NEXT;
- Step 2.12H — PLANNED, after 2.12A and before 2.12B;
- Step 2.12B — NOT STARTED;
- Step 2.12C — NOT STARTED;
- Step 2.12D — NOT STARTED;
- Step 2.12F — NOT STARTED;
- Step 2.12G — NOT STARTED;
- Step 2.14 — BLOCKED;
- Step 2.17 — NOT STARTED;
- Step 2.17A — PLANNED;
- Step 2.17B — PLANNED;
- artifact-integrity baseline = 0 WARN / 0 FAIL;
- REPOSITORY EVIDENCE convention active.

Verify actual Roadmap and repository state.

If current Roadmap materially differs, stop with:

`PHASE 2 STEP 2.12A BLOCKED — ROADMAP BASELINE MISMATCH`

---

# 2. PRIMARY OBJECTIVE

Create the minimal canonical **provider abstraction layer** for future PSP adapters while preserving the current provider-neutral Payment business model.

The result must establish:

1. canonical Payment Provider abstraction/interface;
2. canonical provider identity;
3. provider capability model only where justified;
4. normalized provider request types;
5. normalized provider result types;
6. normalized provider error model;
7. deterministic NestJS DI registry/resolution;
8. stable provider-operation idempotency identity design;
9. PSP-local concurrency/multi-instance contract design;
10. deterministic fake/test provider for tests;
11. provider-internal correlation/provenance continuity;
12. zero real PSP network;
13. zero webhook routes/processing;
14. zero SPLIT_AT_PAYMENT;
15. zero Ledger posting;
16. zero ProviderFee creation;
17. zero Settlement/Payout;
18. zero Invoice runtime;
19. zero provider-driven Refund/Dispute runtime.

This is an **abstraction/foundation** step, not a provider integration step.

---

# 3. REQUIRED SOURCES

Before coding inspect actual repository:

## Canonical planning/docs
- current Roadmap v3;
- latest Platform Risks & Payment/PSP Readiness Reconciliation report;
- ADR-0014;
- ADR-0013;
- ADR-0010;
- Step 2.12 Payment Flow architecture + Strict Review;
- Step 2.12E Commission Accrual architecture + Strict Review;
- Refund Flow;
- Dispute Foundation;
- Finance Domain Foundation;
- Finance Temporal Contract;
- Ledger foundation;
- ProviderFee / Settlement / Payout foundation;
- Step 2.17 current prompt/roadmap scope;
- REPOSITORY_EVIDENCE_FOOTER_TEMPLATE.md.

## Production code
- PaymentService;
- Payment controller/DTO/validation;
- RefundService;
- DisputeService;
- FinanceModule/AppModule;
- EventBus/outbox/inbox;
- current config/env validation;
- current paymentMethod/provider fields;
- current provider references;
- any integration folder/module;
- any Stripe/PSP/legacy code;
- current errors;
- current HTTP client deps;
- current tests.

Current code wins over reports.

---

# 4. EXISTING PROVIDER AUTHORITY — HARD GATE

Repo-wide search for:

- Stripe;
- PayPal;
- Adyen;
- Checkout.com;
- provider;
- PSP;
- payment gateway;
- webhook;
- payment intent;
- authorize/capture;
- provider transaction ID;
- provider SDK;
- provider-specific HTTP call.

Classify each:

1. active production provider integration;
2. dead/legacy;
3. schema-only;
4. docs-only;
5. test-only.

If a canonical provider abstraction already exists, reconcile it.

If conflicting active abstractions exist:

`PHASE 2 STEP 2.12A BLOCKED — CONFLICTING PROVIDER ABSTRACTION`

Do not create a second provider authority.

---

# 5. OWNERSHIP

PaymentService remains the single business lifecycle authority for Payment.

Provider abstraction owns only:

- provider identity;
- capability discovery;
- provider request normalization;
- provider result normalization;
- provider error normalization;
- provider-operation identity/idempotency mapping;
- provider-specific transport boundary in future adapters.

Provider abstraction must not own:

- canonical Payment business status;
- CommissionPolicy;
- Commission;
- CommissionAccrual;
- Refund lifecycle;
- Dispute lifecycle;
- Ledger;
- Settlement;
- Payout;
- Invoice.

---

# 6. NO REAL NETWORK — CRITICAL HARD GATE

Step 2.12A must introduce:

- 0 real PSP HTTP calls;
- 0 real PSP SDK runtime execution;
- 0 production API keys;
- 0 callback endpoints;
- 0 webhook endpoints;
- 0 provider signature verification;
- 0 remote provider status polling.

If the repository/Roadmap now requires a concrete provider in 2.12A:

`ARCHITECTURE DECISION REQUIRED`

Do not silently expand scope.

---

# 7. PROVIDER INTERFACE

Implement the smallest interface supported by current contracts.

Conceptual example only:

```ts
interface PaymentProvider {
  readonly code: PaymentProviderCode;

  getCapabilities(): PaymentProviderCapabilities;

  // Only operations justified for abstraction design.
}
```

Do not add authorize/capture/refund/split/webhook methods merely for completeness.

If method signatures for future operations are needed to make the abstraction coherent, they must remain transport-neutral and **must not execute external network**.

Every method must have a documented future owner step.

---

# 8. PROVIDER IDENTITY

Create or reconcile canonical provider code semantics.

Requirements:

- server-owned;
- deterministic;
- validated;
- stable;
- not arbitrary user input;
- no fallback-to-first provider;
- no "default provider" without explicit canonical configuration.

If no production PSP is selected yet, production registry may be empty.

Test/fake provider must not masquerade as a real provider.

---

# 9. PAYMENTMETHOD ≠ PROVIDER

Audit the existing `paymentMethod` field.

Explicitly separate:

- `paymentMethod` = business/customer payment method semantics;
- `provider` = PSP/integration identity;
- `providerPaymentId`/reference = external transaction reference.

Do not repurpose an existing field with different meaning.

If schema addition is required:

- additive;
- nullable;
- legacy-safe;
- server-owned;
- no fabricated backfill.

Prefer no schema change unless necessary.

---

# 10. CAPABILITY MODEL

Only define capabilities with actual downstream purpose.

Potential examples:

- AUTHORIZE;
- CAPTURE;
- DIRECT_CAPTURE;
- CANCEL;
- REFUND;
- WEBHOOKS;
- NATIVE_SPLIT.

But add only what current Roadmap justifies.

Hard rules:

- capability does not activate behavior;
- capability does not define business lifecycle;
- `NATIVE_SPLIT` does not define commission rate/base;
- capability does not make 2.12C implemented.

---

# 11. PAYMENT STATE MACHINE BOUNDARY — HARD GATE

Current Payment state machine from Step 2.12 remains canonical.

2.12A must not:

- introduce new Payment business statuses;
- make provider status canonical;
- auto-transition Payment;
- make `AUTHORIZED` reachable unless current Roadmap explicitly moved that responsibility here;
- alter PAID = CAPTURED semantics.

If abstraction cannot be implemented without lifecycle redesign:

`ARCHITECTURE DECISION REQUIRED`

---

# 12. AUTHORIZED BOUNDARY

If `AUTHORIZED` is currently reserved/unreachable, preserve that.

Provider abstraction may model a normalized provider-side authorization result only as an **external/provider fact type**, not as a domain transition.

Actual provider-driven lifecycle belongs to 2.12B unless Roadmap now says otherwise.

---

# 13. PROVIDER REQUEST CONTRACT

Provider request models must use frozen authoritative facts.

Where justified, fields may include:

- TravelHub Payment id/code;
- Order reference;
- frozen amount;
- frozen currency;
- stable provider-operation idempotency identity;
- correlation reference.

Forbidden authority sources:

- mutable Catalog;
- mutable Tax;
- mutable FX;
- frontend amount;
- frontend currency;
- frontend commission;
- live CommissionPolicy resolution.

No unnecessary PII.

---

# 14. PROVIDER RESULT NORMALIZATION

Do not leak provider SDK/raw HTTP objects into PaymentService.

Normalize only required fields:

- provider code;
- provider transaction/reference ID;
- normalized provider operation result;
- normalized provider status/fact;
- provider failure category/code;
- echoed amount/currency only if useful for invariant verification;
- retryability classification if canonical.

Do not persist arbitrary raw payloads.

No card data, credentials, secrets or unnecessary PII.

---

# 15. PROVIDER ERROR MODEL — HARD GATE

Normalize expected external/provider error classes.

At minimum consider where justified:

- unavailable/temporary;
- timeout;
- authentication/configuration;
- invalid request;
- declined;
- unsupported capability;
- conflict/idempotency;
- malformed provider response.

Rules:

- expected provider error ≠ raw 500 by accident;
- unknown internal error must not become fake decline;
- retryability must be explicit, not inferred from message strings.

No background retry worker in this step.

---

# 16. PSP-LOCAL MULTI-INSTANCE SAFETY — EMBEDDED DESIGN GATE

The reconciliation explicitly requires PSP-local multi-instance semantics to be designed before 2.12B.

2.12A must document the contract for at least:

- duplicate create-payment intent/request;
- API retry after client timeout;
- same provider operation attempted from two backend instances;
- provider callback/webhook arriving before API response;
- duplicate webhook delivered to two instances;
- callback reorder;
- provider operation conflict;
- provider idempotency key reuse;
- local DB transition CAS/unique interaction.

This step does **not** implement webhook processing.

But the abstraction must not make future safe implementation impossible.

Required design outputs:

- stable provider-operation identity;
- deterministic provider idempotency key derivation/mapping;
- provider reference uniqueness semantics;
- business transaction boundaries;
- which future DB invariant belongs to 2.12B/2.12H;
- which races are handled by Payment CAS vs webhook dedup vs provider idempotency.

If these cannot be defined without new architecture:

`ARCHITECTURE DECISION REQUIRED`

---

# 17. EXTERNAL API IDEMPOTENCY BOUNDARY — STEP 2.12H

Step 2.12H is now a hard prerequisite before 2.12B.

2.12A may design provider-operation idempotency internally, but must **not** implement the external HTTP `Idempotency-Key` contract unless Roadmap explicitly moved it here.

Do not create:

- generic HTTP idempotency middleware;
- persisted API idempotency records;
- request-response replay store;
- external key fingerprint engine.

Instead document the handoff:

`2.12A provider operation identity → 2.12H external API Idempotency-Key → 2.12B PSP/webhook execution`

Hard rule:

2.12B must not start until 2.12H is approved.

---

# 18. PROVIDER OPERATION IDEMPOTENCY

Even without external API Idempotency-Key, provider abstraction must define stable internal operation identity.

Requirements:

- server-derived;
- stable across safe retry;
- not random per retry;
- scoped to operation;
- scoped to TravelHub Payment/aggregate identity;
- cannot be forged by client;
- future adapter can map it to provider-specific idempotency header/key;
- divergent operation parameters must be detectable.

Do not implement provider-specific idempotency APIs.

---

# 19. REGISTRY / RESOLUTION

Implement one NestJS DI-based provider registry/resolver.

Requirements:

- explicit registration;
- deterministic resolution;
- unknown provider → controlled error;
- no dynamic arbitrary module loading;
- no fallback to first provider;
- no test provider production default;
- test provider must be clearly isolated.

If multiple providers are eventually supported, registry design must not require business-domain branching in PaymentService.

---

# 20. TEST / FAKE PROVIDER

Allowed for tests only.

Requirements:

- deterministic;
- configurable;
- no network;
- no secret;
- simulates success/error/capability outcomes;
- can simulate same-operation replay;
- can simulate divergent operation parameters;
- can simulate temporary vs terminal errors.

It must not be selectable in production by accident.

---

# 21. CONFIG / SECRETS

If provider config abstractions are added:

- no real credentials;
- no committed secrets;
- no legacy credential reuse;
- no secret logging;
- no provider credential requirement when production provider set is empty;
- test config isolated.

Do not implement secret-management infrastructure.

---

# 22. PROVIDER REFERENCE

If provider reference fields are introduced:

- nullable;
- server-owned;
- provider-scoped;
- no fabricated legacy backfill;
- no client forgery;
- uniqueness semantics must be explicit.

Preferred invariant if needed:

`provider + providerPaymentId`

rather than assuming providerPaymentId globally unique.

Only add if current abstraction actually needs it.

---

# 23. WEBHOOK BOUNDARY — STEP 2.12B

Strictly forbidden in 2.12A:

- webhook route;
- webhook signature validation;
- webhook dedup storage;
- callback-to-domain transition;
- provider event mapping runtime;
- provider-authorized/captured webhook processing;
- callback reorder runtime handling;
- webhook burst handling.

2.12A documents contracts only.

2.12B implements them after 2.12H approval.

---

# 24. EVENT SCHEMA VERSIONING BOUNDARY

Latest reconciliation says event `schemaVersion` is safe for Step 2.17, not a 2.12A blocker.

Therefore 2.12A must:

- not retrofit global EventBus schemaVersion;
- not create a second incompatible versioning system;
- preserve ADR-0010 envelope;
- document if any provider-internal message types need versioning later.

Inbound PSP webhooks are not canonical Outbox events merely because they carry provider payload versions.

Do not start the Step 2.17 schemaVersion decision here.

---

# 25. SYSTEM-WIDE MULTI-INSTANCE BOUNDARY — STEP 2.17

Do not implement global:

- Outbox SKIP LOCKED;
- publisher lease;
- retry scheduler;
- durable worker;
- distributed worker coordination;
- system-wide event claiming.

Those remain Step 2.17.

But do not use their absence as an excuse to omit PSP-local idempotency/race design.

---

# 26. RLS / PARTNER ISOLATION BOUNDARY

ADR-0014 says application isolation remains canonical and RLS is deferred.

2.12A must not implement RLS.

But provider abstraction must preserve:

- principal/partner ownership boundaries;
- no provider operation accessible across partner scope;
- no provider identity supplied as trust boundary by client.

No DB RLS migration in this step.

---

# 27. BACKUP / DR BOUNDARY — STEP 2.17A

Do not implement:

- pg_dump automation;
- PITR;
- restore drills;
- backup scripts;
- S3/MinIO backup strategy.

Step 2.17A owns this.

---

# 28. LOAD / PERFORMANCE BOUNDARY — STEP 2.17B + 2.12B SUBSET

Do not implement full load tooling here.

But 2.12A design must identify future PSP scenarios that 2.12B must performance-test:

- duplicate webhook burst;
- callback contention;
- create-payment race;
- provider timeout/retry burst.

System-wide load qualification belongs to 2.17B.

---

# 29. SPLIT_AT_PAYMENT BOUNDARY — STEP 2.12C

Strictly forbidden:

- platform fee;
- transfer destination;
- partner connected account;
- split amount;
- native PSP split execution;
- commission amount injection into provider request.

Provider capability may declare future support if canonical.

No 2.12C runtime.

---

# 30. LEDGER BOUNDARY — STEP 2.12D

0 LedgerTransaction.

No posting.

No accounting side effect.

---

# 31. PARTNER_COLLECT / 2.12E REGRESSION

2.12A must not alter:

- CommissionPolicy;
- commissionSnapshot;
- Commission;
- CommissionAccrual;
- CommissionAccrued;
- PARTNER_COLLECT recognition.

Run regression.

---

# 32. REFUND BOUNDARY

No real provider refund call.

No provider-driven Refund transition.

No provider refund webhook.

No RefundProcessed from fake adapter result.

---

# 33. DISPUTE BOUNDARY

No provider dispute integration.

No evidence upload.

No provider chargeback status.

No dispute webhook.

---

# 34. PROVIDERFEE BOUNDARY

Provider abstraction creates:

`0 ProviderFee`

Do not extract provider fees from normalized result.

---

# 35. SETTLEMENT / PAYOUT BOUNDARY

0 Settlement.
0 Payout.
0 bank rail.
0 partner balance mutation.

---

# 36. INVOICE BOUNDARY

No Invoice runtime.

Step 2.14 remains blocked.

---

# 37. RBAC / PUBLIC SURFACE

Provider abstraction is internal infrastructure.

Do not create public provider-management API unless Roadmap explicitly requires it.

No BUYER/PARTNER ability to choose arbitrary provider code.

If provider selection becomes a server policy, document owner and source.

Do not invent provider-admin UI.

---

# 38. DOMAIN EVENTS

Expected:

`0 new business domain events`

Do not invent:

- PaymentProviderSelected;
- ProviderRequestSent;
- ProviderIntentCreated.

Infrastructure/provider operation telemetry is not automatically a domain event.

---

# 39. LOGGING / SECURITY

No logs containing:

- provider secrets;
- API keys;
- card data;
- Authorization headers;
- raw provider payload;
- PII.

Preserve correlation context.

Provider operation logs may include only safe business refs and provider code where current conventions permit.

---

# 40. MIGRATION

Prefer no migration.

If required:

- additive only;
- nullable-first;
- no fake backfill;
- no provider invented for legacy rows;
- no `db push`;
- fresh replay;
- drift 0.

Any non-additive schema requirement → stop.

---

# 41. UNIT TESTS — REQUIRED

At minimum cover:

1. provider registry known provider;
2. unknown provider;
3. duplicate registration/conflict;
4. capability lookup;
5. normalized success;
6. normalized terminal decline;
7. normalized temporary/unavailable;
8. timeout classification;
9. unsupported capability;
10. provider operation idempotency identity stability;
11. same operation + same payload → same identity;
12. same operation + divergent payload → detectable mismatch/conflict at abstraction contract level;
13. fake provider deterministic behavior;
14. fake provider no network;
15. Payment state unchanged by abstraction alone;
16. test provider unavailable in production configuration;
17. no provider-specific raw object leakage.

---

# 42. E2E / INTEGRATION TESTS — REQUIRED

At minimum prove:

### T1
Finance module boots with provider abstraction.

### T2
Known fake provider resolves in test mode.

### T3
Unknown provider → controlled error; no raw 500.

### T4
Provider abstraction alone does not mutate Payment status/version/milestones.

### T5
No webhook routes added.

### T6
No SPLIT_AT_PAYMENT side effects.

### T7
No Ledger.

### T8
No ProviderFee.

### T9
No Settlement/Payout.

### T10
No Refund/Dispute mutation.

### T11
No external network.

### T12
No secret leakage.

### T13
Stable internal provider-operation idempotency identity.

### T14
Concurrent/same-operation abstraction call does not create duplicate business mutation.

### T15
Existing Payment lifecycle regression green.

### T16
2.12E PARTNER_COLLECT regression green.

### T17
No RLS/schemaVersion/backup/load-test implementation leaked into scope.

---

# 43. REPO-WIDE WRITE-PATH AUDIT

After implementation enumerate all writers introduced/changed.

Expected provider abstraction writes:

- no Payment business status;
- no Payment milestones;
- no Commission;
- no CommissionAccrual;
- no Refund;
- no Dispute;
- no Ledger;
- no ProviderFee;
- no Settlement;
- no Payout;
- no Invoice.

If provider metadata persistence exists, list exact writer and justify.

---

# 44. PROVIDER-SPECIFIC AUDIT

Search production code for real PSP names/SDKs.

Any new provider-specific code must be justified by current Roadmap.

Expected:

`0 real provider implementation`

If not zero, explain or stop.

---

# 45. DOCUMENTATION

Create/update:

- `docs/architecture/payment-provider-abstraction.md`;
- API docs only if public/internal contract actually changes;
- events docs only if event contract changes (expected none);
- Roadmap;
- implementation report.

The architecture doc must explicitly include:

- provider-neutral ownership;
- provider identity;
- capability semantics;
- request/result/error contracts;
- provider operation idempotency identity;
- PSP-local concurrency/race model;
- 2.12H dependency;
- 2.12B dependency;
- 2.12C boundary;
- Step 2.17 boundary;
- no-real-network guarantee.

---

# 46. IMPLEMENTATION REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.12A_PAYMENT_PROVIDER_ABSTRACTION_IMPLEMENTATION_REPORT.md`

Required sections:

1. Verdict
2. Repository baseline
3. Sources inspected
4. Latest reconciliation alignment
5. Existing provider code audit
6. Ownership
7. Provider interface
8. Provider identity
9. PaymentMethod/provider distinction
10. Capability model
11. Registry/resolution
12. Request contract
13. Result normalization
14. Error model
15. Provider-operation idempotency identity
16. PSP-local multi-instance design
17. 2.12H handoff
18. Fake provider
19. No-network proof
20. Config/secrets
21. Provider reference
22. Schema/migration
23. Payment lifecycle boundary
24. AUTHORIZED boundary
25. Webhook boundary
26. Event schemaVersion boundary
27. System-wide multi-instance boundary
28. RLS boundary
29. Backup/DR boundary
30. Load/perf boundary
31. SPLIT_AT_PAYMENT boundary
32. Ledger boundary
33. 2.12E regression
34. Refund boundary
35. Dispute boundary
36. ProviderFee boundary
37. Settlement/Payout boundary
38. Invoice boundary
39. RBAC/public surface
40. Events
41. Logging/security
42. Unit coverage
43. E2E coverage
44. Write-path audit
45. Provider-specific audit
46. Issues found
47. Fixes applied
48. Backend regression
49. Frontend regression
50. DB regression
51. Artifact integrity result
52. Exact files changed
53. Deferred scope
54. Architecture decision status
55. Roadmap update
56. Git persistence gate
57. Repository Evidence
58. Release status
59. Exact NEXT
60. Final canonical statement

---

# 47. REQUIRED REGRESSION

## Backend
Run actual:

- typecheck;
- production build;
- unit;
- targeted e2e:
  - Payment;
  - Refund;
  - Dispute;
  - CommissionPolicy;
  - CommissionAccrual;
  - Ledger;
  - ProviderFee/Settlement/Payout;
  - EventBus envelope;
  - RBAC;
  - provider abstraction;
- full serial e2e.

## Frontend
Even if unchanged:

- typecheck;
- Vitest;
- production build.

## DB

- migrate status;
- fresh replay;
- live→schema diff.

Report actual counts only.

---

# 48. ROADMAP ARTIFACT-INTEGRITY CHECK

Run:

- checker regression suite;
- real Roadmap artifact-integrity checker.

Hard requirement:

`FAIL = 0`

Prefer:

`WARN = 0`

Do not weaken checker.

If implementation report/Roadmap references are invalid, fix documentation before commit.

---

# 49. STOP CONDITIONS

Stop with:

`PHASE 2 STEP 2.12A BLOCKED — ARCHITECTURE DECISION REQUIRED`

if:

1. provider abstraction ownership conflicts;
2. real PSP is required in 2.12A;
3. Payment lifecycle must change;
4. AUTHORIZED must become reachable without contract;
5. paymentMethod/provider semantics cannot be separated;
6. safe provider operation identity cannot be defined;
7. PSP-local multi-instance semantics cannot be designed without unresolved DB/architecture choice;
8. 2.12H must already exist for abstraction to be coherent;
9. 2.12B webhook behavior is required now;
10. SPLIT_AT_PAYMENT behavior is required now;
11. non-additive schema change is required;
12. provider fee accounting is required now;
13. provider secrets are required now;
14. active conflicting provider integration exists.

Do not guess through stop conditions.

---

# 50. ROADMAP UPDATE

After successful implementation:

Step 2.12A →

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

NEXT →

`PHASE 2 — STEP 2.12A — STRICT REVIEW`

Also preserve dependency metadata:

`2.12A → Strict Review → 2.12H → Strict Review → 2.12B`

Do not start 2.12H in this pass.

Do not start 2.12B.

---

# 51. GIT PERSISTENCE GATE — REQUIRED

Successful implementation is not complete until committed and pushed.

## 51.1 Pre-stage

Run:

```bash
git status --short
git diff --stat
git diff
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
```

Record unrelated dirty/untracked files.

## 51.2 Explicit staging only

Forbidden:

```bash
git add .
git add -A
```

Stage only exact files created/modified by Step 2.12A.

Then:

```bash
git diff --cached --stat
git diff --cached
git status --short
```

If unrelated files are staged, stop and unstage only those.

## 51.3 Commit

Suggested message:

```bash
git commit -m "feat(finance): add payment provider abstraction foundation"
```

Record:

```bash
git rev-parse HEAD
```

## 51.4 Push

If upstream exists:

```bash
git push
```

Otherwise:

```bash
git push -u origin <verified-current-branch>
```

Never force-push.

## 51.5 Verify

Run:

```bash
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

Only if:

`HEAD == @{u}`

may report:

`push_status: PUSHED`

---

# 52. REPOSITORY EVIDENCE

Use canonical:

`docs/prompts/REPOSITORY_EVIDENCE_FOOTER_TEMPLATE.md`

Implementation report must include actual values:

```text
REPOSITORY EVIDENCE
repository: <actual>
branch: <actual>
head: <actual SHA>
origin: <actual upstream SHA or unavailable>
worktree_clean: true|false
migration_count: <actual>
reviewed_state: COMMIT
reviewed_diff_base: <actual>
reviewed_diff_head: <actual>
persistence_status: PERSISTED
persistence_sha: <actual>
push_status: PUSHED | NOT_PUSHED | PUSH_FAILED | NOT_VERIFIED
```

If unrelated untracked files remain:

`worktree_clean: false`

Do not fabricate self-referential SHA. Use the repository's established second-footer/provenance commit convention if required.

---

# 53. RELEASE

No production release/deploy.

Record:

`RELEASE: NOT PERFORMED — STRICT REVIEW REQUIRED`

Do not:

- deploy backend;
- deploy frontend;
- apply production migrations;
- create release/tag.

---

# 54. FINAL VERDICTS

Success:

`PHASE 2 STEP 2.12A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Architecture blocker:

`PHASE 2 STEP 2.12A BLOCKED — ARCHITECTURE DECISION REQUIRED`

Conflicting baseline:

`PHASE 2 STEP 2.12A BLOCKED — CONFLICTING PROVIDER ABSTRACTION`

Roadmap mismatch:

`PHASE 2 STEP 2.12A BLOCKED — ROADMAP BASELINE MISMATCH`

---

# 55. FINAL RESPONSE FORMAT

On success return:

```text
PHASE 2 STEP 2.12A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW

Provider abstraction:
- real network: 0
- production PSP adapters: 0
- webhook routes: 0
- SPLIT_AT_PAYMENT: 0
- external Idempotency-Key runtime: 0
- PSP-local multi-instance contract: DEFINED
- Step 2.12H dependency: PRESERVED
- Step 2.12B dependency: PRESERVED

Regression:
- backend: <actual>
- frontend: <actual>
- DB: <actual>
- artifact integrity: PASS=<N> WARN=<N> FAIL=0

Persistence:
- branch: <branch>
- implementation commit: <sha>
- provenance/footer commit: <sha or N/A>
- final HEAD: <sha>
- upstream: <sha>
- push_status: PUSHED
- worktree_clean: true|false

RELEASE: NOT PERFORMED — STRICT REVIEW REQUIRED

NEXT: PHASE 2 — STEP 2.12A — STRICT REVIEW
```

---

# 56. HARD STOP

After:

- implementation;
- tests;
- docs;
- Roadmap update;
- artifact checker;
- explicit staging;
- commit;
- push;
- upstream verification;
- Repository Evidence;

**STOP.**

Do not perform Strict Review.

Do not start 2.12H.

Do not start 2.12B.

Do not start 2.12C.

Do not resume Step 2.14.

The only NEXT item is:

`PHASE 2 — STEP 2.12A — STRICT REVIEW`
