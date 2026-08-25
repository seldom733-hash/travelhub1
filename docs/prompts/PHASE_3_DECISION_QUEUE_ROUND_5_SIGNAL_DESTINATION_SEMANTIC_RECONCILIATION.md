# PHASE 3 --- DECISION QUEUE ROUND 5

## SIGNAL PREDICATE → DESTINATION DATASET SEMANTIC RECONCILIATION + TABLE PAGINATION CONTRACT

## IMPLEMENTATION / RUNTIME EVIDENCE REQUIRED

------------------------------------------------------------------------

# 1. ЦЕЛЬ

Исправить оставшийся системный дефект Decision Queue:

``` text
HTTP 200 / valid route / supported query param
≠
семантически правильная выборка
```

После предыдущих remediation маршруты технически открываются, но
destination datasets во многих случаях НЕ соответствуют
cohort/predicate, которым был рассчитан сам Decision Signal.

Нужна полная reconciliation:

``` text
Detector predicate
→ Signal evidence/count
→ Action semantics
→ URL/query contract
→ Backend predicate
→ Destination dataset
→ UI total/pagination
```

Для каждого действия destination dataset должен быть семантически
эквивалентен detector cohort либо иметь явно доказанный и
документированный mapping.

------------------------------------------------------------------------

# 2. НЕ ПЕРЕПИСЫВАТЬ РАБОТАЮЩУЮ ОСНОВУ

Сохранить предыдущие исправления:

``` text
Decision Signal lifecycle
REOPEN
Active / History partition
inline lifecycle errors
valid /app/* routes
Suspense fixes
URL param consumption
RBAC
tenant/workspace isolation
```

Не откатывать Round 4 V2.

------------------------------------------------------------------------

# 3. ИСХОДНОЕ НАБЛЮДАЕМОЕ СОСТОЯНИЕ

На runtime ранее наблюдались следующие сигналы:

``` text
SERVICES_WITHOUT_SALES        = 31
UPCOMING_BOOKINGS             = 50
PENDING_REFUNDS               = 20
FAILED_PAYMENTS               = 8
BOOKING_CONFIRMATION_DELAY    = 5
RECENT_CANCELLATIONS          = 25 за последние 7 дней
```

Не hardcode эти числа.

Они являются evidence/reference для понимания проблемы.

После реализации counts должны вычисляться из текущей runtime DB и могут
измениться.

------------------------------------------------------------------------

# 4. ОСНОВНОЙ HARD GATE

Запрещено считать action исправленным только потому, что:

``` text
route exists
HTTP = 200
query param accepted
page renders
```

Hard gate:

``` text
Action destination MUST represent the business cohort promised by the signal/action.
```

------------------------------------------------------------------------

# 5. REQUIRED PREDICATE PARITY AUDIT

Для КАЖДОГО signal/action сначала найти реальный detector
implementation.

Не выводить predicate из названия сигнала.

Зафиксировать:

``` text
Signal type
Detector source
Detector predicate
Entity being counted
Count semantics
Time window
Status restrictions
Join/relationship semantics
Deduplication semantics
Evidence fields
```

Затем отдельно определить destination predicate.

------------------------------------------------------------------------

# 6. SERVICES_WITHOUT_SALES --- "Открыть услуги"

Наблюдение:

``` text
Signal: 31 услуг без продаж
Current destination:
Catalog / status=PUBLISHED
```

Это недостаточно.

`PUBLISHED` означает опубликованные услуги, а не услуги без продаж.

Нужно найти canonical detector predicate `SERVICES_WITHOUT_SALES`.

Destination должен применять эквивалентный predicate.

Conceptually:

``` text
status = PUBLISHED
AND qualifying sales/orders = 0
```

Но НЕ копировать этот пример вслепую.

Использовать фактическую detector semantics проекта.

------------------------------------------------------------------------

# 7. SERVICES_WITHOUT_SALES --- "Проверить доступность"

Это отдельное действие и отдельная business semantics.

Если signal evidence показывает:

``` text
31 без availability
0 с availability
```

кнопка "Проверить доступность" должна открывать cohort услуг, требующих
проверки availability.

Не допустимо:

``` text
status=PUBLISHED
```

без availability predicate.

Нужно определить фактический Catalog availability authority и detector
evidence semantics.

Destination conceptually:

``` text
published cohort
AND canonical availability condition matching detector evidence
```

------------------------------------------------------------------------

# 8. ДВА CATALOG ACTION НЕ ОБЯЗАНЫ ИМЕТЬ ОДИН FILTER

Даже если сейчас фактические cohorts совпадают:

``` text
"Открыть услуги"
≠
"Проверить доступность"
```

Первый action должен выражать:

``` text
without sales
```

Второй:

``` text
availability problem
```

Если оба случайно возвращают одни и те же 31 записи --- это допустимо
только если predicates независимы и данные действительно дают одинаковый
set.

------------------------------------------------------------------------

# 9. CATALOG FILTER CONTRACT

Если Catalog API/UI сейчас не поддерживает необходимые predicates:

НЕ заменять их более широким `PUBLISHED`.

Добавить минимальные canonical server-side filters.

Working names допустимы, например:

``` text
unsold=true
availability=missing
```

НО exact names выбрать после анализа существующих API conventions.

Требования:

``` text
validated DTO/query
server-side predicate
frontend URL consumption
filter state visible in UI
pagination preserves filter
total reflects filtered cohort
```

------------------------------------------------------------------------

# 10. UPCOMING_BOOKINGS --- "Открыть предстоящие"

Наблюдение:

``` text
Signal: 50 upcoming bookings
Current destination previously returned hundreds,
including completed/confirmed/in-service combinations.
```

Нужно найти canonical detector predicate.

Не считать автоматически:

``` text
serviceDate >= today
```

достаточным.

Проверить:

``` text
service/departure/start time
booking lifecycle status
terminal statuses
cancelled status
completed status
in-service semantics
timezone
```

------------------------------------------------------------------------

# 11. UPCOMING BOOKING SEMANTICS

Destination должен соответствовать detector definition.

Если detector считает только ещё не начавшиеся и non-terminal bookings,
destination обязан исключить terminal/ineligible statuses.

Conceptually:

``` text
serviceStart > now
AND status in canonical future-eligible statuses
```

Exact predicate = detector authority.

Не придумывать новую definition только для страницы.

------------------------------------------------------------------------

# 12. BOOKING CONFIRMATION DELAY --- "Открыть бронирования"

Это НЕ "service date overdue".

Наблюдавшийся signal:

``` text
5 бронирований ожидают подтверждения
SLA threshold: 240 minutes
```

Нужно найти detector.

Destination должен открывать бронирования, которые соответствуют именно
confirmation-delay predicate.

Conceptually:

``` text
awaiting supplier confirmation
AND waiting duration > SLA
```

Не использовать:

``` text
status=CONFIRMED
AND serviceDate < today
```

если detector этого не делает.

------------------------------------------------------------------------

# 13. CONFIRMATION SLA

Если SLA является detector/config authority:

``` text
destination MUST use same threshold/source
```

Не дублировать hardcoded `240` в нескольких слоях, если можно
использовать canonical configuration/derived filter.

Если URL должен содержать filter, он должен однозначно воспроизводить
detector cohort.

------------------------------------------------------------------------

# 14. PENDING_REFUNDS --- "Открыть возвраты"

Наблюдение:

``` text
Signal: 20 pending refunds
Current destination:
status=CANCELLED
```

Это семантически недостаточно.

``` text
CANCELLED Order
≠
Pending Refund
```

Отменённый неоплаченный заказ может не иметь денег для возврата.

Уже возвращённый заказ не является pending refund.

------------------------------------------------------------------------

# 15. REFUND AUTHORITY

Найти реальный authority:

``` text
Refund
Payment
Order refund projection
other canonical finance entity
```

Найти predicate detector `PENDING_REFUNDS`.

Destination должен показывать именно entities/orders/refunds, связанные
с pending refund cohort.

Если Orders page является destination, добавить canonical filter,
основанный на refund authority.

Не подменять refund lifecycle order lifecycle.

------------------------------------------------------------------------

# 16. FAILED_PAYMENTS --- "Открыть платежи"

Наблюдение:

``` text
Signal: 8 failed payments
Current destination:
paymentStatus=UNPAID
```

Это неверная semantic equivalence.

``` text
UNPAID Order
≠
FAILED payment attempt
```

Order может быть неоплачен без единой неуспешной попытки платежа.

------------------------------------------------------------------------

# 17. PAYMENT FAILURE AUTHORITY

Найти canonical Payment/payment-attempt authority, который detector
использует для `FAILED_PAYMENTS`.

Destination должен фильтровать по тому же failure concept.

Conceptually:

``` text
payment/payment attempt status = FAILED
```

Если destination = Orders page, backend должен уметь выбирать Orders,
связанные с canonical failed payment records.

------------------------------------------------------------------------

# 18. COUNT CARDINALITY FOR FAILED PAYMENTS

Отдельно определить:

``` text
Signal count = payment attempts?
unique payments?
unique orders?
```

Если signal считает 8 failed attempts, а они принадлежат 6 orders,
destination Orders может корректно показать 6 заказов.

В таком случае parity НЕ обязана быть `8 == 6`, но report должен
доказать:

``` text
8 failed attempts
→ 6 unique affected orders
→ all 8 attempts represented by those 6 orders
```

Нельзя молча сравнивать разные cardinalities.

------------------------------------------------------------------------

# 19. RECENT_CANCELLATIONS --- "Открыть заказы"

Наблюдение:

``` text
Signal: 25 cancellations за последние 7 дней
Current destination:
status=CANCELLED
```

Destination обязан сохранять time window detector-а.

Conceptually:

``` text
status=CANCELLED
AND canonical cancellation timestamp within detector window
```

Использовать именно canonical cancellation timestamp, не `updatedAt`,
если detector использует другое поле.

------------------------------------------------------------------------

# 20. TIME WINDOW PARITY

Для time-relative signals:

``` text
detector now/timezone/window
destination now/timezone/window
```

должны быть согласованы.

Зафиксировать timezone semantics.

Не допускать расхождение из-за:

``` text
UTC vs local
calendar day vs rolling 7*24h
createdAt vs cancelledAt
```

------------------------------------------------------------------------

# 21. ALL ACTIONS INVENTORY

Не ограничиваться только шестью перечисленными signal types.

Просканировать текущий Decision Queue registry/action derivation и
составить полный runtime inventory:

``` text
signal type
available actions
route
query
detector
destination
```

Если есть другие actions --- включить их в audit.

------------------------------------------------------------------------

# 22. NO FALSE FILTERED-CONTEXT CLAIMS

UI не должен показывать:

``` text
Без продаж
Pending refunds
Failed payments
Upcoming
Overdue confirmation
```

если фактический backend query не обеспечивает этот predicate.

Название active filter и dataset должны совпадать.

------------------------------------------------------------------------

# 23. FILTER VISIBILITY

При переходе из Decision Queue пользователь должен видеть активный
контекст.

Примеры conceptually:

``` text
Catalog:
Статус: Опубликован
Продажи: Без продаж

Catalog:
Статус: Опубликован
Доступность: Не настроена

Bookings:
Предстоящие

Orders/Finance:
Возврат: Ожидает обработки

Orders/Payments:
Платёж: Неуспешный

Bookings:
Подтверждение: SLA нарушен

Orders:
Статус: Отменён
Период: Последние 7 дней
```

Exact labels должны соответствовать существующему RU/AZ/EN UX.

------------------------------------------------------------------------

# 24. PAGINATION --- ОБЩИЙ STANDARD

Для рабочих таблиц:

``` text
Catalog
Orders
Bookings
```

зафиксировать и реализовать visible pagination.

Default:

``` text
20 rows per page
```

Page-size options:

``` text
20 / 50 / 100
```

------------------------------------------------------------------------

# 25. PAGINATION UI

Минимальный UX:

``` text
Найдено: 31
Показано: 1–20 из 31

‹ 1 2 ›
```

Для 129:

``` text
Найдено: 129
Показано: 1–20 из 129

‹ 1 2 3 4 5 6 7 ›
```

Не обязательно буквально использовать этот visual layout, если
существующий design system имеет canonical pagination component.

------------------------------------------------------------------------

# 26. SERVER-SIDE PAGINATION

Pagination должна быть server-side либо использовать существующий
canonical server pagination contract.

Не загружать искусственно весь dataset только ради pagination UI.

Проверить:

``` text
page / offset / cursor
limit/pageSize
total
stable sorting
filter + pagination composition
```

------------------------------------------------------------------------

# 27. FILTERS MUST SURVIVE PAGINATION

При переходе:

``` text
page 1 → page 2
```

не должны теряться:

``` text
status
unsold
availability
refund filter
payment failure filter
upcoming
confirmation delay
date window
search
other active filters
```

------------------------------------------------------------------------

# 28. PAGE SIZE MUST NOT CHANGE SEMANTICS

Для:

``` text
Services Without Sales = 31
```

правильный результат:

``` text
Total filtered = 31
Page 1 = 20
Page 2 = 11
```

НЕ:

``` text
Total = 20
```

и НЕ:

``` text
Total = 129 published
Page 1 = 20
```

------------------------------------------------------------------------

# 29. TOTAL COUNT AUTHORITY

Destination API должен возвращать/позволять получить total для FILTERED
cohort.

UI должен показывать filtered total.

Нельзя использовать:

``` text
rows.length
```

как total при server pagination.

------------------------------------------------------------------------

# 30. PAGINATION + URL STATE

Желательно сохранять page/pageSize/filter state в URL, если это
согласуется с текущей архитектурой.

Минимум deep-link из Decision Queue должен оставаться воспроизводимым.

После reload пользователь должен оставаться в том же filtered context.

------------------------------------------------------------------------

# 31. SORTING STABILITY

При server-side pagination обеспечить deterministic stable ordering.

Использовать canonical existing sort contract.

Если sort values равны, использовать stable tie-breaker.

Это нужно, чтобы записи не прыгали между страницами.

------------------------------------------------------------------------

# 32. CATALOG --- EXPECTED END STATE

Для "Услуги без продаж":

``` text
Decision Queue
31 услуг без продаж
→ Открыть услуги

Catalog
Active filters:
  Published
  Without sales

Filtered total: 31
Page 1: first 20
Page 2: remaining 11
```

Numbers illustrative from current evidence, not hardcoded.

------------------------------------------------------------------------

# 33. AVAILABILITY --- EXPECTED END STATE

Для "Проверить доступность":

``` text
Decision Queue
availability evidence
→ Проверить доступность

Catalog
Active filters:
  canonical relevant publication status
  availability problem/missing

Filtered total:
  must reconcile to detector availability evidence
```

------------------------------------------------------------------------

# 34. UPCOMING --- EXPECTED END STATE

``` text
Decision Queue
Upcoming bookings: detector count
→ Открыть предстоящие

Bookings
Active filter: canonical upcoming
Filtered total: detector-equivalent cohort
```

Не включать records, которые detector не считает upcoming.

------------------------------------------------------------------------

# 35. PENDING REFUNDS --- EXPECTED END STATE

``` text
Decision Queue
Pending refunds: detector count
→ Открыть возвраты

Destination
Active filter: pending refund
Dataset: refund-authority equivalent
```

Не заменять на все cancelled orders.

------------------------------------------------------------------------

# 36. FAILED PAYMENTS --- EXPECTED END STATE

``` text
Decision Queue
Failed payments: detector count
→ Открыть платежи

Destination
Active filter: failed payment
Dataset: canonical failed-payment cohort/mapping
```

Не заменять на all unpaid orders.

------------------------------------------------------------------------

# 37. CONFIRMATION DELAY --- EXPECTED END STATE

``` text
Decision Queue
Bookings awaiting confirmation beyond SLA
→ Открыть бронирования

Bookings
Active filter: confirmation delay / SLA breached
Dataset: detector-equivalent cohort
```

------------------------------------------------------------------------

# 38. RECENT CANCELLATIONS --- EXPECTED END STATE

``` text
Decision Queue
Recent cancellations
→ Открыть заказы

Orders
Active filters:
  Cancelled
  same detector time window
```

------------------------------------------------------------------------

# 39. NO INVENTED BUSINESS SEMANTICS

Если существующий page model не способен выразить detector predicate:

``` text
ADD the missing capability
```

или:

``` text
report a blocking architecture gap
```

Не подменять predicate ближайшим существующим filter.

------------------------------------------------------------------------

# 40. REUSE DETECTOR LOGIC WHERE SAFE

Предпочтительно не дублировать сложные predicates независимо в:

``` text
detector
list endpoint
frontend
```

Рассмотреть shared query/predicate builder или canonical domain service,
если это не нарушает bounded-context ownership.

Цель:

``` text
one business definition
multiple consumers
```

Но не создавать опасную cross-domain coupling.

------------------------------------------------------------------------

# 41. DATA AUTHORITY BOUNDARIES

Соблюдать:

``` text
Catalog → service/catalog predicates
Booking → booking lifecycle predicates
Order → order lifecycle
Finance/Payment → payment/refund predicates
```

Orders page может отображать finance-derived context, но Order status не
становится authority failed payment/refund lifecycle.

------------------------------------------------------------------------

# 42. SECURITY

Все новые query filters:

``` text
RBAC guarded
workspace/tenant scoped
PARTNER own-scope where applicable
no IDOR
no cross-partner leakage
```

Filter не должен расширять object scope.

------------------------------------------------------------------------

# 43. VALIDATION

Новые query params должны быть строго валидированы.

Invalid values:

``` text
→ 400
```

а не:

``` text
500
silent fallback
ignore invalid filter
```

------------------------------------------------------------------------

# 44. BACKEND TESTS --- DETECTOR PARITY

Для каждого signal/action добавить test, доказывающий:

``` text
detector cohort
↔ destination cohort
```

Использовать controlled fixture с:

``` text
matching records
near-miss records
records excluded by status
records excluded by time
records excluded by payment/refund state
```

------------------------------------------------------------------------

# 45. NEAR-MISS TESTS REQUIRED

Особенно доказать:

### Services without sales

``` text
PUBLISHED + no sales → included
PUBLISHED + sales → excluded
non-PUBLISHED + no sales → excluded if detector excludes it
```

### Availability

``` text
matching missing/problem availability → included
valid availability → excluded
```

### Failed payments

``` text
FAILED attempt → included
UNPAID with no failed attempt → excluded
PAID order with historical failed attempt → behavior explicitly defined by detector
```

### Pending refunds

``` text
pending refund → included
cancelled unpaid order with no refund → excluded
completed refund → excluded
```

### Upcoming

``` text
future eligible → included
completed future/anomalous record → detector-defined
cancelled future → excluded if detector excludes
past active → excluded
```

### Confirmation delay

``` text
pending beyond SLA → included
pending below SLA → excluded
confirmed → excluded
```

### Recent cancellation

``` text
cancelled inside window → included
cancelled outside window → excluded
```

------------------------------------------------------------------------

# 46. FRONTEND TESTS

Проверить:

``` text
deep-link query consumed
correct filter chip/state shown
total displayed
page navigation works
page-size changes work
filters preserved across pages
reload preserves context where URL-backed
```

------------------------------------------------------------------------

# 47. BROWSER RUNTIME EVIDENCE --- REQUIRED

Unit tests недостаточны.

В browser проверить все Decision Queue actions.

Для каждого action записать:

``` text
signal count/evidence
clicked action
final URL
visible active filters
filtered total
first-page row count
page count
sample matching rows
sample excluded near-miss
HTTP status
```

------------------------------------------------------------------------

# 48. COUNT RECONCILIATION RULE

Если signal и destination считают одну и ту же entity/cardinality:

``` text
signal count == destination filtered total
```

обязательно.

Если cardinality различается:

``` text
attempts → unique orders
refund requests → affected orders
```

report обязан показать mapping и reconciliation.

------------------------------------------------------------------------

# 49. NO HARD-CODED COUNTS

Не кодировать:

``` text
31
50
20
8
5
25
```

в production logic/tests как runtime expected values, кроме специально
controlled test fixtures.

Runtime evidence берётся из текущей DB.

------------------------------------------------------------------------

# 50. CURRENT SIGNAL LIFECYCLE

Не очищать и не массово менять lifecycle signals ради теста.

Не переводить все signals в RESOLVED/DISMISSED.

Если требуется controlled test, использовать test DB.

Runtime signal state сохранить.

------------------------------------------------------------------------

# 51. ACTIVE / HISTORY INTEGRITY

После remediation проверить:

``` text
OPEN/ACKNOWLEDGED → Active
RESOLVED/DISMISSED → History
REOPEN preserves history
no duplicate fingerprint rows
```

Это regression gate, а не scope для redesign.

------------------------------------------------------------------------

# 52. CATALOG STATUS TERMINOLOGY

Catalog canonical statuses:

``` text
DRAFT
COMPLETE
REVIEWED
PUBLISHED
ARCHIVED
```

UI semantics:

``` text
Черновик
Заполнен
Проверен
Опубликован
Архивирован
```

Не использовать `ACTIVE` как Product status.

------------------------------------------------------------------------

# 53. "ОЖИДАЮТ ПУБЛИКАЦИИ" WIDGET --- OUT OF SCOPE

Новый согласованный widget:

``` text
Ожидают публикации
= REVIEWED
count + sum of canonical service prices
```

уже сохранён в Architecture/Roadmap.

В Round 5 его НЕ реализовывать.

------------------------------------------------------------------------

# 54. BOOKING COMMERCIAL TERMS FOUNDATION --- OUT OF SCOPE

Не реализовывать в этом Round:

``` text
partial payments
payment schedules
supplier-defined payment deadlines
booking agreement
service terms versioning
amendments
```

Это отдельная future roadmap capability.

------------------------------------------------------------------------

# 55. CRM STEP 3.5 --- DO NOT START

CRM Step 3.5 не запускать автоматически.

Round 5 должен закончиться отдельным verdict.

------------------------------------------------------------------------

# 56. REQUIRED ACTION MATRIX

В report вернуть:

  -----------------------------------------------------------------------------------------------------
  Signal   Detector   Detector       Signal Action   Destination   Destination     Destination Parity
           entity     predicate       count          predicate     entity                total 
  -------- ---------- ----------- --------- -------- ------------- ------------- ------------- --------

  -----------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 57. REQUIRED CATALOG SUB-MATRIX

  -----------------------------------------------------------------------------------------
  Action   Publication   Sales    Availability        Total     Page 1      Pages Correct
           filter        filter   filter                                          
  -------- ------------- -------- -------------- ---------- ---------- ---------- ---------

  -----------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 58. REQUIRED BOOKING SUB-MATRIX

  ---------------------------------------------------------------------------------
  Action    Date        Status      SLA                Total     Detector Correct
            predicate   predicate   predicate                       count 
  --------- ----------- ----------- ----------- ------------ ------------ ---------

  ---------------------------------------------------------------------------------

------------------------------------------------------------------------

# 59. REQUIRED FINANCE SUB-MATRIX

  ------------------------------------------------------------------------------------
  Signal    Finance     Finance     Order            Signal   Destination Reconciled
            authority   predicate   mapping     cardinality   cardinality 
  --------- ----------- ----------- --------- ------------- ------------- ------------

  ------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 60. REQUIRED PAGINATION MATRIX

  -------------------------------------------------------------------------------------
  Page          Filtered     Default Options      Page count Filter        URL/reload
                   total   page size                         persistence   
  ---------- ----------- ----------- ----------- ----------- ------------- ------------
  Catalog                         20 20/50/100                             

  Orders                          20 20/50/100                             

  Bookings                        20 20/50/100                             
  -------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 61. REQUIRED PARAMETER CONTRACT MATRIX

  -----------------------------------------------------------------------------
  Page     Param    Meaning   Allowed   Backend   Frontend   Visible   Tested
                              values                         filter    
  -------- -------- --------- --------- --------- ---------- --------- --------

  -----------------------------------------------------------------------------

Включить все новые и существующие params, используемые Decision Queue.

------------------------------------------------------------------------

# 62. REQUIRED NEGATIVE EVIDENCE

Для каждого action показать минимум один record/class, который раньше
ошибочно попадал в destination, а теперь исключён.

Примеры:

``` text
UNPAID but no failed payment
CANCELLED but no pending refund
PUBLISHED but has sales
PUBLISHED with valid availability
COMPLETED booking not upcoming
confirmation below SLA
old cancellation outside 7-day window
```

------------------------------------------------------------------------

# 63. REQUIRED TEST GATES

Минимум:

``` text
backend unit
backend relevant e2e/integration
frontend relevant tests
backend TSC
backend build
frontend TSC
```

Не ограничиваться общим "70/70", если новые tests не доказали semantic
parity.

------------------------------------------------------------------------

# 64. REQUIRED RUNTIME GATES

Для каждого valid action:

``` text
404 = 0
500 = 0
wrong-domain = 0
false-filter-context = 0
semantic cohort mismatch = 0
```

------------------------------------------------------------------------

# 65. PAGINATION HARD GATES

Для каждой из трёх страниц:

``` text
default page size = 20
20/50/100 selectable
filtered total visible
page navigation visible when total > pageSize
filter persists on page change
page resets safely when filter changes
no duplicate/missing rows due unstable sort
```

Если существующий design system использует иной canonical UX, сохранить
визуальный стиль, но semantics должны быть эквивалентны.

------------------------------------------------------------------------

# 66. DOCUMENTATION

Обновить релевантную documentation/report additive способом.

Не переписывать canonical history.

------------------------------------------------------------------------

# 67. REQUIRED REPORT FILE

Создать:

``` text
docs/prompts/PHASE_3_DECISION_QUEUE_ROUND_5_SIGNAL_DESTINATION_SEMANTIC_RECONCILIATION_REPORT.md
```

------------------------------------------------------------------------

# 68. GIT

После успешных gates:

``` text
commit
push origin/master
verify HEAD == origin/master
verify working tree
```

Не включать unrelated files в commit.

------------------------------------------------------------------------

# 69. ACCEPTANCE CRITERIA

VERDICT A только если ВСЕ выполнено:

1.  Full Decision Queue action inventory выполнен.
2.  Detector predicate documented для каждого action.
3.  Destination predicate documented для каждого action.
4.  Services Without Sales открывает detector-equivalent cohort.
5.  "Проверить доступность" открывает availability-equivalent cohort.
6.  Эти два Catalog action имеют независимые semantics.
7.  Upcoming Bookings открывает detector-equivalent cohort.
8.  Terminal/ineligible bookings не попадают ошибочно.
9.  Booking Confirmation Delay использует confirmation/SLA semantics, не
    service-date overdue.
10. Pending Refunds использует refund authority, не просто CANCELLED.
11. Cancelled unpaid orders без refund исключены.
12. Failed Payments использует payment failure authority, не UNPAID.
13. UNPAID orders без failed attempt исключены.
14. Recent Cancellations сохраняет detector time window.
15. Timezone/time-window semantics reconciled.
16. Cardinality differences explicitly reconciled where entities differ.
17. No false filtered-context claims.
18. Catalog pagination works.
19. Orders pagination works.
20. Bookings pagination works.
21. Default page size = 20.
22. Page size options = 20/50/100.
23. Filtered total visible.
24. Page navigation visible.
25. Filters persist across page changes.
26. URL/deep-link remains reproducible.
27. Invalid filter values return controlled 400, not 500.
28. RBAC/object scope preserved.
29. No cross-tenant/partner leakage.
30. Lifecycle Active/History/REOPEN regression passes.
31. Browser runtime evidence captured for every action.
32. Negative near-miss evidence captured.
33. Relevant backend/frontend tests pass.
34. TSC/build gates pass.
35. 404 = 0 for valid actions.
36. 500 = 0 for valid actions.
37. Semantic cohort mismatch = 0.
38. "Ожидают публикации" widget NOT implemented in this Round.
39. Booking Commercial Terms Foundation NOT implemented.
40. CRM Step 3.5 NOT started.
41. Report created.
42. Commit contains no unrelated files.
43. Pushed to origin/master.
44. HEAD == origin/master.

------------------------------------------------------------------------

# 70. VERDICT RULE

Вернуть:

## VERDICT A --- DECISION QUEUE SIGNAL → DESTINATION SEMANTICS FULLY RECONCILED / FILTERED DATASETS PROVEN / CATALOG-ORDERS-BOOKINGS PAGINATION COMPLETE

только если все hard gates доказаны.

Иначе:

## VERDICT B --- DECISION QUEUE SEMANTIC DATASET RECONCILIATION INCOMPLETE

------------------------------------------------------------------------

# 71. FINAL RESPONSE FORMAT

``` text
Verdict:

Signal/action inventory:
Services without sales:
Availability:
Upcoming bookings:
Booking confirmation delay:
Pending refunds:
Failed payments:
Recent cancellations:

Detector → destination parity:
Catalog:
Orders:
Bookings:
Finance:

Pagination:
Catalog:
Orders:
Bookings:

Negative evidence:
Runtime browser evidence:
Tests:
Security:
Documentation:
Git:

Remaining findings:
Next canonical stage:
```

------------------------------------------------------------------------

# 72. STOP

После verdict:

**STOP.**

Не запускать автоматически:

``` text
CRM Step 3.5
"Ожидают публикации" widget implementation
Booking Commercial Terms & Agreement Foundation
другой Phase 3 stage
```
