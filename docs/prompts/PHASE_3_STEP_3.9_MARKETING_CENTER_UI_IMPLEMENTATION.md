# PHASE 3 — STEP 3.9 — MARKETING CENTER UI — IMPLEMENTATION

## 0. EXECUTION MODE

**IMPLEMENTATION TASK.**

Canonical predecessor is closed:

```text
PHASE 3 — STEP 3.8 — MARKETING DOMAIN
STATUS: COMPLETE — STRICT REVIEW APPROVED

Step 3.8 implementation:       541fe4b
Step 3.8.1 evidence:           8b32e34
Step 3.8.2 remediation:        38d88fd
Final evidence closure:        b8627b7
Strict Review:                 4135025
Roadmap/lifecycle amendment:   0f950c8
```

Canonical roadmap states:

```text
CANONICAL NEXT:
PHASE 3 — STEP 3.9 — MARKETING CENTER UI
```

Цель Step 3.9 — реализовать **Platform Marketing Center UI** поверх уже существующего и закрытого Marketing Domain/API, без изменения его бизнес-архитектуры.

Это не redesign всего приложения и не новый Marketing backend.

---

## 1. LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация должны быть преимущественно **на русском языке**.

Обязательно на русском:

- Implementation Report;
- Gap Audit;
- findings;
- root cause analysis;
- architecture/UI decisions;
- security findings;
- runtime/browser evidence;
- conclusions;
- recommendations;
- verdict explanation.

Английский допускается только для:

- путей и имён файлов;
- component/class/function/DTO/model names;
- API endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- enum/permission identifiers;
- code snippets;
- commit messages;
- стандартизированных VERDICT strings.

Если итоговый report преимущественно на английском — задача незавершена.

---

# PART I — PREFLIGHT / REPOSITORY TRUTH

## 2. VERIFY CANONICAL BASELINE

Перед изменениями выполнить:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/master
git log -15 --oneline
```

Ожидаемый baseline:

```text
HEAD:          0f950c8
origin/master: 0f950c8
```

Если отличается — установить причину до implementation.

Не stage и не изменять pre-existing unrelated dirty files.

---

## 3. READ CANONICAL ROADMAP

Открыть фактический canonical roadmap и прочитать **полный Step 3.9**, а также непосредственно связанные constraints/dependencies.

Не реализовывать задачу только по названию `MARKETING CENTER UI`.

В Implementation Report зафиксировать:

```text
canonical roadmap path
exact Step 3.9 scope
explicit dependencies
explicit deferrals
acceptance criteria
```

Если roadmap противоречит этому prompt — остановиться и описать конфликт, не выбирать молча удобную трактовку.

---

# PART II — MANDATORY FRONTEND GAP AUDIT

## 4. AUDIT BEFORE CODING

До implementation провести repository audit.

Проверить минимум:

```text
frontend routing
Platform Workspace routes
canonical Workspace Shell
sidebar/navigation manifest
header/page title/breadcrumb patterns
existing Center pages
Command Center
Analytics Center
Sales Center
Booking Center
CRM Center
shared tables
shared filters
shared KPI cards
shared badges
shared dialogs/drawers
shared loading/empty/error states
shared pagination
i18n architecture
API client/auth handling
RBAC/frontend permission projection
responsive conventions
```

Также проверить backend Marketing API из Step 3.8.

Создать в Implementation Report таблицу:

```text
Requirement
Existing reusable implementation
Gap
Decision
Files affected
```

### Hard rule

Не создавать второй UI framework, если существующий Platform Workspace design system уже покрывает задачу.

---

# PART III — BUSINESS / AUTHORITY BOUNDARY

## 5. MARKETING CENTER IS PLATFORM-ONLY

Текущая подтверждённая authority:

```text
marketing.* permissions:
ADMIN
DIRECTOR
MARKETER
OPERATOR
```

Не имеют Marketing access:

```text
PARTNER
FINANCE
BUYER
ANALYST
MODERATOR
SALES_MANAGER
```

Следовательно Step 3.9 должен реализовать **Platform Marketing Center**, а не Partner Marketing Center.

Hard invariant:

```text
Partner-scoped Campaign
≠
Partner actor has Marketing access
```

Запрещено:

```text
показывать Marketing Center PARTNER
добавлять Storefront Pro Marketing UI
выводить Marketing nav item Partner Workspace
считать partnerId entitlement
создавать frontend-only обход backend 403
```

Storefront Pro Marketing остаётся deferred до отдельного entitlement/architecture decision.

---

## 6. SERVER AUTHORITY REMAINS PRIMARY

Frontend permission visibility — только UX projection.

Security authority остаётся backend.

UI должен корректно обрабатывать:

```text
401
403
404
409
422
5xx
```

Нельзя считать скрытый sidebar item достаточной защитой.

---

# PART IV — INFORMATION ARCHITECTURE

## 7. MARKETING CENTER ENTRY

На основании существующей Platform Workspace navigation architecture добавить Marketing Center в правильное место sidebar/navigation.

Не создавать альтернативный sidebar.

Использовать существующий:

```text
Workspace Shell
navigation manifest
active-route mechanics
collapse behavior
responsive behavior
permission filtering
```

Название UI — в соответствии с существующей локализацией, ожидаемо:

```text
Маркетинг
```

Но проверить фактический i18n naming convention.

---

## 8. MARKETING CENTER PAGE

Marketing Center должен быть полноценным рабочим центром, а не пустой CRUD-таблицей.

Минимальная информационная архитектура должна быть выведена из реального Step 3.8 API.

Предпочтительная структура, если не противоречит roadmap/repo:

```text
Marketing Center
├ Overview / summary
├ Campaigns
├ Audiences
└ Attribution
```

Это могут быть tabs/sections/views в рамках одного Center.

Не создавать отдельные top-level sidebar items для каждого поддомена без архитектурного основания.

---

# PART V — CAMPAIGNS UI

## 9. CAMPAIGN LIST

Реализовать рабочий список Campaigns с использованием существующего table/list design system.

Показывать только реально доступные поля API.

Минимально рассмотреть:

```text
Campaign code/reference
Name
Status
Partner scope/label — только если это корректно для Platform operator
Created/updated metadata
Available actions
```

Не показывать raw UUID как пользовательский label, если можно разрешить человекочитаемое имя существующим безопасным способом.

---

## 10. CAMPAIGN FILTERING

Использовать существующий filter UX.

Поддерживать только фильтры, которые реально поддерживает backend contract.

Не создавать fake client-only filters, которые визуально обещают server filtering, если API этого не поддерживает.

Если backend Step 3.8 не предоставляет необходимый filter — документировать gap, а не расширять backend молча.

---

## 11. CAMPAIGN CREATE

Если `POST Campaign` входит в Step 3.8 API — реализовать create flow.

Использовать существующий modal/drawer/page pattern проекта.

Поля только из canonical API contract.

Validation errors:

```text
422 → field/form validation
403 → access denied
409 → conflict
5xx → controlled error state
```

После успешного создания:

```text
UI state refresh
success feedback
no duplicate optimistic record
```

---

## 12. CAMPAIGN DETAILS / EDIT

Если backend предоставляет get/update endpoints — реализовать соответствующий UI.

Не создавать UI action, для которого нет API authority.

Campaign detail должен давать оператору ясный контекст:

```text
identity
status
scope
audience relations
attribution context where supported
timestamps
available lifecycle actions
```

---

# PART VI — CAMPAIGN LIFECYCLE UI

## 13. LIFECYCLE

Backend authority уже подтверждена:

```text
DRAFT
→ SCHEDULED
→ ACTIVE
→ PAUSED / COMPLETED / CANCELLED
```

Terminal states immutable.

UI должен:

- отображать localized status badge;
- показывать только допустимые действия;
- не предполагать, что frontend определяет legality transition;
- корректно обрабатывать backend `422`;
- обновлять состояние после successful transition;
- не давать silent optimistic transition при reject.

Не добавлять переходы, которых нет в backend.

---

# PART VII — AUDIENCES UI

## 14. AUDIENCE LIST / MANAGEMENT

Использовать существующий Audience API.

Audience — это **definition/rule**, не Customer database.

UI не должен отображать Audience как список экспортированных контактных данных.

Показывать только безопасные metadata/criteria.

---

## 15. AUDIENCE CRITERIA BUILDER

Не давать пользователю arbitrary JSON editor, если это позволяет обойти bounded contract.

Текущий подтверждённый whitelist:

```text
lifecycle
leadSource
tags
status
customerType
```

Создать bounded form/builder из поддерживаемых criteria.

Запрещённые поля не должны появляться в UI:

```text
email
phone
url
address
socialHandle
partnerId
tenantId
ownerId
createdById
password
auth
token
secret
rawSql
query
$where
$expr
```

Backend всё равно остаётся authority.

---

## 16. AUDIENCE VALIDATION UX

Для invalid criteria:

```text
422
```

должен отображаться controlled validation state.

Не показывать raw backend/Prisma stack/error.

---

# PART VIII — ATTRIBUTION UI

## 17. ATTRIBUTION VIEW

Attribution — additive relation к canonical entities:

```text
CUSTOMER
LEAD
ORDER
BOOKING
```

UI не должен менять canonical acquisition/source fields.

Никакого mutation:

```text
Order.acquisitionSource
CRM source
Booking source
```

ради Marketing UI.

---

## 18. ATTRIBUTION CREATE FLOW

Если создание attribution является пользовательским action согласно roadmap/API — реализовать безопасный flow.

Entity selection не должен требовать ручного ввода UUID как основной UX, если проект уже имеет entity picker/search pattern.

При отсутствии reusable picker не строить крупный новый framework без необходимости.

Обработать:

```text
nonexistent → 404/controlled state
wrong type → 404/422
duplicate → 409
foreign tenant → reject
```

Никогда не отображать raw Prisma error.

---

## 19. LEAD SEMANTICS

`LEAD` — существующая canonical Sales entity.

Не создавать Marketing Lead model/UI.

Marketing attribution только ссылается на canonical `sales.Lead`.

---

# PART IX — OVERVIEW / SUMMARY

## 20. OVERVIEW MUST USE REAL DATA

Если Marketing API предоставляет данные, достаточные для summary, можно создать компактный Overview.

Например, только если вычисляется честно из доступного API:

```text
Total campaigns
Draft
Scheduled
Active
Paused
Completed
Cancelled
Audience count
Attribution count
```

Но:

- не создавать fake KPIs;
- не создавать fake performance metrics;
- не создавать ROAS/CTR/conversion/revenue attribution без backend authority;
- не создавать новый analytics engine.

Если API не позволяет корректно получить summary — ограничить Overview реальными данными или не включать KPI.

---

# PART X — CHANNEL SCOPE

## 21. DO NOT FAKE CHANNEL IMPLEMENTATION

Step 3.8 deferred real marketing transports.

Не создавать функциональные:

```text
EMAIL
SMS
PUSH
WhatsApp
social ads
```

если backend/roadmap их не реализует.

Не создавать кнопки вроде:

```text
Send campaign
Launch email
Send SMS
```

без реальной server authority.

Если UI должен показывать future/deferred capability, это допускается только если canonical UX проекта имеет explicit disabled/future pattern и roadmap этого требует.

Предпочтительно не показывать недоступную функцию.

---

# PART XI — CONSENT / COMMUNICATION BOUNDARY

## 22. NO CONSENT BYPASS

Consent/preferences остаются deferred.

Marketing Center не должен:

```text
извлекать Customer email/phone для рассылки
создавать contact export
обходить Communication policy
создавать direct Marketplace Partner communication
```

Marketing UI не превращает Audience criteria в PII export.

---

# PART XII — DESIGN SYSTEM

## 23. VISUAL CONSISTENCY

Marketing Center должен визуально принадлежать тому же Platform Workspace, что:

```text
Command Center
Analytics
Sales
Bookings
CRM
```

Переиспользовать существующие:

```text
page container
header
breadcrumbs
tabs
cards
tables
filters
buttons
badges
dialogs/drawers
forms
pagination
skeleton/loading
empty states
error states
spacing
typography
responsive rules
```

Не создавать новый визуальный язык специально для Marketing.

---

## 24. NO UNRELATED REDESIGN

Запрещено в Step 3.9:

```text
редизайн Platform sidebar целиком
редизайн Command Center
редизайн CRM
редизайн Analytics
Storefront visual alignment
public Storefront redesign
global design-system rewrite
```

Если обнаружен shared UI defect — документировать отдельно, если его исправление не обязательно для Marketing Center.

---

# PART XIII — I18N

## 25. LOCALIZATION

Не hardcode пользовательские строки, если проект использует i18n.

Проверить поддерживаемые locale.

Добавить Marketing keys в существующую структуру.

Проверить отсутствие raw keys вида:

```text
marketing.*
cc.*
common.*
```

в browser runtime.

Не менять глобальную localization architecture.

---

# PART XIV — ACCESSIBILITY / RESPONSIVE

## 26. ACCESSIBILITY

Минимально проверить:

```text
keyboard-accessible actions
form labels
dialog focus behavior
button accessible names
status not encoded only visually
table/action semantics
```

Использовать существующие accessible primitives проекта.

---

## 27. RESPONSIVE

Проверить Marketing Center на типовых размерах проекта.

Минимально:

```text
desktop
narrow desktop/tablet
mobile if Platform Workspace officially supports it
```

Не допускать:

```text
horizontal page breakage
off-screen dialogs
unusable action menus
overlapping header/sidebar
```

---

# PART XV — API / ERROR STATE CONTRACT

## 28. API CLIENT

Использовать существующий authenticated API client.

Не создавать второй ad hoc fetch layer.

Проверить:

```text
auth token/session behavior
base URL
error normalization
abort/loading behavior
query invalidation/refetch
```

---

## 29. STATES

Для каждого major view реализовать:

```text
loading
success
empty
403
404 where applicable
422 validation
409 conflict
generic controlled error
```

Не оставлять blank page при API failure.

---

# PART XVI — TESTING

## 30. AUTOMATED TESTS

Добавить тесты на реально созданные компоненты/flows.

Минимум:

```text
Marketing nav visibility for allowed Platform role
Marketing nav hidden for PARTNER
Marketing route protected
Campaign list rendering
empty state
create validation
lifecycle action rendering
invalid lifecycle handling
Audience bounded criteria
blocked/unsupported criteria not offered
Attribution conflict handling
403 handling
i18n labels
```

Не писать тесты только ради coverage; assertions должны проверять authority/behavior.

---

# PART XVII — AUTHENTICATED BROWSER RUNTIME

## 31. BROWSER EVIDENCE IS MANDATORY

Step 3.9 — UI stage.

Source code + unit tests **недостаточны**.

Обязателен authenticated browser runtime.

Проверить минимум:

### Platform ADMIN

```text
Marketing nav visible
Marketing Center opens
Campaigns load
create flow works
lifecycle action works
Audience flow works
Attribution view/action works where supported
loading/empty/error states render
```

### Platform MARKETER

```text
Marketing nav visible
authorized operations work
```

### PARTNER

```text
Marketing nav absent
direct Marketing route does not grant usable access
backend remains 403
no data leak
```

### FINANCE

```text
Marketing nav absent
direct route denied/controlled
```

### Anonymous

```text
protected route redirects/denies according existing auth architecture
```

---

## 32. VISUAL EVIDENCE

Сделать screenshots минимум:

```text
Marketing Center main view
Campaign list
Campaign create/edit flow
Audience view/builder
Attribution view
PARTNER denied/absence evidence
```

Если конкретный subview отсутствует из-за API/roadmap scope — объяснить, не подделывать screenshot.

Browser observation имеет приоритет над утверждением «код правильный».

---

# PART XVIII — RUNTIME DEFECT GATE

## 33. DO NOT DECLARE PASS WITH VISIBLE DEFECTS

Проверить:

```text
blank content
raw i18n keys
raw UUID labels
broken table widths
missing status labels
buttons with no action
console errors
failed API requests
hydration errors
incorrect sidebar active state
Partner Marketing leakage
unhandled 403/409/422
```

Если обнаружен P0/P1/P2 defect — Step 3.9 implementation не объявлять готовым к Strict Review.

---

# PART XIX — BACKEND CHANGE POLICY

## 34. BACKEND SHOULD REMAIN STABLE

Step 3.9 — UI implementation.

Не расширять Marketing backend только потому, что UI хотелось бы больше данных.

Если frontend невозможно корректно реализовать из-за backend gap:

1. документировать gap;
2. классифицировать severity;
3. определить минимальную remediation dependency;
4. не создавать незапланированный backend feature молча.

Мелкий contract fix допустим только если это объективный blocker и не меняет архитектуру; его необходимо явно описать и отдельно доказать runtime/tests.

---

# PART XX — IMPLEMENTATION REPORT

## 35. CREATE REPORT

Создать:

```text
docs/prompts/PHASE_3_STEP_3.9_MARKETING_CENTER_UI_IMPLEMENTATION_REPORT.md
```

Отчёт преимущественно на русском языке.

Структура:

```text
1. Baseline
2. Canonical Step 3.9 scope
3. Frontend gap audit
4. Reused Platform design system
5. Navigation/RBAC integration
6. Marketing Center information architecture
7. Campaign UI
8. Lifecycle UI
9. Audience UI
10. Attribution UI
11. i18n
12. Error/loading/empty states
13. Automated tests
14. Browser/runtime evidence
15. Security/access evidence
16. Screenshots/evidence paths
17. Deferred items
18. Files changed
19. Findings
20. Git closure
21. Verdict
```

---

# PART XXI — GIT CLOSURE

## 36. GIT POLICY

Перед commit:

```bash
git status --short
git diff --name-only
git diff
```

Не включать pre-existing unrelated dirty files.

После implementation/tests/runtime evidence:

```bash
git add <task-owned-files-only>
git commit -m "feat(marketing): implement Platform Marketing Center UI"
git push origin master
git rev-parse HEAD
git rev-parse origin/master
git status --short
```

В report/final response:

```text
Starting HEAD:
Implementation SHA:
Final HEAD:
origin/master:
HEAD == origin/master:
```

Никаких `(after push)` / `(this commit)` placeholders в финальном execution response.

---

# PART XXII — ACCEPTANCE GATES

## 37. REQUIRED PASS CONDITIONS

Step 3.9 implementation может быть признан готовым к Strict Review только если:

```text
canonical Step 3.9 scope implemented
existing Workspace Shell reused
existing Platform design language reused
Marketing navigation correctly integrated
Marketing remains Platform-only
PARTNER has no Marketing UI/access
FINANCE has no Marketing UI/access
Campaign UI uses real API
Campaign lifecycle reflects backend authority
Audience UI is bounded and PII-safe
Attribution UI does not mutate canonical sources
LEAD remains canonical Sales entity
no fake transports
no fake analytics
no consent bypass
i18n correct
loading/empty/error states implemented
responsive behavior verified
automated tests pass
authenticated browser runtime passes
no unresolved P0/P1/P2
Git closure complete
report in Russian
```

---

## 38. IMPLEMENTATION SUCCESS VERDICT

Если все implementation gates выполнены:

```text
VERDICT A — PHASE 3 — STEP 3.9 MARKETING CENTER UI — IMPLEMENTATION COMPLETE

STEP 3.9 IMPLEMENTATION COMPLETE
READY FOR SEPARATE STRICT REVIEW
```

**Это НЕ означает `STEP 3.9 CLOSED`.**

Step 3.9 закрывается только после отдельного Strict Review.

---

## 39. FAILURE VERDICT

Если остаётся P0/P1/P2 или обязательный runtime/browser gate не выполнен:

```text
VERDICT B — PHASE 3 — STEP 3.9 MARKETING CENTER UI — IMPLEMENTATION INCOMPLETE

STEP 3.9 REMAINS OPEN
```

Указать:

```text
finding
severity
runtime reproduction
root cause
affected files
required remediation
```

Не маскировать defect тестами или documentation wording.

---

## 40. STOP CONDITION

После implementation:

```text
STOP
```

Не:

```text
выполнять Strict Review в том же task
закрывать Step 3.9
обновлять следующий roadmap step как started
начинать следующий implementation
реализовывать Partner/Storefront Marketing
```

Сначала предоставить полный Implementation Report, browser/runtime evidence и Git closure.

Следующая задача после успешного implementation — отдельный:

```text
PHASE 3 — STEP 3.9 — MARKETING CENTER UI — STRICT REVIEW
```
