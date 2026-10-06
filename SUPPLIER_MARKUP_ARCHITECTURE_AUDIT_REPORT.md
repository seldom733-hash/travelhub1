# SUPPLIER CAPABILITIES & MARKUP ARCHITECTURE AUDIT

**Mode:** READ-ONLY ARCHITECTURE AUDIT (`docs/prompts`-задание «SUPPLIER CAPABILITIES & MARKUP ARCHITECTURE AUDIT»)
**Repository:** `seldom733-hash/travelhub1` · **Дата:** 2026-10-05
**Implementation:** FORBIDDEN — код, БД, миграции, конфигурация, UI не изменялись; commit/push не выполнялись.

Обозначения: **Факт** — проверено по коду/схеме с file:line. **Предположение** — логический вывод, требующий подтверждения. **Рекомендация** — проектное предложение (не реализация).

---

## 1. Executive Summary и общий вердикт

**Факты:**

1. В репозитории **нет ни одного механизма наценки/margin** — grep `markup|margin|oncharge` по `backend/src`, `frontend/`, `docs/architecture` даёт только CSS/HTML-значения и маркетинговые строки («без скрытых наценок» — `frontend/lib/i18n.tsx:191,224`). Ценовой контур идёт от поставщика в публичную цену **без модификатора**.
2. Единственный коммерческий механизм поверх выручки — **комиссия TravelHUB** (`CommissionPolicy` `schema.prisma:4559-4586`, `CommissionService` `finance/commission.service.ts:58+`), независимый от предлагаемой наценки. Он должен остаться нетронутым (§8).
3. Supplier Capabilities **не имеют единого источника истины** — как минимум 4 разрозненных хранилища (§3): реестр регистраций в `supplier.module.ts`, статическая матрица `CAPABILITIES` в `supplier-aggregator.service.ts:143-191`, дубли bounds внутри адаптеров, гео-карты. **Дублирование перечней поставщиков и услуг подтверждено** (19 хардкод-списков, §3).
4. Дополнительный тип услуги Anex установлен точно: **`hotels`** (`serviceTypes: ["hotels"]`, `AnexHotelAdapter`, upstream `SEARCH_TYPE=PACKET_ONLY_HOTELS`) — цены живут в Universal Search, публичная витрина его не показывает (§5).
5. **`refreshSupplierPrice`, календарь цен и проверка доступности СУЩЕСТВУЮТ** (бэкенд-имена `refreshPrice` / `getPriceCalendar` / `refreshAvailability`, `supplier-offer.service.ts:182/239/214`), но re-check цены — только по инициативе UI; серверной периодической/сквозной перепроверки нет (§6).
6. Модель скидок существует только как поля `Quote/Sale/CheckoutIntent/Order` (`QuoteDiscountType` `schema.prisma:3627`, `Order.discount*` `:2185-2187`) **без UI**; Live Sales как модуль отсутствует (0 совпадений по `live.?sales|operator.?quote`); WhatsApp создаёт только переписку, не заказы (`integrations/whatsapp/inbound/inbound.service.ts:237,643`) — все ручные продажи сходятся в цепочку Request → Order, что **идеально для индивидуальной скидки** (§11).
7. Ошибка `Request has no accepted price/currency; conversion requires commercial terms` воспроизведена и объяснена: `customerAccept` замораживает `confirmedPrice = supplierPriceProposal ?? displayedPrice` без проверки на null (`request.service.ts:673`), execution-гейт требует деньги (`order.service.ts:658-661`) (§12).
8. Обнаружен побочный дефект RBAC: эндпоинты `supplier.controller.ts` используют **незаявленные** права `supplier.search.read/manage` (в `PERMISSIONS` их нет, `permissions.constants.ts:8,299`; guard fail-closed `permissions.guard.ts:38-40`) → все аутентифицированные supplier-эндпоинты возвращают 403 всем ролям включая ADMIN. Фронтонт не задет — он ходит в анонимные `public/supplier/*` (`public-supplier.controller.ts:185-309`).

**Вердикт (детально §18):** `READY FOR IMPLEMENTATION DESIGN` — целевая модель встраивается в существующие механизмы (реестр адаптеров, деньги `sales.money.ts`, master-data-паттерн `CommissionPolicy`, цепочка Request→Order) без второй commerce-engine и без изменений `CommissionPolicy`. Открытые вопросы требуют решения владельца (§17), но не блокируют сам проект.

---

## 2. Фактическая матрица поставщиков и поддерживаемых услуг

**Факт.** Реестр регистраций — `supplier.module.ts:74-213` (factory-провайдер `"SUPPLIER_MODULE_INIT"`).

| Поставщик | id (code) | Имя в реестре | Adapter-файлы | `serviceTypes` | Live-цены | `refreshPrice` | `refreshAvailability` | Price calendar | Гео-ingest | Каталожный sync | Universal Search | Статичная витрина | Тех. долги |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Summer | `SUMMERTOUR` | `Summertour` | `summertour/summertour-new.adapter.ts:58` (+ легаси `summertour.adapter.ts:29` — **не регистрируется**, `supplier.module.ts:78,87`) | `["tours"]` (`:90`) | да (Playwright XHR, `livePriceEnabled:true` `:93`) | `:459` | `:473` | `:487` (реальный) | `discoverGeoOptions:1004` | да (`summer-sync.service.ts:96`; bulk `summer-bulk-sync.service.ts:49`) | да (`search-all`) | да (sync-карточки, `attributes.supplierCode:"SUMMERTOUR"` `summer-sync.service.ts:428`) | легаси-дубль адаптера; env `SUMMERTOUR_CAPTCHA_SOLVE_ROUNDS` не в `.env.example` |
| Kompas | `KOMPAS` | `Kompas Tour` | `kompas/kompas.adapter.ts:66` | `["tours"]` (`:115`) | да (Playwright, `:118`) | `:1859` | `:1901` | `:1979` (реальный) | `:1447` | да (`kompas-sync.service.ts:54`) | да | да (`supplierCode:"KOMPAS"` `kompas-sync.service.ts:223`) | nights 3–14 продублированы в адаптере (`kompas.adapter.ts:62-63`) и в `CAPABILITIES` (`supplier-aggregator.service.ts:149`) |
| Anex (туры) | `ANEX` | `ANEX` | `anex/anex.adapter.ts:106` + `anex.provider.ts` | `["tours"]` (`:162`) | да (REST `webapi.anextour.az`, `anex.provider.ts:23`) | `:390` | `:405` (default `"UNKNOWN"` `:677-678`) | `:417` (реальный) | `:592` | **нет** (нет записей в `prisma.product`) | да | **нет** | `getOffer/refreshPrice` при ненайденном оффере возвращают фейковый `amount:0` (`:366-387,396-402`) |
| **Anex (отели) — доп. тип услуги** | `ANEX` (2-я регистрация) | `ANEX` | `anex/anex-hotel.adapter.ts:159` | **`["hotels"]` (`supplier.module.ts:191`)** | да (`SEARCH_TYPE=PACKET_ONLY_HOTELS` `:73`) | `:463` | `:478` | `:492` — **честный пустой стаб** (`:488-511`) | отдельный `ingestAnexHotels` (`supplier-geo-ingest.service.ts:205`) | нет | **да** (hotels-вкладка, live=1) | **нет** (см. §5) | fallback `amount:0` (`:438-461`) |
| KazUnion | `KAZUNION` | `KazUnion` | `kazunion/kazunion.adapter.ts:120` | `["tours"]` (`:138`) | да (REST, `kazunion-http.service.ts:9-18`) | `:345` | `:360` | `:370` (реальный) | `:207` | да (`kazunion-sync.service.ts:73`) | да | да (`supplierCode:"KAZUNION"` `kazunion-sync.service.ts:285`) | captcha/антибот роняет весь поиск (`:307-311`); OCR-скрипты вне TS (`backend/scripts/kazunion-captcha-ocr.py`) |
| AZAL | `AZAL` | `AZAL` | `azal/azal.adapter.ts:36` (**`FlightSupplier`**, не `SupplierAdapter`) | рейсы (нет `serviceTypes`; отдельный `FlightSupplierRegistry` `supplier.module.ts:209`) | да (Playwright/CDP против Cloudflare, `azal.http.service.ts:628,732`) | **нет метода** (интерфейс `FlightSupplier` его не содержит — `flight.supplier.ts:8-17`) | нет | `calendar:154` (реальный) + `histograms:183` (AZAL-only) | нет | **нет** («No Prisma changes and no Catalog writes» — `azal/IMPLEMENTATION.md:23`) | да (`POST /supplier/azal/search`) | нет | требует пользовательский Chrome (`AZAL_CHROME_CDP_URL`), ручные ожидания Cloudflare (`azal.http.service.ts:176-184`) |
| Aviasales | `AVIASALES` | `Aviasales` | `aviasales/aviasales.adapter.ts:28` (`FlightSupplier`) | рейсы (`supplier.module.ts:213`) | да (fetch start/poll, `aviasales.http.service.ts:6-18`) | нет | нет | `calendar:102` — **стаб** (`:97-115`, `prices:{}`) | нет | нет | да (fan-out в том же `azal.controller.ts:46-56`) | нет | зарегистрирован под путём `@Controller("supplier/azal")` (`azal.controller.ts:24`) — naming-debt |

**Поддерживаемые типы услуг фактически — только три: `tours`, `hotels`, `flights`.** Каталоговые типы `SANATORIUM/TRAIN/EXCURSION/GUIDE/TRANSFER/PHOTOGRAPHER` (`ProductType` `schema.prisma:279-291`) приходят из статичного каталога/партнёрских карточек, **не из интеграций**. Cruises/insurance/visas у поставщиков отсутствуют (0 совпадений в `backend/src/modules/supplier`). Перечень в задании исчерпывающим не является — проверено.

**Операции по всем тур-адаптерам:** `search/getOffer/refreshPrice/refreshAvailability/getPriceCalendar` реализованы (интерфейс `SupplierAdapter` `supplier.types.ts:228-257`); **booking-метода в интерфейсе нет** — создаётся только Request (`tour-request.service.ts:23-132`, публичный `POST /public/supplier/create-request` `public-supplier.controller.ts:287`).

---

## 3. Архитектура Supplier Capabilities

**Факт: единого источника истины НЕ существует.** Четыре независимых, вручную поддерживаемых хранилища:

| # | Хранилище | Location | Что хранит |
|---|---|---|---|
| 1 | Конфигурация регистраций | `supplier.module.ts:87-213` → `SupplierConfig` (`supplier.types.ts:271-302`: `serviceTypes:279`, `enabled`, `searchEnabled`, `livePriceEnabled`, `availabilityEnabled`, лимиты) | **кто обслуживает какую услугу** — единственный источник для выборки в агрегаторе (`supplier-aggregator.service.ts:393,440-447`) |
| 2 | Статическая матрица возможностей | `private static readonly CAPABILITIES` `supplier-aggregator.service.ts:143-191` (KOMPAS/SUMMERTOUR/KAZUNION/ANEX + `services.hotels` override `:176-189`) | страны/nights/children; **AZAL/AVIASALES отсутствуют**; неизвестный поставщик → `return true` (оптимистичный дефолт, `:210`) |
| 3 | Дубли bounds внутри адаптеров | `kompas.adapter.ts:62-63,236-245`; `anex.adapter.ts:55-56`; `anex-hotel.adapter.ts:81-82`; `kazunion.adapter.ts:262-263` | те же ограничения, что и в (2) — рассинхрон возможен |
| 4 | Гео/STATE-карты + DB | `supplier-geo-ingest.service.ts:293-304`; `anex.provider.ts:16`; `SupplierGeoLink` (`schema.prisma:5486-5506`) | маппинг внешних geo-id → Master Geography |

**Дополнительно:** `model Supplier` (`schema.prisma:1967-1976`, `@@schema("crm")`) — **CRM-сущность**, читается только `crm.service.ts:659,664`; модуль `modules/supplier` её не использует. `SupplierOffer` в БД не.persist-ится (in-memory кэш, `cache/supplier-cache.service.ts:24-27`). Единственный DB-перекрёстный слой — `SupplierGeoLink`.

**Доказанное дублирование перечней (19 хардкод-списков):**
- backend: `supplier.module.ts:87-213` (регистрации), `supplier-aggregator.service.ts:143-191` (CAPABILITIES), `supplier-geo-ingest.service.ts:293-304` (STATEINC), `kompas-captcha.store.ts:14` (`type CaptchaSupplier = "KOMPAS"|"SUMMERTOUR"`), `kompas-captcha.controller.ts:26,51,124,140,162,218`, `supplier.controller.ts:37,48,56,68` (sync-эндпоинты на поставщика), `anex.provider.ts:16`, `run-geo-ingest.ts:15`, `geo-availability.service.ts:8` (список услуг), `constructor/block-registry.ts:49`, `constructor/constructor.service.ts:161-166`.
- frontend: `TourResultsTable.tsx:21-26` (`SUPPLIER_LABELS`), `TourDetail.tsx:62,237-243`, `OfferDetailsModal.tsx:163-168`, `OfferModal.tsx:138,142,185` (`?? "KOMPAS"`), `supplier-api.ts:153,160,167`, `useKompasCaptcha.ts:15`, `KompasCaptchaModal.tsx:20,30`, `FlightSearch.tsx:196-197` (жёсткие `<option>` AZAL/AVIASALES), комментарии `search/page.tsx:94-96,242-243`, `HeroSearch.tsx:103-104`.

**Рекомендация (архитектура без ручного дублирования), опираясь на существующие компоненты:**

1. **Источник истины = реестр регистраций.** Матрица `Supplier × ServiceType` вычисляется в рантайме из `SupplierAdapterRegistry.getEntries()` (`supplier-adapter.registry.ts:89-91`, возвращает `{adapter, config}` с `config.serviceTypes`) ∪ `FlightSupplierRegistry.list()` (`flight-supplier.registry.ts:39`, для рейсов услугу считать равной `"flights"`). Уже сейчас публичный `GET /public/supplier/suppliers` (`public-supplier.controller.ts:216-220`) отдаёт реестр — фронтенд-перечни (label-карты) должны потреблять его, а не хранить локально.
2. **Перенести `CAPABILITIES` (страны/nights/children) в конфигурацию регистрации** (`SupplierConfig` — поле `capabilities?`) либо в DB (как `SupplierGeoLink`) — убрать второй источник. Оптимистичный `return true` (`supplier-aggregator.service.ts:210`) оставить как documented default для новых поставщиков.
3. **Не вводить таблицу `Supplier`-возможностей в CRM** — `model Supplier` уже занят и не связан с интеграциями; переиспользовать его = ложная связь.
4. Для синхронизации label/описаний фронтенда — расширить существующий `GET /public/supplier/suppliers` (выражает фактические регистрации, включая `ANEX×hotels`).

---

## 4. Фактические типы услуг и маппинг

**Факт: единого канонического `ServiceType` НЕ существует.** Обнаружено ≥10 параллельных словарей:

| Слой | Значения | Location |
|---|---|---|
| Prisma (канон каталога) | `ProductType = TOUR,HOTEL,SANATORIUM,FLIGHT,TRAIN,EXCURSION,GUIDE,TRANSFER,PHOTOGRAPHER` | `schema.prisma:279-291`; `Product.type` `:356` |
| Legacy Prisma | то же, именованное `ServiceType` (9 значений) | `legacy/prisma/schema.prisma:12-22` (`Service.type:185`, `OrderItem.type:342`) |
| Backend DTO | `@IsEnum(ProductType)` | `catalog/catalog.controller.ts:29-31` |
| Supplier-адаптеры | `"tours"|"hotels"` (union + `string`) | `supplier.types.ts:12,110,275-279`; `supplier-aggregator.service.ts:51` (`SupplierServiceType`) |
| Регистрации | `serviceTypes: ["tours"]` / `["hotels"]` | `supplier.module.ts:90,115,138,162,191` |
| Universal Search (backend) | **невалидируемая строка** `service` | `public-supplier.controller.ts:155` |
| Universal Search (frontend) | 10 kebab-значений `tours hotels flights sanatoriums guides excursions transfers car-rental railway cruises` | `search-engine.ts:6-16`; `VALID_SERVICES` `search/page.tsx:26-30`; табы `HeroSearch.tsx:27-36` |
| service → catalog-категория | `tours→"tours"`, `hotels→"accommodation"` и др. | `search/page.tsx:319` |
| Канон-слаги категорий (18) | `tours accommodation excursions … visa-services …` | `catalog/canonical-categories.ts:161-179` |
| slug → ProductType | `accommodation→HOTEL`, `sanatoriums→SANATORIUM`, default `TOUR` | `partner/products/new/page.tsx:13-15` |
| Geo-маппер (единственный серверный) | `GEO_SERVICE_CATEGORIES=["tours","hotels","flights"]`, `SERVICE_PRODUCT_TYPE={tours:"TOUR",hotels:"HOTEL",flights:"FLIGHT"}` | `geo/geo-availability.service.ts:8,11-15` |
| Public DTO | `type: ProductType` | `public-catalog.types.ts:12,98,153` |
| Frontend API-клиент | `type: string` (без union) | `public-api.ts:45,62,99,117` |
| Request | тип поля **нет**; `productSnapshot.productType` (JSON) | `request.service.ts:99,107,235`; `schema.prisma:2419` |
| Order | `OrderItem.type String` (`?? "SERVICE"` fallback — значения нет ни в одном enum) | `order.service.ts:512,731`; `schema.prisma:2274` |
| Pricing-модули | привязка к типу — `TaxRule.productType String?` | `schema.prisma:4670` |

**Выводы:**
- **Факт:** ближайший контрактный канон — `ProductType` (единственный enum с `@IsEnum`-валидацией). Поставщики используют свой нижнерегистровый словарь (`tours/hotels/flights`), фронтенд — kebab-словарь из 10 значений; связывают их только **три разрозненных маппера** (`geo-availability.service.ts:11-15`, `search/page.tsx:319`, `partner/products/new/page.tsx:13-15`).
- **Рекомендация:** не вводить новые enum (запрет §5 задания выполнен — ничего не введено). Для матрицы наценок ключ `serviceType` хранить в **нижнерегистровом поставщицком словаре** (`tours|hotels|flights`), поскольку матрица оперирует регистрациями адаптеров, и добавить **единый shared-маппер** (server-side helper + frontend-типы), заменяющий три существующих разрозненных — существующие значения не переименовывать.
- **Расхождения (Факт):** `ProductCard` иконки ключуются по `ACCOMMODATION/RAIL`, которых нет в `ProductType` (`ProductCard.tsx:12-29,41`); nav-слаги `experiences/wellness/gastronomy` ≠ каноническим (`MarketplaceHeader.tsx:76-82`); `OrderItem.type` может быть `"SERVICE"`.

---

## 5. Дополнительный тип услуги Anex

**Факт — установлено точно:**

| Параметр | Значение | Evidence |
|---|---|---|
| Название | **«Отели» / hotels** | — |
| Технический идентификатор | **`serviceTypes: ["hotels"]`** на adapter code **`"ANEX"`** | `supplier.module.ts:188-191` |
| Класс | `AnexHotelAdapter implements SupplierAdapter`, `code = "ANEX"` | `anex/anex-hotel.adapter.ts:159-160` |
| Upstream-протокол | `SEARCH_TYPE = "PACKET_ONLY_HOTELS"` (vs туров `PACKET_TOUR` `anex.adapter.ts:53`), `STATEFROM="16"`, `TOWNFROM="1"` | `anex-hotel.adapter.ts:73,75,77` |
| Стамп оффера | `service: "hotels"` (единственный адаптер, стампящий `service`; поле `SupplierOffer.service` `supplier.types.ts:109-114`) | `anex-hotel.adapter.ts:440,543` |
| Модель Provider→Category-Adapter | «один код — две не пересекающиеся категории; дубликат пересекающейся услуги → throw» | `supplier-adapter.registry.ts:12-16,28-46`; `register` `:37-52` |
| Возможности (per-service override) | `CAPABILITIES.ANEX.services.hotels`: 52 страны (full override против 21 у туров), nights 1–30, children ≤5 | `supplier-aggregator.service.ts:163-190` (комментарий про полный override `:176-189`) |
| Universal Search | **есть**: hotels-вкладка live=1 → `GET /public/supplier/search-all?service=hotels` → `searchByService` | `search/page.tsx:97-101`; `public-supplier.controller.ts:185-191`; `supplier-aggregator.service.ts:440-443` |
| Публичная витрина | **отсутствует**: не-live hotels → явный стаб пустой выдачи (`hotelsStub` → `{items:[]}`); ANEX не пишет `Product` → `supplierCode` в каталоге возможен только у KOMPAS/SUMMERTOUR/KAZUNION | `search/page.tsx:101,232-240`; маппинг в категорию `"accommodation"` `:319`; `public-catalog.service.ts:977` |
| Отдельная гео | `ingestAnexHotels` (`SUPPLIER_STATEINC` ANEX для отелей — отдельный словарь `/samo/searchhotel/States`) | `supplier-geo-ingest.service.ts:191-256,293-304`; CLI `backend/scripts/anex-hotel-ingest.ts:24` |
| Известные долги | календарь — «honest empty» стаб; fallback `amount:0`; отсутствие sync в статичный каталог | `anex-hotel.adapter.ts:488-511,438-461` |

**Значение для аудита:** подтверждает, что матрица `Supplier × ServiceType` **уже расширяется динамически** на уровне реестра (ANEX получил вторую строку без каких-либо изменений в расчётной логике) — но `CAPABILITIES` и label-карты фронтенда пришлось править вручную, что и демонстрирует болезнь §3.

---

## 6. Текущий путь live price от поставщика до Order

**Диаграмма as-is (Факт):**

```text
[Supplier API/скрейп]
  │  парсинг: summertour.response-parser.ts:47-49 (data-cat-price, currency default USD)
  │           anex.adapter.ts:700-704 (converted_price ?? price ?? 0)
  │           aviasales.response-parser.ts:217,366-369 (roundMoney 2dp)
  │           kompas.adapter.ts:1682,1726; kazunion.adapter.ts:676-677; azal.response-parser.ts:177
  │  валюта — БЕЗ конвертации, verbatim (summertour-http.service.ts:103)
  ▼
[Normalization → SupplierOffer] supplier.types.ts:106-151
  price: SupplierPriceSnapshot {amount, currency, fetchedAt, expiresAt} :157-165
  ▼
[Aggregator] supplier-aggregator.service.ts — выборка по serviceTypes :440-443,
  capability-gate supports() :447 (impl :208-235), гео-нормализация, фильтр
  availability ≠ NOT_AVAILABLE :281, сортировка по цене :328
  │   ❌ НЕТ слоя markup/margin, НЕТ нормализации валюты, НЕТ пересчёта
  │      per-person/per-party, НЕТ прохода округления
  ▼
[Universal Search UI] AggregatedOffer :31 → OfferModal/OfferDetailsModal
  │   POST /public/supplier/refresh-price (UI-инициируемо) :255
  ▼
[Создание Request] tour-request.service.ts:86-115 → displayedPrice = dto.price (поставщицкая
  цена verbatim!) :101-102; supplierCode+externalOfferId — ВНУТРИ pinnedRequirements JSON :86-100
  (гостевой чекаут: displayedPrice = null, `guest-checkout.service.ts:105-118`)
  ▼
[Supplier flow] propose-price → supplierPriceProposal (request.service.ts:560-581)
  → customerAccept: confirmedPrice = supplierPriceProposal ?? displayedPrice :673  ← FREEZE
  ▼
[Конвертация] createOrderFromRequest: money = confirmedPrice ?? displayedPrice :658,
  422 при null :661; Order.amount = money :676; OrderItem price=amount :725-738
```

**Отдельные механизмы (ответ по заданию):**

| Механизм | Существует? | Backend | Frontend | Ограничения |
|---|---|---|---|---|
| `refreshSupplierPrice` | **Да** (backend-имя `refreshPrice`) | `supplier-offer.service.ts:182` (gate `livePriceEnabled`); `POST /supplier/refresh-price` `supplier.controller.ts:147` (**сейчас мёртв — 403, см. §14**); `POST /public/supplier/refresh-price` `public-supplier.controller.ts:255` | `supplier-api.ts:361`; вызовы только `OfferDetailsModal.tsx:82`, `OfferModal.tsx:137` | **только UI-инициируемо**; нет периодики; нет re-check при `customerAccept`/конвертации |
| Price calendar | **Да** | `supplier-offer.service.ts:239`; `public-supplier.controller.ts:223` | `MonthlyCalendar.tsx:7,79,96`; `TourDetail.tsx:35,74`; `supplier-api.ts:318` | lookup **без контекста услуги**: `registry.get(code)` без service (`supplier-offer.service.ts:240`) → для ANEX всегда туры |
| Availability recheck | **Да** (поставщицкие места) | `supplier-offer.service.ts:214`; `public-supplier.controller.ts:271`; фильтр `supplier-aggregator.service.ts:281` | `supplier-api.ts:376` | ANEX возвращает `"UNKNOWN"` по умолчанию; в booking/conversion — **нет** |
| Snapshot цены | **Частично** | `SupplierPriceSnapshot.fetchedAt/expiresAt`; `Request.displayedPrice/confirmedPrice` (`schema.prisma:2388-2391`); `Order.amount` frozen | — | нет supplier-price отдельно от публичной; supplierCode — только в JSON |
| Округление | Фрагментарно | aviasales 2dp (`response-parser.ts:217`); `sales.money.ts` MONEY_SCALE=2 HALF_UP `:44,88` (только Quote/Sale); публичный `money() = toFixed(2)` (`public-catalog.service.ts:1042-1045`) | — | тур-путь поставщика **без прохода округления** |

**Потери/перезапись цены (Факт):**
1. **`amount: 0` fallback** при ненайденном оффере в `refreshPrice/getOffer`: `anex.adapter.ts:396-402`, `anex-hotel.adapter.ts:468-476`, `kazunion.adapter.ts:350-357`, `summertour.adapter.ts:536-544` — потребитель, принявший 0 за цену, недопродаст/недозакажет.
2. **Каталожный `priceFrom` двигается только ручным sync** (`supplier.controller.ts:37,69`; `summer-sync.service.ts:393-398,454-461`; raw-SQL upsert `summer-bulk-sync.service.ts:224-293`) — нет reconciliation-петли, публичная цена может отстать от поставщицкой неограниченно.
3. **После `customerAccept` перепроверки нет нигде** (см. refresh — только UI) — дрейф поставщика молча поглощается замороженным snapshot’ом.
4. Guest-checkout создаёт Request без цены вовсе (`guest-checkout.service.ts:105-118`) → 422 при конвертации (§12).
5. Валюта нигде не пересчитывается (нет FX в контуре; единственный `priceFactor()` — tour-builder `tour-builder.service.ts:1138-1142`).

---

## 7. Существующие pricing-компоненты, пригодные для переиспользования

**Факт — инвентарь:**

| Компонент | Location | Пригодность для наценки |
|---|---|---|
| Денежная математика | `sales/sales.money.ts`: `toMoney2:44`, `validateDiscountValue:63`, `lineAmount:84`, `subtotalOf:94`, `discountAmountOf:108`, `totalOf:125`, `validateFrozenSnapshot:192`, `quoteTotals:230` — DECIMAL(12,2), `ROUND_HALF_UP`, overflow→422 | **ядро расчёта** `Public Price` и `Final Price` — переиспользовать напрямую |
| Master-data-паттерн правил | `CommissionPolicyService` `finance/commission-policy.service.ts:49,69-120,229` (DRAFT-only update, `ids.nextCode(tx,"CMP")`, `$transaction`, version, overlap-инвариант при activate, `security.audit`, `writeHistory:272-301` — полный state-snapshot на версию) | **шаблон для `MarkupRule`** (история, версии, статусы) |
| Временное разрешение периодов | `catalog/period-resolution.ts:54,65,82`; `commercial-period.service.ts:68`; `restriction-evaluation.ts:140` | при желании — срочность правила наценки (effective-окно) |
| Rate plans/ограничения | `rate-plan.validation.ts:20,34,38,130,162`; `rate-plan.service.ts` | если наценка будет жить в catalog-контуре (не рекомендуется — §9) |
| Публичная цена | `public-catalog.service.ts` `minTariff:999`, `priceFrom:917,966`, `money():1042-1045`, `PRICE_ON_REQUEST → null:911` | место отображения, не место расчёта |
| Percent-механики | `tour-builder.service.ts`: `packageDiscountPct:65,608,1011-1013`, `earlyBookingDiscountPct:118,865`, surcharges `:127,929-940` (quote-preview only) | образец percent-формул и округления `round2()` |
| Скидочная модель | `QuoteDiscountType NONE|PERCENTAGE|FIXED` `schema.prisma:3627`; `Quote.discount*` `:3670-3677`; `CheckoutIntent.discount*` `:3820`; `Order.discount*` `:2185-2187`; guard `assertFixedDiscountWithinSubtotal` `sales-quote.service.ts:387,487`; endpoint `PUT /sales/quotes/:code/commercial` `sales.controller.ts:635-646` (`sales.quote.write`) | **готовая механика индивидуальной скидки** для Live Sales (§11) |
| Документ-спека | `docs/architecture/universal-pricing-model.md` (§2 инварианты, §3 input modes, §7 overlap/precedence, §8 server resolver, §9 HARD GATE на неизвестную цену, §12 freeze boundary) | целевые инварианты; §9 — точная прецедентная модель безопасного дефолта |

**Факт: слоя markup/margin НЕ существует вообще** — новый `SupplierPricingService` будет первым (это не блокер, а чистое аддитивное дополнение).

---

## 8. Компоненты Storefront-комиссии, запрещённые к изменению

**Факт — полный список «не трогать» (§2.2 задания):**

- Схема: `enum CommissionStatus` `schema.prisma:4414`; `CommissionCollectionModel` `:4431`; `CommissionAccrualStatus` `:4471`; `CommissionPolicyStatus DRAFT|ACTIVE|ARCHIVED` `:4521-4527`; `CommissionChannel MARKETPLACE|PARTNER_STOREFRONT|DIRECT|BUYER_REQUEST` `:4534-4541`; `CommissionRateType PERCENTAGE` `:4546-4550`; `model CommissionPolicy` (CMP-*, `rate Decimal(18,6)` 0<rate<1, effective-окно) `:4559-4586`; `CommissionPolicyHistory` `:4592-4604`; `model Commission` `:4445`; `commissionSnapshot Json?` на `Order/Sale/CheckoutIntent/Quote` `:2211,3685,3827,3980`.
- Сервисы: `finance/commission.service.ts` (`createAccrualForOrder:78`, base×rate `:101`, `listCommissions:197`, `getCommissionByCode:212`, `listAccruals:218`); `finance/commission-policy.service.ts` (`resolve:229` — fail-closed «AMBIGUOUS → no policy» `:16,227`); `finance/commission-accrual.consumer.ts`; guard’ы `finance.validation.ts:766,786,805`; эндпоинты `finance.controller.ts` (~`:403,440-470`).
- Привязки: freeze при Quote ISSUE `sales-quote.service.ts:153-191` (+ `mapCommissionChannelFromAcquisition:637-639`); пропагация `order.service.ts:493-495,714`, `order-requested.consumer.ts`, `eventbus/domain-events.ts:285,406,430`, `sales-completion.service.ts:130-152`, `sales-checkout.service.ts:95-97`; seeds `demo-seed.ts:489,595,678`.
- Спеки/доки: `commission.service.spec.ts`, `commission-policy.service.spec.ts`, `docs/architecture/commission-policy-foundation.md`, `partner-collect-commission-accrual.md`, `d10-partner-attribution-semantics.md`.
- RBAC: `finance.commission.read` `permissions.constants.ts:139`, `finance.commission.manage` `:141`.

**Факт:** база комиссии — `frozen Order.total` (commission.service.ts:95), т.е. комиссия считается от итоговой цены продажи. Новая наценка, увеличивающая цену продажи, **косвенно** увеличит будущую комиссию — это ожидаемое следствие (комиссия не меняется как механизм); прямых пересечений кода нет. Разделение: наценка = над поставщицкой ценой (до продажи), комиссия = от суммы продажи (после). Документировать, не смешивать.

---

## 9. Целевая архитектура динамической матрицы наценок

**Рекомендация (проект, §7+§4 задания).**

### 9.1 Ключ и источник строк матрицы

- Ключ правила: **`Supplier (supplierCode) × ServiceType (`tours|hotels|flights`)** — ровно то, что уже хранит реестр.
- Строки/столбцы матрицы строятся автоматически из `SupplierAdapterRegistry.getEntries()` (`supplier-adapter.registry.ts:89-91`) ∪ `FlightSupplierRegistry.list()` — **никаких имён Summer/Kompas/Anex/Kazunion/AZAL/Aviasales в расчётной логике** (проверено: в новой логике их быть не должно; текущие хардкод-списки §3 остаются в legacy-частях до миграции).
- «При регистрации нового поставщика» → `register()` уже добавляет entry → матрица расширяется сама. «При добавлении услуги существующему поставщику» → вторая `register()` с тем же code и новым `serviceTypes` (модель ANEX-отелей) → строка появляется автоматически; конфликт пересекающихся услуг предотвращает `serviceTypesOverlap` (`:28-46`, throw).

### 9.2 Правило `MarkupRule` (master data)

- Размещение: **схема `finance`**, отдельная таблица **рядом, но не внутри** `CommissionPolicy` (§2.2 — не смешивать). Шаблон — `CommissionPolicy` 1:1: `code (MUP-*)`, `supplierCode`, `serviceType` (matching key, не меняется после создания), `rateType=PERCENTAGE`, `rate`, `status DRAFT→ACTIVE→ARCHIVED`, `version`, `effectiveFrom/effectiveTo`, `history` (полное состояние версии — прецедент `CommissionPolicyHistory` `schema.prisma:4588-4604`).
- Представление `rate` — **рекомендация: доля `0.05 = 5%`** как у `CommissionPolicy.rate` (`:4566-4569`, «0.10 = 10%, 10 невалиден»), с отображением «%» в UI; альтернатива «проценты числом» из формулы промпта — вопрос владельцу (§17).
- Уникальность активного правила: partial unique по `(supplierCode, serviceType)` для ACTIVE + overlap-проверка окон при activate (прецедент commission-policy overlap-инвариант).

### 9.3 Расчёт (единый pricing-service)

```text
SupplierPricingService.resolve(supplierCode, serviceType, at) →
    { ruleCode, ruleVersion, rate } | NOT_CONFIGURED
SupplierPricingService.apply(supplierPrice, rate) →
    markupAmount = toMoney2(supplierPrice × rate)        // sales.money.ts:44, HALF_UP, 2dp
    publicPrice   = supplierPrice + markupAmount
```
- `Public Price = Supplier Live Price + Markup Amount`; Live Sales `Final = Public − Discount`; инвариант `Final ≥ Supplier Live Price` — проверка **серверная**, в точке acceptance (§11-§12).

### 9.4 Точки применения (choking points — один раз, без двойного применения)

| Точка | Файл (сейчас) | Что меняется (проект) |
|---|---|---|
| Live-выдача Universal Search | `supplier-aggregator.service.ts` (после `supports()`, **до** сортировки `:328` — сортировать уже по public price) | оффер получает public price + сохранённый supplier price |
| Ручной refresh | `supplier-offer.service.ts:182` → выход адаптера | apply перед возвратом UI |
| Sync в статичный каталог (Tariff) | `summer-sync.service.ts:393-398,454-461`, `summer-bulk-sync.service.ts:224-293`, `kompas-sync.service.ts`, `kazunion-sync.service.ts` | в Tariff пишется **public price** (семантика Tariff = цена продажи не меняется → `public-catalog` read-path **не трогаем** → регрессия исключена) |
| Создание Request | `tour-request.service.ts:101` (`displayedPrice`) | приходить уже как public price; **supplierCode/serviceType выносятся в first-class поля snapshot** (§12) |

**Исключение двойного наложения:** markup применяется ровно один раз на границе «поставщицкая цена → цена продажи»; read-path каталога (`minTariff`) и `Order.amount` остаются как есть.

### 9.5 Безопасное начальное состояние новых комбинаций — оценка

| Вариант | За | Против |
|---|---|---|
| **0%** | совпадает с прецедентом «нет правила → нет начисления» (`NO_POLICY/AMBIGUOUS → NULL snapshot → 0 accrual`, `commission.service.ts:12-13`); никогда не блокирует продажу; просто | неотличим от явного «наценки нет» — управляющая слепота: владелец не видит незаполненных ячеек |
| **«Не настроено»** (три-состояние: `N%` / `0% явно` / `NOT_CONFIGURED`) | явность + admin-видимость; **runtime-поведение `NOT_CONFIGURED` = 0%** (по прецеденту NO_POLICY) — безопасно и неблокирующе; 0% становится осознанным зафиксированным решением с историей | чуть больше состояний |

**Рекомендация: «Не настроено»** как явное состояние в матрице (админ видит пустые ячейки и предупреждение), с runtime-семантикой **0%** — это ровно тот компромисс, который соответствует существующей архитектуре: оптимистичный дефолт для отсутствия данных (`supports() → true` `supplier-aggregator.service.ts:210`; NO_POLICY → 0 комиссии) плюс fail-closed только для **цены** (`universal-pricing-model.md` §9: неизвестная цена — HARD GATE; отсутствие маржи — не цена, гейтить нельзя, иначе ломаются продажи).

### 9.6 Отключённые возможности / удалённые интеграции / дубли / устаревшие правила

- **Отключён** (`config.enabled=false` в регистрации): строка матрицы присутствует, помечена «поставщик отключён»; правила хранятся (переиспользуемы при включении); apply не вызывается, т.к. нет офферов.
- **Интеграция удалена** (adapter не регистрируется): правило остаётся в БД (ключ — строка `supplierCode`), матрица показывает **осиротевшее правило** (нет активной возможности) → не применяется, доступно для `ARCHIVED`. Крэшей нет (resolve идёт от реестра, не наоборот).
- **Дублирующиеся типы услуг** исключены на входе: `serviceTypesOverlap` → throw (`registry:43-46`); в БД — partial unique для ACTIVE.
- **Устаревшие правила**: окно `effectiveFrom/effectiveTo` + статус `ARCHIVED` (терминальный, неселектируемый) — прецедент `CommissionPolicyStatus` (`schema.prisma:4516-4520`); resolve детерминирован по `at` (как `commission-policy resolve(channel, at) :229`).
- **Неизвестный поставщик/услуга** в resolve → `NOT_CONFIGURED` (никогда throw).

---

## 10. Предлагаемые изменения Prisma, backend, API и frontend (ТОЛЬКО КАК ПРОЕКТ)

Ничего из нижеописанного не реализовано.

**Prisma (проект):**
```prisma
enum MarkupRuleStatus { DRAFT  ACTIVE  ARCHIVED }        // прецедент :4521-4527
model MarkupRule {                                        // schema "finance"
  id, code String @unique            // MUP-00000001
  supplierCode String                // matching key: реестровый код
  serviceType  String                // "tours"|"hotels"|"flights"
  rateType / rate Decimal(18,6)      // 0 <= rate < 1 (доля; вопрос §17)
  status MarkupRuleStatus @default(DRAFT), version Int @default(1)
  effectiveFrom DateTime, effectiveTo DateTime?
  history MarkupRuleHistory[]        // полное состояние версии (прецедент :4588-4604)
  @@index([supplierCode, serviceType, status])
}
// Request: first-class поля snapshot (см. §12): supplierCode?, serviceType?,
//   supplierPrice?, markupRate?, markupAmount?, publicPrice?,
//   discountType/discountValue/discountAmount?, priceSource PUBLIC|LIVE_SALES,
//   pricingCalculatedAt, markupRuleCode?, markupRuleVersion?   — либо одно Json-поле priceSnapshot
```

**Backend (проект):**
1. Модуль `pricing` (или `supplier/pricing/`): `MarkupRuleService` (CRUD по образцу `commission-policy.service.ts:69-120` + `writeHistory`) и `SupplierPricingService` (resolve/apply по §9.3).
2. Точки применения §9.4 (агрегатор, refresh, sync-сервисы, `tour-request.service`).
3. Новые permissions — **обязательно объявить в `PERMISSIONS`** (`permissions.constants.ts:8`): `pricing.markup.read`, `pricing.markup.manage` (урок §14 — незаявленное право = вечный 403).
4. Правка `customerAccept`/конвертации — **не ослабляя проверок**: см. §12 (добавить money-гейт, существующий422-гейт сохранить).
5. Общие константы сервисных типов + shared-маппер вместо трёх разрозненных (§4).

**API (проект):**
- `GET /api/v1/pricing/markup-matrix` — матрица, построенная из реестра + правила (`pricing.markup.read`).
- `PUT /api/v1/pricing/markup-rules/:id` (draft), `POST …/:id/activate|archive` (CAS version, overlap-check, `security.audit`, `assertNoForbiddenKeys`) — паттерн `finance.controller.ts:440-470`.
- Публичные эндпоинты не меняются (public price считается на сервере до выдачи).

**Frontend (проект):**
- Админ-страница «Матрица наценок»: строки = `GET /public/supplier/suppliers` ∪ рейсы, столбцы = услуги, ячейка = `%` / «Не настроено» / «правило без возможности»; форма редактирования с % → доля.
- Заменить хардкод-карты `SUPPLIER_LABELS` и табы-опции на данные реестра (§3 п.4).
- Публичная витрина: без изменений (цена уже с наценкой приходит с сервера) — **кроме** маркетинговых строк «без наценок» (`i18n.tsx:191,224`) — их надо будет скорректировать при реализации (влияние на копирайт, вопрос §17).

---

## 11. Public Sales и Live Sales

**Факты:**
- **Public Sales** сегодня = синхронные карточки (`priceFrom = minTariff`, `public-catalog.service.ts:895,917`) и live-выдача Universal Search (поставщицкая цена verbatim, §6). Наценки нет.
- **Live Sales** как модуль отсутствует (0 совпадений `live.?sales|operator.?quote`); операторские продажи собираются из примитивов: `ManualCreateForm.tsx:11-18,141-164` → `POST /requests` → `propose-price/confirm-price/customer-accept` (`request.controller.ts:186-259`) → convert; либо `OfferModal` → `POST /public/supplier/create-request`.
- **Каналы:** WhatsApp создаёт только `whatsAppInboundMessage/Communication` (`inbound.service.ts:237,643`) — **не** заказы; телефоны/офис/чат физически сходятся в ту же цепочку Request → Order (заказы создаются только `createOrderFromRequested` `order.service.ts:444` и `createOrderFromRequest` `:605`). ⇒ **единая коммерческая логика для всех каналов уже достигнута архитектурно** — скидка должна жить в Request/Order, а не в канале.
- Права на цену сейчас: `order.edit_noncritical` (все request-действия, `request.controller.ts:167-249`), `sales.quote.write` (`permissions.constants.ts:101`); права `price.*|discount.*|markup.*` **не существуют** (`:8-299`).

**Рекомендация — модель индивидуальной скидки (§8 задания):**

| Требование | Как обеспечить (проект) |
|---|---|
| Скидка только к конкретному КП | Поля скидки на **Request** (новые `discount*`), замораживаемые при `customerAccept`; копируются в существующие `Order.discount*` (`schema.prisma:2185-2187`, сегодня null при request-конверсии `order.service.ts:703-715`) |
| Не меняет публичную цену | Public price — производная supplier×markup (сервер); скидка пишется только в Request/Order-snapshot, в `Tariff`/агрегатор не попадает |
| Не меняет глобальное правило | Скидка — не строка `MarkupRule`; правки правил отдельный permission (`pricing.markup.manage`) |
| Не раскрывается другим клиентам | Request-данные видны только владельцам/операторам (существующая request-RBAC); публичный API скидок не отдаёт |
| `Final ≥ Supplier Live Price` | Серверная валидация в `customerAccept` (и defensive в конвертации): `confirmedPrice − discount ≥ supplierPriceSnapshot` → иначе 422 (паттерн `ValidationDomainError`, `shared/errors.ts:26-31`) |
| Право оператора | Новое `sales.discount.grant` (или переиспользовать `sales.quote.write`) — **заявить в `PERMISSIONS`** |
| Канал-независимость | Скидка в Request → WhatsApp/офис/телефон не имеют собственной коммерческой логики (уже так) |

Скидка вычисляется сервером (`discountAmountOf` `sales.money.ts:108`, `validateDiscountValue :63`), клиент передаёт только тип/значение (прецедент `Quote.discountValue` — «Backend вычисляет discountAmount» `schema.prisma:3625`).

---

## 12. Price Snapshot и гарантии целостности

**Факт — состав текущего snapshot’а:**
- `Request`: `displayedPrice/displayedCurrency` `schema.prisma:2388-2389`, `confirmedPrice/confirmedCurrency` `:2390-2391`, `supplierPriceProposal` `:2397`, `pinnedRequirements Json` `:2414` (сюда **крадутся** `supplierCode/externalOfferId` — `tour-request.service.ts:86-100`), `productSnapshot Json` `:2419`, `travelerCount` `:2410`, `customerAcceptedAt` `:2402`.
- `Order`: `amount/subtotal/currency` frozen; `commissionSnapshot Json` `:2211`; `discount*` `:2185-2187`.
- Snapshot-дисциплина уже канон: D3 acceptance-freeze (`request.service.ts:626-691`), `validateFrozenMoneyFact`, `Order.paymentStatus` только через consumer.

**Анализ ошибки `Request has no accepted price/currency…` (§9 задания) — не чиним, устанавливаем причину:**

```text
причина:  customerAccept фиксирует confirmedPrice = supplierPriceProposal ?? displayedPrice
          БЕЗ проверки результата (request.service.ts:673)
          + guest-checkout создаёт Request с displayedPrice = null (guest-checkout.service.ts:105)
          + supplier мог подтвердить без propose-price (confirmPrice не принимает цену:553-555)
следствие: order.service.ts:658 money = null → :661 422 (гейт ПРАВИЛЬНЫЙ, его ослаблять нельзя)
усиление:  проекция availableActions.convert без money-гейта (request.service.ts:40-86)
```

**Архитектурные изменения, устраняющие причину БЕЗ ослабления проверок (проект):**
1. **Гейт в `customerAccept`**: отказ при `!(supplierPriceProposal ?? displayedPrice)` — «принятые условия без суммы» становятся невозможны (добавление проверки ≠ ослабление; execution-гейт `:661` остаётся как defence-in-depth).
2. **Гейт в проекции `convert`** тем же предикатом — UI перестаёт предлагать заведомо падающий action.
3. **Все коммерческие поля — в одном snapshot**: новый `priceSnapshot` (или колонки) с составом из задания:

| Поле | Источник (существующий/новый) |
|---|---|
| supplier, service type | новые first-class поля (сегодня — только внутри JSON `pinnedRequirements`) |
| параметры предложения | существующие `pinnedRequirements/productSnapshot` |
| supplier price + currency | **новое** (сегодня отсутствует — главный пробел) |
| markup percent, amount, rule code/version | **новое** (версия правила — для репродукции, как `commissionSnapshot.policyVersion`) |
| public price | **новое** |
| individual discount (type/value/amount) | новые на Request → существующие `Order.discount*` |
| customer final price + currency | существующие `confirmedPrice/confirmedCurrency` (= accepted money) |
| источник `PUBLIC \| LIVE_SALES` | **новое** (enum-поле) |
| время расчёта и принятия | новые `pricingCalculatedatedAt` + существующие `customerAcceptedAt` |

4. Порядок: расчёт public price происходит **при показе** (aggregator/refresh), snapshot-фриз — **при acceptance**, конвертация копирует snapshot → `Order.amount` (существующая транзакционная копия, `order.service.ts:676`), mutation `Order.amount` остаётся запрещённой (`order.validation.ts:20-49`).

---

## 13. Обработка изменения live price и индивидуальных скидок

**Факты:** re-check есть только UI-инициируемый (`refreshPrice`, §6); `SupplierPriceSnapshot.expiresAt` существует (`supplier.types.ts:165`); после acceptance — ничего; `amount:0` fallback опасен.

**Рекомендации (проект):**
1. **Окно актуальности в snapshot**: хранить `supplierPriceFetchedAt/expiresAt`; если на момент `customerAccept` snapshot старше TTL — сервер **предупреждает/блокирует** и требует refresh (UI уже умеет: `OfferDetailsModal.tsx:82`). Это вписывается в `universal-pricing-model.md` §9 (HARD GATE на неизвестную/протухшую цену).
2. **Убрать/загасить `amount:0` fallback** в пользу явной ошибки `NOT_FOUND` (проектно; сейчас 0 — это тихая потеря цены, §6 п.1).
3. **Серверный re-check при acceptance для live-офферов** (один вызов `refreshPrice` в `customerAccept`, если оффер помечен live) — закрывает «дрейф после acceptance» (§6 п.3). Для не-live (синхронные карточек) — не требуется.
4. **Индивидуальная скидка**: валидация на сервере в момент фриза (`Final ≥ supplierPrice`) + defensive при конвертации; скидка не пересчитывается автоматически при смене публичной цены (она привязана к замороженному КП, §8 задания); при желании клиента пересчитать — новая итерация КП (`propose-price`-цикл уже существует).
5. **Изменение global-правила наценки не трогает открытые КП**: правило версионируется (`markupRuleCode/Version` в snapshot) — старые КП остаются исполнимыми (как `commissionSnapshot`), новые получают новую версию. Это же отвечает на «устаревшие правила» §4.

---

## 14. RBAC, audit, идемпотентность и конкурентные операции

**Факты — существующие образцы:**
- **RBAC:** `PERMISSIONS` `permissions.constants.ts:8`, `ALL_PERMISSIONS :299`, `ROLE_PERMISSIONS :306` (ADMIN=ALL `:307`); guard **fail-closed** (`permissions.guard.ts:26-40`: нет юзера → 403, нет права → 403, включая необъявленные права). Прецеденты владений: `finance.commission.read/manage :139,141`, `sales.quote.write :101`, `settings.read/write :247,248`.
- **Дефект (Факт):** `supplier.controller.ts:38,49,57,69,92,131,148,163,178,188,203,215` требует `supplier.search.read/manage`, которых **нет в `PERMISSIONS`** → 403 всем (в т.ч. ADMIN). **Вывод для проекта: новые права объявлять в `PERMISSIONS` обязательно**, иначе админ-матрица наценок будет мертва на старте. (Исправление самого дефекта — вне scope аудита, но зафиксировано §15.)
- **Audit:** `SecurityService.audit()` `security.service.ts:330` (примеры вызовов `sales-quote.service.ts:201`, `request.service.ts:903`).
- **История правил:** `writeHistory` полного состояния версии — `commission-policy.service.ts:272-301`.
- **Идемпотентность:** `@Idempotent(op)` — `shared/idempotency/idempotency.decorator.ts`; реестр `IDEMPOTENT_OPERATIONS = {payment.create, whatsapp.send}` `idempotency.constants.ts:21`; header `:12`; stale 30s `:31`; пример `finance.controller.ts:323`.
- **Конкурентность (CAS):** паттерн `updateMany({where:{id, version}})` → `count===0 → ConflictError` — конвертация Request `request.service.ts:844-856`, ISSUE котировки `sales-quote.service.ts:182-194`, закрытие Sale `sales-completion.service.ts:120-129`.

**Рекомендация для наценки:** `pricing.markup.read/manage` (объявить!); audit-действия `pricing.markup.created/updated/activated/archived`; `@Idempotent("markup.rule.create")` (добавить в `IDEMPOTENT_OPERATIONS` — реестр fail-closed, операции вне реестра отклоняются); activate — CAS по `version` + overlap-проверка активных окон (конкурентное активирование двух перекрывающихся правил → один 409); расчетная функция — чистая и без записи (параллельные публичные поиски безопасны); запись snapshot в Request — в той же транзакции acceptance (D3-паттерн).

---

## 15. Риски, обратная совместимость и регрессии

| # | Риск / регрессия | Уровень | Описание |
|---|---|---|---|
| R1 | **Двойное наложение наценки** на sync-карточках (markup в aggregator + markup при записи Tariff → Tariff снова с markup) | HIGH |Mitigация: единая точка входа `SupplierPricingService` + правило «supplier-граница ровно один раз» (§9.4), тест на идемпотентность |
| R2 | Скрытая регрессия `CommissionPolicy`/accrual | HIGH | наценка — новая таблица; запрет на изменение всех файлов §8; база комиссии остаётся `Order.total` |
| R3 | `amount:0` fallback + markup → публичная цена «наценка от нуля» | HIGH | сначала устранить fallback или деактивировать apply при `amount<=0` (§13 п.2) |
| R4 | Незаявленные permissions → 403 (как `supplier.search.*`) | HIGH | объявлять в `PERMISSIONS` (§14); покрыть e2e RBAC |
| R5 | Статичный `priceFrom` отстаёт от поставщика (ручной sync) — с наценкой расхождение удваивается | MEDIUM | существующий долг (§6 п.2); план — reconciliation-петля (фаза 5) |
| R6 | Продажи без правила → 0% (скрытая неонаценка) | MEDIUM | три-состояние + admin-предупреждения (§9.5) |
| R7 | Маркетинговые строки «без наценок» (`i18n.tsx:191,224`) станут ложью | MEDIUM | включить в scope копирайта при реализации |
| R8 | Хардкод-списки поставщиков (19 шт.) рассинхронизируются с матрицей | MEDIUM | миграция label-карт на `/public/supplier/suppliers` (§10) |
| R9 | Ключ `serviceType` (kebab/UPPER/snake) — коллизии | MEDIUM | фиксированный словарь `tours|hotels|flights` + shared-маппер (§4) |
| R10 | Легаси-дубль `summertour.adapter.ts`, мёртвый календарь ANEX-hotels, стаб Aviasales-calendar | LOW | pre-existing; не блокирует |
| R11 | Отладочный лог с абсолютным путём `D:\travelhub_v1\backend_price_chain.log` (`public-supplier.controller.ts:45,227,234,250`, `kompas.adapter.ts:644,700`) | LOW | pre-existing, gitignored; убрать при реализации |
| R12 | Одиночный инстанс (in-memory кэш/реестр, `supplier-cache.service.ts:19-27`) — правила кэшируются в том же процессе | LOW | учитывать при горизонтальном масштабировании |
| R13 | Обратная совместимость API | — | публичные эндпоинты не меняют контракт (price — number в том же поле); только знание о том, что цена уже с наценкой |

Pre-existing debts помечены; ничего из них аудит не чинит (READ-ONLY).

---

## 16. Поэтапный план будущей реализации

| Фаза | Содержание | Зависимости |
|---|---|---|
| **0. Owner decisions** | Разбор §17 (default-состояние, представление rate, scope валют/рейсов, snapshot-формат) | — |
| **1. Foundations** | Prisma `MarkupRule(+History)` + permissions в `PERMISSIONS` + `MarkupRuleService` (CRUD/CAS/history/audit) + `SupplierPricingService.resolve/apply` (только `sales.money`) + unit-тесты | Фаза 0 |
| **2. Application points** | Подключение в aggregator (до сортировки), `refreshPrice`, `tour-request.service` (displayedPrice) — с supplier-price в offer/snapshot; тесты: public = supplier×(1+rate), двойного наложения нет | Фаза 1 |
| **3. Snapshot & gates** | `priceSnapshot` на Request (supplier price, markup-версия, источник, discount), гейт в `customerAccept` + проекция `convert` (без ослабления `order.service.ts:661`), defensive-инвариант Final≥supplier | Фаза 2 |
| **4. Admin UI + Live Sales discount** | Матрица наценок (строки из реестра), форма правила; поля скидки на Request + валидация + копирование в `Order.discount*`; замена хардкод-label-карт | Фаза 1-3 |
| **5. Sync & reconciliation** | Применение в sync-сервисах (Tariff = public price), устранение `amount:0` fallback, reconciliation-петля `priceFrom`↔поставщик, уборка debug-лога, копирайт-строки | Фаза 2 |
| **6. Hardening** | e2e RBAC/идемпотентности/конкурентной активации, нагрузка (мьютекс-resolve), документация в `docs/architecture/` | Фаза 5 |

Каждая фаза аддитивна; откат — архивирование правил (runtime → 0% → исходное поведение).

---

## 17. Нерешённые архитектурные вопросы, требующие решения владельца

1. **Default-состояние** — «Не настроено» (runtime 0%, рекомендация §9.5) против чистого 0%.
2. **Представление `rate`** — доля `0.05` (консистентно `CommissionPolicy.rate :4566-4569`, рекомендация) против процентов `5` (формула промпта).
3. **Scope валют** — FX в контуре отсутствует (§6): считать наценку в валюте поставщика (рекомендация — как есть) или вводить конвертацию? Ответ затрагивает `GUEST_CHECKOUT_CURRENCY="AZN"` vs поставщицкие USD.
4. **Scope по типам услуг** — включать ли рейсы (AZAL/AVIASALES) и будущие сервисы; у FlightSupplier нет `refreshPrice/availability` (§2) — ре-проверка для рейсов невозможна в текущем интерфейсе.
5. **Snapshot-формат** — отдельные колонки Request (типизированность, индексация) против одного `Json priceSnapshot` (гибкость, меньше миграций); частичный гибрид (поля + JSON) — тоже вариант.
6. **Схема размещения** — `finance` (рекомендация §9.1: master-data-паттерн+RBAC-прецедент) против `catalog`/новой `pricing`.
7. **Отношение к статичному каталогу** — подтверждение, что Tariff хранит public price (markup при sync-write), а read-path `minTariff` не трогается; либо владелец хочет read-time расчёт.
8. **Копирайт** — судьба строк «без скрытых наценок» (`i18n.tsx:191,224`).
9. **Ставка скидки-права** — новый `sales.discount.grant` против существующего `sales.quote.write`/`order.edit_noncritical` для операторских скидок.
10. **Дефект `supplier.search.*`** — чинить ли незаявленные permissions отдельным изменением (вне scope аудита, но блокирует любой админ-UI на `supplier.controller`).
11. **Комиссия vs наценка в отчётности** — нужно ли показывать markup-выручку отдельно от комиссии (финансовая аналитика владельца).

---

## 18. Итоговый вердикт

Проверка критериев:

- Неприкосновенные правила §2.2 соблюдены: `CommissionPolicy`-контуры не затронуты и проектом не изменяются (§8).
- Существующие механизмы переиспользованы: реестр адаптеров (автоматическая матрица), `sales.money`, паттерн `CommissionPolicy` (правило+история+статусы), цепочка Request→Order (Live Sales), RBAC/audit/idempotency/CAS.
- Вторая commerce-engine не создаётся: только master-data-таблица + application-сервис + поля snapshot.
- Причина ошибки accepted-price установлена, устранение спроектировано без ослабления gate’ов §12.
- Единый источник Supplier Capabilities спроектирован на базе фактически существующего реестра §3.
- Открытые вопросы (§17) — уточняющие, не противоречащие ядру проекта; каждый имеет рекомендацию.

```text
READY FOR IMPLEMENTATION DESIGN
```

**STOP.** Реализация не начата: код, БД, миграции, конфигурация и UI не изменялись; commit/push не выполнялись. Ожидается утверждение архитектуры владельцем проекта (§17 → §16, фаза 0).
