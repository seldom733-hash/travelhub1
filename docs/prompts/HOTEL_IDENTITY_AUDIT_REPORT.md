# HOTEL IDENTITY AUDIT REPORT

Метод: полнотекстовый grep по backend/frontend/docs/schema + SELECT-аудит БД travelhub1 + чтение адаптеров/sync-сервисов/тестов. Все ссылки — файл:строка на момент аудита (2026-10-06). Аудит строго read-only.

---

## 1. Executive Verdict

**Вердикт: KEEP BOTH — DIFFERENT SEMANTICS (транспортный алиас vs supplier-native identity)**

Доказательства:

1. `hotelExternalId` — имя **платформенного транспортного контракта**. Оно живёт в DTO-слое:
   - `SupplierSearchQuery.hotelExternalId` — [supplier.types.ts:42](../../backend/src/modules/supplier/supplier.types.ts) («Hotel external ID (for supplier-specific filtering)»)
   - `SupplierOffer.hotelExternalId` — [supplier.types.ts:125]
   - price-calendar query [supplier.types.ts:337], refresh query [supplier.types.ts:379]
   - HTTP API: [public-supplier.controller.ts:111](../../backend/src/modules/supplier/public-supplier.controller.ts) (`@Query("hotelExternalId")`), create-request DTO [public-supplier.controller.ts:293]
2. `hotelKey` — **supplier-native** имя идентификатора отеля в мире SAMO-htm (KOMPAS/KAZUNION/SUMMERTOUR). Парсится из CSS-классов ответа поставщика:
   - KOMPAS: [kompas.adapter.ts:1611](../../backend/src/modules/supplier/kompas/kompas.adapter.ts) `classes.match(/hotelKey-(\d+)/)`
   - SUMMERTOUR: [summertour.response-parser.ts:36](../../backend/src/modules/supplier/summertour/summertour.response-parser.ts)
   - KAZUNION: [kazunion-http.service.ts:387](../../backend/src/modules/supplier/kazunion/kazunion-http.service.ts)
3. Ключевое доказательство различия семантики — **ANEX**: у него `hotelKey` НЕ СУЩЕСТВУЕТ вообще, а `hotelExternalId` мапится из `raw.hotelInc` ([anex-hotel.adapter.ts:541](../../backend/src/modules/supplier/anex/anex-hotel.adapter.ts)). Т.е. `hotelExternalId` — это «ID отеля у поставщика, каким бы именем он там ни назывался», а `hotelKey` — конкретное имя поля конкретного семейства поставщиков. Слияние идентификаторов сломало бы ANEX-контракт.

Почему `hotelExternalId` существует, если у Product уже есть `hotelKey`: потому что платформа мультипоставщичная. `hotelExternalId` — единое имя в запросах поиска/календаря/заявки и в офферах, скрывающее per-supplier различия (Samo `hotelKey`, ANEX `hotelInc`). `hotelKey` — внутреннее имя SAMO-мира и фактический identity-ключ каталога (код продукта, slug, имя файла фото).

---

## 2. hotelExternalId — Actual Purpose

**Origin (значения):** создаётся в адаптерах из supplier-ответа:
- KOMPAS: `hotelExternalId: raw.hotelKey || query.hotelExternalId` — [kompas.adapter.ts:1695]
- SUMMERTOUR (два адаптера): [summertour.adapter.ts:420], [summertour-new.adapter.ts:408] — та же формула
- KAZUNION: `hotelExternalId: raw.hotelKey || undefined` — [kazunion.adapter.ts:705]
- ANEX: `hotelExternalId: raw.hotelInc` — [anex-hotel.adapter.ts:541]; tour-flow фильтр по `r.hotelInc` [anex.adapter.ts:351–353]

**Owner:** supplier-домен (DTO-контракт поиска). Schema.prisma поля не содержит (grep по schema + миграциям = 0 совпадений).

**Consumers:**
- SEARCH: KOMPAS checkbox `#hotel<id>` + `HOTELS=<id>&HOTELS_ANY=0` [kompas.adapter.ts:410–432, 1154]; SUMMERTOUR HOTELS-параметр через `hotelKey: query.hotelExternalId` — [kazunion.adapter.ts:345, 501] для KAZUNION; SUMMERTOUR http: [summertour-http.service.ts:106–107] (`HOTELS: params.hotelKey ?? ""` — параметры туда приходят из `query.hotelExternalId` через request-builder/adapter)
- PRICE/REFRESH: контекст recheck в tour-request [tour-request.service.ts:114–129](../../backend/src/modules/supplier/tour-request.service.ts); cache-ключ календаря [supplier-offer.service.ts:287](../../backend/src/modules/supplier/supplier-offer.service.ts)
- AGGREGATOR: резолв имени отеля → per-supplier native id из `SupplierGeoLink kind=HOTEL` → `hotelExternalId: match.externalId` [supplier-aggregator.service.ts:548–574](../../backend/src/modules/supplier/supplier-aggregator.service.ts)
- REQUEST: фронт шлёт в create-request [OfferModal.tsx:324](../../frontend/components/supplier/OfferModal.tsx); сервис кладёт в `pinnedRequirements` и ищет Product [tour-request.service.ts:117, 159]
- UI: [TourDetail.tsx:61](../../frontend/components/supplier/TourDetail.tsx) читает `attributes?.hotelExternalId ?? attributes?.hotelKey` (фронт уже толерантен к обоим ключам), [MonthlyCalendar.tsx:39], [OfferDetailsModal.tsx:89,131]

**Persistence:** `Request.pinnedRequirements.hotelExternalId` (проверено в БД: MKT-REQ-00000301 → `"1144"`). В `Product.attributes` НЕ пишется ни одним sync-сервисом (БД: 0/3010). В Order/Booking — 0 упоминаний в коде модулей order/booking. Колонки в Prisma нет.

**Lifecycle:** supplier HTML/API → adapter normalize (→ `SupplierOffer.hotelExternalId`) → фронт (календарь/офферы) → Request DTO → pinnedRequirements + Product lookup + supplier recheck. Замкнутый транспортный цикл; в каталог как поле не сохраняется.

---

## 3. hotelKey — Actual Purpose

**Origin:** supplier-native id отеля из SAMO-htm ответа (CSS-класс `hotelKey-<id>` чекбокса отеля): KOMPAS [kompas.adapter.ts:1611], SUMMERTOUR [summertour.response-parser.ts:36], KAZUNION [kazunion-http.service.ts:387].

**Owner:** supplier-домен как identity-ключ каталога. Не является колонкой Prisma — хранится внутри `Product.attributes` JSON.

**Consumers:**
- SYNC/IDENTITY: product code `<SUPPLIER>-<tourIncValue>-<hotelKey>` (KOMPAS [kompas-sync.service.ts:199], KAZUNION [kazunion-sync.service.ts:253], SUMMERTOUR [summer-bulk-sync.service.ts:224]); группировка/дедуп офферов по `(tourIncValue, hotelKey)` [kompas-sync.service.ts:181–190], [summer-sync.service.ts:344–360], [kazunion-sync.service.ts:240–253]; slug `kompas-…-<hotelKey>` [kompas-sync.service.ts:285]; attributes {hotelKey, hotelName|hotel, …} пишут все три [kompas-sync.service.ts:226–239], [kazunion-sync.service.ts:287–300], [summer-bulk-sync.service.ts:260–282]
- UI/фото: имя файла фото `/hotels/<tourinc>-<hotelKey>.jpg` — [hotel-photo.ts:9–27](../../frontend/lib/hotel-photo.ts); ProductCard/Tours/HotTours через `hotelPhotoKeyFromSlug(card.slug)`
- Supplier API: значение `hotelKey` уходит в `HOTELS=` SAMO-запросов ([kazunion-http.service.ts:588–589], [summertour-http.service.ts:106–107])
- Composite externalOfferId: `${spoKey}-${hotelKey}-${checkIn}-${roomKey}-${mealKey}` [kompas.adapter.ts:1692]

**Persistence:** `Product.attributes.hotelKey` (БД: 3010/3010 tour-продуктов). В Request — нет (туда попадает только `hotelExternalId`). В Prisma-колонках — нет.

**Lifecycle:** supplier HTML → parse `hotelKey` → raw row → sync group → `Product.attributes.hotelKey` + code/slug/photo. Обратный путь: slug/attributes → фронт (TourDetail fallback) → `hotelExternalId` → supplier API `HOTELS=`.

---

## 4. Relationship

**Ответ: DEPENDS ON SUPPLIER (для SAMO-тройки — «YES CURRENTLY, по маппингу, не по контракту»; для ANEX — NO)**

- `hotelKey: query.hotelExternalId` ([kazunion.adapter.ts:345]) доказывает **маппинг**, а не тождество семантики: одно и то же значение проходит под двумя именами на разных слоях.
- Для KOMPAS/KAZUNION/SUMMERTOUR значение `SupplierOffer.hotelExternalId` **присваивается из** `raw.hotelKey` ([kompas.adapter.ts:1695], [kazunion.adapter.ts:705], [summertour.adapter.ts:420]) — равенство значений гарантировано кодом адаптера сегодня, но это побочный эффект текущей реализации, а не контракт (ни один тип/комментарий/тест не фиксирует инвариант «hotelExternalId === attributes.hotelKey»).
- Для ANEX равенства нет и не может быть: `hotelExternalId := raw.hotelInc`, `hotelKey` в ANEX-домене отсутствует. Появись ANEX tour-карточки в каталоге с `attributes.hotelKey` — инвариант бы нарушился.
- Контрактного документа о равенстве не существует (grep по docs: только сам audit-промпт).

---

## 5. Supplier Matrix

| Supplier | Identifier | Source | Adapter mapping | Product storage | Runtime usage | Meaning |
|---|---|---|---|---|---|---|
| SUMMERTOUR | hotelExternalId | SupplierOffer normalize из `raw.hotelKey` [summertour.adapter.ts:420] | `raw.hotelKey \|\| query.hotelExternalId` | NOT FOUND (0/310) | SEARCH/PRICE/REQUEST (transport DTO) | Platform transport alias |
| SUMMERTOUR | hotelKey | SAMO-htm `hotelKey-<id>` [summertour.response-parser.ts:36] | → `SupplierOffer.hotelExternalId` | `attributes.hotelKey` 310/310 | SYNC identity (code/slug/dedupe/photo), supplier API `HOTELS=` | Supplier-native hotel id |
| KOMPAS | hotelExternalId | из `raw.hotelKey` [kompas.adapter.ts:1695] | тот же pattern | NOT FOUND (0/22) | SEARCH checkbox/URL [411,1154], REQUEST [tour-request lookup] | Platform transport alias |
| KOMPAS | hotelKey | SAMO-htm [kompas.adapter.ts:1611] | → offer.hotelExternalId | `attributes.hotelKey` 22/22 | SYNC identity, dedupe, HOTELS= | Supplier-native hotel id |
| KAZUNION | hotelExternalId | из `raw.hotelKey` [kazunion.adapter.ts:705]; dict HOTEL externalId=h.id [286–288] | `hotelKey: query.hotelExternalId` [345,501] | NOT FOUND (0/2677) | SEARCH/PRICE, aggregator resolveHotelKeys | Platform transport alias |
| KAZUNION | hotelKey | SAMO-htm [kazunion-http.service.ts:387] | → offer.hotelExternalId | `attributes.hotelKey` 2677/2677 | SYNC identity, `HOTELS=` [588–589], code/slug/photo | Supplier-native hotel id |
| ANEX tours | hotelExternalId | `raw.hotelInc` (tour rows) [anex.adapter.ts:351–353, 474–475] | hotelInc → hotelExternalId | NOT FOUND (0 ANEX-продуктов в каталоге) | SEARCH/AVAILABILITY filter, state resolve [127–142] | Platform transport alias (= hotelInc) |
| ANEX tours | hotelKey | NOT FOUND | — | NOT FOUND | NOT FOUND | — |
| ANEX hotels | hotelExternalId | `raw.hotelInc` [anex-hotel.adapter.ts:541] | hotelInc → hotelExternalId; фильтр [378–380] | NOT FOUND | SEARCH/PRICE filter | Platform transport alias (= hotelInc) |
| ANEX hotels | hotelKey | NOT FOUND | — | NOT FOUND | NOT FOUND | — |

Дополнительные пользователи (вне таблицы): `SupplierGeoLink kind=HOTEL` (externalId = supplier hotel id, пишут все адаптеры: [kazunion.adapter.ts:288], [anex.adapter.ts:683], [kompas.adapter.ts:1583], [samo-geo-discovery.ts:143]) читается агрегатором [supplier-aggregator.service.ts:548–574] и geo-пикером [geo.service.ts:498–510].

---

## 6. Product Data Reality

SELECT по `catalog."Product"` (attributes ? 'supplierCode'):

| supplier | total | has hotelKey | has hotelExternalId | both | neither |
|---|---|---|---|---|---|
| KAZUNION | 2677 | 2677 | 0 | 0 | 0 |
| SUMMERTOUR | 310 | 310 | 0 | 0 | 0 |
| KOMPAS | 22 | 22 | 0 | 0 | 0 |
| ANEX | 0 | — | — | — | — |
| **Итого** | **3010** | **3010** | **0** | **0** | **0** |

Сравнение значений «оба заполнены» невозможно: ни один продукт не имеет обоих ключей. Проверка кейса аудита: `SUMMERTOUR-255-1144` имеет `attributes.hotelKey = "1144"` = `pinnedRequirements.hotelExternalId` заявки — значения совпадают (по маппингу адаптера). Формат значений `hotelKey` — числовые строки (samples: 18024, 3215, 37284…), вписываются в code/slug `<tourInc>-<hotelKey>`.

---

## 7. Request Flow

```
Product.attributes (hotelKey="1144", hotel/hotelName, supplierCode)          [sync]
  → PublicProductCard slug "summertour-255-1144…"                             [public-catalog]
  → TourDetail: hotelExternalId = attributes?.hotelExternalId ?? attributes?.hotelKey   [TourDetail.tsx:61]
      → ("1144", из fallback hotelKey — поле hotelExternalId в attributes отсутствует)
  → календарь: hotelExternalId в query [MonthlyCalendar.tsx:39]                (транспорт)
  → OfferModal: createTourRequest({ hotelExternalId: offer.hotelExternalId })  [OfferModal.tsx:324]
  → POST /public/supplier/create-request, DTO.hotelExternalId="1144"           [public-supplier.controller.ts:293]
  → tour-request.service:
      - supplier recheck: SupplierSearchQuery.hotelExternalId="1144"           [tour-request.service.ts:117] → adapter → HOTELS=1144
      - Product lookup: attributes.path["hotelExternalId"] == "1144"           [tour-request.service.ts:159] → 0 строк (в каталоге ключ hotelKey)
      → productId = NULL; productSnapshot = {productTitle: hotel, type:"TOUR"} [tour-request.service.ts:151–168, 199–205]
      - pinnedRequirements.hotelExternalId="1144"                              [tour-request.service.ts:180–197]
  → Request (productId=NULL) → проекция availableActions:
      convert = canEdit && hasD3AcceptSnapshot && money && CUSTOMER_ACCEPTED && !convertedOrderId
      hasD3AcceptSnapshot требует productSnapshot != null,
      где проекционный productSnapshot = живой Product по productId (NULL→null) [request.service.ts:455]
      → convert:false в UI (при том, что execution-путь productId не требует)
  → Order: hotelExternalId/hotelKey НЕ переносятся (0 упоминаний) — только productSnapshot/pinnedRequirements verbatim
  → Booking: идентификаторы отеля не используются (0 упоминаний)
  → supplier operation: при последующем refresh контекст берётся из searchContext (hotelExternalId) [kompas.adapter.ts:1089]
```

---

## 8. Test Reliability

**Нереалистичный мок (может быть зелёным, пока продакшн сломан):**
- [tour-request.service.spec.ts:189–199](../../backend/src/modules/supplier/tour-request.service.spec.ts): тест «product lookup keys on hotelExternalId» мокает `product.findFirst` (он вернёт продукт при ЛЮБОМ where) и ассертит только **форму** where (`path:["hotelExternalId"]`). Реальный каталог не содержит этого ключа (0/3010) → тест подтверждает баг как «фичу». Классический pass-while-production-fails.

**Тесты, отражающие продакшн-сторону sync корректно:**
- kompas-sync/kazunion/summertour sync-спеки оперируют `hotelKey` (см. grep по *.spec.ts) — соответствуют реальным attributes.
- Адаптерные спеки (kazunion.adapter.spec, kompas.adapter.spec, anex.*) проверяют нормализацию raw.hotelKey → offer.hotelExternalId — соответствуют реальности.

**Пробел:** нет теста end-to-end «создать tour-request по продукту, синкнутому из SUMMERTOUR/KOMPAS/KAZUNION, и получить productId != NULL» — именно он поймал бы рассинхрон. И нет теста проекции `computeRequestAvailableActions` для заявки с productId=NULL + непустым frozen productSnapshot.

---

## 9. Current Defect

`Request.hotelExternalId` резолвит Product **неудачно всегда** для tour-каталога:

```
tour-request.service.ts:159:  findFirst({ where: { attributes: { path: ["hotelExternalId"], equals: dto.hotelExternalId } } })
```

Единственный читатель ключа `attributes.hotelExternalId` во всём репозитории — этот lookup. Писателей ключа ноль (все три sync-сервиса пишут `hotelKey`). Итог: 0/3010 продуктов достижимы этим lookup → `productId = NULL` у всех catalog-request с сайта → проекция `computeRequestAvailableActions` даёт `convert:false` (поскольку её `productSnapshot` строится из живого Product по productId, а не из frozen Request.productSnapshot) → у заявки MKT-REQ-00000301 нет кнопки конвертации, хотя execution-конвертация разрешена (гейт productId с execution-пути снят; OrderItem получает placeholder из frozen snapshot).

Важно: lookup «успешен» для request'ов, созданных вручную с productId (админский путь), и для гипотетических продуктов, у которых атрибут кто-то создаст руками. Для supplier-sync каталога — всегда провал.

---

## 10. Risks

| Действие | Риск |
|---|---|
| Удалить `hotelExternalId` | **DANGEROUS**: ломает весь транспортный контракт поиска/календаря/refresh (SupplierSearchQuery/SupplierOffer, HTTP API, OfferModal), ANEX-интеграцию (у него нет другого имени), кэш-ключи [supplier-offer.service.ts:287] |
| Удалить `hotelKey` | **DANGEROUS**: ломает identity каталога (product code/slug/dedupe/upsert во всех трёх sync), имена фото-файлов [hotel-photo.ts], SAMO `HOTELS=`-параметризацию (внутреннее имя в http-слоях), composite externalOfferId |
| Переименовать `hotelExternalId` | DANGEROUS: это публичное имя HTTP-параметра [public-supplier.controller.ts:111,293] — ломает фронт и внешних клиентов |
| Переименовать `hotelKey` | QUESTIONABLE→DANGEROUS: «безопасно» только если переименовать ВЕЗДЕ синхронно (sync + tour-request lookup + TourDetail fallback + фото-convention), иначе данные станут нечитаемыми |
| Слить в одно поле | DANGEROUS для ANEX (нет hotelKey) и для будущих поставщиков с третьим именем native id — потеря слоя косвенности |
| Поменять Product lookup на hotelKey | LOW: чинит 3010/3010 каталога; не затрагивает ANEX (у него lookup всё равно пуст, productName-фолбэк уже работает); фронт-fallback TourDetail.tsx:61 уже шлёт то же значение |

---

## 11. Safe Architecture Options

**A. Lookup OR-обоих ключей (transport-alias awareness в точке чтения)**
- Tour-request Product lookup: `OR: [{path:["hotelExternalId"]}, {path:["hotelKey"]}]` по dto.hotelExternalId.
- Плюсы: чинит всех 3010; сохраняет оба идентификатора; ANEX не затронут; миграций нет; обратно совместимо.
- Риски: орфанные совпадения, если у разных поставщиков значения пересекутся (смягчается: искать в комбинации с supplierCode — см. §13); затрагивает 1 файл.
- Миграция: НЕТ. Совместимость: полная.
- Рекомендация: **да, минимальный безопасный фикс**.

**B. Sync начинает писать и `hotelExternalId` (dual-key backfill)**
- Плюсы: lookup не меняется; ключи сходятся по имени контракта.
- Риски: data-fix на 3010 записей + правки 3 sync-сервисов + рассинхрон старых/новых записей при частичном backfill; дублирование истины (два ключа, одно значение — будущий drift).
- Миграция: ДА (backfill). Совместимость: да.
- Рекомендация: возможно как дополнение к A позже, не как первый шаг.

**C. Проекционный фикс convert-кнопки (request.service.ts)**
- `buildRequestProjectionProductSnapshot` fallback на frozen `Request.productSnapshot` (как execution): product-less заявка с валидным frozen-снапшотом получает кнопку convert.
- Плюсы: чинит UI для ВСЕХ непривязанных заявок (в т.ч. manual/live-sales), не трогает identity-контракт вообще.
- Риски: проекция начнёт считать конвертируемыми заявки, для которых execution может отказать по другим гейтам (деньги/состав) — они и так честно проверятся на execute с 422/409.
- Миграция: НЕТ. Рекомендация: да, как отдельный фикс UI-дефекта (ортогонален A).

**D. Нормализовать каталог на `hotelExternalId` (переименование hotelKey→hotelExternalId везде)**
- Плюсы: одно имя.
- Риски: максимальный blast radius (sync×3, фото-convention, slug, тесты, существующие данные), ломает «supplier-native» семантику и ANEX-перспективу.
- Миграция: ДА, тяжёлая. Рекомендация: НЕТ.

---

## 12. RECOMMENDED ARCHITECTURE

По строгим доказательствам:

- **hotelExternalId живёт** в транспортном/DTO-слое supplier-домена: SupplierSearchQuery / SupplierOffer / HTTP query / Request DTO / pinnedRequirements. Это platform-side имя «ID отеля у поставщика».
- **hotelKey живёт** в supplier-native слое SAMO-поставщиков: parse-слои HTML и **catalog identity** (Product.attributes, code, slug, фото-файлы). Это supplier-side имя.
- **Маппинг происходит** в адаптерах при нормализации офферов (raw.hotelKey→offer.hotelExternalId — уже так) и в обратную сторону при построении supplier-запроса (query.hotelExternalId→параметр hotelKey/HOTELS= — уже так). Единственное **непокрытое маппингом место — Product lookup** в tour-request.service.
- **Request получает** `hotelExternalId` (текущий DTO менять не нужно).
- **Product хранит** `hotelKey` (supplier-native identity, уже так) — менять не нужно.
- **Supplier API получает** supplier-native id (hotelKey как значение `HOTELS=` для SAMO; hotelInc для ANEX) — уже так.

Т.е. архитектура в целом корректна; дефект — один пропущенный маппинг в точке чтения каталога + дефект проекции convert для product-less заявок.

---

## 13. MINIMAL SAFE FIX

**Не реализуется (аудит).** Минимальное изменение, чинящее Request→Product без удаления/переопределения обоих идентификаторов:

В `backend/src/modules/supplier/tour-request.service.ts` (строки 156–168) заменить точечный lookup на OR-вариант с учётом поставщика:

```ts
const product = await this.prisma.product.findFirst({
  where: {
    AND: [
      { attributes: { path: ["supplierCode"], equals: dto.supplierCode } }, // защита от межпоставщичных коллизий id
      { OR: [
        { attributes: { path: ["hotelExternalId"], equals: dto.hotelExternalId } },
        { attributes: { path: ["hotelKey"],         equals: dto.hotelExternalId } },
      ]},
    ],
  },
  select: { id: true, code: true, title: true },
});
```

Свойства фикса: оба имени сохраняются; supplierCode-guard исключает ложные совпадения одинаковых числовых id разных поставщиков; ANEX-поведение не меняется (у ANEX продуктов в каталоге нет); никаких миграций/данных; фронт не трогается. Плюс в перспективе — проекционный фикс (вариант C, §11) для существующих product-less заявок типа MKT-REQ-00000301.

---

## 14. Data Migration Requirement

**НЕТ** — для рекомендованного варианта A (и C): обе правки — изменения кода чтения, данные остаются как есть (3010×`hotelKey`).
**UNKNOWN→NO** для B (dual-key): потребовал бы backfill 3010 записей, что противоречит минимализму.
Колонки схемы не нужны в любом варианте (обе сущности — JSON-атрибуты).

---

## 15. Implementation Scope

Если будет принято решение — затронутся ТОЛЬКО эти файлы:
1. `backend/src/modules/supplier/tour-request.service.ts` — Product lookup (вариант A)
2. `backend/src/modules/supplier/tour-request.service.spec.ts` — обновить мок под реальный ключ `hotelKey` + добавить кейс product-less (см. §16)
3. `backend/src/modules/order/request.service.ts` — проекция convert (вариант C, отдельным коммитом)

Не затрагиваются: schema.prisma, миграции, sync-сервисы, адаптеры, фронт, БД.

---

## 16. Regression Test Plan

1. **SUMMERTOUR**: tour-request c hotelExternalId="1144" + реальный attributes `{hotelKey:"1144", supplierCode:"SUMMERTOUR"}` → productId проставлен (заменяет мок spec.ts:189).
2. **KOMPAS**: аналогично c supplierCode:"KOMPAS" (кейс из текущего DTO: "2807").
3. **KAZUNION**: аналогично + кейс «id существует у двух поставщиков» → выбирается продукт нужного supplierCode (guard-тест).
4. **ANEX**: tour-request c hotelExternalId (hotelInc-значение) при отсутствии ANEX-продуктов → productId NULL, productSnapshot из dto.hotel, запрос НЕ падает (regression на «NOT FOUND — это ок»).
5. **catalog request**: полный e2e product (attributes.hotelKey) → request → productId != NULL.
6. **manual request**: tour-request без hotelExternalId → productId NULL, заявка создаётся.
7. **product-less request**: проекция availableActions для заявки {productId:NULL, frozen productSnapshot непустой, CUSTOMER_ACCEPTED, деньги ок} → convert:true (вариант C) и/или convert-эндпоинт успешен (уже так).
8. **request → order**: конвертация product-less заявки → OrderItem с placeholder-identity из productSnapshot (уже покрыто частично, добавить на hotelKey-данные).
9. **supplier API calls**: adapter-тесты, фиксирующие mapping `query.hotelExternalId → HOTELS=<hotelKey>` для KOMPAS/KAZUNION/SUMMERTOUR и `hotelInc`-фильтр для ANEX (контракт маппинга — чтобы равенство значений перестало быть негласным).

---

## 17. Ответ на FINAL PRINCIPLE

> «Зачем hotelExternalId, если у Product уже есть hotelKey?»

Потому что `hotelKey` — имя идентификатора **внутри одного семейства поставщиков** (SAMO: KOMPAS/KAZUNION/SUMMERTOUR), вшитое в их HTML-протокол и в identity каталога. `hotelExternalId` — платформенное имя того же значения в **общем мультипоставщичном контракте** (поиск, календарь, заявка, офферы), под которое подставляется нативный id каждого поставщика: `hotelKey` для SAMO-тройки, `hotelInc` для ANEX. Product хранит supplier-native identity; транспорт говорит на platform-имени; мост между ними — адаптеры. Схлопывать их нельзя: равенство значений — текущее совпадение реализации SAMO-адаптеров, а не свойство системы (ANEX это доказывает). Канонический контракт: **transport = hotelExternalId, storage = hotelKey, mapping = adapter/lookup boundary**; минимальная починка — закрыть единственное непокрытое маппингом место (Product lookup в tour-request.service).

---

## 18. FINAL SAFETY CHECK

```
Code changed:      NO  (в ходе аудита не было ни одной правки исходников)
Database changed:  NO  (только SELECT; никаких UPDATE/INSERT/DELETE)
Schema changed:    NO
Tests changed:     NO
Migration created: NO
Commit created:    NO
Push performed:    NO
```

Единственный созданный артефакт — сам отчёт: `docs/prompts/HOTEL_IDENTITY_AUDIT_REPORT.md`. Изменения в `git status` (модифицированные файлы, staged-миграции) существовали до начала аудита и аудитом не трогались.
