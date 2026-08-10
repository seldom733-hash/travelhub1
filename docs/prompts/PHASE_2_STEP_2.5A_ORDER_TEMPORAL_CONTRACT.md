# PHASE 2 — STEP 2.5A — ORDER TEMPORAL CONTRACT
## IMPLEMENTATION PROMPT

**Project:** TravelHub
**Phase:** 2
**Step:** 2.5A — Order Temporal Contract
**Mode:** IMPLEMENTATION
**Prerequisite:** Phase 2 Step 2.5 Strict Review APPROVED
**Roadmap prerequisite status:** Service Templates / Period Pricing & Availability amendment Strict Review APPROVED WITH REVIEW FIXES

# 1. MISSION

Implement exactly canonical Roadmap Step 2.5A: the Order temporal contract.

The goal is to make Order business milestones explicit and semantically correct instead of using `createdAt` / `updatedAt` as substitutes for business time.

Do not start Step 2.5B or later work.

# 2. FIRST ACTION — RECONSTRUCT CANONICAL REQUIREMENTS

Before changing code, inspect the current canonical Roadmap and repository.

At minimum inspect:
- Step 2.5A text in `TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- Step 2.5 and its Strict Review fixes;
- Order schema/service/controller/contracts/history;
- OrderRequested → OrderCreated consumer;
- bootstrap Order path;
- Order lifecycle foundations and future Step 2.7;
- Booking foundations and future Step 2.8;
- domain event contracts;
- AuditLog conventions;
- existing temporal/date helpers and project UTC conventions;
- tests that currently infer business milestones from `createdAt` or `updatedAt`.

The Roadmap is authoritative. If this prompt conflicts with the current canonical Roadmap, follow the Roadmap and report the discrepancy.

# 3. CURRENT → TARGET MAPPING

Document before implementation:

## Current
Identify every Order timestamp currently present and what code actually uses it for.

## Target
Implement only the explicit temporal facts required by Step 2.5A.

Do not invent timestamps because they “may be useful later”.

# 4. TEMPORAL SEMANTICS

For every new milestone field, document:

- exact business meaning;
- owner;
- who/what sets it;
- whether nullable;
- whether immutable once set;
- whether it is user-provided or server-derived;
- event/history relationship;
- UTC/date-time semantics.

Required invariant:

`createdAt` = entity persistence creation time.

It MUST NOT silently mean:
- submitted;
- confirmed;
- paid;
- cancelled;
- completed;
- fulfilled;
- booked;
- service-started.

`updatedAt` MUST NOT be used as a business milestone.

# 5. SERVER AUTHORITY

Business milestone timestamps are server-owned.

Clients must not be able to forge:
- canonical milestone timestamps;
- createdAt/updatedAt;
- event timestamps;
- actor timestamps.

Apply existing whitelist/forbidden-key/mass-assignment conventions.

If bootstrap DTOs or existing update DTOs expose new fields accidentally, close that path.

# 6. EXISTING ORDER CREATION FLOW

Preserve canonical flow:

Sale
→ OrderRequested
→ Order consumer
→ Order
→ OrderCreated.

Step 2.5A must not:
- create another Order path;
- change Sale completion;
- create Booking;
- change availability holds;
- reprice;
- change payment terms;
- change acquisition semantics.

The consumer must set only temporal facts that canonically occur at Order creation/submission.

Do not fabricate later lifecycle milestones.

# 7. BOOTSTRAP COMPATIBILITY

`/orders/bootstrap` remains until Step 2.6.

Decide from the canonical Roadmap how new temporal fields apply to legacy/bootstrap Orders.

Requirements:
- no fake backfill;
- existing rows remain valid;
- bootstrap cannot forge server-owned milestones;
- legacy/bootstrap semantics must remain distinguishable where necessary;
- do not remove bootstrap.

# 8. NULL / BACKFILL SEMANTICS

For any newly introduced milestone:
- NULL must mean “milestone has not canonically occurred / unknown for legacy row”, according to the Roadmap;
- do not backfill from `createdAt` unless the Roadmap explicitly proves equivalence;
- do not fabricate historical business facts during migration.

Migration must be additive/safe for existing Orders.

# 9. IMMUTABILITY

Once an immutable milestone is set:
- ordinary updates must not change it;
- retries/duplicate event delivery must not produce a different timestamp;
- concurrent processing must not cause double milestones;
- replay must preserve canonical fact semantics.

Use DB/CAS/idempotency mechanisms consistent with the repository.

# 10. ORDER HISTORY

Review whether Step 2.5A requires history milestones corresponding to new temporal facts.

Do not duplicate facts unnecessarily.

If Order creation already creates canonical history, ensure timestamp semantics align with the new fields.

History actor must remain authoritative and no PII should be introduced.

# 11. EVENTS

Do not create new domain events unless Step 2.5A explicitly requires them or an existing consumer requires them.

If existing `OrderCreated` should expose a temporal fact according to the canonical contract, update it only if Roadmap/contracts require it.

Do not expand event payloads speculatively.

Preserve:
- correlationId;
- causationId;
- eventId;
- actor semantics;
- event versioning.

# 12. TIME SOURCE

Use the repository's canonical server UTC clock/time conventions.

Avoid:
- local timezone dependence;
- client timezone authority;
- JS parsing that changes date-only semantics;
- multiple `new Date()` calls that create logically different timestamps for one atomic milestone when a single timestamp should be shared.

Where one transaction represents one business milestone, prefer one captured server timestamp if consistent with repository conventions.

# 13. CONCURRENCY / IDEMPOTENCY

Test temporal behavior under:
- duplicate OrderRequested delivery;
- concurrent duplicate delivery;
- retry after failure;
- bootstrap coexistence.

Required:
- one canonical Order;
- one canonical milestone value;
- no timestamp drift on duplicate/retry;
- no duplicate history fact;
- no duplicate OrderCreated caused by temporal changes.

# 14. FAILURE ATOMICITY

Inject failure where practical.

If a milestone is part of Order creation transaction:
- it must roll back with the Order graph;
- Inbox must not falsely become processed;
- retry must succeed cleanly.

Do not leave a timestamp indicating a business fact that rolled back.

# 15. RBAC / IDOR / PRIVACY

Temporal fields must not widen access.

Verify:
- BUYER own-scope remains safe with nullable customer;
- PARTNER scope unchanged;
- staff permissions unchanged unless Roadmap explicitly says otherwise;
- no PII added to events/history/audit.

# 16. API / DTO

Expose temporal fields only where canonical Order DTO/read models require them.

Do not add:
- lifecycle mutation endpoints;
- confirmation endpoints;
- cancellation endpoints;
- completion endpoints.

Those belong to later lifecycle steps.

# 17. DATABASE / MIGRATION

Migration review must prove:
- additive compatibility;
- correct nullability;
- no fabricated defaults;
- no destructive rewrite;
- existing bootstrap rows survive;
- indexes only if justified by actual Step 2.5A query needs;
- clean replay;
- drift zero.

Do not use `db push`.

# 18. TESTS — REQUIRED

Add focused unit/e2e coverage for the actual Step 2.5A contract.

At minimum prove:

1. canonical event-driven Order gets correct creation/submission temporal facts;
2. `createdAt` remains persistence time, not an overloaded lifecycle field;
3. new milestone fields are server-owned;
4. forged milestone fields are rejected where applicable;
5. legacy/bootstrap behavior is honest;
6. duplicate delivery does not change milestone;
7. concurrent duplicate delivery does not change milestone;
8. failure rollback leaves no false milestone;
9. OrderCreated/history semantics remain correct;
10. nullable customer/IDOR regression remains safe;
11. no Booking is created;
12. no availability hold is duplicated;
13. no payment/finance side effects occur.

Add boundary tests required by the exact Roadmap semantics.

# 19. FULL REGRESSION

Run:

Backend:
- `tsc --noEmit`;
- full unit suite;
- Step 2.5A targeted e2e;
- Step 2.5 Order consumer regression;
- Step 2.4 Sale completion regression;
- Order canonical events;
- relevant Inbox/Outbox/EventBus tests;
- Booking regression;
- full serial e2e.

Frontend:
- `tsc --noEmit`;
- full vitest;
- production build.

Database:
- migrate status;
- clean replay on isolated DB;
- drift check.

Report exact counts.

# 20. RUNTIME VERIFICATION

Use an isolated test environment.

Demonstrate the real flow and inspect persisted timestamps:
Sale complete
→ OrderRequested
→ consumer
→ Order temporal fields
→ OrderHistory
→ OrderCreated.

Also demonstrate duplicate delivery and bootstrap behavior.

Do not use destructive probes on shared user/dev data.

# 21. DOCUMENTATION

Update only documentation required by the implementation:
- Step 2.5A architecture note if repository convention requires it;
- canonical contracts if actual contract changes;
- canonical Roadmap status to DONE only after implementation/tests succeed.

Do not modify Service Templates or Reverse Marketplace planning except to preserve existing content.

# 22. ARCHITECTURE STOP CONDITIONS

STOP with:

`ARCHITECTURE DECISION REQUIRED`

if any of these are true:
- canonical Step 2.5A milestone semantics are ambiguous and materially affect downstream behavior;
- implementation requires changing Order ownership;
- implementation requires starting Order lifecycle Step 2.7;
- implementation requires Booking semantics from Step 2.8;
- implementation requires changing Sales/Payment authority;
- a new cross-context write is required;
- migration would need fabricated historical business timestamps.

Do not guess through an architecture ambiguity.

# 23. OUT OF SCOPE

Explicitly do NOT implement:
- Step 2.5B acquisition propagation;
- Reverse Marketplace ADR;
- 2.2A–2.2F;
- 1.8A–1.8D;
- Step 2.6 bootstrap removal;
- Step 2.7 Order lifecycle;
- Step 2.8 Booking creation;
- Step 2.8A time-slot/service-time foundation unless Step 2.5A canonical text explicitly requires a shared primitive already planned there;
- Payment/PSP/ledger;
- frontend Order Center lifecycle UI.

# 24. REQUIRED FINAL REPORT

Return:

## 1. Verdict
`PHASE 2 STEP 2.5A IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`
or
`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline
## 3. Sources inspected
## 4. Current → Target mapping
## 5. Temporal contract
## 6. Field-by-field semantics
## 7. Server authority / mass assignment
## 8. Canonical Order creation integration
## 9. Bootstrap / legacy semantics
## 10. History / audit
## 11. Events
## 12. Concurrency / idempotency
## 13. Failure atomicity
## 14. RBAC / IDOR / privacy
## 15. Migration
## 16. Targeted tests
## 17. Full regression
## 18. Runtime verification
## 19. Issues found/fixed
## 20. Documentation changes
## 21. Remaining/deferred work
## 22. Architecture decision status
## 23. Out-of-scope confirmation
## 24. Exact files changed

# 25. STOP

After implementation and validation: STOP.

Do not perform Strict Review in the same pass.
Do not start Step 2.5B or any later step.
Wait for a separate Strict Review prompt.
