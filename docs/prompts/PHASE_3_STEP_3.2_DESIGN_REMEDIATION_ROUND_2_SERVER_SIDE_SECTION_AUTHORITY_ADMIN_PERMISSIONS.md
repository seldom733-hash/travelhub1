# PHASE 3 — STEP 3.2 — DESIGN REMEDIATION ROUND 2 — SERVER-SIDE SECTION AUTHORITY & ADMIN-MANAGED ROLE PERMISSIONS

> **ЯЗЫК:** все ответы исполнителя пользователю, промежуточные статусы, пояснения и итоговый summary должны быть на русском языке. Английский допустим только для кода, команд, путей, API routes, identifiers и канонических технических статусов.

---

## 0. РОЛЬ И РЕЖИМ РАБОТЫ

Ты работаешь как **Principal Security Architect + Staff Backend Architect + Enterprise RBAC Architect + Staff Frontend Architect + Repository Auditor** проекта TravelHub.

Выполни ограниченный **DESIGN REMEDIATION ROUND 2 ONLY**.

Текущий проход должен устранить оставшееся security-противоречие Step 3.2:

```text
ROLE DEFAULT LAYOUT ≠ DATA AUTHORITY
FRONTEND-HIDDEN WIDGET ≠ SERVER-SIDE ACCESS DENIAL
```

Нельзя переходить к production implementation, пока серверная authority и будущая Admin-managed permission model не определены однозначно.

---

## 1. РЕПОЗИТОРИЙ И BASELINE

```text
Repository: https://github.com/seldom733-hash/travelhub1
Branch: master
Required ancestor: 79863762427c9df38c58c74df28961aba658a675
```

Перед началом:

1. Выполни `git status --short --branch`.
2. Зафиксируй фактические `HEAD`, upstream и remote.
3. Подтверди, что работа ведётся в `seldom733-hash/travelhub1`.
4. Подтверди, что `7986376` является ancestor текущего HEAD.
5. Если HEAD продвинулся — изучи новые коммиты и reconcile их до проектирования.
6. Не уничтожай и не смешивай пользовательские dirty-worktree изменения.
7. Не используй `legacy/` как current runtime.

Если repository/ancestry не подтверждается — `VERDICT C — BLOCKED`.

---

## 2. ОБЯЗАТЕЛЬНЫЕ ВХОДЫ

Прочитай полностью:

- `docs/architecture/platform-command-center-ui-design-ux-contract-step-3.2.md`;
- Step 3.2 Design & UX Contract report;
- Step 3.2 Design Remediation Addendum от commit `7986376`;
- Step 3.2 Design Remediation Role Access report;
- Platform vs Partner Workspace architecture/reconciliation;
- Global Workspace Constructor Step 3.3E architecture, implementation and Strict Review;
- Step 3.1 Dashboard Backend design/implementation/Strict Review;
- Step 3.3 Analytics Foundation design/implementation/remediation/approval;
- `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md`;
- current Security/RBAC ADRs and contracts;
- `backend/prisma/schema.prisma` security models;
- all role/permission constants and seed/bootstrap logic;
- guards/decorators/effective permission resolution;
- session/user endpoints and permission payloads;
- `backend/src/modules/dashboard/**`;
- `backend/src/modules/analytics/**`;
- `backend/src/modules/workspace/**`;
- current audit log authority;
- frontend Shell/navigation/RBAC/workspace hooks.

Создай repository-first mapping:

| Concern | Current code/model | Current authority | Gap | Reuse / Extend / New | Future target files | Risk |
|---|---|---|---|---|---|---|

---

## 3. КРИТИЧЕСКОЕ ПРОТИВОРЕЧИЕ

Сейчас `analytics.read` является единственным backend gate для:

```text
GET /api/v1/dashboard/command-center
GET /api/v1/dashboard/command-center/trends
```

Роли с `analytics.read` получают один и тот же aggregate response, включая Executive, Operational, Financial и Marketplace data.

При этом remediation commit `7986376` предлагает скрывать часть widgets у `MARKETER` через Role Default Layout.

Это только UX differentiation, а не security boundary. Пользователь с `analytics.read` может получить скрытые response fields напрямую через API.

Hard rule:

```text
IF DATA MUST BE RESTRICTED BY ROLE,
THE SERVER MUST ENFORCE THE RESTRICTION.
```

Нельзя выдавать `VERDICT A`, оставив frontend-only hiding как замену authority.

---

## 4. КАНОНИЧЕСКАЯ МОДЕЛЬ

Система должна поддерживать следующую иерархию:

```text
SYSTEM PERMISSION CATALOG
→ SYSTEM DEFAULT ROLE PERMISSIONS
→ AUDITED ADMIN ROLE OVERRIDES
→ EFFECTIVE ROLE PERMISSIONS
→ SERVER-SIDE PAGE / SECTION / ACTION AUTHORITY
→ SERVER-FILTERED DATA CONTRACT
→ ROLE DEFAULT LAYOUT
→ USER LAYOUT
```

Разделить:

### 4.1 Permission

Серверное право получить страницу, секцию, data class или выполнить action.

### 4.2 Role Default Layout

Стандартная композиция разрешённых widgets для роли.

### 4.3 User Layout

Персональное расположение только разрешённых widgets.

```text
PERMISSION ≠ DEFAULT VISIBILITY ≠ PERSONAL PLACEMENT
```

---

## 5. PLATFORM / PARTNER SECURITY BOUNDARY

Текущий design scope — `PLATFORM`.

```text
PLATFORM WORKSPACE ≠ PARTNER WORKSPACE
PARTNER A ≠ PARTNER B
```

Ни System Default, ни Admin override, ни layout не могут:

- выдать Platform data роли в Partner context;
- выдать Partner A data Partner B;
- обойти tenant/partner scope;
- обойти entitlement/capability;
- превратить Platform permission в Partner permission;
- открыть private Customer ↔ Partner communications обычным Platform permission.

Platform Admin управляет только разрешёнными Platform role policies в этом архитектурном контексте.

Partner Admin/Owner permission management остаётся отдельным будущим scope.

---

## 6. PERMISSION GRANULARITY — REQUIRED DECISION

Повторно оцени и выбери минимальную безопасную гранулярность.

### 6.1 Page gate

```text
analytics.read
```

Может остаться правом входа на Command Center, но не обязано давать все sections.

### 6.2 Section/data authority candidates

Используй repository naming conventions. Следующие identifiers — только semantic examples:

```text
dashboard.executive.read
dashboard.operational.read
dashboard.financial.read
dashboard.marketplace.read
```

Рассмотри возможность переиспользовать существующие domain permissions, если их semantics точно совпадают, например finance/sales/marketing read. Нельзя переиспользовать permission только из-за похожего названия.

### 6.3 Action authority

Отдели read от:

- customize layout;
- export;
- drill-down;
- future role management;
- future permission management.

### 6.4 Avoid permission explosion

Не создавай отдельный permission на каждый KPI/widget без доказанной необходимости.

Предпочтительный target:

```text
PAGE GATE
+ SECTION/DATA AUTHORITY
+ ACTION AUTHORITY WHERE NEEDED
```

### 6.5 Required output

Создай таблицу:

| Permission | Scope | Data exposed | Default roles | Admin-overridable? | Protected/system? | Backend enforcement point | Frontend use |
|---|---|---|---|---|---|---|---|

Новые permission codes в этом pass являются design only. Не добавлять их в production code/schema/seed.

---

## 7. SAFE DEFAULT ROLE PERMISSIONS

Repository-first используй фактические canonical roles.

Минимально зафиксируй defaults для существующих Platform roles:

- `ADMIN`;
- `DIRECTOR`;
- `FINANCE`;
- `MARKETER`;
- `ANALYST`;
- `MODERATOR`;
- `SALES_MANAGER`;
- `OPERATOR`.

Создай матрицу:

| Role | Page gate | Executive | Operational | Financial | Marketplace | Customize | Export | Default landing/work center | Notes |
|---|---|---|---|---|---|---|---|---|---|

Целевая семантика:

- `ADMIN`: все Platform sections в рамках ordinary admin authority; private/break-glass data отдельно.
- `DIRECTOR`: широкий executive/operational/financial/marketplace oversight.
- `ANALYST`: согласованный read-only analytical scope; явно решить Financial access.
- `MARKETER`: Marketplace/acquisition/conversion scope; Financial section по умолчанию запрещена, если нет отдельной authority.
- `FINANCE`: финансовый work center и financial authority; отдельно решить, нужен ли доступ к Platform Command Center page и Financial section.
- `SALES_MANAGER`: sales/operational sections только при серверной authority.
- `MODERATOR`: moderation authority, но не fake executive replacement.
- `OPERATOR`: operational authority, но не broad analytics по умолчанию.

Не выдавай рольным defaults несуществующие backend data. Такие sections остаются `DEFERRED`.

---

## 8. ADMIN-MANAGED ROLE PERMISSIONS

Ранее согласовано:

1. При первоначальном развёртывании права ролей безопасно разделены по умолчанию.
2. Уполномоченный Admin может изменять role-permission assignments.
3. Изменения должны быть серверными, сохраняемыми и аудируемыми.

Спроектируй target model:

```text
SYSTEM DEFAULT
→ ADMIN OVERRIDE
→ EFFECTIVE ROLE POLICY
```

### 8.1 Repository-first questions

Ответь:

- current `RolePermission` rows seeded или являются runtime authority?
- startup seed добавляет отсутствующие permissions или перезаписывает admin changes?
- как избежать уничтожения Admin overrides после restart/deploy?
- есть ли audit mechanism достаточной authority?
- можно ли изменять system roles?
- нужен ли protected recovery admin?
- как permissions отражаются в active sessions?

### 8.2 Required Admin capabilities

Target Admin должен иметь возможность:

- видеть permission catalog;
- видеть System Default и Effective Policy;
- назначать/отзывать permissions ролям;
- видеть affected users;
- просматривать effective user access;
- сбрасывать overrides к defaults;
- получать предупреждение о security-sensitive change;
- видеть audit trail;
- не удалять последний recovery-capable admin;
- не выдавать право за пределами собственной delegable authority.

### 8.3 Protected boundaries

Определи:

- non-delegable permissions;
- system-protected roles/permissions;
- self-escalation prevention;
- maker-checker/approval need для критических permissions;
- optimistic concurrency/versioning;
- audit fields: actor, target role, before, after, reason, timestamp, correlation/case ID;
- rollback/recovery.

### 8.4 Scope staging

Определи точный Roadmap staging:

- что обязательно реализовать до/вместе со Step 3.2 UI для security correctness;
- что можно отложить до отдельного Admin Permission Management step;
- как v1 работает до появления Admin UI;
- как будущий Admin override подключится без переделки Command Center.

Нельзя оставить Admin management просто словами «future» без target owner/step/dependency.

---

## 9. PERSISTENCE AND SEEDING CONTRACT

Спроектируй безопасную persistence semantics.

Сравни варианты:

### Option A — RolePermission rows are effective state

Seed создаёт только отсутствующие defaults и не восстанавливает удалённые Admin permissions без явного reset.

### Option B — Separate system defaults and overrides

Effective permissions вычисляются из default policy + persisted overrides.

### Option C — Versioned role policy

Role policy хранится как versioned aggregate with audit history.

Выбери repository-compatible подход.

Обязательно определить:

- idempotent bootstrap;
- deploy/restart behavior;
- default changes in new application version;
- admin override precedence;
- reset-to-default;
- migration/backfill;
- transaction boundary;
- concurrent admins;
- audit integrity;
- emergency recovery.

---

## 10. SERVER-SIDE RESPONSE AUTHORITY

Сохрани single-request orchestration, но не выдавай запрещённые sections.

Оцени варианты:

### Option A — server-filtered response

Один endpoint вычисляет authorized sections и возвращает только разрешённые.

### Option B — stable envelope with explicit unavailable sections

Один endpoint возвращает section status без data:

```text
available | forbidden | not_applicable | deferred
```

Нельзя раскрывать sensitive values внутри forbidden section.

### Option C — separate section endpoints

Может усложнить orchestration и создать fan-out. Использовать только при доказанной необходимости.

Предпочтение: один endpoint + server-side section filtering/stable envelope.

### Required design

Определи:

- enforcement layer;
- authorization input;
- response DTO shape;
- omission vs explicit forbidden semantics;
- backward compatibility;
- cache key dimensions;
- logging без sensitive data;
- trends authorization;
- metric allowlist;
- unknown/future section behavior;
- tests.

Hard rule:

```text
NO UNAUTHORIZED SECTION VALUES IN RESPONSE BODY.
```

---

## 11. TRENDS ENDPOINT AUTHORITY

`/command-center/trends` принимает metric.

Нужно определить:

- canonical metric → section mapping;
- authorization before query execution;
- запрет requested metric вне authorized section;
- correct status: 403 vs 404 vs filtered result;
- no metric-name probing leakage;
- allowed metrics returned to frontend;
- server-side allowlist;
- test matrix.

Frontend-hidden trend button не является security enforcement.

---

## 12. WIDGET REGISTRY AUTHORITY

Widget Registry должен отражать server authority, но не заменять её.

Определи target metadata:

```text
requiredPermissions[]
sectionId
defaultForRoles[] or roleDefaults
requiredWithinAuthorizedScope
constructorEnabled
```

Не обязательно использовать эти exact fields — выбери repository-compatible форму.

Hard rules:

- widget catalog фильтруется effective permissions;
- saved unauthorized widget удаляется/игнорируется;
- Role Default не может вернуть forbidden widget;
- User Layout не может вернуть forbidden widget;
- registry required не создаёт authority;
- required applies only within authorized section.

---

## 13. RECONCILIATION WIDGET CONTRADICTION

Commit `7986376` содержит противоречие:

```text
MARKETER → reconciliation hidden
```

и одновременно:

```text
reconciliation required for ALL roles with analytics.read
```

Исправь однозначно:

```text
RECONCILIATION IS REQUIRED
ONLY WHEN FINANCIAL SECTION AUTHORITY IS PRESENT.
```

Для роли без Financial authority:

- widget не входит в catalog;
- widget не возвращается через layout;
- Financial data не возвращается server-side;
- required rule не применяется.

Для authorized роли:

- widget non-removable, если это подтверждённая product requirement;
- либо обоснуй иной статус.

---

## 14. EFFECTIVE ACCESS ALGORITHM

Спроектируй один детерминированный algorithm:

```text
1. Resolve authenticated identity
2. Resolve PLATFORM context
3. Resolve current role
4. Load System Defaults
5. Apply persisted Admin Overrides
6. Produce Effective Role Permissions
7. Authorize page
8. Authorize sections/data classes
9. Filter summary/trends server-side
10. Build authorized widget catalog
11. Resolve Role Default Layout
12. Apply User Layout
13. Remove unauthorized/retired widgets
14. Restore required-authorized widgets
```

Определи behavior при:

- Admin grants permission;
- Admin revokes permission;
- role changes;
- active session remains open;
- layout contains revoked widget;
- concurrent permission and layout change;
- permission service failure;
- seed/restart;
- new permission introduced by deploy;
- override reset.

```text
MISSING AUTHORITY WINS OVER DEFAULT AND LAYOUT.
```

---

## 15. SESSION AND CACHE INVALIDATION

Если permissions перечитываются на каждый backend request, подтверди это evidence.

Определи:

- frontend current-user permission refresh;
- nav/widget catalog invalidation;
- server cache invalidation;
- open page after revoke;
- in-flight request after revoke;
- logout/user switch cleanup;
- query/cache key must include identity/context/permission-policy version where relevant.

Admin revoke должен вступать в силу серверно независимо от stale frontend UI.

---

## 16. ROLE DEFAULT VISUALIZATION AFTER AUTHORITY

После серверной фильтрации создай окончательные матрицы.

### 16.1 Server authority matrix

| Role | Page | Executive | Operational | Financial | Marketplace | Trends by section |
|---|---|---|---|---|---|---|

### 16.2 Role Default Layout matrix

| Role | Default sections | Default widgets | Optional authorized widgets | Required-authorized widgets | Forbidden widgets |
|---|---|---|---|---|---|

### 16.3 Admin override effect

| Override | Server response change | Widget catalog change | Existing layout change | Audit event |
|---|---|---|---|---|

Это три разные матрицы; не объединяй authority и layout.

---

## 17. DEFERRED SECTIONS

Текущие gaps:

- Partner Management;
- Moderation;
- Support/Risk;
- Employees/Operations.

Если backend authority/data отсутствуют:

- не создавать fake KPI;
- не выдавать `0` как будто metric существует;
- не раскрывать unavailable section;
- не заменять профильный work center executive dashboard;
- определить future data owner and Roadmap dependency;
- не блокировать реализацию реально поддержанных sections.

Permission на section без data authority не должен создавать data.

---

## 18. ADMIN UI — TARGET UX CONTRACT

Без production implementation создай компактный target UX contract будущего Admin interface:

- Roles list;
- permission groups;
- System Default vs Override vs Effective columns;
- search/filter;
- changed permissions diff;
- affected users count;
- reason field;
- confirmation for sensitive grants/revokes;
- audit history;
- reset-to-default;
- concurrency conflict;
- recovery admin protection;
- read-only handling для protected permissions;
- Platform context label.

Admin UI не должен управлять Partner entitlements или Partner employee permissions в этом scope.

---

## 19. IMPLEMENTATION STAGING

Design remediation должен разбить будущую реализацию минимум на:

### Stage A — security prerequisite

- permission catalog additions;
- safe defaults;
- server-side section authority;
- trends metric authority;
- registry permission metadata;
- tests;
- migration/seed strategy if required.

### Stage B — Platform Command Center UI

- route/shell;
- summary/trends;
- authorized section rendering;
- Role Default Layout;
- User Layout;
- period controls;
- charts;
- DnD reorder;
- responsive/a11y/i18n;
- tests.

### Stage C — Admin Permission Management

- persistence/override API;
- audit;
- Admin UI;
- concurrency/recovery;
- tests;
- separate strict review.

Определи, можно ли Stage C отложить, сохранив архитектуру и не вводя hardcoded dead-end. Stage A нельзя откладывать, если иначе frontend получает запрещённые data.

---

## 20. REQUIRED IMPLEMENTATION IMPACT MAP

Создай таблицу:

| Future change | Backend | Frontend | Prisma/migration | Seed/bootstrap | Tests | Step/Stage |
|---|---|---|---|---|---|---|

Укажи точные repository paths после анализа.

Не вносить изменения в этом design pass.

---

## 21. NON-GOALS / NEGATIVE CHECKS

Текущий pass docs-only:

| Check | Required |
|---|---:|
| Production backend changes | 0 |
| Production frontend changes | 0 |
| Schema changes | 0 |
| Migrations | 0 |
| Permission seed changes | 0 |
| New API endpoints | 0 |
| Admin UI implementation | 0 |
| Command Center implementation | 0 |
| Partner workspace implementation | 0 |
| Second analytics engine | 0 |
| Second workspace constructor | 0 |
| Step 2.17B changes | 0 |
| Frozen targets changed | 0 |
| Release/deploy | 0 |
| Auto-start next step | 0 |

---

## 22. DELIVERABLES

Создай по repository convention:

### A. Architecture addendum

Рекомендуемый путь:

```text
docs/architecture/platform-command-center-server-side-section-authority-admin-role-permissions-step-3.2.md
```

### B. Remediation Round 2 report

```text
docs/prompts/PHASE_3_STEP_3.2_DESIGN_REMEDIATION_ROUND_2_SERVER_SIDE_SECTION_AUTHORITY_ADMIN_PERMISSIONS_REPORT.md
```

### C. Existing artifact correction

Исправь противоречащие пункты в previous Step 3.2 design/remediation artifacts либо добавь чёткую supersession table. Не оставляй два одновременно канонических противоположных правила.

### D. Roadmap sync

Минимально обнови Roadmap только если нужен новый security prerequisite или отдельный Admin Permission Management step. Не переписывай историю.

---

## 23. ACCEPTANCE CRITERIA

`VERDICT A — READY FOR SECURITY PREREQUISITE IMPLEMENTATION` возможен только если:

- frontend-only hiding признан недостаточным;
- section/data permissions определены;
- safe default role permissions определены;
- Admin override target model определена;
- persistence/seed semantics определены;
- startup не должен уничтожать overrides;
- server-side response filtering contract определён;
- trends metric authority определена;
- registry requiredPermissions design определён;
- reconciliation contradiction закрыто;
- Role Default и User Layout отделены от authority;
- session/cache invalidation определены;
- Platform/Partner isolation сохранена;
- implementation staging A/B/C определён;
- future target files mapped;
- предыдущие противоречивые artifacts corrected/superseded;
- production code/schema/migrations не менялись;
- docs committed and pushed;
- HEAD == upstream;
- worktree clean.

Не выдавать обычный `READY FOR UI IMPLEMENTATION`, если Stage A security prerequisite ещё не реализован.

---

## 24. VERDICT MODEL

### VERDICT A — READY FOR SECURITY PREREQUISITE IMPLEMENTATION

Architecture однозначна; следующим должен быть отдельный server-side security prerequisite implementation pass.

### VERDICT B — DESIGN REMEDIATION INCOMPLETE

Есть исправимые design gaps. Никакой implementation не запускать.

### VERDICT C — BLOCKED

Repository/security authority conflict требует отдельного решения.

---

## 25. NEXT RULE

При `VERDICT A` следующий этап должен определяться честно:

```text
NEXT: PHASE 3 — STEP 3.2 — SERVER-SIDE SECTION AUTHORITY — SECURITY PREREQUISITE IMPLEMENTATION
```

Только после его отдельного implementation + Strict Review:

```text
PHASE 3 — STEP 3.2 — PLATFORM COMMAND CENTER UI — IMPLEMENTATION
```

Admin Permission Management UI может быть отдельным Stage C, если Stage A создаёт совместимую persistence/authority foundation и Roadmap фиксирует обязательный future step.

---

## 26. VERIFICATION

Минимум:

```bash
git diff --check
git status --short --branch
```

Зафиксируй:

- repo/branch/base SHA/final SHA;
- files changed;
- docs-only proof;
- production code count = 0;
- schema/migrations/seed count = 0;
- artifact consistency;
- skipped checks с причиной;
- final upstream/worktree state.

---

## 27. COMMIT / PUSH

После успешного design pass:

1. Проверь diff и docs-only scope.
2. Commit отдельным осмысленным коммитом.
3. Push согласно repository workflow.
4. Зафиксируй final SHA.
5. Подтверди `HEAD == upstream` и clean worktree.

Рекомендуемый commit message:

```text
docs(step-3.2): design server-side section authority and admin role permissions
```

Не выполнять release/deploy.

---

## 28. ФОРМАТ ФИНАЛЬНОГО ОТВЕТА

Ответить на русском языке:

1. Что проверено.
2. Repository state.
3. Critical contradiction disposition.
4. Permission granularity decision.
5. Safe default role matrix.
6. Admin override model.
7. Persistence/seeding decision.
8. Server response authority contract.
9. Trends authority.
10. Widget Registry authority.
11. Reconciliation required rule.
12. Effective access algorithm.
13. Session/cache invalidation.
14. Implementation staging.
15. Artifacts changed.
16. Verification/negative checks.
17. Open gaps/blockers.
18. VERDICT.
19. NEXT.

---

## 29. FINAL EXECUTION COMMAND

Выполни полный repository-first **Phase 3 — Step 3.2 — Design Remediation Round 2 — Server-Side Section Authority & Admin-Managed Role Permissions** pass.

Не подменяй server authorization Role Default Layout, не скрывай доступ только во frontend, не оставляй required-widget противоречие, не смешивай Platform и Partner, не меняй production code/schema и не запускай implementation автоматически.
