# PHASE 3 — PROJECT-WIDE TABLE PAGINATION STANDARD
## GLOBAL REMEDIATION — ALL TABLES DEFAULT TO 20 ROWS + MULTI-PAGE NAVIGATION
## APPLIES TO CATALOG / ORDERS / BOOKINGS / CRM / FINANCE / ALL CURRENT & FUTURE TABLES

---

# 1. ЦЕЛЬ

Зафиксировать и реализовать единый pagination standard для всех табличных представлений TravelHub.

Canonical UX rule:

```text
Every operational table/list
shows 20 records per page by default.

If total records > 20
→ multi-page navigation is mandatory.
```

Это правило действует не только для:

```text
Catalog
Orders
Bookings
```

а для ВСЕХ существующих и будущих таблиц проекта.

---

# 2. PROJECT-WIDE INVARIANT

```text
pageSize = 20 by default
```

Если:

```text
total <= 20
```

допустимо:

```text
one page
no next page
```

Если:

```text
total > 20
```

обязательно:

```text
multiple pages
page navigation
correct filtered total
stable filtering/sorting
```

---

# 3. НЕ ПУТАТЬ PAGE SIZE И TOTAL

Пример:

```text
Услуги без продаж = 31
```

Правильно:

```text
Найдено: 31
Показано: 1–20 из 31

‹ 1 2 ›
```

Страница 2:

```text
Показано: 21–31 из 31
```

Неправильно:

```text
Показано 20
второй страницы нет
```

если filtered total = 31.

---

# 4. CURRENT CONFIRMED DEFECT

Runtime:

```text
Decision Queue:
Услуги без продаж = 31

Открыть услуги:
видно 20 записей
второй страницы нет
```

Это подтверждённый FAIL.

Нужно исправить не только Catalog, но системно проверить все таблицы проекта.

---

# 5. GLOBAL SCOPE

Проверить минимум:

```text
Catalog
Orders
Bookings
CRM tables
Finance / Payments tables
Refund tables/views
Partner tables
Customer tables
Sales tables
Booking operational tables
Admin/Moderation tables
Decision/history tables where tabular pagination is applicable
```

а также любые другие operational data grids/list views.

---

# 6. EXCEPTIONS

Не применять автоматически к:

```text
small fixed KPI lists
static settings options
tiny non-tabular menus
short fixed reference lists
dropdown options
card grids with separate UX contract
```

Если UI фактически является operational records table/list, правило 20/page применяется.

---

# 7. DEFAULT PAGE SIZE

Canonical default:

```text
20
```

Не использовать случайные defaults:

```text
10
25
50
100
```

без documented exception.

---

# 8. PAGE-SIZE OPTIONS

Если design system поддерживает selector:

```text
20
50
100
```

Default:

```text
20
```

Если selector отсутствует, минимальный hard requirement:

```text
20 default
+
multi-page navigation
```

---

# 9. REQUIRED UI ELEMENTS

Для dataset > 20 пользователь должен видеть:

```text
filtered total
current range
current page
page navigation
previous / next
```

Пример:

```text
1–20 из 31

‹ 1 2 ›
```

или эквивалент existing design system.

---

# 10. FILTERED TOTAL

Pagination должна использовать:

```text
filtered total
```

а НЕ:

```text
all records total
```

Пример:

```text
Catalog total published = 129
Filter unsold=true = 31
```

UI должен показывать:

```text
1–20 из 31
```

а не:

```text
1–20 из 129
```

---

# 11. SERVER-SIDE PAGINATION

Для operational tables использовать server-side pagination.

Не загружать весь dataset только ради pagination UI.

Проверить:

```text
page / offset / cursor
limit/pageSize
filtered total
sort
search
filters
```

---

# 12. API CONTRACT

Каждый paginated endpoint должен иметь equivalent contract:

```text
items
total
page / offset / cursor
pageSize / limit
```

Exact field names могут различаться, semantics — единые.

---

# 13. NO rows.length AS TOTAL

Если backend возвращает первые 20 строк:

```text
rows.length = 20
```

это НЕ означает:

```text
total = 20
```

при server pagination.

UI должен использовать backend total.

---

# 14. FILTER PRESERVATION

При:

```text
page 1 → page 2
```

сохраняются:

```text
status
paymentStatus
refundStatus
paymentFailed
pendingRefund
unsold
availability
upcoming
overdue
cancelledWithin
search
date filters
partner scope
other active filters
```

---

# 15. SORT PRESERVATION

Active sort сохраняется между страницами.

---

# 16. SEARCH PRESERVATION

Search query сохраняется между страницами.

---

# 17. URL / NAVIGATION STATE

Если architecture поддерживает URL-backed pagination:

```text
?page=2
&pageSize=20
```

или existing canonical scheme.

Deep-link должен быть reproducible.

Back/forward не должны терять context.

---

# 18. FILTER CHANGE RESETS PAGE SAFELY

Если пользователь на:

```text
page 7
```

и меняет filter:

обычно:

```text
page = 1
```

Не оставлять stale empty page.

---

# 19. PAGE SIZE CHANGE

При:

```text
20 → 50
```

pagination пересчитывает page count/current range.

Filters/search/sort не теряются.

---

# 20. STABLE SORTING

Server-side pagination требует deterministic ordering.

Если primary sort не unique — использовать stable tie-breaker.

Цель:

```text
no duplicate rows between pages
no missing rows
```

---

# 21. EMPTY STATE

Если filtered total = 0:

```text
0 results
```

Pagination hidden/disabled appropriately.

Не fallback'ить на unfiltered list.

---

# 22. BOUNDARIES

Проверить:

```text
20 → 1 page
21 → 2 pages
40 → 2 pages
41 → 3 pages
```

---

# 23. CATALOG HARD GATE

Для current case:

```text
Services without sales = 31
```

После fix:

```text
Filtered total = 31
Page 1 rows = 20
Page 2 rows = 11
Page count = 2
```

Filter remains:

```text
status=PUBLISHED
unsold=true
```

---

# 24. CATALOG AVAILABILITY

Для:

```text
availability=missing
```

pagination сохраняет:

```text
status=PUBLISHED
availability=missing
```

---

# 25. ORDERS HARD GATE

Проверить:

```text
all orders
status filters
paymentFailed=true
pendingRefund=true
cancelledWithin=7
search
payment status
```

---

# 26. BOOKINGS HARD GATE

Проверить:

```text
all bookings
upcoming=true
overdue=true
status filters
search/date filters
```

---

# 27. CRM

До/при Step 3.5 все CRM operational tables должны использовать тот же standard:

```text
20 rows default
multi-page when >20
filtered total
filters/search/sort preserved
```

CRM не вводит отдельную несовместимую pagination model.

---

# 28. FUTURE TABLES

Любая новая operational table:

```text
Supplier Settlements
Payouts
Statements
Customers
Partners
Agreements
Audit
etc.
```

автоматически следует этому standard, если отдельным canonical decision не утверждено иное.

---

# 29. SHARED PAGINATION COMPONENT

Проверить, существует ли общий:

```text
Pagination
DataTable
TableFooter
Pager
```

Если да — reuse/extend.

Если нет и логика уже дублируется — создать минимальный shared pagination component/contract.

Не делать большой DataGrid redesign.

---

# 30. BACKEND CONSISTENCY

Проверить случаи:

```text
limit hardcoded to 20 but total missing
page ignored
offset ignored
filter applied after pagination
```

Canonical order:

```text
scope/security
→ filter
→ search
→ sort
→ total
→ pagination
```

---

# 31. FILTER BEFORE PAGINATION

Критический invariant:

```text
filter first
pagination second
```

Не:

```text
take first 20
then filter frontend
```

---

# 32. SECURITY

Pagination не меняет scope:

```text
RBAC
tenant
partner own-scope
workspace
IDOR
```

остаются server-authoritative.

---

# 33. PERFORMANCE

Не выполнять unbounded list queries.

Count query — canonical DB count/aggregation.

Не делать speculative migration без evidence.

---

# 34. RUNTIME INVENTORY

Составить inventory ВСЕХ current operational tables.

| Page / Table | Endpoint | Current page size | Has total? | Has pager? | >20 test | Status |
|---|---|---:|---:|---:|---:|---|

---

# 35. GLOBAL REMEDIATION MATRIX

Для каждой таблицы:

```text
PASS
FIXED
N/A
BLOCKED
```

Без unexplained tables.

---

# 36. AUTOMATED TESTS

Покрыть:

```text
0 rows
1 row
20 rows
21 rows
40 rows
41 rows
filtered total
page 2
page-size 20/50/100 where selector exists
filter persistence
sort persistence
search persistence
invalid page
invalid pageSize
```

---

# 37. API VALIDATION

Invalid:

```text
page=0
page=-1
pageSize=0
pageSize=-20
pageSize=999999
```

→ controlled handling, не HTTP 500.

---

# 38. BROWSER EVIDENCE

Проверить минимум:

```text
Catalog
Orders
Bookings
```

и representative другие tables >20 records.

Для каждой:

```text
total
page 1 rows
page 2 rows
page navigation
filters
search/sort where applicable
```

---

# 39. CURRENT DECISION QUEUE CASE

Проверить:

```text
Услуги без продаж → Открыть услуги
```

Expected:

```text
filtered total = detector count
page 1 = up to 20
page 2 = remainder when total >20
```

Если runtime count изменился — использовать фактический detector count.

---

# 40. REPORT FILE

Создать:

```text
docs/prompts/PHASE_3_PROJECT_WIDE_TABLE_PAGINATION_STANDARD_REMEDIATION_REPORT.md
```

---

# 41. REQUIRED REPORT — INVENTORY

| # | Page/Table | Total test data | Page size | Pages | Filters preserved | Result |
|---|---|---:|---:|---:|---:|---|

---

# 42. REQUIRED REPORT — BOUNDARIES

| Count | Expected pages @20 | Actual | PASS |
|---:|---:|---:|---:|
| 0 | 0/empty | | |
| 20 | 1 | | |
| 21 | 2 | | |
| 40 | 2 | | |
| 41 | 3 | | |

---

# 43. REQUIRED REPORT — DECISION QUEUE CASE

Для минимум:

```text
Services Without Sales
```

и других Decision Queue destinations с >20 filtered records:

```text
Signal:
Detector count:
Destination filtered total:
Page 1 rows:
Page 2 rows:
Page count:
Filter preserved:
PASS:
```

---

# 44. NO SCOPE CREEP

Не менять:

```text
Decision Signal semantics
Supplier Settlement architecture
CRM business model
Booking Commercial Terms
new KPIs
new lifecycle states
```

Только pagination infrastructure/UI/API consistency.

---

# 45. PRODUCTION CODE

Production code changes допустимы и ожидаются.

Unrelated code не включать.

---

# 46. GIT

После verification:

```text
git status
git diff
commit related files only
git push origin master
verify HEAD == origin/master
```

---

# 47. HARD ACCEPTANCE CRITERIA

VERDICT A только если:

1. Project-wide table inventory completed.
2. Every operational table default page size = 20 or documented exception.
3. Every operational table with total >20 has multi-page navigation.
4. Filtered total correct.
5. `rows.length` not misused as total.
6. Catalog pagination works.
7. Orders pagination works.
8. Bookings pagination works.
9. CRM standard recorded/applied where current tables exist.
10. Decision Queue filters persist across pages.
11. Services Without Sales >20 case has second page.
12. Availability pagination works.
13. Failed Payments pagination works.
14. Pending Refunds pagination works.
15. Upcoming Bookings pagination works.
16. Confirmation Delay pagination works.
17. Recent Cancellations pagination works.
18. Filters apply before pagination.
19. Search persists.
20. Sort persists.
21. Page resets safely on filter change.
22. Stable ordering prevents duplicate/missing rows.
23. 20-row boundary PASS.
24. 21-row boundary PASS.
25. 40-row boundary PASS.
26. 41-row boundary PASS.
27. Invalid page/pageSize controlled.
28. RBAC/tenant/workspace scope preserved.
29. No unbounded list regression.
30. Shared pagination pattern reused where appropriate.
31. Browser evidence recorded.
32. Relevant tests pass.
33. Backend TSC PASS.
34. Frontend TSC PASS.
35. Build gates PASS where relevant.
36. Unrelated files committed = 0.
37. Push complete.
38. HEAD == origin/master.

---

# 48. VERDICT

Только при всех gates:

```text
VERDICT A — PROJECT-WIDE TABLE PAGINATION STANDARD RECONCILED / 20-ROW DEFAULT / MULTI-PAGE NAVIGATION COMPLETE
```

Иначе:

```text
VERDICT B — PROJECT-WIDE TABLE PAGINATION REMEDIATION INCOMPLETE
```

---

# 49. FINAL RESPONSE FORMAT

```text
Verdict:

Global standard:
Operational table inventory:

Catalog:
Orders:
Bookings:
CRM:
Other tables:

Decision Queue filtered tables:
Services Without Sales:
Availability:
Failed Payments:
Pending Refunds:
Upcoming:
Confirmation Delay:
Recent Cancellations:

Pagination boundaries:
0:
20:
21:
40:
41:

Filters:
Search:
Sort:
URL/deep-link:
Security:
Performance:

Tests:
Browser:
Git:

Remaining findings:
```

---

# 50. STOP

После VERDICT:

**STOP.**

Не запускать автоматически:

```text
CRM Step 3.5
Supplier Settlement S.1–S.19
Booking Commercial Terms implementation
new Command Center KPIs
other Phase 3 stages
```
