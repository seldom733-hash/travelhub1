# PHASE 3 — COMMAND CENTER / DECISION INTELLIGENCE
## STAGE C — NEEDS ATTENTION → DECISION QUEUE IMPLEMENTATION

---

# LANGUAGE REQUIREMENT — MANDATORY

Все ответы разработчика, промежуточные выводы, audit findings, описания изменений,
результаты тестирования, runtime/browser evidence, риски, рекомендации, итоговый отчёт
и VERDICT должны быть предоставлены **НА РУССКОМ ЯЗЫКЕ**.

Названия файлов, классов, методов, API endpoints, DTO/database fields, enum values,
permissions, commit SHA, команды, код и другие технические идентификаторы сохранять
в оригинальном виде.

Технические термины допускается оставлять на английском там, где перевод ухудшает точность.

**Финальный отчёт — обязательно на русском языке.**

---

# 1. STATUS / ENTRY CONDITIONS

Canonical roadmap reconciliation завершён:

```text
VERDICT A — CANONICAL ROADMAP RECONCILED / SEQUENCE VALIDATED
```

Canonical next executable stage:

```text
Stage C — Needs Attention → Decision Queue
```

Dependencies:

```text
Stage A — granular Command Center RBAC
→ COMPLETE

Stage B — Decision Signal Foundation
→ COMPLETE

Stage B.1 — Business / Financial Authority
→ FULLY CLOSED

Stage B.2 — Executive Financial Semantic + Runtime AZN Closure
→ COMPLETE
```

Stage D (WHY Attribution) может быть technically parallel-safe согласно roadmap,
но **НЕ запускать его параллельно в рамках этого prompt**.

Сначала завершить Stage C и зафиксировать UX/data contract Decision Queue.

---

# 2. CORE PRODUCT OBJECTIVE

Текущий `Needs Attention` не должен оставаться набором raw counters.

Он должен стать рабочей **Decision Queue**:

```text
WHAT happened?
→ конкретный DecisionSignal

WHO / WHAT is affected?
→ affected entities

HOW URGENT?
→ factual urgency / SLA state available now

WHAT STATE IS IT IN?
→ OPEN / ACKNOWLEDGED / RESOLVED / DISMISSED

WHO CAN ACT?
→ permission-aware routing / ownership where provable

WHERE DO I GO?
→ deep link / entity navigation where provable
```

Stage C отвечает прежде всего на:

```text
WHAT
```

и создаёт operational workflow вокруг WHAT.

Stage C **не должен выдумывать**:

```text
WHY
IMPACT
recommended ACTION
AI-generated advice
financial potential
```

Эти capabilities принадлежат downstream stages D/E/F/G.

---

# 3. DECISION INTELLIGENCE TARGET MODEL

Итоговая архитектура Command Center должна двигаться к:

```text
1. WHAT   — Stage B + C
2. WHY    — Stage D
3. IMPACT — Stage E
4. ACTION — Stage F
```

Stage C должен создать UX/data foundation, в который позже можно безопасно добавить:

```text
WHY
IMPACT
ACTION
```

без redesign очереди с нуля.

Но Stage C не должен prematurely implement их semantics.

---

# 4. DO NOT CREATE A SECOND SIGNAL ENGINE

Stage B уже создал authoritative foundation:

```text
DecisionSignal
SignalStatus
fingerprint
dedup / re-observation
firstDetected
lastDetected
acknowledged
resolved
dismissed
observationCount
affectedEntities
evidence
category
source
code
```

Также существуют:

```text
DecisionSignalService
runDetector()
runDetectors()
listSignals()
getSignal()
acknowledge()
resolve()
dismiss()
```

и representative detector:

```text
PendingBookingsDetector
```

Stage C обязан строиться поверх этой модели.

Запрещено создавать параллельные сущности вроде:

```text
AttentionItem
Alert
DecisionQueueItem
Issue
Task
```

как новый independent source of truth, если это дублирует `DecisionSignal`.

UI `Decision Queue` может иметь presentation DTO/view model,
но source of truth должен оставаться `DecisionSignal`.

---

# 5. AUDIT CURRENT HEAD FIRST

Перед изменением кода проверить actual HEAD.

Не полагаться только на предыдущие reports.

Audit:

```text
DecisionSignal Prisma model
SignalStatus enum
DecisionSignalService
decision-signals controller/API
PendingBookingsDetector
current dashboard Attention section
current Insights section
current Command Center frontend
current Needs Attention counters
current RBAC
current i18n
current routing/navigation
existing pagination/filter components
existing entity detail routes
```

Вернуть current-state matrix:

| Area | Current implementation | Reusable? | Gap for Stage C |
|---|---|---:|---|

---

# 6. CURRENT NEEDS ATTENTION — ROOT CAUSE AUDIT

Определить, откуда сейчас приходят существующие Needs Attention counters.

Для каждого counter пройти:

```text
DB/source
→ query/service
→ dashboard DTO
→ frontend
→ rendered counter
```

Проверить, какие counters уже имеют эквивалентный `DecisionSignal detector`,
а какие ещё нет.

Не удалять полезный counter без понимания его business meaning.

---

# 7. DECISION QUEUE — REQUIRED UX

Needs Attention должен перестать быть только:

```text
6 raw counts
```

и стать actionable queue/list.

Минимальная строка/карточка Decision Queue должна уметь отображать:

```text
signal type / human-readable title
category
status
factual urgency/SLA state where provable
affected entity/entities
key factual evidence
first detected
last detected
observation count
lifecycle state
available lifecycle actions
navigation/deep link where provable
```

Не обязательно показывать все поля одновременно.

Сделать management-readable hierarchy.

---

# 8. QUEUE ITEM INFORMATION HIERARCHY

Предпочтительная структура:

```text
[status / urgency]
Human-readable signal title

Affected entity / scope

Key factual evidence

Detected: ...
Last observed: ...

[Open entity] [Acknowledge] [...]
```

Но использовать существующий design system и layout conventions.

Не создавать новый визуальный язык отдельно от Command Center.

---

# 9. HUMAN-READABLE SIGNAL PRESENTATION

Raw technical values вроде:

```text
PENDING_BOOKINGS_SLA
OPERATIONAL
ds:pending-bookings:...
```

не должны быть основным пользовательским текстом.

Создать presentation mapping/i18n для:

```text
signal code → title
signal code → short factual description
category → localized label
status → localized label
```

Например концептуально:

```text
Ожидают подтверждения дольше SLA
5 бронирований требуют внимания
```

Но описание должно быть основано на structured evidence.

Не генерировать WHY.

---

# 10. STRUCTURED EVIDENCE — NO STRINGLY-TYPED BUSINESS LOGIC

Stage B evidence example:

```text
pendingConfirmationCount
oldestPendingMinutes
affectedGmv
slaThreshold
```

Stage C должен отображать evidence безопасно.

Не строить critical business logic через parsing human-readable strings.

Предпочитать:

```text
structured evidence
→ typed presentation adapter
→ localized UI
```

Если evidence schema сейчас слишком generic (`Json`), допускается typed application-level contract
для известных signal codes.

Не ломать extensibility DecisionSignal.

---

# 11. SIGNAL STATUS / LIFECYCLE

Canonical lifecycle:

```text
OPEN
→ ACKNOWLEDGED
→ RESOLVED

OPEN
→ RESOLVED

OPEN
→ DISMISSED
```

Stage C UI должен корректно отражать lifecycle.

Минимально:

```text
OPEN
ACKNOWLEDGED
RESOLVED
DISMISSED
```

Не добавлять новый lifecycle без architecture approval.

---

# 12. LIFECYCLE ACTIONS

Decision Queue должна использовать существующие authoritative actions:

```text
acknowledge()
resolve()
dismiss()
```

UI actions должны быть доступны только при валидном transition.

Пример:

```text
OPEN
→ Acknowledge
→ Resolve
→ Dismiss

ACKNOWLEDGED
→ Resolve
```

Не показывать action, который гарантированно вернёт invalid transition.

Backend всё равно остаётся authority и обязан валидировать transition.

---

# 13. ACTION ≠ STAGE F ACTION

Важно не смешать два понятия.

В Stage C разрешены **queue lifecycle actions**:

```text
Acknowledge
Resolve
Dismiss
Open affected entity
```

Stage F будет реализовывать **business action routing / recommended action**:

```text
что конкретно нужно сделать для исправления ситуации
```

Stage C не должен выдавать:

```text
"Позвоните партнёру"
"Предоставьте скидку"
"Отмените бронирование"
```

если это не является уже существующим deterministic domain action и не входит в scope.

---

# 14. STATUS FILTERS

Decision Queue должна поддерживать минимум:

```text
OPEN
ACKNOWLEDGED
RESOLVED
DISMISSED
```

Рекомендуемый default management view:

```text
active = OPEN + ACKNOWLEDGED
```

но проверить текущий API/filter capability.

Нужна возможность просмотреть resolved/dismissed history,
чтобы lifecycle не превращался в исчезновение данных.

---

# 15. CATEGORY FILTER

Использовать существующий `category`.

Category должна быть permission-aware.

Пользователь не должен получить signal другой секции через filter/query manipulation.

Stage B server-side RBAC остаётся authority.

---

# 16. SIGNAL CODE FILTER / SEARCH

Если существующий API уже поддерживает:

```text
status
category
code
pagination
```

переиспользовать.

Не строить сложный full-text search без необходимости.

Если UX выигрывает от простого type filter — реализовать минимально.

---

# 17. SORTING / QUEUE ORDER

Нужен deterministic management ordering.

Stage C ещё не имеет Stage E Impact Scoring, поэтому запрещено выдумывать AI/business severity.

До Stage E использовать factual ordering, например:

```text
SLA breached first
then oldest/lastDetected
then deterministic tie-breaker
```

или другой evidence-based order.

Обязательно документировать formula/order.

Не использовать:

```text
if count > 5 → high
```

как fake severity.

---

# 18. URGENCY BEFORE STAGE E

Разрешено показывать factual urgency:

```text
SLA breached
overdue by X minutes/hours
oldest pending age
deadline passed
```

если это непосредственно доказуемо evidence.

Не называть это:

```text
Business Impact = HIGH
```

если Stage E ещё не реализован.

Можно использовать:

```text
Просрочено
SLA нарушен
```

но не fabricated severity.

---

# 19. AFFECTED ENTITIES

`affectedEntities` должны стать полезными для пользователя.

Audit current structure.

Decision Queue должна уметь показывать:

```text
entity type
entity id
human-readable identifier/name if safely resolvable
count
```

Не выполнять N+1 queries без контроля.

Если сигнал агрегированный и затрагивает много entities:

```text
5 бронирований
```

с возможностью перейти к filtered domain list, если route существует.

Не пытаться рендерить сотни entity links внутри одной карточки.

---

# 20. DEEP LINKS / NAVIGATION

Для signal, где domain route существует, предоставить deterministic navigation.

Например:

```text
pending bookings signal
→ Booking Center filtered to affected/pending bookings
```

или:

```text
→ конкретная booking detail
```

если signal entity-specific.

Deep link должен:

```text
respect workspace
respect permissions
use existing routes
avoid invented URLs
```

Если правильного route/filter ещё нет, не создавать fake link.

Отметить gap для Stage F или соответствующего domain stage.

---

# 21. OWNERSHIP

Не выдумывать персонального owner, если data model его не поддерживает.

Stage C может показывать:

```text
responsible domain/category
```

если это доказуемо.

Если существует employee/role assignment infrastructure, audit его.

Но не строить assignment/task-management subsystem без roadmap authority.

---

# 22. RBAC — MANDATORY

Stage A granular permissions остаются обязательными:

```text
dashboard.executive.read
dashboard.operational.read
dashboard.financial.read
dashboard.marketplace.read
dashboard.catalog.read
dashboard.channels.read
dashboard.attention.read
dashboard.insights.read
```

Decision Queue для Needs Attention должна требовать соответствующую section permission.

Также signal-level category filtering должен оставаться server-side.

Проверить:

```text
list
get
acknowledge
resolve
dismiss
```

на unauthorized category access.

Frontend hiding не является security boundary.

---

# 23. PAGE GATE VS SECTION AUTHORITY

Если current Command Center page использует общий page gate:

```text
analytics.read
```

не интерпретировать его как разрешение читать все signals.

Нужна двухуровневая authority:

```text
page access
+
section/category permission
```

Сохранить Stage A/B contracts.

---

# 24. ROLE DEFAULTS — REGRESSION

Не менять без отдельной необходимости текущие defaults:

```text
ADMIN
→ all 8

DIRECTOR
→ all 8

FINANCE
→ executive, financial, attention

MARKETER
→ executive, marketplace, catalog, channels, insights

ANALYST
→ executive, operational, financial, marketplace, catalog

OPERATOR
→ operational, attention

MODERATOR
→ no Command Center

SALES_MANAGER
→ no Command Center
```

Если actual canonical matrix отличается после repository reconciliation — использовать actual authority
и описать расхождение.

---

# 25. DETECTORS — STAGE C SCOPE

Stage B имеет representative:

```text
PendingBookingsDetector
```

Stage C должен определить, достаточно ли одного detector для meaningful runtime Decision Queue.

Если current Needs Attention содержит несколько реальных counters,
очередь с одним единственным типом сигнала может не заменить существующий UX.

Провести gap analysis.

Допускается реализовать дополнительные **deterministic detectors** для существующих Needs Attention conditions,
если:

```text
condition already exists
business rule is already authoritative
evidence is factual
fingerprint is deterministic
no WHY/IMPACT/ACTION inference is introduced
```

Не придумывать новые бизнес-правила только ради наполнения очереди.

---

# 26. DETECTOR COVERAGE MATRIX — REQUIRED

Для current Needs Attention counters вернуть:

| Current counter | Existing detector | New detector needed? | Evidence available? | Stage C action |
|---|---|---:|---:|---|

Если counter нельзя безопасно перевести в DecisionSignal,
сохранить его временно или явно зарегистрировать gap.

Не удалять visibility.

---

# 27. DETECTOR EXECUTION

Определить, как detectors фактически запускаются в current runtime.

Audit:

```text
request-time
cron/scheduler
event-driven
manual
bootstrap
other
```

Decision Queue бесполезна, если detectors существуют, но production/runtime их не запускает.

Stage C должен обеспечить доказуемый runtime population path,
используя существующую architecture.

Не создавать uncontrolled expensive detector execution на каждый render.

---

# 28. SIGNAL FRESHNESS

Queue должна различать:

```text
firstDetected
lastDetected
observationCount
```

Проверить, как signal перестаёт быть актуальным.

Stage B lifecycle может требовать explicit resolve/dismiss.

Если detector condition исчезла автоматически, определить current policy:

```text
auto-resolve?
remain open until human resolve?
re-observation only?
```

Не придумывать policy молча.

Если policy не определена и блокирует корректный queue lifecycle — вернуть exact business/architecture question.

---

# 29. REOPEN / REOCCURRENCE

Stage B уже установил behavior:

```text
RESOLVED condition detected again
→ new signal
```

Сохранить.

Decision Queue/history должна корректно показывать recurring incidents.

Не мутировать resolved signal обратно в OPEN, если Stage B authority говорит создавать новый.

---

# 30. PAGINATION

Использовать существующую pagination capability.

Queue должна быть пригодна для роста.

Не загружать unlimited signals.

Минимально:

```text
page/limit
or
cursor
```

по существующему API contract.

Frontend должен корректно показывать:

```text
loading
empty
error
next page / load more
```

---

# 31. EMPTY STATE

Если active signals отсутствуют:

Не показывать пустой broken section.

Показать понятный state:

```text
Нет ситуаций, требующих внимания
```

или approved localized equivalent.

Не писать:

```text
Everything is perfect
```

если система проверяет только ограниченный detector set.

---

# 32. ERROR STATE

Decision Queue API failure не должен превращаться в:

```text
0 issues
```

Ошибка ≠ отсутствие signals.

UI должен различать:

```text
loading
empty
error
data
```

---

# 33. LOADING STATE

Избегать layout jump и misleading zero counters.

Использовать существующие skeleton/loading conventions.

---

# 34. NEEDS ATTENTION SUMMARY

Разрешено сохранить compact summary над queue, например:

```text
Open: 5
Acknowledged: 2
SLA breached: 3
```

если counts получены из authoritative signals/evidence.

Но summary не должен снова становиться единственным UI.

Primary product outcome:

```text
summary + actual queue
```

а не:

```text
summary only
```

---

# 35. COMMAND CENTER BOUNDARY

Command Center остаётся orchestration / decision surface.

Decision Queue должна:

```text
surface issue
provide context
route user
manage lifecycle
```

Она не должна копировать весь Booking Center / Finance / Analytics внутрь себя.

Для деталей:

```text
deep link to source workspace/domain page
```

---

# 36. ANALYTICS BOUNDARY

Stage C не должен создавать analytical exploration.

Не добавлять:

```text
large trend charts
multi-dimensional slicing
ad hoc analytics
historical BI explorer
```

в Decision Queue.

Это Analytics responsibility.

---

# 37. PLATFORM VS PARTNER BOUNDARY

Stage C относится к PLATFORM Command Center.

Storefront-originated signals могут попадать в PLATFORM Decision Queue только если есть:

```text
TravelHub relevance
and/or
TravelHub actionability
```

Не превращать PLATFORM queue в список внутренних проблем бизнеса каждого Storefront-партнёра.

Partner-specific operational issues без TravelHub responsibility должны оставаться в PARTNER workspace/future partner Decision Intelligence.

---

# 38. MARKETPLACE VS STOREFRONT

Сохранять:

```text
Marketplace Business
≠ Storefront SaaS
≠ Storefront Commerce
```

Если signal относится к business context/channel, presentation должна это отражать.

Не смешивать Marketplace booking problem со Storefront subscription problem под неясным generic label.

---

# 39. FINANCIAL EVIDENCE

Если DecisionSignal evidence содержит money:

```text
affectedGmv
payment amount
refund amount
commission
potential value
```

PLATFORM reporting presentation должна соблюдать:

```text
AZN
```

Не возвращать `$`.

Не придумывать FX.

Если underlying currency не доказуема — не показывать misleading aggregate.

---

# 40. B.2 AZN REGRESSION — MANDATORY

После Stage C реальный Command Center не должен потерять B.2 fixes.

Проверить browser/runtime:

```text
Executive → AZN
Financial → AZN
Decision Queue monetary evidence → AZN where present
unexpected $ → absent for PLATFORM aggregate monetary values
```

---

# 41. NO FAKE SEVERITY

Stage E ещё не выполнен.

Запрещено:

```text
count > 5 = high
count <= 5 = medium
```

или аналогичные hardcoded severity rules без canonical business authority.

Если UI component требует badge, использовать factual state:

```text
SLA BREACHED
OPEN
ACKNOWLEDGED
```

а не fake:

```text
HIGH IMPACT
```

---

# 42. NO FAKE POTENTIAL

Не использовать:

```text
n × 15 AZN/week
```

или любой hardcoded monetary multiplier.

Potential/impact belongs to Stage E/G and должен быть evidence-based.

---

# 43. NO WHY YET

Не писать в queue:

```text
Причина: ...
```

если причина не является непосредственно factual evidence.

Например:

```text
5 bookings > 4h confirmation SLA
```

— WHAT/evidence.

Но:

```text
Причина — партнёр плохо работает
```

— запрещённая inference.

Stage D реализует WHY.

---

# 44. NO RECOMMENDED ACTION YET

Не генерировать:

```text
Рекомендуем...
Вам следует...
AI suggests...
```

Stage F реализует business action routing.

Разрешены только lifecycle/navigation controls Stage C.

---

# 45. AI DECISION FEED

Не переписывать AI Decision Feed в этом stage.

Stage G владеет reconciliation.

Если current AI feed визуально соседствует с Decision Queue,
не смешивать его hardcoded items с authoritative DecisionSignals.

При необходимости явно разделить source/presentation,
но broad Stage G implementation не выполнять.

---

# 46. API CONTRACT

Audit current endpoints:

```text
GET /api/v1/dashboard/decision-signals
GET /api/v1/dashboard/decision-signals/:id
POST .../acknowledge
POST .../resolve
POST .../dismiss
```

Использовать actual routes из HEAD.

Если queue требует summary endpoint или richer presentation DTO,
предпочитать минимальное extension существующего API.

Не создавать duplicate `/attention-items` API.

---

# 47. API QUERY CONTRACT

Поддержать/проверить:

```text
status
category
code
pagination
```

Если active queue требует multi-status:

```text
OPEN + ACKNOWLEDGED
```

и API поддерживает только один status,
реализовать clean contract extension либо два bounded requests.

Не хардкодить client-side filtering всей базы signals.

---

# 48. CONCURRENCY / LIFECYCLE SAFETY

Проверить simultaneous lifecycle actions.

Например:

```text
User A resolves
User B acknowledges stale OPEN item
```

Backend должен корректно отклонить invalid transition.

Frontend после mutation должен refresh/reconcile state.

Не считать optimistic UI source of truth.

---

# 49. IDEMPOTENCY

Detector execution сохраняет Stage B fingerprint/idempotency semantics.

Не допустить duplicate queue items из-за:

```text
repeated detector runs
page refresh
multiple workers
retry
```

Добавить tests для representative concurrency/idempotency paths, где architecture это требует.

---

# 50. AUDITABILITY

Lifecycle timestamps уже существуют:

```text
acknowledged
resolved
dismissed
```

Проверить, хранится ли actor/user identity.

Если actor audit отсутствует, классифицировать gap.

Не строить full audit subsystem без roadmap authority,
но Decision Queue actions должны быть traceable настолько, насколько current architecture позволяет.

Если security/compliance требует actor attribution и модель его не имеет,
зарегистрировать downstream remediation.

---

# 51. ACCESSIBILITY

Decision Queue должна быть usable keyboard/screen reader в рамках существующего frontend standard.

Минимально:

```text
buttons have accessible names
status not communicated only by color
loading/error states announced appropriately where conventions exist
links are semantic
```

Не делать отдельный accessibility redesign.

---

# 52. RESPONSIVE UX

Проверить существующие Command Center breakpoints.

Queue должна быть читаема на поддерживаемых viewport.

Не допускать horizontal overflow из-за evidence/entity identifiers.

---

# 53. I18N — RU / AZ / EN

Все новые user-facing strings должны быть локализованы:

```text
RU
AZ
EN
```

Проверить:

```text
signal titles
statuses
categories
filters
empty state
error state
lifecycle actions
timestamps/relative time labels
entity labels
```

Не оставлять raw keys.

---

# 54. TIME / TIMEZONE

Для:

```text
firstDetected
lastDetected
SLA age
```

использовать canonical project timezone semantics.

Не смешивать server UTC timestamps с неправильным client interpretation.

Если project stores UTC and renders localized time — сохранить existing convention.

---

# 55. REQUIRED BACKEND TESTS

Минимально доказать:

```text
list active signals
status filter
category filter
code filter where supported
pagination
RBAC list
RBAC get
RBAC acknowledge
RBAC resolve
RBAC dismiss
valid lifecycle transitions
invalid lifecycle transitions
detector dedup
resolved → recurrence/new signal
detector failure isolation
representative evidence
queue ordering
```

Если добавлены новые detectors — для каждого:

```text
condition true → signal
condition false → no signal
same condition → reobserve, not duplicate
evidence correct
fingerprint deterministic
```

---

# 56. REQUIRED FRONTEND TESTS

Минимально:

```text
Decision Queue renders active items
human-readable title
status
factual evidence
affected entities/scope
first/last detected
Acknowledge action
Resolve action
Dismiss action
invalid action hidden
status filter
category filter
pagination/load more
loading
empty
error
mutation refresh
RU
AZ
EN
no raw keys
no fake WHY
no fake IMPACT
no fake recommended ACTION
```

---

# 57. REQUIRED E2E / INTEGRATION TESTS

Проверить full representative flow:

```text
detector condition exists
→ detector runs
→ DecisionSignal created
→ API returns signal
→ authorized user sees queue item
→ user acknowledges
→ state updates
→ user resolves
→ active queue no longer shows it
→ history shows resolved signal
```

Также:

```text
unauthorized role
→ cannot retrieve/manipulate signal
```

---

# 58. RUNTIME / BROWSER ACCEPTANCE — MANDATORY

Stage C нельзя закрыть только unit tests.

Запустить реальный доступный stack.

В browser/runtime проверить:

```text
1. PLATFORM Command Center opens.
2. Needs Attention renders Decision Queue.
3. At least one real/seeded representative DecisionSignal is visible.
4. Human-readable title is shown.
5. Factual evidence is visible.
6. Lifecycle action works.
7. Queue updates after mutation.
8. Filters work.
9. Empty/history state works.
10. No raw technical signal code is used as primary UI label.
11. No fake WHY/IMPACT/ACTION is shown.
12. AZN regression remains fixed.
```

---

# 59. SCREENSHOT EVIDENCE — MANDATORY

Для `VERDICT A` приложить runtime screenshot evidence минимум:

```text
A. active Decision Queue with representative item
B. lifecycle/history or post-action state
```

На screenshot не должны попадать secrets/tokens.

Source-code screenshot не считается runtime evidence.

---

# 60. NETWORK / API EVIDENCE

Для representative signal показать sanitized evidence:

```text
request URL
HTTP status
signal id/code/category/status
affectedEntities
relevant evidence fields
```

После lifecycle mutation:

```text
status before
action
HTTP status
status after
```

---

# 61. CURRENT NEEDS ATTENTION MIGRATION STRATEGY

Нельзя просто удалить старые counters.

Выбрать и документировать:

```text
A. counters become summary derived from DecisionSignals
B. counters temporarily coexist with queue
C. some counters remain legacy until detector coverage exists
```

Предпочтение:

```text
authoritative DecisionSignals
→ summary
→ queue
```

где business rules позволяют.

Не поддерживать две расходящиеся authority бесконечно.

---

# 62. NO METRIC DRIFT

Если counter мигрирует в signal-based summary:

```text
old counter condition
```

и:

```text
detector condition
```

должны быть semantically equivalent.

Если нет — объяснить intentional difference.

Не допускать:

```text
counter = 5
queue = 3
```

без объяснимой причины.

---

# 63. PERFORMANCE

Decision Queue не должна ухудшить Command Center.

Проверить:

```text
query count
pagination
indexes
N+1 entity resolution
detector execution cost
frontend request count
```

Использовать существующие DecisionSignal indexes.

Не делать detector scan всей DB на каждый component render.

---

# 64. DATABASE MIGRATION

Stage B уже создал DecisionSignal schema.

Не создавать migration без необходимости.

Если Stage C требует schema extension,
обосновать каждое поле.

Не добавлять поля:

```text
why
impact
recommendedAction
```

только как placeholders для будущих stages.

---

# 65. DOCUMENTATION

Обновить canonical roadmap Stage C status после выполнения.

Не переписывать history.

Добавить ссылку на Stage C report/evidence.

Если архитектурное решение Decision Queue требует ADR update,
предпочитать update существующего Decision Intelligence architecture doc,
а не создавать competing authority.

---

# 66. REQUIRED REPORT FILE

Создать:

```text
docs/prompts/PHASE_3_STAGE_C_NEEDS_ATTENTION_DECISION_QUEUE_IMPLEMENTATION_REPORT.md
```

Отчёт — **на русском языке**.

---

# 67. REQUIRED DELIVERABLE A — CURRENT STATE AUDIT

Вернуть:

| Component | Before Stage C | Gap | Stage C change |
|---|---|---|---|

Минимум:

```text
Needs Attention UI
DecisionSignal API
detectors
lifecycle
filters
RBAC
routing
i18n
runtime detector execution
```

---

# 68. REQUIRED DELIVERABLE B — COUNTER → SIGNAL MATRIX

Вернуть:

| Needs Attention counter | Source condition | DecisionSignal detector | Evidence | Migration status |
|---|---|---|---|---|

Не скрывать uncovered counters.

---

# 69. REQUIRED DELIVERABLE C — QUEUE CONTRACT

Вернуть final queue item contract:

```text
id
code
title
category
status
factual urgency
affected entity summary
evidence summary
firstDetected
lastDetected
observationCount
available lifecycle actions
deep link
```

Для каждого поля:

```text
source
nullable?
user-visible?
```

---

# 70. REQUIRED DELIVERABLE D — WHAT / WHY / IMPACT / ACTION BOUNDARY

Вернуть таблицу:

| Dimension | Stage C status | Source | Future owner |
|---|---|---|---|
| WHAT | ... | ... | ... |
| WHY | NOT IMPLEMENTED | — | Stage D |
| IMPACT | NOT IMPLEMENTED | — | Stage E |
| ACTION | lifecycle/navigation only | ... | Stage F for business action |

Это обязательный anti-scope-drift deliverable.

---

# 71. REQUIRED DELIVERABLE E — RBAC MATRIX

Вернуть:

| Role | Can see Attention? | Signal categories visible | Lifecycle actions | Evidence |
|---|---:|---|---|---|

Использовать actual canonical role matrix.

Проверить server-side behavior.

---

# 72. REQUIRED DELIVERABLE F — DETECTOR EXECUTION

Вернуть:

```text
Detector execution mechanism:
Trigger:
Frequency/event:
Failure isolation:
Dedup mechanism:
Runtime proof:
```

Если механизм изменён — объяснить почему.

---

# 73. REQUIRED DELIVERABLE G — LIFECYCLE EVIDENCE

Показать representative flow:

```text
OPEN
→ ACKNOWLEDGED
→ RESOLVED
```

и:

```text
OPEN
→ DISMISSED
```

с API/test/runtime evidence.

---

# 74. REQUIRED DELIVERABLE H — PERFORMANCE

Вернуть:

```text
Decision Queue query count:
Pagination:
N+1 present: YES/NO
Detector execution on render: YES/NO
Relevant DB indexes:
Observed runtime/API latency:
```

Не выдумывать benchmark, если не измерялся.

---

# 75. REQUIRED DELIVERABLE I — FILES CHANGED

Точное количество:

```text
Total changed files: N

Backend:
Frontend:
Tests:
Docs:
Migrations:
```

Не допускать mismatch между count и списком.

---

# 76. REQUIRED DELIVERABLE J — TEST RESULTS

Вернуть фактические counts:

```text
DecisionSignal unit:
Dashboard unit:
Command Center E2E:
RBAC E2E:
Backend full unit:
Backend TSC:
Backend build:
Frontend Vitest:
Frontend TSC:
Frontend build:
Browser/runtime acceptance:
DB migrations:
```

---

# 77. REQUIRED DELIVERABLE K — RUNTIME EVIDENCE

Вернуть:

```text
Runtime commit SHA:
Backend SHA:
Frontend SHA:
Browser environment/URL:
Representative signal code:
Representative signal status:
Lifecycle mutation tested:
Decision Queue visible: YES/NO
Filters tested: YES/NO
History tested: YES/NO
Unexpected raw signal keys: YES/NO
Fake WHY present: YES/NO
Fake IMPACT present: YES/NO
Fake recommended ACTION present: YES/NO
Unexpected $ in PLATFORM aggregate money: YES/NO
```

---

# 78. REQUIRED DELIVERABLE L — OPEN GAPS

После Stage C перечислить только реальные remaining gaps.

Минимально проверить:

```text
WHY Attribution
Impact Scoring
Business Action Routing
AI Decision Feed reconciliation
uncovered Needs Attention detectors
actor audit if missing
deep links not yet supported
commission reversal implementation
financial Stage H/I gaps
```

Для каждого:

```text
owner stage
severity
blocking/non-blocking
```

---

# 79. ROADMAP UPDATE

После успешного Stage C обновить canonical roadmap:

```text
Stage C — Needs Attention → Decision Queue
→ VERDICT A — COMPLETE
```

с:

```text
report path
commit SHA
runtime evidence
dependencies
next-stage readiness
```

Не запускать Stage D автоматически.

---

# 80. GIT EVIDENCE

Вернуть:

```text
Starting HEAD:
Final HEAD:
Commit(s):
Pushed to origin: YES/NO
Working tree clean: YES/NO
```

Не заявлять push без проверки.

---

# 81. ACCEPTANCE INVARIANTS

Для закрытия Stage C обязательно:

```text
1. DecisionSignal remains single source of truth.
2. Needs Attention is no longer counters-only.
3. Real Decision Queue exists.
4. Queue uses structured factual evidence.
5. Lifecycle works from UI through backend.
6. Status/history filtering works.
7. RBAC is server-side.
8. Unauthorized signal access/actions are denied.
9. At least representative runtime detector populates queue.
10. No duplicate signal engine exists.
11. No fake severity/impact exists.
12. No fake WHY exists.
13. No fake business recommendation exists.
14. Deep links are deterministic where supported.
15. Loading/empty/error states exist.
16. RU/AZ/EN are complete.
17. Pagination exists.
18. No uncontrolled N+1 / detector-on-render behavior.
19. B.2 AZN fixes remain intact.
20. Runtime/browser evidence is provided.
21. Tests/builds are green.
22. Roadmap is updated.
23. Final report is in Russian.
```

---

# 82. VERDICT

Вернуть ровно один.

## VERDICT A — STAGE C COMPLETE

Только если:

- Needs Attention преобразован из counters-only surface в рабочую Decision Queue;
- DecisionSignal остаётся authoritative source;
- representative signals реально появляются в runtime;
- queue lifecycle работает;
- filters/history работают;
- RBAC проверен server-side;
- structured evidence отображается;
- WHAT представлен ясно;
- WHY/IMPACT/business ACTION не сфабрикованы;
- browser/runtime evidence предоставлен;
- B.2 AZN regression отсутствует;
- tests/builds green;
- roadmap обновлён;
- отчёт предоставлен на русском языке.

## VERDICT B — STAGE C REMEDIATION REQUIRED

Если queue реализована частично, но остаются проблемы в lifecycle, RBAC, detector coverage,
runtime population, UX states, i18n, performance, tests или evidence.

## VERDICT C — BLOCKED

Если Stage C невозможно корректно завершить из-за отсутствующей prerequisite authority/capability.

Указать:

```text
exact blocker
why it blocks
smallest prerequisite
owner stage
```

Не использовать VERDICT C для обычных исправимых implementation defects.

---

# 83. STOP

После Stage C:

**STOP.**

Не запускать автоматически:

```text
Stage D — WHY Attribution
Stage E — Impact
Stage F — Action Routing
Stage G — AI Decision Feed
Stage H
Stage I
Stage J
Stage 2.14.x
```

Вернуть полный Stage C report **на русском языке** и ждать review.
