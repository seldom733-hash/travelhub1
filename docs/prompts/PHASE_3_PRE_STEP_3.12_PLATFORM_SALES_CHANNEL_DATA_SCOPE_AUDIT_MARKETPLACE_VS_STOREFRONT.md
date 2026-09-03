# PHASE 3 — PRE-STEP 3.12 — PLATFORM SALES CHANNEL DATA SCOPE AUDIT — MARKETPLACE vs STOREFRONT

## ТИП ЗАДАЧИ

**STRICT EVIDENCE AUDIT ONLY.**

На этом этапе:

```text
НЕ ИСПРАВЛЯТЬ
НЕ ПЕРЕИМЕНОВЫВАТЬ
НЕ ДОБАВЛЯТЬ FILTER
НЕ МЕНЯТЬ KPI FORMULAS
НЕ МИГРИРОВАТЬ DATA MODEL
```

Сначала необходимо доказать, какие данные TravelHub фактически относит к:

```text
MARKETPLACE
STOREFRONT
ALL / PLATFORM
```

и одинаково ли эта семантика применяется в разных центрах системы.

---

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация должны быть преимущественно **на русском языке**:

- Audit Report;
- Evidence Report;
- findings;
- root cause analysis;
- source semantics;
- architecture conclusions;
- security findings;
- recommendations;
- verdict explanations.

Английский допустим только для технических идентификаторов:

- paths;
- class/method/DTO/model/table names;
- endpoints;
- HTTP methods/status codes;
- SQL;
- CLI/Git commands;
- enums;
- permission identifiers;
- code snippets;
- standardized `VERDICT`.

Если итоговый отчёт преимущественно английский — audit считается незавершённым.

---

# 0. STARTING POINT

Последний заявленный синхронизированный SHA:

```text
688a8bb
```

Перед audit:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
```

Если фактический HEAD отличается — использовать фактический HEAD как Audit Starting SHA.

Audit не должен вносить product fixes.

Допустим отдельный commit только для evidence/report documentation, если это соответствует существующему workflow проекта.

---

# 1. BUSINESS QUESTION

Platform Workspace имеет как минимум два коммерческих канала:

```text
TRAVELHUB PLATFORM
│
├── MARKETPLACE
│   └── продажи через общий TravelHub Marketplace
│
└── STOREFRONT
    └── продажи через storefront партнёра
```

Необходимо доказать, учитываются ли оба канала в:

```text
Command Center
Analytics
Orders
Bookings
Payments
CRM / Customers
Partner Performance
```

и соответствует ли фактическим данным надпись Command Center:

```text
Агрегированные данные Marketplace · UTC
```

---

# 2. НЕ ДЕЛАТЬ ПРЕДПОЛОЖЕНИЕ, ЧТО PLATFORM = MARKETPLACE

Запрещено исходить из предположения:

```text
Platform Workspace
=
Marketplace data only
```

или обратного:

```text
Platform Workspace
=
Marketplace + Storefront
```

Оба варианта должны быть доказаны source/runtime evidence.

Также запрещено считать Storefront просто другим UI над теми же Marketplace orders без проверки domain model.

---

# 3. CANONICAL SALES CHANNEL SOURCE AUDIT

Первый обязательный вопрос:

> **Как система канонически определяет происхождение коммерческой операции?**

Проверить schema/entities/models/migrations/services.

Искать реальные canonical concepts, например:

```text
salesChannel
channel
source
origin
orderSource
bookingSource
storefrontId
marketplaceId
tenant/storefront relation
checkout source
cart source
product/listing source
```

Названия выше — только search hints.

Не создавать новое поле.

## Нужно доказать

Есть ли explicit immutable/semantically stable discriminator:

```text
MARKETPLACE
STOREFRONT
```

Если есть:

```text
entity/table:
field:
enum:
creation path:
who sets it:
when it is set:
can it change:
```

Если explicit discriminator отсутствует, определить, как канал сейчас выводится:

```text
storefrontId != null?
route/source metadata?
listing relation?
partner relation?
order metadata?
другая связь?
вообще никак?
```

---

# 4. HISTORICAL STABILITY

Канал продажи должен быть воспроизводим исторически.

Audit должен ответить:

```text
Order created through STOREFRONT
↓
partner later disables storefront
↓
does historical Order remain STOREFRONT?
```

Проверить, не вычисляется ли канал динамически из **текущего** состояния партнёра/Storefront entitlement.

Если историческое происхождение операции может измениться задним числом — зафиксировать finding.

---

# 5. COMMERCIAL ENTITY CHAIN

Проследить канал по цепочке:

```text
Listing / Product
        ↓
Order
        ↓
Booking
        ↓
Payment
        ↓
Refund
        ↓
Commission
```

Для каждой сущности определить:

```text
имеет собственный channel?
наследует channel?
выводится через relation?
channel отсутствует?
```

Проверить, возможно ли получить противоречие:

```text
Order = STOREFRONT
Booking = MARKETPLACE
Payment = unknown
```

и какие constraints предотвращают это.

---

# 6. DATASET INVENTORY — MANDATORY

На representative/current dataset определить фактические counts минимум:

```text
Orders:
ALL
MARKETPLACE
STOREFRONT
UNKNOWN / UNCLASSIFIED

Bookings:
ALL
MARKETPLACE
STOREFRONT
UNKNOWN / UNCLASSIFIED

Payments:
ALL
MARKETPLACE
STOREFRONT
UNKNOWN / UNCLASSIFIED
```

По возможности аналогично:

```text
Refunds
Commissions
Customers participating in commercial activity
```

Hard gate:

```text
ALL = MARKETPLACE + STOREFRONT + UNKNOWN
```

если populations mutually exclusive.

Если не могут быть mutually exclusive — объяснить точную модель.

Не скрывать `UNKNOWN=0/nonzero`.

---

# 7. COMMAND CENTER AUDIT

Проверить каждый фактически существующий KPI/section Command Center.

Минимально, если присутствуют:

```text
GMV
Customer Payments / Payments
Open / Outstanding amount
Fulfilled / Completed GMV
Orders
Bookings
AOV
Conversion
Refunds
Commission / Revenue
Customers
Partners
```

Для каждого построить:

| Metric | Formula/source | MARKETPLACE | STOREFRONT | ALL | Current runtime scope |
|---|---|---:|---:|---:|---|

Не писать просто `BOTH`.

Нужно доказать:

```text
SQL/query/service path
filters
joins
date field
status population
channel condition or absence thereof
```

---

# 8. COMMAND CENTER SUBTITLE — STRICT AUDIT

Текущий runtime subtitle:

```text
Агрегированные данные Marketplace · UTC
```

Определить один из результатов:

### CASE A

Все relevant Command Center metrics действительно Marketplace-only:

```text
subtitle semantically TRUE
```

### CASE B

Command Center metrics агрегируют Marketplace + Storefront:

```text
subtitle semantically FALSE / STALE
```

### CASE C

Часть metrics Marketplace-only, часть ALL:

```text
subtitle semantically MISLEADING
page has mixed scope
```

### CASE D

Channel provenance невозможно доказать:

```text
subtitle UNPROVEN
```

На audit-этапе **не менять subtitle**.

---

# 9. ANALYTICS AUDIT

Проверить Platform Analytics:

```text
headline KPIs
time series
Financial Summary
Partner Performance
activity/stage metrics
customers
partners
refunds
commission
```

Для каждого определить channel scope.

Особенно проверить ранее согласованные metrics:

```text
GMV (выполненные)
Успешные платежи
Заказы
Бронирования
Активные клиенты
Активные партнёры (marketplace)
```

Последний metric уже явно может иметь marketplace-specific semantics — не распространять его scope автоматически на всю Analytics.

---

# 10. ORDERS CENTER

Проверить canonical Orders registry.

Ответить:

```text
Does Orders Center contain:
MARKETPLACE only?
STOREFRONT only?
ALL?
```

Есть ли:

```text
channel column?
channel filter?
source metadata?
```

Если UI не показывает channel, но backend содержит оба — зафиксировать discoverability gap.

Проверить full filtered totals и representative IDs.

---

# 11. BOOKING CENTER

Аналогично Orders:

```text
MARKETPLACE
STOREFRONT
ALL
UNKNOWN
```

Проверить связь Booking → Order/Product/Partner и источник channel semantics.

Не смешивать этот audit с отдельной будущей Booking KPI Semantics remediation.

---

# 12. PAYMENTS

Проверить Payments registry и Financial Summary.

Важно различать:

```text
payment status scope
currency scope
sales channel scope
```

`CAPTURED` не является channel.

Для successful payments определить:

```text
MARKETPLACE captured
STOREFRONT captured
ALL captured
```

Проверить, соответствует ли Financial Summary одному из этих scopes.

---

# 13. CRM / CUSTOMERS

Проверить, что означает Platform CRM customer population относительно channel.

Возможные варианты, которые нужно доказать, а не выбрать заранее:

```text
all CRM entities
customers with MARKETPLACE commercial activity
customers with STOREFRONT commercial activity
customers with any platform commercial activity
```

Если один Customer использовал оба канала:

```text
MARKETPLACE + STOREFRONT
```

не допустить двойного count в `ALL unique customers`.

Нужна explicit distinct-ID reconciliation.

---

# 14. PARTNER PERFORMANCE

Проверить channel semantics Partner Performance.

Для representative partner, предпочтительно имеющего оба канала, если dataset содержит такого партнёра, доказать:

```text
Orders Marketplace
Orders Storefront
Orders ALL

Bookings Marketplace
Bookings Storefront
Bookings ALL

GMV Marketplace
GMV Storefront
GMV ALL

Payments Marketplace
Payments Storefront
Payments ALL

Commission Marketplace
Commission Storefront
Commission ALL
```

Если Storefront activity отсутствует в dataset — не делать вид, что BOTH доказан. Зафиксировать dataset limitation.

---

# 15. STOREfront DATA EXISTENCE GATE

Критически важно доказать, что в текущем dataset вообще есть реальные Storefront commercial transactions.

Нужно получить:

```text
Storefront partners count
active storefronts count

Storefront Orders count
Storefront Bookings count
Storefront Payments count
```

Если:

```text
Storefront Orders = 0
```

то совпадение:

```text
Marketplace total == Platform total
```

**НЕ доказывает**, что queries архитектурно поддерживают оба канала.

В этом случае анализировать query semantics/source code отдельно.

---

# 16. NO FALSE PROOF FROM EQUAL NUMBERS

Запрещено заключение:

```text
Command Center Orders = Orders Center Orders
→ therefore both include Storefront
```

если Storefront population равна 0.

Необходимо доказать либо:

```text
explicit ALL-channel query
```

либо representative data с ненулевыми обеими populations.

---

# 17. PERIOD / TIMEZONE

Channel audit не должен разрушать period semantics.

Для сравниваемых metrics использовать один и тот же:

```text
from
to
timezone
status scope
currency scope
```

Зафиксировать фактическую timezone semantics.

Текущая надпись содержит:

```text
UTC
```

Проверить, действительно ли aggregation boundaries рассчитываются в UTC.

Если нет — отдельный finding.

Не исправлять timezone в этом audit.

---

# 18. CURRENCY WARNING

Не смешивать channel audit с FX remediation.

Для monetary comparisons:

```text
AZN
USD
EUR
```

держать native currencies раздельно, если нет доказанного canonical reporting conversion.

Если текущий единый GMV уже смешивает currencies — зафиксировать это как существующий отдельный FX gap, но **не исправлять**.

---

# 19. CHANNEL FILTER CAPABILITY AUDIT

Проверить, существует ли уже backend/API capability:

```text
channel=MARKETPLACE
channel=STOREFRONT
channel=ALL
```

или эквивалент.

Для каждого relevant endpoint:

| Endpoint | MARKETPLACE filter | STOREFRONT filter | ALL | Notes |
|---|---|---|---|---|

Если filter отсутствует — зафиксировать.

Не добавлять его в рамках audit.

---

# 20. SECURITY / TENANT SCOPE

Channel не должен обходить security boundaries.

Проверить концептуально и кодом:

```text
workspace
→ tenant/partner scope
→ entitlement
→ permissions
→ channel filter
```

Нельзя:

```text
?channel=STOREFRONT
```

использовать для получения данных чужого storefront/partner.

Если channel filters уже существуют — проверить server-authoritative scoping.

---

# 21. EXPECTED TARGET SEMANTICS — НЕ РЕШЕНИЕ AUDIT

Для ориентира, но НЕ как заранее принятый результат:

Platform-level business metrics потенциально могут иметь:

```text
ALL
= MARKETPLACE + STOREFRONT
```

а marketplace-specific metrics могут оставаться:

```text
MARKETPLACE
```

Например:

```text
Активные партнёры (marketplace)
```

может намеренно быть marketplace-specific.

Audit должен выявить это metric-by-metric.

Не заставлять все показатели иметь одинаковый scope, если бизнес-семантика требует различий.

---

# 22. REQUIRED MASTER MATRIX

В отчёте обязательна единая таблица:

| Surface | Metric/Dataset | Actual Formula | Channel Source | MARKETPLACE | STOREFRONT | ALL | Runtime Current Scope | Verdict |
|---|---|---|---|---:|---:|---:|---|---|

Минимальные surfaces:

```text
Command Center
Analytics
Orders
Bookings
Payments
CRM Customers
Partner Performance
```

Для monetary metrics указывать currency.

---

# 23. ID-LEVEL EVIDENCE

Для каждой ненулевой channel population привести representative IDs.

Например:

```text
MARKETPLACE Order:
ID:
channel evidence:

STOREFRONT Order:
ID:
channel evidence:

MARKETPLACE Booking:
...

STOREFRONT Booking:
...
```

Не ограничиваться агрегатами.

Если Storefront records отсутствуют — явно написать:

```text
NO REPRESENTATIVE STOREFRONT RECORD IN CURRENT DATASET
```

---

# 24. CROSS-SURFACE RECONCILIATION

Для одинаковой бизнес-семантики сравнить:

```text
Command Center Orders
Analytics Orders
Orders Center
```

и:

```text
Command Center Bookings
Analytics Bookings
Booking Center
```

и:

```text
Analytics Successful Payments
Financial Summary
Payments Registry
```

Но reconciliation выполнять **по каждому channel scope отдельно**, где это технически возможно:

```text
MARKETPLACE
STOREFRONT
ALL
```

---

# 25. FINDINGS CLASSIFICATION

Каждый finding классифицировать:

```text
P0 — data/security corruption or severe business misstatement
P1 — material semantic inconsistency / misleading KPI scope
P2 — UX/discoverability/labeling gap
INFO — proven architecture fact / limitation
```

Примеры возможных, но не предопределённых findings:

```text
mixed scopes under one Command Center subtitle
no immutable sales-channel provenance
Storefront transactions excluded from Platform KPI
channel cannot be filtered
UI hides channel on mixed registry
```

---

# 26. REQUIRED DECISION OUTPUT

Audit должен завершиться одним из архитектурных выводов.

## OPTION 1 — MARKETPLACE-ONLY COMMAND CENTER IS INTENTIONAL

Доказать почему Platform Command Center должен оставаться Marketplace-only.

Тогда:

```text
"Агрегированные данные Marketplace · UTC"
```

может быть корректно.

## OPTION 2 — PLATFORM ALL-CHANNEL DEFAULT

Рекомендовать:

```text
default scope = ALL
MARKETPLACE + STOREFRONT
```

и subtitle типа:

```text
Агрегированные данные платформы · UTC
```

## OPTION 3 — CHANNEL SELECTOR REQUIRED

Рекомендовать единый shared scope:

```text
Все каналы
Marketplace
Storefront
```

с default, который должен быть обоснован.

## OPTION 4 — BLOCKED BY DOMAIN MODEL

Если channel provenance отсутствует/ненадёжен, сначала требуется Data Model / Sales Channel Architecture remediation.

---

# 27. НЕ ПРОЕКТИРОВАТЬ STOREfront ПО ПАМЯТИ

Использовать фактический repo и runtime.

Не считать наличие:

```text
PartnerStorefront
Storefront Pro
```

доказательством того, что реальные Orders/Bookings/Payments уже несут Storefront channel provenance.

Entitlement и sales channel — разные понятия:

```text
Storefront entitlement ≠ Storefront transaction
```

---

# 28. TEST / QUERY EVIDENCE

Audit может использовать:

```text
SQL
API calls
existing tests
targeted read-only scripts
browser/network inspection
```

Не менять production semantics.

Если создаются временные audit scripts — удалить их до финального commit либо явно оформить как project evidence tooling согласно существующему стандарту.

---

# 29. BROWSER EVIDENCE

Минимально проверить runtime:

```text
1. Command Center subtitle
2. Command Center key metrics
3. Analytics key metrics
4. Orders Center total
5. Booking Center total
6. Payments successful population
7. CRM customer population
8. Partner Performance representative row
```

Если UI не позволяет channel filtering, это само по себе часть audit result.

---

# 30. HARD AUDIT GATES

Audit может получить `VERDICT A — AUDIT COMPLETE` только если:

```text
A. canonical channel source найден или доказано его отсутствие
B. historical stability проверена
C. Storefront transaction population посчитана
D. Marketplace transaction population посчитана
E. UNKNOWN population посчитана
F. Order/Booking/Payment chain проверена
G. Command Center metric-by-metric scope доказан
H. Analytics metric-by-metric scope доказан
I. Orders scope доказан
J. Bookings scope доказан
K. Payments scope доказан
L. CRM Customers scope доказан
M. Partner Performance scope доказан
N. Command Center subtitle классифицирован TRUE/FALSE/MISLEADING/UNPROVEN
O. UTC claim проверен
P. cross-surface inconsistencies перечислены
Q. ID-level evidence предоставлен
R. recommended next remediation определён
```

`VERDICT A — AUDIT COMPLETE` **не означает**, что data scope implementation правильный.

Если найдены дефекты, audit всё равно может быть complete, но следующий implementation/remediation должен быть явно указан.

---

# 31. OUT OF SCOPE — HARD STOP

НЕ выполнять:

- исправление channel semantics;
- добавление channel selector;
- изменение subtitle;
- изменение KPI formulas;
- Storefront implementation;
- Finance Center;
- FX conversion;
- Treasury;
- Partner Settlement;
- Booking KPI remediation;
- redesign;
- Step 3.12;
- synthetic Storefront production data ради PASS.

---

# 32. FINAL REPORT FORMAT

Создать audit report преимущественно на русском языке.

```text
# PLATFORM SALES CHANNEL DATA SCOPE AUDIT
## MARKETPLACE vs STOREFRONT

Starting SHA:
Audit SHA:
Final HEAD:
origin/master:

## 1. Executive Summary
...

## 2. Canonical Sales Channel Source
Field/source:
Creation:
Historical stability:
UNKNOWN handling:

## 3. Dataset Inventory
Marketplace:
Storefront:
Unknown:

## 4. Commercial Entity Chain
Listing:
Order:
Booking:
Payment:
Refund:
Commission:

## 5. Command Center
Master metric matrix:
...

Subtitle:
TRUE / FALSE / MISLEADING / UNPROVEN

UTC:
PROVEN / NOT PROVEN

## 6. Analytics
...

## 7. Orders
...

## 8. Bookings
...

## 9. Payments
...

## 10. CRM Customers
...

## 11. Partner Performance
...

## 12. Cross-Surface Reconciliation
...

## 13. Security / Scope
...

## 14. Findings
P0:
P1:
P2:
INFO:

## 15. Required Architecture Decision
OPTION 1 / OPTION 2 / OPTION 3 / OPTION 4

Rationale:
...

## 16. Recommended Next Remediation
...

## VERDICT
VERDICT A — AUDIT COMPLETE
или
VERDICT B — AUDIT INCOMPLETE
```

---

# 33. COMPLETION

После audit:

```bash
git status
git rev-parse HEAD
git rev-parse origin/master
```

Не начинать remediation автоматически.

Остановиться после отчёта.

Следующее изменение должно быть отдельным implementation/remediation prompt на основании доказанного audit result.
