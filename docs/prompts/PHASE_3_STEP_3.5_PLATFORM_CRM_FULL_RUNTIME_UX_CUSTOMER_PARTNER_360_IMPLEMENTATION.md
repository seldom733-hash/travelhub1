# PHASE 3 — STEP 3.5 — PLATFORM CRM
## FULL RUNTIME / UX / CUSTOMER 360 / PARTNER 360 IMPLEMENTATION & REMEDIATION
## PLATFORM CONTEXT ONLY

---

# 1. PURPOSE

Continue and complete the PLATFORM CRM before further work on:

```text
STOREFRONT PRO CRM
MARKETPLACE BASIC CRM
Partner Workspace sidebar implementation
```

This prompt is an implementation/remediation gate, not documentation-only reconciliation.

Current canonical sequence:

```text
PLATFORM CRM
→ STOREFRONT PRO CRM
→ MARKETPLACE BASIC CRM
→ CRM DOMAIN FINAL CLOSURE
```

Do not start the later contexts automatically.

---

# 2. SCOPE

Platform CRM must become a complete operational CRM working center:

```text
PLATFORM CRM
│
├── Клиенты
│   └── Customer 360
│
└── Партнёры
    └── Partner 360
```

Important UX decision:

```text
Customer 360 is NOT a third top-level CRM tab.
Partner 360 is NOT a third/fourth top-level CRM tab.
```

They are detail workspaces reached from the corresponding entity list.

---

# 3. KNOWN CURRENT STATE

Previously established current implementation includes:

```text
Customer CRUD/search/pagination/status filter
Partner list/detail/search
Customer 360
PartnerCustomerRelation
CRM RBAC
RU/AZ/EN
Platform CRM access
```

Previously identified gaps include:

```text
Customer → Refunds not shown
CustomerHistory exists but is not surfaced in UI
Partner CRM surface is too shallow
Partner 360 requires completion/reconciliation
```

Current browser observation also showed:

```text
CRM
├── Клиенты
└── Партнёры
```

and the `Партнёры` table appeared too primitive, with fields similar to:

```text
код
имя
e-mail
тип
статус
```

At one point the Partners tab appeared empty.

Do not assume that observation still reflects current runtime. Verify it.

---

# 4. FIRST ACTION — RUNTIME + SOURCE INVENTORY

Before changing production code, inspect the actual current state.

Inventory:

```text
Platform CRM routes
CRM controller/service
Customer entities/models
CustomerHistory
Partner entities/models
SellerProfile
PartnerStorefront
PartnerCustomerRelation
Orders
Bookings
Payments
Refunds
Catalog/services
existing Customer 360 UI
existing Partner detail UI
permissions
i18n
pagination contracts
```

Report exact files and routes.

Do not design from memory when canonical implementation already exists.

---

# 5. PLATFORM CONTEXT ONLY

This prompt concerns:

```text
workspace = PLATFORM
```

Do NOT modify Storefront Pro CRM behavior except where a shared component change requires regression verification.

Do NOT expand Marketplace Basic CRM.

---

# 6. PLATFORM CRM INFORMATION ARCHITECTURE

Target:

```text
CRM
├── Клиенты
│   ├── list
│   ├── filters/search
│   └── Customer 360
│
└── Партнёры
    ├── list
    ├── filters/search
    └── Partner 360
```

Avoid unnecessary top-level tabs.

---

# 7. CLIENTS LIST

Audit and complete the customer table.

The table must expose enough information to make it operationally useful without becoming overloaded.

Determine fields from actual canonical data.

At minimum evaluate:

```text
customer identity/name
email/contact
status
orders count
bookings count
commercial/activity indicator
last activity / relevant date
```

Do not invent unsupported aggregates.

---

# 8. CLIENTS — SEARCH / FILTERS

Verify:

```text
search
status filter
other existing canonical filters
server-side scope
pagination
filtered total
URL/filter persistence where current project pattern supports it
```

Do not add decorative filters with no backend authority.

---

# 9. CLIENTS — PAGINATION STANDARD

Project-wide operational table standard:

```text
pageSize = 20
```

Required:

```text
0 → empty state
20 → one page
21 → two pages
filtered total
multi-page navigation
filters preserved across pages
```

---

# 10. CUSTOMER 360 — TARGET

Clicking a customer opens Customer 360.

Use the existing implementation and extend it rather than creating a parallel detail system.

Target areas should be reconciled against actual available data:

```text
Обзор
Заказы
Бронирования
Платежи
Возвраты
Связи
История
```

If current UI combines some of these appropriately, preserve good existing structure.

Do not create tabs merely to satisfy this list if the data belongs in a better existing section.

---

# 11. CUSTOMER 360 — OVERVIEW

Overview should answer quickly:

```text
Who is this customer?
What is their current status?
What commercial relationship do they have with TravelHub?
What recent/relevant activity exists?
```

Use canonical existing data.

Avoid duplicate metrics already visible elsewhere on the same screen.

---

# 12. CUSTOMER 360 — ORDERS

Show customer orders with:

```text
correct customer relation
status
amount/value where canonical
date
navigation to order detail
pagination if needed
```

Use Platform-authorized order scope.

---

# 13. CUSTOMER 360 — BOOKINGS

Show bookings with:

```text
booking identifier
status
service/date context
partner/service relation where useful
navigation to booking detail
```

Do not mix booking status and payment status semantically.

---

# 14. CUSTOMER 360 — PAYMENTS

Show canonical payment information.

Preserve distinction:

```text
Order status
≠
Booking status
≠
Payment status
≠
Refund status
```

---

# 15. CUSTOMER 360 — REFUNDS

Known gap:

```text
Customer → Refunds not shown
```

Implement/surface refunds if current canonical Refund relation supports customer attribution.

Required useful evidence may include:

```text
refund status
amount
request/creation date
related order/payment
navigation to canonical destination
```

Do not invent customer refund ownership if the schema does not support it.

If attribution is indirect, document exact join path.

---

# 16. CUSTOMER 360 — RELATIONS

Preserve existing PartnerCustomerRelation semantics.

For Platform CRM, relations may help answer:

```text
which partners has the customer interacted with?
what lifecycle/relation exists?
what source/context created the relationship?
```

Do not expose partner-private CRM notes to Platform unless current architecture explicitly authorizes that data.

Verify ownership semantics.

---

# 17. CUSTOMER 360 — HISTORY

Known current-state gap:

```text
CustomerHistory exists
but is not surfaced in UI
```

Audit what CustomerHistory actually records.

If suitable, expose a meaningful history/activity surface.

Do NOT pretend CustomerHistory is a complete unified activity timeline if it only contains a subset of events.

Label according to actual semantics.

---

# 18. HISTORY vs FUTURE UNIFIED TIMELINE

Distinguish:

```text
existing CustomerHistory
```

from any future:

```text
Unified Activity Timeline
```

If they are not equivalent, do not silently merge the concepts.

Future communications/event-stream work remains future.

---

# 19. CUSTOMER ERROR vs EMPTY STATE

Hard invariant:

```text
API ERROR ≠ ZERO RESULTS
```

Do not show:

```text
0
+
empty state
```

when the request failed.

Use existing application error conventions.

---

# 20. PARTNERS LIST — CURRENT DEFECT

The current Partner CRM list must not remain merely:

```text
код
имя
e-mail
тип
статус
```

if richer canonical operational data is already available.

The goal is not to add arbitrary columns.

The goal is to make the table useful for Platform CRM operations.

---

# 21. PARTNER DATA AUTHORITY

Before changing the Partners table, identify the canonical relationships among:

```text
User
Partner
SellerProfile
PartnerStorefront
services/catalog
orders
bookings
customers
payments
onboarding/status
```

Use actual repository/schema names.

Do not invent a new `Partner` aggregate if the project models it differently.

---

# 22. PARTNERS LIST — REQUIRED DESIGN METHOD

For every proposed visible column provide:

```text
UI label
business meaning
source entity/field/query
whether direct or derived
filter/sort support
```

Reject columns that cannot be supported reliably.

---

# 23. PARTNERS LIST — CANDIDATE OPERATIONAL DIMENSIONS

Evaluate against real data:

```text
partner/company identity
partner code/id
partner type/context
status
Storefront/Marketplace context
services count
orders/bookings activity
customer count
onboarding/verification state
last relevant activity
```

These are candidates, not mandatory fields.

Use only what current architecture supports.

---

# 24. PARTNERS LIST — EMPTY STATE

If Partners currently returns zero due to an API/query defect:

```text
fix the defect
```

Do not seed fake production data merely to make the screen look populated.

If runtime database genuinely contains no matching partners, prove that.

---

# 25. PARTNERS LIST — PAGINATION

Apply:

```text
pageSize = 20
server-side pagination
filtered total
multi-page navigation
```

Project-wide table standard applies.

---

# 26. PARTNERS LIST — SEARCH / FILTERS

At minimum verify current search.

Evaluate canonical filters such as:

```text
status
partner/storefront type
onboarding state
```

only where backend authority exists.

---

# 27. PARTNER 360

Clicking a partner must open a useful Platform-side Partner 360 workspace.

Do not build it by blindly copying Customer 360.

Partner 360 answers a different operational question:

```text
Who is this supplier/business?
What is its platform relationship?
What does it sell?
What operational/commercial activity exists?
What needs attention?
```

---

# 28. PARTNER 360 — DISCOVER BEFORE DESIGN

Before implementation inspect all existing partner detail surfaces.

There may already be:

```text
seller profile detail
onboarding detail
storefront detail
partner detail
catalog/service relations
orders/bookings views
```

Reuse canonical components/data where practical.

Do not create duplicate sources of truth.

---

# 29. PARTNER 360 — TARGET AREAS

Evaluate actual support for:

```text
Обзор
Профиль / Идентичность
Услуги
Заказы
Бронирования
Клиенты
Storefront / Каналы
История / activity
```

Finance may be included only to the extent current canonical implementation already supports it.

Do not implement future settlement/payout architecture here.

---

# 30. PARTNER 360 — OVERVIEW

Overview should summarize existing canonical partner facts without duplicating every detail tab.

Potential categories:

```text
identity
current status
partner/business type
Storefront state
service activity
commercial activity
operational alerts/status
```

Only use real data.

---

# 31. PARTNER 360 — PROFILE / IDENTITY

Reuse canonical SellerProfile/onboarding/identity information.

Do not duplicate editable forms if another module owns mutation.

CRM may link to the owning operational surface instead.

---

# 32. PARTNER 360 — SERVICES

Show the partner's services/catalog context.

Useful fields depend on actual catalog model.

Preserve navigation to canonical service detail.

---

# 33. PARTNER 360 — ORDERS

Show only orders belonging to that partner relationship.

Provide correct totals/pagination and canonical navigation.

---

# 34. PARTNER 360 — BOOKINGS

Show partner-related bookings with correct statuses and service dates.

Do not conflate upcoming, active, completed, cancelled semantics.

---

# 35. PARTNER 360 — CUSTOMERS

Platform may need to see customers commercially related to the partner.

Use canonical relationship/query.

Do not expose other partners' private CRM-only data.

---

# 36. PARTNER 360 — STOREFRONT / CHANNEL

If PartnerStorefront exists, show useful state such as:

```text
Storefront existence
status
entitlement status
channel/tier context
```

Use server-authoritative data.

Do not infer Pro from display name.

---

# 37. PARTNER 360 — FINANCE BOUNDARY

Do NOT implement future supplier settlement/balance/payout here.

Preserve architectural invariant:

```text
Customer Payment Terms
≠
Supplier Settlement Terms
≠
Supplier Payout
```

Future supplier finance remains governed by:

```text
S.1–S.19
```

If current CRM can link to existing payments/orders, that is allowed.

No fake:

```text
Available payout
Held balance
Next payout
Settlement forecast
```

until corresponding capability exists.

---

# 38. PARTNER 360 — HISTORY

If existing audit/history data supports partner history, expose it accurately.

Otherwise mark as a remaining gap.

Do not fabricate a unified timeline.

---

# 39. PARTNER ACTIONS

Inventory existing Platform-authorized partner actions.

Examples might include:

```text
open seller profile
open onboarding
open service
open order
open booking
```

Do not add destructive/status-changing actions without canonical permission and business rules.

---

# 40. CRM TABLE INFORMATION HIERARCHY

Apply the lesson from Decision Queue remediation:

```text
do not repeat the same fact
in header + badge + evidence + impact
```

For CRM:

```text
list row → concise operational summary
360 overview → high-value summary
detail tabs → full evidence
```

Avoid duplication.

---

# 41. TABLE COLUMN STANDARD

Every operational table must:

```text
show meaningful evidence
avoid hidden predicate semantics
use 20-row default
support pagination when >20
show filtered total
have honest empty/error states
```

---

# 42. PLATFORM RBAC

Audit Platform CRM permissions.

Previously reported CRM permissions existed.

Verify current permission names and actual enforcement.

Required:

```text
frontend visibility
+
backend authorization
```

Do not rely on hidden UI.

---

# 43. PLATFORM ROLE MATRIX

Verify which Platform roles can:

```text
read customers
read partners
read Customer 360
read Partner 360
perform CRM mutations
```

Do not broaden permissions merely to make tests pass.

Preserve canonical Safe Default Role Matrix.

---

# 44. DATA PRIVACY

Customer 360 and Partner 360 aggregate more information than list pages.

Verify that each field is appropriate for the authorized Platform role.

Do not expose:

```text
secrets
credentials
raw tokens
unnecessary personal addresses
private partner-only notes without authority
```

---

# 45. CROSS-ENTITY NAVIGATION

Required where canonical routes exist:

```text
Customer 360 → Order
Customer 360 → Booking
Customer 360 → Payment
Customer 360 → Refund

Partner 360 → Service
Partner 360 → Order
Partner 360 → Booking
Partner 360 → Customer
Partner 360 → Seller/Storefront operational surface
```

No dead buttons.

---

# 46. COUNTS MUST MATCH DESTINATIONS

If Customer/Partner 360 shows a count:

```text
Orders: N
Bookings: N
Refunds: N
Services: N
Customers: N
```

then opening the corresponding detail/list must reconcile to the same semantic predicate.

Do not repeat the Decision Queue count mismatch problem.

---

# 47. AGGREGATE SEMANTICS

For every aggregate document:

```text
predicate
scope
time range if any
distinct entity semantics
```

Example:

```text
customers count
```

must define whether it means:

```text
distinct customers
relations
orders with customers
```

---

# 48. URL / DEEP LINK

Customer 360 and Partner 360 must have stable deep-linkable routes where current application architecture supports it.

Refresh must preserve selected entity.

---

# 49. LOADING / ERROR / EMPTY

For every list/tab:

```text
loading
successful empty
successful data
error
forbidden
not found
```

must be distinguishable.

---

# 50. I18N

All visible CRM changes:

```text
RU
AZ
EN
```

Raw i18n keys = 0.

Do not hardcode Russian strings into components.

---

# 51. RESPONSIVE / EXISTING SHELL

Preserve current Platform left sidebar and Platform workspace shell.

This prompt does NOT implement Partner shared sidebar.

---

# 52. DO NOT IMPLEMENT A THIRD TOP-LEVEL "CUSTOMER 360" TAB

Explicit UX rule:

```text
CRM top-level:
Клиенты | Партнёры
```

Detail:

```text
Клиенты → Customer 360
Партнёры → Partner 360
```

---

# 53. DO NOT COPY PLATFORM CRM INTO PARTNER CRM

This prompt finishes Platform CRM.

Later prompts will separately define:

```text
Storefront Pro CRM
Marketplace Basic CRM
```

Do not preempt them.

---

# 54. OUT OF SCOPE

Do NOT start:

```text
Partner Shared Sidebar implementation
Storefront Pro CRM finalization
Marketplace Basic CRM finalization
Employees
Marketing
Omnichannel
Supplier Settlement / Balance / Payout
F.1–F.13
S.1–S.19
```

---

# 55. DATABASE CHANGES

Do not change DB schema unless an actual blocking deficiency is proven.

Prefer using existing canonical relations.

If a migration is genuinely required:

```text
document root cause
document why current schema cannot satisfy the requirement
keep migration minimal
```

No speculative schema redesign.

---

# 56. TESTS — CUSTOMER

Required focused coverage:

```text
customer list
search/filter
pagination
Customer 360 load
orders
bookings
payments
refunds
relations
history
error vs empty
authorization
```

Use applicable tests based on actual implementation.

---

# 57. TESTS — PARTNER

Required focused coverage:

```text
partner list
search/filter
pagination
Partner 360 load
services
orders
bookings
customers
Storefront/channel state
authorization
error vs empty
```

---

# 58. COUNT PARITY TESTS

Where aggregates are visible:

```text
visible count
=
destination semantic total
```

Add focused regression coverage where practical.

---

# 59. BUILD / STATIC GATES

Required:

```text
Backend TSC
Frontend TSC
Backend build
Frontend build
relevant backend tests
relevant frontend tests
```

Report exact counts.

---

# 60. BROWSER RUNTIME — PLATFORM CRM

Required real browser verification.

At minimum:

```text
CRM → Клиенты
CRM → Партнёры
Customer 360
Partner 360
```

Do not close solely from unit tests.

---

# 61. BROWSER — CLIENTS LIST

Verify:

```text
table loads
no raw API error
search works
filters work
20-row pagination works where total >20
row opens correct Customer 360
```

---

# 62. BROWSER — CUSTOMER 360

Verify each implemented area with real data where available:

```text
Overview
Orders
Bookings
Payments
Refunds
Relations
History
```

If dataset has zero for a valid category, prove successful zero rather than forcing seed data unless a test fixture is explicitly appropriate.

---

# 63. BROWSER — PARTNERS LIST

Verify:

```text
table loads
actual partners appear if DB contains them
operational columns are meaningful
search/filter works
pagination works
row opens Partner 360
```

---

# 64. BROWSER — PARTNER 360

Verify all implemented areas and cross-links.

No dead links/buttons.

---

# 65. VISUAL QUALITY

CRM should look like an operational Enterprise SaaS center consistent with existing Platform design.

Do not perform unrelated redesign.

Focus on:

```text
information hierarchy
readability
consistent badges
useful columns
clear tabs
clear empty/error states
no duplicate facts
```

---

# 66. REQUIRED BEFORE/AFTER MATRIX

Report:

| Surface | Before | After | Runtime PASS |
|---|---|---|---|
| Clients list | | | |
| Customer 360 Overview | | | |
| Customer Orders | | | |
| Customer Bookings | | | |
| Customer Payments | | | |
| Customer Refunds | | | |
| Customer Relations | | | |
| Customer History | | | |
| Partners list | | | |
| Partner 360 Overview | | | |
| Partner Services | | | |
| Partner Orders | | | |
| Partner Bookings | | | |
| Partner Customers | | | |
| Partner Storefront/Channel | | | |

---

# 67. REQUIRED DATA AUTHORITY MATRIX

| Visible fact | Source | Predicate/join | Direct/derived | Destination parity |
|---|---|---|---|---|

Include all new aggregates/important columns.

---

# 68. REQUIRED ROUTE MATRIX

| Surface | Frontend route | Backend API | Permission | Runtime HTTP |
|---|---|---|---|---|

---

# 69. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_STEP_3.5_PLATFORM_CRM_FULL_RUNTIME_UX_CUSTOMER_PARTNER_360_IMPLEMENTATION_REPORT.md
```

---

# 70. ARCHITECTURE / ROADMAP UPDATES

If implementation closes previously documented gaps, update canonical architecture/roadmap status accurately.

Do not mark:

```text
Storefront Pro CRM complete
Marketplace Basic CRM complete
CRM domain complete
```

from this prompt.

Only Platform CRM status may advance.

---

# 71. HARD ACCEPTANCE CRITERIA

VERDICT A only if ALL applicable criteria pass:

1. Current Platform CRM source/runtime inventoried.
2. Clients list is operational.
3. Clients search works.
4. Clients filters work where supported.
5. Clients use pageSize=20.
6. Clients filtered pagination works.
7. Client row opens Customer 360.
8. Customer 360 Overview is operational.
9. Customer Orders are operational.
10. Customer Bookings are operational.
11. Customer Payments are operational.
12. Customer Refunds gap is closed or proven impossible with an explicit blocking finding.
13. Customer Relations are operational.
14. CustomerHistory semantics are audited.
15. Customer History is surfaced accurately where supported.
16. No false claim of unified timeline.
17. Partners list runtime source is fixed/verified.
18. Partners list is not limited to an unjustifiably primitive identity-only view.
19. Every added Partner column has canonical data authority.
20. Partner search works.
21. Partner filters work where supported.
22. Partners use pageSize=20.
23. Partners filtered pagination works.
24. Partner row opens Partner 360.
25. Partner 360 Overview is operational.
26. Partner Profile/Identity context is operational or linked canonically.
27. Partner Services context is operational.
28. Partner Orders context is operational.
29. Partner Bookings context is operational.
30. Partner Customers context is operational where canonical relation exists.
31. Partner Storefront/channel context uses canonical authority.
32. No Pro inference from display name.
33. Future settlement/payout is NOT implemented.
34. Counts reconcile with destination semantics.
35. API error is never rendered as business zero.
36. Loading/error/empty/forbidden/not-found states are distinguishable.
37. Cross-entity links are not dead.
38. Platform RBAC is enforced server-side.
39. Frontend visibility respects permissions.
40. No unauthorized private partner CRM data leakage.
41. RU/AZ/EN PASS.
42. Raw i18n keys = 0.
43. Existing Platform sidebar does not regress.
44. Storefront Pro CRM regression check PASS.
45. Marketplace Basic CRM regression check PASS.
46. Partner Shared Sidebar implementation NOT started.
47. F.1–F.13 remain NOT STARTED.
48. S.1–S.19 remain NOT STARTED.
49. Backend TSC PASS.
50. Frontend TSC PASS.
51. Backend build PASS.
52. Frontend build PASS.
53. Relevant backend tests PASS.
54. Relevant frontend tests PASS.
55. Browser Clients list PASS.
56. Browser Customer 360 PASS.
57. Browser Partners list PASS.
58. Browser Partner 360 PASS.
59. Before/after matrix supplied.
60. Data authority matrix supplied.
61. Route/runtime HTTP matrix supplied.
62. Production changes are limited to Platform CRM/shared components required by it.
63. Unrelated files committed = 0.
64. Push complete.
65. HEAD == origin/master.

---

# 72. VERDICT

Success:

```text
VERDICT A — PHASE 3 STEP 3.5 PLATFORM CRM /
CLIENTS + CUSTOMER 360 + PARTNERS + PARTNER 360
FULL RUNTIME / UX / DATA AUTHORITY RECONCILED AND IMPLEMENTED
```

If material required functionality remains incomplete:

```text
VERDICT B — PLATFORM CRM REMAINS INCOMPLETE
```

No conditional VERDICT A.

---

# 73. FINAL RESPONSE FORMAT

```text
VERDICT:

ROOT CAUSES / GAPS:
1.
2.
3.

PLATFORM CRM:
Top-level tabs:
Clients route:
Partners route:

CLIENTS:
Columns:
Search:
Filters:
Pagination:
Total:
Error/empty behavior:

CUSTOMER 360:
Overview:
Orders:
Bookings:
Payments:
Refunds:
Relations:
History:
CustomerHistory semantics:
Cross-links:

PARTNERS:
Previous state:
Columns after:
Data authority:
Search:
Filters:
Pagination:
Total:
Empty/error behavior:

PARTNER 360:
Overview:
Profile/Identity:
Services:
Orders:
Bookings:
Customers:
Storefront/Channel:
History:
Cross-links:
Finance boundary:

COUNT PARITY:
Customer:
Partner:

RBAC:
Platform roles:
Server enforcement:
Privacy findings:

I18N:
RU:
AZ:
EN:
Raw keys:

BROWSER EVIDENCE:
Clients:
Customer 360:
Partners:
Partner 360:

Before/after matrix:
Data authority matrix:
Route/HTTP matrix:

Backend TSC:
Frontend TSC:
Backend build:
Frontend build:
Backend tests:
Frontend tests:

Platform sidebar regression:
Storefront Pro CRM regression:
Marketplace Basic CRM regression:

Production code changed:
DB schema changed:
Migration:
Files changed:

Platform CRM status:
Storefront Pro CRM status:
Marketplace Basic CRM status:
CRM domain status:
Partner Shared Sidebar implementation status:
F.1–F.13:
S.1–S.19:

Report:
Commit:
HEAD:
origin/master:
HEAD == origin/master:
Unrelated files:

Remaining findings:
Next canonical stage:
```

---

# 74. STOP

After the report:

```text
STOP
```

Do NOT automatically begin Storefront Pro CRM.

We will review and visually verify Platform CRM first.
