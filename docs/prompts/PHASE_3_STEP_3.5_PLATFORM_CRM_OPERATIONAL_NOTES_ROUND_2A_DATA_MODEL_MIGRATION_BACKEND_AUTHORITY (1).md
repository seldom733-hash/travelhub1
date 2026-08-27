# PHASE 3 — PLATFORM CRM
## STEP 3.5 — OPERATIONAL NOTES IMPLEMENTATION
## ROUND 2A — DATA MODEL + MIGRATION + BACKEND AUTHORITY

---

# 1. PRECONDITION

Previous architecture reconciliation is accepted:

```text
VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM /
OPERATIONAL NOTES + COMMENTS ARCHITECTURE /
DOMAIN MODEL + ENTITY COVERAGE + CREATE-FORM NOTE CONTRACT +
VISIBILITY + RBAC + AUDIT + UX CONTRACT /
FULLY RECONCILED — READY FOR IMPLEMENTATION
```

Accepted architecture commit:

```text
240fbe8
```

Previous Shared Table Controls final closure:

```text
ec2e65c
```

Preserve both accepted baselines.

This round is the first production implementation round for Operational Notes.

---

# 2. ROUND SCOPE

Implement ONLY:

```text
OperationalNote data model
OperationalNote migration
backend domain authority
parent-entity reference authority
workspace/tenant/scope authority
server-authoritative author/timestamps/visibility
repository/service foundation
transaction primitive for entity + initial note
backend tests
migration/runtime evidence
```

Do NOT implement yet:

```text
full Notes CRUD HTTP API
frontend Notes UI
Customer 360 Notes UI
Partner 360 Notes UI
Order/Booking/Service Notes UI
create-form textareas
Storefront Pro CRM
Marketplace Basic CRM finalization
Partner Workspace sidebar
mentions
attachments
notifications
threads
global note search
unified Activity timeline
```

Those belong to later rounds.

---

# 3. IMPLEMENTATION PRINCIPLE

Operational Note is a separate canonical operational record.

It is NOT a replacement for:

```text
status
business date
reason
description
audit event
entity history
```

Invariant:

```text
canonical business state remains canonical
OperationalNote stores human-entered operational context
```

Example:

```text
Payment.status = PENDING
Payment.paidAt = NULL

OperationalNote:
"Клиент сообщил, что оплатит завтра."
```

The note MUST NOT populate `paidAt`.

Example:

```text
Refund.status = APPROVED
Refund.processedAt = NULL

OperationalNote:
"Возврат согласован, ожидаем обработку банка."
```

The note MUST NOT populate `processedAt`.

---

# 4. ARCHITECTURE AUTHORITY

Use the accepted Round 1 V2 report as the primary architecture authority.

Before modifying schema/code:

1. Read the V2 architecture report.
2. Verify actual repository/schema state at current HEAD.
3. Confirm all accepted entity names and scopes.
4. Confirm existing audit/event infrastructure.
5. Confirm soft-delete/edit decisions from the accepted report.
6. Confirm workspace/tenant model from actual code.
7. Do not silently reinterpret accepted architecture.

If the accepted report conflicts with current production schema/runtime:

```text
STOP the conflicting part
classify the mismatch
report it
```

Do not invent an incompatible implementation merely to obtain VERDICT A.

---

# 5. ENTITY COVERAGE

The accepted V2 architecture identified these note-capable business entities:

```text
Customer
Partner
Service / Product
Order
BuyerRequest
PartnerApplication
Booking
Payment
Refund
```

And classified:

```text
User       → N/A
Payout     → N/A
Storefront → N/A
```

Round 2A MUST verify this against the actual schema before implementation.

Do not silently add note support to unrelated entities.

---

# 6. REQUEST / APPLICATION AUTHORITY

Preserve the accepted distinction:

```text
BuyerRequest
= buyer request/application
= reverse.BuyerRequest

PartnerApplication
= partner onboarding application
= security.PartnerApplication
```

Do NOT collapse them into:

```text
Order
Booking
generic Request
```

They are separate business authorities.

---

# 7. CANONICAL OPERATIONAL NOTE MODEL

Implement the canonical model accepted by Round 1 V2.

At minimum the implementation must support the accepted semantics for:

```text
id
parent entity reference
text
visibility
authorUserId
createdAt
updatedAt
edit/delete/audit fields if required by accepted architecture
workspace/tenant scope if required
```

Do not blindly use this prompt as a schema replacement.

The accepted V2 architecture report + actual repository are authoritative for exact fields.

---

# 8. ENTITY TYPE

If the accepted architecture uses a shared OperationalNote model, introduce a strict canonical entity type.

Conceptual values:

```text
CUSTOMER
PARTNER
PRODUCT
ORDER
BUYER_REQUEST
PARTNER_APPLICATION
BOOKING
PAYMENT
REFUND
```

Use project naming conventions.

Do not store arbitrary free-text entity types.

Prefer:

```text
enum
```

or an equivalently strict server-controlled representation.

---

# 9. VISIBILITY

Initial supported visibility MUST preserve the safe architecture default:

```text
INTERNAL
```

If the accepted architecture defines future values such as:

```text
PARTNER_VISIBLE
CUSTOMER_VISIBLE
```

they may exist in the model only if explicitly accepted by V2.

But Round 2A MUST NOT expose them through public/client-facing behavior.

Invariant:

```text
default visibility = INTERNAL
```

The client must not be able to forge visibility during entity creation in this round.

---

# 10. AUTHOR AUTHORITY

Canonical author:

```text
authorUserId = authenticated actor
```

Server authority only.

Forbidden:

```text
client-supplied authorUserId
client-supplied author name
client-supplied role
```

If the underlying creation workflow currently lacks an authenticated internal actor, do not invent one.

Classify that create flow explicitly for Round 2D integration.

---

# 11. TIMESTAMP AUTHORITY

Canonical note timestamps MUST be server/database authoritative.

At minimum:

```text
createdAt
updatedAt
```

If accepted architecture contains:

```text
editedAt
deletedAt
```

implement according to that contract.

Forbidden:

```text
client-forged createdAt
client-forged updatedAt
```

Note timestamps remain independent from parent business dates.

---

# 12. TEXT CONTRACT

OperationalNote text:

```text
plain text
optional only at parent create-form level
required/non-empty once an OperationalNote record is created
max 5000 characters
trimmed according to accepted validation semantics
```

Reject:

```text
empty string
whitespace-only note
over 5000 characters
```

Do not introduce rich HTML.

Do not persist raw HTML as a trusted rendering format.

---

# 13. PARENT ENTITY REFERENCE STRATEGY

Implement the entity-reference strategy accepted by Round 1 V2.

If the selected architecture is:

```text
entityType + entityId
```

then backend authority MUST compensate for lack of native polymorphic FK by validating parent existence and scope before note persistence.

If explicit nullable foreign keys or entity-specific relations were selected, implement those instead.

Do not change the accepted architecture merely for convenience.

---

# 14. REFERENTIAL INTEGRITY

For every supported entity type, define and implement:

```text
parent exists
parent belongs to authorized scope
parent is valid for note attachment
parent deletion/archive semantics
orphan prevention
```

A note must never be persisted against a random UUID without parent validation.

---

# 15. PARENT RESOLVER

Create one canonical backend mechanism for resolving note parents.

Conceptually:

```ts
resolveOperationalNoteParent({
  entityType,
  entityId,
  actorContext,
})
```

It should determine:

```text
Does parent exist?
Is entityType valid?
Is actor allowed within its workspace/tenant/scope?
What canonical scope belongs to the note?
Can a note be attached?
```

Avoid duplicating nine unrelated security implementations if the project architecture supports a shared resolver.

But do not bypass domain-specific authorization.

---

# 16. SCOPE INHERITANCE

A note MUST inherit access boundaries from its parent.

Conceptually:

```text
Parent scope
→ Note scope
```

Never:

```text
Note ID
→ independent access bypassing parent
```

Audit actual project boundaries, including where applicable:

```text
PLATFORM workspace
PARTNER workspace
tenant
partner
customer ownership
role
permission
```

Round 2A must establish the backend foundation even though full CRUD permission endpoints come in Round 2B.

---

# 17. WORKSPACE / TENANT STORAGE

If the accepted V2 architecture requires denormalized scope fields on OperationalNote, implement them.

If scope is intentionally derived from the parent, preserve that design.

Do not add redundant scope columns without architectural authority.

If denormalized scope exists:

```text
server derives it
client never supplies it
```

---

# 18. INDEXING

Implement indexes required by the accepted architecture and actual query patterns.

Typical shared-model candidate:

```text
(entityType, entityId, createdAt)
(authorUserId, createdAt)
```

Potential scope-aware index:

```text
(workspaceId, entityType, entityId, createdAt)
```

only if `workspaceId` is part of the accepted model.

Explain each index in the report.

Avoid speculative indexes.

---

# 19. ORDERING

Canonical deterministic note ordering must be supported.

Recommended accepted behavior should normally map to:

```text
createdAt DESC
id DESC
```

or the exact V2 decision.

Tie-breaker is required for stable pagination.

Do not rely on timestamp uniqueness.

---

# 20. PAGINATION FOUNDATION

Operational notes are potentially unbounded.

Do NOT embed unlimited note history into parent detail payloads.

Round 2A backend foundation must allow independently pageable retrieval later.

Do not reuse the previous 360 `BOUNDED_CLIENT_EXEMPTION` assumption for notes.

---

# 21. INITIAL NOTE TRANSACTION PRIMITIVE

Implement a reusable backend primitive that later create flows can call.

Conceptual contract:

```ts
createEntityWithInitialOperationalNote(...)
```

or domain-appropriate transaction composition.

The exact function shape should follow existing service architecture.

Core invariant:

```text
Entity + Initial Note = one logical transaction
```

If initial note is supplied and valid:

```text
both persist
```

If initial note is invalid:

```text
neither persists
```

If note persistence fails:

```text
entity rolls back
```

No silent partial success.

---

# 22. DO NOT PREMATURELY WIRE ALL CREATE FLOWS

Round 2A creates the transaction/service foundation.

Do NOT yet add textarea/UI wiring.

Do NOT necessarily modify all nine entity creation endpoints in this round unless the accepted architecture and existing service boundaries require minimal backend integration for proving atomicity.

Full create-flow integration belongs to:

```text
Round 2D
```

Round 2A must nevertheless prove the transaction primitive against representative real entities/tests.

---

# 23. TRANSACTION AUTHORITY

Use the project's actual Prisma transaction conventions.

Preferred invariant:

```text
prisma.$transaction(...)
```

or existing transaction abstraction.

Do not create nested transaction behavior that conflicts with existing services.

Audit whether entity creation services already receive/use transaction clients.

If necessary, design:

```text
TxClient-aware service methods
```

rather than opening uncontrolled nested transactions.

---

# 24. TRANSACTION FAILURE MATRIX

Implement/test:

| Scenario | Entity Persisted? | Note Persisted? | Expected |
|---|---:|---:|---|
| Entity valid, no note | YES | N/A | PASS |
| Entity valid, valid note | YES | YES | PASS |
| Entity invalid | NO | NO | rollback |
| Note empty/whitespace | per accepted create semantics | NO | explicit behavior |
| Note >5000 chars | NO | NO | validation error |
| Parent/entity creation succeeds internally, note insert fails | NO | NO | rollback |
| Duplicate request/retry | no accidental duplicate notes | controlled |
| Invalid entity type | NO | NO | reject |
| Forged author | NO/ignored | NO forged author | server authority |
| Forged scope | NO/ignored | NO forged scope | server authority |

Clarify the accepted behavior for optional blank note:

Recommended:

```text
undefined / null / trimmed empty
→ treat as "no initial note"
```

while direct OperationalNote creation with empty text should be invalid.

Follow V2 if it specifies differently.

---

# 25. IDEMPOTENCY / RETRY

Audit current create-flow idempotency.

Operational Notes must not create duplicate initial notes due solely to a safe retry.

Do not invent a global idempotency platform if one does not exist.

Instead document and implement the narrowest correct behavior supported by existing request/create semantics.

Report:

```text
which create flows already have idempotency
which do not
what Round 2A guarantees
what remains for Round 2D
```

---

# 26. AUDIT INTEGRATION FOUNDATION

Round 1 V2 separated:

```text
Operational Note
Audit Event
History / Activity
```

Preserve that separation.

If existing EventBus/audit infrastructure is accepted as the authority for note mutation audit, wire only the foundational events required by the architecture.

Potential domain events:

```text
OperationalNoteCreated
OperationalNoteUpdated
OperationalNoteDeleted
```

But Round 2A should implement only what is necessary for data/backend authority.

Do not build the unified timeline.

---

# 27. SOFT DELETE / EDIT FIELDS

Implement exactly the accepted V2 decision.

If notes use soft deletion:

```text
deletedAt
deletedBy
```

or equivalent must follow the accepted model.

If notes are immutable and correction-note based, do not introduce update/delete fields.

The report must explicitly state the implemented semantics.

---

# 28. AUTHOR RELATION

If `authorUserId` references the canonical User model, preserve historical note readability when users become:

```text
inactive
locked
soft-deleted
```

Do not cascade-delete operational notes simply because an author account is disabled.

Audit actual User deletion semantics.

---

# 29. PARENT DELETION

For every supported entity class, define actual behavior.

Possible accepted outcomes:

```text
parent cannot be hard-deleted
parent soft-delete preserves notes
hard delete cascades notes
hard delete blocked while notes exist
```

Use actual domain lifecycle.

Do not leave polymorphic orphan behavior undefined.

---

# 30. MIGRATION

Create a real schema migration for the new canonical data model.

Migration must be:

```text
deterministic
reviewable
safe on existing data
safe on representative local DB
```

Do not use destructive reset as proof.

Do not drop unrelated tables/data.

---

# 31. EXISTING DATA MIGRATION

Use the V2 Existing-Field Migration Matrix.

If existing note-like data must be migrated:

```text
preserve it
map canonical author if possible
preserve/derive timestamps carefully
mark migration source if architecture requires it
```

If V2 determined there is no existing data to migrate, prove that and avoid synthetic migration.

Never silently discard note-like business data.

---

# 32. MIGRATION ROLLBACK / FAILURE

Document:

```text
migration preconditions
failure behavior
whether rollback SQL is feasible
how local/CI DB is recovered
```

Do not claim automatic rollback if Prisma migration behavior does not provide it.

---

# 33. DATABASE CONSTRAINTS

Use database constraints where appropriate for:

```text
enum validity
required text
required author
required timestamps
visibility
```

Application validation alone is not sufficient where schema constraints are appropriate.

But do not add DB constraints that contradict polymorphic/reference architecture.

---

# 34. VALIDATION LAYER

Create shared validation/domain rules so later API endpoints and create-flow integrations do not duplicate semantics.

Canonical validation:

```text
text <= 5000
plain text semantics
trim handling
valid entity type
valid visibility
valid parent
server actor
```

---

# 35. BACKEND MODULE LOCATION

Place Operational Notes according to project architecture.

Candidate:

```text
backend/src/modules/operational-notes/
```

or accepted equivalent.

Avoid burying shared notes inside CRM if they also belong to:

```text
Order
Booking
Payment
Refund
BuyerRequest
PartnerApplication
Product
```

This is cross-domain operational infrastructure.

---

# 36. MODULE BOUNDARIES

Recommended conceptual components:

```text
OperationalNotesModule
OperationalNotesService
OperationalNoteParentResolver
OperationalNotePolicy / authorization helper
DTO/domain validation where required
events/audit integration where accepted
```

Round 2A does NOT require public controller endpoints.

---

# 37. NO GENERIC SECURITY BYPASS

A shared module must not become:

```text
getNoteById()
```

with no parent scope validation.

Any future note read/write must be capable of resolving:

```text
note
→ parent
→ workspace/tenant/domain scope
→ permission
```

Design this now.

---

# 38. ENTITY RESOLVER MATRIX

Complete and implement/prove:

| Entity Type | Canonical Model | Parent Lookup | Scope Source | Attach Allowed? | Delete/Archive Semantics | PASS |
|---|---|---|---|---|---|---|
| CUSTOMER | | | | | | |
| PARTNER | | | | | | |
| PRODUCT | | | | | | |
| ORDER | | | | | | |
| BUYER_REQUEST | | | | | | |
| PARTNER_APPLICATION | | | | | | |
| BOOKING | | | | | | |
| PAYMENT | | | | | | |
| REFUND | | | | | | |

No blank rows.

---

# 39. CREATE-FLOW READINESS MATRIX

Round 2A does not fully wire create flows, but must prove readiness:

| Entity | Create Authority | Authenticated Actor Available? | Tx-Compatible? | Initial Note Can Be Atomic? | Gap for Round 2D | PASS |
|---|---|---|---|---|---|---|
| Customer | | | | | | |
| Partner | | | | | | |
| Product | | | | | | |
| Order | | | | | | |
| BuyerRequest | | | | | | |
| PartnerApplication | | | | | | |
| Booking | | | | | | |
| Payment | | | | | | |
| Refund | | | | | | |

No blank rows.

This matrix is important because some automated/system flows may not currently have a human actor.

Do not fabricate one.

---

# 40. BUSINESS STATE REGRESSION MATRIX

Prove Operational Notes do not mutate canonical business fields:

| Entity | Canonical Field | Before | Note Operation | After | PASS |
|---|---|---|---|---|---|
| Payment | paidAt | NULL | create note | NULL | |
| Payment | status | PENDING | create note | PENDING | |
| Refund | processedAt | NULL | create note | NULL | |
| Refund | status | APPROVED/actual test state | create note | unchanged | |
| Order | status | actual state | create note | unchanged | |
| Booking | status | actual state | create note | unchanged | |

Use actual representative records/states.

---

# 41. SECURITY TESTS

At minimum cover backend/service authority for:

```text
invalid entityType
missing parent
cross-scope parent attempt
forged author attempt
forged scope attempt
invalid visibility
empty direct note
oversized note
deleted/invalid parent behavior
```

Use actual project authorization abstractions.

---

# 42. TRANSACTION TESTS

Mandatory tests:

```text
entity + note success
entity without note success
invalid note rollback
forced note insert failure rollback
duplicate/retry behavior
```

At least one representative transaction test must use a real DB integration path, not only mocks.

---

# 43. MIGRATION TEST / PROOF

Required evidence:

```text
migration applies to representative existing DB
existing tables/data remain
OperationalNote table/model exists
indexes exist
enum/constraints exist
migration status clean
```

If CI uses isolated DBs, include migration in the appropriate test path.

---

# 44. QUERY PERFORMANCE PROOF

Use EXPLAIN or equivalent where practical for the canonical future query:

```text
notes by entityType + entityId
ordered by createdAt + id
```

Confirm expected index use on representative data or explain why dataset size prevents meaningful planner selection.

Do not fabricate performance claims.

---

# 45. BUILD / TEST GATES

Required:

```text
Backend TSC
Backend unit tests
Backend integration/E2E tests relevant to changed area
Backend build
Frontend TSC regression
Frontend tests regression
Frontend build regression
```

Frontend is not functionally changed, but regression gates are required because shared types/build contracts may be affected.

Report exact test counts.

---

# 46. RUNTIME AUTHORITY

Report:

```text
Repository path
Branch
Starting SHA
Final SHA
origin/master SHA
Backend PID
Backend CWD
Backend port
Database
Migration status
Frontend PID/CWD/port if running for regression
```

Starting SHA must be:

```text
240fbe8
```

or an explicitly explained descendant.

Preserve:

```text
ec2e65c
240fbe8
```

---

# 47. PRODUCTION CHANGE SCOPE

Allowed production changes:

```text
Prisma/schema
migration
Operational Notes backend module/domain foundation
shared validation/types
minimal transaction integration required for proof
tests
architecture/implementation report
```

Not allowed:

```text
Notes frontend UI
new sidebar items
unrelated CRM redesign
Storefront CRM
Marketplace Partner CRM
new Payment/Refund detail UI
unified timeline
global search
notifications
attachments
mentions
threads
```

---

# 48. REQUIRED DATA MODEL MATRIX

Fill with exact implemented fields:

| Field | Type | Required | Default | Server Authority | Indexed | Purpose |
|---|---|---:|---|---|---:|---|
| id | | | | | | |
| entityType | | | | | | |
| entityId | | | | | | |
| text | | | | | | |
| visibility | | | | | | |
| authorUserId | | | | | | |
| createdAt | | | | | | |
| updatedAt | | | | | | |

Add accepted edit/delete/scope fields.

No blank rows.

---

# 49. REQUIRED MIGRATION MATRIX

| Migration Item | Before | After | Existing Data Impact | Rollback/Recovery | PASS |
|---|---|---|---|---|---|
| OperationalNote model/table | | | | | |
| EntityType enum/constraint | | | | | |
| Visibility enum/constraint | | | | | |
| Author relation | | | | | |
| Indexes | | | | | |
| Existing note-like data | | | | | |

No blank rows.

---

# 50. REQUIRED TRANSACTION MATRIX

| Scenario | Expected Entity | Expected Note | Actual | PASS |
|---|---|---|---|---|
| Valid entity + no note | persisted | none | | |
| Valid entity + valid note | persisted | persisted | | |
| Invalid entity | none | none | | |
| Whitespace optional note | per contract | none | | |
| >5000 note | none | none | | |
| Forced note failure | none | none | | |
| Retry/duplicate | controlled | no accidental duplicate | | |

No blank rows.

---

# 51. REQUIRED AUTHORITY MATRIX

| Authority | Client Controlled? | Server Source | Enforcement | Test | PASS |
|---|---:|---|---|---|---|
| authorUserId | NO | authenticated actor | | | |
| createdAt | NO | server/DB | | | |
| updatedAt | NO | server/DB | | | |
| visibility default | NO | INTERNAL | | | |
| entityType | restricted | route/domain service | | | |
| entityId | restricted | created/resolved parent | | | |
| workspace/tenant scope | NO | parent/context | | | |

No blank rows.

---

# 52. REQUIRED BUSINESS-STATE REGRESSION

Explicitly prove:

```text
OperationalNote create/update/delete
DOES NOT implicitly mutate:
```

```text
Order.status
Booking.status
Payment.status
Payment.paidAt
Refund.status
Refund.processedAt
BuyerRequest status
PartnerApplication status
Product status
```

unless an unrelated canonical domain operation explicitly does so.

---

# 53. REQUIRED EXISTING-FIELD CHECK

Re-run the V2 note-like field audit after implementation.

Report:

```text
fields retained
fields migrated
fields deprecated
fields intentionally separate
```

No duplicate authority may be introduced accidentally.

---

# 54. DOCUMENTATION

Create implementation report:

```text
docs/prompts/PHASE_3_STEP_3.5_PLATFORM_CRM_OPERATIONAL_NOTES_ROUND_2A_DATA_MODEL_MIGRATION_BACKEND_AUTHORITY_REPORT.md
```

The report must contain actual evidence, not only intended architecture.

---

# 55. ACCEPTANCE CRITERIA

VERDICT A requires ALL:

1. Starting baseline verified.
2. `ec2e65c` preserved.
3. `240fbe8` preserved.
4. Accepted V2 report read before implementation.
5. Actual schema re-audited.
6. OperationalNote canonical model implemented.
7. Entity type authority implemented.
8. Visibility authority implemented.
9. Default visibility = INTERNAL.
10. Author is server-authoritative.
11. Timestamps are server/DB authoritative.
12. Text validation implemented.
13. Max 5000 chars enforced.
14. Empty direct note rejected.
15. Optional blank initial note semantics defined.
16. Parent reference strategy matches V2.
17. Parent existence validated.
18. Parent scope validated.
19. Orphan prevention defined/implemented.
20. Entity Resolver Matrix complete.
21. Customer resolver PASS.
22. Partner resolver PASS.
23. Product resolver PASS.
24. Order resolver PASS.
25. BuyerRequest resolver PASS.
26. PartnerApplication resolver PASS.
27. Booking resolver PASS.
28. Payment resolver PASS.
29. Refund resolver PASS.
30. Scope inheritance enforced.
31. Client cannot forge scope.
32. Client cannot forge author.
33. Client cannot forge timestamps.
34. Unsupported visibility cannot be exposed.
35. Required indexes implemented.
36. Stable ordering foundation implemented.
37. Notes treated as unbounded/pageable data.
38. No unlimited notes embedded into 360 payloads.
39. Transaction primitive implemented.
40. Entity + valid initial note atomic.
41. Invalid initial note cannot create partial entity success.
42. Forced note failure rolls back entity.
43. Retry/duplicate behavior documented/tested.
44. Create-Flow Readiness Matrix complete.
45. No fake authenticated actor invented.
46. BuyerRequest remains separate authority.
47. PartnerApplication remains separate authority.
48. Payment note does not mutate paidAt.
49. Payment note does not mutate payment status.
50. Refund note does not mutate processedAt.
51. Refund note does not mutate refund status.
52. Order note does not mutate order status.
53. Booking note does not mutate booking status.
54. Business-State Regression Matrix complete.
55. Existing audit/history system remains separate.
56. Edit/delete semantics match V2.
57. Parent deletion semantics defined.
58. Author lifecycle semantics defined.
59. Migration created.
60. Migration applies successfully.
61. Existing DB data preserved.
62. No destructive reset used as acceptance proof.
63. Existing note-like data handled according to V2.
64. Data Model Matrix complete.
65. Migration Matrix complete.
66. Transaction Matrix complete.
67. Authority Matrix complete.
68. Security tests pass.
69. Transaction integration test uses real DB path.
70. Migration proof supplied.
71. Backend TSC passes.
72. Backend relevant tests pass.
73. Backend build passes.
74. Frontend TSC regression passes.
75. Frontend tests regression pass.
76. Frontend build regression passes.
77. Exact test counts reported.
78. Production change scope respected.
79. No Notes UI implemented.
80. No create-form textarea UI implemented.
81. No Storefront Pro CRM work started.
82. No Marketplace Basic CRM work started.
83. No Partner Workspace sidebar work started.
84. No unified Activity timeline implemented.
85. No notifications/mentions/attachments/threads implemented.
86. Implementation report created.
87. Runtime authority reported.
88. Commit created and pushed.
89. HEAD == origin/master.
90. No unresolved P0/P1 backend authority defect remains.

---

# 56. REQUIRED FINAL RESPONSE FORMAT

Return:

```text
VERDICT:

PRECONDITION
Repository:
Branch:
Starting SHA:
ec2e65c preserved:
240fbe8 preserved:

V2 ARCHITECTURE AUTHORITY
Report read:
Conflicts found:

IMPLEMENTATION SUMMARY

DATA MODEL MATRIX
...

ENTITY RESOLVER MATRIX
...

CREATE-FLOW READINESS MATRIX
...

PARENT REFERENCE / REFERENTIAL INTEGRITY
...

WORKSPACE / TENANT / SCOPE AUTHORITY
...

AUTHOR / TIMESTAMP / VISIBILITY AUTHORITY
...

TEXT VALIDATION
...

INDEXING / ORDERING / PAGINATION FOUNDATION
...

TRANSACTION IMPLEMENTATION
...

TRANSACTION MATRIX
...

IDEMPOTENCY / RETRY
...

BUSINESS-STATE REGRESSION MATRIX
...

AUDIT / EDIT / DELETE SEMANTICS
...

PARENT DELETE / AUTHOR LIFECYCLE
...

EXISTING NOTE-LIKE FIELD CHECK
...

MIGRATION MATRIX
...

MIGRATION RUNTIME EVIDENCE
...

SECURITY TESTS
...

TRANSACTION TESTS
...

PERFORMANCE / INDEX EVIDENCE
...

REGRESSION
Backend TSC:
Backend tests:
Backend build:
Frontend TSC:
Frontend tests:
Frontend build:

RUNTIME AUTHORITY
Repository:
Branch:
Backend PID/CWD/port:
Database:
Migration status:
Frontend PID/CWD/port:

FILES CHANGED
...

UNRELATED PRODUCTION FILES CHANGED:
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

OPERATIONAL NOTES STATUS:
NEXT CANONICAL ROUND:
```

---

# 57. VERDICT

Success only:

```text
VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM /
OPERATIONAL NOTES IMPLEMENTATION ROUND 2A /
DATA MODEL + MIGRATION + BACKEND AUTHORITY +
PARENT SCOPE + SERVER AUTHORSHIP + ATOMIC INITIAL NOTE FOUNDATION /
FULLY IMPLEMENTED AND VERIFIED
```

Failure:

```text
VERDICT B — OPERATIONAL NOTES ROUND 2A BACKEND/DATA AUTHORITY INCOMPLETE
```

No conditional VERDICT A.

---

# 58. NEXT CANONICAL ROUND

Only after VERDICT A:

```text
PHASE 3 — STEP 3.5
OPERATIONAL NOTES IMPLEMENTATION
ROUND 2B — NOTES API + RBAC + AUDIT / EDIT / DELETE AUTHORITY
```

Do NOT implement Round 2B in this prompt.

---

# 59. STOP

After report and final verdict:

```text
STOP
```

Do not continue into frontend or create-form implementation.
