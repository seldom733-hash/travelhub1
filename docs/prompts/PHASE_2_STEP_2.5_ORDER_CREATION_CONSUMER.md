# PHASE 2 — STEP 2.5 — ORDER CREATION CONSUMER
## FINAL IMPLEMENTATION PROMPT

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.5 — Order Creation Consumer  
**Mode:** IMPLEMENTATION  
**Next steps:** Step 2.5A / 2.5B / 2.6 MUST NOT be started in this task  
**Canonical source of truth:** `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`

---

# 1. MISSION

Implement **PHASE 2 — STEP 2.5 — Order Creation Consumer** strictly against the current repository, canonical Roadmap, approved ADRs/contracts, and the already completed Step 2.4.

Step 2.4 already established the upstream boundary:

`Sale completion`
→ canonical `OrderRequested`
→ Outbox
→ **Step 2.5 consumer**
→ canonical `Order`
→ `OrderCreated`

The canonical Roadmap requires Step 2.5 to:

- consume `OrderRequested`;
- create canonical `ORD-*`;
- create the user-facing `TH-YYYY-######` order number/code according to the existing canonical ID contract;
- create `OrderItems`;
- create `OrderTraveler` records/snapshots as required by the existing Order model;
- publish canonical `OrderCreated`.

The key architectural rule is:

> **Sales publishes `OrderRequested`; Sales MUST NOT write Order tables directly. Order owns Order creation.**

Do not redesign Step 2.4.

Do not begin Order lifecycle completion (Step 2.7).

---

# 2. CURRENT CANONICAL BASELINE

Before changing anything, verify the repository rather than trusting this prompt blindly.

Expected current state:

- Phase 1 completed.
- Step 2.1 Sales Domain Foundation — completed.
- Step 2.2 Sales Center Backend — completed.
- Step 2.3 Quote & Commercial Offer Flow — completed.
- Step 2.3A Checkout / Commercial Intent Foundation — completed.
- Step 2.3B Payment Terms Foundation — completed.
- Step 2.4 Sale Completion → OrderRequested — completed and strict-reviewed.
- Step 2.5 — NOT started.
- Reverse Marketplace Steps 2.2A–2.2F are roadmap additions but NOT implemented and DO NOT block Step 2.5.
- Formal `reverse.*` ADR is a prerequisite for Reverse Marketplace implementation only; it is NOT a Step 2.5 prerequisite.

Step 2.4 is expected to provide:

- immutable Sale commercial snapshot;
- capacity reservation(s) owned through the Catalog boundary;
- canonical `OrderRequested`;
- correlation/causation-compatible event envelope;
- durable Outbox retry behavior;
- CAS/idempotent Sale completion.

Do not assume exact field names. Inspect the actual implementation.

---

# 3. FIRST ACTION — REPOSITORY INVENTORY

Before implementation, inspect and report:

1. exact branch + HEAD;
2. dirty/untracked files;
3. current Roadmap;
4. relevant ADRs;
5. event contract documentation;
6. ID contract;
7. Prisma Order models;
8. Order module/service/controller;
9. current `/orders/bootstrap` flow;
10. Step 2.4 `OrderRequested` producer and payload;
11. EventBus/Outbox/Inbox implementation;
12. existing `OrderCreated` event contract and consumers;
13. Booking foundations that currently depend on Order;
14. request/correlation context implementation;
15. current RBAC and AuditLog patterns;
16. all tests touching Order, Sale completion, EventBus, Booking and bootstrap.

Build an explicit:

`CURRENT → TARGET`

mapping before editing code.

Do not delete or rewrite existing functionality until its purpose is understood.

---

# 4. BOUNDED-CONTEXT OWNERSHIP

Preserve ADR-0001 ownership.

## Sales owns

- Lead;
- Opportunity;
- Quote;
- CheckoutIntent;
- Sale;
- Sale commercial snapshot;
- Sale completion;
- publication of `OrderRequested`.

## Order owns

- Order;
- OrderItem;
- OrderTraveler or equivalent Order-owned traveler snapshot;
- Order history;
- Order creation business identifiers;
- publication of `OrderCreated`;
- later Order lifecycle events.

## Catalog owns

- Product/catalog facts;
- availability;
- capacity reservation/hold mechanics.

## Booking owns

- Booking;
- Booking lifecycle.

Step 2.5 MUST NOT introduce cross-context direct writes from Sales into Order.

The `OrderRequested` consumer is the boundary crossing.

---

# 5. ORDERREQUESTED CONTRACT — TREAT AS AUTHORITATIVE INPUT

Inspect the real Step 2.4 `OrderRequested` contract.

Do not reconstruct Order from mutable current Quote/Product/Checkout state if the event already carries the frozen canonical commercial facts.

The consumer should derive Order from the immutable event/snapshot contract required for Order creation.

Review at minimum whether `OrderRequested` contains or references authoritative:

- Sale identity;
- Checkout identity;
- Quote identity;
- Customer/Buyer reference where applicable;
- frozen items;
- quantities;
- traveler snapshot/context;
- currency;
- subtotal;
- discount;
- total;
- payment terms;
- acquisition source;
- service date/context;
- availability reservation reference(s);
- event/correlation/causation metadata.

If the existing Step 2.4 payload is insufficient to deterministically create a canonical Order without reading mutable commercial state, STOP and report:

`ARCHITECTURE DECISION REQUIRED`

unless the missing field is clearly a local Step 2.4 contract defect that can safely be corrected without changing architecture.

Do not silently use mutable Product/Quote data as a substitute for missing frozen facts.

---

# 6. CANONICAL ORDER CREATION

Implement consumer-driven Order creation.

Conceptual flow:

`OrderRequested`
→ validate event contract
→ Inbox dedup
→ Order transaction
→ allocate canonical IDs
→ create Order
→ create OrderItems
→ create OrderTraveler snapshots if applicable
→ create Order history/audit facts as required
→ emit `OrderCreated` to Outbox
→ commit atomically.

Order must not exist before the transaction commits.

`OrderCreated` must not be visible without the corresponding committed Order.

---

# 7. ORDER IDENTIFIERS

Canonical Roadmap requires:

- internal/business stable Order code: `ORD-*`;
- user-facing Order number: `TH-YYYY-######`.

Inspect `docs/contracts/ids.md`, current Order schema and existing bootstrap implementation.

Do NOT invent a second ID generator.

Reuse the canonical atomic sequence mechanism already used by the project where appropriate.

Required properties:

- uniqueness under concurrency;
- deterministic formatting;
- no random collision retry loop;
- no client authority over IDs;
- no reuse after rollback unless existing sequence semantics explicitly allow gaps;
- year component of `TH-YYYY-######` must follow the existing canonical time convention (UTC unless contract says otherwise).

If current bootstrap and canonical contracts disagree, preserve the approved contract and report the compatibility impact.

---

# 8. ORDER SNAPSHOT AUTHORITY

The Order must preserve the immutable commercial facts required downstream.

Do not make downstream Booking/Finance/Documents dependent on mutable Sales/Catalog state for facts that were already frozen at Sale completion.

At minimum review whether Order requires immutable copies/references for:

- Sale;
- Quote;
- Checkout;
- Product/service item identity;
- product/service display snapshot where contract requires it;
- quantity;
- service date;
- travelers;
- currency;
- subtotal/discount/total;
- payment scheme/terms snapshot;
- acquisition source;
- reservation IDs.

Do not add fields merely because they may be useful someday.

Only add what is required by existing canonical contracts / downstream invariants.

---

# 9. MONEY SEMANTICS

Never use JS floating-point arithmetic for authoritative money.

Reuse existing money/Decimal conventions.

Required invariants where applicable:

- currency is preserved;
- subtotal/discount/total remain consistent with frozen Sale snapshot;
- no repricing;
- no exchange-rate conversion;
- Order consumer cannot modify Sale price;
- payment terms are copied as immutable commercial facts, not recalculated from current configuration;
- forged client money is irrelevant because this is event-driven creation.

If Order schema cannot preserve the required frozen money contract, determine whether a local additive migration is required for Step 2.5.

Do not defer a required Order commercial invariant merely to avoid a migration.

---

# 10. ACQUISITION SOURCE — STEP 2.5 BOUNDARY

Step 2.5B is a separate future step and MUST NOT be implemented wholesale here.

However, inspect the current Step 2.4 event/Sale snapshot and current Order schema.

Do not destroy already available acquisition context.

If Order already has an acquisition/source field required for deterministic creation, preserve it.

Do NOT introduce the future `BUYER_REQUEST` Reverse Marketplace implementation in Step 2.5.

Do NOT implement full Step 2.5B enum expansion/propagation unless the current Step 2.5 cannot correctly create an Order without preserving an already-existing source value.

Clearly report what remains for 2.5B.

---

# 11. ORDER TEMPORAL BOUNDARY

Step 2.5A is separate.

Do NOT implement the full temporal contract:

- submittedAt;
- confirmedAt;
- cancelledAt;
- fulfilledAt;
- closedAt;

unless a field is already part of current schema/contract and must be populated by the actual creation fact.

For Step 2.5, creation time must be truthful.

Do not fabricate future milestone timestamps.

Do not use `updatedAt` as a lifecycle milestone.

Do not prematurely complete Step 2.5A.

---

# 12. ORDER INITIAL STATUS

Inspect current Order lifecycle and existing canonical events.

The initial Order status created from `OrderRequested` must correspond to the existing Order state machine.

Do not redesign the lifecycle.

Do not skip ahead to:

- ready-for-booking;
- booking requested;
- fulfilled;
- closed.

Those belong to later steps.

If bootstrap currently creates an initial state that conflicts with canonical event-driven creation, reconcile locally and document the reason.

---

# 13. IDEMPOTENCY — MANDATORY

Duplicate delivery of the same `OrderRequested` MUST NOT create:

- two Orders;
- duplicate OrderItems;
- duplicate travelers;
- duplicate history facts;
- duplicate AuditLog facts;
- duplicate `OrderCreated` events.

Use the existing Inbox/EventBus dedup mechanism correctly.

Also require a domain-level uniqueness invariant where appropriate so correctness does not depend solely on one in-memory/process path.

Candidate canonical relation:

`one Sale completion → one canonical Order`

Verify the actual model/event contract and enforce the correct uniqueness boundary.

Do not invent a weak “find first then create” race-prone pattern.

---

# 14. CONCURRENCY

Test concurrent/duplicate processing.

At minimum:

- same `OrderRequested` delivered concurrently;
- duplicate redelivery after successful processing;
- two different `OrderRequested` events processed concurrently;
- ID allocation under concurrency.

Expected:

- exactly one Order for one canonical Sale/request;
- unique `ORD-*`;
- unique `TH-YYYY-######`;
- exactly one canonical `OrderCreated` per Order creation;
- no P2002/database exception leaked as public/runtime business behavior;
- transaction remains consistent.

---

# 15. INBOX / OUTBOX ATOMICITY

Order creation and resulting `OrderCreated` publication must follow the repository's transactional event pattern.

Review whether Inbox dedup is written:

- before side effects;
- in the same transaction;
- with correct rollback semantics.

A failed transaction must not permanently mark an event consumed while leaving no Order.

Likewise, successful Order creation must not lose `OrderCreated`.

Required invariant:

`Inbox acceptance + Order + Order children + history + OrderCreated outbox`

must have a coherent atomicity model.

If the current EventBus API cannot guarantee this for Step 2.5, do not paper over it. Report architecture/reliability issue.

---

# 16. CORRELATION / CAUSATION

Preserve the approved Step 1.15/1.18 trace model.

For consumer invocation:

- processing requestId is new/server-generated according to current EventBus convention;
- `correlationId` inherits the parent `OrderRequested` correlation;
- child `OrderCreated.causationId = OrderRequested.eventId`;
- child correlation remains the same causal chain;
- client headers are irrelevant inside consumer processing.

Do not use:

- Sale code;
- Order code;
- Quote code;
- Checkout code

as correlation IDs.

Legacy NULL semantics must remain compatible with the approved contract if legacy events are still supported.

---

# 17. ORDERCREATED EVENT CONTRACT

Inspect the existing canonical `OrderCreated` event.

Do not create a second competing event name/version.

The event should contain only the canonical data required by real consumers/contracts.

Do not dump raw database rows or PII into event payloads.

Verify:

- eventId;
- eventType;
- aggregate identity;
- occurredAt;
- correlationId;
- causationId;
- version if existing envelope requires it;
- actor/source metadata only according to existing event contract.

Do not perform a global event-envelope redesign in Step 2.5.

---

# 18. TRAVELER / PII MODEL

OrderTraveler is an intentional downstream snapshot, not permission to copy arbitrary CRM/customer data.

Inspect the current Order/Booking traveler contracts.

Copy only the traveler fields canonically required for downstream booking/service fulfillment.

Do NOT copy:

- raw CRM object;
- passwords/tokens;
- unrelated contact data;
- internal notes;
- arbitrary profile fields.

PII must not appear in:

- logs;
- AuditLog details unless explicitly required;
- Outbox metadata;
- error messages.

If traveler data is intentionally part of `OrderRequested`, preserve the minimum required snapshot.

---

# 19. AVAILABILITY RESERVATION BOUNDARY

Step 2.4 already performs capacity hold/reservation through the Catalog owner boundary.

Step 2.5 MUST NOT reserve availability a second time.

The Order should preserve/reference the existing reservation facts required downstream.

Required invariant:

`Sale completion = capacity hold`
`Order creation ≠ second capacity decrement`.

Duplicate OrderRequested processing must not duplicate availability reservations.

Do not move Catalog ownership into Order.

---

# 20. FAILURE ATOMICITY

Inject/test failures at meaningful points where practical:

- after Order ID allocation;
- after Order row creation but before children;
- after children but before `OrderCreated`;
- event emission failure;
- duplicate/constraint conflict.

After failure, verify no invalid partial state such as:

- Order without required items;
- children without Order;
- Inbox consumed without Order;
- Order created without required `OrderCreated` outbox fact;
- duplicate availability decrement;
- partially duplicated travelers.

Use transaction rollback rather than compensating ad-hoc cleanup when possible.

---

# 21. RETRY BEHAVIOR

Step 2.4 introduced/confirmed durable Outbox retry behavior.

Review how `OrderRequested` delivery reaches the consumer.

A retryable transport/consumer failure must not create duplicate domain state.

Do not redesign the global retry framework unless a confirmed defect blocks Step 2.5.

If a local reliability defect is found, fix only what is necessary and report it.

---

# 22. BOOTSTRAP ORDER FLOW

`/orders/bootstrap` is scheduled for removal in Step 2.6.

Therefore Step 2.5 MUST NOT remove it yet unless the canonical Roadmap or current tests explicitly require removal earlier.

But after Step 2.5:

- canonical commercial flow must create Orders through `OrderRequested`;
- bootstrap remains temporary/legacy;
- bootstrap must not become the implementation mechanism for the event consumer;
- event consumer should call domain-owned creation logic, not simulate an HTTP bootstrap request.

Document any temporary coexistence.

---

# 23. RBAC / AUTH BOUNDARY

OrderRequested consumption is an internal event-driven operation, not a user endpoint.

Do not create a public endpoint merely to trigger the consumer.

Existing Order read/manage endpoints retain their current RBAC.

If new internal service methods are introduced:

- they must not trust arbitrary actor IDs from payloads;
- they must preserve canonical actor/source semantics;
- no privilege escalation through event payload.

Do not expand user permissions unnecessarily.

---

# 24. AUDIT / HISTORY

Use existing Order history and AuditLog conventions.

Order creation should be reconstructable from canonical facts.

Avoid duplicate facts across:

- OrderHistory;
- AuditLog;
- business events.

AuditLog details must be minimal and non-PII.

Do not fabricate lifecycle milestones belonging to 2.5A/2.7.

---

# 25. DATABASE / MIGRATION REVIEW

Inspect whether current Order schema can correctly represent Step 2.5.

If additive schema changes are required:

- create a proper Prisma migration;
- no `db push`;
- no destructive reset;
- no unrelated schema cleanup;
- preserve existing data semantics;
- add only necessary constraints/indexes;
- clean replay must pass;
- drift must be zero.

Pay particular attention to uniqueness for:

- Order code;
- user-facing order number;
- canonical Sale/Order relation;
- any event/dedup relation that belongs in domain storage.

Do not add cross-schema FKs that violate the established bounded-context strategy.

---

# 26. REQUIRED NEGATIVE TESTS

At minimum cover:

1. malformed/unsupported `OrderRequested` does not create Order;
2. duplicate delivery creates exactly one Order;
3. concurrent duplicate delivery creates exactly one Order;
4. no duplicate `OrderCreated`;
5. no second availability reservation/decrement;
6. failed transaction leaves no partial Order graph;
7. missing mandatory frozen commercial facts fail safely;
8. invalid money/currency snapshot fails safely if validation is required;
9. traveler snapshot does not leak unrelated PII;
10. legacy/bootstrap flow remains isolated from canonical event-driven flow;
11. correlation/causation are preserved;
12. different events do not leak request context into each other.

Use exact status/error semantics appropriate to internal consumer behavior; do not force HTTP semantics where no HTTP boundary exists.

---

# 27. REQUIRED POSITIVE E2E JOURNEY

Prove the real commercial chain, preferably using existing public/internal APIs rather than direct DB fabrication except where unavoidable for fixture setup:

`Quote`
→ `CheckoutIntent`
→ payment terms
→ service date/travelers as required
→ `Sale`
→ complete Sale
→ `OrderRequested`
→ publish/consume
→ **one canonical Order**
→ OrderItems/OrderTraveler
→ `OrderCreated`.

Verify against database and Outbox/Inbox.

Required assertions include:

- Sale remains CLOSED;
- Order links/references correct upstream business facts;
- Order totals/currency equal frozen Sale snapshot;
- Order does not reprice;
- existing availability reservation remains the same;
- OrderCreated correlation inherited;
- OrderCreated causation points to OrderRequested event;
- no Booking is created in Step 2.5;
- no Payment is created;
- no premature `BookingRequested`.

---

# 28. ORDER ↔ BOOKING ISOLATION

Step 2.5 creates Order only.

Do NOT:

- create Booking;
- publish `BookingRequested`;
- mark Order ready for booking;
- complete Order lifecycle.

Those belong to Steps 2.7/2.8.

Existing Booking foundations must remain regression-green.

---

# 29. REVERSE MARKETPLACE ISOLATION

Do NOT implement any of the newly added:

- Step 2.2A Seller Commercial Capabilities;
- 2.2B BuyerRequest;
- 2.2C Matching;
- 2.2D Seller Proposal;
- 2.2E request communication;
- 2.2F proposal conversion;
- `reverse.*` schema/context;
- Reverse Marketplace ADR.

Step 2.5 must remain acquisition-path agnostic.

The future `BUYER_REQUEST` path will eventually converge into the same Sales → OrderRequested → Order consumer.

That future path must not require a second Order consumer.

---

# 30. FRONTEND BOUNDARY

Step 2.5 is backend/domain infrastructure.

Do not build new Order UI unless a current frontend contract breaks because of a necessary API-compatible change.

Frontend must remain regression-green.

No hardcoded backend/frontend ports may be introduced.

The project must remain environment/config driven; local ports may vary when occupied.

---

# 31. DOCUMENTATION

Update only documentation necessary to describe the implemented Step 2.5 truth.

At minimum review/update as appropriate:

- canonical Roadmap Step 2.5 status;
- event contract docs;
- ID contract if implementation clarifies existing IDs;
- Order architecture documentation;
- any deferred-decision map if a real decision is resolved/deferred.

Do not mark:

- 2.5A;
- 2.5B;
- 2.6

as completed.

Do not rewrite unrelated docs.

---

# 32. TEST / REGRESSION REQUIREMENTS

Run the repository-equivalent validation.

At minimum:

## Backend
- TypeScript typecheck;
- relevant unit tests;
- targeted Step 2.5 e2e;
- Step 2.4 regression;
- Order regression;
- Booking regression;
- request-context/eventbus/outbox/inbox regression;
- full serial e2e.

## Frontend
Even with no frontend changes:
- TypeScript check;
- existing frontend unit/vitest suite;
- production build.

## Database
If migration added:
- migrate status;
- clean replay on isolated DB;
- drift check.

If no migration is needed, explicitly state why.

Do not report tests as passed unless actually executed.

---

# 33. RUNTIME VERIFICATION

Run an isolated backend instance/test environment where practical.

Verify real runtime behavior:

- Sale completion produces OrderRequested;
- publish/consumer creates Order;
- duplicate delivery remains one Order;
- OrderCreated appears once;
- no Booking/Payment appears;
- trace metadata correct;
- bootstrap still behaves according to its temporary contract;
- errors do not leak stack/PII.

Do not mutate shared production-like user data.

Use isolated test DB/fixtures.

---

# 34. STRICT IMPLEMENTATION BOUNDARY

This task may implement ONLY what is necessary for Step 2.5.

Do not opportunistically implement:

- 2.5A full temporal contract;
- 2.5B full acquisition propagation;
- 2.6 bootstrap removal;
- 2.7 Order lifecycle;
- 2.8 Booking creation;
- Payments;
- Finance;
- Documents;
- Reverse Marketplace;
- UI redesign;
- global event architecture refactor.

If a defect outside scope is discovered:

- fix it only if it directly blocks correctness of Step 2.5 and is local/safe;
- otherwise record it as debt/dependency.

---

# 35. ARCHITECTURE STOP CONDITIONS

STOP and return `ARCHITECTURE DECISION REQUIRED` if any of these cannot be resolved from approved sources:

1. Order owner is ambiguous.
2. `OrderRequested` lacks enough immutable authority to create Order and fixing it would materially redesign Step 2.4.
3. One Sale can legitimately create multiple Orders but current Roadmap assumes one.
4. Order money authority conflicts with Sale snapshot authority.
5. traveler snapshot ownership conflicts with existing Booking/CRM contracts.
6. Inbox/Outbox transaction model cannot guarantee exactly-once domain effect without architectural change.
7. existing ID contracts conflict materially.
8. Step 2.5 requires implementing Step 2.5A/2.5B/2.7 to be correct.

Do not make a hidden architectural choice.

---

# 36. CODE REVIEW BEFORE COMPLETION

After implementation, perform a self-review against:

- bounded-context writes;
- duplicate consumer delivery;
- concurrency;
- transaction boundaries;
- sequence allocation;
- event envelope;
- correlation/causation;
- PII;
- money Decimal handling;
- snapshot authority;
- availability double-reservation;
- bootstrap coexistence;
- accidental Booking creation;
- accidental Step 2.5A/B scope creep.

Fix confirmed local defects before final report.

---

# 37. REQUIRED FINAL REPORT

Return a structured report with exactly these major sections:

## 1. Verdict

Use:

`PHASE 2 STEP 2.5 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

or:

`ARCHITECTURE DECISION REQUIRED`

or a clear blocked/failure verdict.

## 2. Repository baseline

Branch, HEAD, dirty files before/after.

## 3. Sources inspected

Roadmap, ADRs, contracts, code, schema, tests.

## 4. Current → Target mapping

What existed before and what Step 2.5 added.

## 5. OrderRequested contract

Exact authoritative fields consumed.

## 6. Order ownership / bounded-context result

Confirm no Sales direct writes.

## 7. Order creation transaction

Describe atomic flow.

## 8. ID strategy

`ORD-*` and `TH-YYYY-######`, concurrency guarantees.

## 9. Snapshot / money result

What is preserved and why.

## 10. OrderItem / traveler result

Snapshot and PII boundaries.

## 11. Idempotency / duplicate delivery

Evidence.

## 12. Concurrency

Evidence.

## 13. Inbox / Outbox atomicity

Evidence.

## 14. OrderCreated contract

Payload/envelope and consumers.

## 15. Correlation / causation

Exact lineage.

## 16. Availability isolation

Prove no second reservation.

## 17. Order / Booking isolation

Prove no Booking/BookingRequested.

## 18. Bootstrap coexistence

State exact behavior and what remains for 2.6.

## 19. RBAC / security / privacy

Result.

## 20. Migration

Exact migration or explain why none.

## 21. Targeted tests

Exact counts/results.

## 22. Full regression

Backend + frontend + DB.

## 23. Runtime verification

Actual flow tested.

## 24. Issues found/fixed

All confirmed defects and fixes.

## 25. Deferred / remaining work

Explicitly separate 2.5A, 2.5B, 2.6, 2.7, Reverse Marketplace.

## 26. Architecture decision status

YES/NO with rationale.

## 27. Out-of-scope confirmation

Confirm later steps not started.

## 28. Files changed

Exact list.

Final line:

`PHASE 2 STEP 2.5 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

---

# 38. STOP CONDITION

After Step 2.5 implementation, validation and report:

**STOP.**

Do NOT perform Step 2.5 Strict Review in the same run.

Do NOT begin:

- Step 2.5A;
- Step 2.5B;
- Step 2.6;
- Step 2.7;
- Reverse Marketplace ADR;
- Steps 2.2A–2.2F.

Wait for a separate strict-review prompt.
