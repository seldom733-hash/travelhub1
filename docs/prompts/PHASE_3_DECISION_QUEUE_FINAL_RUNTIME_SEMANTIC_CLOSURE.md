# PHASE 3 — DECISION QUEUE — FINAL RUNTIME SEMANTIC CLOSURE
## 7 SIGNALS / DESTINATION PARITY / ROW EVIDENCE / COUNT PARITY
## POST PROJECT-WIDE PAGINATION CLOSURE

---

# 1. ЦЕЛЬ

Project-wide pagination уже закрыта отдельным этапом.

Текущий этап НЕ должен повторно переделывать pagination.

Цель — окончательно закрыть runtime-семантику Decision Queue для всех 7 operational actions:

```text
1. SERVICES_WITHOUT_SALES → Открыть услуги
2. SERVICES_WITHOUT_SALES → Проверить доступность
3. UPCOMING_BOOKINGS → Открыть предстоящие
4. PENDING_REFUNDS → Открыть возвраты
5. FAILED_PAYMENTS → Открыть платежи
6. BOOKING_CONFIRMATION_DELAY → Открыть бронирования
7. RECENT_CANCELLATIONS → Открыть заказы
```

Нужно доказать:

```text
Decision Queue detector
=
action predicate
=
destination backend filter
=
destination total
=
visible row evidence
```

Если обнаружен residual runtime defect — исправить только его.

---

# 2. НЕ МЕНЯТЬ ЗАКРЫТЫЕ СТАНДАРТЫ

Не менять:

```text
project-wide operational table default page size = 20
multi-page navigation when total > 20
public marketplace pagination contract
Supplier Settlement architecture
Booking Commercial Terms architecture
CRM business model
```

Pagination проверяется здесь только как evidence того, что filtered total доступен полностью.

---

# 3. HARD PRINCIPLE

Для каждого action пользователь должен иметь возможность ответить:

```text
Почему именно эта строка попала в этот список?
```

без:

```text
developer tools
SQL
догадок
скрытой backend-логики
```

Destination table должна показывать minimum visible evidence.

---

# 4. COUNT PARITY

Для каждого сигнала:

```text
Decision Queue count
=
destination canonical filtered total
```

Если counting unit различается, например:

```text
failed payment attempts
vs
orders containing failed payments
```

нельзя искусственно требовать числового равенства.

В таком случае report MUST показать точный mapping:

```text
X failed payments
across Y orders
```

и объяснить canonical counting authority.

---

# 5. SERVICES WITHOUT SALES — OPEN SERVICES

Action:

```text
Открыть услуги
```

Expected destination predicate:

```text
status=PUBLISHED
unsold=true
```

Проверить exact canonical detector implementation.

Destination MUST показать evidence:

```text
Статус
Заказы / Продажи = 0
```

Название колонки должно соответствовать фактической detector metric.

Hard gate:

```text
каждая строка cohort
→ PUBLISHED
→ qualifying sales/orders count = 0
```

Near-miss:

```text
PUBLISHED service with qualifying sale/order > 0
→ MUST NOT appear
```

---

# 6. SERVICES WITHOUT SALES — REVIEW AVAILABILITY

Action:

```text
Проверить доступность
```

Expected destination predicate:

```text
status=PUBLISHED
availability=missing
```

Проверить exact canonical detector implementation.

Destination MUST показать:

```text
Статус
Доступность
```

Hard gate:

```text
каждая строка
→ PUBLISHED
→ availability действительно отсутствует / не настроена
```

Near-miss:

```text
PUBLISHED service with configured availability
→ MUST NOT appear
```

---

# 7. UNSOLD ≠ MISSING AVAILABILITY

Это два разных predicates.

Даже если datasets частично или полностью совпадают на текущих seed/runtime данных:

```text
unsold=true
≠
availability=missing
```

Report MUST вернуть:

```text
unsold total
availability-missing total
intersection total
unsold-only total
availability-only total
```

Нельзя подменять один filter другим.

---

# 8. UPCOMING BOOKINGS

Action:

```text
Открыть предстоящие
```

Проверить canonical definition `upcoming`.

Не принимать старые assumptions без проверки source.

Нужно установить exact:

```text
allowed booking statuses
service date/time boundary
timezone
whether today is included
whether NEW is allowed
whether CONFIRMED is allowed
whether IN_SERVICE is excluded
whether COMPLETED is excluded
whether CANCELLED is excluded
```

Destination MUST показать:

```text
Дата/время услуги
Статус бронирования
```

Hard gate:

```text
каждая строка соответствует exact upcoming predicate
```

Near-miss:

```text
past booking
COMPLETED booking
CANCELLED booking
other status outside canonical set
→ MUST NOT appear
```

---

# 9. PENDING REFUNDS

Action:

```text
Открыть возвраты
```

Current intended authority:

```text
Refund.status = REQUESTED
```

Но сначала проверить actual canonical enum/model.

Destination:

```text
/app/orders?pendingRefund=true
```

допустим только если Orders действительно является canonical operational destination.

Минимальное evidence:

```text
Статус возврата
Сумма возврата
Дата запроса возврата
```

Если часть полей отсутствует в current schema/read model:

```text
НЕ фабриковать
```

но report должен явно указать missing capability.

Hard gate:

```text
CANCELLED order alone
≠
pending refund
```

Near-miss:

```text
cancelled + no requested refund
→ MUST NOT appear

refund already completed/rejected/cancelled
→ MUST NOT appear
```

---

# 10. FAILED PAYMENTS

Action:

```text
Открыть платежи
```

Canonical evidence должен исходить из реального payment failure:

```text
Payment.status = FAILED
```

или exact equivalent actual model.

Не использовать:

```text
Order.paymentStatus = UNPAID
```

как замену failed payment.

Destination MUST показать minimum evidence:

```text
Неуспешный платёж
дата/время failure — если хранится
failure reason/code — только если реально хранится
```

Near-miss:

```text
UNPAID order with no failed payment attempt
→ MUST NOT appear
```

---

# 11. FAILED PAYMENT COUNTING UNIT

Обязательно определить:

```text
Decision Queue count unit =
payment attempts?
payments?
orders?
```

Destination table может быть Orders.

Если:

```text
8 failed payments
across 6 orders
```

правильный UI/report должен это объяснить.

Нельзя показывать:

```text
Decision Queue = 8
Orders total = 6
```

и объявлять mismatch без анализа counting unit.

---

# 12. BOOKING CONFIRMATION DELAY

Action:

```text
Открыть бронирования
```

Проверить exact canonical predicate:

```text
status = AWAITING_CONFIRMATION
SLA exceeded
canonical slaMinutes
canonical start timestamp
timezone
```

Destination evidence:

```text
Статус
Дата/время начала ожидания
Время ожидания
SLA threshold / overdue indicator
```

Near-miss:

```text
AWAITING_CONFIRMATION but still inside SLA
→ MUST NOT appear

CONFIRMED
→ MUST NOT appear
```

---

# 13. RECENT CANCELLATIONS

Action:

```text
Открыть заказы
```

Проверить exact canonical predicate:

```text
status=CANCELLED
cancelledWithin=<canonical period>
```

Если current canonical period = 7 days — доказать это source/runtime evidence.

Destination evidence:

```text
Статус заказа
Дата/время отмены
```

Near-miss:

```text
CANCELLED outside canonical window
→ MUST NOT appear
```

---

# 14. DESTINATION FILTER CONTEXT

После перехода из Decision Queue пользователь должен видеть active context.

Примеры:

```text
Опубликован + Без продаж
Опубликован + Доступность не настроена
Предстоящие
Ожидает возврата
Неуспешный платёж
Просрочено подтверждение
Отменён за последние 7 дней
```

Exact wording — по existing RU/AZ/EN i18n.

Не показывать raw query params пользователю как единственное explanation.

---

# 15. EVIDENCE COLUMNS

Проверить фактическое наличие колонок в runtime, а не только в source code/report.

Expected minimum:

| Context | Visible evidence |
|---|---|
| Unsold services | qualifying orders/sales count |
| Missing availability | availability state |
| Upcoming bookings | service date + booking status |
| Pending refunds | refund status + amount/date where available |
| Failed payments | failed payment evidence |
| Confirmation delay | status + waiting/SLA evidence |
| Recent cancellations | cancelledAt |

Если колонка contextual — она MUST появляться при соответствующем Decision Queue filter.

---

# 16. PAGINATION PARITY

Project-wide pagination уже закрыта.

Здесь только доказать:

```text
filtered total = full cohort
```

а не:

```text
current page rows
```

При total > 20:

```text
page 1 = up to 20
remaining records accessible on later pages
filter context preserved
```

Не переписывать pagination infrastructure без residual defect.

---

# 17. POSITIVE ROW EVIDENCE

Для каждого cohort проверить минимум 3 representative rows, если total >= 3.

Report:

| Signal | Row ID | Visible evidence | Canonical predicate | PASS |
|---|---|---|---|---|

Если total < 3 — проверить все строки.

---

# 18. NEGATIVE / NEAR-MISS EVIDENCE

Для каждого signal найти минимум один объект, максимально близкий к predicate, но не проходящий его.

Report:

| Signal | Near-miss Row ID | Why it must be excluded | Actually excluded? | PASS |
|---|---|---|---|---|

Если подходящего near-miss нет в runtime dataset:

```text
create/use isolated test fixture
```

Не портить production/dev canonical dataset только ради evidence.

---

# 19. ZERO STATE

Если detector count = 0:

```text
destination filtered total = 0
empty state corresponds to active filter
```

Нельзя fallback'ить на broad/unfiltered list.

---

# 20. DETECTOR / ACTION / DESTINATION MATRIX

Report MUST содержать:

| Signal | Detector predicate | Action URL predicate | Backend destination predicate | Visible evidence | PASS |
|---|---|---|---|---|---|

Все четыре слоя должны быть семантически согласованы.

---

# 21. RUNTIME COUNT MATRIX

Report MUST вернуть фактические числа:

| Signal / Action | Queue count | Destination total | Counting unit | Pages | PASS |
|---|---:|---:|---|---:|---|
| Services Without Sales / Open Services | | | | | |
| Services Without Sales / Review Availability | | | | | |
| Upcoming Bookings | | | | | |
| Pending Refunds | | | | | |
| Failed Payments | | | | | |
| Booking Confirmation Delay | | | | | |
| Recent Cancellations | | | | | |

Не использовать `varies`.

---

# 22. BROWSER VERIFICATION

Обязательно реально открыть все 7 actions в browser.

Для каждого записать:

```text
source Queue label/count
destination URL
HTTP result
active filter context
destination total
page count
visible evidence columns
3 positive rows
negative/near-miss evidence
```

HTTP 200 сам по себе НЕ PASS.

---

# 23. I18N

Проверить новые/контекстные labels:

```text
RU
AZ
EN
```

Raw i18n keys = 0.

Не расширять i18n scope за пределы изменённых evidence/filter labels.

---

# 24. SECURITY

Не нарушить:

```text
JwtAuthGuard
PermissionsGuard
RBAC
workspace scope
tenant/partner scope
IDOR protection
```

Decision Queue count и destination cohort должны считаться в одном security scope.

---

# 25. TESTS

Добавить/обновить focused tests только там, где residual defect требует production change.

Проверить минимум:

```text
predicate parity
positive inclusion
near-miss exclusion
filtered total
counting-unit mapping where needed
```

Запустить relevant baseline:

```text
Backend TSC
Frontend TSC
Backend tests
Frontend build/tests if part of current gates
```

---

# 26. NO SCOPE CREEP

НЕ реализовывать здесь:

```text
CRM Step 3.5
Supplier Settlement S.1–S.19
Booking Commercial Terms runtime
new Command Center KPIs
new payment/refund lifecycles
new availability model
new booking statuses
```

Если текущей schema не хватает для requested evidence — report architectural/runtime gap, не изобретать model silently.

---

# 27. PRODUCTION CODE POLICY

Если все 7 actions уже корректны:

```text
Production code changed: NO
Evidence/report only
```

Если найден residual defect:

```text
fix only that defect
```

Report должен перечислить exact production files и root cause.

---

# 28. HARD ACCEPTANCE CRITERIA

VERDICT A только если:

1. All 7 actions browser-tested.
2. 404 = 0.
3. 500 = 0.
4. Detector predicate identified for every signal.
5. Action predicate matches detector semantics.
6. Destination backend predicate matches detector semantics.
7. Visible filter context matches predicate.
8. Required evidence columns visible in runtime.
9. Unsold services visibly prove zero qualifying sales/orders.
10. Missing availability visibly proves missing availability.
11. Unsold and availability remain distinct predicates.
12. Upcoming exact statuses/date/timezone reconciled.
13. Completed/cancelled/past near-misses excluded from upcoming.
14. Pending refunds use canonical Refund authority, not order cancellation proxy.
15. Pending-refund evidence visible.
16. Failed payments use actual failed-payment authority, not unpaid proxy.
17. Failed-payment counting unit explicitly reconciled.
18. Confirmation delay proves status + SLA breach.
19. Recent cancellations prove cancellation timestamp + window.
20. Queue count ↔ destination total parity proven, or exact counting-unit mapping proven.
21. No current-page row count used as total.
22. Positive row evidence recorded.
23. Negative near-miss evidence recorded.
24. Zero states correct where applicable.
25. Pagination/filter context remains intact.
26. RU/AZ/EN labels valid where touched.
27. Security scope preserved.
28. Relevant tests PASS.
29. Backend TSC PASS.
30. Frontend TSC PASS.
31. Unrelated files committed = 0.
32. Push complete.
33. HEAD == origin/master.

---

# 29. REPORT FILE

Создать:

```text
docs/prompts/PHASE_3_DECISION_QUEUE_FINAL_RUNTIME_SEMANTIC_CLOSURE_REPORT.md
```

---

# 30. FINAL RESPONSE FORMAT

```text
VERDICT:

Production code changed:
Root causes fixed:

1. Services Without Sales / Open Services
Queue count:
Destination total:
Predicate:
Evidence:
Near-miss:
PASS:

2. Services Without Sales / Review Availability
Queue count:
Destination total:
Predicate:
Evidence:
Near-miss:
PASS:

3. Upcoming Bookings
Queue count:
Destination total:
Allowed statuses:
Date/timezone rule:
Evidence:
Near-miss:
PASS:

4. Pending Refunds
Queue count:
Destination total:
Refund authority:
Evidence:
Near-miss:
PASS:

5. Failed Payments
Queue count:
Destination total:
Counting unit:
Payment authority:
Evidence:
Near-miss:
PASS:

6. Booking Confirmation Delay
Queue count:
Destination total:
SLA:
Evidence:
Near-miss:
PASS:

7. Recent Cancellations
Queue count:
Destination total:
Window:
Evidence:
Near-miss:
PASS:

Detector/action/destination parity:
Pagination parity:
i18n:
Security:
Tests:
Backend TSC:
Frontend TSC:

Commit:
HEAD:
origin/master:
HEAD == origin/master:
Unrelated files:

Remaining findings:
Next canonical stage:
```

---

# 31. VERDICT

Только при полном closure:

```text
VERDICT A — DECISION QUEUE FINAL RUNTIME SEMANTIC CLOSURE COMPLETE
```

Иначе:

```text
VERDICT B — DECISION QUEUE RUNTIME SEMANTICS STILL INCOMPLETE
```

---

# 32. STOP

После отчёта:

```text
STOP
```

Не запускать автоматически следующий Phase 3 stage.

Следующий canonical stage определяется только после review этого отчёта.
