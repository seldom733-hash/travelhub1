# PHASE 2 — STEP 2.8 — BOOKINGREQUESTED → BOOKING CREATION

**Project:** TravelHub  
**Mode:** IMPLEMENTATION / CANONICALIZATION & HARDENING  
**Prerequisite:** `PHASE 2 STEP 2.7 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`  
**Current Roadmap NEXT:** `PHASE 2 — STEP 2.8 — BOOKINGREQUESTED → BOOKING CREATION`  
**Hard stop:** implement **Step 2.8 only**. Do not start Step 2.8A, Step 2.9, Finance/Payment, Documents, frontend Booking Center, or any later item.

---

## 1. Mission

Implement and close **Phase 2 Step 2.8** by canonicalizing and hardening the **pre-existing Phase 1 `BookingRequested` consumer**.

This is **NOT** a greenfield task and must **NOT** create a second Booking creation mechanism.

The repository already contains a production-registered `BookingRequested` consumer which creates Booking records. Step 2.7 Strict Review explicitly established that this is approved **Phase 1 scaffolding** and that Step 2.8's purpose is to reconcile it with the current canonical architecture, prove ownership/cardinality/idempotency, close any implementation gaps, and provide complete regression coverage.

The target invariant is:

`Order → BookingRequested → Booking-owned consumer → canonical Booking`

with no direct `Order → booking.*` write and no alternate HTTP/bootstrap/manual Booking creation authority unless an already-approved canonical contract explicitly requires one.

---

## 2. Mandatory source inspection

Before changing code, inspect and reconcile at minimum:

1. current `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` — especially Steps 2.7, 2.8, 2.8A, 2.9 and the consolidated execution sequence;
2. Step 2.7 Strict Review report and its review fixes;
3. Screen Design Brief / Architecture Master / current Booking Center backend contracts;
4. Step 1.14 canonical Order events;
5. Steps 2.4, 2.5, 2.5A, 2.5B, 2.6 and 2.7 implementation/review artifacts;
6. `docs/contracts/events.md` and `docs/contracts/api.md`;
7. ADR-0001 domain ownership and any ADRs governing event envelope, request context, correlation/causation and PII;
8. `booking.subscribers.ts`, `booking.module.ts`, Booking service/controller/contracts/validation;
9. `order.service.ts`, Order subscribers and `BookingRequested` producer;
10. Prisma `Order`, `OrderItem`, `OrderTraveler`, `Booking`, `Passenger`, history/audit/outbox/inbox models;
11. Availability reservation/hold ownership and existing Booking/Order reconciliation code;
12. acquisition-source propagation contracts;
13. IDs contract (`BKG-*` and related prefixes);
14. all existing BookingRequested/BookingCreated/Booking lifecycle tests.

**Current Roadmap wins** if this prompt conflicts with an updated canonical decision.

---

## 3. Repository baseline

Record before implementation:

- branch;
- HEAD;
- relation to `origin/master`;
- dirty/untracked files;
- whether Steps 2.6/2.7 review fixes are committed;
- migration count/status/drift state;
- current Step 2.8 Roadmap status;
- exact production registration of the existing BookingRequested consumer.

Do not silently absorb unrelated dirty files.

---

## 4. Current → Target reconciliation — REQUIRED

Document the **actual current implementation** before modifying it.

At minimum answer:

- what `BookingRequested` currently contains;
- which class consumes it;
- whether the consumer is production-registered;
- how many Booking records are created per Order / OrderItem;
- how Booking links back to Order/OrderItem;
- how passengers are created;
- what acquisition source is copied;
- what money is copied, if any;
- whether availability is touched;
- how Inbox/idempotency works;
- how `BookingCreated` is emitted;
- how duplicate/concurrent delivery behaves;
- what Step 2.8 gaps actually remain.

Do not rewrite working Phase 1 code merely to manufacture an implementation delta.

---

## 5. Domain ownership — HARD GATE

`Booking` is owned by the Booking domain.

Required:

- Order publishes `BookingRequested` only;
- Order code must not directly create/update `booking.*`;
- Booking consumer may read trusted Order snapshot/context required by the approved contract;
- Booking creation writes occur only inside Booking-owned code;
- no second Booking writer is introduced;
- no cross-domain Prisma write is hidden in helpers.

Repository-wide audit all production `booking.create`, `booking.createMany`, `booking.upsert`, raw inserts and equivalent writes.

Classify every writer and prove there is no competing creation authority.

---

## 6. BookingRequested is the canonical trigger — HARD GATE

A normal Booking must be created **only** from the canonical `BookingRequested` fact unless the current architecture explicitly documents another trusted import/provisioning path.

Verify/remove/deprecate any accidental:

- `POST /bookings/create`;
- bootstrap Booking endpoint;
- generic admin/manual create route;
- Order service direct create;
- `OrderReadyForBooking` → Booking creation shortcut;
- `OrderStatusChanged` → Booking creation shortcut;
- Sale/Checkout → Booking direct creation;
- duplicate consumer.

Do not remove legitimate historical/import tooling without proving its intended authority.

---

## 7. Event contract

Reconcile the actual `BookingRequested` event with the canonical event contract.

Step 2.7 review reports a minimal payload:

`{ orderId, orderCode, customerId }`

and deliberately removed items/travelers from the durable event payload for PII minimization.

Therefore the Booking consumer must not depend on mutable client-provided event snapshots.

Verify:

- event name/version;
- aggregate type/id;
- minimal payload;
- correlation inheritance;
- causation = producer event relationship as defined by ADR;
- actor metadata;
- no passport/firstName/contact PII in durable event payload;
- no price/catalog snapshot duplication unless explicitly canonical.

If current consumer needs Order details, perform an authoritative server-side read using `orderId` under the approved cross-domain read policy.

---

## 8. Frozen Order snapshot consumption

Booking creation must consume **frozen Order facts**, not re-price or reconstruct commercial truth from mutable Catalog.

Audit exactly which Order/OrderItem fields become Booking facts.

Must not:

- resolve Tariff again;
- resolve CommercialPeriod again;
- evaluate CommercialRestriction again;
- recalculate price;
- perform FX conversion;
- reinterpret current Product/ServiceUnit data;
- replace frozen acquisition source.

If Booking requires descriptive fields, use approved frozen Order snapshots/refs.

---

## 9. Order ↔ Booking cardinality — HARD GATE

Define and enforce the canonical cardinality.

Step 2.7 review reports that the existing consumer creates **a Booking per OrderItem**.

Prove whether current Roadmap/architecture requires:

`1 OrderItem → exactly 1 Booking`

or another relationship.

If one-per-item is canonical, enforce it at DB/domain level where safely possible and test duplicate/concurrent delivery.

Do not silently change to `1 Order → 1 Booking` or `1 OrderItem → N Bookings`.

If authoritative sources conflict, STOP with `ARCHITECTURE DECISION REQUIRED`.

---

## 10. Stable linkage

Each Booking created from BookingRequested must retain canonical linkage sufficient to trace:

`Booking → Order → OrderItem → originating Sale/Checkout/Quote` where those refs already exist.

Review schema and decide whether existing `orderId` / `orderItemId` linkage is sufficient.

Do not add duplicate snapshot columns without need.

No cross-domain FK is required if ADR-0001 forbids it; use trusted IDs according to existing architecture.

---

## 11. Booking ID allocation

Verify canonical `BKG-*` allocation:

- server-owned;
- atomic;
- no client-forge;
- no random fallback if BusinessSequence is canonical;
- duplicate delivery does not burn/create multiple business objects beyond acceptable sequence gaps;
- IDs contract/docs remain synchronized.

---

## 12. Initial Booking state

Determine the approved initial Booking status created by `BookingRequested`.

Do not guess.

Verify it against:

- current Booking state machine;
- Screen Design codes;
- existing Phase 1 implementation;
- Roadmap Step 2.8/2.9 boundary.

Step 2.8 must create the Booking only; do not advance into supplier confirmation, payment, cancellation orchestration or later lifecycle unless the canonical current contract already requires an initial technical transition.

---

## 13. Passenger projection — HARD REVIEW

The existing consumer reportedly creates Passenger records from COMPLETE `OrderTraveler` records.

Review:

- whether every Booking receives the correct passengers;
- whether passengers are per Booking or shared;
- whether non-traveler products can create Booking without Passenger;
- whether incomplete travelers should block Booking creation, be omitted, or be impossible because Step 2.7 readiness already guards them;
- whether passport data belongs in Booking Passenger and whether its storage is approved;
- PII encryption/redaction/logging rules;
- no PII in events/audit logs.

Do not fabricate placeholder passengers.

---

## 14. Cross-category behavior

Test at least representative categories already supported by the project, including a service that may have travelers/passengers and one that legitimately may not.

Booking creation must not assume every Product is Tour/Hotel/Transfer unless the canonical model explicitly does.

If Booking itself is not universal enough for current Service Template categories, STOP and report the architecture conflict rather than inventing category-specific hacks.

---

## 15. Acquisition source propagation

Booking must copy the **frozen Order acquisition source verbatim**, including at minimum:

- `DIRECT`;
- `BUYER_REQUEST`;
- legacy `null` where schema/history permits it.

No fallback from null to DIRECT. No recomputation from request/channel/current context.

Add explicit tests.

---

## 16. Money semantics

Determine whether Booking owns/copies monetary fields at creation.

If it does:

- copy frozen Order values exactly;
- preserve Decimal precision/currency;
- no recalculation;
- no priceFrom/POR resolution;
- no Payment creation;
- no paid-state fabrication.

If Booking does not own money, do not add it merely for Step 2.8.

---

## 17. Availability ownership — HARD GATE

Step 2.5B/2.7 established:

`Sale completion = capacity hold`

and

`Order creation/lifecycle ≠ second decrement`.

Step 2.8 must prove:

- Booking creation does not create a second AvailabilityReservation;
- no second capacity decrement;
- existing reservation/hold reference is preserved only according to canonical ownership;
- Booking does not release/reallocate capacity during creation;
- no hidden inventory side effect occurs on duplicate delivery.

---

## 18. Idempotency — HARD GATE

A duplicate delivery of the **same `BookingRequested` event** must create no duplicate Booking/Passenger/history/event facts.

Review InboxEvent semantics carefully.

Prove:

- same event delivered twice;
- same event delivered concurrently;
- process restart/retry;
- partial failure before commit;
- replay after commit;
- duplicate event with same eventId;
- logically duplicate BookingRequested with a different eventId for the same Order.

The last case must also be protected by domain/DB invariants, not Inbox alone.

---

## 19. Concurrency

Test concurrent consumer execution for the same Order.

Expected outcome:

- canonical number of Bookings only;
- canonical Passenger rows only;
- exactly one BookingCreated per real Booking;
- no raw P2002/500 leak;
- no partially-created Booking set;
- no duplicate history/audit.

Use DB uniqueness/CAS/transactional design rather than process-local locks.

---

## 20. Failure atomicity — HARD GATE

For one BookingRequested processing transaction, define atomicity.

At minimum ensure failure cannot leave:

- some Bookings created but event marked processed incorrectly;
- Booking without required Passenger projection;
- Booking without required history;
- BookingCreated emitted for rolled-back Booking;
- Inbox marked done while business writes failed.

If one Order produces multiple Bookings, determine whether the canonical unit of atomicity is the whole Order request or each item. Do not guess if existing design is ambiguous.

---

## 21. BookingCreated event

For every real Booking creation verify exactly one canonical `BookingCreated` event.

Review:

- payload whitelist;
- no PII;
- aggregate identity;
- event version;
- correlation inherited from BookingRequested;
- causation = `BookingRequested.eventId`;
- actor semantics for consumer-produced result event;
- no event on duplicate/no-op processing.

---

## 22. History and audit

Verify Booking creation history/audit requirements from current architecture.

If BookingHistory exists, creation should produce the canonical initial fact exactly once.

Security audit must not dump traveler/passenger PII.

Do not introduce a second audit model.

---

## 23. Order reconciliation boundary

Inspect `order.subscribers.ts` and Booking events.

Step 2.8 may create Booking and emit BookingCreated, but must not invent later Order fulfillment semantics.

Ensure:

- BookingCreated does not falsely make Order PARTIALLY_FULFILLED/FULFILLED;
- only approved later Booking status/result events drive reconciliation;
- generic Booking creation is not fulfillment.

---

## 24. Cancellation boundary

Do not implement Step 2.9 cancellation/refund/release orchestration.

If Order is cancelled concurrently with BookingRequested consumption, define behavior using existing canonical facts.

At minimum test the race and prevent corrupt partial state.

If policy for this race is not defined and cannot be derived safely, return `ARCHITECTURE DECISION REQUIRED` rather than inventing compensation.

---

## 25. Order state gate

At consumption time, determine whether Booking creation requires Order to still be `SENT_TO_BOOKING` or whether `BookingRequested` itself is sufficient authority once durably emitted.

This is a critical temporal question.

Review current event-driven architecture before changing behavior. Do not add a live-state gate that can invalidate an already-authoritative durable event unless canonical docs require it.

Document the chosen semantics and race implications.

---

## 26. Legacy compatibility

Verify existing historical Bookings and Orders remain readable/manageable.

Test relevant legacy cases:

- Order with `saleId = null` if historically allowed;
- acquisitionSource = null;
- older Booking without newly optional provenance if applicable;
- old Booking codes/statuses;
- existing Bookings created before Step 2.8 hardening.

No destructive backfill unless required and justified.

---

## 27. RBAC / API surface

Step 2.8 is event-driven creation.

Verify external roles cannot forge canonical Booking creation via HTTP.

Audit BUYER, PARTNER, OPERATOR, SALES_MANAGER, MODERATOR, ADMIN and anonymous access to any Booking creation endpoint.

If a create endpoint exists only as obsolete bootstrap/scaffolding, reconcile it with current Roadmap; do not leave a second authority.

Read/manage Booking APIs outside creation scope should remain backward-compatible.

---

## 28. Mass assignment

Any surviving Booking write APIs must reject forged server-owned fields according to project convention.

At minimum protect:

- id/code;
- order/orderItem/customer/partner ownership refs;
- acquisitionSource;
- price/currency/payment facts;
- status/milestones;
- availability refs;
- version;
- actor/correlation/causation;
- history/audit/system metadata.

Do not silently accept/strip fields where canonical convention requires loud 422.

---

## 29. PII / security

Perform explicit PII audit of:

- BookingRequested;
- BookingCreated;
- outbox/inbox;
- Booking history;
- Security audit;
- logs/errors;
- Passenger projection;
- API DTOs.

No passport/contact PII in event envelopes or logs.

Use existing encryption/redaction conventions; do not invent a parallel mechanism.

---

## 30. Cross-Seller / tenant isolation

Where Booking contains partner/seller context, prove it is derived from trusted Order/OrderItem facts and cannot be forged across sellers.

No Buyer/Partner may create a Booking for another seller/order through IDs or event-like HTTP input.

---

## 31. Reverse Marketplace compatibility

Run the full Reverse path:

`BuyerRequest → Proposal → selection/conversion → Sales → Sale → OrderRequested → Order → BookingRequested → Booking`

as far as currently canonical.

Verify acquisition source remains `BUYER_REQUEST`, no Reverse-specific Booking path exists, and Reverse does not bypass canonical Order/Booking boundaries.

Do not start new Reverse features.

---

## 32. Universal Pricing / Service Template regression

Run regression for 1.8A–1.8D.

Booking creation must consume frozen commercial facts and must not re-enter:

- ServiceUnit resolution;
- Rate Plan selection;
- CommercialPeriod pricing;
- CommercialRestriction evaluation.

No Universal Pricing amendment work is part of 2.8.

---

## 33. Time-slot boundary — Step 2.8A HARD STOP

Do **not** introduce:

- time-slot engine;
- timezone resolution;
- slot reservation;
- supplier slot inventory;
- time-based availability semantics;
- date-time reinterpretation.

If correct Booking creation now requires a time/timezone model that does not exist, STOP:

`ARCHITECTURE DECISION REQUIRED`

Do not silently implement Step 2.8A.

---

## 34. Migration strategy

Prefer no migration if current schema already supports canonical Step 2.8.

If a DB invariant is missing and a migration is necessary (for example, canonical OrderItem↔Booking uniqueness), migration must be:

- additive/fresh-deploy-safe;
- compatible with existing data;
- explicit about legacy duplicates/nulls;
- applied via Prisma migration only;
- tested with clean replay;
- drift-free.

Do not use `db push`.

If adding uniqueness would fail on legitimate historical data and canonical cardinality is unclear, stop for architecture decision.

---

## 35. Required negative tests

At minimum add/verify tests for:

1. malformed/forged BookingRequested payload cannot create arbitrary Booking;
2. duplicate same event → no duplicate;
3. concurrent same event → no duplicate;
4. logically duplicate different eventId for same Order → no duplicate business objects;
5. no direct Order→Booking write path;
6. no HTTP bootstrap/manual Booking creation authority unless explicitly approved;
7. no second availability hold;
8. no price recalculation;
9. no acquisition fabrication;
10. no PII in BookingRequested/BookingCreated;
11. failure rollback leaves no partial Booking set;
12. invalid/unknown Order reference fails safely;
13. no raw DB error leak;
14. Booking creation does not mark Order fulfilled;
15. Step 2.8A fields/time-slot semantics are not introduced.

---

## 36. Required positive tests

At minimum prove:

1. canonical Order reaches READY_FOR_BOOKING;
2. send produces one BookingRequested;
3. consumer creates canonical Booking(s);
4. exact OrderItem↔Booking mapping;
5. correct initial Booking status;
6. canonical BKG-* IDs;
7. Passenger projection is correct;
8. non-traveler compatible case works where canonical;
9. DIRECT acquisition copied verbatim;
10. BUYER_REQUEST copied verbatim;
11. legacy null acquisition preserved;
12. frozen money/provenance preserved where Booking owns it;
13. BookingCreated exactly once per real Booking;
14. correlation inherited;
15. causation points to BookingRequested;
16. no extra AvailabilityReservation;
17. duplicate/replay idempotency;
18. concurrent delivery safety;
19. Reverse→Sales→Order→Booking canonical path;
20. legacy Booking remains readable/manageable.

---

## 37. Full write-path audit

Repository-wide search and report all production writers for:

- `booking.Booking`;
- Passenger;
- BookingHistory;
- AvailabilityReservation from Booking flow;
- Order status from Booking events.

For each writer classify:

1. canonical Step 2.8 creation;
2. canonical later lifecycle;
3. trusted import/provisioning;
4. test-only;
5. obsolete/unsafe.

Category 5 must be removed/fixed or explicitly block approval.

---

## 38. Full regression

After implementation/review fixes run actual commands and report actual counts.

### Backend

- TypeScript typecheck;
- build;
- full unit suite;
- targeted Step 2.8 E2E;
- Step 2.7 lifecycle suite;
- Step 1.14 canonical events;
- Steps 2.4/2.5/2.5A/2.5B/2.6;
- Reverse 2.2A–2.2F;
- 1.8A–1.8D;
- Availability;
- acquisition propagation;
- RBAC;
- PII/event envelope;
- Buyer Cabinet / Booking reads;
- full serial E2E.

### Frontend

Even if untouched:

- `tsc --noEmit`;
- vitest;
- production build.

### Database

- `prisma migrate status`;
- fresh migration replay through project-supported test setup;
- repository-supported drift check.

Do not claim drift verification that was not actually run.

---

## 39. Review-fix policy during implementation

You may fix local architecture-neutral defects discovered while implementing 2.8 when they are necessary to satisfy this step.

For every such fix report:

`defect → risk → patch → regression test → result`

Do not opportunistically refactor unrelated domains.

---

## 40. Architecture stop conditions

STOP and return:

`PHASE 2 STEP 2.8 BLOCKED — ARCHITECTURE DECISION REQUIRED`

if any of the following cannot be resolved from current canonical sources:

- Order↔OrderItem↔Booking cardinality conflicts;
- existing consumer is not actually approved canonical scaffolding;
- more than one production Booking creation authority is intentionally required but undefined;
- Booking initial status is contradictory;
- Passenger ownership/model is incompatible across supported service categories;
- correct Booking creation requires Step 2.8A time/timezone semantics;
- Order cancellation vs durable BookingRequested requires undefined compensation policy;
- event authority vs live Order state is contradictory;
- Availability must be re-held/released but ownership contract is undefined;
- DB uniqueness cannot be safely introduced because legitimate historical cardinality differs;
- correct fix requires Step 2.9/Finance/Payment/Documents implementation.

Do not guess through an architecture conflict.

---

## 41. Explicit out-of-scope

Do NOT implement in this pass:

- Step 2.8A time/timezone/time-slot model;
- Step 2.9 cancellation/refund/release orchestration;
- Payment/Finance;
- supplier settlement;
- Documents;
- notifications unless already mandatory existing consumer behavior and only regression is needed;
- frontend Booking Center;
- calendar UI;
- dynamic pricing;
- supplier/channel-manager integrations;
- new Reverse Marketplace features;
- Universal Pricing amendment;
- new generic Booking creation API.

---

## 42. Documentation requirements

Update only after implementation is proven:

- architecture note for BookingRequested → Booking canonical creation;
- `docs/contracts/events.md` if event contract needs clarification;
- `docs/contracts/api.md` if creation authority/API boundary needs clarification;
- IDs docs only if necessary;
- Roadmap Step 2.8 status.

Document explicitly that the consumer pre-existed from Phase 1 and Step 2.8 canonicalized/hardened it; do not falsely claim it was newly invented if it was not.

---

## 43. Roadmap status

At the end of a successful implementation pass set only:

`PHASE 2 STEP 2.8 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

and make the exact NEXT item:

`PHASE 2 — STEP 2.8 — STRICT REVIEW`

Do **not** mark Step 2.8 approved in the implementation pass.

Do **not** start Step 2.8A.

---

## 44. Required final implementation report

Return a report with this exact structure:

# PHASE 2 — STEP 2.8 — BOOKINGREQUESTED → BOOKING CREATION — REPORT

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target reconciliation
5. Domain ownership
6. Booking write-path audit
7. Canonical BookingRequested trigger
8. Event contract
9. Frozen Order snapshot consumption
10. Order ↔ OrderItem ↔ Booking cardinality
11. Stable linkage / provenance
12. Booking ID allocation
13. Initial Booking state
14. Passenger projection
15. Cross-category behavior
16. Acquisition source propagation
17. Money semantics
18. Availability isolation
19. Idempotency
20. Concurrency
21. Failure atomicity
22. BookingCreated event
23. History / audit
24. Order reconciliation boundary
25. Cancellation race/boundary
26. Event authority vs live Order state
27. Legacy compatibility
28. RBAC / API creation authority
29. Mass assignment
30. PII / security
31. Cross-Seller / tenant isolation
32. Reverse Marketplace regression
33. Universal Pricing / Service Template regression
34. Step 2.8A hard boundary
35. Migration / DB invariants
36. Negative tests
37. Positive tests
38. Targeted tests
39. Backend full regression
40. Frontend regression
41. DB regression
42. Issues found and fixed
43. Architecture decision status
44. Documentation changes
45. Roadmap update
46. Deferred decisions / extension points
47. Out-of-scope confirmation
48. Exact files changed
49. Exact NEXT item

Final line must be exactly one of:

`PHASE 2 STEP 2.8 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

or

`PHASE 2 STEP 2.8 BLOCKED — ARCHITECTURE DECISION REQUIRED`

---

## 45. STOP

After completing Step 2.8 implementation and its report: **STOP**.

Do not perform Step 2.8 Strict Review in the same pass.
Do not implement Step 2.8A.
