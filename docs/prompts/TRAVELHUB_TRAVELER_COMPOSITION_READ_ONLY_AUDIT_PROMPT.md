# TRAVELHUB — READ-ONLY AUDIT
# TRAVELER COMPOSITION → SUPPLIER PRICE

## 1. ЦЕЛЬ

Провести read-only аудит того, как TravelHUB в текущей реализации формирует состав туристов для supplier-запросов и где в эту цепочку должны подключаться реальные `RequestTraveler.birthDate`.

Исследовать:
- Summer
- Kompas
- Anex Tours
- Anex Hotels
- Kazunion
- AZAL

Цель аудита — определить существующую архитектуру и безопасную точку интеграции. Новую систему возрастных правил на этой фазе не создавать.

## 2. ГЛАВНЫЙ ВОПРОС

Точно установить цепочку:

```text
Traveler data
    ↓
adults / children / childAges / infants
    ↓
SupplierSearchQuery
    ↓
Supplier Adapter
    ↓
Supplier API
    ↓
Supplier Price
```

Ответить:

> Где и каким кодом TravelHUB сейчас определяет `adults`, `children`, `childAges`, `infants`, и какие данные являются source of truth?

## 3. ОГРАНИЧЕНИЯ

Это исключительно READ-ONLY AUDIT.

Запрещено:

```text
NO CODE CHANGES
NO DATABASE CHANGES
NO MIGRATIONS
NO REFACTOR
NO NEW FEATURES
NO PRICE CHANGES
NO MARKUP CHANGES
NO TRAVELER DATA REPAIR
NO COMMIT
NO PUSH
```

Разрешено:
- читать исходный код;
- читать Prisma schema;
- читать tests;
- читать supplier adapters;
- читать DTO;
- выполнять SELECT;
- browser/network inspection;
- запускать существующие тесты;
- временные диагностические команды без изменения данных.

## 4. НЕ СОЗДАВАТЬ НОВЫЕ ВОЗРАСТНЫЕ ПРАВИЛА

Не вводить самостоятельно правила вроде:

```text
age < 18 = child
age < 12 = child
age < 2 = infant
```

или любые другие универсальные пороги.

Если supplier/product использует собственные правила — найти их.
Если правила приходят от supplier/API — показать это.
Если возрастные правила отсутствуют — зафиксировать отсутствие.

## 5. REQUESTTRAVELER

Найти реализацию `RequestTraveler`.

Определить:
- где создаётся;
- где изменяется;
- где читается;
- где используется при Request creation;
- где используется при customerAccept;
- где используется при Request → Order.

Поля:

```text
firstName
lastName
birthDate
position
```

Отдельно установить, используется ли `birthDate` где-либо кроме traveler storage/UI.

## 6. НАЙТИ TRAVELER COMPOSITION

Найти все места, где формируются:

```text
adults
children
childAges
infants
```

Искать также:

```text
adultCount
childCount
childrenAges
infantCount
```

Для каждого места указать:

```text
file
function
input
output
business purpose
```

## 7. SOURCE OF TRUTH

Для каждого поля определить источник:

```text
adults
children
childAges
infants
```

Проверить возможные источники:
- RequestTraveler[];
- Request.travelerCount;
- frontend search form;
- supplier response;
- stored offer;
- product attributes;
- manual operator input;
- default/hardcoded value.

Не предполагать — подтвердить кодом.

## 8. SUMMER

Исследовать полный путь:

```text
TravelHUB
    ↓
Summer Adapter
    ↓
Summer request
```

Определить:
- какие traveler parameters получает adapter;
- используются ли `adults`, `children`, `childAges`, `infants`;
- где происходит transformation;
- какие supplier-native поля используются;
- что реально отправляется Summer API.

Особенно проверить `childAges`.

## 9. KOMPAS

Повторить анализ:

```text
TravelHUB
    ↓
Kompas Adapter
    ↓
Kompas request
```

Определить:
- adults;
- children;
- childAges;
- infants;
- supplier-native mapping;
- источник возрастов;
- влияние на цену.

## 10. ANEX

Исследовать отдельно:

```text
Anex Tours
Anex Hotels
```

Не считать их автоматически одной моделью.

Определить:
- adults;
- children;
- childAges;
- infants;
- supplier-native mapping;
- источник возраста;
- влияние на supplier price.

## 11. KAZUNION

Исследовать:

```text
TravelHUB
    ↓
Kazunion Adapter
    ↓
supplier request
```

Определить:
- adults;
- children;
- childAges;
- infants;
- supplier-native поля;
- источник возраста;
- влияние на цену.

## 12. AZAL

Исследовать отдельно flight domain:

```text
FlightSupplier
FlightSearchQuery
FlightSearchResult
```

Определить:
- adults;
- children;
- infants;
- наличие/отсутствие `childAges`;
- используются ли фактические DOB;
- передаётся ли supplier только агрегированный passenger composition.

Ответить:

> Использует ли AZAL фактические DOB туристов или только агрегированный passenger composition?

## 13. UNIVERSAL SEARCH

Исследовать Universal Search.

Определить, как он передаёт:

```text
adults
children
childAges
infants
```

Проверить, существует ли уже единый canonical composition object.

## 14. SUPPLIER SEARCH QUERY

Найти canonical `SupplierSearchQuery` или фактический аналог.

Определить его структуру и статус:

> Это supplier-independent canonical representation или transport DTO?

Показать поля:

```text
adults
children
childAges
infants
```

если они существуют.

## 15. PRODUCT / OFFER / SNAPSHOTS

Проверить, где composition сохраняется внутри:

```text
Product
Offer
SupplierOffer
productSnapshot
commercialSnapshot
Request
```

Определить, содержатся ли:

```text
adults
children
childAges
infants
```

или только:

```text
travelerCount
```

## 16. PRICE CALCULATION

Найти все места, где traveler composition влияет на цену.

Определить фактическую цепочку:

```text
composition
    ↓
supplier request
    ↓
supplier response
    ↓
supplierPrice
```

или:

```text
composition
    ↓
TravelHUB calculation
    ↓
price
```

или комбинацию.

Особенно проверить `childAges`.

## 17. CALENDAR

Отдельно исследовать календарный flow.

Определить:

```text
Calendar request
    ↓
composition
    ↓
supplier query
    ↓
price
```

Проверить, использует ли календарь те же traveler parameters, что и Offer/Request.

Важно: предыдущий кейс с Calendar `$3,755` и Request `$3,948` не считать дефектом. Установлено, что в календаре были разные варианты, и пользователь выбрал Offer за `$3,948`.

## 18. OFFER SELECTION

Исследовать:

```text
Calendar
    ↓
selected offer
    ↓
OfferModal
    ↓
Request
```

Проверить, сохраняются ли при выборе Offer:

```text
adults
children
childAges
infants
```

или Request формирует composition заново.

## 19. REQUEST CREATION

Исследовать `createTourRequest` и соответствующие flight/request flows.

Установить:

```text
RequestTraveler
       ↓
composition
       ↓
supplier price
```

или:

```text
RequestTraveler
       ↓
Request only

supplier price
       ↓
existing offer snapshot
```

Это критическое различие.

## 20. CUSTOMER ACCEPT

Проверить:

```text
Request
    ↓
customerAccept
```

Определить, что происходит, если traveler data изменяется между Request creation и Customer Accept.

Проверить:
- пересчитывается ли composition;
- пересчитывается ли supplier price;
- инвалидируется ли старый commercial snapshot;
- требуется ли новый Offer;
- используется ли старая цена.

Только зафиксировать, не исправлять.

## 21. COMMERCIAL SNAPSHOT

Проверить структуру `commercialSnapshot`.

Установить, сохраняется ли frozen traveler composition:

```text
adults
children
childAges
infants
```

Если отсутствует — явно зафиксировать.

## 22. PRICE FRESHNESS

Проверить связь:

```text
traveler composition
+
price freshness
```

Например:

```text
Offer created
↓
traveler composition changes
↓
old supplier price
```

Определить, существует ли защита от такого состояния.

## 23. EXISTING AGE RULES

Найти все существующие правила, связанные с:

```text
adult
child
infant
age
birthDate
childAges
```

Составить inventory:

| Rule | Location | Used by | Supplier/Product |
|---|---|---|---|

Не оценивать правила как правильные/неправильные на этой фазе.

## 24. DOB — КЛЮЧЕВАЯ ПРОВЕРКА

Главный вопрос:

```text
RequestTraveler.birthDate
```

используется ли где-либо для формирования supplier composition?

Если:

```text
birthDate
   ↓
NOWHERE
```

так и написать.

Если:

```text
birthDate
   ↓
age calculation
   ↓
child/adult
```

найти точную функцию и правила.

## 25. ДАТА РАСЧЁТА ВОЗРАСТА

Если возраст рассчитывается, определить, относительно какой даты:

```text
today
departureDate
checkInDate
returnDate
supplier-specific date
```

Не менять существующее поведение.

## 26. ОБЯЗАТЕЛЬНАЯ SUPPLIER MATRIX

Предоставить:

| Supplier | adults | children | childAges | infants | DOB used? | Age rule location | Price affected? |
|---|---|---|---|---|---|---|---|
| Summer | ? | ? | ? | ? | ? | ? | ? |
| Kompas | ? | ? | ? | ? | ? | ? | ? |
| Anex Tours | ? | ? | ? | ? | ? | ? | ? |
| Anex Hotels | ? | ? | ? | ? | ? | ? | ? |
| Kazunion | ? | ? | ? | ? | ? | ? | ? |
| AZAL | ? | ? | ? | ? | ? | ? | ? |

Все `?` заменить фактическими значениями или `N/A / NOT FOUND`.

## 27. ОЖИДАЕМАЯ АРХИТЕКТУРНАЯ КАРТА

Финальный отчёт должен показать фактическую карту:

```text
RequestTraveler.birthDate
          │
          ▼
       ??????
          │
          ▼
adults / children / childAges / infants
          │
          ▼
SupplierSearchQuery
          │
    ┌─────┼─────┬─────┬─────┐
    ▼     ▼     ▼     ▼     ▼
 Summer Kompas Anex KAZUNION AZAL
    │     │     │     │     │
    ▼     ▼     ▼     ▼     ▼
 Supplier Price
```

## 28. ОСОБЕННО ОТДЕЛИТЬ

В отчёте отдельно разделить:

### A. Что уже существует и работает

### B. Что существует, но используется только частью supplier integrations

### C. Что существует, но не связано с RequestTraveler

### D. Чего сейчас нет

### E. Где безопаснее всего подключить RequestTraveler.birthDate

## 29. НЕ ДЕЛАТЬ IMPLEMENTATION PROMPT

По результатам аудита не переходить автоматически к реализации.

Сначала предоставить:
1. фактическую архитектурную карту;
2. supplier matrix;
3. существующие age rules;
4. price dependencies;
5. gaps;
6. точку интеграции `RequestTraveler.birthDate`;
7. рекомендации.

После просмотра отчёта отдельно принять решение о следующей implementation-фазе.

## 30. FINAL VERDICT

В конце выбрать только один вариант:

```text
A — Existing composition engine is reusable.

B — Composition exists but is fragmented by supplier.

C — Composition is currently supplied only by search UI
    and RequestTraveler.birthDate is not connected.

D — Existing architecture cannot safely support the required
    RequestTraveler → composition → pricing flow without
    a new abstraction.
```

Выбор должен быть подтверждён конкретными файлами, функциями и code paths.

## 31. FINAL REPORT

Создать:

`TRAVELHUB_TRAVELER_COMPOSITION_READ_ONLY_AUDIT_REPORT.md`

Отчёт должен содержать:

1. Executive Summary
2. RequestTraveler Analysis
3. Existing Composition Engine
4. SupplierSearchQuery Analysis
5. Summer
6. Kompas
7. Anex Tours
8. Anex Hotels
9. Kazunion
10. AZAL
11. Universal Search
12. Calendar
13. Offer Selection
14. Request Creation
15. Customer Accept
16. Commercial Snapshot
17. Price Freshness
18. Existing Age Rules
19. DOB Usage
20. Supplier Matrix
21. Architecture Map
22. Gaps
23. Recommended Integration Point
24. Risks
25. Files / Functions / Code Locations
26. Tests Reviewed
27. Final Verdict

## 32. GIT

В рамках аудита:

```text
NO COMMIT
NO PUSH
```

В финальном отчёте указать:

```text
HEAD
git status
files inspected
tests executed
database reads, если были
```

# КРИТЕРИЙ ЗАВЕРШЕНИЯ

Аудит считается завершённым только если можно ответить на три вопроса:

### 1.
Откуда сейчас берутся `adults / children / childAges / infants`?

### 2.
Какие правила определения состава реально используются каждым supplier?

### 3.
В какой точке можно безопасно подключить `RequestTraveler.birthDate`, чтобы не создать вторую параллельную систему age/composition rules и не сломать существующие цены?

Только после получения этих ответов переходить к implementation.
