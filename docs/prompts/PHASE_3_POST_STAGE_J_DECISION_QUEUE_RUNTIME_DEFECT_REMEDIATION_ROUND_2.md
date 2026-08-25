# PHASE 3 — POST-STAGE-J
# DECISION QUEUE RUNTIME DEFECT REMEDIATION — ROUND 2
## LIFECYCLE UI ELIGIBILITY + NAVIGATION HTTP 500 ROOT CAUSE + UPCOMING FILTER SEMANTICS
## PREVIOUS VERDICT A INVALIDATED BY REAL BROWSER RUNTIME
## BLOCKING GATE BEFORE CRM STEP 3.5

---

## 1. ЯЗЫК

Все ответы разработчика, findings, root-cause analysis, browser/network evidence, таблицы, тесты, отчёт и финальный VERDICT — **НА РУССКОМ ЯЗЫКЕ**.

Technical identifiers, routes, query params, DTO/enum names, code, commands, paths, SHA и commit messages можно оставлять в оригинале.

---

## 2. PREVIOUS VERDICT — INVALIDATED

Предыдущий отчёт заявил:

```text
VERDICT A — DECISION QUEUE RUNTIME FULLY RECONCILED
Lifecycle mutations → all work
Action targets      → all valid
404                 → 0
CRM Step 3.5         → READY
```

Реальная browser-проверка пользователя после этого обнаружила:

```text
Принять
→ Cannot acknowledge signal in status RESOLVED.
  Only OPEN signals can be acknowledged

Решить
→ Cannot resolve signal in status RESOLVED.

Отклонить
→ Cannot dismiss signal in status RESOLVED.

Открыть услуги
→ Internal server error

Проверить доступность
→ Internal server error

Открыть платежи
→ Internal server error

Открыть предстоящие
→ показывает около 100 бронирований,
  включая завершённые и исполняемые,
  вместо корректной upcoming-выборки
```

Следовательно:

```text
PREVIOUS VERDICT A = INVALIDATED
CRM Step 3.5 = BLOCKED
```

---

## 3. ЦЕЛЬ ROUND 2

Исправить конкретные подтверждённые runtime defects:

```text
A. Lifecycle UI показывает недопустимые actions для RESOLVED signals
B. Open Services → HTTP 500
C. Check Availability → HTTP 500
D. Open Payments → HTTP 500
E. Open Upcoming → неправильная выборка
F. Повторно browser-валидировать ВСЕ 7 Stage F actions
```

---

## 4. BACKEND VALIDATION ≠ DEFECT

Сообщение `Cannot acknowledge signal in status RESOLVED` указывает, что backend transition guard, вероятно, правильно запрещает переход.

Не ослаблять backend validation. Проверить primary defect:

```text
UI предлагает action, недопустимый для текущего signal status.
```

---

## 5. ЗАПРЕЩЁННЫЕ FIXES

Запрещено:

```text
разрешать terminal → active transitions только ради UI
проглатывать backend errors
считать inline error исправлением business defect
ловить HTTP 500 и объявлять PASS
показывать общий список вместо обещанного filtered context
создавать fake pages
удалять query/filter semantics только ради HTTP 200
ослаблять RBAC
начинать CRM Step 3.5
```

---

## 6. WORKTREE SAFETY

До изменений:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git diff --stat
git diff
```

Зафиксировать Starting HEAD, origin/master, modified/untracked. Последний известный commit предыдущего remediation: `e25012a`, но authority — фактический HEAD.

---

# TRACK A — LIFECYCLE UI ELIGIBILITY

## 7. CANONICAL LIFECYCLE

Определить из backend:

```text
Signal statuses:
Allowed transitions:
Terminal statuses:
Active statuses:
History statuses:
```

Не угадывать по UI.

## 8. TRANSITION MATRIX

| Current status | Acknowledge | Resolve | Dismiss |
|---|---:|---:|---:|
| OPEN | | | |
| ACKNOWLEDGED | | | |
| RESOLVED | | | |
| DISMISSED/REJECTED | | | |

Использовать фактические enum values.

## 9. UI MUST FOLLOW BACKEND AUTHORITY

Frontend eligibility mapping должен строго соответствовать backend transition rules и иметь regression tests. Не создавать независимую альтернативную state machine.

## 10. RESOLVED HARD GATE

Если backend запрещает lifecycle actions для `RESOLVED`, UI не должен предлагать активные:

```text
Принять
Решить
Отклонить
```

Использовать existing UX pattern: hidden либо disabled с корректной причиной.

## 11. NO REQUEST FOR IMPOSSIBLE TRANSITION

Для недопустимого action frontend не должен отправлять mutation request. Доказать через Network.

## 12. OPEN / ACKNOWLEDGED / TERMINAL

На fresh signals проверить все разрешённые transitions. Для terminal statuses проверить отсутствие запрещённых active buttons.

## 13. ACTIVE / HISTORY + COUNTERS

Проверить:

| Before | Action | After | Active/History | Reload |
|---|---|---|---|---:|

И counters:

```text
Открыт
Принято к сведению
Нарушен SLA
Активные (N)
История (N)
```

Counts должны следовать backend semantics, не frontend-only state.

## 14. PERSISTENCE

Для допустимых transitions:

```text
click → server mutation → reload → status preserved → correct tab/counters
```

## 15. ERROR UX

Controlled backend rejection не должен вызывать React Runtime Error overlay. Но улучшенный error handling не заменяет правильную eligibility.

---

# TRACK B — HTTP 500 ROOT CAUSE

## 16. CONFIRMED 500s

```text
Открыть услуги        → Internal server error
Проверить доступность → Internal server error
Открыть платежи       → Internal server error
```

## 17. CAPTURE ACTUAL 500 EVIDENCE

Для каждого:

| Action | Final URL | Failed request | HTTP | Response body | Backend exception |
|---|---|---|---:|---|---|
| Открыть услуги | | | 500 | | |
| Проверить доступность | | | 500 | | |
| Открыть платежи | | | 500 | | |

Снять browser Network + backend logs/stack. Не исправлять вслепую.

## 18. CLASSIFY EACH 500

Классифицировать отдельно:

```text
INVALID_QUERY_MAPPING
UNSUPPORTED_STATUS_VALUE
PRISMA_QUERY_DEFECT
DTO_VALIDATION_DEFECT
ENUM_MISMATCH
MISSING_RELATION
NULL_HANDLING
ROUTE_PAGE_FETCH_DEFECT
WORKSPACE_CONTEXT_DEFECT
OTHER
```

## 19. OPEN SERVICES

`Открыть услуги` должен вести в существующий Catalog/Services workflow.

Исторически было:

```text
/app/catalog?status=ACTIVE&unsold=true
```

Но unsupported params ранее удалены. Определить canonical feasible behavior из реальной архитектуры.

Label `Открыть услуги` допускает общий релевантный Catalog, если action contract не обещает фильтр, но страница обязана открываться без 500.

## 20. CHECK AVAILABILITY — STRONG PROMISE

`Проверить доступность` требует availability context.

Найти существующий:

```text
availability filter
availability state/column
service edit availability workflow
availability settings
```

Если capability есть — route туда. Если нет — не выдавать generic Catalog за проверку доступности: disable/remove action с documented dependency либо VERDICT C.

Не восстанавливать `availability=none` вслепую.

## 21. OPEN PAYMENTS

Определить, где в текущей архитектуре реально обрабатываются payments:

```text
Orders Center
Finance
Payments tab
Order details
Payment status filters
```

`Открыть платежи` не должен вести в generic Orders list без payment context, если там нельзя работать с failed payments.

Если существующего полноценного Payments Center нет — выбрать минимальный semantically honest existing destination, не создавая новый центр.

---

# TRACK C — UPCOMING BOOKINGS

## 22. CONFIRMED DEFECT

```text
Открыть предстоящие
→ около 100 бронирований
→ включая завершённые и исполняемые
```

Это FAIL.

## 23. DEFINE UPCOMING CANONICALLY

Найти semantics в:

```text
UPCOMING_BOOKINGS detector
Decision Signal evidence
Booking model
existing booking status/date rules
```

Сформулировать exact predicate. Не придумывать по названию.

## 24. SAME AUTHORITY

`UPCOMING_BOOKINGS` signal predicate и destination predicate не должны расходиться. По возможности использовать shared canonical semantics.

## 25. EXCLUSIONS

Определить по domain model, должны ли исключаться:

```text
COMPLETED
CANCELLED
past bookings
other terminal statuses
```

## 26. BROWSER HARD GATE

После fix:

```text
click "Открыть предстоящие"
→ active upcoming context
→ only canonical qualifying bookings
```

Вернуть:

```text
Decision Signal count:
Destination result count:
Predicate:
Included statuses:
Excluded statuses:
Earliest/latest booking:
```

## 27. CLIENT-SIDE FILTER WARNING

Предыдущий отчёт заявил `upcoming` client-side filtering. Проверить, не ломают ли это pagination/server limits. Если page получает только первые N records, client-only filter не может быть authority для полной upcoming-выборки.

При server pagination/filtering перенести predicate на соответствующий authority layer.

---

# TRACK D — ALL 7 STAGE F ACTIONS

## 28. FINAL INVENTORY

| Signal | Action |
|---|---|
| BOOKING_CONFIRMATION_DELAY | Открыть бронирования |
| FAILED_PAYMENTS | Открыть платежи |
| RECENT_CANCELLATIONS | Открыть заказы |
| PENDING_REFUNDS | Открыть возвраты |
| UPCOMING_BOOKINGS | Открыть предстоящие |
| SERVICES_WITHOUT_SALES | Открыть услуги |
| SERVICES_WITHOUT_SALES | Проверить доступность |

## 29. PENDING REFUNDS

Повторно browser-проверить `Открыть возвраты`. Generic Orders list без refund context недостаточен.

## 30. BOOKING DELAY

`Открыть бронирования`: generic Booking Center допустим, если это обещает label. Проверить route/page/RBAC/no 500.

## 31. RECENT CANCELLATIONS

`Открыть заказы`: generic Orders Center допустим, если action не обещает cancellation filter.

## 32. REAL CLICK ONLY

Каждый action нажать именно из Decision Queue, а не только открыть URL вручную.

## 33. FINAL ACTION MATRIX

| Signal | Action | URL | HTTP | Context/filter | Result count | Semantic PASS |
|---|---|---|---:|---|---:|---:|

Все 7 actions.

## 34. HARD GATES

```text
valid action 404 = 0
valid action 500 = 0
wrong-domain = 0
promised filtered context → correct dataset
```

---

# TRACK E — QUERY / SECURITY / LOCALIZATION

## 35. QUERY CONSUMPTION

Для query-based actions показать:

```text
URL → searchParams → normalized filter → API/server query → DB predicate → rendered result
```

## 36. UNKNOWN VALUES

Проверить invalid query values. Acceptance: no 500, no security bypass, controlled validation/fallback.

## 37. RBAC / TENANT / WORKSPACE

Backend остаётся authority. Проверить lifecycle mutation и destinations на RBAC, tenant/workspace scope и representative ID tampering.

## 38. LOCALIZATION

Проверить RU/AZ/EN для lifecycle eligibility, disabled reason/error feedback, action labels и active contexts.

Acceptance:

```text
raw i18n keys = 0
CJK = 0
mixed-language system text = 0
```

## 39. CONSOLE / NETWORK

После valid actions:

```text
unexpected Runtime Error overlay = 0
unexpected console errors = 0
unexpected valid-action 4xx/5xx = 0
```

Controlled negative transition tests могут возвращать canonical 4xx, но normal UI не должен предлагать такой transition.

---

# TRACK F — TESTS

## 40. LIFECYCLE ELIGIBILITY TESTS

Покрыть:

```text
OPEN actions
ACKNOWLEDGED actions
RESOLVED actions hidden/disabled
DISMISSED actions hidden/disabled
no request for forbidden transition
allowed mutation persistence
Active/History
counters
```

## 41. 500 REGRESSION TESTS

Для каждого исправленного 500 добавить regression test на primary root cause, а не только `page renders`.

## 42. UPCOMING TESTS

Покрыть:

```text
future qualifying booking included
completed excluded if canonical
cancelled excluded if canonical
past excluded
boundary date/time
tenant scope
pagination/server filtering correctness
```

## 43. FULL REGRESSION

После fix:

```text
Decision Queue tests
Command Center tests
affected backend tests
affected frontend tests
backend TSC
frontend TSC
backend build
frontend build
```

---

# 44. NO SCOPE CREEP

Не добавлять:

```text
CRM
new KPI
new Decision Signal
new AI logic
new Payments Center
new Availability Center
new Catalog architecture
```

если это не объективно обязательная prerequisite. При отсутствии capability — честно VERDICT C/dependency.

---

# 45. REPORT

Создать:

```text
docs/prompts/PHASE_3_POST_STAGE_J_DECISION_QUEUE_RUNTIME_DEFECT_REMEDIATION_ROUND_2_REPORT.md
```

Обязательно записать:

```text
Previous VERDICT A invalidated by subsequent real browser runtime.
```

---

# 46. REQUIRED DELIVERABLES

### A. Lifecycle matrix

| Status | Принять | Решить | Отклонить | UI behavior |
|---|---:|---:|---:|---|

### B. Lifecycle runtime

| Test | Request sent | HTTP | Status after | Tab | Reload | Result |
|---|---:|---:|---|---|---:|---:|

### C. 500 root causes

Для `Открыть услуги`, `Проверить доступность`, `Открыть платежи`:

```text
URL:
failed request:
response:
backend stack:
root cause:
fix:
```

### D. Upcoming

```text
Canonical predicate:
Signal count:
Destination count:
Included statuses:
Excluded statuses:
Date rule:
Server/client authority:
Browser evidence:
```

### E. All 7 actions

Полная matrix из раздела 33.

### F. Security

```text
Lifecycle RBAC:
Navigation RBAC:
Tenant isolation:
Workspace isolation:
ID tampering:
Filter scope:
```

### G. Tests

```text
Backend:
Frontend:
Lifecycle eligibility:
Lifecycle mutation:
500 regressions:
Upcoming:
Filters:
RBAC:
Isolation:
TSC:
Build:
Browser:
Network:
Console:
```

### H. Git

```text
Starting HEAD:
Final HEAD:
origin/master:
Files changed:
Migrations:
Commit:
Pushed:
HEAD == origin/master:
Working tree clean:
```

---

# 47. ACCEPTANCE CRITERIA

VERDICT A разрешён только если одновременно:

1. Canonical transition matrix доказана backend code.
2. UI eligibility соответствует backend.
3. RESOLVED/terminal signal не предлагает forbidden active lifecycle actions.
4. Allowed OPEN/ACKNOWLEDGED actions реально работают.
5. Forbidden normal-UI action не отправляет request.
6. Persistence after reload PASS.
7. Active/History PASS.
8. Counters PASS.
9. Error UX без Runtime Overlay.
10. Backend guards/RBAC сохранены.
11. Tenant/workspace isolation PASS.
12. ID tampering negative PASS.
13. `Открыть услуги` без 500 и semantically honest.
14. `Проверить доступность` без 500 и ведёт в реальный availability context, либо action честно unavailable с documented dependency.
15. `Открыть платежи` без 500 и соответствует label promise.
16. `Открыть предстоящие` показывает canonical upcoming dataset.
17. `Открыть возвраты` runtime verified.
18. `Открыть бронирования` runtime verified.
19. `Открыть заказы` runtime verified.
20. Все 7 actions clicked from Decision Queue.
21. Valid action 404 = 0.
22. Valid action 500 = 0.
23. Wrong-domain = 0.
24. Query params имеют real consumers.
25. Unsupported params не маскируются как working.
26. Upcoming signal/destination semantics reconciled.
27. Pagination/server limits не ломают upcoming.
28. RU/AZ/EN PASS.
29. Raw keys = 0.
30. CJK = 0.
31. Unexpected console errors = 0.
32. Unexpected valid-action 4xx/5xx = 0.
33. Backend/frontend regression green.
34. TSC clean.
35. Builds clean.
36. Report delivered.
37. Commit created and pushed.
38. HEAD == origin/master.
39. Working tree clean except documented unrelated pre-existing state.
40. CRM Step 3.5 NOT started.

---

# 48. FINAL VERDICT

Вернуть ровно один:

## VERDICT A — DECISION QUEUE RUNTIME DEFECTS ROUND 2 CLOSED / LIFECYCLE UI ELIGIBILITY RECONCILED / NAVIGATION 500s ELIMINATED / UPCOMING SEMANTICS VERIFIED / CRM STEP 3.5 READY

или:

## VERDICT B — DECISION QUEUE RUNTIME DEFECT REMEDIATION ROUND 2 INCOMPLETE

Обязательно разделить:

```text
Lifecycle eligibility:
OPEN:
ACKNOWLEDGED:
RESOLVED:
DISMISSED:
Active/History:
Counters:
Open Services:
Check Availability:
Open Payments:
Open Refunds:
Open Upcoming:
Open Bookings:
Open Orders:
Upcoming semantics:
RBAC:
Isolation:
Localization:
Tests:
Browser:
Network:
Git:
```

или:

## VERDICT C — BLOCKED / REQUIRED OPERATIONAL CAPABILITY DOES NOT EXIST

Указать:

```text
Missing capability:
Affected action:
Why it cannot be safely fabricated:
What action is disabled/removed:
Required roadmap prerequisite:
Recommended next step:
```

---

# 49. STOP

После VERDICT:

**STOP.**

CRM Step 3.5 автоматически не запускать.
