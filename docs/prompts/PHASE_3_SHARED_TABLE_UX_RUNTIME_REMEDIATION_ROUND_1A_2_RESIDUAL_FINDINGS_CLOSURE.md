# PHASE 3 — SHARED TABLE UX RUNTIME REMEDIATION
## ROUND 1A.2 — RESIDUAL RUNTIME FINDINGS CLOSURE
### ORDERS + BOOKINGS KPI AUTHORITY / SYSTEMATIC I18N / CRM NOTES RBAC / CUSTOMER 360 / USERS
### FIX ONLY PROVEN RESIDUAL DEFECTS — PRESERVE WORKING ROUND 1A / 1A.1 IMPLEMENTATION
### FINAL REPORT AND FINAL RESPONSE MUST BE IN RUSSIAN

---

# 1. ЦЕЛЬ

После:

```text
Round 1A
Commit: 52aa086

Round 1A.1
Commit: 898a2d6
Claimed verdict: VERDICT A — FULLY CLOSED AND RUNTIME-VERIFIED
```

проведён дополнительный ручной визуальный runtime-аудит.

Обнаружены остаточные дефекты.

Этот round должен:

```text
1. воспроизвести каждый finding;
2. определить точный root cause;
3. исправить defect end-to-end;
4. не откатывать уже работающие исправления;
5. провести реальную browser/runtime проверку;
6. закрыть каждый finding отдельным доказательством;
7. не переходить к Activity Round 2C.
```

Это remediation round, а не новый feature stage.

---

# 2. REPOSITORY-FIRST

Перед любыми изменениями:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -80
git diff
git diff --check
```

Ожидаемый baseline должен содержать:

```text
898a2d6 — Round 1A.1 Visual Runtime Findings Closure
```

Если actual HEAD новее:

```text
DO NOT RESET
DO NOT REVERT legitimate newer work
```

Зафиксировать:

```text
Repository:
Branch:
Starting HEAD:
origin/master:
Worktree:
52aa086 reachable:
898a2d6 reachable:
```

---

# 3. RUNTIME IS ACCEPTANCE AUTHORITY

Hard rule:

```text
source code presence != runtime proof
i18n key presence != localized runtime
permission constant != actual access
aggregate field != correct KPI
unit test != browser acceptance
```

Для VERDICT A обязательны:

```text
actual API evidence
+
actual browser/rendered UI evidence
```

по каждому finding.

---

# 4. FINDING R1 — ORDERS TABLE HEADERS MIXED LOCALE

Наблюдалось при Azerbaijani locale:

```text
Kod
Tarix
Məbləğ
Mövqelər
Статус
Оплата
```

То есть строка заголовков смешивает AZ и RU.

Affected:

```text
Platform → Orders
```

Исправить ВСЕ headers таблицы, а не только два замеченных.

Проверить actual columns из repository.

Обязательный runtime contract:

```text
RU → every header RU
AZ → every header AZ
EN → every header EN
```

Запрещено:

```text
mixed locale
raw i18n key
hardcoded Russian fallback
hardcoded Azerbaijani fallback
```

Особенно проверить:

```text
Код
Дата
Сумма
Позиции
Статус
Оплата
и другие actual headers
```

---

# 5. FINDING R2 — REFRESH BUTTON NOT LOCALIZED

Affected:

```text
Platform → Orders
Platform → Bookings
```

Кнопка:

```text
Обновить
```

остаётся русской при другой locale.

Исправить через canonical i18n architecture.

Required runtime:

```text
RU → Обновить
AZ → correct Azerbaijani translation
EN → Refresh
```

Проверить:

```text
visible label
aria-label if applicable
title/tooltip if applicable
loading/disabled state copy if applicable
```

Не создавать duplicated page-local translations, если shared key/helper уже существует.

---

# 6. FINDING R3 — ORDERS / BOOKINGS LAST 3 KPI CARDS = ZERO

Это **критический functional finding**.

После Round 1A.1 page-based fallback был удалён:

```text
items.filter() fallback → removed
data?.aggregates?.X ?? 0
```

После этого последние три KPI на Orders и Bookings показывают `0`, несмотря на наличие соответствующих данных.

Observed Orders example under AZ locale:

```text
Cəmi sifariş
1514

Aktiv
0              ← WRONG

Bronlaşdırmaya hazır
0              ← WRONG

Bağlanıb/ləğv edilib
0              ← WRONG
```

Affected:

```text
Platform → Orders
Platform → Bookings
```

---

# 7. KPI — DO NOT RESTORE PAGE-BASED FALLBACK

Строго запрещено исправлять R3 возвратом:

```text
items.filter(...)
current page count
paginated rows count
frontend-derived current-page KPI
```

Canonical invariant остаётся:

```text
AUTHORIZED + FILTERED FULL SET
├── KPI aggregate
└── rows → sort → paginate
```

KPI:

```text
MUST depend on:
authorization
workspace/tenant scope
search
business filters
dateFrom/dateTo

MUST NOT depend on:
page
current page rows
pagination slice
```

---

# 8. KPI ROOT-CAUSE TRACE — MANDATORY

Для Orders и Bookings провести полный trace:

```text
database facts
→ backend aggregate query
→ service return
→ controller response
→ JSON payload
→ frontend API type
→ frontend API parser/client
→ page state
→ KPI field mapping
→ rendered card
```

Проверить минимум:

```text
aggregate field names differ backend/frontend?
nested response shape differs?
early-return response missing aggregate fields?
undefined converted to 0?
backend uses wrong statuses?
frontend references obsolete field names?
aggregate query filters wrong enum values?
aggregate query applies pagination?
scope removes expected rows?
status grouping semantics differ from KPI semantics?
API client strips aggregates?
```

Никаких предположений без evidence.

---

# 9. ORDERS KPI SEMANTICS

Сначала определить actual KPI labels and intended canonical semantics из current code/architecture.

Observed cards include:

```text
Total Orders
Active
Ready for Booking
Closed/Cancelled
```

Не считать названия достаточным authority.

Для каждого KPI документировать:

```text
UI label
frontend field
backend aggregate field
included canonical statuses
excluded statuses
database count
API count
rendered count
```

Если `Active` — derived group нескольких statuses, перечислить их явно.

Если `Closed/Cancelled` — объединённый aggregate, перечислить exact statuses.

---

# 10. BOOKINGS KPI SEMANTICS

Аналогично определить exact cards and grouping.

Для каждого:

```text
UI label
frontend field
backend aggregate field
included Booking statuses
database count
API count
rendered count
```

Не копировать Order status semantics в Booking.

---

# 11. KPI DETERMINISTIC PROOF

Для Orders и Bookings:

## Proof A — non-zero truth

Выбрать dataset, где DB точно содержит records нужных групп.

Показать:

```text
DB/group counts
API aggregates
rendered KPI
```

Должно быть:

```text
DB == API == UI
```

## Proof B — pagination independence

При:

```text
total > pageSize
same search
same filters
same date range
```

проверить:

```text
page 1 rows != page 2 rows
page 1 KPI == page 2 KPI
```

## Proof C — filter awareness

Изменить meaningful filter.

Показать:

```text
filtered DB/API aggregate
rendered KPI
```

Никаких current-page fallbacks.

---

# 12. FINDING R4 — CRM OPERATIONAL NOTES ACCESS STILL DENIED

Affected:

```text
CRM → Customers → Customer 360 → Notes
CRM → Partners → Partner 360 → Notes
```

Пользователь по-прежнему не имеет ожидаемого доступа к примечаниям.

Предварительная гипотеза:

```text
wrong RBAC / role permission assignment / frontend permission visibility / parent scope
```

Но не принимать гипотезу за root cause.

---

# 13. OPERATIONAL NOTES AUTHORITY TRACE

Проверить end-to-end:

```text
authenticated user
→ role(s)
→ Permission rows
→ RolePermission assignments
→ effective permission resolution
→ frontend session/effective permissions
→ Notes tab/section visibility
→ GET notes route
→ parent entity resolver
→ parent scope authority
→ create/edit/delete policies
```

Проверить existing permissions from Round 2B actual repository, например repository-confirmed equivalents:

```text
operational-notes.read
operational-notes.create
operational-notes.update
operational-notes.delete
```

Не угадывать exact codes — взять из repository.

---

# 14. NOTES — EXPECTED ACCESS MATRIX

Сначала восстановить canonical role matrix из:

```text
permissions.constants.ts
security service
Operational Notes Round 2B report/tests
current migrations/seeds
```

Построить actual matrix:

| Role | Read | Create | Update Own | Delete Own | Admin Override | Runtime |
|---|---:|---:|---:|---:|---:|---|
| ADMIN | | | | | | |
| DIRECTOR | | | | | | |
| SALES_MANAGER | | | | | | |
| OPERATOR | | | | | | |
| FINANCE | | | | | | |
| ANALYST | | | | | | |
| MODERATOR | | | | | | |
| MARKETER | | | | | | |
| other actual roles | | | | | | |

Не выдавать всем ролям все права ради устранения 403.

Соблюдать least privilege и уже утверждённую architecture.

---

# 15. NOTES — CUSTOMER VS PARTNER PARENT SCOPE

Проверить отдельно:

```text
Customer 360
Partner 360
```

Потому что проблема может быть не permission code, а parent-scope authority.

Доказать отдельно:

```text
GET Customer notes
GET Partner notes
```

для роли, которая canonical должна иметь доступ.

Если denied:

```text
HTTP status
error payload
permission decision
parent resolver result
scope decision
```

должны попасть в report.

---

# 16. NOTES UI STATES

После исправления проверить:

```text
authorized + notes exist
authorized + zero notes
authorized + create permission
authorized read-only
forbidden
loading
error
```

Нельзя превращать:

```text
403 → empty state
```

или:

```text
error → "нет примечаний"
```

Forbidden/error/zero остаются различимыми.

---

# 17. FINDING R5 — CUSTOMER 360 → PARTNERS TABLE HEADERS

Path:

```text
CRM
→ Customers
→ click Customer
→ Partners tab/table
```

Observed header row contains:

```text
crm.col.partner
Sifarişlər
Bronlar
Sifariş məbləğləri
Status
```

Defects:

```text
raw i18n key: crm.col.partner
potential mixed/incomplete localization
```

Required:

```text
Partner
Orders
Bookings
Order Amounts
Status
```

with correct RU/AZ/EN semantic equivalents.

Do not hardcode one locale.

---

# 18. CUSTOMER 360 PARTNERS TABLE I18N AUDIT

Проверить весь table surface:

```text
tab label
table headers
status values
empty state
loading
error
pagination if any
sort labels if any
tooltips/actions if any
```

Locales:

```text
RU
AZ
EN
```

Raw keys = FAIL.

---

# 19. FINDING R6 — CUSTOMER 360 → REFUNDS STATUS FILTER NOT LOCALIZED

Path:

```text
CRM
→ Customers
→ click Customer
→ Refunds
→ Status filter
```

Проблема:

```text
filter label and/or options are not fully localized
```

Проверить actual Refund statuses from repository.

Expected repository values may include:

```text
REQUESTED
APPROVED
PROCESSED
REJECTED
```

но использовать actual enum as authority.

Required:

```text
filter label localized
All localized
every option localized
selected option localized
URL/internal state remains canonical enum
filtering remains functional
```

---

# 20. FINDING R7 — USERS PAGE SYSTEMIC I18N FAILURE

Affected:

```text
Platform → Users
```

Manual observation:

```text
almost entire page is not localized;
only Status column VALUES are localized
```

Это systemic page-level finding.

Нельзя исправить только один header.

---

# 21. USERS FULL I18N AUDIT

Проверить всю страницу:

```text
page title
page subtitle/description
KPI cards
KPI labels
search input
search placeholder
filter labels
filter "All"
status filter options
role filter options
buttons
Refresh
table headers
role cell values
status cell values
registration date header
pagination
empty state
loading state
error state
tooltips
aria labels where user-facing
```

Locales:

```text
RU
AZ
EN
```

Сохранить уже работающую локализацию Status values.

---

# 22. USERS ROLE LOCALIZATION

Особенно проверить role cells/filter options:

```text
ADMIN
DIRECTOR
SALES_MANAGER
OPERATOR
FINANCE
ANALYST
MODERATOR
PARTNER
BUYER
MARKETER
```

Использовать actual repository roles.

Canonical role code в API/URL не менять.

UI должен показывать localized human-readable label.

Не менять RBAC semantics.

---

# 23. USERS REGISTRATION DATE REGRESSION

Round 1A.1 исправил semantic label:

```text
createdAt
→ UI "Дата регистрации"
```

Сохранить:

```text
RU → Дата регистрации
AZ → correct AZ translation
EN → Registration date
```

Sorting authority остаётся `createdAt`, если это current canonical implementation.

---

# 24. SYSTEMATIC SHARED I18N ROOT CAUSE

Поскольку после двух remediation rounds остались hardcoded/mixed/raw-key defects, провести targeted architecture audit:

```text
Which pages use t(key, locale)?
Which use t(key)?
Which use useLocale()?
Which use hardcoded Russian?
Which use local status maps?
Which use StatusBadge?
Which keys exist only in RU?
Which keys have mismatched namespaces?
Which components receive locale incorrectly?
```

Не переписывать весь i18n subsystem без необходимости.

Но устранить systemic root cause, если несколько findings происходят из одного shared defect.

---

# 25. NO RAW I18N KEYS

На audited surfaces выполнить runtime/source check для visible patterns типа:

```text
crm.col.*
admin.table.*
admin.*
common.*
```

Raw key in rendered UI = FAIL.

Не маскировать raw key fallback русским hardcode.

---

# 26. LOCALE SWITCH PROOF

Для affected pages реально переключить:

```text
RU → AZ → EN
```

и проверить rendered UI.

Недостаточно:

```text
keys exist in i18n.tsx
```

Browser proof должен показать отсутствие mixed-language UI на audited elements.

---

# 27. REQUIRED RUNTIME MATRIX

| Surface | RU | AZ | EN | Raw Key? | Mixed Locale? |
|---|---:|---:|---:|---:|---:|
| Orders headers | | | | | |
| Orders Refresh | | | | | |
| Orders KPI | | | | N/A | N/A |
| Bookings Refresh | | | | | |
| Bookings KPI | | | | N/A | N/A |
| Customer 360 Notes | | | | N/A | N/A |
| Partner 360 Notes | | | | N/A | N/A |
| Customer 360 Partners table | | | | | |
| Customer 360 Refund filter | | | | | |
| Users page | | | | | |

Allowed:

```text
PASS
FAIL
N/A — reason
```

No blanks.

---

# 28. FINDING CLOSURE MATRIX

| ID | Surface | Observed Defect | Root Cause | Fix | API Proof | Browser Proof | Status |
|---|---|---|---|---|---|---|---|
| R1 | Orders | mixed table headers | | | | | |
| R2 | Orders/Bookings | Refresh not localized | | | | | |
| R3 | Orders/Bookings | last 3 KPI = 0 | | | | | |
| R4 | CRM Customer/Partner | Notes access denied | | | | | |
| R5 | Customer 360 Partners | raw/mixed headers | | | | | |
| R6 | Customer 360 Refunds | status filter not localized | | | | | |
| R7 | Users | systemic page i18n failure | | | | | |

VERDICT A forbidden if any row = FAIL.

---

# 29. KPI EVIDENCE MATRIX

| Page | KPI | Included Statuses / Semantics | DB Count | API Aggregate | UI Count | Page 1 = Page 2? |
|---|---|---|---:|---:|---:|---:|
| Orders | Total | | | | | |
| Orders | Active | | | | | |
| Orders | Ready for Booking | | | | | |
| Orders | Closed/Cancelled | | | | | |
| Bookings | Total | | | | | |
| Bookings | KPI 2 actual | | | | | |
| Bookings | KPI 3 actual | | | | | |
| Bookings | KPI 4 actual | | | | | |

Use actual labels/semantics.

No blank rows.

---

# 30. NOTES RBAC EVIDENCE MATRIX

| Context | Role | Effective Permission | Parent Scope | GET | POST | PATCH Own | DELETE Own | Expected? | Status |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Customer 360 | canonical staff role | | | | | | | | |
| Partner 360 | canonical staff role | | | | | | | | |
| Customer 360 | unauthorized role | | | | | | | | |
| Partner 360 | unauthorized role | | | | | | | | |

Use actual role(s).

Do not fabricate permissions.

---

# 31. I18N EVIDENCE MATRIX

| Surface | Element | Canonical Value/Key | RU | AZ | EN | Status |
|---|---|---|---|---|---|---|
| Orders | Status header | | | | | |
| Orders | Payment header | | | | | |
| Orders | Refresh | | | | | |
| Bookings | Refresh | | | | | |
| Customer 360 Partners | Partner header | crm.col.partner or fixed canonical key | | | | |
| Customer 360 Refunds | Status filter | | | | | |
| Users | Page title | | | | | |
| Users | Search | | | | | |
| Users | Status filter | | | | | |
| Users | Role filter | | | | | |
| Users | Role value sample | | | | | |
| Users | Registration date | | | | | |
| Users | Pagination/empty | | | | | |

Expand where needed.

---

# 32. TEST REQUIREMENTS

Добавить focused regression tests для actual root causes.

Минимально рассмотреть:

```text
Orders header i18n RU/AZ/EN
Refresh button i18n
Customer 360 Partners raw-key regression
Refund filter options i18n
Users full critical labels RU/AZ/EN
Orders KPI backend→frontend field mapping
Bookings KPI backend→frontend field mapping
zero aggregate response semantics
Notes RBAC expected-role access
Notes forbidden-role denial
Customer/Partner parent scope
```

Tests не заменяют browser proof.

---

# 33. BACKEND KPI TESTS

Если R3 root cause затрагивает backend:

проверить unit/e2e на:

```text
non-empty dataset → non-zero expected aggregate
empty result → explicit zero aggregate
early return → aggregate object still complete
page=1 vs page=2 → same aggregate
filter changes → correct aggregate
authorization scope → no cross-scope leakage
```

---

# 34. FRONTEND KPI TESTS

Проверить:

```text
frontend uses aggregate fields only
no items.filter fallback
missing aggregate shape handled explicitly
field names match API contract
page change does not recompute KPI from current rows
```

Если API contract гарантирует aggregates, рассмотреть failure-visible handling вместо silent incorrect zero, но не ухудшать UX без необходимости.

---

# 35. OPERATIONAL NOTES REGRESSION

Round 2B/2C/2D architecture must remain intact:

```text
server-authoritative author
server timestamp
INTERNAL visibility
parent-scoped routes
audit
ownership edit/delete
ADMIN override where canonical
plain text/XSS safety
pagination
```

R4 fix не должен ослаблять эти guarantees.

---

# 36. SECURITY RULE

Нельзя исправлять Notes через:

```text
remove permission guard
allow all authenticated users
trust frontend
skip parent scope
ADMIN-only hardcode unless canonical
```

Исправление должно восстанавливать intended RBAC, а не обходить его.

---

# 37. REGRESSION — SHARED TABLE CONTROLS

Сохранить:

```text
search
filters
sorting
pagination
URL state
dateFrom/dateTo
fixed column geometry
row rendering
authorization
```

Не ломать Round 1A/1A.1 fixes.

---

# 38. OUT OF SCOPE

НЕ начинать:

```text
Activity Round 2C
Manual Order creation
Booking-from-Order creation
five payment methods implementation
cash/offline payment workflow
employee-card workflow
manual refunds
CRM History → Last Activity
Platform Catalog Create Product authority change
other roadmap stage
```

---

# 39. REGRESSION GATES

Run repository-appropriate full/relevant gates.

Minimum:

```text
Backend TSC
Backend build
relevant backend unit tests
relevant backend E2E tests
Frontend TSC
Frontend build
Frontend tests
Operational Notes tests
```

Previous known baselines include:

```text
Frontend: 243/243
Operational Notes: 99/99
```

If legitimate test count changes, report exact new count and reason.

Any failure:

```text
ROUND_1A_2_REGRESSION
PRE_EXISTING
ENVIRONMENTAL
FLAKY
```

must have evidence.

---

# 40. REQUIRED REPORT

Create:

```text
docs/prompts/PHASE_3_SHARED_TABLE_UX_RUNTIME_REMEDIATION_ROUND_1A_2_RESIDUAL_FINDINGS_CLOSURE_REPORT.md
```

Report language:

```text
RUSSIAN
```

---

# 41. GIT DISCIPLINE

Before staging:

```bash
git diff --check
git status --short
git diff
```

Stage exact files only.

Forbidden:

```bash
git add .
git add -A
```

Commit with repository-consistent message.

Push normally.

Never force push.

Verify:

```bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

---

# 42. ACCEPTANCE CRITERIA

VERDICT A only if ALL are true:

1. Orders table headers fully localized RU.
2. Orders table headers fully localized AZ.
3. Orders table headers fully localized EN.
4. No mixed-locale Orders header row.
5. Orders Refresh localized RU/AZ/EN.
6. Bookings Refresh localized RU/AZ/EN.
7. Orders last 3 KPI no longer false-zero.
8. Bookings last 3 KPI no longer false-zero.
9. Orders KPI DB == API == UI for deterministic sample.
10. Bookings KPI DB == API == UI.
11. Orders KPI page-independent.
12. Bookings KPI page-independent.
13. Orders KPI filter-aware.
14. Bookings KPI filter-aware.
15. No current-page KPI fallback restored.
16. KPI authorization scope preserved.
17. KPI date-range semantics preserved.
18. Customer 360 Notes expected role can read.
19. Partner 360 Notes expected role can read.
20. Notes unauthorized role remains denied.
21. Notes parent scope remains enforced.
22. Notes create authority correct.
23. Notes edit/delete authority correct.
24. Notes forbidden/error/empty states remain distinct.
25. Customer 360 Partners table has no raw `crm.col.partner`.
26. Customer 360 Partners headers localized RU/AZ/EN.
27. Customer 360 Refund status filter label localized RU/AZ/EN.
28. Refund filter options localized RU/AZ/EN.
29. Refund filter canonical enum values preserved.
30. Users page title localized RU/AZ/EN.
31. Users search localized RU/AZ/EN.
32. Users filter labels localized RU/AZ/EN.
33. Users filter options localized RU/AZ/EN.
34. Users role values localized RU/AZ/EN.
35. Users table headers localized RU/AZ/EN.
36. Users status values remain correctly localized.
37. Users Registration date label remains correct RU/AZ/EN.
38. Users pagination localized.
39. Users empty/loading/error states localized where exercised.
40. No raw i18n keys on audited surfaces.
41. No mixed RU/AZ/EN copy on audited elements.
42. Locale switch runtime verified.
43. Existing search preserved.
44. Existing filters preserved.
45. Existing sorting preserved.
46. Existing pagination preserved.
47. Existing URL state preserved.
48. Existing fixed column geometry preserved.
49. Finding Closure Matrix complete.
50. KPI Evidence Matrix complete.
51. Notes RBAC Evidence Matrix complete.
52. I18N Evidence Matrix complete.
53. Runtime Matrix complete.
54. Backend TSC PASS.
55. Backend build PASS.
56. Relevant backend tests PASS or correctly classified.
57. Relevant backend E2E PASS or correctly classified.
58. Frontend TSC PASS.
59. Frontend build PASS.
60. Frontend tests PASS.
61. Operational Notes regression PASS.
62. No security guard weakened.
63. No unrelated roadmap feature implemented.
64. Report created in Russian.
65. `git diff --check` clean.
66. Changes committed.
67. Changes pushed.
68. HEAD == origin/master.
69. No unresolved R1–R7.
70. No unresolved P0/P1 from this round.
71. Final verdict based on actual runtime proof.

---

# 43. FINAL RESPONSE FORMAT — STRICTLY RUSSIAN

```text
VERDICT:

РЕПОЗИТОРИЙ
Repository:
Branch:
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
Worktree:

ROOT CAUSE SUMMARY
R1:
R2:
R3:
R4:
R5:
R6:
R7:

FINDING CLOSURE MATRIX
...

ORDERS KPI
Semantics:
DB proof:
API proof:
UI proof:
Pagination proof:
Filter proof:

BOOKINGS KPI
Semantics:
DB proof:
API proof:
UI proof:
Pagination proof:
Filter proof:

KPI EVIDENCE MATRIX
...

OPERATIONAL NOTES RBAC
Customer 360:
Partner 360:
Authorized role:
Unauthorized role:
Parent scope:
Create:
Edit:
Delete:

NOTES RBAC EVIDENCE MATRIX
...

ORDERS I18N
Headers:
Refresh:
RU:
AZ:
EN:

BOOKINGS I18N
Refresh:
RU:
AZ:
EN:

CUSTOMER 360 PARTNERS
Headers:
Raw keys:
RU:
AZ:
EN:

CUSTOMER 360 REFUNDS
Status filter:
Options:
RU:
AZ:
EN:

USERS I18N
Title:
Search:
Filters:
Roles:
Headers:
Status:
Registration date:
Pagination:
Empty/loading/error:
RU:
AZ:
EN:

I18N EVIDENCE MATRIX
...

RUNTIME MATRIX
...

REGRESSION
Backend TSC:
Backend build:
Backend tests:
Backend E2E:
Frontend TSC:
Frontend build:
Frontend tests:
Operational Notes:

SECURITY REGRESSION
...

FILES CHANGED
...

Report:
Commit:

ОСТАВШИЕСЯ FINDINGS
P0:
P1:
P2:

NEXT:
```

---

# 44. VERDICT RULE

Success only:

```text
VERDICT A — PHASE 3 /
SHARED TABLE UX RUNTIME REMEDIATION ROUND 1A.2 /
RESIDUAL I18N + ORDERS/BOOKINGS KPI AUTHORITY +
CRM OPERATIONAL NOTES RBAC + CUSTOMER 360 +
USERS PAGE LOCALIZATION /
FULLY CLOSED AND RUNTIME-VERIFIED
```

If any R1–R7 remains unresolved, or API/browser evidence is incomplete:

```text
VERDICT B — PHASE 3 /
SHARED TABLE UX RUNTIME REMEDIATION ROUND 1A.2 /
RESIDUAL RUNTIME FINDINGS CLOSURE INCOMPLETE
```

No conditional VERDICT A.

---

# 45. STOP

After:

```text
implementation
tests
API verification
browser/runtime verification
report
commit
push
```

STOP.

Do not begin:

```text
STEP 3.5.3 ROUND 2C — Customer 360 Activity UI
```

until Round 1A.2 is formally accepted.
