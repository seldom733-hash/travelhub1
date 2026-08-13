# PHASE 2 --- STEP 2.7 --- ORDER LIFECYCLE COMPLETION

## STRICT IMPLEMENTATION PROMPT

**Project:** TravelHub\
**Phase:** 2\
**Step:** 2.7 --- Order Lifecycle Completion\
**Mode:** IMPLEMENTATION\
**Previous gate:**
`PHASE 2 STEP 2.6 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`\
**Canonical next implementation step after separate Strict Review:**
Step 2.8 --- `BookingRequested → Booking Creation`\
**Hard stop:** Step 2.8 MUST NOT be implemented in this pass.

------------------------------------------------------------------------

# 1. MISSION

Implement the canonical backend Order lifecycle required by Step 2.7.

Current Roadmap definition:

> **Order Lifecycle Completion** --- backend lifecycle, stable codes,
> guards, history, SLA, `OrderReadyForBooking`, `BookingRequested`,
> `OrderFulfilled`, `OrderClosed`.

Complete the **Order-owned lifecycle and canonical business events**. Do
**not** create Booking: Booking creation belongs exclusively to Step
2.8.

Canonical boundary:

`Sale → OrderRequested → Order → Step 2.7 Order lifecycle → OrderReadyForBooking → explicit “Send to Booking Center” → BookingRequested → STOP`

Only Step 2.8 may implement `BookingRequested → Booking` creation.

------------------------------------------------------------------------

# 2. SOURCE-OF-TRUTH ORDER

Before changing code inspect and reconcile:

1.  current `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
2.  current authoritative Architecture Master / frozen Baseline;
3.  ADRs affecting Order ownership, lifecycle, events, RBAC, temporal
    facts and cross-domain boundaries;
4.  Step 1.14 Canonical Order Events implementation + Strict Review;
5.  Step 2.5 Order creation consumer implementation + review;
6.  Step 2.5A Order Temporal Contract implementation + review;
7.  Step 2.5B Acquisition Propagation implementation + review;
8.  Step 2.6 implementation + Strict Review;
9.  existing Order schema/service/controller/history/events/tests;
10. existing Booking module and `BookingRequested` consumers, without
    implementing Step 2.8.

Priority on conflict:

**current canonical Roadmap / approved ADR → current Architecture
Baseline → approved step contracts/reviews → current implementation.**

If a required lifecycle/business rule cannot be reconciled without
changing frozen architecture, return:

`ARCHITECTURE DECISION REQUIRED`

and STOP rather than inventing semantics.

------------------------------------------------------------------------

# 3. CRITICAL SCOPE BOUNDARY --- 2.7 ≠ 2.8

## Step 2.7 owns

-   Order lifecycle state machine;
-   transition guards;
-   stable backend status codes;
-   lifecycle history;
-   SLA foundation required by Roadmap;
-   Order-owned milestone timestamps;
-   `OrderReadyForBooking`;
-   explicit `BookingRequested` publication;
-   `OrderFulfilled`;
-   `OrderClosed`;
-   idempotency/concurrency of Order actions;
-   Order RBAC/action authorization;
-   Order event lineage.

## Step 2.7 does NOT own

-   Booking creation;
-   Booking lifecycle;
-   supplier processing;
-   Booking service date/time model;
-   Finance/Payment;
-   Documents implementation;
-   frontend Order Center;
-   new pricing or availability engine.

The Roadmap separately defines Step 2.8 as
`BookingRequested → Booking Creation`. Do not collapse these steps.

------------------------------------------------------------------------

# 4. REPOSITORY BASELINE

Before implementation report:

-   branch and HEAD;
-   relation to origin/master;
-   dirty/untracked files;
-   migration count/status;
-   current Roadmap status;
-   whether Step 2.6 changes/review fixes are committed;
-   pre-existing Step 2.7-like code.

Separate Phase 1 scaffolding and legacy behavior from actual new Step
2.7 changes.

------------------------------------------------------------------------

# 5. CURRENT → TARGET MAPPING

Before coding build an explicit matrix for every existing Order
status/action/event.

Known Screen Design Baseline backend codes include:

`NEW`, `IN_PROCESSING`, `WAITING_FOR_DATA`, `READY_FOR_BOOKING`,
`SENT_TO_BOOKING`, `PARTIALLY_FULFILLED`, `FULFILLED`, `READY_TO_CLOSE`,
`CLOSED`, `CANCELLED`, `PROBLEM`, `SUSPENDED`.

Do **not** blindly add missing enum values from this prompt. Reconcile
them against current canonical sources and existing schema first.

For each status document:

-   meaning;
-   allowed predecessor(s);
-   allowed next state(s);
-   action/command;
-   guard(s);
-   actor/permission;
-   milestone timestamp;
-   history action;
-   canonical event(s);
-   terminal/non-terminal semantics.

------------------------------------------------------------------------

# 6. SINGLE AUTHORITATIVE STATE MACHINE

Implement one authoritative transition model. Do not scatter lifecycle
rules across controller/service/consumer branches.

Prove arbitrary transitions are impossible unless explicitly canonical,
including examples such as:

-   `NEW → CLOSED`;
-   `CANCELLED → READY_FOR_BOOKING`;
-   `CLOSED → IN_PROCESSING`;
-   `FULFILLED → NEW`.

Invalid transitions must produce controlled project-standard 409/422
responses, never raw DB errors.

Stable machine codes must not be localized UI labels. Existing persisted
legacy states must remain readable.

------------------------------------------------------------------------

# 7. ORDER CREATION ENTRY STATE REGRESSION

Preserve Step 2.6 invariant:

`OrderRequested → canonical consumer` is the only normal production
Order writer.

New Order must:

-   be created exactly once;
-   enter the approved initial status (currently reported `NEW`);
-   preserve 2.5A `submittedAt` semantics;
-   preserve frozen money/commercial/acquisition facts;
-   not automatically become READY_FOR_BOOKING;
-   not emit BookingRequested;
-   not create Booking.

Do not reintroduce any direct Order-create path.

------------------------------------------------------------------------

# 8. PROCESSING / WAITING FOR DATA

Reconcile existing processing actions.

For `NEW → IN_PROCESSING` define exact guard, actor, history, audit and
idempotency.

If `WAITING_FOR_DATA` is canonical/currently supported, define how Order
enters/leaves it and how blockers affect readiness. Do not invent a
generic reason/workflow engine. Avoid PII in history/audit metadata.

------------------------------------------------------------------------

# 9. READY_FOR_BOOKING --- CORE GATE

Implement/reconcile the authoritative transition to `READY_FOR_BOOKING`.

Meaning:

> Order has passed Order-owned readiness checks and is eligible to be
> explicitly handed to Booking Center.

On the real transition:

-   persist status;
-   persist applicable milestone/history;
-   emit exactly one `OrderReadyForBooking`;
-   preserve correlation/causation;
-   commit state + history + Outbox atomically.

Retry/idempotent calls must not emit a second logical event.

------------------------------------------------------------------------

# 10. READINESS GUARDS

Implement only guards justified by current approved architecture.
Inspect, do not guess.

Potential categories to verify from source:

-   valid Order items;
-   required traveler data completeness;
-   frozen commercial facts;
-   no terminal/cancelled/suspended/problem blocker;
-   required service context;
-   required reservation reference where approved.

Do not invent:

-   payment-before-booking requirement;
-   document-before-booking requirement;
-   supplier confirmation before Booking exists;
-   new availability checks belonging to 2.8/2.8A;
-   repricing.

For each guard state its authoritative source in the final report.

------------------------------------------------------------------------

# 11. `OrderReadyForBooking` EVENT

Use the canonical Step 1.14 event contract.

Verify exact:

-   event name;
-   aggregate type/id;
-   payload;
-   schemaVersion;
-   occurredAt;
-   actor;
-   requestId where applicable;
-   correlationId;
-   causationId.

It is emitted only when Order **actually transitions** to
READY_FOR_BOOKING. Never emit from GET/current-state reconstruction or
on a retry with no new transition.

------------------------------------------------------------------------

# 12. EXPLICIT "SEND TO BOOKING CENTER" COMMAND

Architecture Baseline requires:

> `BookingRequested` only by explicit command "Send to Booking Center"
> from READY_FOR_BOOKING.

Implement/reconcile a clear Order-owned command/action:

-   allowed only from READY_FOR_BOOKING;
-   Order identity/state derived server-side;
-   no client-forged event payload;
-   authorized operational role only;
-   lifecycle transition + history + Outbox atomic;
-   retry-safe;
-   concurrency-safe;
-   exactly one logical BookingRequested per canonical handoff.

Reconcile the post-command Order status with current canonical lifecycle
(`SENT_TO_BOOKING` if still authoritative). Do not guess if approved
sources disagree.

------------------------------------------------------------------------

# 13. `BookingRequested` HARD BOUNDARY

`BookingRequested` is a request/command boundary from Order to Booking.
It is not:

-   `OrderReadyForBooking`;
-   `BookingCreated`;
-   supplier confirmation;
-   payment authorization;
-   availability reservation creation.

Payload must contain only approved facts Booking needs. Review Order
identity, item/service identity, traveler snapshot/ref, acquisition,
frozen service/commercial context and lineage according to current
contract. Do not dump cross-domain objects.

**Order module must not directly write Booking tables.**

------------------------------------------------------------------------

# 14. `OrderApproved` RECONCILIATION

Architecture Baseline explicitly says:

> `OrderApproved` is not the trigger for Booking creation.

Audit every production producer/consumer of `OrderApproved` and classify
it:

A. legitimate historical/notification event; B. obsolete alias; C.
incorrectly substituting READY_FOR_BOOKING; D. incorrectly triggering
BookingRequested/Booking.

Do not remove supported behavior blindly. But canonical handoff must
remain:

`READY_FOR_BOOKING → explicit send command → BookingRequested`.

If frozen architecture must change, return
`ARCHITECTURE DECISION REQUIRED`.

------------------------------------------------------------------------

# 15. GENERIC `OrderStatusChanged` AUDIT

Find every producer and consumer of `OrderStatusChanged`.

Classify each use as:

1.  legitimate generic notification/history;
2.  accidental substitute for canonical business event;
3.  dead/obsolete.

Known canonical facts must not be inferred downstream from generic
status strings when dedicated events exist:

-   OrderReadyForBooking;
-   BookingRequested;
-   OrderFulfilled;
-   OrderClosed.

Preserve generic event only where it has a distinct valid contract.

------------------------------------------------------------------------

# 16. PRE-EXISTING `BookingRequested` CONSUMER --- CRITICAL

Step 2.6 review confirmed pre-existing
`OrderReadyForBooking`/`BookingRequested` references from Step 1.14.

Audit current BookingRequested consumers.

If a pre-existing consumer already creates Booking:

-   identify its origin/status;
-   compare it to current Roadmap, which reserves Booking creation for
    Step 2.8;
-   do not expand/redesign it in Step 2.7;
-   do not falsely claim Step 2.8 completed;
-   do not delete approved behavior merely to make tests look isolated.

If current approved runtime and Roadmap are irreconcilable, return
`ARCHITECTURE DECISION REQUIRED`.

------------------------------------------------------------------------

# 17. SENT_TO_BOOKING

If still canonical:

-   enter only via successful explicit handoff;
-   no arbitrary status patch;
-   duplicate send is deterministic/idempotent;
-   no duplicate BookingRequested;
-   no return to READY_FOR_BOOKING unless an approved recovery
    transition exists;
-   history distinguishes "ready" from "sent".

Do not implement new BookingCreated reconciliation in this step.

------------------------------------------------------------------------

# 18. PARTIAL FULFILLMENT

Inspect current `PARTIALLY_FULFILLED` semantics. Do not infer it merely
from item count, Booking existence, payment, service date or arbitrary
operator action.

Preserve existing approved Booking-event reconciliation if present. If
full semantics require Step 2.9, keep compatibility without inventing
future workflow.

------------------------------------------------------------------------

# 19. FULFILLED + `OrderFulfilled`

`OrderFulfilled` means Order obligations are actually fulfilled
according to canonical Order lifecycle.

Requirements:

-   only on real transition to FULFILLED;
-   set `fulfilledAt` on that transition only;
-   exactly one logical OrderFulfilled;
-   history + event atomic;
-   retries do not move milestone;
-   do not infer from `updatedAt`, payment, serviceDate or frontend-only
    action.

If driven by approved Booking events, Order remains owner of its own
state while consuming approved cross-domain facts.

Do not implement Step 2.9 supplier workflow.

------------------------------------------------------------------------

# 20. READY_TO_CLOSE / CLOSED + `OrderClosed`

Do not equate FULFILLED, READY_TO_CLOSE and CLOSED.

Determine exact current guard for READY_TO_CLOSE from approved sources.
If it depends on future Finance/Documents policy that is not defined, do
not invent it.

`OrderClosed` is emitted only after the canonical close
command/transition:

-   allowed predecessor(s) only;
-   set `closedAt` once;
-   history;
-   exactly one OrderClosed;
-   atomic Outbox;
-   retry-safe;
-   CLOSED cannot silently reopen.

CANCELLED/FULFILLED/archived/rejected must not be treated as CLOSED if
architecture distinguishes them.

------------------------------------------------------------------------

# 21. CANCELLATION / PROBLEM / SUSPENDED

Preserve/reconcile cancellation:

-   allowed source states;
-   forbidden terminal-state cancellation;
-   `cancelledAt` only on real transition;
-   history/audit;
-   idempotency;
-   existing canonical cancellation event;
-   no automatic Finance/Refund behavior;
-   no invented Booking cancellation orchestration.

For PROBLEM/SUSPENDED, implement only already-supported lifecycle
semantics. Do not create speculative support/case workflow.

------------------------------------------------------------------------

# 22. TEMPORAL CONTRACT --- 2.5A

Preserve exact semantics of:

-   `createdAt`;
-   `submittedAt`;
-   `confirmedAt` where still canonical;
-   `cancelledAt`;
-   `fulfilledAt`;
-   `closedAt`.

Rules:

-   server-owned;
-   set only on real transition;
-   immutable after first occurrence unless approved otherwise;
-   retries do not move milestone time;
-   history/events use `occurredAt`;
-   `updatedAt` is never a business milestone.

Do not add duplicate timestamps with the same meaning.

------------------------------------------------------------------------

# 23. HISTORY / AUDIT

Every meaningful Order lifecycle transition must create canonical
history with approved minimal metadata such as:

-   fromStatus;
-   toStatus;
-   action;
-   actor;
-   occurredAt;
-   reason where already supported;
-   request/correlation metadata where appropriate.

Do not dump traveler PII, full DTOs, Quote payloads, payment data or
secrets.

Keep Security audit and domain history distinct according to existing
conventions.

------------------------------------------------------------------------

# 24. SLA FOUNDATION

Roadmap explicitly includes **SLA** in Step 2.7.

Inspect whether an SLA model/policy already exists. Implement the
smallest canonical scope supported by current architecture, potentially
using existing deadline/dueAt/status-entered/overdue facts.

Do not invent arbitrary SLA durations or a generic rules engine.

At minimum, lifecycle history and immutable transition timestamps must
make later SLA calculation deterministic.

If Roadmap requires persisted SLA deadlines but no authoritative
calculation policy exists:

`ARCHITECTURE DECISION REQUIRED`.

Final report must explain exactly what "SLA" means in the implemented
Step 2.7.

------------------------------------------------------------------------

# 25. RBAC / OBJECT SCOPE

Reconcile current Order permissions.

Baseline principles:

-   OPERATOR is primary operational Order/Booking role;
-   SALES_MANAGER does not receive universal `order:write`;
-   BUYER/PARTNER remain object-scoped/read-only according to approved
    contracts;
-   ADMIN follows current RBAC architecture.

Test anonymous, BUYER, PARTNER, SALES_MANAGER, OPERATOR, ADMIN and
MODERATOR where relevant.

Test guessed/foreign Order IDs and follow existing neutral 404/403
security conventions.

------------------------------------------------------------------------

# 26. MASS ASSIGNMENT

Lifecycle APIs must be command/action oriented, not arbitrary status
patching.

Client must not directly set:

-   status;
-   milestone timestamps;
-   IDs/codes/order number;
-   buyer/customer/partner;
-   Sale/Quote/Checkout refs;
-   money/currency;
-   acquisition;
-   reservation refs;
-   history;
-   event IDs;
-   correlation/causation;
-   version;
-   SLA server facts.

Forbidden system keys must fail according to project convention.

------------------------------------------------------------------------

# 27. CONCURRENCY / CAS / IDEMPOTENCY

Use existing project concurrency conventions.

Test meaningful races:

-   process vs cancel;
-   ready vs cancel;
-   duplicate ready;
-   duplicate send-to-booking;
-   send-to-booking vs cancel;
-   fulfill vs cancel;
-   close vs competing action.

Expected business invariant:

-   one legal winner where actions conflict;
-   controlled conflict/no-op for loser;
-   no double milestones;
-   no duplicate history for one real transition;
-   no duplicate canonical event;
-   no raw P2002/P2025/500.

Repeated same command may be no-op success or controlled conflict
according to existing convention, but business effect must occur once.

------------------------------------------------------------------------

# 28. TRANSACTION / OUTBOX ATOMICITY

For every transition with canonical event:

`Order state + milestone + history + Outbox event`

must commit atomically.

Failure before commit must leave no partial lifecycle state. Use
existing EventBus/Outbox architecture; never emit externally before DB
commit.

Add failure-path tests using existing project patterns where practical.

------------------------------------------------------------------------

# 29. CORRELATION / CAUSATION

Preserve approved event lineage.

For each of:

-   OrderReadyForBooking;
-   BookingRequested;
-   OrderFulfilled;
-   OrderClosed;

report exact `correlationId` and `causationId` derivation.

Do not fabricate correlation from Order ID or substitute requestId for
causation.

------------------------------------------------------------------------

# 30. ACQUISITION / MONEY / PRICING IMMUTABILITY

Lifecycle must never rewrite acquisition or commercial amount.

Verify at least DIRECT and one non-DIRECT source such as BUYER_REQUEST
where supported.

No transition may:

-   infer a new acquisition source;
-   re-read current Tariff price;
-   re-resolve CommercialPeriod;
-   re-evaluate CommercialRestriction into a new amount;
-   change Order total/currency;
-   perform FX conversion.

Run 1.8A--1.8D regressions.

------------------------------------------------------------------------

# 31. AVAILABILITY ISOLATION

Order lifecycle must not create a second capacity reservation.

Audit READY_FOR_BOOKING, SEND_TO_BOOKING, FULFILLED, CLOSED and
CANCELLED for hidden availability writes.

Do not invent release/consume semantics that belong to later
Booking/availability owner steps. Preserve existing approved event
boundary where one already exists.

------------------------------------------------------------------------

# 32. BOOKING OWNERSHIP --- HARD GATE

Order owns Order. Booking owns Booking.

Step 2.7 may publish BookingRequested but must introduce **zero new
direct Booking writes** from Order code.

Repository-wide audit new/changed code for:

-   `booking.create`;
-   `booking.update`;
-   Booking history writes;
-   supplier booking writes.

Any new cross-domain write is a hard failure.

------------------------------------------------------------------------

# 33. EVENT CONTRACT MATRIX

Audit and report current producer/trigger/payload/consumer/status for:

-   OrderCreated;
-   OrderReadyForBooking;
-   BookingRequested;
-   OrderFulfilled;
-   OrderClosed;
-   existing cancellation event;
-   OrderStatusChanged;
-   OrderApproved.

Preserve schemaVersion convention. If payload changes are incompatible
with frozen contract, stop for ADR rather than silently reinterpret v1.

------------------------------------------------------------------------

# 34. LEGACY COMPATIBILITY

Preserve Step 2.6 guarantee that legacy bootstrap-created Orders remain
usable.

Test lifecycle against:

-   canonical Order with Sale refs;
-   legacy Order missing newer provenance;
-   legacy nullable temporal/acquisition facts where supported.

Do not require destructive backfill unless canonically necessary.

------------------------------------------------------------------------

# 35. DATABASE / MIGRATION

Prefer additive migration.

If Step 2.7 requires schema changes for status, SLA, CAS/version,
history or event support:

-   use Prisma migration;
-   no `db push`;
-   fresh-deploy safe;
-   preserve existing data;
-   correct indexes/FKs;
-   clean migration replay;
-   repository-supported drift check.

If no migration is needed, prove why.

------------------------------------------------------------------------

# 36. API / FRONTEND

Use existing Order API conventions. Prefer explicit actions/commands
over generic mutable status.

Update `docs/contracts/api.md` and relevant event/lifecycle docs.

Do **not** implement frontend Order Center in Step 2.7. Only keep
existing frontend compiling and update shared types if unavoidable and
backward-compatible.

------------------------------------------------------------------------

# 37. REQUIRED TARGETED E2E

Create/extend Step 2.7 E2E tests. Cover all canonical equivalents of the
following:

1.  canonical Order starts in NEW;
2.  NEW → IN_PROCESSING;
3.  invalid NEW → CLOSED rejected;
4.  WAITING_FOR_DATA path if canonical;
5.  readiness guard failure;
6.  valid transition → READY_FOR_BOOKING;
7.  exactly one OrderReadyForBooking;
8.  retry ready no duplicate event;
9.  only READY_FOR_BOOKING can send to Booking Center;
10. send emits BookingRequested;
11. expected post-handoff Order status;
12. exactly one BookingRequested;
13. duplicate send no duplicate effect;
14. concurrent duplicate send;
15. unauthorized BUYER;
16. unauthorized PARTNER;
17. SALES_MANAGER permissions exact;
18. OPERATOR permissions exact;
19. ADMIN behavior exact;
20. IDOR/unknown Order;
21. forged system/status fields rejected;
22. valid cancellation;
23. invalid cancellation;
24. cancelled Order cannot become ready;
25. valid fulfillment path;
26. exactly one OrderFulfilled;
27. invalid fulfillment;
28. READY_TO_CLOSE path if canonical;
29. valid close;
30. exactly one OrderClosed;
31. invalid close;
32. CLOSED cannot reopen;
33. milestone timestamps exact;
34. history exact;
35. correlation/causation exact;
36. acquisition unchanged;
37. money unchanged;
38. no second availability hold;
39. no new direct Booking write by Order module;
40. legacy Order compatibility;
41. conflicting transition race;
42. rollback/failure atomicity;
43. invalid transition never raw 500.

If a listed transition is not canonical after source reconciliation,
replace it with the correct canonical equivalent and explain why. Do not
fabricate behavior to satisfy test numbering.

------------------------------------------------------------------------

# 38. REQUIRED EVENT TESTS

Prove separately:

## OrderReadyForBooking

-   only real transition;
-   one event;
-   correct state/history/envelope.

## BookingRequested

-   only explicit send command;
-   only from READY_FOR_BOOKING;
-   one event;
-   correct payload/lineage;
-   no new direct Booking write in Order module.

## OrderFulfilled

-   only real fulfillment transition;
-   `fulfilledAt` exact;
-   one event.

## OrderClosed

-   only real close transition;
-   `closedAt` exact;
-   one event.

Also prove `OrderApproved` does not trigger canonical booking handoff
unless an approved ADR explicitly says otherwise.

------------------------------------------------------------------------

# 39. REQUIRED PREVIOUS-STEP REGRESSION

Run targeted regression for:

-   Step 1.14 Canonical Order Events;
-   Step 2.4 Sale completion;
-   Step 2.5 Order creation consumer;
-   Step 2.5A Order Temporal Contract;
-   Step 2.5B Acquisition Propagation;
-   Step 2.6 Remove Bootstrap;
-   Reverse 2.2F relevant conversion;
-   1.8A ServiceUnit;
-   1.8B RatePlan;
-   1.8C CommercialPeriod;
-   1.8D CommercialRestrictions;
-   availability reservation;
-   RBAC/security;
-   PII/event envelope;
-   Buyer Cabinet/Order reads where affected.

Report exact counts.

------------------------------------------------------------------------

# 40. FULL REGRESSION

Before completion run independently:

## Backend

-   TypeScript compile/build;
-   full unit suite;
-   targeted Step 2.7 suite;
-   full serial E2E.

## Frontend

-   TypeScript;
-   vitest;
-   production build.

## Database

-   migrate status;
-   fresh migration replay;
-   supported drift verification.

Report actual current counts; do not copy prior counts.

------------------------------------------------------------------------

# 41. ADVERSARIAL SELF-REVIEW

Before final report search for:

-   arbitrary status patching;
-   duplicate transition logic;
-   duplicate Outbox emission;
-   client-owned timestamps/event payload;
-   missing CAS;
-   status races;
-   raw DB 500s;
-   cross-domain Booking writes;
-   second availability hold;
-   repricing;
-   acquisition mutation;
-   PII in events/history/audit;
-   OrderApproved incorrectly triggering Booking;
-   OrderStatusChanged substituting canonical events;
-   Step 2.8 accidentally implemented;
-   frontend scope creep;
-   dead legacy actions.

Fix architecture-neutral local defects and add regression tests before
reporting.

------------------------------------------------------------------------

# 42. ARCHITECTURE STOP CONDITIONS

Return `ARCHITECTURE DECISION REQUIRED` and STOP if any is proven:

1.  authoritative sources disagree on the Order state machine;
2.  READY_FOR_BOOKING semantics cannot be determined;
3.  "Send to Booking Center" post-state cannot be determined;
4.  OrderApproved conflicts irreconcilably with canonical event model;
5.  existing BookingRequested consumer makes Step 2.7/2.8 ownership
    impossible to reconcile;
6.  Order fulfillment authority is undefined between Order and Booking;
7.  close guard requires undefined Finance/Documents policy;
8.  SLA requires persisted deadline but no calculation policy exists;
9.  frozen event contract needs incompatible change;
10. persisted statuses require destructive reinterpretation;
11. one Order needs multiple independent BookingRequested semantics but
    cardinality is undefined;
12. correctness requires implementing Step 2.8.

Do not hide architecture choices as local fixes.

------------------------------------------------------------------------

# 43. ALLOWED FIXES

Allowed:

-   Order lifecycle state machine/service;
-   lifecycle validation/guards;
-   action endpoints;
-   canonically required status additions;
-   lifecycle history;
-   temporal milestone wiring;
-   CAS/concurrency hardening;
-   SLA foundation supported by existing policy;
-   canonical Order event production;
-   compatible event-contract cleanup;
-   RBAC/action permissions;
-   tests;
-   additive migration;
-   API/docs/Roadmap updates;
-   local regressions directly caused/exposed by Step 2.7.

------------------------------------------------------------------------

# 44. FORBIDDEN SCOPE

Do NOT implement:

-   Step 2.8 Booking creation;
-   new BookingRequested → Booking consumer;
-   new Booking CRUD;
-   Step 2.8A service time/timezone model;
-   Step 2.9 supplier lifecycle;
-   Finance/Payment/Refund/Settlement;
-   Documents implementation;
-   dynamic pricing;
-   new availability engine;
-   frontend Order Center;
-   Partner Commercial Calendar UI;
-   Reverse Marketplace extensions;
-   generic workflow/rules engine;
-   second Order writer;
-   direct Sales/Reverse → Order lifecycle writes.

------------------------------------------------------------------------

# 45. ROADMAP UPDATE

After successful implementation only, update Roadmap to:

`PHASE 2 STEP 2.7 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Active/NEXT item becomes:

`PHASE 2 — STEP 2.7 — STRICT REVIEW`

Step 2.8 remains blocked/not started.

Do not mark Step 2.7 APPROVED in implementation pass.

------------------------------------------------------------------------

# 46. REQUIRED FINAL REPORT

Return:

# PHASE 2 --- STEP 2.7 --- ORDER LIFECYCLE COMPLETION --- REPORT

## 1. Verdict

`PHASE 2 STEP 2.7 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

or `ARCHITECTURE DECISION REQUIRED`.

## 2. Repository baseline

## 3. Sources inspected

## 4. Current → Target mapping

## 5. Architecture / domain ownership

## 6. Stable Order status codes

## 7. Exact state machine / allowed transitions

## 8. Transition guards

## 9. Initial Order state regression

## 10. Processing / Waiting Data

## 11. READY_FOR_BOOKING semantics

## 12. OrderReadyForBooking event

## 13. Send to Booking Center command

## 14. BookingRequested contract

## 15. SENT_TO_BOOKING behavior

## 16. OrderApproved reconciliation

## 17. OrderStatusChanged reconciliation

## 18. Pre-existing BookingRequested consumer / Step 2.8 boundary

## 19. Partial fulfillment

## 20. FULFILLED / OrderFulfilled

## 21. READY_TO_CLOSE

## 22. CLOSED / OrderClosed

## 23. Cancellation / Problem / Suspended

## 24. Temporal contract

## 25. History / audit

## 26. SLA

## 27. RBAC / IDOR / mass assignment

## 28. Concurrency / CAS / idempotency

## 29. Transaction / Outbox atomicity

## 30. Correlation / causation

## 31. Acquisition regression

## 32. Money/pricing regression

## 33. Availability isolation

## 34. Booking ownership isolation

## 35. Event contract matrix

## 36. Legacy compatibility

## 37. Migration / DB

## 38. API/docs

## 39. Targeted tests

## 40. Previous-step regression

## 41. Full backend regression

## 42. Frontend regression

## 43. DB regression

## 44. Issues found and fixed

## 45. Architecture decision status

## 46. Out-of-scope confirmation

Explicitly confirm Step 2.8/2.8A/2.9/Finance/frontend were not started.

## 47. Exact files changed

## 48. Exact NEXT item

`PHASE 2 — STEP 2.7 — STRICT REVIEW`

Final line:

`PHASE 2 STEP 2.7 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

------------------------------------------------------------------------

# 47. STOP

After implementation, tests, docs and report:

**STOP.**

Do not perform Step 2.7 Strict Review in the same pass.

Do not implement Step 2.8.

Wait for a separate Strict Review prompt.
