# PHASE 3 — PRE-STEP 3.12 — ANALYTICS ROUND 4 STRICT REMEDIATION — SHARED METRIC DRILL-DOWN & COMMISSION SEMANTICS

## STATUS

**Starting baseline:** `7786c17`

Предыдущий отчёт заявил:

```text
PHASE 3 — PRE-STEP 3.12 — ANALYTICS RESIDUAL REMEDIATION — ROUND 4

Starting SHA:     8bc2282
Final SHA:        7786c17
origin/master:    7786c17

VERDICT A — ANALYTICS RESIDUAL REMEDIATION ROUND 4 APPROVED
```

Однако последующая ручная runtime-проверка выявила прямые противоречия отчёту.

Текущая re-qualification:

```text
R4-01 CUSTOM Period       → PASS, regression only
R4-02 KPI Drill-down      → FAIL / PARTIAL
R4-03 Commission Rate     → FAIL
R4-04 Period Chain        → PASS, regression only

ROUND 4 VERDICT A         → REJECTED
```

Причины:

1. наличие `href` не означает корректный drill-down;
2. Orders / Bookings / Customers теряют исходный metric context;
3. Partners направляется на onboarding вместо canonical CRM Partner registry;
4. `Ставка` фактически вычислена как `Commission / GMV × 100`, а не взята из canonical commission policy;
5. текущая реализация локальна для KPI cards и не решает project-wide source traceability;
6. Financial Summary и Partner Performance также требуют того же общего механизма.

**Step 3.12 НЕ НАЧИНАТЬ.**

**MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT пока НЕ НАЧИНАТЬ.**

---

# LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose documentation должны быть преимущественно **на русском языке**:

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

English разрешён только для технических идентификаторов:

- file paths;
- class/method/DTO/model/table names;
- API endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- commit messages;
- enums;
- permission identifiers;
- code snippets;
- standardized VERDICT strings.

Если итоговый отчёт преимущественно на английском языке — задача считается незавершённой до исправления отчёта.

---

# 1. OBJECTIVE

Исправить ошибочную локальную реализацию `R4-02/R4-03` и сформировать **один общий project-wide механизм metric source traceability**, пригодный не только для Analytics KPI cards.

Canonical architecture:

```text
                     SHARED METRIC DRILL-DOWN
                              │
                ┌─────────────┼─────────────┐
                ↓             ↓             ↓
            MetricCard   MetricTableCell   Chart/DataPoint
                │             │             │
                └─────────────┼─────────────┘
                              ↓
                    DrillDown Contract
                              ↓
                    Destination Resolver
                              ↓
                Context / Filter Transfer
                              ↓
                 Authoritative Data Source
                 / Dedicated Detail View
                              ↓
                     Reconciliation
```

Framework должен быть reusable для:

```text
Analytics
Command Center
Sales Center
Booking Center
Finance
CRM
Partner Performance
Financial Summary
других Domain Centers
```

Не создавать отдельный drill-down framework для каждого раздела.

---

# 2. HARD ARCHITECTURE RULE — NAVIGATION ≠ DRILL-DOWN

Следующее:

```text
KPI → /app/orders
```

само по себе **НЕ является drill-down**.

Корректный drill-down:

```text
Metric value
      ↓
authoritative destination
      ↓
same metric population
same workspace
same tenant/scope
same period — если metric period-bound
same status semantics
same currency semantics
same relevant filters
      ↓
source total = metric value
```

Если destination не способен воспроизвести metric population — простой redirect запрещён.

В таком случае:

1. расширить canonical Domain Center необходимым reusable filter capability; ИЛИ
2. использовать dedicated Metric Detail / Drill-down view.

Не создавать misleading links.

---

# 3. R4-02A — ORDERS KPI SOURCE TRACEABILITY — FAIL

## Runtime evidence

Analytics:

```text
Заказы = 214
```

После клика:

```text
Orders Center

Всего заказов              1516
Активные                    532
Готовы к бронированию         0
Закрыто/отменено            744

таблица: 76 страниц
```

Это доказывает потерю Analytics period/filter context.

## Required audit

Определить:

1. точную formula/population Analytics `Orders`;
2. business timestamp:
   - `createdAt`;
   - `confirmedAt`;
   - `completedAt`;
   - иной canonical timestamp;
3. существующие Orders API date filters;
4. существующие Orders Center date filters;
5. способен ли registry воспроизвести Analytics population.

## If Orders Center has no period filter

Добавить **canonical reusable Orders period/date-range filter**.

Не делать скрытый Analytics-specific query workaround.

После перехода пользователь должен видеть применённый фильтр и иметь возможность:

- изменить его;
- очистить его;
- вернуться к all-time registry.

## Acceptance

Для конкретного runtime кейса:

```text
Analytics Orders = 214
        ↓ click
Orders Center
        ↓
same Analytics period/population
        ↓
Total = 214
```

При `pageSize=20` pagination total/pages должны рассчитываться из этих 214 записей, а не из 1516.

---

# 4. R4-02B — BOOKINGS KPI SOURCE TRACEABILITY — FAIL

Та же проблема подтверждена для `Bookings`.

## Required audit

Определить:

- точную Analytics Bookings population;
- business timestamp;
- statuses;
- Booking Center filter capabilities;
- backend filter capabilities.

Не предполагать, что `Booking.createdAt` автоматически является правильной датой.

## Acceptance

```text
Analytics Bookings = X
        ↓ click
Booking Center
        ↓
same period
same workspace/scope
same booking semantics
        ↓
Total = X
```

Если canonical filter отсутствует — реализовать его в Booking Center/API как reusable capability.

---

# 5. R4-02C — CUSTOMERS KPI POPULATION SEMANTICS — FAIL

Текущий redirect:

```text
Analytics Customers
→ /app/crm
```

не доказывает source traceability.

Дополнительно runtime CRM показывает:

```text
CRM Customers total = 28
```

Не считать это автоматически ошибкой KPI, пока не определена semantics Analytics `Customers`.

## Mandatory semantic audit

Определить, что именно означает Analytics Customers:

```text
all registered customers?
customers registered in selected period?
unique customers with Orders in selected period?
unique customers with Bookings in selected period?
unique customers with Payments in selected period?
commercially active customers?
другая canonical population?
```

## Rule

Не навязывать period filter метрике, если она является all-time stock metric.

Если это period-bound activity metric — CRM должен уметь воспроизводить ту же population.

## Naming

Если KPI означает all-time registered population:

```text
Всего клиентов
```

предпочтительнее неоднозначного:

```text
Клиенты
```

Если metric означает activity:

```text
Активные клиенты
```

или другое точное название согласно доказанной formula.

Не переименовывать до repository/API evidence.

---

# 6. R4-02D — PARTNERS KPI DESTINATION & POPULATION — FAIL

Текущая реализация:

```text
Analytics Partners
→ /app/partners/onboarding
```

неверна.

Canonical Partner registry уже существует в:

```text
CRM → Партнёры
```

Onboarding — процесс подключения, а не authoritative registry существующих Partner.

## Current Analytics value

```text
Partners = 33
```

## Mandatory semantic audit

Определить, что означает `33`:

```text
all registered partners?
enabled partners?
active partners?
partners with Orders in period?
partners with Bookings in period?
partners with GMV in period?
partners eligible for Analytics?
```

## Period rule

Не пытаться искусственно разбивать all-time Partner population по периодам.

Если `33` = все зарегистрированные Partner:

```text
Всего партнёров = 33
→ CRM → Партнёры
→ all-time total = 33
```

и PeriodSelector на эту stock metric не влияет.

Если нужен периодный показатель, это отдельная metric:

```text
Активные партнёры за период = X
```

с отдельной доказанной activity definition.

Не смешивать:

```text
Всего партнёров
```

и:

```text
Активные партнёры
```

---

# 7. R4-02E — SHARED METRIC DRILL-DOWN FRAMEWORK

Текущий `href` в `KpiItem` не должен становиться конечной architecture.

Провести repository audit существующих:

- KPI/metric card components;
- table metric renderers;
- navigation helpers;
- filter/query serialization;
- period state;
- workspace context;
- permissions;
- existing detail drawers/pages.

Переиспользовать существующее там, где возможно.

## Canonical contract

Конкретные TypeScript names определить по repo architecture, но semantic contract должен поддерживать conceptually:

```text
metricId
sourceContext
destinationType
destination
periodPolicy
period
workspace
tenant/partner scope
currency
reportingCurrency
statuses
partnerId
customerId
service/capability
metric-specific filters
```

Не все поля обязательны для каждой metric.

## Destination types

Framework должен поддерживать минимум:

```text
DOMAIN_ROUTE
DETAIL_VIEW
NONE
```

В дальнейшем допускается extension без переписывания consumers.

## Period policies

Metric contract должен различать:

```text
PERIOD_BOUND
ALL_TIME
AS_OF_DATE
```

или эквивалентную архитектуру.

Не передавать period туда, где он семантически неприменим.

---

# 8. R4-02F — METRIC CARD + METRIC TABLE CELL

Shared framework должен быть пригоден минимум для двух consumer types:

```text
MetricCard
MetricTableCell
```

Не делать отдельные `onClick` handlers для каждой таблицы/карточки.

Canonical:

```text
MetricCard ────────┐
                   ├→ shared drill-down resolver
MetricTableCell ───┘
```

Подготовить архитектуру так, чтобы позже тем же contract могли пользоваться chart/data points.

---

# 9. FINANCIAL SUMMARY — PAYMENT COUNT + SOURCE TRACEABILITY

Расширить Financial Summary.

## Required columns

```text
Валюта
Кол-во платежей
Платежи
Возвраты
Net
Комиссия
```

Пример структуры:

| Валюта | Кол-во платежей | Платежи | Возвраты | Net | Комиссия |
|---|---:|---:|---:|---:|---:|
| AZN | N | ... | ... | ... | ... |
| USD | N | ... | ... | ... | ... |
| EUR | N | ... | ... | ... | ... |

## Critical DB/source evidence

Это должно окончательно доказать наличие или отсутствие реальных `Payment` records по валютам.

Для каждой валюты вывести evidence:

```text
Currency
Payment count
SUM(Payment.amount)
Refund count
SUM(Refund.amount)
Commission count
SUM(Commission.amount)
MIN(Payment.createdAt)
MAX(Payment.createdAt)
```

Минимум для:

```text
AZN
USD
EUR
```

если такие валюты существуют в canonical data.

Для USD/EUR привести несколько конкретных source records/IDs, если записи существуют.

Не считать ненулевую Analytics aggregate достаточным доказательством наличия `Payment` rows.

---

# 10. FINANCIAL SUMMARY — CLICKABLE METRIC CELLS

Использовать **Shared Metric Drill-down Framework**.

## Expected behavior

### Payment Count

```text
USD | 18
      ↓
Finance Payments
currency=USD
same period
same scope
→ total = 18
```

### Payments amount

```text
10,533.34 USD
      ↓
contributing Payment records
→ SUM(amount) = 10,533.34 USD
```

### Refunds

```text
Refund amount
      ↓
authoritative refund records/detail
```

### Commission

```text
Commission amount
      ↓
canonical Commission facts/accruals/detail
```

### Net

Если `Net` derived:

```text
Payments - Refunds
```

drill-down/detail должен показывать formula и contributing totals.

## Missing Domain Center

Если отдельной Finance/Refund/Commission страницы ещё нет:

**НЕ создавать fake redirect.**

Использовать shared dedicated Metric Detail view с:

- formula;
- source records;
- period;
- currency;
- total;
- reconciliation.

---

# 11. R4-03 — COMMISSION POLICY SEMANTICS — FAIL

Round 4 реализовал:

```text
"Ставка" = Commission / GMV × 100
```

Это подтверждено runtime на множестве строк.

Примеры:

```text
Flame Towers Residence:
Commission = 65.16
GMV        = 439.93

65.16 / 439.93 × 100 = 14.81%
UI = 14.8%
```

```text
Baku Tours Pro:
502.28 / 12,470.34 × 100 ≈ 4.0%
UI = 4.0%
```

```text
Gobustan Heritage Tours:
30.15 / 1,366.39 × 100 ≈ 2.2%
UI = 2.2%
```

Следовательно текущая колонка показывает derived effective ratio.

Она **не доказана как configured commission policy/rate**.

Round 3 ранее сообщил, что commission policy inventory содержит Partner rates в canonical data.

## Required distinction

Разделить:

```text
Ставка комиссии
= configured/current commission policy
```

и:

```text
Эффективная ставка
= фактическое отношение accrued commission к canonical commission base
```

Эти значения могут различаться.

## Critical rule

Не считать автоматически, что denominator effective rate всегда `GMV`.

Сначала определить canonical commission base.

Возможные основания:

- GMV;
- paid amount;
- net paid amount;
- fulfilled amount;
- service-specific base;
- transaction-level rule.

Использовать только доказанную domain semantics.

---

# 12. COMMISSION POLICY INVENTORY — MANDATORY

Для всех существующих Partner вывести:

| Partner | Canonical policy source | Configured rate | Override | Service-specific | Effective dates | History | Transaction snapshot |
|---|---|---:|---|---|---|---|---|

Определить:

- global default;
- per-partner override;
- service/category-specific rates;
- effective dating;
- policy history;
- transaction snapshot;
- seed-only vs production-ready domain model.

Если rate существует только как seed fixture и нет полноценной policy architecture — классифицировать честно.

Не превращать seed data в вымышленную enterprise policy architecture.

---

# 13. PARTNER PERFORMANCE — SHARED CELL DRILL-DOWN

Partner Performance должен использовать тот же shared framework.

Целевой semantic mapping:

| Поле | Drill-down |
|---|---|
| Partner name | CRM Partner profile / registry context |
| GMV | contributing GMV records |
| Customer Payments | Payment records |
| Commission | Commission facts/accruals |
| Orders | Orders filtered by partner + period |
| Bookings | Bookings filtered by partner + period |
| Completion | underlying booking population + formula |
| Commission Rate | configured commission policy |
| Effective Rate | formula + contributing facts |

Не обязательно создавать все отсутствующие Domain Center pages в этом Round.

При отсутствии destination использовать shared detail view.

---

# 14. CASPIAN WEDDINGS — MANDATORY SOURCE RECONCILIATION

Runtime обнаружил строку:

```text
Caspian Weddings

GMV        = 0
Payments   = 0
Commission = 155.50
Orders     = 0
Bookings   = 2
Rate       = —
```

Это требует отдельного доказательства.

## Required trace

Найти source records, формирующие:

```text
Commission = 155.50
```

и доказать:

- Partner ID;
- Commission record IDs;
- source transaction/order/payment if applicable;
- currency;
- amount;
- timestamp;
- selected Analytics period;
- commission policy/rate;
- commission base;
- reason GMV=0;
- reason Payments=0;
- reason Orders=0.

## Classification

После trace классифицировать:

```text
VALID DOMAIN CASE
DATA INCONSISTENCY
AGGREGATION BUG
SEED FIXTURE INCONSISTENCY
ORPHAN FINANCIAL FACT
PERIOD SEMANTICS DIFFERENCE
OTHER — with evidence
```

Не исправлять данные только для того, чтобы UI выглядел согласованно.

---

# 15. COMPLETION RATE DRILL-DOWN

`Доля заверш.` должна иметь точную formula.

Round 3 исправлял denominator на `totalBookings`.

Теперь при drill-down необходимо доказать:

```text
completedBookings
/
totalBookings
× 100
=
displayed completion
```

Клик должен показывать population, достаточную для проверки numerator/denominator.

Если значение относится к selected period — обе части formula должны использовать согласованную period semantics.

---

# 16. NON-CLICKABLE KPI — CURRENT 4 METRICS

По отчёту после Round 4 статичными остались:

```text
Комиссия
Средний чек
Возвраты
Сессии
```

Причина:

```text
нет отдельных Finance / Refunds / Sessions pages
```

Это допустимо как временное состояние, но не является конечным source-traceability contract.

## Required handling

### Commission

Использовать dedicated metric detail, если authoritative registry отсутствует.

### AOV / Средний чек

Derived metric detail:

```text
formula
numerator
denominator
included population
currency semantics
```

### Refunds

Dedicated detail/source records, если отдельного registry нет.

### Sessions

Если behavioral telemetry source существует — detail к telemetry records.

Если RG4 означает, что source недостаточен, не симулировать drill-down. Отобразить metric как non-drillable с documented blocking reason либо limited detail только по реально существующим events.

---

# 17. UX / ACCESSIBILITY CONTRACT

Clickable metric должен визуально отличаться от static metric.

Минимум:

- pointer;
- hover affordance;
- focus state;
- keyboard navigation;
- Enter/Space activation where appropriate;
- accessible label;
- no invalid nested interactive elements.

Static metric не должен выглядеть кликабельным.

Table cell click не должен конфликтовать с:

- text selection;
- row actions;
- context menu;
- sorting;
- pagination.

---

# 18. SECURITY CONTRACT

Shared resolver не является security boundary.

Destination APIs обязаны server-side enforce:

```text
workspace
tenant/partner scope
role
permission
entitlement
resource ownership
```

Query params:

```text
partnerId
customerId
currency
from
to
statuses
```

не должны позволять расширить scope.

Проверить tampering минимум для одного Partner-scoped и одного Platform-scoped сценария, если соответствующие routes доступны.

---

# 19. FILTER STATE CONTRACT

Drill-down должен переносить только **семантически релевантный** context.

Минимум проверить:

```text
from
to
period preset
workspace
currency
partner
customer
status population
```

Не переносить случайные UI state/query params.

Destination должен явно отображать применённые filters.

Пользователь должен понимать, почему source registry показывает именно X записей.

---

# 20. RECONCILIATION CONTRACT

Для каждого реализованного drill-down предоставить доказательство:

```text
Source metric value
=
Destination filtered total / derived result
```

Примеры:

```text
Analytics Orders 214
=
Orders Center filtered total 214
```

```text
Analytics Bookings X
=
Booking Center filtered total X
```

```text
Financial Summary USD Payment Count N
=
Payments detail total N
```

```text
Financial Summary USD Payments Amount X
=
SUM(source USD Payments) X
```

```text
Partner Performance Orders X
=
Orders filtered by partner+period total X
```

Без reconciliation клик считается navigation, а не source traceability.

---

# 21. REGRESSION — R4-01 CUSTOM PERIOD

Не переписывать working fix без нового finding.

Повторно проверить:

```text
CUSTOM empty
start only
end only
valid range
start > end
clear one date
CUSTOM → preset
preset → CUSTOM
```

Hard requirement:

```text
NO malformed API request
NO undefined date
NO duplicate error banner
```

---

# 22. REGRESSION — R4-04 PERIOD CHAIN

Повторно проверить минимум:

```text
3D
Month
Year
CUSTOM
```

для Orders time-series после изменений filter/drill-down infrastructure.

Не допустить, чтобы shared filter serialization сломал Analytics period chain.

---

# 23. TESTS — MANDATORY

## Frontend

Запустить:

```text
tests
TSC
build
```

Добавить targeted tests для:

- shared drill-down resolver;
- PERIOD_BOUND metric;
- ALL_TIME metric;
- DOMAIN_ROUTE;
- DETAIL_VIEW;
- NONE;
- context serialization;
- Orders KPI;
- Bookings KPI;
- Customers semantics;
- Partners destination;
- MetricTableCell;
- Financial Summary payment count;
- Partner Performance cells;
- configured vs effective commission rate;
- keyboard accessibility.

## Backend

В отличие от предыдущего Round backend нельзя автоматически объявлять `NOT MODIFIED`, если для корректного source traceability требуются:

- Orders date filters;
- Bookings date filters;
- payment count;
- source detail endpoint;
- commission policy source;
- reconciliation support.

Если backend изменён:

```text
relevant tests
TSC
security tests
```

обязательны.

---

# 24. BROWSER MATRIX — MANDATORY

## Analytics KPI

Проверить минимум:

```text
Orders
Bookings
Customers
Partners
Commission
AOV
Refunds
Sessions
```

Для каждой:

```text
clickable?
destination type?
period policy?
destination?
filters visible?
reconciliation?
```

## Orders concrete runtime case

Обязательно воспроизвести:

```text
Analytics Orders = 214
```

и доказать destination total `214`, если dataset остаётся тем же.

Если dataset изменился — привести новый source/destination pair с exact equality.

## CRM

Проверить отдельно:

```text
Customers registry
Partners registry
```

Не смешивать эти сущности.

## Financial Summary

Проверить AZN/USD/EUR rows и clickable metric cells.

## Partner Performance

Проверить минимум:

- Flame Towers Residence;
- несколько Partner с разными configured rates;
- Caspian Weddings.

---

# 25. NETWORK / API EVIDENCE

Для каждого ключевого drill-down показать:

```text
source metric request
destination request
relevant query/filter params
returned total
```

Для Financial Summary:

```text
currency → payment count → source records
```

Для commission policy:

```text
canonical source field/model/API
```

Не ограничиваться screenshots.

---

# 26. REQUIRED GAP CLASSIFICATION

Все обнаруженные gaps классифицировать:

```text
UI GAP
DOMAIN GAP
SECURITY-GOVERNANCE GAP
ARCHITECTURE GAP
ROADMAP GAP
DEFERRED
BLOCKING
```

Не маскировать отсутствующий Domain Center как UI defect.

---

# 27. OUT OF SCOPE

Не реализовывать в этом Round:

```text
full Multi-Currency / FX conversion architecture
historical FX backfill
Behavioral Telemetry / Customer Journey subsystem
Step 3.12 Users & Access
new organizational groups/departments
large Finance Ledger redesign
```

Но Financial Summary должен доказать native-currency Payment counts/source records.

Не конвертировать USD/EUR в AZN текущим exchange rate.

---

# 28. FX SAFETY RULE

Если при Financial Summary work возникает желание добавить conversion:

**STOP.**

Historical monetary reporting требует отдельной architecture:

```text
originalAmount
originalCurrency
reportingCurrency
historical fxRate / snapshot
reportingAmount
```

Не использовать today's exchange rate для historical transactions.

RG2 остаётся отдельным blocking architecture gap.

---

# 29. CANONICAL ROADMAP

После implementation:

1. обновить canonical roadmap только additive способом;
2. сохранить историю предыдущих Round;
3. указать реальные commit SHA;
4. не переписывать прошлый `VERDICT A` как будто он никогда не существовал;
5. зафиксировать, что последующая runtime re-qualification его отклонила;
6. указать residual RG2/RG4;
7. не стартовать следующий stage автоматически.

---

# 30. REQUIRED REPORT

Создать преимущественно русский отчёт:

1. Executive Summary
2. Starting SHA
3. Repository Audit
4. Why Round 4 VERDICT A Was Rejected
5. Shared Metric Drill-down Architecture
6. Orders Reconciliation
7. Bookings Reconciliation
8. Customers Population Semantics
9. Partners Population Semantics
10. Financial Summary Payment Inventory
11. Financial Summary Drill-down
12. Commission Policy Inventory
13. Configured vs Effective Commission Rate
14. Partner Performance Drill-down
15. Caspian Weddings Reconciliation
16. Security Verification
17. Tests
18. Browser Matrix
19. Network/API Evidence
20. Residual Gaps
21. Roadmap Update
22. Final Verdict
23. Exact NEXT

---

# 31. VERDICT RULES

## VERDICT A

Разрешён только если:

- `R4-02` больше не является набором простых `href`;
- shared project-wide drill-down contract существует;
- минимум MetricCard + MetricTableCell используют общий механизм;
- Orders destination воспроизводит source KPI;
- Bookings destination воспроизводит source KPI;
- Customers semantics доказана;
- Partners ведёт в canonical CRM Partner context, а не onboarding;
- all-time vs period-bound metrics разделены;
- Financial Summary показывает Payment Count;
- native-currency Payment inventory доказан;
- Financial Summary cells используют shared drill-down;
- `Ставка комиссии` берётся из canonical policy;
- derived `Commission/GMV` больше не выдаётся за configured rate;
- effective rate имеет доказанный denominator;
- Caspian Weddings `155.50` reconciled/classified;
- permissions/scope не обходятся;
- browser evidence подтверждает реальную кликабельность;
- source/destination totals reconciled;
- tests PASS;
- report predominantly Russian.

## VERDICT B

Обязателен, если хотя бы одно из следующего остаётся:

```text
Orders KPI 214 → Orders all-time 1516
Bookings → all-time registry
Customers → generic CRM without reproducible population
Partners → onboarding
"Ставка" = Commission / GMV without explicit effective-rate semantics
clickable UI without filter preservation
metric destination total != source metric
duplicated local drill-down implementations
fake redirects for missing Domain Centers
unproven EUR/USD Payment rows
Caspian Weddings Commission unexplained
scope bypass through query params
runtime contradicts report
```

---

# 32. CANONICAL NEXT

Только после успешного закрытия этого remediation:

```text
Canonical NEXT:
MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT
```

После FX отдельно:

```text
Behavioral Telemetry / Customer Journey Architecture Amendment
```

если canonical dependency audit не потребует другой порядок.

---

# 33. HARD STOP

```text
DO NOT AUTO-START MULTI-CURRENCY / FX IMPLEMENTATION
DO NOT AUTO-START STEP 3.12
```

Сначала предоставить полный remediation report, runtime evidence и verdict.

---

# FINAL ACCEPTANCE CHECKLIST

- [ ] Round 4 previous VERDICT A explicitly re-qualified
- [ ] Shared Metric Drill-down framework exists
- [ ] no Analytics-only drill-down architecture
- [ ] MetricCard uses shared contract
- [ ] MetricTableCell uses shared contract
- [ ] Orders source/destination totals equal
- [ ] Orders period/filter visible at destination
- [ ] Bookings source/destination totals equal
- [ ] Bookings period/filter visible at destination
- [ ] Customers KPI semantics proven
- [ ] Customers all-time vs period-bound policy proven
- [ ] Partners KPI semantics proven
- [ ] Partners destination = canonical CRM Partner context
- [ ] Partners all-time vs active-period semantics separated
- [ ] Financial Summary has Payment Count
- [ ] AZN Payment count/source proven
- [ ] USD Payment count/source proven if USD records exist
- [ ] EUR Payment count/source proven if EUR records exist
- [ ] Financial Summary metric cells use shared drill-down
- [ ] Payment count reconciles to source records
- [ ] Payment amount reconciles to source records
- [ ] Refund amount reconciles or gap classified
- [ ] Commission amount reconciles or gap classified
- [ ] configured Commission Rate comes from canonical source
- [ ] Effective Rate is separately named
- [ ] Effective Rate denominator proven
- [ ] all Partner commission policies inventoried
- [ ] Partner Performance cells use shared drill-down
- [ ] Flame Towers Residence configured/effective rates reconciled
- [ ] Caspian Weddings Commission 155.50 explained/classified
- [ ] Completion drill-down formula reconciled
- [ ] Commission/AOV/Refunds/Sessions missing destinations handled honestly
- [ ] no fake redirects
- [ ] keyboard accessibility verified
- [ ] server-side scope enforcement verified
- [ ] query tampering checked
- [ ] R4-01 CUSTOM regression PASS
- [ ] R4-04 period regression PASS
- [ ] frontend tests/TSC/build PASS
- [ ] backend tests/TSC PASS if backend changed
- [ ] browser matrix PASS
- [ ] network/API evidence attached
- [ ] report predominantly Russian
- [ ] RG2 preserved as BLOCKING
- [ ] RG4 preserved as BLOCKING
- [ ] FX not auto-started
- [ ] Step 3.12 not auto-started
