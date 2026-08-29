# PHASE 3 — STEP 3.10 — SUPPORT DOMAIN — STRICT REVIEW REPORT

## 1. Вердикт

```
VERDICT B — PHASE 3 — STEP 3.10 SUPPORT DOMAIN — STRICT REVIEW FAILED

STEP 3.10 REMAINS OPEN
NEXT ACTION: TARGETED REMEDIATION REQUIRED

Classification: RBAC SEED DEFECT + RUNTIME SECURITY GAPS
SYSTEM DEFECT: ESTABLISHED (P1)
```

## 2. Baseline

```
Step 3.10 implementation SHA:  7d638ef
Starting HEAD:                7d638ef
Final HEAD:                   7d638ef
origin/master:                7d638ef
```

## 3. Canonical Scope (из Roadmap)

```
Step 3.10 — Support Domain
Ticket/Case, priority, SLA, assignment, escalation.
```

Step 3.11 (Support Center UI) — отдельный шаг, НЕ в scope.

## 4. Domain Authority / Anti-Duplication

| Concept | Classification | Evidence |
|---|---|---|
| Customer | REUSED_CANONICAL | `customerId` ref crm.Customer (no FK) |
| Partner | REUSED_CANONICAL | indirectly via Order/Booking references |
| Order | REUSED_CANONICAL | `orderId` ref order.Order (no FK) |
| Booking | REUSED_CANONICAL | `bookingId` ref booking.Booking (no FK) |
| Communication | REUSED_CANONICAL | `CaseCommunicationLink` junction to communication.Communication |
| CRM Activity | NOT DUPLICATED | CaseHistory is Support-owned audit trail |
| Operational Notes | NOT DUPLICATED | Internal comments are CaseComment with `isInternal=true` |
| Dispute | NOT DUPLICATED | support.* ≠ finance.dispute.* |

**Результат:** duplicate domain authority не обнаружена. Support владеет только case lifecycle.

## 5. Schema Review

- `support.Case` — SUP-*, proper indexes, cross-schema refs without FK (合规 ADR-0001)
- `support.CaseComment` — FK to Case, `isInternal` flag, soft delete
- `support.CaseCommunicationLink` — unique(caseId, communicationId)
- `support.CaseHistory` — FK to Case, append-only pattern (no update/delete API)

**Нет P0/P1 в schema本身.**

## 6. Lifecycle Transition Matrix (из production code)

```
VALID_TRANSITIONS:
  OPEN → IN_PROGRESS, WAITING_CUSTOMER, WAITING_PARTNER, WAITING_INTERNAL, ESCALATED, CLOSED
  IN_PROGRESS → WAITING_CUSTOMER, WAITING_PARTNER, WAITING_INTERNAL, ESCALATED, RESOLVED, CLOSED
  WAITING_CUSTOMER → IN_PROGRESS, ESCALATED, CLOSED
  WAITING_PARTNER → IN_PROGRESS, ESCALATED, CLOSED
  WAITING_INTERNAL → IN_PROGRESS, ESCALATED, CLOSED
  ESCALATED → IN_PROGRESS, WAITING_CUSTOMER, WAITING_PARTNER, WAITING_INTERNAL, RESOLVED, CLOSED
  RESOLVED → CLOSED, OPEN (reopen)
  CLOSED → (terminal, empty array)
```

**Wait* states reachable and exitable:** ✅ Все WAITING_* → IN_PROGRESS/ESCALATED/CLOSED
**ESCALATED reachable and exitable:** ✅ ESCALATED → IN_PROGRESS/WAITING_*/RESOLVED/CLOSED
**CLOSED terminal:** ✅ `TERMINAL_STATUSES = new Set(['CLOSED'])`
**RESOLVED → OPEN reopen:** ✅ Supported (clears resolvedAt/closedAt)
**OPEN → RESOLVED rejected:** ✅ Not in OPEN transitions

**Результат:** Lifecycle graph полный, без deadlock states. ✅

## 7. RBAC Matrix

### Кодовая матрица (из permissions.constants.ts)

| Permission | ADMIN | OPERATOR | DIRECTOR | PARTNER | FINANCE |
|---|---|---|---|---|---|
| support.case.create | ✅ | ✅ | ❌ | ❌ | ❌ |
| support.case.read | ✅ | ✅ | ✅ | ❌ | ❌ |
| support.case.update | ✅ | ✅ | ❌ | ❌ | ❌ |
| support.case.assign | ✅ | ✅ | ❌ | ❌ | ❌ |

### Фактическая DB матрица (RolePermission)

```
support.case.create → 0 RolePermission rows
support.case.read   → 0 RolePermission rows
support.case.update → 0 RolePermission rows
support.case.assign → 0 RolePermission rows
```

**support.read → ADMIN, OPERATOR, DIRECTOR, FINANCE, ANALYST, SALES_MANAGER** ✅
**support.write → ADMIN, OPERATOR** ✅

### Runtime Evidence

```
POST /support/cases (ADMIN token):
  HTTP: 403
  Message: "Missing permission(s): support.case.create"

GET /support/cases (ADMIN token):
  HTTP: 403
  Message: "Missing permission(s): support.case.read"
```

**P1 FINDING: Полная RBAC деградация — ни одна роль не может использовать Support API.**

## 8. P1 — Finding Detail

### Finding F1 — P1: support.case.* RolePermission rows отсутствуют

**Требование:** подтверждённая canonical RBAC матрица должна быть позитивно доказана в DB.

**Наблюдение:** Permission rows созданы startup seed (ALL_PERMISSIONS), но RolePermission join rows НЕ созданы ни миграцией, ни seed-скриптом.

**Корневая причина:** Миграция `20260829174410_add_support_domain` создаёт schema/tables/enums, но НЕ содержит INSERT INTO RolePermission для `support.case.*` прав. Это нарушает established pattern (сравните с `20260819235237_add_dashboard_section_authority` который содержит RolePermission seed).

**Влияние:** Полная недоступность Support Domain API. Ни один internal actor (ADMIN/OPERATOR/DIRECTOR) не может создать/прочитать/обновить/nазначить case.

**Minimal remediation:** SQL-миграция для вставки RolePermission rows:
- ADMIN → support.case.create, support.case.read, support.case.update, support.case.assign
- OPERATOR → support.case.create, support.case.read, support.case.update, support.case.assign
- DIRECTOR → support.case.read

## 9. Comment Visibility — P2

### Finding F2 — P2: getCase возвращает ВСЕ комментарии включая internal

**Evidence (code):**
```ts
getCase() include: {
  comments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } }
}
```

Нет фильтрации по `isInternal`. Любой пользователь с `support.case.read` видит INTERNAL_SECRET комментарии.

**Contrast с listComments:** `listComments(caseId, includeInternal=false)` корректно фильтрует, но этот метод НЕ экспортируется через controller. Весь доступ к комментариям идёт через `getCase`.

**Minimal remediation:** либо фильтровать `isInternal: false` в `getCase` include, либо добавить отдельный endpoint `GET /cases/:id/comments` с role-based `includeInternal`.

## 10. Related Entity Integrity — P2

### Finding F3 — P2: Принятие произвольных UUID без валидации существования

**Evidence (code):**
```ts
createCase(actor, dto: CreateCaseDto) {
  // dto.customerId, dto.orderId, dto.bookingId — any UUID accepted
  const caseRecord = await prisma.case.create({
    data: { customerId: dto.customerId, orderId: dto.orderId, ... }
  });
}
```

Аналогично `updateCase`, `assignCase` — `assignedToId` не проверяется на существование/eligibility.

**Risks:**
1. Cross-scope injection: case может ссылаться на несуществующий или чужой Order/Booking
2. Assignment: можно назначить nonexistent user, PARTNER user, или BUYER как assignee
3. Orphan references: case ссылается на удалённые/несуществующие entities

**Minimal remediation:** `assertEntityExists` для customerId/orderId/bookingId при create/update. Assert user exists и имеет internal role при assign.

## 11. Escalation Path Duplication — P3

`escalateCase` (POST /cases/:id/escalate) обходит `VALID_TRANSITIONS` и устанавливает `status: 'ESCALATED'` напрямую, проверяя только `CLOSED` terminal. Это дублирует `transitionCase` (POST /cases/:id/transition) с `status: 'ESCALATED'`, который корректно проверяет `VALID_TRANSITIONS`.

**Разница:** `escalateCase` создаёт history action "escalated" с details, `transitionCase` создаёт "status:ESCALATED".

**Severity:** P3 — не blocking, но code duplication + inconsistent history format.

## 12. Validation / Error Contract

- `@IsEnum(SupportCaseType/Priority/Status)` на DTO — ✅ controller-level validation
- `VALID_TRANSITIONS` map в service — ✅ server-authoritative lifecycle
- `TERMINAL_STATUSES` check — ✅ update/escalate blocked on CLOSED
- `NotFoundException` — ✅ nonexistent case
- `ValidationDomainError` — ✅ invalid transition, terminal state update

**Результат:** Validation contract корректен. Enums валидируются до Prisma. ✅

## 13. CaseHistory Integrity

- `addHistory` — private method, только append-only через `prisma.caseHistory.create`
- Нет update/delete API для CaseHistory
- History создаётся при: created, status change, priority change, caseType change, assignment, escalation, comment
- Actor определяется из authenticated context (`actor.id`, `actor.username`) — spoofing невозможен
- Rejected actions (invalid transition, unauthorized update) НЕ создают false history

**Результат:** ✅

## 14. Communication Integration

- `CaseCommunicationLink` — junction to canonical Communication domain
- `upsert` с unique constraint (caseId, communicationId) — дублирование невозможно
- Нет bypass participant/visibility/moderation rules

**Потенциальный risk:** linkCommunication не валидирует существование communicationId. Nonexistent communication создаёт link без ошибки. Classification: P3 (orphan link, не security).

## 15. Automated Regression Evidence

```
Support tests:       24/24 PASS
Communication tests:  44/44 PASS (3 suites)
Backend TSC:          PASS (0 errors)
```

## 16. Git Evidence

```
Starting HEAD:  62828f0
Step 3.10 SHA:  7d638ef
Final HEAD:     7d638ef
origin/master:  7d638ef
HEAD == origin/master: YES ✅
```

## 17. Findings

| ID | Severity | Description | Gate |
|---|---|---|---|
| F1 | **P1** | `support.case.*` RolePermission rows отсутствуют в DB — полная RBAC деградация, Support API недоступен | RBAC hard gate |
| F2 | **P2** | `getCase` возвращает ALL comments включая internal без фильтрации по actor authority | Comment visibility gate |
| F3 | **P2** | `createCase`/`assignCase` не валидируют существование related entities (customer/order/booking/assignee) | Related entity integrity gate |
| F4 | P3 | `escalateCase` обходит `VALID_TRANSITIONS`, дублирует transition endpoint | Lifecycle consistency |
| F5 | P3 | `linkCommunication` не валидирует существование communicationId | Communication integration |

## 18. Closure Decision

```
VERDICT B — PHASE 3 — STEP 3.10 SUPPORT DOMAIN — STRICT REVIEW FAILED

STEP 3.10 REMAINS OPEN
NEXT ACTION: TARGETED REMEDIATION OF F1 (P1) + F2/F3 (P2) REQUIRED
```

F1 (P1) — blocking для любого STEP 3.10 closure. F2/F3 (P2) — runtime security gaps.
