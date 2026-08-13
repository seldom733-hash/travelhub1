# PHASE 2 — STEP 2.8A — BOOKING SERVICE DATE / TIME MODEL — IMPLEMENTATION PROMPT

**Project:** TravelHub  
**Mode:** IMPLEMENTATION  
**Previous gate:** `PHASE 2 STEP 2.8 STRICT REVIEW COMPLETED — APPROVED`  
**Hard stop:** after implementation, NEXT is only `PHASE 2 — STEP 2.8A — STRICT REVIEW`.

## 1. Mission

Implement the canonical Booking Service Date / Time Model required by the **current Roadmap**. This step closes the date/time boundary deliberately deferred from Steps 1.8C/1.8D.

Do not treat this as merely adding a datetime column. Reconcile the full chain:

`Catalog → Quote → CheckoutIntent → Sale → OrderRequested → Order/OrderItem → BookingRequested → Booking`

with date-only services, exact local time where authorized, timezone, multi-day semantics, frozen pricing/restrictions, Availability ownership, legacy Booking compatibility, and the future time-slot/calendar boundary.

**Current Roadmap and canonical architecture win over this prompt if they differ.**

## 2. Mandatory source inspection

Inspect before coding:

- current Roadmap v3 and exact 2.8A wording;
- Architecture Master / Screen Design Brief;
- applicable ADR/DD documents;
- Steps 1.8A–1.8D implementation + reviews;
- Steps 2.5/2.5A/2.5B, 2.6, 2.7 + Strict Review, 2.8 + Strict Review;
- `schema.prisma`;
- CommercialPeriod / restriction / pricing resolvers;
- Quote/Checkout/Sale service-date logic;
- OrderRequested consumer, Order/OrderItem;
- BookingRequested producer;
- Booking consumer/service/controller;
- Availability reservation/hold code;
- events, IDs, permissions, temporal validation/utilities.

## 3. Repository baseline

Record branch, HEAD, origin relation, dirty/untracked files, migration count/status, Step 2.8 approval state, exact Roadmap 2.8A wording and exact item after 2.8A. Do not overwrite unrelated dirty work.

## 4. Current → Target temporal map

For every stage in the canonical chain identify existing:

- service/start/end date;
- duration;
- local service time;
- UTC instant;
- timezone;
- time slot/departure;
- CommercialPeriod/restriction provenance;
- AvailabilityReservation reference.

State exactly what 2.8A must add/propagate/freeze and what remains deferred.

## 5. Domain ownership — HARD GATE

Expected principle:

- Catalog owns service/commercial/calendar definitions.
- Pricing resolves commercial price, not Booking occurrence ownership.
- Availability owns capacity/holds.
- Sales freezes commercial facts.
- Order owns ordered fulfillment intent.
- Booking owns the operational occurrence derived from frozen facts.

Booking must not re-resolve mutable Catalog facts or create a second scheduling/pricing/availability authority.

If authority cannot be established from canonical sources:  
`ARCHITECTURE DECISION REQUIRED` and STOP.

## 6. Canonical temporal vocabulary

Explicitly define:

- `serviceDate`: local calendar date on which service starts/is consumed;
- `serviceTime`: local wall-clock time, optional where service is date-only;
- `serviceTimeZone`: authoritative IANA timezone where exact time requires it;
- UTC service instant: derived only when local date + exact time + timezone are known.

Do not conflate commercial validity dates with service occurrence.

Avoid ambiguous generic `date/time/datetime/timezoneOffset` semantics.

## 7. Date-only services — HARD REQUIREMENT

The model must support:

`known service date + unknown/not-applicable exact time`.

Never fabricate `00:00` to mean “time unknown”. A date-only service must not become a UTC-midnight instant.

## 8. Timezone authority — HARD GATE

If exact time is in scope, use canonical IANA zone IDs (`Asia/Baku`, `Europe/Paris`), not raw offsets as authority.

Never infer timezone from browser, buyer locale, server timezone, seller account or IP.

Trace the approved source of timezone. If exact timed service is required but no authoritative timezone source exists:  
`ARCHITECTURE DECISION REQUIRED`.

## 9. DST

If timed services are in scope, handle ambiguous/nonexistent local times and DST transitions using a standards-compliant repository-approved approach. No hand-written offset arithmetic. Add deterministic DST tests for at least one DST-observing zone.

## 10. Frozen service-date authority

Booking must consume the already selected/frozen service occurrence from the Sales/Order chain. It must not query current Catalog state at Booking creation to choose a new date/time.

Trace the authoritative source and prove it end-to-end.

## 11. BookingRequested temporal contract

Extend `BookingRequested` only if required to carry authoritative frozen temporal facts. Keep payload minimal.

Do not add whole Product/Tariff snapshots, mutable price rules, Availability internals or unnecessary PII.

Respect event versioning conventions if payload compatibility requires a version change.

## 12. Booking persistence

Implement only fields required by current Roadmap. Evaluate rather than blindly add:

- serviceDate;
- serviceTime;
- serviceTimeZone;
- derived serviceStartsAt;
- end date/time where truly canonical;
- temporal provenance/reference.

Every persisted field requires defined semantics, authority, nullability, immutability and legacy behavior.

## 13. Local fact ↔ UTC invariant

If both local representation and UTC instant are persisted, enforce:

`local date + local time + IANA timezone ↔ UTC instant`

so they cannot drift independently.

For date-only services, UTC instant normally remains null.

## 14. Multi-day semantics

Reconcile with `durationDays`, MIN_STAY/MAX_STAY, CTA/CTD and 1.8C/1.8D rules.

Determine whether Booking needs start date only, a derived end date, or persisted end date. Do not create a second duration authority. Document inclusive/exclusive semantics.

## 15. CommercialPeriod boundary

CommercialPeriod remains a Catalog fact. Booking may retain approved provenance, but must not rerun period selection to decide what was bought.

## 16. CommercialRestriction boundary

Do not re-evaluate mutable restrictions already validated before binding/freeze unless Roadmap explicitly defines an operational gate. Later Seller restriction edits must not retroactively rewrite an already-bound Booking.

## 17. Price freeze — HARD GATE

No repricing.

Preserve frozen amount, currency, acquisition source and selected commercial facts. A later period-price edit must not change the Booking's purchased commercial result.

## 18. Availability ownership — HARD GATE

2.8A must not create a second capacity hold or decrement.

Trace the existing Sale/Order AvailabilityReservation into Booking and prove hold count remains unchanged.

If time-slot-level capacity is required but Availability has no approved slot model, STOP with architecture decision rather than inventing one.

## 19. Time-slot decision — CRITICAL

This boundary was deliberately deferred from 1.8C/1.8D.

Read the exact current Roadmap.

If 2.8A explicitly authorizes reusable time slots, define ownership, stable identity, local time/timezone, Product/ServiceUnit/Tariff relation, Availability relation, mutability and what gets frozen.

If Roadmap only requires Booking service date/time facts, **do not create a speculative TimeSlot entity/table**.

## 20. Category neutrality

Do not encode “departure” as a universal concept. Shared model should describe service occurrence; category projections/UI may use departure/appointment/check-in terminology.

Test materially different actual categories, e.g. Tour/Activity, Transfer and Hotel/accommodation where present.

## 21. Seller/Buyer mutation boundary

Neither Buyer nor Seller may forge frozen Booking temporal facts.

Seller Catalog edits must not mutate existing Booking.

If rescheduling is not explicitly in 2.8A, do not implement it.

## 22. Mass assignment

Follow the established loud forbidden-key convention.

Forged server-owned temporal/ownership/system fields must return controlled **422** where project convention requires it, not be silently stripped.

Audit Booking PATCH, Order commands, Sales/Checkout input and BookingRequested construction.

## 23. Booking lifecycle

Determine whether temporal facts are immutable for the current Booking lifecycle. Use an existing approved reschedule action only if one already exists canonically. Otherwise they are immutable in 2.8A.

## 24. Legacy compatibility

Existing Booking rows must remain readable/manageable. Migration must be additive and fresh-deploy-safe.

Do not fabricate historical service date/time. New fields may remain nullable for legacy rows where no authoritative backfill exists.

## 25. Migration / IDs / indexes

If schema changes are needed:

- Prisma migration only; no `db push`;
- additive unless canonical Roadmap says otherwise;
- clean replay;
- existing data valid;
- constraints/indexes only for real invariants/query paths.

New ID prefix only if a genuinely new persistent entity is required. Do not create an ID for a value object.

## 26. API projections / serialization

Review staff, Buyer Cabinet and any Partner projections.

Expose only authorized temporal facts. No internal reservation IDs, seller-private data or excess PII.

Use deterministic serialization consistent with project conventions, preferably:

- date-only: `YYYY-MM-DD`;
- local time: `HH:mm`;
- timezone: IANA ID;
- UTC instant: ISO-8601 instant.

## 27. Validation

Centralize applicable validation:

- ISO date;
- local time;
- IANA timezone;
- impossible date;
- invalid temporal combinations;
- forged derived UTC instant;
- duration bounds;
- category-specific requirements only if canonical.

No raw temporal-library/DB errors.

## 28. Cardinality / idempotency preservation — HARD GATE

Step 2.8 established:

`1 OrderItem → 1 Booking`

with `Booking.orderItemId @unique`.

Temporal work must preserve:

- Inbox dedup;
- business-invariant dedup;
- DB unique protection;
- strict P2002 allowlist.

A logically duplicate BookingRequested with another event ID must still create no second Booking.

## 29. Concurrency / failure atomicity

Test duplicate/concurrent BookingRequested, logically duplicate event IDs and realistic consumer races.

Booking creation must remain atomic for Booking + Passenger + BookingHistory + Inbox + outbox/result event + required temporal facts.

Unknown unique violations must fail, not be swallowed.

## 30. BookingCreated event

Do not expand `BookingCreated` with temporal facts speculatively. Add only if canonical contract or an existing consumer requires them.

Preserve correlation and causation:

`BookingCreated.correlation = BookingRequested.correlation`  
`BookingCreated.causation = BookingRequested.eventId`.

## 31. Acquisition / PII / history

Regression test DIRECT, BUYER_REQUEST and legacy null acquisition.

Temporal work must not mutate acquisition.

No passport data in events/audit/history/logs.

If temporal facts are immutable at creation, explain whether existing `created` BookingHistory is sufficient.

## 32. Query paths

Audit real needs such as upcoming Bookings/service-date operations and existing cabinet lists. Add only justified indexes. Do not pre-build a calendar/reporting engine.

## 33. Cross-domain regression

Prove unchanged:

- 1.8C/1.8D public `priceFrom`;
- Quote/Checkout price freeze;
- Availability hold ownership;
- Reverse path:
  `BuyerRequest → Proposal → Sales → Order → Booking`;
- no Reverse-specific Booking path.

## 34. No-second-engine audit — HARD GATE

Repository-wide prove 2.8A introduces no:

- second pricing engine;
- second restrictions engine;
- second Availability engine;
- second Booking writer;
- second calendar authority;
- direct Order→Booking write bypassing BookingRequested.

## 35. Negative E2E matrix

Cover all applicable cases:

1. invalid service date;
2. invalid local time;
3. invalid timezone;
4. offset where IANA authority is required;
5. time without required timezone;
6. forged derived instant;
7. forged Booking temporal PATCH;
8. Buyer cannot overwrite frozen occurrence;
9. Seller Catalog edit does not mutate Booking;
10. later price edit does not reprice Booking;
11. later restriction edit does not rewrite bound Booking;
12. duplicate BookingRequested;
13. logically duplicate event with new eventId;
14. concurrent duplicate;
15. malformed temporal payload;
16. unknown P2002 not swallowed;
17. legacy null temporal facts;
18. date-only does not become midnight;
19. no second Availability hold;
20. no direct Order→Booking writer;
21. no raw 500.

Mark genuinely inapplicable cases explicitly with reason.

## 36. Positive E2E matrix

Cover applicable cases:

1. date-only Booking;
2. exact-time Booking;
3. timezone-aware Booking;
4. correct local→UTC conversion if persisted;
5. non-DST zone;
6. DST zone if timed services are in scope;
7. multi-day service;
8. multiple materially different categories;
9. DIRECT;
10. BUYER_REQUEST;
11. legacy null acquisition;
12. frozen money unchanged;
13. canonical temporal propagation end-to-end;
14. exactly one Booking;
15. exactly one BookingCreated;
16. correct correlation/causation;
17. Passenger behavior unchanged;
18. BookingHistory correct;
19. Availability hold count unchanged;
20. Reverse→Booking;
21. Buyer projection;
22. staff projection;
23. migration/fresh replay.

## 37. Unit tests

Where temporal logic exists, add pure unit tests for date/time parsing, timezone validation, DST ambiguity/nonexistence, local→UTC conversion, date-only behavior, duration/end-date calculation and serialization.

Do not hide all temporal semantics inside controller/E2E tests.

## 38. Regression gates

Run targeted regression including:

- 2.8 consumer;
- 2.7 lifecycle;
- 2.6;
- 2.5/2.5A/2.5B;
- canonical Order events;
- Booking tests;
- Availability;
- 1.8A–1.8D;
- Reverse 2.2A–F;
- acquisition;
- PII/event envelope;
- RBAC;
- Buyer Cabinet;
- public catalog/priceFrom.

Then run full:

**Backend:** typecheck, build, all unit, all serial E2E.  
**Frontend:** tsc, vitest, production build even if untouched.  
**DB:** migrate status, clean replay, repository-supported drift verification.

Report actual counts.

## 39. Adversarial self-review

Search specifically for:

- `new Date("YYYY-MM-DD")` timezone traps;
- server-local timezone assumptions;
- fabricated midnight;
- raw offset authority;
- duplicate date/time logic;
- Catalog re-resolution during Booking creation;
- repricing;
- second hold;
- mutable frozen temporal fields;
- unsafe P2002 swallowing;
- legacy-null crashes;
- silent DTO stripping instead of required 422;
- direct Order→Booking writes;
- speculative TimeSlot/calendar entities.

Fix architecture-neutral defects and add regression tests.

## 40. Architecture stop conditions

Return `ARCHITECTURE DECISION REQUIRED` and STOP if unresolved:

1. exact timed Booking requires timezone but authoritative timezone source is undefined;
2. reusable TimeSlot ownership is unclear;
3. slot-level capacity is required but Availability model is undefined;
4. local-time vs UTC authority conflicts;
5. Sales frozen service date conflicts with Order/Booking date;
6. multi-day end semantics conflict;
7. category time requirements lack a canonical representation;
8. implementation requires undefined post-binding rescheduling;
9. implementation would change Universal Pricing authority;
10. implementation requires beginning the next Roadmap step.

## 41. Documentation

Update applicable architecture docs, `api.md`, `events.md` if contract changes, `ids.md` only for a real new entity, and Roadmap.

Document date-only semantics, optional-time semantics, timezone authority, UTC conversion, DST, immutability, legacy behavior, Pricing boundary, Availability boundary, TimeSlot decision and rescheduling boundary.

## 42. Roadmap update

Only after implementation + full regression:

Step 2.8A →  
`IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

Active/NEXT →  
`PHASE 2 — STEP 2.8A — STRICT REVIEW`

Do not approve 2.8A and do not start the following implementation step.

## 43. Required final report

# PHASE 2 — STEP 2.8A — BOOKING SERVICE DATE / TIME MODEL — REPORT

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target temporal mapping
5. Architecture / domain ownership
6. Canonical temporal vocabulary
7. Date-only semantics
8. Timezone authority
9. DST semantics
10. Service-date authority
11. BookingRequested temporal contract
12. Booking persistence model
13. Local fact ↔ UTC instant invariant
14. Multi-day semantics
15. CommercialPeriod boundary
16. CommercialRestriction boundary
17. Price freeze
18. Availability ownership
19. Time-slot decision
20. Category compatibility
21. Seller mutation boundary
22. Buyer mutation boundary
23. Mass assignment
24. Booking lifecycle interaction
25. Legacy compatibility
26. Migration
27. IDs / indexes
28. API projections
29. Serialization
30. Validation
31. Concurrency
32. Idempotency
33. Failure atomicity
34. BookingCreated event
35. Correlation / causation
36. Acquisition source
37. PII
38. Audit / history
39. Query paths
40. Public/catalog regression
41. Reverse Marketplace regression
42. No-second-engine audit
43. Negative tests
44. Positive tests
45. Unit tests
46. Targeted regression
47. Full backend regression
48. Frontend regression
49. DB regression
50. Issues found and fixed
51. Architecture decision status
52. Documentation changes
53. Roadmap update
54. Deferred / extension points
55. Out-of-scope confirmation
56. Exact files changed
57. Exact NEXT item

Final verdict must be exactly one of:

`PHASE 2 STEP 2.8A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

or

`PHASE 2 STEP 2.8A BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 44. STOP

After the report: **STOP**.

Do not perform 2.8A Strict Review in the same pass.  
Do not start the next Roadmap implementation step.
