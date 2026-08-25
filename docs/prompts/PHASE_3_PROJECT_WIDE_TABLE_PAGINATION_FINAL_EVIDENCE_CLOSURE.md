# PHASE 3 — PROJECT-WIDE TABLE PAGINATION — FINAL EVIDENCE CLOSURE

## COMPLETE OPERATIONAL TABLE INVENTORY / UX CONTRACT / RUNTIME PROOF

### 1. Цель

Предыдущий remediation сообщил `VERDICT A — PROJECT-WIDE TABLE PAGINATION STANDARD RECONCILED` и подтвердил core fixes для Catalog, Orders, Bookings, CRM Customers, Partners Onboarding и Seller Profiles.

Нужно выполнить **FINAL EVIDENCE CLOSURE**: не перепроектировать pagination и не менять бизнес-семантику, а доказать полноту project-wide inventory и закрыть недоказанные hard gates. Исправлять production code только при реально найденном residual defect.

### 2. Canonical standard — не менять

```text
Every scalable operational table/list:
default page size = 20

total <= 20 → one page
total > 20 → mandatory multi-page navigation
```

Дополнительно обязательны: filtered total, current range, page navigation, filter persistence, search persistence where supported, sort persistence where supported, stable ordering и safe page reset.

### 3. Repository-wide discovery

Предыдущий inventory содержал только:

```text
Catalog
Orders
Bookings
CRM Customers
Partners Onboarding
Seller Profiles
Users
```

Нужно доказать одно из двух: это полный inventory всех существующих operational tables проекта, либо найти пропущенные таблицы и проверить/исправить их.

Провести repository/runtime audit frontend страниц и компонентов, отображающих коллекции business records. Искать `<table>`, DataTable/Table/Grid/DataGrid, list views, mapped record rows, pagination components, page/limit/offset/cursor usage.

### 4. Domain coverage

Явно классифицировать каждый домен:

```text
Command Center
Analytics
Sales
Catalog
Orders
Bookings
CRM
Customers
Partners
Partner Onboarding
Seller Profiles
Finance
Payments
Refunds
Payouts
Users
Employees
Marketing
Moderation
Admin
Settings
Audit
Notifications
Messages (если есть operational table)
Supplier Settlement (только если runtime уже существует)
```

Для каждого вернуть одно: `TABLE EXISTS`, `NO OPERATIONAL TABLE`, `PLANNED / NOT IMPLEMENTED`, `N/A`.

### 5. Complete inventory matrix

Report MUST contain:

| # | Domain | Route | Table/List | Runtime implemented? | Endpoint/source | Total | Pagination status | Result |
|---|---|---|---|---|---|---:|---|---|

Ни один discovered operational table не оставлять без результата.

### 6. Default page size proof

Для каждой scalable implemented operational table доказать полный chain:

```text
UI → request/query → backend → response → rendered rows
```

Default page size = `20`.

Текущий маленький dataset не освобождает scalable table от pagination infrastructure.

### 7. Page-size selector policy

Окончательно зафиксировать один вариант:

```text
A. 20 / 50 / 100 selector implemented project-wide where applicable
```

или:

```text
B. Canonical default fixed at 20; selector intentionally deferred/not part of current hard standard
```

Не оставлять ambiguous. Обязательный минимум в обоих случаях: `20 default + multi-page navigation when total >20`.

### 8. Filter persistence

Проверить page 1 → page 2 → page 1 минимум для:

```text
Catalog: status=PUBLISHED + unsold=true
Catalog: status=PUBLISHED + availability=missing
Orders: paymentFailed=true
Orders: pendingRefund=true
Orders: status=CANCELLED + cancelledWithin=7
Bookings: upcoming=true
Bookings: overdue=true + canonical SLA params
```

Все filters должны сохраняться.

### 9. Search / sort persistence

Для каждой table с search: search остаётся активным при переходе между страницами.

Для каждой table с sorting: non-default sort остаётся активным при переходе между страницами.

Если search/sort не поддерживается — report `N/A`, не придумывать capability.

### 10. Safe page reset

Проверить:

```text
navigate to page >1
→ change filter/search
→ page safely resets to 1 (or equivalent canonical valid page)
```

Не оставлять stale empty page.

### 11. Stable ordering

Доказать deterministic server-side ordering:

```text
no duplicate records across adjacent pages
no missing records across adjacent pages
```

Если primary sort не unique — использовать canonical tie-breaker.

### 12. Boundary tests

Закрыть полный matrix:

| Total | Expected |
|---:|---|
| 0 | empty / pager hidden |
| 1 | 1 page |
| 20 | 1 page |
| 21 | 2 pages |
| 40 | 2 pages |
| 41 | 3 pages |

Если runtime dataset не имеет exact 40/41, использовать focused automated test/fixture.

Также доказать:

```text
31 → 20 + 11
40 → 20 + 20
41 → 20 + 20 + 1
1008 → 50 full pages + 8
703 → 35 full pages + 3
248 → 12 full pages + 8
```

если totals остаются такими же.

### 13. Catalog runtime proof

Для `Services Without Sales`:

```text
filtered total = detector count
page 1 <= 20
page 2 = remainder when total >20
status=PUBLISHED preserved
unsold=true preserved
evidence column preserved
```

Для `availability=missing` — аналогично.

### 14. Orders runtime proof

При total `1008`, если он не изменился:

```text
51 pages
page 51 = 8 records
```

Проверить page 1, page 2, last page.

Отдельно проверить Decision Queue filters: failed payments, pending refunds, recent cancellations.

### 15. Bookings runtime proof

При total `703`, если он не изменился:

```text
36 pages
page 36 = 3 records
```

Проверить page 1, page 2, last page, upcoming и confirmation-delay filters.

### 16. CRM Customers

При total `248`, если он не изменился:

```text
13 pages
page 13 = 8 records
```

### 17. Partners / Seller Profiles

`varies` недостаточно для final evidence. Вернуть фактический runtime/test total, pages и last-page count либо доказать `total <=20`.

### 18. Users

Если Users — scalable operational table, `total=1` не является основанием для отсутствия pagination infrastructure. Доказать, что при `>20` pager появится, либо исправить.

### 19. Decision Queue parity

Вернуть:

| Signal | Detector count | Destination filtered total | Pages @20 | PASS |
|---|---:|---:|---:|---|
| Services Without Sales | | | | |
| Review Availability | | | | |
| Failed Payments | | | | |
| Pending Refunds | | | | |
| Upcoming Bookings | | | | |
| Confirmation Delay | | | | |
| Recent Cancellations | | | | |

Не менять semantics этих predicates.

### 20. Backend contract

Canonical order:

```text
scope/security
→ filters
→ search
→ sort
→ total
→ pagination
```

Запрещено client-side fake pagination/filtering broad first-page data.

API должен различать page items и canonical total.

### 21. Security / performance

Подтвердить отсутствие regression:

```text
RBAC
tenant scope
partner scope
workspace scope
IDOR protections
```

Не вводить unbounded fetch/full-dataset frontend pagination для больших operational tables.

### 22. Browser evidence

Обязательно runtime/browser evidence минимум для:

```text
Catalog
Orders
Bookings
CRM Customers
one Partner-related table if implemented
```

и всех newly discovered/fixed tables.

HTTP 200 недостаточно. Зафиксировать total, current range, current page, last page, filters/search/sort state.

### 23. Tests

Запустить relevant existing suites и focused pagination tests. Report:

```text
Backend TSC
Frontend TSC
Backend tests
Frontend tests/build if applicable
pagination focused tests
```

### 24. Required final inventory

| Domain | Route | Table | Exists now | Default 20 | Pager >20 | Total | Search persistence | Sort persistence | Result |
|---|---|---|---|---|---|---:|---|---|---|

### 25. Exceptions matrix

| Table/Component | Exception | Reason | Approved by canonical standard? |
|---|---|---|---|

Если exceptions = 0, написать `No pagination exceptions`.

### 26. No false verdict

VERDICT A запрещён, если:

```text
есть operational table с total >20 без functional multi-page pagination
```

или repository-wide inventory не доказан.

### 27. Report file

Создать:

```text
docs/prompts/PHASE_3_PROJECT_WIDE_TABLE_PAGINATION_FINAL_EVIDENCE_CLOSURE_REPORT.md
```

### 28. Git

Если production code менять не пришлось:

```text
Production code changed: NO
Evidence/report only
```

Если residual defects исправлены:

```text
Production code changed: YES
exact related files only
```

В обоих случаях:

```text
unrelated files committed = 0
push origin/master
HEAD == origin/master
```

### 29. Hard acceptance criteria

VERDICT A только если:

1. Repository-wide operational table discovery completed.
2. All current operational tables accounted for.
3. All requested domains explicitly classified.
4. Every scalable operational table has pagination infrastructure.
5. Default page size = 20.
6. Every total >20 produces multiple pages.
7. Filtered total is canonical.
8. Current range is correct.
9. Page navigation works.
10. Last-page arithmetic correct.
11. Filters persist.
12. Search persists where supported.
13. Sort persists where supported.
14. Filter/search change safely resets page.
15. Stable ordering proven.
16. No duplicate adjacent-page rows.
17. No missing adjacent-page rows.
18. Boundary 0 PASS.
19. Boundary 1 PASS.
20. Boundary 20 PASS.
21. Boundary 21 PASS.
22. Boundary 40 PASS.
23. Boundary 41 PASS.
24. Catalog 31 case reconciled.
25. Orders large dataset reconciled.
26. Bookings large dataset reconciled.
27. CRM Customers reconciled.
28. Partner tables reconciled with actual numbers.
29. Users scalability contract reconciled.
30. Decision Queue filtered counts remain reconciled.
31. No client-side fake pagination.
32. Filters happen before pagination.
33. Security scopes preserved.
34. No unbounded-fetch regression.
35. Page-size selector policy explicitly resolved.
36. Browser evidence present.
37. Relevant tests PASS.
38. Backend TSC PASS.
39. Frontend TSC PASS.
40. Unrelated files committed = 0.
41. Push complete.
42. HEAD == origin/master.

### 30. Verdict

Only if all gates pass:

```text
VERDICT A — PROJECT-WIDE TABLE PAGINATION FINAL EVIDENCE CLOSED / COMPLETE OPERATIONAL INVENTORY VERIFIED
```

Otherwise:

```text
VERDICT B — PROJECT-WIDE PAGINATION FINAL EVIDENCE INCOMPLETE
```

### 31. Final response format

```text
Verdict:

Repository-wide discovery:
Total operational tables found:
Implemented:
Planned/N/A:
Exceptions:

Page-size policy:
Default page size:
20/50/100 selector:

Catalog:
Orders:
Bookings:
CRM Customers:
Partners:
Seller Profiles:
Users:
Other discovered tables:

Decision Queue parity:

Boundary tests:
0:
1:
20:
21:
40:
41:

Filter persistence:
Search persistence:
Sort persistence:
Page reset:
Stable ordering:

Security:
Performance:

Production code changed:
Files changed:

Tests:
Backend TSC:
Frontend TSC:
Browser evidence:

Commit:
Push:
HEAD:
origin/master:
HEAD == origin/master:
Unrelated files:

Remaining findings:
Next canonical stage:
```

### 32. STOP

После final evidence closure — **STOP**.

Не запускать автоматически:

```text
CRM Step 3.5
Supplier Settlement S.1–S.19
other Phase 3 implementation
```
