# PHASE 3 — STEP 3.2 — RBAC SEED VS ADMIN OVERRIDE PERSISTENCE CONTRACT

> **ЯЗЫК:** все пояснения, отчёты, выводы и финальный ответ — на русском языке. Английский допускается только для кода, имён файлов, команд, идентификаторов, permission codes и стандартных технических статусов.

> **Supersedes:** все противоречивые утверждения Round 2 (`platform-command-center-server-side-section-authority-admin-role-permissions-step-3.2.md` §5.3, §6.2, §6.4 и отчёт Round 2 §6, §7). Где Round 2 утверждает, что startup seed не затрагивает `RolePermission` — это неверно. Настоящий документ является authority для persistence контракта.

---

## 1. НАЗНАЧЕНИЕ

Настоящий документ устанавливает однозначный, непротиворечивый и реализуемый контракт между:

- безопасными правами ролей по умолчанию (`ROLE_PERMISSIONS`);
- фактическими строками `RolePermission` в БД;
- startup seed в `SecurityService.seedRoles()`;
- будущими изменениями прав через Admin Permission Management (Stage C);
- сохранением effective permissions после перезапуска и деплоя.

---

## 2. ДОКАЗАННОЕ CURRENT STATE

### 2.1 `ROLE_PERMISSIONS` (permissions.constants.ts)

| Аспект | Факт | Evidence |
|---|---|---|
| Тип | `Record<RoleCode, PermissionCode[]>` — статическая константа | `backend/src/security/permissions.constants.ts`, строки 80–300+ |
| ADMIN | `ALL_PERMISSIONS` (все permissions из каталога) | `permissions.constants.ts` строка 81 |
| Остальные роли | Массивы конкретных permission codes | `permissions.constants.ts` строки 83–300+ |
| Runtime authority | **Authoritative**: seed синхронизирует RolePermission по этой матрице при каждом `onModuleInit()` | `security.service.ts` строки 74–96 |
| Функция | Определяет БАЗОВЫЕ assignments + является authoritative source для деструктивной синхронизации | — |

### 2.2 `Permission` rows (Prisma `security.Permission`)

| Аспект | Факт | Evidence |
|---|---|---|
| Schema | `id uuid PK`, `code String unique`, `description String?` | `backend/prisma/schema.prisma` строка 2368 |
| Создание | Seed создаёт отсутствующие строки через `createMany` (идемпотентно) | `security.service.ts` строки 60–66 |
| Удаление | Никогда не удаляется seed'ом | — |
| Admin changes | Admin не может изменить catalog Permission rows через текущий UI (Stage C) | — |

### 2.3 `RolePermission` rows (Prisma `security.RolePermission`)

| Аспект | Факт | Evidence |
|---|---|---|
| Schema | `roleId` FK → Role, `permissionId` FK → Permission, composite PK `[roleId, permissionId]` | `backend/prisma/schema.prisma` строка 2377 |
| Runtime role | **Effective state** — runtime authorization читает отсюда | `security.service.ts` строки 100–107 |
| Seed behavior | **Authoritative synchronization** — `toAdd` (missing) + `toRevoke` (stale) | `security.service.ts` строки 74–96 |
| Cascade | `onDelete: Cascade` — удаление Role/Permission удаляет связанные RolePermission | `schema.prisma` строки 2379, 2381 |

### 2.4 Startup seed (`SecurityService.seedRoles()`)

| Аспект | Факт | Evidence |
|---|---|---|
| Trigger | `onModuleInit()` — каждый startup приложения | `security.service.ts` строка 42 |
| Role upsert | Создаёт Role rows для всех `RoleCode` (идемпотентно) | `security.service.ts` строки 49–54 |
| Permission create | Создаёт отсутствующие Permission rows (идемпотентно) | `security.service.ts` строки 56–66 |
| **RolePermission sync** | **`toAdd`**: добавляет links, отсутствующие в ROLE_PERMISSIONS | `security.service.ts` строки 74–80 |
| | **`toRevoke`**: удаляет links, отсутствующие в ROLE_PERMISSIONS | `security.service.ts` строки 81–90 |
| Логирование | `this.logger.log("RBAC roles/permissions seeded")` | `security.service.ts` строка 92 |

**Критический вывод:** Текущий `seedRoles()` выполняет **authoritative synchronization** `RolePermission` rows по `ROLE_PERMISSIONS` при каждом startup. Это НЕ «создание отсутствующих» — это **принудительная перезапись** effective state.

### 2.5 Поведение Admin grant/revoke после restart

| Admin action | Поведение после restart | Evidence |
|---|---|---|
| Отзывает default permission (удаляет RolePermission link) | startup seed выполняет `toAdd` → permission **восстанавливается** | `security.service.ts` строки 74–80 |
| Выдаёт permission вне ROLE_PERMISSIONS (создаёт RolePermission link) | startup seed выполняет `toRevoke` → permission **удаляется** | `security.service.ts` строки 81–90 |
| Меняет effective role matrix | Изменение **не сохраняется** после restart | — |

### 2.6 Итог Current State

```
ROLE_PERMISSIONS → authoritative source
seedRoles() → каждые N секунд (при restart) принудительно синхронизирует
RolePermission → ephemeral, не является persisted effective state
Admin override → НЕ переживает restart
```

---

## 3. ПРОТИВОРЕЧИЯ ROUND 2 — RECONCILIATION TABLE

| Артефакт Round 2 | Существующее утверждение | Почему неверно/противоречиво | Замена authority |
|---|---|---|---|
| `platform-command-center-server-side-section-authority...step-3.2.md` §5.3 | «Seed only creates Permission catalog rows. Does NOT recreate RolePermission assignments» | Seed выполняет `toAdd` + `toRevoke` — авторитетная синхронизация RolePermission | Seed синхронизирует RolePermission по ROLE_PERMISSIONS; это деструктивно для Admin overrides |
| `platform-command-center-server-side-section-authority...step-3.2.md` §5.3 | «Admin CAN modify RolePermission rows at runtime. Seed will NOT overwrite Admin changes on restart» | `toAdd` восстанавливает отозванные defaults; `toRevoke` удаляет не-MATRIX grants | Admin changes **уничтожаются** при restart |
| `platform-command-center-server-side-section-authority...step-3.2.md` §6.2 | «Seed creates Permission rows + RolePermission defaults. Restart: seed creates only missing Permission rows; existing RolePermission preserved» | Строка 81–90: `toRevoke` удаляет ставшие «лишними» после restart links | Seed не «создаёт отсутствующие» — он удаляет «лишние» |
| `platform-command-center-server-side-section-authority...step-3.2.md` §6.3 | «Seed creates Permission row; no RolePermission auto-assigned. Admin must explicitly grant» | `toAdd` автоматически создаёт RolePermission для ВСЕХ permissions из ROLE_PERMISSIONS | Auto-assigned для permissions, присутствующих в ROLE_PERMISSIONS matrix |
| Отчёт Round 2 §6 | «Current persistence: RolePermission rows are effective state» | Seed синхронизирует при каждом startup — RolePermission ≠ persisted effective state | RolePermission является **ephemeral state**, синхронизируемым seed'ом |
| Отчёт Round 2 §7 | «Seed creates Permission + RolePermission defaults (idempotent)» | Seed выполняет авторитетную синхронизацию (toAdd/toRevoke), не простое «создание отсутствующих» | Seed выполняет destructive reconciliation |
| Отчёт Round 2 §7 | «Admin modifies RolePermission; preserved across restart» | Контрадикция с фактическим seed'ом | Admin changes **не** переживают restart |
| Отчёт Round 2 §7 | «Admin deletes custom rows; defaults re-seeded if missing» | Потенциально верно для удаления не-MATRIX строк, но seed восстановит отозванные MATRIX defaults | Seed восстанавливает MATRIX defaults |

---

## 4. ВЫБРАННЫЙ TARGET PERSISTENCE CONTRACT

### 4.1 Иерархия authority

```
System Role Defaults
    → one-time/versioned bootstrap или migration
    → RolePermission persisted effective state
    → runtime authorization
    → future explicit Admin mutations (Stage C)
    → explicit reset-to-default action (Stage C)
```

### 4.2 Разделение System Defaults и Effective State

| Концепт | Определение | Хранение | Изменение |
|---|---|---|---|
| **System Defaults** | Определение safe default assignments для каждой роли | `ROLE_PERMISSIONS` в коде — reference, documentation, tests, explicit reset | Только через code change + deploy |
| **Effective State** | Текущие assignments для каждой роли | `RolePermission` rows в БД | Stage A: one-time Prisma migration; Stage C: Admin mutations |

### 4.3 Target seed behavior (Stage A)

```
seedRoles():
  1. Role upsert (айдемпотентно) — БЕЗ ИЗМЕНЕНИЙ
  2. Permission catalog createMany (айдемпотентно) — БЕЗ ИЗМЕНЕНИЙ
  3. STOP — НЕ выполняет toAdd/toRevoke для RolePermission
```

RolePermission default assignments создаются **только** через one-time Prisma migration. Startup seed НЕ materializes ROLE_PERMISSIONS в RolePermission rows.

### 4.4 Target RolePermission lifecycle

| Событие | Механизм | Результат |
|---|---|---|
| Fresh deploy | One-time Prisma migration или durable versioned bootstrap | RolePermission rows для safe defaults |
| Normal restart | **Ничего** — seed НЕ трогает RolePermission | Effective state сохраняется |
| Deploy с новым permission code | One-time migration создаёт Permission + default RolePermission (идемпотентно) | Новый permission + default assignment |
| Deploy с изменённым safe default | Явная data migration (отдельный approval) | Изменение применяется |
| Admin grant (Stage C) | Прямая вставка RolePermission row | Grant сохраняется |
| Admin revoke (Stage C) | Прямое удаление RolePermission row | Revoke сохраняется |
| Explicit reset (Stage C) | Удаление всех RolePermission для роли + восстановление из ROLE_PERMISSIONS | Defaults восстановлены |

---

## 5. FRESH DEPLOY / RESTART / UPGRADE / RESET MATRIX

| Сценарий | Permission catalog | Default assignments | Существующие Admin changes | Требуемый механизм |
|---|---|---|---|---|
| **Fresh database** | Создаётся seed'ом (айдемпотентно) | One-time migration/bootstrap | N/A | Prisma migration или versioned bootstrap |
| **Normal restart** | Уже существует; seed создаёт отсутствующие | **Не изменяются** | **Сохраняются** | Seed создаёт только Permission catalog; RolePermission не трогает |
| **Deploy с новым permission code** | Создаётся seed'ом (айдемпотентно) | One-time migration для нового default | **Сохраняются** | Versioned migration: создать Permission + default RolePermission если не существует |
| **Deploy с changed safe default** | Уже существует | Явная data migration (security approval) | **Сохраняются** (если не конфликтуют) | Explicit migration script с security review |
| **Admin revoke default permission** | Уже существует | — | Revoke сохранён | Stage C: прямое удаление RolePermission row |
| **Admin grant non-default permission** | Уже существует | — | Grant сохранён | Stage C: прямая вставка RolePermission row |
| **Explicit reset one role** | Уже существует | Восстановление из ROLE_PERMISSIONS | Сброшены для этой роли | Stage C: delete all + re-seed from ROLE_PERMISSIONS |
| **Rollback application version** | Seed создаёт отсутствующие | **Не изменяются** (если миграции обратимы) | **Сохраняются** | Обратимые миграции + seed не трогает RolePermission |

### 5.1 Changed safe default — детали

| Аспект | Решение |
|---|---|
| Fresh installations | Defaults определяются **migration history**, а не runtime materialization ROLE_PERMISSIONS |
| Применение к existing installations | Только через **явную data migration** с security approval |
| Новый permission code | One-time migration безопасно создаёт Permission + default assignments: до появления code Admin не мог создать override |
| Изменение default для существующего permission | Отсутствие/наличие RolePermission **не раскрывает** Admin intent. Автоматическое определение `adminDidNotModify` невозможно без persisted override/provenance metadata |
| Emergency/security revocation | Targeted data migration с отдельным security approval; сознательно меняет effective state |
| Future three-way merge | Требует persisted provenance/override model в Stage C. Нельзя придумывать его наличие сейчас |

---

## 6. STAGE A IMPLEMENTATION CHANGE MAP

| Change | File/module | Production/Schema/Migration/Test | Why | Blocking |
|---|---|---|---|---|
| Добавление 5 `dashboard.*` permissions в каталог | `backend/src/security/permissions.constants.ts` | Production code | 5 новых section-level permissions для Command Center | YES |
| Safe default assignments для согласованных ролей | `backend/src/security/permissions.constants.ts` (ROLE_PERMISSIONS) | Production code | Определение базовых assignments | YES |
| One-time Prisma migration: Permission catalog + default RolePermission | `backend/prisma/migrations/XXXX_add_dashboard_permissions/migration.sql` | Migration | Идемпотентное создание Permission rows + default RolePermission assignments | YES |
| **Прекращение destructive startup synchronization** | `backend/src/security/security.service.ts` (`seedRoles()`) | Production code | Удалить `toAdd`/`toRevoke` логику для RolePermission | YES — критично |
| Versioned bootstrap marker (опционально) | `backend/prisma/schema.prisma` (новая таблица `SchemaMeta` или version field) | Schema + Migration | Уникализация «был ли уже bootstrap» без ненадёжной `RolePermission.count() === 0` | NO (migration sufficient) |
| Server-side summary section filtering | `backend/src/modules/dashboard/dashboard.service.ts` | Production code | Фильтрация sections по user permissions | YES |
| `availableSections` response contract | `backend/src/modules/dashboard/dashboard.types.ts` | Production code | DTO для authorized sections | YES |
| Trends metric → section authorization | `backend/src/modules/dashboard/dashboard.service.ts` | Production code | Блокировка unauthorized metrics | YES |
| Conditional `reconciliation` rule | `backend/src/modules/dashboard/dashboard.service.ts` | Production code | Reconciliation только при Financial authority | YES |
| Widget Registry section permission metadata | `backend/src/modules/workspace/workspace.types.ts` | Production code | `sectionPermission` field в WidgetDefinition | YES |
| Effective layout section filtering | `backend/src/modules/workspace/workspace.service.ts` | Production code | Фильтрация widgets по section permission | YES |
| Backend unit tests — bootstrap/restart safety | `backend/src/modules/security/security.service.spec.ts` | Test | 5 тестов (§7.1) | YES |
| Backend e2e tests — section authority | `backend/test/dashboard-command-center.e2e-spec.ts` | Test | 6 тестов (§7.2) | YES |
| Frontend contract adaptations (если типы в общей зоне) | Frontend types/API client | Production code (frontend) | Адаптация к new response shape | NO (Stage B) |
| Rollback/data safety notes | Documentation | Docs | rollback procedures | NO |

### 6.1 Примечание по versioned bootstrap

Допустимы два подхода:

**A. Prisma migration-only** (предпочтительно, если repository conventions позволяют):
- Migration создаёт Permission rows + default RolePermission идемпотентно
- Seed продолжает создавать Permission catalog (айдемпотентно)
- Seed НЕ создаёт/синхронизирует RolePermission

**B. SchemaMeta table** (если нужна дополнительная гибкость):
- Новая таблица `SchemaMeta { key String PK, value String, updatedAt DateTime }`
- Хранит `rbac_bootstrap_version` или `last_dashboard_permission_migration`
- Seed проверяет version перед applied seed logic

В Stage A предпочтительнее вариант A — проще, соответствует текущим conventions.

---

## 7. TEST CONTRACT ДЛЯ STAGE A

### 7.1 Bootstrap and restart safety

| # | Тест | Expected behavior |
|---|---|---|
| 1 | Fresh DB получает все согласованные default role assignments | После bootstrap: для каждой роли из ROLE_PERMISSIONS существуют RolePermission rows для ВСЕХ permissions из её массива |
| 2 | Второй запуск bootstrap/startup не создаёт duplicate links | После второго `onModuleInit()`: количество RolePermission rows не изменилось |
| 3 | Удалённый default `RolePermission` не возвращается после `onModuleInit()` | Admin удаляет `MARKETER → dashboard.marketplace.read`. Restart. Link НЕ появляется. |
| 4 | Добавленный non-default `RolePermission` не удаляется после `onModuleInit()` | Admin добавляет `FINANCE → analytics.read`. Restart. Link сохраняется. |
| 5 | Новый permission catalog row создаётся без изменения несвязанных effective assignments | Добавить новый permission в ROLE_PERMISSIONS. Seed создаёт Permission row. Существующие RolePermission для других permissions не изменяются. |

### 7.2 Authorization

| # | Тест | Expected behavior |
|---|---|---|
| 6 | User без `analytics.read` получает page denial | GET /api/v1/dashboard/command-center → 403 |
| 7 | MARKETER получает Executive + Marketplace sections | Response: `sections.executive` present, `sections.marketplace` present, `sections.operational` absent, `sections.financial` absent |
| 8 | MARKETER не получает Operational/Financial payload fields | Response body не содержит operational/financial data |
| 9 | ADMIN/DIRECTOR/ANALYST получают 4 секции | Response: все 4 sections present |
| 10 | Unauthorized trend metric блокируется сервером | `GET /trends?metric=commission` для MARKETER → 403 |
| 11 | `reconciliation` недоступен без Financial authority | MARKETER: reconciliation not in widget catalog |

### 7.3 Future Admin compatibility

| # | Тест | Expected behavior |
|---|---|---|
| 12 | Direct effective grant сохраняется после restart simulation | Вставка RolePermission (FINANCE → analytics.read). Seed. Link сохраняется. |
| 13 | Direct effective revoke сохраняется после restart simulation | Удаление RolePermission (MARKETER → dashboard.marketplace.read). Seed. Link не появляется. |
| 14 | Explicit reset algorithm восстанавливает только system defaults выбранной роли | Удалить все RolePermission для FINANCE, восстановить из ROLE_PERMISSIONS. Другие роли не изменены. |

**Примечание:** Тесты 12–14 могут оставаться Stage C implementation, но их **algorithm и acceptance criteria** определяются сейчас.

---

## 8. IMPLICIT ADMIN OVERRIDE PROTECTION RULES (Stage C scope)

| Правило | Определение |
|---|---|
| ADMIN = ALL_PERMISSIONS | Admin role всегда имеет все permissions; нельзя отозвать ни одно |
| Last recovery admin | Нельзя отозвать permissions у последнего ADMIN-пользователя |
| Self-escalation prevention | Admin не может grant себе permissions сверх текущего scope |
| Platform scope isolation | Admin не может grant Platform permissions в Partner context |
| Audit trail | Каждый Admin grant/revoke фиксируется в AuditLog |
| Explicit reset | Reset-to-default — явная операция, не побочный эффект restart |

---

## 9. ОБЯЗАТЕЛЬНЫЙ ПОРЯДОК IMPLEMENTATION

```
Stage A — Security Prerequisite (этот документ)
    ↓
Stage B — Platform Command Center UI
    ↓
Stage C — Admin Permission Management UI
```

**Stage A** устанавливает:
- Persistence foundation (RolePermission = effective state, seed не перезаписывает)
- section-level permissions (5 новых)
- server-side filtering
- test contract

**Stage B** использует foundation Stage A для UI.

**Stage C** добавляет Admin UI поверх сохранённого foundation.

---

## 10. НЕИЗМЕННЫЕ СОГЛАСОВАННЫЕ РЕШЕНИЯ (из Round 2)

### 10.1 Permission levels

| Level | Permission | Purpose |
|---|---|---|
| Page | `analytics.read` | Доступ к Platform Command Center |
| Section | `dashboard.executive.read` | Executive KPIs |
| Section | `dashboard.operational.read` | Operational KPIs |
| Section | `dashboard.financial.read` | Financial KPIs |
| Section | `dashboard.marketplace.read` | Marketplace KPIs |
| Action | `dashboard.customize` | Настройка layout |

### 10.2 Safe default matrix

| Role | Page | Executive | Operational | Financial | Marketplace | Customize |
|---|---|---|---|---|---|---|
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DIRECTOR | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ANALYST | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| MARKETER | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| FINANCE | ❌ | — | — | — | — | — |
| MODERATOR | ❌ | — | — | — | — | — |
| SALES_MANAGER | ❌ | — | — | — | — | — |
| OPERATOR | ❌ | — | — | — | — | — |

### 10.3 Server authority

- Frontend hiding не является security mechanism
- Page gate: `analytics.read`
- Section data фильтруются на сервере
- Unauthorized sections отсутствуют в summary response
- `availableSections` сообщает frontend разрешённые секции
- Trends используют metric → section mapping
- Known unauthorized trend metric возвращает 403
- `reconciliation` required только внутри разрешённой Financial section

### 10.4 Product contexts

- Platform Command Center и Partner Command Center остаются разными workspace contexts
- Partner Workspace остаётся deferred scope
- Round 3 не смешивает Platform RBAC с Partner tenant/entitlement model
