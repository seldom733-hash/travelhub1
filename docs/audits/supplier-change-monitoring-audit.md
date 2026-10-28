# Supplier Change Monitoring — Read-Only Audit (Navitravel)

**Дата аудита:** 2026-10-24
**Проверенная ветка/commit SHA:** `master` @ `fbe719b4e2a4ca834d0221ed84981a224f651e82` (+ незакоммиченные аудиты 29–82; изменения кода не вносились)
**Режим:** исключительно read-only. Исходный код, миграции, конфигурация, база данных не изменялись. Синхронизации не запускались, к реальным API поставщиков запросов не отправлялось.
**Результат:** `docs/audits/supplier-change-monitoring-audit.md` (этот файл).

---

## 1. Краткое резюме текущего состояния

Navitravel имеет **6 гостиничных/туроператорских интеграций** (ANEX, KOMPAS, KAZUNION, VOYAGER, SUMMERTOUR, FSTRAVEL), все — **search/sync-only**: они получают цены/предложения и материализуют их в `catalog."Product"` (TOUR/HOTEL). Плюс 2 **авиационные** интеграции (AZAL, AVIASALES), которые в гостиничный контур не входят (поставляют авиаперелёты и справочники аэропортов).

**Мониторинг изменений у поставщиков на момент аудита НЕ реализован.** Есть только:

- ручные точки запуска синхронизации (HTTP-эндпоинты с `@RequirePermissions("supplier.search.manage")` и CLI-скрипты);
- in-memory счётчики в результатах синка (`newCards`, `updatedCards`, `unchangedCards`, `errors[]` и т. п.) — **не персистятся**;
- логирование в stdout (Nest `Logger`), без файлов/агрегатора;
- `GET /supplier/metrics` и `GET /supplier/adapters` — in-memory срез (`supplier-offer.service.ts` L402–412, `supplier-resilience.service.ts` L152–156);
- `outbox-worker` для доменных событий (не для данных поставщиков) с retry/FAILED-очередью (`eventbus/outbox-worker.service.ts` L37–125).

**Что делает синк:** только **upsert** (`INSERT ... ON CONFLICT` / `product.findFirst + update`). Никакой синк-сервис **не удаляет и не деактивирует** карточки, отсутствующие в ответе поставщика. Поэтому:

- **ложного исчезновения** (массового отключения объектов из-за сбоя поставщика) **не происходит**;
- обратная проблема — **«залипание» устаревших карточек**: объект, исчезнувший у поставщика, остаётся `PUBLISHED` навсегда, пока админ вручную не архивирует.

**История изменений отсутствует:** `ProductHistory` содержит **0 строк** (SQL-проверка 2026-10-24), `TariffHistory` пишется только ручным сервисом rate-plan (не синком), `SupplierFxRateHistory` — только FX. `HotelSupplierRef` имеет `firstSeenAt/lastSeenAt`, но обновляется только скриптом `hotel-registry.ts`, последний запуск 2026-10-22. `SupplierGeoLink` имеет `createdAt/updatedAt`, но только для 4 из 6 поставщиков.

**Факт массовой архивации:** 483 `ARCHIVED` карточек (все с `updatedAt = 2026-10-22 14:02:55.896`, единый bulk-штамп, без `ProductHistory`) — произведено не синком, а внешней операцией; происхождение не восстановимо из кода.

---

## 2. Матрица возможностей по поставщикам

Статусы: `IMPLEMENTED` — подтверждено кодом; `PARTIAL` — частично; `NOT_IMPLEMENTED` — проверено, но нет; `UNKNOWN` — из кода не выводится.

| Возможность | ANEX | KOMPAS | KAZUNION | VOYAGER | SUMMERTOUR | FSTRAVEL |
|---|---|---|---|---|---|---|
| Страны | IMPLEMENTED (live `states()`) | IMPLEMENTED (live `discoverCountriesAndPrograms()`) | IMPLEMENTED (live `discoverCountriesAndProgramsForSync()`) | NOT_IMPLEMENTED (статический словарь, 10 тур/16 отель) | NOT_IMPLEMENTED (страна захардкожена `turkey`) | NOT_IMPLEMENTED (статический `FSTRAVEL_STATES`, 26 стран) |
| Города/курорты | PARTIAL (только `SupplierGeoLink` TOWN через geo-ingest; в `Product.attributes` нет city) | PARTIAL (атрибут `city` в отель-синке; гео-линки через ingest) | PARTIAL (атрибут `city` в отель-синке; гео-линки через ingest) | PARTIAL (атрибут `city` из `townById` в отель-синке) | PARTIAL (только `SupplierGeoLink` TOWN через ingest) | NOT_IMPLEMENTED (нет city/resort в attributes) |
| Отели (каталог) | NOT_IMPLEMENTED (нет `anex/hotel-sync` эндпоинта; только live-адаптер + geo-ingest) | IMPLEMENTED (2857 HOTEL-карточек, KOMPASHTL-…) | IMPLEMENTED (163 HOTEL-карточек) | IMPLEMENTED (1906 HOTEL-карточек, VOYAGERHTL-…) | NOT_IMPLEMENTED (только `SupplierGeoLink` HOTEL 233) | NOT_IMPLEMENTED (нет HOTEL-карточек) |
| Туры | IMPLEMENTED (3177 TOUR-карточек, ANEX-…) | IMPLEMENTED (5286 TOUR-карточек) | IMPLEMENTED (2211 TOUR-карточек) | IMPLEMENTED (1924 TOUR-карточек) | IMPLEMENTED (192 TOUR-карточек) | IMPLEMENTED (666 TOUR-карточек) |
| Цены/доступность | PARTIAL (Tariff/`startingPrice`, без дат) | PARTIAL (Tariff/`startingPrice`, без дат) | PARTIAL (Tariff/`startingPrice`, без дат) | PARTIAL (Tariff/`startingPrice` + `checkIns` для отелей) | PARTIAL (Tariff/`startingPrice`, без дат) | PARTIAL (Tariff/`startingPrice`, без дат) |
| Изменения (дата/версия/активность) | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Исчезновение | NOT_IMPLEMENTED (нет удаления/деактивации) | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Внешние ID | PARTIAL (стабильны при `hotelInc`, но fallback на имя отеля) | PARTIAL (стабильны при `hotelKey`; captcha блокирует discovery) | IMPLEMENTED (стабильны `tourIncValue-hotelKey`) | IMPLEMENTED (стабильны `hotelKey-stateInc`) | PARTIAL (стабильны `tourIncValue-hotelKey`) | PARTIAL (fallback на имя отеля) |
| Полнота ответа | PARTIAL (`ANEX_MAX_PAGES=5` без флага усечения) | PARTIAL (maxPages 30/40/10; ранний выход при пустой странице) | PARTIAL (maxPages 30/30; ранний выход при пустой странице) | PARTIAL (maxPages 30; `countriesWithoutInventory` для пустых стран) | PARTIAL (окна 31 день, hardcoded сезон) | PARTIAL (`MAX_PAGES_PER_QUERY=25` без флага усечения) |
| Ошибки | PARTIAL (`errors[]`, без персистенции) | PARTIAL (`errors[]`, без персистенции) | PARTIAL (`errors[]`, без персистенции) | PARTIAL (`errors[]`, без персистенции) | PARTIAL (`errors[]`, без персистенции) | PARTIAL (`errors[]`, без персистенции) |
| История | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |
| Расписание | NOT_IMPLEMENTED (ручной HTTP/CLI) | NOT_IMPLEMENTED (ручной HTTP/CLI) | NOT_IMPLEMENTED (ручной HTTP/CLI) | NOT_IMPLEMENTED (ручной HTTP/CLI + npm script) | NOT_IMPLEMENTED (ручной HTTP) | NOT_IMPLEMENTED (ручной HTTP) |

Итог: **ни один поставщик не даёт дату изменения, версию или признак активности**. Единственное поле времени — `Product.updatedAt` (Prisma `@updatedAt`), которое обновляется при любом `update` (включая sync), но не различает «создан/обновлён синком/админом». `Product.version` остаётся `1` во всех синках (версия не инкрементируется).

---

## 3. Подтверждённые пути к исходному коду

### 3.1 Точки входа синхронизации (ручные)

`backend/src/modules/supplier/supplier.controller.ts` (JWT + PermissionsGuard, `@RequirePermissions("supplier.search.manage")`):
- `POST /supplier/summertour/sync` (L49–58), `POST /supplier/summertour/bulk-sync` (L60–64)
- `POST /supplier/kompas/sync` (L68–87), `POST /supplier/kompas/hotel-sync` (L96–115)
- `POST /supplier/kazunion/sync` (L119–138), `POST /supplier/kazunion/hotel-sync` (L149–168)
- `POST /supplier/voyager/sync` (L180–201), `POST /supplier/voyager/hotel-sync` (L208–227)
- `POST /supplier/anex/sync` (L231–250)
- `POST /supplier/fstravel/sync` (L252–271)
- `GET /supplier/metrics` (L384–392), `GET /supplier/adapters` (L369–380), `POST /supplier/cache/invalidate/:supplierCode` (L396–401)

CLI/скрипты:
- `backend/src/scripts/run-voyager-sync.ts` (ручной запуск тур/отель синка VOYAGER, L14–18)
- `backend/src/scripts/run-geo-ingest.ts` (ручной geo-ingest, L18 `logger: ["log","warn","error"]`)
- `backend/scripts/anex-hotel-ingest.ts`, `backend/scripts/geo-ingest.ts`, `backend/scripts/kompas-hotel-ingest.ts`, `backend/scripts/kompas-catalog-ingest.ts`, `backend/scripts/hotel-registry.ts`, `backend/scripts/hotel-photo-catalog.ts`, `backend/scripts/fetch-hotel-photos.ts`

npm: `backend/package.json` L23 `ingest:geo`.

### 3.2 Синк-сервисы и их результаты

| Файл | Интерфейс результата (ключевые поля) | Пустой ответ |
|---|---|---|
| `anex/anex-sync.service.ts` L18–28, L53 | `countriesDiscovered, programsSearched, offersReceived, uniqueIdentities, newCards, updatedCards, unchangedCards, normalizationFailures, errors` | L145–148: `warn` + `return` (без записей) |
| `kompas/kompas-sync.service.ts` L15–26, L59 | `countriesDiscovered, programsDiscovered, programsSearched, offersReceived, uniqueIdentities, newCards, updatedCards, unchangedCards, normalizationFailures, errors` | L179–182: `warn` + `return` |
| `kompas/kompas-hotel-sync.service.ts` L31–43, ~L100 | `countriesProcessed, rowsReceived, uniqueHotels, newCards, updatedCards, unchangedCards, tariffsCreated, tariffsUpdated, errors` | L147–149: `countriesProcessed++` (пустая страна считается обработанной) |
| `kazunion/kazunion-sync.service.ts` L18–29, ~L100 | аналогично KOMPAS tours | — |
| `kazunion/kazunion-hotel-sync.service.ts` L35–47, ~L100 | `countriesProcessed, countriesWithoutInventory, rowsReceived, uniqueHotels, newCards, updatedCards, unchangedCards, tariffsCreated, tariffsUpdated, errors` | L152–157: `countriesWithoutInventory++` |
| `voyager/voyager-sync.service.ts` L30–43, ~L90 | `countriesProcessed, countriesWithoutInventory, programsDiscovered, offersReceived, uniqueIdentities, newCards, updatedCards, unchangedCards, normalizationFailures, errors` | L161–163: `countriesWithoutInventory++` |
| `voyager/voyager-hotel-sync.service.ts` L32–43, L99 | `countriesProcessed, countriesWithoutInventory, rowsReceived, uniqueHotels, newCards, updatedCards, unchangedCards, tariffsCreated, tariffsUpdated, errors` | L170–176: `countriesWithoutInventory++` |
| `summertour/summer-sync.service.ts` L17–30, L100 | `programsDiscovered, programsSearched, summerOffersReceived, uniqueNormalizedIdentities, newCards, updatedCards, unchangedCards, duplicatesSkipped, normalizationFailures, staleHidden, publishedVisible, programSummaries, cards, errors` | L125–129: ошибка при 0 программ |
| `summertour/summer-bulk-sync.service.ts` L19–30, ~L80 | `startedAt, finishedAt, durationMs, programs, totalProducts, totalOffers, errors` | — |
| `fstravel/fstravel-sync.service.ts` L15–26, ~L50 | `countriesDiscovered, offersReceived, uniqueIdentities, newCards, updatedCards, unchangedCards, normalizationFailures, errors` | L124: `warn` + `return` |

### 3.3 Адаптеры и словари (гео-источники)

- `anex/anex.provider.ts` (ANEX_MAX_PAGES = 5, L35); `anex.adapter.ts` (`discoverGeoOptions` L762, `discoverCountriesAndPrograms`); `anex-hotel.adapter.ts` (code L165–166, `/samo/searchhotel/States` 52 страны)
- `kompas/kompas.adapter.ts` (`discoverCountriesAndPrograms` L188, MAX_PAGES 30 L159, FANOUT 10 L163, `discoverGeoOptions` L1848); `kompas-hotel-countries.ts` (53 страны, L2–12); `kompas-captcha.controller.ts`/`kompas-captcha.store.ts` (captcha-блокировки)
- `kazunion/kazunion.adapter.ts` (`discoverCountriesAndProgramsForSync` L252); `kazunion-http.service.ts` (`discoverPrograms` L336, `discoverCountriesAndPrograms` L341); `kazunion-hotel-countries.ts` (22 страны); `kazunion-hotel.adapter.ts` (HOTEL_LIVE_MAX_PAGES 5 L55)
- `voyager/voyager.adapter.ts` (`discoverGeoOptions` L363); `voyager-countries.ts` (статический: 10 тур-стран, 16 отель-стран, L17–111); `voyager-http.service.ts` (`fetchHotelDictionary` L149)
- `summertour/summertour-new.adapter.ts` (`discoverPrograms` L84, `discoverGeoOptions` L1006); `summertour-http.service.ts` (`discoverPrograms` L148); страна захардкожена `turkey` (`summer-sync.service.ts` L180, L438)
- `fstravel/fstravel.adapter.ts` (`discoverGeoOptions` L277 → `[]`, MAX_PAGES_PER_QUERY 25 L104, OCR-captcha L483–559); `fstravel-sync.service.ts` (`FSTRAVEL_STATES` 26 стран)
- `samo-geo-discovery.ts` (общий helper); `supplier-geo-ingest.service.ts` (`ingestSupplier` L85, `ingestKompasHotels` L221, `ingestAnexHotels` L295, `retireCityAsResort` L659–679)

### 3.4 Модель данных (схема)

- `catalog."Product"` (`prisma/schema.prisma` L353–428): `supplierRef @unique` L363 (натуральный ключ синка), `status ProductStatus` L365, `version Int @default(1)` L366, `attributes Json?` L380, `geoCountryId/CityId/ResortId/AirportId` L418–421, `createdAt/updatedAt` L368–369, `publicationChannels` L405. Индексы: status, categoryId, partnerId, geoCountryId, geoCityId.
- `catalog."Hotel"` (L1042–1078): `normalizedName/countryCode/cityName/resortName`, фото-поля, `createdAt/updatedAt`.
- `catalog."HotelSupplierRef"` (L1083–1106): `supplierCode`, `externalKey` (unique pair L1102), `name/countryCode/cityName/resortName/stars/hotelHref`, `source` (product/geolink), `firstSeenAt` L1099, `lastSeenAt` L1100.
- `geo."SupplierGeoLink"` (L5833–5853): `supplierCode, kind, externalId, label, geoCountryId/CityId/ResortId, createdAt, updatedAt`; unique `(supplierCode, kind, externalId)` L5848.
- `catalog."ProductHistory"` (L1841), `catalog."TariffHistory"` (L834), `geo`-сущности — см. §7.
- `ProductStatus` enum содержит `ARCHIVED`; синки статус не меняют.

### 3.5 Наблюдаемость (существующая)

- Логирование: Nest `Logger` → stdout (файлового логгера/pino/winston нет — grep по `winston|pino|createWriteStream` → 0).
- `supplier-resilience.service.ts`: token-bucket (L34), circuit breaker CLOSED/OPEN/HALF_OPEN (L60–95), retry `maxRetries=2` с backoff (L128–140), `stats()` (L152–156).
- `supplier-cache.service.ts`: in-memory TTL-кэш `search/price/availability/detail` (L23–27), `stats()` (L410–412), `invalidateSupplier` (L121–130).
- `eventbus/outbox-worker.service.ts`: периодический воркер (L37, interval 500мс по умолчанию L44), batch 100, retry до `OUTBOX_MAX_ATTEMPTS=5` (L203–206) — для доменных событий, не для данных поставщиков.
- `security.AuditLog` (schema L3211): пишутся security-события и CRUD справочников отелей (`hotel-directory.service.ts` L67–85); синки AuditLog **не пишут**.
- `ProductHistory` (schema L1841): пишется `catalog.service.ts` (L288, 303, 802, 900, 964, 1021, 1042, 1079, 1094, 1190, 1348, 1438) и `product-media.service.ts` (L455), а также скрипт `kompas-catalog-ingest.ts` (L308) — **синк-сервисы ProductHistory не пишут**.
- `TariffHistory` (schema L834): пишется `rate-plan.service.ts` (L351, 519, 575, 623) и `demo-seed.ts` — **синки не пишут**.
- `SupplierFxRateHistory` (schema L4869): только FX-изменения.
- Админ UI для синка: **отсутствует** (grep frontend по `/supplier` → 0 совпадений; dashboard.service.ts не содержит supplier-секций).

---

## 4. Какие изменения можно обнаруживать уже сейчас

1. **Новые страны** (частично): ANEX tours (live `states()`), KOMPAS tours (live `discoverCountriesAndPrograms()`), KAZUNION tours (live `discoverCountriesAndProgramsForSync()`) — новые страны появятся в `countriesDiscovered`. Для VOYAGER/KOMPAS-отель/KAZUNION-отель/FSTRAVEL новые страны **не обнаруживаются** (статические словари) — sync либо пропустит их, либо запишет в `errors[]` (например, `Country XX not in hotel dictionary` — `kompas-hotel-sync.service.ts` L132–134, `voyager-hotel-sync.service.ts` L140–143).
2. **Новые отели/туры**: счётчик `newCards` + новые `supplierRef` (уникальный). Фактически: KOMPAS 2857 HOTEL + 5286 TOUR; VOYAGER 1906 HOTEL + 1924 TOUR; KAZUNION 163 HOTEL + 2211 TOUR; ANEX 3177 TOUR; SUMMERTOUR 192 TOUR; FSTRAVEL 666 TOUR (SQL 2026-10-24).
3. **Изменение цены**: `Tariff.price` обновляется `ON CONFLICT` (`voyager-hotel-sync.service.ts` L450–463, `kompas-hotel-sync.service.ts` L321, upsertTariffs), `attributes.startingPrice` перезаписывается. Но предыдущая цена теряется (нет `TariffHistory` от синка).
4. **Изменение названия/города/звёзд**: `title` перезаписывается при различии (`kompas-hotel-sync.service.ts` L307, `voyager-hotel-sync.service.ts` L378); `attributes` мержится при различии `startingPrice/city/stars/hotelName` (L309–316, L380–386). Но `updatedCards++` считается **только при изменении цены** (L326–330, L396–401) → переименование/смена города не отражается в счётчике.
5. **Изменение географии поставщика**: `SupplierGeoLink.updatedAt` (L5846) обновляется при geo-ingest; для ANEX/KOMPAS/KAZUNION/SUMMERTOUR. VOYAGER и FSTRAVEL не имеют `SupplierGeoLink` вообще (SQL: 0 строк).
6. **Изменение внешних ID у отелей**: `HotelSupplierRef.lastSeenAt` обновляется скриптом `hotel-registry.ts` (L391, L418) — можно увидеть «когда последний раз видели» отель у поставщика.
7. **Цены/доступность в реальном времени**: `GET /supplier/search`, `refresh-price`, `refresh-availability` (`supplier-offer.service.ts` L242, L259) + in-memory кэш (TTL 5 мин, L321–323 supplier.module.ts) — но это **live**, без персистенции и без истории.

---

## 5. Какие изменения нельзя достоверно обнаружить при текущем способе получения данных

1. **Исчезновение объекта у поставщика**: синк не удаляет и не деактивирует карточки. Объект, пропавший у поставщика, остаётся `PUBLISHED` (17899 карточек `PUBLISHED` на 2026-10-24). Обнаружить можно только ручным diff-сравнением `supplierRef`-множеств между запусками.
2. **Переименование/смена внешнего ID**: identity = `supplierRef` из supplier-native ключей. При смене ключа (например, ANEX `hotelInc`, FSTRAVEL `hotelKey` с fallback на имя отеля — `anex-sync.service.ts` L154, `fstravel-sync.service.ts` L131) создаётся **новая карточка**, старая остаётся `PUBLISHED` — дубль, не детектируется. Нет таблицы алиасов.
3. **Изменение города/звёзд/названия (ANEX/FSTRAVEL туры)**: ANEX attributes не содержат `city/countryCode` (только `country`, L183–194) — добавляются post-sync; FSTRAVEL аналогично (L173). Поэтому изменения этих полей на стороне поставщика не фиксируются синком.
4. **Даты заездов (туры)**: ни один тур-синк не хранит даты (`attributes` туров не содержит `checkIns`/`departureDates` — проверено в `kompas-sync.service.ts` L242–255). Только отель-синки хранят `checkIns` в inclusions.
5. **Доступность/квоты**: `catalog."Availability"` пишется только `tour-builder.service.ts`/`catalog.service.ts` (продавцом), не синком. У поставщика availability — live (`refresh-availability`), не персистится.
6. **Персональные изменения (имя отеля, звёздность)**: частично — title/stars обновляются, но без истории (ProductHistory = 0 строк).
7. **Персональные изменения (status/активность)**: синк никогда не меняет `Product.status` (все синки пишут `'PUBLISHED'` при создании; update-пути status не трогают). Архивация — только через админ/каталог-операции.
8. **Частичный ответ (pagination)**: `ANEX_MAX_PAGES=5`, `FSTRAVEL MAX_PAGES_PER_QUERY=25`, KOMPAS 30/40/10, KAZUNION/VOYAGER 30 — усечение **не флагируется**; результат с усечением неотличим от полного. ANEX/FSTRAVEL не имеют `countriesWithoutInventory`.
9. **Ошибки discovery**: `errors[]` возвращается в HTTP-ответе и логируется в stdout, но **не персистится** — после перезапуска сервера потеряны.

---

## 6. Риски ложного исчезновения объектов

**Риск ложного массового отключения — НИЗКИЙ** (защита архитектурная):
- ни один синк не вызывает `delete`/`updateMany` по отсутствующим записям (grep `deleteMany|product.update.*status` в `*-sync.service.ts` → 0);
- пустой ответ → ранний выход без записей (ANEX/KOMPAS/FSTRAVEL) или `countriesWithoutInventory++` (VOYAGER/KAZUNION отели) — данные не трогаются;
- ошибка по стране/программе не прерывает весь синк (per-country try/catch, `errors[]`).

**Риски, которые остаются:**
1. **Geo-ingest `retireCityAsResort`** (`supplier-geo-ingest.service.ts` L659–679) **ставит `GeoCity.status = INACTIVE`** и переносит ссылки на `GeoResort`. Это реальный вектор исчезновения из пикера (но только в ручном geo-ingest, не в тур/отель-синке).
2. **Ручной bulk-UPDATE** (как 483 ARCHIVED с единым штампом 2026-10-22 14:02:55.896) — без `ProductHistory` происхождение не восстановимо; операция «архивировать все карточки без фото» прошла вне синка.
3. **`HotelSupplierRef.lastSeenAt`** обновляется только `hotel-registry.ts` — устаревает, если скрипт не запускался (последний запуск 2026-10-22). Нет автоматического «не видели > N дней → inactive».
4. **Обратный риск — «залипание»**: отсутствие деактивации = устаревшие карточки остаются `PUBLISHED` навсегда. Это **главный** риск для данных: пользователи видят отели/туры, которых у поставщика уже нет.
5. **Перезапись без истории**: `Tariff.price` и `attributes.startingPrice` перезаписываются in-place; предыдущее значение теряется. `TariffHistory` не пишется синком.
6. **Счётчик `updatedCards` занижает изменения**: считает только изменение цены (L326–330 и т. п.), поэтому переименование/смена города/звёзд не отражается в метриках синка.
7. **Captcha/WAF-блокировки** (KOMPAS captcha-controller, FSTRAVEL OCR L483–559) могут привести к частичному discovery без явного флага «неполный результат».

---

## 7. Какие данные и история уже сохраняются

| Сущность | Что хранит | Кто пишет | Синк пишет? |
|---|---|---|---|
| `catalog."Product"` | supplierRef, attributes (hotelName, city, country, stars, startingPrice, currency, checkIns…), status, geo*-id, createdAt/updatedAt, version | синк-сервисы (upsert) | да (upsert) |
| `catalog."Tariff"` | code, price, currency, inclusions (checkIns, room, meal, sourceMinPrice), status, createdAt/updatedAt | синк-сервисы (upsert ON CONFLICT) | да |
| `catalog."ProductHistory"` | action, diff, actor, createdAt | `catalog.service.ts`, `product-media.service.ts`, `kompas-catalog-ingest.ts` | **нет** (0 строк в БД) |
| `catalog."TariffHistory"` | коммерческие изменения тарифа | `rate-plan.service.ts` | **нет** |
| `catalog."Hotel"` / `HotelSupplierRef` | физический отель + supplier-native id, firstSeenAt, lastSeenAt | `hotel-registry.ts` (скрипт) | **нет** (только скрипт, последний запуск 2026-10-22) |
| `geo."SupplierGeoLink"` | supplierCode, kind, externalId, label, geo*-id, createdAt, updatedAt | `supplier-geo-ingest.service.ts` (скрипт) | **нет** (только скрипт; VOYAGER/FSTRAVEL — 0 строк) |
| `geo."GeoCountry/City/Resort"` | справочники + status (ACTIVE/INACTIVE) | geo-seed, geo-ingest | частично (ingest) |
| `SupplierFxRateHistory` | FX-курсы | fx-rates-seed, pricing | нет (только FX) |
| `security."AuditLog"` | security-события, CRUD справочников | security.service, hotel-directory.service | нет |
| In-memory metrics | offer/cache/resilience counters | supplier-offer.service | эфемерно |

**Вывод:** история изменений на уровне объектов поставщика **фактически отсутствует**. Единственные следы времени — `Product.updatedAt`, `Tariff.updatedAt`, `HotelSupplierRef.lastSeenAt`, `SupplierGeoLink.updatedAt`, все из которых обновляются «по факту успешного upsert» и не различают причину.

---

## 8. Недостающие компоненты для мониторинга

1. **Таблица запусков синхронизации** (`SupplierSyncRun`): поставщик, режим, параметры, startedAt/finishedAt, durationMs, countriesProcessed/WithoutInventory, rowsReceived, uniqueIdentities, newCards, updatedCards, unchangedCards, tariffsCreated/Updated, errors[], complete/truncated флаги.
2. **`lastSeenAt` на `Product`**: обновляется каждым успешным upsert; позволяет найти «не виденные > N дней» карточки.
3. **`complete`/`truncated` флаг в результатах синка** и в адаптерах (ANEX_MAX_PAGES, MAX_PAGES_PER_QUERY и т. п.) — чтобы отличить полный результат от усечённого.
4. **Diff-логика**: сравнение предыдущих vs новых атрибутов (title, hotelName, city, stars, country, startingPrice) с записью в `ProductHistory` (по образцу `kompas-catalog-ingest.ts` L308).
5. **Soft-staleness без авто-архивации**: флаг `stale`/`notSeenSince` + отчёт/дашборд; авто-архивация только после явного подтверждения админом.
6. **Алиасы внешних ID**: таблица `SupplierExternalIdAlias` для случаев смены `hotelInc`/`hotelKey`.
7. **Счётчик `updatedCards` должен учитывать любое изменение атрибутов**, а не только цену.
8. **Персистенция ошибок**: `SupplierSyncError` или запись в `SupplierSyncRun.errors` (JSONB).
9. **Алерты**: пороги на `errors.length > 0`, `rowsReceived = 0` при непустом прошлом запуске, `countriesWithoutInventory` рост, circuit-open события (resilience).
10. **Админ UI**: страница истории синков, запуск/повтор, просмотр diff, подтверждение архивации.
11. **Адаптер-флаги `availabilityEnabled`** уже есть (supplier.module.ts), но availability не персистится — либо персистить per-date, либо честно задокументировать «live only».
12. **Geo-ingest для VOYAGER/FSTRAVEL**: у них 0 `SupplierGeoLink` — либо запустить ingest, либо задокументировать отсутствие.

---

## 9. Конкретный план реализации (P0/P1/P2)

### P0 (блокеры мониторинга)

| # | Задача | Файлы/компоненты |
|---|---|---|
| P0-1 | Создать `SupplierSyncRun` (миграция + модель в `prisma/schema.prisma`), сервис `supplier-sync-history.service.ts` с `startRun/finishRun`. | `prisma/schema.prisma`, новая миграция, `supplier.module.ts`, новый сервис |
| P0-2 | Инструментировать все 9 синк-сервисов (`*-sync.service.ts`) записью старта/финиша и счётчиков; добавить `complete/truncated` в результат-интерфейсы. | `anex/anex-sync.service.ts`, `kompas/kompas-sync.service.ts`, `kompas/kompas-hotel-sync.service.ts`, `kazunion/kazunion-sync.service.ts`, `kazunion/kazunion-hotel-sync.service.ts`, `voyager/voyager-sync.service.ts`, `voyager/voyager-hotel-sync.service.ts`, `summertour/summer-sync.service.ts`, `summertour/summer-bulk-sync.service.ts`, `fstravel/fstravel-sync.service.ts` |
| P0-3 | Добавить `truncated` флаг в адаптеры при достижении `maxPages` (`ANEX_MAX_PAGES`, `MAX_PAGES_PER_QUERY`, KOMPAS MAX_PAGES/FANOUT, hotel maxPages default). | `anex/anex.provider.ts`, `fstravel/fstravel.adapter.ts`, `kompas/kompas.adapter.ts`, `kazunion/kazunion-http.service.ts`, `voyager/voyager-http.service.ts` |
| P0-4 | Добавить `lastSeenAt DateTime?` на `Product` (миграция) и обновлять его в upsert-путях всех синков. | `prisma/schema.prisma`, миграция, все `*-sync.service.ts` upsert-пути |
| P0-5 | Эндпоинт `GET /supplier/sync-runs` (+ фильтры) в `supplier.controller.ts`, permission `supplier.search.read`. | `supplier.controller.ts`, `supplier.module.ts` |

### P1 (наблюдаемость и история)

| # | Задача | Файлы/компоненты |
|---|---|---|
| P1-1 | Записывать `ProductHistory` при sync-изменениях (title, hotelName, city, stars, country, startingPrice) по образцу `kompas-catalog-ingest.ts` L308 и `catalog.service.ts` L288. | все `*-sync.service.ts`, `catalog.service.ts` (helper) |
| P1-2 | Исправить счётчик `updatedCards`: учитывать любое изменение атрибутов, а не только цену. | все `*-sync.service.ts` (upsert-ветки) |
| P1-3 | Дашборд/отчёт «не виденные > N дней» карточки (read-only SQL + эндпоинт). | новый сервис, `supplier.controller.ts` |
| P1-4 | Алерты (пороги) + логирование в структурированном виде (JSON) вместо plain `logger.warn`. | `supplier-resilience.service.ts`, `*-sync.service.ts` |
| P1-5 | Запустить/задокументировать geo-ingest для VOYAGER и FSTRAVEL или зафиксировать отсутствие. | `run-geo-ingest.ts`, `supplier-geo-ingest.service.ts` |
| P1-6 | Админ UI: страница истории синков и diff. | frontend (`app/...`), `public-supplier.controller.ts`? (новый admin-контроллер) |

### P2 (продвинутый мониторинг)

| # | Задача | Файлы/компоненты |
|---|---|---|
| P2-1 | Таблица `SupplierExternalIdAlias` + логика смены ключа (новая карточка + ссылка на старую). | `prisma/schema.prisma`, миграция, синк-сервисы |
| P2-2 | Soft-staleness: флаг `staleSince` на Product, админ-подтверждение перед архивацией. | `prisma/schema.prisma`, синк-сервисы, админ UI |
| P2-3 | Персистентная availability по датам (или честная документация «live only»). | `catalog.Availability`, синк-сервисы, `supplier-aggregator.service.ts` |
| P2-4 | Outbox-события `supplier.card.created/updated/stale` для downstream (по образцу `eventbus`). | `eventbus/eventbus.service.ts`, синк-сервисы |
| P2-5 | Таблица `SupplierSyncError` (или JSONB в `SupplierSyncRun`) с per-country деталями. | `prisma/schema.prisma`, синк-сервисы |

**Важно:** ни один из этих пунктов в рамках аудита **не выполнялся**. Любая реализация — только после отдельного разрешения владельца.

---

## 10. Ответы на обязательные вопросы (Этап 10)

1. **Какие поставщики предоставляют полноценный географический справочник?**
   Только Navitravel (`geo.GeoCountry/City/Resort`) — полноценный, с FK. У поставщиков — плоские словари/значения из отелей. Live-discovery: ANEX tours (`states()`), KOMPAS tours (`discoverCountriesAndPrograms()`), KAZUNION tours (`discoverCountriesAndProgramsForSync()`), SUMMERTOUR programs (`discoverPrograms()`). Статические: KOMPAS отели (53), KAZUNION отели (22), VOYAGER (10 тур/16 отель), FSTRAVEL (26), ANEX отели (52 через `/samo/searchhotel/States`).

2. **Для каких поставщиков доступны только географические значения отелей или предложений?**
   Все 6 (ANEX, KOMPAS, KAZUNION, VOYAGER, SUMMERTOUR, FSTRAVEL) — только значения из отелей/предложений. Ни один не даёт полный справочник всех городов/курортов независимо от наличия отелей. VOYAGER и FSTRAVEL вообще не имеют `SupplierGeoLink` (0 строк).

3. **Для каких стран подтверждены две, три, четыре или более ступени географии?**
   Две ступени (страна → город/курорт) — для всех поставщиков, у которых есть city/resort. Три ступени (страна → регион → город) — **не подтверждены** ни для одного (ANEX `regionName/hotelTownName/townName` смешивает уровни). Четыре и более — не подтверждены нигде.

4. **Где есть реальные parent ID, а где иерархия не восстанавливается?**
   Реальные parent ID — только внутри Navitravel (`GeoResort.cityId → GeoCity`, `GeoCity.countryId → GeoCountry`). У поставщиков parent ID отсутствуют (плоские списки). `SupplierGeoLink` связывает supplier-native id с `geo*Id`, но не содержит parent.

5. **Сколько уникальных исходных географических объектов собрано?**
   В `73-supplier-geo-objects.csv` — 1721 строка, все уникальны по (supplier, country, city, resort); 212 групп (461 запись) имеют одинаковое нормализованное имя в рамках supplier+country (не доказательство идентичности). `SupplierGeoLink` — 27636 строк (ANEX 14199, KOMPAS 12588, KAZUNION 577, SUMMERTOUR 272; VOYAGER/FSTRAVEL 0).

6. **Сколько межпоставщицких соответствий имеют сильные доказательства, сколько требуют проверки?**
   В `75-cross-supplier-geo-matches.csv` — 163 кандидата: 55 `SAME_ENTITY`+`HIGH`, **все понижены** до `POSSIBLE_MATCH` в `80-geo-match-evidence-review.csv`, так как доказательством было только совпадение имени и страны. Пар с независимыми доказательствами — **0**. Требуют ручной проверки — 108.

7. **Сколько кандидатов одинаковых отелей обнаружено и сколько из них имеют достаточные доказательства?**
   В `76-cross-supplier-hotel-match-candidates.csv` — 3068 кандидатов. Из 158 `CONFIRMED_DUPLICATE` — только 16 имеют city match + sim≥0.9 и остаются `CONFIRMED` в `81-hotel-match-quality-review.csv`; 73 без city match и 69 прочих понижены до `LIKELY_DUPLICATE_MANUAL_REVIEW`; 0 пар одного поставщика. Окончательно подтверждённых (с адресами/координатами) — **0**.

8. **Какие ограничения мешают полному сопоставлению?**
   - Отсутствие адресов и координат у всех поставщиков.
   - Отсутствие parent ID у поставщиков (плоские словари).
   - VOYAGER и FSTRAVEL не имеют `SupplierGeoLink` (geo-ingest не запускался).
   - Внешние ID не уникальны между поставщиками (разные пространства).
   - ANEX/FSTRAVEL используют fallback на имя отеля при отсутствии native id.
   - FSTRAVEL не предоставляет city/resort.
   - Нет истории изменений (ProductHistory = 0 строк).

9. **Какой следующий этап необходим перед изменением модели Navitravel?**
   - Внедрение слоя нормализации (рекомендован Вариант 2 — сущность `GeoRegion`) по `65-universal-geography-model.md` и `66-geography-normalization-algorithm.md`.
   - Ручная проверка P1-A (384 группы) из `40-geography-reclassified-groups.csv`.
   - Решение по 9 первопричинам из `56-geography-root-causes.md` (FK geoCityId, валидация при sync, обработка курортов, geo-ingest).
   - Только после этого — реализация мониторинга (P0 из §9) и любые изменения схемы.

---

## 11. Источники, которые не удалось проверить (Этап 10)

- Реальные ответы API поставщиков (запросы не отправлялись — READ-ONLY).
- `crm."Supplier"` — пуста (проверено ранее, ETG-аудит).
- Frontend admin UI для синка — отсутствует (grep `/supplier` → 0).
- Логи stdout запущенного backend — недоступны вне сессии.
- `docs/audits/` до этого содержал только ETG-отчёты; структура соблюдена.

**Точная папка отчёта:** `docs/audits/supplier-change-monitoring-audit.md`
**Сопутствующие файлы аудита:** `docs/audit/tours-hotels-reference-audit/` (гео-аудит 29–82), `docs/audit/tours-hotels-reference-audit-v2/` (дубли 00–28), `docs/audits/ETG_RATEHAWK_*`.

---

**Аудит завершён. Изменений кода, БД, справочников и отчётов не выполнено.** Дальнейшие действия — только по отдельному разрешению владельца.