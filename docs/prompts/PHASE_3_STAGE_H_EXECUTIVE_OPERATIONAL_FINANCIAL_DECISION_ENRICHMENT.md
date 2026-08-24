# PHASE 3 --- STAGE H

# EXECUTIVE / OPERATIONAL / FINANCIAL DECISION ENRICHMENT

## IMPLEMENTATION PROMPT --- CANONICAL FINANCIAL SEMANTICS PRESERVATION

------------------------------------------------------------------------

## 1. ЯЗЫК ОТВЕТА

Все ответы разработчика, анализ, findings, таблицы, evidence, отчёты и
финальный VERDICT --- **НА РУССКОМ ЯЗЫКЕ**.

Код, identifiers, enums, paths, commands, SHA и commit messages можно
сохранять в оригинале.

------------------------------------------------------------------------

# 2. ENTRY STATUS

``` text
Stage C — WHAT                         COMPLETE
Stage D — WHY                          COMPLETE
Stage E — IMPACT                       COMPLETE
Stage F — ACTION                       COMPLETE
Stage G — AI Decision Feed             COMPLETE

Decision Loop                          CLOSED
Financial No-Fabrication               CLOSED
AI Feed / ACTION authority separation  VERIFIED

Stage H                                IMPLEMENT NOW
Stage I/J                              DO NOT START
```

------------------------------------------------------------------------

# 3. ЦЕЛЬ STAGE H

Обогатить Executive / Operational / Financial части Command Center так,
чтобы руководитель видел не просто isolated KPIs, а **доказуемую
структуру бизнеса и финансового состояния**, пригодную для принятия
решений.

Stage H должен добавлять только те показатели/разрезы, которые:

-   имеют чёткую business definition;
-   вычисляются из authoritative data;
-   reconciliation DB → API → UI доказуем;
-   не дублируют существующие KPI без дополнительного смысла;
-   не создают fabricated forecasts;
-   соблюдают PLATFORM/PARTNER/Storefront semantics.

------------------------------------------------------------------------

# 4. НЕ НАЧИНАТЬ С КОДА

Сначала провести аудит:

``` text
canonical roadmap Stage H
current Executive section
current Operational section
current Financial section
existing analytics/dashboard services
Order/Payment/Refund/Commission models
Storefront subscription/billing models
existing KPI definitions
existing date authority
existing currency authority
```

Сначала вернуть gap matrix, затем реализовать только подтверждённый
Stage H scope.

------------------------------------------------------------------------

# 5. FINANCIAL SEMANTICS --- FROZEN CONTRACT

Не переопределять без отдельного architecture decision.

## GMV

Canonical qualified GMV:

``` text
SUM(Order.amount)
WHERE Order.status NOT IN (NEW, CANCELLED)
```

Это value of qualified order cohort.

GMV ≠ Revenue.

------------------------------------------------------------------------

## Collected GMV / Оплачено по GMV

``` text
SUM(Order.paidAmount)
WHERE order belongs to qualified GMV cohort
```

COHORT-based.

Не заменять на Payment Volume.

------------------------------------------------------------------------

## Outstanding / Остаток к оплате

Exact authority:

``` text
MAX(0, Qualified GMV - Collected GMV)
```

Refund не создаёт автоматически новое customer obligation.

Exact values остаются authoritative.

Presentation может использовать ранее утверждённый reconciled integer
display policy.

------------------------------------------------------------------------

## Completed GMV / Исполненный GMV

``` text
SUM(Order.amount)
WHERE status IN (FULFILLED, CLOSED)
```

------------------------------------------------------------------------

## Payment Volume / Объём платежей

``` text
SUM(Payment.amount)
WHERE status = CAPTURED
AND paidAt within event period
```

EVENT-PERIOD metric.

Поэтому:

``` text
Payment Volume > GMV
```

может быть корректно из-за различия cohort/event semantics.

Не «исправлять» это искусственно.

------------------------------------------------------------------------

## Refunds

Использовать существующую canonical processed-refund authority.

Не вычитать refunds из GMV автоматически.

Не создавать новый Outstanding из refund.

------------------------------------------------------------------------

## Commission

Использовать существующую canonical commission authority.

Known limitation:

``` text
commission reversal → NOT IMPLEMENTED
```

Это отдельный Stage 2.14.x scope.

Stage H не должен скрывать это ограничение или изображать net commission
как fully reversed truth.

------------------------------------------------------------------------

# 6. CURRENCY AUTHORITY

Platform Reporting Currency:

``` text
AZN
```

User-facing:

``` text
₼
```

Запрещён unintended fallback:

``` text
USD
$
```

Currency должна приходить из authoritative DTO/metric contract, а не
случайного frontend default.

------------------------------------------------------------------------

# 7. DATE AUTHORITY --- ОБЯЗАТЕЛЬНО

Для каждого нового показателя документировать:

``` text
metric
date field
period type
COHORT / EVENT_PERIOD / SNAPSHOT
timezone
comparison period
```

Не смешивать в одной формуле:

``` text
Order.createdAt
Payment.paidAt
Refund.processedAt
```

без явного business rationale.

------------------------------------------------------------------------

# 8. STAGE H TARGET MODEL

Stage H должен проверить необходимость enrichment минимум в трёх
областях:

``` text
A. Executive
B. Operational
C. Financial
```

Не считать, что каждая область обязательно требует новых карточек.

Если существующая метрика уже достаточна --- сохранить её.

------------------------------------------------------------------------

# 9. EXECUTIVE ENRICHMENT

Проверить необходимость executive decision structure вокруг:

``` text
Qualified GMV
Collected GMV
Outstanding
Completed GMV
Payment Volume
Refunds
Commission / platform earnings authority
Orders
Bookings
AOV
Conversion
```

Цель --- не увеличить количество KPI, а сделать executive picture
логически непротиворечивой.

------------------------------------------------------------------------

# 10. EXPECTED / COLLECTED / OUTSTANDING --- СНАЧАЛА SEMANTIC AUDIT

Canonical roadmap может использовать понятия:

``` text
Expected
Collected
Outstanding
```

Нельзя автоматически назвать Qualified GMV `Expected Revenue`.

Проверить, что именно Stage H подразумевает под Expected.

Возможные значения должны быть квалифицированы:

``` text
Expected order value
Expected platform commission
Expected subscription revenue
```

Это разные вещи.

Если authoritative `Expected Revenue` отсутствует --- не фабриковать
его.

------------------------------------------------------------------------

# 11. REVENUE AUTHORITY --- CRITICAL

До добавления любой карточки `Revenue` ответить:

``` text
Revenue for whom?
TravelHub platform?
Marketplace partner?
Storefront SaaS?
Gross or net?
Accrued or collected?
Cohort or event?
```

Customer payment ≠ TravelHub Revenue.

GMV ≠ TravelHub Revenue.

Payment Volume ≠ TravelHub Revenue.

------------------------------------------------------------------------

# 12. PLATFORM REVENUE

Для PLATFORM workspace определить существующий authoritative источник
platform earnings.

Если marketplace revenue = commission, доказать:

``` text
source model
status eligibility
accrual semantics
refund/cancellation treatment
date authority
```

Не называть commission net revenue, если reversal не реализован.

------------------------------------------------------------------------

# 13. MARKETPLACE / STOREFRONT REVENUE SEPARATION

TravelHub имеет разные business models:

``` text
Marketplace → commission-based
Storefront SaaS → subscription-based
```

Stage H должен сохранять это разделение.

Не смешивать в один показатель без explicit composition.

------------------------------------------------------------------------

# 14. REVENUE MIX

Проверить, готова ли data model к доказуемому Revenue Mix:

``` text
Marketplace commission contribution
Storefront subscription contribution
other proven platform revenue streams, if any
```

Если subscription billing engine не authoritative, нельзя включать
list-price subscriptions как collected revenue.

------------------------------------------------------------------------

# 15. STOREFRONT SUBSCRIPTION LIMITATION

Предыдущая financial authority фиксировала:

``` text
Storefront subscription = LIST VALUE ONLY
(no billing engine)
```

Stage H обязан re-verify current state.

Если billing authority всё ещё отсутствует:

``` text
НЕ показывать subscription list value как collected platform revenue.
```

Можно показывать informational contract/list value только с честным
label, если Stage H действительно этого требует.

------------------------------------------------------------------------

# 16. OPERATIONAL ENRICHMENT

Текущая Operational section показывает прежде всего counts.

Не добавлять денежную сумму на каждую operational card автоматически.

Принцип:

``` text
Operational card → operational state/count
Clickable drill-down → affected entities / monetary context where useful
```

Сумма допустима только если она materially improves decision-making и
имеет корректную semantic label.

------------------------------------------------------------------------

# 17. CLICKABLE KPI FUTURE COMPATIBILITY

Архитектура enrichment должна быть совместима с будущей кликабельностью
карточек:

``` text
KPI
→ filtered detail/drill-down
```

Не перегружать верхний уровень дублирующими count + amount cards, если
amount логичнее показать после drill-down.

------------------------------------------------------------------------

# 18. OPERATIONAL COUNTS ≠ FINANCIAL KPI

Например:

``` text
Confirmed bookings = count
Completed bookings = count
Failed payments = count
```

Не превращать их автоматически в:

``` text
Confirmed booking value
Completed booking value
Failed payment value
```

на верхнем уровне без доказанной executive/operational потребности.

------------------------------------------------------------------------

# 19. FINANCIAL ENRICHMENT

Financial section должна отвечать на вопросы:

``` text
какой объём прошёл через систему?
какой объём реально оплачен?
что осталось к оплате?
какие возвраты обработаны?
что заработала платформа по доказанной модели?
из каких доказанных источников состоит platform revenue?
```

Но не создавать ложную бухгалтерскую отчётность.

------------------------------------------------------------------------

# 20. FINANCIAL RECONCILIATION

Для каждой financial metric:

``` text
definition
source table/model
formula
status filters
date authority
currency
period semantics
DB value
API value
UI value
```

------------------------------------------------------------------------

# 21. COMPARISON SEMANTICS

Каждый `% ↑/↓` должен сравнивать одинаковые metric semantics:

``` text
same formula
same period type
same date authority
same currency
same scope
```

Не сравнивать cohort current с event-period previous.

------------------------------------------------------------------------

# 22. ROUNDING POLICY

Сохранить ранее закрытую проблему:

``` text
Exact GMV
Exact Collected
Exact Outstanding
```

authoritative.

UI integer presentation должна reconciliate видимую формулу:

``` text
display Outstanding
=
display GMV - display Collected
```

Не возвращать визуальный дефект:

``` text
11 514 - 10 838 = 676
UI Outstanding = 675
```

------------------------------------------------------------------------

# 23. NO DOUBLE COUNTING

Особенно проверить:

``` text
Order.paidAmount
Payment CAPTURED
Refund
Commission
Subscription
```

Не суммировать разные representations одного economic event как разные
revenue streams.

------------------------------------------------------------------------

# 24. REFUND SEMANTICS

Stage H должен явно показать влияние refund на соответствующие metrics.

Проверить:

``` text
GMV
Collected GMV
Payment Volume
Outstanding
Completed GMV
Commission
platform earnings
```

Для каждого:

``` text
refund affects? YES/NO
how?
why?
```

Не менять policy без отдельного decision.

------------------------------------------------------------------------

# 25. CANCELLATION SEMANTICS

Аналогично:

``` text
NEW
CANCELLED
SENT_TO_BOOKING
IN_PROCESSING
PROBLEM
FULFILLED
CLOSED
```

Проверить eligibility для каждой financial metric.

------------------------------------------------------------------------

# 26. STATUS MATRIX --- REQUIRED

Создать matrix:

  -----------------------------------------------------------------------------------
  Order status         Qualified    Collected   Outstanding    Completed   Commission
                             GMV   GMV cohort                        GMV 
  ----------------- ------------ ------------ ------------- ------------ ------------
  NEW                                                                    

  CANCELLED                                                              

  SENT_TO_BOOKING                                                        

  IN_PROCESSING                                                          

  PROBLEM                                                                

  FULFILLED                                                              

  CLOSED                                                                 
  -----------------------------------------------------------------------------------

Использовать реальные enum values repository.

------------------------------------------------------------------------

# 27. PAYMENT STATUS MATRIX

Создать:

  Payment status     Payment Volume   Collected GMV   Revenue Notes
  ---------------- ---------------- --------------- --------- -------

Не смешивать Payment event metric с Order cohort metric.

------------------------------------------------------------------------

# 28. REFUND STATUS MATRIX

Создать:

  ------------------------------------------------------------------------
  Refund          Refund          GMV   Outstanding   Commission Notes
  status          metric                                         
  --------- ------------ ------------ ------------- ------------ ---------

  ------------------------------------------------------------------------

------------------------------------------------------------------------

# 29. WORKSPACE SCOPE

Stage H должен соблюдать:

``` text
PLATFORM
PARTNER
```

и tenant/partner scope.

Не показывать platform-wide values partner user.

Не считать frontend hiding security.

------------------------------------------------------------------------

# 30. ENTITLEMENTS

Сохранять существующую entitlement architecture:

``` text
Marketplace Basic
Storefront Pro
```

Если enrichment относится только к PLATFORM Command Center --- не
распространять его автоматически на Partner workspace.

------------------------------------------------------------------------

# 31. RBAC

Сохранить section permissions:

``` text
dashboard.executive.read
dashboard.operational.read
dashboard.financial.read
dashboard.marketplace.read
```

и page gate:

``` text
analytics.read
```

Server-side section filtering остаётся authority.

------------------------------------------------------------------------

# 32. EMPLOYEE PERFORMANCE

Employee Performance уже formalized как mandatory future capability.

**НЕ реализовывать в Stage H**, если canonical Stage H явно этого не
требует.

Не добавлять employee scoring в Executive/Operational enrichment.

------------------------------------------------------------------------

# 33. DECISION LOOP INTEGRATION

Stage H enrichment не должен ломать:

``` text
WHAT → WHY → IMPACT → ACTION
```

Если новый KPI используется Decision Queue, это должно быть explicit и
evidence-based.

Не создавать новые signals автоматически только потому, что появился
новый KPI.

------------------------------------------------------------------------

# 34. AI DECISION FEED

Не возвращать:

``` text
fabricated financial uplift
recommendation prose
parallel ACTION authority
```

Stage G остаётся закрытым.

------------------------------------------------------------------------

# 35. NO FORECAST FABRICATION

Не добавлять:

``` text
forecast revenue
expected uplift
potential profit
predicted loss
```

если Stage H не имеет отдельного authoritative forecasting model.

------------------------------------------------------------------------

# 36. VISUAL DESIGN

Сохранить текущий Command Center design language.

Не делать redesign страницы.

Stage H --- semantic/data enrichment, а не новый UI concept.

------------------------------------------------------------------------

# 37. KPI DENSITY

Не увеличивать Executive/Financial section бесконтрольно.

Для каждого нового KPI ответить:

``` text
What decision does this enable?
Why existing KPI is insufficient?
Is it top-level worthy?
Could it be drill-down instead?
```

Если ответа нет --- KPI не добавлять.

------------------------------------------------------------------------

# 38. TOOLTIP / SUBTITLE

Для сложных financial semantics использовать concise localized
subtitle/tooltip.

Пример:

``` text
GMV
Заказы кроме NEW и CANCELLED
```

Но не заменять tooltip архитектурной документацией.

------------------------------------------------------------------------

# 39. LOCALIZATION

Все новые:

``` text
KPI names
subtitles
tooltips
section labels
legends
empty/error states
```

должны иметь RU/AZ/EN.

Raw keys:

``` text
cc.kpi.*
cc.*
```

в runtime = 0.

------------------------------------------------------------------------

# 40. AZN PRESENTATION

Browser gate:

``` text
unexpected $ = 0
unexpected USD = 0
expected ₼ present
```

Не проверять символ простым global count без semantic context ---
проверить financial cards.

------------------------------------------------------------------------

# 41. DB-LEVEL RECONCILIATION

Для representative period минимум:

``` text
MONTH
YEAR
LAST_7_DAYS
```

провести DB/API/UI reconciliation ключевых financial metrics.

------------------------------------------------------------------------

# 42. DATASET

Использовать существующий 2026 demo dataset.

Не reseed/rewrite dataset без необходимости.

Если seed defect обнаружен --- классифицировать отдельно и не
маскировать formula changes.

------------------------------------------------------------------------

# 43. TEMPORAL SAFETY

Учитывая прошлый future-date defect:

``` text
period queries must have correct lower AND upper bounds where applicable.
```

Не использовать `Math.abs()` для маскировки временных ошибок.

------------------------------------------------------------------------

# 44. PERFORMANCE

Замерить:

``` text
Command Center before Stage H
Command Center after Stage H
additional DB queries
N+1
```

Enrichment не должен превращать dashboard в набор независимых тяжёлых
aggregate queries без необходимости.

------------------------------------------------------------------------

# 45. QUERY REUSE

Где возможно, использовать:

``` text
shared aggregates
batched queries
existing analytics authority
```

Не дублировать одинаковый SUM/COUNT в разных services.

------------------------------------------------------------------------

# 46. TESTS --- FINANCIAL CONTRACT

Добавить regression tests минимум на:

``` text
Qualified GMV
Collected GMV
Outstanding
Completed GMV
Payment Volume
Refunds
Commission
rounding reconciliation
currency
period comparison
```

------------------------------------------------------------------------

# 47. TESTS --- SEMANTIC DIFFERENCE

Обязательно иметь test, доказывающий допустимость:

``` text
Payment Volume > GMV
```

при соответствующих данных.

Это не должно снова считаться дефектом автоматически.

------------------------------------------------------------------------

# 48. TESTS --- REFUND

Добавить/сохранить tests:

``` text
refund does not automatically reduce GMV
refund does not create Outstanding
refund metric follows processed authority
```

согласно frozen policy.

------------------------------------------------------------------------

# 49. TESTS --- STOREFRONT

Если Stage H показывает Storefront contribution:

``` text
list value ≠ collected revenue
```

должно быть защищено regression test.

Если contribution не реализуется --- явно N/A.

------------------------------------------------------------------------

# 50. BROWSER RUNTIME

Обязательный browser evidence для:

``` text
Executive
Operational
Financial
```

RU минимум полностью.

AZ/EN --- проверить все новые Stage H labels и representative metrics.

------------------------------------------------------------------------

# 51. REQUIRED DELIVERABLE A --- CANONICAL STAGE H SCOPE

Вернуть до/в отчёте:

``` text
Canonical Stage H source:
Exact scope:
Dependencies:
Out-of-scope:
```

------------------------------------------------------------------------

# 52. REQUIRED DELIVERABLE B --- BEFORE/AFTER INVENTORY

  Section       Before   Stage H change   Why
  ------------- -------- ---------------- -----
  Executive                               
  Operational                             
  Financial                               

Если section не требует изменения --- написать `NO CHANGE REQUIRED`.

------------------------------------------------------------------------

# 53. REQUIRED DELIVERABLE C --- METRIC DICTIONARY

Для всех затронутых metrics:

  -----------------------------------------------------------------------
  Metric      Business    Formula     Date        Period type Currency
              meaning                 authority               
  ----------- ----------- ----------- ----------- ----------- -----------

  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 54. REQUIRED DELIVERABLE D --- STATUS MATRICES

Предоставить:

``` text
Order status matrix
Payment status matrix
Refund status matrix
```

------------------------------------------------------------------------

# 55. REQUIRED DELIVERABLE E --- REVENUE MODEL

Явно:

``` text
Marketplace revenue authority:
Storefront SaaS revenue authority:
Can they be combined now? YES/NO
Revenue Mix implemented? YES/NO
Why:
Known limitations:
```

------------------------------------------------------------------------

# 56. REQUIRED DELIVERABLE F --- REFUND EFFECT MATRIX

  Metric             Refund effect   Formula/Reason
  ------------------ --------------- ----------------
  GMV                                
  Collected GMV                      
  Outstanding                        
  Payment Volume                     
  Completed GMV                      
  Commission                         
  Platform Revenue                   

------------------------------------------------------------------------

# 57. REQUIRED DELIVERABLE G --- RECONCILIATION

Для ключевых metrics:

``` text
MONTH:
DB:
API:
UI:

YEAR:
DB:
API:
UI:

LAST_7_DAYS:
DB:
API:
UI:
```

Exact vs display values различать явно.

------------------------------------------------------------------------

# 58. REQUIRED DELIVERABLE H --- LOCALIZATION/RUNTIME

``` text
RU raw keys:
AZ raw keys:
EN raw keys:

RU mixed-language system text:
AZ mixed-language system text:
EN mixed-language system text:

unexpected $/USD:
AZN/₼:
```

------------------------------------------------------------------------

# 59. REQUIRED DELIVERABLE I --- PERFORMANCE

``` text
Before:
After:
Delta:
Queries before:
Queries after:
N+1:
Assessment:
```

------------------------------------------------------------------------

# 60. REQUIRED DELIVERABLE J --- TESTS

``` text
New tests:
Backend:
Frontend:
Backend TSC:
Frontend TSC:
Backend build:
Frontend build:
Browser:
```

------------------------------------------------------------------------

# 61. REQUIRED DELIVERABLE K --- GIT

``` text
Starting HEAD:
Final HEAD:
Files changed:
New files:
Migrations:
Commit:
Pushed:
Working tree clean:
```

------------------------------------------------------------------------

# 62. DOCUMENTATION

Создать:

``` text
docs/prompts/PHASE_3_STAGE_H_EXECUTIVE_OPERATIONAL_FINANCIAL_DECISION_ENRICHMENT_REPORT.md
```

Отчёт полностью на русском.

После VERDICT A additive update canonical roadmap:

``` text
Stage H → COMPLETE
```

------------------------------------------------------------------------

# 63. НЕ РЕАЛИЗОВЫВАТЬ

В Stage H не делать автоматически:

``` text
Stage I
Stage J
commission reversal
full accounting ledger
Storefront billing engine
Employee Performance
new subscription checkout
AI forecasts
automatic actions
Command Center redesign
```

------------------------------------------------------------------------

# 64. ACCEPTANCE CRITERIA

VERDICT A разрешён только если:

1.  Canonical Stage H scope подтверждён.
2.  Frozen GMV semantics не нарушены.
3.  Collected GMV остаётся cohort-based.
4.  Outstanding reconciles exact/display policy.
5.  Completed GMV semantics сохранены.
6.  Payment Volume остаётся event-period.
7.  Refund не вычитается из GMV автоматически.
8.  Refund не создаёт Outstanding.
9.  Commission limitation честно сохранён.
10. Revenue не подменён payments/GMV.
11. Marketplace/Storefront revenue semantics разделены.
12. Subscription list value не выдан за collected revenue.
13. Date authority задокументирована для каждой новой metric.
14. Status matrices представлены.
15. No double counting.
16. No fabricated forecast/uplift/loss.
17. Operational section не перегружена ненужными суммами.
18. PLATFORM/PARTNER scope сохранён.
19. Server-side RBAC/section authority сохранены.
20. RU/AZ/EN localization PASS.
21. AZN/₼ PASS; unintended \$/USD = 0.
22. DB/API/UI reconciliation PASS.
23. MONTH/YEAR/LAST_7_DAYS checked.
24. Performance acceptable; no uncontrolled N+1.
25. WHAT/WHY/IMPACT/ACTION regression PASS.
26. AI Feed Stage G regression PASS.
27. Tests/TSC/build PASS.
28. Stage I/J не запускались.
29. Отчёт на русском.

------------------------------------------------------------------------

# 65. FINAL VERDICT

Вернуть ровно один:

## VERDICT A --- STAGE H COMPLETE / EXECUTIVE-OPERATIONAL-FINANCIAL ENRICHMENT VERIFIED / FINANCIAL SEMANTICS PRESERVED

или:

## VERDICT B --- STAGE H REMEDIATION REQUIRED

Разделить gaps:

``` text
Canonical scope:
Executive:
Operational:
Financial:
GMV lifecycle:
Revenue authority:
Refund semantics:
Commission:
Storefront:
Date authority:
Currency:
Localization:
Reconciliation:
Performance:
Tests:
```

или:

## VERDICT C --- BLOCKED / FINANCIAL AUTHORITY GAP

Если Stage H требует показатель, для которого в текущей модели нет
доказуемой financial authority и реализация потребует отдельного
architecture decision.

------------------------------------------------------------------------

# 66. STOP

После отчёта:

**STOP.**

Stage I/J автоматически не запускать.

Дождаться review и отдельного разрешения.
