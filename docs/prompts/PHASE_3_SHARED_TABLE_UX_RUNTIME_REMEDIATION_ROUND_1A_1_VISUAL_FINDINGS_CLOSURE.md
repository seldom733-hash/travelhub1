# PHASE 3 — SHARED TABLE UX RUNTIME REMEDIATION
## ROUND 1A.1 — VISUAL RUNTIME FINDINGS CLOSURE + I18N + KPI AUTHORITY RE-QUALIFICATION

**Язык отчёта и финального ответа: русский.**

---

## 1. Контекст

Предыдущий этап:

```text
Shared Table UX Runtime Remediation Round 1A
Commit: 52aa086
Claimed verdict: VERDICT A — FULLY IMPLEMENTED AND RUNTIME-VERIFIED
```

После Round 1A проведена ручная визуальная проверка runtime UI. Она выявила дефекты, часть которых прямо противоречит предыдущему acceptance report.

Задача Round 1A.1:

```text
не переписывать Round 1A;
найти root cause каждого runtime finding;
исправить только реальные gaps;
провести системную повторную проверку;
дать browser/runtime proof;
повторно квалифицировать VERDICT.
```

---

## 2. Repository-first

Перед изменениями:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -50
git diff
git diff --check
```

Ожидаемый baseline содержит:

```text
52aa086 — Shared Table UX Runtime Remediation Round 1A
```

Если HEAD уже новее — не reset/revert legitimate work.

Зафиксировать:

```text
Repository:
Branch:
Starting HEAD:
origin/master:
Worktree:
52aa086 reachable from HEAD:
```

---

# 3. HARD RULE — RUNTIME IS AUTHORITY

Наличие:

```text
i18n key
formatter
backend aggregate
shared component
unit test
```

само по себе НЕ является доказательством исправления.

Acceptance authority:

```text
actual API response
+
actual rendered browser UI
```

Если runtime противоречит source/report — расследовать wiring end-to-end.

---

# 4. F1 — CRM CLIENTS / PARTNERS LIST STATUS NOT LOCALIZED

На первых таблицах:

```text
CRM → Клиенты
CRM → Партнёры
```

содержимое колонки `Статус` не локализовано полностью.

Требование:

```text
RU → RU
AZ → AZ
EN → EN
```

Проверить ВСЕ фактические status values из repository/domain, а не только ACTIVE.

Raw enum / wrong-locale fallback запрещён.

---

# 5. F2 — CUSTOMER 360 / PARTNER 360 HEADER STATUS NOT LOCALIZED

Фактически наблюдалось при AZ locale:

```text
TravelHub / CRM / Tərəfdaşlar / Absheron Peninsula Tours

PRN-00000014
Absheron Peninsula Tours
Активен   ← WRONG LOCALE
—
· AZ
```

Исправить и проверить:

```text
Customer 360 → header/summary status
Partner 360  → header/summary status
```

для:

```text
RU
AZ
EN
```

и всех actual status values.

---

# 6. F3 — CRM 360 SUB-TABLE STATUSES NOT LOCALIZED

Провести полный audit всех таблиц внутри:

```text
Customer 360
Partner 360
```

Включая repository-confirmed tabs/tables:

```text
Orders
Bookings
Payments
Refunds
Services / Products
Customers / Partners relationships
и другие фактические таблицы
```

Локализовать все status-like business values:

```text
order statuses
booking statuses
payment statuses
refund statuses
product/service statuses
customer/partner statuses
other enum-like state values
```

No raw enums.

---

# 7. F4 — CATALOG STATUS NOT LOCALIZED

```text
Platform → Catalog → Статус
```

Локализовать все фактические Product/Catalog status values в RU/AZ/EN.

Не ограничиваться предполагаемыми:

```text
PUBLISHED
DRAFT
ARCHIVED
```

Сначала определить actual enum/domain values.

---

# 8. F5 — ORDERS STATUS NOT LOCALIZED

```text
Platform → Orders → Статус
```

Все Order statuses должны отображаться локализованно в RU/AZ/EN.

Backend/API enum остаётся canonical.

---

# 9. F6 — ORDERS PAYMENT COLUMN CONTENT NOT LOCALIZED

```text
Platform → Orders → Оплата
```

Сначала определить точную семантику колонки:

```text
paymentStatus?
derived order payment status?
другое?
```

Затем локализовать все фактические значения.

Hard rule:

```text
Payment Method != Payment Status
```

Не менять смысл колонки в этом round.

---

# 10. F7 — BOOKINGS STATUS NOT LOCALIZED

```text
Platform → Bookings → Статус
```

Все actual Booking status values → RU/AZ/EN.

Raw enum = FAIL.

---

# 11. F8 — BOOKINGS TABLE HEADERS NOT LOCALIZED

В таблице Bookings обнаружены нелокализованные заголовки.

Проверить ВСЕ:

```text
sortable headers
non-sortable headers
code
amount
status
service date
created date
actions
и любые другие actual columns
```

Runtime requirement:

```text
RU → полностью RU
AZ → полностью AZ
EN → полностью EN
```

Mixed-language header row = FAIL.

Raw i18n key = FAIL.

---

# 12. F9–F11 — KPI LAST 3 CARDS STILL PAGE-DEPENDENT

Затронуты:

```text
F9  Catalog
F10 Orders
F11 Bookings
```

Визуально последние 3 KPI-карточки продолжают считать данные текущей страницы.

Это прямо противоречит заявлению Round 1A:

```text
Backend aggregate counts — page-independent, filter-aware
```

Нельзя просто снова добавить aggregate.

Провести trace:

```text
DB aggregate
→ service
→ controller
→ API response
→ frontend API client
→ page state
→ KPI mapping
→ card props
→ rendered value
```

Проверить возможные root causes:

```text
frontend still derives KPI from paginated items
wrong response field
fallback overrides aggregate
aggregate response not wired
stale state
pagination request changes aggregate query
wrong KPI mapping
backend aggregate itself paginated
other
```

---

# 13. KPI CANONICAL INVARIANT

Для Catalog / Orders / Bookings:

```text
AUTHORIZED + SEARCH/FILTER/DATE-RANGE SET
├── KPI aggregate over FULL set
└── rows → sort → paginate
```

Forbidden:

```text
paginate → KPI aggregate
```

Также запрещён unscoped global aggregate.

KPI должен учитывать:

```text
authorization
workspace/tenant scope
search where applicable
filters
dateFrom/dateTo
```

но НЕ:

```text
page
pageSize slice
```

---

# 14. KPI MANDATORY RUNTIME PROOF

Для каждой страницы выбрать состояние:

```text
total > pageSize
```

Зафиксировать:

```text
search
filters
date range
pageSize
page 1 row IDs/codes
page 1 KPI values
page 2 row IDs/codes
page 2 KPI values
```

Обязательное доказательство:

```text
page1 rows != page2 rows
AND
page1 KPI == page2 KPI
```

Затем изменить meaningful filter и доказать, что aggregate пересчитывается по новой полной filtered set.

Не требовать искусственного изменения KPI, если конкретный filter объективно оставляет значение тем же.

---

# 15. F12 — ORDERS AMOUNT ALIGNMENT

```text
Orders → Сумма
```

Содержимое колонки визуально не центрировано.

Текущий UX requirement:

```text
header centered
cells centered
sort icon does not shift visual center
```

Не ломать currency/amount formatting.

---

# 16. F13 — BOOKINGS AMOUNT ALIGNMENT

```text
Bookings → Сумма
```

Тот же contract:

```text
header centered
cells centered
sorting remains functional
column geometry remains stable
```

---

# 17. F14 — USERS: “ДАТА СОЗДАНИЯ” → “ДАТА РЕГИСТРАЦИИ”

Round 1A добавил `createdAt`, но UI semantic label должен быть:

```text
RU: Дата регистрации
AZ: корректный азербайджанский перевод
EN: Registration date
```

Backend/schema/API field может оставаться:

```text
createdAt
```

Не переименовывать persistence field только ради UI label.

Проверить, что sorting продолжает использовать правильное server-side поле.

---

# 18. SYSTEMATIC I18N RE-QUALIFICATION

Так как findings показывают системный дефект, проверить runtime полностью:

```text
CRM Customers list
CRM Partners list
Customer 360 header/summary
Partner 360 header/summary
all Customer 360 tables
all Partner 360 tables
Catalog
Orders
Bookings
Users
```

На каждом applicable surface проверить:

```text
table headers
status values
payment statuses
refund statuses
product/service statuses
product/service types
customer types
roles
filter labels
filter options
KPI labels
search placeholders
empty states
pagination
date labels
```

Locales:

```text
RU
AZ
EN
```

---

# 19. FILTER LOCALIZATION RE-CHECK

Обязательно повторно проверить:

```text
Catalog
  Тип
  Статус

Orders
  Статус заказа
  Статус оплаты

Bookings
  Статус бронирования

Users
  Статус
  Роль

CRM Customers
  Тип клиента
  Статус

CRM Partners
  Статус
```

Для каждого:

```text
filter label localized
“All” localized
options localized
selected visible value localized
API/URL value remains canonical enum
```

Например:

```text
UI: Активен / Aktiv / Active
API: ACTIVE
```

---

# 20. CENTRALIZED I18N

Не создавать новые page-local ternary chains, если уже существует shared translation architecture.

Предпочтительно:

```text
shared status translation map/helper
```

или существующий canonical equivalent.

Проверить reuse для:

```text
Customer
Partner
Product
Order
Booking
Payment
Refund
User role/status
```

Unknown enum handling должен быть безопасным и диагностируемым.

---

# 21. DATE RANGE REGRESSION

Round 1A добавил:

```text
dateFrom
dateTo
inclusive end-of-day
```

Повторно проверить:

```text
Catalog
Orders
Bookings
Users
```

KPI aggregate должен учитывать тот же active date range.

Не менять date semantics без доказанного дефекта.

---

# 22. TABLE GEOMETRY REGRESSION

Сохранить Round 1A:

```text
table-layout: fixed
colgroup
semantic widths
stable widths across pages
stable widths across sorting/filtering
horizontal overflow where required
```

Проверить RU/AZ/EN, поскольку длина локализованных строк различается.

Amount centering не должен ломать widths.

---

# 23. BROWSER RUNTIME MATRIX

Заполнить реальными результатами:

| Surface | RU | AZ | EN |
|---|---:|---:|---:|
| CRM Customers list | | | |
| CRM Partners list | | | |
| Customer 360 header | | | |
| Partner 360 header | | | |
| Customer 360 sub-tables | | | |
| Partner 360 sub-tables | | | |
| Catalog | | | |
| Orders | | | |
| Bookings | | | |
| Users | | | |

Каждая ячейка:

```text
PASS
FAIL
N/A — reason
```

No blanks.

---

# 24. FINDING CLOSURE MATRIX

| ID | Surface | Defect | Root Cause | Fix | Runtime Proof | Status |
|---|---|---|---|---|---|---|
| F1 | CRM lists | Status not localized | | | | |
| F2 | Customer/Partner 360 | Header status wrong locale | | | | |
| F3 | CRM 360 tables | Statuses not localized | | | | |
| F4 | Catalog | Status not localized | | | | |
| F5 | Orders | Status not localized | | | | |
| F6 | Orders | Payment content not localized | | | | |
| F7 | Bookings | Status not localized | | | | |
| F8 | Bookings | Headers not localized | | | | |
| F9 | Catalog | KPI page-dependent | | | | |
| F10 | Orders | KPI page-dependent | | | | |
| F11 | Bookings | KPI page-dependent | | | | |
| F12 | Orders | Amount not centered | | | | |
| F13 | Bookings | Amount not centered | | | | |
| F14 | Users | Wrong registration-date wording | | | | |

No blank statuses.

VERDICT A forbidden if any F1–F14 = FAIL.

---

# 25. KPI EVIDENCE MATRIX

| Page | Total | PageSize | Search/Filters | Page 1 KPI | Page 2 KPI | Same? | Filter-aware? |
|---|---:|---:|---|---|---|---:|---:|
| Catalog | | | | | | | |
| Orders | | | | | | | |
| Bookings | | | | | | | |

Use actual runtime values.

---

# 26. LOCALIZATION EVIDENCE MATRIX

| Surface | Field | Canonical Value | RU | AZ | EN | Raw/Wrong Locale? |
|---|---|---|---|---|---|---:|
| CRM Customer list | status | | | | | |
| CRM Partner list | status | | | | | |
| Customer 360 | status | | | | | |
| Partner 360 | status | | | | | |
| Catalog | status | | | | | |
| Orders | status | | | | | |
| Orders | payment | | | | | |
| Bookings | status | | | | | |
| Bookings | headers | N/A | | | | |
| Users | registration date header | N/A | | | | |

Не cherry-pick только ACTIVE. Проверить distinct actual values.

---

# 27. TESTS

Добавить/обновить focused regression tests там, где это разумно:

```text
status translation mapping
unknown enum behavior
Bookings header i18n
Orders payment-status i18n
Users Registration date label
KPI aggregate response mapping
KPI invariance across page changes
amount alignment contract
```

Но:

```text
tests != browser runtime proof
```

---

# 28. REGRESSION GATES

Минимум:

```text
Backend TSC
Backend build
relevant backend tests
Frontend TSC
Frontend build
Frontend tests
Operational Notes regression
```

Round 1A baseline reported:

```text
Frontend tests: 243/243
Operational Notes: 99/99
```

Если legitimate test count изменился — указать actual count и причину.

Любой failure классифицировать:

```text
ROUND_1A_1_REGRESSION
PRE_EXISTING
ENVIRONMENTAL
FLAKY — with repeatability evidence
```

Не скрывать failures.

---

# 29. SCOPE GUARD

НЕ реализовывать в Round 1A.1:

```text
Manual Order creation
Booking-from-Order
new five-method Payment architecture
Cash payment flow
Bank transfer flow
Employee-card flow
Manual refunds
Platform Catalog Create Product removal
CRM История → Последняя активность
Activity Round 2C
```

Это отдельные roadmap stages.

Round 1A.1 закрывает только выявленные visual/runtime defects и связанные regression gaps.

---

# 30. REQUIRED REPORT

Создать:

```text
docs/prompts/PHASE_3_SHARED_TABLE_UX_RUNTIME_REMEDIATION_ROUND_1A_1_VISUAL_FINDINGS_CLOSURE_REPORT.md
```

Отчёт:

```text
РУССКИЙ
```

Technical identifiers могут оставаться English.

---

# 31. GIT DISCIPLINE

Перед staging:

```bash
git diff --check
git status --short
git diff
```

Stage exact files only.

Запрещено:

```bash
git add .
git add -A
```

Commit по repository convention.

Push normally.

Never force-push.

После push:

```bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

---

# 32. ACCEPTANCE CRITERIA

VERDICT A только если одновременно:

1. CRM Customers list statuses localized.
2. CRM Partners list statuses localized.
3. Customer 360 header status localized.
4. Partner 360 header status localized.
5. Customer 360 sub-table statuses localized.
6. Partner 360 sub-table statuses localized.
7. Catalog statuses localized.
8. Orders statuses localized.
9. Orders payment values localized.
10. Bookings statuses localized.
11. All Bookings headers localized.
12. RU runtime verified.
13. AZ runtime verified.
14. EN runtime verified.
15. No mixed-locale status on audited surfaces.
16. No raw enum leakage on audited status surfaces.
17. Filter labels/options localized.
18. API/URL filter values remain canonical.
19. Catalog KPI page-independent.
20. Orders KPI page-independent.
21. Bookings KPI page-independent.
22. Catalog KPI filter-aware.
23. Orders KPI filter-aware.
24. Bookings KPI filter-aware.
25. KPI authorization/scope preserved.
26. KPI date-range authority preserved.
27. Catalog page1/page2 proof complete.
28. Orders page1/page2 proof complete.
29. Bookings page1/page2 proof complete.
30. Orders amount header/cells centered.
31. Bookings amount header/cells centered.
32. Amount sorting preserved.
33. Users RU label = `Дата регистрации`.
34. Users AZ label correct.
35. Users EN label = `Registration date`.
36. Users sorting still uses correct `createdAt`.
37. Search preserved.
38. Filters preserved.
39. Sorting preserved.
40. Pagination preserved.
41. URL state preserved.
42. dateFrom/dateTo preserved.
43. Fixed/stable column geometry preserved.
44. RU/AZ/EN does not destructively resize tables.
45. Browser matrix complete.
46. Finding closure matrix complete.
47. KPI evidence matrix complete.
48. Localization evidence matrix complete.
49. Backend TSC PASS.
50. Backend build PASS.
51. Relevant backend tests PASS or correctly classified.
52. Frontend TSC PASS.
53. Frontend build PASS.
54. Frontend tests PASS.
55. Operational Notes regression PASS or legitimate delta explained.
56. No unrelated roadmap feature implemented.
57. Report created in Russian.
58. `git diff --check` clean.
59. Changes committed.
60. Changes pushed.
61. HEAD == origin/master.
62. No F1–F14 remains FAIL.
63. No unresolved P0/P1 runtime defect from this round.
64. Final verdict is based on actual runtime proof.

---

# 33. FINAL RESPONSE FORMAT — STRICTLY RUSSIAN

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
...

FINDING CLOSURE MATRIX
...

KPI ROOT CAUSE
Catalog:
Orders:
Bookings:

KPI EVIDENCE MATRIX
...

LOCALIZATION ROOT CAUSE
...

LOCALIZATION EVIDENCE MATRIX
...

CRM
Customers list:
Partners list:
Customer 360:
Partner 360:
360 sub-tables:
RU:
AZ:
EN:

CATALOG
Status localization:
KPI:
Filters:
Runtime:

ORDERS
Status localization:
Payment localization:
KPI:
Amount alignment:
Runtime:

BOOKINGS
Header localization:
Status localization:
KPI:
Amount alignment:
Runtime:

USERS
Registration date label:
Sorting authority:
Runtime:

FILTER LOCALIZATION
...

COLUMN GEOMETRY REGRESSION
...

REGRESSION
Backend TSC:
Backend build:
Backend tests:
Frontend TSC:
Frontend build:
Frontend tests:
Operational Notes:

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

# 34. VERDICT RULE

Success only:

```text
VERDICT A — PHASE 3 /
SHARED TABLE UX RUNTIME REMEDIATION ROUND 1A.1 /
VISUAL RUNTIME FINDINGS + SYSTEMATIC RU/AZ/EN LOCALIZATION +
PAGE-INDEPENDENT KPI AUTHORITY + AMOUNT ALIGNMENT +
USERS REGISTRATION-DATE SEMANTICS /
FULLY CLOSED AND RUNTIME-VERIFIED
```

Otherwise:

```text
VERDICT B — PHASE 3 /
SHARED TABLE UX RUNTIME REMEDIATION ROUND 1A.1 /
RUNTIME FINDINGS CLOSURE INCOMPLETE
```

No conditional VERDICT A.

---

# 35. STOP

После:

```text
implementation
tests
browser/runtime verification
report
commit
push
```

STOP.

Не начинать следующий roadmap stage.
