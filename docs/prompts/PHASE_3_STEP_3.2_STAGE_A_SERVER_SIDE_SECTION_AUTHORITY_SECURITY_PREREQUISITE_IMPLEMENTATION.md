# PHASE 3 — STEP 3.2 — STAGE A

## SERVER-SIDE SECTION AUTHORITY — SECURITY PREREQUISITE IMPLEMENTATION

> **ЯЗЫК:** все пояснения, промежуточные отчёты, выводы и финальный ответ должны быть на русском языке. Английский допускается только для кода, команд, путей, SHA, permission codes, API fields и стандартных технических статусов.

---

## 1. ЦЕЛЬ

Реализовать обязательный security prerequisite перед Platform Command Center UI:

1. section-level server authorization для Command Center;
2. безопасный persisted `RolePermission` effective state;
3. прекращение destructive startup synchronization прав;
4. one-time materialization полной RBAC default matrix;
5. безопасную авторизацию trends;
6. section-aware Widget Registry и Workspace Layout;
7. action authorization через `dashboard.customize`;
8. доказательные unit/integration/e2e tests.

После Stage A backend обязан гарантировать:

```text
FRONTEND-HIDDEN WIDGET ≠ SERVER-SIDE ACCESS DENIAL
```

и:

```text
System Defaults ≠ Persisted Effective Permissions
```

Stage A не создаёт полноценный визуальный Command Center. Видимые UI-изменения относятся к Stage B.

---

## 2. REPOSITORY AUTHORITY

Repository:

```text
https://github.com/seldom733-hash/travelhub1
```

Expected branch:

```text
master
```

Expected base SHA:

```text
afaf2e066dd7d3501225f85ed3c8360c38f7441a
```

Перед изменениями обязательно проверить:

```bash
git remote -v
git branch --show-current
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
git status --short
git log -5 --oneline --decorate
```

Начинать реализацию только если:

```text
HEAD == origin/master == afaf2e066dd7d3501225f85ed3c8360c38f7441a
```

В основном checkout ранее обнаружены pre-existing untracked files. Их нельзя удалять, перемещать, перезаписывать или включать в commit.

Предпочтительно создать isolated clean checkout/worktree от актуального `origin/master`. Если это невозможно, работать только с tracked in-scope files и честно сообщать фактический status.

Запрещены:

- `git clean`;
- `git reset --hard`;
- force push;
- изменение или удаление unrelated/untracked files;
- работа поверх неожиданно изменившегося remote;
- предположение, что пути из документов существуют без проверки.

Repository code является authority. При расхождении с prompt сначала доказать расхождение, затем выбрать минимальное совместимое исправление и отразить его в отчёте.

---

## 3. ОБЯЗАТЕЛЬНЫЕ ДОКУМЕНТЫ

Прочитать полностью:

```text
docs/architecture/platform-command-center-rbac-seed-admin-override-persistence-contract-step-3.2.md
docs/prompts/PHASE_3_STEP_3.2_DESIGN_REMEDIATION_ROUND_3_RBAC_SEED_ADMIN_OVERRIDE_PERSISTENCE_REPORT.md
docs/architecture/platform-command-center-server-side-section-authority-admin-role-permissions-step-3.2.md
docs/architecture/platform-command-center-ui-design-remediation-addendum-step-3.2.md
docs/architecture/platform-command-center-ui-design-ux-contract-step-3.2.md
docs/architecture/dashboard-command-center-backend-3.1.md
docs/architecture/global-workspace-constructor-phase3.md
```

Если точный путь отличается — найти реальный документ repository-first.

---

## 4. ДОКАЗАННЫЙ BASELINE

На base SHA подтверждено:

### 4.1 RBAC

- `backend/src/security/permissions.constants.ts` содержит `PERMISSIONS`, `ALL_PERMISSIONS`, `ROLE_PERMISSIONS`;
- `ADMIN: ALL_PERMISSIONS`;
- `backend/src/security/security.service.ts::seedRoles()` при каждом startup выполняет `RolePermission.toAdd` + `toRevoke`;
- текущий startup уничтожает manual grant/revoke;
- отдельного `security.service.spec.ts` сейчас нет;
- `Permission`, `Role`, `RolePermission` находятся в schema `security`;
- `RolePermission` имеет composite PK `(roleId, permissionId)`.

### 4.2 Dashboard

- `backend/src/modules/dashboard/dashboard.controller.ts` уже использует page gate `analytics.read`;
- response types находятся прямо в `dashboard.service.ts`;
- отдельного `dashboard.types.ts` на base SHA нет — не создавать его автоматически без доказанной необходимости;
- `getCommandCenter()` сейчас всегда возвращает четыре секции;
- `getTrends()` сейчас передаёт произвольный metric в Analytics Service;
- unknown metric в текущем `AnalyticsService` возвращает zero buckets вместо ошибки.

### 4.3 Фактически поддерживаемые time-series metrics

`AnalyticsService.getTimeSeries()` поддерживает:

```text
orders
bookings
payments
customers
commissions
```

Важно:

- `commissions` используется во множественном числе;
- `commission` и `revenue` сейчас не являются поддерживаемыми metric keys;
- Stage A не должен объявлять в `availableMetrics` неподдерживаемые metric keys;
- добавление новых аналитических вычислений не входит в security scope.

### 4.4 Workspace

- `WidgetDefinition` имеет page-level `permission`, но не имеет `sectionPermission`;
- все Command Center widgets используют только `analytics.read`;
- `reconciliation` является глобально required;
- `saveLayout()` способен повторно добавить unauthorized required widget после RBAC filtering;
- Workspace Controller не проверяет `dashboard.customize`;
- текущий `roleDefaults` содержит устаревший FINANCE layout и не содержит корректный MARKETER layout;
- в коде фактически зарегистрировано **18** Command Center widgets, не 19;
- расхождение 18/19 и отсутствующий отдельный widget для `storefrontSessions` зафиксировать для Stage B, но не создавать новый UI widget в Stage A.

### 4.5 Migrations

- на base SHA существует 59 Prisma migration directories плюс `migration_lock.toml`;
- schema change для выбранной migration-only модели не требуется;
- migrations применяются в CI через `npx prisma migrate deploy` до запуска application startup hooks.

---

## 5. SCOPE

### In scope

- 5 новых permission codes;
- safe default role assignments;
- migration-only RBAC bootstrap/materialization;
- удаление runtime `RolePermission` synchronization;
- persisted Admin grant/revoke behavior foundation;
- server-filtered summary sections;
- `availableSections` и `availableMetrics`;
- trends allowlist + section authorization;
- Widget Registry `sectionPermission`;
- authorization-aware required widgets;
- `dashboard.customize` enforcement;
- backend tests и migration evidence;
- минимальные comment/type corrections, необходимые для изменённого контракта;
- implementation report.

### Out of scope

- Platform Command Center React UI;
- charts, Recharts, DnD UI;
- установка frontend libraries;
- Partner Command Center;
- Workspace Context/Tenant/Entitlement implementation;
- Admin Permission Management UI/API;
- arbitrary role editor;
- audit/concurrency UI Stage C;
- новые analytics metrics или новые KPI computations;
- новый `storefrontSessions` widget;
- resize widgets;
- изменение согласованной Platform/Partner границы.

---

## 6. PERMISSION CATALOG

Добавить в `backend/src/security/permissions.constants.ts`:

```text
dashboard.executive.read
dashboard.operational.read
dashboard.financial.read
dashboard.marketplace.read
dashboard.customize
```

Добавить ясные descriptions в стиле существующего каталога.

### 6.1 Safe defaults

| Role | `analytics.read` | Executive | Operational | Financial | Marketplace | Customize |
|---|---:|---:|---:|---:|---:|---:|
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DIRECTOR | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ANALYST | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MARKETER | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| FINANCE | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| MODERATOR | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| SALES_MANAGER | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| OPERATOR | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| PARTNER | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| BUYER | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

Не выдавать `dashboard.financial.read` роли FINANCE: Finance Center является отдельным scope, а Platform Command Center закрыт page gate `analytics.read`.

`dashboard.customize` не заменяет section permissions и не расширяет доступ к данным.

---

## 7. CRITICAL MIGRATION CONTRACT

### 7.1 Главная ловушка fresh database

Текущие Role/Permission catalog rows создаются runtime seed после выполнения migrations.

Если новая migration создаст только пять permissions и их links, а Stage A удалит startup `RolePermission.toAdd/toRevoke`, то fresh database потеряет все прежние default role assignments.

Поэтому новая migration должна материализовать **полный snapshot текущей RBAC matrix**, а не только delta из пяти dashboard permissions.

### 7.2 Migration-only target

Создать одну новую Prisma migration directory по реальной naming convention, например:

```text
backend/prisma/migrations/<timestamp>_add_dashboard_section_authority/migration.sql
```

Migration должна безопасно и повторяемо по SQL semantics:

1. обеспечить наличие всех канонических `Role` rows, необходимых полной matrix;
2. обеспечить наличие полного `Permission` catalog snapshot, соответствующего текущему `PERMISSIONS`;
3. обеспечить наличие полного default `RolePermission` snapshot, соответствующего текущему `ROLE_PERMISSIONS`, включая пять новых permissions;
4. использовать уникальные constraints и `ON CONFLICT DO NOTHING` либо эквивалент;
5. не удалять существующие `RolePermission` rows;
6. не выполнять authoritative reconciliation extras;
7. не добавлять schema table/field при migration-only подходе;
8. быть применимой как к fresh database, так и к существующей базе;
9. не зависеть от application startup, который выполняется после migrations;
10. не использовать ненадёжный `RolePermission.count() === 0`.

### 7.3 IDs and database compatibility

- Проверить реальные PostgreSQL/Prisma conventions репозитория.
- Не предполагать наличие UUID SQL function без проверки версии/extension.
- Все inserted IDs должны быть валидными и конфликтобезопасными.
- Role titles и Permission descriptions должны соответствовать фактическим constants.
- Migration является статическим versioned snapshot; runtime не импортирует TypeScript constants в SQL.

### 7.4 Transition semantics

До Stage A runtime matrix была authoritative, поэтому persistent Admin overrides ещё не являлись поддерживаемым контрактом.

Stage A migration:

- добавляет missing default links один раз;
- сохраняет extra existing grants, поскольку не удаляет rows;
- после применения передаёт authority persisted `RolePermission` rows;
- последующие restarts не меняют assignments.

Не реализовывать `adminDidNotModify` — persisted provenance metadata пока отсутствует.

### 7.5 Fresh DB parity invariant

После применения всей migration history на пустой isolated database:

```text
materialized RolePermission matrix == ROLE_PERMISSIONS snapshot
```

Это должно быть проверено автоматизированным тестом или отдельной deterministic verification command, а не визуальным просмотром SQL.

---

## 8. STARTUP SEED CONTRACT

Изменить `backend/src/security/security.service.ts::seedRoles()`:

### Разрешено на normal startup

- idempotent ensure/upsert Role catalog metadata, если это сохраняется repository convention;
- idempotent create missing Permission catalog rows;
- безопасное обновление не-authoritative metadata, если уже принято существующим contract.

### Запрещено на normal startup

- `RolePermission.toAdd`;
- `RolePermission.toRevoke`;
- insert/delete/upsert role-permission assignments;
- восстановление удалённого default link;
- удаление non-default grant;
- implicit reset to defaults.

После Stage A:

```text
RolePermission rows = persisted effective state
```

Admin revoke/grant implementation остаётся Stage C, но direct DB mutation уже должна переживать `onModuleInit()`.

---

## 9. SERVER-SIDE SUMMARY AUTHORITY

### 9.1 Page gate

Сохранить:

```text
@RequirePermissions("analytics.read")
```

на обоих Dashboard endpoints.

User без `analytics.read` получает 403 до вызова Dashboard Service.

### 9.2 Section keys

Определить закрытый union/constant:

```text
executive
operational
financial
marketplace
```

Сопоставление:

| Section | Permission |
|---|---|
| executive | `dashboard.executive.read` |
| operational | `dashboard.operational.read` |
| financial | `dashboard.financial.read` |
| marketplace | `dashboard.marketplace.read` |

Единый mapping должен использоваться для вычисления доступных секций. Не размножать несогласованные string literals.

### 9.3 Response contract

Адаптировать существующий `CommandCenterResponse` там, где реально находятся types на base SHA.

Целевой shape:

```typescript
{
  period: { ... },
  comparison?: { ... },
  availableSections: Array<"executive" | "operational" | "financial" | "marketplace">,
  availableMetrics: string[],
  sections: {
    executive?: { ... },
    operational?: { ... },
    financial?: { ... },
    marketplace?: { ... }
  },
  attribution?: { ... }
}
```

Rules:

1. Unauthorized section key полностью отсутствует в serialized `sections`.
2. Не возвращать `null`, empty object или masked zero data вместо unauthorized section.
3. `availableSections` имеет deterministic canonical order.
4. `availableMetrics` содержит только реально поддерживаемые и разрешённые metrics.
5. User с `analytics.read`, но без section permissions, получает 200 с:

```json
{
  "availableSections": [],
  "availableMetrics": [],
  "sections": {}
}
```

6. Period/comparison/attribution contract не ломать.
7. Не создавать per-widget API fan-out.

### 9.4 Authorize before optional read-model calls

Минимум:

- `getFinancialReconciliation()` не вызывается без `dashboard.financial.read`;
- `getConversionFunnel()` не вызывается без `dashboard.operational.read`;
- общая Company KPI query может оставаться shared orchestration source, но unauthorized fields не должны сериализоваться;
- ошибки optional source не должны ломать секции, которые этот source не используют, если call не был авторизован и не выполнялся.

---

## 10. TRENDS AUTHORITY

### 10.1 Supported allowlist

Stage A работает только с фактически поддерживаемыми metrics:

| Metric | Section | Permission |
|---|---|---|
| `orders` | executive | `dashboard.executive.read` |
| `bookings` | executive | `dashboard.executive.read` |
| `payments` | financial | `dashboard.financial.read` |
| `customers` | marketplace | `dashboard.marketplace.read` |
| `commissions` | financial | `dashboard.financial.read` |

Не включать `revenue`, `gmv`, `commission` singular или другие неподдерживаемые keys в `availableMetrics`.

### 10.2 Enforcement order

```text
Resolve metric
→ unknown metric: 404
→ resolve required section permission
→ known but unauthorized metric: 403
→ authorized: call AnalyticsService.getTimeSeries()
```

Requirements:

- unknown metric больше не превращается в zero series;
- unauthorized metric не вызывает Analytics Service;
- default metric остаётся `orders`;
- default metric также проходит section authorization;
- explicit granularity behavior сохранить;
- metric mapping должен быть typed/constant и тестируемым.

Использовать существующую repository exception convention (`NotFoundError`, `ForbiddenError` либо доказанно эквивалентную), чтобы HTTP semantics были 404/403 через общий filter.

---

## 11. WIDGET REGISTRY SECTION AUTHORITY

### 11.1 WidgetDefinition

Добавить server-side metadata:

```typescript
sectionPermission: string | null
```

Сохранить существующий `permission` как page-level permission.

Для не-Command-Center widgets использовать `null`, если section-level gate к ним не относится.

### 11.2 Existing 18 Command Center widgets

Назначить mapping:

| Widgets | sectionPermission |
|---|---|
| `gmv`, `revenue`, `net-revenue`, `orders`, `bookings`, `aov`, `conversion` | `dashboard.executive.read` |
| `funnel` | `dashboard.operational.read` |
| `commission`, `reconciliation`, `payments`, `net-payments` | `dashboard.financial.read` |
| `sessions`, `partners`, `customers` | `dashboard.marketplace.read` |
| `revenue-trend`, `orders-trend`, `bookings-trend` | `dashboard.executive.read` |

Не добавлять 19-й widget в Stage A. Зафиксировать code/docs count discrepancy для Stage B.

### 11.3 Filtering

Widget доступен только если выполнены оба условия:

```text
page permission satisfied
AND sectionPermission satisfied (если sectionPermission != null)
```

Применить это правило к:

- effective layout;
- available widgets;
- parsing/sanitization saved layout;
- save layout;
- reset layout;
- required widget restoration.

Unauthorized saved widget удаляется из effective result и не сохраняется повторно.

---

## 12. CONDITIONAL REQUIRED `reconciliation`

`reconciliation` required только внутри Financial authority.

Обязательное правило:

```text
if user has dashboard.financial.read:
    reconciliation is required and non-removable
else:
    reconciliation is absent and must never be restored/persisted
```

Исправить текущий опасный порядок `saveLayout()`:

```text
RBAC filter
→ unconditional required restoration
```

Required restoration должна получать authorized widget set/user permissions и восстанавливать только authorized required widgets.

Обновить существующие Workspace tests, которые сейчас ожидают, что `reconciliation` восстанавливается даже для пользователя без permissions. После Stage A это ожидание должно быть удалено как security-invalid.

---

## 13. WORKSPACE PAGE AND ACTION GATES

Для `pageId === "command-center"` сервер обязан применять:

| Endpoint | Required permissions |
|---|---|
| `GET /api/v1/workspaces/command-center` | `analytics.read` |
| `GET /api/v1/workspaces/command-center/widgets` | `analytics.read` |
| `PUT /api/v1/workspaces/command-center/layout` | `analytics.read` + `dashboard.customize` |
| `DELETE /api/v1/workspaces/command-center/layout` | `analytics.read` + `dashboard.customize` |

Использовать существующий `PermissionResolver`/`@RequirePermissions` либо repository-consistent service policy, не ломая другие workspace pages.

Для non-command-center pages нельзя случайно потребовать dashboard permissions.

Defense in depth допускается, но не создавать две расходящиеся authority matrices.

### 13.1 Customize semantics

- `dashboard.customize` разрешает только layout save/reset;
- оно не выдаёт page/section read access;
- отсутствие customize permission не мешает читать authorized effective layout;
- direct PUT/DELETE без customize permission получает 403;
- frontend hiding кнопки в Stage B не заменяет server denial.

---

## 14. ROLE DEFAULT LAYOUT CONSISTENCY

`Permission`, `Role Default` и `User Layout` остаются разными слоями.

Минимально исправить `PAGE_REGISTRY.command-center.roleDefaults`:

- удалить stale FINANCE Command Center role default;
- сохранить DIRECTOR full-section default composition;
- обеспечить ANALYST согласованный analytics-focused default в пределах четырёх разрешённых секций;
- добавить MARKETER default только из Executive + Marketplace widgets;
- не помещать Operational/Financial widgets в MARKETER default;
- ADMIN использует system default + полный authorized catalog;
- role default не может расширить section authority;
- user layout не может расширить section authority.

MARKETER default минимум:

```text
gmv
revenue
net-revenue
orders
bookings
aov
conversion
sessions
partners
customers
```

Если ранее согласованный role default содержит trend widgets, они остаются optional/default только внутри authorized Executive section. Не использовать role defaults как security mechanism.

---

## 15. PLATFORM / PARTNER ISOLATION

- Stage A реализует только Platform Command Center.
- Не добавлять Partner navigation, tenant switcher или Partner Command Center.
- PARTNER/BUYER не получают `analytics.read` или `dashboard.*` defaults.
- Не смешивать section permissions с future Partner entitlements.
- Existing partner isolation tests не ослаблять.

---

## 16. REQUIRED FILE MAP

Ожидаемые изменения после repository verification:

### Production

```text
backend/src/security/permissions.constants.ts
backend/src/security/security.service.ts
backend/src/modules/dashboard/dashboard.service.ts
backend/src/modules/workspace/workspace.types.ts
backend/src/modules/workspace/workspace.service.ts
backend/src/modules/workspace/workspace.controller.ts
```

`dashboard.controller.ts` изменять только если требуется comment/type enforcement; page gate уже существует.

### Migration

```text
backend/prisma/migrations/<timestamp>_add_dashboard_section_authority/migration.sql
```

### Tests

```text
backend/src/modules/dashboard/dashboard.service.spec.ts
backend/src/modules/workspace/workspace.service.spec.ts
backend/test/dashboard-command-center.e2e-spec.ts
backend/src/security/security.service.spec.ts   # новый, если это лучший repository-consistent путь
```

Не использовать несуществующий путь `backend/src/modules/security/security.service.spec.ts`.

### Report

```text
docs/prompts/PHASE_3_STEP_3.2_STAGE_A_SERVER_SIDE_SECTION_AUTHORITY_IMPLEMENTATION_REPORT.md
```

Frontend files не изменять без доказанной compile/runtime необходимости. UI contract adaptation относится к Stage B.

---

## 17. REQUIRED TEST MATRIX

### 17.1 Permission catalog/defaults

1. Все 5 permission codes входят в `PERMISSIONS`/`ALL_PERMISSIONS`.
2. ADMIN, DIRECTOR, ANALYST получают четыре section permissions + customize.
3. MARKETER получает Executive + Marketplace + customize, но не Operational/Financial.
4. Остальные роли не получают dashboard defaults.

### 17.2 Migration and fresh database

5. Все migrations применяются к пустой isolated PostgreSQL database.
6. После migrations существуют canonical Role rows.
7. После migrations полный Permission catalog соответствует constants.
8. После migrations полный default RolePermission snapshot соответствует `ROLE_PERMISSIONS`.
9. Повторный `prisma migrate deploy` не меняет matrix.
10. Migration не удаляет extra existing RolePermission grant.
11. Migration count увеличивается с 59 до 60, drift отсутствует.

### 17.3 Restart persistence

12. `seedRoles()` не вызывает create/delete/upsert `RolePermission`.
13. Удаление default `MARKETER → dashboard.marketplace.read` переживает повторный `onModuleInit()`.
14. Добавление non-default `FINANCE → analytics.read` переживает повторный `onModuleInit()`.
15. Тесты восстанавливают mutated fixtures в `finally` и не загрязняют другие tests.

### 17.4 Summary authority

16. ADMIN/DIRECTOR/ANALYST получают четыре секции.
17. MARKETER получает только Executive + Marketplace.
18. MARKETER response не содержит `operational` и `financial` keys.
19. `availableSections` соответствует response keys и canonical order.
20. User с page permission без section permissions получает empty sections/metrics.
21. Financial read model не вызывается без Financial permission.
22. Funnel read model не вызывается без Operational permission.
23. Existing KPI calculations, period, comparison, attribution сохраняются.

### 17.5 Trends

24. Supported authorized metric возвращает buckets.
25. Default `orders` требует Executive permission.
26. MARKETER может `orders`, `bookings`, `customers`.
27. MARKETER получает 403 для `payments`, `commissions`.
28. Unknown metric получает 404.
29. Unauthorized/unknown metric не вызывает Analytics Service.
30. `availableMetrics` не содержит unsupported `revenue`, `gmv`, `commission` singular.

### 17.6 Workspace security

31. Widget filter проверяет page + section permission.
32. MARKETER layout содержит только Executive/Marketplace widgets.
33. Unauthorized saved Operational/Financial widgets удаляются.
34. `reconciliation` восстанавливается для Financial-authorized user.
35. `reconciliation` не восстанавливается и не сохраняется для MARKETER/empty permissions.
36. FINANCE не получает Command Center layout.
37. Command Center GET без `analytics.read` → 403.
38. Command Center PUT/DELETE без `dashboard.customize` → 403.
39. Наличие `dashboard.customize` без `analytics.read` не открывает page.
40. Non-command-center workspace endpoints не получают accidental dashboard gate.

### 17.7 Regression

41. Existing Dashboard unit tests адаптированы к optional sections.
42. Existing Workspace tests не сохраняют security-invalid expectations.
43. PermissionsGuard fail-closed tests проходят.
44. Existing Partner/Buyer isolation не регрессирует.
45. No per-widget request fan-out.

Нельзя удалять или ослаблять существующие тесты ради зелёного результата.

---

## 18. DATABASE TEST SAFETY

- Использовать только isolated test database.
- Не применять migration к production/shared/user database.
- Test DB naming должен соответствовать существующим safety guards.
- Не использовать `prisma db push` вместо migrations.
- Не редактировать уже применённые migration files.
- После проверки удалить только созданную этим заданием isolated DB, если repository workflow это предусматривает.
- Не удалять неизвестные databases.

Обязательно проверить как минимум:

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status
```

с корректным isolated `DATABASE_URL`.

---

## 19. VALIDATION GATES

Выполнить из реального repository context.

### Backend

```bash
cd backend
npm ci
npx prisma generate
npm run typecheck
npm run build
npm test
npm run test:e2e
```

Если repository environment уже имеет lock-consistent dependencies, повторный `npm ci` допустимо не выполнять только с объяснением.

### Migration

- fresh isolated DB migrate deploy: PASS;
- second migrate deploy: no pending migrations;
- migration status: PASS;
- full RBAC parity verification: PASS;
- migration drift: 0;
- migration count: 60.

### Frontend regression

Даже без frontend changes выполнить:

```bash
cd frontend
npm ci
npx tsc --noEmit
npx vitest run
npm run build
```

### Repository

```bash
git diff --check
git status --short
git diff --stat
git diff --name-status
```

Не скрывать skipped/failed checks.

---

## 20. NEGATIVE CHECKS

Перед Verdict A доказать отсутствие:

- runtime RolePermission `toAdd`/`toRevoke`;
- unconditional required widget restoration;
- `reconciliation` у MARKETER;
- Financial/Operational payload keys у MARKETER;
- unsupported metrics в `availableMetrics`;
- zero-series fallback для unknown Dashboard trend metric;
- Workspace layout mutation без `dashboard.customize`;
- dashboard permissions у PARTNER/BUYER;
- schema change при migration-only модели;
- new Admin Permission Management UI/API;
- Partner Command Center scope;
- accidental 19th widget implementation;
- force push;
- unrelated file changes.

---

## 21. IMPLEMENTATION REPORT

Создать:

```text
docs/prompts/PHASE_3_STEP_3.2_STAGE_A_SERVER_SIDE_SECTION_AUTHORITY_IMPLEMENTATION_REPORT.md
```

Отчёт должен содержать:

1. repository state;
2. список production/test/migration/docs changes;
3. permission matrix;
4. migration strategy и fresh DB proof;
5. startup seed before/after;
6. summary response examples для ADMIN и MARKETER;
7. trends metric mapping;
8. Workspace required/customize enforcement;
9. точные результаты всех tests/builds;
10. migration count/drift;
11. known deferred items: UI, Stage C, 18/19 widget discrepancy;
12. commit/push evidence.

Все объяснения в отчёте — на русском языке.

---

## 22. GIT CONTRACT

1. Не включать pre-existing untracked/unrelated files.
2. Проверить полный diff до commit.
3. Создать один целевой implementation commit, если repository workflow не требует разделения migration/code.
4. Не использовать force push.
5. Перед push выполнить `git fetch origin` и убедиться, что remote не advanced.
6. Push только fast-forward в `origin/master` согласно текущему workflow проекта.
7. После push подтвердить:

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
git ls-remote origin refs/heads/master
git status --porcelain
```

В isolated checkout ожидается полностью clean worktree.

Рекомендуемый commit message:

```text
feat(step-3.2): enforce dashboard section authority server-side
```

---

## 23. ACCEPTANCE CRITERIA

`VERDICT A — STAGE A COMPLETED` допустим только если:

- [ ] repository/base SHA подтверждены;
- [ ] 5 permissions добавлены;
- [ ] safe role defaults точны;
- [ ] full RBAC snapshot materialized migration-only;
- [ ] fresh DB получает все прежние и новые RolePermission defaults;
- [ ] migration не удаляет extra grants;
- [ ] startup больше не изменяет RolePermission;
- [ ] revoke/grant переживают `onModuleInit()`;
- [ ] summary sections фильтруются сервером;
- [ ] unauthorized section keys отсутствуют;
- [ ] `availableSections` корректен;
- [ ] `availableMetrics` корректен;
- [ ] trends unknown = 404;
- [ ] trends unauthorized = 403;
- [ ] unauthorized trend не вызывает analytics query;
- [ ] Widget Registry section-aware;
- [ ] conditional reconciliation работает в load/save/reset;
- [ ] `dashboard.customize` защищает PUT/DELETE;
- [ ] FINANCE/PARTNER/BUYER не получают Platform Command Center;
- [ ] production typecheck/build PASS;
- [ ] unit tests PASS;
- [ ] e2e tests PASS;
- [ ] frontend typecheck/tests/build PASS;
- [ ] fresh migration test PASS;
- [ ] migrations = 60, drift = 0;
- [ ] implementation report создан;
- [ ] diff содержит только in-scope files;
- [ ] commit pushed fast-forward;
- [ ] remote SHA подтверждён;
- [ ] isolated worktree clean.

Если любой security, migration или test gate не закрыт:

```text
VERDICT B — STAGE A NOT COMPLETE
```

Stage B нельзя начинать при Verdict B.

---

## 24. STOP CONDITIONS

Остановиться и сообщить `VERDICT B`, если:

- base/remote изменился неожиданно;
- нет возможности создать безопасную migration для fresh DB;
- migration materializes только пять новых permissions, оставляя fresh DB без старых defaults;
- требуется удалить неизвестные untracked files;
- невозможно доказать grant/revoke persistence;
- unauthorized sections остаются в response;
- required widget расширяет authority;
- tests требуют ослабления существующих assertions;
- используется shared/production DB;
- необходим force push;
- implementation выходит в Partner или Admin UI scope.

---

## 25. ФОРМАТ ФИНАЛЬНОГО ОТВЕТА

```markdown
## PHASE 3 — STEP 3.2 — STAGE A — SERVER-SIDE SECTION AUTHORITY — <VERDICT>

### Repository State
- Repository:
- Branch:
- Base SHA:
- Final SHA:
- HEAD:
- origin/master:
- Worktree:

### Security Implementation
- Permission catalog:
- Safe defaults:
- Startup seed:
- Persisted effective state:
- Summary section filtering:
- Trends authorization:
- Workspace section filtering:
- dashboard.customize:
- Conditional reconciliation:

### Migration Evidence
- New migration:
- Migration count:
- Fresh DB deploy:
- Second deploy:
- Full RBAC parity:
- Extra grant preservation:
- Drift:

### Test Evidence
- Backend typecheck:
- Backend build:
- Backend unit tests:
- Backend e2e tests:
- Frontend typecheck:
- Frontend Vitest:
- Frontend production build:

### Files Changed
- Production:
- Tests:
- Migration:
- Documentation:
- Schema changes:

### Deferred
- Platform Command Center UI: Stage B
- Admin Permission Management: Stage C
- Partner Command Center: deferred
- 18/19 widget discrepancy: Stage B reconciliation

### Commit
`<sha>` — pushed to `origin/master`

### NEXT
`PHASE 3 — STEP 3.2 — PLATFORM COMMAND CENTER UI — IMPLEMENTATION — STAGE B`
```

Финальный ответ разработчика — только на русском языке.

