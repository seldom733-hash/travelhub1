# PHASE 3 — STEP 3.12 — USERS & ACCESS COMPLETION — SCOPE RECONCILIATION REPORT

```
Starting SHA:     0d68144
Final HEAD:       0d68144
Migration:        72/72 applied, schema up to date
Backend Tests:    security/auth 13/13 PASS
Frontend TSC:     PASS
```

---

## 1. Источники и файлы

| Источник | Путь |
|---|---|
| Canonical Roadmap | `docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md` (строки 1001–1028) |
| Prisma Schema | `backend/prisma/schema.prisma` (User, Role, Permission, RolePermission, AuditLog) |
| Permission Catalog | `backend/src/security/permissions.constants.ts` |
| Auth Service | `backend/src/security/auth/auth.service.ts` |
| Security Service | `backend/src/security/security.service.ts` |
| Permissions Guard | `backend/src/security/auth/permissions.guard.ts` |
| JWT Auth Guard | `backend/src/security/auth/jwt-auth.guard.ts` |
| Decorators | `backend/src/security/auth/decorators.ts` |
| Users Controller | `backend/src/security/users.controller.ts` |
| Frontend API | `frontend/lib/api.ts` |
| Frontend Session | `frontend/lib/use-user.ts`, `frontend/lib/use-can.ts` |
| Shell Sidebar | `frontend/components/Shell.tsx` |
| Users UI | `frontend/app/app/users/page.tsx` |
| RBAC Migrations | `20260819235237_add_dashboard_section_authority`, `20260830000000_remediate_support_rbac` |
| Security Tests | `backend/src/security/security.service.spec.ts`, `permissions-guard.spec.ts` |

---

## 2. Текущая архитектура

### 2.1 Модель данных (schema.prisma, security.*)

```
User ─── roleId ──→ Role ─── permissions ──→ RolePermission ──→ Permission
  │                  │
  ├── partnerId?     ├── code (RoleCode enum)
  ├── customerId?    └── title
  ├── status (UserStatus: ACTIVE | INACTIVE | LOCKED)
  ├── tokenVersion (Step 2.17 revocation)
  └── version (CAS optimistic lock)
```

**Модель «Effective Permissions = Role Default Permissions + Explicit User Grants»:**
- Role → Permission: реализован через `RolePermission` junction table (N:M)
- User → Permission: **НЕ реализовано** — отдельной таблицы `UserPermission` / `PermissionGrant` / `PermissionOverride` **НЕТ**

### 2.2 Каталог ролей (RoleCode enum)

| Код | Описание | Тип |
|---|---|---|
| ADMIN | Администратор | Platform internal |
| DIRECTOR | Директор | Platform internal |
| FINANCE | Финансы | Platform internal |
| MARKETER | Маркетолог | Platform internal |
| ANALYST | Аналитик | Platform internal |
| MODERATOR | Модератор | Platform internal |
| SALES_MANAGER | Менеджер продаж | Platform internal |
| OPERATOR | Оператор | Platform internal |
| PARTNER | Партнёр | External |
| BUYER | Покупатель | External |

**HEAD_OF_* не введены** — подтверждено.

### 2.3 Каталог permissions

Всего **~120 granular permissions** в `PERMISSIONS` объекте (`permissions.constants.ts`). Каждая строка — уникальный строковый ключ вида `domain.entity.action` или `domain.entity.scope_action`.

### 2.4 Effective Permission Calculation

**Backend:**
```typescript
// security.service.ts → permissionsOf()
async permissionsOf(userId: string): Promise<string[]> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { role: { select: { permissions: { select: { permission: { select: { code: true } } } } } } },
  });
  return (user?.role?.permissions ?? []).map((rp) => rp.permission.code);
}
```

- Права загружаются из БД на **каждый запрос** (`JwtAuthGuard.canActivate → auth.me → permissionsOf`)
- Смена роли применяется **немедленно** (не нужен refresh/session重建)
- `tokenVersion` (Step 2.17) — logout инкрементирует, JWT с устаревшим tv отклоняется

**Frontend:**
```typescript
// use-user.ts — GET /auth/session → { user: { permissions: [...] } }
// use-can.ts — user.permissions.includes(permission)
// Shell.tsx — canAccess(user, item.permission) → sidebar projection
```

**Согласованность:** Backend и frontend читают один и тот же массив `permissions` из `AuthUser.permissions`, рассчитанный на backend через `permissionsOf()`. Единственный источник истины — backend.

### 2.5 Guards / Authorization

```
JwtAuthGuard (APP_GUARD) → загружает AuthUser + permissions из БД
  ↓
PermissionsGuard (APP_GUARD) → @RequirePermissions("domain.action") → user.permissions.includes()
  ↓
Controller method → service → business logic
```

- `@RequirePermissions("settings.write")` — на эндпоинтах UsersController
- AND-семантика: требуются **все** перечисленные права
- FAIL-CLOSED: authenticated user отсутствует → ForbiddenException

### 2.6 Аутентификация

- **JWT** в HttpOnly cookie `travelhub.auth` (Secure + SameSite=Lax в prod)
- **In-memory** токен для SSR-прокси/тестов → Authorization: Bearer
- `/auth/session` (GET) — публичная сессионная проба, cookie-auth
- `/auth/me` — authenticated current user + permissions

### 2.7 Token Revocation (Step 2.17)

- `User.tokenVersion` — инкрементируется при logout
- JWT payload содержит `tv` claim
- `auth.me()` проверяет: `user.tokenVersion !== (tokenVersion ?? 0)` → 401
- Legacy-токены (без tv) работают только пока tokenVersion=0

---

## 3. Audit — конкретные находки

### 3.1 Каталог ролей

| Проверка | Результат |
|---|---|
| Canonical RoleCode enum | ✅ 10 ролей: ADMIN..BUYER |
| HEAD_OF_* введены | ❌ Не обнаружены — OK |
| Management Groups/Departments | ❌ Не обнаружены — OK |
| Миграции создают все Role rows | ✅ `20260819235237` seed Roles ON CONFLICT DO NOTHING |

### 3.2 RolePermission (Default Matrix)

| Проверка | Результат |
|---|---|
| ROLE_PERMISSIONS объект в коде | ✅ 10 ролей × N прав |
| RolePermission rows в БД | ✅ Миграции seed'ят via INSERT...ON CONFLICT DO NOTHING |
| ADMIN = ALL_PERMISSIONS | ✅ `ADMIN: ALL_PERMISSIONS` в коде, cross-join в миграции |
| Дисперсия прав по ролям | ✅ Адекватная (MODERATOR = только moderation, BUYER = только own-scope, и т.д.) |
| Несинхронизированные миграции | ⚠️ DIRECTOR в `20260819235237` имеет `dashboard.operational.read` и `dashboard.catalog.read`, но `ROLE_PERMISSIONS` в коде даёт DIRECTOR только `dashboard.operational.read` + все 8 dashboard sections. Migration seed НЕ удаляет — drift безопасен, но Kentical divergence. |

### 3.3 User-Specific Permission Grants

| Проверка | Результат |
|---|---|
| Модель UserPermission / PermissionGrant / PermissionOverride | ❌ **НЕ СУЩЕСТВУЕТ** |
| Таблица в schema.prisma | ❌ Отсутствует |
| API эндпоинт grant/revoke | ❌ Отсутствует |
| Frontend UI для user-level grants | ❌ Отсутствует |

**ВЫВОД:** Effective Permissions = Role Default Permissions. Индивидуальные гранты **невозможны**. Это **P1 GAP** для Step 3.12.

### 3.4 Effective Permission Calculation

| Проверка | Результат |
|---|---|
| Backend: единый источник | ✅ `permissionsOf()` через Prisma join |
| Frontend: читает backend | ✅ `/auth/session` → `AuthUser.permissions` |
| PermissionsGuard: AND-семантика | ✅ `required.filter(p => !user.permissions.includes(p))` |
| Сессионный refresh | ✅ `JwtAuthGuard.canActivate` → `auth.me()` на каждый запрос |
| Token revocation | ✅ `tokenVersion` + JWT `tv` claim |

### 3.5 Server Authority

| Проверка | Результат |
|---|---|
| @RequirePermissions на controllers | ✅ UsersController: `settings.write` на всех эндпоинтах |
| Support: @RequirePermissions | ✅ support.controller.ts: `support.case.*` permissions |
| Partner own-scope: server check | ✅ Services проверяют `actor.partnerId === resource.partnerId` |
| Frontend hiding ≠ security | ✅ Shell.tsx — проекция, backend guard — authority |
| Direct URL / crafted request | ✅ Backend guard отклоняет без permissions |

### 3.6 Admin UI — Users Management

| Проверка | Результат |
|---|---|
| Users list page | ✅ `/app/users` — пагинация, поиск, фильтры |
| Role assignment UI | ✅ `<select>` в строке пользователя → `PATCH /users/:id/role` |
| Status change UI | ✅ Кнопка `↻` → цикл ACTIVE→INACTIVE→LOCKED |
| Create staff UI | ✅ PanelFrame: username/password/fullName/email/role |
| Permission grant/revoke UI | ❌ **ОТСУТСТВУЕТ** |
| View effective permissions | ❌ **ОТСУТСТВУЕТ** |
| View role defaults | ❌ **ОТСУТСТВУЕТ** |
| Access change audit log view | ❌ **ОТСУТСТВУЕТ** |

### 3.7 Privilege Escalation

| Проверка | Результат |
|---|---|
| Can manager grant permission they don't have? | N/A — нет grant mechanism |
| Can user modify own role? | ⚠️ UsersController не проверяет `actor.id !== userId` — ADMIN может сменить роль **самому себе** (без ограничения, но это ADMIN, не.privilege escalation) |
| Can PARTNER acquire Platform permission? | ✅ Нет — part`User.partnerId` не даёт platform permissions; Role PERMISSIONS для PARTNER = только own-scope |
| Last ADMIN deactivation lock? | ⚠️ **НЕТ ЗАЩИТЫ** — `setStatus(ACTIVE→INACTIVE)` на последнем ADMIN выполнится без предупреждения |
| Self-deactivation lock? | ⚠️ **НЕТ ЗАЩИТЫ** — ADMIN может деактивировать себя |

### 3.8 Audit

| Проверка | Результат |
|---|---|
| AuditLog модель | ✅ `security.AuditLog` (userId, action, resource, resourceId, details, ip) |
| role_changed audit | ✅ `security.assignRole()` → `audit({ action: "user.role_changed" })` |
| status_changed audit | ✅ `security.setStatus()` → `audit({ action: "user.status_changed" })` |
| register audit | ✅ `auth.register()` → `audit({ action: "auth.register" })` |
| login audit | ✅ `auth.login()` → `audit({ action: "auth.login" })` |
| permission grant/revoke audit | ❌ **ОТСУТСТВУЕТ** — нет grant mechanism |
| Correlation (requestId) | ✅ `getRequestContext()` → details.correlation |
| Audit UI (view audit log) | ❌ **ОТСУТСТВУЕТ** — нет `/app/audit` страницы |

### 3.9 User Lifecycle

| Проверка | Результат |
|---|---|
| UserStatus enum | ✅ `ACTIVE | INACTIVE | LOCKED` |
| SUSPENDED/DEACTIVATED | ⚠️ **НЕТ** — только ACTIVE/INACTIVE/LOCKED |
| Login enforcement | ✅ `auth.login()` → `user.status !== ACTIVE → throw` |
| JWT me() enforcement | ✅ `auth.me()` → `user.status !== ACTIVE → throw` |
| Session after deactivation | ✅ Немедленно: permissionsOf() не отдельно, но me() проверяет status |
| UI status labels | ✅ `user.status.ACTIVE/INACTIVE/LOCKED` в i18n |
| Reason/comment for status change | ❌ **НЕТ** — `setStatus()` не принимает reason |
| History/audit of status changes | ✅ AuditLog записывает `user.status_changed` с from/to |

### 3.10 Platform vs Partner Boundary

| Проверка | Результат |
|---|---|
| PARTNER permissions = own-scope only | ✅ `PARTNER` в ROLE_PERMISSIONS — только `*_own` rights |
| BUYER permissions = own-scope only | ✅ `BUYER` в ROLE_PERMISSIONS — только `account.*.read_own` + reverse.* |
| PARTNER не может получить support.* | ✅ `support.case.*` не в ROLE_PERMISSIONS для PARTNER |
| Server-side own-scope enforcement | ✅ Services: `WHERE partnerId = actor.partnerId` |
| Cross-role grant isolation | ⚠️ Нет user-level grants — пока не актуально |

### 3.11 Session / Permission Refresh

| Проверка | Результат |
|---|---|
| Refresh при смене роли | ✅ `JwtAuthGuard → auth.me()` на каждый запрос → свежие permissions |
| Token expiry | ✅ JWT signed, expire check в JwtService |
| Logout → revocation | ✅ `tokenVersion++` → все старые JWT 401 |
| Frontend cache invalidation | ✅ `useCurrentUser()` → `/auth/session` на mount + token change |
| "Немедленное" применение | ✅ Да — permissions загружаются из БД на каждый запрос |

### 3.12 Support R4 Bridge (Eligible Assignee)

| Проверка | Результат |
|---|---|
| R4 статус | CANONICALLY DEFERRED — нет eligible-assignee API |
| Кандидаты на authority | Активный Platform user + `support.case.assign` permission |
| Departments/Groups для R4 | НЕ требуются — authority = role defaults + permissions |
| Зависимость от Step 3.12 | **ДА** — Step 3.12 создаёт инфраструктуру user grants, которая может обеспечить granular assignment authority для R4 |

---

## 4. Тесты — Validation Evidence

```
Backend:
  security.service.spec.ts          — PASS
  permissions-guard.spec.ts         — PASS
  Total security/auth:              13/13 PASS

Frontend:
  TSC:                              PASS (0 errors)
  All tests:                        248/248 PASS

Migration:
  72/72 applied, schema up to date
```

---

## 5. Required Gap Matrix

| # | Area | Current State | Canonical Requirement | Gap | Severity | Step 3.12? | Evidence |
|---|---|---|---|---|---|---|---|
| G1 | User-specific permission grants | **ОТСУТСТВУЕТ** — нет UserPermission модели | Effective = Role Defaults + User Grants | Невозможно дать individual user额外 permissions без смены роли | **P1** | **ДА** | schema.prisma: нет UserPermission; permissions.constants.ts: ROLE_PERMISSIONS only |
| G2 | Effective permissions UI | **ОТСУТСТВУЕТ** — нет отображения effective permissions | ADMIN должен видеть effective permissions пользователя | Нет UI для просмотра/аудита effective permissions | **P2** | **ДА** | frontend/app/app/users/page.tsx — нет permissions tab |
| G3 | Role defaults UI | **ОТСУТСТВУЕТ** — нет отображения default permissions роли | ADMIN должен видеть какие permissions даёт роль | Нет UI для просмотра role→permission mapping | **P3** | **ДА** | frontend/app/app/users/page.tsx — нет role detail |
| G4 | Audit log viewer | **ОТСУТСТВУЕТ** — нет /app/audit | Аудит access changes должен быть recoverable | AuditLog существует в БД, но нет UI для просмотра | **P2** | **ДА** | backend: AuditLog model exists; frontend: нет audit page |
| G5 | Privilege escalation guard | **ЧАСТИЧНО** — нет проверки self-modify / last-ADMIN | Last ADMIN cannot be deactivated; self-modify should be controlled | `assignRole/setStatus` не проверяют `actor.id !== userId` и не защищают последнего ADMIN | **P2** | **ДА** | security.service.ts: assignRole/setStatus — нет invariant checks |
| G6 | User status reason/comment | **ОТСУТСТВУЕТ** — setStatus не принимает reason | Status changes should carry reason/comment | `setStatus(userId, status, actorId)` — без reason параметра | **P3** | **ДА** | security.service.ts: setStatus — нет reason параметра |
| G7 | UserStatus: SUSPENDED | **ОТСУТСТВУЕТ** — только ACTIVE/INACTIVE/LOCKED | Canonical: ACTIVE/SUSPENDED/DEACTIVATED | Текущий INACTIVE ≠ SUSPENDED семантически; LOCKED ≠ DEACTIVATED | **P3** | **ДА** | schema.prisma: `enum UserStatus { ACTIVE INACTIVE LOCKED }` |
| G8 | Access management authority | **ОТСУТСТВУЕТ** — нет отдельного `users.manage` / `access.manage` | Access management should be permission-gated | Сейчас: `settings.write` = всё (user CRUD + role assign + status change + reconciliation). Нет гранулярных access管理 permissions | **P3** | **ДА** | permissions.constants.ts: `settings.write` → все users endpoints |
| G9 | Menu/route projection refresh | **РАБОТАЕТ** — sidebar читает useCurrentUser → /auth/session | Permissions projection must reflect changes | После role change → useEffect перезапросит /auth/session → sidebar обновится | **OK** | НЕТ | use-user.ts: auth.subscribe → refetch |
| G10 | R4 eligible-assignee bridge | **ОТСУТСТВУЕТ** — нет eligible-assignee API | Step 3.12 может создать reusable authority для R4 | Нет API "users with support.case.assign + ACTIVE status" | **P3** | **ДА** (bridge) | support.service.ts: assignCase — нет eligible-assignee query |

---

## 6. Architecture Decisions (AD-1..AD-13)

### AD-1: Canonical Predefined Role Catalog
**Decision:** 10 ролей: ADMIN, DIRECTOR, FINANCE, MARKETER, ANALYST, MODERATOR, SALES_MANAGER, OPERATOR, PARTNER, BUYER. Новые роли — только через ADR. Каталог зафиксирован в `RoleCode` enum.

### AD-2: Role → Default Permission Authority
**Decision:** `ROLE_PERMISSIONS` объект в `permissions.constants.ts` — кодовый источник default mapping. `RolePermission` rows в БД — persisted state (seed через миграции). Startup seed не выполняет diff — миграции являются authority.

### AD-3: Role Defaults — System-Fixed vs ADMIN-Editable
**Decision:** Role defaults **system-fixed** (код + миграции). ADMIN не может редактировать role→permission mapping через UI. ADMIN может назначать/менять роли пользователям. Будущий Stage C (если потребуется) — отдельный ADR.

### AD-4: User-Specific Grant Storage
**Decision:** **ОТСУТСТВУЕТ** — Step 3.12 должен добавить:
```
model UserPermission {
  userId       String
  user         User       @relation(...)
  permissionId String
  permission   Permission @relation(...)
  grantedById  String?    // actor who granted
  grantedAt    DateTime   @default(now())
  reason       String?    // business justification

  @@id([userId, permissionId])
  @@schema("security")
}
```

### AD-5: Effective Permission Calculation
**Decision:** `Effective = RolePermission(code) ∪ UserPermission(code)`. Реализация в `permissionsOf()`:
```typescript
async permissionsOf(userId: string): Promise<string[]> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: { select: { permissions: { select: { permission: { select: { code: true } } } } } },
      userPermissions: { select: { permission: { select: { code: true } } } },
    },
  });
  const rolePerms = (user?.role?.permissions ?? []).map(rp => rp.permission.code);
  const userPerms = (user?.userPermissions ?? []).map(up => up.permission.code);
  return [...new Set([...rolePerms, ...userPerms])];
}
```

### AD-6: Grant/Revoke Authority
**Decision:** Только `ADMIN` (через `users.manage` permission) может grant/revoke user-level permissions. Правило: **grantor не может grant permissions, которых у него нет** (нельзя выдать `finance.payment.write`, если у тебя нет `finance.payment.write`).

### AD-7: Privilege Escalation Rules
**Decision:**
- Grantor can only grant permissions they possess
- User cannot modify own role/permissions through self-service
- Last ADMIN cannot be deactivated/role-changed (invariant)
- Self-deactivation of last ADMIN → rejected

### AD-8: Audit Mechanism
**Decision:** Reuse `security.AuditLog`. Новые action types:
- `user.permission_granted` (actorId, targetUserId, permission, reason)
- `user.permission_revoked` (actorId, targetUserId, permission)
- `user.role_changed` — УЖЕ ЕСТЬ
- `user.status_changed` — УЖЕ ЕСТЬ

### AD-9: User Lifecycle Authority
**Decision:** Статусы: `ACTIVE | INACTIVE | LOCKED | SUSPENDED` (добавить SUSPENDED в enum). LOGIN enforcement: `user.status !== ACTIVE → rejected` (УЖЕ ЕСТЬ). Новые invariant: last ADMIN cannot be set to non-ACTIVE.

### AD-10: Session/Permission Refresh
**Decision:** **Немедленно** — permissions загружаются из БД на каждый запрос через `JwtAuthGuard → auth.me()`. Нет token-refreshdelay. Фронтенд: `/auth/session` на mount + token change subscriber.

### AD-11: Platform vs Partner Scoping
**Decision:** Partner permissions = только own-scope (`*_own`). Platform permissions = unscoped internal. UserPermission grant НЕ может дать PARTNER/BUYER platform-level permissions (backend enforcement: service-level ownership check + permissions guard).

### AD-12: Support R4 Bridge
**Decision:** Step 3.12 создаёт инфраструктуру user grants, которая делает возможным future eligible-assignee API: `User WHERE status=ACTIVE AND effectivePermissions CONTAINS support.case.assign`. Не реализует сам API — это deferred R4 scope.

### AD-13: Boundary with Future Workforce/Employees
**Decision:** Departments, Teams, Management Groups, hierarchy, employee workload — **OUT OF SCOPE**. Authorization solved by role defaults + explicit user grants. Organizational structure — отдельный Workforce domain в будущем.

---

## 7. Frozen Implementation Scope

### STEP 3.12 IMPLEMENTATION — IN SCOPE

1. **Schema: UserPermission model** — junction table userId↔permissionId + grantedById + grantedAt + reason. Migration + seed compatible с существующими RolePermission rows.

2. **Backend: permissionsOf() enhancement** — union role defaults ∪ user grants. Единый источник effective permissions.

3. **Backend: Grant/Revoke API** — `POST /users/:id/permissions` (grant), `DELETE /users/:id/permissions/:code` (revoke). Гейт: `users.manage` permission + grantor-possesses check.

4. **Backend: Privilege escalation guards** — last ADMIN deactivation block; grantor-possesses enforcement; self-modify restriction.

5. **Backend: Audit events** — `user.permission_granted`, `user.permission_revoked` в AuditLog.

6. **Backend: Status reason** — `setStatus(userId, status, actorId, reason?)` с audit details.reason.

7. **Backend: UserStatus SUSPENDED** — добавить SUSPENDED в enum, login enforcement.

8. **Backend: Eligible-assignee query** — `GET /users/eligible?permission=support.case.assign` (ACTIVE users with effective permission) — R4 bridge API.

9. **Frontend: User detail/permissions UI** — effective permissions tab, grant/revoke UI, role defaults display.

10. **Frontend: Audit log viewer** — `/app/audit` page (read-only, filterable by action/user/date).

11. **Frontend: i18n** — новые ключи для grants, audit, SUSPENDED status.

12. **Tests** — backend: role defaults, user grant/revoke, effective union, unauthorized denial, privilege-escalation denial, Platform/Partner isolation, invalid permissions, audit. Frontend: permissions UI, audit viewer.

### STEP 3.12 — OUT OF SCOPE

1. Department management
2. Team management
3. Management Groups / Group 1/2/3
4. Department heads / organizational hierarchy
5. Manager/subordinate tree
6. Employee workload/performance
7. HR/payroll/shifts/attendance
8. Custom arbitrary role builder
9. Complex explicit-DENY policy engine
10. Full Partner Workforce (Step 3.12A)

### DEFERRED

1. **Step 3.12A** — Partner Multi-User Teams (partner owner/admin/manager roles, invitations)
2. **Step 3.12B** — Partner KYC/KYB Foundation
3. **Step 3.12C** — Partner Payment Capability
4. **Step 3.12D** — Notifications Foundation
5. **Step 3.12E** — Organization Capability & Navigation Access Model (role presets ↔ capabilities)
6. **Step 3.13** — Users & Access Center UI (SETTINGS page with role management)
7. **Support R4** — eligible-assignee API is a bridge dependency, not R4 implementation itself

---

## 8. Roadmap Changes

**НЕ ИЗМЕНЯЕТСЯ.** Canonical NEXT остаётся Step 3.12. Шаг не отмечен как implemented/closed.

---

## 9. Final Verdict

```
VERDICT A — STEP 3.12 SCOPE RECONCILIATION APPROVED — READY FOR IMPLEMENTATION PROMPT

Predefined role catalog:         VERIFIED (10 roles, no HEAD_OF_*)
User-specific grants:            GAP IDENTIFIED (G1, P1) → IN SCOPE
Effective permission authority:   FROZEN (role defaults ∪ user grants)
Privilege escalation rules:       FROZEN (last-ADMIN invariant, grantor-possesses)
Audit mechanism:                  FROZEN (reuse AuditLog, new action types)
Lifecycle:                        FROZEN (ACTIVE/INACTIVE/LOCKED/SUSPENDED)
Platform/Partner isolation:       VERIFIED (own-scope enforcement)
R4 bridge:                        FROZEN (eligible-assignee query endpoint)
Workforce boundary:               EXPLICIT (OUT OF SCOPE)
Material unresolved decisions:    0 (all ADs resolved)
Gaps requiring implementation:    G1–G8, G10 (all frozen in scope)

Canonical NEXT: Step 3.12 — Users & Access Completion
DO NOT AUTO-START
```
