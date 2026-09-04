# PHASE 3 — COMMERCE CENTER UI CONSISTENCY — DESIGN & ARCHITECTURE RECONCILIATION

## ROLE — MANDATORY

Ты работаешь как **Staff/Principal Product Architect + Enterprise SaaS UX Architect + Staff Frontend Engineer + Security/RBAC Reviewer + QA/Release Engineer**.

Это **Design & Architecture Reconciliation**, а не implementation.

Не начинать D8.
Не переписывать production UI до утверждения единого контракта.

---

# 1. CANONICAL BASELINE

Зафиксировать как уже принятый backend/business baseline:

```text
D5 — ACCEPTED
Order Full-Page Detail + server-authoritative actions/audit/mutability

D6 — ACCEPTED
Booking Full-Page Detail + state machine/audit/isolation

D7 — ACCEPTED
Payment/Refund semantics + backend-authoritative financial presentation

D7 FINAL SHA:
a57239a140452bec9dcafa859d02f1e155c3efbb

D8 — NOT STARTED
```

Нельзя ломать или переопределять:

```text
D5 Order authority
D6 Booking authority
D7 financial authority
server-side RBAC
workspace/tenant isolation
audit immutability
server-authoritative availableActions
payment/lifecycle separation
canonical full-page detail routes
```

---

# 2. PURPOSE

Сейчас Request / Order / Booking detail pages визуально и структурно разошлись.

Цель этого этапа — создать **единый Commerce Entity Detail Design Contract**, который унифицирует:

```text
Request Detail
Order Detail
Booking Detail
```

по общей оболочке, visual language, navigation, status presentation, timeline, audit, related entities, spacing, cards и responsive behavior.

При этом entity-specific business content должен остаться различным.

Принцип:

```text
UNIFIED STRUCTURE
≠
IDENTICAL BUSINESS CONTENT
```

---

# 3. KNOWN UI INCONSISTENCIES TO RECONCILE

Обязательно проанализировать текущие страницы и зафиксировать различия минимум по:

```text
page header
breadcrumbs
back navigation
entity identifier/title
status badges
payment/refund badges
actions placement
main content width
right rail
timeline/chronology
audit/change history
related entities
notes
finance section
card hierarchy
section spacing
typography
responsive behavior
empty states
loading states
error/not-found states
```

Отдельно проверить:

```text
Request currently uses its own compact/detail composition
Order uses its own full-width composition
Booking uses its own right-side chronology composition
```

Не создавать четвёртый новый layout.
Нужно выбрать один canonical design system для всех трёх.

---

# 4. TARGET — COMMERCE ENTITY DETAIL DESIGN CONTRACT

Предложить и зафиксировать canonical shell:

```text
┌──────────────────────────────────────────────────────────────┐
│ Breadcrumbs                                                  │
├──────────────────────────────────────────────────────────────┤
│ Entity ID / Title                    Status / Payment badges  │
│ Entity type                          Primary actions          │
├──────────────────────────────────────────┬───────────────────┤
│                                          │                   │
│ MAIN ENTITY CONTENT                      │ BUSINESS TIMELINE │
│                                          │                   │
│ Entity-specific cards                    │ Current stage     │
│                                          │                   │
│ Finance (where applicable)               │ Milestones        │
│                                          │                   │
├──────────────────────────────────────────┴───────────────────┤
│ COMMERCE RELATION CHAIN                                      │
│ Request → Order → Booking                                    │
├──────────────────────────────────────────────────────────────┤
│ NOTES / COMMENTS                                             │
├──────────────────────────────────────────────────────────────┤
│ AUDIT HISTORY                                                │
└──────────────────────────────────────────────────────────────┘
```

Это conceptual contract.
Можно улучшить layout, но результат должен быть один для всех 3 entity types.

---

# 5. REQUEST / ORDER / BOOKING — ENTITY-SPECIFIC CONTENT

Обязательно сохранить различия.

## Request

Request-specific blocks могут включать:

```text
client/requestor
requested service/product
supplier/provider context
offer/proposal
request handling state
conversion outcome
notes
related Order if created
```

Не добавлять Order/Booking-only data только ради визуальной симметрии.

## Order

Order-specific blocks:

```text
client
seller/partner
items/service
travelers/passengers where applicable
order lifecycle
finance
payment/refund summary
related Request
related Booking
```

Сохранить D5 canonical actions.

## Booking

Booking-specific blocks:

```text
service/product
provider
service date/time
traveler/passenger data
booking lifecycle
operational status
finance from linked Order
related Order
```

Сохранить D6 canonical actions/state-machine behavior.

---

# 6. UNIFIED HEADER CONTRACT

Определить один reusable header contract:

```text
<EntityDetailHeader />
```

Он должен поддерживать:

```text
breadcrumb
entity type
entity code/reference
primary title
lifecycle badge
payment badge if applicable
refund indicator if applicable
workspace/context if needed
primary actions
overflow actions
back navigation
```

Обязательно определить:

```text
what belongs in header
what must NOT be duplicated below
status order
badge order
action hierarchy
mobile behavior
```

---

# 7. STATUS / PAYMENT / REFUND VISUAL LANGUAGE

Создать единый visual/semantic contract.

Нужно разделять:

```text
Lifecycle status
Payment status
Refund status / refund projection
```

Не смешивать их.

Обязательно определить:

| Domain | Examples | Visual Role |
|---|---|---|
| Lifecycle | NEW / CONFIRMED / CLOSED / COMPLETED | Primary entity state |
| Payment | UNPAID / PAID / REFUNDED | Financial state |
| Refund | REQUESTED / APPROVED / PROCESSED | Refund process where exposed |

Запрещено:

```text
same badge style for semantically different domains without distinction
payment status pretending to be lifecycle
lifecycle status replacing financial status
```

---

# 8. BUSINESS TIMELINE ≠ AUDIT HISTORY

Это mandatory separation.

## Business Timeline

```text
<EntityTimeline />
```

Отвечает на вопрос:

```text
Где объект находится в бизнес-процессе?
```

Показывает:

```text
business milestones
current stage
completed stages
future stages
relevant timestamps
```

Пример:

```text
✓ Заявка создана
✓ Заказ создан
● Бронирование подтверждено
○ Услуга началась
○ Завершено
```

## Audit History

```text
<EntityAuditHistory />
```

Отвечает:

```text
Что изменилось, кто изменил, когда?
```

Показывает:

```text
immutable audit events
actor/system
timestamp
from → to
safe metadata
```

Нельзя объединять Timeline и Audit в один неструктурированный список.

---

# 9. COMMERCE RELATION CHAIN

Спроектировать reusable:

```text
<CommerceRelationChain />
```

Canonical chain:

```text
Request → Order → Booking
```

Пример:

```text
Заявка                  Заказ                   Бронирование
MKT-REQ-00000266  →     MKT-ORD-00000266  →     MKT-BKG-00000266
      ✓                      ●                       ○
```

Contract:

```text
existing entity = clickable
current entity = visually highlighted
future/not-created entity = disabled
missing entity = explicit empty/not-created state
```

Не создавать fake relationships.

Chain must be server-authoritative.

---

# 10. NOTES / COMMENTS CONTRACT

Определить единый placement и behavior:

```text
<EntityNotes />
```

Нужно зафиксировать:

```text
location on page
read vs write permissions
empty state
audit expectations
whether notes are entity-specific or shared across chain
```

Не менять текущую backend semantics без отдельного approval.

---

# 11. FINANCIAL SUMMARY CONTRACT

Reuse existing D7 authority.

```text
<FinancialSummary />
```

Frontend must remain presentation-only.

Canonical fields:

```text
totalAmount
paidAmount
refundedAmount
dueAmount
refundableAmount
currency
paymentStatus
```

Не добавлять frontend formulas.
Не переопределять D7 semantics.

Request may have no finance section if finance does not canonically apply.

---

# 12. CARD SYSTEM

Определить единый card language:

```text
section card
summary card
relation card
timeline card
audit card
empty-state card
```

Зафиксировать:

```text
border radius
padding scale
section gap
heading hierarchy
label/value spacing
icon usage
divider rules
hover behavior
click affordance
desktop/mobile width behavior
```

Не требуется pixel-perfect implementation сейчас.
Нужен design contract.

---

# 13. LAYOUT SYSTEM

Предложить canonical desktop layout.

Например:

```text
12-column grid

Main content: 8 columns
Right rail: 4 columns
```

или другой обоснованный вариант.

Определить:

```text
desktop >= 1280
tablet
mobile
sticky right rail yes/no
timeline placement on mobile
action wrapping
horizontal overflow rules
```

---

# 14. ACTIONS CONTRACT

Сохранить server-authoritative actions.

UI contract должен определить:

```text
primary action
secondary action
destructive action
overflow menu
disabled state
permission-denied state
loading state
terminal-state behavior
```

Frontend не должен сам выводить доступность action из lifecycle status.
Использовать canonical backend authority from D5/D6.

---

# 15. NAVIGATION CONTRACT

Унифицировать:

```text
breadcrumbs
Back to registry
Request → Order → Booking links
related entity links
deep-link behavior
hard refresh behavior
404/denial behavior
```

Не возвращаться к drawer-based canonical detail.

---

# 16. EMPTY / LOADING / ERROR STATES

Для всех трех entities зафиксировать единообразные состояния:

```text
loading
partial data
no notes
no related entity
no timeline events
no audit events
no financial history
forbidden
not found
cross-context hidden/not found
```

Security-sensitive state не должен раскрывать существование cross-context object.

---

# 17. KPI RECONCILIATION — DESIGN ONLY

В этот этап включить **design/semantic reconciliation**, но не implementation.

## Orders KPI

Исследовать текущие KPI cards и определить canonical semantic set.

Нельзя принимать старые labels автоматически.

Требуется таблица:

| KPI | Business meaning | Source | Exclusive/Overlapping | Filter mapping |
|---|---|---|---|---|

## Bookings KPI

Восстановить contract на уровне дизайна/семантики.

Требуется определить, какие KPI действительно нужны после D6/D7 state machine.

Potential concepts only for reconciliation, not assumptions:

```text
new / waiting handling
confirmed
awaiting payment
paid
cancelled
completed
```

Каждый KPI должен быть reconciled с реальной state machine.

## KPI rules

```text
server-authoritative counts
same filters as registry
no client-side guessed totals
clear exclusive/overlapping semantics
clickable KPI → deterministic filter
```

---

# 18. REUSABLE COMPONENT INVENTORY

Предложить final reusable component model, минимум:

```text
<EntityDetailShell />
<EntityDetailHeader />
<EntityStatusBadges />
<EntityActionBar />
<EntityTimeline />
<EntityAuditHistory />
<CommerceRelationChain />
<EntityNotes />
<FinancialSummary />
<EntitySectionCard />
<EntityEmptyState />
```

Для каждого:

| Component | Used by Request | Order | Booking | Shared data contract | Entity-specific slots |
|---|---|---|---|---|---|

---

# 19. CURRENT → TARGET RECONCILIATION MATRIX

Обязательная таблица:

| Area | Request Current | Order Current | Booking Current | Target Contract | Migration Risk |
|---|---|---|---|---|---|

Минимум строки:

```text
Header
Breadcrumb
Statuses
Actions
Main grid
Timeline
Audit
Relations
Notes
Finance
Cards
Typography
Spacing
Responsive
Loading
Error
KPI layer
```

---

# 20. DO NOT IMPLEMENT YET

На этом этапе запрещено:

```text
mass UI rewrite
new route architecture
D8
new payment/refund semantics
new Booking state machine
new Order state machine
new Request lifecycle
new permissions
new API ownership
new audit model
new frontend financial calculations
```

Разрешено только:

```text
inspect
reconcile
design
document
propose
identify exact implementation deltas
```

Если критически нужен маленький code spike для проверки feasibility — только после отдельного обоснования, не как production implementation.

---

# 21. SECURITY PRESERVATION CHECK

Обязательная таблица:

| Security Contract | Current Authority | UI Reconciliation Risk | Required Preservation |
|---|---|---|---|
| Order actions | backend | | |
| Booking actions | backend | | |
| Financial truth | backend | | |
| RBAC | backend | | |
| Tenant/workspace isolation | backend | | |
| Audit | backend immutable | | |
| Cross-context not-found | backend | | |

---

# 22. ACCEPTANCE CRITERIA FOR DESIGN RECONCILIATION

Design stage PASS only if:

```text
one canonical shell is defined
Request/Order/Booking differences are explicitly preserved
Timeline vs Audit are separated
Commerce Relation Chain is defined
header/status/action contracts are defined
financial presentation preserves D7
responsive behavior is defined
loading/error/empty states are defined
KPI semantics are reconciled at design level
reusable component inventory exists
current→target migration matrix exists
security preservation matrix exists
implementation sequence is derived
D8 remains NOT STARTED
```

---

# 23. REQUIRED IMPLEMENTATION PHASING

At end derive a safe implementation sequence.

Recommended structure:

```text
UI-C1 Shared shell + header + status system
UI-C2 Timeline + Audit visual contract implementation
UI-C3 Commerce Relation Chain
UI-C4 Request migration
UI-C5 Order migration
UI-C6 Booking migration
UI-C7 Orders KPI reconciliation implementation
UI-C8 Bookings KPI restoration + reconciliation
UI-C9 Responsive/visual polish
UI-C10 Regression + browser qualification + Git closure
```

You may refine ordering if repo dependencies justify it.

Do not implement these sub-stages yet.

---

# 24. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_COMMERCE_CENTER_UI_CONSISTENCY_DESIGN_ARCHITECTURE_RECONCILIATION_REPORT.md
```

Predominantly Russian.

Required sections:

1. Executive Summary
2. Canonical Baseline
3. Current UI Inventory
4. Request Current State
5. Order Current State
6. Booking Current State
7. Current→Target Reconciliation Matrix
8. Canonical Commerce Entity Detail Shell
9. Unified Header Contract
10. Status/Payment/Refund Visual Contract
11. Business Timeline Contract
12. Audit History Contract
13. Commerce Relation Chain
14. Notes Contract
15. Financial Summary Contract
16. Card System
17. Layout / Responsive Contract
18. Actions Contract
19. Navigation Contract
20. Empty/Loading/Error States
21. Orders KPI Semantic Reconciliation
22. Bookings KPI Semantic Reconciliation
23. Reusable Component Inventory
24. Security Preservation Matrix
25. Migration Risks
26. Proposed Implementation Phasing
27. Acceptance Matrix
28. Findings
29. Final Verdict
30. TRUE NEXT

---

# 25. DESIGN ACCEPTANCE MATRIX

Do not shorten:

| Gate | Result | Evidence |
|---|---|---|
| D5 baseline preserved | | |
| D6 baseline preserved | | |
| D7 baseline preserved | | |
| D8 not started | | |
| Request current UI inventoried | | |
| Order current UI inventoried | | |
| Booking current UI inventoried | | |
| One canonical detail shell defined | | |
| Entity-specific content preserved | | |
| Unified header contract defined | | |
| Lifecycle/payment/refund semantics separated | | |
| Unified actions placement defined | | |
| Server-authoritative actions preserved | | |
| Unified business timeline defined | | |
| Timeline separated from audit | | |
| Unified audit history defined | | |
| Commerce Relation Chain defined | | |
| Related entity navigation defined | | |
| Notes placement/contract defined | | |
| D7 financial authority preserved | | |
| Card system defined | | |
| Typography hierarchy defined | | |
| Spacing system defined | | |
| Responsive behavior defined | | |
| Loading state defined | | |
| Empty states defined | | |
| Error/not-found states defined | | |
| Cross-context no-leak behavior preserved | | |
| Orders KPI semantics reconciled | | |
| Bookings KPI semantics reconciled | | |
| KPI server-authority requirement defined | | |
| Reusable component inventory complete | | |
| Current→Target matrix complete | | |
| Security preservation matrix complete | | |
| Migration risks documented | | |
| Implementation phasing derived | | |
| No production implementation started | | |
| Report predominantly Russian | | |
| Git/report closure complete | | |

Any design-critical `NOT PROVEN` / unresolved contradiction → VERDICT B.

---

# 26. GIT / REPORT CLOSURE

Because this is design reconciliation, only documentation changes are expected unless explicitly justified.

At end:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

Commit and push report.

Required:

```text
porcelain empty
HEAD == origin/master
one canonical 40-char SHA
```

---

# 27. VERDICT A

Only if design reconciliation is complete:

```text
VERDICT A — PHASE 3 COMMERCE CENTER UI CONSISTENCY DESIGN & ARCHITECTURE RECONCILIATION PASSED

DESIGN CONTRACT — ACCEPTED

FINAL SHA:
<one canonical 40-char SHA>

TRUE NEXT:
PHASE 3 — COMMERCE CENTER UI CONSISTENCY — IMPLEMENTATION

D8 — NOT STARTED
```

Then STOP.

---

# 28. VERDICT B

If unresolved:

```text
VERDICT B — PHASE 3 COMMERCE CENTER UI CONSISTENCY DESIGN & ARCHITECTURE RECONCILIATION FAILED

DESIGN CONTRACT — NOT ACCEPTED

TRUE NEXT:
DESIGN RECONCILIATION CONTINUATION

D8 — NOT STARTED
```

List exact blockers and STOP.
