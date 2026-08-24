# PHASE 3 --- STAGE F

# EVIDENCE-BASED ACTION

## CANONICAL ACTION AUTHORITY / DECISION LOOP CLOSURE

## IMPLEMENTATION PROMPT

------------------------------------------------------------------------

## 1. ОБЯЗАТЕЛЬНОЕ ТРЕБОВАНИЕ К ЯЗЫКУ

Все ответы разработчика, findings, планы, root-cause analysis,
implementation notes, таблицы, результаты тестов, runtime evidence и
финальный отчёт должны быть предоставлены **НА РУССКОМ ЯЗЫКЕ**.

Technical identifiers, code, paths, API routes, enums, commands, SHA и
commit messages могут сохраняться в оригинальном виде.

------------------------------------------------------------------------

# 2. ВХОДНОЙ СТАТУС

Перед Stage F подтверждено:

``` text
Stage C — WHAT                         COMPLETE
Stage D — WHY                          COMPLETE
Stage E — IMPACT                       COMPLETE

Decision Queue localization            VERIFIED
AI Decision Feed reconciliation        VERIFIED
Financial No-Fabrication               CLOSED
AI Feed ACTION authority conflict      CLOSED
```

Canonical Decision Loop:

``` text
WHAT → WHY → IMPACT → ACTION
 C      D       E        F
 ✅     ✅      ✅       ← IMPLEMENT NOW
```

Stage F разрешён к реализации.

------------------------------------------------------------------------

# 3. ЦЕЛЬ STAGE F

Добавить **Evidence-Based ACTION** как четвёртый canonical элемент
Decision Loop.

ACTION должен отвечать на вопрос:

> Что уполномоченный пользователь может сделать с конкретной
> обнаруженной ситуацией, основываясь на доказанном WHAT / WHY / IMPACT?

Stage F не является:

``` text
generic AI recommendation generator
LLM action generator
arbitrary automation engine
financial forecasting engine
opaque priority scoring engine
```

------------------------------------------------------------------------

# 4. CANONICAL FLOW

Целевая архитектура:

``` text
DecisionSignal
    │
    ├── WHAT
    │
    ├── WHY
    │
    ├── IMPACT
    │
    └── ACTION
          │
          ├── available actions
          ├── eligibility
          ├── required permission
          ├── target
          ├── evidence/rationale
          ├── execution mode
          └── lifecycle/audit
```

ACTION не должен существовать без traceable source signal.

------------------------------------------------------------------------

# 5. SINGLE SOURCE OF TRUTH

`DecisionSignal` остаётся canonical source of truth для Decision Queue.

Stage F не должен создавать параллельную:

``` text
ActionSignal
RecommendationSignal
AIAction
```

с независимой бизнес-истиной, если для этого нет доказанной
архитектурной необходимости.

Если отдельная persistence model нужна для **action execution/audit**,
она должна ссылаться на canonical DecisionSignal.

------------------------------------------------------------------------

# 6. AI DECISION FEED BOUNDARY

AI Decision Feed после reconciliation является:

``` text
Category B — Separate informational insight
```

Он:

``` text
может показывать factual informational insights
не создаёт fabricated financial impact
не является ACTION authority
```

Stage F не должен автоматически превращать каждый AI Feed insight в
действие.

Не возвращать удалённые:

``` text
Consider increasing exposure
Review pricing/content
Consider reactivation or replacement
```

без canonical Stage F action contract.

------------------------------------------------------------------------

# 7. ACTION CONTRACT --- REQUIRED

Спроектировать typed contract минимум с семантикой:

``` ts
ActionDefinition {
  actionCode
  signalCode
  titleKey
  descriptionKey?
  actionType
  targetType
  targetId?
  requiredPermission
  executionMode
  eligibility
  rationale
  parameters?
  confirmationRequired
}
```

Конкретные имена типов адаптировать к repository conventions.

Не копировать этот интерфейс механически, если существующая архитектура
требует другой формы.

------------------------------------------------------------------------

# 8. ACTION TYPE

Определить ограниченный enum.

Например:

``` text
NAVIGATE
REVIEW
CONTACT
RETRY
PROCESS
ASSIGN
OPEN_ENTITY
```

Добавлять только реально поддерживаемые действия.

Не создавать фиктивные действия ради покрытия всех сигналов.

------------------------------------------------------------------------

# 9. EXECUTION MODE

Каждое действие должно явно иметь execution semantics:

``` text
NAVIGATION_ONLY
MANUAL_WORKFLOW
SERVER_COMMAND
```

Если backend command ещё не существует, нельзя изображать действие как
выполненное.

Пример:

``` text
"Открыть возвраты" → NAVIGATION_ONLY
```

допустимо.

Но:

``` text
"Вернуть деньги"
```

нельзя реализовать как кнопку, если безопасного refund command contract
нет.

------------------------------------------------------------------------

# 10. EVIDENCE-BASED PRINCIPLE

Для каждого ACTION вернуть rationale, основанный только на:

``` text
signal evidence
WHY
IMPACT
known entity state
permissions
```

Запрещены:

``` text
fabricated rationale
invented financial benefit
arbitrary urgency
LLM-created facts
```

------------------------------------------------------------------------

# 11. NO-FABRICATION CONTINUES

Stage E / AI Feed policy остаётся обязательной.

ACTION не может утверждать:

``` text
"Сделайте X и получите +500 ₼"
"Это увеличит продажи на 20%"
"Вы потеряете 1000 ₼, если не выполнить"
```

без отдельной доказуемой authority.

------------------------------------------------------------------------

# 12. ACTION ELIGIBILITY

Доступность action должна зависеть от реального состояния объекта.

Пример:

``` text
FAILED_PAYMENT
→ retry/review допустим только если payment/order state это разрешает

PENDING_REFUND
→ process/review только если refund действительно pending

BOOKING_CONFIRMATION_DELAY
→ booking уже confirmed/cancelled
→ action больше не должен предлагаться как executable
```

Не определять eligibility только по старому snapshot evidence.

------------------------------------------------------------------------

# 13. RE-OBSERVATION SAFETY

DecisionSignal уже имеет lifecycle и может re-observe condition.

Проверить взаимодействие ACTION с:

``` text
OPEN
ACKNOWLEDGED
RESOLVED
DISMISSED
```

Action execution не должен автоматически означать:

``` text
signal RESOLVED
```

если business condition фактически ещё существует.

------------------------------------------------------------------------

# 14. SIGNAL LIFECYCLE ≠ ACTION LIFECYCLE

Зафиксировать различие:

``` text
Signal lifecycle:
OPEN → ACKNOWLEDGED → RESOLVED / DISMISSED

Action lifecycle:
available → initiated/executed/failed/etc.
```

Не смешивать их в один status enum.

Если persistence action lifecycle не нужен на Stage F, явно
документировать это.

------------------------------------------------------------------------

# 15. ACTION AUDIT TRAIL

Для server-side executable actions обеспечить auditability минимум:

``` text
who
what action
source signal
target
timestamp
result
```

Если существующая audit infrastructure уже есть --- переиспользовать её.

Не создавать дублирующий audit subsystem без необходимости.

------------------------------------------------------------------------

# 16. IDEMPOTENCY

Для mutating server commands определить idempotency policy.

Особенно:

``` text
payment retry
refund processing
booking operation
```

Не выполнять destructive/financial command дважды из-за double
click/retry.

Если конкретный command не имеет безопасной idempotency authority, не
включать его как executable action на Stage F.

------------------------------------------------------------------------

# 17. RBAC --- SERVER-SIDE AUTHORITY

Frontend-hidden action ≠ security.

Каждое privileged action должно иметь server-side permission
enforcement.

Contract должен содержать/выводить:

``` text
requiredPermission
```

но backend всё равно обязан самостоятельно проверять permission.

------------------------------------------------------------------------

# 18. ROLE / PERMISSION RECONCILIATION

Использовать существующую role/permission architecture.

Не вводить новый параллельный RBAC.

Для каждого action вернуть:

``` text
required permission
eligible roles via current permission matrix
server enforcement location
frontend visibility behavior
```

Admin может управлять доступом через существующую permission model ---
не hardcode роли, если система уже authority-based по permissions.

------------------------------------------------------------------------

# 19. SIX SIGNAL TYPES

Stage F должен рассмотреть все текущие canonical Decision Queue signals:

``` text
BOOKING_CONFIRMATION_DELAY
FAILED_PAYMENTS
RECENT_CANCELLATIONS
PENDING_REFUNDS
UPCOMING_BOOKINGS
SERVICES_WITHOUT_SALES
```

Но **не обязан создавать executable action для каждого**.

------------------------------------------------------------------------

# 20. BOOKING_CONFIRMATION_DELAY

Определить доказуемые действия.

Возможные категории для аудита:

``` text
open affected bookings
review booking
contact/assign responsible operator
```

Не добавлять автоматическое подтверждение бронирования без существующей
business authority.

------------------------------------------------------------------------

# 21. FAILED_PAYMENTS

Возможные действия проверить против существующего payment architecture:

``` text
open failed payments
review payment/order
retry only if existing safe retry workflow exists
contact customer only if supported
```

Не создавать новый payment engine в Stage F.

------------------------------------------------------------------------

# 22. RECENT_CANCELLATIONS

Это может быть primarily analytical signal.

Допустимые actions могут быть:

``` text
open affected orders
review cancellation details
```

Если structured cancellation reason отсутствует, не предлагать action,
основанный на выдуманной причине.

------------------------------------------------------------------------

# 23. PENDING_REFUNDS

Проверить существующий refund workflow.

Возможные действия:

``` text
open pending refund
review refund
process refund ONLY if canonical safe command exists
```

Stage B.1 limitation помнить:

``` text
Marketplace commission reversal
→ separate Stage 2.14.x implementation
```

Не реализовывать commission reversal внутри Stage F.

------------------------------------------------------------------------

# 24. UPCOMING_BOOKINGS

Этот signal Stage E классифицировал как INFORMATIONAL.

Не превращать informational state в искусственную проблему.

ACTION может быть:

``` text
open upcoming bookings
review schedule
```

без negative/fabricated urgency.

------------------------------------------------------------------------

# 25. SERVICES_WITHOUT_SALES

Действия должны быть evidence-based.

Например:

``` text
open service
review availability
open catalog item
```

Если evidence показывает:

``` text
withoutAvailabilityCount > 0
```

можно предложить review availability.

Но нельзя утверждать:

``` text
"Добавьте availability и получите X продаж"
```

------------------------------------------------------------------------

# 26. TARGET SEMANTICS

Action должен иметь однозначную цель:

``` text
BOOKING
ORDER
PAYMENT
REFUND
PRODUCT/SERVICE
LIST
WORKSPACE
```

Если signal агрегирует 168 объектов, action может вести:

``` text
к filtered list
```

а не к фиктивному единственному `targetId`.

------------------------------------------------------------------------

# 27. FILTERED NAVIGATION

Для aggregate signals предпочтительно поддержать deterministic
navigation context:

``` text
route
filters
signal context
```

Пример семантики:

``` text
FAILED_PAYMENTS
→ Payments page
→ status=FAILED
→ relevant period/scope
```

Не hardcode URL в business service, если repository имеет route
abstraction.

------------------------------------------------------------------------

# 28. ACTION PRESENTATION

В Decision Queue после WHAT/WHY/IMPACT добавить ACTION block.

Целевой порядок:

``` text
WHAT
Evidence
WHY
IMPACT
ACTION
Signal lifecycle controls
```

Не смешивать:

``` text
ACTION
```

с существующими:

``` text
Acknowledge
Resolve
Dismiss
```

Это разные понятия.

------------------------------------------------------------------------

# 29. ACTION UI

Для каждого доступного action показывать:

``` text
localized title
optional concise rationale
target/context
disabled reason if relevant
confirmation only when required
```

Не перегружать карточку большим количеством кнопок.

Если actions много, использовать existing design pattern/menu.

------------------------------------------------------------------------

# 30. ACTION VS LIFECYCLE CONTROLS

Существующие:

``` text
Acknowledge
Resolve
Dismiss
```

являются lifecycle controls DecisionSignal.

Новые:

``` text
Open booking
Review refund
Open failed payments
Review availability
```

являются business actions.

UI должен визуально и семантически разделять их.

------------------------------------------------------------------------

# 31. LOCALIZATION

Все ACTION элементы должны иметь RU/AZ/EN.

Запрещено:

``` text
backend hardcoded RU
backend hardcoded EN
raw actionCode in UI
raw enum in UI
```

Использовать:

``` text
titleKey
descriptionKey
reasonKey / structured params
```

или эквивалент существующей architecture.

------------------------------------------------------------------------

# 32. CANONICAL LANGUAGE EXAMPLES

Не считать эти строки обязательной копией, но сохранить смысл:

``` text
RU:
Действия
Открыть бронирования
Проверить платёж
Открыть возвраты
Проверить доступность

AZ:
Əməliyyatlar
Bronları aç
Ödənişi yoxla
Geri qaytarmaları aç
Əlçatanlığı yoxla

EN:
Actions
Open bookings
Review payment
Open refunds
Review availability
```

------------------------------------------------------------------------

# 33. ACTION AVAILABILITY REASON

Если action нельзя выполнить, предпочтительно:

``` text
не показывать
```

или показать disabled только если это UX-полезно и есть точная причина.

Не показывать generic:

``` text
Action unavailable
```

без необходимости.

------------------------------------------------------------------------

# 34. DETERMINISM

Для одинакового:

``` text
signal code
evidence
entity state
permissions
```

набор available actions должен быть одинаковым.

LLM не должен выбирать доступность executable action.

------------------------------------------------------------------------

# 35. AI/LLM BOUNDARY

AI может в будущем помогать объяснять action, но:

``` text
available action set
permission
eligibility
target
execution mode
financial effect
```

должны быть deterministic/authoritative.

------------------------------------------------------------------------

# 36. ACTION PRIORITY

Не вводить opaque score:

``` text
87% recommended
priority 9.3/10
AI confidence 94%
```

без отдельной canonical methodology.

Если порядок действий нужен, использовать deterministic business
ordering и документировать его.

------------------------------------------------------------------------

# 37. DATA MODEL AUDIT FIRST

До реализации провести аудит существующих:

``` text
DecisionSignal model
Audit model/infrastructure
permissions
booking commands
payment commands
refund commands
order routes
catalog/service routes
frontend routing
```

Не создавать новые сущности, пока не доказано, что existing architecture
недостаточна.

------------------------------------------------------------------------

# 38. MIGRATION POLICY

Если Stage F можно реализовать derived-on-read + existing audit:

``` text
0 migrations preferred
```

Если persistence нужна для executed action audit/idempotency:

``` text
migration allowed only with justification
```

Вернуть решение в отчёте.

------------------------------------------------------------------------

# 39. PERFORMANCE

Action derivation не должна создавать N+1 queries на каждую карточку.

Цель:

``` text
deterministic
bounded
no per-action uncontrolled DB fan-out
```

Замерить Command Center endpoint до/после.

------------------------------------------------------------------------

# 40. FAILURE SAFETY

Ошибка derivation одного action не должна:

``` text
падать весь Command Center
скрывать остальные signals
автоматически выполнять действие
```

Но не использовать silent catch, скрывающий defect без observability.

------------------------------------------------------------------------

# 41. EXECUTION SAFETY

Для server command:

``` text
validate signal
re-read current target state
authorize
validate eligibility
execute
audit
return result
```

Не доверять stale frontend DTO.

------------------------------------------------------------------------

# 42. CONCURRENCY

Для mutating action проверить race cases:

``` text
two operators execute same action
signal changes while action is open
entity state changes before click
double click
request retry
```

Использовать существующие transaction/locking/idempotency patterns.

------------------------------------------------------------------------

# 43. SIGNAL RESOLUTION AFTER ACTION

Не делать универсально:

``` text
action success → signal RESOLVED
```

Вместо этого:

``` text
action executes
→ detector/re-observation determines whether condition still exists
→ signal lifecycle follows existing rules
```

Если для конкретного action безопасно resolve immediately --- доказать
отдельно.

------------------------------------------------------------------------

# 44. REQUIRED BACKEND CONTRACT

Command Center API должен вернуть structured action data.

Пример семантики:

``` json
{
  "actions": [
    {
      "actionCode": "OPEN_FAILED_PAYMENTS",
      "titleKey": "cc.action.openFailedPayments",
      "actionType": "NAVIGATE",
      "executionMode": "NAVIGATION_ONLY",
      "requiredPermission": "payments.read",
      "target": {
        "type": "LIST"
      }
    }
  ]
}
```

Это illustrative, не обязательный exact schema.

------------------------------------------------------------------------

# 45. НЕ ВОЗВРАЩАТЬ READY-MADE SENTENCES ИЗ BACKEND

Backend должен отдавать semantic contract.

Не:

``` json
{
  "action": "Проверьте неуспешные платежи"
}
```

------------------------------------------------------------------------

# 46. API EXECUTION ROUTES

Создавать mutation endpoint только если есть реальное executable action.

Не создавать generic:

``` text
POST /decision-signals/:id/action
```

который динамически выполняет arbitrary commands без typed server
authority.

Предпочитать explicit typed handlers/commands.

------------------------------------------------------------------------

# 47. AUDIT EXISTING ROUTES BEFORE NEW ROUTES

Если action = navigation:

``` text
новый backend endpoint не нужен
```

Если existing domain endpoint уже выполняет operation:

``` text
reuse it
```

не дублировать command только ради Decision Queue.

------------------------------------------------------------------------

# 48. FRONTEND NAVIGATION

Navigation action должен:

``` text
открыть существующий рабочий центр
передать корректный filter/context
не терять workspace scope
не обходить entitlement/RBAC
```

------------------------------------------------------------------------

# 49. WORKSPACE CONTEXT

Соблюдать canonical hierarchy:

``` text
IDENTITY
→ WORKSPACE CONTEXT
→ TENANT/PARTNER SCOPE
→ PLAN/ENTITLEMENTS
→ BUSINESS CAPABILITIES
→ ROLE/PERMISSIONS
```

Stage F не должен позволять action за пределами текущего workspace
scope.

------------------------------------------------------------------------

# 50. PLATFORM VS PARTNER

Текущий Stage F scope должен соответствовать Command Center context.

Не переносить PLATFORM actions автоматически в PARTNER/Storefront.

Если action applicability зависит от workspace:

``` text
явно encode eligibility/scope
```

------------------------------------------------------------------------

# 51. SECURITY TESTS

Минимум проверить:

``` text
authorized user sees/executes allowed action
unauthorized user cannot execute server command
frontend-hidden action still denied server-side
cross-workspace target denied
stale/ineligible target rejected
```

------------------------------------------------------------------------

# 52. ACTION MATRIX --- REQUIRED BEFORE IMPLEMENTATION

До изменения кода создать фактическую matrix:

  --------------------------------------------------------------------------------------------------
  Signal                       Candidate   Type       Execution   Target     Permission   Safe now?
                               Action                 Mode                                
  ---------------------------- ----------- ---------- ----------- ---------- ------------ ----------
  BOOKING_CONFIRMATION_DELAY                                                              

  FAILED_PAYMENTS                                                                         

  RECENT_CANCELLATIONS                                                                    

  PENDING_REFUNDS                                                                         

  UPCOMING_BOOKINGS                                                                       

  SERVICES_WITHOUT_SALES                                                                  
  --------------------------------------------------------------------------------------------------

Не реализовывать unsafe candidate.

------------------------------------------------------------------------

# 53. MINIMUM VIABLE STAGE F

Stage F считается полноценным даже если первая версия в основном
использует:

``` text
NAVIGATION_ONLY
REVIEW
```

actions.

Не нужно искусственно добавлять mutating commands ради слова ACTION.

Безопасная навигация к правильному рабочему объекту --- валидный
evidence-based action.

------------------------------------------------------------------------

# 54. TESTING --- BACKEND

Добавить tests минимум на:

``` text
6 signal action derivations
determinism
eligibility
permission metadata
workspace scope
no fabricated financial claims
no action for unsupported condition
re-observation/stale-state safety where applicable
```

------------------------------------------------------------------------

# 55. TESTING --- FRONTEND

Проверить:

``` text
ACTION block renders
RU/AZ/EN localization
correct action count
correct labels
navigation action
lifecycle controls remain separate
no raw action codes
no raw i18n keys
```

------------------------------------------------------------------------

# 56. BROWSER RUNTIME --- MANDATORY

Проверить реальный browser DOM.

Минимум:

``` text
RU → all 6 signal types
AZ → representative actions
EN → representative actions
```

Для RU желательно actual DOM dump всех 6 карточек.

------------------------------------------------------------------------

# 57. BROWSER INTERACTION

Для navigation actions реально нажать и доказать:

``` text
correct destination
correct filter/context
workspace preserved
no console/runtime error
```

Для server action, если такой безопасно реализован:

``` text
execute
verify domain state
verify audit
verify repeat/idempotency behavior
```

------------------------------------------------------------------------

# 58. REGRESSION GATES

После Stage F обязательно сохранить:

``` text
WHAT          unchanged/valid
WHY           valid
IMPACT        valid
AI Feed       no fabrication
AZN           preserved
Decision Queue localization preserved
signal lifecycle preserved
```

------------------------------------------------------------------------

# 59. NO FINANCIAL SEMANTIC REGRESSION

Проверить отсутствие:

``` text
+AZN/week
arbitrary financial uplift
GMV labeled revenue
affected volume labeled profit/loss
raw USD/$
```

------------------------------------------------------------------------

# 60. PERFORMANCE EVIDENCE

Вернуть:

``` text
Command Center before Stage F:
Command Center after Stage F:
delta:
additional queries:
N+1 present: YES/NO
```

------------------------------------------------------------------------

# 61. REQUIRED DELIVERABLE A --- ARCHITECTURE AUDIT

``` text
Existing DecisionSignal authority:
Existing domain commands:
Existing permissions:
Existing audit:
Existing idempotency:
Existing frontend routes:
Migration required: YES/NO
Reason:
```

------------------------------------------------------------------------

# 62. REQUIRED DELIVERABLE B --- FINAL ACTION MATRIX

  -----------------------------------------------------------------------------------
  Signal     Implemented   Type       Execution   Permission   Target     Rationale
             Action                                                       
  ---------- ------------- ---------- ----------- ------------ ---------- -----------

  -----------------------------------------------------------------------------------

Все 6 signals должны присутствовать, даже если для какого-либо:

``` text
No executable action — informational only
```

------------------------------------------------------------------------

# 63. REQUIRED DELIVERABLE C --- ACTION CONTRACT

Показать final backend/frontend contract:

``` text
types
fields
enums
eligibility
permission
target
localization
```

------------------------------------------------------------------------

# 64. REQUIRED DELIVERABLE D --- RBAC

Для каждого action:

``` text
required permission:
server-side enforcement:
frontend visibility:
workspace enforcement:
```

------------------------------------------------------------------------

# 65. REQUIRED DELIVERABLE E --- LIFECYCLE

Объяснить:

``` text
Action performed:
Signal status before:
Signal status immediately after:
Re-observation behavior:
When signal becomes RESOLVED:
```

------------------------------------------------------------------------

# 66. REQUIRED DELIVERABLE F --- RUNTIME

Для каждой из 6 RU signal cards показать:

``` text
signal
WHY
IMPACT
ACTION
lifecycle controls
```

Можно concise DOM dump, но он должен быть actual runtime output.

------------------------------------------------------------------------

# 67. REQUIRED DELIVERABLE G --- LOCALIZATION

``` text
RU raw action keys = 0
AZ raw action keys = 0
EN raw action keys = 0

RU EN/AZ system leaks = 0
AZ RU/EN system leaks = 0
EN RU/AZ system leaks = 0
```

------------------------------------------------------------------------

# 68. REQUIRED DELIVERABLE H --- TEST RESULTS

Точные значения:

``` text
New Stage F tests:
Backend:
Frontend:
Backend TSC:
Frontend TSC:
Backend build:
Frontend build:
Browser:
Security:
Performance:
```

------------------------------------------------------------------------

# 69. REQUIRED DELIVERABLE I --- FILES / GIT

``` text
Starting HEAD:
Final HEAD:
Files changed:
New files:
Migrations:
Commit:
Pushed to origin:
Working tree clean:
```

------------------------------------------------------------------------

# 70. DOCUMENTATION

Создать:

``` text
docs/prompts/PHASE_3_STAGE_F_EVIDENCE_BASED_ACTION_IMPLEMENTATION_REPORT.md
```

Отчёт полностью на русском.

При необходимости additive update canonical roadmap:

``` text
Stage F → COMPLETE
```

только после VERDICT A.

------------------------------------------------------------------------

# 71. НЕ РЕАЛИЗОВЫВАТЬ В STAGE F

Не делать:

``` text
commission reversal Stage 2.14.x
Employee Performance implementation
Storefront subscription redesign
LLM financial forecasting
opaque action scoring
automatic action execution
bulk destructive automation
Stage G/H/I/J
```

------------------------------------------------------------------------

# 72. ACCEPTANCE CRITERIA

VERDICT A разрешён только если:

1.  ACTION contract typed и deterministic.
2.  Все actions traceable к DecisionSignal.
3.  Все 6 signal types имеют audited action disposition.
4.  Unsafe actions не реализованы.
5.  Execution mode explicit.
6.  Eligibility проверяется по current state.
7.  Server-side RBAC действует для privileged commands.
8.  Workspace scope не обходится.
9.  Lifecycle controls отделены от business actions.
10. Action success не приводит универсально к ложному RESOLVED.
11. Audit есть для mutating actions.
12. Idempotency/concurrency учтены для mutating actions.
13. No fabricated financial impact.
14. AI Feed не становится ACTION authority.
15. RU/AZ/EN localization verified.
16. Browser interaction verified.
17. Existing WHAT/WHY/IMPACT regression PASS.
18. AI Feed no-fabrication regression PASS.
19. AZN authority preserved.
20. Performance acceptable; no uncontrolled N+1.
21. Tests/build/TSC PASS.
22. Report на русском.
23. Stage G/H/I/J не запускались автоматически.

------------------------------------------------------------------------

# 73. FINAL VERDICT

Вернуть ровно один:

## VERDICT A --- STAGE F COMPLETE / EVIDENCE-BASED ACTION AUTHORITY VERIFIED / DECISION LOOP CLOSED

или:

## VERDICT B --- STAGE F REMEDIATION REQUIRED

Разделить unresolved findings:

``` text
Action contract:
Eligibility:
RBAC:
Workspace:
Execution:
Audit:
Idempotency:
Lifecycle:
Localization:
Runtime:
Performance:
Tests:
```

или:

## VERDICT C --- BLOCKED / ACTION AUTHORITY ARCHITECTURE GAP

Только если безопасная Stage F implementation требует отдельного
architecture decision.

------------------------------------------------------------------------

# 74. STOP

После отчёта:

**STOP.**

Не запускать автоматически следующие stages.

Дождаться review и отдельного разрешения.
