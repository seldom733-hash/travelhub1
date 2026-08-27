# PHASE 3 — SHARED TABLE CONTROLS
## ROUND 2A — MISSING FILTER COVERAGE / COMPOSITION / RUNTIME CLOSURE
## PROJECT-WIDE OPERATIONAL TABLE FILTERS — COMPLETION REMEDIATION

---

# 1. STATUS

Previous implementation:

```text
PHASE 3 — Shared Table Controls Round 2
Commit: 85c73a4
Reported verdict: VERDICT A
```

Accepted fixes from that commit:

```text
CRM Customers:
- restored missing "Тип клиента" header
- customerType filtering: PERSON / COMPANY
- status filtering

CRM Partners:
- status filtering

Users:
- status filtering

Orders:
- "Дата отмены" sorting corrected:
  createdAt ❌
  cancelledAt ✅
```

These fixes MUST be preserved.

However the Round 2 prompt required PROJECT-WIDE filtering coverage and runtime composition proof.

The supplied report did NOT prove or implement the complete required scope.

Therefore current qualification is:

```text
VERDICT B — SHARED TABLE CONTROLS ROUND 2 INCOMPLETE
```

This Round 2A is a completion/remediation round.

Do NOT revert `85c73a4`.
Do NOT redesign working sorting.
Do NOT start Operational Notes / Comments.
Do NOT start Storefront Pro CRM.

---

# 2. PURPOSE

Complete the missing Shared Table Controls contract across current operational tables:

```text
Search
+
Filters
+
Sorting
+
Pagination
+
URL State
```

Required coverage:

```text
CRM Customers
CRM Partners

Customer 360:
- Orders
- Bookings
- Payments
- Partners
- Refunds

Partner 360:
- Services
- Orders
- Bookings
- Customers

Platform:
- Orders
- Bookings
- Users
```

The task is NOT satisfied by adding one Status dropdown to a few pages.

Each table must be audited and given all useful filters supported by canonical data.

---

# 3. PRESERVE ROUND 2 FIXES

Regression-protect:

```text
CRM Customers:
Код | Имя | Email | Тип клиента | Статус

Customer Type:
sortable
filterable
canonical PERSON / COMPANY semantics

Orders:
Дата отмены sorting → cancelledAt

CRM Partners:
status filter

Users:
status filter
```

Do not regress these.

---

# 4. FIRST ACTION — GAP AUDIT

Before implementation, compare actual runtime/source against the original Round 2 required matrix.

For every table report:

```text
search exists?
filters currently exist?
which filters?
sort exists?
pagination exists?
URL state exists?
backend filter support exists?
missing useful canonical filters?
```

Do not infer completion from shared components existing in source.

---

# 5. REQUIRED GAP MATRIX

Fill BEFORE implementation:

| Table | Search | Current Filters | Missing Filters | Sort | Pagination | URL State | Backend Support |
|---|---|---|---|---|---|---|---|
| CRM Customers | | | | | | | |
| CRM Partners | | | | | | | |
| Customer Orders | | | | | | | |
| Customer Bookings | | | | | | | |
| Customer Payments | | | | | | | |
| Customer Partners | | | | | | | |
| Customer Refunds | | | | | | | |
| Partner Services | | | | | | | |
| Partner Orders | | | | | | | |
| Partner Bookings | | | | | | | |
| Partner Customers | | | | | | | |
| Platform Orders | | | | | | | |
| Platform Bookings | | | | | | | |
| Platform Users | | | | | | | |

No blank rows.

---

# 6. FILTER DESIGN PRINCIPLE

For each table, expose filters for fields that are:

```text
structured
business-relevant
useful for narrowing results
canonically represented in backend
safe to query server-side
```

Do NOT add meaningless filters simply to increase filter count.

But do NOT omit an obvious structured business dimension merely because the page previously lacked a filter.

---

# 7. EVERY IN-SCOPE TABLE REQUIRES FILTER CONTROLS

Every table in this Round must have an above-table control area.

At minimum it may contain:

```text
Search
Filters
Clear filters
```

depending on the table.

A table with only search but no meaningful structured filter must be explicitly justified in the report.

For the listed operational tables, assume useful structured filters exist until source audit proves otherwise.

---

# 8. SHARED QUERY CONTRACT

Applicable state:

```text
search
filters
sortBy
sortDirection
page
pageSize
tab
```

must compose.

Do not maintain mutually destructive state handlers.

---

# 9. URL CONTRACT

Applicable controls must be represented in URL.

Example:

```text
/app/orders
?status=CONFIRMED
&paymentStatus=PAID
&dateFrom=2026-08-01
&dateTo=2026-08-31
&sortBy=cancelledAt
&sortDirection=desc
&page=2
&pageSize=20
```

For 360 tabs:

```text
/app/crm/customers/:id
?tab=payments
&status=CAPTURED
&dateFrom=...
&sortBy=paymentDate
&sortDirection=desc
&page=2
```

Sorting/filtering must NOT remove `tab`.

---

# 10. STATE TRANSITIONS

Filter change:

```text
preserve search
preserve sort
update filters
page=1
```

Search change:

```text
preserve filters
preserve sort
page=1
```

Sort change:

```text
preserve search
preserve filters
replace previous sort
page=1
```

Page change:

```text
preserve search
preserve filters
preserve sort
preserve tab
```

Clear filters:

```text
remove filters
preserve search
preserve sort
page=1
```

Use this contract consistently unless an existing canonical behavior requires otherwise; document any exception.

---

# 11. SERVER-SIDE AUTHORITY

Required order:

```text
authorization / tenant scope
→ search
→ filters
→ sort
→ pagination
```

Forbidden:

```text
fetch 20 rows
→ frontend filter 20 rows
```

Forbidden:

```text
fetch 20 rows
→ frontend sort 20 rows
```

All large/paginated operational datasets must use server-side controls.

---

# 12. CRM CUSTOMERS — COMPLETE FILTER SET

Already implemented:

```text
Customer Type
Status
```

Audit and add if canonical/useful:

```text
Created date range
Country
Segment
```

Do not invent fields.

Customer Type remains:

```text
sortable + filterable
```

---

# 13. CRM CUSTOMER TYPE REPRESENTATIVE DATA

Current proof reported:

```text
PERSON: 241
COMPANY: 0
```

This proves parameter handling but does NOT provide representative two-type browser behavior.

Determine whether:

```text
COMPANY is a valid production customer type
```

If yes, ensure representative development/test data contains at least a small number of COMPANY customers without corrupting existing production semantics.

Do NOT mutate production-like canonical records arbitrarily.

Prefer deterministic seed/fixture data.

Required browser proof should ideally include both types.

If representative seed modification is unsafe/out of scope, report this explicitly and prove COMPANY behavior via isolated test fixture/API test instead.

---

# 14. CRM PARTNERS — COMPLETE FILTER SET

Already implemented:

```text
Status
```

Audit and add where canonical/useful:

```text
Country
Partner type
Tier / plan
Created date range
Storefront status
```

Only actual model fields may be used.

---

# 15. CUSTOMER 360 — ORDERS

Audit and implement useful filters.

Expected candidates:

```text
Status
Partner
Created date range
Amount range
Payment status if represented at order level
```

All filtering remains scoped to the current customer.

---

# 16. CUSTOMER 360 — BOOKINGS

Expected candidates:

```text
Status
Partner
Created date range
Service date range
Amount range if canonical
```

Do not confuse:

```text
createdAt
```

with:

```text
service date
```

---

# 17. CUSTOMER 360 — PAYMENTS

Expected candidates:

```text
Payment status
Payment date range
Order
```

Critical business-date authority:

```text
Payment Date
→ paidAt
```

NOT `createdAt`.

Pending/unpaid records with `paidAt=NULL` remain discoverable through Status rather than fake dates.

---

# 18. CUSTOMER 360 — REFUNDS

Expected candidates:

```text
Refund status
Refund date range
Order
Payment
```

Critical business-date authority:

```text
Refund Date
→ processedAt
```

NOT request `createdAt`.

Requested/approved but unprocessed refunds with `processedAt=NULL` remain discoverable through status.

---

# 19. CUSTOMER 360 — PARTNERS

This table represents commercial relationship aggregates.

Audit useful filters such as:

```text
Partner
Last activity range
relationship/customer status only if canonical
```

Do not invent a fake relationship status.

Preserve transaction-derived relationship semantics.

---

# 20. PARTNER 360 — SERVICES

Expected candidates:

```text
Service/Product status
Service/Product type
Created date range
```

Use actual model terminology.

All results remain scoped to current partner.

---

# 21. PARTNER 360 — ORDERS

Expected candidates:

```text
Status
Customer
Created date range
Amount range
Payment status if canonical
```

All results remain scoped to current partner.

---

# 22. PARTNER 360 — BOOKINGS

Expected candidates:

```text
Status
Customer
Created date range
Service date range
Amount range if canonical
```

---

# 23. PARTNER 360 — CUSTOMERS

Expected candidates:

```text
Customer type
Last activity range
Status if canonical
```

Do not invent status if commercial-customer aggregate has none.

Preserve distinct commercial-customer derivation.

---

# 24. PLATFORM ORDERS — REQUIRED FILTERS

Round 2 report did not prove Orders filters.

Audit and implement all useful canonical filters, expected at minimum:

```text
Order status
Payment status
Created date range
Cancellation date range if useful/canonical
Partner
Customer
Amount range
```

Do not automatically implement every candidate if source semantics reject it; report reason.

---

# 25. PLATFORM ORDERS — CANCELLATION AUTHORITY

Preserve Round 2 correction:

```text
Дата отмены
→ cancelledAt
```

If filtering by cancellation date is exposed:

```text
cancelledFrom
cancelledTo
→ cancelledAt
```

Do not map it to `createdAt`.

---

# 26. PLATFORM BOOKINGS — REQUIRED FILTERS

Round 2 report did not prove Booking filters.

Expected candidates:

```text
Booking status
Created date range
Service date range
Partner
Customer
Amount range
```

Implement based on actual model.

---

# 27. PLATFORM USERS — COMPLETE FILTER SET

Already implemented:

```text
Status
```

Audit and add where canonical/useful:

```text
Role
Created date range
Last login/activity range
User type if real
```

Role is an obvious structured dimension if Users table contains canonical role data.

Do not filter by translated role label.

Use role code/ID.

---

# 28. ENTITY FILTERS

For:

```text
Partner
Customer
Order
Payment
Service
```

use canonical IDs in API/URL.

UI displays readable labels.

Prefer searchable selectors if entity cardinality is large.

Do not create huge static dropdowns with hundreds/thousands of entities.

---

# 29. ENUM FILTERS

For finite states/types:

```text
Status
Customer Type
Payment Status
Refund Status
Role where finite
```

use canonical enum/code values in API.

Localize only display labels.

---

# 30. DATE RANGE FILTERS

Use explicit canonical parameters.

Examples:

```text
createdFrom
createdTo

serviceFrom
serviceTo

paidFrom
paidTo

processedFrom
processedTo

cancelledFrom
cancelledTo
```

Actual parameter names may differ, but semantics must be unambiguous.

Define timezone/boundary handling consistently.

---

# 31. AMOUNT RANGE FILTERS

Where supported:

```text
amountMin
amountMax
```

must be numeric.

Validate:

```text
amountMin <= amountMax
```

Mixed-currency limitations must be documented if relevant.

---

# 32. MULTI-FILTER SEMANTICS

Multiple different filter dimensions combine using AND.

Example:

```text
status=ACTIVE
AND
customerType=PERSON
```

Within a multi-select single dimension, if multi-select is implemented, explicitly document whether values use OR semantics.

Do not accidentally OR unrelated filter dimensions.

---

# 33. SEARCH + FILTER

Search must operate within the filtered authorized dataset.

Conceptually:

```text
scope
AND filters
AND search predicate
```

Do not let search reset filters.

---

# 34. SORT + FILTER

Sort applies to the filtered result.

Required:

```text
filter
→ sort complete filtered result
→ paginate
```

Changing sort must not clear filters.

---

# 35. PAGINATION + FILTER

Page navigation must preserve all active filters.

For datasets >20, browser-prove:

```text
filter active
sort active
page 1
→ page 2
```

with filter and arrow still active.

---

# 36. REFRESH / BACK / FORWARD

Required browser behavior:

```text
apply filter
apply second filter
sort
go page 2
refresh
```

State persists.

Back/Forward must restore prior URL/query state.

---

# 37. CLEAR FILTERS

Provide a clear action.

Required:

```text
filters removed
search preserved
sort preserved
page=1
```

unless the project already has an explicitly named "Reset all" control with broader semantics.

---

# 38. FILTERED EMPTY STATE

Example:

```text
Customer Type = COMPANY
```

if zero rows:

```text
Нет данных по выбранным фильтрам
```

Do not show a misleading generic "CRM has no customers" state.

---

# 39. INVALID FILTERS

Backend validation required for applicable:

```text
invalid enum
invalid UUID
invalid date
invalid number
min > max
unknown filter key
```

No crashes.

No arbitrary query-field injection.

---

# 40. STRUCTURAL PARITY RE-AUDIT

Round 2 fixed CRM Customer header parity.

Now audit ALL in-scope tables:

```text
header count == body cell count
header order == body semantic order
```

Required tables:

```text
CRM Customers
CRM Partners
Customer Orders
Customer Bookings
Customer Payments
Customer Partners
Customer Refunds
Partner Services
Partner Orders
Partner Bookings
Partner Customers
Platform Orders
Platform Bookings
Platform Users
```

Fix straightforward table-header regressions found.

---

# 41. FILTER BAR VISUAL CONSISTENCY

All operational tables should use a consistent visual pattern above the table.

Do not make every page visually identical if controls differ.

But preserve common:

```text
spacing
control height
labels/placeholders
clear action
responsive wrapping
```

Prefer shared primitives.

---

# 42. DO NOT BUILD A GIANT TABLE FRAMEWORK

This Round requires a shared CONTRACT, not necessarily one monolithic universal table component.

Reuse small primitives where appropriate:

```text
FilterBar
FilterSelect
DateRange
EntitySelector
ClearFilters
SortableHeader
```

Avoid risky broad rewrites.

---

# 43. PERFORMANCE

High-volume current datasets include at least:

```text
Orders > 1500
Bookings > 600
```

Inspect filter query efficiency.

Add indexes only when justified by actual query patterns/schema.

Do not blindly index every filterable field.

---

# 44. SECURITY / WORKSPACE SCOPE

Filtering must never change:

```text
RBAC
tenant scope
workspace scope
partner scope
ownership constraints
```

Manipulating URL filters must not expose otherwise inaccessible records.

---

# 45. REQUIRED POST-IMPLEMENTATION COVERAGE MATRIX

| Table | Search | Filters Implemented | Sort | Pagination | URL State | Server-side | Browser PASS |
|---|---|---|---|---|---|---|---|
| CRM Customers | | | | | | | |
| CRM Partners | | | | | | | |
| Customer Orders | | | | | | | |
| Customer Bookings | | | | | | | |
| Customer Payments | | | | | | | |
| Customer Partners | | | | | | | |
| Customer Refunds | | | | | | | |
| Partner Services | | | | | | | |
| Partner Orders | | | | | | | |
| Partner Bookings | | | | | | | |
| Partner Customers | | | | | | | |
| Platform Orders | | | | | | | |
| Platform Bookings | | | | | | | |
| Platform Users | | | | | | | |

No blank rows.

---

# 46. REQUIRED FILTER SEMANTICS MATRIX

For EVERY implemented filter:

| Table | UI Label | URL/API Param | Canonical Field/Relation | Control Type | Values/Range | PASS |
|---|---|---|---|---|---|---|
| | | | | | | |

No generic statements such as "filters added".

---

# 47. REQUIRED STRUCTURAL PARITY MATRIX

| Table | Header Count | Body Cell Count | Semantic Order Match | PASS |
|---|---:|---:|---|---|
| CRM Customers | | | | |
| CRM Partners | | | | |
| Customer Orders | | | | |
| Customer Bookings | | | | |
| Customer Payments | | | | |
| Customer Partners | | | | |
| Customer Refunds | | | | |
| Partner Services | | | | |
| Partner Orders | | | | |
| Partner Bookings | | | | |
| Partner Customers | | | | |
| Platform Orders | | | | |
| Platform Bookings | | | | |
| Platform Users | | | | |

---

# 48. REQUIRED BROWSER PROOF — CRM CUSTOMERS

Prove:

```text
Код | Имя | Email | Тип клиента | Статус
```

Then:

```text
Тип клиента sorting ASC
Тип клиента sorting DESC

Тип клиента filter PERSON
Тип клиента filter COMPANY
Status filter

Customer Type + Status together
Clear filters
```

Show URL changes.

---

# 49. REQUIRED BROWSER PROOF — PLATFORM ORDERS

Prove at least:

```text
Status filter
Payment Status filter
one date-range filter
one entity/range filter if implemented
filter + sort
page 2 preserves controls
```

Also prove:

```text
Дата отмены sorting → cancelledAt
```

remains correct.

---

# 50. REQUIRED BROWSER PROOF — PLATFORM BOOKINGS

Prove at least:

```text
Status filter
Service-date or Created-date filter
filter + sort
page 2 persistence
```

---

# 51. REQUIRED BROWSER PROOF — PLATFORM USERS

Prove:

```text
Status
Role if canonical
date/activity filter if implemented
filter + sort
page 2 persistence
```

Users total was reported as 54, so cross-page behavior should normally be testable unless runtime data changed.

---

# 52. REQUIRED BROWSER PROOF — CUSTOMER 360

For each tab with implemented filters:

```text
visible filter control
filter changes rows/total
tab remains selected
sort remains compatible
URL contains tab + filter
```

At minimum prove one real filter on each applicable tab:

```text
Orders
Bookings
Payments
Refunds
Partners
```

If a tab genuinely has no meaningful canonical filter, document why.

---

# 53. REQUIRED BROWSER PROOF — PARTNER 360

Same standard for:

```text
Services
Orders
Bookings
Customers
```

Current partner context must remain fixed.

---

# 54. REQUIRED COMPOSITION PROOF

On one table with >20 records:

```text
1. apply Filter A
2. apply Filter B
3. apply sorting
4. go page 2
5. refresh
6. Back
7. Forward
8. clear filters
```

Record URL and total after each meaningful transition.

---

# 55. REQUIRED MULTI-FILTER PROOF

Prove two dimensions combine using AND.

Example using actual available data:

```text
status=X
AND
type=Y
```

Show:

```text
count(Filter A)
count(Filter B)
count(Filter A + B)
```

Combined result must satisfy both predicates.

---

# 56. REQUIRED BUSINESS-DATE PROOF

Payment:

```text
payment date filter/sort → paidAt
```

Refund:

```text
refund date filter/sort → processedAt
```

Order cancellation:

```text
cancellation date filter/sort → cancelledAt
```

No fallback to `createdAt`.

---

# 57. FRONTEND TESTS

Add/update integration tests covering actual pages/components:

```text
filter updates URL
filter resets page
filter preserves sort
sort preserves filters
page preserves filters
tab preserved in 360
search + filter
clear filters
multi-filter
customer type
role/status where applicable
filtered empty
error != empty
```

Do not only test filter primitives in isolation.

---

# 58. BACKEND TESTS

Add/update tests for actual endpoints:

```text
single filter
multiple filters
filter + search
filter + sort
filter + pagination
enum validation
UUID validation
date validation
range validation
scope preservation
business-date mapping
```

---

# 59. SORTING REGRESSION

Verify:

```text
CRM Customers
CRM Partners
Customer 360
Partner 360
Platform Orders
Platform Bookings
Platform Users
```

still support the accepted single-column sorting contract.

Specifically:

```text
Payment → paidAt
Refund → processedAt
Order cancellation → cancelledAt
```

---

# 60. DETAIL NAVIGATION REGRESSION

Filters must not break exact entity links:

```text
Customer 360
Partner 360
Order detail
Booking detail
Service detail
```

---

# 61. I18N

All visible filter UI:

```text
RU
AZ
EN
```

including:

```text
labels
options
placeholders
clear action
filtered-empty message
```

Raw keys = 0.

---

# 62. BUILD / TEST GATES

Required:

```text
Backend TSC
Backend tests
Backend build

Frontend TSC
Frontend tests
Frontend build
```

Report exact test counts.

---

# 63. RUNTIME AUTHORITY

Report:

```text
Repository path
Branch
Starting SHA = 85c73a4 or actual descendant
Final SHA
origin/master
Frontend PID/CWD/port
Backend PID/CWD/port
API target
```

Browser proof must be from the same localhost runtime observed by the user.

---

# 64. NO VERDICT A FROM PARTIAL FILTER COVERAGE

Forbidden:

```text
"We added filters to CRM Customers, Partners and Users"
→ VERDICT A
```

Round 2A exists specifically to close missing coverage.

Every row in the required coverage matrix must be:

```text
implemented
```

or:

```text
explicitly audited as N/A with concrete business/schema reason
```

No silent omissions.

---

# 65. ACCEPTANCE CRITERIA

VERDICT A only if all applicable items pass:

1. Starting commit preserves `85c73a4` fixes.
2. Pre-implementation Gap Matrix supplied.
3. CRM Customers audited.
4. CRM Partners audited.
5. Customer Orders audited.
6. Customer Bookings audited.
7. Customer Payments audited.
8. Customer Partners audited.
9. Customer Refunds audited.
10. Partner Services audited.
11. Partner Orders audited.
12. Partner Bookings audited.
13. Partner Customers audited.
14. Platform Orders audited.
15. Platform Bookings audited.
16. Platform Users audited.
17. Every table has filter controls or explicit justified N/A.
18. Search/filter/sort/page compose.
19. URL state contains applicable controls.
20. Filter change resets page=1.
21. Search change resets page=1.
22. Sort change resets page=1.
23. Pagination preserves filters.
24. Pagination preserves search.
25. Pagination preserves sorting.
26. 360 pagination/sort/filter preserves tab.
27. Clear filters works.
28. Clear filters preserves sort.
29. Filters are server-side.
30. Sorting remains server-side.
31. Filtering occurs before pagination.
32. Sorting occurs before pagination.
33. No client-only filtering of paginated rows.
34. Enum filters use canonical values.
35. Entity filters use canonical IDs.
36. Date filters use canonical timestamps.
37. Amount ranges are numeric.
38. Multiple dimensions combine with AND.
39. Invalid enums handled safely.
40. Invalid UUIDs handled safely.
41. Invalid dates handled safely.
42. Invalid ranges handled safely.
43. Filters do not broaden RBAC/workspace scope.
44. CRM Customer Type header remains restored.
45. Customer Type remains sortable.
46. Customer Type remains filterable.
47. Customer Type + Status composition proven.
48. Representative COMPANY behavior proven or explicit isolated-fixture evidence supplied.
49. CRM Partner useful filters completed/audited.
50. Customer Orders useful filters completed/audited.
51. Customer Bookings useful filters completed/audited.
52. Customer Payments useful filters completed/audited.
53. Customer Partners useful filters completed/audited.
54. Customer Refunds useful filters completed/audited.
55. Partner Services useful filters completed/audited.
56. Partner Orders useful filters completed/audited.
57. Partner Bookings useful filters completed/audited.
58. Partner Customers useful filters completed/audited.
59. Platform Orders useful filters completed/audited.
60. Platform Bookings useful filters completed/audited.
61. Platform Users useful filters completed/audited.
62. Users Role filter implemented if canonical.
63. Payment date authority = paidAt.
64. Refund date authority = processedAt.
65. Order cancellation authority = cancelledAt.
66. Filtered empty != API error.
67. Loading != empty.
68. Race safety preserved.
69. Structural parity PASS for all listed tables.
70. Filter Coverage Matrix supplied with no blanks.
71. Filter Semantics Matrix supplied.
72. Structural Parity Matrix supplied.
73. CRM Customers browser proof supplied.
74. Orders browser proof supplied.
75. Bookings browser proof supplied.
76. Users browser proof supplied.
77. Customer 360 browser proof supplied.
78. Partner 360 browser proof supplied.
79. Multi-filter proof supplied.
80. Composition proof supplied.
81. Refresh persistence proven.
82. Back persistence proven.
83. Forward persistence proven.
84. Direct URL reproduction proven.
85. Sorting regression PASS.
86. Detail navigation regression PASS.
87. Backend TSC PASS.
88. Backend tests PASS.
89. Backend build PASS.
90. Frontend TSC PASS.
91. Frontend tests PASS.
92. Frontend build PASS.
93. Raw i18n keys = 0.
94. Operational Notes not started.
95. Storefront Pro CRM not started.
96. Unrelated files = 0.
97. Commit pushed.
98. HEAD == origin/master.
99. Browser evidence from same localhost runtime observed by user.

---

# 66. VERDICT

Success:

```text
VERDICT A — PHASE 3 SHARED TABLE CONTROLS ROUND 2A /
MISSING FILTER COVERAGE /
PROJECT-WIDE OPERATIONAL FILTERING /
FILTER + SEARCH + SORT + PAGINATION + URL COMPOSITION /
RUNTIME CLOSURE
FULLY IMPLEMENTED AND BROWSER-VERIFIED
```

Failure:

```text
VERDICT B — SHARED TABLE CONTROLS FILTER COVERAGE / COMPOSITION STILL INCOMPLETE
```

No conditional VERDICT A.

---

# 67. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_SHARED_TABLE_CONTROLS_ROUND_2A_FILTER_COVERAGE_RUNTIME_CLOSURE_REPORT.md
```

---

# 68. FINAL RESPONSE FORMAT

```text
VERDICT:

PRECONDITION:
Starting SHA:
Round 2 fixes preserved:

ROOT GAP:
Why previous Round 2 reported VERDICT A with partial coverage:
Missing tables discovered:

PRE-IMPLEMENTATION GAP MATRIX:
...

SHARED QUERY CONTRACT:
Search:
Filters:
Sort:
Pagination:
URL:
Tab preservation:

FILTER COVERAGE MATRIX:
...

FILTER SEMANTICS MATRIX:
...

STRUCTURAL PARITY MATRIX:
...

CRM CUSTOMERS:
Filters:
Customer Type:
Status:
Representative PERSON/COMPANY evidence:
Sort regression:
Browser evidence:

CRM PARTNERS:
Filters:
Browser evidence:

CUSTOMER 360:
Orders:
Bookings:
Payments:
Partners:
Refunds:
Browser evidence:

PARTNER 360:
Services:
Orders:
Bookings:
Customers:
Browser evidence:

PLATFORM ORDERS:
Filters:
Cancellation date authority:
Browser evidence:
Cross-page evidence:

PLATFORM BOOKINGS:
Filters:
Browser evidence:
Cross-page evidence:

PLATFORM USERS:
Filters:
Role:
Status:
Browser evidence:
Cross-page evidence:

COMPOSITION:
Filter A:
Filter B:
Combined:
Sort:
Page 2:
Refresh:
Back:
Forward:
Clear:
URLs:

BUSINESS DATES:
Payment:
Refund:
Order cancellation:

SECURITY / VALIDATION:
RBAC/scope:
Invalid enum:
Invalid UUID:
Invalid date:
Invalid range:

SORT REGRESSION:
CRM:
Orders:
Bookings:
Users:

DETAIL LINK REGRESSION:
...

RUNTIME:
Repository:
Branch:
Starting SHA:
Final SHA:
origin/master:
Frontend PID/CWD/port:
Backend PID/CWD/port:
API target:

Backend TSC:
Backend tests:
Backend build:
Frontend TSC:
Frontend tests:
Frontend build:

Production files changed:
Unrelated files:
Commit:
HEAD:
origin/master:
HEAD == origin/master:

Report:
Remaining findings:
Next canonical stage:
```

---

# 69. STOP

After report:

```text
STOP
```

Do NOT start Operational Notes / Comments.
Do NOT start Storefront Pro CRM.

Shared Table Controls Round 2 is closed only when the missing project-wide filtering coverage and runtime composition are actually proven.
