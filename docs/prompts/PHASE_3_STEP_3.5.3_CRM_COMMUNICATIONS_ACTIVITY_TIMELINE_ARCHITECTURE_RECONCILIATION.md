# PHASE 3 — STEP 3.5.3 — PLATFORM CRM
## CRM COMMUNICATIONS & ACTIVITY TIMELINE
## ROUND 1 — ARCHITECTURE + CURRENT-STATE + DATA-SOURCE + RBAC / TENANT AUTHORITY RECONCILIATION

---

# 1. PRECONDITION

The following Platform CRM stages are accepted and MUST be preserved:

```text
Shared Table Controls — FINAL CLOSED
SHA: ec2e65c

Operational Notes Architecture V2
SHA: 240fbe8

Operational Notes Round 2A
Data Model + Migration + Backend Authority
SHA: e0fe7bb

Operational Notes Round 2A.1
Regression Evidence Closure
SHA: a13e280

Operational Notes Round 2B
Notes API + RBAC + Audit/Edit/Delete
SHA: 8b9999f

Operational Notes Round 2C
Platform Detail / Customer 360 / Partner 360 Notes UI
SHA: 64c6563

Operational Notes Round 2D
Create-Form Initial Note Integration
SHA: 88af625

Operational Notes Round 2D.1
Missing Create-Flow Coverage Closure
SHA: b6b0365
```

Current accepted status:

```text
PHASE 3 STEP 3.5 — PLATFORM CRM
OPERATIONAL NOTES IMPLEMENTATION — FULLY CLOSED ✅
```

Starting SHA:

```text
b6b0365
```

or an explicitly explained descendant.

---

# 2. ROUND PURPOSE

Reconcile the architecture for a canonical CRM Communications & Activity Timeline before any production implementation.

This round is ARCHITECTURE / CURRENT-STATE / DATA-SOURCE / SECURITY reconciliation only.

Required outcome:

```text
VERDICT A — READY FOR IMPLEMENTATION
```

or:

```text
VERDICT B — ARCHITECTURE RECONCILIATION INCOMPLETE
```

Do NOT modify production code in this round.

Do NOT create migrations.

Do NOT implement Timeline UI.

Do NOT implement new communication channels.

---

# 3. BUSINESS GOAL

Customer 360 and Partner 360 must evolve from separate static tabs into a coherent chronological operational history without destroying the authority of underlying business domains.

The future timeline may need to show, where applicable:

```text
Operational Notes
Orders
Bookings
Payments
Refunds
Messages / Chat
Status changes
Partner/customer relationship events
Service interactions
Support/request events
Assignments
Selected audit/business events
```

Critical rule:

```text
ACTIVITY TIMELINE IS A READ MODEL / PRESENTATION MODEL.
```

It MUST NOT become the canonical source of truth for:

```text
Order
Booking
Payment
Refund
OperationalNote
Message
Chat
Audit Event
Status
Business Date
```

The original domain entities remain authoritative.

---

# 4. ROUND 1 EXECUTION RULE

Before proposing architecture:

1. Audit actual database/schema models.
2. Audit messaging/chat modules.
3. Audit notifications, inbox, email integrations if they exist.
4. Audit existing Customer 360 History.
5. Audit existing Partner 360.
6. Audit Operational Notes.
7. Audit EventBus / audit/event infrastructure.
8. Audit Orders / Bookings / Payments / Refunds events.
9. Audit BuyerRequest / PartnerApplication history.
10. Audit tenant/workspace/partner scoping.
11. Audit permissions/RBAC.
12. Audit any existing timeline/history/activity components.
13. Produce matrices.
14. STOP before implementation.

Do not infer architecture from filenames alone.

---

# 5. CURRENT-STATE DISCOVERY — MANDATORY

Search for actual models/modules/concepts such as:

```text
Message
Chat
ChatRoom
ChatMember
Conversation
Thread
Notification
Email
SMS
WhatsApp
Inbox
Activity
Timeline
History
Audit
Event
EventBus
OrderEvent
BookingEvent
PaymentEvent
RefundEvent
OperationalNote
BuyerRequest
PartnerApplication
Support
Ticket
Comment
```

For every discovered concept determine:

```text
canonical model
write authority
read authority
scope
retention
existing UI
relationship to Customer/Partner
```

Do not silently merge unrelated concepts.

---

# 6. REQUIRED CURRENT-STATE MATRIX

Fill completely:

| Domain / Source | Exists? | Canonical Model/Module | Write Authority | Read Authority | Customer Link | Partner Link | Current UI | Timeline Candidate? | Decision |
|---|---:|---|---|---|---|---|---|---:|---|
| Operational Notes | | | | | | | | | |
| Orders | | | | | | | | | |
| Bookings | | | | | | | | | |
| Payments | | | | | | | | | |
| Refunds | | | | | | | | | |
| Messages / Chat | | | | | | | | | |
| Notifications | | | | | | | | | |
| Audit Events | | | | | | | | | |
| Customer History | | | | | | | | | |
| BuyerRequest | | | | | | | | | |
| PartnerApplication | | | | | | | | | |

Add additional actual sources discovered.

No blank rows.

---

# 7. TERMINOLOGY RECONCILIATION

Define exact semantics for:

```text
Communication
Message
Conversation
Chat
Notification
Operational Note
Audit Event
Business Event
Activity
Timeline
History
```

Recommended distinction to evaluate:

```text
Communication
= explicit exchange between actors/channels

Operational Note
= internal human-entered context

Business Event
= meaningful domain event produced by canonical entity transitions

Audit Event
= security/accountability record of who changed what

Activity Timeline
= chronological projection aggregating selected source events
```

Do not treat these as synonyms.

---

# 8. ACTIVITY TIMELINE AUTHORITY

The timeline MUST be derived from canonical sources.

Possible architecture options to compare:

```text
A. Query-time aggregation
B. Dedicated denormalized ActivityEvent read model
C. Event-driven projection
D. Hybrid
```

For each evaluate:

```text
consistency
latency
rebuildability
auditability
pagination
filtering
query complexity
multi-source ordering
tenant isolation
backfill
failure recovery
operational cost
```

---

# 9. REQUIRED ARCHITECTURE OPTIONS MATRIX

| Criterion | Query-time Aggregation | Activity Read Model | Event-driven Projection | Hybrid |
|---|---|---|---|---|
| Canonical-source integrity | | | | |
| Query simplicity | | | | |
| Performance | | | | |
| Pagination | | | | |
| Cross-source ordering | | | | |
| Rebuildability | | | | |
| Backfill | | | | |
| Event loss recovery | | | | |
| Tenant isolation | | | | |
| RBAC filtering | | | | |
| Historical accuracy | | | | |
| Complexity | | | | |
| Recommendation | | | | |

Choose one canonical recommendation.

---

# 10. ACTIVITY ITEM CONTRACT

Design a canonical presentation/read model.

Conceptual shape:

```ts
ActivityItem {
  id
  activityType
  sourceType
  sourceId
  subjectType
  subjectId
  customerId?
  partnerId?
  occurredAt
  actor?
  title
  summary
  metadata?
  visibility
  deepLink?
}
```

This is conceptual only.

Do NOT modify schema in this round.

Explain which fields are canonical and which are derived/display-only.

---

# 11. SOURCE TYPE

Use strict source types, not arbitrary strings.

Candidate examples:

```text
OPERATIONAL_NOTE
ORDER
BOOKING
PAYMENT
REFUND
MESSAGE
CHAT
AUDIT_EVENT
BUYER_REQUEST
PARTNER_APPLICATION
```

Do not invent types for sources that do not exist.

---

# 12. ACTIVITY TYPE

Activity type is not necessarily the same as source type.

Example:

```text
sourceType = ORDER
activityType = ORDER_CREATED

sourceType = BOOKING
activityType = BOOKING_CONFIRMED

sourceType = PAYMENT
activityType = PAYMENT_CAPTURED

sourceType = OPERATIONAL_NOTE
activityType = NOTE_CREATED
```

Define whether activity types are:

```text
event names
coarse categories
or both
```

Avoid an unbounded string taxonomy.

---

# 13. OCCURRED AT AUTHORITY

Each source event must use the correct canonical business timestamp.

Examples to reconcile:

```text
Operational Note created → note.createdAt
Order created → order.createdAt
Order cancelled → cancelledAt
Booking created → booking.createdAt
Booking service event → canonical service date only if semantically an event
Payment captured → paidAt
Refund processed → processedAt
Message sent → message.createdAt/sentAt
Audit change → audit timestamp
```

Do not use `createdAt` as a fallback for every business event.

---

# 14. MULTI-EVENT SOURCE SEMANTICS

A single entity may generate multiple timeline items.

Example Order:

```text
ORDER_CREATED
ORDER_STATUS_CHANGED
ORDER_CANCELLED
```

Do not reduce an entity to a single current-state card if the timeline is intended to show history.

But do not fabricate historical transitions if no canonical event/history exists.

---

# 15. EXISTING CUSTOMER 360 HISTORY

Audit the current Customer 360 History tab in detail.

Determine:

```text
data source
event types
completeness
ordering
pagination
RBAC
whether it is canonical or derived
```

Required decision:

```text
KEEP AS-IS
MIGRATE INTO ACTIVITY TIMELINE
MERGE
DEPRECATE
RENAME
```

Do not create two competing history views.

---

# 16. PARTNER 360 HISTORY

Partner 360 may not currently have a History tab.

Determine whether future Activity Timeline should exist for both:

```text
Customer 360
Partner 360
```

If yes, define what events differ by subject.

Do not force identical source sets if business semantics differ.

---

# 17. CUSTOMER SUBJECT MODEL

Define how timeline items relate to Customer.

Possible relationships:

```text
direct customerId
Order.customerId
Booking.customerId
Payment via Order/Customer
Refund via Payment/Order/Customer
Message participant
OperationalNote parent CUSTOMER
OperationalNote on Customer-related Order/Booking/etc.
```

Important decision:

Should Customer 360 show only events directly attached to Customer?

or:

Should it include all commercial events involving that Customer?

Define exact inclusion semantics.

---

# 18. PARTNER SUBJECT MODEL

Similarly define Partner timeline inclusion.

Potential sources:

```text
Partner entity
Products/Services
Orders
Bookings
Payments/Refunds
Customers
Messages
Operational Notes
Storefront-related events
PartnerApplication
```

Define exactly what belongs in Partner 360 timeline.

Avoid accidental cross-partner data exposure.

---

# 19. OPERATIONAL NOTES IN TIMELINE

Operational Notes are now fully implemented.

Decide whether timeline includes:

```text
note created
note edited
note deleted
```

or only:

```text
note created
```

Important:

`OperationalNote` remains its own canonical data source.

Timeline item must link to the note/context but must not duplicate note authority.

If deleted note exists, determine whether ordinary timeline readers see:

```text
nothing
tombstone
audit-only event
```

according to accepted audit/lifecycle semantics.

---

# 20. NOTES TAB VS ACTIVITY TAB

Operational Notes already have dedicated UI.

Define future relationship:

```text
Notes tab
= note-focused CRUD workspace

Activity tab
= cross-domain chronological read model
```

Recommended direction to evaluate:

```text
keep Notes tab for CRUD
add Activity tab for aggregate history
```

Do not remove note management capabilities merely because notes appear in Activity.

---

# 21. MESSAGES / CHAT AUDIT

Audit existing messaging architecture thoroughly.

Determine:

```text
Message model
ChatRoom model
ChatMember model
sender
recipient/participants
customer linkage
partner linkage
order/booking linkage
workspace scope
read status
attachments
channel
timestamps
```

Do not assume every message is a CRM communication.

---

# 22. COMMUNICATION SCOPE

Define which communication types belong in CRM timeline.

Possible:

```text
platform ↔ customer
platform ↔ partner
partner ↔ customer
internal employee ↔ employee
system notification
```

Not all may be appropriate.

Provide explicit inclusion/exclusion rules.

---

# 23. CHANNEL MODEL

Audit whether channels exist:

```text
IN_APP
CHAT
EMAIL
SMS
WHATSAPP
PHONE
SYSTEM
```

Do NOT invent unsupported channels.

If only in-app chat exists today, architecture may plan extensibility but must distinguish:

```text
CURRENT
FUTURE
```

---

# 24. EMAIL / SMS / WHATSAPP

If no canonical integration exists, do not imply timeline can show real external communications.

Architecture may reserve future channel values only if justified.

Report:

```text
current supported channels
future candidates
not implemented
```

No fake omnichannel claim.

---

# 25. COMMUNICATION WRITE MODEL

Determine whether Round 3.5.3 includes only timeline/read integration or also a future communications composer.

Compare:

```text
Timeline-only
Timeline + messaging composer
Separate Communications module
```

Do not conflate them.

If existing chat already supports sending, decide whether Customer/Partner 360 may deep-link to chat rather than reimplement messaging.

---

# 26. DEEP LINKS

Each activity should preferably navigate to its canonical source detail.

Examples:

```text
Order activity → /app/orders/:id
Booking activity → /app/bookings/:id
Product activity → /app/catalog/:id
Customer Note → Customer 360 Notes
Partner Note → Partner 360 Notes
Message → actual conversation route
```

Do not create dead links.

If source has no detail route, define non-clickable behavior.

---

# 27. VISIBILITY

Timeline must not reveal data beyond source permissions.

Core rule:

```text
timeline visibility <= source visibility
```

An activity item must never make a hidden source discoverable.

Examples:

```text
INTERNAL OperationalNote
→ only actors permitted to read that note

restricted Payment
→ only actors with finance/source access

restricted Message
→ only authorized participants/workspace roles
```

---

# 28. RBAC MODEL

Determine whether timeline requires a top-level permission such as:

```text
crm.activity.read
```

in addition to source permissions.

Possible model:

```text
Page gate:
crm.activity.read

Per-item gate:
source-specific read permission
```

Evaluate against existing security architecture.

Do not use only frontend filtering.

---

# 29. REQUIRED RBAC MATRIX

At minimum audit:

```text
ADMIN
DIRECTOR
ANALYST
MARKETER
FINANCE
MODERATOR
SALES_MANAGER
OPERATOR
PARTNER
BUYER
```

Complete:

| Role | Activity Page/Tab | Notes Items | Order/Booking Items | Finance Items | Message Items | Audit Items | Scope |
|---|---:|---:|---:|---:|---:|---:|---|
| ADMIN | | | | | | | |
| DIRECTOR | | | | | | | |
| ANALYST | | | | | | | |
| MARKETER | | | | | | | |
| FINANCE | | | | | | | |
| MODERATOR | | | | | | | |
| SALES_MANAGER | | | | | | | |
| OPERATOR | | | | | | | |
| PARTNER | | | | | | | |
| BUYER | | | | | | | |

No blank rows.

Use N/A with exact rationale.

---

# 30. TENANT / WORKSPACE AUTHORITY

Timeline query must preserve:

```text
workspace
tenant
partner
customer ownership
role
permission
```

A Customer timeline cannot leak another customer's events.

A Partner timeline cannot leak another partner's events.

Cross-tenant activity aggregation is forbidden unless Platform authority explicitly allows it.

---

# 31. QUERY AUTHORIZATION ORDER

Conceptual:

```text
resolve subject
→ verify actor can access subject
→ determine candidate sources
→ apply source-specific authorization
→ aggregate
→ sort
→ paginate
```

Do not:

```text
aggregate everything
→ hide unauthorized cards in frontend
```

---

# 32. PAGINATION

Timeline is unbounded.

Must be independently pageable.

Evaluate:

```text
cursor pagination
offset pagination
```

For multi-source chronological feeds, cursor-based pagination may be preferable, but do not choose it without repository/architecture analysis.

Define:

```text
stable ordering
tie-breaker
page size
max page size
back/forward behavior
```

---

# 33. ORDERING

Canonical ordering should normally be:

```text
occurredAt DESC
stable tie-breaker
```

For aggregated sources with identical timestamps, define deterministic tie-breaker.

Do not rely on timestamp uniqueness.

---

# 34. FILTERS

Audit useful timeline filters.

Possible:

```text
All
Notes
Orders
Bookings
Payments
Refunds
Messages
System/Audit
date range
actor
```

Do not overcomplicate v1.

Provide minimum recommended filter set.

Filters must be server-side for unbounded timelines.

---

# 35. SEARCH

Decide whether timeline needs text search in v1.

Possible sources have heterogeneous searchable fields.

Options:

```text
No search in v1
Search titles/summaries only
Source-aware search
```

Do not silently full-text index OperationalNote/Message content without security/PII consideration.

---

# 36. URL STATE

If Activity tab is implemented later, state should follow Shared Table Controls principles where applicable:

```text
tab
activityType/filter
date range
page/cursor
```

Back/Forward/Refresh should reproduce the view.

Do not conflict with existing Customer/Partner 360 tab URL state.

---

# 37. EMPTY / ERROR / FORBIDDEN

Define distinct states:

```text
No activity
No activity matching filters
Loading
Load error
Forbidden
Subject not found
```

Never convert authorization or source failure into fake empty timeline.

---

# 38. PARTIAL SOURCE FAILURE

Critical design question:

If timeline aggregates multiple sources and one source fails:

```text
fail entire timeline?
show partial timeline with warning?
retry failed source?
```

Choose a canonical policy.

Do not silently omit failed source data.

If using a materialized read model, define how projection lag/failure is surfaced/monitored.

---

# 39. EVENT DELIVERY / PROJECTION CONSISTENCY

If event-driven projection is recommended, define:

```text
at-least-once handling
deduplication
idempotency
ordering
replay
backfill
dead-letter/retry
reconciliation job
projection versioning
```

Do not recommend an event-driven read model without failure semantics.

---

# 40. EVENT IDENTITY

If a read model exists, each projected activity needs stable source identity.

Conceptual:

```text
sourceType
sourceId
eventType
sourceEventId?
```

Define deduplication key.

Do not use random projection IDs as the only identity for replay.

---

# 41. BACKFILL

Existing data already contains:

```text
customers
partners
orders
bookings
payments
refunds
notes
messages
```

If a new Activity projection/table is chosen, define how historical data is backfilled.

Questions:

```text
Which historical transitions are reconstructable?
Which are not?
Can only current-state events be generated?
How are timestamps chosen?
How are duplicates prevented?
```

No fake historical precision.

---

# 42. CURRENT STATE VS HISTORICAL EVENT

A row existing today does not prove every historical transition.

Example:

```text
Order.status = CLOSED
```

does not prove exact timestamp of every prior status.

Do not fabricate status history from current row state.

Only emit timeline history that canonical data supports.

---

# 43. AUDIT EVENT USAGE

Audit events may contain security-sensitive information.

Decide whether ordinary CRM Activity shows:

```text
all audit events
selected business-safe audit events
no raw audit events
```

Do not expose low-level security/audit metadata to roles that should not see it.

A dedicated audit log can remain separate.

---

# 44. PAYMENT / REFUND PRIVACY

Finance events may include:

```text
amount
payment method
provider
refund reason
```

Define field-level projection for timeline.

Do not expose unnecessary financial details to non-finance roles.

Use source-specific DTO projection.

---

# 45. MESSAGE PRIVACY

Messages may be private to conversation participants or specific roles.

Timeline inclusion must honor conversation membership/access.

Do not expose message body simply because Customer/Partner matches the subject.

Consider whether timeline item shows:

```text
message body
preview
metadata only
```

based on privacy.

---

# 46. PII

Timeline aggregates multiple PII-rich sources.

Address:

```text
note text
message text
emails
phone numbers
customer names
payment metadata
refund reasons
```

Minimize duplication.

If using denormalized read model, decide whether to copy text or store references and derive preview.

---

# 47. RETENTION

Activity read model must not extend retention beyond source policy unintentionally.

If source is deleted/soft-deleted:

```text
what happens to activity?
```

Define per source.

Do not retain sensitive message/note content indefinitely in duplicated timeline rows without policy.

---

# 48. DELETION / TOMBSTONES

For sources such as Operational Notes:

```text
soft-deleted note
```

may leave audit evidence but ordinary timeline may need to hide content.

Define:

```text
remove item
show "note deleted"
retain metadata only
```

based on accepted lifecycle/security.

---

# 49. EDITS

For edited notes/messages, decide whether timeline shows:

```text
single current item with edited marker
separate edit event
both
```

Do not duplicate confusing activity unless justified.

---

# 50. UI ARCHITECTURE

Do not implement now, but define target UX.

Possible Customer 360:

```text
Overview
Orders
Bookings
Payments
Partners
Refunds
History/Activity
Notes
```

Decide whether existing `History` becomes:

```text
Activity
```

or remains separate.

Possible Partner 360:

```text
Overview
Services
Orders
Bookings
Customers
Storefront
Activity
Notes
```

Provide exact recommendation.

---

# 51. ACTIVITY CARD

Conceptual card/list item should show:

```text
icon/category
title
summary
occurredAt
actor if meaningful
source label/code
deep link
```

Do not create a giant polymorphic card with every possible field.

Use source-specific lightweight rendering.

---

# 52. GROUPING

Evaluate whether to group events by:

```text
day
source
conversation
```

Default chronological feed may be enough.

Do not introduce grouping if it harms pagination or clarity.

---

# 53. REAL-TIME UPDATE

Decide whether v1 timeline needs:

```text
manual refresh
polling
WebSocket/SSE
```

Do not add real-time infrastructure unless existing messaging/event architecture already supports it and business value justifies it.

---

# 54. PERFORMANCE

Estimate source volumes for:

```text
Customer timeline
Partner timeline
```

Partner timeline can be much larger.

Audit index/query needs.

If query-time aggregation is chosen, prove it can paginate efficiently across sources.

If projection is chosen, define index strategy conceptually.

---

# 55. N+1

Timeline rendering must avoid fetching source details one-by-one.

If deep-link title/summary is needed, design projections/joins to avoid N+1.

---

# 56. REQUIRED SOURCE SEMANTICS MATRIX

| Source | Timeline Events | Timestamp Authority | Customer Inclusion | Partner Inclusion | Deep Link | Sensitive Fields | Permission |
|---|---|---|---|---|---|---|---|
| OperationalNote | | | | | | | |
| Order | | | | | | | |
| Booking | | | | | | | |
| Payment | | | | | | | |
| Refund | | | | | | | |
| Message/Chat | | | | | | | |
| Audit | | | | | | | |
| BuyerRequest | | | | | | | |
| PartnerApplication | | | | | | | |

No blank rows for sources that exist.

---

# 57. REQUIRED TIMESTAMP MATRIX

| Event | Canonical Timestamp | Source Field | Fallback Allowed? | Reason |
|---|---|---|---:|---|
| Note created | | | | |
| Order created | | | | |
| Order cancelled | | | | |
| Booking created | | | | |
| Payment captured | | | | |
| Refund processed | | | | |
| Message sent | | | | |
| Audit event | | | | |

Add actual events discovered.

No semantic timestamp substitution.

---

# 58. REQUIRED SUBJECT-INCLUSION MATRIX

| Source/Event | Customer 360 | Partner 360 | Direct Link Rule | Indirect Link Rule | Scope Risk |
|---|---:|---:|---|---|---|
| Customer Note | | | | | |
| Partner Note | | | | | |
| Order | | | | | |
| Booking | | | | | |
| Payment | | | | | |
| Refund | | | | | |
| Message | | | | | |
| BuyerRequest | | | | | |
| PartnerApplication | | | | | |

---

# 59. REQUIRED VISIBILITY MATRIX

| Source | ADMIN | DIRECTOR | SALES_MANAGER | OPERATOR | FINANCE | ANALYST | MARKETER | MODERATOR | PARTNER | BUYER |
|---|---|---|---|---|---|---|---|---|---|---|
| Notes | | | | | | | | | | |
| Orders | | | | | | | | | | |
| Bookings | | | | | | | | | | |
| Payments | | | | | | | | | | |
| Refunds | | | | | | | | | | |
| Messages | | | | | | | | | | |
| Audit-safe events | | | | | | | | | | |

Use actual role permissions, not assumptions.

---

# 60. REQUIRED DATA MODEL PROPOSAL

Provide architectural pseudocode for the selected approach.

If projection/read model:

```prisma
model CrmActivity {
  ...
}
```

If query-time aggregation:

provide service/query contracts instead.

Do NOT modify schema.

Explain:

```text
source identity
subject identity
occurredAt
visibility/scope
metadata
indexes
rebuildability
```

---

# 61. REQUIRED API CONTRACT

Design conceptual API:

```text
GET /customers/:id/activity
GET /partners/:id/activity
```

or canonical alternative.

Query options may include:

```text
type
dateFrom
dateTo
cursor/page
pageSize
```

Do not implement.

Define response DTO conceptually.

---

# 62. API RESPONSE SHAPE

Conceptual:

```ts
{
  items: ActivityItem[],
  pagination: ...
}
```

For each item:

```text
type
title
summary
occurredAt
actor?
source
deepLink?
```

Avoid returning raw polymorphic source objects.

---

# 63. SOURCE-SPECIFIC PROJECTION

Define how each source maps to UI-safe ActivityItem.

Examples:

```text
Payment:
title = "Платёж получен"
summary = amount/currency if permitted
occurredAt = paidAt
deepLink = canonical source/context
```

```text
OperationalNote:
title = "Добавлено примечание"
summary = safe text preview if role may read note
occurredAt = createdAt
```

No field leakage.

---

# 64. ERROR CONTRACT

Define:

```text
400 invalid filter
401 unauthenticated
403 forbidden
404 subject not found
200 empty
5xx source/projection failure
```

`403 != 200 []`.

`source failure != no activity`.

---

# 65. SECURITY THREATS

Audit:

```text
IDOR
cross-tenant leakage
cross-partner leakage
message membership bypass
finance data leakage
note visibility leakage
audit metadata leakage
projection stale permissions
source deletion inconsistency
cursor tampering
```

---

# 66. REQUIRED SECURITY MATRIX

| Threat | Mitigation | Server Authority | Test Required Later |
|---|---|---|---|
| Customer IDOR | | | |
| Partner IDOR | | | |
| Cross-tenant aggregation | | | |
| Note leakage | | | |
| Message leakage | | | |
| Finance leakage | | | |
| Audit leakage | | | |
| Cursor tampering | | | |
| Deleted-source leakage | | | |

---

# 67. PROJECTION PERMISSION STRATEGY

If using a denormalized Activity read model, decide whether access is:

```text
pre-filtered at projection time
filtered at query time
both
```

Important:

Permissions can change after projection.

Therefore do not permanently bake actor-specific visibility into a shared activity row unless architecture can handle permission changes safely.

Prefer source/scope metadata + query-time authorization where appropriate.

---

# 68. EVENTUAL CONSISTENCY

If projection is asynchronous, define acceptable lag.

Do not claim strong consistency.

Report:

```text
expected lag
UI behavior
reconciliation
monitoring
```

If business requires immediate note/message visibility, account for it.

---

# 69. REBUILD

Any projection architecture must be rebuildable.

Define:

```text
truncate/rebuild strategy
versioning
backfill order
dedupe
validation
```

Do not make timeline correctness depend on unreplayable ephemeral events only.

---

# 70. OBSERVABILITY

Architecture should define future metrics/logs for:

```text
projection lag
failed events
replay count
duplicate suppression
query latency
source failure
authorization denial
```

Do not implement in this round.

---

# 71. CURRENT VS FUTURE CHANNELS MATRIX

| Channel | Exists Today? | Canonical Source | Timeline v1? | Future? | Notes |
|---|---:|---|---:|---:|---|
| In-app chat | | | | | |
| Email | | | | | |
| SMS | | | | | |
| WhatsApp | | | | | |
| Phone log | | | | | |
| System notifications | | | | | |

No unsupported channel may be described as implemented.

---

# 72. IMPLEMENTATION PHASING

After reconciliation, propose a minimal implementation sequence.

Recommended shape to evaluate:

```text
Round 2A — Activity read-model/backend source adapters
Round 2B — Customer 360 Activity UI
Round 2C — Partner 360 Activity UI
Round 2D — Communications integration / deep links
Round 2E — Runtime/security/backfill closure
```

Adapt to actual architecture.

Do not implement these rounds now.

---

# 73. PRODUCTION CHANGE RULE

This round is documentation/architecture only.

Required:

```text
Production code changed: NO
Schema changed: NO
Migration created: NO
Frontend implementation: NO
Backend implementation: NO
```

Only architecture/report files may change.

---

# 74. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_STEP_3.5.3_CRM_COMMUNICATIONS_ACTIVITY_TIMELINE_ARCHITECTURE_RECONCILIATION_REPORT.md
```

---

# 75. ACCEPTANCE CRITERIA

VERDICT A requires ALL:

1. Starting SHA verified.
2. `b6b0365` preserved.
3. Existing messaging/chat models audited.
4. Notifications audited.
5. Operational Notes audited.
6. Orders audited.
7. Bookings audited.
8. Payments audited.
9. Refunds audited.
10. BuyerRequest audited.
11. PartnerApplication audited.
12. Existing Customer History audited.
13. Partner 360 history gap audited.
14. Audit/EventBus infrastructure audited.
15. Current-State Matrix complete.
16. Communication/Message/Timeline/History terminology defined.
17. Timeline declared read/presentation model, not source of truth.
18. Architecture Options Matrix complete.
19. One canonical architecture selected.
20. ActivityItem contract defined.
21. Source type strategy defined.
22. Activity type strategy defined.
23. Canonical timestamp authority defined per event.
24. No generic createdAt fallback accepted.
25. Multi-event source semantics defined.
26. Customer History migration/merge decision defined.
27. Customer subject inclusion semantics defined.
28. Partner subject inclusion semantics defined.
29. Operational Notes inclusion semantics defined.
30. Notes tab vs Activity tab relationship defined.
31. Message/chat scope defined.
32. Current communication channels identified.
33. Unsupported omnichannel claims avoided.
34. Communication write/composer scope decided.
35. Deep-link strategy defined.
36. Visibility <= source visibility invariant defined.
37. RBAC model defined.
38. RBAC Matrix complete.
39. Tenant/workspace authority defined.
40. Query authorization order defined.
41. Pagination strategy defined.
42. Stable ordering/tie-breaker defined.
43. Filter scope defined.
44. Search decision defined.
45. URL-state strategy defined.
46. Empty/error/forbidden states defined.
47. Partial-source failure policy defined.
48. Event/projection consistency model defined if applicable.
49. Event identity/dedupe defined if applicable.
50. Backfill strategy defined if applicable.
51. No fake historical transitions.
52. Audit-event exposure policy defined.
53. Finance privacy policy defined.
54. Message privacy policy defined.
55. PII duplication addressed.
56. Retention addressed.
57. Deleted-source/tombstone behavior defined.
58. Edited-source behavior defined.
59. Customer 360 target UX defined.
60. Partner 360 target UX defined.
61. Activity card contract defined.
62. Grouping decision defined.
63. Real-time decision defined.
64. Performance considerations addressed.
65. N+1 prevention addressed.
66. Source Semantics Matrix complete.
67. Timestamp Matrix complete.
68. Subject-Inclusion Matrix complete.
69. Visibility Matrix complete.
70. Data model/service proposal supplied.
71. API contract supplied.
72. API response shape supplied.
73. Source-specific projection examples supplied.
74. Error contract defined.
75. Security threats audited.
76. Security Matrix complete.
77. Projection permission strategy defined.
78. Eventual consistency defined if applicable.
79. Rebuild strategy defined if applicable.
80. Observability plan defined.
81. Current vs Future Channels Matrix complete.
82. Implementation phasing proposed.
83. Production code changed = NO.
84. Schema changed = NO.
85. Migration created = NO.
86. Frontend implementation = NO.
87. Backend implementation = NO.
88. Report created.
89. Commit created/pushed.
90. HEAD == origin/master.
91. No unresolved P0 architecture contradiction remains.

---

# 76. FINAL RESPONSE FORMAT

Return:

```text
VERDICT:

PRECONDITION
Repository:
Branch:
Starting SHA:
b6b0365 preserved:

CURRENT-STATE MATRIX
...

DISCOVERED COMMUNICATION MODELS
Message:
ChatRoom:
ChatMember:
Notifications:
Other:

EXISTING CUSTOMER HISTORY
Source:
Coverage:
Limitations:
Decision:

PARTNER HISTORY CURRENT STATE
...

CANONICAL TERMINOLOGY
Communication:
Message:
Operational Note:
Business Event:
Audit Event:
Activity:
Timeline:
History:

ARCHITECTURE OPTIONS MATRIX
...

CANONICAL RECOMMENDATION
...

ACTIVITY ITEM CONTRACT
...

SOURCE TYPE STRATEGY
...

ACTIVITY TYPE STRATEGY
...

SOURCE SEMANTICS MATRIX
...

TIMESTAMP MATRIX
...

CUSTOMER SUBJECT MODEL
...

PARTNER SUBJECT MODEL
...

SUBJECT-INCLUSION MATRIX
...

OPERATIONAL NOTES INTEGRATION
...

NOTES VS ACTIVITY UX
...

MESSAGING / CHAT INTEGRATION
...

CURRENT VS FUTURE CHANNELS MATRIX
...

DEEP LINKS
...

RBAC MODEL
...

RBAC MATRIX
...

TENANT / WORKSPACE AUTHORITY
...

VISIBILITY MATRIX
...

PAGINATION / ORDERING
...

FILTERS / SEARCH / URL STATE
...

PARTIAL SOURCE FAILURE
...

PROJECTION / CONSISTENCY
...

BACKFILL / REBUILD
...

AUDIT / FINANCE / MESSAGE PRIVACY
...

PII / RETENTION
...

TARGET CUSTOMER 360 UX
...

TARGET PARTNER 360 UX
...

API CONTRACT
...

SECURITY MATRIX
...

PERFORMANCE / N+1
...

OBSERVABILITY
...

IMPLEMENTATION PHASING
...

PRODUCTION CODE CHANGED:
SCHEMA CHANGED:
MIGRATION CREATED:
FRONTEND IMPLEMENTED:
BACKEND IMPLEMENTED:

Report:
Commit:
HEAD:
origin/master:
HEAD == origin/master:

REMAINING FINDINGS
P0:
P1:
P2:

READY FOR IMPLEMENTATION:
NEXT CANONICAL ROUND:
```

---

# 77. VERDICT

Success only:

```text
VERDICT A — PHASE 3 STEP 3.5.3 PLATFORM CRM /
CRM COMMUNICATIONS + ACTIVITY TIMELINE /
CURRENT-STATE + DATA-SOURCE + EVENT SEMANTICS +
RBAC + TENANT AUTHORITY + UX CONTRACT /
FULLY RECONCILED — READY FOR IMPLEMENTATION
```

Failure:

```text
VERDICT B — PHASE 3 STEP 3.5.3 /
CRM COMMUNICATIONS / ACTIVITY TIMELINE ARCHITECTURE INCOMPLETE
```

No conditional VERDICT A.

---

# 78. STOP

After architecture report:

```text
STOP
```

Do NOT implement production code.
Do NOT modify schema.
Do NOT create migrations.
Do NOT begin Activity Timeline UI.
Do NOT begin new communication channels.
