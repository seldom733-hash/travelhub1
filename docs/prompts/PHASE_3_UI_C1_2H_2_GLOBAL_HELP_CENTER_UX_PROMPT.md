# PHASE 3 — UI-C1.2H.2
# GLOBAL HELP CENTER UX / BUSINESS DICTIONARY NAVIGATION

**Baseline:** `dc5de85d7f7d30a9d92b2bf3decac258872fce9f`  
**Previous stages:** UI-C1.2G ACCEPTED → UI-C1.2H ACCEPTED → UI-C1.2H.1 ACCEPTED → Finance Status Correction ACCEPTED  
**Mode:** Audit First → Architecture Reconciliation → Approval → Implementation → Qualification → Report → Git Hard Closure  
**Language:** Russian

---

# 0. PURPOSE

H.1 доказал и зафиксировал Global Help Architecture / Business Dictionary Foundation:

```text
GLOBAL HELP ARCHITECTURE
        +
EXTENSIBLE TYPED REGISTRY
        +
CURRENT COVERAGE
        +
FUTURE COVERAGE MAP
```

H.1 НЕ делал глобальный UX Help Center.

Текущий production Help Center по-прежнему ориентирован на реально существующий content:

```text
Requests
Orders
Bookings
Payments
```

H.2 должен превратить существующий Help Center в **глобальный UX-контейнер Business Dictionary**, не выдумывая content будущих доменов.

Главный принцип:

> **Help Center — глобальный Business Dictionary. KPI Help — только один из entry points.**

---

# 1. BASELINE / START CONDITION

Перед началом:

```bash
git rev-parse HEAD
git status --short
git diff --check
```

Ожидается:

```text
HEAD == dc5de85d7f7d30a9d92b2bf3decac258872fce9f
```

При mismatch или неожиданных source changes:

**STOP.**

Не делать reset/restore/delete чужих изменений.

---

# 2. AUDIT FIRST — ОБЯЗАТЕЛЬНО

До любого production-code change провести read-only audit.

Проверить:

```text
/app/help
frontend/app/app/help/page.tsx
frontend/lib/help-registry.ts
frontend/lib/help-i18n.ts
frontend/lib/help-registry.spec.tsx
frontend/lib/help-center.spec.tsx
frontend/components/commerce/MetricHelpPopover.tsx
frontend/components/CommerceKpiCard.tsx
frontend/lib/i18n.tsx
Shell / navigation
```

Проверить также текущие архитектурные документы H/H.1:

```text
docs/reports/PHASE_3_UI_C1_2H_1_HELP_GLOBAL_ARCHITECTURE_MAP.md
docs/reports/PHASE_3_UI_C1_2H_1_HELP_GLOBAL_ARCHITECTURE_QUALIFICATION_REPORT.md
```

И отдельно проверить актуальное состояние:

```text
Finance = NOT STARTED
Payments = CURRENT capability / Finance ownership
Payments ≠ Finance Center
```

H.2 не должен нарушить это различие.

---

# 3. GOAL

Целевой UX:

```text
┌──────────────────────────────────────────────────────────────┐
│ Справка / Бизнес-словарь                                    │
│                                                              │
│ [ Поиск по справке................................. ]       │
│                                                              │
│ [Все темы] [Метрики] [Статусы] [Термины] [Процессы]       │
├──────────────────────────────────────────────────────────────┤
│ РАЗДЕЛЫ                                                     │
│                                                              │
│ Платформа                                                   │
│ Command Center                                              │
│ Операции                                                    │
│ Финансы                                                     │
│ Продажи                                                     │
│ Аналитика                                                   │
│ Каталог                                                     │
│ CRM                                                         │
│ Маркетинг                                                   │
│ Marketplace                                                 │
│ Поддержка                                                   │
│ Администрирование                                           │
│ Общие понятия                                               │
├──────────────────────────────────────────────────────────────┤
│ ДОСТУПНЫЙ КОНТЕНТ                                            │
│                                                              │
│ Операции                                                    │
│   Заявки                                                    │
│   Заказы                                                    │
│   Бронирования                                               │
│                                                              │
│ Финансы                                                     │
│   Платежи                                                   │
└──────────────────────────────────────────────────────────────┘
```

Это **UX target**, а не требование буквально копировать wireframe.

---

# 4. CURRENT VS FUTURE

Обязательно различать:

## CURRENT

```text
Operations
├── Requests
├── Orders
└── Bookings

Finance
└── Payments
```

## NOT STARTED / FUTURE

```text
Finance Center
Sales
Analytics
CRM
Marketing
Marketplace
Support
Admin
Catalog
...
```

Но нельзя показывать будущий раздел так, будто в нём уже существует content.

Допустимые варианты:

```text
Analytics
Контент появится после запуска соответствующего раздела
```

или disabled/empty state.

Конкретный UX выбрать после Audit.

---

# 5. FINANCE — SPECIAL RULE

Никогда не отображать:

```text
Finance
    → fully available
```

только потому, что существует Payments.

Правильно:

```text
Финансы
├── Платежи              CURRENT
└── Финансовый центр     NOT STARTED
```

Если Help UX не может корректно показать это различие, architecture must be amended before implementation.

---

# 6. HELP TAXONOMY UX

H.1 определил `HelpArea`.

H.2 должен использовать его как canonical taxonomy source.

Не создавать вторую независимую taxonomy в UI.

UI должен получать:

```text
HelpArea
    ↓
Registry
    ↓
UI navigation
```

а не:

```text
hardcoded UI sections
```

Если нужны display-order/visibility metadata — добавить их только в canonical model после explicit architecture decision.

---

# 7. HELP TYPES UX

Поддержать архитектурно:

```text
KPI
Status
Business Term / Concept
Formula
Workflow
Policy
Group / Topic
```

Но показывать category только если существует соответствующий content.

Например:

```text
Метрики (55)
Статусы (??)
Термины (??)
Процессы (??)
Правила (??)
```

Не показывать фальшивые counts.

---

# 8. KPI HELP ≠ BUSINESS DICTIONARY

Не удалять существующие KPI popovers.

Сохранить:

```text
KPI Card
   ↓
short contextual Help
   ↓
full Business Dictionary topic
```

Но Business Dictionary должен существовать независимо от KPI.

---

# 9. STATUS HELP

Status entries должны быть доступны независимо от KPI card.

Архитектурно:

```text
Status
├── KPI entry point
├── Table entry point
├── Detail entry point
└── Business Dictionary
```

H.2 может пока реализовать только доступные UI entry points.

Не добавлять table/detail triggers автоматически, если это отдельный future UI scope.

---

# 10. NAVIGATION

Определить:

- top-level navigation;
- area navigation;
- type filters;
- topic list;
- topic detail;
- breadcrumbs;
- back navigation;
- deep links.

Deep link должен продолжить работать:

```text
/app/help?topic=<stable-id>
```

Не менять stable IDs.

---

# 11. SEARCH

Провести Audit First.

H.1 зафиксировал Search как future enhancement при:

```text
>=150 entries
OR
>=2 content areas
```

Поскольку текущая production coverage уже распределена по двум Help Areas:

```text
operations
finance
```

нужно отдельно решить, выполнен ли архитектурный критерий.

Но **не включать Search автоматически**.

Сначала определить:

```text
Does current Registry justify Search UX?
What is expected search contract?
What fields are indexed?
What are empty/no-result states?
```

Если Search входит в H.2 implementation, он должен искать только:

```text
title
short
description
stable ID
aliases
area
type
```

Не искать по бизнес-данным/API.

---

# 12. FILTERING

Если реализуются type/area filters:

- URL state должен быть deterministic;
- reload должен сохранять state;
- back/forward должен работать;
- invalid filter должен canonicalize safely;
- no hidden local state that contradicts URL.

Не копировать Operations Center URL semantics механически, если Help navigation не требует этого.

---

# 13. DEEP LINKS

Поддержать:

```text
/app/help?topic=requests.kpi.total
/app/help?topic=bookings.status.confirmed
/app/help?topic=payments.status.captured
```

При открытии:

```text
Help Area
→ Topic
→ localized content
```

Unknown topic:

- не должен crash;
- должен иметь explicit not-found state;
- не должен silently display unrelated topic.

---

# 14. CONTENT COUNTS

Counts должны быть вычислены из Registry, а не hardcoded.

Например:

```text
Operations
  Requests 15
  Orders 21
  Bookings 18

Finance
  Payments 14
```

Если UI показывает counts, source:

```text
HELP REGISTRY
```

не вручную прописанные numbers.

---

# 15. I18N

Новые UI strings:

```text
RU
AZ
EN
```

Обязательно локализовать:

- navigation;
- filters;
- empty states;
- future/unavailable states;
- breadcrumbs;
- search;
- no results;
- accessibility labels.

Не использовать inline Russian fallbacks.

---

# 16. ACCESSIBILITY

Проверить:

- keyboard navigation;
- focus order;
- visible focus;
- semantic headings;
- navigation landmarks;
- links/buttons;
- screen reader labels;
- popover/dialog behavior;
- mobile navigation.

Help не должен быть hover-only.

---

# 17. RESPONSIVE

Проверить:

```text
375
768
1024
1280
```

Особенно:

- category navigation;
- topic list;
- detail;
- filters;
- future/empty states;
- popovers;
- breadcrumbs.

---

# 18. SECURITY / WORKSPACE

Help content is static documentation.

Не добавлять API fetch business data.

Workspace/entitlement metadata не должно становиться permission bypass.

Если Help topic workspace-specific:

```text
PLATFORM
PARTNER
BOTH
```

должен использоваться canonical Registry metadata.

---

# 19. NO FUTURE-DOMAIN CONTENT

Запрещено в H.2 создавать definitions для:

```text
Finance Center
Sales
Analytics
CRM
Marketing
Marketplace
Catalog
Support
Admin
```

если canonical authority ещё не существует.

Можно создавать:

```text
area navigation
future state
empty state
```

если это подтверждено архитектурой.

---

# 20. TESTING

Добавить/обновить tests после implementation plan approval.

Минимум:

### Navigation

- all HelpArea values;
- current areas;
- future areas;
- correct mapping;
- no duplicate taxonomy.

### Registry/UI

- all 68 entries still resolve;
- counts derived from Registry;
- stable IDs preserved;
- relationships preserved.

### Filters

- type;
- area;
- URL/reload/popstate, если реализованы.

### Deep links

- known topic;
- unknown topic.

### i18n

- RU;
- AZ;
- EN;
- no raw keys;
- no hardcoded RU UI strings.

### Accessibility

- keyboard;
- roles;
- labels;
- focus.

### Regression

- H;
- G;
- Operations Center;
- Payments;
- Finance distinction.

---

# 21. RUNTIME QUALIFICATION

После implementation:

```text
/app/help
```

проверить в реальном browser.

Минимум:

```text
All topics
Operations
Finance
Requests
Orders
Bookings
Payments
```

Проверить:

```text
known deep link
unknown deep link
locale switching
responsive
keyboard
popover
console
network
```

Не принимать source/tests-only evidence.

---

# 22. REGRESSION CONTRACT

Не менять:

```text
Requests = 12 statuses
Orders = 12 + 4 payment
Bookings = 13
Payments = 6 + 4 refund
```

Сохранить:

- KPI semantics;
- one-active KPI;
- Header Period;
- URL filter semantics;
- server-side filtering;
- sorting;
- RBAC;
- tenant isolation;
- PaymentStatus / RefundStatus separation;
- `PARTIALLY_CONFIRMED` absent;
- `CASH` not PaymentStatus.

---

# 23. FINANCE REGRESSION

Обязательно проверить:

```text
Finance Center = NOT STARTED
Payments = CURRENT capability
Payments ≠ Finance Center
```

Help UI не должен визуально или текстово утверждать обратное.

---

# 24. DOCUMENTATION

Создать:

```text
docs/reports/PHASE_3_UI_C1_2H_2_GLOBAL_HELP_CENTER_UX_QUALIFICATION_REPORT.md
```

На русском языке.

Содержать:

1. Stage / Baseline
2. Audit Findings
3. Architecture Reconciliation
4. UX implemented
5. Navigation
6. Area taxonomy
7. Current vs Future coverage
8. Search decision
9. Filters
10. Deep links
11. i18n
12. Accessibility
13. Responsive
14. Security
15. Finance distinction
16. Tests
17. Runtime
18. G/H regression
19. Files
20. Git Evidence
21. Final Verdict
22. Final SHA

---

# 25. GIT HARD CLOSURE

После qualification:

```bash
git status --short
git diff --check
git diff
git diff --cached
git log -1 --oneline
git rev-parse HEAD
git rev-parse origin/master
```

Требование:

```text
WORKTREE CLEAN
origin/master == HEAD
```

Final SHA должен быть actual SHA.

---

# 26. STOP CONDITIONS

STOP если:

- baseline mismatch;
- taxonomy conflict;
- existing H entries break;
- stable IDs change;
- future business semantics need invention;
- Finance presented as implemented;
- API/business logic changes become necessary;
- RBAC/tenant behavior changes;
- PROD-01 semantics required;
- existing G/H regression breaks.

При STOP предоставить:

```text
Finding
Evidence
Impact
Required decision
```

---

# 27. VERDICT

### VERDICT A — ACCEPTED

Только если:

- Global Help UX implemented consistently with H.1;
- current/future distinction correct;
- Finance correctly shown as NOT STARTED;
- Payments remains current capability;
- navigation uses canonical Registry taxonomy;
- deep links work;
- i18n RU/AZ/EN;
- accessibility PASS;
- responsive PASS;
- runtime PASS;
- G/H regression PASS;
- tests PASS except documented unrelated baseline failures;
- TSC PASS;
- build PASS;
- Git clean;
- report committed.

### VERDICT B — VALID SYSTEM FAIL

Real defect found after implementation.

### VERDICT C — BLOCKED

Canonical authority or environment prevents valid implementation/qualification.

---

# 28. EXECUTION PROTOCOL

```text
AUDIT FIRST
↓
ARCHITECTURE RECONCILIATION
↓
IMPLEMENTATION PLAN
↓
EXPLICIT APPROVAL
↓
IMPLEMENTATION
↓
TESTS
↓
STATIC VERIFICATION
↓
RUNTIME QUALIFICATION
↓
REGRESSION
↓
REPORT
↓
GIT HARD CLOSURE
↓
FINAL VERDICT
```

---

# 29. CURRENT COMMAND

Начать:

```text
PHASE 3 — UI-C1.2H.2 — AUDIT FIRST
```

Работать read-only.

Сначала предоставить:

1. фактический audit текущего Help Center;
2. сравнение текущего UX с H.1 Global Help Architecture;
3. proposed global Help navigation;
4. current vs future UX;
5. Search decision;
6. filters/deep-link model;
7. i18n/accessibility implications;
8. implementation plan;
9. список файлов, которые будут изменены.

**До отдельного approval не менять production code, tests или business logic.**
