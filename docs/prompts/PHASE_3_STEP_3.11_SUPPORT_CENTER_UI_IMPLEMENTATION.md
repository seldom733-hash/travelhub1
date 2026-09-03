# PHASE 3 — STEP 3.11 — SUPPORT CENTER UI — IMPLEMENTATION

## 0. TASK MODE

**IMPLEMENTATION TASK.**

Canonical baseline:

```text
Phase 3.0–3.10: CLOSED
Step 3.10 Support Domain: CLOSED

Step 3.10 Implementation SHA:            7d638ef
Step 3.10 Strict Review SHA:             ff64a83
Step 3.10 Remediation/Re-Qualification:  bb53fb0
Post-Step 3.10 Roadmap Sync SHA:          c313cda

Expected HEAD/origin:                     c313cda
Exact CANONICAL NEXT:
PHASE 3 — STEP 3.11 — SUPPORT CENTER UI
```

Цель этой задачи:

```text
прочитать exact Step 3.11 из canonical roadmap
→ выполнить repository/UI gap audit
→ реализовать Support Center UI строго поверх существующего Step 3.10 Support Domain
→ не дублировать backend business authority
→ выполнить automated + browser/runtime evidence
→ создать implementation report
→ commit/push
→ STOP
```

**Не закрывать Step 3.11 как окончательно CLOSED.**

Успешный implementation verdict означает только:

```text
STEP 3.11 IMPLEMENTATION COMPLETE
READY FOR SEPARATE STRICT REVIEW
```

После этого требуется отдельный Strict Review.

---

# 1. LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые reports и prose documentation должны быть преимущественно **на русском языке**.

На русском обязательны:

- Implementation Report;
- Gap Audit;
- findings explanations;
- root cause analysis;
- architecture/UI decisions;
- security explanations;
- runtime/browser evidence descriptions;
- conclusions;
- recommendations;
- verdict explanations.

Английский допускается только для:

- file paths;
- class/method/DTO/model names;
- table/model names;
- API endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- commit messages;
- enum names;
- permission identifiers;
- code snippets;
- standardized VERDICT strings.

Если report преимущественно на английском — задача считается незавершённой.

---

# PART I — PREFLIGHT

## 2. GIT BASELINE

Выполнить:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -25 --oneline
```

Ожидаемо:

```text
HEAD:          c313cda
origin/master: c313cda
```

Если baseline отличается — установить причину до implementation.

Не изменять/stage unrelated dirty files.

---

# PART II — CANONICAL REQUIREMENTS FIRST

## 3. READ EXACT STEP 3.11

Открыть:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Найти exact section:

```text
PHASE 3 — STEP 3.11 — SUPPORT CENTER UI
```

Извлечь и зафиксировать в Implementation Report:

```text
scope
required pages
required tabs/sections
required actions
required table/list columns
required filters
required detail view
required states
required permissions
required runtime/browser gates
explicit deferrals
out-of-scope
```

**Не придумывать UI requirements, которых нет в roadmap.**

Если roadmap описывает Step 3.11 менее подробно, чем требуется для безопасной реализации:

```text
1. Audit existing shared UI patterns.
2. Reuse canonical patterns.
3. Implement only minimal UI necessary to expose existing Step 3.10 capabilities.
4. Explicitly defer everything not required.
```

---

# PART III — REPOSITORY/UI GAP AUDIT

## 4. AUDIT EXISTING WORKSPACE SHELL

Найти и классифицировать existing shared components/patterns:

```text
Workspace Shell
Sidebar/navigation
Page header
Breadcrumbs if used
Tabs
KPI cards if relevant
Data table
Filters
Search
Pagination
Status badges
Empty state
Loading state
Error state
Detail drawer/page
Form modal/panel
Confirmation dialogs
Toast/notifications
Permission gates
i18n
responsive layout
```

Классификация:

```text
REUSE
EXTEND
MISSING
DO_NOT_DUPLICATE
```

---

## 5. AUDIT EXISTING CENTER UIs

Сравнить implementation patterns минимум с существующими Platform centers, например:

```text
Marketing Center
CRM Center
Booking Center
Sales Center
Analytics/Command Center
```

Использовать существующий TravelHub internal UI language.

**Не создавать отдельную визуальную систему специально для Support.**

---

## 6. AUDIT STEP 3.10 API CONTRACT

До UI implementation составить actual Support API inventory:

| Method | Endpoint | Purpose | Permission | Request | Response |
|---|---|---|---|---|---|

Не угадывать API.

Проверить actual DTOs, status enums, priority/type enums, comment structure, assignment model, communication-link model, pagination/filter contract.

---

# PART IV — ARCHITECTURAL BOUNDARY

## 7. UI MUST NOT BECOME DOMAIN AUTHORITY

Frontend может:

```text
display
filter
submit valid user intent
render server result
show controlled errors
```

Frontend не должен быть authority для:

```text
lifecycle legality
permission enforcement
comment visibility
assignee eligibility
related entity integrity
Communication scope
audit/history
```

Hard rule:

```text
UI hidden ≠ server denied
frontend validation ≠ backend authority
```

---

## 8. NO DUPLICATE SUPPORT DOMAIN

Не создавать:

```text
frontend-only fake case state machine
second Support API client model inconsistent with backend
duplicate Customer/Partner/Order/Booking ownership logic
duplicate Communication engine
duplicate audit/history store
```

---

# PART V — SUPPORT CENTER INFORMATION ARCHITECTURE

## 9. USE EXACT ROADMAP IA

Если canonical Step 3.11 определяет конкретную структуру — реализовать её дословно.

Если roadmap оставляет details open, использовать минимальную canonical structure:

```text
SUPPORT CENTER
├ Cases / Tickets list
└ Case detail
```

Дополнительные tabs/sections — только если roadmap или existing domain их реально поддерживает.

Не добавлять speculative:

```text
Knowledge Base
AI Assistant
SLA Dashboard
Support Analytics
Omnichannel
Email ingestion
Telephony
CSAT
Macros
Dispute Center
```

если Step 3.11 этого не требует.

---

# PART VI — NAVIGATION

## 10. SIDEBAR ENTRY

Если Step 3.11 требует navigation:

добавить Support в **existing Platform Workspace sidebar manifest**, не создавать второй sidebar.

Проверить:

```text
label
icon
route
permission visibility
active state
responsive behavior
i18n
```

Sidebar visibility должна следовать existing server/permission-aware UI convention.

Но отсутствие menu item не заменяет backend deny.

---

## 11. PLATFORM VS PARTNER

Step 3.10 был Platform Support Domain.

Следовательно, не выводить Support Center в Partner Workspace, если canonical roadmap явно этого не требует.

Не создавать Partner-facing Support portal в Step 3.11 без roadmap authority.

---

# PART VII — CASE LIST

## 12. CASE TABLE/LIST

Реализовать actual roadmap-required list.

Если roadmap не фиксирует columns, минимально использовать только data, которые реально есть в API и полезны оператору:

```text
Case code / SUP-*
Type
Priority
Status
Customer/Partner reference if available
Order/Booking reference if available
Assignee
Updated/Created time
```

Не показывать raw UUID как основной пользовательский label, если canonical human-readable label доступен.

---

## 13. SEARCH / FILTERS

Только согласно API capability.

Возможные filters — лишь если backend их поддерживает:

```text
status
priority
type
assignee
customer/partner
case code/search
```

Не делать frontend-only filter, создающий ложное ощущение server-side filtering на paginated dataset.

---

## 14. PAGINATION

Использовать canonical table/pagination pattern проекта.

Проверить:

```text
page change
page size if supported
empty page
total count
loading
error
```

---

# PART VIII — STATUS / PRIORITY / TYPE PRESENTATION

## 15. I18N

Никаких raw enum labels в пользовательском UI.

Пример:

```text
OPEN
IN_PROGRESS
WAITING_CUSTOMER
WAITING_PARTNER
WAITING_INTERNAL
ESCALATED
RESOLVED
CLOSED
```

должны отображаться через canonical i18n mapping.

Аналогично:

```text
CaseType
Priority
```

---

## 16. STATUS BADGE

Переиспользовать/расширить existing `StatusBadge` pattern.

Не создавать inconsistent Support-only status visual system без причины.

Проверить:

```text
all statuses mapped
no raw enum fallback visible
accessible label
```

---

# PART IX — CREATE CASE UI

## 17. CREATE ACTION

Если Step 3.11 включает создание Case:

показывать action только actor с `support.case.create`.

Форма должна использовать actual backend DTO.

Не допускать arbitrary fields.

---

## 18. RELATED ENTITY SELECTORS

Для supported references:

```text
customerId
orderId
bookingId
```

не заставлять пользователя вручную вводить UUID, если project already has canonical entity search/select pattern.

Если lookup endpoint отсутствует и roadmap не требует его добавлять:

```text
do not invent broad new domain endpoint silently
```

Выбрать минимальный existing compatible UX и задокументировать limitation/deferment.

---

## 19. CREATE ERRORS

Отображать controlled backend errors:

```text
400
403
404
409
422
```

понятно пользователю.

Не показывать raw JSON/stack.

---

# PART X — CASE DETAIL

## 20. DETAIL VIEW

Case detail должен отображать только actual Support API data.

Типичные sections, только если данные существуют:

```text
Case summary
Status
Priority
Type
Customer/Partner
Order/Booking
Assignee
Comments
Communication links
History/Activity
```

---

## 21. HUMAN-READABLE REFERENCES

Если UI показывает related Customer/Partner/Order/Booking:

использовать canonical labels/codes, где available.

Hard rule:

```text
UUID may exist technically
but must not become primary visible business label
```

---

# PART XI — LIFECYCLE ACTIONS

## 22. STATUS ACTIONS

UI должен строить available actions на основе current status + capabilities API/known canonical mapping, но backend остаётся authority.

Не создавать альтернативную state machine.

При backend `422 invalid transition`:

```text
show controlled message
refresh Case state
no optimistic false success
```

---

## 23. ESCALATION

После F4 remediation escalation использует canonical `transitionCase`.

UI не должен иметь второй special lifecycle path, который логически расходится с standard transition action.

Если отдельная button нужна по roadmap — она должна вызывать canonical backend action.

---

# PART XII — ASSIGNMENT

## 24. ASSIGN / REASSIGN

Показывать action только actor с `support.case.assign`.

Assignee selector должен позволять только eligible users, если API предоставляет eligibility list.

Если backend endpoint принимает ID, UI всё равно не должен намеренно предлагать Partner/Buyer/ineligible users.

Server remains final authority.

---

## 25. ASSIGNMENT ERROR

Если backend отклоняет assignee:

```text
403/404/422
```

показать controlled error и не оставлять UI в optimistic assigned state.

---

# PART XIII — COMMENTS

## 26. COMMENTS UI

Показать comments согласно response, который уже server-filtered после F2 remediation.

Frontend **не должен самостоятельно "доверительно" фильтровать internal comments как security mechanism**.

---

## 27. COMMENT VISIBILITY

Если create-comment UI поддерживает выбор visibility:

```text
internal
customer-facing
```

показывать только разрешённые actor options.

Если roadmap/UI не требует external-facing comment flow, не добавлять speculative UX.

---

## 28. INTERNAL COMMENT VISUAL DISTINCTION

Если internal comments доступны Platform operator:

визуально отличать internal comment от customer-facing comment, чтобы оператор не отправил/не интерпретировал его неправильно.

Использовать existing design language.

---

# PART XIV — COMMUNICATION LINKS

## 29. COMMUNICATION

Если Step 3.11 требует Communication relation UI:

показывать canonical Communication reference/link.

Не встраивать второй chat engine.

---

## 30. LINK ACTION

Если link action доступен:

использовать existing Support endpoint.

Controlled errors:

```text
nonexistent
cross-scope
duplicate
```

не должны превращаться в raw UI failure.

---

# PART XV — CASE HISTORY

## 31. HISTORY PRESENTATION

Если Step 3.11 требует history:

использовать `CaseHistory` read projection.

Показывать human-readable event:

```text
status changed
assigned/reassigned
created
other canonical event
actor
timestamp
```

Не позволять edit/delete history.

---

# PART XVI — PERMISSION-AWARE UI

## 32. EFFECTIVE MATRIX

После Step 3.10 re-qualification permission grants role-specific.

UI должен использовать actual existing permission system.

Проверить representative behavior:

```text
ADMIN
OPERATOR
DIRECTOR
FINANCE
ANALYST
SALES_MANAGER
PARTNER
```

Не hardcode role names там, где project convention использует permissions.

Правильно:

```text
can("support.case.update")
```

Неправильно:

```text
role === "ADMIN"
```

если permission framework уже существует.

---

## 33. DIRECTOR / READ-ONLY CASE

Если actual matrix оставляет DIRECTOR read-only:

```text
list/detail visible
mutation controls absent/disabled according project convention
backend mutation still 403
```

---

# PART XVII — LOADING / EMPTY / ERROR STATES

## 34. REQUIRED STATES

Для list/detail/actions реализовать:

```text
initial loading
refresh loading
empty list
API error
403 forbidden
404 case not found
validation error
network failure
successful mutation
```

Не оставлять blank page/header-only состояние.

---

# PART XVIII — RESPONSIVE / ACCESSIBILITY

## 35. RESPONSIVE

Проверить desktop + narrower viewport минимум в browser.

Table/detail/actions не должны ломать Workspace Shell.

---

## 36. ACCESSIBILITY

Минимум:

```text
buttons have text/aria label
form controls have labels
status not encoded only by color
keyboard usable dialogs/panels
focus behavior reasonable
```

---

# PART XIX — AUTOMATED TESTS

## 37. FRONTEND TESTS

Добавить targeted tests для actual implementation.

Минимум где применимо:

```text
Support route/page render
i18n status mapping
permission-aware action visibility
empty state
error state
case list rendering
case detail rendering
internal/customer-facing comment presentation
status action behavior
assignment behavior
```

Не тестировать только static constants.

---

## 38. BACKEND REGRESSION

Так как Step 3.11 — UI stage:

backend production behavior не менять без necessity.

Прогнать минимум:

```text
Support 30/30 baseline
Communication 44/44 baseline
Backend TSC
```

Если backend изменён для UI contract — требуется отдельное justification + stronger regression.

---

## 39. FRONTEND REGRESSION

Прогнать project-standard:

```text
frontend test suite
frontend typecheck
frontend build
```

Зафиксировать exact counts.

---

# PART XX — REAL BROWSER / RUNTIME EVIDENCE

## 40. BROWSER IS MANDATORY

Source/tests недостаточно.

Запустить real stack и открыть Support Center в browser.

Использовать real API/data/auth.

---

## 41. REPRESENTATIVE ROLE — MUTATING

Под actor с mutation permissions (например actual ADMIN/OPERATOR):

проверить:

```text
sidebar Support entry
page opens
cases render
filters work if supported
create Case if in scope
detail opens
assignment if in scope
comment if in scope
status transition
history refresh
no console errors
```

---

## 42. READ-ONLY ROLE

Под actual read-only role, если такой существует:

```text
Support visible
list/detail readable
mutation actions not presented
direct backend mutation remains denied
```

---

## 43. DENIED ROLE

Под role без `support.case.read`:

```text
Support menu hidden/disabled per project convention
direct URL does not expose Support data
backend remains 403
```

Frontend redirect/forbidden page должен быть controlled.

---

## 44. COMMENTS RUNTIME

Если comments отображаются:

создать/использовать:

```text
internal comment
customer-facing comment
```

и визуально подтвердить корректную presentation.

Не пытаться компенсировать backend security на frontend.

---

## 45. LIFECYCLE RUNTIME

Минимум один valid transition и один controlled invalid/stale-state scenario.

Проверить:

```text
no false optimistic success
status updates after server response
error shown clearly
```

---

## 46. BROWSER CONSOLE

Hard gate:

```text
0 React key warnings
0 uncaught exceptions
0 hydration errors
0 raw failed-request stack rendering
```

Expected API `403/422` может присутствовать в Network во время negative test, но не как uncaught application error.

---

# PART XXI — NO SCOPE CREEP

## 47. DO NOT IMPLEMENT EARLY

Без explicit Step 3.11 requirement не реализовывать:

```text
AI support agent
chatbot
knowledge base
SLA automation
advanced queues
omnichannel
email ingestion
telephony
CSAT
Support Analytics
Dispute Center
refund authority
bulk automation
external ticket provider integration
Partner-facing Support portal
```

---

# PART XXII — IMPLEMENTATION REPORT

## 48. CREATE REPORT

Создать:

```text
docs/prompts/PHASE_3_STEP_3.11_SUPPORT_CENTER_UI_IMPLEMENTATION_REPORT.md
```

Минимальная структура:

```text
1. Baseline
2. Exact canonical Step 3.11 requirements
3. Repository/UI gap audit
4. Reused shared UI components
5. Support API inventory
6. Information architecture
7. Navigation
8. Case list
9. Case detail
10. Lifecycle UI
11. Assignment
12. Comments
13. Communication
14. History
15. Permission-aware UI
16. Loading/empty/error states
17. i18n
18. Responsive/accessibility
19. Automated tests
20. Backend regressions
21. Browser/runtime evidence
22. Console evidence
23. Deferred/out-of-scope
24. Files changed
25. Git evidence
26. Final verdict
27. Required next action
```

---

# PART XXIII — GIT POLICY

## 49. DIFF REVIEW

Перед commit:

```bash
git status --short
git diff --name-only
git diff
```

Проверить:

```text
only Step 3.11 task-owned files
no Step 3.12
no unrelated backend refactor
no unrelated Marketing work
no premature Partner Support
```

---

## 50. COMMIT / PUSH

Пример:

```bash
git add <task-owned-files>
git commit -m "feat(support): implement Support Center UI"
git push origin master

git rev-parse HEAD
git rev-parse origin/master
```

Зафиксировать:

```text
Starting SHA:       c313cda
Step 3.11 SHA:      <real SHA>
Final HEAD:         <real SHA>
origin/master:      <real SHA>
HEAD == origin:     YES/NO
```

---

# PART XXIV — IMPLEMENTATION VERDICT

## 51. VERDICT A GATE

Implementation verdict A допускается только если:

```text
exact Step 3.11 roadmap scope implemented
no duplicate Support/domain authority
shared Workspace/UI system reused
Support navigation correct
case list/detail correct
permissions respected in UI
backend remains authority
statuses/types/priorities localized
loading/empty/error states complete
no raw UUID business labels where canonical labels exist
no internal-comment leakage introduced
Communication/history integration correct where in scope
frontend tests PASS
frontend typecheck/build PASS
Support backend regression PASS
Communication regression PASS
Backend TSC PASS
real browser/runtime PASS
console clean
report predominantly Russian
Git closure complete
HEAD == origin/master
```

Тогда:

```text
VERDICT A — PHASE 3 — STEP 3.11 SUPPORT CENTER UI — IMPLEMENTATION COMPLETE

STEP 3.11 IMPLEMENTATION COMPLETE
READY FOR SEPARATE STRICT REVIEW
```

**Это не означает `STEP 3.11 CLOSED`.**

---

## 52. VERDICT B

Если material implementation/runtime defect остаётся:

```text
VERDICT B — PHASE 3 — STEP 3.11 SUPPORT CENTER UI — IMPLEMENTATION INCOMPLETE

STEP 3.11 REMAINS OPEN
```

Указать blockers и не переходить к Strict Review как будто implementation complete.

---

# PART XXV — ROADMAP POLICY

## 53. DO NOT PREMATURELY CLOSE

На этой задаче:

```text
DO NOT mark Step 3.11 CLOSED
DO NOT advance completed boundary beyond Phase 3.0–3.10
DO NOT set Step 3.12 as completed/current implementation
```

Можно записать implementation evidence только согласно existing canonical convention, но финальное закрытие — после отдельного Strict Review.

---

# PART XXVI — FINAL RESPONSE

## 54. RETURN

Вернуть пользователю:

```text
Starting SHA
Step 3.11 implementation SHA
Final HEAD/origin
Exact implemented roadmap scope
Pages/routes implemented
Shared components reused
Permission behavior
Frontend test counts
Backend regression counts
Browser/runtime evidence
Console evidence
Files changed
Deferred scope
Final VERDICT
Required next action
```

---

# PART XXVII — STOP

## 55. STOP CONDITION

После implementation:

```text
STOP
```

Если:

```text
VERDICT A
```

следующее действие только:

```text
SEPARATE STEP 3.11 STRICT REVIEW
```

Не запускать его автоматически.
