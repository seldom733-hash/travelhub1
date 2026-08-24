# PHASE 3 --- STEP 3.5 --- CRM COMPLETION

## ENTRY AUDIT → GAP CLASSIFICATION → IMPLEMENTATION → REGRESSION → EVIDENCE CLOSURE

## TRAVELHUB

------------------------------------------------------------------------

# 1. ЯЗЫК

Все ответы разработчика, findings, таблицы, gap analysis, implementation
notes, runtime evidence, отчёт и финальный VERDICT --- **НА РУССКОМ
ЯЗЫКЕ**.

Technical identifiers, paths, code, API routes, permission IDs, SQL, SHA
и commit messages можно сохранять в оригинале.

------------------------------------------------------------------------

# 2. CANONICAL ENTRY STATE

Post-Phase-3 Roadmap Reconciliation завершён:

``` text
VERDICT A
Commit: b5471bd
```

Canonical next stage:

``` text
Phase 3 — Step 3.5 — CRM Completion
Status: READY
Dependencies: satisfied
```

Не переопределять следующий stage без repository evidence.

------------------------------------------------------------------------

# 3. ЦЕЛЬ STEP 3.5

Завершить CRM как production-grade рабочий центр TravelHub.

Но **НЕ НАЧИНАТЬ С ПЕРЕПИСЫВАНИЯ CRM**.

Обязательный порядок:

``` text
CURRENT STATE AUDIT
        ↓
CANONICAL REQUIREMENTS
        ↓
GAP MATRIX
        ↓
IMPLEMENT ONLY PROVEN GAPS
        ↓
RBAC / TENANT / DATA INTEGRITY
        ↓
RU / AZ / EN
        ↓
RUNTIME / BROWSER
        ↓
REGRESSION
        ↓
EVIDENCE CLOSURE
```

------------------------------------------------------------------------

# 4. FIRST GATE --- REPOSITORY STATE

До любых изменений:

``` bash
git status
git rev-parse HEAD
git rev-parse origin/master
git log -10 --oneline
```

Вернуть:

``` text
Starting HEAD:
origin/master:
Working tree:
Untracked:
```

Dirty worktree не уничтожать автоматически.

------------------------------------------------------------------------

# 5. FIND CANONICAL STEP 3.5

Найти точное описание:

``` text
Phase 3
Step 3.5
CRM Completion
CRM
Customers
Partners
```

в canonical roadmap и additive reconciliation docs.

Вернуть exact roadmap requirements.

------------------------------------------------------------------------

# 6. DOCUMENT PRECEDENCE

Если CRM описан в нескольких документах:

``` text
canonical roadmap
architecture
reconciliation
historical prompts/reports
```

определить precedence.

Не использовать устаревший документ как authority поверх более нового.

------------------------------------------------------------------------

# 7. CRM DOMAIN BOUNDARY

До implementation определить, что именно считается CRM в текущей
архитектуре TravelHub.

Проверить минимум:

``` text
Customers
Partners
Customer profile
Partner profile
Contacts
Interaction/history
Orders relation
Bookings relation
Payments relation
Notes
Tags/segments
Ownership/assignment
Search/filter/sort
Status/lifecycle
Communication context
```

Только фактически предусмотренные roadmap/architecture capabilities
считать обязательными.

------------------------------------------------------------------------

# 8. DO NOT INVENT CRM FEATURES

Не добавлять автоматически:

``` text
lead scoring
AI recommendations
marketing automation
email campaigns
sales forecasting
employee performance
complex segmentation engine
external CRM sync
```

если Step 3.5 этого не требует.

------------------------------------------------------------------------

# 9. EXISTING CRM INVENTORY --- BACKEND

Найти:

``` text
modules
controllers
services
DTOs
entities/models
Prisma models
repositories
events
permissions
tests
```

связанные с CRM/customers/partners.

------------------------------------------------------------------------

# 10. EXISTING CRM INVENTORY --- FRONTEND

Найти:

``` text
routes/pages
components
tables
profile/detail pages
filters
forms
API clients
hooks
i18n
tests
```

------------------------------------------------------------------------

# 11. EXISTING CRM INVENTORY --- DATABASE

Проверить actual schema.

Минимум связанные сущности:

``` text
User / Customer
Partner
PartnerStorefront
Order
Booking
Payment
Product/Tour
Messages/Chat
Subscription
```

Использовать реальные названия моделей.

------------------------------------------------------------------------

# 12. NO DUPLICATE CUSTOMER TRUTH

Определить canonical customer identity.

Проверить, нет ли параллельных несовместимых понятий:

``` text
User
Customer
Buyer
Guest
Client
```

Сформировать mapping.

------------------------------------------------------------------------

# 13. MARKETPLACE VS STOREFRONT CUSTOMER

Обязательно определить:

``` text
Marketplace Customer
Storefront Customer
```

и могут ли они быть одной identity с разными business contexts.

Не создавать duplicate person records без необходимости.

------------------------------------------------------------------------

# 14. PARTNER IDENTITY

Аналогично:

``` text
Partner
Partner organization
Partner user
Storefront
Subscription customer
```

Разделить organization vs login/user identity.

------------------------------------------------------------------------

# 15. CUSTOMER PROFILE --- CURRENT STATE

Проверить наличие/полноту:

``` text
identity
contact data
locale
status
created date
orders
bookings
payments
refund context
lifetime activity
marketplace/storefront context
```

Только authoritative data.

------------------------------------------------------------------------

# 16. PARTNER PROFILE --- CURRENT STATE

Проверить:

``` text
organization
contacts
workspace
storefront
products/services
orders/bookings
financial relationship
subscription/billing relationship
status
```

------------------------------------------------------------------------

# 17. CRM LIST PAGE

Проверить, является ли CRM полноценным рабочим центром, а не static
list.

Минимум audit:

``` text
table/list
search
filter
sort
pagination
empty state
loading state
error state
row navigation
```

------------------------------------------------------------------------

# 18. SEARCH

Проверить expected searchable fields по architecture.

Например:

``` text
name
email
phone
organization
customer/partner ID
```

Не добавлять поля без source.

------------------------------------------------------------------------

# 19. FILTERS

Проверить roadmap/architecture filters.

Возможные dimensions только если предусмотрены:

``` text
type
status
marketplace/storefront
activity
date
partner/customer
```

------------------------------------------------------------------------

# 20. SORTING

Проверить deterministic sorting и stable pagination.

------------------------------------------------------------------------

# 21. PAGINATION

Backend pagination authority обязательна для scalable lists.

Не загружать весь CRM dataset в browser только для client-side
pagination, если current architecture предполагает server-side.

------------------------------------------------------------------------

# 22. CUSTOMER DETAIL

Проверить detail route и composition.

Expected enterprise pattern:

``` text
Summary
Contacts
Orders
Bookings
Payments
Activity / interactions
Notes
```

Но реализовать только canonical scope.

------------------------------------------------------------------------

# 23. PARTNER DETAIL

Аналогично.

------------------------------------------------------------------------

# 24. ORDERS RELATION

CRM не должен создавать вторую order truth.

Использовать canonical Orders domain.

Проверить:

``` text
customer → orders
partner → orders
```

------------------------------------------------------------------------

# 25. BOOKINGS RELATION

Использовать Booking domain authority.

Не копировать booking status logic в CRM.

------------------------------------------------------------------------

# 26. PAYMENTS RELATION

CRM показывает financial relationship, но не становится Payment
authority.

------------------------------------------------------------------------

# 27. SUBSCRIPTION RELATION

Для Storefront Partner:

использовать Step 3.29D authority:

``` text
SubscriptionContract
SubscriptionInvoice
SubscriptionPayment
```

Не использовать `priceUsd` как contracted revenue authority.

------------------------------------------------------------------------

# 28. CUSTOMER VALUE METRICS

Если CRM уже показывает:

``` text
orders count
bookings count
GMV
paid amount
```

проверить formulas.

Не придумывать:

``` text
CLV
predicted value
churn probability
```

без canonical requirement.

------------------------------------------------------------------------

# 29. FINANCIAL SEMANTICS

Любая CRM financial card должна ссылаться на уже frozen financial
authority.

Не создавать альтернативный GMV/Revenue definition.

------------------------------------------------------------------------

# 30. ACTIVITY / INTERACTION HISTORY

Проверить существующие sources:

``` text
orders
bookings
payments
messages
notes
status changes
```

Если unified timeline предусмотрен Step 3.5 --- реализовать
evidence-based.

Если нет --- не расширять scope.

------------------------------------------------------------------------

# 31. NOTES

Проверить, предусмотрены ли CRM notes.

Если существуют:

``` text
author
createdAt
updatedAt
visibility
tenant
permissions
```

Если отсутствуют и roadmap требует --- реализовать.

------------------------------------------------------------------------

# 32. TAGS / SEGMENTS

Проверить requirement.

Не строить segmentation engine без canonical scope.

------------------------------------------------------------------------

# 33. OWNERSHIP / ASSIGNMENT

Проверить, предусмотрено ли назначение:

``` text
sales manager
operator
account manager
```

Если да --- authority должна использовать Employees/RBAC architecture.

------------------------------------------------------------------------

# 34. EMPLOYEE PERFORMANCE BOUNDARY

CRM assignment ≠ Employee Performance.

Не реализовывать Employee Performance в Step 3.5, если roadmap не
включает его сюда.

------------------------------------------------------------------------

# 35. CUSTOMER STATUS

Если существует lifecycle:

``` text
ACTIVE
INACTIVE
BLOCKED
etc.
```

проверить canonical enums и transitions.

Не изобретать lifecycle.

------------------------------------------------------------------------

# 36. PARTNER STATUS

Аналогично.

------------------------------------------------------------------------

# 37. MUTATIONS

Составить полный список CRM mutations:

``` text
create?
edit?
note?
tag?
assign?
status change?
```

Для каждой:

``` text
permission
validation
tenant scope
auditability
error handling
```

------------------------------------------------------------------------

# 38. READ-ONLY FIELDS

Derived/system fields нельзя редактировать вручную.

Например:

``` text
order totals
payment totals
booking history
subscription collected
```

------------------------------------------------------------------------

# 39. RBAC --- PAGE

Определить canonical CRM page permission.

Не использовать только frontend hiding.

------------------------------------------------------------------------

# 40. RBAC --- ACTIONS

Для каждой mutation нужен server-side permission.

------------------------------------------------------------------------

# 41. ROLE MATRIX

Проверить current roles:

``` text
ADMIN
DIRECTOR
ANALYST
MARKETER
FINANCE
MODERATOR
SALES_MANAGER
OPERATOR
```

Определить CRM access из существующей architecture.

Не выдавать всем доступ автоматически.

------------------------------------------------------------------------

# 42. FIELD-LEVEL PRIVACY

CRM содержит PII.

Проверить:

``` text
email
phone
address
legal/company data
```

Доступ должен соответствовать роли/workspace.

------------------------------------------------------------------------

# 43. PLATFORM VS PARTNER

Критический gate.

``` text
PLATFORM workspace
PARTNER workspace
```

должны видеть разные CRM scopes.

------------------------------------------------------------------------

# 44. TENANT ISOLATION

Partner A не должен видеть:

``` text
Partner B customers
Partner B orders
Partner B bookings
Partner B notes
Partner B subscription data
```

------------------------------------------------------------------------

# 45. PLATFORM AGGREGATE VIEW

Platform internal roles могут иметь cross-partner view только если
permission это разрешает.

------------------------------------------------------------------------

# 46. MARKETPLACE BASIC / STOREFRONT PRO

Проверить entitlement architecture:

``` text
Marketplace Basic
Storefront Pro
```

CRM capability должна соответствовать current plan policy.

------------------------------------------------------------------------

# 47. STOREfront PRO

Ранее Storefront Pro включал CRM.

Проверить actual entitlement gate.

------------------------------------------------------------------------

# 48. MARKETPLACE BASIC

Не давать Full CRM, если architecture его не предусматривает.

------------------------------------------------------------------------

# 49. API CONTRACT

Для CRM endpoints проверить:

``` text
pagination
filters
sorting
validation
authorization
workspace scope
stable response DTO
```

------------------------------------------------------------------------

# 50. N+1

Detail/list endpoints не должны делать очевидный per-row query
explosion.

------------------------------------------------------------------------

# 51. DATA AGGREGATION

Counts/totals лучше агрегировать server-side.

Не переносить большие datasets во frontend ради вычислений.

------------------------------------------------------------------------

# 52. DATABASE INDEXES

Проверить indexes для реально используемых CRM search/filter paths.

Миграции добавлять только при доказанном gap.

------------------------------------------------------------------------

# 53. PII SEARCH

Не использовать небезопасные raw SQL/string interpolation.

------------------------------------------------------------------------

# 54. INPUT VALIDATION

Проверить DTO validation для CRM mutations/search params.

------------------------------------------------------------------------

# 55. PHONE / EMAIL

Не вводить overly strict validation, ломающую международные данные, без
architecture requirement.

------------------------------------------------------------------------

# 56. LOCALIZATION

CRM должен поддерживать:

``` text
RU
AZ
EN
```

------------------------------------------------------------------------

# 57. NO RAW KEYS

Runtime:

``` text
raw i18n keys = 0
```

------------------------------------------------------------------------

# 58. NO MIXED LOCALE

Проверить:

``` text
titles
filters
buttons
table headers
statuses
empty states
errors
detail sections
```

------------------------------------------------------------------------

# 59. ENUM LOCALIZATION

Raw enums не должны отображаться пользователю.

------------------------------------------------------------------------

# 60. CURRENCY

Financial values:

``` text
AZN / ₼
```

по canonical display policy.

------------------------------------------------------------------------

# 61. DATE / TIME

Использовать consistent locale/timezone formatting.

------------------------------------------------------------------------

# 62. LOADING STATE

No blank page while fetching.

------------------------------------------------------------------------

# 63. EMPTY STATE

Meaningful localized empty state.

------------------------------------------------------------------------

# 64. ERROR STATE

API errors не должны превращаться в silent empty list.

------------------------------------------------------------------------

# 65. NOT FOUND

Detail route должен корректно обрабатывать missing entity.

------------------------------------------------------------------------

# 66. FORBIDDEN

403 должен отличаться от 404/empty state.

------------------------------------------------------------------------

# 67. BREADCRUMBS / NAVIGATION

Проверить соответствие существующей navigation architecture.

Не создавать новую navigation model.

------------------------------------------------------------------------

# 68. DEEP LINKS

Customer/partner detail URL должен быть stable и reload-safe.

------------------------------------------------------------------------

# 69. QUERY STATE

Если filters/search используются:

предпочтительно сохранять state в URL, если existing centers следуют
этой architecture.

Сначала проверить pattern проекта.

------------------------------------------------------------------------

# 70. COMMAND CENTER INTEGRATION

Если Command Center cards:

``` text
Marketplace Customers
Storefront Customers
Marketplace Partners
Storefront Partners
```

кликабельны или roadmap требует navigation:

CRM должен быть canonical destination.

Не менять Command Center без необходимости.

------------------------------------------------------------------------

# 71. DECISION ACTION INTEGRATION

Если Decision Queue actions ведут к customer/partner context ---
проверить routes.

Не расширять Stage F action model.

------------------------------------------------------------------------

# 72. MESSAGES INTEGRATION

Если CRM profile показывает communication context:

использовать existing Messages/Chat authority.

------------------------------------------------------------------------

# 73. DUPLICATE PROFILE DATA

Не копировать customer/partner fields в CRM-specific table без
необходимости.

------------------------------------------------------------------------

# 74. AUDITABILITY

Для CRM mutations проверить existing audit/event architecture.

Если canonical audit system существует --- интегрировать.

Не строить новый audit framework в этом step.

------------------------------------------------------------------------

# 75. SOFT DELETE / ARCHIVE

Проверить current domain policy.

Не hard-delete business history, если linked orders/bookings/payments
существуют.

------------------------------------------------------------------------

# 76. REFERENTIAL INTEGRITY

CRM entity removal/status changes не должны ломать historical records.

------------------------------------------------------------------------

# 77. GAP MATRIX --- REQUIRED BEFORE IMPLEMENTATION

После audit построить:

  Requirement   Current   Gap   Severity   Action
  ------------- --------- ----- ---------- --------

Классификация:

``` text
A — COMPLETE
B — PARTIAL
C — MISSING
D — DEFECT
E — OUT_OF_SCOPE
F — BLOCKED
```

------------------------------------------------------------------------

# 78. IMPLEMENTATION GATE

Production implementation разрешена только для:

``` text
B — PARTIAL
C — MISSING
D — DEFECT
```

если они входят в canonical Step 3.5.

------------------------------------------------------------------------

# 79. NO BLIND REWRITE

Если capability уже COMPLETE:

``` text
do not rewrite
```

только regression evidence.

------------------------------------------------------------------------

# 80. BLOCKED ITEMS

Если canonical requirement нельзя реализовать из-за отсутствующей
dependency:

``` text
F — BLOCKED
```

и VERDICT A запрещён, если requirement mandatory.

------------------------------------------------------------------------

# 81. MIGRATION POLICY

Schema migration допустима только если Step 3.5 реально требует
persistent data, которого нет.

Каждую migration обосновать.

------------------------------------------------------------------------

# 82. SEED POLICY

Не менять seed только ради красивого UI.

Если нужны representative records для test/runtime --- использовать
existing test/seed architecture.

------------------------------------------------------------------------

# 83. BACKWARD COMPATIBILITY

Не ломать existing:

``` text
Orders
Bookings
Payments
Command Center
Partner workspaces
Billing
```

------------------------------------------------------------------------

# 84. CRM LIST TESTS

Минимум:

``` text
load
search
filter
sort
pagination
empty
error
RBAC
tenant scope
```

------------------------------------------------------------------------

# 85. CRM DETAIL TESTS

Минимум:

``` text
customer
partner
related orders
related bookings
financial data
not found
forbidden
```

по implemented scope.

------------------------------------------------------------------------

# 86. MUTATION TESTS

Для каждой implemented mutation:

``` text
success
validation failure
permission denial
cross-tenant denial
```

------------------------------------------------------------------------

# 87. SECURITY NEGATIVE TESTS

Обязательно:

``` text
unauthorized role
partner A → partner B
Settings/URL manipulation
direct API access
```

------------------------------------------------------------------------

# 88. DB/API/UI RECONCILIATION

Representative entities:

``` text
customer
partner
```

Проверить ключевые counts/financial summaries:

``` text
DB = API = UI
```

------------------------------------------------------------------------

# 89. CUSTOMER COUNT RECONCILIATION

Согласовать CRM list/count с Command Center:

``` text
Marketplace Customers
Storefront Customers
```

если semantics одинаковы.

Если semantics различаются --- документировать.

------------------------------------------------------------------------

# 90. PARTNER COUNT RECONCILIATION

Аналогично:

``` text
Marketplace Partners
Storefront Partners
```

------------------------------------------------------------------------

# 91. NO SECOND COUNT TRUTH

CRM и Command Center не должны считать одного и того же KPI разными
формулами.

------------------------------------------------------------------------

# 92. PERFORMANCE

Проверить representative:

``` text
CRM list load
search
detail
```

Вернуть timings.

Не оптимизировать без regression evidence.

------------------------------------------------------------------------

# 93. BROWSER RUNTIME --- REQUIRED

Step 3.5 нельзя закрыть только unit tests.

Проверить actual browser.

------------------------------------------------------------------------

# 94. BROWSER --- PLATFORM

Минимум:

``` text
CRM list
customer detail
partner detail
search/filter
related data
```

------------------------------------------------------------------------

# 95. BROWSER --- PARTNER

Проверить allowed CRM view согласно entitlement/workspace.

------------------------------------------------------------------------

# 96. BROWSER --- NEGATIVE

Restricted role / cross-tenant scenario.

------------------------------------------------------------------------

# 97. BROWSER --- RU/AZ/EN

Representative CRM screens во всех трёх locales.

------------------------------------------------------------------------

# 98. RAW STRING GATES

Проверить runtime/source relevant areas:

``` text
raw i18n keys
raw enum names
CJK
mixed locale
unexpected USD/$
system identifiers
```

------------------------------------------------------------------------

# 99. ACCESSIBILITY / UX SANITY

Проверить минимум:

``` text
button labels
form labels
keyboard-accessible controls where existing component library supports it
table semantics
disabled/loading state
```

Не превращать Step 3.5 в full accessibility redesign.

------------------------------------------------------------------------

# 100. REGRESSION --- BACKEND

Запустить:

``` text
CRM tests
RBAC/security tests
Orders/Bookings relevant integration
billing relevant tests
dashboard relevant tests
full feasible backend suite
TSC
build
```

------------------------------------------------------------------------

# 101. REGRESSION --- FRONTEND

Запустить:

``` text
CRM tests
navigation
i18n
Command Center relevant tests
full feasible frontend suite
TSC
build
```

------------------------------------------------------------------------

# 102. ROADMAP STATUS

Только после VERDICT A обновить:

``` text
Phase 3 — Step 3.5 — CRM Completion → COMPLETE
```

Additive.

Не менять следующий stage автоматически.

------------------------------------------------------------------------

# 103. DEFERRED DEBT

Не закрывать unrelated:

``` text
Channel Health priceUsd P2
remaining priceUsd consumers
totalPaidUsd legacy
commission reversal
PSP
tax/refund engine
```

если CRM не зависит от них.

------------------------------------------------------------------------

# 104. REQUIRED DELIVERABLE A --- ENTRY

``` text
Starting HEAD:
origin/master:
Working tree:
Canonical Step 3.5 reference:
Dependencies:
```

------------------------------------------------------------------------

# 105. REQUIRED DELIVERABLE B --- CURRENT INVENTORY

``` text
Backend:
Frontend:
Database:
Routes:
Permissions:
Tests:
```

------------------------------------------------------------------------

# 106. REQUIRED DELIVERABLE C --- IDENTITY MODEL

``` text
Customer:
Marketplace Customer:
Storefront Customer:
Partner:
Partner User:
Partner Organization:
Storefront:
```

с canonical mapping.

------------------------------------------------------------------------

# 107. REQUIRED DELIVERABLE D --- GAP MATRIX

Полная таблица до implementation.

------------------------------------------------------------------------

# 108. REQUIRED DELIVERABLE E --- IMPLEMENTATION

Для каждого исправленного gap:

``` text
Gap ID:
Root cause/current limitation:
Implementation:
Files:
Tests:
Runtime evidence:
```

------------------------------------------------------------------------

# 109. REQUIRED DELIVERABLE F --- CRM LIST

``` text
search:
filters:
sorting:
pagination:
states:
```

------------------------------------------------------------------------

# 110. REQUIRED DELIVERABLE G --- CUSTOMER DETAIL

``` text
identity:
contacts:
orders:
bookings:
payments:
activity:
other canonical sections:
```

------------------------------------------------------------------------

# 111. REQUIRED DELIVERABLE H --- PARTNER DETAIL

Аналогично.

------------------------------------------------------------------------

# 112. REQUIRED DELIVERABLE I --- RBAC / PRIVACY

``` text
Page permission:
Action permissions:
Role defaults:
PII:
Platform:
Partner:
Entitlements:
```

------------------------------------------------------------------------

# 113. REQUIRED DELIVERABLE J --- TENANT ISOLATION

``` text
positive:
negative:
API:
browser:
```

------------------------------------------------------------------------

# 114. REQUIRED DELIVERABLE K --- DATA RECONCILIATION

``` text
Customer counts:
Partner counts:
Related orders:
Related bookings:
Financial summaries:
DB/API/UI:
```

------------------------------------------------------------------------

# 115. REQUIRED DELIVERABLE L --- LOCALIZATION

``` text
RU:
AZ:
EN:
raw keys:
raw enums:
mixed locale:
CJK:
currency:
```

------------------------------------------------------------------------

# 116. REQUIRED DELIVERABLE M --- PERFORMANCE

``` text
list:
search:
detail:
N+1:
```

------------------------------------------------------------------------

# 117. REQUIRED DELIVERABLE N --- TESTS

Exact counts:

``` text
Backend:
Frontend:
CRM:
Security:
i18n:
TSC:
Build:
Browser:
```

------------------------------------------------------------------------

# 118. REQUIRED DELIVERABLE O --- FINDINGS

  ID   Severity   Finding   Root Cause   Fix   Evidence   Status
  ---- ---------- --------- ------------ ----- ---------- --------

------------------------------------------------------------------------

# 119. REQUIRED DELIVERABLE P --- GIT

``` text
Starting HEAD:
Final HEAD:
Files changed:
New files:
Migrations:
Commit:
Pushed:
origin/master:
Working tree clean:
```

------------------------------------------------------------------------

# 120. REPORT

Создать:

``` text
docs/prompts/PHASE_3_STEP_3_5_CRM_COMPLETION_REPORT.md
```

Отчёт полностью на русском.

------------------------------------------------------------------------

# 121. ACCEPTANCE --- CANONICAL / INVENTORY

VERDICT A только если:

1.  Exact Step 3.5 requirements established.
2.  Current CRM inventory completed.
3.  Existing completed capabilities not blindly rewritten.
4.  Customer identity model established.
5.  Partner identity model established.
6.  Marketplace/Storefront distinction established.
7.  Gap matrix produced before implementation.
8.  Only canonical gaps implemented.

------------------------------------------------------------------------

# 122. ACCEPTANCE --- CRM FUNCTIONAL

9.  CRM list works.
10. Search works where required.
11. Filters work where required.
12. Sorting works where required.
13. Pagination works.
14. Loading state works.
15. Empty state works.
16. Error state works.
17. Customer detail meets canonical scope.
18. Partner detail meets canonical scope.
19. Related Orders use Orders authority.
20. Related Bookings use Booking authority.
21. Payments use Payment authority.
22. Storefront billing uses Step 3.29D authority.
23. No duplicate financial truth.
24. No duplicate customer/partner count truth.

------------------------------------------------------------------------

# 123. ACCEPTANCE --- SECURITY

25. Page RBAC server-side.
26. Mutation RBAC server-side.
27. PII access policy enforced.
28. PLATFORM/PARTNER separation passes.
29. Partner cross-tenant access denied.
30. Direct API bypass denied.
31. Entitlements preserved.
32. Marketplace Basic not accidentally granted Full CRM.
33. Storefront Pro policy preserved.

------------------------------------------------------------------------

# 124. ACCEPTANCE --- DATA / UX

34. Customer count reconciles where semantics match.
35. Partner count reconciles where semantics match.
36. Representative DB/API/UI reconciliation passes.
37. No unexplained integrity defects.
38. No obvious N+1 regression.
39. Stable navigation/deep links.
40. Not-found handled.
41. Forbidden handled distinctly.
42. System-derived fields not manually editable.

------------------------------------------------------------------------

# 125. ACCEPTANCE --- LOCALIZATION / RUNTIME

43. RU PASS.
44. AZ PASS.
45. EN PASS.
46. Raw i18n keys runtime = 0.
47. Raw enums runtime = 0.
48. Mixed locale fragments = 0.
49. CJK = 0.
50. Currency semantics correct.
51. Browser Platform CRM PASS.
52. Browser Partner CRM PASS where allowed.
53. Browser restricted-role case PASS.
54. Browser cross-tenant case PASS.

------------------------------------------------------------------------

# 126. ACCEPTANCE --- REGRESSION

55. Backend relevant tests PASS.
56. Frontend relevant tests PASS.
57. Security tests PASS.
58. CRM tests PASS.
59. i18n tests PASS.
60. Backend TSC clean.
61. Frontend TSC clean.
62. Backend build clean.
63. Frontend build clean.
64. No P0/P1 open.
65. No unrelated deferred debt falsely marked resolved.
66. Report created.
67. Roadmap updated only after successful closure.

------------------------------------------------------------------------

# 127. FINAL VERDICT

Вернуть ровно один:

## VERDICT A --- STEP 3.5 CRM COMPLETION VERIFIED / CRM PRODUCTION WORKSPACE CLOSED / READY FOR ROADMAP RE-EVALUATION

или:

## VERDICT B --- STEP 3.5 CRM REMEDIATION REQUIRED

Разделить gaps:

``` text
Canonical Scope:
CRM List:
Customer Detail:
Partner Detail:
Relations:
RBAC:
Privacy:
Tenant Isolation:
Entitlements:
Localization:
Runtime:
Performance:
Tests:
```

или:

## VERDICT C --- STEP 3.5 CRM BLOCKED / REQUIRED DEPENDENCY MISSING

Только при реальном blocking dependency.

------------------------------------------------------------------------

# 128. STOP

После VERDICT:

**STOP.**

Не запускать следующий roadmap stage автоматически. Не реализовывать
Employee Performance. Не возвращаться к Command Center без отдельного
requirement.
