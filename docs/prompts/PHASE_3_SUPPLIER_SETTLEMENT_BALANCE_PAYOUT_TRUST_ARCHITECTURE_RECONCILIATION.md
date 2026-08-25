# PHASE 3 --- ARCHITECTURE ADDITIVE AMENDMENT

## SUPPLIER SETTLEMENT TERMS / BALANCE / PAYOUT RELEASE / TRUST & TRANSPARENCY / PLATFORM LIQUIDITY MONITORING

## DOCUMENTATION-ONLY --- NO PRODUCTION IMPLEMENTATION

------------------------------------------------------------------------

# 1. ЦЕЛЬ

Дополнить уже закрытую архитектуру:

``` text
Booking Commercial Terms
Customer Payment Schedules
Agreement Versioning & Audit
Customer Payment != Supplier Settlement
```

отдельным supplier-side финансовым контуром:

``` text
Supplier Settlement Terms
Supplier Settlement Terms Snapshot
Supplier Entitlement
Settlement Release Policy
Reserve / Holdback
Supplier Balance
Supplier Financial Ledger
Payout
Settlement Statement
Payout Forecast
Platform Supplier-Liability Monitoring
Supplier Trust & Transparency Contract
```

Это ADDITIVE documentation-only reconciliation.

Не реализовывать production code.

Не запускать CRM Step 3.5.

Не запускать автоматически другие Phase 3 stages.

Не вмешиваться в Decision Queue Round 5, если он выполняется отдельно.

------------------------------------------------------------------------

# 2. ГЛАВНЫЙ АРХИТЕКТУРНЫЙ ИНВАРИАНТ

В одной booking/order lifecycle одновременно существуют ДВА независимых
финансовых контракта:

``` text
A. Customer Payment Terms
B. Supplier Settlement Terms
```

и отдельный execution layer:

``` text
C. Supplier Payout
```

Canonical invariant:

``` text
Customer Payment Terms
≠
Supplier Settlement Terms
≠
Supplier Payout
```

Обе системы условий ОБЯЗАТЕЛЬНО должны присутствовать.

------------------------------------------------------------------------

# 3. CUSTOMER PAYMENT TERMS

Customer Payment Terms отвечают:

``` text
Как и когда клиент обязан заплатить за услугу?
```

Authority:

``` text
Service Commercial Terms
→ Service Terms Version
→ Booking Commercial Snapshot
→ Customer Payment Schedule
```

Поставщик может определять в пределах правил TravelHub:

``` text
полная оплата
частичная оплата
процент/сумма первого платежа
installments
дедлайны платежей
final payment deadline
grace period
missed-payment consequences
cancellation/refund terms
```

Клиент должен видеть и принять эти условия до заключения booking
agreement.

------------------------------------------------------------------------

# 4. SUPPLIER SETTLEMENT TERMS

Supplier Settlement Terms отвечают на другой вопрос:

``` text
Когда и какую часть экономически причитающихся поставщику средств
можно высвободить/перечислить поставщику?
```

Они относятся к отношениям:

``` text
TravelHub ↔ Supplier
```

и НЕ выводятся автоматически из Customer Payment Schedule.

Invariant:

``` text
Customer paid
≠
Supplier may withdraw the same amount
```

------------------------------------------------------------------------

# 5. ПОЧЕМУ НУЖНЫ ОБА КОНТУРА

Поставщику нужны оборотные средства для выполнения услуги.

Поэтому архитектура НЕ должна предполагать единственную модель:

``` text
100% supplier payout only after full service completion
```

Но и не должна автоматически передавать поставщику 100% клиентских
средств сразу.

Нужен configurable settlement/release layer, который балансирует:

``` text
Supplier working-capital needs
+
Customer refund protection
+
Platform risk
+
Chargeback exposure
+
Partner contract
```

------------------------------------------------------------------------

# 6. WHO DEFINES SUPPLIER SETTLEMENT TERMS

Customer Payment Terms в значительной части задаёт Supplier в карточке
услуги в рамках platform policy.

Supplier Settlement Terms определяются:

``` text
TravelHub ↔ Supplier Partner Commercial Agreement
```

и могут зависеть от:

``` text
partner contract
partner risk level
service category
refund/cancellation exposure
performance history
commercial tier
custom negotiated terms
PSP constraints
```

Supplier не должен самостоятельно менять payout release rules для уже
существующих bookings.

------------------------------------------------------------------------

# 7. TWO IMMUTABLE SNAPSHOTS PER BOOKING

Для booking/order должны существовать:

``` text
Booking
├── BookingCommercialTermsSnapshot
│   └── Customer Payment Terms
│
└── SupplierSettlementTermsSnapshot
    └── TravelHub ↔ Supplier Settlement Terms
```

Оба snapshot должны быть versioned/auditable.

Изменение future policy не должно молча менять исторические bookings.

------------------------------------------------------------------------

# 8. SUPPLIER SETTLEMENT TERMS SNAPSHOT --- CONCEPTUAL CONTENT

Зафиксировать future conceptual model:

``` text
bookingId
orderId
supplierId
partnerAgreementVersion
settlementPolicyVersion
commissionRule/version
supplier entitlement rule
release conditions
release schedule
reserve/holdback rule
payout cadence
refund responsibility
chargeback responsibility
adjustment rules
negative-balance rules
currency
effectiveAt
createdAt
```

Exact schema/enums определить только на implementation design stage.

------------------------------------------------------------------------

# 9. SUPPLIER FINANCIAL LIFECYCLE

Архитектурно разделить:

``` text
Customer Funds Collected
Supplier Gross Entitlement
Supplier Net Entitlement
Awaiting Release Condition
Available for Payout
Reserve / Holdback
Payout Processing
Paid
Adjustments
Negative Supplier Balance / Supplier Receivable
```

Не сводить модель к:

``` text
supplierPaid = true/false
```

------------------------------------------------------------------------

# 10. SUPPLIER ENTITLEMENT

Conceptually:

``` text
Supplier Net Entitlement
=
Supplier Gross Entitlement
- TravelHub Commission
- Refund Adjustments
- Chargeback Adjustments
± Other Canonical Contractual Adjustments
```

Не дублировать authority существующей Finance architecture.

------------------------------------------------------------------------

# 11. CUSTOMER PAYMENT ≠ SUPPLIER BALANCE

Пример:

``` text
Customer paid              1 000 ₼
TravelHub commission         100 ₼
Supplier net entitlement     900 ₼
```

Supplier Balance не должен автоматически считаться как:

``` text
1 000 ₼
```

Клиентские поступления и supplier liability должны оставаться разными
финансовыми понятиями.

------------------------------------------------------------------------

# 12. RELEASE CONDITIONS

Settlement policy должна поддерживать release conditions, например:

``` text
supplier confirmed booking
customer installment collected
customer fully paid
service milestone reached
service started
service completed
refund/dispute window passed
manual risk review completed
contract-specific milestone
```

Exact conditions --- policy-driven.

------------------------------------------------------------------------

# 13. EARLY RELEASE / WORKING CAPITAL

Поддержать возможность частичного release до полного исполнения услуги.

Пример только для иллюстрации:

``` text
Supplier net entitlement = 900 ₼

Milestone A → 300 ₼ eligible
Milestone B → +300 ₼ eligible
Completion  → +300 ₼ eligible
```

Не фиксировать 30/30/30 или любые проценты как canonical default.

------------------------------------------------------------------------

# 14. CUSTOMER SCHEDULE AND SUPPLIER SCHEDULE ARE INDEPENDENT

Например:

``` text
Customer:
30% after confirmation
70% before service

Supplier:
part released after first qualifying condition
part after full customer payment
remaining part after service completion
```

Canonical rule:

``` text
Customer installment schedule
does NOT automatically define
Supplier settlement schedule.
```

------------------------------------------------------------------------

# 15. RESERVE / HOLDBACK

Поддержать:

``` text
Reserve / Holdback
```

как supplier-related amount, временно недоступную к payout.

Possible reasons:

``` text
refund exposure
chargeback exposure
service incomplete
partner risk policy
contractual reserve
dispute
```

------------------------------------------------------------------------

# 16. EVERY HOLD MUST BE EXPLAINABLE

Для reserve/holdback обязательно иметь conceptual metadata:

``` text
amount
reason
source booking/order
createdAt
releaseCondition
expectedReleaseAt — only when deterministically known
policy/version
```

Нельзя иметь необъяснимое:

``` text
Held = 2 100 ₼
```

без причины и условий release.

------------------------------------------------------------------------

# 17. ADJUSTMENTS

Supplier balance должен поддерживать immutable/auditable adjustments:

``` text
refund adjustment
chargeback adjustment
commission correction
authorized manual correction
contractual adjustment
```

Каждый adjustment:

``` text
amount
reason
source
actor/system source
timestamp
audit trail
```

------------------------------------------------------------------------

# 18. NEGATIVE SUPPLIER BALANCE

Если payout уже выполнен, а позже возник refund/chargeback:

``` text
Negative Supplier Balance
Supplier Receivable
Future Payout Offset
```

должны быть поддержаны.

Исторический payout нельзя переписывать/удалять.

------------------------------------------------------------------------

# 19. SETTLEMENT ≠ PAYOUT

Разделить:

``` text
Settlement
→ сколько экономически причитается Supplier

Release
→ сколько уже разрешено к выплате

Payout
→ фактическое перечисление / payment instruction
```

------------------------------------------------------------------------

# 20. PSP / LEGAL CUSTODY BOUNDARY

Не утверждать, что средства юридически находятся на собственном
банковском счёте TravelHub.

Использовать neutral canonical wording:

``` text
Funds are held/controlled by the canonical payment authority
(TravelHub and/or PSP according to the implemented payment architecture)
until settlement release conditions are satisfied.
```

Actual custody / escrow-like / connected-account mechanics определить на
PSP stage.

------------------------------------------------------------------------

# 21. SUPPLIER TRUST & TRANSPARENCY CONTRACT

Добавить отдельный архитектурный принцип:

``` text
Supplier Settlement Trust & Transparency Contract
```

Цель:

``` text
Supplier must be able to independently understand
and reconcile every material amount owed, held,
released, adjusted and paid.
```

------------------------------------------------------------------------

# 22. TRUST PRINCIPLE --- NO HIDDEN BALANCES

Supplier не должен видеть только:

``` text
Ваш баланс = 12 460 ₼
```

без breakdown.

Обязательная структура:

``` text
Начислено
Доступно к выплате
Ожидает условий выплаты
В резерве / Holdback
В обработке
Выплачено
Корректировки
Итоговый невыплаченный баланс
```

------------------------------------------------------------------------

# 23. TRUST PRINCIPLE --- NO UNEXPLAINED HOLDS

Каждая удерживаемая сумма должна отвечать:

``` text
Почему удерживается?
На основании какой policy/version?
С какой booking/order связана?
Какое условие release?
Когда release ожидается, если дата определима?
```

------------------------------------------------------------------------

# 24. TRUST PRINCIPLE --- TRACEABILITY TO BOOKING / ORDER

Каждая supplier-facing financial amount должна быть traceable до:

``` text
Booking
Order
Payment facts
Commission
Settlement
Reserve
Adjustment
Payout
```

Supplier должен иметь drill-down.

------------------------------------------------------------------------

# 25. TRUST PRINCIPLE --- EVERY DEDUCTION HAS A REASON

Нельзя показывать supplier:

``` text
Adjustment -150 ₼
```

без объяснения.

Нужно иметь:

``` text
type
reason
source
date
policy/contract basis where applicable
```

------------------------------------------------------------------------

# 26. TRUST PRINCIPLE --- POLICY VERSION VISIBLE

Supplier должен иметь доступ к settlement policy/version, применённой к
конкретной booking/order.

Conceptually:

``` text
Settlement Policy v3
Partner Agreement v5
Effective snapshot at booking
```

------------------------------------------------------------------------

# 27. TRUST PRINCIPLE --- HISTORICAL IMMUTABILITY

Новая settlement policy не должна silently rewrite старую booking.

Изменения исторических условий --- только через canonical
amendment/reconciliation mechanism с audit trail.

------------------------------------------------------------------------

# 28. TRUST PRINCIPLE --- INDEPENDENT RECONCILIATION

Supplier должен иметь возможность независимо проверить:

``` text
Opening balance
+ Accruals
- Commission
- Refund/chargeback adjustments
± Other adjustments
- Payouts
= Closing balance
```

Exact formula должна учитывать canonical ledger model.

------------------------------------------------------------------------

# 29. IMMUTABLE SUPPLIER FINANCIAL LEDGER

Supplier balance должен быть projection из canonical ledger/events, а не
manually mutable number.

Предпочтительный invariant:

``` text
Immutable / append-only financial entries
        ↓
Canonical balance projection
        ↓
Supplier-visible balance
```

Не:

``` text
UPDATE balance = arbitrary value
```

без traceable ledger event.

------------------------------------------------------------------------

# 30. SUPPLIER-VISIBLE LEDGER

Future Partner Finance UI должен позволять видеть по операциям:

``` text
date/time
booking/order
event type
customer-payment fact where relevant
supplier accrual
commission
reserve
release
adjustment
payout
running/derived balance where appropriate
```

------------------------------------------------------------------------

# 31. SUPPLIER BALANCE

Future Partner Workspace должен иметь:

``` text
Supplier Settlement Balance
```

Это НЕ Customer Payments report.

Минимальные KPI:

``` text
Начислено поставщику
Доступно к выплате
Ожидает условий выплаты
В резерве / Holdback
В обработке
Выплачено
Корректировки
Итоговый невыплаченный баланс
```

------------------------------------------------------------------------

# 32. OUTSTANDING SUPPLIER BALANCE

Conceptually:

``` text
Outstanding Supplier Balance
=
Awaiting Release
+ Available for Payout
+ Reserve / Holdback
+ Payout Processing
```

с явно задокументированным treatment:

``` text
adjustments
negative balances
multi-currency
```

на implementation stage.

------------------------------------------------------------------------

# 33. SUPPLIER PAYOUT FORECAST

Для cash-flow planning Supplier должен видеть прогноз там, где он
детерминирован.

Например:

``` text
Доступно сейчас
Ожидается в ближайшие 7 дней
Ожидается 8–30 дней
Зависит от выполнения условий
```

Не придумывать даты, если release зависит от неизвестного будущего
события.

------------------------------------------------------------------------

# 34. FORECAST CONFIDENCE / CONDITION

Если дата неизвестна:

показывать:

``` text
Ожидает завершения услуги
Ожидает полной оплаты клиента
Ожидает окончания reserve period
```

а не false precise date.

------------------------------------------------------------------------

# 35. SETTLEMENT STATEMENT

Future Partner Finance должен поддерживать:

``` text
Settlement Statement за период
```

Минимум:

``` text
opening balance
supplier accruals
commissions
reserves added
reserves released
refund adjustments
chargeback adjustments
other adjustments
payouts initiated
payouts completed
closing balance
```

------------------------------------------------------------------------

# 36. STATEMENT EXPORT / DOCUMENT

Зафиксировать future requirement:

``` text
Supplier can obtain/download a settlement statement for a selected period
```

Формат реализации определить позже.

Statement должен быть основан на canonical ledger, а не на independently
recomputed frontend data.

------------------------------------------------------------------------

# 37. SUPPLIER DISPUTE / QUESTION TRACEABILITY

Architecture должна позволять Supplier ссылаться на конкретную:

``` text
ledger entry
settlement
payout
booking/order
adjustment
```

при вопросе/споре.

Не проектировать dispute workflow сейчас, но сохранить traceable
identifiers.

------------------------------------------------------------------------

# 38. PLATFORM COMMAND CENTER --- FUTURE SECTION

Добавить future financial monitoring block:

``` text
Расчёты с поставщиками
Supplier Settlements
```

для PLATFORM workspace.

Не реализовывать сейчас.

------------------------------------------------------------------------

# 39. PLATFORM KPI --- OUTSTANDING SUPPLIER BALANCE

Future card:

``` text
Средства поставщиков у платформы
```

Internal canonical technical meaning:

``` text
Outstanding Supplier Settlement Balance
```

Это supplier liability / supplier-related outstanding settlement amount.

Не путать с:

``` text
GMV
Customer Payments
Payment Volume
Revenue
TravelHub cash
```

------------------------------------------------------------------------

# 40. PLATFORM KPI --- AVAILABLE FOR PAYOUT

Future card:

``` text
Доступно к выплате
```

Semantics:

``` text
Supplier amounts whose canonical release conditions
are satisfied and which are eligible for payout.
```

------------------------------------------------------------------------

# 41. PLATFORM KPI --- AWAITING RELEASE

Future card:

``` text
Ожидает условий выплаты
```

Semantics:

``` text
Supplier entitlement exists,
but payout release conditions are not yet satisfied.
```

------------------------------------------------------------------------

# 42. PLATFORM KPI --- RESERVE / HOLDBACK

Future card:

``` text
Резерв / Holdback
```

Semantics:

``` text
Supplier entitlement temporarily retained
under settlement/risk policy.
```

------------------------------------------------------------------------

# 43. PLATFORM KPI --- PAYOUT PROCESSING

Future card:

``` text
В обработке
```

Semantics:

``` text
Supplier payout initiated,
but not yet confirmed as completed.
```

------------------------------------------------------------------------

# 44. PLATFORM RECONCILIATION

Platform Command Center должен в будущем обеспечивать reconciliation:

``` text
Outstanding Supplier Balance
=
Available for Payout
+ Awaiting Release
+ Reserve / Holdback
+ Payout Processing
```

с explicit treatment adjustments/negative balances.

------------------------------------------------------------------------

# 45. FLOW KPI --- ACCRUED TO SUPPLIERS

Future card:

``` text
Начислено поставщикам за период
```

Это FLOW metric:

``` text
Supplier entitlement accrued during selected period
```

Не point-in-time balance.

------------------------------------------------------------------------

# 46. FLOW KPI --- PAID TO SUPPLIERS

Future card:

``` text
Выплачено поставщикам за период
```

Это FLOW metric:

``` text
successful supplier payouts during selected period
```

------------------------------------------------------------------------

# 47. UPCOMING PAYOUT KPI

Future card:

``` text
К выплате в ближайшие 7 дней
```

или configurable horizon.

Semantics:

``` text
amounts expected to become/pay out within selected horizon
based only on deterministically known release/due conditions
```

------------------------------------------------------------------------

# 48. OVERDUE PAYOUT KPI

Future card:

``` text
Просрочено поставщикам
```

Минимум:

``` text
amount
count
```

Conceptual predicate:

``` text
payout/settlement due
AND dueAt < now
AND not completed
```

Exact authority определить позже.

------------------------------------------------------------------------

# 49. PAYOUT AGING

Зафиксировать future Platform Finance aging view:

``` text
Today
1–3 days
4–7 days
8–30 days
>30 days
Overdue
```

Buckets должны основываться на canonical due/release dates.

------------------------------------------------------------------------

# 50. POINT-IN-TIME VS FLOW METRICS

Обязательно различать:

### Point-in-time

``` text
Outstanding Supplier Balance
Available for Payout
Awaiting Release
Reserve
Payout Processing
```

### Flow over selected period

``` text
Accrued to Suppliers
Paid to Suppliers
Adjustments during period
```

Не суммировать point-in-time balances как period flows.

------------------------------------------------------------------------

# 51. PERIOD COMPARISON

Для flow metrics допускается:

``` text
current period
previous comparable period
delta %
```

Для point-in-time balance comparison:

``` text
balance at end of current period
vs
balance at end of previous comparable period
```

если такой comparison contract реализуется позже.

------------------------------------------------------------------------

# 52. PLATFORM LIQUIDITY VISIBILITY

Platform должна понимать:

``` text
сколько supplier-related liabilities существует сейчас
сколько уже payable
сколько ожидает release
сколько находится в reserve
сколько payout processing
сколько потребуется выплатить в ближайшие периоды
сколько просрочено
```

Это operational liquidity planning, но НЕ должно называться свободными
денежными средствами TravelHub.

------------------------------------------------------------------------

# 53. PLATFORM TRUST OBLIGATION

Internal Platform UI должен позволять support/finance объяснить Supplier
те же цифры, которые видит Supplier.

Запрещён архитектурный сценарий:

``` text
Supplier sees balance A
Platform Finance sees independently calculated balance B
```

Оба должны происходить из одной canonical settlement/ledger authority, с
разным RBAC/view scope.

------------------------------------------------------------------------

# 54. SHARED SOURCE OF TRUTH

Canonical source:

``` text
Settlement / Payout / Financial Ledger authority
```

Consumers:

``` text
Partner Finance
Platform Command Center
Platform Finance
CRM summary
Statements
Decision Signals
```

CRM не становится authority.

Frontend не пересчитывает canonical financial balance самостоятельно.

------------------------------------------------------------------------

# 55. MULTI-CURRENCY

Если supplier settlements могут быть multi-currency:

не смешивать суммы разных валют в одном KPI без canonical FX contract.

Зафиксировать future requirement:

``` text
native currency balance
reporting/base currency conversion only through canonical FX authority
```

Не проектировать FX engine в этом amendment.

------------------------------------------------------------------------

# 56. DECISION SIGNALS --- FUTURE

Сохранить future candidates:

``` text
Supplier payout overdue
Reserve unusually high
Payout failure
Negative supplier balance
Settlement reconciliation mismatch
Upcoming payout liquidity concentration
```

Не реализовывать сейчас.

------------------------------------------------------------------------

# 57. PARTNER WORKSPACE FUTURE FINANCE

Зафиксировать future Partner Finance center как consumer этого
foundation.

Возможные blocks:

``` text
Balance
Upcoming payouts
Payout history
Settlement ledger
Settlement statements
Adjustments
Reserve
Booking/order drill-down
```

Не реализовывать UI сейчас.

------------------------------------------------------------------------

# 58. CRM FUTURE CONSUMPTION

CRM может в будущем показывать summary:

``` text
customer payment status
supplier settlement status
available for payout
paid to supplier
outstanding supplier balance
```

но CRM:

``` text
MUST NOT own
MUST NOT mutate
MUST NOT independently calculate
```

canonical settlement balances.

------------------------------------------------------------------------

# 59. ORDER / BOOKING FUTURE VISIBILITY

В будущем Order/Booking detail может одновременно показывать:

``` text
Customer Payment
+
Supplier Settlement
```

как два разных блока.

Пример:

``` text
Customer:
Paid 300 ₼
Outstanding 700 ₼

Supplier:
Accrued 270 ₼
Available 150 ₼
Reserve 120 ₼
Paid 0 ₼
```

Не реализовывать сейчас.

------------------------------------------------------------------------

# 60. AGREEMENT BOUNDARY

Customer-facing Booking Agreement содержит customer commercial/payment
terms.

TravelHub ↔ Supplier Partner Commercial Agreement содержит supplier
settlement terms.

Booking связывает:

``` text
Booking Agreement Snapshot
+
Supplier Settlement Terms Snapshot
```

Не смешивать их в один неразличимый contract.

------------------------------------------------------------------------

# 61. AUDIT

Все critical settlement changes/events должны быть auditable:

``` text
policy version
snapshot creation
accrual
reserve placement
reserve release
adjustment
payout initiation
payout completion/failure
negative balance creation/offset
```

------------------------------------------------------------------------

# 62. SECURITY / RBAC

Future implementation должна учитывать:

``` text
PLATFORM Finance/Admin authorized scope
PARTNER only own settlement/balance
no cross-partner visibility
no IDOR
no frontend-only financial authority
```

------------------------------------------------------------------------

# 63. DATA INTEGRITY

Future implementation должна иметь reconciliation invariants.

Минимум conceptually:

``` text
No unexplained balance mutation
No payout > eligible amount unless explicit authorized exception
No duplicate payout settlement consumption
No hidden adjustment
No cross-currency arithmetic without FX authority
```

------------------------------------------------------------------------

# 64. TRUST HARD GATES FOR FUTURE IMPLEMENTATION

Когда foundation будет реализовываться, VERDICT A невозможен без:

1.  Supplier can see outstanding balance.
2.  Supplier can see available-for-payout amount.
3.  Supplier can see reserve/holdback.
4.  Supplier can see awaiting-release amount.
5.  Supplier can see payout-processing amount.
6.  Supplier can see paid amount/history.
7.  Supplier can drill down to booking/order.
8.  Every deduction has reason.
9.  Every hold has reason/release condition.
10. Applied settlement policy/version is traceable.
11. Historical snapshots are immutable/auditable.
12. Supplier can reconcile opening → closing balance.
13. Settlement statement is generated from canonical ledger.
14. Platform and Supplier views use same authority.
15. Platform can monitor upcoming/overdue payouts.
16. No hidden/manual balance mutation.
17. RBAC/tenant isolation proven.

------------------------------------------------------------------------

# 65. ROADMAP ADDITION

Добавить в canonical roadmap отдельную future capability/stage
после/рядом с Booking Commercial Terms Foundation и до зависимых UI
consumers:

``` text
Supplier Settlement, Balance & Payout Transparency Foundation
```

Статус:

``` text
PLANNED — NOT STARTED
```

------------------------------------------------------------------------

# 66. RECOMMENDED FUTURE SUB-STEPS

Зафиксировать roadmap scope conceptually:

``` text
S.1  Supplier Settlement Policy Model
S.2  Settlement Policy Versioning
S.3  Booking Settlement Terms Snapshot
S.4  Supplier Entitlement Engine
S.5  Release Conditions / Milestones
S.6  Reserve / Holdback
S.7  Settlement Financial Ledger
S.8  Supplier Balance Projection
S.9  Payout Eligibility
S.10 Payout Lifecycle
S.11 Adjustments / Negative Balance
S.12 Supplier Settlement Statement
S.13 Supplier Payout Forecast
S.14 Partner Finance Visibility
S.15 Platform Settlement Monitoring
S.16 Platform Payout Aging / Liquidity View
S.17 CRM / Order / Booking Read Models
S.18 Decision Signals
S.19 Security / Audit / Reconciliation Closure
```

Exact numbering должна быть reconciled с существующим roadmap, не
создавать конфликт с уже занятыми step IDs.

------------------------------------------------------------------------

# 67. DEPENDENCY ON PSP

Отметить:

``` text
Logical settlement architecture can be designed before real PSP,
but production payout execution depends on PSP/payment integration.
```

Не объявлять real payout capability complete до PSP authority.

------------------------------------------------------------------------

# 68. DEPENDENCY ON BOOKING COMMERCIAL TERMS

Связь:

``` text
Customer Payment Terms Foundation
        ↓
Customer payment facts
        ↓
Supplier Settlement Foundation
```

Но supplier settlement остаётся отдельным bounded financial contract.

------------------------------------------------------------------------

# 69. DO NOT IMPLEMENT NOW

В этом prompt запрещено реализовывать:

``` text
DB migrations
Prisma entities
NestJS services/controllers
frontend cards
Partner Finance page
Command Center cards
real payout engine
PSP transfer logic
ledger engine
settlement statements
CRM fields
Decision Signals
```

Только Architecture/Roadmap reconciliation.

------------------------------------------------------------------------

# 70. REQUIRED ARCHITECTURE DOCUMENT

Создать или additive-обновить отдельный canonical audit/design document,
например:

``` text
docs/architecture/supplier-settlement-balance-payout-transparency-audit.md
```

Использовать repository naming conventions, если canonical path
отличается.

------------------------------------------------------------------------

# 71. ARCHITECTURE INDEX

Добавить документ в architecture index/README, если проект использует
такой index.

------------------------------------------------------------------------

# 72. ROADMAP UPDATE

Additive обновить:

``` text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Не переписывать историю предыдущих phases/stages.

------------------------------------------------------------------------

# 73. REQUIRED RECONCILIATION MATRIX

В report вернуть:

  ------------------------------------------------------------------------
  Concern            Customer Payment  Supplier          Supplier Payout
                     Terms             Settlement Terms  
  ------------------ ----------------- ----------------- -----------------
  Primary question                                       

  Authority                                              

  Who defines                                            

  Snapshot required                                      

  Versioned                                              

  Booking linkage                                        

  Supplier-visible                                       

  Platform-visible                                       
  ------------------------------------------------------------------------

------------------------------------------------------------------------

# 74. REQUIRED BALANCE MATRIX

  -----------------------------------------------------------------------------
  Balance       Meaning     Point-in-time / Supplier    Platform    Canonical
  component                 Flow            visible     visible     authority
  ------------- ----------- --------------- ----------- ----------- -----------
  Supplier                                                          
  accrued                                                           

  Available for                                                     
  payout                                                            

  Awaiting                                                          
  release                                                           

  Reserve /                                                         
  Holdback                                                          

  Payout                                                            
  processing                                                        

  Paid                                                              

  Adjustments                                                       

  Outstanding                                                       
  balance                                                           
  -----------------------------------------------------------------------------

------------------------------------------------------------------------

# 75. REQUIRED TRUST MATRIX

  Trust requirement                    Architecture mechanism   Future evidence
  ------------------------------------ ------------------------ -----------------
  No hidden balances                                            
  No unexplained holds                                          
  Booking/order traceability                                    
  Deduction reason                                              
  Policy version visibility                                     
  Immutable history                                             
  Independent reconciliation                                    
  Statement by period                                           
  Payout forecast                                               
  Shared supplier/platform authority                            

------------------------------------------------------------------------

# 76. REQUIRED PLATFORM KPI MATRIX

  -----------------------------------------------------------------------------------
  KPI            Type                  Meaning        Included in      Period
                                                      outstanding      behavior
                                                      reconciliation   
  -------------- --------------------- -------------- ---------------- --------------
  Outstanding    Point-in-time                                         
  Supplier                                                             
  Balance                                                              

  Available for  Point-in-time                                         
  Payout                                                               

  Awaiting       Point-in-time                                         
  Release                                                              

  Reserve /      Point-in-time                                         
  Holdback                                                             

  Payout         Point-in-time                                         
  Processing                                                           

  Accrued to     Flow                                                  
  Suppliers                                                            

  Paid to        Flow                                                  
  Suppliers                                                            

  Upcoming       Forward-looking                                       
  Payouts                                                              

  Overdue        Point-in-time/aging                                   
  Payouts                                                              
  -----------------------------------------------------------------------------------

------------------------------------------------------------------------

# 77. REQUIRED ROADMAP MATRIX

  Future step   Purpose   Dependency   Status
  ------------- --------- ------------ --------

Все новые steps:

``` text
PLANNED — NOT STARTED
```

------------------------------------------------------------------------

# 78. REQUIRED REPORT

Создать:

``` text
docs/prompts/PHASE_3_SUPPLIER_SETTLEMENT_BALANCE_PAYOUT_TRUST_ARCHITECTURE_RECONCILIATION_REPORT.md
```

------------------------------------------------------------------------

# 79. PRODUCTION CODE GATE

Report должен явно доказать:

``` text
Production code changed: NO
DB schema changed: NO
Runtime behavior changed: NO
```

------------------------------------------------------------------------

# 80. GIT CLOSURE

После documentation reconciliation:

``` text
git status
git diff
commit only related documentation
push origin/master
verify HEAD == origin/master
```

Не включать unrelated working-tree files.

------------------------------------------------------------------------

# 81. ACCEPTANCE CRITERIA

VERDICT A только если:

1.  Customer Payment Terms и Supplier Settlement Terms явно разделены.
2.  Обе системы условий обязательны в booking architecture.
3.  Supplier Payout выделен в третий execution layer.
4.  Два independent snapshots зафиксированы.
5.  Settlement policy versioning зафиксирован.
6.  Supplier entitlement lifecycle зафиксирован.
7.  Early release/working-capital support зафиксирован.
8.  Customer installments не определяют автоматически supplier payouts.
9.  Reserve/Holdback зафиксирован.
10. Release conditions зафиксированы.
11. Adjustments зафиксированы.
12. Negative supplier balance зафиксирован.
13. Supplier Settlement Balance зафиксирован.
14. Supplier-visible ledger зафиксирован.
15. No hidden balances principle зафиксирован.
16. No unexplained holds principle зафиксирован.
17. Booking/order traceability зафиксирована.
18. Every deduction has reason зафиксировано.
19. Settlement policy/version visibility зафиксирована.
20. Historical immutability зафиксирована.
21. Independent reconciliation зафиксирована.
22. Settlement Statement за период зафиксирован.
23. Supplier payout forecast зафиксирован.
24. Unknown payout dates must not be fabricated.
25. Platform/Supplier use same canonical authority.
26. Platform Outstanding Supplier Balance KPI зафиксирован.
27. Available for Payout KPI зафиксирован.
28. Awaiting Release KPI зафиксирован.
29. Reserve/Holdback KPI зафиксирован.
30. Payout Processing KPI зафиксирован.
31. Accrued to Suppliers period KPI зафиксирован.
32. Paid to Suppliers period KPI зафиксирован.
33. Upcoming Payouts KPI зафиксирован.
34. Overdue Payouts KPI зафиксирован.
35. Payout aging зафиксирован.
36. Point-in-time vs flow semantics зафиксированы.
37. Platform liquidity monitoring зафиксирован без смешения с free cash.
38. Multi-currency boundary зафиксирован.
39. PSP/legal custody boundary зафиксирован.
40. Future Partner Finance consumer зафиксирован.
41. CRM remains consumer, not authority.
42. Future Order/Booking dual financial visibility зафиксирована.
43. Audit requirements зафиксированы.
44. RBAC/tenant isolation requirements зафиксированы.
45. Future Decision Signal candidates зафиксированы.
46. Roadmap capability добавлена additive.
47. Все new roadmap steps = PLANNED --- NOT STARTED.
48. Production code changed = NO.
49. DB schema changed = NO.
50. Runtime behavior changed = NO.
51. Architecture index updated.
52. Reconciliation report created.
53. Related docs committed.
54. Unrelated files not committed.
55. Push completed.
56. HEAD == origin/master.
57. CRM Step 3.5 NOT started.
58. Supplier Settlement production implementation NOT started.
59. Command Center supplier-settlement cards NOT implemented.
60. Decision Queue Round 5 not modified by this documentation task.

------------------------------------------------------------------------

# 82. VERDICT RULE

Только при выполнении всех hard gates:

``` text
VERDICT A — SUPPLIER SETTLEMENT / BALANCE / PAYOUT TRUST & TRANSPARENCY ARCHITECTURE FULLY RECONCILED / ROADMAP PRESERVED
```

Иначе:

``` text
VERDICT B — SUPPLIER SETTLEMENT TRUST ARCHITECTURE RECONCILIATION INCOMPLETE
```

------------------------------------------------------------------------

# 83. FINAL RESPONSE FORMAT

``` text
Verdict:

Customer Payment vs Supplier Settlement:
Settlement snapshots:
Entitlement/release lifecycle:
Reserve/Holdback:
Payout lifecycle:
Adjustments/negative balance:

Supplier Balance:
Supplier Ledger:
Settlement Statement:
Payout Forecast:

Trust & Transparency:
No hidden balances:
No unexplained holds:
Traceability:
Policy/version visibility:
Independent reconciliation:

Platform Command Center future KPIs:
Point-in-time metrics:
Period flow metrics:
Payout aging/liquidity:

PSP/legal custody boundary:
CRM/Order/Booking consumers:
Security/Audit:

Architecture files:
Roadmap:
Production code changed:
DB schema changed:
Runtime behavior changed:

Commit:
Push:
HEAD:
origin/master:
HEAD == origin/master:
Unrelated files:

Remaining findings:
Next canonical stage:
```

------------------------------------------------------------------------

# 84. STOP

После report:

**STOP.**

Не запускать автоматически:

``` text
Supplier Settlement implementation
Command Center KPI implementation
Partner Finance implementation
CRM Step 3.5
Decision Signals
PSP payout integration
other Phase 3 stages
```
