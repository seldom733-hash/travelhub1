# PHASE 2 — STEP 2.12H — EXTERNAL API IDEMPOTENCY CONTRACT — IMPLEMENTATION REPORT

## 1. Verdict

`PHASE 2 STEP 2.12H IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

## 2. Repository baseline / prerequisites

- branch `master`, HEAD = upstream = `68c28bc` (2.12A strict-review footer
  commit), clean tree + unrelated untracked prompts.
- Prerequisites verified against actual repository (not reports):
  - 2.12A `STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES` (Roadmap
    line 591);
  - `PaymentService` remains the single Payment lifecycle authority
    (repo-wide 0 other payment writers);
  - real PSP network = 0; production PSP adapters = 0 (`KNOWN_PAYMENT_PROVIDER_CODES`
    EMPTY); webhook routes = 0;
  - external HTTP `Idempotency-Key` runtime = 0 (only doc comments about the
    2.12H boundary);
  - provider-operation identity server-derived (`deriveProviderOperationKey`);
  - AUTHORIZED unreachable; SPLIT_AT_PAYMENT = 0;
  - 2.12H documented as hard prerequisite of 2.12B (Roadmap 2.12B entry).

## 3. Discovered existing mechanisms (reused vs unrelated)

- **Reused infrastructure:** global ValidationPipe
  (`GLOBAL_VALIDATION_PIPE_OPTIONS`, production == e2e), error taxonomy
  (`DomainError`/`ConflictError` 409/`NotFoundError` 404/`ValidationDomainError`
  422), `AppExceptionFilter`, `request.user` principal from
  `JwtAuthGuard`→`PermissionsGuard` order (guards BEFORE interceptors),
  Prisma multiSchema + additive migration + e2e `migrate deploy` harness.
- **Unrelated internal idempotency (NOT reused, kept separate):**
  `InboxEvent` (consumer dedup by eventId), outbox publication,
  business-level idempotency (`PaymentService` isActivePayment partial unique),
  2.12A provider-operation identity, `Commission_orderId_key` etc.
- **Patterns:** P2002 → controlled ConflictError; `publishPending` manual
  invocation in e2e; unique-key DB backstop convention.

## 4. Protected endpoint set

Explicit registry `IDEMPOTENT_OPERATIONS` (fail-closed). V1 minimal
PSP-readiness set (documented decision, prompt §5):

- `payment.create` → `POST /api/v1/finance/payments`
  (payment-initiation boundary, hard prerequisite of 2.12B).

Deliberately NOT protected: payment transitions (`confirm/fail/cancel`,
CAS-idempotent with canonical 409-on-repeat), reads, other domains.

## 5. Header contract

`Idempotency-Key`: required; opaque; ≤128 chars; charset `[A-Za-z0-9._~-]`;
empty/whitespace → 400; multiple values → deterministic 400; oversized → 400;
no PII/secrets/provider semantics; no client-controlled fingerprint. Missing
key on a protected op → 400 (T1). Malformed → 400 (T2).

## 6. Principal/tenant scope

`scopeType="USER"`, `scopeId=request.user.id` (server context, never
body/query). Response lookup only after guards. Same literal key for different
principals → different slot (T10). Anonymous/RBAC-failing replay → 401/403
before the layer (T11/T12). No DB RLS claimed (ADR-0014).

## 7. Operation identity

Stable server-derived string from `@Idempotent("...")` metadata (registry
fail-closed). Not host/request-id/timestamp/process/raw URL. Same key on
another operation → independent slot (unit #12).

## 8. Fingerprint

`sha256(canonical({params, body}))`; body = VALIDATED DTO (same
`GLOBAL_VALIDATION_PIPE_OPTIONS`, whitelist+transform). Property-order
independent; arrays order-preserved; includes path params; query excluded
(documented); omitted≠null (fail-loud); decimal strings/currency case NOT
normalized (`"150.00"`≠`"150"`, `"usd"`≠`"USD"` — per 2.12A canonical
representation); no JS-float money; Idempotency-Key/auth/tracing excluded by
construction (never an input). Unit #1–#9.

## 9. Persistence / raw-key decision

`events.ExternalIdempotencyRecord`, digest storage:
`slotKey = sha256(JSON([scopeType, scopeId, operation, clientKey]))`.
Justification: opaque key never needed post-claim; digest prevents raw-key
leak in DB/logs; deterministic replay lookup. `scopeType/scopeId/operation`
kept as columns for observability. No auth/cookies/secrets/PII/raw bodies;
`responseBody` = safe whitelisted business result (payment DTO PII-free per
2.12 T12).

## 10. DB uniqueness

`slotKey` UNIQUE — DB backstop (P2002 → re-read → classify). Two instances
cannot both claim a slot. Expected races → controlled 409/replay, never raw
500 (T7/T8/T19).

## 11. State machine

`IN_PROGRESS → COMPLETED` (minimal). Business failure/rollback → claim
deleted (key reusable, no poisoning, T13). COMPLETED stores
`responseStatus`+`responseBody`.

## 12. Transaction / crash-window design

Five windows analyzed and documented in the arch doc: (1) before claim —
nothing; (2) claim before business write — stale takeover; (3) business
commit before stored result — stale takeover + re-execution SAFE because
`payment.create` is business-idempotent (existing active Payment returned,
no duplicate fact); (4) result stored before HTTP response — replay; (5)
process death — covered by (2)+(3). No duplicate committed side effect for
the protected set; re-execution attempt after stale crash is possible but
never duplicates the FACT. Not exactly-once delivery (documented).

## 13. Identical / divergent / in-progress / replay semantics

- new slot → execute once;
- COMPLETED + same fingerprint → DB-backed replay (T4/T9);
- same slot + divergent fingerprint → controlled 409, 0 wrong facts (T5/T6);
- in-progress duplicate (fresh) → bounded wait (2s) → replay or 409 (T7/T8);
- stale IN_PROGRESS → CAS takeover (unit #5/#6);
- cross-principal isolated (T10);
- different operation → independent slot (unit #12).

## 14. Failure / retention policy

Pre-business auth/RBAC/validation failure → no claim (validation before
claim; guards before interceptor). Business rejection/rollback → claim
deleted (no false COMPLETED, T13). Unexpected 5xx → claim deleted
(best-effort), next attempt re-executes. Retention: V1 explicit
no-auto-expiry / deferred cleanup (no fabricated number; cleanup = Step 2.17
territory).

## 15. Auth / RBAC

Guards run before the interceptor: anonymous → 401 (T11), RBAC failure →
403 (T12) — replay cannot bypass auth/RBAC. Principal established before any
slot lookup.

## 16. Payment / provider / inbox-outbox boundaries

Idempotency layer does NOT own/mutate Payment status/milestones/money
(T17: replay keeps PENDING, milestones null; transitions unaffected — T16).
PaymentService remains lifecycle authority. Provider-operation identity
untouched. Inbox/outbox untouched. Future mapping preserved:
`external request → canonical business fact → server-derived provider
operation`.

## 17. Multi-instance proof

DB unique slotKey + P2002 handling + CAS takeover; e2e T7/T8/T19 use genuine
DB concurrency (`Promise.all` with independent HTTP requests/transactions);
T9 proves DB-backed replay across a second Nest application instance sharing
the same PostgreSQL.

## 18. Logging / PII

Only digests stored; raw keys never logged; no PII in records; error
messages carry no key values.

## 19. Schema / migration

`20260815044715_add_external_idempotency_contract` (additive): enum
`events.ExternalIdempotencyStatus` + table `events.ExternalIdempotencyRecord`
(slotKey unique, 2 indexes), 0 backfill, 0 destructive ALTER. Applied to dev
DB via `prisma migrate dev`; e2e test DB via `prisma migrate deploy`
(canonical harness); fresh replay passes.

## 20. Write-path audit

Only writer: `IdempotencyService` (claim/complete/rollback/deleteMany).
Controller/Service unchanged for Payment (only decorator added). No new
writes to Payment/Order/Booking/Finance entities.

## 21. PSP/webhook/SPLIT/cross-domain negative audits

0 real PSP network; 0 production PSP adapters added; 0 webhook/callback
routes (e2e T18 route-graph + source audit of the module); 0 signature
verification; 0 provider webhook dedup; 0 SPLIT_AT_PAYMENT; 0 cross-domain
writes; 0 domain events added.

## 22. RLS / schemaVersion / DR / load / 2.17 boundaries

RLS 0 (ADR-0014 deferred); global schemaVersion retrofit 0; Backup/DR 0;
load framework 0; Step 2.17 implementation 0 (no EventBus/CI/outbox changes);
Step 2.12B 0.

## 23. Unit / e2e results

- unit: `642/642` (+23: fingerprint/slot-key 14 + service 9);
- e2e spec `external-idempotency-contract.e2e-spec.ts`: `19/19` (T1–T19),
  default config, clean exit, no open handles;
- targeted regression (payment-flow, payment-provider-abstraction,
  chargeback-dispute, refund-flow, finance-domain, auth-rbac): `80/80`;
- full serial e2e: `1172/1172` (67 suites, +19 T1–T19).

## 24. Backend / frontend / DB regression

- backend: `tsc --noEmit` clean; `npm run build` (tsc -p tsconfig.build.json) OK;
- frontend (unchanged files): `tsc --noEmit` clean; Vitest 135/135 (23 files);
  `next build` OK;
- DB: migrate status 57/57 up-to-date; drift 0 (live→schema diff empty); fresh
  replay via canonical e2e harness (globalSetup migrate deploy).

## 25. Artifact integrity

`scripts/check-roadmap-artifacts.mjs` on the updated Roadmap: **PASS = 100,
WARN = 0, FAIL = 0** (60 approved steps, 479 references). Checker regression
13/13.

## 26. Docs / files changed

- `backend/prisma/schema.prisma` (+enum +model);
- `backend/prisma/migrations/20260815044715_add_external_idempotency_contract/`;
- `backend/src/shared/idempotency/` (constants, decorator, fingerprint,
  slot-key, service, interceptor, module, 2 spec files);
- `backend/src/app.module.ts` (IdempotencyModule + APP_INTERCEPTOR);
- `backend/src/modules/finance/finance.controller.ts` (@Idempotent decorator);
- `backend/test/external-idempotency-contract.e2e-spec.ts` (new);
- `backend/test/payment-flow.e2e-spec.ts`, `chargeback-dispute-foundation.e2e-spec.ts`,
  `refund-flow.e2e-spec.ts` (Idempotency-Key header on payment.create calls);
- `docs/architecture/external-api-idempotency-contract.md` (new);
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (2.12H status);
- this report.

## 27. Findings / fixes / observations

- FIX 1 (test): bad-keys e2e list — Cyrillic/`\n` values are rejected by
  Node/superagent client-side (never reach the server); replaced with ASCII
  printable chars that pass transport but fail the contract regex.
- FIX 2 (test): supertest TypeError on invalid headers corrupted the run
  (afterAll timeout + open handle); resolved by FIX 1.
- OBS 1: status derivation at interceptor post-phase — Nest applies @Post
  default 201 after interceptors, so `deriveStatus` uses method-default
  (POST→201) with explicit `res.status()` on replay (verified T14/T15/T19).
- OBS 2: omitted-vs-null (`paymentMethod` absent vs null) — fail-loud
  distinct fingerprints (documented; consistent with 2.12A canonical
  representation); a retry must resend the identical body.
- OBS 3: `PaymentService.createPayment` has its own internal `$transaction`;
  claim+execute+complete cannot share one transaction without refactoring
  approved code — crash window (3) handled by stale takeover + business
  idempotency (documented in arch doc §12).

## 28. Roadmap

2.12H → `🚧 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`; NEXT →
`PHASE 2 — STEP 2.12H — STRICT REVIEW`. Dependency chain preserved:
`2.12A APPROVED → 2.12H impl → 2.12H SR → 2.12B`.

## 29. Persistence + Repository Evidence

Two-commit convention: implementation commit, then provenance/footer commit.

REPOSITORY EVIDENCE
repository: travelhub_v1 (local canonical identity)
branch: master
head: cd8ed56
origin: cd8ed56
worktree_clean: false (unrelated untracked prompts)
migration_count: 57
reviewed_state: COMMIT
reviewed_diff_base: 68c28bc
reviewed_diff_head: cd8ed56
persistence_status: PERSISTED
persistence_sha: cd8ed56

## 30. Release

RELEASE: NOT PERFORMED — STRICT REVIEW REQUIRED

## 31. Exact NEXT

`PHASE 2 — STEP 2.12H — STRICT REVIEW`
