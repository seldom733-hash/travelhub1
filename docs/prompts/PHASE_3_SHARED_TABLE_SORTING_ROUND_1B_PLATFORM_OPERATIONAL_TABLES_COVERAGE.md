# PHASE 3 — SHARED TABLE SORTING CONTRACT
## ROUND 1B — PLATFORM OPERATIONAL TABLES COVERAGE
## ORDERS / BOOKINGS / USERS — SORTABLE HEADERS / SERVER-SIDE ORDERING / PAGINATION + URL STATE PERSISTENCE

---

# 1. STATUS

Shared sorting already exists and has been wired into CRM:

```text
SortableHeader
buildSortClause()
sortBy
sortDirection
single-column ASC/DESC
server-side allowlists
stable id tie-breaker
URL state
pagination persistence
```

Round 1A fixed missing runtime wiring in CRM.

However major Platform operational tables still do not use the shared contract:

```text
/app/orders
/app/bookings
/app/users
```

Therefore Shared Table Sorting is not yet fully closed for current Platform operational tables.

---

# 2. PURPOSE

Apply the EXISTING shared sorting infrastructure to:

```text
Platform Orders
Platform Bookings
Platform Users
```

Do not create a second sorting system.

Target:

```text
Shared Table Sorting
├── CRM              ✅
├── Orders           ← implement
├── Bookings         ← implement
└── Users            ← implement
```

---

# 3. FIRST ACTION — AUDIT

Before code changes inspect each page and report:

```text
frontend route
table component
current columns
pagination
search/filter state
API endpoint
backend query DTO
service query
existing sort support
default order
permissions/scope
```

Required matrix:

| Page | Route | API | Current columns | pageSize | Existing sort | Shared header |
|---|---|---|---|---:|---|---|
| Orders | | | | | | |
| Bookings | | | | | | |
| Users | | | | | | |

---

# 4. REUSE EXISTING INFRASTRUCTURE

Reuse:

```text
SortableHeader
buildSortClause()
sortBy
sortDirection
server allowlists
URL query state
stable tie-breaker
existing pagination
```

Forbidden unless proven necessary:

```text
OrdersSortableHeader
BookingsSortableHeader
UsersSortableHeader
new sort helper
new query naming convention
```

---

# 5. SINGLE-COLUMN SORT CONTRACT

Required:

```text
first click  → ASC ↑
second click → DESC ↓
next click   → ASC ↑
```

Click another sortable column:

```text
old sort removed
new column ASC ↑
```

Only ONE user-selected sort field may be active.

Forbidden:

```text
multi-sort
Shift/Ctrl sort
multiple active arrows
```

Internal deterministic tie-breaker is allowed.

---

# 6. VISUAL CONTRACT

Only the active column shows the active direction indicator:

```text
ASC  → ↑
DESC → ↓
```

Example:

```text
Заказ | Создан ↓ | Клиент | Сумма | Статус
```

Sortable headers must have:

```text
pointer/hover affordance
keyboard focus
aria-sort
Enter/Space activation
```

Non-sortable headers must remain non-interactive.

---

# 7. SERVER-SIDE SORTING BEFORE PAGINATION

Hard invariant for paginated tables:

```text
UI sort
→ API sortBy/sortDirection
→ backend allowlist
→ DB/query ORDER BY
→ pagination
→ render
```

Forbidden:

```text
fetch 20 rows
→ client Array.sort()
```

Global sorting must be applied before page slicing.

---

# 8. STABLE PAGINATION

Preserve internal stable tie-breaker, conceptually:

```text
ORDER BY selectedField direction, id DESC
```

The tie-breaker is internal only; it is NOT user-visible multi-sort.

No duplicate/missing rows between pages due to nondeterministic ordering.

---

# 9. URL STATE

Sorting must be represented in URL:

```text
?page=2&sortBy=createdAt&sortDirection=desc
```

Use existing project query conventions if already canonical.

---

# 10. PAGINATION MUST PRESERVE SORT

Required:

```text
page 1 + createdAt DESC
→ page 2 + createdAt DESC
→ page 3 + createdAt DESC
```

The same arrow remains visible.

Only `page` changes.

---

# 11. SORT CHANGE RESETS PAGE

If user is on page 5 and changes sort field or direction:

```text
page=1
```

Required.

---

# 12. REFRESH / BACK / FORWARD / DIRECT URL

Required:

```text
Refresh       → page + sort preserved
Back          → previous page/sort restored
Forward       → next page/sort restored
Direct URL    → reproduces page/sort state
```

---

# 13. SEARCH + FILTER COMPOSITION

Where search/filter exists:

```text
sort + search + filters + pagination
```

must compose.

Rules:

```text
sort change   → preserve search/filters, reset page=1
search change → preserve sort, reset page=1
filter change → preserve sort, reset page=1
page change   → preserve sort/search/filters
```

---

# 14. ORDERS — AUDIT SORTABLE FIELDS

Inspect actual fields.

Candidates only where canonical backend semantics exist:

```text
Order code/number
createdAt
Customer
Partner
amount/total
status
```

Do not make unsupported fields clickable.

Minimum expected if visible:

```text
Создан ↑ / ↓
```

Also evaluate code, customer, partner, amount and status.

---

# 15. ORDERS — SORT SEMANTICS

Amount:

```text
numeric sort only
```

If currencies differ and there is no normalized comparable amount, document limitation.

Status:

```text
document lexical/business ordering
or keep non-sortable
```

Do not invent hidden business priority.

---

# 16. BOOKINGS — AUDIT SORTABLE FIELDS

Candidates where canonical:

```text
Booking code
createdAt
Customer
Partner
service date
amount
status
```

Creation date and service date are distinct.

Required if visible:

```text
Создан ↑ / ↓
```

If service date is sortable:

```text
Дата услуги ↑ / ↓
```

must use the actual service-date field, not `createdAt`.

---

# 17. USERS — AUDIT SORTABLE FIELDS

Candidates where canonical:

```text
code/id
name
email
role
status
createdAt
lastLoginAt / lastActivityAt
```

Do not invent fields.

Role sorting must have documented semantics; otherwise disable it.

Last activity must use a real canonical field or remain non-sortable.

---

# 18. BACKEND SORT ALLOWLISTS

Expose only server-approved keys.

Required mapping:

```text
public sort key
→ canonical DB/query field/expression
```

Unknown fields/directions must be handled safely.

No arbitrary field passthrough.

---

# 19. DEFAULT ORDER

Document current default order for:

```text
Orders
Bookings
Users
```

Do not silently change default ordering.

If no explicit user sort exists, canonical default may remain without active arrow.

---

# 20. NULL / NAME / CODE SEMANTICS

Document null sorting where nullable.

Name sorting must use actual DB collation; do not claim locale-perfect RU/AZ/EN sorting unless proven.

Code sorting must follow canonical business-code semantics.

---

# 21. CROSS-PAGE GLOBAL ORDERING

For each table with total >20 prove:

```text
page 1 = first 20 rows of global sort
page 2 = next 20 rows
```

No per-page local sorting.

---

# 22. ERROR / LOADING

Preserve:

```text
error != empty
loading != empty
```

Sort request failures must not appear as zero results.

---

# 23. PAGE SIZE

Preserve the current project-wide operational default:

```text
pageSize = 20
```

unless an explicit canonical exception already exists.

---

# 24. NO UNRELATED REDESIGN

Do not redesign columns, statuses, business semantics or page layouts.

This Round only extends the shared sorting contract.

---

# 25. CRM REGRESSION

Do not rework CRM except for unavoidable shared-component fixes.

Verify no regression in:

```text
CRM Customers
CRM Partners
Customer 360
Partner 360
Payment sort → paidAt
Refund sort → processedAt
```

---

# 26. OUT OF SCOPE

Do NOT start:

```text
Operational Notes / Comments
Storefront Pro CRM
Marketplace Basic CRM finalization
Partner Workspace sidebar implementation
```

---

# 27. REQUIRED PLATFORM COVERAGE MATRIX

| Page | Sortable fields | Shared SortableHeader | Backend allowlist | URL state | Pagination preserves | Browser PASS |
|---|---|---|---|---|---|---|
| Orders | | | | | | |
| Bookings | | | | | | |
| Users | | | | | | |

---

# 28. REQUIRED ORDERS SORT MATRIX

| Column | sortBy | Backend field/expression | ASC | DESC | Page 2 preserves | PASS |
|---|---|---|---|---|---|---|
| | | | | | | |

---

# 29. REQUIRED BOOKINGS SORT MATRIX

| Column | sortBy | Backend field/expression | ASC | DESC | Page 2 preserves | PASS |
|---|---|---|---|---|---|---|
| | | | | | | |

---

# 30. REQUIRED USERS SORT MATRIX

| Column | sortBy | Backend field/expression | ASC | DESC | Page 2 preserves | PASS |
|---|---|---|---|---|---|---|
| | | | | | | |

---

# 31. BROWSER PROOF — ORDERS

On real `/app/orders`:

```text
1. click sortable header
2. see ↑
3. rows reorder
4. click same header
5. see ↓
6. rows reorder
7. click another field
8. old arrow disappears
9. new ↑ appears
10. page resets to 1
11. go page 2
12. sort persists
13. refresh
14. sort/page persist
```

---

# 32. BROWSER PROOF — BOOKINGS

Repeat on `/app/bookings`.

At minimum prove a canonical date sort.

---

# 33. BROWSER PROOF — USERS

Repeat on `/app/users`.

If total >20, include cross-page proof.

If <=20, record actual total and mark cross-page N/A while still proving ASC/DESC.

---

# 34. REQUIRED CROSS-PAGE EVIDENCE

For every in-scope table with total >20 report:

```text
table
total
pageSize
sort field
direction
page 1 last row
page 2 first row
duplicate IDs across boundary
ordering continuity
arrow on page 2
URL on page 2
```

---

# 35. REQUIRED SORT REPLACEMENT PROOF

Example:

```text
Created DESC
→ click Amount
```

Required:

```text
Amount ASC
old arrow gone
page=1
URL contains only new user sort
```

---

# 36. URL / HISTORY PROOF

At least one in-scope page must prove:

```text
refresh
Back
Forward
direct copied URL
```

restores:

```text
page
sortBy
sortDirection
```

---

# 37. TESTS — FRONTEND

Add/update integration tests for real pages:

```text
click → ASC
second click → DESC
new field replaces old
only one active arrow
page reset
pagination preserves sort
URL updates
search/filter preserved
aria-sort
keyboard behavior
```

Do not test only SortableHeader in isolation.

---

# 38. TESTS — BACKEND

For changed endpoints cover applicable:

```text
ASC
DESC
invalid key
invalid direction
sort before pagination
stable tie-breaker
filter + sort
search + sort
scope preserved
```

---

# 39. SECURITY

Sorting must not alter authorization or data scope.

Only ordering changes.

---

# 40. I18N

Any new visible labels/tooltips/accessibility text:

```text
RU
AZ
EN
```

Raw keys = 0.

---

# 41. BUILD GATES

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

# 42. RUNTIME AUTHORITY

Report:

```text
Repository path
Branch
HEAD
origin/master
Frontend PID/CWD/port
Backend PID/CWD/port
API target
```

Browser evidence must come from the same localhost runtime observed by the user.

---

# 43. ACCEPTANCE CRITERIA

VERDICT A only if all applicable items pass:

1. Orders audited.
2. Bookings audited.
3. Users audited.
4. Existing shared infrastructure reused.
5. No second sorting system introduced.
6. Orders real headers wired.
7. Bookings real headers wired.
8. Users real headers wired.
9. Headers visibly interactive.
10. First click = ASC.
11. ASC shows ↑.
12. Second click = DESC.
13. DESC shows ↓.
14. New field replaces old sort.
15. Old arrow disappears.
16. Single user sort only.
17. Sort change resets page=1.
18. Direction change resets page=1.
19. Page 2 preserves sort.
20. Page 3 preserves sort where available.
21. Active arrow persists across pages.
22. Sorting is server-side.
23. Sorting occurs before pagination.
24. No client-only sorting of paginated rows.
25. pageSize=20 preserved.
26. Search + sort composes where applicable.
27. Filter + sort composes where applicable.
28. Pagination preserves search/filters.
29. URL stores page/sortBy/sortDirection.
30. Refresh preserves state.
31. Back restores state.
32. Forward restores state.
33. Direct URL restores state.
34. Backend allowlist covers every exposed sort key.
35. Invalid keys are safe.
36. Stable tie-breaker preserved.
37. No duplicate/skipped rows due to unstable order.
38. Numeric amount sorting is numeric.
39. Date sorting uses canonical dates.
40. Status semantics documented or disabled.
41. Booking service-date sort uses actual service date.
42. User last-activity sort uses canonical field or is disabled.
43. Sorting does not alter total.
44. Sorting does not alter permissions/scope.
45. Error != empty.
46. Loading != empty.
47. Orders browser proof supplied.
48. Bookings browser proof supplied.
49. Users browser proof supplied.
50. Platform Coverage Matrix supplied.
51. Orders Sort Matrix supplied.
52. Bookings Sort Matrix supplied.
53. Users Sort Matrix supplied.
54. Cross-page proof supplied for all >20 datasets.
55. Sort replacement proof supplied.
56. URL/history proof supplied.
57. CRM regression PASS.
58. Payment paidAt sorting regression PASS.
59. Refund processedAt sorting regression PASS.
60. Backend TSC/tests/build PASS.
61. Frontend TSC/tests/build PASS.
62. Raw i18n keys = 0.
63. Operational Notes not started.
64. Storefront Pro CRM not started.
65. Unrelated files = 0.
66. Commit pushed.
67. HEAD == origin/master.
68. Browser evidence from the same localhost runtime observed by user.

---

# 44. VERDICT

Success:

```text
VERDICT A — PHASE 3 SHARED TABLE SORTING ROUND 1B /
PLATFORM OPERATIONAL TABLES COVERAGE /
ORDERS + BOOKINGS + USERS /
SINGLE-COLUMN SERVER-SIDE SORTING /
PAGINATION + URL STATE PERSISTENCE
FULLY IMPLEMENTED AND BROWSER-VERIFIED
```

Failure:

```text
VERDICT B — SHARED TABLE SORTING PLATFORM COVERAGE INCOMPLETE
```

No conditional VERDICT A.

---

# 45. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_SHARED_TABLE_SORTING_ROUND_1B_PLATFORM_OPERATIONAL_TABLES_REPORT.md
```

---

# 46. FINAL RESPONSE FORMAT

```text
VERDICT:

PRECONDITION:
Round 1A accepted:
Starting SHA:

AUDIT:
Orders:
Bookings:
Users:

SHARED INFRASTRUCTURE:
SortableHeader:
Backend helper:
Query params:
Tie-breaker:
URL state:

PLATFORM COVERAGE MATRIX:
...

ORDERS:
Route:
API:
Total:
Sortable fields:
Default order:
Browser proof:
Cross-page proof:

ORDERS SORT MATRIX:
...

BOOKINGS:
Route:
API:
Total:
Sortable fields:
Default order:
Browser proof:
Cross-page proof:

BOOKINGS SORT MATRIX:
...

USERS:
Route:
API:
Total:
Sortable fields:
Default order:
Browser proof:
Cross-page proof:

USERS SORT MATRIX:
...

SORT REPLACEMENT:
Previous:
New:
Old arrow removed:
Page reset:
URL:

URL / HISTORY:
Refresh:
Back:
Forward:
Direct URL:

CRM REGRESSION:
Customers:
Partners:
Customer 360:
Partner 360:
Payment paidAt:
Refund processedAt:

RUNTIME:
Repository:
Branch:
HEAD:
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

# 47. STOP

After report:

```text
STOP
```

Do NOT start Operational Notes / Comments.
Do NOT start Storefront Pro CRM.

Only after manual browser verification confirms Orders, Bookings and Users sorting may Shared Table Sorting be declared:

```text
FULLY CLOSED FOR CURRENT PLATFORM OPERATIONAL TABLES
```
