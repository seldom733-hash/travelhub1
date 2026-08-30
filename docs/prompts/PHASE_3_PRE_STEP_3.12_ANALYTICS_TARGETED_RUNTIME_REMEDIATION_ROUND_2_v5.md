# PHASE 3 — PRE-STEP 3.12 — ANALYTICS TARGETED RUNTIME REMEDIATION — ROUND 2

## STATUS / BASELINE

```text
Implementation baseline: 02a2c7e
```

Предыдущий `VERDICT A — ANALYTICS DATA / KPI / UI CONTRACT REMEDIATION APPROVED` не считать окончательным runtime closure: последующая ручная browser-проверка выявила расхождения между заявленным evidence и фактическим UI.

Цель Round 2 — узко исправить и доказать в реальном runtime обнаруженные дефекты. Не проводить новый широкий Analytics audit, не расширять Finance architecture и не начинать Step 3.12.

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и текстовая документация должны быть преимущественно **на русском языке**: Remediation Report, Runtime Evidence Report, Strict Re-qualification Report, findings, root cause analysis, architecture decisions, data reconciliation, conclusions, recommendations и verdict explanations.

Английский допустим только для технических идентификаторов: file paths, class/method/DTO/model/table names, API endpoints, HTTP methods/status codes, CLI/Git commands, commit messages, enums, permission identifiers, code snippets и стандартизированных `VERDICT` strings.

Если итоговый отчёт преимущественно английский — задача незавершена.

## EVIDENCE PRIORITY

```text
REAL BROWSER RUNTIME
        >
API RESPONSE / SOURCE DATA
        >
TESTS
        >
SOURCE-CODE CLAIMS
```

Tests/build/DOM presence/API 200 не заменяют визуальную runtime-проверку.

---

# RT1 — PERIOD SELECTOR ↔ TIME SERIES

В runtime выбран фильтр:

```text
6 месяцев
```

но временная ось `Динамика — Заказы` визуально не соответствует выбранному диапазону.

Проверить полный chain:

```text
shared PeriodSelector
→ from/to
→ Analytics API request
→ backend period parsing
→ groupBy
→ returned buckets
→ frontend dataset
→ rendered X-axis
```

Selected period должен быть единственным authority для диапазона графика.

Для каждого периода доказать:

```text
UI selected period
=
request from/to
=
backend interpreted range
=
first/last returned bucket
=
rendered X-axis range
```

Обязательно проверить минимум:

```text
7 дней
30 дней
6 месяцев
```

Проверить timezone, inclusive/exclusive boundaries, off-by-one, потерю последнего bucket и UTC shift.

Granularity не должна менять выбранный range:

```text
Period:      6 месяцев
Granularity: WEEK
```

---

# RT2 / RT3 — REAL BAR CHART + SCALE

Предыдущий contract требовал proportional bar chart. В реальном браузере отображается практически горизонтальная линия/микроскопические пики.

Установить root cause: chart type, dataset mapping, aggregation, CSS/layout, dimensions, scale/domain, library configuration или иное.

Если visualization contract предусматривает bars, обязательны:

```text
one time bucket → one visible bar
bar height ∝ bucket value
Y-axis baseline = 0 для count metric
readable quantitative Y-axis
X-axis = selected-period buckets
tooltip = bucket/date + value
responsive rendering
correct bucket spacing
zero bucket = zero
```

Недопустимы line-series вместо bars, микроскопические точки, скрытая/обрезанная Y-axis или визуально ложная шкала.

Сначала проверить существующий chart stack и переиспользовать canonical/shared chart primitives. Не добавлять новую тяжёлую dependency без необходимости.

---

# RT2A — ORDERS RECONCILIATION

Если график называется:

```text
Динамика — Заказы
```

и headline `Заказы` использует тот же period/date/status contract, должно выполняться:

```text
SUM(order time-series buckets) = Orders KPI
```

Для текущего 6-месячного runtime headline показывает `763`.

Предоставить реальные bucket values и сумму. Если KPI и series имеют разные законные timestamp/status semantics — доказать это и исключить вводящий в заблуждение UI.

---

# RT4 — DUPLICATE COMPLETED GMV

Runtime одновременно показывает:

```text
GMV (выполненные) = 51 782,77 AZN
Завершённый GMV   = 51 782,77 AZN
```

Проверить API/formulas. Если это одна metric — не показывать её дважды.

Не придумывать новую KPI только ради заполнения карточки. Удалить дубль либо заменить только на уже существующую, канонически определённую и действительно отличающуюся metric.

---

# RT5 — AOV / СРЕДНИЙ ЧЕК

Runtime:

```text
Средний чек = 146,28 AZN
```

Доказать:

```text
numerator
denominator
included/excluded statuses
period timestamp
currency scope
refund treatment
```

Обязательный evidence chain:

```text
source records
→ backend calculation
→ API
→ UI
```

В отчёте показать конкретно:

```text
numerator = ...
denominator = ...
result = 146,28 AZN
```

Если formula неверна — исправить. Не подгонять число под другие KPI.

Добавить deterministic regression test.

---

# RT6 — CUSTOMERS = BOOKINGS

Runtime:

```text
Клиенты      = 332
Бронирования = 332
```

Совпадение допустимо только при независимых корректных formulas.

Определить canonical semantics `Клиенты`: registered users, unique customers with Orders, unique customers with Bookings, active/new customers или фактический иной predicate.

Если это unique customers — доказать distinct query.

Добавить test dataset, где:

```text
Bookings count != unique Customers count
```

чтобы ошибочное использование Booking count не могло пройти тест.

---

# RT7 — COMMISSION CURRENCY

Runtime:

```text
Комиссия = 3 233,65
```

Если Commission — monetary amount, привести её к общему currency-display contract.

Сначала доказать currency scope. Не добавлять `AZN` автоматически, если metric агрегирует иначе. Не складывать разные currencies без FX conversion.

---

# RT8 — SESSIONS / TELEMETRY

Runtime:

```text
Сессии = 0
Orders = 763

Product Impression = 0
Product Viewed     = 0
Checkout Started   = 0
Order Created      = 763
```

Проверить endpoint/source и доказать, что `0` — реальное отсутствие telemetry за выбранный period, а не API failure, period bug или frontend mapping bug.

Не реализовывать новую telemetry architecture в этом Round. Если zero корректен, сохранить:

```text
RG4 — Sparse behavioral telemetry
```

---

# RT9 — PARTNER PERFORMANCE PAGINATION

Global contract:

```text
DEFAULT_PAGE_SIZE = 20

records ≤ 20 → одна страница
records > 20 → pagination
```

Runtime показывает `Партнёры = 33`. Если Partner Performance — полный список, доказать:

```text
page 1 → max 20
page 2 → remaining 13
total  → 33
```

Проверить реальный API contract (`page`, `pageSize`, `total`, `totalPages` или repository-equivalent).

Если backend отдаёт все 33, а frontend только делает `slice`, это **не server-side pagination**.

Search/filter/sort для full registry должны применяться до pagination.

Summary/Top-N widgets — исключение.

---

# SHARED PERIOD FILTER — PRESERVE

Analytics уже использует shared `PeriodSelector` Command Center. Не создавать второй component.

Исправление RT1 должно сохранить единый:

```text
component
design
presets
custom-range UX
timezone semantics
loading behavior
```

между Command Center и Analytics.

Проверить также, что period-bound KPI действительно обновляются при смене периода: Orders, Bookings, Customer Payments, Refunds, GMV metrics, AOV, Customers. Snapshot KPI не нужно искусственно привязывать к period, если их semantics иная.

---

# COMPLETION DEFENSIVE CAP — VERIFY

Предыдущний C1 был закрыт:

```text
Backend capped at 100
Frontend removed ×100
```

Проверить минимум одного representative partner:

```text
completed count
denominator
raw percentage
rendered percentage
```

`min(value, 100)` не должен скрывать ошибочную исходную formula/query. Если raw percentage >100 из-за неправильного numerator/denominator — открыть finding и исправить root cause.

---

# BROWSER MATRIX — MANDATORY

| Check | 7 дней | 30 дней | 6 месяцев |
|---|---|---|---|
| PeriodSelector | PASS/FAIL | PASS/FAIL | PASS/FAIL |
| API from/to | evidence | evidence | evidence |
| First bucket | evidence | evidence | evidence |
| Last bucket | evidence | evidence | evidence |
| Granularity | evidence | evidence | evidence |
| Visible proportional bars | PASS/FAIL | PASS/FAIL | PASS/FAIL |
| Y-axis from 0/readable | PASS/FAIL | PASS/FAIL | PASS/FAIL |
| Tooltip | PASS/FAIL | PASS/FAIL | PASS/FAIL |
| SUM buckets reconciliation | evidence | evidence | evidence |

Не ставить PASS без фактического browser observation.

## Screenshot evidence — mandatory

Минимум:

```text
1. Analytics — 7 дней
2. Analytics — 30 дней
3. Analytics — 6 месяцев
4. Partner Performance — page 1
5. Partner Performance — page 2
```

На screenshots должны быть видимы selected period, chart, bars, X/Y axes и соответствующие pagination controls.

Если screenshot противоречит заявленному PASS — runtime/screenshot имеет приоритет.

---

# API / SOURCE DATA EVIDENCE

Для 7 дней / 30 дней / 6 месяцев привести time-series evidence:

```text
from
to
groupBy
bucket count
first bucket
last bucket
sum
representative buckets
```

Для 6 месяцев выполнить reconciliation:

```text
DB/source Orders
→ backend calculation
→ API buckets
→ SUM(buckets)
→ headline Orders
→ rendered chart
```

Расхождения объяснить, а не скрывать.

---

# TESTS — REQUIRED

Добавить regression tests минимум на:

```text
6-month preset → correct from/to
PeriodSelector range → time-series request
returned buckets stay inside selected range
Orders series maps to bar-series, not line-series
AOV deterministic formula
Bookings != unique Customers fixture
33 records + pageSize 20 → page1 20, page2 13
```

Проверить frontend tests/TSC/build и backend relevant tests/typecheck.

Не заявлять PASS для того, что не запускалось.

---

# DO NOT MASK ERRORS

Запрещены:

```text
hardcoded date labels
hardcoded bar heights
hardcoded AOV
hardcoded Customers
fake fixed zero
client-side slice вместо required server pagination
hiding axis to conceal scale issue
hiding duplicate KPI without understanding its source
```

Исправлять root cause.

---

# PRESERVE CORRECT PREVIOUS FIXES

Не возвращать:

```text
Customer Payments → «Выручка»
independent counters → «Воронка конверсии»
```

Сохранить residual gaps:

```text
RG1 Platform Revenue architecture
RG3 true cohort funnel
RG4 behavioral telemetry
```

`RG2 FX/reporting currency` после RT10 должен быть либо:
- закрыт использованием уже существующей достаточной canonical FX architecture;
- либо повышен до подтверждённого blocking Architecture Gap с отдельным FX Architecture Amendment.

`RG4 behavioral telemetry` после RT12 должен быть либо:
- закрыт исправлением существующего broken telemetry pipeline;
- либо повышен до подтверждённого Analytics/Telemetry Architecture Gap с отдельным Behavioral Telemetry / Customer Journey Architecture Amendment.

Не реализовывать в этом Round полный Finance Center, FX engine, Seller Entitlement/Settlement/Payout architecture или новую cohort/telemetry platform.

---



---

# RT10 — MULTI-CURRENCY / REPORTING CURRENCY VERIFICATION — P1

## Runtime observation

Financial Summary показывает ненулевые значения минимум в трёх валютах:

```text
AZN
Payments  32 459,15
Refunds    3 050,53
Net       29 408,62
Commission 3 233,65

EUR
Payments     331,89
Refunds       69,59
Net          262,30
Commission    44,17

USD
Payments  18 335,03
Refunds    1 735,26
Net       16 599,77
Commission 2 028,59
```

При этом headline:

```text
Платежи клиентов = 32 459,15 AZN
```

совпадает только с AZN-строкой, хотя UI Financial Summary сообщает о EUR/USD activity.

Это означает, что `RG2 — No FX conversion` потенциально уже влияет на достоверность текущих headline Analytics KPI и не может быть автоматически оставлен только как абстрактный future gap.

## Step 1 — prove the source data

До любых изменений доказать, существуют ли реальные records:

```text
Payment.currency = AZN
Payment.currency = EUR
Payment.currency = USD
```

Для EUR/USD привести:

- количество Payment records;
- representative Payment IDs/codes;
- amount;
- status;
- payment timestamp;
- related Order;
- partner/customer scope;
- источник данных (seed/test/runtime);
- Refund records, если они участвуют;
- Commission/CommissionAccrual source.

Сопоставить:

```text
DB/source
→ backend aggregation
→ API Financial Summary
→ UI
```

Если EUR/USD появляются из-за aggregation/mapping bug, исправить root cause и не проектировать FX поверх ошибочных данных.

## Step 2 — audit existing FX infrastructure

Проверить repository на наличие:

```text
FX model/table
ExchangeRate model/table
currency conversion service
reporting/base currency
historical rate snapshot
rate provider
rate timestamp
rounding policy
Money/value-object utilities
Order/Payment FX fields
Refund FX fields
Commission FX fields
```

Не предполагать отсутствие инфраструктуры без repo evidence.

## Step 3 — reporting currency decision

Для Platform Analytics целевая reporting currency по текущему бизнес-контексту — **AZN**, но реализация допустима только после подтверждения существующего financial/currency contract.

Нужно различать:

```text
native/original amount
native/original currency

FX rate
FX effective timestamp/source

reporting amount
reporting currency = AZN
```

Критический invariant:

```text
AZN + USD + EUR
```

нельзя складывать как raw numbers.

## Step 4 — historical reproducibility

Запрещено решать проблему путём:

```text
current FX rate × all historical Payments
```

если это приводит к изменению исторических Analytics totals при изменении сегодняшнего курса.

Нужно определить canonical FX policy:

- какой курс используется;
- источник курса;
- effective timestamp;
- когда курс фиксируется;
- где хранится snapshot либо как обеспечивается историческая воспроизводимость;
- precision;
- rounding;
- поведение для Payment;
- поведение для Refund;
- поведение для Commission;
- поведение для GMV/AOV.

Не придумывать policy без архитектурного основания.

## Step 5 — decision branch

### A. Existing FX architecture is sufficient

Если repository уже имеет достаточный canonical FX/reporting-currency contract:

```text
native amounts
→ canonical historical FX
→ reporting amount AZN
```

использовать его и исправить Analytics aggregation.

Тогда проверить в AZN:

```text
Customer Payments
Refunds
Net Customer Payments
Commission
GMV variants
AOV
```

только для metrics, для которых conversion семантически применим.

Financial Summary при этом должна сохранять native-currency breakdown.

### B. FX architecture is absent or insufficient

Если корректной historical FX architecture нет:

**НЕ импровизировать и НЕ подключать случайный exchange-rate API в этом Round.**

Зафиксировать:

```text
RT10 — CONFIRMED BLOCKING ARCHITECTURE GAP
```

и подготовить recommendation для отдельного:

```text
MULTI-CURRENCY / FX ARCHITECTURE AMENDMENT
```

с последующим additive Canonical Roadmap Sync.

В этом случае Analytics PRE-STEP нельзя считать окончательно re-qualified как полностью достоверную multi-currency analytics.

## Headline semantics

Если до FX architecture headline показывает только native AZN subset, label/description не должен создавать впечатление total across all currencies.

Не выдавать:

```text
32 459,15 AZN
```

за total Platform Customer Payments, если существуют реальные USD/EUR payments, не приведённые к AZN.

## Financial Summary UX

Сохранить native breakdown:

```text
Currency | Payments | Refunds | Net | Commission
AZN
EUR
USD
```

Будущий reporting-currency total должен быть отдельной консолидированной проекцией в AZN, а не заменой исходных валютных строк.

## RT10 evidence

В отчёте обязательна таблица:

| Currency | Payment records | Native Payments | Native Refunds | Native Net | Native Commission | FX infrastructure | Reporting treatment |
|---|---:|---:|---:|---:|---:|---|---|

И отдельный вывод:

```text
EUR/USD records real? YES/NO
Existing FX architecture sufficient? YES/NO
Reporting currency contract available? YES/NO
Historical reproducibility guaranteed? YES/NO
Analytics totals currently complete across currencies? YES/NO
```




---

# RT11 — COMMISSION RECONCILIATION / SEMANTICS — P1

## Runtime observation

Financial Summary показывает:

```text
AZN
Payments   32 459,15
Refunds     3 050,53
Net        29 408,62
Commission  3 233,65

EUR
Payments      331,89
Refunds        69,59
Net           262,30
Commission     44,17

USD
Payments   18 335,03
Refunds      1 735,26
Net         16 599,77
Commission   2 028,59
```

Observed ratios:

```text
Commission / Payments

AZN ≈  9,96%
EUR ≈ 13,31%
USD ≈ 11,06%
```

и:

```text
Commission / Net Payments

AZN ≈ 11,00%
EUR ≈ 16,84%
USD ≈ 12,22%
```

Эти различия **не являются автоматически ошибкой**, потому что commission rate может зависеть от Partner, service/category, commercial agreement, promotion/funding rules или других canonical условий.

Но текущая колонка `Комиссия` должна иметь доказуемую единую бизнес-семантику.

## Required question

Установить, что именно означает:

```text
Financial Summary → Commission
```

Возможные semantics нельзя угадывать:

```text
gross accrued commission
collected commission
commission on CAPTURED payments
commission after refunds
net commission
settled commission
другая canonical projection
```

Нужно доказать фактическую semantics из repository/domain model.

## Canonical source

Проверить реальные canonical sources, включая при наличии:

```text
CommissionAccrual
Commission
Order commercial snapshot
Partner commercial terms
Payment
Refund
Settlement
Promotion/Funding snapshot
```

Не считать commission как:

```text
SUM(Payment.amount) × arbitrary fixed %
```

если canonical Finance Domain хранит/рассчитывает commission per transaction/order.

Предпочтительный invariant:

```text
Financial Summary Commission
=
SUM(canonical eligible commission facts/accruals)
```

с корректным status/period/currency/refund scope.

## Per-currency reconciliation

Для каждой currency:

```text
AZN
EUR
USD
```

показать:

```text
eligible source commission records
→ amount per record
→ adjustments/reversals
→ SUM
→ Analytics API
→ Financial Summary
```

Должно быть возможно воспроизвести:

```text
AZN → 3 233,65
EUR →    44,17
USD → 2 028,59
```

либо доказать, что одно/несколько текущих значений ошибочны и исправить root cause.

## Representative transaction evidence

Минимум для нескольких representative transactions разных partners/currencies показать:

```text
Order / Payment
Partner
native currency
payment amount
commission rule/source
commission rate, если применимо
commission amount
status
refund/adjustment, если есть
result included in Financial Summary
```

Не раскрывать secrets/credentials.

## Partner-specific commission rates

Проверить, допускает ли текущая architecture разные commission rates для:

```text
different Partners
different service categories
different commercial agreements
different funding/promotion conditions
```

Если да, различие effective ratios между AZN/EUR/USD само по себе не является defect.

Но aggregate должен быть суммой корректных transaction-level commission facts.

## Refund effect — mandatory

Установить canonical поведение commission при Refund.

Пример:

```text
Payment    1 000
Commission   100
Refund       500
```

Не выбирать произвольно между:

```text
commission remains 100
proportional reversal → 50
full reversal → 0
policy-dependent adjustment
```

Нужно доказать текущую domain policy и реализацию.

Проверить:

- partial refund;
- full refund;
- cancellation;
- refund after commission accrual;
- refund in another reporting period;
- reversal/adjustment record, если существует.

## Status scope

Доказать, какие statuses входят в Commission aggregation.

Например, нельзя без evidence считать одинаково:

```text
PENDING
AUTHORIZED
CAPTURED
FAILED
CANCELLED
REFUNDED
```

Использовать реальные enums/repository truth.

## Period semantics

Определить timestamp, по которому Commission попадает в выбранный Analytics period:

```text
Payment.createdAt?
Payment.capturedAt?
CommissionAccrual.createdAt?
accruedAt?
settledAt?
другое?
```

Period filter должен применять canonical commission-event semantics.

Не привязывать Commission к Order date только ради совпадения totals.

## Currency semantics

Commission должна сохранять native currency context.

До RT10/FX resolution:

```text
AZN commission
EUR commission
USD commission
```

не должны raw-суммироваться.

После/при наличии canonical FX architecture consolidated Commission в reporting currency должна рассчитываться через тот же historical FX contract, что и другие monetary Analytics metrics.

## Commission card

Headline `Комиссия` должна быть reconciled с Financial Summary.

Если headline отображает только AZN subset, а существуют реальные EUR/USD commission amounts без FX conversion, UI не должен выдавать её за consolidated Platform Commission.

RT10 и RT11 должны быть согласованы.

## Commission ≠ Platform Revenue

Не закрывать `RG1 Platform Revenue architecture` простым переименованием Commission в Revenue.

Даже если Commission является главным компонентом Platform Revenue:

```text
Commission ≠ автоматически полный Platform Revenue
```

до отдельного Finance architecture decision.

## RT11 tests

Добавить deterministic tests, где:

```text
Partner A commission rate != Partner B commission rate
```

и aggregate должен быть суммой transaction-level commission.

Также test минимум для:

```text
partial refund
full refund / reversal
different currency
excluded payment status
period boundary
```

в пределах реально поддерживаемой domain model.

## RT11 evidence table

В отчёте обязательна таблица:

| Currency | Eligible commission facts | Gross Commission | Refund/Reversal Adjustment | Final Commission | API | UI | Reconciled |
|---|---:|---:|---:|---:|---:|---:|---|

И отдельная representative matrix:

| Order/Payment | Partner | Currency | Payment | Rule/Rate | Commission | Refund/Adjustment | Included Result |
|---|---|---|---:|---|---:|---:|---:|

## RT11 outcome

Допустимы:

```text
A. Current commission semantics correct and fully reconciled
B. Formula/query defect found and fixed
C. Canonical commission semantics insufficient/ambiguous → Architecture Gap
```

Если `C`, не придумывать Finance semantics внутри Analytics remediation.

Зафиксировать отдельный Finance Architecture Gap и не объявлять Financial Summary полностью re-qualified до его разрешения.




---

# RT12 — BEHAVIORAL TELEMETRY COLLECTION / ZERO-EVENT GAP — P1

## Runtime observation

На одном и том же выбранном Analytics period отображается:

```text
Sessions                = 0
Product Impression      = 0
Product Viewed          = 0
Checkout Started        = 0

Order Created           = 763
Payment Succeeded       = 360
Booking Confirmed       = 72
Booking Completed       = 197
```

Нулевые значения верхней части customer journey нельзя автоматически считать реальным отсутствием пользовательской активности.

Особенно подозрителен контракт:

```text
0 impressions
→ 0 views
→ 0 checkout starts
→ 763 orders
```

Это может означать, что behavioral telemetry не собирается, не сохраняется, не агрегируется либо неправильно фильтруется.

## Required root-cause classification

Для каждого события:

```text
SESSION
PRODUCT_IMPRESSION
PRODUCT_VIEWED
CHECKOUT_STARTED
```

установить одно из состояний:

```text
EVENT_NOT_EMITTED
EVENT_NOT_PERSISTED
EVENT_NOT_AGGREGATED
PERIOD_FILTER_BUG
WORKSPACE/SCOPE_BUG
EVENT_MAPPING_BUG
DATASET_HAS_TRUE_ZERO
OTHER — with evidence
```

Не считать `0` корректным только потому, что API возвращает `0`.

## End-to-end telemetry trace

Проверить полный путь:

```text
Public TravelHub / customer-facing flow
        ↓
user action
        ↓
event emission
        ↓
event transport / endpoint
        ↓
persistence / event store
        ↓
Analytics aggregation
        ↓
Analytics API
        ↓
/app/analytics
```

Для каждого stage указать конкретные:

- frontend component/action;
- emitted event identifier;
- endpoint/transport;
- persistence model/table;
- timestamp;
- session/user/customer correlation;
- product/offering reference;
- workspace/tenant context;
- Analytics query/aggregation;
- API field;
- rendered UI field.

Если какого-либо звена нет — это подтверждённый telemetry gap.

## Real browser behavioral verification — mandatory

Проверка должна выполняться через реальный customer-facing runtime, а не только unit test.

Минимальный сценарий:

```text
1. Зафиксировать BEFORE counts/source state.
2. Открыть public TravelHub/customer-facing listing.
3. Получить/увидеть реальные предложения.
4. Проверить PRODUCT_IMPRESSION.
5. Открыть конкретное предложение.
6. Проверить PRODUCT_VIEWED.
7. Начать оформление.
8. Проверить CHECKOUT_STARTED.
9. Если безопасно в test/runtime flow — дойти до Order creation.
10. Проверить persisted events/source.
11. Проверить Analytics API.
12. Проверить /app/analytics после refresh/re-query.
```

Ожидаемый evidence concept:

```text
BEFORE:
Impression = X
Viewed     = Y
Checkout   = Z

ACTION:
listing rendered
product opened
checkout started

AFTER:
Impression > X
Viewed     = Y + expected delta
Checkout   = Z + expected delta
```

Точная delta для Impression зависит от canonical semantics: impression может считаться per visible offering, per listing render, deduplicated per session и т. п. Эту semantics нужно доказать, а не угадывать.

## Product Impression semantics

Определить, что именно считается impression:

```text
offering returned by API?
offering rendered in DOM?
offering actually entered viewport?
unique impression per session?
every render?
```

Не внедрять произвольную semantics без проверки существующей telemetry architecture.

Если telemetry отсутствует полностью и требуется новая architecture — зафиксировать это явно.

## Product Viewed semantics

Определить, что является view:

```text
opening product/offering details page?
modal open?
route navigation?
unique per session/customer?
repeat views allowed?
```

Доказать correlation с конкретным product/offering.

## Checkout Started semantics

Определить точный trigger:

```text
click "Забронировать"?
opening checkout?
first valid checkout step?
creation of draft/order intent?
```

Событие не должно создаваться просто для искусственного заполнения Analytics.

## Sessions semantics

Проверить, существует ли в проекте реальный session tracking.

Различать:

```text
authentication session
web analytics session
checkout session
server session
```

Карточка `Сессии` должна использовать именно behavioral/web analytics semantics, если она представлена в таком контексте.

Если web analytics sessions вообще не реализованы — `Sessions = 0` нельзя выдавать за измеренный production KPI без явного определения дальнейшего решения.

## Relationship with transactional events

Transactional counters:

```text
Order Created
Payment Succeeded
Booking Confirmed
Booking Completed
```

могут происходить из domain records и не обязаны доказывать наличие behavioral telemetry.

Не создавать fake behavioral events задним числом из Orders только для получения ненулевых значений.

Запрещено:

```text
1 Order → автоматически создать fake Impression
1 Order → автоматически создать fake Product View
1 Order → автоматически создать fake Checkout Started
```

если реальные события исторически не существовали.

## Historical data

Если telemetry начинает корректно собираться только после remediation:

- не фабриковать исторические impressions/views/checkouts;
- документировать дату/момент начала достоверного tracking;
- старый период может оставаться неполным;
- Analytics должна не вводить пользователя в заблуждение относительно исторической полноты.

## Decision branch

### A. Events already exist, pipeline broken

Если event emission существует, но проблема в persistence/aggregation/filter/mapping:

```text
исправить root cause
→ regression tests
→ real browser proof
→ API proof
→ Analytics proof
```

### B. Behavioral telemetry architecture exists only partially

Если часть stages реализована, закрыть defect только в пределах существующей canonical architecture, если это безопасно и не требует нового большого subsystem.

Остальное оформить как residual Architecture Gap.

### C. Behavioral telemetry does not exist

Если `PRODUCT_IMPRESSION`, `PRODUCT_VIEWED`, `CHECKOUT_STARTED`/web sessions фактически не инструментированы:

```text
RT12 — CONFIRMED ANALYTICS / TELEMETRY ARCHITECTURE GAP
```

Не строить ad-hoc tracking subsystem внутри узкого remediation без architecture decision.

Подготовить recommendation для отдельного:

```text
BEHAVIORAL TELEMETRY / CUSTOMER JOURNEY ARCHITECTURE AMENDMENT
```

и additive roadmap sync при необходимости.

В таком случае Analytics нельзя объявлять полностью re-qualified по behavioral/customer-journey analytics.

## Activity block semantics

Пока stages являются independent counters, сохранить честное название:

```text
Активность по этапам
```

Не возвращать `Воронка конверсии` без cohort semantics.

Если первые stages не измеряются, UI не должен создавать впечатление, что `0` означает доказанное отсутствие реальной customer activity, когда фактически tracking отсутствует.

Точное UX-решение определить из подтверждённого состояния telemetry, без fake values.

## i18n side finding

Raw English stage labels также не должны оставаться в русской локали:

```text
Product Impression
Product Viewed
Checkout Started
Order Created
Payment Succeeded
Booking Confirmed
Booking Completed
```

Canonical event identifiers не менять.

Presentation должна идти через i18n.

Рекомендуемые RU labels проверить с существующим glossary:

```text
Product Impression  → Показ предложения
Product Viewed      → Просмотр предложения
Checkout Started    → Начало оформления
Order Created       → Заказ создан
Payment Succeeded   → Оплата выполнена
Booking Confirmed   → Бронирование подтверждено
Booking Completed   → Бронирование завершено
```

Добавить/проверить переводы для всех реально поддерживаемых локалей проекта, не hardcode RU.

Отсутствующий translation key/raw event name не должен попадать пользователю.

## RT12 tests

Минимум:

- event emission test для реально существующих behavioral events;
- persistence test;
- aggregation test;
- period filtering test;
- mapping API → UI;
- i18n coverage test для stage labels;
- test, предотвращающий synthetic derivation Impression/View/Checkout из Order без canonical rule.

Если subsystem отсутствует — не писать fake tests на несуществующую architecture; зафиксировать gap.

## RT12 evidence matrix

В отчёте обязательна таблица:

| Stage | Emitted? | Persisted? | Source | Period Filter | Aggregated? | API | Browser | Verdict |
|---|---|---|---|---|---|---|---|---|
| Sessions | | | | | | | | |
| Product Impression | | | | | | | | |
| Product Viewed | | | | | | | | |
| Checkout Started | | | | | | | | |
| Order Created | | | | | | | | |

Также привести browser BEFORE/ACTION/AFTER evidence для behavioral stages, которые реально поддерживаются.

## RT12 acceptance

RT12 закрывается как implementation defect только если доказано:

```text
real customer action
→ real event
→ persisted event
→ aggregation
→ API
→ Analytics UI
```

Если pipeline архитектурно отсутствует, RT12 закрывается не как `fixed`, а как подтверждённый blocking Architecture Gap с отдельным следующим архитектурным этапом.





---

# RT13 — PARTNER PERFORMANCE CROSS-METRIC RECONCILIATION — P1

## Runtime observation

В `Partner Performance` обнаружены строки, где показатели требуют cross-metric reconciliation:

```text
Rashad Gasimov (Guide)
GMV                0
Платежи клиентов   0
Комиссия            0
Заказы              0
Бронирования        6
Completion          100.0%

Flame Country Excursions
GMV                0
Платежи клиентов   0
Комиссия            0
Заказы              0
Бронирования       15
Completion          —

Regional Transport AZ
GMV                0
Платежи клиентов   0
Комиссия            0
Заказы              0
Бронирования        6
Completion          100.0%

Nigar Hasanova (Guide)
GMV                0
Платежи клиентов   0
Комиссия            0
Заказы              0
Бронирования        7
Completion          50.0%

Elvin Mammadov (Guide)
GMV                0
Платежи клиентов   0
Комиссия            0
Заказы              0
Бронирования        7
Completion          100.0%
```

Само наличие `Bookings > 0` при `Orders = 0` не объявлять автоматически ошибкой. Оно допустимо только если canonical domain model и конкретные metric scopes это объясняют.

Однако одна строка `Partner Performance` не должна незаметно объединять показатели с несовместимыми:

- period semantics;
- status scopes;
- partner attribution;
- relationship paths;
- currency treatment;
- denominator/numerator cohorts.

## Critical mathematical check — Completion

Особенно проверить:

```text
Nigar Hasanova
Bookings = 7
Completion = 50.0%
```

Если `Completion` определяется как:

```text
Completed Bookings / displayed Bookings × 100
```

то ровно `50.0%` при denominator `7` математически невозможно:

```text
3 / 7 = 42.857...%
4 / 7 = 57.142...%
```

Следовательно, необходимо доказать одно из:

1. denominator Completion не равен displayed `Bookings`;
2. Completion использует другой cohort/status/period;
3. displayed Bookings и Completion имеют разные semantics;
4. formula/aggregation ошибочна;
5. rounding/aggregation происходит на другом уровне и это canonical;
6. другое — только с evidence.

Не исправлять значение до выяснения canonical formula.

## Required relationship trace

Для representative Partner rows проследить:

```text
Partner
   ↓
Booking
   ↓
Order
   ↓
Payment
   ↓
Commission / CommissionAccrual
```

Но не предполагать, что именно эта cardinality обязательна: сначала проверить реальные Prisma/entities/domain relationships.

Для каждого representative Partner доказать:

```text
source records
→ Orders
→ Bookings
→ Completed Bookings / completion numerator
→ Completion denominator
→ GMV
→ Customer Payments
→ Commission
→ API row
→ rendered table row
```

## Mandatory representative rows

Минимум проверить:

```text
Rashad Gasimov (Guide)
Regional Transport AZ
Nigar Hasanova (Guide)
Elvin Mammadov (Guide)
Flame Country Excursions
```

Дополнительно проверить `Nadirikon` / `Role Partner Demo` как zero-activity controls, если они существуют в runtime dataset.

## Orders = 0 while Bookings > 0

Установить, почему отображается:

```text
Orders = 0
Bookings > 0
```

Возможные причины должны быть подтверждены:

```text
Booking может существовать без Order
legacy/imported Booking
different period timestamp
different status scope
different partner attribution
query join defect
Order records отсутствуют
Booking relationship broken
другое
```

Если Booking по canonical model обязан иметь Order, `Bookings > 0 && Orders = 0` становится data/query integrity finding.

Если Booking действительно может существовать без Order, документировать это и убедиться, что UI semantics понятны.

## GMV = 0 while Bookings > 0

Установить canonical GMV semantics для Partner Performance.

Проверить:

- какой статус Booking/Order входит в GMV;
- используется ли completed/qualified/collected GMV;
- какой timestamp определяет period;
- как определяется partner attribution;
- может ли booking иметь zero price;
- существует ли booking без monetized order;
- влияет ли currency/FX gap RT10.

Не считать `GMV = 0` ошибкой только из-за наличия Bookings.

Но если `Completion = 100%` означает завершённые коммерческие бронирования, а GMV остаётся 0, требуется transaction-level proof.

## Customer Payments = 0

Для representative rows проверить реальные Payment records:

```text
partner/order/booking relation
status
amount
currency
timestamp
refund state
```

Если платежи существуют, но Partner Performance показывает 0 — найти query/scope defect.

Если платежей действительно нет — доказать это source evidence.

## Commission = 0

RT13 должен быть согласован с RT11.

Для representative Partner:

```text
Payment / commercial fact
→ canonical commission source
→ Partner attribution
→ period/status scope
→ Partner Performance Commission
```

Не выводить Commission из фиксированного процента без canonical source.

## Completion canonical contract

Установить точную formula и presentation contract:

```text
metric name
numerator
denominator
eligible statuses
period timestamp
partner attribution
null/zero-denominator behavior
rounding
unit: ratio or percentage
```

Обязательно определить, backend возвращает:

```text
0..1 ratio
```

или:

```text
0..100 percentage
```

и закрепить один API contract.

Defensive cap `<= 100` не должен скрывать неправильный numerator/denominator.

## Cross-metric period consistency

Для одной строки Partner Performance доказать, что все period-bound metrics используют один выбранный Analytics range, если business semantics не требуют иного.

Если metric использует другой event timestamp, это должно быть осознанно и документировано.

Пример:

```text
Orders             by order-created timestamp
Payments           by captured timestamp
Commission         by accrual timestamp
Completed Bookings by completion timestamp
```

Такая модель может быть canonical, но тогда cross-metric interpretation должна быть явно определена. Нельзя искусственно привязывать всё к одному timestamp только ради визуального совпадения.

## Cross-metric partner attribution

Проверить, что Partner attribution не различается случайно между:

```text
Order
Booking
Payment
Commission
```

Например, нельзя считать Booking по `booking.partnerId`, а Payments по другому join path, если это приводит к потере реальных связанных операций без архитектурного основания.

## Cross-metric currency semantics

RT13 зависит от RT10:

- native-currency Partner facts не raw-суммировать;
- если Partner Performance monetary columns представлены одним числом в AZN, доказать canonical reporting-currency conversion;
- если FX architecture отсутствует, не выдавать multi-currency Partner totals за полноценный AZN total.

## UI/i18n — Completion

`Completion` не должен оставаться English label в русской локали.

Но **не переводить механически до подтверждения semantics**.

После определения canonical formula выбрать точное русское название.

Если metric действительно означает долю завершённых бронирований, допустимый вариант:

```text
Доля завершённых
```

или другой термин из canonical glossary.

Canonical API field/identifier менять только если это необходимо по архитектуре; UI label должен идти через i18n.

Проверить все поддерживаемые локали проекта.

## Pagination consistency

RT13 должен выполняться вместе с RT9.

Проверить, что:

```text
filter/search/sort
→ server-side dataset
→ metric aggregation
→ pagination
```

а не:

```text
pagination
→ aggregation только текущих 20 строк
```

Page 1 и Page 2 не должны менять semantics metric calculation.

## Required source-to-UI reconciliation table

Для каждого representative Partner:

| Partner | Orders | Bookings | Completion Numerator | Completion Denominator | Completion | GMV | Payments | Commission | Reconciled |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|

Отдельно привести source identifiers/counts, достаточные для воспроизводимости.

## Required Completion formula evidence

Для минимум трёх строк, включая:

```text
Rashad Gasimov
Nigar Hasanova
Flame Country Excursions
```

показать:

```text
numerator = ?
denominator = ?
raw ratio = ?
API value = ?
UI value = ?
```

Для `Completion = —` доказать причину `null`/undefined/zero denominator.

## Required zero-monetary reconciliation

Для минимум двух Partner с:

```text
Bookings > 0
GMV = 0
Payments = 0
Commission = 0
```

показать реальные связанные source records и объяснить, почему monetary values равны нулю.

Если это defect — исправить root cause.

## RT13 tests

Добавить deterministic coverage для реально поддерживаемой semantics:

- `Bookings > 0`, `Orders = 0`;
- Completion denominator;
- non-integer percentage case;
- zero denominator → canonical null/`—`;
- Partner attribution;
- period boundary;
- monetary metric source;
- pagination does not alter aggregates;
- i18n label coverage.

Не писать тест, который просто закрепляет текущую ошибочную formula.

## RT13 outcome

Допустимы:

```text
A. Metrics semantically correct and fully reconciled
B. Query/formula/attribution defect found and fixed
C. Domain semantics insufficient/contradictory → Architecture Gap
```

Если `C`, не придумывать новый Partner Performance financial/domain contract внутри UI remediation.

Зафиксировать Architecture Gap и необходимое архитектурное решение.



# REQUIRED REPORT

Создать отчёт преимущественно на русском:

```text
1. Executive Summary
2. Baseline / SHA
3. Runtime Findings
4. RT1 Period Root Cause / Fix
5. RT2 Bar Chart Root Cause / Fix
6. RT3 Scale/Y-axis Fix
7. RT4 GMV Duplication
8. RT5 AOV Reconciliation
9. RT6 Customers Reconciliation
10. RT7 Commission Currency
11. RT8 Sessions/Telemetry Verification
12. RT9 Pagination Verification
13. RT10 Multi-Currency / Reporting Currency Verification
14. RT11 Commission Reconciliation / Semantics
15. RT12 Behavioral Telemetry / Zero-Event Verification
16. RT13 Partner Performance Cross-Metric Reconciliation
17. Completion Defensive-Cap Verification
18. Tests
19. API Evidence
20. Source Data Reconciliation
21. Browser Matrix
22. Screenshot Evidence
23. Residual Gaps
24. Final Verdict
```

Обязательная closure matrix:

| ID | Severity | Before | Root Cause | Fix | Test Evidence | Runtime Evidence | Status |
|---|---|---|---|---|---|---|---|

Включить `RT1–RT13`.

---

# ACCEPTANCE CRITERIA

- [ ] 7 дней → корректный chart range
- [ ] 30 дней → корректный chart range
- [ ] 6 месяцев → корректный chart range
- [ ] API from/to соответствует PeriodSelector
- [ ] first/last bucket внутри выбранного range
- [ ] granularity не меняет range
- [ ] Orders visualization — реальный proportional bar chart
- [ ] Y-axis начинается с 0 и читаема
- [ ] tooltip показывает bucket + value
- [ ] X-axis соответствует selected period
- [ ] zero buckets корректны
- [ ] Orders buckets reconciled с source/headline при одинаковой semantics
- [ ] duplicate Completed GMV устранён
- [ ] AOV доказан либо исправлен
- [ ] Customers независимо reconciled
- [ ] Commission имеет корректный currency display
- [ ] Sessions=0 доказан либо исправлен
- [ ] Partner Performance при 33 records реально paginated
- [ ] page 1 ≤20, page 2 = remainder
- [ ] pagination server-side
- [ ] доказано, существуют ли реальные EUR/USD Payment records
- [ ] доказано происхождение EUR/USD Financial Summary
- [ ] проверено наличие/отсутствие canonical FX infrastructure
- [ ] raw amounts разных currencies нигде не суммируются
- [ ] если FX architecture существует — headline totals корректно reconciled в AZN
- [ ] если FX architecture отсутствует — RT10 оформлен как blocking Architecture Gap без ad-hoc FX implementation
- [ ] native-currency Financial Summary сохранена
- [ ] historical FX reproducibility проверена либо явно признана отсутствующей
- [ ] определена точная semantics `Financial Summary → Commission`
- [ ] определён canonical source Commission
- [ ] AZN Commission reconciled source → API → UI
- [ ] EUR Commission reconciled source → API → UI
- [ ] USD Commission reconciled source → API → UI
- [ ] проверены partner-specific commission rules/rates
- [ ] проверен Refund/reversal effect на Commission
- [ ] проверен Commission status scope
- [ ] проверен Commission period timestamp
- [ ] Commission разных currencies не raw-суммируется
- [ ] headline Commission согласована с RT10 reporting-currency contract
- [ ] Commission не объявлена автоматически полным Platform Revenue
- [ ] установлена причина `Product Impression = 0`
- [ ] установлена причина `Product Viewed = 0`
- [ ] установлена причина `Checkout Started = 0`
- [ ] установлена причина `Sessions = 0`
- [ ] behavioral stages классифицированы как EVENT_NOT_EMITTED / NOT_PERSISTED / NOT_AGGREGATED / FILTER/SCOPE/MAPPING BUG / TRUE_ZERO / другое с evidence
- [ ] выполнен end-to-end telemetry trace
- [ ] для существующих behavioral events выполнен real browser BEFORE/ACTION/AFTER proof
- [ ] fake behavioral events из Orders не создаются
- [ ] historical telemetry не фабрикуется
- [ ] если telemetry architecture отсутствует — оформлен отдельный blocking Architecture Gap
- [ ] raw English activity stage labels не отображаются в русской локали
- [ ] stage labels используют i18n, а canonical event identifiers сохранены
- [ ] reconciled Partner Performance для Rashad Gasimov
- [ ] reconciled Partner Performance для Regional Transport AZ
- [ ] reconciled Partner Performance для Nigar Hasanova
- [ ] reconciled Partner Performance для Elvin Mammadov
- [ ] reconciled Partner Performance для Flame Country Excursions
- [ ] объяснено `Bookings > 0 && Orders = 0`
- [ ] доказана canonical Completion formula
- [ ] математически объяснено `Bookings = 7 && Completion = 50.0%`
- [ ] доказано поведение `Completion = —`
- [ ] доказано происхождение `GMV = 0` при Bookings > 0
- [ ] доказано происхождение `Payments = 0` при Bookings > 0
- [ ] доказано происхождение `Commission = 0` при Bookings > 0
- [ ] Partner attribution согласована между Order/Booking/Payment/Commission
- [ ] Partner Performance monetary columns согласованы с RT10 FX contract
- [ ] Partner Performance Commission согласована с RT11
- [ ] pagination не изменяет aggregation semantics
- [ ] `Completion` локализован после подтверждения точной semantics
- [ ] Completion cap не скрывает ошибочную formula
- [ ] tests/typecheck/build PASS
- [ ] browser matrix выполнена
- [ ] screenshots приложены
- [ ] отчёт преимущественно на русском
- [ ] Step 3.12 не начат

---

# VERDICT RULE

Положительный verdict текущего Round допустим только после реального runtime evidence.

Если RT10 подтверждает реальные EUR/USD операции, а корректной historical FX/reporting-currency architecture нет, нельзя объявлять Analytics полностью multi-currency re-qualified. В этом случае verdict должен явно фиксировать blocking architecture dependency и необходимость отдельного FX Architecture Amendment до окончательного PRE-STEP closure.

Если RT11 не может доказать canonical Commission semantics либо Financial Summary Commission не reconciles с canonical source, нельзя объявлять Financial Summary полностью re-qualified. Сначала требуется устранить formula/query defect либо оформить отдельный Finance Architecture Gap.

Если RT12 подтверждает, что behavioral telemetry для Sessions/Product Impression/Product Viewed/Checkout Started архитектурно отсутствует, нельзя объявлять behavioral/customer-journey Analytics полностью re-qualified. Не фабриковать данные: требуется отдельный Behavioral Telemetry / Customer Journey Architecture Amendment либо явно ограниченный следующий stage.

Если RT13 не может reconciliate Partner Performance cross-metrics, особенно `Bookings > 0 / Orders = 0 / monetary = 0` и Completion numerator/denominator, Partner Performance нельзя считать runtime re-qualified. Исправить query/formula/attribution defect либо оформить подтверждённый Domain/Architecture Gap.



```text
VERDICT A — ANALYTICS TARGETED RUNTIME REMEDIATION ROUND 2 APPROVED
```

Если runtime defect остаётся:

```text
VERDICT B — ANALYTICS TARGETED RUNTIME REMEDIATION ROUND 2 INCOMPLETE
```

Если code/tests проходят, но browser/data evidence недостаточно:

```text
VERDICT C — ANALYTICS RUNTIME RE-QUALIFICATION INSUFFICIENT
```

---

# STRICT REVIEW PAIRING / STOP CONDITION

После developer remediation PRE-STEP 3.12 ещё не считать окончательно закрытым. Следующий отдельный этап:

```text
STRICT RUNTIME RE-QUALIFICATION
```

Только после него возможен окончательный Analytics closure.

После текущего задания:

1. завершить targeted fixes;
2. выполнить tests/build;
3. выполнить API/source reconciliation;
4. выполнить browser matrix;
5. приложить screenshot evidence;
6. создать Remediation Report;
7. указать реальные Starting/Remediation/Final/origin SHA;
8. выдать verdict;
9. не начинать отдельный Strict Review автоматически;
10. **DO NOT AUTO-START Step 3.12 — Users & Access Completion**;
11. остановиться и дождаться следующей команды.
