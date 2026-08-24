# PHASE 3 — PRE-STAGE-E FINAL CLOSURE
## DECISION QUEUE EVIDENCE PRESENTATION REMEDIATION
## + EMPLOYEE PERFORMANCE ARCHITECTURE FORMALIZATION

---

# LANGUAGE REQUIREMENT — MANDATORY

Все ответы разработчика, findings, таблицы, результаты тестов, runtime/browser evidence,
архитектурные выводы, roadmap updates и финальный VERDICT должны быть предоставлены
**НА РУССКОМ ЯЗЫКЕ**.

Технические identifiers, field names, paths, keys, endpoints, enums, SHA, commands и code
сохранять в оригинальном виде.

---

# 1. CONTEXT

Перед Stage E уже закрыты:

```text
Stage A — Granular RBAC                         → COMPLETE
Stage B — Decision Signal Foundation            → COMPLETE
Stage B.1 — Business / Financial Authority      → FULLY CLOSED
Stage B.2 — Executive financial semantic hotfix → COMPLETE
Stage C — Decision Queue                        → COMPLETE
Stage D — Deterministic WHY Attribution         → COMPLETE
Post-seed Stage D validation                    → COMPLETE
Command Center KPI financial audit              → COMPLETE
GMV lifecycle / collection / refund semantics   → CLOSED
GMV i18n runtime remediation                    → COMPLETE
GMV display rounding reconciliation             → COMPLETE
```

Stage E пока НЕ запускать.

Перед ним необходимо закрыть два уже известных вопроса:

```text
A. Decision Queue показывает raw system evidence keys.
B. Existing Employees architecture должна явно содержать обязательную
   Employee Performance Evaluation capability.
```

---

# 2. THIS PROMPT HAS TWO STRICTLY SEPARATED SCOPES

## Scope A — IMPLEMENTATION REMEDIATION

Исправить presentation contract Decision Queue.

## Scope B — ARCHITECTURE / ROADMAP FORMALIZATION ONLY

Зафиксировать Employee Performance Evaluation как обязательную capability
в уже существующем Employees domain.

Не реализовывать employee-performance screens, scoring engine или workforce analytics сейчас.

---

# 3. SCOPE A — CURRENT DECISION QUEUE DEFECT

В runtime пользователь видит:

```text
31 опубликованных услуг без заказов

Объектов: 31
Наблюдений: 35

unsoldProductCount: 31
productNames: Baku Night Market Experience, ...
withAvailabilityCount: 0
withoutAvailabilityCount: 31
```

Это unacceptable production presentation.

`DecisionSignal.evidence` — machine-readable contract.

UI НЕ должен автоматически выводить raw evidence field names.

---

# 4. CORE PRESENTATION AUTHORITY

Запретить generic raw renderer типа:

```text
Object.entries(signal.evidence)
→ render key:value
```

для user-facing Decision Queue.

Для каждого supported `signal.code` должен существовать deterministic presentation adapter.

Conceptual:

```text
DecisionSignal.evidence
→ typed presentation adapter
→ localized human-readable sections
```

---

# 5. ALL 6 SIGNAL TYPES — MANDATORY AUDIT

Проверить:

```text
PendingBookingsDetector
FailedPaymentsDetector
RecentCancellationsDetector
PendingRefundsDetector
UpcomingBookingsDetector
ServicesWithoutSalesDetector
```

Для каждого вернуть:

| Signal code | Raw evidence fields | User-visible fields | Hidden technical fields | Presentation adapter |
|---|---|---|---|---|

Нельзя исправить только `ServicesWithoutSales`.

---

# 6. SERVICES WITHOUT SALES — REQUIRED TARGET

Current raw evidence:

```text
unsoldProductCount
productNames
withAvailabilityCount
withoutAvailabilityCount
```

Target user-facing presentation должно быть human-readable.

Пример:

```text
31 опубликованная услуга без заказов

Без доступности: 31
С доступностью: 0

Примеры услуг:
• Baku Night Market Experience
• Sheki Silk Road Bicycle Tour
• Azerbaijan Tea Ceremony
• Baku Sunset Yacht Cruise
• Sheki Palace Garden Tour
+ ещё 26
```

Exact layout адаптировать под current design system.

---

# 7. ARRAY / LONG-LIST PRESENTATION

`productNames` и аналогичные массивы нельзя выводить как одну длинную строку.

Использовать compact list:

```text
first N items
+ ещё X
```

или expandable disclosure.

Не рендерить десятки/сотни names напрямую на карточке.

---

# 8. REMOVE DUPLICATED INFORMATION

Проверить:

```text
Объектов: 31
unsoldProductCount: 31
```

Если это одно и то же business fact — не показывать дважды.

Decision Queue должна быть concise.

---

# 9. OBSERVATION COUNT — PRODUCT VALUE REVIEW

Current:

```text
Наблюдений: 35
```

`observationCount` — технически полезный lifecycle факт,
но не обязательно управленчески полезный KPI.

Проверить, что лучше для пользователя:

```text
A. observationCount
B. firstDetected
C. lastDetected
D. duration / "сохраняется X дней"
```

Не менять Stage B lifecycle semantics.

Если `observationCount` остаётся — объяснить его product meaning.

---

# 10. WHY BLOCK SEPARATION

Stage D WHY уже реализован.

Decision Queue должна визуально различать:

```text
WHAT / evidence
WHY attribution
lifecycle
```

Не смешивать raw evidence с WHY text.

---

# 11. NO IMPACT YET

Stage E ещё не выполнен.

Не добавлять в this remediation:

```text
HIGH
MEDIUM
LOW
impactScore
financialImpact
potentialLoss
severity
```

кроме уже factual evidence, явно помеченного как факт.

---

# 12. NO BUSINESS ACTION YET

Не добавлять recommended business actions.

Разрешены только существующие:

```text
Acknowledge
Resolve
Dismiss
Open entity / navigation
```

Stage F остаётся owner business ACTION.

---

# 13. EVIDENCE LABELS — RU / AZ / EN

Для всех user-visible evidence fields нужны localized labels.

Пример:

```text
unsoldProductCount
→ Услуг без заказов
→ Satışı olmayan xidmətlər
→ Services without orders
```

Но exact mapping должен быть context-sensitive и не дублировать title.

---

# 14. NO RAW SYSTEM FIELD NAMES

В runtime Decision Queue должны отсутствовать user-visible:

```text
unsoldProductCount
productNames
withAvailabilityCount
withoutAvailabilityCount
pendingConfirmationCount
oldestPendingMinutes
affectedGmv
slaThreshold
paymentMethod
...
```

если они не преобразованы в human-readable label/value.

Технические field names допустимы только в developer/debug context, не primary UI.

---

# 15. MONEY EVIDENCE

Monetary evidence:

```text
affectedGmv
refund amount
payment amount
commission
```

должно показываться:

```text
AZN / ₼
```

и использовать уже принятую financial semantics.

Не возвращать `$`.

---

# 16. DATE / DURATION EVIDENCE

Поля вроде:

```text
oldestPendingMinutes
firstDetected
lastDetected
```

отображать человекочитаемо:

```text
5 ч 12 мин
обнаружено ...
последнее наблюдение ...
```

с project timezone authority.

---

# 17. FAILED PAYMENTS PRESENTATION

Если WHY/evidence содержит grouping по `paymentMethod`,
показывать user-facing wording:

```text
Основной способ среди неуспешных платежей: Карта
```

только в соответствии с Stage D claim-strength.

Не писать raw:

```text
paymentMethod: CARD
```

---

# 18. PENDING REFUNDS PRESENTATION

Разделить factual:

```text
pending count
oldest age
amount if provable
```

Не показывать raw enum/field names.

Не превращать REQUESTED refund в processed financial refund.

---

# 19. RECENT CANCELLATIONS PRESENTATION

Если structured cancellation reason отсутствует:

```text
WHY = INSUFFICIENT_EVIDENCE
```

Presentation evidence не должен придумывать причину.

---

# 20. UPCOMING BOOKINGS PRESENTATION

Upcoming booking evidence должно объяснять factual timing/state,
а не fake risk/impact.

---

# 21. PENDING BOOKINGS PRESENTATION

Показывать:

```text
сколько bookings превысили SLA
самое длительное ожидание
затронутый GMV, если factual
SLA threshold
```

human-readable.

Не raw field names.

---

# 22. TYPED PRESENTATION ADAPTERS

Предпочтительно создать per-signal-code presentation adapters/types.

Не использовать uncontrolled generic rendering.

Если existing architecture already has adapter layer — расширить его.

Не создавать duplicate DecisionSignal source-of-truth.

---

# 23. API VS FRONTEND RESPONSIBILITY

Определить, где должен жить presentation mapping:

```text
backend presentation DTO
or
frontend signal-code adapter
```

Выбрать current architecture-consistent вариант.

Business facts/evidence остаются backend authority.

Localization обычно frontend responsibility, если current project так устроен.

Не дублировать i18n text в backend и frontend без необходимости.

---

# 24. ACCESSIBILITY / RESPONSIVE

Evidence lists:

```text
не должны ломать layout
не должны overflow
должны быть keyboard accessible, если expandable
```

Не делать full accessibility redesign.

---

# 25. RUNTIME ACCEPTANCE — SCOPE A

Browser validation обязателен.

Проверить минимум:

```text
ServicesWithoutSales
FailedPayments
PendingBookings
PendingRefunds
```

и остальные types, если visible.

Target:

```text
raw technical evidence keys = 0
human-readable evidence = present
WHY remains readable
lifecycle remains functional
AZN preserved
```

---

# 26. FRONTEND REGRESSION TEST — RAW EVIDENCE GUARD

Добавить tests, которые fail если Decision Queue рендерит известные raw keys.

Минимум:

```text
unsoldProductCount
productNames
withAvailabilityCount
withoutAvailabilityCount
pendingConfirmationCount
oldestPendingMinutes
```

Лучше использовать signal-code presentation tests, а не fragile global regex.

---

# 27. SCOPE B — EMPLOYEE PERFORMANCE ARCHITECTURE FORMALIZATION

В existing TravelHub architecture уже существуют:

```text
Employees
roles
permissions
responsibilities
workspace access
```

Нужно НЕ создавать новую независимую систему,
а **явно доформализовать existing Employees domain**.

Canonical requirement:

```text
EMPLOYEE PERFORMANCE EVALUATION
→ MANDATORY FUTURE CAPABILITY
```

---

# 28. EMPLOYEE PERFORMANCE — ARCHITECTURAL SCOPE

Existing Employees domain должен предусматривать:

```text
Employee profile
Role / permissions
Responsibilities
Workload
Activity history
SLA
Productivity
Quality
Errors / rework
Business contribution
Team performance
Individual performance
Performance history
```

Это architecture commitment, не implementation сейчас.

---

# 29. NO SINGLE OPAQUE SCORE

Не закреплять модель:

```text
Employee Score = 87/100
```

как единственную authority.

Если composite score появится в будущем,
его formula должна быть transparent, role-specific и explainable.

Architecture должна поддерживать multi-dimensional performance.

---

# 30. ROLE-SPECIFIC PERFORMANCE

Employee evaluation должна зависеть от role/domain.

Conceptually:

## Operator
```text
processed cases
SLA compliance
response/processing time
errors
rework
open/overdue cases
```

## Sales Manager
```text
leads handled
conversion
GMV/revenue contribution
response time
lost opportunities
```

## Finance
```text
refund/payment processing
reconciliation accuracy
processing SLA
manual corrections
financial errors
```

## Moderator
```text
reviews completed
moderation SLA
reopened cases
policy accuracy
```

Не реализовывать formulas сейчас.

---

# 31. FAIRNESS / CONTEXT REQUIREMENT

Architecture должна учитывать, где возможно:

```text
workload
case complexity
case type
assigned scope
shift / working hours
team
business channel
role
```

Нельзя архитектурно приравнивать:

```text
higher raw volume = better employee
```

без quality/context.

---

# 32. PROCESS ≠ EMPLOYEE FAULT

Decision Intelligence не должен автоматически превращать:

```text
SLA breach
```

в:

```text
employee underperformance
```

Потенциальные причины могут быть:

```text
workload
system failure
partner delay
payment issue
inventory issue
employee delay
```

Employee attribution требует evidence.

---

# 33. TEAM VS INDIVIDUAL PERFORMANCE

Architecture должна явно предусматривать два уровня:

```text
TEAM PERFORMANCE
INDIVIDUAL PERFORMANCE
```

Command Center:
```text
high-level team/workforce health only
```

Employees/Analytics:
```text
deeper team + individual performance
```

---

# 34. COMMAND CENTER BOUNDARY

В будущем Command Center может показывать только management-significant workforce signals:

```text
SLA compliance
overloaded staff
overdue cases
quality alerts
unassigned cases
```

Не превращать Command Center в полный HR analytics dashboard.

---

# 35. ANALYTICS BOUNDARY

Analytics должен иметь future Workforce/Employees analytical perspective:

```text
trends
period comparison
role/team comparison
workload
quality
productivity
SLA
```

Не реализовывать сейчас.

---

# 36. DECISION INTELLIGENCE INTEGRATION

Future Employee Performance должен использовать existing Decision Intelligence foundation:

```text
WHAT
WHY
IMPACT
ACTION
```

Например:

```text
WHAT
17 cases exceeded SLA

WHY
9 concentrated in overloaded shift

IMPACT
affected customers / business scope

ACTION
reassign workload
```

Но Stage E/F implementation сейчас не расширять employee domain.

---

# 37. RBAC / PRIVACY — MANDATORY ARCHITECTURE

Individual employee performance не должен быть visible всем.

Architecture должна предусматривать restricted access,
например для:

```text
ADMIN
DIRECTOR
relevant manager/lead
```

Exact future matrix определить later.

Не давать blanket access по `analytics.read`.

---

# 38. AUDITABILITY

Future performance evaluation должна быть traceable к factual events:

```text
assigned cases
timestamps
status transitions
actions
errors
SLA
outcomes
```

Не строить black-box employee scoring.

---

# 39. NO EMPLOYEE IMPLEMENTATION NOW

Строго запрещено в этом prompt:

```text
создавать Employee Performance pages
создавать scoring engine
создавать new DB schema без необходимости для documentation
строить workforce analytics
создавать HR ranking
реализовывать disciplinary logic
```

Scope B = documentation + canonical roadmap/architecture formalization.

---

# 40. FIND EXISTING EMPLOYEES AUTHORITY

Перед update определить actual canonical files:

```text
Employees architecture section
canonical roadmap stage
Analytics architecture
Command Center architecture
RBAC architecture
```

Не создавать competing document, если existing authority уже есть.

---

# 41. UPDATE EXISTING ARCHITECTURE

Добавить Employee Performance commitment в существующий Employees domain.

Если есть architecture chapter/section — обновить его additive.

Если detailed architecture file отсутствует,
добавить concise canonical subsection в ближайший authoritative document.

---

# 42. UPDATE CANONICAL ROADMAP

Зарегистрировать:

```text
Employee Performance Evaluation
→ MANDATORY FUTURE CAPABILITY
→ under existing Employees domain
```

Определить future owner stage/workstream, не ломая current numbering.

Не вставлять implementation до Stage E просто потому, что capability теперь формализована.

---

# 43. DEPENDENCIES FOR FUTURE EMPLOYEE PERFORMANCE

Roadmap/architecture должны минимум указать dependencies:

```text
Employees domain
RBAC
activity/audit events
operational entities
SLA definitions
Analytics
Decision Intelligence
```

Не утверждать, что все dependencies уже реализованы.

---

# 44. REQUIRED DELIVERABLE A — DECISION QUEUE EVIDENCE MATRIX

| Signal code | Raw evidence | User-facing presentation | Hidden fields | Runtime PASS |
|---|---|---|---|---|

Покрыть все 6 detectors.

---

# 45. REQUIRED DELIVERABLE B — BEFORE / AFTER

Для ServicesWithoutSales показать:

```text
BEFORE
unsoldProductCount: 31
productNames: ...
withAvailabilityCount: 0
withoutAvailabilityCount: 31
```

и реальный AFTER screenshot/text representation.

---

# 46. REQUIRED DELIVERABLE C — OBSERVATION COUNT DECISION

Вернуть:

```text
observationCount shown to user: YES/NO
reason:
replacement/alternative:
```

Если остаётся — human-readable product rationale.

---

# 47. REQUIRED DELIVERABLE D — EMPLOYEE PERFORMANCE ARCHITECTURE MATRIX

| Capability | Already exists | Added as future commitment | Implementation now? |
|---|---:|---:|---:|
| Employee profile | | | NO |
| Workload | | | NO |
| SLA | | | NO |
| Productivity | | | NO |
| Quality | | | NO |
| Errors/rework | | | NO |
| Business contribution | | | NO |
| Team performance | | | NO |
| Individual performance | | | NO |
| Performance history | | | NO |

---

# 48. REQUIRED DELIVERABLE E — FILES UPDATED

Точно указать:

```text
Frontend:
Backend:
Tests:
Architecture docs:
Canonical roadmap:
Reports:
Migrations:
```

Expected for Employee Performance architecture scope:

```text
product code implementation = NO
```

---

# 49. REQUIRED DELIVERABLE F — TESTS / RUNTIME

Вернуть:

```text
Decision Queue tests:
Frontend Vitest:
Frontend TSC:
Frontend build:
Backend tests if changed:
Browser/runtime:
Raw evidence keys visible:
Unexpected $/USD:
```

---

# 50. REPORT

Создать:

```text
docs/prompts/PHASE_3_PRE_STAGE_E_FINAL_CLOSURE_DECISION_QUEUE_EVIDENCE_AND_EMPLOYEE_PERFORMANCE_ARCHITECTURE_REPORT.md
```

Полностью на русском языке.

---

# 51. ROADMAP STATUS AFTER PASS

После успешного закрытия:

```text
Decision Queue raw evidence presentation → VERIFIED
Employee Performance future capability   → CANONICALLY FORMALIZED
Stage E                                  → READY
```

Stage E автоматически НЕ запускать.

---

# 52. ACCEPTANCE CRITERIA

VERDICT A только если:

1. Все 6 signal types audited.
2. Raw evidence keys не видны в production Decision Queue.
3. ServicesWithoutSales presentation human-readable.
4. Arrays compacted, not rendered as giant raw strings.
5. Duplicate evidence removed/reduced.
6. observationCount product decision explicit.
7. WHY separation preserved.
8. No IMPACT implemented.
9. No business ACTION implemented.
10. RU/AZ/EN evidence labels complete.
11. AZN preserved.
12. Runtime/browser evidence provided.
13. Regression tests cover raw evidence leakage.
14. Existing Employees architecture located.
15. Employee Performance formally added under existing Employees domain.
16. Team + individual performance explicitly included.
17. Role/context/fairness requirements recorded.
18. Process issue ≠ automatic employee fault principle recorded.
19. RBAC/privacy requirement recorded.
20. No employee scoring implementation performed.
21. Canonical roadmap updated additively.
22. Final report in Russian.
23. Stage E not automatically started.

---

# 53. VERDICT

Вернуть ровно один.

## VERDICT A — PRE-STAGE-E FINAL CLOSURE COMPLETE / STAGE E READY

Только если оба scope закрыты:

```text
A. Decision Queue Evidence Presentation → VERIFIED
B. Employee Performance Architecture    → FORMALIZED
```

## VERDICT B — REMEDIATION REQUIRED

Указать отдельно:

```text
Decision Queue remediation:
Architecture/roadmap remediation:
```

## VERDICT C — BLOCKED

Только если существующая architecture authority не позволяет корректно определить,
куда встроить Employee Performance, либо Decision Queue presentation требует отсутствующей prerequisite capability.

---

# 54. STOP

После отчёта:

**STOP.**

Не запускать автоматически:

```text
Stage E
Stage F
Stage G
Stage H
Stage I
Stage J
Stage 2.14.x
Employee Performance implementation
```

Ждать review.
