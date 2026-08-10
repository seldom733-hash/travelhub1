# PHASE 2 — STEP 2.5A — ORDER TEMPORAL CONTRACT
## STRICT REVIEW PROMPT

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.5A — Order Temporal Contract  
**Mode:** STRICT REVIEW / REVIEW FIXES ONLY

# 1. MISSION

Perform an independent, code-first STRICT REVIEW of the completed Phase 2 Step 2.5A implementation.

Do NOT approve from the implementation report alone.

Reconstruct the actual temporal behavior from Prisma schema/migration, Order service/subscribers, Booking event subscribers, OrderHistory, AuditLog, canonical events, Roadmap, ADRs, tests, and runtime behavior.

The goal is to determine whether Order business milestones are explicit, truthful, immutable where required, and correctly owned by Order.

# 2. REVIEW BOUNDARY

Allowed:
- inspect all relevant code/docs/tests;
- add missing review tests;
- fix confirmed local Step 2.5A defects;
- make minimal documentation corrections.

Forbidden:
- Step 2.5B;
- Step 2.6 bootstrap removal;
- Step 2.7 Order lifecycle implementation;
- Step 2.8 Booking implementation;
- Reverse Marketplace implementation;
- Service Templates implementation;
- unrelated refactors.

If a required correction changes canonical lifecycle semantics or ownership materially:
`ARCHITECTURE DECISION REQUIRED`.

# 3. BASELINE

Report branch, HEAD, dirty/untracked files, exact Step 2.5A diff, migration count/status, pre-existing uncommitted Step 2.5 files, and unrelated user prompt files.

Do not overwrite prompt files.

# 4. SOURCES TO INSPECT

At minimum inspect:
- canonical Roadmap Step 2.5A;
- Step 2.5 implementation + Strict Review fixes;
- Order schema;
- Step 2.5A migration SQL;
- Order service;
- Order subscribers;
- Booking subscribers/events;
- Order controller/actions;
- OrderHistory;
- AuditLog;
- domain-events.ts;
- temporal-readiness docs/tests;
- request-context;
- relevant Phase 1 temporal ADR/docs;
- Step 2.7 planned lifecycle;
- Step 2.8 Booking foundation;
- all tests touching order status/milestones.

# 5. FIELD-BY-FIELD SEMANTICS

Build a matrix for:
- submittedAt
- confirmedAt
- cancelledAt
- fulfilledAt
- closedAt
- createdAt
- updatedAt

For each document:
- exact business meaning;
- writer;
- transaction boundary;
- nullable?;
- immutable after set?;
- can it be set more than once?;
- history/event relation;
- legacy/null semantics;
- server/client authority.

No field may have overlapping or ambiguous semantics.

# 6. CRITICAL REVIEW — submittedAt

The implementation report says `submittedAt` is set on both canonical OrderRequested consumer and bootstrap.

Determine whether this is actually canonical.

Questions:
- Does bootstrap represent a truly submitted Order or merely imported/legacy creation?
- Does Step 2.5A define submittedAt as “Order entered canonical submitted state” or merely “Order created”?
- If bootstrap is temporary legacy import, should submittedAt be null?
- Would setting submittedAt on bootstrap fabricate a business milestone?

Do not equate create-time with submitted-time unless explicitly canonical.

# 7. CRITICAL REVIEW — confirmedAt

Verify exact status transition, one-way/idempotent behavior, absence of direct patch bypass, retry stability, and relationship to history/event timing.

Do not add lifecycle behavior beyond existing canonical transitions.

# 8. CRITICAL REVIEW — cancelledAt / closedAt

Verify:
- cancelledAt only on canonical cancel;
- closedAt only on canonical close;
- terminal states are mutually exclusive;
- no race can set both.

Add a real concurrent cancel-vs-close test if absent.

# 9. CRITICAL REVIEW — fulfilledAt

Verify:
- exact Booking event(s) that drive it;
- PARTIALLY_FULFILLED does NOT set it;
- full fulfillment requires canonical full-fulfillment fact;
- duplicate/replay behavior;
- out-of-order event behavior;
- timestamp immutability.

Critical scope question:
Is this only a temporal projection of an already-existing FULFILLED transition, or did Step 2.5A introduce Step 2.7 lifecycle behavior prematurely?

If the latter, classify scope violation.

# 10. BOOKING → ORDER RECONCILE BOUNDARY

Verify Booking does not write Order directly. Order subscriber must own the update. Preserve ADR-0001, event lineage, dedup, and cross-context boundaries.

# 11. STATUS ↔ TIMESTAMP CONSISTENCY

Produce an allowed-combinations matrix.

Examples to inspect:
- NEW + confirmedAt;
- CANCELLED + closedAt;
- FULFILLED + fulfilledAt null;
- CLOSED + closedAt null;
- CONFIRMED + confirmedAt null.

Legacy rows may legitimately have null milestones; document segmentation rather than inventing backfill.

# 12. LEGACY / BOOTSTRAP SEMANTICS

Verify nullable columns, no fabricated backfill, old rows remain valid, DTOs tolerate null, analytics do not silently assume timestamp presence, and bootstrap semantics are honest.

# 13. IMMUTABILITY

Test that once set:
- confirmedAt cannot change;
- cancelledAt cannot change;
- fulfilledAt cannot change;
- closedAt cannot change;
- submittedAt follows canonical immutability semantics.

Duplicate/retry/concurrent processing must not rewrite timestamps.

# 14. CONCURRENCY

At minimum review/test:
- concurrent confirm;
- cancel vs close race;
- duplicate fulfillment events;
- reconcile race;
- duplicate OrderRequested delivery and submittedAt stability.

Expected:
- one milestone timestamp;
- no duplicate history;
- no contradictory terminal timestamps.

# 15. HISTORY / EVENT TIME RELATION

Compare milestone column timestamp, OrderHistory timing and canonical event occurredAt.

Do not force equality unless architecture requires it, but reject contradictory sequencing or mismatched business facts.

# 16. updatedAt MISUSE

Repo-wide search for Order.updatedAt used as submitted/confirmed/cancelled/fulfilled/closed business time.

Any remaining use must be justified or recorded as debt.

# 17. createdAt SEMANTICS

Verify createdAt remains persistence/entity creation time only. It must not silently become submittedAt.

# 18. SERVER AUTHORITY / MASS ASSIGNMENT

Clients must not set:
- submittedAt;
- confirmedAt;
- cancelledAt;
- fulfilledAt;
- closedAt;
- createdAt;
- updatedAt.

Check bootstrap/action/update DTOs and forbidden-key/global-validation behavior. Add negative tests if needed.

# 19. API PROJECTIONS / IDOR

Verify staff/buyer/partner projections expose temporal fields safely, preserve nullable semantics and do not widen access. Regress nullable-customer own-scope.

# 20. AUDIT

Ensure milestone changes do not create duplicate/conflicting AuditLog facts; details remain non-PII and correlation remains correct.

# 21. MIGRATION

Inspect SQL:
- additive nullable fields;
- no defaults;
- no backfill;
- no destructive rewrite;
- existing bootstrap rows survive;
- clean replay;
- drift zero.

Add indexes only if actual Step 2.5A queries justify them.

# 22. FAILURE ATOMICITY

Where timestamp + status + history/event represent one transition, they must commit/rollback coherently.

No timestamp without status, no status without required timestamp, no history without committed transition.

# 23. RECONCILE FAILURE / RETRY

For fulfilledAt via subscriber:
- failed attempt must not leave partial milestone;
- retry succeeds once;
- duplicate event does not rewrite timestamp;
- Inbox dedup remains safe.

# 24. ORDERCREATED / submittedAt

Do not expand OrderCreated speculatively. Only add submittedAt if the canonical contract explicitly requires it.

# 25. STEP 2.7 SCOPE GUARD

List behaviors that remain NOT IMPLEMENTED.

Confirm Step 2.5A did not add:
- new lifecycle endpoints;
- new statuses;
- auto-close;
- cancel orchestration;
- fulfillment orchestration;
- booking orchestration.

Only timestamps for existing canonical transitions are permitted.

# 26. STEP 2.8 SCOPE GUARD

Confirm no Booking creation, Booking lifecycle change, service completion workflow or reservation release/consume logic was introduced.

# 27. TEST HYGIENE REVIEW

Review:
- temporal-readiness update;
- rbac-actions cleanup;
- sales-center delta assertion.

Ensure they update obsolete assumptions without weakening unrelated invariants or hiding shared-DB leaks.

# 28. TARGETED TESTS REQUIRED IF ABSENT

Add:
1. bootstrap submittedAt semantics;
2. cancel vs close race;
3. duplicate confirm timestamp immutability;
4. duplicate fulfillment event timestamp immutability;
5. PARTIALLY_FULFILLED does not set fulfilledAt;
6. fulfilled replay does not change timestamp;
7. forbidden timestamp mass assignment;
8. legacy row with status + null milestone remains readable;
9. failure rollback for status+timestamp+history;
10. concurrent terminal transitions cannot set both cancelledAt/closedAt.

# 29. FULL REGRESSION

After review fixes run:

Backend:
- tsc;
- unit;
- targeted 2.5A e2e;
- Step 2.5 consumer e2e;
- Order canonical events;
- Booking regression;
- request-context/eventbus/inbox/outbox relevant suites;
- full serial e2e.

Frontend:
- tsc;
- vitest;
- next build.

DB:
- migrate status;
- clean replay;
- drift.

Report exact counts/skips/timeouts.

# 30. RUNTIME VERIFICATION

On isolated environment verify canonical Order submittedAt, bootstrap behavior, confirm once, partial/full reconcile behavior, cancel/close exclusivity, duplicate/retry stability, and no Booking/Payment side effects.

Use actual configured/free ports if standalone runtime is used; do not hardcode port numbers as architecture contract.

# 31. APPROVAL GATES

Approve only if:
1. every milestone has unambiguous meaning;
2. submittedAt is not fabricated;
3. createdAt/updatedAt remain technical timestamps;
4. server authority is preserved;
5. milestone timestamps are immutable/idempotent;
6. terminal milestones are race-safe;
7. fulfilledAt only follows full canonical fulfillment;
8. cross-context reconcile respects ownership;
9. legacy rows remain honest/null-safe;
10. no Step 2.7 scope creep;
11. no Step 2.8 scope creep;
12. migration is honest;
13. full regression is green.

# 32. FINAL REPORT FORMAT

Return:

# PHASE 2 — STEP 2.5A — ORDER TEMPORAL CONTRACT — STRICT REVIEW — ОТЧЁТ

## 1. Verdict
One of:
`PHASE 2 STEP 2.5A STRICT REVIEW COMPLETED — APPROVED`
`PHASE 2 STEP 2.5A STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`
`PHASE 2 STEP 2.5A STRICT REVIEW COMPLETED — CHANGES REQUIRED`
`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Sources inspected
## 4. Actual temporal flow
## 5. Field semantics matrix
## 6. submittedAt review
## 7. confirmedAt review
## 8. cancelledAt / closedAt review
## 9. fulfilledAt review
## 10. Booking→Order reconcile boundary
## 11. Status/timestamp consistency
## 12. Legacy/bootstrap semantics
## 13. Immutability
## 14. Concurrency
## 15. History/event timing
## 16. createdAt/updatedAt review
## 17. Mass assignment / authority
## 18. API projections / IDOR
## 19. Audit
## 20. Migration
## 21. Failure atomicity
## 22. Step 2.7 scope guard
## 23. Step 2.8 scope guard
## 24. Test hygiene
## 25. Targeted test results
## 26. Full regression
## 27. Runtime verification
## 28. Findings
## 29. Review fixes
## 30. Remaining debt
## 31. Architecture decision status
## 32. Out-of-scope confirmation
## 33. Files changed during review

Final line repeats verdict.

# 33. STOP CONDITION

After Strict Review and permitted review fixes: STOP.

Do NOT start Step 2.5B, 2.6, 2.7, 2.8, Reverse Marketplace ADR, 2.2A–2.2F or 1.8A–1.8D.

Wait for explicit next instruction.
