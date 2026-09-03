# PHASE 3 --- STEP 3.5.3 --- PLATFORM CRM

## CRM COMMUNICATIONS + ACTIVITY TIMELINE

## ROUND 2C.2 --- COMMERCIAL CROSS-VIEW CONSISTENCY CLOSURE

### ORDERS + BOOKINGS + PAYMENTS + REFUNDS / SUBJECT INTEGRITY + SOURCE RECONCILIATION + RUNTIME EVIDENCE

**Финальный отчёт и ответы разработчика --- строго на русском.**

------------------------------------------------------------------------

# 1. ЦЕЛЬ

После закрытия Round 2C.1 выполнить **точечную проверку целостности
коммерческих данных Customer 360 ↔ CrmActivity**.

Проверяем четыре canonical commercial domains:

``` text
Orders
Bookings
Payments
Refunds
```

Главная задача --- доказать, что Activity конкретного Customer:

-   не теряет ожидаемые коммерческие события;
-   не получает события другого Customer;
-   использует правильный `sourceId`;
-   использует правильный `customerId`;
-   сохраняет canonical relationships;
-   использует правильный business timestamp;
-   показывает те же business objects, которые доступны в
    соответствующих Customer 360 tabs/API.

Это **не новый redesign Activity** и не Round 2D.

------------------------------------------------------------------------

# 2. OBSERVED RUNTIME FINDING

На runtime был замечен потенциальный P1 consistency defect.

Для одного Customer:

``` text
Activity:
PAY-00007001
```

при этом Payments tab показывал:

``` text
PAY-00000557
PAY-00000616
```

Это требует deterministic reconciliation.

Нельзя считать `PAYMENT projected > 0` доказательством корректности
subject attribution.

------------------------------------------------------------------------

# 3. SCOPE

Обязательный scope:

``` text
ORDER
BOOKING
PAYMENT
REFUND
```

Проверяем цепочку:

``` text
Customer
→ canonical Customer 360 domain tab/API
→ canonical entity row
→ CrmActivity row
→ Customer Activity API
→ Customer 360 Activity UI
```

Для каждой domain должны быть доказаны:

``` text
missing expected activity events = 0
wrong-customer activity events = 0
orphan activity events = 0
wrong sourceId mappings = 0
```

------------------------------------------------------------------------

# 4. REPOSITORY-FIRST

Перед изменениями:

``` bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -120
git diff
git diff --check
```

Known Round 2C.1 closure SHA:

``` text
d480cfb
```

Проверить reachable и actual current HEAD.

Не reset/revert legitimate newer work.

Зафиксировать:

``` text
Repository:
Branch:
Starting HEAD:
origin/master:
Worktree:
d480cfb reachable:
```

------------------------------------------------------------------------

# 5. IMPORTANT --- COUNTS ARE NOT ENOUGH

Запрещено доказывать consistency только так:

``` text
Orders tab = X rows
ORDER Activity = X rows
```

Одна business entity потенциально может создавать несколько lifecycle
events.

Нужно сравнивать:

``` text
canonical entity
→ canonical projection rules
→ expected event set
→ actual CrmActivity event set
```

Для каждого расхождения должна быть объяснена semantic reason.

------------------------------------------------------------------------

# 6. SELECT REPRESENTATIVE CUSTOMERS

Выбрать минимум:

### Customer A --- основной reconciliation subject

Должен иметь максимально полный набор:

``` text
Orders > 0
Bookings > 0
Payments > 0
Refunds > 0, если в dataset существует такой Customer
```

### Customer B --- isolation control

Другой Customer с собственными commercial records.

Использовать Customer B для доказательства отсутствия cross-customer
leakage.

Если одного Customer со всеми четырьмя domain нет --- использовать
минимальное количество Customers, необходимое для покрытия всех четырёх
source types.

Зафиксировать IDs/codes.

------------------------------------------------------------------------

# 7. ORDER RECONCILIATION

Для выбранного Customer получить canonical Orders из того же backend
contract/source, который использует Customer 360 Orders tab.

Для каждого relevant Order зафиксировать минимум:

``` text
order.id
order.code
order.customerId
order.sellerPartnerId
order.status
order.createdAt
```

Затем найти соответствующие `CrmActivity` rows:

``` text
sourceType = ORDER
sourceId = exact order.id
customerId = exact customer.id
```

Проверить:

``` text
correct eventType
correct subjectType/subjectId
correct customerId
correct partner attribution where applicable
correct occurredAt
correct source reference/link
```

Canonical creation timestamp:

``` text
ORDER_CREATED → Order.createdAt
```

если repository contract не определяет иной timestamp.

------------------------------------------------------------------------

# 8. BOOKING RECONCILIATION

Для Customer получить canonical Bookings.

Для каждого relevant Booking:

``` text
booking.id
booking.code
booking.orderId
booking.status
booking.createdAt
```

Через canonical Order lookup доказать Customer ownership:

``` text
Booking.orderId
→ Order.id
→ Order.customerId
→ Customer.id
```

Проверить Activity:

``` text
sourceType = BOOKING
sourceId = exact booking.id
customerId = exact customer.id
```

Проверить `occurredAt` против canonical Booking timestamp/event
semantics.

Никаких предположений о Prisma `Booking.order` relation, если schema её
не содержит.

------------------------------------------------------------------------

# 9. PAYMENT RECONCILIATION --- P1

Это обязательный targeted finding.

Для Customer с observed mismatch получить canonical Payments, включая
минимум:

``` text
payment.id
payment.code/display code
payment.customerId if canonical field exists
payment.orderId
payment.status
payment.amount
payment.currency
payment.createdAt
payment.paidAt
```

Особенно проверить:

``` text
PAY-00007001
PAY-00000557
PAY-00000616
```

если эти codes всё ещё существуют в текущем runtime dataset.

Определить:

1.  какому Customer принадлежит `PAY-00007001`;
2.  какому Order он принадлежит;
3.  почему он появился в Activity наблюдаемого Customer;
4.  почему `PAY-00000557` и `PAY-00000616` были/не были представлены;
5.  является ли mismatch projection defect, stale backfill, display-code
    defect, API-filter defect или legitimate semantic difference.

Для каждого expected Payment event:

``` text
CrmActivity.sourceType = PAYMENT
CrmActivity.sourceId = exact payment.id
CrmActivity.customerId = exact canonical Customer
```

Для captured payment canonical timestamp проверить:

``` text
occurredAt ↔ paidAt
```

согласно текущему event contract.

------------------------------------------------------------------------

# 10. PAYMENT DISPLAY CODE AUTHORITY

Отдельно проверить, что Activity показывает **код того же Payment**, на
который указывает `sourceId`.

Запрещён сценарий:

``` text
sourceId = Payment A
display code/title metadata = Payment B
```

Проверить происхождение visible `PAY-...`:

``` text
canonical Payment.code?
metadata?
adapter-generated reference?
frontend lookup?
```

Visible code должен соответствовать canonical entity, связанной с
`CrmActivity.sourceId`.

------------------------------------------------------------------------

# 11. REFUND RECONCILIATION

Для Customer получить canonical Refunds.

Зафиксировать:

``` text
refund.id
refund.code if exists
refund.paymentId
refund.orderId if canonical field exists
refund.status
refund.amount
refund.currency
refund.createdAt
refund.processedAt
```

Восстановить canonical ownership path согласно actual schema:

``` text
Refund
→ Payment and/or Order
→ Customer
```

Не придумывать Prisma relations, которых нет.

Для expected Refund activity:

``` text
sourceType = REFUND
sourceId = exact refund.id
customerId = exact customer.id
```

Если событие означает processed refund:

``` text
occurredAt ↔ processedAt
```

Не подменять его `createdAt`, если canonical event semantics --- именно
processing/completion.

------------------------------------------------------------------------

# 12. CROSS-CUSTOMER ISOLATION

Для Customer A и Customer B выполнить двустороннюю проверку:

``` text
A Activity must not contain B commercial sources
B Activity must not contain A commercial sources
```

Минимум по:

``` text
ORDER
BOOKING
PAYMENT
REFUND
```

Сформировать intersection:

``` text
Customer A canonical source IDs
∩
Customer B Activity source IDs
= 0
```

и наоборот.

------------------------------------------------------------------------

# 13. ORPHAN ACTIVITY DETECTION

Для commercial Activity rows проверить:

``` text
sourceType=ORDER   → source entity exists
sourceType=BOOKING → source entity exists
sourceType=PAYMENT → source entity exists
sourceType=REFUND  → source entity exists
```

Acceptance:

``` text
orphan commercial activity rows = 0
```

Если source entity legitimately deleted/anonymized по отдельному
contract --- документировать, не угадывать.

------------------------------------------------------------------------

# 14. WRONG-SUBJECT DETECTION

Выполнить DB/service-level audit commercial `CrmActivity` rows:

``` text
activity.customerId
vs
canonical customer derived from source entity
```

Получить:

``` text
ORDER wrong-customer count
BOOKING wrong-customer count
PAYMENT wrong-customer count
REFUND wrong-customer count
```

Acceptance:

``` text
all = 0
```

------------------------------------------------------------------------

# 15. MISSING EXPECTED EVENT DETECTION

Для каждой canonical entity применить actual projection rules и
вычислить expected event(s).

Сравнить с `CrmActivity`.

Report:

  ----------------------------------------------------------------------------
  Source      Canonical   Expected     Actual    Missing      Wrong    Orphans
               entities     events   matching              customer 
                                       events                       
  --------- ----------- ---------- ---------- ---------- ---------- ----------
  ORDER                                                             

  BOOKING                                                           

  PAYMENT                                                           

  REFUND                                                            
  ----------------------------------------------------------------------------

No blank applicable cells.

------------------------------------------------------------------------

# 16. DUPLICATE DETECTION

Проверить DB unique/dedupe semantics и actual dataset.

Для canonical dedupe key:

``` text
duplicate commercial activity rows = 0
```

Не считать legitimate multiple lifecycle events одной entity
дубликатами, если `eventType` различается и contract это допускает.

------------------------------------------------------------------------

# 17. BACKFILL VS LIVE PROJECTION

Для каждого mismatch определить origin:

``` text
historical backfill
live projection
both
```

Если historical rows были созданы старым broken adapter, выполнить
controlled reconciliation/rebuild после fix.

Если live projection создаёт неправильный subject --- исправить
producer/projector, а не только rebuild historical data.

Новые события не должны требовать manual full rebuild.

------------------------------------------------------------------------

# 18. ADAPTER SCHEMA AUTHORITY

Сохранить Round 2C.1 fixes:

``` text
Order.sellerPartnerId = canonical existing field
OrderItem.product relation absent
Booking/Payment/Refund cross-schema Order relation absent
batch findMany lookup required where appropriate
```

Не возвращать invalid Prisma includes.

------------------------------------------------------------------------

# 19. N+1 PROHIBITION

Любой remediation cross-schema mapping должен сохранять batch lookup.

Проверить:

``` text
source batch
→ unique foreign IDs
→ findMany
→ Map
→ projection
```

Не исправлять consistency ценой N+1.

------------------------------------------------------------------------

# 20. API RECONCILIATION

Для Customer A выполнить Activity API queries:

``` text
sourceType=ORDER
sourceType=BOOKING
sourceType=PAYMENT
sourceType=REFUND
```

Сверить каждый returned item с canonical source.

Для каждого item:

``` text
activity.id
sourceType
sourceId
eventType
customerId/subject
occurredAt
visible/reference code
```

------------------------------------------------------------------------

# 21. UI RECONCILIATION

Customer 360:

``` text
Orders tab   ↔ ORDER Activity
Bookings tab ↔ BOOKING Activity
Payments tab ↔ PAYMENT Activity
Refunds tab  ↔ REFUND Activity
```

Проверить browser на реальных данных.

Для минимум одной entity каждого доступного type доказать:

``` text
tab row
→ exact canonical ID/code
→ exact Activity item
→ correct link/reference
```

------------------------------------------------------------------------

# 22. STATUS SEMANTICS

Не предполагать, что любая строка tab обязана давать один `*_CREATED`
event.

Audit actual event contract.

Например Payment:

``` text
CREATED?
AUTHORIZED?
CAPTURED?
FAILED?
```

Refund:

``` text
REQUESTED?
APPROVED?
PROCESSED?
REJECTED?
```

Report какие eventTypes реально canonical для current implementation.

Не добавлять новые lifecycle event types без архитектурной необходимости
только ради count equality.

------------------------------------------------------------------------

# 23. TIMESTAMP SEMANTICS

Сформировать matrix:

  Event type        Canonical timestamp field   Verified
  ----------------- --------------------------- ----------
  ORDER_CREATED                                 
  BOOKING_CREATED                               
  PAYMENT\_\*                                   
  REFUND\_\*                                    

Проверить timezone handling и сохранение ordering semantics.

------------------------------------------------------------------------

# 24. LINKS

Для visible commercial Activity references проверить:

``` text
ORDER → correct Order detail
BOOKING → correct Booking detail
PAYMENT → existing canonical Payment destination if supported
REFUND → existing canonical Refund destination if supported
```

Не создавать новые detail pages только ради этого round.

Если entity не имеет detail route --- не делать fake link.

------------------------------------------------------------------------

# 25. I18N REGRESSION

Round 2C.1 уже заявил:

``` text
mixed locale = 0
raw enums = 0
raw keys = 0
```

Commercial consistency fix не должен это регрессировать.

Проверить минимум RU/EN/AZ для одного populated commercial set.

------------------------------------------------------------------------

# 26. HISTORY REGRESSION

History tab после Round 2C.1 удалён как duplicate timeline.

Не возвращать его.

Activity остаётся canonical Customer timeline.

------------------------------------------------------------------------

# 27. BACKFILL HARDENING REGRESSION

Не регрессировать `isRebuilding` / 409 или финальный operational
mechanism Round 2C.1.

Если consistency remediation требует rebuild:

``` text
controlled invocation
0 errors
no concurrent second rebuild
```

------------------------------------------------------------------------

# 28. OPERATIONAL NOTES REGRESSION

Не ломать live projection Notes → Activity и Notes RBAC.

------------------------------------------------------------------------

# 29. TESTS --- BACKEND

Добавить focused tests, которые реально ловят этот класс дефекта:

1.  ORDER source → correct Customer.
2.  BOOKING → Order → correct Customer.
3.  PAYMENT → correct Customer + exact sourceId.
4.  REFUND → Payment/Order → correct Customer.
5.  Payment visible code corresponds to exact source entity.
6.  Cross-customer isolation.
7.  Missing expected event detection/reconciliation logic where
    testable.
8.  No invalid Prisma relation include.
9.  Batched lookup behavior.
10. Historical rebuild produces correct commercial subjects.
11. Live projection produces same subject semantics.

------------------------------------------------------------------------

# 30. TESTS --- E2E

Минимум:

``` text
Customer A ORDER activity
Customer A BOOKING activity
Customer A PAYMENT activity
Customer A REFUND activity if dataset/fixture supports
Customer B isolation
source filters
exact sourceId matching
```

Нужен deterministic fixture/controlled data, а не случайный
production-like row без assertions.

------------------------------------------------------------------------

# 31. FRONTEND TESTS

Если frontend изменяется:

-   exact visible code/reference from Activity item;
-   commercial source labels;
-   no mixed locale;
-   correct link target;
-   no duplicate secondary presentation.

Если frontend root cause отсутствует --- не менять его ради изменения
file count.

------------------------------------------------------------------------

# 32. BUILD / REGRESSION GATES

Запустить:

``` text
Backend TSC
Backend build
CRM Activity unit tests
CRM Activity RBAC E2E
new commercial consistency tests
Frontend TSC
Frontend build
Frontend tests
Operational Notes relevant tests
```

Historical frontend baseline:

``` text
243/243
```

Report actual final counts.

------------------------------------------------------------------------

# 33. REQUIRED CUSTOMER A MATRIX

  -------------------------------------------------------------------------------------------------
  Domain    Tab         Canonical   Activity   Activity     Customer   Timestamp        UI Result
            canonical   ID          code       sourceId        match       match   visible 
            code                                                                           
  --------- ----------- ----------- ---------- ---------- ---------- ----------- --------- --------
  Order                                                                                    

  Booking                                                                                  

  Payment                                                                                  

  Refund                                                                                   
  -------------------------------------------------------------------------------------------------

Если domain отсутствует у Customer A, использовать Customer C и явно
указать.

------------------------------------------------------------------------

# 34. PAYMENT FINDING MATRIX

Обязательно заполнить:

  -------------------------------------------------------------------------------------
  Payment code   Canonical   Canonical   Activity       Activity  Expected in Final
                 Customer    Order       Customer       sourceId     observed result
                                                        correct?    Customer? 
  -------------- ----------- ----------- ---------- ------------ ------------ ---------
  PAY-00007001                                                                

  PAY-00000557                                                                

  PAY-00000616                                                                
  -------------------------------------------------------------------------------------

Если codes отсутствуют после legitimate dataset reset/reseed --- указать
это и выполнить equivalent deterministic reconciliation на current
records.

------------------------------------------------------------------------

# 35. GLOBAL COMMERCIAL AUDIT MATRIX

  -------------------------------------------------------------------------------------
  Source      Canonical   Expected    Actual   Missing      Wrong    Orphan   Duplicate
               entities     events                       customer           
  --------- ----------- ---------- --------- --------- ---------- --------- -----------
  ORDER                                                                     

  BOOKING                                                                   

  PAYMENT                                                                   

  REFUND                                                                    
  -------------------------------------------------------------------------------------

VERDICT A требует:

``` text
Missing = 0
Wrong customer = 0
Orphan = 0
Duplicate = 0
```

для всех applicable canonical expected events.

------------------------------------------------------------------------

# 36. ROOT CAUSE REQUIREMENT

Если defect найден, report должен назвать exact root cause.

Недостаточно:

``` text
mapping issue
```

Нужно:

``` text
какое поле было неверно
в каком adapter/projector
какая canonical relation/path правильная
почему тесты раньше не ловили
как historical rows reconciled
как live path fixed
```

------------------------------------------------------------------------

# 37. CHANGE BOUNDARY

Не начинать:

``` text
Partner 360 Activity UI / Round 2D
new CRM redesign
new Order/Booking/Payment/Refund architecture
unrelated localization cleanup
```

Допустимы только изменения, необходимые для commercial cross-view
consistency и regression protection.

------------------------------------------------------------------------

# 38. ROADMAP

После VERDICT A:

``` text
Round 2C — Customer 360 Activity UI
    ✅ FULLY CLOSED

Round 2C.1 — Runtime/I18N/History/Backfill Closure
    ✅ CLOSED (d480cfb or actual synchronized SHA)

Round 2C.2 — Commercial Cross-View Consistency Closure
    ✅ CLOSED (<SHA>)

Round 2D — Partner 360 Activity UI
    ⏭ NEXT
```

Не закрывать Step 3.5.3 целиком.

------------------------------------------------------------------------

# 39. REQUIRED REPORT

Создать:

``` text
docs/prompts/PHASE_3_STEP_3.5.3_CRM_ACTIVITY_ROUND_2C_2_COMMERCIAL_CROSS_VIEW_CONSISTENCY_CLOSURE_REPORT.md
```

Report language:

``` text
RUSSIAN
```

------------------------------------------------------------------------

# 40. GIT DISCIPLINE

Перед staging:

``` bash
git diff --check
git status --short
git diff
```

Stage exact files only.

Запрещено:

``` bash
git add .
git add -A
```

Normal commit/push. Never force-push.

После push:

``` bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

------------------------------------------------------------------------

# 41. ACCEPTANCE CRITERIA

VERDICT A только если:

1.  Representative Customer(s) selected and documented.
2.  Orders canonical source reconciled.
3.  Bookings canonical source reconciled.
4.  Payments canonical source reconciled.
5.  Refunds canonical source reconciled.
6.  Observed `PAY-00007001` mismatch explained or equivalent
    current-runtime finding reconciled.
7.  `PAY-00000557` reconciled where still present.
8.  `PAY-00000616` reconciled where still present.
9.  Visible Payment code corresponds to exact canonical `sourceId`.
10. ORDER wrong-customer events = 0.
11. BOOKING wrong-customer events = 0.
12. PAYMENT wrong-customer events = 0.
13. REFUND wrong-customer events = 0.
14. Missing expected ORDER events = 0.
15. Missing expected BOOKING events = 0.
16. Missing expected PAYMENT events = 0.
17. Missing expected REFUND events = 0.
18. Commercial orphan events = 0.
19. Commercial duplicate events = 0.
20. Cross-customer leakage = 0.
21. Customer A/B isolation proven.
22. Correct sourceId for Order.
23. Correct sourceId for Booking.
24. Correct sourceId for Payment.
25. Correct sourceId for Refund.
26. Correct canonical customer derivation for Booking.
27. Correct canonical customer derivation for Payment.
28. Correct canonical customer derivation for Refund.
29. Partner attribution not regressed where applicable.
30. ORDER timestamp semantics verified.
31. BOOKING timestamp semantics verified.
32. PAYMENT timestamp semantics verified.
33. REFUND timestamp semantics verified.
34. Actual eventType contract documented.
35. No false count-equality assumptions.
36. Invalid Prisma includes absent.
37. Cross-schema lookup remains batched/no obvious N+1.
38. Historical rows reconciled if defect affected them.
39. Live projection fixed if defect affected it.
40. New events do not require manual rebuild.
41. Activity API source filters return correct customer data.
42. UI exact references match canonical tabs.
43. Links are correct where routes exist.
44. RU/EN/AZ regression PASS.
45. Mixed locale remains 0.
46. History duplicate tab remains removed.
47. Backfill hardening remains intact.
48. Operational Notes live projection/RBAC not regressed.
49. Backend TSC PASS.
50. Backend build PASS.
51. CRM Activity unit tests PASS.
52. CRM Activity E2E PASS.
53. New commercial consistency tests PASS.
54. Frontend TSC PASS.
55. Frontend build PASS.
56. Frontend tests PASS.
57. Customer A matrix complete.
58. Payment finding matrix complete.
59. Global commercial audit matrix complete.
60. Root cause exact if any defect found.
61. No unresolved P0/P1.
62. Report created in Russian.
63. Roadmap synchronized.
64. `git diff --check` clean.
65. Changes committed.
66. Changes pushed.
67. HEAD == origin/master.
68. No Round 2D implementation.
69. Final verdict based on DB/API/browser evidence, not source
    inspection only.

------------------------------------------------------------------------

# 42. FINAL RESPONSE FORMAT --- STRICTLY RUSSIAN

``` text
VERDICT:

РЕПОЗИТОРИЙ
Repository:
Branch:
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:
Worktree:

OBSERVED PAYMENT FINDING
PAY-00007001:
PAY-00000557:
PAY-00000616:
Root cause:
Final reconciliation:

REPRESENTATIVE CUSTOMERS
Customer A:
Customer B:
Additional customer if needed:

ORDER RECONCILIATION
Canonical rows:
Expected events:
Actual events:
Missing:
Wrong customer:
Orphans:
Duplicates:
Timestamp:
Runtime proof:

BOOKING RECONCILIATION
Canonical rows:
Expected events:
Actual events:
Missing:
Wrong customer:
Orphans:
Duplicates:
Customer derivation:
Timestamp:
Runtime proof:

PAYMENT RECONCILIATION
Canonical rows:
Expected events:
Actual events:
Missing:
Wrong customer:
Orphans:
Duplicates:
SourceId/code authority:
Customer derivation:
Timestamp:
Runtime proof:

REFUND RECONCILIATION
Canonical rows:
Expected events:
Actual events:
Missing:
Wrong customer:
Orphans:
Duplicates:
Customer derivation:
Timestamp:
Runtime proof:

CROSS-CUSTOMER ISOLATION
A → B leakage:
B → A leakage:

LIVE VS BACKFILL
Historical defect:
Live defect:
Rebuild required:
New events require rebuild?:

ADAPTER / QUERY STRATEGY
Order:
Booking:
Payment:
Refund:
Batch lookup:
N+1:
Invalid Prisma relations:

API PROOF
ORDER:
BOOKING:
PAYMENT:
REFUND:

BROWSER PROOF
Orders ↔ Activity:
Bookings ↔ Activity:
Payments ↔ Activity:
Refunds ↔ Activity:
RU:
AZ:
EN:

CUSTOMER A MATRIX
...

PAYMENT FINDING MATRIX
...

GLOBAL COMMERCIAL AUDIT MATRIX
...

TESTS / BUILDS
Backend TSC:
Backend build:
CRM Activity unit:
CRM Activity E2E:
Commercial consistency:
Frontend TSC:
Frontend build:
Frontend tests:
Operational Notes:

FILES CHANGED
...

Schema changed:
Migration changed:
Backend production changed:
Frontend production changed:

ROADMAP
Round 2C:
Round 2C.1:
Round 2C.2:
Next:

Report:
Commit:

ОСТАВШИЕСЯ FINDINGS
P0:
P1:
P2:

NEXT:
```

------------------------------------------------------------------------

# 43. VERDICT RULE

Success only:

``` text
VERDICT A — PHASE 3 STEP 3.5.3 PLATFORM CRM /
CRM COMMUNICATIONS + ACTIVITY TIMELINE /
ROUND 2C.2 — COMMERCIAL CROSS-VIEW CONSISTENCY CLOSURE /
ORDERS + BOOKINGS + PAYMENTS + REFUNDS /
CANONICAL SOURCE RECONCILIATION + SUBJECT INTEGRITY +
CROSS-CUSTOMER ISOLATION + RUNTIME EVIDENCE /
FULLY CLOSED
```

Otherwise:

``` text
VERDICT B — PHASE 3 STEP 3.5.3 PLATFORM CRM /
CRM ACTIVITY ROUND 2C.2 /
COMMERCIAL CROSS-VIEW CONSISTENCY INCOMPLETE
```

No conditional VERDICT A.

------------------------------------------------------------------------

# 44. STOP

После:

``` text
commercial reconciliation
fixes if required
historical/live consistency proof
tests/builds
browser/API evidence
report
roadmap sync
commit
push
```

**STOP.**

Не начинать:

``` text
ROUND 2D — PARTNER 360 ACTIVITY UI
```

без отдельного задания.
