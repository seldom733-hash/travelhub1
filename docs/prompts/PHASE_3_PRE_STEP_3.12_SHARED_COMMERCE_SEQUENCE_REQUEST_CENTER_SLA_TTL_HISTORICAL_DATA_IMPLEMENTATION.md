# PHASE 3 — PRE-STEP 3.12 — SHARED COMMERCE SEQUENCE + REQUEST CENTER + HISTORICAL REQUEST DATA — IMPLEMENTATION

## LANGUAGE REQUIREMENT — MANDATORY

Все создаваемые/обновляемые отчёты и prose-документация по этой задаче должны быть преимущественно **на русском языке**.

Это относится к:
- Implementation Report;
- Remediation Report;
- Strict Review Report;
- Evidence / Runtime Report;
- findings explanations;
- root cause analysis;
- architecture decisions;
- migration/backfill decisions;
- historical-data generation methodology;
- security findings;
- conclusions/recommendations;
- verdict explanations.

Английский допускается только для технических identifiers:
- file paths;
- class/method/DTO/model/table names;
- API endpoints;
- HTTP methods/status codes;
- CLI/Git commands;
- commit messages;
- enums;
- permission identifiers;
- code snippets;
- standardized VERDICT strings.

**Hard acceptance criterion:** если итоговый отчёт преимущественно на английском языке, задача считается незавершённой.

Не включать plaintext passwords/secrets/tokens. Использовать redaction/placeholders.

---

# 1. PURPOSE

Реализовать единый **Shared Commerce Sequence Contract** для Marketplace-коммерческой цепочки, исправить текущие коды Booking/Payment, реализовать полноценный **Центр заявок** как новый раздел левого меню и сформировать реалистичные historical Request data для существующей representative базы.

Текущий runtime finding:

```text
Order    → MKT-ORD-*   ✅
Booking  → BKG-*       ❌
Payment  → PAY-*       ❌
```

Новый canonical contract:

```text
Shared Commerce Sequence:
00000001

Request:
MKT-REQ-00000001

Order:
MKT-ORD-00000001

Booking:
MKT-BKG-00000001

Payment:
MKT-PAY-00000001-1
MKT-PAY-00000001-2
...
```

Все entity references одной коммерческой цепочки используют **одну и ту же 8-значную root sequence**.

---

# 2. HARD ARCHITECTURAL PRINCIPLE

Номер Request не является техническим master-source.

Вводится единая domain-концепция:

```text
commerceSequence
```

или эквивалентная authoritative abstraction.

Пример:

```text
commerceSequence = 00000001

MKT-REQ-00000001
MKT-ORD-00000001
MKT-BKG-00000001
MKT-PAY-00000001-1
MKT-PAY-00000001-2
```

Это позволяет поддерживать два валидных flow.

### Request-based

```text
Product
→ Request
→ confirmation
→ Order
→ Booking
→ Payment
```

### Instant / no-Request

```text
Product
→ authoritative real-time validation
→ Order
→ Booking
→ Payment
```

Пример без Request:

```text
commerceSequence = 00000025

Request  → отсутствует
Order    → MKT-ORD-00000025
Booking  → MKT-BKG-00000025
Payment  → MKT-PAY-00000025-1
```

---

# 3. REFERENCE FORMAT — CANONICAL

Root sequence:

```text
8 digits
00000001
...
99999999
```

Leading zeros обязательны.

Marketplace:

```text
Request:
MKT-REQ-{commerceSequence:8}

Order:
MKT-ORD-{commerceSequence:8}

Booking:
MKT-BKG-{commerceSequence:8}

Payment:
MKT-PAY-{commerceSequence:8}-{paymentOrdinal}
```

Пример:

```text
MKT-REQ-00001247
MKT-ORD-00001247
MKT-BKG-00001247
MKT-PAY-00001247-1
MKT-PAY-00001247-2
```

---

# 4. SEQUENCE SEMANTICS

`commerceSequence` принадлежит **коммерческому кейсу**, а не отдельной таблице.

Поэтому gaps являются ожидаемыми.

```text
00000001
├ MKT-REQ-00000001
├ MKT-ORD-00000001
├ MKT-BKG-00000001
└ MKT-PAY-00000001-1

00000002
└ MKT-REQ-00000002 → REJECTED

00000003
└ MKT-REQ-00000003 → UNAVAILABLE

00000004
└ MKT-REQ-00000004 → EXPIRED

00000005
├ MKT-REQ-00000005
├ MKT-ORD-00000005
├ MKT-BKG-00000005
└ MKT-PAY-00000005-1
```

Booking registry может законно содержать:

```text
MKT-BKG-00000001
MKT-BKG-00000005
MKT-BKG-00000008
MKT-BKG-00000012
```

Это **не sequence defect**.

---

# 5. RELATIONS — NEVER LINK BY STRING PARSING

Совпадающая root sequence служит human/business traceability, но не заменяет DB relations.

НЕЛЬЗЯ:

```text
replace("PAY", "ORD")
```

и использовать полученную строку как связь.

Использовать authoritative IDs/FKs:

```text
Request.id
Order.id
Booking.id
Payment.id
```

и фактические relations, например:

```text
Order.requestId
Booking.orderId
Payment.orderId
```

Дополнительные FK добавлять только при реальной domain-необходимости.

---

# 6. DATA MODEL AUDIT FIRST

До изменений найти фактические:
- models/entities/tables;
- `referenceNumber`;
- Order/Booking/Payment relations;
- Request entity, если уже существует;
- generators;
- counters/sequences;
- unique constraints;
- channel/workspace fields;
- current UI routes;
- existing navigation manifest;
- existing RBAC/permission infrastructure.

Если Request отсутствует — в этой задаче разрешено реализовать её как новую domain entity согласно описанному contract.

---

# 7. REQUEST DOMAIN — REQUIRED

Request — самостоятельный **pre-order validation object**.

Он нужен для проверки:

```text
availability
price
service date
quantity/quota
commercial terms
```

до возникновения окончательного Order.

Минимальный target snapshot:

```text
id
referenceNumber
commerceSequence

customerId
productId
partnerId

requestedServiceDate
quantity / participants

displayedPrice
displayedCurrency

confirmedPrice
confirmedCurrency

status

createdAt
updatedAt
confirmedAt
expiresAt

convertedOrderId / relation
```

Поля адаптировать к реальной модели и не дублировать уже существующие concepts.

---

# 8. REQUEST PRICE SNAPSHOT

Hard invariant:

```text
Request.displayedPrice
=
цена, которую клиент видел
в момент отправки заявки
```

Изменение Product после создания Request не должно задним числом менять Request snapshot.

Если цена изменилась:

```text
displayedPrice = 150
confirmedPrice = 165
```

Order на 165 может быть создан только после предусмотренного customer acceptance flow.

---

# 9. REQUEST LIFECYCLE

Не вводить произвольный enum без сверки с существующим domain model.

Целевой lifecycle:

```text
NEW
→ CHECKING
→ CONFIRMED
→ CONVERTED
```

Альтернативы:

```text
CHECKING → PRICE_CHANGED
PRICE_CHANGED → CUSTOMER_ACCEPTED → CONFIRMED → CONVERTED
PRICE_CHANGED → CUSTOMER_DECLINED

CHECKING → UNAVAILABLE
CHECKING → REJECTED
NEW/CHECKING → EXPIRED
NEW/CHECKING/PRICE_CHANGED → CANCELLED_BY_CUSTOMER
```

Если repo уже содержит статусную модель — reconciliation обязателен.

---

# 10. REQUEST → ORDER → BOOKING

Для confirmed Request:

```text
MKT-REQ-00000001
        ↓
MKT-ORD-00000001
        ↓
MKT-BKG-00000001
```

Одинаковая numeric root-part обязательна.

Если Request не конвертирована:

```text
MKT-REQ-00000002
→ REJECTED
```

то:

```text
MKT-ORD-00000002 отсутствует
MKT-BKG-00000002 отсутствует
```

---

# 11. BOOKING — MANDATORY RUNTIME FIX

Текущий runtime:

```text
BKG-*
```

Canonical:

```text
MKT-BKG-{commerceSequence:8}
```

Booking не получает собственный независимый counter, если она принадлежит существующему commerce case.

НЕЛЬЗЯ:

```text
nextBookingSequence()
```

для Booking, создаваемой из уже существующего Order/commerce case.

---

# 12. PAYMENT — MANDATORY RUNTIME FIX

Текущий runtime:

```text
PAY-*
```

Canonical:

```text
MKT-PAY-{commerceSequence:8}-{paymentOrdinal}
```

Пример:

```text
MKT-ORD-00000001
MKT-BKG-00000001

MKT-PAY-00000001-1
MKT-PAY-00000001-2
```

---

# 13. PAYMENT ORDINAL

`paymentOrdinal` означает отдельный **business payment**, а не gateway retry.

```text
MKT-PAY-00000001-1
Amount 50 AZN

attempt 1 → FAILED
attempt 2 → FAILED
attempt 3 → CAPTURED
```

Reference остаётся:

```text
MKT-PAY-00000001-1
```

Следующий отдельный partial/additional payment:

```text
MKT-PAY-00000001-2
```

---

# 14. CONCURRENCY / UNIQUENESS

Allocation:
- root commerceSequence;
- paymentOrdinal

должна быть atomic/concurrency-safe.

Запрещено naive:

```text
MAX()+1
COUNT()+1
```

без locking/sequence strategy.

Обеспечить соответствующие unique constraints.

---

# 15. FUTURE MULTI-BOOKING COMPATIBILITY

Текущий V1 может сохранять:

```text
1 Order = 1 Booking
```

Canonical V1:

```text
MKT-BKG-00000001
```

Но architecture не должна блокировать future:

```text
1 Order = N Bookings
```

и возможное extension:

```text
MKT-BKG-00000001-1
MKT-BKG-00000001-2
```

Не внедрять booking suffix сейчас без необходимости.

---

# 16. NEW LEFT MENU SECTION — REQUEST CENTER

Добавить новый top-level operational section в левое меню:

```text
Центр заявок
```

Он должен быть отдельным business center, а не вкладкой Booking Center.

Концептуальная последовательность:

```text
Продажи
Центр заявок
Заказы
Бронирования
...
```

Точное место в существующей navigation manifest определить с учётом фактической IA, но семантически Request Center должен находиться **до Orders/Bookings** как pre-order operational layer.

---

# 17. REQUEST CENTER ROUTE

Создать отдельный authoritative route, например:

```text
/app/requests
```

или соответствующий current routing contract.

Запрещено:
- redirect Request Center на Orders;
- переименовать Orders в Requests;
- использовать fake page без data source.

Direct URL, client navigation и refresh должны работать.

---

# 18. REQUEST CENTER PURPOSE

Центр заявок отвечает:

> Какие клиентские заявки требуют проверки доступности, цены или решения клиента/поставщика до создания заказа?

Он не должен дублировать Orders Center или Booking Center.

---

# 19. REQUEST CENTER UI

Минимальный реестр:

| Поле | Содержание |
|---|---|
| № заявки | `MKT-REQ-*` |
| Клиент | customer |
| Услуга | product/service |
| Дата услуги | requested service date |
| Цена витрины | displayed price |
| Подтверждённая цена | confirmed price |
| Валюта | currency |
| Поставщик | partner/supplier |
| Статус | Request status |
| Создана | createdAt |
| Действия | по RBAC/status |

Если конкретное поле отсутствует в authoritative data source — не фабриковать его.

---

# 20. REQUEST CENTER KPI

После утверждения фактического lifecycle минимум рассмотреть:

```text
Все заявки
Новые
На проверке
Ожидают клиента
Подтверждены
Недоступны / отклонены
Истекли
```

KPI formulas должны соответствовать реальным enum/status groups.

Не создавать KPI, которые нельзя доказать через source data.

---

# 21. REQUEST CENTER FILTERS / TABLE CONTRACT

Поддержать Shared Table Contract:
- server-side filtering;
- search;
- sorting;
- pagination;
- default 20 rows для full registry;
- export if table classified REGISTRY;
- total over full filtered population.

Минимальные filters по фактическим fields:
- status;
- period;
- partner;
- customer;
- product/service;
- currency where applicable.

---

# 22. REQUEST CENTER EXPORT

Если Request Center — полноценный registry, интегрировать Shared Table Export Framework.

```text
CSV
XLSX
```

Инвариант:

```text
filtered registry total
=
CSV rows
=
XLSX rows
```

Reference numbers должны совпадать с DB/API/UI.

---

# 23. REQUEST CENTER RBAC

Request Center должен использовать existing Workspace Shell / permission model.

Не создавать client-only protection.

Server-authoritative:
- page access;
- list access;
- detail access;
- actions;
- export.

Конкретные permissions вывести из текущей RBAC architecture.

Если нужен новый permission/capability — оформить явно и additively.

---

# 24. REQUEST CENTER WORKSPACE SCOPE

В первую очередь реализовать **Marketplace/Platform operational scope**, если это соответствует текущему этапу.

Не смешивать Storefront customer requests с Platform Marketplace population.

Если Request domain также нужен Partner Workspace — зафиксировать architecture, но не расширять scope без существующего entitlement/navigation contract.

---

# 25. HISTORICAL REQUEST DATA — MANDATORY

Representative историческая база должна содержать реалистичные Requests.

Нельзя просто сгенерировать случайные заявки с произвольными датами.

Historical Request data должны быть **согласованы с уже существующими Orders/Bookings/Payments**.

---

# 26. TEMPORAL CONSISTENCY — HARD INVARIANT

Если historical Booking уже существует, связанная Request **никогда не может быть создана после неё**.

Минимальный invariant:

```text
Request.createdAt <= Order.createdAt <= Booking.createdAt
```

если фактический lifecycle и timestamps позволяют именно такую последовательность.

И обязательно:

```text
Request.createdAt <= Booking.createdAt
```

Также для payment:

```text
Booking.createdAt <= Payment.createdAt
```

или более точный existing payment timestamp contract (`paidAt`) в зависимости от semantics.

Нельзя генерировать:

```text
Booking.createdAt = 2026-05-10
Request.createdAt = 2026-05-12
```

Это invalid historical data.

---

# 27. HISTORICAL REQUEST DERIVATION FROM EXISTING DATA

Для existing Marketplace commerce chains, где Request-based flow логически применим, historical Request должна строиться **от существующих source records**, а не независимо.

Пример:

```text
Existing:
Order.createdAt   = 2026-05-10 14:20
Booking.createdAt = 2026-05-10 14:25

Generated Request:
createdAt         = 2026-05-10 10:15
confirmedAt       = 2026-05-10 14:10
convertedAt       <= Order.createdAt
```

Не использовать один и тот же fixed offset для всех records, если это создаёт искусственный dataset.

Допустим controlled randomized lead time в разумных business bounds.

---

# 28. HISTORICAL DATE RULES

Для converted Request:

```text
Request.createdAt
<= Request.confirmedAt
<= Order.createdAt
<= Booking.createdAt
```

Если присутствует customer re-approval:

```text
Request.createdAt
<= priceChangedAt
<= customerAcceptedAt
<= confirmedAt
<= Order.createdAt
<= Booking.createdAt
```

Для Payment:

```text
Booking.createdAt
<= Payment.createdAt / paidAt
```

с учетом реальной модели.

Все timestamps должны быть timezone-consistent.

---

# 29. SERVICE DATE CONSISTENCY

Если Booking содержит дату оказания услуги:

```text
Request.requestedServiceDate
```

должна соответствовать или логически предшествовать/отражать Booking service date согласно фактической модели.

Нельзя создать Request на дату услуги, противоречащую уже существующей Booking.

---

# 30. PRICE CONSISTENCY FOR HISTORICAL CONVERTED REQUESTS

Для Requests, которые привели к существующим Orders/Bookings:

- `confirmedPrice` должна соответствовать authoritative commercial amount, из которого возник Order;
- `displayedPrice` может быть равна confirmedPrice для normal case;
- часть реалистичных Requests может иметь `PRICE_CHANGED`, но только если модель позволяет сохранить оба значения и итоговый Order соответствует accepted confirmedPrice.

Не создавать исторические price-change cases, которые невозможно доказать/reconcile с Order amount.

---

# 31. HISTORICAL REQUEST STATUS MIX

Representative dataset должен содержать не только converted Requests.

Добавить реалистичную population:

```text
CONVERTED / confirmed
REJECTED
UNAVAILABLE
EXPIRED
CANCELLED_BY_CUSTOMER
PRICE_CHANGED / customer decision states
```

но только для реально реализованных statuses.

Не каждая Request должна иметь Order/Booking.

Это является причиной gaps в commerceSequence.

---

# 32. REALISTIC DISTRIBUTION — NOT RANDOM CHAOS

Количество и распределение historical Requests должны выглядеть правдоподобно относительно существующей базы.

Нужно:
1. проанализировать текущий volume Orders/Bookings по периодам;
2. определить разумный conversion ratio;
3. создать converted Requests для релевантных existing chains;
4. добавить non-converted Requests пропорционально;
5. распределить их по тем же историческим периодам;
6. не создавать аномальные spikes без причины.

В отчёте показать methodology и counts.

Не утверждать «реалистично» без численной evidence.

---

# 33. PRESERVE EXISTING REPRESENTATIVE DATA

Запрещено:
- массово менять existing business dates только чтобы подогнать Requests;
- сдвигать Booking/Order timestamps без отдельной причины;
- уничтожать existing representative population.

Requests должны адаптироваться к существующей temporal truth.

Если existing data сама содержит невозможную chronology — зафиксировать finding и исправлять только с отдельным evidence-based решением.

---

# 34. HISTORICAL COMMERCE SEQUENCE MIGRATION

Для existing Order/Booking/Payment chains определить один authoritative commerce root.

Нельзя использовать текущий Booking suffix как root только потому, что он существует.

Использовать actual relations.

Пример:

```text
Existing:
Order = MKT-ORD-00000421
Booking legacy = BKG-00000198

After normalization:
Order   = MKT-ORD-00000421
Booking = MKT-BKG-00000421
```

Если historical Request создаётся для этой цепочки:

```text
Request = MKT-REQ-00000421
```

при условии, что Request-based flow выбран для этой цепочки.

---

# 35. HISTORICAL PAYMENT MIGRATION

Для Payments одного commerce case:

```text
Payment → Order
```

назначить deterministic ordinal.

Например stable ordering:

```text
createdAt ASC
then id ASC
```

или иной доказанный порядок.

Результат:

```text
MKT-PAY-00000421-1
MKT-PAY-00000421-2
MKT-PAY-00000421-3
```

Не менять ordinal в зависимости от текущего payment status.

---

# 36. LEGACY IMPACT ANALYSIS

Перед rewrite `BKG-*` / `PAY-*` проверить:
- URLs;
- API consumers;
- exports;
- audit logs;
- emails;
- support references;
- tests;
- fixtures;
- payment gateway metadata;
- external integrations.

Если нужен legacy mapping — реализовать documented compatibility strategy.

Не маскировать legacy data frontend-only prefix.

---

# 37. UI BUSINESS TRACEABILITY

После implementation:

```text
Request:
MKT-REQ-00000001

Order:
MKT-ORD-00000001

Booking:
MKT-BKG-00000001

Payments:
MKT-PAY-00000001-1
MKT-PAY-00000001-2
```

В detail/registry surfaces отображать actual related `referenceNumber`, а не UUID.

---

# 38. DB = API = UI = EXPORT

Hard invariant:

```text
DB canonical reference
=
API reference
=
UI reference
=
CSV reference
=
XLSX reference
=
drill-down reference
```

Никакого presentation-only `MKT-` patch.

---

# 39. SEARCH

Поиск должен работать по canonical references:

```text
MKT-REQ-00000001
MKT-ORD-00000001
MKT-BKG-00000001
MKT-PAY-00000001-1
```

Legacy search aliases, если нужны, документировать отдельно.

---

# 40. ANALYTICS / FINANCE TRACEABILITY

Проверить:

```text
Analytics
→ Financial Summary
→ Successful Payments
→ Payments registry
```

Должны отображаться:

```text
MKT-PAY-xxxxxxxx-n
```

и related:

```text
MKT-ORD-xxxxxxxx
```

а не `PAY-*` и UUID.

Не менять финансовые формулы в рамках этой задачи.

---

# 41. AUTOMATED TESTS — REQUIRED

## Commerce sequence
- atomic allocation;
- concurrency;
- uniqueness;
- 8 digits;
- overflow behavior.

## Request
- canonical `MKT-REQ-*`;
- lifecycle transitions;
- temporal validation;
- conversion idempotency.

## Order
- same commerceSequence.

## Booking
- same commerceSequence;
- `MKT-BKG-*`;
- no independent V1 booking sequence.

## Payment
- same commerceSequence;
- ordinal `-1`, `-2`, ...;
- retries keep same logical payment reference;
- partial payments get next ordinal.

## Historical data
- `Request.createdAt <= Order.createdAt <= Booking.createdAt`;
- no Request after Booking;
- converted Requests reconcile to actual Order/Booking;
- non-converted Requests have no fake Booking.

## UI
- Request Center route/nav;
- table;
- KPI/filter/pagination;
- business refs;
- RU/AZ/EN;
- export.

---

# 42. RUNTIME VERIFICATION — REQUIRED

Browser verify:

```text
/app/requests
/app/orders
/app/bookings
/app/finance/payments
```

For each:
- direct URL;
- client navigation;
- refresh;
- no 404;
- correct title;
- correct data;
- canonical refs.

Request Center must be visibly present in left sidebar.

---

# 43. HISTORICAL RUNTIME SAMPLE

Выбрать минимум 10 converted historical chains across different dates.

Показать:

| Request | Request created | Order | Order created | Booking | Booking created | Payments | Temporal valid |
|---|---|---|---|---|---|---|---|
| MKT-REQ-... | ... | MKT-ORD-... | ... | MKT-BKG-... | ... | MKT-PAY-... | YES |

Hard check:

```text
Request.createdAt <= Booking.createdAt
```

для каждой строки.

Дополнительно показать несколько non-converted Requests.

---

# 44. HISTORICAL DISTRIBUTION EVIDENCE

Отчёт должен показать:

```text
Total Requests
Converted
Rejected
Unavailable
Expired
Cancelled
Price-changed
Other implemented statuses
```

и conversion rate:

```text
converted / total
```

Также распределение минимум по месяцам для representative historical period.

Цель — доказать отсутствие искусственной концентрации данных в одной дате.

---

# 45. SECURITY

Business reference не является authorization boundary.

Server-authoritative:

```text
authentication
→ workspace
→ tenant/partner scope
→ role/permission
→ relation
→ access
```

Request Center должен соблюдать тот же security contract.

---

# 46. I18N

RU/AZ/EN:
- sidebar label;
- Request Center title;
- KPI labels;
- statuses;
- filters;
- table headers;
- actions;
- empty/error states;
- export labels.

Reference numbers не локализуются.

No raw i18n keys.

---

# 47. TEST REPORTING — TRUTHFULNESS

Любой failing suite остаётся FAIL.

Например:

```text
Frontend Tests: FAIL — 282/283
```

Нельзя писать `PASS(scope)` при реальном failing suite.

---

# 48. REQUIRED REPORT

Создать:

```text
docs/reports/PHASE_3_PRE_STEP_3.12_SHARED_COMMERCE_SEQUENCE_REQUEST_CENTER_HISTORICAL_DATA_IMPLEMENTATION_REPORT.md
```

Отчёт должен содержать:

1. Starting SHA;
2. Implementation SHA(s);
3. Final SHA;
4. `HEAD == origin/master`;
5. фактическую domain/model inventory;
6. shared commerceSequence implementation;
7. Request model/lifecycle;
8. Request Center navigation/route/UI;
9. RBAC;
10. Booking `BKG-* → MKT-BKG-*` remediation;
11. Payment `PAY-* → MKT-PAY-*-n` remediation;
12. historical migration methodology;
13. historical temporal invariants;
14. historical Request status distribution;
15. converted/non-converted counts;
16. DB/API/UI/export reconciliation;
17. runtime evidence;
18. RU/AZ/EN;
19. security;
20. truthful test results;
21. remaining limitations;
22. final verdict.

---

# 49. ROADMAP UPDATE

Additively обновить:

```text
docs/prompts/TravelHub_CANONICAL_IMPLEMENTATION_ROADMAP_v3.md
```

Зафиксировать:
- Shared Commerce Sequence Contract;
- 8-digit root;
- `MKT-REQ-*`;
- `MKT-ORD-*`;
- `MKT-BKG-*`;
- `MKT-PAY-*-n`;
- Request Center;
- historical Request dataset;
- temporal consistency rules;
- actual SHA.

Не переписывать историю.
Не начинать Step 3.12 автоматически.

---

# 50. ACCEPTANCE CRITERIA

`VERDICT A` только если:

```text
[ ] shared commerceSequence реально реализован
[ ] root = 8 digits
[ ] Order использует MKT-ORD-{root}
[ ] Booking исправлена с BKG-* на MKT-BKG-{root}
[ ] Payment исправлен с PAY-* на MKT-PAY-{root}-{ordinal}
[ ] payment retry не создаёт новый ordinal
[ ] partial payment создаёт новый ordinal
[ ] Request использует MKT-REQ-{root}
[ ] Request Center добавлен в левое меню
[ ] Request Center имеет отдельный route
[ ] Request Center не является redirect/rename Orders
[ ] Request registry работает
[ ] Request KPI/filter/pagination соответствуют source data
[ ] Request export работает, если registry exportable
[ ] historical Requests добавлены
[ ] converted historical Requests связаны с реальными Orders/Bookings
[ ] Request.createdAt никогда не позже Booking.createdAt
[ ] temporal chain валидна
[ ] non-converted Requests реально существуют без fake Bookings
[ ] historical status distribution реалистична и доказана
[ ] existing Orders/Bookings dates не искажены ради seed
[ ] migration relation-based, не suffix-based guessing
[ ] DB = API = UI = Export
[ ] business related refs показываются вместо UUID где applicable
[ ] concurrency/uniqueness preserved
[ ] security server-authoritative
[ ] RU/AZ/EN verified
[ ] tests truthfully reported
[ ] report predominantly Russian
[ ] real SHA
[ ] HEAD == origin/master
```

Если Booking остаётся `BKG-*` → `VERDICT B`.

Если Payment остаётся `PAY-*` → `VERDICT B`.

Если Request Center отсутствует в runtime/sidebar → `VERDICT B`.

Если historical Requests имеют даты позже соответствующих Bookings → `VERDICT B`.

Если developer просто дорисовал prefixes на frontend → `VERDICT B`.

---

# 51. NON-GOALS

В этой задаче НЕ:
- менять Partner Performance attribution;
- менять Booking KPI semantics;
- менять GMV/Commission formulas;
- создавать Cart/Checkout;
- реализовывать multi-booking сейчас;
- менять Product `PRD-*` без отдельного domain decision;
- создавать fake analytics metrics без source data;
- начинать Step 3.12.

---

# 52. EXECUTION ORDER

```text
1. Record actual Starting SHA
2. Audit existing domain/navigation/RBAC
3. Design authoritative commerceSequence storage/allocation
4. Implement Request domain
5. Implement shared root propagation
6. Normalize Order contract if needed
7. Fix Booking → MKT-BKG-{root}
8. Fix Payment → MKT-PAY-{root}-{ordinal}
9. Implement Request Center route/sidebar/UI/RBAC
10. Build historical Request derivation strategy
11. Generate converted Requests from real historical chains
12. Generate realistic non-converted Requests
13. Validate all temporal invariants
14. Migrate historical Booking/Payment refs relation-based
15. Verify DB/API/UI/export/search
16. Verify analytics → payments traceability
17. Run automated tests
18. Browser runtime verification
19. Historical evidence matrix
20. Report
21. Roadmap update
22. Git sync
23. Verdict
```

---

# 53. CORE BUSINESS TRACEABILITY CONTRACT

```text
Commerce Case #00000001
        │
        ├── MKT-REQ-00000001
        ├── MKT-ORD-00000001
        ├── MKT-BKG-00000001
        ├── MKT-PAY-00000001-1
        └── MKT-PAY-00000001-2
```

Root number показывает принадлежность к одной коммерческой цепочке.

Но:

```text
business traceability
!= database relation
```

DB relation остаётся authoritative.

---

# 54. CORE HISTORICAL DATA CONTRACT

Для converted historical flow:

```text
Request.createdAt
        <=
Request.confirmedAt
        <=
Order.createdAt
        <=
Booking.createdAt
        <=
Payment.createdAt / paidAt
```

с поправкой на реальные timestamp semantics конкретных entities.

Минимально недопустимо:

```text
Request.createdAt > Booking.createdAt
```

Representative historical data должны отражать бизнес-время, а не просто удовлетворять schema constraints.


---

# 55. CRITICAL ORCHESTRATION CORRECTION — MANDATORY

Этот раздел имеет приоритет над любой более ранней формулировкой в документе, которая могла подразумевать:

```text
Request CONFIRMED
→ сразу Order
→ сразу Booking
→ потом Payment
```

Это больше не canonical business flow.

Новый contract:

```text
Клиент нажимает [Забронировать]
        ↓
TravelHub создаёт Request
        ↓
Supplier Response SLA
        ↓
продавец подтверждает / меняет цену / отклоняет
        ↓
TravelHub уведомляет клиента
        ↓
Customer Confirmation / Payment TTL
        ↓
клиент принимает условия и продолжает
        ↓
Order
        ↓
Booking
        ↓
Payment
```

Технический implementation order между Order/Booking/Payment должен быть transaction-safe и соответствовать существующей payment architecture, но **Supplier CONFIRMED сам по себе не является достаточным условием для final Booking**.

---

# 56. CUSTOMER CTA — DO NOT RENAME TO “SEND REQUEST”

На Product/Marketplace UI клиентский CTA остаётся:

```text
[Забронировать]
```

Нельзя заменять его на:

```text
[Отправить запрос]
```

Request — внутренняя orchestration entity.

После нажатия `[Забронировать]` UI переходит в состояние:

```text
Проверяем доступность
и актуальную цену

Ожидаем подтверждения продавца
```

---

# 57. SUPPLIER RESPONSE SLA — REQUIRED

Реализовать отдельный SLA ожидания продавца.

Нужны authoritative timestamps / fields, например:

```text
supplierResponseDeadline
supplierRespondedAt
```

или эквивалентная модель.

SLA не должен быть одним hardcoded значением без architecture/config evidence.

Нужно предусмотреть возможность настройки по:
- service type;
- supplier/partner;
- capability;
- marketplace policy.

В Request Center продавец должен видеть deadline / remaining time.

Если deadline истёк без valid response:

```text
→ SUPPLIER_TIMEOUT
```

или эквивалентный canonical status.

После timeout:

```text
Order = none
Booking = none
Payment = none
```

---

# 58. CUSTOMER CONFIRMATION / PAYMENT TTL — REQUIRED

После supplier positive confirmation должен запускаться отдельный TTL валидности подтверждённых commercial terms.

Нужны authoritative timestamps / fields, например:

```text
customerActionDeadline
customerAcceptedAt
```

или эквивалентные.

Клиент должен видеть:

```text
Услуга подтверждена
Цена: 150 AZN

Действительно до: <deadline>

[Оплатить]
```

Если TTL истёк:

```text
→ CUSTOMER_PAYMENT_TIMEOUT
```

или эквивалентный canonical state.

Старая payment CTA должна перестать быть valid.

---

# 59. SLA AND TTL ARE DIFFERENT CLOCKS

Hard invariant:

```text
Supplier Response SLA
!=
Customer Confirmation / Payment TTL
```

Первый измеряет время ответа продавца.

Второй измеряет время, в течение которого клиент может воспользоваться подтверждённой availability/price.

Не объединять их одним `expiresAt`, если это уничтожает смысл двух разных deadlines.

Если используется общий flexible expiration model, semantics должны быть явно различимы.

---

# 60. PRICE CHANGE FLOW

Если:

```text
displayedPrice = 150
confirmedPrice = 165
```

Request:

```text
→ PRICE_CHANGED
```

Клиент получает:

```text
Было: 150 AZN
Новая цена: 165 AZN

[Принять новую цену]
[Отказаться]
```

Только после explicit acceptance:

```text
→ CUSTOMER_ACCEPTED
→ CONFIRMED
```

и затем появляется valid payment action within Customer TTL.

Нельзя автоматически перевести клиента на оплату новой цены без explicit acceptance.

---

# 61. CUSTOMER NON-RESPONSE

Если продавец подтвердил условия, но клиент не отреагировал до deadline:

```text
Request
→ CUSTOMER_PAYMENT_TIMEOUT
```

Новые Order / Booking не создаются, если customer commitment/payment flow ещё не начат.

Для повторной попытки требуется revalidation:

```text
[Проверить доступность снова]
```

Отдельно определить, когда это:
- retry той же Request;
- новая Request / новый commerceSequence.

Не создавать бесконтрольные duplicate chains.

---

# 62. REQUEST CENTER — SELLER ACTIONS

Request Center должен позволять seller-side structured actions:

```text
[Подтвердить текущую цену]
[Предложить новую цену]
[Недоступно]
[Отклонить]
```

Actions должны:
- быть permission-gated;
- быть server-authoritative;
- менять Request lifecycle;
- сохранять actor/timestamp/reason;
- запускать соответствующую customer notification;
- соблюдать Supplier SLA.

---

# 63. CUSTOMER STATUS UI

Клиенту нужны понятные состояния, без внутреннего технического жаргона:

```text
Проверяем доступность
Ожидаем подтверждения продавца
Цена изменилась — требуется ваше решение
Услуга подтверждена — оплатите до ...
Продавец не ответил вовремя
Услуга недоступна
Подтверждение истекло
```

No raw enum labels unless they совпадают с UX contract.

---

# 64. ORDER / BOOKING CREATION GATE

Hard gate:

```text
Supplier CONFIRMED
alone
!= permission to create final Booking
```

Нужно valid customer continuation:

```text
supplier confirmed
AND
customer accepted current terms
AND
customer action still within TTL
```

После этого orchestration создаёт downstream commerce objects согласно transaction/payment design.

Если product requires supplier hold before payment:
- оформить отдельное hold state/model;
- не выдавать hold за final Booking без доказанного domain contract.

---

# 65. HISTORICAL DATA — SLA/TTL CONSISTENCY

Historical Requests должны также соблюдать новые временные инварианты.

Для converted flow:

```text
Request.createdAt
<= supplierRespondedAt
<= customerAcceptedAt / customerActionAt
<= Order.createdAt
<= Booking.createdAt
```

Если price did not change, `customerAcceptedAt` может отражать переход к оплате / подтверждение текущих условий согласно фактической модели.

Supplier deadline:

```text
supplierRespondedAt <= supplierResponseDeadline
```

для successfully answered Requests.

Customer deadline:

```text
customerActionAt <= customerActionDeadline
```

для converted Requests.

Для timeout examples:

```text
SUPPLIER_TIMEOUT:
supplier response absent after deadline

CUSTOMER_PAYMENT_TIMEOUT:
supplier response exists
but no valid customer continuation before deadline
```

---

# 66. HISTORICAL STATUS DISTRIBUTION — EXTEND

Representative dataset должен включать, где реализованы:

```text
CONVERTED
REJECTED
UNAVAILABLE
SUPPLIER_TIMEOUT
CUSTOMER_PAYMENT_TIMEOUT
PRICE_CHANGED → accepted
PRICE_CHANGED → declined
CANCELLED_BY_CUSTOMER
```

Не создавать fake downstream Order/Booking для timeout/declined Requests.

---

# 67. NOTIFICATIONS — MINIMUM REQUIRED

Реализовать/подключить existing notification mechanism для ключевых переходов, если соответствующая infrastructure уже есть:

```text
Request created → seller
Supplier confirmed → customer
Price changed → customer
Supplier unavailable/rejected → customer
Supplier timeout → customer
Customer deadline approaching/expired → customer
```

Если notification infrastructure отсутствует или выходит за scope:
- не создавать fake mechanism;
- зафиксировать gap;
- UI state всё равно должен быть корректным.

---

# 68. RUNTIME ACCEPTANCE — SLA/TTL

Browser/runtime evidence обязана показать минимум:

### Scenario A — supplier confirms current price

```text
Customer clicks [Забронировать]
→ Request created
→ seller sees Request Center item
→ seller confirms
→ customer sees [Оплатить] + deadline
```

### Scenario B — price changed

```text
seller proposes new price
→ customer sees old/new price
→ customer accepts
→ payment CTA appears
```

### Scenario C — supplier timeout

```text
no seller response
→ Request becomes timeout
→ no Order/Booking/Payment
```

### Scenario D — customer timeout

```text
seller confirms
→ customer does not act until TTL expires
→ payment CTA invalid/removed
→ no downstream final Booking
```

---

# 69. UPDATED ACCEPTANCE CRITERIA — ADDITIONAL HARD GATES

В дополнение ко всем предыдущим acceptance criteria:

```text
[ ] клиентский CTA остаётся "Забронировать"
[ ] Request создаётся платформой как orchestration object
[ ] Supplier Response SLA реализован
[ ] Customer Confirmation/Payment TTL реализован
[ ] SLA и TTL являются разными semantic clocks
[ ] seller sees deadline in Request Center
[ ] customer sees validity deadline after confirmation
[ ] supplier timeout не создаёт Order/Booking/Payment
[ ] customer timeout не создаёт downstream final Booking
[ ] price change требует explicit customer acceptance
[ ] stale/expired payment action блокируется server-side
[ ] Supplier CONFIRMED alone не создаёт final Booking
[ ] historical Requests obey supplier/customer deadline chronology
[ ] timeout historical records do not have fake downstream commerce
```

Если любой из этих hard gates не выполнен → `VERDICT B`.

---

# 70. UPDATED CORE ORCHESTRATION CONTRACT

```text
Customer intent
     ↓
[Забронировать]
     ↓
TravelHub Request
     ↓
Supplier Response SLA
     ↓
Supplier decision
     ↓
TravelHub state transition
     ↓
Customer Confirmation / Payment TTL
     ↓
Customer decision / payment continuation
     ↓
Order
     ↓
Booking
     ↓
Payment
     ↓
Execution
```

TravelHub остаётся authoritative orchestrator процесса.
