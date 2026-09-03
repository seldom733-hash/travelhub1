# PHASE 3 --- STEP 3.5.3 --- PLATFORM CRM

## ROUND 2C.2 POST-CLOSURE --- CLEAN RUNTIME RESTART + VISUAL RE-VALIDATION

### PAYMENTS ↔ ACTIVITY CONSISTENCY CHECK

**Все ответы и итоговый отчёт --- строго на русском.**

------------------------------------------------------------------------

# 1. ЦЕЛЬ

Не начинать новый remediation round и **не менять production code**.

Сначала полностью перезапустить текущий TravelHub runtime после закрытия
Round 2C.1 / Round 2C.2 и повторно проверить наблюдаемое визуальное
расхождение:

``` text
Customer 360 → Payments
vs
Customer 360 → Activity → Payment
```

Round 2C.2 закрыл repository/data reconciliation с:

``` text
ORDER missing/wrong-customer   = 0
BOOKING missing/wrong-customer = 0
PAYMENT missing/wrong-customer = 0
REFUND missing/wrong-customer  = 0
Orphans                        = 0
Duplicates                     = 0
Cross-customer leakage         = 0
Payment code mismatches        = 0
```

Однако пользователь сообщает, что **визуально проблема после closure всё
ещё наблюдается**.

Поэтому runtime/browser является обязательным финальным authority для
этого check.

------------------------------------------------------------------------

# 2. ВАЖНО

На этом этапе запрещено:

``` text
исправлять код "на всякий случай"
создавать Round 2C.3 заранее
менять adapters
менять CrmActivity schema
запускать Round 2D
скрывать проблему CSS/UI workaround
```

Сначала требуется clean restart + deterministic reproduction.

------------------------------------------------------------------------

# 3. PRE-RESTART STATE

Перед остановкой runtime зафиксировать:

``` bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
```

Ожидаемый closure SHA:

``` text
a8627f0
```

Зафиксировать:

``` text
Branch:
HEAD:
origin/master:
HEAD == origin/master:
Worktree:
```

------------------------------------------------------------------------

# 4. ЗАФИКСИРОВАТЬ ТЕКУЩИЕ ПРОЦЕССЫ

Определить, как реально запущен проект:

``` text
Docker Compose?
Backend отдельно?
Frontend отдельно?
Несколько старых Node/Nest/Next процессов?
```

Проверить активные контейнеры/процессы и порты приложения.

Не убивать посторонние процессы.

------------------------------------------------------------------------

# 5. CLEAN RUNTIME RESTART

Выполнить **полный контролируемый restart именно текущего dev/runtime
окружения**.

Если backend/frontend работают в Docker Compose --- использовать
repository-defined compose workflow.

Типовой вариант:

``` bash
docker compose down
docker compose up -d --build
```

Но перед выполнением проверить actual compose configuration проекта.

Если frontend/backend запускаются отдельно --- корректно остановить
старые процессы и запустить заново repository-defined commands.

Не удалять volumes/database.

Запрещено без необходимости:

``` bash
docker compose down -v
docker system prune
удалять PostgreSQL volume
reseed/reset DB
```

Нам нужен тот же dataset, на котором наблюдалась проблема.

------------------------------------------------------------------------

# 6. RUNTIME HEALTH

После restart доказать, что поднялись именно свежие процессы.

Проверить:

``` text
Backend reachable
Frontend reachable
PostgreSQL reachable
Redis reachable if required
API responds
authentication/session works
Customer 360 opens
```

Зафиксировать actual ports/URLs.

------------------------------------------------------------------------

# 7. BROWSER CLEAN RELOAD

Открыть приложение заново.

Выполнить hard reload:

``` text
Ctrl + Shift + R
```

Если браузер всё ещё показывает подозрительно stale bundle/data,
допустимо проверить в новом Incognito/Private window.

Не очищать persistent application data без фиксации причины.

------------------------------------------------------------------------

# 8. REPRODUCE EXACT CUSTOMER CASE

Открыть **тот же Customer**, на котором пользователь видел mismatch.

Зафиксировать:

``` text
Customer visible code:
Customer canonical id:
Current route:
```

Нельзя подменять проверку другим случайным Customer только потому, что
там всё выглядит правильно.

------------------------------------------------------------------------

# 9. PAYMENTS TAB --- RUNTIME EVIDENCE

Открыть:

``` text
Customer 360 → Payments
```

Зафиксировать все visible Payment references/codes для этого Customer.

Особое внимание, если dataset всё ещё содержит:

``` text
PAY-00000557
PAY-00000616
PAY-00007001
```

Для visible rows зафиксировать минимум:

``` text
Payment code
Order code
Amount
Currency
Status
Date
```

------------------------------------------------------------------------

# 10. ACTIVITY TAB --- PAYMENT FILTER

В том же Customer без смены subject открыть:

``` text
Customer 360 → Activity
```

Установить:

``` text
Source = Payment
```

Зафиксировать все visible Payment references/codes.

Сравнить с canonical semantics Customer Payments.

------------------------------------------------------------------------

# 11. NETWORK AUTHORITY

Через browser DevTools Network или эквивалентный runtime trace
зафиксировать Activity request.

Нужно доказать:

``` text
route customerId
==
Activity API request customerId
```

Зафиксировать:

``` text
Request URL:
Customer ID in request:
sourceType:
HTTP status:
Returned Payment source IDs/codes:
```

------------------------------------------------------------------------

# 12. PAYMENTS API AUTHORITY

Зафиксировать request/API source, который использует Customer 360
Payments tab.

Доказать:

``` text
route customerId
==
Payments request subject
```

Зафиксировать returned payment IDs/codes.

------------------------------------------------------------------------

# 13. THREE-WAY COMPARISON

Сформировать таблицу:

  -------------------------------------------------------------------------------
  Payment             Payments  Activity API   Activity UI Canonical   Result
                       API/tab                             Customer    
  -------------- ------------- ------------- ------------- ----------- ----------
  PAY-00007001                                                         

  PAY-00000557                                                         

  PAY-00000616                                                         
  -------------------------------------------------------------------------------

Если конкретные codes отсутствуют в текущем неизменённом dataset ---
указать причину и перечислить actual records.

------------------------------------------------------------------------

# 14. IMPORTANT SEMANTIC CHECK

Round 2C.2 сообщил:

``` text
PAY-00007001 → CUS-00000089

PAY-00000557 → customerId=null
PAY-00000616 → customerId=null
```

Нужно проверить, **каким образом Customer 360 Payments tab определяет
принадлежность Payment Customer**.

Не считать автоматически:

``` text
payment.customerId = null
⇒ payment не принадлежит Customer
```

если Payments tab выводит его через canonical relationship:

``` text
Payment
→ Order
→ Customer
```

И наоборот, не считать Payment принадлежащим Customer только потому, что
он виден в UI.

Нужно установить actual authority используемую обеими поверхностями.

------------------------------------------------------------------------

# 15. CRITICAL QUESTION

Ответить доказательно:

> Почему Payments tab данного Customer показывает конкретный Payment, а
> Activity показывает другой набор Payment events?

Возможные категории root cause проверять, но **не выбирать заранее**:

``` text
stale pre-restart runtime
browser cache
frontend state leakage
stale async response
different subject authority
Payments API mapping
Activity API mapping
display-code mapping
legitimate difference in business semantics
другое
```

------------------------------------------------------------------------

# 16. A → B → A SUBJECT ISOLATION CHECK

Даже если после restart первоначальная проблема исчезла, выполнить
короткий navigation test:

``` text
Customer A → Activity/Payment
Customer B → Activity/Payment
Customer A → Activity/Payment
```

Для каждого шага проверить:

``` text
route customerId
Activity request customerId
rendered Payment references
```

Acceptance:

``` text
A не показывает B events
B не показывает A events
возврат B→A не оставляет stale B items
```

------------------------------------------------------------------------

# 17. ASYNC / STATE CHECK --- ТОЛЬКО ЕСЛИ ПРОБЛЕМА ВОСПРОИЗВОДИТСЯ

Если после clean restart mismatch остаётся, проверить frontend
implementation на:

``` text
dependency array по customerId
state reset при customerId change
cursor reset
filters state
AbortController
stale request cancellation
response race
cache/query key включает customerId
old items append после subject change
```

Но пока root cause не доказан --- production code не менять.

------------------------------------------------------------------------

# 18. DECISION GATE

## CASE A --- после restart проблема исчезла

Если:

``` text
correct Customer
correct API subject
correct Activity response
correct UI rendering
A→B→A isolation PASS
```

то зафиксировать:

``` text
POST-CLOSURE RUNTIME REVALIDATION PASS
```

Production code changes:

``` text
NONE
```

Round 2C.2 остаётся CLOSED.

------------------------------------------------------------------------

## CASE B --- после restart проблема остаётся

Если mismatch воспроизводится:

``` text
DO NOT declare resolved.
```

Собрать exact evidence:

``` text
Customer ID
route
Payments request/response
Activity request/response
visible Payments
visible Activity
A→B→A result
suspected layer
```

После этого:

``` text
VERDICT B — RUNTIME DEFECT REPRODUCED
```

И **STOP**.

Не исправлять автоматически в рамках этой задачи.

На основании доказанного слоя будет создан отдельный targeted
remediation prompt.

------------------------------------------------------------------------

# 19. NO DATA RESET

Для этой проверки особенно важно:

``` text
не reseed
не reset DB
не rebuild dataset
не удалять volumes
```

Иначе исходный визуальный finding может исчезнуть вместе с данными и
проверка потеряет смысл.

------------------------------------------------------------------------

# 20. NO ROADMAP ADVANCE

До завершения этой runtime re-validation:

``` text
Round 2D — НЕ НАЧИНАТЬ
```

Если проблема воспроизводится --- Round 2C.2 нельзя считать practically
closed для перехода дальше, несмотря на предыдущий evidence-only report.

------------------------------------------------------------------------

# 21. REQUIRED FINAL RESPONSE --- РУССКИЙ

``` text
VERDICT:

REPOSITORY
Branch:
HEAD:
origin/master:
HEAD == origin/master:
Worktree:

RUNTIME RESTART
Previous processes:
Restart method:
Database preserved:
Volumes preserved:
Backend:
Frontend:

CUSTOMER
Visible code:
Canonical ID:
Route:

PAYMENTS TAB
Request:
Returned IDs/codes:
Visible IDs/codes:

ACTIVITY / PAYMENT
Request:
Request customerId:
Returned IDs/codes:
Visible IDs/codes:

THREE-WAY COMPARISON
...

PAYMENT AUTHORITY
PAY-00007001:
PAY-00000557:
PAY-00000616:
Payments tab ownership rule:
Activity ownership rule:

A → B → A ISOLATION
A:
B:
A again:
Stale items:
Wrong subject requests:

ROOT CAUSE
Problem reproduced after restart:
Layer:
Evidence:

PRODUCTION CODE CHANGES
Backend:
Frontend:
Schema:
Migration:

FINAL DECISION
Round 2C.2:
Round 2D allowed:

NEXT:
```

------------------------------------------------------------------------

# 22. SUCCESS VERDICT

Только если проблема после clean restart не воспроизводится и A→B→A
isolation подтверждён:

``` text
VERDICT A — PHASE 3 STEP 3.5.3 /
ROUND 2C.2 POST-CLOSURE /
CLEAN RUNTIME RESTART + PAYMENTS ↔ ACTIVITY VISUAL RE-VALIDATION /
PASS
```

------------------------------------------------------------------------

# 23. FAILURE VERDICT

Если проблема остаётся:

``` text
VERDICT B — PHASE 3 STEP 3.5.3 /
ROUND 2C.2 POST-CLOSURE /
PAYMENTS ↔ ACTIVITY RUNTIME INCONSISTENCY REPRODUCED
```

В этом случае предоставить evidence и STOP.

Не начинать speculative remediation.

------------------------------------------------------------------------

# 24. STOP

После restart + deterministic browser/API re-validation:

**STOP.**

Не начинать Round 2D без подтверждённого PASS.
