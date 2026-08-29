# PHASE 3 — STEP 3.11 — ЦЕЛЕВАЯ РЕМЕДИАЦИЯ R5/R10–R14 — ОТЧЁТ

## 1. Starting SHA

```
755c3d8
```

## 2. Gap Audit (аудит пропусков)

Предыдущие версии Step 3.11 содержали:
- **R5**: lifecycle actions как набор кнопок → заменено на dropdown
- **R10**: только 6 KPI (без WAITING aggregate) → добавлены 7 KPI
- **R11**: приоритет не редактировался из UI → добавлен dropdown
- **R12**: нет inline edit mode → добавлен edit panel
- **R13**: нет мягкого удаления → добавлено ADMIN-only soft delete
- **R14**: неполный CaseHistory (без title/description/delete) → дополнено

## 3. R5 — Status Dropdown

**Решение**: lifecycle кнопки заменены на compact dropdown, визуально идентичный фильтрам:
```
Статус
[ В работе ▼ ]
  Ожидает клиента
  Ожидает партнёра
  ...
```

**Правила**:
- показывает только canonically permitted next transitions
- backend остаётся финальным lifecycle authority
- после мутации: detail + list + KPI + history refresh
- stale 422 обрабатывается без false success

**Статус**: R5 CLOSED

## 4. R10 — Complete KPI Coverage

**Модель KPI (7 карточек)**:
```
Всего | Открытые | В работе | Ожидают | Эскалированные | Решённые | Закрытые
```

**WAITING aggregate**:
```
WAITING = WAITING_CUSTOMER + WAITING_PARTNER + WAITING_INTERNAL
```

**Invariant** (для non-deleted):
```
TOTAL = OPEN + IN_PROGRESS + WAITING_CUSTOMER + WAITING_PARTNER
      + WAITING_INTERNAL + ESCALATED + RESOLVED + CLOSED
```

**Backend**: `getStats()` теперь исключает soft-deleted (`deletedAt: null`) и возвращает `waiting` как агрегат.

**Frontend**: KPI компонент отображает 7 карточек.

**Статус**: R10 CLOSED

## 5. R11 — Mutable Priority

**Решение**: на detail page добавлен compact dropdown:
```
Приоритет
[ Средний ▼ ]
```

**Authorization**: dropdown отображается только при `support.case.update`.

**Backend**: переиспользуется существующий `PATCH /support/cases/:id` (updateCase) с `CasePriority` enum validation.

**After mutation**: detail + list + history refresh. KPI не изменяется.

**Статус**: R11 CLOSED

## 6. R12 — Case Editing

**Решение**: кнопка «Редактировать» в header, toggle edit mode на detail page.

**Editable fields**: title, description, caseType, priority.

**Immutable fields**: code, createdAt, creator, history, deletedAt.

**Permission**: `support.case.update` (без нового права).

**Validation**: title (1–200 chars), description (≤5000), CaseType enum, CasePriority enum.

**Backend**: переиспользуется существующий `PATCH /support/cases/:id`.

**Audit**: title change → `title` history event, description change → `description` event.

**Статус**: R12 CLOSED

## 7. R13 — ADMIN Controlled Soft Deletion

**New permission**: `support.case.delete` (ADMIN only, по умолчанию).

**Schema**: добавлены `deletedAt`, `deletedBy`, `deletionReason` в Case model.

**API**: `POST /support/cases/:id/delete` (body: `{ reason: string }`).

**Material-history safeguard**:
```
commentCount + transitionCount + linkCount > 0
→ deletion blocked
→ "Close the case instead"
```

**UI**: secondary/destructive button в header (только для акторов с `support.case.delete`). Confirmation dialog с обязательным reason.

**After deletion**: redirect to `/app/support`, case absent from list/KPI.

**Migration**: `20260830100000_support_soft_delete_and_delete_permission` — applied.

**RBAC seed**: Permission + RolePermission для ADMIN only.

**Статус**: R13 CLOSED

## 8. R14 — Complete CaseHistory

**New events**:
```
title          — заголовок изменён
description    — описание изменено
case_deleted   — обращение удалено
```

**Preserved**: `previousValue` / `newValue` для structured changes.

**Localized presentation**: `HISTORY_EVENT_MAP` расширен. i18n для RU/AZ/EN.

**Safe degradation**: unknown event type → raw action string (не крашит страницу).

**Статус**: R14 CLOSED

## 9. R4 — Assignment Re-check

**Gap**: eligible-assignee API (список internal staff с role-based filtering) по-прежнему отсутствует.

**Решение**: R4 остаётся CANONICALLY DEFERRED.

## 10. Permission Matrix

| Permission | ADMIN | OPERATOR | DIRECTOR | FINANCE | ANALYST | SALES_MANAGER |
|---|---|---|---|---|---|---|
| support.case.create | ✅ | ✅ | — | — | — | — |
| support.case.read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| support.case.update | ✅ | ✅ | — | — | — | — |
| support.case.assign | ✅ | ✅ | — | — | — | — |
| **support.case.delete** | ✅ | — | — | — | — | — |

`support.case.delete` — только ADMIN. Не mass-grant.

## 11. Schema/Migration Changes

```
20260830100000_support_soft_delete_and_delete_permission
  - ALTER TABLE support.Case ADD COLUMN deletedAt/deletedBy/deletionReason
  - CREATE INDEX Case_deletedAt_idx
  - INSERT Permission support.case.delete
  - INSERT RolePermission (ADMIN only)
```

Статус: `prisma migrate status` → up to date, 72 migrations.

## 12. Automated Tests

```
Backend Support:   40/40 PASS (+10 targeted)
Backend Comm:      44/44 PASS
Backend TSC:       PASS
Frontend Tests:    248/248 PASS
Frontend TSC:      PASS
Frontend Build:    PASS
```

### Targeted tests (新增):
- getStats WAITING aggregate ✓
- getStats excludes soft-deleted ✓
- softDeleteCase success ✓
- softDeleteCase creates case_deleted audit ✓
- softDeleteCase blocks materially worked case ✓
- softDeleteCase rejects already-deleted ✓
- softDeleteCase rejects nonexistent ✓
- updateCase audits title change ✓
- updateCase audits description change ✓
- updateCase audits priority change ✓

## 13. Security / Negative Evidence

### Delete
- ADMIN + permission + valid accidental Case + reason → success ✓
- material-history safeguard → blocked with instruction ✓
- already-deleted → ValidationDomainError ✓
- nonexistent → NotFoundException ✓

### Edit
- read-only actor → no Edit UI (frontend)
- direct update without permission → 403 (backend PermissionsGuard)
- invalid enum → controlled 400/422 (class-validator)

### Priority
- unauthorized actor → 403
- invalid priority → controlled rejection (SupportCasePriority enum)

### Status
- invalid/stale transition → 422
- terminal status (CLOSED) → cannot transition

## 14. Files Changed

```
backend/prisma/schema.prisma                                        (MODIFIED — +3 soft delete fields)
backend/prisma/migrations/20260830100000_.../migration.sql          (NEW — soft delete + RBAC)
backend/src/security/permissions.constants.ts                       (MODIFIED — +support.case.delete)
backend/src/modules/support/support.service.ts                      (MODIFIED — softDelete, getStats, history)
backend/src/modules/support/support.controller.ts                   (MODIFIED — +delete endpoint)
backend/src/modules/support/support.service.spec.ts                 (MODIFIED — +10 targeted tests)
frontend/lib/support.ts                                             (MODIFIED — API methods, types)
frontend/lib/i18n.tsx                                               (MODIFIED — +i18n entries)
frontend/app/app/support/page.tsx                                   (MODIFIED — 7 KPI)
frontend/app/app/support/[id]/page.tsx                              (REWRITTEN — R5/R11/R12/R13/R14)
```

## 15. Git Evidence

```
Starting SHA:    755c3d8
Remediation SHA: <pending commit>
Final HEAD:      <pending commit>
```

## 16. Storefront Support Architecture Follow-up

Записано для будущего аудита:
- Platform Support ≠ Partner Support ≠ Storefront Customer Support
- Не реализовывать в рамках данной задачи
- Не выдавать PARTNER support.case.* permissions

## 17. Final Verdict

```
VERDICT A — PHASE 3 — STEP 3.11 SUPPORT CENTER UI — TARGETED FOLLOW-UP RE-QUALIFICATION APPROVED

R5  CLOSED — filter-style Status dropdown
R10 CLOSED — 7 KPI, WAITING aggregate, lifecycle coverage invariant
R11 CLOSED — Priority mutable, permission-safe, audited
R12 CLOSED — controlled Case editing, audited
R13 CLOSED — ADMIN-only controlled soft deletion
R14 CLOSED — complete append-only localized CaseHistory
R4  CANONICALLY DEFERRED — no eligible-assignee API

STEP 3.11 CLOSED
```

## 18. Exact Next Action

**STOP** — Step 3.11 закрыт. Ожидается запрос на Step 3.12 (Users & Access Completion) или другие задачи.
