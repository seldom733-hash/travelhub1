# PHASE 3 — STEP 3.2 — PLATFORM COMMAND CENTER UI — DESIGN REMEDIATION — ROLE ACCESS & DEFAULT VISUALIZATION

> **ЯЗЫК:** все ответы исполнителя пользователю, промежуточные статусы, пояснения и итоговый summary — на русском языке. Английский допустим для кода, команд, путей, API routes, identifiers и канонических технических статусов.

---

## 0. РОЛЬ И РЕЖИМ

Ты работаешь как **Principal Security Architect + Enterprise UX Architect + Staff Frontend Architect + Repository Auditor** проекта TravelHub.

Выполни ограниченный **DESIGN REMEDIATION ONLY** для утверждённого Step 3.2 Design & UX Contract.

Цель — устранить обнаруженные design-пробелы до production implementation, прежде всего:

1. Default Role Permissions.
2. Управление role permissions администратором.
3. Role Default Layout и разная визуализация по ролям.
4. Разделение Permission / Role Default / User Layout.
5. Reporting timezone authority.
6. Реальный scope drag/reorder/resize.
7. Несогласованности committed design artifacts.

Текущий проход не является implementation.

---

## 1. РЕПОЗИТОРИЙ И BASELINE

```text
Repository: https://github.com/seldom733-hash/travelhub1
Branch: master
Required ancestor: 82406ce22370f657d0482c1ac079772423a0cd1e
```

Перед работой:

1. Выполни repository-first precheck.
2. Зафиксируй branch, HEAD, upstream и worktree.
3. Подтверди правильный remote/repository.
4. Подтверди, что `82406ce` входит в ancestry текущего HEAD.
5. Если HEAD продвинулся — изучи новые коммиты и не затирай более свежие решения.
6. Не смешивай пользовательские dirty-worktree изменения с remediation.
7. Не используй `legacy/` как текущий runtime.

При неподтверждённом repository state остановись с `VERDICT C — BLOCKED`.

---

## 2. ОБЯЗАТЕЛЬНЫЕ ВХОДЫ

Прочитай полностью:

- `docs/architecture/platform-command-center-ui-design-ux-contract-step-3.2.md`;
- `docs/prompts/PHASE_3_STEP_3.2_PLATFORM_COMMAND_CENTER_UI_DESIGN_UX_CONTRACT_REPORT.md`;
- `docs/architecture/platform-vs-partner-workspace-context-model-phase3.md`;
- `docs/prompts/PHASE_3_PLATFORM_VS_PARTNER_WORKSPACE_ARCHITECTURE_RECONCILIATION_REPORT.md`;
- `docs/architecture/global-workspace-constructor-phase3.md`;
- approved Step 3.3E implementation/Strict Review artifacts;
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- current RBAC/security architecture and ADRs;
- current Prisma security models;
- role/permission seed/bootstrap logic;
- authentication/session contracts;
- `backend/src/modules/workspace/**`;
- `backend/src/modules/dashboard/**`;
- `backend/src/modules/analytics/**`;
- `frontend/components/Shell.tsx`;
- `frontend/lib/i18n.tsx` or фактический localization file;
- existing frontend RBAC/navigation/workspace hooks.

Не полагайся на перечисленные пути, если фактический repository state иной. Зафиксируй реальные paths.

---

## 3. КАНОНИЧЕСКОЕ РЕШЕНИЕ О ПРАВАХ

Права ролей не должны быть навсегда захардкожены. Система должна иметь предварительно разделённые безопасные defaults, которые уполномоченный Platform Admin сможет изменять.

```text
SYSTEM PERMISSION CATALOG
→ DEFAULT ROLE PERMISSIONS
→ ADMIN-CONFIGURED ROLE PERMISSIONS
→ EFFECTIVE USER PERMISSIONS
→ PAGE / SECTION / WIDGET / ACTION AVAILABILITY
→ ROLE DEFAULT LAYOUT
→ USER LAYOUT
```

Hard rules:

```text
PERMISSION ≠ ROLE DEFAULT ≠ USER LAYOUT
ROLE ≠ BUSINESS CONTEXT
ENTITLEMENT ≠ PERMISSION ≠ CAPABILITY
FRONTEND VISIBILITY ≠ BACKEND AUTHORIZATION
USER LAYOUT CANNOT EXPAND AUTHORITY
```

### 3.1 Permission

Определяет, может ли роль/пользователь получить доступ к page, section, widget, data scope или action.

### 3.2 Role Default

Определяет, что разрешённая роль видит в стандартной композиции при первом входе или после reset-to-role-default.

### 3.3 User Layout

Определяет, как конкретный пользователь расположил разрешённые элементы. User Layout не выдаёт permissions и не восстанавливает отозванный доступ.

---

## 4. BUSINESS CONTEXT BOUNDARY

Текущий scope — только `PLATFORM`.

```text
PLATFORM WORKSPACE ≠ PARTNER WORKSPACE
```

Platform Admin управляет Platform roles/permissions в пределах Platform authority.

Не реализовывать и не проектировать как текущий production scope:

- Partner Admin/Owner role editor;
- Marketplace Basic entitlement enforcement;
- Storefront Pro entitlement enforcement;
- Partner employee membership;
- Partner organization switcher;
- Partner Command Center UI.

Однако remediation должен подтвердить, что будущий Partner scope нельзя открыть назначением Platform permission.

```text
PLATFORM ADMIN CANNOT GRANT PLATFORM DATA TO PARTNER CONTEXT
PARTNER A CANNOT RECEIVE PARTNER B SCOPE
PERMISSION CANNOT BYPASS ENTITLEMENT OR CAPABILITY
```

---

## 5. DEFAULT PLATFORM ROLE MODEL

Repository-first проверь фактический список канонических ролей. Не придумывай роли, которых нет в repo, и не теряй существующие.

Минимально сопоставь, если существуют:

- `ADMIN`;
- `DIRECTOR`;
- `FINANCE`;
- `ANALYST`;
- `SALES_MANAGER`;
- `OPERATOR`;
- `MODERATOR`;
- `MARKETER`;
- `SUPPORT` или фактический эквивалент;
- другие канонические Platform roles.

Создай таблицу:

| Role | Business responsibility | Default pages | Default Command Center sections | Default widgets | Default quick actions | Explicitly excluded | Existing permissions | Required future permissions |
|---|---|---|---|---|---|---|---|---|

Defaults должны быть разумно разделены до любых действий администратора.

### 5.1 Expected intent

Используй как целевую семантику, но сверяй с repository authority:

- `ADMIN`: system/security/users/roles/integrations/operational health; не автоматически unrestricted business-private content.
- `DIRECTOR`: executive, marketplace, operational and financial oversight.
- `FINANCE`: revenue, net revenue, commission, payments, refunds, reconciliation.
- `ANALYST`: broad read-only analytics, comparisons, trends, no administrative mutations.
- `SALES_MANAGER`: orders, bookings, AOV, conversion, funnel, sales trends.
- `OPERATOR`: operational workload and permitted operational actions.
- `MODERATOR`: moderation/onboarding/quality data when backend authority exists; do not substitute unrelated executive KPI.
- `MARKETER`: sessions, acquisition, conversion, campaign/channel analytics when authority exists.
- `SUPPORT`: complaints/disputes/SLA when authority exists.

Если backend authority отсутствует, соответствующий section/widget остаётся `DEFERRED`; роль не должна получать фиктивные данные или произвольный полный executive dashboard как смысловую замену.

---

## 6. COMMAND CENTER ROLE DEFAULT VISUALIZATION

Исправь текущую модель, где одно coarse permission `analytics.read` фактически даёт всем назначенным ролям одинаковые 21 KPI.

Требуется определить:

1. Какие из 21 KPI доступны каждой роли по default policy.
2. Какие widgets входят в Role Default Layout.
3. Какие widgets разрешены роли, но не показаны по умолчанию.
4. Какие widgets полностью запрещены роли.
5. Какие sections скрыты из-за отсутствия authority.
6. Как Admin override меняет available widget catalog.
7. Как изменение permission влияет на уже сохранённые User Layouts.
8. Как required widget (`reconciliation`) ведёт себя для роли без finance authority.

Создай две независимые матрицы.

### 6.1 Access matrix

| Role | Page access | Executive | Operational | Financial | Marketplace | Trends | Customize | Export/Drill-down |
|---|---|---|---|---|---|---|---|---|

### 6.2 Default composition matrix

| Role | Default section order | Default widgets | Optional allowed widgets | Required widgets | Hidden/forbidden widgets | Empty/deferred behavior |
|---|---|---|---|---|---|---|

Не смешивай право видеть widget и его presence в default layout.

---

## 7. ADMIN ROLE/PERMISSION MANAGEMENT CONTRACT

Зафиксируй будущую admin capability, даже если её production UI реализуется отдельным Roadmap step.

Admin должен иметь возможность в пределах собственной authority:

- видеть canonical permission catalog;
- видеть Default Role Permissions;
- изменять role-permission assignments;
- отзывать permissions;
- назначать пользователям роли;
- просматривать effective permissions пользователя;
- видеть источник разрешения;
- возвращать роль к system defaults;
- просматривать audit history;
- видеть affected users перед сохранением;
- подтверждать security-sensitive changes;
- не оставлять систему без минимум одного recovery-capable admin.

Определи:

```text
SYSTEM DEFAULT
→ ADMIN OVERRIDE
→ EFFECTIVE ROLE POLICY
```

Ответь repository-grounded:

1. Существует ли сейчас runtime role-permission persistence?
2. Перечитываются ли permissions из DB на каждый запрос?
3. Есть ли Admin API/UI для управления ими?
4. Есть ли audit log для изменений?
5. Есть ли immutable/system-protected roles?
6. Нужны ли schema/API changes и на каком будущем этапе?
7. Что Step 3.2 может безопасно использовать сейчас без расширения scope?

Не реализовывать Admin Permission UI в этом pass.

---

## 8. GRANULARITY DECISION

Проверь, достаточно ли текущего `analytics.read`.

Сравни варианты:

### Option A — coarse page permission only

```text
analytics.read
```

Плюсы: простота. Минусы: все разрешённые роли получают один data authority.

### Option B — domain/section permissions

Примеры только как namespace candidates, не готовое решение:

```text
dashboard.executive.read
dashboard.operational.read
dashboard.financial.read
dashboard.marketplace.read
```

### Option C — widget permissions

Отдельный permission на каждый widget. Высокая гибкость, но большой administrative burden.

### Required decision

Выбери минимальную модель, которая:

- поддерживает default separation;
- позволяет Admin менять права ролей;
- не создаёт permission explosion;
- не полагается только на frontend filtering;
- не заставляет backend выполнить per-widget requests;
- совместима с Widget Registry и Effective Layout Resolver;
- сохраняет single-request orchestration;
- может безопасно расширяться.

Предпочтение: page permission + domain/section data permissions + registry policy, если repository evidence не доказывает более подходящую модель.

Любые новые permission identifiers в этом pass являются design proposal only. Не добавлять их в production/seed/schema.

---

## 9. EFFECTIVE ACCESS RESOLUTION

Определи детерминированный алгоритм:

```text
1. Resolve identity
2. Resolve PLATFORM context
3. Resolve role memberships
4. Resolve effective role permissions
5. Resolve page access
6. Resolve section/widget/action availability
7. Resolve Role Default Layout
8. Apply User Layout
9. Remove unauthorized/retired widgets
10. Enforce required widgets only within authorized scope
```

Зафиксируй поведение при:

- permission granted;
- permission revoked;
- role changed;
- multiple roles;
- conflicting role defaults;
- saved layout contains newly forbidden widget;
- saved layout does not contain newly required authorized widget;
- system default updated;
- Admin override reset;
- user session open during permission change;
- concurrent layout save and permission change.

Hard rule:

```text
DENY / MISSING AUTHORITY WINS OVER LAYOUT
```

Если current role model additive-only, не придумывай explicit deny без отдельного решения.

---

## 10. MULTIPLE ROLES

Проверь, поддерживает ли repository несколько ролей на пользователя.

Если поддерживает, зафиксируй:

- union/intersection semantics permissions;
- выбор или merge Role Default Layout;
- deterministic priority;
- отсутствие data leakage через более слабую роль;
- admin preview effective access.

Если не поддерживает — явно отметь `NOT APPLICABLE CURRENTLY`, но не проектируй ложную поддержку.

Рекомендуемый безопасный принцип для будущего рассмотрения:

```text
Permissions: authorized union within same PLATFORM context
Default layout: deterministic primary-role default, not arbitrary merge
```

Применять только если согласуется с фактической моделью.

---

## 11. REQUIRED WIDGET SEMANTICS

Текущий design объявляет `reconciliation` единственным required widget.

Проверь это решение.

Ответь:

- required для всех ролей или только для authorized finance roles?
- может ли `MODERATOR` или `MARKETER` быть обязан видеть reconciliation без finance authority?
- required означает non-removable, но не permission-bypassing?
- как registry выражает conditional required?

Hard rule:

```text
REQUIRED WIDGET CANNOT CREATE AUTHORITY
```

Если current registry не поддерживает conditional required, зафиксируй gap и безопасную Step 3.2 implementation boundary.

---

## 12. REPORTING TIMEZONE REMEDIATION

Текущий design предлагает UTC fallback и пользовательский выбор arbitrary IANA timezone, влияющий на reporting boundaries.

Это необходимо исправить.

Hard rule:

```text
BUSINESS REPORTING TIMEZONE IS AUTHORITATIVE
USER DISPLAY TIMEZONE MUST NOT SILENTLY CHANGE KPI AUTHORITY
```

Определи безопасный Step 3.2 v1 contract:

- если company reporting timezone authority существует — использовать её;
- если её нет — использовать один явный fixed fallback (вероятно UTC) для всех;
- не разрешать произвольной user timezone менять business period calculations;
- display timezone может быть отдельным presentation concern только при явной семантике;
- UI должен показывать applied reporting timezone;
- будущая company timezone setting должна иметь отдельную authority/audit policy.

Удали или исправь решение о session-level arbitrary reporting timezone selector, если repository authority отсутствует.

---

## 13. DRAG / REORDER / RESIZE REMEDIATION

Текущий design выбирает `@dnd-kit/core`, но заявляет drag/reorder/resize шире, чем доказанная библиотечная поддержка.

Repository-first определи Step 3.2 v1 scope:

- reorder only;
- drag between grid positions;
- keyboard-accessible sorting;
- resize: implemented, deferred или fixed-size registry variants;
- required packages (`@dnd-kit/core`, `@dnd-kit/sortable`, utilities или иной justified set);
- responsive editing restrictions;
- mobile edit-mode behavior;
- persistence format compatibility.

Не обещай resize без технического и persistence contract.

Предпочтение для v1 при отсутствии foundation: доступный reorder + hide/show + reset; resize deferred или строго ограничен registry-supported sizes.

---

## 14. ARTIFACT CONSISTENCY FIXES

Исправь в design/report:

1. `Final SHA`/commit/push/upstream statuses — использовать честную provenance-модель без невозможной самоссылки.
2. Устранить `PENDING`, если действие уже завершено, либо объяснить pre-commit/final commit distinction.
3. Исправить `2 GAP sections` на фактические `4 deferred sections`, если repository confirms.
4. Исправить localization path `i110n.tsx` на фактический путь.
5. Согласовать `21 KPIs` и `19 widgets` через явную mapping explanation.
6. Устранить противоречия в route/API prefix, если найдены.
7. Не менять фактическую approved backend authority.

---

## 15. DEFERRED ROLE SECTIONS

Partner Management, Moderation, Support/Risk и Employees/Operations не имеют полной backend authority.

Design remediation должен определить для соответствующих ролей:

- не показывать fake KPI;
- не подменять профильный dashboard executive widgets без осознанного Role Default;
- показывать доступные operational links/empty explanation только если UX это требует;
- не создавать dead cards;
- фиксировать будущий authority owner и Roadmap dependency;
- не блокировать Platform Step 3.2 для ролей, которым доступны реальные sections.

---

## 16. SECURITY NON-NEGOTIABLES

```text
PLATFORM DATA ≠ PARTNER DATA
PARTNER A ≠ PARTNER B
PERMISSION DOES NOT BYPASS CONTEXT
PERMISSION DOES NOT BYPASS ENTITLEMENT
LAYOUT DOES NOT BYPASS PERMISSION
REQUIRED WIDGET DOES NOT BYPASS PERMISSION
ADMIN ACTIONS ARE AUDITED
```

Admin не получает неограниченный доступ к Customer ↔ Partner private communications через обычное role assignment. Privileged/break-glass access остаётся отдельным будущим security contract.

---

## 17. DELIVERABLES

Обнови существующие design artifacts, сохраняя их identity/paths:

1. `docs/architecture/platform-command-center-ui-design-ux-contract-step-3.2.md`
2. `docs/prompts/PHASE_3_STEP_3.2_PLATFORM_COMMAND_CENTER_UI_DESIGN_UX_CONTRACT_REPORT.md`

Допустим отдельный remediation report по repository convention, например:

```text
docs/prompts/PHASE_3_STEP_3.2_PLATFORM_COMMAND_CENTER_UI_DESIGN_REMEDIATION_ROLE_ACCESS_REPORT.md
```

Обязательные новые/обновлённые разделы:

- Default Role Permissions;
- Admin Role/Permission Management Contract;
- Role Access Matrix;
- Role Default Composition Matrix;
- Permission granularity decision;
- Effective Access Resolver;
- multiple-role decision;
- conditional required widget semantics;
- timezone authority;
- DnD/reorder/resize scope;
- artifact corrections;
- implementation impact;
- updated acceptance criteria;
- verdict and NEXT.

Roadmap менять только минимально и только если текущая структура требует status sync.

---

## 18. NON-GOALS / NEGATIVE CHECKS

В этом pass обязательно:

| Check | Required |
|---|---:|
| Production frontend changes | 0 |
| Production backend changes | 0 |
| Schema changes | 0 |
| Migrations | 0 |
| New permissions implemented | 0 |
| Role management UI implemented | 0 |
| Role assignment API implemented | 0 |
| Partner workspace implemented | 0 |
| Organization switcher implemented | 0 |
| Second constructor | 0 |
| Second analytics engine | 0 |
| Step 2.17B changes | 0 |
| Frozen targets changed | 0 |
| Release/deploy | 0 |
| Auto-start implementation | 0 |

---

## 19. VERIFICATION

Минимум:

```bash
git diff --check
git status --short --branch
```

Также зафиксируй:

- repository/branch/base SHA/final SHA;
- files changed;
- production code change count;
- schema/migration count;
- artifact consistency;
- frontend/backend tests как baseline evidence, если они не требуют code changes;
- skipped checks с причиной.

---

## 20. ACCEPTANCE CRITERIA

`VERDICT A — READY FOR IMPLEMENTATION` разрешён только если:

- фактические roles/permissions изучены;
- Default Role Permissions определены;
- admin override model определена;
- Permission / Role Default / User Layout разделены;
- role access matrix завершена;
- role default composition matrix завершена;
- coarse `analytics.read` проблема разрешена design-решением;
- future permission identifiers не реализованы в текущем pass;
- effective access algorithm детерминирован;
- required widget не расширяет authority;
- timezone authority безопасна;
- drag/reorder/resize scope реалистичен;
- 4 deferred sections отражены единообразно;
- localization path и provenance исправлены;
- Platform/Partner isolation сохранена;
- implementation waves обновлены;
- production code/schema/migrations не менялись;
- artifacts committed and pushed;
- HEAD == upstream;
- worktree clean.

---

## 21. VERDICT MODEL

### VERDICT A — READY FOR IMPLEMENTATION

Все remediation findings закрыты, implementation scope однозначен.

### VERDICT B — DESIGN REMEDIATION INCOMPLETE

Остались неблокирующие или исправимые design gaps. Implementation не запускать.

### VERDICT C — BLOCKED

Repository/authority/security contradiction требует отдельного решения.

---

## 22. COMMIT / PUSH

После успешной remediation:

1. Проверь diff.
2. Подтверди docs-only scope.
3. Создай отдельный commit.
4. Push согласно repository workflow.
5. Зафиксируй final commit SHA.
6. Подтверди HEAD == upstream и clean worktree.

Рекомендуемый commit message:

```text
docs(step-3.2): remediate role access and default visualization contract
```

---

## 23. ФОРМАТ ФИНАЛЬНОГО ОТВЕТА

Ответить на русском языке:

1. Что исправлено.
2. Repository state.
3. Actual role/permission model.
4. Default Role Permissions.
5. Admin override model.
6. Role access matrix summary.
7. Role Default Layout summary.
8. Permission granularity decision.
9. Effective access algorithm.
10. Timezone decision.
11. DnD/reorder/resize decision.
12. Artifact corrections.
13. Verification and negative checks.
14. Open gaps/blockers.
15. VERDICT.
16. NEXT.

При `VERDICT A`:

```text
NEXT: PHASE 3 — STEP 3.2 — PLATFORM COMMAND CENTER UI — IMPLEMENTATION
```

Implementation в этом pass не запускать.

---

## 24. FINAL EXECUTION COMMAND

Выполни полный repository-first **Phase 3 — Step 3.2 — Platform Command Center UI — Design Remediation — Role Access & Default Visualization** pass.

Не подменяй Admin-managed permissions hardcoded role checks, не смешивай Permission с Role Default или User Layout, не расширяй Partner scope, не меняй production code/schema и не запускай implementation автоматически.
