# PHASE 3 — UI-C2 — COMMERCE RELATION CHAIN
## AUDIT FIRST → ARCHITECTURE RECONCILIATION → APPROVAL → IMPLEMENTATION → QUALIFICATION → GIT CLOSURE

**Проект:** TravelHub  
**Stage:** `PHASE 3 — UI-C2 — Commerce Relation Chain`  
**Язык работы и отчёта:** русский  
**Режим:** `AUDIT FIRST` — сначала только анализ, затем STOP и approval  
**Канонический baseline:** `db83c448d73b9015efed173446a6edf252af2aec`  
**Предыдущий accepted stage:** `UI-C1.2H.2 — VERDICT A — ACCEPTED`

---

# 0. ROLE

Ты работаешь как Senior/Staff Full-Stack Engineer + QA/Security/Architecture Engineer проекта TravelHub.

Твоя задача — реализовать **Commerce Relation Chain** между тремя каноническими business entities:

```text
Request → Order → Booking
```

Но сначала необходимо выполнить **AUDIT FIRST**.

Не начинай реализацию до завершения audit и отдельного approval пользователя.

Не доверяй собственным предположениям.

Все архитектурные решения должны быть подтверждены:

- repository;
- существующими detail pages;
- backend/domain relations;
- Prisma schema;
- API/query services;
- существующей navigation/routing;
- принятыми D5/D6/D7 контрактами;
- Commerce Center architecture;
- accepted UI-C1 / UI-C1.2 stages.

Если доказательств недостаточно — фиксируй GAP, а не изобретай поведение.

---

# 1. CURRENT ACCEPTED STATE

На момент начала UI-C2:

```text
D5                         ACCEPTED
D6                         ACCEPTED
D7                         ACCEPTED

UI-C1                      ACCEPTED
UI-C1.1                    ACCEPTED
UI-C1.2                    ACCEPTED
UI-C1.2A                   ACCEPTED
UI-C1.2B                   ACCEPTED
UI-C1.2C                   ACCEPTED
UI-C1.2D                   ACCEPTED
UI-C1.2E                   ACCEPTED
UI-C1.2F                   ACCEPTED
UI-C1.2F.1                 ACCEPTED
UI-C1.2G                   ACCEPTED
UI-C1.2H                   ACCEPTED
UI-C1.2H.1                 ACCEPTED
UI-C1.2H.2                ACCEPTED

UI-C2                      NOT STARTED
UI-C3+                     NOT STARTED
D8                         NOT STARTED
Finance Center             NOT STARTED
```

Baseline:

```text
db83c448d73b9015efed173446a6edf252af2aec
```

Перед любыми действиями проверить:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git diff --check
git log -5 --oneline --decorate
```

Ожидается:

```text
HEAD == db83c448d73b9015efed173446a6edf252af2aec
HEAD == origin/master
source working tree = clean
```

Если baseline не совпадает или обнаружены неожиданные source changes:

**STOP.**

Не выполнять `reset`, `restore`, `checkout`, удаление или перезапись чужих изменений без явного разрешения пользователя.

---

# 2. CANONICAL PURPOSE

UI-C2 создаёт единый визуальный компонент:

```text
COMMERCE RELATION CHAIN

Request → Order → Booking
```

Цель:

показать пользователю бизнес-связь между тремя сущностями и дать безопасный переход между их canonical detail pages.

Это **presentation/navigation layer**, а не новый domain model.

---

# 3. ABSOLUTE ARCHITECTURAL PRINCIPLE

Обязательное правило:

```text
ONE BUSINESS RELATION MODEL
        ↓
ONE UI RELATION CHAIN
```

Не создавать вторую модель отношений только ради UI.

Не дублировать relation truth во frontend state.

Не вычислять существование связанных entities на frontend на основании эвристик.

Server/backend/domain остаётся источником истины о связи.

---

# 4. CANONICAL RELATION

Базовая цепочка:

```text
Request → Order → Booking
```

Однако до реализации необходимо проверить repository и установить фактическую кардинальность.

Не предполагать автоматически:

```text
1 Request = 1 Order
1 Order = 1 Booking
```

Не предполагать автоматически:

```text
каждый Request имеет Order
каждый Order имеет Booking
```

Не предполагать:

```text
Order создаётся всегда
Booking создаётся всегда
```

Нужно определить по фактическому domain/API/schema:

- Request → Order cardinality;
- Order → Booking cardinality;
- nullable relations;
- relation IDs;
- creation timing;
- conversion semantics;
- cancellation behavior;
- failed/rejected paths;
- whether multiple children are possible;
- whether relation is direct or derived through another canonical entity.

Если repository не доказывает cardinality — это GAP, который должен быть вынесен в Architecture Reconciliation.

---

# 5. WHAT UI-C2 IS NOT

UI-C2 НЕ является:

```text
new domain model
new workflow engine
new state machine
new status system
new order/booking lifecycle
new financial model
new analytics model
new CRM model
new timeline system
new audit system
new temporal visibility system
```

Не реализовывать:

```text
D8 Global Temporal Visibility
Finance Center
CRM
Sales Center redesign
Analytics redesign
PROD-01 Product/Service Model
```

Не менять:

```text
RequestStatus
OrderStatus
OrderPaymentStatus
BookingStatus
PaymentStatus
RefundStatus
```

Не вводить:

```text
PARTIALLY_CONFIRMED
```

или любые другие новые canonical statuses.

---

# 6. RELATION CHAIN VS BUSINESS TIMELINE VS AUDIT

Это три разных concepts.

## Commerce Relation Chain

Отвечает:

```text
Какие commerce entities связаны?
```

Пример:

```text
Request MKT-REQ-123
        ↓
Order MKT-ORD-456
        ↓
Booking MKT-BKG-789
```

## Business Timeline

Отвечает:

```text
На каком этапе находится business process?
Какие milestones произошли?
```

## Audit History

Отвечает:

```text
Кто?
Когда?
Что изменил?
```

Нельзя объединять их в один компонент.

Не превращать Relation Chain в Timeline.

Не превращать Relation Chain в Audit History.

---

# 7. DETAIL PAGE INTEGRATION

До реализации проверить существующие canonical detail pages:

```text
/app/requests/[id]
/app/orders/[id]
/app/bookings/[id]
```

Определить:

- где уже существует подходящее место для Relation Chain;
- какие shared layout primitives уже существуют;
- какие EntitySectionCard / EntityField / Commerce components уже доступны;
- где находится business timeline;
- где находится audit history;
- какие breadcrumbs уже используются;
- какие route patterns являются canonical;
- какие deep-link rules уже приняты.

Не создавать новый page shell.

Не дублировать существующую detail-page architecture.

---

# 8. REQUIRED UI MODEL — TO BE AUDITED FIRST

До implementation проверить и предложить конкретную структуру.

Базовая гипотеза:

```text
┌──────────────────────────────────────────────────────────────┐
│ COMMERCE RELATION CHAIN                                     │
│                                                              │
│  REQUEST            ORDER              BOOKING                │
│  MKT-REQ-123        MKT-ORD-456        MKT-BKG-789            │
│  Status             Status             Status                 │
│                                                              │
│     ───────────────→ ───────────────→                         │
└──────────────────────────────────────────────────────────────┘
```

Но **не считать эту geometry утверждённой** до audit.

Audit должен определить:

- horizontal vs vertical presentation;
- cards vs compact nodes;
- desktop behavior;
- tablet behavior;
- mobile behavior;
- current entity emphasis;
- status visibility;
- IDs;
- titles/names;
- clickable/non-clickable states;
- absent relation representation;
- disabled future relation;
- error/loading state;
- permission-hidden relation;
- unknown/not-found relation.

---

# 9. ENTITY STATES

Для каждой позиции цепочки определить реальные состояния.

Минимально исследовать:

```text
EXISTS
NOT_CREATED
NOT_LINKED
LOADING
ERROR
NOT_FOUND
FORBIDDEN / OUT OF SCOPE
```

Но не вводить эти states в domain model, если их там нет.

Это UI representation states.

Особенно проверить distinction:

```text
object does not exist
```

vs

```text
object exists but current user cannot access it
```

Security requirement:

```text
wrong workspace / tenant / business context
        ↓
NOT FOUND-like behavior
        ↓
NO EXISTENCE LEAKAGE
```

Не показывать relation existence через unauthorized probing.

---

# 10. CURRENT ENTITY

Chain должен понимать, с какой detail page пользователь пришёл.

Примеры:

```text
Request detail
→ Request highlighted
→ Order/Booking shown according to actual relations

Order detail
→ Order highlighted
→ Request predecessor shown if relation exists
→ Booking successor shown if relation exists

Booking detail
→ Booking highlighted
→ Order predecessor shown
→ Request predecessor shown through canonical relation if supported
```

Но фактическая direction/availability должна быть подтверждена repository.

Не делать frontend assumptions.

---

# 11. LINKING RULES

Каждая ссылка должна вести на canonical route.

Нельзя создавать:

```text
legacy drawer
duplicate detail page
special relation route
query-string pseudo-detail
```

если repository не подтверждает такую архитектуру.

Проверить:

```text
Request → /app/requests/[id]
Order   → /app/orders/[id]
Booking → /app/bookings/[id]
```

Если canonical routes отличаются — использовать фактические repository routes.

---

# 12. RELATION DATA SOURCE

Не получать relation truth через:

```text
client-side list search
client-side filtering
string matching
ID guessing
N+1 browser requests без архитектурного обоснования
```

Предпочтительно использовать:

```text
canonical detail DTO/query
existing relation fields
server-side relation query
```

Если необходим новый endpoint/query:

сначала доказать, что существующего canonical source недостаточно.

Нельзя создавать backend changes только потому, что UI удобнее так реализовать.

---

# 13. SECURITY / TENANT ISOLATION

UI-C2 должен сохранять существующие security semantics.

Проверить:

```text
PLATFORM
PARTNER
tenant scope
workspace context
RBAC
cross-context access
wrong tenant
wrong workspace
missing permission
```

Особенно:

```text
UI hiding ≠ security
```

Frontend visibility не является security boundary.

Backend остаётся authoritative.

При недоступной связанной entity не допускать existence leakage.

Проверить direct URL navigation к каждой linked entity.

---

# 14. RBAC

Audit должен определить:

- какие permissions нужны для Request detail;
- Order detail;
- Booking detail;
- может ли пользователь видеть chain node без права открыть detail;
- что происходит при отсутствии permission;
- что происходит при cross-context mismatch.

Не вводить новые permissions без необходимости.

Не менять существующую RBAC matrix в рамках UI-C2 без отдельного архитектурного обоснования.

---

# 15. STATUS DISPLAY

Relation Chain может показывать status только как presentation data.

Например:

```text
Request
MKT-REQ-123
[Подтверждена]

Order
MKT-ORD-456
[Выполнен]

Booking
MKT-BKG-789
[Подтверждена]
```

Но:

```text
status label
≠
state transition
```

Не создавать arrows/state transitions на основании визуального порядка.

Если arrow означает только relation:

```text
Request → Order
```

он допустим как relation indicator.

Если arrow визуально утверждает lifecycle transition:

```text
Request status X → Order status Y
```

не делать этого без доказательства state-machine semantics.

---

# 16. RELATION CHAIN AND STATUS SEMANTICS

Особенно проверить:

```text
Request CONVERTED
```

не означает автоматически:

```text
Booking exists
```

А:

```text
Order FULFILLED
```

не означает автоматически:

```text
Booking COMPLETED
```

Relation existence и status semantics — разные вещи.

UI должен отображать фактическую связь, а не выводить её из статуса.

---

# 17. PAYMENT / FINANCE BOUNDARY

UI-C2 не должен превращаться в Finance UI.

Не добавлять сюда:

```text
payment journal
refund workflow
commission analytics
settlement
payout
reconciliation
Finance Center
```

Если Order/Booking detail уже содержит financial information — Relation Chain только связывает entities.

Не дублировать финансовую truth.

D7 formulas remain unchanged:

```text
due=max(0,total-paid)
refundable=max(0,paid-refunded)
```

---

# 18. HELP INTEGRATION

UI-C2 может использовать уже существующий Help architecture, но Help Center не является частью relation domain.

Не создавать новый Help registry.

Если у Relation Chain появится user-facing explanatory text:

```text
→ i18n
```

а не hardcoded Russian fallback.

При необходимости Help metadata — использовать existing canonical Help Registry.

Не создавать второй dictionary.

---

# 19. I18N

Проверить RU/AZ/EN.

Все user-facing strings:

```text
Relation Chain title
entity labels
empty states
unavailable states
errors
accessibility labels
tooltips
navigation hints
```

должны проходить через i18n.

Запрещено:

```text
"Связанные объекты"
"Заявка"
"Заказ"
"Бронирование"
```

как hardcoded production UI strings, если соответствующие i18n keys должны существовать.

Не использовать:

```text
t(key) || "Русский текст"
```

как canonical fallback для user-facing UI.

---

# 20. ACCESSIBILITY

Audit должен определить accessibility contract.

Минимально проверить:

- semantic structure;
- heading hierarchy;
- links are real links;
- keyboard navigation;
- visible focus;
- screen-reader labels;
- current entity announcement;
- unavailable relation announcement;
- loading/error announcement;
- no information conveyed by color alone;
- no hover-only interaction.

Если chain является navigation landmark:

использовать semantic navigation where appropriate.

Если это content section:

использовать section semantics.

Не использовать generic clickable `<div>` вместо link/button без причины.

---

# 21. RESPONSIVE

Проверить:

```text
1680
1280
1024
768
390
375
```

Определить:

- horizontal chain behavior;
- wrapping;
- overflow;
- node compression;
- mobile layout;
- text truncation;
- ID readability;
- status readability;
- touch target size.

Не превращать registry tables в cards.

Это правило относится к registry surfaces; detail-page Relation Chain может иметь собственную responsive composition, но это должно быть явно обосновано.

---

# 22. PERFORMANCE

Audit должен проверить:

- количество relation queries;
- duplicate fetches;
- N+1 risk;
- unnecessary refetch on navigation;
- loading behavior;
- cache/revalidation behavior;
- whether relation data already exists in detail DTO.

Не добавлять новые backend queries без необходимости.

---

# 23. ERROR / EMPTY / NOT-FOUND UX

Определить отдельно:

```text
No related Order
No related Booking
Relation unavailable
Related entity not accessible
Related entity not found
Network/server error
```

Не смешивать:

```text
not created
```

с:

```text
not found
```

если backend semantics позволяют их различить.

Не показывать пользователю технические identifiers или stack traces.

---

# 24. DEEP-LINK / BROWSER BEHAVIOR

Проверить:

```text
Request detail → Order link → Order detail
Order detail → Request link → Request detail
Order detail → Booking link → Booking detail
Booking detail → Order link → Order detail
Booking detail → Request link → Request detail
```

Только те направления, которые подтверждены canonical relation model.

Проверить:

- direct URL;
- reload;
- browser back;
- browser forward;
- opening link in new tab;
- permission changes;
- wrong tenant/workspace;
- unknown ID.

---

# 25. AUDIT FIRST — REQUIRED OUTPUT

На первом проходе **НЕ менять файлы**.

Не писать production code.

Не запускать implementation tests ради получения PASS.

Можно выполнять только read-only inspection:

```bash
git status
git log
git diff
rg
cat
sed
find
repository inspection
schema inspection
API/query inspection
```

Audit должен выдать:

## A. Current Architecture

Что существует сейчас.

## B. Relation Source Matrix

Таблица:

| Relation | Source | Cardinality | Current UI access | Evidence |
|---|---|---|---|---|
| Request → Order | ? | ? | ? | ? |
| Order → Booking | ? | ? | ? | ? |
| Booking → Order | ? | ? | ? | ? |
| Order → Request | ? | ? | ? | ? |
| Booking → Request | ? | ? | ? | ? |

## C. Detail Page Matrix

| Entity | Canonical route | Detail DTO/source | Current relation data | Gap |
|---|---|---|---|---|
| Request | ? | ? | ? | ? |
| Order | ? | ? | ? | ? |
| Booking | ? | ? | ? | ? |

## D. Security Matrix

| Scenario | Expected | Current | Gap |
|---|---|---|---|
| same tenant | accessible | ? | ? |
| wrong tenant | 404-like | ? | ? |
| wrong workspace | 404-like | ? | ? |
| missing permission | ? | ? | ? |
| direct URL | ? | ? | ? |

## E. UX Gap Matrix

Проверить:

```text
chain placement
node design
current-node emphasis
relation arrows
status display
empty states
not-created states
permission states
mobile
a11y
i18n
loading
error
deep links
```

## F. Backend Gap Matrix

Явно показать:

```text
NO CHANGE REQUIRED
```

или:

```text
MINIMAL QUERY/DTO GAP
```

или:

```text
ARCHITECTURAL BLOCKER
```

Не изменять backend на этом этапе.

## G. Risk Register

Минимально:

```text
R1 relation cardinality ambiguity
R2 frontend-derived relation truth
R3 existence leakage
R4 duplicate backend queries
R5 status/relation semantic confusion
R6 responsive composition
R7 permission asymmetry
R8 legacy detail navigation
```

## H. Proposed Architecture

После audit предложить:

- component location;
- component API;
- relation DTO shape if needed;
- data ownership;
- route strategy;
- loading/error states;
- responsive model;
- accessibility model;
- i18n keys;
- test strategy.

---

# 26. ARCHITECTURE APPROVAL GATE

После Audit First STOP.

Не начинать implementation.

В отчёте должно быть явно:

```text
AUDIT FIRST — COMPLETE

PRODUCTION CODE CHANGES:
NONE

TEST CHANGES:
NONE

IMPLEMENTATION:
NOT STARTED

USER APPROVAL REQUIRED
```

Затем задать пользователю конкретный вопрос:

```text
Approve UI-C2 architecture and implementation plan?
```

Если найдены архитектурные gaps, перечислить их.

Не считать молчание approval.

---

# 27. IMPLEMENTATION — ONLY AFTER APPROVAL

После approval реализовать только утверждённую архитектуру.

Предпочтительно:

```text
shared Commerce Relation Chain component
        ↓
Request Detail
Order Detail
Booking Detail
```

Но конкретное место и API определить по audit.

Не дублировать chain markup в трёх страницах, если shared component возможен.

---

# 28. TESTS

Обязательны:

## Unit

- relation mapping;
- current-node selection;
- absent relation;
- invalid/unknown relation;
- state rendering;
- i18n keys;
- accessibility semantics.

## Component

- Request current;
- Order current;
- Booking current;
- existing relation;
- missing relation;
- unavailable relation;
- loading;
- error;
- keyboard;
- link targets.

## Integration / API

Если relation DTO/query changes:

- correct tenant;
- wrong tenant;
- workspace;
- permission;
- relation consistency.

## Regression

Обязательно сохранить:

```text
D5
D6
D7
UI-C1
UI-C1.1
UI-C1.2
UI-C1.2G
UI-C1.2H
UI-C1.2H.2
```

---

# 29. BROWSER QUALIFICATION

Source tests недостаточны.

Нужен реальный authenticated browser runtime.

Проверить:

```text
Request detail
Order detail
Booking detail
```

и relation navigation.

Минимум:

```text
desktop
tablet
mobile
keyboard
locale RU
locale AZ
locale EN
console
network
direct URL
reload
back/forward
```

При необходимости использовать реальные existing representative IDs из current dataset.

Не использовать выдуманные IDs как evidence.

---

# 30. VISUAL / UX QUALIFICATION

Проверить:

```text
same component
same visual language
clear current entity
clear relation direction
no false lifecycle implication
no visual ambiguity
no overflow
no clipped labels
no inaccessible controls
```

Особенно проверить, что:

```text
Request → Order → Booking
```

выглядит как relation chain, а не как обещание того, что все три объекта обязательно существуют.

---

# 31. SECURITY QUALIFICATION

Обязательные cases:

```text
same tenant / same workspace
wrong tenant
wrong workspace
missing permission
direct URL
linked entity unavailable
```

Проверить:

```text
UI ≠ security boundary
backend remains authoritative
no existence leakage
```

---

# 32. GIT DISCIPLINE

Не коммитить случайные файлы.

Перед commit:

```bash
git status --short
git status --porcelain=v1
git diff --stat
git diff --check
```

Changed-file inventory обязателен.

После implementation:

```bash
git add <only intended files>
git commit -m "feat(ui): add commerce relation chain"
git push origin master
```

После push:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline --decorate
```

Требуется:

```text
porcelain = NO OUTPUT
HEAD == origin/master
```

---

# 33. REQUIRED QUALIFICATION REPORT

Создать:

```text
docs/reports/PHASE_3_UI_C2_COMMERCE_RELATION_CHAIN_QUALIFICATION_REPORT.md
```

Отчёт преимущественно на русском.

Обязательные разделы:

```text
1. Executive Summary
2. Stage / Baseline
3. Audit First Findings
4. Architecture Reconciliation
5. Canonical Relation Model
6. Relation Source Matrix
7. Detail Page Integration
8. Component Architecture
9. State Model
10. Routing / Deep Links
11. RBAC / Tenant Isolation
12. i18n
13. Accessibility
14. Responsive Qualification
15. Unit / Component Tests
16. Browser Runtime Qualification
17. Regression Matrix
18. Changed Files
19. Security Findings
20. Known / Pre-existing Failures
21. Git Hard Closure
22. Final Verdict
23. TRUE NEXT
```

Не скрывать failures.

Pre-existing failures должны иметь baseline evidence.

---

# 34. VERDICT A

Только если все applicable hard gates PASS:

```text
VERDICT A — PHASE 3 UI-C2
COMMERCE RELATION CHAIN — ACCEPTED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED
UI-C1.2 — ACCEPTED
UI-C1.2H.2 — ACCEPTED

UI-C2 — ACCEPTED

FINAL SHA:
<one canonical 40-char SHA>

TRUE NEXT:
<actual next stage established from accepted roadmap>

D8 — NOT STARTED
Finance Center — NOT STARTED
```

Затем:

```text
STOP
```

Не начинать следующий stage в том же run.

---

# 35. VERDICT B

Если любой hard gate не доказан:

```text
VERDICT B — PHASE 3 UI-C2
COMMERCE RELATION CHAIN — NOT ACCEPTED

BLOCKERS:
- <exact blocker>

UI-C2 — NOT ACCEPTED

TRUE NEXT:
UI-C2 REMEDIATION / CONTINUATION

D8 — NOT STARTED
Finance Center — NOT STARTED
```

Затем STOP.

---

# 36. HARD STOP CONDITIONS

Немедленно STOP при:

```text
baseline mismatch
unexpected source changes
unknown relation cardinality
backend/domain/schema changes required but not architecturally approved
security ambiguity
tenant leakage risk
permission ambiguity
invented relation
invented status
invented lifecycle transition
legacy route conflict
missing canonical detail route
unproven relation truth
fake browser evidence
RSC/SSR used instead of hydrated DOM
```

Не обходить blocker предположениями.

---

# 37. CRITICAL PRINCIPLES

```text
RELATION ≠ STATUS
RELATION ≠ TIMELINE
RELATION ≠ AUDIT
RELATION ≠ PAYMENT
RELATION ≠ FINANCE
RELATION ≠ D8 TEMPORAL VISIBILITY
```

И:

```text
Backend/domain
    ↓
canonical relation truth
    ↓
shared UI component
    ↓
canonical detail pages
```

Не:

```text
frontend heuristics
    ↓
invented relation
```

---

# 38. FINAL EXECUTION WORKFLOW

Строго:

```text
AUDIT FIRST
    ↓
READ-ONLY FINDINGS
    ↓
ARCHITECTURE RECONCILIATION
    ↓
IMPLEMENTATION PLAN
    ↓
STOP
    ↓
USER APPROVAL
    ↓
IMPLEMENTATION
    ↓
TESTS
    ↓
STATIC VERIFICATION
    ↓
BROWSER RUNTIME
    ↓
SECURITY / TENANT
    ↓
REGRESSION
    ↓
QUALIFICATION REPORT (.md)
    ↓
GIT HARD CLOSURE
    ↓
FINAL VERDICT
    ↓
STOP
```

# 39. IMMEDIATE NEXT ACTION

**Сейчас выполнить только AUDIT FIRST.**

Не изменять production code.

Не изменять tests.

Не создавать implementation commit.

Не начинать D8.

Не начинать Finance Center.

Не начинать UI-C3+.

После audit показать:

```text
AUDIT FINDINGS
RELATION MATRIX
ARCHITECTURE GAPS
PROPOSED UI-C2 ARCHITECTURE
IMPLEMENTATION PLAN
RISKS
```

и **STOP на approval gate**.
