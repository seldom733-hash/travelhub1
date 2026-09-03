# PHASE 3 — PRE-STEP 3.12 — PARTNERS 27 VS 28 — ID-LEVEL POPULATION RECONCILIATION & DRILL-DOWN REMEDIATION

## STATUS
**TYPE:** Targeted Runtime Audit + Remediation  
**Starting SHA:** использовать фактический `HEAD` на момент запуска — старый SHA не предполагать.  
**Scope:** только Analytics `Партнёры` ↔ CRM `Партнёры`.

Текущий runtime:
```text
Analytics → Партнёры = 27
CRM → Партнёры → Всего партнёров = 28
```
Ранее было `33 → 28`. Не считать автоматически ошибочным ни одно число. Сначала доказать populations на уровне canonical `partnerId`.

**HARD STOP:** не начинать FX, Behavioral Telemetry, Step 3.12, Booking KPI redesign или общий UI redesign.

## LANGUAGE REQUIREMENT — MANDATORY
Все reports, findings, root cause, population definitions, ID reconciliation, architecture/security decisions, evidence, conclusions и verdict explanations — преимущественно **на русском**. English только для technical identifiers, code, APIs, commands, SHA, enums и standardized VERDICT strings. Преимущественно английский report = task incomplete.

# 1. REPRODUCE FIRST
До изменений воспроизвести:
```text
workspace
preset/from/to/timezone
Analytics Partners
click URL
CRM total
visible context/filters
FIRST API request
response total
```
Если dataset изменился — использовать актуальные числа, но объяснить исходный `27 vs 28`.

# 2. PROVE ANALYTICS POPULATION
Найти exact query карточки `Партнёры=27`. Документировать:
```text
source entity/table
canonical identity
COUNT vs DISTINCT
joins
sellerPartnerId
Partner relation
entitlement
Marketplace/Storefront
status
dateFrom/dateTo
business timestamp
workspace/tenant
soft-delete/archive
null handling
```
Дать точную формулу, например только после доказательства:
```text
AnalyticsPartnerIds =
DISTINCT <partnerId>
WHERE <exact predicate>
AND <timestamp> ∈ [from,to)
AND <authorized scope>
```

# 3. PROVE CRM POPULATION
Отдельно доказать exact query `CRM → Всего партнёров=28`: entity, identity, statuses, entitlement/activity requirement, period semantics, workspace, archive/soft-delete. CRM не считать canonical автоматически.

# 4. MANDATORY ID-LEVEL RECONCILIATION
Получить:
```text
A = AnalyticsPartnerIds
B = CRMPartnerIds

|A|
|B|
A ∩ B
A - B
B - A
```
Найти конкретный ID, объясняющий текущий `27 vs 28`.

Для каждого symmetric-difference ID:
| Field | Value |
|---|---|
| partnerId | |
| company name | |
| Partner entity exists | |
| sellerPartnerId | |
| entitlement/status | |
| plan/tier | |
| Marketplace/Storefront | |
| partner status | |
| active/inactive | |
| onboarding | |
| archived/soft-deleted | |
| qualifying activity in period | |
| business timestamp | |
| Analytics inclusion | |
| CRM inclusion | |
| exact exclusion reason | |

Фраза «разные выборки» без ID-level proof = FAIL.

# 5. PRODUCT SEMANTICS
После evidence выбрать один canonical contract.

## A — `Партнёры` = canonical Partner stock
Тогда Analytics и CRM должны считать одну canonical entity population. Period selector не должен случайно превращать stock в period-active metric.

## B — `Активные партнёры` = period-bound population
Если 27 = partners with qualifying activity:
```text
Analytics Активные партнёры=27
→ CRM Партнёры
→ visible context "Активные за выбранный период"
→ contextual total=27
→ table/pagination exact same 27 IDs
```
CRM `Всего партнёров=28` может оставаться отдельной stock metric.

## C — entitlement-bearing population
Если source считает entitlement/plan population, generic label `Партнёры` недопустим без уточнения business semantics.

# 6. DRILL-DOWN CONTRACT
Независимо от semantics:
```text
Source P
→ CRM contextual population
→ visible context
→ ИТОГО по текущей выборке=P
→ registry total=P
→ pagination total=P
→ exact partnerIds=source set
```
Stock total может отображаться отдельно, но не подменяет contextual total.

# 7. PERIOD CONTRACT
Проверить `Сегодня / Неделя / Месяц / Квартал / 6 месяцев / Год / CUSTOM`.

Если period-bound: same calendar `[from,to)`, timezone и business timestamp source/destination.

Если stock/all-time: явно доказать period-independence и не создавать UI-впечатление period-bound metric.

# 8. FIRST NAVIGATION
Проверить:
```text
first click
FIRST API request
first render
F5
back/forward
```
Hard:
```text
source population = first destination population = after-F5 population
```

# 9. SHARED TRACEABILITY
Не создавать Analytics-only handler. Использовать Shared Metric Drill-down / Source Traceability. Передавать semantic context:
```text
metricId
populationScope
from/to/preset
workspace
status/entitlement scope where relevant
```

# 10. SECURITY / PERFORMANCE
Server-side RBAC/workspace/tenant/entitlement; query params не расширяют scope. Aggregate и rows — одна authorized population.

Не fetch-all в browser. Registry: server filters + totalCount + aggregates + pagination. Проверить N+1/duplicate requests.

# 11. TARGETED TESTS
Tests, падающие на старом поведении:
```text
Analytics source set = CRM contextual set
source count = contextual aggregate = pagination total
difference-partner inclusion/exclusion
period or stock semantics
first-navigation hydration
refresh/back-forward
scope tampering denied
```

# 12. RUNTIME MATRIX
| Preset | Analytics | Source IDs | CRM contextual | Destination IDs | Exact set equality | Result |
|---|---:|---:|---:|---:|---|---|
| Today | | | | | | |
| Week | | | | | | |
| Month | 27/current | | | | | |
| Quarter | | | | | | |
| 6 months | | | | | | |
| Year | | | | | | |

Если metric stock — явно показать неизменность across presets и объяснить её.

# 13. REQUIRED REPORT
Создать:
```text
docs/reports/PHASE_3_PRE_STEP_3.12_PARTNERS_POPULATION_RECONCILIATION_REMEDIATION_REPORT.md
```
Включить: Starting/Final SHA; reproduction; Analytics formula; CRM formula; ID-level reconciliation; difference partner evidence; canonical semantics; naming decision; drill-down; period behavior; first-navigation/F5; security/performance; targeted tests; browser/network evidence; residuals; verdict; exact NEXT.

# 14. ACCEPTANCE GATES
**A:** конкретный ID/IDs, объясняющие 27 vs 28, доказаны.  
**B:** semantics metric доказана.  
**C:** label соответствует semantics.  
**D:** `source P = CRM contextual P = registry/pagination P = exact same IDs`.  
**E:** period semantics совпадают либо stock-independence доказана.  
**F:** first render = F5; context не теряется.  
**G:** security/performance/tests PASS.

# 15. VERDICT
Только A–G PASS:
```text
VERDICT A — PARTNERS POPULATION & SOURCE TRACEABILITY REMEDIATION APPROVED
```
Иначе:
```text
VERDICT B — PARTNERS POPULATION & SOURCE TRACEABILITY REMEDIATION INCOMPLETE
```

# 16. HARD STOP
После завершения STOP. Не запускать автоматически Final Strict Re-Qualification, FX, Behavioral Telemetry, Step 3.12, Booking KPI redesign или Design System. Предоставить русский report, реальные SHA, ID-level reconciliation, browser/network evidence, tests и verdict.
