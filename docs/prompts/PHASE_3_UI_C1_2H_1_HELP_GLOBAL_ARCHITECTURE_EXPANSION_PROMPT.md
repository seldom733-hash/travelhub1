# PHASE 3 — UI-C1.2H.1
# HELP ARCHITECTURE EXPANSION / BUSINESS DICTIONARY FOUNDATION

**Baseline:** `f20850d807ac1687302863082511d2834276e835`  
**Mode:** Audit → Architecture Reconciliation → Implementation Plan → Qualification → Report → Git Closure  
**Language:** Russian

## 1. Purpose

UI-C1.2H реализовал production Help Center и typed Help Registry для Requests, Orders, Bookings и Payments. Это **первое production coverage**, а не граница всей TravelHub Help Architecture.

H.1 должен зафиксировать и при необходимости реализовать архитектуру **глобального TravelHub Business Dictionary / Help Center**, расширяемого на все существующие и будущие домены платформы.

Help ≠ коллекция KPI tooltips.

KPI Help — только один entry point.

## 2. Baseline

Перед началом:

```bash
git rev-parse HEAD
git status --short
git diff --check
```

Ожидаемый HEAD:

```text
f20850d807ac1687302863082511d2834276e835
```

При несовпадении baseline или неожиданных source changes — **STOP**. Не делать reset/restore/delete чужих изменений.

## 3. Target Architecture

Целевая модель:

```text
TRAVELHUB HELP / BUSINESS DICTIONARY
│
├── Platform / General Concepts
├── Command Center
├── Operations / Commerce
│   ├── Requests
│   ├── Orders
│   ├── Bookings
│   └── Payments
├── Sales Center
├── Analytics
├── Finance
├── CRM
├── Marketing
├── Marketplace
└── Shared Business Concepts
```

Это **target architecture**, а не требование выдумывать production-контент для ещё не реализованных доменов.

## 4. Current vs Future Coverage

Разделить:

```text
GLOBAL HELP ARCHITECTURE
        │
        ├── CURRENT PRODUCTION
        │   ├── Requests
        │   ├── Orders
        │   ├── Bookings
        │   └── Payments
        │
        └── FUTURE / AUTHORITY-DEPENDENT
            ├── Sales
            ├── Analytics
            ├── Finance
            ├── CRM
            ├── Marketing
            └── Marketplace
```

Для будущего домена сначала проверить repository и approved docs.

Если canonical business authority отсутствует:

```text
FUTURE / NOT YET CANONICAL
```

Не придумывать KPI, formulas, statuses, workflows, permissions или financial rules.

## 5. Audit First

Проверить текущий H implementation:

```text
frontend/lib/help-registry.ts
frontend/lib/help-i18n.ts
frontend/app/app/help/page.tsx
frontend/components/commerce/MetricHelpPopover.tsx
frontend/components/CommerceKpiCard.tsx
frontend/lib/i18n.tsx
```

и архитектурные документы по:

- Command Center;
- Commerce Center;
- Sales Center;
- Analytics;
- Finance;
- CRM;
- Marketing;
- Marketplace;
- shared business concepts.

Сначала дать фактический audit. Не кодировать автоматически.

## 6. Help Entry Model

Проверить расширяемость typed model.

Минимально архитектура должна поддерживать:

```text
domain
topic
concept
kpi
status
formula
workflow
policy
```

Не добавлять типы без доказанной необходимости.

Business concepts могут содержать:

```text
id
type
domain
purpose
businessDefinition
scope
source
relatedMetrics
relatedStatuses
relatedConcepts
localizationKeys
workspace
contractVersion
changeNote
```

Не создавать ad-hoc schemas.

## 7. Help Levels

Поддержать архитектурно:

### Level 1 — Contextual Help
Краткое объяснение KPI/status/control.

### Level 2 — Business Definition
Definition, scope, formula, period, inclusions/exclusions.

### Level 3 — Business Dictionary
Concept, purpose, relationships, lifecycle, reconciliation, related concepts/metrics/statuses.

Не каждый entry обязан иметь все уровни.

## 8. Relationships

Использовать stable IDs для связей:

```text
Concept → Metric → Status → Workflow
```

Например:

```text
Order
├── Order Status
├── Order Payment Status
├── Booking
├── Payment
└── Refund
```

Не дублировать definitions.

## 9. Domain Taxonomy

Определить canonical taxonomy после repository/docs audit.

Возможные области:

```text
platform
operations
sales
analytics
finance
crm
marketing
marketplace
shared
```

Но не принимать этот список автоматически: подтвердить реальной архитектурой проекта.

## 10. Navigation

Целевая Help навигация должна эволюционировать от простого списка четырёх доменов к:

```text
Business Dictionary
├── Все темы
├── По разделам
├── Метрики
├── Статусы
├── Бизнес-термины
└── Процессы / правила
```

Текущие четыре production domains должны сохраниться.

## 11. Search

Оценить Help Search по:

```text
title
short
description
stable ID
domain
aliases
```

Search работает только по Registry entries и не ищет по бизнес-данным.

Если на текущем размере Registry search не нужен — зафиксировать как future enhancement, не блокируя архитектуру.

## 12. Contextual Entry Points

Help должен архитектурно поддерживать:

```text
Page
Section
KPI
Status
Table column
Action
Business concept
Workflow
```

Но не ставить `?` на каждый UI element.

## 13. Status Help

Status Help не должен зависеть от наличия KPI-card:

```text
Canonical Status
      ↓
Help Registry
      ↓
Status Definition
      ↓
KPI / Table / Detail / Business Dictionary
```

Сохранить существующие canonical universes:

```text
Requests: 12
Orders: 12 + 4 payment
Bookings: 13
Payments: 6 + 4 refund
```

Не добавлять `PARTIALLY_CONFIRMED`.

Не смешивать PaymentStatus и RefundStatus.

## 14. Finance / Sales / Analytics

Отдельно audit-ить:

```text
Domain
Existing production implementation
Canonical business authority
Available metrics
Available statuses
Available concepts
Current Help coverage
Future Help coverage
Missing authority
```

Не смешивать:

```text
Marketplace GMV
Storefront Commerce Volume
TravelHub Revenue
```

и не придумывать financial definitions без canonical source.

## 15. PROD-01 Boundary

Проверить Product / Service / Category model.

Пока canonical production model не подтверждён:

- не создавать фиктивные definitions;
- не придумывать formulas;
- не утверждать reporting dimensions.

Учитывать открытый PROD-01.

## 16. Workspace / Entitlements

Help metadata должно поддерживать:

```text
workspace
entitlement
```

При этом Help не должен раскрывать tenant-sensitive data.

Workspace-specific topics должны явно обозначаться.

## 17. i18n

Сохранить:

```text
RU / AZ / EN
```

Stable ID language-neutral.

Использовать explicit localization mapping.

Не делать слепой `t(id, locale)`.

## 18. Accessibility

Сохранить H contract и проверить:

- navigation;
- topic list;
- detail;
- breadcrumbs;
- keyboard;
- screen reader;
- focus;
- dialogs/popovers.

Help не должен зависеть от hover.

## 19. Testing

Проверить:

### Registry
- taxonomy;
- stable IDs;
- entry types;
- relationships;
- все существующие 68 H entries;
- canonical statuses unchanged.

### Navigation
- current domains;
- future-domain architecture;
- deep links.

### Contextual Help
- KPI;
- status;
- concept;
- page/section, если реализовано.

### i18n
RU/AZ/EN.

### Accessibility
keyboard + semantics.

### Regression
G/H contracts.

## 20. Security

Help не должен:

- запрашивать tenant business data;
- обходить RBAC;
- раскрывать customer/payment data;
- раскрывать secrets;
- использовать API responses как documentation content.

Registry metadata — static business documentation.

## 21. H.1 Scope Control

Не превращать H.1 в бесконечный content project.

Цель:

```text
Global Help Architecture
+
Extensible Registry
+
Current Coverage
+
Future Coverage Map
```

а не написание сотен будущих статей.

## 22. Required Architecture Map

Создать:

```text
docs/reports/PHASE_3_UI_C1_2H_1_HELP_GLOBAL_ARCHITECTURE_MAP.md
```

Структура:

1. Purpose
2. Current H implementation
3. Global Help architecture
4. Domain taxonomy
5. Current production coverage
6. Future domain coverage
7. Canonical business concepts
8. Metric/status/concept relationships
9. Entry points
10. Navigation
11. Search
12. i18n
13. Accessibility
14. Workspace/entitlement
15. Authority chain
16. PROD-01 boundary
17. Open decisions
18. Recommended roadmap

## 23. Implementation Policy

Порядок:

```text
AUDIT
↓
ARCHITECTURE RECONCILIATION
↓
IMPLEMENTATION PLAN
↓
EXPLICIT APPROVAL
↓
IMPLEMENTATION (если требуется)
↓
TESTS
↓
RUNTIME
↓
REGRESSION
↓
REPORT
↓
GIT CLOSURE
```

**На текущем шаге начать только Audit First.**

Не менять production code, tests или business logic до отдельного approval.

## 24. STOP Conditions

STOP при:

- противоречии approved architecture;
- невозможности сохранить H entries без изменения business semantics;
- необходимости backend/API/schema changes;
- изменении status universe;
- изменении RBAC/tenant semantics;
- отсутствии canonical authority;
- неопределённости PROD-01;
- необходимости выдумать semantics.

## 25. Final Report

После завершения:

```text
docs/reports/PHASE_3_UI_C1_2H_1_HELP_GLOBAL_ARCHITECTURE_QUALIFICATION_REPORT.md
```

На русском языке.

Содержать:

```text
1. Stage / Baseline
2. Audit
3. Current H State
4. Global Help Architecture
5. Domain Taxonomy
6. Current Coverage
7. Future Coverage
8. Registry Architecture
9. Concept / Metric / Status Relationships
10. Navigation / Search
11. Contextual Help
12. i18n
13. Accessibility
14. Security
15. PROD-01 Boundary
16. Regression
17. Files
18. Git Evidence
19. Final Verdict
20. Final SHA
```

## 26. Final Verdict

### VERDICT A
Global architecture proven, current coverage correctly positioned, registry extensible, relationships/entry points defined, constraints preserved, regression PASS, documentation and Git closure complete.

### VERDICT B
Architecture exists but qualification reveals a real defect.

### VERDICT C
Required canonical authority or environment is unavailable.

## 27. Current Command

**НАЧАТЬ `PHASE 3 — UI-C1.2H.1 — AUDIT FIRST`.**

Работать read-only.

Сначала предоставить:

1. фактический audit;
2. global Help architecture reconciliation;
3. domain taxonomy;
4. current vs future coverage map;
5. registry architecture recommendations;
6. open architectural decisions;
7. implementation plan.

**До отдельного approval не менять production code, tests или business logic.**
