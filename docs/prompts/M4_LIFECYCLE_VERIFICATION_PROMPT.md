# M4 POST-GATE — BIDIRECTIONAL COMMERCE LIFECYCLE VERIFICATION

## STATUS

M4 has been reported as `M4 FINAL PASS`.
This is NOT a new M4 implementation. It is a focused verification of the actual commerce lifecycle.

Source report: `M4-IMPLEMENTATION-REPORT.md`.

Do not redesign phone identity. Do not modify unrelated M4 functionality. Do not commit or push.

## 1. PURPOSE

Verify the actual business lifecycle:

```text
Request ⇄ Order ⇄ Booking
```

The system must support movement both forward and backward while preserving historical entities and the continuous commercial chain.

## 2. CORE BUSINESS RULE

A transition between stages must NOT delete the previous business entity.

Forward:

```text
Request → Order
Order → Booking
```

Backward:

```text
Booking → existing Order
Order → existing Request
```

A backward transition must NOT create a replacement Order or Request.

## 3. REQUIRED MODEL

The following must remain one commercial chain:

```text
REQ-001
   ↓
ORD-001
   ↓
BKG-001
   ↓
ORD-001
   ↓
REQ-001
```

All original entities remain identifiable.

## 4. INSPECT ACTUAL IMPLEMENTATION

Inspect the repository before changing anything. Find actual implementations of Request, Order and Booking, lifecycle/status/conversion services, Prisma relations, controllers, services, event consumers, history/audit models, frontend lists/details/actions, and existing lifecycle tests.

Do not assume filenames from this prompt are correct. Repository code is authoritative.

## 5. TRACE FORWARD TRANSITIONS

Trace:

```text
Request → Order
Order → Booking
```

For each determine:

1. service/method;
2. created entity;
3. updated entity;
4. deleted entity, if any;
5. foreign keys;
6. relation to previous stage;
7. history/audit;
8. communication history;
9. current stage;
10. frontend behavior.

## 6. TRACE BACKWARD TRANSITIONS

Explicitly search for:

```text
Booking → Order
Order → Request
```

Classify each as:

```text
IMPLEMENTED
PARTIALLY IMPLEMENTED
NOT IMPLEMENTED
```

Document endpoint/action, service, status changes, IDs, relations, history, audit, UI and tests.

If a required transition is not implemented, do not invent it during this audit. Report it as `NOT IMPLEMENTED`.

## 7. ENTITY IDENTITY TEST

Verify:

```text
R1 → O1 → B1
```

Then, if supported:

```text
B1 → O1
O1 → R1
```

Confirm the original IDs remain exactly:

```text
R1
O1
B1
```

No R2/O2 replacement may be created merely because the process moved backward.

## 8. ROUND-TRIP TEST

If the existing system permits it, execute:

```text
Request R1
    ↓
Order O1
    ↓
Booking B1
    ↓
Order O1
    ↓
Request R1
```

Verify at every stage:

- same Request;
- same Order;
- same Booking;
- same commercial root;
- same customerId;
- same communication chain.

If a transition is unavailable, report exactly which one.

## 9. HISTORY

Backward transitions must not erase history.

Example:

```text
REQ-001 → converted to ORD-001
ORD-001 → converted to BKG-001
BKG-001 → returned to ORD-001
ORD-001 → returned to REQ-001
```

Inspect actual status history, transition history, audit, actor, timestamp and reason. Do not invent production features merely for this audit.

## 10. COMMUNICATION CONTINUITY

Verify that Request → Order → Booking and backward transitions do not copy communication into separate histories. The existing continuous commercial communication/history chain must remain intact.

## 11. COMMERCE OWNERSHIP

Verify that Customer ownership remains consistent through all transitions. Do not replace `customerId` with phone.

Also verify:

```text
Customer ≠ Traveler
Customer ≠ Payer
User ≠ Traveler
```

and lifecycle transitions do not create Users from Travelers.

## 12. FRONTEND BEHAVIOR

Verify the distinction between active lists and historical persistence.

After Request → Order, Request may disappear from the active Request list but must remain accessible through history/search/related Order/direct detail where the existing UI supports it.

After Order → Booking, Order may disappear from the active Order list but must remain accessible through Booking/history.

After Booking → Order, the SAME Order must become active again.

After Order → Request, the SAME Request must become active again.

`Not in active list` is not equivalent to `deleted`.

## 13. ACTIVE STAGE

Determine how the current operational stage is represented in the actual implementation. It may use statuses, relations, conversion flags, workflow state, or another mechanism. Document actual behavior; do not invent a new `currentStage` field for this audit.

## 14. EXISTING LIFECYCLE TESTS

Inspect the baseline failures reported in `M4-IMPLEMENTATION-REPORT.md`:

```text
d3-request-flow
order-lifecycle-completion
booking-lifecycle-completion
order-creation-consumer
booking-requested-consumer
```

The M4 report says these are pre-existing and identical at baseline. Determine exactly what they cover and whether they reveal any missing requirement for the bidirectional lifecycle.

Do not fix unrelated baseline failures.

If a failure reveals the required lifecycle is actually missing, classify it separately as:

```text
LIFECYCLE GAP
```

## 15. DATABASE VERIFICATION

Inspect actual Prisma relations for:

```text
Request ↔ Order
Order ↔ Booking
```

including foreign keys, uniqueness, cascade/delete behavior, conversion fields and historical references.

Critical question:

> Could deleting or replacing a current-stage entity accidentally cascade-delete a historical stage?

If yes, report it as a serious lifecycle risk.

## 16. ID / NUMBERING

Verify that:

```text
REQ-...
ORD-...
BKG-...
```

remain connected to the same commercial root through forward and backward transitions.

Do not create a new commerce root on return.

## 17. AUDIT

For existing backward transitions inspect whether the system records actor, timestamp, previous stage, new stage, reason if supported, and entity IDs. Do not invent audit actions during this audit; report missing data as a gap.

## 18. IMPLEMENTATION RULE

This is primarily an audit.

Default:

```text
NO PRODUCTION CODE CHANGES
NO SCHEMA CHANGES
NO MIGRATIONS
NO UI REDESIGN
NO COMMIT
NO PUSH
```

A test-only fixture may be added only if necessary to prove existing behavior.

## 19. REQUIRED REPORT

Produce:

```text
M4-LIFECYCLE-VERIFICATION-REPORT.md
```

Include:

1. Executive verdict.
2. Actual architecture.
3. Forward transitions.
4. Backward transitions.
5. Entity preservation matrix.
6. Round-trip result.
7. History/audit behavior.
8. Communication continuity.
9. Customer ownership.
10. UI behavior.
11. Existing test analysis.
12. Database relation analysis.
13. Gaps.
14. Minimum required next action.

Use this matrix:

| Transition | Previous entity preserved | Same entity on return | New entity created | Result |
|---|---:|---:|---:|---|
| Request → Order | YES/NO | N/A | YES/NO | PASS/FAIL |
| Order → Booking | YES/NO | N/A | YES/NO | PASS/FAIL |
| Booking → Order | YES/NO | YES/NO | YES/NO | PASS/FAIL |
| Order → Request | YES/NO | YES/NO | YES/NO | PASS/FAIL |

## 20. VERDICT RULE

### LIFECYCLE PASS

Only if the implemented system demonstrably supports:

```text
Request → Order
Order → Booking
Booking → existing Order
Order → existing Request
```

with historical entity preservation.

### LIFECYCLE PASS WITH GAPS

Core model is correct, but non-critical pieces are missing, such as richer return reason, additional audit detail, UI historical navigation or test coverage.

### LIFECYCLE FAIL

If backward transitions are absent where required, new Request/Order entities are created on return, previous entities are deleted, history is broken, customer ownership changes unexpectedly, communication continuity is broken, or database relations can destroy historical stages.

## 21. FINAL STOP

At the end:

1. Produce `M4-LIFECYCLE-VERIFICATION-REPORT.md`.
2. Give exact evidence.
3. Do not commit.
4. Do not push.
5. Do not modify unrelated M4 work.
6. Stop and wait for owner decision.

The purpose of this gate is to establish the actual state of:

```text
Request ⇄ Order ⇄ Booking
```

before the next project stage.
