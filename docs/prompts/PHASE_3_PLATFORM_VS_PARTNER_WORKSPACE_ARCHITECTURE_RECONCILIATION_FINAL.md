# TRAVELHUB — PHASE 3 — PLATFORM VS PARTNER WORKSPACE — ARCHITECTURE RECONCILIATION ADDENDUM

> **ОБЯЗАТЕЛЬНЫЙ ЯЗЫК**
>
> Все ответы разработчика пользователю, промежуточные статусы, пояснения, findings, design decisions и итоговый summary должны быть **на русском языке**.
>
> Английский допускается только для кода, команд, путей, API routes, identifiers и канонических технических статусов.

---

# 1. ЦЕЛЬ

До начала реализации/финализации:

`PHASE 3 — STEP 3.2 — DASHBOARD / COMMAND CENTER UI`

выполнить отдельный **Architecture Reconciliation Addendum**, который канонически разделит два бизнес-контекста TravelHub:

```text
A. TRAVELHUB MARKETPLACE / PLATFORM OPERATOR WORKSPACE
B. PARTNER STOREFRONT / SELLER WORKSPACE
```

и определит, как должны различаться:

- Command Center;
- Dashboard widgets;
- левое меню;
- Analytics;
- Sales;
- Orders;
- Bookings;
- CRM;
- Finance;
- Employees;
- Communications;
- moderation/support functions;
- permissions;
- business capabilities;
- channel analytics.

Этот pass — только architecture/design reconciliation.

**Production implementation не начинать.**

---

# 2. ПРОБЛЕМА, КОТОРУЮ НУЖНО ЗАКРЫТЬ

Текущая архитектура уже имеет:

- Step 3.1 Dashboard Backend;
- Step 3.3 Analytics Foundation;
- Step 3.3E Global Workspace Constructor;
- Step 3.2 UI Design/UX Contract.

Но необходимо исключить ошибочную предпосылку:

```text
ONE DASHBOARD CONTENT MODEL FOR ALL USERS
```

TravelHub имеет как минимум два разных бизнес-контура.

---

# 3. BUSINESS CONTEXT A — TRAVELHUB MARKETPLACE

TravelHub выступает как оператор платформы/маркетплейса:

```text
Partners
→ TravelHub Marketplace
→ Customers
```

Монетизация:

```text
COMMISSION FROM SALES
```

TravelHub управляет marketplace operations.

Типовые обязанности сотрудников TravelHub:

- регистрация/верификация партнёров;
- рассмотрение заявок;
- onboarding;
- модерация размещений;
- модерация контента;
- контроль качества;
- moderation queues;
- complaints/disputes;
- support;
- fraud/abuse;
- payment/reconciliation oversight;
- commission control;
- marketplace performance;
- partner performance;
- platform customer support.

---

# 4. BUSINESS CONTEXT B — PARTNER STOREFRONT

TravelHub предоставляет партнёру собственную отдельную витрину:

```text
Partner Brand
→ Partner Storefront
→ Partner Customers
```

Монетизация TravelHub:

```text
SUBSCRIPTION / STORE USE FEE
```

В этом контексте TravelHub предоставляет SaaS-инфраструктуру.

Партнёр сам управляет:

- продажами;
- клиентами;
- сотрудниками;
- доступами;
- заказами;
- бронированиями;
- своими товарами/услугами;
- коммуникациями;
- внутренней аналитикой;
- операционными процессами.

TravelHub не является обычным участником внутренних коммуникаций партнёра.

---

# 5. HARD ARCHITECTURAL DISTINCTION

Зафиксировать:

```text
PLATFORM WORKSPACE ≠ PARTNER WORKSPACE
```

и:

```text
MARKETPLACE CHANNEL ≠ SELLER STOREFRONT CHANNEL
```

Это не две независимые системы.

Это:

```text
ONE PLATFORM
+ CONTEXT-AWARE WORKSPACES
```

---

# 6. ЕДИНЫЙ FRAMEWORK, РАЗНОЕ СОДЕРЖАНИЕ

Нельзя создавать:

```text
TravelHubDashboard.tsx
HotelDashboard.tsx
TourDashboard.tsx
TransferDashboard.tsx
...
```

как независимые архитектуры.

Нужно:

```text
GLOBAL WORKSPACE FRAMEWORK
        ↓
CONTEXT
        ↓
CAPABILITIES
        ↓
ROLE
        ↓
USER LAYOUT
```

---

# 7. РАСШИРЕННАЯ ИЕРАРХИЯ WORKSPACE

Текущая модель:

```text
SYSTEM DEFAULT
→ ROLE DEFAULT
→ USER LAYOUT
```

должна быть архитектурно reconciled с контекстом:

```text
PLATFORM / TENANT CONTEXT
        ↓
BUSINESS CAPABILITIES
        ↓
ROLE DEFAULT
        ↓
USER LAYOUT
```

Нужно определить, как новая логика сочетается с уже APPROVED Workspace Constructor Foundation.

Не ломать существующий foundation без необходимости.

---

# 8. PLATFORM / TENANT CONTEXT

Определить canonical context identifier.

Минимально рассмотреть:

```text
PLATFORM
PARTNER
```

В будущем допускаются дополнительные контексты только при реальной authority.

Не использовать роль пользователя как замену workspace context.

---

# 9. ROLE ≠ CONTEXT

Hard rule:

```text
ROLE ≠ BUSINESS CONTEXT
```

Например:

- DIRECTOR TravelHub;
- DIRECTOR/OWNER партнёра;

могут иметь одинаково звучащую роль, но совершенно разные данные и рабочие задачи.

Нужно определить, как canonical authorization model различает это.

---

# 10. BUSINESS CAPABILITIES

Partner Workspace не должен зависеть только от типа страницы или role.

Содержание должно определяться **capabilities бизнеса**.

Примеры:

## Accommodation

- inventory;
- rooms/units;
- availability;
- check-in/check-out;
- occupancy;
- ADR;
- cancellation;
- booking lead time.

## Tours / Activities

- tours;
- departures;
- schedules;
- seats;
- participants;
- guides;
- capacity utilization.

## Transfers

- transfers;
- drivers;
- vehicles;
- assignments;
- upcoming transfers;
- completed transfers.

## Generic Services

- service catalog;
- schedules;
- capacity;
- bookings;
- fulfillment.

Это examples для capability analysis, не authority для немедленной реализации.

---

# 11. CAPABILITY MODEL — DESIGN TASK

Repository-first определить:

- есть ли уже product/category/capability model;
- можно ли вывести capabilities из текущих canonical entities;
- требуется ли отдельная future capability registry;
- что можно использовать прямо сейчас;
- какие gaps существуют.

Не создавать schema в этом pass.

---

# 12. TRAVELHUB PLATFORM COMMAND CENTER

Спроектировать concept-level content model для TravelHub Director.

Минимально рассмотреть sections:

## Marketplace

- GMV;
- Orders;
- Bookings;
- Conversion;
- AOV;
- marketplace activity.

## Partners

- new applications;
- pending verification;
- approved;
- rejected;
- inactive/problem partners.

## Moderation

- listings awaiting review;
- moderation backlog;
- rejected content;
- SLA breaches — только если authority существует.

## Financial

- commission;
- payments;
- refunds;
- reconciliation.

## Support / Risk

- complaints;
- disputes;
- unresolved support;
- fraud/abuse indicators — только если canonical source exists.

## Employees / Operations

- workload;
- SLA;
- task completion;
- later employee analytics.

Не реализовывать metrics без canonical source.

---

# 13. PARTNER COMMAND CENTER

Спроектировать отдельную content model для владельца/директора партнёра.

Common sections:

## Sales

- sales;
- revenue;
- orders;
- AOV;
- conversion.

## Bookings / Fulfillment

- new;
- confirmed;
- upcoming;
- completed;
- cancelled.

## Customers

- new customers;
- returning customers;
- communications;
- conversion.

## Employees

- employees;
- permissions;
- workload;
- later performance analytics.

## Finance

- payments;
- refunds;
- reconciliation;
- partner financial metrics.

## Communications

- unread;
- unanswered;
- response time;
- omnichannel later.

## Business-specific capabilities

- accommodation;
- tours;
- transfer;
- other service-specific widgets.

---

# 14. COMMON VS CONTEXT-SPECIFIC WIDGETS

Разделить Widget Registry conceptual taxonomy:

## GLOBAL / COMMON

Примеры:

- Revenue KPI;
- Orders KPI;
- Trend Chart;
- Customers;
- Tasks.

## PLATFORM-SPECIFIC

Примеры:

- Partner Applications;
- Moderation Queue;
- Marketplace Commission;
- Marketplace Support.

## PARTNER-SPECIFIC

Примеры:

- Employee Workload;
- Storefront Sales;
- Partner Customers;
- Store Settings.

## CAPABILITY-SPECIFIC

Примеры:

- Occupancy;
- Seats Available;
- Driver Assignment.

Не добавлять widgets production-side в этом pass.

---

# 15. PAGE REGISTRY IMPACT

Определить, достаточно ли текущего:

```text
pageId
```

или эффективная workspace definition должна учитывать:

```text
pageId
+ workspaceContext
+ capabilities
+ role
```

Не менять persistence без design conclusion.

---

# 16. WORKSPACE LAYOUT KEY

Очень важный вопрос.

Текущий persistence key:

```text
(userId, pageId)
```

Проверить, достаточно ли его, если один пользователь потенциально может иметь:

- Platform workspace;
- Partner workspace;
- несколько partner contexts.

Рассмотреть необходимость future key:

```text
(userId, contextId, pageId)
```

или repository-equivalent.

Если current architecture уже гарантирует один context per user — доказать.

Если нет — классифицировать как architecture gap до широкого rollout.

---

# 17. MULTI-PARTNER / MULTI-CONTEXT USER

Repository-first проверить:

может ли один User:

- принадлежать нескольким партнёрам;
- быть сотрудником TravelHub и партнёра;
- переключаться между organizations;
- иметь несколько roles/contexts.

Это критично для Workspace Constructor.

Не угадывать.

---

# 18. CONTEXT SWITCHING

Если multi-context supported/planned, определить UX concept:

```text
TravelHub
Partner A
Partner B
```

через organization/workspace switcher.

Не реализовывать сейчас.

---

# 19. LEFT NAVIGATION — CONTEXT AWARE

Зафиксировать:

```text
LEFT MENU MUST BE CONTEXT-AWARE
```

Не один одинаковый menu для всех.

---

# 20. PLATFORM LEFT MENU

Conceptual target:

```text
Command Center
Marketplace
Partners
Moderation
Sales
Orders
Bookings
Customers
Finance
Support
Analytics
Employees
Marketing
Documents
Settings
```

Repository-first проверить canonical pages.

Не создавать отсутствующие routes автоматически.

---

# 21. PARTNER LEFT MENU

Conceptual target:

```text
Command Center
Sales
Orders
Bookings
Customers
Messages
Employees
Analytics
Finance
Products / Services
Marketing
Storefront Settings
Company Settings
```

Business capability modules могут добавлять предметные sections.

---

# 22. CAPABILITY-DRIVEN NAVIGATION

Для Accommodation:

```text
Properties
Rooms / Units
Rates
Availability
```

Для Tours:

```text
Tours
Departures
Schedules
Seats
```

Для Transfers:

```text
Transfers
Vehicles
Drivers
Assignments
```

Это future navigation capability model.

Не реализовывать сейчас.

---

# 23. MARKETPLACE + STOREFRONT SIMULTANEOUSLY

Hard requirement:

один партнёр может одновременно:

1. продавать через TravelHub Marketplace;
2. иметь собственную Storefront.

Это должны быть два sales/acquisition channels, а не две разные customer identities.

---

# 24. CHANNEL DIMENSION

Analytics должен различать минимум:

```text
TRAVELHUB_MARKETPLACE
PARTNER_STOREFRONT
```

Проверить, можно ли это выразить через Step 3.3 acquisition/channel dimensions.

Если current model недостаточен — зафиксировать gap.

Не менять Step 3.3 implementation в этом pass.

---

# 25. PARTNER ANALYTICS BY CHANNEL

Будущий Partner Analytics должен позволять:

```text
ALL SALES
TRAVELHUB MARKETPLACE
MY STOREFRONT
```

и сравнивать:

- sales;
- GMV/revenue;
- commission;
- conversion;
- customers;
- acquisition.

Без смешивания commission/subscription semantics.

---

# 26. MONETIZATION DISTINCTION

Hard rule:

## Marketplace

```text
TravelHub monetization = commission
```

## Partner Storefront

```text
TravelHub monetization = subscription
```

Не применять marketplace commission logic автоматически к storefront channel.

Не менять finance implementation сейчас.

---

# 27. COMMUNICATION OWNERSHIP

Зафиксировать communication isolation model.

## Customer ↔ Partner

Принадлежит Partner workspace.

## Customer ↔ TravelHub

Принадлежит Platform support workspace.

## Partner ↔ TravelHub

Отдельный platform-partner support/compliance channel.

---

# 28. PARTNER MESSAGE PRIVACY

TravelHub owners/admins не должны иметь обычный unrestricted access к Partner↔Customer conversations.

Доступ TravelHub возможен только при отдельной future authority:

- complaint;
- fraud;
- safety;
- legal;
- technical support;

с privileged access + reason + audit trail.

Это future hard requirement для Communications/Omnichannel.

---

# 29. SOCIAL / OMNICHANNEL FUTURE MODEL

Зафиксировать для будущей реализации:

```text
Instagram/Facebook/TikTok
→ Partner Omnichannel Inbox
→ CRM External Contact
→ Partner Operator
→ Reply back to original channel
```

Если клиент не зарегистрирован:

```text
Social Identity
→ CRM Contact
→ Optional TravelHub Account later
```

Автоматическую авторизацию не создавать.

Не реализовывать сейчас.

---

# 30. CRM IDENTITY MODEL

Future conceptual distinction:

```text
Customer / CRM Contact
≠ TravelHub User Account
≠ Social Identity
```

Один CRM contact может иметь:

- TravelHub account;
- Instagram;
- Facebook;
- TikTok;
- email;
- phone.

Не создавать schema в этом pass.

---

# 31. EMPLOYEE AUTHORITY — PLATFORM

TravelHub employees получают platform-level permissions:

- DIRECTOR;
- FINANCE;
- MODERATOR;
- SALES_MANAGER;
- OPERATOR;
- etc.

Проверить текущую canonical RoleCode model.

---

# 32. EMPLOYEE AUTHORITY — PARTNER

Partner employees должны получать permissions **внутри конкретного partner tenant**, а не platform-wide.

Нужно определить current repository readiness:

- partner membership;
- partner employee roles;
- ownership;
- permission scope.

Если такой model отсутствует — это важный future authority gap.

---

# 33. PARTNER OWNER / ADMIN

Для Partner Workspace нужен canonical actor, который может:

- manage employees;
- assign rights;
- manage storefront;
- view full partner analytics.

Проверить, существует ли authority сейчас.

Не придумывать новый role silently.

---

# 34. EMPLOYEE ANALYTICS

Разделить:

## TravelHub Employee Analytics

- moderation productivity;
- partner onboarding;
- support workload;
- operational SLA.

## Partner Employee Analytics

- sales;
- client communication;
- booking processing;
- service fulfillment;
- role-specific outcomes.

Оба используют общую Analytics Foundation, но разные facts/scopes.

---

# 35. ACTIVITY ≠ EFFECTIVENESS

Сохранить:

```text
ACTIVITY ≠ EFFECTIVENESS
```

Низкая platform activity при хороших business outcomes не является автоматически плохим результатом.

---

# 36. CONTEXT-AWARE COMMAND CENTER FRAMEWORK

Target architecture:

```text
Command Center Framework
        │
        ├── Platform Context
        │     └── Platform Widget Set
        │
        └── Partner Context
              ├── Common Partner Widget Set
              └── Capability Widget Set
```

---

# 37. CONTEXT-AWARE ANALYTICS

Analytics UI и backend consumers должны учитывать:

```text
context
+ tenant/partner scope
+ channel
+ capabilities
+ role
```

Не создавать separate analytics engines.

---

# 38. CONTEXT-AWARE SALES / ORDERS / BOOKINGS

Нужно определить, являются ли эти страницы:

- общими components с scoped data;
- разными route modes;
- context-specific workspaces.

Design должен рекомендовать one framework / different scope where possible.

---

# 39. MODERATION

Moderation — platform concern.

Partner Workspace не должен видеть platform moderation operations, кроме статуса собственных submissions/objects, если canonical product UX это предусматривает.

---

# 40. SUPPORT

Различить:

## Platform Support

TravelHub обслуживает:

- customers;
- partners;
- platform incidents.

## Partner Customer Support

Partner обслуживает своих customers.

Не смешивать inbox/permissions.

---

# 41. FINANCE

Platform Finance:

- commissions;
- partner settlements;
- platform reconciliation;
- refunds/disputes.

Partner Finance:

- own sales;
- own payments;
- own refunds;
- storefront performance.

Не смешивать authorities.

---

# 42. BUSINESS TYPE VS PRODUCT CATEGORY

Не использовать обычную product category автоматически как organization business type, если repository authority это не подтверждает.

Нужно проверить, как canonical system различает:

- accommodation supplier;
- tour operator;
- transfer provider;
- multi-service seller.

---

# 43. MULTI-CAPABILITY PARTNER

Партнёр может продавать несколько типов продуктов.

Следовательно:

```text
BUSINESS TYPE = SINGLE ENUM
```

может быть слишком ограничивающим.

Предпочтительно рассмотреть:

```text
PARTNER CAPABILITIES = SET
```

если repository architecture это поддерживает.

---

# 44. GLOBAL WORKSPACE CONSTRUCTOR IMPACT

Проверить, требуется ли future extension Page/Widget Registry:

```text
context compatibility
capability requirements
tenant scope
channel compatibility
```

Не менять implementation в этом pass.

---

# 45. WIDGET REGISTRY FUTURE CONTRACT

Conceptual fields рассмотреть:

```text
contexts[]
requiredCapabilities[]
channelScope
permission
dataSource
```

Только если это действительно нужно.

---

# 46. DEFAULT LAYOUTS

Вместо одного global Director default может понадобиться:

```text
Platform Director Default
Partner Owner Default
Partner Finance Default
Partner Sales Manager Default
```

Проверить, как это соотносится с текущими Role Defaults.

---

# 47. STEP 3.2 IMPACT — HARD GATE

До продолжения Step 3.2 Design решить:

что именно проектируется первым.

Recommended:

```text
STEP 3.2 FIRST VISUAL CONSUMER
= PLATFORM COMMAND CENTER
```

если canonical Roadmap Step 3.2 относится к TravelHub internal Command Center.

Partner Command Center может быть отдельным later scope.

Но это должно быть доказано Roadmap/repository evidence.

---

# 48. НЕ ПЫТАТЬСЯ СРАЗУ НАРИСОВАТЬ ОБА DASHBOARD

Если Step 3.2 authority = Platform Command Center:

- проектировать Platform UI;
- architecture должна быть context-ready;
- Partner UI deferred.

Не удваивать scope без Roadmap authority.

---

# 49. STEP 3.2 DESIGN PROMPT RECONCILIATION

Последний подготовленный Step 3.2 Design & UX Contract должен быть проверен против этого addendum.

Определить:

- какие sections остаются;
- какие относятся только Platform;
- какие Partner-specific;
- что нужно убрать/уточнить;
- нужен ли revised Step 3.2 design prompt/report.

---

# 50. PAGE CONSTRUCTOR SCOPE

Global constructor остаётся единым.

Но effective widget catalog должен в будущем учитывать context/capabilities.

Это не означает новый constructor.

---

# 51. DATA ISOLATION — HARD GATE

Platform context может иметь broader authority согласно permissions.

Partner context:

```text
partnerId / tenant scope
```

обязателен.

Ни layout, ни role, ни widget config не могут обходить isolation.

---

# 52. PARTNER A ≠ PARTNER B

Hard invariant:

- Partner A employees не видят Partner B;
- Partner A customer conversations не видны Partner B;
- Partner A analytics не видна Partner B;
- Partner A storefront config не видна Partner B.

---

# 53. MARKETPLACE CUSTOMER VS PARTNER CUSTOMER

Определить canonical conceptual distinction:

клиент, пришедший через TravelHub Marketplace, и клиент Storefront могут быть одной Customer identity, но interaction/sale имеет channel context.

Не создавать duplicate customer records только ради channel.

---

# 54. CHANNEL ATTRIBUTION

Каждый relevant conversion/sale/order должен иметь возможность быть attributed к channel.

Проверить Step 3.3 acquisitionSource readiness.

Если insufficient — report gap.

---

# 55. SUBSCRIPTION BILLING

Partner Storefront subscription billing — platform↔partner commercial relationship.

Не смешивать её с customer payment analytics.

---

# 56. PLATFORM COMMISSION

Marketplace commission — transaction-linked financial fact.

Не показывать её как subscription revenue.

---

# 57. NAVIGATION AUTHORITY

Будущий navigation builder должен использовать:

```text
context
+ permissions
+ capabilities
```

а не только RoleCode.

---

# 58. PLATFORM SETTINGS VS PARTNER SETTINGS

Различить:

## Platform Settings

TravelHub global configuration.

## Partner Company Settings

Company/team/storefront settings конкретного partner.

Не один общий Settings screen с условными hidden sections без архитектурного контроля, если это ведёт к risk.

---

# 59. DOCUMENTS

Future:

- Platform documents;
- Partner documents;
- customer/order documents;

должны быть scoped.

Не реализовывать.

---

# 60. MARKETING

Platform Marketing:

- marketplace acquisition;
- partner acquisition.

Partner Marketing:

- storefront campaigns;
- customer acquisition.

Это разные scopes одного possible framework.

---

# 61. ANALYTICS PERIOD CONTRACT

Оба contexts reuse Step 3.3 periods:

- TODAY;
- LAST_3_DAYS;
- LAST_7_DAYS;
- MONTH;
- LAST_6_MONTHS;
- YEAR;
- CUSTOM.

Не создавать context-specific period logic.

---

# 62. MULTI-CURRENCY

Оба contexts reuse canonical multi-currency semantics.

Не смешивать currencies.

---

# 63. CONTEXT DIMENSION IN ANALYTICS

Определить, нужен ли explicit dimension:

```text
workspaceContext
salesChannel
storefrontId
partnerId
```

и какие уже существуют.

Не добавлять schema сейчас.

---

# 64. SECURITY MODEL

Target conceptual stack:

```text
AUTHENTICATION
    ↓
WORKSPACE CONTEXT
    ↓
TENANT/PARTNER SCOPE
    ↓
PERMISSIONS
    ↓
CAPABILITIES
    ↓
WIDGET/PAGE ACCESS
    ↓
USER LAYOUT
```

User layout — самый нижний уровень, не authority.

---

# 65. ARCHITECTURE DECISION MATRIX

Создать:

| Concern | Platform Workspace | Partner Workspace | Common Framework? | Scope Authority |
|---|---|---|---:|---|
| Dashboard | | | | |
| Navigation | | | | |
| Analytics | | | | |
| Sales | | | | |
| Orders | | | | |
| Bookings | | | | |
| Finance | | | | |
| Employees | | | | |
| CRM | | | | |
| Communications | | | | |
| Settings | | | | |
| Marketing | | | | |

---

# 66. CONTEXT / CAPABILITY MATRIX

Создать:

| Capability | Platform | Accommodation Partner | Tours Partner | Transfer Partner | Generic Services |
|---|---:|---:|---:|---:|---:|
| Partner moderation | | | | | |
| Storefront sales | | | | | |
| Occupancy | | | | | |
| Seat capacity | | | | | |
| Driver assignment | | | | | |
| Employees | | | | | |
| Finance | | | | | |
| Communications | | | | | |

Только architectural capability mapping.

---

# 67. REPOSITORY GAP INVENTORY

Обязательно определить gaps:

- workspace context model;
- partner employee memberships;
- partner role/permission model;
- capability registry;
- sales channel dimension;
- storefront identity;
- organization switcher;
- context-aware navigation;
- context-aware Role Defaults.

Для каждого:

| Gap | Exists? | Blocking Step 3.2? | Blocking Partner Workspace? | Future Step |
|---|---:|---:|---:|---|

---

# 68. BLOCKER CLASSIFICATION

Разделить gaps:

## BLOCKING FOR PLATFORM STEP 3.2

Если мешают прямо сейчас.

## NON-BLOCKING FOR PLATFORM STEP 3.2

Можно продолжить Platform Command Center.

## BLOCKING FOR PARTNER WORKSPACE

Нужно закрыть до Partner Dashboard/CRM/Employees.

---

# 69. ROADMAP IMPACT

Repository-first определить:

- нужно ли добавить architecture substep;
- нужен ли будущий `Partner Workspace Foundation`;
- нужен ли `Context/Capability Model`;
- где должен появиться Partner Command Center;
- где Communications/Omnichannel;
- где Partner Employee RBAC.

Не придумывать numbering без canonical Roadmap reconciliation.

---

# 70. RECOMMENDED SEQUENCING

Design должен проверить возможность следующей цепочки:

```text
Current Architecture Reconciliation
→ Step 3.2 Platform Command Center UI
→ Context/Capability Foundation (before partner UI)
→ Partner Command Center
→ Partner operational pages
→ Employee Analytics
→ CRM/Omnichannel
```

Это recommendation, а не authority.

Roadmap имеет приоритет.

---

# 71. ARCHITECTURE DOCUMENT

Создать:

`docs/architecture/platform-vs-partner-workspace-context-model-phase3.md`

или repository-equivalent.

---

# 72. REPORT

Создать:

`docs/prompts/PHASE_3_PLATFORM_VS_PARTNER_WORKSPACE_ARCHITECTURE_RECONCILIATION_REPORT.md`

---

# 73. ОБЯЗАТЕЛЬНЫЕ РАЗДЕЛЫ DESIGN DOCUMENT

1. Purpose
2. Current Architecture
3. Business Model
4. Platform Marketplace Context
5. Partner Storefront Context
6. Monetization Separation
7. Workspace Context Model
8. Role vs Context
9. Business Capabilities
10. Multi-Capability Partners
11. Command Center Model
12. Platform Command Center
13. Partner Command Center
14. Common Widgets
15. Platform Widgets
16. Partner Widgets
17. Capability Widgets
18. Left Navigation
19. Platform Navigation
20. Partner Navigation
21. Capability Navigation
22. Workspace Constructor Impact
23. Layout Hierarchy
24. Persistence Key Analysis
25. Multi-Context Users
26. Partner Employees / RBAC
27. Platform Employees / RBAC
28. Finance Scope
29. CRM Scope
30. Communications Scope
31. Social/Omnichannel Future Model
32. Customer Identity
33. Sales Channel Attribution
34. Analytics Dimensions
35. Marketplace + Storefront Simultaneous Use
36. Security / Isolation
37. Settings Scope
38. Marketing Scope
39. Step 3.2 Impact
40. Partner Workspace Dependencies
41. Repository Gaps
42. Roadmap Impact
43. Sequencing Recommendation
44. Acceptance Criteria
45. Deferred Scope
46. Repository Evidence

---

# 74. HARD NON-GOALS

В этом pass:

- production backend changes: 0;
- production frontend changes: 0;
- schema changes: 0;
- migrations: 0;
- new permissions: 0;
- new roles: 0;
- new capabilities: 0;
- new widgets: 0;
- Step 3.2 implementation: 0;
- Partner Dashboard implementation: 0;
- Employee Analytics implementation: 0;
- Omnichannel implementation: 0;
- subscription billing implementation: 0;
- Step 2.17B changes: 0.

---

# 75. SECURITY NON-NEGOTIABLES

Зафиксировать:

```text
PLATFORM DATA ≠ PARTNER DATA
```

```text
PARTNER A ≠ PARTNER B
```

```text
PARTNER CUSTOMER CONVERSATIONS ≠ PLATFORM INTERNAL INBOX
```

```text
USER LAYOUT CANNOT EXPAND AUTHORITY
```

---

# 76. STEP 3.2 DECISION

Reconciliation должен дать однозначный ответ:

### OPTION A

Step 3.2 = Platform Command Center UI и может продолжаться сейчас.

### OPTION B

Step 3.2 design нужно сначала изменить/сузить.

### OPTION C

Step 3.2 blocked до Context/Capability foundation.

Не оставлять это неясным.

---

# 77. VERDICT A

Если архитектура reconciled и Platform Step 3.2 может продолжаться:

`PHASE 3 PLATFORM VS PARTNER WORKSPACE ARCHITECTURE RECONCILIATION COMPLETED — PLATFORM STEP 3.2 MAY PROCEED`

Указать:

- context model;
- partner model;
- capability strategy;
- Step 3.2 scope;
- Partner Workspace deferred prerequisites;
- Roadmap updates.

---

# 78. VERDICT B

Если Step 3.2 design needs revision:

`ARCHITECTURE RECONCILIATION COMPLETED — STEP 3.2 DESIGN REVISION REQUIRED`

NEXT:

`PHASE 3 — STEP 3.2 — REVISED DESIGN & UX CONTRACT`

---

# 79. VERDICT C

Если architecture blocker существует:

`PLATFORM VS PARTNER WORKSPACE ARCHITECTURE — FOUNDATION REQUIRED BEFORE STEP 3.2`

Не начинать Step 3.2.

---

# 80. ARTIFACT INTEGRITY

После docs-only reconciliation:

- artifact checker;
- checker regression;
- `git diff --check`.

---

# 81. PERSISTENCE

После завершения:

- сохранить architecture doc;
- сохранить report;
- минимально обновить Roadmap;
- provenance/footer sync;
- commit;
- push;
- verify HEAD == upstream;
- tracked worktree clean;
- unrelated untracked untouched;
- реальные SHA.

---

# 82. ФОРМАТ ОТВЕТА РАЗРАБОТЧИКА

Ответ полностью **на русском языке**.

Обязательно:

- Verdict;
- Platform Workspace definition;
- Partner Workspace definition;
- Marketplace vs Storefront distinction;
- monetization distinction;
- context hierarchy;
- capability model;
- multi-capability partner conclusion;
- Platform Dashboard content;
- Partner Dashboard content;
- navigation distinction;
- Widget Registry impact;
- layout persistence key finding;
- partner employee RBAC readiness;
- channel analytics readiness;
- CRM/communications isolation;
- social/omnichannel future model;
- repository gaps;
- blocking/non-blocking gaps;
- Step 3.2 decision;
- Roadmap impact;
- artifact integrity;
- commits/push;
- NEXT.

---


# ДОПОЛНЕНИЕ — PARTNER MARKETPLACE BASIC VS STOREFRONT PRO

## Обязательная архитектурная модель

Внутри `PARTNER WORKSPACE` различать два уровня функциональности:

```text
PARTNER WORKSPACE
├── MARKETPLACE BASIC
└── STOREFRONT PRO
```

Это не две системы и не две кодовые базы. Это один Partner Workspace Framework с разными entitlements/capabilities.

### Marketplace Basic

Партнёр работает через общую витрину TravelHub. Кабинет должен содержать минимально достаточный operational set: собственные размещения/услуги, Orders, Bookings, необходимые Messages, базовые Finance и Basic Analytics. Нельзя ограничивать функции, необходимые для исполнения marketplace-заказов, ради upsell.

### Storefront Pro

Партнёр имеет собственную витрину на инфраструктуре TravelHub и получает full business-management layer: расширенный Command Center, Full Analytics, CRM, Employees, Roles & Permissions, Marketing, Advanced Finance, Storefront/Company Settings, расширенную персонализацию и future Omnichannel.

## Общие Centers, разная глубина

Не создавать отдельные `MarketplaceOrdersCenter` и `StorefrontOrdersCenter`. Предпочтительно иметь общие Orders/Bookings/Finance/Messages/Analytics frameworks, где доступность функций определяется context + entitlement + capability + permission.

## Entitlements — отдельная ось

Зафиксировать различия:

```text
ENTITLEMENT = что организация приобрела/получила
PERMISSION  = что конкретному пользователю разрешено
BUSINESS CAPABILITY = чем занимается бизнес
```

Target resolution order:

```text
IDENTITY
→ WORKSPACE CONTEXT
→ TENANT / PARTNER SCOPE
→ PLAN / ENTITLEMENTS
→ BUSINESS CAPABILITIES
→ ROLE / PERMISSIONS
→ PAGE / WIDGET / ACTION AVAILABILITY
→ USER LAYOUT
```

Не хардкодить проверки `isPro`, `planName`, `hasStorefront` по всему приложению. Repository-first оценить необходимость централизованного Entitlement/Capability Resolver.

## Analytics как главный differentiator

Использовать один Analytics Engine.

`Marketplace Basic Analytics` — ограниченный operational набор: продажи/заказы, бронирования, базовая выручка/GMV где уместно, комиссия/выплаты, conversion и основные trends.

`Storefront Full Analytics` — расширенные периоды и сравнения, каналы продаж, funnels, customer/product analytics, detailed finance, marketing attribution, future employee analytics, reports и advanced analytics widgets.

Не создавать отдельные Basic/Pro analytics engines.

## Marketplace + Storefront одновременно

Партнёр может одновременно продавать через TravelHub Marketplace и собственную Storefront. Storefront entitlement должен расширять Partner Workspace, а не обязательно заменять marketplace mode.

Analytics должна различать минимум каналы:

```text
ALL SALES
TRAVELHUB MARKETPLACE
PARTNER STOREFRONT
```

Проверить готовность Step 3.3 acquisition/channel attribution.

## Capability/entitlement matrix

В architecture report создать repository-backed таблицу минимум для: Command Center, Listings/Services, Orders, Bookings, Messages, Basic Finance, Basic Analytics, Full Analytics, CRM, Employees, Roles & Permissions, Marketing, Advanced Finance, Storefront Settings, Workspace Customization и future Omnichannel — отдельно для Marketplace Basic и Storefront Pro. Не подтверждённые продуктовые решения маркировать `AUTHORITY GAP`.

## Constructor

Global Workspace Constructor остаётся один. Entitlements могут ограничивать widget catalog, advanced analytics widgets и глубину customization. Не создавать BasicConstructor/ProConstructor.

## Page Registry

Проверить future need для `context compatibility`, `entitlement requirements`, `business capability requirements`, `permission` на уровне Page/Widget Registry. Production changes в этом reconciliation pass запрещены.

## CRM / Employees / Finance / Messages

Marketplace Basic получает только тот customer/employee/finance/communication scope, который нужен для marketplace operation. Storefront Pro может получать полноценные CRM, employee management, advanced finance и собственные communication tools. `ORDER CUSTOMER CONTEXT` не должен автоматически означать `FULL CRM`.

## Subscription lifecycle

Зафиксировать future architecture questions: trial, active, past_due, suspended, cancelled, grace period, downgrade. При downgrade данные и сохранённые layouts не должны автоматически уничтожаться; недоступные Pro capabilities отключаются, а обязательные marketplace operational capabilities продолжают работать, если партнёр остаётся marketplace seller.

## Обязательные вопросы итогового report

Итог должен отдельно ответить:

1. Подтверждается ли `Marketplace Basic` vs `Storefront Pro`?
2. Это entitlement tiers одного Partner Workspace или нужны разные workspace contexts?
3. Какие Centers остаются общими?
4. Что обязательно входит в Basic для marketplace operation?
5. Что является Storefront value-add?
6. Может ли Analytics быть главным differentiator?
7. Нужен ли centralized entitlement/capability resolver?
8. Достаточны ли текущие Page/Widget Registry?
9. Как entitlements взаимодействуют с RBAC?
10. Как отображать Marketplace + Storefront одновременно?
11. Какие gaps блокируют только Partner Pro, но не Platform Step 3.2?
12. Нужно ли после reconciliation пересмотреть текущий Step 3.2 Design & UX Contract?

## HARD NON-GOALS дополнения

На этом проходе: production code = 0, schema/migrations = 0, новые permissions/roles/widgets = 0, entitlement engine implementation = 0, subscription billing implementation = 0, Step 3.2 implementation = 0.

# КЛЮЧЕВОЙ РЕЗУЛЬТАТ

После этого addendum архитектура должна однозначно понимать:

```text
КТО ИСПОЛЬЗУЕТ СИСТЕМУ?
```

```text
PLATFORM OPERATOR
ИЛИ
PARTNER BUSINESS
```

затем:

```text
КАКИЕ BUSINESS CAPABILITIES ДОСТУПНЫ?
```

затем:

```text
КАКАЯ ROLE / PERMISSION?
```

и только потом:

```text
КАК ПОЛЬЗОВАТЕЛЬ НАСТРОИЛ СВОЙ WORKSPACE?
```

Именно эта последовательность должна определять Dashboard, navigation, analytics и доступные widgets.

Не наоборот.
