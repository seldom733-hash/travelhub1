# TRAVELHUB --- CANONICAL ROADMAP ARCHITECTURE UPDATE

## WORKFORCE / EMPLOYEE PERFORMANCE MANAGEMENT

### Department + Employee Performance / Weekly + Monthly Scorecards / Event-Based Attribution

**Все ответы разработчика, отчёт и roadmap updates --- строго на
русском.**

## 1. Цель

Внести в canonical roadmap TravelHub отдельный будущий функциональный
блок **Workforce / Employee Performance Management** для объективной
оценки качества и эффективности подразделений и сотрудников по неделям,
месяцам и произвольным периодам.

Это **roadmap/architecture update, не implementation**.

Текущий baseline:

``` text
PHASE 3 — STEP 3.5.3 — CRM COMMUNICATIONS + ACTIVITY TIMELINE
FULLY CLOSED
Final closure HEAD: 1a3aa23
```

Не создавать production code, schema/migrations, API, UI или новые
permissions. Не начинать следующий implementation stage.

## 2. Repository-first

Перед изменениями:

``` bash
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse --verify @{u} 2>/dev/null || true
git log --oneline --decorate -40
git diff
git diff --check
```

Изучить:

``` text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

и связанные architecture docs по Employees, Departments, Roles &
Permissions, Command Center, Analytics, Orders, Bookings, Payments,
Refunds, CRM, Audit/Event history, Partner Workspace, Storefront Pro.

Не придумывать номер этапа заранее. Сначала определить правильное
будущее место в canonical roadmap.

## 3. Архитектурный принцип

Performance Management --- отдельный analytics/read-model layer:

``` text
Operational Events / Domain State
→ Employee/Department Attribution
→ Performance Metrics Engine
→ Period Aggregation
→ Performance Scorecards
→ Department/Employee Drill-down
→ Command Center / Analytics / Workforce UI
```

Не превращать его в:

``` text
CrmActivity extension
простой Orders counter
leaderboard-only feature
часть Booking/Order entity
часть RBAC
```

CrmActivity может быть источником evidence, но не универсальным
Performance datastore.

## 4. Business scopes

Предусмотреть два изолированных scope.

### PLATFORM

TravelHub оценивает собственные подразделения/сотрудников:

``` text
Booking Operations
Sales / Orders
Finance
CRM / Support
Moderation
Marketing
other internal departments
```

### PARTNER / STOREFRONT PRO --- FUTURE

Storefront Pro сможет оценивать собственных сотрудников.

Обязательно:

``` text
PLATFORM performance != PARTNER performance
Partner A != Partner B
Marketplace Basic != automatic Full Workforce Performance
```

Entitlement и RBAC --- разные axes.

## 5. Organizational hierarchy

Минимум:

``` text
Workspace
└── Department
    ├── Team (future/optional)
    └── Employee
```

Drill-down:

``` text
Workspace → Department → Employee → Metric → Source records/events
```

Score должен быть объясним.

## 6. Periods

Поддержать концептуально:

``` text
TODAY
CURRENT_WEEK
PREVIOUS_WEEK
CURRENT_MONTH
PREVIOUS_MONTH
CUSTOM_RANGE
```

Weekly/monthly boundaries --- по canonical workspace/business timezone,
а не неявному server/browser time.

Для каждой KPI:

``` text
current
previous comparable period
absolute delta
percentage delta
trend
```

Не сравнивать периоды разной длительности без нормализации.

## 7. Department Performance

Минимальные dimensions:

``` text
Productivity
Quality
SLA / Speed
Business Result
Reliability
Workload
Trend
```

KPI и веса зависят от department type. Одна universal formula запрещена.

## 8. Booking Operations metrics

Предусмотреть:

``` text
bookings assigned
bookings processed
confirmed
cancelled
completed
confirmation rate
cancellation rate
average handling/confirmation time
SLA compliance
overdue
rework/errors
customer-impacting errors
GMV handled/influenced
```

Разделять volume, speed, quality, business outcome.

## 9. Sales / Orders metrics

Предусмотреть:

``` text
orders assigned/processed/completed/cancelled
conversion
GMV
Revenue
AOV
handling time
SLA
refund/cancellation impact
quality/errors
```

Количество обработанных заказов не может быть единственным критерием.

## 10. Finance metrics

Предусмотреть:

``` text
payments processed
successful/problem payments handled
refunds processed
refund processing time
financial exceptions
SLA
error rate
reconciliation issues
handled amount
```

## 11. CRM / Support metrics

Предусмотреть:

``` text
customers/cases handled
response time
resolution time
SLA
reopened issues
escalations
follow-up
operational actions
quality/errors
```

Количество Notes/messages само по себе не является quality score.

## 12. Other departments

Архитектура должна поддерживать department-specific metric profiles,
например Moderation/Marketing. Конкретные формулы --- отдельный design
stage.

## 13. Employee Performance Score

Предусмотреть explainable score `0–100`.

Conceptual dimensions:

``` text
Productivity
Quality
SLA / Speed
Business Result
Reliability
```

Пример Booking Operator, только как design example:

``` text
Productivity 25%
Quality 30%
SLA/Speed 20%
Business Result 15%
Reliability 10%
```

Требования:

``` text
formula role/department-specific
weights configurable/versioned
score explainable
```

## 14. Anti-gaming / fairness

Система не должна стимулировать:

``` text
гонку за количеством
искусственное закрытие объектов
отказ от сложных кейсов
переброс сложных задач
лишние Notes/messages
скорость в ущерб качеству
```

Учитывать volume + quality + SLA + business outcome + reliability +
complexity where available.

## 15. Attribution --- critical

Не использовать:

``` text
lastUpdatedBy = вся работа сотрудника
assignedTo = 100% credit
```

Один объект может обрабатываться несколькими сотрудниками.

Предусмотреть event/action attribution:

``` text
ORDER_CREATED → Employee A
ORDER_CONFIRMED → Employee B
PAYMENT_VERIFIED → Employee C
REFUND_APPROVED → Employee D
BOOKING_CONFIRMED → Employee E
```

Будущий attribution contract минимум для Order, Booking, Payment,
Refund, CRM/Support, Operational Note, Moderation.

Performance event должен уметь связывать, где применимо:

``` text
workspaceId
departmentId
employeeId
role/context
entityType/entityId
eventType/actionType
occurredAt
business value
quality outcome
SLA context
source/audit reference
```

Не добавлять поля/schema сейчас.

## 16. Assignment vs Action vs Outcome

Различать:

``` text
ASSIGNMENT — кто получил
ACTION — кто реально сделал
OUTCOME — чем закончился процесс
```

Пример: Employee B подтвердил Booking, который позже отменил Customer
--- cancellation нельзя автоматически считать ошибкой B.

## 17. Complexity / workload

Future normalization:

``` text
case complexity
workload
shift duration
part/full time
leave/absence
assignment volume
manual vs automatic
team handoff
```

`100 simple cases != 100 complex cases`.

## 18. Explainability

Employee detail:

``` text
Performance Score 88.7
Productivity 92
Quality 84
SLA 91
Business Result 87
Reliability 89
```

С drill-down до конкретных Orders/Bookings/etc., если RBAC позволяет.

## 19. Weekly scorecard

Предусмотреть: \| Employee \| Processed \| Success \| Avg Time \| SLA \|
Quality \| Score \| Trend \|
\|---\|---:\|---:\|---:\|---:\|---:\|---:\|---:\|

Department weekly scorecard должен показывать overall score, volume,
SLA, quality, business result, trend vs previous week.

## 20. Monthly scorecard

Аналогично current month vs previous month.

Monthly score нельзя вычислять простой средней weekly scores.
Использовать canonical components/weighted aggregates.

## 21. History and workload

Предусмотреть:

``` text
weekly score history
monthly score history
department trend
employee trend
metric trend
```

И отдельный Workload context:

``` text
assigned
in progress
completed
overdue
average active workload
distribution by employee
```

## 22. Future UI IA

Возможная структура:

``` text
Employees / Workforce
├── Overview
├── Departments
├── Employees
├── Performance
├── Workload
└── Roles & Permissions
```

Не внедрять UI сейчас.

Performance Center future capabilities:

``` text
department selector
period selector
week/month comparison
overall score
metric cards
trends
department/employee tables
drill-down
filters
```

## 23. Command Center / Analytics integration

Command Center получает high-level Team Performance summary + deep link.

Разделять:

``` text
Business Analytics
vs
Workforce Performance Analytics
```

Не дублировать весь Performance Center в Command Center.

## 24. RBAC / privacy

Future conceptual permissions:

``` text
performance.read.self
performance.read.team
performance.read.department
performance.read.all
performance.manage
performance.configure
```

Exact naming --- на design stage.

Performance data --- sensitive internal data. Требуются:

``` text
server-side authorization
workspace isolation
department/team scope
audit trail
score configuration history
override audit
```

Frontend-hidden != security.

## 25. Manual overrides / score versioning

Если manual adjustment разрешён:

``` text
original score
adjusted score
who/when/reason
before/after
```

Formula должна иметь version identity:

``` text
BookingOperatorScore/v1
SalesManagerScore/v2
effectiveFrom/effectiveTo
calculation provenance
```

Исторические scores нельзя silently пересчитывать новой формулой.

## 26. Snapshot strategy

На design stage выбрать:

``` text
live/on-demand
period snapshots
hybrid
```

Weekly/monthly history должна быть immutable/traceable либо
reproducible.

## 27. Data quality

Предусмотреть:

``` text
data completeness
unattributed events
unknown employee
missing department
invalid period
duplicate attribution
```

Различать `0 activity` и `insufficient/unavailable data`.

## 28. Automation vs employee

Разделять:

``` text
SYSTEM
AUTOMATION
EMPLOYEE
PARTNER_EMPLOYEE
```

Автоматическое действие не засчитывать сотруднику без attribution rule.

## 29. Department vs Employee score

Department Score не вычислять простым average Employee Scores.

Учитывать department aggregate metrics, workload weighting, coverage,
quality, SLA, outcomes.

## 30. Source Authority Matrix requirement

В roadmap закрепить будущий matrix: \| Domain \| Volume \| Quality \|
SLA \| Outcome \| Employee Attribution \|
\|---\|---\|---\|---\|---\|---\| \| Orders \| required \| required \|
required \| required \| required \| \| Bookings \| required \| required
\| required \| required \| required \| \| Payments \| required \|
required \| required \| required \| required \| \| Refunds \| required
\| required \| required \| required \| required \| \| CRM/Support \|
required \| required \| required \| where applicable \| required \| \|
Moderation \| required \| required \| required \| where applicable \|
required \|

Exact event list --- design stage.

## 31. Dependency analysis

Определить зависимости от:

``` text
Employees
Departments
Roles & Permissions
Orders
Bookings
Payments
Refunds
CRM
Audit/Event model
Analytics
Partner Workspace
Storefront Pro entitlements
```

Performance implementation должен идти после необходимых foundations.

## 32. Roadmap insertion rule

Открыть canonical roadmap и определить корректное будущее место. Не
использовать номер из prompt автоматически.

Новая запись должна содержать:

``` text
canonical title
business purpose
Platform scope
future Storefront Pro scope
weekly/monthly scorecards
department/employee drill-down
event/action attribution
role/department-specific scoring
explainability
workload
RBAC/privacy
formula versioning
timezone
data quality
Command Center integration
Analytics integration
dependencies
out of scope
acceptance direction
```

Не renumber существующие stages silently.

## 33. Current NEXT

Перепроверить actual roadmap. Ранее canonical NEXT после Step 3.5.3:

``` text
PHASE 3 — STEP 3.5A — PARTNER CRM FOUNDATION
```

Если unchanged, он должен остаться CURRENT NEXT. Workforce Performance
добавить как future stage, не вытесняя 3.5A без dependency evidence.

Не начинать 3.5A.

## 34. Out of scope

Сейчас не реализовывать:

``` text
DB tables
APIs
score engine
attribution migrations
UI/navigation
permissions/entitlements
scheduled jobs
weekly/monthly workers
exports
notifications
AI scoring
salary/bonus logic
HR disciplinary workflows
```

AI не должен быть authority официального employee score. В будущем AI
может только объяснять trends/anomalies.

## 35. Report

Создать:

``` text
docs/prompts/WORKFORCE_EMPLOYEE_PERFORMANCE_MANAGEMENT_CANONICAL_ROADMAP_UPDATE_REPORT.md
```

Указать Starting/Final HEAD, roadmap section/stage, location rationale,
dependencies, scopes, weekly/monthly model, attribution, score model,
RBAC/privacy, out-of-scope, exact current NEXT, files, commit/push,
HEAD==origin.

## 36. Change boundary

Expected:

``` text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
roadmap update report
```

Допускаются минимальные architecture docs только если roadmap на них
ссылается.

Expected:

``` text
production code=0
schema=0
migration=0
frontend=0
backend=0
```

## 37. Git discipline

``` bash
git diff --check
git status --short
git diff
```

Stage exact docs only. No `git add .`, `git add -A`, force push.

After push:

``` bash
git rev-parse HEAD
git rev-parse --verify @{u}
git status --short
```

Required `HEAD == origin/master`.

## 38. Acceptance

VERDICT A only if actual roadmap inspected; current NEXT reverified;
future Workforce Performance added without silent renumbering;
Platform + future Storefront Pro scopes and isolation defined;
weekly/monthly comparison defined; department/employee models defined;
event/action attribution and assignment/action/outcome separation
defined; explainable role/department-specific versioned score defined;
workload/fairness/timezone/data-quality/RBAC/privacy/override
requirements recorded; Command Center/Analytics integration defined;
CrmActivity not turned into Performance datastore; no
implementation/schema/migrations started; report created; exact NEXT
reported; docs committed/pushed; HEAD==origin.

## 39. Verdict rule

Success:

``` text
VERDICT A — TRAVELHUB /
WORKFORCE + EMPLOYEE PERFORMANCE MANAGEMENT /
CANONICAL ROADMAP ARCHITECTURE UPDATE /
DEPARTMENT + EMPLOYEE WEEKLY/MONTHLY PERFORMANCE +
EVENT-BASED ATTRIBUTION +
EXPLAINABLE SCORECARDS /
ROADMAP INTEGRATED
```

Otherwise:

``` text
VERDICT B — TRAVELHUB /
WORKFORCE + EMPLOYEE PERFORMANCE MANAGEMENT /
CANONICAL ROADMAP ARCHITECTURE UPDATE /
INCOMPLETE
```

No conditional VERDICT A.

## 40. Required final response

``` text
VERDICT:

REPOSITORY
Starting HEAD:
Final HEAD:
origin/master:
HEAD == origin/master:

CANONICAL ROADMAP
Section changed:
New stage/entry:
Why this location:
Dependencies:
Existing stages renumbered:
Current NEXT:

PERFORMANCE ARCHITECTURE
Platform scope:
Storefront Pro future scope:
Department model:
Employee model:
Weekly model:
Monthly model:
Period comparison:
Score dimensions:
Formula versioning:
Attribution model:
Assignment/action/outcome:
Workload:
Fairness/complexity:
Explainability:
Data quality:
Timezone:
RBAC/privacy:
Command Center integration:
Analytics integration:

OUT OF SCOPE:
PRODUCTION CODE:
SCHEMA:
MIGRATION:
FRONTEND:
BACKEND:

FILES CHANGED:
REPORT:
COMMIT:
PUSH:
HEAD == origin/master:
NEXT:
```

## 41. STOP

После roadmap update --- **STOP**.

Не начинать Workforce Performance implementation и не начинать следующий
canonical implementation stage без отдельного задания.
