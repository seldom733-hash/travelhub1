# PHASE 2 — STEP 2.5 — ORDER CREATION CONSUMER
## STRICT REVIEW PROMPT

**Project:** TravelHub  
**Phase:** 2  
**Step:** 2.5 — Order Creation Consumer  
**Mode:** STRICT REVIEW / REVIEW FIXES ONLY  
**Implementation verdict entering review:** `PHASE 2 STEP 2.5 IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

---

# 1. REVIEW MISSION

Perform an independent, code-first **STRICT REVIEW** of the completed Phase 2 Step 2.5 implementation.

Do NOT trust the implementation report as proof.

Reconstruct the actual behavior from:

- repository code;
- Prisma schema/migration;
- event contracts;
- Order/Sales/Catalog/Booking boundaries;
- Inbox/Outbox implementation;
- tests;
- runtime behavior;
- canonical Roadmap;
- approved ADRs/contracts.

The target canonical flow is:

`Sale completion`
→ `OrderRequested`
→ Outbox/EventBus
→ Order-owned consumer
→ canonical `Order`
→ Order children/snapshots
→ canonical `OrderCreated`.

The review must determine whether Step 2.5 is genuinely safe to approve before proceeding.

---

# 2. REVIEW BOUNDARY

This is NOT a new implementation step.

Allowed:

- inspect all relevant code/docs/tests;
- add missing review tests;
- fix confirmed local Step 2.5 defects;
- fix directly caused deterministic test defects;
- make minimal documentation corrections matching actual behavior.

Forbidden:

- Step 2.5A implementation;
- Step 2.5B implementation;
- Step 2.6 bootstrap removal;
- Step 2.7 Order lifecycle;
- Step 2.8 Booking creation;
- Reverse Marketplace implementation;
- Service Templates / Period Pricing roadmap amendment;
- unrelated refactors.

If a required correction materially changes architecture:

`ARCHITECTURE DECISION REQUIRED`.

---

# 3. BASELINE VERIFICATION

First report:

- branch;
- HEAD;
- dirty/untracked files;
- exact Step 2.5 diff;
- migration count/status;
- whether Step 2.5 implementation is uncommitted;
- whether unrelated user prompt files exist.

Do not overwrite user-supplied prompt files.

---

# 4. SOURCES TO INSPECT

At minimum inspect:

- canonical Roadmap Step 2.4 / 2.5 / 2.5A / 2.5B / 2.6 / 2.7 / 2.8;
- ADR-0001;
- ADR-0010 and event/reliability ADRs;
- `docs/contracts/events.md`;
- `docs/contracts/ids.md`;
- `schema.prisma`;
- Step 2.5 migration;
- `domain-events.ts`;
- EventBus/Outbox/Inbox implementation;
- Step 2.4 Sale completion producer;
- `order-requested.consumer.ts`;
- Order service/module/controller/subscribers;
- IdsService;
- Booking foundations;
- Order canonical-event tests;
- Step 2.4 e2e;
- Step 2.5 e2e;
- global e2e setup.

---

# 5. RECONSTRUCT ACTUAL FLOW

Trace the exact runtime path:

`Sale.complete`
→ `OrderRequested`
→ Outbox row/state
→ publisher
→ consumer dispatch
→ Inbox dedup
→ Order transaction
→ Order
→ OrderItem
→ OrderTraveler
→ Fulfillment if applicable
→ OrderHistory
→ AuditLog if applicable
→ `OrderCreated`
→ Outbox state.

Document actual transaction boundaries.

Do not infer them from method names.

---

# 6. CRITICAL REVIEW — ORDERREQUESTED SELF-SUFFICIENCY

The implementation report states that `OrderRequested` carries frozen commercial facts but the consumer additionally reads:

- `CheckoutIntentTraveler` from `sales.*`;
- Product classification/type from `catalog.*`.

Review whether this violates the intended event boundary.

Distinguish:

## Mutable commercial authority

The consumer MUST NOT depend on mutable Sales/Catalog state for frozen commercial facts such as:

- price;
- amount;
- currency;
- discount;
- payment terms;
- service date;
- item identity/title if intended as snapshot;
- acquisition source;
- reservation identity.

## Permissible reference enrichment

A cross-context read may be acceptable only if:

- it is explicitly permitted by ADR-0001/current architecture;
- it does not change commercial meaning;
- deterministic replay remains possible;
- deletion/change between event publication and consumption cannot make a valid event permanently unprocessable;
- the read does not secretly transfer ownership.

Specifically test/reason about:

1. Checkout travelers modified after `OrderRequested` publication but before consumption.
2. Checkout travelers deleted/changed before consumption.
3. Product classification changed before consumption.
4. Product unavailable/deleted before consumption.
5. event replay after mutable upstream state changed.

If deterministic Order creation depends on mutable state not contained in the event/snapshot, determine whether this is:

- a local contract defect requiring Step 2.5 review fix;
- or an architectural issue requiring decision.

Do not approve merely because current e2e publishes and consumes immediately.

---

# 7. CRITICAL REVIEW — RESERVATION CARDINALITY

The implementation report states:

- Step 2.4 reserves capacity for all items;
- `OrderRequested` contains `reservationId`;
- Order stores one `reservationId`.

Verify actual Step 2.4 schema/code.

Determine whether:

- one Sale completion always creates exactly one AvailabilityReservation;
- or multi-item Sale can create multiple reservations.

If multiple reservations can exist, a single `reservationId` may be lossy.

Test a real multi-item Sale.

Required questions:

- Are all item reservations represented in OrderRequested?
- Can downstream Order/Booking identify every hold?
- Is one reservation an aggregate reservation containing multiple lines?
- Does rollback release all holds?
- Does duplicate delivery preserve all reservation links?

If the implementation loses reservation identity for multi-item sales, this is a blocker unless safely fixed locally.

Do not accept “loop exists” as proof of correct cardinality.

---

# 8. CRITICAL REVIEW — NULLABLE CUSTOMER

Step 2.5 changed:

`Order.customerId: NOT NULL → nullable`

and reportedly changed:

`BookingRequestedPayload.customerId → nullable`.

Review the complete impact.

Search all code/tests/docs for assumptions that Order always has a customer.

Inspect:

- Order APIs;
- OrderHistory;
- Booking;
- Communication;
- CRM;
- canonical events;
- DTOs;
- serializers;
- authorization/object scope;
- analytics/read models;
- future-ready code already present.

Required invariants:

- nullable customer must not create an IDOR bypass;
- `null` must have a defined business meaning;
- Buyer-owned Order reads must not accidentally expose unowned Orders;
- Booking code must handle null explicitly;
- no `!`/cast/default silently converts null into another identity;
- public/internal DTOs remain correct.

Determine whether customer-less Order is genuinely canonical for Step 2.5 or whether the event contract should carry Buyer/customer identity.

If business semantics are unresolved:

`ARCHITECTURE DECISION REQUIRED`.

---

# 9. CRITICAL REVIEW — P2002 HANDLING

The report says:

`InboxEvent unique + Order.saleId @unique + P2002 → no-op`.

Inspect the exact catch logic.

A generic catch of Prisma `P2002` is NOT sufficient if the transaction can violate other unique constraints such as:

- Order code;
- Order number;
- orderRequestedEventId;
- child uniqueness;
- Inbox uniqueness;
- other canonical references.

Required:

- duplicate-delivery handling must identify the expected duplicate constraint/semantic;
- unrelated uniqueness defects must surface as failures, not false success;
- no event may be marked processed because an unrelated P2002 was swallowed.

Add targeted tests that intentionally cause a non-idempotency unique collision if feasible.

This is a high-priority approval criterion.

---

# 10. CRITICAL REVIEW — INBOX ATOMICITY

Verify exact Inbox behavior.

Required invariant:

`Inbox accepted/processed`
and
`Order graph + OrderCreated outbox`

must not diverge.

Review:

- when Inbox row is created;
- when it becomes processed;
- transaction/client used;
- behavior on rollback;
- behavior if duplicate concurrent handlers race;
- behavior if process crashes after Order commit but before Inbox status change;
- behavior if Inbox status changes before Order commit.

A failed attempt must be safely retryable.

Do not accept an in-memory mutex as correctness.

---

# 11. CRITICAL REVIEW — OUTBOX `PUBLISHED` SEMANTICS

The report states:

> `OrderCreated emitResult` writes `PUBLISHED` atomically.

Inspect what `PUBLISHED` actually means in this repository.

Questions:

- Does `PUBLISHED` mean durably stored and eligible for dispatch?
- Or does it mean already delivered to all consumers?
- Is `OrderCreated` actually dispatched?
- Could transaction commit with `PUBLISHED` but no external/local dispatch having occurred?
- Does the outbox poller ignore `PUBLISHED` rows?
- Is this existing repository convention or a Step 2.5 misuse?

Required invariant:

A committed Order must not permanently lose its `OrderCreated` event.

If `PUBLISHED` bypasses retry/publishing, this is a blocker.

Review Step 1.18 reliability semantics before deciding.

---

# 12. CRITICAL REVIEW — ORDERCREATED CONSUMER STATUS

The report states:

`OrderCreated` has no consumers.

Confirm this against code.

If no consumer exists, verify whether marking it `PUBLISHED` is still semantically correct under the current event architecture.

Do not add a fake consumer.

Do not publish events “for completeness” if the canonical contract says events without consumers should not exist; conversely, do not remove canonical `OrderCreated` if Roadmap explicitly requires it.

Resolve from approved contracts.

---

# 13. CRITICAL REVIEW — TH-YYYY-###### NUMBERING

Review `nextOrderNumber`.

Required:

- UTC year;
- sequence scope per year;
- reset behavior at UTC year boundary;
- uniqueness;
- concurrency safety;
- no reliance on local OS timezone;
- no collision between bootstrap and canonical consumer;
- no race around Dec 31 / Jan 1;
- formatting exactly matches contract.

Add unit/e2e coverage for year-boundary logic if absent.

Do not manipulate production clock globally; isolate clock/helper if needed.

---

# 14. CRITICAL REVIEW — ORDER CODE

Verify `ORD-*` format against canonical IDs contract.

Check:

- prefix;
- padding width;
- BusinessSequence key;
- bootstrap compatibility;
- concurrency;
- migration/legacy rows.

No second competing Order-code scheme.

---

# 15. CRITICAL REVIEW — SNAPSHOT COMPLETENESS

Compare:

`Sale frozen snapshot`
vs
`OrderRequested payload`
vs
`Order stored snapshot`.

Produce a field-by-field matrix.

At minimum:

- sale ref;
- checkout ref;
- quote ref;
- items;
- product/service identity;
- item title/description snapshot where required;
- quantity;
- unit price;
- line amount;
- currency;
- subtotal;
- discount type/value/amount;
- total;
- payment scheme;
- prepayment type/value;
- initial amount;
- remaining amount;
- acquisition source;
- service date;
- availability reservation reference(s).

No authoritative field should silently disappear if downstream Order/Booking/Finance requires it.

No field should be recalculated from mutable Catalog/Sales if already frozen.

---

# 16. MONEY INVARIANTS

Inspect all money parsing/storage.

Required:

- Prisma Decimal or existing canonical money helper;
- no `Number()`/JS float authority;
- exact currency preservation;
- line sums and totals validated according to existing contract;
- subtotal/discount/total consistency;
- initial + remaining = total;
- non-negative constraints;
- scale/rounding consistent with existing money contract;
- overflow returns controlled failure;
- malformed numeric strings rejected.

Review whether consumer validation is sufficient against malformed internal events.

Internal events are trusted for identity of publisher, but malformed durable data must not corrupt Order.

---

# 17. SERVICE DATE VALIDATION

Report says regex `YYYY-MM-DD`.

Regex alone does not prove a valid calendar date.

Test:

- `2026-02-29`;
- `2026-13-01`;
- `2026-00-10`;
- `2026-04-31`;
- valid leap date.

Use the project's canonical date-only semantics.

Do not introduce timezone conversion for date-only values.

If existing helper already validates real dates, reuse it.

---

# 18. TRAVELER SNAPSHOT REVIEW

The implementation creates OrderTraveler with:

- firstName;
- lastName;
- birthDate;
- status `INCOMPLETE`.

Review:

- source authority;
- whether birthDate is required/nullable;
- whether status is correct;
- whether future passport patch belongs to Order or Booking;
- whether traveler identity can drift after event publication;
- whether the consumer reads mutable Checkout traveler state;
- whether customer/Buyer can later edit a traveler after Order snapshot and unexpectedly alter Order semantics.

Do not implement Step 2.8.

But ensure Step 2.5 does not create a snapshot that contradicts existing Booking traveler ownership.

---

# 19. FULFILLMENT CREATION

The report says Step 2.5 creates `Fulfillment`.

Verify why.

Step 2.5 scope is Order creation; Step 2.7/2.8 own later lifecycle/Booking.

Determine whether Fulfillment is an existing required child of canonical Order foundation or premature lifecycle state.

Check:

- initial fulfillment status;
- timestamps;
- no ready-for-booking implication;
- no Booking creation;
- no fabricated milestone.

If Fulfillment creation belongs to later steps, remove/fix it.

---

# 20. AVAILABILITY — NO DOUBLE HOLD

Verify using DB state, not only mocks.

For:

- one-item Sale;
- multi-item Sale;
- duplicate event;
- concurrent duplicate event;

prove that Step 2.5 does NOT:

- decrement availability;
- create another AvailabilityReservation;
- mutate hold state;
- extend expiry;
- release hold.

Order should reference existing hold facts only.

---

# 21. CORRELATION / CAUSATION

Verify exact event envelope.

For:

`OrderRequested → OrderCreated`

required:

- child `correlationId` = parent correlationId;
- child `causationId` = parent eventId;
- child has its own eventId;
- actor/source follows approved SYSTEM semantics;
- no business code used as correlation;
- no request context leakage between concurrent events.

Add concurrent two-event test if necessary.

---

# 22. ORDERCREATED PAYLOAD

Current reported payload:

`{ orderId, code, number, customerId|null, amount, currency }`

Review against:

- canonical events contract;
- future Booking boundary;
- privacy;
- snapshot authority.

Do not expand payload speculatively.

But ensure required canonical consumers can identify the Order without querying Sales.

If payload contract is already approved, enforce it exactly.

---

# 23. DOMAIN UNIQUENESS — ONE SALE → ONE ORDER

Review `Order.saleId @unique`.

Questions:

- Is every canonical event-driven Order Sale-backed?
- Bootstrap uses null — does PostgreSQL uniqueness permit multiple nulls as intended?
- Could future acquisition create Order without Sale? Current Roadmap says commercial paths converge through Sales; confirm.
- Can a Sale legitimately split into multiple Orders? If not, uniqueness is correct.

If Roadmap is ambiguous on split orders:

`ARCHITECTURE DECISION REQUIRED`.

Do not silently freeze a one-to-one invariant merely because current code does.

---

# 24. MALFORMED / UNSUPPORTED EVENTS

Review consumer behavior for:

- unsupported event version;
- missing fields;
- extra fields;
- invalid UUID/code;
- invalid money;
- invalid date;
- empty items;
- duplicate item identifiers;
- zero/negative quantity;
- zero/negative price where business rules forbid;
- unknown acquisition source;
- invalid payment terms.

Ensure:

- no partial state;
- retryability vs terminal invalid-event behavior is intentional;
- malformed event does not cause infinite poison-message retry if current architecture supports terminal failure classification.

Do not redesign global dead-letter architecture unless required.

---

# 25. EVENT VERSIONING

The report mentions malformed version 2 test.

Inspect actual event version contract.

Verify:

- accepted version(s);
- producer and consumer agree;
- unsupported future version fails safely;
- no implicit fallback;
- docs match code.

---

# 26. BOOTSTRAP COEXISTENCE

Step 2.6 owns removal.

Strict review must confirm temporary coexistence is safe.

Test:

- bootstrap Order has no Sale relation;
- canonical consumer does not route through HTTP/bootstrap;
- bootstrap and canonical flow share canonical ID generators without collision;
- bootstrap cannot forge saleId/orderRequestedEventId/snapshot fields if DTO mass assignment could expose them;
- bootstrap cannot accidentally emit an event lineage pretending to come from Sale.

Do NOT remove bootstrap in this review unless a critical security defect cannot otherwise be fixed.

---

# 27. RBAC / IDOR AFTER NULLABLE CUSTOMER

This deserves a dedicated runtime/code review.

Inspect every Order read/list/update route.

For BUYER:

- how own-scope is determined;
- what happens when customerId is null;
- whether buyer can guess `ORD-*` / `TH-*`;
- whether null is treated as wildcard;
- whether staff/internal reads remain capability-driven.

For PARTNER:

- verify no scope widening from new Sale/Quote/Checkout refs.

Add negative e2e if coverage is missing.

---

# 28. MASS ASSIGNMENT

New Order fields are server-owned.

Ensure bootstrap/update DTOs cannot set:

- saleId;
- saleCode;
- quoteId;
- checkoutId;
- reservationId;
- orderRequestedEventId;
- subtotal;
- discount fields;
- payment terms;
- acquisition source;
- canonical code/number;
- correlation/causation.

Use existing forbidden-key/global validation conventions.

---

# 29. PRIVACY

Search logs/events/history/audit/error responses.

Ensure no accidental:

- birth date;
- traveler name;
- passport;
- contact;
- raw Checkout traveler object

appears in:

- OrderCreated;
- OrderRequested unless canonically intended;
- AuditLog details;
- error logs;
- exception payloads.

The consumer may process PII without logging it.

---

# 30. MIGRATION REVIEW

Inspect SQL, not just Prisma schema.

Verify:

- customerId nullable alteration;
- new columns nullability/defaults;
- unique `saleId`;
- indexes;
- no destructive data rewrite;
- existing bootstrap rows remain valid;
- no fabricated snapshot backfill;
- no cross-schema FK violating architecture;
- clean replay;
- drift zero;
- rollback/redeploy assumptions documented if repository requires them.

If required new fields are nullable for legacy compatibility, ensure runtime distinguishes legacy bootstrap from canonical Order.

---

# 31. FAILURE INJECTION

Add/verify failure tests around:

1. after Inbox acceptance;
2. after Order create;
3. after items;
4. after travelers;
5. before OrderCreated outbox;
6. before Inbox processed;
7. unexpected uniqueness collision.

After each failure where practical:

- no partial graph;
- no false processed Inbox;
- retry can succeed;
- no duplicate reservation;
- no duplicate OrderCreated.

Do not rely only on validation failures occurring before transaction.

---

# 32. PROCESS CRASH WINDOW

Reason explicitly about process crash, not just thrown exceptions.

Identify commit boundaries.

Answer:

- if process dies immediately after DB commit, what durable rows exist?
- what component will resume dispatch?
- can Inbox be processed while OrderCreated is not deliverable?
- can Order exist without durable event?

If correctness relies on code after transaction commit without durable recovery, block approval.

---

# 33. TEST HYGIENE

Review Step 2.5 tests for:

- absolute global counts;
- shared DB pollution;
- ordering assumptions;
- sleeps/timing races;
- hardcoded ports;
- cleanup of Outbox/Inbox/Order children;
- tests passing only because Step 2.5 spec runs in a particular order.

Prefer before/after deltas and owned-fixture cleanup.

Do not weaken assertions merely to make serial e2e green.

---

# 34. FULL REGRESSION

After review fixes, run:

## Backend
- `tsc --noEmit`;
- full unit suite;
- targeted Step 2.5 e2e;
- Step 2.4 e2e;
- Order canonical events;
- Booking-related regression;
- EventBus/Outbox/Inbox/request-context regression;
- full serial e2e.

## Frontend
- `tsc --noEmit`;
- full vitest;
- production `next build`.

## Database
- migrate status;
- clean replay on isolated DB;
- drift check.

Report exact counts.

Skipped tests/timeouts must be reported.

---

# 35. RUNTIME VERIFICATION

Use isolated test/runtime environment.

Prove at runtime:

`Sale complete`
→ `OrderRequested`
→ consumer
→ one Order
→ children
→ one OrderCreated.

Also prove:

- duplicate delivery;
- concurrent duplicate;
- multi-item Sale;
- no second availability hold;
- no Booking;
- nullable customer access behavior;
- trace lineage;
- malformed event rollback.

Do not use shared user/dev data for destructive probes.

---

# 36. ROADMAP / DOC CONSISTENCY

Verify Step 2.5 is marked DONE only if implementation survives review.

Do not mark 2.5A/2.5B/2.6/2.7/2.8 done.

Check docs accurately describe:

- customer nullable semantics;
- event self-sufficiency;
- reservation cardinality;
- bootstrap coexistence;
- snapshot fields.

If Strict Review rejects Step 2.5, correct misleading DONE status if repository conventions require it.

---

# 37. REVIEW FIX POLICY

Fix confirmed local defects during Strict Review when:

- behavior is clearly required by existing Roadmap/ADR/contracts;
- fix remains within Step 2.5;
- no new architectural decision is required.

Examples:

- wrong P2002 catch;
- invalid date validation;
- missing mass-assignment guard;
- incomplete transaction use;
- missing idempotency constraint;
- lossy reservation mapping if existing model clearly defines cardinality;
- test flake caused by Step 2.5.

Do NOT hide unresolved architectural conflicts behind a local patch.

---

# 38. APPROVAL GATES

Step 2.5 may be `APPROVED` only if all are true:

1. Sales does not write Order directly.
2. Consumer creates canonical Order through Order owner.
3. OrderRequested authority is sufficient/deterministic.
4. Mutable cross-context reads do not undermine replay.
5. Reservation cardinality is lossless.
6. No second capacity hold.
7. One Sale/request cannot create duplicate Orders.
8. P2002 handling is constraint-specific/safe.
9. Inbox processing is transactionally coherent.
10. OrderCreated cannot be durably lost.
11. Correlation/causation is correct.
12. Money snapshot is exact.
13. Nullable customer semantics are safe.
14. Buyer/Partner IDOR remains safe.
15. New server-owned fields cannot be mass-assigned.
16. Bootstrap coexistence is safe.
17. No Booking/Payment is created.
18. Migration replay/drift is clean.
19. Required negative/concurrency/failure tests pass.
20. Full regression is green.

Any failed gate must be fixed or explicitly block approval.

---

# 39. REQUIRED FINAL REPORT

Return these sections:

## 1. Verdict

One of:

`PHASE 2 STEP 2.5 STRICT REVIEW COMPLETED — APPROVED`

`PHASE 2 STEP 2.5 STRICT REVIEW COMPLETED — APPROVED WITH REVIEW FIXES`

`PHASE 2 STEP 2.5 STRICT REVIEW COMPLETED — CHANGES REQUIRED`

`ARCHITECTURE DECISION REQUIRED`

## 2. Repository baseline

## 3. Files inspected

## 4. Actual runtime flow

## 5. OrderRequested self-sufficiency

## 6. Cross-context read review

## 7. Reservation cardinality

## 8. Nullable customer review

## 9. Snapshot completeness matrix

## 10. Money/date validation

## 11. OrderTraveler / PII

## 12. Fulfillment review

## 13. ID strategy

## 14. Idempotency

## 15. P2002 handling

## 16. Concurrency

## 17. Inbox atomicity

## 18. Outbox / OrderCreated durability

## 19. Event versioning

## 20. Correlation / causation

## 21. Availability isolation

## 22. Order / Booking isolation

## 23. Bootstrap coexistence

## 24. RBAC / IDOR / mass assignment

## 25. Migration / replay / drift

## 26. Failure injection / crash-window analysis

## 27. Test hygiene

## 28. Exact targeted test results

## 29. Full regression

## 30. Runtime verification

## 31. Review findings

For each finding:

- severity;
- evidence;
- invariant violated;
- fix;
- tests added.

## 32. Files changed during review

## 33. Remaining debt

Separate from blockers.

## 34. Architecture decision status

## 35. Out-of-scope confirmation

Final line must repeat the verdict.

---

# 40. STOP CONDITION

After Strict Review and any permitted review fixes:

**STOP.**

Do NOT begin:

- Step 2.5A;
- Step 2.5B;
- Step 2.6;
- Step 2.7;
- Step 2.8;
- Reverse Marketplace ADR/implementation;
- Service Templates / Period Pricing & Availability Roadmap Amendment.

Wait for the next explicit instruction.
