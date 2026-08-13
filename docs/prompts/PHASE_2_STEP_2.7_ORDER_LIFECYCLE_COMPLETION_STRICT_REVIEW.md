# PHASE 2 — STEP 2.7 — ORDER LIFECYCLE COMPLETION — STRICT REVIEW

**Project:** TravelHub  
**Mode:** STRICT REVIEW / REVIEW FIXES ONLY  
**Entering status:** `PHASE 2 STEP 2.7 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`  
**Expected NEXT only if approved:** `PHASE 2 — STEP 2.8 — BOOKINGREQUESTED → BOOKING CREATION`  
**Hard stop:** do not implement Step 2.8 in this pass.

## 1. Mission

Perform an independent adversarial review of the actual Step 2.7 implementation. Do not approve from the implementation report alone.

Verify the Order-owned lifecycle, stable status codes, transition guards, history, temporal milestones, SLA semantics, RBAC, CAS/concurrency, canonical events, acquisition/money immutability, and the Step 2.7 ↔ 2.8 ownership boundary.

Final verdict must be exactly one of:

- `PHASE 2 STEP 2.7 STRICT REVIEW COMPLETED — APPROVED`
- `PHASE 2 STEP 2.7 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
- `PHASE 2 STEP 2.7 STRICT REVIEW COMPLETED — CHANGES REQUIRED`
- `PHASE 2 STEP 2.7 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 2. Sources

Inspect current Roadmap, Architecture Master/Baseline, Screen Design Brief, Step 1.14 Canonical Order Events, Steps 2.5/2.5A/2.5B/2.6 implementation+reviews, Order service/controller/subscribers, Booking subscribers, domain-events, permissions, history, API docs, Step 2.7 tests.

Current Roadmap wins if this prompt conflicts with it.

## 3. Baseline

Record branch, HEAD, origin relation, dirty/untracked files, migration count, Roadmap status, whether Step 2.7 is committed, and whether Step 2.8 has accidentally started.

## 4. Rebuild the lifecycle

Verify the final canonical status set and exact transition matrix. Inspect at minimum:

`NEW`, `IN_PROCESSING`, `WAITING_FOR_DATA`, `READY_FOR_BOOKING`, `SENT_TO_BOOKING`, `PARTIALLY_FULFILLED`, `FULFILLED`, `READY_TO_CLOSE`, `CLOSED`, `CANCELLED`, `PROBLEM`, `SUSPENDED`.

For every state document:
- entry path;
- exit path;
- guard;
- actor;
- milestone;
- history;
- event;
- terminal/non-terminal semantics.

## 5. Single authority — HARD GATE

Implementation claims `OrderService.TRANSITIONS` is the sole transition authority.

Repository-wide search all Order status writes. No controller, consumer, raw Prisma call, Booking subscriber or alternate service may bypass the canonical state machine unsafely.

## 6. Initial state

Canonical `OrderRequested → Order` creation must still produce the approved initial state (reported `NEW`) without auto-processing, readiness, BookingRequested, Booking creation, repricing or acquisition mutation.

## 7. NEW / processing / WAITING_FOR_DATA

Review process/start-processing and waiting-data round-trip. Validate source states, CAS, history, RBAC and blockers.

## 8. READY_FOR_BOOKING — HARD GATE

Verify `confirm` or the actual canonical action truly means transition to `READY_FOR_BOOKING`.

Review whether `confirmedAt` semantically matches this business fact under current canonical docs.

On the real transition prove:
- readiness guard;
- state change;
- one history fact;
- one `OrderReadyForBooking`;
- transaction/outbox atomicity;
- retry/concurrency safety.

## 9. Readiness guard

Implementation says all travelers must be COMPLETE.

Verify the authoritative source and cross-category validity. Ensure non-traveler service categories are not incorrectly blocked. Confirm no payment/document/supplier/availability/repricing guards were invented without canonical source.

## 10. OrderReadyForBooking event

Verify exact event name, payload, version, aggregate, PII boundary, occurredAt, actor, request/correlation/causation. It must emit only on real transition, never on state reconstruction or retry.

## 11. Send to Booking Center

Verify explicit command only from READY_FOR_BOOKING, expected post-state (reported SENT_TO_BOOKING), authorization, guard, CAS, history, atomic outbox, duplicate/concurrent safety.

## 12. BookingRequested contract

Review payload against approved event contract. No mutable Catalog re-read, no cross-domain dump, no excessive PII.

## 13. CRITICAL — Step 2.7 ↔ 2.8 boundary

Implementation report says a pre-existing `booking.subscribers.ts` consumer already creates Booking from BookingRequested, while current Roadmap defines Step 2.8 as `BookingRequested → Booking Creation`.

Determine exactly:

1. Does current production runtime create a real Booking after send-to-booking?
2. Is that consumer registered in production?
3. Was it approved as earlier Phase 1 scaffolding?
4. Is Step 2.8 intended to harden/reconcile that existing consumer rather than first create it?
5. Does current Roadmap acknowledge the pre-existing consumer?
6. Does Step 2.8 still have a clear meaningful scope?

Do not delete the existing consumer just to make Step 2.7 look isolated.

If current Roadmap says Booking creation must only begin in 2.8 and no prior approved architecture justifies the already-active consumer:

`PHASE 2 STEP 2.7 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

## 14. Booking ownership

Order may publish BookingRequested but must not directly write `booking.*`. Verify all writes remain Booking-owned.

## 15. OrderApproved

Verify no producer/consumer uses OrderApproved as booking trigger. Reconcile any surviving definition/documentation with canonical Step 1.14 semantics.

## 16. OrderStatusChanged

Audit all producers/consumers. Generic status event must not substitute for canonical `OrderReadyForBooking`, `BookingRequested`, `OrderFulfilled` or `OrderClosed`.

## 17. PARTIALLY_FULFILLED

Verify authoritative semantics and whether it depends on Booking reconciliation. Do not accept fabricated partial fulfillment based merely on counts or existence.

## 18. FULFILLED / OrderFulfilled

Implementation says explicit completion or Booking reconciliation may lead to FULFILLED.

Verify both are canonically authorized. If both exist, prove race safety, one fulfilledAt, one OrderFulfilled, one history fact. If fulfillment authority is undefined, architecture decision required.

## 19. READY_TO_CLOSE — CRITICAL

Implementation says READY_TO_CLOSE has no producer and close goes directly from FULFILLED.

Screen Design includes READY_TO_CLOSE.

Determine whether:
- it is intentionally reserved for later Finance/Documents readiness;
- direct FULFILLED → CLOSED is canonical;
- or Step 2.7 is incomplete.

If authoritative sources disagree, return architecture decision required.

## 20. CLOSED / OrderClosed

Verify predecessor(s), explicit close action, first-only closedAt, history, exactly one event, CAS, retry behavior, no reopen.

## 21. Cancellation

Review allowed/forbidden sources, cancelledAt, history/event, idempotency, no Finance/Booking orchestration or cross-domain Availability write unless already approved.

## 22. PROBLEM / SUSPENDED

Verify marker-state semantics, entry, blocking effect and whether absence of recovery is acceptable under the current Roadmap.

## 23. Temporal contract

Re-verify `createdAt`, `submittedAt`, `confirmedAt`, `cancelledAt`, `fulfilledAt`, `closedAt`: server-owned, first-transition only, immutable on retry, history occurredAt separate, updatedAt not a milestone.

## 24. History / audit

Exactly one OrderHistory for each real transition. No false history on failed/stale request. No PII dump. Security audit and domain history remain distinct where canonical.

## 25. SLA — HARD REVIEW

Roadmap explicitly says SLA.

Implementation defines SLA as computable from immutable milestones/history without persisted deadlines.

Inspect current SLA requirements. Determine whether this fully satisfies Step 2.7.

If Roadmap requires dueAt/overdue/policy duration/breach facts, implementation is incomplete. If persisted SLA is required but no duration policy exists, architecture decision required.

## 26. RBAC

Verify actual role behavior for OPERATOR, SALES_MANAGER, ADMIN, BUYER, PARTNER, MODERATOR and anonymous users. No accidental universal order write.

## 27. IDOR

Test nonexistent/foreign Orders and alternate identifiers according to project neutral-response conventions.

## 28. Mass assignment

Attempt forged status, milestones, IDs, money, acquisition, ownership, version, history/event metadata.

Earlier project conventions often required forbidden system keys to fail loudly. If Step 2.7 silently strips fields where canonical convention requires 422, fix it.

## 29. CAS / concurrency

Independently test:
- process vs cancel;
- confirm vs cancel;
- duplicate confirm;
- send vs cancel;
- duplicate/concurrent send;
- fulfill vs cancel;
- reconcile vs explicit fulfill;
- close vs competing transition.

Prove deterministic winner, controlled 409/no-op, one milestone/history/event, no raw 500.

## 30. Idempotency

For confirm/send/fulfill/close/cancel, document retry HTTP semantics and prove business effect exactly once.

## 31. Transaction / Outbox atomicity

For event-producing transitions prove:

`state + milestone + history + outbox`

commit atomically. No partial state on failure.

## 32. Correlation / causation — CRITICAL

Implementation report says HTTP commands use server UUID correlation and null causation.

Compare with ADR-0009/0010/request-context.

Verify whether HTTP command should inherit/request a canonical correlation ID rather than invent a fresh disconnected UUID. If code discards canonical request correlation, fix it.

## 33. Acquisition immutability

Lifecycle from creation to close must preserve source. Test DIRECT plus BUYER_REQUEST or another non-DIRECT source supported by current system.

## 34. Money / pricing immutability

No lifecycle action may alter amount/currency or re-resolve Tariff/CommercialPeriod/CommercialRestriction. Run relevant 1.8A–D/Quote-freeze regression.

## 35. Availability isolation

No lifecycle action creates a second hold. Inspect cancellation and any release path for ownership compliance.

## 36. Booking side-effect reality

If Step 2.7 send already results in Booking due to pre-existing production consumer, final docs/report must state this truthfully and explain Step 2.8's remaining scope.

Do not say “Booking creation not implemented” without qualification if runtime already creates it.

## 37. Legacy compatibility

Test legacy Order without canonical Sale provenance, nullable acquisition where historically allowed and older null temporal fields.

## 38. Migration / DB

Implementation says no migration. Verify all required status/version/history/milestone/SLA support already exists and CAS is schema-safe.

## 39. API/docs

Review lifecycle endpoints, transition rules, error semantics, SLA, READY_FOR_BOOKING, handoff and Step 2.8 boundary. Docs must match actual runtime.

## 40. Targeted coverage audit

Implementation reports 27 E2E tests. Do not approve by count.

Ensure coverage for at least:
- initial NEW;
- processing;
- waiting-data;
- readiness guard;
- ready + one event;
- retry/concurrent ready;
- send only from ready;
- one BookingRequested;
- duplicate/concurrent send;
- RBAC;
- IDOR;
- mass assignment;
- cancel;
- fulfilled;
- close;
- READY_TO_CLOSE assessment;
- temporal immutability;
- exact history;
- correlation/causation;
- DIRECT + non-DIRECT acquisition;
- money immutable;
- availability hold unchanged;
- Booking ownership;
- legacy Order;
- process-vs-cancel;
- send-vs-cancel;
- fulfill race;
- rollback atomicity;
- no raw 500.

Add missing critical cases.

## 41. Step 1.14 reconciliation

Because production delta is reported as zero, prove Step 2.7 legitimately closes earlier deferred lifecycle work rather than merely adding tests/docs around an incomplete implementation.

List exactly what Step 1.14 deferred and what Step 2.7 now verifies/reconciles.

## 42. Full regression

After review fixes run:

Backend:
- typecheck/build;
- full unit;
- targeted 2.7;
- Step 1.14;
- 2.4;
- 2.5;
- 2.5A;
- 2.5B;
- 2.6;
- Reverse 2.2A–F;
- 1.8A–D;
- Availability;
- RBAC;
- PII/event envelope;
- Buyer Cabinet/Order reads;
- full serial E2E.

Frontend:
- tsc;
- vitest;
- production build.

Database:
- migrate status;
- fresh replay;
- repository-supported drift verification.

Report actual counts, not copied implementation counts.

## 43. Review-fix policy

Architecture-neutral local defects may be fixed in this pass. For each: defect → risk → patch → regression test → targeted/full rerun.

Do not implement Step 2.8.

## 44. Architecture stop conditions

Return:

`PHASE 2 STEP 2.7 STRICT REVIEW BLOCKED — ARCHITECTURE DECISION REQUIRED`

if any unresolved issue includes:
- active BookingRequested consumer conflicts with Step 2.8 ownership;
- READY_FOR_BOOKING semantics unclear;
- confirmedAt meaning conflicts;
- READY_TO_CLOSE canonicality conflicts;
- fulfillment authority undefined;
- SLA requires policy not defined;
- traveler completeness invalid across categories;
- event correlation conflicts with ADR;
- Step 1.14 event contract requires incompatible change;
- correct resolution requires starting Step 2.8.

## 45. Approval criteria

Approve only if state machine, guards, events, temporal facts, SLA, RBAC, concurrency, atomicity, acquisition/money freeze, availability/Booking ownership, legacy compatibility and 2.7↔2.8 boundary are all proven.

## 46. Roadmap update

Only if approved:
- Step 2.7 → `✅ STRICT REVIEW COMPLETED — APPROVED` or `APPROVED WITH REVIEW FIXES`;
- exact NEXT from current Roadmap, expected Step 2.8;
- Step 2.8 remains not started in this pass.

## 47. Required final report

# PHASE 2 — STEP 2.7 — ORDER LIFECYCLE COMPLETION — STRICT REVIEW REPORT

1. Verdict
2. Repository baseline
3. Sources inspected
4. Current → Target reconciliation
5. Single state-machine authority
6. Final stable status codes
7. Allowed transition matrix
8. Initial state
9. NEW / processing
10. WAITING_FOR_DATA
11. READY_FOR_BOOKING semantics
12. Readiness guard
13. OrderReadyForBooking event
14. Send to Booking Center
15. BookingRequested contract
16. Step 2.7 ↔ 2.8 boundary
17. Existing BookingRequested consumer assessment
18. Booking ownership
19. OrderApproved reconciliation
20. OrderStatusChanged reconciliation
21. PARTIALLY_FULFILLED
22. FULFILLED / OrderFulfilled
23. READY_TO_CLOSE assessment
24. CLOSED / OrderClosed
25. Cancellation
26. PROBLEM / SUSPENDED
27. Temporal contract
28. History / audit
29. SLA
30. RBAC
31. IDOR
32. Mass assignment
33. Concurrency / CAS
34. Idempotency
35. Transaction / Outbox atomicity
36. Correlation / causation
37. Acquisition immutability
38. Money / pricing immutability
39. Availability isolation
40. Booking side-effect reality
41. Legacy compatibility
42. Migration / DB
43. API/docs
44. Targeted coverage audit
45. Step 1.14 reconciliation
46. Backend regression
47. Frontend regression
48. DB regression
49. Issues found
50. Review fixes applied
51. Architecture decision status
52. Roadmap update
53. Out-of-scope confirmation
54. Exact files changed during review
55. **Exact NEXT item**

Final line must repeat the exact verdict.

## 48. STOP

After Step 2.7 Strict Review: **STOP**.

Do not implement Step 2.8 in this pass.
