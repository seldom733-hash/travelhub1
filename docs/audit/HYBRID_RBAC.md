# Hybrid RBAC — роли, множественные назначения и временные замещения

Дата: 2026-10-26. Статус: реализовано и проверено (unit + E2E).

## 1. Модель

```
User.roleId ───────────────► Role (primary, backward compatible)
UserRoleAssignment ────────► Role (additional, 0..N)
RolePermission ────────────► Permission (централизованный каталог)
```

- **Основная роль** остаётся `User.roleId`. Существующие назначения не
  переписываются миграцией; `/users/:id/role` по-прежнему меняет primary.
- **Дополнительные роли** — `security.UserRoleAssignment` (unique `userId+roleId`).
  Они не меняют `User.roleId`; снятие одной роли не затрагивает остальные.
- Роль общая: `RolePermission` — единственный источник прав; копий роли «под
  сотрудника» нет.
- `Role.description` — описание для UI; миграция заполняет его текущим title,
  администратор может менять permissions, не создавая новых ролей.

### Временное назначение

| Поле | Смысл |
|---|---|
| `startAt` | начало действия (по умолчанию now; можно запланировать) |
| `endAt` | окончание; `NULL` — бессрочно |
| `reason` | причина/комментарий |
| `assignedById/Name` | кто назначил |
| `revokedAt/ById` | кто и когда снял |
| `createdAt` | когда назначение создано |

Действует, если `revokedAt IS NULL AND startAt <= now AND (endAt IS NULL OR endAt > now)`.
Проверка выполняется **при каждом запросе** в `SecurityService.permissionsOf` /
`JwtAuthGuard`; фоновая задача не требуется. Истечение в открытой сессии
применяется на следующем же HTTP-запросе.

## 2. Расчёт эффективных прав

```
effectivePermissions(user) =
  permissions(primaryRole)
  ∪ permissions(activeAdditionalAssignments)
```

Права не кладутся в JWT. `JwtAuthGuard` на каждый запрос вызывает `AuthService.me`
→ `SecurityService.permissionsOf` (БД), затем `PermissionsGuard` проверяет
`user.permissions`. Поэтому:

- изменение `RolePermission` действует для всех пользователей роли сразу;
- отзыв дополнительной роли действует сразу;
- истечение `endAt` действует сразу;
- старый JWT не содержит устаревшего набора permissions.

Frontend `useCurrentUser` дополнительно перезапрашивает `/auth/session` при
focus/visibility и раз в 60 секунд, чтобы меню не оставалось устаревшим.

## 3. API

Все endpoints требуют `settings.write` (ADMIN), кроме `/auth/session`.

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/v1/users/roles` | роли, userCount, permissions, каталог permissions |
| GET | `/api/v1/users/roles/:code/history` | история изменений permissions роли |
| PUT | `/api/v1/users/roles/:code/permissions` | заменить набор permissions роли (транзакционно) |
| GET | `/api/v1/users/:id/roles` | primary + дополнительные + effective permissions |
| POST | `/api/v1/users/:id/roles` | назначить дополнительную роль (`roleCode`, `startAt?`, `endAt?`, `reason?`) |
| DELETE | `/api/v1/users/:id/roles/:assignmentId` | снять конкретное назначение |
| PATCH | `/api/v1/users/:id/role` | сменить primary (совместимость) |

Ошибки: 400 — невалидные даты/ключи; 401 — нет сессии; 403 — нет
`settings.write`; 404 — нет роли/пользователя/назначения; 409 — последний
администратор; 422 — неизвестный permission или self-assignment.

## 4. UI

- `/app/users` — таблица пользователей, кнопка **«Роли»** у каждого пользователя:
  primary, дополнительные роли, статус (ACTIVE/SCHEDULED/EXPIRED/REVOKED),
  срок, причина, кто/когда назначил, effective permissions, форма назначения
  (роль, start/end, причина), снятие отдельной роли.
- `/app/users/roles` — редактор общих ролей: список ролей и количество
  пользователей, permissions по функциональным разделам, включение/отключение,
  «весь раздел», сохранить/отменить, история изменений.
- Обе страницы проверяют `settings.write`; backend проверяет независимо.

## 5. Безопасность

- Роль/права меняет только `settings.write` (backend guard).
- Self-assignment и self-revoke запрещены (`actor.id === targetUserId` → 422).
- Нельзя снять/деактивировать последнего активного администратора
  (`settings.write`): проверяются primary + active additional roles; также
  нельзя убрать `settings.write` из роли, если это оставит платформу без админа.
- Неизвестные permission codes → 422 до записи; неизвестные роли → 400/404.
- Назначение/снятие/изменение прав — в транзакции + AuditLog:
  `user.role_assigned`, `user.role_assignment_updated`, `user.role_revoked`,
  `role.permissions_updated`, `user.role_changed`.
- `UserRoleAssignment` имеет unique `(userId, roleId)`; назначение использует
  атомарный upsert — конкурентные дубли не создают вторую строку.
- Primary role остаётся типом аккаунта/объектным scope (`PARTNER` → partnerId,
  `BUYER` → customerId); дополнительные роли дают операционные permissions, но
  не расширяют tenant/object scope. Это осознанное разделение business type и
  operation permission.

## 6. Миграция

`20261026060000_hybrid_rbac`:

- `security.Role.description` (nullable, backfill = title);
- таблица `security.UserRoleAssignment`, unique `(userId, roleId)`, индексы,
  FK user (cascade) / role (restrict);
- существующие `User.roleId` не меняются — это и есть сохранённые исходные
  назначения; backfill дополнительных строк не нужен.

Миграция аддитивная, применена к dev и `*_test`; staging/prod не затрагивались.

## 7. Тесты

- Unit: `backend/src/security/hybrid-rbac.service.spec.ts` — union primary+active,
  future start, expired end, revoked, self-assignment, past endAt, unknown
  permission, last `settings.write`.
- E2E: `backend/test/hybrid-rbac.e2e-spec.ts` — вторая роль и union, снятие без
  потери primary, role permission edit в открытой сессии, temporary
  start/end без cron, critical finance permission, 401/403, self-assignment,
  last-admin (status/permission), concurrent duplicate assignment → одна строка,
  audit.
- Существующие RBAC suites (`auth-rbac`, `rbac-parity`, `rbac-actions`,
  `rbac-catalog-crm`) — PASS.

Фактические результаты: см. `TEST_REPORT.md` и `reports/hybrid-rbac-*.log`.
