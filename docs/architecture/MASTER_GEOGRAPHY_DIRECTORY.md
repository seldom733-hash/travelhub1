# Master Geography Directory & Marketplace Availability

**Дата фиксации:** 2026-09-14
**Статус:** DECISION: ACCEPTED | IMPLEMENTATION: NOT STARTED
**Входит в:** TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md (дополнение)

---

## 1. Canonical Hierarchy

```
Country
  └── City
        └── Resort
```

Это **canonical hierarchy** TravelHub для Master Geography Directory.

Уровни:
- **Country** — верхний уровень (обязателен)
- **City** — дочерний уровень Country (обязателен)
- **Resort** — дочерний уровень City (условный)

---

## 2. Country

Country — верхний уровень Master Geography Directory.

Свойства:
- `id` — canonical stable ID (ISO 3166-1 alpha-2, 2-letter code)
- `name` — локализованные названия {ru, az, en} + расширяемые
- `slug` — URL-safe slug
- `status` — active / inactive

Примеры из текущего `COUNTRY_NAMES`:
```
TR → Турция
AE → ОАЭ
AZ → Азербайджан
GE → Грузия
RU → Россия
DE → Германия
US → США
GB → Великобритания
FR → Франция
IT → Италия
ES → Испания
KZ → Казахстан
UZ → Узбекистан
```

---

## 3. City

City является дочерней сущностью Country.

```
Country → City
```

Свойства:
- `id` — canonical stable ID (cityCode, UPPERCASE_SNAKE)
- `countryId` — ссылка на parent Country (обязательна)
- `name` — локализованные названия {ru, az, en}
- `slug` — URL-safe slug
- `status` — active / inactive
- `isResort` — boolean, может ли город одновременно быть курортом

Текущий `CITY_REF` — пример canonical city reference:
```
ANTALYA    → Country: TR
ISTANBUL   → Country: TR
BAKU       → Country: AZ
TBILISI    → Country: GE
DUBAI      → Country: AE
```

---

## 4. City-as-Resort

**Критически важно:** город может одновременно быть курортом.

Пример:
```
Turkey
└── Antalya
    City.isResort = true
```

Antalya в таком случае сама является resort-level geography.

**Запрещено** создавать искусственную дублирующую запись:
```
Antalya
└── Antalya
```

Использовать `isResort=true` или эквивалентную canonical domain semantics.

---

## 5. Resort

Если Resort отличается от City:

```
Turkey
└── Antalya
    ├── Belek
    ├── Kemer
    └── Side
```

Свойства:
- `id` — canonical stable ID
- `cityId` — ссылка на parent City
- `name` — локализованные названия
- `slug` — URL-safe slug
- `status` — active / inactive

---

## 6. Publication Geography Rules

### Country
Всегда обязателен при публикации услуги.

### City
Всегда обязателен при публикации услуги.

### Resort
Необязателен. Используется только если бизнес-семантика услуги требует resort-level specificity.

Если City является city-as-resort (`isResort=true`), City автоматически удовлетворяет resort-level requirement. Duplicate Resort не требуется.

---

## 7. Canonical IDs

Все связи Product с географией используют canonical geography IDs.

**Не использовать** как единственный domain reference:
- свободный текст
- countryName / cityName / resortName
- локализованное название
- slug

**Slug и names** — presentation/search attributes.
**Canonical ID** — domain reference.

Текущая реализация в `locations.ts`:
```typescript
// countryCode — ISO 3166-1 alpha-2 (системная identity)
// cityCode — UPPERCASE_SNAKE (канонический справочник)
```

---

## 8. Master Geography Directory

Master Geography Directory — platform-level master data domain.

Ориентировочный initial scale:
```
100+ Countries
2000+ Cities
3000+ Resorts
```

Это ориентир initial dataset, не hard limit. Directory должен быть расширяемым.

Текущий `CITY_REF` в `locations.ts` содержит 25 городов — это статический onboarding reference, не полный Directory.

---

## 9. Master Geography ≠ Marketplace Availability

**Обязательное решение:**

> Master Geography Directory содержит полную каноническую географию TravelHub.
> Marketplace Availability определяется наличием опубликованных Marketplace Products
> и **не является** ручным свойством Master Geography Directory.

Модель:
```
MASTER GEOGRAPHY
        │
        │ canonical references
        ▼
PUBLISHED MARKETPLACE PRODUCTS
        │
        ▼
MARKETPLACE AVAILABILITY
```

Не создавать ручные availability flags как второй source of truth.

---

## 10. Dynamic Marketplace Availability

Availability выводится из:
```
Product
+
PUBLISHED status
+
MARKETPLACE publication channel
+
canonical geography references
```

Пример:
```
Hotel: "Rixos Belek"
  Country: TR (Turkey)
  City: ANTALYA
  Resort: BELEK
  Status: PUBLISHED
  Channel: MARKETPLACE

→ Turkey  = AVAILABLE
→ Antalya = AVAILABLE
→ Belek   = AVAILABLE
```

---

## 11. Cascade Availability

Если существует:
```
Turkey → Antalya → Belek
```

то продукт доступен при выборе:
```
Turkey
Turkey → Antalya
Turkey → Antalya → Belek
```

Наличие leaf-level продукта делает доступными соответствующие ancestor levels.

---

## 12. Resort Not Specified

Если продукт:
```
Turkey → Antalya
Resort = null
```

то:
```
Turkey  = AVAILABLE
Antalya = AVAILABLE
```

Но это **НЕ** делает автоматически доступными:
```
Belek, Kemer, Side
```

City-level product не означает product availability во всех дочерних Resort.

---

## 13. City-as-Resort Availability

Если `Antalya.isResort = true` и опубликован продукт:
```
Turkey → Antalya
```

Antalya может одновременно удовлетворять City-level и Resort-level semantics. Duplicate Resort не требуется.

---

## 14. Last Marketplace Product

Если последний Marketplace Product для:
```
Turkey → Antalya → Belek
```
становится unpublished/archived/deleted:
```
Belek = NOT MARKETPLACE AVAILABLE
```
если других published Marketplace Products для Belek нет.

Но:
```
Belek EXISTS IN MASTER DIRECTORY
```

Master Directory не удаляется при отсутствии продуктов.

---

## 15. «Направления» Navigation

Header navigation **«Направления»** является иерархической навигацией Master Geography Directory:

```
Направления
    ↓
Country
    ↓
City
    ↓
Resort
```

Это **НЕ** Popular Destinations.

Popular Destinations — отдельный presentation/analytics concept, не является Master Directory и не заменяет Directions.

---

## 16. «Направления» → Product Catalog

Выбор:
```
Turkey → Antalya → Belek
```

ведёт в **Product Catalog** с соответствующим geographic filter.

Product Catalog показывает опубликованные Marketplace services, соответствующие выбранной географии.

---

## 17. Product Catalog — Actual Storefront

> Home является prelude/landing перед каталогом.
> **Product Catalog является фактической витриной/магазином TravelHub.**

Не создавать отдельный независимый geography catalog внутри Product Catalog.

---

## 18. Partner Service Registration Geography

Партнёр выбирает географию через Master Geography Directory:

```
Country: [ Turkey ]
City: [ Antalya ]
Resort: [ Belek ]
```

City зависит от Country. Resort зависит от City.

Если City является city-as-resort — duplicate Resort не создаётся.

Backend повторно валидирует hierarchy.

---

## 19. Backend Validation

Минимальная валидация:
```
countryId exists
cityId exists
city.countryId == countryId
```

Если указан Resort:
```
resortId exists
resort.cityId == cityId
```

Если city-as-resort:
```
city.isResort == true → может удовлетворять resort-level requirement
```

Frontend validation недостаточна. Backend является authoritative.

---

## 20. Search

Global Search и service-specific Search используют Master Geography Directory.

Поиск должен уметь находить:
- Country
- City
- Resort

Результаты возвращают canonical IDs:
```json
{
  "type": "CITY",
  "id": "ANTALYA",
  "countryId": "TR",
  "name": "Antalya"
}
```

---

## 21. Travel Requests

Travel Request сохраняет географию через canonical references:
```
serviceType
countryId
cityId
resortId
```

Localized names могут быть получены из Master Directory.

---

## 22. Analytics

Analytics использует Master Geography как canonical dimension.

Различать:

| Концепция | Определение |
|-----------|-------------|
| **Master Geography** | Что существует в Directory |
| **Demand** | Что пользователи ищут, просматривают, запрашивают, бронируют |
| **Marketplace Supply** | Что партнёры публикуют |
| **Marketplace Availability** | Что реально доступно сейчас |

Не смешивать эти понятия.

---

## 23. Popular Destinations

Popular Destinations — отдельный presentation/analytics concept.

Он:
- **не** является Master Directory
- **не** является источником geography
- **не** заменяет Directions

Нельзя строить Master Directory из Popular Destinations.

---

## 24. Partner Storefront Separation

Partner Storefront остаётся отдельным channel/domain concept.

Не смешивать:
```
Marketplace Availability  ↔  Partner Storefront presentation
```

Общий Master Geography может использоваться обоими доменами, но channel semantics остаются отдельными.

---

## 25. Source-of-Truth Matrix

| Domain | Source of Truth |
|--------|----------------|
| Country / City / Resort existence | Master Geography Directory |
| Geography hierarchy | Master Geography Directory |
| Geography identity | Canonical Geography IDs |
| Localized geography names | Master Geography Directory |
| Marketplace product existence | Product + Marketplace Publication |
| Marketplace availability | Published Marketplace Products |
| Partner service geography | Canonical Geography IDs |
| Search geography | Canonical Geography IDs |
| Travel Request geography | Canonical Geography IDs |
| Analytics geography dimension | Master Geography IDs |

---

## 26. What NOT to Create

Без отдельного архитектурного обоснования **не создавать**:
- `MarketplaceCountry` / `MarketplaceCity` / `MarketplaceResort` как копии Master Geography
- `isAvailableInMarketplace` как ручной source of truth
- `Antalya → Antalya` как duplicate Resort
- Popular Destinations как Directions
- Свободный текст как canonical geography reference

---

## 27. Current Implementation State

### Что уже реализовано
- `COUNTRY_NAMES` — статический справочник 13 стран (locations.ts)
- `CITY_REF` — статический справочник 25 городов (locations.ts)
- `countryCode` / `cityCode` — используются в Partner, PublicSellerProfile, PartnerStorefront
- `destinations` JSONB — в SellerCapability и BuyerRequest
- `normalizeDestinations` — серверная валидация destinations
- `assertValidCityForCountry` — валидация city belongs to country

### Что НЕ реализовано ( deferred )
- Полноценный Prisma Country/City/Resort models
- Resort-level entities
- City.isResort flag
- Dynamic Marketplace Availability computation
- Master Geography admin UI
- Geography API (CRUD)
- Geography search indexing
- Geography analytics aggregation
- Import 100+ countries / 2000+ cities / 3000+ resorts

---

## 28. Future Implementation Requirements

Следующий implementation stage отдельно определит:
- Prisma models (Country, City, Resort)
- Relations и indexes
- Unique constraints
- Localization strategy
- Slug strategy
- Import/seed
- Admin management
- Geography API
- Partner selectors
- Product Catalog filters
- Availability query strategy
- Caching
- Search indexing
- Analytics aggregation

Все эти решения должны соответствовать настоящей architecture semantics.

---

## 29. Non-Goals of This Document

Эта фиксация **НЕ** утверждает:
- конкретную физическую DB schema
- production code changes
- Product model changes
- Marketplace API changes
- Product Catalog implementation
- Header UI / Directions UI
- Geography admin UI
- Import datasets
- Search implementation
- Analytics implementation

Это **architecture documentation update** — фиксация уже принятых решений.

---

## 30. Home / Витрина / Catalog Search Reconciliation (2026-09-14)

**DECISION: ACCEPTED | IMPLEMENTATION: CODE CHANGES APPLIED**

### Canonical UX Model

```
HOME (prelude/landing)
  ↓
Header → Витрина (one entry)
  ↓
CANONICAL ВИТРИНА / Product Catalog
  ↓
Catalog Search / Filters (Master Geography + Service Type + Dates + Travelers)
  ↓
Published Marketplace Products
```

### Home

Home — prelude/landing page. На Главной НЕ должно быть полноценного Catalog Search/Filter Block.

Остаётся: Global Search (Header), Hero, контентные блоки, Footer.

Home Search Block **удалён** из active Constructor Structure/Content/Draft/Published.

### Header

Один пользовательский entry: **«Витрина»** → `/search`.

`Направления` — НЕ отдельный Header entry (география становится частью фильтра Витрины).

`Предложения` — НЕ отдельный Header entry (предложения являются содержимым Витрины).

`Услуги` — dropdown с категориями услуг (остаётся).

`Для партнёров` — отдельная ссылка (остаётся).

### Витрина / Product Catalog

Единая canonical public Витрина. Точки входа:
1. `Header → Витрина` — чистая Витрина (Услуга = Все, без фильтров)
2. `Home block → Показать все` — Витрина с initial service filter
3. `Global Search` — может открывать Витрину с поисковым context

### Catalog Search / Filters

Фильтры располагаются на странице Витрины, над результатами.

Общие фильтры:
- Услуга
- Страна → Город → Курорт (Master Geography)
- Дата начала / окончания
- Туристы (взрослые + дети с возрастами)

Динамические service-specific фильтры отображаются после выбора услуги.

### Default Sorting

Единый default: **Новые поступления** (`publishedAt DESC`).

### Global Search

Сохраняется. Быстрый универсальный поиск. Не заменяет Catalog Search.

### Master Geography в каталоге

Country → City → Resort. Country required. City required. Resort optional. City-as-Resort supported.

### Marketplace Availability

Динамический вывод из: Product + PUBLISHED + MARKETPLACE + canonical geography.

### Product Catalog Implementation

Следующий продуктовый implementation stage. В текущем run НЕ реализуется.

---

*Authoritative reference: `backend/src/modules/catalog/seller/locations.ts` (current static reference)*
*Architecture: `docs/architecture/TRAVELHUB_CURRENT_CANONICAL_ARCHITECTURE.md`*
