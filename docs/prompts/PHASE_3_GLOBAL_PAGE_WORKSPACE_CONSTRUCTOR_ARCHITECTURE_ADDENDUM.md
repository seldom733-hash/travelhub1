# TRAVELHUB — PHASE 3 — GLOBAL PAGE / WORKSPACE CONSTRUCTOR — ARCHITECTURE ADDENDUM

> **ОБЯЗАТЕЛЬНЫЙ ЯЗЫК ОТВЕТОВ**
>
> Все ответы разработчика пользователю, промежуточные статусы, пояснения, выводы и итоговый summary должны быть **на русском языке**.
>
> Английский допускается только для кода, команд, путей, API routes, DTO/enum/permission names, идентификаторов и канонических технических статусов.

---

# 1. ЦЕЛЬ

До начала:

`PHASE 3 — STEP 3.2 — DASHBOARD / COMMAND CENTER UI`

выполнить отдельный архитектурный addendum для **единого конструктора рабочих страниц TravelHub**.

Конструктор должен быть **общеплатформенным механизмом**, а не отдельной функцией только Dashboard.

Цель:

создать каноническую архитектуру:

`GLOBAL PAGE / WORKSPACE CONSTRUCTOR`

которую смогут переиспользовать:

- Dashboard / Command Center;
- Analytics;
- Sales;
- Bookings;
- Orders;
- Finance;
- CRM;
- Support;
- Marketing;
- Documents;
- Reports;
- Employee / Team Analytics;
- Settings / Administration;
- другие будущие рабочие центры.

---

# 2. КЛЮЧЕВОЕ БИЗНЕС-ТРЕБОВАНИЕ

Пользователь должен иметь возможность, если это разрешено:

- добавлять доступные блоки/виджеты;
- скрывать блоки;
- менять порядок;
- перемещать drag-and-drop;
- менять размер;
- выбирать видимые KPI;
- выбирать графики/таблицы;
- сохранять персональный layout;
- возвращаться к стандартному layout;
- переключаться между фиксированным и настраиваемым режимом, если это разрешено политикой страницы.

При этом:

**конструктор управляет представлением, а не бизнес-логикой.**

Он НЕ должен менять:

- KPI formulas;
- payment authority;
- financial authority;
- statuses;
- workflow;
- permissions;
- tenant scope;
- partner scope;
- actor attribution;
- analytics semantics.

---

# 3. ГЛОБАЛЬНЫЙ ПРИНЦИП

Не создавать отдельный конструктор:

- для Dashboard;
- для Analytics;
- для CRM;
- для Sales;
- для Finance.

Должен существовать один общий:

`Workspace Constructor Framework`

который страницы подключают через конфигурацию.

---

# 4. ИЕРАРХИЯ LAYOUT

Зафиксировать трёхуровневую модель:

```text
SYSTEM DEFAULT
    ↓
ROLE DEFAULT
    ↓
USER LAYOUT
```

## SYSTEM DEFAULT

Канонический layout страницы по умолчанию.

## ROLE DEFAULT

Layout по роли, если authority это допускает.

Примеры:

- DIRECTOR;
- FINANCE;
- SALES_MANAGER;
- OPERATOR;
- ANALYST;
- MODERATOR;
- MARKETER.

## USER LAYOUT

Персональная пользовательская настройка поверх разрешённого role/system layout.

---

# 5. ПРИОРИТЕТ НАСЛЕДОВАНИЯ

Определить canonical merge/inheritance semantics.

Например:

```text
System Page Definition
→ Role Overrides
→ User Overrides
```

Но не копировать модель механически без проверки repository conventions.

Нужно определить:

- что наследуется;
- что заменяется;
- что запрещено переопределять;
- что происходит после изменения system default;
- как вести backward compatibility старого user layout.

---

# 6. КОНСТРУКТОР МОЖНО ВКЛЮЧАТЬ / ОТКЛЮЧАТЬ

Это hard requirement.

Для каждой страницы должен существовать policy state:

```text
constructorEnabled: true | false
```

Если `false`:

- layout фиксирован;
- drag/drop недоступен;
- resize недоступен;
- add/remove widgets недоступен;
- страница продолжает работать по system/role layout.

Если `true`:

- пользователь с permission может персонализировать layout.

---

# 7. ОТДЕЛЬНОЕ УПРАВЛЕНИЕ ВИДЖЕТАМИ

Конструктор страницы и доступность виджетов — разные вещи.

Нужно поддержать:

```text
Page Constructor Enabled
Widget Available
Widget Visible by Default
Widget Removable
Widget Movable
Widget Resizable
Widget Required
```

Пример:

Critical reconciliation widget может быть:

- visible;
- required;
- non-removable;

даже если page constructor включён.

---

# 8. RBAC — HARD GATE

RBAC всегда имеет приоритет над layout.

Пользователь НЕ может через constructor:

- добавить widget, на который нет permission;
- увидеть финансовую карточку без `analytics.read`/financial authority;
- обойти partner scope;
- добавить скрытый admin widget;
- получить данные другого tenant/partner.

Frontend constructor не является security boundary.

Backend/API должны независимо проверять permissions.

---

# 9. WIDGET REGISTRY

Design должен определить единый:

`Widget Registry`

Для каждого widget:

| Field | Meaning |
|---|---|
| widgetId | stable canonical ID |
| pageTypes | compatible pages |
| category | KPI / chart / table / alert / list / custom |
| title | default title |
| permission | access requirement |
| minSize | min grid size |
| maxSize | max grid size |
| defaultSize | default |
| movable | yes/no |
| resizable | yes/no |
| removable | yes/no |
| required | yes/no |
| dataSource | canonical API/read model |
| configSchema | allowed user config |
| version | widget contract version |

Не использовать route name или display label как identity.

---

# 10. WIDGET TYPES

Repository-first определить canonical types.

Минимально рассмотреть:

- KPI Card;
- Chart;
- Time Series;
- Table;
- Status Summary;
- Alert / Attention;
- Funnel;
- Financial Reconciliation;
- Activity Feed;
- Task/List;
- Custom Domain Widget.

Не создавать type без реального consumer use case.

---

# 11. PAGE REGISTRY

Нужен единый registry страниц, поддерживающих layout personalization.

Для каждой page:

| Field | Meaning |
|---|---|
| pageId | canonical ID |
| constructorEnabled | true/false |
| defaultLayout | system layout |
| allowedWidgets | widget IDs |
| requiredWidgets | non-removable |
| roleDefaults | optional |
| minColumns | grid config |
| maxColumns | grid config |
| version | layout schema version |

---

# 12. GLOBAL VS PAGE-SPECIFIC WIDGETS

Определить разделение:

## Global Widgets

Могут использоваться на нескольких страницах.

Примеры:

- generic KPI;
- trend chart;
- task list;
- notifications.

## Page-Specific Widgets

Привязаны к конкретному центру.

Примеры:

- Booking status pipeline;
- Finance reconciliation;
- CRM customer funnel.

Не превращать все widgets в универсальные абстракции.

---

# 13. USER LAYOUT STORAGE

Design должен определить persistence.

Минимально нужно хранить:

- userId;
- pageId;
- layout version;
- widget positions;
- widget sizes;
- hidden widgets;
- widget configs;
- updatedAt.

Repository-first определить:

- DB;
- JSON column;
- profile/settings store;
- existing preferences model;
- отдельная table.

Не создавать schema в этом design pass.

---

# 14. ROLE DEFAULT STORAGE

Определить, где хранятся role layouts:

- code-defined defaults;
- DB config;
- admin-managed config;
- hybrid.

Проверить repository authority.

Не создавать admin editor, если он не входит в scope.

---

# 15. RESET SEMANTICS

Пользователь должен уметь:

`Reset to Default`

Но нужно определить, к какому default:

- role default;
- system default.

Recommended semantic:

```text
User reset → Role Default if exists → else System Default
```

Подтвердить design authority.

---

# 16. VERSIONING

Layout schema должен быть versioned.

Причины:

- widget renamed;
- widget removed;
- page changed;
- new required widget;
- grid columns changed.

Design должен определить migration strategy.

Нельзя допустить, чтобы старый saved layout ломал страницу после deploy.

---

# 17. INVALID / REMOVED WIDGET

Если user layout содержит widget, которого больше нет:

- страница не падает;
- widget игнорируется/мигрируется;
- layout сохраняет остальные widgets;
- telemetry/log показывает migration issue.

Не возвращать raw error пользователю.

---

# 18. REQUIRED WIDGETS

Определить support для обязательных widgets.

Required widget:

- cannot be removed;
- may be movable/resizable, если policy позволяет;
- всегда восстанавливается при invalid user config.

---

# 19. USER PERSONALIZATION VS COMPANY POLICY

Не путать:

`User preference`

и:

`Company policy`.

Если company/role policy запрещает конкретный widget или constructor:

user layout не может это переопределить.

---

# 20. ADMIN / DIRECTOR CONFIG

Repository-first определить, нужен ли в будущем UI для:

- system/page default;
- role default;
- widget availability;
- constructor enable/disable.

Если Roadmap содержит такой step — указать.

Если нет — document as future authority.

Не реализовывать сейчас.

---

# 21. PAGE-LEVEL TOGGLE

Hard requirement:

Для каждой страницы:

```text
constructorEnabled = true/false
```

Design должен определить authority:

- global system config?
- admin?
- per-company?
- code config?
- role policy?

Если authority пока отсутствует — обозначить gap.

---

# 22. USER-LEVEL TOGGLE

Дополнительно определить:

может ли пользователь сам включать:

`Customize mode`

даже если constructor allowed.

Например:

```text
View Mode
Customize Mode
```

Этот toggle не меняет policy — только режим UI.

---

# 23. GRID / LAYOUT SYSTEM

Выбрать design model.

Варианты:

### Option A
Fixed responsive grid.

### Option B
12-column dashboard grid.

### Option C
Breakpoint-aware grid with widget constraints.

Оценить:

- desktop;
- tablet;
- mobile;
- accessibility;
- drag/drop;
- resize;
- implementation complexity.

Выбрать один canonical approach.

---

# 24. RESPONSIVE BEHAVIOR

Custom desktop layout не должен ломать mobile.

Нужно определить:

- desktop positions;
- tablet fallback;
- mobile stacking;
- user-defined mobile layout или auto flow.

Не делать отдельный mobile constructor, если нет необходимости.

---

# 25. DRAG & DROP

Design должен определить:

- drag handle;
- collision;
- auto-reflow;
- keyboard accessibility;
- locked widget;
- save timing.

Не выбирать library в design без repository/package review.

---

# 26. RESIZE

Определить:

- allowed widgets;
- min/max;
- aspect needs;
- chart responsiveness;
- table constraints.

---

# 27. CONFIGURABLE WIDGET SETTINGS

Некоторые widgets могут поддерживать config:

- metric;
- period override?
- visualization type;
- row count;
- filters;
- sort.

Но нельзя разрешить config, который ломает canonical analytics semantics.

---

# 28. GLOBAL PERIOD VS WIDGET PERIOD

Очень важное design decision.

Command Center/Analytics может иметь глобальный period selector.

Определить:

- widgets наследуют global period;
- может ли widget override period;
- если может — как UI показывает это пользователю.

Рекомендуется по умолчанию:

`Widget inherits page period`

чтобы не создавать несогласованный Dashboard.

Override — только если design explicitly позволяет.

---

# 29. CUSTOM PERIOD

Конструктор не должен реализовывать собственную time logic.

Для Analytics-compatible widgets reuse Step 3.3:

- TODAY;
- LAST_3_DAYS;
- LAST_7_DAYS;
- MONTH;
- LAST_6_MONTHS;
- YEAR;
- CUSTOM(startDate,endDate).

---

# 30. COMPARISON

Если widget поддерживает comparison:

reuse Step 3.3.

Не хранить свои comparison formulas в widget config.

---

# 31. MULTI-CURRENCY

Widget constructor не может смешивать currencies.

Если KPI widget финансовый:

- currency-separated;
- canonical money semantics;
- никакого FX без authority.

---

# 32. DATA SOURCE AUTHORITY

Каждый widget должен иметь один canonical data source.

Constructor не задаёт формулы.

Пример:

```text
Widget Configuration
≠ Analytics Formula
```

---

# 33. SECURITY OF SAVED CONFIG

Saved widget config является untrusted input.

Backend/frontend должны валидировать:

- widgetId;
- pageId;
- allowed config;
- filters;
- sort;
- metric identifiers;
- partner scope.

Нельзя сохранять arbitrary query/SQL/route.

---

# 34. TENANT / PARTNER ISOLATION

Layout config не должен хранить unsafe foreign IDs, которые потом bypass scope.

Если widget filter содержит partnerId:

backend всё равно resolves canonical partner scope.

---

# 35. CROSS-PAGE REUSE

Определить, может ли пользователь:

- copy layout;
- duplicate widget;
- save template;
- apply layout to another page.

На initial scope рекомендуется не расширять без Roadmap authority.

---

# 36. LAYOUT TEMPLATES

Отдельно решить future support:

- system templates;
- role templates;
- user templates.

Не реализовывать в первом pass, если не требуется.

---

# 37. IMPORT / EXPORT

Не включать layout import/export без отдельной authority.

---

# 38. DEFAULT PAGE DESIGN

Даже с constructor каждая страница обязана иметь качественный default layout.

Constructor не должен быть оправданием отсутствия UX design.

---

# 39. COMMAND CENTER INTEGRATION

Step 3.2 должен использовать constructor framework.

Для Command Center:

- 21 backend KPI не обязаны стать 21 visible cards;
- default layout должен показывать curated subset;
- остальные могут быть доступны через widget catalog;
- duplicate/similar metrics не должны перегружать экран.

---

# 40. KPI CATALOG

Для Command Center определить:

- default widgets;
- optional widgets;
- required widgets;
- hidden-by-default widgets.

Пример matrix:

| KPI Widget | Default | Optional | Required | Permission |
|---|---:|---:|---:|---|

Design values должны опираться на Step 3.1 KPI inventory.

---

# 41. EMPLOYEE ANALYTICS FUTURE SUPPORT

Constructor должен быть готов к будущим widgets:

- Employee Activity;
- Employee KPI;
- Team Performance;
- SLA;
- workload;
- conversion;
- trends.

Но не реализовывать их сейчас.

Сохранить:

`ACTIVITY ≠ EFFECTIVENESS`

---

# 42. PAGE LIST

Repository-first определить, какие страницы реально существуют и какие планируются.

Создать:

| Page | Exists | Constructor candidate | Default enabled? | Authority |
|---|---:|---:|---:|---|

Не ставить constructor на все страницы автоматически.

Например:

- settings/security pages могут оставаться fixed;
- transactional forms могут не использовать constructor.

---

# 43. WHERE CONSTRUCTOR SHOULD BE DISABLED

Design обязан определить классы страниц, где constructor может быть запрещён:

- payment flow;
- security;
- critical settings;
- workflow forms;
- legal/compliance.

Нельзя делать каждый экран drag-and-drop.

---

# 44. PERFORMANCE

Constructor не должен приводить к:

- десяткам API calls;
- uncontrolled widget fan-out;
- duplicate requests;
- layout-dependent N+1.

Нужен data-fetch strategy.

---

# 45. DATA FETCH STRATEGY

Сравнить:

### Option A
each widget fetches its own API.

### Option B
page-level aggregation.

### Option C
hybrid.

Для Command Center Step 3.1 уже имеет aggregated summary + lazy trends.

Constructor architecture должна уметь переиспользовать page aggregation, а не уничтожать её.

---

# 46. CACHING

Не добавлять новый cache только из-за constructor.

Reuse page/backend cache policy.

---

# 47. ERROR ISOLATION

Один widget error не должен обязательно ломать всю страницу, если page contract допускает partial rendering.

Определить:

- widget error state;
- retry;
- unavailable;
- forbidden.

---

# 48. LOADING

Определить стандарт:

- skeleton;
- section loading;
- widget loading;
- lazy chart loading.

---

# 49. ACCESSIBILITY

Drag-and-drop должен иметь keyboard alternative.

Resize должен быть accessible.

Widget focus/order должен быть логичным.

---

# 50. AUDITABILITY

Определить, нужно ли audit trail для:

- user personal layout changes;
- role default changes;
- admin page policy changes.

User cosmetic layout обычно не требует full security audit.

Company policy changes могут требовать audit.

Repository-first определить conventions.

---

# 51. PRIVACY

Constructor не должен позволять пользователю увидеть данные, скрытые RBAC.

Не сохранять sensitive data в layout config.

---

# 52. API CONTRACTS

Design должен определить conceptual API для:

- get page definition;
- get user layout;
- save user layout;
- reset layout;
- get widget registry.

Не реализовывать endpoints в этом pass.

---

# 53. POSSIBLE API SHAPE

Conceptually рассмотреть:

```text
GET  /api/v1/workspaces/:pageId
PUT  /api/v1/workspaces/:pageId/layout
DELETE /api/v1/workspaces/:pageId/layout
GET  /api/v1/workspaces/:pageId/widgets
```

Это НЕ обязательные routes.

Выбрать canonical naming по repository conventions.

---

# 54. BACKEND VS FRONTEND RESPONSIBILITY

Backend отвечает за:

- allowed widgets;
- permissions;
- persisted layout;
- validation;
- page policy;
- versioning.

Frontend отвечает за:

- render;
- drag/drop;
- resize;
- customize mode;
- responsive layout.

Frontend не решает access authority.

---

# 55. SCHEMA DECISION

Не создавать schema/migration в design pass.

Но определить data model proposal.

---

# 56. PROPOSED DATA MODEL

Repository-first оценить необходимость entities наподобие:

- WorkspacePageDefinition;
- WorkspaceLayout;
- RoleWorkspaceLayout;
- WidgetDefinition.

Не создавать их автоматически.

Предпочесть минимальную модель.

---

# 57. JSON VS NORMALIZED STORAGE

Сравнить:

### JSON layout payload
Плюсы:
- гибкость;
- меньше schema complexity.

Минусы:
- validation/versioning.

### normalized widget rows
Плюсы:
- queryability.

Минусы:
- complexity.

Выбрать approach.

---

# 58. OPT-IN / OPT-OUT

Hard requirement:

Constructor должен поддерживать:

- enabled page;
- disabled page.

И:

- user may customize;
- user may simply keep default.

---

# 59. RESET / SAFE FALLBACK

Если user layout повреждён:

- страница загружается с valid default;
- не падает;
- пользователь может reset.

---

# 60. MIGRATION OF EXISTING STATIC PAGES

Design должен определить migration strategy:

- existing static layout становится system default;
- widgets постепенно получают registry IDs;
- constructor включается page-by-page.

Не делать big-bang rewrite.

---

# 61. PHASED ROLLOUT

Предлагаемый подход:

### Wave A
Global constructor foundation.

### Wave B
Step 3.2 Command Center first consumer.

### Wave C
Analytics pages.

### Wave D
Sales/Booking/Orders/Finance/CRM.

### Wave E
Employee Analytics and later workspaces.

Проверить соответствие Roadmap.

---

# 62. ROADMAP IMPACT

Repository-first определить:

- есть ли уже canonical step для workspace/page constructor;
- куда добавить architecture addendum;
- требуется ли новый Step 3.x / substep;
- или это cross-cutting foundation под Step 3.2+.

Не придумывать numbering без Roadmap reconciliation.

---

# 63. HARD STOP BEFORE STEP 3.2

Step 3.2 Dashboard UI implementation не должен начинаться, пока не принято решение:

- constructor architecture;
- page registry;
- widget registry;
- storage strategy;
- RBAC;
- default/role/user inheritance;
- enable/disable semantics.

---

# 64. DESIGN DOCUMENT

Создать:

`docs/architecture/global-workspace-constructor-phase3.md`

или repository-equivalent.

Обязательные разделы:

1. Purpose
2. Scope
3. Non-Goals
4. Page Registry
5. Widget Registry
6. Layout Hierarchy
7. System Default
8. Role Default
9. User Layout
10. Constructor Enable/Disable
11. Widget Policy
12. Required Widgets
13. Grid System
14. Responsive Behavior
15. Drag/Drop
16. Resize
17. Widget Config
18. Period/Comparison Integration
19. Currency/Money
20. Security/RBAC
21. Tenant/Partner Isolation
22. Persistence
23. Versioning/Migrations
24. API Contract
25. Backend/Frontend Responsibilities
26. Error/Loading States
27. Accessibility
28. Performance/Data Fetching
29. Auditability
30. Command Center Integration
31. Future Employee Analytics Integration
32. Rollout Strategy
33. Risks
34. Authority Gaps
35. Acceptance Criteria

---

# 65. REPORT

Создать:

`docs/prompts/PHASE_3_GLOBAL_WORKSPACE_CONSTRUCTOR_ARCHITECTURE_ADDENDUM_REPORT.md`

Минимум:

- repository state;
- existing personalization inventory;
- selected architecture;
- page registry model;
- widget registry model;
- hierarchy;
- enable/disable semantics;
- persistence decision;
- API proposal;
- security;
- migration strategy;
- Step 3.2 impact;
- Roadmap impact;
- authority gaps;
- negative checks;
- persistence;
- verdict;
- NEXT.

---

# 66. NEGATIVE CHECKS

В этом design pass:

- production backend changes: 0
- production frontend changes: 0
- schema changes: 0
- migrations: 0
- new permissions: 0
- Step 3.1 changes: 0
- Step 3.3 changes: 0
- Step 2.17B changes: 0
- Dashboard UI implementation: 0
- Employee Analytics implementation: 0
- release: 0

---

# 67. VERDICT A

Если architecture sufficiently defined:

`PHASE 3 GLOBAL PAGE / WORKSPACE CONSTRUCTOR ARCHITECTURE ADDENDUM COMPLETED — READY FOR IMPLEMENTATION SEQUENCING`

Условия:

- global mechanism defined;
- page enable/disable defined;
- widget enable/disable defined;
- system/role/user hierarchy defined;
- RBAC hard boundary defined;
- storage selected;
- versioning selected;
- responsive/grid strategy selected;
- API contract proposed;
- Step 3.2 integration defined;
- no blocking authority gap.

---

# 68. VERDICT B

Если architecture частично готова:

`GLOBAL WORKSPACE CONSTRUCTOR DESIGN — CLARIFICATION REQUIRED`

Указать exact blockers.

---

# 69. VERDICT C

Если нужна business authority:

`GLOBAL WORKSPACE CONSTRUCTOR DESIGN — AUTHORITY DECISION REQUIRED`

Не придумывать policy.

---

# 70. NEXT

При VERDICT A:

repository-first определить, требуется ли:

1. constructor foundation implementation;
2. Step 3.2 UI design;
3. отдельный substep перед Step 3.2.

Не начинать автоматически implementation.

---

# 71. PERSISTENCE

После design:

- artifact checker;
- checker regression;
- `git diff --check`;
- commit design/report/Roadmap;
- push;
- verify HEAD == upstream;
- worktree clean;
- unrelated untracked untouched.

---

# 72. ФОРМАТ ОТВЕТА РАЗРАБОТЧИКА

Все объяснения — **на русском языке**.

Финальный ответ должен содержать:

- Verdict;
- selected architecture;
- constructor global scope;
- page enable/disable;
- widget enable/disable;
- system/role/user hierarchy;
- widget registry;
- page registry;
- grid/responsive;
- storage;
- API;
- RBAC;
- partner isolation;
- Step 3.2 impact;
- Employee Analytics future support;
- Roadmap impact;
- authority gaps;
- artifact integrity;
- commits/push;
- NEXT.

---

# КЛЮЧЕВОЙ ПРИНЦИП

TravelHub должен иметь:

```text
ONE GLOBAL WORKSPACE CONSTRUCTOR
```

а не:

```text
Dashboard Constructor
Analytics Constructor
CRM Constructor
Sales Constructor
Finance Constructor
...
```

И:

```text
CONSTRUCTOR CONFIGURES PRESENTATION
NOT BUSINESS AUTHORITY
```

И:

```text
SYSTEM DEFAULT
→ ROLE DEFAULT
→ USER LAYOUT
```

при этом:

```text
RBAC ALWAYS WINS
```

и:

```text
CONSTRUCTOR CAN BE ENABLED OR DISABLED PER PAGE
```.
