# PHASE 3 — POST-STAGE-J
# DECISION QUEUE ACTIONS & LIFECYCLE RUNTIME RECONCILIATION
## STAGE F NAVIGATION TARGETS / ACCEPT-RESOLVE-REJECT / ROUTE & FILTER VALIDATION
## BLOCKING CLOSURE BEFORE CRM STEP 3.5

---

# 1. ЯЗЫК

Все ответы разработчика, findings, browser evidence, root-cause analysis,
implementation notes, тесты, отчёт и финальный VERDICT должны быть предоставлены
**НА РУССКОМ ЯЗЫКЕ**.

Technical identifiers, code, routes, query params, permission IDs, commands,
paths, SHA и commit messages можно сохранять в оригинальном виде.

---

# 2. КОНТЕКСТ

Widget/Settings reconciliation уже закрыт отдельным Final Evidence Closure:

```text
Command Center ↔ WIDGET_REGISTRY ↔ Settings   COMPLETE
Registry entries                              48
Visible KPI                                   45
Trend widgets                                  3
Catalog Health                                6/6
Channel Health                                8/8
Stage I                                       4/4
Show/hide persistence                         PASS
Formatting ₼ / %                             PASS
RU/AZ/EN                                      PASS
HEAD == origin/master                         PASS
```

Этот prompt **НЕ должен повторно открывать Widget Registry remediation**, если
новый дефект непосредственно с ним не связан.

---

# 3. НОВЫЙ ПОДТВЕРЖДЁННЫЙ RUNTIME DEFECT

В Decision Queue Stage F action:

```text
Проверить доступность
```

перенаправляет, например, на:

```text
http://localhost:3000/products?status=ACTIVE&availability=none
```

После перехода пользователь получает:

```text
Страница не найдена
```

Следовательно:

```text
Stage F action contract exists
BUT
executionTarget is not runtime-valid
```

Это production/runtime defect.

---

# 4. ВАЖНО — НЕ ИСПРАВЛЯТЬ 404 ФИКТИВНОЙ СТРАНИЦЕЙ

Запрещено создавать пустую/заглушечную `/products` страницу только для того,
чтобы URL перестал возвращать 404.

Правильный порядок:

```text
1. Найти существующую архитектуру страниц/рабочих центров.
2. Найти canonical destination для действия.
3. Проверить, поддерживает ли destination нужный workflow/filter.
4. Только затем изменить action target.
```

Если нужного рабочего destination в продукте действительно нет:

```text
не фабриковать функциональность
```

Нужно либо:

- направить на ближайший семантически корректный существующий рабочий центр;
- либо временно disable/remove action;
- либо вернуть VERDICT C с dependency.

---

# 5. SECOND SCOPE — DECISION SIGNAL LIFECYCLE

В каждой карточке Decision Queue присутствуют:

```text
Принять
Решить
Отклонить
```

Не считать эти кнопки реализованными только потому, что они отображаются.

Нужно доказать actual lifecycle behavior.

---

# 6. НЕ ПУТАТЬ ДВА МЕХАНИЗМА

## Stage F ACTION

Например:

```text
Открыть бронирования
Открыть платежи
Открыть заказы
Открыть возвраты
Открыть предстоящие
Открыть услуги
Проверить доступность
```

Это:

```text
NAVIGATION_ONLY
```

и должно вести пользователя в реальный рабочий центр.

## Signal lifecycle

```text
Принять
Решить
Отклонить
```

Это изменение состояния самого Decision Signal.

Canonical invariant:

```text
signal lifecycle ≠ Stage F action lifecycle
```

---

# 7. BLOCKING STATUS

До завершения этого remediation:

```text
CRM Step 3.5 → PAUSE / DO NOT START
```

После доказанного VERDICT A:

```text
CRM Step 3.5 → READY
```

Но автоматически не запускать.

---

# 8. WORKTREE SAFETY FIRST

Перед изменениями:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git diff --stat
git diff
```

Зафиксировать:

```text
Starting HEAD:
origin/master:
Working tree:
Modified:
Untracked:
```

Ожидаемая исходная база после Final Evidence Closure:

```text
HEAD == origin/master
```

Если это не так — сначала объяснить состояние.

---

# 9. INVENTORY ALL DECISION SIGNAL TYPES

Проверить canonical signal types:

```text
BOOKING_CONFIRMATION_DELAY
FAILED_PAYMENTS
RECENT_CANCELLATIONS
PENDING_REFUNDS
UPCOMING_BOOKINGS
SERVICES_WITHOUT_SALES
```

Ожидается:

```text
6/6
```

---

# 10. INVENTORY ALL STAGE F ACTIONS

Снять фактический action contract из backend/API/runtime.

Ожидаемый исторический baseline:

| Signal | Action | Historical target |
|---|---|---|
| BOOKING_CONFIRMATION_DELAY | Открыть бронирования | `/bookings` |
| FAILED_PAYMENTS | Открыть платежи | `/payments` |
| RECENT_CANCELLATIONS | Открыть заказы | `/orders` |
| PENDING_REFUNDS | Открыть возвраты | `/payments?refundStatus=PENDING` |
| UPCOMING_BOOKINGS | Открыть предстоящие | `/bookings?upcoming=true` |
| SERVICES_WITHOUT_SALES | Открыть услуги | `/products` |
| SERVICES_WITHOUT_SALES | Проверить доступность | `/products?...availability=none` |

Это **baseline для проверки**, а не authority.

Actual application routes имеют приоритет.

---

# 11. ROUTE INVENTORY — MANDATORY

Снять реальные frontend routes приложения.

Не угадывать.

Найти фактические страницы для:

```text
Bookings
Payments
Orders
Services / Products / Catalog
Availability
Refunds
Upcoming bookings
```

Вернуть таблицу:

| Business destination | Existing route | Exists | Page loads | Notes |
|---|---|---:|---:|---|

---

# 12. ROUTER AUTHORITY

Проверить actual Next.js route tree:

```text
app/
pages/
route groups
locale prefixes
workspace prefixes
nested routes
```

Если приложение использует route prefix вроде:

```text
/admin/...
/platform/...
/dashboard/...
```

Stage F target обязан использовать canonical route.

---

# 13. BROWSER VALIDATION — NOT CODE-ONLY

Для каждого action target:

```text
click actual button
observe URL
observe destination page
observe browser/network status
```

Нельзя закрыть gate только unit tests.

---

# 14. HARD 404 GATE

Acceptance:

```text
Stage F action → 404 = 0
```

Любой action, который ведёт на `Страница не найдена`, блокирует VERDICT A.

---

# 15. HARD WRONG-DOMAIN GATE

Даже HTTP 200 недостаточно.

Пример:

```text
Проверить доступность
→ открывает generic dashboard
```

Это FAIL.

Destination должен быть семантически связан с действием.

---

# 16. QUERY PARAMETER CONTRACT

Для actions с query params проверить не только URL, но и реальное поведение.

Например:

```text
refundStatus=PENDING
upcoming=true
status=ACTIVE
availability=none
```

Для каждого параметра доказать:

```text
page reads parameter
filter applies
visible dataset changes/reflects filter
unknown parameter is not silently ignored
```

---

# 17. BOOKING_CONFIRMATION_DELAY

Action:

```text
Открыть бронирования
```

Проверить:

```text
target exists
page loads
booking center is correct
RBAC applies
```

Если возможно безопасно передать фильтр pending confirmation — определить,
поддерживается ли он уже существующей страницей.

Не добавлять новый фильтр только ради этого prompt, если он не нужен для
семантической корректности действия.

---

# 18. FAILED_PAYMENTS

Action:

```text
Открыть платежи
```

Проверить реальный Payments Center route.

Если страница поддерживает failed-status filter — можно использовать canonical
existing filter.

Не изобретать unsupported query.

---

# 19. RECENT_CANCELLATIONS

Action:

```text
Открыть заказы
```

Проверить Orders Center.

Если current target ведёт на несуществующий route — заменить canonical route.

---

# 20. PENDING_REFUNDS

Action:

```text
Открыть возвраты
```

Особенно проверить:

```text
refundStatus=PENDING
```

Если Payments page существует, но query игнорируется:

```text
Stage F action is only partially implemented
```

Исправить минимально, если filter capability уже соответствует архитектуре.

---

# 21. UPCOMING_BOOKINGS

Action:

```text
Открыть предстоящие
```

Проверить:

```text
upcoming=true
```

Если query не поддерживается — определить canonical existing filter/state.

---

# 22. SERVICES_WITHOUT_SALES — OPEN SERVICES

Action:

```text
Открыть услуги
```

Текущий `/products` не считать правильным, если route отсутствует.

Найти реальный центр управления услугами:

```text
Services
Catalog
Tours
Products
Inventory
или фактическое название в проекте
```

Использовать существующую архитектуру.

---

# 23. SERVICES_WITHOUT_SALES — CHECK AVAILABILITY

Action:

```text
Проверить доступность
```

Это отдельная semantic action.

Найти, существует ли реальный UI, где пользователь может:

```text
просмотреть availability
настроить availability
увидеть услуги без availability
```

---

# 24. AVAILABILITY DECISION TREE

Если полноценный existing destination есть:

```text
route action there
```

Если availability управляется внутри service details/edit page:

```text
route to that existing workflow
```

Если есть catalog list с поддерживаемым availability filter:

```text
route to filtered list
```

Если UI вообще отсутствует:

```text
НЕ создавать фиктивную страницу
НЕ оставлять broken button
```

В этом случае выбрать:

```text
disable/remove action + documented dependency
```

или VERDICT C, если action считается mandatory для Stage F closure.

---

# 25. NO FAKE FILTERS

Запрещено считать action исправленным только потому, что URL содержит:

```text
?availability=none
```

Если destination не читает этот параметр — FAIL.

---

# 26. ACTION CONTRACT AUTHORITY

Проверить backend Stage F contract:

```text
actionId
labelKey
executionType
executionTarget
requiredPermission
signal type
```

Не хранить frontend hardcoded replacement targets, если backend является
canonical action authority.

---

# 27. FRONTEND ROUTING

Frontend должен использовать contract безопасно.

Проверить:

```text
internal navigation
locale handling
workspace handling
query preservation
no malformed URLs
```

---

# 28. PORT / ORIGIN CHECK

Отдельно проверить, почему observed URL:

```text
http://localhost:3000/products...
```

ведёт на страницу UI/404.

Если frontend фактически работает на другом port/origin или через proxy,
проверить, не строится ли absolute URL неправильно.

Stage F internal navigation не должна случайно отправлять пользователя на
backend origin.

---

# 29. INTERNAL ROUTES SHOULD PREFER RELATIVE NAVIGATION

Если это Next.js internal route, предпочтительно:

```text
router.push("/...")
```

или canonical routing abstraction.

Не hardcode:

```text
http://localhost:3000
```

если архитектура приложения этого не требует.

---

# 30. ENVIRONMENT-INDEPENDENT ROUTING

Action navigation должна работать:

```text
localhost
Vercel/production
other host
```

Без environment-specific host hardcoding.

---

# 31. LIFECYCLE — DETERMINE ACTUAL MODEL

Проверить существующие:

```text
DecisionSignal status enum
database fields
API endpoints
service methods
audit/event fields
```

Не придумывать новый lifecycle, если он уже существует.

---

# 32. EXPECTED LIFECYCLE SEMANTICS

Определить из existing architecture точные statuses.

Conceptually:

```text
OPEN
ACKNOWLEDGED
RESOLVED
REJECTED/DISMISSED
```

Но использовать **фактические canonical enum values проекта**.

---

# 33. `ПРИНЯТЬ`

Доказать:

```text
button click
→ backend mutation
→ persisted status
→ actor/user captured if architecture supports it
→ timestamp captured
→ counters update
→ survives reload
```

---

# 34. `РЕШИТЬ`

Доказать:

```text
button click
→ backend mutation
→ signal leaves active queue if canonical behavior
→ appears in History if canonical behavior
→ counters update
→ survives reload
```

---

# 35. `ОТКЛОНИТЬ`

Доказать canonical meaning.

Не предполагать, что:

```text
Отклонить = delete
```

Проверить existing model.

Ожидается non-destructive lifecycle transition.

---

# 36. NO HARD DELETE

Decision signal lifecycle action не должна физически удалять signal/evidence,
если canonical architecture не требует этого явно.

Traceability должна сохраняться.

---

# 37. ACTIVE / HISTORY

Current UI имеет:

```text
Активные
История
```

Проверить реальный transition.

Вернуть matrix:

| Lifecycle action | Before tab | After status | After tab |
|---|---|---|---|

---

# 38. COUNTERS

Проверить:

```text
Открыт
Принято к сведению
Нарушен SLA
Активные (N)
История (N)
```

После lifecycle mutations counters должны соответствовать canonical definitions.

---

# 39. COUNTER SEMANTICS

Не менять counters ad hoc ради визуального результата.

Сначала определить backend semantics каждого counter.

---

# 40. RELOAD PERSISTENCE

Для каждой из 3 lifecycle actions:

```text
perform mutation
reload page
status remains
tab membership remains
counter remains correct
```

---

# 41. API PERSISTENCE

Browser-only local state не принимается.

Mutation должна быть server-side persisted, если lifecycle architecture
предполагает persistence.

---

# 42. RBAC — LIFECYCLE

Проверить permission для:

```text
acknowledge
resolve
reject/dismiss
```

Если сейчас используется общий permission — документировать.

Unauthorized role:

```text
backend denies mutation
```

---

# 43. RBAC — NAVIGATION ACTION

`requiredPermission` из Stage F contract должен реально соответствовать
destination.

Нельзя показывать working action, если destination гарантированно запрещён
текущей роли без корректного UX handling.

---

# 44. TENANT / WORKSPACE ISOLATION

Decision Signal и lifecycle mutation должны оставаться в текущем:

```text
workspace
tenant/partner scope
```

Нельзя изменить чужой signal через ID tampering.

---

# 45. AUDITABILITY

Проверить существующую audit architecture.

Если lifecycle уже хранит:

```text
updatedBy
acknowledgedBy
resolvedBy
timestamps
events
```

доказать заполнение.

Если отдельного audit trail в canonical model нет:

не строить большой новый audit subsystem в этом remediation.

Но обязательно сохранить минимум существующей traceability.

---

# 46. IDEMPOTENCY / REPEATED CLICK

Проверить повторный click:

```text
double acknowledge
double resolve
double reject
```

Не должно быть:

```text
500
duplicate event corruption
invalid counter drift
```

---

# 47. INVALID TRANSITIONS

Проверить минимум:

```text
resolved → resolve again
rejected → acknowledge
resolved → reject
```

Поведение должно быть deterministic.

---

# 48. CONCURRENCY

Не требуется строить новый distributed locking subsystem.

Но mutation service не должен очевидно допускать неконсистентный статус при
обычных concurrent requests.

Если используется optimistic/transactional existing mechanism — сохранить.

---

# 49. ERROR UX

Если lifecycle mutation fails:

```text
не показывать успешный локальный status
```

Пользователь должен получить корректный error feedback по существующему UX
pattern.

---

# 50. NAVIGATION ERROR UX

Broken route не должен оставаться clickable.

Если action временно unavailable:

```text
disabled/hidden according to architecture
```

с локализованным объяснением, если UI pattern это поддерживает.

---

# 51. LOCALIZATION

Все action labels и lifecycle labels проверить RU/AZ/EN:

```text
Открыть услуги
Проверить доступность
Открыть бронирования
Открыть платежи
Открыть заказы
Открыть возвраты
Открыть предстоящие

Принять
Решить
Отклонить
```

Acceptance:

```text
raw i18n keys = 0
mixed language = 0
CJK = 0
```

---

# 52. BROWSER MATRIX — STAGE F

Вернуть:

| Signal | Action | Final target | HTTP/page | Filter applied | Semantic destination | Result |
|---|---|---|---:|---:|---:|---:|

Все actions.

---

# 53. BROWSER MATRIX — LIFECYCLE

На безопасных test/seed signals выполнить:

| Action | Mutation | Status | Counter | Tab move | Reload | Result |
|---|---:|---|---:|---:|---:|---:|
| Принять | | | | | | |
| Решить | | | | | | |
| Отклонить | | | | | | |

Не повреждать production-like important data; использовать подходящие test/seed
records.

---

# 54. DATA RESET / TEST HYGIENE

Если browser lifecycle test меняет seed/runtime data:

описать изменения.

При необходимости использовать isolated test data или deterministic seed reset.

Не оставлять database в случайном неконсистентном состоянии.

---

# 55. AUTOMATED TESTS — ACTION DERIVATION

Добавить/обновить tests для всех 6 signal types и всех action targets.

Проверять не только string URL, но canonical route mapping contract, где это
возможно.

---

# 56. AUTOMATED TESTS — FILTER CONTRACT

Для:

```text
pending refunds
upcoming bookings
services availability
```

если соответствующие filters существуют, добавить regression tests, что page
реально consumes query param.

---

# 57. AUTOMATED TESTS — LIFECYCLE

Покрыть:

```text
acknowledge
resolve
reject/dismiss
persistence
invalid transitions
RBAC denial
tenant/workspace denial
```

в пределах существующей architecture.

---

# 58. NO FABRICATION

Не добавлять:

```text
AI recommendation
auto-resolution
auto-refund
auto-booking confirmation
automatic destructive action
```

Этот remediation только:

```text
navigation correctness
signal lifecycle correctness
```

---

# 59. NO NEW BUSINESS CENTERS

Не создавать новый:

```text
Products Center
Availability Center
Refund Center
```

если roadmap этого ещё не предусматривает.

Использовать существующие рабочие центры.

---

# 60. DO NOT START CRM

В рамках prompt:

```text
CRM Step 3.5 = untouched
```

---

# 61. REPORT

Создать:

```text
docs/prompts/PHASE_3_POST_STAGE_J_DECISION_QUEUE_ACTIONS_LIFECYCLE_RUNTIME_RECONCILIATION_REPORT.md
```

Полностью на русском.

---

# 62. REQUIRED DELIVERABLE A — ROOT CAUSE

Отдельно для confirmed `/products` 404:

```text
Observed URL:
Actual route:
Root cause:
Fix:
Browser evidence:
```

---

# 63. REQUIRED DELIVERABLE B — ROUTE INVENTORY

| Destination | Existing canonical route | Source file | Browser verified |
|---|---|---|---:|

---

# 64. REQUIRED DELIVERABLE C — ALL ACTIONS

Полная Stage F matrix из раздела 52.

---

# 65. REQUIRED DELIVERABLE D — FILTERS

```text
refundStatus=PENDING:
upcoming=true:
availability filter:
other action filters:
```

Для каждого:

```text
supported / replaced / removed / blocked
```

---

# 66. REQUIRED DELIVERABLE E — LIFECYCLE ARCHITECTURE

```text
Canonical statuses:
DB fields:
API endpoints:
Service methods:
Permissions:
Audit fields/events:
Active definition:
History definition:
```

---

# 67. REQUIRED DELIVERABLE F — LIFECYCLE RUNTIME

Matrix из раздела 53.

---

# 68. REQUIRED DELIVERABLE G — SECURITY

```text
Lifecycle RBAC:
Action RBAC:
Tenant isolation:
Workspace isolation:
ID tampering negative:
```

---

# 69. REQUIRED DELIVERABLE H — LOCALIZATION

```text
RU:
AZ:
EN:
raw keys:
CJK:
mixed-language:
```

---

# 70. REQUIRED DELIVERABLE I — TESTS

```text
New/updated backend tests:
New/updated frontend tests:
Action derivation:
Route/filter:
Lifecycle:
RBAC:
Isolation:
TSC:
Build:
Browser:
Console:
Network:
```

---

# 71. REQUIRED DELIVERABLE J — GIT

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

# 72. MIGRATION POLICY

Не запрещать migration искусственно.

Если lifecycle persistence fields объективно отсутствуют и canonical behavior
невозможен без них:

1. доказать gap;
2. выполнить минимальную безопасную migration;
3. проверить backward compatibility.

Но сначала использовать существующую модель, если она уже поддерживает lifecycle.

---

# 73. ACCEPTANCE CRITERIA — STAGE F ACTIONS

VERDICT A требует:

1. Все 6 signal types audited.
2. Все Stage F actions inventoried.
3. Все action targets соответствуют existing routes.
4. 404 actions = 0.
5. Wrong-domain actions = 0.
6. Internal navigation environment-independent.
7. No localhost hardcoding.
8. Query filters реально поддерживаются либо корректно заменены/удалены.
9. `Открыть услуги` ведёт в реальный service/catalog workflow.
10. `Проверить доступность` ведёт в реальный availability-capable workflow либо action корректно disabled/removed с доказанной dependency.
11. Pending refund action semantically works.
12. Upcoming booking action semantically works.
13. All actions browser verified.
14. Action RBAC preserved.

---

# 74. ACCEPTANCE CRITERIA — LIFECYCLE

VERDICT A требует:

15. Canonical lifecycle определён из кода/DB.
16. `Принять` выполняет реальную persisted mutation.
17. `Решить` выполняет реальную persisted mutation.
18. `Отклонить` выполняет реальную persisted mutation.
19. Reload persistence PASS.
20. Active/History behavior PASS.
21. Counters remain semantically correct.
22. No hard delete unless explicitly canonical.
23. Invalid transitions deterministic.
24. Repeated clicks do not corrupt state.
25. Backend RBAC enforced.
26. Tenant/workspace isolation enforced.
27. ID tampering negative PASS.
28. Error UX does not fake success.
29. Existing audit/traceability preserved.
30. Browser runtime verified.

---

# 75. ACCEPTANCE CRITERIA — GENERAL

31. RU/AZ/EN PASS.
32. Raw i18n keys = 0.
33. CJK = 0.
34. Mixed-language system labels = 0.
35. Unexpected browser console errors = 0.
36. Unexpected API 4xx/5xx on valid actions = 0.
37. Automated regression green.
38. TSC clean.
39. Build clean.
40. Report delivered.
41. Changes committed.
42. Changes pushed.
43. HEAD == origin/master.
44. Working tree clean except explicitly documented unrelated state.
45. CRM Step 3.5 not started.

---

# 76. FINAL VERDICT

Вернуть ровно один:

## VERDICT A — DECISION QUEUE ACTIONS & LIFECYCLE RUNTIME RECONCILED / STAGE F NAVIGATION VERIFIED / SIGNAL LIFECYCLE VERIFIED / CRM STEP 3.5 READY

или:

## VERDICT B — DECISION QUEUE ACTIONS / LIFECYCLE REMEDIATION INCOMPLETE

Обязательно разделить:

```text
Routes:
Stage F actions:
Filters:
Services:
Availability:
Lifecycle:
Active/History:
Counters:
Persistence:
RBAC:
Isolation:
Localization:
Tests:
Browser:
Git:
```

или:

## VERDICT C — BLOCKED / REQUIRED DESTINATION OR LIFECYCLE AUTHORITY DOES NOT EXIST

Для VERDICT C обязательно указать:

```text
Missing capability:
Why it cannot be safely fabricated:
Roadmap/dependency:
Which action/lifecycle operation remains blocked:
Recommended next prerequisite:
```

---

# 77. STOP

После VERDICT:

**STOP.**

CRM Step 3.5 автоматически не запускать.
