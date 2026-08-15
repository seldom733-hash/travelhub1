# External API Idempotency Contract (Step 2.12H)

Durable external HTTP request idempotency for selected mutating API
operations. PostgreSQL is the correctness authority — no in-memory map, no
process-local mutex, multi-instance and restart-safe.

## Purpose / non-goals

Purpose: protect protected mutating operations against client/proxy retry,
concurrent duplicates, divergent key reuse, different application instances,
process restart and response loss after commit.

Kept strictly separate (distinct layers, NOT conflated):

- external API idempotency (this step, `events.ExternalIdempotencyRecord`);
- 2.12A provider-operation identity (`deriveProviderOperationKey`,
  server-derived, no HTTP key, no persistence);
- EventBus inbox dedup (`InboxEvent` — consumer-level, eventId-based);
- outbox publication (`OutboxEvent`);
- future PSP webhook dedup (2.12B, provider-local).

Non-goals: exactly-once network delivery (never claimed), PSP/webhook
expansion, RLS (ADR-0014), schemaVersion retrofit, backup/DR, load framework,
Step 2.17 hardening, Step 2.12B.

## Terminology

- **Idempotency-Key** — opaque client-supplied header for protected ops.
- **Slot** — durable per-(principal, operation, key) claim.
- **Fingerprint** — server-derived digest of the canonical validated request.
- **Replay** — returning the stored safe result of a completed slot.

## Protected operations (V1)

Explicit registry `IDEMPOTENT_OPERATIONS` (fail-closed: unknown operation →
error at decoration time). V1 = minimal PSP-readiness set:

| Operation | Endpoint | Why |
|---|---|---|
| `payment.create` | `POST /api/v1/finance/payments` | payment-initiation boundary, hard prerequisite of 2.12B |

Not protected (deliberately): payment transitions (`confirm/fail/cancel`) —
they are state-machine CAS idempotent (repeat transition → 409 canonical
contract); sales/order creation — outside the PSP-readiness boundary;
`GET`/reads — idempotent by nature.

## Header contract

- Header: `Idempotency-Key` (exact lowercase `idempotency-key`).
- Required for protected operations (missing → 400).
- Opaque; bounded ≤ 128 chars; charset `[A-Za-z0-9._~-]`
  (RFC 3986 unreserved + `~`) — no spaces/control/non-ASCII.
- Empty/whitespace-only → 400; multiple header values → deterministic 400
  (Express array form); oversized → 400.
- No PII/secrets, no provider semantics, no client-controlled fingerprint.

## Principal/tenant scope

Slot scope = authenticated server context (`scopeType="USER"`, `scopeId =
user.id` from `request.user`, NEVER from body/query/headers). Response lookup
happens only after guards established the principal. A guessed literal key can
never replay another user's result (different scope → different slot digest).
RLS remains deferred under ADR-0014 — isolation is application-level.

## Operation identity

Stable server-derived operation name from explicit `@Idempotent("...")`
metadata — not host/trace/request-id/timestamp/process/raw URL/insertion
order. Same key on another operation → different slot (no wrong replay).

## Request fingerprint

`sha256(canonical({params, body}))` where body is the VALIDATED DTO (same
global ValidationPipe), not raw transport:

- property-order independent (recursive key sort), arrays order-preserved;
- includes path params; query excluded (V1 protected ops have no semantically
  relevant query — documented decision);
- undefined = absent; omitted vs null = fail-loud distinct;
- decimal strings and currency case NOT normalized (`"150.00"`≠`"150"`,
  `"usd"`≠`"USD"` — fail-loud, per 2.12A canonical-representation stance);
- no JS-float money normalization (money is string in DTOs);
- Idempotency-Key/auth/tracing/volatile metadata excluded by construction
  (never passed to the fingerprint function).

## Persistence / raw-key decision

Digest storage: `slotKey = sha256(JSON([scopeType, scopeId, operation,
clientKey]))`. Justification: opaque client key never needed after claim;
digest prevents raw key leakage into DB/logs; deterministic for replay lookup.
Separate columns `scopeType/scopeId/operation` kept for observability/cleanup.
No Authorization/cookies/secrets/PII/raw sensitive bodies stored —
`responseBody` holds only the safe whitelisted business result (payment DTO is
PII-free by contract, verified in 2.12 T12).

## Uniqueness / multi-instance

`slotKey` UNIQUE — DB backstop. Two instances cannot both claim the same slot
(P2002 → re-read → classify). No process-local mutex as authority. Expected
races never leak raw Prisma errors (P2002 handled → controlled 409/replay).

## State machine

`IN_PROGRESS → COMPLETED` (minimal, explicit). Business failure/rollback →
claim deleted (key reusable, no poisoning). COMPLETED stores
`responseStatus` + `responseBody` (replayable safe result).

## Transaction / crash windows

Windows analyzed explicitly:

1. **before claim** — nothing written;
2. **claim, before business write** — claim `IN_PROGRESS`; crash → stale
   takeover (CAS `UPDATE ... WHERE status=IN_PROGRESS AND claimedAt < stale`,
   bound `IDEMPOTENCY_STALE_AFTER_MS = 30s`, technical not business) →
   re-execute;
3. **business write, before stored result** — business fact committed, claim
   `IN_PROGRESS`; crash → stale takeover → re-execute: SAFE because protected
   operations are business-idempotent (`payment.create` returns the existing
   active Payment — same fact, no duplicate committed side effect);
4. **stored result, before HTTP response** — claim `COMPLETED`; retry →
   DB-backed replay;
5. **process death mid-operation** — covered by (2)+(3).

Residual: after a crash in window (3), a same-key retry re-EXECUTES the
business operation (not exactly-once), but the business fact is not duplicated
(guaranteed by business idempotency of the protected set). This is documented,
not hidden.

STRICT REVIEW FIX (2.12H §18/§37): complete-step P2025 race — if the slot is
removed concurrently by another instance's rollback path between business
commit and the COMPLETED update (pathological >30s in-flight + takeover +
business P2002-loser), the committed business result is returned instead of a
raw 500; the slot is gone, so a future same-key retry re-executes safely
(business idempotent). Verified: unit #10 + e2e T20/T22 (0 raw 500).

## Concurrency (in-progress duplicates)

Bounded deterministic behavior: DB serialization via unique slotKey; on a
fresh `IN_PROGRESS` slot with identical fingerprint — poll/re-read up to
`IDEMPOTENCY_MAX_WAIT_MS = 2s` → COMPLETED → replay, else controlled 409; on
divergent fingerprint → immediate 409; on stale slot → CAS takeover. No
indefinite local waiting, no fabricated success.

## Replay semantics

Canonical replay = business-result replay (safe serialized `responseStatus` +
`responseBody`), not byte-identical transport replay. Never replay
Authorization/Set-Cookie/secrets/internal errors/first request's
tracing/request IDs (nothing but status+body is stored).

## Errors

- missing/malformed key → 400 (BadRequestException);
- divergent reuse / in-progress → 409 (ConflictError);
- auth → 401 (JwtAuthGuard, before the layer);
- RBAC → 403 (PermissionsGuard, before the layer);
- business rejection/rollback → original business status (e.g. 404/422), claim
  rolled back.

## Failure policy

- pre-business auth/RBAC/validation failure: no claim created (validation runs
  before claim) or claim not reached (guards);
- deterministic business rejection / transaction rollback: claim deleted →
  key reusable, no false COMPLETED;
- unexpected 5xx: claim deleted (best-effort) → next attempt re-executes;
- ambiguous commit state: covered by stale takeover + business idempotency.

## Retention

V1 explicit decision: **no auto-expiry / deferred cleanup** (no fabricated
retention number — no canonical retention authority exists). Cleanup jobs out
of scope (Step 2.17 territory).

## Auth / RBAC / logging / PII

- Idempotency never bypasses auth or RBAC (guards run before the interceptor;
  replay occurs only after principal scope established on the same request);
- anonymous replay of a used key → 401; RBAC-failing role → 403;
- raw keys never logged/stored; only digests; no PII in the record;
- error messages contain no key values.

## Multi-instance guarantees / non-guarantees

Guaranteed: single business fact under concurrent same-key identical requests
(DB unique + replay); controlled 409 for divergent reuse; DB-backed replay
across instances/restarts; no raw 500 from races.

NOT guaranteed: exactly-once execution (re-execution possible after stale
crash — no duplicate FACT, but the business call may run again);
delivery-level ordering; PSP-side guarantees (2.12B).

## 2.12A integration

Provider-operation identity (`deriveProviderOperationKey`) remains separate:
it is TravelHub-Payment-scoped, server-derived, not client-supplied. The
external Idempotency-Key is a DIFFERENT mechanism (HTTP request scope). Future
mapping (2.12B): `external request → canonical business fact → server-derived
provider operation`.

## 2.12B handoff

2.12B consumes this layer for checkout/payment initiation (client retry
semantics) and adds PSP-local concerns: webhook dedup (provider-event key DB
unique), create-payment race, callback reorder, duplicate webhook storm.
Idempotency-Key is the hard prerequisite 2.12B was waiting for.

## Step 2.17 boundary

No outbox worker changes, no EventBus redesign, no CI repair, no schemaVersion
retrofit, no durable retry scheduling — these remain Step 2.17.

## Deferred items

- external `Idempotency-Key` for non-payment operations (2.12F/2.14 chain) —
  registry extension, mechanism unchanged;
- retention/cleanup policy;
- per-operation normalization hooks for omitted-vs-null equivalence (V1:
  fail-loud distinct, documented);
- `@HttpCode`-aware status derivation for future non-POST protected ops
  (V1 uses method-default derivation + explicit `res.status` on replay).

## Invariants / tests

Unit: fingerprint canonicalization (insertion order, nested, arrays, decimal
strings, currency case, path params, omitted-vs-null, deterministic digest);
slot-key isolation (principal/operation/key); service claim/replay/divergent/
takeover/rollback/P2002-race. E2E T1–T19: header contract, first/retry/
divergent/in-progress/completed classes, genuine DB concurrency (T7/T8/T19),
app reconstruction (T9), cross-principal (T10), auth/RBAC (T11/T12), rollback
no-poison (T13), replay semantics (T14/T15), unprotected endpoint (T16),
Payment authority preserved (T17), no PSP/webhook (T18), DB race backstop
(T19).
