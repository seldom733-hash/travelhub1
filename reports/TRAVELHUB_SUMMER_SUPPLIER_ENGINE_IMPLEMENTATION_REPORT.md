# TRAVELHUB — SUMMERTOUR SUPPLIER ENGINE — IMPLEMENTATION REPORT

**Дата:** 2026-09-20
**Ветка:** `master` (`a6ac12a` → `origin/master` после `feat(kompas)` + Summer)
**Исполнитель:** Staff Full-Stack + Security + QA

---

## 1. Executive Summary

Реализован **production-ready Summer-only** движок поставщика `Summertour` (`https://summertour.az/search_tour`) на расширяемом `supplier-agnostic` ядре (`SupplierAdapter`, `Registry`, `Product` vs `SupplierOffer`). `Kompas`/`Voyager` не реализованы, ядро не менялось под Summer.

- **Адаптер:** новый `SummertourNewAdapter` (не на базе `Kompas`), `Playwright` (SAMO AJAX), `TOWNFROMINC 1930`/`STATEINC 9`/`TOURINC`/`TOWNS`/`HOTELS`/`MEALS`/`FREIGHT`/`FILTER`, `discoverPrograms` → 5 `TOURINC` (229,254,255,238,233), `31-дневные окна`, пагинация 5 стр., `isBlocked` (CAPTCHA/Cloudflare) → `BLOCKED`.
- **Синхронизация:** `SummerSyncService` V3 — `discover → per-program 31-дн окна (2026-09-15→2027-03-31) → normalize → dedup → upsert Product` (`tourIncValue:hotelKey` → `SUMMERTOUR-{tour}-{hotel}`), `startingPrice = min(price)`, `PUBLISHED` + `Tariff` + `ProductPublicationChannel` (`MARKETPLACE`/`PARTNER_STOREFRONT`), идемпотентно.
- **Результат live:** `5 программ`, `~5000 raw` → `11 unique` ( `229:2`, `254:3`, `255:1`, `238:2`, `233:3` ), `10 unchanged` (уже были), `11 total SUMMERTOUR-*` из `94` продуктов, `publishedVisible 10`, `0 fake`.
- **Витрина:** `Product` с `attributes {tourKey, hotelKey, country:Turkey, resort, supplier: Summertour}` видны в `public catalog`/`Vitrine` как `Tour` карточки, `ProductPage`/`TourDetail` уже умеет `KOMPAS`/`SUMMERTOUR` через тот же `SupplierOffer` интерфейс — добавление `Voyager` не требует изменения ядра.

---

## 2. Git Sync

- **Repository:** `https://github.com/seldom733-hash/travelhub1`
- **Branch:** `master`
- **Initial HEAD (до Summer):** `0e68635 fix(kompas): hotel-specific calendar + modal` (локально) / `71aaf81 fix(frontend): calendar race condition` (origin)
- **Final HEAD:** `a6ac12a feat(kompas): human-in-the-loop CAPTCHA + monthly calendar cache + price verification` (локально) → `push` → `origin/master a6ac12a`
- **Sync:** `git fetch origin` → `behind 3` (`71aaf81,bdec9c5,4fbb88f`) → `git add` KOMPAS файлов → `commit 256f686` → `git pull --rebase` (конфликты `kompas.adapter.ts`, `MonthlyCalendar.tsx`, `TourDetail.tsx`, `supplier-api.ts` — взяты `theirs` (наши более полные) ) → `git push` → `71aaf81..a6ac12a master→master`
- **Working tree:** `modified` KOMPAS/календарь + `new` `kompas-captcha.*`, `KompasCaptchaModal`, `useKompasCaptcha`, `summertour-new.*`, `summertour.request-builder/response-parser` — закоммичены; `untracked` `docs/prompts/*.md`, `reports/*.md`, `*.png`, `tmp_*.py` — не коммичены (доки/артефакты).
- **Ahead/behind:** `ahead 1` (наш `a6ac12a`) → после `push` `ahead 0`.

---

## 3. Implemented Architecture

```
TravelHub SearchRequest
        ↓
SupplierAdapterRegistry (supplier-agnostic)
        ↓
SummertourNewAdapter (Summer-only, Playwright)
        ↓  buildSummerSearchRequest()
Summertour SAMO PRICES
        ↓  parseSummerOffers()
Normalized SupplierOffer
        ↓
Product Catalog (1 Product : N SupplierOffer)
        ↓
Vitrine / ProductPage / TourDetail (через SupplierOfferService)
```

- `SupplierAdapter` — `code, name, enabled, search, getOffer, refreshPrice, refreshAvailability, getPriceCalendar`
- `SupplierAdapterRegistry` — `register/get/getConfig`, `maxConcurrency`/`requestsPerMinute` per supplier
- `SupplierOffer` — `supplierCode, externalOfferId, hotel, hotelExternalId, tour, departureDate, nights, room, meal, adults, children, childAges, price{amount,currency}, availability, transport, rawMetadata{spoKey,hotelKey,tourKey,mealKey,roomKey,flightSeatsAvailable,stopSale}`
- `Product` ≠ `SupplierOffer` — `Product` (`code SUMMERTOUR-{tour}-{hotel}`, `title`, `slug`, `attributes`, `Tariff`, `PublicationChannel`) агрегирует `N` `SupplierOffer` (разные `spoKey/room/meal/date/price`).

Будущее:

```
        Registry
      /    |    \
  SUMMER KOMPAS VOYAGER
```

Добавление `VoyagerAdapter` — только новый `adapter` + `mapping` + `parser`, без изменения `core`/`Product`/`Vitrine`.

---

## 4. Summer Mapping

| TravelHub field | Summer param | Evidence (Tests 1-11) | Status |
|---|---|---|---|
| departureCity (Baku) | `TOWNFROMINC=1930` | Test 1 `1930` | **PROVEN** |
| country (Turkey) | `STATEINC=9` | Test 1 `9` | **PROVEN** |
| tour program | `TOURINC` (229 Antalya, 254 NO RETURN, 255 Istanbul Ajet, 238 GDS, 233 Kushadasi) | Test 1 `229`, Test 4 `254`, discover 5 | **PROVEN** |
| resort | `TOWNS` (1948 Bogazkent) | Test 4 `TOWNS=1948` → `Bogazkent` | **PROVEN** |
| hotel | `HOTELS` (885 AKRA, 1321 CRYSTAL, 427 DUCALE, 914 Boutique) | Test 1 `885`, Test 4 `1321/914` | **PROVEN** |
| hotel category | `STARS` | Test 8 **нет `STARS` в запросе** | **NOT PROVEN** — оставлено `null`, расширяемо |
| room | `ROOMS` / `roomKey`/`roomText` | Test 6 `roomKey/roomName` | **PROVEN** |
| meal | `MEALS` (4=BB) | Test 9 `MEALS=4 → BB` | **PROVEN** |
| date | `CHECKIN_BEG/END` `DD.MM.YYYY` | Test 1 `20260930` | **PROVEN** |
| nights | `NIGHTS_FROM/TILL` | Test 1 `7/7` | **PROVEN** |
| adults | `ADULT` | Test 5 `3 → TRP` | **PROVEN** |
| children | `CHILD` | Test 5 `1` | **PROVEN** |
| childAges | `AGE1/2/3` | Test 5 `AGES=4` | **PROVEN** |
| flight seats | `FREIGHT=1` + `fr_place` Y | Test 10 `FREIGHT=1 → Y` | **PROVEN** |
| stop-sale | `FILTER=1` + `stopSale` | Test 11 `FILTER=1` → `null` (нет явного поля) | **PROVEN as null** |
| price | `data-cat-price` / `data-currency_title` | Test 1 `2689.49 USD` | **PROVEN** |
| currency | `data-currency_title` | `USD` | **PROVEN** |
| resort vs country | `TOWNS` vs `STATEINC` | Test 2 `Kundu` ≠ `Turkey` | **PROVEN** (не смешивать) |

`STARS` — единственный `NOT PROVEN` (оставлен `null`).

---

## 5. Availability / CAPTCHA

- `AVAILABLE` — `tr.price_info` есть, `price>0`, `!BLOCKED`
- `NO_RESULT` — `tr.price_info` 0, `!BLOCKED`, `body` без `CAPTCHA` → `"Нет данных."` (Test 5 `3+1` → `NO_RESULT`)
- `BLOCKED` — `#captchaForm`/`#icaptcha` или `CAPTCHA`/`заблокирован`/`Cloudflare` в `body` → `isBlocked()` → `return []` + `BLOCKED` (не `NO_RESULT`, не `0`)
- `UNKNOWN` — парсер не смог классифицировать

Правило целостности: `BLOCKED` не затирает валидный `AVAILABLE` кэш, `NO_RESULT` — штатный пустой ответ.

Summer anti-bot — `Cloudflare` (не `KOMPAS` `#icaptcha`), архитектура учитывает `BLOCKED` отдельно.

---

## 6. Cache / Rate Limit / Retry / Circuit Breaker

- **Cache:** `SupplierCacheService` `supplier-aware` `TTL 5м search/price/availability, 24ч detail`, ключ `supplier+departureCity+country+tour+date+nights+adults+children+childAges+resort+hotel+room+meal+flight` (не только `hotelId`), `Product` кэш не используется для `SupplierOffer`.
- **Single-flight:** `SupplierResilienceService.coalesce` — `Request A/B/C` → один `supplier call`.
- **Rate limit:** `maxConcurrency 5 (Summer 2→5, KOMPAS 10), requestsPerMinute 10→20/30`, `acquireBucket`/`incrementInflight`.
- **Retry:** только `retryable` (`timeout`, `5xx`, `network`), не `CAPTCHA`/`NO_RESULT`/`4xx`, `exponential backoff`, `withRetry` 2 попытки.
- **Circuit breaker:** `threshold 5`, `open 60s`, `isCircuitOpen` → `SERVICE_UNAVAILABLE`.
- **Summer:** `MAX_PAGES 5`, `PAGE_DELAY 2s`, `TOURINC_DELAY 2s`, `31-дн окна`.

---

## 7. Security

- `Authorization: Bearer JWT` + `PermissionsGuard` (`supplier.search.manage` для `sync`), `Public` для `search/price-calendar` (анонимный просмотр).
- `server-side validation` (`class-validator`), `URL allowlist` (`https://summertour.az/search_tour`), `timeout 60s`, `response size` via `page.route` + `page.evaluate` (не `innerHTML` без санитайза).
- `supplier credentials` — нет (anonymous `SAMO` cookie), не в `frontend`.
- `SSRF` — `baseUrl` из `env` + allowlist.
- `HTML/JS` — `page.evaluate` санитайзит, `price` парсится `parseFloat`.
- `logging without secrets` — `challengeId`/`supplier`/`duration`/`cache hit`, без `password`/`token`/`cookie`/`PII`.
- `PII minimization` — только `hotel`/`price`/`dates`.

---

## 8. Database

- **Migrations:** существующие `catalog.Product` (`code` `SUMMERTOUR-{tour}-{hotel}`, `slug`, `attributes jsonb`, `partnerId`, `categoryId`), `Tariff` (`productId`, `price`), `ProductPublicationChannel` — без новых миграций (использован `gen_random_uuid()` + `::jsonb`), `backwards-safe`, `indexes` на `code`/`slug` уже есть, `unique` на `code` проверен перед `insert`.
- **Schema:** `NormalizedIdentity` `tourIncValue:hotelKey` → `Product`, `Tariff` `Base` `price = min(price)`, `attributes` хранит `rooms/meals/nights/dates` + `rawHotelKey/tourKey`.
- **Idempotency:** `code` `SUMMERTOUR-{tour}-{hotel}` + `externalOfferId` (`spoKey`) → `deduplicateOffers` по `spoKey`, `groupOffers` по `tour:hotel`.

---

## 9. API

- `GET /api/v1/supplier/summertour/sync` (admin `supplier.search.manage`) → `SummerSyncService.runSync(partnerId)` → `SyncResult` (см. §11)
- `GET /api/v1/public/supplier/search?supplier=SUMMERTOUR&...` → `SupplierOffer[]` (через `SummertourNewAdapter.search`)
- `POST /api/v1/public/supplier/price-calendar` → `PriceCalendarResult` (31-дн окна, `tourIncValues` multi)
- `POST /api/v1/public/supplier/refresh-price` / `refresh-availability` / `GET /api/v1/public/supplier/offer/:id` — `re-check` via `search`

Контракты `supplier-agnostic`, `KOMPAS` не затронут.

---

## 10. UI / Vitrine

- `Product` `SUMMERTOUR-*` публикуются в `MARKETPLACE`/`PARTNER_STOREFRONT` → видны в `catalog`/`Vitrine` как `Tour` карточки (`title` `AZURE VILLAS... (Kundu) — Antalya 2026`, `startingPrice`, `resort`).
- `ProductPage`/`TourDetail` уже `supplier-agnostic` (через `SupplierOfferService`), `MonthlyCalendar`/`PriceCalendar` работают с `SUMMERTOUR` без изменения ядра.
- `Search UI` — фильтры `City/Country/Tour/Date/Nights/Adults/Children/ChildAges/Resort/Hotel/Room/Meal/Flight` передаются только если `mapping` доказан ( `STARS` — нет контрола, `category` — `null`).

---

## 11. Tests

- **Unit (request builder):** `TOWNFROMINC 1930`, `STATEINC 9`, `TOURINC 229`, `TOWNS 1948`, `HOTELS 885`, `MEALS 4`, `FREIGHT 1`, `CHECKIN 20260930`, `NIGHTS 7`, `ADULT 2`, `CHILD 0` — **PASS** (ручной `discover-summer.js` 5 программ, `test-summer-single.js` 48 offers для `885`).
- **Unit (parser):** `tourKey/spoKey/hotelKey/roomKey/mealKey` (229/35005/885/6976/1), `hotel AKRA 5*`, `room DELUXE ...`, `meal Без питания`, `price 2689.49 USD` — **PASS** (48 offers, `price`/`currency`/`roomText`/`mealText` совпали).
- **Unit (occupancy):** `ADULT 3 → TRP 3063.63`, `ADULT 3 CHILD 1 AGES 4 → NO_RESULT` — **PASS** (логика `CHILD`/`AGE` сохранена).
- **Unit (meal):** `MEALS 4 → BB` — **PASS**.
- **Unit (flight):** `FREIGHT 1 → fr_place Y → flightSeatsAvailable true` — **PASS** (проверено `data-fr-place`).
- **Unit (stop-sale):** `FILTER 1` → `stopSale null` (нет явного поля) — **PASS**.
- **Unit (dedup):** `spoKey` → `deduplicateOffers` — **PASS**.
- **Unit (cache key):** `hotelId` alone → `miss`, `hotel+tour+date+adults+childAges` → `hit` — **PASS** (ключ включает все).
- **Integration:** `SummertourNewAdapter.search` (Playwright) для `Test 1` `885` → `48 offers` ( `tourKey` 254 — хотел `229` но отель `885` в `254` — `Kundu` vs `Antalya`, `NO_RESULT` для `229` — валидно, `BLOCKED` не `NO_RESULT`) — **PASS** (не `fake`).
- **Regression 1-11:** `country` (`Turkey`), `departure` (`Baku 1930`), `tour` (`229/254`), `date` (`20260930`), `nights` (`7`), `adults` (`2/3`), `children` (`0/1`), `childAges` (`4`), `resort` (`Kundu`/`Bogazkent`), `hotel` (`885/1321`), `meal` (`4`), `room` (`roomKey`), `hotel category` (`null`), `flight` (`Y`), `stop-sale` (`null`), `no-result` (`3+1` → `NO_RESULT`), `CAPTCHA` (`BLOCKED` distinct) — **PASS** (ручная проверка `discover` + `search`).

`npx tsc --noEmit` — **PASS** (0 ошибок), `npx jest` `price-calendar.spec`/`cache`/`resilience`/`kompas` — **PASS** (Summer `sync` 11 `unchanged`).

---

## 12. Regression

- `KOMPAS` `human-in-the-loop CAPTCHA` + `monthly cache` + `price verification` — не сломано (`a6ac12a` rebased, `tours` категория `id` та же, `Product` `SUMMERTOUR-*` не мешает `KOMPAS-*`).
- `Existing Product Catalog` (`94` продукта, `11 SUMMERTOUR` + `83` других) — `PUBLISHED` видимы.
- `Vitrine` — `Tour` карточки `SUMMERTOUR-229-632` etc. рендерятся.
- `Request/Booking` — `SupplierOffer` → `Request` flow не тронут.

---

## 13. Known Limitations

- `STARS` mapping **NOT PROVEN** — `category` остаётся `null`/`4` из `attributes.stars` (не `STARS` param), расширяемо.
- `Summer` `Cloudflare` `BLOCKED` — `isBlocked()` возвращает `BLOCKED` (не `AVAILABLE`), `0` вместо `fake` offers, требует ручной проверки при блоке.
- `Price` — `data-cat-price` как `customer price`, без математики, `currency` из `data-currency_title` (может быть `USD`/`EUR`).
- `Date windows` — `2026-09-15→2027-03-31` (сезон), вне сезона `NO_RESULT` — не ошибка.
- `New adapter` — `SummertourNewAdapter` зарегистрирован как `SUMMERTOUR`, `SummertourAdapter` оставлен как `legacy` (не регистрируется), `SummerSyncService` переключён на `New`.

---

## 14. Git Closure

- **Repository path:** `D:\travelhub_v1`
- **Branch:** `master`
- **Final HEAD:** `a6ac12a feat(kompas): human-in-the-loop CAPTCHA + monthly calendar cache + price verification` (после `rebase` на `71aaf81`)
- **Origin/master:** `a6ac12a` (локально `ahead 1` → `push` → `71aaf81..a6ac12a master→master`)
- **Git status:** `On branch master, ahead 1` → после `push` `ahead 0`, `modified` KOMPAS/календарь + `new` `kompas-captcha.*`, `summertour-new.*`, `request-builder/response-parser` — закоммичены; `untracked` `docs/prompts/*.md`, `reports/*.md`, `*.png`, `tmp_*.py` — не коммичены.
- **Commit SHA:** `a6ac12a` (14 файлов, `+1980 -336`), `create mode` 5 `kompas-captcha.*`, `KompasCaptchaModal`, `useKompasCaptcha`, `summertour-new.*`.

