# PHASE 3 --- STAGE I

# STOREFRONT REVENUE SEMANTIC FIX

## DEPENDENCY-AWARE ENTRY GATE + CONDITIONAL IMPLEMENTATION

## Step 3.29D BILLING ENGINE AUTHORITY REQUIRED

------------------------------------------------------------------------

## 1. ЯЗЫК

Все ответы разработчика, findings, таблицы, evidence, отчёт и VERDICT
--- **НА РУССКОМ ЯЗЫКЕ**. Код, identifiers, paths, enums, commands, SHA
и commit messages можно сохранять в оригинале.

------------------------------------------------------------------------

# 2. CANONICAL SOURCE

Canonical roadmap:

``` text
Stage I — Storefront Revenue Semantic Fix

Dependencies:
- Stage H (partial)
- Step 3.29D (billing engine)

Scope:
- priceUsd migration
- AZN billing
- MRR/ARR semantics
- dynamic pricing
- List Price ≠ Contracted Price
```

Stage I нельзя реализовывать поверх demo/list-price данных, если Step
3.29D не предоставляет authoritative billing contract.

------------------------------------------------------------------------

# 3. ENTRY STATUS

``` text
Stage C — WHAT                                  COMPLETE
Stage D — WHY                                   COMPLETE
Stage E — IMPACT                                COMPLETE
Stage F — ACTION                                COMPLETE
Stage G — AI Decision Feed                      COMPLETE
Stage H — Executive/Operational/Financial       COMPLETE
Post-H Widget Registry Reconciliation           COMPLETE

Stage I                                         ENTRY GATE NOW
Stage J                                         DO NOT START
```

------------------------------------------------------------------------

# 4. КРИТИЧЕСКИЙ ПРИНЦИП

До изменения production code определить:

``` text
Step 3.29D status
Billing engine exists?
Billing engine authoritative?
Contracted subscription price exists?
Billing currency authority exists?
Billing periods/invoices/charges exist?
```

Если Step 3.29D не выполнен или billing authority отсутствует:

``` text
STOP IMPLEMENTATION
VERDICT C — BLOCKED BY STEP 3.29D
```

Не создавать временный MRR/ARR из list price.

------------------------------------------------------------------------

# 5. PHASE A --- STEP 3.29D DEPENDENCY AUDIT

Найти в repository:

``` text
canonical roadmap Step 3.29D
implementation report
architecture/ADR
migrations
billing/subscription models
services/controllers
tests
runtime endpoints
```

Вернуть:

``` text
Step 3.29D canonical name:
Canonical status:
Implementation evidence:
Commit/report:
Runtime evidence:
Dependency satisfied: YES/NO
```

------------------------------------------------------------------------

# 6. BILLING AUTHORITY CHECKLIST

Для PASS должны существовать доказуемые ответы минимум на:

``` text
subscription/customer contract identity
plan identity
contracted price
billing currency
billing interval
effectiveFrom/effectiveTo
subscription status
trial semantics
discount/override semantics
price change semantics
cancellation semantics
renewal semantics
```

Если часть отсутствует --- определить, является ли она обязательной для
Stage I.

------------------------------------------------------------------------

# 7. LIST PRICE ≠ CONTRACTED PRICE --- FROZEN PRINCIPLE

Canonical invariant:

``` text
Plan/List Price
≠
Contracted Subscription Price
```

Пример:

``` text
Plan list price:        199 ₼ / month
Contracted price:       169 ₼ / month
```

MRR authority:

``` text
169 ₼
```

а не:

``` text
199 ₼
```

если contract действительно 169.

Нельзя вычислять MRR по текущему plan price для существующих contracts.

------------------------------------------------------------------------

# 8. DEMO DATA WARNING

Ранее dataset содержал:

``` text
FREE_TRIAL
PREMIUM @199 AZN
```

и Storefront subscriptions.

Это **не доказывает billing authority**.

Seed/list value нельзя автоматически считать:

``` text
Collected Revenue
MRR
ARR
Contracted Revenue
```

------------------------------------------------------------------------

# 9. CONDITIONAL BRANCH

## Если dependency FAIL

Не менять production code.

Создать dependency report и вернуть:

``` text
VERDICT C — STAGE I BLOCKED / STEP 3.29D BILLING ENGINE AUTHORITY REQUIRED
```

Указать точный missing prerequisite.

## Если dependency PASS

Продолжить Sections 10--44.

------------------------------------------------------------------------

# 10. PRICEUSD AUDIT

Canonical Stage I требует:

``` text
priceUsd migration
```

Найти все Storefront billing/subscription usages:

``` text
priceUsd
USD
$
hardcoded USD
currency defaults
plan pricing DTOs
billing records
frontend types
seed
tests
```

Классифицировать каждое использование:

``` text
billing authority
legacy field
display-only
test fixture
unrelated domain
```

Не делать global blind replace `USD → AZN`.

------------------------------------------------------------------------

# 11. AZN BILLING AUTHORITY

Canonical billing currency для текущего TravelHub Storefront:

``` text
AZN
```

User-facing:

``` text
₼
```

Но migration должна сохранять historical correctness.

Не менять historical monetary values без explicit conversion/migration
policy.

------------------------------------------------------------------------

# 12. PRICE MIGRATION POLICY

До migration ответить:

``` text
Does priceUsd store numeric USD value?
Was it actually misnamed AZN?
Are historical records present?
Is currency separately stored?
Can rows have different currencies?
```

Только после этого выбрать migration.

Запрещено:

``` text
rename priceUsd → priceAzn
```

без доказательства, что значения действительно AZN.

------------------------------------------------------------------------

# 13. PREFERRED MONEY MODEL

Если architecture позволяет, предпочтительнее semantic contract:

``` text
amount
currency
```

или эквивалентная typed Money structure, а не currency в имени поля.

Но не проводить большой cross-system money redesign вне Stage I.

------------------------------------------------------------------------

# 14. CONTRACTED PRICE

Для active Storefront subscription должен существовать
immutable/effective contracted pricing fact либо эквивалент.

Проверить:

``` text
contractedAmount
currency
billingInterval
effective dates
source plan/version
discount/override
```

MRR не должен зависеть от mutable current list price.

------------------------------------------------------------------------

# 15. DYNAMIC PRICING --- SEMANTIC SCOPE

Canonical Stage I упоминает:

``` text
dynamic pricing
```

Сначала определить, что roadmap подразумевает именно для Storefront
SaaS.

Допустимые варианты могут включать:

``` text
host-count tiers
contract overrides
discounts
promotional periods
plan versioning
```

Не внедрять marketplace product dynamic pricing сюда.

------------------------------------------------------------------------

# 16. HOST-COUNT SUBSCRIPTION REQUIREMENT

Проверить архитектурное требование Storefront:

``` text
subscription variants depend on number of hosts using platform
```

Определить, поддерживает ли Step 3.29D:

``` text
seat/host quantity
unit price
tier price
contracted total
effective changes
```

Если Stage I требует это, использовать billing authority, а не frontend
calculation.

------------------------------------------------------------------------

# 17. MRR DEFINITION

До реализации зафиксировать canonical MRR.

Минимально:

``` text
MRR = normalized monthly contracted recurring value
      of eligible active recurring Storefront subscriptions
```

Но eligibility должна быть доказана.

Явно определить:

``` text
ACTIVE
TRIAL
PAST_DUE
CANCELLED
EXPIRED
SUSPENDED
future-start
```

используя реальные repository enums.

------------------------------------------------------------------------

# 18. MRR NORMALIZATION

Если billing intervals отличаются:

``` text
MONTHLY → contracted amount
ANNUAL  → contracted annual amount / 12
```

Другие intervals --- документировать.

Не нормализовать one-time charges в MRR.

------------------------------------------------------------------------

# 19. ARR DEFINITION

Canonical:

``` text
ARR = annualized recurring run-rate
```

Если policy:

``` text
ARR = MRR × 12
```

зафиксировать явно.

ARR ≠ annual cash collected.

ARR ≠ yearly invoice total unless semantics совпадают.

------------------------------------------------------------------------

# 20. TRIALS

FREE_TRIAL:

``` text
MRR contribution = 0
ARR contribution = 0
```

если нет contracted paid recurring amount during trial.

Не использовать будущую list price как текущий MRR.

------------------------------------------------------------------------

# 21. DISCOUNTS / CONTRACT OVERRIDES

Если:

``` text
List = 199
Contract = 169
```

MRR должен использовать 169.

Если discount временный:

``` text
effective period
post-discount contracted price
```

должны быть deterministic.

------------------------------------------------------------------------

# 22. PLAN PRICE CHANGES

Критический regression:

``` text
existing contract at 169
plan list price changed 199 → 229
existing contract MRR remains 169
```

если contract не repriced.

Новый contract может получить 229 согласно billing policy.

------------------------------------------------------------------------

# 23. CANCELLATION

Определить:

``` text
cancel immediately
cancel at period end
```

и MRR eligibility.

Не считать cancelled subscription active без policy.

------------------------------------------------------------------------

# 24. PAST DUE / PAYMENT FAILURE

MRR --- run-rate metric, поэтому `PAST_DUE` semantics должны быть
определены отдельно от collected cash.

Не путать:

``` text
MRR
Collected Subscription Revenue
Cash Receipts
```

------------------------------------------------------------------------

# 25. STOREFRONT REVENUE METRICS

Stage I должен определить минимум:

``` text
List Price
Contracted Price
MRR
ARR
```

Дополнительные:

``` text
Collected Subscription Revenue
Outstanding Subscription Billing
```

только если billing engine предоставляет authority и canonical scope
требует их.

------------------------------------------------------------------------

# 26. PLATFORM REVENUE MIX

Stage H не должен был считать Storefront list value revenue.

После Stage I проверить, можно ли теперь доказуемо строить:

``` text
Marketplace commission contribution
Storefront recurring revenue contribution
```

Если да --- документировать authority.

Если нет --- не форсировать Revenue Mix.

------------------------------------------------------------------------

# 27. MRR ≠ COLLECTED REVENUE

UI labels и API contract должны ясно различать:

``` text
MRR → recurring run-rate
Collected subscription revenue → actual billed/paid event metric
```

Не показывать MRR как «Получено».

------------------------------------------------------------------------

# 28. DATE AUTHORITY

Для каждой metric:

``` text
MRR → snapshot/effective-at date
ARR → snapshot/effective-at date
Collected billing → payment/event date
Contracted price → effective contract period
```

Не применять один generic `createdAt`.

------------------------------------------------------------------------

# 29. TIMEZONE

Использовать canonical platform timezone policy.

Особенно проверить boundaries:

``` text
subscription effective date
renewal
cancellation
month-end
```

------------------------------------------------------------------------

# 30. CURRENCY

API должен явно сохранять currency authority.

Browser:

``` text
AZN/₼ expected
unexpected USD/$ = 0
```

для Storefront billing UI.

------------------------------------------------------------------------

# 31. SETTINGS / WIDGET REGISTRY

После Post-H reconciliation новые Stage I widgets, если добавляются в
Command Center, должны проходить через canonical `WIDGET_REGISTRY`.

Не создавать отдельный Settings list.

Для каждого:

``` text
widgetId
section
labelKey
customizable
mandatory
permission
workspace applicability
default visibility
```

------------------------------------------------------------------------

# 32. COMMAND CENTER PLACEMENT

Не перегружать Executive.

MRR/ARR логичнее рассматривать в Financial/Marketplace/Storefront
context в зависимости от current architecture.

Для каждого нового KPI ответить:

``` text
What decision does it enable?
Why top-level?
Which section?
```

------------------------------------------------------------------------

# 33. PLATFORM VS PARTNER SCOPE

Platform may see aggregate Storefront SaaS metrics.

Individual Storefront partner не должен видеть platform-wide MRR/ARR.

Сохранить tenant scope, RBAC и entitlement boundaries.

------------------------------------------------------------------------

# 34. RBAC

Сохранить server-side authority.

Новые metrics должны использовать canonical section permissions.

Settings visibility не может обходить permission.

------------------------------------------------------------------------

# 35. NO FABRICATION

Запрещено:

``` text
active subscriptions × current list price
partners × 199
trial users × future premium price
host count × arbitrary coefficient
```

если это не contracted billing fact.

------------------------------------------------------------------------

# 36. DB/API/UI RECONCILIATION

Для Stage I metrics:

``` text
List Price
Contracted Price
MRR
ARR
```

и collected billing metrics, если реализованы:

``` text
DB = API = UI
```

Показать exact и display values.

------------------------------------------------------------------------

# 37. REPRESENTATIVE CONTRACT CASES

Dataset/tests должны покрывать минимум:

``` text
A. monthly active at list price
B. monthly active with contract discount
C. annual contract normalized to MRR
D. free trial
E. cancelled
F. plan list price changed after contract
G. host-count/tier case if supported
```

Не reseed production-like demo data без необходимости.

------------------------------------------------------------------------

# 38. MIGRATION SAFETY

Если schema migration нужна:

``` text
forward migration
existing row treatment
backfill policy
nullability
constraints
indexes
rollback/compatibility consideration
```

No destructive migration without evidence.

------------------------------------------------------------------------

# 39. API COMPATIBILITY

Если `priceUsd` удаляется/переименовывается:

проверить consumers:

``` text
frontend
tests
seed
API clients
DTOs
serialization
```

Если нужна transitional compatibility --- реализовать explicit
deprecation, не silent semantic mutation.

------------------------------------------------------------------------

# 40. LOCALIZATION

Все новые billing labels RU/AZ/EN.

Минимум:

``` text
List Price
Contracted Price
MRR
ARR
Billing interval
Subscription status
```

Raw keys = 0.

------------------------------------------------------------------------

# 41. TESTS --- REQUIRED

Минимум regression tests:

``` text
List Price != Contracted Price
MRR uses contracted price
trial contributes 0
annual normalization
plan repricing does not silently reprice existing contract
cancel semantics
AZN currency
no USD fallback
MRR != collected cash
tenant/RBAC isolation
widget registry consistency if widgets added
```

------------------------------------------------------------------------

# 42. EXISTING REGRESSION

Не ломать:

``` text
Stage H financial semantics
GMV
Collected GMV
Outstanding
Completed GMV
Payment Volume
Refunds
Net Payments
Commission

Post-H WIDGET_REGISTRY
Decision Queue
WHY/IMPACT/ACTION
AI Decision Feed No-Fabrication
```

------------------------------------------------------------------------

# 43. PERFORMANCE

Вернуть:

``` text
Command Center before/after
billing aggregate queries
N+1
```

MRR/ARR не должны вычисляться через загрузку всех contracts в память,
если DB aggregate безопаснее.

------------------------------------------------------------------------

# 44. REQUIRED DELIVERABLES --- IF IMPLEMENTED

## A --- Dependency

``` text
Step 3.29D:
Evidence:
PASS:
```

## B --- Legacy priceUsd audit

  Location   Meaning   Migration
  ---------- --------- -----------

## C --- Billing semantic dictionary

  Metric   Definition   Authority   Date type   Currency
  -------- ------------ ----------- ----------- ----------

## D --- Status eligibility

  Subscription status     MRR   ARR Reason
  --------------------- ----- ----- --------

## E --- List vs Contract

``` text
Plan list price:
Contracted price:
Price change behavior:
Discount behavior:
```

## F --- MRR/ARR

``` text
MRR formula:
ARR formula:
Annual normalization:
Trial:
Cancellation:
Past due:
```

## G --- Dynamic pricing

``` text
Meaning:
Supported:
Host-count support:
Authority:
```

## H --- DB/API/UI

``` text
List:
Contract:
MRR:
ARR:
Collected billing if applicable:
```

## I --- Localization/runtime

``` text
RU:
AZ:
EN:
unexpected USD/$:
raw keys:
```

## J --- Tests/performance

``` text
Backend:
Frontend:
TSC:
Build:
Browser:
Performance:
N+1:
```

## K --- Git

``` text
Starting HEAD:
Final HEAD:
Files changed:
Migrations:
Commit:
Pushed:
Working tree clean:
```

------------------------------------------------------------------------

# 45. BLOCKED DELIVERABLES --- IF STEP 3.29D FAILS

Если dependency не satisfied, отчёт должен содержать:

``` text
Step 3.29D canonical requirement:
Current implementation status:
Missing billing authority:
Why Stage I cannot safely proceed:
What must be implemented first:
Production code changed: NO
```

Не создавать Stage I metrics.

------------------------------------------------------------------------

# 46. DOCUMENTATION

Если IMPLEMENTED:

``` text
docs/prompts/PHASE_3_STAGE_I_STOREFRONT_REVENUE_SEMANTIC_FIX_REPORT.md
```

Если BLOCKED:

``` text
docs/prompts/PHASE_3_STAGE_I_ENTRY_GATE_STEP_3_29D_DEPENDENCY_REPORT.md
```

Отчёт полностью на русском.

------------------------------------------------------------------------

# 47. ROADMAP UPDATE

При VERDICT A:

``` text
Stage I → COMPLETE
```

additive update с evidence.

При VERDICT C:

``` text
Stage I → BLOCKED BY Step 3.29D
```

Не объявлять Stage I complete.

------------------------------------------------------------------------

# 48. STAGE J

Stage J --- Regression / Security / Evidence Closure.

**НЕ ЗАПУСКАТЬ автоматически.**

Stage J разрешён только после Stage I VERDICT A.

------------------------------------------------------------------------

# 49. ACCEPTANCE CRITERIA --- VERDICT A

VERDICT A только если:

1.  Step 3.29D dependency доказан.
2.  Billing engine authoritative.
3.  priceUsd semantics проаудированы.
4.  AZN migration корректна и history-safe.
5.  List Price ≠ Contracted Price.
6.  MRR использует contracted recurring facts.
7.  ARR semantics доказаны.
8.  Trials не создают fabricated MRR.
9.  Plan repricing не меняет старый contract silently.
10. Discounts/overrides deterministic.
11. Cancellation semantics определены.
12. MRR ≠ collected cash.
13. Dynamic pricing scope определён.
14. Host-count pricing учтён, если supported/required.
15. PLATFORM/PARTNER scope сохранён.
16. RBAC server-side сохранён.
17. WIDGET_REGISTRY используется для новых widgets.
18. No fabricated subscription revenue.
19. DB/API/UI reconciliation PASS.
20. RU/AZ/EN PASS.
21. Unexpected USD/\$ = 0 в Stage I billing UI.
22. Tests/TSC/build PASS.
23. Previous C--H regressions PASS.
24. Stage J не запускался.

------------------------------------------------------------------------

# 50. FINAL VERDICT

Вернуть ровно один:

## VERDICT A --- STAGE I COMPLETE / STOREFRONT REVENUE SEMANTICS VERIFIED / AZN BILLING & MRR/ARR AUTHORITY CLOSED / STAGE J READY

или:

## VERDICT B --- STAGE I REMEDIATION REQUIRED

Разделить gaps:

``` text
priceUsd:
AZN:
List vs Contract:
MRR:
ARR:
Dynamic pricing:
Statuses:
RBAC:
Registry:
Localization:
Reconciliation:
Tests:
```

или:

## VERDICT C --- STAGE I BLOCKED / STEP 3.29D BILLING ENGINE AUTHORITY REQUIRED

------------------------------------------------------------------------

# 51. STOP

После VERDICT:

**STOP.**

Stage J автоматически не запускать.
