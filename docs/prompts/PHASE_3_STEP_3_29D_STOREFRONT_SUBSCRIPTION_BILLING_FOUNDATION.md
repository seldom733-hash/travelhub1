# PHASE 3 --- STEP 3.29D

# STOREFRONT SUBSCRIPTION BILLING FOUNDATION

## AUTHORITATIVE CONTRACT / INVOICE / PAYMENT ENGINE

## PREREQUISITE FOR STAGE I

------------------------------------------------------------------------

## 1. ЯЗЫК

Все ответы разработчика, findings, таблицы, evidence, implementation
report и финальный VERDICT должны быть **НА РУССКОМ ЯЗЫКЕ**.

Код, identifiers, paths, enums, API fields, SQL, commands, SHA и commit
messages можно сохранять в оригинале.

------------------------------------------------------------------------

# 2. ENTRY STATUS

``` text
Stage C — WHAT                                  COMPLETE
Stage D — WHY                                   COMPLETE
Stage E — IMPACT                                COMPLETE
Stage F — ACTION                                COMPLETE
Stage G — AI Decision Feed                      COMPLETE
Stage H — Financial Enrichment                  COMPLETE
Post-H Widget Registry Reconciliation           COMPLETE

Stage I Entry Gate                              VERDICT C — BLOCKED
Blocking dependency                             Step 3.29D

Step 3.29D                                      IMPLEMENT NOW
Stage I                                         DO NOT IMPLEMENT
Stage J                                         DO NOT START
```

------------------------------------------------------------------------

# 3. ROOT CAUSE

Stage I audit установил:

``` text
Subscription model          EXISTS
Plan identity               EXISTS

Contracted price            MISSING
Invoice generation          MISSING
Subscription payment        MISSING
Discount/override           MISSING
Price-change isolation      MISSING
Trial → paid conversion     MISSING
```

Текущие:

``` text
FREE_TRIAL
PREMIUM priceUsd = 199
totalPaidUsd
```

не являются authoritative billing engine.

------------------------------------------------------------------------

# 4. ЦЕЛЬ STEP 3.29D

Создать минимальный, но production-oriented **Storefront Subscription
Billing Foundation**, который становится authoritative source для:

``` text
subscription contract
contracted price
billing currency
billing interval
billing quantity / host count
effective pricing
invoice generation
invoice lifecycle
subscription payment lifecycle
trial → paid conversion
renewal
cancellation
discount / contract override
price-change isolation
```

После Step 3.29D Stage I должен иметь достаточные факты для честного
расчёта MRR/ARR.

------------------------------------------------------------------------

# 5. КРИТИЧЕСКАЯ ГРАНИЦА

В этом Step **НЕ РЕАЛИЗОВЫВАТЬ**:

``` text
MRR
ARR
Stage I Command Center revenue widgets
Revenue Mix
Stage J
```

Step 3.29D создаёт billing authority.

Stage I затем использует её.

------------------------------------------------------------------------

# 6. FROZEN PRINCIPLE --- LIST PRICE ≠ CONTRACTED PRICE

Обязательный invariant:

``` text
Plan List Price
≠
Subscription Contracted Price
```

Пример:

``` text
Plan list price       199 ₼ / month
Contracted price      169 ₼ / month
```

Существующий contract должен продолжать хранить `169 ₼`, даже если list
price плана позже станет `229 ₼`.

Нельзя вычислять contract price на read из текущего plan price.

------------------------------------------------------------------------

# 7. EXISTING MODEL AUDIT --- FIRST

До schema changes провести inventory:

``` text
SubscriptionPlan
Subscription
Storefront workspace/partner
User/host model
existing priceUsd
totalPaidUsd
status enums
seed data
API
frontend
tests
```

Вернуть:

  --------------------------------------------------------------------------------
  Entity/field     Current meaning         Authoritative? Keep/Migrate/Deprecate
  ---------------- ---------------- --------------------- ------------------------

  --------------------------------------------------------------------------------

Не предполагать semantics по имени поля.

------------------------------------------------------------------------

# 8. MONEY MODEL

Billing foundation должен использовать explicit currency authority.

Предпочтительная semantic model:

``` text
amount
currency
```

а не:

``` text
priceUsd
priceAzn
priceEur
```

Для новых Storefront billing facts canonical currency:

``` text
AZN
```

Display:

``` text
₼
```

Не делать global currency redesign других доменов.

------------------------------------------------------------------------

# 9. LEGACY `priceUsd`

Проверить, что фактически означает `priceUsd`.

Нельзя blind rename.

Определить:

``` text
is value truly USD?
was field historically misnamed?
where consumed?
is it demo-only?
are historical rows meaningful?
```

Для legacy plan field выбрать explicit policy:

``` text
migrate
deprecate
retain read-only compatibility
```

с evidence.

------------------------------------------------------------------------

# 10. LEGACY `totalPaidUsd`

`totalPaidUsd` сейчас seed-assigned и **не является payment ledger**.

Запрещено:

``` text
convert totalPaidUsd → authoritative payment history
generate fake invoices matching totalPaidUsd
generate fake payments to reconcile it
```

Классифицировать как:

``` text
legacy/demo aggregate
```

и определить safe deprecation/removal policy.

------------------------------------------------------------------------

# 11. SUBSCRIPTION CONTRACT AUTHORITY

Каждая платная subscription должна иметь immutable/effective contract
pricing facts минимум:

``` text
subscriptionId
planId / planVersion reference
contractedUnitAmount
currency
billingInterval
quantity / hostCount
contractedTotalAmount
effectiveFrom
effectiveTo nullable
```

Naming адаптировать к существующей architecture.

------------------------------------------------------------------------

# 12. HOST-COUNT PRICING

Архитектурное требование:

``` text
Storefront subscription variants depend on number of hosts using platform.
```

Billing engine должен поддерживать quantity/host-count pricing.

Не обязательно строить сложный enterprise pricing engine.

Минимум должен быть deterministic:

``` text
quantity
pricing rule/tier
unit amount OR contracted total
```

------------------------------------------------------------------------

# 13. HOST LICENSING VS CONCURRENT LOGIN

Не смешивать:

``` text
billing host quantity
```

с security requirement:

``` text
один login одновременно используется только одним host/session
```

Это разные capabilities.

Step 3.29D отвечает за billable host quantity, а не за session security
implementation.

------------------------------------------------------------------------

# 14. PLAN VERSION / PRICE ISOLATION

Изменение list price не должно ретроактивно менять существующие
contracts.

Реализовать один корректный механизм:

``` text
plan versioning
pricing snapshot on contract
price book/version
```

в соответствии с repository architecture.

Обязательный regression test.

------------------------------------------------------------------------

# 15. BILLING INTERVAL

Минимально поддержать реально необходимые intervals.

Если текущий product только monthly:

``` text
MONTHLY
```

достаточен при extensible enum/contract.

Если roadmap/model уже требует annual:

``` text
MONTHLY
ANNUAL
```

Не добавлять arbitrary intervals без необходимости.

------------------------------------------------------------------------

# 16. SUBSCRIPTION LIFECYCLE

Определить canonical lifecycle на базе существующих enums или расширить
их.

Минимальные business states должны покрывать:

``` text
TRIAL
ACTIVE
PAST_DUE
CANCELLED / CANCELLING
EXPIRED if architecture requires
```

Не плодить статусы, если существующая модель уже выражает lifecycle.

------------------------------------------------------------------------

# 17. TRIAL

FREE_TRIAL должен быть реальным lifecycle state/plan behavior, а не
fabricated paid contract.

Определить:

``` text
trialStart
trialEnd
conversion behavior
no invoice during free period unless zero invoice policy explicitly chosen
```

Trial не создаёт paid revenue.

------------------------------------------------------------------------

# 18. TRIAL → PAID CONVERSION

Реализовать deterministic transition:

``` text
TRIAL
→ selected paid plan
→ contracted price established
→ billing period established
→ ACTIVE after required billing/payment rule
```

Точная activation policy должна быть documented.

------------------------------------------------------------------------

# 19. CONTRACT OVERRIDE / DISCOUNT

Billing foundation должен поддерживать agreed price, отличный от list
price.

Минимум:

``` text
contracted amount snapshot
```

Если отдельный discount model не нужен сейчас --- не overengineer.

Но должно быть возможно доказать:

``` text
list 199
contract 169
```

без изменения plan list price.

------------------------------------------------------------------------

# 20. DYNAMIC PRICING FOUNDATION

Под `dynamic pricing` для Storefront здесь понимать pricing, зависящий
от contractual inputs, например:

``` text
host quantity
tier
contract override
effective plan version
```

Не реализовывать marketplace demand pricing.

------------------------------------------------------------------------

# 21. INVOICE AUTHORITY

Создать authoritative invoice model.

Минимум:

``` text
id
subscriptionId
workspace/partnerId
invoiceNumber
currency
subtotal
discountAmount if applicable
totalAmount
status
periodStart
periodEnd
issuedAt
dueAt
paidAt nullable
createdAt
updatedAt
```

Адаптировать к conventions repository.

------------------------------------------------------------------------

# 22. INVOICE STATUS

Минимально:

``` text
DRAFT if needed
OPEN
PAID
VOID
OVERDUE
```

Не использовать `REFUNDED`, если refunds требуют отдельной credit/refund
architecture и не входят в Step.

Выбрать states по реальным use cases.

------------------------------------------------------------------------

# 23. INVOICE IMMUTABILITY

После issue invoice monetary facts должны быть snapshot.

Изменение:

``` text
plan price
contract price for future periods
host quantity
```

не должно менять уже issued invoice.

------------------------------------------------------------------------

# 24. INVOICE GENERATION

Реализовать deterministic service для generation.

Минимум:

``` text
subscription
billing period
contracted pricing effective for period
quantity
invoice snapshot
```

Повторный вызов для того же billing period не должен создавать duplicate
invoice.

Нужен idempotency/unique constraint.

------------------------------------------------------------------------

# 25. BILLING PERIOD

Явно определить:

``` text
periodStart
periodEnd
```

и boundary semantics.

Использовать canonical timezone policy.

------------------------------------------------------------------------

# 26. SUBSCRIPTION PAYMENT AUTHORITY

Не смешивать marketplace `Payment` автоматически с Storefront SaaS
billing, если existing payment model имеет другую business authority.

Сначала провести audit.

Выбрать:

``` text
reuse existing Payment with explicit domain linkage
```

или:

``` text
dedicated SubscriptionPayment/BillingPayment
```

Требуется architecture rationale.

------------------------------------------------------------------------

# 27. PAYMENT MODEL

Минимальные authoritative facts:

``` text
id
invoiceId
subscriptionId/workspace scope
amount
currency
status
provider/reference if available
paidAt
createdAt
```

Status минимум должен различать:

``` text
PENDING
SUCCEEDED/CAPTURED
FAILED
```

согласно repository conventions.

------------------------------------------------------------------------

# 28. NO FAKE PAYMENT PROVIDER

Если реальная payment-provider integration Storefront subscriptions ещё
не входит в Step:

допустим внутренний billing payment recording/service для demo/dev/test
flow.

Но:

``` text
не притворяться Stripe/real provider integration
не генерировать successful payment автоматически без explicit action/test seed
```

------------------------------------------------------------------------

# 29. INVOICE PAYMENT RECONCILIATION

Для invoice:

``` text
paid amount
outstanding amount
status
```

должны выводиться из authoritative payment facts или deterministic
ledger.

Не хранить независимые contradictory totals без reconciliation.

------------------------------------------------------------------------

# 30. PARTIAL PAYMENT

Проверить product requirement.

Если partial subscription invoice payments не нужны:

``` text
reject partial payment
```

может быть корректным MVP contract.

Если existing payment architecture требует partial --- поддержать
deterministic reconciliation.

Решение документировать.

------------------------------------------------------------------------

# 31. OVERPAYMENT

Не допускать:

``` text
successful payments > invoice total
```

без explicit credit balance architecture.

Если credit balance out of scope --- reject.

------------------------------------------------------------------------

# 32. CANCELLATION

Поддержать deterministic cancellation policy.

Минимум определить:

``` text
immediate cancellation
or
cancel at period end
```

Предпочесть текущую product architecture.

Не начислять новые invoices после effective cancellation.

------------------------------------------------------------------------

# 33. RENEWAL

Для recurring active subscription определить:

``` text
next billing period
next invoice eligibility
contracted price effective for next period
quantity effective for next period
```

Invoice generation должна быть idempotent.

------------------------------------------------------------------------

# 34. QUANTITY/HOST CHANGE

Определить policy:

``` text
effective immediately with proration
or
effective next billing period
```

Для foundation предпочтительно **next billing period**, если proration
не требуется roadmap.

Не реализовывать сложный proration engine без необходимости.

------------------------------------------------------------------------

# 35. PRORATION

Если product/roadmap не требует:

``` text
PRORATION OUT OF SCOPE
```

зафиксировать явно.

Не создавать приблизительные formulas.

------------------------------------------------------------------------

# 36. PAYMENT FAILURE / PAST_DUE

Если invoice due и payment failed/unpaid:

``` text
subscription may become PAST_DUE
```

по documented rule.

Не отключать storefront автоматически без отдельной entitlement/access
policy, если это не определено.

------------------------------------------------------------------------

# 37. ENTITLEMENT BOUNDARY

Billing state и feature entitlement связаны, но Step 3.29D не должен
ломать существующие:

``` text
Marketplace Basic
Storefront Pro
```

Определить integration point.

Не делать крупную entitlement rewrite.

------------------------------------------------------------------------

# 38. ELECTRONIC CONTRACT / PARTNER DATA

Архитектура Storefront предусматривает:

``` text
company physical address
company legal address
director full name
accountant optional
electronic contract
```

Step 3.29D не обязан реализовывать весь onboarding UI, если он не
является dependency для billing engine.

Но billing contract должен иметь ссылку на правильный partner/workspace
legal entity.

------------------------------------------------------------------------

# 39. DATA INTEGRITY

Обязательные constraints:

``` text
positive paid contracted amount
quantity >= 1 for paid host-based subscription
currency required
periodEnd > periodStart
invoice total >= 0
payment amount > 0
unique invoice per subscription/billing period
workspace/tenant ownership consistent
```

Trial/zero-price exceptions оформить явно.

------------------------------------------------------------------------

# 40. TENANT ISOLATION

Критический security gate.

Partner A не может:

``` text
read Partner B subscription
read Partner B invoice
record payment for Partner B invoice
cancel Partner B subscription
```

Проверить server-side scope.

------------------------------------------------------------------------

# 41. RBAC

Определить permissions для billing operations на базе существующей
permission architecture.

Минимально разделить:

``` text
read billing
manage subscription
record/process billing payment
```

если architecture поддерживает такую granularity.

Не использовать frontend-only security.

------------------------------------------------------------------------

# 42. PLATFORM VS PARTNER AUTHORITY

Platform staff может иметь aggregate/admin authority согласно role
permissions.

Storefront partner видит только свой workspace billing.

Не раскрывать platform-wide billing data partner workspace.

------------------------------------------------------------------------

# 43. API CONTRACT

Создать/расширить минимальные endpoints/services для:

``` text
get plans/list prices
get current subscription contract
create/convert subscription if allowed
get invoices
get invoice
record/process payment via supported flow
cancel subscription
```

Не создавать endpoints, не нужные foundation.

------------------------------------------------------------------------

# 44. IDEMPOTENCY

Обязательна минимум для:

``` text
invoice generation
payment recording where duplicate request possible
trial→paid conversion
```

Не допускать double charge/double invoice logical state.

------------------------------------------------------------------------

# 45. CONCURRENCY

Проверить race:

``` text
two invoice generation calls
two payment success calls
two conversion calls
```

Использовать DB transaction/unique constraints там, где нужно.

------------------------------------------------------------------------

# 46. SEED DATA

Обновить demo seed только для представительных billing cases.

Минимум:

``` text
free trial
active paid at list price
active paid with contracted override
different host quantity
open invoice
paid invoice
failed/unpaid invoice if supported
cancelled subscription
```

Не превращать legacy `totalPaidUsd` в payment history.

------------------------------------------------------------------------

# 47. LEGACY DATA MIGRATION

Для существующих 11 demo subscriptions разработать explicit
migration/backfill policy.

Допустимые варианты:

``` text
demo records recreated deterministically
legacy records marked non-authoritative
contract snapshots created only where source fact is defensible
```

Запрещено утверждать historical contracted price, если её не
существовало.

------------------------------------------------------------------------

# 48. ZERO-DATA IS ACCEPTABLE

Если после safe migration historical collected Storefront revenue = 0:

это лучше fabricated history.

Не подгонять цифры.

------------------------------------------------------------------------

# 49. STAGE I READINESS CONTRACT

После Step 3.29D должно быть возможно без догадок получить:

``` text
active recurring contracts
contracted recurring amount
currency
billing interval
host quantity
effective dates
invoice history
successful payment history
```

Именно это является Stage I entry evidence.

------------------------------------------------------------------------

# 50. NO MRR/ARR YET

Даже если данные уже позволяют посчитать:

``` text
MRR
ARR
```

в Step 3.29D **не добавлять эти KPI в Command Center**.

Stage I отвечает за их canonical semantics и presentation.

------------------------------------------------------------------------

# 51. FINANCIAL DOMAIN SEPARATION

Не ломать Marketplace financial authority:

``` text
GMV
Collected GMV
Outstanding
Payment Volume
Refunds
Net Payments
Commission
```

Storefront billing --- отдельный financial stream.

Не смешивать SaaS invoice/payment с marketplace payments без explicit
domain field/contract.

------------------------------------------------------------------------

# 52. CURRENCY REGRESSION

Storefront billing:

``` text
AZN
₼
```

Unexpected:

``` text
USD
$
```

в новом billing runtime = 0.

Legacy field names могут временно существовать только при documented
compatibility.

------------------------------------------------------------------------

# 53. TEST MATRIX --- CONTRACT

Минимум:

``` text
list price copied/snapshotted correctly on new contract
contract override differs from list
plan price change does not alter existing contract
host quantity affects new contracted total according to policy
invalid quantity rejected
trial zero-price semantics
trial→paid conversion
```

------------------------------------------------------------------------

# 54. TEST MATRIX --- INVOICE

Минимум:

``` text
invoice generated from contract
invoice monetary snapshot immutable
duplicate generation idempotent
correct billing period
cancelled subscription no future invoice
tenant isolation
```

------------------------------------------------------------------------

# 55. TEST MATRIX --- PAYMENT

Минимум:

``` text
successful payment reconciles invoice
failed payment does not mark invoice paid
duplicate payment request protected
overpayment rejected if no credit model
currency mismatch rejected
tenant isolation
```

------------------------------------------------------------------------

# 56. TEST MATRIX --- LIFECYCLE

Минимум:

``` text
TRIAL → ACTIVE
ACTIVE renewal
ACTIVE → cancellation
PAST_DUE rule if implemented
cancel-at-period-end behavior if selected
```

------------------------------------------------------------------------

# 57. TEST MATRIX --- LEGACY

Проверить:

``` text
priceUsd compatibility/migration
totalPaidUsd not used as authoritative payment
old API consumer behavior if applicable
seed idempotency
```

------------------------------------------------------------------------

# 58. DB-LEVEL RECONCILIATION

Для representative paid invoice:

``` text
Contracted total
= Invoice total

Successful payments
= Invoice paid amount

Invoice outstanding
= Invoice total - successful payments
```

согласно выбранной partial-payment policy.

------------------------------------------------------------------------

# 59. API/DB RECONCILIATION

Показать минимум 3 cases:

``` text
paid subscription
open/unpaid subscription invoice
trial subscription
```

DB = API.

UI --- только если billing UI уже существует/добавляется минимально.

------------------------------------------------------------------------

# 60. PERFORMANCE

Проверить:

``` text
subscription list
invoice list
billing summary if added
```

No N+1.

Не оптимизировать преждевременно, но не загружать все payments для
каждого invoice отдельно.

------------------------------------------------------------------------

# 61. MIGRATIONS

Все schema changes должны быть migration-based.

Запрещено:

``` text
synchronize=true
manual DB-only schema mutation
```

Вернуть migration names.

------------------------------------------------------------------------

# 62. DOCUMENTATION / ADR

Документировать:

``` text
List Price vs Contracted Price
Money/Currency authority
Host quantity pricing
Invoice authority
Payment authority
Trial conversion
Cancellation
Renewal
Legacy priceUsd
Legacy totalPaidUsd
Out-of-scope proration
Stage I boundary
```

------------------------------------------------------------------------

# 63. REQUIRED DELIVERABLE A --- CURRENT AUDIT

  Existing entity/field   Meaning     Authority Action
  ----------------------- --------- ----------- --------

------------------------------------------------------------------------

# 64. REQUIRED DELIVERABLE B --- FINAL DATA MODEL

Вернуть таблицу:

  Entity   Purpose   Key financial fields   Authority
  -------- --------- ---------------------- -----------

И relationships.

------------------------------------------------------------------------

# 65. REQUIRED DELIVERABLE C --- MONEY SEMANTICS

``` text
Canonical billing currency:
List price:
Contracted price:
Invoice amount:
Payment amount:
Legacy USD handling:
```

------------------------------------------------------------------------

# 66. REQUIRED DELIVERABLE D --- LIFECYCLE

``` text
Subscription states:
Transitions:
Trial:
Activation:
Past due:
Cancellation:
Renewal:
```

------------------------------------------------------------------------

# 67. REQUIRED DELIVERABLE E --- HOST PRICING

``` text
Billable host definition:
Quantity source:
Pricing rule:
Quantity change policy:
Proration:
```

------------------------------------------------------------------------

# 68. REQUIRED DELIVERABLE F --- INVOICE

``` text
Invoice statuses:
Generation trigger/service:
Idempotency:
Period authority:
Immutability:
```

------------------------------------------------------------------------

# 69. REQUIRED DELIVERABLE G --- PAYMENT

``` text
Payment model:
Marketplace Payment reused? YES/NO
Why:
Statuses:
Idempotency:
Invoice reconciliation:
Provider integration:
```

------------------------------------------------------------------------

# 70. REQUIRED DELIVERABLE H --- LEGACY

``` text
priceUsd:
totalPaidUsd:
11 existing subscriptions:
Historical payment fabrication: 0
```

------------------------------------------------------------------------

# 71. REQUIRED DELIVERABLE I --- SECURITY

``` text
Tenant isolation:
RBAC:
Platform scope:
Partner scope:
Cross-tenant tests:
```

------------------------------------------------------------------------

# 72. REQUIRED DELIVERABLE J --- RECONCILIATION

Для representative records:

``` text
Contract:
Invoice:
Payment:
Outstanding:
DB:
API:
PASS/FAIL
```

------------------------------------------------------------------------

# 73. REQUIRED DELIVERABLE K --- TESTS

``` text
New tests:
Backend unit:
Backend E2E:
Frontend if affected:
TSC:
Build:
Migration:
Seed:
```

------------------------------------------------------------------------

# 74. REQUIRED DELIVERABLE L --- GIT

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

# 75. REPORT

Создать:

``` text
docs/prompts/PHASE_3_STEP_3_29D_STOREFRONT_SUBSCRIPTION_BILLING_FOUNDATION_IMPLEMENTATION_REPORT.md
```

Отчёт полностью на русском.

------------------------------------------------------------------------

# 76. ROADMAP

После VERDICT A обновить canonical roadmap additively:

``` text
Step 3.29D — Storefront Subscription Billing Foundation
→ COMPLETE
```

После этого:

``` text
Stage I → READY FOR RE-ENTRY GATE
```

Не объявлять Stage I complete.

------------------------------------------------------------------------

# 77. OUT OF SCOPE

Не реализовывать:

``` text
Stage I MRR
Stage I ARR
Stage I Command Center revenue widgets
Stage J
proration engine unless canonical requirement proves mandatory
credit balance
tax/VAT engine
accounting ledger
refund/credit-note engine
real external payment provider unless already required
automatic entitlement suspension
Employee Performance
```

------------------------------------------------------------------------

# 78. ACCEPTANCE CRITERIA

VERDICT A разрешён только если:

1.  Existing subscription architecture проаудирована.
2.  Contracted price существует как authoritative fact.
3.  List Price ≠ Contracted Price enforced.
4.  Existing contract изолирован от future list-price changes.
5.  AZN является authority новых billing facts.
6.  Legacy `priceUsd` имеет explicit safe policy.
7.  `totalPaidUsd` не используется как payment authority.
8.  Host-count pricing foundation существует.
9.  Billing interval authoritative.
10. Trial lifecycle deterministic.
11. Trial→paid conversion deterministic.
12. Contract override/discount use case поддержан.
13. Invoice model authoritative.
14. Invoice snapshot immutable.
15. Invoice generation idempotent.
16. Payment authority существует.
17. Failed payment ≠ paid invoice.
18. Duplicate payment protected.
19. Currency mismatch protected.
20. Overpayment policy enforced.
21. Cancellation semantics определены.
22. Renewal semantics определены.
23. No future invoice after effective cancellation.
24. Tenant isolation PASS.
25. RBAC server-side PASS.
26. Marketplace vs Storefront payment authority не смешаны.
27. Representative seed cases существуют.
28. Historical fake billing/payment records не созданы.
29. DB/API reconciliation PASS.
30. Migrations PASS.
31. Seed idempotency PASS.
32. Tests/TSC/build PASS.
33. No uncontrolled N+1.
34. Stage I MRR/ARR не реализованы.
35. Stage J не запускался.
36. Stage I теперь имеет достаточную billing authority для re-entry.

------------------------------------------------------------------------

# 79. FINAL VERDICT

Вернуть ровно один:

## VERDICT A --- STEP 3.29D COMPLETE / STOREFRONT SUBSCRIPTION BILLING AUTHORITY ESTABLISHED / STAGE I RE-ENTRY READY

или:

## VERDICT B --- STEP 3.29D REMEDIATION REQUIRED

Разделить gaps:

``` text
Contract:
List vs Contract:
Currency:
Host pricing:
Trial:
Invoice:
Payment:
Cancellation:
Renewal:
Legacy:
Tenant/RBAC:
Reconciliation:
Tests:
```

или:

## VERDICT C --- STEP 3.29D BLOCKED / ARCHITECTURAL DECISION REQUIRED

Только если repository содержит противоречащую canonical billing
architecture, которую нельзя безопасно разрешить в рамках этого Step.

------------------------------------------------------------------------

# 80. STOP

После отчёта:

**STOP.**

Stage I автоматически не запускать.

Дождаться review и отдельного разрешения на повторный Stage I Entry
Gate.
