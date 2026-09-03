# PHASE 3 — PRE-STEP 3.12 — PARTNER 360 STRICT REVIEW + FULFILLED / CALENDAR SEMANTICS RE-QUALIFICATION

## STATUS
**TYPE:** Strict Review / evidence-first re-qualification  
**Starting SHA:** `63a61e5`  
**Production changes:** FORBIDDEN.  
**Canonical NEXT:** `MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT` — DO NOT START до verdict.

## LANGUAGE REQUIREMENT — MANDATORY
Все отчёты, findings, root cause, architecture/security decisions, runtime evidence, conclusions и verdict explanations — преимущественно **на русском языке**. English допустим только для technical identifiers, paths, API, commands, SHA, enums, code и standardized VERDICT strings. Преимущественно английский report = task incomplete.

## 1. ЦЕЛЬ
Независимо re-qualify SHA `63a61e5` и доказать:
1. Partner 360 действительно использует authoritative shared Orders/Bookings queries;
2. Baku Tours Pro source/destination reconciliation реально сохраняется;
3. named periods соответствуют calendar semantics, а не rolling semantics;
4. canonical lifecycle `Order.status=FULFILLED` доказан;
5. `FULFILLED`, `CLOSED` и `GMV (выполненные)` семантически согласованы.

## 2. BASELINE
Заявлено:
```text
LAST_3_DAYS:    Orders 8=8       Bookings 1=1
LAST_7_DAYS:    Orders 28=28     Bookings 2=2
MONTH:          Orders 129=129   Bookings 17=17
LAST_6_MONTHS:  Orders 534=534   Bookings 55=55
YEAR:           Orders 1073=1073 Bookings 112=112
Browser 18/18 PASS
Tests 248 + 171 PASS
```
Не принимать эти числа без independent runtime/API evidence.

## 3. SR-P360-01 — IDENTITY / ROUTING
Проверить Partner Performance → `Baku Tours Pro` → Partner 360:
- canonical `partnerId`, не company name как identity;
- refresh сохраняет route/context;
- tabs не теряют partner;
- invalid/inaccessible partnerId корректно обрабатывается;
- breadcrumbs/header показывают правильного партнёра.

## 4. SR-P360-02 — ORDERS 129→129
Для MONTH доказать:
```text
Partner Performance: Baku Tours Pro / Orders=129
→ Partner 360 / Заказы
→ same partnerId + same from/to
→ API total=129
→ UI total=129
→ pagination total=129
```
Зафиксировать source value, exact from/to, partnerId, destination URL и totals.

## 5. SR-P360-03 — BOOKINGS 17→17
Аналогично:
```text
Baku Tours Pro / Bookings=17
→ Partner 360 / Бронирования
→ API/UI/pagination =17
```
Проверить исправленный relation `product.partnerId` и доказать, что он canonical и не теряет legitimate records.

## 6. SR-P360-04 — SHARED AUTHORITATIVE QUERIES
Hard gate. Partner 360 не должен содержать копию business queries:
```text
Orders canonical query/service
 ├ Orders Center
 └ Partner 360/Orders + partnerId

Bookings canonical query/service
 ├ Booking Center
 └ Partner 360/Bookings + partnerId
```
Проверить filters/search/sort/status/date/pagination/summary. Divergent duplicated query = минимум P1.


## 6A. SR-P360-05 — FIRST NAVIGATION PERIOD HYDRATION / REFRESH-DEPENDENT RECONCILIATION

**Priority candidate:** P1  
**Status:** подтверждённый runtime symptom до запуска Strict Review.

Наблюдаемое поведение:

```text
Partner Performance
Partner = Baku Tours Pro
Period = X
Orders = N / Bookings = M
        ↓ click
Partner 360
        ↓
FIRST CLIENT-SIDE NAVIGATION
period иногда НЕ применяется
destination total ≠ source metric
        ↓ F5 / browser refresh
тот же URL
        ↓
period применяется
destination total = source metric
```

Это недопустимо. Refresh не должен быть частью корректного drill-down flow.

### Required root-cause audit

Проверить полный lifecycle:

```text
Partner Performance click
→ router navigation
→ destination route/query params
→ Partner 360 initial state
→ PeriodSelector hydration
→ canonical from/to resolver
→ query/cache key
→ first API request
→ first rendered total/table
```

Проверить минимум следующие классы причин:

- первый fetch запускается до hydration period state из URL;
- initial state использует default/previous period;
- `useEffect` / query dependencies не включают `from/to/preset`;
- URL меняется, но query не refetch;
- router state и shared period store синхронизируются в неправильном порядке;
- cache/query key не включает period boundaries;
- cached response от предыдущего partner/period показывается как current;
- summary и table используют разные hydration/query paths;
- `partnerId` и period применяются на разных render cycles;
- client navigation и hard refresh используют разные initialization paths.

Не предполагать root cause — доказать network/state evidence.

### Mandatory reproduction matrix

Повторить **без F5** минимум 10 последовательных переходов для Orders и 10 для Bookings.

Проверить минимум:

```text
TODAY
WEEK
MONTH
6 MONTHS
YEAR
```

и минимум два партнёра, если dataset позволяет.

Для каждого перехода фиксировать:

| Run | Partner | Source period | Source metric | First-render period | First total | After F5 total | Result |
|---|---|---|---:|---|---:|---:|---|

### Mandatory network comparison

Для случая, где first navigation раньше давал mismatch, снять:

```text
A. request immediately after click
B. request after F5
```

Сравнить:

```text
partnerId
from
to
preset
timezone
page/pageSize
status
paymentStatus
other inherited filters
request/cache key
response total
```

Обязательная таблица:

| Parameter | Source | First navigation | After F5 | Match? |
|---|---|---|---|---|

Если first navigation не отправляет period или отправляет другой `from/to`, finding считается подтверждённым.

### UI hydration evidence

Сразу после click, **до refresh**, проверить:

```text
PeriodSelector visible value
URL preset
URL from
URL to
internal resolved from/to
API request from/to
```

Все должны представлять один и тот же period.

Недопустимо:

```text
URL = MONTH
UI = MONTH
API = default/all-time
```

или:

```text
URL = MONTH
UI = previous period
```

или:

```text
first request = no date filter
second request after F5 = correct date filter
```

### Hard reconciliation contract

Для каждого metric drill-down:

```text
SOURCE
partnerId = P
period = X
metric = N
       ↓ CLICK
FIRST REQUEST
partnerId = P
from/to = canonical boundaries of X
       ↓
FIRST RENDER
PeriodSelector = X
Aggregate Summary = N
Table population total = N
       ↓ F5
same period
same total N
same population
```

То есть:

```text
FIRST NAVIGATION TOTAL
=
REFRESH TOTAL
=
SOURCE METRIC
```

### Orders and Bookings are separate gates

Не принимать PASS по Orders как доказательство Bookings.

Обязательно:

```text
Partner Performance Orders X
→ Partner 360 Orders
→ first render X
→ F5 X

Partner Performance Bookings Y
→ Partner 360 Bookings
→ first render Y
→ F5 Y
```

### Interaction regression

Проверить также:

1. Partner A / MONTH → Orders;
2. back → Partner Performance;
3. Partner B / MONTH → Orders;
4. back;
5. Partner A / YEAR → Orders;
6. back;
7. Partner A / MONTH → Bookings;
8. изменить period внутри Partner Performance;
9. снова click;
10. browser back/forward.

На каждом шаге previous period/partner cache не должен загрязнять новый context.

### Acceptance

PASS только если все tested transitions корректны **на первом client-side navigation без refresh**.

Если F5 хотя бы в одном воспроизводимом случае меняет period, request population или total:

```text
SR-P360-05
Priority: P1
First-navigation period hydration is inconsistent;
refresh is required to apply source period correctly.
```

Это блокирует `VERDICT A`.


## 7. SR-CAL-01 — CALENDAR PERIOD CONTRACT
Canonical product semantics:
```text
Сегодня   = start current calendar day → NOW
Неделя    = start current calendar week → NOW
Месяц     = start current calendar month → NOW
Квартал   = start current calendar quarter → NOW
6 месяцев = start first of six calendar months including current → NOW
Год       = Jan 1 current year → NOW
Период    = explicit custom from/to
```
Установить реальный смысл `LAST_7_DAYS`, `LAST_6_MONTHS` и других legacy identifiers.

PASS: legacy enum name, но resolver даёт calendar boundaries.  
FAIL: `Неделя = NOW-7d` или `6 месяцев = rolling NOW-6 months`.

Обязательная таблица:
| UI label | Internal value | Actual from | Actual to | Expected calendar boundary | Result |
|---|---|---|---|---|---|

Проверить TODAY/WEEK/MONTH/QUARTER/6 MONTHS/YEAR и half-open `[from,to)` contract. Current period не должен включать future records.

## 8. SR-CAL-02 — CROSS-CONSUMER PERIOD CHECK
Spot-check одинаковые boundaries в:
- Analytics;
- Command Center;
- Partner 360;
- Orders Center;
- Booking Center.
Одинаковый named period обязан означать одинаковый диапазон.

## 9. SR-FUL-01 — CANONICAL INVENTORY
Найти `FULFILLED` на слоях DB/schema, backend enum, DTO, API, frontend types, badge/i18n, Orders filter, tests.
Ответить:
```text
Canonical Order.status? YES/NO
UI label = Выполнен? YES/NO
Real DB records? count
Ordinary Orders filter option? YES/NO
```

## 10. SR-FUL-02 — WRITE PATH
Найти все production-reachable пути `Order.status=FULFILLED`: state machine/transition service, Booking/Payment/fulfillment events, operator action, job, direct update, seed/backfill.
| Path | Trigger | Guard | Auto/manual | Production reachable |
|---|---|---|---|---|

## 11. SR-FUL-03 — EXACT TRANSITION GUARD
Дать фактическую формулу:
```text
Order → FULFILLED IFF <exact current-code conditions>
```
Проверить Booking statuses, Payment status, all/some bookings, refunds, items/services, manual action, timestamps. Не выводить смысл из названия enum.

## 12. SR-FUL-04 — FULFILLED VS CLOSED
Доказать:
- semantic meaning каждого;
- может ли CLOSED возникнуть без FULFILLED;
- может ли refunded order быть CLOSED;
- кто переводит FULFILLED→CLOSED;
- automatic/manual;
- intermediate states/history.
Построить factual current lifecycle graph.

## 13. SR-FUL-05 — REAL RECORD FORENSICS
Взять минимум 5 реальных FULFILLED Orders:
| Order | Payment | Bookings | Amount/currency | timestamps | Why FULFILLED |
|---|---|---|---|---|---|
Каждый должен соответствовать найденному guard. Отдельно отметить seed/backfill-only records.

## 14. SR-FUL-06 — DEFAULT ORDERS POPULATION
На одном scope:
```text
A no explicit status
B status=FULFILLED
C status=CLOSED
D status=FULFILLED,CLOSED
```
| Query | Total | FULFILLED | CLOSED | Other |
|---|---:|---:|---:|---:|
Не делать вывод по первой странице. Если explicit FULFILLED существует, но `Все статусы` его исключает — P1.

## 15. SR-FUL-07 — ORDERS FILTER
Если FULFILLED — user-relevant canonical status, ordinary Orders dropdown должен позволять выбрать `Выполнен`. Multi-status `FULFILLED,CLOSED` должен явно отображать оба значения и не терять FULFILLED при refresh/change/reset. Если отсутствие intentional — доказать product/domain reason.

## 16. SR-GMV-01 — EXACT `GMV (ВЫПОЛНЕННЫЕ)` FORMULA
Документировать:
```text
source entity
amount field
business timestamp
Order status predicate
Payment predicate
Booking predicate
refund predicate
currency scope
workspace scope
```
Доказать роль FULFILLED/CLOSED/PAID/REFUNDED без предположений.

## 17. SR-GMV-02 — CLOSED + REFUND
Проверить реальные CLOSED + refund-related records. Входят ли в completed GMV? Доказать predicate и concrete record evidence.

## 18. SR-GMV-03 — DRILL-DOWN RECONCILIATION
Для MONTH:
```text
Analytics GMV (выполненные)=X
→ click
→ same period + all qualifying conditions
→ contributing records=N
→ destination same-unit GMV=X
→ SUM(canonical contribution)=X
```
Если мешает существующий FX gap — явно отделить limitation. FX здесь не исправлять.

## 19. SR-SEC-01 — SECURITY
Проверить server-authoritative `partnerId + workspace + tenant + RBAC + entitlement`. Negative cases: invalid/inaccessible partnerId и URL substitution.

## 20. TESTS
Независимо запустить релевантные suites и targeted evidence для:
```text
Partner 360 Orders/Bookings
partnerId persistence
period persistence
pagination reconciliation
calendar boundaries
FULFILLED explicit filter
FULFILLED,CLOSED multi-status
GMV completed predicates
```
Общий green suite не заменяет semantic evidence.


## 20A. SR-TABLE-01 — SHARED TABLE AGGREGATION / TOTALS CONTRACT

В рамках Strict Review дополнительно провести repository-wide gap audit таблиц и зафиксировать единый **Shared Table Aggregation / Totals Contract**.

Цель: для всех полноценных data/registry tables, где существуют аддитивные или корректно агрегируемые показатели, пользователь должен видеть **итоги над таблицей**, после Filter Bar и до table header.

Canonical layout:

```text
PAGE / SECTION TITLE
        ↓
FILTER BAR
Период | Поиск | Статус | Партнёр | ... | Сбросить
        ↓
AGGREGATE SUMMARY — ИТОГО ПО ТЕКУЩЕЙ ВЫБОРКЕ
        ↓
TABLE
        ↓
PAGINATION
```

Пример:

```text
[Период] [Поиск] [Фильтры]

ИТОГО ПО ТЕКУЩЕЙ ВЫБОРКЕ
Партнёры: 33 | Заказы: 214 | Бронирования: 122
GMV: ... | Платежи: ... | Возвраты: ... | Комиссия: ...

<table>

Показано 1–20 из 33
<pagination>
```

### Hard semantic rule

`Aggregate Summary` считается **по всей текущей filtered population**, а НЕ по строкам текущей страницы.

```text
filters/search/period/workspace/security scope
                ↓
authoritative query
                ↓
totalCount
aggregateTotals
paginatedRows
```

Если:

```text
filtered records = 129
pageSize = 20
```

то monetary/count totals должны относиться ко всем 129 qualifying records, а не к 20 видимым строкам.

### Что агрегировать

Провести inventory колонок/метрик и включать всё, что имеет корректную business aggregation semantics, включая где применимо:

- количество записей;
- Orders count;
- Bookings count;
- Customers count;
- Partners count;
- Services/items count;
- Payments count;
- Refund count;
- transaction count;
- GMV;
- order amount;
- booking amount;
- customer payments;
- paid amount;
- outstanding/open amount;
- refunds;
- net amount;
- commission;
- payout;
- taxes/fees/discounts, если существуют и семантически применимы;
- иные денежные или количественные additive metrics.

Не ограничиваться этим списком: для каждой таблицы определить все корректно агрегируемые поля.

### Derived metrics

Проценты, rates, averages и ratios **НЕ складывать и НЕ вычислять как простое среднее строк**, если это математически неверно.

Примеры:

```text
AOV
= total canonical GMV / total qualifying Orders

Completion Rate
= total completed / total eligible population × 100

Effective Commission Rate
= total Commission / total canonical commission base × 100
```

Использовать canonical numerator/denominator по полной filtered population.

### Non-additive fields

Не создавать бессмысленные totals для:

```text
name
ID
status label
date
free text
ordinary categorical fields
```

### Multi-currency hard rule

До завершения Multi-Currency / FX Architecture Amendment запрещено суммировать разные native currencies:

```text
AZN + USD + EUR ≠ single native total
```

До FX показывать totals раздельно:

```text
AZN: ...
USD: ...
EUR: ...
```

Если уже существует доказанный reporting-currency aggregate — документировать его источник отдельно. Не вводить новый FX conversion в рамках этого Strict Review.

### Shared architecture requirement

Не реализовывать отдельный totals widget вручную на каждой странице.

Проверить возможность/наличие общей архитектуры:

```text
Shared Data Table
      +
Shared Aggregate Summary
      +
Authoritative Query Aggregate Contract
```

Концептуально:

```text
query result
{
  rows,
  totalCount,
  aggregates
}
```

или эквивалентный shared contract.

Strict Review не должен внедрять эту архитектуру, если её ещё нет. Он должен провести gap audit и сформировать exact remediation scope.

### Minimum table inventory

Проверить минимум:

```text
Orders Center
Booking Center
CRM → Customers
CRM → Partners
Partner 360 → Orders
Partner 360 → Bookings
Partner Performance
Financial Summary / financial registries
```

Также найти другие full data tables, где totals business-useful.

Обязательная матрица:

| Table | Total count | Money totals | Other additive totals | Derived totals | Above table now? | Gap |
|---|---|---|---|---|---|---|

---

## 20B. SR-TABLE-02 — DRILL-DOWN + TOTAL RECONCILIATION

Aggregate Summary должен стать частью source-traceability contract.

Если пользователь переходит из Analytics:

```text
Активные клиенты = X
→ CRM Customers
```

destination должен уметь показать над таблицей соответствующий contextual total:

```text
Активные клиенты: X
```

и таблица должна содержать именно qualifying population X.

Аналогично:

```text
Partner Performance Orders = X
→ Partner 360 / Orders
→ Итого заказов = X

Partner Performance Bookings = Y
→ Partner 360 / Bookings
→ Итого бронирований = Y
```

Для monetary drill-down:

```text
Analytics metric = M
→ destination
→ aggregate summary same metric = M
→ SUM(canonical source population) = M
```

с учётом native-currency limitation до FX.

---

## 20C. SR-CRM-01 — ACTIVE CUSTOMERS 129 → CRM 261

Новый обязательный P1 candidate.

Runtime observation:

```text
Analytics
Активные клиенты = 129
        ↓ click
CRM → Клиенты
Всего клиентов = 261
```

Не считать `129 ≠ 261` автоматически ошибкой формулы: сначала доказать semantic definitions.

Обязательно определить exact canonical formula:

```text
Активный клиент
= DISTINCT <canonical customer identity>
WHERE <canonical qualifying activity>
AND <business timestamp> ∈ selected period
AND workspace/tenant/security scope
```

Установить:

- какая activity делает клиента active;
- DISTINCT key;
- business timestamp;
- period semantics;
- guest/registered handling;
- cancelled/refunded orders influence;
- partner/workspace scope;
- soft-delete/archive behavior.

Затем выполнить set-level reconciliation.

Destination CRM Customers должен воспроизводить source population:

```text
Analytics Active Customers = 129
→ CRM Customers
→ same period
→ visible Active Customers context/filter
→ aggregate summary Active Customers = 129
→ registry total = 129
```

При этом общий stock:

```text
Всего клиентов = 261
```

может оставаться отдельной метрикой, если это действительно ALL_TIME/customer-stock semantics.

Нельзя просто переименовать 261 или заставить `Всего клиентов` искусственно стать 129.

Если destination не позволяет воспроизвести 129 — finding:

```text
SR-CRM-01
Priority: P1
Active Customers drill-down loses source population
```

---

## 20D. SR-CRM-02 — PARTNERS 33 → CRM 28

Новый обязательный P1 candidate.

Runtime observation:

```text
Analytics
Партнёры = 33
      ↓ click
CRM → Партнёры
Всего партнёров = 28
```

Выполнить set-level reconciliation по canonical IDs:

```text
AnalyticsPartnerIds
CRMPartnerIds

intersection
analyticsOnly
crmOnly
```

Для каждого `analyticsOnly` / `crmOnly` record проверить:

```text
partnerId
status
active/inactive
Marketplace/Storefront
onboarding state
soft-delete/archive
workspace/tenant
entitlement/type
other population predicates
```

Объяснить **каждую запись разницы**, а не только difference count.

Если Analytics metric — ALL_TIME stock, доказать exact population contract и почему CRM показывает другую population.

Correct drill-down acceptance:

```text
Analytics Partners = X
→ CRM Partners
→ source metric population reproducible
→ visible contextual aggregate = X
→ table population = X
```

Если 33 и 28 являются двумя легитимно разными populations, UI должен явно назвать обе семантики и drill-down должен вести к population исходной метрики.

При отсутствии доказанного reconciliation:

```text
SR-CRM-02
Priority: P1
Partners source/destination population mismatch
```


## 21. FINDINGS
Формат:
```text
ID
Priority P0/P1/P2
Observed
Expected
Evidence
Root Cause
Impact
Required Remediation
```
IDs при подтверждении:
`SR-P360-01..05`, `SR-CAL-01/02`, `SR-FUL-01..07`, `SR-GMV-01..03`, `SR-SEC-01`, `SR-TABLE-01/02`, `SR-CRM-01/02`.

## 22. REQUIRED REPORT
Создать преимущественно русский:
`docs/reports/PHASE_3_PRE_STEP_3.12_PARTNER_360_STRICT_REVIEW.md`

Включить: SHA, Partner 360 architecture, 129→129, 17→17, shared-query proof, first-navigation period hydration evidence (before/after F5), calendar matrix, cross-consumer check, FULFILLED inventory/write path/guard/lifecycle/real records/default population/filter, exact GMV formula, refund case, GMV reconciliation, security, Shared Table Aggregation/Totals audit, table inventory matrix, Active Customers 129→261 reconciliation, Partners 33→28 set reconciliation, tests, findings, residual gaps, verdict, exact canonical NEXT.

## 23. CHANGE CONTROL
Strict Review не меняет production implementation. Если SR-P360-05 подтверждается, зафиксировать exact root cause и minimal remediation scope, но не исправлять его в этом review. Разрешены inspection, DB/API/browser evidence, tests и review report. Запрещены code fixes, period/status/GMV changes, Partner 360 remediation, FX и Step 3.12.

В конце:
```text
Starting SHA: 63a61e5
Review SHA: <real report-only SHA>
Final HEAD: <real SHA>
origin/master: <real SHA>
```

## 24. VERDICT
### VERDICT A
Только если:
- Partner 360 Orders/Bookings reconciliation PASS;
- shared authoritative queries PASS;
- partnerId/period persistence + security PASS;
- first client-side navigation applies the source period before the first authoritative fetch;
- first-render totals = after-F5 totals = source metrics for Orders and Bookings;
- refresh is NOT required for correct Partner 360 reconciliation;
- calendar named-period semantics + cross-consumer semantics PASS;
- FULFILLED lifecycle/guard proven;
- default Orders population/filter consistent;
- GMV completed formula + CLOSED/refund semantics proven;
- GMV drill-down traceability acceptable;
- Shared Table Aggregation / Totals gap audit completed;
- Active Customers 129→261 semantics and source population reconciled;
- Partners 33→28 populations reconciled at canonical-ID level;
- нет P0/P1 remediation finding.

```text
VERDICT A — PARTNER 360 STRICT REVIEW APPROVED
ROUND 5 / PARTNER 360 MAY BE FINALLY ACCEPTED
CANONICAL NEXT: MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT
```

### VERDICT B
При любом существенном defect:
```text
VERDICT B — PARTNER 360 / FULFILLED / PERIOD REMEDIATION REQUIRED
```
Дать exact minimal remediation scope, но не исправлять автоматически.

## 25. HARD STOP
После Strict Review — STOP. Не запускать remediation, FX Amendment или Step 3.12 автоматически. Сначала предоставить русский report, evidence, findings и verdict.
