# PHASE 2 — STEP 2.9 — BOOKING LIFECYCLE COMPLETION — STRICT REVIEW PROMPT

**Project:** TravelHub  
**Mode:** STRICT REVIEW / ADVERSARIAL CERTIFICATION  
**Entering status:** `PHASE 2 STEP 2.9 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`  
**Reported implementation regression:** backend unit `475/475`, targeted E2E `200/200`, full serial E2E `983/983` (55 suites), frontend `135/135`, migrations `45/45`.  
**Expected NEXT only if approved:** `PHASE 2 — STEP 2.9A — BOOKING TEMPORAL CONTRACT`  
**Hard stop:** DO NOT implement Step 2.9A in this pass.

## 1. Mission

Perform an independent adversarial Strict Review of Step 2.9. Do not approve from the implementation report or green test counts alone.

Verify the complete Booking lifecycle, canonical events, compensation, Order feedback, CAS/idempotency, ownership, frozen 2.8A temporal facts and the boundary to Step 2.9A.

Final verdict must be exactly one of:

- `PHASE 2 STEP 2.9 STRICT REVIEW COMPLETED — APPROVED`
- `PHASE 2 STEP 2.9 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 2 STEP 2.9 STRICT REVIEW COMPLETED — CHANGES REQUIRED`
- `PHASE 2 STEP 2.9 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 2. Sources

Inspect current Roadmap, Architecture Master/Baseline, Screen Design Brief, Step 1.14, Steps 2.5/2.5A/2.5B, 2.7/2.8/2.8A implementation+reviews, Booking schema/service/controller/subscribers, Order subscribers, event contracts, RBAC, BookingHistory, Availability and Step 2.9 tests/docs.

Current canonical Roadmap wins on conflict.

## 3. Baseline

Record branch, HEAD, origin relation, dirty/untracked files, migration status, Roadmap state, implementation commit state, and whether 2.9A/later code accidentally started. Separate inherited dirty work, Step 2.9 changes, and review fixes.

## 4. Rebuild the actual Booking lifecycle

For every BookingStatus document:
- business meaning;
- producer(s);
- predecessors/successors;
- action;
- guard;
- actor/permission;
- history;
- event;
- terminal/non-terminal;
- live vs reserved/legacy semantics.

Do not approve merely because enum matches Screen Design.

## 5. Booking write-path audit — HARD GATE

Repository-wide classify every `booking.create/update/updateMany/upsert/raw INSERT`.

Allowed categories:
1. BookingRequested create consumer;
2. Booking-owned lifecycle service;
3. Booking-owned reconciliation/compensation;
4. legitimate migration/test-only.

Forbidden cross-domain writer count must be zero.

## 6. Single state-machine authority

Verify `BookingService.TRANSITIONS` is authoritative and subscribers do not create a conflicting second state machine. Controllers must not set status directly.

## 7. Initial NEW state

BookingRequested must still create approved NEW state without auto-confirmation/completion, repricing, second hold or temporal reinterpretation.

## 8. PREPARING_REQUEST

Verify `NEW → PREPARING_REQUEST` has canonical meaning, permission, history, CAS and retry semantics—not merely a producer added because the Screen Design contained the code.

## 9. NEEDS_CLARIFICATION

Verify requestClarification/resume semantics, legal paths, ownership and absence of invented supplier Communication side effects.

## 10. AWAITING_CONFIRMATION — CRITICAL

Implementation says it is reserved with no producer but can be confirmed/rejected.

Determine:
- legacy-only?
- future supplier integration reserve?
- canonical but currently unreachable?
- should Step 2.9 provide its producer?

If authoritative sources require a current producer, Step 2.9 is incomplete.

## 11. Booking confirmation — HARD GATE

Verify legal source(s), one `BookingConfirmed`, state+history+outbox atomicity, retry/concurrency safety and immutable money/acquisition/time facts.

## 12. Supplier rejection — HARD GATE

Verify legal source(s), terminal semantics, one `BookingRejected`, no hard delete/refund side effects, and only Order-owned code changes Order.

## 13. Cancellation request

Verify `CANCELLATION_REQUESTED` is a marker with clear meaning. Request itself must not release capacity, mutate Finance or fabricate supplier integration.

## 14. Order-cancel compensation — CRITICAL HARD GATE

Deep-review `booking-order-cancelled-consumer`.

Verify:
- approved `OrderCancelled` authority;
- Booking-owned consumer;
- canonical production registration;
- CAS;
- terminal Bookings untouched;
- history semantics;
- one `BookingCancelled` per real cancellation transition;
- correct correlation/causation;
- replay/idempotency;
- multi-item handling;
- no Finance/Availability cross-writes;
- lifecycle-vs-compensation races.

Determine whether this closes the approved 2.8 deferred race rather than inventing a new compensation architecture.

## 15. OrderCancelled BEFORE BookingRequested — CRITICAL

Implementation says a later Booking is created directly in CANCELLED with history `created_cancelled`, with no BookingCancelled event because no transition occurred.

Do not accept this automatically.

Determine:
- whether a Booking should be created after Order cancellation at all;
- whether durable BookingRequested authority requires historical creation;
- whether downstream analytics require a row;
- whether absence of BookingCancelled is semantically correct;
- whether `created_cancelled` is a canonical business/history fact.

If not directly supported by approved architecture, return architecture decision required.

## 16. Terminal compensation

Verify Order cancellation does not rewrite SUPPLIER_REJECTED, COMPLETED or CANCELLED. Assess whether COMPLETED under cancelled Order is valid historical state without reversal.

## 17. Change request handling

Verify `CHANGE_REQUESTED` is marker-only. No frozen amount/date/time/timezone/UTC instant/hold mutation. No reschedule/reprice engine.

## 18. Other marker states

Audit PROBLEM and any other non-terminal markers, entry/recovery/blocking semantics. Do not invent Support workflows.

## 19. BookingCompleted — HARD GATE

Verify exact transition(s), business meaning, first-only emission, one history row, atomicity, no serviceDate-only auto-completion, no Payment prerequisite fabrication.

## 20. BookingStatusChanged vs BookingCompleted — CRITICAL

Implementation says completion may emit canonical BookingCompleted plus technical BookingStatusChanged because Order reconciliation still depends on generic status change.

Determine:
- which event is actual domain authority;
- why Order does not consume BookingCompleted;
- whether both can trigger duplicate effects;
- whether BookingCompleted is merely decorative.

Generic status event must not remain the real hidden canonical fulfillment event without explicit backward-compatibility rationale.

## 21. Booking → Order ownership

Booking emits facts; Order owns Order. Verify zero Booking writes to Order tables.

List all Order consumers of BookingConfirmed/Rejected/StatusChanged/Completed/Cancelled and exact mappings.

## 22. Multi-item Order reconciliation — CRITICAL HARD GATE

Implementation says “all terminal → FULFILLED”.

Test and reconcile semantics:

- Does SUPPLIER_REJECTED count as terminal?
- Does CANCELLED count?
- Should all rejected Bookings make an Order FULFILLED?
- Should all cancelled Bookings make it FULFILLED?
- Does FULFILLED mean “services delivered” or “all booking work resolved”?

If current logic marks failed/cancelled-only Orders FULFILLED and that conflicts with canonical Order meaning, architecture decision required.

## 23. PARTIALLY_FULFILLED semantics

Verify exact rule. One completed item among many may justify partial fulfillment; confirmation alone normally should not.

## 24. BookingConfirmed → Order behavior — CRITICAL

Implementation report says “Confirm→PARTIALLY_FULFILLED” in one section.

Inspect actual code.

If BookingConfirmed causes Order PARTIALLY_FULFILLED, verify canonical architecture explicitly defines this. Confirmation is not normally fulfillment.

Likely semantic defect if unsupported.

## 25. BookingRejected → Order PROBLEM

Verify multi-item behavior: whether one rejection puts whole Order into PROBLEM and whether that is canonical/race-safe.

## 26. BookingCancelled → Order behavior

Implementation says BookingCancelled does not trigger Order.

Test:
- one cancelled child;
- all cancelled;
- mixed cancelled/completed/rejected.

If Order can become permanently inconsistent, identify the gap. Do not invent policy; return architecture decision required if necessary.

## 27. Transition matrix

Independently rebuild every action:
source allowlist → target → permission → guard → history → event(s) → retry semantics.

No arbitrary `status` patch.

## 28. CAS / concurrency

Test:
- prepare vs cancel;
- clarification vs cancel;
- confirm vs reject;
- confirm vs cancel;
- change vs cancel;
- complete vs cancel;
- OrderCancelled compensation vs confirm;
- compensation vs complete;
- duplicate OrderCancelled;
- OrderCancelled before BookingRequested;
- concurrent multi-Booking compensation.

One deterministic business winner, no raw 500, no duplicate event/milestone/history.

## 29. Idempotency

Verify lifecycle retries and consumer dedup for BookingRequested and OrderCancelled. Unknown P2002 must fail, not be swallowed.

## 30. Transaction / Outbox atomicity

For lifecycle: `status + history + outbox` atomic.

For compensation, determine atomicity across multiple affected Bookings and whether retry safely converges if fan-out is not all-or-nothing.

## 31. Correlation / causation

HTTP actions must follow ADR-0009/0010 request context. Consumer-driven events inherit correlation and causation points to triggering event. Verify `OrderCancelled → BookingCancelled`.

## 32. RBAC — HARD REVIEW

Implementation reuses permissions:
- prepare/send → `booking.send_supplier`
- clarification/confirm/reject/service/complete/problem → `booking.confirm`
- change → `booking.request_change`
- cancel → `booking.cancel`

Check whether this is semantically overbroad. A role allowed to confirm should not automatically gain unrelated high-impact actions unless current permission model intentionally groups them.

Test anonymous, BUYER, PARTNER, MODERATOR, SALES_MANAGER, OPERATOR, ADMIN.

## 33. IDOR

Verify unknown/foreign Booking behavior follows project neutral-response conventions.

## 34. Mass assignment

Forged status/money/acquisition/temporal/provenance/version/history/event fields must fail with loud 422 under project convention.

## 35. Step 2.8A temporal immutability — HARD GATE

Lifecycle and compensation must never mutate:
`serviceDate`, `serviceTime`, `serviceEndTime`, `serviceTimeZone`, `serviceStartsAt`, `serviceEndsAt`, `serviceTimeType`.

## 36. Money/acquisition freeze

Test DIRECT, BUYER_REQUEST and legacy null. No reprice or acquisition rewriting.

## 37. Availability ownership — CRITICAL

Implementation intentionally does not release holds on cancellation.

Determine whether that is acceptable.

Investigate:
- whether cancellation leaks capacity permanently;
- existing AvailabilityReservation lifecycle;
- Step 2.4/1.8C contracts;
- whether a future canonical step explicitly owns release.

If cancellation requires release for correctness but no owner/policy exists, architecture decision required. Do not invent cross-domain release.

## 38. Finance isolation

Zero Payment/Refund/Settlement/Payout/Invoice writes.

## 39. PII / events / logs

No passenger/passport PII in events/history/audit/logs. Compensation reasons stable and safe.

## 40. BookingHistory

Exactly one row per real transition. Failed/stale commands: zero. Review `cancelled_order` and `created_cancelled` naming/analytics semantics.

## 41. Step 2.9A boundary — HARD GATE

Roadmap reserves 2.9A for:
`createdAt`, `requestedAt`, `confirmedAt`, `rejectedAt`, `cancelledAt`, `completedAt`, history/SLA timestamps.

Verify 2.9 added/redefined none of these milestone columns.

At the same time prove lifecycle transitions are deterministic enough for 2.9A to attach timestamps later.

## 42. Legacy compatibility

Test legacy `orderItemId=null`, `acquisitionSource=null`, `AWAITING_CONFIRMATION`, missing 2.8A temporal facts and old history.

## 43. Migration/schema

No migration should be needed if all status/version/history support existed. Verify no durable idempotency/index invariant is missing for compensation.

## 44. API/docs

Docs must match runtime:
- all statuses/actions;
- permissions;
- terminal states;
- AWAITING_CONFIRMATION reserve;
- marker-state semantics;
- compensation;
- no reschedule/reprice;
- no Availability release;
- 2.9A boundary.

## 45. Targeted coverage audit

Map concrete tests to at least:
initial NEW; prepare; clarification; resume; confirm; reject; change request; resolve change; cancellation request; cancel; complete; terminal reopen; legacy AWAITING_CONFIRMATION confirm/reject; OrderCancelled after Booking; before BookingRequested; terminal compensation; duplicate compensation; multi-item; confirm-vs-reject; confirm-vs-cancel; complete-vs-cancel; compensation-vs-confirm; compensation-vs-complete; single canonical events; exact history; rollback; all roles; IDOR; 422 mass assignment; DIRECT/BUYER_REQUEST/null; temporal immutability; no reprice; no second hold; no Finance; no direct Order writes; no raw 500.

Add missing high-risk tests.

## 46. Mandatory Order reconciliation matrix

Create/verify E2E for 2+ Bookings:

1. confirmed + NEW
2. completed + confirmed
3. completed + rejected
4. completed + cancelled
5. all completed
6. all rejected
7. all cancelled
8. completed + rejected + cancelled

For each state the expected Order status and justify it from canonical semantics.

This matrix is mandatory before approval.

## 47. Full regression

After review fixes run:

**Backend:** typecheck, build, full unit, targeted 2.9, 2.8A, 2.8, 2.7, 2.6, 2.5/2.5A/2.5B, canonical Order events, Booking creation, Availability, Reverse 2.2A–F, 1.8A–D, acquisition, RBAC, PII/event envelope, Buyer Cabinet, full serial E2E.

**Frontend:** tsc, vitest, production build.

**DB:** migrate status, fresh replay, supported drift verification.

Report actual counts.

## 48. Review-fix policy

Architecture-neutral defects may be fixed now. For each:
`defect → risk → patch → regression test → targeted rerun → full rerun`.

Do not start 2.9A.

## 49. Architecture stop conditions

Return:
`PHASE 2 STEP 2.9 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

if unresolved:

1. AWAITING_CONFIRMATION needs a current producer but lacks one;
2. born-CANCELLED Booking after prior Order cancellation is undefined;
3. BookingCompleted and BookingStatusChanged are competing fulfillment authorities;
4. all-terminal→Order FULFILLED conflicts with business meaning;
5. BookingConfirmed incorrectly implies partial fulfillment;
6. BookingCancelled requires Order reconciliation but policy undefined;
7. Booking cancellation must release Availability but no canonical owner/policy exists;
8. completion authority is undefined;
9. reused permissions are materially overbroad;
10. correct fix requires 2.9A/Finance.

## 50. Approval criteria

Approve only if lifecycle semantics, compensation, Order reconciliation, events, RBAC, CAS, idempotency, atomicity, frozen facts, Availability boundary, legacy compatibility and 2.9A boundary are all proven.

## 51. Roadmap update

Only if approved:
- Step 2.9 → `✅ STRICT REVIEW COMPLETED — APPROVED` or `APPROVED WITH REVIEW FIXES`;
- exact NEXT from current Roadmap, expected `PHASE 2 — STEP 2.9A — BOOKING TEMPORAL CONTRACT`;
- do not begin 2.9A.

## 52. Required final report

# PHASE 2 — STEP 2.9 — BOOKING LIFECYCLE COMPLETION — STRICT REVIEW REPORT

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target reconciliation
5. Booking write-path audit
6. Final status vocabulary
7. Single state-machine authority
8. Transition matrix
9. Initial state
10. PREPARING_REQUEST
11. NEEDS_CLARIFICATION
12. AWAITING_CONFIRMATION
13. Confirmation
14. Rejection
15. Cancellation request
16. Order-cancel compensation
17. OrderCancelled-before-BookingRequested
18. Terminal compensation rules
19. Change handling
20. Other marker states
21. BookingCompleted
22. BookingStatusChanged reconciliation
23. Booking → Order ownership
24. Order multi-item reconciliation
25. PARTIALLY_FULFILLED semantics
26. BookingConfirmed → Order behavior
27. BookingRejected → Order behavior
28. BookingCancelled → Order behavior
29. CAS / concurrency
30. Idempotency
31. Transaction / Outbox atomicity
32. Correlation / causation
33. RBAC
34. IDOR
35. Mass assignment
36. 2.8A temporal immutability
37. Money / acquisition freeze
38. Availability ownership
39. Finance isolation
40. PII / logging / events
41. History
42. Step 2.9A boundary
43. Legacy compatibility
44. Migration / schema
45. API / docs
46. Targeted coverage audit
47. Order reconciliation matrix
48. Backend regression
49. Frontend regression
50. DB regression
51. Issues found
52. Review fixes applied
53. Architecture decision status
54. Documentation status
55. Roadmap update
56. Deferred / extension points
57. Out-of-scope confirmation
58. Exact files changed during review
59. **Exact NEXT item**

Final line must repeat the exact verdict.

## 53. STOP

After Strict Review: **STOP**.

Do not implement Step 2.9A in this pass.
