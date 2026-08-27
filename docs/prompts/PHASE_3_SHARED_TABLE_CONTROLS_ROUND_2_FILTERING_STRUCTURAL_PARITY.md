# PHASE 3 — SHARED TABLE CONTROLS
## ROUND 2 — PROJECT-WIDE FILTERING / STRUCTURAL PARITY / SORT SEMANTIC AUDIT
## SEARCH + FILTERS + SORTING + PAGINATION + URL STATE

---

# 1. STATUS / PRECONDITION

Previous completed work:

```text
Shared Table Sorting Round 1A
→ CRM runtime SortableHeader wiring

Shared Table Sorting Round 1B
→ Platform Orders / Bookings / Users coverage
→ Commit: 72b7100
```

Round 1B reported:

```text
Orders   total: 1514
Bookings total: 691
Users    total: 54
```

Existing shared sorting contract includes:

```text
SortableHeader
shared/sort.ts
buildSortClause()
parseSortDirection()
TIE_BREAKER
sortBy
sortDirection
server-side sorting
stable pagination
URL state
```

However two concrete findings remain:

```text
1. CRM → Клиенты:
   body has a customer-type value such as "Физлицо",
   but the corresponding header disappeared.

2. Orders:
   frontend report says sortable "Дата отмены",
   while backend reported allowlist contains createdAt,
   not an explicitly reported cancellation timestamp.
   This requires semantic audit.
```

Additionally, project-wide operational tables now require a unified filtering contract.

---

# 2. PURPOSE

Evolve the existing table infrastructure from:

```text
Sorting
```

into:

```text
SHARED TABLE CONTROLS

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

while preserving:

```text
server authority
RBAC/workspace scope
stable pagination
existing business semantics
existing sorting behavior
```

This is NOT a visual redesign.

This is a shared query/control architecture implementation.

---

# 3. CORE QUERY CONTRACT

For operational paginated tables, the effective query state must conceptually be:

```text
search
+
filters
+
sortBy
+
sortDirection
+
page
+
pageSize
```

All applicable state must be composable.

No control may silently erase another control's state.

---

# 4. URL IS NAVIGATION STATE

Applicable table state must be represented in URL query parameters.

Conceptual example:

```text
/app/orders
?status=PAID
&partnerId=<id>
&dateFrom=2026-08-01
&dateTo=2026-08-31
&sortBy=createdAt
&sortDirection=desc
&page=3
&pageSize=20
```

Use existing canonical parameter names where already defined.

Do NOT introduce inconsistent page-specific naming without necessity.

---

# 5. STATE TRANSITION CONTRACT

Changing a filter:

```text
preserve search
preserve sorting
update filter
page → 1
```

Changing search:

```text
preserve filters
preserve sorting
page → 1
```

Changing sorting:

```text
preserve search
preserve filters
replace previous user sort
page → 1
```

Changing page:

```text
preserve search
preserve filters
preserve sortBy
preserve sortDirection
change page only
```

Changing pageSize:

```text
preserve search
preserve filters
preserve sorting
page → 1
```

---

# 6. SERVER-SIDE AUTHORITY

For paginated operational tables:

```text
authorize/scope
→ search/filter
→ sort
→ paginate
→ return
```

Forbidden:

```text
fetch page of 20
→ frontend filter those 20
```

Forbidden:

```text
fetch page of 20
→ frontend sort those 20
```

Search, filtering and sorting must apply to the full authorized result set before pagination.

---

# 7. FILTER BAR REQUIREMENT

Every in-scope operational table must have a consistent filter-control area above the table.

Conceptually:

```text
[ Search... ] [ Filter 1 ▼ ] [ Filter 2 ▼ ] [ Date ▼ ] [ Reset ]
```

Exact controls depend on actual table semantics.

Do NOT add meaningless filters merely to satisfy visual symmetry.

---

# 8. FILTER SELECTION PRINCIPLE

A field should normally be filterable when it is:

```text
structured
business-relevant
server-queryable
useful for narrowing a potentially large result set
```

Examples:

```text
status
customer type
partner
customer
service type
payment status
date ranges
country
role
```

Free-text descriptions/notes should normally use search, not giant dropdown filters.

---

# 9. FILTER TYPES

Use appropriate control semantics.

Finite enum:

```text
select / multi-select where justified
```

Entity relation:

```text
searchable selector/autocomplete
```

Date/time:

```text
from / to range
```

Amount:

```text
min / max range
```

Boolean:

```text
All / Yes / No
```

Do not represent every filter as a free-text field.

---

# 10. DEFAULT FILTER STATE

Default state should normally mean:

```text
All
```

unless an existing canonical page intentionally has a scoped default.

Do not silently hide records by introducing a new default filter.

---

# 11. RESET FILTERS

Every filter bar with active filters must provide a clear reset action.

Required:

```text
Reset/Clear filters
→ remove active filters
→ preserve intentional search only if UX contract explicitly distinguishes it
→ preserve sort unless product convention says otherwise
→ page=1
```

Preferred default for this project:

```text
Clear filters
→ clear filters only
→ preserve search
→ preserve sort
→ page=1
```

If implementing "Reset all", label it differently and document semantics.

---

# 12. ACTIVE FILTER VISIBILITY

The user must be able to understand that a filtered dataset is being shown.

At minimum selected control values must remain visible.

Do not apply invisible backend filters.

---

# 13. EMPTY FILTER RESULT

A successful filtered query returning zero rows must display a filtered-empty state, conceptually:

```text
Нет данных по выбранным фильтрам
```

This is different from:

```text
table has never had data
```

and different from:

```text
API error
```

---

# 14. ERROR != EMPTY

Preserve prior CRM boundary:

```text
403/500/network error
≠
0 matching records
```

No fake zero KPIs/rows on failed filter requests.

---

# 15. LOADING != EMPTY

While changing search/filter/sort/page:

```text
loading state
```

must not temporarily render as a genuine empty dataset.

---

# 16. STRUCTURAL PARITY — GLOBAL TABLE RULE

For every in-scope table:

```text
header column count
=
body cell count
```

and:

```text
header order
=
body cell semantic order
```

No missing, shifted or mislabeled columns.

This must be audited after prior `<th>` → `SortableHeader` migrations.

---

# 17. CRM CUSTOMERS — KNOWN DEFECT

Observed current body example:

```text
CRM-00000067
Marie Park
customer67@demo.travelhub.local
Физлицо
Активен
```

Current visible header was reported as:

```text
Код
Имя
Email
Статус
```

Therefore one header is missing.

Expected semantic structure:

```text
Код
Имя
Email
Тип клиента
Статус
```

Restore the missing customer-type header.

---

# 18. CRM CUSTOMER TYPE — SORTABLE

Customer type is a structured business dimension.

If the canonical model has multiple values, such as conceptually:

```text
INDIVIDUAL
LEGAL_ENTITY
```

or the project's actual equivalent, then:

```text
Тип клиента ↑ / ↓
```

must be supported.

Do NOT sort by translated UI strings if backend has canonical enum/code values.

Required mapping:

```text
UI "Тип клиента"
→ public sort key
→ canonical customer-type field
```

---

# 19. CRM CUSTOMER TYPE — FILTERABLE

Add Customer Type to CRM Customers filters.

Conceptually:

```text
Тип клиента:
[ Все ▼ ]
[ Физлицо ]
[ Юрлицо ]
...
```

Use actual canonical values from the project.

Do not invent enum members.

UI labels must be localized RU/AZ/EN.

---

# 20. CRM CUSTOMERS — FILTER AUDIT

Audit actual fields and implement useful canonical filters.

At minimum evaluate:

```text
Customer type
Status
Created date range
```

Also evaluate only if canonical and useful:

```text
country
segment
other structured dimensions
```

Do not expand scope with speculative fields.

---

# 21. CRM PARTNERS — FILTER AUDIT

Evaluate actual fields such as:

```text
Status
Country
Partner type/tier if canonical
Created date range
```

Do not invent partner classifications.

Search should continue to cover appropriate identity fields.

---

# 22. CUSTOMER 360 TABLES — FILTER AUDIT

Audit:

```text
Orders
Bookings
Payments
Partners
Refunds
History if tabular/paginated
```

Add useful filters based on actual data.

Examples to evaluate:

Orders:
```text
status
partner
created date
amount range
```

Bookings:
```text
status
partner
service date
created date
```

Payments:
```text
payment status
payment date
order
```

Refunds:
```text
refund status
refund date
order/payment
```

Partners relationship:
```text
status/type only if canonical
```

Do not filter on unstructured reason/note text via giant dropdowns.

---

# 23. PARTNER 360 TABLES — FILTER AUDIT

Audit:

```text
Services
Orders
Bookings
Customers
```

Examples to evaluate:

Services:
```text
status
service/product type
created date
```

Orders:
```text
status
customer
created date
amount
```

Bookings:
```text
status
customer
service date
created date
```

Customers:
```text
customer type
status if canonical
last activity range
```

All relation/entity filters must remain scoped to the current Partner 360 entity.

---

# 24. PLATFORM ORDERS — FILTERS

Audit actual Orders model/API/UI.

At minimum evaluate:

```text
Order status
Payment status
Created date range
Amount range
Partner
Customer
```

Only implement filters backed by canonical fields/relations.

Search should continue to support appropriate order/customer identifiers according to existing behavior.

---

# 25. ORDERS — SORT SEMANTIC AUDIT

Round 1B reported backend sort allowlist:

```text
code
amount
status
paymentStatus
createdAt
```

but frontend report listed:

```text
Код
Сумма
Статус
Оплата
Дата отмены
```

This MUST be audited.

Determine actual visible column and actual data field.

Possible outcomes:

### Case A — column is actually creation date

Then UI label must be:

```text
Создан
```

and:

```text
sortBy=createdAt
```

is correct.

### Case B — column is actually cancellation date

Then it must use the canonical cancellation timestamp, e.g. the project's actual equivalent of:

```text
cancelledAt
canceledAt
cancellationDate
```

and backend allowlist must map to that field.

### Case C — no canonical cancellation timestamp exists

Then:

```text
Дата отмены
```

must NOT pretend to sort using `createdAt`.

Either:

```text
leave it non-sortable
```

or implement the missing canonical business field only if already required by architecture and safely within scope.

Do not silently substitute creation date for cancellation date.

---

# 26. PLATFORM BOOKINGS — FILTERS

Audit actual Booking model.

At minimum evaluate:

```text
Booking status
Created date range
Service date range
Partner
Customer
Amount range if canonical
```

Creation date and service date must remain separate.

---

# 27. PLATFORM USERS — FILTERS

Audit actual User model/API.

At minimum evaluate:

```text
Status
Role
Created date range
```

Also evaluate if canonical:

```text
last login/activity range
user type
```

Do not invent user classifications.

---

# 28. USERS — ROLE FILTER

Role is a structured finite dimension and should be filterable if the page represents users with canonical roles.

Use canonical role codes on backend.

UI uses localized/display labels.

Do not send translated role names as API authority.

---

# 29. STATUS FILTERS

Status filters must use canonical enum values.

UI:

```text
Активен
Отменён
Оплачен
...
```

API:

```text
canonical status code
```

Do not filter by translated strings.

---

# 30. ENTITY FILTERS

For filters such as:

```text
Partner
Customer
Service
Order
```

prefer canonical IDs in URL/API.

Example:

```text
partnerId=<uuid>
```

not:

```text
partner=Baku Tours Pro
```

Display human-readable labels in UI.

---

# 31. DATE RANGE CONTRACT

Date filtering must use explicit boundaries.

Conceptually:

```text
dateFrom
dateTo
```

Define whether boundary semantics are:

```text
inclusive start
inclusive end
```

and normalize timezone according to existing project timezone architecture.

Do not compare formatted UI date strings.

---

# 32. BUSINESS DATE AUTHORITY

Preserve already accepted semantics:

Payment:

```text
paymentDate → paidAt
```

Refund:

```text
refundDate → processedAt
```

If filters are added:

```text
Payment Date filter → paidAt
Refund Date filter → processedAt
```

Do NOT regress to `createdAt`.

---

# 33. NULL BUSINESS DATES

For:

```text
pending payment → paidAt NULL
unprocessed refund → processedAt NULL
```

date filters must have explicit semantics.

Example:

```text
payment date range
```

naturally excludes NULL because no payment date exists.

If product needs "not yet paid", use status/boolean semantics, not fake dates.

---

# 34. AMOUNT RANGE FILTERS

Where amount filtering is useful:

```text
minAmount
maxAmount
```

must operate numerically.

If mixed currencies exist without a normalized amount, do not imply cross-currency comparability.

Document limitation or scope by currency where necessary.

---

# 35. SEARCH CONTRACT

Audit each table's existing search behavior.

Search must remain server-side for paginated datasets.

Document fields searched per page.

Example only:

```text
Orders:
code
customer name/email

Users:
name
email
username
```

Do not claim fields not actually searched.

---

# 36. SEARCH DEBOUNCE

If search triggers network requests per keystroke, use existing project debounce convention or a reasonable shared debounce.

Do not introduce inconsistent behavior page by page.

---

# 37. FILTER REQUEST RACE SAFETY

Rapid changes:

```text
Status=A
→ immediately Status=B
```

must leave final UI in state B.

Stale response A must not overwrite B.

Same rule applies to combined search/filter/sort transitions.

---

# 38. PAGINATION TOTAL

Filtering changes the total to the filtered total.

Sorting does NOT change total.

Required:

```text
unfiltered total = X
filtered total = Y
sort filtered result
→ total remains Y
```

---

# 39. FILTER CHIPS / SUMMARY

If existing design system supports active filter chips, reuse them.

Do not create a second visual filter system solely for this Round.

At minimum control values must visibly show active state.

---

# 40. RESPONSIVE FILTER BAR

Filter controls must not break table layout at common desktop widths.

Use wrapping/compact layout where needed.

Do not make the data table unusable by placing an oversized toolbar above it.

---

# 41. PERMISSION / SCOPE AUTHORITY

Filters must never broaden data visibility.

Required:

```text
actor permissions
workspace scope
tenant/partner scope
existing authorization predicates
```

are applied before/with query filtering.

A user must not retrieve hidden records by manipulating URL filter parameters.

---

# 42. FILTER ALLOWLIST / DTO VALIDATION

Backend must validate filter parameters.

Required:

```text
known enum values
valid UUID/entity IDs
valid dates
valid numeric ranges
```

Unknown or invalid values must produce safe behavior according to existing API conventions.

No arbitrary query-field passthrough.

---

# 43. URL CLEANLINESS

Prefer omitting default values such as:

```text
status=ALL
customerType=ALL
```

when not needed.

Keep URLs stable and shareable.

Do not serialize undefined/null noise.

---

# 44. DEEP LINK REPRODUCTION

Copying a filtered URL and opening it in a new tab must reproduce:

```text
search
filters
sort
direction
page
pageSize
```

subject to authorization.

---

# 45. BROWSER BACK / FORWARD

Required:

```text
Filter A
→ Filter B
→ sort
→ page 2
```

Back/Forward must restore previous query states.

---

# 46. STRUCTURAL PARITY AUDIT SCOPE

Audit header/body parity for at least:

```text
CRM Customers
CRM Partners
Customer 360 Orders
Customer 360 Bookings
Customer 360 Payments
Customer 360 Partners
Customer 360 Refunds
Partner 360 Services
Partner 360 Orders
Partner 360 Bookings
Partner 360 Customers
Platform Orders
Platform Bookings
Platform Users
```

Report mismatches even if unrelated to filtering.

Fix straightforward regressions caused by recent table-header migration.

Do not hide findings.

---

# 47. SORTABLE + FILTERABLE ARE INDEPENDENT

A field may be:

```text
sortable only
filterable only
both
neither
```

Do not assume all filters require sortable headers.

Do not assume all sortable fields need dropdown filters.

Customer Type is explicitly expected to be:

```text
sortable + filterable
```

because it is a structured business dimension.

---

# 48. NO FILTERS ON ACTION COLUMNS

Never filter/sort action columns such as:

```text
Open
Edit
Menu
Actions
```

---

# 49. NO FREE-TEXT NOTES FILTER IN THIS ROUND

Operational Notes / Comments have not yet been implemented.

Do NOT add speculative note filters.

---

# 50. SHARED FRONTEND PRIMITIVES

Audit whether existing components can support:

```text
TableFilterBar
FilterSelect
DateRangeFilter
EntityFilter
ClearFilters
```

Prefer shared primitives.

Do not prematurely create a giant universal table component if the current architecture does not support it cleanly.

The goal is a shared contract, not forced abstraction.

---

# 51. SHARED BACKEND HELPERS

Where useful, create/reuse narrowly scoped shared helpers for:

```text
sort parsing
date range parsing
numeric range validation
query normalization
```

Do not create a generic unsafe dynamic Prisma query builder.

Explicit allowlists remain preferred.

---

# 52. PERFORMANCE

For high-volume tables such as Orders and Bookings, inspect query plans/index suitability for newly exposed filters.

Do not add indexes blindly.

If a filter creates an obvious unindexed high-cost path, report and remediate appropriately.

---

# 53. REQUIRED FILTER COVERAGE MATRIX

Fill with actual implementation:

| Table | Search | Filters | Sort | Pagination | URL state | Server-side | PASS |
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

---

# 54. REQUIRED FILTER SEMANTICS MATRIX

| Table | UI Filter | URL/API Param | Backend Field/Relation | Type | Null semantics | PASS |
|---|---|---|---|---|---|---|
| | | | | | | |

No invented fields.

---

# 55. REQUIRED STRUCTURAL PARITY MATRIX

| Table | Header count | Body cell count | Order matches | Missing labels | PASS |
|---|---:|---:|---|---|---|
| CRM Customers | | | | | |
| CRM Partners | | | | | |
| Customer Orders | | | | | |
| Customer Bookings | | | | | |
| Customer Payments | | | | | |
| Customer Partners | | | | | |
| Customer Refunds | | | | | |
| Partner Services | | | | | |
| Partner Orders | | | | | |
| Partner Bookings | | | | | |
| Partner Customers | | | | | |
| Platform Orders | | | | | |
| Platform Bookings | | | | | |
| Platform Users | | | | | |

---

# 56. REQUIRED CRM CUSTOMER TYPE PROOF

Browser proof must show:

```text
Header:
Код | Имя | Email | Тип клиента | Статус
```

Then:

```text
click Тип клиента
→ ASC ↑
→ rows reorder

click again
→ DESC ↓
```

Then filter:

```text
Тип клиента = <canonical type A>
→ only type A rows

Тип клиента = <canonical type B>
→ only type B rows

Все
→ full scoped dataset
```

Prove URL state and API parameter.

---

# 57. REQUIRED ORDERS SEMANTIC PROOF

Report exactly:

```text
Visible date-column label:
Displayed value source:
sortBy key:
Backend field:
Meaning:
```

Then state:

```text
MATCH
```

or:

```text
MISMATCH FIXED
```

No ambiguous "Дата отмены" → `createdAt` mapping may remain.

---

# 58. REQUIRED COMPOSITION PROOF

On at least one dataset with >20 rows:

```text
apply filter
→ total changes

apply sort
→ filter remains
→ total unchanged
→ order changes

go page 2
→ filter remains
→ sort remains

refresh
→ all state remains
```

---

# 59. REQUIRED MULTI-FILTER PROOF

On at least one table with two meaningful filters:

```text
Filter A
+
Filter B
```

must combine as intersection unless architecture explicitly specifies otherwise.

Example conceptually:

```text
status=ACTIVE
AND
customerType=INDIVIDUAL
```

Do not implement accidental OR semantics.

---

# 60. REQUIRED CLEAR FILTERS PROOF

With two active filters:

```text
Clear filters
```

must:

```text
remove filters
page → 1
preserve sort
preserve search according to chosen contract
```

Document exact behavior.

---

# 61. REQUIRED INVALID FILTER PROOF

Test malformed/unsupported values:

```text
invalid enum
invalid UUID
invalid date
min > max
```

Use existing API error conventions.

No crashes or unsafe query behavior.

---

# 62. REQUIRED SECURITY PROOF

At least regression-test that filters do not bypass existing scope/RBAC.

No need to redesign permissions.

---

# 63. FRONTEND TESTS

Add focused integration tests for:

```text
filter updates URL
filter resets page
filter preserves sort
sort preserves filters
pagination preserves filters
search preserves filters
clear filters
customer type filter
customer type sorting
structural header parity where testable
Back/Forward or query hydration where test architecture supports it
```

Do not test only isolated controls.

---

# 64. BACKEND TESTS

Add focused tests for:

```text
filter DTO validation
single filter
multiple filters intersection
filter + search
filter + sort
filter + pagination
date ranges
enum filters
entity ID filters
invalid values
scope preservation
customer type
Orders date semantic fix if backend changes
```

---

# 65. REGRESSION — SORTING

Verify no regression in:

```text
CRM sorting
Orders sorting
Bookings sorting
Users sorting
Payment date → paidAt
Refund date → processedAt
single-column replacement
stable tie-breaker
```

---

# 66. REGRESSION — DETAIL LINKS

Filters/sorting must not break clickable entity references:

```text
Customer 360
Partner 360
Order detail
Booking detail
Service detail
```

---

# 67. I18N

All new visible filter labels/options:

```text
RU
AZ
EN
```

Raw i18n keys = 0.

Canonical enum values must not leak into UI unless intentionally user-facing.

---

# 68. BUILD / TEST GATES

Required:

```text
Backend TSC
Backend tests
Backend build

Frontend TSC
Frontend tests
Frontend build
```

Report exact counts.

---

# 69. RUNTIME AUTHORITY

Report:

```text
Repository path
Branch
Starting SHA
Final SHA
origin/master
Frontend PID/CWD/port
Backend PID/CWD/port
API target
```

Browser proof must use the same localhost runtime observed by the user.

---

# 70. BROWSER EVIDENCE IS MANDATORY

VERDICT A cannot be based only on:

```text
source inspection
unit tests
API curl
build success
```

Required actual browser evidence for:

```text
visible filter controls
customer type restored
customer type sorting
customer type filtering
Orders semantic date correction
filter + sort composition
pagination persistence
clear filters
```

---

# 71. ACCEPTANCE CRITERIA

VERDICT A only if all applicable items pass:

1. Existing sorting infrastructure reused.
2. Shared Table Controls contract documented.
3. Search/filter/sort/page state composes.
4. URL is authoritative navigation state.
5. Filter change resets page=1.
6. Search change resets page=1.
7. Sort change resets page=1.
8. Page change preserves filters.
9. Page change preserves search.
10. Page change preserves sort.
11. pageSize change resets page=1.
12. Server filters before pagination.
13. Server sorts before pagination.
14. No client-only filtering of paginated rows.
15. No client-only sorting of paginated rows.
16. Filter bar exists for each in-scope operational table.
17. Only meaningful filters exposed.
18. Canonical enum values used by API.
19. Entity filters use canonical IDs.
20. Date filters use canonical timestamps.
21. Payment date filter uses paidAt.
22. Refund date filter uses processedAt.
23. Numeric ranges are numeric.
24. Null date semantics documented.
25. Clear filters works.
26. Active filters visibly represented.
27. Filtered-empty != error.
28. Loading != empty.
29. Invalid filters safely handled.
30. Filters cannot broaden authorization scope.
31. CRM Customers header restored.
32. CRM Customers header/body counts match.
33. CRM Customers order matches body order.
34. Customer Type header visible.
35. Customer Type sortable.
36. Customer Type first click ASC.
37. Customer Type second click DESC.
38. Customer Type filterable.
39. Customer Type filter uses canonical value.
40. Customer Type filter URL state works.
41. Customer Type sort URL state works.
42. Orders date-column semantics audited.
43. No cancellation-date/createdAt semantic mismatch remains.
44. CRM Partners parity PASS.
45. Customer Orders parity PASS.
46. Customer Bookings parity PASS.
47. Customer Payments parity PASS.
48. Customer Partners parity PASS.
49. Customer Refunds parity PASS.
50. Partner Services parity PASS.
51. Partner Orders parity PASS.
52. Partner Bookings parity PASS.
53. Partner Customers parity PASS.
54. Platform Orders parity PASS.
55. Platform Bookings parity PASS.
56. Platform Users parity PASS.
57. Platform Orders filters implemented/audited.
58. Platform Bookings filters implemented/audited.
59. Platform Users filters implemented/audited.
60. CRM Customers filters implemented/audited.
61. CRM Partners filters implemented/audited.
62. Customer 360 tables filters implemented/audited.
63. Partner 360 tables filters implemented/audited.
64. Multi-filter intersection proven.
65. Filter + sort composition proven.
66. Filter + pagination composition proven.
67. Search + filter composition proven where search exists.
68. Refresh preserves query state.
69. Back restores query state.
70. Forward restores query state.
71. Direct URL reproduces query state.
72. Filter Coverage Matrix supplied.
73. Filter Semantics Matrix supplied.
74. Structural Parity Matrix supplied.
75. Customer Type browser proof supplied.
76. Orders semantic proof supplied.
77. Composition browser proof supplied.
78. Invalid-filter proof supplied.
79. Sorting regression PASS.
80. Detail links regression PASS.
81. Backend TSC PASS.
82. Backend tests PASS.
83. Backend build PASS.
84. Frontend TSC PASS.
85. Frontend tests PASS.
86. Frontend build PASS.
87. Raw i18n keys = 0.
88. Operational Notes not started.
89. Storefront Pro CRM not started.
90. Unrelated files = 0.
91. Commit pushed.
92. HEAD == origin/master.
93. Browser evidence from same localhost runtime observed by user.

---

# 72. VERDICT

Success:

```text
VERDICT A — PHASE 3 SHARED TABLE CONTROLS ROUND 2 /
PROJECT-WIDE FILTERING /
SEARCH + FILTERS + SORTING + PAGINATION + URL STATE /
CRM CUSTOMER TYPE STRUCTURAL PARITY /
ORDERS SORT SEMANTIC AUTHORITY
FULLY IMPLEMENTED AND BROWSER-VERIFIED
```

Failure:

```text
VERDICT B — SHARED TABLE CONTROLS / FILTERING / STRUCTURAL PARITY INCOMPLETE
```

No conditional VERDICT A.

---

# 73. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_SHARED_TABLE_CONTROLS_ROUND_2_FILTERING_STRUCTURAL_PARITY_REPORT.md
```

---

# 74. FINAL RESPONSE FORMAT

```text
VERDICT:

PRECONDITION:
Starting SHA:
Round 1A:
Round 1B:

ROOT FINDINGS:
CRM Customer Type header:
Orders date semantic mismatch:
Other structural mismatches:

SHARED TABLE CONTROLS:
Search:
Filters:
Sorting:
Pagination:
URL state:

FILTER COVERAGE MATRIX:
...

FILTER SEMANTICS MATRIX:
...

STRUCTURAL PARITY MATRIX:
...

CRM CUSTOMERS:
Header:
Customer Type canonical field:
Customer Type sort key:
Customer Type filter param:
Customer Type options:
Browser proof:

CRM PARTNERS:
Filters:
Browser proof:

CUSTOMER 360:
Orders filters:
Bookings filters:
Payments filters:
Partners filters:
Refunds filters:

PARTNER 360:
Services filters:
Orders filters:
Bookings filters:
Customers filters:

PLATFORM ORDERS:
Filters:
Visible date column:
Displayed source:
Sort key:
Backend field:
Semantic result:
Browser proof:

PLATFORM BOOKINGS:
Filters:
Browser proof:

PLATFORM USERS:
Filters:
Browser proof:

COMPOSITION:
Filter + sort:
Filter + pagination:
Search + filter:
Multi-filter:
Clear filters:

URL/HISTORY:
Refresh:
Back:
Forward:
Direct URL:

SECURITY:
Scope:
Invalid filters:

SORT REGRESSION:
CRM:
Orders:
Bookings:
Users:
Payment paidAt:
Refund processedAt:

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

# 75. STOP

After report:

```text
STOP
```

Do NOT start Operational Notes / Comments.
Do NOT start Storefront Pro CRM.

Shared Table Controls may be considered closed only after browser verification confirms:

```text
filters
+
search
+
sorting
+
pagination
+
URL state
+
structural table parity
```

on the actual localhost runtime.
