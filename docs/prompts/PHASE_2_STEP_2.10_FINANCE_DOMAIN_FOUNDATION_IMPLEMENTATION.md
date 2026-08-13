# PHASE 2 — STEP 2.10 — FINANCE DOMAIN FOUNDATION — IMPLEMENTATION PROMPT

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.10 — Finance Domain Foundation  
**Mode:** IMPLEMENTATION  
**Predecessor:** `PHASE 2 STEP 2.9A STRICT REVIEW COMPLETED — APPROVED (NO REVIEW FIXES REQUIRED)`  
**Expected current DB baseline:** migrations `46/46` up-to-date before this step  
**Hard stop:** implement **only** the exact Step 2.10 scope from the current canonical Roadmap. Do not start the next Roadmap item in this pass.

---

# 1. MISSION

Implement **PHASE 2 — STEP 2.10 — FINANCE DOMAIN FOUNDATION** as the canonical foundation for TravelHub financial facts and future payment/refund/settlement workflows.

This step must establish the Finance domain without inventing downstream orchestration that belongs to later Roadmap steps.

The implementation must preserve all already-approved contracts:

- Catalog / Pricing / Commercial Period / Restriction freeze;
- Quote → CheckoutIntent → Sale;
- Sale → OrderRequested → Order;
- Order lifecycle and temporal contract;
- BookingRequested → Booking;
- Booking service occurrence model;
- Booking lifecycle and temporal contract;
- AcquisitionSource immutability;
- Availability ownership;
- event/outbox/inbox conventions;
- correlation/causation conventions;
- PII minimization;
- RBAC / IDOR / mass-assignment conventions;
- legacy compatibility.

Do not assume the exact Finance model from generic marketplace patterns. First derive the required Step 2.10 scope from the repository and current canonical Roadmap.

---

# 2. SOURCE-OF-TRUTH ORDER — HARD GATE

Before changing code, inspect at minimum:

1. current `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
2. current Architecture Master / canonical architecture documents;
3. Screen Design Brief / Finance-related backend codes and UI expectations;
4. `docs/contracts/api.md`;
5. `docs/contracts/events.md`;
6. existing ADRs;
7. current Prisma schema;
8. all existing Payment / Payout / Stripe / Finance-related models and code;
9. current security permissions and role matrix;
10. current IDs/business-sequence conventions;
11. EventBus / Outbox / Inbox implementation;
12. request-context / actor / correlation conventions;
13. Step 2.5 / 2.5A / 2.5B approved contracts;
14. Step 2.7 approved Order lifecycle;
15. Step 2.8 approved Booking creation;
16. Step 2.8A approved Booking service time model;
17. Step 2.9 approved Booking lifecycle;
18. Step 2.9A approved Booking temporal contract;
19. existing tests touching payments, payouts, booking payment status, Order money, Sale money, acquisition and buyer cabinet.

**Current canonical Roadmap wins on conflict.**

Do not use old docs/prompts as authority when they conflict with the current Roadmap or approved later contracts.

---

# 3. REPOSITORY BASELINE

Before implementation report:

- branch;
- HEAD;
- origin relation;
- dirty/untracked files;
- inherited uncommitted Steps 2.6–2.9A;
- current migration count/status;
- current Step 2.10 Roadmap wording;
- current NEXT item after Step 2.10;
- existing Finance/Payment code that predates this step;
- exact schema objects already present.

Do not reset, squash, delete or rewrite approved prior-step work merely because it is uncommitted.

---

# 4. CURRENT → TARGET RECONCILIATION — MANDATORY

Do not immediately create new models.

First classify existing finance-related implementation into:

1. canonical and reusable;
2. approved scaffolding requiring hardening;
3. legacy but compatibility-required;
4. obsolete/unsafe path to remove;
5. downstream functionality outside Step 2.10.

Build an explicit **Current → Target** matrix.

Pay special attention to pre-existing:

- `Payment`;
- `Payout`;
- `StripeEvent`;
- booking payment fields/statuses;
- Sale/Order monetary fields;
- payment endpoints;
- Stripe Connect code;
- payout code;
- webhook code;
- buyer payment history;
- dashboard revenue calculations.

Do not silently preserve an old model just because it exists.

---

# 5. FINANCE DOMAIN BOUNDARY — HARD GATE

Define exactly what **Finance owns** after Step 2.10.

At minimum determine ownership for:

- financial transaction/ledger facts;
- payment attempts/intents if required now;
- payment state;
- refund facts;
- settlement facts;
- payout facts;
- external-provider references;
- monetary posting timestamps;
- financial history/audit.

Also explicitly document what Finance **does not own**, including:

- Catalog price calculation;
- Quote pricing;
- CheckoutIntent frozen price;
- Sale commercial truth;
- Order lifecycle;
- Booking lifecycle;
- Availability capacity;
- service occurrence;
- acquisition attribution.

Finance may consume frozen monetary facts but must not reprice them.

---

# 6. FINANCIAL SOURCE OF TRUTH

Determine from canonical sources whether Step 2.10 requires:

- immutable ledger entries;
- transaction records;
- Payment aggregate foundation;
- both;
- another explicitly documented model.

Do not invent an accounting architecture if Roadmap does not require it.

If the Roadmap says “ledger”, establish the ledger as the canonical financial fact store rather than using mutable Payment status as accounting truth.

If the Roadmap does **not** define sufficient semantics to choose between materially incompatible models, stop with:

`ARCHITECTURE DECISION REQUIRED`.

---

# 7. MONEY MODEL — HARD GATE

Reconcile the money representation used across:

`Quote → CheckoutIntent → Sale → Order → Booking → Finance`

Verify:

- amount precision;
- currency representation;
- Decimal handling;
- no floating-point financial arithmetic;
- no implicit currency conversion;
- no reprice;
- no reconstruction from mutable Catalog data.

Finance must consume frozen commercial facts.

---

# 8. FINANCIAL IDENTIFIERS

Follow the repository's BusinessSequence / ID conventions.

Determine canonical business-code prefixes from Roadmap/architecture before introducing any:

- payment code;
- ledger transaction code;
- refund code;
- settlement code;
- payout code.

Do not invent `PAY-*`, `PMT-*`, `LTX-*`, etc. unless supported by canonical sources.

IDs must remain server-owned and concurrency-safe.

---

# 9. SCHEMA DESIGN — ADDITIVE FIRST

Any schema change must be additive unless the current Roadmap explicitly requires migration/removal.

Before migration, document:

- new models;
- new enums;
- new nullable fields;
- unique constraints;
- foreign keys;
- indexes;
- legacy compatibility;
- ownership rationale.

Do not repurpose existing columns with changed semantics without an explicit migration strategy.

---

# 10. LEGACY PAYMENT MODEL RECONCILIATION — CRITICAL

If a pre-existing `Payment` model exists, determine:

- whether it is canonical Finance aggregate;
- whether it is only Phase 1 scaffolding;
- whether its status vocabulary matches current Roadmap;
- whether it stores mutable state that cannot serve as ledger truth;
- whether old rows must remain readable;
- whether old API endpoints must remain temporarily compatible.

Do not delete historical financial rows.

Do not fabricate new financial history for legacy rows.

---

# 11. PAYMENT STATUS VOCABULARY

Derive status codes only from canonical sources.

For each status document:

- meaning;
- terminal/non-terminal;
- producer;
- allowed predecessor/successor;
- whether it is provider state or TravelHub business state;
- whether it is persisted now or deferred.

Do not copy Stripe status names into the domain unless explicitly approved.

---

# 12. LEDGER / FINANCIAL TRANSACTION INVARIANTS

If Step 2.10 includes a ledger/transaction model, establish hard invariants:

- append-only financial facts;
- no destructive update/delete of posted entries;
- server-owned amount/currency/type;
- deterministic aggregate/reference links;
- idempotency key / event lineage where applicable;
- no duplicate posting on replay;
- no balancing fiction if double-entry accounting is not required.

If double-entry accounting is required by canonical sources, implement it fully enough to preserve balance invariants. If not required, do not invent it.

---

# 13. PAYMENT ≠ LEDGER

If both Payment and ledger/transaction objects exist:

- Payment may represent operational workflow;
- ledger entries represent durable financial facts.

Do not make mutable Payment status the sole historical accounting record if Roadmap requires ledger semantics.

Document the authority of each object.

---

# 14. ORDER / BOOKING PAYMENT FIELDS RECONCILIATION

Audit existing fields such as:

- paymentStatus;
- paidAmount;
- payment-related flags;
- dashboard/payment projections.

Classify each as:

1. canonical projection;
2. legacy compatibility field;
3. derived cache;
4. obsolete field;
5. downstream item.

Do not casually update Order/Booking payment fields from Finance if ownership is not defined.

Cross-domain writes require explicit canonical authority.

---

# 15. PAYMENT CREATION AUTHORITY

Determine what is allowed to create a Payment/financial transaction:

- explicit API command;
- canonical event consumer;
- provider webhook;
- later step only.

There must not be multiple conflicting creation authorities.

If Step 2.10 is only a domain foundation, do **not** implement payment initiation merely to make the model usable.

---

# 16. PAYMENT PROVIDER BOUNDARY

Audit Stripe/provider-specific code.

Separate:

- TravelHub Finance domain facts;
- provider adapter/integration facts.

Provider IDs/statuses must not become domain authority unless canonical docs explicitly say so.

Do not start provider orchestration that belongs to later steps.

---

# 17. STRIPE WEBHOOK / EXTERNAL EVENT SAFETY

If existing webhook code remains:

- verify signature-validation boundary;
- idempotency;
- external event uniqueness;
- no direct cross-domain unsafe writes;
- no fabricated successful payment state.

If webhook hardening is outside Step 2.10, document the gap and preserve safe compatibility without expanding scope.

---

# 18. REFUND FOUNDATION

Determine whether Step 2.10 requires refund **model foundation** or actual refund workflow.

If foundation only:

- define model/vocabulary only if canonical;
- no provider refund call;
- no automatic cancellation refund;
- no Availability coupling.

If refund workflow belongs later, explicitly defer it.

---

# 19. SETTLEMENT FOUNDATION

Determine whether settlement is part of Step 2.10.

If yes, define canonical ownership and data model without implementing unsupported settlement orchestration.

Distinguish:

- customer payment;
- supplier payable;
- platform fee/commission;
- settlement;
- payout.

Do not conflate them.

---

# 20. PAYOUT FOUNDATION

Audit existing Payout/Stripe Connect implementation.

Do not treat payout as synonymous with payment or settlement.

If current Step 2.10 only establishes Finance foundation, preserve but isolate downstream payout mechanics unless Roadmap explicitly requires them now.

---

# 21. COMMISSION / PLATFORM FEE

Do not invent commission percentages.

If commission facts already exist in frozen commercial data, Finance may reference them according to canonical contract.

If not, do not derive a fee from amount.

---

# 22. CURRENCY — HARD GATE

No implicit FX.

For every Finance object verify currency is explicit and immutable where required.

Cross-currency settlement is out of scope unless current Roadmap explicitly includes it.

---

# 23. DECIMAL PRECISION

Use Prisma Decimal / project canonical decimal helpers.

Test:

- fractional values;
- rounding boundaries;
- serialization;
- equality;
- no JS binary floating-point drift.

Do not use `number` for authoritative arithmetic if existing project convention uses Decimal/string.

---

# 24. IDEMPOTENCY — HARD GATE

Any financial fact creation must be replay-safe.

Use canonical mechanisms:

- InboxEvent;
- unique business invariant;
- provider event ID;
- idempotency key;
- aggregate uniqueness;

as appropriate.

Do not swallow arbitrary P2002 errors.

Known invariant constraint names only.

---

# 25. CONCURRENCY — HARD GATE

Test applicable races such as:

- duplicate financial event;
- duplicate create command;
- webhook replay;
- payment success vs cancellation/refund request if those paths exist now;
- simultaneous posting attempts.

Expected: one durable business fact, deterministic loser/no-op/controlled conflict, no raw 500.

---

# 26. TRANSACTION / OUTBOX ATOMICITY

Any Finance state + financial fact + history + domain event created by one business transition must commit atomically.

No event before commit.

No financial state without its canonical fact.

---

# 27. DOMAIN EVENTS

Derive event names from current contracts/Roadmap.

Do not invent a broad event vocabulary.

For every event specify:

- aggregate;
- version;
- exact payload;
- PII policy;
- actor;
- correlation;
- causation;
- producer;
- consumer if any.

Financial event payloads should use IDs/codes/amount/currency only when needed.

---

# 28. CORRELATION / CAUSATION — CRITICAL

Preserve ADR/request-context conventions:

- HTTP command: server-authoritative correlation UUID, causation null;
- event consumer: correlation inherited, causation = parent event ID;
- provider event: define correlation/causation only according to existing adapter convention.

Do not use payment code/order code as correlation ID.

---

# 29. PII / PCI BOUNDARY — HARD GATE

Do not persist:

- card PAN;
- CVV/CVC;
- raw card data;
- secrets;
- provider secret payloads beyond approved storage.

Financial events/history must not dump traveler/customer PII.

If provider payment method identifiers are stored, treat them as opaque references.

---

# 30. MASS ASSIGNMENT — HARD GATE

All Finance server-owned fields must be protected using the project's loud-forbidden-key convention where HTTP writes exist.

Candidates include:

- id/code;
- status;
- amount/currency;
- paid/refunded/settled totals;
- provider refs;
- ledger type;
- timestamps;
- acquisition/provenance;
- actor/correlation/version.

Forged server-owned fields must fail loudly (project convention: 422), not silently strip.

---

# 31. RBAC

Derive Finance permissions from current permission catalog/Screen Design.

Do not invent broad `finance.*` permissions unless canonical.

Build a matrix for:

- ADMIN;
- finance/accounting role if present;
- OPERATOR;
- SALES_MANAGER;
- BUYER;
- PARTNER;
- MODERATOR.

Distinguish operational payment action from read-only financial reporting.

---

# 32. IDOR / TENANT / OWNERSHIP

Financial objects are sensitive.

Verify:

- neutral 404 where project convention requires;
- buyer sees only own allowed financial objects;
- partner does not see buyer financial details unless explicitly authorized;
- staff scopes follow canonical RBAC.

---

# 33. AUDIT / HISTORY

Determine whether Finance requires a dedicated history table now.

If ledger already provides immutable business history, do not duplicate it without need.

Security AuditLog remains distinct from domain financial history.

---

# 34. TEMPORAL CONTRACT

Determine server-owned financial timestamps required by Step 2.10.

Do not introduce `paidAt`, `refundedAt`, `settledAt`, etc. merely because they are common.

Only add timestamps supported by current Roadmap/architecture.

Legacy NULL must remain honest where facts are unknown.

---

# 35. ORDER / BOOKING TEMPORAL ISOLATION

Step 2.10 must not modify approved:

Order:
- submittedAt;
- confirmedAt;
- fulfilledAt;
- closedAt;
- cancelledAt.

Booking:
- requestedAt;
- confirmedAt;
- rejectedAt;
- cancelledAt;
- completedAt.

Finance facts must not rewrite operational lifecycle history.

---

# 36. ACQUISITION SOURCE IMMUTABILITY

DIRECT / BUYER_REQUEST / legacy null must remain frozen.

If Finance stores acquisition for reporting, it must be copied verbatim from canonical source, never recalculated.

---

# 37. AVAILABILITY ISOLATION

No Finance action may create/release capacity unless current Roadmap explicitly assigns that ownership.

Payment success must not silently create a second hold.

Refund/cancel must not silently release capacity in Step 2.10 unless explicitly canonical.

---

# 38. BOOKING / ORDER LIFECYCLE ISOLATION

Do not make payment automatically:

- confirm Order;
- send Order to Booking;
- confirm Booking;
- complete Booking;
- close Order;

unless current canonical Roadmap explicitly defines such orchestration in Step 2.10.

Foundation is not workflow orchestration.

---

# 39. API CONTRACT

If Step 2.10 adds/changes endpoints:

document:

- route;
- method;
- permission;
- request DTO;
- forbidden keys;
- response projection;
- 400/401/403/404/409/422 semantics;
- idempotency semantics.

No hidden bootstrap/admin-create endpoint.

---

# 40. FRONTEND BOUNDARY

Do not redesign Finance UI unless current Step 2.10 explicitly requires it.

If backend response/shared types change, update only what is necessary to keep frontend compiling.

Record whether frontend is functionally unchanged.

---

# 41. MIGRATION POLICY — HARD GATE

If schema changes:

1. create a real Prisma migration;
2. inspect SQL;
3. run migrate status;
4. fresh replay from zero;
5. run supported drift/diff check;
6. no `db push`.

Migration must preserve legacy data.

---

# 42. NEGATIVE TEST REQUIREMENTS

At minimum cover all applicable cases:

1. anonymous write → 401;
2. unauthorized role → 403;
3. unknown/foreign finance object → neutral 404 where applicable;
4. forged status → 422;
5. forged amount → 422;
6. forged currency → 422;
7. forged provider reference → 422;
8. forged server timestamp → 422;
9. malformed amount/currency → controlled 400/422;
10. duplicate create/replay does not duplicate financial fact;
11. unknown P2002 is not swallowed;
12. cross-currency mutation rejected/not supported;
13. no Catalog repricing;
14. no Order lifecycle mutation;
15. no Booking lifecycle mutation;
16. no Availability mutation;
17. no acquisition mutation;
18. no PII/card-data persistence;
19. legacy financial rows remain readable;
20. invalid transition does not create ledger/event/history;
21. rollback leaves no partial financial state;
22. no raw 500.

Add further tests required by actual Step 2.10 semantics.

---

# 43. POSITIVE TEST REQUIREMENTS

At minimum cover all applicable cases:

1. canonical Finance object/fact creation;
2. business ID allocation if introduced;
3. Decimal amount preservation;
4. currency preservation;
5. frozen Sale/Order/Booking monetary reference preservation;
6. DIRECT acquisition preservation if stored;
7. BUYER_REQUEST preservation if stored;
8. legacy null acquisition compatibility;
9. exact one financial fact under duplicate delivery;
10. correlation/causation;
11. actor;
12. event payload exact whitelist;
13. no PII;
14. legacy row compatibility;
15. concurrent duplicate race;
16. fresh migration replay;
17. API read projection/RBAC if endpoint exists;
18. provider reference remains opaque if stored;
19. Finance write ownership;
20. no downstream workflow side effects.

---

# 44. EXISTING PAYMENT/PAYOUT REGRESSION

If legacy payment/payout APIs exist, explicitly test or document their status.

Do not claim compatibility without running relevant tests.

If an old path is unsafe and must be removed, prove no approved current flow depends on it before removal.

---

# 45. BUYER CABINET REGRESSION

Verify existing buyer order/booking/payment views still obey ownership and do not leak staff/internal Finance facts.

---

# 46. DASHBOARD / ANALYTICS REGRESSION

Audit any revenue/payment metrics depending on old Payment fields.

If Step 2.10 changes their source of truth, either migrate projection correctly or explicitly defer with compatibility preserved.

Do not silently change revenue semantics.

---

# 47. FULL BACKEND REGRESSION

After implementation run:

- `tsc --noEmit`;
- backend build;
- full unit suite;
- new Step 2.10 targeted tests;
- existing payment/payout/Stripe tests;
- Step 2.9A temporal;
- Step 2.9 Booking lifecycle;
- Step 2.8A service-time;
- Step 2.8 Booking creation;
- Step 2.7 Order lifecycle;
- Step 2.6 bootstrap removal;
- 2.5 / 2.5A / 2.5B;
- Order canonical events;
- Availability;
- Reverse 2.2A–F;
- 1.8A–D;
- acquisition propagation;
- RBAC;
- PII/event-envelope;
- Buyer Cabinet;
- dashboard/analytics if relevant;
- **full serial E2E**.

Report actual counts.

---

# 48. FRONTEND REGRESSION

Run even if frontend was not changed:

- frontend TypeScript;
- vitest;
- production build.

Report actual counts.

---

# 49. DB REGRESSION

Report:

- migration count;
- migrate status;
- fresh replay;
- drift/diff;
- whether migration was required;
- exact migration name if created.

---

# 50. DOCUMENTATION

Update only canonical current docs needed by the implementation:

- Roadmap;
- `docs/contracts/api.md`;
- `docs/contracts/events.md`;
- Finance architecture artifact for Step 2.10;
- relevant schema/domain documentation.

Create a dedicated architecture artifact, e.g.:

`docs/architecture/finance-domain-foundation.md`

It must document at minimum:

1. purpose;
2. ownership boundary;
3. current→target reconciliation;
4. aggregates/models;
5. money representation;
6. status vocabulary;
7. ledger/transaction authority if applicable;
8. Payment vs ledger distinction;
9. identifiers;
10. lifecycle/fact creation authority;
11. idempotency;
12. concurrency;
13. atomicity/outbox;
14. correlation/causation;
15. PII/PCI boundary;
16. RBAC;
17. legacy compatibility;
18. Order/Booking/Availability isolation;
19. migration;
20. deferred downstream Finance work.

---

# 51. ARCHITECTURE STOP CONDITIONS

Stop and report:

`PHASE 2 STEP 2.10 IMPLEMENTATION BLOCKED — ARCHITECTURE DECISION REQUIRED`

if any of these are unresolved:

1. Roadmap does not define whether ledger vs mutable Payment is financial authority and choosing changes architecture materially;
2. canonical money source is ambiguous;
3. existing Payment semantics conflict with current Roadmap;
4. payment creation authority has conflicting producers;
5. Finance requires cross-domain writes not canonically assigned;
6. commission/fee semantics are required but undefined;
7. settlement ownership is required but undefined;
8. refund authority is required but undefined;
9. provider state vs TravelHub state cannot be reconciled;
10. legacy financial data would require fabricated history;
11. correct implementation requires changing approved Order/Booking lifecycle;
12. correct implementation requires Availability release design;
13. correct implementation requires beginning the next Roadmap step;
14. currency/FX semantics are required but undefined;
15. financial timestamp semantics are materially ambiguous.

Do not resolve these by inventing business policy.

---

# 52. OUT OF SCOPE

Unless the current canonical Roadmap explicitly says otherwise for Step 2.10, do not implement:

- real card charging;
- Stripe PaymentIntent orchestration;
- refund execution;
- payout execution;
- settlement engine;
- reconciliation jobs;
- accounting export;
- tax/VAT engine;
- invoice generation;
- FX;
- chargebacks/disputes;
- Availability release;
- Order/Booking auto-transitions based on payment;
- Finance UI redesign;
- notification engine;
- documents/vouchers.

Foundation must remain foundation.

---

# 53. REQUIRED IMPLEMENTATION REPORT

At the end produce:

# PHASE 2 — STEP 2.10 — FINANCE DOMAIN FOUNDATION — REPORT

## 1. Verdict

Use exactly one:

- `PHASE 2 STEP 2.10 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
- `PHASE 2 STEP 2.10 IMPLEMENTATION BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline

## 3. Sources inspected

## 4. Current → Target reconciliation

## 5. Finance ownership boundary

## 6. Financial source of truth

## 7. Existing Payment/Payout/Stripe assessment

## 8. Money / Decimal / currency contract

## 9. Identifiers

## 10. Schema / models

## 11. Status vocabulary

## 12. Ledger / transaction invariants

## 13. Payment vs ledger authority

## 14. Order / Booking payment-field reconciliation

## 15. Creation authority

## 16. Provider boundary

## 17. Refund foundation

## 18. Settlement foundation

## 19. Payout foundation

## 20. Commission / fee treatment

## 21. Idempotency

## 22. Concurrency

## 23. Atomicity / Outbox

## 24. Events

## 25. Correlation / causation

## 26. PII / PCI

## 27. RBAC

## 28. IDOR / ownership

## 29. Mass assignment

## 30. Audit / history

## 31. Temporal contract

## 32. Acquisition immutability

## 33. Availability isolation

## 34. Order / Booking lifecycle isolation

## 35. Legacy compatibility

## 36. Migration

## 37. API / docs

## 38. Negative tests

## 39. Positive tests

## 40. Existing Finance regression

## 41. Buyer Cabinet regression

## 42. Dashboard / Analytics regression

## 43. Backend regression

## 44. Frontend regression

## 45. DB regression

## 46. Issues found

## 47. Fixes applied

## 48. Architecture decision status

## 49. Out-of-scope confirmation

## 50. Exact files changed

## 51. Roadmap update

## 52. Exact NEXT item

Final line must repeat the exact verdict.

---

# 54. ROADMAP UPDATE RULE

Only after implementation is complete and all required regressions pass:

Step 2.10 →

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Set NEXT to:

`PHASE 2 — STEP 2.10 — STRICT REVIEW`

Do **not** mark Step 2.10 approved during implementation.

Do **not** begin the next functional Roadmap step.

---

# 55. FINAL STOP

After producing the implementation report:

**STOP.**

The next pass must be a separate **Step 2.10 Strict Review**.
