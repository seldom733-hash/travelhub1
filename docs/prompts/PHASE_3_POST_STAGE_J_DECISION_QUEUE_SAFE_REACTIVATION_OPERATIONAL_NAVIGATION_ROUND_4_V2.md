# PHASE 3 --- POST-STAGE-J

# DECISION QUEUE SAFE REACTIVATION + OPERATIONAL NAVIGATION REMEDIATION --- ROUND 4

## RESTORE TESTABLE ACTIVE SIGNALS SAFELY, THEN FIX 5 CONFIRMED RUNTIME ACTION DEFECTS

## CRM STEP 3.5 BLOCKED UNTIL FINAL BROWSER VERIFICATION

------------------------------------------------------------------------

## 1. ЯЗЫК

Все ответы разработчика, root-cause analysis, evidence, таблицы,
browser/network результаты, отчёт и финальный VERDICT --- **НА РУССКОМ
ЯЗЫКЕ**.

Technical identifiers, enum values, routes, query params, code, SQL,
commands, paths, SHA и commit messages можно оставлять в оригинале.

------------------------------------------------------------------------

## 2. CURRENT VERIFIED STATE

Data-integrity remediation завершён:

``` text
6 Decision Signals существуют в DB
status всех 6 = RESOLVED
Active = 0
History = 6
Data loss = NO
```

Root cause предыдущего исчезновения из History:

``` text
buildNeedsAttention() фильтровала только OPEN + ACKNOWLEDGED
```

Исправлено запросом всех lifecycle statuses.

Последний заявленный commit:

``` text
b6583b7
```

Authority --- фактический текущий HEAD.

------------------------------------------------------------------------

## 3. REAL BROWSER RUNTIME --- CURRENT DEFECTS

Несмотря на предыдущие отчёты, пользователь фактически наблюдает:

``` text
Открыть платежи
→ Internal server error

Открыть предстоящие
→ показывает около 100 бронирований,
  включая завершённые и исполняемые

Открыть услуги
→ Internal server error

Проверить доступность
→ Internal server error

Открыть возвраты
→ показывает смешанный общий список заказов:
  - Отменённый / не оплачено
  - Закрыт / возвращено
  - В работе / частично оплачено
  - Исполнен / оплачено
  - Закрыт / оплачено
  - Новый / не оплачено
  - Передан в Booking / не оплачено
  - Передан в Booking / оплачено
```

Следовательно:

``` text
Previous navigation closure claims = INVALIDATED BY REAL BROWSER RUNTIME
CRM Step 3.5 = BLOCKED
```

------------------------------------------------------------------------

# PHASE A --- SAFE SIGNAL REACTIVATION

## 4. ЦЕЛЬ PHASE A

Перед remediation navigation нужно снова получить тестируемые Active
Decision Signals.

Но запрещено слепо выполнять:

``` sql
UPDATE ... SET status = 'OPEN'
```

без проверки canonical lifecycle.

Нужно сначала определить, как архитектура проекта должна повторно
активировать ранее RESOLVED condition.

------------------------------------------------------------------------

## 5. NO BLIND DB MUTATION

До анализа запрещено:

``` text
manual RESOLVED → OPEN update
bulk status rewrite
delete/recreate records
truncate
reseed entire DB
reset DB
fake timestamps
erase lifecycle history
```

------------------------------------------------------------------------

## 6. DETERMINE CANONICAL REACTIVATION SEMANTICS

Проверить backend code и tests:

``` text
Есть ли REOPEN transition?
Есть ли re-observation?
Что происходит, если RESOLVED signal condition снова/всё ещё true?
Переоткрывается существующий signal?
Создаётся новый signal?
Остаётся RESOLVED?
Есть ли deduplication key?
Есть ли active uniqueness constraint?
Как сохраняется lifecycle history?
```

Вернуть exact code authority.

------------------------------------------------------------------------

## 7. CHECK UNDERLYING CONDITIONS FIRST

Для каждого из 6 signal types проверить текущую condition:

  --------------------------------------------------------------------------
  Signal                               Condition Evidence      Canonical
                                 currently true?               expected
                                                               state
  ---------------------------- ----------------- ------------- -------------
  SERVICES_WITHOUT_SALES                                       

  UPCOMING_BOOKINGS                                            

  PENDING_REFUNDS                                              

  FAILED_PAYMENTS                                              

  BOOKING_CONFIRMATION_DELAY                                   

  RECENT_CANCELLATIONS                                         
  --------------------------------------------------------------------------

Нельзя искусственно активировать signal, если его condition больше не
существует.

------------------------------------------------------------------------

## 8. SAFE REACTIVATION DECISION TREE

### Case A --- canonical REOPEN существует

Использовать только его.

### Case B --- detector re-observation переоткрывает RESOLVED

Запустить canonical detector/reconciliation path.

### Case C --- detector создаёт новый Active signal, сохраняя старый в History

Это допустимо, если именно так определена архитектура.

Ожидаемо:

``` text
History может остаться 6
Active может стать до 6 новых signals
```

### Case D --- architecture запрещает reactivation

Не делать manual DB rewrite.

Вернуть VERDICT C для Phase A и предложить минимальную lifecycle design
remediation.

------------------------------------------------------------------------

## 9. DO NOT REQUIRE HISTORY = 0

Цель НЕ состоит в том, чтобы любой ценой получить:

``` text
Active = 6
History = 0
```

Если canonical lifecycle сохраняет resolved records как immutable
history, корректный результат может быть:

``` text
Active = 6
History = 6
```

Это предпочтительнее уничтожения history.

------------------------------------------------------------------------

## 10. DEDUPLICATION

После reactivation:

``` text
не должно быть двух Active signals одного canonical identity
```

Проверить detector identity/deduplication.

------------------------------------------------------------------------

## 11. PHASE A RECONCILIATION

После безопасной reactivation:

  Layer                      Active   History
  ------------------------ -------- ---------
  DB canonical partition            
  API                               
  Browser                           

Каждый Active signal должен быть объясним current underlying condition.

------------------------------------------------------------------------

## 12. RELOAD

``` text
Browser reload
→ counts preserved
→ signals preserved
```

------------------------------------------------------------------------

## 13. PHASE A HARD GATE

Не переходить к Phase B, пока:

``` text
нет минимум representative Active signals,
не доказана canonical reactivation semantics,
нет duplicate active identities,
DB/API/UI reconciled.
```

Предпочтительно восстановить все 6 типов, если все 6 conditions всё ещё
true.

------------------------------------------------------------------------

# PHASE B --- OPERATIONAL NAVIGATION REMEDIATION

## 14. SCOPE

Исправить пять подтверждённых проблемных actions:

``` text
1. FAILED_PAYMENTS → Открыть платежи
2. PENDING_REFUNDS → Открыть возвраты
3. UPCOMING_BOOKINGS → Открыть предстоящие
4. SERVICES_WITHOUT_SALES → Открыть услуги
5. SERVICES_WITHOUT_SALES → Проверить доступность
```

Не начинать CRM.

------------------------------------------------------------------------

## 15. GENERAL RULE --- LABEL PROMISE

Каждый action должен приводить пользователя в context, соответствующий
его названию.

Недопустимо:

``` text
Открыть возвраты → generic Orders
Открыть платежи → generic unrelated Orders
Открыть предстоящие → all bookings
Проверить доступность → generic Catalog
```

только потому, что route существует и HTTP 200.

------------------------------------------------------------------------

# FAILED PAYMENTS

## 16. CAPTURE CURRENT 500

Реальным кликом:

``` text
Открыть платежи
```

снять:

``` text
final URL
page route
network request
API endpoint
query params
HTTP response
response body
backend exception/stack
```

До fix вернуть root cause.

------------------------------------------------------------------------

## 17. FIND REAL PAYMENT WORKFLOW

Проверить существующие:

``` text
Orders Center
Finance
Payments view/tab
Order details
paymentStatus filters
Payment entity/API
```

Найти минимальный существующий operational context, где пользователь
действительно может увидеть failed payments.

Не создавать новый Payments Center в этом prompt.

------------------------------------------------------------------------

## 18. FAILED PAYMENT SEMANTICS

Destination должен показать именно релевантный failed-payment
subset/context.

Доказать:

``` text
Decision Signal count
Destination filter
Destination count
Payment statuses/methods
```

Если точный count отличается из-за разных scopes --- объяснить
доказательно.

------------------------------------------------------------------------

# PENDING REFUNDS

## 19. CURRENT DEFECT

Сейчас `Открыть возвраты` показывает общий смешанный Orders list.

Это FAIL даже при HTTP 200.

------------------------------------------------------------------------

## 20. DEFINE PENDING REFUND AUTHORITY

Найти canonical predicate из:

``` text
PENDING_REFUNDS detector
refund request/status fields
Payment/refund model
Orders financial state
existing backend query
```

Вернуть exact predicate.

------------------------------------------------------------------------

## 21. REFUND DESTINATION

Destination должен показывать:

``` text
pending refund context
```

а не все Orders.

Если существующий Orders Center умеет canonical refund filter ---
использовать его.

Если существует Finance/refund view --- использовать его.

Если UI capability отсутствует --- не фабриковать поддержку; вернуть
bounded dependency/VERDICT C для action.

------------------------------------------------------------------------

## 22. REFUND RECONCILIATION

Вернуть:

``` text
Signal pending refund count:
Destination pending refund count:
Filter:
Statuses included:
Statuses excluded:
Amount if applicable:
```

------------------------------------------------------------------------

# UPCOMING BOOKINGS

## 23. CURRENT DEFECT

Сейчас:

``` text
Открыть предстоящие
→ ~100 bookings
→ completed + executing included
```

Это FAIL.

------------------------------------------------------------------------

## 24. DEFINE CANONICAL UPCOMING PREDICATE

Authority:

``` text
UPCOMING_BOOKINGS detector
```

Проследить exact date/status predicate.

Не придумывать отдельно для UI.

------------------------------------------------------------------------

## 25. SAME PREDICATE OR SHARED SEMANTICS

Destination filter должен соответствовать detector semantics.

По возможности использовать shared helper/query contract.

------------------------------------------------------------------------

## 26. PAGINATION WARNING

Если frontend получает первые N bookings и затем client-side фильтрует:

``` text
это не считается корректным,
если server pagination может скрывать qualifying records.
```

При server pagination upcoming predicate должен применяться на
server/query authority layer.

------------------------------------------------------------------------

## 27. UPCOMING RESULT

Browser destination должен содержать только qualifying records.

Вернуть:

``` text
Signal count:
Destination count:
Included statuses:
Excluded statuses:
Date boundary:
Past included = 0
Non-qualifying terminal included = 0
```

------------------------------------------------------------------------

# CATALOG --- OPEN SERVICES

## 28. CURRENT DEFECT

``` text
Открыть услуги
→ Internal server error
```

Снять actual 500 response + backend stack.

------------------------------------------------------------------------

## 29. CATALOG CANONICAL STATUSES --- IMPORTANT RUNTIME FACT

Пользователь подтвердил, что Catalog status filter содержит:

``` text
Все статусы
Черновик
Заполнен
Проверен
Опубликован
Архивирован
```

Следовательно:

``` text
status=ACTIVE
```

не является допустимым canonical assumption.

------------------------------------------------------------------------

## 30. FIND ACTUAL ENUM VALUES

Из frontend/backend code определить exact enum/value mapping:

  UI label      Canonical value
  ------------- -----------------
  Черновик      
  Заполнен      
  Проверен      
  Опубликован   
  Архивирован   

Не угадывать `PUBLISHED`, `ACTIVE` и т.д.

------------------------------------------------------------------------

## 31. SERVICES_WITHOUT_SALES BASE STATUS

Сам Decision Signal описывает:

``` text
опубликованные услуги без заказов
```

Поэтому destination должен использовать тот же canonical publication
status, что и detector.

------------------------------------------------------------------------

## 32. UNSOLD FILTER

Проверить, существует ли реальный Catalog/API filter для:

``` text
unsold
no sales
orders count = 0
```

Если существует --- использовать.

Если не существует, есть два допустимых варианта:

``` text
A. bounded implementation существующего Catalog filter
B. label "Открыть услуги" ведёт к canonical Published Catalog без ложного заявления о фильтрации
```

Но отчёт должен явно сказать, какой contract выбран.

------------------------------------------------------------------------

# CATALOG --- CHECK AVAILABILITY

## 33. CURRENT DEFECT

``` text
Проверить доступность
→ Internal server error
```

Снять actual 500 evidence.

------------------------------------------------------------------------

## 34. FIND REAL AVAILABILITY CAPABILITY

Проверить:

``` text
availability filter
availability status
calendar/slots
service availability settings
service edit workflow
backend availability API
```

------------------------------------------------------------------------

## 35. NO FAKE AVAILABILITY FILTER

Если:

``` text
availability=none
```

не поддерживается --- не оставлять его в URL только для вида.

------------------------------------------------------------------------

## 36. CHECK AVAILABILITY CONTRACT

`Проверить доступность` должен вести туда, где availability реально
можно проверить/исправить.

Если такого capability сейчас нет:

``` text
action must be disabled/removed
```

с документированной prerequisite.

Generic Published Catalog не считается PASS для label
`Проверить доступность`.

------------------------------------------------------------------------

# PHASE C --- LIFECYCLE UI VERIFICATION

## 37. ACTIVE SIGNAL BUTTONS

На восстановленных Active signals проверить:

``` text
Принять
Решить
Отклонить
```

только согласно canonical allowed transitions.

------------------------------------------------------------------------

## 38. HISTORY SIGNAL BUTTONS

На RESOLVED/terminal records в History запрещённые actions не должны
оставаться активными.

Не отправлять request для impossible transition.

------------------------------------------------------------------------

## 39. DO NOT CONSUME ALL ACTIVE SIGNALS

Browser verification не должна снова переводить все 6 business signals в
terminal status.

Для destructive lifecycle test использовать:

``` text
isolated deterministic test signal
```

или максимум один специально подготовленный fixture.

После теста сохранить testable runtime state.

------------------------------------------------------------------------

# PHASE D --- ALL 7 STAGE F ACTIONS

## 40. FULL INVENTORY

Проверить реальным кликом:

  Signal                       Action
  ---------------------------- -----------------------
  BOOKING_CONFIRMATION_DELAY   Открыть бронирования
  FAILED_PAYMENTS              Открыть платежи
  RECENT_CANCELLATIONS         Открыть заказы
  PENDING_REFUNDS              Открыть возвраты
  UPCOMING_BOOKINGS            Открыть предстоящие
  SERVICES_WITHOUT_SALES       Открыть услуги
  SERVICES_WITHOUT_SALES       Проверить доступность

------------------------------------------------------------------------

## 41. FINAL ACTION MATRIX

  --------------------------------------------------
  Signal Action Final HTTP Applied Result Semantic
  URL context/filter count PASS
  --------------------------------------------------

------------------------------------------------------------------------

Hard gates:

``` text
valid action 404 = 0
valid action 500 = 0
wrong-domain = 0
false filtered-context claims = 0
```

------------------------------------------------------------------------

# PHASE E --- SECURITY / QUERY / TESTS

## 42. QUERY TRACE

Для каждого filtered destination:

``` text
Action
→ URL
→ searchParams
→ normalized frontend filter
→ API query
→ backend DTO
→ DB predicate
→ rendered result
```

------------------------------------------------------------------------

## 43. INVALID QUERY VALUES

Проверить representative invalid values.

Acceptance:

``` text
no HTTP 500
controlled validation/fallback
no RBAC bypass
```

------------------------------------------------------------------------

## 44. RBAC / TENANT / WORKSPACE

Все destinations и lifecycle mutations должны сохранять:

``` text
RBAC
tenant scope
workspace scope
```

------------------------------------------------------------------------

## 45. TEST DB ISOLATION

Не использовать development runtime DB как disposable test database.

Доказать isolation для новых regression tests.

------------------------------------------------------------------------

## 46. AUTOMATED TESTS

Обязательно покрыть:

``` text
safe reactivation/re-observation semantics
deduplication
Active/History partition
FAILED_PAYMENTS destination
PENDING_REFUNDS destination
UPCOMING_BOOKINGS predicate
Catalog canonical published status
Open Services query
Check Availability behavior
invalid query values
RBAC/workspace
```

------------------------------------------------------------------------

## 47. BROWSER + NETWORK

Для всех 7 actions:

``` text
real click
Network checked
Console checked
destination inspected
filter/context visually verified
```

Не принимать unit tests как замену browser evidence.

------------------------------------------------------------------------

## 48. NO SCOPE CREEP

Не начинать:

``` text
CRM Step 3.5
new CRM work
new KPI work
new Decision Signals
new AI features
large Payments Center
large Availability subsystem
```

------------------------------------------------------------------------

------------------------------------------------------------------------

# PHASE F --- DESTINATION PAGE PARAMETER & FILTER CONTRACT RECONCILIATION

## 49. MANDATORY CROSS-PAGE PARAMETER AUDIT

Для **каждого** navigation action недостаточно доказать, что URL
существует и возвращает HTTP 200.

Нужно доказать полный contract:

``` text
Decision Queue action
→ target URL
→ query parameter
→ destination page supports parameter
→ allowed value exists
→ page initializes UI filter from URL
→ frontend sends corresponding API query
→ backend DTO accepts it
→ backend/service/DB actually applies predicate
→ rendered list corresponds to predicate
```

Если хотя бы одно звено отсутствует --- parameter/action не считается
working.

------------------------------------------------------------------------

## 50. PAGES IN MANDATORY AUDIT

Проверить минимум все destination domains Stage F:

``` text
Catalog
Orders
Bookings
и любую другую страницу/центр, куда фактически ведёт Stage F action
```

Если remediation перенаправляет action в Finance/Payments/другой
существующий page, этот page автоматически включается в audit.

------------------------------------------------------------------------

## 51. PARAMETER INVENTORY PER PAGE

Для каждой destination page сначала построить фактический inventory
поддерживаемых фильтров.

Формат:

  -----------------------------------------------------------------------------
  Page       UI filter  URL param  Allowed    Default    API field  Backend
                                   values                           authority
  ---------- ---------- ---------- ---------- ---------- ---------- -----------
  Catalog                                                           

  Orders                                                            

  Bookings                                                          
  -----------------------------------------------------------------------------

Не ограничиваться параметрами, которые сейчас использует Decision Queue.

Нужно увидеть **реальный существующий filter contract страницы**.

------------------------------------------------------------------------

## 52. CATALOG --- FULL FILTER CONTRACT

Для Catalog определить минимум:

``` text
status
availability — существует ли?
unsold/no-sales — существует ли?
category — если релевантно
other existing filters used by target workflow
```

Особенно сверить status lifecycle.

Из реального UI известно:

``` text
Все статусы
Черновик
Заполнен
Проверен
Опубликован
Архивирован
```

Вернуть exact mapping:

  Catalog UI label   URL/API value   Backend enum/value     Supported?
  ------------------ --------------- -------------------- ------------
  Все статусы                                             
  Черновик                                                
  Заполнен                                                
  Проверен                                                
  Опубликован                                             
  Архивирован                                             

`ACTIVE` нельзя использовать как generic substitute, если его нет в
canonical Catalog lifecycle.

------------------------------------------------------------------------

## 53. CATALOG --- URL → UI STATE

Для каждого поддерживаемого Catalog param проверить direct navigation:

``` text
/app/catalog?<param>=<value>
```

После загрузки страницы соответствующий UI filter должен визуально
отражать параметр.

Недопустимо:

``` text
URL содержит status=PUBLISHED
UI показывает "Все статусы"
```

если список при этом якобы считается filtered.

------------------------------------------------------------------------

## 54. CATALOG --- UI STATE → DATA

После URL initialization доказать:

``` text
selected UI filter
→ API request
→ backend predicate
→ correct records
```

------------------------------------------------------------------------

## 55. CATALOG --- UNSUPPORTED PARAM

Если:

``` text
unsold=true
```

не существует в UI/API/backend contract:

``` text
Supported = NO
```

Нельзя оставлять его как декоративный query param.

Либо реализовать bounded canonical filter end-to-end, либо изменить
action contract честно.

------------------------------------------------------------------------

## 56. CATALOG --- AVAILABILITY PARAM

Аналогично для:

``` text
availability=none
```

Проверить:

``` text
UI filter exists?
allowed values?
API DTO?
backend predicate?
availability data authority?
```

Если capability отсутствует, `Проверить доступность` не может считаться
PASS через такой URL.

------------------------------------------------------------------------

## 57. ORDERS --- FULL FILTER CONTRACT

Для Orders определить реальные фильтры, включая минимум те dimensions,
которые могут использовать Stage F actions:

``` text
order status
payment status
refund status/state
date/range if applicable
other actual filters
```

Вернуть:

  --------------------------------------------------------------------------
  Orders UI   URL param   Allowed     API field   Backend         Supported?
  filter                  values                  predicate   
  ----------- ----------- ----------- ----------- ----------- --------------

  --------------------------------------------------------------------------

------------------------------------------------------------------------

## 58. ORDERS --- STATUS VS PAYMENT STATUS

Не смешивать:

``` text
Order.status
Payment.status
Refund.status
```

Например:

``` text
Отменённый
Новый
В работе
Исполнен
Закрыт
Передан в Booking
```

--- это может быть lifecycle заказа, тогда как:

``` text
не оплачено
частично оплачено
оплачено
возвращено
```

--- отдельная payment/refund dimension.

Action `Открыть платежи` не должен фильтровать только `Order.status`,
если signal основан на Payment failures.

------------------------------------------------------------------------

## 59. ORDERS --- FAILED PAYMENTS CONTRACT

Для `FAILED_PAYMENTS → Открыть платежи` доказать exact mapping:

``` text
Signal detector predicate
→ destination param(s)
→ UI filter(s)
→ API predicate
→ Payment records/orders represented
```

Если Orders page не поддерживает failed-payment filter, нельзя
притворяться, что generic Orders list является корректным destination.

------------------------------------------------------------------------

## 60. ORDERS --- PENDING REFUNDS CONTRACT

Для `PENDING_REFUNDS → Открыть возвраты` доказать:

``` text
pending refund authority
→ exact URL param
→ page-supported filter
→ API/backend predicate
→ only relevant refund context
```

Смешанный список всех типов Orders --- FAIL.

------------------------------------------------------------------------

## 61. BOOKINGS --- FULL FILTER CONTRACT

Для Bookings определить:

``` text
booking status
upcoming
date/start date
confirmation status if separate
other existing filters
```

Вернуть:

  --------------------------------------------------------------------------
  Bookings UI URL param   Allowed     API field   Backend         Supported?
  filter                  values                  predicate   
  ----------- ----------- ----------- ----------- ----------- --------------

  --------------------------------------------------------------------------

------------------------------------------------------------------------

## 62. BOOKINGS --- UPCOMING PARAM

Если используется:

``` text
upcoming=true
```

доказать, что:

``` text
parameter реально поддерживается
page читает его
UI показывает active upcoming context
API/server применяет canonical predicate
pagination не ломает выборку
```

Если `upcoming` существует только как frontend post-filter первых N
записей --- это FAIL при server pagination/limit.

------------------------------------------------------------------------

## 63. BOOKINGS --- STATUS INTERACTION

Проверить interaction:

``` text
upcoming=true + status=<...>
```

если такая комбинация возможна.

Определить:

``` text
AND semantics?
override?
conflict?
```

Никаких скрытых противоречий.

------------------------------------------------------------------------

## 64. BOOKING CONFIRMATION DELAY

Для `Открыть бронирования` определить, используется ли filtered context.

Если action contract --- просто открыть Booking Center:

``` text
generic page допустим
```

Если URL передаёт status/query --- каждый параметр должен пройти тот же
audit.

------------------------------------------------------------------------

## 65. OTHER DESTINATION PAGES

Если action ведёт не в Catalog/Orders/Bookings, а например:

``` text
Finance
Payments
Refunds
Service details
Availability workflow
```

создать для него такой же parameter inventory и audit.

------------------------------------------------------------------------

## 66. UNKNOWN PARAMETER BEHAVIOR

Для каждой destination page проверить representative unknown param:

``` text
?unknownFilter=value
```

и invalid value для known param:

``` text
?status=NOT_A_REAL_STATUS
```

Ожидается controlled behavior:

``` text
ignore safely
или canonical 400
или safe fallback
```

но:

``` text
HTTP 500 = FAIL
```

------------------------------------------------------------------------

## 67. PARAMETER PRESENCE ≠ PARAMETER SUPPORT

Критическое правило:

``` text
query param виден в address bar
```

НЕ является evidence, что filter работает.

PASS только если доказана цепочка:

``` text
URL
→ UI state
→ API/backend predicate
→ resulting dataset
```

------------------------------------------------------------------------

## 68. UI FILTER PRESENCE ≠ BACKEND SUPPORT

Аналогично наличие dropdown/chip в UI не является достаточным evidence.

Нужно проверить реальный API request и backend predicate.

------------------------------------------------------------------------

## 69. BACKEND SUPPORT ≠ UI SUPPORT

Если backend умеет параметр, но destination page не читает его из URL:

Decision Queue deep-link всё равно не работает end-to-end.

Нужно reconciliate URL initialization.

------------------------------------------------------------------------

## 70. FILTER VALUE LOCALIZATION

UI labels RU/AZ/EN не должны использоваться как backend enum values,
если architecture разделяет label и canonical code.

Например conceptually:

``` text
UI: Опубликован
canonical code: <actual enum from code>
```

Использовать canonical code в URL/API и локализованный label в UI.

------------------------------------------------------------------------

## 71. MULTI-FILTER COMPOSITION

Если Stage F action требует несколько dimensions:

``` text
status + paymentStatus
status + refundStatus
publication status + availability
```

проверить их composition.

Вернуть:

``` text
AND / OR semantics
precedence
conflicts
```

------------------------------------------------------------------------

## 72. EMPTY RESULT

Корректно поддерживаемый filter с 0 results:

``` text
0 records
```

является допустимым результатом.

Нельзя fallback'ить на unfiltered list только потому, что filtered
result пуст.

------------------------------------------------------------------------

## 73. RESULT COUNT RECONCILIATION

Для signal-based filtered actions сравнить:

``` text
Decision Signal evidence count
Destination filtered count
```

Если counts различаются, объяснить:

``` text
time window
entity scope
deduplication
pagination
workspace
other canonical reason
```

Не игнорировать расхождение.

------------------------------------------------------------------------

## 74. REQUIRED PARAMETER CONTRACT MATRIX

В финальный отчёт обязательно включить:

  --------------------------------------------------------------------------------------------------------
  Page   Param     Supported? Allowed   UI filter           URL         API      Backend   Invalid    PASS
                              values      exists?   initializes   consumes?   predicate?     value 
                                                            UI?                              safe? 
  ------ ------- ------------ --------- --------- ------------- ----------- ------------ --------- -------

  --------------------------------------------------------------------------------------------------------

Проверить все параметры, используемые 7 Stage F actions.

------------------------------------------------------------------------

## 75. REQUIRED ACTION → PARAM MATRIX

  ------------------------------------------------------------------------------
  Action         Target     Params       Every param    Correct UI       Correct
                 page                     supported?      context?      dataset?
  -------------- ---------- ---------- ------------- ------------- -------------
  Открыть                                                          
  бронирования                                                     

  Открыть                                                          
  платежи                                                          

  Открыть заказы                                                   

  Открыть                                                          
  возвраты                                                         

  Открыть                                                          
  предстоящие                                                      

  Открыть услуги                                                   

  Проверить                                                        
  доступность                                                      
  ------------------------------------------------------------------------------

------------------------------------------------------------------------

## 76. PARAMETER CONTRACT TESTS

Добавить regression tests минимум для:

``` text
Catalog canonical statuses
Catalog URL → UI filter initialization
Orders status/payment/refund dimensions
Orders URL → UI filter initialization
Bookings upcoming
Bookings URL → UI filter initialization
invalid known values
unknown params
multi-filter composition where used
```

------------------------------------------------------------------------

## 77. BROWSER PARAMETER VERIFICATION

В browser evidence для каждого action показать:

``` text
clicked action
final URL
visible active filter/chip/dropdown
network API request
resulting records
```

------------------------------------------------------------------------

## 78. NEW HARD GATES

Дополнить VERDICT A hard gates:

``` text
Every Stage F query param has a real destination-page consumer.
Every used param has documented allowed values.
Every deep-link initializes the destination UI state.
Every relevant UI filter reaches API/backend authority.
No decorative/dead query params.
No unsupported enum values.
No generic fallback list masquerading as filtered result.
Catalog/Orders/Bookings filter contracts reconciled.
Invalid values never produce HTTP 500.
```

------------------------------------------------------------------------

## 79. REPORT ADDITION

В Round 4 report добавить отдельный раздел:

``` text
DESTINATION PAGE PARAMETER & FILTER CONTRACT RECONCILIATION
```

с:

``` text
Catalog filter inventory
Orders filter inventory
Bookings filter inventory
Other destination inventories
Parameter Contract Matrix
Action → Param Matrix
Browser evidence
API/backend evidence
Unsupported/deferred capabilities
```

------------------------------------------------------------------------

## 80. FINAL VERDICT ADDITION

`VERDICT A` запрещён, если хотя бы один Stage F action:

``` text
использует unsupported query param
использует invalid enum value
не инициализирует UI filter
не применяет backend predicate
показывает unfiltered dataset вместо promised context
даёт HTTP 500 на valid/invalid filter path
```

# REPORT

## 49. REPORT FILE

Создать:

``` text
docs/prompts/PHASE_3_POST_STAGE_J_DECISION_QUEUE_SAFE_REACTIVATION_OPERATIONAL_NAVIGATION_ROUND_4_REPORT.md
```

------------------------------------------------------------------------

## 50. REQUIRED DELIVERABLE --- REACTIVATION

``` text
Canonical reactivation mechanism:
Underlying conditions:
Old RESOLVED records preserved:
New/reopened Active records:
Deduplication:
DB Active/History:
API Active/History:
Browser Active/History:
Reload:
```

------------------------------------------------------------------------

## 51. REQUIRED DELIVERABLE --- FIVE DEFECTS

Для каждого:

``` text
Before:
Root cause:
Authority:
Fix:
Final URL:
Final query:
HTTP:
Dataset/context:
Browser evidence:
Network evidence:
```

Actions:

``` text
Open Payments
Open Refunds
Open Upcoming
Open Services
Check Availability
```

------------------------------------------------------------------------

## 52. REQUIRED DELIVERABLE --- CATALOG ENUM

Вернуть exact mapping:

  UI status     Code/API enum
  ------------- ---------------
  Черновик      
  Заполнен      
  Проверен      
  Опубликован   
  Архивирован   

И отдельно:

``` text
SERVICES_WITHOUT_SALES canonical catalog status:
```

------------------------------------------------------------------------

## 53. REQUIRED DELIVERABLE --- ALL 7 ACTIONS

Полная matrix из §41.

------------------------------------------------------------------------

## 54. REQUIRED DELIVERABLE --- TESTS

``` text
Backend:
Frontend:
Decision Queue:
Reactivation:
Deduplication:
Payments:
Refunds:
Upcoming:
Catalog:
Availability:
RBAC:
Workspace:
TSC backend:
TSC frontend:
Build backend:
Build frontend:
Browser:
Network:
Console:
```

------------------------------------------------------------------------

## 55. REQUIRED DELIVERABLE --- GIT

``` text
Starting HEAD:
Final HEAD:
origin/master:
Files changed:
Migrations:
Commit(s):
Pushed:
HEAD == origin/master:
Working tree clean:
```

------------------------------------------------------------------------

# ACCEPTANCE

## 56. VERDICT A HARD GATES

VERDICT A разрешён только если одновременно:

1.  Canonical signal reactivation/re-observation semantics доказана.
2.  Нет blind DB status rewrite.
3.  Old History records не уничтожены без canonical reason.
4.  Underlying conditions проверены.
5.  Active signals восстановлены canonical способом там, где condition
    true.
6.  Duplicate Active identities = 0.
7.  DB/API/Browser Active/History reconciled.
8.  Reload preserves state.
9.  `Открыть платежи` --- без 500 и payment context корректен.
10. `Открыть возвраты` --- не generic mixed Orders list, а
    pending-refund context.
11. `Открыть предстоящие` --- только canonical upcoming dataset.
12. `Открыть услуги` --- без 500 и использует canonical Catalog
    publication status.
13. Catalog enum mapping доказан из code.
14. `status=ACTIVE` не используется как недоказанная Catalog assumption.
15. `Проверить доступность` --- реальный availability context либо
    action честно disabled/removed с dependency.
16. Unsupported query params не маскируются как working.
17. Все 7 Stage F actions проверены реальным кликом.
18. Valid-action HTTP 500 = 0.
19. Valid-action 404 = 0.
20. Wrong-domain = 0.
21. False filtered-context claims = 0.
22. Lifecycle UI eligibility соответствует backend transitions.
23. Terminal History signals не предлагают forbidden active actions.
24. Browser tests не потребили все business Active signals.
25. RBAC PASS.
26. Tenant/workspace isolation PASS.
27. Invalid query handling PASS.
28. Test DB isolation PASS.
29. Backend regression green.
30. Frontend regression green.
31. TSC clean.
32. Builds clean.
33. Browser console clean.
34. Report delivered.
35. Commit(s) pushed.
36. HEAD == origin/master.
37. Working tree clean except explicitly documented unrelated state.
38. CRM Step 3.5 NOT started.
39. Destination Page Parameter & Filter Contract Matrix complete.
40. Every Stage F query param has a real page/API/backend consumer.
41. Catalog/Orders/Bookings canonical filter inventories reconciled.
42. Dead/decorative query params = 0.
43. Unsupported enum values in Stage F links = 0.

------------------------------------------------------------------------

# FINAL VERDICT

## 57. RETURN EXACTLY ONE

### VERDICT A --- DECISION QUEUE SAFE REACTIVATION & OPERATIONAL NAVIGATION RECONCILED / ACTIVE SIGNALS RESTORED CANONICALLY / ALL 7 STAGE F ACTIONS VERIFIED / CRM STEP 3.5 READY

или:

### VERDICT B --- DECISION QUEUE ROUND 4 INCOMPLETE / RUNTIME DEFECTS REMAIN

Обязательно разделить:

``` text
Reactivation:
Active/History:
Deduplication:
Lifecycle eligibility:
Open Payments:
Open Refunds:
Open Upcoming:
Open Services:
Check Availability:
Catalog canonical status:
All 7 actions:
RBAC:
Isolation:
Tests:
Browser:
Network:
Git:
```

или:

### VERDICT C --- REQUIRED OPERATIONAL CAPABILITY OR CANONICAL REACTIVATION PATH DOES NOT EXIST

Обязательно указать:

``` text
Missing capability:
Affected signal/action:
Why it cannot be safely fabricated:
Current safe behavior:
Required prerequisite:
Recommended next step:
```

------------------------------------------------------------------------

# 58. STOP

После VERDICT:

**STOP.**

Не запускать CRM Step 3.5 автоматически.
