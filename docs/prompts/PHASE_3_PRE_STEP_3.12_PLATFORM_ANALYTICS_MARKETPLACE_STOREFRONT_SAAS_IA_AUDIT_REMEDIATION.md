# PHASE 3 — PRE-STEP 3.12 — PLATFORM ANALYTICS MARKETPLACE vs STOREFRONT SaaS INFORMATION ARCHITECTURE AUDIT + REMEDIATION

## STATUS

**Task type:** Audit-first architecture / semantics / UI remediation  
**Target:** Platform Workspace → `/app/analytics`  
**Goal:** разделить Platform Analytics на два явно различимых бизнес-контура:

```text
PLATFORM ANALYTICS
│
├── MARKETPLACE
│   └── бизнес TravelHub как Marketplace
│
└── STOREFRONT SaaS
    └── бизнес TravelHub как SaaS-провайдера для Storefront partners
```

Это **не просто визуальная перегруппировка карточек**.

Необходимо проаудировать существующие:

- KPI cards;
- charts;
- tables;
- funnels;
- comparison metrics;
- drill-down destinations;
- backend formulas;
- API fields;
- data sources;

и доказать, к какому бизнес-контексту относится каждый показатель.

---

# LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose documentation должны быть преимущественно **на русском языке**:

- Implementation Report;
- Remediation Report;
- Strict Review Report;
- Evidence / Runtime Report;
- Gap Audit;
- findings;
- root cause analysis;
- architecture decisions;
- security findings;
- runtime evidence descriptions;
- conclusions;
- recommendations;
- verdict explanations.

English разрешён только для technical identifiers:

- file paths;
- class/method/DTO/model/table/field names;
- API endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- commit messages;
- enums;
- permission identifiers;
- metric IDs;
- code snippets;
- standardized `VERDICT`.

Если отчёт преимущественно на английском — задача не завершена.

**Запрещено включать plaintext passwords, tokens, cookies, visitorId/sessionId values, secrets или credentials.**

---

# 1. BUSINESS ARCHITECTURE — HARD CONTRACT

TravelHub Platform имеет два различных экономических контура.

## 1.1 Marketplace

```text
TravelHub Marketplace
→ покупатели
→ Marketplace sellers/partners
→ Marketplace Orders
→ Marketplace Bookings
→ Marketplace customer Payments
→ Marketplace GMV
→ TravelHub Marketplace Commission
```

Это операционный и коммерческий бизнес TravelHub как Marketplace.

---

## 1.2 Storefront SaaS

```text
TravelHub
→ предоставляет Storefront partner SaaS product
→ subscription / entitlement
→ Storefront pays TravelHub
```

Platform интересуют:

```text
Storefront adoption
Storefront activation
active Storefronts
subscriptions
paid subscriptions
trial → paid
MRR
ARR
churn
retention
Storefront SaaS Revenue
```

только если соответствующие authoritative data/models реально существуют.

---

# 2. HARD INVARIANT — STOREFRONT CUSTOMER COMMERCE

Storefront partner может продавать собственным клиентам через свой Storefront.

Эта коммерция **не является Marketplace commerce TravelHub**.

Hard invariant:

```text
Storefront Commerce Volume
≠ Marketplace GMV
≠ TravelHub Marketplace Revenue
```

Поэтому Platform Analytics **не должна** смешивать в Marketplace KPI:

```text
Storefront customer Orders
Storefront customer Requests
Storefront customer Bookings
Storefront customer Payments
Storefront customer GMV
Storefront customer Revenue
Storefront visitor funnel
```

Эти данные относятся к:

```text
Partner / Storefront Analytics
```

---

# 3. STOREFRONT DATA ARE NOT TO BE DELETED

Storefront operational/behavioral data должны сохраняться.

Они нужны для:

```text
Partner Workspace
Storefront Analytics
Storefront CRM
Storefront Orders
Storefront Bookings
Storefront Finance
tenant-isolation testing
representative/demo data
```

Задача изменяет **Platform Analytics scope/presentation**, а не уничтожает Storefront data.

---

# 4. PLATFORM ANALYTICS TARGET IA

Target:

```text
АНАЛИТИКА
│
├── MARKETPLACE
│   ├── Marketplace traffic
│   ├── Marketplace commerce
│   ├── Marketplace conversion
│   ├── Marketplace financial performance
│   └── Marketplace ecosystem performance
│
└── STOREFRONT SaaS
    ├── Storefront adoption
    ├── subscription health
    ├── SaaS economics
    └── Storefront product health
```

В интерфейсе эти контуры должны быть визуально и семантически различимы.

---

# 5. STAGE A — COMPLETE EXISTING ANALYTICS INVENTORY

**Не начинать UI rearrangement до завершения inventory.**

Найти абсолютно все элементы `/app/analytics`:

```text
KPI cards
secondary cards
charts
tables
funnels
trend widgets
comparison values
filters
tabs/sections
drill-down links
```

Для каждого зафиксировать:

```text
visible label
metric ID / field
frontend component
backend source
formula
data source/table
period field
workspace scope
currency scope
drill-down destination
```

---

# 6. REQUIRED CLASSIFICATION

Каждый существующий Analytics element классифицировать ровно в одну primary category:

```text
MARKETPLACE
STOREFRONT_SAAS
PLATFORM_GLOBAL
MISPLACED
UNKNOWN
```

Definitions:

## MARKETPLACE

Показатель бизнеса TravelHub Marketplace.

## STOREFRONT_SAAS

Показатель прямого SaaS relationship:

```text
Storefront ↔ TravelHub
```

## PLATFORM_GLOBAL

Действительно общий показатель Platform, который невозможно честно отнести только к Marketplace или Storefront SaaS.

Использовать эту категорию экономно.

## MISPLACED

Показатель относится, например, к Storefront partner customer commerce и не должен находиться в Platform Analytics в текущем виде.

## UNKNOWN

Семантика или authoritative source не доказаны.

`UNKNOWN` нельзя автоматически переносить в какую-либо секцию.

---

# 7. REQUIRED INVENTORY MATRIX

В отчёте обязательна таблица:

| UI element | Metric ID | Current formula/source | Classification | Target section | Action |
|---|---|---|---|---|---|
| | | | MARKETPLACE / STOREFRONT_SAAS / PLATFORM_GLOBAL / MISPLACED / UNKNOWN | | KEEP / MOVE / RENAME / REMOVE_FROM_PLATFORM / BLOCK |

Ни одна существующая карточка/график не должна исчезнуть из audit inventory без объяснения.

---

# 8. MARKETPLACE SECTION — TARGET CONTENT

Marketplace section может содержать только доказуемые Marketplace metrics.

Expected conceptual groups:

```text
MARKETPLACE

Traffic
├── Посетители Marketplace
└── Посещения Marketplace

Commerce
├── Marketplace GMV
├── Orders
├── Bookings
└── AOV

Platform Economics
├── Marketplace Commission
├── Marketplace Revenue
└── Net Revenue
    only if existing formulas are already authoritative

Conversion
├── Conversion
└── Marketplace Funnel

Ecosystem
├── active Marketplace partners
└── other proven Marketplace metrics
```

Не создавать метрики только потому, что они перечислены здесь.

**Если authoritative metric отсутствует — не создавать placeholder/fake KPI.**

---

# 9. MARKETPLACE VISITORS / VISITS — ACCEPTED RUNTIME CONTEXT

Текущая реализация:

```text
Посетители Marketplace
=
COUNT(DISTINCT MarketplaceBehavioralEvent.visitorId)

Посещения Marketplace
=
COUNT(DISTINCT MarketplaceBehavioralEvent.sessionId)
```

После DTO fix реальный ручной runtime test доказал:

```text
first new anonymous/incognito visitor
→ Marketplace Visitors = 1

second new anonymous/incognito visitor
→ Marketplace Visitors = 2
```

Root cause прежнего `0`:

```text
NestJS ValidationPipe
whitelist: true
+
visitorId absent from MarketplaceBehavioralEventDto
→ visitorId stripped
```

Fix:

```text
visitorId added to MarketplaceBehavioralEventDto
```

Не регрессировать эту реализацию.

---

# 10. HISTORICAL VISITORS LIMITATION

Из предыдущего review известно:

```text
historical Marketplace behavioral events = 1228
historical visitorId coverage = 0%
```

Поэтому historical `Marketplace Visitors = 0` не означает:

```text
реально было 0 посетителей
```

Это означает:

```text
visitor telemetry unavailable before cutover
```

В рамках текущей Analytics IA remediation определить честное UI representation для pre-cutover Visitors:

```text
— / Нет данных
```

и/или:

```text
Данные о посетителях собираются с <cutover date>
```

Не backfill:

```text
visitorId = sessionId
```

---

# 11. STOREFRONT SaaS SECTION — HARD SEMANTIC RULE

В Platform Analytics Storefront section означает:

```text
TravelHub's SaaS business with Storefront partners
```

а НЕ:

```text
aggregate business performance of Storefront partners' own customer commerce
```

Это фундаментальное различие.

---

# 12. STOREFRONT SaaS — CANDIDATE METRICS

Audit whether authoritative sources already exist for:

```text
Active Storefronts
New Storefronts
Active Subscriptions
Paid Storefronts
Trial Storefronts
Trial → Paid
Subscription Revenue
MRR
ARR
Churn
Retention
Plan distribution
Entitlement distribution
```

Для каждой candidate metric:

```text
IMPLEMENTED + AUTHORITATIVE
PARTIALLY IMPLEMENTED
NOT IMPLEMENTED
NOT QUALIFIABLE
```

---

# 13. NO FAKE SaaS KPI

Если в проекте ещё нет:

```text
subscription lifecycle
billing events
MRR source
ARR source
churn source
trial lifecycle
```

не создавать карточку с:

```text
0
—
mock data
derived guess
```

только ради заполнения Storefront SaaS section.

UI должен показывать только реально квалифицированные metrics.

---

# 14. STOREFRONT TRAFFIC — DO NOT MIX

Не помещать в Platform Marketplace traffic:

```text
StorefrontBehavioralEvent
```

И не делать основными Platform SaaS KPI:

```text
Storefront page visits
Storefront customer sessions
Storefront customer visitors
```

только потому, что telemetry технически существует.

Detailed Storefront traffic belongs primarily to:

```text
Partner / Storefront Analytics
```

Если Platform действительно использует aggregate Storefront traffic как internal product-health signal, это должно быть отдельно доказано и явно называться product-health metric, а не commerce/Marketplace KPI.

---

# 15. `storefrontSessions` — REQUIRED AUDIT

В проекте существует известный `storefrontSessions` field/type mismatch.

Не предполагать его семантику.

Нужно установить:

```text
where storefrontSessions is produced
exact formula
exact source
date field
whether it means Storefront behavioral sessions
whether it belongs to Platform Analytics
whether it is currently displayed
why frontend typecheck reports mismatch
```

Классифицировать:

```text
KEEP
RENAME
MOVE
DEPRECATE
REMOVE_FROM_PLATFORM_UI
```

Не удалять backend/API field без compatibility audit.

---

# 16. PLATFORM_GLOBAL METRICS

Если существует показатель, действительно охватывающий всю Platform, сначала проверить, не является ли он ошибочным смешением:

```text
Marketplace
+
Storefront customer commerce
```

Такое смешение не является `PLATFORM_GLOBAL`.

Например:

```text
Marketplace GMV + Storefront customer GMV
```

нельзя назвать Platform GMV.

---

# 17. GMV HARD RULE

Platform Marketplace GMV:

```text
Marketplace commerce only
```

Storefront own customer sales:

```text
excluded
```

Storefront subscription payment to TravelHub:

```text
not GMV
→ SaaS Revenue / subscription economics
```

Не менять этот invariant.

---

# 18. REVENUE HARD RULE

Conceptually:

```text
TravelHub Revenue
├── Marketplace Revenue
│   └── marketplace commission / fees
│
└── Storefront SaaS Revenue
    └── subscriptions / direct Storefront→TravelHub charges
```

Не включать Storefront customer sales revenue в TravelHub Revenue.

---

# 19. PAYMENTS HARD RULE

Classify payment flows:

```text
Marketplace customer payment
→ Marketplace

Storefront customer commerce payment
→ Partner / Storefront Analytics
→ NOT Platform Marketplace Analytics

Storefront subscription/direct payment → TravelHub
→ Storefront SaaS
```

Audit existing Analytics payment KPI against this contract.

---

# 20. ORDERS / BOOKINGS HARD RULE

Platform Analytics:

```text
Orders
Bookings
```

должны означать Marketplace operational commerce unless explicitly labelled otherwise.

Storefront partner customer Orders/Bookings:

```text
Partner Workspace
```

не Platform Marketplace.

---

# 21. CRM / PARTNER METRICS

Audit existing:

```text
Customers
Partners
Active Partners
```

Rules:

```text
Marketplace customers
→ Marketplace context

Storefront end-customers
→ Partner CRM
→ not Platform Marketplace customer population

Storefront partner as TravelHub SaaS client
→ may belong to Storefront SaaS context
```

Не смешивать `customer` и `partner SaaS client`.

---

# 22. VISUAL INFORMATION ARCHITECTURE

Preferred first implementation:

```text
АНАЛИТИКА

Marketplace
[ KPI ][ KPI ][ KPI ][ KPI ]
[ charts / funnel / tables ]

Storefront SaaS
[ KPI ][ KPI ][ KPI ][ KPI ]
[ SaaS charts / subscription health ]
```

Если Storefront SaaS has too few authoritative metrics, показывать только существующие.

Не заполнять пустоту фиктивными KPI.

---

# 23. TABS — OPTIONAL, NOT REQUIRED

Architecture должна позволять future navigation:

```text
[ Все ] [ Marketplace ] [ Storefront SaaS ]
```

Но не добавлять tabs автоматически, если текущий объём Analytics лучше читается двумя sections.

Предпочтение для текущего stage:

```text
single Analytics page
+
clearly separated sections
```

unless existing architecture strongly supports tabs.

---

# 24. `ВСЕ` SEMANTICS — FUTURE-SAFE

Если tabs `Все` уже существуют или будут признаны необходимыми:

```text
Все
```

означает:

```text
show Marketplace section
+
show Storefront SaaS section
```

а не:

```text
mathematically combine Marketplace + Storefront values
```

Никаких смешанных totals без отдельного authoritative Platform-wide metric.

---

# 25. SECTION HEADERS

Required semantic labels:

### RU

```text
Marketplace
Storefront SaaS
```

или более естественные существующему UI локализованные варианты, не меняющие смысл.

### AZ / EN

Добавить корректные локализации.

Не использовать raw keys.

---

# 26. SECTION DESCRIPTION

Рекомендуется короткий subtitle/help text.

Marketplace:

```text
Показатели продаж, трафика и эффективности TravelHub Marketplace.
```

Storefront SaaS:

```text
Показатели использования Storefront, подписок и SaaS-экономики TravelHub.
```

Не превращать UI в архитектурную документацию — описание должно быть коротким.

---

# 27. SHARED ANALYTICS ENGINE

Не создавать второй Analytics framework.

Target:

```text
Shared Analytics Engine
        ↓
Platform Analytics
├── Marketplace section
└── Storefront SaaS section
```

Partner Analytics остаётся entitlement-aware consumer той же общей analytics architecture, где это применимо.

---

# 28. PERIOD CONTRACT

Обе секции должны использовать canonical shared period selector.

Target semantics для named presets должны соответствовать project-wide Calendar Period Contract.

API intervals:

```text
[from,to)
```

Не вводить отдельный period engine для Storefront SaaS.

---

# 29. PERIOD APPLICABILITY

Не все SaaS metrics обязаны использовать одинаковый event timestamp.

Например:

```text
New Storefronts
→ createdAt / activation date

Subscription Revenue
→ payment/recognized date

Churn
→ subscription termination date
```

Audit и документировать exact authoritative date field для каждой metric.

---

# 30. COMPARISON

Comparison должен оставаться metric-specific.

Нельзя сравнивать:

```text
Marketplace current
```

с:

```text
Storefront previous
```

или менять business scope между periods.

---

# 31. CURRENCY

Сохранять закрытый Global Currency Presentation Contract:

```text
DB/API:
AZN / USD / EUR

Product UI:
₼ / $ / €
```

Multi-currency totals остаются раздельными до authoritative FX.

Не вводить currency aggregation между Marketplace и SaaS без доказуемого FX/reporting contract.

---

# 32. DRILL-DOWN SEMANTICS

Каждая clickable KPI должна иметь честный destination.

Canonical categories:

```text
Operational KPI
→ corresponding Operational Center

CRM KPI
→ CRM

Financial KPI
→ Finance / authoritative financial detail

SaaS subscription KPI
→ subscription/storefront authoritative detail when such destination exists
```

Если destination отсутствует:

```text
non-clickable
```

лучше, чем fake redirect.

---

# 33. GMV DRILL-DOWN — DO NOT REGRESS

Не возвращать:

```text
GMV → Orders
```

как canonical final semantic routing.

Текущая отдельная GMV/Financial KPI drill-down remediation остаётся отдельным workstream.

Если Finance Center отсутствует, не создавать fake `/app/finance`.

---

# 34. SECURITY / WORKSPACE AUTHORITY

Platform Analytics остаётся server-authoritative.

Проверить:

```text
workspace = PLATFORM
analytics.read
section permissions where applicable
```

Не использовать UI hiding как security boundary.

Storefront tenant data не должны утекать в Platform Marketplace KPI.

---

# 35. API SCOPE AUDIT

Для каждого metric endpoint/service query установить:

```text
MARKETPLACE only
STOREFRONT_SAAS only
PLATFORM_GLOBAL
```

Если source query смешивает scopes — исправить server-side.

Не решать проблему только frontend filtering.

---

# 36. NO PROVENANCE-AS-AUTHORIZATION

Если используются:

```text
acquisitionSource
salesChannel
referenceNumber prefix
```

они могут помогать классификации/observability, но не должны быть единственным authorization/tenant-isolation mechanism.

---

# 37. STORE FRONT TENANT ISOLATION

Не менять закрытый Reference Number Contract.

Storefront data сохраняются tenant-scoped.

Эта задача не реализует Partner commerce APIs и не должна симулировать tenant-isolation PASS там, где capability отсутствует.

---

# 38. BACKEND REMEDIATION

Если audit обнаружит смешанные formulas, исправить минимально необходимый backend scope.

Required:

```text
server-authoritative filtering
explicit source
explicit period field
no Storefront customer commerce in Marketplace metric
no Marketplace commerce in Storefront SaaS metric
```

---

# 39. FRONTEND REMEDIATION

После audit:

1. создать явные Marketplace / Storefront SaaS sections;
2. переместить существующие KPI в правильные sections;
3. переименовать ambiguous labels;
4. удалить из Platform UI misplaced Storefront customer-commerce metrics;
5. не удалять underlying data;
6. сохранить shared components;
7. сохранить responsive behavior.

---

# 40. NO DUPLICATE CARDS

Если одна metric сейчас появляется в нескольких местах одной Analytics page без осмысленного различия, определить canonical placement.

Не дублировать один и тот же KPI в обеих секциях.

---

# 41. MARKETPLACE RUNTIME RECONCILIATION

Для representative periods проверить минимум:

```text
Marketplace Visitors
Marketplace Visits
Orders
Bookings
GMV
Commission
```

только если эти metrics реально существуют.

Для каждой:

```text
DB/source
=
API
=
UI
```

с одинаковым period/scope.

---

# 42. STOREFRONT SaaS RUNTIME RECONCILIATION

Для каждой реально реализованной SaaS metric:

```text
authoritative source
=
API
=
UI
```

Если authoritative SaaS source отсутствует:

```text
NOT IMPLEMENTED / NOT QUALIFIABLE
```

а не `0 = PASS`.

---

# 43. NEGATIVE CONTROL — MARKETPLACE

Доказать, что Storefront customer commerce не меняет Marketplace KPI.

В isolated test data или через доказуемые existing records:

```text
add/select Storefront customer Order
→ Marketplace Orders unchanged

Storefront customer Booking
→ Marketplace Bookings unchanged

Storefront customer Payment
→ Marketplace financial KPI unchanged

Storefront behavioral event
→ Marketplace Visitors/Visits unchanged
```

Проверять только applicable implemented metrics.

---

# 44. NEGATIVE CONTROL — STOREFRONT SaaS

Marketplace customer commerce не должно увеличивать:

```text
Storefront subscriptions
Storefront SaaS Revenue
Storefront activation
Storefront churn
```

если такие metrics реализованы.

---

# 45. BROWSER RUNTIME — REQUIRED

Проверить `/app/analytics` в:

```text
RU
AZ
EN
```

Required evidence:

```text
Marketplace section visible
Storefront SaaS section visible if it contains qualified metrics
cards in correct sections
no mixed Marketplace/Storefront commerce
no raw i18n keys
period selector works
comparison does not cross scopes
responsive layout remains usable
```

---

# 46. CURRENT VISITORS MANUAL REGRESSION CHECK

Повторно убедиться, что после restructuring:

```text
new anonymous visitor
→ Marketplace Visitors increments
```

и:

```text
Storefront event
→ Marketplace Visitors does not increment
```

Не регрессировать исправленный DTO path.

---

# 47. HISTORICAL VISITOR UX — REQUIRED

Проверить period entirely before visitorId cutover.

Не показывать historical telemetry absence как доказанный real zero.

Report actual UI behavior and remediation.

---

# 48. TESTS

Добавить/обновить tests для:

```text
Analytics metric classification where practical
Marketplace-only queries
Storefront SaaS-only queries where implemented
Storefront exclusion
Visitors/Visits non-regression
i18n labels
section rendering
period propagation
permission behavior
```

---

# 49. TEST RESULT TRUTHFULNESS

Если suite:

```text
282/283
```

писать:

```text
FAIL — 282/283
```

даже если failure pre-existing/unrelated.

Можно добавить:

```text
Scope impact: NONE / LOW / MATERIAL
```

Но нельзя писать `PASS(scope)`.

---

# 50. TYPECHECK TRUTHFULNESS

Из предыдущего workstream известен возможный:

```text
storefrontSessions
```

frontend type mismatch.

Если actual command fails:

```text
Frontend typecheck = FAIL
```

Если remediation в рамках этой задачи устраняет mismatch — показать actual PASS.

Не маскировать failure.

---

# 51. BUILD / VALIDATION

Run applicable:

```text
backend typecheck
backend build
frontend typecheck
frontend build
relevant tests
Prisma validate if schema touched
```

Report actual results.

---

# 52. REPRESENTATIVE DATA SAFETY

Forbidden:

```text
reset representative DB
reseed representative DB
delete Storefront commerce
delete Storefront behavioral events
rewrite historical data merely to make metrics pass
fabricate SaaS subscriptions/payments
```

Use isolated DB for synthetic negative-control scenarios.

---

# 53. REQUIRED FINAL CLASSIFICATION MATRIX

| Metric/UI element | Current scope | Target scope | Formula/source verified? | Action | Runtime result |
|---|---|---|---|---|---|
| | | MARKETPLACE / STOREFRONT_SAAS / PLATFORM_GLOBAL / REMOVE_FROM_PLATFORM | | | |

---

# 54. REQUIRED MARKETPLACE MATRIX

| Metric | Source | Formula | Period field | Storefront commerce excluded? | DB=API=UI |
|---|---|---|---|---|---|
| Marketplace Visitors | | | | YES | |
| Marketplace Visits | | | | YES | |
| Orders | | | | YES | |
| Bookings | | | | YES | |
| GMV | | | | YES | |
| Commission | | | | YES | |

Use `N/A` for genuinely absent metrics, not fabricated values.

---

# 55. REQUIRED STOREFRONT SaaS MATRIX

| Candidate metric | Status | Authoritative source | Formula | UI shown? | DB=API=UI |
|---|---|---|---|---|---|
| Active Storefronts | | | | | |
| New Storefronts | | | | | |
| Active Subscriptions | | | | | |
| Paid Storefronts | | | | | |
| Trial → Paid | | | | | |
| Subscription Revenue | | | | | |
| MRR | | | | | |
| ARR | | | | | |
| Churn | | | | | |
| Retention | | | | | |

Statuses:

```text
IMPLEMENTED + AUTHORITATIVE
PARTIAL
NOT IMPLEMENTED
NOT QUALIFIABLE
```

---

# 56. REQUIRED MISPLACED DATA MATRIX

| Current Platform Analytics element | Why misplaced | Correct owner | Action |
|---|---|---|---|
| | | Partner/Storefront Analytics / other | |

---

# 57. REQUIRED PAYMENTS CLASSIFICATION

| Payment type | Platform Marketplace | Platform Storefront SaaS | Partner Storefront Analytics |
|---|---|---|---|
| Marketplace customer payment | YES | NO | NO |
| Storefront customer commerce payment | NO | NO | YES |
| Storefront subscription → TravelHub | NO | YES | contextual |

Validate actual implementation against this contract.

---

# 58. REQUIRED BROWSER MATRIX

| Locale | Marketplace section | Storefront SaaS section | Correct labels | No raw keys | Result |
|---|---|---|---|---|---|
| RU | | | | | |
| AZ | | | | | |
| EN | | | | | |

---

# 59. REQUIRED QUALITY MATRIX

| Check | Actual result | Scope impact |
|---|---|---|
| Backend typecheck | | |
| Backend build | | |
| Frontend typecheck | | |
| Frontend build | | |
| Relevant tests | | |
| Browser RU | | |
| Browser AZ | | |
| Browser EN | | |

---

# 60. ROADMAP

Update additively:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Record:

```text
Platform Analytics IA:
Marketplace vs Storefront SaaS

Marketplace scope contract

Storefront SaaS scope contract

Storefront customer commerce exclusion

Visitors/Visits placement

qualified Storefront SaaS metrics

unimplemented SaaS metrics

remaining gaps
```

Preserve history and numbering.

Do not auto-start next stage.

---

# 61. GIT EVIDENCE

Report real:

```text
Starting SHA
Implementation SHA
Final HEAD
origin/master
HEAD == origin/master
working tree status
```

---

# 62. REQUIRED REPORT STRUCTURE

Report predominantly in Russian:

```text
1. Executive Summary
2. Starting Repository State
3. Existing Analytics Inventory
4. Business Scope Classification
5. Marketplace Section Contract
6. Storefront SaaS Section Contract
7. Misplaced / Unknown Metrics
8. storefrontSessions Audit
9. Backend Scope Remediation
10. Frontend IA Remediation
11. Visitors/Visits Non-Regression
12. Historical Visitor UX
13. Payments / GMV / Revenue Scope
14. Period / Comparison
15. Drill-down Review
16. Security / Workspace Authority
17. DB/API/UI Reconciliation
18. Negative Controls
19. Browser RU/AZ/EN
20. Tests / Typecheck / Build
21. Required Matrices
22. Roadmap
23. Git Evidence
24. Residual Risks
25. Final Verdict
```

---

# 63. ACCEPTANCE GATES

All required for `VERDICT A`:

```text
[ ] complete existing Analytics inventory
[ ] every current element classified
[ ] Marketplace section visually distinct
[ ] Storefront SaaS section visually distinct where qualified metrics exist
[ ] Marketplace metrics exclude Storefront customer commerce
[ ] Storefront SaaS metrics do not represent Storefront customer commerce
[ ] no fake SaaS KPI
[ ] Marketplace Visitors/Visits remain Marketplace-only
[ ] anonymous Visitors runtime remains working
[ ] historical Visitors limitation represented honestly
[ ] storefrontSessions semantics qualified
[ ] Marketplace Orders/Bookings/Payments scope remains Marketplace-only
[ ] GMV does not include Storefront commerce
[ ] Revenue does not treat Storefront customer sales as TravelHub Revenue
[ ] Storefront telemetry preserved
[ ] Partner/Storefront data preserved
[ ] server-authoritative scope
[ ] DB/API/UI reconciliations complete for shown metrics
[ ] negative controls PASS
[ ] RU/AZ/EN browser evidence PASS
[ ] tests reported truthfully
[ ] typecheck/build reported truthfully
[ ] roadmap updated additively
[ ] Git evidence complete
```

---

# 64. VERDICT RULES

## VERDICT A — PLATFORM ANALYTICS MARKETPLACE / STOREFRONT SaaS SEPARATION QUALIFIED

Only if all applicable hard gates pass.

## VERDICT B — REMEDIATION REQUIRED

Use if architecture direction is correct but:

```text
mixed data remains
runtime evidence missing
historical Visitors UI misleading
Storefront SaaS metrics unqualified but displayed
scope is frontend-only
i18n/runtime defects remain
```

## VERDICT C — BUSINESS SCOPE INVALID

Use if implementation fundamentally mixes:

```text
Marketplace commerce
+
Storefront partner customer commerce
```

or treats Storefront customer sales as TravelHub Platform revenue/GMV.

---

# 65. IMPORTANT NON-GOALS

Do NOT implement in this task:

```text
full Finance Center
FX engine
Partner Settlement
Cart/Checkout
new Partner commerce APIs
Cross-Entity Traceability
Booking KPI redesign
new Storefront subscription billing engine
fake MRR/ARR/churn
```

If required capability is absent, classify it honestly.

---

# 66. STRICT REVIEW PAIRING RULE

This is an **implementation/remediation task**.

Even after developer reports `VERDICT A`, this stage is not considered fully closed until a **separate Strict Review** is executed and accepted.

Do not self-review the same implementation as final closure.

---

# 67. STOP CONDITION

STOP after implementation/remediation report.

Do not automatically start:

```text
Strict Review
GMV / Financial KPI Drill-down next work
Cross-Entity Business Reference & Traceability
Booking KPI Semantics Audit
Final PRE-STEP 3.12 Re-Qualification
Step 3.12
```
