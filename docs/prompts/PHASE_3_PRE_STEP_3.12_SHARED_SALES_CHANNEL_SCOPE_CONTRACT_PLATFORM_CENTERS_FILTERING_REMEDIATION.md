# PHASE 3 — PRE-STEP 3.12 — SHARED SALES CHANNEL SCOPE CONTRACT + PLATFORM CENTERS FILTERING REMEDIATION

## ТИП ЗАДАЧИ

**IMPLEMENTATION / REMEDIATION**

Основание — завершённый:

```text
PLATFORM SALES CHANNEL DATA SCOPE AUDIT — MARKETPLACE vs STOREFRONT
VERDICT A — AUDIT COMPLETE
```

Audit Starting SHA:

```text
688a8bb
```

Audit SHA / последний известный HEAD:

```text
224718a
```

Аудит доказал, что Storefront — реальный ненулевой коммерческий канал:

```text
Orders:
MARKETPLACE 1073
STOREFRONT   400
NULL          43
ALL         1516

Bookings:
MARKETPLACE 403
STOREFRONT  276
NULL         13
ALL          692

Payments CAPTURED:
MARKETPLACE 447
STOREFRONT  292
NULL         19
ALL          758
```

Storefront составляет существенную долю реальных операций.

Также доказано:

```text
Command Center financial metrics → ALL channels
Marketplace Customers/Partners   → MARKETPLACE
Total Active Customers/Partners  → ALL/union
```

Поэтому текущая общая подпись:

```text
Агрегированные данные Marketplace · UTC
```

семантически вводит пользователя в заблуждение.

Цель remediation — ввести **единый Shared Sales Channel Scope Contract** и применить его согласованно к Platform business surfaces.

---

# LANGUAGE REQUIREMENT — MANDATORY

Все Implementation / Remediation / Evidence / Strict Review reports и prose-документация должны быть преимущественно **на русском языке**.

На русском:

- implementation report;
- remediation report;
- evidence/runtime report;
- findings;
- root cause analysis;
- architecture decisions;
- security findings;
- conclusions;
- recommendations;
- verdict explanations.

Английский разрешён только для:

- file paths;
- class/method/DTO/model/table names;
- API endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- commit messages;
- enums;
- permission identifiers;
- code snippets;
- standardized `VERDICT`.

Если итоговый отчёт преимущественно английский — задача не завершена.

---

# 0. STARTING POINT

Перед изменениями:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
```

Последний известный SHA:

```text
224718a
```

Если фактический HEAD отличается — использовать фактический HEAD как Starting SHA и объяснить расхождение.

Прочитать audit report:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_PLATFORM_SALES_CHANNEL_DATA_SCOPE_AUDIT.md
```

Не переинтерпретировать доказанные audit findings без нового evidence.

---

# 1. CORE ARCHITECTURE

Не создавать семь независимых фильтров.

Нужен единый контракт:

```text
Shared Sales Channel Scope
            │
            ├── ALL          ← default
            ├── MARKETPLACE
            └── STOREFRONT
                    ↓
        canonical query mapping
                    ↓
        server-authoritative filtering
                    ↓
 ┌──────────────────┼──────────────────┐
 ↓                  ↓                  ↓
Command Center    Analytics        Domain Centers
                                   Orders
                                   Bookings
                                   Payments
                                   CRM
                                   Partner Performance
```

Одинаковые названия scope должны означать одинаковую бизнес-семантику на всех применимых surfaces.

---

# 2. CANONICAL DOMAIN SOURCE — DO NOT DUPLICATE

Audit обнаружил существующий backend/domain concept:

```text
acquisitionSource
```

и поддержку соответствующего backend parameter.

Перед implementation подтвердить фактические enum values и mapping в repo.

**Не создавать новый параллельный `salesChannel` field/enum в persistent domain model**, если `acquisitionSource` уже является каноническим источником происхождения операции.

UI/shared contract может называться:

```text
SalesChannelScope
```

как presentation/query abstraction, но должен маппиться на существующий canonical `acquisitionSource`.

Пример концептуально:

```text
SalesChannelScope.ALL
→ no acquisitionSource predicate

SalesChannelScope.MARKETPLACE
→ acquisitionSource = MARKETPLACE

SalesChannelScope.STOREFRONT
→ acquisitionSource = STOREFRONT
```

Использовать фактические enum names проекта.

---

# 3. CRITICAL NULL / UNKNOWN CONTRACT

Audit доказал наличие legacy/unclassified records:

```text
Orders NULL            = 43
Bookings NULL          = 13
Payments CAPTURED NULL = 19
```

Поэтому:

```text
ALL ≠ MARKETPLACE + STOREFRONT
```

в текущем dataset.

Канонический контракт:

```text
ALL
= ВСЕ записи соответствующей выборки
= без acquisitionSource predicate
= включает MARKETPLACE + STOREFRONT + NULL/UNKNOWN
```

```text
MARKETPLACE
= только canonical Marketplace source
```

```text
STOREFRONT
= только canonical Storefront source
```

**Запрещено** реализовывать ALL как:

```sql
WHERE acquisitionSource IN ('MARKETPLACE', 'STOREFRONT')
```

потому что это потеряет исторические NULL/UNKNOWN записи.

На этом этапе **не добавлять пользовательский `UNKNOWN` selector**, если для него нет отдельного продуктового требования.

NULL/UNKNOWN остаётся включённым только в `ALL`.

---

# 4. DEFAULT SCOPE

Для Platform Workspace:

```text
default = ALL
```

Обоснование:

Platform operator должен по умолчанию видеть всю коммерческую деятельность платформы, а не только один канал.

Не использовать Marketplace как скрытый default.

---

# 5. SHARED UI CONTROL

Создать/reuse один shared control, например концептуально:

```text
SalesChannelScopeSelector
```

Не копировать три `<select>` options вручную на каждой странице.

UI:

```text
[ Все каналы ▼ ]

Все каналы
Marketplace
Storefront
```

Локализация минимум:

```text
RU:
Все каналы
Marketplace
Storefront

AZ:
Bütün kanallar
Marketplace
Storefront

EN:
All channels
Marketplace
Storefront
```

Если проект уже имеет утверждённую AZ terminology — использовать canonical dictionary проекта.

0 raw keys.

---

# 6. SHARED QUERY / URL CONTRACT

Channel scope должен быть переносимым и воспроизводимым.

Предпочтительно отражать explicit non-default scope в URL/query state, например:

```text
?channel=MARKETPLACE
?channel=STOREFRONT
```

или существующий canonical API/query naming:

```text
?acquisitionSource=...
```

Не ломать существующие deep links.

Требования:

```text
ALL → canonical default
MARKETPLACE → shareable/reload-safe
STOREFRONT → shareable/reload-safe
F5 → selected scope сохраняется
browser back/forward → корректно
```

Если существующая архитектура проекта имеет shared filter state/router contract — использовать его.

Не вводить новый global state framework только ради этой задачи.

---

# 7. FILTER COMPOSITION

Sales channel — только одно измерение фильтрации.

Он должен корректно комбинироваться с:

```text
period
comparison
currency
status
partner
customer
service
search
pagination
sorting
```

То есть:

```text
Result
=
Workspace/Tenant scope
∩ Permission scope
∩ Sales Channel scope
∩ Period
∩ Other filters
```

Channel selector не должен сбрасывать period или другие применимые фильтры без причины.

---

# 8. SERVER-AUTHORITATIVE FILTERING

Критично:

```text
UI selector ≠ security boundary
```

Backend должен применять canonical source filtering.

Нельзя:

```text
load ALL
→ filter MARKETPLACE/STOREFRONT only in React
```

для полноценных registries/analytics.

Это приведёт к:

- неверным totals;
- неверной pagination;
- неверным aggregate summaries;
- data leakage risks;
- несогласованным KPI.

---

# 9. COMMAND CENTER

Добавить shared Sales Channel Scope Selector в Command Center.

Ожидаемое поведение:

```text
ALL
→ все применимые показатели по всем source,
   включая legacy NULL/UNKNOWN там, где они входят в canonical population

MARKETPLACE
→ только Marketplace population

STOREFRONT
→ только Storefront population
```

## 9.1 Subtitle

Убрать статичную вводящую в заблуждение подпись:

```text
Агрегированные данные Marketplace · UTC
```

Сделать subtitle scope-aware.

Рекомендуемый contract:

```text
RU

ALL:
Агрегированные данные платформы · UTC

MARKETPLACE:
Данные Marketplace · UTC

STOREFRONT:
Данные Storefront · UTC
```

AZ/EN — локализовать эквивалентно.

Если в проекте уже существует canonical wording для platform aggregate data — использовать его.

## 9.2 Не менять UTC без evidence

Audit должен был проверить UTC claim.

Если audit доказал UTC:

```text
оставить UTC
```

Если audit отметил UTC как NOT PROVEN — не маскировать finding. Отразить residual gap и следовать доказанному period/timezone contract.

---

# 10. METRIC APPLICABILITY CONTRACT — CRITICAL

Нельзя механически применять channel filter ко всем KPI.

Audit уже показал metrics с разной семантикой.

Для каждого KPI создать/reuse explicit applicability metadata:

```text
CHANNEL_FILTERABLE
CHANNEL_FIXED_MARKETPLACE
CHANNEL_FIXED_STOREFRONT
CHANNEL_NOT_APPLICABLE
```

или эквивалентную простую архитектуру проекта.

Не переусложнять, но semantics должны быть explicit.

---

# 11. MARKETPLACE-SPECIFIC METRICS

Пример доказанного metric:

```text
Активные партнёры (marketplace)
```

Он не должен при выборе:

```text
STOREFRONT
```

молча показывать Marketplace population под тем же смыслом.

Для таких metrics определить корректное поведение на основании domain semantics.

Допустимые варианты:

### A. Metric имеет channel-equivalent

```text
ALL:
Активные партнёры

MARKETPLACE:
Активные партнёры Marketplace

STOREFRONT:
Активные Storefront-партнёры
```

если backend/domain semantics позволяют exact equivalents.

### B. Metric строго marketplace-only

Тогда при Storefront scope:

```text
N/A / metric hidden / explicit not applicable
```

с понятным UX.

**Запрещено показывать 0**, если 0 означает "нет данных", а реальная причина — metric неприменим.

Выбор A/B должен быть доказан конкретной metric semantics.

---

# 12. COMMAND CENTER COMPARISON

При включённом:

```text
Сравнение
```

current и previous periods должны использовать **одинаковый channel scope**.

Пример:

```text
STOREFRONT + Month
current → Storefront current month
previous → Storefront comparison period
```

Запрещено сравнивать:

```text
current STOREFRONT
vs
previous ALL
```

---

# 13. ANALYTICS

Добавить тот же shared scope selector.

Применить к channel-applicable:

```text
KPIs
time series
activity/funnel metrics
Financial Summary
Partner Performance
tables/drill-down
```

Не создавать отдельную Analytics-specific трактовку `ALL`.

---

# 14. ANALYTICS DRILL-DOWN / TRACEABILITY

Sales channel должен переноситься через существующий Metric Drill-down / Source Traceability contract.

Пример:

```text
Analytics
Orders = 80
scope = STOREFRONT
period = Month
        ↓ click
Orders Center
channel = STOREFRONT
same period
        ↓
total = 80
```

Аналогично:

```text
Bookings
Payments
Customers
Partners
```

где metric semantics допускает channel filtering.

Не терять:

```text
period
comparison-relevant context
currency
status scope
partner/customer filters
```

---

# 15. ORDERS CENTER

Добавить shared channel selector/filter.

Для registry:

```text
ALL
→ 1516 current full-dataset total
   при эквивалентных остальных filters

MARKETPLACE
→ 1073

STOREFRONT
→ 400
```

Эти числа — audit dataset reference, не hardcoded acceptance values после dataset mutations.

Важно:

```text
ALL includes 43 NULL
```

## UI discoverability

Если Orders registry смешивает каналы, пользователь должен понимать source записи.

Предпочтительно добавить/reuse:

```text
Канал
```

как column/badge **если это соответствует существующей table density**.

Если column создаёт чрезмерную плотность, source должен быть доступен минимум в Order Detail.

Не выдумывать source для NULL:

```text
Не определено
```

или canonical localized equivalent.

---

# 16. BOOKING CENTER

Применить тот же contract.

Audit reference:

```text
ALL         692
MARKETPLACE 403
STOREFRONT  276
UNKNOWN      13
```

Не менять Booking KPI semantics в этой задаче.

Channel filter должен фильтровать canonical Booking population, но:

```text
Ждут поставщика
Подтверждено
Завершено
...
```

не перепроектировать.

Отдельный Booking KPI Semantics этап остаётся отдельным.

---

# 17. PAYMENTS

Применить shared channel scope к Payments registry и применимым Financial Summary metrics.

Не путать:

```text
sales channel
payment status
currency
```

Для CAPTURED audit reference:

```text
ALL         758
MARKETPLACE 447
STOREFRONT  292
UNKNOWN      19
```

Channel filter должен комбинироваться с:

```text
status=CAPTURED
currency=AZN/EUR/USD
period
sorting
pagination
```

Не менять Payment Method semantics.

Не менять currency presentation в этой задаче.

---

# 18. CRM / CUSTOMERS

Channel scope для customers требует distinct-ID semantics.

Если customer совершал операции в обоих каналах:

```text
MARKETPLACE customer set
∩
STOREFRONT customer set
≠ ∅
```

то:

```text
ALL unique customers
```

не должен считаться простым сложением двух counts.

Правильно:

```text
ALL
= DISTINCT customer IDs across all applicable sources
```

```text
MARKETPLACE
= DISTINCT customers with Marketplace activity
```

```text
STOREFRONT
= DISTINCT customers with Storefront activity
```

Не дублировать CRM records.

---

# 19. PARTNER PERFORMANCE

Channel scope должен работать согласованно с Partner Performance.

Для selected partner:

```text
ALL
MARKETPLACE
STOREFRONT
```

должны фильтровать применимые commercial metrics.

Особенно проверить:

```text
Orders
Bookings
GMV
Payments
Refunds
Commission
```

Но partner identity / entitlement / status сами по себе не становятся channel-filtered commercial metrics.

---

# 20. PARTNER 360

Если переход из Partner Performance в Partner 360 переносит analytics context, передать channel scope там, где он применим.

Не превращать весь Partner 360 в скрытый Storefront/Marketplace tenant switch.

Channel — контекст коммерческих данных, а не identity партнёра.

---

# 21. UNKNOWN RECORDS — UI CONTRACT

Для records с:

```text
acquisitionSource = NULL
```

в ALL registry/detail не показывать:

```text
Marketplace
```

или:

```text
Storefront
```

по догадке.

Показывать canonical localized representation:

```text
RU: Не определено
AZ: ...
EN: Unknown / Not specified
```

в зависимости от существующего dictionary style.

Не пытаться backfill legacy records без отдельного evidence/remediation.

---

# 22. NO SILENT DATA LOSS

Обязательный invariant:

```text
ALL population before remediation
=
ALL population after remediation
```

при одинаковых остальных filters.

Добавление selector не должно уменьшить default Platform totals.

Особенно проверить NULL/UNKNOWN.

---

# 23. PAGINATION / SORTING / AGGREGATES

Для registries:

```text
channel filter
→ applied server-side
→ before pagination
```

И:

```text
channel filter
→ before aggregate summary calculation
```

Sorting выполняется внутри filtered population.

Нельзя:

```text
fetch page 1 ALL
→ client filter STOREFRONT
```

---

# 24. SHARED FILTER UX

На surfaces с period selector рекомендуемая логика control row:

```text
[ Период ▼ ] [ Канал: Все каналы ▼ ] [ Сравнение ] [...]
```

Не обязательно буквально соблюдать порядок, если текущий responsive design требует иначе.

Требования:

- consistent naming;
- consistent options;
- same iconography/style;
- responsive;
- no duplicate custom implementations.

---

# 25. I18N

Проверить RU/AZ/EN.

Минимальные keys:

```text
salesChannel.label
salesChannel.all
salesChannel.marketplace
salesChannel.storefront
salesChannel.unknown
```

или существующая canonical namespace convention.

Также scope-aware Command Center subtitle.

0 raw keys.

Не hardcode labels внутри каждой страницы.

---

# 26. ACCESSIBILITY

Shared selector:

```text
keyboard accessible
visible focus
proper label
screen-reader name
selected value announced
```

Если native `<select>` соответствует design system — допустимо reuse.

Не создавать custom dropdown без необходимости.

---

# 27. SECURITY

Проверить:

```text
PLATFORM workspace permissions
        ↓
allowed dataset
        ↓
channel predicate
```

Channel selector не расширяет доступ.

Особенно:

```text
STOREFRONT
```

не должен обходить partner/tenant/server-side scope.

Нельзя доверять client-provided channel как authorization source.

---

# 28. API CONTRACT

Если backend уже принимает:

```text
acquisitionSource
```

reuse.

Не вводить:

```text
channel
salesChannel
source
```

как ещё три конкурирующих API params.

Если frontend URL использует presentation param `channel`, должен существовать один explicit mapper:

```text
UI channel
→ API acquisitionSource
```

а не ad hoc mapping по страницам.

---

# 29. BACKWARD COMPATIBILITY

Существующие URL без channel param:

```text
→ ALL
```

Существующие integrations/API clients без acquisitionSource:

```text
→ previous ALL semantics
```

Не делать breaking default.

---

# 30. RUNTIME RECONCILIATION MATRIX — MANDATORY

После implementation создать runtime matrix минимум:

| Surface | Metric/Dataset | ALL | MARKETPLACE | STOREFRONT | UNKNOWN included in ALL | Result |
|---|---|---:|---:|---:|---|---|

Обязательные surfaces:

```text
Command Center
Analytics
Orders
Bookings
Payments
CRM Customers
Partner Performance
```

Для monetary metrics — currency-aware evidence.

---

# 31. ID-LEVEL TRACEABILITY

Для representative records доказать:

```text
Marketplace Order
→ appears in ALL
→ appears in MARKETPLACE
→ does not appear in STOREFRONT
```

```text
Storefront Order
→ appears in ALL
→ appears in STOREFRONT
→ does not appear in MARKETPLACE
```

```text
NULL Order
→ appears in ALL
→ does not appear in MARKETPLACE
→ does not appear in STOREFRONT
```

Аналогично минимум для Booking и Payment.

---

# 32. CROSS-SURFACE SOURCE TRACEABILITY

Для одинаковой metric semantics:

```text
Command Center Orders
        ↓
Orders Center
```

```text
Analytics Orders
        ↓
Orders Center
```

```text
Command Center Bookings
        ↓
Booking Center
```

```text
Analytics Payments
        ↓
Payments
```

должны reconcile при:

```text
same channel
same period
same status
same currency
```

---

# 33. BROWSER RUNTIME EVIDENCE — MANDATORY

Проверить минимум:

## Command Center

```text
ALL
MARKETPLACE
STOREFRONT
```

- selector changes data;
- subtitle changes;
- period remains;
- comparison uses same channel;
- refresh preserves/reconstructs URL scope.

## Analytics

```text
ALL
MARKETPLACE
STOREFRONT
```

- KPIs change where applicable;
- channel scope visible;
- drill-down preserves scope.

## Orders

- ALL;
- MARKETPLACE;
- STOREFRONT;
- representative NULL only in ALL;
- pagination totals correct.

## Bookings

То же.

## Payments

- channel + CAPTURED;
- channel + currency;
- pagination/sorting still work.

## CRM

- distinct customers;
- no duplicate count from dual-channel customer.

## Partner Performance

- channel changes applicable commercial metrics;
- fixed/non-applicable metrics behave explicitly.

Проверить RU/AZ/EN.

---

# 34. AUTOMATED TESTS — MANDATORY

Добавить targeted tests минимум:

```text
ALL maps to no acquisitionSource predicate
MARKETPLACE maps correctly
STOREFRONT maps correctly
NULL included in ALL
NULL excluded from MARKETPLACE
NULL excluded from STOREFRONT

default URL/no param = ALL
invalid param = safe canonical fallback

period + channel composition
status + channel composition
currency + channel composition
pagination after channel filtering

distinct customer semantics

marketplace-only metric applicability
non-applicable metric behavior

Command Center subtitle ALL/MARKETPLACE/STOREFRONT

drill-down preserves channel
RBAC/security scope not widened
```

Запустить:

```text
frontend typecheck
frontend tests
frontend build

relevant backend unit/integration tests
relevant E2E tests
```

---

# 35. DO NOT CONFUSE WITH CURRENCY PRESENTATION

На runtime уже обнаружено отдельное presentation inconsistency:

```text
Command Center → ₼
Analytics      → AZN
```

**Не исправлять это в данной задаче.**

Это следующий отдельный:

```text
GLOBAL CURRENCY PRESENTATION CONTRACT
```

Причина разделения:

```text
Sales Channel remediation
→ меняет data scope/query semantics

Currency Presentation remediation
→ меняет presentation formatting only
```

Не смешивать два acceptance contracts.

---

# 36. OUT OF SCOPE — HARD STOP

Не выполнять:

- Global Currency Presentation remediation;
- FX conversion;
- Treasury;
- Partner Settlement;
- Finance Center;
- Booking KPI Semantics remediation;
- public marketplace redesign;
- new Storefront business model;
- backfill `acquisitionSource`;
- UNKNOWN user filter;
- unrelated Analytics redesign;
- Step 3.12;
- next roadmap stage.

---

# 37. HARD ACCEPTANCE GATES

`VERDICT A` разрешён только если:

```text
A. Shared Sales Channel Scope Contract реализован
B. default Platform scope = ALL
C. ALL включает NULL/UNKNOWN
D. MARKETPLACE исключает STOREFRONT + NULL
E. STOREFRONT исключает MARKETPLACE + NULL
F. canonical acquisitionSource reused
G. нет duplicate persistent salesChannel model
H. shared selector reused
I. server-side filtering доказан
J. Command Center scope-aware
K. misleading Marketplace subtitle устранён
L. Analytics scope-aware
M. Orders scope-aware
N. Bookings scope-aware
O. Payments scope-aware
P. CRM customer distinct semantics корректны
Q. Partner Performance applicability корректна
R. marketplace-specific metrics не искажены
S. channel preserved in drill-down where applicable
T. period/comparison composition корректна
U. pagination/aggregates server-correct
V. RBAC/tenant scope не ослаблен
W. RU/AZ/EN PASS
X. browser runtime evidence PASS
Y. automated tests/typecheck/build PASS
Z. default ALL totals не потеряли legacy NULL records
```

Если любой обязательный gate не доказан:

```text
VERDICT B
```

Нельзя выдавать `VERDICT A` только по source/tests без runtime evidence.

---

# 38. FINAL REPORT FORMAT

Отчёт преимущественно на русском:

```text
# SHARED SALES CHANNEL SCOPE CONTRACT + PLATFORM CENTERS FILTERING

Starting SHA:
Implementation SHA:
Final HEAD:
origin/master:
HEAD == origin:

## 1. Architecture
Canonical source:
Shared UI contract:
Shared query mapper:
Default scope:
NULL/UNKNOWN semantics:

## 2. Command Center
ALL:
MARKETPLACE:
STOREFRONT:
Subtitle:
Comparison:
Result:

## 3. Analytics
...

## 4. Orders
...

## 5. Bookings
...

## 6. Payments
...

## 7. CRM Customers
Distinct semantics:
...

## 8. Partner Performance
Applicability matrix:
...

## 9. Drill-down / Traceability
...

## 10. Security / RBAC
...

## 11. I18N
RU:
AZ:
EN:

## 12. Runtime Reconciliation Matrix
...

## 13. ID-level Evidence
...

## 14. Tests
Frontend:
Backend:
E2E:
Build:

## 15. Residual Gaps
...

## VERDICT
VERDICT A / VERDICT B
```

---

# 39. ROADMAP / HISTORY

Если canonical roadmap требует фиксации remediation:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

обновлять **additive only**:

- не переписывать историю;
- не менять старые verdict;
- указать реальные SHA;
- не перенумеровывать существующие stages;
- NEXT stage не начинать.

---

# 40. COMPLETION

После implementation:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
```

Указать реальные SHA.

Остановиться.

Не начинать автоматически:

```text
Global Currency Presentation Contract
Booking KPI Semantics
Final Strict Re-Qualification
Step 3.12
```

Следующий этап — только отдельным prompt после review результата этой remediation.
