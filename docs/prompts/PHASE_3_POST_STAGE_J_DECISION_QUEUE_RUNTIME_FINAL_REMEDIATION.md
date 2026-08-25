# PHASE 3 — POST-STAGE-J
# DECISION QUEUE RUNTIME REMEDIATION — FINAL
## STAGE F ACTION FILTER SEMANTICS + LIFECYCLE HTTP 400 ROOT-CAUSE FIX
## BLOCKING GATE BEFORE CRM STEP 3.5

---

# 1. ЯЗЫК

Все ответы разработчика, findings, root-cause analysis, browser/runtime evidence,
таблицы, тесты, отчёт и финальный VERDICT — **НА РУССКОМ ЯЗЫКЕ**.

Technical identifiers, routes, query params, DTO names, enum values, code,
commands, paths, SHA и commit messages можно оставлять в оригинале.

---

# 2. СТАТУС И ПРИОРИТЕТ

Предыдущий узкий prompt:

```text
STAGE F ACTION FILTER SEMANTIC EVIDENCE CLOSURE
```

был **ОСТАНОВЛЕН**.

Его отдельно не продолжать.

Этот prompt полностью заменяет его и объединяет:

```text
A. Stage F navigation/filter semantic remediation
B. Decision Signal lifecycle HTTP 400 root-cause remediation
```

До завершения:

```text
CRM Step 3.5 → BLOCKED / DO NOT START
```

---

# 3. ПОДТВЕРЖДЁННЫЙ RUNTIME DEFECT №1 — LIFECYCLE

В реальном browser runtime кнопки:

```text
Принять
Решить
Отклонить
```

выдают ошибку:

```text
Runtime Error

Action failed: 400

components/command-center/SectionGrid.tsx:312:32
components/command-center/DecisionQueue.tsx:226:9
```

Observed frontend code:

```ts
credentials: "include",
});

if (!res.ok) throw new Error(`Action failed: ${res.status}`);
```

Следовательно предыдущая декларация:

```text
acknowledge/resolve/dismiss verified
```

**ОПРОВЕРГНУТА реальным runtime evidence**.

Текущий статус:

```text
Acknowledge → BROKEN / HTTP 400
Resolve     → BROKEN / HTTP 400
Dismiss     → BROKEN / HTTP 400
```

---

# 4. ПОДТВЕРЖДЁННЫЙ RUNTIME DEFECT №2 — ACTION SEMANTICS

После предыдущего remediation 404 были устранены:

```text
/products  → /app/catalog
/payments  → /app/orders
/bookings  → /app/bookings
/orders    → /app/orders
```

Но route existence недостаточно.

Для `SERVICES_WITHOUT_SALES` сейчас используются:

```text
Открыть услуги
→ /app/catalog?status=ACTIVE&unsold=true

Проверить доступность
→ /app/catalog?status=ACTIVE&availability=none
```

При визуальной проверке обе ссылки выглядят как обычный список:

```text
Опубликованные
```

Нужно доказать либо исправить реальное применение `unsold` и `availability`.

---

# 5. ГЛАВНЫЕ ИНВАРИАНТЫ

```text
HTTP 200 ≠ working action
Query param in URL ≠ applied filter
Visible lifecycle button ≠ working lifecycle
Frontend local state ≠ persisted lifecycle
No thrown frontend error ≠ successful backend mutation
```

---

# 6. ЗАПРЕЩЁННЫЕ "ИСПРАВЛЕНИЯ"

Запрещено:

```text
удалять if (!res.ok)
проглатывать HTTP 400
показывать success при failed mutation
hardcode frontend status without backend persistence
создавать fake /products page
создавать фиктивные filters только для теста
менять button labels для маскировки неверного destination
ослаблять DTO validation без root cause
отключать RBAC ради прохождения теста
```

---

# 7. WORKTREE SAFETY FIRST

Перед изменениями:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
git diff --stat
git diff
```

Вернуть:

```text
Starting HEAD:
origin/master:
Working tree:
Modified:
Untracked:
```

Последний известный lifecycle/navigation commit:

```text
4467e34
```

Но использовать фактический текущий HEAD как authority.

---

# 8. FIRST PRIORITY — CAPTURE ACTUAL 400 RESPONSE

Не начинать исправление с предположений.

Для каждой кнопки:

```text
Принять
Решить
Отклонить
```

снять через browser Network/API:

```text
HTTP method
request URL
request body
request headers relevant to contract
response status
response body
backend error/message
signal ID
current signal status
workspace/tenant context
```

---

# 9. REQUIRED 400 MATRIX

Вернуть до исправления:

| UI action | Method | Endpoint | Request body | Current status | HTTP | Response body |
|---|---|---|---|---|---:|---|
| Принять | | | | | 400 | |
| Решить | | | | | 400 | |
| Отклонить | | | | | 400 | |

Если не все три дают 400 после fresh reproduction — зафиксировать фактическое поведение.

---

# 10. TRACE FRONTEND REQUEST

Проследить:

```text
DecisionQueue.tsx
→ handleAction
→ SectionGrid.tsx onAction
→ fetch
→ URL
→ method
→ payload
```

Проверить:

```text
action value
signal ID
status/action enum
body shape
Content-Type
credentials
workspace context
```

---

# 11. TRACE BACKEND CONTRACT

Найти фактический backend endpoint:

```text
controller
route
HTTP method
DTO
ValidationPipe
service method
repository/Prisma mutation
```

Вернуть:

```text
Controller:
Endpoint:
Method:
DTO:
Allowed values:
Service:
Persistence model:
```

---

# 12. FRONTEND ↔ BACKEND CONTRACT DIFF

Сделать exact diff:

| Contract field | Frontend sends | Backend expects | Match |
|---|---|---|---:|
| endpoint | | | |
| method | | | |
| signal ID | | | |
| action/status | | | |
| body | | | |
| content type | | | |
| workspace | | | |

Не исправлять до выявления mismatch/root cause.

---

# 13. CHECK DTO / VALIDATION

Особенно проверить:

```text
string enum mismatch
ACKNOWLEDGE vs ACKNOWLEDGED
RESOLVE vs RESOLVED
DISMISS vs DISMISSED
REJECT vs REJECTED
case mismatch
missing body property
unexpected body property
UUID validation
empty body
wrong Content-Type
```

Использовать только фактические canonical enum values проекта.

---

# 14. CHECK ROUTE PARAMETER

Проверить, что frontend отправляет именно canonical identifier:

```text
DecisionSignal.id
```

а не:

```text
signal type
object ID
evidence ID
queue index
ruleId
```

---

# 15. CHECK CURRENT STATUS / TRANSITION RULES

Определить actual lifecycle model.

Вернуть:

```text
Canonical statuses:
Allowed transitions:
Forbidden transitions:
Active statuses:
History statuses:
```

Не придумывать новую state machine, если существующая уже есть.

---

# 16. DETERMINE ROOT CAUSE CLASSIFICATION

Классифицировать 400, например:

```text
FRONTEND_BACKEND_CONTRACT_MISMATCH
DTO_ENUM_MISMATCH
INVALID_TRANSITION
WRONG_SIGNAL_IDENTIFIER
MISSING_CONTEXT
VALIDATION_DEFECT
STALE_SIGNAL_STATE
OTHER
```

Указать один primary root cause и secondary causes, если есть.

---

# 17. FIX AT AUTHORITY LAYER

Исправление должно быть в правильном слое.

Пример:

```text
frontend sends wrong enum
→ fix frontend mapping

backend DTO contradicts canonical lifecycle enum
→ fix DTO/backend contract

wrong endpoint
→ fix frontend API target

service transition wrong
→ fix service/state machine
```

Не дублировать authority.

---

# 18. LIFECYCLE SEMANTICS — ПРИНЯТЬ

После fix доказать:

```text
click "Принять"
→ successful backend mutation
→ canonical acknowledged state
→ persisted
→ UI updates
→ counter updates according to semantics
→ reload
→ state remains
```

---

# 19. LIFECYCLE SEMANTICS — РЕШИТЬ

После fix:

```text
click "Решить"
→ successful backend mutation
→ canonical resolved state
→ signal moves to History if canonical
→ counters update
→ reload persistence
```

---

# 20. LIFECYCLE SEMANTICS — ОТКЛОНИТЬ

Определить canonical meaning:

```text
dismiss / reject / other existing state
```

После fix:

```text
click
→ persisted non-destructive transition
→ correct Active/History behavior
→ counters update
→ reload persistence
```

---

# 21. NO HARD DELETE

`Отклонить` не должно физически удалять Decision Signal/evidence, если existing
canonical architecture явно этого не требует.

Traceability должна сохраняться.

---

# 22. ACTIVE / HISTORY

Проверить actual UI:

```text
Активные
История
```

Вернуть:

| Action | Before status/tab | After status | After tab | Reload |
|---|---|---|---|---:|
| Принять | | | | |
| Решить | | | | |
| Отклонить | | | | |

---

# 23. COUNTERS

Проверить после каждой mutation:

```text
Открыт
Принято к сведению
Нарушен SLA
Активные (N)
История (N)
```

Не менять definitions ad hoc.

Сначала определить backend semantics counters.

---

# 24. PERSISTENCE HARD GATE

Для всех 3 действий:

```text
mutation succeeds
→ page reload
→ state remains correct
```

Если после reload состояние возвращается:

```text
FAIL
```

---

# 25. REPEATED CLICK / IDEMPOTENCY

Проверить:

```text
Принять ×2
Решить ×2
Отклонить ×2
```

Acceptance:

```text
no 500
no counter drift
no duplicate corruption
deterministic response
```

---

# 26. INVALID TRANSITIONS

Проверить минимум:

```text
resolved → resolve again
resolved → dismiss
dismissed → acknowledge
```

Использовать canonical allowed transitions.

Ожидается controlled 4xx или idempotent response, но не 500/corruption.

---

# 27. ERROR UX

Если mutation действительно запрещена:

```text
UI не должен падать Runtime Error overlay
```

Использовать существующий application error UX:

```text
toast
inline message
или другой canonical pattern
```

При этом backend error нельзя скрывать от диагностики.

---

# 28. RBAC — LIFECYCLE

Проверить backend authorization для lifecycle mutation.

Unauthorized role:

```text
cannot acknowledge
cannot resolve
cannot dismiss
```

если permission model этого требует.

Frontend visibility не является security authority.

---

# 29. TENANT / WORKSPACE ISOLATION

Проверить ID tampering:

```text
user in workspace A
→ cannot mutate signal belonging to workspace B
```

---

# 30. AUDIT / TRACEABILITY

Проверить существующие fields/events:

```text
updatedAt
acknowledgedAt
resolvedAt
dismissedAt
actor/user
audit event
```

Не строить новый большой audit subsystem, если его нет.

Но существующую traceability не потерять.

---

# 31. SECOND TRACK — ALL 7 STAGE F ACTIONS

Проверить:

| Signal | Action |
|---|---|
| BOOKING_CONFIRMATION_DELAY | Открыть бронирования |
| FAILED_PAYMENTS | Открыть платежи |
| RECENT_CANCELLATIONS | Открыть заказы |
| PENDING_REFUNDS | Открыть возвраты |
| UPCOMING_BOOKINGS | Открыть предстоящие |
| SERVICES_WITHOUT_SALES | Открыть услуги |
| SERVICES_WITHOUT_SALES | Проверить доступность |

---

# 32. LABEL PROMISE RULE

Semantic correctness определяется label.

```text
"Открыть заказы"
→ generic Orders Center может быть допустим

"Открыть бронирования"
→ generic Booking Center может быть допустим

"Открыть предстоящие"
→ generic Booking Center без upcoming context НЕ допустим

"Открыть возвраты"
→ generic Orders Center без refund context НЕ допустим

"Открыть платежи"
→ generic Orders Center без payment context требует доказательства

"Проверить доступность"
→ generic Catalog без availability context НЕ допустим
```

---

# 33. CATALOG BASELINE

Сравнить:

```text
A. /app/catalog?status=ACTIVE
B. /app/catalog?status=ACTIVE&unsold=true
C. /app/catalog?status=ACTIVE&availability=none
```

Вернуть:

| State | Query consumed | Active filter/context | API/query | Result count |
|---|---:|---|---|---:|
| ACTIVE | | | | |
| UNSOLD | | | | |
| NO AVAILABILITY | | | | |

---

# 34. `unsold=true` HARD GATE

Доказать:

```text
searchParams reads unsold
→ filter state
→ API/query predicate
→ rendered dataset
```

`unsold=true` должен соответствовать той же business semantics, что:

```text
SERVICES_WITHOUT_SALES
```

---

# 35. `availability=none` HARD GATE

Доказать:

```text
searchParams reads availability
→ "none" recognized
→ filter state
→ API/query predicate
→ services without configured availability
```

---

# 36. SAME DATASET MAY BE VALID

Ранее наблюдалось:

```text
31 без продаж
31 без доступности
0 с доступностью
```

Поэтому B и C могут возвращать одинаковый список.

Это PASS только если доказано:

```text
different semantic predicates
different filter state
both params consumed
```

---

# 37. VISUAL CONTEXT

Если оба результата выглядят просто как:

```text
Опубликованные
```

проверить существующий UX filter state.

Пользователь должен иметь возможность понять, что action применил:

```text
Без продаж
```

или:

```text
Без доступности
```

Не строить большой новый UX; минимально использовать существующую filter system.

---

# 38. FAILED PAYMENTS

Проверить final route после:

```text
/payments → /app/orders
```

Action label:

```text
Открыть платежи
```

Нужно доказать:

```text
/app/orders
→ имеет реальный payment/failure operational context
```

Если открывается просто общий список заказов:

```text
FAIL
```

если label обещает именно платежи.

---

# 39. PENDING REFUNDS

Action:

```text
Открыть возвраты
```

Доказать реальный refund pending context/filter.

Query param в URL без consumer = FAIL.

---

# 40. UPCOMING BOOKINGS

Action:

```text
Открыть предстоящие
```

Доказать реальный upcoming filter/context.

---

# 41. BOOKING CONFIRMATION DELAY

Action:

```text
Открыть бронирования
```

Generic Booking Center допустим, если именно это обещает label и contract.

Если target содержит filter — проверить его.

---

# 42. RECENT CANCELLATIONS

Action:

```text
Открыть заказы
```

Generic Orders Center допустим по label promise rule, если contract не обещает
отдельный cancellation filter.

---

# 43. QUERY CONSUMPTION TRACE

Для query-based actions показать:

```text
executionTarget
→ navigation
→ searchParams
→ filter state
→ API request / client selector
→ backend predicate if applicable
→ rendered result
```

---

# 44. NO URL-ONLY TEST

Недостаточно:

```ts
expect(target).toContain("unsold=true");
```

Нужны consumer-side regression tests.

---

# 45. FILTER SECURITY

Query params не должны обходить:

```text
RBAC
tenant scope
workspace scope
```

---

# 46. UNKNOWN QUERY VALUES

Проверить безопасно:

```text
unsold=garbage
availability=garbage
upcoming=garbage
refundStatus=garbage
```

Acceptance:

```text
no 500
no security bypass
deterministic fallback/validation
```

---

# 47. BROWSER ACTION MATRIX

Все 7 actions реально нажать из Decision Queue.

Вернуть:

| Signal | Action | Final URL | Page | Active context/filter | Result | PASS |
|---|---|---|---|---|---:|---:|

---

# 48. BROWSER LIFECYCLE MATRIX

После fix:

| Button | Request | HTTP | Persisted status | Counter | Tab | Reload | PASS |
|---|---|---:|---|---:|---|---:|---:|
| Принять | | | | | | | |
| Решить | | | | | | | |
| Отклонить | | | | | | | |

---

# 49. NETWORK EVIDENCE

Для lifecycle:

```text
request + response body
```

до и после fix.

Для navigation filters:

```text
API request/query/filter evidence
```

---

# 50. CONSOLE

Acceptance after remediation:

```text
Action failed: 400 runtime overlay = 0
unexpected console errors = 0
```

Controlled validation errors in explicit negative tests должны обрабатываться
нормальным UX, а не crash overlay.

---

# 51. DATA HYGIENE

Lifecycle browser tests меняют state.

Использовать:

```text
isolated test signals
seed signals
deterministic reset
```

Не оставлять dataset случайно повреждённым.

---

# 52. AUTOMATED TESTS — LIFECYCLE

Обязательно покрыть:

```text
acknowledge success
resolve success
dismiss success
persistence
repeated action
invalid transition
RBAC denial
workspace/tenant denial
frontend request contract
error UX
```

---

# 53. AUTOMATED TESTS — FILTERS

Покрыть consumer semantics:

```text
unsold=true
availability=none
upcoming
pending refunds
failed payments context
```

только там, где action contract это требует.

---

# 54. REGRESSION

После fix:

```text
Decision Queue tests
Command Center tests
affected backend tests
affected frontend tests
TSC backend
TSC frontend
build backend
build frontend
```

Не ограничиваться только новыми tests.

---

# 55. NO FABRICATION / NO SCOPE CREEP

Не добавлять:

```text
new signals
new KPIs
new business centers
new AI recommendations
automatic business mutations
CRM
```

---

# 56. MIGRATION POLICY

Сначала проверить существующую persistence model.

Если lifecycle fields уже есть:

```text
migration = 0
```

Если canonical lifecycle невозможно persist без отсутствующего field:

- доказать необходимость;
- сделать минимальную migration;
- документировать.

Не добавлять migration только для удобства.

---

# 57. LOCALIZATION

Проверить RU/AZ/EN для:

```text
Принять
Решить
Отклонить
Открыть услуги
Проверить доступность
Открыть платежи
Открыть возвраты
Открыть предстоящие
active filter labels
error feedback
```

Acceptance:

```text
raw keys = 0
CJK = 0
mixed-language system text = 0
```

---

# 58. REPORT

Создать:

```text
docs/prompts/PHASE_3_POST_STAGE_J_DECISION_QUEUE_RUNTIME_FINAL_REMEDIATION_REPORT.md
```

В отчёте явно отметить:

```text
Previous lifecycle verification claim invalidated by real browser HTTP 400.
```

Это важно для evidence history.

---

# 59. REQUIRED DELIVERABLE A — 400 ROOT CAUSE

```text
Observed error:
HTTP response body:
Frontend request:
Backend contract:
Mismatch:
Primary root cause:
Fix:
Why fix is authoritative:
```

---

# 60. REQUIRED DELIVERABLE B — BEFORE / AFTER

| Lifecycle action | Before | After |
|---|---|---|
| Принять | HTTP 400 | |
| Решить | HTTP 400 | |
| Отклонить | HTTP 400 | |

---

# 61. REQUIRED DELIVERABLE C — LIFECYCLE MODEL

```text
Statuses:
Transitions:
Active:
History:
Counters:
Persistence fields:
Permissions:
Audit:
```

---

# 62. REQUIRED DELIVERABLE D — CATALOG FILTERS

```text
ACTIVE baseline:
UNSOLD:
NO AVAILABILITY:
Consumer code:
Predicates:
Counts:
UI state:
```

---

# 63. REQUIRED DELIVERABLE E — ALL 7 ACTIONS

Полная browser matrix из раздела 47.

---

# 64. REQUIRED DELIVERABLE F — SECURITY

```text
Lifecycle RBAC:
Action RBAC:
Tenant isolation:
Workspace isolation:
ID tampering:
Filter security:
```

---

# 65. REQUIRED DELIVERABLE G — TESTS

```text
Backend:
Frontend:
Lifecycle:
Filters:
RBAC:
Isolation:
TSC:
Build:
Browser:
Network:
Console:
```

---

# 66. REQUIRED DELIVERABLE H — GIT

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

# 67. ACCEPTANCE — LIFECYCLE

VERDICT A запрещён, пока не выполнено всё:

1. Actual 400 response body captured.
2. Root cause identified.
3. Frontend/backend contract reconciled.
4. `Принять` succeeds.
5. `Решить` succeeds.
6. `Отклонить` succeeds.
7. All 3 are backend-persisted.
8. Reload persistence PASS.
9. Active/History semantics PASS.
10. Counters PASS.
11. Repeated click deterministic.
12. Invalid transitions controlled.
13. No Runtime Error overlay on expected business error.
14. RBAC enforced backend-side.
15. Tenant/workspace isolation PASS.
16. ID tampering negative PASS.
17. Existing traceability preserved.

---

# 68. ACCEPTANCE — STAGE F ACTIONS

18. All 7 actions clicked in browser.
19. 404 = 0.
20. Wrong-domain = 0.
21. `unsold=true` consumed.
22. `availability=none` consumed.
23. They are distinct semantic filter states.
24. Same result count, if present, explained by data.
25. Catalog baseline compared.
26. Failed Payments destination matches label promise.
27. Pending Refunds destination matches label promise.
28. Upcoming Bookings destination matches label promise.
29. Booking Delay destination matches label promise.
30. Recent Cancellations destination matches label promise.
31. Query params have real consumers.
32. Required filters have regression tests.
33. RBAC/tenant/workspace scope preserved.

---

# 69. ACCEPTANCE — GENERAL

34. RU/AZ/EN PASS.
35. Raw i18n keys = 0.
36. CJK = 0.
37. Unexpected console errors = 0.
38. Unexpected valid-action 4xx/5xx = 0.
39. Backend regression green.
40. Frontend regression green.
41. TSC clean.
42. Builds clean.
43. Report delivered.
44. Git commit created if code changed.
45. Pushed to origin/master.
46. HEAD == origin/master.
47. Working tree clean except documented unrelated pre-existing state.
48. CRM Step 3.5 not started.

---

# 70. FINAL VERDICT

Вернуть ровно один:

## VERDICT A — DECISION QUEUE RUNTIME FULLY RECONCILED / LIFECYCLE HTTP 400 ROOT CAUSE CLOSED / ALL STAGE F ACTION SEMANTICS VERIFIED / CRM STEP 3.5 READY

или:

## VERDICT B — DECISION QUEUE RUNTIME REMEDIATION INCOMPLETE

Обязательно разделить:

```text
400 root cause:
Acknowledge:
Resolve:
Dismiss:
Persistence:
Active/History:
Counters:
Catalog unsold:
Catalog availability:
Failed Payments:
Pending Refunds:
Upcoming Bookings:
Other Stage F actions:
RBAC:
Isolation:
Localization:
Tests:
Browser:
Git:
```

или:

## VERDICT C — BLOCKED / CANONICAL LIFECYCLE OR REQUIRED OPERATIONAL DESTINATION MISSING

Обязательно указать:

```text
Missing authority/capability:
Affected operation:
Why it cannot be safely fabricated:
Required prerequisite:
Recommended next canonical step:
```

---

# 71. STOP

После VERDICT:

**STOP.**

CRM Step 3.5 автоматически не запускать.
