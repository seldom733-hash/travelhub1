# PHASE 2 — STEP 2.9A — BOOKING TEMPORAL CONTRACT — IMPLEMENTATION PROMPT

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.9A — Booking Temporal Contract  
**Mode:** IMPLEMENTATION  
**Prerequisite:** `PHASE 2 STEP 2.9 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`  
**Current expected regression baseline:** backend unit `475/475`, full serial E2E `994/994`, frontend vitest `135/135`, migrations `45/45`.  
**Hard stop:** after implementation and regression, set Step 2.9A to `IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW` and STOP. Do **not** perform Strict Review and do **not** begin Step 2.10.

---

## 1. Mission

Implement the canonical **Booking Temporal Contract** for TravelHub.

Step 2.9 established the Booking lifecycle and deliberately did **not** add lifecycle milestone columns. Step 2.9A must now make Booking lifecycle time facts explicit, server-authoritative, immutable, auditable and safe for future SLA/analytics use without changing the approved Booking state-machine semantics.

The Step 2.9 Strict Review explicitly deferred to 2.9A:

- lifecycle milestone/SLA timestamps;
- deterministic attachment of timestamps to already-approved transitions.

Do not reinterpret Step 2.9 lifecycle while implementing temporal facts.

---

## 2. Mandatory source inspection before coding

Read and reconcile at minimum:

1. current `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
2. current Architecture Master / relevant architecture baseline;
3. Screen Design Brief Booking status/queue definitions;
4. Step 2.5A temporal contract;
5. Step 2.7 Order Lifecycle Completion implementation + Strict Review;
6. Step 2.8 BookingRequested → Booking Creation implementation + Strict Review;
7. Step 2.8A Booking Service Date / Time Model implementation + Strict Review;
8. Step 2.9 Booking Lifecycle Completion implementation + Strict Review;
9. `schema.prisma`;
10. `booking.service.ts`;
11. `booking.subscribers.ts`;
12. `booking.controller.ts`;
13. `booking.validation.ts`;
14. Booking/Order event contracts;
15. `BookingHistory`;
16. request context / EventBus correlation-causation conventions;
17. current API/event docs;
18. all relevant Booking and Order E2E suites.

**Current canonical Roadmap wins on conflict.**

If the Roadmap defines a more precise 2.9A contract than this prompt, follow the Roadmap and document the reconciliation.

---

## 3. Repository baseline

Before modifications record:

- branch;
- HEAD;
- origin relation;
- dirty/untracked files;
- inherited uncommitted changes from Steps 2.6–2.9;
- migration count/status;
- current Step 2.9 status;
- current Step 2.9A status;
- exact files already containing temporal Booking fields;
- whether Step 2.10 or later functionality has accidentally started.

Do not clean, reset, rewrite or discard previous approved uncommitted work.

---

## 4. Current → Target mapping

Document the exact delta.

Expected current state after approved 2.9:

- Booking lifecycle exists;
- Booking transitions are CAS-protected;
- BookingHistory records real transitions;
- Step 2.8A service occurrence fields exist:
  - `serviceDate`;
  - `serviceTime`;
  - `serviceEndTime`;
  - `serviceTimeZone`;
  - `serviceTimeType`;
  - `serviceStartsAt`;
  - `serviceEndsAt`;
- lifecycle milestone columns such as `requestedAt`, `confirmedAt`, `rejectedAt`, `cancelledAt`, `completedAt` are not yet canonical Booking fields.

Target:

- explicit lifecycle milestone facts;
- server-owned timestamps;
- first-transition-only semantics;
- immutable after being set;
- atomic with corresponding transition;
- compatible with consumer-driven transitions/compensation;
- no fabrication for legacy rows;
- no conflation with service occurrence time.

---

## 5. HARD DOMAIN SEPARATION — lifecycle time ≠ service occurrence time

Step 2.8A temporal fields describe **when the booked service occurs**.

Step 2.9A fields describe **when Booking business lifecycle facts occurred**.

Never derive lifecycle milestones from:

- `serviceDate`;
- `serviceTime`;
- `serviceStartsAt`;
- `serviceEndsAt`.

Never modify Step 2.8A occurrence facts as a side effect of lifecycle transitions.

This distinction must be explicit in code and docs.

---

## 6. Canonical milestone vocabulary

Reconcile the exact milestone list with the current Roadmap.

Expected minimum candidates from the approved 2.9 Strict Review:

- `requestedAt`
- `confirmedAt`
- `rejectedAt`
- `cancelledAt`
- `completedAt`

Also inspect whether canonical sources require timestamps for:

- preparation;
- supplier send;
- clarification;
- cancellation request;
- change request;
- service start;
- problem marker.

**Do not create a timestamp merely because a status exists.**

A persisted milestone requires a canonical business fact with durable value.

If authoritative sources disagree on required milestone vocabulary, STOP with:

`ARCHITECTURE DECISION REQUIRED`

rather than inventing columns.

---

## 7. `createdAt` semantics

`createdAt` already represents persistence creation time.

Do not duplicate it with another field unless the canonical Roadmap explicitly distinguishes:

- Booking row creation; and
- Booking request business submission.

Determine the exact meaning of `requestedAt`.

Potential valid distinction:

- `createdAt` = Booking aggregate persisted;
- `requestedAt` = Booking request was canonically sent/requested from supplier.

But this must come from current canonical sources/state machine—not assumption.

Document the resolved semantics.

---

## 8. `requestedAt` — CRITICAL

Determine which approved Step 2.9 transition establishes the request milestone.

Possible candidate is the real transition that means the booking request was sent to supplier, not BookingRequested event receipt itself.

Do not blindly set `requestedAt = createdAt`.

Requirements:

- exactly one canonical producer;
- server-owned;
- set once;
- atomic with the relevant transition;
- retry/stale transition cannot overwrite it;
- legacy rows may remain null.

If no existing transition has canonical “request sent” semantics, do not fabricate one. Escalate architecture decision if Roadmap nevertheless requires `requestedAt`.

---

## 9. `confirmedAt`

Set only on the real transition to `CONFIRMED`.

Requirements:

- first transition only;
- same transaction as Booking status CAS + BookingHistory + `BookingConfirmed`;
- concurrent confirm/reject/cancel cannot produce contradictory milestone;
- retry cannot change timestamp;
- legacy already-CONFIRMED row with null timestamp must remain readable unless an explicit canonical backfill rule exists.

No backfill from `updatedAt`.

---

## 10. `rejectedAt`

Set only when Booking genuinely transitions to `SUPPLIER_REJECTED`.

Requirements mirror `confirmedAt`.

Do not use `cancelledAt` for supplier rejection.

Do not infer from generic history unless a migration/backfill is explicitly required and provably deterministic.

---

## 11. `cancelledAt`

Must cover every real transition into `CANCELLED`.

Audit at least:

1. explicit Booking `cancel`;
2. OrderCancelled compensation of an existing active Booking;
3. born-CANCELLED Booking when OrderCancelled precedes BookingRequested.

The third case is special.

The approved Step 2.9 Strict Review established that born-CANCELLED is created directly in CANCELLED and does **not** emit BookingCancelled because no transition occurred.

Determine canonical temporal semantics:

- should `cancelledAt` equal Booking creation time for born-CANCELLED?
- should it derive from the upstream OrderCancelled event `occurredAt`?
- should it remain null because no Booking transition occurred?

Do **not** guess.

Use the current Roadmap/approved temporal conventions. If sources do not determine this and the distinction materially affects temporal truth, return `ARCHITECTURE DECISION REQUIRED`.

---

## 12. `completedAt`

Set only on genuine `IN_SERVICE → COMPLETED`.

Requirements:

- first-only;
- atomic with state/history/BookingCompleted/outbox;
- no service-date auto completion;
- no inference from `serviceEndsAt`;
- no Payment prerequisite unless already canonical;
- no rewrite on later Order cancellation.

---

## 13. Other terminal/marker timestamps

Do not automatically persist:

- `problemAt`;
- `clarificationRequestedAt`;
- `changeRequestedAt`;
- `cancellationRequestedAt`;
- `serviceStartedAt`;
- `preparedAt`.

Only add them if current Roadmap explicitly requires them.

BookingHistory already provides generic transition timing. Persisted columns should be reserved for canonical milestones needed for stable query/SLA semantics.

---

## 14. Temporal authority

All milestone timestamps must be **server-authoritative**.

Client must never submit them.

Forbidden/mass-assignment protection must loudly reject forged temporal fields according to existing project convention (`422`), not silently strip them.

Audit:

- lifecycle action endpoint;
- any Booking PATCH;
- Booking creation surfaces;
- consumer payloads.

---

## 15. Timestamp source

Use one consistent server-side time source per transaction/transition.

Prefer one captured `now` value for:

- milestone;
- BookingHistory occurrence if architecture permits;
- event/outbox occurrence semantics where appropriate.

Do not call `new Date()` repeatedly and create artificial ordering differences within one logical transition if the project has an established temporal helper/convention.

Follow existing Order temporal contract conventions where applicable.

---

## 16. Atomicity — HARD GATE

For each milestone-producing lifecycle action:

`status + version + milestone + BookingHistory + outbox event`

must commit atomically.

On failure:

- no new status;
- no milestone;
- no history;
- no event.

Test rollback.

---

## 17. CAS and milestone immutability

CAS must continue to guard by current status/version.

Milestone assignment must occur only in the winning transition.

Examples:

- confirm vs reject → only winner's milestone;
- confirm vs cancel → only winner's relevant milestone;
- complete vs cancel → only winner;
- compensation vs confirm/complete → deterministic result consistent with approved 2.9 order-status guard.

Never “repair” a milestone after losing CAS.

---

## 18. Compensation temporal semantics — HARD GATE

`OrderCancelled → Booking cancellation` is consumer-driven.

For each Booking actually transitioned to CANCELLED:

- set `cancelledAt` in same transaction;
- history and BookingCancelled must agree with that transition;
- correlation/causation remain inherited from OrderCancelled;
- replay does not change `cancelledAt`.

Terminal Booking untouched by compensation must retain its existing milestone facts.

---

## 19. Born-CANCELLED temporal semantics — HARD GATE

Explicitly resolve and test the temporal truth for Booking created already CANCELLED due to prior Order cancellation.

Document:

- `createdAt`;
- `requestedAt`;
- `cancelledAt`;
- history `created_cancelled`;
- BookingCreated occurrence;
- upstream OrderCancelled occurrence.

No synthetic BookingCancelled event unless current canonical architecture changes the approved 2.9 decision.

---

## 20. BookingRequested creation semantics

Do not confuse:

- BookingRequested domain event;
- Booking aggregate creation;
- supplier request milestone.

Step 2.8 defines BookingRequested → Booking creation authority.

Step 2.9A must not reinterpret BookingRequested as supplier acknowledgement or confirmation.

---

## 21. BookingHistory relationship

BookingHistory remains the complete transition ledger.

Milestone columns are queryable canonical projections of selected facts, not a replacement for history.

For every milestone transition verify:

- history action;
- from/to;
- timestamp relation;
- no duplicate row;
- no PII.

Do not destructive-backfill history.

---

## 22. Event occurrence relationship

Review relation between:

- milestone timestamp;
- BookingHistory timestamp;
- Outbox/event `occurredAt`.

They should represent one logical business transition without contradictory ordering.

Do not redefine EventBus globally in this step.

---

## 23. SLA foundation — NO POLICY FABRICATION

Step 2.9A may establish temporal facts needed by future SLA calculations.

It must **not** invent:

- SLA duration;
- due dates;
- breach thresholds;
- escalation policy;
- supplier response target;
- auto-cancellation deadline.

If current Roadmap explicitly requires persisted SLA fields, implement only what it defines.

Otherwise document that milestone facts provide the foundation for future SLA policy.

---

## 24. Order temporal contract compatibility

Compare Booking milestone semantics with approved Order temporal conventions from 2.5A/2.7.

Reuse established principles:

- server-owned;
- immutable;
- first-transition-only;
- no `updatedAt` substitution;
- atomic transition;
- legacy nullable compatibility.

Do not force identical milestone names where business meanings differ.

---

## 25. Step 2.8A compatibility — HARD GATE

Prove no lifecycle milestone implementation changes:

- service date;
- local service time;
- timezone;
- UTC start/end;
- time type;
- DST resolution.

Lifecycle timestamps are UTC instants representing system/business event occurrence.

Service-time timezone remains Product-derived frozen authority.

---

## 26. Acquisition and money freeze

Temporal changes must not modify:

- `amount`;
- `currency`;
- payment facts;
- `acquisitionSource`;
- Product/Tariff/CommercialPeriod/Restriction snapshot;
- Order/OrderItem references.

No repricing.

---

## 27. Availability isolation

Step 2.9 Strict Review explicitly left release-on-cancel to a future owner-step.

2.9A must not introduce Availability release/hold changes merely because cancellation now has `cancelledAt`.

Zero Availability writes.

---

## 28. Finance isolation

Zero Payment/Refund/Settlement/Payout/Invoice writes.

A cancellation timestamp is not a refund trigger in this step.

---

## 29. RBAC

No new business permissions should be necessary solely to store server timestamps.

Existing Step 2.9 action permissions remain authoritative unless Roadmap explicitly changes them.

External roles must not gain ability to write temporal fields.

---

## 30. IDOR

Preserve existing Booking IDOR behavior.

Temporal fields must not introduce an endpoint that leaks foreign Booking existence.

---

## 31. Mass assignment — HARD GATE

Extend `BOOKING_ACTION_FORBIDDEN_KEYS` / relevant forbidden-key contracts for every new server-owned temporal field.

Forged examples must produce controlled `422`:

```json
{
  "action": "confirm",
  "confirmedAt": "2026-01-01T00:00:00.000Z"
}
```

Also test forged `requestedAt`, `rejectedAt`, `cancelledAt`, `completedAt`.

State/version/milestones must remain unchanged after rejection.

---

## 32. Schema / migration

Any new durable milestone columns must be additive and nullable unless the canonical migration contract explicitly proves safe non-null backfill.

Expected pattern:

- `DateTime?`;
- no destructive rewrite;
- no fake defaults;
- no `NOW()` backfill for historical rows.

Migration must be:

- fresh-deploy-safe;
- production-upgrade-safe;
- reversible by normal migration discipline;
- drift-free.

Do not use `prisma db push`.

---

## 33. Legacy compatibility — HARD GATE

Historical Bookings may have:

- terminal/active status;
- null milestone columns;
- null `orderItemId`;
- null acquisition source;
- missing 2.8A service-time facts;
- `AWAITING_CONFIRMATION`;
- old BookingHistory.

They must remain readable and manageable where lifecycle permits.

Do not fabricate historical milestone times from `updatedAt`.

---

## 34. API representation

Determine whether milestone fields belong in existing staff Booking read DTOs.

If exposed:

- use ISO-8601 UTC;
- nullable;
- read-only;
- no internal audit leakage.

Do not expose new private temporal fields publicly without a current consumer/contract.

---

## 35. Public / Buyer / Partner surfaces

Audit all serializers.

Adding Prisma fields must not accidentally leak operational milestone data through:

- public catalog;
- Buyer storefront;
- Partner surfaces;
- unrelated DTO spreads.

Explicit projection is preferred.

---

## 36. Indexing

Do not add indexes speculatively.

Add only if current Roadmap/query contract already requires milestone filtering/queue ordering and the index has a concrete query.

Document every added index.

---

## 37. Events

Do not create new temporal events merely because timestamps exist.

Existing canonical events remain:

- BookingConfirmed;
- BookingRejected;
- BookingCancelled;
- BookingCompleted;
- technical BookingStatusChanged where approved.

Milestone fields are state facts, not a reason for duplicate event vocabulary.

---

## 38. Concurrency test matrix

At minimum verify:

1. concurrent confirm/confirm;
2. confirm/reject;
3. confirm/cancel;
4. complete/cancel;
5. OrderCancelled compensation/confirm;
6. compensation/complete;
7. duplicate compensation;
8. duplicate lifecycle retry.

Assert:

- one winning state;
- correct one-time milestone(s);
- no contradictory timestamps;
- one history/event effect;
- controlled 409/no-op;
- no raw 500.

---

## 39. Temporal precision tests

Test that:

- milestone is a valid UTC instant;
- milestone is server-generated;
- milestone is not client-controlled;
- milestone is not rewritten on retry;
- milestone is not equal to service occurrence by forced derivation;
- event/history/milestone belong to same logical transition;
- ordering assumptions do not rely on millisecond inequality when same transaction may share timestamp.

Avoid flaky “timestamp must be greater by at least 1ms” assertions.

---

## 40. Mandatory lifecycle temporal matrix

Produce a concrete matrix in tests/report:

| Transition/fact | Expected milestone |
|---|---|
| Booking creation NEW | only creation fact; no fake confirmation/cancel/completion |
| supplier request transition | `requestedAt` if canonically defined |
| → CONFIRMED | `confirmedAt` |
| → SUPPLIER_REJECTED | `rejectedAt` |
| explicit → CANCELLED | `cancelledAt` |
| Order compensation → CANCELLED | `cancelledAt` |
| born-CANCELLED | resolved canonical rule |
| → COMPLETED | `completedAt` |
| clarification/change/problem | no milestone unless Roadmap explicitly requires one |

Prove all non-applicable milestone fields stay null.

---

## 41. Negative E2E requirements

At minimum:

1. forged requestedAt → 422;
2. forged confirmedAt → 422;
3. forged rejectedAt → 422;
4. forged cancelledAt → 422;
5. forged completedAt → 422;
6. failed confirm does not set confirmedAt;
7. failed reject does not set rejectedAt;
8. failed cancel does not set cancelledAt;
9. failed complete does not set completedAt;
10. retry does not rewrite milestone;
11. terminal reopen does not change milestones;
12. buyer/partner/moderator cannot mutate lifecycle/milestones;
13. malformed timestamp input cannot bypass forbidden-key protection;
14. legacy null milestone row remains readable;
15. no Availability write;
16. no Finance write;
17. no service-time mutation;
18. no reprice;
19. no raw 500.

---

## 42. Positive E2E requirements

At minimum:

1. normal creation;
2. canonical supplier-request milestone if applicable;
3. confirm sets confirmedAt once;
4. reject sets rejectedAt once;
5. explicit cancel sets cancelledAt once;
6. OrderCancelled compensation sets cancelledAt once;
7. born-CANCELLED follows resolved rule;
8. complete sets completedAt once;
9. DIRECT acquisition preserved;
10. BUYER_REQUEST preserved;
11. legacy null acquisition preserved;
12. date-only service facts preserved;
13. timed service facts preserved;
14. multi-item compensation timestamps each actually cancelled Booking;
15. correlation/causation unchanged;
16. history consistent with milestones;
17. concurrency winner has correct milestone;
18. loser has no contradictory milestone;
19. migration fresh replay works.

---

## 43. Unit tests

Add focused unit coverage only where useful for pure temporal helpers/validation.

Do not move business transition authority out of E2E-verifiable service code merely to make unit tests easier.

---

## 44. Regression scope

After implementation run actual commands for:

### Backend

- TypeScript typecheck;
- build;
- full unit suite;
- new Step 2.9A E2E;
- Step 2.9 lifecycle;
- Step 2.8A service-time model;
- Step 2.8 BookingRequested consumer;
- Step 2.7 Order lifecycle;
- Step 2.6;
- 2.5/2.5A/2.5B;
- Order canonical events;
- Availability;
- Reverse 2.2A–F;
- pricing 1.8A–D;
- acquisition propagation;
- RBAC;
- PII/event envelope;
- Buyer Cabinet;
- full serial E2E.

### Frontend

Even if unchanged:

- `tsc --noEmit`;
- vitest;
- production build.

### Database

- migration status;
- fresh migration replay;
- supported drift verification.

Report exact real counts.

---

## 45. Review implementation quality

Before declaring completion perform an internal implementation review for:

- forgotten write paths;
- duplicate timestamp producers;
- incorrect born-CANCELLED semantics;
- `updatedAt` misuse;
- client-forge gaps;
- serializer leakage;
- CAS race;
- migration default/backfill mistakes;
- event/milestone mismatch;
- accidental Step 2.10 work.

Fix implementation defects within this pass if architecture-neutral.

This is **not** the separate Strict Review.

---

## 46. Architecture decision stop conditions

STOP and report:

`PHASE 2 STEP 2.9A BLOCKED — ARCHITECTURE DECISION REQUIRED`

if any of these cannot be resolved from canonical sources:

1. exact meaning/producer of `requestedAt`;
2. born-CANCELLED `cancelledAt` authority;
3. Roadmap and lifecycle disagree on required milestones;
4. correct semantics require new lifecycle states/transitions;
5. correct semantics require Availability release ownership;
6. correct semantics require Finance/refund behavior;
7. required SLA deadlines/policies are undefined;
8. legacy data would require fabricated backfill;
9. Step 2.9A cannot be implemented without changing approved 2.9 lifecycle semantics.

Do not silently choose a business policy.

---

## 47. Documentation

Update at minimum, where applicable:

- Booking temporal architecture artifact;
- `docs/contracts/api.md`;
- `docs/contracts/events.md` only if event contract representation genuinely changes;
- schema/IDs docs if applicable;
- current Roadmap.

Document explicitly:

- lifecycle time vs service occurrence time;
- each milestone producer;
- immutability;
- nullable legacy semantics;
- born-CANCELLED rule;
- no SLA policy fabrication;
- no Availability/Finance side effects.

---

## 48. Roadmap update

Only after implementation + regression succeed:

Step 2.9A →

`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Set active/NEXT item to:

`PHASE 2 — STEP 2.9A — STRICT REVIEW`

Do **not** mark 2.9A approved.

Do **not** begin Step 2.10.

---

## 49. Required implementation report

Produce:

# PHASE 2 — STEP 2.9A — BOOKING TEMPORAL CONTRACT — REPORT

1. Verdict  
2. Repository baseline  
3. Sources inspected  
4. Current → Target mapping  
5. Domain separation: lifecycle vs service occurrence  
6. Canonical milestone vocabulary  
7. createdAt semantics  
8. requestedAt semantics  
9. confirmedAt  
10. rejectedAt  
11. cancelledAt  
12. born-CANCELLED temporal semantics  
13. completedAt  
14. Non-persisted marker timestamps  
15. Temporal authority  
16. Schema / migration  
17. Lifecycle integration  
18. Compensation integration  
19. CAS / concurrency  
20. Idempotency  
21. Transaction / Outbox atomicity  
22. BookingHistory relationship  
23. Event timestamp relationship  
24. SLA foundation  
25. Step 2.8A compatibility  
26. Order temporal compatibility  
27. Money / acquisition freeze  
28. Availability isolation  
29. Finance isolation  
30. RBAC  
31. IDOR  
32. Mass assignment  
33. Legacy compatibility  
34. API / serializer exposure  
35. Indexing  
36. Events  
37. Temporal lifecycle matrix  
38. Negative tests  
39. Positive tests  
40. Unit tests  
41. Targeted regression  
42. Backend full regression  
43. Frontend regression  
44. DB regression  
45. Issues found  
46. Fixes applied  
47. Architecture decision status  
48. Documentation  
49. Migration/fresh-deploy proof  
50. Roadmap update  
51. Deferred / extension points  
52. Out-of-scope confirmation  
53. Exact files changed  
54. **Exact NEXT item**

Final line:

`PHASE 2 STEP 2.9A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

or, if blocked:

`PHASE 2 STEP 2.9A BLOCKED — ARCHITECTURE DECISION REQUIRED`

---

## 50. OUT OF SCOPE

Do not implement:

- Step 2.9A Strict Review;
- Step 2.10 Finance / Payment / Refund / Settlement;
- Availability release policy unless Roadmap explicitly assigns it here;
- supplier integration;
- reschedule/repricing;
- notification automation;
- vouchers/documents;
- frontend Booking Center redesign;
- generic SLA policy engine;
- new workflow states not already canonical.

---

## 51. FINAL STOP

Once implementation, documentation, Roadmap update and all regressions are complete:

**STOP.**

The only permitted next action is a separate:

`PHASE 2 — STEP 2.9A — BOOKING TEMPORAL CONTRACT — STRICT REVIEW`

prompt.
