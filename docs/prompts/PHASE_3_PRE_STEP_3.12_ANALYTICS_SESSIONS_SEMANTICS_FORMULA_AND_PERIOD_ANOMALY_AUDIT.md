# PHASE 3 — PRE-STEP 3.12 — ANALYTICS «СЕССИИ» SEMANTICS, FORMULA & PERIOD ANOMALY AUDIT

## STATUS

**Task type:** Evidence-only audit  
**Implementation changes:** FORBIDDEN until the audit report is independently reviewed.

В Platform Analytics (`/app/analytics`) существует карточка **«Сессии»**.

Наблюдаемая runtime-аномалия:

```text
3 дня  → 11
Месяц  → 1
```

Но **нельзя начинать расследование этой аномалии, пока не установлено, что именно означает метрика «Сессии» и по какой формуле она рассчитывается**.

Поэтому задача выполняется строго в два последовательных этапа:

```text
STAGE A
Определить семантику и формулу «Сессии»
        ↓
зафиксировать authoritative metric contract
        ↓
STAGE B
Только после этого проверить 11 vs 1
```

---

# LANGUAGE REQUIREMENT — MANDATORY

Все отчёты, findings, root cause analysis, data lineage, formula explanations, runtime evidence, conclusions, matrices и verdict explanations должны быть преимущественно **на русском языке**.

English допускается только для technical identifiers:

- file paths;
- classes/methods/functions;
- DTO/model/table/field names;
- endpoints;
- HTTP methods/status codes;
- SQL;
- CLI/Git commands;
- enums;
- metric IDs;
- code snippets;
- standardized `VERDICT`.

Преимущественно англоязычный отчёт = задача незавершена.

Не включать plaintext passwords, tokens, cookies, session identifiers, secrets или credentials.

---

# STAGE A — WHAT DOES «СЕССИИ» ACTUALLY MEAN?

## A1. PRIMARY QUESTION

Сначала дать доказательный ответ:

> **Что именно означает одна единица в карточке «Сессии»?**

Не переходить к анализу `11 vs 1`, пока этот вопрос не закрыт.

Запрещено предполагать:

```text
Сессии = visits
Сессии = unique visitors
Сессии = authenticated sessions
Сессии = storefrontSessions
Сессии = page views
Сессии = requests
Сессии = users
```

Нужно установить фактическую production semantics.

---

## A2. IDENTIFY THE EXACT CARD

Найти карточку на:

```text
/app/analytics
```

Зафиксировать:

```text
frontend component
metricId/key
translation key
displayed field
comparison field
formatter
clickability
drill-down destination if any
```

Проверить RU/AZ/EN labels.

Logic не должна определяться по translated label.

---

## A3. COMPLETE DATA LINEAGE

Построить без пропусков:

```text
Analytics «Сессии»
        ↓
frontend component
        ↓
frontend data field
        ↓
query/hook/service
        ↓
API endpoint
        ↓
response DTO
        ↓
backend controller
        ↓
backend service
        ↓
repository / Prisma query
        ↓
DB table/model OR event source
        ↓
exact aggregation formula
```

Для каждого звена указать:

```text
file path
symbol/function
field
query/filter
```

Если какое-либо звено отсутствует — `NOT PROVEN`.

---

## A4. EXACT FORMULA — HARD GATE

Установить **точную формулу** карточки.

Например, но не предполагать:

```sql
COUNT(*)
```

или:

```sql
COUNT(DISTINCT session_id)
```

или:

```sql
COUNT(DISTINCT visitor_id)
```

или:

```text
SUM(preaggregatedSessionCount)
```

или иная формула.

В отчёте должна появиться формула уровня:

```text
Sessions =
COUNT(DISTINCT X)
WHERE
    timestamp >= from
AND timestamp < to
AND ...
```

со всеми реально применяемыми predicates.

---

## A5. WHAT CREATES ONE SESSION?

Установить lifecycle.

Ответить:

```text
Какое событие создаёт session?
Когда начинается session?
Когда заканчивается?
Есть ли inactivity timeout?
Какой timeout?
Повторный визит создаёт новую session?
Новая вкладка создаёт новую session?
Новый browser/device создаёт новую session?
Login создаёт session?
Logout завершает session?
Anonymous visitor учитывается?
Authenticated visitor учитывается?
```

Если механизм отсутствует — так и написать.

Если session является не реальной persisted entity, а вычисляемой аналитической единицей — описать algorithm.

---

## A6. SESSION IDENTITY

Если существует session identifier, установить:

```text
где генерируется
кто генерирует
где хранится
сколько живёт
может ли один visitor иметь несколько session IDs
может ли session ID использоваться между страницами
```

Не выводить реальные IDs в отчёте.

---

## A7. SESSION VS UNIQUE VISITOR

Обязательно доказать:

```text
Session ≠ Unique Visitor
```

или, если реализация действительно считает unique visitors:

```text
Current metric is actually Unique Visitors
```

Проверить:

```text
один visitor → несколько sessions?
одна session → один visitor?
anonymous visitor identity available?
```

---

## A8. SESSION VS AUTH SESSION

Проверить, не является ли метрика количеством:

```text
login sessions
JWT sessions
refresh-token sessions
server sessions
```

Если Analytics «Сессии» считает auth sessions, это должно быть явно зафиксировано.

---

## A9. SESSION VS PAGE VIEW / EVENT

Проверить, не считается ли:

```text
page views
analytics events
HTTP requests
frontend navigations
```

под label `Сессии`.

Если:

```text
COUNT(events)
```

показывается как `Сессии`, это semantic finding.

---

## A10. AUTHORITATIVE SOURCE

Установить authoritative source:

```text
DB table
analytics event table
telemetry store
pre-aggregated table
external analytics source
runtime-derived query
```

Указать:

```text
model/table
primary relevant fields
timestamp field
source/channel field
workspace/tenant relation
```

---

## A11. DATE FIELD — HARD GATE

Установить, какое поле определяет попадание session в период:

```text
createdAt?
startedAt?
lastActivityAt?
endedAt?
eventAt?
other?
```

Нужно зафиксировать одно authoritative правило.

Если разные code paths используют разные date fields — finding.

---

## A12. PERIOD FORMULA

После определения metric formula установить:

```text
Sessions(from,to)
```

в точной форме.

Например:

```text
Sessions(from,to)
=
COUNT(DISTINCT sessionId)
WHERE startedAt ∈ [from,to)
```

Это только пример.

В отчёте должна быть **фактическая** формула проекта.

---

## A13. MARKETPLACE VS STOREFRONT SCOPE — HARD GATE

Определить population:

```text
Marketplace only?
Storefront only?
Marketplace + Storefront?
Other/internal?
NULL/unclassified?
```

Canonical architecture:

```text
Marketplace commerce/activity
→ Platform Marketplace context

Storefront customer commerce/activity
→ Partner / Storefront context

Storefront SaaS/product-health
→ may exist in Platform as explicitly separate SaaS metric
```

Нельзя молча использовать Storefront traffic как denominator Marketplace Conversion.

---

## A14. `storefrontSessions` RELATIONSHIP

В проекте существует/существовал identifier:

```text
storefrontSessions
```

Найти все definitions/usages и установить:

```text
что означает storefrontSessions
его backend source
DTO field
frontend type
где отображается
имеет ли отношение к Analytics «Сессии»
```

Финальный ответ:

```text
Analytics «Сессии» == storefrontSessions
YES / NO / PARTIALLY / NOT PROVEN
```

Известный frontend `storefrontSessions` type mismatch **не исправлять** в этом audit.

---

## A15. CONVERSION FORMULA

Найти точную формулу карточки/метрики `Conversion`.

Установить:

```text
numerator
denominator
date fields
status scope
business scope
```

Ответить:

```text
Использует ли Conversion карточку «Сессии» как denominator?
YES / NO
```

Если YES, показать точную формулу:

```text
Conversion = X / Sessions × 100
```

где `X` определяется production code.

---

## A16. SCOPE ALIGNMENT WITH CONVERSION

Если Sessions участвуют в Conversion:

```text
Sessions scope
=
Conversion numerator scope
```

должен быть доказан.

Проверить отдельно:

```text
Marketplace
Storefront
tenant
workspace
period
```

Недопустимо, например:

```text
Marketplace Orders
/
Marketplace + Storefront Sessions
```

без явно определённой бизнес-семантики.

---

## A17. FUNNEL RELATIONSHIP

Если Analytics показывает funnel, установить:

```text
используются ли Sessions как первый stage?
```

Если да:

```text
Sessions → ? → Orders → Bookings
```

для каждого stage показать exact formula/source.

Не считать funnel корректным только потому, что числа визуально убывают.

---

## A18. RUNTIME RECONCILIATION OF THE FORMULA

После определения формулы выбрать один период и доказать:

```text
Authoritative DB/Event calculation
=
API value
=
UI «Сессии»
```

Это обязательный gate для принятия формулы.

Code inspection alone недостаточен.

---

## A19. REPRESENTATIVE RECORDS

Показать несколько обезличенных records/events, которые:

```text
INCLUDED in Sessions
EXCLUDED from Sessions
```

и объяснить почему.

Можно показывать:

```text
record type
source/channel
timestamp
workspace/storefront relation
anonymous/authenticated flag
```

Не показывать PII/IP/cookies/tokens/session IDs.

---

# STAGE A — REQUIRED OUTPUT

## A20. AUTHORITATIVE SESSION CONTRACT

Перед переходом к аномалии сформировать отдельный блок:

```text
AUTHORITATIVE ANALYTICS SESSION CONTRACT

Metric ID:
Visible label:
Business meaning:
One session means:
Authoritative source:
Aggregation:
Distinct key:
Date field:
Period interval:
Marketplace included:
Storefront included:
Anonymous included:
Authenticated included:
Used by Conversion:
Used by Funnel:
Relationship to storefrontSessions:
```

И точную формулу:

```text
Sessions(from,to,scope) = ...
```

---

## A21. STAGE A VERDICT

Разрешены:

```text
STAGE A — QUALIFIED
STAGE A — SEMANTIC DEFECT FOUND
STAGE A — INSUFFICIENT EVIDENCE
```

**Если формула/semantics не доказаны, STAGE B не начинать.**

---

# STAGE B — INVESTIGATE THE 3 DAYS VS MONTH ANOMALY

Stage B выполняется **только если Stage A установил authoritative formula**.

Observed:

```text
3 дня  → 11
Месяц  → 1
```

---

## B1. FIRST QUESTION

На основании формулы из Stage A определить:

> Должна ли эта метрика вообще быть monotonic по расширению периода?

Если формула:

```text
COUNT sessions in interval
```

то:

```text
A ⊆ B
→
Sessions(A) ≤ Sessions(B)
```

Если формула имеет другую семантику, сначала вывести математическое expected behavior именно из неё.

Не применять monotonicity blindly.

---

## B2. REPRODUCE BOTH STATES

В browser/runtime воспроизвести:

```text
3 дня
Месяц
```

Для каждого:

```text
UI value
effective from
effective to
timezone
API request
API response
```

Если historical value изменился — использовать current equivalent contained intervals и отдельно отметить это.

---

## B3. PROVE INTERVAL CONTAINMENT

Зафиксировать:

```text
A.from
A.to
B.from
B.to
```

и проверить:

```text
B.from <= A.from
A.to <= B.to
```

Если containment отсутствует, аномалия может быть вызвана semantics preset.

---

## B4. FRONTEND PERIOD MAPPING

Проверить mapping:

```text
3 дня
Месяц
```

и другие relevant presets.

Искать:

```text
wrong preset key
wrong start/end
rolling vs calendar mismatch
month-index error
stale state
comparison dates
UTC/local conversion
```

---

## B5. BACKEND PERIOD PARSING

Проверить:

```text
DTO
transform
defaults
from/to parser
timezone
[from,to)
```

Установить фактические intervals, которые backend применил.

---

## B6. DB/API/UI RECONCILIATION FOR BOTH PERIODS

Используя **ровно формулу Stage A**:

```text
3 days:
DB/Event = ?
API = ?
UI = ?

Month:
DB/Event = ?
API = ?
UI = ?
```

Не создавать новую SQL-формулу специально для совпадения с UI.

---

## B7. CURRENT VS COMPARISON MIX-UP

Проверить:

```text
current.sessions
comparison.sessions
delta
displayed field
```

Исключить сценарий:

```text
current = 11
comparison = 1
UI displays wrong field
```

---

## B8. CACHE / QUERY KEY / RACE

Проверить:

```text
queryKey includes period?
cache includes from/to?
stale response?
race condition?
request cancellation?
```

Browser sequence:

```text
3 дня → Месяц
Месяц → 3 дня
```

Сопоставить request order и rendered value.

---

## B9. TIMEZONE / BOUNDARIES

Проверить:

```text
frontend timezone
backend timezone
DB timezone
startOfDay
startOfMonth
UTC conversion
```

Особенно records около day/month boundary.

---

## B10. SCOPE DRIFT

Проверить, что смена периода не меняет:

```text
workspace
Marketplace/Storefront
tenant
source/channel
status/filter
```

Period switch должен менять period, а не business population.

---

## B11. ZERO / NULL / FALLBACK

Искать:

```ts
value || 1
count ?? 1
Math.max(1, count)
```

или equivalent.

Для count:

```text
0 ≠ missing
```

Не заменять zero единицей.

---

## B12. CUSTOM PERIOD CONTROL TEST

Создать два guaranteed-contained custom periods:

```text
A = [T1,T2)
B = [T0,T3)

T0 <= T1 < T2 <= T3
```

Посчитать по authoritative formula Stage A.

Это отделяет preset bug от aggregation/data bug.

---

## B13. CONVERSION IMPACT

Если Stage A доказал, что Sessions участвуют в Conversion, проверить:

```text
Conversion for 3 days
Conversion for month
```

и определить, искажает ли anomaly Conversion.

---

# REQUIRED MATRICES

## 1. SESSION SEMANTICS

| Question | Proven answer | Evidence |
|---|---|---|
| Что означает одна Session? | | |
| Exact formula | | |
| Authoritative source | | |
| Distinct key | | |
| Date field | | |
| Marketplace included? | | |
| Storefront included? | | |
| Anonymous included? | | |
| Authenticated included? | | |
| Unique visitor metric? | YES/NO | |
| Auth session metric? | YES/NO | |
| Used by Conversion? | YES/NO | |
| Used by Funnel? | YES/NO | |
| Same as storefrontSessions? | YES/NO/PARTIALLY | |

## 2. DATA LINEAGE

```text
Analytics «Сессии»
↓
frontend component
↓
frontend field
↓
API
↓
DTO
↓
backend service
↓
query
↓
authoritative source
↓
formula
```

## 3. FORMULA RECONCILIATION

| Layer | Value | Period | Scope | Result |
|---|---:|---|---|---|
| DB/Event | | | | |
| API | | | | |
| UI | | | | |

## 4. ANOMALY PERIOD MATRIX

| Period | Effective from | Effective to | Timezone | API value | UI value |
|---|---|---|---|---:|---:|
| 3 дня | | | | | |
| Месяц | | | | | |
| Custom narrow | | | | | |
| Custom broad | | | | | |

## 5. ANOMALY RECONCILIATION

| Period | DB/Event by Stage A formula | API | UI | DB=API | API=UI |
|---|---:|---:|---:|---|---|
| 3 дня | | | | | |
| Месяц | | | | | |
| Custom narrow | | | | | |
| Custom broad | | | | | |

## 6. CONVERSION

| Item | Formula | Source | Scope | Period/date field |
|---|---|---|---|---|
| Sessions | | | | |
| Conversion numerator | | | | |
| Conversion | | | | |

Explicit:

```text
Scope aligned: YES/NO
Period aligned: YES/NO
Population semantics aligned: YES/NO
```

---

# ROOT CAUSE CLASSIFICATION

Only after Stage A formula is known classify anomaly as one or more:

```text
A. No anomaly — metric semantics explain behavior
B. Frontend period mapping defect
C. Backend period parsing defect
D. Wrong timestamp field
E. Wrong aggregation
F. Current/comparison field mix-up
G. Cache/query-key/race defect
H. Marketplace/Storefront scope drift
I. Timezone/boundary defect
J. Null/zero/fallback defect
K. Source-data defect
L. Metric label/semantics defect
M. Other — prove
```

---

# TESTS

Find/run relevant existing tests for:

```text
Sessions formula
period filtering
Conversion
Funnel
Marketplace/Storefront scope
comparison
```

Do not modify production behavior.

Synthetic validation only in isolated test DB if necessary.

---

# NO DATA MUTATION

Forbidden:

```text
reseed representative DB
delete session/event records
reclassify Marketplace/Storefront data
change acquisitionSource
change historical timestamps
change tenant ownership
```

---

# REQUIRED REPORT STRUCTURE

Отчёт преимущественно на русском:

```text
1. Executive Summary
2. Repository / SHA State

STAGE A
3. Exact «Сессии» Card Identification
4. Frontend Data Lineage
5. Backend Data Lineage
6. Authoritative Source
7. Exact Session Formula
8. Session Lifecycle / Identity
9. Session vs Visitor/Auth/PageView
10. Authoritative Date Field
11. Marketplace vs Storefront Scope
12. storefrontSessions Relationship
13. Conversion Formula
14. Funnel Relationship
15. Runtime Formula Reconciliation
16. Authoritative Analytics Session Contract
17. Stage A Verdict

STAGE B
18. Observed 3 Days vs Month Anomaly
19. Effective Periods
20. Expected Mathematical Behavior
21. Frontend Period Mapping
22. Backend Period Parsing
23. DB/API/UI Reconciliation
24. Current vs Comparison
25. Cache / Race
26. Timezone / Boundaries
27. Scope Drift
28. Custom Period Control Test
29. Conversion Impact
30. Root Cause

31. Required Matrices
32. Findings / Severity
33. Recommended Remediation
34. Final Verdict
```

---

# VERDICT RULES

## VERDICT A — SESSION SEMANTICS AND PERIOD BEHAVIOR QUALIFIED

Only if:

```text
Session meaning proven
+
exact formula proven
+
complete data lineage proven
+
Marketplace/Storefront scope proven
+
Conversion relationship proven
+
DB = API = UI
+
11 vs 1 behavior either corrected by semantics or proven non-defective
```

## VERDICT B — DEFECT CONFIRMED

Use if Stage A proves a formula under which the observed period behavior is invalid, or if semantic/scope/data-lineage defects are found.

## VERDICT C — INSUFFICIENT EVIDENCE

Use if authoritative Session meaning/formula cannot be established.

**If Stage A is not qualified, do not pretend to diagnose Stage B conclusively.**

---

# STOP CONDITION

**STOP after the audit report.**

Do not automatically:

- change Session formula;
- rename the card;
- fix period mapping;
- fix Conversion/Funnel;
- fix `storefrontSessions`;
- modify GMV routing;
- start another remediation.

First return the authoritative meaning/formula of `Сессии`, then the anomaly analysis based on that formula.
