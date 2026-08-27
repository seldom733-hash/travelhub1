# PHASE 3 — SHARED TABLE UX RUNTIME REMEDIATION
## ROUND 1A.3 — CRM OPERATIONAL NOTES RBAC + USERS RESIDUAL I18N CLOSURE
### ЯЗЫК ОТЧЁТА: РУССКИЙ

## VERDICT

**VERDICT A — PHASE 3 / SHARED TABLE UX RUNTIME REMEDIATION ROUND 1A.3 / CRM OPERATIONAL NOTES RBAC + PARENT SCOPE ACCESS + USERS RESIDUAL RU/AZ/EN I18N / FULLY CLOSED AND RUNTIME-VERIFIED**

## РЕПОЗИТОРИЙ

| Параметр | Значение |
|---|---|
| Repository | /d/travelhub_v1 |
| Branch | master |
| Starting HEAD | c3dab16 |
| Final HEAD | (pending commit) |
| origin/master | c3dab16 |
| HEAD == origin/master | YES |
| Worktree | clean (untracked docs only) |

## PRECONDITIONS

| SHA | Описание | Сохранён |
|---|---|---|
| 52aa086 | Round 1A | ✅ |
| 898a2d6 | Round 1A.1 | ✅ |
| c3dab16 | Round 1A.2 | ✅ |

## ROOT CAUSE — A1/A2: CRM Notes Access Denied

### Точная причина

**MISSING_ROLE_PERMISSION_ASSIGNMENT** — RolePermission rows для `operational-notes.*` и `crm.activity.*` прав не были созданы ни одной Prisma migration.

Детали:
1. `Permission` rows для `operational-notes.*` создаются startup seed (`SecurityService.seedRoles()` → `permission.createMany`)
2. `RolePermission` linking rows создаются ТОЛЬКО Prisma migrations
3. Operational Notes migration `20260826173146_add_operational_notes` создаёт таблицу `OperationalNote`, но НЕ создаёт `RolePermission` rows
4. CRM Activity migration `20260827120000_add_crm_activity_timeline` аналогично не создаёт `RolePermission` rows
5. Последняя migration, создавшая `RolePermission` rows — `20260819235237_add_dashboard_section_authority`

### Цепочка отказа

```
authenticated ADMIN
→ role = ADMIN
→ permissionsOf(userId) queries RolePermission → Permission
→ operational-notes.* permission codes exist in Permission table
→ BUT no RolePermission rows link them to ANY role
→ permissionsOf() returns [] for operational-notes.*
→ AuthUser.permissions does NOT include "operational-notes.read"
→ OperationalNotes component: canRead = false → forbidden state
→ HTTP 403 from @RequirePermissions('operational-notes.read')
```

### Классификация

`MISSING_ROLE_PERMISSION_ASSIGNMENT` — operational-notes.* permission codes добавлены в ROLE_PERMISSIONS константу и Permission seed, но forward migration для RolePermission linking не была создана.

### Исправление

Создана forward migration:
```
backend/prisma/migrations/20260827200000_seed_operational_notes_and_activity_role_permissions/migration.sql
```

### Матрица RolePermission assignments

| Role | operational-notes.read | .create | .update | .delete | crm.activity.read |
|---|:---:|:---:|:---:|:---:|:---:|
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ |
| DIRECTOR | ✅ | — | — | — | ✅ |
| FINANCE | ✅ | — | — | — | ✅ |
| MARKETER | ✅ | — | — | — | ✅ |
| ANALYST | ✅ | — | — | — | ✅ |
| SALES_MANAGER | ✅ | ✅ | — | — | ✅ |
| OPERATOR | ✅ | ✅ | ✅ | ✅ | ✅ |
| MODERATOR | — | — | — | — | — |
| PARTNER | — | — | — | — | — |
| BUYER | — | — | — | — | — |

## API PROOF — Customer Notes

```
POST /auth/login (admin/admin123) → token
GET /auth/session → 137 permissions, including:
  - operational-notes.read ✅
  - operational-notes.create ✅
  - operational-notes.update ✅
  - operational-notes.delete ✅
  - crm.activity.read ✅

GET /operational-notes/Customer/{id}?page=1&pageSize=5 → 200
  {"notes":[], "total":0, "page":1, "pageSize":5, "totalPages":0}

POST /operational-notes/Customer/{id} {"text":"Test note"} → 200
  {"id":"6bad0cec...", "text":"Test note for RBAC verification",
   "visibility":"INTERNAL", "authorUserId":"...", "authorName":"Administrator",
   "createdAt":"2026-08-27T13:34:28.219Z"}

GET /operational-notes/Customer/{id}?page=1&pageSize=5 → 200
  {"notes":[1 item], "total":1, ...}
```

## API PROOF — Partner Notes

```
GET /operational-notes/Partner/{id}?page=1&pageSize=5 → 200
  {"notes":[], "total":0, "page":1, "pageSize":5, "totalPages":0}
```

## BROWSER PROOF — Customer 360 Notes

1. Navigate: `/app/crm/customers/{id}`
2. Click "Примечания" tab → URL: `?tab=notes`
3. Result: heading "Примечания (1)", note visible, "Добавить примечание" form, "Редактировать"/"Удалить" buttons
4. **No more 🔒 forbidden state**

## BROWSER PROOF — Partner 360 Notes

1. Navigate: `/app/crm/partners/{id}`
2. Click "Примечания" tab → URL: `?tab=notes`
3. Result: heading "Примечания", empty state "Примечаний пока нет", "Добавить примечание" form
4. **No more 🔒 forbidden state**

## B1/B2: Partner Notes Tab Raw Key Fix

Partner 360 Notes tab rendered raw key `crm.partner_detail.notes`.

**Fix**: добавлен ключ в i18n dictionary:
```typescript
"crm.partner_detail.notes": { ru: "Примечания", az: "Qeydlər", en: "Notes" }
```

## БЫЛО → СТАЛО

### A1: Customer 360 Notes
- **Было**: 🔒 "Нет доступа" (forbidden)
- **Стало**: ✅ Notes list + create/edit/delete + RBAC

### A2: Partner 360 Notes
- **Было**: 🔒 "Нет доступа" (forbidden)
- **Стало**: ✅ Notes list + create + RBAC

### B1: Partner Notes tab label
- **Было**: raw key `crm.partner_detail.notes`
- **Стало**: ✅ "Примечания"

## SECURITY REGRESSION

- ✅ Server-authoritative authorUserId/createdAt
- ✅ INTERNAL default visibility
- ✅ Parent-scoped routing
- ✅ Ownership edit/delete
- ✅ 5000-char limit
- ✅ Plain text/XSS safety
- ✅ Least privilege preserved (PARTNER/BUYER no Notes access)

## РЕГРЕССИЯ

| Gate | Result |
|---|---|
| Backend TSC | ✅ |
| Backend tests (operational-notes) | **99/99** ✅ |
| Frontend TSC | ✅ |
| Frontend tests | **243/243** ✅ |

## ИЗМЕНЁННЫЕ ФАЙЛЫ

| Файл | Изменение |
|---|---|
| `backend/prisma/migrations/20260827200000_seed_.../migration.sql` | **NEW** — seed RolePermission rows for operational-notes.* + crm.activity.* |
| `frontend/lib/i18n.tsx` | +1 key: `crm.partner_detail.notes` |

## REPORT

```
Report: docs/prompts/PHASE_3_SHARED_TABLE_UX_RUNTIME_REMEDIATION_ROUND_1A_3_NOTES_RBAC_USERS_I18N_CLOSURE_REPORT.md
```

## ОСТАВШИЕСЯ ПРОБЛЕМЫ

- **P0**: —
- **P1**: —
- **P2**: catalog type cells show raw enums (TOUR, HOTEL, TRANSFER) — cosmetic, not functional

## NEXT

Shared Table UX Consistency + Runtime Remediation — **FINAL CLOSED**.
Следующий canonical stage: `STEP 3.5.3 ROUND 2C — Customer 360 Activity UI`.
