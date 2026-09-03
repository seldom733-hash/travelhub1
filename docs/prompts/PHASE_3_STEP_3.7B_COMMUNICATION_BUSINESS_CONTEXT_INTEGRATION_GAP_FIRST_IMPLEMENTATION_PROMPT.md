# PHASE 3 — STEP 3.7B — COMMUNICATION BUSINESS-CONTEXT INTEGRATION — GAP-FIRST IMPLEMENTATION PROMPT

## MODE

**IMPLEMENTATION — GAP-FIRST / ARCHITECTURE-PRESERVING / EVIDENCE-FIRST**

Canonical NEXT:

```text
PHASE 3 — STEP 3.7B — COMMUNICATION BUSINESS-CONTEXT INTEGRATION
```

Canonical parent contract:

```text
PHASE 3 — STEP 3.7 — COMMUNICATION INTEGRATION
CML-*, email/message/contact history, CRM/Sales/Order/Support links.
```

Do not start Step 3.8 or any later stage.

Do not silently broaden Step 3.7B into full chat completion, realtime, email delivery, Support Domain implementation, automated moderation, notifications, attachments, or Partner Analytics.

---

# 1. Mandatory repository / roadmap preflight

Before changing production code:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git log --oneline --decorate -20
```

Read the current canonical roadmap:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Confirm that the unique canonical NEXT is still:

```text
PHASE 3 — STEP 3.7B — COMMUNICATION BUSINESS-CONTEXT INTEGRATION
```

If the repository roadmap says otherwise:

```text
STOP
VERDICT B — CANONICAL NEXT MISMATCH
```

Do not execute this prompt out of sequence.

Record exact starting SHA.

---

# 2. Accepted predecessor chain

Preserve these completed stages:

```text
Step 3.7
Communication Integration Audit
→ commit 235d39d

Step 3.7A
Marketplace Contact Policy Authority
→ implementation 271fbe3

Step 3.7A.1
Contact Policy Evidence Closure
→ 2c5b202

Step 3.7A.2
Final Runtime Evidence Closure
→ c543ab8
```

Actual Git history is authoritative if later documentation-only commits exist.

Do not regress:

```text
Marketplace Basic:
Customer email/phone restricted server-side

Storefront Pro:
Customer direct contact preserved according to entitlement

Platform:
internal Customer contact visibility preserved

Pre-sale Communication:
normal message succeeds
email / phone / URL contact bypass → 422
```

---

# 3. Goal

Complete the **business-context integration layer** around the existing canonical:

```text
Communication = CML-*
CommunicationThread
```

so communication facts can be safely associated with the business objects they concern, without creating another messaging domain or transferring ownership between bounded contexts.

Target integration concerns:

```text
Communication ↔ CRM
Communication ↔ Sales
Communication ↔ Order
Communication ↔ Booking
Communication ↔ Support boundary
```

The implementation must be driven by actual repository gaps.

---

# 4. Core architecture invariant

Communication owns communication.

It does NOT own:

```text
Customer
Partner
Lead
Opportunity
Quote
Sale
Order
Booking
Support Ticket
```

Therefore:

```text
business entity
        │
        └── context/reference
                ↓
          Communication
```

not:

```text
Communication
        ↓
mutates foreign business domain
```

Cross-domain writes are forbidden unless an already-approved owner-service orchestration contract explicitly exists.

---

# 5. Source-of-truth boundaries

Preserve:

```text
Communication / CommunicationThread
→ communication source of truth

CrmActivity
→ CRM activity/read projection

Operational Notes
→ separate append-only operational notes domain

PartnerCustomerRelation notes
→ Partner relationship notes

Sales entities
→ Sales-owned commercial facts

Order
→ Order-owned transaction fact

Booking
→ Booking-owned fulfillment/reservation fact

Support
→ future Support-owned case/ticket domain
```

Do not merge these models.

---

# 6. GAP-FIRST repository inventory — mandatory before implementation

Inventory the actual current implementation.

At minimum inspect:

```text
backend/prisma/schema.prisma
backend/src/modules/communication/**
backend/src/modules/crm/**
backend/src/modules/sales/**
backend/src/modules/orders/**
backend/src/modules/bookings/**
backend/src/modules/support/**      # if it exists
frontend/** communication surfaces
frontend/** CRM/Sales/Order/Booking detail surfaces
```

Search for:

```text
Communication
CommunicationThread
contextType
contextId
threadId
customerId
partnerId
buyerRequestId
proposalId
orderId
bookingId
saleId
quoteId
opportunityId
leadId
support
ticket
case
MESSAGE
crm.activity
```

Return an inventory table:

| Concern | Existing schema | Existing API | Existing UI | Existing tests | Gap |
|---|---|---|---|---|---|

Do not implement until this table is produced internally.

---

# 7. Existing Communication contract must be reused

The accepted Step 3.7 audit found the existing bounded context, including:

```text
Communication
CommunicationThread
```

and existing reverse/pre-sale communication.

Do NOT introduce:

```text
OrderMessage
BookingMessage
CrmMessage
SalesMessage
SupportMessage
PartnerMessage
ChatMessageV2
ConversationV2
```

unless the current repository already contains a canonical entity with such a name and the roadmap explicitly requires reconciliation.

Default:

```text
one Communication domain
many business contexts
```

---

# 8. Context model audit

Determine the exact current context representation.

Do not assume whether the repository uses:

```text
contextType + contextId
```

or explicit nullable references, metadata, participant-context rows, or another accepted mechanism.

Document:

1. exact fields;
2. exact enums;
3. indexes;
4. uniqueness constraints;
5. foreign-key / ADR boundary;
6. which contexts are already supported;
7. whether `ORDER` / `BOOKING` exist only in enum but are unused;
8. whether Sales context exists;
9. whether Support context exists;
10. whether multiple contexts per Communication are supported or intentionally not supported.

Then implement the smallest safe extension.

---

# 9. Business-context identity rule

A visible Communication context must resolve to a stable business identity.

Preferred business labels:

```text
Customer → CRM business code/name
Lead → LED-*
Opportunity → OPP-*
Quote → QTE-*
Sale → SAL-*
Order → TH-YYYY-###### / canonical Order code
Booking → canonical Booking code
Support Ticket → future canonical Support code
```

Never expose raw UUID as the primary human-facing label when a canonical business identifier exists.

Internal href/reference may still use UUID if routing requires it.

---

# 10. Order integration

Audit whether Communication can currently be associated with Order.

If the schema already supports:

```text
contextType = ORDER
contextId = <Order identity>
```

but no authority/resolution exists, implement the missing authority rather than adding a second relationship model.

Required invariants:

```text
Order ownership remains in Order domain
Communication does not modify Order status
Communication does not create Order
Communication does not change seller/customer ownership
```

When creating or reading Order-context communication:

- validate the referenced Order server-side;
- derive allowed participants from authoritative Order/Customer/Partner relations;
- prevent arbitrary client-supplied participant spoofing;
- prevent cross-partner access;
- prevent Buyer access to another Buyer's Order;
- internal Platform access must be permission-scoped;
- use neutral 403/404 semantics consistent with existing object-scope policy.

Do not expose Customer direct contacts to Marketplace Basic through Order-context communication payloads.

---

# 11. Booking integration

Apply the same principles to Booking.

Required:

```text
Communication → Booking context/reference
```

must not mean:

```text
Communication owns Booking
```

Validate:

```text
Booking → Order/OrderItem relationship
Buyer/Customer authority
seller Partner authority
```

Do not derive tenant membership from client input.

Do not mutate Booking lifecycle from Communication.

If Booking already provides the necessary authoritative relation through Order, reuse it.

Do not duplicate customer/seller linkage.

---

# 12. Sales integration

Audit actual Sales domain objects and determine which Sales contexts are legitimate for Communication.

Potential objects include:

```text
Lead
Opportunity
Quote
Sale
```

Do not automatically support all of them.

For each candidate answer:

```text
Is communication business-relevant here?
Is there already an existing reference?
Who are legitimate participants?
Is it internal-only or Customer/Partner-visible?
Does another context already cover it?
```

Implement only contexts justified by the current business flow and canonical roadmap.

Avoid a generic unsafe:

```text
contextType: string
contextId: arbitrary UUID
```

without server-side type-specific authority resolution.

---

# 13. CRM integration

CRM integration has two different meanings and they must not be conflated.

### A. Communication linked to Customer/Partner context

If supported, Communication may resolve:

```text
Customer
Partner
PartnerCustomerRelation
```

as business context.

### B. Communication projected into CrmActivity

This is a separate concern.

The Step 3.7 audit found:

```text
CrmActivity source type MESSAGE exists
but Communication → CrmActivity projection was missing
```

For Step 3.7B:

1. audit whether the roadmap now explicitly includes this projection in 3.7B;
2. if yes and dependency is safe, implement it as a projection/read-model integration;
3. if not explicit or it materially expands scope, record it as the next Communication sub-slice instead of silently implementing it.

Do not make CrmActivity the source of truth for messages.

---

# 14. Support integration boundary

Canonical roadmap has a later dedicated:

```text
Step 3.10 — Support Domain
Step 3.11 — Support Center UI
```

Therefore Step 3.7B MUST NOT invent a full Support domain.

Audit current repository.

If Support entity does not exist:

```text
SUPPORT BUSINESS CONTEXT → DEFERRED / DEPENDENCY ON STEP 3.10
```

Do not create placeholder Ticket/Case tables just to satisfy Step 3.7 wording.

If a pre-existing approved Support entity already exists, integration may reference it only if safe and consistent with the roadmap.

---

# 15. Participant authority

For every supported context define server-authoritative participants.

The client must never be able to grant itself access by sending:

```text
customerId
buyerId
partnerId
sellerPartnerId
memberIds
participantIds
tenantId
workspaceId
```

when those values are derivable from the business context.

Required pattern:

```text
actor
  ↓
context resolver
  ↓
authoritative business entity
  ↓
authorized participant set
  ↓
Communication operation
```

---

# 16. Context resolver architecture

Avoid large repeated `if/switch` authorization blocks scattered across controllers.

Prefer one bounded Communication integration seam, e.g. conceptually:

```text
CommunicationContextResolver
CommunicationContextAuthority
CommunicationBusinessContextService
```

Final name must follow repository conventions.

Responsibilities may include:

```text
resolve context
validate existence
derive Customer/Buyer
derive Partner/Seller
derive business label/code
authorize actor
return safe context projection
```

Do not move business-domain ownership into this resolver.

Use owner-domain read APIs/services/repositories according to existing architecture.

---

# 17. Cross-domain dependency discipline

Before importing another domain's Prisma model directly, inspect existing ADR/module dependency conventions.

Prefer:

```text
owner-domain read service
or approved narrow orchestration seam
```

over arbitrary direct writes.

If existing project architecture intentionally uses read-only Prisma cross-schema lookup under ADR-0001 or equivalent, follow the accepted pattern.

Document any new cross-domain dependency.

If a new ADR is genuinely required:

```text
STOP
ARCHITECTURE DECISION REQUIRED
```

Do not silently create an architectural exception.

---

# 18. Context creation authority

Audit current creation endpoints.

If generic:

```text
POST /communications
```

accepts business context from the client, harden it so the server validates the referenced entity and actor authority.

Do not trust:

```text
contextType
contextId
```

merely because they match a syntactically valid enum/UUID.

Expected failure examples:

```text
Partner A + Partner B Order → 403/404
Buyer A + Buyer B Order → 403/404
nonexistent Order → 404
forged Booking context → 403/404
unsupported context → 400/422
```

Use current project error conventions.

---

# 19. Context read authority

List/detail/read endpoints must enforce object scope based on the referenced business context.

A user who guesses a CML ID must not gain access.

Required tests:

```text
authorized participant → 200
same Partner own object → 200
different Partner → 403/404
different Buyer → 403/404
anonymous → 401
staff without permission → 403
authorized Platform role → 200 where contract permits
```

---

# 20. Marketplace Basic contact policy regression

Step 3.7A is a hard prerequisite.

For every new/changed Communication response recursively inspect for:

```text
email
phone
mobile
whatsapp
telegram
website
social handles
raw Customer contact metadata
```

Marketplace Basic must not regain unrestricted Customer direct contacts through:

```text
context projection
participant projection
Order snapshot
Booking snapshot
CRM relation
metadata
sender/recipient object
```

Do not rely on frontend hiding.

---

# 21. Storefront Pro behavior

Do not over-restrict Storefront Pro merely because Marketplace Basic is restricted.

Use the canonical entitlement resolver.

Do not infer PRO from:

```text
PARTNER role
storefront existence alone
client header
query parameter
body tier
```

Preserve:

```text
active storefront + active entitlement → PRO
otherwise → BASIC
```

where that is the current canonical resolver contract.

---

# 22. Anti-disintermediation regression

Existing pre-sale reverse conversation behavior must remain:

```text
normal text → accepted
email → 422
phone → 422
URL → 422
```

Do not weaken:

```text
shared/anti-disintermediation.ts
```

Do not claim this is a full moderation engine.

No implementation of:

```text
ALLOW/REDACT/BLOCK/REVIEW
moderation review queue
semantic circumvention
attachment scanner
full obfuscation normalization
```

in this step.

---

# 23. Communication history semantics

Communication facts/history must remain durable.

Do not silently rewrite/delete existing CML records when:

```text
Order status changes
Booking status changes
Customer data changes
Partner entitlement changes
Sales lifecycle changes
```

Context identity should remain historically interpretable.

If display labels are resolved live, document that.

If snapshots already exist, preserve them.

Do not invent snapshotting without evidence.

---

# 24. Email / external contact history

Step 3.7 parent wording includes:

```text
email/message/contact history
```

But Step 3.7 audit found email/external contact history not implemented.

For 3.7B:

```text
DO NOT build an email sending/provider integration.
```

Audit whether existing Communication supports channel/type values for external facts.

If safe, business-context integration should remain compatible with future:

```text
EMAIL
PHONE
EXTERNAL
```

but no speculative provider workflow.

Record remaining gap explicitly.

---

# 25. Realtime

Realtime is not required for business-context integration.

Do not add:

```text
WebSocket
Socket.IO
SSE
Redis pub/sub
presence
typing indicators
read receipts
```

unless the current canonical Step 3.7B roadmap explicitly requires it.

Default:

```text
DEFERRED
```

---

# 26. Attachments

Do not add attachment storage/upload/moderation in this step.

Preserve future compatibility only.

---

# 27. Frontend integration — gap-first

Do not create a new global Chat Center unless the roadmap explicitly requires it.

Audit existing detail pages:

```text
CRM Customer detail
CRM Partner detail
Sales detail
Order detail
Booking detail
existing reverse conversation UI
```

Where backend context integration is actually supported, expose the smallest useful communication surface consistent with existing UI architecture.

Possible patterns:

```text
Communication / Messages tab
linked communication timeline
business-context link from CML item
```

Do not duplicate existing Activity/Notes tabs.

If a context has no product requirement for UI in 3.7B, backend-only integration may be correct — document it.

---

# 28. Related-entity labels

All new visible context references must use human-readable labels.

Examples:

```text
Order → TH-YYYY-######
Booking → business booking code
Customer → display name / CRM code
Partner → company/business name
Opportunity → OPP-*
Quote → QTE-*
Sale → SAL-*
```

Never render UUID as the visible label if resolvable.

---

# 29. i18n

Any new UI text must support:

```text
RU
AZ
EN
```

No raw translation keys.

No English-only status/context labels in RU/AZ.

Reuse existing translation infrastructure.

---

# 30. Pagination / filtering

Do not replace existing Communication pagination contracts.

If context filters are added, they must be:

```text
server-side
whitelisted
validated
tenant-safe
indexed or demonstrably bounded
```

Potential filter:

```text
contextType
contextId
```

must pass authority checks.

Do not let context filtering become an existence oracle for foreign tenant entities.

---

# 31. Database changes

Schema changes are allowed only if the gap analysis proves the existing model cannot represent required business contexts safely.

If schema already has adequate generic context support:

```text
NO MIGRATION
```

is preferred.

If migration is necessary:

- additive;
- nullable where legacy compatibility requires;
- no destructive backfill;
- no fabricated historical relationships;
- indexed appropriately;
- replay/fresh-install safe;
- Prisma migration drift clean.

Do not introduce broad polymorphic FK fiction if project ADR intentionally avoids cross-schema FKs.

---

# 32. Historical data

Do not fabricate Order/Booking/Sales context for old CML rows.

Only backfill when a deterministic existing relation proves the mapping.

If deterministic proof does not exist:

```text
leave historical context unchanged
```

and report counts.

---

# 33. Auditability

If business-context linking itself is a mutating operation, determine whether it is:

```text
immutable at creation
```

or legitimately editable.

Default preference:

```text
context assigned server-side at Communication creation
not freely re-linkable later
```

Do not allow arbitrary PATCH from Order A → Order B.

Any allowed relink must be explicitly justified and audited.

---

# 34. Security matrix

Produce and test a matrix for every implemented context.

Minimum actors:

```text
Anonymous
Buyer A
Buyer B
Marketplace Basic Partner A
Marketplace Basic Partner B
Storefront Pro Partner
Platform ADMIN
Platform OPERATOR or relevant staff
staff role without communication permission
```

Minimum dimensions:

```text
create/send
list
detail
context filter
cross-tenant attempt
contact disclosure
```

---

# 35. Required automated tests

Add focused tests for the actual implemented gaps.

At minimum where applicable:

### Context authority

```text
own Order context → allowed
foreign Order context → denied
own Booking context → allowed
foreign Booking context → denied
nonexistent context → controlled error
unsupported context → controlled error
```

### Actor spoofing

```text
forged partnerId ignored/rejected
forged customerId ignored/rejected
forged participant/member IDs ignored/rejected
```

### Contact policy

```text
Basic payload has no restricted contacts
Pro behavior preserved
Platform behavior preserved
```

### Communication regression

```text
existing reverse chat normal message succeeds
email rejected 422
phone rejected 422
URL rejected 422
cross-seller isolation preserved
```

### Historical / integrity

```text
no duplicate CML facts
no cross-domain lifecycle mutation
no orphaned invalid context created
```

Use real project test conventions.

---

# 36. Runtime API evidence — mandatory

Source/tests alone are insufficient for final implementation claim.

Use real isolated test/runtime actors.

Demonstrate at least:

```text
A. own Order communication context → success
B. foreign Partner Order context → 403/404
C. foreign Buyer Order context → 403/404
D. own Booking context → success
E. foreign Booking context → 403/404
F. Basic response recursively contains no direct Customer contacts
G. Pro regression according to entitlement
H. Platform permission-scoped access
```

If Sales context is implemented, equivalent runtime proof is required.

If a candidate context is deferred, explain why rather than fabricating evidence.

---

# 37. Runtime browser evidence

For every UI surface changed:

Verify in browser:

```text
RU
AZ
EN
```

and at least relevant:

```text
Marketplace Basic
Storefront Pro
Platform
```

Check:

```text
business label instead of UUID
correct link/navigation
no raw i18n keys
no contact leakage
no broken empty state
no unauthorized action
```

If 3.7B legitimately has no frontend changes:

```text
Frontend changes: NONE
Browser evidence: N/A
Reason: <exact architectural/product reason>
```

Do not invent browser evidence.

---

# 38. Full payload recursive leakage scan

For Marketplace Basic runtime responses scan recursively for keys/values such as:

```text
email
phone
mobile
telephone
whatsapp
telegram
website
social
contact
```

Classify every hit.

Do not treat a harmless field such as `contactPolicy` as PII merely because its name contains "contact"; inspect values/semantics.

Report:

```text
restricted PII leaks: 0
```

only with actual evidence.

---

# 39. Search / enumeration resistance

If new context filters/search allow identifiers or Customer-derived search:

prove a Partner cannot use them to discover foreign:

```text
Customer
Order
Booking
Communication
```

existence.

Neutral 404/empty semantics must follow existing project policy.

---

# 40. Performance / query safety

Check for:

```text
N+1 context resolution
unbounded Communication scans
per-row cross-domain queries
missing context indexes
```

Prefer batched resolution where lists require business labels.

Do not introduce one database query per CML row if a bounded/batched approach exists.

---

# 41. Existing regressions that must remain green

At minimum rerun relevant suites for:

```text
Communication
CRM
Orders
Bookings
Sales
Analytics if CRM Activity touched
Frontend if UI touched
```

Plus:

```text
backend TSC
frontend TSC if frontend touched
```

Report exact suite/test counts.

No vague:

```text
all tests passed
```

---

# 42. No silent remediation outside scope

If gap-first analysis discovers a serious unrelated defect:

```text
STOP
```

Report:

```text
VERDICT B — BLOCKED BY OUT-OF-SCOPE DEFECT
```

Do not silently repair:

```text
Support Domain
email infrastructure
full moderation
Partner Analytics
Operational Notes permissions
CRM Activity permissions
realtime
notifications
attachments
```

unless required directly for safe 3.7B completion and approved by the roadmap.

---

# 43. Working-tree discipline

Do not stage unrelated pre-existing changes.

Before commit:

```bash
git status
git diff --stat
git diff
```

Commit only Step 3.7B production/tests/docs that belong to this implementation.

Report unrelated dirty-tree items separately.

Do not call the tree clean if it is not clean.

---

# 44. Documentation

Update only documentation necessary to explain the implemented contract.

Possible artifacts:

```text
docs/architecture/communication-business-context-integration.md
docs/contracts/api.md
Step 3.7B implementation report
```

Do NOT mark Step 3.7B `DONE/APPROVED` in canonical roadmap before required Strict Review unless current roadmap convention explicitly allows an implementation-complete intermediate status.

The canonical project rule is:

```text
Implementation
→ Strict Review
→ APPROVED
→ next implementation item
```

Respect it.

---

# 45. Commit / push

After implementation and automated/runtime evidence:

```bash
git status
git diff --stat
git add <only intended files>
git commit -m "feat(communication): integrate business contexts"
git push
git rev-parse HEAD
git rev-parse origin/master
```

Use repository conventions if a different commit message is appropriate.

Do not fabricate SHA.

---

# 46. Required implementation report

Return a structured report.

## A. Verdict

Allowed implementation verdicts:

```text
VERDICT A — STEP 3.7B IMPLEMENTATION COMPLETE — READY FOR STRICT REVIEW
```

or:

```text
VERDICT B — STEP 3.7B IMPLEMENTATION INCOMPLETE
```

Do NOT say:

```text
STEP 3.7B APPROVED
FULLY CLOSED
```

before separate Strict Review.

---

## B. Git baseline

```text
Starting HEAD:
Starting origin/master:
Canonical NEXT confirmed:
Working tree before:
```

---

## C. Gap-first inventory

Table:

| Concern | Before | Gap | Implemented | Deferred |
|---|---|---|---|---|

Include:

```text
CRM
Sales
Order
Booking
Support
CrmActivity MESSAGE projection
Email/external history
Realtime
Attachments
Moderation
```

---

## D. Context architecture

Return exact:

```text
schema fields
context types
resolver/authority seam
owner-domain dependencies
participant derivation
object-scope rules
```

---

## E. Implemented contexts

For each:

```text
context
why required
creation authority
read authority
participants
visible business label
contact policy
```

---

## F. Deferred contexts

For every deferred item:

```text
item
reason
dependency
future canonical stage/sub-slice if known
```

No silent omission.

---

## G. API changes

For each endpoint:

```text
METHOD path
permission
actor scope
request changes
response changes
error behavior
```

---

## H. Database

```text
schema changed: YES/NO
migration:
historical backfill:
indexes:
legacy behavior:
```

---

## I. Security evidence

Return matrix results for:

```text
Buyer own/foreign
Basic Partner own/foreign
Pro Partner
Platform authorized/unauthorized
Anonymous
```

---

## J. Contact-policy evidence

Show actual Basic payload excerpt or structured key scan proving restricted direct contacts are absent.

Show Pro/Platform regression behavior where applicable.

---

## K. Communication regression

Actual evidence:

```text
normal message:
email:
phone:
URL:
cross-seller:
```

---

## L. Tests

Exact:

```text
Communication: X/X
CRM: X/X
Orders: X/X
Bookings: X/X
Sales: X/X
Analytics: X/X or N/A
Frontend: X/X or N/A
Backend TSC:
Frontend TSC:
```

---

## M. Runtime evidence

List actual requests/statuses/business codes.

No invented examples.

---

## N. Browser/i18n evidence

```text
RU:
AZ:
EN:
Basic:
Pro:
Platform:
```

or legitimate N/A with reason.

---

## O. Changed files

For each:

```text
path
purpose
production/test/docs
```

---

## P. Git final

```text
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
commit:
production changes:
working tree:
pre-existing unrelated changes:
```

---

## Q. Strict Review readiness

Return:

```text
READY FOR STEP 3.7B STRICT REVIEW: YES/NO
```

Do not identify/start a later implementation step.

---

# 47. Hard implementation gates

`VERDICT A — IMPLEMENTATION COMPLETE — READY FOR STRICT REVIEW` is forbidden unless:

```text
[ ] canonical NEXT verified from current roadmap
[ ] exact starting SHA recorded
[ ] gap-first inventory completed
[ ] existing Communication domain reused
[ ] no duplicate messaging domain
[ ] actual context model documented
[ ] every implemented context has server-side authority resolution
[ ] client cannot spoof participants/tenant
[ ] Order ownership preserved
[ ] Booking ownership preserved
[ ] Sales ownership preserved
[ ] Support Domain not invented prematurely
[ ] Basic contact restriction preserved server-side
[ ] Pro behavior not accidentally downgraded
[ ] Platform permission boundary preserved
[ ] anti-disintermediation regression passes
[ ] cross-partner isolation passes
[ ] cross-buyer isolation passes
[ ] no foreign-object existence leak introduced
[ ] no arbitrary context relinking
[ ] no fabricated historical context
[ ] human-readable related labels used
[ ] RU/AZ/EN verified for changed UI
[ ] targeted automated tests pass
[ ] runtime API evidence passes
[ ] browser evidence supplied for changed UI or legitimate N/A
[ ] no out-of-scope Support/email/realtime/full-moderation implementation
[ ] exact changed files reported
[ ] exact final Git SHA reported
[ ] HEAD/origin synchronization proven
[ ] dirty-tree state reported honestly
[ ] roadmap not prematurely marks Step 3.7B APPROVED
```

Any failed mandatory gate:

```text
VERDICT B — STEP 3.7B IMPLEMENTATION INCOMPLETE
```

---

# 48. Stop condition

After Step 3.7B implementation:

1. commit and push the implementation;
2. return the implementation report;
3. state whether it is ready for **Step 3.7B Strict Review**;
4. do NOT mark Step 3.7B APPROVED;
5. do NOT start another Communication sub-step;
6. do NOT start Step 3.8;
7. wait for review.
