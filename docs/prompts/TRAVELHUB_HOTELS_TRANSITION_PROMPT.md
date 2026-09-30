# TRAVELHUB — HOTELS: ЕДИНЫЙ ПРОМПТ НА РЕАЛИЗАЦИЮ

## Цель

Перевести TravelHUB от текущей реализации Tours к поддержке новой категории услуги **Hotels**, не ломая существующую категорию Tours.

Hotels должны поддерживать два разных типа источников:

1. **Внешние источники данных**:
   - Compass
   - Summer
   - Kazunion
   - Anex

2. **Поставщики, зарегистрированные непосредственно в TravelHUB**, которые размещают свои услуги в общем каталоге TravelHUB.

Ключевое архитектурное требование:

> Для Hotels создаются собственные adapters для каждого внешнего источника. Tour Adapter для Hotels НЕ используется.

То есть:

```text
CompassHotelAdapter
SummerHotelAdapter
KazunionHotelAdapter
AnexHotelAdapter
```

при наличии соответствующего внешнего Hotel-источника.

При этом общая техническая инфраструктура конкретного Provider должна переиспользоваться.

---

# 1. ОБЯЗАТЕЛЬНЫЙ АУДИТ ПЕРЕД РЕАЛИЗАЦИЕЙ

Перед изменением кода изучить фактическую архитектуру репозитория:

- Universal Search;
- Tour Search;
- Search Orchestrator;
- существующие Tour Adapters;
- Provider Layer;
- Compass;
- Summer;
- Kazunion;
- Anex;
- Catalog;
- Supplier;
- Product;
- Offer;
- Geography;
- Booking;
- Order;
- Payment;
- provider mappings;
- frontend search;
- E2E-тесты.

Сначала определить:

```text
что является общим Provider Layer
что относится только к Tours
что можно переиспользовать
что необходимо создать для Hotels
```

Не создавать дублирующие сервисы, если аналогичный механизм уже существует.

Не придумывать отсутствующие API или интеграции.

---

# 2. АРХИТЕКТУРА PROVIDER → CATEGORY ADAPTER

Использовать модель:

```text
Provider
   ↓
Category-specific Adapter
```

Пример:

```text
Compass
├── CompassProvider
├── CompassTourAdapter
└── CompassHotelAdapter
```

```text
Summer
├── SummerProvider
├── SummerTourAdapter
└── SummerHotelAdapter
```

```text
Kazunion
├── KazunionProvider
├── KazunionTourAdapter
└── KazunionHotelAdapter
```

```text
Anex
├── AnexProvider
├── AnexTourAdapter
└── AnexHotelAdapter
```

## КРИТИЧЕСКОЕ ТРЕБОВАНИЕ

Для Hotels создавать **собственные Hotel Adapters**.

Например:

```text
CompassHotelAdapter
SummerHotelAdapter
KazunionHotelAdapter
AnexHotelAdapter
```

Существующие Tour Adapters:

```text
CompassTourAdapter
SummerTourAdapter
KazunionTourAdapter
AnexTourAdapter
```

для Hotel Search не использовать.

Запрещается просто переименовать Tour Adapter в Hotel Adapter или механически копировать его целиком.

Hotel Adapter должен содержать именно Hotel-specific mapping и business logic.

---

# 3. ЧТО ПЕРЕИСПОЛЬЗОВАТЬ ОТ PROVIDER

Если Provider уже содержит общую техническую инфраструктуру, её необходимо переиспользовать:

```text
HTTP client
authentication
session
cookies
headers
rate limiting
retry
timeout
error handling
logging
provider configuration
общие mappings
```

Например:

```text
CompassProvider
       │
       ├── CompassTourAdapter
       │
       └── CompassHotelAdapter
```

Таким образом:

- Provider = техническое подключение к внешней системе;
- Adapter = преобразование конкретной категории;
- Hotel Adapter = Hotel-specific integration.

---

# 4. ДВА ТИПА ИСТОЧНИКОВ HOTELS

## TYPE A — EXTERNAL PROVIDER

Внешние источники:

```text
Compass
Summer
Kazunion
Anex
```

Схема:

```text
Hotel Search
    ↓
HotelSearchOrchestrator
    ↓
External Provider
    ↓
Hotel Adapter
    ↓
External API / HTTP Source
    ↓
Provider Response
    ↓
Normalizer
    ↓
NormalizedHotelOffer
```

Внешний источник может предоставлять live availability и live price.

---

## TYPE B — TRAVELHUB CATALOG SUPPLIER

Поставщик регистрируется непосредственно на платформе:

```text
Supplier Registration
        ↓
Supplier Account
        ↓
Supplier Hotel Products
        ↓
TravelHUB Hotel Catalog
        ↓
Catalog Search
        ↓
NormalizedHotelOffer
```

Для такого поставщика **не создаётся отдельный Adapter**.

Например, если в TravelHUB зарегистрированы:

```text
Supplier A
Supplier B
Supplier C
```

все они работают через:

```text
TravelHUB Hotel Catalog
```

и общий:

```text
HotelCatalogSearchService
```

или существующий Catalog Search механизм.

---

# 5. ПРИНЦИПИАЛЬНОЕ РАЗЛИЧИЕ

Не смешивать:

```text
External Provider
```

и:

```text
TravelHUB Platform Supplier
```

External Provider:

```text
Compass
Summer
Kazunion
Anex
```

— внешний источник данных, для которого требуется интеграция и собственный Hotel Adapter.

Platform Supplier:

```text
TravelHUB Supplier
```

— участник внутренней платформы, который размещает услуги в каталоге TravelHUB.

Для Platform Supplier:

```text
Supplier → Catalog → Search
```

а не:

```text
Supplier → Adapter
```

---

# 6. ЦЕЛЕВАЯ АРХИТЕКТУРА HOTEL SEARCH

```text
                         TravelHUB
                             │
                    Universal Search
                             │
                  HotelSearchOrchestrator
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
      External Providers              TravelHUB Catalog
              │                             │
       ┌──────┼──────┐                      │
       ▼      ▼      ▼                      ▼
    Compass Summer Kazunion               Suppliers
       │      │      │
       ▼      ▼      ▼
  HotelAdapter ...
       │      │      │
       └──────┼──────┘
              │
             Anex
              │
       AnexHotelAdapter
              │
              └──────────────┐
                             ▼
                  NormalizedHotelOffer[]
                             │
                             ▼
                     Unified Results
```

Один Hotel Search должен объединять результаты обоих типов источников.

---

# 7. HOTEL SEARCH ORCHESTRATOR

Добавить категорию:

```text
HOTELS
```

к существующему Universal Search.

Целевая логика:

```text
SearchRequest
    │
    ├── TOURS
    │     ↓
    │  TourSearchOrchestrator
    │
    └── HOTELS
          ↓
       HotelSearchOrchestrator
```

Не создавать второй независимый Universal Search.

Не смешивать Tour и Hotel business logic в одном огромном сервисе.

---

# 8. CANONICAL HOTEL SEARCH REQUEST

Создать единый TravelHUB контракт:

```ts
HotelSearchRequest {
  category: 'HOTELS';

  countryId?: string;
  cityId?: string;
  resortId?: string;
  hotelId?: string;

  checkIn: string;
  checkOut: string;

  adults: number;
  children: number;
  childrenAges: number[];
}
```

Если в проекте уже существует соответствующая модель, использовать её и расширить при необходимости.

Не создавать параллельные системы дат, туристов или географии.

---

# 9. HOTEL SOURCE CONTRACT

Определить единый логический контракт Hotel Source:

```ts
interface HotelSearchSource {
  search(
    request: HotelSearchRequest
  ): Promise<NormalizedHotelOffer[]>;
}
```

Его реализуют внешние adapters:

```text
CompassHotelAdapter
SummerHotelAdapter
KazunionHotelAdapter
AnexHotelAdapter
```

и внутренний каталог через:

```text
HotelCatalogSearchService
```

---

# 10. NORMALIZED HOTEL OFFER

Все источники должны приводиться к единой модели TravelHUB:

```ts
NormalizedHotelOffer {
  id: string;

  source: {
    type:
      | 'EXTERNAL_PROVIDER'
      | 'TRAVELHUB_CATALOG';

    providerId?: string;
    supplierId?: string;
  };

  hotel: {
    id?: string;
    name: string;
  };

  geography: {
    countryId?: string;
    cityId?: string;
    resortId?: string;
  };

  stay: {
    checkIn: string;
    checkOut: string;
    nights: number;
  };

  room: {
    roomType?: string;
    accommodation?: string;
  };

  meal?: {
    code?: string;
    name?: string;
  };

  guests: {
    adults: number;
    children: number;
    childrenAges: number[];
  };

  price: {
    amount: number;
    currency: string;
  };

  booking: {
    offerId: string;
    mode: string;
  };
}
```

Если в проекте уже существует эквивалентная domain model — использовать её вместо дублирования.

Frontend не должен знать внутренний JSON каждого внешнего поставщика.

---

# 11. PRODUCT VS OFFER

Строго разделять:

```text
Hotel Product
```

и:

```text
Hotel Offer
```

Product:

```text
Hotel
Room Type
Accommodation
Meal
```

Offer:

```text
конкретные даты
конкретный номер
конкретное размещение
конкретное питание
конкретные туристы
конкретная цена
конкретный источник
provider offer ID
```

External Provider может отдавать live Offer.

TravelHUB Catalog Supplier хранит/публикует Product, на основании которого при поиске формируется Offer.

---

# 12. LIVE EXTERNAL DATA

Для внешних поставщиков:

```text
Search
 ↓
External Provider
 ↓
Live Availability
 ↓
Live Price
 ↓
NormalizedHotelOffer
```

Live price внешнего источника не превращать автоматически в постоянную Catalog Price.

Если в проекте уже существует caching, использовать существующие правила TTL/invalidation.

---

# 13. TRAVELHUB HOTEL CATALOG

Внутренний поставщик должен работать через общий каталог:

```text
Supplier
 ↓
Hotel Product
 ↓
Publication
 ↓
Availability / Price
 ↓
Hotel Catalog Search
```

Каталог должен использовать существующую Catalog architecture.

Не создавать отдельный независимый Hotel Catalog, если общий Catalog уже поддерживает категории товаров.

Минимальные Hotel entities должны соответствовать текущей архитектуре проекта:

```text
Hotel
Hotel Category
Room Type
Accommodation
Meal
Availability
Price
```

---

# 14. ТЕСТОВЫЙ ПОСТАВЩИК TRAVELHUB

Для тестов обязательно иметь минимум одного реального Platform Supplier:

```text
Demo Hotel Supplier
```

Он должен пройти внутренний путь:

```text
Supplier
 ↓
Catalog
 ↓
Published Hotel Product
 ↓
Availability / Price
 ↓
Hotel Search
```

Не симулировать его через External Adapter.

Это необходимо для проверки обеих моделей источников.

---

# 15. ВНЕШНИЙ ПОСТАВЩИК ДЛЯ E2E

В E2E должен участвовать минимум один реально подключённый Hotel External Provider.

Например:

```text
Compass
```

только если его Hotel integration фактически доступна в текущем проекте.

Не создавать фиктивные ответы вместо реальной интеграции без явного обозначения mock/test режима.

---

# 16. ЕДИНЫЙ ПОИСК ДЛЯ ДВУХ ИСТОЧНИКОВ

Пользователь выполняет один:

```text
Hotel Search
```

а не отдельные поиски:

```text
TravelHUB Catalog Search
Compass Search
```

Orchestrator собирает:

```text
TravelHUB Catalog Offers
+
Compass Offers
+
Summer Offers
+
Kazunion Offers
+
Anex Offers
```

из доступных источников.

После normalization:

```text
NormalizedHotelOffer[]
```

возвращается единый результат.

---

# 17. SOURCE METADATA

Каждый Offer должен сохранять источник.

External:

```json
{
  "source": {
    "type": "EXTERNAL_PROVIDER",
    "providerId": "COMPASS"
  }
}
```

Catalog:

```json
{
  "source": {
    "type": "TRAVELHUB_CATALOG",
    "supplierId": "..."
  }
}
```

Source metadata используется для:

- booking;
- logging;
- analytics;
- reconciliation;
- supplier reporting;
- диагностики.

---

# 18. ОБЩАЯ ГЕОГРАФИЯ

Hotels должны использовать общий TravelHUB Geography:

```text
Country
  ↓
City
  ↓
Resort
  ↓
Hotel
```

Не создавать:

```text
HotelCountry
HotelCity
HotelResort
```

вместо общего справочника.

Все категории используют единую Geography architecture.

---

# 19. PROVIDER GEOGRAPHY MAPPING

Внешние поставщики имеют собственные IDs.

Например:

```text
Compass City ID
Summer City ID
Kazunion City ID
Anex City ID
```

Они должны сопоставляться с TravelHUB Geography:

```text
TravelHUB Geography
        ↕
Provider Geography Mapping
```

Provider-specific IDs не должны становиться отдельным глобальным справочником TravelHUB.

---

# 20. CATEGORY AVAILABILITY

Master Geography не должна зависеть от наличия конкретного предложения.

Например:

```text
Antalya
 ├── TOURS = available
 ├── HOTELS = available
 └── FLIGHTS = unavailable
```

Если Hotel Offers временно отсутствуют, Antalya не удаляется из Geography.

Должно разделяться:

```text
Master Geography
```

и:

```text
Category Availability
```

---

# 21. BOOKING

Общий flow:

```text
Search
 ↓
NormalizedHotelOffer
 ↓
Offer Details
 ↓
Booking
 ↓
Order
 ↓
Payment
```

Для External Provider:

```text
TravelHUB
 ↓
CompassHotelAdapter
 ↓
External Provider Booking
```

или соответствующий:

```text
SummerHotelAdapter
KazunionHotelAdapter
AnexHotelAdapter
```

Для Catalog Supplier:

```text
TravelHUB
 ↓
TravelHUB Booking
 ↓
Supplier Order / Supplier Workflow
```

Не смешивать эти два механизма.

---

# 22. ERROR ISOLATION

Если один внешний источник недоступен:

```text
Compass = ERROR
Summer = OK
Catalog = OK
```

Hotel Search не должен полностью падать.

Он должен вернуть доступные результаты, а ошибка provider должна быть:

- залогирована;
- диагностируема;
- отражена в соответствующем monitoring/error mechanism.

---

# 23. RATE LIMIT / SESSION / CAPTCHA

Если существующий Provider Layer уже работает с:

- sessions;
- cookies;
- authentication;
- rate limits;
- retry;
- CAPTCHA/anti-bot states;

не дублировать это внутри каждого Hotel Adapter.

Использовать общий Provider infrastructure.

Hotel Adapter занимается Hotel-specific запросом и преобразованием данных.

Не разрабатывать обход защит внешнего источника как часть этой задачи.

---

# 24. ДОБАВЛЕНИЕ НОВОГО EXTERNAL PROVIDER

Архитектура должна позволять:

```text
NewProvider
 ↓
NewProviderProvider Layer
 ↓
NewProviderHotelAdapter
```

без переписывания:

- Universal Search;
- HotelSearchRequest;
- NormalizedHotelOffer;
- Hotel Results UI;
- Geography;
- Booking framework.

---

# 25. ДОБАВЛЕНИЕ НОВОГО PLATFORM SUPPLIER

Новый зарегистрированный поставщик должен подключаться:

```text
Registration
 ↓
Supplier Account
 ↓
Catalog
 ↓
Hotel Products
 ↓
Publication
 ↓
Search
```

без создания:

```text
NewSupplierHotelAdapter
```

и без изменения Universal Search.

---

# 26. HOTEL SEARCH UI

Расширить существующий Universal Search.

Минимальные поля:

```text
Страна
Город
Курорт
Отель
Дата заезда
Дата выезда
Взрослые
Дети
Возраст детей
```

Не создавать второй самостоятельный поисковик.

---

# 27. HOTEL RESULTS

Минимально отображать:

```text
Отель
Категория
Страна
Город
Курорт
Дата заезда
Дата выезда
Ночей
Тип номера
Размещение
Питание
Цена
Валюта
```

Клик открывает конкретный Hotel Offer Details.

Дальше используется существующий booking flow.

---

# 28. BACKWARD COMPATIBILITY TOURS

После внедрения Hotels обязательно проверить:

```text
Tour Search
Tour Adapters
Provider Layer
Tour Booking
Marketplace
StoreFront
Catalog
Geography
```

Tours должны продолжать работать.

Если Provider Layer требуется рефакторить, изменения должны сохранять текущий Tour contract.

---

# 29. ЭТАПЫ РЕАЛИЗАЦИИ

## Phase 1 — Audit

Изучить текущий код и составить карту архитектуры.

## Phase 2 — Domain

Определить/переиспользовать:

```text
HotelSearchRequest
HotelSearchSource
NormalizedHotelOffer
Hotel Product
Hotel Offer
```

## Phase 3 — Provider Layer

Выделить только действительно общую provider infrastructure.

## Phase 4 — Hotel Adapters

Создать собственные:

```text
CompassHotelAdapter
SummerHotelAdapter
KazunionHotelAdapter
AnexHotelAdapter
```

для реально доступных внешних Hotel sources.

## Phase 5 — Catalog

Подключить внутренний:

```text
TravelHUB Hotel Catalog
```

## Phase 6 — Orchestrator

Создать/расширить:

```text
HotelSearchOrchestrator
```

## Phase 7 — Normalization

Привести все источники к:

```text
NormalizedHotelOffer
```

## Phase 8 — Universal Search UI

Добавить Hotels в существующий Universal Search.

## Phase 9 — Booking

Связать Hotel Offer с Order/Booking/Payment.

## Phase 10 — E2E

Проверить:

```text
Platform Supplier
+
External Provider
+
Unified Search
+
Offer Details
+
Booking
```

---

# 30. STRICT RULES

### НЕЛЬЗЯ

- использовать Tour Adapter для Hotels;
- переименовывать Tour Adapter в Hotel Adapter;
- создавать один adapter одновременно для Tours и Hotels;
- создавать отдельный adapter для каждого Platform Supplier;
- создавать отдельную Geography для Hotels;
- создавать отдельный Booking System;
- смешивать Product и Offer;
- отдавать provider-specific response во frontend;
- создавать фиктивные external integrations;
- ломать Tours ради Hotels;
- удалять Geography из master catalog из-за отсутствия временных Offers.

### ОБЯЗАТЕЛЬНО

- собственный Hotel Adapter для каждого внешнего Hotel Provider;
- общий Provider Layer;
- единый TravelHUB Geography;
- единый Hotel Search Contract;
- единый NormalizedHotelOffer;
- отдельный Catalog Search Source;
- единый HotelSearchOrchestrator;
- Source Metadata;
- live external offers;
- catalog offers;
- минимум один Platform Supplier;
- минимум один реальный External Provider в E2E;
- backward compatibility Tours.

---

# 31. ACCEPTANCE CRITERIA

## Architecture

- [ ] Provider Layer отделён от Category Adapter.
- [ ] Hotels имеют собственные adapters.
- [ ] Tour Adapters не используются для Hotels.
- [ ] Platform Supplier не требует Adapter.
- [ ] Catalog является отдельным Search Source.

## External Providers

- [ ] CompassHotelAdapter реализован, если Compass предоставляет Hotel source.
- [ ] SummerHotelAdapter реализован, если Summer предоставляет Hotel source.
- [ ] KazunionHotelAdapter реализован, если Kazunion предоставляет Hotel source.
- [ ] AnexHotelAdapter реализован, если Anex предоставляет Hotel source.
- [ ] Общая Provider infrastructure переиспользуется.
- [ ] Нет ненужного дублирования HTTP/session/auth логики.

## Catalog

- [ ] Platform Supplier может создавать Hotel Products.
- [ ] Products могут публиковаться.
- [ ] Catalog Search возвращает Hotel Offers.
- [ ] Для каждого Platform Supplier не требуется отдельный Adapter.

## Search

- [ ] Есть единый HotelSearchRequest.
- [ ] Есть HotelSearchOrchestrator.
- [ ] External Offers нормализуются.
- [ ] Catalog Offers нормализуются.
- [ ] Оба типа Offers могут присутствовать в одном поиске.
- [ ] Frontend получает единый формат.

## Geography

- [ ] Используется единый Geography.
- [ ] Country → City → Resort → Hotel поддерживается.
- [ ] Provider IDs сопоставляются с TravelHUB Geography.
- [ ] Category Availability не удаляет Geography.
- [ ] Hotel Search использует актуальную доступность.

## Booking

- [ ] Source сохраняется до booking.
- [ ] External Offer идёт в соответствующий Provider booking flow.
- [ ] Catalog Offer идёт в TravelHUB/Supplier booking flow.
- [ ] Используется существующая Order/Payment architecture.

## Resilience

- [ ] Ошибка одного provider не ломает весь поиск.
- [ ] Ошибки provider логируются.
- [ ] Общая session/rate-limit/retry infrastructure переиспользуется.

## E2E

- [ ] Создан минимум один Platform Supplier.
- [ ] У него есть опубликованные Hotel Products.
- [ ] Подключён минимум один реальный External Hotel Provider.
- [ ] Один Search возвращает результаты обоих типов источников.
- [ ] Проверена нормализация.
- [ ] Проверена карточка Offer.
- [ ] Проверен Booking.
- [ ] После изменений Tours продолжают работать.

---

# 32. ФИНАЛЬНЫЙ АРХИТЕКТУРНЫЙ ПРИНЦИП

TravelHUB должен прийти к следующей модели:

```text
                         HOTEL SEARCH
                              │
                 HotelSearchOrchestrator
                              │
             ┌────────────────┴────────────────┐
             │                                 │
             ▼                                 ▼
      EXTERNAL PROVIDERS                TRAVELHUB CATALOG
             │                                 │
       ┌─────┼─────┐                           │
       │     │     │                           │
    Compass Summer Kazunion                   │
       │     │     │                           │
       ▼     ▼     ▼                           ▼
    Hotel   Hotel  Hotel                   Suppliers
   Adapter Adapter Adapter                     │
       │     │     │                           │
       └─────┼─────┘                           │
             │                                 │
            Anex                               │
             │                                 │
      AnexHotelAdapter                         │
             │                                 │
             └───────────────┬─────────────────┘
                             ▼
                  NormalizedHotelOffer[]
                             │
                             ▼
                      Unified Results
                             │
                             ▼
                          Booking
```

### Главные правила

**Внешний источник → собственный Hotel Adapter.**

**Tour Adapter → только Tours.**

**Platform Supplier → TravelHUB Catalog, без отдельного Adapter.**

**Provider Layer → общая техническая инфраструктура конкретного внешнего источника.**

**Universal Search → единая точка поиска.**

**Geography → единый справочник TravelHUB.**

**Offer → единая нормализованная модель независимо от источника.**

**Booking → определяется источником конкретного Offer.**

# END
