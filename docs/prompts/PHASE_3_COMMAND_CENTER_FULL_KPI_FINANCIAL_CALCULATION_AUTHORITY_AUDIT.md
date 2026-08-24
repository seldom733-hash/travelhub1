# PHASE 3 — COMMAND CENTER
## FULL KPI & FINANCIAL CALCULATION AUTHORITY AUDIT
### PRE-STAGE-E FINANCIAL / METRIC TRUST GATE

# LANGUAGE REQUIREMENT — MANDATORY

Все ответы разработчика, audit findings, таблицы, расчёты, SQL/Prisma evidence explanations,
результаты тестирования, runtime/browser evidence, remediation report и финальный VERDICT
должны быть предоставлены **НА РУССКОМ ЯЗЫКЕ**.

Технические identifiers, paths, model/field names, enums, endpoints, SHA, commands и code
сохранять в оригинальном виде.

Финальный отчёт — обязательно на русском языке.

---

# 1. PURPOSE

Stage D и Post-Seed Stage D Validation завершены.

Однако в реальном Command Center наблюдается:

```text
Сводные показатели

GMV
7 460 ₼
↑ 4.2%

Объём платежей
9 442 ₼
```

Сам по себе:

```text
Payment Volume > GMV
```

не обязательно является ошибкой.

Это может быть корректно, если:

```text
GMV → orders booked/created in selected period
Payment Volume → payments captured in selected period
```

и часть платежей относится к заказам предыдущих периодов.

Но если эти KPI показываются рядом без доказанной и документированной period semantics,
пользователь не может понять, являются ли значения корректными.

Перед Stage E необходимо провести **полный аудит достоверности всех KPI и финансовых
вычислений во всех секциях PLATFORM Command Center**.

Цель:

```text
DB source
→ business scope
→ statuses
→ event/date authority
→ period
→ currency
→ formula
→ comparison
→ DTO
→ UI label
→ displayed runtime value
```

должны быть доказуемо согласованы.

---

# 2. THIS IS A TRUST GATE — NOT A COSMETIC HOTFIX

Не исправлять только:

```text
GMV 7 460
vs
Payment Volume 9 442
```

и не останавливаться после первой найденной ошибки.

Проверить **ВСЕ monetary и non-monetary KPI всех секций Command Center**.

Stage E строит IMPACT поверх этих данных.

Поэтому:

```text
untrusted KPI
→ untrusted IMPACT
```

Stage E автоматически НЕ запускать.

---

# 3. AUDIT ACTUAL HEAD FIRST

До изменений зафиксировать:

```text
Starting HEAD
current roadmap status
current Command Center sections
all KPI definitions
analytics/dashboard services
DTOs
frontend mappings
i18n labels
comparison implementation
currency handling
Marketplace/Storefront separation
```

Не использовать старые reports как доказательство actual runtime без проверки HEAD.

---

# 4. CANONICAL BUSINESS AUTHORITY — PRESERVE

Сохранять уже принятые решения:

```text
Marketplace Business
≠ Storefront SaaS
≠ Storefront Commerce

GMV
≠ Payment Volume
≠ TravelHub Revenue
≠ Profit

Marketplace Revenue
→ commission-based

Storefront SaaS Revenue
→ subscription/billing-based

Storefront Commerce Revenue/GMV
→ business of Storefront partner
→ NOT TravelHub Marketplace GMV/Revenue

PLATFORM Reporting Currency
→ AZN
```

Не возвращать superseded `$199` / USD semantics.

Reference Storefront plan:

```text
199 AZN
```

но list/effective price не равен автоматически collected subscription revenue.

---

# 5. ALL COMMAND CENTER SECTIONS — MANDATORY

Audit actual sections. Expected current set:

```text
1. Executive / Сводные показатели
2. Operational
3. Financial
4. Marketplace
5. Catalog
6. Channels
7. Needs Attention / Decision Queue
8. Insights
```

Если actual HEAD имеет иные names/structure — использовать фактическую реализацию и
зафиксировать отличие.

Нельзя проверять только Executive + Financial.

---

# 6. INVENTORY EVERY METRIC FIRST

До remediation составить полный metric inventory.

Для КАЖДОЙ карточки/метрики:

| Section | UI label | API field | Source | Monetary? | Current formula |
|---|---|---|---|---:|---|

Включить:

- KPI cards;
- totals;
- ratios;
- percentages;
- funnel values;
- counts;
- monetary aggregates;
- comparison deltas;
- channel totals;
- catalog metrics;
- decision/insight numerical values.

Ничего не пропускать потому, что metric «кажется простой».

---

# 7. AUTHORITATIVE METRIC CONTRACT

Для каждой metric вернуть:

| Field | Required answer |
|---|---|
| Metric ID | stable technical identifier |
| UI Label | RU/AZ/EN meaning |
| Business meaning | what exactly is measured |
| Source of truth | model/table/service |
| Business scope | Marketplace / Storefront SaaS / Storefront Commerce / combined where allowed |
| Included statuses | exact enums |
| Excluded statuses | exact enums |
| Amount field | exact field |
| Date authority | exact timestamp/date field |
| Period semantics | booked-period / payment-period / service-period / snapshot etc. |
| Currency | source and reporting currency |
| Formula | exact deterministic formula |
| Comparison | previous-period formula |
| Null/zero behavior | explicit |
| Runtime proof | actual value |

Это становится audit authority для current implementation.

---

# 8. EXECUTIVE SECTION — FULL AUDIT

Проверить все actual Executive KPI.

Минимум, если существуют:

```text
GMV
Payment Volume
Refunds
Orders
Bookings
AOV
Conversion
```

Для каждого доказать formula и scope.

Особенно:

## GMV

Однозначно определить, что именно current canonical Executive GMV означает:

```text
Booked GMV?
Collected GMV?
Completed GMV?
Order amount?
Another definition?
```

Указать:

```text
model
amount field
statuses
date field
period
Marketplace/Storefront scope
refund treatment
```

## Payment Volume

Определить:

```text
captured payments?
paidAmount?
payment records?
refunded payments included/excluded?
```

и точный event date.

## Refunds

Определить:

```text
requested?
processed?
successful?
full + partial?
```

Не смешивать pending refund request с фактически возвращенными средствами.

## AOV

Доказать numerator/denominator.

Если:

```text
AOV = GMV / Orders
```

то GMV и Orders должны иметь совместимый cohort/scope.

---

# 9. PRIMARY INVESTIGATION — WHY PAYMENT VOLUME > GMV

Для current selected period, где UI показывает примерно:

```text
GMV = 7 460 AZN
Payment Volume = 9 442 AZN
```

выполнить reconciliation.

Разложить Payment Volume минимум на:

```text
A. payments for orders created/booked in same selected period
B. payments for orders created before selected period
C. payments for orders created after period, if possible/invalid
D. duplicate/retry/captured payment anomalies
E. refunded/failed payment treatment
F. Marketplace vs Storefront contamination
```

Вернуть:

| Component | AZN |
|---|---:|
| Same-period order payments | |
| Prior-period order payments | |
| Other legitimate timing difference | |
| Invalid/duplicate amount | |
| Scope contamination | |
| Total Payment Volume | |

И reconciliation:

```text
UI Payment Volume
=
DB reconstructed Payment Volume
```

с exact result.

---

# 10. COHORT VS EVENT-PERIOD SEMANTICS

Определить, какая модель используется для каждой financial metric:

## Cohort-based

```text
orders selected by Order.<date>
→ amounts/payments/refunds associated with that order cohort
```

## Event-period

```text
payments selected by Payment.<date>
refunds selected by Refund.<date>
```

Обе модели могут быть валидны.

Но нельзя случайно смешивать их без документированной semantics.

Для каждой metric поставить:

```text
COHORT
EVENT_PERIOD
SNAPSHOT
OTHER
```

---

# 11. EXECUTIVE COMPARABILITY DECISION

После reconciliation ответить:

Должны ли Executive GMV и Payment Volume быть:

```text
A. directly cohort-comparable
```

или:

```text
B. intentionally different event-period metrics
```

Если B — UI/tooltip/subtitle должен объяснять отличие достаточно ясно.

Не менять canonical business semantics только ради invariant:

```text
GMV >= Payment Volume
```

если такой invariant концептуально неверен для event-period view.

---

# 12. VALID INVARIANTS — APPLY ONLY WHERE SEMANTICALLY VALID

Не вводить ложные global invariants.

Проверять только matched scope/cohort.

Примеры:

```text
0 <= cohort collected amount <= cohort booked amount
```

если overpayment не разрешён.

```text
processed refund <= eligible collected amount
```

для matched transaction scope.

```text
AOV = qualifying GMV / qualifying order count
```

```text
comparison % uses same metric definition in current and previous period
```

Если invariant не применим — явно написать `NOT APPLICABLE` и почему.

---

# 13. OPERATIONAL SECTION — FULL AUDIT

Проверить все actual metrics, например:

```text
bookings
confirmed
completed
payments
refunds
funnel
fulfillment
```

Для каждого:

- exact statuses;
- date authority;
- period;
- source model;
- count vs amount;
- denominator;
- duplicate risk.

Особенно funnel:

каждый stage должен иметь понятную population/cohort basis.

Не строить conversion между несопоставимыми event-period populations.

---

# 14. FINANCIAL SECTION — FULL AUDIT

Проверить все actual Financial metrics.

Минимум, если существуют:

```text
Commission
Payments
Net Payments
Refunds
Expected Revenue
Collected Revenue
Outstanding Revenue
```

Не предполагать, что label корректен.

Для каждого доказать semantic authority.

Особенно проверить:

```text
Commission.amount
PARTNER_COLLECT semantics
refund treatment
commission reversal availability
```

Canonical policy:

```text
customer refund
→ proportional Marketplace commission reversal
```

Если Stage 2.14.x reversal implementation ещё отсутствует,
не изображать net commission как полностью authoritative после refunds.

Отметить limitation.

---

# 15. NET PAYMENTS

Если существует `Net Payments`, доказать formula.

Например:

```text
Payment Volume - processed Refunds
```

может быть корректно только при совместимых period/scope semantics.

Не вычитать:

```text
pending refund requests
```

как будто деньги уже возвращены.

---

# 16. REVENUE LABEL SAFETY

Проверить, что нигде снова не произошло:

```text
customer payments → "Revenue"
payments - refunds → "Net Revenue"
```

TravelHub Revenue должен соответствовать реальному business model.

Все старые/superseded labels найти через code search + runtime.

---

# 17. MARKETPLACE SECTION — FULL AUDIT

Проверить actual Marketplace KPI:

```text
GMV
orders
bookings
partners
customers
commission/revenue
conversion
other actual metrics
```

Убедиться:

```text
Storefront Commerce transactions
NOT included
```

если metric относится к Marketplace.

Проверить partner/customer counts на distinct semantics.

---

# 18. CATALOG SECTION — FULL AUDIT

Проверить:

```text
published services
active services
services with sales
services without sales
new listings
availability
conversion
other actual metrics
```

Для каждой count metric определить:

```text
snapshot as-of?
created in period?
active during period?
current state?
```

Не показывать snapshot count как period flow без объяснения.

---

# 19. CHANNELS SECTION — FULL AUDIT

Это критическая зона business separation.

Для каждого channel показать:

```text
Marketplace
Storefront SaaS
Storefront Commerce
```

только в тех комбинациях, которые canonical architecture разрешает.

Проверить:

```text
Marketplace GMV
Storefront Commerce GMV
Marketplace Revenue/Commission
Storefront subscription economics
```

Не суммировать Storefront Commerce GMV в PLATFORM Marketplace GMV.

Если aggregate `Total` существует — доказать, что складываемые величины семантически совместимы.

---

# 20. STOREFRONT SUBSCRIPTION METRICS

Current demo data:

```text
FREE_TRIAL
PREMIUM @199 AZN
```

Но проверить actual billing authority.

Не считать:

```text
SubscriptionPlan.price
× active subscriptions
```

как collected revenue, если нет фактического billing/payment evidence.

Классифицировать:

```text
LIST VALUE
EXPECTED/CONTRACTED
COLLECTED
NOT PROVABLE
```

---

# 21. NEEDS ATTENTION / DECISION QUEUE

Stage C/D authority сохранить.

Проверить numerical values/evidence:

```text
pending counts
affected GMV
refund counts
failed payment counts
upcoming counts
unsold services
```

Они должны совпадать с detector queries и signal evidence.

Не превращать Decision Queue в второй KPI engine.

---

# 22. INSIGHTS / AI DECISION FEED

Audit любые числовые значения и monetary estimates.

Особенно найти legacy hardcoded logic типа:

```text
count > 5 → high
potential = n × 15 AZN/week
```

Stage G владеет reconciliation AI Decision Feed.

В этом audit:

- не реализовывать Stage G;
- классифицировать недостоверные/hardcoded values;
- не позволять им считаться authoritative KPI;
- при необходимости минимально скрыть/пометить unsafe numeric claim, если он вводит пользователя в заблуждение.

Любое изменение scope объяснить.

---

# 23. COMPARISON / DELTA AUDIT

Для каждой metric с:

```text
↑ X%
↓ X%
```

проверить:

```text
current period
previous period
equal duration
same timezone
same statuses
same date authority
same business scope
same formula
same currency semantics
```

Formula:

```text
(current - previous) / previous * 100
```

если canonical implementation именно такая.

Определить behavior при:

```text
previous = 0
current = 0
null
```

Не показывать `Infinity%`, `NaN%` или fabricated 100%.

---

# 24. PERIOD BOUNDARIES

Проверить:

```text
from inclusive/exclusive
to inclusive/exclusive
timezone
day boundary
month boundary
year boundary
```

Особенно:

```text
2026-01-01
2026-12-31
```

и comparison windows.

Не допустить double-count/omission на boundary timestamps.

---

# 25. TIMEZONE AUTHORITY

Использовать canonical timezone policy проекта.

Не смешивать:

```text
UTC DB timestamps
local browser date
server timezone
workspace timezone
```

без deterministic conversion.

Вернуть actual timezone semantics.

---

# 26. CURRENCY AUDIT

PLATFORM Reporting Currency:

```text
AZN
```

Для каждой monetary metric проверить:

```text
stored currency
aggregation behavior
display currency
```

Если DB содержит multi-currency records:

НЕ суммировать номиналы разных валют как будто они AZN.

Если FX engine отсутствует:

```text
cross-currency aggregate → NOT PROVABLE
```

либо использовать только authoritative AZN records согласно current architecture.

Не делать cosmetic currency relabel.

---

# 27. NO "$" REGRESSION

Code search + browser:

```text
unexpected USD defaults
"$"
"USD"
priceUsd
```

`priceUsd` может оставаться documented technical debt до Stage I, но не должен определять PLATFORM display currency или semantic revenue.

---

# 28. DB-LEVEL RECONCILIATION — MANDATORY

Для каждой monetary Executive/Financial/Channel metric выполнить independent DB reconstruction.

Не использовать тот же service method как единственное доказательство его собственной корректности.

Использовать:

```text
SQL
Prisma aggregate/groupBy
or independent validation script
```

и сравнить:

```text
Expected DB value
Backend API value
Frontend displayed value
```

---

# 29. THREE-LAYER RECONCILIATION TABLE

Для каждой critical metric:

| Metric | DB expected | API actual | UI actual | Match |
|---|---:|---:|---:|---:|
| GMV | | | | |
| Payment Volume | | | | |
| Refunds | | | | |
| Commission | | | | |
| Net Payments | | | | |
| AOV | | | | |

Добавить остальные actual financial metrics.

Требование:

```text
DB = API = UI
```

с допустимым только documented rounding.

---

# 30. SAMPLE TRANSACTION TRACE

Выбрать минимум 5 representative business chains:

```text
A. fully paid Marketplace order
B. partially paid Marketplace order
C. unpaid/pending order
D. refunded/partially refunded order
E. Storefront Commerce / subscription representative case
```

Для каждой показать:

```text
order amount
order date
payment(s)
payment date(s)
refund(s)
refund date(s)
commission
business context
which KPI/period includes each value
```

Это обязательная manual sanity proof.

---

# 31. PARTIAL PAYMENT SEMANTICS

Особенно проверить ранее зафиксированную потребность:

```text
expected
collected/factual
outstanding
```

для частично оплаченных услуг.

Не называть `Profit`, если cost model отсутствует.

Не путать:

```text
expected revenue
expected collection
booked GMV
payment volume
```

---

# 32. REFUND SEMANTICS

Разделить:

```text
refund requested
refund pending
refund processed
refund failed/cancelled, if exists
```

Monetary `Refunds` KPI должен использовать только тот state, который означает фактический возврат средств, если label не говорит обратного.

Decision Queue может считать pending requests отдельно.

---

# 33. COMMISSION / REFUND LIMITATION

Поскольку commission reversal policy принята, но implementation могла быть отложена в Stage 2.14.x:

проверить actual HEAD.

Вернуть:

```text
Commission reversal implemented: YES/NO
```

Если NO:

- не заявлять post-refund Net Marketplace Revenue как полностью provable;
- явно зафиксировать limitation;
- не реализовывать Stage 2.14.x в рамках этого audit без отдельного разрешения.

---

# 34. COUNTS / DISTINCTNESS

Проверить count metrics:

```text
COUNT rows
vs
COUNT DISTINCT entity
```

Особенно:

```text
customers
partners
orders
bookings
services
payments
```

Join fan-out не должен завышать counts/sums.

---

# 35. JOIN MULTIPLICATION AUDIT

Проверить aggregate queries на типичный defect:

```text
Order
JOIN Payment
JOIN Refund
JOIN Booking
→ duplicate Order.amount
```

Для всех сложных queries доказать отсутствие fan-out double counting.

---

# 36. STATUS MATRIX

Создать authoritative audit matrix:

| Domain | Status | Included in GMV | Payment Volume | Refunds | Commission | Orders count |
|---|---|---:|---:|---:|---:|---:|

Использовать actual enums.

Не придумывать statuses.

---

# 37. DATE AUTHORITY MATRIX

| Metric | Primary date field | Why |
|---|---|---|
| GMV | | |
| Payment Volume | | |
| Refunds | | |
| Orders | | |
| Bookings | | |
| Commission | | |
| AOV | derived | |

Добавить остальные metrics.

---

# 38. METRIC RELATIONSHIP GRAPH

После audit задокументировать допустимые отношения.

Например:

```text
Booked GMV
├─ Collected against cohort
└─ Outstanding against cohort

Event-period Payment Volume
└─ may exceed same-period Booked GMV

Processed Refunds
└─ reduce collected/net payment view according to matching semantics
```

Не вводить invariant только потому, что он визуально кажется логичным.

---

# 39. LABEL / TOOLTIP AUDIT

Если две соседние metrics используют разные period semantics,
UI должен позволять это понять.

Например conceptual:

```text
GMV
"Стоимость заказов, созданных за период"

Объём платежей
"Фактически полученные платежи за период, включая оплаты ранее созданных заказов"
```

Exact wording — RU/AZ/EN и только после подтверждения semantics.

Не перегружать карточки длинным текстом; tooltip/subtitle допустим.

---

# 40. I18N

Любые исправленные labels/tooltips:

```text
RU
AZ
EN
```

Не оставлять raw keys.

Financial terminology должна быть семантически одинаковой во всех языках.

---

# 41. BACKEND SINGLE AUTHORITY

Проверить, не существуют ли параллельные formula implementations:

```text
analytics.service
dashboard.service
frontend recomputation
channel helper
legacy v3 helper
```

Одинаковая metric не должна считаться разными способами без intentional semantic distinction.

Если возможно, использовать shared authoritative calculation primitive/service.

Но не проводить большой refactor без необходимости.

---

# 42. FRONTEND MUST NOT INVENT FINANCIAL VALUES

Frontend может:

```text
format
round for display
render delta
```

но не должен самостоятельно менять business formula.

Проверить `KpiCard`, `SectionGrid`, `CommandCenter`, dashboard API mappings и related components.

---

# 43. ROUNDING

Определить canonical rounding:

```text
DB precision
API precision
display precision
percentage precision
```

Не допускать значимого mismatch из-за premature rounding.

Financial calculation сначала full precision, display rounding — последним шагом.

---

# 44. NEGATIVE VALUES

Проверить возможные negative:

```text
net payments
net commission/revenue
comparison delta
```

Negative может быть legitimate только при documented semantics.

Не clamp к zero без authority.

---

# 45. ZERO / EMPTY DATA

Для каждого KPI проверить:

```text
no rows
zero amount
null
previous period zero
```

UI должен показывать корректное состояние, а не NaN/undefined.

---

# 46. CURRENT 2026 DEMO DATASET AS TEST BED

Использовать rich demo dataset:

```text
1,000 orders
826 payments
703 bookings
39 refunds
732 commissions
partial/full/unpaid/failed/refunded cases
```

но сначала перепроверить actual totals на HEAD.

Не считать seed report единственным source of truth.

---

# 47. PERIOD TEST CASES

Минимум проверить:

```text
single day
7 days
calendar month
multi-month
full year 2026
period crossing month boundary
period with prior-order payment
period with refund
period with partial payment
period with previous=0 comparison if available
```

---

# 48. MARKETPLACE / STOREFRONT CONTAMINATION TEST

Создать/использовать representative known records.

Доказать:

```text
Marketplace KPI excludes Storefront Commerce
Storefront Commerce metrics do not become TravelHub Revenue
Storefront subscription economics remain separate
```

---

# 49. RBAC

Calculation result не должен меняться из-за role, кроме section visibility/scope authority.

Проверить representative:

```text
ADMIN
FINANCE
MARKETER
OPERATOR
```

Если две роли имеют доступ к одной и той же metric/scope, значение должно совпадать.

Не раскрывать hidden sections через API.

---

# 50. PERFORMANCE

Audit/remediation не должен вызвать N+1 или тяжёлый per-card query explosion.

Измерить:

```text
Command Center endpoint latency
DB query count if measurable
comparison=true vs false
```

Сравнить с accepted post-seed baseline ~450ms, но перепроверить actual.

---

# 51. NO STAGE E IMPLEMENTATION

Не добавлять:

```text
severity
impact score
financial impact estimate
urgency score
HIGH/MEDIUM/LOW
```

кроме уже существующего legacy content, который только audit/classify.

Stage E остаётся blocked до PASS этого gate.

---

# 52. NO STAGE G IMPLEMENTATION

Не переписывать AI Decision Feed полностью.

Если audit обнаруживает hardcoded misleading financial number — зафиксировать и минимально обезопасить только если он отображается как factual authority.

Полный reconciliation остаётся Stage G.

---

# 53. REMEDIATION POLICY

Если найден defect:

1. доказать root cause;
2. определить authoritative semantics;
3. сделать минимальный fix;
4. добавить regression test;
5. повторить DB→API→UI reconciliation.

Не менять formula просто чтобы цифры «выглядели логичнее».

---

# 54. REQUIRED TESTS — BACKEND

Добавить/обновить tests для всех исправленных calculations.

Минимум:

```text
GMV
Payment Volume
Refunds
AOV
Commission
Net Payments
partial payments
prior-period order paid in current period
refund in later period
comparison
Marketplace/Storefront separation
join fan-out
zero previous period
```

Использовать actual canonical semantics.

---

# 55. REQUIRED TESTS — FRONTEND

Проверить:

```text
correct labels
correct monetary values
AZN symbol
comparison display
zero/null
tooltips/subtitles if added
no USD fallback
no frontend recomputation drift
```

---

# 56. RUNTIME / BROWSER — MANDATORY

VERDICT A запрещён только по unit tests.

В реальном Command Center:

- открыть все доступные 8 sections;
- зафиксировать actual KPI values;
- сверить critical metrics с DB/API;
- проверить period changes;
- проверить comparison;
- проверить AZN;
- проверить labels/tooltips;
- убедиться, что нет NaN/undefined/raw keys.

---

# 57. REQUIRED DELIVERABLE A — COMPLETE METRIC INVENTORY

Вернуть полный список всех Command Center metrics:

| # | Section | Metric | Formula | Source | Scope | Date authority | Currency |
|---:|---|---|---|---|---|---|---|

Количество строк должно совпадать с actual number of metrics.

---

# 58. REQUIRED DELIVERABLE B — FINDINGS

Каждый finding классифицировать:

```text
P0 — materially false financial/business metric
P1 — wrong scope/status/date/comparison semantics
P2 — misleading label/tooltip/rounding
P3 — documentation/test gap
```

Вернуть:

| Finding | Severity | Root cause | Affected metrics | Fix |
|---|---|---|---|---|

Если defect отсутствует — не создавать finding искусственно.

---

# 59. REQUIRED DELIVERABLE C — GMV VS PAYMENT VOLUME RECONCILIATION

Обязательно отдельная секция отчёта:

```text
WHY 9,442 AZN PAYMENT VOLUME > 7,460 AZN GMV?
```

Вернуть mathematical reconciliation до 0.01 AZN/actual DB precision.

Финальный classification:

```text
CORRECT BY DESIGN
MISLEADING PRESENTATION
CALCULATION DEFECT
SCOPE DEFECT
PERIOD DEFECT
DATA DEFECT
```

Можно выбрать несколько, если доказано.

---

# 60. REQUIRED DELIVERABLE D — DB/API/UI RECONCILIATION

Для всех critical financial metrics:

| Metric | DB | API | UI | Difference | Result |
|---|---:|---:|---:|---:|---|

Difference должен быть 0 кроме documented display rounding.

---

# 61. REQUIRED DELIVERABLE E — BUSINESS SEMANTICS MATRIX

Вернуть:

| Metric | Marketplace | Storefront SaaS | Storefront Commerce | Combined allowed? |
|---|---:|---:|---:|---:|

Для каждой metric объяснить scope.

---

# 62. REQUIRED DELIVERABLE F — PERIOD SEMANTICS MATRIX

Вернуть:

| Metric | COHORT/EVENT/SNAPSHOT | Date field | Current period | Comparison |
|---|---|---|---|---|

---

# 63. REQUIRED DELIVERABLE G — STATUS MATRIX

Использовать actual enums и показать inclusion/exclusion.

---

# 64. REQUIRED DELIVERABLE H — SAMPLE TRANSACTION TRACES

Минимум 5 chains с ручным reconciliation.

---

# 65. REQUIRED DELIVERABLE I — FINANCIAL AUTHORITY STATUS

После audit дать статус:

```text
GMV: TRUSTED / NOT TRUSTED
Payment Volume: TRUSTED / NOT TRUSTED
Refunds: TRUSTED / NOT TRUSTED
AOV: TRUSTED / NOT TRUSTED
Commission: TRUSTED / LIMITED / NOT TRUSTED
Net Payments: TRUSTED / LIMITED / NOT TRUSTED
Storefront subscription revenue: PROVABLE / NOT PROVABLE
```

Добавить все actual financial metrics.

---

# 66. REQUIRED DELIVERABLE J — TESTS

Фактические counts:

```text
Dashboard unit:
Analytics/financial unit:
Command Center E2E:
RBAC:
Backend full:
Backend TSC:
Backend build:
Frontend Vitest:
Frontend TSC:
Frontend build:
Browser/runtime:
```

---

# 67. REQUIRED DELIVERABLE K — PERFORMANCE

Вернуть:

```text
Before audit/remediation:
After:
comparison=false:
comparison=true:
DB query count: measured / NOT MEASURED
```

---

# 68. REQUIRED DELIVERABLE L — FILES CHANGED

Точно:

```text
Total changed files:
Backend:
Frontend:
Tests:
Docs:
Migrations:
```

Если migration не нужна:

```text
Migrations: 0
```

---

# 69. REPORT

Создать:

```text
docs/prompts/PHASE_3_COMMAND_CENTER_FULL_KPI_FINANCIAL_CALCULATION_AUTHORITY_AUDIT_REPORT.md
```

Отчёт полностью на русском языке.

---

# 70. ARCHITECTURE / ROADMAP UPDATE

Если audit выявит новые canonical metric definitions, зафиксировать их additive в
соответствующем authoritative architecture/ADR document.

Не переписывать history.

Canonical roadmap должен получить gate evidence:

```text
Command Center KPI & Financial Calculation Authority Audit
→ PASS / REMEDIATION REQUIRED
```

Это gate перед Stage E, а не новый product stage.

---

# 71. GIT EVIDENCE

Вернуть:

```text
Starting HEAD:
Final HEAD:
Commits:
Pushed to origin: YES/NO
Working tree clean: YES/NO
```

---

# 72. ACCEPTANCE CRITERIA

VERDICT A только если:

1. Все actual Command Center metrics inventoried.
2. Все 8 sections audited.
3. Каждая metric имеет business meaning/source/scope/status/date/period/formula/currency.
4. GMV vs Payment Volume anomaly mathematically reconciled.
5. DB/API/UI critical values match.
6. No join fan-out/double counting.
7. Partial payments handled correctly.
8. Refund requested vs processed separated.
9. Commission semantics correct/limitations explicit.
10. Marketplace/Storefront economics separated.
11. Storefront Commerce not contaminating Marketplace GMV/Revenue.
12. Storefront subscription collected revenue not fabricated.
13. Comparison periods use identical metric semantics.
14. Timezone/boundaries deterministic.
15. Multi-currency nominal sums not mislabeled AZN.
16. No unexpected USD/$ display.
17. Labels match formulas.
18. AOV numerator/denominator compatible.
19. Counts use correct DISTINCT semantics.
20. Decision Queue evidence matches detectors.
21. Unsafe hardcoded Insight values are identified and not treated as trusted financial authority.
22. Zero/null/previous=0 safe.
23. Runtime/browser verified.
24. Tests/builds green.
25. Performance acceptable.
26. Canonical authority/roadmap updated where required.
27. Final report in Russian.
28. Stage E not automatically started.

---

# 73. VERDICT

Вернуть ровно один.

## VERDICT A — COMMAND CENTER KPI & FINANCIAL CALCULATION AUTHORITY VERIFIED / STAGE E READY

Только если все critical calculations доказаны, defects исправлены, DB/API/UI reconciled,
financial semantics trusted и acceptance criteria выполнены.

Stage E автоматически НЕ запускать.

## VERDICT B — KPI / FINANCIAL REMEDIATION REQUIRED

Если найдены исправимые defects.

Указать:

```text
P0/P1 blockers:
affected metrics:
root causes:
minimal remediation:
```

После remediation повторить этот trust gate.

## VERDICT C — BLOCKED

Если authoritative calculation невозможно доказать из-за отсутствующей domain capability.

Например:

```text
collected Storefront subscription revenue
```

без billing engine.

При этом не обязательно блокировать весь gate, если metric может быть честно классифицирована
как `NOT PROVABLE` и не отображается как authoritative factual KPI.

Объяснить exact blocker и scope.

---

# 74. STOP

После audit/remediation и отчёта:

**STOP.**

Не запускать автоматически:

```text
Stage E
Stage F
Stage G
Stage H
Stage I
Stage J
Stage 2.14.x
```

Вернуть полный отчёт на русском языке и ждать review.
