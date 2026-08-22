# PHASE 3 — STEP 3.2 — DESIGN REMEDIATION ROUND 3

## RBAC SEED VS ADMIN OVERRIDE PERSISTENCE CONTRACT

> **ЯЗЫК:** все пояснения, отчёты, выводы и финальный ответ должны быть на русском языке. Английский допускается только для кода, имён файлов, команд, идентификаторов, permission codes и стандартных технических статусов.

---

## 1. ЦЕЛЬ

Провести узкую repository-first remediation проверку контракта между:

- безопасными правами ролей по умолчанию;
- фактическими строками `RolePermission`;
- startup seed в `SecurityService.seedRoles()`;
- будущими изменениями прав через Admin Permission Management;
- сохранением effective permissions после перезапуска и деплоя.

Этот Round 3 является **docs-only design remediation**. Production code, Prisma schema и migrations в этом раунде не изменять.

Результат Round 3 должен дать однозначный, непротиворечивый и реализуемый контракт для последующего:

```text
PHASE 3 — STEP 3.2 — SERVER-SIDE SECTION AUTHORITY
SECURITY PREREQUISITE IMPLEMENTATION — STAGE A
```

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
ce77af3c90d65b042fa6834146636b92b66f7507
```

Перед анализом обязательно проверить:

1. remote URL;
2. текущую ветку;
3. `HEAD` и upstream;
4. clean/dirty worktree;
5. существование base commit;
6. фактическую историю последних коммитов.

**Не доверять этому промпту, прежним отчётам или комментариям в коде без проверки фактической реализации.** При расхождении repository state является authority.

Если base SHA, ветка или upstream не совпадают — остановиться и дать `VERDICT B` с точными доказательствами. Не продолжать на предположениях.

---

## 3. ПРИЧИНА REMEDIATION

В Round 2 заявлено:

```text
RolePermission rows = effective state
Seed does NOT overwrite Admin changes
Admin changes survive restart
```

Однако фактический `SecurityService.seedRoles()` на base SHA содержит authoritative synchronization по `ROLE_PERMISSIONS`:

```text
toAdd    → возвращает отсутствующие default permissions
toRevoke → удаляет permissions, отсутствующие в ROLE_PERMISSIONS
```

Следствие при текущей реализации:

| Admin action | Поведение после restart |
|---|---|
| Отзывает default permission | startup seed выдаёт permission снова |
| Выдаёт permission вне hardcoded matrix | startup seed удаляет permission |
| Меняет effective role matrix | изменение не сохраняется после restart |

Поэтому утверждение «startup seed не перезаписывает Admin changes» нельзя считать закрытым до исправления design contract и последующей реализации в Stage A.

---

## 4. ОБЯЗАТЕЛЬНЫЕ ИСТОЧНИКИ ДЛЯ ПРОВЕРКИ

Найти и полностью проверить актуальные версии как минимум следующих артефактов:

1. `backend/src/security/security.service.ts`;
2. `backend/src/security/permissions.constants.ts`;
3. Prisma schema и все модели, связанные с `Role`, `Permission`, `RolePermission`;
4. существующие migrations/seed/bootstrap механизмы;
5. тесты `SecurityService`, RBAC guards и role-permission matrix;
6. `docs/architecture/platform-command-center-server-side-section-authority-admin-role-permissions-step-3.2.md`;
7. `docs/prompts/PHASE_3_STEP_3.2_DESIGN_REMEDIATION_ROUND_2_SERVER_SIDE_SECTION_AUTHORITY_ADMIN_PERMISSIONS_REPORT.md`;
8. предыдущий Step 3.2 Design Contract и remediation addendum;
9. актуальный roadmap/phase tracker, если он существует.

Не угадывать пути. Если структура отличается — найти файлы через repository search и зафиксировать реальные пути.

---

## 5. SCOPE ROUND 3

### In scope

- доказательство текущего поведения startup seed;
- выявление всех противоречивых утверждений Round 2;
- выбор target persistence/bootstrap model;
- точное разделение System Defaults и Effective State;
- правила fresh deploy, restart, upgrade, revoke, grant и reset;
- data migration/bootstrap strategy для Stage A;
- тестовый контракт Stage A;
- проверка совместимости с будущим Admin Permission Management;
- документирование обязательного порядка Stage A → Stage B → Stage C.

### Out of scope

- изменение production code;
- изменение Prisma schema;
- создание migrations;
- реализация API section filtering;
- реализация Command Center UI;
- реализация Admin Permission Management UI;
- изменение согласованной role/section access matrix без доказанного нового blocking conflict.

---

## 6. НЕИЗМЕННЫЕ СОГЛАСОВАННЫЕ РЕШЕНИЯ

Round 3 не должен откатывать следующие решения:

### 6.1 Permission levels

| Level | Permission | Purpose |
|---|---|---|
| Page | `analytics.read` | Доступ к Platform Command Center |
| Section | `dashboard.executive.read` | Executive KPIs |
| Section | `dashboard.operational.read` | Operational KPIs |
| Section | `dashboard.financial.read` | Financial KPIs |
| Section | `dashboard.marketplace.read` | Marketplace KPIs |
| Action | `dashboard.customize` | Настройка layout |

### 6.2 Safe default matrix

| Role | Page | Executive | Operational | Financial | Marketplace | Customize |
|---|---:|---:|---:|---:|---:|---:|
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DIRECTOR | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ANALYST | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MARKETER | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| FINANCE | ❌ | — | — | — | — | — |
| MODERATOR | ❌ | — | — | — | — | — |
| SALES_MANAGER | ❌ | — | — | — | — | — |
| OPERATOR | ❌ | — | — | — | — | — |

### 6.3 Server authority

- frontend hiding не является security mechanism;
- page gate: `analytics.read`;
- section data фильтруются на сервере;
- unauthorized sections отсутствуют в summary response;
- `availableSections` сообщает frontend разрешённые секции;
- trends используют metric → section mapping;
- known unauthorized trend metric возвращает согласованный authorization error;
- `reconciliation` required только внутри разрешённой Financial section.

### 6.4 Product contexts

- Platform Command Center и Partner Command Center остаются разными workspace contexts;
- Partner Workspace остаётся deferred scope;
- Round 3 не смешивает Platform RBAC с Partner tenant/entitlement model.

---

## 7. ОБЯЗАТЕЛЬНОЕ РАЗДЕЛЕНИЕ CURRENT STATE И TARGET STATE

В новом документе должны присутствовать две отдельные таблицы.

### 7.1 Current State — доказанный кодом

Зафиксировать для каждого объекта:

| Object | Current authority | Current runtime behavior | Evidence |
|---|---|---|---|
| `ROLE_PERMISSIONS` | Определить по коду | Определить по коду | file + symbol/lines |
| `Permission` rows | Определить по коду | Определить по коду | file + symbol/lines |
| `RolePermission` rows | Определить по коду | Определить по коду | file + symbol/lines |
| startup seed | Определить по коду | `toAdd`/`toRevoke` проверить | file + symbol/lines |
| Admin override | Реализован или нет | Сохраняется или уничтожается | evidence |

Запрещено описывать target behavior как уже существующее.

### 7.2 Target State — после Stage A

Зафиксировать целевую authority hierarchy:

```text
System Role Defaults
→ one-time/versioned bootstrap or migration
→ RolePermission persisted effective state
→ runtime authorization
→ future explicit Admin mutations
→ explicit reset-to-default action
```

---

## 8. TARGET PERSISTENCE CONTRACT

### 8.1 Обязательный результат

После Stage A должны выполняться все условия:

1. `RolePermission` rows являются persisted effective state.
2. Обычный application restart не изменяет role-permission assignments.
3. Отзыв default permission сохраняется после restart.
4. Выдача non-default permission сохраняется после restart.
5. Fresh database получает safe defaults.
6. Новые permission codes и их safe default assignments применяются предсказуемо и однократно.
7. Upgrade не удаляет Admin grants и не возвращает Admin revocations без отдельного явно утверждённого security migration.
8. Reset to defaults является явной операцией, а не побочным эффектом restart.
9. Runtime authorization читает effective state из БД.
10. Stage C сможет изменять права без переделки фундаментальной persistence model.

### 8.2 Предпочтительная модель

Предпочтительно использовать:

```text
Role/Permission catalog
→ idempotent creation where repository conventions require it

Default RolePermission assignments
→ one-time Prisma migration or durable versioned bootstrap

RolePermission
→ effective mutable state after bootstrap

ROLE_PERMISSIONS
→ system-default definition for documentation, tests and explicit reset
→ NOT continuously enforced during normal startup
```

Допустима другая модель только если она:

- основана на существующих repository conventions;
- имеет durable marker/version;
- не определяет «первый запуск» через ненадёжную проверку `RolePermission.count() === 0`;
- сохраняет Admin grants/revocations;
- имеет ясную upgrade и rollback семантику;
- не требует Stage C для обеспечения persistence safety.

### 8.3 Запрещённые решения

Не принимать:

- `createMany(skipDuplicates)` default links при каждом startup — это возвращает отозванные Admin permissions;
- authoritative `toAdd`/`toRevoke` synchronization при каждом startup;
- «Admin удаляет строку, restart восстановит default»;
- хранение Admin overrides только в памяти;
- незафиксированный heuristic bootstrap без durable version;
- утверждение «seed safe» без тестируемого алгоритма;
- перенос решения целиком в Stage C.

---

## 9. FRESH DEPLOY / RESTART / UPGRADE / RESET MATRIX

Новый контракт обязан однозначно заполнить таблицу:

| Scenario | Permission catalog | Default assignments | Existing Admin changes | Required mechanism |
|---|---|---|---|---|
| Fresh database |  |  | N/A |  |
| Normal restart |  |  |  |  |
| Deploy with new permission code |  |  |  |  |
| Deploy with changed safe default |  |  |  |  |
| Admin revokes default permission |  |  |  |  |
| Admin grants non-default permission |  |  |  |  |
| Explicit reset one role |  |  |  |  |
| Rollback application version |  |  |  |  |

Для «changed safe default» отдельно определить:

- изменение применяется только к новым installations;
- либо применяется существующим installations через явную data migration;
- какие grants/revocations допустимы;
- как избежать уничтожения Admin intent.

---

## 10. STAGE A IMPLEMENTATION CONTRACT

Round 3 не реализует Stage A, но обязан подготовить точный change map.

Change map должен указывать реальные repository paths и включать:

1. добавление пяти `dashboard.*` permissions;
2. safe default assignments для согласованных ролей;
3. прекращение destructive/authoritative startup synchronization `RolePermission`;
4. one-time migration/versioned bootstrap для новых defaults;
5. server-side summary section filtering;
6. `availableSections` response contract;
7. trends metric authorization;
8. conditional `reconciliation` rule;
9. backend unit/integration/e2e tests;
10. frontend contract adaptations, если типы API находятся в общей Stage A зоне;
11. rollback/data safety notes.

Для каждого изменения указать:

| Change | File/module | Production/Schema/Migration/Test | Why | Blocking |
|---|---|---|---|---|

---

## 11. ОБЯЗАТЕЛЬНЫЙ TEST CONTRACT ДЛЯ STAGE A

Спроектировать конкретные тесты, а не общие формулировки.

Минимальный набор:

### 11.1 Bootstrap and restart safety

1. Fresh DB получает все согласованные default role assignments.
2. Второй запуск bootstrap/startup не создаёт duplicate links.
3. Удалённый default `RolePermission` не возвращается после `onModuleInit()`.
4. Добавленный non-default `RolePermission` не удаляется после `onModuleInit()`.
5. Новый permission catalog row создаётся/мигрируется без изменения несвязанных effective assignments.

### 11.2 Authorization

6. User без `analytics.read` получает page denial.
7. MARKETER получает только Executive + Marketplace sections.
8. MARKETER не получает Operational/Financial payload fields.
9. ADMIN/DIRECTOR/ANALYST получают четыре разрешённые секции.
10. Unauthorized trend metric блокируется сервером.
11. `reconciliation` недоступен без Financial authority.

### 11.3 Future Admin compatibility

12. Direct effective grant сохраняется после restart simulation.
13. Direct effective revoke сохраняется после restart simulation.
14. Explicit reset algorithm восстанавливает только system defaults выбранной роли и не изменяет другие роли.

Тест explicit reset может оставаться Stage C implementation, но его алгоритм и acceptance criteria должны быть определены сейчас.

---

## 12. ИСПРАВЛЕНИЕ ROUND 2 ARTIFACTS

Найти все утверждения, конфликтующие с фактическим кодом, включая как минимум:

- «seed only creates Permission catalog rows»;
- «seed does not recreate RolePermission assignments»;
- «Admin changes preserved across restart»;
- «Admin deletes custom rows; defaults re-seeded on restart»;
- «new permission gets no default assignment» против описания fresh bootstrap;
- любые одновременные утверждения, где `ROLE_PERMISSIONS` и `RolePermission` оба названы effective authority.

Для каждого конфликта составить reconciliation table:

| Artifact/section | Existing statement | Why incorrect/ambiguous | Replacement authority |
|---|---|---|---|

Не переписывать историю молча. Новый Round 3 document должен явно supersede ошибочные части Round 2.

---

## 13. REQUIRED DELIVERABLES

Создать только два документа:

```text
docs/architecture/platform-command-center-rbac-seed-admin-override-persistence-contract-step-3.2.md
```

```text
docs/prompts/PHASE_3_STEP_3.2_DESIGN_REMEDIATION_ROUND_3_RBAC_SEED_ADMIN_OVERRIDE_PERSISTENCE_REPORT.md
```

Production code, tests, Prisma schema и migrations в Round 3 не изменять.

---

## 14. ACCEPTANCE CRITERIA

`VERDICT A — READY FOR SECURITY PREREQUISITE IMPLEMENTATION` допустим только если выполнено всё:

- [ ] base SHA и repository state подтверждены;
- [ ] current startup seed описан по фактическому коду;
- [ ] признано, что текущий `toAdd`/`toRevoke` несовместим с Admin persistence;
- [ ] Current State отделён от Target State;
- [ ] выбран один непротиворечивый target persistence model;
- [ ] обычный restart не меняет effective `RolePermission`;
- [ ] fresh deploy получает safe defaults;
- [ ] upgrade/new permission имеет one-time semantics;
- [ ] Admin grant/revoke переживает restart;
- [ ] reset-to-default является explicit action;
- [ ] Stage A включает исправление startup seed behavior;
- [ ] Stage A имеет конкретный test contract;
- [ ] Round 2 contradictions перечислены и superseded;
- [ ] role/section matrix не регрессировала;
- [ ] server-side section authority не регрессировала;
- [ ] Stage C остаётся future UI/API scope, но persistence foundation готова в Stage A;
- [ ] изменены только два docs-файла;
- [ ] `git diff --check` проходит;
- [ ] commit pushed в upstream;
- [ ] `HEAD == upstream/master`;
- [ ] worktree clean.

Если хотя бы один пункт не закрыт, итог:

```text
VERDICT B — REMEDIATION REQUIRED
```

Нельзя выдавать Verdict A на основании будущего обещания «исправить в Stage C».

---

## 15. GIT CONTRACT

После завершения:

1. проверить `git diff --check`;
2. убедиться, что изменены только два требуемых документа;
3. создать один целевой commit;
4. push в `origin/master` только если это соответствует текущему repository workflow и разрешениям;
5. подтвердить `HEAD == upstream/master`;
6. подтвердить clean worktree.

Рекомендуемый commit message:

```text
docs(step-3.2): fix RBAC seed and admin override persistence contract
```

---

## 16. ФОРМАТ ФИНАЛЬНОГО ОТВЕТА

Финальный ответ разработчика — только на русском языке и в следующей структуре:

```markdown
## PHASE 3 — STEP 3.2 — DESIGN REMEDIATION ROUND 3 — <VERDICT>

### Repository State
- Repository:
- Branch:
- Base SHA:
- Final SHA:
- Upstream:
- Worktree:

### Доказанный Current State
- ROLE_PERMISSIONS:
- RolePermission:
- startup seed:
- поведение Admin grant/revoke после restart:

### Выбранный Target Contract
- system defaults:
- effective state:
- fresh deploy:
- normal restart:
- upgrade:
- explicit reset:

### Что исправлено в документации
- ...

### Stage A Change Map
- ...

### Evidence
- Files changed:
- Production code changes: 0
- Schema/migration changes: 0
- git diff --check:
- HEAD == upstream:
- Worktree clean:

### Commit
`<sha>` — pushed to upstream

### NEXT
`PHASE 3 — STEP 3.2 — SERVER-SIDE SECTION AUTHORITY — SECURITY PREREQUISITE IMPLEMENTATION — STAGE A`
```

---

## 17. STOP CONDITIONS

Остановиться с `VERDICT B`, если:

- repository/base state не подтверждён;
- реальные seed semantics нельзя доказать;
- выбранная модель зависит от future Stage C для сохранения Admin changes;
- startup продолжает рассматриваться как authoritative reconciliation effective permissions;
- fresh deploy и upgrade semantics не определены;
- документы остаются внутренне противоречивыми;
- требуется production/schema change в рамках этого docs-only round;
- невозможно безопасно commit/push без затрагивания чужих изменений.

