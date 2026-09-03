# PHASE 3 — PRE-STEP 3.12 — FINANCIAL PAYMENTS SUCCESSFUL-POPULATION DRILL-DOWN + REGISTRY UX REMEDIATION

## STATUS

**TYPE:** Targeted Runtime Remediation  
**Starting SHA:** использовать фактический `HEAD` на момент запуска. Не предполагать старый SHA.  
**Scope:** Financial Summary → Payments source traceability + Payments registry sorting/filtering/localization.

Текущий runtime evidence:

```text
Financial Summary → Платежей
AZN: 118
EUR: 1
USD: 18
```

После click открывается новая страница:

```text
TravelHub / Финансовая сводка / Платежи
```

но без необходимого successful-payment scope она показывает:

```text
AZN: 131 records
EUR:   2 records
USD:  20 records
```

Ручная runtime-проверка установила:

```text
AZN: difference 13 = refund + failed records
EUR: 2 total = 1 successful + 1 refund
USD: 20 total = 18 CAPTURED + 1 refund + 1 failed
```

Следовательно, Financial Summary metric и unfiltered Payments registry имеют разные populations.

**HARD STOP:** не начинать FX Architecture, Behavioral Telemetry, Step 3.12, Booking KPI redesign или общий Design System/UI redesign.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые reports и prose documentation должны быть преимущественно **на русском языке**:

- remediation report;
- findings;
- root cause analysis;
- payment population semantics;
- architecture decisions;
- security/performance findings;
- browser/network evidence;
- conclusions;
- verdict explanation.

English допускается только для technical identifiers: paths, classes, methods, DTO/model/table names, endpoints, HTTP methods/status codes, Git/CLI commands, SHA, enums (`CAPTURED`, `FAILED`, etc.), permission identifiers, code snippets и standardized `VERDICT` strings.

**Hard acceptance criterion:** преимущественно английский report = task incomplete.

---

# 1. OBJECTIVE

Исправить source traceability:

```text
Financial Summary successful-payment metric
→ click
→ Payments registry
→ exact same successful-payment population
```

и довести новую Payments registry до минимального production-grade data-table contract:

1. корректный successful status scope при drill-down;
2. exact count/amount reconciliation;
3. server-side filtering;
4. server-side sorting;
5. URL hydration;
6. полная локализация пользовательского UI;
7. Aggregate Summary по всей filtered population;
8. pagination после filters/sort;
9. security/performance.

---

# 2. DO NOT HARD-CODE `CAPTURED` WITHOUT PROOF

Runtime USD strongly indicates `CAPTURED` is qualifying successful state, но перед изменением доказать canonical backend formula Financial Summary.

Найти exact source query для:

```text
Financial Summary → Платежей
```

Документировать:

```text
Payment entity/table
COUNT formula
SUM formula
qualifying status/statuses
currency predicate
business timestamp
date interval
workspace/tenant scope
refund representation
failed representation
soft-delete/void behavior if any
```

Если qualifying population состоит только из `CAPTURED`, зафиксировать это.

Если существуют другие successful terminal statuses — включать только после source proof.

---

# 3. CANONICAL SEMANTICS / LABEL

Если доказано:

```text
Financial Summary "Платежей"
= successful/captured Payment records only
```

переименовать public metric в понятный пользователю вариант:

```text
Успешные платежи
```

или другой русский label, точно соответствующий canonical semantics.

Не оставлять generic `Платежей`, если рядом существует registry всех операций, включая failed/refund, и это создаёт неоднозначность.

i18n key должен быть shared/canonical, без hardcoded Russian string.

---

# 4. DRILL-DOWN CONTRACT

Click по currency-specific successful payment metric должен передавать:

```text
from
to
preset
currency
successful payment status scope
fromAnalytics=true
workspace context
```

Пример после доказательства статуса:

```text
Financial Summary
AZN → Успешные платежи = 118
        ↓
TravelHub / Финансовая сводка / Платежи

Период: Месяц
Валюта: AZN
Статус: Успешный
```

Destination обязан сразу, **на первом render без F5**, показать:

```text
ИТОГО ПО ТЕКУЩЕЙ ВЫБОРКЕ
Платежей: 118
Сумма: <canonical SUM> AZN

Table total: 118
Pagination total: 118
```

При снятии status filter registry должен показывать полный payment journal/population, например текущие 131 AZN records.

То есть:

```text
drill-down context ≠ permanent registry restriction
```

Пользователь может расширить выборку после перехода.

---

# 5. MANDATORY THREE-CURRENCY RECONCILIATION

Использовать актуальный dataset. Текущие runtime reference values:

```text
AZN source = 118
EUR source = 1
USD source = 18
```

До исправления registry:

```text
AZN all records = 131
EUR all records = 2
USD all records = 20
```

После click successful scope должен дать:

```text
AZN: 118 → 118
EUR:   1 →   1
USD:  18 →  18
```

Обязательно сверять не только count, но и amount:

```text
Source successful count
=
Destination aggregate count
=
registry/pagination total
=
COUNT(exact qualifying Payment IDs)
```

и:

```text
Source successful amount
=
Destination aggregate amount
=
SUM(Payment.amount over exact same IDs)
```

---

# 6. STATUS POPULATION FORENSICS

Для каждой currency создать runtime breakdown:

| Currency | CAPTURED/success | REFUND | FAILED | Other | All | Source metric |
|---|---:|---:|---:|---:|---:|---:|
| AZN | | | | | 131/current | 118/current |
| EUR | | 1/current | | | 2/current | 1/current |
| USD | 18/current | 1/current | 1/current | | 20/current | 18/current |

Использовать фактические enum/status names из repo.

Для AZN доказать, что именно составляет текущую разницу `131 - 118 = 13`.

Никаких предположений в final report.

---

# 7. PAYMENTS REGISTRY — FILTER CONTRACT

Новая страница Payments должна иметь реальные filters минимум по применимым полям:

```text
Период
Валюта
Статус платежа
Поиск
```

Если данные позволяют и это соответствует registry architecture, также:

```text
Partner
Customer
Payment method
Order/Booking reference
```

Не создавать неработающие декоративные filters.

Status filter должен использовать localized labels, но canonical enum в API.

Пример:

```text
Успешный  → CAPTURED
Ошибка    → FAILED
Возврат   → actual canonical refund status/type
```

Не предполагать название refund enum — взять из repo.

---

# 8. PAYMENTS REGISTRY — SORTING CONTRACT

Текущая новая таблица не поддерживает sorting по клику на headers. Исправить.

## 8.1 Required sortable columns

Сделать sortable все meaningful columns, для которых существует однозначный backend field/query mapping, минимум:

```text
Дата/время
Сумма
Валюта
Статус
```

и при наличии canonical fields:

```text
Payment ID
Partner
Customer
Order/Booking reference
Payment method
```

## 8.2 UI behavior

```text
first click  → ASC
second click → DESC
third click  → default/none
```

или использовать существующий shared project sorting contract, если он уже определён.

Active sort должен быть визуально виден.

## 8.3 Server-side only

Критически:

```text
filter
→ sort
→ aggregate/total
→ pagination
```

Не сортировать только 20 rows текущей страницы в browser.

URL/query state должен сохранять sort:

```text
sortBy
sortOrder
```

Refresh/back-forward должны воспроизводить результат.

## 8.4 Stable sorting

Добавить deterministic tie-breaker, например canonical ID, чтобы pagination не давала duplicate/missing rows при одинаковом primary sort value.

---

# 9. AGGREGATE SUMMARY CONTRACT

Над Payments table:

```text
FILTER BAR
↓
ИТОГО ПО ТЕКУЩЕЙ ВЫБОРКЕ
↓
TABLE
↓
PAGINATION
```

Summary считается по **всей filtered population**, не по текущей странице.

Минимум:

```text
Количество платежей
Сумма платежей
```

При unfiltered multi-currency population:

```text
AZN: count + amount
USD: count + amount
EUR: count + amount
```

До FX запрещено:

```text
SUM(AZN + USD + EUR)
```

Если status filter = successful, summary должен считать только successful records.

---

# 10. LOCALIZATION — COMPLETE THE NEW PAGE

Текущая Payments page имеет частичную локализацию.

Выполнить inventory всей страницы:

```text
breadcrumbs
page title
column headers
filter labels
filter values
status labels
sort labels/tooltips if any
aggregate labels
pagination
empty state
loading state
error state
payment methods
detail/drawer fields
buttons/actions
validation messages
```

Никаких raw enum values в пользовательском UI, если для них должен существовать localized label.

Например:

```text
CAPTURED → локализованный label
FAILED   → локализованный label
<refund enum> → локализованный label
```

Не менять canonical API enum.

Проверить все поддерживаемые locale проекта, а не только RU.

---

# 11. FIRST-NAVIGATION HYDRATION

Проверить, что click из Financial Summary не повторяет прежний hydration defect.

Для AZN/EUR/USD:

```text
source metric
→ click
→ FIRST authoritative API request already contains:
   from/to
   currency
   successful status scope
→ first render correct
→ F5 same
```

Hard:

```text
SOURCE
=
FIRST RENDER
=
AFTER F5
```

Не допускается first request all-payments → затем corrective request.

---

# 12. URL / BACK / FORWARD

Проверить:

```text
Analytics → Payments
change status
change currency
sort
change page
F5
Back
Forward
```

State должен воспроизводиться корректно.

При возвращении к successful drill-down контекст должен восстанавливаться.

---

# 13. SECURITY

Все filtering/sorting/aggregates server-authoritative.

Проверить:

```text
authentication
RBAC
workspace/tenant scope
partner visibility where applicable
query-param tampering
currency/status manipulation
```

Query params не могут расширить доступную financial population.

Aggregate и table rows должны использовать один authorized query scope.

---

# 14. PERFORMANCE

Запрещено:

```text
fetch all payments
→ filter/sort/sum in frontend
```

Требуется:

```text
server-side WHERE
server-side ORDER BY
server-side COUNT
server-side SUM/grouped aggregates
server-side pagination
```

Проверить:

- query count;
- отсутствие N+1;
- индексы для реально используемых payment date/status/currency/order fields;
- no duplicate requests on first navigation.

Не добавлять индексы без evidence/query need.

---

# 15. SHARED DATA TABLE CONTRACT

Перед созданием Payments-only sorting/filtering primitives проверить существующие shared components/hooks/contracts.

Если уже существуют:

```text
DataTable
TableHeader
SortState
Pagination
FilterBar
AggregateSummary
URL state helpers
```

расширить/reuse их.

Не создавать второй несовместимый table framework.

Payments page должна стать reference implementation для будущей унификации таблиц, но **не проводить сейчас глобальный redesign остальных страниц**.

---

# 16. TARGETED TESTS

Добавить tests, которые падали бы на старом поведении.

Минимум:

```text
AZN source successful count = destination
EUR source successful count = destination
USD source successful count = destination

successful amount reconciliation by currency

refund excluded from successful drill-down
failed excluded from successful drill-down

clearing status filter restores all-payment population

currency purity

sort ASC
sort DESC
stable pagination after sort
filter + sort + pagination order

aggregate uses entire filtered population, not page

first navigation carries successful scope
F5 preserves state
Back/Forward preserves state

localized status labels
no raw known payment enum in visible UI
```

---

# 17. REQUIRED BROWSER / NETWORK EVIDENCE

Приложить evidence минимум для:

### AZN
```text
Financial Summary source = 118/current
→ click
→ visible successful filter
→ destination total = 118/current
→ pagination = 118/current
→ amount reconciled
```

### EUR
```text
source = 1/current
all = 2/current
refund excluded
successful destination = 1/current
```

### USD
```text
source = 18/current
all = 20/current
18 successful + 1 refund + 1 failed
successful destination = 18/current
```

### Sorting
Для минимум двух колонок показать:

```text
ASC first page
DESC first page
network query sortBy/sortOrder
```

### Localization
Показать Payments page без raw/untranslated known UI strings для проверяемой locale.

---

# 18. REQUIRED REPORT

Создать преимущественно русский:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_FINANCIAL_PAYMENTS_DRILLDOWN_REGISTRY_REMEDIATION_REPORT.md
```

Обязательные разделы:

1. Starting SHA;
2. reproduction before fix;
3. canonical Financial Summary payment formula;
4. canonical successful statuses;
5. AZN/EUR/USD status breakdown;
6. root cause;
7. label decision;
8. drill-down implementation;
9. Payments registry filter implementation;
10. sorting implementation;
11. Aggregate Summary;
12. localization inventory/fixes;
13. first-navigation hydration;
14. security;
15. performance;
16. targeted tests;
17. browser/network evidence;
18. reconciliation matrices;
19. residual gaps;
20. real Git SHAs;
21. verdict;
22. exact NEXT.

---

# 19. GIT

Перед работой:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
```

Starting SHA = фактический HEAD.

После:

```text
Starting SHA:       <actual>
Implementation SHA: <real>
Final HEAD:         <real>
origin/master:      <real>
HEAD == origin:     YES/NO
```

Не придумывать SHA.

---

# 20. ACCEPTANCE GATES

## Gate A — Semantics
Financial Summary successful-payment formula доказана из authoritative source.

## Gate B — AZN
```text
source successful count
= destination count
= pagination total
= exact IDs
```
и amount reconciles.

## Gate C — EUR
То же; refund не входит в successful drill-down.

## Gate D — USD
То же; refund и failed не входят в successful drill-down.

## Gate E — Registry filters
Currency/status/period работают server-side и URL-hydrated.

## Gate F — Sorting
Meaningful columns sortable server-side до pagination; ASC/DESC/stability доказаны.

## Gate G — Aggregate Summary
Вся filtered population; counts/amounts; native currencies separated.

## Gate H — Localization
Новая Payments page полностью локализована в рамках supported locales; canonical enums не изменены.

## Gate I — Navigation
First request already scoped; first render = F5; back/forward PASS.

## Gate J — Security/performance/tests
PASS.

---

# 21. VERDICT

Только если Gates A–J PASS:

```text
VERDICT A — FINANCIAL PAYMENTS SOURCE TRACEABILITY & REGISTRY REMEDIATION APPROVED
```

После этого **не объявлять весь PRE-STEP 3.12 автоматически закрытым**.

Если любой gate FAIL:

```text
VERDICT B — FINANCIAL PAYMENTS SOURCE TRACEABILITY & REGISTRY REMEDIATION INCOMPLETE
```

Перечислить exact residual findings.

---

# 22. HARD STOP

После выполнения **STOP**.

Не начинать автоматически:

```text
Final Strict Re-Qualification
Multi-Currency / FX Architecture Amendment
Behavioral Telemetry
Booking Center KPI semantics remediation
Step 3.12
global table redesign
dark-gold / Design System implementation
```

Сначала предоставить пользователю русский report, реальные SHA, AZN/EUR/USD reconciliation, browser/network evidence, sorting/filter evidence, localization evidence, tests и verdict.
