# PHASE 3 — PRE-STEP 3.12 — ANALYTICS ROUND 5 STRICT COMPLETION / RE-QUALIFICATION — RUNTIME FINDINGS REMEDIATION

## STATUS

```text
Starting SHA: 6bf44e3
Previous Starting SHA: 0de71a6
Previous Round 5 Final SHA: 6bf44e3
```

Предыдущий отчёт объявил:

```text
VERDICT A — ANALYTICS ROUND 5 RECONCILIATION APPROVED
Canonical NEXT: MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT
```

**Этот VERDICT A не принимается как финальный.**

После ручной runtime-проверки на `6bf44e3` обнаружены незакрытые дефекты source traceability, reconciliation, period semantics и table drill-down.

При этом уже доказанное исправление half-open interval необходимо **сохранить без регрессии**:

```text
Canonical date interval:
[from, to)

dateFrom = inclusive
dateTo   = exclusive
```

Подтверждённый положительный reference case:

```text
Analytics → Заказы = 214
        ↓ click
Orders Center → Всего заказов = 214

214 = 214
PASS
```

Именно этот UX/reconciliation pattern должен стать эталоном для остальных агрегированных метрик.

Текущая квалификация:

```text
ROUND 5 = PARTIAL
FINAL VERDICT = VERDICT B — REMEDIATION REQUIRED
```

---

# LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые или обновляемые отчёты и текстовая документация должны быть преимущественно **на русском языке**:

- Implementation Report;
- Remediation Report;
- Strict Review Report;
- Evidence / Runtime Report;
- Gap Audit;
- findings explanations;
- root cause analysis;
- architecture decisions;
- security findings;
- runtime evidence descriptions;
- conclusions/recommendations;
- verdict explanations.

Английский допускается только для технических идентификаторов:

- file paths;
- class/method/DTO/model/table names;
- API endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- commit messages;
- enum;
- permission identifiers;
- code snippets;
- стандартизированных `VERDICT` strings.

**Hard acceptance criterion:** если итоговый отчёт преимущественно написан на английском языке, задача считается незавершённой и отчёт должен быть исправлен до финального verdict.

---

# 1. OBJECTIVE

Не начинать новый архитектурный этап.

Цель этой итерации — **закрыть фактические runtime findings Round 5 и провести строгую re-qualification полного первоначального Round 5 scope**.

Не ограничиваться перечисленными ниже шестью пользовательскими findings. Они являются обязательными runtime evidence cases, но после исправления необходимо повторно пройти весь Round 5 acceptance contract.

Ключевой принцип:

```text
metric shown to user
        ↓ click
authoritative destination / detail
        ↓
same canonical period
same workspace/scope
same metric population
same statuses
same currency semantics
        ↓
visible corresponding aggregate
+
contributing records
        ↓
source value = destination value
```

Сам факт redirect/href **не является drill-down PASS**.

---

# 2. CONFIRMED RUNTIME FINDINGS

## R5-C1 — `GMV (выполненные)` drill-down broken

### Runtime

Пользователь нажимает:

```text
Analytics
GMV (выполненные)
        ↓
Orders Center
```

На destination наблюдается:

```text
Всего заказов             0
Активные                  0
Готовы к бронированию     0
Закрыто/отменено          0

Статус: FULFILLED,CLOSED

Internal server error
```

Дополнительно:

- ошибка отображается на английском;
- одновременно с backend error summary cards показывают `0`, что может восприниматься как реальные данные;
- в Orders Center отсутствует видимый aggregate `GMV (выполненные)`, поэтому source amount невозможно визуально сверить.

### Status

```text
FAIL
Priority: P0/P1
```

### Required root-cause audit

Доказать:

1. какой exact status population определяет `GMV (выполненные)`;
2. какой monetary field является canonical GMV base;
3. какой business timestamp применяется;
4. какая currency semantics применяется;
5. какой period передаётся;
6. почему `FULFILLED,CLOSED` приводит к server error;
7. какой format multi-status query реально поддерживает backend DTO/API;
8. не расходятся ли frontend enum и backend enum;
9. почему при failed request UI показывает `0`;
10. является ли Orders Center действительно authoritative destination для этой метрики.

Не угадывать, что ошибка вызвана comma-separated status. Проверить реальный DTO/controller/service/query contract.

### Hard acceptance

После исправления:

```text
Analytics:
GMV (выполненные) = X

        ↓ click

Destination:
GMV (выполненные) = X
+
records contributing to X

Source X = Destination X
```

Если Orders Center остаётся destination, он должен уметь показывать соответствующий **filtered contextual aggregate**, а не только count cards.

Если Orders Center не является корректным authoritative source, использовать dedicated metric detail/drill-down, а не misleading redirect.

### Error-state contract

При backend failure запрещено:

```text
request failed
→ show trustworthy-looking zero totals
```

Нужны корректные loading/error states.

User-facing error должна быть локализована.

---

# 3. R5-C2 — `Платежи клиентов` не имеют visible reconciliation

### Runtime

```text
Analytics:
Платежи клиентов = X
        ↓ click
Orders Center
```

Redirect происходит, но в destination отсутствует соответствующий aggregate:

```text
Платежи клиентов = X
```

Поэтому пользователь не может сверить сумму.

### Status

```text
FAIL
Priority: P1
```

### Required audit

Сначала определить canonical source метрики.

Если:

```text
Платежи клиентов = SUM(Payment.amount ...)
```

то проверить, является ли Orders Center правильным authoritative destination вообще.

Предпочтительный destination должен определяться **данными**, а не существующей удобной ссылкой.

Возможные варианты:

```text
Finance / Payments
```

или:

```text
Orders Center + canonical payment aggregate
```

Но решение должно следовать существующей архитектуре и source-of-truth.

### Hard acceptance

```text
Analytics:
Платежи клиентов = X

        ↓ click

Authoritative destination:
Платежи клиентов = X
+
contributing payment records

SUM(contributing canonical amounts) = X
```

Обязательно сохранить:

```text
period
workspace
tenant/partner scope
currency
payment status semantics
business timestamp
```

---

# 4. REFERENCE IMPLEMENTATION — `Заказы`

Пользователь подтвердил корректное runtime-поведение:

```text
Analytics:
Заказы = 214
        ↓ click
Orders Center:
Всего заказов = 214
```

Это **PASS/reference case**.

Не ломать его.

Использовать его UX-принцип для остальных metric drill-down:

```text
source metric visible
→ click
→ destination corresponding metric visible
→ exact reconciliation
```

Но не копировать локальные `href/onClick` вручную. Использовать shared framework.

---

# 5. R5-C3 — `Клиенты`: 423 vs CRM 261

### Runtime

При выбранном:

```text
Период: Год
```

пользователь наблюдает:

```text
Analytics:
Клиенты = 423

        ↓ click

CRM → Клиенты:
Всего клиентов = 261
```

```text
423 ≠ 261
FAIL
```

Дополнительное runtime evidence:

**значение `Клиенты` в Analytics меняется при переключении периодов.**

Это противоречит предыдущему утверждению, что Customers является all-time stock metric.

### Status

```text
FAIL
Priority: P1
```

### Mandatory semantic audit

Не исправлять число до выяснения смысла.

Определить:

1. что именно означает `Клиенты = 423`;
2. source entity/table;
3. `COUNT(*)` или `COUNT(DISTINCT customerId)`;
4. business timestamp;
5. period policy;
6. statuses/population;
7. учитываются ли guest/non-registered customers;
8. учитываются ли repeated customer occurrences;
9. почему period-bound Analytics value может превышать CRM total registered customers;
10. какой product term корректно описывает эту метрику.

### Canonical alternatives

Если это entity stock:

```text
Всего клиентов = 261
PeriodPolicy = ALL_TIME
PeriodSelector не влияет
CRM total = 261
```

Если это period metric:

```text
Новые клиенты
или
Активные клиенты
или
Уникальные покупатели
```

— название должно отражать реальную semantics.

Тогда destination должен воспроизводить **тот же набор**, а не просто открывать общий CRM registry.

### Hard acceptance

Не принимать:

```text
Analytics = 423
CRM = 261
```

как допустимую разницу без явно различающихся названий/семантик.

---

# 6. R5-C4 — `Партнёры`: 33 vs CRM 28

### Runtime

```text
Analytics:
Партнёры = 33

        ↓ click

CRM → Партнёры:
Всего партнёров = 28
```

```text
33 ≠ 28
FAIL
```

Дополнительное runtime evidence:

**Analytics Partners остаётся стабильно `33` при переключении периодов.**

Это сильный признак `ALL_TIME` stock semantics.

### Required audit

Определить:

1. source entity/table Analytics;
2. source entity/table CRM;
3. active/inactive/disabled/pending/archived filters;
4. onboarding/stub records;
5. PartnerStorefront-related records;
6. soft-delete filters;
7. workspace/tenant scope;
8. `COUNT(*)` vs `COUNT(DISTINCT partnerId)`;
9. почему Analytics считает 33;
10. почему CRM отображает 28;
11. какой population является canonical `Всего партнёров`.

### Expected product semantics

Если подтверждено, что это stock metric:

```text
Label: Всего партнёров
PeriodPolicy: ALL_TIME
PeriodSelector: не влияет
```

Hard acceptance:

```text
Analytics Всего партнёров = X
        ↓
CRM → Партнёры
Всего партнёров = X
```

Нельзя просто скрыть пять записей или изменить count без root-cause evidence.

---

# 7. R5-C5 — `Квалифицированный GMV` broken

### Runtime

Проблема того же класса, что R5-C1:

```text
Analytics:
Квалифицированный GMV = X
        ↓
Orders Center

0 summary values
Internal server error
English/non-localized error
нет corresponding aggregate для сверки
```

### Status

```text
FAIL
Priority: P0/P1
```

### Critical semantic requirement

Не объединять:

```text
GMV (выполненные)
```

и:

```text
Квалифицированный GMV
```

только потому, что они обе GMV metrics.

Для каждой отдельно доказать:

```text
canonical statuses/population
monetary base
business timestamp
period
currency
source records
destination
```

### Hard acceptance

```text
Analytics:
Квалифицированный GMV = X
        ↓
destination:
Квалифицированный GMV = X
+
contributing records
```

---

# 8. R5-C6 — TABLES STILL NOT CLICKABLE

### Runtime

После `6bf44e3` пользователь подтвердил:

```text
таблицы всё ещё не кликабельны
```

Это означает:

```text
Shared Metric Drill-down Framework
= PARTIAL
```

и:

```text
project-wide table integration
= FAIL
```

### Required architecture

Не создавать ещё одну локальную систему.

Должна использоваться общая архитектура:

```text
MetricCard ───────────────┐
                         │
MetricTableCell ──────────┼→ Shared DrillDown Contract
                         │          ↓
Chart/Aggregate ─────────┘   Destination Resolver
                                    ↓
                              Context Transfer
                                    ↓
                        Authoritative Source UI
                          OR Metric Detail
```

Если существующий `metric-drilldown.ts` недостаточен — расширить его, а не обходить локальными обработчиками.

---

# 9. TABLE CLICKABILITY SEMANTICS

**Не делать каждую ячейку каждой таблицы ссылкой.**

Использовать semantic interaction contract.

## Entity identifier

Примеры:

```text
Partner
Customer
Order ID
Booking ID
Payment ID
```

→ authoritative entity/profile/detail.

## Aggregate metric

Примеры:

```text
GMV
Платежи
Комиссия
Заказы
Бронирования
Payment Count
Refund amount
```

→ authoritative contributing records с сохранением context.

## Derived metric

Примеры:

```text
AOV
Доля заверш.
Эфф. ставка
Net
```

→ reusable metric detail:

```text
formula
numerator
denominator/components
period
scope
source records
```

## Ordinary descriptive fields

Могут оставаться static.

---

# 10. FINANCIAL SUMMARY — MANDATORY TABLE INTEGRATION

Для таблицы:

```text
Валюта
Кол-во платежей
Платежи
Возвраты
Net
Комиссия
```

реализовать source traceability.

Ранее были зафиксированы:

```text
AZN Payment Count = 327
EUR Payment Count = 3
USD Payment Count = 30
```

Пример:

```text
USD | Кол-во платежей = 30
        ↓ click
Payments
currency=USD
same period/scope
        ↓
total = 30
```

Для amount:

```text
USD | Платежи = X
        ↓
canonical Payment records
        ↓
SUM(amount) = X
```

То же для Refunds/Commission.

Для `Net` показать canonical formula/components.

### Mandatory evidence

| Currency | Metric | Source | Destination total/SUM | Match |
|---|---|---:|---:|---|
| AZN | Payment Count | | | |
| EUR | Payment Count | | | |
| USD | Payment Count | | | |
| AZN | Payments | | | |
| EUR | Payments | | | |
| USD | Payments | | | |
| ... | Refunds | | | |
| ... | Commission | | | |

---

# 11. PARTNER PERFORMANCE — MANDATORY TABLE INTEGRATION

Обязательные mappings:

| Column | Drill-down |
|---|---|
| Partner | CRM Partner/Profile/360 |
| GMV | contributing canonical records |
| Платежи клиентов | Payments filtered partner + period |
| Комиссия | commission facts partner + period |
| Заказы | Orders partner + period |
| Бронирования | Bookings partner + period |
| Доля заверш. | formula + underlying bookings |
| Эфф. ставка | formula + commission base/source |
| Configured rate, если показывается | partner commission policy |

Hard acceptance example:

```text
Partner Performance:
Partner = Flame Towers Residence
Orders = 6

        ↓ click

Orders Center/detail:
same partner
same period
same scope
total = 6
```

Не принимать просто работающий redirect.

---

# 12. PRESERVE CASPIAN WEDDINGS TRACEABILITY CASE

Повторно проверить ранее зафиксированную anomalous row:

```text
Caspian Weddings

GMV        = 0
Payments   = 0
Commission = 155.50
Orders     = 0
Bookings   = 2
Eff. Rate  = —
```

После реализации table drill-down:

```text
Commission = 155.50
        ↓ click
```

должен быть доступен источник этой суммы.

Показать:

- commission records;
- amount;
- currency;
- partner;
- business timestamp;
- related transaction/order/booking;
- status;
- period.

Если значение корректно — объяснить domain semantics.

Если aggregation ошибочна — исправить root cause.

---

# 13. GLOBAL CALENDAR PERIOD CONTRACT — STILL MANDATORY

Предыдущий Round 5 report показал:

```text
LAST_3_DAYS
LAST_7_DAYS
MONTH
LAST_6_MONTHS
YEAR
```

Это **не доказывает** согласованный canonical calendar contract.

Особенно:

```text
LAST_7_DAYS
```

не эквивалентно:

```text
Неделя = текущая календарная неделя
```

И `LAST_6_MONTHS` необходимо проверить на соответствие продуктовой semantics.

Canonical named-period contract:

| UI | Required semantics |
|---|---|
| Сегодня | начало текущего календарного дня → NOW |
| Неделя | начало текущей календарной недели → NOW |
| Месяц | начало текущего календарного месяца → NOW |
| Квартал | начало текущего календарного квартала → NOW |
| 6 месяцев | начало первого из 6 календарных месяцев, включая текущий → NOW |
| Год | 1 января текущего года → NOW |
| Период | explicit custom range |

Нестандартные диапазоны покрываются `Период`.

Не вводить скрытую смесь:

```text
Неделя = rolling 7 days
Месяц  = calendar month
Год    = calendar year
```

---

# 14. REQUIRED PRESET REMEDIATION

Проверить UI labels, enum names и фактический resolver.

Если существующие enums называются:

```text
LAST_7_DAYS
LAST_6_MONTHS
```

не менять их только косметически.

Нужно проверить **реальную boundary semantics**.

Для fixed runtime date `2026-08-30` показать:

```text
TODAY:
from = ...
to   = ...

WEEK:
from = ...
to   = ...

MONTH:
from = ...
to   = ...

QUARTER:
from = ...
to   = ...

SIX_MONTHS:
from = ...
to   = ...

YEAR:
from = ...
to   = ...
```

`to` для текущего period должен соответствовать canonical current-period policy и не включать future-dated records.

Сохранить `[from,to)` contract.

---

# 15. GLOBAL PERIOD CONSUMER AUDIT — NOT ANALYTICS ONLY

Проверить:

```text
Analytics
Command Center / Рабочий стол
Orders Center
Booking Center
CRM period-bound metrics
Sales Center
Finance
Financial Summary
Partner Performance
shared charts
other domain widgets/registries using period filters
```

Создать inventory:

| Consumer | Resolver | TODAY | WEEK | MONTH | QUARTER | 6M | YEAR | CUSTOM | TZ | PASS |
|---|---|---|---|---|---|---|---|---|---|---|

Наличие shared `PeriodSelector` в UI не доказывает, что backend consumers используют одинаковые boundaries.

---

# 16. BUSINESS TIMESTAMP MATRIX

Для каждой period-bound метрики документировать:

| Metric | PeriodPolicy | Business timestamp | Status/population | Currency semantics |
|---|---|---|---|---|
| Orders | | | | |
| Bookings | | | | |
| GMV completed | | | | |
| Qualified GMV | | | | |
| Customer Payments | | | | |
| Commission | | | | |
| Refunds | | | | |
| AOV | | | | |
| Customers | | | | |
| Sessions | | | | |

Не использовать `createdAt` для всех метрик автоматически.

---

# 17. HALF-OPEN INTERVAL REGRESSION

Сохранить исправление:

```text
[from,to)
```

и обязательно добавить regression tests.

Особенно:

```text
record exactly at from
→ INCLUDED

record immediately before to
→ INCLUDED

record exactly at to
→ EXCLUDED
```

Проверить Orders и Bookings.

Если другие domain APIs используют inclusive `dateTo`, включить их в audit.

---

# 18. ERROR LOCALIZATION / ZERO-MASKING

R5-C1/R5-C5 показали одновременно:

```text
0
0
0
0

Internal server error
```

Это отдельный systemic UX finding.

При failed aggregate/list request:

- не показывать нули как достоверные значения;
- показать корректный loading/error state;
- пользовательская ошибка должна быть локализована;
- technical backend message не должен быть основным UI copy;
- retry/recovery behavior должен соответствовать существующему UI pattern.

Проверить RU и другие поддерживаемые locale keys в рамках существующей i18n архитектуры.

---

# 19. SHARED DRILL-DOWN CONTEXT

Shared resolver должен уметь передавать canonical context:

```text
metricId
periodPolicy
from
to
preset
workspace
tenant/partner scope
statusScope
currency
partnerId
customerId
service/capability
metric-specific filters
```

`fromAnalytics=true` может использоваться как navigation/UX hint, но **не как business/security authority**.

---

# 20. SECURITY

Destination самостоятельно применяет server-side:

```text
RBAC
workspace authority
tenant/partner scope
entitlement
canonical filter validation
```

Проверить negative cases:

```text
tampered partnerId
tampered workspace/scope
unauthorized destination
invalid status
invalid multi-status
invalid period
from >= to where invalid
```

Нельзя доверять query string только потому, что он сформирован Analytics.

---

# 21. FULL KPI RE-QUALIFICATION

После исправления шести runtime findings проверить **все Analytics KPI cards**, а не только проблемные.

Создать matrix:

| KPI | Period policy | Source value | Clickable | Destination | Visible corresponding metric | Destination value | Match | PASS |
|---|---|---:|---|---|---|---:|---|---|

Для карточек без естественного registry destination использовать dedicated detail.

Нельзя оставлять:

```text
10/14 clickable
```

как достаточный критерий.

Для каждой из оставшихся четырёх должна быть документирована причина и обеспечена source traceability, если metric по своей природе требует drill-down.

---

# 22. FULL TABLE RE-QUALIFICATION

Создать аналогичную matrix:

| Screen/Table | Cell metric | Clickable | Destination/detail | Context preserved | Source | Destination | Match |
|---|---|---|---|---|---:|---:|---|

Минимум:

```text
Financial Summary
Partner Performance
```

и все другие таблицы Analytics, содержащие агрегированные metrics, найденные repository/runtime audit.

---

# 23. CUSTOM PERIOD REGRESSION

Сохранить ранее исправленный contract:

```text
CUSTOM selected
→ inputs shown
→ incomplete dates
→ NO invalid API request
→ NO loading error

valid from/to
→ request
```

Проверить:

```text
start only
end only
same date
start > end
clear one date
CUSTOM → preset
preset → CUSTOM
refresh/hydration
```

---

# 24. BROWSER EVIDENCE — MANDATORY

Не писать просто:

```text
Browser PASS
```

Отчёт должен содержать конкретные runtime values.

Минимальные обязательные cases:

### A. Orders reference

```text
Analytics Orders = X
Orders Center = X
```

### B. GMV completed

```text
Analytics GMV completed = X
Destination GMV completed = X
No server error
```

### C. Customer Payments

```text
Analytics Customer Payments = X
Destination Customer Payments = X
```

### D. Customers

```text
Analytics Customers = X
Defined semantics = ...
Destination corresponding population = X
```

### E. Partners

```text
Analytics Partners = X
CRM Partners corresponding population = X
```

### F. Qualified GMV

```text
Analytics Qualified GMV = X
Destination Qualified GMV = X
No server error
```

### G. Financial Summary cell

```text
USD Payment Count = X
destination = X
```

### H. Partner Performance cell

```text
Partner P / Orders = X
destination filtered total = X
```

---

# 25. NETWORK EVIDENCE — MANDATORY

Для representative drill-downs показать:

```text
source endpoint
destination endpoint
query parameters
status
response total/aggregate
```

Обязательно:

```text
GMV completed
Qualified GMV
Customer Payments
Orders
Customers
Partners
Financial Summary USD Payment Count
Partner Performance Orders
multi-status case
```

---

# 26. AUTOMATED TESTS

Минимально добавить/обновить tests для:

### Period

```text
TODAY calendar boundary
WEEK calendar boundary
MONTH calendar boundary
QUARTER calendar boundary
SIX_MONTHS calendar boundary
YEAR calendar boundary
CUSTOM
[from,to)
timezone
```

### Drill-down

```text
MetricCard
MetricTableCell
destination resolver
context transfer
multi-status serialization/parsing
stock metric
period-bound metric
derived metric detail
```

### Backend

```text
Orders multi-status
Bookings filters
GMV population
Qualified GMV population
Payment aggregation
Customers canonical population
Partners canonical population
currency filters
scope/security
```

### Regression

```text
frontend tests
backend tests
TSC
build
relevant E2E
```

Не ослаблять существующие tests.

---

# 27. REQUIRED ROOT-CAUSE TABLE

Итоговый report должен содержать:

| Finding | Root Cause | Fix | Runtime Evidence | Status |
|---|---|---|---|---|
| R5-C1 GMV completed | | | | |
| R5-C2 Customer Payments | | | | |
| R5-C3 Customers 423 vs 261 | | | | |
| R5-C4 Partners 33 vs 28 | | | | |
| R5-C5 Qualified GMV | | | | |
| R5-C6 Table drill-down | | | | |
| Calendar period contract | | | | |
| Global consumer audit | | | | |

---

# 28. REQUIRED RECONCILIATION TABLE

Итоговый report обязан содержать фактические числа:

| Source screen | Metric | Preset | Source value | Destination | Destination value | Match |
|---|---|---|---:|---|---:|---|
| Analytics | Orders | MONTH | | Orders | | |
| Analytics | GMV completed | MONTH | | | | |
| Analytics | Customer Payments | MONTH | | | | |
| Analytics | Customers | YEAR | | CRM/semantic destination | | |
| Analytics | Partners | ALL_TIME | | CRM Partners | | |
| Analytics | Qualified GMV | | | | | |
| Financial Summary | USD Payment Count | | | Payments | | |
| Partner Performance | Orders | | | Orders | | |

Добавить остальные проверенные KPI/cells.

---

# 29. DO NOT MASK THE FINDINGS

Запрещено:

- менять seed/data только ради совпадения;
- hardcode totals;
- скрывать records;
- считать redirect PASS;
- считать href PASS;
- считать `0` корректным fallback при API error;
- переименовать metric без доказательства semantics;
- сделать Customers `ALL_TIME` только ради совпадения с CRM;
- изменить CRM count только ради совпадения с Analytics;
- удалить multi-status filter вместо исправления canonical semantics;
- создавать duplicate registry;
- создавать Analytics-only table click handlers;
- объявлять framework project-wide без runtime table evidence.

---

# 30. REQUIRED REPORT STRUCTURE

Создать отдельный:

```text
PHASE 3 — PRE-STEP 3.12 — ANALYTICS ROUND 5 STRICT COMPLETION / RE-QUALIFICATION REPORT
```

Преимущественно на русском языке.

Обязательные разделы:

1. Git evidence.
2. Starting/Final/origin SHA.
3. Root cause по каждому finding.
4. Shared period architecture.
5. Calendar preset evidence.
6. Business timestamp matrix.
7. Shared drill-down architecture.
8. KPI reconciliation matrix.
9. Table reconciliation matrix.
10. Financial Summary evidence.
11. Partner Performance evidence.
12. Customers semantics.
13. Partners semantics.
14. Error/i18n evidence.
15. Security evidence.
16. Browser evidence с числами.
17. Network evidence.
18. Tests/build/typecheck.
19. Residual gaps.
20. Final verdict.

---

# 31. VERDICT RULES

## VERDICT A разрешён только если

Все условия одновременно выполнены:

1. `Заказы` reference case остаётся PASS;
2. `GMV (выполненные)` больше не падает;
3. destination показывает соответствующий GMV aggregate;
4. source/destination GMV совпадают;
5. `Платежи клиентов` имеют authoritative source traceability;
6. source/destination payment amount совпадают;
7. Customers semantics доказана;
8. `423 vs 261` или актуальный аналогичный mismatch устранён семантически, а не косметически;
9. Partners semantics доказана;
10. `33 vs 28` или актуальный mismatch устранён семантически;
11. `Квалифицированный GMV` больше не падает;
12. Qualified GMV source/destination совпадают;
13. table metric cells реально кликабельны;
14. Financial Summary drill-down работает и reconciles;
15. Partner Performance drill-down работает и reconciles;
16. shared framework используется cards + tables;
17. canonical calendar period semantics реализована;
18. WEEK не является скрытым rolling last-7-days под label `Неделя`;
19. 6 months соответствует согласованной calendar semantics;
20. QUARTER реализован/проверен;
21. CUSTOM regression PASS;
22. global period consumer audit выполнен;
23. `[from,to)` regression PASS;
24. timezone semantics доказана;
25. backend errors не маскируются нулями;
26. user-facing errors локализованы;
27. security/scope tests PASS;
28. browser evidence содержит фактические числа;
29. network evidence приложен;
30. reconciliation matrices не содержат необъяснённых mismatches;
31. frontend/backend tests + TSC/build PASS;
32. report преимущественно на русском.

Иначе:

```text
VERDICT B — REMEDIATION REQUIRED
```

---

# 32. CANONICAL ROADMAP / NEXT

**Не переходить к FX только потому, что предыдущий отчёт указал его как NEXT.**

До фактического закрытия Round 5:

```text
MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT
= BLOCKED
```

После обоснованного `VERDICT A`:

1. сохранить report;
2. обновить canonical roadmap **additively**;
3. указать реальные commit SHA;
4. выполнить требуемую отдельную Strict Review согласно действующему implementation/review pairing contract;
5. остановиться.

Только после этого canonical NEXT может быть:

```text
MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT
```

**DO NOT AUTO-START FX.**

**DO NOT AUTO-START Step 3.12.**

---

# FINAL EXECUTION INSTRUCTION

Начать с:

```text
Starting SHA: 6bf44e3
```

Сначала воспроизвести все шесть runtime findings.

Не исправлять их вслепую.

Собрать network/backend evidence, установить root causes, затем выполнить remediation через shared contracts.

После реализации повторно пройти **весь Round 5**, а не только шесть найденных случаев.

Главный acceptance principle:

```text
Если пользователь нажимает на число X,
destination должен объяснить и воспроизвести X.

Если X является агрегатом:
source X = destination aggregate X.

Если X является derived metric:
destination/detail должен показать формулу и исходные компоненты.

Если backend не загрузился:
UI не имеет права выдавать ошибочные нули за реальные данные.
```
