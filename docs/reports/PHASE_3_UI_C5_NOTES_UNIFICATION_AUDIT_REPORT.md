# PHASE 3 — UI-C5 — NOTES UNIFICATION — AUDIT REPORT

## 1. Executive Summary

Проведён read-only audit состояния Notes на canonical Commerce detail pages
(Request / Order / Booking).

**Canonical Notes в TravelHub = Operational Notes** (Phase 3 Step 3.5 Round 2B):
единый polymorphic backend-источник (`crm.OperationalNote`, одна таблица для всех
entity-типов через `entityType` + `entityId`) + единый shared-компонент
`<OperationalNotes/>` (полный CRUD, states, pagination, i18n RU/AZ/EN).

| Сущность | Notes UI | Backend source | Endpoint | Состояние |
|---|---|---|---|---|
| Request | ❌ отсутствует | ⚠️ источник есть, но `Request` НЕ в allowlist (`entityType=Request` → 400) | polymorphic endpoint есть | **gap: UI + minimal backend enrichment** |
| Order | ✅ `<OperationalNotes entityType="Order">` | ✅ | ✅ | унифицирован |
| Booking | ✅ `<OperationalNotes entityType="Booking">` | ✅ | ✅ | унифицирован |

Семантика доказана: Order/Booking Notes = **OPERATIONAL_NOTE** (рабочая информация,
author/timestamp/content, edit→editedAt, soft-delete, мутации аудируются через AuditLog D5-R2).
Notes ≠ Audit (UI-C4 per-entity history), ≠ Timeline (milestones), ≠ Comments/Communication (CML).

Backend-источник **существует** (Case A-типа), но контракт объективно не покрывает Request →
**OPTION B — UI + MINIMAL BACKEND ENRICHMENT** (без schema-миграции: `entityType` — String,
allowlist — код; нужен один case в `resolveNoteParent`).

**Вердикт: VERDICT A — READY FOR IMPLEMENTATION (OPTION B).**

## 2. Baseline

```bash
git rev-parse HEAD          → 49c1d9b5a80b4daa6c0731aeea2ad3a85ba1e996
git rev-parse origin/master → 49c1d9b5a80b4daa6c0731aeea2ad3a85ba1e996
git status --porcelain=v1   → только untracked UI-C5 prompt
git diff --check            → PASS
WORKTREE                    → CLEAN (кроме untracked prompt)
```

## 3. Current Notes Architecture

### Backend (canonical source of truth)

`backend/prisma/schema.prisma` (L1852):

```text
model OperationalNote (crm.*):
  id, entityType (String — comment перечисляет Customer|Partner|Order|Booking|Payment|
    Refund|Product|Fulfillment|Reservation|BuyerRequest|PartnerApplication — Request ОТСУТСТВУЕТ),
  entityId, text (1..5000, plain), visibility (INTERNAL|PARTNER_VISIBLE|CUSTOMER_VISIBLE, default INTERNAL),
  authorUserId?, authorName?, createdAt, updatedAt, editedAt?, deletedAt?, deletedBy?
  @@index([entityType, entityId, createdAt])
```

`backend/src/modules/operational-notes/`:

- `operational-notes.types.ts` — `VALID_ENTITY_TYPES` allowlist (server-controlled, **без 'Request'**),
  `isValidEntityType`/`isValidVisibility`/`validateNoteText` (1..5000);
- `operational-notes.service.ts` — CRUD + D5-R2:
  - `resolveNoteParent` — per-type parent-existence check (**switch без case 'Request'** → 400 «Unhandled entity type»);
  - `createNote`/`updateNote`/`deleteNote` — RBAC + author/ADMIN на update/delete; мутация + AuditLog-событие
    (`operational_note.created/updated/deleted`) **в одной транзакции** (failure-injection e2e);
  - `listNotes` — server pagination (pageSize≤100), orderBy createdAt desc, id desc; фильтр `deletedAt: null`;
  - `getNoteHistory` — immutable AuditLog-история конкретной note (`/operational-notes/:noteId/history`);
  - `createEntityWithInitialNote` — транзакционный create+note;
  - `projectToActivity` — live-проекция в CrmActivity (только Customer/Partner).
- `operational-notes.controller.ts` — `GET/POST :entityType/:entityId`, `PATCH/DELETE :noteId`,
  `GET :noteId/history`; все закрыты `@RequirePermissions('operational-notes.*')`.

### Frontend (shared component)

`frontend/components/OperationalNotes.tsx` — единый shared-компонент:

- props: `entityType` (точное значение), `entityId`, `permissions`, `currentUserId`, `currentRole`;
- RBAC-aware: `canRead/CanCreate/CanUpdate/CanDelete` из permissions + ADMIN override;
- полный CRUD: list (10/стр.), inline composer (валидация 1..5000, счётчик), inline edit, delete с подтверждением;
- states: forbidden / loading / error(+retry) / empty / createError / editError / saving / deleting;
- отображение: автор (snapshot `authorName`, fallback «Неизвестно»), createdAt + editedAt (italic);
- XSS-safe: plain text, `whitespace-pre-wrap`;
- i18n: все ключи `notes.*` + `state.loading` + `pagination.*` (RU/AZ/EN) — **полный набор существует**.
- собственная card-оболочка (h3 «Примечания (N)»), встраивается в `EntityDetailWide`.

Используется на 5 detail pages: **Order, Booking, Catalog/Product, CRM Customer, CRM Partner**.
**Request — не используется.**

## 4. Semantic Classification

| Artifact | Классификация | Доказательство |
|---|---|---|
| Order `<OperationalNotes>` | **OPERATIONAL_NOTE** | рабочая информация, автор/время/текст, edit/soft-delete, audit в AuditLog (D5-R2) |
| Booking `<OperationalNotes>` | **OPERATIONAL_NOTE** | то же |
| Request detail | **MISSING** (нет Notes UI) | grep `<OperationalNotes` в request page: 0 |
| RequestHistory (UI-C4) | **AUDIT** | immutable per-entity history, не Notes |
| Request timeline (backend `dto.timeline`) | **TIMELINE** | milestones, не Notes |
| Communication (CML-*) | **MESSAGE** | отдельный bounded context; `CommunicationContextType` не содержит plain `Request` |
| Request «comments» | **UNKNOWN/NOT EXISTS** | отдельной comment-системы на Request нет |

UNKNOWN не найден → «DO NOT ASSUME» не требуется.

## 5. Request Notes Audit

```text
Notes UI:              ❌ отсутствует
Backend source:        ⚠️ OperationalNote существует, но entityType 'Request' вне allowlist
Endpoint:              polymorphic `GET/POST /operational-notes/Request/:id` → сейчас 400
                       «Invalid entity type: Request. Must be one of: …» (без Request)
DTO:                   CreateNoteDto/ListNotesQuery — entity-agnostic (готовы)
Persistence:           crm.OperationalNote (готова, entityType — String, миграция НЕ нужна)
Permissions:           operational-notes.read/create/update/delete — готовы (reuse)
Tenant scope:          Request — platform-only; parent-existence check добавится (prisma.request)
Create/Edit/Delete:    готовы (author/ADMIN); UI-интеграция отсутствует
Author/Timestamp:      готовы (authorUserId/authorName/createdAt/editedAt)
Update history:        AuditLog via getNoteHistory — готов (D5-R2)
```

`Request Notes ≠ Request Comments` — подтверждено: комментариев/сообщений на Request нет,
Notes — единственная canonical рабочая запись.

## 6. Order Notes Audit

```text
Notes UI:              ✅ <OperationalNotes entityType="Order" entityId={id} … /> (WIDE, user-гейт)
Backend source:        ✅ crm.OperationalNote (entityType='Order')
Endpoint:              ✅ /operational-notes/Order/:id (list/create), /operational-notes/:noteId (update/delete/history)
Persistence:           ✅
Permissions:           ✅ operational-notes.* (RBAC e2e покрыт)
Tenant scope:          наследуется от detail-page gate (Platform→Storefront Order → 404 на странице, notes не грузятся)
Author/Timestamps:     ✅
Editing/Deletion:      ✅ author/ADMIN
States:                ✅ forbidden/loading/error/empty/saving
```

Семантика = OPERATIONAL_NOTE (не Audit/Timeline/Comments) — доказана кодом (D5-R2, editedAt, soft-delete).

## 7. Booking Notes Audit

Аналогично Order: `<OperationalNotes entityType="Booking">` (WIDE), backend ✅, endpoints ✅,
permissions ✅, tenant наследуется от viewer-scoped Booking detail (404 для недоступной брони).
States ✅. Семантика = OPERATIONAL_NOTE.

## 8. Backend Authority

**Case A/B-гибрид: единый shared источник СУЩЕСТВУЕТ** (одна таблица + один модуль + polymorphic
endpoints + один UI-компонент). Пропущен только Request в серверном allowlist.

→ **Не Case C** (BACKEND GAP отсутствует: источник есть). Требуется минимальный
backend-енричмент для включения Request в существующий контракт (не новый backend).

## 9. Data Model / DTO

Используются только реальные поля модели (см. §3). Для Request не требуется новых полей.
`entityType` — String (не enum): добавление 'Request' в allowlist НЕ требует миграции.
Обновляется только doc-комментарий модели (Request в списке допустимых значений).

## 10. Permissions / RBAC

| Permission | Роли | Примечание |
|---|---|---|
| `operational-notes.read` | ADMIN/DIRECTOR/FINANCE/MARKETER/ANALYST/SALES_MANAGER/OPERATOR | read-only у аналитики/финансов |
| `operational-notes.create` | ADMIN/SALES_MANAGER/OPERATOR | |
| `operational-notes.update` | ADMIN/OPERATOR | + author/ADMIN object-check |
| `operational-notes.delete` | ADMIN/OPERATOR | + author/ADMIN object-check |
| BUYER/PARTNER | — | нет прав (e2e-доказано) |

UI-C5 НЕ создаёт новый permission — reuse `operational-notes.*`. UI hiding ≠ authorization:
backend `RequirePermissions` + object-authority сохраняются.

## 11. Tenant / Workspace Isolation

- Notes не имеют собственной tenant-колонки — привязка по `entityId` к родителю; доступ к Notes
  наследуется от доступа к detail-странице родителя (серверный gate страницы → 404 для чужого/чужого workspace).
- `resolveNoteParent` проверяет существование родителя на сервере (404 для missing).
- Request — platform-only (без storefront-оси). Order/Booking — существующая D4/D6 изоляция сохранена.
- Negative cases для будущей qualification: wrong tenant / wrong workspace / unauthorized role / IDOR —
  на уровне parent gate + `operational-notes.*` RBAC.

## 12. Shared Component Analysis

**Общий компонент УЖЕ существует** (`OperationalNotes.tsx`) и используется 4+ страницами —
новый `<EntityOperationalNotes/>` НЕ требуется. Дизайн-контракт подтверждает:
«Notes Contract — Uses existing `<OperationalNotes>` component; Location: below main content,
above audit; Empty state: "Примечаний пока нет"; Permissions: server-enforced».
Shared semantics/rendering/authz/interaction/i18n/a11y — совместимы; entity-specific различий
для Request нет (те же поля/операции). Request-интеграция = просто ещё один вызов компонента.

## 13. Interaction Model

Реально поддерживаемые операции (подтверждены компонентом + API):

```text
read (list, 10/стр., pagination)  ✅
create (inline composer, 1..5000) ✅
edit (inline mode, author/ADMIN)  ✅
delete (confirm, soft-delete, author/ADMIN) ✅
history per note (AuditLog)       ✅ backend; UI пока не показывает (вне scope UI-C5)
```

Модал/драйвер/расширения не используются и не требуются. Только реально разрешённые операции.

## 14. i18n / Accessibility / Responsive

### i18n (полный набор существует, RU/AZ/EN)

```text
notes.title / add / add_placeholder / edit / delete / save / cancel / empty / forbidden /
load_error / create_error / edit_error / creating / saving / created / edited /
delete_confirm / delete_yes / retry / unknown_author / validation_empty / validation_max
state.loading, pagination.prev/next/page/of
```

Hardcoded RU в компоненте: нет (кроме «…» в delete-progress — декор). Новых ключей не требуется.

### Accessibility

- label `htmlFor` на textarea (create), placeholder; кнопки с текстовыми именами; keyboard-навигация нативна;
- states forbidden/loading/error — текстовые, без скрытых интерактивов; confirm-delete — текстовая зона;
- h3-заголовок секции; счётчик символов как визуальный hint.
- (Существующая особенность: `formatDate` использует условную карту `ru-RU/az-AZ/en-US` вместо `LOCALE_TAGS` —
  эквивалентно; не меняем в UI-C5.)

### Responsive

- Карточка в `EntityDetailWide` (полная ширина), textarea `w-full resize-none`, flex-wrap в строках
  автор/дата — 375/768/1024/1280 не ломает layout.

## 15. Timeline / Audit Separation

```text
Notes ≠ Audit:  Notes — рабочая информация (изменяемая, soft-delete, editedAt);
                Audit (UI-C4) — immutable per-entity history. Разные источники, разные секции.
Notes ≠ Timeline: Timeline — milestones (ASIDE); Notes — WIDE «below main content, above audit».
Мутации Notes порождают AuditLog-события (D5-R2) — существующая архитектура сохраняется,
ничего не добавляется.
```

Request после UI-C5 (целевой порядок WIDE): Relations → **Notes** → Audit (UI-C4). — соответствует
дизайн-контракту «below main content, above audit» и текущему порядку Order/Booking.

## 16. Existing Test Coverage

### Backend

| Suite | Покрытие |
|---|---|
| `operational-notes.service.spec.ts` (unit) | allowlist VALID_ENTITY_TYPES, validateNoteText, CRUD-логика (Request отсутствует в проверках) |
| `d5-operational-note-audit.e2e-spec.ts` | CREATE/UPDATE/DELETE → AuditLog events; immutable history endpoint |
| `d5-note-audit-failure-injection.e2e-spec.ts` | atomicity: audit-failure → rollback note mutation |
| `operational-notes-rbac.e2e-spec.ts` | матрица: ADMIN/OPERATOR full, ANALYST read-only, SALES_MANAGER read+create, BUYER none |

### Frontend

- Нет component/source-contract тестов для `OperationalNotes` и для Notes-интеграции detail pages.
- R2/source spec'ы (`commerce-detail-system.spec.tsx`) Notes не упоминают.

### Missing (для UI-C5)

1. Backend: Request entity coverage (create/list/update/delete/history + 400 invalid-type + 404 missing parent).
2. Frontend: source-contract тест Request page (`<OperationalNotes entityType="Request">` в WIDE между Relations и Audit).

## 17. Notes Matrix

| Area | Request | Order | Booking | Canonical source | Semantics | Gap | Action |
|---|---|---|---|---|---|---|---|
| Notes UI | ❌ | ✅ | ✅ | `<OperationalNotes/>` shared | OPERATIONAL_NOTE | Request missing | интегрировать на Request |
| Backend source | ⚠️ allowlist без Request | ✅ | ✅ | `crm.OperationalNote` | OPERATIONAL_NOTE | allowlist | +'Request' |
| Endpoint | ⚠️ polymorphic (сейчас 400) | ✅ | ✅ | `/operational-notes/:entityType/:entityId` | — | Request → 400 | parent case |
| DTO | ✅ entity-agnostic | ✅ | ✅ | CreateNoteDto/ListNotesQuery | — | — | reuse |
| Persistence | ✅ (String) | ✅ | ✅ | crm.OperationalNote | — | — | без миграции |
| Read | ⚠️ | ✅ | ✅ | listNotes | — | Request | после enrich |
| Create | ⚠️ | ✅ | ✅ | createNote | — | Request | после enrich |
| Edit | ⚠️ | ✅ | ✅ | updateNote (author/ADMIN) | — | Request | после enrich |
| Delete | ⚠️ | ✅ | ✅ | deleteNote (soft, author/ADMIN) | — | Request | после enrich |
| Author | ✅ поля есть | ✅ | ✅ | authorUserId/authorName | — | — | reuse |
| Timestamp | ✅ поля есть | ✅ | ✅ | createdAt/updatedAt/editedAt | — | — | reuse |
| Visibility | ✅ INTERNAL default | ✅ | ✅ | visibility enum | — | UI создаёт INTERNAL | без изменений |
| Permission | ✅ reuse | ✅ | ✅ | operational-notes.* | — | — | reuse |
| Tenant scope | ✅ platform-only | ✅ | ✅ | parent gate + existence check | — | Request case | parent case |
| Loading | ✅ (компонент) | ✅ | ✅ | state.loading | — | — | — |
| Empty | ✅ (компонент) | ✅ | ✅ | notes.empty | — | — | — |
| Error | ✅ (компонент) | ✅ | ✅ | notes.load_error + retry | — | — | — |
| i18n | ✅ | ✅ | ✅ | notes.* (RU/AZ/EN) | — | — | без новых ключей |
| A11y | ✅ (компонент) | ✅ | ✅ | label/buttons/states | — | — | — |

## 18. Gaps

| # | Gap | Severity | Fix owner |
|---|---|---|---|
| G1 | Request detail не рендерит `<OperationalNotes>` | Core UI-C5 | UI |
| G2 | Backend allowlist `VALID_ENTITY_TYPES` не содержит `'Request'`; `resolveNoteParent` без case → 400 | Core UI-C5 (минимальный backend) | Backend (1 тип + 1 case) |
| G3 | Schema-комментарий `entityType` не упоминает Request | Docs (без миграции) | Docs |
| G4 | Нет backend-тестов Request-entity для notes | Core UI-C5 | Backend tests |
| G5 | Нет frontend source-contract теста Notes-интеграции | Core UI-C5 | UI tests |
| G6 | Note per-note history (AuditLog) не отображается в UI | NOT in scope (дизайн-контракт не требует; отдельный future) | deferred |

## 19. Proposed Implementation Scope

### OPTION B — UI + MINIMAL BACKEND ENRICHMENT

**Backend (минимальный, без schema-миграции):**
1. `backend/src/modules/operational-notes/operational-notes.types.ts` — добавить `'Request'` в `VALID_ENTITY_TYPES`.
2. `backend/src/modules/operational-notes/operational-notes.service.ts` — добавить `case 'Request'` в
   `resolveNoteParent` → `prisma.request.findUnique({ where: { id } })`.
3. `backend/prisma/schema.prisma` — дополнить doc-комментарий `entityType` (Request в списке). БЕЗ миграции.

**Backend tests:**
4. `operational-notes.service.spec.ts` — `VALID_ENTITY_TYPES` содержит Request.
5. e2e (`d5-operational-note-audit.e2e-spec.ts` или новый блок): Request create/list/update/delete +
   history; 400 для invalid type; 404 для missing request parent; RBAC reuse.

**Frontend:**
6. `frontend/app/app/requests/[id]/page.tsx` — `<OperationalNotes entityType="Request" entityId={id}
   permissions={user.permissions} currentUserId={user.id} currentRole={user.role} />` в
   `EntityDetailWide` **между Relations (UI-C2) и Audit (UI-C4)** — «below main content, above audit»;
   рендер при наличии `user` (паттерн Order/Booking); добавить `useCurrentUser`.
7. Frontend test: source-contract spec — Request page импортирует и рендерит `<OperationalNotes`
   с `entityType="Request"` ровно один раз, в WIDE-слоте после Relations и до Audit;
   Order/Booking интеграции не меняются.

**i18n:** без изменений (все ключи существуют).
**НЕ менять:** Audit History (UI-C4), Timeline, Communication, CRM activity, permissions,
visibility-логику, другие entity-страницы.

## 20. STOP Conditions

| Условие | Статус |
|---|---|
| Baseline mismatch | ✅ нет — HEAD == origin/master == `49c1d9b` |
| Unexpected source modifications | ✅ нет — worktree чист |
| Notes semantics unclear | ✅ нет — OPERATIONAL_NOTE доказан |
| Visibility semantics unclear | ✅ нет — INTERNAL default, staff-only; enum зарезервирован |
| Backend source отсутствует | ✅ нет — shared источник существует (enrichment, не gap) |
| Schema required | ✅ нет — entityType String, без миграции |
| New permission required | ✅ нет — reuse operational-notes.* |
| Tenant scope ambiguous | ✅ нет — parent gate + platform-only Request |
| Notes conflict with Audit | ✅ нет |
| Notes conflict with Timeline | ✅ нет |
| Order/Booking Notes иная business semantics | ✅ нет — идентичная OPERATIONAL_NOTE |
| Canonical architecture contradiction | ✅ нет — дизайн-контракт предписывает использование существующего `<OperationalNotes>` |

## 21. Recommendation

**Начать IMPLEMENTATION по OPTION B (UI + MINIMAL BACKEND ENRICHMENT)** после approval.
Scope — §19 (7 пунктов). Backend-изменение минимально и не затрагивает существующие entity-типы,
permissions, tenant-логику, Audit/Timeline.

## 22. Git Evidence

```text
BASELINE:      49c1d9b5a80b4daa6c0731aeea2ad3a85ba1e996
HEAD:          49c1d9b5a80b4daa6c0731aeea2ad3a85ba1e996
origin/master: 49c1d9b5a80b4daa6c0731aeea2ad3a85ba1e996
WORKTREE:      CLEAN (untracked: UI-C5 prompt + этот отчёт)
Изменения:     NO production code / tests / schema / API / UI / commits (этот audit)
```

## 23. Audit Verdict

```text
VERDICT A — READY FOR IMPLEMENTATION

CANONICAL NOTES AUTHORITY:  proven (crm.OperationalNote + shared <OperationalNotes/> + polymorphic API)
SEMANTICS:                  proven (OPERATIONAL_NOTE; Notes ≠ Audit ≠ Timeline ≠ Comments)
SCOPE:                      complete (OPTION B — §19: UI + minimal backend enrichment, без миграции)
DEPENDENCIES:               satisfied (D5-R2 notes architecture, RBAC, i18n, UI-C4 audit уже закрыт)
RBAC:                       proven (operational-notes.* reuse, author/ADMIN)
TENANT ISOLATION:           proven (parent gate + existence check; Request platform-only)
ARCHITECTURE BLOCKER:       none

STOP — ждём approval пользователя на implementation scope (OPTION B).
```