# PHASE 3 — COMMERCE CENTER UI-C1.1 — REMEDIATION R3
## PAGE COMPOSITION & INFORMATION HIERARCHY PARITY

### IMPLEMENTATION PROMPT

---

## 0. EXECUTION MODE

Выполнить **только UI-C1.1 REMEDIATION R3**.

Цель R3 — закрыть фактический дефект, который остался после R2:

> Request Detail, Order Detail и Booking Detail используют общие UI-примитивы и часть одинаковых Tailwind tokens, но **не выглядят как страницы одного композиционного шаблона**.

R3 должен унифицировать:

- page composition;
- information hierarchy;
- column geometry;
- section-slot grammar;
- visual weight;
- card placement;
- vertical rhythm;
- equivalent component behavior at the same viewport.

R3 **НЕ должен** расширять scope до:

- UI-C1.2 Operations Center;
- Payments Center;
- новых registry KPI;
- Commerce Relation Chain;
- D8;
- pricing / commission redesign;
- новой backend/domain functionality;
- новых business statuses;
- новых permissions.

---

# 1. CANONICAL BASELINE

Считать принятыми и не переоткрывать без реальной регрессии:

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
```

UI-C1.1:

```text
R1 — VERDICT B
R2 — VERDICT B
```

R2 implementation checkpoint:

```text
6115a8a26c43b4219306cdd38ffd9c2068ca0616
```

ВАЖНО:

```text
6115a8a26c43b4219306cdd38ffd9c2068ca0616
= implementation checkpoint
≠ UI-C1.1 acceptance SHA
```

R2 successfully improved:

- shared primitives;
- typography tokens;
- localization;
- row grammar;
- locale-aware dates;
- TOTAL KPI micro-closure;
- common status rendering;
- shared timeline primitive.

Но R2 **не закрыл visual composition parity**.

---

# 2. CURRENT FAILURE — DO NOT MISINTERPRET

Текущие canonical detail pages:

```text
/app/requests/[id]
/app/orders/[id]
/app/bookings/[id]
```

Фактическое состояние после R2:

```text
REQUEST DETAIL
- преимущественно single-column
- Overview как первый основной блок
- связанные сущности отдельным full-width блоком
- supplier блок ниже
- timeline / detail context не организованы как единая contextual zone

ORDER DETAIL
- преимущественно single-column
- Finance как первый основной блок
- Relations full-width
- Timeline full-width
- actions сильно влияют на header composition

BOOKING DETAIL
- двухзонная композиция
- main content слева
- contextual sidebar справа
- Finance + Service слева
- Timeline + Details справа
```

Итог:

```text
REQUEST  = Design A
ORDER    = Design B
BOOKING  = Design C
```

Это является **FAIL**, даже если:

```text
rounded-xl
border-slate-200
p-4
gap-4
text-xs
```

совпадают.

---

# 3. ROOT CAUSE

R2 трактовал Visual Parity слишком узко:

```text
same primitives
+ same CSS tokens
= parity
```

Это недостаточно.

Canonical definition:

```text
VISUAL PARITY =
PAGE GEOMETRY
+ INFORMATION HIERARCHY
+ COLUMN SYSTEM
+ SECTION ORDER
+ SLOT GRAMMAR
+ CARD PLACEMENT
+ VISUAL WEIGHT
+ VERTICAL RHYTHM
+ TYPOGRAPHY
+ TOKENS
```

Совпадение class tokens без совпадения page skeleton НЕ является acceptance evidence.

---

# 4. CANONICAL PRINCIPLE

```text
UNIFIED STRUCTURE
≠
IDENTICAL BUSINESS CONTENT
```

И дополнительно:

```text
SAME SLOT
≠
SAME DATA
```

Request, Order и Booking обязаны сохранять собственную бизнес-семантику.

Но они должны визуально восприниматься как три страницы одного Commerce Detail Design System.

---

# 5. REQUIRED CANONICAL PAGE SKELETON

Использовать один high-level skeleton для всех трёх страниц.

Рекомендуемая композиция:

```text
┌─────────────────────────────────────────────────────────────┐
│ BREADCRUMBS                                                 │
│ ENTITY TITLE / PRIMARY REF               STATUS / ACTIONS    │
│ SECONDARY REF / META                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌──────────────────────────────────┐ ┌────────────────────┐ │
│ │ PRIMARY BUSINESS CONTENT         │ │ CONTEXT / TIMELINE │ │
│ │                                  │ │                    │ │
│ │ entity-specific overview         │ │ lifecycle          │ │
│ │                                  │ │ milestones         │ │
│ └──────────────────────────────────┘ └────────────────────┘ │
│                                                             │
│ ┌──────────────────────────────────┐ ┌────────────────────┐ │
│ │ SECONDARY BUSINESS CONTENT       │ │ DETAILS / META     │ │
│ │                                  │ │                    │ │
│ │ finance/service/supplier/items   │ │ compact metadata   │ │
│ └──────────────────────────────────┘ └────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ RELATIONS                                               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ NOTES                                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ AUDIT HISTORY                                           │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

Target desktop geometry:

```text
MAIN CONTENT     ≈ 68–72%
CONTEXT SIDEBAR  ≈ 28–32%
```

Exact ratio may vary slightly if existing design tokens require it, but all three pages must use the **same grid contract**.

---

# 6. REQUIRED SHARED LAYOUT PRIMITIVE

Ввести или расширить shared primitive уровня композиции, например:

```text
<EntityDetailLayout>
  <EntityDetailMain />
  <EntityDetailAside />
</EntityDetailLayout>
```

или эквивалентную архитектуру.

Не допускается, чтобы каждая page сама определяла конкурирующую desktop grid grammar.

Single source of truth должен определять:

- desktop columns;
- column gap;
- responsive stacking;
- main/aside width ratio;
- card spacing;
- top-level vertical rhythm;
- order of stacked sections on tablet/mobile.

---

# 7. SLOT CONTRACT

Каждая страница должна заполнять общие semantic slots.

## 7.1 Header

Все три:

```text
Breadcrumbs
Title / canonical reference
Secondary reference if applicable
Lifecycle badge
Payment badge if applicable
Server-authoritative actions if applicable
Back to list
```

Визуальная геометрия header должна быть одинаковой.

Если actions отсутствуют:

```text
DO NOT render fake empty action placeholder
DO NOT collapse header into materially different geometry
```

Header должен сохранять общий visual balance.

## 7.2 PRIMARY SLOT

### Request

```text
PRIMARY:
Обзор заявки
- клиент
- услуга
- поставщик
- витринная цена
- подтверждённая цена
- количество
- дата услуги
- другие canonical Request overview fields
```

### Order

```text
PRIMARY:
Обзор заказа
- client
- seller/partner
- lifecycle summary
- core order facts
- related primary business facts
```

Не использовать Finance как единственный суррогат overview, если из-за этого page hierarchy визуально отличается от двух других сущностей.

### Booking

```text
PRIMARY:
Услуга / Обзор бронирования
- order relation
- service
- channel
- service date
- provider
- canonical booking business facts
```

## 7.3 SECONDARY BUSINESS SLOT

### Request

Подходящие существующие блоки:

```text
Поставщик
Предложение / решение
Request-specific business state
```

### Order

```text
Финансы
Items / Travelers
```

### Booking

```text
Финансы
Service operational details
```

Не добавлять искусственные поля ради симметрии.

## 7.4 CONTEXT SIDEBAR

Все три должны иметь один visual grammar.

Основной contextual card:

```text
ХРОНОЛОГИЯ
```

Timeline = business milestones only.

Дополнительный contextual card:

```text
ДЕТАЛИ
```

или эквивалентный compact meta block.

Важно:

```text
Timeline != Audit
```

Не объединять lifecycle timeline и immutable history.

---

# 8. REQUEST DETAIL — REQUIRED R3 CHANGES

Текущая Request page визуально слишком похожа на отдельный custom design.

Нужно:

1. Перевести страницу на shared desktop two-zone layout.
2. Поместить Request Overview в canonical MAIN primary slot.
3. Поместить lifecycle timeline в canonical ASIDE slot.
4. Создать compact Details/meta card там, где есть подходящие существующие данные.
5. Supplier / proposal / decision блоки расположить в shared business-section grammar.
6. Relations оставить отдельным shared full-width section ниже основной grid.
7. Не начинать UI-C2.
8. Не создавать fake Request Notes/Audit backend capability.
9. Если Notes/Audit backend не существует — слот может отсутствовать; не имитировать данные.
10. Не менять Request server authority в R3 — `SEC-UI-01` остаётся отдельным remediation item.

---

# 9. ORDER DETAIL — REQUIRED R3 CHANGES

Текущий Order page single-column и поэтому визуально не совпадает с Booking.

Нужно:

1. Перевести Order на тот же shared desktop two-zone layout.
2. Не оставлять Timeline full-width, если Booking/Request используют sidebar.
3. Timeline должен находиться в canonical contextual slot.
4. Создать compact Details/meta card в том же contextual column.
5. Finance сохранить как важный Order business block, но встроить в общий page hierarchy.
6. Relations, Items, Notes, Audit должны следовать shared section order.
7. D5 server-authoritative actions не менять.
8. D7 financial authority не менять.
9. Не выполнять frontend financial calculations.
10. Не менять lifecycle semantics.

---

# 10. BOOKING DETAIL — REQUIRED R3 CHANGES

Booking сейчас является наиболее сильной композиционной отправной точкой.

Нужно:

1. Сохранить полезную two-zone composition.
2. Перевести её на shared layout primitive, а не Booking-only grid.
3. Убедиться, что Request и Order используют тот же layout contract.
4. Finance, Service, Timeline, Details должны быть размещены по общему slot grammar.
5. D6 server-authoritative actions сохранить.
6. D7 linked-Order finance authority сохранить.
7. Timeline ≠ Audit.
8. Не менять Booking state machine.

---

# 11. FINANCE VISUAL PARITY — P0

После R2 Order и Booking используют одинаковые `EntityFinanceCell`, но визуально Finance всё ещё различается из-за разной доступной ширины.

Это НЕ считать parity.

На одинаковом viewport:

```text
Order Finance
Booking Finance
```

должны иметь одинаковый grid behavior для эквивалентных финансовых ячеек.

Canonical financial fields remain backend-authoritative:

```text
total
paid
refunded
due
refundable
payment status
```

Не менять D7 formulas:

```text
due = max(0, total - paid)
refundable = max(0, paid - refunded)
```

Frontend formatting only.

Если business fields отличаются — допускается разное число cells, но:

```text
same width context
same card geometry
same breakpoint behavior
same cell sizing
same label/value hierarchy
```

---

# 12. RELATIONS

R3 НЕ реализует Commerce Relation Chain.

Разрешено только:

- привести существующие relation cards к shared placement;
- унифицировать spacing;
- унифицировать section position;
- унифицировать link/status presentation.

Запрещено:

```text
Request → Order → Booking
```

как новый `CommerceRelationChain` component.

Это UI-C2.

---

# 13. NOTES / AUDIT

Canonical lower-page order:

```text
Relations
Notes
Audit History
```

где применимо.

Если сущность не имеет backend support:

```text
do not invent
do not fake
do not add client-only persistence
```

Audit должен оставаться immutable display surface.

---

# 14. RESPONSIVE CONTRACT

## Desktop

Все три:

```text
same two-zone layout contract
same main/aside ratio
same gap
same section rhythm
```

## Tablet

Shared breakpoint behavior:

```text
MAIN
ASIDE
```

либо approved compressed two-column mode, если реально читабельно.

Но поведение должно быть одинаковым для всех трёх.

## Mobile

```text
Header
Primary
Secondary
Timeline
Details
Relations
Notes
Audit
```

или другая одна canonical ordering, одинаковая для Request / Order / Booking.

No horizontal overflow.

---

# 15. VISUAL WEIGHT CONTRACT

Унифицировать не только tokens, но и visual weight:

- первый экран;
- card density;
- amount of whitespace;
- proportion of primary vs secondary content;
- section title prominence;
- action-area weight;
- finance prominence;
- contextual sidebar prominence.

Не допускается:

```text
Request = sparse
Order   = medium
Booking = dense
```

при одинаковом viewport без бизнес-обоснования.

---

# 16. ACCEPTANCE EVIDENCE — MANDATORY

R3 запрещено принимать только по unit tests или DOM token audit.

Нужны **реальные browser screenshots**.

## 16.1 Mandatory Side-by-Side Evidence

Снять все три detail pages:

```text
/app/requests/{id}
/app/orders/{id}
/app/bookings/{id}
```

на одном viewport:

```text
1680 × 1050
```

или одном другом фиксированном desktop viewport, но одинаковом для всех трёх.

Создать side-by-side comparison:

```text
REQUEST | ORDER | BOOKING
```

Acceptance question:

> Если скрыть бизнес-текст и оставить только геометрию блоков, воспринимаются ли три страницы как один шаблон?

Если нет:

```text
FAIL
```

---

# 17. SKELETON OVERLAY / STRUCTURE AUDIT

Добавить evidence, которое доказывает:

```text
same header bounds
same content max-width
same main/aside ratio
same top-level grid
same card spacing
same contextual column width
same lower-section width
```

Можно использовать:

- DOM bounding box JSON;
- visual overlay;
- screenshot measurements;
- Playwright computed layout evidence.

Но raw class list сам по себе недостаточен.

---

# 18. REQUIRED BEFORE / AFTER MATRIX

В отчёте создать BEFORE / AFTER matrix:

| Property | Request | Order | Booking | Canonical | Result |
|---|---|---|---|---|---|
| Header geometry | | | | shared | |
| Content max-width | | | | shared | |
| Main/sidebar ratio | | | | shared | |
| Column gap | | | | shared | |
| Primary slot position | | | | shared | |
| Timeline position | | | | aside | |
| Details position | | | | aside | |
| Finance placement | | | | shared grammar | |
| Relations placement | | | | full-width lower slot | |
| Notes placement | | | | lower slot | |
| Audit placement | | | | lower slot | |
| Vertical rhythm | | | | shared | |
| Responsive stacking | | | | shared | |

Каждый PASS должен ссылаться на concrete code/browser evidence.

---

# 19. LOCALIZATION

Не регрессировать R2:

- RU/AZ/EN touched surfaces;
- no hardcoded `ru-RU`;
- no raw enum leakage where mapping exists;
- no raw status constants in visible UI;
- same localized section names across equivalent components.

---

# 20. ACCESSIBILITY

Проверить:

- heading hierarchy;
- landmark consistency;
- keyboard actions;
- focus order after layout changes;
- accessible status text;
- no focus loss during responsive reflow;
- links remain actual links;
- buttons remain actual buttons.

---

# 21. SECURITY PRESERVATION

Не регрессировать:

```text
D5 Order server-authoritative actions
D6 Booking server-authoritative actions
D7 backend financial authority
RBAC
workspace isolation
tenant isolation
404-like cross-context semantics
audit immutability
```

`SEC-UI-01`:

```text
REMAINS OPEN
```

R3 не должен случайно объявлять его закрытым.

---

# 22. TESTING

Минимально:

### Frontend

```text
typecheck
build
focused visual-system tests
existing commerce detail tests
```

### Regression

Re-run relevant D5/D6/D7 regression suites where practical.

Если есть pre-existing failures:

- доказать baseline;
- явно отделить от R3;
- не маскировать.

---

# 23. BROWSER QUALIFICATION

Обязательно проверить:

```text
Desktop
Tablet
Mobile
```

Для всех трёх detail pages.

Минимум:

```text
1680×1050
768px
390px
```

Проверить:

- no horizontal overflow;
- no clipped actions;
- no broken card grids;
- same section ordering;
- same responsive grammar.

---

# 24. OUT OF SCOPE — HARD BLOCK

Не делать:

```text
UI-C1.2 Operations Center
Payments Center
Payments tab
new payment entities
new payment statuses
new KPI architecture
new registry KPI grouping
Commerce Relation Chain
D8
pricing/commission redesign
Request period backend changes
SEC-UI-01 remediation
new Notes/Audit backend models
```

---

# 25. GIT DISCIPLINE

В конце:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

Acceptance requires:

```text
porcelain = empty
HEAD == origin/master
one canonical 40-char SHA
```

---

# 26. ACCEPTANCE GATES

R3 может получить `VERDICT A` только если ВСЕ:

```text
P0-1 Shared page composition             PASS
P0-2 Shared information hierarchy        PASS
P0-3 Shared desktop grid                 PASS
P0-4 Shared context sidebar              PASS
P0-5 Timeline placement parity           PASS
P0-6 Details/meta placement parity       PASS
P0-7 Equivalent Finance visual parity    PASS
P0-8 Relations lower-slot parity         PASS
P0-9 Responsive structure parity         PASS
P0-10 Side-by-side visual qualification  PASS
P0-11 D5 preserved                       PASS
P0-12 D6 preserved                       PASS
P0-13 D7 preserved                       PASS
P0-14 UI-C2 not started                  PASS
P0-15 D8 not started                     PASS
P0-16 Git hard closure                   PASS
```

---

# 27. NON-ACCEPTANCE CONDITIONS

Автоматический `VERDICT B`, если хотя бы одно:

```text
- Request remains single-column while Booking uses sidebar
- Order remains single-column while Booking uses sidebar
- Timeline lives in different high-level zones without explicit shared contract
- equivalent Finance blocks have materially different grid behavior at same viewport
- proof relies only on matching Tailwind classes
- screenshots are not comparable
- three page skeletons still visibly differ
- UI-C2 starts
- Operations Center starts
- D5/D6/D7 authority changes
- new fake backend data introduced
- Git dirty
- HEAD != origin/master
```

---

# 28. REQUIRED REPORT STRUCTURE

Финальный отчёт:

```text
1. Executive Summary
2. Canonical Baseline
3. Starting Git State
4. R2 Re-qualification
5. Root Cause
6. Canonical Page Composition Contract
7. Shared Layout Primitive
8. BEFORE Matrix
9. Request Detail Changes
10. Order Detail Changes
11. Booking Detail Changes
12. Finance Visual Parity
13. Timeline vs Audit
14. Relations Placement
15. Notes/Audit Applicability
16. Responsive Contract
17. Localization
18. Accessibility
19. Security Preservation
20. Tests
21. Browser Qualification
22. Side-by-Side Screenshot Evidence
23. Bounding-Box / Layout Evidence
24. AFTER Matrix
25. Remaining Debt / Non-Scope
26. Acceptance Matrix
27. Git Hard Closure
28. Final Verdict
29. TRUE NEXT
```

---

# 29. REQUIRED FINAL VERDICT FORMAT

Если всё закрыто:

```text
VERDICT A — UI-C1.1 REMEDIATION R3 —
PAGE COMPOSITION & INFORMATION HIERARCHY PARITY PASSED

D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED
UI-C1 — ACCEPTED
UI-C1.1 — ACCEPTED AFTER R3

FINAL SHA:
<40-char SHA>

TRUE NEXT:
UI-C1.2 — OPERATIONS CENTER
ARCHITECTURE & DESIGN RECONCILIATION

UI-C2 — NOT STARTED
D8 — NOT STARTED
```

Если хотя бы один P0 gate не закрыт:

```text
VERDICT B — UI-C1.1 REMEDIATION R3 FAILED

UI-C1.1 — NOT ACCEPTED
UI-C1.2 — NOT STARTED
UI-C2 — NOT STARTED
D8 — NOT STARTED
```

---

# 30. TRUE NEXT — ONLY AFTER ACCEPTANCE

Только после реального `VERDICT A` по R3:

```text
UI-C1.2
OPERATIONS CENTER
ARCHITECTURE & DESIGN RECONCILIATION
```

В UI-C1.2 позже отдельно проектируются:

```text
[ Заявки ] [ Заказы ] [ Бронирования ] [ Платежи ]
```

с sidebar ownership:

```text
ОПЕРАЦИИ
├── Заявки
├── Заказы
└── Бронирования

ФИНАНСЫ
└── Платежи
```

Но это **не является частью R3**.

---

# FINAL EXECUTION PRINCIPLE

```text
DO NOT PROVE PARITY WITH TOKENS ALONE.

PROVE THAT REQUEST / ORDER / BOOKING
ARE THREE BUSINESS VARIANTS
OF ONE PAGE COMPOSITION SYSTEM.
```
