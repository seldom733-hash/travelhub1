# PHASE 3 — SHARED TABLE INFRASTRUCTURE
## TABLE SORTING CONTRACT — SINGLE-COLUMN SERVER-AUTHORITATIVE SORTING
## SORT + PAGINATION STATE PERSISTENCE / URL STATE / VISUAL DIRECTION INDICATORS

> **Execution order:** DO NOT execute this prompt until the currently running
> `PHASE 3 STEP 3.5 PLATFORM CRM ROUND 5B.1 — PAYMENT / REFUND BUSINESS DATE AUTHORITY`
> has completed, its report has been reviewed, and the previous stage has received an accepted verdict.

---

# 1. PURPOSE

Introduce one reusable sorting contract for operational tables across TravelHub.

This must NOT become a CRM-only one-off.

The intended shared behavior is:

```text
sortable table
→ one active sort field only
→ ASC or DESC
→ server-authoritative ordering
→ ordering applied BEFORE pagination
→ pagination preserves active sorting
→ URL preserves table state
```

The implementation should be reusable by current CRM tables and future operational tables such as:

```text
Orders
Bookings
Payments
Refunds
Customers
Partners
Services
Finance
other paginated entity lists
```

Do not blindly retrofit unrelated tables without auditing their contracts first.

---

# 2. CORE USER CONTRACT

A sortable column header is interactive.

Example:

```text
Дата создания
```

First click:

```text
Дата создания ↑
sortBy=createdAt
sortDirection=asc
```

Second click:

```text
Дата создания ↓
sortBy=createdAt
sortDirection=desc
```

Click another sortable column:

```text
Сумма ↑
sortBy=amount
sortDirection=asc
```

The previous `createdAt` sorting is removed completely.

---

# 3. SINGLE-COLUMN SORTING ONLY

Hard invariant:

```text
ONE table
→ ZERO or ONE active sort field
```

Forbidden:

```text
createdAt DESC + amount ASC
status ASC + createdAt DESC
Shift-click multi-sort
Ctrl-click multi-sort
priority arrays
secondary user-selected sorting
```

When a new sortable header is clicked:

```text
new sort replaces previous sort
```

No cross/multi-column sorting.

---

# 4. SORT DIRECTION CYCLE

Required click behavior:

```text
unsorted column
→ first click = ASC

same active column
→ second click = DESC

same active column
→ subsequent click = ASC
```

Use a two-state active cycle:

```text
ASC ↔ DESC
```

Do not introduce a third "none" state on repeated click unless an existing table contract already requires it and architecture review explicitly approves the exception.

The user can replace sorting by clicking another field.

---

# 5. VISUAL INDICATOR

Only the currently active sorted column shows an active direction arrow.

Required semantics:

```text
↑ = ascending
↓ = descending
```

Example:

```text
Заказ     Создан ↓     Клиент     Сумма     Статус
```

Only:

```text
Создан
```

is active.

Do not show active arrows beside every sortable column.

---

# 6. SORTABLE vs NON-SORTABLE HEADER

Sortable headers must be visually distinguishable as interactive without creating visual noise.

Required:

```text
pointer/focus affordance
keyboard focus
accessible semantics
```

Non-sortable headers must not behave like buttons.

Examples of likely sortable fields, only when canonical sort semantics exist:

```text
code / number
created date
payment date
refund date
amount
customer name
partner name
status
last activity
orders count
bookings count
```

Potentially non-sortable unless a canonical key is defined:

```text
Что оплачено
Состав заказа
Причина возврата
complex combined context cells
```

---

# 7. SORTING MUST BE SERVER-AUTHORITATIVE FOR PAGINATED DATA

For a paginated collection:

```text
total = 241
pageSize = 20
```

Forbidden implementation:

```text
fetch page 1
→ sort only those 20 rows in browser
```

That produces false global ordering.

Required:

```text
UI sort selection
↓
API sort parameters
↓
backend validates sort key
↓
database/query ORDER BY
↓
pagination
↓
current page
```

Conceptually:

```text
ORDER BY
→ OFFSET/LIMIT
```

not:

```text
OFFSET/LIMIT
→ frontend Array.sort()
```

---

# 8. API CONTRACT

Audit current list endpoints before choosing exact parameter names.

Preferred shared conceptual contract:

```text
sortBy=<canonical-key>
sortDirection=asc|desc
```

If the project already has an established naming convention, reuse it.

Do not create different conventions such as:

```text
sort
order
direction
sortField
sortDir
```

per module without justification.

Document the final shared contract.

---

# 9. SORT KEY ALLOWLIST

Never pass arbitrary user-provided `sortBy` directly into raw SQL/order expressions.

Each endpoint must use a server-side allowlist/mapping.

Conceptual example:

```text
createdAt → canonical DB/query field
amount    → canonical amount field
status    → canonical status field
```

Unknown keys:

```text
must be rejected or normalized according to documented API policy
```

No SQL/query injection surface.

---

# 10. SORT SEMANTICS BELONG TO BACKEND

The frontend may know:

```text
column id = paymentDate
```

but backend/domain must determine the canonical field/expression used for sorting.

Example:

```text
paymentDate
```

must sort by the canonical Payment business date established by Round 5B.1, not by `createdAt` merely because it is easier.

Likewise:

```text
refundDate
```

must sort by canonical Refund business date.

---

# 11. NULL SORTING

Explicitly define behavior for nullable sortable fields.

Important examples:

```text
Payment date = NULL for unpaid/pending Payment
Refund date = NULL for requested/pending Refund
```

Document:

```text
ASC null placement
DESC null placement
```

Choose one predictable project-wide policy where possible.

Do not leave behavior dependent on accidental DB defaults if that creates inconsistent UX across databases/queries.

---

# 12. STABLE SORTING

Pagination requires deterministic ordering.

If the selected sort field can contain duplicate values:

```text
createdAt
amount
status
name
```

the backend should use a deterministic internal tie-breaker.

Conceptually:

```text
ORDER BY createdAt DESC, id DESC
```

This internal tie-breaker does NOT violate the user-facing single-column sorting contract.

It is not a second user-selected sort.

Its only purpose is stable pagination.

Document the tie-breaker policy.

---

# 13. PAGINATION MUST PRESERVE SORTING

This is a hard requirement.

Starting state:

```text
page=1
sortBy=createdAt
sortDirection=desc
```

User selects page 2:

```text
page=2
sortBy=createdAt
sortDirection=desc
```

User selects page 3:

```text
page=3
sortBy=createdAt
sortDirection=desc
```

Only `page` changes.

The active sorting must NOT reset.

---

# 14. NEW SORT RESETS PAGE

If the user is currently on:

```text
page=7
sortBy=createdAt
sortDirection=desc
```

and clicks:

```text
amount
```

required state:

```text
page=1
sortBy=amount
sortDirection=asc
```

Reason:

```text
the ordering changed
→ the meaning of page 7 changed
→ restart from first page
```

---

# 15. DIRECTION CHANGE RESETS PAGE

If the user changes:

```text
amount ASC
```

to:

```text
amount DESC
```

reset:

```text
page=1
```

because the ordered result set changed.

---

# 16. URL STATE — REQUIRED

For routable operational tables, sorting and pagination must be represented in URL query state.

Conceptual example:

```text
?page=3&sortBy=createdAt&sortDirection=desc
```

For 360 tabs:

```text
/app/crm/customers/:id
?tab=payments
&page=3
&sortBy=paymentDate
&sortDirection=desc
```

Use actual routing/query conventions consistently.

---

# 17. REFRESH PERSISTENCE

Given:

```text
?page=3&sortBy=createdAt&sortDirection=desc
```

browser refresh must preserve:

```text
page 3
createdAt DESC
active ↓ indicator
same globally sorted result
```

No reset to default state after refresh.

---

# 18. BACK / FORWARD PERSISTENCE

Browser navigation must restore table state.

Example:

```text
A:
page=1, createdAt DESC

B:
page=3, createdAt DESC

C:
page=1, amount ASC
```

Browser Back:

```text
→ B
```

Back again:

```text
→ A
```

Forward:

```text
→ B
```

The UI, URL, request and active arrow must remain synchronized.

---

# 19. DEEP LINK / COPY URL

A copied URL containing:

```text
page
sortBy
sortDirection
```

must reproduce the same table state when opened directly, subject to current data changes.

This is required for operational reproducibility.

---

# 20. TAB STATE

For Customer 360 / Partner 360, preserve the active tab together with table state.

Example:

```text
?tab=payments&page=2&sortBy=paymentDate&sortDirection=desc
```

Do not lose:

```text
tab=payments
```

when sorting or paginating.

Do not lose sorting when the pagination component updates the URL.

---

# 21. SEARCH + SORT

Where a table supports search:

```text
search
+
sort
+
pagination
```

must compose.

Conceptually:

```text
?q=marie
&page=2
&sortBy=createdAt
&sortDirection=desc
```

Changing page:

```text
preserve q + sort
```

Changing sort:

```text
preserve q
reset page=1
replace previous sort
```

---

# 22. FILTER + SORT

Where a table supports filters:

```text
filter
+
sort
+
pagination
```

must compose.

Example:

```text
status=CAPTURED
page=3
sortBy=paymentDate
sortDirection=desc
```

Changing page preserves:

```text
status + sort
```

Changing sort preserves:

```text
status
```

and resets:

```text
page=1
```

---

# 23. SEARCH/FILTER CHANGE

When search/filter changes the result set:

```text
reset page=1
```

Preserve active sorting unless the selected sort is no longer valid for the resulting table contract.

Do not silently clear sort on ordinary search/filter changes.

---

# 24. PAGE SIZE

If page size is configurable now or later:

```text
pageSize
```

must compose with sorting.

Changing page size should normally:

```text
preserve sort
reset page=1
```

Use existing project pagination policy.

Default bounded page size contract remains:

```text
<= 20
```

where previously established.

---

# 25. DEFAULT SORT

Audit each table's current canonical/default ordering.

Do not automatically impose:

```text
createdAt DESC
```

everywhere.

For each table document:

```text
default sort field
default direction
```

or:

```text
backend canonical default order
```

If no explicit user sort is selected, the UI does not need to show an active arrow unless the product intentionally exposes the default sort as active.

Be consistent.

---

# 26. USER SORT vs DEFAULT ORDER

Distinguish:

```text
backend default order
```

from:

```text
explicit user-selected sort
```

If URL has no `sortBy`, use canonical default.

Once the user clicks a sortable header:

```text
explicit sort state
```

must be reflected in URL and arrow.

---

# 27. CUSTOMER 360 TARGET TABLES

Audit/apply shared sorting to applicable tables:

```text
Orders
Bookings
Payments
Partners
Refunds
History — only if table renderer and sortable semantics make sense
```

Do not force sorting onto timeline History if its chronological contract is intentionally fixed.

---

# 28. PARTNER 360 TARGET TABLES

Audit/apply to:

```text
Services
Orders
Bookings
Customers
```

Storefront is a single-object summary and does not need table sorting.

---

# 29. PLATFORM CRM LISTS

Audit/apply the same contract to top-level:

```text
CRM → Customers
CRM → Partners
```

These are core paginated tables and should not retain a different sorting implementation.

---

# 30. FUTURE SHARED REUSE

The shared contract/component/API convention must be suitable for later use in:

```text
Orders Center
Booking Center
Finance
Sales
other operational centers
```

Do NOT implement all future modules now.

The requirement is:

```text
do not design a CRM-specific dead end
```

---

# 31. CUSTOMER 360 — ORDERS SORT KEYS

Audit canonical support for useful fields such as:

```text
order code/number
createdAt
partner
amount
status
```

Only expose sortable headers with valid server semantics.

---

# 32. CUSTOMER 360 — BOOKINGS SORT KEYS

Audit:

```text
booking code
createdAt
service date
partner
amount if canonical
status
```

Creation date and service date are different sort keys.

---

# 33. CUSTOMER 360 — PAYMENTS SORT KEYS

Audit:

```text
payment code
paymentDate
amount
payment method
status
```

Critical:

```text
paymentDate
```

must use the canonical financial business date established by Round 5B.1.

Do not regress to Payment `createdAt`.

---

# 34. CUSTOMER 360 — REFUNDS SORT KEYS

Audit:

```text
refund code
refundDate
amount
status
```

Critical:

```text
refundDate
```

must use canonical actual refund date established by Round 5B.1.

Do not sort by request `createdAt` while labeling the column `Дата возврата`.

---

# 35. CUSTOMER 360 — PARTNERS SORT KEYS

Audit:

```text
partner name/code
orders count
bookings count
order amount / established commercial metric
last activity
CRM state where useful
```

Aggregate sorting must occur over the canonical aggregated query, not by sorting only rendered rows.

---

# 36. PARTNER 360 — CUSTOMERS SORT KEYS

Audit:

```text
customer name/code
orders count
bookings count
order amount
last activity
CRM state
```

Preserve distinct-customer semantics from Round 5.

---

# 37. AGGREGATE SORTING

For columns such as:

```text
Orders count
Bookings count
Сумма заказов
Последняя активность
```

sorting must be based on the canonical aggregate expression/query.

Do not compute 20 rows and sort client-side.

---

# 38. NAME SORTING / LOCALE

Audit current DB/query capabilities before promising locale-aware alphabetic order.

Document actual semantics for:

```text
Customer name
Partner name
Service name
```

Do not claim linguistically perfect RU/AZ/EN collation unless it is actually configured/proven.

Use deterministic existing DB collation or an explicit supported normalization strategy.

---

# 39. STATUS SORTING

If Status is sortable, document what ordering means.

Possible semantics:

```text
lexical enum/string order
explicit business rank
```

Do not invent business-priority ordering silently.

If no useful canonical order exists:

```text
make Status non-sortable
```

---

# 40. AMOUNT SORTING

Money sorting must use numeric canonical amount, never formatted display text.

Correct:

```text
50.88
206.92
1000.00
```

Incorrect lexical ordering:

```text
1000.00
206.92
50.88
```

Currency must be considered.

If a table can contain multiple currencies and values are not normalized:

```text
do not present cross-currency amount sorting as economically comparable
```

without a defined contract.

---

# 41. DATE SORTING

Date sorting must use canonical timestamp/date values, not formatted strings.

Correct:

```text
timestamp
```

not:

```text
"26.08.2026, 14:30"
```

---

# 42. CODE / NUMBER SORTING

Audit whether codes contain numeric business sequences.

Example:

```text
ORD-2
ORD-10
```

Lexical and natural/numeric ordering differ.

Use the current canonical business ordering where available.

Do not add complex natural sorting unless actually needed.

---

# 43. ACCESSIBILITY

Sortable header must expose semantic state.

Use appropriate accessible behavior such as:

```text
button semantics
aria-sort on column header
keyboard activation
focus-visible state
```

Expected semantic states:

```text
ascending
descending
none
```

Do not rely on arrow icon alone.

---

# 44. ICON / ARROW

Reuse an existing icon system if available.

Do not introduce an unrelated icon dependency just for sorting.

Required visual semantics:

```text
ASC  → ↑
DESC → ↓
```

The implementation may use an equivalent existing chevron/arrow icon if visually consistent.

---

# 45. CLICK TARGET

The sortable header label + arrow should form a usable click target.

Avoid tiny arrow-only click areas.

---

# 46. LOADING DURING SORT

When sorting triggers a server request:

```text
preserve current table structure
show established loading behavior
```

Do not flash a false:

```text
Нет данных
0 результатов
```

between requests.

---

# 47. ERROR DURING SORT

If a sort request fails:

```text
error != empty
```

Do not show an empty table as if sorting produced zero results.

The URL/UI state and retry behavior must remain understandable.

---

# 48. RACE CONDITIONS

Rapid header clicks can create overlapping requests.

Prevent stale responses from overwriting newer sort state.

Example:

```text
createdAt ASC request
then immediately amount ASC request
```

Final UI must reflect:

```text
amount ASC
```

even if the older request finishes later.

Use existing request/state architecture appropriately.

---

# 49. INVALID URL SORT STATE

If URL contains:

```text
sortBy=unknown
sortDirection=sideways
```

the application must handle it safely.

Required:

```text
no crash
no raw query injection
no inconsistent arrow
```

Normalize to canonical default or return a controlled validation behavior according to project conventions.

Document the chosen policy.

---

# 50. PERMISSION / SCOPE

Sorting must not alter data authority.

Required invariant:

```text
same actor
same scope
same filters
same authorized dataset
```

Only order changes.

No cross-tenant/cross-partner leakage caused by alternate joins/order expressions.

---

# 51. TOTAL COUNT

Sorting must not change:

```text
total
```

for the same search/filter scope.

Example:

```text
241 results unsorted
241 results amount ASC
241 results createdAt DESC
```

unless underlying data changed concurrently.

---

# 52. DUPLICATE / MISSING ROW PAGINATION TEST

Stable ordering must prevent obvious pagination defects.

Required test:

```text
sort field contains duplicate values
page 1
page 2
```

Verify no row is duplicated or skipped solely because ordering was nondeterministic.

Use deterministic tie-breaker.

---

# 53. SORT + PAGINATION CROSS-PAGE PROOF

Required representative proof:

```text
total > 20
sortBy=<field>
sortDirection=desc

page 1
→ rows globally first in that order

page 2
→ continuation of same global order
```

Do not merely show that each page is internally sorted.

---

# 54. REQUIRED URL STATE MATRIX

| Action | page | sortBy | sortDirection | Other query state | PASS |
|---|---:|---|---|---|---|
| Initial canonical state | | | | | |
| Click sortable field | 1 | new | ASC | preserved | |
| Click same field again | 1 | same | DESC | preserved | |
| Click another field | 1 | replaced | ASC | preserved | |
| Go to page 2 | 2 | preserved | preserved | preserved | |
| Go to page 3 | 3 | preserved | preserved | preserved | |
| Refresh | preserved | preserved | preserved | preserved | |
| Back | restored | restored | restored | restored | |
| Forward | restored | restored | restored | restored | |
| Search change | 1 | preserved | preserved | new search | |
| Filter change | 1 | preserved | preserved | new filter | |

---

# 55. REQUIRED SORTING BEHAVIOR MATRIX

| Table | Sort field | ASC | DESC | Server-side | Page persistence | URL persistence | PASS |
|---|---|---|---|---|---|---|---|
| CRM Customers | | | | | | | |
| CRM Partners | | | | | | | |
| Customer Orders | | | | | | | |
| Customer Bookings | | | | | | | |
| Customer Payments | paymentDate | | | | | | |
| Customer Partners | | | | | | | |
| Customer Refunds | refundDate | | | | | | |
| Partner Services | | | | | | | |
| Partner Orders | | | | | | | |
| Partner Bookings | | | | | | | |
| Partner Customers | | | | | | | |

Only include fields actually made sortable.

---

# 56. REQUIRED BACKEND SORT ALLOWLIST MATRIX

| Endpoint | Public sort key | Canonical query field/expression | Nullable? | Tie-breaker | PASS |
|---|---|---|---|---|---|
| | | | | | |

No arbitrary field passthrough.

---

# 57. DEFAULT ORDER MATRIX

| Table/endpoint | Default field/order | User-visible arrow by default? | Reason |
|---|---|---:|---|
| | | | |

Document current/default behavior instead of silently changing all tables.

---

# 58. TEST REQUIREMENTS — BACKEND

Add focused tests for applicable endpoints:

```text
ASC
DESC
invalid sort key
invalid direction
sort before pagination
stable tie-breaker
scope preserved
filter + sort
search + sort
nullable date ordering
aggregate sorting where supported
```

Critical financial tests:

```text
Payment sorting uses payment business date
Refund sorting uses refund business date
```

---

# 59. TEST REQUIREMENTS — FRONTEND

Add focused tests for:

```text
first click → ASC
second click → DESC
new column replaces old sort
only one active arrow
page change preserves sort
sort change resets page=1
direction change resets page=1
URL state updated
refresh/direct URL initialization
Back/Forward synchronization where testable
search/filter preserves sort
invalid URL state handled
aria-sort
keyboard activation
```

---

# 60. BROWSER VERIFICATION

Mandatory on the same localhost runtime used by the user.

At minimum prove with a dataset containing >20 rows:

```text
1. click sortable header
2. observe ↑
3. verify global ASC result
4. go page 2
5. verify same ASC sorting continues
6. go page 3
7. verify sorting remains
8. click same header
9. observe ↓
10. page resets to 1
11. click another sortable field
12. old arrow disappears
13. new ↑ appears
14. URL contains new sort state
15. refresh
16. state remains
17. Back/Forward
18. state restores
```

---

# 61. REQUIRED CROSS-PAGE PAYMENT PROOF

After Round 5B.1 is accepted, use Payments if enough data exists.

Example:

```text
sortBy=paymentDate
sortDirection=desc
```

Verify:

```text
page 1 → newest actual payments
page 2 → continuation
```

Pending/null payment dates follow the documented null policy.

Do not use Payment `createdAt` for this proof.

---

# 62. REQUIRED CROSS-PAGE REFUND PROOF

If enough Refund rows exist:

```text
sortBy=refundDate
sortDirection=desc
```

Verify actual refund business dates.

If representative data has <=20 Refunds, use another >20-row table for cross-page proof, but still verify Refund ASC/DESC semantics directly.

---

# 63. SHARED IMPLEMENTATION

Prefer reusable primitives/contracts where appropriate, for example conceptually:

```text
SortableHeader
SortState
parseSortQuery
buildSortQuery
server sort allowlist helpers
```

Do not force abstraction if existing architecture already has a better reusable pattern.

Audit first.

---

# 64. DO NOT CREATE A SECOND TABLE SYSTEM

Round 5B already established the table visual grammar.

Sorting must extend that system.

Do not replace all tables with an unrelated new table library merely to gain sorting.

---

# 65. NO OPERATIONAL NOTES IN THIS ROUND

Do NOT implement:

```text
Operational Notes / Comments
```

This remains the next separate architecture topic.

---

# 66. NO STOREFRONT PRO CRM

Do NOT start:

```text
Storefront Pro CRM
Marketplace Basic CRM finalization
Partner workspace sidebar implementation
```

---

# 67. NO UNRELATED TABLE REDESIGN

Do not change:

```text
column meaning
business statuses
financial semantics
CRM relationship semantics
page layouts
```

except where strictly necessary to expose sorting.

---

# 68. REGRESSION GATES

Required:

```text
Backend TSC
Frontend TSC
Backend tests
Frontend tests
Backend build
Frontend build
```

Report exact counts.

---

# 69. RUNTIME AUTHORITY

Report:

```text
Repository path
branch
HEAD
origin/master
Frontend PID/CWD/port
Backend PID/CWD/port
API target
```

Browser evidence must correspond to the same localhost runtime observed by the user.

---

# 70. ACCEPTANCE CRITERIA

VERDICT A only if all applicable criteria pass:

1. Existing table sorting implementations audited.
2. One shared sorting contract documented.
3. Single-column user sorting only.
4. Multi-sort prohibited.
5. First click = ASC.
6. Second click = DESC.
7. New field replaces old field.
8. Only active field shows direction arrow.
9. ASC arrow points up.
10. DESC arrow points down.
11. Sortable headers have interactive affordance.
12. Non-sortable headers are not fake controls.
13. Keyboard sorting works.
14. Accessible sort state exists.
15. Paginated sorting is server-authoritative.
16. Sorting occurs before pagination.
17. API sort parameter convention is unified/documented.
18. Backend sort allowlists exist.
19. Unknown sort keys are safe.
20. Invalid direction is safe.
21. Arbitrary query-field injection is impossible.
22. Stable deterministic tie-breaker exists.
23. Tie-breaker does not become user-facing multi-sort.
24. Nullable sort behavior documented.
25. Payment sorting uses canonical Payment business date.
26. Refund sorting uses canonical Refund business date.
27. Numeric amount sorting is numeric.
28. Date sorting uses raw canonical date/timestamp.
29. Aggregate sorting is server-side where exposed.
30. Status sorting has documented semantics or is disabled.
31. Page 2 preserves sort field.
32. Page 2 preserves sort direction.
33. Page 3 preserves sort field/direction.
34. Sort field change resets page=1.
35. Direction change resets page=1.
36. Search change preserves sort and resets page=1.
37. Filter change preserves sort and resets page=1.
38. Page-size change preserves sort and resets page=1 where applicable.
39. URL contains explicit user sort state.
40. URL contains page state.
41. 360 URL preserves tab state.
42. Refresh preserves sorting.
43. Refresh preserves page.
44. Back restores sorting/page.
45. Forward restores sorting/page.
46. Copied deep link reproduces table state.
47. Pagination component does not drop query state.
48. Sort component does not drop search/filter/tab state.
49. Total count does not change due solely to sorting.
50. Stable pagination does not duplicate rows.
51. Stable pagination does not skip rows due to nondeterministic ordering.
52. Race-condition stale response does not override newest sort.
53. Loading does not show false empty.
54. Error != empty.
55. CRM Customers follows contract.
56. CRM Partners follows contract.
57. Customer Orders follows contract where sortable.
58. Customer Bookings follows contract where sortable.
59. Customer Payments follows contract.
60. Customer Partners follows contract where sortable.
61. Customer Refunds follows contract.
62. Partner Services follows contract where sortable.
63. Partner Orders follows contract where sortable.
64. Partner Bookings follows contract where sortable.
65. Partner Customers follows contract where sortable.
66. Shared table visual grammar preserved.
67. No second table system created.
68. RU/AZ/EN labels/tooltips PASS where added.
69. Raw i18n keys = 0.
70. URL State Matrix supplied.
71. Sorting Behavior Matrix supplied.
72. Backend Sort Allowlist Matrix supplied.
73. Default Order Matrix supplied.
74. Cross-page global ordering browser proof supplied.
75. Payment sorting browser proof supplied.
76. Refund sorting browser proof supplied.
77. Backend TSC PASS.
78. Frontend TSC PASS.
79. Backend tests PASS.
80. Frontend tests PASS.
81. Backend build PASS.
82. Frontend build PASS.
83. Operational Notes not implemented.
84. Storefront Pro CRM not started.
85. Unrelated files = 0.
86. Commit pushed.
87. HEAD == origin/master.
88. Browser evidence comes from same runtime observed by user.

---

# 71. VERDICT

Success:

```text
VERDICT A — PHASE 3 SHARED TABLE SORTING CONTRACT /
SINGLE-COLUMN SERVER-AUTHORITATIVE SORTING /
SORT + PAGINATION STATE PERSISTENCE /
URL STATE /
ASC-DESC VISUAL INDICATORS
FULLY IMPLEMENTED AND RUNTIME-VERIFIED
```

Failure:

```text
VERDICT B — SHARED TABLE SORTING CONTRACT INCOMPLETE
```

No conditional VERDICT A.

---

# 72. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_SHARED_TABLE_SORTING_CONTRACT_IMPLEMENTATION_REPORT.md
```

---

# 73. FINAL RESPONSE FORMAT

```text
VERDICT:

PRECONDITION:
Round 5B.1 accepted:
Starting SHA:

AUDIT:
Existing sorting:
Existing pagination:
Existing URL state:
Reusable table infrastructure:

SHARED SORT CONTRACT:
Parameters:
Directions:
Single-column rule:
Click cycle:
Tie-breaker:
Null policy:
Invalid-query policy:

URL STATE:
page:
sortBy:
sortDirection:
tab:
search:
filters:
pageSize:

PAGINATION PERSISTENCE:
Page 1:
Page 2:
Page 3:
Sort preserved:

SORT REPLACEMENT:
Previous:
New:
Page reset:
Old arrow removed:
New arrow:

PAYMENT SORT:
Canonical date source:
ASC:
DESC:
Null behavior:
Cross-page:

REFUND SORT:
Canonical date source:
ASC:
DESC:
Null behavior:
Cross-page:

CRM CUSTOMERS:
Sortable fields:
Default order:
Browser proof:

CRM PARTNERS:
Sortable fields:
Default order:
Browser proof:

CUSTOMER 360:
Orders:
Bookings:
Payments:
Partners:
Refunds:
History:

PARTNER 360:
Services:
Orders:
Bookings:
Customers:

URL STATE MATRIX:
...

SORTING BEHAVIOR MATRIX:
...

BACKEND SORT ALLOWLIST MATRIX:
...

DEFAULT ORDER MATRIX:
...

ACCESSIBILITY:
aria-sort:
Keyboard:
Focus:

CROSS-PAGE PROOF:
Dataset:
Total:
Page size:
Sort:
Page 1 boundary:
Page 2 boundary:
Duplicates:
Missing:

RUNTIME:
Repository:
Branch:
HEAD:
origin/master:
Frontend PID/CWD/port:
Backend PID/CWD/port:
API target:

Backend TSC:
Frontend TSC:
Backend tests:
Frontend tests:
Backend build:
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

# 74. STOP

After the report:

```text
STOP
```

Do not start Operational Notes / Comments implementation.

Do not start Storefront Pro CRM.

The next stage will be selected only after this sorting implementation and its browser behavior are reviewed.
