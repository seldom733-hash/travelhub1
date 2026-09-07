# PHASE 3 — UI-C4 — AUDIT HISTORY UNIFICATION
## AUDIT-FIRST / IMPLEMENTATION PROMPT

**Project:** TravelHub  
**Repository:** `https://github.com/seldom733-hash/travelhub1`  
**Language:** Russian  
**Mode:** Audit First  
**Current baseline:** `586ffe739855b4e29514126abfe5e95e74b398a3`

---

# 1. MANDATORY WORKFLOW

Работать строго в следующем порядке:

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

**На первом запуске НЕ изменять production code, tests, schema, API, UI и не создавать implementation commit.**

Цель первого запуска — установить фактическое состояние Audit History и подтвердить implementation scope.

---

# 2. CURRENT CANONICAL STATE

Зафиксировано:

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

Finance Center             NOT STARTED
D8                         NOT STARTED

TRUE NEXT:
UI-C4 — Audit History Unification
```

Baseline:

```text
586ffe739855b4e29514126abfe5e95e74b398a3
```

---

# 3. UI-C4 PURPOSE

UI-C4 — **Audit History Unification**.

Цель:

создать единый presentation pattern для Audit History / «Истории изменений» на canonical Commerce detail pages:

```text
Request
Order
Booking
```

Главный подтверждённый gap:

```text
Request Detail
    → Audit History отсутствует

Order Detail
    → Audit History существует

Booking Detail
    → Audit History существует
```

Следовательно, задача UI-C4 — не изобретать новый audit domain, а унифицировать существующее представление и закрыть Request gap.

---

# 4. NON-GOALS

UI-C4 НЕ должен:

- менять D7 financial-history semantics;
- объединять Audit History с Business Timeline;
- создавать новый business lifecycle;
- создавать новые statuses;
- менять Order/Booking state machines;
- менять Request state machine;
- менять финансовые формулы;
- реализовывать Finance Center;
- реализовывать D8;
- реализовывать UI-C5 Notes;
- реализовывать UI-C7 Request Actions;
- менять Product/Service Model;
- менять tenant architecture;
- менять RBAC model без доказанной необходимости;
- создавать новый audit backend только ради UI, если canonical backend уже существует;
- переносить business milestones из Timeline в Audit;
- превращать Timeline в Audit.

Ключевой принцип:

```text
BUSINESS TIMELINE ≠ AUDIT HISTORY
```

---

# 5. CANONICAL SEMANTICS

## 5.1 Business Timeline

`EntityTimeline` отвечает за:

```text
business milestones
current stage
lifecycle progression
```

Timeline — это бизнес-история процесса.

---

## 5.2 Audit History

Audit History отвечает за:

```text
what changed
who changed it
when it changed
what action/event was recorded
```

Audit должен оставаться immutable/history-oriented.

Не смешивать:

```text
business milestone
```

с:

```text
audit event
```

---

# 6. AUDIT FIRST — REQUIRED INSPECTION

До любых изменений исследовать repository.

Проверить:

```text
EntityAuditHistory
AuditHistory
Audit
history
audit events
audit log
change history
```

Найти:

- backend audit endpoints;
- backend audit services;
- DTOs;
- Prisma models;
- audit event types;
- existing frontend components;
- Order audit rendering;
- Booking audit rendering;
- Request detail implementation;
- permissions;
- tenant/workspace scoping;
- tests;
- i18n keys.

---

# 7. GIT BASELINE CHECK

Выполнить:

```bash
git rev-parse HEAD
git rev-parse origin/master
git status --porcelain=v1
git diff --check
```

Ожидается:

```text
HEAD == 586ffe739855b4e29514126abfe5e95e74b398a3
HEAD == origin/master
no tracked modifications
```

Если baseline не совпадает:

```text
STOP
```

Не выполнять:

```text
reset
restore
checkout
clean
```

без отдельного approval.

---

# 8. EXISTING AUDIT ARCHITECTURE

Определить фактическую модель.

Ответить evidence-based:

### Backend

```text
Где хранится audit?
Какой entity является owner?
Есть ли generic audit?
Есть ли entity-specific history?
Какой endpoint используется?
Какой DTO возвращается?
Какой permission требуется?
Как работает tenant/workspace isolation?
```

### Frontend

```text
Какой компонент используется Order?
Какой компонент используется Booking?
Есть ли общий component?
Есть ли duplication?
Есть ли Request implementation?
```

---

# 9. REQUEST GAP

Отдельно исследовать Request Detail.

Установить:

```text
Есть ли backend audit data?
Есть ли endpoint?
Есть ли permission?
Есть ли frontend component?
Есть ли history route?
```

Разрешены только два evidence-based результата:

### Case A — backend exists

Если canonical audit endpoint/data уже существует:

```text
UI-C4 may consume existing backend source.
```

Не создавать дублирующий backend.

### Case B — backend missing

Если audit source действительно отсутствует:

```text
BACKEND GAP
```

Не выдумывать endpoint.

Не добавлять backend implementation автоматически.

Зафиксировать gap и STOP для architecture decision / scope adjustment.

---

# 10. ORDER AUDIT

Проверить Order Detail.

Зафиксировать:

```text
source
endpoint
component
data contract
fields
sorting
pagination
permissions
tenant scope
empty state
loading state
error state
```

Особенно определить:

```text
Audit History
```

является ли:

```text
real audit
```

или фактически является:

```text
timeline / business history
```

Не принимать название компонента за доказательство семантики.

---

# 11. BOOKING AUDIT

Аналогично проверить Booking Detail.

Определить:

```text
source
endpoint
component
data contract
fields
permissions
tenant isolation
states
```

Проверить, что Booking change-history действительно соответствует Audit semantics.

---

# 12. COMMON COMPONENT DECISION

Проверить необходимость:

```text
<EntityAuditHistory />
```

или существующего эквивалента.

Общий component допустим только если:

```text
shared semantics
shared rendering grammar
shared accessibility
shared i18n
shared state handling
```

Если entity-specific differences существуют, использовать:

```text
shared shell + domain-specific adapter/data mapper
```

Не насильно объединять несовместимые business semantics.

---

# 13. CANONICAL UI-C4 TARGET

Предполагаемый target:

```text
Request Detail
├── Header
├── Main entity content
├── EntityTimeline
├── EntityAuditHistory   ← CLOSE GAP
├── Commerce Relation Chain
├── Notes
└── ...
```

Order и Booking должны перейти на тот же canonical Audit presentation pattern, если audit data contracts совместимы.

Это:

```text
UNIFIED PRESENTATION
```

а не:

```text
IDENTICAL BUSINESS DATA
```

---

# 14. AUDIT EVENT PRESENTATION

Исследовать реальные поля и определить, что можно показывать без потери semantics.

Минимальная presentation grammar:

```text
Timestamp
Actor
Action / Event
Changed entity / field, if available
Old value → New value, if available and safe
Metadata, if canonical
```

Но:

**НЕ добавлять поля, которых нет в canonical source.**

Если old/new values отсутствуют:

```text
не изобретать
```

---

# 15. SECURITY / AUTHORIZATION

Проверить:

```text
authentication
workspace context
tenant/partner scope
permission
entity ownership
```

Audit History не должен позволять:

```text
cross-tenant access
cross-workspace leakage
IDOR
```

Проверить server-side authority.

UI hiding ≠ authorization.

Если backend уже возвращает 404-like behavior для inaccessible entity — сохранить canonical behavior.

---

# 16. RBAC

Определить фактический permission для audit read.

Не создавать новый permission без необходимости.

Если используется существующий permission:

```text
reuse canonical permission
```

Если permission model недостаточна:

```text
STOP
report architecture gap
```

Не расширять RBAC самостоятельно.

---

# 17. I18N

Проверить:

```text
RU
AZ
EN
```

Для:

- title;
- event/action labels;
- empty state;
- loading;
- error;
- metadata labels;
- accessibility labels.

Не оставлять hardcoded RU strings.

Соблюдать существующий i18n architecture.

---

# 18. ACCESSIBILITY

Проверить:

```text
semantic section heading
keyboard navigation
focus behavior
screen-reader labels
contrast
interactive elements
```

Audit entries должны быть читаемы последовательно.

Если entry expandable:

```text
keyboard accessible
aria-expanded
deterministic focus
```

---

# 19. RESPONSIVE

Проверить:

```text
375
768
1024
1280
```

Audit history не должен:

```text
overflow horizontally
destroy information hierarchy
hide critical actor/time/action data
```

---

# 20. AUDIT STATES

Определить canonical behavior для:

```text
loading
loaded
empty
error
forbidden
not found
```

Не invent new semantics.

---

# 21. DEEP LINK / DETAIL ROUTES

Проверить canonical detail routes:

```text
Request
Order
Booking
```

Audit History должен работать при:

```text
direct URL
reload
browser back
browser forward
```

если это соответствует существующей detail architecture.

---

# 22. NO TIMELINE/AUDIT MERGE

Обязательная verification:

```text
Timeline remains Timeline
Audit remains Audit
```

Не:

```text
Audit events → Timeline
```

и не:

```text
Timeline milestones → Audit
```

---

# 23. NO D7 REGRESSION

D7 financial-history semantics остаются untouched.

Проверить:

```text
Order financial history
payments
refunds
due
refundable
```

UI-C4 не должен менять:

```text
max(0,total-paid)
max(0,paid-refunded)
```

или источник financial truth.

---

# 24. TEST AUDIT

Найти существующие tests:

```text
audit
history
Order detail
Booking detail
Request detail
EntityTimeline
EntityAuditHistory
RBAC
tenant isolation
```

На audit phase:

```text
DO NOT MODIFY TESTS
```

Составить:

```text
existing coverage
missing coverage
required implementation coverage
```

---

# 25. REQUIRED AUDIT MATRIX

Создать:

| Area | Request | Order | Booking | Canonical source | Gap | Action |
|---|---|---|---|---|---|---|
| Audit source | ? | ? | ? | ? | ? | ? |
| Endpoint | ? | ? | ? | ? | ? | ? |
| Permission | ? | ? | ? | ? | ? | ? |
| Tenant scope | ? | ? | ? | ? | ? | ? |
| Component | ? | ? | ? | ? | ? | ? |
| Timestamp | ? | ? | ? | ? | ? | ? |
| Actor | ? | ? | ? | ? | ? | ? |
| Action | ? | ? | ? | ? | ? | ? |
| Old/New | ? | ? | ? | ? | ? | ? |
| Loading | ? | ? | ? | ? | ? | ? |
| Empty | ? | ? | ? | ? | ? | ? |
| Error | ? | ? | ? | ? | ? | ? |
| i18n | ? | ? | ? | ? | ? | ? |
| A11y | ? | ? | ? | ? | ? | ? |

---

# 26. IMPLEMENTATION SCOPE DECISION

После audit выдать один из вариантов.

### OPTION A — UI-ONLY

Если canonical backend audit data уже существует для всех required entities:

```text
shared component
frontend integration
i18n
a11y
responsive
tests
```

### OPTION B — UI + MINIMAL BACKEND ENRICHMENT

Если backend source существует, но Request/Order/Booking DTO lacks necessary canonical fields.

Тогда явно перечислить:

```text
endpoint
DTO
query/service
permission
tenant scope
tests
```

Никаких schema changes без evidence.

### OPTION C — BACKEND GAP

Если Request audit source отсутствует.

Тогда:

```text
STOP
```

и вынести backend requirement на approval.

Не превращать UI-C4 самовольно в новый backend architecture stage.

---

# 27. STOP CONDITIONS

Немедленно STOP, если обнаружено:

```text
baseline mismatch
unexpected production modifications
missing canonical audit authority
Request audit backend отсутствует
new schema required
new permission required
tenant/RBAC ambiguity
Timeline and Audit semantics conflict
Order/Booking history is not actually audit
canonical architecture contradiction
```

В каждом случае:

```text
STOP
FINDING
EVIDENCE
IMPACT
RECOMMENDATION
```

---

# 28. AUDIT REPORT

После Audit First создать:

```text
docs/reports/PHASE_3_UI_C4_AUDIT_HISTORY_UNIFICATION_AUDIT_REPORT.md
```

Структура:

```text
1. Executive Summary
2. Baseline
3. Current Audit Architecture
4. Request Audit Gap
5. Order Audit
6. Booking Audit
7. Shared Component Analysis
8. Data Contract Matrix
9. Security / RBAC / Tenant Analysis
10. i18n / Accessibility / Responsive Analysis
11. Timeline vs Audit Separation
12. D7 Regression Boundary
13. Existing Test Coverage
14. Gaps
15. Proposed Implementation Scope
16. STOP Conditions
17. Recommendation
18. Git Evidence
19. Audit Verdict
```

---

# 29. AUDIT VERDICT

### VERDICT A — READY FOR IMPLEMENTATION

Только если:

```text
canonical audit authority proven
scope fully defined
dependencies satisfied
security semantics proven
no architecture blocker
```

### VERDICT B — VALID SYSTEM GAP

Если UI-C4 нужен, но backend/data gap требует отдельного approval.

### VERDICT C — BLOCKED

Если canonical authority/architecture/security cannot be established.

---

# 30. IMPLEMENTATION PHASE — ONLY AFTER APPROVAL

Если пользователь отдельно одобрит Audit Report и implementation scope:

```text
BEGIN IMPLEMENTATION
```

Тогда реализовать только approved scope.

Обязательные требования:

```text
shared Audit presentation
Request gap closure
Timeline/Audit separation
RU/AZ/EN
a11y
responsive
RBAC
tenant isolation
direct URL
loading/empty/error
tests
regression
```

---

# 31. QUALIFICATION

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

Проверить реальные hydrated DOM:

```text
Request Detail
Order Detail
Booking Detail
```

Проверить:

```text
Audit visible
correct entries
actor
timestamp
action
states
```

### Security

Проверить:

```text
same tenant authorized
same tenant unauthorized
wrong tenant
wrong workspace
direct URL
IDOR
```

### Regression

Проверить:

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
```

---

# 32. PRE-EXISTING FAILURES

Если обнаружен известный baseline failure:

```text
frontend/lib/i18n.tsx formatPrice NBSP
```

не приписывать его UI-C4.

Зафиксировать:

```text
baseline evidence
current evidence
causal relationship
```

Не изменять unrelated baseline behavior.

---

# 33. GIT HARD CLOSURE

После полной qualification:

```bash
git status --porcelain=v1
git diff --check
git rev-parse HEAD
git rev-parse origin/master
git log --oneline --decorate -10
```

Проверить:

```text
implementation commit
test/qualification commit
documentation/report commit
```

если такие commits предусмотрены workflow.

Final:

```text
HEAD == origin/master
WORKTREE CLEAN
```

Не объявлять stage closed при наличии незакрытого source drift.

---

# 34. FINAL REPORT

После implementation создать:

```text
docs/reports/PHASE_3_UI_C4_AUDIT_HISTORY_UNIFICATION_QUALIFICATION_REPORT.md
```

Обязательно:

```text
baseline
implementation SHA
final SHA
files changed
API evidence
security evidence
runtime evidence
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

# 35. FINAL ACCEPTANCE

UI-C4 может получить:

```text
VERDICT A — ACCEPTED
```

только если:

```text
Audit History unified
Request gap closed
Timeline ≠ Audit preserved
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

# 36. CRITICAL RULE

**Не считать существующий UI элемент Audit History только по его названию.**

Сначала доказать:

```text
source
semantics
authority
actor
timestamp
event/action
security scope
```

Только после этого принимать его как canonical Audit.

---

# 37. CURRENT COMMAND

```text
НАЧАТЬ PHASE 3 — UI-C4 — AUDIT HISTORY UNIFICATION.

AUDIT FIRST.

НЕ МЕНЯТЬ КОД.

НЕ МЕНЯТЬ TESTS.

НЕ МЕНЯТЬ SCHEMA.

НЕ МЕНЯТЬ API.

НЕ ДЕЛАТЬ COMMIT.

СНАЧАЛА ДОКАЗАТЬ CANONICAL AUDIT ARCHITECTURE
И ТОЧНЫЙ IMPLEMENTATION SCOPE.

ПОСЛЕ AUDIT — STOP И ЖДАТЬ APPROVAL.
```
