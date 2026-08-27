# PHASE 3 — SHARED TABLE SORTING CONTRACT
## ROUND 1A — RUNTIME WIRING / SORTABLE HEADER INTEGRATION REMEDIATION
## CLICKABLE COLUMN HEADERS / ASC-DESC INDICATORS / URL STATE / SERVER SORT / PAGINATION PERSISTENCE

---

# 1. STATUS

Previous report claimed:

```text
VERDICT A — Shared Table Sorting Contract
Commit: d3ee4fb
```

Reported implementation included:

```text
SortableHeader
single-column sorting
ASC / DESC
server-side sorting
sort allowlists
URL state
pagination persistence
paymentDate → paidAt
refundDate → processedAt
```

However manual browser verification on the actual localhost runtime shows:

```text
column headers are NOT clickable
ASC / DESC arrows are NOT visible
user cannot trigger sorting from the table UI
```

Therefore the previous final verdict is NOT accepted yet.

Current qualification:

```text
VERDICT B — SHARED TABLE SORTING UI NOT RUNTIME-WIRED
```

This remediation is intentionally narrow.

Do NOT redesign the backend sorting contract.
Do NOT create another sorting system.
Do NOT start Operational Notes / Comments.
Do NOT start Storefront Pro CRM.

---

# 2. PURPOSE

Prove and fix the complete user-visible sorting chain:

```text
real table <th>
↓ click / keyboard
shared SortableHeader
↓
sort state changes
↓
URL changes
↓
API request includes sortBy + sortDirection
↓
backend allowlist resolves field
↓
server ORDER BY
↓
pagination applied
↓
new rows render
↓
active ↑ / ↓ indicator visible
```

A helper/component existing in source is NOT sufficient.

The sorting contract is accepted only when actual operational tables use it in the browser.

---

# 3. ROOT-CAUSE QUESTION

Determine why:

```text
SortableHeader exists
```

but:

```text
actual table headers remain non-interactive
```

Investigate concrete possibilities:

```text
component created but never used
only some tables wired
wrong table component still renders <th>
onSort callback missing
sort props not passed
URL state helper not connected
table columns lack sortable metadata
CSS/pointer-events blocks interaction
runtime uses stale component
wrong route uses another renderer
```

Report exact file/component/root cause.

---

# 4. NO DUPLICATE SORTABLE HEADER

Forbidden:

```text
SortableHeaderV2
CrmSortableHeader
PartnerSortableHeader
PaymentSortableHeader
```

as parallel implementations unless the existing shared component is proven unusable.

Prefer one shared sortable-header primitive.

---

# 5. REQUIRED SOURCE INVENTORY

Inventory actual rendering paths for:

```text
CRM → Клиенты
CRM → Партнёры

Customer 360:
- Заказы
- Бронирования
- Платежи
- Партнёры
- Возвраты

Partner 360:
- Услуги
- Заказы
- Бронирования
- Клиенты
```

For each report:

```text
route
page/component file
table renderer
header renderer
sorting props source
API call
backend endpoint
```

---

# 6. SORTABLE HEADER CONTRACT

A sortable header must provide:

```text
visible column label
interactive click target
keyboard interaction
focus state
active sort indicator
accessible sort state
```

Required visual behavior:

```text
ASC  → ↑
DESC → ↓
```

Equivalent existing chevron icons are acceptable if direction is unmistakable.

---

# 7. CLICK CYCLE

Required:

```text
unsorted field
→ first click = ASC ↑

same active field
→ second click = DESC ↓

same active field
→ next click = ASC ↑
```

No multi-sort.

---

# 8. SINGLE-COLUMN REPLACEMENT

Example:

```text
Дата оплаты ↓
```

then click:

```text
Сумма
```

Required:

```text
Сумма ↑
```

and `Дата оплаты` loses its active arrow.

Hard invariant:

```text
only one user-selected sort field
```

---

# 9. ARROW VISIBILITY

Only the active sorted column shows an active direction arrow.

Required:

```text
Заказ | Создан ↓ | Клиент | Сумма | Статус
```

Inactive columns must not display active-sort arrows.

---

# 10. SORTABLE vs NON-SORTABLE COLUMNS

Do NOT make every header clickable.

Sortable only where a canonical backend sort key exists.

Likely sortable where supported:

```text
code / number
name
createdAt
service date
paymentDate
refundDate
amount
status
last activity
orders count
bookings count
```

Likely non-sortable unless explicitly supported:

```text
Что оплачено
Состав заказа
Причина возврата
complex mixed context
action columns
```

---

# 11. URL STATE MUST CHANGE ON CLICK

First click conceptually:

```text
?sortBy=createdAt&sortDirection=asc&page=1
```

Second click:

```text
?sortBy=createdAt&sortDirection=desc&page=1
```

Do not keep sort state only in React memory.

---

# 12. TAB STATE MUST SURVIVE

For 360 pages:

```text
?tab=payments
```

must remain when sorting.

Example:

```text
/app/crm/customers/:id?tab=payments&sortBy=paymentDate&sortDirection=desc&page=1
```

---

# 13. PAGE RESET ON SORT CHANGE

When field or direction changes:

```text
page=1
```

required.

---

# 14. PAGINATION MUST PRESERVE SORT

Hard requirement:

```text
page=1, sortBy=createdAt, sortDirection=desc
→ page=2, same sort
→ page=3, same sort
```

The active arrow must remain visible.

---

# 15. GLOBAL SORT, NOT CURRENT-PAGE SORT

For total > 20:

```text
server sorts complete authorized result
THEN paginates
```

Forbidden:

```text
fetch 20
→ frontend sort only those 20
```

---

# 16. CROSS-PAGE CONTINUITY

Use at least one dataset with >20 rows.

Prove page 2 continues the same global order from page 1.

No duplicate or skipped IDs caused by unstable ordering.

---

# 17. STABLE TIE-BREAKER

Preserve accepted backend behavior:

```text
user sort
+
internal deterministic id tie-breaker
```

Example:

```text
createdAt DESC, id DESC
```

This is not user multi-sort.

---

# 18. CRM CUSTOMERS — REQUIRED WIRING

Actual top-level `CRM → Клиенты` headers must use the sorting primitive.

Browser prove supported columns, for example:

```text
Код ↑ / ↓
Имя ↑ / ↓
```

and Status only if canonical sorting exists.

---

# 19. CRM PARTNERS — REQUIRED WIRING

Actual top-level `CRM → Партнёры` headers must be wired to sorting.

Browser prove supported fields.

---

# 20. CUSTOMER 360 → ORDERS

At minimum browser-prove:

```text
Создан ↑ / ↓
```

and other fields only where supported.

---

# 21. CUSTOMER 360 → BOOKINGS

At minimum browser-prove:

```text
Создан ↑ / ↓
```

and service-date sorting if it exists.

---

# 22. CUSTOMER 360 → PAYMENTS

Critical Round 5B.1 integration:

```text
Дата оплаты
→ click
→ sortBy=paymentDate
→ backend paidAt
```

Browser proof must show `↑` and `↓`.

Do NOT sort by Payment `createdAt`.

---

# 23. CUSTOMER 360 → REFUNDS

Critical:

```text
Дата возврата
→ click
→ sortBy=refundDate
→ backend processedAt
```

Browser prove `↑` and `↓`.

Do NOT sort by refund-request `createdAt`.

---

# 24. CUSTOMER 360 → PARTNERS

Wire supported aggregate fields where backend allowlist exists:

```text
Партнёр
Заказы
Бронирования
Сумма заказов
Последняя активность
```

Aggregate sorting must remain server-side.

---

# 25. PARTNER 360 → SERVICES

Wire supported fields such as:

```text
Услуга
Создан
Статус
```

At minimum prove `Создан ↑ / ↓` if supported.

---

# 26. PARTNER 360 → ORDERS

Wire supported fields.

At minimum:

```text
Создан ↑ / ↓
Сумма ↑ / ↓
```

where canonical.

---

# 27. PARTNER 360 → BOOKINGS

Wire supported fields.

At minimum `Создан ↑ / ↓`.

---

# 28. PARTNER 360 → CUSTOMERS

Wire supported aggregate fields:

```text
Клиент
Заказы
Бронирования
Сумма заказов
Последняя активность
```

Preserve distinct commercial-customer semantics.

---

# 29. EXISTING BACKEND SORT CONTRACT MUST BE REUSED

Previous implementation reported:

```text
buildSortClause()
sortBy
sortDirection
sort allowlists
id DESC tie-breaker
```

Audit and reuse it.

Do not rewrite working backend sorting unless a real mismatch is found.

---

# 30. PAYMENT / REFUND BUSINESS DATE AUTHORITY

Precondition:

```text
Payment canonical date = paidAt
Refund canonical date = processedAt
```

Sorting must use:

```text
paymentDate → paidAt
refundDate → processedAt
```

---

# 31. NULL DATE SORTING

Document null ordering for:

```text
unpaid Payment → paidAt NULL
unprocessed Refund → processedAt NULL
```

Do not hide null rows.

---

# 32. ACCESSIBILITY

Required:

```text
keyboard focus
Enter/Space activation
aria-sort
focus-visible
```

Active column should expose ascending/descending semantics.

---

# 33. POINTER / HOVER AFFORDANCE

Sortable headers must look interactive:

```text
cursor pointer
hover/focus treatment
```

or established equivalent.

No static-looking secret click behavior.

---

# 34. SEARCH + SORT

Changing search:

```text
preserve sort
reset page=1
```

Changing sort:

```text
preserve search
reset page=1
```

---

# 35. FILTER + SORT

Sorting and pagination must preserve active filters.

---

# 36. PAGINATION QUERY MERGE

Pagination must merge query state rather than replacing it.

Preserve:

```text
sortBy
sortDirection
tab
search
filters
```

---

# 37. SORT QUERY MERGE

Sorting must preserve:

```text
tab
search
filters
```

and replace only:

```text
sortBy
sortDirection
page=1
```

---

# 38. REFRESH

Required browser proof:

```text
sort column
go page 2
refresh
```

After refresh:

```text
same page
same sort
same direction
same arrow
same ordered result
```

---

# 39. BACK / FORWARD

Browser Back/Forward must restore prior page + sort state.

---

# 40. DIRECT URL

Opening a URL containing:

```text
page
sortBy
sortDirection
tab
```

must reproduce the correct table state.

---

# 41. NETWORK EVIDENCE

For critical tables record actual browser requests.

At minimum:

```text
CRM Customers
Customer Payments
Customer Refunds
Partner Customers
```

Report:

```text
request URL
sortBy
sortDirection
page
HTTP 200
```

---

# 42. RENDER EVIDENCE

For each critical table prove:

```text
header clickable
arrow visible
rows reorder
```

Network evidence alone is insufficient.

---

# 43. NO FAKE CLIENT SORT

No client-only `.sort()` over paginated operational rows.

Tiny complete non-paginated local lists may be exceptions only if explicitly classified.

---

# 44. RACE CONDITION

Rapid clicks must not allow stale responses to overwrite the newest sort state.

---

# 45. ERROR / LOADING

Preserve:

```text
error != empty
loading != empty
```

No false zero during sort requests.

---

# 46. I18N

Any new visible sort labels/tooltips must support RU/AZ/EN.

Raw i18n keys = 0.

---

# 47. NO TABLE REDESIGN

Do not change unrelated:

```text
columns
business meanings
status semantics
financial semantics
CRM relationships
360 layouts
```

---

# 48. NO OPERATIONAL NOTES

Do NOT start Operational Notes / Comments.

---

# 49. NO STOREFRONT PRO CRM

Do NOT start Storefront Pro CRM or Marketplace Basic CRM finalization.

---

# 50. REQUIRED WIRING MATRIX

| Table | Header component before | Header component after | Sort state source | URL wired | API wired | Runtime clickable | PASS |
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

---

# 51. REQUIRED BROWSER SORT MATRIX

| Table | Column | ASC arrow | DESC arrow | Rows reorder | Page reset | Page 2 preserves | PASS |
|---|---|---|---|---|---|---|---|
| CRM Customers | | | | | | | |
| CRM Partners | | | | | | | |
| Customer Orders | Created | | | | | | |
| Customer Bookings | Created | | | | | | |
| Customer Payments | Payment date | | | | | | |
| Customer Refunds | Refund date | | | | | | |
| Partner Services | Created | | | | | | |
| Partner Orders | Created | | | | | | |
| Partner Bookings | Created | | | | | | |
| Partner Customers | Last activity / supported | | | | | | |

---

# 52. REQUIRED CROSS-PAGE PROOF

Use one table with total >20.

Report:

```text
sort field:
direction:
page size: 20
page 1 last row:
page 2 first row:
ordering relation:
duplicate IDs across pages: 0
missing IDs due to unstable sort: 0
active arrow page 1:
active arrow page 2:
URL page 1:
URL page 2:
```

---

# 53. REQUIRED PAYMENT SORT PROOF

Customer 360 → Payments:

```text
click Дата оплаты
→ ↑
→ URL sortBy=paymentDate&sortDirection=asc

click again
→ ↓
→ URL sortBy=paymentDate&sortDirection=desc
```

Backend:

```text
paymentDate → paidAt
```

---

# 54. REQUIRED REFUND SORT PROOF

Customer 360 → Refunds:

```text
click Дата возврата
→ ↑
→ refundDate ASC

click again
→ ↓
→ refundDate DESC
```

Backend:

```text
refundDate → processedAt
```

---

# 55. REQUIRED SORT REPLACEMENT PROOF

Example:

```text
Создан ↓
```

click:

```text
Сумма
```

Required:

```text
Сумма ↑
Создан has no active arrow
URL has only amount sort
page=1
```

No cross-sort.

---

# 56. REQUIRED PAGINATION PERSISTENCE PROOF

Example:

```text
Сумма ↓, page 1
→ page 2
→ page 3
```

Required:

```text
same arrow
same sortBy
same sortDirection
```

---

# 57. TESTS — FRONTEND

Add/update integration tests for actual table pages/components:

```text
click header → ASC
second click → DESC
new header replaces previous
only one active arrow
page reset on sort
pagination preserves sort
tab preserved
search preserved
filter preserved
aria-sort
keyboard interaction
URL changes
```

Do not test only isolated SortableHeader.

---

# 58. TESTS — BACKEND

If backend did not change, run existing sorting regression suite.

If endpoint/allowlist changes, add focused tests.

Preserve:

```text
sort before pagination
invalid sort safe
tie-breaker stable
paymentDate → paidAt
refundDate → processedAt
```

---

# 59. BUILD GATES

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

# 60. RUNTIME AUTHORITY

Prove:

```text
Repository path
Branch
HEAD
origin/master
Frontend PID / CWD / port
Backend PID / CWD / port
API target
```

Browser evidence must be from the same localhost instance observed by the user.

---

# 61. NO VERDICT A FROM SOURCE INSPECTION ONLY

Forbidden closure based only on:

```text
SortableHeader exists
tests pass
API sorts
build passes
```

VERDICT A requires:

```text
actual browser click
actual arrow
actual URL change
actual server request
actual rows reorder
actual pagination persistence
```

---

# 62. ACCEPTANCE CRITERIA

VERDICT A only if all applicable criteria pass:

1. Root cause of non-clickable headers identified.
2. Existing shared SortableHeader audited.
3. No unnecessary duplicate sorting component introduced.
4. CRM Customers wired.
5. CRM Partners wired.
6. Customer Orders wired.
7. Customer Bookings wired.
8. Customer Payments wired.
9. Customer Partners wired.
10. Customer Refunds wired.
11. Partner Services wired.
12. Partner Orders wired.
13. Partner Bookings wired.
14. Partner Customers wired.
15. Sortable headers visually interactive.
16. Hover/pointer affordance works.
17. Keyboard sorting works.
18. Accessible sort state works.
19. First click = ASC.
20. ASC shows ↑.
21. Second click = DESC.
22. DESC shows ↓.
23. New column replaces previous sort.
24. Old active arrow disappears.
25. Only one user sort active.
26. Multi-sort prohibited.
27. Sort change resets page=1.
28. Direction change resets page=1.
29. Pagination preserves sortBy.
30. Pagination preserves sortDirection.
31. Page 2 keeps active arrow.
32. Page 3 keeps active arrow.
33. Sorting is server-authoritative.
34. Sorting happens before pagination.
35. No client-only sorting of paginated CRM rows.
36. URL stores sortBy.
37. URL stores sortDirection.
38. URL stores page.
39. 360 URL preserves tab.
40. Sorting preserves search.
41. Sorting preserves filters.
42. Pagination preserves search.
43. Pagination preserves filters.
44. Refresh preserves sort.
45. Refresh preserves page.
46. Refresh preserves active arrow.
47. Back restores prior sort/page.
48. Forward restores next sort/page.
49. Direct URL reproduces state.
50. Payment sort uses paidAt.
51. Refund sort uses processedAt.
52. Null financial dates follow documented policy.
53. Stable tie-breaker preserved.
54. No duplicate rows across pages due to unstable sort.
55. No skipped rows due to unstable sort.
56. Sort error != empty.
57. Loading != empty.
58. Stale response cannot override newest sort.
59. Wiring Matrix supplied.
60. Browser Sort Matrix supplied.
61. Cross-page proof supplied.
62. Payment sort proof supplied.
63. Refund sort proof supplied.
64. Sort replacement proof supplied.
65. Pagination persistence proof supplied.
66. Browser/network evidence supplied.
67. Backend TSC PASS.
68. Backend tests PASS.
69. Backend build PASS.
70. Frontend TSC PASS.
71. Frontend tests PASS.
72. Frontend build PASS.
73. Raw i18n keys = 0.
74. Operational Notes not started.
75. Storefront Pro CRM not started.
76. No unrelated table redesign.
77. Unrelated files = 0.
78. Commit pushed.
79. HEAD == origin/master.
80. Browser evidence is from same localhost runtime observed by user.

---

# 63. VERDICT

Success:

```text
VERDICT A — PHASE 3 SHARED TABLE SORTING ROUND 1A /
RUNTIME SORTABLE HEADER WIRING /
CLICKABLE COLUMN HEADERS /
ASC-DESC INDICATORS /
SORT + PAGINATION PERSISTENCE
FULLY IMPLEMENTED AND BROWSER-VERIFIED
```

Failure:

```text
VERDICT B — SHARED TABLE SORTING RUNTIME WIRING INCOMPLETE
```

No conditional VERDICT A.

---

# 64. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_SHARED_TABLE_SORTING_ROUND_1A_RUNTIME_WIRING_REPORT.md
```

---

# 65. FINAL RESPONSE FORMAT

```text
VERDICT:

ROOT CAUSE:
Why headers were not clickable:
Affected components:
Why previous VERDICT A missed it:

RUNTIME:
Repository:
Branch:
HEAD:
origin/master:
Frontend PID/CWD/port:
Backend PID/CWD/port:
API target:

SORTABLE HEADER:
Shared component:
Files:
Click behavior:
ASC indicator:
DESC indicator:
Keyboard:
aria-sort:

WIRING MATRIX:
...

BROWSER SORT MATRIX:
...

CRM CUSTOMERS:
Sortable fields:
Browser evidence:

CRM PARTNERS:
Sortable fields:
Browser evidence:

CUSTOMER 360:
Orders:
Bookings:
Payments:
Partners:
Refunds:

PARTNER 360:
Services:
Orders:
Bookings:
Customers:

PAYMENT SORT:
UI label:
sortBy:
backend field:
ASC:
DESC:
Null handling:

REFUND SORT:
UI label:
sortBy:
backend field:
ASC:
DESC:
Null handling:

SORT REPLACEMENT:
Previous:
New:
Old arrow removed:
URL:
Page reset:

PAGINATION PERSISTENCE:
Sort:
Page 1:
Page 2:
Page 3:
Arrow preserved:
URL preserved:

CROSS-PAGE PROOF:
Dataset:
Total:
Page size:
Sort:
Page 1 boundary:
Page 2 boundary:
Duplicates:
Missing:

URL / HISTORY:
Refresh:
Back:
Forward:
Direct URL:
Search:
Filters:
Tab:

NETWORK EVIDENCE:
...

Backend changed:
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

# 66. STOP

After report:

```text
STOP
```

Do not start Operational Notes / Comments.
Do not start Storefront Pro CRM.

The Shared Table Sorting Contract remains open until manual browser verification confirms clickable headers, visible direction arrows, and sort persistence across pagination.
