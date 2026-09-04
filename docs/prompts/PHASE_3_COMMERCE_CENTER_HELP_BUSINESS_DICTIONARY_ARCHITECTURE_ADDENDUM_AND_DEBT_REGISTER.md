# PHASE 3 — COMMERCE CENTER UI CONSISTENCY — HELP / BUSINESS DICTIONARY ARCHITECTURE ADDENDUM + DEBT REGISTER

## ROLE — MANDATORY

Ты работаешь как **Staff/Principal Product Architect + Enterprise SaaS UX Architect + Information Architect + Staff Full-Stack Engineer + Security/RBAC Reviewer + QA/Release Engineer**.

Это **архитектурный addendum к уже принятому Commerce Center UI Consistency Design Contract** и одновременно формализация канонического реестра технических/продуктовых долгов TravelHub.

Это **НЕ production implementation**.

---

# 1. CANONICAL BASELINE — DO NOT REOPEN

Зафиксировать:

```text
D5 — ACCEPTED
D6 — ACCEPTED
D7 — ACCEPTED

D7 FINAL SHA:
a57239a140452bec9dcafa859d02f1e155c3efbb

COMMERCE CENTER UI CONSISTENCY
DESIGN & ARCHITECTURE RECONCILIATION
— ACCEPTED

DESIGN FINAL SHA:
2882379f42629f03556b1a18ce59e126356c7347

PRODUCTION UI IMPLEMENTATION
— NOT STARTED

D8 — NOT STARTED
```

Не переоткрывать D5/D6/D7 или уже принятый Commerce UI Design Contract без доказанного архитектурного противоречия.

---

# 2. WHY THIS ADDENDUM EXISTS

Принятый Commerce UI Design Contract определил:

```text
unified Request / Order / Booking shell
header
status badges
actions
Business Timeline
Audit History
Commerce Relation Chain
Notes
Financial Summary
card/layout/responsive system
Orders KPI semantics
Bookings KPI semantics
```

Но перед implementation необходимо формализовать ещё один ранее отложенный обязательный UX/architecture scope:

```text
СЕРВИС → Помощь
/app/help
TravelHub Business Dictionary
contextual KPI help
business definitions
formulas
status mappings
inclusions/exclusions
overlap rules
reconciliation rules
drill-down explanations
workspace-aware documentation
```

Пользователь не должен угадывать смысл KPI, статусов, финансовых показателей и бизнес-переходов.

---

# 3. HELP ≠ SUPPORT

В левом меню должны быть концептуально разделены:

```text
СЕРВИС
├── Поддержка
└── Помощь
```

## Поддержка

Назначение:

```text
обращение к поддержке
проблема/инцидент
ticket/contact flow
```

## Помощь

Назначение:

```text
встроенная документация TravelHub
business dictionary
пояснение интерфейса
пояснение KPI
формулы
статусы
бизнес-процессы
правила интерпретации данных
```

Не объединять эти два понятия.

---

# 4. HELP ENTRY IN LEFT MENU

Спроектировать canonical navigation entry:

```text
СЕРВИС
├── Поддержка
└── Помощь
```

Canonical route:

```text
/app/help
```

На design stage определить:

```text
menu placement
icon concept
visibility rules
workspace awareness
entitlement awareness
role behavior
active state
deep-link behavior
```

Не реализовывать пока production menu item.

---

# 5. HELP CENTER INFORMATION ARCHITECTURE

Спроектировать `/app/help` как **TravelHub Business Dictionary + Product Help Center**.

Минимальная целевая структура:

```text
Помощь
│
├── Начало работы
│
├── Command Center
│   ├── Executive Summary
│   ├── Operational
│   ├── Financial
│   └── Marketplace
│
├── Аналитика
│   ├── Метрики
│   ├── Формулы
│   ├── Периоды
│   └── Сравнение периодов
│
├── Заявки
│   ├── Назначение
│   ├── KPI
│   ├── Статусы
│   ├── Timeline
│   └── Request → Order
│
├── Заказы
│   ├── Назначение
│   ├── KPI
│   ├── Статусы
│   ├── Финансы
│   ├── Timeline
│   └── Order → Booking
│
├── Бронирования
│   ├── Назначение
│   ├── KPI
│   ├── Статусы
│   ├── Timeline
│   └── Жизненный цикл
│
├── Финансы
│   ├── Payment Status
│   ├── Refund Status
│   ├── GMV
│   ├── Revenue
│   ├── Net Revenue
│   ├── Due Amount
│   └── Refundable Amount
│
├── CRM
├── Сотрудники
├── Маркетинг
├── Продукты
├── Роли и права
│
└── Бизнес-словарь
```

Это минимальный information architecture proposal.
Сверить с реально существующими модулями repo и не документировать несуществующие возможности как реализованные.

---

# 6. CANONICAL BUSINESS DICTIONARY ENTRY CONTRACT

Для каждого KPI / business metric / important status определить единый schema.

Минимум:

```text
ID
DISPLAY NAME
BUSINESS DEFINITION
PURPOSE
SOURCE
SCOPE
FORMULA
PERIOD
COMPARISON PERIOD
CURRENCY / UNIT
STATUS MAPPING
INCLUSIONS
EXCLUSIONS
OVERLAP RULE
RECONCILIATION RULE
DRILL-DOWN
RELATED METRICS
WORKSPACE AVAILABILITY
ENTITLEMENT AVAILABILITY
LOCALIZATION KEYS
LAST CONTRACT VERSION / CHANGE NOTE
```

Если поле неприменимо:

```text
N/A + reason
```

Не выдумывать formula для показателей, где canonical formula ещё не определена.

---

# 7. KPI CONTEXTUAL HELP — ⓘ

Каждая KPI card, для которой смысл/формула не очевидны, должна поддерживать contextual help.

Concept:

```text
┌──────────────────────────────┐
│ GMV                       ⓘ │
│                              │
│ 125 430 ₼                    │
│ +12.4%                       │
└──────────────────────────────┘
```

Tooltip/popover:

```text
GMV

Краткое business definition.

Формула:
<canonical formula>

Период:
<current selected period semantics>

Сравнение:
<comparison semantics>

[Подробнее →]
```

`Подробнее` ведёт на соответствующую Help entry.

Определить canonical deep-link strategy, например:

```text
/app/help?topic=<stable-topic-id>
```

или:

```text
/app/help/<stable-topic-id>
```

Выбрать один вариант на основании существующей routing architecture.

---

# 8. TOOLTIP MUST STAY SHORT

Contextual tooltip/popover не должен превращаться в полную документацию.

Tooltip:

```text
short definition
formula if concise
period/comparison summary
currency/unit if important
Подробнее
```

Full Help:

```text
complete definition
source
scope
formula
statuses
inclusions/exclusions
overlaps
reconciliation
drill-down
related metrics
examples
```

---

# 9. ORDERS KPI HELP CONTRACT

Использовать принятый design reconciliation как starting point, но явно решить semantic gaps.

Текущий design identified:

```text
Всего заказов
Активные
Готовы к бронированию
Закрыто/отменено
```

Known issue:

```text
READY_FOR_BOOKING ⊂ Активные
```

Следовательно KPI могут пересекаться.

Для каждого Orders KPI требуется таблица:

| Field | Definition |
|---|---|
| Business Definition | |
| Source | |
| Status Mapping | |
| Formula | |
| Period | |
| Inclusions | |
| Exclusions | |
| Overlap Rule | |
| Reconciliation Rule | |
| Drill-down Filter | |
| Tooltip Text | |
| Full Help Topic | |

Отдельно квалифицировать отсутствующие/непредставленные states, найденные design audit:

```text
PARTIALLY_FULFILLED
FULFILLED
READY_FOR_CLOSURE
PROBLEM
SUSPENDED
```

Не добавлять KPI автоматически.
Определить, должны ли они:
- входить в существующий aggregate;
- получить отдельный KPI;
- быть только registry/filter states;
- быть intentionally excluded.

---

# 10. BOOKINGS KPI HELP CONTRACT

Design reconciliation обнаружил:

```text
Ожидание
Подтверждено
Отменено
```

и проблему:

```text
CONFIRMED
IN_SERVICE
COMPLETED
```

сейчас могут быть сгруппированы в один показатель, хотя это разные lifecycle stages.

До implementation принять точную семантику.

Для каждого Booking KPI требуется тот же contract:

```text
definition
source
status mapping
formula
period
inclusions
exclusions
overlap
reconciliation
drill-down
tooltip
full help topic
```

Не восстанавливать старые Booking KPI вслепую.

---

# 11. STATUS DICTIONARY

Help должен объяснять как минимум три независимых status domains:

```text
Lifecycle Status
Payment Status
Refund Status / Refund Process
```

Для каждого status:

```text
display label
business meaning
when entered
possible next states
terminal/non-terminal
user actions available conceptually
financial implication if any
not-to-confuse-with
```

Не дублировать server state-machine как frontend authority.

Help — documentation only.

---

# 12. REQUEST → ORDER → BOOKING EXPLANATION

Добавить Help topic:

```text
Как связаны Заявка, Заказ и Бронирование
```

Объяснить:

```text
Request = первоначальная коммерческая потребность/запрос
Order = коммерческое оформление сделки
Booking = операционное бронирование услуги
```

Но использовать точные project definitions после repo/document inspection.

Help topic должен согласовываться с:

```text
<CommerceRelationChain />
<EntityTimeline />
```

---

# 13. TIMELINE VS AUDIT HELP

Отдельно объяснить пользователю:

```text
ХРОНОЛОГИЯ
= бизнес-путь / milestones / current stage

ИСТОРИЯ ИЗМЕНЕНИЙ
= immutable audit / кто / что / когда
```

Не смешивать их ни в UI, ни в Help terminology.

---

# 14. FINANCIAL HELP — PRESERVE D7

Help должен документировать уже принятую D7 authority.

Минимум:

```text
totalAmount
paidAmount
refundedAmount
dueAmount
refundableAmount
paymentStatus
refund semantics
currency
```

Canonical formulas:

```text
dueAmount
= max(0, totalAmount - paidAmount)

refundableAmount
= max(0, paidAmount - refundedAmount)
```

Если другие financial formulas (GMV, Revenue, Net Revenue и т.п.) имеют отдельные canonical definitions в коде/документации — извлечь их.

Не придумывать формулы.

---

# 15. PERIOD / COMPARISON HELP

Для time-based KPI Help должен явно определять:

```text
selected period
timezone
[from, to) or other canonical interval
comparison period
previous comparable period
percentage-change formula
zero-denominator behavior
partial-period behavior
```

Сверить с существующим Command Center / Analytics contract.

---

# 16. DRILL-DOWN CONTRACT

Help должен связывать KPI с фактическими данными.

Для каждого clickable KPI:

```text
KPI
  ↓
canonical server-side filter
  ↓
registry/result set
```

Reconciliation rule:

```text
KPI count/value
must reconcile with
the same canonical filter/source
subject to documented overlap/scope rules
```

Никаких frontend-guessed filters.

---

# 17. WORKSPACE-AWARE HELP

Help content must follow existing workspace architecture:

```text
IDENTITY
→ WORKSPACE CONTEXT
→ TENANT/PARTNER SCOPE
→ PLAN/ENTITLEMENTS
→ BUSINESS CAPABILITIES
→ ROLE/PERMISSIONS
```

At minimum distinguish:

```text
PLATFORM
PARTNER
```

and where applicable:

```text
Marketplace Basic
Storefront Pro
```

Rules:

```text
do not expose Platform-only operational documentation to Partner unless intended
do not expose unavailable entitlement instructions as if user has the feature
Help navigation should reflect available capabilities
```

This is a UX visibility contract, not a replacement for backend security.

---

# 18. HELP SECURITY MODEL

Explicitly define:

```text
frontend hiding ≠ authorization
Help does not grant capability
Help route visibility does not imply permission
Help deep links must not leak sensitive tenant/business data
```

Static business definitions can be broadly visible where appropriate.

Dynamic examples must not contain:

```text
real customer PII
PAN
CVV
payment tokens
secrets
cross-tenant identifiers
```

---

# 19. FORBIDDEN VS NOT FOUND — CLARIFICATION

Preserve security distinction.

```text
wrong workspace
wrong tenant
wrong business context
cross-context direct ID
→ 404-like NOT FOUND
→ no existence leakage
```

`403 Forbidden` is allowed only where the security model intentionally permits the user to know the resource/capability exists but denies access/action.

Document this rule in the UI implementation contract.

Do not weaken D5/D6 isolation.

---

# 20. REQUEST ACTION AUTHORITY GAP

Design reconciliation found:

```text
Request actions — currently frontend-gated
```

This is not merely visual debt.

Register it explicitly:

```text
SEC-UI-01
Request actions must become server-authoritative
```

Before Request detail migration is accepted, determine:

```text
current backend Request state machine
current permission checks
available action source
mass-assignment risk
direct endpoint authority
audit requirements
```

Do not simply wrap existing frontend-derived actions in `<EntityActionBar />`.

---

# 21. LOCALIZATION CONTRACT

Help must support existing product locales:

```text
RU
AZ
EN
```

Design:

```text
stable topic IDs
localized title
localized short definition
localized full definition
localized formula explanation
localized status labels
localized examples
```

Formula semantics must remain identical across languages.

Do not use translated display labels as stable IDs.

---

# 22. SEARCH / DISCOVERY

Design Help discovery:

```text
left navigation categories
search
topic deep links
related topics
contextual ⓘ links
breadcrumbs
```

Search should support at least:

```text
display name
synonyms
entity
KPI name
status name
```

This is architecture/design only.

---

# 23. HELP CONTENT SOURCE OF TRUTH

Decide where canonical Help definitions should live.

Compare at minimum:

```text
hardcoded frontend content
backend metadata endpoint
shared typed registry/schema
documentation-generated registry
hybrid model
```

Recommend one architecture.

Evaluation criteria:

```text
single source of truth
type safety
localization
versionability
testability
workspace filtering
deep links
formula drift prevention
developer ergonomics
```

Strong preference: avoid independently duplicating business formulas in Help text and production calculation code without a reconciliation mechanism.

---

# 24. FORMULA DRIFT PREVENTION

Design a mechanism so Help does not claim one formula while backend calculates another.

At minimum define:

```text
stable metric ID
canonical metadata owner
formula description owner
automated contract test or review gate
```

For critical KPI:

```text
metric implementation
↔ metric metadata/help definition
```

must be traceable.

---

# 25. HELP COMPONENT INVENTORY

Propose reusable components, minimum:

```text
<HelpCenter />
<HelpNavigation />
<HelpSearch />
<HelpTopic />
<HelpMetricDefinition />
<HelpStatusDefinition />
<MetricHelpTrigger />
<MetricHelpPopover />
<HelpRelatedTopics />
```

For contextual cards consider:

```text
<KpiCard helpTopicId="..." />
```

or equivalent existing architecture-compatible contract.

Do not implement yet.

---

# 26. HELP ACCEPTANCE MATRIX

Do not shorten:

| Gate | Result | Evidence |
|---|---|---|
| Help distinct from Support | | |
| Left-menu Help placement defined | | |
| `/app/help` architecture defined | | |
| Help IA defined | | |
| Stable topic ID strategy defined | | |
| Business Dictionary schema defined | | |
| KPI contextual ⓘ contract defined | | |
| Tooltip vs full Help separated | | |
| Orders KPI Help semantics reconciled | | |
| Missing Orders states classified | | |
| Bookings KPI Help semantics reconciled | | |
| CONFIRMED/IN_SERVICE/COMPLETED ambiguity resolved | | |
| Lifecycle status dictionary defined | | |
| Payment status dictionary defined | | |
| Refund status/process dictionary defined | | |
| Request→Order→Booking topic defined | | |
| Timeline vs Audit topic defined | | |
| D7 financial formulas preserved | | |
| Period semantics defined | | |
| Comparison semantics defined | | |
| Drill-down contract defined | | |
| Reconciliation rules defined | | |
| Workspace-aware Help defined | | |
| Entitlement-aware Help defined | | |
| Help security model defined | | |
| Cross-context 404 rule preserved | | |
| Request action authority gap registered | | |
| RU localization contract defined | | |
| AZ localization contract defined | | |
| EN localization contract defined | | |
| Search/discovery architecture defined | | |
| Help content source-of-truth chosen | | |
| Formula drift prevention defined | | |
| Reusable Help components defined | | |
| No production implementation started | | |
| D8 not started | | |

Any design-critical unresolved contradiction → VERDICT B.

---

# 27. CREATE CANONICAL DEBT REGISTER

Create:

```text
docs/TRAVELHUB_DEBT_REGISTER.md
```

This becomes the canonical project debt ledger.

Do not treat every future feature as “technical debt”.
Classify correctly:

```text
REGRESSION
ARCHITECTURE DEBT
SECURITY DEBT
UX CONSISTENCY DEBT
DATA/SEMANTIC DEBT
DOCUMENTATION/HELP DEBT
DEFERRED PRODUCT SCOPE
FUTURE MONETIZATION SCOPE
```

---

# 28. DEBT REGISTER SCHEMA

Every debt item must contain:

| Field | Meaning |
|---|---|
| ID | Stable identifier |
| Title | Short name |
| Category | Debt class |
| Severity | P0/P1/P2/P3 or Planned |
| Origin | Stage/report/decision |
| Description | Exact problem |
| Why it matters | Risk/business impact |
| Canonical authority affected | D5/D6/D7/etc. |
| Dependencies | Required prior work |
| Planned closure stage | Where it should close |
| Status | OPEN / IN DESIGN / IN IMPLEMENTATION / DEFERRED / CLOSED |
| Acceptance condition | Exact closure rule |
| Closure SHA | Blank until closed |
| Notes | Constraints |

---

# 29. MINIMUM DEBT ITEMS TO REGISTER

At minimum reconcile and register:

```text
UI-01 Unified Request/Order/Booking Detail shell
UI-02 Unified Header
UI-03 Unified lifecycle/payment/refund visual language
UI-04 Unified Business Timeline
UI-05 Unified Audit History
UI-06 Commerce Relation Chain
UI-07 Unified cards/spacing/typography/responsive
UI-08 Orders KPI semantic reconciliation
UI-09 Bookings KPI restoration/reconciliation

HELP-01 Left menu Help
HELP-02 /app/help Business Dictionary
HELP-03 KPI contextual help
HELP-04 Formula/source/scope definitions
HELP-05 Status dictionary
HELP-06 Overlap/reconciliation/drill-down rules
HELP-07 Workspace-aware Help
HELP-08 RU/AZ/EN Help localization
HELP-09 Formula drift prevention

SEC-UI-01 Request actions server-authority gap

WS-01 Context-aware PLATFORM/PARTNER UI
WS-02 Workspace/plan/entitlement-aware menu/modules
WS-03 Role-default visual/access reconciliation where still incomplete

DATA-01 Canonical KPI/read-model consumer consistency
DATA-02 Marketplace vs Storefront financial metric separation where pending

FIN-01 Full Finance Center
FIN-02 Payment provider/webhook production integration where deferred
FIN-03 Payout implementation

AGR-01 Booking Commercial Terms & Agreement Foundation

SUB-01 Storefront subscription implementation
SUB-02 Host-count subscription variants
SUB-03 Single simultaneous host login per credentials
SUB-04 Storefront partner subscription/onboarding page
SUB-05 Partner company legal/physical data collection
SUB-06 Electronic partner contract
```

Before finalizing, inspect project docs/repo/reports for additional explicitly deferred/open debt.
Do not invent unsupported debt.

---

# 30. IMPORTANT STOREFRONT FUTURE SCOPE TO PRESERVE

Register without implementing:

```text
subscription variants depend on number of hosts
one simultaneous host login per shared credentials
second login invalidates first active session
subscription selection page
partner company data form
subscription payment
electronic contract
company physical address
company legal address
director full name
accountant if required
```

Do NOT require director personal home address.

---

# 31. DEBT PRIORITY MODEL

Recommend execution ordering based on:

```text
security
data correctness
architecture coupling
UX consistency
dependency chain
release risk
business value
```

Do not simply sort by ID.

Provide:

```text
NOW
NEXT
LATER
DEFERRED
```

with rationale.

---

# 32. REQUIRED REPORT

Create:

```text
docs/reports/PHASE_3_COMMERCE_CENTER_HELP_BUSINESS_DICTIONARY_ARCHITECTURE_ADDENDUM_REPORT.md
```

Predominantly Russian.

Required sections:

1. Executive Summary
2. Canonical Baseline
3. Why Help Is Required Before Commerce UI Implementation
4. Help vs Support
5. Left Menu Contract
6. Help Center Information Architecture
7. Business Dictionary Entry Schema
8. KPI Contextual Help Contract
9. Tooltip vs Full Help
10. Orders KPI Help Reconciliation
11. Bookings KPI Help Reconciliation
12. Status Dictionary
13. Request→Order→Booking Help Contract
14. Timeline vs Audit Explanation
15. Financial Help / D7 Preservation
16. Period / Comparison Semantics
17. Drill-down / Reconciliation Contract
18. Workspace / Entitlement-aware Help
19. Help Security Model
20. Forbidden vs Not Found Clarification
21. Request Action Authority Gap
22. Localization Contract
23. Search / Discovery
24. Help Content Source of Truth
25. Formula Drift Prevention
26. Help Component Inventory
27. Help Acceptance Matrix
28. Debt Register Summary
29. Debt Priority / Sequencing
30. Findings
31. Final Verdict
32. TRUE NEXT

---

# 33. TRUE NEXT AFTER ACCEPTANCE

If this addendum passes, derive implementation plan that incorporates Help rather than bolting it on later.

Expected shape:

```text
UI-C1 Shared shell/header/status foundations
UI-C2 Help metadata/topic foundation
UI-C3 Contextual KPI help foundation
UI-C4 Commerce Relation Chain
UI-C5 Business Timeline
UI-C6 Audit History
UI-C7 Request migration + server-authoritative actions
UI-C8 Order migration
UI-C9 Booking migration
UI-C10 Orders KPI implementation + Help
UI-C11 Bookings KPI implementation + Help
UI-C12 Help Center /app/help
UI-C13 Card/spacing/responsive/loading/error polish
UI-C14 Security/regression/browser qualification
UI-C15 Git hard closure
```

This is only a recommended shape.
Refine based on actual dependency inspection.

---

# 34. GIT HARD CLOSURE

Expected changes are documentation only.

At end:

```bash
git status --short
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
git log -5 --oneline
```

Commit and push:

```text
architecture addendum report
TRAVELHUB_DEBT_REGISTER.md
any other explicitly required documentation artifact
```

Then repeat:

```bash
git status --porcelain=v1
git rev-parse HEAD
git rev-parse origin/master
```

Required:

```text
porcelain EMPTY
HEAD == origin/master
one canonical 40-char SHA
```

---

# 35. VERDICT A

Only if Help architecture and Debt Register are complete:

```text
VERDICT A — PHASE 3 COMMERCE CENTER HELP / BUSINESS DICTIONARY ARCHITECTURE ADDENDUM PASSED

COMMERCE UI DESIGN CONTRACT — ACCEPTED
HELP / BUSINESS DICTIONARY CONTRACT — ACCEPTED
DEBT REGISTER — ESTABLISHED

FINAL SHA:
<one canonical 40-char SHA>

TRUE NEXT:
PHASE 3 — COMMERCE CENTER UI CONSISTENCY — IMPLEMENTATION

D8 — NOT STARTED
```

Then STOP.

---

# 36. VERDICT B

If any critical ambiguity remains:

```text
VERDICT B — PHASE 3 COMMERCE CENTER HELP / BUSINESS DICTIONARY ARCHITECTURE ADDENDUM FAILED

HELP CONTRACT — NOT ACCEPTED

TRUE NEXT:
HELP / BUSINESS DICTIONARY ARCHITECTURE ADDENDUM CONTINUATION

D8 — NOT STARTED
```

List exact blockers and STOP.

---

# 37. HARD STOP / OUT OF SCOPE

Do NOT implement:

```text
production Help UI
production menu changes
production KPI cards
Request/Order/Booking UI migration
D8
Finance Center
provider integration
payouts
subscriptions
electronic contracts
new lifecycle semantics
new financial formulas without canonical source
```

This stage is:

```text
RECONCILE
DESIGN
DOCUMENT
REGISTER DEBT
DERIVE IMPLEMENTATION PLAN
STOP
```
