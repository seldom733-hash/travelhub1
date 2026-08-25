# PHASE 3 --- DECISION QUEUE --- SHORT REMEDIATION

## DESTINATION EVIDENCE COLUMNS + RUNTIME COUNT RECONCILIATION

## POST ROUND 5

------------------------------------------------------------------------

# 1. ЦЕЛЬ

Round 5 уже исправил semantic predicates маршрутов Decision Queue:

``` text
BOOKING_CONFIRMATION_DELAY
FAILED_PAYMENTS
PENDING_REFUNDS
RECENT_CANCELLATIONS
SERVICES_WITHOUT_SALES
REVIEW_AVAILABILITY
UPCOMING_BOOKINGS
```

Однако пользователь пока не может визуально доказать корректность
выборки на destination pages, потому что таблицы не показывают
минимальные evidence-поля, на основании которых запись попала в cohort.

Нужно выполнить КОРОТКИЙ remediation:

``` text
Decision Queue signal
→ exact destination predicate
→ filtered total
→ evidence columns in destination table
→ visual/runtime count reconciliation
```

Это НЕ новый redesign страниц и НЕ новый бизнес-функционал.

------------------------------------------------------------------------

# 2. ГЛАВНЫЙ UX / DATA CONTRACT

Если Decision Queue ведёт пользователя на filtered operational list,
destination page MUST:

1.  реально применить тот же canonical predicate;
2.  показать активный filter context;
3.  показать `filtered total`;
4.  показать evidence columns, объясняющие попадание каждой строки в
    выборку;
5.  сохранить фильтр при pagination;
6.  не выдавать первую страницу из 20 строк за полный cohort.

Canonical principle:

``` text
Every filtered destination must be explainable from visible row evidence.
```

------------------------------------------------------------------------

# 3. HARD COUNT CONTRACT

Для каждого сигнала сравнить:

``` text
Decision Queue detector count
vs
Destination filtered total
```

Нельзя сравнивать detector count только с количеством строк на текущей
странице.

Пример:

``` text
Decision Queue:
Услуги без продаж = 31

Destination:
Найдено: 31
Показано: 1–20 из 31
```

Это PASS.

``` text
Decision Queue = 31
Destination total = 20
```

это FAIL, если 20 является total, а не page size.

------------------------------------------------------------------------

# 4. SERVICES_WITHOUT_SALES --- OPEN SERVICES

Current predicate:

``` text
status=PUBLISHED
unsold=true
```

Destination:

``` text
/app/catalog
```

Добавить/показать minimum evidence:

``` text
Статус услуги
Количество продаж / заказов
```

Для cohort `unsold=true` каждая строка должна доказуемо иметь:

``` text
status = PUBLISHED
sales/orders count = 0
```

Название колонки выбрать в соответствии с реальной canonical metric
detector-а.

ВАЖНО:

Если detector определяет "без продаж" через отсутствие qualifying
orders, не называть колонку `Продажи`, если фактически показывается
другая сущность.

Сначала определить exact detector authority.

------------------------------------------------------------------------

# 5. SERVICES_WITHOUT_SALES --- REVIEW AVAILABILITY

Current predicate:

``` text
status=PUBLISHED
availability=missing
```

Destination:

``` text
/app/catalog
```

Добавить/показать minimum evidence:

``` text
Статус услуги
Доступность
```

Каждая строка должна визуально объяснять:

``` text
PUBLISHED
+
availability missing / not configured
```

Не придумывать новые availability states.

Использовать реальные canonical состояния/данные проекта.

------------------------------------------------------------------------

# 6. UNSOLD VS AVAILABILITY --- НЕ СМЕШИВАТЬ

Два действия одного сигнала могут вести в Catalog, но должны показывать
разные cohorts:

``` text
Открыть услуги
→ PUBLISHED + unsold=true

Проверить доступность
→ PUBLISHED + availability=missing
```

Даже если datasets сейчас случайно совпадают, UI/filter context должен
явно показывать различие predicates.

В report отдельно доказать:

``` text
unsold cohort count
availability-missing cohort count
intersection count
```

------------------------------------------------------------------------

# 7. UPCOMING_BOOKINGS

Current Round 5 contract:

``` text
upcoming=true
+
canonical allowed booking statuses
```

Destination:

``` text
/app/bookings
```

Добавить/показать:

``` text
Дата/время услуги
Статус бронирования
```

Перед изменением UI проверить exact detector predicate.

Destination MUST использовать те же:

``` text
date boundary
timezone
status set
```

что и detector.

Не считать booking upcoming только потому, что она не завершена.

------------------------------------------------------------------------

# 8. UPCOMING STATUS PARITY HARD GATE

Round 5 report указывал:

``` text
status IN (CONFIRMED, NEW)
```

Не принимать это как истину без проверки detector source.

Нужно доказать:

``` text
Detector allowed statuses
==
Destination allowed statuses
```

Если detector использует другой status set --- исправить destination
predicate или shared authority.

Не создавать новую бизнес-семантику в этом remediation.

------------------------------------------------------------------------

# 9. PENDING_REFUNDS

Current predicate:

``` text
pendingRefund=true
→ Refund.status=REQUESTED
```

Destination:

``` text
/app/orders
```

Добавить/показать minimum evidence:

``` text
Статус возврата
Сумма возврата
Дата запроса возврата
```

При необходимости также:

``` text
Order number
Order status
Payment status
```

но `Order.status=CANCELLED` НЕ является доказательством pending refund.

Каждая строка cohort должна иметь canonical pending refund evidence.

------------------------------------------------------------------------

# 10. FAILED_PAYMENTS

Current predicate:

``` text
paymentFailed=true
→ Payment.status=FAILED
```

Destination:

``` text
/app/orders
```

Добавить/показать minimum evidence:

``` text
Статус платежа / последней релевантной попытки
Дата/время сбоя
Причина / код ошибки — если canonical data существует
```

Не фабриковать failure reason, если его нет.

`OrderPaymentStatus=UNPAID` НЕ является доказательством failed payment.

------------------------------------------------------------------------

# 11. FAILED PAYMENT COUNT SEMANTICS

Проверить detector counting unit:

``` text
failed payment attempts?
unique payments?
unique orders with failed payment?
```

Destination total должен сравниваться с тем же counting unit.

Если Decision Queue показывает:

``` text
8 неуспешных платежей
```

а destination является таблицей Orders, возможен legitimate many-to-one
mapping.

В таком случае нельзя искусственно объявлять:

``` text
8 payment attempts = 8 orders
```

Нужно либо:

A. destination total/count unit привести к detector authority,

либо

B. явно показать mapping:

``` text
8 failed payments
across N orders
```

и доказать его.

------------------------------------------------------------------------

# 12. BOOKING_CONFIRMATION_DELAY

Current predicate:

``` text
status=AWAITING_CONFIRMATION
overdue=true
slaMinutes=<canonical threshold>
```

Destination:

``` text
/app/bookings
```

Добавить/показать:

``` text
Статус
Время ожидания подтверждения
SLA threshold
SLA breach / overdue indicator
```

Использовать нормализованный human-readable duration:

``` text
2 дн. 0 ч.
```

а не raw:

``` text
2895 minutes
```

если UI уже имеет canonical duration formatter.

------------------------------------------------------------------------

# 13. RECENT_CANCELLATIONS

Current predicate:

``` text
status=CANCELLED
cancelledWithin=7
```

Destination:

``` text
/app/orders
```

Добавить/показать:

``` text
Статус заказа
Дата/время отмены
```

Каждая строка должна попадать в тот же canonical 7-day window, что и
detector.

Проверить timezone/boundary semantics.

------------------------------------------------------------------------

# 14. EVIDENCE COLUMNS --- CONTEXTUAL VISIBILITY

Не обязательно постоянно перегружать базовые таблицы всеми новыми
колонками.

Допустимы два подхода:

``` text
A. Always-visible useful operational columns
```

или:

``` text
B. Contextual evidence columns shown when corresponding URL filter is active
```

Выбрать минимально инвазивный вариант, соответствующий существующему UI.

Но при переходе из Decision Queue evidence MUST быть видимо без
developer tools.

------------------------------------------------------------------------

# 15. FILTER CONTEXT

При переходе из Decision Queue пользователь должен видеть активный
filter context.

Например:

``` text
Опубликован
Без продаж
```

или:

``` text
Ожидает подтверждения
SLA нарушен
```

или:

``` text
Возврат: ожидает обработки
```

Не показывать false chip/label, который не соответствует реальному
backend predicate.

------------------------------------------------------------------------

# 16. PAGINATION

Проверить Catalog / Orders / Bookings.

Если pagination уже существует --- сохранить и доказать.

Если Round 5 requirement ещё не реализован, реализовать минимальный
canonical pagination contract:

``` text
default page size = 20
page-size options = 20 / 50 / 100
filtered total visible
current range visible
page navigation
```

Пример:

``` text
Показано 1–20 из 31
```

или эквивалент существующего design system.

------------------------------------------------------------------------

# 17. PAGINATION FILTER PERSISTENCE

При:

``` text
page 1 → page 2
20 → 50
back/forward
```

Decision Queue filter context не должен теряться.

Проверить:

``` text
URL params
frontend state
backend query
filtered total
```

------------------------------------------------------------------------

# 18. NO CLIENT-SIDE FAKE FILTERING

Запрещено исправлять parity через:

``` text
fetch broad dataset
→ filter only current page in frontend
```

если backend already owns canonical predicate.

Filtering/pagination/count должны быть согласованы server-side.

------------------------------------------------------------------------

# 19. SHARED PREDICATE AUTHORITY

Проверить, можно ли без лишнего redesign уменьшить semantic drift между:

``` text
Detector predicate
Action target predicate
Destination backend predicate
Destination evidence
```

Не делать большой refactor без необходимости.

Но report должен указать, где находится canonical authority для каждого
cohort.

------------------------------------------------------------------------

# 20. REQUIRED RUNTIME MATRIX

Вернуть реальные runtime counts:

  --------------------------------------------------------------------------------
  Signal / Action      Detector   Destination  Current page Count unit PASS/FAIL
                          count      filtered          rows            
                                        total                          
  --------------- ------------- ------------- ------------- ---------- -----------
  Services                                                             
  Without Sales /                                                      
  Open Services                                                        

  Services                                                             
  Without Sales /                                                      
  Review                                                               
  Availability                                                         

  Upcoming                                                             
  Bookings                                                             

  Pending Refunds                                                      

  Failed Payments                                                      

  Booking                                                              
  Confirmation                                                         
  Delay                                                                

  Recent                                                               
  Cancellations                                                        
  --------------------------------------------------------------------------------

Не оставлять эту таблицу без фактических чисел.

------------------------------------------------------------------------

# 21. REQUIRED ROW-EVIDENCE MATRIX

Для каждого destination взять минимум 3 representative rows, если cohort
\>= 3.

  Signal   Row ID   Visible evidence   Predicate result   PASS/FAIL
  -------- -------- ------------------ ------------------ -----------

Для cohort \< 3 проверить все строки.

------------------------------------------------------------------------

# 22. REQUIRED NEGATIVE EVIDENCE

Для каждого predicate проверить минимум один near-miss объект, если
такой существует:

Примеры:

``` text
PUBLISHED service with sales > 0
→ must NOT appear in unsold cohort

PUBLISHED service with configured availability
→ must NOT appear in availability=missing

completed/past booking
→ must NOT appear in upcoming

Refund.status != REQUESTED
→ must NOT appear in pending refunds

UNPAID order without FAILED payment
→ must NOT appear in failed payments

AWAITING_CONFIRMATION within SLA
→ must NOT appear in confirmation delay

CANCELLED outside 7-day window
→ must NOT appear in recent cancellations
```

------------------------------------------------------------------------

# 23. ZERO / EMPTY STATES

Если cohort count = 0:

``` text
Decision Queue
Destination filtered total
Empty state
```

должны быть согласованы.

Не показывать broad unfiltered table вместо пустого filtered cohort.

------------------------------------------------------------------------

# 24. DO NOT CHANGE BUSINESS SEMANTICS

Этот remediation НЕ должен:

``` text
изменять detector meaning
изобретать новые statuses
изменять refund lifecycle
изменять payment lifecycle
изменять booking lifecycle
изменять Catalog publication lifecycle
```

Если обнаружен semantic conflict --- STOP для конкретного signal и
report finding.

------------------------------------------------------------------------

# 25. DO NOT TOUCH SUPPLIER SETTLEMENT FOUNDATION

Не изменять закрытую architecture reconciliation:

``` text
Customer Payment Terms
≠ Supplier Settlement Terms
≠ Supplier Payout
```

Не запускать S.1--S.19.

------------------------------------------------------------------------

# 26. TESTS

Добавить/обновить focused tests там, где изменяется runtime code.

Минимум проверить:

``` text
evidence fields returned correctly
filters preserve exact predicate
filtered total correct
pagination preserves filters
near-miss exclusions
```

Запустить существующие relevant backend/frontend checks.

Не ухудшить текущий baseline.

------------------------------------------------------------------------

# 27. BROWSER EVIDENCE

Обязательно проверить runtime в браузере для всех 7 actions.

Для каждого зафиксировать:

``` text
source Decision Queue count
destination URL
active filters
filtered total
page range
visible evidence columns
representative rows
```

HTTP 200 сам по себе НЕ является evidence semantic correctness.

------------------------------------------------------------------------

# 28. HARD GATES

VERDICT A невозможен без:

1.  All 7 actions open valid destination.
2.  404 = 0.
3.  500 = 0.
4.  Filter context visible.
5.  Filter context matches backend predicate.
6.  Filtered total visible.
7.  Pagination does not masquerade as total.
8.  Filters survive pagination.
9.  Services Without Sales rows visibly prove unsold predicate.
10. Availability rows visibly prove missing-availability predicate.
11. Unsold and availability predicates remain distinct.
12. Upcoming rows visibly prove date/status predicate.
13. Upcoming status set matches detector.
14. Pending Refund rows visibly prove Refund.status authority.
15. Failed Payment rows visibly prove FAILED payment authority.
16. Failed-payment counting unit reconciled.
17. Confirmation Delay rows visibly prove status + SLA breach.
18. Recent Cancellation rows visibly prove 7-day cancellation window.
19. Detector count ↔ destination total reconciled for every signal, OR
    an explicit mathematically proven counting-unit mapping is
    documented.
20. Representative positive rows verified.
21. Near-miss negative rows verified.
22. No client-side fake filtering.
23. Existing RBAC/tenant scope preserved.
24. Tests pass.
25. Frontend TSC passes.
26. Backend TSC passes.
27. Unrelated files not committed.
28. HEAD == origin/master after push.

------------------------------------------------------------------------

# 29. FILE SCOPE

Expected files MAY include:

``` text
frontend/app/app/catalog/page.tsx
frontend/app/app/orders/page.tsx
frontend/app/app/bookings/page.tsx
relevant table/components
backend services/controllers/DTOs only if evidence/count support is missing
focused tests
report
```

Не менять файлы только ради cosmetic refactor.

------------------------------------------------------------------------

# 30. REPORT

Создать:

``` text
docs/prompts/PHASE_3_DECISION_QUEUE_DESTINATION_EVIDENCE_COLUMNS_RUNTIME_COUNT_RECONCILIATION_REPORT.md
```

Report должен содержать:

``` text
Root cause
Files changed
Evidence columns added
Detector/destination predicate matrix
Runtime count matrix
Row evidence matrix
Negative evidence matrix
Pagination evidence
Browser evidence
Tests/TSC
Git evidence
Remaining findings
```

------------------------------------------------------------------------

# 31. GIT

После PASS:

``` text
git status
git diff
commit only related files
git push origin master
git rev-parse HEAD
git rev-parse origin/master
```

Не включать unrelated working-tree files.

------------------------------------------------------------------------

# 32. VERDICT

Только если hard gates закрыты:

``` text
VERDICT A — DECISION QUEUE DESTINATION EVIDENCE & RUNTIME COUNT RECONCILIATION COMPLETE
```

Если predicates работают, но пользователь всё ещё не может визуально
проверить cohort или count parity не доказана:

``` text
VERDICT B — DESTINATION PREDICATES PRESENT, EVIDENCE / COUNT RECONCILIATION INCOMPLETE
```

------------------------------------------------------------------------

# 33. NEXT STAGE

После VERDICT A:

``` text
STOP
```

Не запускать автоматически:

``` text
CRM Step 3.5
Supplier Settlement S.1–S.19
other Phase 3 implementation
```

Следующий canonical stage определяется отдельно после review отчёта.
