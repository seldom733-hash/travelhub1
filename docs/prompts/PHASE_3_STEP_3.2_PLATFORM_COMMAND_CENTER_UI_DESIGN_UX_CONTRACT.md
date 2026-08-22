# PHASE 3 — STEP 3.2 — PLATFORM COMMAND CENTER UI — DESIGN & UX CONTRACT

> **ЯЗЫК:** все ответы исполнителя пользователю, промежуточные статусы, пояснения и итоговый summary должны быть на русском языке. Английский допустим для кода, команд, путей, API routes, identifiers и канонических технических статусов.

---

## 0. РОЛЬ И РЕЖИМ РАБОТЫ

Ты работаешь как **Principal Product Architect + Staff Frontend Architect + Enterprise UX Architect + Repository Auditor** проекта TravelHub.

Текущий проход является **DESIGN & UX CONTRACT ONLY**.

В этом проходе запрещено:

- реализовывать production UI;
- изменять production frontend/backend code;
- менять Prisma schema;
- создавать или изменять migrations;
- добавлять роли или permissions;
- создавать новые backend endpoints;
- менять authority существующих Step 3.1 / Step 3.3 / Step 3.3E;
- реализовывать Partner Command Center;
- создавать второй dashboard, analytics engine или workspace constructor;
- автоматически переходить к implementation после завершения design;
- выполнять release/deploy.

Требуется выполнить repository-first анализ и создать исчерпывающий, непротиворечивый **Design & UX Contract** для следующего отдельного implementation-pass.

---

## 1. РЕПОЗИТОРИЙ И BASELINE

Канонический репозиторий:

```text
https://github.com/seldom733-hash/travelhub1
```

Каноническая ветка:

```text
master
```

Последний подтверждённый reconciliation commit на момент подготовки промпта:

```text
369f7d94fe058f2586ac94d7de6fe67055726c70
```

Коммит фиксирует:

```text
PHASE 3 — PLATFORM VS PARTNER WORKSPACE ARCHITECTURE RECONCILIATION — COMPLETED
VERDICT A — PLATFORM STEP 3.2 MAY PROCEED
```

Перед началом работы обязательно:

1. Выполнить `git status --short --branch`.
2. Зафиксировать текущие `branch`, `HEAD`, `upstream`.
3. Проверить, что работа ведётся в правильном репозитории `seldom733-hash/travelhub1`.
4. Проверить, что `HEAD` содержит `369f7d9` или является его допустимым потомком.
5. Если репозиторий продвинулся, выполнить repository-first reconciliation новых коммитов и использовать фактический HEAD.
6. Не удалять и не перезаписывать пользовательские изменения.
7. При dirty worktree определить ownership изменений и не смешивать их с текущим design-pass.
8. Не использовать `legacy/` как источник текущей архитектуры, runtime, UI или зависимостей.

Если правильный репозиторий, ветка или ancestry не подтверждаются — остановиться с `BLOCKED`, не угадывать.

---

## 2. КАНОНИЧЕСКИЕ ВХОДЫ

Изучи полностью, а не по отдельным фрагментам:

### 2.1 Roadmap и sequencing

- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`
- repository-first sequencing после Step 3.3 и Step 3.3E;
- commit `24bf523` — Step 3.2 confirmed / Design-first;
- commit `369f7d9` — Platform vs Partner Workspace reconciliation.

### 2.2 Platform vs Partner architecture

- `docs/architecture/platform-vs-partner-workspace-context-model-phase3.md`
- `docs/prompts/PHASE_3_PLATFORM_VS_PARTNER_WORKSPACE_ARCHITECTURE_RECONCILIATION_REPORT.md`

### 2.3 Existing approved foundations

- Step 3.1 Dashboard / Command Center Backend design, implementation and Strict Review reports;
- `backend/src/modules/dashboard/dashboard.controller.ts`;
- `backend/src/modules/dashboard/dashboard.service.ts`;
- Step 3.3 Analytics Foundation design, implementation, remediation and Final Strict Re-Review reports;
- `backend/src/modules/analytics/**`;
- Step 3.3E Global Workspace Constructor architecture, implementation and Strict Review reports;
- `docs/architecture/global-workspace-constructor-phase3.md`;
- `backend/src/modules/workspace/workspace.types.ts`;
- `backend/src/modules/workspace/workspace.service.ts`;
- `backend/src/modules/workspace/workspace.controller.ts`;
- Prisma entity `UserWorkspaceLayout` and its current uniqueness/persistence rules.

### 2.4 Existing frontend

Проведи полный inventory:

- `frontend/app/**`;
- `frontend/components/**`;
- `frontend/lib/**`;
- current application shell;
- internal `/app/*` routes;
- current Command Center/dashboard route, если существует;
- navigation/sidebar/header/breadcrumb patterns;
- authentication/session/RBAC handling;
- API client conventions;
- existing design tokens, CSS, component primitives and responsive rules;
- loading/error/empty patterns;
- localization readiness RU/AZ/EN;
- frontend tests and build commands.

### 2.5 Contracts and architecture

- `README.md`;
- `docs/architecture/README.md`;
- relevant ADRs;
- `docs/contracts/api.md`;
- `docs/contracts/events.md` where attribution semantics matter;
- canonical screen design brief where compatible with the current repository.

Если документы конфликтуют, используй приоритет:

```text
FACTUAL CURRENT REPOSITORY STATE
→ latest approved reconciliation / strict-review
→ canonical Roadmap
→ approved architecture contracts
→ older design briefs
```

Каждый конфликт зафиксируй явно. Не разрешай его молча.

---

## 3. КАНОНИЧЕСКАЯ БИЗНЕС-МОДЕЛЬ

TravelHub имеет два разных бизнес-контекста:

| Context | Meaning | Monetization |
|---|---|---|
| `PLATFORM` | TravelHub Marketplace Operator | Commission from marketplace sales |
| `PARTNER` | Partner Storefront / Seller | Subscription / SaaS |

Hard rules:

```text
PLATFORM WORKSPACE ≠ PARTNER WORKSPACE
MARKETPLACE CHANNEL ≠ PARTNER STOREFRONT CHANNEL
ROLE ≠ BUSINESS CONTEXT
ENTITLEMENT ≠ PERMISSION ≠ CAPABILITY
ONE PLATFORM + CONTEXT-AWARE WORKSPACES
```

Этот Step 3.2 проектирует только:

```text
PLATFORM COMMAND CENTER UI
```

Не проектировать как текущий implementation scope:

```text
PARTNER COMMAND CENTER UI
MARKETPLACE BASIC PARTNER DASHBOARD
STOREFRONT PRO PARTNER DASHBOARD
ORGANIZATION SWITCHER
PARTNER EMPLOYEE RBAC
PARTNER ENTITLEMENT ENFORCEMENT
```

Partner-контекст учитывается только как архитектурная граница и negative constraint, чтобы Platform UI не стал неявной общей моделью для всех пользователей.

---

## 4. WORKSPACE CONTEXT HIERARCHY

Следующая иерархия является обязательной:

```text
IDENTITY
→ WORKSPACE CONTEXT (PLATFORM | PARTNER)
→ TENANT / PARTNER SCOPE
→ PLAN / ENTITLEMENTS (Basic | Pro)
→ BUSINESS CAPABILITIES
→ ROLE / PERMISSIONS
→ PAGE / WIDGET / ACTION AVAILABILITY
→ USER LAYOUT
```

Для Step 3.2:

- active context = `PLATFORM`;
- user layout не может расширять authority;
- скрытый/перемещённый widget не меняет permissions;
- отсутствие widget в layout не меняет backend authority;
- frontend gating не заменяет backend authorization;
- нельзя делать вид, что Partner gaps уже реализованы.

---

## 5. OBJECTIVE

Создать implementation-ready Design & UX Contract для Platform Command Center UI, который:

1. Использует существующий Step 3.1 Dashboard Backend как основной orchestration source.
2. Переиспользует Step 3.3 period, metrics, money и analytics contracts.
3. Переиспользует Step 3.3E Page/Widget Registry, Effective Layout Resolver и persistence.
4. Не создаёт per-widget backend fan-out.
5. Не дублирует analytics calculations во frontend.
6. Явно отображает Platform Marketplace Operator semantics.
7. Определяет все visual, data, interaction, responsive, accessibility и state contracts.
8. Даёт однозначную карту будущей реализации без production-кода в текущем pass.

---

## 6. ОБЯЗАТЕЛЬНЫЙ REPOSITORY-FIRST MAPPING

Сначала создай таблицу:

| Design capability | Existing code / contract | Status | Reuse / Extend / New | Target file/module for future implementation | Risk |
|---|---|---|---|---|---|

Минимально отрази:

- application shell;
- Platform route;
- navigation;
- page header;
- period selector;
- comparison indicator;
- KPI card;
- trend visualization;
- section container;
- widget grid;
- layout edit mode;
- widget registry integration;
- effective layout loading;
- layout save/reset/version conflict;
- API client;
- RBAC handling;
- loading/error/empty/stale/partial-data states;
- responsive behavior;
- tests;
- localization.

Не придумывай target paths до проверки фактической структуры репозитория.

---

## 7. PLATFORM COMMAND CENTER — INFORMATION ARCHITECTURE

Design contract должен покрывать следующие Platform-секции.

### 7.1 Marketplace Overview

Проверь фактическую Step 3.1 authority для:

- GMV;
- Orders;
- Bookings;
- Conversion;
- AOV;
- revenue/commission indicators, если они реально доступны;
- period-over-period delta;
- trends через lazy trends endpoint.

### 7.2 Partner Management

Целевые показатели:

- partner applications;
- verification/onboarding;
- active/inactive partners;
- quality/performance oversight только при существующей authority.

Если Step 3.1 API не предоставляет показатель — пометь `GAP`; не создавай fake value и не переиспользуй семантически другой KPI.

### 7.3 Moderation

Целевые показатели:

- listings awaiting review;
- moderation backlog;
- SLA только при наличии канонического timestamp/authority;
- flagged/rejected/approved counts только при существующей семантике.

### 7.4 Financial Overview

Целевые показатели:

- commission;
- payments;
- refunds;
- reconciliation;
- currency-separated representation.

Hard rules:

- не смешивать commission и subscription;
- не складывать разные currencies;
- не вычислять деньги через JS float;
- не показывать projected/derived finance как settled fact;
- использовать только существующие approved read models.

### 7.5 Support / Risk

Целевые показатели:

- complaints;
- disputes;
- unresolved items;
- fraud/risk indicators только при реальном source of truth;
- privileged access boundaries.

### 7.6 Employees / Operations

Целевые показатели:

- workload;
- operational tasks;
- SLA/task completion только при существующей authority;
- actor attribution не превращать в employee performance scoring.

Hard rule:

```text
FOUNDATION ATTRIBUTION ≠ EMPLOYEE PERFORMANCE SCORING
```

Для каждой секции дай:

- business purpose;
- intended audience/roles;
- KPI/widget inventory;
- source endpoint/field;
- formatting rules;
- drill-down target;
- visibility rule;
- empty/partial/error behavior;
- unresolved gaps.

---

## 8. API-TO-UI CONTRACT

Построй точную таблицу:

| UI element / widget | Step 3.1 endpoint | Response path | Semantic meaning | Format | Permission | Empty behavior | Error behavior |
|---|---|---|---|---|---|---|---|

Обязательно проверить фактические endpoints, включая:

```text
GET /api/v1/dashboard/command-center
GET /api/v1/dashboard/command-center/trends
```

Не полагайся на пути из этого промпта, если repository code показывает иной фактический route.

Зафиксируй:

- один initial summary request или фактическую approved модель;
- lazy trends loading;
- query parameters;
- period/timezone/comparison propagation;
- response typing;
- cancellation/race behavior при быстрой смене периода;
- stale response suppression;
- retry policy;
- authentication and authorization failures;
- transport error vs domain-empty distinction;
- partial section availability;
- unknown widget/field forward compatibility.

Нельзя:

- выполнять отдельный request на каждую KPI-card;
- пересчитывать backend metrics на frontend;
- объединять incompatible money/currency values;
- подменять отсутствующие значения нулём без contract authority.

---

## 9. TIME / PERIOD UX CONTRACT

Platform Command Center должен переиспользовать Step 3.3 Analytics Time/Period Contract.

Предустановленные периоды:

- Today;
- 3 Days;
- 7 Days;
- Month;
- 6 Months;
- Year;
- Custom (`startDate`, `endDate`).

Design должен определить:

- control placement;
- labels и localization RU/AZ/EN;
- active selection;
- Custom range interaction;
- validation errors;
- company/business timezone presentation;
- half-open UTC interval semantics без технического шума для пользователя;
- comparison with previous equivalent period;
- loading behavior after change;
- URL state или иной persistence decision;
- browser navigation behavior;
- mobile interaction;
- accessibility/keyboard behavior.

Hard rules:

```text
CUSTOM PERIOD MUST REMAIN CUSTOM
BUSINESS REPORTING TIME ≠ BROWSER LOCAL TIME BY DEFAULT
```

Не создавать новый независимый period resolver во frontend.

---

## 10. WIDGET AND LAYOUT CONTRACT

Переиспользовать ONE Global Workspace Constructor.

Design должен определить:

- Command Center `pageId`;
- фактический registry inventory;
- required vs optional widgets;
- system default → role default → user layout resolution;
- edit mode entry/exit;
- drag/reorder/resize behavior, если поддерживается approved foundation;
- add/remove widget affordances;
- reset to effective/default layout;
- save behavior;
- optimistic concurrency/version conflict UX;
- invalid/retired widget handling;
- loading effective layout;
- no-layout fallback;
- responsive transformation rules;
- keyboard-accessible alternatives для drag-and-drop;
- unsaved changes warning;
- permission loss between load and save;
- failure recovery.

Нельзя:

- создавать новый UI-only registry, расходящийся с backend registry;
- создавать `PlatformConstructor` отдельно от Global Workspace Constructor;
- разрешать layout включить unauthorized widget;
- разрешать layout изменить backend scope;
- считать Partner context fields реализованными — они deferred.

---

## 11. VISUAL SYSTEM AND COMPONENT CONTRACT

Определи без реализации:

### 11.1 Page frame

- Platform application shell;
- sidebar/navigation relationship;
- breadcrumb/title;
- period/action toolbar;
- content width;
- grid rhythm;
- sticky/non-sticky decisions.

### 11.2 KPI cards

- title;
- primary value;
- unit/currency;
- comparison delta;
- direction semantics;
- sparkline/trend affordance;
- tooltip/help;
- loading skeleton;
- missing data;
- restricted data;
- click/drill-down behavior.

Не использовать универсальное правило `green = increase`, потому что рост refunds, disputes или backlog может быть негативным. Для каждого KPI определить semantic polarity.

### 11.3 Sections and charts

- section hierarchy;
- chart selection criteria;
- axes/labels/tooltips;
- currency separation;
- granularity;
- no-data presentation;
- comparison overlay;
- responsive degradation;
- accessible tabular/text alternative.

### 11.4 Action and status patterns

- primary/secondary actions;
- badges/statuses;
- alert severity;
- links to operational centers;
- confirmation requirements, если action destructive;
- disabled vs hidden semantics.

Reuse existing design tokens/components where present. New primitive may be proposed only after documented gap analysis.

---

## 12. NAVIGATION CONTRACT

Step 3.2 must fit the Platform navigation target:

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

В design-pass:

- inventory current navigation;
- distinguish existing route, planned route and unavailable route;
- do not create dead links silently;
- determine Platform Command Center active-state;
- preserve access control;
- document breadcrumb behavior;
- do not add Partner menu to Platform workspace;
- do not implement organization switcher.

Если target menu отличается от текущего repo, создай explicit delta table; не расширяй implementation scope автоматически.

---

## 13. STATE MATRIX

Создай полную state matrix минимум для:

| State | Page | Section | Widget | User action | Recovery |
|---|---|---|---|---|---|

Обязательные состояния:

- initial loading;
- summary loaded;
- lazy trends loading;
- empty business dataset;
- metric not applicable;
- partial section data;
- stale cached data;
- validation error;
- unauthenticated `401`;
- forbidden `403`;
- not found/unsupported widget;
- server error `5xx`;
- network offline/timeout;
- retry in progress;
- period switch race;
- layout loading;
- layout editing;
- unsaved layout;
- layout save success;
- layout save failure;
- layout version conflict;
- permission revoked;
- unknown future field/widget.

Hard distinction:

```text
ZERO VALUE ≠ NO DATA ≠ NOT APPLICABLE ≠ FORBIDDEN ≠ FAILED
```

---

## 14. RESPONSIVE CONTRACT

Определи breakpoints на основе существующей frontend system, не произвольных новых значений.

Минимально:

- desktop wide;
- desktop/laptop;
- tablet;
- mobile.

Для каждого режима определить:

- sidebar behavior;
- header/toolbar wrapping;
- period selector;
- KPI grid columns;
- chart size/scroll;
- section order;
- widget resize/drag limitations;
- edit mode availability;
- table alternative;
- touch target sizes;
- prevention of horizontal overflow.

Mobile не должен быть просто уменьшенной desktop-страницей.

---

## 15. ACCESSIBILITY CONTRACT

Design должен соответствовать минимум WCAG 2.1 AA intent.

Определить:

- semantic headings/landmarks;
- keyboard navigation;
- focus order and visible focus;
- accessible names;
- chart alternatives;
- non-color-only status communication;
- contrast;
- live-region behavior для async refresh;
- reduced motion;
- accessible date range interaction;
- accessible layout reordering alternative;
- screen-reader wording для KPI delta and comparison.

---

## 16. LOCALIZATION CONTRACT

Frontend поддерживает RU/AZ/EN.

Design должен определить:

- translation namespaces/keys strategy;
- no hard-coded user-visible strings;
- number/date/currency formatting;
- timezone label;
- pluralization;
- long-label resilience;
- RTL не требуется, если repository contract не говорит обратное;
- canonical technical statuses vs localized display labels.

Не переводить identifiers/API fields в transport layer.

---

## 17. SECURITY AND DATA-ISOLATION CONTRACT

Непереговорные правила:

```text
PLATFORM DATA ≠ PARTNER DATA
PARTNER A ≠ PARTNER B
USER LAYOUT CANNOT EXPAND AUTHORITY
FRONTEND VISIBILITY ≠ BACKEND AUTHORIZATION
```

Проверь и зафиксируй:

- required permission для Platform Command Center;
- behavior для пользователей без permission;
- отсутствие partnerId spoofing;
- отсутствие Partner UI assumptions;
- no sensitive values in logs/client errors;
- safe error messages;
- privileged support/risk data visibility;
- query cache keys include relevant user/context/period dimensions;
- logout/user switch clears sensitive cached data.

---

## 18. PERFORMANCE CONTRACT

Design должен сохранить Step 3.1 orchestration model.

Определи:

- initial request budget;
- lazy trends request behavior;
- no per-widget fan-out;
- cancellation/debounce при смене периода;
- render strategy;
- chart lazy loading;
- skeleton strategy without layout shift;
- cache/revalidation decision;
- bundle impact expectations;
- performance measurement plan;
- large-number/chart-point handling.

Не изменять frozen Step 2.17B targets и не заявлять qualification approval.

---

## 19. TEST STRATEGY CONTRACT

Составь будущую implementation test matrix без написания тестов в текущем pass.

Минимально:

### Unit/component

- formatting;
- KPI polarity;
- state rendering;
- period selection;
- query construction;
- permission gating;
- widget mapping;
- unknown widget handling;
- layout edit/save/conflict UX;
- localization.

### Integration

- summary endpoint mapping;
- lazy trends;
- period/timezone propagation;
- request cancellation/race;
- partial/error responses;
- effective layout integration;
- unauthorized/revoked permission;
- cache separation.

### Accessibility

- keyboard navigation;
- focus management;
- accessible labels;
- no color-only semantics;
- chart alternative.

### Responsive

- representative breakpoints;
- no overflow;
- widget ordering;
- mobile toolbar/date range.

### Regression

- existing frontend tests remain PASS;
- frontend typecheck;
- lint;
- production build;
- no backend authority changes;
- no schema/migration changes.

---

## 20. REQUIRED DESIGN DECISIONS

Не оставляй implementation-команде неопределёнными как минимум:

1. Canonical Platform Command Center route.
2. Page ID used by Workspace Constructor.
3. Application shell and navigation integration.
4. Section order and hierarchy.
5. KPI/widget inventory by section.
6. Required vs optional widgets.
7. Exact API-to-widget mapping.
8. Summary vs lazy-trends loading strategy.
9. Period selector and Custom UX.
10. Comparison-period representation.
11. Currency-separated display.
12. KPI semantic polarity.
13. Drill-down behavior and unavailable drill-down handling.
14. Loading/empty/partial/error/forbidden states.
15. Layout edit/save/reset/version-conflict UX.
16. Responsive behavior.
17. Accessibility behavior.
18. Localization strategy.
19. Test matrix.
20. Explicit deferred gaps.

Если решение невозможно принять из repository evidence, пометь `OPEN DECISION` с вариантами, trade-offs и рекомендуемым выбором. Не превращай каждый вопрос в open decision — принимай обоснованное решение там, где evidence достаточно.

---

## 21. DELIVERABLES

Создай и закоммить только design/report artifacts, следуя фактическим repository naming conventions.

Обязательные deliverables:

### A. Design & UX Contract

Рекомендуемый путь:

```text
docs/architecture/platform-command-center-ui-design-ux-contract-step-3.2.md
```

Если repository conventions требуют иного имени — используй их и объясни.

Документ должен включать:

- repository baseline;
- scope/non-goals;
- repository-first mapping;
- information architecture;
- component/visual contract;
- API-to-UI mapping;
- period/timezone/comparison UX;
- widget/layout contract;
- state matrix;
- responsive/accessibility/localization;
- security/performance;
- test strategy;
- gaps/open decisions;
- implementation waves;
- acceptance criteria.

### B. Design Pass Report

Рекомендуемый путь:

```text
docs/prompts/PHASE_3_STEP_3.2_PLATFORM_COMMAND_CENTER_UI_DESIGN_UX_CONTRACT_REPORT.md
```

Report должен содержать:

- exact branch/base SHA/final SHA;
- files changed;
- production code changes count;
- schema/migration changes count;
- canonical decisions;
- unresolved blockers;
- verification evidence;
- final verdict;
- exact NEXT.

### C. Minimal Roadmap status sync

Roadmap разрешено менять только если это соответствует его существующей структуре и необходимо для честного статуса Step 3.2. Не переписывать историю и не объявлять implementation completed.

---

## 22. IMPLEMENTATION WAVES

Design contract должен разложить будущую реализацию минимум на следующие waves:

1. Route + Platform shell integration.
2. Typed API client + query/state layer.
3. Period/comparison controls.
4. Summary sections and KPI cards.
5. Lazy trends/charts.
6. Workspace Constructor/effective layout integration.
7. Layout edit/save/reset/conflict UX.
8. Responsive/accessibility/localization hardening.
9. Component/integration/regression tests.
10. Full frontend verification and implementation report.

Каждый wave должен содержать:

- target files/modules;
- dependencies;
- acceptance criteria;
- tests;
- rollback/containment considerations.

---

## 23. ACCEPTANCE CRITERIA — DESIGN PASS

Pass может получить `VERDICT A — READY FOR IMPLEMENTATION`, только если:

- correct repo/branch/ancestry verified;
- current frontend inventory completed;
- Step 3.1/3.3/3.3E contracts mapped;
- Platform-only scope is explicit;
- Partner Command Center is explicitly deferred;
- route/pageId/navigation decisions are defined;
- all Platform sections are mapped to real authority or explicit gaps;
- API-to-widget table is complete;
- period/timezone/comparison UX is defined;
- currency and finance semantics are safe;
- widget/layout/edit/conflict contract is defined;
- full state matrix exists;
- responsive/accessibility/localization contracts exist;
- performance and test strategies exist;
- no production code/schema/migration/permission changes occurred;
- implementation waves are executable;
- blockers and open decisions are explicit;
- artifacts are committed and pushed;
- final `HEAD == upstream` and worktree is clean.

---

## 24. VERDICT MODEL

Используй один из вариантов:

### VERDICT A — READY FOR IMPLEMENTATION

Design & UX Contract полный, repository-grounded, без блокирующих неопределённостей.

### VERDICT B — DESIGN INCOMPLETE

Есть существенные пробелы, но нет repository/system blocker. Требуется design remediation.

### VERDICT C — BLOCKED

Repository state, authority/API conflict, missing canonical input или иной blocker не позволяет безопасно завершить contract.

Нельзя выдавать `VERDICT A`, если API-to-widget mapping основан на предположениях или Platform/Partner semantics смешаны.

---

## 25. NEGATIVE CHECKS

В итоговом отчёте явно укажи counts/status:

| Negative check | Required result |
|---|---:|
| Production frontend changes | 0 |
| Production backend changes | 0 |
| Schema changes | 0 |
| Migrations | 0 |
| New roles | 0 |
| New permissions | 0 |
| New endpoints | 0 |
| Partner Command Center implementation | 0 |
| Partner entitlement implementation | 0 |
| Organization switcher implementation | 0 |
| Second analytics engine | 0 |
| Second workspace constructor | 0 |
| Step 2.17B changes | 0 |
| Frozen targets changed | 0 |
| Release/deploy | 0 |
| Auto-start next implementation | 0 |

---

## 26. VERIFICATION

Так как pass docs-only, минимум выполнить:

```bash
git diff --check
git status --short --branch
```

Дополнительно repository evidence должен включать baseline results, не изменяя code:

- текущий frontend Vitest status;
- frontend TypeScript status;
- frontend production build status;
- relevant backend tests/status, если это требуется для подтверждения existing authority;
- migration count/drift evidence без изменения DB;
- artifact integrity checker, если он является каноническим для repo.

Не скрывать skipped проверки. Для каждой указать `PASS`, `FAIL`, `SKIPPED` или `BLOCKED` с причиной.

---

## 27. COMMIT / PUSH

После успешного design-pass:

1. Проверить diff и отсутствие production changes.
2. Создать отдельный осмысленный commit.
3. Push в текущую разрешённую ветку согласно repository workflow.
4. Зафиксировать final SHA.
5. Подтвердить `HEAD == upstream`.
6. Подтвердить clean worktree.

Рекомендуемый commit message:

```text
docs(step-3.2): Platform Command Center UI Design & UX Contract
```

Не создавать release/deploy.

---

## 28. ФОРМАТ ФИНАЛЬНОГО ОТВЕТА

Ответить на русском языке в следующем порядке:

1. **Что выполнено**.
2. **Repository state** — repo, branch, base SHA, final SHA, upstream, worktree.
3. **Ключевые Design & UX решения**.
4. **API-to-UI итог**.
5. **Platform vs Partner isolation confirmation**.
6. **Artifacts changed**.
7. **Verification matrix**.
8. **Negative checks**.
9. **Open decisions / gaps / blockers**.
10. **VERDICT**.
11. **NEXT**.

Если `VERDICT A`, точный NEXT:

```text
NEXT: PHASE 3 — STEP 3.2 — PLATFORM COMMAND CENTER UI — IMPLEMENTATION
```

Implementation не запускать в этом же pass.

---

## 29. FINAL EXECUTION COMMAND

Выполни полный repository-first **Phase 3 — Step 3.2 — Platform Command Center UI — Design & UX Contract** pass согласно этому промпту.

Не сокращай анализ, не заменяй evidence предположениями, не смешивай Platform и Partner, не начинай production implementation и не переходи автоматически к следующему шагу.
