# PHASE 3 --- STAGE I

# STOREFRONT REVENUE SEMANTIC FIX --- RE-ENTRY & FULL IMPLEMENTATION

## AZN BILLING / LIST ≠ CONTRACT / MRR / ARR / COLLECTED REVENUE

## POST-STEP-3.29D

------------------------------------------------------------------------

## 1. ЯЗЫК

Все ответы разработчика, findings, таблицы, evidence, implementation
notes, runtime evidence, отчёт и финальный VERDICT должны быть
предоставлены **НА РУССКОМ ЯЗЫКЕ**.

Technical identifiers, paths, code, enums, API fields, commands, SHA и
commit messages можно сохранять в оригинале.

------------------------------------------------------------------------

# 2. ENTRY STATUS

Step 3.29D завершён:

``` text
VERDICT A — STEP 3.29D COMPLETE /
STOREFRONT SUBSCRIPTION BILLING AUTHORITY ESTABLISHED /
STAGE I RE-ENTRY READY
```

Canonical billing authority теперь существует:

``` text
SubscriptionContract
SubscriptionInvoice
SubscriptionPayment
```

Key contracts:

``` text
AZN billing
List Price ≠ Contracted Price
host quantity × unit amount = contracted total
invoice snapshot immutable
invoice idempotency
payment authority
overpayment rejected
currency mismatch rejected
trial → paid deterministic
cancellation blocks future invoices
```

Commit:

``` text
9d659ef
```

Stage I теперь разрешён к полноценной реализации.

------------------------------------------------------------------------

# 3. CANONICAL STAGE I SCOPE

Canonical roadmap:

``` text
Stage I — Storefront Revenue Semantic Fix

Dependencies:
- Stage H (partial)
- Step 3.29D billing engine

Scope:
- priceUsd migration
- AZN billing
- MRR/ARR semantics
- dynamic pricing
- List Price ≠ Contracted Price
```

Step 3.29D dependency теперь SATISFIED.

------------------------------------------------------------------------

# 4. ЦЕЛЬ STAGE I

Создать **честную Storefront SaaS revenue semantics** поверх новой
billing authority.

Stage I должен определить и реализовать:

``` text
List Price
Contracted Price
MRR
ARR
Collected Subscription Revenue
Outstanding Subscription Billing
```

только там, где каждый показатель provable.

Не смешивать:

``` text
run-rate
invoiced revenue
collected cash
outstanding billing
```

------------------------------------------------------------------------

# 5. SINGLE BILLING AUTHORITY

Использовать только:

``` text
SubscriptionContract
SubscriptionInvoice
SubscriptionPayment
```

и связанные authoritative subscription/plan facts.

Legacy:

``` text
priceUsd
totalPaidUsd
seed-assigned aggregates
```

не должны оставаться revenue authority.

------------------------------------------------------------------------

# 6. LIST PRICE

List Price --- текущая коммерческая цена плана.

Это не contracted revenue.

Не использовать List Price для MRR существующего contract.

------------------------------------------------------------------------

# 7. CONTRACTED PRICE

Contracted Price --- contractual pricing snapshot effective for
subscription.

Canonical:

``` text
contractedUnitAmount
quantity
contractedTotalAmount
currency
billingInterval
effective dates
```

Использовать реальные field names Step 3.29D.

------------------------------------------------------------------------

# 8. LIST PRICE ≠ CONTRACTED PRICE

Regression:

``` text
Plan list price = 199 ₼
Contract price  = 169 ₼

MRR = 169 ₼
```

Если plan позже:

``` text
199 → 229
```

existing contract остаётся 169, если не было explicit repricing.

------------------------------------------------------------------------

# 9. `priceUsd` MIGRATION --- NOW RESOLVE

Step 3.29D уже должен был провести audit.

Stage I обязан довести semantic closure:

``` text
priceUsd
```

не должен оставаться активной billing authority.

Выбрать safe final policy:

``` text
rename/migrate to amount+currency
deprecate legacy field
compatibility adapter
```

с учётом actual schema.

Не делать blind rename.

------------------------------------------------------------------------

# 10. `totalPaidUsd` CLOSURE

Legacy `totalPaidUsd` не является payment ledger.

После Step 3.29D:

``` text
Collected Subscription Revenue
```

должен считаться только по `SubscriptionPayment`.

`totalPaidUsd`:

``` text
must not participate in revenue metrics
```

Определить deprecation/removal policy.

------------------------------------------------------------------------

# 11. MRR --- CANONICAL DEFINITION

MRR:

``` text
normalized monthly contracted recurring value
for eligible active recurring Storefront contracts
at the selected snapshot/effective date
```

MRR --- **run-rate**, не cash metric.

------------------------------------------------------------------------

# 12. MRR ELIGIBILITY

Использовать actual lifecycle statuses repository.

Документировать минимум:

``` text
TRIAL
ACTIVE
PAST_DUE
CANCELLED
CANCELLING
EXPIRED
future-start
```

Для каждого:

  Status     MRR included? Reason
  -------- --------------- --------

Не включать trial по будущей list price.

------------------------------------------------------------------------

# 13. BILLING INTERVAL NORMALIZATION

Если:

``` text
MONTHLY
```

→ monthly contracted total.

Если:

``` text
ANNUAL
```

→ annual contracted recurring amount / 12.

Другие intervals --- explicit.

One-time charges не включать.

------------------------------------------------------------------------

# 14. HOST QUANTITY

MRR должен использовать contracted total с authoritative quantity.

Не пересчитывать из current workspace host count, если contract snapshot
другой.

Если quantity меняется next billing period --- MRR snapshot должен
учитывать effective contract period.

------------------------------------------------------------------------

# 15. DISCOUNTS / OVERRIDES

Contract override уже возможен через Step 3.29D.

MRR должен использовать effective contracted amount.

Не вычислять discount заново из current plan.

------------------------------------------------------------------------

# 16. TRIAL

Free trial:

``` text
MRR = 0
ARR = 0
Collected Revenue = 0 unless actual paid billing exists
```

Не использовать future paid contract до activation.

------------------------------------------------------------------------

# 17. PAST_DUE

MRR и collected cash различаются.

Определить policy:

``` text
PAST_DUE may remain in MRR run-rate
or excluded
```

но решение должно быть documented и consistent с SaaS accounting
semantics.

Не определять через наличие последнего payment только.

------------------------------------------------------------------------

# 18. CANCELLATION

Если:

``` text
cancel at period end
```

contract может оставаться в MRR до effective end.

Если immediate cancellation:

``` text
MRR stops at effective cancellation.
```

Использовать actual Step 3.29D semantics.

------------------------------------------------------------------------

# 19. ARR

Canonical:

``` text
ARR = MRR × 12
```

если Stage I выбирает standard run-rate method.

ARR ≠ cash collected in a year.

ARR ≠ invoiced annual total unless semantics совпадают.

------------------------------------------------------------------------

# 20. COLLECTED SUBSCRIPTION REVENUE

Теперь это provable.

Canonical candidate:

``` text
SUM(SubscriptionPayment.amount)
WHERE payment status = successful/captured
AND paidAt within event period
```

Использовать actual payment statuses.

Это EVENT_PERIOD metric.

------------------------------------------------------------------------

# 21. COLLECTED ≠ MRR

Обязательно разделить:

``` text
MRR → snapshot/run-rate
Collected Subscription Revenue → payment event-period
```

Например:

``` text
MRR = 2 000 ₼
Collected this month = 1 600 ₼
```

может быть корректно.

------------------------------------------------------------------------

# 22. INVOICED SUBSCRIPTION REVENUE

Если Stage I требует:

``` text
Invoiced Revenue
```

можно считать из issued/open/paid invoices по documented authority.

Но не добавлять новый KPI без decision value.

------------------------------------------------------------------------

# 23. OUTSTANDING SUBSCRIPTION BILLING

Теперь provable candidate:

``` text
Invoice total - successful payments
```

для eligible unpaid/partially paid invoices.

Если partial payments Step 3.29D не поддерживает, contract всё равно
должен быть deterministic.

------------------------------------------------------------------------

# 24. REVENUE MIX

После Stage I проверить:

``` text
Marketplace commission
Storefront collected subscription revenue
```

Можно ли строить platform revenue mix?

Только если обе стороны имеют comparable semantic basis.

Не смешивать:

``` text
Marketplace accrued commission
Storefront collected cash
```

как одну "Revenue Mix" без explicit dimension.

Если bases разные --- не объединять.

------------------------------------------------------------------------

# 25. EXPECTED / CONTRACTED STOREFRONT REVENUE

Если нужен expected/contracted view:

использовать invoice/contract authority.

Не называть MRR "Expected Revenue" без отдельного definition.

------------------------------------------------------------------------

# 26. DYNAMIC PRICING

Canonical Stage I scope включает dynamic pricing.

Interpretation для Storefront SaaS:

``` text
host quantity
pricing tier
contract override
effective plan version
discount period
```

Не marketplace demand pricing.

------------------------------------------------------------------------

# 27. PRICE CHANGE ISOLATION

Regression mandatory:

``` text
existing contract 169
plan list price 199 → 229

existing MRR remains based on 169
new contract may use 229
```

------------------------------------------------------------------------

# 28. CONTRACT EFFECTIVE DATES

MRR snapshot должен использовать contract effective at selected date.

Не использовать current contract blindly для historical period.

Если historical MRR пока не supported --- явно label current snapshot
only.

------------------------------------------------------------------------

# 29. HISTORICAL MRR

Проверить, есть ли data model для accurate historical MRR.

Если contract effective history достаточна:

``` text
historical MRR allowed
```

Если нет:

``` text
current MRR only
```

Не reconstruct history из current price.

------------------------------------------------------------------------

# 30. PERIOD SEMANTICS

Для каждой metric:

  Metric                           Type                 Date authority
  -------------------------------- -------------------- -----------------------------
  MRR                              SNAPSHOT             effective contract date
  ARR                              SNAPSHOT             effective contract date
  Collected Subscription Revenue   EVENT_PERIOD         payment.paidAt
  Outstanding Billing              SNAPSHOT / AS-OF     invoice/payment state
  List Price                       SNAPSHOT             plan/version effective date
  Contracted Price                 EFFECTIVE CONTRACT   contract dates

------------------------------------------------------------------------

# 31. CURRENCY

Canonical:

``` text
AZN
```

UI:

``` text
₼
```

Unexpected:

``` text
USD
$
```

в Stage I Storefront financial UI = 0.

------------------------------------------------------------------------

# 32. COMMAND CENTER INTEGRATION

Определить, какие Stage I metrics top-level worthy.

Не добавлять все автоматически.

Минимально рассмотреть:

``` text
Storefront MRR
Storefront ARR
Collected Storefront Revenue
Outstanding Storefront Billing
```

Для каждой:

``` text
business decision enabled
section
default visibility
customizable?
```

------------------------------------------------------------------------

# 33. WIDGET REGISTRY

Все добавленные Command Center widgets должны использовать canonical
`WIDGET_REGISTRY`.

Не создавать separate Settings list.

Metadata:

``` text
widgetId
section
labelKey
customizable
requiredPermission
workspace applicability
default visibility
```

------------------------------------------------------------------------

# 34. RECOMMENDED SECTION

Предпочтительно:

``` text
Financial / Storefront business subsection
```

или current Marketplace/Storefront comparison section.

Не перегружать Executive.

------------------------------------------------------------------------

# 35. PLATFORM VIEW

Platform can see aggregate Storefront SaaS metrics.

Storefront partner:

``` text
must not see platform-wide MRR/ARR
```

сохранять tenant/workspace scope.

------------------------------------------------------------------------

# 36. PARTNER VIEW

Если partner sees own subscription:

это отдельный billing/account view, не platform-wide Command Center
metric.

Stage I не должен смешивать эти scopes.

------------------------------------------------------------------------

# 37. RBAC

Новые metrics должны использовать server-side section permissions.

Settings show/hide не обходит RBAC.

------------------------------------------------------------------------

# 38. NO FABRICATION

Запрещено:

``` text
active count × list price
partners × 199
trial × premium price
host count × arbitrary coefficient
```

MRR только из contracts.

Collected только из payments.

Outstanding только из invoices/payments.

------------------------------------------------------------------------

# 39. NO DOUBLE COUNTING

Не считать:

``` text
invoice total
+
payment amount
```

как две revenue metrics в одном aggregate.

Invoiced и collected --- разные views.

------------------------------------------------------------------------

# 40. REFUND / CREDIT NOTE

Если Step 3.29D не имеет refund/credit-note engine:

не создавать Net Storefront Revenue after refunds.

Явно limitation.

------------------------------------------------------------------------

# 41. TAX/VAT

Если tax engine отсутствует:

не называть invoice subtotal/total tax-exclusive/inclusive без
authority.

Не реализовывать VAT в Stage I.

------------------------------------------------------------------------

# 42. DB/API/UI RECONCILIATION

Обязательно для representative metrics:

``` text
MRR
ARR
Collected Subscription Revenue
Outstanding Billing
```

если реализованы.

DB = API = UI.

------------------------------------------------------------------------

# 43. REPRESENTATIVE TEST DATA

Использовать billing cases Step 3.29D:

``` text
list-price contract
discount contract
host quantity
trial
paid invoice
open invoice
cancelled
annual if supported
```

Не fabricate history.

------------------------------------------------------------------------

# 44. MRR EXAMPLE MATRIX

Return actual values:

  ----------------------------------------------------------------------------------
  Contract          List   Contracted         Qty Interval   Status              MRR
                                                                        contribution
  ---------- ----------- ------------ ----------- ---------- -------- --------------

  ----------------------------------------------------------------------------------

------------------------------------------------------------------------

# 45. ARR MATRIX

Показать:

``` text
Total MRR:
ARR:
Formula:
```

и доказать.

------------------------------------------------------------------------

# 46. COLLECTED REVENUE MATRIX

Для period:

  Payment   Invoice     Amount Status   paidAt     Included?
  --------- --------- -------- -------- -------- -----------

------------------------------------------------------------------------

# 47. OUTSTANDING MATRIX

  Invoice     Total   Paid   Outstanding Status
  --------- ------- ------ ------------- --------

------------------------------------------------------------------------

# 48. PRICEUSD CLOSURE TESTS

Добавить tests:

``` text
Stage I metrics do not read priceUsd
Stage I collected revenue does not read totalPaidUsd
```

Legacy compatibility может существовать, но не metric authority.

------------------------------------------------------------------------

# 49. MRR TESTS

Минимум:

``` text
active monthly
discount contract
quantity > 1
trial = 0
cancelled exclusion/effective-end semantics
past_due policy
annual normalization if supported
plan repricing isolation
```

------------------------------------------------------------------------

# 50. COLLECTED TESTS

Минимум:

``` text
successful payment included
failed excluded
pending excluded
period boundary
currency mismatch impossible/rejected
```

------------------------------------------------------------------------

# 51. OUTSTANDING TESTS

Минимум:

``` text
open invoice
paid invoice = 0
overpayment impossible
partial if supported
```

------------------------------------------------------------------------

# 52. SECURITY TESTS

Проверить:

``` text
platform aggregate allowed roles
partner cannot access platform-wide MRR
cross-workspace denied
section permission denied
```

------------------------------------------------------------------------

# 53. LOCALIZATION

RU/AZ/EN минимум:

``` text
MRR
ARR
List Price
Contracted Price
Collected Storefront Revenue
Outstanding Billing
Billing interval
```

Raw keys = 0.

------------------------------------------------------------------------

# 54. BROWSER RUNTIME

Обязательный actual browser check:

``` text
RU
AZ
EN
```

для новых Stage I widgets/views.

Проверить:

``` text
₼
no USD/$
labels
values
Settings visibility if customizable
```

------------------------------------------------------------------------

# 55. SETTINGS INTERACTION

Если widgets customizable:

``` text
show/hide
reload persistence
RBAC
mandatory flag if any
```

через existing canonical registry.

------------------------------------------------------------------------

# 56. PERFORMANCE

Вернуть:

``` text
Command Center before:
after:
billing queries:
N+1:
```

MRR/ARR preferably via DB aggregate or bounded queries.

------------------------------------------------------------------------

# 57. EXISTING REGRESSION

Не ломать:

``` text
Stage H:
GMV
Collected GMV
Outstanding
Completed GMV
Payment Volume
Refunds
Net Payments
Commission

Widget Registry
Decision Queue
WHAT/WHY/IMPACT/ACTION
AI Decision Feed
No-Fabrication
```

------------------------------------------------------------------------

# 58. REQUIRED DELIVERABLE A --- RE-ENTRY PROOF

``` text
Step 3.29D status:
Commit:
Models:
Migration:
Billing authority:
Dependency PASS:
```

------------------------------------------------------------------------

# 59. REQUIRED DELIVERABLE B --- LEGACY CLOSURE

``` text
priceUsd:
totalPaidUsd:
remaining consumers:
metric authority after Stage I:
deprecation plan:
```

------------------------------------------------------------------------

# 60. REQUIRED DELIVERABLE C --- SEMANTIC DICTIONARY

  Metric   Definition   Source   Type   Date authority   Currency
  -------- ------------ -------- ------ ---------------- ----------

------------------------------------------------------------------------

# 61. REQUIRED DELIVERABLE D --- STATUS MATRIX

  Subscription status     MRR   ARR   Collected relevance Reason
  --------------------- ----- ----- --------------------- --------

------------------------------------------------------------------------

# 62. REQUIRED DELIVERABLE E --- LIST VS CONTRACT

``` text
List:
Contracted:
Plan repricing:
Discount:
Host quantity:
Effective dates:
```

------------------------------------------------------------------------

# 63. REQUIRED DELIVERABLE F --- MRR/ARR

``` text
MRR formula:
ARR formula:
Current total:
Historical support:
Annual normalization:
```

------------------------------------------------------------------------

# 64. REQUIRED DELIVERABLE G --- COLLECTED / OUTSTANDING

``` text
Collected formula:
Outstanding formula:
Invoice eligibility:
Payment eligibility:
Refund limitation:
```

------------------------------------------------------------------------

# 65. REQUIRED DELIVERABLE H --- COMMAND CENTER / REGISTRY

  widgetId   Metric   Section     Customizable Permission   Default
  ---------- -------- --------- -------------- ------------ ---------

Если no new widgets --- объяснить.

------------------------------------------------------------------------

# 66. REQUIRED DELIVERABLE I --- DB/API/UI

``` text
MRR:
ARR:
Collected:
Outstanding:
```

для representative scope.

------------------------------------------------------------------------

# 67. REQUIRED DELIVERABLE J --- LOCALIZATION / RUNTIME

``` text
RU:
AZ:
EN:
raw keys:
unexpected USD/$:
```

------------------------------------------------------------------------

# 68. REQUIRED DELIVERABLE K --- TESTS

``` text
New Stage I tests:
Backend:
Frontend:
TSC:
Build:
Browser:
Security:
Performance:
```

------------------------------------------------------------------------

# 69. REQUIRED DELIVERABLE L --- GIT

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

# 70. DOCUMENTATION

Создать:

``` text
docs/prompts/PHASE_3_STAGE_I_STOREFRONT_REVENUE_SEMANTIC_FIX_IMPLEMENTATION_REPORT.md
```

Отчёт полностью на русском.

------------------------------------------------------------------------

# 71. ROADMAP

После VERDICT A:

``` text
Stage I — Storefront Revenue Semantic Fix
→ COMPLETE
```

additive update.

------------------------------------------------------------------------

# 72. STAGE J

После Stage I VERDICT A:

``` text
Stage J — Regression / Security / Evidence Closure
→ READY
```

Но Stage J **НЕ ЗАПУСКАТЬ автоматически**.

------------------------------------------------------------------------

# 73. OUT OF SCOPE

Не реализовывать:

``` text
Stage J
refund/credit-note engine
tax/VAT engine
full accounting ledger
complex proration
AI forecasts
Employee Performance
new onboarding redesign
```

------------------------------------------------------------------------

# 74. ACCEPTANCE CRITERIA

VERDICT A только если:

1.  Step 3.29D dependency re-verified.
2.  `priceUsd` no longer Stage I metric authority.
3.  `totalPaidUsd` no longer collected revenue authority.
4.  List Price ≠ Contracted Price preserved.
5.  MRR uses effective contracted recurring facts.
6.  ARR semantics explicit.
7.  Trial MRR = 0.
8.  Plan repricing does not mutate old MRR.
9.  Host quantity uses contracted authority.
10. Discounts/overrides deterministic.
11. Past-due policy documented.
12. Cancellation/effective-end semantics correct.
13. Collected Storefront Revenue uses successful SubscriptionPayment
    only.
14. MRR ≠ collected cash.
15. Outstanding uses invoice/payment authority.
16. No fake net revenue without refund/credit-note engine.
17. AZN/₼ preserved.
18. Unexpected USD/\$ = 0 in Stage I runtime.
19. No active-count × list-price fabrication.
20. DB/API/UI reconciliation PASS.
21. Canonical WIDGET_REGISTRY used for new widgets.
22. PLATFORM/PARTNER scope preserved.
23. RBAC server-side preserved.
24. RU/AZ/EN PASS.
25. Browser runtime PASS.
26. Tests/TSC/build PASS.
27. Performance acceptable.
28. Previous Stage H/registry/Decision Loop/AI Feed regressions PASS.
29. Stage J not started.
30. Report in Russian.

------------------------------------------------------------------------

# 75. FINAL VERDICT

Вернуть ровно один:

## VERDICT A --- STAGE I COMPLETE / STOREFRONT REVENUE SEMANTICS VERIFIED / MRR-ARR-COLLECTED BILLING AUTHORITY CLOSED / STAGE J READY

или:

## VERDICT B --- STAGE I REMEDIATION REQUIRED

Разделить:

``` text
priceUsd:
totalPaidUsd:
List vs Contract:
MRR:
ARR:
Collected:
Outstanding:
Dynamic pricing:
Currency:
Registry:
RBAC:
Localization:
Reconciliation:
Runtime:
Tests:
```

или:

## VERDICT C --- STAGE I BLOCKED / BILLING AUTHORITY GAP REMAINS

Только если Step 3.29D implementation still lacks required authoritative
facts.

------------------------------------------------------------------------

# 76. STOP

После отчёта:

**STOP.**

Stage J автоматически не запускать.
