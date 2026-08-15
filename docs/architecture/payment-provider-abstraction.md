# Payment Provider Abstraction (Step 2.12A)

Provider-neutral abstraction layer for future PSP adapters. NO real network,
NO webhooks, NO SPLIT_AT_PAYMENT, NO Ledger/ProviderFee/Settlement/Payout/
Invoice runtime. Built per the Phase 2 Critical Platform Risks & Payment/PSP
Readiness Reconciliation (2026-08-15) and the hardened 2.12A prompt.

## Provider-neutral ownership

The abstraction owns:

- provider identity (server-owned, deterministic, validated);
- capability discovery (Roadmap-justified capabilities only);
- provider request normalization (frozen authoritative facts);
- provider result normalization (never raw SDK/HTTP objects);
- provider error normalization (explicit retryability, no string inference);
- provider-operation identity / idempotency mapping;
- (future) provider-specific transport boundary in adapters — 2.12B.

The abstraction does NOT own: canonical Payment business lifecycle
(PaymentService remains the single authority), CommissionPolicy/Commission/
CommissionAccrual, Refund lifecycle, Dispute lifecycle, Ledger, Settlement,
Payout, Invoice.

## Provider identity

- `PaymentProviderRegistry` — one NestJS DI registry: explicit registration,
  deterministic resolution, unknown provider → controlled 404, duplicate
  registration → controlled 409, no fallback-to-first, no default provider.
- `KNOWN_PAYMENT_PROVIDER_CODES` is EMPTY: no production PSP selected yet.
  Step 2.12B registers real adapters.
- `FakePaymentProvider` (code `FAKE`) is TEST-ONLY: never registered by
  production code; `has("FAKE")` is false on a production-built registry.

## Capability semantics

`PaymentProviderCapability`: AUTHORIZE / CAPTURE / DIRECT_CAPTURE / CANCEL /
WEBHOOKS (2.12B), REFUND (2.13), NATIVE_SPLIT (2.12C). Hard rules: capability
does NOT activate behavior, does NOT define business lifecycle, NATIVE_SPLIT
does NOT define commission rate/base (ADR-0013), declaring a capability does
NOT implement the future step.

## Request / result / error contracts

- `ProviderPaymentRequest`: paymentId, paymentCode, operation, orderRef,
  frozen amount (Decimal string), frozen currency, providerOperationKey,
  correlationRef. Forbidden authorities: mutable Catalog/Tax/FX, frontend
  amount/currency/commission, live CommissionPolicy resolution. No PII.
- `ProviderOperationResult` (ok:true): providerCode, providerPaymentId,
  normalizedStatus SUCCESS, echoed amount/currency (invariant verification
  only). No raw payload, no card data, no credentials.
- `ProviderFailure` (ok:false): providerCode, category, explicit retryable,
  safe code/message. Categories: UNAVAILABLE / TIMEOUT / AUTH_CONFIGURATION /
  INVALID_REQUEST / DECLINED / UNSUPPORTED_CAPABILITY / CONFLICT_IDEMPOTENCY /
  MALFORMED_RESPONSE. DECLINED is a business outcome from a normalized result,
  never from an internal exception ("unknown internal error must not become a
  fake decline"). Typed `ProviderError` classes carry explicit retryability and
  HTTP statuses (502 upstream, 409 idempotency conflict, 422 unsupported).

## Provider-operation idempotency identity

`deriveProviderOperationKey({paymentCode, operation})` → deterministic
`PAY-<code>:<operation>`. Server-derived, stable across safe retry, not random
per retry, not client-forgeable, scoped to operation + TravelHub Payment.
Future adapters map it to provider idempotency header/key.
`assertProviderOperationParamsConsistent` detects divergent replay at contract
level → controlled ConflictError. NO persistence in 2.12A.

## PSP-local concurrency / race model (design for 2.12B)

Reconciliation requires the design before 2.12B. Contract per race:

| Race | Handling owner |
|---|---|
| Duplicate create-payment intent/request | PaymentService CAS + `Payment_one_active_per_order` partial unique (2.12); provider-operation key reuse (2.12A identity) |
| API retry after client timeout | external `Idempotency-Key` — Step 2.12H (hard prerequisite of 2.12B) |
| Same provider operation from two instances | stable provider-operation identity (2.12A) + future DB unique on `provider + providerPaymentId` (2.12B) |
| Webhook arrives before API response | 2.12B webhook dedup (DB unique on provider-event key) + idempotent domain transition |
| Duplicate webhook to two instances | 2.12B webhook dedup storage; Payment CAS idempotency |
| Callback reorder | 2.12B: first-valid-transition wins (CAS + milestones first-only, 2.5A/2.10C discipline) |
| Provider idempotency key reuse | 2.12B adapter maps 2.12A operation identity → provider key; divergent params → 409 |
| Local DB transition CAS/unique interaction | PaymentService CAS (`updateMany id+status+version`) — unchanged |

System-wide outbox publisher atomic claim / single-delivery worker / durable
retry scheduler remain Step 2.17 (NOT this step).

## Step 2.12H dependency

2.12A defines the INTERNAL provider-operation identity only. The EXTERNAL HTTP
`Idempotency-Key` contract (header, storage authority, replay semantics, TTL,
provider-key mapping) is Step 2.12H — a hard prerequisite of 2.12B. Handoff:
`2.12A provider operation identity → 2.12H external Idempotency-Key → 2.12B
PSP/webhook execution`. 2.12B must not start until 2.12H is approved.

## Step 2.17 boundary

No global Outbox SKIP LOCKED, publisher lease, retry scheduler, durable
worker, or distributed coordination here. Absence of those is NOT an excuse to
skip PSP-local idempotency/race design (delivered above).

## RLS / partner isolation boundary

ADR-0014: application isolation canonical, RLS deferred. The abstraction
preserves principal/partner ownership boundaries (no provider operation
accessible across partner scope; provider identity never client-supplied as a
trust boundary). No DB RLS migration.

## No-real-network guarantee

- 0 real PSP HTTP calls; 0 SDK runtime execution; 0 API keys; 0 callback
  endpoints; 0 webhook endpoints; 0 signature verification; 0 remote polling.
- `FakePaymentProvider.executeOperation` is a pure in-memory contract exercise
  (test-only); provider/ contains no http/axios/fetch imports.
- Real adapter transport execution is strictly Step 2.12B.

## Files

- `backend/src/modules/finance/provider/provider.types.ts`
- `backend/src/modules/finance/provider/provider-operation-id.ts`
- `backend/src/modules/finance/provider/provider-error.ts`
- `backend/src/modules/finance/provider/payment-provider.registry.ts`
- `backend/src/modules/finance/provider/fake.payment-provider.ts`
- `backend/src/modules/finance/provider/payment-provider.module.ts`
- tests: `provider/payment-provider.spec.ts` (unit 17), `backend/test/payment-provider-abstraction.e2e-spec.ts` (e2e T1–T17)
