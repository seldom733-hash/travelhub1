# PHASE 3 — STAGE E
# DETERMINISTIC EVIDENCE-BASED IMPACT

## LANGUAGE REQUIREMENT — MANDATORY

Все ответы разработчика, findings, архитектурные решения, таблицы, тестовые результаты,
DB/API/runtime evidence и финальный отчёт должны быть предоставлены **НА РУССКОМ ЯЗЫКЕ**.

Technical identifiers, paths, enums, field names, endpoints, SHA, commands и code
сохранять в оригинальном виде.

---

# 1. CONTEXT

Pre-Stage-E closure завершён:

```text
Stage A — Granular RBAC                         COMPLETE
Stage B — Decision Signal Foundation            COMPLETE
Stage B.1 — Financial Authority                 CLOSED
Stage B.2 — Executive Financial KPI Hotfix      COMPLETE
Stage C — WHAT / Decision Queue                 COMPLETE
Stage D — Deterministic WHY Attribution         COMPLETE
Post-seed Stage D validation                    ACCEPTED
GMV lifecycle / collection / refund semantics   CLOSED
GMV i18n remediation                            COMPLETE
GMV display reconciliation                      COMPLETE
Decision Queue evidence presentation             VERIFIED
Employee Performance architecture               FORMALIZED
```

Decision Loop:

```text
WHAT      → Stage C
WHY       → Stage D
IMPACT    → Stage E  ← CURRENT STAGE
ACTION    → Stage F
```

Stage E должен ответить:

> Насколько обнаруженная ситуация важна для бизнеса и почему?

---

# 2. CORE PRINCIPLE

`IMPACT` — это НЕ просто:

```text
HIGH
MEDIUM
LOW
```

и НЕ arbitrary score.

IMPACT должен быть explainable composition of factual, provable dimensions.

Canonical conceptual dimensions:

```text
Financial Impact
Customer Impact
Operational Impact
Partner Impact
SLA / Time Impact
Scope / Affected Entities
```

Не каждый signal обязан иметь все dimensions.

---

# 3. ABSOLUTE PROHIBITION — NO FABRICATED IMPACT

Запрещены формулы без доказуемой business authority, например:

```text
count × 15 AZN/week
count × arbitrary coefficient
fake lost revenue
fake conversion loss
fake customer churn
fake partner churn
fake probability %
fake confidence %
```

Если значение нельзя доказать:

```text
NOT_PROVABLE
```

или dimension отсутствует.

Не заменять отсутствие данных догадкой.

---

# 4. EXISTING HARDCODED AI FEED

Ранее audit выявил legacy logic:

```text
Severity = count > 5 ? "high" : "medium"
Potential = n × 15 AZN/week
Text = hardcoded templates
```

Stage E обязан найти actual remaining implementation этой логики.

Необходимо:

```text
audit
classify
remove / supersede / isolate
```

Legacy fabricated impact не должен оставаться authoritative.

Не ломать Stage G reconciliation scope: если legacy AI Decision Feed окончательно заменяется только Stage G,
Stage E должен сделать новый Impact authority и явно пометить legacy feed как non-authoritative.

---

# 5. SINGLE SOURCE OF TRUTH

`DecisionSignal` остаётся source of truth для signal lifecycle/evidence.

Не создавать второй независимый signal engine.

IMPACT должен вычисляться из:

```text
DecisionSignal
+ evidence
+ authoritative related domain data where necessary
```

и быть связан с `signal.code`.

---

# 6. DERIVED VS PERSISTED

Сначала определить, должен ли Impact:

```text
A. derived on read
B. persisted snapshot
C. hybrid
```

Stage D WHY использует derived-on-read.

Для Stage E решение должно учитывать:

```text
determinism
historical reproducibility
changing financial values
signal re-observation
performance
auditability
future Stage F actions
```

Не добавлять migration без доказанной необходимости.

---

# 7. REQUIRED IMPACT CONTRACT

Создать explicit typed contract.

Conceptual example:

```ts
type ImpactStatus =
  | 'PROVEN'
  | 'PARTIALLY_PROVEN'
  | 'INFORMATIONAL'
  | 'INSUFFICIENT_EVIDENCE';

interface DecisionImpact {
  status: ImpactStatus;
  dimensions: ImpactDimension[];
  summary: ImpactSummary;
  rule: ImpactRuleIdentity;
}
```

Exact names адаптировать под codebase.

---

# 8. IMPACT DIMENSION CONTRACT

Каждая dimension должна минимум иметь:

```text
type
value / facts
unit where applicable
evidence references
claim strength/status
```

Conceptual:

```text
FINANCIAL
CUSTOMER
OPERATIONAL
PARTNER
SLA_TIME
SCOPE
```

Не заставлять все signals иметь одинаковый набор.

---

# 9. FINANCIAL IMPACT

Financial impact допустим только если monetary exposure доказуем.

Примеры factual candidates:

```text
affected GMV
captured payment amount
pending refund amount
outstanding amount
commission exposure
```

Использовать только canonical financial semantics.

Все PLATFORM monetary impact:

```text
AZN / ₼
```

---

# 10. FINANCIAL IMPACT ≠ LOST REVENUE

Например:

```text
affectedGmv = 2 840 AZN
```

не означает:

```text
TravelHub will lose 2 840 AZN
```

Правильная формулировка:

```text
GMV затронутых заказов: 2 840 ₼
```

или:

```text
GMV под операционным риском: 2 840 ₼
```

только если risk semantics доказана.

Не называть GMV:

```text
Revenue
Loss
Profit
```

---

# 11. CUSTOMER IMPACT

Customer dimension может использовать factual:

```text
distinct affected customer count
bookings/orders affected
failed payment customers
refund-request customers
```

Не считать customer dissatisfaction/churn без данных.

---

# 12. PARTNER IMPACT

Если evidence/domain relationships позволяют:

```text
distinct affected partners
affected partner workspaces
affected services by partner
```

показывать factual scope.

Не смешивать Marketplace и Storefront.

---

# 13. OPERATIONAL IMPACT

Допустимые factual measures:

```text
affected entity count
queue size
failed operations
unresolved cases
services unable to sell
bookings awaiting processing
```

Не превращать count в arbitrary severity автоматически.

---

# 14. SLA / TIME IMPACT

Использовать factual:

```text
oldest pending duration
SLA threshold
count beyond SLA
time overdue
```

Пример:

```text
5 бронирований превысили SLA
самое длительное ожидание: 7 ч 23 мин
SLA: 4 ч
```

---

# 15. SCOPE DIMENSION

Scope отвечает:

> Насколько широко распространена ситуация?

Допустимо:

```text
affected entities
affected customers
affected partners
affected services
percentage of eligible population
```

Процент разрешён только если denominator authoritative и одинакового scope.

---

# 16. IMPACT LEVEL / SEVERITY

Если UI/product требует summary level:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

он НЕ может быть arbitrary `count > N`.

Level должен быть derived из documented deterministic rules.

Каждое правило должно объяснять:

```text
which dimensions triggered level
threshold authority
why threshold exists
```

Если authoritative thresholds пока отсутствуют, лучше:

```text
NO_SEVERITY / UNRANKED
```

чем fake HIGH/MEDIUM.

---

# 17. THRESHOLD AUTHORITY

Проверить существующие:

```text
SLA thresholds
financial thresholds
operational thresholds
refund thresholds
payment thresholds
```

Разделить:

```text
existing business-authoritative
existing technical heuristic
newly proposed
```

Новые arbitrary thresholds без policy approval не вводить.

---

# 18. IMPACT PRIORITY VS IMPACT FACTS

Не смешивать:

```text
Impact facts
```

и:

```text
Queue priority
```

Signal может иметь большой affected GMV, но не требовать немедленного action.

Priority/routing может относиться к Stage F/G.

Stage E прежде всего доказывает impact.

---

# 19. ALL 6 SIGNAL TYPES — MANDATORY

Stage E должен покрыть:

```text
PendingBookingsDetector
FailedPaymentsDetector
RecentCancellationsDetector
PendingRefundsDetector
UpcomingBookingsDetector
ServicesWithoutSalesDetector
```

Для каждого создать deterministic impact rule или честный insufficient/informational result.

---

# 20. PENDING BOOKINGS — EXPECTED IMPACT ANALYSIS

Проверить factual candidates:

```text
pending booking count
distinct customers
affected GMV
oldest pending
SLA breach count
partners affected
```

Пример presentation:

```text
IMPACT

5 бронирований затронуто
4 клиента
GMV затронутых заказов: 2 840 ₼
Самое длительное ожидание: 7 ч 23 мин
```

Не использовать этот пример как expected dataset value.

---

# 21. FAILED PAYMENTS — EXPECTED IMPACT ANALYSIS

Проверить:

```text
failed payment count
distinct customers/orders
attempted amount if provable
payment-method concentration
subsequent successful payment
```

Очень важно:

failed attempt amount не обязательно lost GMV.

Не писать:

```text
Lost revenue = failed amount
```

---

# 22. RECENT CANCELLATIONS — EXPECTED IMPACT ANALYSIS

Проверить:

```text
cancelled order count
cancelled order value
distinct customers
distinct partners
refund relationship
```

WHY ранее может быть `INSUFFICIENT_EVIDENCE`.

Это не мешает IMPACT быть factual.

---

# 23. PENDING REFUNDS — EXPECTED IMPACT ANALYSIS

Проверить:

```text
pending refund count
requested amount
oldest pending
customers affected
SLA if exists
```

Pending refund amount НЕ является:

```text
processed refund
actual cash outflow
```

Label должен быть точным.

---

# 24. UPCOMING BOOKINGS — EXPECTED IMPACT ANALYSIS

Само наличие upcoming bookings может быть informational, а не negative impact.

Не фабриковать risk.

Проверить:

```text
upcoming count
customers
partners
GMV
time window
```

Если нет adverse condition:

```text
ImpactStatus = INFORMATIONAL
```

может быть правильнее HIGH/MEDIUM.

---

# 25. SERVICES WITHOUT SALES — EXPECTED IMPACT ANALYSIS

Проверить:

```text
unsold published services
with availability
without availability
partners affected
publication age
eligible service population
```

Критично:

```text
31 services without sales
```

не означает доказанный:

```text
lost GMV
lost revenue
```

Если `31/31 without availability`, это сильный operational scope fact,
но не monetary loss.

---

# 26. PERCENTAGE IMPACT

Если показывается:

```text
31 из 50 услуг
62%
```

denominator должен быть exactly comparable:

```text
same publication status
same business scope
same period/as-of
same service population
```

---

# 27. IMPACT RULE CATALOG

Создать deterministic rule catalog, аналогично WHY rule identity.

Каждый rule должен иметь stable identity:

```text
ruleId
signalCode
version
dimensions
requirements
```

Это нужно для auditability и будущей эволюции.

---

# 28. RULE VERSIONING

Если impact logic изменится позже, должна существовать возможность понять,
какая rule semantics использовалась.

Не обязательно строить сложную persisted version history,
но rule identity/version должны быть explicit.

---

# 29. DETERMINISM

Same:

```text
signal
evidence
domain snapshot
rule version
```

должны давать same Impact result.

Добавить tests на determinism и input ordering, где применимо.

---

# 30. MISSING EVIDENCE

Если обязательное evidence отсутствует:

не crash,
не fabricate.

Возвращать:

```text
PARTIALLY_PROVEN
INSUFFICIENT_EVIDENCE
```

с доступными factual dimensions.

---

# 31. FAILURE ISOLATION

Impact failure одного signal не должен ломать весь Command Center.

Использовать safe failure handling.

Но не silently swallow programming errors без observability.

---

# 32. PERFORMANCE

Stage C dashboard ранее был около ~450ms на demo dataset.

Stage E не должен создавать N+1 per signal/entity.

Audit:

```text
queries added
impact computation time
dashboard total latency
```

Предпочитать evidence enrichment в detectors либо batched queries,
если domain data нужна для impact.

---

# 33. SECURITY / RBAC

Impact не должен раскрывать данные из секций/tenants,
к которым пользователь не имеет доступа.

Сохранять:

```text
analytics.read page gate
dashboard.<section>.read
workspace/tenant scope
```

Не допускать cross-tenant affected entity counts/amounts.

---

# 34. MARKETPLACE VS STOREFRONT

Impact должен соблюдать business perspective separation.

PLATFORM Command Center не должен использовать partner-owned Storefront commerce
как TravelHub Marketplace financial impact без явного channel scope.

Storefront subscription economics отдельно.

---

# 35. FINANCIAL EXACTNESS

Для impact calculations использовать authoritative exact numeric values.

НЕ использовать:

```text
displayCurrent
formatted strings
rounded card values
```

`displayCurrent` существует только для presentation reconciliation.

---

# 36. REFUNDS / COMMISSION LIMITATION

Commission reversal всё ещё может быть NOT IMPLEMENTED.

Поэтому не заявлять:

```text
Net Marketplace Revenue after refund
```

как fully authoritative, если reversal отсутствует.

Stage E должен уважать limitation.

---

# 37. EMPLOYEE PERFORMANCE BOUNDARY

Employee Performance formalized as future capability.

Stage E НЕ должен сейчас:

```text
score employees
rank employees
assign fault
create workforce impact scoring
```

Если operational signal связан с workload, можно использовать factual workload
только если data authoritative, без employee blame.

---

# 38. BACKEND API CONTRACT

Добавить impact в Decision Queue/API response.

Conceptual:

```text
signal.impact
```

Не ломать existing:

```text
signal.why
signal.evidence
signal.lifecycle
```

Backward compatibility проверить.

---

# 39. FRONTEND PRESENTATION

Decision Queue card должна явно разделять:

```text
WHAT
WHY
IMPACT
```

ACTION business recommendations пока отсутствуют.

Не превращать карточку в перегруженный analytics report.

---

# 40. IMPACT PRESENTATION ADAPTER

Использовать уже созданный presentation-contract подход.

Raw fields типа:

```text
impactScore
affectedCustomerCount
financialExposure
```

не должны автоматически отображаться.

Нужен human-readable localized presenter.

---

# 41. IMPACT UI — EXAMPLE

Conceptual:

```text
31 опубликованная услуга без заказов

WHY
Основной наблюдаемый фактор:
31 из 31 не имеют доступности

IMPACT
Операционный охват: 31 услуга
Затронуто партнёров: 12
Доказанный финансовый ущерб: недостаточно данных
```

Не копировать literally, если actual evidence отличается.

---

# 42. NO "NOT PROVABLE" SPAM

Если dimension отсутствует, UI не обязан показывать 5 строк:

```text
Financial: NOT PROVABLE
Customer: NOT PROVABLE
Partner: NOT PROVABLE
...
```

Показывать только meaningful dimensions.

Но report/API status должен честно отражать evidence completeness.

---

# 43. LOCALIZATION

Все new Impact labels/text:

```text
RU
AZ
EN
```

No raw keys.

Добавить regression coverage.

---

# 44. CURRENCY

Monetary impact:

```text
AZN / ₼
```

No `$` / `USD` fallback в PLATFORM Command Center.

---

# 45. TIME / DURATION

Duration использовать human-readable presentation:

```text
5 ч 12 мин
```

с project timezone/date authority.

---

# 46. TEST MATRIX — CORE

Unit tests минимум:

```text
impact determinism
all 6 signal codes
missing evidence
partial evidence
informational impact
financial dimension
customer dimension
partner dimension
operational dimension
SLA/time dimension
scope dimension
no fabricated monetary impact
no arbitrary severity
rule identity/version
RBAC/scope
```

---

# 47. TEST — NO FAKE MONEY

Добавить explicit regression test:

```text
ServicesWithoutSales
does NOT produce monetary loss from count × constant
```

и аналогично legacy `n × 15`.

---

# 48. TEST — FAILED PAYMENT ≠ LOST REVENUE

Explicit test:

```text
failed payment amount
does not automatically become lost revenue
```

---

# 49. TEST — UPCOMING BOOKINGS

Explicit test:

```text
normal upcoming bookings
can be INFORMATIONAL
```

без fake negative severity.

---

# 50. TEST — REFUND STATUS

Pending refund:

```text
REQUESTED
```

не должен отображаться как actual processed cash loss.

---

# 51. TEST — EXACT FINANCIAL VALUES

Impact uses:

```text
authoritative exact values
```

not:

```text
displayCurrent
rounded values
```

---

# 52. DB / API / UI RECONCILIATION

Для минимум 4 representative signals:

```text
PendingBookings
FailedPayments
PendingRefunds
ServicesWithoutSales
```

вернуть:

| Signal | DB/evidence fact | API impact | UI impact | Match |
|---|---|---|---|---|

---

# 53. RUNTIME VALIDATION

На богатом 2026 demo dataset проверить Decision Queue в browser.

Ожидается:

```text
WHAT visible
WHY visible
IMPACT visible
raw impact keys = 0
raw evidence keys = 0
AZN correct
no fabricated monetary loss
```

---

# 54. PERFORMANCE EVIDENCE

Вернуть:

```text
Dashboard latency before Stage E:
Dashboard latency after Stage E:
Additional DB queries:
Impact compute time:
N+1 detected: YES/NO
```

Не требовать искусственного micro-optimization,
но regression должна быть понятна.

---

# 55. REQUIRED DELIVERABLE A — IMPACT CONTRACT

Документировать final:

```text
ImpactStatus
ImpactDimension types
ImpactSummary
ImpactRuleIdentity
persistence/derivation strategy
```

---

# 56. REQUIRED DELIVERABLE B — 6-SIGNAL MATRIX

| Signal | Financial | Customer | Operational | Partner | SLA/Time | Scope | Status |
|---|---|---|---|---|---|---|---|
| PendingBookings | | | | | | | |
| FailedPayments | | | | | | | |
| RecentCancellations | | | | | | | |
| PendingRefunds | | | | | | | |
| UpcomingBookings | | | | | | | |
| ServicesWithoutSales | | | | | | | |

Использовать:

```text
PROVEN
PARTIAL
INFORMATIONAL
NOT_PROVABLE
N/A
```

---

# 57. REQUIRED DELIVERABLE C — LEGACY IMPACT AUDIT

Вернуть:

```text
Legacy severity implementation:
Legacy n × 15 implementation:
Current consumers:
Authority after Stage E:
Removed/superseded/deferred:
Stage G dependency:
```

---

# 58. REQUIRED DELIVERABLE D — THRESHOLD MATRIX

| Threshold | Source | Authoritative? | Used in Stage E? | Reason |
|---|---|---:|---:|---|

Не вводить arbitrary thresholds.

---

# 59. REQUIRED DELIVERABLE E — BEFORE / AFTER

Показать минимум 3 signals:

```text
BEFORE
WHAT + WHY
no trustworthy IMPACT

AFTER
WHAT + WHY + evidence-based IMPACT
```

---

# 60. REQUIRED DELIVERABLE F — NO-FABRICATION PROOF

Перечислить, какие tempting metrics сознательно НЕ рассчитываются.

Например:

```text
lost revenue
lost profit
churn probability
conversion loss
future GMV
```

и почему.

---

# 61. REQUIRED DELIVERABLE G — TESTS

Вернуть exact counts:

```text
Impact unit tests:
Decision Signal tests:
Dashboard tests:
Backend total:
Frontend tests:
Backend TSC:
Frontend TSC:
Backend build:
Frontend build:
Runtime:
```

---

# 62. REQUIRED DELIVERABLE H — PERFORMANCE

Вернуть measured results.

---

# 63. REQUIRED DELIVERABLE I — FILES / MIGRATIONS / GIT

```text
Starting HEAD:
Final HEAD:
Files changed:
New files:
Migrations:
Commit:
Pushed to origin: YES/NO
Working tree clean: YES/NO
```

---

# 64. DOCUMENTATION

Создать:

```text
docs/prompts/PHASE_3_STAGE_E_DETERMINISTIC_EVIDENCE_BASED_IMPACT_IMPLEMENTATION_REPORT.md
```

Полностью на русском языке.

Обновить canonical roadmap additively:

```text
Stage E → COMPLETE
Stage F → next
```

только при VERDICT A.

---

# 65. ARCHITECTURE UPDATE

Зафиксировать canonical:

```text
WHAT = DecisionSignal condition/evidence
WHY = deterministic attribution
IMPACT = deterministic evidence-based business effect
ACTION = future Stage F
```

Не дублировать architecture authority.

---

# 66. ACCEPTANCE CRITERIA

VERDICT A только если:

1. Typed Impact contract существует.
2. Все 6 signal types покрыты.
3. Impact deterministic.
4. Impact evidence-based.
5. No arbitrary `count > N` severity authority.
6. No `n × 15` or equivalent fabricated money.
7. Financial impact uses canonical financial semantics.
8. GMV not mislabeled as revenue/loss.
9. Failed payments not automatically lost revenue.
10. Pending refunds not actual cash outflow.
11. Upcoming bookings can be informational.
12. Missing evidence handled honestly.
13. Impact rule identity/version exists.
14. RBAC/tenant scope preserved.
15. Marketplace/Storefront boundary preserved.
16. Employee Performance boundary preserved.
17. Exact values used, not `displayCurrent`.
18. API exposes impact without breaking WHY/evidence.
19. UI separates WHAT / WHY / IMPACT.
20. No raw impact keys.
21. RU/AZ/EN complete.
22. AZN authority preserved.
23. Tests green.
24. Runtime verified.
25. Performance measured.
26. Legacy hardcoded impact audited.
27. Report in Russian.
28. Roadmap updated only on PASS.
29. Stage F not automatically started.

---

# 67. VERDICT

Вернуть ровно один.

## VERDICT A — STAGE E COMPLETE / EVIDENCE-BASED IMPACT VERIFIED / STAGE F READY

Только если all acceptance criteria выполнены.

## VERDICT B — STAGE E REMEDIATION REQUIRED

Указать:

```text
Impact contract gaps:
Evidence gaps:
Financial semantic gaps:
UI/presentation gaps:
Performance/security gaps:
Minimal remediation:
```

## VERDICT C — BLOCKED / DOMAIN AUTHORITY GAP

Если truthful Impact невозможно построить из current domain data.

В этом случае НЕ фабриковать значения.

Указать:

```text
Signal:
Missing authority/data:
Why impact is not provable:
Required future capability:
```

---

# 68. STOP

После Stage E:

**STOP.**

Не запускать автоматически:

```text
Stage F — Action Routing
Stage G — AI Decision Feed Reconciliation
Stage H — Executive/Operational/Financial Decision Enrichment
Stage I — Storefront Revenue Semantic Fix
Stage J — Full Regression / Security / Evidence Closure
Stage 2.14.x
Employee Performance implementation
```

Вернуть полный отчёт на русском языке и ждать review.
