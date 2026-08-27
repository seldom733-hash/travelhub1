# PHASE 3 — PLATFORM CRM
## STEP 3.5 — OPERATIONAL NOTES / COMMENTS ARCHITECTURE RECONCILIATION
## ROUND 1 — V2 — DOMAIN MODEL / ENTITY COVERAGE / CREATE-FORM NOTE CONTRACT / VISIBILITY / RBAC / AUDIT / UX CONTRACT

---

# 1. STATUS / PRECONDITION

Previous canonical stage is CLOSED:

```text
SHARED TABLE CONTROLS = FINAL CLOSED
Final accepted commit: ec2e65c
```

Preserve all accepted CRM and Shared Table Controls behavior.

Do NOT modify production code in this round.

This round is:

```text
ARCHITECTURE / DATA MODEL / SECURITY / UX RECONCILIATION ONLY
```

Required outcome:

```text
VERDICT A — READY FOR IMPLEMENTATION
```

or:

```text
VERDICT B — ARCHITECTURE RECONCILIATION INCOMPLETE
```

---

# 2. PURPOSE

TravelHub operational users need a canonical way to record important contextual information against business entities.

Examples:

```text
Order:
"Клиент попросил подтвердить трансфер до 18:00."

Booking:
"Поставщик обещал подтверждение завтра утром."

Payment:
"Ожидаем банковское подтверждение."

Refund:
"Возврат согласован, ожидаем фактическую обработку."

Customer:
"Предпочитает связь через WhatsApp."

Partner:
"Документы на продление договора ожидаются."

Service:
"Продажи временно ограничены до подтверждения новой цены."
```

The architecture must determine whether this should be:

```text
simple note field
```

or:

```text
canonical operational notes/comments collection
```

or a justified hybrid.

Do not assume the answer before auditing the existing schema and runtime.

---

# 3. IMPORTANT BUSINESS REQUIREMENT

The user has explicitly required operational notes in creation/workflow contexts so an operator can record important information, including cases where a business event has not happened yet.

Example:

```text
Payment:
paidAt = NULL
status = PENDING
note = "Ожидаем оплату по банковскому переводу."
```

or:

```text
Refund:
processedAt = NULL
status = APPROVED
note = "Возврат согласован, ожидается обработка платёжным провайдером."
```

Critical rule:

```text
NOTE MUST NEVER REPLACE CANONICAL BUSINESS STATE.
```

A note may explain the state.

It may NOT fake:

```text
payment date
refund date
status
amount
confirmation
completion
```

Example:

```text
paidAt = NULL
```

must remain `NULL` until payment actually occurs, regardless of note text.

---


# 3A. MANDATORY CREATE-FORM NOTE CONTRACT

Operational notes MUST be explicitly audited and designed into creation cards/forms for all operational entities where a create flow exists.

This is a REQUIRED architecture contract, not an optional UX enhancement.

Minimum mandatory scope:

```text
Customer
Partner
Order
Request / Application / Заявка
Booking
Payment
Refund
Service / Product
```

Also audit any other actual create flows found in the repository, including where applicable:

```text
Payout
Invoice
Subscription
Storefront
Contract
Support/Request entities
```

For every applicable create flow, the form must provide an optional field:

```text
Примечание / Operational Note
```

The final RU/AZ/EN label must be reconciled through i18n, but its domain semantics are:

```text
manual operational context entered by the creating user
```

It is NOT:

```text
status
reason
description
business date
audit event
system comment
```

---

# 3B. CREATE → FIRST OPERATIONAL NOTE RULE

If the canonical architecture selects an `OperationalNote[]` collection, text entered in the create form MUST become the first OperationalNote attached to the newly created entity.

Conceptual flow:

```text
Create Entity Form
├── canonical entity fields
└── optional Operational Note

Submit
↓
validate entity
↓
validate note
↓
create entity
↓
if note is non-empty:
    create OperationalNote
    entityType = canonical entity type
    entityId = newly created entity id
    authorUserId = current authenticated user
    createdAt = canonical server timestamp
    visibility = INTERNAL by default
↓
return created entity
```

Do NOT create a duplicate free-text authority such as:

```text
Order.note
Booking.note
Customer.note
```

in parallel with `OperationalNote[]` unless the architecture audit proves that the field has a separate canonical meaning.

---

# 3C. REQUEST / APPLICATION MUST NOT BE OMITTED

The architecture audit MUST explicitly identify what entity/model currently represents:

```text
Заявка / Request / Application
```

in TravelHub.

Do not silently assume that Request = Order or Booking.

Required classification:

```text
1. dedicated Request/Application entity exists
or
2. request is represented by a canonical state/stage of another entity
or
3. request concept is not yet implemented
```

If a dedicated create flow exists, it MUST be included in the Operational Note create-form contract.

If it is represented by another entity, document the exact authority and where the create-form note belongs.

If it does not yet exist, mark:

```text
NOT IMPLEMENTED / FUTURE ENTITY
```

rather than inventing a model.

---

# 3D. CREATE-FORM NOTE TRANSACTIONALITY

The architecture MUST define consistency when entity creation and initial note creation are part of one user action.

Preferred invariant:

```text
If the API reports successful creation with an initial note,
both the entity and its initial OperationalNote must be persisted consistently.
```

Evaluate:

```text
single DB transaction
nested Prisma transaction
service-level transaction
safe compensating/retry strategy
```

The report must select one canonical strategy based on the existing architecture.

Forbidden silent state:

```text
UI submitted Entity + Note
→ Entity saved
→ Note failed
→ UI reports full success without warning
```

Also define behavior for:

```text
entity valid + note invalid
entity creation failure
note persistence failure
duplicate submit
request retry
```

---

# 3E. INITIAL NOTE AUTHOR / TIME / VISIBILITY

An initial note created from a create form must use server-authoritative provenance:

```text
authorUserId = authenticated actor
createdAt = server timestamp
visibility = INTERNAL by default
```

The client must not be allowed to forge:

```text
author
createdAt
workspace/tenant
parent entity scope
```

External visibility must never be enabled implicitly because the note was entered during creation.

---

# 3F. INITIAL NOTE AND BUSINESS STATE

The create-form note MUST remain semantically independent from canonical entity state.

Examples:

```text
Payment
status = PENDING
paidAt = NULL
note = "Клиент сообщил, что оплатит завтра."
```

```text
Refund
status = APPROVED
processedAt = NULL
note = "Возврат согласован, ожидаем обработку банка."
```

```text
Booking
status = AWAITING_CONFIRMATION
note = "Поставщик обещал ответить до 12:00."
```

```text
Order
status = NEW
note = "Клиент просит связаться перед подтверждением."
```

Free text must never cause implicit status/date transitions.

---

# 3G. CREATE-FORM UX CONTRACT

For every applicable entity create card/form, reconcile:

```text
placement
label
placeholder
optional/required semantics
max length
multiline behavior
validation
save/loading state
error state
i18n
accessibility
responsive behavior
```

Safe default:

```text
optional multiline textarea
plain text
INTERNAL visibility
no rich HTML
no attachments in v1
```

The note field should normally appear near the end of the business form, before primary submit actions, unless the actual form structure justifies another placement.

Do not use a modal solely to enter the initial note.

---

# 3H. CREATE-FORM COVERAGE MATRIX — MANDATORY

Fill completely after repository audit:

| Entity / Business Concept | Canonical Model | Create Route/Form Exists? | Current Note Field? | Initial Operational Note Required? | Storage Authority | Transaction Strategy | Visibility Default | Decision |
|---|---|---|---|---|---|---|---|---|
| Customer | | | | | | | | |
| Partner | | | | | | | | |
| Order | | | | | | | | |
| Request / Application | | | | | | | | |
| Booking | | | | | | | | |
| Payment | | | | | | | | |
| Refund | | | | | | | | |
| Service / Product | | | | | | | | |

Add every additional actual create flow discovered during audit.

No blank rows.

For a non-applicable entity, use:

```text
N/A + concrete reason
```

not an empty cell.

---

# 4. ROUND 1 EXECUTION RULE

Before proposing implementation:

1. Audit current Prisma/database models.
2. Audit relevant backend entities/services/controllers.
3. Audit current create/update forms.
4. Audit Customer 360 / Partner 360.
5. Audit Order / Booking / Catalog detail pages.
6. Search for any existing fields such as:

```text
note
notes
comment
comments
description
internalNote
remarks
reason
history
activity
audit
metadata
```

7. Determine whether any existing fields already have canonical semantics.
8. Detect conflicting/duplicate concepts.
9. Produce architecture matrices.
10. STOP before production implementation.

Do not create a second notes system if one already exists.

---

# 5. ENTITY COVERAGE AUDIT

At minimum audit:

```text
Customer
Partner
Product / Service
Order
Request / Application / Заявка
Booking
Payment
Refund
User (if operationally justified)
```

Also inspect whether notes are needed for other actual project entities, for example:

```text
Payout
Invoice
Subscription
Storefront
Contract
Support/Request entities
```

Only include them if they actually exist and notes have a defensible business purpose.

---

# 6. REQUIRED ENTITY COVERAGE MATRIX

Fill completely:

| Entity | Exists | Current Note-like Field | Existing Semantics | Operational Notes Needed? | Create Context? | Detail Context? | 360 Context? | Decision |
|---|---|---|---|---|---|---|---|---|
| Customer | | | | | | | | |
| Partner | | | | | | | | |
| Service/Product | | | | | | | | |
| Order | | | | | | | | |
| Request / Application | | | | | | | | |
| Booking | | | | | | | | |
| Payment | | | | | | | | |
| Refund | | | | | | | | |
| User | | | | | | | | |

Add actual relevant entities found during audit.

No blank rows.

---

# 7. CORE ARCHITECTURE DECISION

Compare at least these alternatives.

## OPTION A — SIMPLE FIELD

Example:

```text
Order.note: string?
```

Advantages:

```text
simple
cheap
easy create/edit
```

Limitations:

```text
single current value
no author
no chronological history
weak auditability
concurrent overwrite risk
no visibility model
```

---

# 8. OPTION B — SHARED OPERATIONAL NOTE ENTITY

Conceptual model:

```text
OperationalNote
├── id
├── entityType
├── entityId
├── text
├── visibility
├── authorUserId
├── createdAt
├── updatedAt
└── optional metadata
```

Potential benefits:

```text
multiple notes
chronology
author attribution
auditability
shared UI
cross-entity consistency
future extensibility
```

But audit:

```text
referential integrity
polymorphic relation tradeoffs
query performance
authorization
tenant/workspace scope
deletion behavior
```

---

# 9. OPTION C — ENTITY-SPECIFIC RELATIONS

Example:

```text
OrderNote
BookingNote
CustomerNote
...
```

Audit advantages/disadvantages versus a shared note entity.

Do not choose this merely because explicit foreign keys are convenient.

---

# 10. OPTION D — HYBRID

Possible pattern:

```text
creationNote / operational summary
+
OperationalNote[] history
```

Only recommend if there is a real semantic distinction.

Avoid duplicating the same information into two authorities.

---

# 11. REQUIRED ARCHITECTURE OPTIONS MATRIX

| Criterion | Simple Field | Shared OperationalNote | Entity-specific Notes | Hybrid |
|---|---|---|---|---|
| Multiple entries | | | | |
| Author | | | | |
| Timestamp | | | | |
| Edit history | | | | |
| Auditability | | | | |
| RBAC | | | | |
| Visibility | | | | |
| Referential integrity | | | | |
| Query simplicity | | | | |
| Scalability | | | | |
| Customer 360 integration | | | | |
| Partner 360 integration | | | | |
| Future Storefront CRM reuse | | | | |
| Future Marketplace Partner CRM reuse | | | | |
| Recommendation | | | | |

Give one canonical recommendation.

---

# 12. TERMINOLOGY

Reconcile terminology before implementation.

Candidate concepts:

```text
Примечание / Note
Комментарий / Comment
Внутреннее примечание / Internal Note
Операционная заметка / Operational Note
История / History
Активность / Activity
```

Define exact semantics.

Recommended conceptual distinction to evaluate:

```text
Operational Note
= manually entered business context

Audit Event
= system-generated immutable event

History / Activity
= timeline that may aggregate notes + system events
```

Do not silently equate these concepts.

---

# 13. NOTES VS AUDIT LOG

This distinction is mandatory.

Example manual note:

```text
"Клиент попросил изменить время трансфера."
```

Example audit event:

```text
Booking status changed:
CONFIRMED → CANCELLED
by user X
at timestamp Y
```

Operational notes must NOT replace audit logging.

Audit logs must NOT be editable user notes.

Determine whether they should eventually appear together in one UI timeline while remaining separate data authorities.

---

# 14. NOTES VS STATUS

Mandatory rule:

```text
status = machine/business authority
note = human context
```

Examples:

```text
Payment.status = PENDING
Payment.paidAt = NULL
Note = "Ожидаем поступление средств."
```

```text
Refund.status = APPROVED
Refund.processedAt = NULL
Note = "Ожидаем обработку."
```

UI must not infer canonical state from free text.

---

# 15. NOTES VS REASON FIELDS

Audit fields such as:

```text
cancellationReason
refundReason
rejectionReason
failureReason
```

These may be canonical structured/business reasons.

Do not replace them with generic notes.

Determine:

```text
reason = why canonical event occurred
note = additional operational context
```

where applicable.

---

# 16. NOTE DATA MODEL — REQUIRED FIELDS AUDIT

Evaluate at minimum:

```text
id
workspaceId / tenant scope if required
entityType
entityId
text
visibility
authorUserId
createdAt
updatedAt
editedAt
deletedAt
```

Optional candidates to evaluate:

```text
pinned
category
priority
source
parentNoteId
mentions
attachments
```

Do NOT add optional complexity without demonstrated need.

---

# 17. ENTITY REFERENCE STRATEGY

If recommending a shared polymorphic note model, evaluate:

```text
entityType + entityId
```

against explicit nullable foreign keys or entity-specific join tables.

Address:

```text
referential integrity
cascade/delete behavior
orphan prevention
indexing
Prisma limitations
query ergonomics
security
```

No recommendation without discussing these tradeoffs.

---

# 18. WORKSPACE / TENANT AUTHORITY

Notes must inherit the same authority boundary as their parent entity.

A note must never broaden access.

Conceptually:

```text
Can user read entity?
→ then evaluate note visibility/read permission

Can user write note on entity?
→ then evaluate note write permission
```

Direct note ID access must not bypass parent entity scope.

---

# 19. VISIBILITY MODEL

Decide whether Round 1 needs only:

```text
INTERNAL
```

or should architect future-safe visibility such as:

```text
INTERNAL
PARTNER_VISIBLE
CUSTOMER_VISIBLE
```

Important:

Do not expose internal operational notes to customers or partners by default.

Safe default:

```text
INTERNAL
```

If external visibility is not currently required, design for it only if doing so does not overcomplicate implementation.

---

# 20. PLATFORM VS PARTNER WORKSPACES

Reconcile future reuse.

Current focus:

```text
Platform CRM
```

Future:

```text
Storefront Pro CRM
Marketplace Basic CRM
```

Determine whether note architecture should be shared at domain level while authorization/visibility differs by workspace.

Do NOT implement Storefront or Marketplace Partner CRM in this round.

---

# 21. RBAC

Audit existing permissions.

Determine required permission granularity.

Candidate contract:

```text
notes.read
notes.create
notes.update
notes.delete
```

or entity-scoped variants:

```text
crm.customer.note.read
crm.customer.note.write
order.note.read
booking.note.write
...
```

Compare both approaches against the project's current permission architecture.

Do not invent a broad permission that accidentally allows access across entities/workspaces.

---

# 22. ROLE MATRIX

At minimum evaluate Platform roles already used by the project:

```text
ADMIN
DIRECTOR
ANALYST
MARKETER
FINANCE
MODERATOR
SALES_MANAGER
OPERATOR
```

Do not assume every role may write notes.

Example questions:

```text
Should ANALYST write operational notes?
Should FINANCE write payment/refund notes?
Should OPERATOR delete notes?
Should MODERATOR edit another user's note?
```

Provide safe defaults and explain them.

---

# 23. REQUIRED RBAC MATRIX

| Role | Read Internal Notes | Create | Edit Own | Edit Others | Delete Own | Delete Others |
|---|---|---|---|---|---|---|
| ADMIN | | | | | | |
| DIRECTOR | | | | | | |
| ANALYST | | | | | | |
| MARKETER | | | | | | |
| FINANCE | | | | | | |
| MODERATOR | | | | | | |
| SALES_MANAGER | | | | | | |
| OPERATOR | | | | | | |

If permissions should vary by entity/domain, provide additional matrix rather than oversimplifying.

---

# 24. EDIT SEMANTICS

Decide whether notes are:

```text
immutable after creation
```

or:

```text
editable
```

If editable, define audit requirements.

At minimum consider:

```text
createdAt
updatedAt
edited indicator
who edited
previous value/history
```

For enterprise operational records, silent destructive editing is undesirable.

---

# 25. DELETE SEMANTICS

Compare:

```text
hard delete
soft delete
tombstone / deleted marker
no delete, correction note only
```

Determine appropriate behavior by role.

Audit implications are mandatory.

Example concern:

```text
Operator writes a note influencing a refund decision,
then deletes it after the refund.
```

Architecture must prevent loss of material audit context.

---

# 26. NOTE HISTORY

If editing is allowed, determine whether history needs:

```text
OperationalNoteRevision
```

or whether existing audit infrastructure can record changes.

Do not duplicate an existing canonical audit/event system.

Audit the repository first.

---

# 27. AUTHOR AUTHORITY

Every persisted operational note should have canonical author attribution unless a strong reason exists otherwise.

Evaluate:

```text
authorUserId
author display name snapshot?
role snapshot?
```

Prefer canonical user relation where safe.

If users can later be deleted/deactivated, define historical rendering behavior.

---

# 28. TIMESTAMPS

At minimum distinguish:

```text
createdAt
updatedAt
```

If edited:

```text
editedAt
```

if useful.

Display timestamps according to existing project timezone/date conventions.

Do not confuse note timestamp with business event timestamp.

Example:

```text
Note created: 26.08.2026
Payment paidAt: NULL
```

These are independent.

---

# 29. CREATE FORMS

Audit all relevant entity creation flows.

Determine where an optional:

```text
Примечание
```

field should appear.

Mandatory create-flow audit:

```text
Customer creation
Partner creation
Service/Product creation
Order creation
Request/Application creation
Booking creation
Payment creation/initiation
Refund request creation
```

Every existing applicable create flow MUST expose an optional Operational Note input under the canonical create-form contract.

Do not assume every business concept has a direct create form: verify routes/components/backend authority. Missing create flows must be classified explicitly rather than silently omitted.

---

# 30. CREATE-FORM SEMANTICS

If the selected canonical model is `OperationalNote[]`, a note entered during creation MUST become:

```text
the first OperationalNote attached to the newly created entity
```

A dedicated entity field is permitted only if repository audit proves it has a separate canonical semantic purpose.

Avoid duplicate `note` authorities.

Transactionality MUST be addressed:

```text
entity creation succeeds
note creation fails
```

What is the canonical behavior?

---

# 31. PAYMENT / REFUND CREATION REQUIREMENT

This is especially important.

A user must be able to record operational context even before payment/refund completion.

Example:

```text
Payment:
status = PENDING
paidAt = NULL

Operational Note:
"Клиент сообщил, что оплатит завтра."
```

Refund:

```text
status = REQUESTED / APPROVED
processedAt = NULL

Operational Note:
"Возврат согласован с руководителем."
```

This must not populate `paidAt` or `processedAt`.

---

# 32. DETAIL PAGE UX

Audit current dedicated routes:

```text
Customer 360
Partner 360
Order detail
Booking detail
Service/Product detail
```

and whether Payment/Refund dedicated detail routes currently exist.

Determine where Notes should appear.

Possible UX:

```text
Entity header
Core data
Business tabs
Notes / Activity section
```

or:

```text
dedicated "Примечания" tab
```

Choose consistently based on expected note volume and importance.

---

# 33. CUSTOMER 360 UX

Determine whether Customer 360 needs:

```text
Notes tab
```

or notes embedded into:

```text
History / Activity
```

Remember existing Customer 360 already has a History concept.

Do not create duplicate competing histories.

Explicitly reconcile:

```text
Customer 360 History
Operational Notes
Audit Events
```

---

# 34. PARTNER 360 UX

Partner 360 currently includes operational/commercial tabs.

Determine whether to add:

```text
Примечания
```

or future:

```text
Активность
```

with notes.

Keep symmetry with Customer 360 where business semantics match, but do not force symmetry where they differ.

---

# 35. ORDER / BOOKING UX

Orders and Bookings are high-priority operational entities.

Architecture should define:

```text
Notes list
Add note action
author
timestamp
edited state
visibility
```

and whether notes appear:

```text
inline on detail page
or
dedicated tab
```

---

# 36. PAYMENT / REFUND UX

Even if dedicated Payment/Refund detail routes do not yet exist, architecture must define where their notes are surfaced.

Potential locations:

```text
Customer 360 Payments
Customer 360 Refunds
Order detail financial section
future Payment/Refund detail pages
```

Do not overload table rows with full free-text notes.

Consider:

```text
note indicator/count
latest note preview
open details
```

only if justified.

---

# 37. TABLE UX

The user previously required operational tables to be usable and navigable.

Audit whether tables should display:

```text
Notes count
note icon
latest note indicator
```

Do NOT automatically add a full `Примечание` text column to every table.

Long free text can destroy table usability.

Provide a canonical table strategy.

---

# 38. SEARCH

Decide whether note text should be searchable.

Options:

```text
not in initial implementation
entity-local notes search
global operational search
```

Do not silently mix note full-text search into existing entity search unless explicitly justified.

If deferred, mark it as future capability.

---

# 39. SORT / FILTER

Determine whether notes need:

```text
sort by createdAt
sort by author
filter by author
filter by visibility
filter by category
```

Avoid unnecessary controls for v1.

At minimum chronological ordering must be deterministic.

---

# 40. PAGINATION

Notes can grow without bound.

Do not assume a permanent bounded-client exemption.

Define:

```text
initial page size
cursor vs offset pagination
ordering
load more / pagination UX
```

Use existing project conventions where appropriate.

---

# 41. API CONTRACT

Design conceptual endpoints.

Compare:

```text
GET    /api/v1/:entity/:id/notes
POST   /api/v1/:entity/:id/notes
PATCH  /api/v1/notes/:noteId
DELETE /api/v1/notes/:noteId
```

versus explicit domain endpoints:

```text
GET /customers/:id/notes
GET /orders/:id/notes
...
```

Choose based on security, NestJS architecture and domain clarity.

Do not implement yet.

---

# 42. READ CONTRACT

Define response shape conceptually.

Example:

```ts
{
  id,
  text,
  visibility,
  author: {
    id,
    displayName
  },
  createdAt,
  updatedAt,
  edited
}
```

Do not expose sensitive internal user data unnecessarily.

---

# 43. CREATE CONTRACT

Define required inputs.

At minimum evaluate:

```text
text
visibility
```

Parent entity must come from route/server context rather than trusting arbitrary client-supplied scope.

---

# 44. UPDATE CONTRACT

If edits are allowed:

```text
text
possibly visibility
```

Define optimistic concurrency if needed.

At minimum discuss lost-update risk.

---

# 45. DELETE CONTRACT

Define response/soft-delete behavior.

Deleted notes must not create broken counts or misleading history.

---

# 46. VALIDATION

Define:

```text
minimum length
maximum length
whitespace handling
empty note rejection
HTML handling
links
line breaks
Unicode
```

Safe default should treat note content as plain text unless project already has a sanitized rich-text system.

Do not introduce arbitrary HTML.

---

# 47. SECURITY

Audit:

```text
XSS
HTML injection
authorization bypass
IDOR
cross-tenant access
cross-workspace access
mass assignment
deleted entity references
```

Rendered notes must be safe.

---

# 48. PII / SENSITIVE DATA

Operational notes may contain personal or sensitive information.

Architecture must explicitly address:

```text
who can read
retention
exports
logs
analytics
search indexing
```

Do not duplicate note text into application logs unnecessarily.

---

# 49. AUDIT / COMPLIANCE

Determine which operations require immutable audit events:

```text
note created
note edited
note deleted
visibility changed
```

Audit event should include actor and timestamp.

Do not necessarily store full note text in audit logs if that creates unnecessary PII duplication; evaluate carefully.

---

# 50. CONCURRENCY

Consider:

```text
two operators add notes simultaneously
two users edit same note
note added while entity status changes
```

Adding separate notes should not conflict.

Editing the same note requires defined behavior.

---

# 51. NOTIFICATIONS

Determine whether note creation should trigger notifications.

Default recommendation to evaluate:

```text
NO automatic notifications in v1
```

unless mentions/assignments are introduced.

Do not silently turn notes into a messaging system.

---

# 52. COMMENTS / THREADS

Determine whether replies/threading are required.

Candidate:

```text
parentNoteId
```

But avoid introducing it unless there is a real operational need.

A flat chronological note stream may be sufficient for v1.

---

# 53. MENTIONS

Evaluate:

```text
@user
```

as future capability only unless already supported elsewhere.

Mentions imply:

```text
notifications
identity resolution
permissions
rendering
```

Do not include casually.

---

# 54. ATTACHMENTS

Evaluate whether notes need attachments.

If not required now:

```text
DEFER
```

Do not couple v1 notes to file-storage architecture without a requirement.

---

# 55. PINNING / IMPORTANT NOTES

Because operators may record important information, evaluate whether:

```text
pinned / important
```

is necessary.

Compare with simply showing latest notes chronologically.

Do not add priority taxonomy without evidence.

---

# 56. HISTORY / ACTIVITY TIMELINE FUTURE

Design notes so a future unified timeline can render:

```text
System Event
Operational Note
Status Change
Payment Event
Refund Event
Assignment
```

But do not implement a unified timeline in this round.

Avoid architecture that blocks this future capability.

---

# 57. DATA MIGRATION

If current entities already have note/comment fields, determine migration strategy.

Possible:

```text
keep canonical field
migrate to OperationalNote
map as legacy read-only
remove duplicate field later
```

Do not discard existing business information.

Provide explicit migration matrix.

---

# 58. REQUIRED EXISTING-FIELD MIGRATION MATRIX

| Entity | Existing Field | Current Data? | Canonical Meaning | Keep | Migrate | Deprecate | Reason |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

No existing note-like field may be ignored.

---

# 59. INDEXING

If shared notes entity is recommended, propose required indexes conceptually.

Examples:

```text
(entityType, entityId, createdAt)
(authorUserId, createdAt)
(workspaceId, entityType, entityId)
```

Only use fields actually chosen by final model.

---

# 60. RETENTION / DELETION OF PARENT

Define behavior when parent entity is:

```text
archived
soft-deleted
hard-deleted
```

Notes should not become unscoped orphan records.

---

# 61. PERFORMANCE

Estimate access patterns:

```text
load latest notes on detail
load notes tab
count notes in table
Customer 360 activity
Partner 360 activity
```

Avoid N+1 queries.

Do not preload unlimited note histories into every 360 detail response.

---

# 62. 360 BOUNDED PAYLOAD WARNING

Previous Shared Table Controls allowed bounded-client exemptions for current 360 collections.

Operational notes are different:

```text
notes are append-only/growing operational data
```

Do NOT automatically include unlimited notes in bounded 360 detail payloads.

Prefer independently pageable notes if the canonical design requires unbounded history.

---

# 63. UX EMPTY / LOADING / ERROR

Define distinct states:

```text
No notes yet
Loading notes
Failed to load notes
Permission denied
```

Never render API error as:

```text
"Примечаний нет"
```

---

# 64. UX ADD NOTE

Canonical interaction should evaluate:

```text
textarea
Add note button
Cancel
validation
saving state
success insertion
error retry
```

No modal unless it improves the actual workflow.

---

# 65. UX EDIT / DELETE

If allowed:

```text
... menu
Edit
Delete
```

Avoid cluttering every note with many visible buttons.

Permission-gated actions must also be server-authoritative.

---

# 66. UX AUTHOR / TIME

Each note should show enough provenance:

```text
Author
Created date/time
Edited marker where applicable
```

Do not confuse author role with note visibility.

---

# 67. UX ORDERING

Recommended default to evaluate:

```text
newest first
```

or:

```text
oldest first + composer at bottom
```

Choose one based on operational workflow and use consistently.

---

# 68. I18N

Architecture must plan RU/AZ/EN labels.

Candidate keys:

```text
notes.title
notes.add
notes.placeholder
notes.empty
notes.edit
notes.delete
notes.edited
notes.internal
notes.error.load
notes.error.save
```

Do not implement keys in this architecture-only round.

---

# 69. ACCESSIBILITY

Plan:

```text
proper textarea label
keyboard actions
focus after save
accessible menu actions
confirmation semantics
error announcement
```

---

# 70. MOBILE / RESPONSIVE

Notes must remain usable on narrow screens.

Avoid a table-only note UI.

Cards/timeline/list are more suitable for note content.

---

# 71. REQUIRED UX PLACEMENT MATRIX

| Entity | Create Form Note | Detail Notes | 360 Notes | Table Indicator | Dedicated Tab/Section | Decision |
|---|---|---|---|---|---|---|
| Customer | | | | | | |
| Partner | | | | | | |
| Service | | | | | | |
| Order | | | | | | |
| Request / Application | | | | | | |
| Booking | | | | | | |
| Payment | | | | | | |
| Refund | | | | | | |

No blank rows.

---

# 72. REQUIRED VISIBILITY MATRIX

| Actor / Workspace | INTERNAL | PARTNER_VISIBLE | CUSTOMER_VISIBLE | Notes |
|---|---|---|---|---|
| Platform internal user | | | | |
| Marketplace partner | | | | |
| Storefront partner | | | | |
| Customer | | | | |

If external visibility is deferred, state it explicitly.

---

# 73. REQUIRED DOMAIN SEMANTICS MATRIX

| Concept | User-entered? | Canonical State? | Editable? | Audit Required? | Example |
|---|---|---|---|---|---|
| Operational Note | | | | | |
| Status | | | | | |
| Business Date | | | | | |
| Reason | | | | | |
| Audit Event | | | | | |
| History/Activity | | | | | |

This matrix must eliminate semantic overlap.

---

# 74. REQUIRED DATA MODEL PROPOSAL

Provide the recommended conceptual schema in the report.

Example format only:

```prisma
model OperationalNote {
  id           String   @id @default(uuid())
  ...
}
```

This is architectural pseudocode.

Do NOT modify `schema.prisma` in this round.

Explain every field.

---

# 75. REQUIRED API MATRIX

| Operation | Endpoint Pattern | Permission | Parent Scope Check | Audit | Notes |
|---|---|---|---|---|---|
| List | | | | | |
| Create | | | | | |
| Update | | | | | |
| Delete | | | | | |

---

# 76. REQUIRED SECURITY MATRIX

| Threat | Mitigation | Server Authority | Test Required Later |
|---|---|---|---|
| IDOR | | | |
| Cross-tenant read | | | |
| Cross-tenant write | | | |
| XSS | | | |
| Mass assignment | | | |
| Unauthorized edit | | | |
| Unauthorized delete | | | |
| Deleted-parent orphan | | | |

---

# 77. REQUIRED AUDIT MATRIX

| Action | Audit Event? | Actor | Timestamp | Old Value? | New Value? | PII Duplication Policy |
|---|---|---|---|---|---|---|
| Create note | | | | | | |
| Edit note | | | | | | |
| Delete note | | | | | | |
| Change visibility | | | | | | |

---

# 78. REQUIRED IMPLEMENTATION PHASING

After architecture reconciliation, propose implementation phases.

Recommended shape to evaluate:

```text
Round 2A — Data model + migration + backend authority
Round 2B — API + RBAC + audit
Round 2C — Platform CRM/detail UX
Round 2D — Creation-form integration
Round 2E — Runtime/browser/security closure
```

But adapt to actual repository findings.

Do not implement these rounds now.

---

# 79. ACCEPTANCE CRITERIA

VERDICT A requires all of the following:

1. Existing note/comment/history/audit fields audited.
2. All relevant entities audited.
3. Entity Coverage Matrix complete.
4. Architecture Options Matrix complete.
5. One canonical architecture selected.
6. Note terminology defined.
7. Notes vs Audit Events separated.
8. Notes vs Status separated.
9. Notes vs Business Dates separated.
10. Notes vs Reason fields separated.
11. Payment pending-note semantics defined.
12. Refund pending-note semantics defined.
13. Canonical note fields defined.
14. Entity reference strategy defined.
15. Referential-integrity tradeoffs addressed.
16. Workspace/tenant authority defined.
17. Visibility model defined.
18. Safe default visibility defined.
19. Platform/Partner future reuse addressed.
20. RBAC strategy defined.
21. Role Matrix complete.
22. Edit semantics defined.
23. Delete semantics defined.
24. Revision/history strategy defined.
25. Author authority defined.
26. Timestamp semantics defined.
27. Create-form behavior defined.
28. Creation transaction behavior defined.
29. Customer 360 placement reconciled with existing History.
30. Partner 360 placement defined.
31. Order placement defined.
32. Booking placement defined.
33. Service placement defined.
34. Payment placement defined.
35. Refund placement defined.
36. Table note strategy defined.
37. Search scope decision defined.
38. Sort/filter scope decision defined.
39. Pagination strategy defined.
40. API pattern selected.
41. Read/Create/Update/Delete contracts defined.
42. Validation rules defined.
43. XSS/security addressed.
44. PII implications addressed.
45. Audit/compliance behavior defined.
46. Concurrency behavior defined.
47. Notification decision defined.
48. Threads decision defined.
49. Mentions decision defined.
50. Attachments decision defined.
51. Pinning/priority decision defined.
52. Future unified timeline compatibility addressed.
53. Existing-field migration matrix complete.
54. Index strategy defined.
55. Parent deletion behavior defined.
56. Performance/N+1 strategy addressed.
57. Unlimited notes not hidden inside bounded 360 assumptions.
58. Empty/loading/error UX defined.
59. Add/Edit/Delete UX defined.
60. Author/time UX defined.
61. Ordering defined.
62. I18n plan defined.
63. Accessibility addressed.
64. Responsive behavior addressed.
65. UX Placement Matrix complete.
66. Visibility Matrix complete.
67. Domain Semantics Matrix complete.
68. Conceptual data model supplied.
69. API Matrix complete.
70. Security Matrix complete.
71. Audit Matrix complete.
72. Implementation phasing proposed.
73. No production code changed.
74. No schema migration executed.
75. No Storefront Pro CRM implementation started.
76. No Marketplace Basic CRM implementation started.
77. No Partner Workspace sidebar implementation started.
78. Architecture report committed and pushed.
79. HEAD == origin/master.
80. Report has no unresolved P0 architecture contradictions.
81. Create-Form Coverage Matrix is complete.
82. Customer create flow note contract is explicitly resolved.
83. Partner create flow note contract is explicitly resolved.
84. Order create flow note contract is explicitly resolved.
85. Request/Application business concept and canonical model are explicitly resolved.
86. Request/Application create flow note contract is explicitly resolved where applicable.
87. Booking create flow note contract is explicitly resolved.
88. Payment create/initiation note contract is explicitly resolved.
89. Refund request create-flow note contract is explicitly resolved.
90. Service/Product create-flow note contract is explicitly resolved.
91. Every additional actual operational create flow discovered is classified.
92. Initial create-form note becomes first OperationalNote if shared note model is selected.
93. Duplicate entity `note` authority is forbidden unless separately justified.
94. Initial note author is server-authoritative.
95. Initial note timestamp is server-authoritative.
96. Initial note visibility defaults to INTERNAL.
97. Entity + initial-note transactional consistency strategy is selected.
98. Partial-success behavior is explicitly defined.
99. Duplicate-submit/retry behavior is explicitly defined.
100. Initial note never mutates canonical status/business dates implicitly.

---

# 80. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_STEP_3.5_PLATFORM_CRM_OPERATIONAL_NOTES_COMMENTS_ARCHITECTURE_RECONCILIATION_V2_REPORT.md
```

---

# 81. FINAL RESPONSE FORMAT

Return:

```text
VERDICT:

PRECONDITION:
Repository:
Branch:
Starting SHA:
ec2e65c preserved:

EXISTING SYSTEM AUDIT:
Existing note-like fields:
Existing comment concepts:
Existing history concepts:
Existing audit/event infrastructure:
Conflicts/duplicates:

ENTITY COVERAGE MATRIX:
...

ARCHITECTURE OPTIONS MATRIX:
...

CANONICAL RECOMMENDATION:
Model:
Why:
Rejected alternatives:

DOMAIN SEMANTICS MATRIX:
...

CANONICAL TERMINOLOGY:
Operational Note:
Audit Event:
History/Activity:
Reason:
Status:
Business Date:

DATA MODEL:
...

ENTITY REFERENCE STRATEGY:
...

WORKSPACE/TENANT AUTHORITY:
...

VISIBILITY MODEL:
...

VISIBILITY MATRIX:
...

RBAC STRATEGY:
...

ROLE MATRIX:
...

EDIT SEMANTICS:
...

DELETE SEMANTICS:
...

AUDIT/REVISION STRATEGY:
...

CREATE-FORM CONTRACT:
...

CREATE-FORM COVERAGE MATRIX:
...

REQUEST / APPLICATION AUTHORITY:
Canonical model:
Create flow:
Note placement:
Decision:

INITIAL NOTE TRANSACTIONALITY:
...

INITIAL NOTE AUTHOR / TIME / VISIBILITY:
...

PAYMENT/REFUND SEMANTICS:
...

UX PLACEMENT MATRIX:
...

CUSTOMER 360 / HISTORY RECONCILIATION:
...

PARTNER 360:
...

ORDER / BOOKING:
...

SERVICE:
...

PAYMENT / REFUND:
...

TABLE UX:
...

SEARCH / SORT / FILTER / PAGINATION:
...

API CONTRACT:
...

API MATRIX:
...

VALIDATION:
...

SECURITY MATRIX:
...

PII / RETENTION:
...

AUDIT MATRIX:
...

CONCURRENCY:
...

NOTIFICATIONS / THREADS / MENTIONS / ATTACHMENTS:
...

FUTURE ACTIVITY TIMELINE:
...

EXISTING-FIELD MIGRATION MATRIX:
...

INDEXING / PERFORMANCE:
...

EMPTY / LOADING / ERROR UX:
...

I18N / ACCESSIBILITY / RESPONSIVE:
...

IMPLEMENTATION PHASING:
...

PRODUCTION CODE CHANGED:
SCHEMA CHANGED:
MIGRATION EXECUTED:
UNRELATED FILES CHANGED:

Report:
Commit:
HEAD:
origin/master:
HEAD == origin/master:

REMAINING FINDINGS:
P0:
P1:
P2:

READY FOR IMPLEMENTATION:
Next canonical round:
```

---

# 82. VERDICT

Success only:

```text
VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM /
OPERATIONAL NOTES + COMMENTS ARCHITECTURE /
DOMAIN MODEL + ENTITY COVERAGE + CREATE-FORM NOTE CONTRACT + VISIBILITY + RBAC + AUDIT + UX CONTRACT /
FULLY RECONCILED — READY FOR IMPLEMENTATION
```

Failure:

```text
VERDICT B — OPERATIONAL NOTES / COMMENTS ARCHITECTURE RECONCILIATION INCOMPLETE
```

No conditional VERDICT A.

---

# 83. STOP

After producing the architecture report:

```text
STOP
```

Do NOT implement production code.

Do NOT modify Prisma schema.

Do NOT create migrations.

Do NOT start Storefront Pro CRM.

Do NOT start Marketplace Basic CRM finalization.

Do NOT start Partner Workspace sidebar implementation.

Wait for explicit approval of the architecture before implementation.
