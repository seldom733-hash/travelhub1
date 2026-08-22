# PHASE 2 — STEP 2.12B — BUYER CARD / WALLET PAYMENT — IMPLEMENTATION

## 0. MODE

**IMPLEMENTATION · REPOSITORY-FIRST · REAL PSP/WEBHOOK RUNTIME ALLOWED HERE · MULTI-INSTANCE SAFE · IDEMPOTENCY-ENFORCED · STRICT SCOPE · PERSISTENCE REQUIRED**

Implement only:

`PHASE 2 — STEP 2.12B — BUYER CARD / WALLET PAYMENT`

Prerequisite chain:

`2.12A Payment Provider Abstraction APPROVED → 2.12H External API Idempotency Contract APPROVED → 2.12B Buyer Card / Wallet Payment`

Do not start 2.12C, 2.12D, 2.12F, 2.12G, 2.14, 2.17, 2.17A or 2.17B.

This is the first step where real PSP/network and webhook/callback runtime may be introduced. This pass must stop after implementation, tests, docs, Roadmap update, commit, push and Repository Evidence.

## 1. PRIMARY OBJECTIVE

Implement the canonical Buyer Card / Wallet Payment runtime using the approved provider abstraction and external API idempotency foundation.

The result must establish:

1. real provider adapter(s) only if the canonical provider choice exists;
2. provider-side payment initiation;
3. canonical provider reference persistence;
4. provider status normalization;
5. signature-verified webhook/callback ingress;
6. durable webhook/provider-event deduplication;
7. callback reorder handling;
8. multi-instance-safe webhook processing;
9. mapping provider facts into the canonical Payment lifecycle through PaymentService;
10. compatibility with external `Idempotency-Key`;
11. provider-operation idempotency mapping from 2.12A;
12. no client-controlled money authority;
13. no provider→Payment direct write bypass;
14. no SPLIT_AT_PAYMENT;
15. no Ledger/Commission/Settlement/Payout side effects unless explicitly owned by another approved step.

## 2. REPOSITORY BASELINE — VERIFY FIRST

Run:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -20
```

Verify:

- 2.12A approved and persisted;
- 2.12H approved and persisted;
- Roadmap NEXT = 2.12B;
- current migration count;
- artifact-integrity baseline;
- worktree state.

Do not touch unrelated untracked prompts.

If prerequisites are inconsistent:

`PHASE 2 STEP 2.12B BLOCKED — PREREQUISITE STATE MISMATCH`

## 3. REQUIRED SOURCES

Inspect actual repository:

- canonical Roadmap v3;
- 2.12 Payment Flow architecture + Strict Review;
- 2.12A architecture + implementation + Strict Review;
- 2.12H architecture + implementation + Strict Review;
- Refund Flow;
- Dispute Foundation;
- ProviderFee/Settlement/Payout foundation;
- ADR-0010, ADR-0013, ADR-0014;
- API/events/ids docs;
- Step 2.17 scope notes;
- PaymentService;
- provider abstraction/registry;
- provider operation key logic;
- external idempotency model/interceptor;
- Finance controllers;
- EventBus/outbox/inbox;
- config/env validation;
- auth/RBAC;
- test harness.

Current code wins over reports.

## 4. PROVIDER CHOICE — HARD GATE

Do not invent a PSP.

Determine whether the canonical Roadmap/repository names a provider or approved provider set.

If exactly one provider is canonical, implement that provider only.

If multiple are planned but none selected:

`PHASE 2 STEP 2.12B BLOCKED — PROVIDER SELECTION REQUIRED`

If provider selection is intentionally configurable and already canonical, implement only that approved set.

No temporary provider choice just to complete the step.

## 5. CARD / WALLET SCOPE

Determine actual canonical rails.

Expected title implies buyer card payment and wallet methods only where supported by the approved provider contract.

Do not assume Apple Pay, Google Pay, PayPal, internal wallet or stored-value balance unless Roadmap/provider contract explicitly supports them.

Distinguish:

- payment method;
- PSP provider;
- provider payment intent/session;
- canonical Payment aggregate.

## 6. PAYMENT LIFECYCLE AUTHORITY — CRITICAL HARD GATE

PaymentService remains sole canonical business lifecycle authority.

Provider adapter/webhook code must not directly mutate Payment via Prisma/raw SQL.

Allowed:

`provider result/webhook → normalized provider fact → PaymentService transition`

Forbidden:

- adapter writes Payment.status;
- webhook handler writes Payment.status;
- SDK callback writes milestones;
- raw SQL Payment mutation outside PaymentService.

Repo-wide prove this after implementation.

## 7. AUTHORIZED / CAPTURED SEMANTICS

Inspect current approved Payment lifecycle.

If AUTHORIZED is reserved/unreachable and 2.12B is its canonical owner, implement it only if the chosen PSP flow and Roadmap require it.

Do not force AUTHORIZED merely because the provider exposes it.

Map provider-specific states into the minimal canonical lifecycle.

If the selected PSP cannot be represented safely:

`ARCHITECTURE DECISION REQUIRED`

## 8. PAYMENT INITIATION ENDPOINT

Use the protected external payment creation/initiation endpoint from 2.12H.

Requirements:

- `Idempotency-Key` remains mandatory where defined;
- external request idempotency executes before PSP side effect;
- provider operation identity remains server-derived;
- client cannot override provider operation key;
- client cannot override amount/currency;
- retry maps to same provider operation.

Do not create a second HTTP idempotency mechanism.

## 9. PROVIDER OPERATION IDEMPOTENCY — CRITICAL

Map server-derived provider operation identity to provider-native idempotency where supported.

Requirements:

- same canonical operation → same PSP idempotency key;
- raw external `Idempotency-Key` is not blindly passed through as provider authority;
- divergent operation cannot reuse provider slot silently;
- network timeout retry is safe.

Document provider-specific limits.

## 10. REAL NETWORK CLIENT

All PSP calls must go through the 2.12A provider adapter boundary.

No direct SDK/HTTP call from controller, PaymentService, Order, Booking, Commission, Refund or Dispute.

Use explicit timeouts. No infinite retry loop. No broad background worker.

## 11. PROVIDER CREDENTIALS / SECRETS

Credentials must come from canonical configuration.

Requirements:

- no committed secrets;
- no demo fallback keys in production;
- no logging/exposure;
- startup validation only when provider enabled;
- tests isolated;
- no legacy credential reuse.

Do not invent a secret-management platform.

## 12. PROVIDER REFERENCE PERSISTENCE

If external provider payment/intent/reference ID is stored:

- server-owned;
- provider-scoped;
- unique by provider + external ID where justified;
- nullable legacy-safe;
- no fabricated backfill;
- no client mass assignment;
- supports webhook correlation.

Schema changes must be additive.

## 13. WEBHOOK ENDPOINT — FIRST ALLOWED HERE

Create canonical provider-specific webhook/callback endpoint only for selected provider(s).

Requirements:

- explicit provider route;
- raw-body handling only if signature spec requires it;
- no generic unauthenticated event endpoint;
- bounded body size;
- correct content type;
- safe errors;
- no sensitive raw payload logging;
- no business lookup/mutation before signature verification.

## 14. SIGNATURE VERIFICATION — CRITICAL HARD GATE

Signature verification must happen before:

- dedup claim;
- provider event normalization used as authority;
- Payment lookup;
- business transition;
- AuditLog/domain side effect.

Verify algorithm, secret/key, raw bytes, provider timestamp/replay window if defined, malformed signature handling and invalid signature handling.

Invalid/tampered webhook → controlled rejection, 0 business mutation.

## 15. WEBHOOK DEDUP PERSISTENCE — CRITICAL

Webhook dedup must be durable in PostgreSQL.

Use provider immutable event ID where available.

Requirements:

- provider + providerEventId unique;
- restart-safe;
- multi-instance safe;
- duplicate delivery → one business effect;
- no process-memory authority.

Do not reuse `ExternalIdempotencyRecord` unless architecture explicitly designed it for webhooks.

## 16. WEBHOOK MULTI-INSTANCE SAFETY

Two application instances may receive same webhook concurrently.

Prove:

- one canonical event claim;
- one business effect;
- loser safe no-op/controlled duplicate path;
- no raw P2002/500;
- no duplicate Payment transition/event/history.

Use real DB concurrency.

## 17. CALLBACK REORDER — CRITICAL HARD GATE

Provider callbacks may arrive out of order.

At minimum model:

- CAPTURED before AUTHORIZED;
- FAILED after CAPTURED;
- CANCELLED after CAPTURED;
- duplicate CAPTURED;
- old provider status after terminal state;
- webhook before API response processing completes.

Provider events must never force illegal backward transition.

Use PaymentService transition guards/CAS.

Do not order solely by receipt timestamp.

## 18. WEBHOOK BEFORE API RESPONSE

Required scenario:

1. TravelHub sends create/initiate request;
2. provider succeeds;
3. webhook arrives immediately;
4. provider HTTP response has not yet been processed locally.

Prove durable correlation through provider reference/operation identity and no duplicate Payment.

## 19. API TIMEOUT + WEBHOOK SUCCESS

Required scenario:

1. provider accepted request;
2. TravelHub call times out;
3. provider sends success webhook;
4. client retries original API request.

Prove:

- PSP-native idempotency prevents duplicate charge;
- webhook finds canonical Payment;
- external HTTP idempotency prevents duplicate business Payment;
- final state converges once.

## 20. PROVIDER RESPONSE NORMALIZATION

Normalize provider-specific statuses/errors into provider-neutral types.

No raw SDK objects in PaymentService/public API.

Create explicit mapping:

| Provider status/event | Normalized provider fact | Canonical Payment effect |
|---|---|---|

PaymentService remains transition authority.

## 21. ERROR NORMALIZATION

Handle:

- decline;
- timeout;
- provider 4xx;
- provider 5xx;
- provider auth/config error;
- malformed response;
- idempotency conflict;
- unsupported method;
- network interruption.

Expected provider errors must be controlled. Unknown internal errors must not become fake declines. No secret/raw-provider leakage.

## 22. CLIENT RESPONSE CONTRACT

Define safe buyer response.

May include only what chosen provider requires, e.g. Payment code/status, safe client secret/session token, redirect URL or method instruction.

Never expose provider secret keys or raw PSP objects.

## 23. WALLET SEMANTICS

Explicitly classify wallet type:

- provider-hosted wallet;
- browser/device wallet token;
- TravelHub internal wallet/balance.

Do not invent an internal stored-value wallet unless Roadmap defines one.

## 24. CARD DATA / PCI BOUNDARY — CRITICAL

Prefer tokenized/provider-hosted card collection.

Hard rules:

- PAN persistence = 0;
- CVC persistence = 0;
- raw card logging = 0;
- no full sensitive payment-method object persistence;
- no card data in AuditLog/events.

If raw PAN/CVC must pass through TravelHub backend:

`ARCHITECTURE DECISION / SECURITY REVIEW REQUIRED`

## 25. DOMAIN EVENTS

Reuse existing canonical Payment events through PaymentService.

Do not invent provider-receipt business events unless required by canonical contract.

Webhook receipt itself is not automatically a domain event.

## 26. WEBHOOK HISTORY / AUDIT

If durable provider-event history beyond dedup is required, keep it minimal:

- provider;
- providerEventId;
- normalized type;
- processing status;
- correlation ref;
- timestamps;
- safe error category.

Do not persist full sensitive payload by default.

## 27. RETRY POLICY

Direct PSP call retries must be bounded and safe under provider idempotency.

No retry on terminal decline.

No broad global retry worker.

Failed webhook processing may use minimal safe local recovery only if needed; do not redesign Step 2.17 global worker/retry architecture.

## 28. PROVIDERFEE BOUNDARY

Default expected:

`ProviderFee runtime = 0`

Do not extract/create ProviderFee unless current Roadmap explicitly assigns it to 2.12B.

## 29. SPLIT_AT_PAYMENT BOUNDARY — ABSOLUTE

Do not implement:

- platform fee;
- partner transfer;
- connected account;
- destination charge;
- commission split;
- PSP-native commission retention.

Even if provider supports it.

This is 2.12C.

## 30. COMMISSION BOUNDARY

Do not alter CommissionPolicy, frozen commissionSnapshot, PARTNER_COLLECT, Commission or CommissionAccrual.

No commission amount passed to PSP yet.

## 31. LEDGER BOUNDARY

Expected:

`LedgerTransaction delta = 0`

Do not implement 2.12D posting.

## 32. REFUND / DISPUTE BOUNDARY

Default expected unless Roadmap explicitly says otherwise:

- provider Refund execution = 0;
- provider Dispute/Chargeback execution = 0.

Payment webhook must not mutate Refund/Dispute.

## 33. ORDER PROJECTION

Existing PaymentCaptured → Order projection remains Order-owned.

Finance/provider/webhook code must not write `order.*` directly.

## 34. 2.12H EXTERNAL IDEMPOTENCY REGRESSION

Rerun and preserve:

- identical retry;
- divergent reuse;
- concurrent identical;
- crash-window recovery;
- cross-principal isolation.

Provider integration must not bypass 2.12H.

## 35. PSP-LOCAL MULTI-INSTANCE MATRIX — REQUIRED

Prove:

| Scenario | Required invariant |
|---|---|
| duplicate create-payment / two instances | one PSP operation |
| API timeout + retry | same provider operation |
| duplicate webhook / two instances | one webhook business effect |
| webhook before API response | correct correlation |
| callback reorder | legal monotonic domain transition |
| two workers same event | DB dedup/CAS |
| provider timeout then webhook success | one final business state |
| duplicate CAPTURED | no duplicate event/history/projection |

Hard gate.

## 36. WEBHOOK BURST SUBSET — REQUIRED

Platform reconciliation assigned PSP webhook burst/concurrency subset to 2.12B.

This is not full 2.17B load qualification.

Add bounded stress-style integration coverage:

- N duplicate webhooks concurrently;
- mixed duplicate/reordered events;
- multiple app contexts where feasible.

Assert:

- one business effect;
- no raw 500;
- no deadlock;
- no duplicate Payment history/event;
- clean bounded completion.

Do not invent SLO numbers.

## 37. PROVIDER TIME / TEMPORAL CONTRACT

If provider timestamps are used:

- strict parse;
- UTC normalization;
- invalid/future handling according to provider/canonical contract;
- distinguish provider occurrence time from TravelHub persistence time;
- do not use provider timestamp as sole order authority unless provider guarantees sequencing.

Follow Finance Temporal Contract.

## 38. CONFIG / ENV VALIDATION

Validate provider configuration only when provider enabled:

- endpoint;
- API key/secret;
- webhook secret;
- timeout;
- test/sandbox mode if canonical.

No secret defaults.

Test missing/invalid config.

## 39. SANDBOX / TEST MODE

Keep sandbox/test mode clearly separated from production.

Do not require live PSP availability for normal CI unless repository policy explicitly permits it.

Prefer deterministic mock-server/fake-transport contract tests.

Never fabricate sandbox results.

## 40. PROVIDER CONTRACT TESTS

Verify actual adapter code:

- request mapping;
- provider idempotency key;
- amount/currency exactness;
- timeout;
- decline;
- malformed response;
- provider ref extraction;
- status normalization;
- secret redaction.

Do not mock away adapter logic.

## 41. WEBHOOK SIGNATURE TESTS

Test:

- valid signature;
- invalid signature;
- malformed signature;
- wrong secret;
- tampered body;
- duplicate valid event;
- provider timestamp/replay-window if defined;
- content-type constraints if relevant.

No business mutation before verification.

## 42. CALLBACK REORDER TESTS

At minimum:

- success → stale failure;
- failure → later success if provider contract permits;
- captured → duplicate captured;
- cancelled → captured;
- captured → cancelled;
- unrepresentable provider states.

Expected behavior must come from canonical Payment transition rules.

## 43. DB / SCHEMA CHANGES

Any schema changes must be additive.

Potential justified additions:

- provider code/reference;
- provider event dedup/history;
- normalized safe provider metadata.

Rules:

- nullable legacy-safe;
- no fabricated backfill;
- no destructive ALTER;
- correct uniques/indexes;
- no `db push`;
- fresh replay;
- drift 0.

Do not add split/commission/ledger fields.

## 44. RBAC / PUBLIC SURFACE

Use existing authenticated buyer payment initiation contract.

Do not add arbitrary provider-management endpoints.

Webhook route is provider-authenticated by signature, not user RBAC.

## 45. LOGGING / OBSERVABILITY

Safe logs may include Payment code, provider code, provider event ID, safe normalized status and correlation ID.

Never log PSP/webhook secrets, card data, full raw sensitive payload, Authorization headers or unnecessary PII.

## 46. PCI / PII NEGATIVE AUDIT

Repo-wide audit new provider code for PAN, CVC, expiry, cardholder data, wallet tokens and secrets.

Expected raw sensitive card persistence = 0.

## 47. WRITE-PATH AUDIT

After implementation enumerate every new writer.

Allowed:

- provider metadata/reference persistence if canonical;
- provider-event dedup/history;
- Payment transitions via PaymentService only.

Forbidden direct writers:

- Payment status outside PaymentService;
- Order;
- Booking;
- Commission;
- Ledger;
- Refund;
- Dispute;
- ProviderFee;
- Settlement;
- Payout;
- Invoice.

## 48. P2002 / ERROR HANDLING

Known webhook-dedup unique conflict may be safe duplicate path.

Unknown P2002 must not become duplicate success.

Non-P2002 must not be swallowed.

Add tests.

## 49. UNIT TESTS — REQUIRED

At minimum:

1. provider request mapping;
2. amount/currency exactness;
3. provider operation idempotency mapping;
4. success;
5. decline;
6. timeout;
7. malformed response;
8. provider ref extraction;
9. status normalization;
10. signature verification;
11. duplicate webhook classification;
12. unknown P2002;
13. non-P2002 rethrow;
14. reorder guards;
15. secret redaction;
16. invalid config;
17. wallet/card method normalization;
18. no raw-card persistence path.

## 50. E2E / INTEGRATION MATRIX — REQUIRED

At minimum:

T1 Buyer initiation through 2.12H protected endpoint.  
T2 Identical external retry → one PSP operation.  
T3 Divergent external retry → 409, no second PSP operation.  
T4 Provider timeout + retry → same provider operation.  
T5 Provider success response → PaymentService transition.  
T6 Invalid webhook signature → no mutation.  
T7 Valid webhook → one canonical transition.  
T8 Duplicate webhook → one effect.  
T9 Concurrent duplicate webhook / independent contexts → one effect.  
T10 Webhook before API response → correct correlation.  
T11 API timeout then webhook success → one final Payment.  
T12 Callback reorder stale event → no illegal backward transition.  
T13 Duplicate CAPTURED → no duplicate Payment event/history.  
T14 External idempotency cross-principal remains isolated.  
T15 Order projection remains Order-owned.  
T16 No Commission/Ledger/ProviderFee/Settlement/Payout/Refund/Dispute side effects.  
T17 No SPLIT_AT_PAYMENT.  
T18 No raw card data stored/logged.  
T19 Webhook burst/concurrency subset.  
T20 Provider config/secret failure controlled.

Add provider-specific cases when required.

## 51. REAL PROVIDER NETWORK TEST POLICY

Separate:

- deterministic local adapter/webhook tests;
- optional provider sandbox smoke test;
- production release verification.

Do not make regression depend on live PSP unless canonical repository policy explicitly requires it.

Never claim sandbox success without actually running it.

## 52. FULL REGRESSION

Run actual current commands.

Backend:

- typecheck;
- build;
- full unit;
- targeted provider/payment/idempotency/webhook tests;
- Refund/Dispute/Commission/Ledger/Settlement regressions;
- EventBus/RBAC regression;
- full serial e2e.

Frontend:

- typecheck;
- Vitest;
- production build.

If buyer payment UI is explicitly in current 2.12B scope, test it fully; otherwise do not invent UI scope.

DB:

- migrate status;
- fresh replay;
- drift 0.

Report actual counts only.

## 53. ARTIFACT INTEGRITY

Run checker regression + real Roadmap checker.

Hard requirement:

`FAIL = 0`

Prefer `WARN = 0`.

## 54. ARCHITECTURE DOCUMENT

Create:

`docs/architecture/buyer-card-wallet-payment.md`

Cover:

1. purpose;
2. provider choice;
3. card/wallet scope;
4. Payment authority;
5. provider adapter boundary;
6. initiation flow;
7. 2.12H integration;
8. provider idempotency;
9. provider references;
10. webhook ingress;
11. signature verification;
12. provider-event dedup;
13. multi-instance safety;
14. callback reorder;
15. webhook-before-response;
16. timeout+webhook success;
17. status normalization;
18. error normalization;
19. PCI boundary;
20. wallet semantics;
21. logging/PII;
22. Order projection;
23. 2.12C boundary;
24. Ledger/Commission boundaries;
25. Refund/Dispute boundaries;
26. schema/migration;
27. tests;
28. deferred items;
29. guarantees/non-guarantees.

## 55. API / EVENTS DOCS

Update API docs for payment initiation and webhook contract as appropriate.

Update events docs only for actual domain event changes.

Default expectation: reuse existing Payment events.

## 56. IMPLEMENTATION REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.12B_BUYER_CARD_WALLET_PAYMENT_IMPLEMENTATION_REPORT.md`

Required sections:

1 Verdict  
2 Repository baseline  
3 Prerequisite verification  
4 Provider selection  
5 Card/wallet scope  
6 Payment authority  
7 AUTHORIZED/CAPTURED semantics  
8 Initiation endpoint  
9 External idempotency integration  
10 Provider-operation idempotency  
11 Network client  
12 Config/secrets  
13 Provider references  
14 Webhook endpoint  
15 Signature verification  
16 Webhook dedup  
17 Multi-instance safety  
18 Callback reorder  
19 Webhook-before-response  
20 Timeout+webhook success  
21 Provider status mapping  
22 Error mapping  
23 Client response  
24 Wallet semantics  
25 PCI boundary  
26 Events  
27 Webhook history/audit  
28 Retry policy  
29 ProviderFee boundary  
30 SPLIT boundary  
31 Commission boundary  
32 Ledger boundary  
33 Refund/Dispute boundary  
34 Order projection  
35 2.12H regression  
36 Webhook burst subset  
37 Provider time semantics  
38 Config validation  
39 Sandbox/testing policy  
40 Contract tests  
41 Signature tests  
42 Reorder tests  
43 Schema/migration  
44 RBAC/public surface  
45 Logging/PII  
46 Write-path audit  
47 P2002/error handling  
48 Unit tests  
49 E2E tests  
50 Backend regression  
51 Frontend regression  
52 DB regression  
53 Artifact integrity  
54 Findings  
55 Fixes  
56 Observations  
57 Negative checks  
58 Files changed  
59 Roadmap update  
60 Persistence  
61 Repository Evidence  
62 Release  
63 Exact NEXT  
64 Final statement

## 57. ROADMAP UPDATE

Only after implementation/regression succeeds.

Set 2.12B:

`🚧 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

NEXT:

`PHASE 2 — STEP 2.12B — STRICT REVIEW`

Do not start 2.12C.

## 58. NEGATIVE CHECKS — FINAL

Explicitly prove:

- direct provider→Payment Prisma writes = 0;
- client-controlled amount/currency = 0;
- external Idempotency-Key bypass = 0;
- provider operation identity client authority = 0;
- invalid-signature webhook mutation = 0;
- duplicate webhook duplicate business effect = 0;
- SPLIT_AT_PAYMENT = 0;
- Commission policy mutation = 0;
- Ledger posting = 0;
- ProviderFee creation = 0 unless current Roadmap explicitly assigns it here;
- Settlement = 0;
- Payout = 0;
- provider Refund execution = 0 unless explicitly in scope;
- provider Dispute execution = 0 unless explicitly in scope;
- direct Order write from provider/Finance = 0;
- raw PAN/CVC persistence = 0;
- RLS implementation = 0;
- global schemaVersion retrofit = 0;
- Step 2.17 implementation = 0;
- Step 2.17A/B implementation = 0;
- Step 2.12C implementation = 0.

## 59. STOP CONDITIONS

Stop with:

`PHASE 2 STEP 2.12B BLOCKED — ARCHITECTURE DECISION REQUIRED`

if:

1. no canonical provider choice exists;
2. provider lifecycle cannot be represented safely;
3. secure card/wallet flow requires unapproved raw card handling;
4. webhook protocol cannot be securely authenticated with available architecture;
5. no stable provider event identity/dedup can be defined;
6. webhook-before-response correlation cannot be durable;
7. timeout+retry can double-charge despite 2.12A/2.12H;
8. implementation requires 2.12C SPLIT;
9. implementation requires global Step 2.17 redesign;
10. provider config/security authority is missing.

Do not invent around blockers.

## 60. GIT PERSISTENCE — REQUIRED

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

Stage only exact 2.12B files and inspect staged diff.

Suggested commit:

```bash
git commit -m "feat(finance): implement buyer card wallet payment provider flow"
```

Push normally, never force.

Verify HEAD equals upstream before claiming PUSHED.

## 61. REPOSITORY EVIDENCE

Use canonical:

`docs/prompts/REPOSITORY_EVIDENCE_FOOTER_TEMPLATE.md`

Record actual repository, branch, HEAD, upstream, worktree state, migration count, reviewed diff base/head, persistence SHA and push status.

Use established two-commit provenance/footer pattern if needed. Never invent SHA.

## 62. RELEASE

No production release in implementation pass.

Record:

`RELEASE: NOT PERFORMED — STRICT REVIEW REQUIRED`

No deploy/tag/production migration.

## 63. FINAL RESPONSE FORMAT

On success:

```text
PHASE 2 STEP 2.12B IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW

Provider/payment:
- provider: <actual canonical provider>
- card scope: <actual>
- wallet scope: <actual>
- Payment lifecycle authority: PRESERVED
- external Idempotency-Key: ENFORCED
- provider operation idempotency: PASS
- real PSP network: IMPLEMENTED
- provider references: <actual>
- webhook endpoint: IMPLEMENTED
- signature verification: PASS
- webhook dedup: PASS
- multi-instance duplicate webhook: PASS
- callback reorder: PASS
- webhook-before-response: PASS
- API-timeout + webhook-success: PASS
- raw PAN/CVC persistence: 0
- SPLIT_AT_PAYMENT: 0
- direct provider→Payment writes: 0
- Step 2.12C: NOT STARTED

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
NEXT: PHASE 2 — STEP 2.12B — STRICT REVIEW
```

## 64. HARD STOP

After repository-first discovery, implementation, provider contract tests, webhook signature/dedup/reorder tests, multi-instance proof, 2.12H regression, full regression, docs/report/Roadmap, artifact checker, explicit staging, commit, push, upstream verification and Repository Evidence:

**STOP.**

Do not perform Strict Review in this pass.

Do not start Step 2.12C.

The only valid NEXT is:

`PHASE 2 — STEP 2.12B — STRICT REVIEW`
