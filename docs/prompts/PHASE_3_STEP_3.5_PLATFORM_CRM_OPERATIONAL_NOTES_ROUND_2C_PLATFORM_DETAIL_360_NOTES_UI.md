# PHASE 3 — STEP 3.5 — PLATFORM CRM
## OPERATIONAL NOTES IMPLEMENTATION
## ROUND 2C — PLATFORM DETAIL / 360 NOTES UI + RUNTIME UX AUTHORITY

---

# 1. PRECONDITION

Preserve all accepted work:

```text
Shared Table Controls final closure
SHA: ec2e65c

Operational Notes Architecture V2
SHA: 240fbe8

Operational Notes Round 2A
Data Model + Migration + Backend Authority
SHA: e0fe7bb

Operational Notes Round 2A.1
Backend Regression Evidence Closure
SHA: a13e280

Operational Notes Round 2B
Notes API + RBAC + Parent Scope Authority
+ Audit + Edit + Delete Lifecycle
SHA: 8b9999f
```

Starting SHA:

```text
8b9999f
```

or an explicitly explained descendant.

Before implementation, inspect the complete Round 2B report and confirm that the required backend E2E/full regression/frontend regression gates were actually executed.

If the summary omitted evidence that exists in the report, record it.

If required Round 2B evidence is genuinely missing, perform an evidence-only closure before or as the first isolated section of this round. Do not silently assume missing gates passed.

---

# 2. PURPOSE

Expose the already implemented Operational Notes lifecycle in the real Platform UI.

Round 2C must provide a reusable enterprise-grade Notes experience on applicable Platform detail / 360 surfaces:

```text
read
create
edit
delete
author/timestamps
pagination
RBAC-aware actions
loading
empty
forbidden
error
validation
i18n
a11y
responsive behavior
deep-link/runtime stability
```

Backend Round 2B remains the security authority.

Frontend MUST NOT become an authorization authority.

---

# 3. STRICT SCOPE

Implement:

```text
shared Operational Notes frontend component(s)
frontend API client/types
Platform detail/360 integration
list/read UI
create-note UI
edit-note UI
delete-note UI
pagination
RBAC-aware action presentation
loading/empty/error/forbidden states
RU/AZ/EN i18n
accessibility
responsive behavior
browser runtime evidence
frontend/backend regression
```

Do NOT implement:

```text
initial note textarea inside entity create forms
atomic entity + initial-note UI wiring
Storefront Pro CRM
Marketplace Basic CRM
partner-facing INTERNAL notes
buyer-facing INTERNAL notes
mentions
attachments
threads/replies
notifications
rich text
Markdown notes
global Notes search
Activity timeline merge
new Payment/Refund detail routes only for Notes
new business-state transitions
```

Initial create-form notes remain Round 2D.

---

# 4. BACKEND AUTHORITY

Do not weaken or duplicate Round 2B authority.

Frontend may hide/disable unavailable actions for UX, but server MUST remain authoritative for:

```text
read
create
update
delete
parent scope
ownership
ADMIN override
visibility
author
timestamps
```

Never infer authorization solely from frontend role names.

Prefer actual permission/capability data already available in the application.

If the frontend cannot reliably know a specific mutation permission, it may avoid optimistic assumptions, but the backend denial remains canonical.

---

# 5. UI COVERAGE AUDIT — MANDATORY FIRST STEP

Before coding, inspect all 11 Round 2A/2B entity types and classify their current Platform UI surface.

Canonical entity types:

```text
CUSTOMER
PARTNER
ORDER
BOOKING
PAYMENT
REFUND
PRODUCT
FULFILLMENT
RESERVATION
BUYER_REQUEST
PARTNER_APPLICATION
```

For each classify:

```text
DEDICATED_DETAIL
360_DETAIL
EMBEDDED_DETAIL
NO_PLATFORM_DETAIL_SURFACE
NOT_APPLICABLE_TO_CURRENT_PLATFORM_UI
```

Do not invent a new detail page solely to host Notes.

---

# 6. REQUIRED UI COVERAGE MATRIX

Complete before implementation:

| Entity | Current Route/Surface | Classification | Notes Placement | Implement This Round? | Rationale |
|---|---|---|---|---:|---|
| Customer | | | | | |
| Partner | | | | | |
| Order | | | | | |
| Booking | | | | | |
| Payment | | | | | |
| Refund | | | | | |
| Product | | | | | |
| Fulfillment | | | | | |
| Reservation | | | | | |
| BuyerRequest | | | | | |
| PartnerApplication | | | | | |

No blank rows.

At minimum, integrate into all currently existing applicable Platform detail/360 pages.

---

# 7. KNOWN EXISTING PLATFORM SURFACES

At the accepted project state, explicitly inspect at least:

```text
Customer 360
/app/crm/customers/:id

Partner 360
/app/crm/partners/:id

Order detail
/app/orders/:id

Booking detail
/app/bookings/:id

Product/Service detail
/app/catalog/:id
```

Do not assume route existence from documentation alone. Verify runtime/source.

Payment and Refund currently may be embedded in Customer 360 rather than dedicated detail routes. Audit actual current implementation.

If no dedicated Payment/Refund route exists:

```text
DO NOT create one merely for Round 2C.
```

Instead determine whether entity-specific Notes can be exposed safely from the existing embedded context without confusing parent identity.

If not, classify as deferred with explicit rationale.

---

# 8. UX PLACEMENT PRINCIPLE

Operational Notes are operational context, not primary business data.

Use a consistent placement across detail pages.

Preferred patterns:

```text
dedicated "Примечания" tab
OR
clearly separated "Примечания" section
```

Choose based on the existing page architecture.

Customer 360 and Partner 360 already use tabs. Preserve their navigation model.

Do not create inconsistent UX such as:

```text
Customer → tab
Partner → modal
Order → random card
Booking → side drawer
```

without architectural reason.

---

# 9. CUSTOMER 360

Integrate Operational Notes into Customer 360.

Expected route:

```text
/app/crm/customers/:id
```

Preferred:

```text
new tab: Примечания
```

Preserve:

```text
existing tabs
?tab= URL state
browser Back/Forward
refresh
breadcrumbs
deep links
sorting/filter state outside Notes
```

Do not regress existing Customer 360:

```text
Overview
Orders
Bookings
Payments
Partners
Refunds
History
```

or actual current tab set.

---

# 10. PARTNER 360

Integrate Operational Notes into Partner 360.

Expected route:

```text
/app/crm/partners/:id
```

Preferred:

```text
new tab: Примечания
```

Preserve all existing Partner 360 tabs and URL tab state.

Do not regress:

```text
Overview
Services
Orders
Bookings
Customers
Storefront
```

or actual current tab set.

---

# 11. ORDER DETAIL

Integrate Notes into:

```text
/app/orders/:id
```

Use the same shared Notes component and lifecycle semantics.

Do not create a second Order comments implementation.

Notes must be bound to:

```text
entityType = ORDER
entityId = exact current order ID
```

Never bind by display code alone.

---

# 12. BOOKING DETAIL

Integrate Notes into:

```text
/app/bookings/:id
```

Bind:

```text
entityType = BOOKING
entityId = exact booking ID
```

No status/date mutation may occur from note actions.

---

# 13. PRODUCT / SERVICE DETAIL

Integrate Notes into:

```text
/app/catalog/:id
```

Canonical backend type:

```text
PRODUCT
```

Do not create separate SERVICE note semantics if the canonical entity is Product.

Preserve Catalog terminology in the UI where appropriate.

---

# 14. PAYMENT / REFUND

Audit actual UI architecture.

If Payment/Refund are only embedded rows inside Customer 360:

- do not attach a Customer note while visually implying it belongs to a Payment;
- do not attach a Refund note to Payment;
- do not attach Payment note to Order merely because it pays an order.

Entity identity must remain exact.

If an embedded entity-specific Notes affordance is implemented, it must explicitly bind to:

```text
PAYMENT + payment.id
REFUND + refund.id
```

and clearly communicate which entity the note belongs to.

If that cannot be done cleanly within current UX, defer UI exposure while keeping backend support.

Document the decision.

---

# 15. FULFILLMENT / RESERVATION / REQUEST / APPLICATION

Audit current Platform surfaces.

Do not invent routes.

If an applicable existing detail surface exists, integrate the shared Notes UI.

If none exists:

```text
backend support remains valid
frontend exposure = deferred
```

with exact reason.

This is not a Round 2C failure if there is genuinely no existing applicable Platform detail surface.

---

# 16. SHARED NOTES COMPONENT

Create/reuse a single canonical frontend implementation.

Conceptual component:

```text
<OperationalNotes
  entityType="CUSTOMER"
  entityId={id}
/>
```

Exact component API may follow project conventions.

It must not contain page-specific business logic.

Page-specific code supplies identity/context only.

---

# 17. NO DUPLICATE NOTE LOGIC

Forbidden:

```text
CustomerNotes component with its own API behavior
PartnerNotes with different lifecycle
OrderComments using another endpoint
BookingRemarks local state
```

All Operational Notes surfaces must use the shared contract.

---

# 18. NOTE LIST ITEM

Each note should present at minimum:

```text
text
author display name
created date/time
edited state/date if updated
available actions
```

Do not expose internal IDs unless needed for navigation/debug conventions.

Do not display raw enum/internal security metadata.

---

# 19. DATE / TIME SEMANTICS

Notes are operational records; time matters.

Display meaningful date AND time, not date only.

Use existing project timezone/date formatting conventions.

Required distinction:

```text
Created: 26.08.2026 18:42
Edited: 26.08.2026 19:05
```

or equivalent localized UX.

Do not replace server timestamps with client-generated timestamps.

---

# 20. AUTHOR SEMANTICS

Display safe author identity from API projection.

Example:

```text
Nadir Suleymanov
```

or canonical display name.

Do not expose email/security fields unless current UX explicitly requires them.

If author data is unavailable due to a legitimate historical case, render an honest fallback rather than fake identity.

---

# 21. CREATE NOTE UX

Provide a clear action:

```text
Добавить примечание
```

or inline composer consistent with current design.

Requirements:

```text
plain textarea
max 5000
character count or clear limit feedback
multiline
submit
cancel/reset where appropriate
loading state
server validation handling
```

No rich-text editor.

No Markdown execution.

No HTML rendering.

---

# 22. CREATE SUCCESS

After successful creation:

```text
new note appears according to canonical ordering
input clears
pagination remains coherent
no full-page reload required
```

Do not fabricate a local note before server authority unless existing project mutation architecture safely reconciles it.

Prefer server-confirmed state.

---

# 23. CREATE FAILURE

On 400/403/404/5xx:

```text
do not insert fake note
preserve user text where useful
show canonical error
do not convert failure to empty state
```

403 must not look like successful creation.

---

# 24. EDIT UX

Only expose edit action when frontend capability context indicates it may be available.

Backend remains authoritative.

Use a clear edit mode:

```text
textarea
Save
Cancel
```

Preserve original text until save succeeds.

If save fails:

```text
do not replace note with failed draft
show error
allow retry/cancel
```

---

# 25. EDITED INDICATOR

When `updatedAt` semantically differs from creation:

show localized indication such as:

```text
Изменено 26.08.2026 19:05
```

Do not show "edited" merely because ORM updatedAt equals createdAt or because the record was read.

Use actual backend semantics.

---

# 26. DELETE UX

Delete must require explicit user action.

Use project-standard confirmation UI.

Confirmation should identify the destructive action clearly.

Example:

```text
Удалить примечание?
Это действие удалит примечание из обычного рабочего представления.
```

Do not claim physical destruction if backend uses soft delete.

---

# 27. DELETE SUCCESS

After successful delete:

```text
note disappears from normal list
pagination/list count reconciles
no stale deleted card remains
```

Do not mutate parent business data.

---

# 28. DELETE FAILURE

On denial/conflict/error:

```text
note remains visible
error shown
no fake success
```

---

# 29. RBAC-AWARE UX

Frontend actions must respect actual capabilities where available.

Examples:

```text
read only → list visible, no Add/Edit/Delete
create only where read also makes UX sense according to matrix
update authority → Edit where policy allows
delete authority → Delete where policy allows
```

Do not use hardcoded:

```text
if role === "ADMIN"
```

as the general permission system.

ADMIN override behavior still comes from backend authority.

---

# 30. SERVER DENIAL AFTER UI ALLOWANCE

Race/stale permission cases are possible.

If UI shows an action but backend returns 403:

```text
show forbidden/error state
do not fake success
refresh capability/state if project architecture supports it
```

Security remains correct even if frontend permission state is stale.

---

# 31. READ FORBIDDEN STATE

A Notes read 403 is not:

```text
"Примечаний пока нет"
```

Render an explicit access-denied state consistent with project UX.

Do not reveal note count/content.

---

# 32. EMPTY STATE

Only after successful authorized API response with zero notes:

```text
Примечаний пока нет
```

or localized equivalent.

If create permission exists, the empty state may include CTA.

If read-only actor has zero notes, do not show a CTA they cannot use.

---

# 33. ERROR STATE

Network/5xx/unknown load failure must show an error state:

```text
Не удалось загрузить примечания
Повторить
```

or project equivalent.

Never render zero state on load failure.

---

# 34. LOADING STATE

Use project-standard loading/skeleton behavior.

Avoid layout collapse/flicker where practical.

Loading must be distinguishable from:

```text
empty
forbidden
error
```

---

# 35. NOT FOUND / PARENT FAILURE

If the parent detail page itself is 404:

```text
do not separately render Notes as if parent exists
```

Existing parent not-found behavior remains authoritative.

If Notes API returns parent-not-found unexpectedly while page parent exists, treat as error/inconsistency, not empty state.

---

# 36. PAGINATION UX

Use Round 2B server pagination.

Do not fetch all notes and paginate client-side.

UI must preserve:

```text
stable ordering
page navigation
no duplicates
no missing notes
```

Choose URL state deliberately.

For Notes embedded inside a detail page, avoid polluting the parent URL with generic `page` that conflicts with other tabs.

Preferred parameter if URL persistence is needed:

```text
notesPage
```

or a scoped equivalent.

Document the choice.

---

# 37. TAB URL STATE

Customer/Partner 360 Notes tab MUST preserve existing tab deep-link contract.

Example:

```text
/app/crm/customers/:id?tab=notes
/app/crm/partners/:id?tab=notes
```

Use actual project param naming.

Refresh must reopen Notes tab.

Back/Forward must work.

---

# 38. PAGINATION + TAB STATE

If Notes pagination is URL-backed:

```text
?tab=notes&notesPage=2
```

must survive refresh and Back/Forward.

When switching to another tab, do not corrupt unrelated sorting/filter parameters.

---

# 39. I18N

All new user-facing strings must exist in:

```text
RU
AZ
EN
```

No raw keys.

Cover at minimum:

```text
Notes
Add note
Edit
Delete
Save
Cancel
No notes
Load error
Forbidden
Retry
Created
Edited
Author
Characters remaining / max validation
Delete confirmation
```

Use existing i18n architecture.

---

# 40. TEXT SAFETY

Operational Notes are plain text.

Ensure note content is rendered as text, not executable HTML.

Test representative content:

```text
<script>alert(1)</script>
<img onerror=...>
markdown-like text
URLs
line breaks
quotes
Unicode
RU/AZ characters
```

No XSS.

Preserve useful line breaks safely.

---

# 41. ACCESSIBILITY

Required:

```text
textarea label
buttons with accessible names
keyboard-operable edit/delete/create
focus management
confirmation accessibility
loading/error announcements where project conventions support them
no icon-only action without accessible label
```

Do not make actions mouse-only.

---

# 42. RESPONSIVE UX

Verify at least representative desktop and narrow/mobile viewport.

Notes must not cause:

```text
horizontal page overflow
unreadable metadata
off-screen action buttons
broken textarea
confirmation overflow
```

Long note text must wrap safely.

---

# 43. LONG CONTENT

Test:

```text
1 char
multiline
long paragraph
near-5000 chars
```

No card/table layout break.

Do not truncate operational content permanently without a way to inspect full text.

---

# 44. SHARED API CLIENT

Add typed frontend API methods following existing `frontend/lib/api.ts` conventions.

Conceptually:

```text
listOperationalNotes(...)
createOperationalNote(...)
updateOperationalNote(...)
deleteOperationalNote(...)
```

Use actual project naming style.

No direct ad hoc `fetch()` duplicated across detail pages if the project centralizes API access.

---

# 45. FRONTEND TYPES

Use stable DTO types matching Round 2B response projection.

Do not mirror raw Prisma models.

Type at minimum:

```text
id
text
author
createdAt
updatedAt
visibility if actually returned/needed
pagination metadata
action/capability metadata if API provides it
```

---

# 46. CAPABILITY SOURCE

Audit how current frontend obtains permissions.

Preferred:

```text
authenticated user's canonical permission set
```

If backend returns per-note capabilities, use them.

Do not invent permission names in frontend that differ from backend constants.

Document exact authority flow:

```text
backend permissions
→ auth/session/API projection
→ frontend action visibility
→ backend re-check on mutation
```

---

# 47. OWNERSHIP-DEPENDENT ACTIONS

Round 2B reportedly uses author + ADMIN override edit/delete policy.

Therefore frontend action visibility must account for ownership where possible.

Do not show Edit/Delete on every note merely because actor has generic update/delete permission if backend policy additionally requires authorship.

If frontend cannot determine ownership reliably, prefer conservative hiding or server-provided capabilities.

Document chosen approach.

---

# 48. ADMIN OVERRIDE

ADMIN may see actions according to Round 2B policy.

Do not implement a separate frontend-only ADMIN policy.

Prove runtime:

```text
ADMIN edits/deletes allowed note
```

and representative non-admin ownership behavior.

---

# 49. EXTERNAL ACTOR SAFETY

Do not expose INTERNAL Notes UI to PARTNER/BUYER surfaces in Round 2C.

If an external actor can manually navigate to a Platform URL, existing page security + Notes API security must deny access appropriately.

No note content leakage.

---

# 50. CUSTOMER 360 REGRESSION

Re-verify existing Customer 360 tabs/data:

```text
Overview
Orders
Bookings
Payments
Partners
Refunds
History
Notes
```

Use actual runtime tab names/order.

Existing clickable entity links must remain exact.

Existing sorting/filter behavior must remain intact.

Payment/Refund business context must remain intact.

---

# 51. PARTNER 360 REGRESSION

Re-verify existing Partner 360:

```text
Overview
Services
Orders
Bookings
Customers
Storefront
Notes
```

Use actual runtime tabs.

Existing deep links and table controls must remain intact.

---

# 52. ORDER / BOOKING / CATALOG REGRESSION

Notes integration must not regress:

```text
Order detail data
Booking detail data
Product detail data
breadcrumbs
Back/Forward
entity links
list sorting/filter URL state
```

---

# 53. BUSINESS DATE REGRESSION

Re-prove existing semantic dates remain correct:

```text
Payment date → paidAt
Refund date → processedAt
Order createdAt
Booking createdAt
Product createdAt
```

Notes UI must not substitute or overwrite these fields.

---

# 54. NOTE BUSINESS-STATE ISOLATION — BROWSER PROOF

For representative entities, perform:

```text
create note
edit note
delete note
```

and verify visible parent status/business dates remain unchanged.

Mandatory browser/API proof for:

```text
Order or Booking
Payment
Refund
```

where UI exposure exists.

If Payment/Refund Notes UI is deferred due to no clean detail surface, use API proof and document UI classification.

---

# 55. BROWSER RUNTIME AUTHORITY

Do not close Round 2C from unit tests/screenshots of static components only.

Use the same localhost/runtime the user observes.

Record:

```text
Git HEAD
origin/master
frontend PID
frontend CWD
frontend port
backend PID
backend CWD
backend port
API target
database
authenticated actor/role
```

---

# 56. BROWSER EVIDENCE — MINIMUM

Runtime-verify at least:

```text
Customer 360 → Notes
Partner 360 → Notes
Order detail → Notes
Booking detail → Notes
Product detail → Notes
```

For each implemented surface prove:

```text
load
empty or populated state
create
edit if permitted
delete if permitted
author
created time
edited time
refresh persistence
Back/Forward where relevant
```

Use representative records.

---

# 57. ERROR / ZERO RUNTIME PROOF

Mandatory runtime proof:

```text
authorized parent with 0 notes
→ honest empty state

forced/real 403
→ forbidden state, NOT zero

backend unavailable or simulated load failure
→ error state, NOT zero
```

Do not classify Round 2C complete without this.

---

# 58. RBAC BROWSER PROOF

At minimum:

```text
ADMIN
one permitted non-admin
one actor lacking mutation permission
```

Verify action presentation and backend result.

Where feasible, prove external actor denial through API/security runtime rather than exposing internal Platform UI.

---

# 59. DELETE CONFIRMATION PROOF

Browser evidence must show:

```text
click Delete
confirmation appears
Cancel leaves note intact
confirm removes note after server success
```

---

# 60. VALIDATION PROOF

Browser/API prove:

```text
empty/whitespace note rejected
>5000 rejected
valid multiline accepted
```

If textarea prevents >5000 client-side, backend validation still must remain proven from Round 2B regression.

---

# 61. XSS PROOF

Create a safe test note containing HTML/script-like text.

Browser must render it as inert text.

No script execution.

Do not use a destructive payload against shared/non-test environments.

---

# 62. PAGINATION PROOF

Use representative parent with enough notes.

Verify:

```text
page 1
page 2
stable order
no duplicate note
refresh
page state behavior
create while on page 2 has defined behavior
delete last item on a page reconciles cleanly
```

Document exact UX.

---

# 63. AUTOMATED FRONTEND TESTS

Add tests for shared Notes UI covering at minimum:

```text
loading
empty
populated
forbidden
error
create
create failure
edit
edit failure
delete confirmation cancel
delete success
delete failure
RBAC action visibility
ownership behavior
pagination
plain-text/XSS rendering
i18n key rendering
```

Use existing frontend test architecture.

---

# 64. BACKEND REGRESSION

Round 2C should require minimal/no backend changes.

If backend changes are necessary to expose missing safe DTO/capability data:

```text
keep narrow
explain why
add regression tests
```

Do not weaken Round 2B RBAC.

Run:

```text
Backend TSC
relevant Operational Notes tests
RBAC/E2E tests
Backend build
full backend suite where practical/canonical
```

Report pre-existing perf-harness instability separately if observed.

---

# 65. FRONTEND REGRESSION

Required:

```text
Frontend TSC
Frontend tests
Frontend build
```

Current accepted baseline includes:

```text
243/243
```

before Round 2C additions.

New legitimate tests should increase the exact count.

Report exact final count.

---

# 66. NO PLACEHOLDERS

No implemented Notes surface may contain:

```text
Coming soon
Unavailable
TODO
placeholder note
fake hardcoded note
```

If an entity surface is deferred because no current detail UX exists, classify it in the coverage matrix rather than showing a placeholder.

---

# 67. NO FAKE DATA

Runtime Notes must come from Round 2B API.

No static/demo arrays inside frontend components.

Test fixtures are allowed only inside automated tests.

---

# 68. UI CONSISTENCY

Reuse existing TravelHub:

```text
cards
buttons
inputs
spacing
typography
badges
error states
pagination
confirmation patterns
```

Do not introduce a disconnected visual design system.

---

# 69. NOTES ARE NOT A TABLE REQUIREMENT

Unlike shared entity lists, Operational Notes are chronological records.

Do not force them into a table solely because other pages use tables.

A chronological card/list/feed is acceptable and likely preferable.

Sorting controls are not required because canonical order is server-authoritative chronology.

---

# 70. REQUIRED UI STATE MATRIX

| State | API Result | UI | Create CTA | Existing Notes Visible? | PASS |
|---|---|---|---:|---:|---|
| Loading | pending | | | | |
| Empty authorized | 200, 0 items | | | | |
| Populated | 200, items | | | | |
| Forbidden | 403/canonical | | | | |
| Parent missing | 404 | | | | |
| Load error | 5xx/network | | | | |
| Create pending | mutation pending | | | | |
| Create failed | 4xx/5xx | | | | |
| Edit pending | mutation pending | | | | |
| Edit failed | 4xx/5xx | | | | |
| Delete confirm | local | | | | |
| Delete pending | mutation pending | | | | |
| Delete failed | 4xx/5xx | | | | |

No blanks.

---

# 71. REQUIRED COMPONENT MATRIX

| Concern | Shared Component/Hook/API | Customer | Partner | Order | Booking | Product | Other |
|---|---|---:|---:|---:|---:|---:|---|
| List | | | | | | | |
| Create | | | | | | | |
| Edit | | | | | | | |
| Delete | | | | | | | |
| Pagination | | | | | | | |
| Error states | | | | | | | |
| RBAC | | | | | | | |

No blanks.

---

# 72. REQUIRED RBAC UX MATRIX

Use actual Round 2B policy:

| Actor Case | Can Read UI | Add Visible | Edit Own | Edit Other | Delete Own | Delete Other | Server Re-check | PASS |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| ADMIN | | | | | | | | |
| Permitted non-admin author | | | | | | | | |
| Permitted non-admin non-author | | | | | | | | |
| Read-only internal actor | | | | | | | | |
| External actor | | | | | | | | |

No blanks.

---

# 73. REQUIRED ENTITY UI MATRIX

| Entity | Surface Exists | Notes Implemented | Entity Type Binding | Exact Entity ID | Runtime Proof | Deferred Reason |
|---|---:|---:|---|---:|---:|---|
| Customer | | | | | | |
| Partner | | | | | | |
| Order | | | | | | |
| Booking | | | | | | |
| Payment | | | | | | |
| Refund | | | | | | |
| Product | | | | | | |
| Fulfillment | | | | | | |
| Reservation | | | | | | |
| BuyerRequest | | | | | | |
| PartnerApplication | | | | | | |

No blanks. Use `N/A` with rationale where appropriate.

---

# 74. REQUIRED I18N MATRIX

| Key/Meaning | RU | AZ | EN | Runtime Verified |
|---|---|---|---|---|
| Notes | | | | |
| Add note | | | | |
| Edit | | | | |
| Delete | | | | |
| Save | | | | |
| Cancel | | | | |
| Empty | | | | |
| Forbidden | | | | |
| Load error | | | | |
| Retry | | | | |
| Created | | | | |
| Edited | | | | |
| Delete confirmation | | | | |
| Validation | | | | |

No raw keys.

---

# 75. REQUIRED RUNTIME MATRIX

| Surface | Route | Actor | Load | Create | Edit | Delete | Refresh | Back/Forward | PASS |
|---|---|---|---|---|---|---|---|---|---|
| Customer 360 | | | | | | | | | |
| Partner 360 | | | | | | | | | |
| Order | | | | | | | | | |
| Booking | | | | | | | | | |
| Product | | | | | | | | | |

Add rows for additional implemented surfaces.

---

# 76. REQUIRED REGRESSION MATRIX

| Gate | Result | Exact Count / Evidence | PASS |
|---|---|---|---|
| Backend TSC | | | |
| Operational Notes unit tests | | | |
| Operational Notes RBAC/E2E | | | |
| Backend full suite | | | |
| Backend build | | | |
| Frontend TSC | | | |
| Frontend Notes tests | | | |
| Frontend full tests | | | |
| Frontend build | | | |
| Customer 360 regression | | | |
| Partner 360 regression | | | |
| Orders regression | | | |
| Bookings regression | | | |
| Catalog regression | | | |

No blanks.

---

# 77. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_STEP_3.5_PLATFORM_CRM_OPERATIONAL_NOTES_ROUND_2C_PLATFORM_DETAIL_360_NOTES_UI_RUNTIME_UX_AUTHORITY_REPORT.md
```

Report actual implementation and runtime evidence.

---

# 78. ACCEPTANCE CRITERIA

VERDICT A requires ALL:

1. Starting SHA verified.
2. `ec2e65c` preserved.
3. `240fbe8` preserved.
4. `e0fe7bb` preserved.
5. `a13e280` preserved.
6. `8b9999f` preserved.
7. Round 2B full report inspected.
8. Missing Round 2B regression evidence, if any, resolved honestly.
9. All 11 entity UI surfaces audited.
10. UI Coverage Matrix complete.
11. No artificial detail page created solely for Notes.
12. Shared Notes frontend implementation created.
13. No duplicate page-specific Notes lifecycle.
14. Customer 360 Notes integrated.
15. Partner 360 Notes integrated.
16. Order detail Notes integrated.
17. Booking detail Notes integrated.
18. Product detail Notes integrated.
19. Payment UI correctly classified.
20. Refund UI correctly classified.
21. Fulfillment UI correctly classified.
22. Reservation UI correctly classified.
23. BuyerRequest UI correctly classified.
24. PartnerApplication UI correctly classified.
25. Exact entity type used for every Notes request.
26. Exact entity ID used for every Notes request.
27. No display-code-based parent binding.
28. List comes from Round 2B API.
29. Create comes from Round 2B API.
30. Edit comes from Round 2B API.
31. Delete comes from Round 2B API.
32. Server pagination used.
33. Stable server chronology preserved.
34. No client-side full-history pagination.
35. Author rendered safely.
36. Created date/time rendered.
37. Edited state/time rendered correctly.
38. Plain-text multiline rendering works.
39. No HTML execution.
40. XSS test passes.
41. Create textarea implemented.
42. 5000-char UX implemented.
43. Empty/whitespace UX handled.
44. Create pending state handled.
45. Create failure handled.
46. Edit mode implemented.
47. Edit failure preserves canonical note.
48. Delete confirmation implemented.
49. Delete cancel works.
50. Delete failure preserves note.
51. Deleted note disappears only after success.
52. RBAC-aware Add visibility implemented.
53. RBAC-aware Edit visibility implemented.
54. RBAC-aware Delete visibility implemented.
55. Ownership policy reflected in UX.
56. ADMIN override reflected from canonical authority.
57. No hardcoded role-only security substitute.
58. Backend still re-checks every mutation.
59. Loading distinct from empty.
60. Empty requires successful 200/zero.
61. Forbidden distinct from empty.
62. Error distinct from empty.
63. Retry behavior implemented where appropriate.
64. No note count/content leaked on forbidden.
65. Customer Notes tab deep link survives refresh.
66. Partner Notes tab deep link survives refresh.
67. Back/Forward works for 360 Notes tabs.
68. Notes pagination state does not corrupt other page state.
69. RU translations complete.
70. AZ translations complete.
71. EN translations complete.
72. No raw i18n keys.
73. Keyboard access works.
74. Textarea has accessible label.
75. Action buttons have accessible names.
76. Delete confirmation accessible.
77. Narrow/mobile layout verified.
78. Long content wraps safely.
79. Near-5000-char content does not break layout.
80. Existing Customer 360 tabs/data remain correct.
81. Existing Partner 360 tabs/data remain correct.
82. Order detail remains correct.
83. Booking detail remains correct.
84. Product detail remains correct.
85. Existing entity links remain exact.
86. Shared table controls remain unaffected.
87. Payment business context remains correct.
88. Refund business context remains correct.
89. Payment `paidAt` semantics remain correct.
90. Refund `processedAt` semantics remain correct.
91. Note create does not mutate parent business state.
92. Note edit does not mutate parent business state.
93. Note delete does not mutate parent business state.
94. Error/Zero runtime proof supplied.
95. RBAC browser/runtime proof supplied.
96. Pagination runtime proof supplied.
97. Delete confirmation runtime proof supplied.
98. Validation runtime proof supplied.
99. XSS runtime proof supplied.
100. Browser evidence uses actual observed localhost/runtime.
101. Runtime HEAD reported.
102. Runtime frontend CWD/PID/port reported.
103. Runtime backend CWD/PID/port reported.
104. API target/database reported.
105. Automated Notes frontend tests added.
106. Loading automated test passes.
107. Empty automated test passes.
108. Forbidden automated test passes.
109. Error automated test passes.
110. Create automated tests pass.
111. Edit automated tests pass.
112. Delete automated tests pass.
113. RBAC/ownership UI tests pass.
114. Pagination tests pass.
115. XSS/plain-text test passes.
116. Backend Round 2B security not weakened.
117. Backend TSC passes.
118. Operational Notes backend tests pass.
119. RBAC/E2E regression passes or exact known limitation is proven.
120. Backend build passes.
121. Full backend suite executed/reported according to canonical project practice.
122. No new failure hidden behind pre-existing perf waiver.
123. Frontend TSC passes.
124. Frontend full tests pass.
125. Frontend build passes.
126. Exact test counts reported.
127. No placeholder/fake Notes data.
128. No create-form initial-note integration started.
129. No Storefront Pro CRM work started.
130. No Marketplace Basic CRM work started.
131. No unrelated production refactor.
132. All required matrices complete.
133. Report created.
134. Commit created and pushed.
135. HEAD == origin/master.
136. No unresolved P0/P1 Notes UI/security/data-integrity defect remains.

---

# 79. REQUIRED FINAL RESPONSE FORMAT

Return:

```text
VERDICT:

PRECONDITION
Repository:
Branch:
Starting SHA:
ec2e65c preserved:
240fbe8 preserved:
e0fe7bb preserved:
a13e280 preserved:
8b9999f preserved:

ROUND 2B EVIDENCE CHECK
Backend unit:
Backend RBAC/E2E:
Backend full suite:
Backend build:
Frontend TSC:
Frontend tests:
Frontend build:
Missing evidence resolved:

UI COVERAGE MATRIX
...

SHARED NOTES IMPLEMENTATION
Component(s):
API client:
Types:
Capability source:
Ownership handling:

ENTITY UI MATRIX
...

CUSTOMER 360
Route:
Placement:
Tab URL:
Runtime result:

PARTNER 360
Route:
Placement:
Tab URL:
Runtime result:

ORDER
...

BOOKING
...

PRODUCT
...

PAYMENT
Classification:
Implementation/defer rationale:

REFUND
Classification:
Implementation/defer rationale:

FULFILLMENT
...

RESERVATION
...

BUYER REQUEST
...

PARTNER APPLICATION
...

NOTE UX
List:
Create:
Edit:
Delete:
Pagination:
Author:
Created:
Edited:

UI STATE MATRIX
...

RBAC UX MATRIX
...

I18N MATRIX
...

ACCESSIBILITY
...

RESPONSIVE
...

TEXT / XSS SAFETY
...

ERROR / ZERO RUNTIME PROOF
...

RBAC RUNTIME PROOF
...

PAGINATION RUNTIME PROOF
...

BUSINESS-STATE ISOLATION
Order/Booking:
Payment:
Refund:

RUNTIME MATRIX
...

REGRESSION MATRIX
...

RUNTIME AUTHORITY
Git HEAD:
origin/master:
Frontend PID:
Frontend CWD:
Frontend port:
Backend PID:
Backend CWD:
Backend port:
API target:
Database:
Actor/role:

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
Known pre-existing perf defect:

ROUND 2C STATUS:
NEXT CANONICAL ROUND:
```

---

# 80. VERDICT

Success only:

```text
VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM /
OPERATIONAL NOTES IMPLEMENTATION ROUND 2C /
PLATFORM DETAIL + CUSTOMER 360 + PARTNER 360 NOTES UI /
RBAC-AWARE CRUD + ERROR/ZERO BOUNDARY + I18N +
RUNTIME UX AUTHORITY FULLY IMPLEMENTED AND VERIFIED
```

Failure:

```text
VERDICT B — OPERATIONAL NOTES ROUND 2C /
PLATFORM NOTES UI / RBAC UX / RUNTIME AUTHORITY INCOMPLETE
```

No conditional VERDICT A.

---

# 81. NEXT CANONICAL ROUND

Only after Round 2C receives VERDICT A:

```text
PHASE 3 — STEP 3.5
OPERATIONAL NOTES IMPLEMENTATION

ROUND 2D
CREATE-FORM INITIAL NOTE INTEGRATION
+ ATOMIC ENTITY + NOTE RUNTIME CLOSURE
```

Round 2D will implement the previously accepted V2 requirement:

```text
optional "Примечание" textarea in applicable entity create flows
→ first OperationalNote
→ same transaction as entity creation
→ no partial success
```

Do NOT implement Round 2D here.

---

# 82. STOP

After implementation report and verdict:

```text
STOP
```

Do not continue into Round 2D.
