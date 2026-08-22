# TRAVELHUB — PHASE 3 — STEP 3.2 — DASHBOARD / COMMAND CENTER UI — DESIGN & UX CONTRACT

> **ОБЯЗАТЕЛЬНЫЙ ЯЗЫК**
>
> Все ответы разработчика пользователю, промежуточные статусы, пояснения, findings, design decisions и итоговый отчёт должны быть **на русском языке**.
>
> Английский допускается для кода, путей, API routes, identifiers, component names и канонических технических статусов.

---

# 1. ЦЕЛЬ

Выполнить **DESIGN & UX CONTRACT** для:

`PHASE 3 — STEP 3.2 — DASHBOARD / COMMAND CENTER UI`

Текущий repository-confirmed baseline:

- Step 3.1 — Dashboard / Command Center Backend: `APPROVED`;
- Step 3.3 — Analytics Foundation: `APPROVED`;
- Step 3.3E — Global Workspace Constructor Foundation: `APPROVED`;
- Step 3.2 — `NEXT`;
- Widget Registry: **30 total = 18 Command Center + 12 future stubs**;
- Step 2.17B остаётся внешним performance blocker и не блокирует независимый Step 3.2.

Этот шаг — **только проектирование UI/UX и implementation contract**.

## HARD STOP

На этом проходе:

- production frontend code: **0**;
- production backend code: **0**;
- schema/migrations: **0**;
- Step 3.2 implementation: **НЕ НАЧИНАТЬ**.

После design завершить работу и ждать отдельного implementation prompt.

---

# 2. REPOSITORY-FIRST

Перед проектированием прочитать и сверить:

- canonical Roadmap v3;
- Step 3.2 definition;
- Step 3.1 approved implementation/contracts;
- Step 3.3 approved Analytics Foundation;
- Step 3.3 Time/Period + Actor Attribution addendum;
- Step 3.3E Workspace Constructor architecture/implementation/strict review;
- current frontend architecture;
- current application shell;
- left navigation;
- existing design system/components;
- typography;
- spacing;
- cards;
- tables;
- chart libraries;
- icon library;
- responsive conventions;
- theme/light-dark capabilities, если существуют;
- current Dashboard/Command Center route/page, если существует.

Не проектировать интерфейс в отрыве от реального frontend repository.

---

# 3. ОСНОВНОЙ UX-ПРИНЦИП

Command Center — это **центр принятия решений**, а не страница со случайным набором KPI.

Пользователь должен за несколько секунд понимать:

```text
ЧТО ПРОИСХОДИТ?
→
ЧТО ИЗМЕНИЛОСЬ?
→
ГДЕ ПРОБЛЕМА?
→
ЧТО ТРЕБУЕТ МОЕГО ВНИМАНИЯ?
→
КУДА ПЕРЕЙТИ ДЛЯ ДЕЙСТВИЯ?
```

Не превращать страницу в:

`18 одинаковых KPI cards + несколько графиков`.

---

# 4. PRIMARY PERSONA

Repository-first определить доступные роли.

Если подтверждено authority, основным design persona считать:

`DIRECTOR`

Command Center директора должен давать общий обзор бизнеса.

Отдельно определить допустимые variations для:

- ADMIN;
- FINANCE;
- ANALYST;
- PARTNER — только если canonical RBAC/API действительно разрешает.

Не придумывать role access.

---

# 5. PAGE SHELL

Спроектировать полный desktop shell Command Center:

```text
Application Shell
├── Left Navigation
├── Page Header
│   ├── Breadcrumb / context
│   ├── Page title
│   ├── Period selector
│   ├── Comparison
│   └── Customize action
└── Workspace
    ├── Executive overview
    ├── Attention / alerts
    ├── Commercial performance
    ├── Operational performance
    ├── Financial health
    └── Marketplace / customer activity
```

Проверить соответствие существующему shell TravelHub.

---

# 6. PAGE HEADER

Определить exact UX верхней части.

Минимально:

- `Command Center` / локализованное название;
- contextual subtitle при необходимости;
- current period;
- comparison indicator;
- CUSTOM dates;
- timezone indication, если UX требует;
- `Настроить страницу`;
- reset/customization actions только в соответствующем mode.

Не перегружать header.

---

# 7. PERIOD SELECTOR — HARD CONTRACT

UI обязан поддерживать Step 3.3 presets:

- TODAY;
- LAST_3_DAYS;
- LAST_7_DAYS;
- MONTH;
- LAST_6_MONTHS;
- YEAR;
- CUSTOM.

Определить пользовательские русские labels.

CUSTOM:

```text
Дата начала
Дата окончания
```

Проверить UX inclusive date selection при backend half-open interval `[start, endExclusive)`.

Пользователь не должен видеть техническую half-open semantics, но UI должен передавать корректный contract.

---

# 8. CUSTOM PERIOD

Спроектировать:

- date picker;
- start/end validation;
- invalid range;
- same-day range;
- future dates policy — только согласно backend contract;
- apply;
- cancel;
- keyboard usage;
- mobile behavior.

---

# 9. COMPARISON

Использовать только Step 3.3 comparison authority.

Design должен определить отображение:

- percentage change;
- absolute change, где уместно;
- previous period label;
- positive/negative/neutral semantics.

Не считать `рост = всегда хорошо`.

Пример: рост refunds может быть негативным.

Semantic direction должна зависеть от KPI.

---

# 10. DEFAULT LAYOUT — DIRECTOR

Создать **curated System/Role Default layout** для директора.

Не размещать все 18 Command Center widgets механически.

Разделить registry на:

1. `REQUIRED`;
2. `DEFAULT_VISIBLE`;
3. `OPTIONAL`;
4. `HIDDEN_BY_DEFAULT`.

Для каждого из 18 Command Center widgets определить категорию.

---

# 11. EXACT 18 COMMAND CENTER WIDGETS

Получить фактический список из repository Widget Registry.

Создать таблицу:

| widgetId | Название | Data source | Visualization | Required | Default | Optional | Suggested size | Section |
|---|---|---|---|---:|---:|---:|---|---|

Не использовать 12 future stubs как Command Center widgets.

Если repository count/IDs изменились — зафиксировать расхождение, не придумывать список.

---

# 12. 21 KPI → 18 WIDGET MAPPING

Step 3.1 имеет 21 backend KPI.

Создать canonical presentation mapping:

| Backend KPI | Widget | Presentation | Default visible? | Comparison? | Drill-down target |
|---|---|---|---:|---:|---|

Не делать правило `1 KPI = 1 card`.

Один widget может логично объединять связанные показатели.

---

# 13. EXECUTIVE SUMMARY

Определить компактный верхний уровень.

Кандидаты из Step 3.1 authority:

- GMV;
- Revenue;
- Net Revenue;
- Orders;
- Bookings;
- AOV;
- Conversion.

Design должен выбрать, какие показатели действительно нужны в first viewport.

Не считать автоматически все семь обязательными карточками.

---

# 14. ATTENTION / ACTION CENTER

Command Center должен отвечать не только «сколько», но и «что требует внимания».

Проверить, какие alerts/actionable states уже поддерживаются repository/backend.

Если отдельной alert authority пока нет:

- не изобретать backend alerts;
- можно определить UI placeholder/empty contract;
- явно пометить future dependency.

Не создавать фиктивные данные.

---

# 15. COMMERCIAL PERFORMANCE

Определить визуальное представление:

- GMV/revenue dynamics;
- orders/bookings;
- conversion;
- AOV;
- funnel.

Решить, что лучше:

- KPI;
- line/area chart;
- bar chart;
- funnel;
- compact table.

Не дублировать одно и то же число в нескольких местах без UX причины.

---

# 16. OPERATIONAL PERFORMANCE

Использовать только Step 3.1 data authority:

- fulfilled;
- confirmed;
- completed;
- payments;
- refunds;
- funnel.

Определить meaningful visualization и drill-down.

---

# 17. FINANCIAL HEALTH

Использовать:

- commission;
- reconciliation;
- payments;
- net payments;
- currency-separated data.

**HARD RULE:**

никогда не показывать fake total:

`USD + EUR + AZN`.

Спроектировать multi-currency UX:

- currency tabs;
- selector;
- grouped rows;
- another repository-compatible approach.

Выбрать и обосновать.

---

# 18. RECONCILIATION — REQUIRED WIDGET

Workspace architecture требует reconciliation widget.

Design должен показать:

- почему он required;
- где находится;
- как выглядит healthy state;
- warning/problem state — только если backend contract позволяет;
- почему пользователь не может удалить его;
- как это объясняется UX без раздражения пользователя.

RBAC всегда выше required semantics.

---

# 19. MARKETPLACE / ACTIVITY

Использовать repository-supported:

- sessions;
- partners;
- customers;
- другие Step 3.1 marketplace values, если реально существуют.

Не смешивать platform activity с employee effectiveness.

---

# 20. ACTIVITY ≠ EFFECTIVENESS

Зафиксировать design principle:

```text
PLATFORM ACTIVITY ≠ EMPLOYEE EFFECTIVENESS
```

Step 3.2 не реализует employee analytics.

Будущий Employee Analytics должен использовать отдельные metrics/contracts.

---

# 21. CHART DESIGN CONTRACT

Для каждого chart widget определить:

- chart type;
- X axis;
- Y axis;
- series;
- currency/unit;
- tooltip;
- comparison;
- legend;
- empty state;
- loading state;
- minimum useful dimensions.

Не выбирать декоративные графики без аналитической ценности.

---

# 22. KPI CARD CONTRACT

Определить canonical KPI card anatomy:

```text
Title
Primary value
Unit/currency
Comparison
Trend direction
Optional sparkline
Context/help
Drill-down
```

Не все поля обязательны для каждого KPI.

---

# 23. SEMANTIC COLORS

Проверить существующие design tokens.

Не hardcode arbitrary green/red.

Различать:

- positive business outcome;
- negative business outcome;
- neutral information;
- warning;
- critical;
- disabled;
- no data.

---

# 24. DRILL-DOWN

Command Center не должен пытаться заменить остальные центры.

Для каждого actionable widget определить возможный target:

- Analytics;
- Sales;
- Orders;
- Bookings;
- Finance;
- Marketplace;
- другой существующий route.

Только repository-existing/planned canonical destinations.

---

# 25. VIEW MODE

Спроектировать обычный режим страницы.

В View Mode:

- drag handles скрыты;
- resize controls скрыты;
- delete/remove controls скрыты;
- layout выглядит как нормальная enterprise dashboard page.

---

# 26. CUSTOMIZE MODE

Спроектировать отдельный режим:

`Настроить страницу`.

Определить:

- визуальный вход;
- widget outlines;
- drag handles;
- resize handles;
- remove optional widget;
- required widget lock;
- add-widget action;
- save semantics;
- cancel semantics;
- reset semantics;
- unsaved changes;
- exit confirmation при необходимости.

---

# 27. WIDGET CATALOG / ADD WIDGET

Определить UX добавления скрытых optional widgets.

Кандидаты:

- side drawer;
- modal;
- palette.

Выбрать подход на основании существующего design system.

Каталог должен показывать только:

- compatible;
- RBAC-allowed;
- currently addable widgets.

---

# 28. RESET

Workspace contract:

```text
USER LAYOUT
→ ROLE DEFAULT
→ SYSTEM DEFAULT
```

Спроектировать понятный пользователю reset UX.

Не использовать технические термины `Role Default/System Default` без необходимости.

---

# 29. SAVE MODEL

Определить UX:

- auto-save или explicit save;
- loading;
- success;
- failure;
- retry;
- concurrent/stale save behavior.

Выбор должен соответствовать существующим hooks/API contract.

---

# 30. REQUIRED WIDGET UX

Required widget:

- нельзя удалить;
- должен иметь понятное lock state;
- не должен выглядеть «сломавшейся кнопкой удаления».

---

# 31. DRAG & DROP

Architecture baseline:

- desktop — supported;
- tablet/mobile — drag/drop не требуется.

Repository-first проверить доступные dependencies.

Design может рекомендовать library, но implementation dependency не добавлять на этом шаге.

Обязательно предусмотреть **keyboard/non-drag alternative**.

---

# 32. RESIZE

Определить desktop resize UX:

- allowed widgets;
- min/max sizes;
- snap to grid;
- overflow handling;
- chart redraw.

Использовать registry constraints.

---

# 33. GRID

Canonical baseline:

- desktop: 12 columns;
- tablet: 8;
- mobile: 4.

Создать proposed default layout map для desktop.

Например только как contract:

```text
Row 1: ...
Row 2: ...
Row 3: ...
```

Но использовать реальные 18 widget IDs.

---

# 34. TABLET

Определить:

- column behavior;
- widget stacking;
- chart minimum width;
- tables;
- header controls;
- customize availability.

---

# 35. MOBILE

Command Center должен оставаться рабочим, а не просто уменьшенным desktop.

Определить:

- single/dual column behavior;
- KPI wrapping;
- chart height;
- horizontal overflow policy;
- period selector;
- custom date picker;
- navigation;
- customization disabled/read-only behavior.

---

# 36. LOADING

Не использовать одну глобальную бесконечную spinner page без необходимости.

Определить:

- page shell;
- skeletons;
- chart skeleton;
- KPI skeleton;
- trends lazy loading.

Учитывать Step 3.1 Summary + Lazy Trends architecture.

---

# 37. LAZY TRENDS

Step 3.1 имеет отдельный trends endpoint.

Design должен определить:

- когда загружаются trends;
- skeleton;
- failure isolation;
- summary page не должен становиться unusable при trends failure.

---

# 38. EMPTY STATE

Различать:

- компания реально имеет 0;
- данных нет;
- выбранный период пуст;
- widget unavailable;
- permission restricted;
- backend error.

`0` ≠ `No data`.

---

# 39. ERROR STATE

Определить:

- page-level fatal error;
- widget-level recoverable error;
- trends-only error;
- retry;
- permission error;
- network failure.

Не показывать technical stack/error details.

---

# 40. PARTIAL DATA

Если часть read models доступна, а часть нет, определить graceful degradation.

---

# 41. ACCESSIBILITY — HARD DESIGN GATE

Минимум:

- keyboard navigation;
- visible focus;
- semantic headings;
- screen-reader labels;
- chart textual equivalents/accessible summaries;
- color not sole indicator;
- date picker accessibility;
- non-drag reorder method;
- buttons with accessible names.

---

# 42. LOCALIZATION

Проверить существующую localization architecture.

Не hardcode Russian strings, если приложение уже использует i18n.

Design contract должен быть готов минимум к текущим языкам платформы.

---

# 43. NUMBER FORMATTING

Определить:

- thousands separators;
- decimal places;
- percentages;
- large numbers;
- currency formatting.

Не терять financial exactness из-за presentation formatting.

---

# 44. TIMEZONE UX

Если timezone параметр/authority существует, определить, где пользователь понимает, относительно какого времени построен отчёт.

Не создавать новый company timezone setting в Step 3.2.

---

# 45. DATA FRESHNESS

Проверить, существует ли backend freshness/updated-at authority.

Если да — спроектировать отображение.

Если нет — не выдумывать fake «обновлено 1 минуту назад».

---

# 46. TOOLTIP / EXPLANATION

Для сложных KPI предусмотреть help/tooltip:

- definition;
- comparison meaning;
- currency context.

Но не перегружать страницу.

---

# 47. FILTERS

Не создавать произвольный глобальный filter framework без authority.

Период — обязательный global filter.

Другие filters — только если Step 3.1/3.3 API реально поддерживают.

---

# 48. PARTNER VIEW

Если PARTNER canonical access подтверждён:

- определить scoped layout;
- не показывать company-wide values;
- не доверять client-supplied partnerId;
- backend remains authority.

Если access не подтверждён — deferred.

---

# 49. ADMIN / FINANCE VARIANTS

Role defaults уже существуют для DIRECTOR и FINANCE согласно Workspace Strict Review.

Проверить реальные definitions и описать различия default layout только на основе repository.

Не придумывать новый Role Default.

---

# 50. PERFORMANCE UX

Не проводить Step 2.17B qualification.

Но design должен избегать очевидных UI anti-patterns:

- 30 simultaneous data requests;
- huge chart payload rendering;
- unnecessary rerenders;
- all widgets mounted when hidden.

---

# 51. VISUAL STYLE

Использовать существующий TravelHub visual language.

Design document должен определить:

- spacing rhythm;
- card hierarchy;
- border/radius/shadow usage;
- typography hierarchy;
- density;
- chart visual consistency.

Не делать отдельный «чужой» dashboard style.

---

# 52. ENTERPRISE DENSITY

Command Center должен быть современным, но информационно насыщенным.

Баланс:

```text
НЕ пустой маркетинговый landing
НЕ перегруженный BI-интерфейс
А operational executive workspace
```

---

# 53. LEFT MENU

Проверить текущую структуру левого меню.

Step 3.2 Design должен показать место Command Center в navigation hierarchy, но не редизайнить всё левое меню без отдельного scope.

---

# 54. BREADCRUMBS

Использовать только если соответствуют существующему shell/navigation depth.

Не добавлять breadcrumbs декоративно.

---

# 55. USER PERSONALIZATION

Layout customization принадлежит текущему пользователю.

UI не должен создавать возможность редактировать layout другого пользователя.

---

# 56. ROLE DEFAULT MANAGEMENT

Не реализовывать admin UI для редактирования Role Defaults, если это не входит в canonical scope.

---

# 57. FUTURE PAGE CONSTRUCTOR

Step 3.2 должен использовать global framework так, чтобы найденные UI patterns могли позднее переиспользоваться в:

- Analytics;
- CRM;
- Orders;
- Bookings;
- другие enabled workspaces.

Но не реализовывать их сейчас.

---

# 58. EMPLOYEE ANALYTICS — DEFERRED

Не реализовывать:

- idle time;
- employee activity tables;
- effectiveness scoring;
- employee reports.

Это отдельный будущий analytics scope.

При этом будущий constructor должен позволить добавлять такие widgets позже.

---

# 59. OMNICHANNEL — DEFERRED

Не реализовывать:

- Instagram;
- Facebook;
- TikTok;
- social inbox;
- external CRM contacts;
- seller social channels.

---

# 60. SELLER STOREFRONT — BOUNDARY

Не менять архитектуру:

- TravelHub Marketplace → commission;
- Seller Storefront → subscription;
- seller/customer communication isolation.

Step 3.2 — Command Center UI only.

---

# 61. DESIGN ARTIFACT

Создать основной документ:

`docs/architecture/dashboard-command-center-ui-3.2.md`

Он должен быть достаточно точным, чтобы implementation agent **не принимал ключевые UX решения самостоятельно**.

---

# 62. DESIGN REPORT

Создать:

`docs/prompts/PHASE_3_STEP_3.2_DASHBOARD_COMMAND_CENTER_UI_DESIGN_REPORT.md`

---

# 63. ОБЯЗАТЕЛЬНАЯ СТРУКТУРА DESIGN DOCUMENT

Минимум:

1. Purpose
2. Repository Baseline
3. Design Principles
4. Personas / RBAC
5. Information Architecture
6. Page Shell
7. Header
8. Period Selector
9. Custom Period
10. Comparison UX
11. Command Center Widget Inventory
12. 21 KPI → 18 Widget Mapping
13. Widget Classification
14. Director Default Layout
15. Role Variants
16. Executive Summary
17. Attention Center
18. Commercial Performance
19. Operational Performance
20. Financial Health
21. Reconciliation
22. Marketplace Activity
23. KPI Card Contract
24. Chart Contract
25. Multi-Currency UX
26. Drill-down
27. View Mode
28. Customize Mode
29. Widget Catalog
30. Drag/Drop
31. Resize
32. Save/Cancel/Reset
33. Required Widgets
34. Desktop Grid
35. Tablet
36. Mobile
37. Loading
38. Lazy Trends
39. Empty States
40. Error States
41. Partial Data
42. Accessibility
43. Localization
44. Number/Currency Formatting
45. Timezone
46. Performance Considerations
47. Component Architecture
48. Data Flow
49. API Reuse
50. Security Boundaries
51. Implementation Waves
52. Acceptance Criteria
53. Deferred Scope
54. Open Authority Gaps
55. Repository Evidence

---

# 64. COMPONENT ARCHITECTURE

Предложить component tree на уровне design.

Например:

```text
CommandCenterPage
├── CommandCenterHeader
├── PeriodControl
├── WorkspaceRenderer
│   └── WidgetRenderer
│       ├── KpiWidget
│       ├── TrendWidget
│       ├── FunnelWidget
│       ├── ReconciliationWidget
│       └── ...
└── WorkspaceCustomizePanel
```

Но адаптировать к реальной frontend architecture.

Не создавать production files.

---

# 65. DATA FLOW

Зафиксировать:

```text
Command Center Summary API
        ↓
page-level normalized data
        ↓
Workspace layout
        ↓
WidgetRenderer
```

Trends:

```text
Trends API
    ↓
lazy trend data
    ↓
trend-capable widgets
```

Workspace layout не является data authority.

---

# 66. API REUSE — HARD GATE

Не проектировать новые API без доказанной необходимости.

Primary existing APIs:

```text
GET /api/v1/dashboard/command-center
GET /api/v1/dashboard/command-center/trends
```

+ existing Workspace APIs.

Если design обнаруживает реальный API gap — документировать как gap, а не молча изобретать endpoint.

---

# 67. SECURITY

UI design не может:

- bypass RBAC;
- choose arbitrary partner scope;
- expose forbidden widget data;
- treat hidden widget as security;
- alter financial/analytics formulas.

---

# 68. IMPLEMENTATION WAVES

Design должен предложить bounded waves, например:

### Wave 0
Page shell + types + test harness.

### Wave 1
Header + period/CUSTOM + summary data.

### Wave 2
Default workspace renderer + KPI/chart widgets.

### Wave 3
Financial/reconciliation/funnel/trends.

### Wave 4
Customize mode + add/remove/move/resize/reset.

### Wave 5
Responsive/accessibility/error states.

### Wave 6
Regression + docs.

Адаптировать после repository analysis.

---

# 69. IMPLEMENTATION ACCEPTANCE CRITERIA

Design должен сформировать measurable acceptance criteria для будущего Step 3.2 Implementation.

Минимум:

- real Step 3.1 data displayed;
- no mock production data;
- period presets work;
- CUSTOM start/end works;
- comparison rendered correctly;
- multi-currency safe;
- reconciliation required widget present;
- default Director layout works;
- customize mode works;
- layout persists;
- reset works;
- RBAC respected;
- no per-widget API fan-out;
- responsive;
- accessible;
- loading/empty/error states;
- frontend tests;
- production build.

---

# 70. VISUAL VALIDATION REQUIREMENT

Будущий implementation должен быть проверяем **визуально в браузере**, а не только через tsc/tests.

Design report должен предусмотреть будущую validation:

- desktop viewport;
- tablet viewport;
- mobile viewport;
- normal mode;
- customize mode;
- custom period;
- multi-currency;
- empty/loading/error where feasible.

---

# 71. DESIGN FINDINGS

Если repository не даёт authority для UX/business решения, создать:

`AUTHORITY GAP`

Не придумывать.

Разделить:

- BLOCKING;
- NON-BLOCKING.

---

# 72. NEGATIVE CHECKS

На этом design pass:

- production frontend changes: 0
- production backend changes: 0
- schema changes: 0
- migrations: 0
- new permissions: 0
- new KPI formulas: 0
- new analytics authority: 0
- new financial authority: 0
- new business writes: 0
- Step 3.1 behavior changes: 0
- Step 3.3 behavior changes: 0
- Workspace Foundation behavior changes: 0
- Employee Analytics: 0
- Omnichannel: 0
- Step 2.17B changes: 0
- release: 0

---

# 73. DESIGN VERDICT A

Если UX contract полностью определён:

`PHASE 3 STEP 3.2 DASHBOARD / COMMAND CENTER UI — DESIGN & UX CONTRACT COMPLETED — READY FOR IMPLEMENTATION`

Условия:

- 18 widget inventory reconciled;
- 21 KPI mapping complete;
- default Director layout defined;
- role behavior defined where authority exists;
- period/CUSTOM UX defined;
- comparison defined;
- multi-currency defined;
- reconciliation UX defined;
- view/customize modes defined;
- responsive defined;
- accessibility defined;
- loading/empty/error defined;
- component/data architecture defined;
- implementation waves defined;
- no blocking authority gaps.

NEXT:

`PHASE 3 — STEP 3.2 — DASHBOARD / COMMAND CENTER UI — IMPLEMENTATION`

Но **не начинать implementation автоматически**.

---

# 74. DESIGN VERDICT B

Если есть blocking authority gap:

`PHASE 3 STEP 3.2 DASHBOARD / COMMAND CENTER UI — DESIGN BLOCKED — AUTHORITY DECISION REQUIRED`

Указать:

- exact gap;
- why repository cannot resolve it;
- affected UI;
- available options;
- recommended decision отдельно от canonical fact.

Не реализовывать.

---

# 75. ARTIFACT INTEGRITY

После docs-only design:

- artifact checker;
- checker regression;
- `git diff --check`.

Сообщить реальные результаты.

---

# 76. PERSISTENCE

После завершения:

- сохранить design document;
- сохранить design report;
- минимально обновить Roadmap/status;
- provenance/footer sync;
- commit;
- push;
- verify HEAD == upstream;
- tracked worktree clean;
- unrelated untracked untouched;
- сообщить реальные SHA.

---

# 77. ФОРМАТ ФИНАЛЬНОГО ОТВЕТА

Ответ полностью **на русском языке**.

Обязательно:

- Verdict;
- Step 3.2 status;
- primary persona;
- exact Command Center widget count;
- 21 KPI mapping status;
- default layout summary;
- period/CUSTOM UX;
- comparison UX;
- multi-currency UX;
- reconciliation UX;
- view/customize modes;
- responsive;
- accessibility;
- loading/error/empty;
- component architecture;
- API reuse;
- implementation waves;
- authority gaps;
- artifact integrity;
- commits/push;
- NEXT.

---

# КЛЮЧЕВОЙ РЕЗУЛЬТАТ

После этого шага разработчик должен иметь **однозначный визуальный и технический контракт** для реализации Command Center.

Он не должен на implementation этапе решать с нуля:

- какие карточки показать;
- где их расположить;
- какие widgets скрыть;
- как работает период;
- как выглядит CUSTOM;
- как показывать comparison;
- как показывать несколько валют;
- как выглядит reconciliation;
- как включается конструктор;
- как добавляются/удаляются widgets;
- как работает reset;
- как выглядит mobile;
- что делать при loading/empty/error.

Следующий implementation должен быть преимущественно **реализацией уже утверждённого UX-контракта**, а не новым этапом проектирования.
