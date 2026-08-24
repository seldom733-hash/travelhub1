# PHASE 3 --- STAGE J

# FINAL REGRESSION / SECURITY / EVIDENCE CLOSURE

## COMMAND CENTER C→I FINAL TRUST GATE

## NO NEW FEATURES

------------------------------------------------------------------------

# 1. ЯЗЫК

Все ответы разработчика, findings, evidence, таблицы, remediation notes,
отчёт и финальный VERDICT --- **НА РУССКОМ ЯЗЫКЕ**.

Technical identifiers, code, paths, SQL, commands, widget IDs,
permission IDs, SHA и commit messages можно сохранять в оригинале.

------------------------------------------------------------------------

# 2. ЦЕЛЬ STAGE J

Stage J --- финальный trust/closure gate для Phase 3 Command Center.

Он должен ответить на один вопрос:

> Можно ли после Stages C--I доверять Command Center как единой системе
> с точки зрения данных, финансовой семантики, security, tenant
> isolation, localization, widget configuration, Decision Loop и runtime
> behavior?

Stage J **НЕ является feature stage**.

------------------------------------------------------------------------

# 3. ENTRY STATE --- RE-VERIFY, НЕ ПРИНИМАТЬ НА ВЕРУ

Ожидаемый status:

``` text
Stage C — WHAT                                  COMPLETE
Stage D — WHY                                   COMPLETE
Stage E — IMPACT                                COMPLETE
Stage F — ACTION                                COMPLETE
Stage G — AI Decision Feed                      COMPLETE
Stage H — Financial Enrichment                  COMPLETE
Step 3.29D — Billing Foundation                 COMPLETE
Stage I — Storefront Revenue Semantic Fix       COMPLETE
Post-Stage-I Widget Reconciliation V2           COMPLETE
Stage J                                         RUN NOW
```

Последние известные commits:

``` text
Step 3.29D                    9d659ef
Stage I                       59228eb
Post-Stage-I Reconciliation  c48ed38
```

Проверить repository фактически.

------------------------------------------------------------------------

# 4. FIRST GATE --- REPOSITORY STATE

До изменений:

``` bash
git status
git log -10 --oneline
git rev-parse HEAD
git rev-parse origin/master
```

Вернуть:

``` text
Starting HEAD:
origin/master:
Working tree:
Untracked:
```

Если dirty --- классифицировать до продолжения.

Не уничтожать изменения автоматически.

------------------------------------------------------------------------

# 5. HARD RULE --- NO NEW FEATURES

Stage J запрещено использовать для добавления:

``` text
новых KPI
новых Command Center sections
новых billing concepts
новых DecisionSignal types
новых recommendation engines
Employee Performance
refund/credit-note engine
tax/VAT
forecasting
LLM decisions
```

Разрешены только:

``` text
regression fixes
security fixes
semantic correctness fixes
localization fixes
registry consistency fixes
evidence/test fixes
```

------------------------------------------------------------------------

# 6. CLOSURE DOMAINS

Проверить минимум:

``` text
A. Command Center financial truth
B. Operational truth
C. Marketplace/Storefront truth
D. Storefront billing truth
E. Widget Registry / Settings
F. WHAT
G. WHY
H. IMPACT
I. ACTION
J. AI Decision Feed
K. RBAC
L. Tenant/workspace isolation
M. Localization RU/AZ/EN
N. Runtime/browser
O. Performance
P. Legacy/dead paths
Q. Tests/build
```

------------------------------------------------------------------------

# 7. FINANCIAL SEMANTIC DICTIONARY --- FREEZE

Сформировать final authoritative dictionary:

  -----------------------------------------------------------------------
  Metric      Formula     Source      Semantic    Date        Currency
                                      type        authority   
  ----------- ----------- ----------- ----------- ----------- -----------

  -----------------------------------------------------------------------

Минимум:

``` text
GMV
Collected GMV
Outstanding GMV
Completed GMV
Payment Volume
Refunds
Net Payments
Commission
Storefront MRR
Storefront ARR
Storefront Collected
Storefront Outstanding
```

------------------------------------------------------------------------

# 8. GMV --- FINAL AUTHORITY

Expected canonical policy:

``` text
GMV
= SUM(Order.amount)
WHERE status NOT IN (NEW, CANCELLED)
```

Использовать actual repository enums/fields.

Проверить, что старые определения GMV не продолжают жить параллельно.

------------------------------------------------------------------------

# 9. COLLECTED GMV

Expected:

``` text
SUM(Order.paidAmount)
WHERE order qualifies for GMV
```

Это COHORT metric.

Не подменять `Payment.paidAt`.

------------------------------------------------------------------------

# 10. OUTSTANDING GMV

Expected exact authority:

``` text
MAX(0, GMV - Collected GMV)
```

Refund не создаёт автоматически новое customer obligation.

------------------------------------------------------------------------

# 11. DISPLAY RECONCILIATION

Проверить ранее исправленную integer presentation policy:

``` text
display GMV - display Collected = display Outstanding
```

при сохранении exact backend truth.

Representative regression required.

------------------------------------------------------------------------

# 12. COMPLETED GMV

Expected:

``` text
SUM(Order.amount)
WHERE status IN (FULFILLED, CLOSED)
```

или actual frozen status names.

Не смешивать с total qualified GMV.

------------------------------------------------------------------------

# 13. PAYMENT VOLUME

Expected:

``` text
SUM(Payment.amount)
WHERE status = CAPTURED
AND paidAt within event period
```

Это EVENT_PERIOD metric.

------------------------------------------------------------------------

# 14. GMV ≠ PAYMENT VOLUME

Final regression:

``` text
GMV → order cohort/value lifecycle
Payment Volume → payment event-period
```

Payment Volume \> GMV может быть legitimate.

Не "исправлять" такое расхождение без evidence.

------------------------------------------------------------------------

# 15. REFUNDS

Expected:

``` text
SUM(refund amount)
WHERE processed
AND processedAt within event period
```

или actual canonical source.

Проверить:

``` text
Refund amount
≠
Refunds Processed count
```

------------------------------------------------------------------------

# 16. NET PAYMENTS

Expected:

``` text
Payment Volume - Refunds
```

для одинаковой event-period basis.

DB reconciliation required.

------------------------------------------------------------------------

# 17. COMMISSION

Проверить current authority.

Ранее:

``` text
commission reversal NOT IMPLEMENTED
```

Если всё ещё так:

не изображать net commission after refunds.

Limitation должна остаться documented.

------------------------------------------------------------------------

# 18. REFUNDS AND GMV

Проверить frozen principle:

``` text
Refunds are NOT automatically subtracted from GMV.
```

Не менять policy в Stage J.

------------------------------------------------------------------------

# 19. STOREFRONT MRR

Expected:

``` text
SUM(effective contracted recurring total)
for eligible active contracts
```

Authority:

``` text
SubscriptionContract
```

Не:

``` text
active subscriptions × list price
```

------------------------------------------------------------------------

# 20. STOREFRONT ARR

Expected:

``` text
ARR = MRR × 12
```

если Stage I именно так зафиксировал.

Не превращать ARR в annual cash collected.

------------------------------------------------------------------------

# 21. STOREFRONT COLLECTED

Expected:

``` text
SUM(SubscriptionPayment.amount)
WHERE successful
AND paidAt within event period
```

Authority:

``` text
SubscriptionPayment
```

------------------------------------------------------------------------

# 22. STOREFRONT OUTSTANDING

Expected:

``` text
eligible invoice total - successful paid amount
```

Authority:

``` text
SubscriptionInvoice + SubscriptionPayment
```

------------------------------------------------------------------------

# 23. MRR ≠ COLLECTED

Даже если dataset показывает одинаковые значения:

``` text
MRR = Collected
```

семантика остаётся различной.

Проверить labels/subtitles/tooltips.

------------------------------------------------------------------------

# 24. LIST PRICE ≠ CONTRACTED PRICE

Regression mandatory:

``` text
Plan List Price
≠
SubscriptionContract contracted price
```

Existing contract не должен измениться от plan repricing.

------------------------------------------------------------------------

# 25. HOST QUANTITY

Проверить:

``` text
quantity × contracted unit amount = contracted total
```

и MRR использует contracted snapshot.

------------------------------------------------------------------------

# 26. TRIAL

Trial не должен создавать fabricated MRR.

Expected:

``` text
trial MRR = 0
```

если frozen Stage I semantics это подтверждают.

------------------------------------------------------------------------

# 27. `priceUsd` LEGACY CLOSURE

Найти все consumers:

``` bash
rg "priceUsd"
```

Классифицировать каждый:

``` text
active authority
compatibility only
migration only
test fixture
dead legacy
```

Stage I financial metrics не должны использовать `priceUsd`.

------------------------------------------------------------------------

# 28. `totalPaidUsd` LEGACY CLOSURE

Аналогично:

``` bash
rg "totalPaidUsd"
```

Не должен быть collected revenue authority.

------------------------------------------------------------------------

# 29. USD LEAKAGE

Для Storefront billing runtime:

``` text
unexpected "$" = 0
unexpected "USD" = 0
```

если это system financial display.

Canonical currency:

``` text
AZN / ₼
```

------------------------------------------------------------------------

# 30. COMMAND CENTER WIDGET INVENTORY

Re-verify Post-I V2 result.

Expected current result:

``` text
34 Command Center registry entries
33 rendered
1 unsupported trend
```

Не hardcode count as truth --- получить из repository/runtime.

------------------------------------------------------------------------

# 31. THREE-WAY CONSISTENCY

Final check:

``` text
Command Center
↕
WIDGET_REGISTRY
↕
Settings
```

Unexplained orphans = 0.

------------------------------------------------------------------------

# 32. AGREED USEFUL WIDGETS

Повторно проверить:

``` text
Sessions
Storefront Sessions
Marketplace Partners
Storefront Partners
Marketplace Customers
Storefront Customers
Refunds amount
Refunds Processed count
```

Они не должны исчезнуть после regression fixes.

------------------------------------------------------------------------

# 33. SESSIONS

Authority должен оставаться real:

``` text
BehavioralEvent
```

Zero Storefront Sessions допустим, если real.

------------------------------------------------------------------------

# 34. PARTNERS / CUSTOMERS

Проверить реальные sources и marketplace/storefront separation.

No synthetic counts.

------------------------------------------------------------------------

# 35. REQUIRED RECONCILIATION WIDGET

Проверить:

``` text
required = true
removable = false
```

и server/API enforcement, если applicable.

------------------------------------------------------------------------

# 36. `qualified-gmv` LEGACY --- SPECIAL HARD GATE

Post-I V2 сообщил documented legacy:

``` text
qualified-gmv
```

Stage J обязан найти **все** его occurrences и классифицировать.

Проверить:

``` text
runtime rendering?
Settings?
WIDGET_REGISTRY?
API mapping?
financial formula authority?
user preferences?
i18n?
tests?
migration compatibility?
```

------------------------------------------------------------------------

# 37. `qualified-gmv` ACCEPTABLE STATE

VERDICT A допускается только если `qualified-gmv`:

``` text
не создаёт второй GMV
не отображается как отдельная active card
не является active Settings control
не является financial authority
не конфликтует с canonical GMV
```

Если нужен только compatibility/migration alias --- документировать.

------------------------------------------------------------------------

# 38. UNSUPPORTED TREND ENTRY

Post-I V2 сообщил:

``` text
1 unsupported trend
```

Stage J обязан определить:

``` text
widgetId:
почему unsupported:
может ли пользователь его включить:
что показывает UI:
есть ли misleading comparison:
```

Unsupported trend не должен превращаться в fake `0%`/arrow.

------------------------------------------------------------------------

# 39. SETTINGS SHOW/HIDE

Representative runtime:

``` text
GMV
Refunds
Sessions
Marketplace/Storefront candidate
storefront-mrr
storefront-collected
```

Проверить:

``` text
hide → gone
reload → remains hidden
show → visible
reload → remains visible
```

------------------------------------------------------------------------

# 40. SETTINGS CANNOT BYPASS SECURITY

Negative test:

``` text
role lacks section permission
→ Settings cannot enable restricted widget
→ API still denies/filters
```

------------------------------------------------------------------------

# 41. OLD USER PREFERENCES

Regression:

``` text
legacy IDs
missing new IDs
unknown IDs
removed IDs
```

не должны ломать Command Center.

------------------------------------------------------------------------

# 42. WHAT --- DECISION SIGNALS

Expected 6 signal types:

``` text
BOOKING_CONFIRMATION_DELAY
FAILED_PAYMENTS
RECENT_CANCELLATIONS
PENDING_REFUNDS
UPCOMING_BOOKINGS
SERVICES_WITHOUT_SALES
```

Re-verify actual current registry/types.

------------------------------------------------------------------------

# 43. DETECTORS

Expected:

``` text
6/6 triggerable
```

Проверить current representative dataset/evidence.

Не менять thresholds только ради trigger.

------------------------------------------------------------------------

# 44. TEMPORAL QUERY SAFETY

Regression для prior defect:

``` text
recent cancellations query
createdAt > cutoff AND createdAt <= now
```

Future-dated records не должны создавать negative durations.

------------------------------------------------------------------------

# 45. WHY

Для всех signals проверить:

``` text
observed driver only when evidence supports
insufficient evidence when not provable
no fabricated causality
```

------------------------------------------------------------------------

# 46. WHY ATTRIBUTION

Не требовать искусственно `OBSERVED_DRIVER` для каждого signal.

Honest:

``` text
INSUFFICIENT_EVIDENCE
```

допустим и желателен, когда данных недостаточно.

------------------------------------------------------------------------

# 47. IMPACT

Expected statuses:

``` text
PROVEN
PARTIALLY_PROVEN
INFORMATIONAL
INSUFFICIENT_EVIDENCE
```

Проверить current implementation.

------------------------------------------------------------------------

# 48. IMPACT NO-FABRICATION

Запрещено:

``` text
count × arbitrary coefficient
failed payments = lost revenue
pending refunds = cash outflow
GMV = revenue/loss
```

------------------------------------------------------------------------

# 49. IMPACT UNITS

Проверить:

``` text
count
AZN
minutes/hours/days
ratio
```

UI должен локализовать unit presentation.

Raw:

``` text
51 count
244817 minutes
```

не должен появляться.

------------------------------------------------------------------------

# 50. ACTION

Expected Stage F boundary:

``` text
NAVIGATION_ONLY
```

для всех 6 signals, если current frozen architecture не менялась.

------------------------------------------------------------------------

# 51. ACTION MATRIX

Re-verify:

``` text
BOOKING_CONFIRMATION_DELAY → bookings
FAILED_PAYMENTS → payments
RECENT_CANCELLATIONS → orders
PENDING_REFUNDS → pending refunds view
UPCOMING_BOOKINGS → upcoming bookings
SERVICES_WITHOUT_SALES → products/availability
```

Использовать actual routes.

------------------------------------------------------------------------

# 52. ACTION RBAC

Каждый action:

``` text
requiredPermission
backend authority
frontend visibility
```

Проверить negative case.

------------------------------------------------------------------------

# 53. SIGNAL LIFECYCLE ≠ ACTION LIFECYCLE

Не допустить, чтобы navigation автоматически меняла signal state.

------------------------------------------------------------------------

# 54. AI DECISION FEED

Проверить Category B boundary:

``` text
separate informational insight
not duplicate DecisionSignal authority
no executable actions
```

------------------------------------------------------------------------

# 55. AI FEED NO-FABRICATION

Не должно вернуться:

``` text
+165 AZN/week
orders × coefficient
arbitrary uplift
```

------------------------------------------------------------------------

# 56. AI FEED FINANCIAL LANGUAGE

Если показывается affected volume:

он должен быть provable aggregate и корректно называться:

``` text
affected volume
```

не:

``` text
lost revenue
potential profit
```

без authority.

------------------------------------------------------------------------

# 57. AI FEED LOCALIZATION

Проверить title и content:

``` text
RU
AZ
EN
```

Включая:

``` text
Лента решений ИИ
AI Qərar Lentesi
AI Decision Feed
```

или current approved translations.

------------------------------------------------------------------------

# 58. DECISION QUEUE LOCALIZATION

Для 6 cards × 3 locales:

``` text
title
subtitle
evidence
WHY
IMPACT
ACTION
status
category
relative time
units
payment enums
```

------------------------------------------------------------------------

# 59. NO MIXED LOCALE

Hard gates:

``` text
RU CJK fragments = 0
AZ Russian system fragments = 0
AZ raw English units = 0
raw payment enums = 0
raw i18n keys = 0
```

------------------------------------------------------------------------

# 60. RELATIVE TIME

Проверить:

``` text
RU
AZ
EN
```

No:

``` text
3h ago
```

в AZ/RU.

------------------------------------------------------------------------

# 61. PAYMENT ENUM LOCALIZATION

Например:

``` text
BANK_TRANSFER
CARD
MOBILE_PAYMENT
```

не должны показываться raw в user-facing Decision Queue.

------------------------------------------------------------------------

# 62. ZERO-DAY UPCOMING

Regression:

``` text
0 days from now
```

должно иметь natural localized representation (`сегодня`, `bu gün`,
`today`) согласно current policy.

------------------------------------------------------------------------

# 63. SECURITY --- PAGE GATE

Re-verify:

``` text
analytics.read
```

или actual Command Center page permission.

Frontend hiding недостаточно.

------------------------------------------------------------------------

# 64. SECURITY --- SECTION GATES

Expected section permissions include:

``` text
dashboard.executive.read
dashboard.operational.read
dashboard.financial.read
dashboard.marketplace.read
```

Использовать actual current permission set.

------------------------------------------------------------------------

# 65. ROLE MATRIX

Re-verify current defaults for:

``` text
ADMIN
DIRECTOR
ANALYST
MARKETER
FINANCE
MODERATOR
SALES_MANAGER
OPERATOR
```

Особенно ранее frozen:

``` text
analytics.read only for ADMIN, DIRECTOR, ANALYST, MARKETER
```

Если architecture после этого легитимно изменилась --- показать
evidence; не менять в Stage J.

------------------------------------------------------------------------

# 66. SERVER-SIDE SECTION AUTHORITY

Пользователь без permission:

``` text
не должен получить данные restricted section из API
```

не только не видеть UI.

------------------------------------------------------------------------

# 67. WIDGET CUSTOMIZATION ≠ AUTHORIZATION

`dashboard.customize` не должен давать read access к section.

------------------------------------------------------------------------

# 68. PLATFORM / PARTNER ISOLATION

Проверить:

``` text
PLATFORM
PARTNER
```

context separation.

Partner не получает platform-wide metrics.

------------------------------------------------------------------------

# 69. TENANT ISOLATION

Cross-partner access:

``` text
partner A cannot read partner B data
```

Минимум API negative tests.

------------------------------------------------------------------------

# 70. STOREFRONT BILLING ISOLATION

Особенно:

``` text
SubscriptionContract
SubscriptionInvoice
SubscriptionPayment
```

Проверить tenant/workspace scope.

------------------------------------------------------------------------

# 71. BILLING MUTATION SECURITY

Step 3.29D regressions:

``` text
overpayment rejected
currency mismatch rejected
invoice idempotency
cancelled contract no future invoices
```

------------------------------------------------------------------------

# 72. BILLING CONCURRENCY / IDEMPOTENCY

Re-run relevant tests.

Не создавать duplicate invoice for same:

``` text
contractId + periodStart
```

------------------------------------------------------------------------

# 73. TRIAL → PAID

Regression deterministic conversion.

Не создавать duplicate active contracts/invoices.

------------------------------------------------------------------------

# 74. DATA INTEGRITY

Representative DB checks:

``` text
orphan orders
orphan payments
orphan refunds
orphan billing contracts/invoices/payments
invalid workspace relationships
```

Expected:

``` text
0 unexplained integrity defects
```

------------------------------------------------------------------------

# 75. DB/API/UI RECONCILIATION --- FINANCIAL

Для representative period(s):

``` text
MONTH
YEAR
LAST_7_DAYS
```

если current API поддерживает их.

Минимум:

``` text
GMV
Collected GMV
Outstanding
Completed GMV
Payment Volume
Refunds
Net Payments
Commission
```

DB = API = UI.

------------------------------------------------------------------------

# 76. DB/API/UI --- STOREFRONT BILLING

Минимум:

``` text
MRR
ARR
Collected
Outstanding
```

DB = API = UI.

------------------------------------------------------------------------

# 77. DB/API/UI --- MARKETPLACE COUNTS

Representative:

``` text
Sessions
Storefront Sessions
Marketplace Partners
Storefront Partners
Marketplace Customers
Storefront Customers
```

------------------------------------------------------------------------

# 78. OPERATIONAL COUNTS

Representative reconciliation:

``` text
Orders Fulfilled
Bookings Confirmed
Bookings Completed
Payments Captured
Refunds Processed
```

------------------------------------------------------------------------

# 79. COMPARISON / PREVIOUS PERIOD

Проверить cards с comparison:

``` text
current
previous
absolute delta
percentage
direction
```

No divide-by-zero fabrication.

------------------------------------------------------------------------

# 80. NO COMPARISON WHEN UNSUPPORTED

Если comparison/trend unavailable:

UI должен показывать honest unavailable/no comparison state.

Не fake `0%`.

------------------------------------------------------------------------

# 81. PERIOD / DATE AUTHORITY

Проверить, что metric использует правильную дату:

``` text
Order.createdAt
Payment.paidAt
Refund.processedAt
Contract effective date
Invoice/payment dates
```

согласно semantic dictionary.

------------------------------------------------------------------------

# 82. TIMEZONE

Проверить frozen timezone policy.

Boundary records не должны прыгать между periods из-за inconsistent
timezone handling.

------------------------------------------------------------------------

# 83. PERFORMANCE --- COMMAND CENTER

Измерить representative runtime.

Вернуть:

``` text
dashboard API p50/p95 or repeated timings
browser load
query count if available
```

Не требуется performance optimization без regression.

------------------------------------------------------------------------

# 84. PERFORMANCE --- NO N+1

Проверить новые Stage I/registry paths.

No per-widget DB/API request explosion.

------------------------------------------------------------------------

# 85. SEED / REPRESENTATIVE DATA

Если используется seed dataset:

``` text
idempotent
no destructive production behavior
```

Stage J не должен менять seed только чтобы тесты прошли, кроме
доказанного defect.

------------------------------------------------------------------------

# 86. TEST ISOLATION

Сохранить ранее исправленную E2E isolation architecture.

Проверить отсутствие regression shared-DB leakage.

------------------------------------------------------------------------

# 87. EVENT BUS / GLOBAL STATE

Relevant regression для ранее исправленного leakage.

------------------------------------------------------------------------

# 88. CI MODE

Не возвращать misleading reliance на `--runInBand`, если frozen CI
architecture его удаляла.

------------------------------------------------------------------------

# 89. TYPESCRIPT

Обязательно:

``` text
backend TSC
frontend TSC
```

clean.

------------------------------------------------------------------------

# 90. BUILD

Обязательно:

``` text
backend build
frontend build
```

clean.

------------------------------------------------------------------------

# 91. TEST SUITES

Запустить максимально полный feasible набор.

Вернуть exact:

``` text
Backend tests:
Frontend tests:
Billing tests:
Dashboard tests:
Command Center tests:
i18n tests:
Security/E2E:
```

Не писать просто "all pass" без counts.

------------------------------------------------------------------------

# 92. BROWSER RUNTIME --- REQUIRED

Stage J нельзя закрыть только unit tests.

Проверить actual browser DOM/runtime.

Минимум:

``` text
RU
AZ
EN
```

------------------------------------------------------------------------

# 93. BROWSER --- COMMAND CENTER

Проверить:

``` text
all sections render
no raw keys
no system IDs
no CJK
no mixed locale
financial cards
Storefront cards
zero values
comparisons
```

------------------------------------------------------------------------

# 94. BROWSER --- SETTINGS

Проверить:

``` text
same registry
show/hide
persistence
mandatory widget behavior
Stage I widgets
agreed useful widgets
```

------------------------------------------------------------------------

# 95. BROWSER --- DECISION QUEUE

Все 6 signals:

``` text
WHAT
WHY
IMPACT
ACTION
```

в representative locale, плюс localization matrix evidence.

------------------------------------------------------------------------

# 96. BROWSER --- AI FEED

Проверить:

``` text
localized title
localized content
no fabricated financial uplift
no action recommendations crossing Stage F boundary
```

------------------------------------------------------------------------

# 97. BROWSER --- ROLE NEGATIVE CASE

Хотя бы один restricted role:

``` text
page/section/widget/action denial
```

с evidence.

------------------------------------------------------------------------

# 98. BROWSER --- PARTNER NEGATIVE CASE

Проверить отсутствие platform-wide leakage в PARTNER workspace.

------------------------------------------------------------------------

# 99. RAW STRING SEARCH

Repository searches минимум:

``` text
等待
最老
count"
minutes"
+165 AZN/week
AZN/week
Potential value
qualified-gmv
priceUsd
totalPaidUsd
cc.kpi.
```

Интерпретировать результаты; наличие строки в test/report не равно
runtime defect.

------------------------------------------------------------------------

# 100. HARDCODED RU/AZ/EN SYSTEM TEXT

Проверить новые/изменённые Command Center компоненты на hardcoded
locale-specific system prose там, где должен использоваться i18n.

------------------------------------------------------------------------

# 101. DEAD CODE / LEGACY

Найти relevant dead/legacy paths:

``` text
old GMV formula
old AI Feed coefficient
old impact hardcoded labels
old widget aliases
old billing revenue shortcuts
```

Не делать широкую cleanup вне scope.

Удалять только если безопасно и доказано.

------------------------------------------------------------------------

# 102. NO SECOND FINANCIAL TRUTH

Final hard gate:

в системе не должно быть параллельных conflicting formulas для одного и
того же KPI.

Если compatibility formula существует:

она не должна быть runtime authority.

------------------------------------------------------------------------

# 103. NO FABRICATION FINAL SEARCH

Искать patterns/arbitrary constants, особенно financial derivations.

Любая оценочная финансовая формула должна иметь documented authority.

------------------------------------------------------------------------

# 104. REMEDIATION POLICY

Если найден defect:

``` text
P0/P1/P2 classify
root cause
minimal fix
regression test
runtime evidence
```

Не redesign entire module.

------------------------------------------------------------------------

# 105. P0

Examples:

``` text
security leak
cross-tenant leak
fabricated financial metric
wrong financial authority
destructive billing defect
```

VERDICT A невозможен до fix.

------------------------------------------------------------------------

# 106. P1

Examples:

``` text
wrong widget mapping
incorrect localization affecting meaning
Decision Queue semantic error
incorrect period/date authority
```

VERDICT A невозможен до fix.

------------------------------------------------------------------------

# 107. P2

Examples:

``` text
label clarity
non-material presentation inconsistency
```

Можно исправить в Stage J; unresolved P2 должен быть explicitly accepted
only if truly non-blocking.

------------------------------------------------------------------------

# 108. DOCUMENTATION TRUTH

Не копировать старые claims без re-verification.

Если current code расходится со старым report:

``` text
code/runtime truth wins
```

и discrepancy документировать.

------------------------------------------------------------------------

# 109. REQUIRED DELIVERABLE A --- ENTRY / GIT

``` text
Starting HEAD:
origin/master:
Working tree:
Entry dependencies:
```

------------------------------------------------------------------------

# 110. REQUIRED DELIVERABLE B --- FINAL SEMANTIC DICTIONARY

Полная таблица финансовых metrics.

------------------------------------------------------------------------

# 111. REQUIRED DELIVERABLE C --- FINANCIAL RECONCILIATION

  Metric     DB   API   UI   PASS
  -------- ---- ----- ---- ------

По representative periods.

------------------------------------------------------------------------

# 112. REQUIRED DELIVERABLE D --- STOREFRONT BILLING

``` text
MRR:
ARR:
Collected:
Outstanding:
List vs Contract:
Trial:
Quantity:
Legacy USD fields:
```

------------------------------------------------------------------------

# 113. REQUIRED DELIVERABLE E --- WIDGET REGISTRY

``` text
Command Center count:
Registry count:
Settings source:
Orphans:
Duplicates:
qualified-gmv:
unsupported trend:
```

------------------------------------------------------------------------

# 114. REQUIRED DELIVERABLE F --- AGREED USEFUL WIDGETS

  Widget     Registry   CC   Settings Authority     Runtime
  -------- ---------- ---- ---------- ----------- ---------

Для Sessions/Partners/Customers/Refunds pair.

------------------------------------------------------------------------

# 115. REQUIRED DELIVERABLE G --- DECISION LOOP

  Signal     WHAT   WHY   IMPACT   ACTION   Localized   PASS
  -------- ------ ----- -------- -------- ----------- ------

Все 6.

------------------------------------------------------------------------

# 116. REQUIRED DELIVERABLE H --- AI FEED

``` text
Category B:
Evidence source:
Fabrication search:
Action boundary:
RU:
AZ:
EN:
```

------------------------------------------------------------------------

# 117. REQUIRED DELIVERABLE I --- SECURITY

``` text
Page RBAC:
Section RBAC:
Widget customization:
Action RBAC:
Platform/Partner:
Tenant isolation:
Billing isolation:
Negative tests:
```

------------------------------------------------------------------------

# 118. REQUIRED DELIVERABLE J --- LOCALIZATION

``` text
RU:
AZ:
EN:
raw keys:
raw IDs:
CJK:
mixed locale:
raw enums:
raw units:
USD/$:
```

------------------------------------------------------------------------

# 119. REQUIRED DELIVERABLE K --- RUNTIME

``` text
Command Center:
Settings:
Decision Queue:
AI Feed:
Role negative:
Partner negative:
```

Browser evidence required.

------------------------------------------------------------------------

# 120. REQUIRED DELIVERABLE L --- PERFORMANCE

``` text
Dashboard timings:
Query/request behavior:
N+1:
Regression:
```

------------------------------------------------------------------------

# 121. REQUIRED DELIVERABLE M --- TESTS

``` text
Backend:
Frontend:
Billing:
Dashboard:
Command Center:
i18n:
Security/E2E:
TSC:
Build:
```

Exact counts.

------------------------------------------------------------------------

# 122. REQUIRED DELIVERABLE N --- FINDINGS

Для каждого finding:

  ID   Severity   Root Cause   Fix   Test   Runtime Evidence   Status
  ---- ---------- ------------ ----- ------ ------------------ --------

Если findings = 0 --- так и указать.

------------------------------------------------------------------------

# 123. REQUIRED DELIVERABLE O --- LEGACY

``` text
qualified-gmv:
priceUsd:
totalPaidUsd:
old GMV paths:
old AI Feed fabrication:
old hardcoded impact labels:
```

------------------------------------------------------------------------

# 124. REQUIRED DELIVERABLE P --- GIT FINAL

``` text
Starting HEAD:
Final HEAD:
Files changed:
New files:
Migrations:
Commit:
Pushed:
origin/master:
Working tree clean:
```

------------------------------------------------------------------------

# 125. REPORT

Создать:

``` text
docs/prompts/PHASE_3_STAGE_J_FINAL_REGRESSION_SECURITY_EVIDENCE_CLOSURE_REPORT.md
```

Отчёт полностью на русском.

------------------------------------------------------------------------

# 126. ROADMAP UPDATE

Только при VERDICT A:

``` text
Stage J — COMPLETE
Phase 3 Command Center C→J — CLOSED
```

Не объявлять весь TravelHub завершённым.

------------------------------------------------------------------------

# 127. ACCEPTANCE CRITERIA --- ENTRY

VERDICT A только если:

1.  All Stage C--I dependencies re-verified.
2.  Repository state known.
3.  No unexplained dirty worktree contamination.

------------------------------------------------------------------------

# 128. ACCEPTANCE --- FINANCIAL

4.  GMV authority correct.
5.  Collected GMV authority correct.
6.  Outstanding formula correct.
7.  Display rounding reconciliation preserved.
8.  Completed GMV correct.
9.  Payment Volume event semantics correct.
10. GMV ≠ Payment Volume preserved.
11. Refund amount correct.
12. Refund count distinct.
13. Net Payments reconciles.
14. Commission authority correct.
15. Refunds not silently subtracted from GMV.
16. No fake commission reversal.

------------------------------------------------------------------------

# 129. ACCEPTANCE --- STOREFRONT BILLING

17. MRR uses contracted authority.
18. ARR semantics correct.
19. Collected uses SubscriptionPayment.
20. Outstanding uses invoice/payment authority.
21. MRR ≠ Collected preserved.
22. List ≠ Contract preserved.
23. Host quantity correct.
24. Trial semantics correct.
25. priceUsd not metric authority.
26. totalPaidUsd not collected authority.
27. No unexpected Storefront USD/\$ runtime leakage.

------------------------------------------------------------------------

# 130. ACCEPTANCE --- REGISTRY

28. CC/Registry/Settings consistent.
29. Unexplained orphans = 0.
30. Duplicate IDs = 0.
31. Semantic duplicates = 0.
32. Agreed useful widgets preserved.
33. Reconciliation mandatory policy preserved.
34. qualified-gmv legacy harmless and documented.
35. Unsupported trend honest/no fake comparison.
36. Show/hide persistence works.
37. Settings cannot bypass permissions.

------------------------------------------------------------------------

# 131. ACCEPTANCE --- DECISION LOOP

38. All 6 signals valid.
39. Detectors evidence-based.
40. Future-date temporal defect remains fixed.
41. WHY no fabricated causality.
42. IMPACT no fabricated values.
43. IMPACT units localized.
44. ACTION remains safe and authorized.
45. Signal/action lifecycle separation preserved.

------------------------------------------------------------------------

# 132. ACCEPTANCE --- AI FEED

46. AI Feed remains Category B.
47. No arbitrary financial uplift.
48. No duplicate ACTION authority.
49. RU/AZ/EN localized.

------------------------------------------------------------------------

# 133. ACCEPTANCE --- SECURITY

50. Page RBAC server-side.
51. Section RBAC server-side.
52. Customize permission does not grant read.
53. Role defaults preserved.
54. Platform/Partner isolation passes.
55. Cross-tenant negative tests pass.
56. Billing tenant isolation passes.
57. Billing idempotency/security regressions pass.

------------------------------------------------------------------------

# 134. ACCEPTANCE --- LOCALIZATION / RUNTIME

58. RU PASS.
59. AZ PASS.
60. EN PASS.
61. CJK runtime = 0.
62. Raw i18n keys runtime = 0.
63. Raw system IDs runtime = 0.
64. Mixed-locale system fragments = 0.
65. Raw payment enums = 0.
66. Raw units = 0.
67. Browser Command Center PASS.
68. Browser Settings PASS.
69. Browser Decision Queue PASS.
70. Browser AI Feed PASS.
71. Browser restricted-role case PASS.
72. Browser partner isolation case PASS.

------------------------------------------------------------------------

# 135. ACCEPTANCE --- DATA / PERFORMANCE / TESTS

73. DB/API/UI financial reconciliation PASS.
74. DB/API/UI Storefront billing reconciliation PASS.
75. Useful marketplace widgets reconcile.
76. Operational counts reconcile.
77. Date authorities correct.
78. Timezone boundaries consistent.
79. No unexplained integrity defects.
80. No N+1 regression.
81. Performance acceptable.
82. Backend tests PASS.
83. Frontend tests PASS.
84. Billing tests PASS.
85. Security/E2E PASS.
86. TSC both clean.
87. Builds clean.
88. No P0/P1 open.
89. No fabricated second financial truth.
90. Stage J report created in Russian.

------------------------------------------------------------------------

# 136. FINAL VERDICT

Вернуть ровно один:

## VERDICT A --- STAGE J COMPLETE / FINAL REGRESSION, SECURITY & EVIDENCE CLOSURE VERIFIED / PHASE 3 COMMAND CENTER C→J CLOSED

или:

## VERDICT B --- STAGE J REMEDIATION REQUIRED

Разделить gaps:

``` text
Financial:
Storefront Billing:
Widget Registry:
Decision Loop:
AI Feed:
RBAC:
Tenant Isolation:
Localization:
Runtime:
Performance:
Tests:
Legacy:
```

или:

## VERDICT C --- STAGE J BLOCKED / REQUIRED EVIDENCE CANNOT BE ESTABLISHED

Только если необходимый authoritative source/environment реально
недоступен.

------------------------------------------------------------------------

# 137. STOP

После финального отчёта:

**STOP.**

Не запускать следующий Phase/Stage автоматически. Не добавлять новую
функциональность после VERDICT.
