# PHASE 3 — PRE-STEP 3.12 — ANALYTICS ROUND 5 — GLOBAL PERIOD CONTRACT + TABLE SOURCE TRACEABILITY + RUNTIME RECONCILIATION

## STATUS

**Starting SHA:** `0de71a6`

Предыдущий отчёт:

```text
PHASE 3 — PRE-STEP 3.12 — ANALYTICS ROUND 4 STRICT REMEDIATION — ЗАВЕРШЕНА
Final SHA: 0de71a6
VERDICT A — ANALYTICS ROUND 4 STRICT REMEDIATION APPROVED
```

**Этот VERDICT A не принимается как финальный PRE-STEP verdict.**

После runtime-проверки обнаружено, что shared drill-down реализован не полностью: KPI-карточки частично кликабельны, но агрегированные метрики/записи в ранее определённых аналитических таблицах не получили обязательную source traceability. Также не доказан единый календарный period contract во всех существующих consumers.

Текущая квалификация:

```text
VERDICT B — REMEDIATION REQUIRED
```

Цель Round 5 — не локально исправить несколько ссылок Analytics, а довести до рабочего состояния два **project-wide shared contracts**:

1. **Shared Calendar Period Contract**
2. **Shared Metric Drill-down / Source Traceability Framework**

После исправлений выполнить глобальную runtime-reconciliation проверку всех затронутых разделов.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые или обновляемые отчёты и текстовая документация должны быть преимущественно **на русском языке**:

- Implementation Report;
- Remediation Report;
- Strict Review Report;
- Evidence / Runtime Report;
- Gap Audit;
- описания findings;
- root cause analysis;
- архитектурные решения;
- security findings;
- runtime evidence;
- выводы и рекомендации;
- объяснение verdict.

Английский допускается только для технических идентификаторов:

- пути файлов;
- class/method/DTO/model/table names;
- API endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- commit messages;
- enum;
- permission identifiers;
- code snippets;
- стандартизированных строк `VERDICT`.

**Hard acceptance criterion:** если итоговый отчёт преимущественно написан на английском языке, задача считается незавершённой. До выставления финального verdict отчёт необходимо исправить.

---

# 1. ROUND 5 OBJECTIVES

Round 5 обязан закрыть следующие проблемы.

```text
R5-01  Shared Calendar Period Contract
R5-02  Global period-consumer inventory/audit
R5-03  Orders KPI → Orders Center exact reconciliation
R5-04  Bookings KPI → Booking Center exact reconciliation
R5-05  Customers/Partners stock-vs-period semantics
R5-06  Shared MetricTableCell / table drill-down integration
R5-07  Financial Summary source traceability
R5-08  Partner Performance source traceability
R5-09  Derived metric drill-down/formula traceability
R5-10  Security and scope preservation
R5-11  Global runtime reconciliation matrix
R5-12  Round 4 regression verification
```

Нельзя закрывать finding только наличием кода, ссылки или успешного redirect.

Для source traceability основной критерий:

```text
SOURCE METRIC
      ↓ click
AUTHORITATIVE DESTINATION / DETAIL
      ↓
same semantic population
      ↓
DESTINATION TOTAL / FORMULA
      =
SOURCE METRIC
```

---

# 2. R5-01 — SHARED CALENDAR PERIOD CONTRACT

## 2.1 Canonical semantics

Во всём TravelHub именованные period presets должны иметь **одну календарную семантику**.

Зафиксировать canonical contract:

| Preset | Canonical semantics |
|---|---|
| `TODAY` / Сегодня | начало текущего календарного дня → NOW |
| `WEEK` / Неделя | начало текущей календарной недели → NOW |
| `MONTH` / Месяц | начало текущего календарного месяца → NOW |
| `QUARTER` / Квартал | начало текущего календарного квартала → NOW |
| `SIX_MONTHS` / 6 месяцев | начало первого из шести календарных месяцев, включая текущий → NOW |
| `YEAR` / Год | 1 января текущего календарного года → NOW |
| `CUSTOM` / Период | explicit user-selected `from → to` |

Например для `2026-08-30` в canonical workspace timezone:

```text
Сегодня      2026-08-30 00:00 → NOW
Неделя       начало текущей календарной недели → NOW
Месяц        2026-08-01 00:00 → NOW
Квартал      2026-07-01 00:00 → NOW
6 месяцев    2026-03-01 00:00 → NOW
Год          2026-01-01 00:00 → NOW
Период       explicit from/to
```

### Запрещённая неоднозначность

Нельзя иметь:

```text
Неделя = rolling last 7 days
Месяц  = calendar month
Год    = calendar year
```

Если продукту когда-либо понадобятся rolling ranges, они должны называться явно:

```text
7 дней
30 дней
90 дней
12 месяцев
```

Но в текущем scope нестандартные диапазоны уже покрываются `Период`.

**Не добавлять rolling presets без отдельного product requirement.**

---

# 3. PERIOD END-BOUNDARY CONTRACT

Проверить существующую реализацию `from/to`.

Round 4 evidence показал:

```text
MONTH:
?from=2026-08-01&to=2026-09-01
```

Это может быть корректным только при явной half-open semantics:

```text
[from, to)
```

то есть:

```text
>= 2026-08-01T00:00
<  2026-09-01T00:00
```

Однако для **текущего** календарного периода contract должен исключать будущие события.

Необходимо определить и документировать canonical policy:

```text
resolvedStart = beginning of calendar period
resolvedEnd   = NOW
```

или, если API использует exclusive boundary:

```text
queryStart = resolvedStart
queryEnd   = NOW
```

Нельзя использовать начало следующего месяца как фактическую границу текущего month-to-date, если это позволяет будущим/ошибочно датированным данным попасть в агрегат.

Показать реальный resolver и реальные network parameters.

---

# 4. TIMEZONE CONTRACT

Period boundaries должны вычисляться централизованно в canonical workspace/reporting timezone.

Определить:

- откуда берётся timezone;
- какая timezone является authority;
- как она передаётся backend;
- как backend интерпретирует date-only `from/to`;
- как исключается browser-local timezone drift;
- DST policy, если применимо.

Нельзя допустить:

```text
Analytics → Asia/Baku
Orders    → browser local
Finance   → UTC
```

для одного и того же выбранного периода.

---

# 5. PERIOD ≠ BUSINESS TIMESTAMP

Shared Period Contract задаёт диапазон, но не означает, что каждая метрика должна фильтроваться по `createdAt`.

Для каждой метрики определить canonical business timestamp.

Обязательная матрица:

| Metric | Period policy | Business timestamp | Population/status semantics |
|---|---|---|---|
| Orders | ? | ? | ? |
| Bookings | ? | ? | ? |
| GMV | ? | ? | ? |
| Customer Payments | ? | ? | ? |
| Commission | ? | ? | ? |
| Refunds | ? | ? | ? |
| AOV | derived | inherited from canonical base | ? |
| Sessions | PERIOD_BOUND | event timestamp | ? |
| Customers | ALL_TIME или PERIOD_BOUND | ? | ? |
| Partners | ALL_TIME или PERIOD_BOUND | ? | ? |

**Не угадывать значения.** Определить их по существующему domain/data contract и фактическим backend queries.

Если source и destination используют разные timestamps/populations, это finding.

---

# 6. R5-02 — GLOBAL PERIOD-CONSUMER INVENTORY

Провести repository-wide audit всех consumers периода.

Минимально проверить:

```text
Analytics
Command Center / Рабочий стол
Orders Center
Booking Center
CRM
Sales Center
Finance / Financial Summary
Partner Performance
domain-specific dashboards/widgets
shared charts
KPI cards
registry filters
export/report endpoints, если используют те же periods
```

Искать:

- собственные period resolver;
- hardcoded date arithmetic;
- `subDays(7/30/365)`;
- `startOfMonth`;
- `startOfYear`;
- локальные preset mappings;
- query parsing `from/to`;
- date-only timezone conversion;
- frontend-only date filters;
- backend period DTO;
- duplicate period utilities.

Создать inventory:

| Consumer | Shared resolver? | WEEK | MONTH | QUARTER | 6M | YEAR | CUSTOM | Timezone | Finding |
|---|---|---|---|---|---|---|---|---|---|

Цель — **один canonical resolver/contract**, а не несколько совпадающих на данный момент реализаций.

---

# 7. R5-03 — ORDERS EXACT RECONCILIATION

Ранее runtime обнаружил:

```text
Analytics / Месяц:
Orders = 214

первоначальный drill-down:
Orders Center = 1516

после remediation:
Orders Center = 217
```

`214 → 217` остаётся **FAIL**.

## Обязательный root-cause audit

Для source Analytics и destination Orders Center показать:

```text
preset
resolved from
resolved to
timezone
business timestamp
included statuses
excluded statuses
workspace
tenant/partner scope
other filters
backend endpoint
backend query/filter
total
```

Нельзя исправлять дефект простым изменением displayed total.

После remediation:

```text
Analytics Orders = X
        ↓ click
Orders Center filtered total = X
```

Проверить не только `MONTH`, а все canonical presets:

```text
TODAY
WEEK
MONTH
QUARTER
SIX_MONTHS
YEAR
CUSTOM
```

---

# 8. R5-04 — BOOKINGS EXACT RECONCILIATION

Повторить тот же strict contract для Bookings.

```text
Analytics Bookings = X
        ↓
Booking Center
        ↓
same period + same business semantics
        ↓
filtered total = X
```

Проверить все canonical presets.

Показать реальные network requests и UI totals.

---

# 9. R5-05 — CUSTOMERS / PARTNERS SEMANTICS

Round 4 объявил:

```text
Customers = all-time stock metric
Partners  = stock metric
```

Это должно быть доказано и отражено в UI.

## Если Customers — ALL_TIME

Тогда:

```text
Всего клиентов
```

- значение не меняется при переключении периода;
- PeriodSelector не влияет на metric;
- click → CRM Customers;
- destination total = KPI total.

Если текущая карточка называется просто `Клиенты`, проверить, не создаёт ли это ложное впечатление period-bound метрики.

## Если Partners — ALL_TIME

Тогда:

```text
Всего партнёров
```

- значение не меняется от TODAY/WEEK/MONTH/YEAR;
- click → `CRM → Партнёры`;
- destination total = KPI total.

Если бизнесу нужна period-bound метрика, это должна быть отдельная метрика:

```text
Активные партнёры
```

с отдельно определённым activity contract.

**Не смешивать entity stock и period performance.**

---

# 10. R5-06 — SHARED TABLE METRIC DRILL-DOWN

## Runtime finding

После SHA `0de71a6` пользователь проверил интерфейс:

> записи/метрики в таблицах не кликабельны.

Поэтому:

```text
R4-02E Shared Framework = PARTIAL
R5-06 Table integration = FAIL
```

Наличие `metric-drilldown.ts` само по себе не закрывает project-wide requirement.

## Требуемая архитектура

Должно быть общее ядро:

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
                           OR Detail View
```

Не создавать независимые `onClick`/`href` implementations в каждой таблице.

Допустима адаптация существующих shared table/cell components, но destination resolution и metric semantics должны оставаться централизованными.

---

# 11. WHAT MUST BE CLICKABLE

Требование **не означает**, что любая текстовая ячейка любой таблицы должна быть ссылкой.

Глобальное правило:

### Entity identifier

```text
Partner name
Customer name
Order ID
Booking ID
Payment ID
```

→ authoritative entity/detail/profile.

### Aggregated metric

```text
Orders = 6
Bookings = 5
GMV = 439.93
Commission = 65.16
Payment Count = 30
```

→ filtered authoritative records или dedicated metric detail.

### Derived metric

```text
AOV
Completion
Effective Commission Rate
Net
```

→ detail view, который показывает:

- formula;
- numerator;
- denominator;
- contributing records;
- same period/scope.

### Ordinary descriptive fields

Могут оставаться static.

---

# 12. R5-07 — FINANCIAL SUMMARY TRACEABILITY

Текущая/ожидаемая структура:

```text
Валюта | Кол-во платежей | Платежи | Возвраты | Net | Комиссия
```

Round 4 report:

```text
AZN Payment Count = 327
EUR Payment Count = 3
USD Payment Count = 30
```

Эти агрегаты должны быть source-traceable.

## Payment Count

Пример:

```text
USD | Кол-во платежей = 30
               ↓ click
Finance / Payments
currency=USD
same period
same workspace/scope
               ↓
total = 30
```

## Payments amount

```text
USD | Платежи = X
       ↓
filtered Payment records
       ↓
SUM(amount) = X
```

## Refunds

→ authoritative Refund source/detail с reconciliation.

## Commission

→ authoritative commission facts/accruals/detail.

## Net

Если это derived metric:

```text
Net = canonical formula
```

detail должен показать формулу и исходные компоненты.

### Mandatory reconciliation matrix

| Currency | Payment Count summary | Drill-down count | Payment amount summary | Drill-down SUM | Refund summary | Refund SUM | Commission summary | Commission SUM | PASS |
|---|---:|---:|---:|---:|---:|---:|---:|---|

Минимально:

```text
AZN
EUR
USD
```

---

# 13. R5-08 — PARTNER PERFORMANCE TRACEABILITY

Для таблицы Partner Performance применить тот же shared framework.

Минимально:

| Column | Expected drill-down |
|---|---|
| Partner | CRM Partner/Profile/360 |
| GMV | contributing canonical records |
| Customer Payments | Payments filtered by partner + period |
| Commission | commission facts filtered by partner + period |
| Orders | Orders filtered by partner + period |
| Bookings | Bookings filtered by partner + period |
| Completion | formula + underlying bookings |
| Effective Rate | formula + commission base + contributing facts |
| Configured Commission Rate, если показывается | commission policy |

Пример acceptance:

```text
Flame Towers Residence
Orders = 6
    ↓ click
Orders Center
partner=<id>
same period
    ↓
total = 6
```

Нельзя считать PASS, если redirect работает, но destination показывает другое число.

---

# 14. CASPIAN WEDDINGS SOURCE RECONCILIATION

Сохранить ранее найденный anomalous case как обязательный evidence case:

```text
Caspian Weddings

GMV        = 0
Payments   = 0
Commission = 155.50
Orders     = 0
Bookings   = 2
Eff. Rate  = —
```

Клик по `Commission = 155.50` должен позволить определить **точный источник** суммы.

Показать:

- contributing commission records;
- amount;
- currency;
- business timestamp;
- related transaction/order/booking;
- status;
- partner;
- period;
- почему GMV/Payments могут быть 0 при Commission=155.50.

Если это корректная domain semantics — документировать.

Если aggregation defect — исправить root cause.

Не изменять данные только для того, чтобы строка выглядела логично.

---

# 15. R5-09 — DERIVED METRIC TRACEABILITY

Derived metrics не должны вести на случайную registry page.

Примеры:

```text
AOV
Completion
Effective Rate
Net
```

Для них должен существовать reusable detail/drill-down presentation:

```text
Metric
Period
Scope

Formula
Numerator
Denominator / components

Contributing population
Source records / link to records
```

Пример:

```text
AOV = GMV / canonical order population
```

Должно быть видно, почему headline имеет именно это значение.

---

# 16. CONFIGURED RATE VS EFFECTIVE RATE

Round 4 исправил misleading label:

```text
Ставка
→ Эфф. ставка
```

Это улучшение сохранить.

Но не смешивать:

```text
Configured Commission Rate
```

и:

```text
Effective Rate = actual commission / canonical commission base
```

Если configured rate пока не выводится в Partner Performance — не синтезировать его.

Если существует authoritative partner commission policy, drill-down/configured-rate view должен читать именно её.

Historical commission facts нельзя пересчитывать текущей configured rate.

---

# 17. R5-10 — CONTEXT TRANSFER CONTRACT

Shared drill-down должен передавать только canonical context:

```text
metricId
period policy
from
to
preset
workspace
tenant/partner scope
currency
status scope
partnerId
customerId
service/capability filters
other metric-specific canonical filters
```

Не использовать `fromAnalytics=true` как источник безопасности или бизнес-семантики.

Этот параметр может быть UX/navigation hint, но не authority.

Destination обязан самостоятельно валидировать filters.

---

# 18. SECURITY CONTRACT

Query parameters не должны позволять:

- выйти за tenant scope;
- получить другого partner;
- обойти RBAC;
- обойти entitlement;
- получить запрещённую currency/scope population;
- открыть source records без требуемой permission.

Проверить server-side authority.

Минимальные negative tests:

```text
tampered partnerId
tampered workspace
unauthorized destination
invalid date range
invalid preset
period outside allowed policy, если ограничения существуют
```

---

# 19. R5-11 — GLOBAL RECONCILIATION MATRIX

Создать итоговую evidence matrix.

Минимальная форма:

| Screen | Metric | Preset | Resolved from/to | TZ | Business timestamp | Source total | Destination | Destination total | PASS |
|---|---|---|---|---|---|---:|---|---:|---|

Проверить минимум:

```text
Analytics → Orders
Analytics → Bookings
Analytics → Customers
Analytics → Partners
Financial Summary → Payment Count
Financial Summary → Payments
Financial Summary → Refunds
Financial Summary → Commission
Partner Performance → Orders
Partner Performance → Bookings
Partner Performance → Payments
Partner Performance → Commission
Partner Performance → GMV
```

Для period-bound metrics использовать несколько presets, включая минимум:

```text
WEEK
MONTH
SIX_MONTHS
YEAR
CUSTOM
```

`TODAY` и `QUARTER` также должны иметь automated contract coverage.

---

# 20. PRESET CONTRACT TEST MATRIX

Добавить automated tests для resolver.

Использовать fixed clock.

Пример fixed date:

```text
NOW = 2026-08-30T...
```

Проверить:

```text
TODAY
WEEK
MONTH
QUARTER
SIX_MONTHS
YEAR
CUSTOM
```

Проверить timezone boundary.

Для WEEK явно зафиксировать начало недели, соответствующее product locale/canonical contract.

Не оставлять `startOfWeek` с library default без явной настройки.

---

# 21. CUSTOM PERIOD REGRESSION

Round 4 R4-01 должен остаться PASS.

Contract:

```text
CUSTOM selected
→ inputs visible
→ incomplete range
→ NO API request
→ NO loading error
→ current/neutral state preserved

both dates valid
→ request

start > end
→ validation
→ no invalid request
```

Проверить:

- start only;
- end only;
- same date;
- start > end;
- clear one date;
- switch CUSTOM → preset;
- preset → CUSTOM;
- refresh/hydration, если state сохраняется в URL.

---

# 22. COMMAND CENTER / OTHER CONSUMERS REGRESSION

Round 5 нельзя закрыть, проверив только `/app/analytics`.

Browser/runtime audit должен доказать, что canonical period semantics применяются во всех обнаруженных consumers.

Особенно проверить Command Center, поскольку ранее использовался общий PeriodSelector.

Если UI shared, но backend endpoints интерпретируют period по-разному — это FAIL.

---

# 23. UI/UX REQUIREMENTS FOR CLICKABLE METRICS

Clickable metric должен визуально быть распознаваемым как interactive, но не превращать таблицу в набор агрессивных ссылок.

Проверить:

- pointer/focus state;
- keyboard accessibility;
- Enter/Space где применимо;
- visible focus;
- no nested interactive conflict;
- table sorting не ломает metric click;
- row click и cell click не конфликтуют;
- responsive behavior.

Не менять общий дизайн без необходимости.

---

# 24. NO FAKE DESTINATIONS

Если authoritative registry/page отсутствует:

**запрещено** отправлять пользователя на приблизительно подходящий экран только ради clickability.

Использовать:

```text
dedicated metric detail
drawer
modal
detail route
```

с source records/formula.

Это особенно относится к:

```text
Commission
AOV
Refunds
Sessions
derived ratios
```

если полноценного domain center ещё нет.

---

# 25. NO DUPLICATE DOMAIN REGISTRIES

Не создавать:

```text
new Partner registry
new Customer registry
new Orders registry
new Bookings registry
```

если authoritative registry уже существует.

Использовать существующие:

```text
CRM → Партнёры
CRM → Клиенты
Orders Center
Booking Center
Finance/Payments
```

и расширять их canonical filters при необходимости.

---

# 26. REQUIRED BROWSER EVIDENCE

После реализации выполнить реальную browser/runtime проверку.

Отчёт должен содержать фактические значения, а не только `PASS`.

Пример:

```text
Preset: MONTH
Resolved range: ...
Timezone: ...

Analytics Orders: 214
Orders Center after click: 214
PASS
```

Для таблицы:

```text
Partner: Flame Towers Residence
Partner Performance Orders: 6
Destination filtered Orders: 6
PASS
```

Для Financial Summary:

```text
Currency: USD
Payment Count: 30
Destination Payments total: 30
PASS
```

Если значения не совпадают — finding остаётся OPEN.

---

# 27. NETWORK EVIDENCE

Для representative cases показать реальные requests:

```text
source endpoint
destination endpoint
query params
HTTP status
returned total
```

Особенно:

```text
Orders
Bookings
USD Payments
Partner-specific Orders
Partner-specific Commission
CUSTOM period
```

---

# 28. TEST REQUIREMENTS

Минимально:

### Frontend

- shared period resolver tests;
- preset mapping;
- custom validation;
- drill-down resolver;
- MetricCard integration;
- MetricTableCell integration;
- context serialization;
- stock metric no-period behavior;
- accessibility where applicable.

### Backend

- canonical period parsing;
- timezone boundaries;
- Orders filters;
- Bookings filters;
- Payments currency+period filters;
- partner scope filters;
- invalid/tampered scope;
- reconciliation-focused integration tests.

### Regression

Запустить существующие:

```text
frontend tests
backend tests
TSC
build
relevant E2E
```

Не ослаблять тесты для получения PASS.

---

# 29. REQUIRED IMPLEMENTATION REPORT

Создать отдельный Round 5 report.

Он должен содержать:

## A. Git evidence

```text
Starting SHA
Implementation SHA(s)
Final SHA
origin/master SHA
git status
```

## B. Root cause

Для каждого finding.

## C. Architecture

Показать:

```text
Shared Calendar Period Contract
Shared Metric Drill-down Contract
MetricCard integration
MetricTableCell integration
Destination Resolver
```

## D. Period inventory

Все найденные consumers и remediation status.

## E. Metric semantics matrix

Period policy + business timestamp + population.

## F. Reconciliation evidence

Конкретные source/destination numbers.

## G. Browser evidence

Фактические runtime values.

## H. Network evidence

Endpoint/query/total.

## I. Security evidence

Positive + negative.

## J. Tests

Фактические команды и результаты.

## K. Residual gaps

Не скрывать незакрытые проблемы.

---

# 30. VERDICT RULES

## `VERDICT A` разрешён только если

Все условия одновременно выполнены:

1. существует один canonical Shared Calendar Period Contract;
2. WEEK/MONTH/QUARTER/6M/YEAR имеют календарную semantics;
3. CUSTOM lifecycle корректен;
4. global period consumer audit выполнен;
5. Orders source/destination totals совпадают;
6. Bookings source/destination totals совпадают;
7. Customers/Partners stock semantics доказаны;
8. shared drill-down работает не только для cards, но и для required table metric cells;
9. Financial Summary metrics source-traceable;
10. Partner Performance metrics source-traceable;
11. derived metrics имеют formula/source traceability;
12. security/scope preserved;
13. browser evidence содержит реальные числа;
14. reconciliation matrix не содержит unexplained mismatches;
15. tests/build/typecheck PASS;
16. отчёт написан преимущественно на русском языке.

Если хотя бы один hard criterion не выполнен:

```text
VERDICT B — REMEDIATION REQUIRED
```

---

# 31. IMPORTANT — DO NOT MASK FAILURES

Запрещено:

```text
- подгонять displayed total;
- менять seed/data только для совпадения;
- скрывать discrepant records;
- считать redirect доказательством reconciliation;
- считать наличие href доказательством source traceability;
- считать unit tests заменой browser/runtime evidence;
- объявлять table framework project-wide, если он подключён только к KPI cards;
- маркировать unexplained mismatch как accepted;
```

Runtime evidence имеет приоритет над self-reported implementation claims.

---

# 32. OUT OF SCOPE

В Round 5 **не начинать**:

```text
MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT
Behavioral Telemetry Amendment
Step 3.12
```

Можно фиксировать связанные observations, но не расширять scope без необходимости для Round 5 reconciliation.

---

# 33. CANONICAL NEXT

Только если Round 5 получает обоснованный `VERDICT A`, canonical NEXT остаётся:

```text
MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT
```

**DO NOT AUTO-START NEXT STAGE.**

Перед переходом необходимо:

1. сохранить Round 5 report;
2. обновить canonical roadmap additively;
3. зафиксировать реальные commit SHA;
4. выполнить отдельную Strict Review, если этого требует действующий implementation/review pairing contract;
5. остановиться и ждать следующего задания.

---

# FINAL EXECUTION INSTRUCTION

Начать с:

```text
Starting SHA: 0de71a6
```

Сначала выполнить audit/inventory и доказать root causes существующих mismatches.

Затем реализовать shared remediation.

После реализации выполнить tests + browser + network + reconciliation evidence.

Не объявлять `VERDICT A` на основании только source code/tests.

**Главный критерий Round 5: пользователь должен иметь возможность пройти от любой требующей traceability KPI/aggregate metric — в карточке или таблице — к её авторитетным исходным данным с сохранением canonical периода и scope, а итоговые значения должны математически и семантически согласовываться.**
