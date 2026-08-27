# PHASE 3 — STEP 3.5.3 — PLATFORM CRM
## CRM COMMUNICATIONS + ACTIVITY TIMELINE IMPLEMENTATION
## ROUND 2A — ACTIVITY READ MODEL + DATA MODEL + MIGRATION + SOURCE ADAPTERS + BACKFILL FOUNDATION

---

# 1. PRECONDITION

The following architecture stage is accepted and MUST be preserved:

```text
PHASE 3 STEP 3.5.3 — PLATFORM CRM
CRM COMMUNICATIONS + ACTIVITY TIMELINE
ARCHITECTURE RECONCILIATION — FULLY CLOSED
READY FOR IMPLEMENTATION
```

Accepted architecture commit:

```text
2b0438a
```

Previous Platform CRM / Operational Notes baseline remains authoritative and MUST NOT be regressed.

Starting SHA:

```text
2b0438a
```

or an explicitly explained descendant.

---

# 2. ROUND PURPOSE

Implement the backend/data foundation for the accepted CRM Activity Timeline architecture.

This round is implementation of:

```text
CrmActivity read model
schema/data model
migration
strict sourceType/activityType authority
canonical occurredAt semantics
Customer/Partner subject binding
projection identity + dedupe
source adapters
event/projector foundation
historical backfill foundation
rebuild/replay foundation
indexes
scope metadata
tests
runtime/migration evidence
```

Do NOT implement timeline UI in this round.

Do NOT implement Customer 360 Activity tab.

Do NOT implement Partner 360 Activity tab.

Do NOT implement Activity API/controller yet unless a minimal internal read path is needed for tests.

Do NOT implement new communication channels.

---

# 3. ARCHITECTURE AUTHORITY

Use the accepted Step 3.5.3 architecture report as the primary authority.

Before modifying schema/code:

1. Read the architecture report.
2. Confirm exact source list.
3. Confirm exact activity type taxonomy.
4. Confirm Customer/Partner subject inclusion rules.
5. Confirm timestamp authority matrix.
6. Confirm visibility/RBAC metadata requirements.
7. Confirm backfill/rebuild decisions.
8. Confirm PII minimization rules.
9. Confirm deleted/edited source semantics.
10. Confirm projection consistency model.

Do not silently reinterpret the accepted architecture.

If current repository state conflicts with the report:

```text
STOP conflicting implementation
classify the mismatch
report it
```

Do not invent a substitute architecture merely to obtain VERDICT A.

---

# 4. ACCEPTED HIGH-LEVEL DESIGN

The accepted architecture selected:

```text
Denormalized read model
CrmActivity
```

with:

```text
cursor pagination
occurredAt DESC
id DESC
server-side filtering
two-level RBAC
canonical business timestamps
timeline-only v1
no unsupported omnichannel claims
```

Customer History:

```text
MIGRATE into Activity
```

Partner 360:

```text
new Activity view later
```

Round 2A implements the data foundation only.

---

# 5. CANONICAL SOURCE TYPES

The accepted architecture identified 10 canonical source types:

```text
OPERATIONAL_NOTE
ORDER
BOOKING
PAYMENT
REFUND
MESSAGE
AUDIT
CUSTOMER_HISTORY
BUYER_REQUEST
PARTNER_APPLICATION
```

Use the exact accepted source names from the architecture report if they differ.

Do not add unsupported future channels/sources.

No arbitrary free-text source types.

Prefer strict enum or equivalently strict server-controlled representation.

---

# 6. ACTIVITY TYPES

Use the accepted bounded taxonomy (~20 event names).

Examples may include:

```text
NOTE_CREATED
ORDER_CREATED
ORDER_CANCELLED
BOOKING_CREATED
BOOKING_CONFIRMED
PAYMENT_CAPTURED
REFUND_PROCESSED
MESSAGE_SENT
...
```

Do not infer missing event names.

Read the architecture report and implement the exact accepted list.

No unbounded arbitrary strings.

---

# 7. CORE DATA MODEL

Implement the accepted conceptual `CrmActivity` read model.

At minimum it must support the accepted semantics for:

```text
id
sourceType
sourceId
activityType
customerId?
partnerId?
occurredAt
actorUserId?
visibility/scope metadata
title/summary projection or safe metadata according to architecture
deep-link/source-reference metadata where accepted
createdAt / projection timestamp if accepted
projectionVersion if accepted
```

Do not blindly copy this prompt as schema truth.

The architecture report + current schema are authoritative for exact fields.

---

# 8. READ MODEL ≠ SOURCE OF TRUTH

Invariant:

```text
CrmActivity = denormalized read model
```

It MUST NOT become canonical authority for:

```text
Order
Booking
Payment
Refund
OperationalNote
Message
Audit Event
Customer History
BuyerRequest
PartnerApplication
```

Source entities remain canonical.

No write path should update business state through CrmActivity.

---

# 9. SOURCE IDENTITY

Each projected activity must retain stable canonical source identity.

At minimum:

```text
sourceType
sourceId
activityType
```

If architecture requires a distinct `sourceEventId`, implement it.

Do not rely only on random CrmActivity row IDs for replay/deduplication.

---

# 10. DEDUPE KEY

Define and implement deterministic projection identity.

Preferred conceptual key:

```text
sourceType
sourceId
activityType
sourceEventId? / canonical event discriminator
```

Exact strategy must match the accepted architecture.

Required invariant:

```text
same canonical source event projected twice
→ one logical CrmActivity row
```

No duplicate timeline entries from retries/replays.

---

# 11. IDEMPOTENT PROJECTOR

Implement projection functions so that repeated processing is safe.

Conceptually:

```ts
projectActivity(event)
```

must be idempotent.

Possible implementation:

```text
upsert
unique composite key
dedupe lookup + insert
```

Use the narrowest correct approach.

Do not rely on in-memory dedupe.

---

# 12. OCCURRED AT AUTHORITY

`occurredAt` MUST come from canonical source/business timestamps.

Do not use a generic `createdAt` fallback for all event types.

Examples from accepted semantics:

```text
Operational Note created → note.createdAt
Order created → order.createdAt
Order cancelled → cancelledAt
Booking created → booking.createdAt
Payment captured → paidAt
Refund processed → processedAt
Message sent → canonical message timestamp
Audit event → audit timestamp
```

Implement only event/timestamp mappings accepted by architecture.

---

# 13. NO FAKE HISTORY

Critical invariant:

```text
current state ≠ historical transition evidence
```

Example:

```text
Order.status = CLOSED
```

does NOT prove exact timestamps for:

```text
NEW → PROCESSING → FULFILLED → CLOSED
```

Do not synthesize unobserved status history.

Backfill only events supported by canonical historical data.

---

# 14. CUSTOMER SUBJECT BINDING

Implement exact accepted Customer timeline inclusion semantics.

Possible sources may relate via:

```text
direct Customer
Order.customerId
Booking.customerId
Payment through Order
Refund through Payment/Order
Message participant
OperationalNote parent
CustomerHistory
BuyerRequest
```

Do not infer broader relationships than accepted architecture.

CrmActivity must support efficient Customer-scoped queries.

---

# 15. PARTNER SUBJECT BINDING

Implement exact accepted Partner timeline inclusion semantics.

Possible sources may relate via:

```text
direct Partner
Product/Service
Order.partnerId
Booking.partnerId
Payment/Refund relation
Message participant
OperationalNote parent
PartnerApplication
```

Use actual architecture/report rules.

No cross-partner leakage.

---

# 16. DUAL SUBJECT EVENTS

Some events may belong to both:

```text
Customer timeline
Partner timeline
```

Example:

```text
Order
Booking
Payment
Refund
Message
```

Decide whether one CrmActivity row carries both:

```text
customerId
partnerId
```

or separate projections are created.

Use accepted architecture.

Do not duplicate events unnecessarily if one row can safely represent both subjects.

---

# 17. VISIBILITY / SCOPE METADATA

The architecture requires two-level RBAC later:

```text
crm.activity.read
+
source-specific item gate
```

Round 2A must store enough source/scope metadata to support secure query-time filtering later.

Do not bake actor-specific permissions permanently into rows.

Permissions can change over time.

Prefer source/scope metadata that can be evaluated at read time.

---

# 18. TENANT / WORKSPACE AUTHORITY

CrmActivity must never lose the source's scope boundary.

Implement the exact accepted scope fields/derivation.

Potential authorities:

```text
workspace
tenant
partner
customer
source parent
```

If scope fields are denormalized:

```text
server/projector derives them
client/event payload cannot arbitrarily override them
```

Do not create unscoped activity rows.

---

# 19. ACTOR METADATA

If actor is stored:

```text
actorUserId
```

must derive from canonical source/audit/event authority.

Do not trust arbitrary event payload fields without validation.

If no actor exists for system event:

```text
actorUserId = NULL
```

or accepted system representation.

Do not fabricate a user.

---

# 20. TITLE / SUMMARY PROJECTION

Architecture may allow denormalized safe presentation fields.

If implemented:

```text
title
summary
```

must be minimal and safe.

Do NOT copy entire source payloads.

Do NOT duplicate:

```text
full payment object
full message thread
full OperationalNote record
full audit payload
```

Minimize PII duplication.

---

# 21. MESSAGE CONTENT

Messages may be sensitive.

If architecture permits a preview:

```text
store only accepted safe preview
```

or store no body and derive from source later.

Do not copy full message bodies into CrmActivity unless architecture explicitly accepted that tradeoff.

---

# 22. OPERATIONAL NOTE CONTENT

OperationalNote text is INTERNAL and potentially sensitive.

If timeline projection stores note preview/text, enforce architecture's PII/visibility rules.

Do not create a second permanent canonical copy of note content casually.

If architecture selected source-reference-only for note text, follow it.

---

# 23. FINANCE DATA MINIMIZATION

Payment/Refund activities may include:

```text
amount
currency
status
reference
```

Store only fields accepted for timeline projection.

Do not duplicate provider secrets, payment method internals or unnecessary finance metadata.

---

# 24. DEEP-LINK METADATA

If architecture stores deep-link/source routing metadata, keep it canonical and stable.

Examples may map to:

```text
Order detail
Booking detail
Customer/Partner Notes tab
Chat route
```

Do not hardcode dead routes.

If deep links are meant to be derived later in API/UI, do not persist redundant strings.

---

# 25. EDITED SOURCE SEMANTICS

Implement accepted semantics for source edits.

Operational Notes example:

```text
note created
note edited
note deleted
```

Architecture must determine whether CrmActivity:

```text
updates existing row
adds new activity row
both
```

Do not invent a second history semantics.

---

# 26. DELETED SOURCE SEMANTICS

For deleted/soft-deleted sources, implement accepted behavior.

Possible:

```text
hide ordinary activity
retain tombstone metadata
retain audit-only activity
```

Apply per source.

Do not leak deleted note/message content through stale activity rows.

---

# 27. CUSTOMER HISTORY MIGRATION SOURCE

Existing Customer History is accepted as a migration/input source.

Audit exact current model.

Define:

```text
which rows become CrmActivity
activityType mapping
occurredAt
actor
customerId
partnerId if any
deep link
dedupe key
```

Do not delete or alter existing CustomerHistory in Round 2A unless architecture explicitly requires migration semantics now.

Prefer additive projection first.

---

# 28. SOURCE ADAPTER ARCHITECTURE

Implement a shared source-adapter/projector layer.

Conceptual adapters:

```text
OperationalNoteActivityAdapter
OrderActivityAdapter
BookingActivityAdapter
PaymentActivityAdapter
RefundActivityAdapter
MessageActivityAdapter
AuditActivityAdapter
CustomerHistoryActivityAdapter
BuyerRequestActivityAdapter
PartnerApplicationActivityAdapter
```

Exact naming may follow repository conventions.

Each adapter must own:

```text
source → activity mapping
occurredAt selection
subject binding
safe projection fields
dedupe identity
```

Avoid one giant switch with uncontrolled metadata.

---

# 29. REQUIRED SOURCE ADAPTER MATRIX

| Source | Adapter | Event Types | occurredAt Source | Customer Binding | Partner Binding | Dedupe Key | Safe Projection |
|---|---|---|---|---|---|---|---|
| OperationalNote | | | | | | | |
| Order | | | | | | | |
| Booking | | | | | | | |
| Payment | | | | | | | |
| Refund | | | | | | | |
| Message | | | | | | | |
| Audit | | | | | | | |
| CustomerHistory | | | | | | | |
| BuyerRequest | | | | | | | |
| PartnerApplication | | | | | | | |

No blank rows.

---

# 30. EVENT / WRITE PATH INTEGRATION

Determine which sources already emit canonical events.

For those:

```text
consume canonical event
→ project CrmActivity
```

For sources without events:

```text
do not invent fake event history
```

Use the accepted architecture's chosen integration:

```text
direct projector call
domain event
audit event
backfill only
hybrid
```

Do not refactor unrelated source domains just to standardize events.

---

# 31. EVENTBUS SAFETY

Previous project work established EventBus isolation requirements.

Any new activity projector/listener must preserve:

```text
listener cleanup
test isolation
idempotency
no duplicate subscription
no global leakage
```

Do not reintroduce shared-state flakiness.

---

# 32. ASYNC CONSISTENCY

If projection is asynchronous:

```text
do not claim immediate strong consistency
```

Implement accepted retry/reconciliation foundation.

If projection is synchronous for some sources and async for others, document hybrid consistency.

Round 2A must expose the exact guarantee.

---

# 33. FAILURE HANDLING

Projection failure must not corrupt the canonical source transaction unless architecture explicitly couples them.

Define accepted behavior:

```text
source write succeeds
projection may retry
```

or:

```text
source + projection same transaction
```

per architecture.

Do not mix guarantees accidentally.

---

# 34. REPLAY

Implement a replay-safe foundation.

Required:

```text
same event can be reprocessed
no duplicate activity
```

If a projector version changes later, architecture should support rebuild/versioning.

Round 2A should establish needed fields/interfaces.

---

# 35. BACKFILL FOUNDATION

Implement backfill tooling/service foundation for historical data.

It must:

```text
scan canonical sources
emit only reconstructable activity
use canonical timestamps
use idempotent projection
support batching
support resume/retry
avoid duplicate rows
```

Do not execute a destructive or uncontrolled full production backfill in this round unless explicitly required.

---

# 36. BACKFILL PER SOURCE

Classify each source:

```text
FULLY_RECONSTRUCTABLE
PARTIALLY_RECONSTRUCTABLE
CURRENT_STATE_ONLY
NOT_BACKFILLABLE
```

Do not invent event history.

---

# 37. REQUIRED BACKFILL MATRIX

| Source | Historical Data Available? | Backfill Classification | Events Backfilled | Events NOT Reconstructable | Timestamp Authority | PASS |
|---|---:|---|---|---|---|---|
| OperationalNote | | | | | | |
| Order | | | | | | |
| Booking | | | | | | |
| Payment | | | | | | |
| Refund | | | | | | |
| Message | | | | | | |
| Audit | | | | | | |
| CustomerHistory | | | | | | |
| BuyerRequest | | | | | | |
| PartnerApplication | | | | | | |

No blank rows.

---

# 38. BACKFILL SAFETY

Backfill must support:

```text
dry run or count preview if practical
batch size
resume cursor
error reporting
idempotent rerun
```

Do not use unbounded `findMany()` over all tables if volumes are large.

---

# 39. REBUILD FOUNDATION

Provide a safe conceptual/implementation path to:

```text
rebuild CrmActivity from canonical sources
```

Requirements:

```text
version-aware
idempotent
no source mutation
no duplicate rows
observable progress
safe interruption
```

Do not expose a dangerous public endpoint.

Internal CLI/service/test helper is acceptable.

---

# 40. MIGRATION

Create real schema migration for CrmActivity.

Migration must be:

```text
additive
safe on existing data
deterministic
reviewable
non-destructive
```

No unrelated table drops.

No destructive reset as proof.

---

# 41. DATABASE CONSTRAINTS

Use constraints where appropriate:

```text
strict sourceType
strict activityType
required occurredAt
required source identity
required subject/scope fields according to model
```

If an activity may belong to only Customer or only Partner, design nullability carefully.

Do not add constraints that contradict accepted dual-subject events.

---

# 42. UNIQUE / DEDUPE CONSTRAINT

Implement a DB-level uniqueness strategy where accepted.

Example conceptual:

```text
UNIQUE(sourceType, sourceId, activityType, sourceEventId)
```

or architecture-approved equivalent.

In-memory dedupe alone is insufficient.

---

# 43. INDEXES

Implement indexes for future query patterns.

At minimum evaluate:

```text
(customerId, occurredAt DESC, id DESC)
(partnerId, occurredAt DESC, id DESC)
(sourceType, sourceId)
(activityType, occurredAt)
(scope fields + occurredAt)
```

Do not blindly add all.

Explain each index based on accepted query pattern.

---

# 44. CURSOR FOUNDATION

Round 2B will expose cursor pagination, but Round 2A should establish deterministic keyset ordering foundation:

```text
occurredAt DESC
id DESC
```

Test:

```text
same occurredAt for multiple rows
stable ordering
```

Do not rely on auto-increment assumptions if ID is UUID.

---

# 45. CURSOR ENCODING

Do not implement public API yet unless needed, but define internal cursor tuple:

```text
occurredAt
id
```

If a shared cursor utility exists, reuse it later.

Do not create insecure opaque cursor parsing prematurely.

---

# 46. PII / RETENTION

Implement only accepted data minimization fields.

Document:

```text
what is copied
what remains source-referenced
what gets deleted/updated when source changes
```

CrmActivity should not become a shadow warehouse of sensitive content.

---

# 47. SECURITY FOUNDATION

Round 2A does not implement full Activity API RBAC, but data must support secure source filtering.

Required foundation:

```text
subject identity
source identity
source type
scope identity
visibility/category metadata if accepted
```

No row may be impossible to authorize later.

---

# 48. NO ACTOR-SPECIFIC MATERIALIZATION

Do not create rows such as:

```text
activity visible to ADMIN
activity visible to FINANCE
```

per actor/role.

Permissions change over time.

Project one source event once, then authorize at read time.

---

# 49. MESSAGE MEMBERSHIP METADATA

If Message activities require conversation membership checks later, retain enough canonical source reference to re-check access.

Do not encode a stale list of authorized users unless architecture explicitly requires it.

---

# 50. AUDIT ITEM SAFETY

If Audit source is included, project only business-safe event types accepted by architecture.

Do not copy raw audit payload into CrmActivity.

Low-level audit/security details remain in canonical audit system.

---

# 51. SOURCE DELETION

Design source deletion handling for:

```text
OperationalNote
Message
CustomerHistory
```

and other deletable sources.

Projection must not leak content after source becomes inaccessible/deleted.

Implement accepted update/tombstone behavior where source listeners already exist.

---

# 52. DATA MODEL MATRIX — REQUIRED

Fill exact implemented schema:

| Field | Type | Required | Default | Indexed | Source/Derived | Purpose |
|---|---|---:|---|---:|---|---|
| id | | | | | | |
| sourceType | | | | | | |
| sourceId | | | | | | |
| activityType | | | | | | |
| customerId | | | | | | |
| partnerId | | | | | | |
| occurredAt | | | | | | |
| actorUserId | | | | | | |

Add every implemented field.

No blank rows.

---

# 53. SOURCE EVENT TAXONOMY MATRIX — REQUIRED

Use exact accepted activity taxonomy:

| Activity Type | Source Type | Meaning | occurredAt Field | Backfillable? | Customer? | Partner? |
|---|---|---|---|---:|---:|---:|
| | | | | | | |

No unexplained event types.

---

# 54. SUBJECT BINDING MATRIX — REQUIRED

| Source/Event | Customer Binding Path | Partner Binding Path | Dual Subject? | Scope Source | PASS |
|---|---|---|---:|---|---|
| OperationalNote | | | | | |
| Order | | | | | |
| Booking | | | | | |
| Payment | | | | | |
| Refund | | | | | |
| Message | | | | | |
| Audit | | | | | |
| CustomerHistory | | | | | |
| BuyerRequest | | | | | |
| PartnerApplication | | | | | |

No blank rows.

---

# 55. TIMESTAMP AUTHORITY MATRIX — REQUIRED

| Event | Canonical Source Field | Generic createdAt Fallback? | Reason | PASS |
|---|---|---:|---|---|
| Note created | | NO | | |
| Order created | | | | |
| Order cancelled | | | | |
| Booking created | | | | |
| Payment captured | | NO | | |
| Refund processed | | NO | | |
| Message sent | | | | |
| Audit event | | | | |

Add actual accepted events.

No semantic substitution.

---

# 56. PROJECTION IDENTITY MATRIX — REQUIRED

| Source/Event | Dedupe Identity | DB Constraint | Replay Safe | Duplicate Test | PASS |
|---|---|---|---:|---:|---|
| OperationalNote | | | | | |
| Order | | | | | |
| Booking | | | | | |
| Payment | | | | | |
| Refund | | | | | |
| Message | | | | | |
| Audit | | | | | |
| CustomerHistory | | | | | |
| BuyerRequest | | | | | |
| PartnerApplication | | | | | |

---

# 57. SOURCE ADAPTER TESTS

Each adapter must have tests for:

```text
source → activityType mapping
occurredAt
customerId
partnerId
scope
actor
safe projection
dedupe identity
unsupported event behavior
```

Do not test only the shared projector.

---

# 58. IDEMPOTENCY TESTS

Mandatory:

```text
project same source event once
project same source event twice
project same source event concurrently where practical
```

Expected:

```text
one logical CrmActivity
```

---

# 59. CURSOR ORDER TEST

Create multiple rows with identical `occurredAt`.

Prove deterministic order by:

```text
occurredAt DESC
id DESC
```

or exact accepted tie-breaker.

---

# 60. SUBJECT ISOLATION TESTS

Mandatory service/integration tests:

```text
Customer A activity query foundation never matches Customer B
Partner A never matches Partner B
dual-subject Order appears in correct Customer + Partner scopes
unrelated entity excluded
```

Even before public API, test repository/query helpers if implemented.

---

# 61. CANONICAL BUSINESS DATE TESTS

Mandatory:

```text
Payment activity uses paidAt
Refund activity uses processedAt
Order cancellation uses cancelledAt
```

No fallback to `createdAt`.

For rows where canonical event timestamp is NULL:

```text
do not project that event
```

unless architecture explicitly defines a separate event with another timestamp.

---

# 62. BACKFILL TESTS

Test:

```text
first run
second identical run
resume after partial batch
mixed reconstructable/non-reconstructable data
```

Expected:

```text
no duplicates
no fake events
same final logical activity set
```

---

# 63. REBUILD TEST

If rebuild helper is implemented:

```text
populate activity
clear/rebuild safe test DB projection
compare logical activity set
```

Do not mutate source records.

---

# 64. MIGRATION TEST / PROOF

Required runtime evidence:

```text
migration applies to representative existing DB
existing data preserved
CrmActivity table exists
constraints/indexes exist
migration status clean
no destructive reset
```

---

# 65. QUERY PLAN / INDEX EVIDENCE

Where practical, use EXPLAIN for:

```text
Customer timeline ordered by occurredAt/id
Partner timeline ordered by occurredAt/id
```

On small dataset, planner may choose seq scan; report honestly.

Do not fabricate index-use claims.

---

# 66. PERFORMANCE

No arbitrary new SLO.

Provide basic evidence that chosen schema/query supports future cursor reads.

Do not weaken unrelated perf tests.

---

# 67. EVENTBUS REGRESSION

If new listeners/subscribers are added:

```text
no duplicate subscription
no listener leakage
cleanup works
test isolation preserved
```

Add tests where appropriate.

---

# 68. OPERATIONAL NOTES REGRESSION

Round 2A–2D.1 must remain intact.

Activity projection from OperationalNote must NOT:

```text
change note lifecycle
change note RBAC
change note visibility
change note audit semantics
```

Read model is downstream only.

---

# 69. ORDER / BOOKING REGRESSION

Activity projection must not:

```text
mutate statuses
change event transitions
change create behavior
change sorting/filtering
```

Only observe/map canonical events/data.

---

# 70. PAYMENT / REFUND REGRESSION

Activity projection must not change:

```text
Payment.status
paidAt
Refund.status
processedAt
refund reason
amounts
```

Projection failure must not create fake business transition.

---

# 71. MESSAGE REGRESSION

If messaging listeners are touched:

```text
message send/read/member behavior remains unchanged
```

No timeline projection may alter conversation state.

---

# 72. FRONTEND REGRESSION

No Activity UI is implemented, but frontend gates remain required:

```text
Frontend TSC
Frontend tests
Frontend build
```

Production frontend files ideally remain unchanged.

---

# 73. BACKEND REGRESSION

Required:

```text
Backend TSC
new CrmActivity unit tests
source adapter tests
projection/idempotency tests
migration/integration tests
relevant existing domain tests
Backend build
full backend suite
```

Report exact counts.

Known pre-existing perf instability must be reported separately and cannot waive new failures.

---

# 74. PRODUCTION CHANGE SCOPE

Allowed:

```text
Prisma/schema
migration
CRM Activity backend module
source adapters/projectors
event listeners/subscribers where required
backfill/rebuild internal foundation
tests
implementation report
```

Forbidden:

```text
Activity HTTP API beyond minimal internal test need
Customer 360 Activity UI
Partner 360 Activity UI
new messaging composer
email/SMS/WhatsApp integration
frontend timeline components
Storefront Pro CRM
Marketplace Basic CRM
unrelated refactors
```

---

# 75. REQUIRED IMPLEMENTATION MODULE

Place Activity foundation according to repository conventions.

Candidate:

```text
backend/src/modules/crm-activity/
```

or accepted equivalent.

Conceptually:

```text
CrmActivityModule
CrmActivityService
CrmActivityProjector
source adapters
backfill service
rebuild service/helper
```

Do not bury cross-domain projection logic inside one source module.

---

# 76. REQUIRED MIGRATION MATRIX

| Item | Before | After | Existing Data Impact | Recovery | PASS |
|---|---|---|---|---|---|
| CrmActivity table | | | | | |
| sourceType enum | | | | | |
| activityType enum | | | | | |
| unique/dedupe constraint | | | | | |
| customer timeline index | | | | | |
| partner timeline index | | | | | |
| source identity index | | | | | |

No blank rows.

---

# 77. REQUIRED BACKFILL RUNTIME EVIDENCE

Use representative local/test data.

Report counts:

```text
source rows scanned
activity rows projected
duplicates suppressed
rows skipped because non-reconstructable
errors
duration
```

Do not claim production scale from local sample.

---

# 78. REQUIRED REPLAY EVIDENCE

Process a representative event twice.

Show:

```text
first projection count
second projection count
final logical row count
dedupe identity
```

---

# 79. REQUIRED DATA MINIMIZATION MATRIX

| Source | Fields Copied to Activity | Fields Referenced Only | Sensitive Fields Explicitly NOT Copied | PASS |
|---|---|---|---|---|
| OperationalNote | | | | |
| Payment | | | | |
| Refund | | | | |
| Message | | | | |
| Audit | | | | |

Add other sources as needed.

---

# 80. REQUIRED FINAL RESPONSE FORMAT

Return:

```text
VERDICT:

PRECONDITION
Repository:
Branch:
Starting SHA:
2b0438a preserved:

ARCHITECTURE AUTHORITY
Report read:
Conflicts found:

IMPLEMENTATION SUMMARY

DATA MODEL MATRIX
...

SOURCE EVENT TAXONOMY MATRIX
...

SUBJECT BINDING MATRIX
...

TIMESTAMP AUTHORITY MATRIX
...

PROJECTION IDENTITY MATRIX
...

SOURCE ADAPTER MATRIX
...

VISIBILITY / SCOPE FOUNDATION
...

DATA MINIMIZATION MATRIX
...

PROJECTION CONSISTENCY
Synchronous:
Asynchronous:
Retry:
Replay:
Dedupe:

BACKFILL MATRIX
...

BACKFILL IMPLEMENTATION
Batching:
Resume:
Dry run/count:
Idempotency:
Non-reconstructable handling:

REBUILD FOUNDATION
...

MIGRATION MATRIX
...

MIGRATION RUNTIME EVIDENCE
...

REPLAY / DEDUPE EVIDENCE
...

CURSOR ORDER FOUNDATION
...

SUBJECT ISOLATION EVIDENCE
...

BUSINESS DATE EVIDENCE
Payment:
Refund:
Order cancellation:

SOURCE REGRESSION
Operational Notes:
Orders:
Bookings:
Payments:
Refunds:
Messages:

INDEX / QUERY PLAN EVIDENCE
...

REGRESSION
Backend TSC:
CrmActivity unit tests:
Source adapter tests:
Projection tests:
Migration/integration tests:
Relevant domain tests:
Full backend suite:
Known perf-harness result:
Backend build:
Frontend TSC:
Frontend tests:
Frontend build:

RUNTIME AUTHORITY
Git HEAD:
origin/master:
Backend PID/CWD/port:
Database:
Migration status:
Frontend PID/CWD/port if running:

FILES CHANGED
...

UNRELATED PRODUCTION FILES:
...

Report:
Commit:
HEAD:
origin/master:
HEAD == origin/master:

REMAINING FINDINGS
P0:
P1:
P2:

ROUND 2A STATUS:
NEXT CANONICAL ROUND:
```

---

# 81. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2A_READ_MODEL_MIGRATION_SOURCE_ADAPTERS_BACKFILL_FOUNDATION_REPORT.md
```

Report actual evidence.

---

# 82. ACCEPTANCE CRITERIA

VERDICT A requires ALL:

1. Starting SHA verified.
2. `2b0438a` preserved.
3. Architecture report read before implementation.
4. Exact 10 source types confirmed.
5. Exact accepted activity taxonomy implemented.
6. No unsupported source type added.
7. CrmActivity model implemented.
8. CrmActivity remains read model only.
9. Stable source identity implemented.
10. Dedupe key implemented.
11. DB-level dedupe/unique strategy implemented where accepted.
12. Idempotent projector implemented.
13. Repeated projection creates no duplicate logical activity.
14. Canonical occurredAt semantics implemented.
15. No generic createdAt fallback.
16. Payment captured uses paidAt.
17. Refund processed uses processedAt.
18. Order cancellation uses cancelledAt.
19. Null canonical event timestamps do not fabricate events.
20. No fake historical transitions.
21. Customer subject binding implemented.
22. Partner subject binding implemented.
23. Dual-subject semantics match architecture.
24. Scope metadata supports future authorization.
25. No unscoped activity rows.
26. No actor-specific materialization.
27. Actor metadata server-derived.
28. PII minimization follows architecture.
29. Message sensitive content not over-copied.
30. OperationalNote content not duplicated beyond accepted design.
31. Finance sensitive metadata minimized.
32. Audit payload not copied raw.
33. Deleted-source behavior matches architecture.
34. Edited-source behavior matches architecture.
35. CustomerHistory migration mapping implemented.
36. Source adapter layer implemented.
37. OperationalNote adapter passes.
38. Order adapter passes.
39. Booking adapter passes.
40. Payment adapter passes.
41. Refund adapter passes.
42. Message adapter passes.
43. Audit adapter passes.
44. CustomerHistory adapter passes.
45. BuyerRequest adapter passes.
46. PartnerApplication adapter passes.
47. Source Adapter Matrix complete.
48. Existing canonical events reused where available.
49. No unnecessary domain-event refactor.
50. EventBus isolation preserved.
51. Async/sync consistency guarantee documented.
52. Projection failure semantics defined.
53. Replay-safe foundation implemented.
54. Backfill service/foundation implemented.
55. Backfill is batched.
56. Backfill is resumable or safely restartable.
57. Backfill is idempotent.
58. Backfill skips non-reconstructable history honestly.
59. Backfill Matrix complete.
60. No fake status history generated.
61. Rebuild foundation supplied.
62. Rebuild does not mutate source data.
63. Schema migration created.
64. Migration additive/non-destructive.
65. Existing data preserved.
66. No destructive reset used as proof.
67. Required DB constraints implemented.
68. Required indexes implemented.
69. Migration Matrix complete.
70. Customer timeline index/query foundation exists.
71. Partner timeline index/query foundation exists.
72. Stable occurredAt/id ordering foundation exists.
73. Same-timestamp deterministic order tested.
74. Data Model Matrix complete.
75. Source Event Taxonomy Matrix complete.
76. Subject Binding Matrix complete.
77. Timestamp Authority Matrix complete.
78. Projection Identity Matrix complete.
79. Data Minimization Matrix complete.
80. Adapter tests cover mapping/subject/timestamp/dedupe.
81. Idempotency tests pass.
82. Subject isolation tests pass.
83. Canonical business-date tests pass.
84. Backfill first-run test passes.
85. Backfill rerun test produces no duplicates.
86. Backfill resume/restart behavior tested.
87. Rebuild test passes if helper implemented.
88. Migration runtime proof supplied.
89. Replay/dedupe runtime evidence supplied.
90. Backfill runtime evidence supplied.
91. Index/query-plan evidence supplied honestly.
92. Operational Notes regression passes.
93. Order regression passes.
94. Booking regression passes.
95. Payment regression passes.
96. Refund regression passes.
97. Message regression passes if touched.
98. Backend TSC passes.
99. New CrmActivity tests pass.
100. Source adapter tests pass.
101. Projection tests pass.
102. Migration/integration tests pass.
103. Relevant domain tests pass.
104. Backend build passes.
105. Full backend suite executed/reported.
106. No new failure hidden behind known perf waiver.
107. Frontend TSC passes.
108. Frontend tests pass.
109. Frontend build passes.
110. No Activity API implemented beyond minimal internal need.
111. No Activity UI implemented.
112. No Customer 360 Activity tab implemented.
113. No Partner 360 Activity tab implemented.
114. No new communication channel implemented.
115. No Storefront Pro CRM work started.
116. No Marketplace Basic CRM work started.
117. No unrelated production refactor.
118. Report created.
119. Commit created/pushed.
120. HEAD == origin/master.
121. No unresolved P0/P1 data-integrity/projection/security defect remains.

---

# 83. VERDICT

Success only:

```text
VERDICT A — PHASE 3 STEP 3.5.3 PLATFORM CRM /
CRM ACTIVITY TIMELINE IMPLEMENTATION ROUND 2A /
CRM ACTIVITY READ MODEL + MIGRATION + SOURCE ADAPTERS +
CANONICAL TIMESTAMP AUTHORITY + IDEMPOTENT PROJECTION +
BACKFILL / REBUILD FOUNDATION /
FULLY IMPLEMENTED AND VERIFIED
```

Failure:

```text
VERDICT B — PHASE 3 STEP 3.5.3 /
CRM ACTIVITY ROUND 2A /
READ MODEL / PROJECTION / BACKFILL FOUNDATION INCOMPLETE
```

No conditional VERDICT A.

---

# 84. NEXT CANONICAL ROUND

Only after VERDICT A:

```text
PHASE 3 — STEP 3.5.3
CRM COMMUNICATIONS + ACTIVITY TIMELINE

ROUND 2B
ACTIVITY API + RBAC + CURSOR PAGINATION +
SERVER-SIDE FILTERING + SUBJECT AUTHORITY
```

Do NOT implement Round 2B in this prompt.

---

# 85. STOP

After implementation report and verdict:

```text
STOP
```

Do not continue into Activity API or UI.
