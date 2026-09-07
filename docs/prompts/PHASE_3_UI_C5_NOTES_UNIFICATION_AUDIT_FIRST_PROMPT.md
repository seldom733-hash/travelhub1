# PHASE 3 — UI-C5 — NOTES UNIFICATION
## AUDIT-FIRST / IMPLEMENTATION PROMPT

**Project:** TravelHub  
**Repository:** `https://github.com/seldom733-hash/travelhub1`  
**Language:** Russian  
**Mode:** Audit First  
**Current baseline:** `49c1d9b5a80b4daa6c0731aeea2ad3a85ba1e996`

---

## 1. MANDATORY WORKFLOW

```text
AUDIT FIRST
↓
AUDIT REPORT / FINDINGS
↓
STOP
↓
USER APPROVAL
↓
IMPLEMENTATION
↓
QUALIFICATION
↓
FINAL REPORT
↓
GIT HARD CLOSURE
↓
FINAL VERDICT
```

На первом запуске **не изменять production code, tests, schema, migrations, API, UI и не создавать implementation commit**. Первый запуск — только read-only audit.

---

## 2. CURRENT CANONICAL STATE

```text
D5                         ACCEPTED
D6                         ACCEPTED
D7                         ACCEPTED
UI-C1                     ACCEPTED
UI-C1.1                   ACCEPTED
UI-C1.2                   ACCEPTED
UI-C1.2G                  ACCEPTED
UI-C1.2H                  ACCEPTED
UI-C1.2H.1                ACCEPTED
UI-C1.2H.2                ACCEPTED
UI-C2                     ACCEPTED
UI-C4                     ACCEPTED

Finance Center             NOT STARTED
D8                         NOT STARTED

TRUE NEXT:
UI-C5 — Notes Unification
```

UI-C4 final SHA / UI-C5 baseline:

```text
49c1d9b5a80b4daa6c0731aeea2ad3a85ba1e996
```

---

## 3. PURPOSE

UI-C5 — **Notes Unification**.

Предварительный roadmap gap:

```text
Request Detail → Operational Notes отсутствуют
Order / Booking → проверить фактическое состояние
```

Это **гипотеза**, а не доказанный implementation scope. Audit First обязан установить фактическое состояние.

Цель — определить, существует ли canonical Notes capability и что именно необходимо унифицировать на:

```text
Request
Order
Booking
```

---

## 4. CRITICAL SEMANTIC DISTINCTIONS

Не смешивать:

```text
Operational Notes
Comments
Audit History
Business Timeline
CRM communication
Customer messages
Internal communication
```

Базовая проверка:

```text
Timeline
= business milestones / lifecycle progression

Audit History
= immutable record of what/who/when

Operational Notes
= operational working information attached to entity
```

Окончательная семантика Notes должна быть подтверждена repository/architecture evidence. **Не изобретать semantics.**

---

## 5. NON-GOALS

UI-C5 НЕ должен автоматически:

- менять Request/Order/Booking state machines;
- менять status enums;
- менять Audit History;
- менять Business Timeline;
- реализовывать Finance Center;
- реализовывать D8;
- реализовывать CRM;
- реализовывать Support;
- реализовывать chat/messaging;
- менять Product/Service Model;
- менять tenant architecture;
- менять RBAC без доказанной необходимости;
- создавать новый Notes backend без доказанного backend gap;
- превращать Notes в Audit;
- превращать Notes в customer communication;
- реализовывать UI-C6 или последующие stages.

---

## 6. GIT BASELINE CHECK

До исследования:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --porcelain=v1
git diff --check
```

Ожидается:

```text
HEAD == 49c1d9b5a80b4daa6c0731aeea2ad3a85ba1e996
origin/master == 49c1d9b5a80b4daa6c0731aeea2ad3a85ba1e996
WORKTREE = CLEAN
git diff --check = PASS
```

Если baseline mismatch:

```text
STOP
```

Не использовать `reset`, `restore`, `checkout`, `clean` для исправления baseline.

---

## 7. FIND CURRENT NOTES IMPLEMENTATION

Провести read-only поиск:

```text
notes
note
OperationalNotes
operational notes
comments
comment
internal note
entity notes
```

Проверить:

```text
frontend
backend
Prisma
DTO
controllers
services
routes
permissions
tests
i18n
detail pages
components
```

Не ограничиваться frontend grep.

---

## 8. REQUEST DETAIL AUDIT

Установить:

```text
Есть ли Notes UI?
Есть ли Notes backend?
Есть ли endpoint?
Есть ли DTO?
Есть ли persistence?
Есть ли permissions?
Есть ли tenant/workspace scope?
Есть ли create/edit/delete?
Есть ли author?
Есть ли timestamp?
Есть ли update history?
```

Отдельно установить, существует ли различие:

```text
Request Notes ≠ Request Comments
```

---

## 9. ORDER DETAIL AUDIT

Определить:

```text
Notes UI
Notes component
backend source
endpoint
DTO
persistence
permissions
tenant scope
author
createdAt
updatedAt
editing
deletion
empty/loading/error
```

Проверить, являются ли существующие notes действительно:

```text
Operational Notes
```

а не Audit / Timeline / Comments.

---

## 10. BOOKING DETAIL AUDIT

Аналогично определить:

```text
Notes UI
Notes component
backend source
endpoint
DTO
persistence
permissions
tenant scope
author
timestamps
editing/deletion
states
```

Проверить фактическую семантику.

---

## 11. BACKEND AUTHORITY

Найти canonical source of truth.

### Case A — shared backend notes source exists

Если один canonical backend source уже обслуживает required entities:

```text
UI-C5 = presentation unification
```

### Case B — entity-specific sources exist

Определить отдельно:

```text
Request source
Order source
Booking source
```

и возможность shared presentation layer.

### Case C — Notes backend отсутствует

Не создавать его автоматически.

Зафиксировать:

```text
BACKEND GAP
```

и STOP для scope decision.

---

## 12. DATA MODEL

Проверить существующую модель и использовать только реальные поля:

```text
note ID
entity ID
entity type
author
content
createdAt
updatedAt
deletedAt
visibility
workspace
tenant
```

Если поле отсутствует:

```text
DO NOT INVENT
```

---

## 13. OWNERSHIP / VISIBILITY

Проверить:

```text
who can read?
who can create?
who can edit?
who can delete?
```

И:

```text
internal-only
customer-visible
partner-visible
platform-visible
```

Если visibility semantics не определена архитектурой:

```text
STOP
```

---

## 14. RBAC

Определить существующие permissions:

```text
page access
read
create
edit
delete
```

Не создавать новый permission без evidence.

UI hiding ≠ authorization.

---

## 15. TENANT / WORKSPACE ISOLATION

Проверить:

```text
PLATFORM
PARTNER
tenant
workspace context
entity ownership
```

Обязательные negative cases для будущей qualification:

```text
wrong tenant
wrong workspace
unauthorized role
IDOR
```

---

## 16. COMMON COMPONENT DECISION

Проверить необходимость:

```text
<EntityOperationalNotes />
```

или существующего canonical shared component.

Общий component допустим только при совместимых:

```text
semantics
data rendering
authorization
interaction
i18n
a11y
```

При различиях:

```text
shared shell + domain-specific adapter
```

Не унифицировать только ради визуального сходства.

---

## 17. NOTES INTERACTION

Исследовать реальные supported operations.

Не предполагать CRUD.

Проверить:

```text
read
create
edit
delete
inline form
modal
drawer
composer
edit mode
confirmation
```

Включать только реально разрешённые canonical operations.

---

## 18. NOTES PRESENTATION

Определить canonical display grammar.

Минимально, если поля существуют:

```text
Author
Timestamp
Content
```

При наличии:

```text
updated marker
visibility
attachments
```

Но **не показывать поля, которых нет в source contract**.

---

## 19. STATES

Проверить реальные states:

```text
loading
loaded
empty
error
forbidden
not found
saving
save error
editing
deleting
```

Только для реально поддерживаемых interactions.

---

## 20. NOTES / AUDIT / TIMELINE SEPARATION

Обязательная проверка:

```text
Notes ≠ Audit
Notes ≠ Timeline
```

UI-C4 уже закрыл Audit History.

UI-C5 не должен:

```text
записывать Notes вместо Audit
показывать Audit как Notes
показывать Timeline как Notes
```

Если note mutation уже порождает audit event — сохранить существующую архитектуру. Не добавлять audit behavior самостоятельно без evidence.

---

## 21. I18N

Проверить:

```text
RU
AZ
EN
```

Для:

```text
section title
buttons
placeholders
empty state
errors
validation
timestamps/labels
accessibility labels
```

Не оставлять hardcoded RU strings.

---

## 22. ACCESSIBILITY

Проверить:

```text
semantic heading
form labels
keyboard navigation
focus management
screen-reader labels
aria-expanded, if applicable
button names
error association
```

---

## 23. RESPONSIVE

Проверить:

```text
375
768
1024
1280
```

Notes не должны ломать detail layout или скрывать author/time/content.

---

## 24. DETAIL ARCHITECTURE

Сохранить canonical full-page detail architecture.

Notes должны быть section внутри canonical detail shell.

Не возвращать legacy drawer/modal detail.

---

## 25. DEEP LINK / RELOAD

Проверить canonical detail routes:

```text
Request Detail
Order Detail
Booking Detail
```

и:

```text
direct URL
reload
back
forward
```

---

## 26. TEST AUDIT

Найти:

```text
notes
comments
Request detail
Order detail
Booking detail
RBAC
tenant isolation
i18n
a11y
```

На audit phase:

```text
DO NOT MODIFY TESTS
```

Составить:

```text
existing coverage
missing coverage
required future coverage
```

---

## 27. REQUIRED NOTES MATRIX

Создать:

| Area | Request | Order | Booking | Canonical source | Semantics | Gap | Action |
|---|---|---|---|---|---|---|---|
| Notes UI | ? | ? | ? | ? | ? | ? | ? |
| Backend source | ? | ? | ? | ? | ? | ? | ? |
| Endpoint | ? | ? | ? | ? | ? | ? | ? |
| DTO | ? | ? | ? | ? | ? | ? | ? |
| Persistence | ? | ? | ? | ? | ? | ? | ? |
| Read | ? | ? | ? | ? | ? | ? | ? |
| Create | ? | ? | ? | ? | ? | ? | ? |
| Edit | ? | ? | ? | ? | ? | ? | ? |
| Delete | ? | ? | ? | ? | ? | ? | ? |
| Author | ? | ? | ? | ? | ? | ? | ? |
| Timestamp | ? | ? | ? | ? | ? | ? | ? |
| Visibility | ? | ? | ? | ? | ? | ? | ? |
| Permission | ? | ? | ? | ? | ? | ? | ? |
| Tenant scope | ? | ? | ? | ? | ? | ? | ? |
| Loading | ? | ? | ? | ? | ? | ? | ? |
| Empty | ? | ? | ? | ? | ? | ? | ? |
| Error | ? | ? | ? | ? | ? | ? | ? |
| i18n | ? | ? | ? | ? | ? | ? | ? |
| A11y | ? | ? | ? | ? | ? | ? | ? |

---

## 28. SEMANTIC CLASSIFICATION

Каждый найденный Notes-like artifact классифицировать:

```text
OPERATIONAL_NOTE
COMMENT
AUDIT
TIMELINE
MESSAGE
CRM_ACTIVITY
UNKNOWN
```

Для `UNKNOWN`:

```text
DO NOT ASSUME
```

---

## 29. IMPLEMENTATION SCOPE DECISION

После audit выдать один из вариантов.

### OPTION A — UI-ONLY

Если canonical Notes backend/data/authorization уже существуют:

```text
shared Notes component
Request integration
Order integration
Booking integration
i18n
a11y
responsive
tests
```

### OPTION B — UI + MINIMAL BACKEND ENRICHMENT

Только если backend exists, но DTO/query contract объективно недостаточен.

Явно перечислить:

```text
endpoint
DTO
service/query
permission
tenant scope
tests
```

Без schema changes, если они не доказаны.

### OPTION C — BACKEND GAP

Если canonical Notes source отсутствует:

```text
STOP
```

и вынести backend requirement на отдельное approval.

---

## 30. STOP CONDITIONS

Немедленно STOP, если:

```text
baseline mismatch
unexpected source modifications
Notes semantics unclear
visibility semantics unclear
backend source отсутствует
schema required
new permission required
tenant scope ambiguous
Notes conflict with Audit
Notes conflict with Timeline
existing Order/Booking Notes имеют другую business semantics
canonical architecture contradiction
```

Формат:

```text
FINDING
EVIDENCE
IMPACT
RECOMMENDATION
STOP
```

---

## 31. AUDIT REPORT

После read-only audit создать:

```text
docs/reports/PHASE_3_UI_C5_NOTES_UNIFICATION_AUDIT_REPORT.md
```

Структура:

```text
1. Executive Summary
2. Baseline
3. Current Notes Architecture
4. Semantic Classification
5. Request Notes Audit
6. Order Notes Audit
7. Booking Notes Audit
8. Backend Authority
9. Data Model / DTO
10. Permissions / RBAC
11. Tenant / Workspace Isolation
12. Shared Component Analysis
13. Interaction Model
14. i18n / Accessibility / Responsive
15. Timeline / Audit Separation
16. Existing Test Coverage
17. Notes Matrix
18. Gaps
19. Proposed Implementation Scope
20. STOP Conditions
21. Recommendation
22. Git Evidence
23. Audit Verdict
```

---

## 32. AUDIT VERDICT

### VERDICT A — READY FOR IMPLEMENTATION

Только если:

```text
canonical Notes authority proven
semantics proven
scope complete
dependencies satisfied
RBAC proven
tenant isolation proven
no architecture blocker
```

### VERDICT B — VALID SYSTEM GAP

Notes нужны, но backend/data/authorization gap требует отдельного approval.

### VERDICT C — BLOCKED

Canonical authority or semantics cannot be established.

---

## 33. IMPLEMENTATION — ONLY AFTER APPROVAL

После отдельного approval implementation scope реализовать строго в approved boundaries.

Не расширять scope самостоятельно.

---

## 34. QUALIFICATION

После implementation:

### Static

```bash
tests
tsc
build
lint, if canonical
git diff --check
```

### Runtime

Реальные hydrated DOM:

```text
Request Detail
Order Detail
Booking Detail
```

### Security

```text
authorized same tenant
unauthorized role
wrong tenant
wrong workspace
IDOR
```

### i18n

```text
RU
AZ
EN
```

### Responsive

```text
375
768
1024
1280
```

### Regression

```text
D5
D6
D7
UI-C1
UI-C1.1
UI-C1.2
UI-C1.2G
UI-C1.2H
UI-C1.2H.1
UI-C1.2H.2
UI-C2
UI-C4
```

---

## 35. PRE-EXISTING FAILURE

Известный baseline failure:

```text
frontend/lib/i18n.tsx
formatPrice NBSP
```

Не приписывать UI-C5 без causal evidence.

---

## 36. GIT HARD CLOSURE

После полной qualification:

```bash
git status --porcelain=v1
git diff --check
git rev-parse HEAD
git rev-parse origin/master
git log --oneline --decorate -10
```

Требуется:

```text
HEAD == origin/master
WORKTREE CLEAN
```

Не объявлять UI-C5 closed при source drift.

---

## 37. FINAL REPORT

После implementation создать:

```text
docs/reports/PHASE_3_UI_C5_NOTES_UNIFICATION_QUALIFICATION_REPORT.md
```

Включить:

```text
baseline
implementation SHA
final SHA
files changed
backend/API evidence
runtime evidence
security evidence
test counts
TSC
build
i18n
a11y
responsive
regression
known baseline failures
Git closure
final verdict
```

---

## 38. FINAL ACCEPTANCE

UI-C5 может получить:

```text
VERDICT A — ACCEPTED
```

только если:

```text
Notes unified
Request gap closed
Order/Booking semantics preserved
Notes ≠ Audit
Notes ≠ Timeline
server authority preserved
RBAC preserved
tenant isolation proven
RU/AZ/EN
a11y
responsive
runtime PASS
regression PASS
Git clean
HEAD == origin/master
```

---

## 39. CURRENT COMMAND

```text
НАЧАТЬ PHASE 3 — UI-C5 — NOTES UNIFICATION.

AUDIT FIRST.

ТОЛЬКО READ-ONLY.

НЕ МЕНЯТЬ CODE.
НЕ МЕНЯТЬ TESTS.
НЕ МЕНЯТЬ SCHEMA.
НЕ МЕНЯТЬ API.
НЕ ДЕЛАТЬ COMMIT.

СНАЧАЛА ДОКАЗАТЬ:
1. ЧТО ТАКОЕ CANONICAL NOTES В TRAVELHUB;
2. ГДЕ ИСТОЧНИК ДАННЫХ;
3. КАКОВЫ SEMANTICS;
4. КАКОВЫ RBAC / TENANT RULES;
5. ЧТО ИМЕННО НУЖНО УНИФИЦИРОВАТЬ.

ПОСЛЕ AUDIT — СОЗДАТЬ AUDIT REPORT И STOP.

ЖДАТЬ APPROVAL ПОЛЬЗОВАТЕЛЯ.
```
