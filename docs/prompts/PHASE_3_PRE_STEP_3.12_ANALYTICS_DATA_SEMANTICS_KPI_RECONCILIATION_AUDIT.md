# PHASE 3 — PRE-STEP 3.12 — ANALYTICS DATA SEMANTICS & KPI RECONCILIATION AUDIT

## STATUS / BASELINE

Текущий подтверждённый baseline:

```text
Starting SHA: 7d30da7
```

Предыдущий этап:

```text
PHASE 3 — PRE-STEP 3.12 — ANALYTICS NAVIGATION IA — ROUND 2
VERDICT A — COMMAND CENTER AND ANALYTICS IA SEPARATION APPROVED
```

Подтверждённая IA:

```text
/app/command-center → «Рабочий стол» → оперативный dashboard
/app/analytics      → «Аналитика»    → глубокий анализ
CRM → Аналитика     → контекстная CRM analytics
```

Этот audit **не пересматривает VERDICT A по IA**, если не будет обнаружено отдельного архитектурного нарушения.

Цель текущего этапа — проверить, что цифры и показатели новой страницы `/app/analytics` имеют корректную, непротиворечивую и доказуемую бизнес-семантику.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые или обновляемые отчёты и текстовая документация по этой задаче должны быть преимущественно **на русском языке**.

Это относится к:

- Audit Report;
- Evidence Report;
- Gap Audit;
- findings;
- root cause analysis;
- architecture decisions;
- security/governance findings;
- runtime/data evidence descriptions;
- conclusions;
- recommendations;
- verdict explanations.

Английский допустим только для технических идентификаторов:

- file paths;
- class / method / DTO / model / table names;
- API endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- commit messages;
- enums;
- permission identifiers;
- code snippets;
- стандартизированных строк `VERDICT`.

**Hard acceptance criterion:** если итоговый отчёт преимущественно написан на английском, задача считается незавершённой и отчёт должен быть исправлен до финального verdict.

---

# 1. MODE — AUDIT ONLY

Это **READ-ONLY / AUDIT-ONLY** этап.

Запрещено в рамках данного задания:

- исправлять формулы;
- менять backend;
- менять frontend;
- менять Prisma schema;
- создавать migrations;
- менять seed;
- переименовывать KPI;
- менять API contracts;
- исправлять funnel;
- исправлять percentage formatting;
- менять Finance semantics;
- менять canonical roadmap как будто remediation уже выполнена;
- начинать Step 3.12.

Сначала требуется установить фактическую причину каждого обнаруженного несоответствия.

После audit должен быть отдельный remediation prompt, если findings подтвердятся.

---

# 2. WHY THIS AUDIT IS REQUIRED

После появления отдельной страницы `/app/analytics` runtime показывает следующие значения.

## Headline KPI

```text
GMV                     11 296,26 AZN
Выручка                 18 594,91 AZN
Чистая выручка          17 738,04 AZN
Комиссия                 1 001,84
Заказы                         214
Бронирования                   122
Средний чек                118,91 AZN
Возвраты                    856,87 AZN
Сессии                          18
Клиенты                        129
Партнёры                        33
Квалифицированный GMV      14 437,86 AZN
Завершённый GMV            11 296,26 AZN
Собранный GMV              13 149,54 AZN
Незакрытый GMV              1 288,32 AZN
```

## Funnel

```text
Product Impression       996
Product Viewed             9
Checkout Started           0
Order Created            214
Payment Succeeded        137
Booking Confirmed         29
Booking Completed         73
```

## Financial Summary — AZN

```text
Payments      18 594,91
Refunds          856,87
Net           17 738,04
Commission     1 001,84
```

Также таблица содержит как минимум:

```text
EUR Payments      124,32
USD Payments   10 533,34
```

## Partner Performance

Runtime содержит значения `Completion`, например:

```text
20 000%
10 000%
40 000%
23 333%
35 000%
```

Также встречаются отношения:

```text
Orders = 0
Bookings > 0
```

и:

```text
Bookings > Orders
```

---

# 3. KNOWN OBSERVATIONS — DO NOT ASSUME ROOT CAUSE

Следующие факты являются основанием для проверки, но **не должны автоматически трактоваться как доказанная ошибка реализации**.

### Observation A

```text
Revenue = 18 594,91
AZN Payments = 18 594,91
```

### Observation B

```text
Net Revenue = 17 738,04

18 594,91 - 856,87 = 17 738,04
```

То есть headline `Revenue` и `Net Revenue` визуально совпадают с:

```text
Payments
Payments - Refunds
```

Необходимо установить, является ли это намеренной каноничной семантикой или ошибочным смешением Customer Payments и Platform Revenue.

### Observation C

```text
GMV = Completed GMV = 11 296,26
```

Необходимо доказать, является ли headline GMV намеренно `Completed GMV`, либо общий GMV рассчитывается неверно/назван неверно.

### Observation D

Funnel не является монотонным:

```text
Product Viewed       9
Checkout Started     0
Order Created      214
```

и:

```text
Booking Confirmed   29
Booking Completed   73
```

Необходимо определить, является ли это:

- настоящей cohort funnel;
- независимыми event counters;
- смешением transactional и behavioral data;
- period mismatch;
- incomplete telemetry;
- seed/test data artifact;
- другой семантикой.

### Observation E

`Completion` > 100% на несколько порядков.

Нужно проверить unit contract:

```text
0.20 → 20%
```

vs

```text
20 → 20%
```

и определить, где именно возникает multiplication/formatting error, если он существует.

### Observation F

Сумма предоставленного daily series по Orders за август равна:

```text
214
```

что совпадает с headline:

```text
Orders = 214
```

Это является положительным reconciliation signal и должно быть подтверждено из источника данных.

---

# 4. PRIMARY AUDIT QUESTION

Для **каждого** KPI и аналитического блока необходимо ответить:

```text
Что именно измеряется?
Из какой canonical entity / projection берутся данные?
Какая точная server-side формула?
Какой временной scope?
Какой tenant/workspace scope?
Какая currency semantics?
Какие статусы включены?
Какие статусы исключены?
Как обрабатываются refunds/cancellations?
Как UI форматирует результат?
Совпадает ли UI label с фактической бизнес-семантикой?
```

---

# 5. KPI SEMANTICS MATRIX — MANDATORY

Создать полную таблицу минимум для:

```text
GMV
Revenue
Net Revenue
Commission
Orders
Bookings
AOV
Refunds
Sessions
Customers
Partners
Qualified GMV
Completed GMV
Collected GMV
Open GMV
```

Формат:

| KPI | UI Label | API Field | Canonical Source | Exact Formula | Included Statuses | Period Field | Currency | Actual Semantics | Verdict |
|---|---|---|---|---|---|---|---|---|---|

Допустимые verdict для каждой строки:

```text
EXISTS / CORRECT
PARTIAL
MISSING
NEEDS EXTENSION
CONFLICT
MISLABELLED
UNVERIFIABLE
```

Для каждого `CONFLICT`, `MISLABELLED` или `UNVERIFIABLE` дать evidence.

---

# 6. GMV RECONCILIATION

Проверить полный lifecycle GMV.

Минимум:

```text
Qualified GMV
Collected GMV
Completed GMV
Open GMV
headline GMV
```

Для каждого определить:

- canonical source;
- exact status predicate;
- relation to Order;
- relation to Booking;
- relation to Payment;
- relation to fulfillment/completion;
- effect of cancellation;
- effect of refund;
- period timestamp used.

Проверить числовые отношения:

```text
Qualified GMV = 14 437,86
Collected GMV = 13 149,54
Completed GMV = 11 296,26
Open GMV      =  1 288,32
```

Не придумывать ожидаемое равенство, если архитектура его не требует.

В отчёте явно показать, какие algebraic invariants действительно должны выполняться согласно коду/архитектуре.

---

# 7. PLATFORM REVENUE VS CUSTOMER PAYMENTS — CRITICAL

Это критический архитектурный вопрос.

Проверить фактическую реализацию:

```text
Customer Payments
Platform Revenue
Commission
Net Revenue
Refunds
Seller Entitlement
```

Не считать автоматически:

```text
Customer Payment = Platform Revenue
```

Нужно установить, что в текущем коде означает `revenue`.

Проверить:

- analytics service;
- Finance projections;
- Payment aggregate;
- Commission / CommissionAccrual;
- Settlement;
- Order amounts;
- Refund;
- payout-related models, если они участвуют;
- roadmap/architecture definitions.

В отчёте отдельно дать:

```text
CURRENT IMPLEMENTATION SEMANTICS
```

и:

```text
CANONICAL / INTENDED SEMANTICS
```

если они отличаются.

---

# 8. FINANCIAL ARCHITECTURE INVARIANT — VERIFY, DO NOT IMPLEMENT

Проверить, поддерживает ли текущая архитектура принцип:

```text
Деньги, полученные от клиента
≠ автоматически доход Platform
```

Концептуально:

```text
Customer funds received
        ↓
Platform economic share
Seller entitlement
Refunds / adjustments
Fees / other components
```

Критический invariant для проверки:

> Seller funds / Seller Payables не должны становиться Platform Revenue только потому, что средства временно находятся под контролем TravelHub.

Не реализовывать новый accounting model в рамках audit.

Если текущая реализация нарушает этот принцип — классифицировать как:

```text
DOMAIN GAP
ARCHITECTURE GAP
FINANCE SEMANTICS GAP
ANALYTICS GAP
ROADMAP GAP
```

и вынести в remediation / Finance Architecture Amendment.

---

# 9. FINANCIAL SUMMARY RECONCILIATION

Для каждой currency проверить:

```text
Payments
Refunds
Net
Commission
```

Установить точные формулы.

Проверить как минимум runtime values:

```text
AZN
Payments      18 594,91
Refunds          856,87
Net           17 738,04
Commission     1 001,84

EUR
Payments         124,32
Refunds            0
Net              124,32
Commission        36,85

USD
Payments      10 533,34
Refunds            0
Net           10 533,34
Commission       912,68
```

Ответить:

- почему headline Revenue показывает `18 594,91`;
- является ли headline currency только `AZN`;
- существует ли reporting currency;
- выполняется ли FX conversion;
- игнорируются ли EUR/USD в headline;
- если headline intentionally AZN-only — явно ли это обозначено пользователю.

---

# 10. MULTI-CURRENCY CONTRACT — MANDATORY

Проверить текущий контракт multi-currency analytics.

Недопустимо без явной FX policy делать:

```text
AZN + USD + EUR
```

как одну денежную сумму.

Определить, используется ли:

1. native-currency breakdown;
2. reporting/base currency;
3. FX snapshot;
4. current FX;
5. отсутствие aggregation.

Если reporting currency существует — доказать:

- источник FX;
- timestamp FX;
- rounding;
- storage/projection;
- currency label.

Если отсутствует — зафиксировать gap, но не реализовывать.

---

# 11. AOV / СРЕДНИЙ ЧЕК

Проверить:

```text
AOV = 118,91 AZN
```

Установить denominator и numerator.

Возможные варианты нельзя угадывать:

```text
GMV / Orders
Payments / Orders
Completed GMV / completed Orders
Revenue / Orders
```

Нужно доказать фактическую формулу из кода.

Также проверить:

- cancelled Orders;
- zero-value Orders;
- refunded Orders;
- multi-currency;
- selected period.

UI label `Средний чек` должен соответствовать реальной формуле.

---

# 12. ORDERS / BOOKINGS RECONCILIATION

Проверить:

```text
Orders   = 214
Bookings = 122
```

Определить:

- timestamp used for period;
- included statuses;
- relationship `Order → Booking`;
- допускается ли `1 Order → N Bookings`;
- допускаются ли legacy/standalone Bookings;
- как считаются bookings created outside current Order period.

Проверить partner rows, где:

```text
Orders = 0
Bookings > 0
```

и:

```text
Bookings > Orders
```

Не объявлять это ошибкой без проверки domain relationship и period semantics.

---

# 13. FUNNEL AUDIT — BLOCKING

Проверить каждый stage:

```text
Product Impression
Product Viewed
Checkout Started
Order Created
Payment Succeeded
Booking Confirmed
Booking Completed
```

Для каждого дать:

| Stage | Source | Event/Entity | Unique by | Timestamp | Period Scope | Can Skip Previous Stage? |
|---|---|---|---|---|---|---|

Главный вопрос:

**Является ли этот UI настоящей conversion funnel?**

Если да, доказать cohort semantics.

Если нет и это независимые activity counters — название `Воронка конверсии` является семантически неверным.

Проверить:

```text
0 Checkout Started
214 Order Created
```

и:

```text
29 Booking Confirmed
73 Booking Completed
```

Установить root cause, а не просто исправить числа.

---

# 14. BEHAVIORAL TELEMETRY VS TRANSACTIONAL DATA

Особенно проверить:

```text
Sessions           18
Product Viewed      9
Orders             214
```

Установить:

- источник Sessions;
- источник Product Viewed;
- источник Orders;
- покрывает ли telemetry все способы создания Order;
- входят ли seed/test/API-created records;
- является ли выбранный dataset representative;
- можно ли на основании этих данных рассчитывать conversion.

Если telemetry неполная — явно классифицировать соответствующие funnel/conversion KPI как недостоверные для production analytics.

---

# 15. CUSTOMERS KPI

Проверить:

```text
Customers = 129
```

Необходимо точно установить, что считается `Customer`.

Разделить понятия:

```text
Registered Users
Customers with ≥1 Order
Customers with ≥1 Booking
Active Customers
New Customers in period
Returning Customers
```

Не менять `UserStatus`.

Коммерческая активность пользователя и account lifecycle являются разными измерениями.

В отчёте указать точную текущую semantics `Customers = 129`.

---

# 16. PARTNERS KPI

Проверить:

```text
Partners = 33
```

Установить:

- все Partner records;
- active partners;
- partners with Orders in period;
- partners with Bookings in period;
- partners with GMV;
- другой predicate.

UI label должен соответствовать фактическому predicate.

---

# 17. PARTNER PERFORMANCE RECONCILIATION

Для каждой строки partner performance проверить происхождение:

```text
GMV
Revenue
Commission
Orders
Bookings
Completion
```

Особенно проверить, совпадает ли агрегат partner rows с headline totals там, где это должно быть математически верно.

Если не должно — объяснить почему.

Проверить partner attribution:

```text
Order.partnerId
Booking.partnerId
Payment.partnerId
Commission partner scope
```

или фактические эквиваленты текущей схемы.

---

# 18. COMPLETION PERCENTAGE — CRITICAL

Runtime содержит:

```text
10 000%
20 000%
23 333%
35 000%
40 000%
```

Установить:

1. backend raw value;
2. API serialized value;
3. frontend value;
4. formatter;
5. expected unit.

Проверить double multiplication:

```text
backend returns 20
frontend treats as 0–1 fraction
frontend displays 20 × 100 = 2000%
```

или другой root cause.

Также установить **семантику Completion**:

```text
completed bookings / all bookings?
completed orders / all orders?
fulfilled / confirmed?
другое?
```

Нельзя исправлять formatter до определения canonical formula.

---

# 19. TIME SERIES RECONCILIATION

Проверить `Динамика — DAY`.

Требуется установить:

- какая metric отображается;
- почему UI не сообщает metric явно;
- source;
- date field;
- timezone;
- grouping;
- zero-fill behavior;
- selected period.

Подтвердить или опровергнуть:

```text
SUM(daily series) = Orders KPI = 214
```

Если series является Orders series, зафиксировать необходимость понятного UI label как отдельный UI finding, но не исправлять сейчас.

---

# 20. PERIOD / TIMEZONE CONTRACT

Для всех KPI проверить единый temporal contract.

Минимум:

```text
from
to
timezone
groupBy
comparison period
```

Проверить, что:

- headline KPI;
- funnel;
- partner performance;
- financial summary;
- time series

используют одинаково интерпретируемый selected period либо явно документируют различия.

Особое внимание:

- `createdAt` vs `completedAt`;
- payment timestamp;
- refund timestamp;
- booking confirmation/completion timestamp;
- UTC vs workspace timezone.

---

# 21. DATASET / SEED / TEST DATA

Установить происхождение runtime dataset.

Классифицировать:

```text
representative
synthetic but internally coherent
synthetic and intentionally cross-period
legacy-contaminated
insufficient for analytics verification
```

Не списывать противоречия автоматически на seed.

Если seed создаёт невозможную business state, это отдельный DATA QUALITY GAP.

---

# 22. SOURCE-OF-TRUTH TRACE

Для каждого ключевого KPI предоставить trace:

```text
UI component
    ↓
frontend API client
    ↓
HTTP endpoint
    ↓
controller
    ↓
service/query
    ↓
Prisma/entity/table
    ↓
formula/status predicate
```

Не ограничиваться названием функции.

Для спорных KPI привести конкретные relevant code references.

---

# 23. API CONTRACT AUDIT

Проверить существующие `analytics/*` endpoints, которые были подключены frontend в Round 2.

Для каждого endpoint указать:

- route;
- request params;
- response DTO;
- permissions;
- workspace scope;
- period;
- currency;
- comparison behavior;
- data source;
- semantic owner.

Проверить, не был ли API ранее предназначен для другого UI/context и теперь механически подключён к новой Analytics page без semantic reconciliation.

---

# 24. COMMAND CENTER VS ANALYTICS DATA OWNERSHIP

Не возвращать Analytics обратно в Command Center.

Но проверить shared data contract:

```text
Analytics Engine
      │
      ├ Command Center → summary / operational projection
      ├ Analytics      → deep analytical projection
      └ Domain Centers → local process analytics
```

Если обе страницы используют одну metric, она должна иметь одну canonical definition.

Нельзя допускать:

```text
GMV on Dashboard = formula A
GMV on Analytics = formula B
```

без явного semantic distinction.

---

# 25. GAP CLASSIFICATION

Каждый finding классифицировать минимум одним типом:

```text
UI GAP
DATA SEMANTICS GAP
DOMAIN GAP
ANALYTICS GAP
FINANCE SEMANTICS GAP
ARCHITECTURE GAP
DATA QUALITY GAP
SECURITY / GOVERNANCE GAP
ROADMAP GAP
DEFERRED
BLOCKING
```

Также severity:

```text
P0
P1
P2
P3
```

---

# 26. SPECIAL FINANCE FINDINGS TO PRESERVE

Audit должен учитывать, но **не реализовывать**, уже выявленную необходимость дальнейшего Finance architecture:

```text
Payment
≠ Platform Revenue

Settlement
≠ Payment

Payout
≠ Customer Payment

Seller Entitlement
≠ Platform Revenue
```

Также будущая Finance architecture должна отдельно учитывать:

```text
Total Seller Liability
Available for Payout
Held / Reserved
Scheduled Payouts
In-Process Payouts
Overdue Payouts
Payout Forecast
Payout History
Payables Aging
Partner-level Balance
Trusted / Standard / Custom payout policy
Completion-triggered release
Refund / negative balance adjustments
```

И будущий Finance Overview должен концептуально различать:

```text
1. Cash Position
2. Platform P&L
3. Seller Liabilities / Payables
```

Но этот audit не должен преждевременно реализовывать эти capabilities.

Если текущая Analytics page уже смешивает эти понятия — это finding.

---

# 27. REQUIRED RECONCILIATION TABLES

Audit Report должен содержать минимум следующие таблицы.

## A. KPI Semantics Matrix

Все headline KPI.

## B. Financial Reconciliation

```text
Payments
Refunds
Net
Commission
Revenue
Net Revenue
```

по валютам.

## C. GMV Reconciliation

```text
Qualified
Collected
Completed
Open
Headline GMV
```

## D. Funnel Stage Matrix

Все stages и их source/cohort semantics.

## E. Partner Aggregation Reconciliation

Сопоставление partner rows с platform totals.

## F. Time Series Reconciliation

Сопоставление daily values с headline metric.

## G. Findings Register

```text
ID
Severity
Category
Observed
Expected/Canonical
Root Cause
Evidence
Recommended Next Action
```

---

# 28. RUNTIME / DATA EVIDENCE

Хотя это audit, claims о фактическом UI/runtime должны быть проверены в работающем приложении.

Зафиксировать:

```text
git rev-parse HEAD
git rev-parse origin/master
```

Оба должны соответствовать baseline либо явно объяснить изменение.

Проверить browser ADMIN:

- `/app/analytics`;
- выбранный period;
- headline KPI;
- funnel;
- time series;
- partner performance;
- financial summary.

Для спорных значений сопоставить:

```text
Browser value
API response
Backend calculation
DB/source records
```

Не считать screenshot единственным доказательством корректности данных.

---

# 29. NO FALSE RECONCILIATION

Запрещено искусственно объявлять данные согласованными только потому, что отдельные числа совпали.

Например:

```text
Revenue == Payments
```

может означать как правильную реализацию текущего contract, так и неправильную semantic definition.

Audit должен отвечать на вопрос:

```text
Совпадают ли не только числа,
но и бизнес-смысл?
```

---

# 30. REQUIRED FINAL REPORT STRUCTURE

Создать отдельный Audit Report со структурой:

```text
1. Executive Summary
2. Baseline / SHA
3. Runtime Dataset
4. KPI Semantics Matrix
5. GMV Reconciliation
6. Revenue / Payment / Refund / Commission Reconciliation
7. Multi-Currency Audit
8. AOV Audit
9. Orders / Bookings Reconciliation
10. Funnel Audit
11. Behavioral Telemetry Audit
12. Customers / Partners Semantics
13. Partner Performance Audit
14. Completion Percentage Root Cause
15. Time Series / Period / Timezone Audit
16. Source-of-Truth Trace
17. Findings Register
18. Architecture Conflicts
19. Recommended Remediation Scope
20. Final Verdict
```

---

# 31. ACCEPTANCE CRITERIA FOR THIS AUDIT

Audit считается завершённым только если:

- [ ] определена semantics каждого headline KPI;
- [ ] доказана формула каждого headline KPI;
- [ ] проверены GMV variants;
- [ ] установлена причина `Revenue == Payments`;
- [ ] установлена причина `Net Revenue == Payments - Refunds`;
- [ ] проверена Platform Revenue semantics;
- [ ] проверена multi-currency semantics;
- [ ] доказана AOV formula;
- [ ] проверены Orders/Bookings;
- [ ] установлена реальная semantics funnel;
- [ ] объяснены non-monotonic funnel stages;
- [ ] проверена telemetry completeness;
- [ ] определено значение Customers;
- [ ] определено значение Partners;
- [ ] установлен root cause Completion >100%;
- [ ] reconciled partner performance;
- [ ] reconciled daily series;
- [ ] проверены period/timezone contracts;
- [ ] все findings классифицированы;
- [ ] remediation не выполнялась;
- [ ] Step 3.12 не запускался;
- [ ] отчёт преимущественно на русском.

---

# 32. FINAL VERDICT

Этот audit **не должен получать VERDICT A только потому, что tests/build проходят**.

Допустимые финальные результаты:

### Если semantics и данные доказуемо корректны

```text
VERDICT A — ANALYTICS DATA SEMANTICS & KPI RECONCILIATION APPROVED
```

### Если найдены реальные несоответствия

```text
VERDICT B — ANALYTICS DATA / KPI REMEDIATION REQUIRED
```

с полным Findings Register.

### Если данных недостаточно

```text
VERDICT C — ANALYTICS DATA SEMANTICS NOT SUFFICIENTLY VERIFIABLE
```

с перечнем отсутствующего evidence.

---

# 33. ROADMAP / NEXT STAGE RULE

`Canonical NEXT: Step 3.12 — Users & Access Completion` не означает автоматический старт.

Если audit выдаёт `VERDICT B`, сначала подготовить отдельный remediation scope.

Если findings требуют изменения фундаментальной Finance semantics:

```text
Architecture Amendment
+
additive Canonical Roadmap Sync
```

должны быть предложены отдельно, с сохранением истории и реальными commit SHA.

Не переписывать историю roadmap.

---

# 34. STOP CONDITION

После завершения audit:

1. сохранить Audit Report;
2. commit report/evidence только если это соответствует принятому repository workflow;
3. указать реальные SHA;
4. выдать final verdict;
5. **НЕ ИСПРАВЛЯТЬ findings в этом же этапе**;
6. **НЕ НАЧИНАТЬ Step 3.12**;
7. дождаться отдельной команды.
