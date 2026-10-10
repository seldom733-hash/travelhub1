# TRAVELHUB — READ-ONLY AUDIT REPORT
# TRAVELER COMPOSITION → SUPPLIER PRICE (§31)

Status: **READ-ONLY AUDIT DONE — NO CODE CHANGES / NO DB CHANGES / NO MIGRATIONS / NO PRICE OR MARKUP CHANGES / NO COMMIT / NO PUSH.**

| Поле | Значение |
|---|---|
| HEAD | `75c6bea` (`fix(request): keep convert action for product-less requests (Hotel Identity Fix B)`) |
| Branch | `master` |
| git status | 154 entries (153 pre-existing из предыдущего workstream + настоящий отчёт; аудит не изменил ни одного существующего файла) |
| Дата | 08.10.2026 |
| Промпт | `docs/prompts/TRAVELHUB_TRAVELER_COMPOSITION_READ_ONLY_AUDIT_PROMPT.md` |

---

## 1. Executive Summary

**Главный вывод: в TravelHUB НЕТ движка, который превращает `RequestTraveler.birthDate` в состав туристов. Состав (`adults / children / childAges / infants`) целиком приходит из UI-формы поиска/календаря и проходит систему неизменённым до supplier API.**

Три ответа на критерий завершения:

1. **Откуда берётся composition** — из числовых полей, которые пользователь вводит в формах: `TourSearch.tsx:56-58`, `CompactSearch.tsx:83-86`, `search/page.tsx:267-269` (дефолты `adults ?? 2`, `children ?? 0`), `TourDetail.tsx:52-54` (форма календаря), `FlightSearch.tsx:30-31,156-157`. На бэкенд они входят через `supplier.controller.ts:102-119` / `public-supplier.controller.ts:129-131,176-178` и сохраняются как `SupplierSearchQuery { adults, children?, childAges? }` (`supplier.types.ts:36-38`). Никогда не выводятся из travelers, из `birthDate` и из supplier-ответов.
2. **Правила состава у supplier'ов** — фактически правила живут на стороне поставщиков и реализованы *транспортом возрастов* в адаптерах: Anex Hotels передаёт CSV всех возрастов, Anex Tours — только первый возраст ребёнка, Kompas — `AGE1..AGE3` в форме, Kazunion — `AGE1..AGE4` в URL, Summer (активный адаптер) — **возраста вообще не отправляет** (см. §5), AZAL — только агрегированные `adults/children/infants` без DOB. Единственные *хардкод*-пороги в самом TravelHUB находятся в partner tour-builder quote (`tour-builder.service.ts:915-919,953-954`) и не участвуют в supplier-ценообразовании.
3. **Точка безопасного подключения `birthDate`** — граница построения `SupplierSearchQuery` в `tour-request.service.ts:115-138` (create-tour-request recheck) + readiness-граница `assertTravelersReadyForCommercialStep` (`request.service.ts:689,1087`) как **сверочный gate** (derived composition из `RequestTraveler[]` против замороженного `productSnapshot.offer` / `travelerCount`), с делегированием возрастных правил адаптеру supplier'а. Подробно — §23.

**FINAL VERDICT: C** (см. §27).

---

## 2. RequestTraveler Analysis (§5)

**Модель** — `backend/prisma/schema.prisma:2472-2488`:
`model RequestTraveler { id, requestId + relation, position Int @default(0), firstName, lastName, birthDate DateTime, createdAt, updatedAt; @@unique([requestId, position]) }`, схема `order`. Поля `gender/passport*` в RequestTraveler **нет** (§2.2 предыдущей фазы: хранится только FIO + birthDate). Колонки подтверждены в БД: `id/requestId/position/firstName/lastName/birthDate/createdAt/updatedAt`.

| Операция | Где |
|---|---|
| Создание при Request creation (bulk) | `order/request.service.ts:345-356` (`createMany`, position = index+1, `birthDate = new Date(birthDate + "T00:00:00.000Z")`) |
| Создание отдельного traveler'а | `request.service.ts:565` (`createRequestTraveler`, нормализация 590-598) |
| Обновление / удаление | `request.service.ts:618` / `:669` |
| Чтение (detail) | `request.service.ts:526` (`getRequestTravelers`, DTO 509-519) |
| Валидация | `order/request-travelers.ts:48-81` (YYYY-MM-DD, реальная дата, не в будущем), `:116-117` (completeness = FIO + birthDate) |
| Request creation | `order/request.controller.ts:210-219` (POST :id/travelers), `:243-262` (POST requests с travelers[]) |
| customerAccept | **только** readiness: `request.service.ts:689` (`assertTravelersReadyForCommercialStep`), вызов на `:1087` — «FIO + birthDate заполнены», **никакого расчёта состава** |
| Request → Order | `order/order.service.ts:757-785` — `RequestTraveler → OrderTraveler` (FIO+birthDate копируются как snapshot) |
| Прочее чтение | `documents/voucher.consumer.ts:173`, `booking/booking.subscribers.ts:254`, PII-маскировка `order.service.ts:1854,1944-2007`, requirements `catalog/traveler-requirements.ts:90-184` |

**Используется ли `birthDate` вне storage/UI?** Только в валидации, readiness/completeness, requirements-матрице, копировании в Order/Booking/Voucher и PII-редактировании. **В модуле `supplier/` — 0 упоминаний `birthDate`** (grep по `backend/src/modules/supplier/**`).

---

## 3. Existing Composition Engine (§6, §7)

Отдельного «движка состава» нет. Composition = **прямые числовые поля, сквозные из UI в supplier-запрос**:

| Место | Функция | Вход | Выход | Назначение |
|---|---|---|---|---|
| `frontend/components/marketplace/search/TourSearch.tsx:56-58,116-118,298-300` | state + submit | выбор пользователя (дефолты 2/0/[]) | `childAges: childAges.slice(0, children)` в search-context | тур-поиск |
| `frontend/components/marketplace/CompactSearch.tsx:83-86` (также `HeroSearch.tsx:97`) | URL builder | search-context | query-параметры `adults/children/childAges/infants` | универсальный блок поиска |
| `frontend/app/search/page.tsx:153-155,189-193,267-269` | чтение URL | query-параметры | flights: `passengers{adults,children,infants}`; tours: `adults ?? 2, children ?? 0, childAges CSV→number[]` | результаты поиска |
| `frontend/components/supplier/TourDetail.tsx:52-54,75-77,150-152` | локальный state календаря | форма (дефолт adults=2, возраст детей по умолчанию `5`) | calendar query | месячный календарь |
| `backend/src/modules/supplier/supplier.controller.ts:102-119` | HTTP (authed) | query-строка | `SupplierSearchQuery` (adults default **2**, children default **0**, `childAges.split(",").map(Number)`) | поиск |
| `backend/src/modules/supplier/public-supplier.controller.ts:105-131,159-178` | HTTP (anonymous) | query/body | то же (+ calendar `PriceCalendarQuery`) | публичный поиск/календарь |
| `backend/src/modules/supplier/supplier-aggregator.service.ts:244-446` | fan-out | `SupplierSearchQuery` | jobs `{code, q}` для всех adapter'ов (verbatim) | Universal Search |
| `backend/src/modules/catalog/tour-builder/tour-builder.service.ts:765,780` | partner quote | `POST /quote` `adults`, `children[].age` | локальный расчёт цены (не supplier) | конструктор туров |

**Source of truth по полям (§7):**

- `adults / children / childAges` — **frontend search form / calendar form** (никогда из `RequestTraveler[]`, из supplier-ответа, из product attributes). Хранение после создания: `productSnapshot.offer` (только путь create-tour-request, §14) и в полёте — `SupplierSearchQuery` в `SupplierOfferRef`.
- `infants` — **frontend flight form** (`FlightSearch.tsx:31,157`; `search/page.tsx:155,192`); в тур-домене **не существует** (`supplier.types.ts` — 0 hits по `infants`; `supplier.controller.ts` параметр `infants` вообще не парсит → теряется).
- `Request.travelerCount` — отдельный счётчик: `dto.adults + dto.children` (`tour-request.service.ts:261`) либо `travelers.length`/`dto.travelerCount` с проверкой согласованности (`request.service.ts:264-270`). Счётчик, **не** состав.
- Дефолты/hardcoded: `adults=2`, `children=0` (оба контроллера), возраст детей по умолчанию `5` в календарной форме (`TourDetail.tsx:150-152`).

---

## 4. SupplierSearchQuery Analysis (§14)

`backend/src/modules/supplier/supplier.types.ts:11+`:

```
service?, country?, departureCity?, destination?, geoCity?, geoResort?,
departureDateFrom/To?, nightsFrom/To?,
adults: number;          // :36  — required
children?: number;       // :37
childAges?: number[];    // :38
hotel?, hotelExternalId?, hotelStars?, suppliers?, starKeys?, room?, meal?, ...
```

- **`infants` в нём отсутствует** (grep `infants` по `supplier.types.ts` → 0 hits).
- Статус: это **de-facto canonical transport DTO** для tours/hotels — один и тот же тип используют оба HTTP-контроллера, агрегатор, все 6 адаптеров, ключ кэша цены (`supplier-offer.service.ts:204-210`) и re-check (`SupplierOfferRef.searchContext`, `supplier.types.ts:~280`). Но как **canonical composition object — его нет**: нет DOB, нет infants, нет «даты, относительно которой считается возраст», не персистится в БД (нет колонки `searchContext`; создаётся на лету в `tour-request.service.ts:115-138`, в адаптерах заново собирается из `ref.searchContext`, напр. `summertour-new.adapter.ts:458-465`).
- Флаги `adults/children/childAges` продублированы в `SupplierSearchQuery` (36-38), в interface из запроса (139-141) и в ref-типе (343-345) — тот же транспорт, три объявления.
- Фlight-домен живёт отдельно: `FlightSearchQuery.passengers: FlightPassengerCount {adults, children, infants}` (`azal/flight.types.ts:11-30`) — **вторая, не связанная с первой, репрезентация состава**.

---

## 5. Summer (§8)

Активный адаптер — **`SummertourNewAdapter`** (`supplier.module.ts:80` токен `summertour`, регистрация `:89-90` → code `SUMMERTOUR`; `SummertourAdapter` из `:8,55` в registry **не регистрируется** — используется только в юнит-тесте `summertour.zero-price.spec.ts`).

Путь:

```
query.childAges
  → buildSummerSearchRequest()   summertour.request-builder.ts:107-112  (ADULT, CHILD, AGE1..AGE3)
  → buildSummerXhrUrl()          summertour.request-builder.ts:126-167  (сериализует только ADULT:138 и CHILD:139)
  → page.evaluate(xhrUrl)        summertour-new.adapter.ts:150-186
  → Summer SAMO PRICES
```

- **`AGE1..AGE3` отбрасываются на активном XHR-пути** — `buildSummerXhrUrl` не имеет ветки для `req.AGE1/AGE2/AGE3`. Summer получает **только `ADULT` и `CHILD`** (детских возрастов не видит → price-таблица трактуется по правилам Summer без наших возрастов).
- `childAges` при этом *переносятся* в нормализованные офферы и календарные записи (`summertour-new.adapter.ts:416,711,793`) и в `bestOfferRef.searchContext` (`:714`) — т.е. в snapshot состав есть, а до Summer он не доезжает.
- Legacy/мёртвые пути: `summertour.adapter.ts:138-146` (`setSamoSelect AGE1..AGE3`, неактивный адаптер); `summertour-http.service.ts:123-125` (`AGES = childAges[0]`) — `SummertourHttpService` **нигде не инжектится** кроме экспорта модуля (`supplier.module.ts:58,230`), вызовов `fetchPrices` в src нет.
- `refreshPrice` (`summertour-new.adapter.ts:457-472`) — повторный `search()` строго по `ref.searchContext` (те же adults/children/childAges), match по `externalOfferId`, иначе `PRICE_UNAVAILABLE`.
- `infants` — N/A. DOB — не используется. **Цена зависит от adults/children; childAges до Summer не доходят.**

---

## 6. Kompas (§9)

Playwright-заполнение SAMO-формы (`kompas.adapter.ts`):

- `ADULT` — `:386`, `CHILD` — `:387-389`
- `AGE1/AGE2/AGE3` — `:390-393` (до 3 детей), тот же блок в календарном пути `:1332-1335`

Возрастные правила определяет KOMPAS (сама форма/side), TravelHUB только передаёт выборанные возрасты. `infants` — N/A. DOB — нет. **Возраста влияют на цену** (supplier считает по ним сам). Источник `childAges` — та же UI-форма.

---

## 7. Anex Tours (§10)

`anex.adapter.ts`, запрос `POST /search` через общий `AnexProvider`:

- `ADULT: params.adults` — `:270`, `CHILD: params.children` — `:271`
- **`AGES: params.children > 0 ? String(params.childAges?.[0] ?? 0) : ""` — `:272` → отправляется только ПЕРВЫЙ возраст ребёнка** (при children>1 остальные теряются)
- поле-мишень `agE1?: number|string` — `:78`
- календарные окна прокидывают `childAges` — `:462,520,610,744`

`infants` — N/A. DOB — нет. Правила возраста — на стороне Anex. **Цена зависит от adults/children + (частично) от первого возраста ребёнка.** Anex Hotels — **отдельный адаптер** (регистрации `supplier.module.ts:161` и `:190`), общий только HTTP client.

---

## 8. Anex Hotels (§10)

`anex-hotel.adapter.ts`:

- `ages = children > 0 ? Array.from({length: children}, (_, i) => childAges?.[i] ?? 0).join(",") : ""` — `:279-282` → **CSV всех возрастов детей** (недостающие → `0`)
- отправка: `ADULT: params.adults` (`:293`), `CHILD: params.children` (`:294`), `AGES: ages` (`:295`)
- документированное ожидание: комментарий `:60` — «AGES takes the CSV of ALL child ages (<5,7>), not only the first age»

`infants` — N/A. DOB — нет. **Цена зависит от adults/children/childAges (все возрасты).**

---

## 9. Kazunion (§11)

`kazunion-http.service.ts`, `buildPricesUrl`:

- `ADULT: String(params.adults ?? 2)` — `:584`, `CHILD: String(params.children ?? 0)` — `:585`
- `AGE${i+1}` для `i < min(ages.length, 4)` — `:617-619` → **до 4 возрастов** в URL
- вызовы `fetchPrices`: `kazunion.adapter.ts:333,490`; парсинг строк из `adult-N/child-N` классов — `:394-395`

`infants` — N/A. DOB — нет. **Цена зависит от adults/children/childAges (до 4).** Правила — на стороне KazUnion (SAMO-таблица).

---

## 10. AZAL (§12)

Flight-домен. Состав — **только агрегированные счётчики**:

- `FlightSearchQuery.passengers: {adults, children, infants}` (`flight.types.ts:11-30`) — **`childAges` отсутствует в типе** (и во всём flight-домене)
- `azal.adapter.ts:107-109,136-139,161-163` — маппинг счётчиков в запросы
- `azal.http.service.ts:67` `infantCount`, `:276-278` `adult_count/child_count/infant_count` (XHR поиска), `:200-204` `passengersAmount{adults,children,infants}` (календарь)
- **`childrenDatesOfBirth: null` — `azal.http.service.ts:208`** — единственное DOB-подобное поле во всём модуле `supplier/`, и оно всегда `null`

> **Ответ на вопрос §12: AZAL получает ТОЛЬКО агрегированный passenger composition; фактические DOB туристов не используются нигде (поиск, календарь, histogram).**

Aviasales (не в объёме, для паритета): `aviasales.http.service.ts:252` — счётчики, без возрастов/DOB.

---

## 11. Universal Search (§13)

- Вход: `supplier.controller.ts:109-123` (authed) / `public-supplier.controller.ts:129-131` (anonymous) → один `SupplierSearchQuery`.
- `supplier-aggregator.service.ts:244+` `searchByService(query)` → `:441-446` строит jobs `{ code, q: {...query, service} }` для всех adapter'ов, чей `serviceTypes` подходит; фильтр возможности `cap.adults {min,max}` против `query.adults` — `:20,230-233`.
- **Единого canonical composition object, отличного от `SupplierSearchQuery` (tours/hotels) и `FlightSearchQuery.passengers` (flights), не существует.** Composition нигде не вычисляется — только транслируется (UI → HTTP → aggregator → adapter).
- `infants` в тур-ветке Universal Search отбрасывается на контроллере (поле не парсится).

---

## 12. Calendar (§17)

Цепочка:

```
TourDetail form (TourDetail.tsx:52-54: adults=2, children, childAges; :150-152 default age 5)
  → MonthlyCalendar baseQuery (MonthlyCalendar.tsx:259-266)
  → POST /public/supplier/price-calendar   (public-supplier.controller.ts:231-246)
  → PriceCalendarQuery { adults, children?, childAges?, nights, dateFrom, dateTo, ... }  (supplier.types.ts, «Passenger composition»)
  → supplier-offer.service.getPriceCalendar → adapter.getPriceCalendar
```

- Календарь использует **те же traveler-параметры**, что и offer/request-путь: те же поля, тот же тип-транспорт, тот же парсер возраста (`childAges.split(",").map(Number)`) — паритет подтверждён (§17 «проверить» → **да, одинаковые**).
- Календарные записи возвращают офферы с `adults/children/childAges` (`summertour-new.adapter.ts:793`), и именно оттуда `OfferModal` берёт состав для создания Request (§13).
- §17 «кейс $3,755 vs $3,948» — **не дефект**: в календаре были разные варианты, пользователь выбрал Offer за $3,948 (решение владельца, вопрос закрыт). В рамках аудита дефектом не считается и не исследуется дальше.

---

## 13. Offer Selection (§18)

При выборе Offer из календаря **composition сохраняется и не пересчитывается**:

- `frontend/components/supplier/OfferModal.tsx:320-344` → `createTourRequest({ adults: offer.adults, children: offer.children, childAges: offer.childAges.length ? offer.childAges : undefined, ... })` (`:327-329`)
- Backend `tour-request.service.ts:40-66` (DTO) → `searchContext` (`:115-123`) → `offerSnapshot` с `adults/children/childAges` (`:231-248`)

Request **не строит состав заново** — он наследует состав выбранной calendar-offer-строки (который, в свою очередь, пришёл из UI-формы).

---

## 14. Request Creation (§19)

**Два разных пути создания Request — и оба НЕ ведут от `RequestTraveler` к supplier price.**

**Путь A — `POST /create-request` (`tour-request.service.createTourRequest`):**

```
dto (adults/children/childAges из OfferModal)
  → searchContext: SupplierSearchQuery          :115-123
  → refreshPrice({supplierCode, externalOfferId, searchContext})  :135-145
  → displayedPrice = recheck.amount             :145-146
  → commercialSnapshot из recheck.pricing       :204-213
  → offerSnapshot {adults, children, childAges, ...}  :231-248
  → Request { travelerCount: adults+children, productSnapshot:{..., offer} }  :250-300
```

RequestTraveler в этом пути **не создаётся**. Критическая разница из §19: фактическая цепочка — **`RequestTraveler → composition → supplier price` ОТСУТСТВУЕТ**; есть `dto/offer → composition → supplier price`, а `RequestTraveler` вообще не участвует.

**Путь B — `POST /api/v1/buyer/requests` (`order/request.service.createRequest:248+`):**

- composition = **только количество**: `travelerCount` из `dto.travelerCount` или `travelers.length` (`:264-270`), сами travelers — `createMany` `:345-356`
- `childAges/children` отдельно **не существуют**; `refreshPrice` в `request.service.ts` **не вызывается вообще** (нет ни одного вызова), supplier price на создании не запрашивается; `displayedPrice` приходит из dto (`:312`)

**DB-подтверждение (SELECT, db `travelhub1`):**

| referenceNumber | travelerCount | productSnapshot.offer | commercialSnapshot | traveler rows |
|---|---|---|---|---|
| MKT-REQ-00000401 (путь A) | 2 | `{adults:2, children:0, childAges:[], supplierCode:"KAZUNION", ...}` | — | 0 |
| MKT-REQ-00000601 (путь B) | 2 | **отсутствует** (только productId/productCode/productType/productTitle) | null | 2 |
| MKT-REQ-00000602 (путь B) | 2 | **отсутствует** | null | 2 (birthDate 1990-02-02, 1992-03-03) |

---

## 15. Customer Accept (§20)

`order/request.service.ts:1074+` `customerAccept`:

1. Проверки статуса/дедлайна (`:1076-1081`)
2. `await this.assertTravelersReadyForCommercialStep(request)` — `:1087` (дефиниция `:689`): проверяет **только** наличие FIO+birthDate у travelers и соответствие `travelerCount` — «readiness», без расчёта состава и цены
3. pin requirements + `freezeForAcceptance(snapshot, acceptedMoney, acceptedCurrency, now)` — `:1142` (заморозка денежных условий)

Ответы на вопросы §20 (только фиксация):

- composition **не пересчитывается** — нет
- supplier price **не пересчитывается** — нет (`refreshPrice` в `request.service.ts` отсутствует)
- старый commercial snapshot **не инвалидируется** — нет (наоборот, замораживается)
- новый Offer **не требуется** — да
- используется **старая (зафиксированная при создании) цена** — да

Если traveler data меняется между creation и accept: `productSnapshot.offer.composition` и цена остаются прежними; связь «travelerCount ↔ travelers.length» обеспечивается только `assertTravelersMatchCount` (§10 предыдущей фазы), т.е. защищено **количество**, но не соответствие состава (возрастов) замороженному offer-snapshot'у.

---

## 16. Commercial Snapshot (§21)

`backend/src/modules/pricing/commercial-snapshot.ts`, `interface CommercialSnapshot`:
`supplierCode, serviceType, supplierPrice, supplierCurrency, markupRate, markupAmount, markupRuleCode, markupRuleVersion, publicPrice, individualDiscount, discountType, discountValue, discountAmount, customerFinalPrice, customerCurrency, priceSource, pricingCalculatedAt, supplierPriceFetchedAt, supplierPriceExpiresAt`.

> **Явно зафиксировано: `adults / children / childAges / infants` в `commercialSnapshot` СОДЕРЖАТСЯ НЕТ** — только деньги и TTL-таймстемпы. Composition хранится отдельно: `productSnapshot.offer` (путь A) и `Request.travelerCount` (оба пути).

---

## 17. Price Freshness (§22)

Что есть:

1. **TTL**: `supplierPriceFetchedAt/ExpiresAt` в snapshot (`tour-request.service.ts:210-211`), TTL оффера 5 мин (`summertour-new.adapter.ts:417`), `priceCacheTtlMs = 5*60*1000` (`supplier.module.ts:108`).
2. **Ключ кэша цены включает состав**: `SupplierCacheService.derivePriceKey(code, externalOfferId, adults, children, childAges)` — `supplier-offer.service.ts:204-210`. Изменение composition при том же offer дало бы другой ключ.
3. **Re-check по замороженному контексту**: `refreshPrice(ref)` использует `ref.searchContext` (`:196-224`; адаптеры пересобирают запрос из `searchContext`, напр. `summertour-new.adapter.ts:458-465`), т.е. цена перепроверяется относительно состава, с которым оффер был найден, а **не** относительно текущих `RequestTraveler`.

Защита от сценария «offer создан → composition изменился → старая цена»: фактическая защита = **та, что composition из travelers вообще не читается**. Если в будущем подключить DOB-производный состав, то без gate'а в `customerAccept`/`createTourRequest` старый snapshot будет молча расходиться с реальностью — это и есть главный риск (§24).

---

## 18. Existing Age Rules (§23)

Инвентарь (без оценки «правильно/неправильно»):

| Rule | Location | Used by | Supplier/Product |
|---|---|---|---|
| `infants = age < 2`, `kids = age >= 2 && age < 12` | `catalog/tour-builder/tour-builder.service.ts:917-918` | `quote()` `:765` → `POST /catalog/tour-builder/:id/quote` (`tour-builder.controller.ts:325-332`) | TravelHUB partner-built tour flight component |
| `childPct ?? 75`, `infantPct ?? 10` | `tour-builder.service.ts:915-916` | `quote()` | TravelHUB |
| insurance child `< 12`, `childCoefficient ?? 0.6` | `tour-builder.service.ts:953-954` | `quote()` | TravelHUB |
| transfer capacity по `adults + children` (без возрастов) | `tour-builder.service.ts:934` | `quote()` | TravelHUB |
| `AGES = childAges[0]` (первый ребёнок) | `supplier/anex/anex.adapter.ts:272` | Anex Tours `/search` | supplier-side (правила Anex) |
| `AGES = CSV всех возрастов` | `supplier/anex/anex-hotel.adapter.ts:279-295` | Anex Hotels `/search` | supplier-side |
| `AGE1..AGE3` в форме | `supplier/kompas/kompas.adapter.ts:390-393,1332-1335` | Kompas SAMO | supplier-side |
| `AGE1..AGE4` в URL | `supplier/kazunion/kazunion-http.service.ts:617-619` | KazUnion PRICES | supplier-side |
| `AGE1..AGE3` в req, **но НЕ сериализуются в XHR** | `summertour.request-builder.ts:107-112` vs `:126-167` | Summer (активный путь) — **gap** | Summer (правила Summer, возрастов не видит) |
| `AGES = childAges[0]` (мёртвый код) | `summertour/summertour-http.service.ts:123-125` | `SummertourHttpService` — вызовов нет | dead |
| `setSamoSelect AGE1..3` (legacy адаптер, не в registry) | `summertour/summertour.adapter.ts:138-146` | юнит-тесты | legacy |
| только counts, `childrenDatesOfBirth: null` | `azal/azal.http.service.ts:200-208,276-278` | AZAL поиск/календарь | supplier-side |
| `birthDate: REQUIRED/OPTIONAL/NOT_REQUESTED` по типу продукта | `catalog/traveler-requirements.ts:90-184,327` | валидация/pinning (§3) | не возрастное правило |
| `passportExpiry` margin 183 дней | `order/passport-expiry.ts` (§14 предыдущей фазы) | readiness/finalConfirm/booking gates | не возрастное правило |

**`birthDate → age` функций НЕ существует**: grep `getAge|calculateAge|ageFrom|ageAt|computeAge|ageFromBirth` по `backend/src` + `frontend/src` (без generated/spec) — 0 релевантных hits (только совпадение `lastMessageAt`). Никаких универсальных порогов «age < 18/12/2 = child» в supplier-цепочке нет и не вводилось.

**§25 (дата расчёта возраста): не применимо** — расчёта возраста нет, поэтому и «относительно какой даты» код не определяет. Для tour-builder quote возраст приходит уже в годами из запроса (`children[].age`, `tour-builder.service.ts:780`) и трактуется без привязки к дате поездки. Факт зафиксирован, поведение не менялось.

---

## 19. DOB Usage (§24)

```text
RequestTraveler.birthDate
        │
        ▼
     NOWHERE  (для composition / supplier-запросов)
```

Единственные потребители `birthDate` (помимо хранения): валидация формата (`request-travelers.ts:54-81`), readiness/completeness (`:116-117`, `request.service.ts:706`), detail-проекция (`:509-519`), копирование в OrderTraveler (`order.service.ts:757-785`), Booking (`booking.subscribers.ts:254`), Voucher (`voucher.consumer.ts:173`), PII-маскировка/редактирование (`order.service.ts:1854,1944-2007`), requirements-матрица (`traveler-requirements.ts`).

В модуле `backend/src/modules/supplier/**` — **ни одного** упоминания `birthDate` (кроме `azal.http.service.ts:208`, где поле `childrenDatesOfBirth` всегда `null`).

**§25:** дата, относительно которой считался бы возраст, **кодом не определяется** (расчёта нет). Кандидаты-семантики (`departureDate` из `requestedServiceDate`/offer, `checkIn`, `today`) существуют в данных, но нигде не связаны с возрастом.

---

## 20. Supplier Matrix (§26)

| Supplier | adults | children | childAges | infants | DOB used? | Age rule location | Price affected? |
|---|---|---|---|---|---|---|---|
| Summer | ✅ `ADULT` (`summertour.request-builder.ts:138`) | ✅ `CHILD` (`:139`) | ⚠️ **строится (`:110-112`), но НЕ отправляется** (нет в `buildSummerXhrUrl:126-167`) | N/A (нет в тур-DTO) | ❌ нет | правила Summer на стороне Summer; код年龄-правил в TravelHUB отсутствует | да — adults/children; **childAges НЕ влияют** (не доходят) |
| Kompas | ✅ `ADULT` (`kompas.adapter.ts:386`) | ✅ `CHILD` (`:388`) | ✅ `AGE1..AGE3` (`:390-393`, календарь `:1332-1335`) | N/A | ❌ нет | форма SAMO Kompas (supplier-side) | да — все три поля |
| Anex Tours | ✅ `ADULT` (`anex.adapter.ts:270`) | ✅ `CHILD` (`:271`) | ⚠️ только **первый** возраст: `AGES = childAges[0]` (`:272`) | N/A | ❌ нет | supplier-side (`/search` AGES) | да — adults/children + первый возраст |
| Anex Hotels | ✅ `ADULT` (`anex-hotel.adapter.ts:293`) | ✅ `CHILD` (`:294`) | ✅ CSV всех: `:279-282,295` | N/A | ❌ нет | supplier-side (AGES = CSV, документировано `:60`) | да — все три поля |
| Kazunion | ✅ `ADULT` (`kazunion-http.service.ts:584`) | ✅ `CHILD` (`:585`) | ✅ `AGE1..AGE4` (`:617-619`) | N/A | ❌ нет | supplier-side (SAMO-таблица) | да — все три поля (до 4 возрастов) |
| AZAL | ✅ `adult_count/passengersAmount.adults` (`azal.http.service.ts:276,201`) | ✅ `child_count` (`:277,202`) | ❌ **поле не существует** (`flight.types.ts` — 0 hits) | ✅ `infant_count/infants` (`:278,203`) | ❌ нет — `childrenDatesOfBirth: null` (`:208`) | правила AZAL (только счётчики) | да — счётчики adults/children/infants |

Легенда: ✅ передаётся, ⚠️ передаётся частично/не в активном пути, ❌ не передаётся/не существует, N/A — поля нет в домене.

---

## 21. Architecture Map (§27)

Фактическая карта (вместо ожидаемой `birthDate → ?????? → composition`):

```text
[Существующий поток — composition]
UI search form / calendar form          RequestTraveler (order.RequestTraveler)
  TourSearch:56-58 / TourDetail:52-54       firstName, lastName, birthDate
  CompactSearch:83-86 → URL                     │
        │                                       ▼
        ▼                                  NOWHERE ──(не участвует)──┐
adults / children / childAges / infants                               │
        │                                                             │
        ▼                                                             │
HTTP supplier.controller:109-123 / public-supplier.controller:129-178  │
        │                                                             │
        ▼                                                             │
SupplierSearchQuery {adults, children?, childAges?}   ← flights: FlightSearchQuery.passengers
        │                                                             │
        ├──► SupplierAggregatorService.searchByService:244 ──┐        │
        │                                                     ▼        │
        │              ┌──────────┬──────────┬────────┬─────────┬─────┴──┐
        │              ▼          ▼          ▼        ▼         ▼        │
        │           Summer     Kompas    Anex×2  Kazunion     AZAL      │
        │         (ADULT/CHILD (ADULT/   (ADULT/ (ADULT/  (adults/       │
        │          only;       CHILD+     CHILD+  CHILD+   children/     │
        │          AGE dropped) AGE1-3)   AGES)   AGE1-4)  infants)      │
        │              │          │          │        │         │        │
        │              └──────────┴────┬─────┴────────┘         │        │
        │                             ▼                        ▼        │
        │                     Supplier Price  ◄──── counts only, DOB=null
        │                             │
        ▼                             ▼
createTourRequest:115-138 ── refreshPrice:135 ── displayedPrice
        │
        ▼
Request { travelerCount, productSnapshot.offer{adults,children,childAges}, commercialSnapshot{money only} }
        │
        ├── customerAccept:1087 (readiness: FIO+birthDate есть?) ── freezeForAcceptance:1142
        └── Request → Order:757-785 (копия FIO+birthDate в OrderTraveler)
```

**Разрыв ровно один: между `birthDate` и `adults/children/childAges` — кода нет.**

---

## 22. Gaps (§22) + §28 A–D

### A. Что уже существует и работает
- Сквозной транспорт состава: UI-форма → URL/DTO → `SupplierSearchQuery` → все 6 адаптеров → supplier price (`supplier.controller.ts:109-123`, `supplier-aggregator.service.ts:441-446`).
- Заморозка состава при создании offer-based Request: `productSnapshot.offer{adults,children,childAges}` (`tour-request.service.ts:231-248,267-275`) + `travelerCount` (`:261`).
- Re-check цены по замороженному `searchContext` с TTL и кэш-ключом, учитывающим состав (`supplier-offer.service.ts:196-224,204-210`).
- Kompas / Anex Hotels / Kazunion передают возрастные параметры; Anex Tours — частично; AZAL — корректные агрегированные счётчики.
- `RequestTraveler` lifecycle: создание/чтение/обновление/удаление, валидация FIO+birthDate, readiness-gate на accept, копирование в Order/Booking/Voucher.

### B. Что существует, но используется только частью supplier integrations
- Возрастные параметры (`childAges`): участвуют у Kompas, Anex Hotels, Kazunion; **частично** у Anex Tours (1-й ребёнок); **не участвуют** у Summer (отброшены в XHR); отсутствуют у AZAL (не предусмотрено доменом).
- `infants`: только flight-домен (`FlightSearch.passengers`); в тур-DTO поля нет, контроллер его не парсит → теряется при поиске туров.
- Две несвязанные репрезентации состава: `SupplierSearchQuery {adults,children,childAges}` vs `FlightSearchQuery.passengers {adults,children,infants}`.

### C. Что существует, но не связано с RequestTraveler
- Весь composition-стек (§3) и supplier-запросы — не читают `RequestTraveler` вообще.
- `commercialSnapshot` (только деньги) — composition не хранит.
- Календарь/offer/refreshPrice — работают от UI-состава и `searchContext`, не от travelers.
- Age-правила tour-builder (`:915-919,953-954`) — считаются от `children[].age` partner-quote, не от DOB.
- Readiness-gate на accept (`:689,1087`) проверяет только **наличие** FIO+birthDate, не соответствие состава.

### D. Чего сейчас нет
1. Связи `birthDate → adult/child/infant` (никакой функции).
2. Composition-полей в `Request` (кроме `travelerCount`) и в `commercialSnapshot`.
3. `childAges`/`infants` в тур-пути для Summer (не отправляются) и infants вовсе.
4. Сверки «текущие RequestTraveler ↔ замороженный offer-snapshot» при customerAccept.
5. Composition-снапшота в пути B (`POST /buyer/requests`) — там вообще нет ни ages, ни offer-snapshot, ни supplier recheck.
6. Персистентного canonical composition object (в БД нет ни колонки, ни JSON-поля с составом, кроме `productSnapshot.offer` в пути A).
7. Определения «даты возраста» (as-of date) — потому что расчёта нет.

---

## 23. Recommended Integration Point (§28 E, критерий 3)

**Безопасная точка: граница построения `SupplierSearchQuery` + readiness-граница accept, как СВЕРКА, а не как новый источник цен.**

1. **Основная точка — `backend/src/modules/supplier/tour-request.service.ts:115-138`**: единственное место, где composition превращается в `searchContext` для supplier re-check. Здесь же (в новой доменной функции, вызываемой рядом, не внутри адаптер-цикла) вычислять состав из `RequestTraveler[]` (position + birthDate) и сравнивать с замороженным `productSnapshot.offer{adults,children,childAges}` / `travelerCount`. Расхождение → блокирующая ошибка/флаг, **без** автоматического пересчёта цены.
2. **Gate-точка — `order/request.service.ts:689` `assertTravelersReadyForCommercialStep` (вызов `:1087`, также `:1324`)**: логическое место для той же сверки «derived composition == frozen composition» в момент customerAccept — единственная граница, где изменения travelers должны что-то значить.
3. **Правила возраста — делегировать адаптеру supplier'а**: каждый адаптер уже владеет транспортом возрастов и правилами поставщика (`AGES` / `AGE1..4` / counts). Реализовать DOB→pax-class нужно как **адаптерный метод** (или общий helper с правилами, которые поставляет адаптер), а не как глобальные пороги в сервисе — это единственный способ не создать «вторую параллельную систему age-правил» (§4 запрещает универсальные пороги, а правила Summer/Kompas/Anex/Kazunion/AZAL в коде не описаны и должны приходить от поставщиков).
4. **Не трогать на этой фазе**: ценовой цикл (`refreshPrice`, `displayedPrice`, `commercialSnapshot`, markup) — запрет price changes; DOB не отправлять поставщикам (у AZAL есть `childrenDatesOfBirth`, но он всегда `null` — раскрывать PII нужно отдельным решением).
5. Для пути B (`POST /buyer/requests`) composition-снапшота нет вообще — подключение там потребует отдельного design-решения (с чего брать состав: из travelers.length уже есть, возрастов нет).

**Ответ на критерий 3 (кратко):** подключать `birthDate` в точке **`tour-request.service.ts:115-138` + `request.service.ts:689/1087`** в режиме сверки против замороженного `productSnapshot.offer`, с возрастными правилами, поступающими **от адаптера supplier'а** — так не создаётся вторая система правил и не ломаются текущие цены (ценовой цикл не пересчитывается).

---

## 24. Risks

1. **Любой реальный пересчёт composition меняет цену** — а это запрещено текущей фазой; интеграция «сверка, не пересчёт» обязательна.
2. **Возрастные правила supplier'ов в TravelHUB-коде не описаны** — существующие правила находятся у поставщиков; без внешней документации/верификации любой DOB→класс будет домысливанием.
3. **Summer не получает возраста вовсе** (§5): даже perfect DOB→childAges не изменит цену Summer, пока не починена сериализация `AGE1..AGE3` в `buildSummerXhrUrl` — а это уже изменение цены поставщика (отдельное решение).
4. **Anex Tours передаёт только первый возраст** — для children>1 сверка «derived vs snapshot» будет формальной, если не унифицировать транспорт.
5. **Два представления состава** (tours vs flights): подключение только в тур-ветке оставит flight-домен без связи с DOB.
6. **PII**: DOB не должен уезжать к поставщикам без отдельного privacy-решения (`childrenDatesOfBirth: null` — существующий прецедент «не отправляем»).
7. **Кэш цен зависит от composition** (`derivePriceKey`, `supplier-offer.service.ts:204-210`): любое изменение ключа/состава влияет на hit-rate и на повторные обращения к поставщикам (каптча/латентность Summer, Kompas).
8. **Путь B (`/buyer/requests`)** не имеет offer-snapshot — сверка там невозможна без нового хранения состава.

---

## 25. Files / Functions / Code Locations

| Объект | Файл:строки |
|---|---|
| `SupplierSearchQuery` | `backend/src/modules/supplier/supplier.types.ts:11,36-38` (+ 139-141, 343-345) |
| `SupplierOfferRef.searchContext` | `supplier.types.ts` (~280) |
| `PriceCalendarQuery` (composition) | `supplier.types.ts` (`adults/children/childAges`, «Passenger composition») |
| `FlightSearchQuery/PassengerCount` | `backend/src/modules/supplier/azal/flight.types.ts:11-30` |
| HTTP вход (tours) | `supplier/supplier.controller.ts:102-123` |
| HTTP вход (public + calendar) | `supplier/public-supplier.controller.ts:105-131,159-178,231-246` |
| Агрегатор/фанд-аут | `supplier/supplier-aggregator.service.ts:244-446,230-233` |
| Создание Request + composition freeze | `supplier/tour-request.service.ts:40-66,115-145,204-213,231-248,250-300` |
| Recheck / кэш-ключ по составу | `supplier/supplier-offer.service.ts:196-224,204-210` |
| Summer builder (gap AGE) | `supplier/summertour/summertour.request-builder.ts:107-112,126-167` |
| Summer активный адаптер | `supplier/summertour/summertour-new.adapter.ts:150-186,416,457-472,793` |
| Summer legacy/dead | `summertour/summertour.adapter.ts:138-146`; `summertour/summertour-http.service.ts:123-125` |
| Kompas возрасты | `supplier/kompas/kompas.adapter.ts:386-393,1332-1335` |
| Anex Tours возраст | `supplier/anex/anex.adapter.ts:270-272,78` |
| Anex Hotels возраст | `supplier/anex/anex-hotel.adapter.ts:279-295,60` |
| Kazunion возраст | `supplier/kazunion/kazunion-http.service.ts:584-585,617-619`; вызовы `kazunion.adapter.ts:333,490` |
| AZAL состав/DOB-null | `supplier/azal/azal.http.service.ts:67,200-208,276-278`; `azal.adapter.ts:107-163` |
| Регистрация адаптеров | `supplier/supplier.module.ts:80,89-137,161,190,211,215` |
| UI состав (tours) | `frontend/components/marketplace/search/TourSearch.tsx:56-58,116-118,298-300,580` |
| UI состав (URL) | `frontend/components/marketplace/CompactSearch.tsx:83-86`; `HeroSearch.tsx:97` |
| UI состав (search page) | `frontend/app/search/page.tsx:153-155,189-193,267-269` |
| UI состав (calendar) | `frontend/components/supplier/TourDetail.tsx:52-54,75-77,150-152`; `MonthlyCalendar.tsx:259-266` |
| Offer → Request | `frontend/components/supplier/OfferModal.tsx:320-344`; `lib/supplier-api.ts:431-435` |
| RequestTraveler model | `backend/prisma/schema.prisma:2472-2488` (`Request.travelerCount` `:2422`) |
| RequestTraveler lifecycle | `order/request.service.ts:248,345-356,526,565,618,669` |
| readiness / accept | `order/request.service.ts:689,1074,1087,1142,1324` |
| Request → Order | `order/order.service.ts:757-785` |
| Валидация FIO+DOB | `order/request-travelers.ts:48-81,116-117` |
| Requirements (birthDate) | `catalog/traveler-requirements.ts:90-184,327,362` |
| commercialSnapshot | `backend/src/modules/pricing/commercial-snapshot.ts` (`interface CommercialSnapshot`) |
| tour-builder age rules | `catalog/tour-builder/tour-builder.service.ts:765,780,915-919,934,953-954`; `tour-builder.controller.ts:187-203,325-332` |

---

## 26. Tests Reviewed

**Выполнены (запуск существующих тестов, разрешён §3):**

```text
npx jest summertour.request-builder supplier-offer.service request-travelers --runInBand   (backend, 08.10.2026)
→ Test Suites: 3 passed, 3 total | Tests: 37 passed, 37 total | Time: ~17s
  - src/modules/supplier/summertour/summertour.request-builder.spec.ts  PASS
  - src/modules/supplier/supplier-offer.service.spec.ts                 PASS
  - src/modules/order/request-travelers.spec.ts                          PASS
```

**Прочитаны (code review тестов):** `summertour.request-builder.spec.ts` (маппинг Summer-параметров), `supplier-offer.service.spec.ts` (search/refreshPrice/calendar с `adults` в логах), `anex.adapter.spec.ts`, `anex-hotel.adapter.spec.ts`, `anex.provider.spec.ts`, `kompas.adapter.spec.ts`, `kazunion.adapter.spec.ts`, `price-calendar.spec.ts`, `supplier-aggregator.service.spec.ts`, `request-travelers.spec.ts`, `tour-builder.service.spec.ts`, `summertour.zero-price.spec.ts` (единственный потребитель legacy `SummertourAdapter`).

Ни один тест в рамках аудита не изменялся.

---

## 27. Final Verdict (§30)

```text
C — Composition is currently supplied only by search UI
    and RequestTraveler.birthDate is not connected.
```

**Подтверждение кодом:**

1. Composition входит только из UI: `TourSearch.tsx:56-58` / `CompactSearch.tsx:83-86` / `search/page.tsx:267-269` / `TourDetail.tsx:52-54` → `supplier.controller.ts:109-123` → `SupplierSearchQuery` (`supplier.types.ts:36-38`) → адаптеры (`supplier-aggregator.service.ts:441-446`).
2. `RequestTraveler.birthDate → NOWHERE` для состава: 0 hits в `supplier/**`, отсутствие любой `birthDate→age` функции (grep backend+frontend), использование только в валидации/readiness/копировании в Order (`request-travelers.ts:48-81`, `request.service.ts:689,1087`, `order.service.ts:757-785`).
3. Состав замораживается мимо travelers: `productSnapshot.offer{adults,children,childAges}` + `travelerCount` (`tour-request.service.ts:231-248,261`); цена recheck'ится по `searchContext` (`:115-145`), `customerAccept` — только readiness + заморозка денег (`request.service.ts:1087,1142`).

**Почему не другие варианты:** `A` отклонён — «composition engine» на базе DOB отсутствует как класс; `B` (fragmented by supplier) — частично верен (§26: Summer теряет возрасты, Anex Tours шлёт только первый, flights имеют другую модель), но fragmentation описывает *транспорт*, а не источник состава; `D` отклонён — безопасная точка интеграции существует без новой абстракции (§23: граница `SupplierSearchQuery` + readiness-gate + делегирование правил адаптеру).

---

## Git / Evidence (§32)

```text
HEAD:     75c6bea (fix(request): keep convert action for product-less requests (Hotel Identity Fix B))
Branch:   master
git status: 154 entries — 153 pre-existing (не тронуты аудитом) + этот отчёт
            (промпт `TRAVELHUB_TRAVELER_COMPOSITION_READ_ONLY_AUDIT_PROMPT.md` — untracked, создан владельцем);
            аудит НЕ выполнял commit/push, НЕ изменял код, схему, миграции, цены, данные.
```

**Files inspected (ключевые, полный список — §25):**
`supplier.types.ts`, `supplier.controller.ts`, `public-supplier.controller.ts`, `supplier.module.ts`, `supplier-aggregator.service.ts`, `supplier-offer.service.ts`, `tour-request.service.ts`, `summertour.request-builder.ts`, `summertour-new.adapter.ts`, `summertour.adapter.ts`, `summertour-http.service.ts`, `kompas.adapter.ts`, `kazunion-http.service.ts`, `kazunion.adapter.ts`, `anex.adapter.ts`, `anex-hotel.adapter.ts`, `anex.provider.ts`, `azal.http.service.ts`, `azal.adapter.ts`, `flight.types.ts`, `aviasales.http.service.ts`, `order/request.service.ts`, `order/request.controller.ts`, `order/request-travelers.ts`, `order/order.service.ts`, `order/passport-expiry.ts` (контекст), `pricing/commercial-snapshot.ts`, `catalog/traveler-requirements.ts`, `catalog/tour-builder/tour-builder.service.ts`, `catalog/tour-builder/tour-builder.controller.ts`, `documents/voucher.consumer.ts`, `booking/booking.subscribers.ts`, `prisma/schema.prisma`, `frontend/components/marketplace/{CompactSearch,HeroSearch}.tsx`, `frontend/components/marketplace/search/{TourSearch,FlightSearch,ChildAges}.tsx`, `frontend/app/search/page.tsx`, `frontend/components/supplier/{TourDetail,MonthlyCalendar,OfferModal,OfferDetailsModal}.tsx`, `frontend/lib/{supplier-api,flight-api}.ts` — плюс тестовые spec-файлы (§26).

**Tests executed:** `npx jest summertour.request-builder supplier-offer.service request-travelers --runInBand` → **3 suites / 37 tests PASS** (единственный прогон; ничего не падало).

**Database reads (только SELECT / information_schema, db `travelhub1`):**
1. `SELECT table_schema, table_name ... information_schema.tables WHERE table_name ILIKE '%request%'` (обход по `travelhub` → `travelhub1`, т.к. основная схема `order` живёт в `travelhub1`);
2. `SELECT referenceNumber, travelerCount, status, productSnapshot->'offer', displayedPrice, travelerCount-join FROM "order"."Request" WHERE referenceNumber IN ('MKT-REQ-00000601','MKT-REQ-00000401','MKT-REQ-00000602')`;
3. `jsonb_pretty(productSnapshot), jsonb_pretty(commercialSnapshot)` для `MKT-REQ-00000601/602`;
4. `information_schema.columns` для `order.RequestTraveler`;
5. `SELECT position, birthDate::date FROM "order"."RequestTraveler" ... WHERE referenceNumber='MKT-REQ-00000602'`.
Записи не изменялись (никаких INSERT/UPDATE/DELETE).

---

## КРИТЕРИЙ ЗАВЕРШЕНИЯ

### 1. Откуда сейчас берутся `adults / children / childAges / infants`?
Из числовых полей UI-форм поиска/календаря (`TourSearch.tsx:56-58`, `CompactSearch.tsx:83-86`, `search/page.tsx:267-269`, `TourDetail.tsx:52-54`, `FlightSearch.tsx:30-31`), переданных через HTTP (`supplier.controller.ts:102-119`, `public-supplier.controller.ts:129-178`) в `SupplierSearchQuery {adults, children?, childAges?}` (дефолты `adults=2`, `children=0`); `infants` — только в flight-форме → `FlightSearchQuery.passengers`. Дополнительно: `Request.travelerCount` (счётчик из dto/`travelers.length`) и partner tour-builder quote (`children[].age`). Из `RequestTraveler`, supplier-ответов и product attributes — **не берутся нигде**.

### 2. Какие правила определения состава реально используются каждым supplier'ом?
Правила живут у поставщиков и выражены транспортом возрастов: **Summer** — только ADULT/CHILD (AGE1-3 строятся, но не сериализуются в XHR); **Kompas** — ADULT/CHILD + AGE1..3 в форме; **Anex Tours** — ADULT/CHILD + `AGES` только первого ребёнка; **Anex Hotels** — ADULT/CHILD + `AGES` CSV всех детей; **Kazunion** — ADULT/CHILD + AGE1..4 в URL; **AZAL** — только счётчики adults/children/infants, `childrenDatesOfBirth: null`. Собственных age-порогов TravelHUB в supplier-цепочке нет; хардкод-пороги (<2, 2-11, <12) существуют только в partner tour-builder quote и к supplier-ценам отношения не имеют. `birthDate` не используется никем.

### 3. В какой точке безопасно подключить `RequestTraveler.birthDate`?
На границе построения `SupplierSearchQuery` — `tour-request.service.ts:115-138` — и на readiness-границе `request.service.ts:689/1087` в режиме **сверки** «состав из `RequestTraveler[]` ↔ замороженный `productSnapshot.offer`/`travelerCount`», с возрастными правилами, поступающими **от адаптера конкретного supplier'а** (не универсальными порогами). Ценовой цикл (`refreshPrice`/`displayedPrice`/`commercialSnapshot`) на этой фазе не пересчитывается — цены не ломаются, вторая параллельная система age-правил не создаётся. Подробно — §23.

**Аудит завершён. Следующая implementation-фаза не запускалась (§29) — решение за владельцем.**
