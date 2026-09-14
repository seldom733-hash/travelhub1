# TRAVELHUB — Summertour Supplier Web Integration Audit Report

**Date:** 2026-09-14
**Тип:** RESEARCH / AUDIT ONLY (integration НЕ реализована)
**Verdict:** **READY WITH CONDITIONS**
**Branch:** `master`

---

## 1. Executive Summary

Summertour (https://summertour.az) — tour-оператор на движке **SAMO (SamoSoft, PHP)** за Cloudflare. Реальные туры/цены/availability **получаемы без авторизации** через внутренний AJAX-endpoint того же URL: `GET /search_tour?samo_action=PRICES&...` (Variant C: browser JS → API call → JS-injected HTML). За несколько реальных запросов получено 400+ офферов (4 страницы × 100) с ценами USD, hotel/SPO/meal/room keys, датами вылета, availability-флагами. Цены корректно пересчитываются под состав пассажиров (CONFIRMED экспериментом). Официального публичного API нет; прямое использование внутреннего endpoint технически возможно, но **коммерчески требует согласия поставщика** (либо договор через B2B-портал `b2b.summertour.az`, где эти же данные — контрактная сущность). Рекомендуемая стратегия: **B (Public/internal HTTP endpoint) — при условии договорённости с Summertour; D (browser adapter) — как fallback**. Режим: **Mode A (Dynamic Supplier Inventory)** для цен/availability.

## 2. Scope

Что исследовано: `/search_tour` (форма, JS, network), `samo_action=PRICES/CONTENT`, pagination, поведение цены (ADULT/CHILD/NIGHTS), availability-семантика, auth-требования, Cloudflare, robots.txt, `/agreement`, B2B-портал. Что НЕ сделано: реальное бронирование, обход защит, массовый crawl, любой production-код.

## 3. TravelHub Current Architecture

**CONFIRMED** (по коду репозитория):

| Область | Факт |
|---|---|
| Catalog | `Product` (единая сущность + `categoryId` + `attributes` по ACTIVE `CategorySchema`), `Category`, `Tariff`, `Availability`, `ServiceUnit`, `RatePlan` (+`PricingMode FIXED/PRICE_ON_REQUEST`, `PriceBasis`), `CommercialPeriod`, `CommercialRestriction` (STOP_SELL/MIN_STAY/ADVANCE_BOOKING/C2A/C2D), `ProductPublicationChannel` (MARKETPLACE / PARTNER_STOREFRONT), Media (DRAFT/PUBLISHED) |
| Sales | `Quote` (DRAFT→ISSUED, frozen totals, `validUntil`), `CheckoutIntent` (frozen snapshot, availability re-check), `Sale`, `Order`, `Booking` |
| Finance | `PaymentProvider` **interface + `PaymentProviderRegistry`** (`finance/provider/*`) — готовый in-house прецедент adapter+registry паттерна |
| Pricing ≠ Availability ≠ Quote | Price resolve — Tariff+CommercialPeriod; Availability — отдельный сервис с restriction evaluation; Quote — freeze authority. Расхождение price/availability между витриной и бронируемым моментом уже решается re-check на checkout |
| HTTP clients | **Внешних нет** (fetch только в perf-harness). Cron/queue инфраструктуры нет (`@nestjs/schedule`/BullMQ отсутствуют) |
| ABSTRACTIONS, пригодные для supplier | `PaymentProviderRegistry` — паттерн для `SupplierAdapterRegistry`; `ExternalIdempotencyRecord` (Step 2.12H) — durable idempotency для supplier re-checks; `Partner` entity + `seller`/`storefront` контуры. **Прямого SupplierAdapter-интерфейса сейчас НЕТ** |

## 4. Summertour Search Flow

**CONFIRMED** (browser Chromium/Playwright + curl, 2026-09-14):

```
/search_tour (форма, ~250KB HTML)
   → параметры формы (select STATEINC/TOWNFROMINC/TOURINC, CHECKIN_BEG (jQuery UI datepicker),
     NIGHTS_FROM/TILL, ADULT/CHILD/AGE1..3, чекбоксы STARS/TOWNS/MEALS/ROOMS/HOTELS,
     COSTMIN/MAX, FREIGHT, FILTER, MOMENT_CONFIRM)
   → кнопка .build / URL-навигация на /search_tour?<params>&DOLOAD=1
   → страница рендерит каркас (resultset divs, progressbar) и JS вызывает:
       GET /search_tour?samo_action=PRICES&...  (jQuery.getScript → вставка результата ehtml())
```

Технологии: SAMO engine, jQuery + Chosen (selects скрыты), jQuery UI datepicker, Cloudflare (CDN + RUM beacon), Google Analytics. Сессия — cookie `SAMO` (PHPSESSID-like, HttpOnly) + предпочтения `pLANG/pSTATEINC/pTOWNFROMINC`.

## 5. Network/API Findings — ** Variant C** (`CONFIRMED`)

| # | Request | Назначение | Response |
|---|---|---|---|
| 1 | `GET /search_tour?samo_action=PRICES&PRICEPAGE=N&...` | **Поиск офферов (основной)** | `text/html` содержащий `<script>...jQuery(...).ehtml("<table class=res>...</table>")...</script>` (JS для getScript) |
| 2 | `GET /search_tour?samo_action=TOURINC&...` | Зависимые списки (туры) | JS script (~129KB) |
| 3 | `GET /search_tour?samo_action=ADULT&...` | Пересчёт под состав | JS script |
| 4 | `GET /search_tour?samo_action=CONTENT&CATCLAIM=0x...` | **Состав пакета (detail modal)** | JS: `jQuery.modal("<div>Состав пакета…")` |
| 5 | `GET /search_tour?samo_action=STATS` / `COMMISSIONS` / `BOARDING` | График цен / комиссия / посадка | JS script |
| 6 | Booking: `.bron` click → `samo.ROUTES.bron` / `bron_person` (CATCLAIM) | Бронирование (не исследовано до конца) | — (auth required, см. §11) |

Полный captured URL (evidence `network_stage3.json`):
```
GET https://summertour.az/search_tour?samo_action=PRICES
  &TOWNFROMINC=1930&STATEINC=9&TOURINC=229
  &CHECKIN_BEG=20260920&CHECKIN_END=20260927&NIGHTS_FROM=7&NIGHTS_TILL=10
  &ADULT=2&CHILD=0&CURRENCY=2
  &TOWNS_ANY=1&TOWNS=&STARS_ANY=1&STARS=&hotelsearch=0&HOTELS_ANY=1&HOTELS=
  &MEALS_ANY=1&MEALS=&ROOMS_ANY=1&ROOMS=&FREIGHT=0&FILTER=0&MOMENT_CONFIRM=0
  &HOTELTYPES=&PARTITION_PRICE=32&PRICEPAGE=1&DYN_SEPARATE=1&rev=2841405266
Headers: Cookie: SAMO=...; pLANG=rus; pSTATEINC=9; pTOWNFROMINC=1930
         X-Requested-With: XMLHttpRequest (не обязателен — работает и без), Referer
CSRF: НЕТ (CONFIRMED — нет токенов, signed requests)
Body: нет (GET)
Response: JS-скрипт с HTML-таблицей офферов (не чистый JSON)
```

**Важно:** это НЕ документированное API — внутренний endpoint SAMO-движка (Variant C). Вариант A (JSON API) отсутствует; B (HTML table в primary document) — нет (первичный документ — каркас без данных); D — не требуется, т.к. endpoint вызывается напрямую (browser не нужен для получения данных, но нужен для «полного UX» с прогресс-баром).

## 6. Search Parameters (все подтверждены формой/JS — CONFIRMED)

| Параметр | Значения (факт) | Примечание |
|---|---|---|
| STATEINC | `9` = Турция (единственная страна в UI) | Incoming AZE |
| TOWNFROMINC | `1930` = Баку (единственный вылет) | |
| TOURINC | `0`=все; `229`=Antalya 2026; `254`=Antalya 2026 (NO RETURN); `255`=Istanbul 2026-2027 (Ajet) +1; `238`=Istanbul 2026-2027 GDS; `233`=Kushadasi GDS 2026 | 6 программ |
| CHECKIN_BEG / CHECKIN_END | `YYYYMMDD` | datepicker |
| NIGHTS_FROM / NIGHTS_TILL | 2..14 | |
| ADULT | 1..8+ | |
| CHILD / AGE1..AGE3 / AGES | 0..3 ребёнка, возрасты | AGES="7,9" в URL |
| STARS / STARS_ANY | `"4,5"` / `1` | чекбоксы |
| TOWNS / TOWNS_ANY | id курортов (1968, 1959, 1962, 1966…) / `1` | |
| MEALS / MEALS_ANY | id питания (3,4,7,5…) / `1` | |
| ROOMS / ROOMS_ANY | id типов номера / `1` | |
| HOTELS / HOTELS_ANY / hotelsearch | id отелей / `1` / флаг | |
| COSTMIN / COSTMAX | цена | присутствуют в JS |
| FREIGHT | наличие мест на рейс | |
| MOMENT_CONFIRM | мгновенное подтверждение | |
| FILTER / HOTELTYPES / PARTITION_PRICE(=32) / DYN_SEPARATE / PRICEPAGE | служебные | captured |
| CURRENCY | `2` = USD | |

«Город/курорт», «категория отеля», «тип номера», «оператор», «цена» — подтверждены. Отдельного поля «рейс/авиакомпания» в форме нет (факт: авиаданные приходят в результатах — transport cell).

## 7. Result Schema (из 100 строк PRICES, CONFIRMED)

Каждый `<tr>` несёт CSS-ключи и data-атрибуты:

```html
<tr class="even price_info white_row stats stateFromKey-36 townFromKey-1930 stateKey-9
    checkIn-20260926 nights-7 hnights-7 tourKey-229 spoKey-34972 programTypeKey-2
    hotelKey-2807 htPlaceKey-4 roomKey-4 mealKey-6 adult-2 child-0"
    data-townfrom="1930" data-state="9" data-checkin="20260926" data-nights="7"
    data-hnights="7" data-cat-claim="0x430A...00" data-packet-type="0"
    data-hotel="2807" data-statefrom="36" data-hotel-lat="" data-hotel-lng="">
```

| Поле | Источник | Пример |
|---|---|---|
| external offer ID | `spoKey-*` + `data-cat-claim` | `34972` + hex CLAIM |
| hotel / hotel ID | `hotelKey-*`, `data-hotel`, текст TD | `2807`, `HIMEROS BEACH HOTEL 3* (Сиде)` |
| departure (date+time) | TD class sortie | `26.09.2026, 07:55` |
| tour program | `tourKey-*` | `Antalya 2026 — Групповой экскурсионный` |
| nights | `nights-*` / `data-nights` | `7` |
| meal | `mealKey-*`, текст | `6` = `AI` |
| room | `roomKey-*`, текст | `4` = `STANDARD ROOM / DBL` |
| **price** | `span.price` data-атрибуты | `data-cat-price="1376.9" data-currency="2" data-currency_title="USD" data-converted-price-number="1376"` |
| old price | `data-cat-price_old=""` | пусто = нет скидки в этой выдаче |
| price type | TD `all_prices` | `AYT 822 Early booking/2026` |
| availability | `hotel_availability_R/N` + title | `R`=Есть места, `N`=Нет |
| transport | TD `transport` | `Азербайджанские авиалинии` (fr_place_l/r флаги мест) |
| transfer/package composition | CONTENT modal | «Состав пакета» (service_31 …) |
| images/description | **в search response НЕТ** | только на hotel page / CONTENT |
| booking URL | не в HTML; `.bron` → ROUTES.bron | требует auth/сессию |

Разделение: SEARCH INPUT = §6; RESULT DATA = таблица выше; DETAIL DATA = CONTENT modal (состав пакета); BOOKING DATA = за границей исследования.

## 8. Price Behaviour — эксперименты (CONFIRMED)

База: Turkey/Antalya 2026 (TOURINC=229), вылет 20.09.2026, 7–10 ночей, USD:

| Изменение | Результат (первые цены страницы) | Вывод |
|---|---|---|
| ADULT=1 | 821.03 / 839.34 / 864.43… | база |
| ADULT=2 | 1376.90 / 1410.53 / 1431.33… | **total за пакет, растёт с составом** |
| ADULT=2+CHILD=1 | 1899.62 / 1933.25… | дети влияют, child price < adult |
| NIGHTS 7–10 → 4–6 | 1234.85 / 1264.14… | ночи влияют |
| Дата вылета (01.10 → 20.09) | на 01.10 «Нет данных» | сезонность/загрузка |
| Отель | другой hotelKey → другая цена | hotel влияет |

- Цена приходит **из response** (`data-cat-price`), в USD (`data-currency_title`); отображается и конвертированное значение (`data-converted-price-number`) — CONFIRMED механизм мультивалюты.
- **Total vs per person:** ADULT=2 ≈ 2 × ADULT=1 (±5–10%), т.е. отображаемая цена — **total за пакет на состав** (INFERRED из пропорции; CONFIRMED, что растёт с числом пассажиров).
- taxes/fuel surcharge/commission/service fee: в выдаче НЕ отображены (UNKNOWN — скрыты в цене оператора); комиссия существует как отдельный action `COMMISSIONS` (для агентского контура).
- old/new price: поле `data-cat-price_old` есть (CONFIRMED механизм), в собранных выдачах пустое.
- валютный курс: конвертация выполняется сервером (converted_* поля) — CONFIRMED.
- минимальная цена: sort по цене asc по умолчанию (1376→…) — CONFIRMED.
- **PRICE ON REQUEST:** не обнаружен в выдаче (UNKNOWN; у TravelHub есть `PRICE_ON_REQUEST` mapping-место).

## 9. Availability Behaviour (CONFIRMED)

Маркеры в выдаче: `hotel_availability_R` title=**«Есть места»**, `hotel_availability_N` title=**«Нет»** (классы: R=388 span'ов, N=12 на 100 офферов; один оффер несёт несколько span'ов — по видам мест, включая рейс). Отдельного «limited» с количеством мест в выдаче НЕТ (число мест не публикуется; места на рейс — флаги fr_place_l/r). Стоп-сейлы существуют в агентском контуре (пункт меню «Остановки продаж в гостиницах» после логина; в JS есть класс `.stop` с notify). 

**Критическое различие:** availability в PRICES — **search-result availability** (CONFIRMED — это результат поискового запроса, а не подтверждение). `booking-confirmed availability` требует отдельного шага (бронирование через auth-контур, не исследовано — граница §11). Для TravelHub это означает: search availability ≠ бронеподтверждение, обязателен supplier re-check при checkout.

## 10. Detail Page

- **Отдельного URL-детейлинга оффера нет** (CONFIRMED: клик по отелю открывает hotel-page SAMO, клик по `span.additional` → `samo_action=CONTENT` modal с CATCLAIM).
- **CONTENT response** (3.1KB): modal «Состав пакета» — таблица сервисов (`service_31` и т.д.) — состав пакета по конкретному CLAIM. Это **detail data** (то, чего нет в search): точный состав услуг пакета.
- Стабильный deep-link на оффер: отсутствует (только пересборка через параметры поиска). Устойчивая ссылка на отель — есть (SAMO hotel page).
- Фотографии/описание отеля — на hotel page (CONFIRMED наличие контура), в search response отсутствуют.
- Cancellation rules: в полученных ответах не обнаружены (UNKNOWN).

## 11. Booking Flow Boundary (исследование остановлено до бронирования)

Восстановленная последовательность (INFERRED из кода `st_pack.js` + UI):

```
Search (PRICES) → select offer (row CATCLAIM) → [price re-check при манипуляциях: samo_action=ADULT/CHILD/NIGHTS]
→ detail (CONTENT) → Бронирование: клик .bron → samo.ROUTES.bron / bron_person (CATCLAIM)
→ пассажирские данные → payment — auth (B2B/агентский логин) — НЕ исследовано
```

- **Повторная проверка цены/availability:** на клиенте пересчёт происходит при любом изменении параметров (CONFIRMED — отдельные XHR); **серверный re-check непосредственно перед бронированием — INFERRED (да), но не подтверждён** (за границей исследования).
- Booking endpoint: `samo.ROUTES.bron` / `bron_person` — маршрут существует (CONFIRMED из JS), требует сессию/авторизацию (B2B-портал — отдельный домен `b2b.summertour.az`, 302 → логин, CONFIRMED).
- Реальное бронирование НЕ выполнялось (правило §12).

## 12. Authentication

| Операция | Auth? | Статус |
|---|---|---|
| search | **нет** — anonymous достаточно (cookie SAMO выдаётся автоматически) | CONFIRMED |
| price | нет | CONFIRMED |
| detail (CONTENT) | нет | CONFIRMED |
| booking (bron) | **да** — агентский/B2B аккаунт | INFERRED (login-гейт подтверждён на B2B; точные требования — не исследовано) |

Credentials НЕ запрашивались и не обходились (правило §13).

## 13. Technical Protections

| Мера | Факт |
|---|---|
| Cloudflare | CONFIRMED (Server: cloudflare, cdn-cgi/rum beacon). Простой программный клиент (urllib) работал без CAPTCHA-вызовов при низком RPS |
| CAPTCHA / anti-bot challenge | НЕ обнаружены в исследованном сценарии (CONFIRMED — отсутствие в ходе эксперимента ≠ гарантия отсутствия; при агрессивном poll Cloudflare может включить challenge — INFERRED риск) |
| CSRF / signed requests / dynamic tokens | НЕТ (CONFIRMED) |
| Rate limits | официально не опубликованы (UNKNOWN); эмпирически 5–8 запросов с паузами 2–3с — без блокировок |
| Session expiry | cookie SAMO — PHP session (стандартное время жизни; точный TTL UNKNOWN) |
| Response stability | `rev=2841405266` — версия статики (токен деплоя; изменения движка меняют разметку — риск парсинга) |

## 14. Legal/Commercial Findings

| Источник | Факт |
|---|---|
| robots.txt | CONFIRMED: **no `Disallow` rules** — только Cloudflare content-signal preamble (search/ai-input/ai-train сигналы без запретов). Формально crawling не запрещён |
| Terms/оферта | `/agreement` — форма «Договор с агентством» → **редирект на логин B2B** (CONFIRMED): коммерческие условия закрыты, доступны после агентского договора |
| API documentation / partner program | публично НЕТ (UNKNOWN; есть B2B-портал и контакты) |
| Итог | **TECHNICALLY POSSIBLE** = да (CONFIRMED). **LEGALLY/CONTRACTUALLY CONFIRMED** = НЕТ — коммерческое использование данных (цены, фото, описания) требует договора с оператором (INFERRED из закрытой оферты + стандартной практики туроператоров). **Использование как есть = риск**: названия/описания/фотографии — контент оператора/отелей (copyright), цены — коммерческая информация оператора, deep links — не гарантированы |

## 15. TravelHub Mapping (предложение, НЕ реализовано)

| Summertour | TravelHub canonical | Confidence |
|---|---|---|
| `tourKey` + название программы | Supplier program → external Product candidate | confirmed |
| `spoKey` + `data-cat-claim` | `SupplierOffer.externalId` (composite: SPO+CLAIM+date) | confirmed |
| `hotelKey`, hotel name, `data-hotel-lat/lng` | Product/PDP hotel identity + geo (lat/lng пустые в выдаче — только название) | confirmed id / inferred geo |
| `data-checkin` (YYYYMMDD) | `serviceDate` (Booking/Availability date) | confirmed |
| `nights` | `CommercialPeriod` duration / nights basis | confirmed |
| `mealKey` (AI/BB/…) | board basis → attribute | confirmed id / inferred label-map |
| `roomKey` | room type → attribute | confirmed id / inferred label-map |
| `data-cat-price` + `data-currency_title` | supplier gross price snapshot (USD) → TravelHub Quote input | confirmed |
| `data-cat-price_old` | oldPrice/discount display | confirmed mechanism |
| `hotel_availability_R/N` | Availability state: R→available, N→not available; limited — НЕТ; on request — НЕТ | confirmed mapping |
| `transport` cell + `fr_place_*` | flight/airline info → optional attribute | confirmed presence / inferred semantics |
| CONTENT «Состав пакета» | PDP sections (itinerary/services) | confirmed existence / inferred structure |
| `.bron` ROUTES (CATCLAIM) | booking deep action (после договора) | confirmed existence / inferred contract |
| price type «Early booking/2026» | CommercialRestriction (ADVANCE_BOOKING) аналог | inferred |

Unknown/нет в источнике: количество мест, cancellation rules, taxes breakdown, точная гео-привязка отелей.

## 16. Live Inventory vs Imported Product Analysis

| Критерий | Mode A: Dynamic Supplier Inventory | Mode B: Imported Catalog (sync → Product) |
|---|---|---|
| Freshness | максимум (запрос = актуальные цены) | TTL синка (часы/дни) |
| Price accuracy | точная на момент запроса | устаревает (риск расхождения при брони) |
| Availability | search-result, требует re-check | то же + дрейф |
| SEO | НЕТ (динамика не индексируется) | ДА (настоящие Products, PDP, индексация) |
| Caching | обязателен (TTL минуты) | уже в БД |
| DB load | минимальный (без Product-взрыва) | тысячи Product/Price records |
| Supplier dependency | витрина падает при недоступности supplier | деградация мягкая |
| Failure mode | show «недоступно» / cache | stale data (опасно для цен) |

**Рекомендация для следующего этапа: Mode A** (динамический supplier inventory c TTL-кэшем) — Summertour отдаёт пакетные туры с частыми ценами; импорт тысяч Product каждые N минут противоречит правилу «не создавать Product каждые 5 минут» и не даёт SEO-выигрыша без договора. Mode B — только для стабильно продаваемых программ после заключения договора (гибрид: витрина A + избранные Products B).

## 17. Recommended Integration Architecture

**Выбор: B — Public/internal HTTP endpoint** (`GET /search_tour?samo_action=PRICES`) — при условии договора/разрешения Summertour; **fallback: D — browser adapter** (если Cloudflare начнёт блокировать программный клиент). Официального API (A) нет; structured feed (C) не обнаружен.

Концепция (совпадает с §17 промпта):

```
External Supplier Offer (PRICES row → normalized SupplierOffer)
   → fresh price/availability snapshot (TTL cache)
   → user selection
   → supplier re-check (свежий PRICES по CLAIM/параметрам)
   → TravelHub Quote (ISSUED, frozen totals)
```

Соответствие TravelHub: Pricing (Tariff+Period) ≠ Availability (restriction-aware) ≠ Quote (freeze) — **уже покрыто**: snapshot-модель supplier соответствует `CommercialPeriod` price resolve; re-check при selection соответствует CheckoutIntent availability re-check; frozen Quote — та же роль, что supplier-подтверждение. Нового pricing authority НЕ создаём: supplier price — внешний snapshot, который маппится в Quote при бронировании (не в Tariff).

## 18. Multi-Supplier Extension

Рекомендация (без реализации в этом аудите):

```ts
interface SupplierAdapter {          // паттерн: PaymentProviderRegistry (finance/provider)
  search(q: SupplierSearchQuery): Promise<SupplierOffer[]>;
  getOffer(ref: SupplierOfferRef): Promise<SupplierOfferDetail>;
  refreshPrice(ref): Promise<PriceSnapshot>;
  refreshAvailability(ref): Promise<AvailabilitySnapshot>;
  // booking — отдельный capability-флаг (как PaymentProviderCapabilities)
}
class SupplierAdapterRegistry { register(adapter); get(code); }
// SummertourAdapter implements SupplierAdapter (PRICES/CONTENT/…)
// Регистрация в DI; Vitrine читает через SupplierOfferService — БЕЗ изменения витрины
```

## 19. Performance

- Concurrency: эмпирически безопасно **последовательные запросы с паузами 2–3s**; для production — 1–2 параллельных максимум (Cloudflare-риск), queue/background worker (инфраструктуры в TravelHub пока нет — нужен `@nestjs/schedule` или BullMQ на этапе implementation).
- Timeout supplier: 30–90s (наблюдаемые ответы PRICES 0.4–5s).
- Cache TTLs (рекомендация): search results 5–15 мин; price snapshot 5 мин; availability 5–10 мин; detail/CONTENT 24 ч (состав пакета стабилен); идемпотентность re-check — `ExternalIdempotencyRecord`.
- Circuit breaker: 3–5 ошибок подряд → open 60s → показать «supplier недоступен», НЕ показывать stale price как authoritative.
- Rate limit на нашей стороне: token bucket на supplier (напр. 10 req/min), независимо от витринного трафика.

## 20. Security

- Credentials supplier (если появятся для B2B-бронирования): только env/secret manager, НЕ в коде; логирование без tokens/cookies/passenger PII (правила уже соответствуют codebase-конвенциям redact()).
- Пассажирские данные при брони: минимальный сбор, шифрование in transit (HTTPS и так есть).
- SSRF/инъекции: supplier URL — константа конфигурации; парсинг HTML — sanitize.
- НЕ логировать полные CATCLAIM/сессии Summertour в application logs.

## 21. Risks

| Риск | Уровень | Митиг­ация |
|---|---|---|
| Нет договора → юридический риск коммерческого использования цен/контента | **высокий** | договор/B2B до запуска; в противном случае — только pilot/internal |
| Изменение разметки SAMO (`rev`) ломает парсер | средний | contract-tests на структуру PRICES + alert + browser-adapter fallback |
| Cloudflare challenge при нагрузке | средний | низкий RPS, cache, legal B2B/API канал |
| «Нет данных» на пустые даты (нормальный ответ) | низкий | корректная обработка empty result |
| Расхождение search price vs booking price | средний | обязательный re-check до Quote freeze |
| Session cookie expiry в длинных сценариях | низкий | ре-инициализация сессии (GET /search_tour) |
| Отсутствие cron/queue инфраструктуры в TravelHub | средний | добавить на этапе implementation (schedule/BullMQ) |

## 22. Exact Browser Evidence

- **Environment:** Chromium headless (Playwright) + curl; Windows; 2026-09-14 08:10–08:45 UTC.
- **URLs:** `https://summertour.az/search_tour` (форма, 200, ~250KB); `https://summertour.az/search_tour?samo_action=PRICES&…` (200, 322–560KB); `…samo_action=CONTENT&CATCLAIM=0x…` (200, 3.1KB); `https://b2b.summertour.az/` (302→login); `/agreement` (200, форма → B2B логин).
- **Search parameters:** STATEINC=9, TOWNFROMINC=1930, TOURINC=229, CHECKIN_BEG=20260920, NIGHTS 7–10, ADULT=2, CURRENCY=2 (и вариации ADULT=1/+CHILD, NIGHTS 4–6, PRICEPAGE 1–4).
- **Фактический результат:** 100 офферов/страница, 4+ страницы; цены 821.03 → 3536.58 USD; hotelKeys, spoKeys, mealKeys, roomKeys, availability R/N.
- **Screenshots:** `docs/reports/evidence/summertour_audit/01_search_form.png`, `03_results.png`, `05_stage3_filled.png`, `06_stage3_results.png`.
- **Network captures:** `network_stage3.json` (полный запрос PRICES с headers/params), `price_probes.json` (матрица вариаций), `prices_page1_sample.js`, `prices_2adults_1child_sample.js`, `content_response.js`, `agreement_text.txt`.

## 23. Implementation Plan for Next Stage (не выполнять в этом запуске)

1. **Коммерческий шаг:** контакт Summertour — запрос API/фид/агентский договор (это главный gate; технически всё готово).
2. `SupplierAdapter` interface + `SupplierAdapterRegistry` (паттерн PaymentProviderRegistry) — код-структура без изменения витрины.
3. `SummertourAdapter`: PRICES → `SupplierOffer[]` (парсер `<tr price_info>`: keys + data-атрибуты + price span), CONTENT → детализация пакета.
4. `SupplierOfferService` + TTL-cache (search 10 мин / price 5 мин / availability 10 мин / detail 24 ч), circuit breaker, token-bucket.
5. Витрина: блок «Предложения Summertour» на Vitrine (Mode A) с пометкой динамической цены.
6. Booking path (после договора): бронь через B2B/bron-route ОПЕРАОРОМ вручную (старт) → затем автоматизация bron_person.
7. Наблюдаемость: contract-tests структуры ответа, алерты на «Нет данных»>X% и schema drift.
8. Опционально Mode B: синус избранной программы (Antalya 2026) в Products с пометкой `source=supplier`.

## 24. Final Verdict

**READY WITH CONDITIONS**

Технически: endpoint найден, воспроизводим, отдаёт реальные цены/availability без auth (CONFIRMED). Условия: (1) коммерческое согласие Summertour (договор/B2B) до публичного использования данных; (2) обязательный supplier re-check перед Quote; (3) устойчивость к изменению разметки (contract-tests) и Cloudflare-лимитам (низкий RPS + кэш); (4) implementation — только в следующем запуске.
