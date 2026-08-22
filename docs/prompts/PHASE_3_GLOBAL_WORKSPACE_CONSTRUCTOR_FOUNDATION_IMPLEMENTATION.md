# TRAVELHUB --- PHASE 3 --- GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION --- IMPLEMENTATION

> **ОБЯЗАТЕЛЬНЫЙ ЯЗЫК ОТВЕТОВ**
>
> Все ответы разработчика пользователю, промежуточные статусы, findings,
> пояснения и итоговый summary должны быть **на русском языке**.
>
> Английский допускается для кода, команд, путей, API routes,
> DTO/enum/permission names, идентификаторов и канонических технических
> статусов.

------------------------------------------------------------------------

# 1. ЦЕЛЬ

Реализовать **Wave A --- Global Workspace Constructor Foundation** на
основании утверждённого:

`PHASE 3 — GLOBAL PAGE / WORKSPACE CONSTRUCTOR — ARCHITECTURE ADDENDUM`

Design commit:

`26e1d9c`

Текущий архитектурный verdict:

`VERDICT A — READY FOR IMPLEMENTATION SEQUENCING`

Цель этого шага --- создать **общий backend/frontend foundation**,
который затем будет использован Step 3.2 Command Center UI и другими
рабочими центрами.

После успешной реализации статус:

`GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION — IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

**Не ставить APPROVED в этом проходе.**

------------------------------------------------------------------------

# 2. REPOSITORY-FIRST

Перед изменениями проверить:

-   branch / HEAD / upstream / worktree;
-   canonical Roadmap;
-   architecture addendum;
-   addendum report;
-   commit `26e1d9c`;
-   Step 3.1 APPROVED backend contract;
-   Step 3.3 APPROVED analytics contract;
-   существующие User/Role/Permission models;
-   существующие settings/preferences/profile models;
-   frontend state/data-fetch conventions;
-   существующие UI/grid/component libraries;
-   Prisma schema/migration conventions;
-   security/RBAC conventions.

Не доверять summary без repository evidence.

------------------------------------------------------------------------

# 3. КЛЮЧЕВОЙ ИНВАРИАНТ

Реализуется:

``` text
ONE GLOBAL WORKSPACE CONSTRUCTOR
```

а не отдельные:

``` text
Dashboard Constructor
Analytics Constructor
Sales Constructor
...
```

Foundation должен быть page-agnostic и widget-registry driven.

------------------------------------------------------------------------

# 4. SCOPE ЭТОГО IMPLEMENTATION

Реализовать только foundation, необходимый для последующего Step 3.2:

-   canonical Page Registry;
-   canonical Widget Registry;
-   layout hierarchy;
-   persistence user layout;
-   validation/versioning;
-   page constructor enable/disable policy;
-   widget policy;
-   backend APIs;
-   frontend shared constructor primitives/state contracts;
-   reset/fallback;
-   RBAC filtering;
-   required-widget restoration;
-   tests;
-   migration;
-   documentation.

**Не реализовывать полноценный Command Center UI в этом шаге.**

------------------------------------------------------------------------

# 5. OUT OF SCOPE

Не начинать:

-   Step 3.2 visual Dashboard implementation;
-   final drag/drop Command Center screen;
-   Analytics Center constructor UI;
-   CRM/Sales/Bookings/Orders constructor UI;
-   Employee Analytics;
-   admin editor for system/role defaults;
-   import/export layouts;
-   user templates;
-   cross-page copy;
-   new KPI formulas;
-   new analytics authority;
-   Step 2.17B qualification;
-   release.

------------------------------------------------------------------------

# 6. LAYOUT HIERARCHY

Реализовать canonical hierarchy:

``` text
SYSTEM DEFAULT
    ↓
ROLE DEFAULT
    ↓
USER LAYOUT
```

Effective layout должен вычисляться детерминированно.

User layout не может переопределить security/policy restrictions.

------------------------------------------------------------------------

# 7. RESET SEMANTICS

Реализовать:

``` text
User Reset
→ Role Default, если существует
→ иначе System Default
```

Reset должен удалять/сбрасывать только персональный override, не
system/role definitions.

------------------------------------------------------------------------

# 8. PAGE REGISTRY

Создать единый canonical Page Registry.

Минимально зарегистрировать страницы согласно design evidence.

Особенно:

-   Command Center --- constructor enabled;
-   Analytics Center --- constructor enabled;
-   CRM / Orders / Bookings --- текущий rollout state может быть
    disabled, но это **не архитектурный permanent prohibition**;
-   Settings --- fixed/disabled, если design это подтвердил.

Для page definition поддержать минимум:

-   `pageId`;
-   `constructorEnabled`;
-   `defaultLayout`;
-   `allowedWidgets`;
-   `requiredWidgets`;
-   `layoutVersion`;
-   grid/breakpoint constraints.

------------------------------------------------------------------------

# 9. ВАЖНО: DISABLED ≠ NEVER SUPPORTED

Для CRM / Orders / Bookings текущий `constructorEnabled=false`
трактовать как:

`NOT ENABLED IN CURRENT ROLLOUT`

а не:

`ARCHITECTURALLY UNSUPPORTED`.

Foundation должен позволять включить их позднее конфигурационно без
новой архитектуры.

------------------------------------------------------------------------

# 10. WIDGET REGISTRY

Реализовать единый Widget Registry.

Для каждого widget минимум:

-   stable `widgetId`;
-   compatible `pageIds`;
-   category/type;
-   default title/metadata;
-   required permission;
-   default size;
-   min/max size;
-   movable;
-   resizable;
-   removable;
-   required;
-   canonical data source identifier;
-   config schema/validator;
-   widget contract version.

Display label не использовать как identity.

------------------------------------------------------------------------

# 11. COMMAND CENTER WIDGET CATALOG

Архитектурный addendum сообщает 18 widgets для Command Center.

Repository-first сверить это с Step 3.1, где backend имеет 21 KPI.

Не превращать автоматически каждый backend KPI в отдельный visible
widget.

Foundation должен поддержать distinction:

-   default widget;
-   optional widget;
-   required widget;
-   hidden-by-default capability.

`reconciliation` --- required widget согласно design, если repository
evidence подтверждает.

------------------------------------------------------------------------

# 12. PAGE POLICY

Поддержать:

``` text
constructorEnabled: boolean
```

Если false:

-   customize mode unavailable;
-   layout mutation API должна отклонять изменение или возвращать
    canonical forbidden/disabled response;
-   default/effective layout остаётся доступным для rendering.

------------------------------------------------------------------------

# 13. WIDGET POLICY

Поддержать независимо:

-   available;
-   visibleByDefault;
-   removable;
-   movable;
-   resizable;
-   required.

Required widget нельзя удалить пользовательским layout.

------------------------------------------------------------------------

# 14. RBAC --- HARD GATE

RBAC всегда выше saved layout.

При формировании available/effective widgets backend обязан фильтровать
registry по canonical permissions.

Нельзя:

-   сохранить forbidden widget и затем получить его;
-   использовать layout как обход `analytics.read`;
-   обойти partner/tenant scope;
-   получить admin/finance widget без permission.

Frontend не является security boundary.

------------------------------------------------------------------------

# 15. PARTNER/TENANT SCOPE

Layout содержит только presentation/config metadata.

Не хранить доверенный scope как security authority.

Если widget config содержит entity filter/partnerId, downstream API всё
равно обязан применять canonical scope resolution.

------------------------------------------------------------------------

# 16. PERSISTENCE

Реализовать утверждённую persistence model:

`UserWorkspaceLayout`

с JSON layout payload.

Минимально:

-   stable primary key;
-   `userId`;
-   `pageId`;
-   `layoutVersion`;
-   `widgets` / layout JSON;
-   timestamps.

Repository-first выбрать точные Prisma naming/types/indexes/relations.

------------------------------------------------------------------------

# 17. UNIQUENESS

Должен существовать один active personal layout на:

``` text
(userId, pageId)
```

Обеспечить DB-level uniqueness.

------------------------------------------------------------------------

# 18. SCHEMA / MIGRATION

В отличие от design pass, foundation implementation **может и должен**
добавить schema/migration, если это требуется выбранной persistence
architecture.

Создать минимальную migration только для Workspace persistence.

Не менять unrelated domain schema.

Проверить:

-   migration applies;
-   migration rollback/rebuild conventions, если repository их
    использует;
-   drift 0;
-   fresh DB path.

------------------------------------------------------------------------

# 19. JSON VALIDATION

Saved layout --- untrusted input.

Валидировать:

-   pageId;
-   widgetId;
-   positions;
-   sizes;
-   config;
-   duplicates;
-   required widgets;
-   allowed widgets;
-   version;
-   malformed JSON shape.

Не принимать arbitrary properties как executable configuration.

------------------------------------------------------------------------

# 20. VERSIONING

Реализовать layout versioning.

Если saved layout version устарел:

-   deterministic migration/sanitization;
-   unknown widgets ignored;
-   required widgets restored;
-   valid widgets preserved;
-   page does not crash.

Не создавать сложную migration framework сверх текущей необходимости.

------------------------------------------------------------------------

# 21. INVALID / REMOVED WIDGET

Если layout содержит removed/unknown widget:

-   ignore safely;
-   preserve valid widgets;
-   restore required widgets;
-   return valid effective layout.

------------------------------------------------------------------------

# 22. REQUIRED WIDGET RESTORATION

Adversarial case:

пользователь вручную/старой версией layout удалил required widget.

Effective layout обязан восстановить required widget.

------------------------------------------------------------------------

# 23. EFFECTIVE LAYOUT RESOLVER

Создать единый resolver/service:

``` text
System Default
+ Role Default
+ User Override
+ Page Policy
+ Widget Policy
+ RBAC Filter
+ Version Sanitization
= Effective Layout
```

Не размазывать merge logic по controllers/frontend.

------------------------------------------------------------------------

# 24. ROLE DEFAULT

Если addendum выбрал role defaults, но repository не имеет persistence
authority для редактируемых role layouts:

-   реализовать минимальный code/config-defined role default mechanism;
-   не создавать admin UI;
-   документировать future administration gap.

Если design выбрал иной concrete storage --- следовать design.

------------------------------------------------------------------------

# 25. BACKEND API

Реализовать canonical repository-conformant API для foundation.

Ожидаемая capability:

-   получить effective workspace/page definition;
-   получить available widgets;
-   сохранить user layout;
-   reset user layout.

Conceptual routes из design:

``` text
GET    /api/v1/workspaces/:pageId
GET    /api/v1/workspaces/:pageId/widgets
PUT    /api/v1/workspaces/:pageId/layout
DELETE /api/v1/workspaces/:pageId/layout
```

Но точные routes выбрать по repository conventions и зафиксировать в
report.

------------------------------------------------------------------------

# 26. API AUTH

Все user-layout endpoints требуют authentication.

Пользователь изменяет только собственный layout, если design не
определил admin capability.

Не принимать arbitrary `userId` для self-service layout mutation.

------------------------------------------------------------------------

# 27. SAVE SEMANTICS

Save должен быть idempotent/upsert-safe для `(userId,pageId)`.

Concurrency не должна создавать duplicate layouts.

------------------------------------------------------------------------

# 28. RESET SEMANTICS API

Reset должен быть idempotent:

-   если user layout существует → удалить override;
-   если отсутствует → success/no-op по canonical API convention;
-   effective layout после reset = role/system default.

------------------------------------------------------------------------

# 29. CONSTRUCTOR DISABLED

Для disabled page:

-   GET effective layout разрешён, если сама страница доступна;
-   mutation/customization endpoint не должен позволять save;
-   frontend shared layer должен знать `constructorEnabled=false`.

------------------------------------------------------------------------

# 30. FRONTEND FOUNDATION

Создать shared frontend foundation, но **не полноценный Step 3.2
экран**.

Минимально:

-   workspace types;
-   page definition types;
-   widget definition types;
-   effective layout types;
-   API client;
-   layout state/store/hook согласно repository conventions;
-   customize-mode capability flag;
-   reset/save primitives;
-   registry-driven rendering contract/interface.

------------------------------------------------------------------------

# 31. НЕ ДЕЛАТЬ СЕЙЧАС ПОЛНЫЙ VISUAL CONSTRUCTOR

Не требуется в Wave A:

-   финальная widget palette;
-   production drag/drop UX;
-   resize handles;
-   polished Dashboard;
-   complete responsive design.

Это будет consumer/UI wave.

Foundation должен лишь сделать их возможными без backend redesign.

------------------------------------------------------------------------

# 32. GRID CONTRACT

Зафиксировать shared grid contract:

-   desktop: 12 columns;
-   tablet: 8 columns;
-   mobile: 4 columns.

Drag/drop разрешён только desktop согласно design.

Frontend foundation types должны поддерживать breakpoint-aware
positions/sizes или выбранную design abstraction.

------------------------------------------------------------------------

# 33. MOBILE

На mobile не реализовывать drag/drop.

Effective layout должен иметь безопасный auto-stack/fallback contract.

------------------------------------------------------------------------

# 34. DATA FETCH STRATEGY

Foundation не должен превращать widgets в независимые API fan-out
consumers.

Для Command Center сохранить:

`page-level aggregation`

через Step 3.1.

Widget registry содержит data-source identity/selector, но не должен
инициировать по одному backend request на каждый KPI.

------------------------------------------------------------------------

# 35. STEP 3.1 INTEGRATION CONTRACT

Не менять Step 3.1 KPI formulas/API authority.

Foundation должен быть совместим с:

``` text
GET /api/v1/dashboard/command-center
GET /api/v1/dashboard/command-center/trends
```

Step 3.2 сможет map aggregated response → registered widgets.

------------------------------------------------------------------------

# 36. STEP 3.3 INVARIANT

Не менять:

-   periods;
-   comparison;
-   timezone;
-   analytics formulas;
-   multi-currency;
-   financial reconciliation;
-   actor attribution.

Constructor presentation only.

------------------------------------------------------------------------

# 37. CONFIG SCHEMA

Widget config должна быть allowlisted.

Например, foundation может поддерживать metadata вроде:

-   display variant;
-   row count;
-   visualization mode;
-   local presentation option.

Не разрешать widget config задавать arbitrary:

-   SQL;
-   endpoint URL;
-   permission;
-   userId;
-   partner scope;
-   financial formula.

------------------------------------------------------------------------

# 38. SECURITY OF DATA SOURCE ID

`dataSource` / selector --- registry-controlled.

Client не может сохранить произвольный endpoint и заставить platform его
вызвать.

------------------------------------------------------------------------

# 39. ACCESSIBILITY CONTRACT

Shared frontend foundation должен предусмотреть:

-   keyboard-compatible future movement/reordering;
-   semantic widget containers;
-   focusable customize controls;
-   accessible labels.

Полный drag/drop accessibility будет проверяться в UI consumer wave.

------------------------------------------------------------------------

# 40. ERROR/FALLBACK

Foundation должен различать:

-   workspace unavailable;
-   constructor disabled;
-   invalid saved layout;
-   permission-filtered widget;
-   save validation error;
-   server error.

Corrupt user layout не должен делать страницу недоступной.

------------------------------------------------------------------------

# 41. OBSERVABILITY

Использовать существующие logging/error conventions.

Не добавлять новый telemetry framework.

Логировать layout sanitization/version mismatch без sensitive data.

------------------------------------------------------------------------

# 42. AUDITABILITY

User cosmetic layout mutation не превращать автоматически в heavy domain
audit event.

Если repository имеет generic settings audit --- использовать только
согласно existing convention.

Не emit domain business events.

------------------------------------------------------------------------

# 43. BUSINESS WRITES DISTINCTION

`UserWorkspaceLayout` persistence --- допустимый configuration write.

Но:

-   sales writes = 0;
-   booking writes = 0;
-   payment writes = 0;
-   ledger writes = 0;
-   analytics business writes = 0;
-   EventBus business emits = 0.

------------------------------------------------------------------------

# 44. TEST WAVE 0 --- CHARACTERIZATION / REGISTRY

До/в начале реализации добавить tests для:

-   page registry;
-   widget registry;
-   unique IDs;
-   compatible pages;
-   required widget validity;
-   disabled page policy.

------------------------------------------------------------------------

# 45. TEST WAVE 1 --- RESOLVER

Unit tests:

-   system default;
-   role default;
-   user override;
-   precedence;
-   reset;
-   unknown widget;
-   removed widget;
-   required restoration;
-   RBAC filtering;
-   disabled constructor;
-   version mismatch;
-   duplicate widget sanitization.

------------------------------------------------------------------------

# 46. TEST WAVE 2 --- PERSISTENCE

Проверить:

-   create;
-   update/upsert;
-   uniqueness;
-   concurrent duplicate protection;
-   reset/delete;
-   different users same page;
-   same user different pages.

------------------------------------------------------------------------

# 47. TEST WAVE 3 --- API / SECURITY E2E

Минимум:

-   unauthenticated denied;
-   own workspace GET;
-   own layout PUT;
-   reset;
-   invalid page;
-   disabled constructor mutation denied;
-   forbidden widget rejected/filtered;
-   unknown widget sanitized/rejected per contract;
-   required widget cannot disappear;
-   user cannot mutate another user's layout;
-   partner scope cannot be bypassed through config.

------------------------------------------------------------------------

# 48. TEST WAVE 4 --- FRONTEND FOUNDATION

Проверить:

-   types/API client;
-   effective layout load;
-   constructorEnabled handling;
-   save/reset;
-   invalid layout fallback;
-   registry-driven mapping contract;
-   no per-widget request fan-out in shared foundation.

------------------------------------------------------------------------

# 49. MIGRATION TEST

Проверить migration на текущей DB и fresh/rebuild path по canonical
repository process.

После migration:

-   all migrations applied;
-   drift 0.

Сообщить реальный migration count.

------------------------------------------------------------------------

# 50. FULL BACKEND REGRESSION

Выполнить:

-   backend tsc;
-   backend production build;
-   full backend unit;
-   full canonical serial e2e.

Сообщить реальные counts.

------------------------------------------------------------------------

# 51. FULL FRONTEND REGRESSION

Выполнить:

-   frontend tsc;
-   full Vitest;
-   frontend production build.

------------------------------------------------------------------------

# 52. ARTIFACT INTEGRITY

Выполнить:

-   artifact checker;
-   checker regression;
-   `git diff --check`.

Сообщить реальные PASS/WARN/FAIL.

------------------------------------------------------------------------

# 53. NO STEP 3.2 YET

После реализации foundation **не начинать автоматически Step 3.2**.

Сначала:

`GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION — STRICT REVIEW`

------------------------------------------------------------------------

# 54. IMPLEMENTATION REPORT

Создать:

`docs/prompts/PHASE_3_GLOBAL_WORKSPACE_CONSTRUCTOR_FOUNDATION_IMPLEMENTATION_REPORT.md`

Обязательные разделы:

1.  Executive Summary
2.  Repository Baseline
3.  Architecture Contract
4.  Files Changed
5.  Page Registry
6.  Widget Registry
7.  Layout Hierarchy
8.  Effective Layout Resolver
9.  Constructor Enable/Disable
10. Widget Policies
11. RBAC
12. Partner/Tenant Isolation
13. Persistence Model
14. Migration
15. Versioning/Sanitization
16. Required Widget Restoration
17. Backend API
18. Frontend Foundation
19. Grid/Responsive Contract
20. Data Fetch Strategy
21. Step 3.1 Compatibility
22. Step 3.3 Boundary
23. Security
24. Unit Tests
25. E2E Tests
26. Frontend Tests
27. Full Regression
28. DB/Drift
29. Artifact Integrity
30. Negative Checks
31. Authority Gaps
32. Persistence / Git
33. Verdict
34. NEXT
35. Repository Evidence

------------------------------------------------------------------------

# 55. ROADMAP

Repository-first обновить Roadmap минимально.

Не придумывать новый canonical step number, если architecture addendum
уже определил placement.

Зафиксировать foundation implementation state.

------------------------------------------------------------------------

# 56. NEGATIVE CHECKS

В report явно:

-   Step 3.2 UI implementation: 0
-   Command Center visual redesign: 0
-   new KPI formulas: 0
-   Step 3.1 business behavior changes: 0
-   Step 3.3 behavior changes: 0
-   new analytics authority: 0
-   new financial authority: 0
-   sales writes: 0
-   booking writes: 0
-   payment/ledger/commission writes: 0
-   business EventBus emits: 0
-   Employee Analytics implementation: 0
-   Step 2.17B changes: 0
-   release: 0

Schema/migration changes здесь допускаются **только для Workspace
Constructor persistence** и должны быть перечислены отдельно.

------------------------------------------------------------------------

# 57. VERDICT A

Использовать только если:

-   global Page Registry implemented;
-   global Widget Registry implemented;
-   constructor enable/disable works;
-   system/role/user hierarchy works;
-   effective resolver centralized;
-   user persistence works;
-   DB uniqueness works;
-   versioning/sanitization works;
-   required widgets restored;
-   RBAC filtering works;
-   cross-user mutation blocked;
-   partner/tenant scope not bypassable;
-   APIs implemented;
-   frontend shared foundation implemented;
-   Step 3.1 compatibility preserved;
-   Step 3.3 authority unchanged;
-   focused tests PASS;
-   backend tsc/build PASS;
-   full backend unit PASS;
-   full serial e2e PASS;
-   frontend tsc/Vitest/build PASS;
-   migrations current;
-   drift 0;
-   artifact integrity PASS;
-   unresolved CRITICAL/HIGH = 0.

Тогда:

`PHASE 3 GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION IMPLEMENTATION COMPLETED — WAITING FOR STRICT REVIEW`

------------------------------------------------------------------------

# 58. VERDICT B

Если implementation defect остаётся:

`PHASE 3 GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION IMPLEMENTATION INCOMPLETE — REMEDIATION REQUIRED`

Не переходить к Step 3.2.

NEXT:

`GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION — REMEDIATION`

------------------------------------------------------------------------

# 59. VERDICT C

Если обнаружена отсутствующая authority, без которой нельзя безопасно
реализовать foundation:

`GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION IMPLEMENTATION BLOCKED — AUTHORITY/DESIGN DECISION REQUIRED`

Не придумывать policy.

------------------------------------------------------------------------

# 60. PERSISTENCE / GIT

После полного PASS:

-   intentional diff;
-   `git diff --check`;
-   unrelated untracked untouched;
-   commit implementation/migration/tests;
-   commit docs/Roadmap/provenance согласно repository convention;
-   push;
-   verify HEAD == upstream;
-   tracked worktree clean;
-   сообщить реальные SHA.

------------------------------------------------------------------------

# 61. ФОРМАТ ФИНАЛЬНОГО ОТВЕТА

Ответ разработчика полностью **на русском языке**.

Обязательно:

-   Verdict;
-   foundation status;
-   Page Registry;
-   Widget Registry;
-   constructor enable/disable;
-   system/role/user hierarchy;
-   persistence/schema/migration;
-   APIs;
-   RBAC/security;
-   versioning/sanitization;
-   required widget restoration;
-   frontend foundation;
-   Step 3.1 compatibility;
-   Step 3.3 boundary;
-   unit/e2e;
-   backend full regression;
-   frontend full regression/build;
-   DB/drift;
-   artifact integrity;
-   files changed;
-   commits/push;
-   authority gaps;
-   NEXT.

------------------------------------------------------------------------

# 62. NEXT

При VERDICT A:

`NEXT: PHASE 3 — GLOBAL WORKSPACE CONSTRUCTOR FOUNDATION — STRICT REVIEW`

**Не запускать Step 3.2 автоматически.**

------------------------------------------------------------------------

# КЛЮЧЕВОЙ КРИТЕРИЙ

После этого шага TravelHub должен иметь технический фундамент:

``` text
SYSTEM DEFAULT
→ ROLE DEFAULT
→ USER LAYOUT
```

с:

``` text
PAGE REGISTRY
+ WIDGET REGISTRY
+ RBAC
+ VERSIONED PERSISTENCE
+ SAFE FALLBACK
+ ENABLE/DISABLE POLICY
```

но без преждевременной реализации полноценного Dashboard UI.

Это фундамент, на котором Step 3.2 станет **первым визуальным consumer**
общего Workspace Constructor.
