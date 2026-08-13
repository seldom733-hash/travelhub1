# PHASE 2 — STEP 2.9 — BOOKING LIFECYCLE COMPLETION

## IMPLEMENTATION PROMPT

**Project:** TravelHub  
**Phase:** 2 — Core Commercial Flow  
**Step:** 2.9 — Booking Lifecycle Completion  
**Mode:** IMPLEMENTATION + SELF-AUDIT  
**Next after approval:** Step 2.9 STRICT REVIEW, then Step 2.9A Booking Temporal Contract  

---

## 1. Mission

Implement and reconcile the **canonical Booking lifecycle** after the already-approved chain:

`Product → Quote → CheckoutIntent → Sale → OrderRequested → Order → BookingRequested → Booking`

Step 2.9 owns Booking operational lifecycle semantics:

- supplier processing;
- confirmation;
- clarification / waiting-for-data where canonically justified;
- rejection;
- supported change handling;
- cancellation;
- fulfillment/completion;
- canonical Booking → Order feedback events and Order reconciliation.

The Roadmap defines Step 2.9 as **“Supplier processing, confirmation, clarification, rejection, change/cancellation, fulfillment, обратные события Order.”**

This step MUST NOT silently absorb Step 2.9A temporal-contract scope or Step 2.10 Finance scope.

---

## 2. Mandatory starting state

Before changing code, verify the repository, not assumptions.

Expected approved baseline:

- Step 2.6 — APPROVED;
- Step 2.7 — APPROVED WITH REVIEW FIXES;
- Step 2.8 — APPROVED;
- Step 2.8A — APPROVED;
- Step 2.9 — exact NEXT item;
- Booking creation occurs only through durable `BookingRequested` consumer;
- `Booking.orderItemId` enforces canonical OrderItem → Booking cardinality;
- Booking inherits frozen acquisition/money/service-occurrence facts;
- `BookingRequested` is durable event authority;
- Booking creation does not perform a second availability hold;
- Step 2.8 explicitly deferred compensation for the `send → BookingRequested → Booking` vs later Order cancellation race to Step 2.9;
- Booking service time facts from Step 2.8A are already frozen/derived and must not be reinterpreted by lifecycle commands.

If repository reality differs materially, document the difference before implementation.

---

## 3. Hard scope boundary

### IN SCOPE

1. Canonical Booking state machine.
2. Stable Booking status/action semantics already supported by canonical sources, reconciled rather than guessed.
3. Supplier/internal processing commands.
4. Confirmation.
5. Clarification / waiting-for-data if supported by current model/contracts.
6. Rejection.
7. Cancellation.
8. Fulfillment/completion.
9. Change handling only to the extent current canonical model safely supports it.
10. Booking domain history/audit semantics required for lifecycle correctness.
11. Canonical Booking lifecycle events.
12. Booking → Order feedback/reconciliation.
13. Race/idempotency/atomicity hardening.
14. Compensation/reconciliation for already-created Booking when Order becomes incompatible with it, **only where ownership and existing contracts make the correct behavior unambiguous**.
15. RBAC, object scope, IDOR, mass-assignment protection.
16. API/contracts/docs/tests.

### OUT OF SCOPE

Do NOT implement unless strictly required by an existing approved contract:

- Step 2.9A persisted temporal contract (`requestedAt`, `confirmedAt`, `rejectedAt`, `cancelledAt`, `completedAt`, SLA timestamps) as a new model;
- Finance / Payment / Refund / Settlement / Payout;
- supplier portal UI;
- frontend Booking Center redesign;
- documents/vouchers;
- notification engine;
- new availability engine;
- second hold/reservation engine;
- repricing;
- rescheduling engine if canonical semantics are not already defined;
- penalties/refund policy execution;
- invented supplier integration/provider API;
- speculative statuses/events merely because they seem useful.

Step 2.9A remains a separate roadmap item.

---

## 4. Sources of truth — inspect before coding

Inspect at minimum:

### Roadmap / architecture
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- Step 2.7 architecture/report
- Step 2.8 architecture/report
- Step 2.8A architecture/report
- Screen Design / Backend Booking status codes if present
- relevant ADRs

### Contracts
- `docs/contracts/api.md`
- `docs/contracts/events.md`

### Booking production code
- Booking schema/model/enums
- Booking service
- Booking controller
- Booking subscribers/consumers
- Booking module registration
- Booking validation
- Booking history model/writers
- Passenger writers

### Order feedback code
- Order subscribers
- Order reconciliation logic
- Order canonical events
- `OrderStatusChanged` usage
- Booking event consumers

### Shared infrastructure
- EventBus / Outbox / Inbox
- request context / correlation / causation
- ID registry / business sequences
- RBAC permissions
- `assertNoForbiddenKeys`
- Prisma unique-constraint helpers

### Regression suites
At minimum inspect tests covering:
- booking-requested consumer;
- booking service-time model;
- order lifecycle completion;
- order canonical events;
- acquisition propagation;
- availability;
- RBAC/IDOR;
- event envelope / PII;
- Reverse Marketplace path;
- legacy Booking behavior.

Do not redesign before this audit.

---

## 5. First deliverable: Current → Target reconciliation

Before implementation, write a compact repository-derived matrix:

| Concern | Current implementation | Canonical target | Delta |
|---|---|---|---|
| Booking statuses | ... | ... | ... |
| Booking actions | ... | ... | ... |
| State-machine authority | ... | one authority | ... |
| History | ... | real transitions only | ... |
| Events | ... | canonical facts | ... |
| Order feedback | ... | owner-safe reconciliation | ... |
| Cancellation | ... | ... | ... |
| Fulfillment | ... | ... | ... |
| Change handling | ... | ... | ... |
| Temporal fields | ... | 2.9A boundary | ... |

Classify every discovered lifecycle path as:

1. canonical and keep;
2. canonical but incomplete — harden;
3. legacy-compatible — preserve/read;
4. technical/internal only;
5. obsolete/unsafe — remove only with proof;
6. ambiguous — architecture decision required.

---

## 6. Booking state-machine authority — HARD GATE

There MUST be one identifiable authority for Booking transitions.

Audit every production write to:

- `Booking.status`;
- lifecycle flags/milestones if any;
- Booking history;
- lifecycle outbox events.

Controllers must not implement independent transition logic.
Consumers must not bypass Booking-owned transition invariants unless they are explicitly Booking-owned reconciliation handlers using the same guards/CAS rules.

Search for:

- `booking.update`
- `booking.updateMany`
- `booking.create`
- raw SQL updates
- repository wrappers
- subscriber-side status writes

Report every writer and classification.

**Hard fail:** multiple conflicting state machines.

---

## 7. Status vocabulary

Do NOT invent a new enum from this prompt.

Derive final status codes from:

1. current Prisma/domain enum;
2. Screen Design canonical codes;
3. API/events docs;
4. approved Phase 1/2 behavior;
5. existing tests.

For every status document:

- business meaning;
- terminal/non-terminal;
- allowed predecessor(s);
- allowed successor(s);
- actor/role allowed to cause transition;
- whether it is supplier-facing, internal, or technical;
- canonical event, if any.

If canonical sources conflict on status meaning, STOP with `ARCHITECTURE DECISION REQUIRED`.

---

## 8. Transition matrix

Produce the exact final matrix before declaring completion:

| Action | From | To | Guard | Event | Permission |
|---|---|---|---|---|---|

Requirements:

- no implicit arbitrary status PATCH;
- server owns status;
- invalid transition → controlled 409 (or existing canonical error convention);
- malformed/forged command → controlled 4xx;
- no raw 500;
- retry must not duplicate business effect;
- terminal statuses must not silently reopen.

---

## 9. Initial Booking state

Verify what Step 2.8 creates.

`BookingRequested → Booking` must create the canonical initial status only.

Booking creation MUST NOT silently imply:

- supplier accepted;
- confirmed;
- fulfilled;
- paid;
- cancelled;
- repriced;
- re-held availability.

Preserve Step 2.8/2.8A frozen facts exactly.

---

## 10. Supplier processing

Implement/reconcile the explicit transition representing real supplier/internal processing if such state/action exists canonically.

Requirements:

- explicit command;
- RBAC-protected;
- CAS/concurrency-safe;
- one history fact;
- technical event only if current architecture requires it;
- no money/availability/service-time mutation.

Do not fabricate an external supplier acknowledgement if no supplier integration exists.

---

## 11. Clarification / waiting for data

Roadmap explicitly includes clarification.

Reconcile whether this is represented by:

- a Booking status;
- a command;
- Communication context;
- technical marker;
- or is not yet modeled.

If current canonical model already supports a clarification round-trip, preserve and harden it.

If Roadmap requires clarification but no unambiguous representation exists, do NOT invent a new workflow silently. Record the gap and determine whether a minimal Booking-owned state/action is directly supported by Screen Design/architecture; otherwise stop for architecture decision.

Clarification MUST NOT expose cross-seller/customer PII or mutate Order commercial facts.

---

## 12. Booking confirmation

Confirmation is a canonical business fact.

Requirements:

- only from allowed pre-confirmation states;
- explicit command or canonical supplier result;
- state transition atomic with history + outbox event;
- exactly one canonical confirmation event;
- duplicate/retry/concurrent confirm → one business fact;
- confirmation cannot reprice Booking;
- confirmation cannot create another availability hold;
- service date/time/timezone remains frozen;
- acquisitionSource remains frozen;
- Order feedback is event-driven, not direct cross-domain write.

Do not introduce Step 2.9A timestamps merely to satisfy this section; if a pre-existing `confirmedAt` exists, preserve its current contract and document it. New temporal normalization belongs to 2.9A.

---

## 13. Booking rejection

Rejection must be distinct from cancellation.

Verify and implement/reconcile:

- who can reject;
- valid source states;
- optional reason semantics if already modeled;
- canonical `BookingRejected`-type event if current architecture defines it;
- exactly-once business effect;
- Order feedback/reconciliation;
- no automatic refund/payment logic;
- no silent deletion of Booking.

A rejected Booking remains durable history.

---

## 14. Booking cancellation

Cancellation must be explicit and owner-safe.

Audit separately:

1. cancellation initiated at Booking level;
2. Order cancellation after Booking already exists;
3. future Finance/refund consequences — OUT OF SCOPE.

Define allowed source states from canonical evidence.

Requirements:

- terminal behavior where appropriate;
- no hard delete;
- one cancellation fact/event;
- retry/concurrency safe;
- no fabricated refund;
- no direct Finance writes;
- availability release only if current Availability ownership contract explicitly defines Booking as authorized caller/owner. Otherwise do not invent release semantics.

---

## 15. Step 2.8 deferred compensation — CRITICAL

Step 2.8 established that durable `BookingRequested` remains authoritative even if Order changes after `send`; a Booking may therefore already exist when Order is later cancelled/incompatible.

Step 2.9 MUST explicitly audit this race:

`Order READY_FOR_BOOKING → send → BookingRequested durable → Order cancellation/race → Booking consumer creates/has created Booking`

Determine from existing ownership/contracts the correct compensation/reconciliation behavior.

Acceptable outcomes must be evidence-based, for example:

- Booking receives canonical cancellation/rejection command/event;
- Booking is retained in a terminal compensated state;
- Order cancellation is blocked after a certain Booking fact;
- another already-approved mechanism.

**Forbidden:** deleting the Booking, ignoring the inconsistency, or inventing cross-domain writes.

If no canonical source determines the correct compensation semantics, mark:

`ARCHITECTURE DECISION REQUIRED — ORDER/BOOKING CANCELLATION COMPENSATION`

and stop that part rather than guessing.

---

## 16. Change handling

Roadmap says “change/cancellation”. Do not interpret this as permission to build a full rescheduling/rebooking engine.

Audit existing change semantics:

- critical vs noncritical fields;
- status-only change;
- passenger corrections;
- supplier clarification;
- service occurrence change/reschedule;
- price-affecting change.

Rules:

- frozen commercial price cannot be mutated by a lifecycle action;
- frozen service occurrence from 2.8A cannot be silently rewritten;
- any reschedule requiring availability reallocation, repricing or new Quote/Sale is outside 2.9 unless an approved contract already defines it;
- no generic arbitrary Booking PATCH.

If only noncritical operational edits are canonically supported, keep scope to those and document deferred reschedule/change-order work.

---

## 17. Fulfillment / completion

Define Booking fulfillment from actual canonical evidence.

Requirements:

- valid predecessor states only;
- exactly one canonical completion/fulfilled event;
- terminal semantics explicit;
- no automatic payment settlement;
- no fabricated supplier evidence;
- Booking completion feeds Order reconciliation through event(s);
- one Booking completing must not necessarily fulfill a multi-item Order;
- Order fulfillment only when Order-owned reconciliation determines its own invariant.

Do not let Booking directly set `Order.status`.

---

## 18. Booking → Order feedback events — HARD GATE

Audit all Booking lifecycle events consumed by Order.

Expected categories may include canonical equivalents of:

- Booking confirmed;
- Booking rejected/problem;
- Booking cancelled;
- Booking fulfilled/completed;
- technical status change where justified.

Do not freeze names from this prompt if repository uses different approved names.

For each event document:

- producer;
- version;
- aggregate/entity id;
- exact payload whitelist;
- PII status;
- correlationId;
- causationId;
- consumer;
- idempotency mechanism;
- Order reconciliation result.

**Order owns Order status. Booking only publishes facts.**

---

## 19. Order reconciliation

Audit current `order.subscribers.ts` and related logic.

Preserve Step 2.7 invariants:

- Booking events may cause Order-owned reconciliation;
- Order status writes remain Order-owned;
- PARTIALLY_FULFILLED is derived from real Booking facts;
- FULFILLED is derived only when its invariant is met;
- Booking rejection may drive Order to a problem state only through Order-owned logic;
- generic `OrderStatusChanged` must not replace canonical facts;
- CAS prevents duplicate/contradictory transitions.

Add missing Booking events/handlers only when required by the canonical lifecycle.

---

## 20. Multi-item Order semantics

Test and document at minimum:

- Order with 1 Booking;
- Order with 2+ Bookings;
- one confirmed, others pending;
- one rejected, others confirmed;
- one completed, others active;
- all completed;
- cancellation race across siblings.

Do not derive Order fulfillment from `bookingCount > 0` or other fabricated shortcuts.

---

## 21. Event authority and live-state races

Durable business events already emitted are facts.

Do not reject a valid durable Booking event solely because a mutable upstream row later changed unless the approved contract explicitly requires such a gate.

Conversely, do not allow stale commands to overwrite newer Booking state.

Use:

- CAS/version checks;
- Inbox dedup;
- DB uniqueness;
- transactional Outbox;
- owner-service reconciliation.

---

## 22. Idempotency

For every lifecycle command/event path prove:

- duplicate HTTP retry;
- duplicate event delivery;
- concurrent same-action requests;
- concurrent conflicting actions;
- consumer restart/replay.

Business effect must occur once.

Do not broadly swallow Prisma `P2002`; only known invariant constraint names may be treated as idempotent no-op, consistent with Step 2.8.

---

## 23. Concurrency / CAS

Use the repository's established optimistic concurrency pattern.

At minimum test races relevant to actual transition matrix, such as:

- process vs cancel;
- confirm vs reject;
- confirm vs cancel;
- reject vs cancel;
- complete vs cancel;
- duplicate complete;
- Order cancel vs Booking create/confirm where applicable.

Expected behavior:

- one deterministic winner or documented reconciliation;
- loser gets controlled conflict/no-op;
- no duplicate history/event;
- no raw 500.

---

## 24. Transaction / Outbox atomicity

Every event-producing Booking transition must atomically commit:

`Booking state + Booking history + outbox event`

within one transaction.

If any required part fails, no partial lifecycle fact may remain.

Test rollback behavior.

---

## 25. Correlation / causation

Preserve ADR-0009/0010 conventions.

### HTTP command
- correlationId = server-authoritative request correlation UUID;
- causationId = null unless repository contract says otherwise;
- actor = authenticated USER.

### Consumer/result chain
- correlation inherited from parent event;
- causationId = parent eventId;
- actor = SYSTEM where consumer-generated.

Never use Booking code, Order code, client request-id, or random disconnected UUID as substitute lineage.

---

## 26. RBAC

Derive permissions from existing permission catalog and Screen Design.

Audit who may:

- start processing;
- request clarification;
- confirm;
- reject;
- cancel;
- complete;
- perform supported change action.

Do not grant universal Booking write to BUYER/PARTNER/MODERATOR unless an existing approved contract explicitly does so.

If supplier-facing role does not yet exist, do not fabricate one; use current operational role boundary and document future supplier portal scope.

Test all relevant roles.

---

## 27. IDOR / object scope

All Booking commands must be safe for:

- unknown Booking;
- inaccessible Booking;
- cross-partner/cross-buyer attempts if such routes exist;
- guessed business codes/UUIDs.

Follow existing neutral 404/403 conventions without leaking existence.

---

## 28. Mass assignment

Lifecycle endpoints must loudly reject forged server-owned fields according to established TravelHub convention.

Audit `BOOKING_ACTION_FORBIDDEN_KEYS` and extend only where necessary.

Protect at minimum relevant server-owned fields:

- id/code;
- order/orderItem/customer/partner provenance;
- status/version;
- amount/currency/acquisitionSource;
- service date/time/timezone/type/UTC instants;
- lifecycle milestones;
- audit/history/event metadata;
- child graph IDs;
- payment/finance fields.

Expected forged-key behavior: 422 where project convention applies, not silent stripping.

---

## 29. Frozen acquisition source

Lifecycle must preserve `Booking.acquisitionSource` verbatim for:

- DIRECT;
- BUYER_REQUEST;
- legacy null;
- any other already-supported canonical value.

No lifecycle transition may infer/recalculate source.

Test full lifecycle with at least DIRECT + BUYER_REQUEST + legacy null where possible.

---

## 30. Frozen money / pricing

Booking lifecycle MUST NOT:

- re-read current Tariff to change amount;
- resolve CommercialPeriod again;
- re-run restrictions as a repricing mechanism;
- change currency;
- apply discount/tax/commission;
- create Finance facts.

Step 2.11/Finance own later financial snapshot/ledger semantics.

Regression must prove Booking amount/currency unchanged through lifecycle.

---

## 31. Service occurrence immutability — Step 2.8A regression

Preserve:

- `serviceDate`;
- `serviceTime`;
- `serviceEndTime`;
- `serviceTimeZone`;
- `serviceTimeType`;
- `serviceStartsAt`;
- `serviceEndsAt`.

Lifecycle must not re-derive UTC instants or use browser/server-local timezone.

Any true reschedule/change of service occurrence requires a separately justified workflow; do not smuggle it into generic lifecycle PATCH.

---

## 32. Availability isolation

Audit all Booking lifecycle code for writes to Catalog Availability/Reservation.

Requirements:

- Booking creation/lifecycle does not create a second hold;
- confirmation does not decrement capacity again;
- completion does not decrement again;
- cancellation/rejection release behavior must follow existing owner contract only;
- no second inventory engine.

If release/compensation ownership is undefined and Step 2.9 requires it, raise architecture decision instead of guessing.

---

## 33. PII minimization

Lifecycle events must contain only canonical references/minimum facts.

Do not emit:

- passport numbers;
- raw traveler profiles;
- email/phone unless explicitly required by approved event contract;
- arbitrary notes/comments;
- full Booking/Order serialization.

Audit event payloads recursively.

---

## 34. Booking history / audit

History must record only real successful transitions.

At minimum capture existing canonical fields such as:

- from status;
- to status;
- action/reason code where supported;
- actor/ref;
- occurredAt/current history timestamp contract.

Do not fabricate Step 2.9A milestone timestamps.

Failed/stale/conflicting commands create no success history.

Security AuditLog and domain BookingHistory remain distinct concerns.

---

## 35. Step 2.9A boundary — HARD GATE

Roadmap explicitly makes Step 2.9A separate:

`createdAt`, `requestedAt`, `confirmedAt`, `rejectedAt`, `cancelledAt`, `completedAt`, history/SLA timestamps.

Therefore Step 2.9 must:

- implement lifecycle semantics now;
- preserve any already-existing timestamps;
- avoid inventing a complete new persisted temporal/SLA model unless technically unavoidable;
- document what temporal facts already exist and what remains for 2.9A.

At completion, Roadmap NEXT should be:

`PHASE 2 — STEP 2.9 — STRICT REVIEW`

not Step 2.9A yet.

---

## 36. Legacy compatibility

Existing Booking rows may lack newer provenance/time fields.

Prove that legacy rows remain:

- readable;
- manageable where lifecycle invariants allow;
- not destructively backfilled with fabricated facts;
- not assigned fake acquisition source/timezone/milestones;
- compatible with nullable `orderItemId` where historical schema permits.

No destructive migration.

---

## 37. Migration policy

Schema change is allowed only if Step 2.9 genuinely requires it.

If migration is needed:

- additive by default;
- nullable/backward-compatible where possible;
- no fake historical backfill;
- no `db push` as substitute for migration;
- fresh migration replay must pass;
- drift = 0.

If existing schema already supports lifecycle, explicitly state `Migration: N/A` and prove why.

---

## 38. API contract

Update `docs/contracts/api.md` for actual Booking lifecycle endpoints/actions.

Document:

- endpoint;
- permission;
- request DTO;
- allowed transitions;
- 400/403/404/409/422 semantics;
- optimistic concurrency/version if exposed;
- forbidden server-owned keys;
- response projection;
- privacy/object-scope rules.

No generic `PATCH status=<anything>` contract.

---

## 39. Events contract

Update `docs/contracts/events.md` for every canonical Booking lifecycle event and Booking → Order feedback event.

Document exact payload whitelist and lineage.

Do not claim an event exists unless production emits it.
Do not leave undocumented production events introduced by this step.

---

## 40. Architecture artifact

Create/update:

`docs/architecture/booking-lifecycle-completion.md`

It must contain:

1. purpose;
2. current→target reconciliation;
3. final status vocabulary;
4. transition matrix;
5. command ownership;
6. event matrix;
7. Booking→Order reconciliation;
8. cancellation compensation assessment;
9. multi-item semantics;
10. concurrency/idempotency;
11. money/acquisition/service-time invariants;
12. availability ownership;
13. PII boundary;
14. legacy compatibility;
15. Step 2.9A boundary;
16. known deferred work.

---

## 41. Mandatory negative tests

Add/reconcile tests for at least:

1. anonymous lifecycle command → 401;
2. unauthorized role → 403;
3. unknown Booking → neutral 404;
4. invalid transition → 409;
5. duplicate confirmation → controlled conflict/no duplicate event;
6. duplicate rejection → no duplicate effect;
7. duplicate cancellation → no duplicate effect;
8. duplicate completion → no duplicate effect;
9. confirm from terminal state → 409;
10. complete before allowed state → 409;
11. reopen terminal Booking → rejected;
12. forged status → 422/established convention;
13. forged amount/currency → 422;
14. forged acquisitionSource → 422;
15. forged service temporal fields → 422;
16. forged provenance/orderItemId → 422;
17. malformed action → 400/422;
18. stale version → 409 if versioned command contract applies;
19. failed transition → zero history/event;
20. PII absent from lifecycle events;
21. no direct Order write from Booking service/controller;
22. no second availability hold;
23. no reprice;
24. no Finance side effect;
25. unknown unique P2002 is not swallowed as idempotent success.

---

## 42. Mandatory positive / race tests

Cover all applicable scenarios from the repository-derived state machine:

1. BookingRequested creates initial Booking — regression;
2. initial → processing;
3. clarification entry;
4. clarification resume/resolve if supported;
5. processing → confirmed;
6. exactly one confirmation event;
7. rejection valid path;
8. exactly one rejection event;
9. cancellation valid path;
10. exactly one cancellation event;
11. completion valid path;
12. exactly one completion event;
13. Booking confirmation feeds Order without Booking writing Order directly;
14. Booking rejection feeds Order reconciliation;
15. Booking completion feeds Order partial/full fulfillment correctly;
16. 2+ Booking Order: one completed ≠ Order fulfilled;
17. all required Bookings completed → Order reconciliation reaches canonical result;
18. DIRECT acquisition immutable;
19. BUYER_REQUEST acquisition immutable;
20. legacy null acquisition preserved;
21. amount/currency immutable;
22. service occurrence immutable;
23. availability reservation count unchanged by lifecycle;
24. legacy Booking lifecycle;
25. correlation/causation exact;
26. concurrent confirm vs reject;
27. concurrent confirm vs cancel;
28. concurrent complete vs cancel;
29. duplicate event delivery;
30. consumer replay/restart idempotency;
31. Order-cancel vs BookingRequested/Booking-create race;
32. Order-cancel after Booking exists — canonical compensation or explicit architecture block;
33. rollback atomicity;
34. no raw 500.

If a listed scenario is not applicable because the canonical state machine does not contain that action, explicitly mark `N/A — canonical action absent` rather than inventing it.

---

## 43. Regression gates

Run actual commands and report exact counts.

### Backend
- TypeScript typecheck;
- build;
- all unit tests;
- targeted Step 2.9 e2e;
- full serial e2e suite.

### Mandatory regression areas
- Step 2.7 Order lifecycle;
- Step 2.8 BookingRequested consumer;
- Step 2.8A service-time model;
- acquisition propagation;
- Reverse Marketplace → Booking path;
- pricing/restrictions 1.8A–D;
- availability;
- RBAC/IDOR;
- PII/event envelope;
- Buyer Cabinet/read models;
- legacy compatibility.

### Frontend
Even if frontend is untouched:
- `tsc --noEmit`;
- vitest;
- production build.

### DB
- migration status;
- fresh replay;
- drift 0.

Never report tests as PASS unless actually executed.

---

## 44. Architecture stop conditions

STOP and report `ARCHITECTURE DECISION REQUIRED` if any of these occur:

1. canonical sources disagree on Booking status vocabulary;
2. two production components own conflicting Booking state machines;
3. clarification/change semantics require inventing a new domain workflow;
4. Order cancellation after durable BookingRequested/Booking has no determinable compensation rule;
5. cancellation/rejection requires availability release but ownership is undefined/conflicting;
6. fulfillment authority conflicts between explicit command and supplier/reconciliation facts;
7. implementing Step 2.9 requires silently beginning Finance/Refund;
8. implementing change requires repricing/re-hold/reschedule architecture not defined;
9. Step 2.9 requires incompatible change to Step 2.8A frozen service occurrence;
10. Step 2.9A temporal semantics must be invented to make lifecycle work;
11. legacy compatibility requires destructive migration;
12. safe implementation would require Booking to directly mutate Order tables.

Do not paper over an architecture conflict with tests.

---

## 45. Required implementation report

At the end produce a report with these exact sections:

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target reconciliation
5. Booking write-path audit
6. State-machine authority
7. Final status codes
8. Transition matrix
9. Initial state
10. Supplier processing
11. Clarification semantics
12. Confirmation
13. Rejection
14. Cancellation
15. Order/Booking cancellation compensation
16. Change handling
17. Fulfillment/completion
18. Canonical Booking events
19. Booking → Order feedback
20. Order reconciliation
21. Multi-item Order semantics
22. Event authority / races
23. Idempotency
24. Concurrency / CAS
25. Transaction / Outbox atomicity
26. Correlation / causation
27. RBAC
28. IDOR / object scope
29. Mass assignment
30. Acquisition immutability
31. Money/pricing immutability
32. Service occurrence immutability
33. Availability isolation
34. PII
35. History / audit
36. Step 2.9A boundary
37. Legacy compatibility
38. Migration / DB
39. API/docs
40. Events docs
41. Targeted negative tests
42. Targeted positive/race tests
43. Backend regression
44. Frontend regression
45. DB regression
46. Issues found
47. Fixes applied
48. Architecture decision status
49. Out-of-scope confirmation
50. Exact files changed
51. Roadmap update
52. Exact NEXT item

---

## 46. Verdict rules

Use exactly one:

### Success
`PHASE 2 STEP 2.9 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

### Success with implementation fixes
`PHASE 2 STEP 2.9 IMPLEMENTATION COMPLETED WITH FIXES — WAITING FOR STRICT REVIEW`

### Architecture block
`PHASE 2 STEP 2.9 BLOCKED — ARCHITECTURE DECISION REQUIRED`

### Failed
`PHASE 2 STEP 2.9 IMPLEMENTATION FAILED`

Implementation is NOT approval.
Only a separate Strict Review may mark Step 2.9 approved.

---

## 47. Roadmap update rule

If implementation succeeds, update Roadmap only to:

**Step 2.9 — IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW**

and set exact NEXT to:

**PHASE 2 — STEP 2.9 — STRICT REVIEW**

Do NOT mark Step 2.9 APPROVED.
Do NOT start Step 2.9A.

After future Strict Review approval, the sequence becomes:

`Step 2.9A — Booking Temporal Contract`

---

## 48. Non-negotiable invariants

1. Booking is created only from canonical `BookingRequested`.
2. Booking lifecycle is Booking-owned.
3. Order lifecycle is Order-owned.
4. Booking communicates upstream through canonical events, never direct Order writes.
5. Frozen commercial money is immutable.
6. Acquisition source is immutable.
7. Step 2.8A service occurrence is immutable during ordinary lifecycle.
8. Booking lifecycle does not create a second availability hold.
9. Rejection ≠ cancellation ≠ fulfillment.
10. Durable events are not erased by later mutable state.
11. History/events are emitted only for real transitions.
12. State + history + outbox are atomic.
13. Retry/concurrency cannot duplicate business facts.
14. PII does not leak into durable event payloads.
15. Finance/refund is not invented in Step 2.9.
16. Step 2.9A remains separate.
17. Legacy rows are preserved without fabricated backfill.
18. No raw 500 for expected business conflicts.

---

# FINAL EXECUTION INSTRUCTION

Implement **PHASE 2 — STEP 2.9 — BOOKING LIFECYCLE COMPLETION** against the actual repository.

Do not merely add tests around existing behavior. First reconcile the real state machine, writers, events and Order feedback against the canonical Roadmap and approved Steps 2.7/2.8/2.8A; then implement every justified missing piece, harden races/security/atomicity, update contracts and architecture docs, run full regression, and produce the complete §45 report.

If cancellation compensation, change semantics, availability release ownership, or any other hard-gate item is genuinely ambiguous, stop that portion with `ARCHITECTURE DECISION REQUIRED` rather than inventing domain semantics.

**Do not perform Step 2.9 Strict Review in the same pass.**
