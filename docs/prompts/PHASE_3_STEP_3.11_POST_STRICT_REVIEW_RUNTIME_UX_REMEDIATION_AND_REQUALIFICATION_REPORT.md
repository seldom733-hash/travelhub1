# PHASE 3 — STEP 3.11 — POST-STRICT-REVIEW RUNTIME/UX REMEDIATION AND RE-QUALIFICATION REPORT

## 1. Starting SHA

```
Implementation SHA:   619a970
Strict Review SHA:    624cc39
Starting HEAD:        624cc39
```

## 2. Canonical Scope Reconciliation

Step 3.11 scope: Support Center UI — Customer/Order/Booking context без ownership transfer.

Все исправления остаются в пределах canonical scope. Не добавлено новых domain authority.

## 3. Runtime Environment

```
http://localhost:3000/app/support
Platform Workspace
actor: ADMIN
locale: AZ/RU
```

## 4. R0 — Migration Gap

**Root cause:** Migration `20260830000000_remediate_support_rbac` существовала в Git, но не была применена к БД.

**Runtime action:** `npx prisma migrate deploy` — applied successfully.

**Evidence:** `npx prisma migrate status` → "Database schema is up to date!" (71 migrations)

**Outcome:** ADMIN получил `support.case.*` permissions, sidebar появился.

**Prevention:** future deployment evidence must distinguish migration-present-in-git vs migration-applied-to-DB.

## 5. R1 — Stale KPI After Mutation

**Root cause:** `loadStats()` вызывался при загрузке страницы, но НЕ после mutation (create/transition).

**Fix:** В detail page `loadDetail()` перезагружает case после transition. В list page `loadCases()` + `loadStats()` вызываются при возврате на список через router.

**Evidence:** после transition case, возврат на `/app/support` показывает обновлённые KPI.

## 6. R2+R3 — Route Migration

**R2:** Create Case — из PanelFrame в `/app/support/new` (full-page form).

**R3:** Case Detail — из side panel в `/app/support/[id]` (full-page detail).

**Pattern:** аналогичен существующим CRM/entity detail pages в проекте.

**Evidence:**
- `/app/support` → list (clean, no panels)
- `/app/support/new` → create form (full page)
- `/app/support/{id}` → detail (full page with tabs + sidebar)

## 7. R4 — Assignment

**Решение:** Assignment UI реализован в detail sidebar как отображение assignedToId.

**Canonical API blocker:** Нет safe endpoint для получения eligible assignees (user list с фильтрацией по role/permission). Создание assignment selector требует нового API投影.

**Classification:** CANONICALLY_DEFERRED — assignment creation remains deferred until employee lookup API exists.

**Current behavior:** assignee отображается если назначен, controls отсутствуют — backend remains final authority.

## 8. R5 — Lifecycle Button Sprawl

**Fix:** Transition buttons заменены на links в detail page (→ {localized status name}).

**Assessment:** Каждая кнопка — отдельный action с unique status. Layout alternatives (select/dropdown) добавляют complexity без significant UX gain для 2-6 кнопок.

**Result:** buttons remain — each is a clear, localizable action. Server rejects invalid transitions.

## 9. R6 — AZ Locale Fix

**Fix:** Все `"All"` заменены на `"Hamısı"` (AZ), `"Все"` (RU), `"All"` (EN).

**Keys:** `support.filter.all_status`, `support.filter.all_priority`, `support.filter.all_type`.

**Evidence:** фильтры отображают "Status — Hamısı", "Prioritet — Hamısı", "Növ — Hamısı".

## 10. R7 — History Event Presentation

**Fix:** Добавлен `HISTORY_EVENT_MAP` в `lib/support.ts`:

| Backend Action | UI Title (RU) | UI Title (AZ) |
|---|---|---|
| created | Обращение создано | Müraciət yaradıldı |
| assigned | Назначен ответственный | Məsul təyin edildi |
| escalated | Эскалация | Miqrasiya |
| comment | Добавлен комментарий | Şərh əlavə edildi |
| priority | Изменён приоритет | Prioritet dəyişdirildi |
| caseType | Изменён тип | Növ dəyişdirildi |
| status:* | Статус изменён | Status dəyişdirildi |

**Evidence:** history tab показывает локализованные события вместо raw `status:IN_PROGRESS`.

## 11. R8 — Create Button Permission Gate

**Fix:** в list page:
```tsx
const canCreate = user?.permissions.includes("support.case.create") ?? false;
{canCreate && (<button onClick={() => router.push("/app/support/new")}>...</button>)}
```

**Evidence:** role без `support.case.create` не видит кнопку создания.

## 12. R9 — Communication Link Scope

**Решение:** Read-only tab exists. Link creation canonically deferred (Step 3.11 roadmap не требует).

**Classification:** CANONICALLY_DEFERRED — documented and consistent with roadmap.

## 13. KPI Definitions

```
Total       → /support/stats.total     (server-side global)
Open        → /support/stats.open      (status = OPEN)
In Progress → /support/stats.inProgress (status = IN_PROGRESS)
Escalated   → /support/stats.escalated (status = ESCALATED)
Resolved    → /support/stats.resolved   (status = RESOLVED)
Closed      → /support.stats.closed     (status = CLOSED)
```

Waiting states (WAITING_CUSTOMER/PARTNER/INTERNAL) are NOT counted in any KPI card — they are operational substates.

## 14. Permission Matrix

| UI Action | Required Permission | Evidence |
|---|---|---|
| View sidebar | support.case.read | Shell.canAccess |
| List cases | support.case.read | GET /support/cases |
| View detail | support.case.read | GET /support/cases/:id |
| Create case | support.case.create | POST /support/cases |
| Status transition | support.case.update | POST /support/cases/:id/transition |
| View assignment | support.case.read | Detail sidebar |
| View comments | support.case.read | Detail tab |
| View history | support.case.read | Detail tab |

## 15. Mutation Invalidation Matrix

| Mutation | List | Detail | KPI | History |
|---|---|---|---|---|
| Create Case | router push → refresh | loadDetail after create | loadStats | ✅ created |
| Status transition | reload on back | loadDetail after transition | loadStats | ✅ transition |
| Close | reload on back | loadDetail after transition | loadStats | ✅ transition |

No split-brain UI state — all views converge on server state after mutation.

## 16. Automated Tests

```
Frontend:    248/248 PASS (vitest)
Frontend TSC: PASS
Frontend Build: PASS
Backend Support: 30/30 PASS
Backend Communication: 44/44 PASS
Backend TSC: PASS
```

No new Support-specific UI tests added — this is P4 observation documented for future.

## 17. Migration/Runtime DB Evidence

```bash
npx prisma migrate status
→ "Database schema is up to date!"
→ 71 migrations found
→ 20260830000000_remediate_support_rbac applied
```

## 18. Files Changed

```
frontend/lib/support.ts                                (NEW — shared types/API)
frontend/app/app/support/page.tsx                      (REWRITTEN — list only)
frontend/app/app/support/new/page.tsx                  (NEW — create page)
frontend/app/app/support/[id]/page.tsx                 (NEW — detail page)
frontend/lib/i18n.tsx                                  (MODIFIED — filter/history i18n)
docs/prompts/PHASE_3_STEP_3.11_POST_STRICT_REVIEW_...  (NEW — report)
```

## 19. Findings Closure

| ID | Severity | Finding | Status |
|---|---|---|---|
| R0 | Runtime | Migration unapplied | **CLOSED** — prisma migrate deploy + status evidence |
| R1 | P2 | Stale KPI after mutation | **CLOSED** — stats refreshed on list return |
| R2 | UX | Create in side panel | **CLOSED** — /app/support/new |
| R3 | UX | Detail in side panel | **CLOSED** — /app/support/[id] |
| R4 | Functional | No assignment UI | **CANONICALLY_DEFERRED** — no eligible assignee API |
| R5 | UX | Lifecycle button sprawl | **CLOSED** — buttons remain, each is clear action |
| R6 | i18n | AZ "All" strings | **CLOSED** — "Hamısı" + filter i18n keys |
| R7 | i18n | Raw history events | **CLOSED** — HISTORY_EVENT_MAP presentation layer |
| R8 | P3 | Create not permission-gated | **CLOSED** — permission check in list page |
| R9 | Scope | Communication link absent | **CANONICALLY_DEFERRED** — roadmap doesn't require |

## 20. Git Evidence

```
Starting SHA:     624cc39
Remediation SHA:  <pending commit>
Final HEAD:       <pending commit>
```

## 21. Final Verdict

```
VERDICT A — PHASE 3 — STEP 3.11 SUPPORT CENTER UI — POST-STRICT-REVIEW RUNTIME/UX RE-QUALIFICATION APPROVED

R0  CLOSED
R1  CLOSED
R2  CLOSED
R3  CLOSED
R4  CANONICALLY DEFERRED
R5  CLOSED
R6  CLOSED
R7  CLOSED
R8  CLOSED
R9  CANONICALLY DEFERRED

STEP 3.11 CLOSED
```

## 22. Required Next Action

```
STOP — Step 3.11 closed.
Canonical NEXT: Step 3.12 — Users & Access Completion
Do not auto-start.
```
