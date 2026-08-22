# PHASE 2 — STEP 2.12A — PAYMENT PROVIDER ABSTRACTION — IMPLEMENTATION PROMPT

## 0. MODE

**IMPLEMENTATION · REPOSITORY-FIRST · PROVIDER-NEUTRAL · STRICT SCOPE**

Implement only:

`PHASE 2 — STEP 2.12A — PAYMENT PROVIDER ABSTRACTION`

This step creates the canonical provider abstraction layer required before Step 2.12B (provider/webhook lifecycle) and Step 2.12C (SPLIT_AT_PAYMENT).

Do not start 2.12B, 2.12C, 2.12D, 2.12F, 2.12G, 2.14, 2.14A–F or any later implementation step.

## 1. PRIMARY OBJECTIVE

Implement the minimal provider-neutral Payment Provider abstraction that:

- gives Finance/Payment one canonical interface for future PSP adapters;
- separates external provider mechanics from Payment domain state;
- normalizes provider identity, capabilities, request/result contracts and errors;
- supports deterministic test/fake providers;
- preserves TravelHub idempotency and request correlation;
- introduces no real PSP integration;
- introduces no webhook processing;
- introduces no native payment split;
- introduces no Ledger/ProviderFee/Settlement/Payout/Invoice side effects;
- does not modify approved Payment/Refund/Dispute/Commission semantics.

## 2. REPOSITORY BASELINE — VERIFY FIRST

Before editing record:

- branch and HEAD;
- origin sync;
- dirty/untracked state;
- migration status/count;
- Roadmap status of 2.12, 2.12A–G, 2.12E, 2.14/2.14E/2.14F;
- backend/frontend package roots;
- current FinanceModule and PaymentService;
- existing provider-related code.

Do not clean unrelated worktree.

## 3. REQUIRED SOURCES

Inspect actual current repository:

- canonical Roadmap v3;
- Step 2.12 Payment Flow architecture + Strict Review;
- Step 2.12E Commission Accrual architecture + Strict Review;
- ADR-0013;
- Finance Domain Foundation;
- Finance Temporal Contract;
- Refund Flow;
- Dispute Foundation;
- Ledger foundation;
- ProviderFee / Settlement / Payout foundation;
- Step 2.17 Platform Hardening boundaries;
- `schema.prisma`;
- Payment/Refund/Dispute services;
- EventBus;
- FinanceModule/AppModule;
- config/env validation;
- integration-related folders;
- current provider/paymentMethod fields;
- API/events/RBAC docs;
- tests/fixtures.

Current code wins over reports.

## 4. EXISTING PROVIDER AUTHORITY — HARD GATE

Repo-wide search:

`Stripe`, `PayPal`, `Adyen`, `Checkout`, `provider`, `PSP`, `gateway`, `webhook`, `payment intent`, `authorize`, `capture`, provider-specific IDs, SDK calls, raw HTTP calls.

Classify each as:

1. active production integration;
2. dead/legacy;
3. schema-only;
4. docs-only;
5. test-only.

If a canonical abstraction already exists, reconcile it. Do not create a parallel one.

If two conflicting active abstractions exist:

`PHASE 2 STEP 2.12A BLOCKED — CONFLICTING PROVIDER ABSTRACTION`

## 5. OWNERSHIP

PaymentService remains owner of Payment business lifecycle.

Provider adapter owns only communication/normalization for external PSP.

Provider adapter must not become authority for:

- Payment business status;
- commission policy;
- refund business lifecycle;
- dispute business lifecycle;
- ledger/accounting state.

No controller/frontend/PSP SDK should own the domain state machine.

## 6. MINIMAL PROVIDER INTERFACE

Implement the smallest interface supported by current Roadmap.

Candidate shape is illustrative only:

```ts
interface PaymentProvider {
  readonly code: string;
  getCapabilities(): PaymentProviderCapabilities;
  // only methods actually justified by 2.12A
}
```

Do not add authorize/capture/refund/webhook methods merely for completeness if those belong to later steps.

Minimality is preferred.

## 7. PROVIDER IDENTITY

Define stable, normalized server-owned provider identity.

Use repository conventions: enum/string union/registry key as appropriate.

Requirements:

- deterministic;
- validated;
- not arbitrary user-controlled;
- documented;
- no fake production provider.

If no real provider is approved, use only neutral/test identity for tests.

## 8. CAPABILITY MODEL

Only model capabilities needed by planned downstream steps.

Possible categories to reconcile:

- AUTHORIZE;
- CAPTURE;
- DIRECT_CAPTURE;
- CANCEL;
- REFUND;
- WEBHOOKS;
- NATIVE_SPLIT.

Do not introduce speculative capabilities.

Capability ≠ business policy.

`NATIVE_SPLIT` must never define commission rate.

## 9. PAYMENT LIFECYCLE HARD GATE

Step 2.12 already owns Payment state machine.

2.12A must not:

- introduce new business statuses;
- make provider status equal canonical Payment status;
- make AUTHORIZED reachable unless explicitly owned by this step;
- auto-transition Payment from adapter result;
- expose raw provider status as TravelHub lifecycle authority.

Provider status normalization and business transition authority must remain separate.

## 10. AUTHORIZED BOUNDARY

If `AUTHORIZED` remains reserved from Step 2.12, keep it unreachable.

If enabling it is required for provider abstraction but no approved semantics exist:

`ARCHITECTURE DECISION REQUIRED`

Do not silently activate it.

## 11. PROVIDER REQUEST CONTRACT

Provider-facing request types must use frozen authoritative facts only.

Potential fields where justified:

- TravelHub payment id/code;
- order ref;
- frozen amount;
- frozen currency;
- stable idempotency key.

Do not read mutable Catalog/Tax/FX.

Do not include unnecessary PII.

Do not implement callback/webhook fields unless contract already requires them.

## 12. PROVIDER RESULT NORMALIZATION

Do not leak SDK objects into PaymentService.

Normalize only required facts:

- provider code;
- provider transaction/reference ID where justified;
- normalized provider result/status;
- provider failure category/code;
- amount/currency echo if useful.

Do not persist arbitrary raw PSP payload.

Do not log/store card data, credentials or secrets.

## 13. PROVIDER ERROR MODEL — HARD GATE

Normalize expected external failures, e.g. where supported:

- unavailable/temporary;
- timeout;
- auth/configuration error;
- invalid request;
- provider decline;
- unsupported capability;
- conflict/idempotency;
- malformed provider response.

Expected provider errors must not become raw 500 by accident.

Unknown errors must not be converted into fake provider declines.

## 14. IDEMPOTENCY

Define stable TravelHub-side provider request identity.

Requirements:

- server-generated/business-derived;
- stable across safe retry;
- not random per retry;
- not client-forgeable;
- future adapters can map it to provider idempotency key/header.

Do not implement provider-specific retry semantics.

## 15. REGISTRY / RESOLUTION

Implement one canonical NestJS DI-based provider registry/resolver.

Requirements:

- explicit registration;
- deterministic lookup;
- unknown provider → controlled error;
- no arbitrary dynamic loading by request input;
- no fallback to first provider;
- test provider cannot be accidentally production-default.

## 16. TEST / FAKE PROVIDER

A fake provider is allowed only for tests/integration proof.

Requirements:

- deterministic;
- no real network;
- configurable result/error;
- clearly non-production;
- not named after a real PSP unless it actually implements that PSP.

## 17. NO REAL NETWORK — HARD GATE

Expected result of 2.12A:

- 0 external PSP API calls;
- 0 real PSP keys;
- 0 provider SDK runtime dependency unless strictly required and justified;
- 0 webhook/callback routes.

If current Roadmap actually requires a concrete PSP adapter in 2.12A, stop and reconcile.

## 18. CONFIG / SECRETS

If config shape is needed:

- no committed secrets;
- no reuse of legacy credentials;
- credentials not mandatory while no production provider exists;
- no secrets in logs/events/API;
- test config isolated.

## 19. PAYMENTMETHOD ≠ PROVIDER

Audit current free-form `paymentMethod`.

Explicitly separate:

- payment method;
- provider identity;
- provider transaction reference.

Do not repurpose one field to mean another.

If provider fields are required, migration must be additive and legacy-safe.

## 20. PROVIDER REFERENCE

If `providerPaymentId` or equivalent is introduced:

- nullable;
- server-owned;
- provider-scoped;
- no fabricated backfill;
- not TravelHub business ID;
- uniqueness only if semantics justify provider+reference uniqueness.

Add only if 2.12A genuinely requires it.

## 21. MIGRATION

Prefer no migration if code-level abstraction is sufficient.

If schema change is required:

- additive;
- nullable-first;
- no fake provider backfill;
- no reinterpretation of old Payment rows;
- no `db push`;
- fresh replay required.

Legacy unknown provider = NULL.

## 22. PUBLIC API BOUNDARY

Expected: abstraction is internal.

Do not create:

- `/webhooks/...`;
- generic provider mutation endpoints;
- provider debug/test production routes;
- public arbitrary provider selection.

Any public API requires explicit Roadmap evidence.

## 23. 2.12B WEBHOOK BOUNDARY

Strictly forbidden:

- webhook routes;
- signature verification;
- webhook dedup;
- provider callback mapping;
- webhook-driven Payment transition;
- authorize/capture webhook semantics.

Those belong to 2.12B.

## 24. 2.12C SPLIT_AT_PAYMENT BOUNDARY

Strictly forbidden:

- native PSP split;
- platform fee amount;
- partner share;
- transfer destination;
- connected-account semantics;
- commission amount in provider request;
- split execution.

Capabilities may describe future NATIVE_SPLIT only if canonical.

## 25. 2.12D LEDGER BOUNDARY

Provider abstraction creates 0 LedgerTransaction.

No accounting posting, balances or double-entry.

## 26. 2.12E REGRESSION

Approved PARTNER_COLLECT flow must remain unchanged.

Provider abstraction must not mutate or re-resolve:

- CommissionPolicy;
- commissionSnapshot;
- Commission;
- CommissionAccrual;
- CommissionAccrued.

Run explicit regression.

## 27. REFUND BOUNDARY

No real PSP refund operation.

No provider-driven Refund transitions.

Do not add refund provider ID unless absolutely required and canonical.

## 28. DISPUTE BOUNDARY

No provider dispute webhook, evidence flow, provider chargeback status or liability model.

## 29. PROVIDER FEE BOUNDARY

Provider abstraction creates 0 ProviderFee.

Do not infer provider fee from normalized result.

## 30. SETTLEMENT / PAYOUT BOUNDARY

0 Settlement, 0 Payout, 0 bank transfer, 0 partner balance mutation.

## 31. INVOICE BOUNDARY

No Invoice runtime.

Provider intent ≠ invoice.

Step 2.14 remains blocked/not resumed.

## 32. RBAC

Provider abstraction is internal infrastructure.

Do not invent end-user provider-management permissions unless Roadmap explicitly requires configuration UI/API.

No BUYER/PARTNER direct provider access.

## 33. AUDIT / LOGGING / SECURITY

Do not log:

- API keys;
- access tokens;
- card data;
- raw provider payloads;
- unnecessary PII.

Preserve correlation context.

Do not AuditLog every internal call unless current convention requires it.

## 34. DOMAIN EVENTS

Default: 0 new business domain events in 2.12A.

Do not invent:

- PaymentProviderSelected;
- ProviderRequestSent;
- ProviderIntentCreated.

Provider abstraction is infrastructure.

## 35. RETRY BOUNDARY

Do not implement broad background retry/scheduler here.

Cross-cutting durable publisher/retry remains owned by Step 2.17 unless Roadmap explicitly says otherwise.

Abstraction may classify retryable provider errors; no worker.

## 36. UNIT TESTS

Add focused tests for:

1. registry known provider;
2. registry unknown provider;
3. duplicate registration/conflict if possible;
4. capability check;
5. normalized success;
6. normalized decline;
7. timeout/unavailable mapping;
8. unsupported capability;
9. stable idempotency key;
10. no raw provider object leakage;
11. fake provider deterministic outcomes;
12. abstraction alone does not mutate Payment state.

Test schema validation too if fields are added.

## 37. E2E / INTEGRATION TESTS

At minimum prove:

T1. Finance/provider abstraction boots.

T2. Known fake provider resolves.

T3. Unknown provider → controlled error, no raw 500.

T4. Provider abstraction call does not mutate canonical Payment status.

T5. No webhook routes added.

T6. No split/Commission/Accrual side effects.

T7. Ledger count unchanged.

T8. ProviderFee count unchanged.

T9. Settlement/Payout counts unchanged.

T10. Refund/Dispute unchanged.

T11. No external network / real PSP dependency.

T12. No secret returned/logged.

T13. Existing Payment lifecycle regression green.

T14. Existing 2.12E PARTNER_COLLECT regression green.

Add tests only for real implementation risks.

## 38. REPO-WIDE WRITE-PATH AUDIT

After implementation enumerate all new/changed writers.

Expected provider abstraction writes:

- no Payment business status;
- no Commission;
- no CommissionAccrual;
- no Ledger;
- no Refund;
- no Dispute;
- no ProviderFee;
- no Settlement;
- no Payout;
- no Invoice.

If provider metadata is persisted, list exact writer and justify.

## 39. PROVIDER-SPECIFIC AUDIT

Repo-wide search production code for real PSP SDK/name references.

Any provider-specific logic introduced by 2.12A must be justified by current Roadmap; otherwise remove/defer.

## 40. DOCUMENTATION

Create/update:

- `docs/architecture/payment-provider-abstraction.md`;
- `api.md` only if API changed;
- `events.md` only if event contract changed (expected none);
- Roadmap;
- implementation report.

README was recently reconciled; do not reintroduce stale claims.

## 41. IMPLEMENTATION REPORT

Create:

`docs/prompts/PHASE_2_STEP_2.12A_PAYMENT_PROVIDER_ABSTRACTION_IMPLEMENTATION_REPORT.md`

Required sections:

1. Verdict
2. Repository baseline
3. Sources inspected
4. Existing provider code audit
5. Ownership
6. Provider interface
7. Provider identity
8. Capability model
9. Registry/resolution
10. Request contract
11. Result normalization
12. Error model
13. Idempotency
14. Test provider
15. Network boundary
16. Config/secrets
17. PaymentMethod/provider reconciliation
18. Provider reference
19. Schema/migration
20. Payment lifecycle boundary
21. AUTHORIZED boundary
22. Webhook boundary
23. SPLIT_AT_PAYMENT boundary
24. Ledger boundary
25. 2.12E regression
26. Refund boundary
27. Dispute boundary
28. ProviderFee boundary
29. Settlement/Payout boundary
30. Invoice boundary
31. RBAC
32. Events
33. Logging/security
34. Unit coverage
35. E2E coverage
36. Write-path audit
37. Provider-specific audit
38. Issues found
39. Fixes applied
40. Backend regression
41. Frontend regression
42. DB regression
43. Files changed
44. Deferred scope
45. Architecture decision status
46. Roadmap update
47. Exact NEXT
48. Final canonical statement

## 42. REQUIRED REGRESSION

Backend:

- typecheck;
- production build;
- unit;
- targeted e2e for Payment, Refund, Dispute, CommissionPolicy, CommissionAccrual, Ledger, ProviderFee/Settlement/Payout, event envelope, RBAC;
- full serial e2e.

Frontend:

- typecheck;
- Vitest;
- production build.

DB:

- migrate status;
- fresh replay;
- live→schema diff.

Report actual counts only.

## 43. STOP CONDITIONS

STOP with:

`PHASE 2 STEP 2.12A BLOCKED — ARCHITECTURE DECISION REQUIRED`

if:

1. provider abstraction ownership conflicts;
2. Roadmap requires a concrete PSP in 2.12A;
3. Payment lifecycle must change;
4. AUTHORIZED must become reachable without defined semantics;
5. paymentMethod/provider cannot be separated;
6. non-additive schema change is required;
7. abstraction requires 2.12B webhook behavior;
8. abstraction requires 2.12C split semantics;
9. provider fee accounting is required now;
10. safe secrets/config representation cannot be defined;
11. existing active provider integration conflicts with the abstraction.

Do not guess around stop conditions.

## 44. ROADMAP UPDATE

After successful implementation:

`PHASE 2 STEP 2.12A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Set NEXT:

`PHASE 2 — STEP 2.12A — STRICT REVIEW`

Do not start 2.12B.

Do not mark 2.12C ready/complete.

## 45. FINAL VERDICTS

Success:

`PHASE 2 STEP 2.12A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Architecture blocker:

`PHASE 2 STEP 2.12A BLOCKED — ARCHITECTURE DECISION REQUIRED`

Conflicting baseline:

`PHASE 2 STEP 2.12A BLOCKED — CONFLICTING PROVIDER ABSTRACTION`

## 46. HARD STOP

After implementation, tests, docs, Roadmap update and implementation report:

**STOP.**

Do not perform Strict Review.

Do not start 2.12B or 2.12C.

Do not resume Step 2.14.

The only NEXT item after successful implementation is:

`PHASE 2 — STEP 2.12A — STRICT REVIEW`
