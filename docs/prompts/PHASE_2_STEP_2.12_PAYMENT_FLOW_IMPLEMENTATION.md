# PHASE 2 — STEP 2.12 — PAYMENT FLOW — IMPLEMENTATION PROMPT

## 0. ROLE
Implement only `PHASE 2 — STEP 2.12 — PAYMENT FLOW` in the existing TravelHub repository.

This is an implementation pass, not Strict Review. Verify the actual repository, Prisma schema, migrations, tests, event contracts and Roadmap before changing code.

Successful final verdict:
`PHASE 2 STEP 2.12 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Blocked verdict:
`PHASE 2 STEP 2.12 BLOCKED — ARCHITECTURE DECISION REQUIRED`

Do not perform Strict Review 2.12 and do not start Step 2.13.

## 1. APPROVED BASELINE
Independently verify the current approved baseline:
- Step 2.10 Finance Domain Foundation;
- Step 2.10A Ledger Transaction Foundation;
- Step 2.10B Provider Fee / Settlement / Payout Foundation;
- Step 2.10C Finance Temporal Contract;
- Step 2.11 Pricing & Financial Snapshot.

Expected but untrusted regression baseline:
- backend unit 508/508;
- serial e2e 1067/1067, 60 suites;
- frontend 135/135;
- migrations 51/51, drift 0.

Preserve:
- frozen Quote→CheckoutIntent→Sale→Order→Booking money;
- `sales.money.ts` as money authority;
- Decimal-only arithmetic;
- Booking amount+currency frozen fact;
- no repricing after freeze;
- append-only LedgerTransaction;
- strict `occurredAt` semantics;
- ProviderFee ≠ Commission;
- Settlement ≠ Payout;
- Payment ≠ Payout;
- no cross-domain writes;
- precise P2002 handling;
- replay: identical = same effect, divergent = conflict.

## 2. OBJECTIVE
Activate the canonical Finance-owned Payment runtime without prematurely implementing Refund, Invoice, Commission accrual, Settlement/Payout processing, double-entry accounting, balances or unrelated frontend work.

Principle:
> Payment settles an already-frozen financial obligation; Payment is not a pricing authority.

## 3. REPOSITORY-FIRST AUDIT
Inspect at minimum:
- `backend/prisma/schema.prisma`;
- current schema-only Payment / PaymentTerms;
- Finance module;
- Order paymentStatus / paidAmount;
- Sale / CheckoutIntent / Booking payment-related fields;
- existing Stripe/PSP remnants and webhook routes;
- Finance and Sales money helpers;
- IdsService / ids.md;
- EventBus / Outbox / Inbox;
- request-context / actor / correlation;
- RBAC;
- PII/security helpers;
- api.md / events.md;
- Finance architecture docs;
- actual Roadmap Step 2.12 and later substeps.

Repo-wide search:
`Payment`, `PaymentStatus`, `paymentStatus`, `paidAmount`, `PaymentTerms`, `Stripe`, `payment_intent`, `authorize`, `capture`, `paidAt`, `authorizedAt`, `capturedAt`, `webhook`, `refund`, `providerTransaction`, `PSP`.

Create a Current→Target table before implementation.

## 4. PAYMENT OWNERSHIP — HARD GATE
Payment must be Finance-owned.

Allowed:
- Finance creates/updates Payment;
- other domains react through events.

Forbidden:
- Order/Booking/Sales directly writing finance.Payment;
- Finance directly mutating Order/Booking lifecycle;
- PSP adapter directly mutating Order/Booking.

If correctness requires direct cross-domain writes:
`ARCHITECTURE DECISION REQUIRED`.

## 5. PAYABLE OBLIGATION SOURCE — HARD GATE
Determine the canonical frozen source of payable money from actual code/docs.

Candidates may be CheckoutIntent, Sale or Order, but do not guess.

Prove:
- immutable amount;
- immutable currency;
- business identity;
- payment terms;
- exact point at which obligation becomes payable.

If source authority is ambiguous: STOP.

## 6. CARDINALITY — CRITICAL
Determine canonical cardinality:
- one Payment per Order/Sale?
- multiple Payments?
- partial/split payments?
- Payment per Booking?

Do not add a uniqueness constraint that blocks future approved partial/split semantics.

If required cardinality is unresolved: STOP.

## 7. PAYMENT MODEL RECONCILIATION
Reuse existing Payment schema if present. Do not create a competing table.

For every field classify:
- identity/code;
- source reference;
- amount/currency;
- status;
- provider/providerRef/providerEventId;
- idempotency;
- attempt semantics;
- temporal fields;
- version/CAS;
- createdAt/updatedAt.

Do not add PSP-style fields without canonical need.

## 8. STATUS VOCABULARY — HARD GATE
Derive Payment statuses from Prisma enum, Screen Design, Roadmap and current contracts.

For each status document:
- business meaning;
- terminal/non-terminal;
- allowed predecessors/successors;
- producer;
- event;
- milestone;
- replay semantics.

Conflicting sources => architecture decision.

## 9. SINGLE STATE MACHINE AUTHORITY
There must be exactly one canonical Payment transition authority.

Every status write must use:
- from-state guard;
- CAS/version when concurrency exists;
- transaction;
- history/outbox/milestone atomically where applicable.

Repo-wide enumerate every Payment.status writer.

## 10. PAYMENT CREATION
Define one canonical creation path.

Requirements:
- canonical code;
- frozen amount/currency copied verbatim;
- source refs;
- correct initial status;
- no Product/Tax/FX repricing;
- no direct Order/Booking write;
- no ProviderFee/Commission/Settlement/Payout fabrication.

## 11. IDENTIFIERS
Use existing canonical Payment prefix if already defined; otherwise do not invent without Roadmap support.

IdsService only:
- same transaction as create;
- DB unique;
- no MAX()+1;
- no random business code.

## 12. MONEY — HARD GATE
Payment amount/currency must come from the approved frozen commercial snapshot.

Forbidden:
- current Product/Tariff price lookup;
- current TaxRule recalculation;
- current FX conversion;
- alternate rounding helper;
- JS float authority.

Amount/currency become immutable Payment facts.

## 13. PARTIAL PAYMENT — ARCHITECTURE GATE
If partial payments are approved, define:
- remaining amount;
- multiple Payment vs mutable aggregate;
- overpayment protection;
- concurrency;
- paidAmount projection.

If not canonically defined, do not invent partial-payment behavior.

Existing `Order.paidAmount` does not itself prove partial-payment semantics.

## 14. PSP BOUNDARY
Read actual Roadmap to determine whether Step 2.12 includes:
- provider-neutral flow;
- simulated/manual confirmation;
- actual PSP;
- webhook.

Do not assume Stripe.

If PSP belongs later, keep Step 2.12 provider-neutral.

If PSP is in scope:
- exact provider contract only;
- signature verification;
- no secret/card persistence;
- provider event idempotency.

## 15. PROVIDER IDENTITY
If provider refs exist, determine:
- uniqueness scope;
- provider + providerTransaction identity;
- multiple attempts;
- divergent payload behavior.

Do not collapse legitimate retries/attempts.

## 16. IDEMPOTENCY — CRITICAL
Every create/transition/provider-event path must be DB-backed idempotent.

Required:
- identical retry = same effect;
- divergent retry = controlled conflict;
- known unique constraint handled precisely;
- unknown P2002 not swallowed;
- expected duplicate race never raw 500.

## 17. CONCURRENCY
Test:
- concurrent Payment create for same obligation;
- duplicate provider event;
- success vs failure;
- capture/confirm vs cancel if lifecycle permits.

Expected:
- deterministic winner;
- one business effect;
- no duplicate history/events;
- no raw 500.

## 18. TEMPORAL CONTRACT
Step 2.10C deferred Payment milestones until producer semantics existed.

Add only milestones justified by actual Step 2.12 lifecycle.

Possible, not automatic:
`authorizedAt`, `capturedAt`, `paidAt`, `failedAt`, `cancelledAt`.

For each implemented milestone define:
- exact transition;
- authority;
- UTC instant;
- first-only;
- replay behavior;
- atomicity.

No fabricated backfill.

## 19. PAID SEMANTICS — HARD GATE
Determine what `PAID` means:
- authorized?
- captured?
- provider settled?
- TravelHub received?

Only one canonical meaning.

If sources disagree: STOP.

## 20. ORDER PAYMENT PROJECTION — CRITICAL
Audit existing `Order.paymentStatus` and `Order.paidAmount`.

Determine whether they are canonical projection or legacy fields.

Payment service MUST NOT write Order directly.

If Order projection updates on Payment:
- Payment emits canonical event;
- Order-owned subscriber writes Order;
- mapping is explicit;
- idempotent/concurrency-safe.

## 21. BOOKING ISOLATION
Payment must not directly:
- confirm/cancel Booking;
- mutate Booking money;
- mutate Booking temporal facts;
- touch availability.

## 22. LEDGER BOUNDARY — HARD GATE
Do not automatically create LedgerTransaction unless Step 2.12 explicitly defines Payment→Ledger posting.

If in scope, define:
- exact transition;
- Ledger type;
- amount/currency;
- sourceType/sourceId/sourceEventId;
- occurredAt authority;
- idempotency;
- atomicity.

If posting is deferred, Ledger count must remain unchanged.

No debit/credit/accounting model.

## 23. PROVIDER FEE BOUNDARY
No automatic ProviderFee calculation unless a canonical provider fee fact is supplied.

ProviderFee ≠ TravelHub Commission.

## 24. COMMISSION BOUNDARY
No Commission calculation/accrual/netting unless explicitly in Step 2.12.

No CommissionAccrual.
No payout netting.
No settlement netting.

## 25. REFUND BOUNDARY
Do not implement Refund runtime in Payment core.

Payment failure/cancellation is not a Refund.

No refundedAt, provider refund call or refund ledger posting unless current Roadmap explicitly says otherwise.

## 26. PAYMENT TERMS
Reconcile frozen Sales/Order terms with Finance PaymentTerms schema.

There must be one source of truth.

Do not recalculate terms from mutable Finance master-data if frozen terms are already authoritative.

## 27. EVENTS
Create only events required by actual transitions/consumers.

For every event:
- exact producer;
- version;
- aggregate;
- minimal PII-free payload;
- amount/currency if needed;
- source refs;
- correlation/causation;
- consumers.

No speculative events.

## 28. OUTBOX / INBOX
All durable Payment business events use transactional outbox.

Consumers use Inbox dedup/domain invariants.

No side effect before commit.

## 29. CORRELATION / CAUSATION / ACTOR
Preserve ADR-0009/0010.

HTTP:
- server correlation UUID;
- causation null;
- authenticated USER actor.

Consumer/provider:
- canonical inherited/assigned lineage;
- parent event as causation when appropriate;
- SYSTEM/PROVIDER semantics where defined.

Never trust these fields from client input.

## 30. RBAC
Derive exact Payment permissions from current RBAC.

Audit:
FINANCE, ADMIN, DIRECTOR, OPERATOR, SALES_MANAGER, BUYER, PARTNER, MODERATOR, ANALYST, MARKETER.

Separate read/initiate/manage.

Do not give universal write merely because role can read Finance.

## 31. BUYER SURFACE
If Buyer initiates Payment:
- own scope;
- cannot choose amount/currency;
- cannot set status;
- cannot forge provider refs;
- cannot act on another buyer’s Order/Sale.

If Buyer initiation is deferred, do not expose it.

## 32. MASS ASSIGNMENT — HARD GATE
Loud-reject forged:
- id/code;
- status;
- amount/currency;
- paidAmount;
- provider status/ref;
- milestones;
- source refs;
- actor/correlation/causation;
- version;
- timestamps;
- ledger refs.

Use raw-body forbidden-key validation according to established convention.

## 33. IDOR
Unknown/foreign Payment must follow neutral 404 convention where applicable. Forbidden role remains 403.

## 34. PII / PCI / SECRETS — CRITICAL
Never persist/log:
- PAN;
- CVV;
- full card number;
- card credentials;
- PSP secrets;
- webhook signing secrets;
- Authorization headers;
- traveler/passport PII.

Opaque provider refs only.

If real card data is introduced: STOP.

## 35. WEBHOOK SECURITY
If webhook in scope:
- signature verification;
- raw-body correctness;
- provider event id;
- replay protection;
- event allowlist;
- controlled unknown event handling;
- no client status authority.

If webhook deferred, prove zero active webhook write path.

## 36. PAYMENT HISTORY / AUDIT
If lifecycle requires history, keep separate:
- PaymentHistory/domain history;
- Security AuditLog;
- Outbox events.

No full provider payload / PII dump.

## 37. LEGACY COMPATIBILITY
Existing Payment rows, if any, remain readable.

No fabricated:
- status;
- paidAt;
- provider ref;
- ledger facts.

Migration additive-first. Legacy unknown temporal/business facts stay NULL.

## 38. MIGRATION POLICY
Prisma migration only.

No `db push`.

SQL must be:
- additive;
- fresh-deploy safe;
- legacy-safe;
- correct unique/idempotency indexes;
- correct Decimal precision;
- no destructive financial rewrite.

## 39. REQUIRED NEGATIVE TESTS
Cover applicable:
1. anonymous protected endpoint → 401;
2. forbidden role → 403;
3. unknown/foreign Payment → 404;
4. forged amount → 422;
5. forged currency → 422;
6. forged status → 422;
7. forged milestones → 422;
8. forged provider refs/event id → 422 where server-owned;
9. malformed Decimal;
10. unsupported currency;
11. amount mismatch with frozen obligation;
12. Product price change after freeze does not affect Payment;
13. duplicate create;
14. concurrent duplicate create;
15. divergent replay → 409;
16. duplicate provider event;
17. unknown P2002 not swallowed;
18. invalid transition → 409;
19. terminal retry controlled;
20. success-vs-failure race deterministic;
21. no direct Order write;
22. no direct Booking write;
23. no repricing;
24. no Refund;
25. no CommissionAccrual;
26. no Settlement/Payout;
27. no ProviderFee fabrication;
28. no Ledger auto-post if deferred;
29. no PII/PCI leakage;
30. no raw 500.

## 40. REQUIRED POSITIVE TESTS
Cover applicable:
1. canonical Payment creation;
2. canonical code;
3. frozen amount/currency verbatim;
4. initial status;
5. allowed lifecycle transitions;
6. first-only milestones;
7. identical replay;
8. concurrent duplicate one fact;
9. correct events;
10. correlation/causation/actor;
11. own-scope Buyer path if supported;
12. FINANCE/ADMIN behavior per RBAC;
13. Order-owned projection if in scope;
14. legacy Payment readable;
15. Direct acquisition;
16. BUYER_REQUEST path where applicable;
17. fresh migration replay.

## 41. STATE-MACHINE MATRIX
Create explicit table:
`Action | From | To | Guard | Permission | Event | Milestone`

Test every allowed transition plus representative forbidden transitions.

No hidden transition outside matrix.

## 42. WRITE-PATH AUDIT — HARD GATE
Repo-wide enumerate:
- Payment create/update/updateMany/upsert/delete/raw SQL;
- Order.paymentStatus writers;
- Order.paidAmount writers;
- Payment milestone writers.

Classify canonical lifecycle / provider consumer / migration-test / unsafe.

Unsafe = 0.

## 43. REPRICE AUDIT
Find all Product/Tariff/Tax/FX reads inside Payment paths.

No current data may alter frozen payable amount.

## 44. SIDE-EFFECT AUDIT
Payment core must not directly alter:
- Order lifecycle;
- Booking lifecycle;
- Availability;
- acquisitionSource;
- service occurrence.

Finance fact counts to audit:
LedgerTransaction, ProviderFee, Settlement, Payout, Refund, Invoice, CommissionAccrual.

Only explicitly in-scope facts may change.

## 45. UNIT TESTS
Add focused tests for:
- validation;
- state guards;
- frozen money;
- provider identity;
- idempotency comparison;
- temporal first-only.

## 46. DEDICATED E2E
Create `payment-flow.e2e-spec.ts` or canonical equivalent.

Implementation report must map §§39–40 requirements to concrete tests.

## 47. TARGETED REGRESSION
Run targeted:
- Step 2.11 pricing snapshot;
- Sales;
- Order lifecycle;
- Booking lifecycle;
- Reverse;
- Finance 2.10;
- Ledger 2.10A;
- 2.10B foundations;
- 2.10C temporal;
- RBAC;
- event envelope;
- phase-entry;
- PII/security.

Report exact totals.

## 48. FULL BACKEND REGRESSION
Run:
- backend typecheck;
- build;
- all unit;
- full serial e2e.

No skipped/focused tests.

## 49. FRONTEND REGRESSION
Even if unchanged:
- frontend typecheck;
- Vitest;
- production build.

Do not build Payment UI unless explicitly required by current Roadmap Step 2.12.

## 50. DB REGRESSION
Run:
- migrate status;
- fresh replay;
- drift/diff.

No `db push`.

## 51. DOCUMENTATION
Create:
`docs/architecture/payment-flow.md`

Include:
1. purpose;
2. ownership;
3. payable obligation source;
4. cardinality;
5. model;
6. statuses;
7. transition matrix;
8. frozen money;
9. creation;
10. PSP boundary;
11. provider identity;
12. idempotency;
13. concurrency;
14. temporal contract;
15. Order projection;
16. Booking boundary;
17. Ledger boundary;
18. ProviderFee boundary;
19. Refund boundary;
20. Commission boundary;
21. RBAC;
22. mass assignment;
23. PII/PCI;
24. events/outbox/inbox;
25. history/audit;
26. legacy/migration;
27. deferred items.

Update api.md, events.md, ids.md if required, and Roadmap.

## 52. REQUIRED IMPLEMENTATION REPORT
Create:
`docs/prompts/PHASE_2_STEP_2.12_PAYMENT_FLOW_IMPLEMENTATION_REPORT.md`

Sections:
1. Verdict
2. Repository baseline
3. Sources inspected
4. Current→Target
5. Ownership
6. Frozen obligation source
7. Cardinality
8. Schema/model
9. Migration
10. IDs
11. Money
12. PaymentTerms
13. Status vocabulary
14. Transition matrix
15. Creation authority
16. PSP boundary
17. Provider identity
18. Idempotency
19. P2002
20. Concurrency
21. Temporal milestones
22. PAID semantics
23. Order payment projection
24. Booking boundary
25. Ledger boundary
26. ProviderFee boundary
27. Refund boundary
28. Commission boundary
29. Events
30. Outbox/Inbox
31. Correlation/causation/actor
32. RBAC
33. Buyer own-scope
34. Mass assignment
35. IDOR
36. PII/PCI
37. History/AuditLog
38. Legacy
39. Write-path audit
40. Reprice audit
41. Cross-domain side effects
42. Negative coverage
43. Positive coverage
44. Unit tests
45. Targeted E2E
46. Full backend regression
47. Frontend regression
48. DB regression
49. Issues found
50. Fixes applied
51. Architecture decision status
52. Deferred/out-of-scope
53. Exact files changed
54. Roadmap update
55. Exact NEXT item

## 53. ARCHITECTURE STOP CONDITIONS
STOP with:
`PHASE 2 STEP 2.12 BLOCKED — ARCHITECTURE DECISION REQUIRED`

if unresolved:
1. payable-obligation source unclear;
2. Payment cardinality unclear;
3. partial/split semantics required but undefined;
4. PAID meaning conflicts;
5. Order payment projection authority conflicts;
6. PSP contract required but undefined;
7. provider event identity cannot be defined;
8. direct Order/Booking write required;
9. repricing required;
10. Tax/FX recalculation required;
11. Commission required;
12. automatic Settlement/Payout required;
13. Refund runtime required;
14. double-entry/balance required;
15. temporal authority ambiguous;
16. legacy migration requires fabricated history;
17. event contract requires breaking change;
18. multiple active Payment writers exist.

Do not guess.

## 54. ROADMAP UPDATE
Only after full green regression:

Step 2.12 → `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

NEXT → `PHASE 2 — STEP 2.12 — STRICT REVIEW`

Do not mark approved. Do not start Step 2.13.

## 55. OUT OF SCOPE
Unless actual Roadmap explicitly includes them in 2.12, do not implement:
- Refund;
- Invoice;
- Commission accrual;
- Settlement/Payout lifecycle;
- ProviderFee calculation;
- double-entry;
- balances;
- chart of accounts;
- reconciliation engine;
- bank rails;
- unrelated platform/auth hardening;
- unrelated frontend redesign.

## 56. HARD STOP
After implementation + migrations + tests + docs + report + Roadmap update:

STOP.

Do not perform Strict Review 2.12.
Do not begin Step 2.13.

Final line:
`PHASE 2 STEP 2.12 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
