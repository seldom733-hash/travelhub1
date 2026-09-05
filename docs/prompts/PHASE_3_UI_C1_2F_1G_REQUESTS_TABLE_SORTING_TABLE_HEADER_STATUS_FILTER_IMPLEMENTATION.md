# PHASE 3 — UI-C1.2F.1G
## Requests Table Sorting + Table-Header Status Filter — Production Implementation

---

# 0. Цель этапа

Полностью закрыть два оставшихся UI-gap в **Requests / Заявки**:

```text
1. TABLE SORTING
   → сейчас отсутствует

2. TABLE-HEADER FILTER
   → Status сейчас находится в toolbar
```

После завершения этапа Requests registry должен соответствовать общей архитектуре Operations Center:

```text
HEADER PERIOD
→ global scope

TOOLBAR
→ Search
→ Reset
→ CSV/XLSX

TABLE HEADER
→ column sorting
→ Status column filter
```

Канонический UX:

```text
COLUMN LABEL / SORT ICON
→ SORTING

FILTER ICON / DROPDOWN
→ COLUMN FILTER
```

---

# 1. Baseline / Stage Context

Принятые факты из `UI-C1.2F.1C`:

```text
Requests frontend sorting — MISSING
Requests backend sorting  — MISSING
Requests status filtering — backend READY
Requests Status UI        — toolbar today
```

Аудит определил target sortable columns:

```text
referenceNumber
displayedPrice
confirmedPrice
serviceDate
status
createdAt
slaDeadline
```

Не добавлять другие sortable fields без проверки schema/service contract.

Текущий Orders `UI-C1.2F.1D` имеет отдельный unresolved regression по one-active-KPI и не должен использоваться как источник изменённой semantics.

Этот этап касается только Requests.

---

# 2. Preflight Git Check

Перед изменениями:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline --decorate
```

Если working tree dirty или HEAD != origin/master:

```text
STOP
```

и report actual state.

---

# 3. Scope

Разрешено изменять:

```text
Requests frontend page/table
Requests backend query DTO/service sorting
shared sort helper if needed
Requests tests
shared tests only if real shared defect is found
```

Не начинать:

```text
Bookings migration
Payments migration
Cross-registry closure
UI-C1.2G
UI-C2
D8
```

---

# 4. Current-State Requirement

До кода подтвердить фактическую текущую Requests table structure:

```text
columns
current toolbar controls
current URL params
current Requests list endpoint params
current default ordering
current export behavior
current pagination
```

Не работать по предположениям.

---

# 5. Remove Status from Toolbar

После migration Requests toolbar должен быть:

```text
[ Search ] [ Reset ] [ CSV ] [ XLSX ]
```

или фактический эквивалент, если XLSX отсутствует в текущем registry.

Убрать standalone:

```text
Status dropdown
```

Permanent duplication запрещена:

```text
Toolbar Status
+
Header Status
```

---

# 6. Status Table-Header Filter

В колонке `Статус` использовать shared:

```text
TableHeaderFilter
```

Options должны соответствовать canonical Request statuses:

```text
NEW
CHECKING
SUPPLIER_TIMEOUT
PRICE_CHANGED
CUSTOMER_ACCEPTED
CONFIRMED
CONVERTED
REJECTED
UNAVAILABLE
EXPIRED
CUSTOMER_PAYMENT_TIMEOUT
CANCELLED_BY_CUSTOMER
```

Не использовать устаревшие или invented statuses.

---

# 7. KPI ↔ Header Filter = Same State

Canonical Requests behavior уже принят ранее:

```text
KPI cards = static overview counts
one active KPI at a time
clicked KPI filters table only
```

Status header filter должен использовать тот же state:

```text
Header Status → CHECKING
→ URL status=CHECKING
→ table filters
→ KPI CHECKING selected
```

Reverse:

```text
Click KPI CHECKING
→ URL status=CHECKING
→ table filters
→ Header Status shows CHECKING
```

Один URL param:

```text
status
```

Никакого duplicate local state.

---

# 8. One Active KPI Rule

Requests имеет только один KPI filter dimension:

```text
status
```

Поэтому:

```text
select status A
→ KPI A active

select status B
→ KPI A inactive
→ KPI B active

clear status / click Total
→ all status KPI inactive
→ Total active
```

Нельзя допускать multiple pressed status cards.

---

# 9. Static KPI Overview

Сохранить accepted Requests contract:

```text
status filter changes
→ TABLE changes
→ KPI overview counts remain static
```

Header Status filter — TABLE-ONLY scope.

Но Header Period:

```text
dateFrom/dateTo
→ KPI overview recomputes
→ table recomputes
```

Не смешивать эти scopes.

---

# 10. Backend Sorting — Required

Requests currently hardcodes:

```text
createdAt desc
```

Нужно реализовать server-side sorting.

Canonical URL:

```text
sortBy=<allowed-field>
sortOrder=asc|desc
```

Backend должен принимать только allowlisted values.

Target allowlist:

```text
referenceNumber
displayedPrice
confirmedPrice
serviceDate
status
createdAt
slaDeadline
```

Если фактическое field name отличается от UI name:

```text
URL canonical key
→ explicit mapping
→ Prisma field
```

Не передавать raw URL field напрямую в Prisma.

---

# 11. Sort Validation

Нужно валидировать:

```text
sortBy
sortOrder
```

Allowed:

```text
sortOrder=asc|desc
```

Invalid sort key/direction:

```text
→ canonical validation failure
```

Следовать существующему Requests HTTP convention.

После `UI-C1.2F.1A` malformed Requests date params возвращают canonical HTTP 400.

Не менять существующую validation semantics без причины.

---

# 12. Stable Pagination

Sorting должен быть deterministic.

Для non-unique primary sort:

```text
ORDER BY selectedField direction,
         id canonicalTieBreaker
```

или существующая shared strategy.

Проверить:

```text
same amount
same status
same timestamp
```

и доказать отсутствие random page drift.

---

# 13. Default Sorting

При отсутствии:

```text
sortBy
sortOrder
```

сохранить текущий default:

```text
createdAt desc
```

Не менять визуальный порядок Requests по умолчанию.

---

# 14. Frontend SortableHeader

Перевести eligible Requests columns на существующий:

```text
SortableHeader
```

Не создавать второй Requests-only sorting component.

Каждая eligible sortable column:

```text
referenceNumber
displayedPrice
confirmedPrice
serviceDate
status
createdAt
slaDeadline
```

должна использовать shared sort UX.

Не делать sortable:
- customer
- product
- supplier

если audit не показывает backend-safe canonical mapping.

---

# 15. Status Column: Sort + Filter Together

Колонка Status должна поддерживать:

```text
sorting
+
filtering
```

UX:

```text
Status label/sort button
→ sort

Status filter icon
→ filter dropdown
```

Они должны быть независимыми click targets.

Пример допустимого URL:

```text
status=CHECKING
&sortBy=status
&sortOrder=asc
```

---

# 16. URL Authority

Requests state должен быть URL-authoritative.

Representative URL:

```text
/app/requests
?dateFrom=2026-09-01
&dateTo=2026-10-01
&status=CHECKING
&sortBy=serviceDate
&sortOrder=asc
&page=1
```

Rules:

```text
filter change → page=1
sort change   → page=1
```

Preserve:

```text
period
search
compatible filter/sort state
```

---

# 17. Reload / Back / Forward

Mandatory:

```text
apply header Status
→ reload
→ same selected header filter
→ same selected KPI
→ same table scope

apply sort
→ reload
→ same direction/order

Back
→ previous filter/sort restored

Forward
→ next filter/sort restored
```

Не повторить bug типа:

```text
useState(initialX)
```

без sync с URL props.

---

# 18. Search Coexistence

Search остаётся toolbar-owned.

Проверить combinations:

```text
Search + Status
Search + Sort
Search + Status + Sort
Search + Period + Status + Sort
```

Ни одно изменение не должно удалять unrelated URL params.

---

# 19. Reset Semantics

Requests Reset:

```text
CLEAR:
search
status
sortBy
sortOrder
page → 1
selected KPI → Total/default

KEEP:
dateFrom
dateTo
workspace/tenant/business scope
```

Header Period reset — отдельное действие.

---

# 20. Tab Switch Semantics

Requests → Orders/Bookings/Payments:

```text
KEEP:
dateFrom/dateTo

RESET:
search
status
sort
page
selected KPI
```

Не переносить Requests sort/status в другой registry.

---

# 21. Export Scope

Audit current Requests export.

Export должен учитывать active table scope:

```text
period
search
status
```

Sorting:
- если export уже следует sort order — сохранить;
- если нет — зафиксировать существующее поведение.

Не делать client-side export текущей страницы, если backend export уже существует.

---

# 22. Server Authority

Запрещено:

```text
client-side sorting current page
client-side filtering current page
client-side KPI recount
```

Actual list request должен включать применимые:

```text
dateFrom/dateTo
search
status
sortBy
sortOrder
page
```

---

# 23. Accessibility

Sorting:

```text
aria-sort
button semantics
Enter/Space
visible direction
```

Filter:

```text
aria-expanded
aria-haspopup
accessible name
keyboard selection
Escape
focus return
```

Для Status:
- sort button и filter button имеют разные accessible names.

---

# 24. Responsive

Browser-check:

```text
1680px
768px
390px
```

Проверить:
- sort/filter icons do not overlap;
- popover usable;
- table horizontal scroll intentional;
- no accidental page overflow;
- toolbar usable.

---

# 25. Mandatory Browser Evidence

Показать реальные сценарии:

## A. Header Status
```text
select CHECKING
→ URL status=CHECKING
→ KPI CHECKING selected
→ table only CHECKING
```

## B. KPI Status
```text
click another KPI
→ URL updates
→ header filter updates
→ previous KPI deselects
```

## C. Total
```text
click Total
→ status cleared
→ header returns All
→ table returns period/search scope
```

## D. Sorting
Для минимум 3 различных типов:

```text
createdAt asc/desc
amount-like numeric field asc/desc
status or serviceDate asc/desc
```

Показать actual row order.

## E. Sort + Filter
```text
status=...
sortBy=...
sortOrder=...
```

## F. Combined
```text
Period + Search + Status + Sort
```

---

# 26. Mandatory Network Evidence

Показать actual requests:

```text
Status filter request
sort ASC request
sort DESC request
Status + Sort request
Period + Search + Status + Sort request
```

Проверить actual backend query params.

---

# 27. Backend Tests

Добавить tests минимум на:

```text
default createdAt desc
sort referenceNumber asc/desc
sort displayedPrice asc/desc
sort confirmedPrice asc/desc
sort serviceDate asc/desc
sort status asc/desc
sort createdAt asc/desc
sort slaDeadline asc/desc

invalid sortBy
invalid sortOrder
stable tie-breaker
sort + status
sort + date period
sort + search
pagination with sort
```

Если nullable fields существуют:

```text
explicitly verify null ordering behavior
```

Не оставлять DB-dependent accidental null order undocumented.

---

# 28. Frontend Tests

Добавить/update:

```text
Status toolbar dropdown removed
Status header filter exists

Header Status → KPI selected
KPI → Header Status selected
Total clears filter

sortable headers rendered for eligible fields
non-sortable fields remain plain

sort click updates URL
second sort click toggles direction
sort → page=1

filter → page=1
filter preserves period
sort preserves period

Reset clears filter/sort but preserves period
Search + Status + Sort coexist

Reload state derivation
Back/Forward where test infra allows

sort and filter on Status independently clickable
```

---

# 29. Regression

Run:

```text
requests-registry
table-header-filter
operations-center-shell
registry URL state tests
```

plus repository discipline:

```text
frontend TSC
frontend build
full/relevant vitest
```

Backend:

```text
backend TSC/build
Requests targeted tests
```

Any failure must be named.

---

# 30. Security

Verify:

```text
RBAC preserved
tenant/workspace isolation preserved
enum validation preserved
sort allowlist enforced
raw property injection impossible
search remains safe
```

Direct request:

```text
sortBy=__proto__
sortBy=tenantId
sortOrder=DROP...
```

must not reach query builder unsafely.

Use canonical validation response.

---

# 31. Files Changed

Final report must list every changed file and purpose.

No unrelated refactor.

---

# 32. Git Hard Closure

Before commit:

```bash
git status --porcelain=v1
git diff --check
git diff --stat
```

After commit/push:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline --decorate
```

Required:

```text
working tree clean
HEAD == origin/master
```

Do not leave prompt/report files untracked.

---

# 33. Required Final Report

```text
A. Baseline
B. Current Requests Reality
C. Toolbar Migration
D. Status Header Filter
E. KPI ↔ Header Synchronization
F. One Active KPI
G. Backend Sorting
H. Sort Allowlist
I. Sortable Columns
J. Stable Pagination
K. Status Sort + Filter Coexistence
L. URL Authority
M. Period/Search Coexistence
N. Reset
O. Tab Switch
P. Reload / Back / Forward
Q. Export
R. Network Evidence
S. Accessibility
T. Responsive
U. Security
V. Tests
W. Build
X. Files Changed
Y. Git Hard Closure
Z. Final Verdict
```

---

# 34. Acceptance Criteria

`UI-C1.2F.1G` PASS only if ALL:

```text
1. Requests Status removed from toolbar
2. Status filter rendered in Status table header
3. Header Status ↔ KPI same state
4. one active KPI preserved
5. Total clears status
6. KPI overview static under status filter

7. Requests backend sorting implemented
8. sort allowlist enforced
9. default createdAt desc preserved
10. deterministic tie-breaker implemented
11. referenceNumber sortable
12. displayedPrice sortable
13. confirmedPrice sortable
14. serviceDate sortable
15. status sortable
16. createdAt sortable
17. slaDeadline sortable

18. Status supports sort + filter independently
19. all sorting server-side
20. all filtering server-side

21. URL authority works
22. filter → page 1
23. sort → page 1
24. period preserved
25. search coexistence works
26. Reset preserves period
27. tab switch leaks no registry-local state
28. reload works
29. Back/Forward works
30. export scope correct

31. accessibility PASS
32. responsive 1680/768/390 PASS
33. security PASS
34. backend tests PASS
35. frontend tests PASS
36. TSC/build PASS

37. working tree clean
38. HEAD == origin/master
```

---

# 35. Final Verdict Format

```text
VERDICT A — UI-C1.2F.1G
REQUESTS TABLE SORTING + TABLE-HEADER STATUS FILTER
— ACCEPTED

FINAL SHA:
<actual>

STATUS TOOLBAR FILTER REMOVED      — PASS
STATUS HEADER FILTER               — PASS
KPI ↔ HEADER SAME STATE            — PASS
ONE ACTIVE KPI                     — PASS
STATIC KPI OVERVIEW                — PASS

REQUESTS BACKEND SORTING           — PASS
SORT ALLOWLIST                     — PASS
DEFAULT createdAt DESC             — PASS
STABLE PAGINATION                  — PASS

referenceNumber SORT               — PASS
displayedPrice SORT                — PASS
confirmedPrice SORT                — PASS
serviceDate SORT                   — PASS
status SORT                        — PASS
createdAt SORT                     — PASS
slaDeadline SORT                   — PASS

STATUS SORT + FILTER               — PASS
SERVER-SIDE SORTING                — PASS
SERVER-SIDE FILTERING              — PASS

URL AUTHORITY                      — PASS
PAGE RESET                         — PASS
PERIOD PRESERVATION                — PASS
SEARCH COEXISTENCE                 — PASS
RESET                              — PASS
TAB SWITCH                         — PASS
RELOAD/BACK/FORWARD                — PASS
EXPORT                             — PASS

ACCESSIBILITY                      — PASS
RESPONSIVE                         — PASS
SECURITY                           — PASS
TESTS / BUILD                      — PASS

WORKING TREE CLEAN                 — PASS
HEAD == origin/master              — PASS
GIT HARD CLOSURE                   — PASS

UI-C1.2F.1G — ACCEPTED
```

If any mandatory runtime behavior fails:

```text
VERDICT B — UI-C1.2F.1G
REQUESTS TABLE SORTING + TABLE-HEADER STATUS FILTER
— NOT ACCEPTED

BLOCKERS:
- <exact blocker>
```

---

# 36. Stop Rule

После `UI-C1.2F.1G`:

```text
STOP
```

Не переходить автоматически дальше.

Нужен независимый review двух конкретных закрытий:

```text
Requests sorting
Requests table-header Status filter
```

а также URL/server/security/Git evidence.
