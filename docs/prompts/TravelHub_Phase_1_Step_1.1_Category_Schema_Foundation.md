# PHASE 1 — STEP 1.1: CATEGORY SCHEMA FOUNDATION

Step 1.0 принят.

Начни только **Phase 1 Step 1.1 — Category Schema Foundation**.

Не начинай ProductMedia, media upload, Moderation, Marketplace UI, Sales, Finance или изменение маршрутов frontend в этом шаге.

## Цель

Расширить существующий Catalog так, чтобы единый `Catalog.Product` поддерживал разные категории туристических услуг без создания отдельных сущностей/доменов для Hotel, Tour, Transfer, Excursion, Car Rental и т. д.

Архитектурный принцип:

```text
Catalog.Product
        +
Category
        +
Category Schema
        ↓
category-specific attributes
filters
availability requirements
Tariff/Option requirements
media requirements
Product Detail Page sections
```

`Product` остаётся одной универсальной сущностью.

## 1. Сначала изучи существующую Catalog schema

Перед изменениями покажи:

- текущие модели `Product`;
- `Category`;
- `Tariff`;
- `Availability`;
- `ProductHistory`;
- существующие DTO;
- CatalogService;
- CatalogController;
- существующие e2e для Catalog.

Определи минимальную миграцию без переписывания работающего Catalog.

## 2. Category Schema

Добавь модель/структуру, позволяющую категории определять:

- `attributes`;
- обязательность полей;
- тип данных;
- enum/options;
- searchable/filterable fields;
- availability requirements;
- Tariff/Option requirements;
- media requirements;
- Product Detail Page sections.

Не создавай отдельные Product tables для каждой категории.

## 3. Канонические верхнеуровневые категории

Заложи категории из Master.

Минимум:

```text
Tours
Accommodation
Excursions
Activities & Entertainment
Flights
Rail
Bus / Ground Transport
Transfers
Car Rental
Other Vehicle Rental
Guides
Cruises
Tickets & Events
Food & Gastronomy
Wellness & SPA
Travel Insurance
Visa Services
Travel Ancillary Services
```

Используй стабильный code/slug категории.

Отображаемое название должно локализоваться отдельно.

Не используй RU/AZ/EN display name как технический идентификатор категории.

## 4. Category-specific examples

Архитектура должна позволять, например:

### Accommodation

```text
checkIn
checkOut
roomType
mealPlan
amenities
starRating
```

### Transfer

```text
origin
destination
vehicleType
capacity
luggageCapacity
```

### Excursion

```text
duration
meetingPoint
startTime
language
groupSize
```

### Tour

```text
days
nights
itinerary
included
excluded
```

### Car Rental

```text
pickupLocation
dropoffLocation
vehicleClass
transmission
deposit
driverRequirements
```

Это примеры schema configuration, а не разрешение создавать отдельные bounded contexts.

## 5. Product attributes

Определи безопасный способ хранения category-specific Product attributes.

Требования:

- schema validation;
- versionability;
- возможность добавлять новые attributes без миграции Product table на каждое поле;
- типизация на API boundary;
- нельзя принимать произвольный бесконтрольный JSON без проверки Category Schema;
- изменение Category Schema не должно автоматически ломать уже опубликованный исторический Product.

Если выбираешь JSON/JSONB для values — обязательно валидируй его по Category Schema.

## 6. Category Schema lifecycle

Минимально предусмотри:

```text
DRAFT
ACTIVE
DEPRECATED
```

или эквивалентную модель, если текущая архитектура Catalog уже предоставляет подходящий lifecycle.

Опубликованные Product должны иметь ссылку на используемую версию/schema context так, чтобы изменение Category Schema не изменяло молча смысл существующего Product.

Не усложняй модель без необходимости.

## 7. Media requirements

В этом шаге НЕ реализуй ProductMedia.

Но Category Schema должна уже позволять описывать требования для будущего Step 1.2, например:

```text
minImages
maxImages
primaryImageRequired
allowedMediaTypes
videoAllowed
```

Эти правила пока только schema/configuration.

Сам upload/storage/media endpoints в Step 1.1 не реализовывать.

## 8. PDP configuration

Category Schema должна позволять определить, какие логические секции используются Product Detail Page.

Например:

```text
overview
gallery
itinerary
amenities
included
excluded
meetingPoint
vehicle
conditions
cancellationPolicy
availability
tariffs
partner
```

Не реализуй сам Public Product Detail Page сейчас.

## 9. Migration

Создай отдельную Prisma migration.

Не изменяй существующие business IDs.

Не удаляй существующие Category/Product данные.

Существующие Product после migration должны оставаться читаемыми.

Если требуется backfill Category Schema — сделай детерминированный migration/seed strategy.

## 10. API

Добавь только тот API, который необходим для Category Schema foundation.

Не создавай public Marketplace API в этом шаге.

Не создавай media API.

Не меняй существующие Order/Booking APIs.

## 11. RBAC

Используй существующий RBAC.

Изменение Category Schema должно быть доступно только административной/явно разрешённой роли.

PARTNER не должен иметь право менять Category Schema.

PARTNER позже будет заполнять Product attributes только в рамках активной schema.

## 12. Tests

Обязательны unit/integration/e2e по необходимости.

E2E должны работать только через изолированную test DB из Step 1.0.

Минимально доказать:

1. существующие 17 e2e продолжают проходить;
2. Category Schema создаётся/читается;
3. Product принимает допустимые category-specific attributes;
4. невалидный тип attribute отклоняется;
5. неизвестный запрещённый attribute отклоняется;
6. обязательный attribute проверяется;
7. PARTNER не может изменить Category Schema;
8. изменение schema не удаляет существующий Product;
9. media requirements могут быть сохранены, но media functionality отсутствует;
10. новая category может быть добавлена без создания новой Product entity/table.

## 13. Не делать в этом шаге

Не реализовывать:

```text
ProductMedia
upload/storage
image processing
Moderation
Marketplace Home
Product Detail Page UI
Partner Cabinet
Buyer Cabinet
Sales
Finance
OrderRequested
frontend route migration
```

## 14. После выполнения

Предоставь:

1. список изменённых файлов;
2. Prisma schema changes;
3. migration;
4. описание Category Schema;
5. пример schema минимум для Accommodation, Transfer, Excursion, Tour и Car Rental;
6. API changes;
7. RBAC changes;
8. результаты новых тестов;
9. результаты всех существующих e2e;
10. `tsc --noEmit`;
11. git diff summary;
12. найденные проблемы/архитектурные вопросы.

Если возникает решение, меняющее Master/Baseline:

```text
ARCHITECTURE DECISION REQUIRED
```

и не принимай его самостоятельно.

После завершения остановись.

Финальная строка:

```text
PHASE 1 STEP 1.1 COMPLETED — WAITING FOR REVIEW
```
