# PHASE 2 — STEP 2.9A — BOOKING TEMPORAL CONTRACT — STRICT REVIEW PROMPT

**Project:** TravelHub  
**Mode:** STRICT REVIEW / ADVERSARIAL CERTIFICATION  
**Entering status:** `PHASE 2 STEP 2.9A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`  
**Reported baseline:** backend unit `475/475`, targeted E2E `149/149`, full serial E2E `1012/1012` (56 suites), frontend `135/135`, migrations `46/46`, drift clean.  
**Hard stop:** do not implement Step 2.10 or any Finance functionality in this pass.

## 1. Mission

Independently certify Step 2.9A. Do not approve from the implementation report or green counts alone.

Verify Booking lifecycle milestones are server-authoritative, first-transition-only, immutable, atomic with status/history/outbox, race-safe, legacy-safe, distinct from Step 2.8A service occurrence, and do not enter Finance or Availability-release scope.

Final verdict must be exactly one of:

- `PHASE 2 STEP 2.9A STRICT REVIEW COMPLETED — APPROVED`
- `PHASE 2 STEP 2.9A STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 2 STEP 2.9A STRICT REVIEW COMPLETED — CHANGES REQUIRED`
- `PHASE 2 STEP 2.9A STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 2. Mandatory sources

Inspect current Roadmap, Architecture Master/Baseline, Screen Design Brief, Step 2.5A, Step 2.7, Step 2.8, Step 2.8A, Step 2.9 implementation+Strict Review, Step 2.9A implementation prompt/report, `schema.prisma`, migration `20260813082717_add_booking_temporal_contract`, Booking service/subscribers/controller/validation, BookingHistory, event contracts, request-context/EventBus conventions, temporal-readiness tests and booking-temporal-contract tests.

Current canonical Roadmap wins on conflict.

## 3. Baseline

Record branch, HEAD, origin relation, dirty/untracked files, inherited uncommitted changes, migration status, Roadmap state, exact Step 2.9A files, and whether Step 2.10/Finance has accidentally started.

## 4. Current → Target temporal map

Build a table for:

- createdAt
- requestedAt
- confirmedAt
- rejectedAt
- cancelledAt
- completedAt

For each: producer transition, writer, first-only semantics, atomicity, nullability, legacy behavior.

## 5. Lifecycle time ≠ service occurrence — HARD GATE

Re-certify separation between lifecycle timestamps and Step 2.8A:

- serviceDate
- serviceTime
- serviceEndTime
- serviceTimeZone
- serviceStartsAt
- serviceEndsAt
- serviceTimeType

No lifecycle milestone may derive from service occurrence and no lifecycle transition may mutate those fields.

## 6. Schema review

Verify exactly the intended nullable lifecycle milestone columns were added, with no fake defaults/backfill and no Finance milestone such as paidAt.

## 7. Migration review — HARD GATE

Inspect `20260813082717_add_booking_temporal_contract`.

Verify additive nullable columns, no `NOW()` backfill, no data rewrite, clean replay, upgrade safety, no `db push`, current migration count 46/46 and drift/diff clean.

## 8. createdAt semantics

Confirm createdAt remains Booking aggregate persistence time, not supplier-request time.

## 9. requestedAt — CRITICAL

Implementation says `requestedAt` is set on `send`.

Verify:
- exact transition/action;
- it truly means Booking request sent to supplier;
- one producer;
- server-owned;
- first-only;
- atomic;
- retry-safe;
- legacy rows may remain null.

If canonical sources define request time differently, require fix or architecture decision.

## 10. confirmedAt

Only real transition to CONFIRMED may set it. Verify normal, retry and race scenarios.

## 11. rejectedAt

Only real transition to SUPPLIER_REJECTED may set it. Do not conflate with cancellation.

## 12. cancelledAt — CRITICAL

Audit all paths:
1. explicit cancel;
2. OrderCancelled compensation;
3. born-CANCELLED after prior Order cancellation.

Each path must have a defensible timestamp authority.

## 13. born-CANCELLED temporal truth — HARD GATE

Implementation chooses `cancelledAt = createdAt`.

Review whether this is canonical and analytically truthful.

Ask:
- should cancelledAt represent Booking creation in already-cancelled state?
- or upstream OrderCancelled occurredAt?
- could zero cancellation latency mislead analytics/SLA?
- would using upstream time create a Booking cancellation timestamp before Booking existence?

If canonical sources do not determine the rule and it materially affects business truth: `ARCHITECTURE DECISION REQUIRED`.

## 14. Compensation cancelledAt

For existing active Booking cancelled by OrderCancelled:
- set once;
- atomic with state/history/BookingCancelled;
- replay does not move timestamp;
- terminal Booking untouched;
- lineage preserved.

## 15. completedAt

Only genuine IN_SERVICE→COMPLETED sets it. Never derive from serviceEndsAt, Payment, Order status or current date.

## 16. Non-persisted marker timestamps

Do not require extra columns for clarification/change/problem/preparation unless current Roadmap explicitly requires them. BookingHistory may remain the source for those transition times.

## 17. First-only write audit — HARD GATE

Repository-wide search every milestone field. Classify all production writers.

Verify no writer can overwrite, reset or “repair” milestone after stale CAS.

Cross-domain writer count must be zero.

## 18. Server time authority

Inspect how `now` is captured. Client cannot supply milestones. One logical transition should use a coherent server time source.

## 19. Transaction atomicity — HARD GATE

For each milestone transition prove:

`status + version + milestone + BookingHistory + outbox event`

commit atomically. Failure leaves none of them.

## 20. CAS / concurrency

Test:
- confirm/confirm
- confirm/reject
- confirm/cancel
- complete/cancel
- compensation/confirm
- compensation/complete
- duplicate compensation

Truthful milestone combinations only, no raw 500.

## 21. confirmedAt <= cancelledAt

Implementation accepts both when confirm wins then compensation cancels.

Review whether `<=` is robust, whether equal timestamps are allowed, and whether one canonical time source avoids clock-skew assumptions.

Do not require artificial 1ms ordering.

## 22. BookingHistory relationship

For each milestone transition verify matching history action/from/to/occurredAt. Milestone columns are selected projections, not replacement for history.

## 23. Event occurrence relationship

Milestone, history and event should represent one business transition without contradictory ordering. Do not change EventBus globally.

## 24. Mass assignment — HARD GATE

Test forged:
- requestedAt
- confirmedAt
- rejectedAt
- cancelledAt
- completedAt

Expected loud 422 under project convention, with zero state/milestone changes.

## 25. API projections

If milestone fields are exposed, confirm authorized explicit projection, ISO UTC, nullable/read-only semantics, and no accidental public leakage.

## 26. Legacy compatibility — HARD GATE

Historical Booking may have terminal/active status and null milestones. Also test orderItemId null, acquisition null, AWAITING_CONFIRMATION, missing 2.8A fields.

No backfill from updatedAt.

## 27. temporal-readiness test evolution

Review the changed Step 1.13A test. Ensure it reflects legitimate 2.9A evolution and still asserts unrelated future fields such as paidAt remain absent.

## 28. SLA foundation

Determine whether milestone fields + BookingHistory satisfy current 2.9A SLA-readiness requirement.

Do not invent SLA duration, dueAt, breach thresholds or escalation policy.

## 29. Step 2.8A regression

Lifecycle milestones must not alter service occurrence fields. Test both date-only and exact-time Booking.

## 30. Money/acquisition freeze

DIRECT, BUYER_REQUEST and legacy null remain immutable. No repricing.

## 31. Availability isolation

Zero Availability writes. cancelledAt must not become hidden release trigger.

## 32. Finance isolation — HARD GATE

Zero Payment/Refund/Settlement/Payout/Invoice/paidAt behavior. Step 2.10 must remain untouched.

## 33. RBAC / IDOR

No new write permission solely for timestamps. Unauthorized roles cannot set milestones or bypass existing object-scope rules.

## 34. Indexing

No speculative milestone indexes unless current Roadmap/query paths require them.

## 35. Events

No duplicate timestamp-specific events. Existing Step 2.9 canonical/technical events remain unchanged.

## 36. Required temporal matrix

Verify:

| Fact | Expected milestone |
|---|---|
| Booking created NEW | createdAt only |
| supplier request sent | requestedAt |
| CONFIRMED | confirmedAt |
| SUPPLIER_REJECTED | rejectedAt |
| explicit CANCELLED | cancelledAt |
| compensated CANCELLED | cancelledAt |
| born-CANCELLED | canonical resolved rule |
| COMPLETED | completedAt |
| clarification/change/problem | no dedicated milestone unless Roadmap requires |

All unrelated milestone columns stay null.

## 37. Negative coverage audit

Ensure tests cover:
1. forged each of 5 milestones → 422;
2. failed confirm/reject/cancel/complete does not set milestone;
3. retry does not rewrite;
4. terminal reopen does not rewrite;
5. unauthorized roles;
6. legacy null milestones;
7. no Availability write;
8. no Finance write;
9. service occurrence immutable;
10. money/acquisition immutable;
11. no raw 500.

Add missing high-risk tests.

## 38. Positive coverage audit

Ensure:
- requestedAt correct producer;
- confirmedAt once;
- rejectedAt once;
- explicit cancelledAt once;
- compensation cancelledAt once;
- born-CANCELLED canonical rule;
- completedAt once;
- DIRECT/BUYER_REQUEST/null acquisition preserved;
- date-only/timed occurrence preserved;
- multi-item compensation timestamps each actually cancelled Booking;
- history/event lineage coherent;
- concurrency milestones truthful;
- migration replay clean.

## 39. Write-path audit

List every production milestone writer. Expected Booking-owned only: create consumer where applicable, lifecycle CAS, compensation subscriber.

## 40. DB regression

Run migrate status, fresh replay and current supported diff/drift verification. Report actual count.

## 41. Full backend regression

Run typecheck, build, full unit, 2.9A targeted, 2.9, 2.8A, 2.8, 2.7, 2.6, 2.5/2.5A/2.5B, temporal-readiness, canonical Order events, Availability, Reverse 2.2A–F, 1.8A–D, acquisition, RBAC, PII/event envelope, Buyer Cabinet, full serial E2E.

Report actual counts, not copied implementation counts.

## 42. Frontend regression

Run tsc, vitest and production build even if unchanged.

## 43. Review-fix policy

Architecture-neutral defects may be fixed now. For every fix:
`defect → risk → patch → regression test → targeted rerun → full rerun`.

Do not start Step 2.10.

## 44. Architecture stop conditions

Return:

`PHASE 2 STEP 2.9A STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

if unresolved:
1. requestedAt producer unclear;
2. born-CANCELLED cancelledAt authority undefined;
3. Roadmap requires missing milestone;
4. legacy requires fabricated backfill;
5. correct semantics require changing approved 2.9 lifecycle;
6. SLA requires undefined policy;
7. correct fix requires Availability release design;
8. correct fix requires Finance behavior;
9. lifecycle/service-occurrence separation fails;
10. Step 2.10 must be started to finish 2.9A.

## 45. Approval criteria

Approve only if milestone vocabulary/producer authority, first-only semantics, atomicity, race truthfulness, born-CANCELLED rule, legacy nulls, mass assignment, service-time isolation, money/acquisition freeze, no Availability/Finance side effects, clean migration and full regression are all proven.

## 46. Roadmap update

Only if approved:

Step 2.9A → `✅ STRICT REVIEW COMPLETED — APPROVED` or `✅ STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`.

Set the exact NEXT from current Roadmap. Expected family is Step 2.10 Finance, but do not assume an inserted gate does not exist.

Do not begin the next step.

## 47. Required final report

# PHASE 2 — STEP 2.9A — BOOKING TEMPORAL CONTRACT — STRICT REVIEW REPORT

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target reconciliation
5. Lifecycle vs service occurrence separation
6. Schema review
7. Migration review
8. createdAt semantics
9. requestedAt semantics
10. confirmedAt
11. rejectedAt
12. cancelledAt
13. born-CANCELLED temporal truth
14. compensation cancelledAt
15. completedAt
16. non-persisted marker timestamps
17. first-only write audit
18. server time authority
19. transaction atomicity
20. CAS/concurrency
21. confirmedAt/cancelledAt ordering
22. BookingHistory relationship
23. event occurrence relationship
24. mass assignment
25. API projections
26. legacy compatibility
27. temporal-readiness evolution
28. SLA foundation
29. Step 2.8A regression
30. money/acquisition freeze
31. Availability isolation
32. Finance isolation
33. RBAC / IDOR
34. Indexing
35. Events
36. Temporal matrix
37. Negative coverage
38. Positive coverage
39. Write-path audit
40. Backend regression
41. Frontend regression
42. DB regression
43. Issues found
44. Review fixes applied
45. Architecture decision status
46. Documentation status
47. Roadmap update
48. Deferred / extension points
49. Out-of-scope confirmation
50. Exact files changed during review
51. **Exact NEXT item**

Final line must repeat the exact verdict.

## 48. STOP

After Strict Review: **STOP**.

Do not implement Step 2.10 or Finance in this pass.
